'use strict';
const assert=require('assert');const {JSDOM}=require('jsdom');
const {start}=require('../server/server.js'),G=require('../server/game.js');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const until=async(f,ms=9000)=>{const t=Date.now();while(Date.now()-t<ms){try{const v=f();if(v)return v;}catch(e){}await sleep(40);}throw new Error('condition timeout: '+f);};
(async()=>{
  const dict=G.loadDictionary(),S=await start({port:0,host:'127.0.0.1',duration:4000,countdown:300,grace:100,scoreEvery:100,dict});
  const open=async()=>{const d=await JSDOM.fromURL('http://127.0.0.1:'+S.port+'/',{runScripts:'dangerously',resources:'usable',pretendToBeVisual:true,
    beforeParse(w){w.matchMedia=()=>({matches:false,addListener(){},addEventListener(){}});}});
    await until(()=>d.window.__wordamix&&d.window.__mp);
    const g=d.window.document.getElementById('grid');g.getBoundingClientRect=()=>({left:20,top:100,width:400,height:400,right:420,bottom:500});
    g.setPointerCapture=()=>{};g.releasePointerCapture=()=>{};return d.window;};
  const $=(w,id)=>w.document.getElementById(id);
  const pitch=(400+8)/5,tile=(400-32)/5,cx=i=>20+(i%5)*pitch+tile/2,cy=i=>100+((i/5)|0)*pitch+tile/2;
  const ev=(w,type,x,y)=>{const e=new w.Event(type,{bubbles:true,cancelable:true});Object.assign(e,{pointerId:1,pointerType:'touch',isPrimary:true,button:0,clientX:x,clientY:y});$(w,'grid').dispatchEvent(e);};
  const drag=(w,path,jump=false)=>{ev(w,'pointerdown',cx(path[0]),cy(path[0]));
    for(let k=1;k<path.length;k++){if(jump&&k<path.length-1&&k%2)continue;ev(w,'pointermove',cx(path[k])+3,cy(path[k])-2);}
    const l=path[path.length-1];ev(w,'pointerup',cx(l),cy(l));};
  const picks=(w,k)=>{const L=w.__wordamix.letters;return [...w.WMX.solve(L,w.__wordamix.dict)].filter(([x])=>x.length>=3&&x.length<=6).sort((a,b)=>a[0].length-b[0].length).slice(0,k);};
  for(const id of ['easy','normal','hard','expert']){
    const w=await open();w.document.querySelector('#dseg [data-d='+id+']').click();$(w,'play').click();
    await until(()=>w.__wordamix.state==='PLAYING',6000);
    const [[w1,p1],[w2,p2],[w3,p3]]=picks(w,3);let b=+$(w,'score').textContent;
    drag(w,p1);assert(+$(w,'score').textContent>b,id+' drag no score '+w1+' fb='+$(w,'fb').textContent);
    b=+$(w,'score').textContent;drag(w,p2,true);assert(+$(w,'score').textContent>b,id+' fast swipe no score '+w2);
    drag(w,p2);assert(/Already found/.test($(w,'fb').textContent),'dup');
    ev(w,'pointerdown',cx(p3[0]),cy(p3[0]));ev(w,'pointermove',cx(p3[1]),cy(p3[1]));ev(w,'pointermove',cx(p3[2]),cy(p3[2]));ev(w,'pointermove',cx(p3[1]),cy(p3[1]));
    assert.strictEqual(w.__wordamix.sel.length,3);ev(w,'pointercancel',0,0);assert.strictEqual(w.__wordamix.sel.length,0);
    console.log('ok - drag works on',id,w1,w2);w.close();}
  const A=await open(),B=await open();A.document.getElementById('mpb').click();$(A,'mp-name').value='A';$(A,'mp-create').click();await until(()=>$(A,'lobby').classList.contains('on'));
  const code=$(A,'lb-code').textContent;B.document.getElementById('mpb').click();$(B,'mp-name').value='B';$(B,'mp-code').value=code;$(B,'mp-join').click();await until(()=>$(B,'lobby').classList.contains('on'));
  $(A,'lb-start').click();await until(()=>A.__wordamix.state==='PLAYING'&&B.__wordamix.state==='PLAYING');
  const [[mw,mp]]=picks(A,1);drag(A,mp);await until(()=>+$(A,'score').textContent>0,3000);
  console.log('ok - multiplayer drag scored',mw,$(A,'score').textContent);
  [A,B].forEach(x=>x.close());await S.close();process.exit(0);
})().catch(e=>{console.error('DRAG FAIL',e.message||e);process.exit(1);});
