/* RM4.2 candidates. Training is an explicit offline operation; serving never learns from a target. */
'use strict';
const M=require('../../web/models/rm4');
const definitions={
 'RM Foundation-3':{core:'RM3',parameters:{l2:3.25,rho:0,halfLife:365}},
 'RM4.2 Melody':{core:'RM4a',parameters:{l2:5.5,rho:.75,halfLife:365,evidenceCap:24,melody:true}}
};
const mean=a=>a.reduce((n,v)=>n+v,0)/(a.length||1),clip=p=>Math.max(1e-8,Math.min(1-1e-8,p));
function fit(past,name,options={}){const d=definitions[name];if(!d)throw Error('Unknown candidate');return M.fit(past,d.core,{...options,parameters:d.parameters})}
function experience(past,m){return Math.min(...[...m.home,...m.away].map(p=>past.filter(r=>r.type===m.type&&(r.home.includes(p)||r.away.includes(p))).length))}
function group(m){return (m.green?'green':m.bestOf===3?'multi':'set')+':'+m.type}
function basis(m,n){return[1,Number(m.type==='Doubles'),Number(m.green),Number(m.bestOf===3),1/Math.sqrt(n+1)]}
function raw(f,m,name){return M.win(M.gap(f,m),{target:m.target,green:m.green,bestOf:m.bestOf,matchTiebreak:m.matchTiebreak,native:definitions[name].core!=='RM3'})}
function calibrated(p,m,n,coefficients=[0,0,0,0,0]){const x=basis(m,n),temperature=Math.max(.35,Math.min(1.6,1+x.reduce((v,t,i)=>v+t*coefficients[i],0)));return M.sigmoid(M.logit(p)*temperature)}
function loss(rows,name,coeff){return mean(rows.map(r=>{const p=clip(calibrated(r.raw[name],r,r.experience,coeff));return-r.y*Math.log(p)-(1-r.y)*Math.log1p(-p)}))}
// Small symmetric temperature model. No intercept, identity or manual player corrections.
function trainCalibration(rows,name){let b=[0,0,0,0,0];const penalties=[10,50,50,50,50];for(let it=0;it<300;it++){const g=b.map((v,i)=>penalties[i]*v);for(const r of rows){const x=basis(r,r.experience),z=M.logit(r.raw[name]),p=calibrated(r.raw[name],r,r.experience,b);for(let i=0;i<5;i++)g[i]+=(p-r.y)*z*x[i]}const rate=.2/(rows.length+50);b=b.map((v,i)=>v-rate*g[i])}return b}
function mix(values,weights){return values.reduce((v,p,i)=>v+p*weights[i],0)}
function weights(rows,names,calibrations){let best=null;function visit(prefix,left){if(prefix.length===names.length-1){const w=[...prefix,left].map(n=>n/10),score=mean(rows.map(r=>{const p=clip(mix(names.map(n=>calibrated(r.raw[n],r,r.experience,calibrations[n])),w));return-r.y*Math.log(p)-(1-r.y)*Math.log1p(-p)}))+.002*w.reduce((s,x)=>s+(x-1/names.length)**2,0);if(!best||score<best.score)best={weights:w,score};return}for(let n=0;n<=left;n++)visit([...prefix,n],left-n)}visit([],10);return best.weights}
function train(rows){if(!rows.length)throw Error('No earlier training forecasts');const names=Object.keys(definitions),calibrations=Object.fromEntries(names.map(n=>[n,trainCalibration(rows,n)])),global=weights(rows,names,calibrations),groups={};for(const g of new Set(rows.map(group))){const subset=rows.filter(r=>group(r)===g),local=weights(subset,names,calibrations),share=subset.length/(subset.length+200);groups[g]={n:subset.length,weights:local.map((w,i)=>share*w+(1-share)*global[i])}}return{schema:2,names,calibrations,global,groups,definitions,policy:'Frozen format weights pooled toward global with 200 forecasts; symmetric experience-conditioned calibration. Round affects available evidence, not a calendar switch.'}}
function predict(row,bundle){if(bundle.schema!==2||JSON.stringify(bundle.names)!==JSON.stringify(Object.keys(definitions)))throw Error('Rebuild the calibration bundle for Foundation-3 and Melody');const components=Object.fromEntries(bundle.names.map(n=>[n,calibrated(row.raw[n],row,row.experience,bundle.calibrations[n])])),w=bundle.groups[group(row)]?.weights||bundle.global;return{...components,'RM4.2 Ensemble':mix(bundle.names.map(n=>components[n]),w)}}
module.exports={definitions,fit,experience,group,basis,raw,calibrated,train,predict,loss,trainCalibration};
