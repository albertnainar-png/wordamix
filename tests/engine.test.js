// Run: node tests/engine.test.js
const W=require('../js/engine.js'),fs=require('fs'),assert=require('assert');
const d=new W.DictionaryManager();d._merge(fs.readFileSync(__dirname+'/../data/dictionary.txt','utf8').split('\n').filter(Boolean));d.full=true;d.commonSet=new Set(d.arr);d.common=d.arr.filter(w=>w.length>=4&&w.length<=7&&!/Q/.test(w));d._merge(fs.readFileSync(__dirname+'/../data/dictionary-large.txt','utf8').split('\n').filter(Boolean));console.log('dictionary size',d.set.size);
let n=0;const t=(name,fn)=>{fn();n++;console.log('ok -',name);};
const B=['TANKSAREASLAMESTAMEDRATES','CARESTARESSTARTPLAYSWORDS','LOVESHOPEAREASEATSTARTSTO','PLANSPOWERSTARSTONESGOLDS'].map(s=>s.split(''));
t('adjacency: 8 directions, no wrap',()=>{assert(W.adjacent(12,6)&&W.adjacent(12,18)&&W.adjacent(12,13)&&W.adjacent(12,16));assert(!W.adjacent(4,5)&&!W.adjacent(0,2));});
t('direction change: right,right,down,down-left is valid',()=>{const L='ABCXXXXDXXXEXXXXXXXXXXXXX'.split('');const D={has:w=>w==='ABCDE'};
  assert.strictEqual(W.validatePath(L,[0,1,2,7,11],D).ok,true);assert.strictEqual(W.validatePath(L,[0,1,2,7,11,2],D).reason,'reuse');});
t('tile reuse rejected',()=>assert.strictEqual(W.validatePath(B[0],[0,1,0],d).reason,'reuse'));
t('non-adjacent rejected',()=>assert.strictEqual(W.validatePath(B[0],[0,2,3],d).reason,'notadjacent'));
t('TAN valid on board 1 (horizontal)',()=>assert(W.validatePath(B[0],[0,1,2],d).ok));
t('vertical + diagonal paths',()=>{assert(W.findPath(B[0],'RAT'));assert(W.validatePath(B[0],[10,11,12,7],d).word==='LAME');});
const req='TAN ARE LAD LAME TAME RAT STAR RATE TEAM WORD PLAY GOLD'.split(' ');
t('12 required words are in dictionary',()=>req.forEach(w=>assert(d.has(w),w)));
t('required words traceable on original boards (TEAM is not)',()=>{const miss=req.filter(w=>!B.some(l=>W.findPath(l,w)));console.log('   not traceable on originals:',miss.join(','));assert.deepStrictEqual(miss,['TEAM']);});
t('100 generated boards: targets traceable, no Q, playable',()=>{let ms=0,min=1e9;for(let i=0;i<100;i++){const s=Date.now(),b=W.generate(d);ms+=Date.now()-s;
  b.targets.forEach(x=>assert(W.validatePath(b.letters,x.path,d).word===x.word));assert(!b.letters.includes('Q'));assert(b.words>=30&&b.cover>=20);min=Math.min(min,b.words);}
  console.log('   avg gen ms',ms/100,'min words',min);});
t('shuffle keeps letters, changes order, stays playable',()=>{const b=W.generate(d),s=W.shuffleLetters(b.letters,d);assert.deepStrictEqual([...s.letters].sort(),[...b.letters].sort());assert.notDeepStrictEqual(s.letters,b.letters);assert(s.words>=20);console.log('   words',b.words,'->',s.words);});
t('lite fallback dictionary still generates boards',()=>{const l=new W.DictionaryManager();const b=W.generate(l);assert(b.words>=10);console.log('   lite words',b.words);});
t('scoring + combo + bonuses',()=>{const s=new W.ScoreManager();let r=s.submit('valid','TAN');assert.strictEqual(r.points,10);r=s.submit('valid','LAME');assert.strictEqual(r.points,30);
  r=s.submit('duplicate','LAME');assert.strictEqual(s.combo,0);r=s.submit('valid','PLANETS');assert(r.tags.some(x=>x[0]==='LONG WORD')&&r.tags.some(x=>x[0]==='PERFECT WORD'));assert.strictEqual(s.accuracy,75);
  const q=new W.ScoreManager();let last;for(let i=0;i<10;i++)last=q.submit('valid','ARE');assert(last.tags.some(x=>x[0]==='COMBO MASTER')&&last.tags.some(x=>x[0]==='WORD HUNTER'));});
t('seeded daily board is deterministic',()=>{const a=W.generate(d,W.seedRng('WMX2026-10-06'),1e9),b=W.generate(d,W.seedRng('WMX2026-10-06'),1e9);assert.deepStrictEqual(a.letters,b.letters);});
t('rare word bonus',()=>{const s=new W.ScoreManager();const r=s.submit('valid','AREA','',true);assert(r.tags.some(x=>x[0]==='RARE WORD'));assert.strictEqual(r.points,25+15);assert(d.isRare('AAHED')&&!d.isRare('TEAM'));});
t('tile multiplier + makeBonus',()=>{const b=W.makeBonus(Math.random);assert.strictEqual(Object.keys(b).length,3);const s=new W.ScoreManager();const r=s.submit('valid','TAN','',false,3);assert.strictEqual(r.points,30);});
t('topic packs: valid terms, boards hide traceable terms',()=>{const T=require('../js/topics.js');for(const k in T){const ws=Object.keys(T[k].terms);ws.forEach(w=>assert(/^[A-Z]{4,9}$/.test(w),w));d._merge(ws);
  for(let i=0;i<20;i++){const b=W.generate(d,Math.random,160,ws);assert(b.targets.length>=2&&b.targets.every(x=>T[k].terms[x.word]&&W.validatePath(b.letters,x.path,d).ok));}}});
console.log(n,'tests passed');
