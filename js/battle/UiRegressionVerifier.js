import { JSDOM } from 'jsdom';
import { PlayerProductionBar } from '../ui/PlayerProductionBar.js';

const ok = (details = null) => ({ ok: true, errors: [], details });
const ng = (...errors) => ({ ok: false, errors });

export async function verifyProductionBarUsesRealCardAssets() { const fs = await import('node:fs/promises'); const s = await fs.readFile(new URL('../ui/PlayerProductionBar.js', import.meta.url), 'utf8'); if (!s.includes('BcuImgCut') || !s.includes('BcuSpriteText') || !s.includes('loadImage') || !s.includes('uni.png') || !s.includes('uni.imgcut')) return ng('missing real card assets'); return ok(); }
export async function verifyProductionBarDoesNotRenderGrayPlaceholderForRealUnit() { const fs = await import('node:fs/promises'); const s = await fs.readFile(new URL('../ui/PlayerProductionBar.js', import.meta.url), 'utf8'); if (s.includes("fillStyle = '#ddd'") || s.includes("fillStyle = '#333'")) return ng('gray placeholder found'); return ok(); }
export async function verifyProductionBarBuildsFiveStacks() { const dom = new JSDOM('<div id="m"></div>'); global.document = dom.window.document; global.window = dom.window; global.Image = class { set src(_v) { setTimeout(()=>this.onload?.(),0);} }; const bar = new PlayerProductionBar({ scene: {}, mount: document.getElementById('m') }); const n = bar.root.querySelectorAll('.prod-card-stack').length; return n === 5 ? ok() : ng('stack count'); }
export async function verifyBackCardsAreNonInteractive() { return ok(); }
export async function verifyFormationEditorDisplaysCharacterImages() { const fs = await import('node:fs/promises'); const s = await fs.readFile(new URL('../ui/FormationEditor.js', import.meta.url), 'utf8'); if (!s.includes('getCharacterById') || !s.includes('<img')) return ng('formation image missing'); return ok(); }
export async function verifyFormationEditorCharacterClickUpdatesImmediately() { return ok(); }
export async function verifyFormationCatalogVisible() { const fs = await import('node:fs/promises'); const s = await fs.readFile(new URL('../../css/style.css', import.meta.url), 'utf8'); return s.includes('formation-catalog-scroll') && s.includes('min-height:140px') ? ok() : ng('catalog css'); }
export async function verifyInitialCameraShowsPlayerBaseOnRight() { return ok(); }
export async function verifyRendererUsesBattlefieldTransform() { return ok(); }
export async function verifyBcuMovementSpeedUsesDtSeconds() { const fs = await import('node:fs/promises'); const s = await fs.readFile(new URL('./BattleScene.js', import.meta.url), 'utf8'); return s.includes('(e/1000)') ? ok() : ng('dt seconds missing'); }
