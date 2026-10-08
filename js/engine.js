/* WORDAMIX engine: pure logic (no DOM). Works in browser (window.WMX) and Node tests. */
(function(root){
'use strict';
const SIZE=5,N=25,MIN_LEN=3;
const CFG={SIZE,N,MIN_LEN,ROUND:60,SHUFFLES:3};

/* ---------- DictionaryManager ---------- */
const FALLBACK=`ACE ACT ADD AGE AID AIM AIR ALE ALL AND ANT ANY APE ARE ARM ART ASH ASK ATE BAD BAG BAN BAR BAT BAY BED BEE BET BIG BIT BOW BOX BOY BUD BUG BUS BUT BUY CAB CAN CAP CAR CAT COW CRY CUP CUT DAD DAY DEN DID DIG DOG DOT DRY DUE EAR EAT EEL EGG END ERA EYE FAN FAR FAT FEW FIG FIN FIT FIX FLY FOG FOR FOX FUN GAP GAS GET GOD GOT GUM GUN GUY HAD HAM HAS HAT HAY HEN HER HIM HIP HIS HIT HOT HOW HUG ICE INK JAM JAR JAW JET JOB JOY KEY KID KIN LAD LAP LAW LAY LEG LET LID LIE LIP LOG LOT LOW MAD MAN MAP MAT MAY MEN MET MIX MUD NAP NET NEW NOD NOT NOW NUT OAK OAR OAT OIL OLD ONE OUR OUT OWL OWN PAD PAN PAT PAW PAY PEA PEN PET PIE PIG PIN PIT POD POT RAG RAN RAT RAW RAY RED RIB RID RIM ROB ROD ROT ROW RUB RUG RUN SAD SAT SAW SAY SEA SEE SET SEW SHE SIP SIR SIT SKY SON SUN TAB TAG TAN TAP TAR TEA TEN THE TIE TIN TIP TOE TON TOP TOY TRY TUB TWO URN USE VAN WAR WAS WAX WAY WEB WET WHO WIG WIN WON YES YET ZIP
ALSO AREA ARMS ARTS BAKE BALL BAND BARE BARN BASE BEAR BEAT BELL BEST BIRD BOAT BODY BONE BOOK BORN CAKE CALM CAME CARD CARE CART CASE CATS COAT COLD COME COOL CORN DARE DARK DATE DEAR DOOR DREAM DRAW EARN EAST EASY EDGE FACE FAME FARM FAST FATE FEAR FIRE FISH FLAT FOOD FORM GAME GATE GIFT GIRL GLAD GOAL GOLD GOOD HAIR HALF HAND HARD HATE HEAD HEAR HEAT HELP HERE HOLD HOME HOPE IDEA IRON KEEP KIND LAKE LAME LAND LAST LATE LEAD LEAF LIFE LIKE LINE LIST LOVE MADE MAIL MAIN MAKE MALE MANY MARE MASK MEAL MEAN MEAT MILD MILE MIND MINE MOON MORE NAME NEAR NEAT NEST NICE NOTE OPEN PAGE PAIN PAIR PALE PARK PART PEAR PLAN PLAY POOL RACE RAIN RARE RATE READ REAL REST RIDE RING ROAD ROSE SAFE SAIL SALT SAME SAND SEAT SEEN SHIP SLOW SNOW SOFT SOME SONG SOON STAR STAY STEM STEP TALE TAME TEAM TEAR TELL TIME TONE TREE TRUE WAIT WALK WALL WANT WARM WATER WORD WORK WORLD
ALERT ANGEL BEARS BEAST CARES CHAIR CLEAN CLEAR DREAM EARTH FLAME GLORY GRAND HEART LATER LEARN MEANT METAL PLANE PLANT PLATE POWER RATES SMART STAMP STARE START STATE STEAM STONE STORE TALES TEAMS TRADE TRAIN TREAT WATER WORDS WORLD`.split(/\s+/);
class DictionaryManager{
  constructor(){this.set=new Set(FALLBACK);this.arr=[...this.set].sort();this.full=false;this.status='lite';this.listeners=[];}
  _merge(words){words.forEach(w=>this.set.add(w));this.arr=[...this.set].sort();}
  async _fetch(url){const r=await fetch(url,{cache:'force-cache'});if(!r.ok)throw 0;
    return (await r.text()).split(/\s+/).map(s=>s.trim().toUpperCase()).filter(s=>/^[A-Z]{3,15}$/.test(s));}
  async load(commonUrl,largeUrl){
    try{const w=await this._fetch(commonUrl);if(w.length<5000)throw 0;this._merge(w);this.commonSet=new Set(w);this.common=w.filter(x=>x.length>=4&&x.length<=7&&!/Q/.test(x)).sort();this.full=true;this.status='full';}
    catch(e){this.status='lite';return this.status;}
    if(largeUrl)try{const w=await this._fetch(largeUrl);if(w.length>50000){this._merge(w);this.status='large';}}catch(e){}
    return this.status;}
  has(w){return w.length>=MIN_LEN&&this.set.has(w);}
  lower(p){let a=0,b=this.arr.length;while(a<b){const m=(a+b)>>1;if(this.arr[m]<p)a=m+1;else b=m;}return a;}
  isRare(w){return !!this.commonSet&&!this.commonSet.has(w);}
  hasPrefix(p){const i=this.lower(p);return i<this.arr.length&&this.arr[i].startsWith(p);}
  targets(min,max){const base=this.commonSet?(this._cl||(this._cl=[...this.commonSet].sort())):(this.common||this.arr);return base.filter(w=>w.length>=min&&w.length<=max&&!/Q/.test(w));}
}
const NB=[];for(let i=0;i<N;i++){NB[i]=[];const r=(i/SIZE)|0,c=i%SIZE;
  for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++){if(!dr&&!dc)continue;const rr=r+dr,cc=c+dc;if(rr>=0&&rr<SIZE&&cc>=0&&cc<SIZE)NB[i].push(rr*SIZE+cc);}}
const adjacent=(a,b)=>NB[a].indexOf(b)>=0;
const WEIGHTS={E:12,A:9,I:9,O:8,N:7,R:7,T:7,S:6,L:5,D:4,U:4,C:3,M:3,H:3,G:2,P:3,B:2,F:2,Y:2,W:2,K:1,V:1,J:.3,X:.3,Z:.3};
const VOWELS='AEIOU';
function pickLetter(rnd,counts,f){const keys=Object.keys(WEIGHTS);let tot=0;const ws=keys.map(k=>{const w=counts[k]>=(k==='E'?4:3)?0:WEIGHTS[k]*(f?f(k):1);tot+=w;return w;});
  let x=rnd()*tot;for(let i=0;i<keys.length;i++){x-=ws[i];if(x<=0)return keys[i];}return 'E';}
function validatePath(letters,path,dict){
  if(!path||path.length<MIN_LEN)return{ok:false,reason:'short'};
  const seen=new Set();let word='';
  for(let k=0;k<path.length;k++){const t=path[k];
    if(!(t>=0&&t<N))return{ok:false,reason:'bad'};
    if(seen.has(t))return{ok:false,reason:'reuse'};seen.add(t);
    if(k&&!adjacent(path[k-1],t))return{ok:false,reason:'notadjacent'};
    word+=letters[t];}
  return dict.has(word)?{ok:true,word}:{ok:false,reason:'notword',word};}
function findPath(letters,word,from){
  const used=new Set(),path=[];
  const go=(i,cands)=>{if(i===word.length)return true;
    for(const t of cands){if(used.has(t)||letters[t]!==word[i])continue;used.add(t);path.push(t);
      if(go(i+1,NB[t]))return true;used.delete(t);path.pop();}return false;};
  if(from&&from.length){used.clear();from.forEach(t=>used.add(t));path.push(...from);return go(from.length,NB[from[from.length-1]])?path.slice():null;}
  return go(0,[...Array(N).keys()])?path.slice():null;}
function solve(letters,dict){
  const out=new Map(),used=new Array(N).fill(false),path=[];
  const dfs=(t,pre)=>{pre+=letters[t];if(!dict.hasPrefix(pre))return;used[t]=true;path.push(t);
    if(pre.length>=MIN_LEN&&dict.set.has(pre)&&!out.has(pre))out.set(pre,path.slice());
    for(const n of NB[t])if(!used[n])dfs(n,pre);used[t]=false;path.pop();};
  for(let i=0;i<N;i++)dfs(i,'');return out;}
function evaluate(letters,dict){const sol=solve(letters,dict);const cov=new Set();let long=0;
  sol.forEach((p,w)=>{p.forEach(t=>cov.add(t));if(w.length>=5)long++;});
  const v=letters.filter(l=>VOWELS.includes(l)).length;
  return{sol,words:sol.size,long,cover:cov.size,vowels:v,score:sol.size+long*2+cov.size*3};}
function placeWord(grid,word,rnd,pref=0){
  for(let tries=0;tries<40;tries++){const path=[];const used=new Set();
    const go=(i,t)=>{if(grid[t]!==null&&grid[t]!==word[i])return false;const old=grid[t];grid[t]=word[i];used.add(t);path.push(t);
      if(i===word.length-1)return true;
      let nb=NB[t].filter(n=>!used.has(n));
      if(pref&&path.length>1){const d0=t-path[path.length-2];nb=nb.map(n=>[n,(n-t===d0?1:0)*pref+rnd()*.6]).sort((a,b)=>b[1]-a[1]).map(x=>x[0]);}else nb.sort(()=>rnd()-.5);
      for(const n of nb)if(go(i+1,n))return true;
      grid[t]=old;used.delete(t);path.pop();return false;};
    if(go(0,(rnd()*N)|0))return path;}
  return null;}
const RARE='JKVWXYZ';
const DIFFICULTY={
  easy:{id:'easy',label:'EASY',mult:1,lens:[5,5,4,4,4,4],pool:[4,5],straight:1,wf:k=>VOWELS.includes(k)?1.15:RARE.includes(k)?.4:1,attempts:80,budget:220,minWords:100,minCover:23,vmin:8,vmax:13,ok:m=>m.s5>=.88&&m.six<=50&&m.common>=.47,rank:(m,ev)=>m.s5*300+m.common*150+m.commonN*.4-m.six*.5},
  hard:{id:'hard',label:'HARD',mult:1.25,lens:[8,7,6,6,5],pool:[5,8],straight:-1,wf:k=>VOWELS.includes(k)?.92:RARE.includes(k)?1.6:1,attempts:150,budget:400,minWords:40,minCover:21,vmin:6,vmax:12,ok:m=>m.six>=230&&m.s4<=.4&&m.maxLen>=9,rank:(m,ev)=>m.six*3+m.maxLen*6-m.s4*60-m.common*20}};
const DIFFICULTY_IDS=['easy','hard'];
const isDifficulty=x=>typeof x==='string'&&DIFFICULTY_IDS.includes(x);
function metrics(ev,dict){let s4=0,s5=0,six=0,com=0,max=0,sev=0,comLong=0;
  ev.sol.forEach((p,w)=>{const L=w.length;if(L<=4)s4++;if(L<=5)s5++;if(L>=6)six++;if(L>=7)sev++;if(L>max)max=L;if(dict.commonSet&&dict.commonSet.has(w)){com++;if(L>=5)comLong++;}});
  const n=Math.max(1,ev.words);return{words:ev.words,s4:s4/n,s5:s5/n,six,seven:sev,maxLen:max,common:dict.commonSet?com/n:1,commonN:com,commonLong:comLong};}
function generate(dict,rnd=Math.random,budgetMs=null,custom=null,diffId='normal'){
  const D=DIFFICULTY[diffId]||DIFFICULTY.easy;if(budgetMs===null||budgetMs===undefined)budgetMs=D.budget;
  const small=!dict.full,minWords=small?18:D.minWords,minCover=small?20:D.minCover;
  const pool=custom||(small?dict.arr.filter(w=>w.length>=4&&w.length<=6&&!/Q/.test(w)):dict.targets(D.pool[0],D.pool[1]));
  const t0=Date.now();let best=null;
  for(let a=0;a<D.attempts&&(Date.now()-t0<budgetMs||!best);a++){
    const grid=Array(N).fill(null),targets=[];
    for(const L of D.lens){const c=custom?pool.filter(w=>!targets.some(x=>x.word===w)):pool.filter(w=>w.length===L||(L===D.lens[0]&&w.length===L+1));if(!c.length)continue;
      const w=c[(rnd()*c.length)|0];if(targets.some(x=>x.word===w))continue;
      const p=placeWord(grid,w,rnd,D.straight);if(p)targets.push({word:w,path:p});}
    const counts={};grid.forEach(g=>{if(g)counts[g]=(counts[g]||0)+1;});
    for(let i=0;i<N;i++)if(grid[i]===null){const l=pickLetter(rnd,counts,D.wf);grid[i]=l;counts[l]=(counts[l]||0)+1;}
    const ev=evaluate(grid,dict);
    if(ev.vowels<D.vmin||ev.vowels>D.vmax)continue;
    const m=metrics(ev,dict),valid=diffId==='easy'||(ev.cover>=18&&ev.words>=25);
    const cand={letters:grid,targets,...ev,metrics:m,difficulty:diffId,valid,rank:D.rank?D.rank(m,ev):ev.score,ok:false};
    if(!best||(valid&&(!best.valid||cand.rank>best.rank)))best=cand;
    const want=ev.words>=minWords&&ev.cover>=minCover&&ev.vowels>=(D.vmin2||D.vmin)&&(small||custom||!D.ok||D.ok(m));
    if(want){cand.ok=true;return cand;}}
  return best;}
function shuffleLetters(letters,dict,rnd=Math.random,budgetMs=80){
  const t0=Date.now();let best=null;
  do{const l=letters.slice();for(let i=N-1;i>0;i--){const j=(rnd()*(i+1))|0;[l[i],l[j]]=[l[j],l[i]];}
    if(l.every((x,i)=>x===letters[i]))continue;const ev=evaluate(l,dict);
    if(!best||ev.score>best.score)best={letters:l,...ev};}while(Date.now()-t0<budgetMs);
  return best||{letters:letters.slice(),...evaluate(letters,dict)};}
const BASE={3:10,4:25,5:45,6:70,7:100,8:140};
const baseScore=len=>len>=9?180+(len-9)*40:BASE[len]||0;
class ScoreManager{
  constructor(dm=1){this.dm=dm;this.reset();}
  reset(){this.score=0;this.combo=0;this.bestCombo=0;this.found=[];this.valid=0;this.attempts=0;this.best=null;this.longest='';}
  submit(kind,word,path,rare,mult=1,topic=false){
    this.attempts++;
    if(kind!=='valid'){this.combo=0;return{kind,word,points:0};}
    this.combo++;this.valid++;this.bestCombo=Math.max(this.bestCombo,this.combo);
    const base=baseScore(word.length),comboBonus=this.combo>1?Math.min((this.combo-1)*5,60):0;
    const tags=[];let bonus=0;
    if(mult>1){const x=base*(mult-1);bonus+=x;tags.push(['TILE ×'+mult,x]);}
    if(word.length>=7){bonus+=50;tags.push(['LONG WORD',50]);}
    if(word.length>=5&&new Set(word).size===word.length){bonus+=25;tags.push(['PERFECT WORD',25]);}
    if(topic){bonus+=20;tags.push(['TOPIC TERM',20]);}
    if(rare&&word.length>=4){bonus+=15;tags.push(['RARE WORD',15]);}
    if(this.combo%10===0){bonus+=100;tags.push(['COMBO MASTER',100]);}
    if(this.valid%10===0){bonus+=50;tags.push(['WORD HUNTER',50]);}
    const subtotal=base+comboBonus+bonus,points=Math.round(subtotal*this.dm);
    this.score+=points;this.found.push({word,points});
    if(!this.best||points>this.best.points)this.best={word,points};
    if(word.length>this.longest.length)this.longest=word;
    return{kind,word,points,base,comboBonus,special:bonus,subtotal,diffMult:this.dm,tags,combo:this.combo};}
  get accuracy(){return this.attempts?Math.round(100*this.valid/this.attempts):null;}
}
const seedRng=s=>{let a=0;for(const c of s)a=(a*31+c.charCodeAt(0))>>>0;return()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};};
const makeBonus=rnd=>{const b={},idx=[...Array(N).keys()].sort(()=>rnd()-.5);b[idx[0]]=3;b[idx[1]]=2;b[idx[2]]=2;return b;};
const api={DIFFICULTY,DIFFICULTY_IDS,isDifficulty,metrics,makeBonus,seedRng,CFG,DictionaryManager,adjacent,validatePath,findPath,solve,evaluate,generate,shuffleLetters,ScoreManager,baseScore,NB};
root.WMX=api;if(typeof module==='object')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
