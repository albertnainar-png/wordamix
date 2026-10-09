'use strict';
// Server-side game logic: dictionary, deterministic board from a seed, and authoritative word judging.
// Reuses the single-player engine (js/engine.js) unchanged.
const fs=require('fs'),path=require('path');
const W=require('../js/engine.js');
function loadDictionary(root=path.join(__dirname,'..')){
  const rd=f=>fs.readFileSync(path.join(root,'data',f),'utf8').split('\n').filter(Boolean);
  const d=new W.DictionaryManager(),c=rd('dictionary.txt');
  d._merge(c);d.commonSet=new Set(c);d.common=c.filter(w=>w.length>=4&&w.length<=7&&!w.includes('Q'));d.full=true;
  d._merge(rd('dictionary-large.txt'));return d;}
function newGame(dict,seed,difficulty='easy'){
  const id=W.isDifficulty(difficulty)?difficulty:'easy';
  const b=W.generate(dict,W.seedRng('WMX'+seed),null,null,id); // bounded by the difficulty's own attempt/time limits
  return{seed,difficulty:id,letters:b.letters,bonus:W.makeBonus(W.seedRng('B'+seed)),metrics:b.metrics,reached:b.ok};}
/** Judge one submitted path for one player. The client never supplies a score; the server computes it. */
function judge(dict,game,sm,found,p){
  if(!Array.isArray(p)||p.length<3||p.length>25||!p.every(Number.isInteger))return null;
  const v=W.validatePath(game.letters,p,dict);
  const kind=v.ok?(found.has(v.word)?'duplicate':'valid'):'invalid';
  const mult=Math.max(1,...p.map(i=>game.bonus[i]||1));
  const r=sm.submit(kind,v.word||'',p,kind==='valid'&&dict.isRare(v.word),mult);
  if(kind==='valid')found.add(v.word);
  return{kind,word:kind==='invalid'?'':v.word,points:r.points,total:sm.score,combo:sm.combo,tags:r.tags||[]};}
module.exports={loadDictionary,newGame,judge,W};
