import { Howl, Howler } from 'howler';

// Recorded Turkish is the primary voice. Native speech is used only when the
// device actually supplies a Turkish voice; lang='tr-TR' alone is insufficient.
const BASE = typeof document !== 'undefined' && document.querySelector('meta[name="harf-backend"]')?.content === 'laravel' ? '/' : (import.meta.env?.BASE_URL || '/');
const AUDIO_BASE = `${BASE.endsWith('/') ? BASE : `${BASE}/`}audio/`;
const EFFECT_LEVELS = { tap: 0.2, correct: 0.42, retry: 0.2, complete: 0.42 };
// Keep the live HTML5 clip cache within Safari's unlocked audio pool.
const MAX_CACHED_PHRASES = 8;
const effects = new Map();
const clips = new Map();
let phrases = Object.create(null);
let manifestPromise;
let manifestAvailable = false;
let muted = false;
let volume = 0.85;
let speechSequence = 0;
let currentClip = null;
let currentUtterance = null;
let finishCurrent = null;
let lastTap = 0;
let voiceMode = 'loading';
let nativeVoiceName = '';
let onStatus = () => {};
let nativeNoticeShown = false;

Howler.autoUnlock = true;

export function normalizeSpeechText(value) {
  return String(value ?? '')
    .normalize('NFC')
    .toLocaleLowerCase('tr-TR')
    .replace(/[“”„"‘’]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function status(message) {
  try { onStatus(message); } catch { /* Audio must not interrupt a lesson. */ }
}

function speechEngine() {
  return typeof window === 'undefined' ? null : window.speechSynthesis;
}

function selectTurkishVoice() {
  try {
    return (speechEngine()?.getVoices() || [])
      .filter(voice => /^tr(?:[-_]|$)/i.test(voice.lang || ''))
      .sort((a, b) => {
        const rank = voice => (voice.localService ? 2 : 0)
          + (/emel|yelda|filiz|tolga/i.test(voice.name || '') ? 1 : 0);
        return rank(b) - rank(a);
      })[0] || null;
  } catch { return null; }
}

async function waitForTurkishVoice() {
  const available = selectTurkishVoice();
  const engine = speechEngine();
  if (available || !engine) return available;
  // iOS often fills getVoices() after the first user interaction.
  return new Promise(resolve => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      engine.removeEventListener?.('voiceschanged', changed);
      resolve(selectTurkishVoice());
    };
    const changed = () => { if (selectTurkishVoice()) finish(); };
    const timer = setTimeout(finish, 900);
    engine.addEventListener?.('voiceschanged', changed);
  });
}

function ensureEffects() {
  if (typeof window === 'undefined') return;
  for (const name of Object.keys(EFFECT_LEVELS)) {
    if (!effects.has(name)) {
      effects.set(name, new Howl({
        src: [`${AUDIO_BASE}fx-${name}.wav`],
        preload: true,
        volume: volume * EFFECT_LEVELS[name],
      }));
    }
  }
}

function loadManifest() {
  if (!manifestPromise) {
    manifestPromise = fetch(`${AUDIO_BASE}manifest.json`, { cache: 'no-cache' })
      .then(response => {
        if (!response.ok) throw new Error('Voice manifest unavailable');
        return response.json();
      })
      .then(data => {
        const source = data.phrases || data;
        for (const [text, entry] of Object.entries(source)) {
          const file = typeof entry === 'string' ? entry : entry?.file || entry?.src;
          if (typeof file === 'string' && file && !/^(?:[a-z]+:|\/\/)|\.\./i.test(file)) {
            phrases[normalizeSpeechText(text)] = file.replace(/^\/?audio\//, '');
          }
        }
        manifestAvailable = true;
        voiceMode = Object.keys(phrases).length ? 'recorded' : 'unavailable';
        return phrases;
      })
      .catch(() => {
        voiceMode = selectTurkishVoice() ? 'native-turkish' : 'unavailable';
        return phrases;
      });
  }
  return manifestPromise;
}

function pruneClips() {
  for (const [key, clip] of clips) {
    if (clips.size <= MAX_CACHED_PHRASES) break;
    if (clip !== currentClip) {
      clip.unload();
      clips.delete(key);
    }
  }
}

function stopSpeech() {
  speechSequence += 1;
  const clip = currentClip;
  finishCurrent?.(false);
  finishCurrent = null;
  currentClip = null;
  clip?.stop();
  try { speechEngine()?.cancel(); } catch { /* Native speech can be unavailable. */ }
  currentUtterance = null;
}

function unlock() {
  if (typeof window === 'undefined') return;
  ensureEffects();
  // Howler primes its HTML5 audio pool on the first touch/key event. Resume the
  // Web Audio context here as well, synchronously inside the user's gesture.
  try {
    if (Howler.ctx?.state === 'suspended') Howler.ctx.resume().catch(() => {});
  } catch { /* Written instructions remain available. */ }
}

async function nativeSpeech(text, sequence) {
  const voice = await waitForTurkishVoice();
  if (sequence !== speechSequence || muted) return false;
  if (!voice || typeof window?.SpeechSynthesisUtterance !== 'function') {
    voiceMode = 'unavailable';
    status('Bu cihazda Türkçe ses bulunamadı. Yazılı yönergelerle devam edebilirsin.');
    return false;
  }
  voiceMode = 'native-turkish';
  nativeVoiceName = voice.name || 'Türkçe cihaz sesi';
  if (!nativeNoticeShown) {
    nativeNoticeShown = true;
    status('Bu yönerge için cihazın Türkçe sesi kullanılıyor.');
  }
  return new Promise(resolve => {
    const utterance = new window.SpeechSynthesisUtterance(text);
    currentUtterance = utterance; // Keep the utterance alive for iOS Safari.
    utterance.voice = voice;
    utterance.lang = voice.lang;
    utterance.rate = 0.9;
    utterance.pitch = 1;
    utterance.volume = volume;
    const finish = value => {
      if (finishCurrent === finish) finishCurrent = null;
      if (currentUtterance === utterance) currentUtterance = null;
      resolve(value);
    };
    finishCurrent = finish;
    utterance.onend = () => finish(true);
    utterance.onerror = event => {
      if (!['canceled', 'interrupted'].includes(event.error) && sequence === speechSequence) {
        status('Türkçe ses çalınamadı. Yazılı yönergeyle devam edebilirsin.');
      }
      finish(false);
    };
    try { speechEngine().speak(utterance); }
    catch { finish(false); }
  });
}

function recordedSpeech(file, text, sequence) {
  let clip = clips.get(file);
  if (!clip) {
    clip = new Howl({
      src: [`${AUDIO_BASE}${file}`],
      html5: true,
      preload: true,
      volume,
      pool: 1,
    });
    clips.set(file, clip);
  }
  currentClip = clip;
  clip.volume(volume);
  pruneClips();
  return new Promise(resolve => {
    let settled = false;
    const clean = () => {
      clip.off('end', ended);
      clip.off('loaderror', loadError);
      clip.off('playerror', playError);
      clip.off('unlock', retryAfterUnlock);
    };
    const finish = value => {
      if (settled) return;
      settled = true;
      clean();
      if (finishCurrent === finish) finishCurrent = null;
      if (currentClip === clip) currentClip = null;
      resolve(value);
    };
    const ended = () => finish(true);
    const loadError = async () => {
      if (settled) return;
      settled = true;
      clean();
      if (finishCurrent === finish) finishCurrent = null;
      if (currentClip === clip) currentClip = null;
      const result = sequence === speechSequence && !muted
        ? await nativeSpeech(text, sequence) : false;
      resolve(result);
    };
    const retryAfterUnlock = () => {
      if (sequence === speechSequence && !muted && !settled) clip.play();
    };
    const playError = () => {
      if (sequence !== speechSequence || muted || settled) { finish(false); return; }
      clip.once('unlock', retryAfterUnlock);
      status('Sesi başlatmak için Dinle düğmesine yeniden dokun.');
    };
    finishCurrent = finish;
    clip.once('end', ended);
    clip.once('loaderror', loadError);
    clip.on('playerror', playError);
    if (clip.state() === 'unloaded') clip.load();
    voiceMode = 'recorded';
    nativeVoiceName = '';
    clip.play();
  });
}

async function speak(value) {
  stopSpeech();
  const text = String(value ?? '').trim();
  if (!text) return false;
  if (muted) { status('Ses kapalı. Hoparlöre dokunarak açabilirsin.'); return false; }
  unlock();
  const sequence = speechSequence;
  await loadManifest();
  if (sequence !== speechSequence || muted) return false;
  const file = phrases[normalizeSpeechText(text)];
  return file ? recordedSpeech(file, text, sequence) : nativeSpeech(text, sequence);
}

function playEffect(name) {
  if (muted || !Object.hasOwn(EFFECT_LEVELS, name)) return;
  const now = Date.now();
  if (name === 'tap' && now - lastTap < 65) return;
  if (name === 'tap') lastTap = now;
  unlock();
  const effect = effects.get(name);
  effect?.volume(volume * EFFECT_LEVELS[name]);
  effect?.play();
}

function stopEffect(name) {
  effects.get(name)?.stop();
}

function setMuted(value) {
  muted = Boolean(value);
  if (muted) {
    stopSpeech();
    for (const effect of effects.values()) effect.stop();
  }
}

function setVolume(value) {
  const requested = Number(value);
  if (!Number.isFinite(requested)) return;
  volume = Math.max(0, Math.min(1, requested));
  for (const [name, effect] of effects) effect.volume(volume * EFFECT_LEVELS[name]);
  for (const clip of clips.values()) clip.volume(volume);
  if (currentUtterance) currentUtterance.volume = volume;
}

function preload() {
  ensureEffects();
  return loadManifest();
}

function voiceStatus() {
  return { mode: voiceMode, locale: 'tr-TR', muted, volume, recordedPhrases: Object.keys(phrases).length, manifestAvailable, voiceName: nativeVoiceName };
}

export function configureAudio(options = {}) {
  if (typeof options.onStatus === 'function') onStatus = options.onStatus;
  if (typeof options.muted === 'boolean') setMuted(options.muted);
  if (options.volume !== undefined) setVolume(options.volume);
}

export const audio = { unlock, speak, stopSpeech, setMuted, setVolume, playEffect, stopEffect, preload, voiceStatus };
