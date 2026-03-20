const { FieldValue, getAdminFirestore, verifyRequestAuth } = require('./_lib/firebase-admin');

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function isNonEmptyString(value, maxLength = 2000) {
  return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= maxLength;
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

  if (!isNonEmptyString(action, 40) || !isNonEmptyString(normalizedKanji, 64)) {
    return res.status(400).json({ error: 'Invalid cache request' });
  }

  try {
    const db = getAdminFirestore();

    if (action === 'delete') {
      const warnings = [];

      await db.collection('kanji_ai_explanations').doc(normalizedKanji).delete();

      if (isNonEmptyString(normalizedReading, 256)) {
        const docId = encodeURIComponent(`${normalizedKanji}__${normalizedReading}`);
        try {
          await db.collection('kanji_ai_reading_explanations').doc(docId).delete();
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

    try {
      await verifyRequestAuth(req);
    } catch (error) {
      return buildErrorResponse(res, error, 'Authentication failed');
    }

    if (action === 'saveBase') {
      if (!isNonEmptyString(normalizedText, 12000)) {
        return res.status(400).json({ error: 'Base cache text is required' });
      }

      await db.collection('kanji_ai_explanations').doc(normalizedKanji).set({
        text: normalizedText,
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });

      return res.status(200).json({ ok: true });
    }

    if (action === 'saveReading') {
      if (!isNonEmptyString(normalizedReading, 256) || !isNonEmptyString(normalizedText, 12000)) {
        return res.status(400).json({ error: 'Reading cache payload is invalid' });
      }

      const docId = encodeURIComponent(`${normalizedKanji}__${normalizedReading}`);
      await db.collection('kanji_ai_reading_explanations').doc(docId).set({
        kanji: normalizedKanji,
        reading: normalizedReading,
        text: normalizedText,
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });

      return res.status(200).json({ ok: true });
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
