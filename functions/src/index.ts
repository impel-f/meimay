import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore, type DocumentReference } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { defineSecret, defineString } from "firebase-functions/params";
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
  appAccountToken: string | null,
  decodedNotification: ResponseBodyV2DecodedPayload,
  transaction: JWSTransactionDecodedPayload | null,
): Promise<void> {
  const notificationId = decodedNotification.notificationUUID || `missing-${Date.now()}`;
  await db.collection("billingPending").doc(notificationId).set(
    {
      appAccountToken,
      notificationType: decodedNotification.notificationType || null,
      subtype: decodedNotification.subtype || null,
      bundleId: decodedNotification.data?.bundleId || transaction?.bundleId || null,
      productId: transaction?.productId || null,
      originalTransactionId: transaction?.originalTransactionId || null,
      createdAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
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

    const appAccountToken = transaction?.appAccountToken?.trim() || null;
    const notificationType = `${decodedNotification.notificationType || ""}`.trim();

    if (notificationType === NotificationTypeV2.TEST) {
      response.status(200).json({ ok: true, testNotification: true });
      return;
    }

    if (!appAccountToken) {
      await storePendingNotification(null, decodedNotification, transaction);
      logger.warn("APPLE_IAP: appAccountToken missing", {
        notificationType,
        notificationUUID: decodedNotification.notificationUUID,
      });
      response.status(200).json({ ok: true, ignored: "missing_app_account_token" });
      return;
    }

    const userRef = await resolveUserRef(appAccountToken);
    const premiumMutation = mapSubscriptionState(notificationType, transaction);

    if (!userRef) {
      await storePendingNotification(appAccountToken, decodedNotification, transaction);
      logger.warn("APPLE_IAP: user not linked yet", {
        appAccountToken,
        notificationType,
      });
      response.status(200).json({ ok: true, ignored: "user_not_linked" });
      return;
    }

    const updatePayload: Record<string, unknown> = {
      appAccountToken,
      subscriptionStatus: premiumMutation.subscriptionStatus,
      appStoreLastNotificationType: notificationType || null,
      appStoreLastSubtype: decodedNotification.subtype || null,
      appStoreEnvironment:
        decodedNotification.data?.environment || transaction?.environment || null,
      appStoreProductId: transaction?.productId || null,
      appStoreOriginalTransactionId: transaction?.originalTransactionId || null,
      appStoreTransactionId: transaction?.transactionId || null,
      appStoreExpiresAt: transaction?.expiresDate
        ? new Date(transaction.expiresDate)
        : null,
      appStoreUpdatedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (premiumMutation.isPremium !== null) {
      updatePayload.isPremium = premiumMutation.isPremium;
    }

    await userRef.set(updatePayload, { merge: true });

    response.status(200).json({
      ok: true,
      userId: userRef.id,
      isPremium: premiumMutation.isPremium,
      subscriptionStatus: premiumMutation.subscriptionStatus,
    });
  },
);
