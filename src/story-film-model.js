export const FILM_STORE_KEY = 'harf-adasi-story-film-v1';
export const FILM_VERSION = 1;
export const FILM_WORD = 'lale';
const bounded = (value, min, max, fallback = min) => Number.isFinite(Number(value)) ? Math.max(min, Math.min(max, Math.floor(Number(value)))) : fallback;
const flag = value => value === true;
const list = value => Array.isArray(value) ? value : [];
const normalized = value => String(value ?? '').normalize('NFC').toLocaleLowerCase('tr-TR').trim();
const stats = value => ({ mistakes: bounded(value?.mistakes, 0, 100), hints: bounded(value?.hints, 0, 100), assisted: flag(value?.assisted) });
const freshTask = () => ({ correct: false, mistakes: 0, hints: 0, assisted: false });

export function getFilmEligibility(learningState, letters = []) {
  const taught = new Set(list(letters).map(normalized));
  const missingLetters = ['l', 'a', 'e'].filter(letter => !taught.has(letter));
  const teacherList = list(learningState?.lists).find(item => item.id === learningState?.activeListId);
  const hasWord = list(teacherList?.words).some(word => normalized(typeof word === 'string' ? word : word?.text) === FILM_WORD);
  return { eligible: !missingLetters.length && hasWord, missingLetters, hasWord,
    fingerprint: `${teacherList?.id || ''}:${missingLetters.join('')}:${hasWord}` };
}

export function createFilmState(now = Date.now()) {
  return { version: FILM_VERSION, runId: `film-${Math.max(0, Number(now) || 0).toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    mode: 'watch', scene: 0, cursor: 0, phase: 'cover', choices: { garden: 'left', branch: 'bird', ribbon: 'teal' },
    tasks: { garden: { chosen: false }, branch: { chosen: false }, guided: { ...freshTask(), selected: [] },
      leaves: { removed: [] }, cause: { ...freshTask(), choice: '' }, recall: { ...freshTask(), selected: [] },
      write: { ...freshTask(), ink: [], reviewOpen: false, writingReviewed: false, watched: false },
      connected: { read: false }, ribbon: { chosen: false } }, emitted: [], updatedAt: Number(now) || 0 };
}

export function sanitizeFilmInk(value) {
  let total = 0;
  return list(value).slice(0, 100).filter(path => {
    if (typeof path !== 'string' || path.length > 7000 || !/^M\s*[\d. -]+(?:\s*L\s*[\d. -]+)+$/.test(path)) return false;
    total += path.length;
    return total <= 70000;
  });
}

export function hasFilmInk(paths) {
  return sanitizeFilmInk(paths).some(path => {
    const numbers = path.match(/-?\d+(?:\.\d+)?/g)?.map(Number) || [];
    let length = 0;
    for (let index = 2; index + 1 < numbers.length; index += 2) length += Math.hypot(numbers[index] - numbers[index - 2], numbers[index + 1] - numbers[index - 1]);
    return length >= 15;
  });
}

export function editFilmInk(state, ink) {
  const write = state.tasks.write;
  return { ...state, tasks: { ...state.tasks, write: { ...write, ink: sanitizeFilmInk(ink),
    correct: false, reviewOpen: false, writingReviewed: false,
    assisted: write.assisted || write.reviewOpen || write.writingReviewed || write.correct } } };
}

export function normalizeFilmState(value, now = Date.now()) {
  const state = createFilmState(now);
  if (!value || value.version !== FILM_VERSION || typeof value !== 'object') return state;
  state.runId = typeof value.runId === 'string' && /^film-[a-z0-9-]{1,80}$/.test(value.runId) ? value.runId : state.runId;
  state.mode = value.mode === 'learn' ? 'learn' : 'watch';
  state.scene = bounded(value.scene, 0, 5); state.cursor = bounded(value.cursor, 0, 10);
  state.phase = ['cover', 'dialogue', 'task', 'ready', 'complete'].includes(value.phase) ? value.phase : 'cover';
  state.choices.garden = value.choices?.garden === 'right' ? 'right' : 'left';
  state.choices.branch = value.choices?.branch === 'lion' ? 'lion' : 'bird';
  state.choices.ribbon = ['teal', 'coral', 'gold'].includes(value.choices?.ribbon) ? value.choices.ribbon : 'teal';
  const source = value.tasks || {}, task = state.tasks;
  task.garden.chosen = flag(source.garden?.chosen); task.branch.chosen = flag(source.branch?.chosen); task.ribbon.chosen = flag(source.ribbon?.chosen);
  task.guided = { ...stats(source.guided), selected: list(source.guided?.selected).filter(token => ['la', 'le'].includes(token)).slice(0, 2) };
  task.guided.correct = flag(source.guided?.correct) && task.guided.selected.join('|') === 'la|le';
  task.leaves.removed = [...new Set(list(source.leaves?.removed).filter(number => Number.isInteger(number) && number >= 0 && number < 4))];
  task.cause = { ...stats(source.cause), choice: ['leaves', 'sleep', 'flower'].includes(source.cause?.choice) ? source.cause.choice : '' };
  task.cause.correct = flag(source.cause?.correct) && task.cause.choice === 'leaves' && task.leaves.removed.length === 4;
  task.recall = { ...stats(source.recall), selected: list(source.recall?.selected).filter(token => ['l', 'a', 'e'].includes(token)).slice(0, 4) };
  task.recall.correct = flag(source.recall?.correct) && task.recall.selected.join('') === FILM_WORD;
  const ink = sanitizeFilmInk(source.write?.ink);
  task.write = { ...stats(source.write), ink, reviewOpen: flag(source.write?.reviewOpen) && hasFilmInk(ink),
    writingReviewed: flag(source.write?.writingReviewed) && hasFilmInk(ink), watched: flag(source.write?.watched) };
  task.write.correct = flag(source.write?.correct) && task.write.writingReviewed;
  task.connected.read = flag(source.connected?.read);
  state.emitted = list(value.emitted).filter(id => typeof id === 'string' && id.startsWith(`${state.runId}:`) && id.length < 160).slice(-20);
  state.updatedAt = bounded(value.updatedAt, 0, Math.max(now, 0), now);
  // Never restore a future scene when its preceding required child action is absent.
  for (let scene = 0; scene < state.scene; scene++) {
    if (!filmCanAdvance({ ...state, scene })) { state.scene = scene; state.cursor = 0; state.phase = 'task'; break; }
  }
  if (state.phase === 'complete' && !(state.scene === 5 && filmCanAdvance(state))) state.phase = 'task';
  return state;
}

export function getFilmTask(state) {
  if (state.scene === 0) return state.tasks.garden.chosen ? null : 'garden';
  if (state.scene === 1) return state.tasks.branch.chosen ? null : 'branch';
  if (state.scene === 2) return state.tasks.guided.correct ? null : 'guided';
  if (state.scene === 3) return state.tasks.leaves.removed.length < 4 ? 'leaves' : !state.tasks.cause.correct ? 'cause' : null;
  if (state.scene === 4) return !state.tasks.recall.correct ? 'recall'
    : !(state.mode === 'watch' ? state.tasks.write.watched : state.tasks.write.correct) ? 'write'
      : !state.tasks.connected.read ? 'connected' : null;
  if (state.scene === 5) return state.tasks.ribbon.chosen ? null : 'ribbon';
  return null;
}

export function filmCanAdvance(state) { return getFilmTask(state) === null; }

export function makeFilmAttempt(state, checkpoint, now = Date.now()) {
  if (state.mode !== 'learn' || !['guided', 'recall', 'write'].includes(checkpoint)) return null;
  const task = state.tasks[checkpoint];
  if (!task?.correct || (checkpoint === 'write' && !task.writingReviewed)) return null;
  const skill = { guided: 'syllables', recall: 'recall', write: 'write' }[checkpoint];
  return { id: `${state.runId}:${checkpoint}`, word: FILM_WORD, skill, correct: true,
    mistakes: task.mistakes, hints: task.hints, independent: checkpoint !== 'guided' && !task.assisted && !task.hints && !task.mistakes,
    writingReviewed: checkpoint === 'write', at: Math.max(0, Number(now) || 0) };
}
