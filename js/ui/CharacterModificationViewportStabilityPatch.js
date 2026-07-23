import { CharacterModificationRenderer } from './character-modification/CharacterModificationRenderer.js';

const PATCH_FLAG = Symbol.for('rhg.character-modification-viewport-stability.v2');

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
    this.cmRestoringViewportScroll = false;
    return originalDestroy.call(this);
  };
}

installCharacterModificationViewportStabilityPatch();

export { installCharacterModificationViewportStabilityPatch };
