import './story-film.css';
import { renderFilmStage, mountFilmStage } from './story-film-stage.js';
import { mountWritingGuard } from './writing.js';
import { FILM_TITLE, FILM_SCENES, FILM_LINE_BY_ID } from './story-film-script.js';
import { FILM_STORE_KEY, createFilmState, normalizeFilmState, getFilmEligibility, getFilmTask, filmCanAdvance, makeFilmAttempt, editFilmInk, hasFilmInk } from './story-film-model.js';

const memory = new Map();
const esc = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
const button = (action, text, extra = '', kind = '') => `<button type="button" class="film-button ${kind}" data-do="film-control" data-film="${action}" ${extra}>${text}</button>`;
const speakerName = { narrator: 'Anlatıcı', lion: 'Minik Aslan', bird: 'Pırpır' };
const basePath = () => typeof document !== 'undefined' && document.querySelector('meta[name="harf-backend"]')?.content === 'laravel' ? '/' : (import.meta.env?.BASE_URL || '/');

export function renderStoryFilmCard({ assetBase = basePath() } = {}) {
  const base = String(assetBase || '/').replace(/\/?$/, '/');
  return `<button type="button" class="story-film-card" data-do="story-film"><span class="story-film-card-picture"><img src="${esc(base)}art/story-watermill-v1.png" alt="" loading="lazy"><span class="story-film-card-play" aria-hidden="true"><svg viewBox="0 0 32 32"><path d="m12 7 14 9-14 9Z"/></svg></span></span><span class="story-film-card-copy"><span class="story-film-card-kicker">Birlikte oynayacağımız bir film</span><strong>${FILM_TITLE}</strong><span>Rüzgâr çıktı, çark sustu. Minik Aslan ve Pırpır’la suyun izini sür.</span><span class="story-film-card-cta">Macera başlasın</span></span></button>`;
}

export function createStoryFilm({ root, getLetters = () => [], getLearningState = () => ({}), speak = async () => false,
  stopSpeech = () => {}, isMuted = () => false, onAttempt = () => {}, onHome = () => {}, onParent = () => {}, onToggleSound = () => {} } = {}) {
  if (!root?.ownerDocument) throw new Error('Film root is required');
  const doc = root.ownerDocument, win = doc.defaultView;
  let state = createFilmState(), active = false, paused = false, busy = false, epoch = 0, stage = null, writingCleanup = null;
  let shownLine = null, feedback = '', notice = '', attached = false, returnFocus = null;
  const reduced = () => Boolean(win.matchMedia?.('(prefers-reduced-motion: reduce)').matches || doc.body.dataset.motionPaused === 'true');
  const eligible = () => getFilmEligibility(getLearningState(), getLetters());
  const lines = () => FILM_SCENES[state.scene].lines.filter(id => id !== (state.choices.branch === 'bird' ? 's3-lion' : 's3-bird'));
  function describeFocus() {
    const element = doc.activeElement;
    return element && root.contains(element) ? { element, id: element.id, action: element.dataset?.film, value: element.dataset?.value } : null;
  }
  function restoreFocus(saved, changedTask = false) {
    if (!saved) return;
    const usable = element => element && !element.disabled && !element.closest('[hidden],dialog:not([open])');
    let target = usable(saved.element) && saved.element.isConnected ? saved.element : null;
    if (!target && saved.id) { const candidate = doc.getElementById(saved.id); if (root.contains(candidate) && usable(candidate)) target = candidate; }
    if (!target && !changedTask && saved.action) target = [...root.querySelectorAll('[data-film]')]
      .find(element => element.dataset.film === saved.action && element.dataset.value === saved.value && usable(element));
    if (!target && saved.action === 'token' && !changedTask) { const candidate = root.querySelector('[data-film="check"]'); if (usable(candidate)) target = candidate; }
    if (!target) target = root.querySelector('.film-task-title') || root.querySelector('#storyFilm');
    target?.focus({ preventScroll: true });
  }
  function save() {
    state.updatedAt = Date.now(); memory.set(FILM_STORE_KEY, JSON.stringify(state));
    try { win.localStorage.setItem(FILM_STORE_KEY, JSON.stringify(state)); } catch { /* The in-memory session remains usable. */ }
  }
  function load() {
    let raw;
    try { raw = win.localStorage.getItem(FILM_STORE_KEY); } catch { raw = memory.get(FILM_STORE_KEY); }
    try { return normalizeFilmState(raw ? JSON.parse(raw) : null); } catch { return createFilmState(); }
  }
  function cancelSpeech() { epoch++; busy = false; stopSpeech(); stage?.setSpeaking(null); }
  function cleanStage() { writingCleanup?.(); writingCleanup = null; stage?.dispose(); stage = null; }
  function ensureMode() {
    if (state.mode === 'learn' && !eligible().eligible) {
      state.mode = 'watch'; notice = 'Öğretmen içeriği değişti. İzleme modunda devam ediyoruz; yeni okuma ve yazma kaydı oluşmaz.'; save(); return false;
    }
    return state.mode === 'learn';
  }
  function attempt(checkpoint) {
    if (!ensureMode()) return;
    const event = makeFilmAttempt(state, checkpoint);
    if (!event || state.emitted.includes(event.id)) return;
    try { onAttempt(event); state.emitted.push(event.id); save(); }
    catch { notice = 'Bu çalışmanın kaydı şu anda eklenemedi. Hikâyeye devam edebilirsin.'; }
  }
  function stageProps() {
    const task = getFilmTask(state);
    return { assetBase: basePath(), scene: state.scene, ...state.choices, phase: state.phase,
      millRunning: state.scene >= 4, gateOpen: state.scene >= 3,
      watered: state.scene >= 5 || state.tasks.connected.read,
      leafCount: state.scene < 1 ? 0 : 4 - state.tasks.leaves.removed.length,
      flowerGrown: state.scene === 5,
      // An earlier example must never remain on stage during independent recall/writing.
      label: state.scene === 2 && state.tasks.guided.correct || state.scene === 4 && !['recall', 'write'].includes(task) || state.scene === 5 ? 'lale' : '' };
  }
  function nav() {
    return `<nav class="film-nav" aria-label="Film araçları">${button('home', 'Adaya dön', '', 'quiet')}<span>${state.mode === 'learn' ? 'Birlikte öğreniyoruz' : 'Film izleme modu'} · ${state.scene + 1} / 6</span><div>${button('sound', isMuted() ? 'Sesi aç' : 'Sesi kapat', `aria-pressed="${isMuted()}"`, 'quiet')}${button('pause', 'Duraklat', '', 'quiet')}</div></nav>`;
  }
  function renderCover() {
    cancelSpeech(); cleanStage(); paused = false; shownLine = null;
    const access = eligible(), saved = state.phase !== 'cover';
    root.innerHTML = `<section id="storyFilm" class="film-app film-cover" tabindex="-1" data-screen="cover"><nav class="film-nav">${button('home', 'Adaya dön', '', 'quiet')}</nav><div class="film-cover-art">${renderFilmStage({ assetBase: basePath(), scene: 0, leafCount: 0 })}</div><div class="film-cover-copy"><h1>${FILM_TITLE}</h1><p>Rüzgâr yaprakları su kanalına taşıdı. Minik Aslan ve Pırpır’la çarkı yeniden çalıştır, çiçeğin büyümesine yardım et.</p><p class="film-access-note">Öğrenme bölümü için öğretmen listesinde <b>lale</b> ve öğrenilen harflerde <b>l, a, e</b> gerekir.${!access.eligible ? ' Şimdilik filmi birlikte izleyebilirsin.' : ''}</p><div class="film-actions">${saved ? button('continue-film', 'Kaldığım yerden devam et', '', 'primary') : ''}${button('start-learn', 'Oynayarak başla', access.eligible ? '' : 'disabled', saved ? '' : 'primary')}${button('start-watch', 'Birlikte izleyelim', '', 'quiet')}${button('parent', 'Öğretmenimin içeriği', '', 'quiet')}</div><p class="film-small">Acele yok. İstediğin an duraklatabilir veya altyazılarla devam edebilirsin. İzleme modu okuma ve yazma başarısı kaydetmez.</p></div></section>`;
    root.querySelector('#storyFilm')?.focus({ preventScroll: true });
  }
  function renderFrame() {
    cleanStage();
    const task = state.phase === 'task' || state.phase === 'ready' ? getFilmTask(state) : '';
    root.innerHTML = `<section id="storyFilm" class="film-app${task === 'write' && state.mode === 'learn' ? ' film-writing' : ''}" tabindex="-1" data-screen="film" data-scene="${state.scene}" data-mode="${state.mode}" data-task="${task || ''}">${nav()}<header class="film-heading"><h1>${FILM_SCENES[state.scene].title}</h1><div class="film-scene-track" aria-label="${state.scene + 1}. sahne, toplam 6 sahne">${FILM_SCENES.map((_, index) => `<i class="${index <= state.scene ? 'reached' : ''}" aria-hidden="true"></i>`).join('')}</div></header><div class="film-picture">${renderFilmStage(stageProps())}<div class="film-world-actions"></div></div><div class="film-subtitle" aria-live="polite"><span class="film-speaker"></span><p></p></div><div class="film-panel"></div><dialog class="film-pause" aria-labelledby="filmPauseTitle"><h2 id="filmPauseTitle">Küçük bir mola</h2><p>Hikâyen ve yaptıkların burada seni bekliyor.</p><div class="film-actions">${button('resume', 'Devam edelim', '', 'primary')}${button('home', 'Adaya dön', '', 'quiet')}</div></dialog></section>`;
    stage = mountFilmStage(root.querySelector('.film-stage'), { reducedMotion: reduced(), paused: paused || state.phase !== 'dialogue' });
    paintCaption(); renderPanel();
  }
  function paintCaption() {
    const subtitle = root.querySelector('.film-subtitle');
    if (!subtitle) return;
    const fallback = taskText(getFilmTask(state));
    subtitle.querySelector('.film-speaker').textContent = shownLine ? speakerName[shownLine.speaker] : '';
    subtitle.querySelector('p').textContent = shownLine?.text || fallback;
    subtitle.dataset.speaker = shownLine?.speaker || 'narrator';
    const status = root.querySelector('.film-audio-note');
    if (status) status.textContent = busy ? 'Dinliyoruz…' : state.phase === 'dialogue' ? 'Hazır olduğunda sıradaki söze geçebilirsin.' : '';
    root.querySelectorAll('[data-film="caption-next"]').forEach(item => { item.disabled = busy; });
  }
  function taskText(task) {
    return { garden: 'Çiçeğimiz için bir bahçe seçelim.', branch: 'Suyun izini kim takip etsin?', guided: 'Örneğe bakıp heceleri sırayla yerleştir.',
      leaves: 'Dört yaprağı sepete topla. Suyun yolunu birlikte açalım.', cause: 'Su çarkı neden durmuştu?',
      recall: 'Çiçeğimizin adını hatırla. Harfleri sırayla yerleştir.', write: 'Aynı kelimeyi kendin yaz. Sonra bir büyüğünle kontrol et.',
      connected: 'Kısa cümleyi bir büyüğünle birlikte okuyalım.', ribbon: 'Bahçemizin kurdelesi hangi renk olsun?' }[task] || 'Hazırsan hikâyeye devam edelim.';
  }
  function taskLine(task = getFilmTask(state)) {
    return FILM_LINE_BY_ID[{ garden: 's1-garden', branch: 's2-plan', guided: 's3-guided', leaves: 's4-leaves',
      cause: 's4-cause', recall: 's5-recall', write: 's5-write', connected: 's5-read', ribbon: 's6-ribbon' }[task]];
  }
  function tokenControls(task) {
    const guided = task === 'guided', data = state.tasks[task], length = guided ? 2 : 4;
    const model = guided || data.hints > 0 ? `<div class="film-word-model" aria-label="Yardımlı örnek">${guided ? '<span>la</span><small>+</small><span>le</span><small>=</small>' : ''}<b>lale</b></div>` : '';
    return `${model}<div class="film-wood-label" aria-label="${guided ? 'İki heceli ahşap etiket' : 'Dört harfli etiket'}">${Array.from({ length }, (_, index) => `<span>${esc(data.selected[index] || '·')}</span>`).join('')}</div><div class="film-token-bank">${(guided ? ['le', 'la'] : ['e', 'l', 'a']).map(token => button('token', esc(token), `data-value="${token}" ${data.selected.length >= length ? 'disabled' : ''}`, 'film-token')).join('')}</div><div class="film-actions">${button('undo', 'Son parçayı kaldır', data.selected.length ? '' : 'disabled', 'quiet')}${button('check', 'Kontrol et', data.selected.length === length ? '' : 'disabled', 'primary')}${button('help', 'Birlikte bakalım', '', 'quiet')}</div>`;
  }
  function writingMarkup() {
    const data = state.tasks.write;
    return `${data.hints ? '<div class="film-word-model"><b>lale</b><small>Yardımlı örnek</small></div>' : ''}<div class="film-notebook"><svg id="filmPad" viewBox="0 0 900 250" role="img" aria-label="Kelimeyi parmağınla veya kaleminle yazacağın alan" tabindex="0"><path class="film-writing-guide" d="M0 50H900M0 100H900M0 150H900M0 200H900"/><g id="filmInk">${data.ink.map(path => `<path d="${esc(path)}"/>`).join('')}</g></svg></div><div class="film-actions film-writing-tools">${button('clear', 'Yeniden yaz', '', 'quiet')}${button('help', 'Örneğe bakalım', '', 'quiet')}${button('review', 'Yazdım, birlikte bakalım', hasFilmInk(data.ink) ? '' : 'disabled', 'primary')}</div><p class="film-small">El yazısı otomatik tanınmaz. Bir büyüğünle kontrol et.</p><section id="filmReview" class="film-review" ${data.reviewOpen ? '' : 'hidden'} aria-label="Yetişkinle yazı kontrolü">${data.reviewOpen ? `<h3>Birlikte kontrol edelim</h3><p>Yazılan kelime <b>lale</b> mi? Harflerin biçimini ve sırasını birlikte inceleyin.</p><div class="film-actions">${button('approve', 'Birlikte kontrol ettik', '', 'primary')}${button('retry-writing', 'Yeniden deneyelim', '', 'quiet')}${button('clear', 'Yeniden yaz', '', 'quiet')}</div>` : ''}</section>`;
  }
  function renderPanel() {
    const previousFocus = describeFocus();
    writingCleanup?.(); writingCleanup = null;
    const panel = root.querySelector('.film-panel'); if (!panel) return;
    const task = getFilmTask(state);
    const app = root.querySelector('#storyFilm'), previousTask = app.dataset.task; app.dataset.task = state.phase === 'dialogue' ? '' : task || '';
    app.dataset.mode = state.mode;
    const modeLabel = root.querySelector('.film-nav>span');
    if (modeLabel) modeLabel.textContent = `${state.mode === 'learn' ? 'Birlikte öğreniyoruz' : 'Film izleme modu'} · ${state.scene + 1} / 6`;
    const soundControl = root.querySelector('[data-film="sound"]');
    if (soundControl) { soundControl.textContent = isMuted() ? 'Sesi aç' : 'Sesi kapat'; soundControl.setAttribute('aria-pressed', String(isMuted())); }
    app.classList.toggle('film-writing', state.phase !== 'dialogue' && task === 'write' && state.mode === 'learn');
    root.querySelector('.film-world-actions').innerHTML = '';
    let html = '';
    if (state.phase === 'dialogue') {
      html = `<div class="film-actions film-dialogue-controls">${button('replay', 'Tekrar dinle', '', 'quiet')}${button('caption-next', 'Sıradaki söz', busy ? 'disabled' : '', 'primary')}${button('skip', 'Bu sahnenin konuşmasını geç', '', 'quiet')}</div><p class="film-audio-note" role="status"></p>`;
    } else if (state.phase === 'complete') {
      html = `<div class="film-ending"><h2>Bahçemiz büyüdü!</h2><p>${state.choices.garden === 'left' ? 'Soldaki' : 'Sağdaki'} bahçede, ${state.choices.ribbon === 'teal' ? 'turkuaz' : state.choices.ribbon === 'coral' ? 'mercan' : 'sarı'} kurdeleli çiçeğimiz seni bekliyor.</p><p>${state.choices.branch === 'bird' ? 'Pırpır yukarıdan uçarak suyun yolunu buldu.' : 'Minik Aslan kıyıdan yürüyerek suyun yolunu buldu.'} Yaprakları birlikte topladık.</p><p>${state.mode === 'watch' ? 'Bu yolculuk izleme modundaydı; okuma ve yazma başarısı kaydedilmedi.' : 'Hikâyede birlikte çalıştık. Öğrendiklerimizi başka bir gün yeniden hatırlayabiliriz.'}</p><div class="film-actions">${button('restart', 'Yeniden izle', '', 'primary')}${button('home', 'Adaya dön', '', 'quiet')}</div></div>`;
    } else {
      if (task === 'garden') html = `<div class="film-actions">${button('garden', 'Soldaki bahçe', 'data-value="left"', 'film-choice')}${button('garden', 'Sağdaki bahçe', 'data-value="right"', 'film-choice')}</div>`;
      else if (task === 'branch') html = `<div class="film-actions">${button('branch', 'Pırpır yukarıdan baksın', 'data-value="bird"', 'film-choice')}${button('branch', 'Minik Aslan kıyıdan yürüsün', 'data-value="lion"', 'film-choice')}</div>`;
      else if (task === 'guided') html = state.mode === 'learn' ? tokenControls(task) : `<div class="film-word-model"><span>la</span><small>+</small><span>le</span><small>=</small><b>lale</b></div>${button('watch-guided', 'Örneği birlikte yerleştirelim', '', 'primary')}`;
      else if (task === 'leaves') {
        html = '<p class="film-leaf-instruction">Kanaldaki yapraklara dokunarak sepete topla.</p>';
        root.querySelector('.film-world-actions').innerHTML = `<div class="film-leaf-buttons">${Array.from({ length: 4 }, (_, index) => state.tasks.leaves.removed.includes(index) ? '' : button('leaf', '<svg viewBox="0 0 40 44" aria-hidden="true"><path d="M20 39C0 31 1 9 29 3c14 20 11 31-9 36Z"/><path d="m8 44 20-33M20 28 13 20M24 21l8-1"/></svg>', `data-value="${index}" aria-label="${index + 1}. yaprağı sepete al"`, 'film-leaf')).join('')}</div>`;
      } else if (task === 'cause') html = `<div class="film-cause-choices">${button('cause', 'Yapraklar suyun yolunu kapattı.', 'data-value="leaves"', 'film-choice')}${button('cause', 'Bahçedeki çiçek büyüdü.', 'data-value="flower"', 'film-choice')}${button('cause', 'Pırpır uykuya daldı.', 'data-value="sleep"', 'film-choice')}</div>${button('help', 'Olanları hatırlayalım', '', 'quiet')}`;
      else if (task === 'recall') html = state.mode === 'learn' ? tokenControls(task) : `<p>Bu bölümde çiçeğin adını birlikte hatırlıyoruz.</p>${button('watch-recall', 'Örneği göster', '', 'primary')}`;
      else if (task === 'write') html = state.mode === 'learn' ? writingMarkup() : `<div class="film-word-model"><b>lale</b></div><p>Yazı çalışması öğrenme modunda, bir yetişkinin kontrolüyle yapılır.</p>${button('watch-writing', 'Birlikte devam edelim', '', 'primary')}`;
      else if (task === 'connected') html = `<p class="film-connected-line">Lale al.</p><p class="film-small">Bir büyüğünle birlikte oku. Bu düğme bağımsız okuma başarısı kaydetmez.</p><div class="film-actions">${button('read-line', 'Cümleyi dinleyelim', '', 'quiet')}${button('read-done', 'Birlikte okuduk', '', 'primary')}</div>`;
      else if (task === 'ribbon') html = `<div class="film-actions film-ribbons">${['teal', 'coral', 'gold'].map(color => button('ribbon', `<i class="film-ribbon-${color}" aria-hidden="true"></i>${{ teal: 'Turkuaz', coral: 'Mercan', gold: 'Sarı' }[color]}`, `data-value="${color}"`, 'film-choice')).join('')}</div>`;
      html = `<h2 class="film-task-title" tabindex="-1">${esc(taskText(task))}</h2>${task ? `<div class="film-task-replay">${button('replay', 'Yönergeyi dinle', '', 'quiet')}</div>` : ''}${html}<p class="film-feedback" role="status">${esc(feedback)}</p><div class="film-scene-next">${button('next', state.scene === 5 ? 'Hikâyeyi bitir' : 'Hikâyeye devam et', filmCanAdvance(state) ? '' : 'disabled', 'primary')}</div>`;
    }
    panel.innerHTML = `${notice ? `<p class="film-notice" role="status">${esc(notice)}</p>` : ''}${html}`;
    if (state.phase !== 'dialogue') { stage?.setPaused(true); stage?.setSpeaking(null); }
    stage?.update?.(stageProps());
    if (task === 'write' && state.mode === 'learn' && state.phase !== 'dialogue') mountInk();
    paintCaption();
    restoreFocus(previousFocus, previousTask !== app.dataset.task);
  }
  async function playLine(line, { cue = true } = {}) {
    if (!line || !active || paused) return false;
    cancelSpeech();
    const token = epoch;
    shownLine = line; busy = true; paintCaption();
    stage?.setPaused(false);
    const motion = cue && line.cue ? stage?.playCue(line.cue) : Promise.resolve();
    let audio = false;
    try {
      if (!isMuted()) {
        stage?.setSpeaking(line.speaker);
        audio = await speak(line.text);
      }
    } catch { audio = false; }
    if (token !== epoch || !active) return false;
    stage?.setSpeaking(null);
    await motion;
    if (token !== epoch || !active) return false;
    busy = false; stage?.setPaused(paused || state.phase !== 'dialogue'); paintCaption();
    return audio === true;
  }
  async function playCurrent() {
    const id = lines()[state.cursor];
    if (!id) { beginTask(); return; }
    const playing = playLine(FILM_LINE_BY_ID[id]), token = epoch;
    const heard = await playing;
    if (!active || paused || token !== epoch || state.phase !== 'dialogue') return;
    if (heard) { state.cursor++; save(); await playCurrent(); }
  }
  function beginTask() {
    if (!active) return;
    state.phase = 'task'; shownLine = null; busy = false; feedback = ''; save(); renderPanel();
  }
  function beginScene() {
    cancelSpeech(); feedback = ''; shownLine = null; state.phase = 'dialogue'; state.cursor = 0; save(); renderFrame(); void playCurrent();
  }
  function skipDialogue() {
    cancelSpeech(); stage?.dispose(); stage = null;
    state.cursor = lines().length; state.phase = 'task'; shownLine = null; save(); renderFrame();
  }
  function refreshTask({ line, cue } = {}) {
    shownLine = null; save(); renderPanel();
    if (line) void playLine(FILM_LINE_BY_ID[line], { cue: cue !== false });
  }
  function pauseFilm() {
    if (!active || paused || state.phase === 'cover') return;
    returnFocus = describeFocus(); paused = true; cancelSpeech(); stage?.setPaused(true); save();
    const dialog = root.querySelector('.film-pause');
    if (dialog) { try { dialog.showModal(); } catch { dialog.setAttribute('open', ''); } dialog.querySelector('[data-film="resume"]')?.focus(); }
  }
  function resumeFilm() {
    if (!active) {
      state = load(); active = true; paused = false; busy = false; attach(); ensureMode();
      shownLine = state.phase === 'dialogue' ? FILM_LINE_BY_ID[lines()[state.cursor]] || null : null;
      if (state.phase === 'cover') renderCover(); else renderFrame();
      // Settings/visibility restoration preserves the current caption. Playback
      // only resumes through the child's replay/next action.
      return;
    }
    ensureMode(); paused = false; cancelSpeech();
    const dialog = root.querySelector('.film-pause');
    if (dialog?.open) { try { dialog.close(); } catch { dialog.removeAttribute('open'); } }
    if (state.phase === 'cover') { renderCover(); return; }
    stage?.setPaused(state.phase !== 'dialogue'); renderPanel();
    restoreFocus(returnFocus); returnFocus = null;
  }
  function mountInk() {
    const svg = root.querySelector('#filmPad'), ink = root.querySelector('#filmInk'); if (!svg) return;
    let pointer = null, current = null;
    const point = event => {
      const box = svg.getBoundingClientRect();
      return { x: Math.max(0, Math.min(900, box.width ? (event.clientX - box.left) * 900 / box.width : event.clientX)),
        y: Math.max(0, Math.min(250, box.height ? (event.clientY - box.top) * 250 / box.height : event.clientY)) };
    };
    const down = event => {
      if (paused || event.button !== 0 || event.isPrimary === false || pointer !== null || state.tasks.write.reviewOpen) return;
      event.preventDefault(); pointer = event.pointerId; const p = point(event);
      state = editFilmInk(state, state.tasks.write.ink);
      current = doc.createElementNS('http://www.w3.org/2000/svg', 'path'); current.setAttribute('d', `M ${p.x.toFixed(1)} ${p.y.toFixed(1)}`); ink.append(current);
      try { svg.setPointerCapture(pointer); } catch { /* The writing guard supplies older-browser fallbacks. */ }
    };
    const move = event => {
      if (paused || pointer !== event.pointerId || !current) return;
      event.preventDefault(); const p = point(event);
      const d = `${current.getAttribute('d')} L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
      if (d.length > 6800) return;
      current.setAttribute('d', d);
      const previous = state.tasks.write.ink.slice(0, -1);
      if (current.dataset.saved === 'true') state.tasks.write.ink = [...previous, d];
      else { state.tasks.write.ink.push(d); current.dataset.saved = 'true'; }
      save(); const review = root.querySelector('[data-film="review"]'); if (review) review.disabled = !hasFilmInk(state.tasks.write.ink);
    };
    const up = event => { if (pointer !== event.pointerId) return; pointer = null; current = null; save(); };
    svg.addEventListener('pointerdown', down); svg.addEventListener('pointermove', move); svg.addEventListener('pointerup', up); svg.addEventListener('pointercancel', up);
    const guard = mountWritingGuard(svg);
    writingCleanup = () => { guard?.destroy(); svg.removeEventListener('pointerdown', down); svg.removeEventListener('pointermove', move); svg.removeEventListener('pointerup', up); svg.removeEventListener('pointercancel', up); pointer = null; };
  }
  async function handle(event) {
    const target = event.target?.closest?.('[data-film]');
    if (!target || !root.contains(target) || target.disabled || !active) return;
    const action = target.dataset.film, value = target.dataset.value;
    if (paused && !['resume', 'home'].includes(action)) return;
    if (action === 'home' || action === 'parent') { destroy(); (action === 'home' ? onHome : onParent)(); return; }
    if (action === 'pause') { pauseFilm(); return; }
    if (action === 'resume') { resumeFilm(); return; }
    if (action === 'sound') { cancelSpeech(); onToggleSound(); const control = root.querySelector('[data-film="sound"]'); if (control) { control.textContent = isMuted() ? 'Sesi aç' : 'Sesi kapat'; control.setAttribute('aria-pressed', String(isMuted())); } paintCaption(); return; }
    if (action === 'restart') { state = createFilmState(); save(); renderCover(); return; }
    if (action === 'start-learn' || action === 'start-watch') {
      if (action === 'start-learn' && !eligible().eligible) return;
      state = createFilmState(); state.mode = action === 'start-learn' ? 'learn' : 'watch'; notice = ''; beginScene(); return;
    }
    if (action === 'continue-film') { ensureMode(); renderFrame(); if (state.phase === 'dialogue') void playCurrent(); return; }
    if (action === 'skip' && state.phase === 'dialogue') { skipDialogue(); return; }
    if (action === 'replay') { cancelSpeech(); const line = shownLine || taskLine(); if (line) void playLine(line); return; }
    if (action === 'caption-next' && state.phase === 'dialogue' && !busy) { state.cursor++; save(); void playCurrent(); return; }
    if (state.phase === 'dialogue' || state.phase === 'cover' || state.phase === 'complete') return;
    ensureMode();
    const task = getFilmTask(state);
    if (action === 'next') {
      if (!filmCanAdvance(state)) return;
      if (state.scene === 5) { cancelSpeech(); state.phase = 'complete'; shownLine = null; save(); renderPanel(); }
      else { state.scene++; beginScene(); }
      return;
    }
    if (action === 'garden' && task === 'garden' && ['left', 'right'].includes(value)) { state.choices.garden = value; state.tasks.garden.chosen = true; feedback = `${value === 'left' ? 'Soldaki' : 'Sağdaki'} bahçeyi seçtik. Çiçeğimiz orada büyüyecek.`; refreshTask(); }
    else if (action === 'branch' && task === 'branch' && ['bird', 'lion'].includes(value)) { state.choices.branch = value; state.tasks.branch.chosen = true; feedback = value === 'bird' ? 'Pırpır yukarıdan bakacak.' : 'Minik Aslan kıyıdan yürüyecek.'; refreshTask(); }
    else if (action === 'ribbon' && task === 'ribbon' && ['teal', 'coral', 'gold'].includes(value)) { state.choices.ribbon = value; state.tasks.ribbon.chosen = true; feedback = 'Kurdelemiz de hazır!'; refreshTask(); }
    else if (action === 'watch-guided' && task === 'guided' && state.mode === 'watch') { state.tasks.guided = { ...state.tasks.guided, selected: ['la', 'le'], correct: true, assisted: true }; feedback = 'La ve le birleşince lale oldu.'; refreshTask(); }
    else if (action === 'watch-recall' && task === 'recall' && state.mode === 'watch') { state.tasks.recall = { ...state.tasks.recall, selected: [...'lale'], correct: true, assisted: true }; refreshTask({ line: 's5-recall-help' }); }
    else if (action === 'watch-writing' && task === 'write' && state.mode === 'watch') { state.tasks.write.watched = true; refreshTask(); }
    else if (action === 'token' && ['guided', 'recall'].includes(task) && state.mode === 'learn') {
      const data = state.tasks[task], allowed = task === 'guided' ? ['la', 'le'] : ['l', 'a', 'e'];
      if (allowed.includes(value) && data.selected.length < (task === 'guided' ? 2 : 4)) { data.selected.push(value); feedback = ''; refreshTask(); }
    } else if (action === 'undo' && ['guided', 'recall'].includes(task)) { state.tasks[task].selected.pop(); refreshTask(); }
    else if (action === 'check' && ['guided', 'recall'].includes(task) && state.mode === 'learn') {
      const data = state.tasks[task], correct = task === 'guided' ? data.selected.join('|') === 'la|le' : data.selected.join('') === 'lale';
      if (correct) { data.correct = true; attempt(task); feedback = task === 'guided' ? 'Etiket hazır. Şimdi kapağa gidelim.' : ''; refreshTask(task === 'recall' ? { line: 's5-write' } : {}); }
      else { data.mistakes++; data.selected = []; feedback = 'Sıraya bir daha bakalım. Acelemiz yok.'; refreshTask({ line: task === 'guided' ? 's3-retry' : 's5-recall-retry' }); }
    } else if (action === 'leaf' && task === 'leaves' && /^[0-3]$/.test(value)) {
      const index = Number(value); if (!state.tasks.leaves.removed.includes(index)) state.tasks.leaves.removed.push(index);
      feedback = `${state.tasks.leaves.removed.length} yaprak sepette.`;
      refreshTask(state.tasks.leaves.removed.length === 4 ? { line: 's4-clear' } : {});
    } else if (action === 'cause' && task === 'cause' && ['leaves', 'flower', 'sleep'].includes(value)) {
      state.tasks.cause.choice = value;
      if (value === 'leaves') { state.tasks.cause.correct = true; feedback = 'Evet. Yapraklar suyun yolunu kapatmıştı. Şimdi yol açık.'; refreshTask(); }
      else { state.tasks.cause.mistakes++; feedback = 'Rüzgâr çıkınca neler olduğunu hatırlayalım.'; refreshTask({ line: 's4-cause-retry' }); }
    } else if (action === 'help' && ['guided', 'recall', 'write', 'cause'].includes(task)) {
      state.tasks[task].hints++; state.tasks[task].assisted = true;
      feedback = task === 'cause' ? 'Birlikte hatırlıyoruz.' : 'Bu adımda yardım alarak çalışıyoruz.';
      refreshTask({ line: { guided: 's3-help', recall: 's5-recall-help', write: 's5-write-help', cause: 's4-cause-help' }[task] });
    } else if (action === 'clear' && task === 'write') { cancelSpeech(); state = editFilmInk(state, []); feedback = 'Yazı alanı temiz. Yeniden yazabilirsin.'; refreshTask(); }
    else if (action === 'review' && task === 'write' && hasFilmInk(state.tasks.write.ink)) { state.tasks.write.reviewOpen = true; refreshTask(); root.querySelector('[data-film="approve"]')?.focus({ preventScroll: true }); }
    else if (action === 'retry-writing' && task === 'write' && state.tasks.write.reviewOpen) { state.tasks.write.mistakes++; state = editFilmInk(state, []); feedback = 'Birlikte yeniden deneyelim.'; refreshTask(); }
    else if (action === 'approve' && task === 'write' && state.mode === 'learn' && state.tasks.write.reviewOpen && hasFilmInk(state.tasks.write.ink)) {
      state.tasks.write.writingReviewed = true; state.tasks.write.correct = true; state.tasks.write.reviewOpen = false; attempt('write'); feedback = ''; refreshTask({ line: 's5-read' });
    } else if (action === 'read-line' && task === 'connected') { void playLine(FILM_LINE_BY_ID['s5-read']); }
    else if (action === 'read-done' && task === 'connected') { state.tasks.connected.read = true; feedback = 'Etiketimiz hazır. Suyu bahçemize gönderiyoruz.'; refreshTask({ line: 's5-water' }); }
  }
  function keydown(event) {
    if (!active) return;
    if (event.key === 'Escape') { event.preventDefault(); if (paused) resumeFilm(); else pauseFilm(); }
    if (paused && event.key === 'Tab') {
      const controls = [...root.querySelectorAll('.film-pause button:not(:disabled)')], first = controls[0], last = controls.at(-1);
      if (event.shiftKey && doc.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && doc.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
  }
  function visibility() { if (active && doc.visibilityState === 'hidden') pauseFilm(); }
  function attach() { if (attached) return; attached = true; root.addEventListener('click', handle); root.addEventListener('keydown', keydown); doc.addEventListener('visibilitychange', visibility); }
  function destroy() {
    if (!active) return;
    cancelSpeech(); save(); cleanStage(); active = false; paused = false;
    const dialog = root.querySelector('.film-pause'); if (dialog?.open) { try { dialog.close(); } catch { dialog.removeAttribute('open'); } }
    root.removeEventListener('click', handle); root.removeEventListener('keydown', keydown); doc.removeEventListener('visibilitychange', visibility); attached = false;
  }
  return { start() { if (active) destroy(); state = load(); active = true; attach(); renderCover(); }, resume: resumeFilm, destroy,
    reset() { destroy(); state = createFilmState(); shownLine = null; feedback = ''; notice = ''; returnFocus = null; save(); },
    get active() { return active; } };
}
