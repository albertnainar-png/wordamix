'use strict';
const assert=require('assert'),WebSocket=require('ws');
const {start}=require('../server/server.js'),{RoomManager}=require('../server/rooms.js'),G=require('../server/game.js');
const dict=G.loadDictionary(),sleep=ms=>new Promise(r=>setTimeout(r,ms));let n=0;
const t=async(name,fn)=>{await fn();n++;console.log('ok -',name);};
function client(port){const ws=new WebSocket('ws://127.0.0.1:'+port+'/ws'),q=[],w=[],c={ws,q};
  ws.on('message',d=>{const m=JSON.parse(d),i=w.findIndex(x=>x.t===m.t);if(i>=0){const x=w.splice(i,1)[0];clearTimeout(x.to);x.res(m);}else q.push(m);});
  c.open=new Promise(r=>ws.on('open',r));c.closed=new Promise(r=>ws.on('close',(code)=>r(code)));
  c.send=o=>ws.send(typeof o==='string'?o:JSON.stringify(o));
  c.take=(type,ms=5000)=>{const i=q.findIndex(m=>m.t===type);if(i>=0)return Promise.resolve(q.splice(i,1)[0]);
    return new Promise((res,rej)=>{const x={t:type,res};x.to=setTimeout(()=>rej(new Error('timeout waiting for '+type)),ms);w.push(x);});};
  c.until=async(type,pred)=>{for(;;){const m=await c.take(type);if(!pred||pred(m))return m;}};
  c.close=()=>ws.close();c.none=type=>!q.some(m=>m.t===type);return c;}
(async()=>{
 const S=await start({port:0,host:'127.0.0.1',duration:1500,countdown:250,grace:150,scoreEvery:100,maxPlayers:40,dict});
 const mk=async()=>{const c=client(S.port);await c.open;return c;};
 const mkRoom=async(name='Host')=>{const h=await mk();h.send({t:'create',name});const j=await h.take('joined');return{h,j,code:j.code};};
 const joinRoom=async(code,name)=>{const c=await mk();c.send({t:'join',code,name});return{c,j:await c.take('joined')};};
 let R;
 await t('1 room creation + 5 host assignment',async()=>{R=await mkRoom('Albert');assert(/^[ABCDEFGHJKLMNPQRTUVWXY346789]{5}$/.test(R.code));assert.strictEqual(R.j.host,R.j.pid);assert.strictEqual(R.j.status,'LOBBY');});
 await t('2 room joining',async()=>{const {c,j}=await joinRoom(R.code.toLowerCase(),'Sarah');assert.notStrictEqual(j.host,j.pid);assert.strictEqual(j.players.length,2);
   const u=await R.h.until('players',m=>m.players.length===2);assert.strictEqual(u.host,R.j.pid);c.close();});
 await t('3 invalid room / bad codes',async()=>{const c=await mk();for(const code of['ZZZZZ','abc','',null,12345,'A'.repeat(500)]){c.send({t:'join',code,name:'X'});const e=await c.take('error');assert.strictEqual(e.code,'room_not_found');}c.close();});
 await t('4 unique room codes (2000 rooms)',async()=>{const rm=new RoomManager({dict,maxRooms:5000}),codes=new Set();
   for(let i=0;i<2000;i++){let code;const conn={send:m=>{if(m.t==='joined')code=m.code;},close(){}};rm.handle(conn,{t:'create',name:'P'+i});codes.add(code);}
   assert.strictEqual(codes.size,2000);rm.dispose();
   const r2=new RoomManager({dict,maxPlayers:2});let hc,cd;const h={send:m=>{if(m.t==='joined')cd=m.code;},close(){}};r2.handle(h,{t:'create',name:'H'});
   r2.handle({send(){},close(){}},{t:'join',code:cd,name:'B'});let er;r2.handle({send:m=>{er=m;},close(){}},{t:'join',code:cd,name:'C'});assert.strictEqual(er.code,'full');r2.dispose();});
 let B,C;
 await t('6 host transfer + 7 disconnect + 8 reconnect',async()=>{
   B=await joinRoom(R.code,'Bea');C=await joinRoom(R.code,'Cal');
   R.h.close();const u=await B.c.until('players',m=>m.players.some(p=>p[1]==='Albert'&&p[2]===0));
   assert.strictEqual(u.host,B.j.pid);
   C.c.close();await B.c.until('players',m=>m.players.some(p=>p[1]==='Cal'&&p[2]===0));
   const c2=await mk();c2.send({t:'join',code:R.code,pid:C.j.pid,token:C.j.token});const j=await c2.take('joined');assert.strictEqual(j.pid,C.j.pid);
   await B.c.until('players',m=>m.players.some(p=>p[1]==='Cal'&&p[2]===1));
   const c3=await mk();c3.send({t:'join',code:R.code,pid:C.j.pid,token:'bad',name:'Mallory'});const j3=await c3.take('joined');assert.notStrictEqual(j3.pid,C.j.pid);
   c2.close();c3.close();B.c.close();});
 // ---- 10-player game ----
 const P=[];const host=await mkRoom('P0');P.push({c:host.h,j:host.j});
 for(let i=1;i<10;i++)P.push(await joinRoom(host.code,'P'+i));
 let games;
 await t('9 game start (+ unauthorized start, + join in progress rejected)',async()=>{
   P[1].c.send({t:'start'});assert.strictEqual((await P[1].c.take('error')).code,'not_host');
   P[0].c.send({t:'start'});games=await Promise.all(P.map(p=>p.c.take('game')));
   const late=await mk();late.send({t:'join',code:host.code,name:'Late'});assert.strictEqual((await late.take('error')).code,'in_progress');late.close();
   P[0].c.send({t:'start'});assert.strictEqual((await P[0].c.until('error')).code,'bad_state');});
 await t('10 same board + start time for all 10 players',()=>{
   for(const g of games){assert.deepStrictEqual(g.letters,games[0].letters);assert.deepStrictEqual(g.bonus,games[0].bonus);assert.strictEqual(g.startAt,games[0].startAt);assert.strictEqual(g.endAt,games[0].endAt);assert.strictEqual(g.duration,1500);}
   assert.strictEqual(games[0].letters.length,25);});
 const g=games[0],sol=[...G.W.solve(g.letters,dict)].filter(([w])=>w.length>=3).sort((a,b)=>b[0].length-a[0].length);
 await t('12 score updates (valid, duplicate, invalid, stale gid) + reconnect mid-round',async()=>{
   await sleep(Math.max(0,g.startAt-Date.now())+30);
   const [w1,p1]=sol[0],[w2,p2]=sol[1];const a=P[1].c;
   a.send({t:'word',gid:g.gid,path:p1});const r1=await a.take('result');assert.strictEqual(r1.kind,'valid');assert(r1.points>0);assert.strictEqual(r1.word,w1);
   a.send({t:'word',gid:g.gid,path:p1});assert.strictEqual((await a.take('result')).kind,'duplicate');
   a.send({t:'word',gid:g.gid,path:[0,0,0]});const ri=await a.take('result');assert.strictEqual(ri.kind,'invalid');assert.strictEqual(ri.total,r1.total);
   a.send({t:'word',gid:g.gid,path:p2});const r2=await a.take('result');assert.strictEqual(r2.kind,'valid');assert(r2.total>r1.total);
   P[2].c.send({t:'word',gid:g.gid+99,path:p1});assert.strictEqual((await P[2].c.take('error')).code,'bad_state');
   P[3].c.send({t:'word',gid:g.gid,path:p1});const r3=await P[3].c.take('result');assert.strictEqual(r3.kind,'valid');
   const sc=await P[5].c.until('scores',m=>m.top.length>=2&&m.top[0][1]==='P1');assert.strictEqual(sc.top[0][2],r2.total);
   P[3].c.close();await sleep(60);const c2=await mk();c2.send({t:'join',code:host.code,pid:P[3].j.pid,token:P[3].j.token});
   await c2.take('joined');const rg=await c2.take('game');assert.strictEqual(rg.you.score,r3.total);assert.deepStrictEqual(rg.you.found,[w1]);P[3].c=c2;});
 let ends;
 await t('11 timer + 13 final leaderboard',async()=>{
   ends=await Promise.all(P.filter((_,i)=>i!==3).map(p=>p.c.take('end',6000)));const at=Date.now();assert(at>=g.endAt,'ended before the server timer');
   const e=ends[0];assert.strictEqual(e.top[0][1],'P1');assert.strictEqual(e.top.length,10);assert.strictEqual(e.n,10);
   for(let i=1;i<e.top.length;i++)assert(e.top[i-1][2]>=e.top[i][2]);
   assert.strictEqual(ends[1].you.rank,1);assert.strictEqual(e.top[1][1],'P3');
   const late=P[1].c;late.send({t:'word',gid:g.gid,path:sol[2][1]});assert.strictEqual((await late.take('error')).code,'bad_state');});
 await t('14 rematch (new board, scores reset, leavers do not block)',async()=>{
   P[9].c.close();await sleep(80);P[1].c.send({t:'start'});assert.strictEqual((await P[1].c.until('error')).code,'not_host');
   P[0].c.send({t:'start'});const g2=await P[0].c.until('game');assert.strictEqual(g2.gid,2);assert.notDeepStrictEqual(g2.letters,g.letters);assert.strictEqual(g2.you.score,0);
   const g2b=await P[1].c.until('game');assert.strictEqual(g2b.gid,2);assert.deepStrictEqual(g2b.letters,g2.letters);
   const pl=await P[2].c.until('players',m=>m.players.length===9);assert(!pl.players.some(p=>p[1]==='P9'));
   await P[0].c.take('end',6000);});
 await t('15 room closure',async()=>{
   P[1].c.send({t:'close'});assert.strictEqual((await P[1].c.until('error')).code,'not_host');
   P[0].c.send({t:'close'});await P[4].c.take('closed');const c=await mk();c.send({t:'join',code:host.code,name:'Z'});assert.strictEqual((await c.take('error')).code,'closed');c.close();});
 await t('16 malformed messages',async()=>{
   const c=await mk();for(const bad of['not json','{"t":5}','[]','null','"x"','{}']){c.send(bad);assert.strictEqual((await c.take('error')).code,'bad_msg');}
   const r=await mkRoom('Mal');r.h.send({t:'hack'});assert.strictEqual((await r.h.take('error')).code,'bad_msg');
   r.h.send({t:'start'});await r.h.take('game');await sleep(300);r.h.send({t:'word',gid:1,path:['a','b','c']});assert.strictEqual((await r.h.until('error')).code,'bad_msg');
   r.h.send({t:'word',gid:1,path:[1,2,99]});const ri=await r.h.take('result');assert.strictEqual(ri.kind,'invalid');
   const o=await mk();o.send('x'.repeat(5000));assert.strictEqual(await o.closed,1009);c.close();r.h.close();});
 await t('17 unauthorized room actions',async()=>{
   const c=await mk();for(const m of[{t:'start'},{t:'word',gid:1,path:[1,2,3]},{t:'close'},{t:'leave'}]){c.send(m);assert.strictEqual((await c.take('error')).code,'not_in_room');}
   const r=await mkRoom('H');r.h.send({t:'word',gid:0,path:[1,2,3]});assert.strictEqual((await r.h.take('error')).code,'bad_state');
   const b=await joinRoom(r.code,'B');b.c.send({t:'close'});assert.strictEqual((await b.c.take('error')).code,'not_host');
   const x=await mk();x.send({t:'create',name:'Imp'});await x.take('joined');x.send({t:'join',code:r.code,name:'dup'});assert.strictEqual((await x.take('error')).code,'bad_state');
   c.close();r.h.close();b.c.close();x.close();});
 await t('18 display-name sanitization',async()=>{
   const c=await mk();c.send({t:'create',name:'<img src=x onerror=alert(1)>Al "&\''});const j=await c.take('joined');const nm=j.players[0][1];
   assert(!/[<>&"'()=]/.test(nm),nm);assert(nm.length<=16);
   for(const bad of['   ','<>',123,null,{},'\u0000\u0007']){const d=await mk();d.send({t:'create',name:bad});assert.strictEqual((await d.take('error')).code,'bad_name');d.close();}
   c.close();});
 await S.close();console.log(n,'multiplayer test groups passed');process.exit(0);
})().catch(e=>{console.error('FAIL',e);process.exit(1);});
