# 8.2.1.2 bug audit

Audited from `bbd4f05` on 29 October 2026. Scope: app and feature lifecycle,
rating/model adapters, custom sections and import tools, search, following,
share cards, optional effects, CSS, service worker, scraper/generator tests and
release wiring. Generated historical datasets and binary assets were not
individually revalidated or re-scraped.

## Findings repaired

| Area | Failure and repair |
| --- | --- |
| Dialog keyboard routing | Escape in Install closed Settings too (reproduced on the live 8.2.1.1 site). Route keys to the front visible dialog and use its actual close action, preserving feature cleanup and unsaved-change prompts. |
| Dialog focus and stacking | Competing focus traps and inconsistent layer order could trap focus underneath another dialog. Centralize keyboard routing, raise newly opened dialogs and restore focus on close. |
| Shared child dialogs | Replacing a child of Rounds lost the stored parent. Retain exactly one parent and give each dialog a unique title ID. |
| Section request ordering | A slow model computation assigned global data before checking its request token. Commit only the current request; ignore stale failures as well as successes. |
| Section navigation failure | A failed destination could leave selectors/season scope pointing away from the displayed data. Restore the committed catalog and season; suppress stale player/pin navigation. |
| Stale section UI | Player Lab context, a focused provisional entry and a band filter could survive into another section. Clear section-specific context only when the new section commits. |
| History loading | Opening a historical section downloaded the same payload twice. Reuse the validated response. Ignore a catalog response whose dialog has been replaced, and abandon dismissed historical navigation. |
| Doubles-only sections | The team filter was built only from singles players. Include individual doubles and pair teams. |
| RM3b date parsing | Undated playoffs threw a RangeError; locale parsing also shifted source dates by timezone. Parse explicitly in UTC and apply a neutral/latest-known fallback within each snapshot. Respect scorecards explicitly excluded from rating evidence. |
| Calendar dates | ISO-looking invalid dates bypassed validation. Reject impossible dates before display/export. |
| Historical command search | A resolved empty index kept displaying Loading. Track pending and resolved states separately. |
| Single-point graphs | An SVG move-to without a line rendered no visible observation. Draw a point for one observation. |
| Reduced motion | Imperative transitions and canvas confetti ignored the device/site motion setting; zero-duration infinite WAAPI animations could remain unresolved. Honor both settings and use one zero-duration iteration. |
| Interrupted optional effects | Delayed callbacks could resume audio or add an effect after leaving. Cancel scoped timers, invalidate decoded-image callbacks and restore volume on exit. |
| Hidden optional control | The invisible crown remained keyboard-focusable and lived inside an aria-hidden container. Make it focusable only when revealed and expose its accessible name. |
| Share-card lifecycle | Old ResizeObservers could retarget a new global canvas. Bind each observer to its canvas and disconnect on replacement/removal. Capture export names, share titles and status nodes before asynchronous completion. |
| Empty scorecards | The share wrapper dereferenced a missing fixture before the underlying empty-state guard. Preserve that guard. |
| Following checks | Invalid stored pin entries could break rendering, an unfollowed entry could regain a pending update during a check, and manual check status was immediately overwritten. Validate stored shapes, skip removed pins and render status after the dialog refresh. Preserve the rating model used for a pinned summary so RM3b pins do not report an artificial RM3 rating change. |
| Standings notices | Renderer overrides hid missing-scorecard/source discrepancy notices. Preserve them, including when adult-competition notices are added. |
| Small viewports | The fixed team menu could receive a negative position. Clamp both axes inside the viewport. |
| Offline responses | Missing assets received HTML as if it were JS/CSS/data; cache-write failures discarded valid network responses. Limit HTML fallback to navigation, keep valid responses on quota/cache failures, and cache requested JSON/audio. |
| Cache consistency | HTML, CSS imports and worker imports used different old revisions. Align the shell URLs and cache revision for this release. |

## Validation

- Python unittest suite: 107 tests passed locally.
- All JavaScript regression files in `tests/*.js` passed locally.
- Added built-in Node tests for out-of-order section completion/errors, offline
  navigation versus asset responses, unavailable caches and quota failures.
- Added date/excluded-scorecard regressions to the model/calendar suites.
- Added `tests/browser/audit.cjs` and a dedicated GitHub Actions workflow. It
  executes the actual page scripts in jsdom and checks nested dialogs, focus
  restoration, shared-dialog replacement, one-point charts, empty historical
  search, reduced-motion transitions and More Settings cleanup.
- Static dependency/path checks and JavaScript syntax checks included.

## Limits

An audit cannot establish that a program has no remaining bugs. jsdom checks
DOM/event behavior, not rendered pixels, GPU frame pacing or native browser
install/share dialogs. Real-browser checks cover the live desktop viewport;
mobile hardware, Safari/iOS and prolonged animation performance require further
device testing. No competition scores or published ratings were regenerated as
part of this patch.
