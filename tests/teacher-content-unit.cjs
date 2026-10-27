const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const sourceDir = path.resolve(__dirname, '../src');
const url = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const teacherURL = url(fs.readFileSync(path.join(sourceDir, 'teacher-content.js'), 'utf8'));
const teacher = import(teacherURL);
const selectionURL = url(fs.readFileSync(path.join(sourceDir, 'content-selection.js'), 'utf8'));
const learningURL = url(fs.readFileSync(path.join(sourceDir, 'learning-model.js'), 'utf8')
  .replace("'./content-selection.js'", JSON.stringify(selectionURL))
  .replace("'./teacher-content.js'", JSON.stringify(teacherURL)));
const learning = import(learningURL);
const NOW = Date.UTC(2026, 9, 27, 7);

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
