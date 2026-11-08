// Capture jsdom's native close before the app defines its global close(selector).
// Disconnect application observers before destroying the document.
module.exports=function trackDOMLifecycle(window){
 const Observer=window.MutationObserver,observers=new Set(),close=window.close.bind(window);
 window.MutationObserver=class extends Observer{
  constructor(callback){super(callback);observers.add(this)}
 };
 return ()=>{for(const observer of observers)observer.disconnect();observers.clear();close()};
};
