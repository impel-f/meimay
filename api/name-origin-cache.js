const crypto = require('crypto');
const { FieldValue, getAdminFirestore, verifyRequestAuth } = require('./_lib/firebase-admin');
const { hasPremiumAccess } = require('./_lib/premium-access');
const {
  MODEL_CACHE_VERSION,
  isKnownModelCacheVersion,
  modelNameMatchesCacheVersion,
} = require('./_lib/gemini-models');

const DAILY_NAME_ORIGIN_LIMIT = 1;
const NAME_ORIGIN_USAGE_COLLECTION = 'name_origin_daily_usage';

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
}

function buildErrorResponse(res, statusCode, error, details = '') {
  return res.status(statusCode).json({
    ok: false,
    error,
    details: details || error,
  });
}

function normalizeString(value, maxLength = 2000) {
  const text = String(value || '').trim();
  if (!text || text.length > maxLength) return '';
  return text;
}

function buildNameOriginDocId(cacheKey, promptVersion, modelCacheVersion) {
  return crypto
    .createHash('sha256')
    .update([cacheKey, promptVersion, modelCacheVersion].join('\n'), 'utf8')
    .digest('hex');
}

function validateOriginCacheRequest(body) {
  const cacheKey = normalizeString(body.cacheKey, 2000);
  const promptVersion = normalizeString(body.promptVersion, 120);
  const modelCacheVersion = normalizeString(body.modelCacheVersion, 120);
  if (!cacheKey || !promptVersion) {
    const error = new Error('Origin cache key and prompt version are required.');
    error.statusCode = 400;
    error.code = 'invalid_origin_cache_request';
    throw error;
  }
  if (!isKnownModelCacheVersion(modelCacheVersion)) {
    const error = new Error('Model cache version is not supported.');
    error.statusCode = 409;
    error.code = 'stale_model_cache_version';
    throw error;
  }
  return {
    cacheKey,
    promptVersion,
    modelCacheVersion,
    docId: buildNameOriginDocId(cacheKey, promptVersion, modelCacheVersion),
  };
}

async function verifyCacheRequestAuth(req) {
  try {
    return await verifyRequestAuth(req);
  } catch (error) {
    error.statusCode = Number(error?.statusCode) || 401;
    error.code = 'authentication_failed';
    throw error;
  }
}

async function handleGetOrigin(db, req, res) {
  await verifyCacheRequestAuth(req);
  const cache = validateOriginCacheRequest(req.body || {});
  const snapshot = await db.collection('name_origin_explanations').doc(cache.docId).get();
  const data = snapshot.exists ? (snapshot.data() || {}) : {};
  const current = data.promptVersion === cache.promptVersion
    && data.modelCacheVersion === cache.modelCacheVersion;
  return res.status(200).json({
    ok: true,
    hit: current && !!normalizeString(data.text, 12000),
    text: current ? normalizeString(data.text, 12000) : '',
    modelName: current ? normalizeString(data.modelName, 120) : '',
  });
}

async function handleSaveOrigin(db, req, res) {
  await verifyCacheRequestAuth(req);
  const cache = validateOriginCacheRequest(req.body || {});
  const text = normalizeString(req.body?.text, 12000);
  const modelName = normalizeString(req.body?.modelName, 120);
  if (!text) return buildErrorResponse(res, 400, 'invalid_origin_text');
  if (!modelNameMatchesCacheVersion(modelName, cache.modelCacheVersion)) {
    return buildErrorResponse(res, 400, 'model_cache_mismatch');
  }

  await db.collection('name_origin_explanations').doc(cache.docId).set({
    text,
    promptVersion: cache.promptVersion,
    modelCacheVersion: cache.modelCacheVersion,
    modelName: modelName || null,
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  return res.status(200).json({ ok: true, docId: cache.docId });
}

async function handleDeleteOrigin(db, req, res) {
  await verifyCacheRequestAuth(req);
  const cache = validateOriginCacheRequest(req.body || {});
  await db.collection('name_origin_explanations').doc(cache.docId).delete();
  return res.status(200).json({ ok: true });
}

function getJstDateKey(date = new Date()) {
  return new Date(date.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

async function handleConsumeDaily(db, req, res) {
  let auth;
  try {
    auth = await verifyRequestAuth(req);
  } catch (error) {
    return buildErrorResponse(res, Number(error?.statusCode) || 401, 'authentication_failed', error?.message);
  }

  const uid = normalizeString(auth?.uid, 128);
  if (!uid) {
    return buildErrorResponse(res, 401, 'authentication_failed', 'Firebase UID is missing.');
  }

  const result = await db.runTransaction(async (tx) => {
    const now = new Date();
    const nowMs = now.getTime();
    const premium = await hasPremiumAccess(tx, db, uid, nowMs);
    if (premium.active) {
      return {
        ok: true,
        consumed: false,
        premium: true,
        premiumSource: premium.source,
        limit: null,
        used: 0,
        remaining: null,
      };
    }

    const dateKey = getJstDateKey(now);
    const usageRef = db.collection(NAME_ORIGIN_USAGE_COLLECTION).doc(`${uid}_${dateKey}`);
    const usageSnap = await tx.get(usageRef);
    const currentCount = usageSnap.exists ? Math.max(0, Number((usageSnap.data() || {}).count) || 0) : 0;

    if (currentCount >= DAILY_NAME_ORIGIN_LIMIT) {
      return {
        ok: false,
        code: 'daily_limit_exceeded',
        consumed: false,
        premium: false,
        dateKey,
        limit: DAILY_NAME_ORIGIN_LIMIT,
        used: currentCount,
        remaining: 0,
      };
    }

    const nextCount = currentCount + 1;
    tx.set(usageRef, {
      uid,
      dateKey,
      count: nextCount,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    return {
      ok: true,
      consumed: true,
      premium: false,
      dateKey,
      limit: DAILY_NAME_ORIGIN_LIMIT,
      used: nextCount,
      remaining: Math.max(0, DAILY_NAME_ORIGIN_LIMIT - nextCount),
    };
  });

  if (!result.ok) {
    return res.status(429).json(result);
  }
  return res.status(200).json(result);
}

async function handleRefundDaily(db, req, res) {
  let auth;
  try {
    auth = await verifyRequestAuth(req);
  } catch (error) {
    return buildErrorResponse(res, Number(error?.statusCode) || 401, 'authentication_failed', error?.message);
  }

  const uid = normalizeString(auth?.uid, 128);
  if (!uid) {
    return buildErrorResponse(res, 401, 'authentication_failed', 'Firebase UID is missing.');
  }

  const result = await db.runTransaction(async (tx) => {
    const dateKey = getJstDateKey(new Date());
    const usageRef = db.collection(NAME_ORIGIN_USAGE_COLLECTION).doc(`${uid}_${dateKey}`);
    const usageSnap = await tx.get(usageRef);
    const currentCount = usageSnap.exists ? Math.max(0, Number((usageSnap.data() || {}).count) || 0) : 0;
    const nextCount = Math.max(0, currentCount - 1);

    tx.set(usageRef, {
      uid,
      dateKey,
      count: nextCount,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    return {
      ok: true,
      dateKey,
      used: nextCount,
      remaining: Math.max(0, DAILY_NAME_ORIGIN_LIMIT - nextCount),
    };
  });

  return res.status(200).json(result);
}

module.exports = async (req, res) => {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return buildErrorResponse(res, 405, 'method_not_allowed');
  }

  const body = req.body || {};
  const action = normalizeString(body.action, 40);
  if (!action) {
    return buildErrorResponse(res, 400, 'missing_action');
  }

  try {
    const db = getAdminFirestore();
    if (action === 'getOrigin') return await handleGetOrigin(db, req, res);
    if (action === 'saveOrigin') return await handleSaveOrigin(db, req, res);
    if (action === 'deleteOrigin') return await handleDeleteOrigin(db, req, res);
    if (action === 'consumeDaily') return await handleConsumeDaily(db, req, res);
    if (action === 'refundDaily') return await handleRefundDaily(db, req, res);
    return buildErrorResponse(res, 400, 'unsupported_action');
  } catch (error) {
    console.error('NAME_ORIGIN_CACHE: operation failed', { action, error });
    return buildErrorResponse(
      res,
      Number(error?.statusCode) || 500,
      error?.code || 'name_origin_cache_failed',
      error?.message || 'Name origin cache operation failed.'
    );
  }
};

module.exports._test = {
  buildNameOriginDocId,
  validateOriginCacheRequest,
};
