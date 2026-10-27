const { test } = require('node:test');
const assert = require('node:assert/strict');
const { modelURL } = require('./model-loader.cjs');
const teacher = import(modelURL('teacher-content.js'));
const learning = import(modelURL('learning-model.js'));
const NOW = Date.UTC(2026, 9, 27, 7);

test('teacher sentences normalize typographic spaces while preserving line boundaries and rejecting controls', async () => {
  const { parseTeacherSentences, normalizeTeacherSentences } = await teacher;
  const result = parseTeacherSentences('Anne\u00a0\u202fnane al.\nİnal\u2007anten al.');
  assert.deepEqual(result, { sentences: ['Anne nane al.', 'İnal anten al.'], errors: [] });
  assert.deepEqual(normalizeTeacherSentences(['Anne\u00a0nane al.', 'Anne\nnane al.', '\u2028Anne nane al.', 'Anne\u200bnane al.', '\tAnne nane al.']), ['Anne nane al.']);
  assert.equal(parseTeacherSentences('Anne\tnane al.').errors.length, 1);
});

test('teacher letters normalize Turkish case and NFC without conflating dotted and dotless i', async () => {
  const { parseTeacherLetters } = await teacher;
  const parsed = parseTeacherLetters('A N E\nI İ C\u0327 Ş Ğ a');
  assert.deepEqual(parsed.letters, ['a', 'n', 'e', 'ı', 'i', 'ç', 'ş', 'ğ']);
  assert.deepEqual(parsed.errors, []);
  const invalid = parseTeacherLetters('an\nx q w\n<script>');
  assert.deepEqual(invalid.letters, []);
  assert.deepEqual([...new Set(invalid.errors.map(item => item.line))], [1, 2, 3]);
});

test('valid independent syllables need no invented vocabulary word', async () => {
  const { parseTeacherSyllables } = await teacher;
  const parsed = parseTeacherSyllables('NA-ne; an\nin let tren renk ğaç İN');
  assert.deepEqual(parsed.syllables, ['na', 'ne', 'an', 'in', 'let', 'tren', 'renk', 'ğaç']);
  assert.deepEqual(parsed.errors, []);
});

test('consonants, multi-syllable words, malformed clusters and foreign letters receive visible errors', async () => {
  const { parseTeacherSyllables } = await teacher;
  const parsed = parseTeacherSyllables('n tr\nsaat anne\nbma xan\n<script>');
  assert.deepEqual(parsed.syllables, []);
  assert.deepEqual([...new Set(parsed.errors.map(item => item.line))], [1, 2, 3, 4]);
  assert.ok(parsed.errors.every(item => item.message.includes('ünlü')));
});

test('teacher syllables deduplicate and retain the existing finite 100-unit bound', async () => {
  const { parseTeacherSyllables, normalizeTeacherSyllables, normalizeTeacherLetters } = await teacher;
  const units = [...'bcçdfghjklmnprsştvyz'].flatMap(letter => [...'aeıioöuü'].map(vowel => letter + vowel));
  const parsed = parseTeacherSyllables(units.join('\n'));
  assert.equal(parsed.syllables.length, 100);
  assert.ok(parsed.errors.length > 0);
  assert.deepEqual(normalizeTeacherSyllables(['NA', 'na', 'tr', 'x', null, 'an']), ['na', 'an']);
  assert.deepEqual(normalizeTeacherLetters(['I', 'İ', 'ı', 'i', '<', 'an']), ['ı', 'i']);
});

test('explicit teacher letters define a focus pool while the taught level blocks unknown letters', async () => {
  const { teacherContentFromList } = await teacher;
  const content = teacherContentFromList({ id: 'week', title: 'Hafta', letters: ['a', 'ş'], syllables: ['na', 'ne', 'şen'], words: [] }, ['a', 'n', 'e']);
  assert.deepEqual(content.letters, ['a']);
  assert.deepEqual(content.blockedLetters, ['ş']);
  assert.deepEqual(content.explicitSyllables, ['na', 'ne']);
  assert.deepEqual(content.blockedSyllables, [{ text: 'şen', missingLetters: ['ş'] }]);
  assert.deepEqual(content.words, [], 'bare syllables are never inserted into the vocabulary list');
});

test('an empty explicit-letter field uses the selected level and never adds unlearned letters', async () => {
  const { teacherContentFromList } = await teacher;
  const content = teacherContentFromList({ words: [], letters: [], syllables: [] }, ['a', 'n', 'e', 'x']);
  assert.equal(content.lettersProvided, false);
  assert.deepEqual(content.letters, ['a', 'n', 'e']);
  assert.deepEqual(content.syllables, []);
  assert.deepEqual(content.words, []);
});

test('independent and real word-derived syllables share a pool without overwriting teacher edits', async () => {
  const { teacherContentFromList } = await teacher;
  const list = { id: 'week', title: 'Hafta', letters: [], syllables: ['na', 'an'], words: [
    { text: 'anne', parts: ['an', 'ne'], meaning: '', sentence: '', emoji: '' },
    { text: 'nane', parts: ['n', 'ane'], meaning: '', sentence: '', emoji: '' },
    { text: 'ışık', parts: ['ı', 'şık'], meaning: '', sentence: '', emoji: '' },
  ] };
  const before = JSON.stringify(list);
  const content = teacherContentFromList(list, ['a', 'n', 'e']);
  assert.deepEqual(content.syllables, ['na', 'an', 'ne']);
  assert.deepEqual(content.words.find(word => word.text === 'nane').parts, ['n', 'ane']);
  assert.deepEqual(content.blockedWords[0].missingLetters, ['ı', 'ş', 'k']);
  assert.equal(JSON.stringify(list), before, 'eligibility never mutates the teacher input');
});

test('old snapshots migrate optional unit fields without replacing an empty teacher vocabulary', async () => {
  const { createLearningState, normalizeLearningState, getTeacherContent, getEligibleWords } = await learning;
  const state = createLearningState(NOW);
  state.lists = [{ id: 'standalone', title: 'Bağımsız heceler', updatedAt: NOW, words: [], letters: ['İ', 'I'], syllables: ['İN', 'ın', 'tr'] }];
  state.activeListId = 'standalone';
  const normalized = normalizeLearningState(state, NOW);
  assert.deepEqual(normalized.lists[0].letters, ['i', 'ı']);
  assert.deepEqual(normalized.lists[0].syllables, ['in', 'ın']);
  assert.deepEqual(getEligibleWords(normalized, ['i', 'ı', 'n']).eligible, []);
  assert.deepEqual(getTeacherContent(normalized, ['i', 'ı', 'n']).explicitSyllables, ['in', 'ın']);
  delete state.lists[0].letters; delete state.lists[0].syllables;
  const old = normalizeLearningState(state, NOW);
  assert.deepEqual(old.lists[0].letters, []);
  assert.deepEqual(old.lists[0].syllables, []);
  assert.deepEqual(old.lists[0].words, []);
});

test('list conflict resolution retains typed teacher units from the actual newer list', async () => {
  const { createLearningState, mergeLearningStates } = await learning;
  const older = createLearningState(NOW);
  older.lists[0].letters = ['a']; older.lists[0].syllables = ['na'];
  const newer = structuredClone(older);
  newer.lists[0].updatedAt = NOW + 1000;
  newer.lists[0].letters = ['n', 'e']; newer.lists[0].syllables = ['ne', 'en'];
  const merged = mergeLearningStates(older, newer, NOW + 2000);
  assert.deepEqual(merged.lists[0].letters, ['n', 'e']);
  assert.deepEqual(merged.lists[0].syllables, ['ne', 'en']);
});

test('independent teacher sentences preserve Turkish capitals and punctuation while rejecting unsafe or oversized lines', async () => {
  const { parseTeacherSentences } = await teacher;
  assert.equal(typeof parseTeacherSentences, 'function');
  const result = parseTeacherSentences('  Anne  elinle nane at.\nİnal anten al.\nİNAL ANTEN AL.\nLale tane tane anlat.\n<script>\nX al.\n' + 'a'.repeat(241));
  assert.deepEqual(result.sentences, ['Anne elinle nane at.', 'İnal anten al.', 'Lale tane tane anlat.']);
  assert.deepEqual(result.errors.map(error => error.line), [5, 6, 7]);
  const bounded = parseTeacherSentences(Array.from({ length: 101 }, (_, index) => `Anne ${index} tane al.`).join('\n'));
  assert.equal(bounded.sentences.length, 100); assert.equal(bounded.errors.length, 1);
});

test('sentence-only teacher lists survive normalization and block untaught letters without inventing vocabulary', async () => {
  const { createLearningState, normalizeLearningState, getTeacherContent } = await learning;
  const state = createLearningState(NOW);
  state.lists = [{ id: 'sentences', title: 'Ders cümleleri', updatedAt: NOW, words: [], sentences: ['İnal anten al.', 'Lale tane tane anlat.', 'Şal al.'] }];
  state.activeListId = 'sentences';
  const saved = normalizeLearningState(JSON.parse(JSON.stringify(state)), NOW);
  assert.deepEqual(saved.lists[0].sentences, ['İnal anten al.', 'Lale tane tane anlat.', 'Şal al.']);
  assert.deepEqual(saved.lists[0].words, []);
  const content = getTeacherContent(saved, ['a', 'n', 'e', 't', 'i', 'l']);
  assert.deepEqual(content.sentences, ['İnal anten al.', 'Lale tane tane anlat.']);
  assert.deepEqual(content.blockedSentences, [{ text: 'Şal al.', missingLetters: ['ş'] }]);
  assert.deepEqual(normalizeLearningState(saved, NOW), saved);
});

test('teacher sentence cards contain only explicitly saved lines and never word-linked examples', async () => {
  const { getTeacherLibrary } = await import(require('./model-loader.cjs').modelURL('teacher-library.js'));
  const { createLearningState } = await learning;
  const state = createLearningState(NOW);
  state.lists[0].sentences = ['İnal, anten al!', 'Lale tane tane anlat.'];
  state.lists[0].words = [{ text: 'nane', sentence: 'Anne nane al.' }, { text: 'at', sentence: 'Şal at.' }];
  const library = getTeacherLibrary(state, ['a', 'n', 'e', 't', 'i', 'l']);
  assert.deepEqual(library.sentences.map(entry => entry.text), ['İnal, anten al!', 'Lale tane tane anlat.']);
  assert.deepEqual(library.blockedSentences, [], 'unrelated word examples must not appear as blocked sentence cards either');
  assert.equal(library.words[0].sentence, 'Anne nane al.', 'word context remains available to its existing consumers');
});

test('empty or older teacher sentence fields stay empty and offer the sentence editor', async () => {
  const { JSDOM } = require('jsdom');
  const { getTeacherLibrary, renderTeacherLibrary } = await import(modelURL('teacher-library.js'));
  const { createLearningState } = await learning;
  for (const missing of [false, true]) {
    const state = createLearningState(NOW);
    if (missing) delete state.lists[0].sentences; else state.lists[0].sentences = [];
    const library = getTeacherLibrary(state, [...'abcçdefgğhıijklmnoöprsştuüvyz']);
    assert.deepEqual(library.sentences, []);
    assert.deepEqual(library.blockedSentences, []);
    const dom = new JSDOM(renderTeacherLibrary('sentences', library));
    try {
      assert.equal(dom.window.document.querySelector('[data-do="sentence"]'), null);
      assert.equal(dom.window.document.querySelector('[data-do="practice-next"]'), null);
      assert.ok(dom.window.document.querySelector('[data-do="learning-parent"]'));
      assert.match(dom.window.document.querySelector('.teacher-library-notice').textContent, /henüz cümle yok/u);
    } finally { dom.window.close(); }
  }
});

test('saving the five photo lesson sentences beside starter vocabulary renders exactly those five cards', async () => {
  const { JSDOM } = require('jsdom');
  const { TEACHER_SENTENCE_PRESET } = await teacher;
  const { createLearningState } = await learning;
  const { getTeacherLibrary, renderTeacherLibrary } = await import(modelURL('teacher-library.js'));
  const state = createLearningState(NOW);
  state.lists[0].sentences = [...TEACHER_SENTENCE_PRESET];
  assert.equal(new Set(state.lists[0].words.map(word => word.sentence).filter(Boolean)).size, 3, 'the former three automatic examples are present in word context');
  const library = getTeacherLibrary(state, ['a', 'n', 'e', 't', 'i', 'l']);
  assert.deepEqual(library.sentences.map(entry => entry.text), [...TEACHER_SENTENCE_PRESET]);
  const dom = new JSDOM(renderTeacherLibrary('sentences', library));
  try {
    assert.deepEqual([...dom.window.document.querySelectorAll('[data-do="sentence"]')].map(card => card.dataset.text), [...TEACHER_SENTENCE_PRESET]);
  } finally { dom.window.close(); }
});
