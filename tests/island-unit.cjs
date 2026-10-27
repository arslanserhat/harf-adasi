const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { modelURL } = require('./model-loader.cjs');
const api = import(modelURL('island-model.js'));
const selectionAPI = import(modelURL('content-selection.js'));
const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'public', 'audio', 'manifest.json'), 'utf8'));
const alphabet = 'a b c ç d e f g ğ h ı i j k l m n o ö p r s ş t u ü v y z'.split(' ');
const firstLetters = ['a', 'n', 'e', 't', 'i', 'l'];

test('served island missions use a persistent finite activity bag without awarding completion', async () => {
  const { getIslandMission, isIslandCompletion, deriveIslandWorld } = await api;
  const { normalizeSelectionState, recordContentExposure } = await selectionAPI;
  let selection = normalizeSelectionState(null);
  for (const zone of ['care', 'train', 'treasure']) {
    const seen = [];
    for (let index = 0; index < 6; index++) {
      const mission = getIslandMission(zone, alphabet, [], selection);
      assert.equal(seen.includes(mission.key), false, 'actual served missions rotate without relying on a reward');
      seen.push(mission.key);
      assert.equal(isIslandCompletion(`island:${mission.key}`), true, 'the existing authored completion validator stays authoritative');
      selection = recordContentExposure(selection, { id: `served-${zone}-${index}`, domain: 'activities',
        items: [mission.contentActivity], pool: mission.contentPools.activities });
      selection = normalizeSelectionState(JSON.parse(JSON.stringify(selection)));
    }
    assert.equal(getIslandMission(zone, alphabet, [], selection).key, seen[0], 'the finite subpool wraps after all six choices');
  }
  assert.equal(deriveIslandWorld([]).total, 0, 'selection exposure alone cannot create an island reward');
  const fallback = getIslandMission('care', ['ğ'], [], selection);
  const recorded = recordContentExposure(selection, { id: 'served-turkish-letter', domain: 'activities',
    items: [fallback.contentActivity], pool: fallback.contentPools.activities });
  assert.ok(recorded.domains.activities.items[fallback.contentActivity], 'Turkish fallback targets persist without changing completion keys');
});

function checkMission(mission, known) {
  assert.ok(mission);
  assert.equal(mission.kind, mission.zone);
  assert.ok(mission.title && mission.intro && mission.success && mission.reward.emoji && mission.reward.label);
  assert.equal(mission.tokens.join(''), mission.target);
  assert.ok(mission.options.includes(mission.target));
  assert.ok(mission.options.length <= 3);
  assert.equal(new Set(mission.options).size, mission.options.length);
  for (const text of [mission.target, ...mission.tokens, ...mission.options]) {
    assert.ok([...text].every(letter => known.includes(letter)), `Unknown letter in ${text}`);
    assert.ok(manifest.phrases[text], `Missing local audio for ${text}`);
  }
}

test('all three play worlds are available and have six authored missions with existing target audio', async () => {
  const { ISLAND_ZONES, getIslandMission, isIslandCompletion } = await api;
  assert.deepEqual(ISLAND_ZONES.map(zone => zone.id), ['care', 'train', 'treasure']);
  for (const zone of ISLAND_ZONES) {
    assert.ok(zone.title && zone.emoji && zone.description);
    const history = [];
    const seen = new Set();
    for (let index = 0; index < 6; index++) {
      const mission = getIslandMission(zone.id, alphabet, history);
      checkMission(mission, alphabet);
      assert.equal(mission.level, index + 1);
      assert.equal(mission.total, 6);
      assert.ok(!seen.has(mission.key));
      seen.add(mission.key);
      const key = `island:${mission.key}`;
      assert.ok(isIslandCompletion(key));
      history.push(key);
    }
    assert.equal(getIslandMission(zone.id, alphabet, history).key, [...seen][0]);
  }
});

test('teacher-selected letters limit every target, token and parcel/stone option', async () => {
  const { getIslandMission } = await api;
  for (const [zone, expected] of [['care', 4], ['train', 5], ['treasure', 5]]) {
    const history = [];
    for (let index = 0; index < expected; index++) {
      const mission = getIslandMission(zone, firstLetters, history);
      checkMission(mission, firstLetters);
      assert.equal(mission.total, expected);
      history.push(`island:${mission.key}`);
    }
    assert.equal(new Set(history).size, expected);
  }
});

test('letter and syllable wagons preserve repeated letters as separate train cards', async () => {
  const { getIslandMission } = await api;
  const first = getIslandMission('train', ['a', 'n', 'e']);
  assert.equal(first.key, 'train-anne');
  assert.deepEqual(first.tokens, ['a', 'n', 'n', 'e']);
  assert.equal(first.tokens.filter(token => token === 'n').length, 2);
  const second = getIslandMission('train', ['a', 'n', 'e'], ['island:train-anne']);
  assert.equal(second.key, 'train-nane');
  assert.deepEqual(second.tokens, ['na', 'ne']);
});

test('a selected single letter remains playable in every world without pretending to form a word', async () => {
  const { getIslandMission } = await api;
  for (const zone of ['care', 'train', 'treasure']) for (const letter of alphabet) {
    const mission = getIslandMission(zone, [letter]);
    checkMission(mission, [letter]);
    assert.equal(mission.target, letter);
    assert.deepEqual(mission.tokens, [letter]);
    assert.deepEqual(mission.options, [letter]);
  }
});

test('Turkish I and İ stay separate, input ordering does not change the mission', async () => {
  const { getIslandMission } = await api;
  for (const zone of ['care', 'train', 'treasure']) {
    assert.equal(getIslandMission(zone, ['I']).target, 'ı');
    assert.equal(getIslandMission(zone, ['İ']).target, 'i');
    assert.deepEqual(getIslandMission(zone, [...firstLetters].reverse()), getIslandMission(zone, firstLetters));
  }
});

test('invalid letters and unknown worlds do not introduce arbitrary learning targets', async () => {
  const { getIslandMission } = await api;
  for (const known of [[], ['q', 'x', 'w', '1', null, 'an'], null, {}]) {
    assert.equal(getIslandMission('care', known), null);
  }
  assert.equal(getIslandMission('unknown', firstLetters), null);
});

test('round-robin replay continues after a complete tour when history contains repeated events', async () => {
  const { getIslandMission } = await api;
  for (const zone of ['care', 'train', 'treasure']) {
    const history = [];
    const order = [];
    for (let index = 0; index < 18; index++) {
      const mission = getIslandMission(zone, alphabet, history);
      order.push(mission.key);
      history.push(`island:${mission.key}${zone === 'treasure' ? ':garden' : ''}`);
    }
    assert.deepEqual(order.slice(0, 6), order.slice(6, 12));
    assert.deepEqual(order.slice(0, 6), order.slice(12, 18));
  }
});

test('world rewards depend only on validated unique completion keys', async () => {
  const { deriveIslandWorld } = await api;
  const world = deriveIslandWorld(['letter:a', 'island:care-a', 'island:care-a', 'island:train-anne', 'island:treasure-an:garden', 'island:invented', null]);
  assert.equal(world.total, 3);
  assert.equal(world.care, 1);
  assert.equal(world.train, 1);
  assert.equal(world.treasure, 1);
  assert.deepEqual(world.completedKeys, ['island:care-a', 'island:train-anne', 'island:treasure-an']);
  assert.equal(world.rewards.find(reward => reward.zone === 'treasure').placement, 'garden');
  assert.equal(deriveIslandWorld([]).total, 0);
});

test('treasure placement variants move one reward and normalize to the same primary mission', async () => {
  const { deriveIslandWorld, normalizeIslandCompletion, isIslandCompletion } = await api;
  const first = 'island:treasure-an:beach';
  const next = 'island:treasure-an:station';
  assert.equal(normalizeIslandCompletion(first), 'island:treasure-an');
  assert.ok(isIslandCompletion(first));
  const world = deriveIslandWorld([first, 'island:care-a', next]);
  assert.equal(world.total, 2);
  assert.equal(world.treasure, 1);
  assert.equal(world.rewards.find(reward => reward.zone === 'treasure').placement, 'station');
  for (const invalid of ['island:care-a:beach', 'island:train-anne:garden', 'island:treasure-an:moon', 'island:placement:treasure-an:beach', 'island:treasure-unknown:garden', 'island:treasure-an:']) {
    assert.equal(normalizeIslandCompletion(invalid), null);
    assert.ok(!isIslandCompletion(invalid));
  }
});

test('the chosen care companion survives reload and replay updates one existing reward', async () => {
  const { deriveIslandWorld, normalizeIslandCompletion, isIslandCompletion, getIslandMission, ISLAND_COMPANIONS } = await api;
  const first = 'island:care-a:cat';
  assert.equal(normalizeIslandCompletion(first), 'island:care-a');
  assert.ok(isIslandCompletion(first));
  const restored = JSON.parse(JSON.stringify([first]));
  const cat = deriveIslandWorld(restored).rewards[0];
  assert.equal(cat.companion, 'cat');
  assert.equal(cat.emoji, '🐈');
  assert.equal(cat.label, ISLAND_COMPANIONS.cat.name);

  const replayed = deriveIslandWorld([first, 'island:treasure-an:garden', 'island:care-a:bird']);
  assert.equal(replayed.care, 1);
  assert.equal(replayed.total, 2);
  const bird = replayed.rewards.find(reward => reward.zone === 'care');
  assert.equal(bird.companion, 'bird');
  assert.equal(bird.emoji, '🐦');
  assert.equal(bird.label, ISLAND_COMPANIONS.bird.name);
  assert.deepEqual(replayed.completedKeys, ['island:treasure-an', 'island:care-a']);
  assert.equal(getIslandMission('care', firstLetters, restored).key, 'care-e', 'companion suffix still advances to the next mission');
});

test('all companion choices work for known care missions, including single-letter fallback', async () => {
  const { deriveIslandWorld, getIslandMission, isIslandCompletion, normalizeIslandCompletion, ISLAND_COMPANIONS } = await api;
  const careKeys = [];
  const history = [];
  for (let index = 0; index < 6; index++) {
    const mission = getIslandMission('care', alphabet, history);
    careKeys.push(mission.key);
    history.push(`island:${mission.key}`);
  }
  for (const letter of alphabet) careKeys.push(`care-letter-${letter}`);
  for (const key of careKeys) for (const [choice, companion] of Object.entries(ISLAND_COMPANIONS)) {
    const completion = `island:${key}:${choice}`;
    assert.ok(isIslandCompletion(completion));
    assert.equal(normalizeIslandCompletion(completion), `island:${key}`);
    const world = deriveIslandWorld([completion]);
    assert.equal(world.care, 1);
    assert.equal(world.rewards[0].emoji, companion.emoji);
    assert.equal(world.rewards[0].label, companion.name);
  }
  assert.equal(deriveIslandWorld(['island:care-a']).rewards[0].emoji, '🐕', 'legacy care progress retains its original reward');
  for (const invalid of [
    'island:care-a:fox', 'island:care-a:__proto__', 'island:care-a:constructor', 'island:care-a:',
    'island:care-a:garden', 'island:care-unknown:cat', 'island:care-letter-q:cat',
    'island:train-anne:cat', 'island:treasure-an:dog', 'island:care-a:cat:dog',
  ]) {
    assert.equal(normalizeIslandCompletion(invalid), null);
    assert.ok(!isIslandCompletion(invalid));
    assert.equal(deriveIslandWorld([invalid]).total, 0);
  }
});

test('fallback completions earn real rewards and no later call mutates returned or supplied state', async () => {
  const { deriveIslandWorld, getIslandMission, isIslandCompletion } = await api;
  const letters = Object.freeze(['ç']);
  const history = Object.freeze(['island:treasure-letter-ç:beach']);
  assert.ok(isIslandCompletion(history[0]));
  assert.equal(deriveIslandWorld(history).total, 1);
  const mission = getIslandMission('treasure', letters, history);
  mission.tokens.push('x');
  mission.reward.label = 'changed';
  const again = getIslandMission('treasure', letters, history);
  assert.deepEqual(again.tokens, ['ç']);
  assert.notEqual(again.reward.label, 'changed');
  assert.deepEqual([...history], ['island:treasure-letter-ç:beach']);
});
