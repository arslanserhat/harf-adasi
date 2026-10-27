import './world-ambience.css';

// Ambient movement belongs to the interface, never to a writing surface or to
// the coordinates of a letter/card a child is actively trying to select.
const MAX_PARTICLES = 20;
const REVEAL_TARGETS = '.home-game-card, .home-parent-tile, .home-explore-card, .home-section-heading, .learn-journey-card, .learn-preview-grid > div, .learn-panel, .island-continuation';
const PET_HOSTS = '.home-section-heading, body > footer, .learning[data-screen="task"] > .learn-nav';
const PET_ASSETS = {
  lion: 'pet-lion.webp', rabbit: 'pet-rabbit.webp', fox: 'pet-fox.webp',
  squirrel: 'pet-squirrel.webp', turtle: 'pet-turtle.webp', bird: 'pirpir-flight.webp',
};
const ASSET_BASE = document.querySelector('meta[name="harf-backend"]')?.content === 'laravel' ? '/' : (import.meta.env?.BASE_URL || '/');
let currentMount = null;

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
  const petPerches = new Map();
  const navResize = typeof ResizeObserver === 'function' ? new ResizeObserver(() => updateNavPets()) : null;
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  const sky = document.createElement('div');
  sky.className = 'world-ambience-sky';
  sky.dataset.worldAmbienceOwned = 'true';
  sky.setAttribute('aria-hidden', 'true');
  sky.innerHTML = `<span class="world-cloud-wisp world-cloud-wisp-one"></span><span class="world-background-orbit world-background-orbit-one"></span>${[1, 2, 4, 5].map(index => `<span class="world-firefly world-firefly-${index}"></span>`).join('')}`;
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

  function mountSitePets(node) {
    const hosts = [...(node.matches(PET_HOSTS) ? [node] : []), ...node.querySelectorAll(PET_HOSTS)];
    for (const host of hosts) {
      if (host.closest('.home-island-art, .home-island-hero, .story-scene-stage, .story-scene')) continue;
      if (petPerches.has(host) || [...host.children].some(child => child.classList.contains('world-pet-perch'))) continue;
      const kind = host.matches('body > footer') ? 'footer' : host.matches('.learn-nav') ? 'nav' : 'section';
      const home = host.closest('.home-shell');
      if (kind === 'section' && !home) continue;
      const headingIndex = kind === 'section' ? [...home.querySelectorAll('.home-section-heading')].indexOf(host) : 0;
      const species = kind === 'footer' ? ['lion', 'squirrel', 'turtle', 'bird'] : kind === 'nav' ? ['bird'] : [headingIndex % 2 ? 'fox' : 'rabbit'];
      const perch = document.createElement('span');
      perch.className = `world-pet-perch world-pet-perch-${kind}`;
      perch.dataset.worldAmbienceOwned = 'true';
      perch.setAttribute('aria-hidden', 'true');
      for (const animal of species) {
        const pet = document.createElement('span');
        pet.className = `world-site-pet world-site-pet-${animal}`;
        pet.dataset.species = animal;
        pet.style.setProperty('--pet-atlas', `url("${ASSET_BASE}art/${PET_ASSETS[animal]}")`);
        const sprite = document.createElement('span');
        sprite.className = 'world-site-pet-sprite';
        pet.appendChild(sprite); perch.appendChild(pet);
      }
      const hostClass = `world-pet-host-${kind}`;
      host.classList.add(hostClass); host.appendChild(perch);
      petPerches.set(host, { perch, hostClass });
      if (kind === 'nav') navResize?.observe(host);
    }
    for (const [host, { perch }] of petPerches) if (!host.isConnected || !perch.isConnected) {
      navResize?.unobserve(host); petPerches.delete(host);
    }
  }
  function updateNavPets() {
    if (destroyed) return;
    for (const [host, { perch, hostClass }] of petPerches) {
      if (hostClass !== 'world-pet-host-nav' || !host.isConnected) continue;
      const bird = perch.querySelector('.world-site-pet-bird');
      if (!bird) continue;
      const rect = host.getBoundingClientRect();
      const width = parseFloat(getComputedStyle(bird).width) || (innerWidth <= 700 ? 38 : 48);
      // Include the hover's small horizontal drift, keeping the bird entirely
      // outside both the Home button and the sound/pause controls.
      const left = rect.x + rect.width / 2 - width / 2 - 6;
      const right = rect.x + rect.width / 2 + width / 2 + 6;
      const top = rect.y;
      const bottom = rect.y + 43;
      const overlaps = [...host.querySelectorAll('button, a, input, select')].some(control => {
        const box = control.getBoundingClientRect();
        return box.width > 0 && box.height > 0 && box.left < right && box.right > left && box.top < bottom && box.bottom > top;
      });
      bird.hidden = rect.width <= 0 || rect.height < 40 || overlaps;
      host.dataset.petGap = String(!bird.hidden);
    }
  }

  function scan(node = root) {
    if (destroyed || !(node instanceof Element) || node.closest('[data-world-ambience-owned]')) return;
    mountSitePets(node);
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
    updateNavPets();
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
  updateNavPets();
  document.fonts?.ready.then(() => { if (!destroyed) updateNavPets(); });

  const controller = {
    root,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      observer.disconnect(); intersection?.disconnect(); navResize?.disconnect(); cancelAnimationFrame(scanFrame);
      document.removeEventListener('click', burst, true);
      document.removeEventListener('visibilitychange', updateActivity);
      if (reduceMotion?.removeEventListener) reduceMotion.removeEventListener('change', updateActivity);
      else reduceMotion?.removeListener?.(updateActivity);
      clearParticles(); queuedNodes.clear(); waitingElements.clear();
      for (const [host, { perch, hostClass }] of petPerches) {
        perch.remove(); host.classList.remove(hostClass);
      }
      petPerches.clear();
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
