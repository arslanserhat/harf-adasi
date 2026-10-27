const { test } = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const { modelURL } = require('./model-loader.cjs');
const questsAPI = import(modelURL('quests.js'));
const learningAPI = import(modelURL('learning-model.js'));

async function fixture({ words = [{ text: 'alet' }, { text: 'ilan' }] } = {}) {
  const dom = new JSDOM('<body><button id="outside">Başka araç</button><main id="main"></main></body>', { url: 'https://example.test/', pretendToBeVisual: true });
  const { window } = dom;
  const globals = ['window', 'document', 'Element', 'innerHeight', 'innerWidth', 'requestAnimationFrame', 'cancelAnimationFrame'];
  const previous = new Map(globals.map(name => [name, Object.getOwnPropertyDescriptor(global, name)]));
  for (const name of globals) Object.defineProperty(global, name, { configurable: true, writable: true, value: typeof window[name] === 'function' && name.endsWith('AnimationFrame') ? window[name].bind(window) : window[name] });
  window.scrollTo = () => {};
  // jsdom implements real DOM and events, but has no rendered SVG geometry or
  // native dialog top layer. Supply just those missing platform boundaries.
  window.SVGSVGElement.prototype.createSVGPoint = function () { return { x: 0, y: 0 }; };
  window.SVGSVGElement.prototype.getScreenCTM = () => null;
  window.HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  window.HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); this.dispatchEvent(new window.Event('close')); };
  const { createLearningState } = await learningAPI;
  const state = createLearningState(1000);
  state.lists = [{ id: 'school', title: 'Okulum', words }];
  state.activeListId = 'school';
  let history = { version: 1, runs: [], active: null };
  let homeCount = 0;
  const root = window.document.querySelector('#main');
  const { createQuests } = await questsAPI;
  const quests = createQuests({ root, getLearningState: () => state, getLetters: () => ['a', 'l', 'e', 't', 'i', 'n'],
    getHistory: () => history, saveHistory: value => { history = structuredClone(value); }, onHome: () => { homeCount++; } });
  const click = action => {
    const target = root.querySelector(`[data-quest="${action}"]`);
    assert.ok(target, `${action} is available in the actual quest UI`);
    target.click();
  };
  const draw = () => {
    const svg = root.querySelector('#questPad');
    assert.ok(svg, 'the actual notebook is mounted');
    for (const [type, x, y] of [['pointerdown', 40, 70], ['pointermove', 90, 140], ['pointerup', 90, 140]]) {
      const event = new window.MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 });
      Object.defineProperties(event, { pointerId: { value: 1 }, pointerType: { value: 'pen' }, isPrimary: { value: true } });
      svg.dispatchEvent(event);
    }
  };
  const enterNotebook = () => {
    quests.start('letters', { fresh: true });
    click('hint');
    root.querySelector(`[data-quest="choice"][data-value="${quests.getSnapshot().plan.stages[0].target}"]`).click();
    click('next');
    assert.equal(root.querySelector('#quest').dataset.mechanic, 'write');
  };
  return { window, doc: window.document, root, quests, click, draw, enterNotebook,
    history: () => history, homes: () => homeCount,
    done() {
      quests.destroy(); window.close();
      for (const name of globals) {
        if (previous.get(name)) Object.defineProperty(global, name, previous.get(name));
        else delete global[name];
      }
    } };
}

test('rewriting removes real ink and keeps review disabled after pause and saved resume', async () => {
  const f = await fixture();
  try {
    f.enterNotebook(); f.draw();
    assert.equal(f.root.querySelector('[data-quest="review"]').disabled, false);
    assert.equal(f.history().active.ui.inkPaths.length, 1);
    f.click('review');
    assert.equal(f.root.querySelector('#questReview').hidden, false);
    f.click('clear');
    assert.equal(f.root.querySelectorAll('#questInk path').length, 0, 'clear must erase the actual painted stroke');
    assert.deepEqual(f.history().active.ui.inkPaths, []);
    assert.equal(f.history().active.ui.inkLength, 0);
    assert.equal(f.root.querySelector('[data-quest="review"]').disabled, true);
    assert.equal(f.root.querySelector('#questReview').hidden, true);
    f.click('pause'); f.click('resume');
    f.quests.destroy(); f.quests.start('letters');
    assert.equal(f.quests.getSnapshot().index, 1, 'resume keeps the current writing task');
    assert.equal(f.root.querySelectorAll('#questInk path').length, 0);
    assert.deepEqual(f.history().active.ui.inkPaths, []);
    assert.equal(f.root.querySelector('[data-quest="review"]').disabled, true);
    assert.equal(f.root.querySelector('#questNext').disabled, true, 'clearing never approves or advances handwriting');
  } finally { f.done(); }
});

test('pause focuses the modal, traps boundary keys, and Escape restores the same notebook', async () => {
  const f = await fixture();
  try {
    f.enterNotebook(); f.draw();
    const before = f.quests.getSnapshot();
    f.root.querySelector('[data-quest="pause"]').focus();
    f.click('pause');
    const dialog = f.root.querySelector('.quest-pause');
    assert.ok(dialog instanceof f.window.HTMLDialogElement && dialog.open, 'pause uses an open native modal');
    const resume = dialog.querySelector('[data-quest="resume"]');
    const home = dialog.querySelector('[data-quest="home"]');
    assert.equal(f.doc.activeElement, resume, 'the first keyboard target resumes the adventure');
    home.focus();
    home.dispatchEvent(new f.window.KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
    assert.equal(f.doc.activeElement, resume, 'Tab wraps from the final modal action');
    resume.dispatchEvent(new f.window.KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true }));
    assert.equal(f.doc.activeElement, home, 'Shift+Tab wraps from the first modal action');
    dialog.dispatchEvent(new f.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    assert.equal(f.root.querySelector('.quest-pause'), null);
    assert.equal(f.doc.activeElement, f.root.querySelector('[data-quest="pause"]'), 'focus returns to the replacement pause control');
    assert.equal(f.quests.getSnapshot().index, before.index);
    assert.deepEqual(f.quests.getSnapshot().ui.inkPaths, before.ui.inkPaths);
    assert.equal(f.root.querySelectorAll('#questInk path').length, 1);
    assert.equal(f.root.querySelector('#questNext').disabled, true);
  } finally { f.done(); }
});

test('paused background navigation cannot leave the adventure, and native cancel resumes it', async () => {
  const f = await fixture();
  try {
    f.enterNotebook(); f.draw();
    const before = f.quests.getSnapshot();
    f.click('pause');
    f.root.querySelector('.quest-nav [data-quest="home"]').click();
    assert.equal(f.homes(), 0, 'only controls in the pause dialog can act while paused');
    const dialog = f.root.querySelector('.quest-pause');
    assert.ok(dialog);
    dialog.dispatchEvent(new f.window.Event('cancel', { cancelable: true }));
    assert.equal(f.root.querySelector('.quest-pause'), null);
    assert.equal(f.doc.activeElement, f.root.querySelector('[data-quest="pause"]'));
    assert.equal(f.quests.getSnapshot().index, before.index);
    assert.deepEqual(f.quests.getSnapshot().ui.inkPaths, before.ui.inkPaths);
    f.click('pause');
    f.root.querySelector('.quest-pause [data-quest="home"]').click();
    assert.equal(f.homes(), 1, 'the explicit modal home action remains available');
    assert.equal(f.quests.active, false);
  } finally { f.done(); }
});

test('destroying a paused quest releases the modal before the host changes screens', async () => {
  const f = await fixture();
  try {
    f.enterNotebook(); f.draw(); f.click('pause');
    const dialog = f.root.querySelector('.quest-pause');
    f.quests.destroy();
    assert.equal(dialog.open, false, 'backgrounding or leaving must release the browser modal top layer');
    assert.equal(f.quests.active, false);
    assert.equal(f.history().active.ui.inkPaths.length, 1);
    f.quests.start('letters');
    assert.equal(f.root.querySelectorAll('#questInk path').length, 1);
    assert.equal(f.root.querySelector('#questNext').disabled, true);
  } finally { f.done(); }
});

test('emoji-only reading choices have distinct meaningful text alternatives, including saved older plans', async () => {
  const f = await fixture({ words: [{ text: 'teli', emoji: '🐟' }, { text: 'tala', emoji: '🐦' }] });
  try {
    f.quests.start('reading', { fresh: true });
    const labels = () => [...f.root.querySelectorAll('[data-quest="choice"]')].map(choice => choice.getAttribute('aria-label')).sort();
    assert.deepEqual(labels(), ['tala', 'teli'], 'a screen reader must be able to distinguish the two pictured objects');
    assert.deepEqual(f.quests.getSnapshot().plan.stages[0].options.map(option => option.accessibleLabel).sort(), ['tala', 'teli'], 'the plan carries alternatives through choice normalization');
    f.quests.destroy();
    // Plans saved before text alternatives were added remain resumable.
    for (const task of f.history().active.plan.stages) for (const option of task.options) delete option.accessibleLabel;
    f.quests.start('reading');
    assert.deepEqual(labels(), ['tala', 'teli']);
  } finally { f.done(); }
});

test('teacher-authored meanings remain the spoken alternative for pictured reading choices', async () => {
  const f = await fixture({ words: [{ text: 'teli', emoji: '🐟', meaning: 'Suda yaşayan hayvan' }, { text: 'tala', emoji: '🐦', meaning: 'Kanatlı hayvan' }] });
  try {
    f.quests.start('reading', { fresh: true });
    assert.deepEqual([...f.root.querySelectorAll('[data-quest="choice"]')].map(choice => choice.getAttribute('aria-label')).sort(), ['Kanatlı hayvan', 'Suda yaşayan hayvan']);
  } finally { f.done(); }
});
