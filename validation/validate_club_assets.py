"""Validate dormant third-party and association assets without network access."""
from pathlib import Path
import hashlib
import json
import re
import struct

ROOT = Path(__file__).resolve().parents[1]
ASSOCIATIONS = {'brta', 'bdta', 'bdnta', 'dvta', 'erta', 'hdta', 'ldnta', 'metro', 'mdjta', 'nejta', 'nentg', 'wdta'}

def read_file(record):
    path = (ROOT / record['path']).resolve()
    assert path.is_relative_to(ROOT), f'Asset escapes the repository: {path}'
    blob = path.read_bytes()
    assert len(blob) == record['bytes'], f'Size mismatch: {path}'
    assert hashlib.sha256(blob).hexdigest() == record['sha256'], f'Hash mismatch: {path}'
    return path, blob

def validate():
    logos = json.loads((ROOT / 'assets/associations/manifest.json').read_text())['logos']
    assert len(logos) == len(ASSOCIATIONS)
    assert {logo['key'] for logo in logos} == ASSOCIATIONS
    assert next(logo for logo in logos if logo['key'] == 'mdjta')['status'] == 'historical'
    for logo in logos:
        path, blob = read_file(logo)
        assert logo['source_page'] == f"https://www.trols.org.au/{logo['key']}/index.php"
        assert logo['source_url'].startswith(f"https://www.trols.org.au/{logo['key']}/images/")
        if path.suffix == '.png':
            assert blob.startswith(b'\x89PNG\r\n\x1a\n')
            size = struct.unpack('>II', blob[16:24])
        else:
            assert blob[:6] in {b'GIF87a', b'GIF89a'}
            size = struct.unpack('<HH', blob[6:10])
        assert size == (logo['width'], logo['height'])
        assert min(size) > 2, f'Placeholder image: {path}'
        assert logo['modified'] is False
    vendors = json.loads((ROOT / 'assets/preparation/club-zone/vendor-manifest.json').read_text())['packages']
    assert {v['name'] for v in vendors} == {'leaflet', 'leaflet.markercluster'}
    for vendor in vendors:
        assert vendor['license'] in {'BSD-2-Clause', 'MIT'}
        assert vendor['archive_integrity'].startswith('sha512-')
        for record in vendor['files']:
            read_file(record)
    for css in [ROOT/'web/vendor/leaflet/leaflet.css', ROOT/'web/vendor/leaflet-markercluster/MarkerCluster.css', ROOT/'web/vendor/leaflet-markercluster/MarkerCluster.Default.css']:
        for ref in re.findall(r'url\([\'"]?([^\)\'\"]+)', css.read_text()):
            if not ref.startswith(('data:', 'http', '#')):
                assert (css.parent/ref).is_file(), f'Missing CSS image: {ref}'
    # Preparatory assets must remain disconnected from startup and precaching.
    for file in [ROOT/'index.html', ROOT/'sw.js']:
        assert 'leaflet-markercluster' not in file.read_text()
        assert 'assets/associations/' not in file.read_text()
    print(f'Validated {len(logos)} association marks, {len(vendors)} pinned packages, image references and dormant wiring.')

if __name__ == '__main__':
    validate()
