/* A deliberately unserious, deterministic name model. No match results enter it. */
(function(root){
 'use strict';
 const tiles={a:1,b:3,c:3,d:2,e:1,f:4,g:2,h:4,i:1,j:8,k:5,l:1,m:3,n:1,o:1,p:3,q:10,r:1,s:1,t:1,u:1,v:4,w:4,x:8,y:4,z:10};
 // Fixed spelling inventory, not a pronunciation or language detector.
 // Sources: Victorian phonics scope & sequence; DfE Letters and Sounds;
 // Unicode CLDR contractions. Four-letter English patterns also appear in
 // the DfE 2011 phonics technical report (aigh, eigh, augh, ough).
 const digraphs=Object.freeze('ae ai ar au aw ay bh ch ci ck cs cz dd dh dj dz ea ee ei eo er eu ew ey ff gh gi gn gu gw gy ie ij ir kh kj kn ks ky lh lj ll ly mb mh ng nh nj ny oa oe oi oo or ou ow oy ph pn ps pt qu rh rr sc sh si sj sk ss sz th ti ts tt tx ty ue ui ur uu wh wr zh zs zz'.split(' '));
 const trigraphs=Object.freeze('air are chr dge dzs eau ear eer ere eur igh ill iou ngh oor ore our sch tch thr ure'.split(' '));
 const quadgraphs=Object.freeze('aigh augh dsch eaux eigh ough shch tsch'.split(' '));
 // An explicit game-rule list of familiar English sequences, not population
 // statistics about people's names. A common sequence can also be a digraph.
 const commonPairs=Object.freeze('th he in er an re on at en nd ti es or te ed is it al ar st to nt ng se ha as ou io le ve co me de hi ri ro ne ea ra li ch ll ma si om ur'.split(' '));
 const bandNames=Object.freeze(['Blessed','Alphabet Royalty','Letter Rich','Well Lettered','Ordinarily Named','Vowel Dependent','Letter Poor','Typographically Cursed']);
 function normalise(name){return String(name??'').normalize('NFKD').replace(/\p{M}/gu,'').replace(/ß/g,'ss').replace(/ẞ/g,'SS').replace(/æ/gi,'ae').replace(/œ/gi,'oe').replace(/ø/gi,'o').replace(/ł/gi,'l').replace(/đ|ð/gi,'d').replace(/þ/gi,'th').toLowerCase()}
 const tile=letter=>tiles[letter]||1,vowel=letter=>'aeiou'.includes(letter),latin=letter=>/^[a-z]$/.test(letter);
 function analyse(name){
  const text=normalise(name),words=text.match(/\p{L}+/gu)||[],letters=[...words.join('')],counts={};
  for(const letter of letters)counts[letter]=(counts[letter]||0)+1;
  const n=letters.length,unique=Object.keys(counts).length;
  const letterRows=Object.entries(counts).sort(([a],[b])=>a.localeCompare(b)).map(([letter,count])=>({letter,count,value:tile(letter),type:latin(letter)?vowel(letter)?'Vowel':'Consonant':'Other letter',basePoints:count*24,points:count*tile(letter)*14}));
  function scan(patterns,rate){const seen=new Map();return words.flatMap((word,wordIndex)=>{const found=[];for(let at=0;at<word.length;at++)for(const pattern of patterns)if(word.slice(at,at+pattern.length)===pattern){const repeat=seen.has(pattern);seen.set(pattern,true);found.push({pattern,wordIndex,at,repeat,points:repeat?Math.round(rate*.4):rate})}return found})}
  const two=scan(digraphs,36),three=scan(trigraphs,100),four=scan(quadgraphs,180);
  const spaceCount=(String(name??'').trim().match(/\s+/g)||[]).length;
  const latinLetters=letters.filter(latin),vowels=latinLetters.filter(vowel).length,consonants=latinLetters.length-vowels;
  const distinctVowels=letterRows.filter(r=>r.type==='Vowel').length,distinctConsonants=letterRows.filter(r=>r.type==='Consonant').length;
  const vowelShare=latinLetters.length?vowels/latinLetters.length:null;
  const entropy=n?Object.values(counts).reduce((sum,count)=>{const p=count/n;return sum-p*Math.log2(p)},0):0;
  const entropyRatio=n>1?entropy/Math.log2(n):0;
  const transitions=[],rare=[],common=[],vowelRuns=[],consonantRuns=[],palindromes=[];
  const rareSeen=new Set(),commonSet=new Set(commonPairs);
  words.forEach((word,wordIndex)=>{
   const chars=[...word];
   for(let at=0;at<chars.length-1;at++){
    const a=chars[at],b=chars[at+1],pattern=a+b;
    if(latin(a)&&latin(b)&&vowel(a)!==vowel(b))transitions.push({pattern,wordIndex,at,points:4});
    if(latin(a)&&latin(b)&&a!==b&&tile(a)+tile(b)>=9&&!rareSeen.has(pattern)){rareSeen.add(pattern);rare.push({pattern,wordIndex,at,points:Math.min(42,6*(tile(a)+tile(b)-8))})}
    if(commonSet.has(pattern))common.push({pattern,wordIndex,at,points:-8});
   }
   for(const match of word.matchAll(/[aeiou]{3,}/g))vowelRuns.push({pattern:match[0],wordIndex,at:match.index,points:Math.min(54,18*(match[0].length-2))});
   for(const match of word.matchAll(/[b-df-hj-np-tv-z]{3,}/g)){const distinct=new Set(match[0]).size;if(distinct>=3)consonantRuns.push({pattern:match[0],wordIndex,at:match.index,points:Math.min(40,10*(distinct-2))})}
   if(chars.length>=3&&new Set(chars).size>1&&chars.join('')===[...chars].reverse().join(''))palindromes.push({pattern:word,wordIndex,at:0,points:40});
  });
  const initials=words.map(w=>[...w][0]),distinctInitials=new Set(initials).size;
  const repeatedWords=words.length-new Set(words).size;
  const dominant=Object.entries(counts).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]))[0];
  const excess=n>=4?Object.values(counts).reduce((sum,count)=>sum+Math.max(0,count-Math.ceil(n*.4)),0):0;
  const sum=items=>items.reduce((total,item)=>total+item.points,0),parts=[];
  const add=(key,label,points,detail)=>parts.push({key,label,points,detail,kind:points<0?'penalty':'bonus'});
  add('length','Letter allowance',n*24,n+' letters × 24');
  add('tiles','Rare-letter tiles',letterRows.reduce((total,r)=>total+r.points,0),letterRows.reduce((total,r)=>total+r.count*r.value,0)+' tile value × 14');
  add('spaces','Space estate',spaceCount*44,spaceCount+' word gaps × 44');
  add('variety','Low-repeat dividend',n?unique*12+Math.round(60*unique/n):0,'12 × distinct letters + round(60 × distinct / total)');
  add('initial','Opening-letter privilege',n?(tile(letters[0])-1)*24:0,(letters[0]||'—').toUpperCase()+' · (tile value − 1) × 24');
  add('digraphs','Digraph collection',sum(two),two.length+' matches · first of each 36, repeats 14');
  add('trigraphs','Trigraph jackpot',sum(three),three.length+' matches · first of each 100, repeats 40');
  add('quadgraphs','Quadgraph windfall',sum(four),four.length+' matches · first of each 180, repeats 72');
  add('composition','Vowel & consonant weights',vowels*2+consonants*3,vowels+' vowels × 2 + '+consonants+' consonants × 3');
  add('inventory','Distinct-letter palette',distinctVowels*12+distinctConsonants*5,distinctVowels+' vowel types × 12 + '+distinctConsonants+' consonant types × 5');
  add('balance','Vowel–consonant balance',vowelShare==null||!vowels||!consonants?0:Math.round(50*Math.max(0,1-Math.abs(vowelShare-.4)/.4)),'Up to 50; highest at 40% vowels in Latin letters');
  add('entropy','Letter diversity',Math.round(40*entropyRatio),'round(40 × Shannon entropy / log₂(total letters))');
  add('alternation','Alternating rhythm',sum(transitions),transitions.length+' vowel/consonant switches × 4');
  add('rare','Unusual combinations',sum(rare),'Distinct unequal Latin pairs with tile sum ≥ 9; 6 × (sum − 8), capped at 42');
  add('runs','Vowel ladders & consonant clusters',sum(vowelRuns)+sum(consonantRuns),'Vowel runs: 18 × (length − 2), max 54; consonant runs: 10 × (distinct − 2), max 40');
  add('palindromes','Mirror-word bonus',sum(palindromes),palindromes.length+' non-uniform palindrome words × 40');
  add('initials','Initial variety',Math.max(0,distinctInitials-1)*8,'8 per distinct word initial after the first');
  add('common','Familiar-combination tax',sum(common),common.length+' listed common pairs × −8');
  add('commonLetters','Common-letter levy',letters.filter(c=>'aeinorst'.includes(c)).length*-3,'Each A, E, I, N, O, R, S or T costs 3');
  add('repeats','Repeat-letter toll',(n-unique)*-6,(n-unique)+' letters beyond their first occurrence × −6');
  add('monopoly','Letter monopoly',excess*-10,'For names of 4+ letters: occurrences above ceil(40% of length), per letter, × −10');
  add('repeatedInitials','Repeated-initial toll',(initials.length-distinctInitials)*-12,(initials.length-distinctInitials)+' repeated word initials × −12');
  add('repeatedWords','Copy-and-paste tax',repeatedWords*-40,repeatedWords+' repeated words × −40');
  const grossScore=parts.filter(p=>p.points>0).reduce((s,p)=>s+p.points,0),penaltyPoints=-parts.filter(p=>p.points<0).reduce((s,p)=>s+p.points,0);
  return {version:2,name:String(name??''),words,letters:n,unique,repeats:n-unique,spaces:spaceCount,tileValue:letterRows.reduce((s,r)=>s+r.count*r.value,0),letterRows,digraphs:two,trigraphs:three,quadgraphs:four,parts,score:grossScore-penaltyPoints,grossScore,penaltyPoints,
   composition:{vowels,consonants,other:n-latinLetters.length,distinctVowels,distinctConsonants,vowelShare,entropy,entropyRatio,transitions:transitions.length,dominant:dominant?{letter:dominant[0],count:dominant[1],share:dominant[1]/n}:null},
   combinations:{rare,common,vowelRuns,consonantRuns,palindromes},initials:{letters:initials,distinct:distinctInitials}};
 }
 function analysePair(name){
 const members=String(name).split(/\s*\/\s*/).map(analyse),result={name:String(name),members,parts:members.flatMap(m=>m.parts.map(p=>({...p,label:m.name+' · '+p.label})))};
 for(const key of ['score','grossScore','penaltyPoints','letters','unique','repeats','spaces','tileValue'])result[key]=members.reduce((n,m)=>n+m[key],0);
 for(const key of ['digraphs','trigraphs','quadgraphs'])result[key]=members.flatMap(m=>m[key]);
 result.combinations={common:members.flatMap(m=>m.combinations.common)};return result;
 }
 function pairScope(scope='section'){return ['section','all','history'].includes(scope)?scope:'section'}
 // Tables need counts, not a full points ledger for every archived partnership.
 // Score each distinct member once and build detailed analyses only on demand.
 function createSummaryScorer(){const cache=new Map();const single=name=>{if(!cache.has(name)){const a=analyse(name),s={};for(const key of ['score','letters','tileValue','spaces'])s[key]=a[key];for(const key of ['digraphs','trigraphs','quadgraphs'])s[key]={length:a[key].length};cache.set(name,s)}return cache.get(name)};return(name,pair=false)=>{if(!pair)return single(name);const members=String(name).split(/\s*\/\s*/).map(single),s={};for(const key of ['score','letters','tileValue','spaces'])s[key]=members.reduce((n,m)=>n+m[key],0);for(const key of ['digraphs','trigraphs','quadgraphs'])s[key]={length:members.reduce((n,m)=>n+m[key].length,0)};return s}}
 function highest(rows){return rows.filter(r=>r.rating===rows[0]?.rating)}
 function rank(rows,analyser=analyse){let prior=null,place=0;return rows.map(row=>({...row,analysis:analyser(row.player)})).sort((a,b)=>b.analysis.score-a.analysis.score||a.player.localeCompare(b.player)).map((row,i)=>{if(row.analysis.score!==prior)place=i+1;prior=row.analysis.score;return {...row,rating:row.analysis.score,rank:place}})}
 const api={tiles,digraphs,trigraphs,quadgraphs,commonPairs,bandNames,normalise,analyse,analysePair,pairScope,createSummaryScorer,highest,rank};root.BRTAOrthography=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);

