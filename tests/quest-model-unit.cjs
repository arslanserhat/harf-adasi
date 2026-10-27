const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const directory = path.resolve(__dirname, '..', 'src');
const learningURL = `data:text/javascript;base64,${Buffer.from(fs.readFileSync(path.join(directory, 'learning-model.js'), 'utf8')).toString('base64')}`;
const questSource = fs.readFileSync(path.join(directory, 'quest-model.js'), 'utf8').replace("'./learning-model.js'", JSON.stringify(learningURL));
const questAPI = import(`data:text/javascript;base64,${Buffer.from(questSource).toString('base64')}`);
const learningAPI = import(learningURL);
const NOW = Date.UTC(2026, 9, 26, 12);
const LETTERS = ['a', 'n', 'e', 't', 'i', 'l'];
const KINDS = ['letters', 'syllables', 'words', 'reading', 'sentences', 'numbers'];

async function custom(words) {
  const { createLearningState } = await learningAPI;
  const state = createLearningState(NOW);
  state.lists = [{ id: 'school', title: 'Öğretmenim', updatedAt: NOW, words }];
  state.activeListId = 'school';
  return state;
}
function completed(kind, overrides = {}) {
  return { id: `done-${kind}`, kind, completed: true, completedStages: 6, totalStages: 6, completedAt: NOW,
    wordTexts: ['nane', 'anne'], results: Array.from({ length: 6 }, () => ({ correct: true })), ...overrides };
}

test('each world has a different real six-action circuit and a bounded string-based schema', async () => {
  const { buildQuestPlan, QUEST_KINDS } = await questAPI;
  const { createLearningState, SKILLS } = await learningAPI;
  assert.deepEqual(QUEST_KINDS.map(kind => kind.id), KINDS);
  const fingerprints = [];
  for (const kind of KINDS) {
    const plan = buildQuestPlan(kind, { learningState: createLearningState(NOW), letters: LETTERS });
    assert.equal(plan.available, true, `${kind}: ${plan.reason}`);
    assert.equal(plan.stages.length, 6);
    assert.equal(new Set(plan.stages.map(stage => stage.id)).size, 6);
    assert.ok(plan.goal && plan.story);
    for (const stage of plan.stages) {
      assert.equal(typeof stage.target, 'string');
      assert.ok(stage.prompt.trim());
      assert.ok(stage.skill === null || SKILLS.includes(stage.skill));
      assert.equal(typeof stage.model, 'string');
      assert.equal(typeof stage.guided, 'boolean');
      assert.ok(stage.tokens.every(token => typeof token === 'string'));
      assert.equal(new Set(stage.options.map(option => option.value)).size, stage.options.length);
      if (stage.options.length) assert.ok(stage.options.some(option => option.value === stage.target), 'the actual answer is selectable');
      if (stage.options.length === 1) assert.equal(stage.guided, true, 'one-option work cannot masquerade as independent discrimination');
    }
    fingerprints.push(plan.stages.map(stage => stage.mechanic).join(','));
  }
  assert.equal(new Set(fingerprints).size, 6, 'six labels cannot wrap the same sequence of mechanics');
});

test('teacher syllable edits and repeated letters remain actual separate token occurrences', async () => {
  const { buildQuestPlan } = await questAPI;
  const state = await custom([
    { text: 'nane', parts: ['n', 'ane'], meaning: 'Bir bitki.', emoji: '🌿', sentence: 'Anne nane al.' },
    { text: 'anne', parts: ['an', 'ne'], meaning: 'Bir kişinin annesi.', emoji: '👩', sentence: 'Anne nane al.' },
  ]);
  const hece = buildQuestPlan('syllables', { learningState: state, letters: LETTERS });
  assert.deepEqual(hece.stages[0].tokens, ['n', 'ane']);
  const words = buildQuestPlan('words', { learningState: state, letters: LETTERS });
  assert.deepEqual(words.stages[1].tokens, ['n', 'a', 'n', 'e']);
  assert.equal(words.stages[1].tokens.filter(token => token === 'n').length, 2);
  assert.equal(words.stages.at(-1).mechanic, 'write');
  assert.equal(words.stages.at(-1).word, 'nane');
  assert.equal(words.stages.at(-1).model, '');
});

test('two teacher words are interleaved before the first returns without an example', async () => {
  const { buildQuestPlan } = await questAPI;
  const { createLearningState } = await learningAPI;
  for (const kind of ['syllables', 'words', 'reading', 'sentences']) {
    const plan = buildQuestPlan(kind, { learningState: createLearningState(NOW), letters: LETTERS });
    const first = plan.stages[0].word;
    const otherIndex = plan.stages.findIndex(stage => stage.word !== first);
    assert.ok(otherIndex > 0 && otherIndex < 4, kind);
    const returning = plan.stages.slice(otherIndex + 1).find(stage => stage.word === first && ['recall', 'write', 'sentence'].includes(stage.skill) && !stage.model);
    assert.ok(returning, `${kind} has an unmodelled first-word return after intervening work`);
  }
});

test('taught letters filter every word and token; sentence text cannot hide an untaught or foreign letter', async () => {
  const { buildQuestPlan } = await questAPI;
  const state = await custom([
    { text: 'nane', parts: ['na', 'ne'], sentence: 'Anne nane al.', meaning: 'Bir bitki.' },
    { text: 'anne', parts: ['an', 'ne'], sentence: 'Anne nane x.', meaning: 'Aileden biri.' },
    { text: 'ışık', parts: ['ı', 'şık'], sentence: 'Işık aç.', meaning: 'Aydınlık.' },
  ]);
  for (const kind of ['words', 'syllables', 'reading']) {
    const plan = buildQuestPlan(kind, { learningState: state, letters: ['n', 'a', 'e'] });
    for (const stage of plan.stages) {
      assert.ok(['nane', 'anne'].includes(stage.word));
      assert.ok(stage.tokens.every(token => [...token].every(letter => ['n', 'a', 'e'].includes(letter))));
    }
  }
  const blocked = buildQuestPlan('sentences', { learningState: state, letters: ['n', 'a', 'e'] });
  assert.equal(blocked.available, false);
  assert.match(blocked.reason, /cümle/u);
  const allowed = buildQuestPlan('sentences', { learningState: state, letters: LETTERS });
  assert.equal(allowed.available, true);
  assert.ok(allowed.stages.every(stage => !stage.target.includes('x')));
});

test('arbitrary custom words never acquire invented meanings or example sentences', async () => {
  const { buildQuestPlan } = await questAPI;
  const state = await custom([{ text: 'teli', parts: ['te', 'li'] }, { text: 'tala', parts: ['ta', 'la'] }]);
  assert.equal(buildQuestPlan('words', { learningState: state, letters: LETTERS }).available, true);
  for (const kind of ['reading', 'sentences']) {
    const result = buildQuestPlan(kind, { learningState: state, letters: LETTERS });
    assert.equal(result.available, false, kind);
    assert.equal(result.stages.length, 0);
    assert.ok(result.reason.length > 20, 'the parent receives an actionable reason');
  }
});

test('identical semantic options cannot become an impossible reading question', async () => {
  const { buildQuestPlan } = await questAPI;
  const state = await custom([{ text: 'teli', meaning: 'Aynı anlam' }, { text: 'tala', meaning: 'Aynı anlam' }]);
  const result = buildQuestPlan('reading', { learningState: state, letters: LETTERS });
  assert.equal(result.available, false);
  state.lists[0].words[1].meaning = 'Başka bir nesne';
  const valid = buildQuestPlan('reading', { learningState: state, letters: LETTERS });
  assert.equal(valid.available, true);
  const options = valid.stages[0].options;
  assert.equal(new Set(options.map(option => option.text)).size, options.length);
  assert.ok(options.every(option => !['teli', 'tala'].includes(option.text)), 'reading answers are meanings, not literal target-word copies');
});

test('single known letters work without fabricating vocabulary; guided and free writing are separate', async () => {
  const { buildQuestPlan } = await questAPI;
  const { createLearningState } = await learningAPI;
  const plan = buildQuestPlan('letters', { learningState: createLearningState(NOW), letters: ['a'] });
  assert.equal(plan.available, true);
  assert.ok(plan.stages.every(stage => stage.word === 'a'));
  assert.equal(plan.stages[1].guided, true);
  assert.equal(plan.stages[3].guided, true);
  assert.equal(plan.stages[5].guided, false);
  assert.equal(plan.stages[5].model, '');
  assert.equal(buildQuestPlan('letters', { letters: [] }).available, false);
  assert.equal(buildQuestPlan('words', { letters: ['ü'] }).available, false);
});

test('number quests contain real collect/balance quantities and never masquerade as literacy events', async () => {
  const { buildQuestPlan } = await questAPI;
  const plan = buildQuestPlan('numbers', { letters: [] });
  assert.deepEqual(plan, buildQuestPlan('numbers', { learningState: await custom([{ text: 'ışık' }]), letters: ['ı', 'ş', 'k'] }), 'numeracy does not depend on literacy vocabulary or taught letters');
  assert.equal(plan.available, true);
  assert.equal(plan.stages.length, 6);
  assert.deepEqual(plan.wordTexts, []);
  assert.ok(plan.stages.every(stage => stage.skill === null && stage.word === '' && stage.quantity >= 2 && stage.quantity <= 6 && stage.target === String(stage.quantity)));
  const balances = plan.stages.filter(stage => stage.mechanic === 'balance');
  assert.ok(balances.some(stage => stage.initialQuantity > stage.quantity));
  assert.ok(balances.some(stage => stage.initialQuantity < stage.quantity));
  assert.equal(plan.stages[5].quantity, plan.stages[0].quantity, 'the first quantity returns after another real collection task');
});

test('only complete six-action runs count; animation flags, partial progress and duplicate ids do not', async () => {
  const { getQuestSummaries } = await questAPI;
  const good = completed('words');
  const history = { version: 1, runs: [
    good, { ...good }, completed('words', { id: 'animation', completedStages: 0, animationFinished: true }),
    completed('words', { id: 'half', completedStages: 3 }), completed('words', { id: 'five', results: Array.from({ length: 5 }, () => ({ correct: true })) }),
    completed('words', { id: 'incorrect', results: [...Array.from({ length: 5 }, () => ({ correct: true })), { correct: false }] }),
    completed('letters', { completed: false }), completed('numbers', { totalStages: 8 }),
  ], active: { kind: 'words', index: 6 } };
  const summaries = getQuestSummaries(history);
  assert.equal(summaries.find(entry => entry.id === 'words').completedCount, 1);
  assert.ok(summaries.filter(entry => entry.id !== 'words').every(entry => entry.completedCount === 0));
  assert.deepEqual(summaries, getQuestSummaries(history.runs));
});

test('finished circuits rotate the first teacher word, while incomplete runs cannot advance the planner', async () => {
  const { buildQuestPlan } = await questAPI;
  const { createLearningState } = await learningAPI;
  const state = createLearningState(NOW);
  const first = buildQuestPlan('words', { learningState: state, letters: LETTERS });
  const incomplete = buildQuestPlan('words', { learningState: state, letters: LETTERS, history: [completed('words', { completedStages: 5 })] });
  assert.deepEqual(first, incomplete);
  const next = buildQuestPlan('words', { learningState: state, letters: LETTERS, history: [completed('words', { wordTexts: first.wordTexts })] });
  assert.notEqual(next.id, first.id);
  assert.notEqual(next.stages[0].word, first.stages[0].word);
});

test('planning is reproducible and does not mutate teacher data, observations, history or previous plans', async () => {
  const { buildQuestPlan, getQuestSummaries } = await questAPI;
  const { createLearningState } = await learningAPI;
  const state = createLearningState(NOW);
  const history = [completed('words')];
  const before = JSON.stringify({ state, history });
  const a = buildQuestPlan('words', { learningState: state, letters: LETTERS, history });
  const b = buildQuestPlan('words', { learningState: state, letters: LETTERS, history });
  assert.deepEqual(a, b);
  a.stages[1].tokens[0] = 'x'; a.stages[0].options[0].text = 'changed';
  const c = buildQuestPlan('words', { learningState: state, letters: LETTERS, history });
  assert.deepEqual(c, b);
  getQuestSummaries(history);
  assert.equal(JSON.stringify({ state, history }), before);
});

test('incorrect kind and invalid history recover without creating a reward', async () => {
  const { buildQuestPlan, getQuestSummaries } = await questAPI;
  for (const kind of ['unknown', 'constructor', '__proto__', 'toString']) {
    const result = buildQuestPlan(kind, { history: { runs: [{ kind: 'words', completed: true }] } });
    assert.equal(result.available, false);
    assert.equal(result.stages.length, 0);
  }
  assert.ok(getQuestSummaries(null).every(value => value.completedCount === 0));
});

test('an explicit current clock finds a due word even when saved updatedAt is old', async () => {
  const { buildQuestPlan, recommendQuestKind } = await questAPI;
  const { createLearningState } = await learningAPI;
  const state = createLearningState(NOW);
  state.progress.anne = { recall: { attempts: 1, recent: [2], lastAt: NOW, nextDueAt: NOW + 86400000 } };
  assert.equal(buildQuestPlan('words', { learningState: state, letters: LETTERS }).stages[0].word, 'nane');
  assert.equal(buildQuestPlan('words', { learningState: state, letters: LETTERS, now: NOW + 86400001 }).stages[0].word, 'anne');
  assert.equal(recommendQuestKind({ learningState: state, letters: LETTERS, now: NOW + 86400001 }), 'words');
});

test('next world follows the actual due or weak skill ahead of sticker counts and numeric rest', async () => {
  const { recommendQuestKind } = await questAPI;
  const { createLearningState } = await learningAPI;
  const state = createLearningState(NOW);
  state.progress.nane = { meaning: { attempts: 2, recent: [0], lastAt: NOW, nextDueAt: NOW + 100000 } };
  const manyReadingRuns = Array.from({ length: 8 }, (_, index) => completed('reading', { id: `reading-${index}` }));
  assert.equal(recommendQuestKind({ learningState: state, letters: LETTERS, history: manyReadingRuns, excludeKind: 'words', now: NOW }), 'reading');
  state.progress.nane = { syllables: { attempts: 1, recent: [2], lastAt: NOW, nextDueAt: NOW - 1 } };
  assert.equal(recommendQuestKind({ learningState: state, letters: LETTERS, excludeKind: 'reading', now: NOW }), 'syllables');
  state.progress.a = { write: { attempts: 1, recent: [0], lastAt: NOW } };
  delete state.progress.nane;
  assert.equal(recommendQuestKind({ learningState: state, letters: LETTERS, excludeKind: 'numbers', now: NOW }), 'letters');
});

test('recommendations skip unavailable semantic/sentence worlds and avoid replaying the current world', async () => {
  const { recommendQuestKind, buildQuestPlan } = await questAPI;
  const state = await custom([{ text: 'teli', parts: ['te', 'li'] }]);
  state.progress.teli = { meaning: { attempts: 1, recent: [0], lastAt: NOW, nextDueAt: NOW - 1 } };
  const next = recommendQuestKind({ learningState: state, letters: LETTERS, excludeKind: 'words', now: NOW });
  assert.notEqual(next, 'words');
  assert.notEqual(next, 'numbers', 'urgent word work gets another available literacy route');
  assert.notEqual(next, 'reading');
  assert.notEqual(next, 'sentences');
  assert.equal(buildQuestPlan(next, { learningState: state, letters: LETTERS, now: NOW }).available, true);
  assert.equal(recommendQuestKind({ learningState: state, letters: [], excludeKind: 'numbers', now: NOW }), 'numbers', 'the only available world remains reachable');
});

test('variety uses only validated completed runs; unfinished animation cannot alter the next-world recommendation', async () => {
  const { recommendQuestKind } = await questAPI;
  const { createLearningState } = await learningAPI;
  const state = createLearningState(NOW);
  const next = recommendQuestKind({ learningState: state, letters: LETTERS, excludeKind: 'words', now: NOW });
  const ignored = [{ id: 'animation-finished', kind: next, completed: true, completedStages: 0, totalStages: 6 }];
  assert.equal(recommendQuestKind({ learningState: state, letters: LETTERS, history: ignored, excludeKind: 'words', now: NOW }), next);
  const changed = recommendQuestKind({ learningState: state, letters: LETTERS, history: [completed(next)], excludeKind: 'words', now: NOW });
  assert.notEqual(changed, next);
  assert.notEqual(changed, 'words');
});

const TEACHER_WORDS = ['kalem', 'kitap', 'okul', 'masa', 'kedi', 'elma', 'limon', 'simit'];
async function fullTeacherState() {
  return custom(TEACHER_WORDS.map((text, index) => ({
    text, meaning: `Öğretmenin ${index + 1}. nesne açıklaması.`, sentence: `Ali ${text} al.`,
  })));
}
function finishPlan(plan, index, listId = 'school') {
  return completed(plan.kind, { id: `real-plan-${index}-${plan.id}`, listId,
    wordTexts: [...plan.wordTexts], completedAt: NOW + index * 1000,
    results: plan.stages.map(stage => ({ id: stage.id, word: stage.word, skill: stage.skill, correct: true })) });
}

test('every eligible teacher word becomes a target across repeated tours, rather than alternating the first pair forever', async () => {
  const { buildQuestPlan } = await questAPI;
  const { ALPHABET } = await learningAPI;
  for (const kind of ['words', 'syllables', 'reading', 'sentences']) {
    const state = await fullTeacherState(), history = [], seen = new Set();
    for (let round = 0; round < 6; round++) {
      const plan = buildQuestPlan(kind, { learningState: state, letters: ALPHABET, history, now: NOW + round * 1000 });
      assert.equal(plan.available, true, `${kind}: ${plan.reason}`);
      for (const stage of plan.stages) if (stage.word) seen.add(stage.word);
      history.push(finishPlan(plan, round));
    }
    assert.deepEqual([...seen].sort(), [...TEACHER_WORDS].sort(), `${kind}: words at the end of the teacher list must become actual targets, not just distractors`);
  }
});

test('teacher-word exposure follows the child between worlds instead of restarting the same first pair', async () => {
  const { buildQuestPlan } = await questAPI;
  const { ALPHABET } = await learningAPI;
  const state = await fullTeacherState(), history = [], seen = new Set();
  const sequence = ['words', 'syllables', 'reading', 'sentences', 'words', 'syllables'];
  let previousPair;
  for (let round = 0; round < sequence.length; round++) {
    const plan = buildQuestPlan(sequence[round], { learningState: state, letters: ALPHABET, history, now: NOW + round * 1000 });
    const pair = [...plan.wordTexts].sort();
    if (round === 1) assert.notDeepEqual(pair, previousPair, 'changing the world must not silently reset vocabulary coverage');
    for (const word of plan.wordTexts) seen.add(word);
    history.push(finishPlan(plan, round)); previousPair = pair;
  }
  assert.deepEqual([...seen].sort(), [...TEACHER_WORDS].sort());
});

test('an observed difficulty returns when due while new teacher words still receive their own practice', async () => {
  const { buildQuestPlan } = await questAPI;
  const { ALPHABET, recordAttempt } = await learningAPI;
  let state = await fullTeacherState();
  state.progress.kalem = { recall: { attempts: 1, recent: [0], lastAt: NOW - 15 * 60000, nextDueAt: NOW - 5 * 60000 } };
  const history = [], seen = new Set();
  for (let round = 0; round < 6; round++) {
    const now = NOW + round * 10000;
    const plan = buildQuestPlan('words', { learningState: state, letters: ALPHABET, history, now });
    if (round === 0) assert.ok(plan.wordTexts.includes('kalem'), 'a due observed recall difficulty receives real practice');
    for (const word of plan.wordTexts) seen.add(word);
    for (const [index, stage] of plan.stages.entries()) state = recordAttempt(state, {
      id: `${stage.id}:complete`, word: stage.word, skill: stage.skill, correct: true,
      independent: true, writingReviewed: stage.mechanic === 'write', mistakes: 0, hints: 0, at: now + index,
    }, now + index);
    history.push(finishPlan(plan, round));
  }
  assert.deepEqual([...seen].sort(), [...TEACHER_WORDS].sort(), 'review needs cannot permanently hide words later in the list');
  assert.ok(state.progress.kalem.recall.nextDueAt > NOW + 60000, 'success schedules a later review instead of instant repeated drilling');
});

test('newly added teacher words get a turn, and removed or switched-list words never leak into new choices', async () => {
  const { buildQuestPlan } = await questAPI;
  const { ALPHABET } = await learningAPI;
  const state = await fullTeacherState(), history = [];
  for (let round = 0; round < 6; round++) {
    const plan = buildQuestPlan('words', { learningState: state, letters: ALPHABET, history, now: NOW + round * 1000 });
    history.push(finishPlan(plan, round));
  }
  state.lists[0].words.push({ text: 'balon' });
  const added = buildQuestPlan('words', { learningState: state, letters: ALPHABET, history, now: NOW + 10000 });
  assert.ok(added.wordTexts.includes('balon'), 'a new word cannot be hidden behind earlier completed rotations');
  state.lists[0].words = [{ text: 'masa' }, { text: 'elma' }];
  const current = buildQuestPlan('words', { learningState: state, letters: ALPHABET, history, now: NOW + 11000 });
  assert.deepEqual([...current.wordTexts].sort(), ['elma', 'masa']);
  assert.ok(current.stages.every(stage => ['elma', 'masa'].includes(stage.word)
    && stage.options.every(option => ['elma', 'masa'].includes(option.value))), 'removed entries cannot remain as targets or distractors');
  state.lists.push({ id: 'next-week', title: 'Gelecek hafta', words: [{ text: 'balon' }, { text: 'kayık' }] });
  state.activeListId = 'next-week';
  const switched = buildQuestPlan('words', { learningState: state, letters: ALPHABET, history, now: NOW + 12000 });
  assert.deepEqual([...switched.wordTexts].sort(), ['balon', 'kayık']);
  assert.ok(switched.stages.every(stage => stage.options.every(option => ['balon', 'kayık'].includes(option.value))));
});

test('coverage never bypasses the taught-letter filter to reach blocked teacher words', async () => {
  const { buildQuestPlan } = await questAPI;
  const state = await custom([{ text: 'alet' }, { text: 'ilan' }, { text: 'ışık' }, { text: 'kitap' }]);
  const history = [];
  for (let round = 0; round < 6; round++) {
    const plan = buildQuestPlan('words', { learningState: state, letters: LETTERS, history, now: NOW + round * 1000 });
    assert.deepEqual([...plan.wordTexts].sort(), ['alet', 'ilan']);
    for (const stage of plan.stages) {
      assert.ok(['alet', 'ilan'].includes(stage.word));
      assert.ok(stage.options.every(option => ['alet', 'ilan'].includes(option.value)));
    }
    history.push(finishPlan(plan, round));
  }
});
