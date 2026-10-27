const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { modelURL } = require('./model-loader.cjs');
const load = name => fs.existsSync(path.join(__dirname, '../src', name)) ? import(modelURL(name)) : Promise.resolve({});

test('the authored film has six scenes and stable safe voice IDs for every dialogue', async () => {
  const { FILM_LINES, FILM_SCENES } = await load('story-film-script.js');
  assert.ok(Array.isArray(FILM_LINES), 'the actual authored narration script exists');
  assert.equal(FILM_SCENES.length, 6);
  assert.equal(new Set(FILM_LINES.map(line => line.id)).size, FILM_LINES.length);
  for (const line of FILM_LINES) {
    assert.match(line.id, /^[a-z0-9-]+$/);
    assert.ok(['narrator', 'lion', 'bird'].includes(line.speaker));
    assert.ok(line.text.length > 3);
  }
  const ids = new Set(FILM_LINES.map(line => line.id));
  for (const scene of FILM_SCENES) for (const id of scene.lines) assert.ok(ids.has(id));
});

test('film learning eligibility requires both the active teacher word and taught letters', async () => {
  const { getFilmEligibility } = await load('story-film-model.js');
  assert.equal(typeof getFilmEligibility, 'function');
  const state = { activeListId: 'school', lists: [{ id: 'school', words: [{ text: 'lale', parts: ['la', 'le'] }] }] };
  assert.equal(getFilmEligibility(state, ['l', 'a', 'e']).eligible, true);
  assert.equal(getFilmEligibility(state, ['l', 'a']).eligible, false);
  assert.equal(getFilmEligibility({ ...state, activeListId: 'other', lists: [...state.lists, { id: 'other', words: [] }] }, ['l', 'a', 'e']).eligible, false);
});

test('skip cannot pass a checkpoint and watch mode never produces a learning attempt', async () => {
  const { createFilmState, filmCanAdvance, makeFilmAttempt } = await load('story-film-model.js');
  assert.equal(typeof createFilmState, 'function');
  const state = createFilmState(1000); state.mode = 'learn'; state.scene = 2; state.phase = 'task';
  assert.equal(filmCanAdvance(state), false);
  assert.equal(makeFilmAttempt({ ...state, mode: 'watch' }, 'guided', 1000), null);
  state.tasks.guided.correct = true;
  const event = makeFilmAttempt(state, 'guided', 1000);
  assert.equal(event.word, 'lale'); assert.equal(event.skill, 'syllables');
  assert.equal(event.independent, false, 'visible la/le model is assisted');
  assert.equal(filmCanAdvance(state), true);
});

test('saved state validates task evidence and keeps cleared ink cleared without restoring approval', async () => {
  const { createFilmState, normalizeFilmState, editFilmInk } = await load('story-film-model.js');
  assert.equal(typeof normalizeFilmState, 'function');
  const state = createFilmState(1000); state.mode = 'learn'; state.scene = 4; state.phase = 'task';
  state.tasks.guided.correct = true; state.tasks.guided.selected = ['la', 'le'];
  state.tasks.leaves.removed = [0, 1, 2, 3]; state.tasks.cause.correct = true;
  state.tasks.recall.correct = true; state.tasks.recall.selected = ['l', 'a', 'l', 'e'];
  state.tasks.write.ink = ['M 10 10 L 80 50']; state.tasks.write.correct = true; state.tasks.write.reviewOpen = true;
  const cleared = editFilmInk(state, []);
  assert.deepEqual(cleared.tasks.write.ink, []);
  assert.equal(cleared.tasks.write.correct, false);
  assert.equal(cleared.tasks.write.reviewOpen, false);
  assert.equal(cleared.tasks.write.assisted, true, 'seeing the review target affects a new attempt');
  const saved = normalizeFilmState(JSON.parse(JSON.stringify(cleared)), 2000);
  assert.deepEqual(saved.tasks.write.ink, []); assert.equal(saved.tasks.write.correct, false);
  const corrupt = normalizeFilmState({ ...state, scene: 999, cursor: -10, tasks: { recall: { correct: true, selected: ['wrong'] } } }, 2000);
  assert.equal(corrupt.tasks.recall.correct, false);
  assert.ok(corrupt.scene <= 2, 'a corrupt save cannot jump beyond missing prerequisite work');
});
