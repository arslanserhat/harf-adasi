import { createLearningState, normalizeLearningState, mergeLearningStates } from './learning-model.js';

export const LEARNING_STORAGE_KEY = 'harf-adasi-learning-v1';

/** Local-first storage. Revisions prevent a late browser save undoing a reset. */
export function createLearningStore({
  storage,
  fetcher = (...args) => fetch(...args),
  enabled = typeof document !== 'undefined' && document.querySelector('meta[name="harf-backend"]')?.content === 'laravel',
  csrf = typeof document !== 'undefined' ? document.querySelector('meta[name="csrf-token"]')?.content : '',
  onRemoteChange = () => {},
  debounceMs = 450,
} = {}) {
  if (!storage) {
    try { storage = globalThis.localStorage; } catch { /* The in-memory lesson still works. */ }
  }
  const metaKey = `${LEARNING_STORAGE_KEY}:revision`;
  let saved = null;
  let revision = 0;
  try {
    saved = JSON.parse(storage?.getItem(LEARNING_STORAGE_KEY) || 'null');
    revision = Math.max(0, Number(storage?.getItem(metaKey)) || 0);
  } catch { /* A corrupt old record is safely replaced. */ }
  let state = normalizeLearningState(saved);
  let status = enabled ? 'pending' : 'local';
  let sequence = 0;
  let epoch = 0;
  let dirty = false;
  let initialized = false;
  let loading = null;
  let inFlight = null;
  let timer;
  let disposed = false;

  function persist() {
    try {
      storage?.setItem(LEARNING_STORAGE_KEY, JSON.stringify(state));
      storage?.setItem(metaKey, String(revision));
    } catch { status = 'memory'; }
  }
  function announce(reason) {
    try { onRemoteChange(state, reason); } catch { /* Persistence does not own navigation. */ }
  }
  function schedule() {
    clearTimeout(timer);
    if (!enabled || disposed) return;
    timer = setTimeout(() => { void flush(); }, debounceMs);
  }
  async function request(method, body) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetcher('/api/learning', {
        method, credentials: 'same-origin', signal: controller.signal,
        headers: {
          Accept: 'application/json',
          ...(body ? { 'Content-Type': 'application/json' } : {}),
          ...(method !== 'GET' && csrf ? { 'X-CSRF-TOKEN': csrf } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      const data = await response.json();
      return { ok: response.ok, status: response.status, data };
    } finally { clearTimeout(timeout); }
  }
  function getState() { return state; }
  function setState(next) {
    state = normalizeLearningState({ ...next, updatedAt: Date.now() });
    sequence++;
    dirty = true;
    status = enabled ? 'pending' : 'local';
    persist();
    schedule();
    return state;
  }
  async function initialize() {
    if (loading) return loading;
    if (!enabled) { initialized = true; return state; }
    const startedEpoch = epoch;
    const startedSequence = sequence;
    loading = (async () => {
      try {
        const response = await request('GET');
        if (epoch !== startedEpoch || disposed) return state;
        if (!response.ok || !Number.isInteger(response.data?.revision)) throw new Error('Learning store unavailable');
        const remote = response.data;
        const previousRevision = revision;
        const resetRevision = Number.isInteger(remote.reset_revision) ? remote.reset_revision : 0;
        let resetByServer = false;
        revision = remote.revision;
        if (resetRevision > previousRevision) {
          // A reset checkpoint survives subsequent saves of retained lists.
          // Even a non-null snapshot is authoritative after a newer reset;
          // merging this browser's old events would resurrect deleted work.
          state = remote.state ? normalizeLearningState(remote.state) : createLearningState();
          dirty = false;
          resetByServer = true;
        } else if (remote.state) {
          // An untouched default must never hide an older, real server record.
          state = saved || sequence !== startedSequence
            ? mergeLearningStates(state, remote.state)
            : normalizeLearningState(remote.state);
          dirty = Boolean(saved || sequence !== startedSequence);
        } else if (revision > previousRevision) {
          // The server reset has newer authority than this browser's old draft.
          // A local edit made while GET was pending cannot revive observations
          // that another window has already deleted.
          state = createLearningState();
          dirty = false;
          resetByServer = true;
        } else if (saved) {
          // A first server visit or a retained teacher list after reset still
          // needs an upload; a null server record is not a successful save.
          dirty = true;
        }
        initialized = true;
        status = dirty ? 'pending' : 'saved';
        persist();
        announce(resetByServer ? 'reset' : 'loaded');
        if (dirty) schedule();
      } catch {
        if (epoch === startedEpoch && !disposed) {
          initialized = true;
          status = 'error';
          announce('unavailable');
        }
      }
      return state;
    })();
    return loading;
  }
  async function flush() {
    clearTimeout(timer);
    if (!enabled || disposed || !dirty) return true;
    if (!initialized) await initialize();
    if (inFlight) return inFlight;
    const startedEpoch = epoch;
    inFlight = (async () => {
      let conflicts = 0;
      while (dirty && epoch === startedEpoch && !disposed) {
        const sentSequence = sequence;
        const payload = state;
        try {
          const response = await request('PUT', { state: payload, base_revision: revision });
          if (epoch !== startedEpoch || disposed) return false;
          if (response.status === 409 && Number.isInteger(response.data?.revision)) {
            const previousRevision = revision;
            const resetRevision = Number.isInteger(response.data.reset_revision) ? response.data.reset_revision : 0;
            revision = response.data.revision;
            if (resetRevision > previousRevision || response.data.state === null) {
              state = response.data.state ? normalizeLearningState(response.data.state) : createLearningState();
              sequence++;
              dirty = false;
              status = 'saved';
              persist();
              announce('reset');
              return true;
            }
            if (++conflicts > 2 || !response.data.state) throw new Error('Learning conflict');
            state = mergeLearningStates(state, response.data.state);
            persist();
            announce('merged');
            continue;
          }
          if (!response.ok || response.data?.saved !== true || !Number.isInteger(response.data?.revision)) {
            throw new Error('Learning save unavailable');
          }
          revision = response.data.revision;
          dirty = sequence !== sentSequence;
          status = dirty ? 'pending' : 'saved';
          persist();
        } catch {
          if (epoch === startedEpoch && !disposed) status = 'error';
          return false;
        }
      }
      return true;
    })().finally(() => {
      inFlight = null;
      if (dirty && epoch !== startedEpoch && !disposed && status !== 'error') schedule();
    });
    return inFlight;
  }
  function acceptReset(nextRevision, { keepLists = true } = {}) {
    epoch++;
    sequence++;
    clearTimeout(timer);
    const previous = state;
    state = createLearningState();
    if (keepLists) {
      state.lists = previous.lists;
      state.activeListId = previous.activeListId;
    }
    if (Number.isInteger(nextRevision)) revision = nextRevision;
    // Keep the user's teacher lists while clearing all learning observations.
    dirty = enabled && keepLists;
    initialized = true;
    status = enabled ? 'pending' : 'local';
    persist();
    schedule();
    return state;
  }
  async function reset(options) {
    if (!enabled) { acceptReset(undefined, options); return true; }
    try {
      const response = await request('DELETE');
      if (!response.ok || response.data?.reset !== true) return false;
      acceptReset(response.data.revision, options);
      return true;
    } catch { status = 'error'; return false; }
  }
  function getSyncStatus() {
    return {
      mode: status,
      label: {
        local: 'Listeler ve çalışmalar bu tarayıcıda kayıtlı.',
        saved: 'Listeler ve çalışmalar sunucuda kaydedildi.',
        pending: 'Son çalışmalar bu cihazda kayıtlı; sunucu kaydı bekleniyor.',
        error: 'Sunucu kaydı şu an yapılamıyor. Son çalışmalar bu cihazda korunuyor.',
        memory: 'Tarayıcı kayda izin vermiyor. Bu sayfayı kapatınca son çalışmalar kaybolabilir.',
      }[status],
    };
  }
  function destroy() { disposed = true; clearTimeout(timer); }
  return { getState, setState, initialize, flush, reset, acceptReset, getSyncStatus, destroy };
}
