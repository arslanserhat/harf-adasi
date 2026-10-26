# Original illustrated animals and acoustic cues

## Current selection: Pixabay effects and six adventure scenes

The user explicitly rejected the v3 piano cues. They are retired; do not restore
them as the active notification set. Runtime uses `fx-*-pixabay-v4.mp3`:
miraclei's `sample_confirm_success03` (360151) for correct answers,
Universfield's `Level Complete` (143022) for completion and `Soft UI Click`
(147352) for tap/quiet retry. The supplied MP3s are unchanged. Their licence is
the Pixabay Content License, not CC0 or the application's code licence.
Attribution/source hashes ship in `public/audio/LICENSE-pixabay-v4.txt` and
`public/audio/pixabay-v4.sources.json`. The app is not a standalone sound pack.

The six `public/art/quest-*.webp` backgrounds are original game scenery generated
for this project on 26 October 2026. Active objects/actors and task progress are
rendered separately; the background image does not determine an answer.

## Earlier assets

The five `public/art/pet-*.webp` images were generated for Harf Adası on
26 October 2026. Each is a transparent 2×2 pose atlas. The existing original
`pirpir-flight.webp` supplies the bird. Characters animate in reserved interface
space outside the home island and adventure illustrations. Motion pause,
reduced motion, and the writing guard apply to their frames and movement.

The v3 notification WAVs adapt actual Salamander Grand Piano recordings by
Alexander Holm, licensed CC BY 3.0. The collection's original `README` (without
an extension) explicitly identifies this licence and author:
https://github.com/Tonejs/audio/blob/master/salamander/README

Attribution and adaptation details ship in
`public/audio/LICENSE-acoustic-effects-v3.txt`; exact source hashes are in
`public/audio/acoustic-effects-v3.sources.json`. To reproduce, download the three
credited MP3s to a temporary directory as `salamander-C4.mp3`,
`salamander-A4.mp3`, `salamander-C5.mp3`, then run:

```sh
python scripts/build-acoustic-effects.py --source-dir /path/to/downloads
```

The previous procedural v2 cues are retained as historical files but no longer
referenced by playback. New cues load lazily and cannot bypass mute or the
separate effect setting. Spoken Turkish remains the existing recorded Emel
narrator and Turkish-only native fallback. This work does not replace the
narrator with ChatGPT Voice or a human actor. Automated duration/clipping and
playback checks are not evidence of human listening or physical iPhone playback.
