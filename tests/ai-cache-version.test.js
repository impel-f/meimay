const assert = require('node:assert/strict');
const test = require('node:test');

const { MODEL_CACHE_VERSION } = require('../api/_lib/gemini-models');
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
