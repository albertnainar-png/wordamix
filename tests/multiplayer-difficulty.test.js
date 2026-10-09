'use strict';
const assert=require('assert'),WebSocket=require('ws');
const {start}=require('../server/server.js'),G=require('../server/game.js'),W=G.W;
const dict=G.loadDictionary(),sleep=ms=>new Promise(r=>setTimeout(r,ms));let n=0;
const t=async(name,fn)=>{await fn();n++;console.log('ok -',name);};
function client(port){const ws=new WebSocket('ws://127.0.0.1:'+port+'/ws'),q=[],w=[],c={ws};
  ws.on('message',d=>{const m=JSON.parse(d),i=w.findIndex(x=>x.t===m.t);if(i>=0){const x=w.splice(i,1)[0];clearTimeout(x.to);x.res(m);}else q.push(m);});
  c.open=new Promise(r=>ws.on('open',r));c.send=o=>ws.send(JSON.stringify(o));c.close=()=>ws.close();
  c.take=(type,ms=6000)=>{const i=q.findIndex(m=>m.t===type);if(i>=0)return Promise.resolve(q.splice(i,1)[0]);return new Promise((res,rej)=>{const x={t:type,res};x.to=setTimeout(()=>rej(new Error('timeout '+type)),ms);w.push(x);});};
  c.until=async(type,pred)=>{for(;;){const m=await c.take(type);if(!pred||pred(m))return m;}};return c;}
(async()=>{
 const S=await start({port:0,host:'127.0.0.1',duration:1500,countdown:250,grace:150,scoreEvery:100,dict});
 const mk=async()=>{const c=client(S.port);await c.open;return c;};
 const room=async(difficulty,name='Host')=>{const h=await mk();h.send(difficulty===undefined?{t:'create',name}:{t:'create',name,difficulty});return{h};};
 const join=async(code,name)=>{const c=await mk();c.send({t:'join',code,name});return{c,j:await c.take('joined')};};
 const state=code=>S.manager.rooms.get(code);
 let H,code,P=[];
 await t('host selects difficulty on create; default is easy; stored in room state',async()=>{
   H=await room('hard');const j=await H.h.take('joined');code=j.code;assert.strictEqual(j.difficulty,'hard');assert.strictEqual(state(code).difficulty,'hard');
   const d=await room();assert.strictEqual((await d.h.take('joined')).difficulty,'easy');d.h.close();});
 await t('invalid difficulty on create is rejected (no room made)',async()=>{
   const before=S.manager.rooms.size;for(const bad of['normal','expert','Easy','HARD','god','','__proto__',null,5,{},['easy']]){const x=await room(bad);assert.strictEqual((await x.h.take('error')).code,'bad_difficulty');x.h.close();}
   assert.strictEqual(S.manager.rooms.size,before);});
 await t('joiners see the difficulty; host change is broadcast to everyone; lobby does not regenerate',async()=>{
   for(let i=1;i<=3;i++)P.push(await join(code,'P'+i));P.forEach(p=>assert.strictEqual(p.j.difficulty,'hard'));
   H.h.send({t:'setdiff',difficulty:'easy'});for(const p of P)assert.strictEqual((await p.c.take('settings')).difficulty,'easy');
   assert.strictEqual((await H.h.take('settings')).difficulty,'easy');assert.strictEqual(state(code).difficulty,'easy');H.h.send({t:'setdiff',difficulty:'hard'});for(const p of P)await p.c.take('settings');await H.h.take('settings');assert.strictEqual(state(code).game,null);});
 await t('non-host cannot change difficulty; malicious values rejected; state unchanged',async()=>{
   P[0].c.send({t:'setdiff',difficulty:'easy'});assert.strictEqual((await P[0].c.take('error')).code,'not_host');
   for(const bad of['normal','expert','easy ','EASY','hacker',null,7,{},'__proto__','constructor']){H.h.send({t:'setdiff',difficulty:bad});assert.strictEqual((await H.h.take('error')).code,'bad_difficulty');}
   assert.strictEqual(state(code).difficulty,'hard');});
 let games,g;
 await t('start: all players get same board + same authoritative difficulty/multiplier; client-sent difficulty ignored',async()=>{
   P[1].c.send({t:'start',difficulty:'easy'});assert.strictEqual((await P[1].c.take('error')).code,'not_host');
   H.h.send({t:'start',difficulty:'easy',seed:1,letters:'AAAAAAAAAAAAAAAAAAAAAAAAA',mult:99});
   games=await Promise.all([H.h,...P.map(p=>p.c)].map(c=>c.take('game')));g=games[0];
   for(const x of games){assert.strictEqual(x.difficulty,'hard');assert.strictEqual(x.mult,1.25);assert.deepStrictEqual(x.letters,g.letters);assert.deepStrictEqual(x.bonus,g.bonus);}
   assert.notStrictEqual(g.letters.join(''),'A'.repeat(25));assert.strictEqual(state(code).game.difficulty,'hard');
   assert(state(code).game.metrics.six>=200,'server board should be a hard-style board: six='+state(code).game.metrics.six);});
 await t('setdiff during a round is refused and the board does not change',async()=>{
   H.h.send({t:'setdiff',difficulty:'easy'});assert.strictEqual((await H.h.until('error')).code,'bad_state');assert.strictEqual(state(code).difficulty,'hard');});
 let words;
 await t('server scores with the room difficulty even if a client claims another',async()=>{
   await sleep(Math.max(0,g.startAt-Date.now())+30);
   words=[...W.solve(g.letters,dict)].filter(([w])=>w.length>=3).sort((a,b)=>b[0].length-a[0].length);
   const [w,p]=words[0];P[0].c.send({t:'word',gid:g.gid,path:p,difficulty:'easy',mult:0.01,score:999999,points:999999});
   const r=await P[0].c.take('result');const mult=Math.max(1,...p.map(i=>g.bonus[i]||1));
   const exp=new W.ScoreManager(1.25).submit('valid',w,p,dict.isRare(w),mult).points;assert.strictEqual(r.kind,'valid');assert.strictEqual(r.points,exp);assert.strictEqual(r.total,exp);});
 let ends;
 await t('round end carries difficulty; rematch keeps it; host can change it before the rematch',async()=>{
   ends=await Promise.all([H.h,...P.map(p=>p.c)].map(c=>c.take('end',6000)));ends.forEach(e=>assert.strictEqual(e.difficulty,'hard'));
   H.h.send({t:'start'});let g2=await H.h.until('game');assert.strictEqual(g2.difficulty,'hard');assert.strictEqual(g2.gid,2);assert.notDeepStrictEqual(g2.letters,g.letters);assert.strictEqual(g2.you.score,0);
   const g2b=await P[2].c.until('game');assert.deepStrictEqual(g2b.letters,g2.letters);
   await H.h.take('end',6000);for(const p of P)await p.c.take('end',6000);
   H.h.send({t:'setdiff',difficulty:'easy'});for(const p of P)assert.strictEqual((await p.c.until('settings')).difficulty,'easy');
   H.h.send({t:'start'});const g3=await H.h.until('game');assert.strictEqual(g3.difficulty,'easy');assert.strictEqual(g3.mult,1);assert.strictEqual(g3.gid,3);
   const g3p=await P[1].c.until('game',m=>m.gid===3);assert.deepStrictEqual(g3p.letters,g3.letters);assert.strictEqual(g3p.difficulty,'easy');
   assert(state(code).game.metrics.s5>=.7,'easy board should be short-word heavy: '+state(code).game.metrics.s5);});
 await t('late joiner / reconnect receive the authoritative difficulty',async()=>{
   const l=await mk();l.send({t:'join',code,name:'Late'});assert.strictEqual((await l.take('error')).code,'in_progress');l.close();
   P[2].c.close();await sleep(60);const r=await mk();r.send({t:'join',code,pid:P[2].j.pid,token:P[2].j.token});assert.strictEqual((await r.take('joined')).difficulty,'easy');assert.strictEqual((await r.take('game')).difficulty,'easy');r.close();});
 await S.close();console.log(n,'multiplayer difficulty test groups passed');process.exit(0);
})().catch(e=>{console.error('FAIL',e);process.exit(1);});
