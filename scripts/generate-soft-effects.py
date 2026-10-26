#!/usr/bin/env python3
"""Generate the original tactile v2 sound set using only Python's stdlib.

Short noise-driven resonators model a soft striker, damped wood/felt bars and a
paper brush. No square waves, exposed sustained oscillators, or arcade melody.
This is development-time asset generation; the browser plays local WAV files.
"""

from __future__ import annotations

import argparse
from array import array
import math
from pathlib import Path
import random
import sys
import wave


ROOT = Path(__file__).resolve().parents[1]
SAMPLE_RATE = 44100


def lowpass(signal: list[float], cutoff: float) -> list[float]:
    coefficient = 1.0 - math.exp(-math.tau * cutoff / SAMPLE_RATE)
    previous = 0.0
    output = []
    for sample in signal:
        previous += coefficient * (sample - previous)
        output.append(previous)
    return output


def mix(destination: list[float], signal: list[float], start: float, gain: float = 1.0) -> None:
    offset = round(start * SAMPLE_RATE)
    for index, sample in enumerate(signal[:max(0, len(destination) - offset)]):
        destination[offset + index] += sample * gain


def striker(rng: random.Random, seconds: float = 0.008) -> list[float]:
    count = round(seconds * SAMPLE_RATE)
    # A rounded positive contact force with a little felt/noise texture.
    contact = [math.sin(math.pi * index / (count - 1)) ** 2
               * (0.65 + rng.uniform(-0.35, 0.35)) for index in range(count)]
    return lowpass(lowpass(contact, 1800), 1800)


def modal_hit(frequency: float, seconds: float, rng: random.Random,
              modes: list[tuple[float, float, float]], contact_seconds: float = 0.008) -> list[float]:
    """A short physical contact excites independent lossy resonant modes.

    Each tuple is frequency ratio, amplitude and decay time. A ratio need not be
    harmonic: wood/bar modes are intentionally unlike a simple sine-wave beep.
    """
    count = round(seconds * SAMPLE_RATE)
    excitation = striker(rng, contact_seconds)
    output = [0.0] * count
    for ratio, level, decay in modes:
        radius = math.exp(-1.0 / (SAMPLE_RATE * decay))
        recurrence = 2.0 * radius * math.cos(math.tau * frequency * ratio / SAMPLE_RATE)
        radius_squared = radius * radius
        previous = previous_previous = 0.0
        response = []
        for index in range(count):
            force = excitation[index] if index < len(excitation) else 0.0
            sample = recurrence * previous - radius_squared * previous_previous + force
            response.append(sample)
            previous_previous, previous = previous, sample
        peak = max(abs(sample) for sample in response) or 1.0
        for index, sample in enumerate(response):
            output[index] += sample / peak * level
    return output


def brush(seconds: float, rng: random.Random, *, soft: bool = True) -> list[float]:
    count = round(seconds * SAMPLE_RATE)
    noise = [rng.uniform(-1.0, 1.0) for _ in range(count)]
    broad = lowpass(lowpass(noise, 2500 if soft else 3800), 2500 if soft else 3800)
    body = lowpass(broad, 220)
    output = []
    for index, (sample, bass) in enumerate(zip(broad, body)):
        position = index / max(1, count - 1)
        envelope = math.sin(math.pi * position) ** 2 * math.exp(-2.0 * position)
        # Irregular hand pressure, without a mechanical repeated pulse.
        pressure = 0.76 + 0.17 * math.sin(8.3 * position) + 0.07 * math.sin(23.7 * position)
        output.append((sample - bass) * envelope * pressure)
    return output


def make_effect(name: str) -> tuple[list[float], float]:
    durations = {"tap": 0.14, "correct": 0.62, "retry": 0.27, "complete": 1.12}
    peaks = {"tap": 0.34, "correct": 0.45, "retry": 0.27, "complete": 0.48}
    rng = random.Random(f"harf-adasi-tactile-v2:{name}")
    output = [0.0] * round(durations[name] * SAMPLE_RATE)
    wood_modes = [(1.0, 0.72, 0.021), (1.59, 0.37, 0.014),
                  (2.31, 0.19, 0.010), (3.89, 0.055, 0.006)]
    # Keep lower inharmonic wood modes audible through the short tail. A long
    # isolated fundamental would become a sine-like electronic notification.
    felt_modes = [(1.0, 0.66, 0.105), (1.58, 0.22, 0.085),
                  (2.31, 0.16, 0.072), (3.96, 0.055, 0.036)]
    bell_modes = [(1.0, 0.74, 0.27), (2.013, 0.16, 0.15),
                  (2.76, 0.067, 0.090), (4.074, 0.022, 0.045)]
    if name == "tap":
        mix(output, modal_hit(218, 0.13, rng, wood_modes, 0.0045), 0.0, 0.7)
        mix(output, brush(0.045, rng), 0.0, 0.44)
    elif name == "correct":
        # A close rolled open fifth, perceived as one felt/wood reward object,
        # rather than a rising three-note videogame arpeggio.
        mix(output, modal_hit(261.626, 0.58, rng, felt_modes, 0.0035), 0.0, 0.68)
        mix(output, modal_hit(392.0, 0.57, rng, felt_modes, 0.0040), 0.026, 0.44)
        mix(output, brush(0.12, rng), 0.012, 0.25)
    elif name == "retry":
        # Paper movement and a dull small knock; no falling pitch/error buzzer.
        mix(output, brush(0.23, rng), 0.0, 0.82)
        mix(output, modal_hit(173, 0.12, rng, wood_modes, 0.006), 0.025, 0.13)
    elif name == "complete":
        # Soft acoustic chord with tiny human roll and faint shaker texture.
        for start, frequency, gain in [(0.0, 293.665, 0.60),
                                       (0.036, 440.0, 0.40),
                                       (0.078, 587.33, 0.22)]:
            mix(output, modal_hit(frequency, 0.99, rng, bell_modes, 0.011), start, gain)
        mix(output, brush(0.24, rng), 0.025, 0.26)
        mix(output, brush(0.21, rng), 0.24, 0.13)
    return output, peaks[name]


def finish_stereo(signal: list[float], peak: float) -> list[tuple[float, float]]:
    # Remove subsonic offset, soften the upper partials and add a tiny room body.
    subsonic = lowpass(signal, 22)
    dry = lowpass(lowpass([value - bass for value, bass in zip(signal, subsonic)], 4200), 4200)
    left, right = dry[:], dry[:]
    for delay, gain in [(0.011, 0.10), (0.027, 0.055), (0.043, 0.025)]:
        mix(left, dry, delay, gain)
    for delay, gain in [(0.014, 0.095), (0.031, 0.050), (0.047, 0.022)]:
        mix(right, dry, delay, gain)
    count = len(dry)
    attack = round(0.0025 * SAMPLE_RATE)
    release = round(0.024 * SAMPLE_RATE)
    for channel in [left, right]:
        for index in range(count):
            fade_in = math.sin(min(1.0, index / attack) * math.pi / 2) ** 2
            fade_out = math.sin(min(1.0, (count - 1 - index) / release) * math.pi / 2) ** 2
            channel[index] *= fade_in * fade_out
    actual_peak = max(max(map(abs, left)), max(map(abs, right)), 1e-12)
    scale = peak / actual_peak
    return [(a * scale, b * scale) for a, b in zip(left, right)]


def write_wave(path: Path, stereo: list[tuple[float, float]]) -> None:
    samples = array("h", (round(max(-1.0, min(1.0, sample)) * 32767)
                          for frame in stereo for sample in frame))
    if sys.byteorder != "little":
        samples.byteswap()
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(".part.wav")
    with wave.open(str(temporary), "wb") as output:
        output.setnchannels(2)
        output.setsampwidth(2)
        output.setframerate(SAMPLE_RATE)
        output.writeframes(samples.tobytes())
    temporary.chmod(0o644)
    temporary.replace(path)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=ROOT / "public/audio")
    parser.add_argument("--preview", type=Path, help="Optional concatenated tap/correct/retry/complete preview.")
    args = parser.parse_args()
    preview = []
    for name in ["tap", "correct", "retry", "complete"]:
        signal, peak = make_effect(name)
        stereo = finish_stereo(signal, peak)
        write_wave(args.output / f"fx-{name}-v2.wav", stereo)
        rms = math.sqrt(sum((left * left + right * right) / 2 for left, right in stereo) / len(stereo))
        print(f"{name}: {len(stereo) / SAMPLE_RATE:.2f}s; peak {peak:.2f}; RMS {rms:.4f}")
        preview += stereo + [(0.0, 0.0)] * round(SAMPLE_RATE * 0.45)
    if args.preview:
        write_wave(args.preview, preview)


if __name__ == "__main__":
    main()
