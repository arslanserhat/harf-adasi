#!/usr/bin/env node
// Read-only inventory: never reads child/browser data or contacts a TTS service.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const load = async file => {
  const source = readFileSync(resolve(root, file), 'utf8').replace(/^import '\.\/story-scene\.css';\s*/u, '');
  return import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
};
const normalize = text => text.normalize('NFC').toLocaleLowerCase('tr-TR')
  .replace(/[“”„"‘’]/g, '').replace(/\s+/g, ' ').trim();
const [story, model] = await Promise.all([load('src/story-scene.js'), load('src/learning-model.js')]);
const manifest = JSON.parse(readFileSync(resolve(root, 'public/audio/manifest.json'), 'utf8'));
const required = new Map();
for (const text of story.NARRATION_PHRASES) required.set(normalize(text), { text, category: 'story' });
for (const word of model.createLearningState(0).lists[0].words) {
  required.set(normalize(word.text), { text: word.text, category: 'starter-word' });
  if (word.sentence) required.set(normalize(word.sentence), { text: word.sentence, category: 'starter-sentence' });
}
const entries = [...required].map(([key, entry]) => ({
  key, ...entry, file: manifest.phrases[key] || null,
  status: manifest.phrases[key] ? 'recorded' : 'turkish-device-voice-or-adult-support',
}));
process.stdout.write(JSON.stringify({
  schema: 1, locale: 'tr-TR', current_voice: manifest.voice,
  current_phrase_keys: Object.keys(manifest.phrases).length,
  current_unique_recordings: new Set(Object.values(manifest.phrases)).size,
  required_scripted_entries: entries.length,
  required_without_recording: entries.filter(entry => !entry.file).length,
  entries,
  dynamic_content: [
    'Teacher-entered words and sentences are not included in this repository inventory.',
    'Unrecorded text uses a real Turkish device voice; listening success requires audio or explicitly recorded adult support.',
  ],
}, null, 2) + '\n');
