// Single source of truth for the post-loadGame runtime patch group (dev + prod).
// Installed from main.js once BcuBootLoader.loadGame() has run.
import '../../audio/BattleSoundEventPatch.js';
import '../../preview/PreviewAppCustomStageBattleConfigPatch.js';
import '../../preview/PreviewAppBattleResultOverlayPatch.js';
import '../../preview/PreviewAppBattlePauseOverlayPatch.js';
import '../../preview/PreviewAppPageTransitionPatch.js';
import '../../preview/PreviewAppBattleMusicPatch.js';
