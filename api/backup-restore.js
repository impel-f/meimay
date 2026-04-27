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

async function registerRestoreKey(db, uid, body) {
  const keyHash = hashRestoreKey(body.restoreKey);
  const previousKeyHash = body.previousRestoreKey ? hashRestoreKey(body.previousRestoreKey) : '';
  const keyRef = db.collection('backupRestoreKeys').doc(keyHash);

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

    if (previousRef && previousSnap) {
      if (previousSnap.exists && String((previousSnap.data() || {}).ownerUid || '') === uid) {
        tx.delete(previousRef);
      }
    }
  });

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

  await keyRef.set({
    lastUsedAt: FieldValue.serverTimestamp(),
    lastUsedByUid: uid
  }, { merge: true });

  return {
    ok: true,
    backup,
    summary: summarizeBackup(backup)
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
