const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { modelURL } = require('./model-loader.cjs');
const source = fs.readFileSync(path.resolve(__dirname, '../src/game.js'), 'utf8');

test('the game speech boundary forwards literal lesson intent without altering its text', async () => {
  const calls = [];
  const context = vm.createContext({ state: { muted: false }, audio: { speak: async (text, options) => { calls.push({ text, options }); return true; } } });
  vm.runInContext(source.split('\n').find(line => line.startsWith('function speak(')), context);
  assert.equal(await context.speak('Alparslan ile adım adım öğrenelim.', { literal: true }), true);
  assert.deepEqual(calls, [{ text: 'Alparslan ile adım adım öğrenelim.', options: { literal: true } }]);
});
const models = Promise.all(['content-selection.js', 'learning-model.js', 'teacher-library.js'].map(name => import(modelURL(name))));

// Run the actual result renderer, content pools, launchers and delegated click
// handler. Only the browser shell (rendering, audio, sync and lesson mounting)
// is replaced; the continuation and teacher/selection models stay real.
function declaration(name) {
  const start = source.indexOf(`\nfunction ${name}(`);
  if (start < 0) return '';
  const end = source.indexOf('\nfunction ', start + 1);
  return source.slice(start + 1, end < 0 ? undefined : end);
}
function constant(name) {
  return source.split('\n').find(line => line.startsWith(`const ${name}=`));
}
const clickStart = source.indexOf("document.addEventListener('click',e=>");
const clickEnd = source.indexOf("document.addEventListener('visibilitychange'", clickStart);
const functions = ['allowed', 'bar', 'practiceContentPool', 'practiceDomain', 'practiceButton', 'nextPracticeTarget', 'nextPractice', 'letter', 'buildStep', 'word', 'sentence', 'number', 'complete'];

async function fixture({ mode = 'syllables', source: contentSource = 'teacher', text = 'na', filter = 'all', caps = false, numMode = 'trace', list, selection } = {}) {
  const [content, learning, teacher] = await models;
  const learner = learning.createLearningState(1);
  learner.lists = [list || { id: 'lesson', title: 'Öğretmenimin kartları', updatedAt: 1, letters: ['a', 'n', 'e', 't'], syllables: ['na', 'ne', 'an'], sentences: ['Anne nane al.', 'Anne anne al.'], words: [
    { text: 'nane', parts: ['na', 'ne'], emoji: '🌿', meaning: '', sentence: 'Anne nane al.' },
    { text: 'anne', parts: ['an', 'ne'], emoji: '👩', meaning: '', sentence: 'Anne anne al.' },
    { text: 'at', parts: ['at'], emoji: '🐎', meaning: '', sentence: '' },
    { text: 'şal', parts: ['şal'], emoji: '🧣', meaning: '', sentence: '' },
  ] }];
  learner.activeListId = learner.lists[0].id;
  const contentStore = content.createContentStore({ storage: null });
  for (const event of selection || []) contentStore.expose(event);
  const main = { innerHTML: '' }, handlers = {}, launches = [], navigation = [], speech = [];
  const types = { letters: 'letter', syllables: 'syllable', words: 'word', reading: 'reading', sentences: 'sentence', numbers: numMode === 'trace' ? 'digit' : numMode === 'count' ? 'count' : 'number' };
  const context = vm.createContext({
    ...content, ...learning, ...teacher, console, Date,
    state: { done: [], letters: ['a', 'n', 'e', 't', 'i', 'l'], recent: 'a', effects: false },
    view: 'lesson', filter, caps, numMode,
    game: { type: types[mode], key: text, text, i: 0, steps: [{ kind: mode === 'reading' ? 'build' : 'free', text }], practiceMode: mode, source: contentSource },
    modes: Object.keys(types).map(name => [name]),
    A: learning.ALPHABET, P: Object.fromEntries([...learning.ALPHABET, ...learning.ALPHABET.map(letter => letter.toLocaleUpperCase('tr-TR')), ...'0123456789'].map(letter => [letter, []])),
    syllables: ['na', 'ne', 'an', 'şa'],
    words: [
      { text: 'nane', parts: ['na', 'ne'], emoji: '🌿', read: true },
      { text: 'anne', parts: ['an', 'ne'], emoji: '👩', read: true },
      { text: 'at', parts: ['at'], emoji: '🐎', read: true },
      { text: 'şal', parts: ['şal'], emoji: '🧣', read: true },
    ],
    sentences: ['Anne nane al.', 'Anne anne al.', 'Şal al.'],
    rewards: [['🌱', 'Minik filiz']],
    $: selector => selector === '#main' ? main : null,
    learningStore: { getState: () => learner }, contentStore,
    teacherLibrary: () => teacher.getTeacherLibrary(learner, context.state.letters, context.words),
    releaseWritingGuard() {}, stop() {}, save() {}, syncCompletion() {}, close() {},
    window: { scrollTo() {} }, shuffle: values => [...values],
    modal: (title, body) => { main.innerHTML = `<h2>${title}</h2>${body}`; }, toast() {},
    go: mode => navigation.push(mode),
    begin: (type, key, text, steps, options) => launches.push({ type, key, text, steps, options }),
    sentencePractice: { start: (text, options) => launches.push({ type: 'sentence', text, options }) },
    audio: { playEffect() {} },
    speak: (text, options) => { speech.push({ text, options }); },
    document: { addEventListener: (name, listener) => { handlers[name] = listener; } },
  });
  vm.runInContext([constant('esc'), constant('actionIcons'), constant('button'), ...functions.map(declaration), source.slice(clickStart, clickEnd)].join('\n'), context);
  return {
    context, main, launches, navigation, contentStore, speech,
    selectList(next) { learner.lists.push(next); learner.activeListId = next.id; },
    complete: () => context.complete(),
    actions() {
      const html = main.innerHTML.slice(main.innerHTML.indexOf('<div class="actions">'));
      return [...html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/gu)].map(([, attrs, label]) => {
        const dataset = Object.fromEntries([...attrs.matchAll(/data-([a-z-]+)="([^"]*)"/gu)].map(([, key, value]) => [key.replace(/-([a-z])/gu, (_, letter) => letter.toUpperCase()), value.replace(/&quot;/gu, '"').replace(/&#39;/gu, "'").replace(/&amp;/gu, '&')]));
        return { dataset, label: label.replace(/<[^>]*>/gu, '') };
      });
    },
    click(control) { handlers.click({ target: { closest: () => control } }); },
  };
}

test('free lesson controls use literal audio and the authored adventure listen control stays narration', async () => {
  const app = await fixture();
  const text = 'Alparslan ile adım adım öğrenelim.';
  app.context.game.adventure = { story: text };
  app.click({ id: 'storyListen', dataset: { do: 'speak', text } });
  app.click({ dataset: { do: 'speak', text } });
  assert.equal(app.speech[0].options, undefined, 'authored story listen is narration');
  assert.deepEqual(JSON.parse(JSON.stringify(app.speech[1])), { text, options: { literal: true } }, 'the same text used as a lesson target retains its authored name');
});

test('the primary teacher sentence launcher accepts one-word instructions and spaced punctuation', async () => {
  for (const text of ['Anlat', 'Anne — nane al.']) {
    const app = await fixture({ mode: 'sentences', list: { id: 'independent', title: 'Cümlelerim', updatedAt: 1, words: [], sentences: [text] } });
    app.context.nextPractice('sentences', 'teacher');
    assert.equal(app.launches[0]?.text, text, 'an accepted teacher card remains selectable through the primary action');
    assert.equal(app.launches[0].options.source, 'teacher');
  }
});

for (const [mode, text, type, next] of [
  ['letters', 'a', 'letter', 'n'],
  ['syllables', 'na', 'syllable', 'ne'],
  ['words', 'nane', 'word', 'anne'],
  ['reading', 'nane', 'reading', 'anne'],
  ['sentences', 'Anne nane al.', 'sentence', 'Anne anne al.'],
  ['numbers', '0', 'digit', '1'],
]) {
  test(`${mode}: primary result action starts a different eligible target in the same free-practice mode`, async () => {
    const app = await fixture({ mode, text, source: mode === 'numbers' ? 'standard' : 'teacher' });
    app.complete();
    const primary = app.actions()[0];
    assert.equal(primary.dataset.do, 'practice-next', 'the primary action continues free practice');
    app.click(primary);
    assert.equal(app.launches.length, 1);
    assert.equal(app.launches[0].type, type);
    assert.equal(app.launches[0].text, next);
    if (mode !== 'numbers') assert.equal(app.launches[0].options.source, 'teacher');
    assert.ok(app.actions().some(action => action.dataset.do === 'repeat'), 'retry remains available');
    assert.ok(app.actions().some(action => action.dataset.do === 'home'), 'home remains available');
  });
}

test('a one-item teacher pool offers cards and retry without pretending another target exists', async () => {
  const app = await fixture({ list: { id: 'one', title: 'Tek hece', updatedAt: 1, letters: ['n', 'a'], syllables: ['na'], words: [] } });
  app.complete();
  const actions = app.actions();
  assert.equal(actions[0].dataset.do, 'catalog');
  assert.equal(actions[0].dataset.view, 'syllables');
  assert.equal(actions.some(action => action.dataset.do === 'practice-next'), false);
  app.click(actions.find(action => action.dataset.do === 'repeat'));
  assert.equal(app.launches[0].type, 'syllable');
  assert.equal(app.launches[0].text, 'na');
  assert.equal(app.launches[0].options.source, 'teacher');
});

test('a changed empty teacher pool keeps a route back to its own cards', async () => {
  const app = await fixture({ list: { id: 'empty', title: 'Boş', updatedAt: 1, letters: [], syllables: [], words: [] } });
  app.complete();
  const primary = app.actions()[0];
  assert.equal(primary.dataset.do, 'catalog');
  app.click(primary);
  assert.deepEqual(app.navigation, ['syllables']);
});

test('teacher sentence continuation preserves the explicitly authored case and punctuation', async () => {
  const app = await fixture({ mode: 'sentences', text: 'Anne nane al.', list: { id: 'authored', title: 'Cümlelerim', updatedAt: 1, letters: [], syllables: [], sentences: ['Anne nane al.', 'İnal, anten al!'], words: [
    { text: 'nane', parts: ['na', 'ne'], emoji: '', meaning: '', sentence: 'Anne nane al.' },
    { text: 'anne', parts: ['an', 'ne'], emoji: '', meaning: '', sentence: 'Anne  anne al.' },
  ] } });
  app.complete(); app.click(app.actions()[0]);
  assert.equal(app.launches.length, 1, 'the canonical selection resolves to a real authored sentence card');
  assert.equal(app.launches[0].text, 'İnal, anten al!');
  assert.equal(app.launches[0].options.source, 'teacher');
});

test('teacher sentence primary launch and continuation use only the explicit current active list', async () => {
  const own = ['İnal, anten al!', 'Lale tane tane anlat.'];
  const app = await fixture({ mode: 'sentences', text: own[0], list: { id: 'mine', title: 'Benim cümlelerim', updatedAt: 1,
    sentences: own, words: [{ text: 'nane', parts: ['na', 'ne'], sentence: 'Anne nane al.' }] } });
  assert.deepEqual(Array.from(app.context.practiceContentPool('sentences', 'teacher')), own);
  app.click({ dataset: { do: 'practice-next', view: 'sentences', source: 'teacher' } });
  app.context.nextPractice('sentences', 'teacher', own[0]);
  assert.deepEqual(app.launches.map(item => item.text), own);
  app.selectList({ id: 'new', title: 'Yeni listem', updatedAt: 2, words: [{ text: 'at', sentence: 'Anne at al.' }], sentences: ['Nil ala atlet al.'] });
  app.context.nextPractice('sentences', 'teacher', own[1]);
  assert.equal(app.launches.at(-1).text, 'Nil ala atlet al.');
  const count = app.launches.length;
  app.context.sentence(own[0], 'teacher');
  assert.equal(app.launches.length, count, 'a card from the previous active list cannot reopen');
});

test('short-card filters and actual selection history choose an unserved eligible teacher target', async () => {
  const app = await fixture({ text: 'na', filter: 'short', selection: [{ id: 'already-ne', domain: 'syllables', items: ['ne'], pool: ['na', 'ne', 'an'], at: 1 }] });
  app.complete();
  assert.equal(app.actions()[0].dataset.do, 'practice-next');
  app.click(app.actions()[0]);
  assert.equal(app.launches[0].text, 'an', 'the current target is skipped and real prior exposure is respected');
  assert.equal(app.context.filter, 'short');
  const words = await fixture({ mode: 'words', text: 'at', filter: 'short' });
  words.complete();
  assert.equal(words.actions()[0].dataset.do, 'catalog', 'long teacher words cannot bypass the short-card filter');
});

test('standard continuation excludes unlearned letters and retains uppercase letter practice', async () => {
  const app = await fixture({ mode: 'letters', text: 'A', source: 'standard', caps: true });
  app.complete();
  assert.equal(app.actions()[0].dataset.do, 'practice-next');
  app.click(app.actions()[0]);
  assert.equal(app.launches[0].text, 'N');
  assert.equal(app.launches[0].options.source, 'standard');
  const syllables = await fixture({ source: 'standard' });
  syllables.complete(); syllables.click(syllables.actions()[0]);
  assert.equal(syllables.launches[0].text, 'ne');
});

for (const [numMode, type] of [['count', 'count'], ['explore', 'number']]) {
  test(`numbers: continuation preserves the ${numMode} activity`, async () => {
    const app = await fixture({ mode: 'numbers', text: '0', source: 'standard', numMode });
    app.complete();
    assert.equal(app.actions()[0].dataset.do, 'practice-next');
    app.click(app.actions()[0]);
    assert.equal(app.launches[0].type, type);
    assert.equal(app.launches[0].text, '1');
  });
}

test('a short story result keeps its existing connected learning continuation', async () => {
  const app = await fixture({ mode: 'words', text: 'nane' });
  app.context.game = { ...app.context.game, type: 'adventure', practiceMode: '', adventure: { key: 'nane-bahcesi', ending: 'Nane etiketi hazır.' } };
  app.complete();
  assert.ok(['learning', 'learning-continue'].includes(app.actions()[0].dataset.do));
  assert.ok(app.main.innerHTML.includes('data-zone="train"'), 'story island destinations remain available');
});
