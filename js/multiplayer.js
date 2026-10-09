/* Wordamix multiplayer client layer. Single-player never depends on this file. */
(function(){
'use strict';
const G=window.__wordamix;if(!G||!G.startMp)return;
const $=id=>document.getElementById(id),CFG=window.WORDAMIX_MP||{};
const wsUrl=()=>CFG.server||((location.protocol==='https:'?'wss://':'ws://')+location.host+'/ws');
const webBase=()=>CFG.web||(location.origin+location.pathname.replace(/index\.html$/,''));
const KEY='wmx-mp';
let diff='easy',mpDiff=G.getDiff(),ws=null,me=null,code=null,hostId=null,players=[],game=null,off=0,leaving=false,retry=0,myScore=0,gid=0,lastTop=[];
const set=(id,t)=>{$(id).textContent=t;};
const msg=t=>set('mp-msg',t||'');
const send=o=>{if(ws&&ws.readyState===1)ws.send(JSON.stringify(o));};
const srvNow=()=>Date.now()+off;
const save=p=>{try{p?sessionStorage.setItem(KEY,JSON.stringify(p)):sessionStorage.removeItem(KEY);}catch(e){}};
const saved=()=>{try{return JSON.parse(sessionStorage.getItem(KEY)||'null');}catch(e){return null;}};
function connect(){return new Promise((res,rej)=>{
  if(!navigator.onLine)return rej(new Error('Multiplayer requires an internet connection.'));
  let w,opened=false;try{w=new WebSocket(wsUrl());}catch(e){return rej(new Error('Cannot reach the multiplayer server.'));}
  const to=setTimeout(()=>{if(!opened){try{w.close();}catch(e){}rej(new Error('Server not responding.'));}},8000);
  w.onopen=()=>{opened=true;clearTimeout(to);ws=w;res();};
  w.onmessage=e=>{let m;try{m=JSON.parse(e.data);}catch(_){return;}on(m);};
  w.onclose=()=>{clearTimeout(to);if(ws===w){ws=null;lost();}if(!opened)rej(new Error('Could not connect to the multiplayer server.'));};});}
function lost(){ // network dropped: keep the round going locally and try to resume
  if(leaving||!code)return;const s=saved();if(!s||retry>=15){leaveLocal('Connection lost.');return;}
  retry++;set('mp-banner','Reconnecting…');$('mp-banner').hidden=false;
  setTimeout(()=>connect().then(()=>send({t:'join',code:s.code,pid:s.pid,token:s.token})).catch(lost),1500);}
function on(m){
  if(typeof m.now==='number')off=m.now-Date.now();
  switch(m.t){
  case'settings':diff=m.difficulty;renderLobby();break;
  case'joined':diff=m.difficulty||'easy';retry=0;$('mp-banner').hidden=true;me=m.pid;code=m.code;hostId=m.host;players=m.players;
    save({code:m.code,pid:m.pid,token:m.token});renderLobby();
    if(!(G.mpActive&&G.state!=='READY'&&m.status!=='LOBBY'&&m.status!=='COMPLETE'))G.show('lobby');break;
  case'players':hostId=m.host;players=m.players;renderLobby();break;
  case'game':diff=m.difficulty||diff;startGame(m);break;
  case'result':myScore=m.total;G.mpResult(m);break;
  case'scores':lastTop=m.top;renderLive(m.top,m.n);break;
  case'end':showResults(m);break;
  case'closed':leaveLocal('The host closed the room.');break;
  case'error':
    if(code===null||$('mp').classList.contains('on'))msg(m.msg);
    else if(m.code==='not_host'||m.code==='bad_state')set('lb-wait',m.msg);break;}}
function renderLobby(){
  set('lb-code',code||'-----');const ul=$('lb-players');ul.textContent='';
  players.forEach(p=>{const li=document.createElement('li');
    li.textContent=(p[0]===hostId?'👑 ':p[2]?'🟢 ':'⚪ ')+p[1]+(p[0]===me?' (you)':'')+(p[2]?'':' (offline)');ul.appendChild(li);});
  const D=WMX.DIFFICULTY[diff]||WMX.DIFFICULTY.normal;set('lb-diff',' '+D.label+(D.mult>1?' (×'+D.mult+' score)':''));
  const host=hostId===me;$('lb-dseg').hidden=!host;paintSeg('lb-dseg',diff);$('lb-start').hidden=!host;$('lb-wait').hidden=host;set('lb-wait','Waiting for host…');
  $('lb-count').textContent=players.length+(players.length===1?' player':' players');}
function startGame(m){
  game=m;gid=m.gid;myScore=m.you?m.you.score:0;lastTop=[];$('mpres').classList.remove('on');$('mp-banner').hidden=true;
  G.setMp({submit:path=>send({t:'word',gid:gid,path:path})});
  G.startMp({letters:m.letters,bonus:m.bonus,duration:m.duration,difficulty:m.difficulty,mult:m.mult,you:m.you,startIn:()=>m.startAt-srvNow(),endIn:()=>m.endAt-srvNow()});
  $('live').hidden=false;renderLive([],players.length);}
function renderLive(top,n){
  const box=$('live');box.textContent='';const head=document.createElement('div');head.className='lh';
  head.textContent='LIVE · '+(n||players.length)+' players '+($('live').classList.contains('open')?'▲':'▼');box.appendChild(head);
  const open=box.classList.contains('open'),rows=top.slice(0,open?10:3);
  rows.forEach((r,i)=>{const d=document.createElement('div');if(r[0]===me)d.className='me';
    const a=document.createElement('span'),b=document.createElement('b');a.textContent=(i+1)+'. '+r[1];b.textContent=r[2];d.append(a,b);box.appendChild(d);});
  if(!top.some(r=>r[0]===me)){const d=document.createElement('div');d.className='me';const a=document.createElement('span'),b=document.createElement('b');a.textContent='You';b.textContent=myScore;d.append(a,b);box.appendChild(d);}}
function showResults(m){
  gid=0;if(m.difficulty)diff=m.difficulty;set('mpr-diff',(WMX.DIFFICULTY[diff]||{}).label||'');const ol=$('mpr-list');ol.textContent='';
  m.top.forEach((r,i)=>{const li=document.createElement('li');if(r[0]===me)li.className='me';
    const a=document.createElement('span'),b=document.createElement('b');a.textContent=(i<3?['🥇','🥈','🥉'][i]+' ':(i+1)+'. ')+r[1]+' · '+r[3]+' words';b.textContent=r[2];li.append(a,b);ol.appendChild(li);});
  set('mpr-you',m.you&&m.you.rank>m.top.length?'You: #'+m.you.rank+' · '+m.you.score+' pts · '+m.you.words+' words':'');
  const host=hostId===me;$('mpr-again').hidden=!host;$('mpr-wait').hidden=host;$('live').hidden=true;
  $('mpres').classList.add('on');if(host)$('mpr-again').focus();}
function leaveLocal(why){leaving=true;save(null);try{ws&&ws.close();}catch(e){}ws=null;code=null;me=null;players=[];
  G.endMp();$('mpres').classList.remove('on');$('live').hidden=true;$('mp-banner').hidden=true;G.show('mp');msg(why||'');leaving=false;}
function exit(){send({t:'leave'});leaveLocal('');G.show('home');}
async function enter(kind){
  const name=$('mp-name').value.trim(),c=$('mp-code').value.trim().toUpperCase();
  try{localStorage.setItem('wmx-name',name);}catch(e){}
  if(!name)return msg('Enter your name.');if(kind==='join'&&c.length!==5)return msg('Room code is 5 characters.');
  msg('Connecting…');leaving=false;
  try{await connect();}catch(e){return msg(e.message);}
  send(kind==='create'?{t:'create',name,difficulty:mpDiff}:{t:'join',code:c,name});}
async function share(){
  const url=webBase()+'?join='+code,text='Join my Wordamix room '+code;
  try{if(navigator.share){await navigator.share({title:'Wordamix',text,url});return;}await navigator.clipboard.writeText(url);set('lb-wait','Room link copied.');}catch(e){}}
function paintSeg(id,cur){document.querySelectorAll('#'+id+' button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.d===cur));}
document.querySelectorAll('#mp-dseg button').forEach(b=>b.onclick=()=>{mpDiff=b.dataset.d;paintSeg('mp-dseg',mpDiff);});paintSeg('mp-dseg',mpDiff);
document.querySelectorAll('#lb-dseg button').forEach(b=>b.onclick=()=>send({t:'setdiff',difficulty:b.dataset.d}));
$('mpb').onclick=()=>{mpDiff=G.getDiff();paintSeg('mp-dseg',mpDiff);msg(navigator.onLine?'':'Multiplayer requires an internet connection.');G.show('mp');};
$('mp-create').onclick=()=>enter('create');$('mp-join').onclick=()=>enter('join');
$('mp-code').oninput=e=>{e.target.value=e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,'');};
$('lb-copy').onclick=async()=>{try{await navigator.clipboard.writeText(code);set('lb-wait','Code copied.');}catch(e){}};
$('lb-share').onclick=share;$('lb-start').onclick=()=>send({t:'start'});$('lb-exit').onclick=exit;
$('mpr-words').onclick=()=>G.openWords();$('mpr-again').onclick=()=>send({t:'start'});$('mpr-exit').onclick=exit;
$('live').onclick=()=>{$('live').classList.toggle('open');renderLive(lastTop,players.length);};
try{$('mp-name').value=localStorage.getItem('wmx-name')||'';}catch(e){}
const j=new URLSearchParams(location.search).get('join');if(j){$('mp-code').value=j.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,5);G.show('mp');}
addEventListener('offline',()=>{if($('mp').classList.contains('on'))msg('Multiplayer requires an internet connection.');});
window.__mp={back(){
  const id=(document.querySelector('.screen.on')||{}).id;
  if($('mpres').classList.contains('on')){exit();return true;}
  if(id==='lobby'){exit();return true;}
  if(id==='mp'){G.show('home');return true;}
  if(G.mpActive&&id==='game')return true; // no pausing or leaving mid-round with back
  return false;}};
})();
