import './sentence-practice.css';
import { mountWritingGuard } from './writing.js';
import { normalizeTeacherSentences } from './teacher-content.js';

export const SENTENCE_PRACTICE_KEY = 'harf-adasi-sentence-practice-v1';
const esc = value => String(value ?? '').replace(/[&<>"']/gu, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
const button = (action, label, extra = '', kind = '') => `<button type="button" class="sp-button ${kind}" data-do="sentence-control" data-sentence="${action}" ${extra}>${label}</button>`;
const words = text => text.split(/\s+/u);
const wordSpeech = text => text.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
const fresh = (text, source, scope) => ({ version: 1, runId: globalThis.crypto?.randomUUID?.() || `sentence-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  text, source, scope, startedAt: Date.now(), step: 'read', readCount: 0, selected: [], ink: [], modelVisible: true, reviewOpen: false, writingReviewed: false, notified: false });
function validInk(paths) {
  let size = 0;
  return (Array.isArray(paths) ? paths : []).slice(0, 100).filter(path => {
    if (typeof path !== 'string' || path.length > 7000 || !/^M \d+(?:\.\d+)? \d+(?:\.\d+)?(?: L \d+(?:\.\d+)? \d+(?:\.\d+)?)+$/u.test(path)) return false;
    size += path.length;
    return size <= 70000 && [...path.matchAll(/[ML] (\d+(?:\.\d+)?) (\d+(?:\.\d+)?)/gu)]
      .every(([, x, y]) => Number(x) <= 1000 && Number(y) <= 480);
  });
}
function hasInk(paths) {
  return validInk(paths).some(path => {
    const points = [...path.matchAll(/[ML] (\d+(?:\.\d+)?) (\d+(?:\.\d+)?)/gu)].map(([, x, y]) => [Number(x), Number(y)]);
    return points.slice(1).reduce((length, point, index) => length + Math.hypot(point[0] - points[index][0], point[1] - points[index][1]), 0) >= 30;
  });
}
function restore(raw, context) {
  if (!raw || raw.version !== 1 || !['teacher', 'standard'].includes(raw.source) || raw.scope !== context.scope || !context.sentences.includes(raw.text)) return null;
  const state = fresh(raw.text, raw.source, raw.scope), tokens = words(state.text), selected = Array.isArray(raw.selected) ? raw.selected : [];
  if (typeof raw.runId === 'string' && /^[a-zA-Z0-9-]{1,100}$/u.test(raw.runId)) state.runId = raw.runId;
  if (Number.isFinite(raw.startedAt) && raw.startedAt >= 0 && raw.startedAt <= Date.now()) state.startedAt = raw.startedAt;
  state.readCount = Math.min(10000, Math.max(0, Math.floor(Number(raw.readCount) || 0)));
  if (selected.length <= tokens.length && new Set(selected).size === selected.length
    && selected.every((id, index) => Number.isInteger(id) && id >= 0 && tokens[id] === tokens[index])) state.selected = [...selected];
  state.ink = validInk(raw.ink); state.modelVisible = raw.modelVisible !== false;
  state.writingReviewed = raw.writingReviewed === true && hasInk(state.ink);
  state.step = ['read', 'build', 'write', 'complete'].includes(raw.step) ? raw.step : 'read';
  if (!state.readCount) state.step = 'read';
  else if (['write', 'complete'].includes(state.step) && state.selected.length !== tokens.length) state.step = 'build';
  else if (state.step === 'complete' && !state.writingReviewed) state.step = 'write';
  state.reviewOpen = state.step === 'write' && raw.reviewOpen === true && hasInk(state.ink);
  state.notified = state.step === 'complete' && raw.notified === true;
  return state;
}

/** Manual reading and adult-reviewed full-sentence writing. Ink is never OCR. */
export function createSentencePractice({ root, getContext, speak = async () => false, stopSpeech = () => {},
  onHome = () => {}, onParent = () => {}, onComplete = () => {}, onExposure = () => {} } = {}) {
  if (!root?.ownerDocument || !getContext) throw new Error('Sentence host is incomplete');
  const doc = root.ownerDocument, win = doc.defaultView;
  let state = null, active = false, paused = false, epoch = 0, writingCleanup = null, memory = '', notice = '', pausedFocus = null;
  const context = source => {
    const value = getContext(source) || {}, seen = new Set();
    const sentences = (Array.isArray(value.sentences) ? value.sentences : []).slice(0, 200)
      .flatMap(text => normalizeTeacherSentences([text])).filter(text => { const key = text.toLocaleLowerCase('tr-TR'); if (seen.has(key)) return false; seen.add(key); return true; });
    return { scope: String(value.scope || ''), sentences };
  };
  function cancel() { epoch++; stopSpeech(); }
  function save() { if (!state) return; memory = JSON.stringify(state); try { win.localStorage.setItem(SENTENCE_PRACTICE_KEY, memory); } catch { /* Keep this session usable in memory. */ } }
  function load() { try { return JSON.parse(win.localStorage.getItem(SENTENCE_PRACTICE_KEY) || memory || 'null'); } catch { try { return JSON.parse(memory || 'null'); } catch { return null; } } }
  function discard() { state = null; memory = ''; try { win.localStorage.removeItem(SENTENCE_PRACTICE_KEY); } catch { /* No stored state is required to return to the list. */ } }
  function cleanup() { writingCleanup?.(); writingCleanup = null; }
  function current() {
    if (!state) return false;
    const allowed = context(state.source);
    return allowed.scope === state.scope && allowed.sentences.includes(state.text);
  }
  function unavailable() {
    cancel(); cleanup(); discard();
    root.innerHTML = `<section class="sentence-practice" data-learning-content><h1>Cümlemizi birlikte seçelim</h1><p>Liste veya öğrenilen harfler değişti. Güncel cümlelerinden birini seçebilirsin.</p>${button('home', 'Cümlelerime dön', '', 'primary')}${button('parent', 'Öğretmenimin listesini düzenle')}</section>`;
  }
  const describeFocus = () => { const element = doc.activeElement; return element && root.contains(element) ? { id: element.id, action: element.dataset?.sentence, token: element.dataset?.id } : null; };
  function render(savedFocus = describeFocus()) {
    if (!current()) { unavailable(); return; }
    cleanup(); save();
    const tokens = words(state.text), pool = context(state.source).sentences, step = state.step;
    const listen = button('listen', 'Cümlenin tamamını dinle', '', 'quiet');
    let body = '';
    if (step === 'read') body = `<p class="sp-intro">Cümleyi bir büyüğünle oku. İstediğin kadar tekrar edebilir, tek bir kelimeyi dinleyebilirsin.</p><p class="sentence-reading-line">${esc(state.text)}</p><div class="sp-word-reading">${tokens.map((text, id) => button('word', esc(text), `data-id="${id}" aria-label="${esc(wordSpeech(text))} kelimesini dinle"`)).join('')}</div><div class="sp-actions">${listen}${button('read-confirm', 'Birlikte okuduk', '', 'primary')}</div><p class="sp-note" role="status">${state.readCount ? `Birlikte ${state.readCount} kez okuduk olarak işaretlediniz.` : 'Bu düğme birlikte okuduğunuzu belirtir; otomatik okuma değerlendirmesi yapılmaz.'}</p>${button('read-next', 'Kelime kartlarına geç →', state.readCount ? '' : 'disabled', 'primary')}`;
    else if (step === 'build') body = `<p class="sp-intro">Kelimeleri cümledeki sırayla yerleştir. Aynı kelimeden iki tane varsa iki ayrı kartı da kullan.</p><p class="sp-model">${esc(state.text)}</p><div class="sp-slots" aria-label="Yerleştirilen kelimeler">${tokens.map((_, index) => `<span class="sentence-slot ${state.selected[index] === undefined ? '' : 'filled'}">${esc(tokens[state.selected[index]] || '…')}</span>`).join('')}</div><div class="sp-bank">${tokens.map((text, id) => button('tile', esc(text), `data-id="${id}" ${state.selected.includes(id) ? 'disabled' : ''}`, 'sp-tile')).reverse().join('')}</div><div class="sp-actions">${listen}${button('undo', 'Son kelimeyi geri al', state.selected.length ? '' : 'disabled')}${button('reading', 'Yeniden okuyalım')}</div>${button('build-next', 'Cümlenin tamamını yaz →', state.selected.length === tokens.length ? '' : 'disabled', 'primary')}`;
    else if (step === 'write') body = `<div id="sentenceModel" class="sp-model" ${state.modelVisible ? '' : 'hidden'}>${esc(state.text)}</div><div class="sp-actions">${listen}${button('model', state.modelVisible ? 'Örneği gizle' : 'Örneği göster')}</div><div class="sp-notebook"><svg id="sentencePad" viewBox="0 0 1000 480" tabindex="0" role="img" aria-label="Cümlenin tamamını yazacağın çizgili defter"><path class="sp-guides" d="M20 55H980M20 135H980M20 215H980M20 295H980M20 375H980M20 455H980"/><g id="sentenceInk">${state.ink.map(path => `<path d="${esc(path)}"/>`).join('')}</g></svg></div><div class="sp-actions">${button('clear', 'Yeniden yaz')}${button('review', 'Yazdım, birlikte bakalım', hasInk(state.ink) ? '' : 'disabled', 'primary')}</div><p class="sp-note">Büyük harfle başla, kelimeler arasında boşluk bırak, sondaki noktalama işaretini de yaz. Yazı otomatik tanınmaz.</p><section id="sentenceReview" class="sp-review" role="dialog" aria-modal="true" ${state.reviewOpen ? '' : 'hidden'} aria-label="Yetişkinle cümle kontrolü"><h2>Birlikte kontrol edelim</h2><p>${esc(state.text)}</p><p>Cümlenin tamamını, büyük harfi, kelimeler arasındaki boşlukları ve noktalama işaretini birlikte inceleyin.</p>${button('approve', 'Birlikte kontrol ettik', '', 'primary')}${button('clear', 'Yeniden yaz')}</section>`;
    else body = `<p class="sentence-reading-line">${esc(state.text)}</p><p>Birlikte okudunuz, kelimeleri sıraladınız ve yazıyı bir büyüğünle kontrol ettiniz.</p><p class="sp-note">Bu kayıt otomatik okuma veya el yazısı doğruluğu değerlendirmesi değildir.</p><div class="sp-actions">${button('next', 'Sıradaki cümleyi oku ve yaz →', pool.length > 1 ? '' : 'disabled', 'primary')}${button('repeat', 'Bu cümleyi yeniden çalış')}${button('home', 'Cümlelerime dön')}</div>`;
    root.innerHTML = `<section class="sentence-practice ${step === 'write' ? 'sentence-writing' : ''}" data-learning-content data-sentence-step="${step}" data-sentence-source="${state.source}"><nav class="sp-nav">${button('home', '← Cümlelerim')}<span>${{ read: '1 · Birlikte oku', build: '2 · Kelimelerle kur', write: '3 · Tamamını yaz', complete: 'Birlikte tamamladık' }[step]}</span>${button('pause', 'Mola ver')}</nav><h1 tabindex="-1">${{ read: 'Cümleyi okuyalım', build: 'Cümleyi kelimelerle kuralım', write: 'Cümlenin tamamını yazalım', complete: 'Cümleni çalıştın' }[step]}</h1><div class="sp-workspace">${body}<p class="sp-status" role="status" aria-live="polite">${esc(notice)}</p></div><dialog class="sp-pause" aria-labelledby="sentencePauseTitle"><h2 id="sentencePauseTitle">Küçük bir mola</h2><p>Cümlen ve yazın burada seni bekliyor.</p>${button('resume', 'Devam et', '', 'primary')}${button('home', 'Cümlelerime dön')}</dialog></section>`;
    if (step === 'write') mountNotebook();
    const usable = element => element && !element.disabled && !element.closest('[hidden],dialog:not([open])');
    const previous = savedFocus?.id ? [...root.querySelectorAll('[id]')].find(element => element.id === savedFocus.id && usable(element)) : null;
    const action = savedFocus?.action ? [...root.querySelectorAll('[data-sentence]')].find(element => element.dataset.sentence === savedFocus.action && element.dataset.id === savedFocus.token && usable(element)) : null;
    (state.reviewOpen ? root.querySelector('#sentenceReview [data-sentence="approve"]') : previous || action || root.querySelector('h1'))?.focus({ preventScroll: true });
  }
  function mountNotebook() {
    const svg = root.querySelector('#sentencePad'), ink = root.querySelector('#sentenceInk');
    let pointer = null, path = null;
    const point = event => { const box = svg.getBoundingClientRect(); return { x: Math.min(1000, Math.max(0, box.width ? (event.clientX - box.left) * 1000 / box.width : event.clientX)), y: Math.min(480, Math.max(0, box.height ? (event.clientY - box.top) * 480 / box.height : event.clientY)) }; };
    const down = event => {
      if (paused || state.reviewOpen || pointer !== null || event.button !== 0 || event.isPrimary === false || !current()) return;
      event.preventDefault(); pointer = event.pointerId; const p = point(event);
      state.writingReviewed = false; path = doc.createElementNS('http://www.w3.org/2000/svg', 'path'); path.setAttribute('d', `M ${p.x.toFixed(1)} ${p.y.toFixed(1)}`); ink.append(path);
      try { svg.setPointerCapture(pointer); } catch { /* The writing guard supports older touch browsers. */ }
    };
    const move = event => {
      if (pointer !== event.pointerId || !path || paused) return;
      event.preventDefault(); const p = point(event), d = `${path.getAttribute('d')} L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
      if (d.length > 6800) return;
      path.setAttribute('d', d);
      state.ink = validInk([...ink.querySelectorAll('path')].map(element => element.getAttribute('d')));
      save(); root.querySelector('[data-sentence="review"]').disabled = !hasInk(state.ink);
    };
    const up = event => { if (pointer !== event.pointerId) return; pointer = null; path = null; save(); };
    svg.addEventListener('pointerdown', down); svg.addEventListener('pointermove', move); svg.addEventListener('pointerup', up); svg.addEventListener('pointercancel', up);
    const guard = mountWritingGuard(svg);
    writingCleanup = () => { guard?.destroy(); svg.removeEventListener('pointerdown', down); svg.removeEventListener('pointermove', move); svg.removeEventListener('pointerup', up); svg.removeEventListener('pointercancel', up); };
  }
  async function play(text) {
    cancel(); const token = epoch;
    let heard = false; try { heard = await speak(text, { literal: true }); } catch { /* Keep the written sentence available. */ }
    if (!active || token !== epoch || paused) return;
    notice = heard === true ? 'Dinledin. İstersen yeniden okuyabilirsin.' : 'Ses şu anda çalınamıyor. Bir büyüğünle birlikte okuyabilirsin.';
    const status = root.querySelector('.sp-status'); if (status) status.textContent = notice;
  }
  function handle(event) {
    const target = event.target?.closest?.('[data-sentence]');
    if (!active || !target || target.disabled || !root.contains(target)) return;
    const action = target.dataset.sentence;
    if (action === 'home' || action === 'parent') { destroy(); (action === 'home' ? onHome : onParent)(); return; }
    if (!current()) { unavailable(); return; }
    if (paused && !['resume'].includes(action)) return;
    if (action === 'pause') { pausedFocus = describeFocus(); cancel(); paused = true; const dialog = root.querySelector('.sp-pause'); try { dialog.showModal(); } catch { dialog.setAttribute('open', ''); } dialog.querySelector('button')?.focus(); return; }
    if (action === 'resume') { paused = false; render(pausedFocus); pausedFocus = null; return; }
    if (action === 'listen') { void play(state.text); return; }
    if (action === 'word' && state.step === 'read') { const token = words(state.text)[Number(target.dataset.id)]; if (token) void play(wordSpeech(token)); return; }
    if (action === 'read-confirm' && state.step === 'read') state.readCount = Math.min(10000, state.readCount + 1);
    else if (action === 'read-next' && state.readCount && state.step === 'read') state.step = 'build';
    else if (action === 'tile' && state.step === 'build') {
      const id = Number(target.dataset.id), tokens = words(state.text);
      if (!Number.isInteger(id) || id < 0 || id >= tokens.length || state.selected.includes(id)) return;
      if (tokens[id] !== tokens[state.selected.length]) { notice = 'Sıradaki kelimeye bir daha bakalım.'; render(); return; }
      state.selected.push(id);
    } else if (action === 'undo' && state.step === 'build') state.selected.pop();
    else if (action === 'reading') state.step = 'read';
    else if (action === 'build-next' && state.step === 'build' && state.selected.length === words(state.text).length) state.step = 'write';
    else if (action === 'model' && state.step === 'write') state.modelVisible = !state.modelVisible;
    else if (action === 'clear' && state.step === 'write') { state.ink = []; state.reviewOpen = false; state.writingReviewed = false; }
    else if (action === 'review' && state.step === 'write' && hasInk(state.ink)) state.reviewOpen = true;
    else if (action === 'approve' && state.step === 'write' && state.reviewOpen && hasInk(state.ink)) {
      state.writingReviewed = true; state.reviewOpen = false; state.step = 'complete';
      if (!state.notified) { onComplete({ id: state.runId, text: state.text, source: state.source, scope: state.scope, startedAt: state.startedAt, writingReviewed: true, independent: false, readCount: state.readCount }); state.notified = true; }
    } else if (action === 'repeat') state = fresh(state.text, state.source, state.scope);
    else if (action === 'next' && state.step === 'complete') {
      const pool = context(state.source).sentences;
      if (pool.length < 2) return;
      const next = pool[(pool.indexOf(state.text) + 1) % pool.length]; state = fresh(next, state.source, state.scope);
      onExposure({ id: state.runId, text: next, source: state.source });
    } else return;
    cancel(); notice = ''; render();
  }
  function keydown(event) {
    if (!paused && state?.reviewOpen && event.key === 'Escape') { event.preventDefault(); state.reviewOpen = false; render({ action: 'review' }); return; }
    if (event.key === 'Escape') { event.preventDefault(); handle({ target: root.querySelector(`[data-sentence="${paused ? 'resume' : 'pause'}"]`) }); }
    if ((paused || state?.reviewOpen) && event.key === 'Tab') { const controls = [...root.querySelectorAll(`${paused ? '.sp-pause' : '#sentenceReview'} button`)]; if (event.shiftKey && doc.activeElement === controls[0]) { event.preventDefault(); controls.at(-1)?.focus(); } else if (!event.shiftKey && doc.activeElement === controls.at(-1)) { event.preventDefault(); controls[0]?.focus(); } }
  }
  function attach() { if (active) return; active = true; root.addEventListener('click', handle); root.addEventListener('keydown', keydown); }
  function destroy() { if (!active) return; cancel(); cleanup(); save(); active = false; paused = false; root.removeEventListener('click', handle); root.removeEventListener('keydown', keydown); }
  return {
    start(text, { source = 'teacher' } = {}) { destroy(); attach(); text = normalizeTeacherSentences([text])[0] || ''; const allowed = context(source); const saved = restore(load(), allowed); state = saved?.text === text && saved.source === source ? saved : allowed.sentences.includes(text) ? fresh(text, source, allowed.scope) : null; paused = false; notice = ''; if (state) onExposure({ id: state.runId, text, source }); render(); },
    resume() { cancel(); cleanup(); const raw = load(); state = raw ? restore(raw, context(raw.source)) : null; attach(); paused = false; render(); },
    destroy, reset() { destroy(); discard(); }, get active() { return active; },
  };
}
