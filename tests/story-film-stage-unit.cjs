const { test } = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const { modelURL } = require('./model-loader.cjs');

async function fixture(props = {}, options = {}) {
  const api = await import(modelURL('story-film-stage.js'));
  const dom = new JSDOM(`<body>${api.renderFilmStage(props)}</body>`, { pretendToBeVisual: true });
  const stage = dom.window.document.querySelector('.film-stage');
  assert.ok(stage, 'renderFilmStage must produce the illustrated stage');
  const controller = api.mountFilmStage(stage, options);
  return { stage, controller, done() { controller.dispose(); dom.window.close(); } };
}

test('film artwork uses the deployed asset base and escapes the spoken scene label', async () => {
  const f = await fixture({ assetBase: '/harf-adasi/', label: '<img src=x onerror=bad()>' });
  try {
    assert.equal(f.stage.querySelector('.film-stage-background').getAttribute('src'), '/harf-adasi/art/story-watermill-v1.png');
    assert.equal(f.stage.getAttribute('aria-label'), '<img src=x onerror=bad()>');
    assert.equal(f.stage.querySelector('button, input, [onclick], [onerror]'), null);
    assert.equal(f.stage.querySelectorAll('[data-film-actor]').length, 2);
    assert.ok(f.stage.querySelector('[data-film-actor="lion"] [data-film-joint="right-arm"]'));
    assert.ok(f.stage.querySelector('[data-film-actor="bird"] [data-film-joint="left-wing"]'));
  } finally { f.done(); }
});

test('reduced motion applies cue outcomes immediately, including visible prop changes', async () => {
  const f = await fixture({}, { reducedMotion: true });
  try {
    await f.controller.playCue('arrival');
    assert.equal(f.stage.querySelector('[data-film-actor="lion"]').dataset.filmPose, 'standing');
    await f.controller.playCue('open-gate');
    assert.equal(f.stage.querySelector('[data-film-prop="gate"]').dataset.filmState, 'open');
    await f.controller.playCue('clear-leaves');
    assert.equal(f.stage.querySelector('[data-film-prop="leaves"]').dataset.filmState, 'cleared');
    await f.controller.playCue('wheel-start');
    assert.equal(f.stage.querySelector('[data-film-prop="wheel"]').dataset.filmState, 'running');
    await f.controller.playCue('flower-grow');
    assert.equal(f.stage.querySelector('[data-film-prop="plant"]').dataset.filmState, 'flower');
    assert.equal(f.stage.dataset.filmCue, 'flower-grow');
    assert.equal(f.stage.dataset.filmAnimating, 'false');
  } finally { f.done(); }
});

test('only the current voiced character moves its mouth and paused stages stop that motion', async () => {
  const f = await fixture();
  try {
    f.controller.setSpeaking('lion');
    assert.equal(f.stage.querySelector('[data-film-actor="lion"]').dataset.filmSpeaking, 'true');
    assert.equal(f.stage.querySelector('[data-film-actor="bird"]').dataset.filmSpeaking, 'false');
    f.controller.setSpeaking('bird');
    assert.equal(f.stage.querySelector('[data-film-actor="lion"]').dataset.filmSpeaking, 'false');
    assert.equal(f.stage.querySelector('[data-film-actor="bird"]').dataset.filmSpeaking, 'true');
    f.controller.setPaused(true);
    assert.equal(f.stage.dataset.filmPaused, 'true');
    f.controller.setSpeaking(null);
    assert.equal(f.stage.querySelector('[data-film-actor="bird"]').dataset.filmSpeaking, 'false');
  } finally { f.done(); }
});

test('pausing keeps a cue pending and disposal resolves the pending cue without future mutations', async () => {
  const f = await fixture({}, { paused: true });
  try {
    let complete = false;
    const cue = f.controller.playCue('open-gate').then(() => { complete = true; });
    await new Promise(resolve => setTimeout(resolve, 35));
    assert.equal(complete, false);
    assert.equal(f.stage.querySelector('[data-film-prop="gate"]').dataset.filmState, 'closed');
    f.controller.dispose();
    await cue;
    const stopped = f.stage.outerHTML;
    await new Promise(resolve => setTimeout(resolve, 35));
    assert.equal(f.stage.outerHTML, stopped);
    assert.equal(complete, true);
  } finally { f.done(); }
});

test('rerendered story progress starts with the correct visible props and no autonomous cue', async () => {
  const f = await fixture({ scene: 5, millRunning: true, gateOpen: true, leafCount: 0, flowerGrown: true });
  try {
    assert.equal(f.stage.querySelector('[data-film-prop="gate"]').dataset.filmState, 'open');
    assert.equal(f.stage.querySelector('[data-film-prop="leaves"]').dataset.filmState, 'cleared');
    assert.equal(f.stage.querySelector('[data-film-prop="plant"]').dataset.filmState, 'flower');
    assert.equal(f.stage.dataset.filmAnimating, 'false');
  } finally { f.done(); }
});

test('the chosen garden bed moves the actual sapling and the watering action to that bed', async () => {
  const f = await fixture({ garden: 'left' }, { reducedMotion: true });
  try {
    const plant = f.stage.querySelector('[data-film-prop="plant"]');
    const leftBed = plant.getAttribute('transform');
    await f.controller.playCue('water-garden');
    const leftCan = f.stage.querySelector('[data-film-prop="watering-can"]').style.transform;
    f.controller.update({ garden: 'right' });
    assert.notEqual(plant.getAttribute('transform'), leftBed);
    await f.controller.playCue('water-garden');
    assert.notEqual(f.stage.querySelector('[data-film-prop="watering-can"]').style.transform, leftCan);
  } finally { f.done(); }
});

test('a global static-art preference finishes pending motion and remains safe to dispose', async () => {
  const f = await fixture();
  try {
    const pending = f.controller.playCue('arrival');
    f.stage.ownerDocument.body.dataset.motionPaused = 'true';
    await Promise.race([pending, new Promise((_, reject) => setTimeout(() => reject(Error('static-art preference left a cue waiting')), 150))]);
    assert.equal(f.stage.dataset.filmReducedMotion, 'true');
    assert.equal(f.stage.dataset.filmAnimating, 'false');
  } finally { f.done(); }
});

test('restored running-mill progress includes the water already delivered to the garden', async () => {
  const f = await fixture({ scene: 5, millRunning: true, flowerGrown: true }, { paused: true });
  try {
    assert.equal(f.stage.querySelector('[data-film-prop="garden-water"]').dataset.filmState, 'flowing');
    assert.equal(f.stage.querySelector('[data-film-prop="garden-water"]').style.opacity, '1');
  } finally { f.done(); }
});

test('the physical garden label and ribbon follow choices, then conceal the answer during recall', async () => {
  const f = await fixture({ label: 'lale', ribbon: 'coral' }, { reducedMotion: true });
  try {
    const label = f.stage.querySelector('[data-film-prop="label"]');
    assert.ok(label, 'the named plant needs its own physical wooden label');
    assert.equal(label.querySelector('text').textContent, 'lale');
    assert.ok(label.querySelector('[data-film-prop="ribbon"]'));
    f.controller.update({ label: '', ribbon: 'gold' });
    assert.equal(label.style.opacity, '0');
    assert.equal(label.querySelector('text').textContent, '');
    assert.ok(f.stage.getAttribute('aria-label').length > 10, 'a concealed answer still needs a useful scene description');
    assert.doesNotMatch(f.stage.getAttribute('aria-label'), /lale/iu);
    f.controller.update({ label: 'lale' });
    assert.equal(label.style.opacity, '1');
    assert.equal(label.querySelector('text').textContent, 'lale');
    assert.equal(f.stage.dataset.filmRibbon, 'gold');
  } finally { f.done(); }
});

test('a running wheel can precede garden watering, and explicit watered progress survives restoration', async () => {
  const f = await fixture({ scene: 4, millRunning: true, watered: false }, { paused: true });
  try {
    const channel = f.stage.querySelector('[data-film-prop="garden-water"]');
    assert.equal(channel.style.opacity, '0', 'wheel startup must not finish the later gardening action');
    f.controller.update({ watered: true });
    assert.equal(channel.style.opacity, '1');
    assert.equal(channel.dataset.filmState, 'flowing');
    f.controller.update({ watered: false });
    assert.equal(channel.dataset.filmState, 'dry');
  } finally { f.done(); }
});
