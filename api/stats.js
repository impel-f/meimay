const { FieldValue, getAdminFirestore, verifyRequestAuth } = require('./_lib/firebase-admin');

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function getCurrentWeekKey() {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}_${weekNo.toString().padStart(2, '0')}`;
}

function buildErrorResponse(res, error, fallbackMessage) {
  const statusCode = Number(error?.statusCode) || 500;
  return res.status(statusCode).json({
    error: fallbackMessage,
    details: error?.message || fallbackMessage,
  });
}

module.exports = async (req, res) => {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await verifyRequestAuth(req);
  } catch (error) {
    return buildErrorResponse(res, error, 'Authentication failed');
  }

  const { kanji, delta } = req.body || {};
  const normalizedKanji = typeof kanji === 'string' ? kanji.trim() : '';
  const normalizedDelta = Number(delta);

  if (!normalizedKanji || normalizedKanji.length > 64) {
    return res.status(400).json({ error: 'Kanji is required' });
  }
  if (normalizedDelta !== 1 && normalizedDelta !== -1) {
    return res.status(400).json({ error: 'Delta must be 1 or -1' });
  }

  const db = getAdminFirestore();
  const increment = FieldValue.increment(normalizedDelta);

  try {
    const batch = db.batch();
    const allTimeRef = db.collection('statistics').doc('allTime');
    const weeklyRef = db.collection('statistics').doc(`weekly_${getCurrentWeekKey()}`);

    batch.set(allTimeRef, {
      [normalizedKanji]: increment,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    batch.set(weeklyRef, {
      [normalizedKanji]: increment,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    await batch.commit();
    return res.status(200).json({ ok: true });
  } catch (error) {
    return buildErrorResponse(res, error, 'Statistics update failed');
  }
};
