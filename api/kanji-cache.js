const { MODEL_CACHE_VERSION } = require('./_lib/gemini-models');

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function isNonEmptyString(value, maxLength = 2000) {
  return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= maxLength;
}

function normalizeEnvText(value) {
  if (typeof value !== 'string') return value;
  return value.trim();
}

function normalizePrivateKey(value) {
  if (typeof value !== 'string') return value;
  let normalized = value.trim();

  if (
    (normalized.startsWith('"') && normalized.endsWith('"')) ||
    (normalized.startsWith("'") && normalized.endsWith("'"))
  ) {
    normalized = normalized.slice(1, -1).trim();
  }

  return normalized
    .replace(/\\r\\n/g, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');
}

function getServiceAccountConfig() {
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (typeof serviceAccountJson === 'string' && serviceAccountJson.trim()) {
    const parsed = JSON.parse(serviceAccountJson);
    return {
      projectId: normalizeEnvText(parsed.project_id || parsed.projectId),
      clientEmail: normalizeEnvText(parsed.client_email || parsed.clientEmail),
      privateKey: normalizePrivateKey(parsed.private_key || parsed.privateKey),
    };
  }

  return {
    projectId: normalizeEnvText(process.env.FIREBASE_PROJECT_ID),
    clientEmail: normalizeEnvText(process.env.FIREBASE_CLIENT_EMAIL),
    privateKey: normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY),
  };
}

function getFirebaseAdminApp() {
  const { cert, getApps, initializeApp } = require('firebase-admin/app');
  const existingApps = getApps();
  if (existingApps.length > 0) return existingApps[0];

  const config = getServiceAccountConfig();
  if (!(config.projectId && config.clientEmail && config.privateKey)) {
    const error = new Error(
      'Firebase Admin credentials are not configured. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY.'
    );
    error.statusCode = 500;
    throw error;
  }

  return initializeApp({
    credential: cert(config),
  });
}

function getAdminFirestore() {
  const { getFirestore } = require('firebase-admin/firestore');
  return getFirestore(getFirebaseAdminApp());
}

function getFieldValue() {
  const { FieldValue } = require('firebase-admin/firestore');
  return FieldValue;
}

function getAdminAuth() {
  const { getAuth } = require('firebase-admin/auth');
  return getAuth(getFirebaseAdminApp());
}

function readBearerToken(req) {
  const header = req.headers.authorization || req.headers.Authorization;
  if (typeof header !== 'string') return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

async function verifyRequestAuth(req) {
  const token = readBearerToken(req);
  if (!token) {
    const error = new Error('Authentication required');
    error.statusCode = 401;
    throw error;
  }

  try {
    return await getAdminAuth().verifyIdToken(token);
  } catch (authError) {
    const error = new Error('Invalid Firebase ID token');
    error.statusCode = 401;
    error.cause = authError;
    throw error;
  }
}

function buildErrorResponse(res, error, fallbackMessage) {
  const statusCode = Number(error?.statusCode) || 500;
  const payload = {
    error: fallbackMessage,
    details: error?.message || fallbackMessage,
  };

  if (error?.code) payload.code = error.code;
  if (error?.cause?.message) payload.cause = error.cause.message;

  return res.status(statusCode).json(payload);
}

function buildVersionedCacheDocId(parts) {
  return encodeURIComponent(parts.map((part) => String(part || '').trim()).join('__'));
}

module.exports = async (req, res) => {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { action, kanji, reading, text } = req.body || {};
  const normalizedKanji = typeof kanji === 'string' ? kanji.trim() : '';
  const normalizedReading = typeof reading === 'string' ? reading.trim() : '';
  const normalizedText = typeof text === 'string' ? text.trim() : '';
  const normalizedPromptVersion = typeof req.body?.promptVersion === 'string'
    ? req.body.promptVersion.trim()
    : '';
  const normalizedReadingPromptVersion = typeof req.body?.readingPromptVersion === 'string'
    ? req.body.readingPromptVersion.trim()
    : normalizedPromptVersion;
  const normalizedModelCacheVersion = typeof req.body?.modelCacheVersion === 'string'
    ? req.body.modelCacheVersion.trim()
    : '';
  const normalizedModelName = typeof req.body?.modelName === 'string'
    ? req.body.modelName.trim()
    : '';

  if (!isNonEmptyString(action, 40) || !isNonEmptyString(normalizedKanji, 64)) {
    return res.status(400).json({ error: 'Invalid cache request' });
  }

  try {
    const db = getAdminFirestore();

    try {
      await verifyRequestAuth(req);
    } catch (error) {
      return buildErrorResponse(res, error, 'Authentication failed');
    }

    if (!normalizedPromptVersion || normalizedPromptVersion.length > 120) {
      return res.status(400).json({ error: 'Prompt version is required' });
    }
    if (normalizedModelCacheVersion !== MODEL_CACHE_VERSION) {
      return res.status(409).json({
        error: 'Model cache version is stale',
        modelCacheVersion: MODEL_CACHE_VERSION,
      });
    }

    const baseDocId = buildVersionedCacheDocId([
      normalizedKanji,
      normalizedPromptVersion,
      normalizedModelCacheVersion,
    ]);
    const readingDocId = normalizedReading
      ? buildVersionedCacheDocId([
        normalizedKanji,
        normalizedReading,
        normalizedReadingPromptVersion,
        normalizedModelCacheVersion,
      ])
      : '';

    if (action === 'delete') {
      const warnings = [];

      await Promise.all([
        db.collection('kanji_ai_explanations').doc(baseDocId).delete(),
        db.collection('kanji_ai_explanations').doc(normalizedKanji).delete(),
      ]);

      if (isNonEmptyString(normalizedReading, 256)) {
        const legacyDocId = encodeURIComponent(`${normalizedKanji}__${normalizedReading}`);
        try {
          await Promise.all([
            db.collection('kanji_ai_reading_explanations').doc(readingDocId).delete(),
            db.collection('kanji_ai_reading_explanations').doc(legacyDocId).delete(),
          ]);
        } catch (readingDeleteError) {
          warnings.push(`Reading cache delete failed: ${readingDeleteError.message}`);
          console.warn('KANJI_CACHE_DELETE: reading doc delete failed', {
            kanji: normalizedKanji,
            reading: normalizedReading,
            error: readingDeleteError,
          });
        }
      }

      return res.status(200).json(warnings.length > 0 ? { ok: true, warnings } : { ok: true });
    }

    if (action === 'saveBase') {
      if (!isNonEmptyString(normalizedText, 12000)) {
        return res.status(400).json({ error: 'Base cache text is required' });
      }

      const FieldValue = getFieldValue();
      const payload = {
        text: normalizedText,
        kanji: normalizedKanji,
        promptVersion: normalizedPromptVersion,
        modelCacheVersion: normalizedModelCacheVersion,
        modelName: normalizedModelName || null,
        updatedAt: FieldValue.serverTimestamp(),
      };
      await db.collection('kanji_ai_explanations').doc(baseDocId).set(payload, { merge: true });

      return res.status(200).json({ ok: true, docId: baseDocId });
    }

    if (action === 'saveReading') {
      if (!isNonEmptyString(normalizedReading, 256) || !isNonEmptyString(normalizedText, 12000)) {
        return res.status(400).json({ error: 'Reading cache payload is invalid' });
      }

      const FieldValue = getFieldValue();
      await db.collection('kanji_ai_reading_explanations').doc(readingDocId).set({
        kanji: normalizedKanji,
        reading: normalizedReading,
        text: normalizedText,
        promptVersion: normalizedPromptVersion,
        modelCacheVersion: normalizedModelCacheVersion,
        modelName: normalizedModelName || null,
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });

      return res.status(200).json({ ok: true, docId: readingDocId });
    }

    return res.status(400).json({ error: 'Unsupported cache action' });
  } catch (error) {
    console.error('KANJI_CACHE: operation failed', {
      action,
      kanji: normalizedKanji,
      reading: normalizedReading,
      error,
    });
    return buildErrorResponse(res, error, 'Cache operation failed');
  }
};

module.exports._test = {
  buildVersionedCacheDocId,
};
