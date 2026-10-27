importScripts('custom-section-model.js?v=3','layout-model.js?v=1');
onmessage=event=>{try{postMessage({data:BRTALayoutModel.recalculate(event.data.data,event.data.model,CustomSectionModel)})}catch(error){postMessage({error:error.message})}};
