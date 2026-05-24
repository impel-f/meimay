const crypto = require('crypto');
const { FieldValue, getAdminFirestore, verifyRequestAuth } = require('./_lib/firebase-admin');

const RESTORE_KEY_NAMESPACE = 'meimay-backup-restore-v1';
const RESTORE_KEY_LENGTH = 16;

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
    details: details || error
  });
}

function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body !== 'string' || !req.body.trim()) return {};
  try {
    return JSON.parse(req.body);
  } catch (error) {
    return {};
  }
}

function normalizeRestoreKey(value) {
  return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function assertRestoreKey(value) {
  const key = normalizeRestoreKey(value);
  if (key.length !== RESTORE_KEY_LENGTH) {
    const error = new Error('Restore key must be 16 characters.');
    error.statusCode = 400;
    error.code = 'invalid_restore_key';
    throw error;
  }
  return key;
}

function hashRestoreKey(value) {
  const key = assertRestoreKey(value);
  return crypto
    .createHash('sha256')
    .update(`${RESTORE_KEY_NAMESPACE}:${key}`)
    .digest('hex');
}

function summarizeBackup(backup) {
  return {
    likedCount: Array.isArray(backup?.liked) ? backup.liked.length : Number(backup?.likedCount) || 0,
    savedNamesCount: Array.isArray(backup?.savedNames) ? backup.savedNames.length : Number(backup?.savedNamesCount) || 0,
    readingStockCount: Array.isArray(backup?.readingStock) ? backup.readingStock.length : Number(backup?.readingStockCount) || 0,
    hasWorkspaceState: !!(backup?.meimayStateV2 || backup?.childWorkspaceStateV2 || backup?.stateV2)
  };
}

function sanitizeJsonValue(value) {
  if (value == null) return value;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch (error) {
    return null;
  }
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

function normalizeDateValue(value) {
  const ms = readDateMs(value);
  return ms ? new Date(ms) : null;
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
  const premiumSource = String(data.premiumSource || '').trim().toLowerCase();
  const status = String(data.trialStatus || data.subscriptionStatus || data.premiumStatus || '').trim().toLowerCase();
  const endsAtMs = readDateMs(data.trialEndsAt || data.premiumExpiresAt);
  return data.isPremium === true
    && (premiumSource === 'trial' || status === 'trialing' || status === 'active')
    && endsAtMs > nowMs;
}

function hasConsumedTrial(data) {
  if (!data || typeof data !== 'object') return false;
  if (data.trialConsumedAt || data.trialStartedAt) return true;
  const premiumSource = String(data.premiumSource || '').trim().toLowerCase();
  const status = String(data.trialStatus || '').trim().toLowerCase();
  return premiumSource === 'trial'
    || status === 'active'
    || status === 'trialing'
    || status === 'expired'
    || status === 'consumed';
}

function buildTrialUsageRestore(uid, ownerUid, ownerData, targetData, now) {
  if (!hasConsumedTrial(ownerData)) return null;

  const nowMs = now.getTime();
  const ownerTrialActive = isTrialActive(ownerData, nowMs);
  const targetPaidActive = isPaidPremiumActive(targetData, nowMs);
  const targetTrialActive = isTrialActive(targetData, nowMs);
  const restoredStartedAt = normalizeDateValue(ownerData.trialStartedAt || ownerData.trialConsumedAt) || now;
  const restoredConsumedAt = normalizeDateValue(ownerData.trialConsumedAt || ownerData.trialStartedAt) || now;
  const patch = {
    trialStartedAt: targetData.trialStartedAt || restoredStartedAt,
    trialConsumedAt: targetData.trialConsumedAt || restoredConsumedAt,
    trialSource: targetData.trialSource || 'restore_key',
    trialRestoredAt: FieldValue.serverTimestamp(),
    trialRestoredFromUid: ownerUid || null,
    updatedAt: FieldValue.serverTimestamp()
  };

  if (ownerTrialActive && !targetPaidActive && !targetTrialActive) {
    const restoredEndsAt = normalizeDateValue(ownerData.trialEndsAt || ownerData.premiumExpiresAt);
    if (restoredEndsAt && restoredEndsAt.getTime() > nowMs) {
      patch.isPremium = true;
      patch.premiumSource = 'trial';
      patch.subscriptionStatus = 'trialing';
      patch.premiumStatus = 'trialing';
      patch.premiumExpiresAt = restoredEndsAt;
      patch.trialStatus = 'active';
      patch.trialEndsAt = restoredEndsAt;
      return {
        patch,
        mode: uid === ownerUid ? 'self_active_trial_kept' : 'active_trial_restored'
      };
    }
  }

  if (targetTrialActive) {
    patch.trialStatus = targetData.trialStatus || 'active';
    return { patch, mode: 'target_active_trial_kept' };
  }

  patch.trialStatus = targetPaidActive ? (targetData.trialStatus || 'consumed') : 'consumed';
  return {
    patch,
    mode: uid === ownerUid ? 'self_trial_consumed_kept' : 'trial_consumed_restored'
  };
}

function normalizeRoomCode(value) {
  const roomCode = String(value || '').trim().toUpperCase();
  return roomCode || null;
}

function normalizeBackupRegisterPatch(body) {
  const backup = sanitizeJsonValue(body.meimayBackup || body.backup || null);
  if (!backup || typeof backup !== 'object' || Array.isArray(backup)) {
    return null;
  }

  const fingerprint = String(
    body.meimayBackupFingerprint
    || body.backupFingerprint
    || backup.fingerprint
    || ''
  ).trim();
  const pairRoomCode = normalizeRoomCode(body.pairRoomCode || body.roomCode);
  const sanitizedHiddenReadings = Array.isArray(body.hiddenReadings)
    ? sanitizeJsonValue(body.hiddenReadings)
    : [];
  const hiddenReadings = Array.isArray(sanitizedHiddenReadings)
    ? sanitizedHiddenReadings.filter(Boolean)
    : [];
  const patch = {
    meimayBackup: backup,
    backup,
    meimayBackupUpdatedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  };

  if (fingerprint) patch.meimayBackupFingerprint = fingerprint;
  patch.pairRoomCode = pairRoomCode;
  patch.roomCode = pairRoomCode;
  patch.hiddenReadings = hiddenReadings;

  return patch;
}

async function registerRestoreKey(db, uid, body) {
  const keyHash = hashRestoreKey(body.restoreKey);
  const previousKeyHash = body.previousRestoreKey ? hashRestoreKey(body.previousRestoreKey) : '';
  const keyRef = db.collection('backupRestoreKeys').doc(keyHash);
  const userBackupPatch = normalizeBackupRegisterPatch(body);

  try {
    await db.runTransaction(async (tx) => {
      const keySnap = await tx.get(keyRef);
      const previousRef = previousKeyHash && previousKeyHash !== keyHash
        ? db.collection('backupRestoreKeys').doc(previousKeyHash)
        : null;
      const previousSnap = previousRef ? await tx.get(previousRef) : null;
      if (keySnap.exists) {
        const keyData = keySnap.data() || {};
        const ownerUid = String(keyData.ownerUid || '').trim();
        if (ownerUid && ownerUid !== uid) {
          throw Object.assign(new Error('Restore key collision.'), {
            statusCode: 409,
            code: 'restore_key_collision'
          });
        }
      }

      tx.set(keyRef, {
        ownerUid: uid,
        schemaVersion: 1,
        createdAt: keySnap.exists ? keySnap.data().createdAt || FieldValue.serverTimestamp() : FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });

      if (userBackupPatch) {
        tx.set(db.collection('users').doc(uid), userBackupPatch, { merge: true });
      }

      if (previousRef && previousSnap) {
        if (previousSnap.exists && String((previousSnap.data() || {}).ownerUid || '') === uid) {
          tx.delete(previousRef);
        }
      }
    });
  } catch (error) {
    if (error?.code === 'restore_key_collision') throw error;
    if (userBackupPatch) {
      throw Object.assign(new Error('Backup sync failed.'), {
        statusCode: 500,
        code: 'backup_sync_failed'
      });
    }
    throw error;
  }

  return { ok: true, registered: true };
}

async function restoreBackupByKey(db, uid, body) {
  const keyHash = hashRestoreKey(body.restoreKey);
  const keyRef = db.collection('backupRestoreKeys').doc(keyHash);
  const keySnap = await keyRef.get();

  if (!keySnap.exists) {
    throw Object.assign(new Error('Restore key was not found.'), {
      statusCode: 404,
      code: 'restore_key_not_found'
    });
  }

  const keyData = keySnap.data() || {};
  const ownerUid = String(keyData.ownerUid || '').trim();
  if (!ownerUid) {
    throw Object.assign(new Error('Restore key has no owner.'), {
      statusCode: 404,
      code: 'restore_key_not_found'
    });
  }

  const ownerSnap = await db.collection('users').doc(ownerUid).get();
  const ownerData = ownerSnap.exists ? ownerSnap.data() || {} : {};
  const backup = ownerData.meimayBackup || ownerData.backup || null;

  if (!backup || typeof backup !== 'object') {
    throw Object.assign(new Error('Backup is not available yet.'), {
      statusCode: 404,
      code: 'no_backup_available'
    });
  }

  const targetRef = db.collection('users').doc(uid);
  const targetSnap = ownerUid === uid ? ownerSnap : await targetRef.get();
  const targetData = targetSnap.exists ? targetSnap.data() || {} : {};
  const trialUsageRestore = buildTrialUsageRestore(uid, ownerUid, ownerData, targetData, new Date());

  const writes = [
    keyRef.set({
      lastUsedAt: FieldValue.serverTimestamp(),
      lastUsedByUid: uid
    }, { merge: true })
  ];
  if (trialUsageRestore?.patch) {
    writes.push(targetRef.set(trialUsageRestore.patch, { merge: true }));
  }
  await Promise.all(writes);

  return {
    ok: true,
    backup,
    summary: summarizeBackup(backup),
    trialUsageRestored: !!trialUsageRestore,
    trialRestoreMode: trialUsageRestore?.mode || null
  };
}

async function deleteUserBackupData(db, uid) {
  const keySnap = await db.collection('backupRestoreKeys')
    .where('ownerUid', '==', uid)
    .get();
  const refs = keySnap.docs.map((doc) => doc.ref);
  refs.push(db.collection('users').doc(uid));

  for (let i = 0; i < refs.length; i += 450) {
    const batch = db.batch();
    refs.slice(i, i + 450).forEach((ref) => batch.delete(ref));
    await batch.commit();
  }

  return {
    ok: true,
    deletedUserBackup: true,
    deletedRestoreKeys: keySnap.size
  };
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
  const body = readBody(req);
  const action = String(body.action || '').trim();

  try {
    if (action === 'register') {
      const result = await registerRestoreKey(db, uid, body);
      return res.status(200).json(result);
    }
    if (action === 'restore') {
      const result = await restoreBackupByKey(db, uid, body);
      return res.status(200).json(result);
    }
    if (action === 'delete-user-backup') {
      const result = await deleteUserBackupData(db, uid);
      return res.status(200).json(result);
    }
    return buildErrorResponse(res, 400, 'invalid_action');
  } catch (error) {
    return buildErrorResponse(
      res,
      Number(error?.statusCode) || 500,
      error?.code || 'backup_restore_failed',
      error?.message || 'Backup restore failed.'
    );
  }
};
