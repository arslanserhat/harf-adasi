const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.resolve(__dirname, '../src/content-selection.js'), 'utf8');
const api = import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
const NOW = Date.UTC(2026, 9, 27, 9);

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), values };
}

test('every supported domain covers its finite supplied pool before beginning a varied next cycle', async () => {
  const { CONTENT_DOMAINS, orderContentPool, recordContentExposure } = await api;
  const pools = {
    letters: ['a', 'e', 'ı', 'i', 'ö', 'ü'],
    syllables: ['ka', 'lem', 'ki', 'tap', 'o', 'kul'],
    words: ['kalem', 'kitap', 'okul', 'masa', 'kedi', 'top', 'elma', 'limon'],
    sentences: ['Ali alet al.', 'Nine nane al.', 'Anne elma al.'],
    numbers: Array.from({ length: 11 }, (_, index) => String(index)),
    activities: ['story-1', 'story-2', 'island:animal:1', 'island:train:2'],
  };
  for (const domain of CONTENT_DOMAINS) {
    let state;
    const seen = [], pool = pools[domain];
    for (let index = 0; index < pool.length; index++) {
      const next = orderContentPool(domain, pool, state)[0];
      assert.ok(!seen.includes(next), domain + ' cannot repeat while an eligible target waits');
      seen.push(next);
      state = recordContentExposure(state, { id: 'served-' + index, domain, items: [next], pool, at: NOW + index });
    }
    assert.deepEqual(new Set(seen), new Set(pool), domain + ' covers the actual source, without inventing content');
    assert.equal(state.domains[domain].round, 2);
    assert.notEqual(orderContentPool(domain, pool, state)[0], seen.at(-1), domain + ' avoids the most recent target when a cycle ends');
    assert.equal(Object.hasOwn(state, 'progress'), false, 'selection metadata never awards learning progress');
  }
});

test('switching games and reloading continues the shared target order instead of restarting the first pair', async () => {
  const { orderContentPool, recordContentExposure } = await api;
  const pool = ['kalem', 'kitap', 'okul', 'masa', 'kedi', 'top', 'elma', 'limon'];
  let state;
  const targets = [];
  for (let round = 0; round < 4; round++) {
    const pair = orderContentPool('words', pool, state).slice(0, 2);
    targets.push(...pair);
    state = recordContentExposure(state, { id: ['market', 'train', 'forest', 'market'][round] + ':' + round,
      domain: 'words', items: pair, pool, at: NOW + round * 60000 });
    state = JSON.parse(JSON.stringify(state));
  }
  assert.deepEqual(targets, pool);
});

test('a covered small subpool cannot hide never-served content when the game opens a larger eligible pool', async () => {
  const { orderContentPool, recordContentExposure } = await api;
  const small = ['kalem', 'kitap'], large = [...small, 'okul', 'masa', 'kedi', 'top'];
  let state;
  for (let index = 0; index < 5; index++) {
    const next = orderContentPool('words', small, state)[0];
    state = recordContentExposure(state, { id: 'small-' + index, domain: 'words', items: [next], pool: small, at: NOW + index });
  }
  assert.deepEqual(orderContentPool('words', large, state).slice(0, 4), ['okul', 'masa', 'kedi', 'top']);
});

test('a newly added item gets one early turn and joins the current cycle without frequency catch-up repetitions', async () => {
  const { orderContentPool, recordContentExposure } = await api;
  const old = ['kalem', 'kitap', 'okul', 'masa'];
  let state;
  for (let index = 0; index < 100; index++) {
    const next = orderContentPool('words', old, state)[0];
    state = recordContentExposure(state, { id: 'old-' + index, domain: 'words', items: [next], pool: old, at: NOW + index });
  }
  const expanded = [...old, 'şeker'];
  assert.equal(orderContentPool('words', expanded, state)[0], 'şeker');
  state = recordContentExposure(state, { id: 'added', domain: 'words', items: ['şeker'], pool: expanded, at: NOW + 1000 });
  const nextFour = [];
  for (let index = 0; index < 4; index++) {
    const next = orderContentPool('words', expanded, state)[0];
    assert.notEqual(next, 'şeker', 'the new word does not repeat to catch up with old exposure counts');
    nextFour.push(next);
    state = recordContentExposure(state, { id: 'expanded-' + index, domain: 'words', items: [next], pool: expanded, at: NOW + 1001 + index });
  }
  assert.deepEqual(new Set(nextFour), new Set(old));
});

test('removed items and switched teacher lists never leak outside the supplied current pool', async () => {
  const { orderContentPool, recordContentExposure } = await api;
  const pool = ['kalem', 'kitap', 'okul', 'masa'];
  const state = recordContentExposure(null, { id: 'first', domain: 'words', items: pool.slice(0, 2), pool, at: NOW });
  assert.deepEqual(orderContentPool('words', ['okul', 'şeker'], state), ['okul', 'şeker']);
  assert.deepEqual(orderContentPool('words', ['ışık', 'inci'], state), ['ışık', 'inci']);
  assert.deepEqual(orderContentPool('words', [], state), []);
  const ignored = recordContentExposure(state, { id: 'stale', domain: 'words', items: ['kalem'], pool: ['okul', 'şeker'], at: NOW + 1 });
  assert.deepEqual(ignored, state, 'a stale target cannot consume a place in a changed list');
});

test('empty and one-item pools remain playable and make their unavoidable repetition explicit as another cycle', async () => {
  const { normalizeSelectionState, orderContentPool, recordContentExposure } = await api;
  const blank = normalizeSelectionState(null);
  assert.deepEqual(orderContentPool('letters', [], blank), []);
  assert.deepEqual(recordContentExposure(blank, { id: 'empty', domain: 'letters', items: [], pool: [], at: NOW }), blank);
  let state = blank;
  for (let index = 0; index < 3; index++) {
    assert.deepEqual(orderContentPool('letters', ['İ'], state), ['i']);
    state = recordContentExposure(state, { id: 'one-' + index, domain: 'letters', items: ['İ'], pool: ['İ'], at: NOW + index });
    assert.equal(state.domains.letters.round, index + 2);
  }
});

test('Turkish normalization preserves dotted and dotless i and canonicalizes only real supplied forms', async () => {
  const { orderContentPool } = await api;
  assert.deepEqual(orderContentPool('letters', ['I', 'İ', 'Ş', 'ş', 'X', 'i'], null), ['ı', 'i', 'ş']);
  assert.deepEqual(orderContentPool('words', ['IŞIK', 'İNCİ', ' ÇİLEK ', 'çiçek', 'hello-world'], null),
    ['ışık', 'inci', 'çilek', 'çiçek']);
  assert.deepEqual(orderContentPool('syllables', ['ŞI', 'şı', 'ne', '😀'], null), ['şı', 'ne']);
  assert.deepEqual(orderContentPool('sentences', ['Ali  alet\tal.', 'Anne nane al.', 'tek', 'X al.'], null),
    ['Ali alet al.', 'Anne nane al.']);
  assert.deepEqual(orderContentPool('numbers', ['00', '01', '100', '101', '-1', '1.5', 3], null), ['0', '1', '100', '3']);
  assert.deepEqual(orderContentPool('activities', ['story-1', 'island:train:2', '../bad', '<script>', 'https://bad'], null),
    ['story-1', 'island:train:2']);
  assert.deepEqual(orderContentPool('unknown', ['a'], null), []);
});

test('a rendered target is deduplicated by visit and domain after JSON reload while distinct domains remain independent', async () => {
  const { recordContentExposure, orderContentPool } = await api;
  const event = { id: 'stage:one', domain: 'words', items: ['kalem'], pool: ['kalem', 'kitap'], at: NOW };
  const first = recordContentExposure(null, event);
  const resumed = recordContentExposure(JSON.parse(JSON.stringify(first)), { ...event, at: NOW + 60000 });
  assert.deepEqual(resumed, first);
  assert.equal(resumed.sequence, 1);
  const letters = recordContentExposure(resumed, { id: event.id, domain: 'letters', items: ['a'], pool: ['a', 'e'], at: NOW });
  assert.equal(letters.sequence, 2, 'the same UI stage may expose distinct content domains');
  assert.deepEqual(orderContentPool('words', event.pool, letters), ['kitap', 'kalem']);
  assert.deepEqual(orderContentPool('letters', ['a', 'e'], letters), ['e', 'a']);
});

test('planning, recording and returned snapshots never mutate caller objects', async () => {
  const { normalizeSelectionState, recordContentExposure, orderContentPool } = await api;
  const sourceState = normalizeSelectionState(null), pool = Object.freeze(['kalem', 'kitap']);
  const before = JSON.stringify(sourceState);
  const next = recordContentExposure(sourceState, { id: 'immutable', domain: 'words', items: ['kalem'], pool, at: NOW });
  assert.equal(JSON.stringify(sourceState), before);
  assert.notStrictEqual(next, sourceState);
  assert.notStrictEqual(next.domains.words, sourceState.domains.words);
  assert.deepEqual(orderContentPool('words', pool, next), ['kitap', 'kalem']);
  assert.equal(JSON.stringify(sourceState), before);
});

test('legacy seeds migrate once, do not invent syllables, and an explicit reset does not reseed old targets', async () => {
  const { SELECTION_KEY, createContentStore, orderContentPool } = await api;
  const storage = memoryStorage({ 'harf-adasi-learning-v1': 'keep-real-observations' });
  const first = createContentStore({ storage, seed: { words: ['kalem', 'kitap'], letters: ['I', 'İ'] } });
  assert.deepEqual(orderContentPool('words', ['kalem', 'kitap', 'masa'], first.getState()), ['masa', 'kalem', 'kitap']);
  assert.equal(Object.keys(first.getState().domains.syllables.items).length, 0, 'old word observations do not prove any historical syllable form');
  first.expose({ id: 'real-new-target', domain: 'words', items: ['masa'], pool: ['kalem', 'kitap', 'masa'], at: NOW });
  const snapshot = first.getState();
  const second = createContentStore({ storage, seed: { words: ['elma'] } });
  assert.deepEqual(second.getState(), snapshot);
  assert.equal(second.getState().domains.words.items.elma, undefined, 'new seed data cannot overwrite an existing ledger');
  second.reset();
  const afterReset = createContentStore({ storage, seed: { words: ['elma'] } });
  assert.equal(afterReset.getState().sequence, 0);
  assert.equal(storage.getItem('harf-adasi-learning-v1'), 'keep-real-observations');
  assert.ok(storage.getItem(SELECTION_KEY));
});

test('blocked browser storage keeps selection in memory and callers cannot mutate the internal ledger', async () => {
  const { createContentStore } = await api;
  const storage = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('quota'); } };
  const store = createContentStore({ storage });
  store.expose({ id: 'local', domain: 'letters', items: ['ç'], pool: ['ç', 'ş'], at: NOW });
  const copy = store.getState();
  copy.domains.letters.items['ç'].lastSeen = 999;
  copy.visits.push('letters:forged');
  assert.equal(store.getState().domains.letters.items['ç'].lastSeen, 1);
  assert.equal(store.getState().visits.includes('letters:forged'), false);
  assert.equal(store.reset().sequence, 0);
});

test('corrupt, unsupported and oversized storage recovers safely without touching learning state', async () => {
  const { SELECTION_KEY, createContentStore, normalizeSelectionState } = await api;
  for (const raw of ['{', 'null', '[]', '{"version":99}', ' '.repeat(2 * 1024 * 1024 + 1)]) {
    const storage = memoryStorage({ [SELECTION_KEY]: raw, learning: 'unchanged' });
    const store = createContentStore({ storage, seed: { words: ['ışık'] } });
    assert.ok(store.getState().domains.words.items['ışık']);
    assert.equal(storage.getItem('learning'), 'unchanged');
  }
  for (const invalid of [null, [], false, 'text', { version: 99 }]) assert.equal(normalizeSelectionState(invalid).sequence, 0);
  assert.equal(createContentStore(null).getState().sequence, 0, 'invalid constructor options retain the memory fallback');
  const hostile = normalizeSelectionState({ version: 1, sequence: 1, domains: { words: { round: 1,
    items: JSON.parse('{"constructor":{"round":1,"lastSeen":1,"lastAt":0},"__proto__":{"round":1,"lastSeen":1,"lastAt":0}}') } } });
  assert.equal(Object.getPrototypeOf(hostile.domains.words.items), null);
  assert.ok(hostile.domains.words.items.constructor);
  assert.equal(Object.hasOwn(hostile.domains.words.items, '__proto__'), false);
});

test('target and visit history stays bounded instead of becoming an ever-growing activity log', async () => {
  const { normalizeSelectionState, recordContentExposure } = await api;
  const pool = Array.from({ length: 4200 }, (_, index) => 'activity-' + index);
  let state = recordContentExposure(null, { id: 'large', domain: 'activities', items: pool, pool, at: NOW });
  assert.equal(Object.keys(state.domains.activities.items).length, 4096);
  const imported = { ...state, visits: Array.from({ length: 700 }, (_, index) => 'activities:visit-' + index) };
  state = normalizeSelectionState(imported);
  assert.equal(state.visits.length, 512);
  assert.equal(state.visits[0], 'activities:visit-188');
  assert.ok(JSON.stringify(state).length < 2 * 1024 * 1024);
});
