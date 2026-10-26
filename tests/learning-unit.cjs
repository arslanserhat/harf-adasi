const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'learning-model.js'), 'utf8');
const api = import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const DAY = 86400000;
const NOW = Date.UTC(2026, 9, 26, 9);
const LETTERS = ['a', 'n', 'e', 't', 'i', 'l'];

function attempt(overrides = {}) {
  return { id: 'attempt-1', word: 'nane', skill: 'recall', correct: true, mistakes: 0, hints: 0,
    writingReviewed: false, independent: true, at: NOW, ...overrides };
}

test('Turkish normalization preserves dotless/dotted i and rejects invalid teacher input visibly', async () => {
  const { parseWordList } = await api;
  const result = parseWordList('NANE\nANNE\nIŞIK\nİNCİ\nİNCİ\nşeker\nhello-world\n<script>');
  assert.deepEqual(result.words.map(word => word.text), ['nane', 'anne', 'ışık', 'inci', 'şeker']);
  assert.deepEqual(result.errors.map(error => error.line), [7, 8]);
  assert.ok(result.errors.every(error => error.message));
  assert.deepEqual(parseWordList('nane, anne; lale').words.map(word => word.text), ['nane', 'anne', 'lale']);
});

test('syllable suggestions retain meaningful Turkish boundaries and are editable', async () => {
  const { splitSyllables, createLearningState, normalizeLearningState } = await api;
  for (const [word, parts] of [
    ['nane', ['na', 'ne']], ['anne', ['an', 'ne']], ['elma', ['el', 'ma']],
    ['okul', ['o', 'kul']], ['saat', ['sa', 'at']], ['elektrik', ['e', 'lek', 'trik']],
    ['Türkçe', ['türk', 'çe']], ['İLKOKUL', ['il', 'ko', 'kul']],
  ]) assert.deepEqual(splitSyllables(word), parts, word);
  const state = createLearningState(NOW);
  state.lists[0].words[0].parts = ['n', 'ane'];
  assert.deepEqual(normalizeLearningState(state).lists[0].words[0].parts, ['n', 'ane']);
  state.lists[0].words[0].parts = ['na', 'x'];
  assert.deepEqual(normalizeLearningState(state).lists[0].words[0].parts, ['na', 'ne']);
});

test('teacher lists and every selectable word respect taught letters', async () => {
  const { createLearningState, parseWordList, getEligibleWords, planSession } = await api;
  const state = createLearningState(NOW);
  state.lists = [{ id: 'school', title: 'Öğretmenin listesi', updatedAt: NOW, words: parseWordList('nane\nışık\nanne').words }];
  state.activeListId = 'school';
  const { eligible, blocked } = getEligibleWords(state, ['n', 'a', 'e']);
  assert.deepEqual(eligible.map(word => word.text), ['nane', 'anne']);
  assert.equal(blocked[0].text, 'ışık');
  assert.deepEqual(blocked[0].missingLetters, ['ı', 'ş', 'k']);
  const plan = planSession(state, ['n', 'a', 'e'], NOW);
  assert.ok(plan.tasks.every(task => ['nane', 'anne'].includes(task.word)));
  assert.ok(plan.tasks.filter(task => task.kind === 'listen').every(task => task.options.every(word => /^[nae]+$/.test(word))));
  assert.equal(plan.tasks.some(task => task.kind === 'sentence'), false, 'untaught l cannot be hidden inside an example sentence');
  assert.deepEqual(planSession(state, ['ü'], NOW).tasks, []);
});

test('a cold session connects several formats and revisits its word after intervening content', async () => {
  const { createLearningState, planSession } = await api;
  const plan = planSession(createLearningState(NOW), LETTERS, NOW);
  assert.equal(plan.tasks.length, 8);
  for (const kind of ['listen', 'syllables', 'build', 'recall', 'write']) assert.ok(plan.tasks.some(task => task.kind === kind), kind);
  const spelling = plan.tasks.find(task => task.word === 'nane' && task.kind === 'build');
  assert.deepEqual(spelling.tokens, ['n', 'a', 'n', 'e']);
  const heces = plan.tasks.find(task => task.word === 'nane' && task.kind === 'syllables');
  assert.deepEqual(heces.tokens, ['na', 'ne']);
  const recall = plan.tasks.findIndex(task => task.word === 'nane' && task.kind === 'recall');
  assert.ok(recall > 2);
  assert.ok(plan.tasks.slice(0, recall).some(task => task.word !== 'nane'));
  assert.equal(new Set(plan.tasks.map(task => task.id)).size, 8);
  assert.deepEqual(plan, planSession(createLearningState(NOW), LETTERS, NOW), 'planning is reproducible for the same observations and time');
});

test('mistakes, hints, unsupported correctness and unreviewed writing never grant independence', async () => {
  const { createLearningState, recordAttempt } = await api;
  for (const variation of [{ hints: 1 }, { mistakes: 1 }, { independent: false }, { correct: false }, { skill: 'write', writingReviewed: false }]) {
    const state = recordAttempt(createLearningState(NOW), attempt(variation), NOW);
    const result = state.progress.nane[variation.skill || 'recall'];
    assert.equal(result.independentSuccesses, 0);
    assert.equal(result.independentDays.length, 0);
    assert.equal(state.events[0].independent, false);
  }
  const reviewed = recordAttempt(createLearningState(NOW), attempt({ skill: 'write', writingReviewed: true }), NOW);
  assert.equal(reviewed.progress.nane.write.independentSuccesses, 1);
  assert.equal(reviewed.progress.nane.recall, undefined, 'writing never fabricates independent reading evidence');
});

test('one success stays an observation and repeated same-day completions cannot manufacture delayed recall', async () => {
  const { createLearningState, recordAttempt, summarizeLearning } = await api;
  let state = recordAttempt(createLearningState(NOW), attempt(), NOW);
  for (let index = 1; index <= 8; index++) state = recordAttempt(state, attempt({ id: `same-day-${index}`, at: NOW + index * 60000 }), NOW + index * 60000);
  assert.equal(state.progress.nane.recall.independentSuccesses, 9);
  assert.equal(state.progress.nane.recall.independentDays.length, 1);
  assert.equal(state.progress.nane.recall.intervalDays, 1);
  assert.equal(state.progress.nane.recall.nextDueAt, NOW + DAY);
  assert.equal(summarizeLearning(state, LETTERS, NOW).delayedWords, 0);
});

test('crossing midnight alone is not spaced retention', async () => {
  const { createLearningState, recordAttempt } = await api;
  const before = Date.UTC(2026, 9, 25, 23, 58);
  let state = recordAttempt(createLearningState(before), attempt({ at: before }), before);
  state = recordAttempt(state, attempt({ id: 'midnight', at: before + 300000 }), before + 300000);
  assert.equal(state.progress.nane.recall.independentDays.length, 1);
});

test('delayed independent recall is measured separately and a subsequent difficulty restores support', async () => {
  const { createLearningState, recordAttempt, summarizeLearning } = await api;
  let state = recordAttempt(createLearningState(NOW), attempt(), NOW);
  state = recordAttempt(state, attempt({ id: 'next-day', at: NOW + DAY }), NOW + DAY);
  let report = summarizeLearning(state, LETTERS, NOW + DAY);
  assert.equal(report.delayedWords, 1);
  assert.equal(report.words[0].skills.find(skill => skill.key === 'write').status, 'new');
  assert.equal(report.words[0].skills.find(skill => skill.key === 'recall').status, 'recalled-later');
  state = recordAttempt(state, attempt({ id: 'hard-again', hints: 1, at: NOW + DAY + 60000 }), NOW + DAY + 60000);
  report = summarizeLearning(state, LETTERS, NOW + DAY + 60000);
  assert.equal(report.delayedWords, 0);
  assert.equal(report.words[0].skills.find(skill => skill.key === 'recall').status, 'supported');
  assert.ok(state.progress.nane.recall.nextDueAt <= NOW + DAY + 11 * 60000);
});

test('the planner prioritizes due words and observed weak skills, and reduces support after practice', async () => {
  const { createLearningState, recordAttempt, planSession } = await api;
  let state = createLearningState(NOW);
  state = recordAttempt(state, attempt({ id: 'anne-needs-help', word: 'anne', skill: 'build', hints: 1, at: NOW - 3600000 }), NOW);
  let plan = planSession(state, LETTERS, NOW);
  assert.equal(plan.tasks[0].word, 'anne');
  assert.equal(plan.tasks[0].kind, 'build');
  assert.equal(plan.tasks[0].support, 2);
  state = recordAttempt(state, attempt({ id: 'anne-more-practice', word: 'anne', skill: 'build', hints: 1, at: NOW }), NOW);
  plan = planSession(state, LETTERS, NOW + 600000);
  assert.equal(plan.tasks[0].word, 'anne');
  assert.equal(plan.tasks[0].support, 1, 'the child gets a model-free opportunity after supported practice');
  state = recordAttempt(state, attempt({ id: 'anne-independent', word: 'anne', skill: 'build', at: NOW + 600000 }), NOW + 600000);
  assert.equal(state.progress.anne.build.independentSuccesses, 1);
});

test('retries are idempotent and observations survive normalization and bounded history', async () => {
  const { createLearningState, recordAttempt, normalizeLearningState } = await api;
  let state = recordAttempt(createLearningState(NOW), attempt(), NOW);
  state = recordAttempt(state, attempt(), NOW);
  assert.equal(state.events.length, 1);
  assert.equal(state.progress.nane.recall.attempts, 1);
  assert.deepEqual(normalizeLearningState(normalizeLearningState(state, NOW), NOW), normalizeLearningState(state, NOW));
  for (let index = 1; index <= 505; index++) state = recordAttempt(state, attempt({ id: `bounded-${index}`, at: NOW + index }), NOW + index);
  assert.equal(state.events.length, 500);
  assert.equal(state.progress.nane.recall.attempts, 506, 'bounded logs retain cumulative observations');
  state = recordAttempt(state, attempt({ id: 'bounded-505', at: NOW + 505 }), NOW + 505);
  assert.equal(state.progress.nane.recall.attempts, 506);
});

test('session progress, intro, adult review draft and bounded writing are resumable', async () => {
  const { createLearningState, planSession, normalizeLearningState } = await api;
  const state = createLearningState(NOW);
  state.session = planSession(state, LETTERS, NOW);
  state.session.storySeen = true;
  state.session.index = 6;
  state.session.paused = true;
  const id = state.session.tasks[6].id;
  state.session.results[id] = { correct: false, hints: 2, mistakes: 1, modelOpened: true, independent: false,
    inkPaths: ['M10 20 L30 40', 'M0 0 L640 300', 'M10 20 <script>', 'M-1 0 L20 20', 'M10 20 L900 300'] };
  const restored = normalizeLearningState(JSON.parse(JSON.stringify(state)), NOW);
  assert.equal(restored.session.storySeen, true);
  assert.equal(restored.session.index, 6);
  assert.equal(restored.session.paused, true);
  assert.equal(restored.session.results[id].modelOpened, true);
  assert.deepEqual(restored.session.results[id].inkPaths, ['M10 20 L30 40', 'M0 0 L640 300']);
});

test('merging a retry deduplicates events and preserves local list edits and session', async () => {
  const { createLearningState, recordAttempt, planSession, mergeLearningStates } = await api;
  let remote = recordAttempt(createLearningState(NOW), attempt(), NOW);
  let local = recordAttempt(remote, attempt({ id: 'local-build', skill: 'build', at: NOW + 1000 }), NOW + 1000);
  local.lists[0].title = 'Öğretmenimin listesi';
  local.session = planSession(local, LETTERS, NOW + 1000);
  local.session.index = 2;
  const merged = mergeLearningStates(local, remote, NOW + 1000);
  assert.equal(merged.lists[0].title, 'Öğretmenimin listesi');
  assert.equal(merged.session.index, 2);
  assert.equal(merged.events.length, 2);
  assert.equal(merged.progress.nane.recall.attempts, 1);
  assert.equal(merged.progress.nane.build.attempts, 1);
  assert.deepEqual(mergeLearningStates(merged, remote, NOW + 1000), merged);
});

test('concurrent recent observations of the same skill merge without disappearing or awarding twice', async () => {
  const { createLearningState, recordAttempt, mergeLearningStates } = await api;
  const initial = createLearningState(NOW);
  const local = recordAttempt(initial, attempt({ id: 'tab-a', skill: 'build', hints: 1, at: NOW + 1000 }), NOW + 1000);
  const remote = recordAttempt(initial, attempt({ id: 'tab-b', skill: 'build', at: NOW + 2000 }), NOW + 2000);
  const combined = mergeLearningStates(local, remote, NOW + 2000);
  assert.equal(combined.events.length, 2);
  assert.equal(combined.progress.nane.build.attempts, 2);
  assert.equal(combined.progress.nane.build.assistedSuccesses, 1);
  assert.equal(combined.progress.nane.build.independentSuccesses, 1);
  assert.deepEqual(mergeLearningStates(combined, remote, NOW + 2000), combined);
});

test('invalid snapshots recover safely without accepting identity or fabricated task kinds', async () => {
  const { createLearningState, normalizeLearningState, planSession } = await api;
  for (const value of [null, [], 'bad', { version: 7 }]) assert.equal(normalizeLearningState(value, NOW).activeListId, 'starter');
  const state = createLearningState(NOW);
  state.browser_id = 'someone-else';
  state.session = planSession(state, LETTERS, NOW);
  state.session.tasks[0].kind = '<script>';
  state.events = [{ id: '__proto__', word: '__proto__', skill: 'recall' }];
  const safe = normalizeLearningState(state, NOW);
  assert.equal(safe.browser_id, undefined);
  assert.equal(safe.events.length, 0);
  assert.equal(safe.session.tasks.length, 7);
});

test('word and result identifiers cannot mutate JavaScript prototypes', async () => {
  const { createLearningState, recordAttempt, planSession, normalizeLearningState } = await api;
  const state = recordAttempt(createLearningState(NOW), attempt({ word: 'constructor' }), NOW);
  assert.equal(state.progress.constructor.recall.attempts, 1);
  assert.equal(Object.recall, undefined);
  state.session = planSession(state, LETTERS, NOW);
  state.session.tasks[0].id = '__proto__';
  state.session.results = JSON.parse('{"__proto__":{"correct":true,"hints":0,"mistakes":0,"independent":true}}');
  const result = normalizeLearningState(state, NOW);
  assert.equal(Object.getPrototypeOf(result.progress), null);
  assert.equal(Object.getPrototypeOf(result.session.results), null);
  assert.equal(result.session.results.__proto__.correct, true);
});

test('due letter writing returns inside the connected journey without introducing untaught letters', async () => {
  const { createLearningState, recordAttempt, planSession } = await api;
  let state = createLearningState(NOW - DAY);
  state = recordAttempt(state, attempt({ id: 'letter-n-write', word: 'n', skill: 'write', writingReviewed: true, at: NOW - DAY }), NOW - DAY);
  const plan = planSession(state, LETTERS, NOW);
  assert.equal(plan.tasks.length, 8);
  assert.equal(plan.tasks[4].word, 'n');
  assert.equal(plan.tasks[4].kind, 'write');
  assert.equal(plan.tasks[4].target, 'n');
  assert.deepEqual(plan.tasks[4].parts, ['n']);
  assert.ok(plan.tasks.some(task => task.word === 'anne'));
  assert.ok(plan.tasks.some(task => task.word === 'nane' && task.kind === 'recall'));
  const withoutN = planSession(state, ['a', 'e', 'l', 't', 'i'], NOW);
  assert.ok(withoutN.tasks.length);
  assert.equal(withoutN.tasks.some(task => task.word === 'n'), false);
});

test('due letter selection supplies actual known-letter distractors and remains separate from phonics', async () => {
  const { createLearningState, recordAttempt, planSession, summarizeLearning } = await api;
  let state = recordAttempt(createLearningState(NOW - DAY), attempt({ id: 'letter-selection', word: 'n', skill: 'build', at: NOW - DAY }), NOW - DAY);
  const task = planSession(state, LETTERS, NOW).tasks[4];
  assert.equal(task.word, 'n');
  assert.equal(task.kind, 'build');
  assert.deepEqual(task.tokens, ['n']);
  assert.ok(task.options.length >= 2);
  assert.ok(task.options.includes('n'));
  assert.ok(task.options.every(letter => LETTERS.includes(letter)));
  const report = summarizeLearning(state, LETTERS, NOW);
  const letter = report.letterRows.find(row => row.letter === 'n');
  assert.equal(letter.skills.find(skill => skill.key === 'build').attempts, 1);
  assert.equal(letter.skills.some(skill => skill.key === 'listen'), false);
  assert.equal(letter.due, true);
});

test('letter retention is based on delayed reviewed writing and is reported separately from words', async () => {
  const { createLearningState, recordAttempt, summarizeLearning } = await api;
  let state = recordAttempt(createLearningState(NOW), attempt({ id: 'letter-day-one', word: 'n', skill: 'write', writingReviewed: true }), NOW);
  state = recordAttempt(state, attempt({ id: 'letter-day-two', word: 'n', skill: 'write', writingReviewed: true, at: NOW + DAY }), NOW + DAY);
  const report = summarizeLearning(state, ['a', 'n'], NOW + DAY);
  assert.deepEqual(report.letterRows.map(row => row.letter), ['a', 'n']);
  assert.equal(report.letterRows.find(row => row.letter === 'n').status, 'recalled-later');
  assert.equal(report.delayedLetters, 1);
  assert.equal(report.delayedWords, 0);
  assert.equal(report.words.find(row => row.text === 'nane').status, 'new');
});

test('distinct teacher lists created concurrently survive a conflict merge', async () => {
  const { createLearningState, parseWordList, planSession, mergeLearningStates } = await api;
  const local = createLearningState(NOW);
  local.lists.push({ id: 'teacher-a', title: 'Pazartesi', words: parseWordList('nane\nanne').words, updatedAt: NOW + 1000 });
  local.activeListId = 'teacher-a'; local.updatedAt = NOW + 1000;
  const remote = createLearningState(NOW);
  remote.lists.push({ id: 'teacher-b', title: 'Salı', words: parseWordList('lale\ntane').words, updatedAt: NOW + 2000 });
  remote.activeListId = 'teacher-b'; remote.updatedAt = NOW + 2000;
  remote.session = planSession(remote, LETTERS, NOW + 2000);
  remote.session.index = 3;
  const merged = mergeLearningStates(local, remote, NOW + 2000);
  assert.deepEqual(new Set(merged.lists.map(list => list.id)), new Set(['starter', 'teacher-a', 'teacher-b']));
  assert.equal(merged.activeListId, 'teacher-b');
  assert.equal(merged.session.index, 3);
  assert.equal(merged.session.id, remote.session.id);
  assert.deepEqual(mergeLearningStates(merged, local, NOW + 2000), merged);
});

test('same-list conflict keeps the newest list edit even if another tab practiced more recently', async () => {
  const { createLearningState, parseWordList, mergeLearningStates } = await api;
  const local = createLearningState(NOW);
  local.lists[0] = { id: 'starter', title: 'Öğretmenin yeni listesi', words: parseWordList('nane\nlale').words, updatedAt: NOW + 4000 };
  local.updatedAt = NOW + 4000;
  const remote = createLearningState(NOW);
  remote.lists[0] = { id: 'starter', title: 'Eski liste', words: parseWordList('anne').words, updatedAt: NOW + 2000 };
  remote.updatedAt = NOW + 6000;
  const merged = mergeLearningStates(local, remote, NOW + 6000);
  assert.equal(merged.lists[0].title, 'Öğretmenin yeni listesi');
  assert.deepEqual(merged.lists[0].words.map(word => word.text), ['nane', 'lale']);
  assert.equal(merged.updatedAt, remote.updatedAt);
});

test('a long teacher sentence cannot create an impossible or server-incompatible token task', async () => {
  const { createLearningState, planSession, normalizeLearningState } = await api;
  const state = createLearningState(NOW);
  state.lists[0].words[0].sentence = `nane ${Array(41).fill('a').join(' ')}.`;
  const plan = planSession(state, LETTERS, NOW);
  assert.equal(plan.tasks.length, 8);
  assert.equal(plan.tasks.some(task => task.kind === 'sentence'), false);
  assert.ok(plan.tasks.every(task => task.tokens.length <= 40));
  assert.ok(plan.tasks.some(task => task.kind === 'meaning' || task.kind === 'recall'));
  state.session = plan;
  state.session.tasks[0].tokens = Array(60).fill('a');
  assert.equal(normalizeLearningState(state, NOW).session.tasks[0].tokens.length, 40);
});
