import confetti from 'canvas-confetti';
import { audio } from './audio.js';
import './celebration.css';

let dialog;
let activeCelebration = null;

function ensureDialog() {
  if (dialog) return dialog;

  dialog = document.createElement('dialog');
  dialog.id = 'celebrationDialog';
  dialog.setAttribute('aria-labelledby', 'celebrationTitle');
  dialog.setAttribute('aria-describedby', 'celebrationMessage celebrationHint');
  dialog.innerHTML = `
    <canvas class="celebration-confetti" aria-hidden="true"></canvas>
    <div class="celebration-content">
      <button id="celebrationReturn" type="button" aria-label="Çalışmama dön">Çalışmama dön</button>
      <div class="celebration-badge" aria-hidden="true">
        <svg viewBox="0 0 120 120" focusable="false">
          <path class="celebration-trophy-handle" d="M37 32H21v11c0 15 10 23 25 23M83 32h16v11c0 15-10 23-25 23"/>
          <path class="celebration-trophy-cup" d="M33 24h54v22c0 19-11 32-27 32S33 65 33 46Z"/>
          <path class="celebration-trophy-base" d="M54 77h12v17h15v10H39V94h15Z"/>
          <path class="celebration-trophy-star" d="m60 34 5.7 11.6 12.8 1.9-9.2 9 2.2 12.7L60 63.2l-11.5 6 2.2-12.7-9.2-9 12.8-1.9Z"/>
          <path class="celebration-spark" d="m19 12 2 6 6 2-6 2-2 6-2-6-6-2 6-2Zm82 62 2 5 5 2-5 2-2 5-2-5-5-2 5-2Z"/>
        </svg>
      </div>
      <p class="celebration-eyebrow">Adım adım öğreniyorum</p>
      <h2 id="celebrationTitle">Tebrikler!</h2>
      <p id="celebrationMessage"></p>
      <div id="celebrationItem" class="celebration-item"></div>
      <p id="celebrationHint">Hazırsan devam edebilirsin.</p>
      <button id="celebrationContinue" type="button" autofocus>Devam et <span aria-hidden="true">→</span></button>
    </div>`;
  document.body.appendChild(dialog);

  dialog.querySelector('#celebrationReturn').addEventListener('click', hideCelebration);
  dialog.querySelector('#celebrationContinue').addEventListener('click', () => {
    const celebration = activeCelebration;
    if (!dialog.open || !celebration || celebration.continued) return;
    celebration.continued = true;
    const onContinue = celebration.onContinue;
    // Cleanup is synchronous and precedes the next step's speech and rendering.
    hideCelebration();
    onContinue?.();
  });
  dialog.addEventListener('cancel', event => {
    event.preventDefault();
    hideCelebration();
  });
  dialog.addEventListener('close', () => {
    // close() queues an event. A newer dialog may already be open by then.
    if (!dialog.open && activeCelebration) hideCelebration();
  });
  return dialog;
}

function stillOpen(celebration) {
  return activeCelebration === celebration && dialog?.open;
}

function schedule(celebration, callback, delay) {
  const timer = setTimeout(() => {
    celebration.timers.delete(timer);
    if (stillOpen(celebration)) callback();
  }, delay);
  celebration.timers.add(timer);
}

function celebrateWithConfetti(celebration) {
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  const canvas = dialog.querySelector('.celebration-confetti');
  // A body-level canvas is hidden behind a native dialog's top layer.
  celebration.confetti = confetti.create(canvas, { resize: true, useWorker: false });
  const burst = (particleCount, origin, angle) => celebration.confetti({
    particleCount,
    angle,
    spread: 68,
    startVelocity: 24,
    gravity: 1.05,
    decay: 0.92,
    ticks: 68,
    scalar: 0.85,
    origin,
    colors: ['#8b77d8', '#f4c267', '#65bfaa', '#ef9ea5'],
    disableForReducedMotion: true,
  });
  burst(30, { x: 0.23, y: 0.39 }, 60);
  schedule(celebration, () => burst(24, { x: 0.77, y: 0.39 }, 120), 220);
  schedule(celebration, () => burst(18, { x: 0.5, y: 0.36 }, 90), 440);
  schedule(celebration, () => celebration.confetti?.reset(), 1400);
}

async function speakCongratulations(celebration) {
  const status = audio.voiceStatus();
  if (status.muted || status.volume <= 0 || !stillOpen(celebration)) return;
  try {
    // These exact phrases have local Turkish recordings in the audio manifest.
    const finished = await audio.speak('Tebrikler!');
    const currentStatus = audio.voiceStatus();
    if (!finished || !stillOpen(celebration) || currentStatus.muted || currentStatus.volume <= 0) return;
    await audio.speak('Hazırsan devam edebilirsin.');
  } catch {
    // The modal and its written instructions also work without audio output.
  }
}

export function showCelebration({ message, itemText, final = false, effects = true, onContinue } = {}) {
  hideCelebration();
  ensureDialog();
  dialog.querySelector('#celebrationMessage').textContent = message
    || (final ? 'Emek verdin, bu oyunu tamamladın!' : 'Emek verdin, bu adımı tamamladın!');
  const item = dialog.querySelector('#celebrationItem');
  item.textContent = itemText || '';
  item.hidden = !itemText;
  dialog.classList.toggle('celebration-final', Boolean(final));

  const celebration = { onContinue, continued: false, timers: new Set(), confetti: null };
  activeCelebration = celebration;
  document.body.classList.add('celebration-open');
  dialog.showModal();
  dialog.querySelector('#celebrationContinue').focus({ preventScroll: true });
  celebrateWithConfetti(celebration);
  if (effects) audio.playEffect('complete');
  void speakCongratulations(celebration);
}

export function hideCelebration() {
  const celebration = activeCelebration;
  activeCelebration = null;
  if (celebration) {
    for (const timer of celebration.timers) clearTimeout(timer);
    celebration.timers.clear();
    celebration.confetti?.reset();
    audio.stopSpeech();
    audio.stopEffect('complete');
  }
  if (dialog?.open) dialog.close();
  document.body.classList.remove('celebration-open');
}

export function isCelebrationOpen() {
  return Boolean(dialog?.open);
}
