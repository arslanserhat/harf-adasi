const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../src/story-scene.js'), 'utf8').replace("import './story-scene.css';", '');
const api = import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

test('all five story chapters and the ending follow bounded real task progression', async () => {
  const { getStoryBeat } = await api;
  const chapters = new Set();
  for (let index = 0; index < 8; index++) {
    const beat = getStoryBeat({ index, total: 8, completed: index });
    chapters.add(beat.chapter);
    assert.equal(beat.completed, index);
    assert.ok(beat.caption && beat.narration && beat.title);
  }
  assert.equal(chapters.size, 5);
  assert.equal(getStoryBeat({ phase: 'complete', index: 8, completed: 8, total: 8 }).chapter, 4);
  assert.equal(getStoryBeat({ index: Infinity, completed: -10, total: 0 }).completed, 0);
});

test('story artwork never prints a listening or recall target as a visible model', async () => {
  const { renderStoryScene } = await api;
  const markup = renderStoryScene({ hiddenWord: 'mektup', phase: 'task' });
  const caption = markup.match(/class="story-scene-caption">([^<]*)</)[1];
  assert.doesNotMatch(caption.toLocaleLowerCase('tr-TR'), /\bmektup\b/u);
  assert.ok(markup.includes('data-story-completed="0"'));
  assert.ok(markup.includes('data-story-action="dialogue"'));
});

test('original story has recorded-narration text for the two speakers and all stages', async () => {
  const { NARRATION_PHRASES } = await api;
  assert.equal(NARRATION_PHRASES.length, 22);
  assert.ok(NARRATION_PHRASES.every(phrase => typeof phrase === 'string' && phrase.length > 10));
  assert.equal(new Set(NARRATION_PHRASES).size, NARRATION_PHRASES.length);
});
