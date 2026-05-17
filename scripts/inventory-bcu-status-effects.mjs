import fs from 'node:fs/promises';
import path from 'node:path';
import { buildStatusEffectInventory } from './build-bcu-status-effect-bundle.mjs';

const OUT_INVENTORY = 'public/assets/generated/bcu-status-effect-inventory.json';

const { inventory } = await buildStatusEffectInventory();
await fs.mkdir(path.dirname(OUT_INVENTORY), { recursive: true });
await fs.writeFile(OUT_INVENTORY, `${JSON.stringify(inventory, null, 2)}\n`);
console.log(`wrote ${OUT_INVENTORY}`);
