(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.BRTAPrediction=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const RATING_DENOMINATOR=450;

  function clamp01(value){return Math.max(0,Math.min(1,Number(value)))}
  function logistic(value){return 1/(1+Math.exp(-value))}
  function gameProbability(homeRating,awayRating){return logistic((Number(homeRating)-Number(awayRating))/RATING_DENOMINATOR)}
  function choose(n,k){let value=1;for(let i=1;i<=k;i++)value=value*(n-k+i)/i;return value}
  function addDistribution(map,homeWin,margin,probability){
    if(probability<=0)return;
    const key=(homeWin?'W':'L')+':'+margin;
    map.set(key,(map.get(key)||0)+probability);
  }
  function shortSetDistribution(gameProbabilityValue,{greenBall=false,targetGames=6}={}){
    const p=clamp01(gameProbabilityValue),q=1-p,map=new Map();
    for(let lost=0;lost<=targetGames-2;lost++){
      addDistribution(map,true,targetGames-lost,choose(targetGames-1+lost,lost)*p**targetGames*q**lost);
      addDistribution(map,false,-(targetGames-lost),choose(targetGames-1+lost,lost)*q**targetGames*p**lost);
    }
    const fiveAll=choose(2*(targetGames-1),targetGames-1)*p**(targetGames-1)*q**(targetGames-1);
    if(greenBall){
      // BRTA Green Ball is first to six games with no tiebreak. At 5-5,
      // the next game ends the set 6-5.
      addDistribution(map,true,1,fiveAll*p);
      addDistribution(map,false,-1,fiveAll*q);
    }else{
      addDistribution(map,true,2,fiveAll*p*p);
      addDistribution(map,false,-2,fiveAll*q*q);
      addDistribution(map,true,1,fiveAll*2*p*q*p);
      addDistribution(map,false,-1,fiveAll*2*p*q*q);
    }
    const rows=[...map.entries()].map(([key,probability])=>{
      const [result,margin]=key.split(':');
      return{homeWin:result==='W',margin:Number(margin),probability};
    });
    const total=rows.reduce((sum,row)=>sum+row.probability,0)||1;
    rows.forEach(row=>row.probability/=total);
    return rows;
  }
  function shortSetWin(gameProbabilityValue,options={}){
    return shortSetDistribution(gameProbabilityValue,options).reduce((sum,row)=>sum+(row.homeWin?row.probability:0),0);
  }
  function rubbersSinglesWin(gameProbabilityValue){
    const p=clamp01(gameProbabilityValue),set=shortSetWin(p);
    return set*set+2*set*(1-set)*p;
  }
  function lineupReady(home,away,needed){
    return Array.isArray(home)&&Array.isArray(away)&&home.length===needed&&away.length===needed&&
      home.every(Boolean)&&away.every(Boolean)&&new Set(home).size===needed&&new Set(away).size===needed;
  }
  function sampleSet(p,{greenBall=false,targetGames=6,rng=Math.random}={}){
    let home=0,away=0;
    while(home<targetGames&&away<targetGames){if(rng()<p)home++;else away++}
    if(!greenBall&&home===targetGames&&away===targetGames-1||!greenBall&&away===targetGames&&home===targetGames-1){
      if(rng()<p)home++;else away++;
      if(home===targetGames&&away===targetGames){
        const homeWon=rng()<p;
        const loserPoints=sampleTiebreakLoserPoints(7,rng);
        return{homeGames:homeWon?targetGames+1:targetGames,awayGames:homeWon?targetGames:targetGames+1,
          score:(homeWon?(targetGames+1)+'-'+targetGames:targetGames+'-'+(targetGames+1))+'['+loserPoints+']',homeWon};
      }
    }
    return{homeGames:home,awayGames:away,score:home+'-'+away,homeWon:home>away};
  }
  function sampleTiebreakLoserPoints(target,rng=Math.random){
    // The rubber model gives the tiebreak winner probability. Score detail is
    // illustrative conditional on that winner, with a valid win-by-two score.
    if(rng()<.18)return target+Math.floor(rng()*4)-1;
    return Math.floor(rng()*(target-1));
  }
  function matchDistribution(p,{bestOf=1,targetGames=6}={}){
    const sets=shortSetDistribution(p,{targetGames});if(bestOf===1)return sets.map(r=>({...r,homeSets:Number(r.homeWin),awaySets:Number(!r.homeWin)}));
    const grouped=new Map(),add=(homeSets,awaySets,margin,probability)=>{const key=[homeSets,awaySets,margin].join(':');if(!grouped.has(key))grouped.set(key,{homeWin:homeSets>awaySets,homeSets,awaySets,margin,probability:0});grouped.get(key).probability+=probability;};
    for(const first of sets)for(const second of sets){const hs=Number(first.homeWin)+Number(second.homeWin),margin=first.margin+second.margin,probability=first.probability*second.probability;if(hs===2)add(2,0,margin,probability);else if(hs===0)add(0,2,margin,probability);else{add(2,1,margin,probability*p);add(1,2,margin,probability*(1-p));}}
    return [...grouped.values()];
  }
  function sampleConfiguredRubber(rubber,rng){
    const p=clamp01(rubber.gameProbability),options={targetGames:rubber.targetGames||6,rng},sets=[sampleSet(p,options)];if(rubber.bestOf===3)sets.push(sampleSet(p,options));let homeSets=sets.filter(s=>s.homeWon).length,awaySets=sets.length-homeSets;const scores=sets.map(s=>s.score);
    if(rubber.bestOf===3&&homeSets===1){const homeWon=rng()<p,loser=sampleTiebreakLoserPoints(10,rng),winner=Math.max(10,loser+2);scores.push(homeWon?'['+winner+'-'+loser+']':'['+loser+'-'+winner+']');homeSets+=Number(homeWon);awaySets+=Number(!homeWon);}
    return {...rubber,homeWon:homeSets>awaySets,score:scores.join(' '),homeGames:sets.reduce((n,s)=>n+s.homeGames,0),awayGames:sets.reduce((n,s)=>n+s.awayGames,0),homeSets,awaySets};
  }
  function sampleRubber(rubber,{format='sets',greenBall=false,rng=Math.random}={}){
    if(rubber.bestOf)return sampleConfiguredRubber(rubber,rng);
    const p=clamp01(rubber.gameProbability);
    if(format!=='rubbers'){
      const set=sampleSet(p,{greenBall,rng});
      return{...rubber,score:set.score,homeWon:set.homeWon,homeGames:set.homeGames,
        awayGames:set.awayGames,homeSets:Number(set.homeWon),awaySets:Number(!set.homeWon)};
    }
    if(rubber.label==='Doubles'){
      const set=sampleSet(p,{rng});
      return{...rubber,score:set.score,homeWon:set.homeWon,homeGames:set.homeGames,
        awayGames:set.awayGames,homeSets:Number(set.homeWon),awaySets:Number(!set.homeWon)};
    }
    const first=sampleSet(p,{rng}),second=sampleSet(p,{rng});
    let homeSets=Number(first.homeWon)+Number(second.homeWon),awaySets=2-homeSets;
    const scores=[first.score,second.score];
    if(homeSets===1){
      const homeWon=rng()<p,loserPoints=sampleTiebreakLoserPoints(10,rng);
      const winnerPoints=Math.max(10,loserPoints+2);
      scores.push(homeWon?'['+winnerPoints+'-'+loserPoints+']':'['+loserPoints+'-'+winnerPoints+']');
      if(homeWon)homeSets++;else awaySets++;
    }
    return{...rubber,score:scores.join(' '),homeWon:homeSets>awaySets,
      homeGames:first.homeGames+second.homeGames,awayGames:first.awayGames+second.awayGames,
      homeSets,awaySets};
  }
  function simulateTie(rubbers,{format='sets',greenBall=false,custom=false,rng=Math.random}={}){
    const results=rubbers.map(r=>sampleRubber(r,{format,greenBall,rng}));
    const homeRubbers=results.filter(r=>r.homeWon).length,awayRubbers=results.length-homeRubbers;
    const homeGames=results.reduce((n,r)=>n+r.homeGames,0),awayGames=results.reduce((n,r)=>n+r.awayGames,0);
    const homeSets=results.reduce((n,r)=>n+r.homeSets,0),awaySets=results.reduce((n,r)=>n+r.awaySets,0);
    // Sets ties use rubber wins, then games. Rubbers has three rubbers.
    const decidingHome=custom&&format==='rubbers'?homeSets:homeRubbers,decidingAway=custom&&format==='rubbers'?awaySets:awayRubbers;
    const winner=decidingHome>decidingAway?1:decidingAway>decidingHome?-1:
      homeGames>awayGames?1:awayGames>homeGames?-1:0;
    const base=format==='rubbers'?(custom?1:2):4,drawBase=base/2,homeScore=custom&&format!=='rubbers'?homeRubbers:homeSets,awayScore=custom&&format!=='rubbers'?awayRubbers:awaySets;
    return{results,homeRubbers,awayRubbers,homeGames,awayGames,homeSets,awaySets,winner,
      homePoints:(winner===1?base:winner===0?drawBase:0)+homeScore,
      awayPoints:(winner===-1?base:winner===0?drawBase:0)+awayScore};
  }
  function teamOutcome(rubbers,{gamesDecideTies=false,setWinsDecideTies=false}={}){
    let states=new Map([['0:0',1]]);
    let expectedRubbers=0;
    for(const rubber of rubbers){
      expectedRubbers+=rubber.p;
      const distribution=rubber.scoreDistribution&&rubber.scoreDistribution.length?
        rubber.scoreDistribution:[
          {homeWin:true,margin:0,probability:rubber.p},
          {homeWin:false,margin:0,probability:1-rubber.p},
        ];
      const next=new Map();
      for(const [key,stateProbability] of states){
        const [winsText,marginText]=key.split(':');
        const wins=Number(winsText),margin=Number(marginText);
        for(const outcome of distribution){
          const nextWins=wins+(setWinsDecideTies?(outcome.homeSets??Number(outcome.homeWin))-(outcome.awaySets??Number(!outcome.homeWin)):Number(outcome.homeWin));
          const nextMargin=margin+(gamesDecideTies?Number(outcome.margin||0):0);
          const nextKey=nextWins+':'+nextMargin;
          next.set(nextKey,(next.get(nextKey)||0)+stateProbability*outcome.probability);
        }
      }
      states=next;
    }
    let homeWin=0,awayWin=0,draw=0;
    const halfway=setWinsDecideTies?0:rubbers.length/2;
    for(const [key,probability] of states){
      const [winsText,marginText]=key.split(':');
      const wins=Number(winsText),margin=Number(marginText);
      if(wins>halfway)homeWin+=probability;
      else if(wins<halfway)awayWin+=probability;
      else if(gamesDecideTies&&margin>0)homeWin+=probability;
      else if(gamesDecideTies&&margin<0)awayWin+=probability;
      else draw+=probability;
    }
    const total=homeWin+awayWin+draw||1;
    return{homeWin:homeWin/total,awayWin:awayWin/total,draw:draw/total,expectedRubbers};
  }
  return{
    RATING_DENOMINATOR,
    logistic,
    gameProbability,
    shortSetDistribution,
    shortSetWin,
    matchDistribution,
    rubbersSinglesWin,
    lineupReady,
    teamOutcome,
    sampleSet,
    sampleRubber,
    simulateTie,
  };
});
