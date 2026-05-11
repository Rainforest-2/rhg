export function isRawBcuUrl(url) {
  const s = String(url || '').replace(/\\/g, '/');
  return /(^|\/|\.\/)public\/assets\/bcu\//.test(s) || /(^|\/|\.\/)public\/assets\/bcu-manifest\.json$/.test(s);
}

export function assertRuntimeUrlAllowed(url, context = 'runtime', provider = null) {
  if (!isRawBcuUrl(url)) return;
  provider?.diagnostics?.blockedRawReads?.push?.({ type: 'runtime-raw-url', context, url: String(url) });
  if (!provider?.allowRawFallback) throw new Error(`Raw BCU URL blocked in ${context}: ${url}`);
  provider?.diagnostics?.rawOnlyReads?.push?.({ type: 'runtime-raw-url', context, url: String(url) });
}

export function installRuntimeRawBcuGuard({ mode = 'semantic-strict', provider = null } = {}) {
  if (mode === 'raw-only-diagnostics') return { installed: false, mode };
  const target = globalThis;
  if (target.__BCU_RAW_GUARD_INSTALLED__) return { installed: true, mode, reused: true };
  target.__BCU_RAW_GUARD_INSTALLED__ = true;

  if (typeof target.fetch === 'function') {
    const originalFetch = target.fetch.bind(target);
    target.fetch = (input, init) => {
      const url = typeof input === 'string' ? input : input?.url;
      assertRuntimeUrlAllowed(url, 'fetch', provider);
      return originalFetch(input, init);
    };
  }

  const imageProto = target.HTMLImageElement?.prototype;
  const srcDesc = imageProto ? Object.getOwnPropertyDescriptor(imageProto, 'src') : null;
  if (imageProto && srcDesc?.set && srcDesc?.get) {
    Object.defineProperty(imageProto, 'src', {
      configurable: true,
      enumerable: srcDesc.enumerable,
      get() { return srcDesc.get.call(this); },
      set(value) {
        assertRuntimeUrlAllowed(value, 'HTMLImageElement.src', provider);
        return srcDesc.set.call(this, value);
      }
    });
  }

  const elementProto = target.Element?.prototype;
  if (elementProto?.setAttribute) {
    const originalSetAttribute = elementProto.setAttribute;
    elementProto.setAttribute = function setAttributeGuarded(name, value) {
      if (String(name).toLowerCase() === 'src') assertRuntimeUrlAllowed(value, 'Element.setAttribute(src)', provider);
      return originalSetAttribute.call(this, name, value);
    };
  }

  if (target.MutationObserver && target.document?.documentElement) {
    const observer = new target.MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes || []) {
          if (node?.nodeType !== 1) continue;
          const imgs = node.matches?.('img[src]') ? [node] : [...(node.querySelectorAll?.('img[src]') || [])];
          for (const img of imgs) assertRuntimeUrlAllowed(img.getAttribute('src'), 'MutationObserver img[src]', provider);
        }
      }
    });
    observer.observe(target.document.documentElement, { childList: true, subtree: true });
  }

  return { installed: true, mode };
}
