import { buildPlayablePreviewAssets } from '../battle/PlayableCharacterRegistry.js';

const ANIM4_E = () => [
  { id: 'anim00', label: 'move', file: 'move.maanim' },
  { id: 'anim01', label: 'idle', file: 'idle.maanim' },
  { id: 'anim02', label: 'attack', file: 'attack.maanim' },
  { id: 'anim03', label: 'kb', file: 'kb.maanim' }
];

export const PREVIEW_ASSETS = [
  ...buildPlayablePreviewAssets(ANIM4_E)
];
