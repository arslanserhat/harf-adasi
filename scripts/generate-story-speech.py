#!/usr/bin/env python3
"""Record only the 30 fixed, original watermill-film lines with Turkish Emel.

Reads no child profile, teacher input, browser data, credentials, or recordings.
Existing root audio files and phrase mappings must remain unchanged. Run with
--verify-only to inspect the final MP3 frames and all 30 runtime phrase mappings.
"""
import argparse
import asyncio
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import ssl
import subprocess
import unicodedata


ROOT = Path(__file__).resolve().parents[1]
AUDIO = ROOT / "public/audio"
OUTPUT = AUDIO / "story-watermill-v1"
MANIFEST = AUDIO / "manifest.json"
VOICE = "tr-TR-EmelNeural"
ROLES = {
    "narrator": {"rate": "-3%", "pitch": "+0Hz"},
    "lion": {"rate": "-5%", "pitch": "-5Hz"},
    "bird": {"rate": "+2%", "pitch": "+12Hz"},
}


def normalize(text):
    value = unicodedata.normalize("NFC", text).translate(str.maketrans({"I": "ı", "İ": "i"})).lower()
    return " ".join(re.sub('[“”„"‘’]', '', value).split())


def inventory():
    node = shutil.which("node")
    if not node:
        raise SystemExit("Node.js is required to load the fixed film script.")
    source_url = (ROOT / "src/story-film-script.js").as_uri()
    source = f"import {{ FILM_LINES }} from {json.dumps(source_url)}; process.stdout.write(JSON.stringify(FILM_LINES));"
    entries = json.loads(subprocess.check_output([node, "--input-type=module", "-e", source], cwd=ROOT, encoding="utf-8"))
    if len(entries) != 30 or len({line["id"] for line in entries}) != 30:
        raise SystemExit("Expected exactly 30 unique, fixed film lines.")
    for line in entries:
        if line.get("speaker") not in ROLES or not re.fullmatch(r"s[1-6]-[a-z-]+", line["id"]) or not line.get("text"):
            raise SystemExit("Unexpected film line shape; review the source before sending text.")
        line["key"] = normalize(line["text"])
        line["file"] = f"story-watermill-v1/{line['id']}.mp3"
    if len({line["key"] for line in entries}) != 30:
        raise SystemExit("Film phrase keys must be unique after runtime normalization.")
    return entries


def mp3_info(path):
    """Validate the complete MPEG Layer III frame sequence, not just an ID3 tag."""
    data = path.read_bytes()
    position = 0
    if data[:3] == b"ID3":
        if len(data) < 10 or any(value & 0x80 for value in data[6:10]):
            raise ValueError("Invalid ID3 header")
        position = 10 + sum(value << shift for value, shift in zip(data[6:10], (21, 14, 7, 0)))
        if data[5] & 0x10:
            position += 10
    frames = 0
    duration = 0.0
    sample_rates = set()
    while position < len(data):
        if len(data) - position == 128 and data[position:position + 3] == b"TAG":
            break
        if position + 4 > len(data):
            raise ValueError("Truncated MP3 frame header")
        header = int.from_bytes(data[position:position + 4], "big")
        version, layer = (header >> 19) & 3, (header >> 17) & 3
        bitrate_index, sample_index = (header >> 12) & 15, (header >> 10) & 3
        if header >> 21 != 0x7FF or version == 1 or layer != 1 or bitrate_index in (0, 15) or sample_index == 3:
            raise ValueError(f"Invalid MPEG Layer III frame at byte {position}")
        sample_rate = (44100, 48000, 32000)[sample_index] // ({3: 1, 2: 2, 0: 4}[version])
        bitrates = (0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320) if version == 3 else (0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160)
        frame_size = (144 if version == 3 else 72) * bitrates[bitrate_index] * 1000 // sample_rate + ((header >> 9) & 1)
        if position + frame_size > len(data):
            raise ValueError("Truncated MP3 frame payload")
        position += frame_size
        duration += (1152 if version == 3 else 576) / sample_rate
        frames += 1
        sample_rates.add(sample_rate)
    if len(data) < 1000 or frames < 10 or len(sample_rates) != 1 or duration <= 0:
        raise ValueError("Empty or inconsistent MP3")
    return {"bytes": len(data), "frames": frames, "seconds": round(duration, 3), "sample_rate": sample_rates.pop()}


def hashes():
    return {path.name: hashlib.sha256(path.read_bytes()).hexdigest() for path in AUDIO.glob("*.mp3")}


def verify(entries, manifest):
    rows = []
    for line in entries:
        if manifest["phrases"].get(line["key"]) != line["file"]:
            raise ValueError(f"Missing runtime phrase mapping: {line['id']}")
        rows.append({"id": line["id"], "speaker": line["speaker"], **mp3_info(AUDIO / line["file"])})
    return rows


async def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--verify-only", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    entries = inventory()
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    original_phrases = dict(manifest["phrases"])
    if manifest.get("voice") != VOICE:
        raise SystemExit("The approved manifest voice changed; review before generation.")
    if args.dry_run:
        print(json.dumps({"fixed_lines": len(entries), "voice": VOICE, "roles": ROLES, "concurrency": 2, "max_attempts": 2}, ensure_ascii=False))
        return
    before = hashes()
    if not args.verify_only:
        import edge_tts
        import edge_tts.communicate
        edge_tts.communicate._SSL_CTX = ssl.create_default_context(cafile=os.environ.get("SSL_CERT_FILE"))
        proxy = os.environ.get("HTTPS_PROXY") or os.environ.get("HTTP_PROXY")
        OUTPUT.mkdir(parents=True, exist_ok=True)
        gate = asyncio.Semaphore(2)
        failures = []

        async def record(line):
            target = AUDIO / line["file"]
            async with gate:
                if target.exists():
                    mp3_info(target)
                    print(f"Cached: {line['id']}", flush=True)
                    return
                temporary = target.with_suffix(".part.mp3")
                for attempt in range(2):
                    try:
                        speech = edge_tts.Communicate(line["text"], VOICE, **ROLES[line["speaker"]], proxy=proxy, connect_timeout=12, receive_timeout=30)
                        await asyncio.wait_for(speech.save(str(temporary)), timeout=50)
                        info = mp3_info(temporary)
                        temporary.replace(target)
                        print(f"Recorded: {line['id']} ({info['bytes']} bytes, {info['seconds']} s)", flush=True)
                        return
                    except Exception as error:
                        temporary.unlink(missing_ok=True)
                        print(f"Attempt {attempt + 1}/2: {line['id']}: {type(error).__name__}", flush=True)
                        if attempt == 0:
                            await asyncio.sleep(1)
                failures.append(line["id"])

        await asyncio.gather(*(record(line) for line in entries))
        if failures:
            raise SystemExit(f"Incomplete audio: {', '.join(failures)}. Manifest retained.")
        for line in entries:
            old = manifest["phrases"].get(line["key"])
            if old is not None and old != line["file"]:
                raise SystemExit(f"Existing phrase collision: {line['id']}; manifest retained.")
            manifest["phrases"][line["key"]] = line["file"]
            manifest.setdefault("delivery_overrides", {})[line["key"]] = {
                "voice": VOICE, **ROLES[line["speaker"]], "speaker": line["speaker"], "spoken": line["text"],
            }
        manifest.setdefault("counts", {})["story_watermill_v1_entries"] = len(entries)
        rows = verify(entries, manifest)
        if any(manifest["phrases"].get(key) != value for key, value in original_phrases.items()) or hashes() != before:
            raise SystemExit("Existing audio or phrase mapping changed; manifest retained.")
        manifest["phrases"] = dict(sorted(manifest["phrases"].items()))
        manifest["delivery_overrides"] = dict(sorted(manifest["delivery_overrides"].items()))
        temporary_manifest = MANIFEST.with_suffix(".json.tmp")
        temporary_manifest.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        temporary_manifest.replace(MANIFEST)
    final_manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    rows = verify(entries, final_manifest)
    print(json.dumps({"validated": len(rows), "legacy_root_mp3_unchanged": hashes() == before, "legacy_root_mp3_count": len(before),
        "manifest_phrase_count": len(final_manifest["phrases"]), "total_bytes": sum(row["bytes"] for row in rows),
        "total_seconds": round(sum(row["seconds"] for row in rows), 3), "clips": rows}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    asyncio.run(main())
