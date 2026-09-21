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
  function shortSetDistribution(gameProbabilityValue,{greenBall=false}={}){
    const p=clamp01(gameProbabilityValue),q=1-p,map=new Map();
    for(let lost=0;lost<=4;lost++){
      addDistribution(map,true,6-lost,choose(5+lost,lost)*p**6*q**lost);
      addDistribution(map,false,-(6-lost),choose(5+lost,lost)*q**6*p**lost);
    }
    const fiveAll=choose(10,5)*p**5*q**5;
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
  function teamOutcome(rubbers,{gamesDecideTies=false}={}){
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
          const nextWins=wins+(outcome.homeWin?1:0);
          const nextMargin=margin+(gamesDecideTies?Number(outcome.margin||0):0);
          const nextKey=nextWins+':'+nextMargin;
          next.set(nextKey,(next.get(nextKey)||0)+stateProbability*outcome.probability);
        }
      }
      states=next;
    }
    let homeWin=0,awayWin=0,draw=0;
    const halfway=rubbers.length/2;
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
    rubbersSinglesWin,
    lineupReady,
    teamOutcome,
  };
});
