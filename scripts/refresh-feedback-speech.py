#!/usr/bin/env python3
"""Refresh fixed Turkish pronunciation and short feedback, retaining the manifest.

The word 'al' is cut from a Turkish sentence using service word boundaries,
not synthesized as a punctuated abbreviation. No browser/child data is read.
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
VOICE = "tr-TR-EmelNeural"
CONTEXT = "Anne nane al."
PRAISE = "Tebrikler, başardın!"
JOURNEY = "Tebrikler, başardın! Macera kartın açıldı."


def key(text):
    return text.translate(str.maketrans({"I": "ı", "İ": "i"})).lower().strip()


def filename(text, profile="neutral"):
    digest = hashlib.sha256(f"{VOICE}\n{profile}\n{text}".encode()).hexdigest()[:20]
    return f"voice-{digest}.mp3"


def valid(path):
    return path.is_file() and path.stat().st_size > 1000


async def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    if args.dry_run:
        print("Fixed context-al pronunciation, sentence, short praise and journey-card feedback.")
        return
    import edge_tts
    import edge_tts.communicate
    edge_tts.communicate._SSL_CTX = ssl.create_default_context(cafile=os.environ.get("SSL_CERT_FILE"))
    proxy = os.environ.get("HTTPS_PROXY") or os.environ.get("HTTP_PROXY")
    output = ROOT / "public/audio"
    manifest_path = output / "manifest.json"
    manifest = json.loads(manifest_path.read_text())

    async def record(text, boundaries=False):
        file = output / filename(text)
        events = []
        if not valid(file) or boundaries:
            temporary = file.with_suffix(".part.mp3")
            request = edge_tts.Communicate(text, VOICE, rate="+0%", boundary="WordBoundary", proxy=proxy,
                connect_timeout=12, receive_timeout=25)
            async def stream():
                with temporary.open("wb") as handle:
                    async for event in request.stream():
                        if event["type"] == "audio":
                            handle.write(event["data"])
                        elif event["type"] == "WordBoundary":
                            events.append(event)
            try:
                await asyncio.wait_for(stream(), timeout=40)
                if not valid(temporary):
                    raise ValueError("Empty fixed recording")
                temporary.chmod(0o644)
                temporary.replace(file)
            finally:
                temporary.unlink(missing_ok=True)
        return file, events

    word_file = output / filename("al", "context-word-al-v2")
    sentence_file, events = await record(CONTEXT, boundaries=not valid(word_file))
    pronunciation = manifest.get("delivery_overrides", {}).get("al", {}).get("source_range_seconds")
    if not valid(word_file):
        words = [event for event in events if key(event["text"]).strip(".!?…") == "al"]
        if len(words) != 1:
            raise ValueError("A unique Turkish 'al' word boundary was not returned; manifest retained.")
        event = words[0]
        start = max(0, event["offset"] / 10000000 - .035)
        end = (event["offset"] + event["duration"]) / 10000000 + .08
        duration = end - start
        temporary = word_file.with_suffix(".part.mp3")
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(sentence_file), "-af",
            f"atrim=start={start:.6f}:end={end:.6f},asetpts=PTS-STARTPTS,afade=t=in:d=0.008,afade=t=out:st={max(0,duration-.018):.6f}:d=0.018,apad=pad_dur=0.09",
            "-c:a", "libmp3lame", "-q:a", "3", str(temporary)], check=True)
        if not valid(temporary):
            raise ValueError("Invalid contextual pronunciation; manifest retained.")
        temporary.chmod(0o644)
        temporary.replace(word_file)
        pronunciation = [round(start, 4), round(end, 4)]
    praise_file, _ = await record(PRAISE)
    journey_file, _ = await record(JOURNEY)
    deliveries = manifest.setdefault("delivery_overrides", {})
    for text, file, spoken in [
        ("al", word_file, "al"), (CONTEXT, sentence_file, CONTEXT),
        ("Tebrikler!", praise_file, PRAISE), (PRAISE, praise_file, PRAISE), (JOURNEY, journey_file, JOURNEY),
    ]:
        manifest["phrases"][key(text)] = file.name
        deliveries[key(text)] = {"voice": VOICE, "rate": "+0%", "spoken": spoken, "profile": "clear-short-feedback"}
    deliveries["al"].update({"source_phrase": CONTEXT, "source_range_seconds": pronunciation})
    manifest["phrases"] = dict(sorted(manifest["phrases"].items()))
    manifest["delivery_overrides"] = dict(sorted(deliveries.items()))
    manifest["feedback_profile"] = "clear-short-feedback"
    temporary = manifest_path.with_suffix(".json.tmp")
    temporary.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
    temporary.chmod(0o644)
    temporary.replace(manifest_path)
    print(json.dumps({"word_source_seconds": pronunciation, "short_feedback": praise_file.name,
        "journey_feedback": journey_file.name, "keys": len(manifest["phrases"])}, ensure_ascii=False))


if __name__ == "__main__":
    asyncio.run(main())
