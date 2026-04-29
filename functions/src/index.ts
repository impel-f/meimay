import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore, type DocumentReference } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { defineSecret, defineString } from "firebase-functions/params";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { onRequest } from "firebase-functions/v2/https";
import {
  Environment,
  NotificationTypeV2,
  SignedDataVerifier,
  type JWSTransactionDecodedPayload,
  type ResponseBodyV2DecodedPayload,
} from "@apple/app-store-server-library";

if (!getApps().length) {
  initializeApp();
}

const db = getFirestore();

const APPLE_IAP_KEY_ID = defineString("APPLE_IAP_KEY_ID");
const APPLE_IAP_ISSUER_ID = defineString("APPLE_IAP_ISSUER_ID");
const APPLE_IAP_BUNDLE_ID = defineString("APPLE_IAP_BUNDLE_ID", {
  default: "com.impelf.meimay",
});
const APPLE_IAP_APPLE_ID = defineString("APPLE_IAP_APPLE_ID", {
  default: "",
});
const APPLE_IAP_ENVIRONMENT = defineString("APPLE_IAP_ENVIRONMENT", {
  default: Environment.SANDBOX,
});
const APPLE_IAP_ENCODED_KEY = defineSecret("APPLE_IAP_ENCODED_KEY");
const REVENUECAT_ENTITLEMENT_ID = defineString("REVENUECAT_ENTITLEMENT_ID", {
  default: "premium",
});
const REVENUECAT_WEBHOOK_AUTH = defineSecret("REVENUECAT_WEBHOOK_AUTH");

let cachedVerifier: SignedDataVerifier | null = null;

function readAppleRoots(): Buffer[] {
  return [
    readFileSync(join(__dirname, "../certs/AppleIncRootCertificate.cer")),
    readFileSync(join(__dirname, "../certs/AppleRootCA-G2.cer")),
    readFileSync(join(__dirname, "../certs/AppleRootCA-G3.cer")),
  ];
}

function getEnvironment(): Environment {
  const value = (APPLE_IAP_ENVIRONMENT.value() || "").trim();
  switch (value) {
    case Environment.PRODUCTION:
      return Environment.PRODUCTION;
    case Environment.XCODE:
      return Environment.XCODE;
    case Environment.LOCAL_TESTING:
      return Environment.LOCAL_TESTING;
    case Environment.SANDBOX:
    default:
      return Environment.SANDBOX;
  }
}

function getAppStoreConfig() {
  const bundleId = APPLE_IAP_BUNDLE_ID.value().trim() || "com.impelf.meimay";
  const keyId = APPLE_IAP_KEY_ID.value().trim();
  const issuerId = APPLE_IAP_ISSUER_ID.value().trim();
  const encodedKey = APPLE_IAP_ENCODED_KEY.value().trim();
  const appleIdRaw = APPLE_IAP_APPLE_ID.value().trim();
  const environment = getEnvironment();
  const appAppleId = appleIdRaw ? Number(appleIdRaw) : undefined;

  if (!keyId || !issuerId || !encodedKey) {
    throw new Error("Apple IAP params are incomplete. Set APPLE_IAP_KEY_ID / APPLE_IAP_ISSUER_ID / APPLE_IAP_ENCODED_KEY.");
  }

  if (environment === Environment.PRODUCTION && !appAppleId) {
    throw new Error("APPLE_IAP_APPLE_ID is required in Production.");
  }

  return {
    keyId,
    issuerId,
    bundleId,
    encodedKey,
    appAppleId,
    environment,
  };
}

function getVerifier(): SignedDataVerifier {
  if (cachedVerifier) {
    return cachedVerifier;
  }

  const config = getAppStoreConfig();

  cachedVerifier = new SignedDataVerifier(
    readAppleRoots(),
    true,
    config.environment,
    config.bundleId,
    config.appAppleId,
  );

  return cachedVerifier;
}

function getSignedPayload(body: unknown): string | null {
  if (!body) {
    return null;
  }

  if (typeof body === "string") {
    try {
      const parsed = JSON.parse(body) as { signedPayload?: unknown };
      return typeof parsed.signedPayload === "string" ? parsed.signedPayload : null;
    } catch {
      return null;
    }
  }

  if (typeof body === "object" && body !== null && "signedPayload" in body) {
    const payload = (body as { signedPayload?: unknown }).signedPayload;
    return typeof payload === "string" ? payload : null;
  }

  return null;
}

type PremiumMutation = {
  isPremium: boolean | null;
  subscriptionStatus: string;
};

type NotificationContext = {
  notificationUUID: string;
  notificationType: string;
  subtype: string | null;
  appAccountToken: string | null;
  bundleId: string | null;
  environment: string | null;
  productId: string | null;
  originalTransactionId: string | null;
  transactionId: string | null;
  expiresAtMs: number | null;
  eventAtMs: number;
};

type ApplyNotificationResult =
  | { status: "processed"; userId: string; premiumMutation: PremiumMutation }
  | { status: "duplicate" }
  | { status: "stale"; userId: string; premiumMutation: PremiumMutation };

type PendingNotificationRecord = Partial<NotificationContext> & {
  notificationType?: string;
  subtype?: string | null;
  expiresAt?: unknown;
};

type RevenueCatEvent = {
  id?: string;
  type?: string;
  app_user_id?: string;
  original_app_user_id?: string;
  aliases?: unknown;
  entitlement_id?: string | null;
  entitlement_ids?: unknown;
  product_id?: string | null;
  purchased_at_ms?: number | null;
  expiration_at_ms?: number | null;
  event_timestamp_ms?: number | null;
  store?: string | null;
  environment?: string | null;
  transaction_id?: string | null;
  original_transaction_id?: string | null;
  presented_offering_id?: string | null;
  period_type?: string | null;
};

type RevenueCatContext = {
  eventId: string;
  eventType: string;
  appUserId: string | null;
  originalAppUserId: string | null;
  aliases: string[];
  entitlementIds: string[];
  productId: string | null;
  store: string | null;
  environment: string | null;
  transactionId: string | null;
  originalTransactionId: string | null;
  presentedOfferingId: string | null;
  periodType: string | null;
  purchasedAtMs: number | null;
  expiresAtMs: number | null;
  eventAtMs: number;
};

function mapSubscriptionState(
  notificationType?: string,
  transaction?: JWSTransactionDecodedPayload | null,
): PremiumMutation {
  const type = `${notificationType || ""}`.trim().toUpperCase();

  const activeTypes = new Set([
    NotificationTypeV2.SUBSCRIBED,
    NotificationTypeV2.DID_RENEW,
    "DID_RECOVER",
    NotificationTypeV2.REFUND_REVERSED,
  ]);

  const inactiveTypes = new Set([
    NotificationTypeV2.EXPIRED,
    NotificationTypeV2.REVOKE,
    "REVOKED",
    NotificationTypeV2.REFUND,
    NotificationTypeV2.GRACE_PERIOD_EXPIRED,
  ]);

  if (activeTypes.has(type)) {
    return {
      isPremium: true,
      subscriptionStatus: "active",
    };
  }

  if (inactiveTypes.has(type)) {
    const normalized =
      type === NotificationTypeV2.EXPIRED
        ? "expired"
        : type === NotificationTypeV2.REFUND
          ? "refunded"
          : "revoked";

    return {
      isPremium: false,
      subscriptionStatus: normalized,
    };
  }

  if (type === NotificationTypeV2.DID_FAIL_TO_RENEW) {
    return {
      isPremium: null,
      subscriptionStatus: "billing_retry",
    };
  }

  if (type === NotificationTypeV2.TEST) {
    return {
      isPremium: null,
      subscriptionStatus: "test",
    };
  }

  if (transaction?.expiresDate && transaction.expiresDate <= Date.now()) {
    return {
      isPremium: false,
      subscriptionStatus: "expired",
    };
  }

  return {
    isPremium: null,
    subscriptionStatus: type ? type.toLowerCase() : "unknown",
  };
}

async function resolveUserRef(appAccountToken: string): Promise<DocumentReference | null> {
  const directRef = db.collection("users").doc(appAccountToken);
  const directSnap = await directRef.get();
  if (directSnap.exists) {
    return directRef;
  }

  const querySnap = await db
    .collection("users")
    .where("appAccountToken", "==", appAccountToken)
    .limit(1)
    .get();

  if (!querySnap.empty) {
    return querySnap.docs[0].ref;
  }

  return null;
}

async function storePendingNotification(
  context: NotificationContext,
): Promise<void> {
  await db.collection("billingPending").doc(context.notificationUUID).set(
    {
      appAccountToken: context.appAccountToken,
      notificationUUID: context.notificationUUID,
      notificationType: context.notificationType || null,
      subtype: context.subtype,
      bundleId: context.bundleId,
      environment: context.environment,
      productId: context.productId,
      originalTransactionId: context.originalTransactionId,
      transactionId: context.transactionId,
      expiresAt: context.expiresAtMs ? new Date(context.expiresAtMs) : null,
      expiresAtMs: context.expiresAtMs,
      eventAtMs: context.eventAtMs,
      status: "pending_user_link",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
}

function buildNotificationContext(
  decodedNotification: ResponseBodyV2DecodedPayload,
  transaction: JWSTransactionDecodedPayload | null,
): NotificationContext {
  const eventAtCandidates = [
    typeof decodedNotification.signedDate === "number" ? decodedNotification.signedDate : 0,
    typeof transaction?.purchaseDate === "number" ? transaction.purchaseDate : 0,
    typeof transaction?.originalPurchaseDate === "number" ? transaction.originalPurchaseDate : 0,
    typeof transaction?.expiresDate === "number" ? transaction.expiresDate : 0,
    Date.now(),
  ];

  return {
    notificationUUID: decodedNotification.notificationUUID || `missing-${Date.now()}`,
    notificationType: `${decodedNotification.notificationType || ""}`.trim(),
    subtype: decodedNotification.subtype || null,
    appAccountToken: transaction?.appAccountToken?.trim() || null,
    bundleId: decodedNotification.data?.bundleId || transaction?.bundleId || null,
    environment: decodedNotification.data?.environment || transaction?.environment || null,
    productId: transaction?.productId || null,
    originalTransactionId: transaction?.originalTransactionId || null,
    transactionId: transaction?.transactionId || null,
    expiresAtMs: typeof transaction?.expiresDate === "number" ? transaction.expiresDate : null,
    eventAtMs: Math.max(...eventAtCandidates),
  };
}

function buildUserSubscriptionUpdate(
  context: NotificationContext,
  premiumMutation: PremiumMutation,
): Record<string, unknown> {
  const updatePayload: Record<string, unknown> = {
    appAccountToken: context.appAccountToken,
    premiumSource: "app_store",
    subscriptionStatus: premiumMutation.subscriptionStatus,
    latestNotificationType: context.notificationType || null,
    latestNotificationUUID: context.notificationUUID,
    appStoreLastNotificationType: context.notificationType || null,
    appStoreLastSubtype: context.subtype,
    appStoreEnvironment: context.environment,
    appStoreProductId: context.productId,
    premiumProductId: context.productId,
    appStoreOriginalTransactionId: context.originalTransactionId,
    originalTransactionId: context.originalTransactionId,
    appStoreTransactionId: context.transactionId,
    appStoreExpiresAt: context.expiresAtMs ? new Date(context.expiresAtMs) : null,
    premiumExpiresAt: context.expiresAtMs ? new Date(context.expiresAtMs) : null,
    appStoreLastEventAt: new Date(context.eventAtMs),
    appStoreLastEventAtMs: context.eventAtMs,
    appStoreLastVerifiedAt: FieldValue.serverTimestamp(),
    lastVerifiedAt: FieldValue.serverTimestamp(),
    appStoreUpdatedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };

  if (premiumMutation.isPremium !== null) {
    updatePayload.isPremium = premiumMutation.isPremium;
  }

  return updatePayload;
}

function getRevenueCatEvent(body: unknown): RevenueCatEvent | null {
  if (!body || typeof body !== "object" || !("event" in body)) {
    return null;
  }
  const event = (body as { event?: unknown }).event;
  return event && typeof event === "object" ? event as RevenueCatEvent : null;
}

function getRevenueCatAuthorization(request: { get(name: string): string | undefined }): string {
  const value = request.get("authorization") || request.get("Authorization") || "";
  return value.trim();
}

function getRevenueCatAliases(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item) => !!item);
}

function getRevenueCatEntitlementIds(event: RevenueCatEvent): string[] {
  const ids = Array.isArray(event.entitlement_ids)
    ? event.entitlement_ids
        .map((item) => (typeof item === "string" ? item.trim() : ""))
        .filter((item) => !!item)
    : [];
  if (event.entitlement_id) {
    ids.push(event.entitlement_id);
  }
  return Array.from(new Set(ids));
}

function addUtcMonths(timestampMs: number, months: number): number {
  const date = new Date(timestampMs);
  date.setUTCMonth(date.getUTCMonth() + months);
  return date.getTime();
}

function inferRevenueCatExpiresAtMs(event: RevenueCatEvent): number | null {
  if (typeof event.expiration_at_ms === "number") {
    return event.expiration_at_ms;
  }
  const purchasedAtMs = typeof event.purchased_at_ms === "number" ? event.purchased_at_ms : null;
  const productId = `${event.product_id || ""}`.trim();
  if (!purchasedAtMs || !productId) return null;
  if (productId === "meimay.premium.pass.1month") return addUtcMonths(purchasedAtMs, 1);
  if (productId === "meimay.premium.pass.3months") return addUtcMonths(purchasedAtMs, 3);
  return null;
}

function buildRevenueCatContext(event: RevenueCatEvent): RevenueCatContext {
  const eventAtMs =
    typeof event.event_timestamp_ms === "number"
      ? event.event_timestamp_ms
      : typeof event.purchased_at_ms === "number"
        ? event.purchased_at_ms
        : Date.now();

  return {
    eventId: `${event.id || `missing-${eventAtMs}`}`,
    eventType: `${event.type || ""}`.trim().toUpperCase(),
    appUserId: typeof event.app_user_id === "string" ? event.app_user_id.trim() || null : null,
    originalAppUserId: typeof event.original_app_user_id === "string" ? event.original_app_user_id.trim() || null : null,
    aliases: getRevenueCatAliases(event.aliases),
    entitlementIds: getRevenueCatEntitlementIds(event),
    productId: typeof event.product_id === "string" ? event.product_id.trim() || null : null,
    store: typeof event.store === "string" ? event.store.trim() || null : null,
    environment: typeof event.environment === "string" ? event.environment.trim() || null : null,
    transactionId: typeof event.transaction_id === "string" ? event.transaction_id.trim() || null : null,
    originalTransactionId: typeof event.original_transaction_id === "string" ? event.original_transaction_id.trim() || null : null,
    presentedOfferingId: typeof event.presented_offering_id === "string" ? event.presented_offering_id.trim() || null : null,
    periodType: typeof event.period_type === "string" ? event.period_type.trim() || null : null,
    purchasedAtMs: typeof event.purchased_at_ms === "number" ? event.purchased_at_ms : null,
    expiresAtMs: inferRevenueCatExpiresAtMs(event),
    eventAtMs,
  };
}

function isRevenueCatPremiumProduct(productId: string | null): boolean {
  return !!productId && productId.startsWith("meimay.premium.");
}

function mapRevenueCatPremiumState(context: RevenueCatContext): PremiumMutation {
  const entitlementId = REVENUECAT_ENTITLEMENT_ID.value().trim() || "premium";
  const hasPremiumEntitlement = context.entitlementIds.includes(entitlementId)
    || isRevenueCatPremiumProduct(context.productId);
  const expiredByDate = !!context.expiresAtMs && context.expiresAtMs <= Date.now();

  if (context.eventType === "TEST") {
    return { isPremium: null, subscriptionStatus: "test" };
  }

  if (context.eventType === "EXPIRATION") {
    return { isPremium: false, subscriptionStatus: "expired" };
  }

  if (context.eventType === "CANCELLATION") {
    return { isPremium: false, subscriptionStatus: "refunded" };
  }

  if (context.eventType === "BILLING_ISSUE") {
    return { isPremium: null, subscriptionStatus: "billing_issue" };
  }

  const activeTypes = new Set([
    "INITIAL_PURCHASE",
    "NON_RENEWING_PURCHASE",
    "RENEWAL",
    "UNCANCELLATION",
    "SUBSCRIPTION_EXTENDED",
    "TEMPORARY_ENTITLEMENT_GRANT",
    "REFUND_REVERSED",
  ]);

  if (activeTypes.has(context.eventType) && hasPremiumEntitlement) {
    return {
      isPremium: !expiredByDate,
      subscriptionStatus: expiredByDate ? "expired" : "active",
    };
  }

  if (expiredByDate) {
    return { isPremium: false, subscriptionStatus: "expired" };
  }

  return {
    isPremium: null,
    subscriptionStatus: context.eventType ? context.eventType.toLowerCase() : "unknown",
  };
}

function isLikelyRevenueCatUserId(value: string | null): value is string {
  return !!value && !value.startsWith("$RCAnonymousID:");
}

async function resolveRevenueCatUserRef(context: RevenueCatContext): Promise<DocumentReference | null> {
  const candidates = [
    context.appUserId,
    context.originalAppUserId,
    ...context.aliases,
  ].filter(isLikelyRevenueCatUserId);

  for (const candidate of candidates) {
    const directRef = db.collection("users").doc(candidate);
    const directSnap = await directRef.get();
    if (directSnap.exists) {
      return directRef;
    }

    const querySnap = await db
      .collection("users")
      .where("revenueCatAppUserId", "==", candidate)
      .limit(1)
      .get();
    if (!querySnap.empty) {
      return querySnap.docs[0].ref;
    }
  }

  return candidates.length > 0 ? db.collection("users").doc(candidates[0]) : null;
}

function buildRevenueCatUserUpdate(
  context: RevenueCatContext,
  premiumMutation: PremiumMutation,
): Record<string, unknown> {
  const expiresAt = context.expiresAtMs ? new Date(context.expiresAtMs) : null;
  const purchasedAt = context.purchasedAtMs ? new Date(context.purchasedAtMs) : null;
  const eventAt = new Date(context.eventAtMs);
  const isAppStore = context.store === "APP_STORE";

  const updatePayload: Record<string, unknown> = {
    revenueCatAppUserId: context.appUserId,
    premiumSource: "revenuecat",
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
    lastVerifiedAt: FieldValue.serverTimestamp(),
    revenueCatUpdatedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };

  if (isAppStore) {
    updatePayload.appStoreProductId = context.productId;
    updatePayload.appStoreTransactionId = context.transactionId;
    updatePayload.appStoreOriginalTransactionId = context.originalTransactionId;
    updatePayload.appStoreExpiresAt = expiresAt;
    updatePayload.appStoreEnvironment = context.environment;
    updatePayload.appStoreLastVerifiedAt = FieldValue.serverTimestamp();
    updatePayload.appStoreUpdatedAt = FieldValue.serverTimestamp();
  }

  if (premiumMutation.isPremium !== null) {
    updatePayload.isPremium = premiumMutation.isPremium;
  }

  return updatePayload;
}

async function applyRevenueCatEventToUser(
  userRef: DocumentReference,
  context: RevenueCatContext,
  premiumMutation: PremiumMutation,
): Promise<ApplyNotificationResult> {
  const eventRef = db.collection("revenueCatEvents").doc(context.eventId);

  return db.runTransaction(async (tx) => {
    const [eventSnap, userSnap] = await Promise.all([tx.get(eventRef), tx.get(userRef)]);

    if (eventSnap.exists) {
      return { status: "duplicate" };
    }

    const currentEventAtMs = Number(userSnap.get("revenueCatLastEventAtMs") || 0);
    const isStale = currentEventAtMs > 0 && context.eventAtMs > 0 && context.eventAtMs < currentEventAtMs;

    tx.set(
      eventRef,
      {
        eventId: context.eventId,
        eventType: context.eventType || null,
        userId: userRef.id,
        appUserId: context.appUserId,
        originalAppUserId: context.originalAppUserId,
        aliases: context.aliases,
        entitlementIds: context.entitlementIds,
        productId: context.productId,
        store: context.store,
        environment: context.environment,
        transactionId: context.transactionId,
        originalTransactionId: context.originalTransactionId,
        expiresAt: context.expiresAtMs ? new Date(context.expiresAtMs) : null,
        eventAt: new Date(context.eventAtMs),
        eventAtMs: context.eventAtMs,
        status: isStale ? "stale" : "processed",
        createdAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    if (isStale) {
      return {
        status: "stale",
        userId: userRef.id,
        premiumMutation,
      };
    }

    tx.set(userRef, buildRevenueCatUserUpdate(context, premiumMutation), { merge: true });

    return {
      status: "processed",
      userId: userRef.id,
      premiumMutation,
    };
  });
}

async function applyNotificationToUser(
  userRef: DocumentReference,
  context: NotificationContext,
  premiumMutation: PremiumMutation,
): Promise<ApplyNotificationResult> {
  const eventRef = db.collection("appStoreNotifications").doc(context.notificationUUID);

  return db.runTransaction(async (tx) => {
    const [eventSnap, userSnap] = await Promise.all([tx.get(eventRef), tx.get(userRef)]);

    if (eventSnap.exists) {
      return { status: "duplicate" };
    }

    const currentEventAtMs = Number(userSnap.get("appStoreLastEventAtMs") || 0);
    const isStale = currentEventAtMs > 0 && context.eventAtMs > 0 && context.eventAtMs < currentEventAtMs;

    tx.set(
      eventRef,
      {
        notificationUUID: context.notificationUUID,
        notificationType: context.notificationType || null,
        subtype: context.subtype,
        userId: userRef.id,
        appAccountToken: context.appAccountToken,
        bundleId: context.bundleId,
        environment: context.environment,
        productId: context.productId,
        originalTransactionId: context.originalTransactionId,
        transactionId: context.transactionId,
        expiresAt: context.expiresAtMs ? new Date(context.expiresAtMs) : null,
        eventAt: new Date(context.eventAtMs),
        eventAtMs: context.eventAtMs,
        status: isStale ? "stale" : "processed",
        createdAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    if (isStale) {
      return {
        status: "stale",
        userId: userRef.id,
        premiumMutation,
      };
    }

    tx.set(userRef, buildUserSubscriptionUpdate(context, premiumMutation), { merge: true });

    return {
      status: "processed",
      userId: userRef.id,
      premiumMutation,
    };
  });
}

async function resolvePendingNotificationsForUser(userRef: DocumentReference, appAccountToken: string): Promise<number> {
  const pendingSnap = await db
    .collection("billingPending")
    .where("appAccountToken", "==", appAccountToken)
    .get();

  if (pendingSnap.empty) {
    return 0;
  }

  const pendingDocs = pendingSnap.docs
    .map((doc) => ({
      ref: doc.ref,
      data: doc.data() as PendingNotificationRecord,
    }))
    .sort((a, b) => Number(a.data.eventAtMs || 0) - Number(b.data.eventAtMs || 0));

  let applied = 0;

  for (const pending of pendingDocs) {
    const notificationType = `${pending.data.notificationType || ""}`.trim();
    const expiresAtMs =
      typeof pending.data.expiresAtMs === "number"
        ? pending.data.expiresAtMs
        : pending.data.expiresAt &&
            typeof pending.data.expiresAt === "object" &&
            typeof (pending.data.expiresAt as { toDate?: () => Date }).toDate === "function"
          ? (pending.data.expiresAt as { toDate: () => Date }).toDate().getTime()
          : pending.data.expiresAt instanceof Date
            ? pending.data.expiresAt.getTime()
            : null;
    const context: NotificationContext = {
      notificationUUID: pending.data.notificationUUID || pending.ref.id,
      notificationType,
      subtype: pending.data.subtype || null,
      appAccountToken,
      bundleId: pending.data.bundleId || null,
      environment: pending.data.environment || null,
      productId: pending.data.productId || null,
      originalTransactionId: pending.data.originalTransactionId || null,
      transactionId: pending.data.transactionId || null,
      expiresAtMs,
      eventAtMs: Number(pending.data.eventAtMs || 0) || Date.now(),
    };
    const premiumMutation = mapSubscriptionState(notificationType, {
      expiresDate: context.expiresAtMs || undefined,
    } as JWSTransactionDecodedPayload);

    const result = await applyNotificationToUser(userRef, context, premiumMutation);

    await pending.ref.set(
      {
        status: result.status === "processed" ? "resolved" : result.status,
        resolvedAt: FieldValue.serverTimestamp(),
        resolvedUserId: userRef.id,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    if (result.status === "processed") {
      applied += 1;
    }
  }

  return applied;
}

export const handleAppStoreNotification = onRequest(
  {
    region: "asia-northeast1",
    cors: false,
    secrets: [APPLE_IAP_ENCODED_KEY],
  },
  async (request, response) => {
    if (request.method !== "POST") {
      response.status(405).json({ ok: false, error: "method_not_allowed" });
      return;
    }

    let decodedNotification: ResponseBodyV2DecodedPayload;
    let transaction: JWSTransactionDecodedPayload | null = null;

    try {
      getAppStoreConfig();
      const signedPayload = getSignedPayload(request.body);

      if (!signedPayload) {
        response.status(400).json({ ok: false, error: "missing_signed_payload" });
        return;
      }

      const verifier = getVerifier();
      decodedNotification = await verifier.verifyAndDecodeNotification(signedPayload);

      if (decodedNotification.data?.signedTransactionInfo) {
        transaction = await verifier.verifyAndDecodeTransaction(
          decodedNotification.data.signedTransactionInfo,
        );
      }
    } catch (error) {
      logger.error("APPLE_IAP: verification failed", error);
      response.status(400).json({ ok: false, error: "verification_failed" });
      return;
    }

    const bundleId = APPLE_IAP_BUNDLE_ID.value().trim() || "com.impelf.meimay";
    const incomingBundleId =
      decodedNotification.data?.bundleId || transaction?.bundleId || null;

    if (incomingBundleId && incomingBundleId !== bundleId) {
      logger.warn("APPLE_IAP: bundleId mismatch", {
        expected: bundleId,
        actual: incomingBundleId,
      });
      response.status(400).json({ ok: false, error: "bundle_id_mismatch" });
      return;
    }

    const context = buildNotificationContext(decodedNotification, transaction);
    const notificationType = context.notificationType;

    if (notificationType === NotificationTypeV2.TEST) {
      response.status(200).json({ ok: true, testNotification: true });
      return;
    }

    if (!context.appAccountToken) {
      await storePendingNotification(context);
      logger.warn("APPLE_IAP: appAccountToken missing", {
        notificationType,
        notificationUUID: decodedNotification.notificationUUID,
      });
      response.status(200).json({ ok: true, ignored: "missing_app_account_token" });
      return;
    }

    const userRef = await resolveUserRef(context.appAccountToken);
    const premiumMutation = mapSubscriptionState(notificationType, transaction);

    if (!userRef) {
      await storePendingNotification(context);
      logger.warn("APPLE_IAP: user not linked yet", {
        appAccountToken: context.appAccountToken,
        notificationType,
      });
      response.status(200).json({ ok: true, ignored: "user_not_linked" });
      return;
    }

    const result = await applyNotificationToUser(userRef, context, premiumMutation);

    response.status(200).json({
      ok: true,
      status: result.status,
      userId: userRef.id,
      isPremium: premiumMutation.isPremium,
      subscriptionStatus: premiumMutation.subscriptionStatus,
    });
  },
);

export const handleRevenueCatWebhook = onRequest(
  {
    region: "asia-northeast1",
    cors: false,
    secrets: [REVENUECAT_WEBHOOK_AUTH],
  },
  async (request, response) => {
    if (request.method !== "POST") {
      response.status(405).json({ ok: false, error: "method_not_allowed" });
      return;
    }

    const expectedAuth = REVENUECAT_WEBHOOK_AUTH.value().trim();
    const actualAuth = getRevenueCatAuthorization(request);
    if (!expectedAuth || (actualAuth !== expectedAuth && actualAuth !== `Bearer ${expectedAuth}`)) {
      response.status(401).json({ ok: false, error: "unauthorized" });
      return;
    }

    const event = getRevenueCatEvent(request.body);
    if (!event) {
      response.status(400).json({ ok: false, error: "missing_event" });
      return;
    }

    const context = buildRevenueCatContext(event);
    const premiumMutation = mapRevenueCatPremiumState(context);

    if (context.eventType === "TEST") {
      response.status(200).json({ ok: true, testEvent: true });
      return;
    }

    const userRef = await resolveRevenueCatUserRef(context);
    if (!userRef) {
      await db.collection("revenueCatEvents").doc(context.eventId).set(
        {
          ...context,
          status: "pending_user_link",
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      logger.warn("REVENUECAT: user not resolved", {
        appUserId: context.appUserId,
        eventType: context.eventType,
        eventId: context.eventId,
      });
      response.status(200).json({ ok: true, ignored: "user_not_resolved" });
      return;
    }

    const result = await applyRevenueCatEventToUser(userRef, context, premiumMutation);

    response.status(200).json({
      ok: true,
      status: result.status,
      userId: userRef.id,
      isPremium: premiumMutation.isPremium,
      subscriptionStatus: premiumMutation.subscriptionStatus,
    });
  },
);

export const reconcilePendingAppStoreNotifications = onDocumentWritten(
  {
    document: "users/{userId}",
    region: "asia-northeast1",
  },
  async (event) => {
    const afterSnap = event.data?.after;
    if (!afterSnap?.exists) {
      return;
    }

    const afterData = afterSnap.data() || {};
    const beforeData = event.data?.before?.exists ? (event.data.before.data() || {}) : {};
    const appAccountToken = typeof afterData.appAccountToken === "string"
      ? afterData.appAccountToken.trim()
      : "";
    const beforeToken = typeof beforeData.appAccountToken === "string"
      ? beforeData.appAccountToken.trim()
      : "";

    if (!appAccountToken) {
      return;
    }

    const needsReconcile =
      appAccountToken !== beforeToken ||
      typeof afterData.subscriptionStatus !== "string" ||
      !afterData.lastVerifiedAt;

    if (!needsReconcile) {
      return;
    }

    const applied = await resolvePendingNotificationsForUser(afterSnap.ref, appAccountToken);

    if (applied > 0) {
      logger.info("APPLE_IAP: reconciled pending notifications", {
        userId: afterSnap.ref.id,
        appAccountToken,
        applied,
      });
    }
  },
);
