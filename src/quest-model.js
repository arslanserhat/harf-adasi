import { ALPHABET, getEligibleWords, normalizeLearningState, orderPracticeWords, getTeacherContent } from './learning-model.js';
import { orderContentPool } from './content-selection.js';

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

function reviewReady(state, value, domain, selection, now, runs) {
  const progress = Object.values(state.progress?.[value] || {}).filter(item => item?.attempts > 0);
  if (!progress.length) return false;
  const lastAt = Math.max(0, selection?.domains?.[domain]?.items?.[value]?.lastAt || 0, ...progress.map(item => item.lastAt || 0));
  if (lastAt && now - lastAt < 10 * 60000 || runs.at(-1)?.wordTexts?.includes(value)) return false;
  return progress.some(item => item.nextDueAt > 0 && item.nextDueAt <= now || item.recent?.at(-1) !== 2);
}

/** Reproducible from its inputs. Animation, elapsed time, and sticker counts
 * cannot change either learning observations or a quest's completion count. */
export function buildQuestPlan(kind, { learningState, letters = [], history = [], selection, now: clock } = {}) {
  const meta = Object.hasOwn(QUEST_KIND_BY_ID, kind) ? QUEST_KIND_BY_ID[kind] : null;
  if (!meta) return { id: 'quest-unavailable', kind: String(kind ?? ''), title: 'Bir dünya seçelim', story: '', goal: '', stages: [], available: false, reason: 'Bu oyun dünyası bulunamadı.', wordTexts: [] };
  const selected = new Set((Array.isArray(letters) ? letters : typeof letters === 'string' ? [...letters] : []).map(lower).filter(letter => ALPHABET.includes(letter)));
  const now = Number.isFinite(clock) ? Math.max(0, clock)
    : Number.isFinite(learningState?.updatedAt) ? Math.max(0, learningState.updatedAt) : 0;
  const state = normalizeLearningState(learningState, now);
  const runs = completedRuns(history);
  const matching = runs.filter(run => run.kind === kind);
  const rotation = matching.length;
  const { eligible, blocked } = getEligibleWords(state, [...selected]);
  const last = matching.at(-1);
  const teacherContent = getTeacherContent(state, [...selected]);
  const teacherLetters = teacherContent.explicitLetters;
  const letterPool = teacherContent.letters;
  const explicitSyllables = teacherContent.explicitSyllables;
  const sentencePool = eligible.filter(word => {
    const tokens = tokensOf(word.sentence);
    return tokens.length >= 2 && tokens.length <= 8 && word.sentence.length <= 160
      && allowedText(word.sentence, selected) && tokens.some(token => lexical(token) === word.text);
  });
  const contentPools = {
    letters: kind === 'numbers' ? [] : letterPool,
    syllables: kind === 'numbers' ? [] : [...teacherContent.syllables],
    words: kind === 'numbers' ? [] : eligible.map(word => word.text),
    sentences: kind === 'numbers' ? [] : unique(sentencePool.map(word => word.sentence.replace(/\s+/gu, ' '))),
    numbers: Array.from({ length: 11 }, (_, index) => String(index)),
  };
  const ranked = orderPracticeWords(state, eligible, { now, runs, selection });
  let pool = ranked;
  let reason = '';
  if (kind === 'syllables') pool = pool.filter(word => word.parts.length > 1 && word.parts.every(part => contentPools.syllables.includes(part)));
  if (kind === 'reading') pool = semanticPool(pool);
  if (kind === 'sentences') {
    const seen = new Set();
    pool = pool.filter(word => {
      const sentence = word.sentence.replace(/\s+/gu, ' ');
      if (!sentencePool.some(entry => entry.text === word.text) || seen.has(sentence)) return false;
      seen.add(sentence); return true;
    });
  }
  pool = orderPracticeWords(state, pool, { now, runs, selection });
  const firstReview = pool[0] && reviewReady(state, pool[0].text, 'words', selection, now, runs) ? pool[0] : null;
  if (selection && kind === 'syllables' && !explicitSyllables.length) {
    const syllableOrder = orderContentPool('syllables', contentPools.syllables, selection);
    const priority = word => Math.min(Infinity, ...word.parts.map(part => syllableOrder.indexOf(part)).filter(index => index >= 0));
    const originalOrder = new Map(pool.map((word, index) => [word.text, index]));
    const wordBucket = selection.domains?.words;
    const served = word => Number(wordBucket?.items?.[word.text]?.round === wordBucket?.round);
    pool.sort((a, b) => served(a) - served(b) || priority(a) - priority(b) || originalOrder.get(a.text) - originalOrder.get(b.text));
  }
  if (selection && kind === 'sentences') {
    const messageOrder = orderContentPool('sentences', contentPools.sentences, selection);
    const wordBucket = selection.domains?.words;
    const served = word => Number(wordBucket?.items?.[word.text]?.round === wordBucket?.round);
    pool.sort((a, b) => served(a) - served(b)
      || messageOrder.indexOf(a.sentence.replace(/\s+/gu, ' ')) - messageOrder.indexOf(b.sentence.replace(/\s+/gu, ' ')));
  }
  if (firstReview && ['syllables', 'sentences'].includes(kind)) pool = [firstReview, ...pool.filter(word => word !== firstReview)];
  // Explicit syllables and one-syllable teacher words remain real units; an
  // unrelated invented word is never required just to enter the train.
  const unitMode = kind === 'syllables' && contentPools.syllables.length > 0 && (explicitSyllables.length > 0 || !pool.length);
  if (kind === 'letters' && !letterPool.length) reason = 'Fener Atölyesi için önce okulda öğrendiğin harfleri seçelim.';
  else if (kind === 'reading' && pool.length < 2) reason = 'Orman Dedektifi için öğretmen listesine en az iki farklı resim veya anlam ekleyelim. Bilmediğimiz bir kelimeye anlam uydurmayacağız.';
  else if (kind === 'sentences' && !pool.length) reason = 'Postane için öğretmen listesindeki bir kelimeye, öğrenilen harflerle yazılmış 2–8 kelimelik bir cümle ekleyelim.';
  else if (kind === 'syllables' && !pool.length && !unitMode) reason = 'Hece Ekspresi için öğretmeninin verdiği heceleri veya öğrenilen harflerle yazılmış en az iki heceli kelimeleri ekleyelim.';
  else if (kind !== 'letters' && kind !== 'numbers' && !pool.length && !unitMode) reason = 'Bu dünyaya öğretmen listesindeki kelimelerle gireceğiz. Önce kelimeleri ve okulda öğrenilen harfleri birlikte kontrol edelim.';
  if (reason && kind === 'letters' && teacherContent.blockedLetters.length) reason += ` Henüz seçilmeyen okul harfleri: ${teacherContent.blockedLetters.join(', ')}.`;
  if (reason && kind === 'syllables' && teacherContent.blockedSyllables.length) reason += ` Harflerini henüz açmadığımız heceler: ${teacherContent.blockedSyllables.slice(0, 8).map(unit => `${unit.text} (${unit.missingLetters.join(', ')})`).join('; ')}.`;
  if (reason && blocked.length) reason += ` Henüz açılmayan kelimeler: ${blocked.slice(0, 6).map(word => `${word.text} (${word.missingLetters.join(', ')})`).join('; ')}. Bu harfleri okulda öğrendiğinde ayarlardan seçebilirsin.`;
  const id = `quest-${kind}-${hash(JSON.stringify(kind === 'numbers' ? { rotation, last: last?.id || '', sequence: selection?.sequence || 0 }
    : { list: state.activeListId, letters: [...selected].sort(), pool, teacherLetters, explicitSyllables, rotation,
      sequence: selection?.sequence || 0, last: last?.id || '', progress: state.events.at(-1)?.id || '' }))}`;
  const plan = { id, kind, title: meta.title, story: meta.story, goal: meta.goal, stages: [], available: !reason, reason, wordTexts: [], focusTexts: [], contentPools };
  if (reason) return plan;
  const first = pool[0], second = pool[1] || first;
  const add = (mechanic, word, skill, prompt, target, details = {}) => {
    const stage = { id: `${id}:${plan.stages.length}`, mechanic, skill, word: word?.text || '', prompt,
      target: String(target), options: [], tokens: [], parts: [...(word?.parts || [])], sentence: word?.sentence || '', itemType: word ? kind === 'letters' ? 'letter' : 'word' : 'number', model: '', guided: false, ...details };
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
    const choicesLetters = [...letterPool];
    const letter = value => ({ text: value, parts: [value] });
    const wordLetters = unique(pool.flatMap(word => [...word.text]));
    const preferred = unique([...wordLetters.filter(value => choicesLetters.includes(value)), ...choicesLetters]);
    let orderedLetters = selection ? orderContentPool('letters', preferred, selection).map(letter)
      : orderPracticeWords(state, preferred.map(letter), { now, runs });
    const reviewLetter = orderedLetters.find(entry => reviewReady(state, entry.text, 'letters', selection, now, runs));
    if (reviewLetter) orderedLetters = [reviewLetter, ...orderedLetters.filter(entry => entry !== reviewLetter)];
    const a = orderedLetters[0].text;
    const b = orderedLetters[1]?.text || a;
    const choose = value => choices([value, ...choicesLetters], value);
    add('find', letter(a), 'build', 'Fenerin ilk işaretini dinle ve doğru parçayı bul.', a, { options: choose(a) });
    add('write', letter(a), 'write', 'Bulduğun işareti tabelaya çiz. Sonra bir büyüğünle kontrol et.', a, { model: a, guided: true });
    add('find', letter(b), 'build', 'İkinci tabelanın işareti farklı. Dinle ve parçasını seç.', b, { options: choose(b) });
    add('write', letter(b), 'write', 'İkinci tabelayı da kendi elinle hazırlayalım.', b, { model: b, guided: true });
    add('route', letter(a), 'recall', 'İlk tabelaya geri döndük. Başta bulduğun işareti yeniden seç.', a, { options: choose(a) });
    add('write', letter(a), 'write', 'İlk işareti bu kez örneksiz yaz. Bir büyüğünle birlikte bakalım.', a);
  } else if (kind === 'syllables' && unitMode) {
    const unitPool = orderContentPool('syllables', contentPools.syllables, selection);
    const a = unitPool[0], b = unitPool[1] || a;
    const unitChoices = value => choices([value, ...unitPool], value);
    const unit = (mechanic, value, prompt, details = {}) => add(mechanic, null, 'syllables', prompt, value,
      { itemType: 'syllable', unitText: value, parts: [value], ...details });
    plan.goal = unitPool.length > 1 ? 'Öğretmeninin iki hecesiyle yükleri hazırla, ilkini yeniden hatırla.' : 'Öğretmeninin hecesini farklı görevlerde kullan.';
    unit('find', a, 'Öğretmeninin ilk hecesini dinle ve doğru yükü bul.', { options: unitChoices(a) });
    unit('assemble', a, 'İlk heceyi kendi harflerinden kur; yük etiketini hazırlayalım.', { tokens: [...a] });
    unit('deliver', a, 'Hazırladığın heceyle aynı etiketi taşıyan durağı seç.', { options: unitChoices(a) });
    unit('find', b, b !== a ? 'Başka bir hece geldi. Dinle ve doğru yükü seç.' : 'Aynı heceyi bu kez yeni yükünde bul. Dinleyip seçebilirsin.', { options: unitChoices(b) });
    unit('assemble', b, b !== a ? 'İkinci hecenin harflerini de sıraya yerleştir.' : 'Aynı heceyi başka bir vagonda harflerinden yeniden kur.', { tokens: [...b] });
    unit('route', a, 'İlk heceye yeniden dön. Doğru duraktan yükünü gönder.', { options: unitChoices(a) });
    plan.focusTexts = unique([a, b]);
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
    const numericOrder = selection ? orderContentPool('numbers', contentPools.numbers, selection)
      : [...contentPools.numbers.slice(2), ...contentPools.numbers.slice(0, 2)].slice(rotation * 2 % 11).concat([...contentPools.numbers.slice(2), ...contentPools.numbers.slice(0, 2)].slice(0, rotation * 2 % 11));
    const a = Number(numericOrder[0]), b = Number(numericOrder[1] ?? numericOrder[0]);
    const countChoices = quantity => choices([String(quantity), ...contentPools.numbers.filter(value => Number(value) !== quantity)
      .sort((left, right) => Math.abs(Number(left) - quantity) - Math.abs(Number(right) - quantity))], String(quantity));
    const initialA = a <= 8 ? a + 2 : a - 2;
    const initialB = b > 0 ? b - 1 : 1;
    add('collect', null, null, `İlk şenlik sepetine ${a} tane nesne yerleştir. Tek tek sayabilirsin.`, a, { quantity: a, initialQuantity: 0 });
    add('deliver', null, null, 'Doldurduğun ilk sepetin sayı etiketini seçip teslim et.', a, { quantity: a, options: countChoices(a) });
    add('balance', null, null, initialA > a ? `İlk sepete biraz fazla konmuş. ${a} tane kalacak şekilde düzenle.` : `İlk sepette eksik var. ${a} tane olana kadar tamamla.`, a, { quantity: a, initialQuantity: initialA });
    add('collect', null, null, `Şimdi başka bir sepeti ${b} tane nesneyle dolduralım.`, b, { quantity: b, initialQuantity: 0 });
    add('balance', null, null, initialB < b ? `İkinci sepette eksik var. ${b} tane olana kadar tamamla.` : 'İkinci sepette hiç nesne kalmamalı. Fazla nesneyi geri koy.', b, { quantity: b, initialQuantity: initialB });
    add('route', null, null, 'İlk sepetin miktarını hatırla. Doğru sayı tabelasından şenliğe geç.', a, { quantity: a, options: countChoices(a) });
  }
  plan.wordTexts = unique(plan.stages.map(stage => stage.word).filter(Boolean));
  if (!plan.focusTexts.length) plan.focusTexts = kind === 'numbers' ? unique(plan.stages.map(stage => stage.target)) : [...plan.wordTexts];
  return plan;
}

/** Only served targets enter the selection ledger; alternatives never do.
 * Older saved plans without contentPools remain resumable without inventing
 * a historical exposure from an edited teacher list. */
export function getQuestContentExposures(plan, stage) {
  if (!plan || !stage || !plan.contentPools) return [];
  const observations = [];
  const add = (domain, values) => {
    const pool = Array.isArray(plan.contentPools[domain]) ? plan.contentPools[domain].filter(value => typeof value === 'string').slice(0, 4096) : [];
    const canonical = value => domain === 'sentences' ? text(value).replace(/\s+/gu, ' ') : String(value ?? '');
    const items = unique(values.map(canonical).filter(value => pool.includes(value)));
    if (items.length) observations.push({ id: stage.id, domain, items, pool: [...pool] });
  };
  if (plan.kind === 'numbers') add('numbers', [stage.target]);
  else if (plan.kind === 'letters') add('letters', [stage.word || stage.target]);
  else {
    if (stage.word) add('words', [stage.word]);
    if (stage.itemType === 'syllable') add('syllables', [stage.unitText || stage.target]);
    else if (plan.kind === 'syllables') {
      if (stage.mechanic === 'assemble' && stage.skill === 'syllables' || stage.mechanic === 'assemble' && stage.skill === 'recall') add('syllables', stage.parts || stage.tokens || []);
      else if (stage.skill === 'syllables') add('syllables', [stage.target]);
    }
    if (plan.kind === 'sentences' && stage.sentence) add('sentences', [stage.sentence]);
  }
  return observations;
}

/** Choose an available next world from observed needs, without pretending that
 * numeracy practice supplies reading evidence. Clock is explicit for tests. */
export function recommendQuestKind({ learningState, letters = [], history = [], selection, excludeKind, now: clock } = {}) {
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
  let candidates = QUEST_KINDS.filter(meta => buildQuestPlan(meta.id, { learningState: state, letters: [...selected], history, selection, now }).available);
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
