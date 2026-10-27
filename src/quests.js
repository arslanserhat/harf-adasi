import { buildQuestPlan, recommendQuestKind, getQuestContentExposures, QUEST_KINDS } from './quest-model.js';
import { createQuestScene } from './quest-scenes.js';
import { illustration } from './visuals.js';
import { mountWritingGuard } from './writing.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
const button = (action, label, attributes = '', className = '') => `<button type="button" class="quest-button ${className}" data-quest="${action}" ${attributes}>${label}</button>`;
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const number = (value, max = 100) => Math.max(0, Math.min(max, Math.floor(Number(value) || 0)));
const alphabet = 'abcçdefgğhıijklmnoöprsştuüvyz';
const skills = new Set(['listen', 'syllables', 'build', 'recall', 'write', 'meaning', 'sentence']);
const kinds = ['letters', 'syllables', 'words', 'reading', 'sentences', 'numbers'];
const shuffle = values => values.map(value => ({ value, order: Math.random() })).sort((a, b) => a.order - b.order).map(item => item.value);
const numericSpeech = value => ['sıfır', 'bir', 'iki', 'üç', 'dört', 'beş', 'altı', 'yedi', 'sekiz', 'dokuz', 'on'][value] || String(value);
const clone = value => JSON.parse(JSON.stringify(value));
function inkDistance(paths) {
  let total = 0;
  for (const path of paths) {
    let previous = null;
    for (const [, x, y] of path.matchAll(/[ML](-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g)) {
      const point = { x: Number(x), y: Number(y) };
      if (previous) total += Math.hypot(point.x - previous.x, point.y - previous.y);
      previous = point;
    }
  }
  return Math.min(20000, total);
}

function historyOf(source) {
  return { version: 1, runs: (Array.isArray(source) ? source : Array.isArray(source?.runs) ? source.runs : [])
    .filter(run => object(run) && kinds.includes(run.kind) && typeof run.id === 'string').slice(-100),
  active: object(source?.active) ? source.active : null };
}

/** A quest records learning only after an actual answer or adult review. */
export function createQuests({
  root, getLearningState, getLetters, getHistory = () => ({}), saveHistory = () => {},
  getContentState = () => null, onContentExposure = () => {},
  onAttempt = () => {}, onComplete = () => {}, onHome = () => {}, onParent = () => {},
  speak = async () => false, stopSpeech = () => {}, isMuted = () => false,
  onToggleSound = () => {}, playEffect = () => {}, getLetterPaths = () => [],
}) {
  if (!root || !getLearningState || !getLetters) throw new Error('Quest host is incomplete');
  let current = null;
  let bound = false;
  let resizeFrame = 0;
  let speechEpoch = 0;
  let writingCleanup = null;
  let viewportCleanup = null;

  function signature() {
    const state = getLearningState();
    const list = state?.lists?.find(item => item.id === state.activeListId) || state?.lists?.[0];
    const base = [getLetters(), list?.id, list?.words || []];
    // Preserve old empty-field signatures so an upgrade cannot discard ink.
    if (list?.letters?.length || list?.syllables?.length) base.push(list?.letters || [], list?.syllables || []);
    return JSON.stringify(base);
  }
  function stage() { return current?.plan.stages[current.index]; }
  function requiresAudio(task) { return task.skill === 'listen' || task.itemType === 'syllable' && task.mechanic === 'find' || task.skill === 'syllables' && task.mechanic === 'assemble' || current?.plan.kind === 'letters' && task.mechanic === 'find'; }
  function metadata() { return QUEST_KINDS.find(item => item.id === current?.plan.kind) || {}; }
  function activeSnapshot() {
    if (!current || current.completed) return null;
    return clone({ kind: current.plan.kind, signature: current.signature, plan: current.plan, index: current.index,
      answers: current.answers, ui: current.ui, startedAt: current.startedAt });
  }
  function persist() {
    const history = historyOf(getHistory());
    saveHistory({ ...history, active: activeSnapshot() });
  }
  function saveUi() { if (current && !current.completed) persist(); }
  function questionModel(task) { return ['find', 'route'].includes(task.mechanic) && String(task.model || '').includes('…'); }
  function initialUi(task) {
    const modeled = Boolean(task.guided || !questionModel(task) && task.model && ['write', 'recall', 'build', 'syllables', 'sentence'].includes(task.skill));
    return { correct: false, mistakes: 0, hints: modeled ? 1 : 0, reportedMistakes: 0, reportedHints: 0,
      modelShown: Boolean(!questionModel(task) && task.model && (task.guided || task.skill === 'meaning' || task.mechanic === 'assemble' || task.mechanic === 'find' && !requiresAudio(task))),
      audioPlayed: !requiresAudio(task), optionOrder: shuffle((task.options || []).map((_, index) => index)), bank: shuffle((task.tokens || []).map((text, id) => ({ id, text }))),
      selected: [], quantity: task.mechanic === 'balance' ? number(task.initialQuantity, 10) : 0,
      collected: [], inkPaths: [], inkLength: 0, reviewOpen: false, feedback: '', tone: '' };
  }
  function normalizeUi(raw, task) {
    const ui = initialUi(task);
    if (!object(raw)) return ui;
    const bank = ui.bank;
    const selected = (Array.isArray(raw.selected) ? raw.selected : []).filter(id => Number.isInteger(id) && bank.some(item => item.id === id));
    const unique = [...new Set(selected)];
    if (unique.every((id, index) => bank.find(item => item.id === id)?.text === task.tokens?.[index])) ui.selected = unique;
    ui.correct = raw.correct === true;
    ui.mistakes = number(raw.mistakes);
    ui.hints = Math.max(ui.hints, number(raw.hints));
    ui.reportedMistakes = Math.min(ui.mistakes, number(raw.reportedMistakes));
    ui.reportedHints = Math.min(ui.hints, number(raw.reportedHints));
    ui.modelShown = raw.modelShown === true || ui.modelShown;
    ui.audioPlayed = raw.audioPlayed === true || ui.audioPlayed;
    if (Array.isArray(raw.optionOrder) && raw.optionOrder.length === task.options.length
      && new Set(raw.optionOrder).size === task.options.length && raw.optionOrder.every(index => Number.isInteger(index) && index >= 0 && index < task.options.length)) ui.optionOrder = [...raw.optionOrder];
    ui.quantity = number(raw.quantity, 10);
    ui.collected = [...new Set((Array.isArray(raw.collected) ? raw.collected : []).filter(value => Number.isInteger(value) && value >= 0 && value < 12))];
    ui.inkPaths = (Array.isArray(raw.inkPaths) ? raw.inkPaths : []).filter(value => typeof value === 'string' && value.length <= 8000 && /^M[-\d .L]+$/.test(value)).slice(-12);
    ui.inkLength = inkDistance(ui.inkPaths);
    ui.reviewOpen = raw.reviewOpen === true && ui.inkLength >= 12 && !ui.correct;
    ui.feedback = typeof raw.feedback === 'string' ? raw.feedback.slice(0, 300) : '';
    ui.tone = ['success', 'help', 'retry'].includes(raw.tone) ? raw.tone : '';
    return ui;
  }
  function validSaved(saved, kind, key) {
    if (!object(saved) || saved.kind !== kind || saved.signature !== key || !object(saved.plan)
      || saved.plan.kind !== kind || !Array.isArray(saved.plan.stages) || saved.plan.stages.length !== 6
      || !Number.isInteger(saved.index) || saved.index < 0 || saved.index >= 6) return false;
    if (new Set(saved.plan.stages.map(task => task?.id)).size !== 6 || !Array.isArray(saved.answers) || saved.answers.length > 6) return false;
    const matched = index => saved.answers[index]?.correct === true && saved.answers[index]?.id === saved.plan.stages[index]?.id;
    if (!Array.from({ length: saved.index }, (_, index) => matched(index)).every(Boolean)) return false;
    if ((saved.ui?.correct === true) !== matched(saved.index)) return false;
    if (saved.answers.slice(saved.index + 1).some(answer => answer != null)) return false;
    return saved.plan.stages.every(task => object(task) && typeof task.id === 'string' && typeof task.target === 'string'
      && ['find', 'assemble', 'deliver', 'write', 'route', 'collect', 'balance'].includes(task.mechanic)
      && (!task.skill || skills.has(task.skill))
      && (!task.itemType || ['letter', 'word', 'syllable', 'number'].includes(task.itemType))
      && (!task.unitText || typeof task.unitText === 'string' && /^[abcçdefgğhıijklmnoöprsştuüvyz]{1,24}$/u.test(task.unitText))
      && Array.isArray(task.options) && task.options.length <= 12 && task.options.every(option => object(option) && typeof option.value === 'string' && typeof option.text === 'string')
      && (!task.tokens || Array.isArray(task.tokens) && task.tokens.length <= 24 && task.tokens.every(token => typeof token === 'string' && token.length <= 80)));
  }
  function mountViewport() {
    viewportCleanup?.();
    const html = document.documentElement;
    const previous = html.style.getPropertyValue('--quest-height');
    const update = () => {
      resizeFrame = 0;
      if (!current) return;
      const height = Math.min(...[innerHeight, html.clientHeight, window.visualViewport?.height].filter(value => Number.isFinite(value) && value > 0));
      html.style.setProperty('--quest-height', `${height}px`);
    };
    const schedule = () => { if (!resizeFrame) resizeFrame = requestAnimationFrame(update); };
    window.addEventListener('resize', schedule, { passive: true });
    window.addEventListener('orientationchange', schedule, { passive: true });
    window.visualViewport?.addEventListener('resize', schedule, { passive: true });
    update();
    viewportCleanup = () => {
      cancelAnimationFrame(resizeFrame); resizeFrame = 0;
      window.removeEventListener('resize', schedule); window.removeEventListener('orientationchange', schedule);
      window.visualViewport?.removeEventListener('resize', schedule);
      if (previous) html.style.setProperty('--quest-height', previous); else html.style.removeProperty('--quest-height');
      viewportCleanup = null;
    };
  }
  function attach() { if (!bound) { root.addEventListener('click', click); bound = true; } }
  function stopStage() {
    speechEpoch++;
    stopSpeech();
    writingCleanup?.(); writingCleanup = null;
  }
  function destroy() {
    if (current && !current.completed) persist();
    stopStage();
    const pause = root.querySelector('.quest-pause');
    if (pause?.open) pause.close();
    viewportCleanup?.();
    document.body.classList.remove('quest-playing');
    if (bound) root.removeEventListener('click', click);
    bound = false; current = null;
  }
  function start(kind, options = {}) {
    if (!kinds.includes(kind)) return false;
    destroy(); attach();
    const history = historyOf(getHistory());
    const key = signature();
    const saved = options.fresh ? null : history.active;
    const resume = validSaved(saved, kind, key);
    const plan = resume ? saved.plan : buildQuestPlan(kind, { learningState: getLearningState(), letters: getLetters(), history, selection: getContentState(), now: Date.now() });
    if (resume && !object(plan.contentPools)) {
      const refreshed = buildQuestPlan(kind, { learningState: getLearningState(), letters: getLetters(), history, selection: getContentState(), now: Date.now() });
      plan.contentPools = refreshed.available && object(refreshed.contentPools) ? refreshed.contentPools : {};
    }
    current = { plan, signature: key, index: resume ? saved.index : 0,
      answers: resume && Array.isArray(saved.answers) ? saved.answers.slice(0, 6) : [],
      ui: null, startedAt: resume ? Number(saved.startedAt) || Date.now() : Date.now(), completed: false, paused: false };
    if (plan.available && plan.stages?.length) {
      current.ui = normalizeUi(resume ? saved.ui : null, stage());
      if (!resume && saved?.kind === kind && saved.signature !== key) current.ui.feedback = 'Öğretmeninin yeni kelimeleri hazır. Bu maceraya güncel listenle başlıyoruz.';
    }
    document.body.classList.add('quest-playing');
    mountViewport();
    render();
    if (plan.available && plan.stages?.length) persist();
    window.scrollTo(0, 0);
    return true;
  }
  function nav() {
    return `<nav class="quest-nav" aria-label="Macera araçları">${button('home', '← Adama dön', '', 'quest-back')}<span class="quest-world-name">${esc(current.plan.title)}</span><div class="quest-nav-actions">${button('sound', `<i data-lucide="${isMuted() ? 'volume-x' : 'volume-2'}"></i>`, `aria-label="${isMuted() ? 'Sesi aç' : 'Sesi kapat'}" aria-pressed="${!isMuted()}"`, 'quest-sound')}${button('pause', 'Mola', '', 'quest-back')}</div></nav>`;
  }
  function feedback(message, tone = '') {
    if (!current?.ui) return;
    current.ui.feedback = message; current.ui.tone = tone;
    const element = root.querySelector('#questFeedback');
    if (element) { element.textContent = message; element.dataset.tone = tone; }
    saveUi();
  }
  function attempt(correct, { writingReviewed = false } = {}) {
    const task = stage();
    if (task?.itemType === 'syllable' || !task?.skill || !skills.has(task.skill) || !/^[abcçdefgğhıijklmnoöprsştuüvyz]{1,24}$/u.test(task.word || '')) return;
    const recorded = (getLearningState()?.events || []).filter(event => event.id?.startsWith(`${task.id}:`));
    const previousMistakes = Math.max(current.ui.reportedMistakes, recorded.reduce((sum, event) => sum + number(event.mistakes), 0));
    const previousHints = Math.max(current.ui.reportedHints, recorded.reduce((sum, event) => sum + number(event.hints), 0));
    onAttempt({ id: `${task.id}:${correct ? 'complete' : `retry-${current.ui.mistakes}`}`,
      word: task.word, skill: task.skill, correct, mistakes: Math.max(0, current.ui.mistakes - previousMistakes),
      hints: Math.max(0, current.ui.hints - previousHints), writingReviewed,
      independent: correct && !current.ui.hints && !current.ui.mistakes && (!requiresAudio(task) || current.ui.audioPlayed), at: Date.now() });
    current.ui.reportedMistakes = current.ui.mistakes;
    current.ui.reportedHints = current.ui.hints;
  }
  function wrong() {
    if (!current?.ui || current.ui.correct) return;
    current.ui.mistakes++;
    playEffect('retry'); attempt(false);
    feedback(stage().mechanic === 'assemble' ? 'Bu parça buraya uymadı. Önceki parçaları koruduk; sıradakini birlikte bulalım.' : 'Bu kez olmadı. Sahnedeki ipucuna yeniden bakabilir, istersen yardım alabilirsin.', 'retry');
  }
  function finish({ writingReviewed = false } = {}) {
    if (!current?.ui || current.ui.correct) return;
    current.ui.correct = true; current.ui.reviewOpen = false;
    attempt(true, { writingReviewed });
    current.answers[current.index] = { id: stage().id, correct: true, itemType: stage().itemType || (current.plan.kind === 'letters' ? 'letter' : 'word'), unitText: stage().unitText || stage().word || stage().target, mistakes: current.ui.mistakes,
      hints: current.ui.hints, writingReviewed, completedAt: Date.now() };
    current.ui.feedback = stage().success || successText(); current.ui.tone = 'success';
    playEffect('correct');
    persist(); render();
  }
  function successText() {
    return { letters: 'Tabela parçası hazır. Fenerin yolu biraz daha aydınlandı.', syllables: 'Bu yük hazır! Vagonlar sırayla yerine bağlandı.',
      words: 'Siparişin bu kısmı hazır. Paketin adını artık biliyorsun.', reading: 'İpucunu çözdün. Ormanda yeni bir yol açıldı.',
      sentences: 'Mesajın bu parçası hazır. Postanede mektubumuz tamamlanıyor.', numbers: 'Bahçedeki düzen doğru. Yerleştirdiğin nesneler sahnede kaldı.' }[current.plan.kind];
  }
  function hint() {
    if (current.ui.correct) return;
    if (!current.ui.modelShown) current.ui.hints++;
    current.ui.modelShown = !current.ui.modelShown;
    if (requiresAudio(stage())) current.ui.audioPlayed = true;
    current.ui.feedback = current.ui.modelShown ? 'Örneği birlikte açtık. Bu adım destekli kaydedilecek.' : 'Örneği kapattık. Kaldığın yerden devam edebilirsin.';
    current.ui.tone = 'help'; persist(); render();
  }
  async function listen() {
    const task = stage();
    if (!task || current.ui.correct) return;
    if (isMuted()) { feedback('Ses kapalı. Hoparlörü açabilir ya da örneği birlikte okuyabilirsin.', 'help'); return; }
    const epoch = ++speechEpoch;
    const plan = current.plan;
    const text = task.skill === 'sentence' ? task.target : task.unitText || task.word || numericSpeech(task.quantity ?? Number(task.target));
    if (!requiresAudio(task)) current.ui.hints++;
    root.querySelector('[data-quest="listen"]')?.setAttribute('aria-busy', 'true');
    const played = await speak(text);
    if (!current || current.plan !== plan || stage() !== task || epoch !== speechEpoch) return;
    root.querySelector('[data-quest="listen"]')?.setAttribute('aria-busy', 'false');
    if (played === false) { feedback('Türkçe ses bu metin için çalınamadı. “Birlikte oku” ile bir büyüğün yardım edebilir.', 'help'); return; }
    current.ui.audioPlayed = true;
    persist(); render();
  }
  function objectButtons(task) {
    const ui = current.ui;
    if (['find', 'deliver', 'route'].includes(task.mechanic)) {
      return `<div class="quest-scene-objects" role="group" aria-label="Sahnedeki nesneler">${ui.optionOrder.map(index => task.options[index]).filter(Boolean).map((option, index) => {
        const image = option.image || option.emoji;
        const text = option.text || '';
        // Older saved picture choices have no separate text alternative.
        const label = option.accessibleLabel || (image && (!text || text === 'Resimli paket') ? option.value : text) || 'Sahnedeki nesne';
        const disabled = ui.correct || requiresAudio(task) && !ui.audioPlayed;
        return button('choice', `${image ? `<span class="quest-object-art" aria-hidden="true">${illustration(image)}</span>` : ''}<span class="quest-object-label">${esc(text)}</span>`, `data-value="${esc(option.value)}" style="--object-index:${index}" ${disabled ? 'disabled' : ''} aria-label="${esc(label)}"`, `quest-scene-object quest-scene-object-${task.mechanic}${ui.correct && option.value === task.target ? ' is-correct' : ''}`);
      }).join('')}</div>`;
    }
    if (task.mechanic === 'collect') {
      const total = Math.max(6, Math.min(10, number(task.quantity, 8) + 2));
      return `<div class="quest-scene-objects quest-garden-objects" role="group" aria-label="Toplayabileceğin çiçekler">${Array.from({ length: total }, (_, index) => button('collect', `<span class="quest-object-art" aria-hidden="true">${illustration('🌷')}</span><span class="quest-object-label">${ui.collected.includes(index) ? 'Sepette' : 'Topla'}</span>`, `data-index="${index}" style="--object-index:${index}" aria-label="${index + 1}. çiçeği ${ui.collected.includes(index) ? 'geri koy' : 'topla'}" aria-pressed="${ui.collected.includes(index)}" ${ui.correct ? 'disabled' : ''}`, `quest-scene-object quest-garden-object${ui.collected.includes(index) ? ' is-collected' : ''}`)).join('')}</div>`;
    }
    return '';
  }
  function tools(task) {
    const ui = current.ui;
    const hear = task.mechanic !== 'balance' && task.mechanic !== 'collect';
    const showHint = !['balance', 'collect'].includes(task.mechanic);
    return `<div class="quest-tool-row">${hear ? button('listen', '<i data-lucide="volume-2"></i> Dinle', `${ui.correct ? 'disabled' : ''} aria-label="Görevdeki ${task.skill === 'sentence' ? 'mesajı' : 'sözü'} dinle"`, 'quest-listen') : ''}${showHint ? button('hint', ui.modelShown ? 'Örneği kapat' : requiresAudio(task) ? 'Birlikte oku' : 'İpucu', ui.correct ? 'disabled' : '', 'quest-hint') : ''}</div>`;
  }
  function model(task) {
    const question = questionModel(task);
    const text = question ? current.ui.modelShown ? task.model.replace('…', task.target) : task.model
      : task.model || (task.skill === 'sentence' ? task.target : task.unitText || task.word || task.target);
    return `<div id="questModel" class="quest-model" ${question || current.ui.modelShown ? '' : 'hidden'}>${esc(text)}</div>`;
  }
  function assembly(task) {
    const ui = current.ui;
    return `<div class="quest-slots quest-slots-${current.plan.kind}" id="questSlots" aria-label="Yerleştirdiğin parçalar">${(task.tokens || []).map((token, index) => `<span class="quest-slot${ui.selected[index] !== undefined ? ' is-filled' : ''}" aria-label="${index + 1}. parça">${esc(ui.bank.find(item => item.id === ui.selected[index])?.text || '')}</span>`).join('')}</div>
      <div class="quest-bank" id="questBank" aria-label="Kullanabileceğin parçalar">${ui.bank.map(item => button('tile', esc(item.text), `data-id="${item.id}" ${ui.correct || ui.selected.includes(item.id) || requiresAudio(task) && !ui.audioPlayed ? 'disabled' : ''}`, `quest-tile${ui.selected.includes(item.id) ? ' is-used' : ''}`)).join('')}</div>
      <div class="quest-assembly-tools">${button('undo', 'Son parçayı geri al', ui.correct || !ui.selected.length ? 'disabled' : '', 'quest-hint')}${button('restart', 'Yeniden kur', ui.correct || !ui.selected.length ? 'disabled' : '', 'quest-hint')}</div>`;
  }
  function notebook(task) {
    const paths = task.guided || current.ui.modelShown ? getLetterPaths(task.word) || [] : [];
    return `<div class="quest-write-area"><span class="quest-write-label">${task.guided ? 'TABELANIN İZİNİ ÇİZ' : 'KENDİ YAZINI YAZ'}</span><svg id="questPad" viewBox="0 0 400 340" role="img" aria-label="${esc(task.word)} yazma alanı"><path class="quest-write-line" d="M15 60H385M15 135H385M15 325H385"/><path class="quest-write-baseline" d="M15 270H385"/>${paths.map((d, index) => `<path class="quest-write-guide" data-target="${index}" d="${esc(d)}"/>`).join('')}<g id="questInk"></g></svg></div>
      <div class="quest-write-controls">${button('clear', 'Yeniden yaz', current.ui.correct ? 'disabled' : '', 'quest-hint')}${button('review', 'Yazdım, birlikte bakalım', current.ui.correct || current.ui.inkLength < 12 ? 'disabled' : '', 'quest-primary')}</div>
      <p class="quest-write-note">Yazını bir büyüğünle kontrol et. El yazısı otomatik tanınmaz.</p>
      <section id="questReview" class="quest-write-review" ${current.ui.reviewOpen ? '' : 'hidden'} aria-label="Birlikte yazı kontrolü"><strong>Birlikte kontrol edelim</strong><p>Yazılan “${esc(task.word)}” mı? Harflerin biçimine ve sırasına birlikte bakın.</p><div>${button('approve', 'Birlikte kontrol ettik', '', 'quest-primary')}${button('retry-writing', 'Yeniden deneyelim', '', 'quest-hint')}</div></section>`;
  }
  function quantityControls(task) {
    const ui = current.ui;
    return `<div class="quest-quantity" aria-live="polite"><span>İstenen</span><strong>${number(task.quantity, 10)}</strong><span>Sepetimde</span><strong id="questQuantity">${ui.quantity}</strong></div>${task.mechanic === 'balance' ? `<div class="quest-count-controls">${button('remove', '− Birini geri koy', ui.correct || ui.quantity === 0 ? 'disabled' : '', 'quest-count-remove')}${button('add', '+ Bir tane ekle', ui.correct || ui.quantity >= 10 ? 'disabled' : '', 'quest-count-add')}</div><div class="quest-basket" aria-label="Sepette ${ui.quantity} çiçek">${Array.from({ length: ui.quantity }, () => `<span aria-hidden="true">${illustration('🌷')}</span>`).join('')}</div>` : ''}${button('check-count', 'Sepeti kontrol et', ui.correct ? 'disabled' : '', 'quest-primary quest-count-check')}`;
  }
  function controls(task) {
    const ui = current.ui;
    return `<div class="quest-mission"><h2>${esc(task.prompt || current.plan.goal)}</h2>${task.instruction ? `<p>${esc(task.instruction)}</p>` : ''}</div>${tools(task)}${model(task)}${task.mechanic === 'assemble' ? assembly(task) : task.mechanic === 'write' ? notebook(task) : ['collect', 'balance'].includes(task.mechanic) ? quantityControls(task) : ''}<div id="questFeedback" class="quest-feedback" data-tone="${ui.tone}" role="status" aria-live="polite">${esc(ui.feedback || 'Sahne seni bekliyor. Hazır olduğunda başlayabilirsin.')}</div><div class="quest-next-row"><span>${current.index + 1} / ${current.plan.stages.length} görev</span>${button('next', current.index + 1 === current.plan.stages.length ? 'Macerayı tamamla →' : 'Yola devam →', `id="questNext" ${ui.correct ? '' : 'disabled'}`, 'quest-primary')}</div>`;
  }
  function render() {
    if (!current) return;
    stopStage();
    if (!current.plan.available || !current.plan.stages?.length) {
      root.innerHTML = `<section id="quest" class="quest-app" data-screen="unavailable" data-kind="${esc(current.plan.kind)}">${nav()}<div class="quest-unavailable"><h1>${esc(current.plan.title)}</h1><p>${esc(current.plan.reason || 'Bu dünya için öğretmenin kelimelerini birlikte hazırlayalım.')}</p>${button('parent', 'Öğretmenimin listesini düzenle', '', 'quest-primary')}${button('home', 'Adama dön', '', 'quest-hint')}</div>${current.paused ? pauseMarkup() : ''}</section>`;
      if (current.paused) mountPause();
      return;
    }
    if (current.completed) { renderSummary(); return; }
    const task = stage();
    const ui = current.ui;
    for (const exposure of getQuestContentExposures(current.plan, task)) onContentExposure({ ...exposure, at: Date.now() });
    const progress = { index: current.index, total: current.plan.stages.length, correct: ui.correct,
      phase: ui.correct ? 'success' : 'working', selected: ui.selected.map(id => ui.bank.find(item => item.id === id)?.text || ''),
      quantity: ui.quantity, completedStages: current.answers.filter(answer => answer?.correct).length,
      feedback: ui.feedback, tone: ui.tone, paused: current.paused, objectsMarkup: objectButtons(task) };
    root.innerHTML = `<section id="quest" class="quest-app${task.mechanic === 'write' ? ' quest-writing' : ''}" data-screen="task" data-kind="${esc(current.plan.kind)}" data-mechanic="${esc(task.mechanic)}" data-stage-id="${esc(task.id)}">${nav()}<header class="quest-header"><span>${esc(current.plan.title)}</span><h1>${esc(current.plan.goal)}</h1></header><div class="quest-track" aria-label="${current.index + 1}. görev, toplam ${current.plan.stages.length}">${current.plan.stages.map((_, index) => `<span class="${index < current.index ? 'past' : index === current.index ? 'current' : ''}"></span>`).join('')}</div>${createQuestScene(current.plan, task, progress, controls(task))}${current.paused ? pauseMarkup() : ''}</section>`;
    if (task.mechanic === 'write') mountNotebook();
    if (current.paused) mountPause();
  }
  function mountNotebook() {
    const svg = root.querySelector('#questPad'), ink = root.querySelector('#questInk');
    if (!svg || !ink) return;
    const ns = 'http://www.w3.org/2000/svg';
    const ui = current.ui;
    for (const data of ui.inkPaths) { const path = document.createElementNS(ns, 'path'); path.setAttribute('class', 'quest-ink'); path.setAttribute('d', data); ink.append(path); }
    let active = null, last = null, coordinates = [], path = null;
    const coord = event => {
      const point = svg.createSVGPoint(); point.x = event.clientX; point.y = event.clientY;
      const matrix = svg.getScreenCTM();
      const mapped = matrix ? point.matrixTransform(matrix.inverse()) : point;
      return { x: Math.max(0, Math.min(400, mapped.x)), y: Math.max(0, Math.min(340, mapped.y)) };
    };
    const add = point => {
      if (last) ui.inkLength += Math.hypot(point.x - last.x, point.y - last.y);
      coordinates.push(point); last = point;
      path.setAttribute('d', coordinates.map((item, index) => `${index ? 'L' : 'M'}${item.x.toFixed(1)} ${item.y.toFixed(1)}`).join(' '));
    };
    const down = event => {
      if (ui.correct || current.paused || active !== null || event.isPrimary === false || event.pointerType === 'mouse' && event.button !== 0) return;
      event.preventDefault(); active = event.pointerId; coordinates = []; last = null;
      path = document.createElementNS(ns, 'path'); path.setAttribute('class', 'quest-ink'); ink.append(path);
      try { svg.setPointerCapture(active); } catch { /* Older Safari uses guard fallbacks. */ }
      add(coord(event));
    };
    const move = event => { if (event.pointerId === active) { event.preventDefault(); add(coord(event)); } };
    const up = event => {
      if (event.pointerId !== active) return;
      active = null;
      try { if (svg.hasPointerCapture(event.pointerId)) svg.releasePointerCapture(event.pointerId); } catch { /* Already released. */ }
      ui.inkPaths = [...ink.querySelectorAll('path')].map(item => item.getAttribute('d')).filter(value => value && value.length <= 8000).slice(-12);
      const review = root.querySelector('[data-quest="review"]'); if (review) review.disabled = ui.inkLength < 12 || ui.correct;
      saveUi();
    };
    svg.addEventListener('pointerdown', down); svg.addEventListener('pointermove', move);
    svg.addEventListener('pointerup', up); svg.addEventListener('pointercancel', up); svg.addEventListener('lostpointercapture', up);
    const guard = mountWritingGuard(svg);
    writingCleanup = () => {
      ui.inkPaths = [...ink.querySelectorAll('path')].map(item => item.getAttribute('d')).filter(value => value && value.length <= 8000).slice(-12);
      ui.inkLength = inkDistance(ui.inkPaths);
      saveUi();
      guard?.destroy(); svg.removeEventListener('pointerdown', down); svg.removeEventListener('pointermove', move);
      svg.removeEventListener('pointerup', up); svg.removeEventListener('pointercancel', up); svg.removeEventListener('lostpointercapture', up);
    };
  }
  function pauseMarkup() {
    return `<dialog class="quest-pause" role="dialog" aria-modal="true" aria-labelledby="questPauseTitle" aria-describedby="questPauseDescription"><div><h2 id="questPauseTitle">Küçük bir mola</h2><p id="questPauseDescription">Dünyan ve hazırladıkların burada bekliyor.</p>${button('resume', 'Maceraya dön', '', 'quest-primary')}${button('home', 'Adama dön', '', 'quest-hint')}</div></dialog>`;
  }
  function resume() {
    if (!current?.paused) return;
    current.paused = false;
    render();
    root.querySelector('[data-quest="pause"]')?.focus({ preventScroll: true });
  }
  function mountPause() {
    const dialog = root.querySelector('.quest-pause');
    if (!dialog) return;
    dialog.addEventListener('cancel', event => { event.preventDefault(); resume(); });
    dialog.addEventListener('keydown', event => {
      if (event.key === 'Escape') { event.preventDefault(); resume(); return; }
      if (event.key !== 'Tab') return;
      const controls = [...dialog.querySelectorAll('button:not(:disabled)')];
      const first = controls[0], last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    });
    dialog.showModal();
    dialog.querySelector('[data-quest="resume"]')?.focus({ preventScroll: true });
  }
  function next() {
    if (!current?.ui.correct || current.paused) return;
    if (current.index + 1 === current.plan.stages.length) { complete(); return; }
    current.index++;
    current.ui = initialUi(stage());
    persist(); render();
  }
  function nextKind() { return recommendQuestKind({ learningState: getLearningState(), letters: getLetters(), history: getHistory(), selection: getContentState(), excludeKind: current.plan.kind, now: Date.now() }); }
  function complete() {
    if (!current || current.completed || current.answers.length !== current.plan.stages.length
      || !current.plan.stages.every((task, index) => current.answers[index]?.correct === true && current.answers[index]?.id === task.id)) return;
    current.completed = true;
    stopStage();
    const history = historyOf(getHistory());
    const run = { id: current.plan.id, kind: current.plan.kind, completed: true, completedStages: current.plan.stages.length,
      totalStages: current.plan.stages.length, startedAt: current.startedAt, completedAt: Date.now(),
      wordTexts: current.plan.wordTexts || [], focusTexts: current.plan.focusTexts || current.plan.wordTexts || [], results: clone(current.answers) };
    saveHistory({ version: 1, active: null, runs: [...history.runs.filter(item => item.id !== run.id), run].slice(-100) });
    onComplete(run);
    playEffect('complete');
    renderSummary();
    if (!isMuted()) void speak('Tebrikler, başardın!');
  }
  function renderSummary() {
    const next = QUEST_KINDS.find(item => item.id === nextKind());
    const currentMeta = metadata();
    root.innerHTML = `<section id="quest" class="quest-app" data-screen="summary" data-kind="${esc(current.plan.kind)}">${nav()}<div class="quest-summary"><span class="quest-summary-seal" aria-hidden="true">✓</span><span class="quest-eyebrow">Adada bir iz bıraktın</span><h1>${esc(current.plan.title)} tamamlandı!</h1><p>${esc(currentMeta.ending || 'Altı görev boyunca hazırladığın parçalar bu dünyada bir araya geldi.')}</p><div class="quest-summary-result"><b>6</b><span>görev tamamlandı</span><span>${(current.plan.focusTexts || current.plan.wordTexts || []).map(esc).join(' · ')}</span></div><p>${current.plan.kind === 'numbers' ? 'Çiçekleri saydın, sepetleri düzelttin. Şimdi başka bir dünya seni bekliyor.' : 'Bu kelimeler başka görevlerde yeniden karşına çıkacak. Bugünkü başarı, sonraki günlerde hatırlama çalışmasıyla pekişecek.'}</p><div class="quest-summary-actions">${button('next-world', `${esc(next?.title || 'Sonraki dünya')} →`, '', 'quest-primary')}${button('home', 'Adama dön', '', 'quest-hint')}${button('parent', 'Birlikte gelişimimize bakalım', '', 'quest-hint')}</div></div>${current.paused ? pauseMarkup() : ''}</section>`;
    if (current.paused) mountPause();
  }
  function click(event) {
    const control = event.target.closest('[data-quest]');
    if (!control || control.disabled || !root.contains(control) || !current) return;
    const action = control.dataset.quest;
    if (current.paused && !control.closest('.quest-pause')) return;
    if (!['choice', 'tile', 'collect', 'check-count', 'approve', 'hint'].includes(action)) playEffect('tap');
    if (action === 'home') { destroy(); onHome(); return; }
    if (action === 'parent') { destroy(); onParent(); return; }
    if (action === 'sound') { onToggleSound(); render(); return; }
    if (action === 'pause') { current.paused = true; stopSpeech(); render(); return; }
    if (action === 'resume') { resume(); return; }
    if (action === 'next-world' && current.completed) { start(nextKind(), { fresh: true }); return; }
    if (current.completed || current.paused) return;
    const task = stage(), ui = current.ui;
    if (action === 'next') { next(); return; }
    if (action === 'listen') { void listen(); return; }
    if (action === 'hint') { hint(); return; }
    if (ui.correct) return;
    if (action === 'choice') {
      if (requiresAudio(task) && !ui.audioPlayed) { feedback('Önce sözü dinleyelim veya bir büyüğümüzle okuyalım.', 'help'); return; }
      if (control.dataset.value === task.target) finish(); else wrong();
    } else if (action === 'tile') {
      if (requiresAudio(task) && !ui.audioPlayed) { feedback('Önce yükün kelimesini dinleyelim veya birlikte okuyalım.', 'help'); return; }
      const tile = ui.bank.find(item => item.id === Number(control.dataset.id));
      if (!tile || ui.selected.includes(tile.id)) return;
      if (tile.text !== task.tokens?.[ui.selected.length]) { wrong(); return; }
      ui.selected.push(tile.id);
      if (ui.selected.length === task.tokens.length) finish(); else { playEffect('tap'); persist(); render(); }
    } else if (action === 'undo' || action === 'restart') {
      if (!ui.selected.length) return;
      ui.hints++;
      ui.selected = action === 'undo' ? ui.selected.slice(0, -1) : [];
      persist(); render();
    } else if (action === 'collect') {
      const index = number(control.dataset.index, 11);
      ui.collected = ui.collected.includes(index) ? ui.collected.filter(value => value !== index) : [...ui.collected, index];
      ui.quantity = ui.collected.length;
      playEffect('tap'); persist(); render();
    } else if (action === 'add' || action === 'remove') {
      ui.quantity = Math.max(0, Math.min(10, ui.quantity + (action === 'add' ? 1 : -1)));
      persist(); render();
    } else if (action === 'check-count') {
      if (ui.quantity === Number(task.target)) finish(); else wrong();
    } else if (action === 'clear') {
      // Finish the old surface before clearing its saved state; its cleanup
      // captures live strokes and must not copy them back during render.
      stopStage();
      ui.inkPaths = []; ui.inkLength = 0; ui.reviewOpen = false;
      persist(); render();
    } else if (action === 'review') {
      if (ui.inkLength < 12) { feedback('Önce yazı alanına bir şeyler yazalım.', 'help'); return; }
      ui.reviewOpen = true; persist(); render();
    } else if (action === 'approve' && ui.reviewOpen && ui.inkLength >= 12) {
      finish({ writingReviewed: true });
    } else if (action === 'retry-writing' && ui.reviewOpen) {
      ui.mistakes++; attempt(false, { writingReviewed: true });
      ui.reviewOpen = false; ui.feedback = 'Acele etmeden yeniden deneyelim. Yazın hâlâ burada.'; ui.tone = 'help';
      persist(); render();
    }
  }
  return { start, destroy, getSnapshot: () => activeSnapshot(), get active() { return Boolean(current); } };
}
