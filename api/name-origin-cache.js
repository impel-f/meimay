const { FieldValue, getAdminFirestore, verifyRequestAuth } = require('./_lib/firebase-admin');

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

function getJstDateKey(date = new Date()) {
  return new Date(date.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function readDateMs(value) {
  if (!value) return 0;
  if (typeof value.toDate === 'function') {
    const date = value.toDate();
    return Number.isNaN(date.getTime()) ? 0 : date.getTime();
  }
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? 0 : value.getTime();
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const time = new Date(value).getTime();
    return Number.isFinite(time) ? time : 0;
  }
  return 0;
}

function isPremiumActive(data, nowMs, options = {}) {
  if (!data || typeof data !== 'object') return false;
  const status = String(data.subscriptionStatus || data.premiumStatus || '').trim().toLowerCase();
  const trialStatus = String(data.trialStatus || '').trim().toLowerCase();
  const premiumSource = String(data.premiumSource || '').trim().toLowerCase();
  const productId = String(data.appStoreProductId || data.premiumProductId || '').trim();
  const expiresAtMs = readDateMs(data.appStoreExpiresAt || data.premiumExpiresAt || data.trialEndsAt);
  const expiredStatuses = new Set(['expired', 'refunded', 'revoked', 'billing_retry']);
  const expired = (expiresAtMs > 0 && expiresAtMs <= nowMs) || expiredStatuses.has(status);
  const trialLike = premiumSource === 'trial' || status === 'trialing' || trialStatus === 'active';
  const trialActive = options.allowTrial !== false
    && !productId
    && trialLike;

  if (expired) return false;
  if (options.allowTrial === false && trialLike && !productId) return false;
  return data.isPremium === true
    || status === 'active'
    || trialActive
    || Boolean(productId && status !== 'expired');
}

async function hasPremiumAccess(tx, db, uid, nowMs) {
  const selfRef = db.collection('users').doc(uid);
  const selfSnap = await tx.get(selfRef);
  const selfData = selfSnap.exists ? (selfSnap.data() || {}) : {};

  if (isPremiumActive(selfData, nowMs, { allowTrial: true })) {
    return { active: true, source: 'self' };
  }

  const roomCode = normalizeString(selfData.pairRoomCode || selfData.roomCode, 64).toUpperCase();
  if (!roomCode) return { active: false, source: '' };

  const roomRef = db.collection('rooms').doc(roomCode);
  const roomSnap = await tx.get(roomRef);
  if (!roomSnap.exists) return { active: false, source: '' };

  const roomData = roomSnap.data() || {};
  const members = [roomData.memberAUid, roomData.memberBUid]
    .map((value) => normalizeString(value, 128))
    .filter(Boolean);
  if (!members.includes(uid)) return { active: false, source: '' };

  const partnerUid = members.find((value) => value !== uid);
  if (!partnerUid) return { active: false, source: '' };

  const partnerSnap = await tx.get(db.collection('users').doc(partnerUid));
  const partnerData = partnerSnap.exists ? (partnerSnap.data() || {}) : {};
  if (isPremiumActive(partnerData, nowMs, { allowTrial: false })) {
    return { active: true, source: 'partner' };
  }

  return { active: false, source: '' };
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
