const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.resolve(__dirname, '../src/child-profile.js'), 'utf8');
const api = import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
function memory(initial) {
  const values = new Map(initial ? Object.entries(initial) : []);
  return { values, getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
}

test('a new or old unrelated snapshot starts with a neutral unnamed display profile', async () => {
  const { createChildProfileStore, normalizeChildProfileState, personalizeText } = await api;
  assert.deepEqual(normalizeChildProfileState({ name: 'Old hardcoded label' }), { version: 1, profiles: [], activeId: '' });
  const store = createChildProfileStore({ storage: memory() });
  assert.equal(store.getName(), '');
  assert.equal(personalizeText('Hoş geldin, Alparslan', store.getName()), 'Hoş geldin');
  assert.equal(personalizeText('Alparslan ile adayı keşfet.', ''), 'Minik Aslan ile adayı keşfet.');
});

test('names preserve Turkish casing and NFC while rejecting markup and overlong content', async () => {
  const { validateChildName } = await api;
  assert.equal(validateChildName('  Işıl   İdil  ').name, 'Işıl İdil');
  assert.equal(validateChildName('I\u0307nci').name, 'İnci');
  assert.equal(validateChildName("Deniz O'Neal").okay, true);
  assert.equal(validateChildName('Ö'.repeat(40)).okay, true);
  assert.equal(validateChildName('Ö'.repeat(41)).okay, false);
  for (const input of ['', '<img src=x onerror=alert(1)>', 'ad\u0000', '123', { name: 'ad' }]) assert.equal(validateChildName(input).okay, false);
});

test('actual local save, rename, select, sign-out and reload cannot retain a different active name', async () => {
  const { createChildProfileStore, CHILD_PROFILE_KEY } = await api;
  const storage = memory();
  const store = createChildProfileStore({ storage });
  const first = store.save('Işıl', '');
  assert.equal(first.okay, true);
  const second = store.save('İnci', '');
  assert.notEqual(second.id, first.id);
  assert.equal(store.getName(), 'İnci');
  store.select(first.id);
  assert.equal(store.getName(), 'Işıl');
  assert.equal(store.save('Işıl Deniz', first.id).okay, true);
  assert.equal(store.getState().profiles.length, 2);
  assert.equal(createChildProfileStore({ storage }).getName(), 'Işıl Deniz');
  store.signOut();
  assert.equal(store.getName(), '');
  assert.equal(createChildProfileStore({ storage }).getName(), '');
  assert.equal(storage.values.size, 1, 'profile operations write only their own local key');
  assert.ok(storage.values.has(CHILD_PROFILE_KEY));
});

test('invalid selection, corrupt persistence and blocked local storage have safe unnamed defaults', async () => {
  const { createChildProfileStore, CHILD_PROFILE_KEY, normalizeChildProfileState } = await api;
  const corrupt = memory({ [CHILD_PROFILE_KEY]: '{invalid' });
  assert.equal(createChildProfileStore({ storage: corrupt }).getName(), '');
  const snapshot = normalizeChildProfileState({ version: 1, activeId: 'child-missing', profiles: [{ id: 'child-other', name: 'Deniz' }] });
  assert.equal(snapshot.activeId, '');
  const blocked = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  const store = createChildProfileStore({ storage: blocked });
  assert.equal(store.save('Işıl', '').okay, true);
  assert.equal(store.getName(), 'Işıl');
  store.signOut(); assert.equal(store.getName(), '');
});

test('visual copy updates old name variants and Turkish suffixes without mutating its source', async () => {
  const { personalizeText } = await api;
  const raw = 'Alparslan ile kartları bul. Alp Arslan burada. Alparslan’a sor; Alparslan’ı dinle.';
  assert.equal(personalizeText(raw, 'İnci'), 'İnci ile kartları bul. İnci burada. İnci’ye sor; İnci’yi dinle.');
  assert.equal(personalizeText('Alparslan’dan yardım al.', 'Işıl'), 'Işıl’dan yardım al.');
  assert.equal(personalizeText('Hoş geldin', 'Işıl'), 'Hoş geldin, Işıl');
  assert.match(raw, /Alparslan/);
  assert.equal(personalizeText('Harfleri sırala.', 'Işıl'), 'Harfleri sırala.');
});

test('narration personalization recognizes hero prose but preserves fictional friends and learning targets', async () => {
  const { isPersonalizableNarration, personalizeText } = await api;
  assert.equal(typeof isPersonalizableNarration, 'function');
  assert.equal(isPersonalizableNarration('Alparslan ile Pırpır bahçeye gitti.'), true);
  assert.equal(isPersonalizableNarration('Alp Arslan’a sor.'), true);
  assert.equal(isPersonalizableNarration('{{child}} ile keşfedelim.'), true);
  for (const target of ['Alparslan', 'Alp Arslan', 'Alp', 'Ali', 'anne', 'Pırpır’ın sipariş çantası']) {
    assert.equal(isPersonalizableNarration(target), false, target);
  }
  assert.equal(personalizeText('Alparslan ile Pırpır bahçeye gitti.', 'Alpaslan'), 'Alpaslan ile Pırpır bahçeye gitti.');
  assert.equal(personalizeText('Alparslan ile Pırpır bahçeye gitti.', 'Alp'), 'Alp ile Pırpır bahçeye gitti.');
  assert.equal(personalizeText('Alparslan ile Pırpır bahçeye gitti.', 'ALP'), 'ALP ile Pırpır bahçeye gitti.');
  assert.equal(personalizeText('Alparslan’a sor; Alparslan’ın kartı.', 'Ece'), 'Ece’ye sor; Ece’nin kartı.');
  assert.equal(personalizeText('Alparslan’dan Alparslan’a bir kart.', 'Deniz'), 'Deniz’den Deniz’e bir kart.');
  assert.equal(personalizeText('Alparslan’ı dinle; Alparslan’la oyna.', 'Ayşe'), 'Ayşe’yi dinle; Ayşe’yle oyna.');
});

test('rendered controls escape even explicitly supplied untrusted display snapshots', async () => {
  const { renderProfileControls } = await api;
  const html = renderProfileControls({ state: { version: 1, activeId: 'child-x', profiles: [{ id: 'child-x', name: '<img src=x>' }] } });
  assert.equal(html.includes('<img'), false);
  assert.ok(html.includes('&lt;img src=x&gt;'));
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  assert.equal(new Set(ids).size, ids.length);
});

test('profile changes are subscribable and the UI store receives other-tab selection updates', async () => {
  const { createChildProfileStore, CHILD_PROFILE_KEY } = await api;
  const storage = memory();
  let listener;
  const eventTarget = { addEventListener(type, callback) { if (type === 'storage') listener = callback; }, removeEventListener() {} };
  const store = createChildProfileStore({ storage, eventTarget });
  const changes = [];
  store.subscribe(state => changes.push(state.activeId));
  const profile = store.save('Deniz', '');
  storage.setItem(CHILD_PROFILE_KEY, JSON.stringify({ ...store.getState(), activeId: '' }));
  listener({ key: CHILD_PROFILE_KEY });
  assert.equal(store.getName(), '');
  assert.deepEqual(changes, [profile.id, '']);
  store.destroy();
});

test('a first visit invites a name only on the home screen with no other dialog', async () => {
  const { shouldShowChildWelcome } = await api;
  const state = { version: 1, profiles: [], activeId: '' };
  assert.equal(shouldShowChildWelcome({ state, atHome: true }), true);
  assert.equal(shouldShowChildWelcome({ state, atHome: false }), false, 'an active game is never interrupted');
  assert.equal(shouldShowChildWelcome({ state, atHome: true, dialogOpen: true }), false, 'settings keep control of their dialog');
  assert.equal(shouldShowChildWelcome({ state, atHome: true, dismissed: true }), false, 'Escape dismisses the invitation for the mounted session');
});

test('returning profiles bypass the first-visit invitation even after signing out', async () => {
  const { createChildProfileStore, shouldShowChildWelcome } = await api;
  const storage = memory();
  const store = createChildProfileStore({ storage });
  store.save('İnci', '');
  assert.equal(shouldShowChildWelcome({ state: createChildProfileStore({ storage }).getState(), atHome: true }), false);
  store.signOut();
  assert.equal(shouldShowChildWelcome({ state: store.getState(), atHome: true }), false);
});

test('corrupt or invalid stored profiles cannot bypass the first-visit invitation', async () => {
  const { createChildProfileStore, CHILD_PROFILE_KEY, shouldShowChildWelcome } = await api;
  for (const raw of ['{invalid', JSON.stringify({ version: 1, activeId: 'child-x', profiles: [{ id: 'child-x', name: '<script>' }] })]) {
    const store = createChildProfileStore({ storage: memory({ [CHILD_PROFILE_KEY]: raw }) });
    assert.equal(shouldShowChildWelcome({ state: store.getState(), atHome: true }), true);
  }
});
