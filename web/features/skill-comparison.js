window.BRTASkillComparison = (() => {
  'use strict';
  const storageKey = 'brta-skill-presets-v1';
  const newGraph = () => ({title:'', discipline:'overall', players:[]});
  const codeLabel = code => competitionLabel(code).split(' - ')[0];
  const option = (value, title, selected) => '<option value="' + esc(value) + '"' + (selected ? ' selected' : '') + '>' + esc(title) + '</option>';
  const action = (label,key,extra='') => '<button type="button" class="button secondary" data-skill-action="'+key+'" '+extra+'>'+label+'</button>';

  function setup(host, {careers, section, load, teams, teamPlayers, followedPlayers}) {
    const workspaces=new Map(), histories=new Map(), searches=new WeakMap();
    let active='', override='', revision=0, settingsOpen=false, presets, expandedSheet;
    try { presets=JSON.parse(localStorage.getItem(storageKey)) || {}; }
    catch { presets={}; }
    presets=Object.fromEntries(Object.entries(presets).filter(([id,item])=>id.startsWith('preset-') && item?.id===id &&
      typeof item.name==='string' && Array.isArray(item.graphs) && item.graphs.length && item.graphs.every(graph=>Array.isArray(graph?.players))));
    const competitions = () => [...new Set((DATA.catalog||[]).map(row=>row.competition_code))];
    function workspace(code=active) {
      if (!workspaces.has(code)) workspaces.set(code,{graphs:[newGraph()],scope:'section',preset:'',name:''});
      return workspaces.get(code);
    }
    const contextCode=()=>section()?.competition_code || competitions()[0];
    function selectCompetition() { active=override || contextCode(); workspace(); }
    const historyKey=(player,code)=>JSON.stringify([code,player.id]);
    function ensure(player,code) {
      const key=historyKey(player,code);
      if (histories.has(key)) return histories.get(key).query;
      const entry={pending:true};
      histories.set(key,entry);
      entry.query=Promise.resolve().then(()=>load(player,code)).catch(()=>({matches:[],unavailable:1})).then(data=>{
        Object.assign(entry,{data,pending:false});
        if (active===code && host.childElementCount) drawPlots();
        return data;
      });
      return entry.query;
    }
    const inform=text=>{const status=host.querySelector('[data-skill-status]');if(status)status.textContent=text;};
    const titleFor=(graph,i)=>graph.title || (i===0?'Player comparison':'Comparison '+(i+1));
    function legend(graph,points,removable) {
      const plotted=new Set(points.map(point=>point.id));
      return '<ul class="skill-selected" aria-label="Players on this graph">'+graph.players.map((player,i)=>{
        const name=esc(player.name);
        return '<li class="skill-name-pill'+(plotted.has(player.id)?'':' no-skill-series')+'">'+
          '<button type="button" class="skill-name" data-skill-highlight="'+i+'" aria-label="Highlight '+name+'">'+
          '<i aria-hidden="true" style="--series-colour:'+BRTACareerTimeline.colour(i)+'"></i><span>'+name+'</span></button>'+
          '<span class="skill-name-tooltip" aria-hidden="true">'+name+'</span>'+
          (removable?'<button type="button" class="skill-remove-name" data-skill-action="remove-player" data-skill-player="'+i+'" aria-label="Remove '+name+'">×</button>':'')+
          '</li>';
      }).join('')+'</ul>';
    }
    function graphCard(graph,i) {
      return '<article class="skill-comparison-graph" data-skill-graph="'+i+'"><header><h3>'+esc(titleFor(graph,i))+'</h3><div class="skill-graph-actions">'+
        action('Expand','expand-graph','aria-label="Expand '+esc(titleFor(graph,i))+'"')+
        (workspace().graphs.length>1?action('Remove','remove-graph','aria-label="Remove '+esc(titleFor(graph,i))+'"'):'')+'</div></header>'+
        BRTACareerTimeline.disciplineButtons(graph.discipline,'data-skill-discipline')+
        '<div class="career99-chart" data-skill-plot></div><div data-skill-legend></div>'+
        '<label class="skill-player-picker"><span>Add a player</span><input type="search" autocomplete="off" data-skill-search placeholder="Search for a player"></label>'+
        '<div data-skill-candidates role="region" aria-label="Matching players"></div></article>';
    }
    function settings(view) {
      const here=section()?.competition_code===active;
      const options=competitions().map(code=>option(code,codeLabel(code),override===code)).join('');
      const saved=Object.values(presets).filter(preset=>preset.competition===active).sort((a,b)=>a.name.localeCompare(b.name));
      return '<details class="skill-settings"'+(settingsOpen?' open':'')+'><summary>Graph settings</summary>'+
        '<div class="skill-settings-body"><div class="career99-filters"><label>Competition<select data-skill-competition>'+
        option('','Follow current section',!override)+options+'</select></label><label>Player search<select data-skill-scope>'+
        (here?option('section','Current section',view.scope==='section'):'')+option('competition','Whole competition',!here||view.scope==='competition')+'</select></label></div>'+
        '<div class="skill-setting-titles">'+view.graphs.map((graph,i)=>'<label>Graph '+(i+1)+' title <input data-skill-title="'+i+'" value="'+esc(graph.title)+'" maxlength="80"></label>').join('')+'</div>'+
        '<div class="career99-filters"><label>Preset name <input data-skill-preset-name maxlength="80" value="'+esc(view.name)+'"></label>'+action('Save preset','save-preset')+
        '<label>Saved presets<select data-skill-presets>'+option('','Choose preset',!view.preset)+saved.map(p=>option(p.id,p.name,p.id===view.preset)).join('')+'</select></label>'+
        action('Load','load-preset')+action('Delete','delete-preset')+'</div>'+
        '<p role="status" data-skill-status></p></div></details>';
    }
    function draw() {
      selectCompetition();
      const view=workspace(), here=section()?.competition_code===active;
      const rosters=here?teams():[];
      const others=[...workspaces.entries()].filter(([code,w])=>code!==active && w.graphs.some(g=>g.players.length));
      revision++;
      host.innerHTML='<div class="skill-workspace-head"><div><h2>Compare career skill</h2><span class="skill-competition-pill">'+esc(codeLabel(active))+'</span></div>'+
        '<div class="skill-workspace-actions">'+action('Add graph','add-graph')+'</div></div>'+
        '<div class="skill-team-preset"><label>Start from a preset<select data-skill-team>'+option('','Choose a preset',true)+
          rosters.map((team,i)=>option(String(i),team.team,false)).join('')+option('following','Following',false)+
          '</select></label>'+action('Add preset graph','team-preset')+'<span role="status" data-skill-preset-status></span></div>'+
        settings(view)+'<div class="skill-graph-list">'+view.graphs.map(graphCard).join('')+'</div>'+
        (others.length?'<details class="skill-other-workspaces"><summary>Graphs from other competitions</summary><div>'+
          others.map(([code])=>action(esc(codeLabel(code)),'other-competition','data-skill-code="'+esc(code)+'"')).join('')+'</div></details>':'');
      host.querySelector('.skill-settings').addEventListener('toggle',event=>{settingsOpen=event.target.open;});
      view.graphs.flatMap(graph=>graph.players).forEach(player=>{void ensure(player,active);});
      drawPlots();
    }
    function drawGraph(node,graph,code,{zoom=false,tight=false,removable=true}={}) {
      const points=graph.players.flatMap(player=>{
        const data=histories.get(historyKey(player,code))?.data;
        return data?BRTACareerTimeline.skillHistory(data.matches,undefined,graph.discipline).map(point=>({...point,id:player.id})):[];
      });
      const plot=node.querySelector('[data-skill-plot]');
      const pending=graph.players.some(player=>histories.get(historyKey(player,code))?.pending);
      const unavailable=graph.players.some(player=>histories.get(historyKey(player,code))?.data?.unavailable);
      plot.innerHTML=points.length?BRTACareerTimeline.chart(points,{seriesKey:point=>point.id,
        seriesIndex:key=>graph.players.findIndex(player=>player.id===key),legend:false,zoom,tight,seriesLabel:point=>graph.players.find(player=>player.id===point.id)?.name}):
        '<p class="skill-chart-empty">'+(pending?'Loading match histories…':graph.players.length?'No season ratings for this discipline.':'Add players to compare their season ratings.')+'</p>';
      if (unavailable) plot.insertAdjacentHTML('beforeend','<p class="skill-data-note">Some match histories were unavailable.</p>');
      node.querySelector('[data-skill-legend]').innerHTML=legend(graph,points,removable);
      node.querySelectorAll('[data-skill-discipline]').forEach(button=>
        button.setAttribute('aria-pressed',String(button.dataset.skillDiscipline===graph.discipline)));
    }
    function drawPlots() {
      host.querySelectorAll('[data-skill-graph]').forEach(node=>drawGraph(node,workspace().graphs[Number(node.dataset.skillGraph)],active));
    }
    function allowed(row) {
      if(row.competitionCode!==active)return false;
      const here=section();
      if(workspace().scope!=='section'||here?.competition_code!==active)return true;
      return row.sectionCode===here.section_code && (here.is_archive?row.seasonLabel===here.season_label:row.isCurrent);
    }
    async function search(field) {
      const node=field.closest('[data-skill-graph]'), outlet=node.querySelector('[data-skill-candidates]');
      const query=field.value.trim(), version=revision;
      searches.delete(node);
      if(query.length<2){outlet.replaceChildren();return;}
      outlet.textContent='Searching…';
      const searchRequest={query};
      searches.set(node,searchRequest);
      const current=()=>version===revision&&field.isConnected&&searches.get(node)===searchRequest;
      try {
        const model=await careers();
        if(!current())return;
        const graph=workspace().graphs[Number(node.dataset.skillGraph)];
        const filter=items=>items.filter(person=>person.rows.some(allowed)&&!graph.players.some(p=>p.id===person.id));
        const matches=filter(model.find(query));
        searchRequest.people=(matches.length?matches:filter(model.find(query,true))).slice(0,12);
        outlet.innerHTML=searchRequest.people.map((person,i)=>{
          const row=person.rows.find(allowed);
          return action(esc(row.player)+'<small>'+esc([row.team,row.sectionLabel].filter(Boolean).join(' · '))+'</small>',
            'select-player','data-skill-person="'+i+'"');
        }).join('') || '<p>No matching players in this search scope.</p>';
      }catch{if(current())outlet.textContent='Player search is unavailable.';}
    }
    async function fromTeam(team) {
      return {title:team.team,discipline:'overall',players:await teamPlayers(team)};
    }
    function save() {
      try { localStorage.setItem(storageKey,JSON.stringify(presets)); return true; }
      catch { inform('Could not save presets on this device.'); return false; }
    }
    function savePreset() {
      const view=workspace(),name=view.name.trim();
      if(!name){inform('Enter a name for the preset.');return;}
      const existing=Object.values(presets).find(p=>p.competition===active&&p.name===name);
      if(existing&&existing.id!==view.preset&&!confirm('Replace the preset “'+name+'”?'))return;
      const id=existing?.id||'preset-'+(crypto.randomUUID?.()||Date.now());
      presets[id]={id,name,competition:active,scope:view.scope,graphs:structuredClone(view.graphs)};
      view.preset=id;
      draw();
      if(save())inform('Saved '+name+'.');
    }
    host.addEventListener('input',event=>{
      const input=event.target;
      if(input.matches('[data-skill-search]'))void search(input);
      if(input.matches('[data-skill-preset-name]'))workspace().name=input.value;
      if(input.matches('[data-skill-title]')){
        const index=Number(input.dataset.skillTitle),graph=workspace().graphs[index];
        graph.title=input.value;
        host.querySelector('[data-skill-graph="'+index+'"] h3').textContent=titleFor(graph,index);
      }
    });
    host.addEventListener('change',event=>{
      const field=event.target;
      if(field.matches('[data-skill-competition]')){override=field.value; draw(); host.querySelector('[data-skill-competition]').focus();}
      if(field.matches('[data-skill-scope]')){workspace().scope=field.value;draw();host.querySelector('[data-skill-scope]').focus();}
      if(field.matches('[data-skill-presets]'))workspace().preset=field.value;
    });
    host.addEventListener('click',async event=>{
      const discipline=event.target.closest('[data-skill-discipline]');
      if(discipline){
        const node=discipline.closest('[data-skill-graph]'),graph=workspace().graphs[Number(node.dataset.skillGraph)];
        graph.discipline=discipline.dataset.skillDiscipline;
        drawGraph(node,graph,active);
        return;
      }
      const button=event.target.closest('[data-skill-action]');
      if(!button)return;
      const key=button.dataset.skillAction,view=workspace(),node=button.closest('[data-skill-graph]');
      const index=Number(node?.dataset.skillGraph),graph=view.graphs[index];
      const focusSearch=i=>host.querySelector('[data-skill-graph="'+i+'"] [data-skill-search]')?.focus();
      if(key==='expand-graph')void openExpanded(titleFor(graph,index),active,()=>graph);
      if(key==='add-graph'){view.graphs.push(newGraph());draw();focusSearch(view.graphs.length-1);}
      if(key==='remove-graph'){view.graphs.splice(index,1);draw();host.querySelector('[data-skill-action="add-graph"]').focus();}
      if(key==='select-player'){
        const person=searches.get(node)?.people?.[Number(button.dataset.skillPerson)],row=person?.rows.find(allowed);
        if(row&&!graph.players.some(p=>p.id===person.id)){
          graph.players.push({id:person.id,name:row.player,anchor:row});draw();focusSearch(index);
        }
      }
      if(key==='remove-player'){graph.players.splice(Number(button.dataset.skillPlayer),1);draw();focusSearch(index);}
      if(key==='team-preset'){
        const choice=host.querySelector('[data-skill-team]').value,team=teams()[Number(choice)],code=active;
        const status=host.querySelector('[data-skill-preset-status]');
        if(choice!=='following'&&!team)return;
        button.disabled=true;
        status.textContent='Loading preset…';
        try{
          const preset=choice==='following' ? {...newGraph(),title:'Following',players:await followedPlayers(code)} : await fromTeam(team);
          if(!preset.players.length){status.textContent='No followed players have records in this competition.';return;}
          if(view===workspace()){
            const empty=view.graphs.findIndex(graph=>!graph.players.length&&!graph.title);
            if(empty>=0)view.graphs[empty]=preset;else view.graphs.push(preset);
            draw();
            const added=view.graphs.indexOf(preset);
            host.querySelector('[data-skill-graph="'+added+'"] [data-skill-action="expand-graph"]').focus();
          }
        }catch{status.textContent='This preset could not be loaded.';}
        finally{button.disabled=false;}
      }
      if(key==='other-competition'){override=button.dataset.skillCode;settingsOpen=true;draw();}
      if(key==='save-preset')savePreset();
      if(key==='load-preset'){
        const preset=presets[view.preset];
        if(!preset){inform('Choose a saved preset.');return;}
        view.graphs=structuredClone(preset.graphs);
        view.name=preset.name;view.scope=preset.scope||'section';
        draw();inform('Loaded '+preset.name+'.');
      }
      if(key==='delete-preset'){
        const preset=presets[view.preset];
        if(!preset){inform('Choose a saved preset.');return;}
        if(!confirm('Delete the preset “'+preset.name+'”?'))return;
        delete presets[view.preset];view.preset='';draw();
        if(save())inform('Preset deleted.');
      }
    });

    function bindHighlight(node) {
      function highlight(event) {
        const name=event.target.closest?.('[data-skill-highlight]');
        if(!name)return;
        const chart=name.closest('article');
        if(event.relatedTarget?.closest?.('[data-skill-highlight]')===name)return;
        const focused=name.dataset.skillHighlight;
        chart.querySelectorAll('[data-skill-series]').forEach(line=>line.classList.toggle('dimmed',line.dataset.skillSeries!==focused));
      }
      function clear(event) {
        const name=event.target.closest?.('[data-skill-highlight]');
        if(!name||event.relatedTarget?.closest?.('[data-skill-highlight]')===name)return;
        name.closest('article').querySelectorAll('.skill-series.dimmed').forEach(line=>line.classList.remove('dimmed'));
      }
      node.addEventListener('pointerover',highlight);
      node.addEventListener('pointerout',clear);
      node.addEventListener('focusin',highlight);
      node.addEventListener('focusout',clear);
    }
    bindHighlight(host);
    async function openExpanded(title,code,getGraph,isTeam=false) {
      if(expandedSheet?.isConnected)return;
      const sheet=BRTAOverlays.openSheet(title,'<article class="skill-comparison-graph skill-team-graph">'+
        '<div class="skill-expanded-controls" data-skill-expanded-controls></div>'+
        '<div class="career99-chart" data-skill-plot><p class="skill-chart-empty">Loading match histories…</p></div><div data-skill-legend></div></article>',
        {className:'skill-expanded-dialog'});
      if(isTeam)sheet.classList.add('skill-team-dialog');
      expandedSheet=sheet;
      const node=sheet.querySelector('article');
      bindHighlight(sheet);
      try {
        const graph=await getGraph();
        if(!sheet.isConnected)return;
        let tight=false;
        node.querySelector('[data-skill-expanded-controls]').innerHTML=
          BRTACareerTimeline.disciplineButtons(graph.discipline,'data-skill-discipline')+
          '<button type="button" class="button secondary" data-skill-tight aria-pressed="false">Tighter Y-axis</button>';
        const draw=()=>{if(sheet.isConnected)drawGraph(node,graph,code,{zoom:true,tight,removable:false});};
        sheet.addEventListener('click',event=>{
          const discipline=event.target.closest('[data-skill-discipline]');
          const scale=event.target.closest('[data-skill-tight]');
          if(discipline){
            graph.discipline=discipline.dataset.skillDiscipline;
            if(active===code)drawPlots();
            draw();
          }
          if(scale){
            tight=!tight;
            scale.setAttribute('aria-pressed',String(tight));
            draw();
          }
        });
        const tasks=graph.players.map(player=>ensure(player,code).then(draw));
        draw();
        await Promise.all(tasks);
      }catch{if(sheet.isConnected)node.querySelector('[data-skill-plot]').textContent='Match histories could not be loaded.';}
    }
    function openTeam(team) {
      return openExpanded(team.team+' · Career skill',contextCode(),()=>fromTeam(team),true);
    }
    return {
      draw(){if(!host.childElementCount)draw();},
      contextChanged(){
        if(!host.childElementCount)return;
        override='';
        draw();
      },
      openTeam
    };
  }
  return {setup};
})();
