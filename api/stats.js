const { FieldValue, getAdminFirestore, verifyRequestAuth } = require('./_lib/firebase-admin');

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
}

function getCurrentWeekKey() {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}_${weekNo.toString().padStart(2, '0')}`;
}

function getCurrentMonthKey() {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Tokyo',
      year: 'numeric',
      month: '2-digit',
    }).formatToParts(new Date());
    const year = parts.find((part) => part.type === 'year')?.value;
    const month = parts.find((part) => part.type === 'month')?.value;
    if (year && month) return `${year}_${month}`;
  } catch (error) {
    // Fallback below keeps the API working even if Intl time zones are unavailable.
  }

  const offsetMs = 9 * 60 * 60 * 1000;
  const shifted = new Date(Date.now() + offsetMs);
  return `${shifted.getUTCFullYear()}_${String(shifted.getUTCMonth() + 1).padStart(2, '0')}`;
}

function normalizeStatsPeriod(period) {
  if (period === 'monthly' || period === 'weekly') return period;
  return 'allTime';
}

function normalizeStatsUpdatePeriod(period) {
  if (period === 'allTime' || period === 'monthly' || period === 'weekly') return period;
  return 'all';
}

function normalizeStatsKind(kind) {
  return kind === 'reading' ? 'reading' : 'kanji';
}

function normalizeStatsMetric(metric) {
  if (metric === 'like') return 'like';
  if (metric === 'direct') return 'direct';
  return 'all';
}

function getStatsCollectionNames(kind, metric = 'all') {
  const normalizedKind = normalizeStatsKind(kind);
  if (normalizedKind !== 'reading') return ['statistics'];

  const normalizedMetric = normalizeStatsMetric(metric);
  if (normalizedMetric === 'like') return ['reading_like_statistics'];
  if (normalizedMetric === 'direct') return ['reading_statistics'];
  return ['reading_statistics', 'reading_like_statistics'];
}

function getStatsCollectionName(kind, metric = 'all') {
  return getStatsCollectionNames(kind, metric)[0];
}

function getStatsDocId(period) {
  const normalized = normalizeStatsPeriod(period);
  if (normalized === 'monthly') return `monthly_${getCurrentMonthKey()}`;
  if (normalized === 'weekly') return `weekly_${getCurrentWeekKey()}`;
  return 'allTime';
}

function normalizeStatsReadingKey(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';

  return raw
    .replace(/[ァ-ヶ]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0x60))
    .replace(/[^ぁ-んー]/g, '');
}

function getRequestedPeriod(req) {
  const queryPeriod = typeof req?.query?.period === 'string' ? req.query.period : '';
  if (queryPeriod) return queryPeriod;

  const queryType = typeof req?.query?.type === 'string' ? req.query.type : '';
  if (queryType) return queryType;

  try {
    const url = new URL(req.url, 'http://localhost');
    return url.searchParams.get('period') || url.searchParams.get('type') || '';
  } catch (error) {
    return '';
  }
}

function getRequestedKind(req) {
  const queryKind = typeof req?.query?.kind === 'string' ? req.query.kind : '';
  if (queryKind) return queryKind;

  try {
    const url = new URL(req.url, 'http://localhost');
    return url.searchParams.get('kind') || '';
  } catch (error) {
    return '';
  }
}

function getRequestedMetric(req) {
  const bodyMetric = typeof req?.body?.metric === 'string' ? req.body.metric : '';
  if (bodyMetric) return bodyMetric;

  const bodySource = typeof req?.body?.source === 'string' ? req.body.source : '';
  if (bodySource) return bodySource;

  const queryMetric = typeof req?.query?.metric === 'string' ? req.query.metric : '';
  if (queryMetric) return queryMetric;

  const querySource = typeof req?.query?.source === 'string' ? req.query.source : '';
  if (querySource) return querySource;

  return '';
}

function getRequestedUpdatePeriod(req) {
  const bodyPeriod = typeof req?.body?.period === 'string' ? req.body.period : '';
  if (bodyPeriod) return bodyPeriod;

  const queryPeriod = typeof req?.query?.period === 'string' ? req.query.period : '';
  if (queryPeriod) return queryPeriod;

  try {
    const url = new URL(req.url, 'http://localhost');
    return url.searchParams.get('period') || url.searchParams.get('scope') || '';
  } catch (error) {
    return '';
  }
}

function getStatsWritePeriods(period) {
  const normalized = normalizeStatsUpdatePeriod(period);
  if (normalized === 'all') return ['allTime', 'weekly', 'monthly'];
  return [normalized];
}

function extractRankingItems(data, kind) {
  if (!data || typeof data !== 'object') return [];

  const normalizedKind = normalizeStatsKind(kind);
  const keyField = normalizedKind === 'reading' ? 'reading' : 'kanji';

  return Object.keys(data)
    .filter((key) => key !== 'updatedAt')
    .map((key) => ({ key, [keyField]: key, count: Number(data[key]) || 0 }))
    .filter((item) => item.count > 0)
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a[keyField].localeCompare(b[keyField], 'ja');
    })
    .slice(0, 100);
}

function accumulateRankingTotals(data, kind, totals) {
  if (!data || typeof data !== 'object') return;

  const normalizedKind = normalizeStatsKind(kind);
  const keyField = normalizedKind === 'reading' ? 'reading' : 'kanji';

  Object.keys(data)
    .filter((key) => key !== 'updatedAt')
    .forEach((key) => {
      const count = Number(data[key]) || 0;
      if (count <= 0) return;

      const normalizedKey = normalizedKind === 'reading'
        ? normalizeStatsReadingKey(key)
        : key;
      if (!normalizedKey) return;

      const current = totals.get(normalizedKey) || {
        key: normalizedKey,
        [keyField]: normalizedKey,
        count: 0,
      };
      current.count += count;
      totals.set(normalizedKey, current);
    });
}

function normalizeStatsValue(kind, value) {
  const normalizedKind = normalizeStatsKind(kind);
  const raw = String(value || '').trim();
  if (!raw) return '';

  if (normalizedKind === 'reading') {
    return normalizeStatsReadingKey(raw);
  }

  return raw;
}

async function fetchRankingItems(kind, period, metric = 'all') {
  const db = getAdminFirestore();
  const collections = getStatsCollectionNames(kind, metric);
  const totals = new Map();

  await Promise.all(collections.map(async (collection) => {
    const doc = await db.collection(collection).doc(getStatsDocId(period)).get();
    if (!doc.exists) return;
    accumulateRankingTotals(doc.data(), kind, totals);
  }));

  return Array.from(totals.values())
    .filter((item) => item.count > 0)
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      const normalizedKind = normalizeStatsKind(kind);
      const aKey = normalizedKind === 'reading' ? a.reading : a.kanji;
      const bKey = normalizedKind === 'reading' ? b.reading : b.kanji;
      return String(aKey || '').localeCompare(String(bKey || ''), 'ja');
    })
    .slice(0, 100);
}

function normalizeStatsReadingKey(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';

  return raw
    .replace(/[\u30a1-\u30f6]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0x60))
    .replace(/[^\u3041-\u3093\u30fc]/g, '');
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

  if (req.method === 'GET') {
    try {
      const kind = normalizeStatsKind(getRequestedKind(req));
      const period = normalizeStatsPeriod(getRequestedPeriod(req));
      const metric = getRequestedMetric(req);
      const items = await fetchRankingItems(kind, period, metric);
      return res.status(200).json({ ok: true, kind, period, items });
    } catch (error) {
      return buildErrorResponse(res, error, 'Statistics read failed');
    }
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await verifyRequestAuth(req);
  } catch (error) {
    return buildErrorResponse(res, error, 'Authentication failed');
  }

  const { kind, kanji, reading, key, delta } = req.body || {};
  const bootstrapRequested = req.body?.bootstrap === true || req.query?.bootstrap === 'true';
  const normalizedKind = normalizeStatsKind(kind);
  const normalizedUpdatePeriod = normalizeStatsUpdatePeriod(getRequestedUpdatePeriod(req));
  const normalizedMetric = normalizeStatsMetric(getRequestedMetric(req));

  if (bootstrapRequested) {
    try {
      const db = getAdminFirestore();
      const batch = db.batch();
      const collections = getStatsCollectionNames(normalizedKind, normalizedMetric);
      const updatePeriods = getStatsWritePeriods(normalizedUpdatePeriod);

      collections.forEach((collection) => {
        updatePeriods.forEach((period) => {
          const docId = period === 'allTime' ? 'allTime' : getStatsDocId(period);
          const ref = db.collection(collection).doc(docId);
          batch.set(ref, {
            updatedAt: FieldValue.serverTimestamp(),
          }, { merge: true });
        });
      });

      await batch.commit();
      return res.status(200).json({ ok: true, kind: normalizedKind, metric: normalizedMetric, period: normalizedUpdatePeriod, bootstrap: true });
    } catch (error) {
      return buildErrorResponse(res, error, 'Statistics bootstrap failed');
    }
  }

  const normalizedValue = normalizeStatsValue(normalizedKind, normalizedKind === 'reading' ? (reading || key) : (kanji || key));
  const normalizedDelta = Number(delta);

  if (!normalizedValue || normalizedValue.length > (normalizedKind === 'reading' ? 128 : 64)) {
    return res.status(400).json({ error: normalizedKind === 'reading' ? 'Reading is required' : 'Kanji is required' });
  }
  if (!Number.isInteger(normalizedDelta) || normalizedDelta === 0 || Math.abs(normalizedDelta) > 100000) {
    return res.status(400).json({ error: 'Delta must be a non-zero integer' });
  }

  const db = getAdminFirestore();
  const increment = FieldValue.increment(normalizedDelta);

  try {
    const batch = db.batch();
    const collection = getStatsCollectionName(normalizedKind, normalizedMetric);
    const updatePeriods = getStatsWritePeriods(normalizedUpdatePeriod);

    updatePeriods.forEach((period) => {
      const docId = period === 'allTime' ? 'allTime' : getStatsDocId(period);
      const ref = db.collection(collection).doc(docId);
      batch.set(ref, {
        [normalizedValue]: increment,
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    });

    await batch.commit();
    return res.status(200).json({ ok: true, kind: normalizedKind, period: normalizedUpdatePeriod });
  } catch (error) {
    return buildErrorResponse(res, error, 'Statistics update failed');
  }
};
