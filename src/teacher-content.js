// Teacher-authored units remain separate from vocabulary words. These helpers
// validate supplied text; they never generate random syllables or fake words.
const ALPHABET = [...'abcçdefgğhıijklmnoöprsştuüvyz'];
const LETTER = new Set(ALPHABET);
const VOWELS = new Set([...'aeıioöuü']);
const TURKISH = /^[abcçdefgğhıijklmnoöprsştuüvyz]+$/u;
const CLUSTERS = new Set(['tr', 'pr', 'br', 'kr', 'gr', 'fr', 'pl', 'bl', 'kl', 'gl', 'fl', 'dr', 'sp', 'st', 'sk', 'str', 'spr', 'skr']);
const lower = value => typeof value === 'string' ? value.normalize('NFC').trim().toLocaleLowerCase('tr-TR') : '';
const unique = values => [...new Set(values)];

export function isTeacherSyllable(value) {
  const text = lower(value);
  if (!text || text.length > 6 || !TURKISH.test(text)) return false;
  const vowels = [...text].map((letter, index) => VOWELS.has(letter) ? index : -1).filter(index => index >= 0);
  if (vowels.length !== 1) return false;
  const onset = text.slice(0, vowels[0]), coda = text.slice(vowels[0] + 1);
  return (onset.length <= 1 || CLUSTERS.has(onset)) && coda.length <= 2;
}

function parse(value, type) {
  const items = [], errors = [], seen = new Set();
  const limit = type === 'letters' ? 29 : 100;
  if (typeof value !== 'string' || value.length > 6000) return { [type]: items, errors: [{ line: 1, message: 'Öğretmen içeriğini kısa düz metin olarak yazın.' }] };
  value.split(/\r?\n/u).forEach((line, index) => {
    for (const raw of line.split(/[\s,;·\-–—]+/u)) {
      if (!raw) continue;
      const item = lower(raw);
      const valid = type === 'letters' ? [...item].length === 1 && LETTER.has(item) : isTeacherSyllable(item);
      if (!valid) {
        errors.push({ line: index + 1, message: type === 'letters'
          ? 'Her harf, Türkçe alfabeden tek bir harf olmalı. Heceleri ayrı alana yazın.'
          : 'Her hecede tek bir ünlü olmalı ve hece Türkçe harflerle yazılmalı. Tek sessiz harfi harf alanına, çok heceli sözcüğü kelime alanına yazın.' });
        continue;
      }
      if (seen.has(item)) continue;
      if (items.length >= limit) { errors.push({ line: index + 1, message: `Bu alana en fazla ${limit} ${type === 'letters' ? 'harf' : 'hece'} eklenebilir.` }); continue; }
      seen.add(item); items.push(item);
    }
  });
  return { [type]: items, errors };
}

export const parseTeacherLetters = value => parse(value, 'letters');
export const parseTeacherSyllables = value => parse(value, 'syllables');
export const normalizeTeacherLetters = value => unique((Array.isArray(value) ? value : []).map(lower).filter(item => [...item].length === 1 && LETTER.has(item))).slice(0, 29);
export const normalizeTeacherSyllables = value => unique((Array.isArray(value) ? value : []).map(lower).filter(isTeacherSyllable)).slice(0, 100);

/** Input list must already have normalized word entries. Eligibility is based
 * on the selected taught-letter level, not on an invented starter fallback. */
export function teacherContentFromList(list, taughtLetters) {
  const selected = normalizeTeacherLetters(Array.isArray(taughtLetters) ? taughtLetters : [...String(taughtLetters || '')]);
  const known = new Set(selected);
  const explicitLetters = normalizeTeacherLetters(list?.letters);
  const suppliedSyllables = normalizeTeacherSyllables(list?.syllables);
  const missing = text => unique([...lower(text)].filter(letter => !known.has(letter)));
  const words = [], blockedWords = [];
  for (const source of Array.isArray(list?.words) ? list.words : []) {
    const word = { ...source, parts: [...(source.parts || [])] };
    const missingLetters = missing(word.text);
    if (missingLetters.length) blockedWords.push({ ...word, missingLetters }); else words.push(word);
  }
  const explicitSyllables = [], blockedSyllables = [];
  for (const text of suppliedSyllables) {
    const missingLetters = missing(text);
    if (missingLetters.length) blockedSyllables.push({ text, missingLetters }); else explicitSyllables.push(text);
  }
  const derivedSyllables = unique(words.flatMap(word => word.parts).filter(isTeacherSyllable));
  return {
    id: list?.id || '', title: list?.title || 'Öğretmenimin listesi',
    lettersProvided: explicitLetters.length > 0, explicitLetters,
    letters: (explicitLetters.length ? explicitLetters : selected).filter(letter => known.has(letter)),
    blockedLetters: explicitLetters.filter(letter => !known.has(letter)),
    suppliedSyllables, explicitSyllables, derivedSyllables,
    syllables: unique([...explicitSyllables, ...derivedSyllables]), blockedSyllables,
    words, blockedWords,
  };
}
