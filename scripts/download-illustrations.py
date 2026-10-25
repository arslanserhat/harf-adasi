#!/usr/bin/env python3
"""Download the pinned-list Microsoft Fluent 3D illustrations, keeping TLS verification enabled."""
import concurrent.futures
import json
import ssl
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TARGET = ROOT / 'public' / 'illustrations'
SOURCES = json.loads((ROOT / 'scripts' / 'illustration-downloads.json').read_text())
CONTEXT = ssl.create_default_context()
TARGET.mkdir(parents=True, exist_ok=True)

def download(item):
    path = item['source']
    filename = item['filename']
    if not path.startswith('assets/') or '/3D/' not in path or not path.endswith('.png') or Path(filename).name != filename:
        raise ValueError('Unexpected asset path in download list')
    target = TARGET / filename
    if target.exists() and target.read_bytes().startswith(b'\x89PNG\r\n\x1a\n'):
        return target.stat().st_size
    url = 'https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/' + urllib.parse.quote(path, safe='/')
    for attempt in range(3):
        try:
            with urllib.request.urlopen(url, context=CONTEXT, timeout=45) as response:
                data = response.read()
            if not data.startswith(b'\x89PNG\r\n\x1a\n'):
                raise ValueError('Asset response is not PNG')
            target.write_bytes(data)
            return len(data)
        except Exception:
            if attempt == 2:
                raise
            time.sleep(attempt + 1)

if __name__ == '__main__':
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
        sizes = list(pool.map(download, SOURCES))
    license_url = 'https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/LICENSE'
    with urllib.request.urlopen(license_url, context=CONTEXT, timeout=45) as response:
        (TARGET / 'LICENSE.microsoft.txt').write_bytes(response.read())
    print(f'Downloaded {len(sizes)} Fluent 3D illustrations; {sum(sizes):,} bytes. Microsoft MIT license saved.')
