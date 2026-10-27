const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const { modelURL } = require('./model-loader.cjs');

// The controller, writing guard, story scene and learning graph are real. Only
// celebration is substituted: its confetti/audio imports require a browser.
const sourceRoot = path.resolve(__dirname, '../src');
const moduleCache = new Map();
function controllerURL(filename) {
  const absolute = path.resolve(sourceRoot, filename);
  if (moduleCache.has(absolute)) return moduleCache.get(absolute);
  if (absolute === path.join(sourceRoot, 'celebration.js')) {
    return 'data:text/javascript,export function hideCelebration(){};export function showCelebration(){}';
  }
  let source = fs.readFileSync(absolute, 'utf8').replace(/^\s*import\s+['"][^'"]+\.css['"];?\s*$/gm, '');
  source = source.replace(/(\bfrom\s*|\bimport\s*)(['"])(\.{1,2}\/[^'"]+\.js)\2/g,
    (_match, prefix, _quote, dependency) => prefix + JSON.stringify(controllerURL(path.relative(sourceRoot, path.resolve(path.dirname(absolute), dependency)))));
  const url = `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
  moduleCache.set(absolute, url);
  return url;
}
const models = import(modelURL('learning-model.js'));
const LETTERS = ['n', 'a', 'e', 't', 'i', 'l'];
const NOW = Date.UTC(2026, 9, 27, 10);

async function fixture({ kind = 'build', support = 1, letters = LETTERS } = {}) {
  const dom = new JSDOM('<body><main id="main"></main></body>', { url: 'https://example.test/', pretendToBeVisual: true });
  const { window } = dom;
  window.scrollTo = () => {};
  const media = new window.EventTarget(); media.matches = true;
  const globals = {
    window, document: window.document, Element: window.Element, MutationObserver: window.MutationObserver,
    requestAnimationFrame: window.requestAnimationFrame.bind(window), cancelAnimationFrame: window.cancelAnimationFrame.bind(window),
    matchMedia: () => media,
  };
  const previous = new Map(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
  // jsdom does not implement SVG geometry. Coordinates still flow through the
  // real notebook pointer handlers and persisted paths.
  window.SVGElement.prototype.createSVGPoint = () => ({ x: 0, y: 0 });
  window.SVGElement.prototype.getScreenCTM = () => null;
  window.SVGElement.prototype.getTotalLength = function () {
    const points = [...(this.getAttribute('d') || '').matchAll(/[ML](-?[\d.]+) (-?[\d.]+)/gu)]
      .map(([, x, y]) => ({ x: Number(x), y: Number(y) }));
    return points.slice(1).reduce((length, point, index) => length + Math.hypot(point.x - points[index].x, point.y - points[index].y), 0);
  };
  const { createLearningState, recordAttempt, planSession, normalizeLearningState } = await models;
  let taughtLetters = [...letters];
  let state = createLearningState(NOW);
  if (support < 2) {
    for (let index = 0; index < 2; index++) state = recordAttempt(state, {
      id: `previous-${kind}-${index}`, word: 'nane', skill: kind, correct: true,
      independent: support === 0, hints: support === 0 ? 0 : 1, writingReviewed: kind === 'write', at: NOW + index,
    }, NOW + index);
  }
  state.session = planSession(state, letters, NOW + 100, { entryKind: kind, focusText: 'nane' });
  state.session.storySeen = true;
  const initialTask = state.session.tasks[0];
  assert.equal(initialTask.kind, kind);
  const { createLearning } = await import(controllerURL('learning.js'));
  const root = window.document.querySelector('#main');
  const create = () => createLearning({
    root, getState: () => state, setState: next => { state = normalizeLearningState(JSON.parse(JSON.stringify(next))); },
    getLetters: () => taughtLetters, speak: async () => true,
  });
  let learning = create(); learning.start();
  return {
    root, window, initialTask,
    state: () => state,
    click(action) { const button = root.querySelector(`[data-learning="${action}"]`); assert.ok(button, action); button.click(); },
    tile(text) { const button = [...root.querySelectorAll('[data-learning="tile"]')].find(item => item.textContent === text && !item.disabled); assert.ok(button, `available ${text} tile`); button.click(); },
    slots: () => [...root.querySelectorAll('.learn-slot')].map(item => item.textContent),
    draw() {
      const svg = root.querySelector('#learningPad');
      for (const [type, x, y] of [['pointerdown', 20, 40], ['pointermove', 100, 100], ['pointerup', 100, 100]]) {
        const event = new window.MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 });
        Object.defineProperties(event, { pointerId: { value: 1 }, pointerType: { value: 'mouse' }, isPrimary: { value: true } });
        svg.dispatchEvent(event);
      }
    },
    async flush() { await new Promise(resolve => setImmediate(resolve)); },
    returnToTask() { learning.destroy(); learning.resume(); },
    reload() { learning.destroy(); state = normalizeLearningState(JSON.parse(JSON.stringify(state))); learning = create(); learning.start(); },
    setLetters(next) { taughtLetters = [...next]; },
    done() {
      learning.destroy(); window.close();
      for (const [key, descriptor] of previous) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; }
    },
  };
}

test('an unaided writing task conceals its answer in the reason and accessible writing label', async () => {
  const f = await fixture({ kind: 'write' });
  try {
    assert.equal(f.initialTask.support, 1);
    assert.equal(f.root.querySelector('#learningModel').hidden, true);
    assert.doesNotMatch(f.root.querySelector('.learn-task-header').textContent, /nane/iu, 'the adaptive reason must not become a visible copying model');
    assert.doesNotMatch(f.root.querySelector('#learningPad').getAttribute('aria-label'), /nane/iu, 'screen-reader learners get the same unaided opportunity');
    f.draw(); f.click('review'); f.click('approve');
    const result = f.state().events.find(event => event.id === f.initialTask.id);
    assert.equal(result.independent, true, 'adult review of the same original ink remains eligible');
    assert.equal(result.writingReviewed, true);
  } finally { f.done(); }
});

test('opening a writing model is assistance even after the model is hidden and the task reloads', async () => {
  const f = await fixture({ kind: 'write' });
  try {
    f.click('show-model'); f.click('show-model'); f.reload();
    f.draw(); f.click('review'); f.click('approve');
    const result = f.state().events.find(event => event.id === f.initialTask.id);
    assert.equal(result.independent, false);
    assert.ok(result.hints > 0);
  } finally { f.done(); }
});

test('a visible restored writing model cannot gain independent credit from inconsistent saved counters', async () => {
  const f = await fixture({ kind: 'write' });
  try {
    f.click('show-model');
    Object.assign(f.state().session.results[f.initialTask.id], { hints: 0, independent: true, modelOpened: true });
    f.reload();
    assert.equal(f.root.querySelector('#learningModel').hidden, false);
    f.draw(); f.click('review'); f.click('approve');
    assert.equal(f.state().events.find(event => event.id === f.initialTask.id).independent, false);
  } finally { f.done(); }
});

test('editing ink after adult review exposed the target makes subsequent approval assisted', async () => {
  const f = await fixture({ kind: 'write' });
  try {
    f.draw(); f.click('review');
    assert.match(f.root.querySelector('#learningReview').textContent, /nane/iu);
    f.reload(); f.draw(); f.click('review'); f.click('approve');
    const result = f.state().events.find(event => event.id === f.initialTask.id);
    assert.equal(result.independent, false, 'a resumed edit must remember that the answer was already exposed');
    assert.ok(result.hints > 0);
  } finally { f.done(); }
});

test('partial repeated-letter assembly survives pause, return and reload without completing the task', async () => {
  const f = await fixture();
  try {
    f.tile('n');
    assert.deepEqual(f.slots(), ['n', '', '', '']);
    const selectedId = f.root.querySelector('[data-learning="tile"][disabled]').dataset.id;
    for (const restore of [() => { f.click('pause'); f.click('resume'); }, () => f.returnToTask(), () => f.reload()]) {
      restore();
      assert.deepEqual(f.slots(), ['n', '', '', '']);
      assert.equal(f.root.querySelector(`[data-learning="tile"][data-id="${selectedId}"]`).disabled, true, 'the same repeated-letter identity stays used');
      assert.equal(f.root.querySelector('#learningNext').disabled, true);
      assert.equal(f.state().events.some(event => event.id === f.initialTask.id), false);
      assert.equal(f.root.querySelector('#learning').dataset.taskId, f.initialTask.id);
    }
    for (const letter of ['a', 'n', 'e']) f.tile(letter);
    assert.equal(f.state().events.filter(event => event.id === f.initialTask.id).length, 1);
    assert.equal(f.root.querySelector('#learningNext').disabled, false);
  } finally { f.done(); }
});

test('undo and restart persist the updated partial assembly', async () => {
  const f = await fixture();
  try {
    f.tile('n'); f.tile('a'); f.click('undo'); f.reload();
    assert.deepEqual(f.slots(), ['n', '', '', '']);
    f.click('restart'); f.reload();
    assert.deepEqual(f.slots(), ['', '', '', '']);
    assert.equal(f.root.querySelectorAll('[data-learning="tile"][disabled]').length, 0);
  } finally { f.done(); }
});

test('a restored visible model retains assistance and a heard listening task retains choice eligibility', async () => {
  const build = await fixture();
  try {
    build.click('show-model'); build.tile('n'); build.reload();
    assert.equal(build.root.querySelector('#learningModel').hidden, false);
    assert.deepEqual(build.slots(), ['n', '', '', '']);
    for (const letter of ['a', 'n', 'e']) build.tile(letter);
    assert.equal(build.state().events.find(event => event.id === build.initialTask.id).independent, false);
  } finally { build.done(); }
  const listen = await fixture({ kind: 'listen', support: 0 });
  try {
    listen.click('listen'); await listen.flush(); listen.reload();
    listen.root.querySelector(`[data-learning="choice"][data-value="${listen.initialTask.target}"]`).click();
    assert.equal(listen.state().events.find(event => event.id === listen.initialTask.id)?.correct, true);
  } finally { listen.done(); }
});

test('changing taught letters abandons an ineligible saved task and its partial selection', async () => {
  const f = await fixture();
  try {
    f.tile('n'); f.setLetters(['e', 'l']); f.reload();
    if (f.root.querySelector('[data-learning="begin-tasks"]')) f.click('begin-tasks');
    assert.notEqual(f.root.querySelector('#learning').dataset.taskId, f.initialTask.id);
    assert.notEqual(f.root.querySelector('#learning').dataset.word, 'nane');
    assert.equal(f.slots().some(text => text === 'n'), false);
    assert.equal(f.state().events.some(event => event.id === f.initialTask.id), false);
    assert.equal(f.state().activeListId, 'starter');
  } finally { f.done(); }
});
