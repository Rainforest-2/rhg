const STYLE_ID = 'wanko-ui-motion-style';
const active = new WeakMap();
const reduceMotion = () => globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true;

function ensureStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
.ui-motion-fade-in{opacity:0!important;transition:opacity var(--ui-motion-duration,150ms) ease-out!important}
.ui-motion-fade-in.ui-motion-run{opacity:1!important}
.ui-motion-fade-out{opacity:1!important;transition:opacity var(--ui-motion-duration,130ms) ease-in!important}
.ui-motion-fade-out.ui-motion-run{opacity:0!important}
.ui-motion-pop-in{opacity:0!important;transform:scale(.88) translateY(10px)!important;transition:opacity var(--ui-motion-duration,160ms) ease-out,transform var(--ui-motion-duration,160ms) cubic-bezier(.16,1.22,.22,1)!important}
.ui-motion-pop-in.ui-motion-run{opacity:1!important;transform:scale(1) translateY(0)!important}
.ui-motion-pop-out{opacity:1!important;transform:scale(1) translateY(0)!important;transition:opacity var(--ui-motion-duration,125ms) ease-in,transform var(--ui-motion-duration,125ms) ease-in!important}
.ui-motion-pop-out.ui-motion-run{opacity:0!important;transform:scale(.92) translateY(7px)!important}
.ui-motion-press{transition:transform 110ms ease-out,filter 110ms ease-out!important;transform:translateY(4px) scale(.965)!important;filter:brightness(.92) saturate(1.08)!important}
.ui-motion-added{animation:uiMotionAdded 230ms ease-out both!important}
.ui-motion-duplicate{animation:uiMotionDuplicate 190ms ease-out both!important}
@keyframes uiMotionAdded{0%{transform:scale(.965);filter:brightness(1.32) saturate(1.18)}55%{transform:scale(1.025);filter:brightness(1.18) saturate(1.12)}100%{transform:scale(1);filter:brightness(1) saturate(1)}}
@keyframes uiMotionDuplicate{0%,100%{transform:translateX(0)}25%{transform:translateX(-4px)}55%{transform:translateX(4px)}80%{transform:translateX(-2px)}}
@media (prefers-reduced-motion: reduce){
  .ui-motion-fade-in,.ui-motion-fade-out,.ui-motion-pop-in,.ui-motion-pop-out,.ui-motion-press{transition:none!important;animation:none!important;transform:none!important}
  .ui-motion-added,.ui-motion-duplicate{animation:none!important}
}`;
  document.head.appendChild(style);
}

export function nextFrame() {
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
}

function cleanup(el, classes) {
  el.classList.remove(...classes, 'ui-motion-run');
  el.style.removeProperty('--ui-motion-duration');
  if (active.get(el)?.classes === classes) active.delete(el);
}

function run(el, name, options = {}) {
  if (!el) return Promise.resolve(false);
  ensureStyle();
  const duration = Number(options.duration ?? 140);
  const display = options.display || '';
  const classes = [name];
  const previous = active.get(el);
  if (previous?.cancel) previous.cancel();
  if (display) el.style.display = display;
  el.classList.remove('ui-motion-fade-in', 'ui-motion-fade-out', 'ui-motion-pop-in', 'ui-motion-pop-out', 'ui-motion-run');
  if (reduceMotion() || duration <= 0) {
    if (name.endsWith('out')) el.style.display = options.afterDisplay || 'none';
    else if (display) el.style.display = display;
    return Promise.resolve(true);
  }
  el.style.setProperty('--ui-motion-duration', `${duration}ms`);
  el.classList.add(name);
  let done = false;
  let timer = 0;
  return new Promise((resolve) => {
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      el.removeEventListener('transitionend', onEnd);
      cleanup(el, classes);
      if (name.endsWith('out')) el.style.display = options.afterDisplay || 'none';
      resolve(true);
    };
    const cancel = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      el.removeEventListener('transitionend', onEnd);
      cleanup(el, classes);
      resolve(false);
    };
    const onEnd = (event) => {
      if (event.target === el) finish();
    };
    active.set(el, { cancel, classes });
    el.addEventListener('transitionend', onEnd);
    timer = setTimeout(finish, duration + 90);
    requestAnimationFrame(() => el.classList.add('ui-motion-run'));
  });
}

export function fadeIn(el, options = {}) {
  return run(el, 'ui-motion-fade-in', { duration: 150, ...options });
}

export function fadeOut(el, options = {}) {
  return run(el, 'ui-motion-fade-out', { duration: 130, ...options });
}

export function popIn(el, options = {}) {
  return run(el, 'ui-motion-pop-in', { duration: 165, ...options });
}

export function popOut(el, options = {}) {
  return run(el, 'ui-motion-pop-out', { duration: 125, ...options });
}

export function press(el) {
  if (!el || reduceMotion()) return;
  ensureStyle();
  el.classList.remove('ui-motion-press');
  void el.offsetWidth;
  el.classList.add('ui-motion-press');
  setTimeout(() => el.classList.remove('ui-motion-press'), 120);
}

export function pulseAdded(el, duplicate = false) {
  if (!el || reduceMotion()) return;
  ensureStyle();
  const cls = duplicate ? 'ui-motion-duplicate' : 'ui-motion-added';
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
  setTimeout(() => el.classList.remove(cls), duplicate ? 200 : 240);
}

export function debounce(fn, ms = 200) {
  let timer = 0;
  function debounced(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), ms);
  }
  debounced.cancel = () => clearTimeout(timer);
  debounced.flush = function flush(...args) {
    clearTimeout(timer);
    return fn.apply(this, args);
  };
  return debounced;
}

function dataSelector(el) {
  if (!(el instanceof HTMLElement) || !el.dataset) return '';
  return Object.keys(el.dataset)
    .map((k) => `[data-${k.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}]`)
    .join('');
}

export function withFocusRestore(input, callback) {
  const target = input instanceof HTMLElement ? input : document.activeElement;
  const shouldRestore = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;
  const state = shouldRestore ? {
    target,
    selector: dataSelector(target),
    name: target.getAttribute('name') || '',
    start: target.selectionStart,
    end: target.selectionEnd
  } : null;
  const result = callback?.();
  if (!state) return result;

  // If the input survived the update, do not force-focus it again. On iOS this
  // re-focus step fights text selection/copy gestures and can jump focus among
  // the stage-name/min/max filter fields.
  if (state.target?.isConnected) return result;

  requestAnimationFrame(() => {
    const safeName = globalThis.CSS?.escape ? CSS.escape(state.name) : String(state.name).replace(/"/g, '\\"');
    const el = (state.selector ? document.querySelector(state.selector) : null)
      || (state.name ? document.querySelector(`[name="${safeName}"]`) : null);
    if (el && typeof el.focus === 'function') {
      el.focus({ preventScroll: true });
      try { el.setSelectionRange(state.start, state.end); } catch {}
    }
  });
  return result;
}
