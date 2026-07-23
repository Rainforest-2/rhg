import { CharacterModificationRenderer } from './character-modification/CharacterModificationRenderer.js';

const PATCH_FLAG = Symbol.for('rhg.character-modification-viewport-stability.v3');

function findScrollTopDescriptor(element) {
  let prototype = Object.getPrototypeOf(element);
  while (prototype) {
    const descriptor = Object.getOwnPropertyDescriptor(prototype, 'scrollTop');
    if (descriptor?.get && descriptor?.set) return descriptor;
    prototype = Object.getPrototypeOf(prototype);
  }
  return null;
}

function installCharacterModificationViewportStabilityPatch() {
  const proto = CharacterModificationRenderer?.prototype;
  if (!proto || proto[PATCH_FLAG]) return;
  proto[PATCH_FLAG] = true;

  const originalMount = proto.mount;
  proto.mount = function mountWithStableVisualViewport() {
    const result = originalMount.call(this);
    const viewport = globalThis.visualViewport;
    const immediateHandler = this.cmViewportHandler;
    const fieldList = this.fieldList;
    if (!viewport || typeof immediateHandler !== 'function' || !fieldList) return result;

    viewport.removeEventListener('resize', immediateHandler);
    viewport.removeEventListener('scroll', immediateHandler);

    this.cmDesiredScrollTop = fieldList.scrollTop;
    this.cmScrollTopDescriptor = findScrollTopDescriptor(fieldList);
    if (this.cmScrollTopDescriptor && !Object.hasOwn(fieldList, 'scrollTop')) {
      const descriptor = this.cmScrollTopDescriptor;
      Object.defineProperty(fieldList, 'scrollTop', {
        configurable: true,
        enumerable: descriptor.enumerable,
        get() {
          return descriptor.get.call(fieldList);
        },
        set: (value) => {
          descriptor.set.call(fieldList, value);
          if (!this.cmRestoringViewportScroll) {
            this.cmDesiredScrollTop = descriptor.get.call(fieldList);
          }
        }
      });
      this.cmOwnScrollTopInstalled = true;
    }

    this.cmScrollMemoryHandler = () => {
      if (!this.cmRestoringViewportScroll) this.cmDesiredScrollTop = fieldList.scrollTop;
    };
    fieldList.addEventListener('scroll', this.cmScrollMemoryHandler, { passive: true });

    const restoreScroll = () => {
      if (!fieldList.isConnected) return;
      fieldList.scrollTop = this.cmDesiredScrollTop;
    };

    this.cmViewportStableHandler = () => {
      this.cmRestoringViewportScroll = true;
      if (this.cmViewportStableFrame != null) {
        globalThis.cancelAnimationFrame?.(this.cmViewportStableFrame);
      }
      this.cmViewportStableFrame = globalThis.requestAnimationFrame?.(() => {
        this.cmViewportStableFrame = null;
        immediateHandler();
        restoreScroll();
        globalThis.requestAnimationFrame?.(() => {
          restoreScroll();
          globalThis.requestAnimationFrame?.(() => {
            restoreScroll();
            this.cmRestoringViewportScroll = false;
          });
        });
      });
    };

    this.cmViewportHandler = this.cmViewportStableHandler;
    viewport.addEventListener('resize', this.cmViewportStableHandler);
    viewport.addEventListener('scroll', this.cmViewportStableHandler);
    this.cmViewportStableHandler();
    return result;
  };

  const originalDestroy = proto.destroy;
  proto.destroy = function destroyStableVisualViewport() {
    if (this.cmViewportStableFrame != null) {
      globalThis.cancelAnimationFrame?.(this.cmViewportStableFrame);
      this.cmViewportStableFrame = null;
    }
    this.fieldList?.removeEventListener('scroll', this.cmScrollMemoryHandler);
    if (this.cmOwnScrollTopInstalled && this.fieldList && Object.hasOwn(this.fieldList, 'scrollTop')) {
      delete this.fieldList.scrollTop;
    }
    this.cmOwnScrollTopInstalled = false;
    this.cmRestoringViewportScroll = false;
    return originalDestroy.call(this);
  };
}

installCharacterModificationViewportStabilityPatch();

export { installCharacterModificationViewportStabilityPatch };
