function normalizePremiumString(value, maxLength = 2000) {
  const text = String(value || '').trim();
  if (!text || text.length > maxLength) return '';
  return text;
}

function readPremiumDateMs(value) {
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
  const expiresAtMs = readPremiumDateMs(data.appStoreExpiresAt || data.premiumExpiresAt || data.trialEndsAt);
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

  const roomCode = normalizePremiumString(selfData.pairRoomCode || selfData.roomCode, 64).toUpperCase();
  if (!roomCode) return { active: false, source: '' };

  const roomRef = db.collection('rooms').doc(roomCode);
  const roomSnap = await tx.get(roomRef);
  if (!roomSnap.exists) return { active: false, source: '' };

  const roomData = roomSnap.data() || {};
  const members = [roomData.memberAUid, roomData.memberBUid]
    .map((value) => normalizePremiumString(value, 128))
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

module.exports = {
  hasPremiumAccess,
  isPremiumActive,
  readPremiumDateMs,
};
