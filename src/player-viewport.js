import './player-viewport.css';

/** Layout only: no task, answer, history or completion state is changed. */
export function mountPlayerViewport() {
  let frame = 0;
  let alive = true;
  const main = document.querySelector('#main');
  const update = () => {
    frame = 0;
    if (!alive) return;
    const learning = main?.querySelector('#learning');
    const screen = learning?.dataset.screen;
    const active = screen === 'intro' || screen === 'task';
    document.body.dataset.playerScreen = active ? screen : '';
    document.body.dataset.playerWriting = String(active && document.body.classList.contains('writing-focus'));
    const view = window.visualViewport;
    const height = Math.max(1, Math.min(window.innerHeight, view?.height || window.innerHeight));
    let chrome = Math.max(0, view?.offsetTop || 0);
    for (const selector of ['body > header', 'body > .status']) {
      const element = document.querySelector(selector);
      if (element && getComputedStyle(element).display !== 'none') chrome = Math.max(chrome, element.getBoundingClientRect().bottom);
    }
    document.documentElement.style.setProperty('--player-viewport-height', `${height}px`);
    document.documentElement.style.setProperty('--player-chrome-height', `${Math.max(0, Math.ceil(chrome))}px`);
  };
  const schedule = () => { if (alive && !frame) frame = requestAnimationFrame(update); };
  const observer = new MutationObserver(schedule);
  if (main) observer.observe(main, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-screen', 'class'] });
  const bodyObserver = new MutationObserver(schedule);
  bodyObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  window.addEventListener('resize', schedule, { passive: true });
  window.addEventListener('orientationchange', schedule, { passive: true });
  window.visualViewport?.addEventListener('resize', schedule, { passive: true });
  window.visualViewport?.addEventListener('scroll', schedule, { passive: true });
  schedule();
  return () => {
    alive = false; cancelAnimationFrame(frame); observer.disconnect(); bodyObserver.disconnect();
    window.removeEventListener('resize', schedule); window.removeEventListener('orientationchange', schedule);
    window.visualViewport?.removeEventListener('resize', schedule); window.visualViewport?.removeEventListener('scroll', schedule);
    delete document.body.dataset.playerScreen; delete document.body.dataset.playerWriting;
  };
}
