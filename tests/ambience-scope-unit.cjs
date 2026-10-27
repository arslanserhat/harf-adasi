const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const { JSDOM } = require(process.env.AMBIENCE_DOM_MODULE || 'jsdom');
const { modelURL } = require('./model-loader.cjs');

// This suite uses a real DOM, without starting a browser. jsdom may be supplied
// from a separate local dependency folder through AMBIENCE_DOM_MODULE.
const home = '<div class="home-shell"><section class="home-island-hero"><div class="home-island-art"></div></section><div class="home-section-heading"><h2>Macera dünyaları</h2></div><div class="home-section-heading"><h2>Keşfet</h2></div><button>Başla</button></div>';
const task = '<section id="learning" class="learning" data-screen="task"><div class="learn-nav"><button>Adaya dön</button><span>Kendi hızında</span></div><div class="learn-panel"><button>Cevap</button></div></section>';
const waitForScan = () => new Promise(resolve => setTimeout(resolve, 45));

async function withAmbience(markup, run) {
  const dom = new JSDOM(`<html><head></head><body><main id="main">${markup}</main><footer>Harf Adası</footer></body></html>`, { pretendToBeVisual: true });
  const { window } = dom;
  const media = new window.EventTarget();
  media.matches = false;
  window.matchMedia = () => media;
  const globals = {
    window, document: window.document, Element: window.Element,
    MutationObserver: window.MutationObserver,
    requestAnimationFrame: window.requestAnimationFrame.bind(window),
    cancelAnimationFrame: window.cancelAnimationFrame.bind(window),
    getComputedStyle: window.getComputedStyle.bind(window),
    innerWidth: window.innerWidth, innerHeight: window.innerHeight,
  };
  const previous = new Map(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
  const style = window.document.createElement('style');
  style.textContent = fs.readFileSync(path.resolve(__dirname, '../src/world-ambience.css'), 'utf8');
  window.document.head.appendChild(style);
  let destroy;
  try {
    const { mountWorldAmbience } = await import(modelURL('world-ambience.js'));
    destroy = mountWorldAmbience();
    await waitForScan();
    await run({ window, document: window.document, media, destroy });
  } finally {
    destroy?.();
    dom.window.close();
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  }
}

test('moving from home into a lesson removes decorative animals and global tap effects', async () => {
  await withAmbience(home, async ({ document, window }) => {
    assert.equal(document.querySelectorAll('.world-site-pet').length, 6);
    const main = document.querySelector('#main');
    main.innerHTML = task;
    await waitForScan();
    assert.equal(main.querySelectorAll('.world-site-pet').length, 0, 'lesson navigation and scene receive no decorative animals');
    assert.equal(getComputedStyle(document.querySelector('.world-ambience-sky')).display, 'none');
    assert.equal(getComputedStyle(document.querySelector('.world-pet-perch-footer')).display, 'none');
    assert.equal(document.querySelector('.learn-panel').dataset.worldReveal, undefined, 'lesson controls have no decorative entrance motion');
    main.querySelector('button').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    assert.equal(document.querySelector('.world-ambience-effects').children.length, 0, 'answer buttons create no site decoration particles');
  });
});

test('a lesson opened directly starts without site decoration', async () => {
  await withAmbience(task, async ({ document }) => {
    assert.equal(document.querySelectorAll('#learning .world-pet-perch').length, 0);
    assert.equal(getComputedStyle(document.querySelector('.world-ambience-effects')).display, 'none');
    assert.equal(getComputedStyle(document.querySelector('.world-ambience-sky')).display, 'none');
  });
});

test('quest animal overlays disappear while train pieces, answer controls and progress stay visible', async () => {
  await withAmbience('<section class="quest-app"><div class="quest-scene"><div class="quest-character-route"><span class="quest-character"><span></span></span></div><span class="quest-pirpir"></span><div class="quest-atmosphere"></div><div class="quest-train is-departing"><span class="quest-wagon">na</span></div><button class="quest-scene-object">na</button><div class="quest-world-status">1 / 6</div></div></section>', async ({ document }) => {
    for (const selector of ['.quest-character-route', '.quest-pirpir', '.quest-atmosphere']) {
      assert.equal(getComputedStyle(document.querySelector(selector)).display, 'none', `${selector} is decorative and absent from the game view`);
    }
    for (const selector of ['.quest-train', '.quest-wagon', '.quest-scene-object', '.quest-world-status']) {
      assert.notEqual(getComputedStyle(document.querySelector(selector)).display, 'none', `${selector} still reflects the child's actions`);
    }
  });
});

test('returning home restores six animals in reserved noninteractive spaces without duplicates', async () => {
  await withAmbience(home, async ({ document }) => {
    const main = document.querySelector('#main');
    main.innerHTML = task;
    await waitForScan();
    main.innerHTML = home;
    await waitForScan();
    const pets = [...document.querySelectorAll('.world-site-pet')];
    assert.equal(pets.length, 6);
    assert.deepEqual(new Set(pets.map(pet => pet.dataset.species)), new Set(['rabbit', 'fox', 'lion', 'squirrel', 'turtle', 'bird']));
    assert.equal(document.querySelectorAll('.home-island-hero .world-site-pet, button .world-site-pet').length, 0);
    for (const pet of pets) {
      assert.equal(pet.closest('.world-pet-perch').getAttribute('aria-hidden'), 'true');
      assert.equal(getComputedStyle(pet).pointerEvents, 'none');
    }
    assert.notEqual(getComputedStyle(document.querySelector('.world-pet-perch-footer')).display, 'none');
    assert.notEqual(getComputedStyle(document.querySelector('.world-ambience-sky')).display, 'none');
  });
});

test('story scenes keep learning progress while removing ambient movement', async () => {
  await withAmbience('<section class="learning" data-screen="task"><div class="story-scene"><img class="story-world-backdrop"><div class="story-world-motes"></div><div class="story-episode-lanterns"></div><span class="world-pirpir-flight"></span><div class="story-world-physical-props"><i class="story-world-plank is-built"></i><div class="story-world-delivery-stamp"></div></div><button class="learn-tile">na</button></div></section>', async ({ document }) => {
    for (const selector of ['.story-world-motes', '.story-episode-lanterns', '.world-pirpir-flight']) {
      assert.equal(getComputedStyle(document.querySelector(selector)).display, 'none', `${selector} does not distract from the lesson`);
    }
    assert.equal(getComputedStyle(document.querySelector('.story-world-backdrop')).animation, 'none');
    for (const selector of ['.story-world-plank', '.story-world-delivery-stamp', '.learn-tile']) {
      assert.notEqual(getComputedStyle(document.querySelector(selector)).display, 'none', `${selector} continues to reflect learning actions`);
    }
  });
});

test('island companion gameplay keeps its pet and reward objects without global site decoration', async () => {
  await withAmbience('<section class="island-app"><div class="island-care-scene"><div class="island-pet is-fed"></div><button class="island-bowl-button">Kase doldu</button></div><div class="island-world-pets"><span data-world-companion="rabbit"></span></div></section>', async ({ document }) => {
    assert.equal(getComputedStyle(document.querySelector('.world-ambience-sky')).display, 'none');
    assert.equal(getComputedStyle(document.querySelector('.world-pet-perch-footer')).display, 'none');
    for (const selector of ['.island-pet', '.island-bowl-button', '[data-world-companion]']) {
      assert.notEqual(getComputedStyle(document.querySelector(selector)).display, 'none', `${selector} remains part of the island activity`);
    }
  });
});

test('pause, hidden page and reduced motion stop home click particles while keeping static pets', async () => {
  await withAmbience(home, async ({ document, window, media }) => {
    const button = document.querySelector('.home-shell button');
    const effects = document.querySelector('.world-ambience-effects');
    const click = () => button.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    click();
    assert.equal(effects.children.length, 5, 'home controls retain their existing tap response');
    document.body.dataset.motionPaused = 'true';
    await waitForScan();
    assert.equal(effects.children.length, 0);
    click();
    assert.equal(effects.children.length, 0);
    document.body.dataset.motionPaused = 'false';
    media.matches = true;
    media.dispatchEvent(new window.Event('change'));
    click();
    assert.equal(effects.children.length, 0);
    assert.equal(document.body.dataset.ambienceReduced, 'true');
    media.matches = false;
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new window.Event('visibilitychange'));
    click();
    assert.equal(effects.children.length, 0);
    assert.equal(document.body.dataset.ambienceHidden, 'true');
    assert.equal(document.querySelectorAll('.world-site-pet').length, 6);
  });
});

test('cleanup removes home decoration and its activity attributes', async () => {
  await withAmbience(home, async ({ document, destroy }) => {
    destroy();
    destroy();
    assert.equal(document.querySelectorAll('[data-world-ambience-owned]').length, 0);
    assert.equal(document.body.classList.contains('world-ambience-enabled'), false);
    assert.equal(document.body.dataset.ambienceHome, undefined);
    assert.equal(document.body.dataset.ambienceHidden, undefined);
    assert.equal(document.body.dataset.ambienceReduced, undefined);
  });
});
