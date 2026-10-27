// There is no account/sign-in endpoint in this application. These names are
// local display profiles only; they never select or authorize server records.
export const CHILD_PROFILE_KEY = 'harf-adasi-child-profiles-v1';
const MAX_PROFILES = 8;
const MAX_NAME = 40;
const OLD_NAME = /Alp\s+Arslan|Alparslan/giu;
const SUFFIXED_NAME = /(Alp\s+Arslan|Alparslan)([’'])(dan|den|da|de|ın|in|un|ün|la|le|ı|i|u|ü|a|e)(?=$|[^\p{L}\p{M}])/giu;
const escape = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
const record = value => value && typeof value === 'object' && !Array.isArray(value);
const idOkay = value => typeof value === 'string' && /^child-[a-z0-9-]{1,80}$/iu.test(value);

export function validateChildName(value) {
  const name = typeof value === 'string' ? value.normalize('NFC').replace(/\s+/gu, ' ').trim() : '';
  if (!name) return { okay: false, name: '', error: 'Çocuğun adını yazın; adsız oynamak için “Profilden çık” seçeneğini kullanabilirsiniz.' };
  if ([...name].length > MAX_NAME) return { okay: false, name: '', error: 'Ad en fazla 40 karakter olabilir.' };
  if (!/^[\p{L}\p{M}][\p{L}\p{M} .’'-]*$/u.test(name)) return { okay: false, name: '', error: 'Ad için harf, boşluk, kısa çizgi veya kesme işareti kullanın.' };
  return { okay: true, name, error: '' };
}

export function normalizeChildProfileState(value) {
  const profiles = [], ids = new Set();
  if (record(value) && value.version === 1) for (const source of (Array.isArray(value.profiles) ? value.profiles : []).slice(0, MAX_PROFILES)) {
    const result = validateChildName(source?.name);
    if (!idOkay(source?.id) || !result.okay || ids.has(source.id)) continue;
    ids.add(source.id); profiles.push({ id: source.id, name: result.name });
  }
  return { version: 1, profiles, activeId: ids.has(value?.activeId) ? value.activeId : '' };
}

export function createChildProfileStore({ storage, eventTarget } = {}) {
  if (storage === undefined) { try { storage = globalThis.localStorage; } catch { /* Memory-only display remains usable. */ } }
  const read = () => {
    try {
      const raw = storage?.getItem(CHILD_PROFILE_KEY);
      return normalizeChildProfileState(typeof raw === 'string' && raw.length <= 12000 ? JSON.parse(raw) : null);
    } catch { return normalizeChildProfileState(null); }
  };
  let state = read();
  const subscribers = new Set();
  const snapshot = () => normalizeChildProfileState(state);
  const notify = () => { for (const listener of subscribers) listener(snapshot()); };
  const persist = next => {
    state = normalizeChildProfileState(next);
    try { storage?.setItem(CHILD_PROFILE_KEY, JSON.stringify(state)); } catch { /* No network or alternate data destination is used. */ }
    notify(); return snapshot();
  };
  const select = id => persist({ ...state, activeId: state.profiles.some(profile => profile.id === id) ? id : '' });
  const save = (name, id = state.activeId) => {
    const result = validateChildName(name);
    if (!result.okay) return result;
    const existing = idOkay(id) ? state.profiles.find(profile => profile.id === id) : null;
    if (!existing && state.profiles.length >= MAX_PROFILES) return { okay: false, name: '', error: 'Bu cihazda en fazla 8 yerel profil saklanabilir. Mevcut bir profili düzenleyebilirsiniz.' };
    const key = existing?.id || `child-${globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`}`;
    const profiles = existing ? state.profiles.map(profile => profile.id === key ? { id: key, name: result.name } : profile) : [...state.profiles, { id: key, name: result.name }];
    persist({ version: 1, profiles, activeId: key });
    return { okay: true, name: result.name, id: key, error: '' };
  };
  const onStorage = event => { if (event.key === CHILD_PROFILE_KEY) { state = read(); notify(); } };
  eventTarget ||= typeof window !== 'undefined' ? window : null;
  eventTarget?.addEventListener?.('storage', onStorage);
  return {
    getState: snapshot,
    getName: () => state.profiles.find(profile => profile.id === state.activeId)?.name || '',
    save, select, signOut: () => select(''),
    subscribe(listener) { subscribers.add(listener); return () => subscribers.delete(listener); },
    destroy() { subscribers.clear(); eventTarget?.removeEventListener?.('storage', onStorage); },
  };
}

let defaultStore;
const sharedStore = () => defaultStore ||= createChildProfileStore();
export function getCurrentChildName() { return sharedStore().getName(); }

function nameWithSuffix(name, mark, suffix) {
  const lower = name.toLocaleLowerCase('tr-TR');
  const vowel = [...lower].reverse().find(letter => 'aeıioöuü'.includes(letter)) || 'e';
  const two = 'aıou'.includes(vowel) ? 'a' : 'e';
  const four = 'aı'.includes(vowel) ? 'ı' : 'ei'.includes(vowel) ? 'i' : 'ou'.includes(vowel) ? 'u' : 'ü';
  const endsVowel = 'aeıioöuü'.includes([...lower].at(-1));
  const voiced = 'fstkçşhp'.includes([...lower].at(-1)) ? 't' : 'd';
  const tail = suffix.toLocaleLowerCase('tr-TR');
  const ending = ['a', 'e'].includes(tail) ? `${endsVowel ? 'y' : ''}${two}`
    : ['ı', 'i', 'u', 'ü'].includes(tail) ? `${endsVowel ? 'y' : ''}${four}`
      : ['ın', 'in', 'un', 'ün'].includes(tail) ? `${endsVowel ? 'n' : ''}${four}n`
        : ['la', 'le'].includes(tail) ? `${endsVowel ? 'y' : ''}l${two}`
          : ['dan', 'den'].includes(tail) ? `${voiced}${two}n` : `${voiced}${two}`;
  return `${name}${mark}${ending}`;
}

/** Visual copy only. Do not use this function for speech/data-text or learning
 * targets: personal names must not enter a third-party speech request. */
export function personalizeText(value, name = getCurrentChildName()) {
  const raw = String(value ?? '');
  const safeName = validateChildName(name).okay ? validateChildName(name).name : '';
  if (/^Hoş geldin(?:,?\s+(?:Alp\s+Arslan|Alparslan|\{\{child\}\}))?[.!]?$/iu.test(raw.trim())) return safeName ? `Hoş geldin, ${safeName}` : 'Hoş geldin';
  const replacement = safeName || 'Minik Aslan';
  return raw.replace(SUFFIXED_NAME, (_, _old, mark, suffix) => nameWithSuffix(replacement, mark, suffix))
    .replace(OLD_NAME, replacement).replaceAll('{{child}}', replacement);
}

let panelSequence = 0;
export function renderProfileControls({ state = sharedStore().getState(), editingNew = false, status = '', error = false } = {}) {
  const current = state.profiles.find(profile => profile.id === state.activeId);
  const key = ++panelSequence;
  return `<section class="child-profile-controls" data-child-profile-controls><div><span class="child-profile-eyebrow">BU CİHAZDAKİ ÇOCUK PROFİLİ</span><h2>Kiminle oynayalım?</h2><p>Ad yalnız bu tarayıcıdaki hitaplarda kullanılır. Bu bir hesap girişi değildir; öğretmen listeleri ve ilerleme ortak mevcut kayıtta kalır.</p></div><label for="childProfileSelect-${key}">Seçili profil</label><select id="childProfileSelect-${key}" data-child-profile-select><option value="">Adsız oyna</option>${state.profiles.map(profile => `<option value="${escape(profile.id)}" ${state.activeId === profile.id ? 'selected' : ''}>${escape(profile.name)}</option>`).join('')}</select><label for="childProfileName-${key}">Çocuğun adı</label><input id="childProfileName-${key}" data-child-profile-name maxlength="40" autocomplete="off" spellcheck="false" value="${escape(editingNew ? '' : current?.name || '')}" placeholder="Ad" data-profile-edit-id="${escape(editingNew ? '' : current?.id || '')}"><div class="child-profile-actions"><button type="button" data-child-profile="save">${editingNew || !current ? 'Profili kaydet ve seç' : 'Adı kaydet'}</button><button type="button" data-child-profile="new">Yeni yerel profil</button><button type="button" data-child-profile="sign-out">Profilden çık</button></div><p class="child-profile-status" role="status" ${status ? '' : 'hidden'} data-error="${error}">${escape(status)}</p></section>`;
}

const SKIP_COPY = 'script,style,noscript,input,textarea,select,option,[data-child-profile-controls],[data-learning-content],.word,.target,.bank,.slots,.quest-bank,.quest-slots,.grid,.learn-word-edit,.teacher-library,.teacher-route,.learning-parent,.home-parent-tile[data-do="learning-parent"],.continuation-preview,.quest-summary-result,.quest-feedback,.learn-whole-word,.learn-bank,.learn-slots,.learn-review,.learn-task-header>p,#freePrompt,#questModel,#learningModel,[data-quest="choice"],[data-learning="choice"],[data-do="word"],[data-do="tile"],[data-quest="tile"],[data-learning="tile"]';
let mounted;

export function mountChildProfiles({ root = typeof document !== 'undefined' ? document.body : null, store = sharedStore() } = {}) {
  if (!root) return () => {};
  mounted?.destroy();
  const doc = root.ownerDocument;
  const texts = new Map(), attributes = new Map();
  let scheduled = false, destroyed = false;
  const containsTemplate = value => /Alp\s+Arslan|Alparslan|\{\{child\}\}/iu.test(value);
  function renderControls(element, options = {}) {
    const markup = renderProfileControls({ state: store.getState(), ...options });
    if (element.matches('[data-child-profile-controls]')) {
      const template = doc.createElement('template'); template.innerHTML = markup;
      const replacement = template.content.firstElementChild;
      element.replaceWith(replacement); return replacement;
    }
    element.innerHTML = markup;
    return element.querySelector('[data-child-profile-controls]');
  }
  function scan() {
    scheduled = false;
    if (destroyed) return;
    const name = store.getName();
    for (const slot of root.querySelectorAll('[data-child-profile-slot]')) if (!slot.querySelector('[data-child-profile-controls]')) renderControls(slot);
    const greeting = root.querySelector('header .header-greeting');
    if (greeting) {
      const copy = name ? `Hoş geldin, ${name}` : 'Hoş geldin';
      if (greeting.textContent !== copy) greeting.textContent = copy;
      if (greeting.title !== copy) greeting.title = copy;
    }
    const walker = doc.createTreeWalker(root, 4);
    let node;
    while ((node = walker.nextNode())) {
      const parent = node.parentElement;
      if (!parent || parent.closest(SKIP_COPY) || parent.closest('.header-greeting')) continue;
      const previous = texts.get(node);
      const raw = previous && node.nodeValue === previous.rendered ? previous.template : node.nodeValue;
      if (!containsTemplate(raw)) { texts.delete(node); continue; }
      const rendered = personalizeText(raw, name);
      texts.set(node, { template: raw, rendered });
      if (node.nodeValue !== rendered) node.nodeValue = rendered;
    }
    for (const [textNode] of texts) if (!textNode.isConnected) texts.delete(textNode);
    for (const element of root.querySelectorAll('[aria-label],[alt],[title]')) {
      if (element.closest(SKIP_COPY) || element.matches('.header-greeting')) continue;
      let known = attributes.get(element);
      for (const attribute of ['aria-label', 'alt', 'title']) {
        const value = element.getAttribute(attribute);
        if (value === null) continue;
        const previous = known?.get(attribute);
        const raw = previous && value === previous.rendered ? previous.template : value;
        if (!containsTemplate(raw)) { known?.delete(attribute); continue; }
        const rendered = personalizeText(raw, name);
        if (!known) { known = new Map(); attributes.set(element, known); }
        known.set(attribute, { template: raw, rendered });
        if (value !== rendered) element.setAttribute(attribute, rendered);
      }
    }
    for (const [element] of attributes) if (!element.isConnected) attributes.delete(element);
  }
  function schedule() { if (!scheduled && !destroyed) { scheduled = true; queueMicrotask(scan); } }
  function controlsContainer(element) { return element.closest('[data-child-profile-controls]'); }
  const onClick = event => {
    const button = event.target.closest?.('[data-child-profile]');
    if (!button || !root.contains(button)) return;
    const container = controlsContainer(button);
    if (!container) return;
    const action = button.dataset.childProfile;
    if (action === 'new') { renderControls(container, { editingNew: true }).querySelector('input')?.focus(); return; }
    if (action === 'sign-out') { store.signOut(); return; }
    if (action === 'save') {
      const input = container.querySelector('[data-child-profile-name]');
      const result = store.save(input?.value || '', input?.dataset.profileEditId || '');
      if (!result.okay) {
        const message = container.querySelector('.child-profile-status');
        message.hidden = false; message.textContent = result.error; message.dataset.error = 'true';
        input?.focus();
      }
    }
  };
  const onChange = event => { if (event.target.matches?.('[data-child-profile-select]') && root.contains(event.target)) store.select(event.target.value); };
  const unsubscribe = store.subscribe(() => {
    for (const panel of root.querySelectorAll('[data-child-profile-controls]')) renderControls(panel);
    scan();
  });
  const observer = new MutationObserver(schedule);
  observer.observe(root, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['aria-label', 'alt', 'title'] });
  root.addEventListener('click', onClick); root.addEventListener('change', onChange);
  scan();
  const destroy = () => { destroyed = true; observer.disconnect(); unsubscribe(); root.removeEventListener('click', onClick); root.removeEventListener('change', onChange); texts.clear(); attributes.clear(); if (mounted?.root === root) mounted = null; };
  mounted = { root, destroy };
  return destroy;
}
