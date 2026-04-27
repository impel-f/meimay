const { FieldValue, getAdminFirestore, verifyRequestAuth } = require('./_lib/firebase-admin');

const TRIAL_DURATION_MS = 3 * 24 * 60 * 60 * 1000;

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
}

function normalizeRoomCode(value) {
  return String(value || '').trim().toUpperCase();
}

function readDateMs(value) {
  if (!value) return 0;
  if (typeof value.toDate === 'function') {
    const date = value.toDate();
    return Number.isNaN(date.getTime()) ? 0 : date.getTime();
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? 0 : value.getTime();
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }
  if (typeof value === 'string') {
    const time = new Date(value).getTime();
    return Number.isFinite(time) ? time : 0;
  }
  return 0;
}

function isPaidPremiumActive(data, nowMs) {
  if (!data || typeof data !== 'object') return false;
  const premiumSource = String(data.premiumSource || '').trim().toLowerCase();
  const status = String(data.subscriptionStatus || data.premiumStatus || '').trim().toLowerCase();
  const productId = String(data.appStoreProductId || data.premiumProductId || '').trim();
  if (premiumSource === 'trial') return false;
  if (!premiumSource && !productId && status !== 'active') return false;
  if (status && status !== 'active') return false;
  const expiresAtMs = readDateMs(data.appStoreExpiresAt || data.premiumExpiresAt);
  return data.isPremium === true && (!expiresAtMs || expiresAtMs > nowMs);
}

function isTrialActive(data, nowMs) {
  if (!data || typeof data !== 'object') return false;
  const status = String(data.trialStatus || data.subscriptionStatus || data.premiumStatus || '').trim().toLowerCase();
  const endsAtMs = readDateMs(data.trialEndsAt || data.premiumExpiresAt);
  return data.isPremium === true
    && (data.premiumSource === 'trial' || status === 'trialing')
    && endsAtMs > nowMs;
}

function hasConsumedTrial(data) {
  if (!data || typeof data !== 'object') return false;
  if (data.trialConsumedAt || data.trialStartedAt) return true;
  const status = String(data.trialStatus || '').trim().toLowerCase();
  return status === 'active' || status === 'trialing' || status === 'expired' || status === 'consumed';
}

function summarizeTarget(uid, data, nowMs) {
  return {
    uid,
    paidActive: isPaidPremiumActive(data, nowMs),
    trialActive: isTrialActive(data, nowMs),
    trialConsumed: hasConsumedTrial(data)
  };
}

function buildTrialUpdate(now, endsAt) {
  return {
    isPremium: true,
    premiumSource: 'trial',
    subscriptionStatus: 'trialing',
    premiumStatus: 'trialing',
    premiumExpiresAt: endsAt,
    trialStatus: 'active',
    trialStartedAt: now,
    trialEndsAt: endsAt,
    trialConsumedAt: now,
    trialSource: 'manual_3_day',
    trialRoomCode: null,
    trialConsumedByRoom: false,
    updatedAt: FieldValue.serverTimestamp()
  };
}

function buildErrorResponse(res, statusCode, error, details = '') {
  return res.status(statusCode).json({
    ok: false,
    error,
    details: details || error
  });
}

module.exports = async (req, res) => {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return buildErrorResponse(res, 405, 'method_not_allowed');
  }

  let auth;
  try {
    auth = await verifyRequestAuth(req);
  } catch (error) {
    return buildErrorResponse(res, Number(error?.statusCode) || 401, 'authentication_failed', error?.message);
  }

  const uid = String(auth?.uid || '').trim();
  if (!uid) {
    return buildErrorResponse(res, 401, 'authentication_failed', 'Firebase UID is missing.');
  }

  const db = getAdminFirestore();
  const requestedRoomCode = normalizeRoomCode(req.body?.roomCode);

  try {
    const result = await db.runTransaction(async (tx) => {
      let roomCode = '';
      let premiumContextUids = [uid];

      if (requestedRoomCode) {
        const roomRef = db.collection('rooms').doc(requestedRoomCode);
        const roomSnap = await tx.get(roomRef);
        if (roomSnap.exists) {
          const roomData = roomSnap.data() || {};
          const memberUids = [roomData.memberAUid, roomData.memberBUid]
            .map((value) => String(value || '').trim())
            .filter(Boolean);
          if (memberUids.includes(uid)) {
            roomCode = requestedRoomCode;
            premiumContextUids = [...new Set(memberUids)];
          }
        }
      }

      const userRefs = premiumContextUids.map((targetUid) => db.collection('users').doc(targetUid));
      const userSnaps = await Promise.all(userRefs.map((ref) => tx.get(ref)));
      const now = new Date();
      const nowMs = now.getTime();
      const summaries = userSnaps.map((snap, index) => summarizeTarget(premiumContextUids[index], snap.data() || {}, nowMs));
      const selfSummary = summaries.find((summary) => summary.uid === uid) || summaries[0];

      if (summaries.some((summary) => summary.paidActive)) {
        return {
          status: 'paid_active',
          roomCode,
          targetCount: 1
        };
      }

      if (selfSummary?.trialActive) {
        return {
          status: 'trial_active',
          roomCode,
          targetCount: 1
        };
      }

      if (selfSummary?.trialConsumed) {
        return {
          status: 'trial_unavailable',
          roomCode,
          targetCount: 1
        };
      }

      const endsAt = new Date(nowMs + TRIAL_DURATION_MS);
      const update = buildTrialUpdate(now, endsAt);
      tx.set(db.collection('users').doc(uid), update, { merge: true });

      return {
        status: 'started',
        roomCode,
        targetCount: 1,
        consumesRoom: false,
        trialStartedAt: now.toISOString(),
        trialEndsAt: endsAt.toISOString()
      };
    });

    return res.status(200).json({ ok: true, ...result });
  } catch (error) {
    return buildErrorResponse(
      res,
      Number(error?.statusCode) || 500,
      error?.code || 'premium_trial_failed',
      error?.message || 'Premium trial failed.'
    );
  }
};
