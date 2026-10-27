const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// Import the unchanged browser ES module without adding package-wide ESM mode.
const { modelURL } = require('./model-loader.cjs');
const api = import(modelURL('adventures.js'));
const selectionAPI = import(modelURL('content-selection.js'));
const alphabet = 'a b c ç d e f g ğ h ı i j k l m n o ö p r s ş t u ü v y z'.split(' ');
const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'public', 'audio', 'manifest.json'), 'utf8'));
const normalize = text => text.normalize('NFC').toLocaleLowerCase('tr-TR').trim();

test('served short stories cover the finite pool before repeating even without a completion', async () => {
  const { chooseAdventure } = await api;
  const { normalizeSelectionState, recordContentExposure } = await selectionAPI;
  let selection = normalizeSelectionState(null);
  const seen = [];
  for (let index = 0; index < 9; index++) {
    const adventure = chooseAdventure(alphabet, '', selection);
    assert.equal(seen.includes(adventure.key), false, 'abandoning a served story cannot restart a two-story loop');
    seen.push(adventure.key);
    selection = recordContentExposure(selection, { id: `served-story-${index}`, domain: 'activities',
      items: [adventure.contentActivity], pool: adventure.contentPools.activities });
    selection = normalizeSelectionState(JSON.parse(JSON.stringify(selection)));
  }
  assert.equal(chooseAdventure(alphabet, '', selection).key, seen[0], 'the finite pool deliberately wraps after coverage');
  const fallback = chooseAdventure(['ı'], '', selection);
  assert.match(fallback.contentActivity, /^[a-z0-9_.:-]+$/iu, 'Turkish fallback letters have a persistent ASCII activity identity');
  const recorded = recordContentExposure(selection, { id: 'served-single-letter', domain: 'activities',
    items: [fallback.contentActivity], pool: fallback.contentPools.activities });
  assert.ok(recorded.domains.activities.items[fallback.contentActivity]);
});

function checkTargets(adventure, known) {
  assert.equal(adventure.steps.length, 3);
  assert.ok(adventure.title && adventure.story && adventure.goal && adventure.ending && adventure.emoji);
  for (const step of adventure.steps) {
    assert.ok(['match', 'build'].includes(step.kind));
    assert.ok(step.successText);
    for (const letter of step.text) assert.ok(known.includes(letter), `Unexpected ${letter} in ${step.text}`);
    assert.ok(manifest.phrases[normalize(step.promptSpeech)], `Missing recording: ${step.promptSpeech}`);
    if (step.kind === 'match') {
      assert.ok(step.options.includes(step.text));
      assert.ok(step.options.every(letter => known.includes(letter)));
    } else {
      assert.equal(step.tokens.join(''), step.text);
      assert.deepEqual(step.parts, step.tokens);
      assert.equal(step.sentence, false);
    }
  }
}

test('a first-grade adventure stays within the selected teacher letter group', async () => {
  const { chooseAdventure } = await api;
  const known = ['a', 'n', 'e', 't', 'i', 'l'];
  const adventure = chooseAdventure(known, 'a');
  checkTargets(adventure, known);
  assert.equal(adventure.steps[2].kind, 'build');
  assert.ok(adventure.steps[2].tokens.some(token => token.length > 1));
});

test('selection is deterministic and independent of letter selection order', async () => {
  const { chooseAdventure } = await api;
  const letters = ['a', 'n', 'e', 't', 'i', 'l'];
  const first = chooseAdventure(letters, 'n');
  assert.deepEqual(chooseAdventure([...letters].reverse(), 'n'), first);
  assert.deepEqual(chooseAdventure([...letters, 'a', 'n'], 'n'), first);
  assert.deepEqual(letters, ['a', 'n', 'e', 't', 'i', 'l']);
});

test('another eligible focus takes precedence over repeating the recent letter', async () => {
  const { chooseAdventure } = await api;
  assert.equal(chooseAdventure(['a', 'n', 'e'], 'a').key, 'nane-bahcesi');
  assert.equal(chooseAdventure(['a', 'n', 'e'], 'n').key, 'anneye-kart');
});

test('a previous adventure key avoids repeating the same story when another is eligible', async () => {
  const { chooseAdventure } = await api;
  assert.equal(chooseAdventure(['a', 'n', 'e'], 'nane-bahcesi').key, 'anneye-kart');
  assert.equal(chooseAdventure(['a', 'n', 'e'], 'anneye-kart').key, 'nane-bahcesi');
  assert.equal(chooseAdventure(['a', 'm'], 'kedinin-mamasi').key, 'kedinin-mamasi');
});

test('completed story keys cycle through every eligible adventure before repeating', async () => {
  const { chooseAdventure } = await api;
  const groups = [
    {
      known: ['a', 'n', 'e', 't', 'i', 'l'],
      keys: ['nane-bahcesi', 'lalenin-karti', 'anneye-kart', 'nineye-surpriz', 'ciftlikte-at', 'yardim-eli'],
    },
    {
      known: alphabet,
      keys: ['nane-bahcesi', 'lalenin-karti', 'anneye-kart', 'nineye-surpriz', 'meyve-sepeti', 'kedinin-mamasi', 'ciftlikte-at', 'yardim-eli', 'arinin-karti'],
    },
  ];
  for (const { known, keys } of groups) {
    // Each eligible story can be the saved starting point of the cycle.
    for (const start of keys) {
      let recent = start;
      const visited = [];
      for (let index = 0; index < keys.length; index++) {
        const adventure = chooseAdventure(known, recent);
        checkTargets(adventure, known);
        visited.push(adventure.key);
        recent = adventure.key;
      }
      assert.deepEqual([...visited].sort(), [...keys].sort());
      assert.equal(visited.at(-1), start);
      assert.equal(chooseAdventure(known, recent).key, visited[0]);
    }
  }
});

test('the last build uses actual syllables and preserves repeated syllable cards', async () => {
  const { chooseAdventure } = await api;
  const adventure = chooseAdventure(['m', 'a']);
  assert.equal(adventure.key, 'kedinin-mamasi');
  assert.deepEqual(adventure.steps[1].tokens, ['m', 'a']);
  assert.deepEqual(adventure.steps[2].tokens, ['ma', 'ma']);
  assert.equal(adventure.steps[2].text, 'mama');
  checkTargets(adventure, ['m', 'a']);
});

test('Turkish uppercase normalization keeps dotted and dotless vowels separate', async () => {
  const { chooseAdventure } = await api;
  const dotless = chooseAdventure(['A', 'R', 'I']);
  assert.equal(dotless.key, 'arinin-karti');
  checkTargets(dotless, ['a', 'r', 'ı']);
  const dotted = chooseAdventure(['A', 'R', 'İ']);
  assert.notEqual(dotted.key, 'arinin-karti');
  checkTargets(dotted, ['a', 'r', 'i']);
  assert.equal(chooseAdventure(['I']).steps[0].text, 'ı');
  assert.equal(chooseAdventure(['İ']).steps[0].text, 'i');
});

test('one known letter gets three small tasks without introducing another letter or a pretend word', async () => {
  const { chooseAdventure } = await api;
  const adventure = chooseAdventure(['ç'], 'ç');
  assert.ok(adventure.key.startsWith('harf-kesfi-'));
  assert.equal(adventure.goal, 'Seçtiğin harflerle üç kart görevini tamamla.');
  checkTargets(adventure, ['ç']);
  assert.ok(adventure.steps.every(step => step.text === 'ç'));
});

test('invalid selections do not silently supply an unknown letter', async () => {
  const { chooseAdventure } = await api;
  for (const input of [[], null, undefined, {}, ['q', 'w', 'x', '1', '', null, 'an']]) {
    assert.equal(chooseAdventure(input), null);
  }
  checkTargets(chooseAdventure('a n e', 'n'), ['a', 'n', 'e']);
});

test('all authored-word combinations and single-letter fallbacks have eligible targets and recorded prompts', async () => {
  const { chooseAdventure } = await api;
  const letters = ['a', 'e', 'i', 'ı', 'l', 'm', 'n', 'r', 't'];
  for (let mask = 1; mask < 2 ** letters.length; mask++) {
    const known = letters.filter((_, index) => mask & (1 << index));
    for (const recent of ['', ...known]) checkTargets(chooseAdventure(known, recent), known);
  }
  for (const letter of alphabet) checkTargets(chooseAdventure([letter]), [letter]);
});

test('a caller can mutate its returned cards without changing another adventure', async () => {
  const { chooseAdventure } = await api;
  const adventure = chooseAdventure(['m', 'a']);
  adventure.steps[2].tokens.pop();
  adventure.steps[0].options.push('z');
  const fresh = chooseAdventure(['m', 'a']);
  assert.deepEqual(fresh.steps[2].tokens, ['ma', 'ma']);
  assert.ok(!fresh.steps[0].options.includes('z'));
});
