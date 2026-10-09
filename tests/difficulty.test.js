'use strict';
const assert=require('assert'),W=require('../js/engine.js'),G=require('../server/game.js');
const dict=G.loadDictionary();let n=0;const t=(name,fn)=>{fn();n++;console.log('ok -',name);};
const IDS=['easy','hard'],ALL=['easy','normal','hard'],med=a=>a.slice().sort((x,y)=>x-y)[a.length>>1];
const sample=(id,k)=>Array.from({length:k},()=>{const s=Date.now(),b=W.generate(dict,Math.random,null,null,id);b.ms=Date.now()-s;return b;});
const boards={};ALL.forEach(id=>boards[id]=sample(id,30));
t('config: only easy and hard are selectable; multipliers 1 / 1.25; normal/expert removed',()=>{
  assert.deepStrictEqual(W.DIFFICULTY_IDS,IDS);assert.deepStrictEqual(IDS.map(i=>W.DIFFICULTY[i].mult),[1,1.25]);
  assert.strictEqual(W.DIFFICULTY.expert,undefined);assert.strictEqual(W.DIFFICULTY.normal.label,'DAILY');
  IDS.forEach(i=>{const D=W.DIFFICULTY[i];assert.strictEqual(D.id,i);assert(D.label&&D.lens.length&&D.attempts>0&&D.budget>0);});});
t('config: only exact lowercase easy/hard are valid ids (normal/expert rejected)',()=>{IDS.forEach(i=>assert(W.isDifficulty(i)));
  for(const bad of['normal','expert','Easy','HARD','','hard ','__proto__','constructor','toString',null,undefined,5,{},['easy'],true])assert(!W.isDifficulty(bad),String(bad));});
t('generation: every difficulty yields valid, playable boards; all words verify; bounded time',()=>{
  for(const id of ALL)for(const b of boards[id]){assert.strictEqual(b.letters.length,25);assert(!b.letters.includes('Q'));assert(/^[A-Z]{25}$/.test(b.letters.join('')));
    assert(b.words>=25,id+' words '+b.words);assert(b.cover>=18);assert(b.vowels>=6&&b.vowels<=13);assert.strictEqual(b.difficulty,id);
    b.targets.forEach(x=>assert.strictEqual(W.validatePath(b.letters,x.path,dict).word,x.word));
    let k=0;for(const [w,p] of b.sol){assert.strictEqual(W.validatePath(b.letters,p,dict).word,w);if(++k>40)break;}
    assert(b.ms<2500,id+' took '+b.ms+'ms');}});
t('generation: hard bounds & fallback still returns a valid board (1 ms budget)',()=>{
  for(const id of IDS){const b=W.generate(dict,Math.random,1,null,id);assert(b&&b.letters.length===25&&b.words>=18);}});
t('differentiation: parameters differ per difficulty (not just a label)',()=>{
  const sig=i=>JSON.stringify([W.DIFFICULTY[i].lens,W.DIFFICULTY[i].pool,W.DIFFICULTY[i].straight,W.DIFFICULTY[i].minWords]);
  assert.strictEqual(new Set(ALL.map(sig)).size,3);});
t('differentiation: hard boards measurably differ from easy boards',()=>{
  const m=(id,k)=>med(boards[id].map(b=>b.metrics[k])),r={};ALL.forEach(i=>r[i]={s5:m(i,'s5'),s4:m(i,'s4'),six:m(i,'six'),max:m(i,'maxLen')});
  console.log('   median short(<=5) share / 6+ words / longest:',ALL.map(i=>i+' '+r[i].s5.toFixed(2)+'/'+r[i].six+'/'+r[i].max).join(' | '));
  assert(r.easy.s5>r.hard.s5+.15);assert(r.hard.s4<r.easy.s4);assert(r.hard.six>r.easy.six*3);assert(r.hard.max>=r.easy.max);});
t('normal difficulty keeps the legacy generator behaviour (seeded, deterministic)',()=>{
  const a=W.generate(dict,W.seedRng('legacy'),1e9),b=W.generate(dict,W.seedRng('legacy'),1e9,null,'normal');assert.deepStrictEqual(a.letters,b.letters);});
t('scoring: multiplier per difficulty applied to the whole word score, breakdown separated',()=>{
  const exp={easy:25,hard:31};
  for(const id of IDS){const r=new W.ScoreManager(W.DIFFICULTY[id].mult).submit('valid','STAR','',false,1);
    assert.strictEqual(r.points,exp[id],id);assert.strictEqual(r.base,25);assert.strictEqual(r.diffMult,W.DIFFICULTY[id].mult);assert.strictEqual(r.points,Math.round(r.subtotal*r.diffMult));}
  assert.strictEqual(new W.ScoreManager().submit('valid','STAR','').points,25);});
t('scoring: combo + special bonuses still work under a multiplier',()=>{
  const s=new W.ScoreManager(1.5);let r=s.submit('valid','TAN','');assert.strictEqual(r.points,15);
  r=s.submit('valid','LAME','');assert.strictEqual(r.comboBonus,5);assert.strictEqual(r.points,Math.round(30*1.5));
  r=s.submit('valid','PLANETS','');assert(r.tags.some(x=>x[0]==='LONG WORD')&&r.tags.some(x=>x[0]==='PERFECT WORD'));
  assert.strictEqual(r.subtotal,r.base+r.comboBonus+r.special);assert.strictEqual(r.points,Math.round(r.subtotal*1.5));
  const e=new W.ScoreManager(1);e.submit('valid','TAN','');e.submit('duplicate','TAN','');assert.strictEqual(e.combo,0);assert.strictEqual(e.score,10);});
t('server game builder honours difficulty and rejects unknown ids',()=>{
  const g=G.newGame(dict,12345,'hard');assert.strictEqual(g.difficulty,'hard');assert.strictEqual(G.newGame(dict,1,'bogus').difficulty,'easy');assert.strictEqual(G.newGame(dict,1,'expert').difficulty,'easy');
  assert.deepStrictEqual(G.newGame(dict,777,'hard').letters.length,25);});
console.log(n,'difficulty tests passed');
