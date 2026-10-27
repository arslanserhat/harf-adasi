// Target exposure is selection metadata, not a learning or completion award.
export const SELECTION_KEY = 'harf-adasi-content-v1';
export const CONTENT_DOMAINS = Object.freeze(['letters', 'syllables', 'words', 'sentences', 'numbers', 'activities']);
const DOMAINS = new Set(CONTENT_DOMAINS);
const LETTERS = 'abcçdefgğhıijklmnoöprsştuüvyz';
const WORD = /^[abcçdefgğhıijklmnoöprsştuüvyz]{1,24}$/u;
const MAX_ITEMS = 4096;
const MAX_VISITS = 512;
const MAX_JSON = 2 * 1024 * 1024;
const MAX_SEQUENCE = Number.MAX_SAFE_INTEGER - 1;
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const integer = (value, maximum = MAX_SEQUENCE) => Math.max(0, Math.min(maximum, Math.floor(Number(value) || 0)));
const clean = value => typeof value === 'string' ? value.normalize('NFC').trim() : '';
const safeId = value => {
  const id = clean(value);
  return id.length > 0 && id.length <= 200 && !/[\u0000-\u001f\u007f]/u.test(id) ? id : '';
};

function canonical(domain, value) {
  if (!DOMAINS.has(domain)) return '';
  if (domain === 'numbers') {
    const text = typeof value === 'number' ? String(value) : clean(value);
    if (!/^\d{1,3}$/u.test(text)) return '';
    const number = Number(text);
    return number <= 100 ? String(number) : '';
  }
  const text = clean(value);
  if (domain === 'activities') return /^[a-z0-9][a-z0-9_.:-]{0,159}$/iu.test(text) ? text : '';
  if (domain === 'sentences') {
    const sentence = text.replace(/\s+/gu, ' ');
    const tokens = sentence.split(' ');
    if (sentence.length > 160 || tokens.length < 2 || tokens.length > 8) return '';
    const lower = sentence.toLocaleLowerCase('tr-TR');
    return /^[abcçdefgğhıijklmnoöprsştuüvyz0-9\s'’".,!?;:()“”\-]+$/u.test(lower)
      && tokens.every(token => /[\p{L}\p{N}]/u.test(token)) ? sentence : '';
  }
  const lower = text.toLocaleLowerCase('tr-TR');
  return domain === 'letters' ? lower.length === 1 && LETTERS.includes(lower) ? lower : ''
    : WORD.test(lower) ? lower : '';
}

function poolFor(domain, values) {
  if (!Array.isArray(values)) return [];
  const seen = new Set(), pool = [];
  for (const value of values.slice(0, MAX_ITEMS)) {
    const item = canonical(domain, value);
    if (!item || seen.has(item)) continue;
    seen.add(item); pool.push(item);
  }
  return pool;
}

function emptyState() {
  return { version: 1, sequence: 0, domains: Object.fromEntries(CONTENT_DOMAINS
    .map(domain => [domain, { round: 1, items: Object.create(null) }])), visits: [] };
}

function boundItems(state) {
  const all = CONTENT_DOMAINS.flatMap(domain => Object.entries(state.domains[domain].items)
    .map(([key, value]) => ({ domain, key, value })));
  all.sort((a, b) => b.value.lastSeen - a.value.lastSeen || b.value.lastAt - a.value.lastAt);
  for (const item of all.slice(MAX_ITEMS)) delete state.domains[item.domain].items[item.key];
}

/** Every return is detached from the supplied object, including recovery. */
export function normalizeSelectionState(value) {
  const state = emptyState();
  if (!record(value) || value.version !== 1) return state;
  state.sequence = integer(value.sequence);
  for (const domain of CONTENT_DOMAINS) {
    const raw = record(value.domains) && record(value.domains[domain]) ? value.domains[domain] : {};
    const bucket = state.domains[domain];
    bucket.round = Math.max(1, integer(raw.round, 1000000000));
    if (!record(raw.items)) continue;
    for (const [key, observation] of Object.entries(raw.items).slice(-MAX_ITEMS)) {
      const item = canonical(domain, key);
      if (!item || !record(observation)) continue;
      const next = { round: Math.min(bucket.round, integer(observation.round, 1000000000)),
        lastSeen: integer(observation.lastSeen), lastAt: integer(observation.lastAt, 32503680000000) };
      if (next.round < 1 || next.lastSeen < 1) continue;
      const previous = bucket.items[item];
      if (!previous || next.lastSeen > previous.lastSeen) bucket.items[item] = next;
      state.sequence = Math.max(state.sequence, next.lastSeen);
    }
  }
  const visits = Array.isArray(value.visits) ? value.visits.slice(-MAX_VISITS) : [];
  state.visits = [...new Set(visits.filter(visit => typeof visit === 'string'
    && visit.length <= 220 && !/[\u0000-\u001f\u007f]/u.test(visit)
    && CONTENT_DOMAINS.some(domain => visit.startsWith(domain + ':'))))];
  boundItems(state);
  return state;
}

/** Prefer unserved targets in this round, then older actual exposures.
 * Finite, already-covered subpools deliberately fall back to a varied cycle. */
export function orderContentPool(domain, pool, value) {
  if (!DOMAINS.has(domain)) return [];
  const state = normalizeSelectionState(value), bucket = state.domains[domain];
  return poolFor(domain, pool).map((item, index) => ({ item, index, observation: bucket.items[item] }))
    .sort((a, b) => Number(a.observation?.round === bucket.round) - Number(b.observation?.round === bucket.round)
      || (a.observation?.lastSeen || 0) - (b.observation?.lastSeen || 0) || a.index - b.index)
    .map(entry => entry.item);
}

/** Re-rendering a target is idempotent. A new served target may change order,
 * but never creates a correct answer, completion, score or mastery evidence. */
export function recordContentExposure(value, event) {
  const state = normalizeSelectionState(value);
  if (!record(event) || !DOMAINS.has(event.domain)) return state;
  const id = safeId(event.id);
  if (!id) return state;
  const visit = event.domain + ':' + id;
  if (state.visits.includes(visit)) return state;
  const pool = poolFor(event.domain, event.pool), allowed = new Set(pool);
  const items = poolFor(event.domain, event.items).filter(item => allowed.has(item));
  if (!pool.length || !items.length) return state;
  const bucket = state.domains[event.domain], at = integer(event.at, 32503680000000);
  // This is only a defensive rollover for an imported extreme counter.
  if (state.sequence >= MAX_SEQUENCE - items.length) {
    const ordered = CONTENT_DOMAINS.flatMap(domain => Object.values(state.domains[domain].items))
      .sort((a, b) => a.lastSeen - b.lastSeen);
    ordered.forEach((item, index) => { item.lastSeen = index + 1; });
    state.sequence = ordered.length;
  }
  for (const item of items) bucket.items[item] = { round: bucket.round, lastSeen: ++state.sequence, lastAt: at };
  if (pool.every(item => bucket.items[item]?.round === bucket.round)) {
    if (bucket.round >= 1000000000) {
      bucket.round = 2;
      for (const observation of Object.values(bucket.items)) observation.round = 1;
    } else bucket.round++;
  }
  state.visits = [...state.visits, visit].slice(-MAX_VISITS);
  boundItems(state);
  return state;
}

/** Storage is optional; rejected browser storage keeps an in-memory game. */
export function createContentStore(options = {}) {
  if (!record(options)) options = {};
  let storage;
  if (Object.hasOwn(options, 'storage')) storage = options.storage;
  else try { storage = globalThis.localStorage; } catch { /* Memory fallback. */ }
  let raw = null, restored = false;
  try {
    const saved = storage?.getItem(SELECTION_KEY);
    if (typeof saved === 'string' && saved.length <= MAX_JSON) {
      raw = JSON.parse(saved);
      restored = record(raw) && raw.version === 1 && record(raw.domains)
        && Number.isSafeInteger(raw.sequence) && raw.sequence >= 0;
    }
  } catch { /* Corrupt or blocked storage cannot stop learning. */ }
  let state = normalizeSelectionState(restored ? raw : null);
  if (!restored && record(options.seed)) {
    for (const domain of CONTENT_DOMAINS) {
      const items = poolFor(domain, options.seed[domain]);
      if (items.length) state = recordContentExposure(state, { id: 'migration-' + domain, domain, items, pool: items, at: 0 });
    }
  }
  function persist() {
    try {
      const serialized = JSON.stringify(state);
      if (serialized.length <= MAX_JSON) storage?.setItem(SELECTION_KEY, serialized);
    } catch { /* Keep the current memory ledger when storage is unavailable. */ }
  }
  persist();
  return {
    getState: () => normalizeSelectionState(state),
    expose(event) {
      state = recordContentExposure(state, record(event) ? { ...event, at: event.at ?? Date.now() } : event);
      persist(); return normalizeSelectionState(state);
    },
    reset() { state = emptyState(); persist(); return normalizeSelectionState(state); },
  };
}
