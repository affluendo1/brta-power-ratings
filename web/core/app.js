function disciplineCompare(a,b){const first=localStorage.getItem('brta-discipline-order')||'doubles';const kind=r=>/doubles/i.test(r.type||r.label||'')?'doubles':'singles';return Number(kind(a)!==first)-Number(kind(b)!==first)||String(a.position||a.label||'').localeCompare(String(b.position||b.label||''),undefined,{numeric:true})}
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const TEAM_COLOURS={
  aqua:'aqua',azure:'azure',beige:'beige',black:'black',blue:'blue',brown:'brown',
  burgundy:'burgundy',charcoal:'charcoal',coral:'coral',cream:'cream',crimson:'crimson',
  cyan:'cyan',gold:'gold',golden:'gold',gray:'gray',grey:'gray',green:'green',indigo:'indigo',
  lime:'lime',magenta:'magenta',maroon:'maroon',moorleigh:'gray',navy:'navy',orange:'orange',pink:'pink',
  purple:'purple',red:'red',scarlet:'scarlet',silver:'silver',tan:'tan',teal:'teal',
  turquoise:'turquoise',violet:'violet',white:'white',yellow:'yellow'
};
const TEAM_COLOUR_WORDS=new RegExp('\\b('+Object.keys(TEAM_COLOURS).join('|')+')\\b','gi');
function teamName(name){return esc(name).replace(TEAM_COLOUR_WORDS,(word,_group,offset,text)=>word.toLowerCase()==='black'&&/^\s+Rock\b/i.test(text.slice(offset+word.length))?word:'<span class="team-colour team-colour-'+TEAM_COLOURS[word.toLowerCase()]+'">'+word+'</span>')}
function normaliseTeamLabels(value){if(Array.isArray(value)){value.forEach(normaliseTeamLabels);return value}if(!value||typeof value!=='object')return value;for(const [key,item] of Object.entries(value)){if(['team','home','away','home_team','away_team','winner'].includes(key)&&typeof item==='string')value[key]=item.replace(/\s+\d+\.\d{2}\s*$/,'');else normaliseTeamLabels(item)}return value}
let D=null,singles=[],dinds=[],pairs=[],teams=[];
let committedCatalog=null,committedHistorySeason=null;
let viewCatalog=DATA.catalog||[],historyCatalog=null,historyCatalogPromise=null,activeHistorySeasonId=null;
const archiveGlobalRowsCache=new Map();
let playerSearchIndex=null,playerSearchPromise=null,playerSearchError=null,historySearchLimit=100,historySearchQuery='';
let showProv=localStorage.getItem('brta-show-provisional')==='1';
let ratingScope=localStorage.getItem('brta-rating-scope')||'section';
let theme=localStorage.getItem('brta-theme')||'auto',interfaceMode=localStorage.getItem('brta-interface')||'future',accent=localStorage.getItem('brta-accent')||'yellow',profilePosition=localStorage.getItem('brta-profile-position')||'right';
let ratingRound=null,focusedSearchPlayer=null;
let ratingView='singles',resultRound=null,selectedMatch=null,selectedPrediction=null,activePredictionMatch=null,activeProfilePlayer=null,loadingToken=0,roundSimulations={};
let activePage='results',auxiliaryCache=null,auxiliaryCacheKey='',auxiliaryRevealTimer=0,auxiliaryRevealKey='',auxiliaryReadyKey='',auxiliaryFadeKey='';
const BAND_NAMES=['Apex','Elite','Advanced','Strong','Middle Class','Developing','Struggling','Basement'];
const ratingInfo={
  singles:['Singles ratings','Singles Power · 4 matches to rank.'],
  pairs:['Doubles pair ratings','Partnership Power · 2 matches to rank.'],
  doublesPlayers:['Individual doubles ratings','Individual Doubles Power · partner-adjusted.'],
  overall:['Overall ratings','Singles and Individual Doubles, equally weighted.']
};

function resolvedDark(){return theme==='dark'||theme==='black-plus'||(theme==='auto'&&matchMedia('(prefers-color-scheme: dark)').matches)}
function competitionLabel(code){if(code==='LOCAL')return 'My sections';return ({AA:'Saturday AM',AP:'Saturday PM',UA:'Sunday AM',TA:'Tuesday AM',TN:'Tuesday Night',WA:'Wednesday AM',HA:'Thursday AM'})[code]||'Competition'}
function sectionCompetitionLabel(section){return section?.competition_label||competitionLabel(section?.competition_code)}
function historySeasonSections(season){return(season?.sections||[]).map(section=>({...section,competition_code:section.competition_code||season.competition_code,competition_label:section.competition_label||season.competition_label||competitionLabel(section.competition_code||season.competition_code),season_id:section.season_id||season.season_id,season_label:section.season_label||season.season_label}))}
function applyTheme(){const root=document.documentElement;root.dataset.theme=theme;root.dataset.accent=accent;root.dataset.interface=interfaceMode;const dark=resolvedDark();root.style.backgroundColor='';root.style.colorScheme=dark?'dark':'light';const color=getComputedStyle(root).getPropertyValue('--chrome-color').trim(),chrome=window.CSS?.supports('color',color)?color:(interfaceMode==='future'?(dark?'#101109':'#f3f2e9'):'#173f63');$('#themeColor').content=chrome}
applyTheme();matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change',()=>{if(theme==='auto')applyTheme()});
function fmtTime(iso){if(!iso)return'Not available';return new Date(iso).toLocaleString('en-AU',{day:'numeric',month:'short',hour:'numeric',minute:'2-digit'})}
function personButton(name){return '<button class="person" data-player="'+esc(name)+'">'+esc(name)+'</button>'}
function globalPersonButton(row){return '<button class="person" data-global-player="'+esc(row.player)+'" data-section-code="'+esc(row.sectionCode)+'" data-season-key="'+esc(row.seasonKey||activeHistorySeasonId||'')+'">'+esc(row.player)+'</button>'}
function resultPerson(name,label=name){const known=singles.some(x=>x.player===name)||dinds.some(x=>x.player===name);return known?'<button class="person" data-player="'+esc(name)+'">'+esc(label)+'</button>':esc(label)}
function close(id){const overlay=$(id);if(!overlay)return;overlay.classList.add('hidden');if(id==='#profileOverlay')$('#profileMatchExplorer')?.classList.add('hidden');if(!document.querySelector('.overlay:not(.hidden)'))document.body.classList.remove('modal-open')}
function switchPage(page){activePage=page;if(page!=='ratings')cancelAuxiliaryReveal();$$('.main-tab').forEach(b=>b.classList.toggle('active',b.dataset.page===page));$$('.page').forEach(p=>p.classList.toggle('active',p.id==='page-'+page))}

function auxiliaryEnabled(){return !!window.AuxiliaryPortal?.isUnlocked?.()}
function auxiliarySectionEligible(){return !!(D&&window.AuxiliaryModule?.isHighestSundaySection(D.meta,viewCatalog))}
function auxiliaryState(){return{extras:auxiliaryEnabled(),page:activePage,scope:ratingScope,view:ratingView,team:$('#teamFilter')?.value||'',query:$('#search')?.value||'',section:D?.meta,sections:viewCatalog}}
function auxiliarySignature(state=auxiliaryState()){return [D?.meta?.season_id,D?.meta?.section_code,state.extras,state.page,state.scope,state.view,state.team,String(state.query).trim()].join('|')}
function cancelAuxiliaryReveal(){if(auxiliaryRevealTimer)clearTimeout(auxiliaryRevealTimer);auxiliaryRevealTimer=0;auxiliaryRevealKey='';auxiliaryReadyKey='';auxiliaryFadeKey=''}
function auxiliaryContext(){
  const state=auxiliaryState();if(!window.AuxiliaryModule?.discoveryState(state))return null;
  const key=[D?.meta?.season_id,D?.meta?.section_code].join('|');
  if(!auxiliaryCache||auxiliaryCacheKey!==key){auxiliaryCache=window.AuxiliaryModule.buildContext(D);auxiliaryCacheKey=key}
  return auxiliaryCache;
}
function auxiliaryVisibleContext(){
  const state=auxiliaryState(),module=window.AuxiliaryModule;
  if(!module?.discoveryState(state)){cancelAuxiliaryReveal();return null}
  const key=auxiliarySignature(state);
  if(module.delayedAlias(state.query)){
    if(auxiliaryReadyKey===key)return auxiliaryContext();
    if(auxiliaryRevealKey!==key){
      cancelAuxiliaryReveal();auxiliaryRevealKey=key;
      auxiliaryRevealTimer=setTimeout(()=>{if(auxiliarySignature()===key&&module.discoveryState(auxiliaryState())){auxiliaryRevealTimer=0;auxiliaryReadyKey=key;auxiliaryFadeKey=key;renderRatings();setTimeout(()=>{if(auxiliaryFadeKey===key)auxiliaryFadeKey=''},350)}},700);
    }
    return null;
  }
  cancelAuxiliaryReveal();return auxiliaryContext();
}
function auxiliaryPlayer(name){return name===window.AuxiliaryModule?.CANONICAL&&!!auxiliaryCache&&auxiliaryCacheKey===[D?.meta?.season_id,D?.meta?.section_code].join('|')&&auxiliaryEnabled()&&!!window.AuxiliaryModule?.discoveryState(auxiliaryState())}

function csvCell(value){const text=String(value??'');return'"'+text.replace(/"/g,'""')+'"'}
function exportSectionCSV(){
  if(!D?.meta)return;
  const header=['record_type','competition','section','date','round','status','home_team','away_team','home_points','away_points','home_rubbers','away_rubbers','home_games','away_games','rubber_type','rubber_position','home_players','away_players','winner','score'];
  const rows=[header];
  for(const round of D.results||[])for(const fixture of round.fixtures||[]){
    const base=['Fixture',D.meta.competition_label,D.meta.section_label,fixture.date??round.date,fixture.round??round.round,fixture.status,fixture.home,fixture.away,fixture.homePoints,fixture.awayPoints,fixture.homeRubbers,fixture.awayRubbers,fixture.homeGames,fixture.awayGames,'','','','','',''];
    rows.push(base);
    for(const rubber of (fixture.rubbers||[]).slice().sort((a,b)=>disciplineCompare(a,b)))rows.push(['Rubber',D.meta.competition_label,D.meta.section_label,fixture.date??round.date,fixture.round??round.round,fixture.status,fixture.home,fixture.away,fixture.homePoints,fixture.awayPoints,fixture.homeRubbers,fixture.awayRubbers,fixture.homeGames,fixture.awayGames,rubber.type,rubber.position,rubber.home,rubber.away,rubber.winner,rubber.score]);
  }
  const csv=rows.map(row=>row.map(csvCell).join(',')).join('\r\n');
  const filename=(D.meta.competition_label+'-'+D.meta.section_label+'-results').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')+'.csv';
  const url=URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'})),link=document.createElement('a');
  link.href=url;link.download=filename;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}

function downloadFile(contents, filename, type){
  const url=URL.createObjectURL(new Blob([contents],{type})),link=document.createElement('a');
  link.href=url;link.download=filename;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function exportModelAudit(){
  if(!D?.meta)return;
  const rubbers=(D.results||[]).flatMap(round=>(round.fixtures||[]).flatMap(fixture=>(fixture.rubbers||[]).slice().sort((a,b)=>disciplineCompare(a,b)).map(rubber=>({
    fixture_id:fixture.fixtureId,date:fixture.date??round.date,round:fixture.round??round.round,status:fixture.status,
    home_team:fixture.home,away_team:fixture.away,...rubber
  }))));
  const original=D.meta.predictionModel==='RM1',legacy=D.meta.predictionModel==='RM2';
  const audit={
    export_type:'BRTA Power Ratings calculation audit',
    generated_at:new Date().toISOString(),
    disclaimer:D.meta.is_custom?'Custom section calculated from locally entered scorecards.':'Unofficial analysis. Official-as-entered TROLS scorecards are the source data.',
    section:D.meta,
    model:{
      version:D.meta.modelChoice||D.meta.predictionModel||(D.meta.ratingModel==='V3B'?'RM3b':'RM3'),rating_parameters:original?{gameScale:1,C:.5,l2:2,fitIntercept:false,singlesOnly:true}:D.rm4?BRTARM4.config[D.rm4.base]:legacy?{gameScale:.75,matchScale:.55,matchWeight:1.8,l2:.75,roundDecay:.9}:{gameScale:.75,l2:5},prediction_calibration:D.rm4?window.BRTARM4Frozen?.ensemble:null,
      ...(D.meta.ratingModel==='V3B'?{evidence_weights:D.meta.ratingWeights,match_tiebreak_evidence:'2 total game-equivalent units split by points won',uncertainty:'Approximate Hessian uncertainty for correlated composite evidence'}:{}),
      game_probability:original?'logistic(beta_i - beta_j); equivalently 1 / (1 + 10^(-(R_i - R_j) / 400))':D.rm4?'logistic(latent gap); native tiebreak point log-odds = 0.4 * gap':'logistic((theta_i - theta_j) / 0.75)',
      score_likelihood:original?'games_for * log(p) + games_against * log(1 - p)':legacy?'Game likelihood plus 1.8 times match-outcome likelihood':D.rm4?(D.rm4.base==='RM4a'?'Stopped tennis score likelihood with bounded outcome-only tiebreaks':'Games plus 0.25 times set/match evidence, with bounded match-tiebreak evidence'):D.meta.ratingModel==='V3B'?'weighted_home_evidence * log(p) + weighted_away_evidence * log(1 - p)':'games_for * log(p) + games_against * log(1 - p)',
      uncertainty:original?'Not estimated in Rating 1.0':'See model methodology',
      match_date_weight:original?'1 (no date or round weighting)':legacy?'0.90^(latest_round - round)':'2^(-age_days / 365)',
      regularisation:original?'Sum-form negative log likelihood + (1 / (2 * C)) * sum(beta_i^2), C=0.5':legacy?'L2 penalty: (0.75 / 2) * sum(theta_i^2)':D.rm4?'Correlated singles/doubles Gaussian prior; see rating_parameters':'L2 penalty: (5 / 2) * sum(theta_i^2)',
      ...(D.meta.automatic?{automatic_policy:{ratings:'RM3',live_forecasts:'RM4.1 Ensemble',version:1},rating_parameters:{gameScale:.75,l2:5},game_probability:'RM3 logistic(theta gap / 0.75); live forecasts use the frozen Ensemble',score_likelihood:'Singles and doubles game likelihood; RM3 rules',regularisation:'L2 penalty: (5 / 2) * sum(theta_i^2)'}:{}),
      displayed_power:(D.meta.ratingCentre??2000)+' + '+(D.meta.ratingScale||(D.rm4?450:600))+' * fitted strength',
      publication_thresholds:{singles:'4 completed singles rubbers',doubles_pairs:'2 matches',individual_doubles:'4 appearances, 2 distinct partners and identifiable network position (Rubbers sections show partner-dependent evidence)'}
    },
    source_rubbers:rubbers,
    singles_match_observations:(D.singlesMatches||[]).map(([round,date,player,opponent,games_for,games_against,winner,score,fixture_id])=>({round,date,fixture_id,player,opponent,games_for,games_against,winner,score})),
    fitted_outputs:{singles:D.singles,doubles_pairs:D.doubles,individual_doubles:D.doublesIndividuals,overall:overallData()},
    notes:[D.note,'Ratings are fitted across each result network; this export includes the entered observations, stated objective and published fitted values.'].filter(Boolean)
  };
  const filename=(D.meta.competition_label+'-'+D.meta.section_label+'-rating-model-audit').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')+'.json';
  downloadFile(JSON.stringify(audit,null,2),filename,'application/json;charset=utf-8');
}

function choiceValue(id){return $('#'+id).dataset.value||''}
function closeChoices(except){$$('.section-choice.open').forEach(x=>{if(x.id!==except){x.classList.remove('open');x.querySelector('.choice-trigger').setAttribute('aria-expanded','false')}})}
function renderChoice(id, options, selected){
  const trigger=$('#'+id),menu=$('#'+id.replace('Select','Options')),choice=trigger.closest('.section-choice');
  const chosen=options.find(x=>x[0]===selected)||options[0];
  trigger.dataset.value=chosen?.[0]||'';trigger.querySelector('span').textContent=chosen?.[1]||'No options';
  menu.innerHTML=options.map(([value,label])=>'<button type="button" role="option" class="choice-option '+(value===trigger.dataset.value?'selected':'')+'" aria-selected="'+(value===trigger.dataset.value)+'" data-choice-id="'+id+'" data-choice-value="'+esc(value)+'"><i aria-hidden="true">✓</i><span>'+esc(label)+'</span></button>').join('');
  trigger.onclick=()=>{const open=!choice.classList.contains('open');closeChoices(choice.id);choice.classList.toggle('open',open);trigger.setAttribute('aria-expanded',String(open))};
}
function currentCatalog(){return [...(DATA.catalog||[]),...(window.CustomSections?.catalog()||[])]}
function setupSelectors(){
  const comps=[...new Map(viewCatalog.map(x=>[x.competition_code,sectionCompetitionLabel(x)])).entries()];
  const saved=activeHistorySeasonId?historySectionCode():(layoutDefaultCode()||localStorage.getItem('brta-section')),available=viewCatalog.some(x=>x.section_code===saved);
  const code=available?saved:(activeHistorySeasonId?viewCatalog[0]?.section_code:DATA.defaultSectionCode);
  const meta=viewCatalog.find(x=>x.section_code===code)||viewCatalog[0];
  if(!meta)return;
  renderChoice('competitionSelect',comps.map(([c,l])=>[c,String(l).replace(' - ',' · ')]),meta.competition_code);
  fillSections(meta.competition_code,code);

}
function fillSections(comp,selected){
  const list=viewCatalog.filter(x=>x.competition_code===comp);
  const code=list.some(x=>x.section_code===selected)?selected:list[0]?.section_code;
  renderChoice('sectionSelect',list.map(x=>[x.section_code,x.section_label]),code);
  return code;
}
async function loadSection(code,preloadedPayload=null){
  cancelAuxiliaryReveal();const token=++loadingToken,meta=viewCatalog.find(x=>x.section_code===code);
  $('#sectionSubtitle').textContent=(meta?.competition_label||'').replace(' - ',' · ')+' · '+(meta?.section_label||'Loading…');
  document.body.classList.add('section-loading');
  try{
    const dataPath=meta?.data_path||('data/site/sections/'+code+'.json');
    const payload=preloadedPayload||(meta?.is_custom?window.CustomSections.payload(code):await fetch(dataPath+'?v='+encodeURIComponent(DATA.globalSync.checkedAt||''),{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('Section data could not be loaded');return r.json()}));
    if(token!==loadingToken)return false;
    const next=await layoutApplyModel(meta?.is_custom?payload:normaliseTeamLabels(payload));if(token!==loadingToken)return false;
    if(meta?.is_custom)ratingScope='section';committedCatalog=viewCatalog;committedHistorySeason=activeHistorySeasonId;ratingRound=null;$$('.overlay:not(.hidden)').filter(o=>o.id!=='settingsOverlay'&&o.id!=='layoutOverlay').forEach(o=>{if(o.id)close('#'+o.id)});D=next;lab8Context=null;window.eightBandFilter='';focusedSearchPlayer=null;singles=D.singles||[];dinds=D.doublesIndividuals||[];pairs=D.doubles||[];teams=D.teams||[];
    if(activeHistorySeasonId){const selection={seasonId:activeHistorySeasonId,sectionCode:code};localStorage.setItem('brta-history-selection',JSON.stringify(selection))}else{localStorage.removeItem('brta-history-selection');localStorage.setItem('brta-section',code);}
    resultRound=D.results?.[0]?.round??null;selectedMatch=null;selectedPrediction=null;activePredictionMatch=null;roundSimulations={};
    renderChoice('competitionSelect',[...new Map(viewCatalog.map(x=>[x.competition_code,sectionCompetitionLabel(x).replace(' - ',' · ')])).entries()],D.meta.competition_code);fillSections(D.meta.competition_code,code);
    $('#sectionSubtitle').textContent=D.meta.competition_label.replace(' - ',' · ')+' · '+D.meta.section_label;
    window.CustomSections?.bindHeader(D.meta?.is_custom?code:null);renderAll();return true;
  }catch(error){if(token!==loadingToken)return false;if(D){if(committedCatalog){viewCatalog=committedCatalog;activeHistorySeasonId=committedHistorySeason;}$('#sectionSubtitle').textContent=D.meta.competition_label.replace(' - ',' · ')+' · '+D.meta.section_label;renderChoice('competitionSelect',[...new Map(viewCatalog.map(x=>[x.competition_code,sectionCompetitionLabel(x)])).entries()],D.meta.competition_code);fillSections(D.meta.competition_code,D.meta.section_code);}$('#statusStrip').innerHTML='<div class="notice"><b>Could not load this section.</b><span>'+esc(error.message)+'</span></div>';return false}
  finally{if(token===loadingToken)document.body.classList.remove('section-loading')}
}

function statusStrip(){const sync=D.sync||{},version=window.BRTAChangelog?.version||'8.2';$('#statusStrip').innerHTML='<div><b>Last checked</b><span>'+esc(fmtTime(sync.checkedAt))+'</span></div><button type="button" data-layout-open="history"><b>History</b><span>Browse seasons</span></button><button type="button" data-changelog-open><b>Version</b><span>'+esc(version)+'</span></button><button type="button" data-layout-settings><b>Rating model</b><span>'+selectedRatingModel()+'</span></button>';}

function showSyncToast(){const s=DATA.globalSync||{},check=s.checkedAt;if(!check||localStorage.getItem('brta-sync-toast-seen')===check)return;localStorage.setItem('brta-sync-toast-seen',check);const fresh=!!s.newResultsLastCheck,title=fresh?'Results refreshed':'Results checked',message=fresh?'Official results changed, so the ratings and match pages have been refreshed across the BRTA competitions.':'The latest check found no new official results. Everything already published remains up to date.';const toast=document.createElement('div');toast.className='sync-toast '+(fresh?'updated':'checked');toast.innerHTML='<div class="sync-toast-icon">'+(fresh?'✓':'i')+'</div><div><b>'+title+'</b><p>'+message+'</p></div><button class="sync-toast-close" aria-label="Close update">×</button>';const end=()=>{toast.classList.add('leaving');setTimeout(()=>toast.remove(),220)};toast.querySelector('button').onclick=end;$('#syncToastHost').appendChild(toast);setTimeout(end,10000)}
function teamOptions(){
  const selected=$('#teamFilter').value,names=[...new Set([...singles,...dinds,...pairs].map(x=>x.team).filter(Boolean))].sort();
  if(auxiliaryEnabled()&&auxiliarySectionEligible())names.splice(0,names.length,...window.AuxiliaryModule.teamChoices(names,true));
  $('#teamFilter').innerHTML='<option value="">All teams</option>'+names.map(t=>'<option>'+esc(t)+'</option>').join('');
  if(names.includes(selected))$('#teamFilter').value=selected;
}
function overallData(){if(D.meta?.singlesOnly)return [];const sm=new Map(singles.map(x=>[x.player,x])),dm=new Map(dinds.map(x=>[x.player,x]));return[...new Set([...sm.keys(),...dm.keys()])].map(player=>{const s=sm.get(player),d=dm.get(player),both=s&&d;return{player,team:s?.team||d?.team||'',rating:both?Math.round((s.rating+d.rating)/2):(s?.rating||d?.rating||1500),se:both?Math.round(Math.hypot(s.se,d.se)/2):(s?.se||d?.se||0),s,d,qualified:!!(s&&s.matches>=4&&d&&d.qualified)}}).sort((a,b)=>b.rating-a.rating)}
function currentRows(){const rows=BRTAHistory.withMovement(D,ratingView,ratingRound);return {rows,min:ratingView==='pairs'?2:ratingView==='overall'?0:4,type:ratingView==='singles'?'player':ratingView==='pairs'?'pair':ratingView}}
function rankCell(row){const arrow=row.movement>0?'↑':row.movement<0?'↓':'';return '<span class="rank-position">'+(row.rank??'—')+(arrow?' <span class="rank-arrow '+(row.movement>0?'rank-up':'rank-down')+'" aria-label="Moved '+(row.movement>0?'up':'down')+' '+Math.abs(row.movement)+' spots">'+arrow+'</span>':'')+'</span>'}
function movementCell(row){const n=row.movement,cls=n>0?'rank-up':n<0?'rank-down':'rank-still',text=n==null?(row.isNew?'New':'—'):n===0?'0':(n>0?'+':'')+n;return '<td class="rank-movement '+cls+'">'+text+'</td>'+ratingChangeCell(row)}
function ratingPerson(row){return ratingRound==null?personButton(row.player):'<button class="person" data-history-player="'+esc(row.player)+'" data-history-round="'+ratingRound+'">'+esc(row.player)+'</button>'}
function renderRatingRoundNotice(){const box=$('#ratingRoundNotice');box.classList.toggle('hidden',ratingRound==null);box.innerHTML=ratingRound==null?'':'<div><b>After Round '+ratingRound+'</b><span>'+esc(historicalRoundDate(ratingRound))+' · '+esc(ratingInfo[ratingView][0])+'</span></div><button type="button" class="button secondary" data-rating-round="latest">Latest ratings</button>'}

function ratingQualified(x,min,type){if(type==='overall')return x.qualified;if(type==='doublesPlayers')return!!x.qualified;return x.matches>=min}
function bandModel(rows,min,type){return BRTALayoutModel.bands(rows,x=>ratingQualified(x,min,type))}

function renderBandInfo(model){$('#page-ratings').dataset.bandCount=model.names?.length||BAND_NAMES.length;$('#bandInfo').innerHTML=model.bounds.length?'<div class="band-info-head"><b>Performance bands</b></div><div class="band-keys">'+BAND_NAMES.map((n,i)=>'<button type="button" class="band-key b'+i+(window.eightBandFilter==='b'+i?' selected':'')+'" data-band-choice="b'+i+'" aria-pressed="'+(window.eightBandFilter==='b'+i)+'"><i aria-hidden="true"></i><span><b>'+n+'</b><small>'+model.bounds[i]+'</small></span></button>').join('')+'</div>':''}
function bandDivider(cls,model,colspan=10){const i=Number(cls.slice(1));return'<tr class="band-divider '+cls+'"><td colspan="'+colspan+'"><div><i></i><b>'+BAND_NAMES[i]+'</b><span>'+model.bounds[i]+'</span></div></td></tr>'}

function archiveGlobalRowsFromSection(payload,section){
  const singlesByPlayer=new Map((payload.singles||[]).map(row=>[row.player,row])),doublesByPlayer=new Map((payload.doublesIndividuals||[]).map(row=>[row.player,row]));
  return[...new Set([...singlesByPlayer.keys(),...doublesByPlayer.keys()])].map(player=>{
    const s=singlesByPlayer.get(player),d=doublesByPlayer.get(player),both=s&&d;
    return{
      player,team:s?.team||d?.team||'',sectionCode:section.section_code,sectionLabel:payload.meta?.section_label||section.section_label,
      competitionCode:payload.meta?.competition_code||section.competition_code,competitionLabel:payload.meta?.competition_label||section.competition_label||competitionLabel(section.competition_code),
      singlesRating:s?.rating,singlesSe:s?.se,singlesMatches:s?.matches,singlesWins:s?.wins,singlesLosses:s?.losses,singlesGf:s?.gf,singlesGa:s?.ga,
      doublesRating:d?.rating,doublesSe:d?.se,doublesMatches:d?.matches,doublesWins:d?.wins,doublesLosses:d?.losses,doublesGf:d?.gf,doublesGa:d?.ga,doublesQualified:!!d?.qualified,doublesStatus:d?.ranking_status,
      overallRating:both?Math.round((s.rating+d.rating)/2):(s?.rating??d?.rating??null),overallSe:both?Math.round(Math.hypot(s.se||0,d.se||0)/2):(s?.se??d?.se??null),overallQualified:!!(s&&s.matches>=4&&d?.qualified)
    };
  });
}
function archiveGlobalRows(){
  const seasonId=activeHistorySeasonId;if(!seasonId)return null;
  let entry=archiveGlobalRowsCache.get(seasonId);if(entry)return entry;
  entry={rows:null,error:null};
  entry.promise=Promise.all(viewCatalog.map(section=>fetch(section.data_path+'?v='+encodeURIComponent(DATA.globalSync.checkedAt||''),{cache:'no-store'}).then(response=>{if(!response.ok)throw Error('One or more archived sections could not be loaded.');return response.json()}).then(payload=>archiveGlobalRowsFromSection(normaliseTeamLabels(payload),section)))).then(groups=>{entry.rows=groups.flat();return entry.rows}).catch(error=>{entry.error=error;return[]});
  entry.promise.then(()=>{if(activeHistorySeasonId===seasonId&&ratingScope==='all')renderRatings()});
  archiveGlobalRowsCache.set(seasonId,entry);
  return entry;
}
function primeArchiveGlobalRows(){if(activeHistorySeasonId)archiveGlobalRows()}
function globalRatingRows(rows=DATA.globalPlayers||[]){
  if(!activeHistorySeasonId&&window.CustomSections)rows=rows.concat(window.CustomSections.catalog().flatMap(meta=>archiveGlobalRowsFromSection(window.CustomSections.payload(meta.section_code),meta)));
  rows=layoutSearchRatings(rows);
  if(ratingView==='singles')return rows.filter(x=>x.singlesRating!=null).map(x=>({...x,rating:x.singlesRating,se:x.singlesSe,matches:x.singlesMatches,wins:x.singlesWins,losses:x.singlesLosses,gf:x.singlesGf,ga:x.singlesGa,qualified:x.singlesMatches>=4,type:'player'}));
  if(ratingView==='doublesPlayers')return rows.filter(x=>x.doublesRating!=null).map(x=>({...x,rating:x.doublesRating,se:x.doublesSe,matches:x.doublesMatches,wins:x.doublesWins,losses:x.doublesLosses,gf:x.doublesGf,ga:x.doublesGa,qualified:x.doublesQualified,type:'doublesPlayers'}));
  if(ratingView==='overall')return rows.filter(x=>x.overallRating!=null).map(x=>({...x,rating:x.overallRating,se:x.overallSe,qualified:x.overallQualified,type:'overall'}));
  return[];
}
async function ensurePlayerSearchIndex(){
  if(playerSearchIndex)return playerSearchIndex;
  if(!playerSearchPromise){
    playerSearchError=null;
    playerSearchPromise=fetch('data/archive/player-search.json?v='+encodeURIComponent(DATA.globalSync.checkedAt||''),{cache:'no-store'})
      .then(response=>{if(!response.ok)throw Error('The history player index could not be loaded.');return response.json()})
      .then(index=>{if(index.version!==1||!Array.isArray(index.entries)||!Array.isArray(index.players)||!Array.isArray(index.sections))throw Error('The history player index is unavailable.');playerSearchIndex=index;return index})
      .catch(error=>{playerSearchError=error;playerSearchPromise=null;return null})
      .finally(()=>{if(ratingScope==='history')renderRatings()});
  }
  return playerSearchPromise;
}
function renderHistoryPlayerSearch(){
  const query=$('#search').value.trim();
  $('#ratingsTitle').textContent='All history · Player search';
  $('#ratingsDesc').textContent='Find players across every published Saturday and Sunday AM season, including the current season.';
  $('#ratingsHint').textContent='Each result is a separate season and section. Matching names may belong to different people.';
  $('#teamFilter').disabled=true;$('#teamFilter').value='';renderBandInfo({bounds:[]});
  $('#ratingHead').innerHTML='<tr><th>Player</th><th>Team</th><th>Season</th><th>Competition</th><th>Section</th></tr>';
  const message=text=>{$('#ratingBody').innerHTML='<tr><td colspan="5">'+text+'</td></tr>'};
  if(query!==historySearchQuery){historySearchQuery=query;historySearchLimit=100}
  if(!query){message('Type a player name to search all Saturday and Sunday AM history.');return}
  if(playerSearchError){message('Could not load history search. <button type="button" class="button secondary" data-history-search-retry>Try again</button>');return}
  if(!playerSearchIndex){message('Loading the Saturday and Sunday player index…');ensurePlayerSearchIndex();return}
  const rows=BRTAPlayerSearch.find(playerSearchIndex,query),visible=rows.slice(0,historySearchLimit);
  $('#ratingsDesc').textContent=rows.length+' appearance'+(rows.length===1?'':'s')+' found across '+playerSearchIndex.sections.length+' Saturday and Sunday sections.';
  const missing=playerSearchIndex.unavailableSections?.length||0;
  if(missing)$('#ratingsHint').textContent+=' '+missing+' sections have not yet been published and could not be searched.';
  if(!rows.length){message('No player found in the published Saturday and Sunday history. Try a surname or part of the name.');return}
  $('#ratingBody').innerHTML=visible.map(row=>'<tr><td>'+globalPersonButton(row)+'</td><td>'+teamName(row.team)+'</td><td>'+esc(row.seasonOptionLabel||row.seasonLabel)+(row.isCurrent?' <small>Current</small>':'')+'</td><td>'+esc(competitionLabel(row.competitionCode))+'</td><td>'+esc(row.sectionLabel)+'</td></tr>').join('')+
    (rows.length>visible.length?'<tr><td colspan="5"><button class="button secondary" type="button" data-history-search-more>Show next 100</button><span> Showing '+visible.length+' of '+rows.length+' results</span></td></tr>':'');
}
function renderGlobalRatings(){
  const [title,desc]=ratingInfo[ratingView],q=$('#search').value.trim().toLowerCase();
  const archive=activeHistorySeasonId?archiveGlobalRows():null,sectionCount=viewCatalog.length,seasonLabel=activeHistorySeasonId?(viewCatalog[0]?.season_label||D?.meta?.season_label||'selected season'):'current season';
  $('#ratingsTitle').textContent='All sections · '+title;
  $('#ratingsDesc').textContent=desc+' Search spans all '+sectionCount+' sections in '+seasonLabel+'.';
  $('#ratingsHint').textContent='Section ratings are fitted independently and are not cross-section rankings.';
  $('#teamFilter').disabled=true;$('#teamFilter').value='';
  renderBandInfo({bounds:[]});
  if(ratingView==='pairs'){
    $('#ratingHead').innerHTML='<tr><th>All-section player search</th></tr>';
    $('#ratingBody').innerHTML='<tr><td>All-section search is for individual players. Choose Singles, Doubles players or Overall.</td></tr>';
    return;
  }
  if(!q){
    $('#ratingHead').innerHTML='<tr><th>Player</th><th>Team</th><th>Section</th><th>Power</th><th>Record</th><th>Evidence</th><th>Status</th>'+uncertaintyHead()+'</tr>';
    $('#ratingBody').innerHTML='<tr><td colspan="8">Type a player name to search every section in '+esc(seasonLabel)+'.</td></tr>';
    return;
  }
  if(archive?.error){$('#ratingHead').innerHTML='<tr><th>All-section player search</th></tr>';$('#ratingBody').innerHTML='<tr><td>Could not load the selected season’s player index. Please try again.</td></tr>';return}
  if(archive&&!archive.rows){$('#ratingHead').innerHTML='<tr><th>All-section player search</th></tr>';$('#ratingBody').innerHTML='<tr><td>Loading every section from '+esc(seasonLabel)+'…</td></tr>';return}
  const rows=globalRatingRows(archive?.rows).filter(x=>x.player.toLowerCase().includes(q)).sort((a,b)=>{
    const ae=a.player.toLowerCase()===q?0:a.player.toLowerCase().startsWith(q)?1:2;
    const be=b.player.toLowerCase()===q?0:b.player.toLowerCase().startsWith(q)?1:2;
    return ae-be||a.player.localeCompare(b.player)||a.competitionLabel.localeCompare(b.competitionLabel)||a.sectionLabel.localeCompare(b.sectionLabel);
  });
  const sectionCell=x=>'<b>'+esc(x.sectionLabel)+'</b><small class="section-result-comp">'+esc(x.competitionLabel.replace(' - ',' · '))+'</small>';
  let out='';
  for(const x of rows){
    if(ratingView==='overall'){
      const s=x.singlesRating??'—',d=x.doublesRating??'—';
      out+='<tr class="'+(x.qualified?'':'provisional')+'"><td>'+globalPersonButton(x)+'</td><td>'+teamName(x.team)+'</td><td>'+sectionCell(x)+'</td><td><b>'+x.rating+'</b></td><td>'+s+'</td><td>'+d+'</td><td>'+(x.qualified?'Ranked':'Provisional')+'</td>'+uncertaintyCell((x.se??'—'))+'</tr>';
    }else{
      const pct=x.gf+x.ga?(100*x.gf/(x.gf+x.ga)).toFixed(1)+'%':'—',evidence=ratingView==='doublesPlayers'?x.matches+' matches · '+esc(x.doublesStatus||'Provisional'):x.matches+' matches · '+pct;
      out+='<tr class="'+(x.qualified?'':'provisional')+'"><td>'+globalPersonButton(x)+'</td><td>'+teamName(x.team)+'</td><td>'+sectionCell(x)+'</td><td><b>'+x.rating+'</b></td><td>'+x.wins+'–'+x.losses+'</td><td>'+x.gf+'–'+x.ga+'</td><td>'+evidence+'</td>'+uncertaintyCell((x.se??'—'))+'</tr>';
    }
  }
  $('#ratingBody').innerHTML=out||'<tr><td colspan="8">No player found across the '+sectionCount+' sections in '+esc(seasonLabel)+'.</td></tr>';
  $('#ratingHead').innerHTML=ratingView==='overall'
    ?'<tr><th>Player</th><th>Team</th><th>Section</th><th>Overall</th><th>Singles</th><th>Doubles</th><th>Status</th>'+uncertaintyHead()+'</tr>'
    :'<tr><th>Player</th><th>Team</th><th>Section</th><th>Power</th><th>W–L</th><th>Games</th><th>Evidence</th>'+uncertaintyHead()+'</tr>';
}
function uncertaintyCell(se){return D.meta?.hasUncertainty===false?'':'<td>'+(Number.isFinite(se)?'±'+se:'—')+'</td>'}
function uncertaintyHead(){return D.meta?.hasUncertainty===false?'':'<th>Uncertainty</th>'}
function renderRatings(){
  const original=D.meta?.predictionModel==='RM1';$$('[data-rating]').forEach(b=>{b.disabled=original&&b.dataset.rating!=='singles';b.title=b.disabled?'RM1 supports singles only':''});if(original&&ratingView!=='singles'){ratingView='singles';$$('[data-rating]').forEach(b=>b.classList.toggle('active',b.dataset.rating==='singles'))}
  renderRatingRoundNotice();if(ratingScope==='history'){cancelAuxiliaryReveal();renderHistoryPlayerSearch();return}if(ratingScope==='all'){cancelAuxiliaryReveal();renderGlobalRatings();return}
  $('#teamFilter').disabled=false;
  const [title,desc]=ratingInfo[ratingView];$('#ratingsTitle').textContent=title;$('#ratingsDesc').textContent=desc+(ratingRound==null?'':' After Round '+ratingRound+'.');
  $('#ratingFilters').classList.remove('hidden');$('#ratingsHint').textContent='Model: '+selectedRatingModel()+' · Centre '+(D.meta?.ratingCentre??2000);
  const {rows,min,type}=currentRows(),q=$('#search').value.toLowerCase(),tf=$('#teamFilter').value,band=bandModel(rows,min,type),derived=ratingRound==null?auxiliaryVisibleContext():null;
  renderBandInfo(band);
  let rank=0,out='',lastBand='';
  if(derived){
    const fading=auxiliaryFadeKey===auxiliarySignature()?' auxiliary-reveal':'';
    const godly=window.AuxiliaryModule.godlyThreshold(derived.row);
    $('#bandInfo').innerHTML='<div class="band-info-head"><b>Performance bands</b></div><div class="band-keys"><div class="band-key b0"><i></i><span><b>Godly</b><small>≥ '+godly+'</small></span></div>'+BAND_NAMES.map((n,i)=>'<div class="band-key b'+i+'"><i></i><span><b>'+n+'</b><small>'+band.bounds[i]+'</small></span></div>').join('')+'</div>';
    out+='<tr class="band-divider b0"><td colspan="10"><div><i></i><b>Godly</b><span>≥ '+godly+'</span></div></td></tr>';
    out+='<tr class="b0'+fading+'"><td>0</td><td>'+personButton(derived.row.player)+'</td><td>'+teamName(derived.row.team)+'</td><td><b>'+derived.row.rating+'</b></td><td>'+derived.row.wins+'–0</td><td>'+derived.row.gf+'–'+derived.row.ga+'</td><td>'+(derived.row.gf+derived.row.ga?(100*derived.row.gf/(derived.row.gf+derived.row.ga)).toFixed(1)+'%':'—')+'</td><td class="rank-movement rank-still">—</td><td>—</td>'+uncertaintyCell(derived.row.se)+'</tr>';
  }
  for(const x of rows){const qual=ratingQualified(x,min,type);if(qual)rank++;if(!qual&&!showProv&&ratingRound==null&&x.player!==focusedSearchPlayer)continue;if(q&&!x.player.toLowerCase().includes(q))continue;if(tf&&x.team!==tf)continue;const bandCls=band.classFor(x.rating),cls=bandCls+(qual?'':' provisional');if(window.eightBandFilter&&bandCls!==window.eightBandFilter)continue;if(bandCls&&bandCls!==lastBand){out+=bandDivider(bandCls,band,(type==='pair'?11:10)-(original?1:0));lastBand=bandCls}
    const pct=x.gf+x.ga?(100*x.gf/(x.gf+x.ga)).toFixed(1)+'%':'—';
    if(type==='pair'){const pair=lab8OrderedNames(x.player,x.team).map(personButton).join('<button type="button" class="pair-sep person" data-eight-pair="'+esc(x.player)+'" data-eight-round="'+(ratingRound??'')+'" aria-label="Open pair lab"> / </button>'),effect=(x.pairEffect>=0?'+':'')+(x.pairEffect??0);out+='<tr class="'+cls+'"><td>'+rankCell(x)+'</td><td>'+pair+'</td><td>'+teamName(x.team)+'</td><td><b>'+x.rating+'</b></td><td>'+(x.individualAverage??'—')+'</td><td class="'+((x.pairEffect??0)>=0?'performance-above':'performance-below')+'">'+effect+'</td><td>'+(x.wins??'—')+'–'+(x.losses??'—')+'</td><td>'+x.matches+'</td>'+movementCell(x)+''+uncertaintyCell(x.se)+'</tr>'}
    else if(type==='overall')out+='<tr class="'+cls+'"><td>'+rankCell(x)+'</td><td>'+ratingPerson(x)+'</td><td>'+teamName(x.team)+'</td><td><b>'+x.rating+'</b></td><td>'+(x.s?.rating??'—')+'</td><td>'+(x.d?.rating??'—')+'</td><td>'+(qual?'Ranked':'Provisional')+'</td>'+movementCell(x)+''+uncertaintyCell(x.se)+'</tr>';
    else{const evidence=type==='doublesPlayers'?x.matches+' · '+x.partner_count+' partners · '+esc(x.ranking_status):pct;out+='<tr class="'+cls+'"><td>'+rankCell(x)+'</td><td>'+ratingPerson(x)+'</td><td>'+teamName(x.team)+'</td><td><b>'+x.rating+'</b></td><td>'+(x.wins??'—')+'–'+(x.losses??'—')+'</td><td>'+(x.gf??'—')+'–'+(x.ga??'—')+'</td><td>'+evidence+'</td>'+movementCell(x)+''+uncertaintyCell(x.se)+'</tr>'}
  }
  $('#ratingBody').innerHTML=out||'<tr><td colspan="'+((type==='pair'?11:10)-(original?1:0))+'">No matching entries.</td></tr>';
  $('#ratingHead').innerHTML=type==='overall'?'<tr><th>#</th><th>Player</th><th>Team</th><th>Overall</th><th>Singles</th><th>Doubles</th><th>Status</th><th>Movement</th><th>Power Δ</th>'+uncertaintyHead()+'</tr>':type==='pair'?'<tr><th>#</th><th>Pair</th><th>Team</th><th>Pair Power</th><th>Individual avg</th><th>Pair effect</th><th>W–L</th><th>Matches</th><th>Movement</th><th>Power Δ</th>'+uncertaintyHead()+'</tr>':'<tr><th>#</th><th>Player</th><th>Team</th><th>Power</th><th>W–L</th><th>Games</th><th>'+(type==='doublesPlayers'?'Evidence':'Game %')+'</th><th>Movement</th><th>Power Δ</th>'+uncertaintyHead()+'</tr>';
}
function teamInsight(team){return D.teamInsights?.[team]||{completedTies:0,lineupCount:0,lineupStability:null,lineups:[],pairs:[]}}
function recordText(row){return row?(row.wins+'–'+row.losses+(row.draws?'–'+row.draws+' D':'')):'No recorded ties'}
function renderTeams(){BRTATeamLabUI.renderGrid(D)}

function knockoutMatchHTML(match){const score=match.score||((match.homePoints!=null&&match.awayPoints!=null)?match.homePoints+'–'+match.awayPoints:(match.status==='Completed'?'Result':'—')),date=match.date?match.date:'Date not published by TROLS',detail=[match.status&&match.status!=='Completed'&&match.status!=='Projected'?match.status:'',date,match.homeGames!=null&&match.awayGames!=null?match.homeGames+'–'+match.awayGames+' games':'',match.homePoints!=null&&match.awayPoints!=null?match.homePoints+'–'+match.awayPoints+' points':''].filter(Boolean).join(' · ');return'<div class="knockout-match"><span class="knockout-home '+(match.winner===match.home?'knockout-winner':'')+'">'+teamName(match.home)+(match.winner===match.home?' <small>Winner</small>':'')+'</span><b class="knockout-score">'+esc(score)+'</b><span class="knockout-away '+(match.winner===match.away?'knockout-winner':'')+'">'+teamName(match.away)+(match.winner===match.away?' <small>Winner</small>':'')+'</span><small class="knockout-detail">'+esc(detail||'Projected matchup')+'</small></div>'}
function renderKnockout(){const box=$('#knockoutSummary'),k=D.knockout||{};if(!k.source||k.source==='none'){box.innerHTML='';return}const semiRecorded=k.semifinalSource==='TROLS',finalRecorded=k.grandFinalSource==='TROLS',caption=semiRecorded||finalRecorded?'Official results where TROLS has published them':'Projected from the completed 14-round ladder',semiMatches=k.semifinalHistory?.length?k.semifinalHistory:(k.semifinals||[]),finalMatches=k.grandFinalHistory?.length?k.grandFinalHistory:(k.grandFinal?[k.grandFinal]:[]),qualifiers=(k.qualifiers||[]).map(x=>'#'+(x.seed||'—')+' '+x.team).join(' · '),champion=k.champion?'<div class="knockout-crown">Season winner · <b>'+esc(k.champion)+'</b>'+(k.runnerUp?' · Runner-up · '+esc(k.runnerUp):'')+'</div>':'';if(!semiMatches.length&&!finalMatches.length){box.innerHTML='';return}box.innerHTML='<div class="knockout-head"><h2>Knockout draw</h2><small>'+esc(caption)+'</small></div>'+(qualifiers?'<p class="knockout-note">Semifinal qualifiers · '+esc(qualifiers)+'</p>':'')+'<div class="knockout-rounds">'+(semiMatches.length?'<section class="knockout-round"><h3>Semifinals · '+(semiRecorded?'TROLS result':'projected')+'</h3>'+semiMatches.map(knockoutMatchHTML).join('')+'</section>':'')+(finalMatches.length?'<section class="knockout-round knockout-final"><h3>Grand final · '+(finalRecorded?'TROLS result':k.grandFinalSource==='pending'?'awaiting result':'projected')+(finalMatches.length>1?' · published entries':'')+'</h3>'+finalMatches.map(knockoutMatchHTML).join('')+'</section>':'')+'</div>'+champion}
function renderStandings(){const rows=D.standings||[],knockout=D.knockout||{},qualifiers=new Set((knockout.qualifiers||[]).map(x=>x.team)),hasSemis=qualifiers.size>=4||knockout.source==='projected';$('#standingsBody').innerHTML=rows.map((x,i)=>{const position=x.officialPosition||i+1,winCount=x.officialWins??x.wins,percent=x.officialPercentage;const cells=D.meta?.is_archive?'<td>'+esc(winCount??'—')+'</td><td><b>'+esc(x.points)+'</b></td><td>'+((percent==null||Number.isNaN(Number(percent)))?'—':Number(percent).toFixed(2)+'%')+'</td>':'<td>'+x.played+'</td><td>'+x.wins+'</td><td>'+x.draws+'</td><td>'+x.losses+'</td><td>'+x.rubbersFor+'–'+x.rubbersAgainst+'</td><td>'+x.gamesFor+'–'+x.gamesAgainst+'</td><td><b>'+x.points+'</b></td>';const row='<tr class="'+(qualifiers.has(x.team)?'standing-qualifier':'')+'"><td><b>'+position+'</b></td><td><b>'+teamName(x.team)+'</b></td>'+cells+'</tr>';const cut=i===3&&(rows.length>4||hasSemis)?'<tr class="playoff-cut"><td colspan="'+(D.meta?.is_archive?5:9)+'">Semifinal places · top four</td></tr>':'';return row+cut}).join('');$('#standingsHead').innerHTML=D.meta?.is_archive?'<tr><th>Pos</th><th>Team</th><th>TROLS wins</th><th>Final points</th><th>TROLS %</th></tr>':'<tr><th>Pos</th><th>Team</th><th>P</th><th>W</th><th>D</th><th>L</th><th>Rubbers</th><th>Games</th><th>Pts</th></tr>';renderKnockout();const missing=D.sync?.missingFixtures||0;$('#standingsNote').textContent=D.meta?.is_archive?'Final ladder from TROLS':missing?missing+' result'+(missing===1?'':'s')+' missing':'';$('#standingsCaveat').innerHTML=D.meta?.is_archive?(rows.some(x=>x.standingsSource==='TROLS')?'Final position, wins, points and game percentage are recorded from the TROLS past ladder. Match records are reconstructed from published results.':'TROLS did not publish a final ladder for this section; the displayed standings are reconstructed from its results.'):(missing?'<b>Incomplete:</b> TROLS still has '+missing+' result'+(missing===1?'':'s')+' missing a scorecard. ':'All published results are included. ')+'<span>Tied ladder points are ordered by BRTA games percentage; washouts and full-team forfeits use the published 2026 By-Law treatment.</span>';if(D.sync?.sourceWarnings?.length)$('#standingsCaveat').innerHTML+='<br><b>TROLS source discrepancy:</b> '+D.sync.sourceWarnings.map(esc).join(' ')}

function findMatch(id){for(const round of D.results||[]){const match=round.fixtures.find(x=>x.fixtureId===id);if(match)return match}return null}
function matchWinner(match){
  if(match.status==='Forfeited To')return match.away;
  if(match.status==='Forfeited By')return match.home;
  if(match.status!=='Completed')return'';
  const hs=match.homeSets??match.homeRubbers,as=match.awaySets??match.awayRubbers;
  if(hs!==as)return hs>as?match.home:match.away;
  if(match.homeGames!==match.awayGames)return match.homeGames>match.awayGames?match.home:match.away;
  return'';
}
function matchCard(match){
  const complete=match.status==='Completed',scored=match.homePoints!=null&&match.awayPoints!=null,winner=matchWinner(match),homeWon=winner===match.home,awayWon=winner===match.away;
  const homeMeta=complete?(homeWon?'Won · ':'')+match.homePoints+' pts · '+match.homeGames+' games':scored?(homeWon?'Awarded · ':'')+match.homePoints+' pts':'Home';
  const awayMeta=complete?(awayWon?'Won · ':'')+match.awayPoints+' pts · '+match.awayGames+' games':scored?(awayWon?'Awarded · ':'')+match.awayPoints+' pts':'Away';
  const central=complete?match.homeRubbers+'–'+match.awayRubbers:match.status==='Wash Out'?'Washout':match.status==='Forfeited To'||match.status==='Forfeited By'?'Forfeit':match.status;
  return'<button class="result-match" data-match-id="'+esc(match.fixtureId)+'"><span class="result-team '+(homeWon?'won':'')+'"><b>'+teamName(match.home)+'</b><small>'+homeMeta+'</small></span><span class="result-score"><b>'+esc(central)+'</b><small>'+ (complete?'Rubbers':scored?'Team points':'')+'</small></span><span class="result-team '+(awayWon?'won':'')+'"><b>'+teamName(match.away)+'</b><small>'+awayMeta+'</small></span></button>'
}
function roundHeading(round){return round.label||('Round '+round.round)}
function roundDate(value){return value||'Date not published by TROLS'}
function byeCard(f){return'<div class="fixture-bye"><small>BYE</small><b>'+teamName(f.home==='Bye'?f.away:f.home)+'</b><span>No match this round</span></div>'}
function renderResults(){const rounds=D.results||[];if(!rounds.length){$('#resultsList').innerHTML='<div class="notice">No published results yet.</div>';return}$('#resultsList').innerHTML=rounds.map(round=>{const draw=(D.upcomingFixtures||[]).find(r=>r.round===round.round),byes=(draw?.fixtures||[]).filter(f=>f.status==='Bye');return'<section class="result-round"><header class="result-round-head"><h2>'+esc(roundHeading(round))+'</h2><span>'+esc(roundDate(round.date))+'</span></header><div class="result-round-matches">'+round.fixtures.map(matchCard).join('')+byes.map(byeCard).join('')+'</div></section>'}).join('')}
function rubberCode(r){const n=String(r.position||'').match(/\d+/)?.[0]||'';return(r.type==='Doubles'?'D':'S')+n}
function doublesPlayerLabel(name){const parts=String(name).trim().split(/\s+/);return D.meta?.is_custom&&D.meta.doublesSurnames&&parts.length>1?parts.slice(1).join(' '):parts[0]}
function compactDoublesName(name){return String(name).split('/').map(doublesPlayerLabel).join(' / ')}
function resultDetailHTML(match,contextPlayer=null){
  if(!match)return'<div class="notice">This fixture does not have a scorecard yet.</div>';
  const complete=match.status==='Completed',scored=match.homePoints!=null&&match.awayPoints!=null,winner=matchWinner(match),result=complete?match.homeRubbers+'–'+match.awayRubbers:'—',outcome=winner?esc(winner)+(complete?(match.simulated?' wins the team tie':' won the team tie'):' received the team points'):(match.status==='Wash Out'?'The fixture was recorded as a washout':'Team tie level'),pairNames=(name,flags=[])=>String(name).split('/').map((p,i)=>({full:p.trim(),flag:flags[i]})).sort((a,b)=>{const side=String(name)===String(match.rubbers?.find(r=>r.type==='Doubles'&&r.home===name)?.home)?'home':'away',team=match[side],names=lab8OrderedNames(name,team);return names.indexOf(a.full)-names.indexOf(b.full)}).map(({full,flag})=>{return resultPerson(full,doublesPlayerLabel(full))+(flag?'<i class="emergency-marker" title="Emergency player recorded by TROLS">X</i>':'')}).join(' <button type="button" class="pair-sep person" data-eight-pair="'+esc(name)+'" data-eight-round="'+(lab8Context?.round??'')+'" aria-label="Open pair lab">/</button> ');
  let metrics=complete?'<div class="result-metrics"><div><span>Rubbers</span><b>'+match.homeRubbers+'–'+match.awayRubbers+'</b></div><div><span>Games</span><b>'+match.homeGames+'–'+match.awayGames+'</b></div><div><span>Points</span><b>'+(match.homePoints??'—')+'–'+(match.awayPoints??'—')+'</b></div></div>':scored?'<div class="result-metrics"><div><span>Team points</span><b>'+(match.homePoints??'—')+'–'+(match.awayPoints??'—')+'</b></div><div><span>Games</span><b>Not recorded</b></div></div>':'';
  let head='<div class="result-detail-head"><span>'+esc(match.label||('Round '+match.round))+' · '+esc(roundDate(match.date))+'</span><h2>'+teamName(match.home)+' <b>'+result+'</b> '+teamName(match.away)+'</h2><p>'+outcome+(complete?'':' · '+esc(match.status))+'</p>'+metrics+'</div>';
  let rows=(match.rubbers||[]).slice().sort((a,b)=>disciplineCompare(a,b)||(a.order??0)-(b.order??0)).map(r=>{const marker=emergency=>emergency?'<i class="emergency-marker" title="Emergency player recorded by TROLS">X</i>':'',home=(r.type==='Doubles'?pairNames(r.home,r.homeEmergencies||[]):resultPerson(r.home)+marker(r.homeEmergency)),away=(r.type==='Doubles'?pairNames(r.away,r.awayEmergencies||[]):resultPerson(r.away)+marker(r.awayEmergency));return'<div class="rubber-row"><small class="rubber-code" title="'+esc(r.type)+' · '+esc(r.position)+'">'+rubberCode(r)+'</small><b class="rubber-home '+(r.winner===r.home?'winner':'')+'" title="'+esc(r.home)+'">'+home+'</b><strong>'+esc(r.score)+'</strong><b class="rubber-away '+(r.winner===r.away?'winner':'')+'" title="'+esc(r.away)+'">'+away+'</b></div>'}).join('');
  return head+(rows?'<div class="rubber-list">'+rows+'</div>':'<div class="notice">TROLS has not published an individual scorecard for this match.</div>')+(match.simulated?'':historicalMatchContext(match,contextPlayer))
}
function openMatch(id,sourcePlayer=null){const match=findMatch(id);if(match){delete $('#resultOverlay').dataset.simulated;$('#resultOverlay .round84-externalnav')?.remove();$('#resultOverlay .round841-controls')?.remove();selectedMatch=id;$('#resultContent').innerHTML=resultDetailHTML(match,sourcePlayer);eightRaise($('#resultOverlay'));$('#resultOverlay').classList.remove('hidden');document.body.classList.add('modal-open');return}if(auxiliaryPlayer(activeProfilePlayer))openAuxiliaryMatch(auxiliaryCache.matches.find(row=>row.fixtureId===id))}
function renderFixtureRounds(){
  const rounds=D.upcomingFixtures||[];
  $('#fixturesList').innerHTML=rounds.length?rounds.map(r=>'<section class="fixture-round"><div class="fixture-round-head"><h2>'+esc(roundHeading(r))+'</h2><div class="fixture-round-actions"><span>'+esc(roundDate(r.date))+'</span>'+(r.fixtures.some(f=>f.status==='Scheduled'&&!findFixtureResult(f,r.round))?'<button type="button" class="button secondary" data-simulate-round="'+esc(r.round)+'">Simulate round</button>':'')+'</div></div><div class="fixture-list">'+r.fixtures.map(f=>{
    if(f.status==='Bye')return byeCard(f);
    const complete=f.status==='Completed',scored=f.homePoints!=null&&f.awayPoints!=null;
    const middle=complete?f.homeRubbers+'–'+f.awayRubbers:(f.status==='Scheduled'?'v':f.status==='Wash Out'?'Washout':f.status==='Forfeited To'||f.status==='Forfeited By'?'Forfeit':f.status);
    const sub=complete?(f.homePoints+'–'+f.awayPoints+' pts · '+f.homeGames+'–'+f.awayGames+' games'):scored?(f.homePoints+'–'+f.awayPoints+' pts'):(f.status==='Scheduled'?'Scheduled':f.status);
    const result=findFixtureResult(f,r.round),predict=f.status==='Scheduled'&&!result;
    return'<button class="fixture-match '+(complete?'complete':'')+'" '+(predict?'data-predict-id':'data-fixture-result-id')+'="'+esc(f.fixtureId)+'"><span>'+teamName(f.home)+'</span><b>'+esc(middle)+'</b><span>'+teamName(f.away)+'</span><small>'+esc(sub)+' · '+(predict?'Prediction centre':'View result')+'</small></button>'
  }).join('')+'</div>'+(roundSimulations[r.round]||'')+'</section>').join(''):'<div class="notice">No official fixtures are currently published.</div>'
}

function teamRoster(team){if(D.meta?.is_custom)return (D.customRoster||[]).filter(p=>p.team===team||!p.teamId).sort((a,b)=>(a.team!==team)-(b.team!==team)||a.order-b.order||a.name.localeCompare(b.name)).map(p=>({player:p.name,rating:p.rating,averagePosition:p.order,emergencyOnly:!!p.emergency||p.team!==team}));const rows=[...(D.teamOrderEvidence?.[team]?.players||[])],known=new Set(rows.map(x=>x.player));for(const player of [...singles,...dinds])if(player.team===team&&!known.has(player.player)){rows.push({player:player.player,rating:player.rating,averagePosition:'—',emergencyOnly:false});known.add(player.player)}return rows}
function orderLineup(team,selected){const evidence=D.teamOrderEvidence?.[team]||{},edges=evidence.precedence||[],remaining=[...selected],roster=evidence.players||[];const before=(a,b)=>edges.filter(e=>e.above===a&&e.below===b).reduce((n,e)=>n+e.count,0),entry=name=>roster.find(x=>x.player===name),avg=name=>entry(name)?.averagePosition??99,emergency=name=>entry(name)?.emergencyOnly?1:0,out=[];while(remaining.length){remaining.sort((a,b)=>{const incomingA=remaining.filter(x=>x!==a).reduce((n,x)=>n+before(x,a),0),incomingB=remaining.filter(x=>x!==b).reduce((n,x)=>n+before(x,b),0);return emergency(a)-emergency(b)||incomingA-incomingB||before(b,a)-before(a,b)||avg(a)-avg(b)||a.localeCompare(b)});out.push(remaining.shift())}return out}
function isPlayoff(match){return['semi_final','grand_final'].includes(String(match.stage||'').toLowerCase())}
function predictionNeeded(){const r=D.meta?.customRules||D.meta?.competition_rules;return r?Math.max(r.singlesSlots,r.playersPerTeam??(r.doublesSlots?2:0)):(D.format==='rubbers'?2:4)}
function defaultSide(team,needed,beforeRound=null){const recorded=BRTALineups.configurations(D,team,beforeRound)[0];if(recorded)return BRTALineups.side(recorded);if(D.meta?.is_custom||D.meta?.competition_rules){const r=D.meta.customRules||D.meta.competition_rules,roster=teamRoster(team).slice(0,r.playersPerTeam??Math.max(r.singlesSlots,2*r.doublesSlots)).map(x=>x.player),order=orderLineup(team,roster);return {draft:roster,singles:order.slice(0,r.singlesSlots),manualOrder:false,doubles:Array.from({length:r.doublesSlots},(_,i)=>{const pattern=r.singlesSlots===0&&r.doublesSlots===6?[[0,1],[2,3],[0,2],[1,3],[0,3],[1,2]][i]:[2*i%order.length,(2*i+1)%order.length];return pattern.map(j=>order[j]).filter(Boolean)})};}const roster=teamRoster(team).slice(0,needed).map(x=>x.player),order=orderLineup(team,roster);return{draft:roster,singles:order,manualOrder:false,doubles:needed===4?[[order[0],order[1]],[order[2],order[3]]]:[]}}
function predictionState(match){const needed=predictionNeeded();if(!selectedPrediction||selectedPrediction.id!==match.fixtureId)selectedPrediction={id:match.fixtureId,home:defaultSide(match.home,needed,match.round),away:defaultSide(match.away,needed,match.round),simulation:null,lineupsOpen:false,scoreEstimates:{}};return selectedPrediction}
function normaliseSide(team,side,needed){
  const eligible=side.draft,ordered=orderLineup(team,eligible);
  if(D.meta?.is_custom||D.meta?.competition_rules){const r=D.meta.customRules||D.meta.competition_rules;if(!side.manualOrder)side.singles=ordered.slice(0,r.singlesSlots);side.singles=[...new Set(side.singles.filter(x=>eligible.includes(x)))].slice(0,r.singlesSlots);for(const name of ordered)if(side.singles.length<r.singlesSlots&&!side.singles.includes(name))side.singles.push(name);side.doubles=Array.from({length:r.doublesSlots},(_,i)=>{const pair=[...new Set((side.doubles?.[i]||[]).filter(x=>eligible.includes(x)))].slice(0,2);for(const name of ordered)if(!side.manualPairs&&pair.length<2&&!pair.includes(name))pair.push(name);return pair;});return side;}
  if(!side.manualOrder)side.singles=ordered.slice(0,needed);
  side.singles=[...new Set(side.singles.filter(x=>eligible.includes(x)))].slice(0,needed);
  for(const name of ordered)if(side.singles.length<needed&&!side.singles.includes(name))side.singles.push(name);
  if(needed===4){
    const used=new Set();
    side.doubles=(side.doubles||[[],[]]).slice(0,2).map(pair=>pair.filter(name=>eligible.includes(name)&&!used.has(name)).slice(0,2).map(name=>(used.add(name),name)));
    while(side.doubles.length<2)side.doubles.push([]);
    for(const pair of side.doubles)for(const name of ordered)if(!side.manualPairs&&pair.length<2&&!used.has(name)){pair.push(name);used.add(name)}
  }
  return side;
}
function ratingFor(name,discipline){if(!name)return null;const row=(discipline==='doubles'?dinds:singles).find(x=>x.player===name)||singles.find(x=>x.player===name);return row?.rating??(D.meta?.ratingCentre??2000)}
function predictionRubber(label,home,away,homeRating,awayRating,{rubbersSingles=false}={}){
  const game=BRTAPrediction.gameProbability(homeRating,awayRating,D.meta?.ratingProbabilityScale||450),greenBall=!!D.greenBall;
  const targetGames=D.format==='rubbers'&&!rubbersSingles?8:6,p=rubbersSingles?BRTAPrediction.rubbersSinglesWin(game):BRTAPrediction.shortSetWin(game,{greenBall,targetGames});
  return{label,home,away,p,gameProbability:game,targetGames,bestOf:rubbersSingles?3:1,matchTiebreak:true,scoreDistribution:rubbersSingles?null:BRTAPrediction.shortSetDistribution(game,{greenBall,targetGames})};
}
function predictionMath(homeSide,awaySide){
  if(D.meta?.singlesOnly)return null;
  if(D.meta?.is_custom||D.meta?.competition_rules){const rules=D.meta.customRules||D.meta.competition_rules,rubbers=[];if(!BRTAPrediction.lineupReady(homeSide.singles,awaySide.singles,rules.singlesSlots))return null;
    for(const type of ['Doubles','Singles'])for(let i=0;i<rules[type==='Singles'?'singlesSlots':'doublesSlots'];i++){const h=type==='Singles'?[homeSide.singles[i]]:homeSide.doubles[i]||[],a=type==='Singles'?[awaySide.singles[i]]:awaySide.doubles[i]||[];if(!BRTAPrediction.lineupReady(h,a,type==='Singles'?1:2)||h.some(p=>a.includes(p)))return null;const discipline=type==='Singles'?'singles':'doubles',hr=h.reduce((n,p)=>n+ratingFor(p,discipline),0)/h.length,ar=a.reduce((n,p)=>n+ratingFor(p,discipline),0)/a.length,game=BRTAPrediction.gameProbability(hr,ar,D.meta?.ratingProbabilityScale||450),bestOf=rules[type==='Singles'?'singlesBestOf':'doublesBestOf'],targetGames=rules[type==='Singles'?'setTarget':'doublesTarget'],distribution=BRTAPrediction.matchDistribution(game,{bestOf,targetGames,matchTiebreak:rules.matchTiebreak!==false});rubbers.push({label:type+' '+(i+1),home:h.join(' / '),away:a.join(' / '),p:distribution.filter(x=>x.homeWin).reduce((n,x)=>n+x.probability,0),gameProbability:game,scoreDistribution:distribution,bestOf,targetGames,matchTiebreak:rules.matchTiebreak!==false});}
    return {rubbers,...BRTAPrediction.teamOutcome(rubbers,{gamesDecideTies:true,setWinsDecideTies:D.format==='rubbers'||!!D.meta?.competition_rules})};
  }

  const needed=predictionNeeded();
  const home=homeSide.singles,away=awaySide.singles;
  if(!BRTAPrediction.lineupReady(home,away,needed))return null;
  const rubbers=[],rubbersFormat=D.format==='rubbers';
  if(rubbersFormat){
    rubbers.push(predictionRubber('Doubles',home.join(' / '),away.join(' / '),(ratingFor(home[0],'doubles')+ratingFor(home[1],'doubles'))/2,(ratingFor(away[0],'doubles')+ratingFor(away[1],'doubles'))/2));
  }else{
    for(let i=0;i<2;i++){
      const h=homeSide.doubles[i],a=awaySide.doubles[i];
      if(h.length!==2||a.length!==2)return null;
      rubbers.push(predictionRubber('Doubles '+(i+1),h.join(' / '),a.join(' / '),h.reduce((sum,name)=>sum+ratingFor(name,'doubles'),0)/2,a.reduce((sum,name)=>sum+ratingFor(name,'doubles'),0)/2));
    }
  }
  for(let i=0;i<needed;i++)rubbers.push(predictionRubber('Singles '+(i+1),home[i],away[i],ratingFor(home[i]),ratingFor(away[i]),{rubbersSingles:rubbersFormat}));
  const outcome=BRTAPrediction.teamOutcome(rubbers,{gamesDecideTies:!rubbersFormat});
  return{rubbers,...outcome};
}
function predictionHTML(match){
  const state=predictionState(match),needed=predictionNeeded(),playoff=isPlayoff(match);
  const home=normaliseSide(match.home,state.home,needed),away=normaliseSide(match.away,state.away,needed);
  const ready=[home,away].every(side=>side.draft.length>=needed&&(D.meta?.is_custom||D.meta?.competition_rules||BRTAPrediction.lineupReady(side.singles,side.singles,needed))),prediction=ready?predictionMath(home,away):null;
  const picker=(team,side,key)=>{
    const rows=teamRoster(team);for(const name of side.draft)if(!rows.some(r=>r.player===name))rows.push({player:name,emergencyOnly:true});const rules=D.meta?.customRules||D.meta?.competition_rules;
    const singles=Array.from({length:rules?.singlesSlots??needed},(_,i)=>'<label><span>S'+(i+1)+'</span><select aria-label="Singles '+(i+1)+'" data-singles-side="'+key+'" data-singles-position="'+i+'">'+side.draft.map(name=>'<option value="'+esc(name)+'" '+(side.singles[i]===name?'selected':'')+'>'+esc(name)+'</option>').join('')+'</select></label>').join('');
    const showPairs=rules?rules.doublesSlots>0:D.format!=='rubbers';
    const doubles=showPairs?'<div class="ca-pair-picker"><h4>Doubles pairs</h4>'+side.doubles.map((pair,i)=>'<fieldset><legend>D'+(i+1)+' <span>'+pair.length+'/2</span></legend><div>'+side.draft.map(name=>{const selected=pair.includes(name),used=!rules&&side.doubles.some((p,j)=>j!==i&&p.includes(name));return '<label class="'+(selected?'selected':'')+'"><input type="checkbox" data-predict-pair-check data-side="'+key+'" data-pair="'+i+'" value="'+esc(name)+'" '+(selected?'checked':'')+' '+(!selected&&(pair.length>=2||used)?'disabled':'')+'><span>'+esc(name)+'</span></label>'}).join('')+'</div></fieldset>').join('')+'</div>':'';
    return '<section class="ca-squad lineup-picker compact-lineup"><header><h3>'+teamName(team)+'</h3><span>'+side.draft.length+' selected</span></header><div class="ca-squad-list">'+rows.map((row,i)=>{const selected=side.draft.includes(row.player);return '<div class="ca-squad-row '+(selected?'selected':'')+'"><label><input type="checkbox" data-predict-side="'+key+'" data-predict-player="'+esc(row.player)+'" '+(selected?'checked':'')+'><span><b>'+esc(row.player)+'</b>'+(row.emergencyOnly?'<small>Emergency</small>':'')+'</span><em>'+(side.singles.includes(row.player)?'S'+(side.singles.indexOf(row.player)+1):'#'+(i+1))+'</em></label></div>'}).join('')+'</div><div class="lineup-order-head"><h4>Singles order</h4><button class="export-link" type="button" data-auto-order="'+key+'">Suggested</button></div><div class="lineup-position-grid">'+singles+'</div>'+doubles+'<button type="button" class="export-link" data-lineup-history="'+esc(team)+'">Previous lineups & results</button></section>';
  };
  const chances=prediction?BRTAPrediction.roundedChances([prediction.homeWin,prediction.awayWin,prediction.draw]):[];
  const summary=!prediction?'<div class="notice prediction-not-ready"><b>Draft at least '+needed+' distinct players per team.</b></div>':('<div class="prediction-summary"><div><span>'+teamName(match.home)+'</span><b>'+chances[0]+'%</b></div><div><span>'+teamName(match.away)+'</span><b>'+chances[1]+'%</b></div><div><span>Exact draw</span><b>'+chances[2]+'%</b></div><div><span>Expected rubbers</span><b>'+prediction.rubbers.reduce((n,r)=>n+r.p,0).toFixed(1)+'–'+prediction.rubbers.reduce((n,r)=>n+1-r.p,0).toFixed(1)+'</b></div></div>');
  const projectionNames=(raw,win)=>'<span class="projection822-side '+(win?'favourite':'underdog')+'">'+String(raw).split(' / ').map(name=>personButton(name)).join('<button type="button" class="person pair-sep projection-pair-sep" data-projection-pair="'+esc(raw)+'" aria-label="Open pair lab"> / </button>')+'</span>';
  const ordered=prediction?BRTAPrediction.orderRubbers(prediction.rubbers,'singles-first'):[];
  const rows=ordered.map(row=>{const shown=!!state.scoreEstimates?.[row.label],estimate=shown?BRTAPrediction.mostLikelyScore(row,{format:D.format,greenBall:!!D.greenBall}):null;return '<div class="fixture-rubber"><span class="fixture-rubber-id">'+esc((/^Singles/.test(row.label)?'S':'D')+(row.label.match(/\d+/)?.[0]||'1'))+'</span><div class="prediction-rubber">'+projectionNames(row.home,row.p>=.5)+'<button type="button" class="prediction-estimate'+(shown?(estimate.homeWin?' rank-up':' rank-down'):'')+'" data-prediction-estimate="'+esc(row.label)+'" aria-pressed="'+shown+'" aria-label="'+esc((shown?'Show probabilities for ':'Show approximate scoreline for ')+row.label)+'" title="'+(shown?'Show probabilities':'Show approximate scoreline')+'">'+(shown?'~'+esc(estimate.score):Math.round(100*row.p)+'% – '+Math.round(100*(1-row.p))+'%')+'</button>'+projectionNames(row.away,row.p<=.5)+'</div></div>'}).join('');
  const simulation=state.simulation?simulationHTML(state.simulation,match.home,match.away):'';
  const lineups='<section class="prediction-lineups" data-prediction-lineups><h3>Choose lineups</h3><div class="lineup-pickers">'+picker(match.home,home,'home')+picker(match.away,away,'away')+'</div></section>';
  const verdict=prediction?'<section class="prediction-verdict"><div><span class="kicker">MATCH OUTLOOK</span><h3>'+teamName(Math.max(prediction.homeWin,prediction.awayWin)<.55?'Finely balanced':prediction.homeWin>prediction.awayWin?match.home+' favoured':match.away+' favoured')+'</h3></div></section>':'';
  return '<div class="fixture-forecast"><div class="overlay-title"><div class="kicker">ROUND '+esc(match.round||'')+' · FIXTURE OUTLOOK</div><h2>'+teamName(match.home)+' vs '+teamName(match.away)+'</h2></div>'+summary+verdict+lineups+'<section class="prediction-section"><div class="projection-section-heading"><h3>Rubber projections</h3></div><div class="projection841-switchline"><button type="button" class="projection841-toggle button secondary" data-projection841-toggle aria-pressed="'+(ordered.length>0&&ordered.every(r=>state.scoreEstimates?.[r.label]))+'">'+(ordered.length>0&&ordered.every(r=>state.scoreEstimates?.[r.label])?'Percentages':'Score estimates')+'</button></div><div class="prediction-rubbers">'+rows+'</div></section><div class="simulation-actions"><button type="button" class="button primary" data-run-simulation '+(prediction?'':'disabled')+'>Run Simulation</button></div>'+simulation+'</div>';

}
function fixtureById(id){return(D.upcomingFixtures||[]).flatMap(round=>round.fixtures.map(f=>({...f,round:round.round,date:round.date}))).find(f=>f.fixtureId===id)}
function currentPredictionMatch(){return activePredictionMatch||fixtureById(selectedPrediction?.id)}
function findFixtureResult(f,round){return findMatch(f.fixtureId)||(D.results||[]).filter(r=>r.round===round).flatMap(r=>r.fixtures).find(result=>result.home===f.home&&result.away===f.away)||null}
let lineup841Cards=[],lineup841Team='';
function openTeamLineupHistory(team){
 lineup841Cards=BRTALineups.configurations(D,team);lineup841Team=team;
 const active=currentPredictionMatch(),canApply=!!selectedPrediction&&active&&(active.home===team||active.away===team);
 const cards=lineup841Cards.map((c,i)=>'<article class="lineup841-card" data-lineup841-card="'+i+'"><header><div class="lineup841-rounds">'+c.appearances.map(a=>'<button type="button" class="export-link" data-lineup-fixture="'+esc(a.fixtureId)+'" title="'+esc(a.label)+'">R'+a.round+'</button>').join(' ')+'</div><button type="button" class="icon821 lineup841-apply" data-lineup841-apply="'+i+'" aria-label="Use lineup '+(i+1)+' in prediction" title="Use this lineup" '+(canApply?'':'disabled')+'>↗</button></header><button type="button" class="lineup841-result" data-lineup-fixture="'+esc(c.appearances.at(-1).fixtureId)+'"><b>'+c.count+' appearance'+(c.count===1?'':'s')+'</b><ol>'+c.singles.map((name,i)=>'<li><span>S'+(i+1)+'</span><strong>'+esc(name)+'</strong></li>').join('')+'</ol><div class="lineup841-pairs">'+c.doubles.map((pair,i)=>'<p><span>D'+(i+1)+'</span><b>'+esc(pair.join(' / '))+'</b></p>').join('')+'</div></button></article>').join('');
 $('#lineupHistoryContent').innerHTML='<div class="overlay-title"><div class="kicker">RECORDED LINEUPS</div><h2>'+teamName(team)+'</h2></div><div class="lineup841-grid">'+(cards||'<p>No complete lineups have been recorded yet.</p>')+'</div>';
 $('#lineupHistoryOverlay').classList.remove('hidden');eightRaise($('#lineupHistoryOverlay'));document.body.classList.add('modal-open');
}
function applyRecordedLineup(index){const lineup=lineup841Cards[index],match=currentPredictionMatch();if(!lineup||!selectedPrediction||!match)return;const side=match.home===lineup841Team?'home':match.away===lineup841Team?'away':null;if(!side)return;selectedPrediction[side]=BRTALineups.side(lineup);selectedPrediction.simulation=null;close('#lineupHistoryOverlay');refreshPrediction()}

function refreshPrediction(){const match=currentPredictionMatch();if(match)$('#predictionContent').innerHTML=predictionHTML(match)}
function openPrediction(id){if(D.meta?.singlesOnly){openPredictionHome();return}const match=fixtureById(id);if(!match||match.status!=='Scheduled'||findFixtureResult(match,match.round))return;activePredictionMatch=match;selectedPrediction=null;refreshPredictionFor(match);$('#predictionOverlay').classList.remove('hidden');document.body.classList.add('modal-open')}
function rm1PredictionNotice(){return '<div class="overlay-title"><h2>Prediction Centre</h2></div><p>RM1 supports singles game strength. Choose another model in Settings for fixture predictions.</p><button type="button" class="button secondary" data-layout-open="methodology">Choose model</button>'}
function openPredictionHome(selectedTeam=''){
  if(D.meta?.singlesOnly){$('#predictionContent').innerHTML=rm1PredictionNotice();$('#predictionOverlay').classList.remove('hidden');document.body.classList.add('modal-open');return}
  const names=teams.map(x=>x.team).sort((a,b)=>a.localeCompare(b)),home=selectedTeam||names[0]||'',away=names.find(name=>name!==home)||'';
  $('#predictionContent').innerHTML='<div class="overlay-title"><div class="kicker">PREDICTION CENTRE</div><h2>Build a matchup</h2><p>Pick two teams to get started.</p></div><div class="prediction-home-fields"><label>Home team<select id="predictionHomeTeam">'+names.map(name=>'<option value="'+esc(name)+'" '+(name===home?'selected':'')+'>'+teamName(name)+'</option>').join('')+'</select></label><label>Away team<select id="predictionAwayTeam">'+names.map(name=>'<option value="'+esc(name)+'" '+(name===away?'selected':'')+'>'+teamName(name)+'</option>').join('')+'</select></label></div><button type="button" class="button primary" data-start-custom-prediction="1">Choose lineups</button>';
  $('#predictionOverlay').classList.remove('hidden');document.body.classList.add('modal-open');
}
function startCustomPrediction(){
  const home=$('#predictionHomeTeam')?.value,away=$('#predictionAwayTeam')?.value;
  if(!home||!away||home===away)return;
  activePredictionMatch={fixtureId:'custom:'+home+'|'+away,home,away,status:'Scheduled',round:'Custom matchup',date:'',stage:'custom'};
  selectedPrediction=null;refreshPrediction();
}
function refreshPredictionFor(match){$('#predictionContent').innerHTML=predictionHTML(match)}
function updatePrediction(side,player,checked){const match=currentPredictionMatch();if(!match)return;const current=selectedPrediction[side].draft,needed=predictionNeeded(),max=D.meta?.is_custom?teamRoster(side==='home'?match.home:match.away).length:isPlayoff(match)&&needed===4?6:needed;if(checked&&current.length>=max){refreshPrediction();return}if(checked&&!current.includes(player))current.push(player);if(!checked)selectedPrediction[side].draft=current.filter(x=>x!==player);selectedPrediction.simulation=null;refreshPrediction()}
function updateSingles(side,position,player){const s=selectedPrediction[side];if(!s.draft.includes(player))return;const previous=s.singles.indexOf(player),displaced=s.singles[position];s.singles[position]=player;if(previous>=0&&previous!==position)s.singles[previous]=displaced;s.manualOrder=true;selectedPrediction.simulation=null;refreshPrediction()}
function updateDoubles(side,pair,slot,player){const s=selectedPrediction[side];if(!s.draft.includes(player))return;if(D.meta?.is_custom||D.meta?.competition_rules){const other=1-slot,displaced=s.doubles[pair][slot];if(s.doubles[pair][other]===player)s.doubles[pair][other]=displaced;s.doubles[pair][slot]=player;selectedPrediction.simulation=null;refreshPrediction();return;}const other=s.doubles.findIndex(row=>row.includes(player)),otherSlot=other>=0?s.doubles[other].indexOf(player):-1,displaced=s.doubles[pair][slot];s.doubles[pair][slot]=player;if(other>=0&&(other!==pair||otherSlot!==slot))s.doubles[other][otherSlot]=displaced;selectedPrediction.simulation=null;refreshPrediction()}
function simulationHTML(sim,home,away){return'<div class="simulation-result"><h3>Simulated result · '+teamName(home)+' '+sim.homeRubbers+'–'+sim.awayRubbers+' '+teamName(away)+'</h3><p>'+sim.results.slice().sort(disciplineCompare).map(r=>'<span><b>'+esc(r.label)+'</b> · '+esc(r.home)+' <strong>'+esc(r.score)+'</strong> '+esc(r.away)+'</span>').join('')+'</p><div class="simulation-total">Games '+sim.homeGames+'–'+sim.awayGames+' · Sets '+sim.homeSets+'–'+sim.awaySets+' · <b>Points '+sim.homePoints+'–'+sim.awayPoints+'</b></div><small>'+(sim.winner===1?teamName(home)+' wins':sim.winner===-1?teamName(away)+' wins':'Exact draw')+'</small></div>'}
function runPredictionSimulation(){const match=currentPredictionMatch();if(!match)return;const prediction=predictionMath(selectedPrediction.home,selectedPrediction.away);if(!prediction)return;selectedPrediction.simulation=BRTAPrediction.simulateTie(BRTAPrediction.orderRubbers(prediction.rubbers,'singles-first'),{format:D.format,greenBall:D.greenBall,custom:!!D.meta?.is_custom,setWinsDecideTies:!!D.meta?.competition_rules});refreshPrediction()}
function simulateRound(round){BRTARoundSimulation.open(round)}
function closeRoundSimulation(round){delete roundSimulations[round];renderFixtures()}

function scoreForPlayer(score,home){return home?String(score):String(score).replace(/(\d+)\s*-\s*(\d+)/g,(_,a,b)=>b+'-'+a)}
function playerMatches(name){return(D.singlesMatches||[]).filter(m=>m[2]===name||m[3]===name).map(m=>{const home=m[2]===name,opp=home?m[3]:m[2],gf=home?m[4]:m[5],ga=home?m[5]:m[4],won=m[6]===name,o=singles.find(x=>x.player===opp),perf=o?Math.round(o.rating+(D.meta?.ratingProbabilityScale||450)*Math.log((gf+.5)/(ga+.5))):null;return{round:m[0],date:m[1],opp,gf,ga,won,score:scoreForPlayer(m[7],home),fixtureId:m[8],oppRating:o?.rating,performance:perf}}).sort((a,b)=>a.round-b.round)}
function partnerStats(name){return pairs.filter(x=>x.player.split(' / ').includes(name)).map(x=>({...x,partner:x.player.split(' / ').find(p=>p!==name)})).sort((a,b)=>b.matches-a.matches||b.rating-a.rating)}
function confidence(s){if(D.meta?.hasUncertainty===false)return ['No uncertainty estimate','conf-mid'];if(!s)return['No singles data','conf-low'];if(s.matches<4)return['Limited','conf-low'];if(s.matches>=8&&s.se<130)return['High','conf-high'];if(s.matches>=6&&s.se<155)return['Established','conf-high'];return['Moderate','conf-mid']}
function stat(a,b,c){return'<div class="stat-card"><span>'+a+'</span><b>'+(b??'—')+'</b><small>'+c+'</small></div>'}function mini(a,b){return'<div><span>'+a+'</span><b>'+b+'</b></div>'}function radar(label,x){return'<div><span>'+label+'</span>'+(x?'<b><em class="radar-result '+(x.won?'win':'loss')+'">'+(x.won?'W':'L')+'</em> <span class="radar-opponent">'+esc(x.opp)+'</span></b><strong class="radar-score">'+esc(x.score)+'</strong><small>Opponent '+(x.oppRating??'—')+'</small>':'<b>None yet</b>')+'</div>'}
function historyChart(name,throughRound=null){const all=D.ratingHistory?.players?.[name]||[],history=throughRound==null?all:all.filter(x=>Number(x[0])<=Number(throughRound));if(history.length<2)return'<p class="small-note">A history line appears after this player has results in two rounds.</p>';const values=history.map(x=>x[1]),lo=Math.min(...values)-30,hi=Math.max(...values)+30,coordinates=history.map((x,index)=>({px:100*(index+.5)/history.length,py:92-(x[1]-lo)*84/(hi-lo||1)})),points=coordinates.map(x=>x.px.toFixed(1)+','+x.py.toFixed(1)).join(' '),markers=coordinates.map(x=>'<circle cx="'+x.px.toFixed(1)+'" cy="'+x.py.toFixed(1)+'" r="1.8"/>').join('');return'<div class="history-chart"><svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="Power history"><polyline points="'+points+'"/>'+markers+'</svg><div class="history-chart-labels" style="grid-template-columns:repeat('+history.length+',minmax(0,1fr))">'+history.map(x=>'<span>R'+x[0]+'<b>'+x[1]+'</b></span>').join('')+'</div></div>'}
function historicalSnapshot(name,round){const values=D.ratingHistory?.players?.[name]||[];return [...values].reverse().find(x=>Number(x[0])<=Number(round))||null}
function historicalRoundDate(round){return D.ratingHistory?.rounds?.find(x=>Number(x.round)===Number(round))?.date||''}
function historicalRows(round){return BRTAHistory.withMovement(D,'singles',round).map(row=>{const previous=historicalSnapshot(row.player,round-1);return {...row,change:previous?row.rating-previous[1]:null}})}
function historicalMatchContext(match,sourcePlayer){if(!sourcePlayer||match.status!=='Completed'||!D.ratingHistory?.players)return'';const appears=(match.rubbers||[]).some(r=>r.type==='Singles'&&(r.home===sourcePlayer||r.away===sourcePlayer));if(!appears||!historicalSnapshot(sourcePlayer,match.round))return'';return'<details class="historical-context"><summary>Model context</summary><button class="button secondary" type="button" data-history-player="'+esc(sourcePlayer)+'" data-history-round="'+match.round+'">'+esc(sourcePlayer)+' · Round '+match.round+'</button></details>'}
function openHistoricalTable(round){const rows=historicalRows(round),date=historicalRoundDate(round);$('#roundContent').innerHTML='<div class="overlay-title"><div class="kicker">ROUND '+round+' RATINGS</div><h2>After Round '+round+'</h2><p>'+esc(date)+' · '+esc(D.meta.section_label)+'</p></div><div class="table-wrap"><table><thead><tr><th>#</th><th>Player</th><th>Team</th><th>Power</th><th>Movement</th><th>Matches</th>'+uncertaintyHead()+'</tr></thead><tbody>'+rows.map(row=>'<tr class="'+(row.rank?'':'provisional')+'"><td>'+rankCell(row)+'</td><td><button class="person" data-history-player="'+esc(row.player)+'" data-history-round="'+round+'">'+esc(row.player)+'</button></td><td>'+teamName(row.team)+'</td><td><b>'+row.rating+'</b></td>'+movementCell(row)+'<td>'+row.matches+'</td>'+uncertaintyCell(row.se)+'</tr>').join('')+'</tbody></table></div>';$('#roundOverlay').classList.remove('hidden');document.body.classList.add('modal-open')}
function profileRank(name){const ranked=singles.filter(row=>row.matches>=4).sort((a,b)=>b.rating-a.rating||a.player.localeCompare(b.player));const index=ranked.findIndex(row=>row.player===name);return index<0?null:index+1}
function profileRun(matches){if(!matches.length)return null;const latest=matches[matches.length-1],same=[...matches].reverse().findIndex(match=>match.won!==latest.won);return{won:latest.won,length:same<0?matches.length:same}}
function profileLongestRun(matches,won){let best=0,current=0;for(const match of matches){current=match.won===won?current+1:0;best=Math.max(best,current)}return best}
function profileMetric(label,value,detail='',tone=''){return'<div class="lab-metric '+tone+'"><span>'+esc(label)+'</span><b>'+esc(value??'—')+'</b>'+(detail?'<small>'+detail+'</small>':'')+'</div>'}
function profileHighlight(label,match,detail=''){if(!match)return'';return'<button class="lab-highlight" type="button" data-match-id="'+esc(match.fixtureId)+'"><span>'+esc(label)+'</span><b><em class="radar-result '+(match.won?'win':'loss')+'">'+(match.won?'W':'L')+'</em> '+esc(match.score)+' · '+esc(match.opp)+'</b><small>'+esc(detail)+'</small></button>'}
function profileSplit(matches,condition){const rows=matches.filter(condition),wins=rows.filter(match=>match.won).length;return rows.length?wins+'–'+(rows.length-wins):'—'}
function profileSchedule(schedule,rows=D.strengthOfSchedule||[]){return schedule?'<button class="schedule-card lab-schedule-card" type="button" data-sos-open title="Open the full strength-of-schedule table"><span>Strength of schedule</span><b>'+scheduleBand(schedule.averageOpponent,rows)+'</b><small>#'+schedule.rank+' hardest of '+schedule.total+' · '+schedule.matches+' matches</small></button>':profileMetric('Schedule','—','No completed opponents')}
function playerInsight(name){return D.playerInsights?.[name]||null}
function rivalryMatchesHTML(rival){
  return'<div class="rivalry-match-list">'+(rival.rows||[]).map(row=>'<button type="button" class="rivalry-match" data-rival-fixture="'+esc(row.fixtureId)+'"><span class="rivalry-when"><b>R'+esc(row.round)+'</b><small>'+esc(row.date||'Recorded match')+'</small></span><strong class="rivalry-score '+(row.result==='W'?'win':'loss')+'">'+esc(row.result)+' '+esc(row.score||'Score unavailable')+'</strong><span class="rivalry-facts"><b>No. '+esc(row.position??'—')+'</b><small>Expected '+(row.expectedWinProbability==null?'—':Math.round(100*row.expectedWinProbability)+'%')+' · '+signed(row.performanceDelta,0)+'</small></span><span class="rivalry-powers">'+esc(row.ratingAtTime??'—')+' <i>v</i> '+esc(row.opponentRatingAtTime??'—')+'</span></button>').join('')+'</div>';
}
function rivalryListHTML(insight){
  const rivalries=insight?.rivalries||[];
  return rivalries.length?'<div class="rivalry-list">'+rivalries.map(rival=>'<details class="rivalry-card"><summary><span class="rivalry-opponent"><small>Opponent</small><b>'+esc(rival.opponent)+'</b></span><span class="rivalry-record"><small>Head-to-head</small><b>'+esc(rival.record)+'</b></span><span class="rivalry-count">'+esc(rival.matches)+' meeting'+(rival.matches===1?'':'s')+'</span></summary><div class="rivalry-card-meta"><span>'+esc(rival.gamesFor)+'–'+esc(rival.gamesAgainst)+' games</span><span>'+signed(rival.winsAboveExpected,2)+' vs expected</span></div>'+rivalryMatchesHTML(rival)+'</details>').join('')+'</div>':'<p class="small-note">No recorded singles rivalries yet.</p>';
}
function openRivalries(name,insight,throughRound=0){
  $('#rivalryContent').innerHTML='<div class="overlay-title"><div class="kicker">RIVALRIES</div><h2>'+esc(name)+'</h2>'+(throughRound?'<p>Singles meetings through Round '+throughRound+'.</p>':'')+'</div>'+rivalryListHTML(insight);
  $('#rivalryOverlay').classList.remove('hidden');document.body.classList.add('modal-open');
}
function roleSection(insight,name,throughRound=0){
  if(!insight)return'';
  const positions=insight.positions||[],availability=insight.availabilityPercent==null?'—':insight.availabilityPercent+'%',rivalries=(insight.rivalries||[]).length;
  return'<section class="profile-section lab-section team-role-section"><div class="lab-section-head"><div><h3>Team role & availability</h3></div></div><div class="team-role-metrics">'+profileMetric('Rounds played',insight.roundsPlayed,(insight.teamCompletedTies||0)+' completed team ties')+profileMetric('Availability',availability,insight.availabilityPercent==null?'No team-tie denominator':'of completed team ties')+profileMetric('Average listed position',insight.averageListedPosition==null?'—':'No. '+insight.averageListedPosition,insight.emergencyAppearances?insight.emergencyAppearances+' emergency appearance'+(insight.emergencyAppearances===1?'':'s'):'No emergency appearances')+'</div><div class="team-role-actions">'+profileMetric('Positions used',positions.length||'—',positions.length?positions.map(row=>'No. '+row.position).join(' · '):'No listed singles position')+(rivalries?'<button type="button" class="role-rivalry-button" data-open-rivalries="'+esc(name)+'" data-rivalry-round="'+(throughRound||'')+'"><span>Full rivalry history</span><b>'+rivalries+' opponent'+(rivalries===1?'':'s')+'</b><small>Head-to-head results and match detail</small></button>':'')+'</div>'+(positions.length?'<div class="role-table-spacer"></div><div class="table-wrap role-table"><table><thead><tr><th>Position</th><th>Record</th><th>Games</th><th>Game share</th><th>Expected wins</th></tr></thead><tbody>'+positions.map(row=>'<tr><td><b>No. '+row.position+'</b> · '+row.matches+' match'+(row.matches===1?'':'es')+'</td><td>'+row.record+'</td><td>'+row.gamesFor+'–'+row.gamesAgainst+'</td><td>'+row.gameShare+'%</td><td>'+row.expectedWins+'</td></tr>').join('')+'</tbody></table></div>':'')+'</section>';
}
function performanceSection(insight){
  if(!insight)return'';
  const c=insight.consistency||{},s=insight.scoreProfile||{},score=c.score==null?'—':c.score+'/100',volatility=c.volatility==null?'—':'±'+c.volatility;
  return'<section class="profile-section lab-section performance-profile-section"><div class="lab-section-head"><div><h3>Consistency & score profile</h3><p>Match-to-match performance against pre-match Power.</p></div></div><div class="lab-insight-grid">'+profileMetric('Consistency score',score,c.matches>=2?'Higher is steadier':'Needs two scored matches')+profileMetric('Performance volatility',volatility,c.matches>=2?'standard deviation of performance deltas':'Needs two scored matches')+profileMetric('Average performance delta',c.averagePerformanceDelta==null?'—':signed(c.averagePerformanceDelta,1),c.matches?'vs pre-match Power':'')+profileMetric('Straight-set matches',s.straightSetMatches??'—',(s.scoredMatches||0)+' recorded singles scores')+'</div><div class="score-profile-row">'+profileMetric('Sets',((s.setsWon??0)+'–'+(s.setsLost??0)),'won–lost')+profileMetric('Tiebreaks',((s.tiebreaksWon??0)+'–'+(s.tiebreaksLost??0)),'won–lost')+profileMetric('Deciding matches',((s.decidingWins??0)+'–'+(s.decidingLosses??0)),'won–lost')+'</div><p class="small-note">Doubles appear before singles throughout the site.</p></section>';
}
function matchExplorerSection(matches,rating,historical=false){
  return'<section class="profile-section lab-section profile-inline-explorer"><div class="lab-section-head"><div><h3>Match explorer</h3></div><span>'+matches.length+' matches</span></div><div class="match-list lab-match-list">'+(matches.length?matches.map(match=>'<button class="match-row" data-match-id="'+esc(match.fixtureId)+'"><span class="match-round">R'+match.round+'</span><b class="match-score '+(match.won?'win':'loss')+'">'+(match.won?'W':'L')+' '+esc(match.score)+'</b><span class="match-opponent">'+esc(match.opp)+'<small>Power '+(match.oppRating??'—')+(historical?' at the time':'')+'</small></span><span class="match-meta '+(match.performance!=null&&rating?(match.performance>=rating?'performance-above':'performance-below'):'')+'">'+(match.performance!=null?'Performance '+match.performance:'No comparison')+'</span></button>').join(''):'<p>No completed singles rubbers recorded.</p>')+'</div></section>';
}
function renderProfileMatchExplorer(matches,rating,historical=false){
  const host=$('#profileMatchExplorer'),content=$('#profileMatchExplorerContent');if(!host||!content)return;
  content.innerHTML='<div class="floating-explorer-head"><div class="kicker">MATCH EXPLORER</div><h3>'+matches.length+' recorded singles match'+(matches.length===1?'':'es')+'</h3></div>'+matchExplorerSection(matches,rating,historical).replace('profile-inline-explorer','profile-floating-explorer');
  host.classList.remove('hidden');
}
function doublesSection(d,partners,o){
  if(D.meta?.singlesOnly)return '<p>RM1 supports singles only.</p>';
  if(!d)return'<p>No doubles evidence recorded.</p>';
  const cards=partners.length?partners.map(partner=>{const effect=partner.pairEffect??0,synergy=partner.pairSynergy??0;return'<article class="partner-card"><b>'+personButton(partner.partner)+'</b><span>'+partner.wins+'–'+partner.losses+' · '+partner.matches+' ties</span><small>Pair Power '+partner.rating+' · effect '+(effect>=0?'+':'')+effect+' · synergy '+(synergy>=0?'+':'')+synergy+'</small></article>'}).join(''):'<p>No repeated partnerships yet.</p>';
  return'<div class="lab-doubles-summary">'+profileMetric('Individual Power',d.rating,d.ranking_status||'')+profileMetric('Appearances',d.matches,d.partner_count+' partners')+(o?profileMetric('Overall Power',o.rating,'50/50 singles + doubles'):'')+'</div><p class="small-note">Pair effect compares pair Power with the two players’ individual-doubles average. Synergy is the separately fitted, strongly regularised pair residual.</p><div class="partner-list">'+cards+'</div>';
}
function auxiliaryMatchupResult(context,opponent){
  const rating=context.row.rating,other=context.matches.find(match=>match.opp===opponent)?.oppRating;
  if(other==null)return'<p class="small-note">A rating is not available for this comparison.</p>';
  const probability=1/(1+Math.exp(-(rating-other)/(D.meta?.ratingProbabilityScale||450))),matches=context.matches.filter(match=>match.opp===opponent),gf=matches.reduce((sum,match)=>sum+match.gf,0),ga=matches.reduce((sum,match)=>sum+match.ga,0);
  return'<div class="lab-matchup-result"><div class="lab-matchup-projection"><span>Projected win chance</span><b>'+Math.round(100*probability)+'%</b><small>'+esc(context.row.player)+' · '+rating+' Power</small></div><div class="lab-matchup-stats"><div><span>Power gap</span><b>'+(rating>other?'+':'')+(rating-other)+'</b></div><div><span>Past meetings</span><b>'+(matches.length?matches.length+'–0':'—')+'</b></div><div><span>Games</span><b>'+(matches.length?gf+'–'+ga:'—')+'</b></div></div><p class="explain">Projection uses the same Power relationship as the Player Lab; past meetings are this player’s completed Royal Matches.</p></div>';
}
function auxiliaryMatchupSection(context){
  const opponents=[...new Map(context.matches.map(match=>[match.opp,match.oppRating])).entries()].map(([player,rating])=>({player,rating})).sort((a,b)=>a.player.localeCompare(b.player));
  if(!opponents.length)return'<div class="lab-matchup"><p>No completed opponents are available in this section.</p></div>';
  const selected=opponents[0].player;
  return'<div class="lab-matchup"><label class="lab-matchup-label">Compare with<select data-aux-profile-opponent>'+opponents.map(row=>'<option value="'+esc(row.player)+'"'+(row.player===selected?' selected':'')+'>'+esc(row.player)+' · '+row.rating+'</option>').join('')+'</select></label><div data-aux-profile-matchup-result>'+auxiliaryMatchupResult(context,selected)+'</div></div>';
}
function auxiliaryHistoryChart(history){
  if(history.length<2)return'<p class="small-note">A history line appears after results in two rounds.</p>';
  const values=history.map(row=>row[1]),lo=Math.min(...values)-30,hi=Math.max(...values)+30,coordinates=history.map((row,index)=>({px:100*(index+.5)/history.length,py:92-(row[1]-lo)*84/(hi-lo||1)})),points=coordinates.map(point=>point.px.toFixed(1)+','+point.py.toFixed(1)).join(' '),markers=coordinates.map(point=>'<circle cx="'+point.px.toFixed(1)+'" cy="'+point.py.toFixed(1)+'" r="1.8"/>').join('');
  return'<div class="history-chart"><svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="Power history"><polyline points="'+points+'"/>'+markers+'</svg><div class="history-chart-labels" style="grid-template-columns:repeat('+history.length+',minmax(0,1fr))">'+history.map(row=>'<span>R'+row[0]+'<b>'+row[1]+'</b></span>').join('')+'</div></div>';
}
function openAuxiliaryProfile(context){
  activeProfilePlayer=context.row.player;
  const s=context.row,matches=context.matches,insight=context.insight,last=matches.slice(-3),recentGf=last.reduce((sum,match)=>sum+match.gf,0),recentGa=last.reduce((sum,match)=>sum+match.ga,0),gameShare=s.gf+s.ga?100*s.gf/(s.gf+s.ga):null,firstPower=context.history[0]?.[1],powerChange=firstPower==null?null:s.rating-firstPower,run=profileRun(matches),longestWin=profileLongestRun(matches,true),averageMargin=matches.length?matches.reduce((sum,match)=>sum+match.gf-match.ga,0)/matches.length:null,bestPerformance=[...matches].sort((a,b)=>b.performance-a.performance)[0],bestWin=[...matches].sort((a,b)=>b.oppRating-a.oppRating)[0],toughestMatch=[...matches].sort((a,b)=>(a.gf-a.ga)-(b.gf-b.ga)||b.oppRating-a.oppRating)[0],expected=matches.reduce((sum,match)=>sum+match.expectedWinProbability,0),recentText=last.length?last.length+'–0':'—',higherRecord=profileSplit(matches,match=>match.oppRating>s.rating),closest=matches.filter(match=>Math.abs(match.gf-match.ga)<=2).length;
  let html='<div class="profile-head lab-head"><div><div class="kicker">PLAYER LAB · RANKED</div><h2>'+esc(s.player)+'</h2><p>'+teamName(s.team)+'</p></div><span class="confidence conf-high"><b>High evidence</b><small>'+s.matches+' singles matches'+(Number.isFinite(s.se)?' · ±'+s.se:'')+'</small></span></div>';
  html+='<section class="lab-hero"><div class="lab-power"><span>Singles Power</span><strong>'+s.rating+'</strong><small>#0 in '+esc(context.sectionLabel)+'</small></div><div class="lab-hero-grid">'+profileMetric('Record',s.wins+'–0',s.matches+' completed singles')+profileMetric('Game share',gameShare==null?'—':Math.round(gameShare)+'%',s.gf+'–'+s.ga+' games')+profileMetric('Power trend',powerChange==null?'—':(powerChange>=0?'+':'')+powerChange,firstPower!=null?'since first result':'')+profileMetric('Current run',run?'W'+run.length:'—',longestWin?'best win streak '+longestWin:'')+'</div></section>';
  html+='<section class="profile-section lab-section"><div class="lab-section-head"><div><h3>Match insight</h3></div></div><div class="lab-insight-grid">'+profileMetric('Actual wins',matches.length,'Expected '+expected.toFixed(2)+' wins')+profileMetric('Wins vs expected',signed(matches.length-expected,2)+' wins','Game evidence against fixed opponents')+profileSchedule(context.schedule,context.sos)+profileMetric('vs higher-rated',higherRecord,'using current Power as the line')+'</div>'+auxiliaryMatchupSection(context)+'</section>'+roleSection(insight,s.player)+matchExplorerSection(matches,s.rating);
  html+='<div class="lab-layout"><div class="lab-main"><section class="profile-section lab-section"><div class="lab-section-head"><div><h3>Momentum</h3></div><span>'+recentText+' last '+last.length+'</span></div>'+auxiliaryHistoryChart(context.history)+'<div class="lab-momentum-grid">'+profileMetric('Last three games',last.length?recentGf+'–'+recentGa:'—',last.length?Math.round(100*recentGf/(recentGf+recentGa))+'% game share':'')+profileMetric('Average margin',averageMargin==null?'—':(averageMargin>=0?'+':'')+averageMargin.toFixed(1),matches.length?'games per match':'')+profileMetric('Close matches',matches.length?closest+'/'+matches.length:'—',matches.length?'within two games':'')+'</div></section>'+performanceSection(insight)+'</div><aside class="lab-side"><section class="profile-section lab-section"><div class="lab-section-head"><div><h3>Headline results</h3></div></div><div class="lab-highlights">'+profileHighlight('Best-rated win',bestWin,bestWin?'Opponent Power '+bestWin.oppRating:'')+profileHighlight('Top performance',bestPerformance,bestPerformance?'Performance '+bestPerformance.performance:'')+profileHighlight('Toughest match',toughestMatch,toughestMatch?'Opponent Power '+toughestMatch.oppRating:'')+'</div></section><section class="profile-section lab-section lab-doubles"><div class="lab-section-head"><div><h3>Doubles</h3></div></div><p>No doubles evidence recorded.</p></section></aside></div>';
  html+='<section class="profile-section lab-section"><div class="lab-section-head"><div><h3>Season notes</h3></div></div><div class="lab-context-actions"><button class="button secondary" type="button" data-aux-backstory>See Backstory</button></div></section>';
  $('#profileContent').innerHTML=html;renderProfileMatchExplorer(matches,s.rating);$('#profileOverlay').classList.remove('hidden');document.body.classList.add('modal-open');
}
function openAuxiliaryMatch(match){
  if(!match)return;
  $('#resultContent').innerHTML='<div class="result-detail-head"><span>Royal Match · '+esc(match.date||'Date not published')+'</span><h2>'+esc(window.AuxiliaryModule.CANONICAL)+' <b>'+esc(match.score)+'</b> '+esc(match.opp)+'</h2><p>Completed best-of-three result</p></div><div class="rubber-list"><div class="rubber-row"><small class="rubber-code" title="Singles 1">S1</small><b class="rubber-home winner">'+esc(window.AuxiliaryModule.CANONICAL)+'</b><strong>'+esc(match.score)+'</strong><b class="rubber-away">'+esc(match.opp)+'</b></div></div>';
  eightRaise($('#resultOverlay'));$('#resultOverlay').classList.remove('hidden');document.body.classList.add('modal-open');
}
function openAuxiliaryBackstory(context){
  const s=context.row;
  $('#roundContent').innerHTML='<div class="overlay-title"><div class="kicker">BACKSTORY</div><h2>'+esc(s.player)+'</h2><p>'+esc(context.sectionLabel)+' · '+esc(D.meta.season_label||'Current season')+'</p></div><p>Across '+s.matches+' completed singles matches, '+esc(s.player)+' has stayed unbeaten while conceding '+s.ga+' games. The schedule has drawn '+context.rivalries.length+' opponents from this section; the rest of the ratings have continued their day entirely normally.</p><div class="lab-context-actions"><button class="auxiliary-archive-button" type="button" data-aux-open-archive>Open Royal Archive</button></div>';
  $('#roundOverlay').classList.remove('hidden');document.body.classList.add('modal-open');
}
function openProfile(name){
  if(auxiliaryPlayer(name)){openAuxiliaryProfile(auxiliaryCache);return}
  activeProfilePlayer=name;
  const s=singles.find(row=>row.player===name),d=dinds.find(row=>row.player===name),o=overallData().find(row=>row.player===name),expectation=(D.resultsExpectation?.players||[]).find(row=>row.player===name),matches=playerMatches(name),partners=partnerStats(name),schedule=(D.strengthOfSchedule||[]).find(row=>row.player===name),rank=profileRank(name),cf=confidence(s),history=D.ratingHistory?.players?.[name]||[],insight=playerInsight(name),firstPower=history[0]?.[1],powerChange=s&&firstPower!=null?s.rating-firstPower:null,last=matches.slice(-3),recentWins=last.filter(match=>match.won).length,recentGf=last.reduce((total,match)=>total+match.gf,0),recentGa=last.reduce((total,match)=>total+match.ga,0),gameShare=s&&s.gf+s.ga?100*s.gf/(s.gf+s.ga):null,averageMargin=matches.length?matches.reduce((total,match)=>total+match.gf-match.ga,0)/matches.length:null,run=profileRun(matches),higherRecord=s?profileSplit(matches,match=>(match.oppRating??-Infinity)>s.rating):'—',bestPerformance=[...matches].filter(match=>match.performance!=null).sort((a,b)=>b.performance-a.performance)[0],bestWin=[...matches].filter(match=>match.won&&match.oppRating!=null).sort((a,b)=>b.oppRating-a.oppRating)[0],toughestLoss=[...matches].filter(match=>!match.won&&match.oppRating!=null).sort((a,b)=>b.oppRating-a.oppRating)[0],longestWin=profileLongestRun(matches,true),closest=matches.filter(match=>Math.abs(match.gf-match.ga)<=2).length;
  const titleTeam=s?.team||d?.team||'',record=s?s.wins+'–'+s.losses:'—',qualifier=s?.matches>=4?'Ranked':'Provisional',recentText=last.length?recentWins+'–'+(last.length-recentWins):'—';
  let html='<div class="profile-head lab-head"><div><div class="kicker">PLAYER LAB · '+esc(qualifier)+'</div><h2>'+esc(name)+'</h2><p>'+teamName(titleTeam)+'</p></div><span class="confidence '+cf[1]+'"><b>'+cf[0]+(D.meta?.singlesOnly?'':' evidence')+'</b><small>'+esc(s?s.matches+' singles matches'+(Number.isFinite(s.se)?' · ±'+s.se:''):'No singles record')+'</small></span></div>';
  html+='<section class="lab-hero"><div class="lab-power"><span>Singles Power</span><strong>'+esc(s?.rating??'—')+'</strong><small>'+(rank?'#'+rank+' in '+esc(D.meta.section_label):'Needs 4 singles matches to rank')+'</small></div><div class="lab-hero-grid">'+profileMetric('Record',record,s?s.matches+' completed singles':'No results')+profileMetric('Game share',gameShare==null?'—':Math.round(gameShare)+'%',s?s.gf+'–'+s.ga+' games':'')+profileMetric('Power trend',powerChange==null?'—':(powerChange>=0?'+':'')+powerChange,firstPower!=null?'since first result':'')+profileMetric('Current run',run?(run.won?'W':'L')+run.length:'—',longestWin?'best win streak '+longestWin:'')+'</div></section>';
  html+='<section class="profile-section lab-section"><div class="lab-section-head"><div><h3>Match insight</h3></div></div><div class="lab-insight-grid">'+profileMetric('Actual wins',expectation?.actualWins??'—',expectation?'Expected '+expectation.expectedWins.toFixed(2)+' wins':'No expectation data')+profileMetric('Wins vs expected',expectation?signed(expectation.winsAboveExpected,2)+' wins':'—',expectation?'Game share '+signed(expectation.gameShareAboveExpected,1)+'% vs expected':'')+profileSchedule(schedule)+profileMetric('vs higher-rated',higherRecord,s?'using current Power as the line':'')+'</div>'+profileMatchupSection(name,matches)+'</section>'+roleSection(insight,name)+matchExplorerSection(matches,s?.rating);
  html+='<div class="lab-layout"><div class="lab-main"><section class="profile-section lab-section"><div class="lab-section-head"><div><h3>Momentum</h3></div><span>'+recentText+' last '+last.length+'</span></div>'+historyChart(name)+'<div class="lab-momentum-grid">'+profileMetric('Last three games',last.length?recentGf+'–'+recentGa:'—',last.length?Math.round(100*recentGf/(recentGf+recentGa))+'% game share':'')+profileMetric('Average margin',averageMargin==null?'—':(averageMargin>=0?'+':'')+averageMargin.toFixed(1),matches.length?'games per match':'')+profileMetric('Close matches',matches.length?closest+'/'+matches.length:'—',matches.length?'within two games':'')+'</div></section>'+performanceSection(insight)+'</div><aside class="lab-side"><section class="profile-section lab-section"><div class="lab-section-head"><div><h3>Headline results</h3></div></div><div class="lab-highlights">'+profileHighlight('Best-rated win',bestWin,bestWin?'Opponent Power '+bestWin.oppRating:'')+profileHighlight('Top performance',bestPerformance,bestPerformance?'Performance '+bestPerformance.performance:'')+profileHighlight('Toughest loss',toughestLoss,toughestLoss?'Opponent Power '+toughestLoss.oppRating:'')+(bestWin||bestPerformance||toughestLoss?'':'<p class="small-note">No comparable singles performances yet.</p>')+'</div></section><section class="profile-section lab-section lab-doubles"><div class="lab-section-head"><div><h3>Doubles</h3><p>Partner-adjusted evidence, including the fitted pair residual.</p></div></div>'+doublesSection(d,partners,o)+'</section></aside></div>';$('#profileContent').innerHTML=html;renderProfileMatchExplorer(matches,s?.rating);
  $('#profileOverlay').classList.remove('hidden');document.body.classList.add('modal-open');
}
function historicalPlayerMatches(name,throughRound){return playerMatches(name).filter(match=>Number(match.round)<=Number(throughRound)).map(match=>{const snapshot=historicalSnapshot(match.opp,match.round),oppRating=snapshot?.[1]??match.oppRating,performance=oppRating==null?null:Math.round(oppRating+(D.meta?.ratingProbabilityScale||450)*Math.log((match.gf+.5)/(match.ga+.5)));return{...match,oppRating,performance}})}
function historicalScoreProfile(rows){
  const out={straightSetMatches:0,scoredMatches:0,setsWon:0,setsLost:0,tiebreaksWon:0,tiebreaksLost:0,decidingWins:0,decidingLosses:0};
  for(const row of rows){const components=scoreComponents(row.score),sets=components.sets;if(!sets.length)continue;out.scoredMatches++;let won=0,lost=0;for(const [a,b] of sets){if(a>b)won++;else if(b>a)lost++;if((a===7&&b===6)||(a===6&&b===7)){if(a>b)out.tiebreaksWon++;else out.tiebreaksLost++;}}if(components.matchTiebreak){if(row.result==='W')out.tiebreaksWon++;else if(row.result==='L')out.tiebreaksLost++;if(won===lost){if(row.result==='W')won++;else if(row.result==='L')lost++;}}out.setsWon+=won;out.setsLost+=lost;if((won===2&&lost===0)||(lost===2&&won===0))out.straightSetMatches++;if(won&&lost){if(won>lost)out.decidingWins++;else if(lost>won)out.decidingLosses++;}}
  return out;
}
function scoreComponents(score){
  const rows=[...String(score||'').matchAll(/(\[)?(\d+)\s*[-–]\s*(\d+)(\])?/g)],sets=[],matchTiebreak=[];
  for(const row of rows){const value=[Number(row[2]),Number(row[3])];if(row[1]||row[4])matchTiebreak.push(value);else sets.push(value)}
  return{sets,matchTiebreak:matchTiebreak[0]||null};
}
function historicalInsight(name,throughRound){
  const base=playerInsight(name);if(!base)return null;
  const rows=(base.rivalries||[]).flatMap(rival=>(rival.rows||[]).map(row=>({...row,opponent:rival.opponent}))).filter(row=>Number(row.round)<=Number(throughRound));
  if(!rows.length)return null;
  const positions=new Map(),rivals=new Map(),deltas=rows.map(row=>Number(row.performanceDelta)).filter(Number.isFinite);
  for(const row of rows){
    const games=scoreComponents(row.score).sets;
    const pos=Number(row.position);if(Number.isFinite(pos)){const item=positions.get(pos)||{position:pos,matches:0,wins:0,gamesFor:0,gamesAgainst:0,expected:0};item.matches++;if(row.result==='W')item.wins++;item.expected+=Number(row.expectedWinProbability)||0;for(const score of games){item.gamesFor+=score[0];item.gamesAgainst+=score[1];}positions.set(pos,item)}
    const rival=rivals.get(row.opponent)||{opponent:row.opponent,rows:[],wins:0,losses:0,gamesFor:0,gamesAgainst:0,expected:0};rival.rows.push(row);if(row.result==='W')rival.wins++;else rival.losses++;rival.expected+=Number(row.expectedWinProbability)||0;for(const score of games){rival.gamesFor+=score[0];rival.gamesAgainst+=score[1];}rivals.set(row.opponent,rival);
  }
  const mean=deltas.length?deltas.reduce((sum,value)=>sum+value,0)/deltas.length:null,volatility=deltas.length>1?Math.sqrt(deltas.reduce((sum,value)=>sum+(value-mean)**2,0)/deltas.length):null;
  return{team:base.team,roundsPlayed:new Set(rows.map(row=>row.fixtureId||row.round+'|'+row.opponent)).size,teamCompletedTies:throughRound,availabilityPercent:throughRound?Math.round(100*new Set(rows.map(row=>row.round)).size/throughRound):null,averageListedPosition:positions.size?(rows.reduce((sum,row)=>sum+(Number(row.position)||0),0)/rows.filter(row=>Number.isFinite(Number(row.position))).length).toFixed(1):null,emergencyAppearances:0,positions:[...positions.values()].sort((a,b)=>a.position-b.position).map(item=>({...item,record:item.wins+'–'+(item.matches-item.wins),gameShare:item.gamesFor+item.gamesAgainst?Math.round(100*item.gamesFor/(item.gamesFor+item.gamesAgainst)):0,expectedWins:item.expected.toFixed(1)})),rivalries:[...rivals.values()].map(item=>({...item,record:item.wins+'–'+item.losses,matches:item.rows.length,winsAboveExpected:item.wins-item.expected})).sort((a,b)=>b.matches-a.matches||a.opponent.localeCompare(b.opponent)),consistency:{matches:deltas.length,averagePerformanceDelta:mean==null?null:Number(mean.toFixed(1)),volatility:volatility==null?null:Number(volatility.toFixed(1)),score:volatility==null?null:Math.max(0,Math.round(100-volatility*4))},scoreProfile:historicalScoreProfile(rows)};
}
function openHistoricalProfile(name,round){
  const snap=historicalSnapshot(name,round);if(!snap)return;
  activeProfilePlayer=name;
  const actualRound=Number(snap[0]),current=singles.find(row=>row.player===name),matches=historicalPlayerMatches(name,actualRound),insight=historicalInsight(name,actualRound),wins=matches.filter(match=>match.won).length,gf=matches.reduce((total,match)=>total+match.gf,0),ga=matches.reduce((total,match)=>total+match.ga,0),rows=historicalRows(actualRound),row=rows.find(item=>item.player===name),values=(D.ratingHistory?.players?.[name]||[]).filter(value=>Number(value[0])<=actualRound),previous=values.length>1?values[values.length-2]:null,change=previous?snap[1]-previous[1]:null,firstPower=values[0]?.[1],seasonChange=firstPower==null?null:snap[1]-firstPower,last=matches.slice(-3),recentWins=last.filter(match=>match.won).length,recentGf=last.reduce((total,match)=>total+match.gf,0),recentGa=last.reduce((total,match)=>total+match.ga,0),averageMargin=matches.length?matches.reduce((total,match)=>total+match.gf-match.ga,0)/matches.length:null,bestPerformance=[...matches].filter(match=>match.performance!=null).sort((a,b)=>b.performance-a.performance)[0],bestWin=[...matches].filter(match=>match.won&&match.oppRating!=null).sort((a,b)=>b.oppRating-a.oppRating)[0],toughestLoss=[...matches].filter(match=>!match.won&&match.oppRating!=null).sort((a,b)=>b.oppRating-a.oppRating)[0],date=historicalRoundDate(actualRound),team=snap[4]||current?.team||'',record=wins+'–'+(matches.length-wins),recentText=last.length?recentWins+'–'+(last.length-recentWins):'—';
  let html='<div class="profile-head lab-head"><div><div class="kicker">PLAYER LAB · AFTER ROUND '+actualRound+'</div><h2>'+esc(name)+'</h2><p>'+teamName(team)+(date?' · '+esc(date):'')+'</p></div><span class="confidence conf-mid"><b>Historical snapshot</b><small>'+matches.length+' singles matches known</small></span></div>';
  html+='<section class="lab-hero"><div class="lab-power"><span>Power after Round '+actualRound+'</span><strong>'+snap[1]+'</strong><small>'+(row?.rank?'#'+row.rank+' in the qualified table':'Provisional at this point')+'</small></div><div class="lab-hero-grid">'+profileMetric('Record',record,matches.length+' completed singles')+profileMetric('Game share',gf+ga?Math.round(100*gf/(gf+ga))+'%':'—',gf+'–'+ga+' games')+profileMetric('Round movement',change==null?'—':(change>=0?'+':'')+change,change==null?'first snapshot':'from previous round')+profileMetric('Season trend',seasonChange==null?'—':(seasonChange>=0?'+':'')+seasonChange,firstPower!=null?'since first result':'')+'</div></section>';
  html+='<section class="profile-section lab-section"><div class="lab-section-head"><div><h3>Historical matchup</h3></div></div>'+profileMatchupSection(name,matches,actualRound)+'</section>'+roleSection(insight,name,actualRound)+matchExplorerSection(matches,snap[1],true);
  html+='<div class="lab-layout"><div class="lab-main"><section class="profile-section lab-section"><div class="lab-section-head"><div><h3>Momentum to this round</h3></div><span>'+recentText+' last '+last.length+'</span></div>'+historyChart(name,actualRound)+'<div class="lab-momentum-grid">'+profileMetric('Last three games',last.length?recentGf+'–'+recentGa:'—',last.length?Math.round(100*recentGf/(recentGf+recentGa))+'% game share':'')+profileMetric('Average margin',averageMargin==null?'—':(averageMargin>=0?'+':'')+averageMargin.toFixed(1),matches.length?'games per match':'')+(Number.isFinite(snap[2])?profileMetric('Uncertainty','±'+snap[2],snap[3]+' matches modelled'):'')+'</div></section>'+performanceSection(insight)+'</div><aside class="lab-side"><section class="profile-section lab-section"><div class="lab-section-head"><div><h3>Headline results</h3></div></div><div class="lab-highlights">'+profileHighlight('Best-rated win',bestWin,bestWin?'Opponent Power '+bestWin.oppRating+' at the time':'')+profileHighlight('Top performance',bestPerformance,bestPerformance?'Performance '+bestPerformance.performance:'')+profileHighlight('Toughest loss',toughestLoss,toughestLoss?'Opponent Power '+toughestLoss.oppRating+' at the time':'')+(bestWin||bestPerformance||toughestLoss?'':'<p class="small-note">No comparable singles performances yet.</p>')+'</div></section><section class="profile-section lab-section"><div class="lab-section-head"><div><h3>Round context</h3></div></div><div class="lab-context-actions"><button class="button secondary" type="button" data-history-table="'+actualRound+'">Round '+actualRound+' ratings</button><button class="button secondary" type="button" data-player="'+esc(name)+'">Current Player Lab</button></div></section></aside></div>';
  $('#profileContent').innerHTML=html;renderProfileMatchExplorer(matches,snap[1],true);$('#profileOverlay').classList.remove('hidden');document.body.classList.add('modal-open');
}
function scheduleBand(value, rows){const values=rows.map(row=>row.averageOpponent).sort((a,b)=>a-b),median=values[Math.floor(values.length/2)],spread=Math.max(1,(values[Math.floor(values.length*.75)]-values[Math.floor(values.length*.25)])/1.35),z=(value-median)/spread;return z>=1?'Brutal':z>=.45?'Demanding':z>=-.15?'Tough':z>=-.65?'Typical':z>=-1.1?'Friendly':'Light'}
function scheduleDivider(label){return'<tr class="schedule-band-divider band-'+label.toLowerCase()+'"><td colspan="5"><span>'+esc(label)+'</span></td></tr>'}function openSchedule(){const rows=auxiliaryPlayer(activeProfilePlayer)?auxiliaryCache.sos:(D.strengthOfSchedule||[]);let last='',body='';for(const row of rows){const band=scheduleBand(row.averageOpponent,rows);if(band!==last){body+=scheduleDivider(band);last=band}body+='<tr><td>#'+row.rank+'</td><td>'+personButton(row.player)+'</td><td>'+teamName(row.team)+'</td><td><b>'+row.averageOpponent+'</b></td><td>'+row.matches+'</td></tr>'}$('#sosContent').innerHTML='<div class="overlay-title"><div class="kicker">STRENGTH OF SCHEDULE</div><h2>Opponent difficulty</h2><p>Higher average opponent Power means a harder schedule.</p></div><div class="table-wrap"><table class="schedule-table"><thead><tr><th>Rank</th><th>Player</th><th>Team</th><th>Average opponent</th><th>Matches</th></tr></thead><tbody>'+body+'</tbody></table></div>';$('#sosOverlay').classList.remove('hidden');document.body.classList.add('modal-open')}

function signed(value,digits=1){const n=Number(value);return(Number.isFinite(n)&&n>0?'+':'')+(Number.isFinite(n)?n.toFixed(digits):'—')}
function profileMatchupResult(name,opponent,round=null){
  const rating=round?historicalSnapshot(name,round)?.[1]:singles.find(row=>row.player===name)?.rating;
  const otherRating=round?historicalSnapshot(opponent,round)?.[1]:singles.find(row=>row.player===opponent)?.rating;
  if(rating==null||otherRating==null)return'<p class="small-note">A rating is not available for both players at this point.</p>';
  let probability=1/(1+Math.exp(-(rating-otherRating)/(D.meta?.ratingProbabilityScale||450)));
  if(!round){
    const players=D.matchupMatrix?.players||[],ai=players.findIndex(row=>row.player===name),bi=players.findIndex(row=>row.player===opponent);
    if(ai>=0&&bi>=0)probability=D.matchupMatrix.probabilities?.[ai]?.[bi]??probability;
  }
  const matches=(round?historicalPlayerMatches(name,round):playerMatches(name)).filter(match=>match.opp===opponent),wins=matches.filter(match=>match.won).length,gf=matches.reduce((total,match)=>total+match.gf,0),ga=matches.reduce((total,match)=>total+match.ga,0),gap=rating-otherRating;
  return'<div class="lab-matchup-result"><div class="lab-matchup-projection"><span>'+esc(D.meta?.singlesOnly?'Predicted game share':round?'Power-based outlook':'Projected win chance')+'</span><b>'+Math.round(100*probability)+'%</b><small>'+esc(name)+' · '+rating+' Power</small></div><div class="lab-matchup-stats"><div><span>Power gap</span><b>'+(gap>0?'+':'')+gap+'</b></div><div><span>Past meetings</span><b>'+(matches.length?wins+'–'+(matches.length-wins):'—')+'</b></div><div><span>Games</span><b>'+(matches.length?gf+'–'+ga:'—')+'</b></div></div><p class="explain">'+(round?'Ratings and past meetings are limited to results through Round '+round+'.':'Projection uses the section matchup model; past meetings use recorded singles results.')+'</p></div>';
}
function profileMatchupSection(name,matches,round=null){
  const source=round?historicalRows(round).map(row=>({player:row.player,rating:row.rating})):Array.isArray(D.matchupMatrix?.players)&&D.matchupMatrix.players.length?D.matchupMatrix.players:singles.map(row=>({player:row.player,rating:row.rating})),players=source.filter(row=>row.player!==name);
  if(!players.length)return'<div class="lab-matchup"><p>No other rated players are available in this section.</p></div>';
  const available=new Set(players.map(row=>row.player)),frequent=matches.slice().reverse().find(match=>available.has(match.opp))?.opp,selected=frequent||players[0].player;
  return'<div class="lab-matchup"><label class="lab-matchup-label">Compare with<select data-profile-opponent data-profile-player="'+esc(name)+'" data-profile-round="'+(round||'')+'">'+players.map(row=>'<option value="'+esc(row.player)+'"'+(row.player===selected?' selected':'')+'>'+esc(row.player)+' · '+row.rating+'</option>').join('')+'</select></label><div data-profile-matchup-result>'+profileMatchupResult(name,selected,round)+'</div></div>';
}
let globalPlayerRequest=0;
async function openGlobalPlayer(sectionCode,player,seasonKey=''){
  const request=++globalPlayerRequest,sectionRequest=loadingToken;
  try{
    let catalog=currentCatalog(),season=null;
    if(seasonKey){
      const history=await ensureHistoryCatalog();season=history?.seasons.find(row=>row.id===seasonKey);
      if(!season)throw Error('That season could not be found.');
      catalog=historySeasonSections(season);
    }
    if(request!==globalPlayerRequest||sectionRequest!==loadingToken)return;
    const section=catalog.find(row=>row.section_code===sectionCode);
    if(!section)throw Error('That section could not be found.');
    // Check the destination before changing the user's active season.
    let payload=null;
    if(!section.is_custom){const response=await fetch(section.data_path||('data/site/sections/'+sectionCode+'.json'),{cache:'no-store'});if(!response.ok)throw Error('That section could not be loaded.');payload=await response.json()}
    if(request!==globalPlayerRequest||sectionRequest!==loadingToken)return;
    activeHistorySeasonId=season&&!season.is_current?season.id:null;
    viewCatalog=activeHistorySeasonId?catalog:currentCatalog();setupSelectors();
    if(!activeHistorySeasonId)localStorage.removeItem('brta-history-selection');
    if(await loadSection(sectionCode,payload)===false)return;
    if(request!==globalPlayerRequest||D?.meta?.section_code!==sectionCode)return;
    switchPage('ratings');openProfile(player);
    const banner=document.createElement('div');banner.className='profile-section-switch';
    banner.innerHTML='<div><b>'+esc(D.meta.season_label||season?.season_label||'Current season')+' · '+esc(D.meta.section_label)+'</b><small>'+esc(competitionLabel(D.meta.competition_code))+'</small></div><button class="button primary" type="button" data-switch-player-section="'+esc(player)+'">Switch to this section</button>';
    $('#profileContent').prepend(banner);
  }catch(error){if(request===globalPlayerRequest&&sectionRequest===loadingToken)$('#ratingsHint').textContent=error.message+' Please try again.'}
}
function switchToPlayerSection(player){
  ratingScope='section';ratingRound=null;localStorage.setItem('brta-rating-scope','section');
  $('#search').value=player;$('#teamFilter').value='';focusedSearchPlayer=player;
  if(!singles.some(row=>row.player===player)&&dinds.some(row=>row.player===player))ratingView='doublesPlayers';
  else ratingView='singles';
  $$('.subtab').forEach(button=>button.classList.toggle('active',button.dataset.rating===ratingView));
  close('#profileOverlay');switchPage('ratings');renderRatings();
}


function roundHighlight(title,item,kind){if(!item)return'<div class="round-highlight '+kind+'"><span>'+title+'</span><b>None this round</b></div>';return'<div class="round-highlight '+kind+'"><span>'+title+'</span><b>'+esc(item.winner)+' '+esc(item.score)+' '+esc(item.loser)+'</b><small>'+(title==='Biggest upset'?'Rating gap '+Math.round(item.gap)+' points':title==='Top performance'?'Performance ≈ '+item.performance:title==='Most dominant'?'Game margin '+item.margin:'Closest scoreline')+'</small></div>'}
function clubBaseName(value){
  let name=String(value??'').replace(/\s+/g,' ').trim(),previous='';
  const colours=Object.keys(TEAM_COLOURS).join('|'),partner="ap|gp|gm|gphc|mlc|scot|scotch|xavier|bodley|beech|beec|st\\s+kevin'?s?";
  while(name&&name!==previous){previous=name;name=name.replace(/\s+(?:no\.?\s*)?#?\d+\s*$/i,'').replace(new RegExp('\\s+(?:'+colours+')(?:s\\d+)?\\s*$','i'),'').replace(new RegExp('\\s+(?:'+partner+')#?\\s*$','i'),'').replace(new RegExp('\\s+(?:'+partner+')\\s*#?\\d+\\s*$','i'),'').trim()}
  return ({kptc:'Kings Park','kings park tc':'Kings Park','kings park tennis club':'Kings Park'})[name.toLowerCase()]||name;
}
function clubTeamButton(name){return D.meta?.is_custom?teamName(name):'<button type="button" class="club-link" data-club-team="'+esc(name)+'">'+teamName(name)+'</button>'}

function sumClub(rows,key){return rows.reduce((total,row)=>total+(Number(row[key])||0),0)}
function uniqueClubCount(rows,predicate){return new Set(rows.filter(predicate).map(row=>row.season_id+'|'+row.section_code)).size}
function clubLabelStats(rows){const played=sumClub(rows,'played'),wins=sumClub(rows,'wins'),draws=sumClub(rows,'draws'),losses=sumClub(rows,'losses'),gamesFor=sumClub(rows,'games_for'),gamesAgainst=sumClub(rows,'games_against');return{played,wins,draws,losses,gamesFor,gamesAgainst,record:wins+'–'+draws+'–'+losses,winRate:played?Math.round(100*(wins+draws*.5)/played)+'%':'—',gameShare:gamesFor+gamesAgainst?Math.round(100*gamesFor/(gamesFor+gamesAgainst))+'%':'—'}}
let clubIndex=null,clubIndexPromise=null,clubDetailsCache=new Map(),activeClubZone=null;
async function loadClubIndex(){
  if(clubIndex)return clubIndex;
  if(!clubIndexPromise)clubIndexPromise=fetch('data/archive/clubs.json',{cache:'no-store'}).then(response=>response.ok?response.json():Promise.reject(new Error('Club history is still being prepared.'))).then(data=>{clubIndex=data;return data}).catch(error=>{clubIndexPromise=null;throw error});
  return clubIndexPromise;
}
async function loadClubCompetition(code){
  const manifest=await loadClubIndex(),competition=manifest.competitions?.[code];if(!competition)throw Error('That competition has no Club Zone archive.');
  if(clubDetailsCache.has(code))return clubDetailsCache.get(code);
  const detail=await fetch(competition.path,{cache:'no-store'}).then(response=>response.ok?response.json():Promise.reject(new Error('That club archive could not be loaded.')));
  const joined={...competition,...detail};clubDetailsCache.set(code,joined);return joined;
}
function clubZoneEntries(){if(!activeClubZone)return[];const {section='',season='',variant=''}=activeClubZone;return activeClubZone.club.entries.filter(row=>(!section||row.section_label===section)&&(!season||row.season_label===season)&&(!variant||row.team===variant))}
function clubZoneFixtures(){if(!activeClubZone)return[];const {section='',season='',variant='',result='',opponent=''}=activeClubZone;return(activeClubZone.club.fixtures||[]).filter(row=>(!section||row.section_label===section)&&(!season||row.season_label===season)&&(!variant||row.team===variant)&&(!result||row.result===result)&&(!opponent||row.opponent_club===opponent))}
function clubMetric(label,value,detail=''){return '<div class="lab-metric club-metric"><span>'+esc(label)+'</span><b>'+esc(value??'—')+'</b>'+(detail?'<small>'+esc(detail)+'</small>':'')+'</div>'}
function clubTrend(rows){
  const groups=new Map();for(const row of rows){const item=groups.get(row.season_order)||{label:row.season_label,order:row.season_order,total:0,count:0};item.total+=Number(row.position)||0;item.count++;groups.set(row.season_order,item)}
  const values=[...groups.values()].sort((a,b)=>a.order-b.order).map(item=>({...item,value:item.count?item.total/item.count:0}));if(values.length<2)return'<p class="small-note">A trend appears once the club has two recorded seasons.</p>';
  const width=620,height=128,pad=18,min=Math.min(...values.map(item=>item.value)),max=Math.max(...values.map(item=>item.value)),range=Math.max(1,max-min),points=values.map((item,index)=>{const x=pad+index*(width-pad*2)/(values.length-1),y=pad+(item.value-min)*(height-pad*2)/range;return x.toFixed(1)+','+y.toFixed(1)}).join(' ');
  return'<svg class="club-trend" viewBox="0 0 '+width+' '+height+'" role="img" aria-label="Average finishing position by season, lower is better"><line x1="'+pad+'" y1="'+pad+'" x2="'+(width-pad)+'" y2="'+pad+'" class="club-trend-grid"/><line x1="'+pad+'" y1="'+(height-pad)+'" x2="'+(width-pad)+'" y2="'+(height-pad)+'" class="club-trend-grid"/><polyline points="'+points+'" class="club-trend-line"/>'+values.map((item,index)=>{const [x,y]=points.split(' ')[index].split(',');return'<circle cx="'+x+'" cy="'+y+'" r="4" class="club-trend-point"><title>'+esc(item.label)+' · average finish #'+item.value.toFixed(1)+'</title></circle>'}).join('')+'</svg><p class="explain">Average finishing position by season. Lower is better; a season with several club teams is averaged across them.</p>';
}
function clubSeasonCards(rows){
  const groups=new Map();for(const row of rows){const item=groups.get(row.season_id)||{label:row.season_label,order:row.season_order,rows:[]};item.rows.push(row);groups.set(row.season_id,item)}
  return[...groups.values()].sort((a,b)=>b.order-a.order).map(item=>{const stats=clubLabelStats(item.rows),best=Math.min(...item.rows.map(row=>Number(row.position)||Infinity)),titles=uniqueClubCount(item.rows,row=>row.champion),teams=[...new Set(item.rows.map(row=>row.team))];return'<article class="club-season-card"><div><span>'+esc(item.label)+'</span><b>'+(titles?titles+' title'+(titles===1?'':'s'):'No title')+'</b></div><strong>Best finish #'+best+'</strong><p>'+teams.map(teamName).join(' · ')+'</p><small>Best finish #'+best+' · '+stats.record+' · '+stats.winRate+'</small></article>'}).join('');
}
function clubSectionProfile(rows){
  const groups=new Map();for(const row of rows){const item=groups.get(row.section_label)||{label:row.section_label,rows:[]};item.rows.push(row);groups.set(row.section_label,item)}
  return[...groups.values()].sort((a,b)=>b.rows.length-a.rows.length||a.label.localeCompare(b.label)).map(item=>{const stats=clubLabelStats(item.rows),best=Math.min(...item.rows.map(row=>Number(row.position)||Infinity)),avg=(item.rows.reduce((total,row)=>total+(Number(row.position)||0),0)/item.rows.length).toFixed(1);return'<tr><td>'+esc(item.label)+'</td><td>'+item.rows.length+'</td><td>#'+best+'</td><td>#'+avg+'</td><td>'+stats.record+'</td></tr>'}).join('');
}
function clubRivals(rows){
  const groups=new Map();for(const row of rows){const item=groups.get(row.opponent_club)||{name:row.opponent_club,rows:[]};item.rows.push(row);groups.set(row.opponent_club,item)}
  return[...groups.values()].map(item=>{const w=item.rows.filter(row=>row.result==='W').length,l=item.rows.filter(row=>row.result==='L').length,d=item.rows.length-w-l;return{...item,record:w+'–'+d+'–'+l}}).sort((a,b)=>b.rows.length-a.rows.length||a.name.localeCompare(b.name)).slice(0,8);
}
function clubResultRow(row){const score=row.points_for!=null&&row.points_against!=null?row.points_for+'–'+row.points_against:(row.rubbers_for!=null&&row.rubbers_against!=null?row.rubbers_for+'–'+row.rubbers_against:'Result');return'<article class="club-result-row"><span class="club-result-badge '+(row.result==='W'?'win':row.result==='L'?'loss':'')+'">'+row.result+'</span><b>'+teamName(row.team)+' <em>v</em> '+teamName(row.opponent)+'</b><strong>'+esc(score)+'</strong><small>'+esc(row.season_label)+' · '+esc(row.section_label)+' · '+esc(row.label||('Round '+(row.round??'—')))+'</small></article>'}
function clubZoneControls(competition,club,rows){
  const seasons=[...new Set(club.entries.map(row=>row.season_label))],variants=[...new Set(club.entries.map(row=>row.team))].sort((a,b)=>a.localeCompare(b)),opponents=[...new Set((club.fixtures||[]).map(row=>row.opponent_club))].sort((a,b)=>a.localeCompare(b)),{section='',season='',variant='',result='',opponent=''}=activeClubZone;
  return'<section class="club-zone-controls"><label>Section<select id="clubZoneSection"><option value="">All sections</option>'+competition.sections.map(label=>'<option value="'+esc(label)+'"'+(label===section?' selected':'')+'>'+esc(label)+'</option>').join('')+'</select></label><label>Season<select id="clubZoneSeason"><option value="">All seasons</option>'+seasons.map(label=>'<option value="'+esc(label)+'"'+(label===season?' selected':'')+'>'+esc(label)+'</option>').join('')+'</select></label><label>Team variant<select id="clubZoneVariant"><option value="">Combined club</option>'+variants.map(label=>'<option value="'+esc(label)+'"'+(label===variant?' selected':'')+'>'+teamName(label).replace(/<[^>]*>/g,'')+'</option>').join('')+'</select></label><label>Opponent<select id="clubZoneOpponent"><option value="">All opponents</option>'+opponents.map(label=>'<option value="'+esc(label)+'"'+(label===opponent?' selected':'')+'>'+esc(label)+'</option>').join('')+'</select></label><label>Result<select id="clubZoneResult"><option value="">All results</option>'+['W','L','D'].map(value=>'<option value="'+value+'"'+(value===result?' selected':'')+'>'+({W:'Wins',L:'Losses',D:'Draws'})[value]+'</option>').join('')+'</select></label></section>';
}
function renderClubZone(){
  if(!activeClubZone)return;
  const {competition,club}=activeClubZone,entries=clubZoneEntries(),fixtures=clubZoneFixtures(),allEntries=club.entries||[],stats=clubLabelStats(entries),allStats=clubLabelStats(allEntries),first=[...allEntries].sort((a,b)=>a.season_order-b.season_order)[0],last=[...allEntries].sort((a,b)=>b.season_order-a.season_order)[0],championships=uniqueClubCount(entries,row=>row.champion),finals=uniqueClubCount(entries,row=>row.finalist),semifinals=uniqueClubCount(entries,row=>row.semifinalist),best=entries.length?Math.min(...entries.map(row=>Number(row.position)||Infinity)):'—',average=entries.length?(entries.reduce((total,row)=>total+(Number(row.position)||0),0)/entries.length).toFixed(1):'—',teams=new Set(entries.map(row=>row.team)).size,seasons=new Set(entries.map(row=>row.season_id)).size,rivals=clubRivals(fixtures),players=(club.players||[]).slice(0,8),resultLimit=activeClubZone.resultLimit||16,isCurrent=allEntries.some(row=>row.season_id==='current'),activity=isCurrent?'Established '+(first?.season_label||'in the recorded archive')+' · active in '+(last?.season_label||'the current season'):'Active '+(first?.season_label||'in the recorded archive')+' to '+(last?.season_label||'the last recorded season');
  let out='<div class="profile-head lab-head club-zone-head"><div><div class="kicker">CLUB ZONE · '+esc(competition.label)+'</div><h2>'+teamName(club.name)+'</h2><p>'+esc(activity)+' · '+allEntries.length+' historical team entries</p></div><span class="confidence conf-mid"><b>'+allStats.record+' all-time</b><small>'+new Set(allEntries.map(row=>row.season_id)).size+' seasons · '+new Set(allEntries.map(row=>row.team)).size+' variants</small></span></div>';
  out+='<p class="club-recap">'+teamName(club.name)+' have recorded <b>'+allEntries.length+' team entries</b> across <b>'+new Set(allEntries.map(row=>row.season_id)).size+' '+competition.label+' seasons</b>, with <b>'+uniqueClubCount(allEntries,row=>row.champion)+' championship'+(uniqueClubCount(allEntries,row=>row.champion)===1?'':'s')+'</b>, a best finish of <b>#'+Math.min(...allEntries.map(row=>Number(row.position)||Infinity))+'</b>, and a '+allStats.winRate+' team-tie points rate.</p>';
  out+=clubZoneControls(competition,club,entries);
  if(!entries.length){out+='<section class="club-empty"><h3>No matching club entry</h3><p>Try clearing one of the filters.</p></section>';$('#clubZoneContent').innerHTML=out;return}
  out+='<section class="club-hero-grid">'+clubMetric('Filtered record',stats.record,stats.played+' completed ties · '+stats.winRate)+' '+clubMetric('Trophy cabinet',championships+' title'+(championships===1?'':'s'),finals+' grand finals · '+teams+' team variants')+' '+clubMetric('Section record','#'+best+' best',average==='—'?'':'average finish #'+average)+' '+clubMetric('Game share',stats.gameShare,stats.gamesFor+'–'+stats.gamesAgainst+' games')+'</section>';
  out+='<div class="club-zone-layout"><main class="club-zone-main"><section class="club-panel"><div class="club-panel-head"><div><h3>Season journey</h3></div><span>'+seasons+' seasons</span></div><div class="club-season-grid">'+clubSeasonCards(entries)+'</div></section><section class="club-panel"><div class="club-panel-head"><div><h3>Results explorer</h3></div><span>'+fixtures.length+' results</span></div><div class="club-results-list">'+fixtures.slice(0,resultLimit).map(clubResultRow).join('')+(fixtures.length>resultLimit?'<button type="button" id="clubResultMore" class="club-results-more">Show '+Math.min(16,fixtures.length-resultLimit)+' more results</button>':'')+'</div></section><section class="club-panel"><div class="club-panel-head"><div><h3>Section profile</h3></div></div><div class="table-wrap"><table class="club-section-table"><thead><tr><th>Section</th><th>Entries</th><th>Best</th><th>Average</th><th>Record</th></tr></thead><tbody>'+clubSectionProfile(entries)+'</tbody></table></div></section><details class="club-history-details"><summary>Open full standings history · '+entries.length+' team entries</summary><div class="table-wrap"><table class="club-history-table"><thead><tr><th>Season</th><th>Section</th><th>Team</th><th>Finish</th><th>Record</th><th>Games</th><th>Finals</th></tr></thead><tbody>'+entries.map(row=>'<tr><td>'+esc(row.season_label)+'</td><td>'+esc(row.section_label)+'</td><td>'+teamName(row.team)+'</td><td><b>#'+esc(row.position)+'</b></td><td>'+esc(row.wins)+'–'+esc(row.draws)+'–'+esc(row.losses)+'</td><td>'+esc(row.games_for)+'–'+esc(row.games_against)+'</td><td>'+(row.champion?'<b class="club-champion">Champion</b>':row.finalist?'Grand final':row.semifinalist?'Semifinal':'—')+'</td></tr>').join('')+'</tbody></table></div></details></main><aside class="club-zone-side"><section class="club-panel"><div class="club-panel-head"><div><h3>Performance trend</h3><p>Lower finishing position is better.</p></div></div>'+clubTrend(entries)+'</section><section class="club-panel"><div class="club-panel-head"><div><h3>Club vs club</h3><p>Most common opponents in the selected view.</p></div></div><div class="club-rivals">'+(rivals.length?rivals.map(item=>'<button type="button" class="club-rival" data-club-rival="'+esc(item.name)+'"><span>'+esc(item.name)+'</span><b>'+item.record+'</b><small>'+item.rows.length+' ties</small></button>').join(''):'<p class="small-note">No completed ties recorded.</p>')+'</div></section><section class="club-panel"><div class="club-panel-head"><div><h3>Player history</h3></div></div><div class="club-players">'+(players.length?players.map(player=>'<div><b>'+esc(player.name)+'</b><span>'+player.appearances+' appearances · '+player.wins+' wins</span><small>'+esc(player.first_season)+'–'+esc(player.last_season)+'</small></div>').join(''):'<p class="small-note">No player record was published for this club.</p>')+'</div></section></aside></div>';
  $('#clubZoneContent').innerHTML=out;
}
function openClubMaintenance(){
 activeClubZone=null;close('#clubPickerOverlay');
 $('#clubZoneContent').innerHTML='<div class="overlay-title"><div class="kicker">CLUB ZONE</div><h2 id="clubMaintenanceTitle">Club Zone Under Maintenance ;)</h2></div>';
 const panel=$('#clubZoneOverlay');panel.querySelector('.club-zone-sheet').setAttribute('role','dialog');panel.querySelector('.club-zone-sheet').setAttribute('aria-modal','true');panel.querySelector('.club-zone-sheet').setAttribute('aria-labelledby','clubMaintenanceTitle');panel.classList.remove('hidden');document.body.classList.add('modal-open');$('#clubZoneClose').focus();
}
function openClubPicker(){openClubMaintenance()}
function fillClubChoices(){
  const code=$('#clubPickerCompetition').value,clubSelect=$('#clubPickerClub'),status=$('#clubPickerStatus'),open=$('#clubPickerOpen'),competition=clubIndex?.competitions?.[code];clubSelect.innerHTML='<option value="">Choose a club</option>';clubSelect.disabled=true;open.disabled=true;
  if(!competition){status.textContent='Club history is still being prepared.';return}
  clubSelect.innerHTML+=competition.clubs.map(club=>'<option value="'+esc(club.name)+'">'+esc(club.name)+' · '+club.entries+' entries</option>').join('');clubSelect.disabled=false;status.textContent=competition.clubs.length+' combined clubs across the '+competition.label+' archive.';
}
function openChosenClubZone(){openClubMaintenance()}
function openClubForTeam(team){openClubMaintenance()}
function openRound(){const r=D.roundOverview;if(!r)return;const s=r.summary||{},mover=s.topMover?esc(s.topMover.player)+' +'+s.topMover.change:'No prior snapshot',drop=s.biggestDrop?esc(s.biggestDrop.player)+' '+s.biggestDrop.change:'No prior snapshot';$('#roundContent').innerHTML='<div class="overlay-title"><div class="kicker">LATEST ROUND</div><h2>'+esc(r.label||('Round '+r.round))+'</h2><p>'+esc(roundDate(r.date))+' · '+esc(D.meta.section_label)+'</p></div><div class="round-metrics"><div><span>Completed ties</span><b>'+esc(s.completedFixtures??'—')+'</b></div><div><span>Singles rubbers</span><b>'+esc(s.singlesRubbers??'—')+'</b></div><div><span>Doubles rubbers</span><b>'+esc(s.doublesRubbers??'—')+'</b></div><div><span>Average singles margin</span><b>'+(s.averageSinglesMargin??'—')+' games</b></div></div><div class="round-fixtures">'+r.fixtures.map(f=>'<button class="round-fixture '+(f.status!=='Completed'?'pending':'')+'" data-match-id="'+esc(f.fixtureId)+'"><b>'+esc(f.home)+' '+(f.status==='Completed'?f.homeRubbers+'–'+f.awayRubbers:'v')+' '+esc(f.away)+'</b><span>'+(f.status==='Completed'?'Games '+f.homeGames+'–'+f.awayGames+(f.winner?' · '+esc(f.winner)+' won':''):esc(f.status))+' · View result</span></button>').join('')+'</div><div class="round-highlights">'+roundHighlight('Top performance',r.topPerformance,'top')+roundHighlight('Biggest upset',r.biggestUpset,'upset')+roundHighlight('Most dominant',r.dominantWin,'dominant')+roundHighlight('Closest singles',r.closestMatch,'close')+'</div><div class="round-movers"><div><span>Biggest Power rise</span><b>'+mover+'</b></div><div><span>Largest Power fall</span><b>'+drop+'</b></div></div><p class="small-note">Rating movements use the as-of-round snapshots.</p>';$('#roundOverlay').classList.remove('hidden');document.body.classList.add('modal-open')}
function methodologyHTML(){return'<div class="methodology"><h3>Rating model</h3><p>Expected game probability:</p><div class="equation">p = 1 / (1 + e<sup>−(θᵢ − θⱼ) / 0.75</sup>)</div><p>Match-date weighting and displayed scale:</p><div class="equation">w = 2<sup>− age / 365</sup> &nbsp; · &nbsp; Power = 1500 + 600θ</div><p>Rubbers-format multi-set singles are one contest in the record, while ordinary games and a separately bounded deciding-tiebreak outcome contribute to the likelihood.</p><h3>Individual doubles</h3><div class="equation">θ<sub>team</sub> = (θ<sub>A</sub> + θ<sub>B</sub>) / 2</div><p>Sets and Green Ball need 4 appearances, 2 distinct partners and an identifiable network position. Two-player Rubbers sections show 4+ appearance doubles evidence as partner-dependent.</p><div class="model-export"><b>Calculation audit</b><p>Download this section’s entered rubbers, model settings and fitted rating outputs in a readable JSON file.</p><button id="exportModelAuditBtn" class="button secondary" type="button">Export rating model audit</button></div></div>'}
function brtaRulesHTML(){return'<div class="brta-rules"><p class="rules-intro">The site applies these 2026 Weekend Junior By-Law rules consistently to every Saturday and Sunday AM section.</p><details open><summary>Team points</summary><p><b>Sets and Green Ball:</b> 4 points for a team win, 2 points each for a draw or undecided tie, plus 1 point for each set won and 0.5 for each uncompleted set.</p><p><b>Rubbers:</b> 2 points for a team win, 1 point each for a draw or undecided tie, plus the same set points.</p></details><details><summary>Formats and deciding a tie</summary><p>Sets and Green Ball use four players per team. Rubbers uses two. Team ties are decided by sets, then games if sets are level. Green Ball is first to six games with no tiebreak, so 5–5 is decided by the next game; Rubbers singles uses two 6-game sets with a 10-point match tiebreak if required.</p></details><details><summary>Washouts, byes and forfeits</summary><p>Byes earn no points. A washout or unfinished home-and-away tie receives the draw points plus 0.5 for every uncompleted set; recorded games still count toward percentage. A complete team forfeit awards the receiving team all available set points, but no game percentage.</p></details><details><summary>Ladder order and corrections</summary><p>Teams are ordered by points, then games-for divided by games-against percentage. A result missing after five business days may be awarded to the visiting team. Eligibility, order-of-merit and duplicate-player breaches can also change an official result; TROLS remains the public source of truth for entered scorecards.</p></details><p class="rules-source">Summary of BRTA Weekend Junior By-Laws (effective 1 January 2026). <a href="https://www.baysidetennis.asn.au/wp-content/uploads/2026/08/BRTA-By-Laws-Weekend-Junior-V4.pdf" target="_blank" rel="noopener">Read the official by-laws</a>.</p></div>'}
function readHistorySelection(){try{return JSON.parse(localStorage.getItem('brta-history-selection')||'null')}catch{return null}}
function historySectionCode(){return readHistorySelection()?.sectionCode||''}
async function ensureHistoryCatalog(){if(historyCatalog)return historyCatalog;if(!historyCatalogPromise)historyCatalogPromise=fetch('data/archive/catalog.json',{cache:'no-store'}).then(response=>response.ok?response.json():null).catch(()=>null);const catalog=await historyCatalogPromise;if(catalog)historyCatalog=catalog;else historyCatalogPromise=null;return catalog}
function refreshHistorySectionChoices(seasonId=null,sectionCode=null){const seasonSelect=$('#historySeason'),sectionSelect=$('#historySection'),info=$('#historyInfo');if(!seasonSelect||!sectionSelect)return;const competition=$('#historyCompetition').value,seasons=(historyCatalog?.seasons||[]).filter(x=>x.competition_code===competition);let selected=seasonId||seasonSelect.value;if(!seasons.some(x=>x.id===selected)){const saved=readHistorySelection();selected=activeHistorySeasonId||((saved&&seasons.some(x=>x.id===saved.seasonId))?saved.seasonId:'')||seasons.find(x=>x.is_current)?.id||seasons[0]?.id||''}seasonSelect.innerHTML=seasons.map(x=>'<option value="'+esc(x.id)+'">'+esc(x.season_option_label||x.season_label)+'</option>').join('');seasonSelect.value=selected;const season=seasons.find(x=>x.id===selected),sections=season?.sections||[];let currentSection=sectionCode||sectionSelect.value;const saved=readHistorySelection();if(!sections.some(x=>x.section_code===currentSection))currentSection=saved?.seasonId===selected?saved.sectionCode:'';if(!sections.some(x=>x.section_code===currentSection))currentSection=D?.meta?.competition_code===competition?D.meta.section_code:'';if(!sections.some(x=>x.section_code===currentSection))currentSection=sections[0]?.section_code||'';sectionSelect.innerHTML=sections.map(x=>'<option value="'+esc(x.section_code)+'">'+esc(x.section_label)+'</option>').join('');sectionSelect.value=currentSection;if(info)info.textContent=season?season.season_label+' · '+sections.length+' sections'+(season.is_current?' · live season data':' · TROLS archive'):'No archived seasons available.';$('#historyOpenBtn').disabled=!season||!sections.length}
async function hydrateHistorySettings(){const info=$('#historyInfo');if(!info)return;const catalog=await ensureHistoryCatalog();if(!info.isConnected)return;if(!catalog){info.textContent='The season archive is not available yet.';$('#historyOpenBtn').disabled=true;return}const competition=$('#historyCompetition');competition.innerHTML=[...new Map(catalog.seasons.map(s=>[s.competition_code,competitionLabel(s.competition_code)])).entries()].map(([v,l])=>'<option value="'+esc(v)+'">'+esc(l)+'</option>').join('');const currentComp=D?.meta?.is_custom?'UA':D?.meta?.competition_code||'UA';const saved=readHistorySelection();const preferred=activeHistorySeasonId||saved?.seasonId||catalog.seasons.find(x=>x.competition_code===currentComp&&x.is_current)?.id;competition.value=(catalog.seasons.find(x=>x.id===preferred)?.competition_code||currentComp);refreshHistorySectionChoices(preferred,saved?.sectionCode||D?.meta?.section_code||'');competition.onchange=()=>refreshHistorySectionChoices();$('#historySeason').onchange=()=>refreshHistorySectionChoices($('#historySeason').value,'');$('#historyOpenBtn').onclick=()=>openHistoryChoice();$('#historyCurrentBtn').onclick=()=>goToCurrentSeason()}
async function openHistoryChoice(){
  const season=historyCatalog?.seasons.find(x=>x.id===$('#historySeason').value),section=season?.sections.find(x=>x.section_code===$('#historySection').value),button=$('#historyOpenBtn'),info=$('#historyInfo');
  if(!season||!section)return;
  if(season.is_current){activeHistorySeasonId=null;viewCatalog=currentCatalog();localStorage.removeItem('brta-history-selection');setupSelectors();closeLayoutOverlay();close('#settingsOverlay');switchPage('results');await loadSection(section.section_code);return}
  const historicalCatalog=historySeasonSections(season),meta=historicalCatalog.find(x=>x.section_code===section.section_code),dataPath=meta?.data_path;
  if(!dataPath){if(info)info.textContent='This historical section has no published archive file yet.';return}
  const sectionRequest=loadingToken;button.disabled=true;if(info)info.textContent='Opening '+season.season_label+' · '+section.section_label+'…';
  try{
    const response=await fetch(dataPath+'?v='+encodeURIComponent(DATA.globalSync.checkedAt||''),{cache:'no-store'});
    if(!response.ok)throw Error('The archive file is unavailable.');
    const payload=await response.json();
    if(sectionRequest!==loadingToken||!info.isConnected||$('#layoutOverlay').classList.contains('hidden'))return;
    if(!payload?.meta?.is_archive)throw Error('The selected file is not a historical section.');
    activeHistorySeasonId=season.id;viewCatalog=historicalCatalog;localStorage.setItem('brta-history-selection',JSON.stringify({seasonId:season.id,sectionCode:section.section_code}));
    setupSelectors();primeArchiveGlobalRows();closeLayoutOverlay();close('#settingsOverlay');switchPage('results');await loadSection(section.section_code,payload);
  }catch(error){
    if(info)info.textContent='Could not open this archive: '+error.message+' Your current section has not been changed.';
  }finally{if(button)button.disabled=false}
}
function goToCurrentSeason(){activeHistorySeasonId=null;viewCatalog=currentCatalog();localStorage.removeItem('brta-history-selection');const code=viewCatalog.some(x=>x.section_code===localStorage.getItem('brta-section'))?localStorage.getItem('brta-section'):DATA.defaultSectionCode;setupSelectors();closeLayoutOverlay();close('#settingsOverlay');switchPage('results');loadSection(code)}

function applyProfilePosition(){$('#profileOverlay').dataset.position=profilePosition}
function runModeTransition(complete,{title='Switching interface',message='Preparing layout…',variant='default',duration=500,randomProgress=false,statuses=[],quotes=[]}={}){
  const ov=$('#modeSwitchOverlay'),ring=$('#progressRing');ov.classList.toggle('royal-transition',variant==='royal');ov.classList.toggle('ms-void-transition',variant==='void');ov.querySelector('h2').textContent=title;$('#switchStatus').textContent=message;ring.style.setProperty('--progress','0deg');$('#progressPct').textContent='0%';ov.classList.remove('hidden');ov.setAttribute('data-ms-cutscene','');
  let tip;if(quotes.length){tip=document.createElement('p');tip.className='mode-switch-tip';tip.textContent=quotes[0];ov.querySelector('.mode-switch-box').prepend(tip);}
  const noMotion=localStorage.getItem('brta-animations')==='off'||matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(noMotion){try{complete()}finally{ov.classList.add('hidden');ov.classList.remove('royal-transition','ms-void-transition');ov.removeAttribute('data-ms-cutscene');tip?.remove()}return}
  const start=performance.now(),total=Math.max(100,duration),milestones=randomProgress?window.AmbientParameters.progressPlan(total):null;
  if(milestones)for(let i=1;i<milestones.length;i++)milestones[i].value=Math.max(milestones[i-1].value,milestones[i].value);
  const endGame=randomProgress?window.BRTAWaitingGame?.mount(ov):null;
  let lastQuote=0,lastStatus=0,shown=0;
  const timer=setInterval(()=>{const elapsed=performance.now()-start;let p;
    if(randomProgress){p=window.AmbientParameters.progressAt(milestones,elapsed);}else p=Math.min(100,Math.floor(elapsed/total*100));
    if(randomProgress){shown=Math.min(100,shown+Number(Math.floor(p)>shown));ring.style.setProperty('--progress',Math.min(p,shown+.999)*3.6+'deg');$('#progressPct').textContent=shown+'%';}else{ring.style.setProperty('--progress',p*3.6+'deg');$('#progressPct').textContent=p+'%';}
    const quote=Math.floor(elapsed/5000);if(tip&&quote!==lastQuote){lastQuote=quote;tip.textContent=quotes[quote%quotes.length];tip.style.animation='none';void tip.offsetWidth;tip.style.animation='';}
    const status=Math.floor(elapsed/3500);if(statuses.length&&status!==lastStatus){lastStatus=status;$('#switchStatus').textContent=statuses[status%statuses.length];}
    if(elapsed>=total&&(!randomProgress||shown===100)){clearInterval(timer);endGame?.();$('#progressPct').textContent='100%';ring.style.setProperty('--progress','360deg');setTimeout(()=>{try{complete()}finally{ov.classList.add('hidden');ov.classList.remove('royal-transition','ms-void-transition');ov.removeAttribute('data-ms-cutscene');tip?.remove();}},150);}
  },randomProgress?16:20);
}
function switchInterface(target){if(target===interfaceMode)return;runModeTransition(()=>{localStorage.setItem('brta-interface',target);location.reload()})}
window.runBRTAInterfaceTransition=runModeTransition;
window.BRTASitePreferences={getTheme:()=>theme,setTheme:value=>{theme=value;localStorage.setItem('brta-theme',value);applyTheme()}};
function renderAll(){document.body.classList.toggle('custom-section',!!D.meta?.is_custom);$('#clubZoneBtn').classList.remove('hidden');if(D.meta?.is_custom){close('#clubPickerOverlay');close('#clubZoneOverlay');activeClubZone=null;}statusStrip();teamOptions();renderRatings();renderTeams();renderStandings();renderResults();renderFixtures();$('#roundBtn').textContent=D.roundOverview?(D.roundOverview.label||('Round '+D.roundOverview.round))+' overview':'Latest round';window.dispatchEvent(new Event('brta-section-ready'))}

BRTATeamLabUI.configure({getData:()=>D,escape:esc,teamName,close,showTeams:()=>switchPage('teams'),openMatch:id=>{const page=activePage;openMatch(id);switchPage(page)}});

document.addEventListener('click',e=>{
  if(e.target.closest('[data-aux-backstory]')){if(auxiliaryPlayer(activeProfilePlayer))openAuxiliaryBackstory(auxiliaryCache);return}
  if(e.target.closest('[data-aux-open-archive]')){if(auxiliaryPlayer(activeProfilePlayer))window.AuxiliaryPortal?.open?.();return}
  const choice=e.target.closest('[data-choice-id]');if(choice){const id=choice.dataset.choiceId,value=choice.dataset.choiceValue;closeChoices();if(id==='competitionSelect'){const code=fillSections(value);loadSection(code)}else loadSection(value);return}
  if(!e.target.closest('.section-choice'))closeChoices();
  const switchSection=e.target.closest('[data-switch-player-section]');if(switchSection){switchToPlayerSection(switchSection.dataset.switchPlayerSection);return}
  if(e.target.closest('[data-history-search-retry]')){playerSearchError=null;ensurePlayerSearchIndex();renderRatings();return}
  if(e.target.closest('[data-history-search-more]')){historySearchLimit+=100;renderRatings();return}
  const searchScopeChoice=e.target.closest('[data-search-scope]');if(searchScopeChoice){setRatingScope(searchScopeChoice.dataset.searchScope);return}
  const historyPlayer=e.target.closest('[data-history-player]');if(historyPlayer){e.stopPropagation();close('#resultOverlay');close('#roundOverlay');openHistoricalProfile(historyPlayer.dataset.historyPlayer,Number(historyPlayer.dataset.historyRound));return}
  const ratingChoice=e.target.closest('[data-rating-round]');if(ratingChoice){selectRatingRound(ratingChoice.dataset.ratingRound);return}
  const historyTable=e.target.closest('[data-history-table]');if(historyTable){e.stopPropagation();openHistoricalTable(Number(historyTable.dataset.historyTable));return}
  const globalPlayer=e.target.closest('[data-global-player]');if(globalPlayer){e.stopPropagation();openGlobalPlayer(globalPlayer.dataset.sectionCode,globalPlayer.dataset.globalPlayer,globalPlayer.dataset.seasonKey);return}
  const player=e.target.closest('[data-player]');if(player){e.stopPropagation();close('#resultOverlay');openProfile(player.dataset.player);return}
  const schedule=e.target.closest('[data-sos-open]');if(schedule){openSchedule();return}
  const fixtureResult=e.target.closest('[data-fixture-result-id]');if(fixtureResult){const id=fixtureResult.dataset.fixtureResultId,f=fixtureById(id),result=f&&findFixtureResult(f,f.round);if(result){openMatch(result.fixtureId)}else lab8Modal('Scorecard unavailable','<p>This fixture does not have a published scorecard yet.</p>');return}
  const roundSimulation=e.target.closest('[data-simulate-round]');if(roundSimulation){simulateRound(roundSimulation.dataset.simulateRound);return}
  const closeRoundSimulationButton=e.target.closest('[data-close-round-simulation]');if(closeRoundSimulationButton){closeRoundSimulation(closeRoundSimulationButton.dataset.closeRoundSimulation);return}
  const prediction=e.target.closest('[data-predict-id]');if(prediction){openPrediction(prediction.dataset.predictId);return}
  const predictionHome=e.target.closest('[data-open-prediction-home]');if(predictionHome){openPredictionHome();return}
  const teamPrediction=e.target.closest('[data-team-predict]');if(teamPrediction){openPredictionHome(teamPrediction.dataset.teamPredict);return}
  if(e.target.closest('[data-start-custom-prediction]')){startCustomPrediction();return}
  const lineupHistory=e.target.closest('[data-lineup-history]');if(lineupHistory){openTeamLineupHistory(lineupHistory.dataset.lineupHistory);return}
  const lineupFixture=e.target.closest('[data-lineup-fixture]');if(lineupFixture){close('#lineupHistoryOverlay');openMatch(lineupFixture.dataset.lineupFixture);return}
  const rivalryOpen=e.target.closest('[data-open-rivalries]');if(rivalryOpen){const throughRound=Number(rivalryOpen.dataset.rivalryRound)||0,name=rivalryOpen.dataset.openRivalries,insight=auxiliaryPlayer(name)?auxiliaryCache.insight:(throughRound?historicalInsight(name,throughRound):playerInsight(name));openRivalries(name,insight,throughRound);return}
  const rivalryFixture=e.target.closest('[data-rival-fixture]');if(rivalryFixture){close('#rivalryOverlay');close('#profileOverlay');openMatch(rivalryFixture.dataset.rivalFixture,activeProfilePlayer);return}
  const lineupPreset=e.target.closest('[data-lineup841-apply]');if(lineupPreset){applyRecordedLineup(Number(lineupPreset.dataset.lineup841Apply));return}
  const allEstimates=e.target.closest('[data-projection841-toggle]');if(allEstimates&&selectedPrediction){const labels=[...document.querySelectorAll('[data-prediction-estimate]')].map(b=>b.dataset.predictionEstimate),show=!labels.every(label=>selectedPrediction.scoreEstimates?.[label]);selectedPrediction.scoreEstimates=Object.fromEntries(labels.map(label=>[label,show]));refreshPrediction();document.querySelector('[data-projection841-toggle]')?.focus({preventScroll:true});return}
  const scoreEstimate=e.target.closest('[data-prediction-estimate]');if(scoreEstimate&&selectedPrediction){const label=scoreEstimate.dataset.predictionEstimate;selectedPrediction.scoreEstimates=selectedPrediction.scoreEstimates||{};selectedPrediction.scoreEstimates[label]=!selectedPrediction.scoreEstimates[label];refreshPrediction();$$('[data-prediction-estimate]').find(b=>b.dataset.predictionEstimate===label)?.focus();return}
  if(e.target.closest('[data-run-simulation]')){runPredictionSimulation();return}
  const autoOrder=e.target.closest('[data-auto-order]');if(autoOrder){const side=autoOrder.dataset.autoOrder,match=currentPredictionMatch();if(match){selectedPrediction[side].manualOrder=false;selectedPrediction.simulation=null;refreshPrediction()}return}
  const match=e.target.closest('[data-match-id]');if(match){const sourcePlayer=!$('#profileOverlay').classList.contains('hidden')?activeProfilePlayer:null;close('#roundOverlay');openMatch(match.dataset.matchId,sourcePlayer);return}
  const clubTeam=e.target.closest('[data-club-team]');if(clubTeam){e.stopPropagation();openClubForTeam(clubTeam.dataset.clubTeam);return}
  const rival=e.target.closest('[data-club-rival]');if(rival){activeClubZone.opponent=rival.dataset.clubRival;activeClubZone.resultLimit=16;renderClubZone();return}
  if(e.target.closest('#clubResultMore')){activeClubZone.resultLimit=(activeClubZone.resultLimit||16)+16;renderClubZone();return}
  if(e.target.dataset.close)close('#profileOverlay');if(e.target.dataset.searchOptionsClose)close('#searchOptionsOverlay');if(e.target.dataset.rivalryClose)close('#rivalryOverlay');if(e.target.dataset.clubPickerClose)close('#clubPickerOverlay');if(e.target.dataset.clubZoneClose)close('#clubZoneOverlay');if(e.target.dataset.roundClose)close('#roundOverlay');if(e.target.dataset.settingsClose)close('#settingsOverlay');if(e.target.dataset.resultClose)close('#resultOverlay');if(e.target.dataset.predictionClose)close('#predictionOverlay');if(e.target.dataset.lineupHistoryClose)close('#lineupHistoryOverlay');if(e.target.dataset.sosClose)close('#sosOverlay');
});
document.addEventListener('change',e=>{
  if(e.target.matches('[data-aux-profile-opponent]')){const host=e.target.parentElement.parentElement.querySelector('[data-aux-profile-matchup-result]');if(host&&auxiliaryCache)host.innerHTML=auxiliaryMatchupResult(auxiliaryCache,e.target.value);return}
  if(e.target.matches('[data-predict-side]')){updatePrediction(e.target.dataset.predictSide,e.target.dataset.predictPlayer,e.target.checked);return}
  if(e.target.matches('[data-singles-side]')){updateSingles(e.target.dataset.singlesSide,Number(e.target.dataset.singlesPosition),e.target.value);return}
  if(e.target.matches('[data-doubles-side]')){updateDoubles(e.target.dataset.doublesSide,Number(e.target.dataset.doublesPair),Number(e.target.dataset.doublesSlot),e.target.value);return}
  if(e.target.matches('[data-profile-opponent]')){const select=e.target,host=select.parentElement.parentElement.querySelector('[data-profile-matchup-result]');if(host)host.innerHTML=profileMatchupResult(select.dataset.profilePlayer,select.value,Number(select.dataset.profileRound)||null);}
  if(e.target.matches('#clubPickerCompetition'))fillClubChoices();
  if(e.target.matches('#clubPickerClub'))$('#clubPickerOpen').disabled=!e.target.value;
  if(e.target.matches('#clubZoneSection')){activeClubZone.section=e.target.value;activeClubZone.resultLimit=16;renderClubZone();}
  if(e.target.matches('#clubZoneSeason')){activeClubZone.season=e.target.value;activeClubZone.resultLimit=16;renderClubZone();}
  if(e.target.matches('#clubZoneVariant')){activeClubZone.variant=e.target.value;activeClubZone.resultLimit=16;renderClubZone();}
  if(e.target.matches('#clubZoneResult')){activeClubZone.result=e.target.value;activeClubZone.resultLimit=16;renderClubZone();}
  if(e.target.matches('#clubZoneOpponent')){activeClubZone.opponent=e.target.value;activeClubZone.resultLimit=16;renderClubZone();}
});
function renderRatingOptions(){
  document.querySelectorAll('[data-search-scope]').forEach(button=>button.classList.toggle('selected',button.dataset.searchScope===ratingScope));
  $('.ratings-history-options h3').textContent='Rating History ● '+D.meta.section_label;const rounds=BRTAHistory.rounds(D,ratingView).slice().sort((a,b)=>b.round-a.round);
  $('#ratingHistoryChoices').innerHTML='<button type="button" data-rating-round="latest" aria-pressed="'+(ratingRound==null)+'" class="'+(ratingRound==null?'selected':'')+'"><b>Latest ratings</b><span>Current standings</span></button>'+rounds.map(x=>'<button type="button" data-rating-round="'+x.round+'" aria-pressed="'+(ratingRound===Number(x.round))+'" class="'+(ratingRound===Number(x.round)?'selected':'')+'"><b>After Round '+x.round+'</b><span>'+esc(x.date)+'</span></button>').join('')+(!rounds.length?'<p class="small-note">Round history is not available for this rating view yet.</p>':'');
}
function selectRatingRound(value){ratingRound=value==='latest'?null:Number(value);if(ratingRound!=null){ratingScope='section';localStorage.setItem('brta-rating-scope','section')}renderRatings();close('#searchOptionsOverlay')}
function setRatingScope(value){ratingScope=['all','history'].includes(value)?value:'section';localStorage.setItem('brta-rating-scope',ratingScope);if(ratingScope!=='section'){ratingRound=null;}renderRatings();renderRatingOptions()}
function openSearchOptions(){if(!D)return;renderRatingOptions();$('#searchOptionsOverlay').classList.remove('hidden');document.body.classList.add('modal-open')}

document.addEventListener('contextmenu',e=>{const schedule=e.target.closest('[data-sos-open]');if(schedule){e.preventDefault();openSchedule()}});
$$('.main-tab').forEach(b=>b.onclick=()=>switchPage(b.dataset.page));
document.querySelectorAll('.subtab').forEach(b=>b.onclick=()=>{ratingView=b.dataset.rating;if(ratingRound!=null&&!BRTAHistory.rounds(D,ratingView).some(x=>Number(x.round)===ratingRound))ratingRound=null;if(ratingView==='pairs'&&ratingScope!=='section'){ratingScope='section';localStorage.setItem('brta-rating-scope',ratingScope)}document.querySelectorAll('.subtab').forEach(x=>x.classList.toggle('active',x===b));renderRatings()});
$('#search').oninput=renderRatings;$('#teamFilter').onchange=()=>renderRatings();$('#clubZoneBtn').onclick=openClubPicker;$('#clubPickerOpen').onclick=openChosenClubZone;$('#clubPickerClose').onclick=()=>close('#clubPickerOverlay');$('#clubZoneClose').onclick=()=>close('#clubZoneOverlay');$('#roundBtn').onclick=openRound;$('#settingsBtn').onclick=()=>openSettings();$('#exportSectionBtn').onclick=exportSectionCSV;
$('#profileClose').onclick=()=>close('#profileOverlay');$('#roundClose').onclick=()=>close('#roundOverlay');$('#settingsClose').onclick=()=>close('#settingsOverlay');$('#resultClose').onclick=()=>close('#resultOverlay');
$('#predictionClose').onclick=()=>close('#predictionOverlay');$('#lineupHistoryClose').onclick=()=>close('#lineupHistoryOverlay');$('#sosClose').onclick=()=>close('#sosOverlay');$('#rivalryClose').onclick=()=>close('#rivalryOverlay');$('#searchOptionsBtn').onclick=openSearchOptions;$('#searchOptionsClose').onclick=()=>close('#searchOptionsOverlay');
document.addEventListener('keydown',e=>{if(e.key==='Escape')$$('.overlay:not(.hidden)').forEach(o=>close('#'+o.id))});
window.addEventListener('brta-module-toggle',()=>{
  cancelAuxiliaryReveal();
  if(!auxiliaryEnabled()){auxiliaryCache=null;auxiliaryCacheKey='';if(activeProfilePlayer===window.AuxiliaryModule?.CANONICAL){activeProfilePlayer=null;close('#profileOverlay');$('#profileMatchExplorer')?.classList.add('hidden')}}
  if(D){teamOptions();renderRatings()}
});
window.addEventListener('brta-custom-sections-change',()=>{if(activeHistorySeasonId)return;const code=D?.meta?.section_code;viewCatalog=currentCatalog();setupSelectors();if(code?.startsWith('local-')){if(viewCatalog.some(x=>x.section_code===code))loadSection(code);else loadSection(DATA.defaultSectionCode)}});
window.addEventListener('brta-custom-section-open',e=>{activeHistorySeasonId=null;localStorage.removeItem('brta-history-selection');viewCatalog=currentCatalog();setupSelectors();close('#settingsOverlay');switchPage('results');loadSection(e.detail)});
async function startApp(){applyProfilePosition();viewCatalog=currentCatalog();setupSelectors();showSyncToast();const saved=readHistorySelection();if(!saved||layoutDefaultCode()){await loadSection(choiceValue('sectionSelect'));ensureHistoryCatalog();return}const catalog=await ensureHistoryCatalog(),season=catalog?.seasons.find(x=>x.id===saved.seasonId),section=season?.sections.find(x=>x.section_code===saved.sectionCode);if(season&&section){activeHistorySeasonId=season.id;viewCatalog=historySeasonSections(season);setupSelectors();primeArchiveGlobalRows();await loadSection(section.section_code)}else{activeHistorySeasonId=null;viewCatalog=currentCatalog();setupSelectors();await loadSection(choiceValue('sectionSelect'))}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',startApp,{once:true});else startApp();


document.addEventListener('toggle',event=>{if(event.target.matches?.('[data-prediction-lineups]')&&event.target.isConnected&&selectedPrediction)selectedPrediction.lineupsOpen=event.target.open},true);

