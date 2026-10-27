const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const { modelURL } = require('./model-loader.cjs');
const KEY = 'harf-adasi-sentence-practice-v1';
const LINES = ['Anne elinle nane at.', 'İnal anten al.', 'Lale tane tane anlat.', 'Ali tatili ilan et.', 'Nil ala atlet al.'];
const tick = () => new Promise(resolve => setImmediate(resolve));

async function fixture({ text = LINES[2], speak, saved, sentences = LINES } = {}) {
  const dom = new JSDOM('<body><main id="main"></main></body>', { url: 'https://example.test/', pretendToBeVisual: true });
  const { window } = dom, root = window.document.querySelector('#main');
  window.scrollTo = () => {};
  window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  window.HTMLDialogElement.prototype.close = function () { this.open = false; };
  const globals = { window, document: window.document, Element: window.Element, MutationObserver: window.MutationObserver,
    requestAnimationFrame: window.requestAnimationFrame.bind(window), cancelAnimationFrame: window.cancelAnimationFrame.bind(window) };
  const previous = new Map(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
  const filename = path.resolve(__dirname, '../src/sentence-practice.js');
  const api = fs.existsSync(filename) ? await import(modelURL('sentence-practice.js')) : {};
  assert.equal(typeof api.createSentencePractice, 'function', 'the real sentence practice controller exists');
  let scope = 'school', pool = [...sentences];
  const spoken = [], spokenOptions = [], completed = [], exposed = [];
  if (saved) window.localStorage.setItem(KEY, JSON.stringify(saved));
  const create = () => api.createSentencePractice({ root, getContext: () => ({ scope, sentences: pool }),
    speak: speak || (async (value, options) => { spoken.push(value); spokenOptions.push(options); return true; }), stopSpeech() {},
    onComplete: event => completed.push(event), onExposure: event => exposed.push(event) });
  let practice = create(); practice.start(text, { source: 'teacher' });
  return { root, window, spoken, spokenOptions, completed, exposed,
    click(action, id) { const control = root.querySelector(`[data-sentence="${action}"]${id === undefined ? '' : `[data-id="${id}"]`}`); assert.ok(control, action); control.click(); },
    state: () => JSON.parse(window.localStorage.getItem(KEY)),
    draw() { const svg = root.querySelector('#sentencePad'); assert.ok(svg); for (const [type, x, y] of [['pointerdown', 35, 65], ['pointermove', 165, 90], ['pointerup', 165, 90]]) {
      const event = new window.MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 });
      Object.defineProperties(event, { pointerId: { value: 1 }, isPrimary: { value: true } }); svg.dispatchEvent(event);
    } },
    restore() { practice.destroy(); practice = create(); practice.resume(); },
    invalidate() { scope = 'other-list'; pool = ['Anne nane al.']; practice.resume(); },
    destroy() { practice.destroy(); },
    done() { practice.destroy(); window.close(); for (const [key, descriptor] of previous) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; } },
  };
}

function read(f) { f.click('read-confirm'); f.click('read-next'); }
function build(f) { for (const id of [0, 1, 2, 3]) f.click('tile', id); f.click('build-next'); }

test('sentences can be read repeatedly and word audio preserves literal lesson names', async () => {
  const f = await fixture({ text: LINES[1] });
  try {
    assert.equal(f.root.querySelector('.sentence-reading-line').textContent, 'İnal anten al.');
    f.click('listen'); f.click('listen'); f.click('word', 0); await tick();
    assert.deepEqual(f.spoken, ['İnal anten al.', 'İnal anten al.', 'İnal']);
    assert.ok(f.spokenOptions.every(options => options?.literal === true), 'full-sentence and word playback are always literal learning targets');
    assert.equal(f.state().readCount, 0, 'listening does not manufacture a reading observation');
    for (let index = 0; index < 4; index++) f.click('read-confirm');
    assert.equal(f.state().readCount, 4); assert.equal(f.completed.length, 0);
    assert.match(f.root.textContent, /birlikte/i);
  } finally { f.done(); }
});

test('the live profile decorator keeps all authored lesson names literal through reading, writing and adult review', async () => {
  const text = 'Alparslan ile adım adım öğrenelim.';
  const f = await fixture({ text, sentences: [text] });
  const { createChildProfileStore, mountChildProfiles } = await import(modelURL('child-profile.js'));
  const store = createChildProfileStore({ storage: f.window.localStorage, eventTarget: f.window });
  store.save('Alp');
  const narration = f.window.document.createElement('p'); narration.textContent = text; f.window.document.body.append(narration);
  const unmount = mountChildProfiles({ root: f.window.document.body, store });
  try {
    await tick();
    assert.equal(narration.textContent, 'Alp ile adım adım öğrenelim.', 'authored narration still personalizes');
    assert.equal(f.root.querySelector('.sentence-reading-line').textContent, text);
    const first = f.root.querySelector('[data-sentence="word"]');
    assert.equal(first.textContent, 'Alparslan');
    assert.equal(first.getAttribute('aria-label'), 'Alparslan kelimesini dinle');
    store.save('İdil'); await tick();
    assert.equal(narration.textContent, 'İdil ile adım adım öğrenelim.');
    assert.equal(f.root.querySelector('.sentence-reading-line').textContent, text);
    read(f); await tick();
    assert.equal(f.root.querySelector('.sp-model').textContent, text);
    for (const id of [0, 1, 2, 3, 4]) f.click('tile', id);
    await tick();
    assert.equal(f.root.querySelector('.sentence-slot').textContent, 'Alparslan');
    f.click('build-next'); await tick();
    assert.equal(f.root.querySelector('#sentenceModel').textContent, text);
    f.draw(); f.click('review'); await tick();
    store.save('Nil'); await tick();
    assert.equal(f.root.querySelector('#sentenceReview p').textContent, text);
    f.click('approve'); await tick();
    assert.equal(f.root.querySelector('.sentence-reading-line').textContent, text);
    assert.equal(f.completed[0].text, text);
  } finally { unmount(); store.destroy(); f.done(); }
});

test('read-build-write uses distinct duplicate tokens and requires actual ink plus adult approval', async () => {
  const f = await fixture();
  try {
    read(f); f.click('tile', 0); f.click('tile', 1);
    assert.equal(f.root.querySelector('[data-sentence="tile"][data-id="1"]').disabled, true);
    assert.equal(f.root.querySelector('[data-sentence="tile"][data-id="2"]').disabled, false);
    f.click('tile', 2); f.click('tile', 3); f.click('build-next');
    assert.equal(f.root.querySelector('#sentencePad').getAttribute('viewBox'), '0 0 1000 480');
    assert.equal(f.root.querySelector('[data-sentence="review"]').disabled, true);
    f.click('review'); assert.equal(f.completed.length, 0);
    f.draw(); f.click('review'); assert.equal(f.root.querySelector('#sentenceReview').hidden, false);
    f.click('approve');
    assert.equal(f.completed.length, 1); assert.equal(f.completed[0].text, 'Lale tane tane anlat.');
    assert.equal(f.completed[0].writingReviewed, true); assert.equal(f.completed[0].independent, false);
    f.click('next'); assert.notEqual(f.state().text, 'Lale tane tane anlat.');
    assert.equal(f.state().source, 'teacher'); assert.equal(f.state().step, 'read');
  } finally { f.done(); }
});

test('validated sentence progress survives restore and current-list changes discard stale work', async () => {
  const f = await fixture();
  try {
    read(f); f.click('tile', 0); f.click('tile', 1); f.restore();
    assert.deepEqual(f.state().selected, [0, 1]); assert.equal(f.root.querySelectorAll('.sentence-slot.filled').length, 2);
    f.click('tile', 2); f.click('tile', 3); f.click('build-next'); f.draw(); f.restore();
    assert.equal(f.root.querySelectorAll('#sentenceInk path').length, 1);
    assert.equal(f.completed.length, 0);
    f.invalidate(); assert.equal(f.root.querySelector('#sentencePad'), null);
    assert.equal(f.state(), null); assert.equal(f.completed.length, 0);
    assert.doesNotMatch(f.root.textContent, /Lale tane tane anlat\./);
  } finally { f.done(); }
});

test('copy model can be hidden and clearing review ink requires fresh adult approval', async () => {
  const f = await fixture();
  try {
    read(f); build(f); f.click('model');
    assert.equal(f.root.querySelector('#sentenceModel').hidden, true);
    f.draw(); f.click('review'); f.click('clear');
    assert.equal(f.root.querySelectorAll('#sentenceInk path').length, 0);
    assert.equal(f.root.querySelector('[data-sentence="review"]').disabled, true);
    assert.equal(f.completed.length, 0);
    f.restore(); assert.equal(f.root.querySelector('#sentenceModel').hidden, true);
  } finally { f.done(); }
});

test('a late sentence voice completion after exit never counts reading or completion', async () => {
  let finish;
  const f = await fixture({ speak: () => new Promise(resolve => { finish = resolve; }) });
  try {
    f.click('listen'); await tick(); const before = f.state(); f.destroy(); finish(true); await tick();
    assert.deepEqual(f.state(), before); assert.equal(f.completed.length, 0);
  } finally { f.done(); }
});

test('pausing a sentence notebook restores keyboard focus to the writing pad', async () => {
  const f = await fixture();
  try {
    read(f); build(f); f.root.querySelector('#sentencePad').focus();
    f.click('pause'); f.click('resume');
    assert.equal(f.window.document.activeElement.id, 'sentencePad');
  } finally { f.done(); }
});

test('adult sentence review moves keyboard focus into the review controls', async () => {
  const f = await fixture();
  try {
    read(f); build(f); f.draw(); f.click('review');
    assert.equal(f.window.document.activeElement.dataset.sentence, 'approve');
  } finally { f.done(); }
});

test('completion cycles only through the explicitly saved active teacher sentences', async () => {
  const { createLearningState } = await import(modelURL('learning-model.js'));
  const { getTeacherLibrary } = await import(modelURL('teacher-library.js'));
  const own = [LINES[2], LINES[3]], state = createLearningState();
  state.lists = [{ id: 'mine', title: 'Benim cümlelerim', words: [{ text: 'nane', sentence: 'Anne nane al.' }], sentences: own },
    { id: 'other', title: 'Diğer liste', words: [], sentences: ['Nil ala atlet al.'] }];
  state.activeListId = 'mine';
  const pool = getTeacherLibrary(state, ['a', 'n', 'e', 't', 'i', 'l']).sentences.map(item => item.text);
  assert.deepEqual(pool, own);
  const f = await fixture({ text: own[0], sentences: pool });
  try {
    for (const next of [own[1], own[0]]) {
      read(f); build(f); f.draw(); f.click('review'); f.click('approve'); f.click('next');
      assert.equal(f.state().text, next);
      assert.equal(f.state().source, 'teacher');
      assert.equal(f.root.querySelector('.sentence-reading-line').textContent, next);
    }
  } finally { f.done(); }
});

test('malformed saved token identities and out-of-bounds ink cannot restore a completed sentence', async () => {
  const f = await fixture({ saved: { version: 1, runId: 'draft', scope: 'school', source: 'teacher', text: LINES[2],
    step: 'complete', readCount: 1, selected: [0, 1, 1, 3], ink: ['M 0 0 L 1001 100'], writingReviewed: true } });
  try {
    assert.equal(f.state().step, 'build'); assert.deepEqual(f.state().selected, []); assert.deepEqual(f.state().ink, []);
    assert.equal(f.root.querySelector('[data-sentence="build-next"]').disabled, true);
    assert.equal(f.completed.length, 0);
  } finally { f.done(); }
});
