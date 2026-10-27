// Learning observations are intentionally separate from stickers/completions.
// The spacing rules below are adjustable product rules, not a diagnostic test.
export const ALPHABET = 'a b c ç d e f g ğ h ı i j k l m n o ö p r s ş t u ü v y z'.split(' ');
export const SKILLS = ['listen', 'syllables', 'build', 'recall', 'write', 'meaning', 'sentence'];
export const SKILL_LABELS = {
  listen: 'Dinleyip tanıma', syllables: 'Heceleri birleştirme', build: 'Harflerle kurma',
  recall: 'Örneksiz hatırlama', write: 'Birlikte kontrol edilen yazma',
  meaning: 'Anlamını bulma', sentence: 'Cümlede kullanma',
};
const DAY = 86400000;
const HOUR = 3600000;
const WORD = /^[abcçdefgğhıijklmnoöprsştuüvyz]{1,24}$/u;
const VOWELS = new Set([...'aeıioöuü']);
const MAX_EVENTS = 500;
const MAX_PROGRESS_WORDS = 200;
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const integer = (value, max = 1000000) => Math.min(max, Math.max(0, Math.floor(Number(value) || 0)));
const stamp = value => Math.max(0, Math.min(32503680000000, Math.floor(Number(value) || 0)));
const cleanText = (value, length = 240) => typeof value === 'string' ? value.normalize('NFC').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, length) : '';
const identifier = value => typeof value === 'string' && /^[a-zA-Z0-9_.:-]{1,160}$/.test(value) ? value : '';
const normalizeWord = value => typeof value === 'string' ? value.normalize('NFC').trim().toLocaleLowerCase('tr-TR') : '';
const known = letters => new Set((Array.isArray(letters) ? letters : typeof letters === 'string' ? [...letters] : []).map(normalizeWord).filter(letter => ALPHABET.includes(letter)));
const fits = (text, letters) => [...normalizeWord(text)].filter(letter => ALPHABET.includes(letter)).every(letter => letters.has(letter));
const unique = values => [...new Set(values)];

const STARTER_WORDS = [
  { text: 'nane', parts: ['na', 'ne'], meaning: 'Kokulu yaprakları olan bir bitki.', sentence: 'Anne nane al.', emoji: '🌿' },
  { text: 'anne', parts: ['an', 'ne'], meaning: 'Bir çocuğun annesi.', sentence: 'Anne nane al.', emoji: '👩' },
  { text: 'tane', parts: ['ta', 'ne'], meaning: 'Sayılabilen bir şeyin adedi.', sentence: '', emoji: '' },
  { text: 'lale', parts: ['la', 'le'], meaning: 'Bahçede yetişen bir çiçek.', sentence: 'Ali lale al.', emoji: '🌷' },
  { text: 'nine', parts: ['ni', 'ne'], meaning: 'Büyükanne.', sentence: 'Nine nane al.', emoji: '👵' },
  { text: 'el', parts: ['el'], meaning: 'Parmaklarımızın bulunduğu organ.', sentence: '', emoji: '✋' },
  { text: 'at', parts: ['at'], meaning: 'Dört ayaklı bir hayvan.', sentence: '', emoji: '🐎' },
  { text: 'et', parts: ['et'], meaning: 'Bir yiyecek.', sentence: '', emoji: '🥩' },
];

/** A conservative suggestion: the adult can edit loan words and exceptions. */
export function splitSyllables(value) {
  const text = normalizeWord(value);
  if (!WORD.test(text)) return [];
  const vowels = [...text].map((letter, index) => VOWELS.has(letter) ? index : -1).filter(index => index >= 0);
  if (vowels.length < 2) return [text];
  const boundaries = [];
  const loanOnsets = new Set(['tr', 'pr', 'br', 'kr', 'gr', 'fr', 'pl', 'bl', 'kl', 'gl', 'fl', 'dr']);
  for (let index = 1; index < vowels.length; index++) {
    const previous = vowels[index - 1], next = vowels[index];
    const consonants = next - previous - 1;
    boundaries.push(consonants === 0 ? next
      : consonants >= 3 && loanOnsets.has(text.slice(next - 2, next)) ? next - 2 : next - 1);
  }
  let start = 0;
  return [...boundaries, text.length].map(end => { const part = text.slice(start, end); start = end; return part; });
}

function normalizeEntry(value) {
  const source = typeof value === 'string' ? { text: value } : value;
  if (!record(source)) return null;
  const text = normalizeWord(source.text);
  if (!WORD.test(text)) return null;
  const supplied = Array.isArray(source.parts) ? source.parts : Array.isArray(source.syllables) ? source.syllables : [];
  const parts = supplied.slice(0, 24).map(normalizeWord);
  return {
    text, parts: parts.length && parts.every(part => WORD.test(part)) && parts.join('') === text ? parts : splitSyllables(text),
    meaning: cleanText(source.meaning), sentence: cleanText(source.sentence), emoji: cleanText(source.emoji, 16),
  };
}

export function parseWordList(value) {
  const words = [], errors = [], seen = new Set();
  if (typeof value !== 'string') return { words, errors: [{ line: 1, message: 'Kelimeleri metin olarak yazın.' }] };
  if (value.length > 12000) return { words, errors: [{ line: 1, message: 'Liste çok uzun. En fazla 100 kelime ekleyin.' }] };
  value.split(/\r?\n/).forEach((line, index) => {
    for (const item of line.split(/[;,]/)) {
      if (!item.trim()) continue;
      const entry = normalizeEntry(item);
      if (!entry) { errors.push({ line: index + 1, message: 'Her kelime 1–24 Türkçe harften oluşmalı. Cümleleri ayrı alana yazın.' }); continue; }
      if (seen.has(entry.text)) continue;
      if (words.length >= 100) { errors.push({ line: index + 1, message: 'Bir listede en fazla 100 kelime olabilir.' }); continue; }
      seen.add(entry.text);
      // Familiar starter meanings are retained, but arbitrary words get no invented meaning.
      const familiar = STARTER_WORDS.find(word => word.text === entry.text);
      words.push({ ...entry, ...(familiar || {}), parts: [...(familiar?.parts || entry.parts)] });
    }
  });
  return { words, errors };
}

export function createLearningState(now = Date.now()) {
  return {
    version: 1, updatedAt: stamp(now),
    lists: [{ id: 'starter', title: 'İlk kelimelerim', updatedAt: stamp(now), words: STARTER_WORDS.map(word => ({ ...word, parts: [...word.parts] })) }],
    activeListId: 'starter', events: [], progress: Object.create(null), session: null,
  };
}

function emptyProgress() {
  return { attempts: 0, independentSuccesses: 0, assistedSuccesses: 0, mistakes: 0, hints: 0,
    lastAt: 0, lastIndependentAt: 0, nextDueAt: 0, intervalDays: 0, independentDays: [], recent: [] };
}
function normalizeProgress(value) {
  const output = emptyProgress();
  if (!record(value)) return output;
  for (const key of ['attempts', 'independentSuccesses', 'assistedSuccesses', 'mistakes', 'hints']) output[key] = integer(value[key]);
  for (const key of ['lastAt', 'lastIndependentAt', 'nextDueAt']) output[key] = stamp(value[key]);
  output.intervalDays = integer(value.intervalDays, 30);
  output.independentDays = unique((Array.isArray(value.independentDays) ? value.independentDays : []).filter(day => typeof day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(day))).sort().slice(-30);
  output.recent = (Array.isArray(value.recent) ? value.recent : []).filter(item => [0, 1, 2].includes(item)).slice(-8);
  return output;
}

function normalizeEvent(value, now) {
  if (!record(value) || !identifier(value.id) || !WORD.test(normalizeWord(value.word)) || !SKILLS.includes(value.skill)) return null;
  const correct = value.correct === true;
  const mistakes = integer(value.mistakes, 100), hints = integer(value.hints, 100);
  const writingReviewed = value.writingReviewed === true;
  return {
    id: value.id, word: normalizeWord(value.word), skill: value.skill,
    correct, mistakes, hints, writingReviewed,
    independent: value.independent === true && correct && !mistakes && !hints && (value.skill !== 'write' || writingReviewed),
    at: Math.min(stamp(value.at ?? now), stamp(now) + 300000),
  };
}

function applyEvidence(previous, event) {
  const progress = normalizeProgress(previous);
  progress.attempts++;
  progress.mistakes += event.mistakes;
  progress.hints += event.hints;
  progress.lastAt = Math.max(progress.lastAt, event.at);
  const verified = event.skill !== 'write' || event.writingReviewed;
  const quality = event.independent && verified ? 2 : event.correct && verified ? 1 : 0;
  progress.recent = [...progress.recent, quality].slice(-8);
  if (quality === 2) {
    progress.independentSuccesses++;
    const day = new Date(event.at).toISOString().slice(0, 10);
    // A midnight boundary or repeated clicks cannot manufacture delayed retention.
    const delayed = !progress.independentDays.length || event.at - progress.lastIndependentAt >= 20 * HOUR;
    if (delayed && !progress.independentDays.includes(day)) {
      progress.independentDays = [...progress.independentDays, day].slice(-30);
      progress.lastIndependentAt = event.at;
      progress.intervalDays = progress.independentDays.length === 1 ? 1 : Math.min(14, Math.max(1, progress.intervalDays * 2));
      progress.nextDueAt = event.at + progress.intervalDays * DAY;
    }
  } else {
    if (quality === 1) progress.assistedSuccesses++;
    progress.intervalDays = 0;
    progress.nextDueAt = event.at + 10 * 60000;
  }
  return progress;
}

function normalizeSession(value, now) {
  if (!record(value) || !identifier(value.id) || !Array.isArray(value.tasks)) return null;
  const tasks = value.tasks.slice(0, 12).map(task => {
    if (!record(task) || !identifier(task.id) || !WORD.test(normalizeWord(task.word)) || !SKILLS.includes(task.kind) || !SKILLS.includes(task.skill)) return null;
    return {
      id: task.id, word: normalizeWord(task.word), kind: task.kind, skill: task.skill,
      target: cleanText(task.target), tokens: (Array.isArray(task.tokens) ? task.tokens : []).map(token => cleanText(token)).filter(Boolean).slice(0, 40),
      options: (Array.isArray(task.options) ? task.options : []).map(option => cleanText(option)).filter(Boolean).slice(0, 8),
      parts: (Array.isArray(task.parts) ? task.parts : []).map(normalizeWord).filter(part => WORD.test(part)).slice(0, 24),
      support: integer(task.support, 2), reason: cleanText(task.reason), meaning: cleanText(task.meaning),
      sentence: cleanText(task.sentence), emoji: cleanText(task.emoji, 16),
    };
  }).filter(Boolean);
  if (!tasks.length) return null;
  const results = Object.create(null);
  for (const task of tasks) {
    const result = record(value.results) ? value.results[task.id] : null;
    if (!record(result)) continue;
    results[task.id] = {
      correct: result.correct === true, mistakes: integer(result.mistakes, 100), hints: integer(result.hints, 100),
      writingReviewed: result.writingReviewed === true, independent: result.independent !== false,
      modelOpened: result.modelOpened === true,
      inkPaths: (Array.isArray(result.inkPaths) ? result.inkPaths : []).slice(0, 12).filter(validInkPath),
      ...(identifier(result.id) ? { id: result.id } : {}),
      ...(WORD.test(normalizeWord(result.word)) ? { word: normalizeWord(result.word) } : {}),
      ...(SKILLS.includes(result.skill) ? { skill: result.skill } : {}),
      ...(result.at !== undefined ? { at: Math.min(stamp(result.at), stamp(now) + 300000) } : {}),
    };
  }
  return { id: value.id, createdAt: stamp(value.createdAt), wordTexts: unique(tasks.map(task => task.word)).slice(0, 3),
    tasks, index: Math.min(tasks.length, integer(value.index, 12)), results, paused: value.paused === true,
    storySeen: value.storySeen === true, storyEpisode: integer(value.storyEpisode, 2) };
}

function validInkPath(path) {
  if (typeof path !== 'string' || path.length > 8000 || !/^M-?\d+(?:\.\d+)? -?\d+(?:\.\d+)?(?:\s*L-?\d+(?:\.\d+)? -?\d+(?:\.\d+)?)*$/.test(path)) return false;
  return [...path.matchAll(/[ML](-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g)]
    .every(([, x, y]) => Number(x) >= 0 && Number(x) <= 640 && Number(y) >= 0 && Number(y) <= 300);
}

export function normalizeLearningState(value, now = Date.now()) {
  if (!record(value) || value.version !== 1) return createLearningState(now);
  const lists = [], ids = new Set();
  let totalWords = 0;
  for (const source of (Array.isArray(value.lists) ? value.lists : []).slice(0, 20)) {
    if (!record(source) || !identifier(source.id) || ids.has(source.id)) continue;
    const words = [], texts = new Set();
    for (const candidate of (Array.isArray(source.words) ? source.words : []).slice(0, 100)) {
      const word = normalizeEntry(candidate);
      if (!word || texts.has(word.text) || totalWords >= 1000) continue;
      words.push(word); texts.add(word.text); totalWords++;
    }
    ids.add(source.id);
    lists.push({ id: source.id, title: cleanText(source.title, 80) || 'Kelime listem', updatedAt: stamp(source.updatedAt), words });
  }
  if (!lists.length) lists.push(...createLearningState(now).lists);
  const eventsById = new Map();
  for (const source of (Array.isArray(value.events) ? value.events : []).slice(-MAX_EVENTS)) {
    const event = normalizeEvent(source, now);
    if (event && !eventsById.has(event.id)) eventsById.set(event.id, event);
  }
  const events = [...eventsById.values()].sort((a, b) => a.at - b.at);
  const progress = Object.create(null);
  for (const [word, skills] of Object.entries(record(value.progress) ? value.progress : {}).slice(-MAX_PROGRESS_WORDS)) {
    if (!WORD.test(word) || !record(skills)) continue;
    progress[word] = {};
    for (const skill of SKILLS) if (record(skills[skill])) progress[word][skill] = normalizeProgress(skills[skill]);
  }
  // Restore missing aggregates only; normalizing again must never award twice.
  const missing = new Set(events.filter(event => !progress[event.word]?.[event.skill]).map(event => `${event.word}:${event.skill}`));
  for (const event of events) if (missing.has(`${event.word}:${event.skill}`)) {
    progress[event.word] ||= {};
    progress[event.word][event.skill] = applyEvidence(progress[event.word][event.skill], event);
  }
  trimProgress(progress);
  return { version: 1, updatedAt: stamp(value.updatedAt), lists,
    activeListId: lists.some(list => list.id === value.activeListId) ? value.activeListId : lists[0].id,
    events, progress, session: normalizeSession(value.session, now) };
}

function trimProgress(progress) {
  const entries = Object.entries(progress).sort((a, b) => Math.max(0, ...Object.values(b[1]).map(skill => skill.lastAt)) - Math.max(0, ...Object.values(a[1]).map(skill => skill.lastAt)));
  for (const [word] of entries.slice(MAX_PROGRESS_WORDS)) delete progress[word];
}

export function getEligibleWords(value, letters) {
  const state = normalizeLearningState(value), selected = known(letters);
  const list = state.lists.find(item => item.id === state.activeListId) || state.lists[0];
  const eligible = [], blocked = [];
  for (const word of list.words) {
    const missingLetters = unique([...word.text].filter(letter => !selected.has(letter)));
    if (missingLetters.length) blocked.push({ ...word, missingLetters }); else eligible.push({ ...word, parts: [...word.parts] });
  }
  return { eligible, blocked };
}

/** Balance vocabulary coverage with spaced review. A review may occupy one
 * slot, while the other goes to the least-practised eligible word. History
 * contains completed target words, never distractors or animation progress. */
export function orderPracticeWords(state, pool, { now = Date.now(), runs = [] } = {}) {
  const history = Array.isArray(runs) ? runs : [];
  const latest = history.at(-1);
  const recentTargets = new Set(Array.isArray(latest?.wordTexts) ? latest.wordTexts : []);
  const entries = pool.map((word, index) => {
    const progress = Object.values(state.progress?.[word.text] || {}).filter(item => item?.attempts > 0);
    const appearances = history.map((run, order) => ({ run, order }))
      .filter(({ run }) => Array.isArray(run.wordTexts) && run.wordTexts.includes(word.text));
    const lastAt = Math.max(0, ...progress.map(item => item.lastAt || 0), ...appearances.map(({ run }) => Number(run.completedAt) || 0));
    const exposure = Math.max(appearances.length, progress.length ? 1 : 0);
    const dueAt = Math.min(Infinity, ...progress.filter(item => item.nextDueAt > 0 && item.nextDueAt <= now).map(item => item.nextDueAt));
    const weak = progress.some(item => item.recent?.at(-1) !== 2);
    // Even an older, still-due skill cannot force the same word back into
    // every immediate tour after a different skill has just been practised.
    const cooling = lastAt > 0 && now - lastAt < 10 * 60000;
    const review = !cooling && !recentTargets.has(word.text) && (Number.isFinite(dueAt) || weak);
    return { word, index, lastAt, exposure, dueAt, review, recent: recentTargets.has(word.text), lastOrder: appearances.at(-1)?.order ?? -1 };
  });
  const balanced = [...entries].sort((a, b) => a.exposure - b.exposure || Number(a.recent) - Number(b.recent)
    || a.lastAt - b.lastAt || a.lastOrder - b.lastOrder || a.index - b.index);
  const review = entries.filter(item => item.review).sort((a, b) => a.dueAt - b.dueAt || a.exposure - b.exposure || a.lastAt - b.lastAt || a.index - b.index)[0];
  const first = review || balanced[0];
  if (!first) return [];
  const remaining = balanced.filter(item => item !== first);
  return [first, ...remaining].map(item => item.word);
}

export function recordAttempt(value, attempt, now = Date.now()) {
  const state = normalizeLearningState(value, now), event = normalizeEvent(attempt, now);
  if (!event || state.events.some(previous => previous.id === event.id)) return state;
  state.events = [...state.events, event].sort((a, b) => a.at - b.at).slice(-MAX_EVENTS);
  state.progress[event.word] ||= {};
  state.progress[event.word][event.skill] = applyEvidence(state.progress[event.word][event.skill], event);
  trimProgress(state.progress);
  state.updatedAt = Math.max(state.updatedAt, stamp(now));
  return state;
}

function skillStatus(progress) {
  if (!progress?.attempts) return 'new';
  if (progress.recent.at(-1) !== 2) return 'supported';
  return progress.independentDays.length >= 2 ? 'recalled-later' : 'independent';
}

function levelFor(state, word, skill) {
  if (skill === 'recall' || skill === 'meaning') return 0;
  const progress = state.progress[word]?.[skill];
  if (skill === 'listen') return progress?.attempts && progress.recent.at(-1) !== 2 ? 1 : 0;
  if (!progress?.attempts) return 2;
  return progress.recent.at(-1) === 2 ? 0 : progress.independentSuccesses || progress.assistedSuccesses >= 2 ? 1 : 2;
}

function optionsFor(word, pool, letters) {
  const candidates = unique(pool.map(entry => entry.text))
    .filter(text => text !== word.text && fits(text, letters));
  candidates.sort((a, b) => Math.abs(a.length - word.text.length) - Math.abs(b.length - word.text.length) || a.localeCompare(b, 'tr'));
  return [word.text, ...candidates.slice(0, 2)];
}

function makeTask(word, kind, state, pool, letters, id, reason = '') {
  let target = word.text, tokens = [...word.text], options = [];
  let support = levelFor(state, word.text, kind);
  if (kind === 'syllables') tokens = [...word.parts];
  if (kind === 'listen') {
    options = optionsFor(word, pool, letters);
    if (support > 0) options = options.slice(0, 2);
    if (options.length < 2) support = 2;
  }
  if (kind === 'meaning') {
    const pictures = unique(pool.map(entry => entry.emoji).filter(Boolean));
    if (word.emoji && pictures.length >= 2) { target = word.emoji; options = [target, ...pictures.filter(emoji => emoji !== target).slice(0, 2)]; }
    else {
      const meanings = unique(pool.map(entry => entry.meaning).filter(text => text && fits(text, letters)));
      if (!word.meaning || !fits(word.meaning, letters) || meanings.length < 2) return null;
      target = word.meaning; options = [target, ...meanings.filter(text => text !== target).slice(0, 2)];
    }
  }
  if (kind === 'sentence') {
    if (!word.sentence || !fits(word.sentence, letters) || !normalizeWord(word.sentence).split(/[^abcçdefgğhıijklmnoöprsştuüvyz]+/u).includes(word.text)) return null;
    target = word.sentence; tokens = word.sentence.split(/\s+/).filter(Boolean);
    if (tokens.length < 2 || tokens.length > 40) return null;
  }
  return { id, word: word.text, skill: kind, kind, target, tokens, options, support,
    reason, parts: [...word.parts], meaning: word.meaning, sentence: word.sentence, emoji: word.emoji };
}

function hash(value) { let result = 2166136261; for (const letter of value) result = Math.imul(result ^ letter.codePointAt(0), 16777619); return result >>> 0; }

export function planSession(value, letters, now = Date.now(), options = {}) {
  const state = normalizeLearningState(value, now), selected = known(letters);
  const { eligible } = getEligibleWords(state, letters);
  const focusText = normalizeWord(cleanText(options.focusText));
  const focusTokens = unique(focusText.split(/[^abcçdefgğhıijklmnoöprsştuüvyz]+/u).filter(token => WORD.test(token)));
  const focusSkill = SKILLS.includes(options.focusSkill) ? options.focusSkill : '';
  const entryKind = SKILLS.includes(options.entryKind) ? options.entryKind : '';
  const sessionId = `journey-${stamp(now).toString(36)}-${hash(`${state.activeListId}:${state.events.at(-1)?.id || ''}:${focusText}:${focusSkill}:${entryKind}`).toString(36)}`;
  const previousEpisode = integer(state.session?.storyEpisode, 2);
  const storyEpisode = state.session && state.session.index >= state.session.tasks.length ? (previousEpisode + 1) % 3 : previousEpisode;
  const plan = { id: sessionId, createdAt: stamp(now), wordTexts: [], tasks: [], index: 0, results: Object.create(null),
    paused: false, storySeen: false, storyEpisode };
  if (!eligible.length) return plan;
  const lastAt = word => Math.max(0, ...Object.values(state.progress[word.text] || {}).map(progress => progress.lastAt));
  const due = word => Object.values(state.progress[word.text] || {}).some(progress => progress.nextDueAt > 0 && progress.nextDueAt <= now);
  const ranked = orderPracticeWords(state, eligible, { now });
  const focusScore = word => Math.max(0, ...focusTokens.map(token => {
    if (word.text === token) return 100;
    if (word.parts.includes(token)) return 70;
    if (word.text.includes(token)) return 50;
    const overlap = unique([...token]).filter(letter => word.text.includes(letter)).length;
    return overlap ? 10 + overlap / unique([...token]).length : 0;
  }));
  const focused = focusTokens.length ? [...ranked].sort((a, b) => focusScore(b) - focusScore(a) || ranked.indexOf(a) - ranked.indexOf(b))[0] : null;
  let first = focused && focusScore(focused) > 0 ? focused : ranked[0];
  if (entryKind && !focusTokens.length && !makeTask(first, entryKind, state, eligible, selected, 'preview')) {
    first = ranked.find(word => makeTask(word, entryKind, state, eligible, selected, 'preview')) || first;
  }
  const alternatives = ranked.filter(word => word.text !== first.text);
  // The review slot above must not consume both places. The least-practised
  // alternative keeps new teacher words moving through the whole list.
  const second = alternatives[0] || first;
  const possible = (word, kind) => Boolean(makeTask(word, kind, state, eligible, selected, 'preview'));
  const usableKinds = word => SKILLS.filter(kind => (kind !== 'syllables' || word.parts.length > 1) && possible(word, kind));
  const weakSkill = usableKinds(first).filter(skill => skill !== focusSkill).filter(skill => {
    const progress = state.progress[first.text]?.[skill];
    return progress?.attempts && progress.recent.at(-1) !== 2;
  }).sort((a, b) => {
    const left = state.progress[first.text][a], right = state.progress[first.text][b];
    return left.recent.at(-1) - right.recent.at(-1) || left.lastAt - right.lastAt;
  })[0];
  const transferKinds = {
    listen: ['syllables', 'build', 'recall'], syllables: ['build', 'recall', 'meaning'],
    build: ['recall', 'meaning', 'write'], recall: ['meaning', 'sentence', 'write'],
    write: ['meaning', 'sentence', 'recall'], meaning: ['sentence', 'recall', 'build'],
    sentence: ['recall', 'write', 'meaning'],
  };
  const transfer = focusSkill && focusScore(first) > 0
    ? transferKinds[focusSkill].find(kind => (kind !== 'syllables' || first.parts.length > 1) && possible(first, kind)) : '';
  const entry = entryKind && possible(first, entryKind) ? entryKind : '';
  const firstKind = entry || weakSkill || transfer || (due(first) ? 'recall' : 'listen');
  const reason = entry ? `Bu durakta “${first.text}” kelimesiyle ${SKILL_LABELS[entry].toLocaleLowerCase('tr-TR')} çalışacağız.`
    : entryKind ? `“${first.text}” için bu duraktaki görev henüz uygun değil. ${SKILL_LABELS[firstKind]} ile bağlantılı bir adım hazırladık.`
      : weakSkill ? `“${first.text}” için ${SKILL_LABELS[weakSkill].toLocaleLowerCase('tr-TR')} adımında biraz destek kullandın. Yeni bir biçimde deneyelim.`
    : transfer ? `“${first.text}” çalışmanı ${SKILL_LABELS[firstKind].toLocaleLowerCase('tr-TR')} ile sürdürelim.`
      : due(first) ? `“${first.text}” için yeniden hatırlama zamanı geldi.`
        : focusTokens.length && focusScore(first) > 0 ? `Çalıştığın parçaları öğretmeninin listesindeki “${first.text}” kelimesine bağlayalım.`
          : !lastAt(first) ? `Öğretmeninin listesindeki “${first.text}” kelimesini keşfedelim.`
            : `“${first.text}” kelimesini bu kez başka görevlerle kullanalım.`;
  const firstProgress = state.progress[first.text] || {};
  const finalKind = firstProgress.sentence?.attempts && (firstProgress.meaning?.lastAt || 0) < firstProgress.sentence.lastAt
    && makeTask(first, 'meaning', state, eligible, selected, 'preview') ? 'meaning' : 'sentence';
  const segment = word => word.parts.length > 1 ? 'syllables' : 'build';
  const focusPractice = weakSkill && weakSkill !== firstKind && weakSkill !== 'write' ? weakSkill : segment(first);
  const secondKind = lastAt(second) ? 'recall' : 'listen';
  const coldSpecs = [
    [first, firstKind, reason],
    [first, focusPractice, weakSkill && weakSkill !== firstKind ? 'Destek kullandığın beceriyi de bu yolculukta yeniden deneyelim.' : 'Parçalardan kelimenin bütününe.'],
    [second, 'listen', 'Araya başka bir kelimeyle küçük bir görev giriyor.'],
    [first, 'build', 'Aynı kelimeyi bu kez harflerle kur.'],
    [second, segment(second), 'İkinci kelimeyle yolumuza devam edelim.'],
    [first, 'recall', 'Araya başka görevler girdi. Şimdi örneksiz deneyelim.'],
    [first, 'write', 'Kelimeyi kendin yazıp birlikte kontrol et.'],
    [first, finalKind, finalKind === 'meaning' ? 'Kelimenin anlamıyla yaptığımız işi eşleştirelim.' : 'Kelimeyi anlamlı bir mesajın içinde kullan.'],
  ];
  const variants = [coldSpecs, [
    [first, firstKind, reason], [second, secondKind, 'Bildiğin bir kelimeyle yeni kelime arasında bağ kuralım.'],
    [first, focusPractice, 'Kelimeyi bu kez başka bir beceriyle kullanalım.'],
    [first, 'build', 'Harfleri sırala, kelimenin etiketini hazırla.'],
    [first, 'write', 'Etiketi kendi elinle yazıp birlikte kontrol et.'],
    [second, segment(second), 'İkinci kelimeyle kısa bir görev.'],
    [first, 'recall', 'Araya başka bir iş girdi. Şimdi örneksiz hatırlayalım.'],
    [first, finalKind, 'Kelimeyi anlamlı bir mesajda ya da resimde kullan.'],
  ], [
    [first, firstKind, reason], [second, secondKind, 'Bir başka kelimeye uğrayıp geri döneceğiz.'],
    [first, 'build', 'Harflerden kelimeyi kendin kur.'],
    [first, finalKind, 'Kurduğun kelimeyle bir mesajı veya resmi tamamla.'],
    [second, segment(second), 'Öğretmeninin listesinden ikinci bir çalışma.'],
    [first, 'write', 'Kelimeyi yazıp birlikte kontrol et.'],
    [first, 'recall', 'Biraz önce çalıştığın kelimeyi örneksiz hatırla.'],
    [first, focusPractice, 'Son bir beceri çalışmasıyla yolculuğu tamamlayalım.'],
  ], [
    [first, firstKind, reason], [first, focusPractice, 'Kelimeni bu kez başka bir beceriyle kullanalım.'],
    [second, secondKind, 'Araya başka bir kelimenin kartı giriyor.'],
    [first, finalKind, 'Kelimeyi yaptığımız işin anlamıyla eşleştirelim.'],
    [first, 'build', 'Mesajındaki kelimeyi bu kez harflerle kur.'],
    [second, 'build', 'İkinci kelimenin harflerini sırala.'],
    [first, 'write', 'Kelimeyi kendi elinle yazıp birlikte incele.'],
    [first, 'recall', 'Yolculuğun sonunda örneksiz bir hatırlama denemesi.'],
  ]];
  const historyCount = state.events.length + integer(state.session?.index, 12);
  const rotation = historyCount || transfer || entry ? 1 + hash(`${historyCount}:${state.events.at(-1)?.id || ''}:${focusSkill}:${entryKind}`) % 3 : 0;
  const observedTasks = state.events.filter(event => /^journey-[a-z0-9]+-[a-z0-9]+-\d+$/.test(event.id))
    .slice(-8).map(event => ({ word: event.word, kind: event.skill }));
  const previousTasks = state.session?.tasks?.length ? state.session.tasks : observedTasks;
  // Slot 5 may be replaced by a due letter below. Compare the surrounding
  // progression so that a permanent letter reminder cannot conceal a replay.
  const signature = tasks => tasks.filter((_, index) => index !== 4).map(task => `${task.word}:${task.kind}`).join('|');
  const previousSignature = previousTasks.length ? signature(previousTasks) : '';
  const limit = Math.max(1, Math.min(12, integer(options.limit || 8, 12)));
  const fill = specs => {
    plan.tasks = [];
    for (const [word, kind, why] of specs.slice(0, limit)) {
    const id = `${sessionId}-${plan.tasks.length}`;
    let task = makeTask(word, kind, state, eligible, selected, id, why)
      || makeTask(word, 'meaning', state, eligible, selected, id, 'Kelimenin anlamını da keşfedelim.')
      || makeTask(second, 'recall', state, eligible, selected, id, 'Bu kelimeyi de örneksiz hatırlayalım.');
    const previous = plan.tasks.at(-1);
    const duplicate = candidate => previous && candidate.word === previous.word && candidate.kind === previous.kind;
    const alreadyWrote = task.kind === 'write' && plan.tasks.some(previousTask => previousTask.word === task.word && previousTask.kind === 'write');
    if (duplicate(task) || alreadyWrote) {
      const nextKinds = ['build', 'syllables', 'meaning', 'listen', 'recall', 'sentence'].filter(nextKind => nextKind !== task.kind);
      const replacements = [
        ...nextKinds.map(nextKind => makeTask(word, nextKind, state, eligible, selected, id, 'Aynı kelimeyi başka bir görevle kullanalım.')),
        ...(second.text !== word.text ? [makeTask(second, kind, state, eligible, selected, id, 'Şimdi listedeki diğer kelimeyle çalışalım.')] : []),
      ];
      task = replacements.find(candidate => candidate && !duplicate(candidate)) || task;
    }
      plan.tasks.push(task);
    }
  };
  fill(variants[rotation]);
  if (previousSignature && signature(plan.tasks) === previousSignature) {
    for (let offset = 1; offset < variants.length; offset++) {
      fill(variants[(rotation + offset) % variants.length]);
      if (signature(plan.tasks) !== previousSignature) break;
    }
  }
  // A letter remembered in a previous writing/selection exercise can return
  // independently of the teacher's word list. It remains an observation about
  // that actual task, never a claim about phoneme recognition.
  const dueLetters = [...selected].map(letter => {
    const progress = state.progress[letter] || {};
    const skill = ['write', 'build'].find(key => progress[key]?.nextDueAt > 0 && progress[key].nextDueAt <= now);
    return skill ? { letter, skill, at: progress[skill].nextDueAt } : null;
  }).filter(Boolean).sort((a, b) => a.at - b.at || a.letter.localeCompare(b.letter, 'tr'));
  if (dueLetters.length && plan.tasks.length >= 5) {
    const { letter, skill } = dueLetters[0];
    const entry = normalizeEntry(letter);
    const task = makeTask(entry, skill === 'write' ? 'write' : 'build', state, eligible, selected,
      `${sessionId}-4`, skill === 'write' ? 'Daha önce yazdığın harfi yeniden deneyelim.' : 'Daha önce seçtiğin harfi yeniden bulalım.');
    if (skill === 'build') {
      task.options = [letter, ...[...selected].filter(other => other !== letter).slice(0, 2)];
      if (task.options.length < 2) task.support = 2;
    }
    plan.tasks[4] = task;
  }
  plan.wordTexts = unique(plan.tasks.map(task => task.word));
  return plan;
}

export function summarizeLearning(value, letters, now = Date.now()) {
  const state = normalizeLearningState(value, now), selected = known(letters);
  const activeList = state.lists.find(list => list.id === state.activeListId) || state.lists[0];
  const weakSkills = [];
  const words = activeList.words.map(word => {
    const missingLetters = unique([...word.text].filter(letter => !selected.has(letter)));
    const skills = SKILLS.map(key => {
      const progress = state.progress[word.text]?.[key] || emptyProgress();
      const status = skillStatus(progress);
      if (status === 'supported') weakSkills.push({ word: word.text, skill: key, label: SKILL_LABELS[key] });
      return { key, label: SKILL_LABELS[key], status, attempts: progress.attempts,
        independentSuccesses: progress.independentSuccesses, assistedSuccesses: progress.assistedSuccesses,
        independentDays: progress.independentDays.length, nextDueAt: progress.nextDueAt };
    });
    const reviews = skills.map(skill => skill.nextDueAt).filter(Boolean);
    const status = skills.find(skill => skill.key === 'recall')?.status === 'recalled-later' ? 'recalled-later'
      : skills.some(skill => skill.status === 'independent' || skill.status === 'recalled-later') ? 'independent'
        : skills.some(skill => skill.attempts) ? 'supported' : 'new';
    return { ...word, missingLetters, eligible: !missingLetters.length, status, skills,
      due: !missingLetters.length && reviews.some(at => at <= now), nextReviewAt: reviews.length ? Math.min(...reviews) : null };
  });
  const letterRows = ALPHABET.filter(letter => selected.has(letter)).map(letter => {
    const skills = ['build', 'write'].map(key => {
      const progress = state.progress[letter]?.[key] || emptyProgress();
      return { key, label: key === 'write' ? 'Birlikte kontrol edilen harf yazma' : 'Harf seçme',
        status: skillStatus(progress), attempts: progress.attempts,
        independentSuccesses: progress.independentSuccesses, assistedSuccesses: progress.assistedSuccesses,
        independentDays: progress.independentDays.length, nextDueAt: progress.nextDueAt };
    });
    const reviews = skills.map(skill => skill.nextDueAt).filter(Boolean);
    const status = skills.some(skill => skill.status === 'recalled-later') ? 'recalled-later'
      : skills.some(skill => skill.status === 'independent') ? 'independent'
        : skills.some(skill => skill.attempts) ? 'supported' : 'new';
    return { letter, text: letter, eligible: true, status, skills,
      due: reviews.some(at => at <= now), nextReviewAt: reviews.length ? Math.min(...reviews) : null };
  });
  const dates = [...words.filter(word => word.eligible), ...letterRows].map(item => item.nextReviewAt).filter(Boolean);
  return { activeList, words, totalWords: words.length, eligibleWords: words.filter(word => word.eligible).length,
    blockedWords: words.filter(word => !word.eligible).length, dueWords: words.filter(word => word.due).length,
    practicedWords: words.filter(word => word.skills.some(skill => skill.attempts)).length,
    delayedWords: words.filter(word => word.status === 'recalled-later').length,
    nextReviewAt: dates.length ? Math.min(...dates) : null, weakSkills,
    letterRows, dueLetters: letterRows.filter(letter => letter.due).length,
    delayedLetters: letterRows.filter(letter => letter.status === 'recalled-later').length };
}

/** Merge retries conservatively: observations are deduplicated, not summed. */
export function mergeLearningStates(localValue, remoteValue, now = Date.now()) {
  const local = normalizeLearningState(localValue, now), remote = normalizeLearningState(remoteValue, now);
  const base = local.updatedAt >= remote.updatedAt ? local : remote;
  const other = base === local ? remote : local;
  // The editor currently creates/edits lists but has no delete operation. Keep
  // independent list creations across tabs, and resolve edits by that list's
  // own timestamp rather than unrelated activity on the whole snapshot.
  const listsById = new Map();
  for (const list of [...other.lists, ...base.lists]) {
    const previous = listsById.get(list.id);
    if (!previous || list.updatedAt >= previous.updatedAt) listsById.set(list.id, list);
  }
  const lists = [...listsById.values()].sort((a, b) => Number(b.id === base.activeListId) - Number(a.id === base.activeListId)
    || b.updatedAt - a.updatedAt);
  const events = [...new Map([...other.events, ...base.events].map(event => [event.id, event])).values()].sort((a, b) => a.at - b.at).slice(-MAX_EVENTS);
  const progress = Object.create(null);
  for (const state of [other, base]) for (const [word, skills] of Object.entries(state.progress)) {
    progress[word] ||= {};
    for (const [skill, observation] of Object.entries(skills)) {
      const previous = progress[word][skill];
      if (!previous || observation.lastAt >= previous.lastAt) progress[word][skill] = { ...observation, recent: [...observation.recent], independentDays: [...observation.independentDays] };
    }
  }
  // Rebuild the retained window once, so concurrent observations of the same
  // skill survive. Cumulative counters preserve older, trimmed observations.
  const retained = Object.create(null);
  for (const event of events) {
    retained[event.word] ||= {};
    retained[event.word][event.skill] = applyEvidence(retained[event.word][event.skill], event);
  }
  for (const [word, skills] of Object.entries(retained)) for (const [skill, window] of Object.entries(skills)) {
    progress[word] ||= {};
    const previous = progress[word][skill];
    if (!previous) { progress[word][skill] = window; continue; }
    const combined = { ...previous };
    for (const counter of ['attempts', 'independentSuccesses', 'assistedSuccesses', 'mistakes', 'hints']) combined[counter] = Math.max(previous[counter], window[counter]);
    if (window.lastAt >= previous.lastAt) {
      combined.lastAt = window.lastAt; combined.recent = window.recent;
      // Conservatively revisit sooner if truncated history cannot justify the
      // longer interval. It never manufactures extra delayed-success days.
      combined.nextDueAt = Math.min(...[previous.nextDueAt, window.nextDueAt].filter(Boolean));
      combined.intervalDays = Math.min(previous.intervalDays, window.intervalDays);
    }
    if (window.independentDays.length > previous.independentDays.length) combined.independentDays = window.independentDays;
    combined.lastIndependentAt = Math.max(previous.lastIndependentAt, window.lastIndependentAt);
    progress[word][skill] = combined;
  }
  return normalizeLearningState({ ...base, lists, events, progress }, now);
}
