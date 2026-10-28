importScripts('../models/custom-section-model.js?v=80','../models/layout-model.js?v=80');
onmessage=event=>{try{postMessage({data:BRTALayoutModel.recalculate(event.data.data,event.data.model,CustomSectionModel)})}catch(error){postMessage({error:error.message})}};
