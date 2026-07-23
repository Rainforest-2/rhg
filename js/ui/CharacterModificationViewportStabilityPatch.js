import { CharacterModificationRenderer } from './character-modification/CharacterModificationRenderer.js';

const PATCH_FLAG = Symbol.for('rhg.character-modification-viewport-stability.v1');

function installCharacterModificationViewportStabilityPatch() {
  const proto = CharacterModificationRenderer?.prototype;
  if (!proto || proto[PATCH_FLAG]) return;
  proto[PATCH_FLAG] = true;

  const originalMount = proto.mount;
  proto.mount = function mountWithStableVisualViewport() {
    const result = originalMount.call(this);
    const viewport = globalThis.visualViewport;
    const immediateHandler = this.cmViewportHandler;
    if (!viewport || typeof immediateHandler !== 'function') return result;

    viewport.removeEventListener('resize', immediateHandler);
    viewport.removeEventListener('scroll', immediateHandler);

    this.cmViewportStableHandler = () => {
      const fieldList = this.fieldList;
      const preservedScrollTop = fieldList?.scrollTop ?? 0;
      if (this.cmViewportStableFrame != null) {
        globalThis.cancelAnimationFrame?.(this.cmViewportStableFrame);
      }
      this.cmViewportStableFrame = globalThis.requestAnimationFrame?.(() => {
        this.cmViewportStableFrame = null;
        immediateHandler();
        globalThis.requestAnimationFrame?.(() => {
          if (fieldList?.isConnected) fieldList.scrollTop = preservedScrollTop;
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
    return originalDestroy.call(this);
  };
}

installCharacterModificationViewportStabilityPatch();

export { installCharacterModificationViewportStabilityPatch };
