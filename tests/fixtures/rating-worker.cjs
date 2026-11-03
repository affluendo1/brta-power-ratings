/* Run the real worker and importScripts graph in an isolated Node context. */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
module.exports=class RatingWorker{
 constructor(){this.closed=false}
 postMessage(input){setTimeout(async()=>{try{
  const root=path.resolve(__dirname,'../..'),workerRoot=path.join(root,'web/workers'),scope={console,setTimeout,clearTimeout,URL,Date,postMessage:data=>{if(!this.closed)this.onmessage?.({data})}};
  scope.fetch=async url=>{const file=path.resolve(workerRoot,String(url).split('?')[0]);return{ok:fs.existsSync(file),json:async()=>JSON.parse(fs.readFileSync(file,'utf8'))}};
  const context=vm.createContext(scope);scope.importScripts=(...urls)=>{for(const url of urls)vm.runInContext(fs.readFileSync(path.resolve(workerRoot,url.split('?')[0]),'utf8'),context,{filename:url})};
  vm.runInContext(fs.readFileSync(path.join(workerRoot,'rating-worker.js'),'utf8'),context);await scope.onmessage({data:structuredClone(input)});
 }catch(error){this.onmessage?.({data:{error:error.message}})}},0)}
 terminate(){this.closed=true}
};
