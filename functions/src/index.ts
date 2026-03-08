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
