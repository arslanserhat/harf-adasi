import { ALPHABET, getEligibleWords, normalizeLearningState } from './learning-model.js';

const escape = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
const lower = value => String(value ?? '').normalize('NFC').toLocaleLowerCase('tr-TR');
const distinct = values => [...new Set(values)];
const semanticKey = word => word?.emoji ? `image:${word.emoji}` : word?.meaning ? `meaning:${lower(word.meaning).trim()}` : '';

/** The edited starter list is a teacher list too. Never infer provenance from its id. */
export function getTeacherLibrary(value, letters, catalogWords = []) {
  const state = normalizeLearningState(value);
  const list = state.lists.find(entry => entry.id === state.activeListId) || state.lists[0];
  const { eligible, blocked } = getEligibleWords(state, letters);
  const known = new Set((Array.isArray(letters) ? letters : []).map(lower).filter(letter => ALPHABET.includes(letter)));
  const enrich = word => {
    // An exact, curated picture is reusable. Unknown words receive no invented image or meaning.
    const familiar = catalogWords.find(entry => entry.text === word.text);
    return { ...word, parts: [...word.parts], emoji: word.emoji || familiar?.emoji || '', source: 'teacher' };
  };
  const words = eligible.map(enrich);
  const syllables = [];
  for (const word of words) for (const part of word.parts) {
    let entry = syllables.find(item => item.text === part);
    if (!entry) { entry = { text: part, parts: [part], words: [], source: 'teacher' }; syllables.push(entry); }
    if (!entry.words.includes(word.text)) entry.words.push(word.text);
  }
  const sentences = [], blockedSentences = [], seen = new Set();
  for (const word of words) {
    const sentence = word.sentence.trim();
    if (!sentence || seen.has(sentence)) continue;
    seen.add(sentence);
    const tokens = sentence.split(/\s+/u);
    if (tokens.length < 2 || tokens.length > 8 || sentence.length > 160) continue;
    if (!tokens.some(token => lower(token).replace(/[^abcçdefgğhıijklmnoöprsştuüvyz]/gu, '') === word.text)) continue;
    const missingLetters = distinct([...lower(sentence)].filter(letter => /\p{L}/u.test(letter) && !known.has(letter)));
    const entry = { text: sentence, word: word.text, source: 'teacher', missingLetters };
    if (missingLetters.length) blockedSentences.push(entry); else sentences.push(entry);
  }
  return { id: list.id, title: list.title, words, syllables, sentences,
    blocked: blocked.map(word => ({ ...enrich(word), missingLetters: [...word.missingLetters] })), blockedSentences };
}

/** A real semantic choice requires distinct pictures/meanings from the same selected source. */
export function getTeacherReadingOptions(word, pool) {
  if (!semanticKey(word)) return [];
  const seen = new Set(), options = [];
  for (const entry of [word, ...pool]) {
    const key = semanticKey(entry);
    if (!key || seen.has(key)) continue;
    seen.add(key); options.push({ ...entry, parts: [...(entry.parts || [])] });
    if (options.length === 3) break;
  }
  return options.length >= 2 ? options : [];
}

export function teacherSentenceKey(value) {
  let hash = 2166136261;
  for (const character of String(value).normalize('NFC')) hash = Math.imul(hash ^ character.codePointAt(0), 16777619);
  return `teacher-${(hash >>> 0).toString(36)}-${String(value).length}`;
}

const action = (name, label, attributes = '', className = 'teacher-library-action') => `<button type="button" class="${className}" data-do="${name}" ${attributes}>${label}</button>`;
const art = word => word.emoji ? `<span class="emoji" aria-hidden="true">${escape(word.emoji)}</span>` : `<span class="teacher-letter-token" aria-hidden="true">${escape(word.text[0])}</span>`;

export function renderTeacherLibrary(mode, library, { filter = 'all' } = {}) {
  const sentenceMode = mode === 'sentences', syllableMode = mode === 'syllables';
  let entries = sentenceMode ? library.sentences : syllableMode ? library.syllables : library.words;
  if (filter === 'short') entries = entries.filter(entry => sentenceMode ? entry.text.split(/\s+/u).length <= 2 : entry.text.length <= 3);
  const cards = entries.map(entry => {
    if (sentenceMode) return action('sentence', `<b>${escape(entry.text)}</b><small>Öğretmenimin cümlesi · Kartları sırala</small>`, `data-source="teacher" data-text="${escape(entry.text)}"`, 'item');
    const note = syllableMode ? entry.words.join(' · ') : mode === 'reading'
      ? entry.emoji || entry.meaning ? 'Oku ve anlamını bul' : 'Kelimeni kur ve yaz'
      : entry.parts.join(' · ');
    return action('word', `${syllableMode ? '<span class="teacher-letter-token" aria-hidden="true">' + escape(entry.text) + '</span>' : art(entry)}<b>${escape(entry.text)}</b><small>${escape(note)}</small>`, `data-source="teacher" data-text="${escape(entry.text)}"`, 'item');
  }).join('');
  const blocked = [...library.blocked, ...(sentenceMode ? library.blockedSentences : [])];
  const unavailable = blocked.length ? `<div class="teacher-library-blocked" data-teacher-blocked><b>Bu kartlar harflerini öğrendiğinde açılacak</b><ul>${blocked.map(entry => `<li><strong>${escape(entry.text)}</strong><span>Eksik harfler: ${entry.missingLetters.map(escape).join(' · ')}</span></li>`).join('')}</ul>${action('settings', 'Öğrendiğimiz harfleri düzenle')}</div>` : '';
  const emptyList = !library.words.length && !library.blocked.length;
  const empty = emptyList ? 'Bu listede henüz kelime yok. Öğretmeninin verdiği kelimeleri birlikte ekleyelim.' : sentenceMode ? 'Bu listedeki kelimeler için henüz uygun cümle yok. Bir büyüğün kelimenin ayrıntılarına 2–8 kelimelik bir cümle ekleyebilir.' : filter === 'short'
    ? 'Bu filtreye uygun kısa öğretmen kartı yok. Hepsi seçeneğinden diğer kelimelerine bakabilirsin.'
    : 'Bu listedeki kartlar seçili harflerle henüz açılamıyor. Eksik harfleri aşağıdan birlikte kontrol edelim.';
  return `<section class="teacher-library" data-teacher-library="${escape(mode)}"><div class="teacher-library-heading"><div><small>ÖĞRETMENİMİN LİSTESİ</small><h2>${escape(library.title)}</h2><p>${sentenceMode ? 'Öğretmeninin verdiği mesajları kelime kartlarıyla kur.' : syllableMode ? 'Bu heceler, aktif kelime listenden geliyor.' : 'Kendi kelimelerinle çalış; sonra macerada başka görevlerle yeniden hatırla.'}</p></div>${action('learning-parent', 'Listemi düzenle')}</div><div class="teacher-library-journey">${emptyList ? action('learning-parent', 'Öğretmenimin kelimelerini ekle') : action('quest-start', 'Bu kelimelerle maceraya çık →', `data-quest-kind="${escape(mode)}"`)}</div>${entries.length ? `<div class="grid ${sentenceMode ? 'sentences' : 'words'}">${cards}</div>` : `<p class="teacher-library-notice">${empty}</p>${sentenceMode && !emptyList ? action('learning-parent', 'Cümle ve anlam ekle') : ''}`}${unavailable}</section>`;
}

export function renderTeacherRoute(library, { kind = 'words', context = 'story' } = {}) {
  return `<aside class="teacher-route" data-teacher-route="${escape(context)}"><div><small>ÖĞRETMENİMİN KELİMELERİYLE</small><strong>${escape(library.title)}</strong><p>${library.words.length ? 'Listenin kelimeleriyle değişen görevler ve yeni teslimatlar seni bekliyor.' : 'Listeyi ve eksik okul harflerini birlikte düzenleyerek kendi maceranı hazırlayabilirsin.'}</p></div><div>${action('quest-start', 'Kendi kelimelerimle oyna →', `data-quest-kind="${escape(kind)}"`)}${action('learning-parent', 'Kelime listem')}</div></aside>`;
}
