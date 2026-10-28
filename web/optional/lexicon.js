/* Optional ratings presentation. Loaded after the ordinary labs and preferences. */
(function(){
 'use strict';
 const model=window.BRTAOrthography,key='orthographic';
 let revealed=false,revealing=false,labFocus=null;
 ratingInfo[key]=['BETTER singles','RM3ultra — finally, a rating that reads the name.'];
 function pick(){if(!auxiliaryEnabled()||revealing)return;ratingView=key;cancelAuxiliaryReveal();$$('#ratingTabs .subtab').forEach(b=>b.classList.toggle('active',b.dataset.rating===key));renderRatings()}
 async function reveal(){
  if(revealed||revealing||!auxiliaryEnabled()||activePage!=='ratings')return;
  revealed=true;revealing=true;
  const tabs=$('#ratingTabs'),others=[...tabs.children].slice(1),before=others.map(b=>b.getBoundingClientRect()),button=document.createElement('button');
  button.type='button';button.className='subtab lexicon-tab';button.dataset.rating=key;button.textContent='BETTER singles';button.onclick=pick;button.style.visibility='hidden';tabs.children[0].after(button);
  const motions=others.map((b,i)=>{const after=b.getBoundingClientRect();return b.animate?.([{transform:'translate('+ (before[i].left-after.left)+'px,'+(before[i].top-after.top)+'px)'},{transform:'translate(0,0)'}],{duration:4200,easing:'cubic-bezier(.22,.65,.3,1)'})});
  await Promise.all(motions.map(a=>a?.finished?.catch(()=>{})));
  if(!button.isConnected||!auxiliaryEnabled()){revealing=false;return}
  button.style.visibility='';await button.animate?.([{opacity:0,filter:'blur(5px)'},{opacity:1,filter:'blur(0)'}],{duration:1900,easing:'ease-out'})?.finished?.catch(()=>{});
  revealing=false;
 }
 // On touch devices a long press also supplies the browser's contextmenu gesture.
 $('#ratingTabs').addEventListener('contextmenu',e=>{if(e.target.closest('[data-rating="singles"]')&&auxiliaryEnabled()&&activePage==='ratings'){e.preventDefault();reveal()}});
 function sync(){
  if(!auxiliaryEnabled()){
   $('#ratingTabs [data-rating="'+key+'"]')?.remove();revealed=false;revealing=false;
   if(ratingView===key){ratingView='singles';$$('#ratingTabs .subtab').forEach(b=>b.classList.toggle('active',b.dataset.rating==='singles'))}
   closeLab();
  }
  $('#updatedMethodology')?.classList.toggle('hidden',ratingView!==key||!auxiliaryEnabled());
 }
 function source(){
  if(ratingScope==='history'){
   const q=$('#search').value.trim();if(!q)return {rows:[],notice:'Type a player name to search all Saturday and Sunday history.'};
   if(playerSearchError)return {rows:[],notice:'History search could not load. Switch to Singles to retry.'};
   if(!playerSearchIndex){ensurePlayerSearchIndex();return {rows:[],notice:'Loading the player index…'}}
   return {rows:BRTAPlayerSearch.find(playerSearchIndex,q)};
  }
  if(ratingScope==='all'){
   const archive=activeHistorySeasonId?archiveGlobalRows():null;
   if(archive?.error)return {rows:[],notice:'This season’s player index could not load.'};
   if(archive&&!archive.rows)return {rows:[],notice:'Loading every section…'};
   let rows=archive?.rows||DATA.globalPlayers||[];
   if(!activeHistorySeasonId&&window.CustomSections)rows=rows.concat(CustomSections.catalog().flatMap(meta=>archiveGlobalRowsFromSection(CustomSections.payload(meta.section_code),meta)));
   return {rows};
  }
  return {rows:BRTAHistory.withMovement(D,'singles',ratingRound)};
 }
 function bandInfo(band){$('#bandInfo').innerHTML='<div class="band-info-head"><b>Name bands</b><label>Filter <select id="lexiconBand"><option value="">All bands</option>'+model.bandNames.map((n,i)=>'<option value="b'+i+'">'+esc(n)+'</option>').join('')+'</select></label></div><div class="band-keys">'+model.bandNames.map((n,i)=>'<div class="band-key b'+i+'"><i></i><span><b>'+esc(n)+'</b><small>'+esc(band.bounds[i]||'—')+'</small></span></div>').join('')+'</div>';$('#lexiconBand').value=window.lexiconBandFilter||'';$('#lexiconBand').onchange=e=>{window.lexiconBandFilter=e.target.value;renderRatings()}}
 function render(){
  const src=source(),rows=model.rank(src.rows),band=BRTALayoutModel.bands(rows),q=$('#search').value.toLowerCase().trim(),tf=$('#teamFilter').value,external=ratingScope!=='section';
  $('#teamFilter').disabled=external;$('#ratingFilters').classList.remove('hidden');$('#ratingsTitle').textContent=(external?(ratingScope==='history'?'All history':'All sections')+' · ':'')+'BETTER singles';$('#ratingsDesc').textContent='Long names. Rare letters. Absolutely no tennis.';$('#ratingsHint').textContent='RM3ultra';
  $('#ratingRoundNotice').classList.toggle('hidden',ratingRound==null||external);if(ratingRound!=null&&!external)$('#ratingRoundNotice').innerHTML='<div><b>After Round '+ratingRound+'</b><span>Same name. Same destiny.</span></div><button class="button secondary" data-rating-round="latest">Latest ratings</button>';
  if(!$('#updatedMethodology')){const button=document.createElement('button');button.id='updatedMethodology';button.className='lexicon-method';button.type='button';button.textContent='Updated Methodology';$('.ratings-toolbar').append(button);button.onclick=()=>{openLayoutOverlay('methodology');eightRaise($('#layoutOverlay'));$('#orthographicMethod')?.scrollIntoView({block:'start',behavior:'smooth'})}}
  $('#updatedMethodology').classList.remove('hidden');bandInfo(band);
  $('#ratingHead').innerHTML='<tr>'+['#','Player','Team',...(external?['Section']:[]),'Ultra','Letters','Tile value','Spaces','Digraphs','Trigraphs'].map(x=>'<th>'+x+'</th>').join('')+'</tr>';
  let last='',out='';const colspan=external?11:10;
  for(const r of rows){const a=r.analysis,cls=band.classFor(r.rating);if(q&&!r.player.toLowerCase().includes(q)||!external&&tf&&r.team!==tf||window.lexiconBandFilter&&cls!==window.lexiconBandFilter)continue;
   if(cls!==last){const i=+cls.slice(1);out+='<tr class="band-divider '+cls+'"><td colspan="'+colspan+'"><div><i></i><b>'+esc(model.bandNames[i])+'</b><span>'+esc(band.bounds[i])+'</span></div></td></tr>';last=cls}
   const section=r.sectionLabel||D.meta.section_label,context=[r.competitionLabel||r.seasonLabel||'',section].filter(Boolean).join(' · ');
   out+='<tr class="'+cls+'"><td>'+r.rank+'</td><td><button class="person" data-lexicon-player="'+esc(r.player)+'" data-lexicon-team="'+esc(r.team)+'" data-lexicon-context="'+esc(context)+'">'+esc(r.player)+'</button></td><td>'+teamName(r.team)+'</td>'+(external?'<td>'+esc(context)+'</td>':'')+'<td><b>'+a.score+'</b></td><td>'+a.letters+'</td><td>'+a.tileValue+'</td><td>'+a.spaces+'</td><td>'+a.digraphs.length+'</td><td>'+a.trigraphs.length+'</td></tr>';
  }
  $('#ratingBody').innerHTML=out||'<tr><td colspan="'+colspan+'">'+esc(src.notice||'No matching names.')+'</td></tr>';
 }
 const ordinaryRender=renderRatings;renderRatings=function(){sync();if(ratingView===key&&D&&auxiliaryEnabled()){render();return}ordinaryRender()};
 // The history selector still refers to the rounds in which these names existed.
 const ordinaryOptions=renderRatingOptions;renderRatingOptions=function(){const view=ratingView;try{if(view===key)ratingView='singles';ordinaryOptions()}finally{ratingView=view}};
 const ordinaryMethod=eightMethodologyHTML;eightMethodologyHTML=function(){return ordinaryMethod()+(revealed&&auxiliaryEnabled()?'<section id="orthographicMethod" class="eight-reading lexicon-reading"><h3>RM3ultra: Updated Methodology</h3><p>This is a name-ranking joke. Match results, ability and qualification do not affect it. Every name gets a place, including provisional players.</p><p>Each letter earns 12 points. Standard English Scrabble tile values earn another 7 points per tile-value unit. Each space between words earns 22. The low-repeat dividend is 6 × distinct letters + round(30 × distinct letters ÷ total letters). The first letter earns 12 × (its tile value − 1).</p><p>Every listed digraph occurrence earns 18 points; every trigraph earns 50. Overlapping matches count, but patterns never cross spaces or punctuation. These are spelling patterns; pronunciation and language are not inferred. Accents are folded for scoring, spaces are normalised, punctuation and digits earn nothing. Other alphabetic characters count as one-point tiles. Equal scores share a rank. The six name bands use the same quantiles as ordinary Singles.</p><details><summary>Counted patterns</summary><p><b>Digraphs</b><br>'+model.digraphs.join(', ')+'</p><p><b>Trigraphs</b><br>'+model.trigraphs.join(', ')+'</p><p>Pattern references: <a href="https://www.education.vic.gov.au/school/teachers/teachingresources/discipline/english/literacy/readingviewing/Pages/phonics-scoping-sequences.aspx" target="_blank" rel="noopener">Victorian phonics scope and sequence</a>; <a href="https://cldr.unicode.org/index/cldr-spec/collation-guidelines" target="_blank" rel="noopener">Unicode CLDR contractions</a>. This is a broad, fixed list, rather than a claim to cover every language.</p></details></section>':'')};
 function closeLab(){const lab=$('#lexiconLab');if(!lab||lab.classList.contains('hidden'))return;lab.classList.add('hidden');if(!document.querySelector('.overlay:not(.hidden)'))document.body.classList.remove('modal-open');labFocus?.focus?.({preventScroll:true})}
 function openLab(name,team,context){
  const a=model.analyse(name),rows=model.rank(source().rows),r=rows.find(x=>x.player===name&&x.team===team),rank=r?.rank||'—';labFocus=document.activeElement;
  let host=$('#lexiconLab');if(!host){host=document.createElement('div');host.id='lexiconLab';host.className='overlay hidden lexicon-lab';document.body.append(host)}
  const metric=(label,value,detail='')=>'<div class="lab-metric"><span>'+label+'</span><b>'+value+'</b>'+(detail?'<small>'+detail+'</small>':'')+'</div>';
  const patternList=(items)=>items.length?items.map(x=>'<span class="lexicon-token">'+esc(x.pattern.toUpperCase())+' <small>+'+x.points+'</small></span>').join(''):'<span class="small-note">No bonus. The alphabet remains unmoved.</span>';
  host.innerHTML='<div class="overlay-backdrop" data-lexicon-close></div><aside class="profile-sheet"><button type="button" class="close-btn" data-lexicon-close aria-label="Close BETTER Player Lab">×</button><div class="overlay-title"><div class="kicker">BETTER Player Lab</div><h2>'+esc(name)+'</h2><p>'+teamName(team)+' – '+esc(context)+'</p></div><section class="lab8-hero lexicon-hero"><div class="lab8-power"><div><span>Ultra</span><strong>'+a.score+'</strong></div><div><span>Name rank</span><strong>#'+rank+'</strong></div></div></section><div class="lexicon-metrics">'+metric('Alphabet rent',a.letters+' letters','Every letter pays its way.')+metric('Originality department',a.unique+' unique',a.repeats+' repeat letters under investigation.')+metric('Real estate',a.spaces+' spaces','Location, location, punctuation.')+metric('Opening statement',(a.parts.find(x=>x.key==='initial').letter||'—').toUpperCase(),'First impressions are legally binding.')+'</div><section class="lab-panel"><h3>Letter portfolio</h3><div class="lexicon-tiles">'+a.letterRows.map(x=>'<span><b>'+esc(x.letter.toUpperCase())+'</b><small>'+x.value+'</small><em>×'+x.count+'</em></span>').join('')+'</div></section><section class="lab-panel"><h3>Digraph holdings</h3><div class="lexicon-patterns">'+patternList(a.digraphs)+'</div><h3>Trigraph inheritance</h3><div class="lexicon-patterns">'+patternList(a.trigraphs)+'</div></section><section class="lab-panel"><h3>Scouting report</h3><p>'+esc(a.trigraphs.length?'Generational three-letter chemistry. The naming committee is trembling.':a.digraphs.length?'Promising two-letter partnerships. A trigraph transfer could change everything.':'A solo-letter specialist. Refuses to play combinations.')+'</p><p class="small-note">No rackets were consulted in the making of this ranking.</p></section></aside><aside class="profile-match-explorer" aria-label="Score breakdown"><h3>Score Explorer</h3><p>Every point, accounted for.</p><div class="lexicon-breakdown">'+a.parts.map(x=>'<div><span>'+x.label+(x.count!=null?'<small>'+x.count+(x.rate?' × '+x.rate:'')+'</small>':'')+'</span><b>+'+x.points+'</b></div>').join('')+'<div class="lexicon-total"><b>Total Ultra</b><strong>'+a.score+'</strong></div></div><p class="small-note">A scientifically unnecessary amount of detail.</p></aside>';
  host.classList.remove('hidden');eightRaise(host);document.body.classList.add('modal-open');host.querySelector('.close-btn').focus();
 }
 document.addEventListener('click',e=>{const p=e.target.closest('[data-lexicon-player]');if(p){openLab(p.dataset.lexiconPlayer,p.dataset.lexiconTeam,p.dataset.lexiconContext);return}if(e.target.closest('[data-lexicon-close]'))closeLab()});
 document.addEventListener('keydown',e=>{const lab=$('#lexiconLab');if(!lab||lab.classList.contains('hidden'))return;if(e.key==='Escape'){e.preventDefault();closeLab()}if(e.key==='Tab'){const nodes=[...lab.querySelectorAll('button,a[href]')],first=nodes[0],last=nodes.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}}});
 window.addEventListener('brta-module-toggle',sync);
})();
