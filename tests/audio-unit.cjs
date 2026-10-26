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
  const requests = [];
  const scheduledTimers = [];
  class FakeHowl {
    constructor(options) {
      this.options = options;
      this.handlers = new Map();
      this.stopCount = 0;
      this.playCount = 0;
      this.loadCount = 0;
      this.queuedPlayCount = 0;
      this.queuedStopCount = 0;
      this.loadingState = options.preload === false ? 'unloaded' : 'loaded';
      players.push(this);
    }
    on(name, fn) { this.handlers.set(name, [...this.handlers.get(name) || [], { fn }]); return this; }
    once(name, fn) { this.handlers.set(name, [...this.handlers.get(name) || [], { fn, once: true }]); return this; }
    off(name, fn) { this.handlers.set(name, (this.handlers.get(name) || []).filter(item => item.fn !== fn)); return this; }
    emit(name, ...args) {
      if (name === 'load') this.loadingState = 'loaded';
      if (name === 'loaderror') this.loadingState = 'unloaded';
      for (const item of [...this.handlers.get(name) || []]) {
        if (item.once) this.off(name, item.fn);
        item.fn(...args);
      }
    }
    state() { return this.loadingState; }
    load() { this.loadCount += 1; this.loadingState = 'loading'; return this; }
    play() {
      if (this.loadingState !== 'loaded') { this.queuedPlayCount += 1; return null; }
      this.playCount += 1; return this.playCount;
    }
    stop() {
      if (this.loadingState !== 'loaded') { this.queuedStopCount += 1; return; }
      this.stopCount += 1;
    }
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
    fetch: async url => { requests.push(url); return { ok: true, json: async () => manifest }; },
    setTimeout: (fn, delay) => { scheduledTimers.push(delay); return setTimeout(fn, 1); },
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
  return { ...api, players, spoken, notices, requests, scheduledTimers };
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
  assert.equal(app.players.length, 1, 'only the requested narration player was created');
  assert.equal(app.players.some(player => /fx-.*\.wav$/.test(player.options.src[0])), false);
});

test('saved effects opt-out prevents effect players and remains separate from speech mute', async () => {
  const app = createAudio();
  await app.audio.preload();
  app.audio.unlock();
  app.configureAudio({ muted: false, volume: 1, effects: false });
  for (const name of ['tap', 'correct', 'retry', 'complete', 'notification', 'unknown']) {
    app.audio.playEffect(name);
    app.audio.stopEffect(name);
  }
  app.audio.setMuted(true);
  app.audio.setMuted(false);
  app.audio.setVolume(0.75);
  app.audio.playEffect('tap');
  await tick();
  assert.equal(app.players.length, 0, 'preloading, unlocking and a saved effects opt-out create no effect player');
  assert.equal(app.spoken.length, 0, 'nonverbal feedback does not trigger substitute speech');
  assert.deepEqual(app.requests, ['/harf-adasi/audio/manifest.json'], 'only the speech manifest is fetched');
  assert.deepEqual(app.scheduledTimers, [], 'no deferred effect or notification is scheduled');
});

test('only requested acoustic-v3 cues are created lazily and no old effect URLs are reused', async () => {
  const app = createAudio();
  await app.audio.preload();
  app.audio.unlock();
  assert.equal(app.players.length, 0, 'speech preload and initial user unlock do not preload effects');
  app.configureAudio({ effects: true, muted: false, volume: 1 });
  for (const name of ['tap', 'correct', 'retry', 'complete']) {
    app.audio.playEffect(name);
    const player = app.players.at(-1);
    assert.equal(player.options.src[0], `/harf-adasi/audio/fx-${name}-acoustic-v3.wav`);
    assert.equal(player.options.preload, false);
    assert.ok(player.currentVolume > 0 && player.currentVolume <= 0.25, 'acoustic cues have conservative volume');
    assert.equal(player.loadCount, 1, 'the first request explicitly starts loading the cue');
    assert.equal(player.playCount, 0, 'a loading cue is not queued for unconditional replay');
    assert.equal(player.queuedPlayCount, 0);
    player.emit('load');
    assert.equal(player.playCount, 1);
  }
  assert.equal(app.players.length, 4);
  assert.equal(app.players.some(player => /-v2\.wav$|fx-(tap|correct|retry|complete)\.wav$/.test(player.options.src[0])), false);
});

test('rapid taps and repeated completion calls cannot overlap a running cue', () => {
  const app = createAudio();
  app.audio.playEffect('tap');
  const tap = app.players[0];
  app.audio.playEffect('tap');
  assert.equal(tap.loadCount, 1);
  tap.emit('load');
  assert.equal(tap.playCount, 1);
  app.audio.playEffect('complete');
  const complete = app.players[1];
  app.audio.playEffect('complete');
  app.audio.playEffect('complete');
  assert.equal(complete.loadCount, 1, 'repeated requests share the pending load');
  assert.equal(complete.playCount, 0);
  complete.emit('load');
  assert.equal(complete.playCount, 1, 'completion is not restarted or stacked while playing');
  complete.emit('end');
  app.audio.playEffect('complete');
  assert.equal(complete.playCount, 2, 'a later completed task can play its cue after the first ended');
});

test('mute and disabling effects stop active cues without allowing queued replays', () => {
  const app = createAudio();
  app.audio.playEffect('correct');
  const correct = app.players[0];
  correct.emit('load');
  app.audio.setMuted(true);
  assert.equal(correct.stopCount, 1);
  app.audio.playEffect('complete');
  assert.equal(app.players.length, 1);
  app.audio.setMuted(false);
  app.audio.setEffectsEnabled(false);
  app.audio.playEffect('correct');
  assert.equal(correct.playCount, 1);
  app.audio.setEffectsEnabled(true);
  app.audio.playEffect('correct');
  assert.equal(correct.playCount, 2);
});

test('acoustic feedback ducks during recorded speech and restores afterwards', async () => {
  const app = createAudio({ manifest: { nine: 'nine.mp3' } });
  app.audio.playEffect('correct');
  const effect = app.players[0];
  effect.emit('load');
  const level = effect.currentVolume;
  const finished = app.audio.speak('nine');
  await tick();
  const clip = app.players.find(player => player.options.src[0].endsWith('nine.mp3'));
  assert.ok(effect.currentVolume < level, 'instruction voice has priority over feedback');
  clip.emit('end');
  assert.equal(await finished, true);
  assert.equal(effect.currentVolume, level);
});

test('a cue finishing its first load after mute or opt-out cannot replay later', () => {
  for (const cancel of [app => app.audio.setMuted(true), app => app.audio.setEffectsEnabled(false), app => app.audio.stopEffect('complete')]) {
    const app = createAudio();
    app.audio.playEffect('complete');
    const effect = app.players[0];
    assert.equal(effect.state(), 'loading');
    cancel(app);
    effect.emit('load');
    assert.equal(effect.playCount, 0, 'late load respects canceled playback intent');
    assert.equal(effect.queuedPlayCount, 0, 'no Howler play operation bypasses the late-load guard');
    assert.equal(effect.queuedStopCount, 0, 'canceling a load does not create a deferred Howler stop');
    app.audio.setMuted(false);
    app.audio.setEffectsEnabled(true);
    assert.equal(effect.playCount, 0, 'reenabling audio alone does not revive an old request');
    app.audio.playEffect('complete');
    assert.equal(effect.playCount, 1, 'a new user request may play the now-loaded cue');
    assert.equal(effect.loadCount, 1);
  }
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
