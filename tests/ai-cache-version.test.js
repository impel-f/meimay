const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const originSource = fs.readFileSync(
  path.join(__dirname, '..', 'public', 'js', '08-origin.js'),
  'utf8'
);

const {
  MODEL_CACHE_VERSION,
  buildModelCacheVersion,
  isKnownModelCacheVersion,
  modelNameMatchesCacheVersion,
} = require('../api/_lib/gemini-models');
const { buildVersionedCacheDocId } = require('../api/kanji-cache')._test;
const {
  buildNameOriginDocId,
  validateOriginCacheRequest,
} = require('../api/name-origin-cache')._test;

test('kanji Firestore document IDs change with prompt and model generations', () => {
  const current = buildVersionedCacheDocId(['櫂', 'kanji_detail_v2', MODEL_CACHE_VERSION]);
  const oldModel = buildVersionedCacheDocId(['櫂', 'kanji_detail_v2', 'gemini_model_old']);
  const oldPrompt = buildVersionedCacheDocId(['櫂', 'kanji_detail_v1', MODEL_CACHE_VERSION]);

  assert.notEqual(current, oldModel);
  assert.notEqual(current, oldPrompt);
});

test('name origin Firestore document IDs change with the model generation', () => {
  const current = buildNameOriginDocId('正岡__悠葵__ゆうき', 'name_origin_v15', MODEL_CACHE_VERSION);
  const oldModel = buildNameOriginDocId('正岡__悠葵__ゆうき', 'name_origin_v15', 'gemini_model_old');

  assert.match(current, /^[a-f0-9]{64}$/);
  assert.notEqual(current, oldModel);
});

test('name origin cache rejects stale model generations', () => {
  assert.throws(() => validateOriginCacheRequest({
    cacheKey: 'cache-key',
    promptVersion: 'name_origin_v15',
    modelCacheVersion: 'gemini_model_old',
  }), (error) => error?.statusCode === 409 && error?.code === 'stale_model_cache_version');
});

test('known fallback models use isolated cache generations', () => {
  const fallbackVersion = buildModelCacheVersion('gemini-3.6-flash');
  assert.equal(isKnownModelCacheVersion(fallbackVersion), true);
  assert.equal(modelNameMatchesCacheVersion('gemini-3.6-flash', fallbackVersion), true);
  assert.equal(modelNameMatchesCacheVersion('gemini-3.7-flash', fallbackVersion), false);
  assert.equal(validateOriginCacheRequest({
    cacheKey: 'cache-key',
    promptVersion: 'name_origin_v19',
    modelCacheVersion: fallbackVersion,
  }).modelCacheVersion, fallbackVersion);
});

test('client kanji details bypass legacy AI prompt caches and use fixed reviewed data', () => {
  const functionStart = originSource.indexOf('async function generateKanjiDetail');
  const functionEnd = originSource.indexOf('\nfunction renderKanjiDetailText', functionStart);
  const detailFunction = originSource.slice(functionStart, functionEnd);

  assert.match(detailFunction, /await loadKanjiStaticDetails\(\)/);
  assert.match(detailFunction, /detail\.compounds/);
  assert.doesNotMatch(detailFunction, /KANJI_DETAIL_COMPATIBLE_PROMPT_VERSIONS/);
  assert.doesNotMatch(detailFunction, /modelCacheVersion|promptVersion|callGemini/);
});

test('persisted name origins remain visible without regeneration after cache version changes', () => {
  assert.match(originSource, /getNameOriginStoredTextForItem\(item\)[\s\S]*\|\| normalizeNameOriginText\(item\?\.origin\)/);
  const persistedRead = originSource.indexOf('const persistedOriginText = normalizeNameOriginText(target?.origin);');
  const modelMetadataRead = originSource.indexOf('const modelMetadata = await getActiveAiModelMetadata();', persistedRead);
  assert.ok(persistedRead >= 0);
  assert.ok(modelMetadataRead > persistedRead, 'saved origin should render before model/cache lookup');
});

test('the app keeps data licenses out of kanji details and exposes them only in legal settings', () => {
  const indexSource = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
  const drawerSource = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', '13-drawer-wizard.js'), 'utf8');
  const legalSource = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'data', 'legal-docs.js'), 'utf8');
  assert.match(indexSource, /legal-tab-sources/);
  assert.match(legalSource, /JMdict \/ EDRDG/);
  assert.doesNotMatch(drawerSource, /legal-sources|データの出典/);
});
