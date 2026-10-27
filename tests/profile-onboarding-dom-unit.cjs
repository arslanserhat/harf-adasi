const { test } = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const { modelURL } = require('./model-loader.cjs');
const api = import(modelURL('child-profile.js'));

async function fixture({ saved, blocked = false, home = true, settings = false } = {}) {
  const dom = new JSDOM(`<body><header><small class="header-greeting">Hoş geldin</small></header><main id="main" tabindex="-1">${home ? '<div class="home-shell"><div class="home-island-art"><img src="/art/harf-island.webp"></div></div>' : '<section class="lesson">Etkinlik</section>'}</main><dialog id="dialog" ${settings ? 'open' : ''}></dialog></body>`, { url: 'https://example.test/' });
  const { window } = dom;
  // jsdom has no dialog top layer. Keep its native DOM/events; substitute only
  // the two unsupported methods that control the dialog's open attribute.
  window.HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  window.HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); this.dispatchEvent(new window.Event('close')); };
  const previousMutationObserver = global.MutationObserver;
  global.MutationObserver = window.MutationObserver;
  const { createChildProfileStore, CHILD_PROFILE_KEY, mountChildProfiles } = await api;
  if (saved) window.localStorage.setItem(CHILD_PROFILE_KEY, saved);
  const storage = blocked ? { getItem() { throw Error('blocked'); }, setItem() { throw Error('blocked'); } } : window.localStorage;
  const store = createChildProfileStore({ storage, eventTarget: window });
  const unmount = mountChildProfiles({ root: window.document.body, store });
  return {
    window, doc: window.document, store,
    flush: () => new Promise(resolve => setImmediate(resolve)),
    done() { unmount(); store.destroy(); window.close(); global.MutationObserver = previousMutationObserver; },
  };
}

test('fresh home presents one accessible invitation and form submission enters the named game', async () => {
  const f = await fixture();
  try {
    const dialog = f.doc.querySelector('[data-child-welcome]');
    assert.ok(dialog?.open, 'first visit must present the welcome dialog');
    assert.equal(dialog.querySelector('h2').textContent.replace(/\s+/gu, ' ').trim(), 'Harf Adası’na hoş geldin!', 'heading words stay separated when the mobile layout hides its line break');
    const input = dialog.querySelector('[data-child-welcome-name]');
    assert.ok(input, 'a labeled name input is available');
    assert.equal(dialog.querySelector(`label[for="${input.id}"]`)?.textContent, 'Çocuğun adı');
    assert.equal(f.doc.activeElement, input, 'initial focus belongs to the name field');
    const form = dialog.querySelector('form');
    form.dispatchEvent(new f.window.Event('submit', { bubbles: true, cancelable: true }));
    assert.equal(input.getAttribute('aria-invalid'), 'true');
    assert.equal(f.store.getName(), '');
    assert.equal(f.doc.activeElement, input);
    input.value = '  Işıl   İdil  ';
    form.dispatchEvent(new f.window.Event('submit', { bubbles: true, cancelable: true }));
    await f.flush();
    assert.equal(f.store.getName(), 'Işıl İdil');
    assert.equal(f.doc.querySelector('[data-child-welcome]'), null);
    assert.equal(f.doc.querySelector('.header-greeting').textContent, 'Hoş geldin, Işıl İdil');
    assert.equal(f.doc.activeElement, f.doc.querySelector('#main'));
    const { createChildProfileStore } = await api;
    assert.equal(createChildProfileStore({ storage: f.window.localStorage, eventTarget: {} }).getName(), 'Işıl İdil');
    f.doc.querySelector('#main').append('changed'); await f.flush();
    assert.equal(f.doc.querySelector('[data-child-welcome]'), null);
  } finally { f.done(); }
});

test('a returning valid profile or a signed-out existing profile never sees onboarding', async () => {
  for (const activeId of ['child-inci', '']) {
    const f = await fixture({ saved: JSON.stringify({ version: 1, profiles: [{ id: 'child-inci', name: 'İnci' }], activeId }) });
    try { assert.equal(f.doc.querySelector('[data-child-welcome]'), null); } finally { f.done(); }
  }
});

test('onboarding waits for home and an open settings dialog to close', async () => {
  for (const options of [{ home: false }, { settings: true }]) {
    const f = await fixture(options);
    try {
      assert.equal(f.doc.querySelector('[data-child-welcome]'), null);
      if (options.home === false) f.doc.querySelector('#main').innerHTML = '<div class="home-shell"></div>';
      else f.doc.querySelector('#dialog').close();
      await f.flush();
      assert.equal(f.doc.querySelector('[data-child-welcome]')?.open, true);
    } finally { f.done(); }
  }
});

test('Escape dismissal lasts across subsequent home mutations in the same mount', async () => {
  const f = await fixture();
  try {
    const dialog = f.doc.querySelector('[data-child-welcome]');
    assert.ok(dialog);
    dialog.dispatchEvent(new f.window.Event('cancel', { cancelable: true }));
    await f.flush();
    assert.equal(f.doc.querySelector('[data-child-welcome]'), null);
    f.doc.querySelector('#main').innerHTML = '<div class="home-shell"></div>';
    await f.flush();
    assert.equal(f.doc.querySelector('[data-child-welcome]'), null);
  } finally { f.done(); }
});

test('a profile saved with blocked storage enters the game and survives later DOM scans in memory', async () => {
  const f = await fixture({ blocked: true });
  try {
    const dialog = f.doc.querySelector('[data-child-welcome]');
    assert.ok(dialog);
    dialog.querySelector('[data-child-welcome-name]').value = 'Deniz';
    dialog.querySelector('form').dispatchEvent(new f.window.Event('submit', { bubbles: true, cancelable: true }));
    await f.flush();
    assert.equal(f.store.getName(), 'Deniz');
    assert.equal(f.doc.querySelector('.header-greeting').textContent, 'Hoş geldin, Deniz');
    f.doc.querySelector('#main').innerHTML = '<div class="home-shell"></div>';
    await f.flush();
    assert.equal(f.doc.querySelector('[data-child-welcome]'), null);
  } finally { f.done(); }
});
