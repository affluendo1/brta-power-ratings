/* Source formats are explicit. Junior by-laws are never applied to adult draws. */
(function(){'use strict';
function formats823(){
 const only=BRTAScores.doublesOnly(D),local=ratingScope==='section';$('#page-ratings').dataset.ratingScope=ratingScope;
 document.querySelectorAll('[data-rating]').forEach(b=>{const hide=local&&only&&['singles','overall'].includes(b.dataset.rating);b.hidden=hide;b.setAttribute('aria-hidden',String(hide))});
 if(local&&only&&['singles','overall'].includes(ratingView))ratingView='doublesPlayers';
 document.querySelectorAll('[data-rating]').forEach(b=>b.classList.toggle('active',b.dataset.rating===ratingView));
}
const originalRatings823=renderRatings;renderRatings=function(...args){if(D)formats823();return originalRatings823(...args)};
window.addEventListener('brta-section-ready',()=>{formats823();renderRatings();if(D.meta?.competition_rules)$('#standingsCaveat').insertAdjacentHTML('beforeend',' Published TROLS points and ladder order. Junior washout and forfeit rules are not applied to this competition.')});

const detail823=resultDetailHTML;resultDetailHTML=function(match,...args){return detail823(match,...args)+((match?.rubbers||[]).some(r=>/\[TB [WL]\]/.test(r.score))?'<p class="small-note">[TB W] / [TB L] gives the home side’s deciding match-tiebreak result. Actual point scores were not recorded by TROLS. Bracketed tiebreaks are excluded from ordinary-game statistics.</p>':'')};
const simulation=simulationHTML;simulationHTML=function(result,...args){let html=simulation(result,...args);if(D.meta?.competition_rules){html=html.replace(/ · <b>Points [^<]*<\/b>/g,'');html+='<p class="small-note">Illustrative scorecard using this section’s observed format. Competition points are not projected.</p>'}return html};
const rules=brtaRulesHTML;brtaRulesHTML=function(){return '<div class="eight-reading"><h3>Other BRTA competitions</h3><p>Saturday afternoon and the weekday competitions retain TROLS’s published points and ladder order. Their scorecards can use doubles-only days, longer sets and multi-set doubles. Predictions use the format observed in that section and remain estimates. Missing starting times and unpublished results are not inferred. The Colin and Lin Price Award is not included.</p></div>'+rules()};
})();
