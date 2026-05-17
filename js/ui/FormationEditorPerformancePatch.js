import { FormationEditor } from './FormationEditor.js';

if (!FormationEditor.prototype.__nyankoPerformancePatched) {
  FormationEditor.prototype.__nyankoPerformancePatched = true;

  const originalRenderDynamic = FormationEditor.prototype.renderDynamic;
  FormationEditor.prototype.renderDynamic = function patchedRenderDynamic(...args) {
    const scroller = this.root?.querySelector?.('.formation-catalog-scroll') || null;
    const keepScroll = this.__preserveCatalogScroll === true;
    const previousScrollTop = keepScroll ? (scroller?.scrollTop || 0) : 0;

    const result = originalRenderDynamic.apply(this, args);

    if (keepScroll) {
      const nextScroller = this.root?.querySelector?.('.formation-catalog-scroll') || scroller;
      if (nextScroller) {
        nextScroller.scrollTop = previousScrollTop;
        requestAnimationFrame(() => {
          if (nextScroller.isConnected) nextScroller.scrollTop = previousScrollTop;
        });
      }
      this.__preserveCatalogScroll = false;
    }

    return result;
  };

  const originalOnClick = FormationEditor.prototype.onClick;
  FormationEditor.prototype.onClick = function patchedOnClick(event) {
    if (event?.target?.closest?.('[data-character]')) {
      this.__preserveCatalogScroll = true;
    }
    return originalOnClick.call(this, event);
  };

  const originalLoadStageOptions = FormationEditor.prototype.loadStageOptions;
  FormationEditor.prototype.loadStageOptions = async function patchedLoadStageOptions(...args) {
    const result = await originalLoadStageOptions.apply(this, args);
    if (Array.isArray(this.stageOptions) && this.stageOptions.length > 48) {
      this.stageOptions = this.stageOptions.slice(0, 48);
      this.renderStageSelector?.();
    }
    return result;
  };
}
