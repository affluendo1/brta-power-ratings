/* Keep one set of controls and handlers; Classic puts them in a table masthead. */
(function(){'use strict';
 const classic=document.documentElement.dataset.interface==='classic';
 const masthead=document.querySelector('.classic-masthead');
 if(!classic){if(masthead)masthead.hidden=true;return}
 masthead.hidden=false;
 document.querySelector('.classic-brand-slot').append(document.querySelector('.brand-block'));
 document.querySelector('.classic-actions-slot').append(document.querySelector('.header-actions'));
 const version=document.querySelector('[data-classic-version]');if(version)version.textContent=window.BRTA_RELEASES?.[0]?.version||'';
})();
