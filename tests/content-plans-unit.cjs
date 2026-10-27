const { test } = require('node:test');
const assert = require('node:assert/strict');
const { modelURL } = require('./model-loader.cjs');
const api = Promise.all([
  import(modelURL('quest-model.js')),
  import(modelURL('learning-model.js')),
  import(modelURL('content-selection.js')),
]).then(modules => Object.assign({}, ...modules));
const NOW = Date.UTC(2026, 9, 27, 11);

function listState(models, { words = [], letters = [], syllables = [] } = {}) {
  const state = models.createLearningState(NOW);
  state.lists[0].words = words;
  state.lists[0].letters = letters;
  state.lists[0].syllables = syllables;
  return state;
}
function serve(models, plan, selection, at, stages = plan.stages) {
  let next = selection;
  for (const stage of stages) for (const event of models.getQuestContentExposures(plan, stage)) {
    next = models.recordContentExposure(next, { ...event, at });
  }
  return next;
}
function rounds(models, kind, learningState, count, taught = models.ALPHABET) {
  let selection = models.normalizeSelectionState();
  const plans = [], exposed = new Set();
  for (let index = 0; index < count; index++) {
    const plan = models.buildQuestPlan(kind, { learningState, letters: taught, selection, now: NOW + index * 60000 });
    assert.equal(plan.available, true, plan.reason);
    assert.equal(plan.stages.length, 6, 'each selected circuit still needs six actual actions');
    plans.push(plan);
    for (const stage of plan.stages) for (const event of models.getQuestContentExposures(plan, stage)) {
      for (const item of event.items) exposed.add(item);
      selection = models.recordContentExposure(selection, { ...event, at: NOW + index * 60000 });
    }
    selection = JSON.parse(JSON.stringify(selection));
  }
  return { plans, exposed, selection };
}

test('all 29 taught letters become actual Fener targets, including letters absent from the word list', async () => {
  const models = await api;
  const state = listState(models, { words: ['nane'] });
  const before = JSON.stringify(state);
  const { plans, exposed } = rounds(models, 'letters', state, 15);
  assert.deepEqual(exposed, new Set(models.ALPHABET));
  const previous = new Set();
  for (const plan of plans.slice(0, 14)) {
    assert.equal(plan.wordTexts.length, 2);
    assert.ok(plan.wordTexts.every(letter => !previous.has(letter)), 'no first-pair loop while a taught letter waits');
    plan.wordTexts.forEach(letter => previous.add(letter));
    assert.ok(plan.stages.every(stage => stage.itemType === 'letter' && models.ALPHABET.includes(stage.word)));
  }
  assert.equal(JSON.stringify(state), before, 'planning and serving never award or mutate learning evidence');
});

test('six independent teacher syllables get their own train targets without fabricated vocabulary', async () => {
  const models = await api;
  const syllables = ['na', 'ne', 'ni', 'la', 'le', 'li'];
  const state = listState(models, { syllables });
  const { plans, exposed } = rounds(models, 'syllables', state, 3);
  assert.deepEqual(exposed, new Set(syllables));
  assert.deepEqual(new Set(plans.flatMap(plan => plan.focusTexts)), new Set(syllables));
  for (const plan of plans) {
    assert.deepEqual(plan.wordTexts, [], 'a bare syllable is not relabelled as a vocabulary word');
    assert.ok(plan.stages.every(stage => stage.itemType === 'syllable' && stage.word === '' && syllables.includes(stage.unitText)));
    assert.ok(plan.stages.every(stage => stage.options.every(option => syllables.includes(option.value))));
    const assembly = plan.stages.filter(stage => stage.mechanic === 'assemble');
    assert.ok(assembly.every(stage => stage.tokens.join('') === stage.unitText), 'the actual supplied syllable is built from its real letters');
    for (const stage of plan.stages) assert.ok(models.getQuestContentExposures(plan, stage).every(event => event.domain === 'syllables'));
  }
  assert.deepEqual(state.events, []);
  assert.deepEqual(Object.keys(state.progress), [], 'selection metadata creates no lexical mastery record');
});

test('eight teacher words are all real quest targets in four rounds across persisted selection', async () => {
  const models = await api;
  const words = ['kalem', 'kitap', 'okul', 'masa', 'kedi', 'top', 'elma', 'limon'];
  const state = listState(models, { words });
  const { plans, exposed } = rounds(models, 'words', state, 4);
  assert.deepEqual(exposed, new Set(words));
  assert.deepEqual(plans.flatMap(plan => plan.wordTexts), words);
  for (const plan of plans) assert.ok(plan.stages.every(stage => stage.options.every(option => words.includes(option.value))), 'starter distractors cannot re-enter the supplied list');
});

test('all eleven count targets occur and zero still uses an explicit collection/check task', async () => {
  const models = await api;
  const state = listState(models);
  const { plans, exposed } = rounds(models, 'numbers', state, 6, []);
  assert.deepEqual(exposed, new Set(Array.from({ length: 11 }, (_, index) => String(index))));
  for (const plan of plans) {
    assert.deepEqual(plan.wordTexts, []);
    assert.ok(plan.stages.every(stage => stage.word === '' && stage.skill === null && stage.itemType === 'number'));
    for (const stage of plan.stages) {
      assert.ok(Number.isInteger(stage.quantity) && stage.quantity >= 0 && stage.quantity <= 10);
      assert.equal(stage.target, String(stage.quantity));
      assert.ok(stage.options.every(option => Number(option.value) >= 0 && Number(option.value) <= 10));
      if (stage.mechanic === 'balance') {
        assert.ok(stage.initialQuantity >= 0 && stage.initialQuantity <= 10);
        assert.notEqual(stage.initialQuantity, stage.quantity, 'a balancing task actually requires adding or removing');
        assert.match(stage.prompt, stage.initialQuantity > stage.quantity ? /fazla|geri koy/u : /eksik|tamamla/u);
      }
      assert.ok(models.getQuestContentExposures(plan, stage).every(event => event.domain === 'numbers'));
    }
  }
  const zero = plans.flatMap(plan => plan.stages).find(stage => stage.mechanic === 'collect' && stage.quantity === 0);
  assert.ok(zero, 'zero is taught as an actual count target');
  assert.equal(zero.initialQuantity, 0);
  assert.equal(zero.correct, undefined, 'an empty basket cannot come pre-approved');
  assert.equal(zero.completed, undefined, 'the UI must still wait for the child’s explicit check');
  const other = listState(models, { words: ['ışık'], letters: ['ı', 'ş', 'k'], syllables: ['şık'] });
  assert.deepEqual(models.buildQuestPlan('numbers', { learningState: state, letters: [] }),
    models.buildQuestPlan('numbers', { learningState: other, letters: ['ı', 'ş', 'k'] }), 'literacy cannot influence numerical plans or their metadata');
});

test('postane rotates distinct teacher messages rather than the same sentence under two word labels', async () => {
  const models = await api;
  const words = [
    { text: 'nane', sentence: 'Anne nane al.' },
    { text: 'anne', sentence: 'Anne nane al.' },
    { text: 'lale', sentence: 'Ali lale al.' },
    { text: 'nine', sentence: 'Nine nane al.' },
  ];
  const { plans, exposed } = rounds(models, 'sentences', listState(models, { words }), 2);
  const messages = ['Anne nane al.', 'Ali lale al.', 'Nine nane al.'];
  assert.deepEqual(new Set([...exposed].filter(value => value.includes(' '))), new Set(messages));
  for (const plan of plans) {
    assert.notEqual(plan.stages[0].sentence, plan.stages[2].sentence, 'two different authored messages are chosen when alternatives exist');
    assert.deepEqual(new Set(plan.contentPools.sentences), new Set(messages));
    assert.ok(plan.stages.every(stage => stage.options.every(option => !option.value.includes('elma'))), 'no invented message vocabulary enters the teacher source');
  }
});

test('offering an unfinished target affects the next world while reloading the saved stage is idempotent', async () => {
  const models = await api;
  const state = models.createLearningState(NOW);
  let selection = models.normalizeSelectionState();
  const first = models.buildQuestPlan('words', { learningState: state, letters: models.ALPHABET, selection, now: NOW });
  selection = serve(models, first, selection, NOW, [first.stages[0]]);
  const stored = JSON.parse(JSON.stringify({ plan: first, selection, index: 0 }));
  assert.equal(stored.plan.id, first.id, 'saved active plans retain their original identity');
  const repeated = serve(models, stored.plan, stored.selection, NOW + 1000, [stored.plan.stages[0]]);
  assert.deepEqual(repeated, selection, 'the same stage after reload cannot consume another turn in the shared bag');
  const next = models.buildQuestPlan('syllables', { learningState: state, letters: models.ALPHABET, selection: repeated, now: NOW + 1000 });
  assert.notEqual(next.stages[0].word, first.stages[0].word, 'switching without a correct answer cannot restart the first offered word');
  assert.notEqual(next.id, first.id);
  assert.deepEqual(state.events, [], 'an offered task is not a correct learning response');
  assert.ok(models.getQuestSummaries({ runs: [], active: { kind: first.kind, plan: first, index: 0 } }).every(summary => summary.completedCount === 0));
});

test('new and removed teacher letter/syllable targets update the pool with Turkish distinctions intact', async () => {
  const models = await api;
  const state = listState(models, { letters: ['I', 'İ', 'Ş'], syllables: ['ŞA', 'şı', 'na'] });
  const letterRounds = rounds(models, 'letters', state, 2);
  assert.deepEqual(letterRounds.exposed, new Set(['ı', 'i', 'ş']));
  const heceRounds = rounds(models, 'syllables', state, 2);
  assert.deepEqual(heceRounds.exposed, new Set(['şa', 'şı', 'na']));
  state.lists[0].letters = ['ğ', 'ö'];
  const letters = models.buildQuestPlan('letters', { learningState: state, letters: models.ALPHABET, selection: letterRounds.selection, now: NOW + 180000 });
  assert.deepEqual(new Set(letters.wordTexts), new Set(['ğ', 'ö']));
  assert.ok(letters.stages.every(stage => stage.options.every(option => ['ğ', 'ö'].includes(option.value))), 'removed letters cannot linger as target or distractor');
  state.lists[0].syllables.push('lö');
  const added = models.buildQuestPlan('syllables', { learningState: state, letters: models.ALPHABET, selection: heceRounds.selection, now: NOW + 180000 });
  assert.equal(added.focusTexts[0], 'lö', 'a newly added unit gets a chance instead of catching up to old exposure counts');
  state.lists[0].syllables = ['lö', 'şa'];
  const removed = models.buildQuestPlan('syllables', { learningState: state, letters: models.ALPHABET, selection: heceRounds.selection, now: NOW + 180001 });
  assert.deepEqual(new Set(removed.focusTexts), new Set(['lö', 'şa']));
  assert.ok(removed.stages.every(stage => stage.options.every(option => ['lö', 'şa'].includes(option.value))));
});

test('taught levels block supplied units visibly and never substitute unrelated starter words', async () => {
  const models = await api;
  const state = listState(models, { letters: ['ş'], syllables: ['şa'] });
  for (const kind of ['letters', 'syllables']) {
    const plan = models.buildQuestPlan(kind, { learningState: state, letters: ['a'], selection: models.normalizeSelectionState(), now: NOW });
    assert.equal(plan.available, false);
    assert.deepEqual(plan.stages, []);
    assert.match(plan.reason, /ş/u, 'the missing taught letter is explained');
    assert.deepEqual(plan.wordTexts, []);
  }
});

test('empty and one-item pools stay explicit, finite and typed without inventing an alternative', async () => {
  const models = await api;
  const empty = listState(models);
  for (const kind of ['letters', 'syllables', 'words']) {
    const plan = models.buildQuestPlan(kind, { learningState: empty, letters: [], selection: models.normalizeSelectionState(), now: NOW });
    assert.equal(plan.available, false);
    assert.deepEqual(plan.stages, []);
  }
  assert.equal(models.buildQuestPlan('numbers', { learningState: empty, letters: [] }).available, true);
  const single = listState(models, { letters: ['ı'], syllables: ['şı'] });
  const letter = models.buildQuestPlan('letters', { learningState: single, letters: models.ALPHABET, selection: models.normalizeSelectionState(), now: NOW });
  assert.deepEqual(letter.focusTexts, ['ı']);
  assert.ok(letter.stages.every(stage => stage.word === 'ı'));
  const hece = models.buildQuestPlan('syllables', { learningState: single, letters: models.ALPHABET, selection: models.normalizeSelectionState(), now: NOW });
  assert.deepEqual(hece.focusTexts, ['şı']);
  assert.equal(hece.stages.length, 6);
  assert.ok(hece.stages.every(stage => stage.word === '' && stage.itemType === 'syllable'));
  assert.ok(hece.stages.filter(stage => stage.options.length).every(stage => stage.options.length === 1 && stage.guided));
});

test('older saved plans without exposure metadata do not invent historical targets from an edited list', async () => {
  const models = await api;
  const original = models.buildQuestPlan('words', { learningState: models.createLearningState(NOW), letters: models.ALPHABET, now: NOW });
  const old = JSON.parse(JSON.stringify(original));
  delete old.contentPools;
  for (const stage of old.stages) {
    delete stage.itemType;
    delete stage.sentence;
  }
  assert.ok(old.stages.every(stage => models.getQuestContentExposures(old, stage).length === 0));
  assert.equal(old.id, original.id);
  assert.deepEqual(old.stages.map(stage => stage.id), original.stages.map(stage => stage.id));
  for (const malformed of [17, {}, 'nane']) {
    const invalid = { ...original, contentPools: { words: malformed } };
    assert.deepEqual(models.getQuestContentExposures(invalid, original.stages[0]), [], 'malformed imported metadata neither crashes nor fabricates exposure');
  }
});
