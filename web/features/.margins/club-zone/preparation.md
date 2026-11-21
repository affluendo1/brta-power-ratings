# Club Zone asset preparation — not activated

This is preparation for a future design discussion. The website header, home
screens, account features, Settings, association-logo interactions and Club Zone
entry points are not changed by this work. No new module is imported by the
page, and no new network request or geolocation prompt occurs at startup.

## Files ready to use

- `web/vendor/leaflet/`: existing Leaflet **1.9.4**, plus its original five
  marker/retina/shadow/layer-control PNGs and restored upstream stylesheet.
  BSD-2-Clause licence retained. The existing JavaScript matches upstream bytes.
- `web/vendor/leaflet-markercluster/`: **leaflet.markercluster 1.5.3**,
  minified module, core/default styles and MIT licence. The module is stored,
  not loaded. Source maps/build tooling are not copied.
- `assets/preparation/club-zone/vendor-manifest.json`: upstream URLs,
  package archive SHA-512 integrity values and file SHA-256 hashes. Vendor
  text uses LF line endings with trailing whitespace removed; original hashes
  and this normalization are recorded where applicable.
- `assets/associations/<trols-key>/`: eleven original PNG badges from their
  association's TROLS headers, plus NENTG's original GIF wordmark. Its nominal
  `logo.png` was a two-pixel placeholder, not a usable logo. No tracing, recolouring, cropping or upscaling. `assets/associations/manifest.json` records each source page,
  exact image URL, dimensions, status and content hash.

Source assets are intentionally separate from the existing live BRTA site icon.
The association logos remain the property of their owners. Downloading them
does not establish an open-content licence, permission to imply endorsement,
or that an old association's branding is current. MDJTA is marked historical
because TROLS directs its users to BRTA from 2026.

## Future map integration

Load Leaflet before the clustering plugin. Load `MarkerCluster.css` and either
`MarkerCluster.Default.css` or the future site's own cluster design. For a large
club network, use chunked marker insertion and avoid synchronously drawing all
markers in a long blocking loop. Honour both the OS reduced-motion preference
and the website animation setting (`animate: false`, `animateAddingMarkers:
false`, `spiderfyOnMaxZoom` considered separately). Remove the map and listeners
when the containing Club Zone view is destroyed.

Prefer the source-attributed venue coordinates already present in
`data/current/club-directory.json` and fixture-specific observations in
`data/current/clubs.json`. Keep association, club, team and physical venue as
separate identities: one club can use several venues, a fixture can use an
alternate ground, and similarly named clubs can exist in different associations.
Unresolved location conflicts should remain visible to future maintainers.

The dormant adapter currently bounds its map to metropolitan Melbourne. Check
that bounds are appropriate before connecting non-BRTA clubs to it.

## Basemap downloads

Do not prefetch city/region tiles from `tile.openstreetmap.org`, package them
in Git, or add those tiles to the service-worker precache. Its standard tile
service prohibits bulk/offline download features. Normal interactive viewing
must retain visible attribution and honour provider cache/referrer requirements.
The current service worker only intercepts same-origin requests.

If true offline street maps become a requirement, choose a self-hosted dataset
or a provider whose terms explicitly permit offline redistribution, then record
the dataset version, licence, coverage and attribution. A vector format such as
PMTiles may be suitable later, but neither a large basemap nor a new renderer is
added speculatively here. Ordinary club coordinates/metadata and map imagery
have different source/rights requirements.

## Brainstorming candidates — not implemented

1. A club network map with clusters, association filters and club selection.
2. A fixture venue view using the actual assigned ground, plus directions links.
3. Entrance pins, parking, bicycle racks and public transport information;
   verify these separately from a club's postal address or approximate centre.
4. Court count, surface, lights and accessible facilities, with field-level
   source and checked date. Unknown does not mean absent.
5. Alternate venues and fixture-specific venue changes, with source provenance.
6. An optional nearby-club view. Label straight-line distance accurately; a
   driving time requires a routing provider and must not be invented.
7. A source/last-checked panel so a family can judge stale venue information.
8. Club photos and court diagrams only from owner-supplied or appropriately
   licensed sources; do not copy arbitrary satellite imagery or map screenshots.
9. Keep association information, club logistics and competition statistics
   distinct in navigation, with one clear return to the Data Centre.
10. Keep Settings available inside any future account panel. Account-to-player
    linking must distinguish a verified account from a name found in scorecards;
    matching names across clubs/seasons are not necessarily the same person.

## Sources

- TROLS directory: https://www.trols.org.au/
- Leaflet download and packaged image layout: https://leafletjs.com/download.html
- Leaflet licence: https://github.com/Leaflet/Leaflet/blob/v1.9.4/LICENSE
- Cluster module: https://github.com/Leaflet/Leaflet.markercluster
- Standard tile policy: https://operations.osmfoundation.org/policies/tiles/
- Dataset attribution: https://www.openstreetmap.org/copyright

## Validation

Run `python validation/validate_club_assets.py`. It verifies exact logo
coverage, PNG dimensions, hashes, paths and packaged third-party files. The UI
regression workflow also runs this check. These checks validate the files on
disk; they do not grant branding permission or enable an unfinished map feature.
