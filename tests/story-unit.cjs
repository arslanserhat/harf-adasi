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

test('original episodes expose unique authored narration for both speakers and all stages', async () => {
  const { NARRATION_PHRASES } = await api;
  assert.equal(NARRATION_PHRASES.length, 66);
  assert.ok(NARRATION_PHRASES.every(phrase => typeof phrase === 'string' && phrase.length > 10));
  assert.equal(new Set(NARRATION_PHRASES).size, NARRATION_PHRASES.length);
});

test('completed journeys can select three distinct authored episodes without rewriting learning state', async () => {
  const { getStoryBeat, renderStoryScene, STORY_EPISODE_COUNT } = await api;
  assert.equal(STORY_EPISODE_COUNT, 3);
  const intros = new Set();
  const endings = new Set();
  const series = new Set();
  for (let episode = 0; episode < STORY_EPISODE_COUNT; episode++) {
    const intro = getStoryBeat({ episode, phase: 'intro' });
    const ending = getStoryBeat({ episode, phase: 'complete' });
    intros.add(intro.caption); endings.add(ending.caption); series.add(intro.series);
    assert.equal(intro.episode, episode);
    assert.equal(ending.episode, episode);
    for (let chapter = 0; chapter < 5; chapter++) {
      const task = getStoryBeat({ episode, chapter, phase: 'task' });
      const success = getStoryBeat({ episode, chapter, phase: 'success' });
      assert.equal(task.chapter, chapter);
      assert.notEqual(task.caption, success.caption);
      const markup = renderStoryScene({ episode, chapter, hiddenWord: 'kartları' });
      assert.ok(markup.includes(`data-story-episode="${episode}"`));
      assert.ok(markup.includes('data-story-series="'));
      const caption = markup.match(/class="story-scene-caption">([^<]*)</)[1];
      assert.equal((caption.toLocaleLowerCase('tr-TR').match(/\p{L}+/gu) || []).includes('kartları'), false);
    }
  }
  assert.equal(intros.size, 3); assert.equal(endings.size, 3); assert.equal(series.size, 3);
  assert.match(getStoryBeat({ episode: 1, phase: 'intro' }).series, /Pırpır/);
  assert.match(getStoryBeat({ episode: 2, phase: 'intro' }).series, /Fener/);
  assert.equal(getStoryBeat({ episode: NaN }).episode, 0);
  assert.equal(getStoryBeat({ episode: -1 }).episode, 0);
  assert.equal(getStoryBeat({ episode: 999 }).episode, 2);
});
