const crypto = require('crypto');
const { FieldValue, getAdminFirestore } = require('./_lib/firebase-admin');

const REVENUECAT_ENTITLEMENT_ID = String(process.env.REVENUECAT_ENTITLEMENT_ID || 'premium').trim() || 'premium';
const PREMIUM_PRODUCT_PREFIX = 'meimay.premium.';
const PREMIUM_PASS_DURATIONS = {
  'meimay.premium.pass.1month': 1,
  'meimay.premium.pass.3months': 3
};

function setResponseHeaders(res) {
  res.setHeader('Allow', 'POST, OPTIONS');
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

function getAuthorization(req) {
  const header = req.headers.authorization || req.headers.Authorization;
  return typeof header === 'string' ? header.trim() : '';
}

function isAuthorized(req) {
  const expected = String(process.env.REVENUECAT_WEBHOOK_AUTH || '').trim();
  const actual = getAuthorization(req);
  return !!expected && (actual === expected || actual === `Bearer ${expected}`);
}

function getRevenueCatEvent(body) {
  const event = body && typeof body === 'object' && body.event ? body.event : body;
  return event && typeof event === 'object' ? event : null;
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function getStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => normalizeString(item))
    .filter(Boolean);
}

function getEntitlementIds(event) {
  const ids = getStringArray(event.entitlement_ids);
  const singleId = normalizeString(event.entitlement_id);
  if (singleId) ids.push(singleId);
  return [...new Set(ids)];
}

function addMonths(date, months) {
  const next = new Date(date.getTime());
  next.setMonth(next.getMonth() + months);
  return next;
}

function inferExpirationMs(event) {
  if (typeof event.expiration_at_ms === 'number' && Number.isFinite(event.expiration_at_ms)) {
    return event.expiration_at_ms;
  }

  const productId = normalizeString(event.product_id);
  const months = PREMIUM_PASS_DURATIONS[productId];
  const purchasedAtMs = typeof event.purchased_at_ms === 'number' && Number.isFinite(event.purchased_at_ms)
    ? event.purchased_at_ms
    : null;

  if (!months || !purchasedAtMs) return null;
  return addMonths(new Date(purchasedAtMs), months).getTime();
}

function buildEventId(event, eventAtMs) {
  return normalizeString(event.id)
    || normalizeString(event.event_id)
    || normalizeString(event.transaction_id)
    || normalizeString(event.original_transaction_id)
    || `missing-${eventAtMs}`;
}

function getSafeDocId(value) {
  const normalized = normalizeString(value);
  if (normalized && !normalized.includes('/')) return normalized;
  return crypto.createHash('sha256').update(normalized || `${Date.now()}`).digest('hex');
}

function buildRevenueCatContext(event) {
  const eventAtMs = typeof event.event_timestamp_ms === 'number' && Number.isFinite(event.event_timestamp_ms)
    ? event.event_timestamp_ms
    : (typeof event.purchased_at_ms === 'number' && Number.isFinite(event.purchased_at_ms)
      ? event.purchased_at_ms
      : Date.now());
  const eventId = buildEventId(event, eventAtMs);

  return {
    eventId,
    eventDocId: getSafeDocId(eventId),
    eventType: normalizeString(event.type).toUpperCase(),
    appUserId: normalizeString(event.app_user_id) || null,
    originalAppUserId: normalizeString(event.original_app_user_id) || null,
    aliases: getStringArray(event.aliases),
    entitlementIds: getEntitlementIds(event),
    productId: normalizeString(event.product_id) || null,
    store: normalizeString(event.store) || null,
    environment: normalizeString(event.environment) || null,
    transactionId: normalizeString(event.transaction_id) || null,
    originalTransactionId: normalizeString(event.original_transaction_id) || null,
    presentedOfferingId: normalizeString(event.presented_offering_id) || null,
    periodType: normalizeString(event.period_type) || null,
    purchasedAtMs: typeof event.purchased_at_ms === 'number' && Number.isFinite(event.purchased_at_ms)
      ? event.purchased_at_ms
      : null,
    expiresAtMs: inferExpirationMs(event),
    eventAtMs
  };
}

function isPremiumProduct(productId) {
  return !!productId && productId.startsWith(PREMIUM_PRODUCT_PREFIX);
}

function mapPremiumState(context) {
  const hasPremiumEntitlement = context.entitlementIds.includes(REVENUECAT_ENTITLEMENT_ID)
    || isPremiumProduct(context.productId);
  const expiredByDate = !!context.expiresAtMs && context.expiresAtMs <= Date.now();

  if (context.eventType === 'TEST') {
    return { isPremium: null, subscriptionStatus: 'test' };
  }

  if (context.eventType === 'EXPIRATION') {
    return { isPremium: false, subscriptionStatus: 'expired' };
  }

  if (context.eventType === 'CANCELLATION') {
    return { isPremium: false, subscriptionStatus: 'refunded' };
  }

  if (context.eventType === 'BILLING_ISSUE') {
    return { isPremium: null, subscriptionStatus: 'billing_issue' };
  }

  const activeTypes = new Set([
    'INITIAL_PURCHASE',
    'NON_RENEWING_PURCHASE',
    'RENEWAL',
    'UNCANCELLATION',
    'SUBSCRIPTION_EXTENDED',
    'TEMPORARY_ENTITLEMENT_GRANT',
    'REFUND_REVERSED'
  ]);

  if (activeTypes.has(context.eventType) && hasPremiumEntitlement) {
    return {
      isPremium: !expiredByDate,
      subscriptionStatus: expiredByDate ? 'expired' : 'active'
    };
  }

  if (expiredByDate) {
    return { isPremium: false, subscriptionStatus: 'expired' };
  }

  return {
    isPremium: null,
    subscriptionStatus: context.eventType ? context.eventType.toLowerCase() : 'unknown'
  };
}

function isLikelyRevenueCatUserId(value) {
  return !!value && !value.startsWith('$RCAnonymousID:');
}

async function resolveUserRef(db, context) {
  const candidates = [
    context.appUserId,
    context.originalAppUserId,
    ...context.aliases
  ].filter(isLikelyRevenueCatUserId);

  for (const candidate of candidates) {
    const directRef = db.collection('users').doc(candidate);
    const directSnap = await directRef.get();
    if (directSnap.exists) return directRef;

    const querySnap = await db
      .collection('users')
      .where('revenueCatAppUserId', '==', candidate)
      .limit(1)
      .get();
    if (!querySnap.empty) return querySnap.docs[0].ref;
  }

  return candidates.length > 0 ? db.collection('users').doc(candidates[0]) : null;
}

function buildUserUpdate(context, premiumMutation) {
  const expiresAt = context.expiresAtMs ? new Date(context.expiresAtMs) : null;
  const purchasedAt = context.purchasedAtMs ? new Date(context.purchasedAtMs) : null;
  const eventAt = new Date(context.eventAtMs);
  const isAppStore = context.store === 'APP_STORE';

  const update = {
    revenueCatAppUserId: context.appUserId,
    premiumSource: 'revenuecat',
    subscriptionStatus: premiumMutation.subscriptionStatus,
    premiumStatus: premiumMutation.subscriptionStatus,
    latestNotificationType: context.eventType || null,
    latestNotificationUUID: context.eventId,
    revenueCatLastEventType: context.eventType || null,
    revenueCatLastEventId: context.eventId,
    revenueCatStore: context.store,
    revenueCatEnvironment: context.environment,
    revenueCatProductId: context.productId,
    premiumProductId: context.productId,
    revenueCatTransactionId: context.transactionId,
    revenueCatOriginalTransactionId: context.originalTransactionId,
    originalTransactionId: context.originalTransactionId,
    revenueCatPresentedOfferingId: context.presentedOfferingId,
    revenueCatPeriodType: context.periodType,
    revenueCatPurchasedAt: purchasedAt,
    revenueCatExpiresAt: expiresAt,
    premiumExpiresAt: expiresAt,
    revenueCatLastEventAt: eventAt,
    revenueCatLastEventAtMs: context.eventAtMs,
    revenueCatUpdatedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  };

  if (typeof premiumMutation.isPremium === 'boolean') {
    update.isPremium = premiumMutation.isPremium;
  }

  if (isAppStore) {
    update.premiumPlatform = 'ios';
    update.appStoreProductId = context.productId;
    update.appStoreOriginalTransactionId = context.originalTransactionId;
    update.appStoreTransactionId = context.transactionId;
    update.appStoreExpiresAt = expiresAt;
    update.appStoreEnvironment = context.environment;
    update.appStoreLastNotificationType = context.eventType || null;
    update.appStoreLastEventAt = eventAt;
    update.appStoreLastEventAtMs = context.eventAtMs;
    update.appStoreUpdatedAt = FieldValue.serverTimestamp();
  }

  return update;
}

async function applyEventToUser(db, userRef, context, premiumMutation) {
  const eventRef = db.collection('revenueCatEvents').doc(context.eventDocId);

  return db.runTransaction(async (tx) => {
    const eventSnap = await tx.get(eventRef);
    if (eventSnap.exists && eventSnap.get('status') === 'processed') {
      return { status: 'duplicate' };
    }

    const userSnap = await tx.get(userRef);
    const currentEventAtMs = Number(userSnap.get('revenueCatLastEventAtMs') || 0);
    const stale = currentEventAtMs > context.eventAtMs;

    tx.set(eventRef, {
      ...context,
      userId: userRef.id,
      premiumMutation,
      status: stale ? 'stale' : 'processed',
      updatedAt: FieldValue.serverTimestamp(),
      createdAt: eventSnap.exists ? eventSnap.get('createdAt') || FieldValue.serverTimestamp() : FieldValue.serverTimestamp()
    }, { merge: true });

    if (stale) {
      return { status: 'stale' };
    }

    tx.set(userRef, buildUserUpdate(context, premiumMutation), { merge: true });
    return { status: 'processed' };
  });
}

module.exports = async (req, res) => {
  setResponseHeaders(res);

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return buildErrorResponse(res, 405, 'method_not_allowed');
  }

  if (!isAuthorized(req)) {
    return buildErrorResponse(res, 401, 'unauthorized');
  }

  const event = getRevenueCatEvent(readBody(req));
  if (!event) {
    return buildErrorResponse(res, 400, 'missing_event');
  }

  const context = buildRevenueCatContext(event);
  const premiumMutation = mapPremiumState(context);

  if (context.eventType === 'TEST') {
    return res.status(200).json({ ok: true, testEvent: true });
  }

  const db = getAdminFirestore();

  try {
    const userRef = await resolveUserRef(db, context);
    if (!userRef) {
      await db.collection('revenueCatEvents').doc(context.eventDocId).set({
        ...context,
        status: 'pending_user_link',
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
      return res.status(200).json({ ok: true, ignored: 'user_not_resolved' });
    }

    const result = await applyEventToUser(db, userRef, context, premiumMutation);

    return res.status(200).json({
      ok: true,
      status: result.status,
      userId: userRef.id,
      isPremium: premiumMutation.isPremium,
      subscriptionStatus: premiumMutation.subscriptionStatus
    });
  } catch (error) {
    return buildErrorResponse(
      res,
      Number(error?.statusCode) || 500,
      error?.code || 'revenuecat_webhook_failed',
      error?.message || 'RevenueCat webhook failed.'
    );
  }
};
