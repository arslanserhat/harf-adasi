const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const encode = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const modelUrl = encode(fs.readFileSync(path.join(__dirname, '../src/learning-model.js'), 'utf8'));
const storeUrl = encode(fs.readFileSync(path.join(__dirname, '../src/learning-sync.js'), 'utf8')
  .replace("'./learning-model.js'", JSON.stringify(modelUrl)));
const api = Promise.all([import(modelUrl), import(storeUrl)]);
const response = (status, data) => ({ status, ok: status >= 200 && status < 300, json: async () => data });
const defer = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const memory = () => {
  const values = new Map();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
};
function configure(t, module, options) {
  const store = module.createLearningStore({ storage: memory(), enabled: true, csrf: 'test-csrf', debounceMs: 60000, ...options });
  t.after(() => store.destroy());
  return store;
}

test('untouched fresh browser restores a real older server lesson instead of overwriting it with defaults', async t => {
  const [model, module] = await api;
  const remote = model.createLearningState(1000);
  remote.lists[0].title = 'Öğretmenin listesi';
  let puts = 0;
  const store = configure(t, module, { fetcher: async (_url, request) => {
    assert.equal(request.credentials, 'same-origin');
    if (request.method === 'PUT') puts++;
    return response(200, { state: remote, revision: 4 });
  } });
  await store.initialize();
  assert.equal(store.getState().lists[0].title, 'Öğretmenin listesi');
  assert.equal(await store.flush(), true);
  assert.equal(puts, 0);
  assert.equal(store.getSyncStatus().mode, 'saved');
});

test('teacher edit made during initial GET survives and uses the observed server revision', async t => {
  const [model, module] = await api;
  const pending = defer();
  let submitted;
  const store = configure(t, module, { fetcher: async (_url, request) => {
    if (request.method === 'GET') return pending.promise;
    submitted = JSON.parse(request.body);
    assert.equal(request.headers['X-CSRF-TOKEN'], 'test-csrf');
    return response(200, { saved: true, state: submitted.state, revision: 6 });
  } });
  const loading = store.initialize();
  const edited = model.createLearningState();
  edited.lists[0].title = 'Bu haftanın kelimeleri';
  store.setState(edited);
  pending.resolve(response(200, { state: model.createLearningState(1000), revision: 5 }));
  await loading;
  assert.equal(await store.flush(), true);
  assert.equal(submitted.base_revision, 5);
  assert.equal(submitted.state.lists[0].title, 'Bu haftanın kelimeleri');
});

test('revision conflict merges distinct observations and retries without awarding an event twice', async t => {
  const [model, module] = await api;
  const now = Date.now();
  const event = id => ({ id, word: 'nane', skill: 'build', correct: true, hints: 0, mistakes: 0, independent: true, at: now });
  const remote = model.recordAttempt(model.createLearningState(now - 1000), event('server-event'));
  let attempts = 0;
  const store = configure(t, module, { fetcher: async (_url, request) => {
    if (request.method === 'GET') return response(200, { state: null, revision: 0 });
    if (++attempts === 1) return response(409, { state: remote, revision: 2 });
    const submitted = JSON.parse(request.body);
    assert.equal(submitted.base_revision, 2);
    assert.deepEqual(new Set(submitted.state.events.map(event => event.id)), new Set(['local-event', 'server-event']));
    return response(200, { saved: true, revision: 3, state: submitted.state });
  } });
  await store.initialize();
  store.setState(model.recordAttempt(store.getState(), event('local-event')));
  assert.equal(await store.flush(), true);
  assert.equal(attempts, 2);
  assert.equal(store.getState().events.length, 2);
  assert.equal(store.getState().progress.nane.build.independentDays.length, 1);
});

test('late pre-reset PUT cannot replace reset state or its revision; teacher lists are retained', async t => {
  const [model, module] = await api;
  const pending = defer();
  let puts = 0;
  const store = configure(t, module, { fetcher: async (_url, request) => {
    if (request.method === 'GET') return response(200, { state: null, revision: 0 });
    if (++puts === 1) return pending.promise;
    const submitted = JSON.parse(request.body);
    assert.equal(submitted.base_revision, 8);
    assert.equal(submitted.state.events.length, 0);
    return response(200, { saved: true, revision: 9, state: submitted.state });
  } });
  await store.initialize();
  let state = model.recordAttempt(store.getState(), { id: 'before-reset', word: 'nane', skill: 'build', correct: true, at: Date.now() });
  state.lists[0].title = 'Korunan öğretmen listesi';
  store.setState(state);
  const saving = store.flush();
  store.acceptReset(8);
  pending.resolve(response(200, { saved: true, revision: 7, state }));
  await saving;
  assert.equal(store.getState().events.length, 0);
  assert.equal(store.getState().lists[0].title, 'Korunan öğretmen listesi');
  assert.equal(await store.flush(), true);
});

test('server reset tombstone clears stale browser observations instead of uploading them again', async t => {
  const [model, module] = await api;
  const storage = memory();
  storage.setItem(module.LEARNING_STORAGE_KEY, JSON.stringify(model.recordAttempt(model.createLearningState(), {
    id: 'old-observation', word: 'nane', skill: 'write', correct: true, writingReviewed: true, at: Date.now(),
  })));
  storage.setItem(`${module.LEARNING_STORAGE_KEY}:revision`, '2');
  let puts = 0;
  const store = configure(t, module, { storage, fetcher: async (_url, request) => {
    if (request.method === 'PUT') puts++;
    return response(200, { state: null, revision: 5 });
  } });
  await store.initialize();
  assert.equal(store.getState().events.length, 0);
  await store.flush();
  assert.equal(puts, 0);
});

test('server reset remains authoritative when a local attempt is made during the initial GET', async t => {
  const [model, module] = await api;
  const storage = memory();
  const pending = defer();
  const old = model.recordAttempt(model.createLearningState(), {
    id: 'deleted-before-load', word: 'nane', skill: 'write', correct: true,
    writingReviewed: true, at: Date.now(),
  });
  storage.setItem(module.LEARNING_STORAGE_KEY, JSON.stringify(old));
  storage.setItem(`${module.LEARNING_STORAGE_KEY}:revision`, '2');
  let puts = 0;
  const notifications = [];
  const store = configure(t, module, { storage,
    onRemoteChange: (_state, reason) => notifications.push(reason),
    fetcher: async (_url, request) => {
      if (request.method === 'GET') return pending.promise;
      puts++;
      return response(200, { saved: true, revision: 6 });
    },
  });
  const loading = store.initialize();
  store.setState(model.recordAttempt(store.getState(), {
    id: 'local-during-load', word: 'anne', skill: 'build', correct: true,
    independent: true, at: Date.now(),
  }));
  assert.equal(store.getState().events.length, 2, 'the browser changed while server reset information was pending');
  pending.resolve(response(200, { state: null, revision: 5 }));
  await loading;
  assert.equal(store.getState().events.length, 0, 'no pre-reset or pending local observation can be resurrected');
  assert.equal(Object.keys(store.getState().progress).length, 0);
  assert.equal(store.getState().session, null);
  assert.deepEqual(notifications, ['reset'], 'an active lesson is told to leave its now-deleted task');
  assert.equal(await store.flush(), true);
  assert.equal(puts, 0, 'the stale snapshot is never uploaded using the new reset revision');
  assert.equal(JSON.parse(storage.getItem(module.LEARNING_STORAGE_KEY)).events.length, 0);
  assert.equal(storage.getItem(`${module.LEARNING_STORAGE_KEY}:revision`), '5');
});

test('GET reset checkpoint replaces stale observations even after retained lists were saved again', async t => {
  const [model, module] = await api;
  const storage = memory();
  const stale = model.recordAttempt(model.createLearningState(), {
    id: 'deleted-local-observation', word: 'nane', skill: 'write', correct: true,
    writingReviewed: true, at: Date.now(),
  });
  storage.setItem(module.LEARNING_STORAGE_KEY, JSON.stringify(stale));
  storage.setItem(`${module.LEARNING_STORAGE_KEY}:revision`, '2');
  const remote = model.recordAttempt(model.createLearningState(Date.now() - 1000), {
    id: 'valid-after-reset', word: 'anne', skill: 'build', correct: true,
    independent: true, at: Date.now(),
  });
  remote.lists[0].title = 'Sıfırlama sonrası korunan öğretmen listesi';
  let puts = 0;
  const notifications = [];
  const store = configure(t, module, { storage,
    onRemoteChange: (_state, reason) => notifications.push(reason),
    fetcher: async (_url, request) => {
      if (request.method === 'PUT') puts++;
      return response(200, { state: remote, revision: 9, reset_revision: 5 });
    },
  });
  await store.initialize();
  assert.deepEqual(store.getState().events.map(event => event.id), ['valid-after-reset']);
  assert.equal(store.getState().progress.nane, undefined, 'deleted pre-reset aggregates are not merged back');
  assert.equal(store.getState().lists[0].title, remote.lists[0].title, 'the authoritative retained teacher list is kept');
  assert.deepEqual(notifications, ['reset']);
  assert.equal(await store.flush(), true);
  assert.equal(puts, 0, 'a non-null post-reset snapshot is not overwritten with stale local work');
});

test('409 reset checkpoint adopts the post-reset snapshot without retrying old observations', async t => {
  const [model, module] = await api;
  const storage = memory();
  const stale = model.recordAttempt(model.createLearningState(), {
    id: 'deleted-local-before-conflict', word: 'nane', skill: 'build', correct: true,
    independent: true, at: Date.now(),
  });
  storage.setItem(module.LEARNING_STORAGE_KEY, JSON.stringify(stale));
  storage.setItem(`${module.LEARNING_STORAGE_KEY}:revision`, '2');
  const remote = model.createLearningState(Date.now() - 1000);
  remote.lists[0].title = 'Sunucuda sıfırlamadan sonra saklanan liste';
  let puts = 0;
  const notifications = [];
  const store = configure(t, module, { storage,
    onRemoteChange: (_state, reason) => notifications.push(reason),
    fetcher: async (_url, request) => {
      if (request.method === 'GET') return response(200, { state: stale, revision: 2, reset_revision: 0 });
      puts++;
      return response(409, { saved: false, state: remote, revision: 9, reset_revision: 5 });
    },
  });
  await store.initialize();
  store.setState(model.recordAttempt(store.getState(), {
    id: 'local-during-conflict', word: 'anne', skill: 'build', correct: true,
    independent: true, at: Date.now(),
  }));
  assert.equal(await store.flush(), true);
  assert.equal(store.getState().events.length, 0);
  assert.equal(Object.keys(store.getState().progress).length, 0);
  assert.equal(store.getState().session, null);
  assert.equal(store.getState().lists[0].title, remote.lists[0].title);
  assert.equal(notifications.at(-1), 'reset');
  assert.equal(store.getSyncStatus().mode, 'saved');
  assert.equal(await store.flush(), true);
  assert.equal(puts, 1, 'the rejected pre-reset PUT is never merged and retried');
  assert.equal(storage.getItem(`${module.LEARNING_STORAGE_KEY}:revision`), '9');
});

test('an existing offline lesson is uploaded when its new server session has no snapshot', async t => {
  const [model, module] = await api;
  const storage = memory();
  const offline = model.recordAttempt(model.createLearningState(), {
    id: 'offline-practice', word: 'nane', skill: 'build', correct: true, at: Date.now(),
  });
  storage.setItem(module.LEARNING_STORAGE_KEY, JSON.stringify(offline));
  let puts = 0;
  const store = configure(t, module, { storage, fetcher: async (_url, request) => {
    if (request.method === 'GET') return response(200, { state: null, revision: 0 });
    puts++;
    const body = JSON.parse(request.body);
    assert.equal(body.base_revision, 0);
    assert.equal(body.state.events[0].id, 'offline-practice');
    return response(201, { saved: true, state: body.state, revision: 1 });
  } });
  await store.initialize();
  assert.equal(store.getSyncStatus().mode, 'pending');
  assert.equal(await store.flush(), true);
  assert.equal(puts, 1);
  assert.equal(store.getSyncStatus().mode, 'saved');
});

test('unavailable browser storage keeps the lesson usable and reports its actual persistence limit', async t => {
  const [model, module] = await api;
  const storage = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  const store = configure(t, module, { enabled: false, storage });
  store.setState(model.createLearningState());
  assert.equal(store.getState().lists[0].words[0].text, 'nane');
  assert.equal(store.getSyncStatus().mode, 'memory');
  assert.match(store.getSyncStatus().label, /kaybolabilir/);
});
