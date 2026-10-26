import { ALPHABET, getEligibleWords, normalizeLearningState } from './learning-model.js';

/** Authored missions use the teacher's data; this planner never awards progress. */
export const QUEST_KINDS = Object.freeze([
  { id: 'letters', title: 'Fener Atölyesi', subtitle: 'Kaybolan işaretleri ışığa dönüştür', scene: 'harf-workshop.webp', goal: 'İki işareti hazırla, ilkini yeniden hatırla.', story: 'Rüzgâr fenerin yol tabelalarını dağıtmış. Alparslan ile işaretleri bulup kendi elinle yenilerini hazırlayalım.' },
  { id: 'syllables', title: 'Hece Ekspresi', subtitle: 'Vagonlarını bağla, yükünü teslim et', scene: 'harf-bridge.webp', goal: 'İki yükü hazırla ve ilk durağa geri dön.', story: 'Bahçenin treni yeni yüklerini bekliyor. Her hece bir vagon; doğru bağlanan vagonlar birlikte bir kelime taşıyacak.' },
  { id: 'words', title: 'Kelime Pazarı', subtitle: 'Siparişleri hazırla, adaya ulaştır', scene: 'harf-garden.webp', goal: 'İki siparişi hazırla, ilk etiketini kendin yaz.', story: 'Ada pazarında paketler karışmış. Siparişi bulalım, harf kasalarından etiketini hazırlayalım ve doğru paketi teslim edelim.' },
  { id: 'reading', title: 'Orman Dedektifi', subtitle: 'Oku, ipucunu bul, yolu keşfet', scene: 'harf-garden.webp', goal: 'İki ipucunun anlamını keşfet, ilkine geri dön.', story: 'Ormanın yolu küçük ipuçlarının arasında saklı. Kelimeleri okuyup anlattıkları nesneleri bularak yolu birlikte açacağız.' },
  { id: 'sentences', title: 'Mektup Postanesi', subtitle: 'Mesajını kur, doğru adrese götür', scene: 'harf-post.webp', goal: 'İki mesajı hazırla ve ilk mektubu yeniden tamamla.', story: 'Postacı Pırpır kelime kartlarını getirmiş. Kartları anlamlı mesajlara çevirelim, mektupları hazırlayıp adaya ulaştıralım.' },
  { id: 'numbers', title: 'Bahçe Şenliği', subtitle: 'Topla, say, eksiklerini tamamla', scene: 'harf-garden.webp', goal: 'İki şenlik sepetini sayarak hazırla.', story: 'Bahçede küçük bir şenlik kuruluyor. Sepetleri doğru miktarda dolduralım; fazla olanı ayıralım, eksik olanı tamamlayalım.' },
].map(value => Object.freeze(value)));
export const QUEST_KIND_BY_ID = Object.freeze(Object.fromEntries(QUEST_KINDS.map(value => [value.id, value])));
const KINDS = new Set(QUEST_KINDS.map(value => value.id));
const text = value => typeof value === 'string' ? value.normalize('NFC').trim() : '';
const lower = value => text(value).toLocaleLowerCase('tr-TR');
const unique = values => [...new Set(values)];
const hash = value => { let result = 2166136261; for (const character of value) result = Math.imul(result ^ character.codePointAt(0), 16777619); return (result >>> 0).toString(36); };
const tokensOf = value => text(value).split(/\s+/u).filter(Boolean);
const lexical = value => lower(value).replace(/[^abcçdefgğhıijklmnoöprsştuüvyz]/gu, '');
const allowedText = (value, selected) => [...lower(value)].filter(letter => /\p{L}/u.test(letter)).every(letter => selected.has(letter));
const validId = value => typeof value === 'string' && /^[a-z0-9][a-z0-9_.:-]{0,159}$/iu.test(value);

function completedRuns(history) {
  const source = Array.isArray(history) ? history : Array.isArray(history?.runs) ? history.runs : [];
  const seen = new Set();
  return source.filter(run => {
    if (!run || !validId(run.id) || seen.has(run.id) || !KINDS.has(run.kind)
      || run.completed !== true || run.completedStages !== 6 || (run.totalStages !== undefined && run.totalStages !== 6)) return false;
    if (run.results !== undefined && (!Array.isArray(run.results) || run.results.length !== 6 || run.results.some(result => result?.correct !== true))) return false;
    seen.add(run.id); return true;
  });
}

export function getQuestSummaries(history) {
  const runs = completedRuns(history);
  return QUEST_KINDS.map(meta => {
    const matching = runs.filter(run => run.kind === meta.id);
    const latest = matching.at(-1);
    return { id: meta.id, kind: meta.id, title: meta.title, completedCount: matching.length,
      lastCompletedAt: Number.isFinite(latest?.completedAt) ? Math.max(0, latest.completedAt) : 0,
      wordTexts: Array.isArray(latest?.wordTexts) ? unique(latest.wordTexts.filter(value => /^[abcçdefgğhıijklmnoöprsştuüvyz]{1,24}$/u.test(value))).slice(0, 8) : [] };
  });
}

function choices(values, target) {
  const result = [], seen = new Set();
  for (const source of values) {
    const option = typeof source === 'string' ? { value: source, text: source } : source;
    if (!option || typeof option.value !== 'string' || seen.has(option.value)) continue;
    result.push({ value: option.value, text: String(option.text ?? ''), ...(option.image ? { image: String(option.image) } : {}) });
    seen.add(option.value);
  }
  const correct = result.find(option => option.value === target);
  return correct ? [correct, ...result.filter(option => option !== correct).slice(0, 2)] : [];
}

function wordChoices(word, pool) {
  return choices([word.text, ...pool.map(entry => entry.text)], word.text);
}
function sentenceChoices(word, pool) {
  const tokens = tokensOf(word.sentence);
  const reversed = [...tokens].reverse().join(' ');
  const shifted = [...tokens.slice(1), tokens[0]].join(' ');
  // Incorrect orderings only rearrange the actual teacher's message; no new
  // vocabulary or invented example sentence is introduced.
  return choices([word.sentence, ...pool.map(entry => entry.sentence), reversed, shifted], word.sentence);
}
function semanticKey(word) { return word.emoji ? `image:${word.emoji}` : word.meaning ? `meaning:${lower(word.meaning)}` : ''; }
function semanticPool(words) {
  const seen = new Set();
  return words.filter(word => {
    const key = semanticKey(word);
    if (!key || seen.has(key)) return false;
    seen.add(key); return true;
  });
}
function meaningChoices(word, pool) {
  return choices([word, ...pool].map(entry => ({ value: entry.text,
    text: entry.meaning || 'Resimli paket', ...(entry.emoji ? { image: entry.emoji } : {}) })), word.text);
}

/** Reproducible from its inputs. Animation, elapsed time, and sticker counts
 * cannot change either learning observations or a quest's completion count. */
export function buildQuestPlan(kind, { learningState, letters = [], history = [], now: clock } = {}) {
  const meta = Object.hasOwn(QUEST_KIND_BY_ID, kind) ? QUEST_KIND_BY_ID[kind] : null;
  if (!meta) return { id: 'quest-unavailable', kind: String(kind ?? ''), title: 'Bir dünya seçelim', story: '', goal: '', stages: [], available: false, reason: 'Bu oyun dünyası bulunamadı.', wordTexts: [] };
  const selected = new Set((Array.isArray(letters) ? letters : typeof letters === 'string' ? [...letters] : []).map(lower).filter(letter => ALPHABET.includes(letter)));
  const now = Number.isFinite(clock) ? Math.max(0, clock)
    : Number.isFinite(learningState?.updatedAt) ? Math.max(0, learningState.updatedAt) : 0;
  const state = normalizeLearningState(learningState, now);
  const runs = completedRuns(history);
  const matching = runs.filter(run => run.kind === kind);
  const rotation = matching.length;
  const { eligible } = getEligibleWords(state, [...selected]);
  const last = matching.at(-1);
  const rank = word => {
    const skills = Object.values(state.progress[word.text] || {});
    const due = skills.some(progress => progress.nextDueAt > 0 && progress.nextDueAt <= now);
    const weak = skills.some(progress => progress.attempts > 0 && progress.recent.at(-1) !== 2);
    const lastAt = Math.max(0, ...skills.map(progress => progress.lastAt || 0));
    return [due ? 0 : weak ? 1 : lastAt ? 3 : 2, lastAt];
  };
  const ranked = eligible.map((word, index) => ({ word, index, rank: rank(word) })).sort((a, b) => a.rank[0] - b.rank[0] || a.rank[1] - b.rank[1] || a.index - b.index).map(item => item.word);
  const rotate = pool => {
    if (pool.length < 2) return [...pool];
    const firstPrevious = Array.isArray(last?.wordTexts) ? last.wordTexts[0] : '';
    const first = pool.find(word => word.text !== firstPrevious) || pool[rotation % pool.length];
    return [first, ...pool.filter(word => word !== first)];
  };
  let pool = ranked;
  let reason = '';
  if (kind === 'syllables') pool = pool.filter(word => word.parts.length > 1);
  if (kind === 'reading') pool = semanticPool(pool);
  if (kind === 'sentences') pool = pool.filter(word => {
    const tokens = tokensOf(word.sentence);
    return tokens.length >= 2 && tokens.length <= 8 && word.sentence.length <= 160
      && allowedText(word.sentence, selected) && tokens.some(token => lexical(token) === word.text);
  });
  pool = rotate(pool);
  if (kind === 'letters' && !selected.size) reason = 'Fener Atölyesi için önce okulda öğrendiğin harfleri seçelim.';
  else if (kind === 'reading' && pool.length < 2) reason = 'Orman Dedektifi için öğretmen listesine en az iki farklı resim veya anlam ekleyelim. Bilmediğimiz bir kelimeye anlam uydurmayacağız.';
  else if (kind === 'sentences' && !pool.length) reason = 'Postane için öğretmen listesindeki bir kelimeye, öğrenilen harflerle yazılmış 2–8 kelimelik bir cümle ekleyelim.';
  else if (kind === 'syllables' && !pool.length) reason = 'Hece Ekspresi için öğretmen listesinde öğrenilen harflerle yazılmış en az iki heceli bir kelime olmalı.';
  else if (kind !== 'letters' && kind !== 'numbers' && !pool.length) reason = 'Bu dünyaya öğretmen listesindeki kelimelerle gireceğiz. Önce kelimeleri ve okulda öğrenilen harfleri birlikte kontrol edelim.';
  const id = `quest-${kind}-${hash(JSON.stringify(kind === 'numbers' ? { rotation, last: last?.id || '' }
    : { list: state.activeListId, letters: [...selected].sort(), pool, rotation, last: last?.id || '', progress: state.events.at(-1)?.id || '' }))}`;
  const plan = { id, kind, title: meta.title, story: meta.story, goal: meta.goal, stages: [], available: !reason, reason, wordTexts: [] };
  if (reason) return plan;
  const first = pool[0], second = pool[1] || first;
  const add = (mechanic, word, skill, prompt, target, details = {}) => {
    const stage = { id: `${id}:${plan.stages.length}`, mechanic, skill, word: word?.text || '', prompt,
      target: String(target), options: [], tokens: [], parts: [...(word?.parts || [])], model: '', guided: false, ...details };
    stage.target = String(stage.target);
    stage.options = choices(stage.options, stage.target);
    stage.options.sort((a, b) => parseInt(hash(`${stage.id}:${a.value}`), 36) - parseInt(hash(`${stage.id}:${b.value}`), 36));
    if (stage.options.length === 1) stage.guided = true;
    plan.stages.push(stage);
  };
  const findWord = (mechanic, word, skill, prompt, options = wordChoices(word, ranked), details = {}) => add(mechanic, word, skill, prompt, word.text, { options, ...details });
  const assemble = (word, parts, skill, prompt, model = '') => add('assemble', word, skill, prompt, parts.join(''), { tokens: [...parts], model, guided: Boolean(model) });
  const message = (word, prompt, model = '') => add('assemble', word, 'sentence', prompt, word.sentence, { tokens: tokensOf(word.sentence), model, guided: Boolean(model) });
  if (kind === 'letters') {
    const choicesLetters = [...selected];
    const a = first?.text[0] || choicesLetters[rotation % choicesLetters.length];
    const b = second?.text.split('').find(letter => letter !== a) || choicesLetters.find(letter => letter !== a) || a;
    const letter = value => ({ text: value, parts: [value] });
    const choose = value => choices([value, ...choicesLetters], value);
    add('find', letter(a), 'build', 'Fenerin ilk işaretini dinle ve doğru parçayı bul.', a, { options: choose(a) });
    add('write', letter(a), 'write', 'Bulduğun işareti tabelaya çiz. Sonra bir büyüğünle kontrol et.', a, { model: a, guided: true });
    add('find', letter(b), 'build', 'İkinci tabelanın işareti farklı. Dinle ve parçasını seç.', b, { options: choose(b) });
    add('write', letter(b), 'write', 'İkinci tabelayı da kendi elinle hazırlayalım.', b, { model: b, guided: true });
    add('route', letter(a), 'recall', 'İlk tabelaya geri döndük. Başta bulduğun işareti yeniden seç.', a, { options: choose(a) });
    add('write', letter(a), 'write', 'İlk işareti bu kez örneksiz yaz. Bir büyüğünle birlikte bakalım.', a);
  } else if (kind === 'syllables') {
    assemble(first, first.parts, 'syllables', 'İlk yükün hecelerini vagonlara sırayla yerleştir.');
    findWord('deliver', first, 'build', 'Vagonlar birleşti. Yükünün adını taşıyan durağı seç.');
    assemble(second, second.parts, 'syllables', 'Başka bir sipariş geldi. İkinci trenin vagonlarını bağla.');
    const missing = second.parts.at(-1);
    add('find', second, 'syllables', 'İkinci trenin son vagonu eksik. Yükü tamamlayan heceyi bul.', missing,
      { options: choices([missing, ...pool.flatMap(word => word.parts)], missing), model: `${second.parts.slice(0, -1).join(' · ')} · …` });
    assemble(first, first.parts, 'recall', 'İlk yükü yeniden hatırla. Bu kez vagonlarını örneksiz bağla.');
    findWord('route', first, 'recall', 'İlk treni kendi durağına götür. Adını hatırlayıp doğru yolu seç.');
  } else if (kind === 'words') {
    findWord('find', first, 'listen', 'Müşterinin siparişini dinle. Hazırlayacağın paketin kartını bul.');
    assemble(first, [...first.text], 'build', 'Harf kasalarından ilk siparişin etiketini hazırla.');
    findWord('deliver', first, 'recall', 'Etiket hazır. Siparişinle aynı adı taşıyan paketi teslim et.');
    findWord('find', second, 'listen', 'Pazara ikinci sipariş geldi. Dinle ve doğru paketi bul.');
    assemble(second, [...second.text], 'build', 'İkinci paketin harf etiketini de hazırlayalım.');
    add('write', first, 'write', 'İlk müşterinin kelimesi deftere de yazılacak. Hatırla, yaz ve birlikte kontrol et.', first.text);
  } else if (kind === 'reading') {
    findWord('find', first, 'meaning', 'İlk ipucundaki kelimeyi oku. Anlattığı resmi ya da anlamı bul.', meaningChoices(first, pool), { model: first.text });
    findWord('route', first, 'meaning', 'Bulduğun ipucuna uygun nesnenin olduğu yoldan ilerle.', meaningChoices(first, pool), { model: first.text });
    findWord('find', second, 'meaning', 'Ormanda ikinci bir ipucu var. Kelimesini oku ve ne anlattığını bul.', meaningChoices(second, pool), { model: second.text });
    findWord('deliver', second, 'meaning', 'İkinci ipucunun paketini aynı anlamdaki resme ulaştır.', meaningChoices(second, pool), { model: second.text });
    findWord('route', first, 'meaning', 'İlk ipucuna geri döndük. Kelimeyi yeniden okuyup doğru yolu seç.', meaningChoices(first, pool), { model: first.text });
    assemble(first, [...first.text], 'recall', 'Bulduğun ilk nesnenin adını örneksiz kur; keşif defterine ekleyelim.');
  } else if (kind === 'sentences') {
    message(first, 'Öğretmeninin ilk mesajındaki kelime kartlarını sırayla yerleştir.', first.sentence);
    add('route', first, 'sentence', 'Hazırladığın mesajın doğru sırada yazıldığı postane yolunu seç.', first.sentence, { options: sentenceChoices(first, pool) });
    message(second, 'İkinci mektubun kelime kartlarını birleştir.', second.sentence);
    const blank = tokensOf(second.sentence).map(token => lexical(token) === second.text ? '…' : token).join(' ');
    findWord('find', second, 'sentence', 'Mektubun boş kalan yerini tamamlayan, biraz önce çalıştığın kelimeyi bul.', wordChoices(second, ranked), { model: blank });
    message(first, 'İlk mesajı bu kez örneksiz yeniden kur.');
    add('deliver', first, 'sentence', 'İlk mektubunun doğru yazılmış mesajını bul ve postacıya teslim et.', first.sentence, { options: sentenceChoices(first, pool) });
  } else if (kind === 'numbers') {
    const a = 2 + rotation % 3, b = a + 2;
    const countChoices = quantity => choices([String(quantity), String(quantity + 1), String(Math.max(0, quantity - 1))], String(quantity));
    add('collect', null, null, `İlk şenlik sepetine ${a} tane nesne yerleştir. Tek tek sayabilirsin.`, a, { quantity: a, initialQuantity: 0 });
    add('deliver', null, null, 'Doldurduğun ilk sepetin sayı etiketini seçip teslim et.', a, { quantity: a, options: countChoices(a) });
    add('balance', null, null, `İlk sepete biraz fazla konmuş. ${a} tane kalacak şekilde düzenle.`, a, { quantity: a, initialQuantity: a + 2 });
    add('collect', null, null, `Şimdi başka bir sepeti ${b} tane nesneyle dolduralım.`, b, { quantity: b, initialQuantity: 0 });
    add('balance', null, null, `İkinci sepette eksik var. ${b} tane olana kadar tamamla.`, b, { quantity: b, initialQuantity: b - 1 });
    add('route', null, null, 'İlk sepetin miktarını hatırla. Doğru sayı tabelasından şenliğe geç.', a, { quantity: a, options: countChoices(a) });
  }
  plan.wordTexts = unique(plan.stages.map(stage => stage.word).filter(Boolean));
  return plan;
}

/** Choose an available next world from observed needs, without pretending that
 * numeracy practice supplies reading evidence. Clock is explicit for tests. */
export function recommendQuestKind({ learningState, letters = [], history = [], excludeKind, now: clock } = {}) {
  const now = Number.isFinite(clock) ? Math.max(0, clock)
    : Number.isFinite(learningState?.updatedAt) ? Math.max(0, learningState.updatedAt) : 0;
  const state = normalizeLearningState(learningState, now);
  const selected = new Set((Array.isArray(letters) ? letters : typeof letters === 'string' ? [...letters] : [])
    .map(lower).filter(letter => ALPHABET.includes(letter)));
  const { eligible } = getEligibleWords(state, [...selected]);
  const words = new Set([...eligible.map(word => word.text), ...selected]);
  const runs = completedRuns(history);
  const summaries = getQuestSummaries(runs);
  const lastKind = KINDS.has(excludeKind) ? excludeKind : runs.at(-1)?.kind;
  let candidates = QUEST_KINDS.filter(meta => buildQuestPlan(meta.id, { learningState: state, letters: [...selected], history, now }).available);
  const alternatives = candidates.filter(meta => meta.id !== lastKind);
  if (alternatives.length) candidates = alternatives;
  const skillWorlds = (skill, word) => {
    if (word.length === 1) return ['letters', 'words', 'syllables'];
    return {
      listen: ['words', 'syllables', 'reading'], syllables: ['syllables', 'words'],
      build: ['words', 'syllables', 'letters'], recall: ['words', 'syllables', 'reading'],
      write: ['words', 'letters'], meaning: ['reading', 'words', 'sentences'],
      sentence: ['sentences', 'reading', 'words'],
    }[skill] || [];
  };
  const compare = (a, b) => {
    for (let index = 0; index < Math.max(a.length, b.length); index++) {
      const difference = (a[index] || 0) - (b[index] || 0);
      if (difference) return difference;
    }
    return 0;
  };
  const scores = new Map(candidates.map(meta => [meta.id, [2, 0, 0]]));
  for (const word of words) {
    for (const [skill, progress] of Object.entries(state.progress[word] || {})) {
      if (!progress?.attempts) continue;
      const due = progress.nextDueAt > 0 && progress.nextDueAt <= now;
      const weak = progress.recent.at(-1) !== 2;
      if (!due && !weak) continue;
      const worlds = skillWorlds(skill, word);
      for (const meta of candidates) {
        // A rest in the number garden cannot replace an available world that
        // can actually support an observed reading/writing difficulty.
        if (meta.id === 'numbers') continue;
        const match = worlds.indexOf(meta.id);
        const score = [due ? 0 : 1, match < 0 ? 20 : match, due ? progress.nextDueAt : progress.lastAt];
        if (compare(score, scores.get(meta.id)) < 0) scores.set(meta.id, score);
      }
    }
  }
  candidates.sort((a, b) => {
    const need = compare(scores.get(a.id), scores.get(b.id));
    if (need) return need;
    const left = summaries.find(summary => summary.id === a.id), right = summaries.find(summary => summary.id === b.id);
    return left.completedCount - right.completedCount || left.lastCompletedAt - right.lastCompletedAt
      || QUEST_KINDS.indexOf(a) - QUEST_KINDS.indexOf(b);
  });
  return candidates[0]?.id || 'numbers';
}
