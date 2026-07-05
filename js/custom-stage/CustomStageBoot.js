// Boot-time, idempotent migration of the stage-vs-stage battle config from the legacy v1 shape
// (flat `enemyStageIds` / `playerStageIds` string arrays) to schema v2 (typed { kind, id } refs),
// preserving the HP option flags. Safe to run on every launch: it only rewrites storage when the
// stored payload is missing the v2 typed arrays. Imported before FormationCustomStageBattlePatch so
// the UI reads an already-migrated payload.
import { migrateBattleConfigInStorage } from './CustomStageBattleStore.js';

try {
  migrateBattleConfigInStorage();
} catch {
  // Migration must never block boot; a corrupt payload simply stays as-is and is re-derived on read.
}
