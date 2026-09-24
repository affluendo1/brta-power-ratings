Warning: truncated output (original token count: 21571)
Total output lines: 425

const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const TEAM_COLOURS={
  aqua:'aqua',azure:'azure',beige:'beige',black:'black',blue:'blue',brown:'brown',
  burgundy:'burgundy',charcoal:'charcoal',coral:'coral',cream:'cream',crimson:'crimson',
  cyan:'cyan',gold:'gold',golden:'gold',gray:'gray',grey:'gray',green:'green',indigo:'indigo',
  lime:'lime',magenta:'magenta',maroon:'maroon',navy:'navy',orange:'orange',pink:'pink',
  purple:'purple',red:'red',scarlet:'scarlet',silver:'silver',tan:'tan',teal:'teal',
  turquoise:'turquoise',violet:'violet',white:'white',yellow:'yellow'
};
const TEAM_COLOUR_WORDS=new RegExp('\\b('+Object.keys(TEAM_COLOURS).join('|')+')\\b','gi');
function teamName(name){return esc(name).replace(TEAM_COLOUR_WORDS,word=>'<span class="team-colour team-colour-'+TEAM_COLOURS[word.toLowerCase()]+'">'+word+'</span>')}
let D=null,singles=[],dinds=[],pairs=[],teams=[];
let viewCatalog=DATA.catalog||[],historyCatalog=null,historyCatalogPromise=null,activeHistorySeasonId=null;
let showProv=localStorage.getItem('brta-show-provisional')==='1';
let ratingScope=localStorage.getItem('brta-rating-scope')||'section';
let theme=localStorage.getItem('brta-theme')||'auto',interfaceMode=localStorage.getItem('brta-interface')||'future',accent=localStorage.getItem('brta-accent')||'yellow',profilePosition=localStorage.getItem('brta-profile-position')||'right';
let ratingView='singles',resultRound=null,selectedMatch=null,selectedPrediction=null,activeProfilePlayer=null,loadingToken=0,roundSimulations={};
const BAND_NAMES=['Apex','Elite','Strong','Middle Class','Developing','Weak','Basement'];
const ratingInfo={
  singles:['Singles ratings','Opponent-adjusted singles power. Minimum 4 completed singles rubbers for a ranked position.'],
  pairs:['Doubles pair ratings','Each recurring partnership is one rating entity. Minimum 2 mat…20571 tokens truncated…w=b.dataset.rating;if(ratingView==='pairs'&&ratingScope==='all'){ratingScope='section';localStorage.setItem('brta-rating-scope',ratingScope);$('#searchScope').value=ratingScope}$$('.subtab').forEach(x=>x.classList.toggle('active',x===b));renderRatings()});
$('#search').oninput=renderRatings;$('#teamFilter').onchange=renderRatings;$('#searchScope').onchange=e=>{ratingScope=e.target.value;localStorage.setItem('brta-rating-scope',ratingScope);if(ratingScope==='all'&&ratingView==='pairs'){ratingView='singles';$$('.subtab').forEach(x=>x.classList.toggle('active',x.dataset.rating==='singles'))}renderRatings()};$('#analyticsBtn').onclick=openAnalytics;$('#analyticsClose').onclick=()=>close('#analyticsOverlay');$('#roundBtn').onclick=openRound;$('#settingsBtn').onclick=openSettings;$('#exportSectionBtn').onclick=exportSectionCSV;
$('#profileClose').onclick=()=>close('#profileOverlay');$('#roundClose').onclick=()=>close('#roundOverlay');$('#settingsClose').onclick=()=>close('#settingsOverlay');$('#resultClose').onclick=()=>close('#resultOverlay');
$('#predictionClose').onclick=()=>close('#predictionOverlay');$('#sosClose').onclick=()=>close('#sosOverlay');
document.addEventListener('keydown',e=>{if(e.key==='Escape')$$('.overlay:not(.hidden)').forEach(o=>close('#'+o.id))});
async function startApp(){applyProfilePosition();viewCatalog=DATA.catalog||[];setupSelectors();$('#searchScope').value=ratingScope;showSyncToast();const saved=readHistorySelection();if(!saved){await loadSection(choiceValue('sectionSelect'));ensureHistoryCatalog();return}const catalog=await ensureHistoryCatalog(),season=catalog?.seasons.find(x=>x.id===saved.seasonId),section=season?.sections.find(x=>x.section_code===saved.sectionCode);if(season&&section){activeHistorySeasonId=season.id;viewCatalog=season.sections;setupSelectors();await loadSection(section.section_code)}else{activeHistorySeasonId=null;viewCatalog=DATA.catalog||[];setupSelectors();await loadSection(choiceValue('sectionSelect'))}}
startApp();
