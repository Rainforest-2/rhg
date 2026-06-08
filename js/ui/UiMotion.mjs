const STYLE_ID = 'wanko-ui-motion-style';
const active = new WeakMap();
const reduceMotion = () => globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true;

function ensureStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
.ui-motion-fade-in{opacity:0;transition:opacity var(--ui-motion-duration,140ms) ease-out}
.ui-motion-fade-in.ui-motion-run{opacity:1}
.ui-motion-fade-out{opacity:1;transition:opacity var(--ui-motion-duration,120ms) ease-in}
.ui-motion-fade-out.ui-motion-run{opacity:0}
.ui-motion-pop-in{opacity:0;transform:scale(.94) translateY(7px);transition:opacity var(--ui-motion-duration,140ms) ease-out,transform var(--ui-motion-duration,140ms) cubic-bezier(.2,1.16,.2,1)}
.ui-motion-pop-in.ui-motion-run{opacity:1;transform:scale(1) translateY(0)}
.ui-motion-pop-out{opacity:1;transform:scale(1);transition:opacity var(--ui-motion-duration,110ms) ease-in,transform var(--ui-motion-duration,110ms) ease-in}
.ui-motion-pop-out.ui-motion-run{opacity:0;transform:scale(.96) translateY(4px)}
.ui-motion-press{transition:transform 90ms ease-out,filter 90ms ease-out;transform:translateY(2px) scale(.98);filter:brightness(.96)}
.ui-motion-added{animation:uiMotionAdded 180ms ease-out both}
.ui-motion-duplicate{animation:uiMotionDuplicate 160ms ease-out both}
@keyframes uiMotionAdded{0%{transform:scale(.985);filter:brightness(1.18)}100%{transform:scale(1);filter:brightness(1)}}
@keyframes uiMotionDuplicate{0%,100%{transform:translateX(0)}35%{transform:translateX(-3px)}70%{transform:translateX(3px)}}
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
    timer = setTimeout(finish, duration + 80);
    requestAnimationFrame(() => el.classList.add('ui-motion-run'));
  });
}

export function fadeIn(el, options = {}) {
  return run(el, 'ui-motion-fade-in', { duration: 130, ...options });
}

export function fadeOut(el, options = {}) {
  return run(el, 'ui-motion-fade-out', { duration: 110, ...options });
}

export function popIn(el, options = {}) {
  return run(el, 'ui-motion-pop-in', { duration: 145, ...options });
}

export function popOut(el, options = {}) {
  return run(el, 'ui-motion-pop-out', { duration: 110, ...options });
}

export function press(el) {
  if (!el || reduceMotion()) return;
  ensureStyle();
  el.classList.remove('ui-motion-press');
  void el.offsetWidth;
  el.classList.add('ui-motion-press');
  setTimeout(() => el.classList.remove('ui-motion-press'), 95);
}

export function pulseAdded(el, duplicate = false) {
  if (!el || reduceMotion()) return;
  ensureStyle();
  const cls = duplicate ? 'ui-motion-duplicate' : 'ui-motion-added';
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
  setTimeout(() => el.classList.remove(cls), duplicate ? 170 : 190);
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

export function withFocusRestore(input, callback) {
  const target = input instanceof HTMLElement ? input : document.activeElement;
  const shouldRestore = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;
  const state = shouldRestore ? {
    selector: target.dataset ? Object.keys(target.dataset).map((k) => `[data-${k.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}]`).join('') : '',
    name: target.getAttribute('name') || '',
    value: target.value,
    start: target.selectionStart,
    end: target.selectionEnd
  } : null;
  const result = callback?.();
  if (state) {
    requestAnimationFrame(() => {
      const root = document;
      const next = state.selector ? root.querySelector(state.selector) : null;
      const safeName = globalThis.CSS?.escape ? CSS.escape(state.name) : String(state.name).replace(/"/g, '\\"');
      const el = next || (state.name ? root.querySelector(`[name="${safeName}"]`) : null);
      if (el && typeof el.focus === 'function') {
        el.focus({ preventScroll: true });
        try { el.setSelectionRange(state.start, state.end); } catch {}
      }
    });
  }
  return result;
}
