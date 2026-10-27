const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const { modelURL } = require('./model-loader.cjs');
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
async function fixture({ eligible = true, speak = async () => false, saved } = {}) {
  const dom = new JSDOM('<body><button id="outside">Ada</button><main id="main"></main></body>', { url: 'https://example.test/', pretendToBeVisual: true });
  const { window } = dom;
  const names = ['window', 'document', 'Element', 'requestAnimationFrame', 'cancelAnimationFrame'];
  const previous = new Map(names.map(name => [name, Object.getOwnPropertyDescriptor(global, name)]));
  for (const name of names) Object.defineProperty(global, name, { configurable: true, writable: true,
    value: name.endsWith('AnimationFrame') ? window[name].bind(window) : window[name] });
  window.matchMedia = () => ({ matches: true }); window.scrollTo = () => {};
  window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  window.HTMLDialogElement.prototype.close = function () { this.open = false; };
  const root = window.document.querySelector('#main');
  const file = path.join(__dirname, '../src/story-film.js');
  const api = fs.existsSync(file) ? await import(modelURL('story-film.js')) : {};
  assert.equal(typeof api.createStoryFilm, 'function', 'actual film controller exists');
  const learning = { activeListId: 'school', lists: [{ id: 'school', words: eligible ? [{ text: 'lale', parts: ['la', 'le'] }] : [] }] };
  let letters = eligible ? ['l', 'a', 'e'] : ['a'];
  if (saved) window.localStorage.setItem('harf-adasi-story-film-v1', JSON.stringify(saved));
  const attempts = []; let stopCount = 0;
  const film = api.createStoryFilm({ root, getLetters: () => letters, getLearningState: () => learning,
    speak, stopSpeech: () => { stopCount++; }, isMuted: () => false, onAttempt: event => attempts.push(event) });
  const click = async (action, value) => {
    const selector = `[data-film="${action}"]${value === undefined ? '' : `[data-value="${value}"]`}`;
    const target = root.querySelector(selector); assert.ok(target, `${selector} is offered`); target.click(); await tick();
  };
  const skip = () => click('skip');
  const draw = () => {
    const svg = root.querySelector('#filmPad'); assert.ok(svg);
    for (const [type, x, y] of [['pointerdown', 35, 65], ['pointermove', 105, 90], ['pointerup', 105, 90]]) {
      const event = new window.MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 });
      Object.defineProperties(event, { pointerId: { value: 1 }, isPrimary: { value: true } }); svg.dispatchEvent(event);
    }
  };
  return { window, root, film, click, skip, draw, attempts, setLetters: next => { letters = next; }, stops: () => stopCount,
    save: () => JSON.parse(window.localStorage.getItem('harf-adasi-story-film-v1')),
    done() { film.destroy(); window.close(); for (const name of names) { if (previous.get(name)) Object.defineProperty(global, name, previous.get(name)); else delete global[name]; } } };
}

async function toLeaves(f) {
  f.film.start(); await f.click('start-learn'); await f.skip();
  await f.click('garden', 'right'); await f.click('next'); await f.skip();
  await f.click('branch', 'lion'); await f.click('next'); await f.skip();
  await f.click('token', 'la'); await f.click('token', 'le'); await f.click('check');
  await f.click('next'); await f.skip();
}

async function toRecall(f) {
  await toLeaves(f);
  for (let index = 0; index < 4; index++) await f.click('leaf', String(index));
  await f.click('cause', 'leaves'); await f.click('next'); await f.skip();
}

function instructionAreas(f) {
  return [...f.root.querySelectorAll('.film-subtitle,.film-task-title,.film-leaf-instruction')]
    .filter(element => !element.closest('[hidden]') && f.window.getComputedStyle(element).display !== 'none');
}

function addFilmStyles(f) {
  const style = f.window.document.createElement('style');
  style.textContent = fs.readFileSync(path.join(__dirname, '../src/story-film.css'), 'utf8');
  f.window.document.head.append(style);
}

test('leaf instructions use one visible card before and after replay, collection and restoration', async () => {
  const spoken = [];
  const f = await fixture({ speak: async text => { spoken.push(text); return false; } });
  try {
    addFilmStyles(f); await toLeaves(f);
    assert.equal(instructionAreas(f).length, 1, 'leaves must not repeat a caption, task heading and helper paragraph');
    assert.equal(f.root.querySelectorAll('.film-instruction').length, 1);
    assert.equal(f.root.querySelector('.film-leaf-instruction'), null);
    assert.match(instructionAreas(f)[0].textContent, /Dört yaprağı sepete topla/);
    assert.ok(f.root.querySelector('.film-instruction [data-film="replay"]'));
    await f.click('replay');
    assert.equal(instructionAreas(f).length, 1);
    assert.equal(instructionAreas(f)[0].textContent, spoken.at(-1), 'the same instruction text becomes the actual spoken line');
    assert.match(instructionAreas(f)[0].textContent, /Ben tek başıma çekemedim/);
    assert.equal(f.window.getComputedStyle(f.root.querySelector('.film-subtitle')).display, 'none', 'author display styles must not override the hidden caption');
    assert.equal(f.root.querySelector('.film-subtitle').textContent, '', 'the redundant caption also stays out of accessible text');
    await f.click('leaf', '0');
    assert.equal(instructionAreas(f).length, 1);
    await f.click('replay'); await f.click('pause'); await f.click('resume');
    assert.equal(instructionAreas(f).length, 1);
    f.film.destroy(); f.film.resume();
    assert.equal(instructionAreas(f).length, 1, 'returning from host settings restores only one task instruction');
    assert.equal(f.root.querySelectorAll('[data-film="leaf"]').length, 3);
  } finally { f.done(); }
});

test('character dialogue keeps its caption bar while task phases use only their instruction card', async () => {
  const f = await fixture();
  try {
    addFilmStyles(f); f.film.start(); await f.click('start-learn');
    assert.equal(f.root.querySelector('.film-subtitle').hidden, false);
    assert.match(f.root.querySelector('.film-subtitle p').textContent, /Harf Adası’nda yeni bir gün/);
    assert.equal(f.root.querySelector('.film-instruction'), null);
    assert.equal(instructionAreas(f).length, 1);
    await f.skip();
    assert.equal(f.root.querySelector('.film-subtitle').hidden, true);
    assert.equal(instructionAreas(f).length, 1);
    assert.match(f.root.querySelector('.film-task-title').textContent, /Çiçeğimiz için bir bahçe/);
    await f.click('garden', 'left'); await f.click('next');
    assert.equal(f.root.querySelector('.film-subtitle').hidden, false);
    assert.equal(f.root.querySelector('.film-instruction'), null);
    assert.equal(instructionAreas(f).length, 1);
  } finally { f.done(); }
});

test('assisted task speech updates the one instruction card without exposing an unaided answer', async () => {
  const f = await fixture();
  try {
    await toRecall(f);
    assert.doesNotMatch(f.root.textContent, /lale/iu);
    assert.equal(instructionAreas(f).length, 1);
    await f.click('help');
    assert.equal(instructionAreas(f).length, 1);
    assert.match(f.root.querySelector('.film-task-title').textContent, /^Çiçeğimizin adı lale\./);
    assert.equal(f.save().tasks.recall.hints, 1);
    assert.equal(f.save().tasks.recall.assisted, true);
  } finally { f.done(); }
});

test('the cover never starts speech and unavailable teacher content offers watch mode without credit', async () => {
  let calls = 0; const f = await fixture({ eligible: false, speak: async () => { calls++; return false; } });
  try {
    f.film.start(); assert.equal(calls, 0);
    assert.equal(f.root.querySelector('[data-film="start-learn"]').disabled, true);
    assert.match(f.root.textContent, /l, a, e/);
    await f.click('start-watch'); await f.skip(); await f.click('garden', 'left'); await f.click('next'); await f.skip();
    await f.click('branch', 'bird'); await f.click('next'); await f.skip(); await f.click('watch-guided');
    assert.deepEqual(f.attempts, []); assert.equal(f.save().mode, 'watch');
  } finally { f.done(); }
});

test('animation skip stops at real checkpoints and delayed recall does not expose the target', async () => {
  const f = await fixture();
  try {
    await toRecall(f);
    assert.equal(f.root.querySelector('#storyFilm').dataset.scene, '4');
    assert.equal(f.root.querySelector('#storyFilm').dataset.task, 'recall');
    assert.equal(/lale/i.test(f.root.textContent), false, 'no caption, stage label or stale guided answer exposes recall');
    assert.equal(f.root.querySelector('[data-film="next"]').disabled, true);
    assert.ok(f.root.querySelector('[data-film="replay"]'), 'the current spoken task prompt can be replayed');
    assert.deepEqual(f.attempts.map(event => event.skill), ['syllables']);
    for (const letter of ['l', 'a', 'l', 'e']) await f.click('token', letter);
    await f.click('check');
    assert.equal(f.root.querySelector('#storyFilm').dataset.task, 'write');
    assert.equal(/lale/i.test(f.root.textContent), false, 'the independently recalled answer is hidden before handwriting');
    assert.equal(f.attempts[1].independent, true);
  } finally { f.done(); }
});

test('real pen ink erases, survives pause as empty, and needs a fresh adult review', async () => {
  const f = await fixture();
  try {
    await toRecall(f); for (const letter of ['l', 'a', 'l', 'e']) await f.click('token', letter); await f.click('check');
    f.draw(); assert.equal(f.root.querySelectorAll('#filmInk path').length, 1);
    await f.click('review'); assert.equal(f.root.querySelector('#filmReview').hidden, false);
    await f.click('clear');
    assert.equal(f.root.querySelectorAll('#filmInk path').length, 0);
    assert.deepEqual(f.save().tasks.write.ink, []);
    assert.equal(f.root.querySelector('[data-film="review"]').disabled, true);
    await f.click('pause'); assert.equal(f.root.querySelector('dialog').open, true);
    await f.click('resume'); assert.equal(f.root.querySelectorAll('#filmInk path').length, 0);
    f.draw(); await f.click('review'); await f.click('approve');
    assert.equal(f.attempts.at(-1).skill, 'write'); assert.equal(f.attempts.at(-1).independent, false);
    assert.equal(f.attempts.at(-1).writingReviewed, true);
  } finally { f.done(); }
});

test('a late speech completion after destroy cannot advance or write a learning event', async () => {
  let finish; const f = await fixture({ speak: () => new Promise(resolve => { finish = resolve; }) });
  try {
    f.film.start(); await f.click('start-learn'); const before = f.save();
    f.film.destroy(); finish(true); await tick();
    assert.equal(f.film.active, false); assert.equal(f.save().cursor, before.cursor); assert.deepEqual(f.attempts, []);
  } finally { f.done(); }
});

test('changed teacher prerequisites downgrade a resumed learning film to watch without events', async () => {
  const f = await fixture();
  try {
    await toRecall(f); f.setLetters(['a']); f.film.resume(); await tick();
    assert.equal(f.save().mode, 'watch'); assert.match(f.root.textContent, /izleme/i);
    assert.deepEqual(f.attempts.map(event => event.skill), ['syllables']);
  } finally { f.done(); }
});

test('destroy then resume revives the saved partial task with exactly one active event listener', async () => {
  const f = await fixture();
  try {
    await toRecall(f); await f.click('token', 'l'); await f.click('token', 'a');
    f.film.destroy(); assert.equal(f.film.active, false);
    f.film.resume(); assert.equal(f.film.active, true);
    assert.equal(f.root.querySelector('#storyFilm').dataset.task, 'recall');
    assert.equal(f.save().tasks.recall.selected.join(''), 'la');
    await f.click('token', 'l');
    assert.equal(f.save().tasks.recall.selected.join(''), 'lal', 'restoring must not double-bind the controller');
    f.film.destroy(); f.film.resume(); await f.click('token', 'e'); await f.click('check');
    assert.deepEqual(f.attempts.map(item => item.skill), ['syllables', 'recall']);
  } finally { f.done(); }
});

test('a complete real film keeps all choices visible and emits only three eligible checkpoint events', async () => {
  const f = await fixture();
  try {
    await toRecall(f);
    for (const letter of ['l', 'a', 'l', 'e']) await f.click('token', letter);
    await f.click('check'); f.draw(); await f.click('review'); await f.click('approve'); await f.click('read-done');
    await f.click('next'); await f.skip(); await f.click('ribbon', 'gold'); await f.click('next');
    assert.equal(f.save().phase, 'complete');
    assert.deepEqual(f.save().choices, { garden: 'right', branch: 'lion', ribbon: 'gold' });
    assert.deepEqual(f.attempts.map(item => item.skill), ['syllables', 'recall', 'write']);
    assert.equal(new Set(f.attempts.map(item => item.id)).size, 3);
    assert.match(f.root.textContent, /Sağdaki bahçede/); assert.match(f.root.textContent, /sarı kurdele/);
    f.film.destroy(); f.film.resume();
    assert.equal(f.save().phase, 'complete'); assert.equal(f.attempts.length, 3);
  } finally { f.done(); }
});

test('keyboard token focus survives redraw and Escape returns focus to the restored writing pad', async () => {
  const f = await fixture();
  try {
    await toRecall(f);
    f.root.querySelector('[data-film="token"][data-value="l"]').focus();
    await f.click('token', 'l');
    assert.equal(f.window.document.activeElement?.dataset.value, 'l');
    assert.equal(f.window.document.activeElement?.dataset.film, 'token');
    for (const letter of ['a', 'l', 'e']) await f.click('token', letter);
    await f.click('check');
    f.root.querySelector('#filmPad').focus();
    f.root.querySelector('#filmPad').dispatchEvent(new f.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    assert.equal(f.root.querySelector('.film-pause').open, true);
    await f.click('resume');
    assert.equal(f.window.document.activeElement?.id, 'filmPad');
  } finally { f.done(); }
});

test('an older interrupted task voice cannot close the mouth of the newer active voice', async () => {
  const pending = [];
  const f = await fixture({ speak: text => text.startsWith('Çiçeğimizin adı lale.') || text.startsWith('Şimdi aynı kelimeyi aşağıya')
    ? new Promise(resolve => pending.push(resolve)) : Promise.resolve(false) });
  try {
    await toRecall(f); await f.click('help');
    for (const letter of ['l', 'a', 'l', 'e']) await f.click('token', letter);
    await f.click('check');
    assert.equal(pending.length, 2);
    assert.equal(f.root.querySelector('.film-stage').dataset.filmSpeaking, 'lion');
    pending[0](false); await tick();
    assert.equal(f.root.querySelector('.film-stage').dataset.filmSpeaking, 'lion');
    pending[1](false); await tick();
    assert.equal(f.root.querySelector('.film-stage').dataset.filmSpeaking, '');
  } finally { f.done(); }
});

test('reset discards film completion IDs and starts a fresh cover without playback', async () => {
  const f = await fixture();
  try {
    await toRecall(f); const old = f.save(); assert.ok(old.emitted.length);
    assert.equal(typeof f.film.reset, 'function'); f.film.reset();
    assert.equal(f.film.active, false); assert.notEqual(f.save().runId, old.runId);
    assert.deepEqual(f.save().emitted, []); assert.equal(f.save().phase, 'cover');
    f.film.start(); assert.equal(f.root.querySelector('#storyFilm').dataset.screen, 'cover');
    assert.equal(f.root.querySelector('[data-film="continue-film"]'), null);
  } finally { f.done(); }
});
