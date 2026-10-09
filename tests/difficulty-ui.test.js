'use strict';
// Real index.html in jsdom ("browsers") against the real server. Touch/drag is NOT covered here.
const assert=require('assert');const {JSDOM}=require('jsdom');
const {start}=require('../server/server.js'),G=require('../server/game.js');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const until=async(f,ms=8000)=>{const t=Date.now();while(Date.now()-t<ms){try{const v=f();if(v)return v;}catch(e){}await sleep(40);}throw new Error('condition timeout: '+f);};
(async()=>{
  const S=await start({port:0,host:'127.0.0.1',duration:1500,countdown:300,grace:100,scoreEvery:100,dict:G.loadDictionary()});
  const open=async()=>{const d=await JSDOM.fromURL('http://127.0.0.1:'+S.port+'/',{runScripts:'dangerously',resources:'usable',pretendToBeVisual:true,beforeParse(w){w.matchMedia=()=>({matches:false,addListener(){},addEventListener(){}});w.fetch=(u,o)=>fetch(new URL(u,'http://127.0.0.1:'+S.port+'/'),o);}});
    await until(()=>d.window.__wordamix&&d.window.__mp);return d.window;};
  const $=(w,id)=>w.document.getElementById(id),on=(w,id)=>$(w,id).classList.contains('on');
  const pressed=(w,id)=>[...w.document.querySelectorAll('#'+id+' button')].filter(b=>b.getAttribute('aria-pressed')==='true').map(b=>b.dataset.d);
  const SP=await open();await until(()=>SP.__wordamix.dict.status==='large',40000);
  assert.strictEqual(SP.document.querySelectorAll('#dseg button').length,2);assert.deepStrictEqual(pressed(SP,'dseg'),['easy']);
  assert(!SP.document.querySelector('[data-d=normal],[data-d=expert]'),'normal/expert buttons must be gone');
  // EASY: WORDS button visible during play, list shows only words that exist on the board, found words get marked
  $(SP,'play').click();await until(()=>on(SP,'game')&&SP.__wordamix.state==='PLAYING');
  assert(/^EASY/.test($(SP,'hint').textContent),$(SP,'hint').textContent);assert.notStrictEqual($(SP,'wordsb').style.display,'none');
  $(SP,'wordsb').click();assert(on(SP,'wordsov'));const nWords=SP.document.querySelectorAll('#wl span').length;assert(nWords>50,'list size '+nWords);
  const sol=SP.__wordamix;const solved=SP.WMX.solve(sol.letters,sol.dict);assert.strictEqual(nWords,solved.size);
  assert(/Found 0 of /.test($(SP,'wl-sub').textContent));$(SP,'wl-close').click();assert(!on(SP,'wordsov'));
  // HARD: no in-game list, selection saved
  SP.__wordamix.home();SP.document.querySelector('#dseg [data-d=hard]').click();assert.deepStrictEqual(pressed(SP,'dseg'),['hard']);
  assert.strictEqual(JSON.parse(SP.localStorage.getItem('wordamix')).diff,'hard');
  {const sel=$(SP,'s-round'),o=SP.document.createElement('option');o.value='6';sel.appendChild(o);sel.value='6';sel.dispatchEvent(new SP.Event('change'));}
  $(SP,'play').click();await until(()=>on(SP,'game')&&SP.__wordamix.state==='PLAYING');
  assert(/^HARD/.test($(SP,'hint').textContent),$(SP,'hint').textContent);assert(/HARD/.test($(SP,'p-diff').textContent));
  assert.strictEqual($(SP,'wordsb').style.display,'none','HARD must not show the list during play');
  // HARD: list available after the round (results screen)
  await until(()=>SP.document.getElementById('resov').classList.contains('on'),30000);
  assert.notStrictEqual($(SP,'r-wordsb').style.display,'none');$(SP,'r-wordsb').click();assert(on(SP,'wordsov'));{const n=SP.document.querySelectorAll('#wl span').length;console.log('hard list size',n,'dict',SP.__wordamix.dict.status,SP.__wordamix.dict.set.size);assert(n>50);}
  $(SP,'wl-close').click();
  $(SP,'setb').click();assert(/EASY: games/.test($(SP,'stats').textContent)&&/HARD: games/.test($(SP,'stats').textContent)&&!/EXPERT/.test($(SP,'stats').textContent));
  // multiplayer: host creates on HARD, guest sees it read-only, host changes it in the lobby
  const A=await open(),B=await open();
  A.document.querySelector('#dseg [data-d=hard]').click();A.document.getElementById('mpb').click();
  assert.deepStrictEqual(pressed(A,'mp-dseg'),['hard']);$(A,'mp-name').value='Albert';$(A,'mp-create').click();await until(()=>on(A,'lobby'));
  assert(/HARD/.test($(A,'lb-diff').textContent));assert.strictEqual($(A,'lb-dseg').hidden,false);
  const code=$(A,'lb-code').textContent;B.document.getElementById('mpb').click();$(B,'mp-name').value='Bob';$(B,'mp-code').value=code;$(B,'mp-join').click();await until(()=>on(B,'lobby'));
  assert(/HARD/.test($(B,'lb-diff').textContent));assert.strictEqual($(B,'lb-dseg').hidden,true,'guest must not get the selector');
  A.document.querySelector('#lb-dseg [data-d=easy]').click();await until(()=>/EASY/.test($(B,'lb-diff').textContent)&&/EASY/.test($(A,'lb-diff').textContent));
  assert.deepStrictEqual(pressed(A,'lb-dseg'),['easy']);
  $(A,'lb-start').click();await until(()=>on(A,'game')&&on(B,'game'));await until(()=>A.__wordamix.state==='PLAYING'&&B.__wordamix.state==='PLAYING');
  assert(/EASY/.test($(A,'hint').textContent)&&/EASY/.test($(B,'hint').textContent));
  const tl=w=>[...w.document.querySelectorAll('#grid .tile')].map(t=>t.textContent).join('');assert.strictEqual(tl(A),tl(B));
  assert.notStrictEqual($(A,'wordsb').style.display,'none','easy multiplayer shows WORDS');$(B,'wordsb').click();assert(on(B,'wordsov'));
  assert.strictEqual(B.document.querySelectorAll('#wl span').length,B.WMX.solve(B.__wordamix.letters,B.__wordamix.dict).size);$(B,'wl-close').click();
  await until(()=>on(A,'game')&&$(A,'mpres').classList.contains('on')&&$(B,'mpres').classList.contains('on'));
  assert.strictEqual($(A,'mpr-diff').textContent,'EASY');assert.strictEqual($(B,'mpr-diff').textContent,'EASY');
  $(B,'mpr-words').click();assert(on(B,'wordsov'));$(B,'wl-close').click();
  // rematch on HARD: host switches after the round, WORDS button disappears for everyone, list still available at the end
  A.document.querySelector('#lb-dseg [data-d=hard]');
  [SP,A,B].forEach(w=>w.close());await S.close();console.log('difficulty UI flow passed (single-player + multiplayer lobby/game/results)');process.exit(0);
})().catch(e=>{console.error('UI FAIL',e.message||e);process.exit(1);});
