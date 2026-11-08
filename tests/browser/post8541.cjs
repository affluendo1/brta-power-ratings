'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {JSDOM}=require('jsdom');
const ROOT=path.resolve(__dirname,'../..');
const dom=new JSDOM('<!doctype html><html><body><button id="customEditorBtn" class="hidden">Back to editor</button></body></html>',{
 url:'https://affluendo1.github.io/brta-power-ratings/',runScripts:'outside-only',pretendToBeVisual:true
});
const w=dom.window,ctx=dom.getInternalVMContext();
w.confirm=()=>true;
const sample=require('../test_custom_sections.js').sample();
w.localStorage.setItem('brta-custom-sections-v1',JSON.stringify([sample]));
for(const file of ['web/models/custom-section-model.js','web/models/custom-section-tools.js','web/features/custom-sections.js'])
 vm.runInContext(fs.readFileSync(path.join(ROOT,file),'utf8'),ctx,{filename:file});
const notifications=[];
w.addEventListener('brta-custom-sections-change',()=>{
 const overlay=w.document.getElementById('customAdminOverlay');
 notifications.push({open:!!overlay&&!overlay.classList.contains('hidden'),visible:!!overlay,selected:w.document.querySelector('#caSection')?.value});
});
const payload={format:'brta-custom-sections',version:1,sections:[{...sample,name:'Imported current local section'}]};
assert.equal(w.CustomSections.openBackup(payload),true);
assert.equal(notifications.length,1,'Import dispatches one catalog-change notification');
assert.equal(notifications[0].open,true,'The editor must already be open when a local section change fires');
assert.equal(w.document.querySelector('#caTitle').textContent,'Custom Competitions');
assert.equal(w.document.querySelector('#caSection').value,sample.id,'Editor must select the imported section');
assert.equal(JSON.parse(w.localStorage.getItem('brta-custom-sections-v1'))[0].name,'Imported current local section');
dom.window.close();
console.log('Existing-local-section backup import dispatch order and visible editor: passed');
