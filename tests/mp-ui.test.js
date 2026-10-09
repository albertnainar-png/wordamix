'use strict';
// Drives the real index.html (jsdom) in two "browsers" against the real server. No pointer/touch here: see README for what is NOT covered.
const assert=require('assert');const {JSDOM}=require('jsdom');
const {start}=require('../server/server.js'),G=require('../server/game.js');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const until=async(f,ms=6000)=>{const t=Date.now();while(Date.now()-t<ms){try{const v=f();if(v)return v;}catch(e){}await sleep(40);}throw new Error('condition timeout: '+f);};
(async()=>{
  const S=await start({port:0,host:'127.0.0.1',duration:1500,countdown:300,grace:100,scoreEvery:100,dict:G.loadDictionary()});
  const open=async(q='')=>{const d=await JSDOM.fromURL('http://127.0.0.1:'+S.port+'/'+q,{runScripts:'dangerously',resources:'usable',pretendToBeVisual:true,
    beforeParse(w){w.matchMedia=()=>({matches:false,addListener(){},addEventListener(){}});}});
    await until(()=>d.window.__wordamix&&d.window.__mp);return d.window;};
  const $=(w,id)=>w.document.getElementById(id),on=(w,id)=>$(w,id).classList.contains('on'),click=(w,id)=>$(w,id).click();
  const A=await open(),B0=await open();
  assert(on(A,'home'));assert(!A.document.getElementById('mpb').hidden);
  $(A,'mpb').click();assert(on(A,'mp'));
  $(A,'mp-name').value='Albert';click(A,'mp-create');await until(()=>on(A,'lobby'));
  const code=$(A,'lb-code').textContent;assert(/^[A-Z0-9]{5}$/.test(code),code);assert.strictEqual($(A,'lb-start').hidden,false);
  B0.close();
  const B=await open('?join='+code.toLowerCase());assert(on(B,'mp'));assert.strictEqual($(B,'mp-code').value,code);
  $(B,'mp-name').value='<b>Bob</b>';click(B,'mp-join');await until(()=>on(B,'lobby'));
  await until(()=>$(A,'lb-players').children.length===2);
  assert(!B.document.querySelector('#lb-players b'),'name injected markup');assert.strictEqual($(B,'lb-start').hidden,true);assert(/Albert/.test($(B,'lb-players').textContent)&&/👑/.test($(B,'lb-players').children[0].textContent));
  // error handling in UI
  const C=await open();$(C,'mp-name').value='Zed';$(C,'mp-code').value='QQQQQ';click(C,'mp-join');await until(()=>/Room not found/.test($(C,'mp-msg').textContent));
  click(A,'lb-start');await until(()=>on(A,'game')&&on(B,'game'));
  await until(()=>A.__wordamix.state==='PLAYING'&&B.__wordamix.state==='PLAYING');
  const tl=w=>[...w.document.querySelectorAll('#grid .tile')].map(t=>t.textContent).join('');
  assert.strictEqual(tl(A),tl(B));assert.strictEqual(tl(A).length,25);assert.strictEqual($(A,'pause').style.visibility,'hidden');assert.strictEqual($(A,'shuf').style.display,'none');
  const late=await open('?join='+code);$(late,'mp-name').value='Late';click(late,'mp-join');await until(()=>/in progress/.test($(late,'mp-msg').textContent));
  await until(()=>on(A,'game')&&A.document.getElementById('mpres').classList.contains('on')&&B.document.getElementById('mpres').classList.contains('on'));
  assert.strictEqual($(A,'mpr-list').children.length,2);assert.strictEqual($(A,'mpr-again').hidden,false);assert.strictEqual($(B,'mpr-again').hidden,true);
  assert.strictEqual(tl(A),tl(B));const before=tl(A);
  click(A,'mpr-again');await until(()=>!on(A,'mpres')&&!B.document.getElementById('mpres').classList.contains('on'));
  await until(()=>tl(A)!==before&&tl(A)===tl(B));
  await until(()=>A.document.getElementById('mpres').classList.contains('on'));
  click(B,'mpr-exit');await until(()=>on(B,'home')||on(B,'mp'));assert(A.document.getElementById('mpres'));
  await until(()=>$(A,'mpr-list').textContent.length>0);
  // single-player still starts and is unaffected by multiplayer code
  const SP=await open();click(SP,'play');await until(()=>on(SP,'game'));await until(()=>SP.__wordamix.state==='PLAYING',6000);
  assert.notStrictEqual($(SP,'pause').style.visibility,'hidden');assert.notStrictEqual($(SP,'shuf').style.display,'none');
  [A,B,C,late,SP].forEach(w=>w.close());await S.close();console.log('multiplayer UI flow passed (2-3 simulated browsers)');process.exit(0);
})().catch(e=>{console.error('UI FAIL',e.message||e);process.exit(1);});
