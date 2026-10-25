const csrf = document.querySelector('meta[name="csrf-token"]')?.content;
const enabled = document.querySelector('meta[name="harf-backend"]')?.content === 'laravel';

export async function resetServerProgress() {
  if (!enabled || !csrf) return;
  try {
    return (await fetch('/api/progress', { method: 'DELETE', credentials: 'same-origin', headers: { Accept: 'application/json', 'X-CSRF-TOKEN': csrf } })).ok;
  } catch { return false; }
}

export async function syncCompletion(game) {
  if (!enabled || !csrf) return;
  const modes = { letter: 'letters', digit: 'numbers', count: 'numbers', number: 'numbers', syllable: 'syllables', word: 'words', sentence: 'sentences', reading: 'reading' };
  game.completionId ||= crypto.randomUUID();
  try {
    const response = await fetch('/api/sessions', {
      method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-CSRF-TOKEN': csrf },
      body: JSON.stringify({ completion_id: game.completionId, mode: modes[game.type], item_key: `${game.type}:${game.key}`, duration_seconds: Math.min(3600, Math.max(0, Math.round((performance.now() - game.startedAt) / 1000))), writing_reviewed: game.writingReviewed || null }),
    });
    if (!response.ok) return false;
    return (await response.json()).saved === true;
  } catch { return false; }
}

export async function loadServerProgress() {
  if (!enabled) return null;
  try {
    const response = await fetch('/api/progress', { credentials: 'same-origin', headers: { Accept: 'application/json' } });
    return response.ok ? await response.json() : null;
  } catch { return null; }
}
