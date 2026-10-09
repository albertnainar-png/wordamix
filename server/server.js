'use strict';
// HTTP (static game files + /health + /join/CODE redirect) and WebSocket (/ws) transport.
const http=require('http'),fs=require('fs'),path=require('path');
const {WebSocketServer}=require('ws');const {RoomManager}=require('./rooms.js');
const ROOT=path.join(__dirname,'..');
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.txt':'text/plain; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json'};
const PUBLIC=/^\/(index\.html|manifest\.webmanifest|sw\.js|(js|data|icons)\/[\w.\-]+)$/; // never serves server/, node_modules/ or android/
function start(o={}){
  const manager=new RoomManager(o);
  const allowed=(o.allowedOrigins||process.env.ALLOWED_ORIGINS||'').split(',').filter(Boolean);
  const server=http.createServer((req,res)=>{
    let p;try{p=decodeURIComponent(new URL(req.url,'http://x').pathname);}catch(e){res.writeHead(400);return res.end();}
    if(p==='/health')return res.end('ok');
    const j=p.match(/^\/join\/([A-Za-z0-9]{1,8})$/);
    if(j){res.writeHead(302,{Location:'/?join='+j[1].toUpperCase()});return res.end();}
    if(p==='/')p='/index.html';
    if(!PUBLIC.test(p)){res.writeHead(404);return res.end('Not found');}
    fs.readFile(path.join(ROOT,p),(e,b)=>{if(e){res.writeHead(404);return res.end('Not found');}
      res.writeHead(200,{'Content-Type':MIME[path.extname(p)]||'application/octet-stream','X-Content-Type-Options':'nosniff','Cache-Control':'no-cache'});res.end(b);});});
  const wss=new WebSocketServer({server,path:'/ws',maxPayload:4096,verifyClient:i=>!allowed.length||allowed.includes(i.origin)});
  wss.on('connection',ws=>{
    const conn={send:o=>{if(ws.readyState===1)ws.send(JSON.stringify(o));},close:()=>ws.close(),pid:null,code:null};
    let tokens=30,last=Date.now(),viol=0; // token bucket: burst 30, 15 msgs/s
    ws.on('message',(d,isBin)=>{
      const now=Date.now();tokens=Math.min(30,tokens+(now-last)*0.015);last=now;
      if(isBin||tokens<1){if(++viol>100)ws.close(1008,'rate');return conn.send({t:'error',code:'rate_limited',msg:'Slow down.'});}
      tokens--;let m;try{m=JSON.parse(d.toString());}catch(e){return conn.send({t:'error',code:'bad_msg',msg:'Bad message.'});}
      manager.handle(conn,m);});
    ws.on('close',()=>manager.disconnect(conn));ws.on('error',()=>{});});
  const port=o.port===undefined?(+process.env.PORT||8080):o.port;
  return new Promise(r=>server.listen(port,o.host||'0.0.0.0',()=>r({server,manager,port:server.address().port,
    close:()=>new Promise(c=>{manager.dispose();wss.clients.forEach(w=>w.terminate());wss.close();server.close(()=>c());})})));}
if(require.main===module)start({maxPlayers:+process.env.MAX_PLAYERS||200}).then(s=>console.log('Wordamix server listening on :'+s.port));
module.exports={start};
