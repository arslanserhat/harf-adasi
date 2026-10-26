/**
 * A drawing surface is a canvas, not a page-scrolling gesture.
 *
 * iPad Safari needs cancellable Touch Events as well as touch-action. Keep the
 * cancellation scoped to gestures that start on this surface; dialogs and the
 * ordinary catalog retain their normal scrolling behaviour.
 */
let activeGuard = null;
let clearReleaseClick = null;

// Survives a toolbar action's navigation, then expires or yields to a new tap.
function suppressReleasedClick(x, y) {
  clearReleaseClick?.();
  let timer;
  const clean = () => {
    clearTimeout(timer);
    document.removeEventListener('click', duplicate, true);
    document.removeEventListener('pointerdown', newContact, true);
    if (clearReleaseClick === clean) clearReleaseClick = null;
  };
  const duplicate = event => {
    if (event.isTrusted && event.detail > 0 && Math.hypot(event.clientX - x, event.clientY - y) < 20) {
      if (event.cancelable) event.preventDefault();
      event.stopImmediatePropagation(); clean();
    }
  };
  const newContact = event => { if (event.isPrimary !== false) clean(); };
  document.addEventListener('click', duplicate, true);
  document.addEventListener('pointerdown', newContact, true);
  timer = setTimeout(clean, 700);
  clearReleaseClick = clean;
}

export function releaseWritingGuard() {
  activeGuard?.destroy();
}

export function mountWritingGuard(svg) {
  releaseWritingGuard();
  if (!svg?.isConnected) return null;

  const body = document.body;
  const root = document.documentElement;
  const savedScroll = { x: window.scrollX, y: window.scrollY };
  const bodyProperties = ['position', 'top', 'left', 'width', 'height', 'overflow'];
  const previousStyles = bodyProperties.map(name => ({
    name,
    value: body.style.getPropertyValue(name),
    priority: body.style.getPropertyPriority(name),
  }));
  const viewportProperties = [
    '--writing-viewport-height', '--writing-viewport-width',
    '--writing-viewport-top', '--writing-viewport-left',
  ];
  const previousViewportStyles = viewportProperties.map(name => ({
    name,
    value: root.style.getPropertyValue(name),
    priority: root.style.getPropertyPriority(name),
  }));
  const hadBodyClass = body.classList.contains('writing-focus');
  const hadRootClass = root.classList.contains('writing-scroll-locked');
  const originalAspectRatio = svg.getAttribute('preserveAspectRatio');
  const cleanup = [];
  const touchIds = new Set();
  const pointerIds = new Set();
  let frame = 0;
  let destroyed = false;
  let fallbackTouch = null;
  let fallbackMouse = false;
  let actionContact = null;
  let actionTimer = 0;
  let pendingAction = null;

  function listen(target, name, listener, options = false) {
    target.addEventListener(name, listener, options);
    const capture = typeof options === 'boolean' ? options : Boolean(options.capture);
    cleanup.push(() => target.removeEventListener(name, listener, capture));
  }

  function prevent(event) {
    if (event.cancelable) event.preventDefault();
  }

  function isDialogEvent(event) {
    return event.target instanceof Element && Boolean(event.target.closest('dialog[open]'));
  }

  function setDrawingState() {
    body.classList.toggle('writing-stroke-active', touchIds.size > 0 || pointerIds.size > 0);
  }

  function updateViewport() {
    frame = 0;
    if (destroyed) return;
    const viewport = window.visualViewport;
    const bounded = values => Math.min(...values.filter(value => Number.isFinite(value) && value > 0));
    root.style.setProperty('--writing-viewport-height', `${bounded([viewport?.height, window.innerHeight, root.clientHeight])}px`);
    root.style.setProperty('--writing-viewport-width', `${bounded([viewport?.width, window.innerWidth, root.clientWidth])}px`);
    root.style.setProperty('--writing-viewport-top', `${viewport?.offsetTop || 0}px`);
    root.style.setProperty('--writing-viewport-left', `${viewport?.offsetLeft || 0}px`);
  }

  function scheduleViewport() {
    if (!frame) frame = requestAnimationFrame(updateViewport);
  }

  // The fixed main panel is independent of this saved background offset. This
  // retains the prior catalog position until the game explicitly navigates.
  body.style.setProperty('position', 'fixed');
  body.style.setProperty('top', `${-savedScroll.y}px`);
  body.style.setProperty('left', `${-savedScroll.x}px`);
  body.style.setProperty('width', '100%');
  body.style.setProperty('height', '100%');
  body.style.setProperty('overflow', 'hidden');
  body.classList.add('writing-focus');
  root.classList.add('writing-scroll-locked');

  // Free writing should use the whole notebook, including a wide landscape
  // surface. Guided letters retain their proportions. The drawing controller
  // maps points with getScreenCTM().inverse(), so both layouts share the same
  // logical SVG coordinates without offsets or distorted input.
  if (!svg.querySelector('[data-target]')) svg.setAttribute('preserveAspectRatio', 'none');
  updateViewport();

  // Drawing can suppress a browser's following compatibility click. Activate a
  // released toolbar tap once, then consume only that tap's duplicate click.
  // Keyboard activation and gestures starting on the notebook stay native.
  listen(document, 'pointerdown', event => {
    clearTimeout(actionTimer); actionTimer = 0; pendingAction = null;
    const button = event.target instanceof Element ? event.target.closest('#main button[data-do], #main button[data-learning]') : null;
    actionContact = button && !button.disabled && !isDialogEvent(event) && event.button === 0
      && event.isPrimary !== false && touchIds.size === 0 && pointerIds.size === 0
      ? { button, pointerId: event.pointerId, x: event.clientX, y: event.clientY, moved: false } : null;
  }, true);
  listen(document, 'pointermove', event => {
    if (actionContact?.pointerId === event.pointerId && Math.hypot(event.clientX - actionContact.x, event.clientY - actionContact.y) > 12) actionContact.moved = true;
  }, { capture: true, passive: true });
  listen(document, 'pointercancel', () => {
    actionContact = null; clearTimeout(actionTimer); actionTimer = 0; pendingAction = null;
  }, true);
  listen(document, 'pointerup', event => {
    const contact = actionContact;
    actionContact = null;
    if (!contact || contact.moved || contact.pointerId !== event.pointerId || !contact.button.isConnected || contact.button.disabled
      || Math.hypot(event.clientX - contact.x, event.clientY - contact.y) > 12) return;
    const box = contact.button.getBoundingClientRect();
    if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) return;
    pendingAction = contact;
    actionTimer = setTimeout(() => {
      actionTimer = 0; pendingAction = null;
      if (destroyed || !contact.button.isConnected || contact.button.disabled) return;
      suppressReleasedClick(event.clientX, event.clientY);
      contact.button.click();
    }, 120);
  }, { capture: true, passive: false });
  listen(document, 'click', event => {
    if (!event.isTrusted || event.detail === 0) return;
    if (pendingAction?.button.contains(event.target)) {
      clearTimeout(actionTimer); actionTimer = 0; pendingAction = null;
    }
  }, true);

  listen(svg, 'pointerdown', event => {
    prevent(event);
    pointerIds.add(event.pointerId);
    setDrawingState();
  }, { capture: true, passive: false });
  const pointerFinished = event => {
    pointerIds.delete(event.pointerId);
    setDrawingState();
  };
  listen(document, 'pointerup', pointerFinished, true);
  listen(document, 'pointercancel', pointerFinished, true);
  listen(svg, 'lostpointercapture', pointerFinished, true);

  // Some Safari versions begin a native scroll before a Pointer Events move is
  // delivered. Cancelling touchstart/touchmove with passive:false stops that
  // negotiation rather than trying to undo a scroll after the stroke is lost.
  listen(svg, 'touchstart', event => {
    prevent(event);
    for (const touch of Array.from(event.changedTouches)) touchIds.add(touch.identifier);
    setDrawingState();
  }, { capture: true, passive: false });
  listen(document, 'touchmove', event => {
    if (isDialogEvent(event)) return;
    if (touchIds.size > 0 || svg.contains(event.target)) prevent(event);
  }, { capture: true, passive: false });
  const touchesFinished = event => {
    for (const touch of Array.from(event.changedTouches)) touchIds.delete(touch.identifier);
    setDrawingState();
  };
  listen(document, 'touchend', touchesFinished, { capture: true, passive: true });
  listen(document, 'touchcancel', touchesFinished, { capture: true, passive: true });
  const blockPadGesture = event => {
    if (!isDialogEvent(event) && (touchIds.size > 0 || svg.contains(event.target))) prevent(event);
  };
  listen(document, 'gesturestart', blockPadGesture, { capture: true, passive: false });
  listen(document, 'gesturechange', blockPadGesture, { capture: true, passive: false });

  // Old iPads predate Pointer Events. Feed the existing tracing controller the
  // same event shape only on those browsers, avoiding duplicate ink on modern
  // Safari, Chromium, pen devices, and touch-enabled laptops.
  if (!('PointerEvent' in window)) {
    function forward(type, source, pointerId, pointerType) {
      const event = new Event(type, { bubbles: true, cancelable: true });
      Object.defineProperties(event, {
        clientX: { value: source.clientX },
        clientY: { value: source.clientY },
        pointerId: { value: pointerId },
        pointerType: { value: pointerType },
        button: { value: 0 },
        buttons: { value: type === 'pointerup' || type === 'pointercancel' ? 0 : 1 },
        isPrimary: { value: true },
      });
      svg.dispatchEvent(event);
    }
    listen(svg, 'touchstart', event => {
      if (fallbackTouch !== null || !event.changedTouches.length) return;
      fallbackTouch = event.changedTouches[0].identifier;
      forward('pointerdown', event.changedTouches[0], fallbackTouch + 2, 'touch');
    }, { passive: false });
    listen(document, 'touchmove', event => {
      if (fallbackTouch === null) return;
      const touch = Array.from(event.changedTouches).find(item => item.identifier === fallbackTouch);
      if (touch) forward('pointermove', touch, fallbackTouch + 2, 'touch');
    }, { passive: false });
    const finishFallbackTouch = (event, cancelled) => {
      if (fallbackTouch === null) return;
      const touch = Array.from(event.changedTouches).find(item => item.identifier === fallbackTouch);
      if (!touch) return;
      forward(cancelled ? 'pointercancel' : 'pointerup', touch, fallbackTouch + 2, 'touch');
      fallbackTouch = null;
    };
    listen(document, 'touchend', event => finishFallbackTouch(event, false));
    listen(document, 'touchcancel', event => finishFallbackTouch(event, true));
    listen(svg, 'mousedown', event => {
      if (event.button !== 0 || fallbackTouch !== null) return;
      prevent(event);
      fallbackMouse = true;
      forward('pointerdown', event, 1, 'mouse');
    });
    listen(document, 'mousemove', event => {
      if (!fallbackMouse) return;
      prevent(event);
      forward('pointermove', event, 1, 'mouse');
    });
    listen(document, 'mouseup', event => {
      if (!fallbackMouse) return;
      fallbackMouse = false;
      forward('pointerup', event, 1, 'mouse');
    });
  }

  listen(window, 'resize', scheduleViewport, { passive: true });
  listen(window, 'orientationchange', scheduleViewport, { passive: true });
  if (window.visualViewport) {
    listen(window.visualViewport, 'resize', scheduleViewport, { passive: true });
    listen(window.visualViewport, 'scroll', scheduleViewport, { passive: true });
  }

  const guard = {
    refresh: scheduleViewport,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      cleanup.splice(0).forEach(remove => remove());
      cancelAnimationFrame(frame);
      clearTimeout(actionTimer);
      touchIds.clear();
      pointerIds.clear();
      body.classList.remove('writing-stroke-active');
      if (!hadBodyClass) body.classList.remove('writing-focus');
      if (!hadRootClass) root.classList.remove('writing-scroll-locked');
      for (const { name, value, priority } of previousStyles) {
        if (value) body.style.setProperty(name, value, priority);
        else body.style.removeProperty(name);
      }
      for (const { name, value, priority } of previousViewportStyles) {
        if (value) root.style.setProperty(name, value, priority);
        else root.style.removeProperty(name);
      }
      if (originalAspectRatio === null) svg.removeAttribute('preserveAspectRatio');
      else svg.setAttribute('preserveAspectRatio', originalAspectRatio);
      window.scrollTo(savedScroll.x, savedScroll.y);
      if (activeGuard === guard) activeGuard = null;
    },
  };
  activeGuard = guard;
  return guard;
}
