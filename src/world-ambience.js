import './world-ambience.css';

// Ambient movement belongs to the interface, never to a writing surface or to
// the coordinates of a letter/card a child is actively trying to select.
const MAX_PARTICLES = 20;
const REVEAL_TARGETS = '.home-game-card, .home-parent-tile, .home-explore-card, .home-section-heading, .learn-journey-card, .learn-preview-grid > div, .learn-panel, .island-continuation';
const PIRPIR_HOSTS = '.home-island-art, .story-scene-stage';
const ASSET_BASE = document.querySelector('meta[name="harf-backend"]')?.content === 'laravel' ? '/' : (import.meta.env?.BASE_URL || '/');
let currentMount = null;

const butterfly = `<svg viewBox="0 0 44 36" aria-hidden="true"><g class="world-butterfly-wings"><path d="M20 17C4-6-7 13 15 23 4 41 25 35 22 21" fill="#e3b977"/><path d="M24 17C40-6 51 13 29 23 40 41 19 35 22 21" fill="#edcf9f"/></g><path d="M22 12v16m0-13-4-6m4 6 4-6" fill="none" stroke="#8c7957" stroke-width="1.8" stroke-linecap="round"/></svg>`;

/** Mount once for this page; the returned cleanup is safe to call repeatedly. */
export function mountWorldAmbience({ root = document.body } = {}) {
  if (!root) return () => {};
  if (currentMount?.root === root) return currentMount.destroy;
  currentMount?.destroy();

  let destroyed = false;
  let scanFrame = 0;
  let lastBurst = 0;
  const particles = new Map();
  const queuedNodes = new Set();
  const waitingElements = new Set();
  const revealedElements = new Set();
  const pirpirBirds = new Map();
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  const sky = document.createElement('div');
  sky.className = 'world-ambience-sky';
  sky.dataset.worldAmbienceOwned = 'true';
  sky.setAttribute('aria-hidden', 'true');
  sky.innerHTML = `<span class="world-cloud-wisp world-cloud-wisp-one"></span><span class="world-cloud-wisp world-cloud-wisp-two"></span><span class="world-background-butterfly world-background-butterfly-one">${butterfly}</span><span class="world-background-butterfly world-background-butterfly-two">${butterfly}</span><span class="world-background-butterfly world-background-butterfly-three">${butterfly}</span><span class="world-background-orbit world-background-orbit-one"></span><span class="world-background-orbit world-background-orbit-two"></span>${Array.from({ length: 7 }, (_, index) => `<span class="world-firefly world-firefly-${index + 1}"></span>`).join('')}`;
  const effects = document.createElement('div');
  effects.className = 'world-ambience-effects';
  effects.dataset.worldAmbienceOwned = 'true';
  effects.setAttribute('aria-hidden', 'true');
  root.prepend(sky);
  root.appendChild(effects);
  root.classList.add('world-ambience-enabled');

  function disabled() {
    return destroyed || document.hidden || reduceMotion?.matches
      || root.dataset.motionPaused === 'true' || root.classList.contains('writing-focus');
  }
  function removeParticle(element) {
    const timer = particles.get(element);
    if (timer) clearTimeout(timer);
    particles.delete(element);
    element.remove();
  }
  function clearParticles() {
    for (const element of [...particles.keys()]) removeParticle(element);
  }
  function addParticle(className, x, y, properties = {}) {
    while (particles.size >= MAX_PARTICLES) removeParticle(particles.keys().next().value);
    const particle = document.createElement('span');
    particle.className = className;
    particle.style.left = `${x}px`; particle.style.top = `${y}px`;
    for (const [key, value] of Object.entries(properties)) particle.style.setProperty(key, value);
    effects.appendChild(particle);
    particles.set(particle, setTimeout(() => removeParticle(particle), 950));
    particle.addEventListener('animationend', () => removeParticle(particle), { once: true });
  }
  function burst(event) {
    if (disabled()) return;
    const button = event.target instanceof Element ? event.target.closest('button') : null;
    if (!button || button.disabled || !root.contains(button)
      || button.closest('.pad, .learn-notebook, [data-target], svg[role="img"]')) return;
    const now = performance.now();
    if (now - lastBurst < 90) return;
    lastBurst = now;
    const box = button.getBoundingClientRect();
    const x = event.detail > 0 && Number.isFinite(event.clientX) ? event.clientX : box.x + box.width / 2;
    const y = event.detail > 0 && Number.isFinite(event.clientY) ? event.clientY : box.y + box.height / 2;
    if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) return;
    addParticle('world-button-ring', x, y, { '--world-ring-size': `${Math.min(84, Math.max(40, box.height))}px` });
    for (let index = 0; index < 4; index++) {
      const angle = -Math.PI + index * Math.PI / 3;
      const distance = index % 2 ? 29 : 22;
      addParticle(`world-click-spark ${index % 2 ? 'world-click-spark-dot' : ''}`, x, y, {
        '--world-spark-x': `${Math.cos(angle) * distance}px`,
        '--world-spark-y': `${Math.sin(angle) * distance - 12}px`,
        '--world-spark-turn': `${index * 29 - 35}deg`,
        '--world-spark-color': ['#e0ae6c', '#9daf80', '#dca08b', '#b5c6a1'][index],
      });
    }
  }
  function reveal(element) {
    if (destroyed || !element.isConnected) return;
    waitingElements.delete(element);
    element.dataset.worldReveal = 'shown';
    revealedElements.add(element);
    intersection?.unobserve(element);
  }
  const intersection = typeof IntersectionObserver === 'function'
    ? new IntersectionObserver(entries => {
      for (const entry of entries) if (entry.isIntersecting) reveal(entry.target);
    }, { threshold: 0.08, rootMargin: '0px 0px -12px 0px' }) : null;

  function mountPirpir(node) {
    const hosts = [...(node.matches(PIRPIR_HOSTS) ? [node] : []), ...node.querySelectorAll(PIRPIR_HOSTS)];
    for (const host of hosts) {
      if (pirpirBirds.has(host) || [...host.children].some(child => child.classList.contains('world-pirpir'))) continue;
      const bird = document.createElement('span');
      bird.className = 'world-pirpir';
      bird.dataset.worldAmbienceOwned = 'true';
      bird.setAttribute('aria-hidden', 'true');
      bird.style.setProperty('--pirpir-sprite', `url("${ASSET_BASE}art/pirpir-flight.webp")`);
      const sprite = document.createElement('span');
      sprite.className = 'world-pirpir-sprite';
      bird.appendChild(sprite);
      host.classList.add('world-pirpir-host');
      host.appendChild(bird);
      pirpirBirds.set(host, bird);
    }
    for (const [host, bird] of pirpirBirds) if (!host.isConnected || !bird.isConnected) pirpirBirds.delete(host);
  }

  function scan(node = root) {
    if (destroyed || !(node instanceof Element) || node.closest('[data-world-ambience-owned]')) return;
    mountPirpir(node);
    const targets = [...(node.matches(REVEAL_TARGETS) ? [node] : []), ...node.querySelectorAll(REVEAL_TARGETS)];
    for (const element of targets) {
      if (element.dataset.worldReveal || element.closest('.writing-focus, .learning-writing')) continue;
      if (disabled() || !intersection) { element.dataset.worldReveal = 'shown'; continue; }
      // Opacity/entrance movement is only applied as the element enters view;
      // nothing interactive is hidden while waiting for an observer callback.
      element.dataset.worldReveal = 'waiting';
      waitingElements.add(element);
      intersection.observe(element);
    }
    for (const element of waitingElements) if (!element.isConnected) waitingElements.delete(element);
    for (const element of revealedElements) if (!element.isConnected) revealedElements.delete(element);
  }
  function flushScan() {
    scanFrame = 0;
    for (const node of queuedNodes) if (node.isConnected) scan(node);
    queuedNodes.clear();
  }
  function updateActivity() {
    if (destroyed) return;
    root.dataset.ambienceHidden = String(document.hidden);
    root.dataset.ambienceReduced = String(Boolean(reduceMotion?.matches));
    if (disabled()) {
      clearParticles();
      for (const element of [...waitingElements]) reveal(element);
    }
  }
  const observer = new MutationObserver(records => {
    let activityChanged = false;
    for (const record of records) {
      if (record.type === 'attributes') {
        if (record.target === root) activityChanged = true;
        continue;
      }
      if (root.classList.contains('writing-focus')) continue;
      for (const node of record.addedNodes) {
        if (node instanceof Element && !node.closest('[data-world-ambience-owned]')) queuedNodes.add(node);
      }
    }
    if (activityChanged) updateActivity();
    if (queuedNodes.size && !scanFrame) scanFrame = requestAnimationFrame(flushScan);
  });
  observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'data-motion-paused'] });
  document.addEventListener('click', burst, { capture: true, passive: true });
  document.addEventListener('visibilitychange', updateActivity);
  if (reduceMotion?.addEventListener) reduceMotion.addEventListener('change', updateActivity);
  else reduceMotion?.addListener?.(updateActivity);
  updateActivity();
  scan();

  const controller = {
    root,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      observer.disconnect(); intersection?.disconnect(); cancelAnimationFrame(scanFrame);
      document.removeEventListener('click', burst, true);
      document.removeEventListener('visibilitychange', updateActivity);
      if (reduceMotion?.removeEventListener) reduceMotion.removeEventListener('change', updateActivity);
      else reduceMotion?.removeListener?.(updateActivity);
      clearParticles(); queuedNodes.clear(); waitingElements.clear();
      for (const [host, bird] of pirpirBirds) {
        bird.remove(); host.classList.remove('world-pirpir-host');
      }
      pirpirBirds.clear();
      for (const element of revealedElements) delete element.dataset.worldReveal;
      revealedElements.clear();
      root.querySelectorAll('[data-world-reveal]').forEach(element => delete element.dataset.worldReveal);
      sky.remove(); effects.remove(); root.classList.remove('world-ambience-enabled');
      delete root.dataset.ambienceHidden; delete root.dataset.ambienceReduced;
      if (currentMount === controller) currentMount = null;
    },
  };
  currentMount = controller;
  return controller.destroy;
}
