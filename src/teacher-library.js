import { ALPHABET, getTeacherContent } from './learning-model.js';

const escape = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
const lower = value => String(value ?? '').normalize('NFC').toLocaleLowerCase('tr-TR');
const distinct = values => [...new Set(values)];
const semanticKey = word => word?.emoji ? `image:${word.emoji}` : word?.meaning ? `meaning:${lower(word.meaning).trim()}` : '';

/** The edited starter list is a teacher list too. Never infer provenance from its id. */
export function getTeacherLibrary(value, letters, catalogWords = []) {
  const teacher = getTeacherContent(value, letters);
  const eligible = teacher.words, blocked = teacher.blockedWords;
  const known = new Set((Array.isArray(letters) ? letters : []).map(lower).filter(letter => ALPHABET.includes(letter)));
  const enrich = word => {
    // An exact, curated picture is reusable. Unknown words receive no invented image or meaning.
    const familiar = catalogWords.find(entry => entry.text === word.text);
    return { ...word, parts: [...word.parts], emoji: word.emoji || (familiar?.read === false ? '' : familiar?.emoji) || '', source: 'teacher' };
  };
  const words = eligible.map(enrich);
  const syllables = teacher.syllables.map(text => ({ text, parts: [text], words: [], source: 'teacher', independent: teacher.explicitSyllables.includes(text) }));
  for (const word of words) for (const part of word.parts) {
    let entry = syllables.find(item => item.text === part);
    if (!entry) continue;
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
  return { id: teacher.id, title: teacher.title, words, syllables, sentences,
    letters: [...teacher.letters], lettersProvided: teacher.lettersProvided,
    blockedLetters: [...teacher.blockedLetters], blockedSyllables: teacher.blockedSyllables.map(entry => ({ ...entry, missingLetters: [...entry.missingLetters] })),
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

export function renderTeacherLibrary(mode, library, { filter = 'all', caps = false } = {}) {
  const sentenceMode = mode === 'sentences', syllableMode = mode === 'syllables', letterMode = mode === 'letters';
  let entries = letterMode ? library.letters.map(text => ({ text })) : sentenceMode ? library.sentences : syllableMode ? library.syllables : library.words;
  if (filter === 'short') entries = entries.filter(entry => sentenceMode ? entry.text.split(/\s+/u).length <= 2 : entry.text.length <= 3);
  const cards = entries.map(entry => {
    if (letterMode) {
      const letter = caps ? entry.text.toLocaleUpperCase('tr-TR') : entry.text;
      return action('letter', `<b>${escape(letter)}</b><small>${escape(entry.text.toLocaleUpperCase('tr-TR'))} · ${escape(entry.text)}</small>`, `data-source="teacher" data-letter="${escape(letter)}"`, 'item');
    }
    if (sentenceMode) return action('sentence', `<b>${escape(entry.text)}</b><small>Öğretmenimin cümlesi · Kartları sırala</small>`, `data-source="teacher" data-text="${escape(entry.text)}"`, 'item');
    const note = syllableMode ? entry.words.length ? entry.words.join(' · ') : 'Öğretmenimin hecesi' : mode === 'reading'
      ? entry.emoji || entry.meaning ? 'Oku ve anlamını bul' : 'Kelimeni kur ve yaz'
      : entry.parts.join(' · ');
    return action('word', `${syllableMode ? '<span class="teacher-letter-token" aria-hidden="true">' + escape(entry.text) + '</span>' : art(entry)}<b>${escape(entry.text)}</b><small>${escape(note)}</small>`, `data-source="teacher" data-text="${escape(entry.text)}"`, 'item');
  }).join('');
  const blocked = letterMode ? library.blockedLetters.map(text => ({ text, missingLetters: [text] }))
    : [...library.blocked, ...(syllableMode ? library.blockedSyllables : []), ...(sentenceMode ? library.blockedSentences : [])];
  const unavailable = blocked.length ? `<div class="teacher-library-blocked" data-teacher-blocked><b>Bu kartlar harflerini öğrendiğinde açılacak</b><ul>${blocked.map(entry => `<li><strong>${escape(entry.text)}</strong><span>Eksik harfler: ${entry.missingLetters.map(escape).join(' · ')}</span></li>`).join('')}</ul>${action('settings', 'Öğrendiğimiz harfleri düzenle')}</div>` : '';
  const emptyList = !entries.length && !blocked.length;
  const empty = emptyList ? `Bu listede henüz ${letterMode ? 'harf' : syllableMode ? 'hece' : 'kelime'} yok. Öğretmeninin verdiklerini birlikte ekleyelim.` : sentenceMode ? 'Bu listedeki kelimeler için henüz uygun cümle yok. Bir büyüğün kelimenin ayrıntılarına 2–8 kelimelik bir cümle ekleyebilir.' : filter === 'short'
    ? 'Bu filtreye uygun kısa öğretmen kartı yok. Hepsi seçeneğinden diğer kelimelerine bakabilirsin.'
    : 'Bu listedeki kartlar seçili harflerle henüz açılamıyor. Eksik harfleri aşağıdan birlikte kontrol edelim.';
  return `<section class="teacher-library" data-teacher-library="${escape(mode)}"><div class="teacher-library-heading"><div><small>ÖĞRETMENİMİN LİSTESİ</small><h2>${escape(library.title)}</h2><p>${letterMode ? library.lettersProvided ? 'Öğretmeninin bu liste için verdiği harfler.' : 'Okulda öğrendiğin harflerle tek tek çalış.' : sentenceMode ? 'Öğretmeninin verdiği mesajları kelime kartlarıyla kur.' : syllableMode ? 'Öğretmeninin heceleri ve kelimelerinin gerçek parçaları.' : 'Kendi kelimelerinle çalış; sonra macerada başka görevlerle yeniden hatırla.'}</p></div>${action('learning-parent', 'Listemi düzenle')}</div><div class="teacher-library-journey">${emptyList ? action('learning-parent', 'Öğretmenimin verdiklerini ekle') : `${action('practice-next', 'Bana sıradaki kartı seç →', `data-view="${escape(mode)}" data-source="teacher"`)}${action('quest-start', 'Bu kartlarla maceraya çık →', `data-quest-kind="${escape(mode)}"`)}`}</div>${entries.length ? `<div class="grid ${sentenceMode ? 'sentences' : letterMode ? 'letters' : 'words'}">${cards}</div>` : `<p class="teacher-library-notice">${empty}</p>${sentenceMode && !emptyList ? action('learning-parent', 'Cümle ve anlam ekle') : ''}`}${unavailable}</section>`;
}

export function renderTeacherRoute(library, { kind = 'words', context = 'story' } = {}) {
  return `<aside class="teacher-route" data-teacher-route="${escape(context)}"><div><small>ÖĞRETMENİMİN KELİMELERİYLE</small><strong>${escape(library.title)}</strong><p>${library.words.length ? 'Listenin kelimeleriyle değişen görevler ve yeni teslimatlar seni bekliyor.' : 'Listeyi ve eksik okul harflerini birlikte düzenleyerek kendi maceranı hazırlayabilirsin.'}</p></div><div>${action('quest-start', 'Kendi kelimelerimle oyna →', `data-quest-kind="${escape(kind)}"`)}${action('learning-parent', 'Kelime listem')}</div></aside>`;
}
