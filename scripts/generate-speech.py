#!/usr/bin/env python3
"""Build Harf Adası's static Turkish voice pack and original gentle effects.

Install scripts/requirements-audio.txt, then run this script at development time.
The published game plays local assets and has no speech-service dependency.
TLS verification stays enabled; the environment CA bundle is respected.
"""

from __future__ import annotations

import argparse
import ast
import asyncio
import hashlib
import json
import math
import os
from pathlib import Path
import re
import ssl
import struct
import sys
import unicodedata
import wave


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_VOICE = "tr-TR-EmelNeural"
LETTER_NAMES = {
    "a": "a", "b": "be", "c": "ce", "ç": "çe", "d": "de", "e": "e",
    "f": "fe", "g": "ge", "ğ": "yumuşak ge", "h": "he", "ı": "ı",
    "i": "i", "j": "je", "k": "ke", "l": "le", "m": "me", "n": "ne",
    "o": "o", "ö": "ö", "p": "pe", "r": "re", "s": "se", "ş": "şe",
    "t": "te", "u": "u", "ü": "ü", "v": "ve", "y": "ye", "z": "ze",
}
PROMPTS = [
    "Merhaba! Birlikte oynayalım.",
    "Merhaba! Harf Adası'na hoş geldin.",
    "Alparslan ile adım adım öğrenelim.",
    "Yukarıdaki işaretin aynısını bul.",
    "Sarı noktadan başla, çizginin izini sür.",
    "Elmaları say. Kaç tane var?",
    "Kaç tane elma var?",
    "Hazır olduğunda başlayabilirsin.",
    "Şimdi sıra sende.",
    "Aşağıya yaz. Bitirince birlikte kontrol edin.",
    "Kartlara sırayla dokun, boşlukları doldur.",
    "Bu kelime hangi resmi anlatıyor?",
    "Sarı noktayı izle. Sonra sen deneyebilirsin.",
    "Sarı noktadan başlayalım.",
    "Sarı noktadan başlayıp çizginin izini yeniden deneyelim.",
    "Bir daha bakalım. Yukarıdaki işarete dikkat et.",
    "Bir daha deneyelim. Acelemiz yok.",
    "Bir daha deneyelim.",
    "Güzel, şimdi sıradaki parçayı seç.",
    "Aynısını buldun! Hazırsan devam edebilirsin.",
    "Çizgiyi tamamladın! Hazır olunca devam et.",
    "Kelime ve resim eşleşti!",
    "Saydın ve buldun!",
    "Birlikte kontrol ettiniz. Hazırsan devam edebilirsin.",
    "Bitirdiğinde Yazdım, birlikte bakalım düğmesine dokun.",
    "Harika! Doğru cevap.",
    "Harika, doğru cevap!",
    "Harika! Başardın.",
    "Aferin! Çok güzel çalıştın.",
    "Tebrikler!",
    "Tebrikler, başardın!",
    "Tebrikler, başardın! Adım adım öğrendin.",
    "Emek verdin, tamamladın!",
    "Çıkartman seni bekliyor.",
    "Yeni bir çıkartma kazandın!",
    "Küçük bir mola verelim.",
    "Ellerini dinlendir. Hazır olunca devam edelim.",
    "Adım adım, birlikte.",
    "Hazırsan devam edebilirsin.",
    "Birlikte kontrol edelim.",
]

# Edge's Turkish standard voices do not expose an expressive/cheerful style.
# Use short conversational wording and separate narration pacing, rather than
# applying faster delivery to letters, syllables and words being learned.
# Values are (spoken wording, synthesis rate); no browser pitch manipulation.
WARM_PROMPTS = {
    "Merhaba! Birlikte oynayalım.": ("Merhaba! Hadi, birlikte oynayalım!", "+4%"),
    "Merhaba! Harf Adası'na hoş geldin.": ("Merhaba! Harf Adası'na hoş geldin! Hadi, birlikte oynayalım.", "+4%"),
    "Alparslan ile adım adım öğrenelim.": ("Hadi! Alparslan ile adım adım öğrenelim.", "+3%"),
    "Yukarıdaki işaretin aynısını bul.": ("Bir bakalım. Aynısı hangisi?", "+0%"),
    "Sarı noktadan başla, çizginin izini sür.": ("Sarı noktadan başla. Şimdi, çizginin izinden gidelim.", "-1%"),
    "Elmaları say. Kaç tane var?": ("Hadi, elmaları sayalım! Kaç tane var?", "+2%"),
    "Kaç tane elma var?": ("Birlikte bakalım. Kaç tane elma var?", "+0%"),
    "Hazır olduğunda başlayabilirsin.": ("Hazır olduğunda, birlikte başlayalım!", "+2%"),
    "Şimdi sıra sende.": ("Şimdi, sıra sende! Hadi deneyelim.", "+3%"),
    "Aşağıya yaz. Bitirince birlikte kontrol edin.": ("Şimdi sen yaz. Bitirince, birlikte bakalım.", "+0%"),
    "Kartlara sırayla dokun, boşlukları doldur.": ("Hadi, kartları birleştirelim! Sırayla dokun, boşlukları doldur.", "+2%"),
    "Bu kelime hangi resmi anlatıyor?": ("Bir bakalım! Bu kelime hangi resmi anlatıyor?", "+1%"),
    "Sarı noktayı izle. Sonra sen deneyebilirsin.": ("Önce sarı noktayı izle. Sonra, sıra sende!", "-1%"),
    "Sarı noktadan başlayalım.": ("Sarı noktayı bulalım. Buradan başlayalım.", "-1%"),
    "Sarı noktadan başlayıp çizginin izini yeniden deneyelim.": ("Bir daha deneyelim. Sarı noktadan başlayıp çizginin izinden gidelim.", "-1%"),
    "Bir daha bakalım. Yukarıdaki işarete dikkat et.": ("Bir daha bakalım. Acelemiz yok. Aynısı hangisi?", "-1%"),
    "Bir daha deneyelim. Acelemiz yok.": ("Olur böyle! Bir daha deneyelim. Acelemiz yok.", "-1%"),
    "Bir daha deneyelim.": ("Hadi, bir daha deneyelim.", "+0%"),
    "Güzel, şimdi sıradaki parçayı seç.": ("Güzel! Şimdi sıradaki parçayı seç.", "+2%"),
    "Aynısını buldun! Hazırsan devam edebilirsin.": ("Buldun! Harika! Hazırsan, devam edelim.", "+5%"),
    "Çizgiyi tamamladın! Hazır olunca devam et.": ("Çizgiyi tamamladın! Çok güzel! Hazırsan, devam edelim.", "+5%"),
    "Kelime ve resim eşleşti!": ("Buldun! Kelimeyle resim eşleşti!", "+5%"),
    "Saydın ve buldun!": ("Saydın, buldun! Harika!", "+5%"),
    "Birlikte kontrol ettiniz. Hazırsan devam edebilirsin.": ("Birlikte kontrol ettiniz! Hazırsan, devam edelim.", "+3%"),
    "Bitirdiğinde Yazdım, birlikte bakalım düğmesine dokun.": ("Bitirdiğinde, Yazdım, birlikte bakalım düğmesine dokun.", "+0%"),
    "Harika! Doğru cevap.": ("Harika! Doğru cevabı buldun!", "+6%"),
    "Harika, doğru cevap!": ("Harika! Doğru cevabı buldun!", "+6%"),
    "Harika! Başardın.": ("Harika! Başardın!", "+6%"),
    "Aferin! Çok güzel çalıştın.": ("Aferin! Çok güzel çalıştın!", "+6%"),
    "Tebrikler!": ("Tebrikler! Harika gidiyorsun!", "+6%"),
    "Tebrikler, başardın!": ("Tebrikler! Başardın!", "+6%"),
    "Tebrikler, başardın! Adım adım öğrendin.": ("Tebrikler! Birlikte başardık! Adım adım ilerliyorsun.", "+6%"),
    "Emek verdin, tamamladın!": ("Emek verdin, tamamladın! Harika!", "+6%"),
    "Çıkartman seni bekliyor.": ("Çıkartman seni bekliyor! Hadi bakalım!", "+5%"),
    "Yeni bir çıkartma kazandın!": ("Yeni bir çıkartma kazandın! Harika!", "+6%"),
    "Küçük bir mola verelim.": ("Biraz dinlenelim mi? Küçük bir mola verelim.", "-2%"),
    "Ellerini dinlendir. Hazır olunca devam edelim.": ("Ellerini dinlendir. Hazır olduğunda, yine birlikte oynarız.", "-2%"),
    "Adım adım, birlikte.": ("Adım adım. Birlikte!", "+2%"),
    "Hazırsan devam edebilirsin.": ("Hazırsan, birlikte devam edelim!", "+3%"),
    "Birlikte kontrol edelim.": ("Hadi, birlikte bakalım!", "+2%"),
}


def normalize_text(value: str) -> str:
    """Match src/audio.js normalizeSpeechText, including dotted/dotless I."""
    value = unicodedata.normalize("NFC", str(value))
    value = value.translate(str.maketrans({"I": "ı", "İ": "i"})).lower()
    value = re.sub(r'[“”„"‘’]', "", value)
    return re.sub(r"\s+", " ", value).strip()


def number_name(number: int) -> str:
    ones = ["sıfır", "bir", "iki", "üç", "dört", "beş", "altı", "yedi", "sekiz", "dokuz"]
    tens = ["", "on", "yirmi", "otuz", "kırk", "elli", "altmış", "yetmiş", "seksen", "doksan"]
    if number == 100:
        return "yüz"
    if number < 10:
        return ones[number]
    return tens[number // 10] + (" " + ones[number % 10] if number % 10 else "")


def extract_content(source: Path) -> dict[str, list[str]]:
    text = source.read_text(encoding="utf-8")

    def required(pattern: str, label: str) -> str:
        found = re.search(pattern, text, re.S)
        if not found:
            raise ValueError(f"Cannot extract {label} from {source}; update the content parser.")
        return found.group(1)

    alphabet = required(r"const\s+A\s*=\s*'([^']+)'\.split", "alphabet").split()
    syllables = required(r"const\s+syllables\s*=\s*'([^']+)'\.split", "syllables").split()
    word_rows = required(r"const\s+words\s*=\s*`([^`]+)`\.split", "words").split(";")
    words = [row.split("|")[0] for row in word_rows]
    sentences = ast.literal_eval(required(r"const\s+sentences\s*=\s*(\[[^\n]+?\]);", "sentences"))
    if len(alphabet) != 29 or not {"nine", "anne", "etti", "inat"}.issubset(words):
        raise ValueError("Unexpected content: 29 Turkish letters and the core practice words are required.")
    adventures = source.with_name("adventures.js")
    stories = []
    if adventures.is_file():
        # Preserve each exact JS string as the runtime key of Hikâyeyi dinle.
        story_source = adventures.read_text(encoding="utf-8")
        stories = [ast.literal_eval(match.group(1)) for match in
                   re.finditer(r"\bstory:\s*('(?:\\.|[^'\\])*')", story_source)]
    return {"alphabet": alphabet, "syllables": syllables, "words": words,
            "sentences": sentences, "stories": stories}


def build_phrases(content: dict[str, list[str]]) -> dict[str, str]:
    """Map runtime speech keys to the Turkish wording to record."""
    phrases: dict[str, str] = {}

    def add(key: str, spoken: str | None = None) -> None:
        normalized = normalize_text(key)
        if normalized:
            phrases[normalized] = spoken if spoken is not None else key

    for letter in content["alphabet"]:
        name = LETTER_NAMES[letter]
        add(letter, name)
        # Both forms reach the same Turkish recording after runtime normalization.
        add(f"{letter} harfi", f"{name} harfi")
        add(f"{letter} harfini bul.", f"{name} harfini bul.")
        add(f"{name} harfini bul.")
    for category in ("syllables", "words", "sentences", "stories"):
        for phrase in content.get(category, []):
            add(phrase)
    for number in range(101):
        name = number_name(number)
        add(name)
        add(str(number), name)
    for phrase in PROMPTS:
        add(phrase)
    return phrases


def _synth_effect(path: Path, notes: list[tuple[float, float, float, float]], duration: float) -> None:
    """Original soft bell tones with smooth envelopes; no harsh failure buzzer."""
    sample_rate = 44100
    frames = []
    for index in range(round(duration * sample_rate)):
        time = index / sample_rate
        value = 0.0
        for start, frequency, length, level in notes:
            elapsed = time - start
            if not 0 <= elapsed < length:
                continue
            attack = min(1.0, elapsed / 0.008)
            release = min(1.0, (length - elapsed) / 0.065)
            envelope = attack * release * math.exp(-elapsed / (length * 0.32))
            tone = (math.sin(math.tau * frequency * elapsed)
                    + 0.18 * math.sin(math.tau * frequency * 2 * elapsed)
                    + 0.04 * math.sin(math.tau * frequency * 3 * elapsed)) / 1.22
            value += level * envelope * tone
        frames.append(value)
    peak = max((abs(value) for value in frames), default=1.0)
    scale = min(1.0, 0.65 / peak) if peak else 1.0
    pcm = b"".join(struct.pack("<h", round(max(-1.0, min(1.0, value * scale)) * 32767)) for value in frames)
    with wave.open(str(path), "wb") as output:
        output.setnchannels(1)
        output.setsampwidth(2)
        output.setframerate(sample_rate)
        output.writeframes(pcm)


def generate_effects(output: Path) -> None:
    output.mkdir(parents=True, exist_ok=True)
    definitions = {
        "tap": ([(0, 740, 0.105, 0.28)], 0.12),
        "correct": ([(0, 523.25, 0.28, 0.34), (0.11, 659.25, 0.30, 0.34), (0.22, 783.99, 0.40, 0.34)], 0.66),
        "retry": ([(0, 440, 0.22, 0.20), (0.12, 392, 0.28, 0.15)], 0.44),
        "complete": ([(0, 523.25, 0.40, 0.30), (0.13, 659.25, 0.42, 0.30),
                      (0.26, 783.99, 0.44, 0.30), (0.40, 1046.50, 0.65, 0.30),
                      (0.58, 523.25, 0.65, 0.10), (0.58, 659.25, 0.65, 0.10),
                      (0.58, 783.99, 0.65, 0.10)], 1.28),
    }
    for name, (notes, duration) in definitions.items():
        _synth_effect(output / f"fx-{name}.wav", notes, duration)


def valid_clip(path: Path) -> bool:
    if not path.is_file() or path.stat().st_size < 1024:
        return False
    with path.open("rb") as clip:
        header = clip.read(3)
    return header.startswith(b"ID3") or (len(header) >= 2 and header[0] == 0xFF and header[1] & 0xE0 == 0xE0)


async def generate_voice(args: argparse.Namespace, phrases: dict[str, str], counts: dict[str, int],
                         narration_keys: set[str] | None = None) -> None:
    try:
        import edge_tts
        import edge_tts.communicate
    except ImportError as error:
        raise SystemExit("Install scripts/requirements-audio.txt before generating speech.") from error

    # Use the supplied environment CA with verification intact. The Edge client
    # otherwise creates a certifi-only context that misses managed proxy roots.
    ca_file = os.environ.get("SSL_CERT_FILE")
    edge_tts.communicate._SSL_CTX = ssl.create_default_context(cafile=ca_file)
    proxy = os.environ.get("HTTPS_PROXY") or os.environ.get("HTTP_PROXY")
    output = args.output
    output.mkdir(parents=True, exist_ok=True)
    recordings: dict[str, tuple[str, str]] = {}
    manifest_phrases: dict[str, str] = {}
    overrides = {normalize_text(key): value for key, value in WARM_PROMPTS.items()} if args.profile == "warm-prompts" else {}
    if args.profile == "warm-prompts":
        overrides.update({key: (phrases[key], "+1%") for key in narration_keys or set()})
    deliveries: dict[str, dict[str, str]] = {}
    for key, spoken in phrases.items():
        spoken, rate = overrides.get(key, (spoken, args.rate))
        # Keep the original hash format. Untouched learning targets therefore
        # retain their exact existing file references; new delivery gets new files.
        digest = hashlib.sha256(f"{args.voice}\n{rate}\n{spoken}".encode()).hexdigest()[:20]
        filename = f"voice-{digest}.mp3"
        manifest_phrases[key] = filename
        recordings[filename] = (spoken, rate)
        if key in overrides:
            deliveries[key] = {"voice": args.voice, "rate": rate, "spoken": spoken}

    cached = sum(valid_clip(output / filename) for filename in recordings)
    done = 0
    failed: list[str] = []
    semaphore = asyncio.Semaphore(args.concurrency)
    print(f"Voice: {args.voice}; {len(phrases)} phrase keys, {len(recordings)} recordings, {cached} cached.", flush=True)

    async def record(filename: str, text: str, rate: str) -> None:
        nonlocal done
        target = output / filename
        async with semaphore:
            if not valid_clip(target):
                temporary = target.with_suffix(".part.mp3")
                for attempt in range(1, 4):
                    try:
                        communicate = edge_tts.Communicate(text, args.voice, rate=rate, proxy=proxy,
                                                          connect_timeout=15, receive_timeout=35)
                        await asyncio.wait_for(communicate.save(str(temporary)), timeout=70)
                        if not valid_clip(temporary):
                            raise ValueError("Empty or invalid speech recording")
                        temporary.replace(target)
                        break
                    except Exception as error:
                        temporary.unlink(missing_ok=True)
                        if attempt == 3:
                            failed.append(filename)
                            # Do not print service URLs or runtime auth headers.
                            print(f"FAILED {text[:60]!r}: {type(error).__name__}", flush=True)
                        else:
                            await asyncio.sleep(attempt)
            done += 1
            if done % 20 == 0 or done == len(recordings):
                print(f"Speech progress: {done}/{len(recordings)}; failures: {len(failed)}", flush=True)

    await asyncio.gather(*(record(filename, text, rate) for filename, (text, rate) in recordings.items()))
    if failed:
        raise SystemExit(f"{len(failed)} recordings failed. The manifest was not replaced; rerun to resume cached work.")
    manifest = {"voice": args.voice, "locale": "tr-TR", "rate": args.rate,
                "delivery_profile": args.profile,
                "delivery_overrides": dict(sorted(deliveries.items())),
                "counts": counts, "phrases": dict(sorted(manifest_phrases.items()))}
    temporary_manifest = output / "manifest.json.tmp"
    temporary_manifest.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temporary_manifest.replace(output / "manifest.json")
    print(f"Complete: {len(manifest_phrases)} phrases and 4 original effects in {output}", flush=True)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=ROOT / "src" / "game.js")
    parser.add_argument("--output", type=Path, default=ROOT / "public" / "audio")
    parser.add_argument("--voice", default=DEFAULT_VOICE, choices=["tr-TR-EmelNeural", "tr-TR-AhmetNeural"])
    parser.add_argument("--rate", default="-5%")
    parser.add_argument("--profile", choices=["warm-prompts", "original"], default="warm-prompts",
                        help="Warm conversational prompts; learning targets keep --voice and --rate")
    parser.add_argument("--concurrency", type=int, default=3, choices=range(1, 7))
    parser.add_argument("--dry-run", action="store_true", help="Report parsed coverage without network or writes")
    parser.add_argument("--fx-only", action="store_true", help="Create the four effects without network")
    args = parser.parse_args()
    if args.fx_only:
        generate_effects(args.output)
        print(f"Created 4 original WAV effects in {args.output}")
        return
    content = extract_content(args.source)
    phrases = build_phrases(content)
    counts = {category: len(items) for category, items in content.items()}
    if args.dry_run:
        overrides = {normalize_text(key): value for key, value in WARM_PROMPTS.items()} if args.profile == "warm-prompts" else {}
        if args.profile == "warm-prompts":
            overrides.update({normalize_text(story): (story, "+1%") for story in content["stories"]})
        recordings = {overrides.get(key, (spoken, args.rate)) for key, spoken in phrases.items()}
        print(json.dumps({"voice": args.voice, "delivery_profile": args.profile,
                          "warm_prompt_keys": len(WARM_PROMPTS) if args.profile == "warm-prompts" else 0,
                          "counts": counts, "phrase_keys": len(phrases),
                          "unique_recordings": len(recordings),
                          "nine_recording_text": phrases["nine"], "uppercase_I_key": normalize_text("I"),
                          "uppercase_dotted_I_key": normalize_text("İ")}, ensure_ascii=False, indent=2))
        return
    generate_effects(args.output)
    asyncio.run(generate_voice(args, phrases, counts, {normalize_text(story) for story in content["stories"]}))


if __name__ == "__main__":
    main()
