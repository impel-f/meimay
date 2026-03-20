const { cert, getApps, initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { FieldValue, getFirestore } = require('firebase-admin/firestore');

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
    try {
      const parsed = JSON.parse(serviceAccountJson);
      return {
        projectId: normalizeEnvText(parsed.project_id || parsed.projectId),
        clientEmail: normalizeEnvText(parsed.client_email || parsed.clientEmail),
        privateKey: normalizePrivateKey(parsed.private_key || parsed.privateKey),
      };
    } catch (error) {
      const parseError = new Error(`Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON: ${error.message}`);
      parseError.cause = error;
      throw parseError;
    }
  }

  return {
    projectId: normalizeEnvText(process.env.FIREBASE_PROJECT_ID),
    clientEmail: normalizeEnvText(process.env.FIREBASE_CLIENT_EMAIL),
    privateKey: normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY),
  };
}

function hasServiceAccountConfig() {
  const config = getServiceAccountConfig();
  return Boolean(config.projectId && config.clientEmail && config.privateKey);
}

function getFirebaseAdminApp() {
  const existingApps = getApps();
  if (existingApps.length > 0) return existingApps[0];

  if (!hasServiceAccountConfig()) {
    const error = new Error(
      'Firebase Admin credentials are not configured. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY.'
    );
    error.statusCode = 500;
    throw error;
  }

  return initializeApp({
    credential: cert(getServiceAccountConfig()),
  });
}

function getAdminFirestore() {
  return getFirestore(getFirebaseAdminApp());
}

function getAdminAuth() {
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

module.exports = {
  FieldValue,
  getAdminFirestore,
  hasServiceAccountConfig,
  verifyRequestAuth,
};
