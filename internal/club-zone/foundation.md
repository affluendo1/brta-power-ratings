# 8.2.2 Club Zone foundation

The BRTA pilot stays behind `?club-pilot=1` or `brta-club-pilot=1` in local
storage. Its ordinary entry remains the maintenance teaser without that flag.
The shared dialog system retains the page below it; the pilot adds a browser
history entry and destroys its map/listeners when closed or navigated Back.

The directory owns club identity and the primary address. Fixture observations
are additional evidence: a team nickname is resolved only by an exact club key
or the reviewed alias file. The 36 initial aliases were cross-checked against
current directory names and matching fixture venue addresses. Unknown labels
enter a review queue instead of being silently joined to a similarly named club.

Club IDs, season/section team IDs and venue IDs have separate namespaces. Venue
observations at the same address or mapped location are deduplicated. Conflicting
coordinates/addresses are kept as distinct reviewed grounds; no coordinate is
averaged. Missing directory coordinates may be supplemented by a matching fixture
observation. Empty facilities remain null in the data, and are omitted from the
rendered facts; a special detail does not create empty rows for every other club.
Repeated court descriptions are deduplicated rather than summed.

`Playing at` / `Playing @` text is parsed independently of names and contacts.
A fixture-specific assignment outranks a team/default assignment, which outranks
a club primary ground. Unresolved labels retain their wording and source; they
are not geocoded or guessed automatically. Assignment records keep round, date,
section and season where the source provides them.

The pilot's Logistics and Past stats tabs use separate datasets. Existing
per-competition club-history aggregates remain authoritative for stats. The new
physical logistics dataset supplies venue and source information only.

The map loads only after the pilot opens, reflows with invalidateSize after
container resizing, handles close-during-load and cleans observers/listeners.
The club list remains available if library/tile loading fails. OpenStreetMap
standard tiles are requested on demand with attribution; there is no offline
tile prefetch or bulk tile download. Source references:
https://leafletjs.com/reference.html#map-invalidatesize
https://operations.osmfoundation.org/policies/tiles/
