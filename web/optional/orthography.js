/* A deliberately unserious, deterministic name model. No match results enter it. */
(function(root){
 'use strict';
 const tiles={a:1,b:3,c:3,d:2,e:1,f:4,g:2,h:4,i:1,j:8,k:5,l:1,m:3,n:1,o:1,p:3,q:10,r:1,s:1,t:1,u:1,v:4,w:4,x:8,y:4,z:10};
 // Contiguous English graphemes, supplemented by common Latin-script name patterns.
 // These are spelling matches, not guesses about how somebody pronounces their name.
 // References: Victorian phonics scope & sequence; DfE Letters and Sounds;
 // Unicode CLDR collation contractions (ch, dz, dž, lj, nj, sz, zs, dzs, ...).
 const digraphs=Object.freeze('ae ai ar au aw ay bh ch ci ck cs cz dd dh dj dz ea ee ei eo er eu ew ey ff gh gi gn gu gw gy ie ij ir kh kj kn ks ky lh lj ll ly mb mh ng nh nj ny oa oe oi oo or ou ow oy ph pn ps pt qu rh rr sc sh si sj sk ss sz th ti ts tt tx ty ue ui ur uu wh wr zh zs zz'.split(' '));
 const trigraphs=Object.freeze('air are chr dge dzs eau ear eer ere eur igh ill iou ngh oor ore our sch tch thr ure'.split(' '));
 const bandNames=Object.freeze(['Blessed','Alphabet Royalty','Letter Rich','Ordinarily Named','Vowel Dependent','Typographically Cursed']);
 function normalise(name){return String(name??'').normalize('NFKD').replace(/\p{M}/gu,'').replace(/ß/g,'ss').replace(/ẞ/g,'SS').replace(/æ/gi,'ae').replace(/œ/gi,'oe').replace(/ø/gi,'o').replace(/ł/gi,'l').replace(/đ|ð/gi,'d').replace(/þ/gi,'th').toLowerCase()}
 function analyse(name){
  const text=normalise(name),words=text.match(/\p{L}+/gu)||[],letters=[...words.join('')],counts={};
  for(const letter of letters)counts[letter]=(counts[letter]||0)+1;
  const letterRows=Object.entries(counts).sort(([a],[b])=>a.localeCompare(b)).map(([letter,count])=>({letter,count,value:tiles[letter]||1,points:count*(tiles[letter]||1)*7}));
  const scan=(patterns,value)=>words.flatMap((word,wordIndex)=>patterns.flatMap(pattern=>{const found=[];for(let at=0;at<=word.length-pattern.length;at++)if(word.slice(at,at+pattern.length)===pattern)found.push({pattern,wordIndex,at,points:value});return found}));
  const two=scan(digraphs,18),three=scan(trigraphs,50),spaceCount=(String(name??'').trim().match(/\s+/g)||[]).length,unique=Object.keys(counts).length;
  const parts=[{key:'length',label:'Letter allowance',count:letters.length,rate:12,points:letters.length*12},{key:'tiles',label:'Rare-letter tiles',points:letterRows.reduce((n,r)=>n+r.points,0)},{key:'spaces',label:'Space estate',count:spaceCount,rate:22,points:spaceCount*22},{key:'variety',label:'Low-repeat dividend',points:letters.length?unique*6+Math.round(30*unique/letters.length):0},{key:'initial',label:'Opening-letter privilege',letter:letters[0]||'',points:letters.length?((tiles[letters[0]]||1)-1)*12:0},{key:'digraphs',label:'Digraph collection',count:two.length,rate:18,points:two.length*18},{key:'trigraphs',label:'Trigraph jackpot',count:three.length,rate:50,points:three.length*50}];
  return {name:String(name??''),letters:letters.length,unique,repeats:letters.length-unique,spaces:spaceCount,tileValue:letterRows.reduce((n,r)=>n+r.count*r.value,0),letterRows,digraphs:two,trigraphs:three,parts,score:parts.reduce((n,r)=>n+r.points,0)};
 }
 function rank(rows){let prior=null,place=0;return rows.map(row=>({...row,analysis:analyse(row.player)})).sort((a,b)=>b.analysis.score-a.analysis.score||a.player.localeCompare(b.player)).map((row,i)=>{if(row.analysis.score!==prior)place=i+1;prior=row.analysis.score;return {...row,rating:row.analysis.score,rank:place}})}
 const api={tiles,digraphs,trigraphs,bandNames,normalise,analyse,rank};root.BRTAOrthography=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
