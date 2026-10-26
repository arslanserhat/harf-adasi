const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Isolate browser/audio APIs without network or an actual audio output device.
// Only the bundler import and BASE_URL expression are replaced; the production
// module's voice selection, playback, cancellation and fallback run unchanged.
function createAudio({ manifest = {}, voices = [] } = {}) {
  const players = [];
  const spoken = [];
  const notices = [];
  class FakeHowl {
    constructor(options) {
      this.options = options;
      this.handlers = new Map();
      this.stopCount = 0;
      this.playCount = 0;
      players.push(this);
    }
    on(name, fn) { this.handlers.set(name, [...this.handlers.get(name) || [], { fn }]); return this; }
    once(name, fn) { this.handlers.set(name, [...this.handlers.get(name) || [], { fn, once: true }]); return this; }
    off(name, fn) { this.handlers.set(name, (this.handlers.get(name) || []).filter(item => item.fn !== fn)); return this; }
    emit(name, ...args) {
      for (const item of [...this.handlers.get(name) || []]) {
        if (item.once) this.off(name, item.fn);
        item.fn(...args);
      }
    }
    state() { return 'loaded'; }
    play() { this.playCount += 1; return this.playCount; }
    stop() { this.stopCount += 1; }
    volume(value) { this.currentVolume = value; }
    unload() { this.unloaded = true; }
  }
  const engine = {
    getVoices: () => voices,
    cancel() {},
    addEventListener() {},
    removeEventListener() {},
    speak(utterance) { spoken.push(utterance); queueMicrotask(() => utterance.onend?.()); },
  };
  const context = vm.createContext({
    Howl: FakeHowl,
    Howler: { ctx: { state: 'running' } },
    window: { speechSynthesis: engine, SpeechSynthesisUtterance: class { constructor(text) { this.text = text; } } },
    fetch: async () => ({ ok: true, json: async () => manifest }),
    setTimeout: fn => setTimeout(fn, 1),
    clearTimeout,
    queueMicrotask,
  });
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'audio.js'), 'utf8')
    .replace("import { Howl, Howler } from 'howler';", '')
    .replace('import.meta.env?.BASE_URL', "'/harf-adasi/'")
    .replace(/^export /gm, '');
  vm.runInContext(`${source}\nthis.exports = { audio, configureAudio, normalizeSpeechText };`, context);
  const api = context.exports;
  api.configureAudio({ onStatus: message => notices.push(message) });
  return { ...api, players, spoken, notices };
}

const tick = () => new Promise(resolve => setImmediate(resolve));

test('manifest keys preserve Turkish dotted/dotless distinctions', () => {
  const { normalizeSpeechText } = createAudio();
  assert.equal(normalizeSpeechText('  “NİNE”  '), 'nine');
  assert.equal(normalizeSpeechText('IŞIK'), 'ışık');
  assert.equal(normalizeSpeechText('İnan  inat etti.'), 'inan inat etti.');
});

test('recorded Turkish nine takes priority over an English system voice', async () => {
  const app = createAudio({ manifest: { phrases: { nine: 'nine.mp3' } }, voices: [{ lang: 'en-US', name: 'English' }] });
  const finished = app.audio.speak('nine');
  await tick();
  const clip = app.players.find(player => player.options.src[0].endsWith('nine.mp3'));
  assert.ok(clip);
  assert.equal(clip.options.src[0], '/harf-adasi/audio/nine.mp3');
  assert.equal(clip.options.html5, true);
  assert.equal(app.spoken.length, 0);
  clip.emit('end');
  assert.equal(await finished, true);
});

test('English-only speech is never used as a fallback', async () => {
  const app = createAudio({ voices: [{ lang: 'en-GB', name: 'English' }] });
  assert.equal(await app.audio.speak('nine'), false);
  assert.equal(app.spoken.length, 0);
  assert.ok(app.notices.some(message => message.includes('Türkçe ses bulunamadı')));
});

test('native fallback explicitly selects a real Turkish voice', async () => {
  const turkish = { lang: 'tr-TR', name: 'Yelda', localService: true };
  const app = createAudio({ voices: [{ lang: 'en-US', name: 'English' }, turkish] });
  assert.equal(await app.audio.speak('nine'), true);
  assert.equal(app.spoken.length, 1);
  assert.equal(app.spoken[0].voice, turkish);
  assert.equal(app.spoken[0].lang, 'tr-TR');
  assert.equal(app.spoken[0].rate, 0.9);
});

test('replacing speech stops the old clip and resolves its pending request', async () => {
  const app = createAudio({ manifest: { nine: 'nine.mp3', anne: 'anne.mp3' } });
  const first = app.audio.speak('nine');
  await tick();
  const nine = app.players.find(player => player.options.src[0].endsWith('nine.mp3'));
  const second = app.audio.speak('anne');
  assert.equal(await first, false);
  assert.equal(nine.stopCount, 1);
  await tick();
  const anne = app.players.find(player => player.options.src[0].endsWith('anne.mp3'));
  anne.emit('end');
  assert.equal(await second, true);
});

test('missing recording falls back to Turkish and waits for that speech', async () => {
  const app = createAudio({ manifest: { nine: 'missing.mp3' }, voices: [{ lang: 'tr-TR', name: 'Yelda' }] });
  const finished = app.audio.speak('nine');
  await tick();
  const clip = app.players.find(player => player.options.src[0].endsWith('missing.mp3'));
  clip.emit('loaderror');
  assert.equal(await finished, true);
  assert.equal(app.spoken.length, 1);
});

test('mute stops narration and prevents both speech and sound effects', async () => {
  const app = createAudio({ manifest: { nine: 'nine.mp3' } });
  const finished = app.audio.speak('nine');
  await tick();
  const clip = app.players.find(player => player.options.src[0].endsWith('nine.mp3'));
  app.audio.setMuted(true);
  assert.equal(await finished, false);
  assert.equal(clip.stopCount, 1);
  assert.equal(await app.audio.speak('nine'), false);
  app.audio.playEffect('correct');
  assert.equal(app.players.filter(player => player.options.src[0].endsWith('fx-correct-v2.wav'))[0].playCount, 0);
});

test('a final stop on a single Turkish word uses its existing recording before device speech', async () => {
  const app = createAudio({ manifest: { phrases: { al: 'al.mp3' } }, voices: [{ lang: 'tr-TR', name: 'Device Turkish' }] });
  const finished = app.audio.speak('al.');
  await tick();
  const clip = app.players.find(player => player.options.src[0].endsWith('al.mp3'));
  assert.ok(clip, 'a punctuation mark does not send a recorded learning word to the device voice');
  assert.equal(app.spoken.length, 0);
  clip.emit('end');
  assert.equal(await finished, true);
});

test('exact punctuation and sentence recordings take precedence; number dots are not word aliases', async () => {
  const app = createAudio({ manifest: { phrases: { al: 'word.mp3', 'al.': 'exact.mp3', 'anne nane al.': 'sentence.mp3', '1': 'one.mp3' } } });
  for (const [text, file] of [['al.', 'exact.mp3'], ['Anne nane al.', 'sentence.mp3']]) {
    const finished = app.audio.speak(text); await tick();
    const clip = app.players.find(player => player.options.src[0].endsWith(file));
    assert.ok(clip); clip.emit('end'); assert.equal(await finished, true);
  }
  assert.equal(await app.audio.speak('1.'), false, 'ordinal punctuation cannot silently become a cardinal number recording');
  assert.equal(app.players.some(player => player.options.src[0].endsWith('one.mp3')), false);
});
