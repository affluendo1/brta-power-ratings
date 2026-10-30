importScripts('../models/score-formats.js?v=823','../models/custom-section-model.js?v=823','../models/layout-model.js?v=823');
onmessage=event=>{try{postMessage({data:BRTALayoutModel.recalculate(event.data.data,event.data.model,CustomSectionModel)})}catch(error){postMessage({error:error.message})}};
