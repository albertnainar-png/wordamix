'use strict';
// In-memory rooms. Transport-agnostic: a "conn" is {send(obj), close()}; see server.js. Swap the Map for a store later.
const crypto=require('crypto'),G=require('./game.js');
const ALPHA='ABCDEFGHJKLMNPQRTUVWXY346789'; // no 0/O 1/I 5/S 2/Z ambiguity
const ERR={room_not_found:'Room not found.',in_progress:'Game already in progress.',closed:'Room is closed.',full:'Room is full.',
  bad_name:'Please enter a name (1-16 letters or numbers).',bad_msg:'Bad message.',not_host:'Only the host can do that.',
  bad_state:'Not allowed right now.',bad_difficulty:'Invalid difficulty.',not_in_room:'Join a room first.'};
const rid=n=>crypto.randomBytes(n).toString('hex');
function cleanName(s){if(typeof s!=='string')return null;
  s=s.normalize('NFKC').replace(/[^\p{L}\p{N} _.\-]/gu,'').replace(/\s+/g,' ').trim().slice(0,16);return s.length?s:null;}
class RoomManager{
  constructor(o={}){
    this.o=Object.assign({maxPlayers:200,maxRooms:1000,duration:60000,countdown:3000,grace:800,scoreEvery:700,idleMs:300000},o);
    this.dict=o.dict||G.loadDictionary();this.rooms=new Map();this.lastSweep=Date.now();
    this.iv=setInterval(()=>this.tick(),this.o.scoreEvery);this.iv.unref&&this.iv.unref();}
  err(conn,code){conn.send({t:'error',code,msg:ERR[code]||'Error.'});}
  ctx(conn){const room=this.rooms.get(conn.code),p=room&&room.players.get(conn.pid);
    if(p&&p.conn===conn){room.last=Date.now();return{room,p};}return null;}
  handle(conn,m){
    if(!m||typeof m!=='object'||Array.isArray(m)||typeof m.t!=='string')return this.err(conn,'bad_msg');
    if(m.t==='create')return this.create(conn,m);
    if(m.t==='join')return this.join(conn,m);
    if(m.t==='ping')return conn.send({t:'pong',now:Date.now()});
    const c=this.ctx(conn);if(!c)return this.err(conn,'not_in_room');
    switch(m.t){case'start':return this.start(c.room,c.p);case'word':return this.word(c.room,c.p,m);
      case'setdiff':return this.setDifficulty(c.room,c.p,m);case'leave':return this.leave(c.room,c.p);case'close':return this.closeRoom(c.room,c.p);}
    return this.err(conn,'bad_msg');}
  add(room,conn,name){const p={id:rid(8),token:rid(16),name,conn,connected:true,joinedAt:Date.now(),sm:new G.W.ScoreManager(G.W.DIFFICULTY[room.difficulty].mult),found:new Set()};
    room.players.set(p.id,p);conn.pid=p.id;conn.code=room.code;return p;}
  list(room){return[...room.players.values()].map(p=>[p.id,p.name,p.connected?1:0]);}
  broadcast(room,o,except){for(const p of room.players.values())if(p.connected&&p.id!==except)p.conn.send(o);}
  broadcastPlayers(room,except){this.broadcast(room,{t:'players',host:room.hostId,players:this.list(room)},except);}
  gameMsg(room,p){return{t:'game',gid:room.gid,letters:room.game.letters,bonus:room.game.bonus,startAt:room.startAt,endAt:room.endAt,
    duration:this.o.duration,difficulty:room.difficulty,mult:G.W.DIFFICULTY[room.difficulty].mult,now:Date.now(),you:{score:p.sm.score,combo:p.sm.combo,found:[...p.found]}};}
  joined(room,p){p.conn.send({t:'joined',code:room.code,pid:p.id,token:p.token,host:room.hostId,status:room.status,difficulty:room.difficulty,players:this.list(room),now:Date.now()});
    if(room.game&&(room.status==='COUNTDOWN'||room.status==='PLAYING'))p.conn.send(this.gameMsg(room,p));}
  create(conn,m){
    if(this.ctx(conn))return this.err(conn,'bad_state');
    const name=cleanName(m.name);if(!name)return this.err(conn,'bad_name');
    if(this.rooms.size>=this.o.maxRooms)return this.err(conn,'full');
    let code;do{code=Array.from(crypto.randomBytes(5),b=>ALPHA[b%ALPHA.length]).join('');}while(this.rooms.has(code));
    const diff=m.difficulty===undefined?'easy':m.difficulty;
    if(!G.W.isDifficulty(diff))return this.err(conn,'bad_difficulty');
    const room={code,difficulty:diff,hostId:null,players:new Map(),status:'LOBBY',createdAt:Date.now(),gid:0,game:null,startAt:0,endAt:0,timers:[],dirty:false,last:Date.now()};
    this.rooms.set(code,room);const p=this.add(room,conn,name);room.hostId=p.id;this.joined(room,p);}
  join(conn,m){
    if(this.ctx(conn))return this.err(conn,'bad_state');
    const code=typeof m.code==='string'?m.code.toUpperCase():'';
    const room=/^[A-Z0-9]{5}$/.test(code)&&this.rooms.get(code);
    if(!room)return this.err(conn,'room_not_found');
    if(room.status==='CLOSED')return this.err(conn,'closed');
    const ex=typeof m.pid==='string'?room.players.get(m.pid):null;
    if(ex&&typeof m.token==='string'&&m.token===ex.token){ // reconnect
      const old=ex.conn;ex.conn=conn;conn.pid=ex.id;conn.code=code;ex.connected=true;
      if(old&&old!==conn){old.pid=null;old.code=null;try{old.close()}catch(e){}}
      const h=room.players.get(room.hostId);if(!h||!h.connected)this.transferHost(room);
      this.joined(room,ex);return this.broadcastPlayers(room,ex.id);}
    if(room.status==='COUNTDOWN'||room.status==='PLAYING')return this.err(conn,'in_progress');
    if(room.players.size>=this.o.maxPlayers)return this.err(conn,'full');
    const name=cleanName(m.name);if(!name)return this.err(conn,'bad_name');
    const p=this.add(room,conn,name);this.joined(room,p);this.broadcastPlayers(room,p.id);}
  transferHost(room){for(const q of room.players.values())if(q.connected){room.hostId=q.id;return true;}return false;}
  start(room,p){
    if(room.hostId!==p.id)return this.err(p.conn,'not_host');
    if(room.status!=='LOBBY'&&room.status!=='COMPLETE')return this.err(p.conn,'bad_state');
    for(const [id,q] of room.players)if(!q.connected)room.players.delete(id); // players who left never block a rematch
    const dm=G.W.DIFFICULTY[room.difficulty].mult; // authoritative: only room.difficulty is ever used, never anything a client sent
    for(const q of room.players.values()){q.sm=new G.W.ScoreManager(dm);q.found=new Set();}
    this.clearTimers(room);room.gid++;room.game=G.newGame(this.dict,crypto.randomInt(1,2**31-1),room.difficulty);
    const now=Date.now();room.startAt=now+this.o.countdown;room.endAt=room.startAt+this.o.duration;room.status='COUNTDOWN';room.dirty=false;
    room.timers.push(setTimeout(()=>{if(room.status==='COUNTDOWN')room.status='PLAYING';},this.o.countdown));
    room.timers.push(setTimeout(()=>this.finish(room),this.o.countdown+this.o.duration+this.o.grace));
    this.broadcastPlayers(room);for(const q of room.players.values())if(q.connected)q.conn.send(this.gameMsg(room,q));}
  word(room,p,m){
    if(room.status!=='PLAYING'&&room.status!=='COUNTDOWN')return this.err(p.conn,'bad_state');
    const now=Date.now();if(m.gid!==room.gid||now<room.startAt||now>room.endAt+this.o.grace)return this.err(p.conn,'bad_state');
    const r=G.judge(this.dict,room.game,p.sm,p.found,m.path);if(!r)return this.err(p.conn,'bad_msg');
    p.conn.send(Object.assign({t:'result',gid:room.gid},r));if(r.kind==='valid')room.dirty=true;}
  setDifficulty(room,p,m){
    if(room.hostId!==p.id)return this.err(p.conn,'not_host');
    if(room.status!=='LOBBY'&&room.status!=='COMPLETE')return this.err(p.conn,'bad_state');
    if(!G.W.isDifficulty(m.difficulty))return this.err(p.conn,'bad_difficulty');
    room.difficulty=m.difficulty; // takes effect on the next start/rematch; nothing is regenerated now
    this.broadcast(room,{t:'settings',difficulty:room.difficulty});}
  ranking(room){return[...room.players.values()].sort((a,b)=>b.sm.score-a.sm.score||b.found.size-a.found.size||a.joinedAt-b.joinedAt);}
  finish(room){
    if(room.status!=='PLAYING'&&room.status!=='COUNTDOWN')return;room.status='COMPLETE';
    const rank=this.ranking(room),top=rank.slice(0,50).map(p=>[p.id,p.name,p.sm.score,p.found.size,p.sm.bestCombo]);
    rank.forEach((p,i)=>{if(p.connected)p.conn.send({t:'end',gid:room.gid,difficulty:room.difficulty,top,n:rank.length,you:{rank:i+1,score:p.sm.score,words:p.found.size,bestCombo:p.sm.bestCombo}});});}
  tick(){ // throttled live scoreboard: only rooms with changes, top 10 only
    for(const room of this.rooms.values())if(room.status==='PLAYING'&&room.dirty){room.dirty=false;
      this.broadcast(room,{t:'scores',now:Date.now(),n:room.players.size,top:this.ranking(room).slice(0,10).map(p=>[p.id,p.name,p.sm.score])});}
    if(Date.now()-this.lastSweep>10000)this.sweep();}
  sweep(){const now=Date.now();this.lastSweep=now;
    for(const [c,r] of this.rooms){
      if(r.status==='CLOSED'&&now-r.closedAt>60000)this.rooms.delete(c);
      else if(r.status!=='CLOSED'&&now-r.last>this.o.idleMs&&![...r.players.values()].some(p=>p.connected)){this.shutdown(r);}}}
  leave(room,p){p.conn.pid=null;p.conn.code=null;p.connected=false;
    if(room.status==='LOBBY'||room.status==='COMPLETE')room.players.delete(p.id);
    if(room.hostId===p.id)this.transferHost(room);
    if(![...room.players.values()].some(q=>q.connected))return this.shutdown(room);
    this.broadcastPlayers(room);}
  disconnect(conn){const c=this.ctx(conn);if(!c)return;const{room,p}=c;p.connected=false;
    if(room.hostId===p.id)this.transferHost(room);this.broadcastPlayers(room);}
  closeRoom(room,p){if(room.hostId!==p.id)return this.err(p.conn,'not_host');this.shutdown(room);}
  shutdown(room){this.clearTimers(room);room.status='CLOSED';room.closedAt=Date.now();this.broadcast(room,{t:'closed'});room.players.clear();}
  clearTimers(room){room.timers.forEach(clearTimeout);room.timers=[];}
  dispose(){clearInterval(this.iv);for(const r of this.rooms.values())this.clearTimers(r);}
}
module.exports={RoomManager,cleanName,ALPHA};
