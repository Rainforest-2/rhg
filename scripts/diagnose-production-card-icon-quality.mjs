import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { readJson, readStoreZipEntries, validatePngBuffer, validatePngFile } from './bcu-semantic-utils.mjs';
import {
  ENEMY_ICON_ZIP,
  generateEnemyIconForEntry,
  decodePng,
  selectedActorFiles
} from './actor-asset-task-utils.mjs';

const DOG_CONTENT_RECT = Object.freeze({ x: 6, y: 4, w: 98, h: 58 });
const DOG_ICON_SCALE = 1.2;
const DOG_ICON_FIT_MODE = 'cover';
const CARD_CANVAS = Object.freeze({ w: 110, h: 85 });
const PNG_OPTIONS = { allowTrailingBytes: true };

function parseArg(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : null;
}

function sha256(data) {
  return createHash('sha256').update(data).digest('hex');
}

function alphaBBox(decoded, alphaThreshold = 1) {
  if (!decoded?.rgba || !decoded.width || !decoded.height) return null;
  let left = decoded.width;
  let top = decoded.height;
  let right = -1;
  let bottom = -1;
  let pixels = 0;
  for (let y = 0; y < decoded.height; y += 1) {
    for (let x = 0; x < decoded.width; x += 1) {
      const a = decoded.rgba[(y * decoded.width + x) * 4 + 3];
      if (a < alphaThreshold) continue;
      pixels += 1;
      if (x < left) left = x;
      if (y < top) top = y;
      if (x > right) right = x;
      if (y > bottom) bottom = y;
    }
  }
  if (right < left || bottom < top) return null;
  return {
    left,
    top,
    right,
    bottom,
    w: right - left + 1,
    h: bottom - top + 1,
    max: Math.max(right - left + 1, bottom - top + 1),
    alphaPixels: pixels,
    alphaRatio: pixels / (decoded.width * decoded.height)
  };
}

function safeDecodePng(data) {
  try {
    return decodePng(data);
  } catch (error) {
    return { error: error?.message || String(error) };
  }
}

function cardProjectionForIcon(width, height, bbox) {
  const fitBase = DOG_ICON_FIT_MODE === 'cover'
    ? Math.max(DOG_CONTENT_RECT.w / width, DOG_CONTENT_RECT.h / height)
    : Math.min(DOG_CONTENT_RECT.w / width, DOG_CONTENT_RECT.h / height);
  const fit = fitBase * DOG_ICON_SCALE;
  const draw = {
    w: width * fit,
    h: height * fit,
    x: DOG_CONTENT_RECT.x + (DOG_CONTENT_RECT.w - width * fit) / 2,
    y: DOG_CONTENT_RECT.y + (DOG_CONTENT_RECT.h - height * fit) / 2
  };
  let visibleContent = null;
  if (bbox) {
    const raw = {
      left: draw.x + bbox.left * fit,
      top: draw.y + bbox.top * fit,
      right: draw.x + (bbox.right + 1) * fit,
      bottom: draw.y + (bbox.bottom + 1) * fit
    };
    const clipped = {
      left: Math.max(DOG_CONTENT_RECT.x, raw.left),
      top: Math.max(DOG_CONTENT_RECT.y, raw.top),
      right: Math.min(DOG_CONTENT_RECT.x + DOG_CONTENT_RECT.w, raw.right),
      bottom: Math.min(DOG_CONTENT_RECT.y + DOG_CONTENT_RECT.h, raw.bottom)
    };
    visibleContent = {
      unclipped: { ...raw, w: raw.right - raw.left, h: raw.bottom - raw.top },
      clipped: { ...clipped, w: Math.max(0, clipped.right - clipped.left), h: Math.max(0, clipped.bottom - clipped.top) },
      clippedAreaRatio: Math.max(0, clipped.right - clipped.left) * Math.max(0, clipped.bottom - clipped.top) / Math.max(1, (raw.right - raw.left) * (raw.bottom - raw.top))
    };
  }
  return {
    cardCanvas: CARD_CANVAS,
    dogContentRect: DOG_CONTENT_RECT,
    dogIconScale: DOG_ICON_SCALE,
    dogIconFitMode: DOG_ICON_FIT_MODE,
    sourceToCardScale: fit,
    drawnRect: draw,
    visibleContent
  };
}

async function readZipJson(entries, name) {
  const data = entries.get(name);
  if (!data) return null;
  try { return JSON.parse(Buffer.from(data).toString('utf8')); }
  catch { return null; }
}

async function diagnoseEnemy(enemyId) {
  const key = `enemy:${Number(enemyId)}`;
  const actorIndex = await readJson('public/assets/generated/bcu-actor-index.json', { entries: [], byKey: {} });
  const iconIndex = await readJson('public/assets/generated/bcu-icon-index.json', { entries: [], byKey: {} });
  const actorEntry = actorIndex.byKey?.[key] || actorIndex.entries?.find((e) => e.key === key) || null;
  const iconEntry = iconIndex.byKey?.[key] || iconIndex.entries?.find((e) => e.key === key) || null;
  const selectedFiles = selectedActorFiles(actorEntry) || {};

  const zip = await readStoreZipEntries(ENEMY_ICON_ZIP);
  const internalPath = `enemy/${Number(enemyId)}.png`;
  const zipPng = zip.get(internalPath) || null;
  const zipBundleJson = await readZipJson(zip, 'bundle.json');
  const zipValidation = zipPng ? validatePngBuffer(zipPng, PNG_OPTIONS) : { valid: false, reason: 'missing-zip-entry' };
  const zipDecoded = zipPng ? safeDecodePng(zipPng) : null;
  const zipAlphaBBox = zipDecoded?.rgba ? alphaBBox(zipDecoded) : null;

  const sourcePngValidation = iconEntry?.sourcePath
    ? await validatePngFile(iconEntry.sourcePath, PNG_OPTIONS).catch((error) => ({ valid: false, reason: error?.message || String(error) }))
    : null;

  const generated = actorEntry
    ? await generateEnemyIconForEntry({ enemyId: Number(enemyId), entry: actorEntry, allowlisted: false })
    : null;
  const generatedPng = generated?.png || null;
  const generatedValidation = generatedPng ? validatePngBuffer(generatedPng, PNG_OPTIONS) : null;
  const generatedDecoded = generatedPng ? safeDecodePng(generatedPng) : null;
  const generatedAlphaBBox = generatedDecoded?.rgba ? alphaBBox(generatedDecoded) : null;

  const zipSha = zipPng ? sha256(zipPng) : null;
  const generatedSha = generatedPng ? sha256(generatedPng) : null;

  const findings = [];
  if (!actorEntry) findings.push({ severity: 'error', code: 'missing-actor-index-entry', message: `${key} is not present in bcu-actor-index.json.` });
  if (!zipPng) findings.push({ severity: 'error', code: 'missing-runtime-icon-zip-entry', message: `${internalPath} is not present in ${ENEMY_ICON_ZIP}.` });
  if (zipValidation?.valid && (zipValidation.width < 256 || zipValidation.height < 256)) findings.push({ severity: 'error', code: 'runtime-icon-low-resolution', message: `Runtime production card icon is ${zipValidation.width}x${zipValidation.height}.` });
  if (generatedValidation?.valid && zipValidation?.valid && zipSha !== generatedSha) findings.push({ severity: 'warn', code: 'runtime-icon-differs-from-actor-generated-512', message: 'enemy.zip entry does not match actor-assets-initial-pose generation output.' });
  if (generated?.status !== 'generated') findings.push({ severity: 'error', code: 'actor-icon-generation-failed', message: generated?.failureReason || 'actor icon generation did not produce a PNG.' });
  if (zipAlphaBBox && zipValidation?.valid) {
    const projection = cardProjectionForIcon(zipValidation.width, zipValidation.height, zipAlphaBBox);
    if (projection.visibleContent?.clipped?.w < 36 || projection.visibleContent?.clipped?.h < 28) {
      findings.push({ severity: 'warn', code: 'card-visible-content-small', message: `Visible alpha content on production card is only ${projection.visibleContent.clipped.w.toFixed(1)}x${projection.visibleContent.clipped.h.toFixed(1)} logical px.` });
    }
    if (projection.visibleContent?.clippedAreaRatio < 0.65) {
      findings.push({ severity: 'warn', code: 'card-content-heavily-clipped', message: `Only ${(projection.visibleContent.clippedAreaRatio * 100).toFixed(1)}% of the icon alpha bbox is visible in the current dog card crop.` });
    }
  }
  if (generated?.compositionMethod === 'single-cut-degraded-fallback') findings.push({ severity: 'warn', code: 'single-cut-fallback', message: 'Actor generated icon is using single-cut degraded fallback instead of composed initial pose.' });
  if (!findings.length) findings.push({ severity: 'info', code: 'no-obvious-data-pipeline-error', message: 'No low-resolution runtime icon or generation mismatch was detected for this enemy. Remaining causes are sampling/crop/art-source limits.' });

  return {
    enemyId: Number(enemyId),
    semanticKey: key,
    actorIndex: actorEntry ? {
      status: actorEntry.status,
      bundleRef: actorEntry.bundleRef || null,
      selectedSourcePack: actorEntry.selected?.sourcePack || null,
      selectedFiles: {
        image: selectedFiles.image || null,
        imgcut: selectedFiles.imgcut || null,
        model: selectedFiles.model || null,
        icon: selectedFiles.icon || null,
        idle: selectedFiles.animations?.idle || null
      }
    } : null,
    iconIndex: iconEntry ? {
      sourcePath: iconEntry.sourcePath || null,
      internalPath: iconEntry.internalPath || null,
      sourceStatus: iconEntry.sourceStatus || null,
      pngValidation: sourcePngValidation
    } : null,
    runtimeZipIcon: {
      zipPath: ENEMY_ICON_ZIP,
      bundleJson: zipBundleJson ? {
        bundleKey: zipBundleJson.bundleKey || null,
        generationSource: zipBundleJson.generationSource || null,
        width: zipBundleJson.width || null,
        height: zipBundleJson.height || null,
        iconCount: zipBundleJson.iconCount || null
      } : null,
      internalPath,
      pngValidation: zipValidation,
      sha256: zipSha,
      alphaBBox: zipAlphaBBox,
      cardProjection: zipValidation?.valid && zipAlphaBBox ? cardProjectionForIcon(zipValidation.width, zipValidation.height, zipAlphaBBox) : null
    },
    actorGenerated512: generated ? {
      status: generated.status,
      iconGenerationSource: generated.iconGenerationSource || null,
      compositionMethod: generated.compositionMethod || null,
      sourceImagePath: generated.sourceImagePath || null,
      sourceImgcutPath: generated.sourceImgcutPath || null,
      sourceMamodelPath: generated.sourceMamodelPath || null,
      sourceMaanimPath: generated.sourceMaanimPath || null,
      selectedFrame: generated.selectedFrame ?? null,
      outputSize: generated.outputSize ?? null,
      composedBounds: generated.composedBounds || null,
      selectedCut: generated.selectedCut || null,
      fallbackReason: generated.fallbackReason || null,
      partsRendered: generated.partsRendered ?? null,
      pngValidation: generatedValidation,
      sha256: generatedSha,
      alphaBBox: generatedAlphaBBox,
      cardProjection: generatedValidation?.valid && generatedAlphaBBox ? cardProjectionForIcon(generatedValidation.width, generatedValidation.height, generatedAlphaBBox) : null,
      failureClass: generated.failureClass || null,
      failureReason: generated.failureReason || null
    } : null,
    comparison: {
      runtimeZipMatchesActorGenerated512: !!zipSha && !!generatedSha && zipSha === generatedSha,
      runtimeZipDimensions: zipValidation?.valid ? `${zipValidation.width}x${zipValidation.height}` : null,
      generatedDimensions: generatedValidation?.valid ? `${generatedValidation.width}x${generatedValidation.height}` : null
    },
    findings
  };
}

async function main() {
  const enemyArg = parseArg('--enemy') || parseArg('-e');
  if (!enemyArg) {
    console.error('Usage: node scripts/diagnose-production-card-icon-quality.mjs --enemy <enemyId>');
    process.exit(2);
  }
  const report = await diagnoseEnemy(Number(enemyArg));
  await fs.mkdir('tmp', { recursive: true });
  const out = `tmp/production-card-icon-quality-enemy-${Number(enemyArg)}.json`;
  await fs.writeFile(out, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ output: out, enemyId: report.enemyId, comparison: report.comparison, findings: report.findings }, null, 2));
}

await main();
