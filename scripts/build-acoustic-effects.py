#!/usr/bin/env python3
"""Create notification cues from real Salamander Grand Piano recordings.

No oscillators or procedural instrument synthesis are used. This script only
decodes, trims, filters, fades and layers the credited acoustic source samples.
Requires ffmpeg. See public/audio/LICENSE-acoustic-effects-v3.txt for attribution.
"""

from __future__ import annotations

import argparse
from array import array
import hashlib
import json
import math
from pathlib import Path
import subprocess
import sys
import wave


ROOT = Path(__file__).resolve().parents[1]
RATE = 44100
SOURCE_URLS = {note: f"https://tonejs.github.io/audio/salamander/{note}.mp3"
               for note in ["C4", "A4", "C5"]}


def decode(path: Path) -> list[tuple[float, float]]:
    output = subprocess.check_output([
        "ffmpeg", "-v", "error", "-i", str(path), "-f", "f32le",
        "-acodec", "pcm_f32le", "-ar", str(RATE), "-ac", "2", "pipe:1",
    ])
    samples = array("f")
    samples.frombytes(output)
    if sys.byteorder != "little":
        samples.byteswap()
    frames = list(zip(samples[0::2], samples[1::2]))
    peak = max(max(abs(left), abs(right)) for left, right in frames)
    threshold = max(0.0008, peak * 0.018)
    onset = next((index for index, (left, right) in enumerate(frames)
                  if max(abs(left), abs(right)) > threshold), 0)
    return frames[max(0, onset - round(RATE * 0.003)):]


def soften(frames: list[tuple[float, float]], cutoff: float) -> list[tuple[float, float]]:
    coefficient = 1.0 - math.exp(-math.tau * cutoff / RATE)
    left_previous = right_previous = 0.0
    output = []
    for left, right in frames:
        left_previous += coefficient * (left - left_previous)
        right_previous += coefficient * (right - right_previous)
        output.append((left_previous, right_previous))
    return output


def trim(frames: list[tuple[float, float]], duration: float, release: float,
         cutoff: float) -> list[tuple[float, float]]:
    count = round(duration * RATE)
    cut = frames[:count]
    if len(cut) < count:
        cut += [(0.0, 0.0)] * (count - len(cut))
    cut = soften(cut, cutoff)
    result = []
    attack = RATE * 0.003
    tail = RATE * release
    for index, (left, right) in enumerate(cut):
        fade_in = math.sin(min(1.0, index / attack) * math.pi / 2) ** 2
        fade_out = math.sin(min(1.0, (count - 1 - index) / tail) * math.pi / 2) ** 2
        result.append((left * fade_in * fade_out, right * fade_in * fade_out))
    return result


def add(output: list[list[float]], source: list[tuple[float, float]],
        start: float, gain: float) -> None:
    offset = round(start * RATE)
    for index, (left, right) in enumerate(source[:len(output) - offset]):
        output[offset + index][0] += left * gain
        output[offset + index][1] += right * gain


def finish(frames: list[list[float]], peak: float) -> list[tuple[float, float]]:
    # Remove only subsonic offset; the recorded instrument's body/noise remains.
    low_coefficient = 1.0 - math.exp(-math.tau * 20.0 / RATE)
    previous = [0.0, 0.0]
    cleaned = []
    for index, pair in enumerate(frames):
        edge = min(1.0, index / (RATE * 0.002),
                   (len(frames) - 1 - index) / (RATE * 0.008))
        edge = math.sin(max(0.0, edge) * math.pi / 2) ** 2
        value = []
        for channel, sample in enumerate(pair):
            previous[channel] += low_coefficient * (sample - previous[channel])
            value.append((sample - previous[channel]) * edge)
        cleaned.append(tuple(value))
    measured_peak = max(max(abs(left), abs(right)) for left, right in cleaned) or 1.0
    scale = peak / measured_peak
    return [(left * scale, right * scale) for left, right in cleaned]


def write(path: Path, frames: list[tuple[float, float]]) -> None:
    pcm = array("h", (round(max(-1.0, min(1.0, sample)) * 32767)
                      for frame in frames for sample in frame))
    if sys.byteorder != "little":
        pcm.byteswap()
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(".part.wav")
    with wave.open(str(temporary), "wb") as output:
        output.setnchannels(2)
        output.setsampwidth(2)
        output.setframerate(RATE)
        output.writeframes(pcm.tobytes())
    temporary.chmod(0o644)
    temporary.replace(path)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-dir", type=Path, required=True,
                        help="Directory containing salamander-C4.mp3, -A4.mp3 and -C5.mp3")
    parser.add_argument("--output", type=Path, default=ROOT / "public/audio")
    parser.add_argument("--preview", type=Path)
    args = parser.parse_args()
    paths = {note: args.source_dir / f"salamander-{note}.mp3" for note in SOURCE_URLS}
    for path in paths.values():
        if not path.is_file():
            raise SystemExit(f"Missing acoustic recording: {path.name}")
    sources = {note: decode(path) for note, path in paths.items()}
    definitions = {
        # A real felt-hammer attack damped quickly: no invented wood recording.
        "tap": (0.105, 0.32, [("C4", 0.0, 0.105, 0.067, 1100, 1.0)]),
        "retry": (0.245, 0.28, [("A4", 0.0, 0.245, 0.165, 2100, 1.0)]),
        "correct": (0.620, 0.46, [
            ("C4", 0.0, 0.480, 0.300, 3800, 0.70),
            ("A4", 0.108, 0.490, 0.310, 3600, 0.56),
        ]),
        "complete": (1.100, 0.48, [
            ("C4", 0.0, 0.900, 0.480, 3800, 0.65),
            ("A4", 0.095, 0.900, 0.480, 3900, 0.47),
            ("C5", 0.200, 0.880, 0.490, 3700, 0.33),
        ]),
    }
    preview = []
    cues = {}
    for name in ["tap", "correct", "retry", "complete"]:
        duration, peak, components = definitions[name]
        output = [[0.0, 0.0] for _ in range(round(duration * RATE))]
        for note, start, length, release, cutoff, gain in components:
            add(output, trim(sources[note], length, release, cutoff), start, gain)
        frames = finish(output, peak)
        filename = f"fx-{name}-acoustic-v3.wav"
        write(args.output / filename, frames)
        rms = math.sqrt(sum((a*a + b*b) / 2 for a, b in frames) / len(frames))
        cues[name] = {"file": filename, "duration": duration, "peak": peak,
                      "rms": round(rms, 6), "source_notes": [part[0] for part in components]}
        print(f"{filename}: {duration:.3f}s peak={peak:.2f} rms={rms:.4f}")
        preview += frames + [(0.0, 0.0)] * round(RATE * 0.5)
    if args.preview:
        write(args.preview, preview)
    provenance = {
        "instrument": "Salamander Grand Piano", "creator": "Alexander Holm",
        "license": "CC BY 3.0", "license_url": "https://creativecommons.org/licenses/by/3.0/",
        "source": "https://github.com/Tonejs/audio/tree/master/salamander",
        "changes": "Recorded piano samples decoded, trimmed, low-pass filtered, faded, gain adjusted and layered. No oscillator synthesis.",
        "recordings": {note: {"url": url, "sha256": hashlib.sha256(paths[note].read_bytes()).hexdigest()}
                       for note, url in SOURCE_URLS.items()},
        "cues": cues,
    }
    metadata = args.output / "acoustic-effects-v3.sources.json"
    metadata.write_text(json.dumps(provenance, ensure_ascii=False, indent=2) + "\n")
    metadata.chmod(0o644)


if __name__ == "__main__":
    main()
