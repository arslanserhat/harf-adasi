#!/usr/bin/env python3
"""Fill repository-authored story audio using the existing approved voice.

Never reads browser progress, teacher input, credentials, or child recordings.
The manifest is replaced only after every required file passes validation.
"""
import argparse
import asyncio
import hashlib
import json
import os
from pathlib import Path
import ssl
import subprocess


ROOT = Path(__file__).resolve().parents[1]


def valid_clip(path: Path) -> bool:
    if not path.is_file() or path.stat().st_size < 1000:
        return False
    header = path.read_bytes()[:3]
    return header == b"ID3" or (len(header) >= 2 and header[0] == 0xFF and header[1] & 0xE0 == 0xE0)


async def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    inventory = json.loads(subprocess.check_output(
        ["node", "scripts/speech-inventory.mjs"], cwd=ROOT, text=True,
    ))
    output = ROOT / "public/audio"
    manifest_path = output / "manifest.json"
    manifest = json.loads(manifest_path.read_text())
    voice = manifest["voice"]
    if voice != "tr-TR-EmelNeural":
        raise SystemExit("The approved voice changed; review the generation configuration first.")
    pending = [entry for entry in inventory["entries"] if not entry["file"]]
    print(f"Scripted entries: {len(inventory['entries'])}; missing: {len(pending)}", flush=True)
    if args.dry_run or not pending:
        return

    import edge_tts
    import edge_tts.communicate
    edge_tts.communicate._SSL_CTX = ssl.create_default_context(cafile=os.environ.get("SSL_CERT_FILE"))
    proxy = os.environ.get("HTTPS_PROXY") or os.environ.get("HTTP_PROXY")
    gate = asyncio.Semaphore(4)
    generated = {}
    failures = []

    async def record(entry):
        rate = "+1%" if entry["category"] == "story" else "-5%"
        digest = hashlib.sha256(f"{voice}\n{rate}\n{entry['text']}".encode()).hexdigest()[:20]
        name = f"voice-{digest}.mp3"
        destination = output / name
        async with gate:
            if not valid_clip(destination):
                temporary = destination.with_suffix(".part.mp3")
                for attempt in range(2):
                    try:
                        speech = edge_tts.Communicate(entry["text"], voice, rate=rate,
                            proxy=proxy, connect_timeout=12, receive_timeout=25)
                        await asyncio.wait_for(speech.save(str(temporary)), timeout=40)
                        if not valid_clip(temporary):
                            raise ValueError("Invalid MP3")
                        temporary.chmod(0o644)
                        temporary.replace(destination)
                        break
                    except Exception as error:
                        temporary.unlink(missing_ok=True)
                        if attempt:
                            failures.append((name, type(error).__name__))
                if not valid_clip(destination):
                    return
            generated[entry["key"]] = (name, entry["text"], rate)
            if len(generated) % 10 == 0 or len(generated) == len(pending):
                print(f"Recorded: {len(generated)}/{len(pending)}", flush=True)

    await asyncio.gather(*(record(entry) for entry in pending))
    if failures or len(generated) != len(pending):
        print(json.dumps({"failures": failures}))
        raise SystemExit("Recording incomplete; previous manifest retained. Rerun to resume.")
    for key, (name, spoken, rate) in generated.items():
        manifest["phrases"][key] = name
        manifest.setdefault("delivery_overrides", {})[key] = {"voice": voice, "rate": rate, "spoken": spoken}
    manifest["phrases"] = dict(sorted(manifest["phrases"].items()))
    manifest["delivery_overrides"] = dict(sorted(manifest["delivery_overrides"].items()))
    manifest.setdefault("counts", {})["scripted_learning_entries"] = len(inventory["entries"])
    temporary_manifest = manifest_path.with_suffix(".json.tmp")
    temporary_manifest.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
    temporary_manifest.chmod(0o644)
    temporary_manifest.replace(manifest_path)
    print(f"Manifest updated: {len(manifest['phrases'])} keys.", flush=True)


if __name__ == "__main__":
    asyncio.run(main())
