import confetti from 'canvas-confetti';
import { audio } from './audio.js';
import './celebration.css';

let dialog;
let activeCelebration = null;
let trailingPointerClick = null;
const clearControlGestures = [];

function rememberPointerEnd(event) {
  trailingPointerClick = {
    pointerId: event.pointerId,
    x: event.clientX,
    y: event.clientY,
    expires: Date.now() + 900,
  };
}

function bindActivation(control, activate) {
  let gesture = null;
  const clearGesture = () => {
    const previous = gesture;
    gesture = null;
    if (previous) {
      try { control.releasePointerCapture(previous.pointerId); } catch { /* Touch Events have no pointer capture. */ }
    }
  };
  clearControlGestures.push(clearGesture);
  const start = event => {
    if (!dialog.open || !activeCelebration || event.isPrimary === false) return;
    event.preventDefault();
    clearGesture();
    gesture = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      moved: false,
      celebration: activeCelebration,
    };
    try { control.setPointerCapture(event.pointerId); } catch { /* Older Safari uses the Touch Events branch below. */ }
    control.focus({ preventScroll: true });
  };
  const move = event => {
    if (!gesture || event.pointerId !== gesture.pointerId) return;
    if (Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) > 12) gesture.moved = true;
  };
  const finish = (event, cancelled = false) => {
    if (!gesture || event.pointerId !== gesture.pointerId) return;
    const completed = gesture;
    clearGesture();
    event.preventDefault();
    rememberPointerEnd(event);
    const bounds = control.getBoundingClientRect();
    const inside = event.clientX >= bounds.left && event.clientX <= bounds.right
      && event.clientY >= bounds.top && event.clientY <= bounds.bottom;
    const moved = completed.moved || Math.hypot(event.clientX - completed.x, event.clientY - completed.y) > 12;
    if (!cancelled && !moved && inside && stillOpen(completed.celebration)) activate();
  };

  if ('PointerEvent' in window) {
    control.addEventListener('pointerdown', event => {
      if (event.pointerType === 'touch' || event.pointerType === 'pen') start(event);
    });
    control.addEventListener('pointermove', move);
    control.addEventListener('pointerup', event => finish(event));
    control.addEventListener('pointercancel', event => finish(event, true));
    control.addEventListener('lostpointercapture', clearGesture);
  } else {
    const touchEvent = (event, touch) => ({
      pointerId: touch.identifier,
      clientX: touch.clientX,
      clientY: touch.clientY,
      preventDefault: () => event.preventDefault(),
    });
    control.addEventListener('touchstart', event => {
      if (event.touches.length === 1) start(touchEvent(event, event.changedTouches[0]));
      else clearGesture();
    }, { passive: false });
    control.addEventListener('touchmove', event => {
      for (const touch of Array.from(event.changedTouches)) move(touchEvent(event, touch));
    }, { passive: true });
    for (const type of ['touchend', 'touchcancel']) {
      control.addEventListener(type, event => {
        for (const touch of Array.from(event.changedTouches)) finish(touchEvent(event, touch), type === 'touchcancel');
      }, { passive: false });
    }
  }

  control.addEventListener('click', event => {
    // Touch/pen activates on release: Safari may omit its compatibility click
    // immediately after drawing. Keyboard and mouse keep native click behavior.
    if (event.pointerType === 'touch' || event.pointerType === 'pen' || event.sourceCapabilities?.firesTouchEvents) {
      event.preventDefault();
      return;
    }
    activate();
  });
}

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
      <figure id="celebrationReward" class="celebration-journey-card" hidden>
        <span class="celebration-card-ribbon">MACERA KARTI</span>
        <div class="celebration-card-art"><img id="celebrationRewardImage" alt="" draggable="false"><svg class="celebration-card-fallback" viewBox="0 0 120 100" aria-hidden="true"><path d="M16 77q44-43 88 0v12H16Z" fill="#a7bf9b"/><path d="m60 15 10 20 23 3-17 16 4 23-20-11-20 11 4-23-17-16 23-3Z" fill="#f0cf8c" stroke="#d8b474" stroke-width="3"/></svg></div>
        <figcaption id="celebrationRewardTitle"></figcaption>
        <span class="celebration-card-seal" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m5 12 4 4L19 6"/></svg></span>
      </figure>
      <p id="celebrationMessage"></p>
      <div id="celebrationItem" class="celebration-item"></div>
      <p id="celebrationHint">Hazırsan devam edebilirsin.</p>
      <button id="celebrationContinue" type="button" autofocus>Devam et <span aria-hidden="true">→</span></button>
    </div>`;
  document.body.appendChild(dialog);
  dialog.querySelector('#celebrationRewardImage').addEventListener('error', event => {
    event.target.hidden = true;
    dialog.querySelector('#celebrationReward').dataset.art = 'unavailable';
  });

  // A fresh gesture or keyboard activation is always allowed. Only the one
  // trailing click from our handled release is blocked, even after navigation.
  document.addEventListener('pointerdown', () => { trailingPointerClick = null; }, true);
  if (!('PointerEvent' in window)) document.addEventListener('touchstart', () => { trailingPointerClick = null; }, { capture: true, passive: true });
  document.addEventListener('click', event => {
    const previous = trailingPointerClick;
    if (!previous || event.detail === 0) return;
    if (Date.now() > previous.expires) { trailingPointerClick = null; return; }
    const samePointer = event.pointerId === previous.pointerId;
    const samePlace = Math.hypot(event.clientX - previous.x, event.clientY - previous.y) <= 30;
    if (!samePointer && !samePlace) return;
    trailingPointerClick = null;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);
  bindActivation(dialog.querySelector('#celebrationReturn'), hideCelebration);
  bindActivation(dialog.querySelector('#celebrationContinue'), () => {
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
    colors: celebration.mode === 'journey'
      ? ['#e8bd78', '#7eaa8b', '#df9c87', '#f2dfb9']
      : ['#8b77d8', '#f4c267', '#65bfaa', '#ef9ea5'],
    disableForReducedMotion: true,
  });
  const journey = celebration.mode === 'journey';
  burst(journey ? 18 : 30, { x: 0.23, y: 0.39 }, 60);
  schedule(celebration, () => burst(journey ? 12 : 24, { x: 0.77, y: 0.39 }, 120), 220);
  if (!journey) schedule(celebration, () => burst(18, { x: 0.5, y: 0.36 }, 90), 440);
  schedule(celebration, () => celebration.confetti?.reset(), journey ? 1150 : 1400);
}

async function speakCongratulations(celebration) {
  const status = audio.voiceStatus();
  if (status.muted || status.volume <= 0 || !stillOpen(celebration)) return;
  try {
    // One short supplied clip; the host chooses a matching Turkish recording.
    await audio.speak(celebration.voiceText);
  } catch {
    // The modal and its written instructions also work without audio output.
  }
}

export function showCelebration({ message, itemText, final = false, effects = true, onContinue,
  mode = 'step', title = 'Tebrikler!', voiceText = 'Tebrikler!',
  continueLabel = 'Devam et', returnLabel = 'Çalışmama dön', reward,
} = {}) {
  hideCelebration();
  ensureDialog();
  const journey = mode === 'journey';
  dialog.dataset.celebrationMode = journey ? 'journey' : 'step';
  dialog.classList.toggle('celebration-journey', journey);
  dialog.querySelector('#celebrationTitle').textContent = String(title || 'Tebrikler!');
  dialog.querySelector('.celebration-eyebrow').textContent = journey ? 'Bu maceradan bir hatıra' : 'Adım adım öğreniyorum';
  dialog.querySelector('#celebrationContinue').textContent = String(continueLabel || 'Devam et');
  const returnControl = dialog.querySelector('#celebrationReturn');
  returnControl.textContent = String(returnLabel || 'Çalışmama dön');
  returnControl.setAttribute('aria-label', returnControl.textContent);
  dialog.querySelector('#celebrationHint').textContent = journey
    ? 'Macera kartın açıldı. Hazır olduğunda yeni bir yolculuğa çıkabilirsin.'
    : 'Hazırsan devam edebilirsin.';
  dialog.querySelector('#celebrationMessage').textContent = message
    || (journey ? 'Bu yolculuktaki görevleri tamamladın.' : final ? 'Emek verdin, bu oyunu tamamladın!' : 'Emek verdin, bu adımı tamamladın!');
  const item = dialog.querySelector('#celebrationItem');
  item.textContent = itemText || '';
  item.hidden = !itemText;
  dialog.classList.toggle('celebration-final', Boolean(final));
  const card = dialog.querySelector('#celebrationReward');
  const image = dialog.querySelector('#celebrationRewardImage');
  card.hidden = !journey;
  card.dataset.art = 'unavailable';
  dialog.querySelector('#celebrationRewardTitle').textContent = String(reward?.title || 'Yolculuk hatıram');
  image.hidden = true;
  image.removeAttribute('src');
  if (journey && typeof reward?.image === 'string') {
    try {
      const source = new URL(reward.image, document.baseURI);
      if (source.origin === window.location.origin && ['http:', 'https:'].includes(source.protocol)) {
        card.dataset.art = 'available';
        image.hidden = false;
        image.src = source.href;
      }
    } catch { /* The original fallback card remains visible. */ }
  }

  const celebration = { mode: journey ? 'journey' : 'step', voiceText: String(voiceText || 'Tebrikler!'),
    onContinue, continued: false, timers: new Set(), confetti: null };
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
  for (const clearGesture of clearControlGestures) clearGesture();
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
