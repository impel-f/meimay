const {
  GoogleGenAI,
  ThinkingLevel,
} = require("@google/genai");
const {
  MODEL_PRIORITY_GROUPS,
  PRIMARY_MODEL_NAME,
  MODEL_CACHE_VERSION,
  buildModelCacheVersion,
} = require("./_lib/gemini-models");
const {
  FieldValue,
  getAdminFirestore,
  verifyRequestAuth,
} = require("./_lib/firebase-admin");
const { hasPremiumAccess } = require("./_lib/premium-access");

const MODEL_REQUEST_TIMEOUT_MS = 12_000;
const GEMINI_RATE_LIMIT_PER_MINUTE = 5;
const GEMINI_RATE_LIMIT_PER_DAY = 30;
const GEMINI_USAGE_COLLECTION = "gemini_api_usage";
const ALLOWED_TASK_TYPES = new Set(["kanjiFact", "nameOrigin"]);
const MAX_PROMPT_LENGTH = 16_000;

function getJstDateKey(date = new Date()) {
  return new Date(date.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function getMinuteKey(date = new Date()) {
  return date.toISOString().slice(0, 16);
}

function buildRateLimitUpdate(current = {}, date = new Date(), options = {}) {
  const minuteKey = getMinuteKey(date);
  const dateKey = getJstDateKey(date);
  const minuteCount = current.minuteKey === minuteKey
    ? Math.max(0, Number(current.minuteCount) || 0)
    : 0;
  const dailyCount = current.dateKey === dateKey
    ? Math.max(0, Number(current.dailyCount) || 0)
    : 0;

  const dailyUnlimited = options.dailyUnlimited === true;
  if (minuteCount >= GEMINI_RATE_LIMIT_PER_MINUTE
    || (!dailyUnlimited && dailyCount >= GEMINI_RATE_LIMIT_PER_DAY)) {
    const error = new Error("AI request limit exceeded. Please wait and try again.");
    error.statusCode = 429;
    error.code = "gemini_rate_limit_exceeded";
    throw error;
  }

  return {
    minuteKey,
    minuteCount: minuteCount + 1,
    dateKey,
    dailyCount: dailyCount + 1,
  };
}

async function enforceGeminiRateLimit(uid) {
  const db = getAdminFirestore();
  const usageRef = db.collection(GEMINI_USAGE_COLLECTION).doc(uid);
  await db.runTransaction(async (tx) => {
    const now = new Date();
    const premium = await hasPremiumAccess(tx, db, uid, now.getTime());
    const snapshot = await tx.get(usageRef);
    const update = buildRateLimitUpdate(
      snapshot.exists ? (snapshot.data() || {}) : {},
      now,
      { dailyUnlimited: premium.active }
    );
    tx.set(usageRef, {
      uid,
      ...update,
      dailyUnlimited: premium.active,
      premiumSource: premium.source || null,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  });
}

function validateGenerationPayload(body = {}) {
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  const taskType = typeof body.taskType === "string" ? body.taskType.trim() : "";
  if (!prompt || prompt.length > MAX_PROMPT_LENGTH) {
    const error = new Error("Prompt is required and must be within the allowed length.");
    error.statusCode = 400;
    throw error;
  }
  if (!ALLOWED_TASK_TYPES.has(taskType)) {
    const error = new Error("Unsupported AI task type.");
    error.statusCode = 400;
    throw error;
  }
  return { prompt, taskType };
}

function summarizeModelError(error) {
  if (!error || typeof error !== "object") {
    return "Unknown error";
  }

  const status = typeof error.status === "number" ? ` status=${error.status}` : "";
  const statusText =
    typeof error.statusText === "string" && error.statusText
      ? ` statusText=${error.statusText}`
      : "";
  return `${error.name || "Error"}: ${error.message || String(error)}${status}${statusText}`;
}

function isPrepaymentCreditsDepleted(error) {
  const message = `${error?.message || ""} ${error?.statusText || ""}`.toLowerCase();
  return (
    error?.status === 429 &&
    (message.includes("prepayment credits are depleted") ||
      (message.includes("credits") && message.includes("depleted")))
  );
}

function buildGenerationConfig(taskType = '') {
  const config = {
    maxOutputTokens: 2048,
    httpOptions: {
      timeout: MODEL_REQUEST_TIMEOUT_MS,
    },
  };
  if (taskType === 'kanjiFact') {
    config.maxOutputTokens = 4096;
    config.temperature = 0.1;
    config.tools = [{ googleSearch: {} }];
  } else if (taskType === 'nameOrigin') {
    config.maxOutputTokens = 1024;
    config.temperature = 0.35;
    config.thinkingConfig = { thinkingLevel: ThinkingLevel.LOW };
    config.responseMimeType = 'application/json';
    config.responseJsonSchema = {
      type: 'object',
      properties: {
        originDraft: {
          type: 'string',
          description: '入力された確認済みの漢字情報、またはかな名の一般語としての意味・表記・響きを根拠にした名づけ由来文案',
        },
      },
      required: ['originDraft'],
      additionalProperties: false,
    };
  }
  return config;
}

function extractGroundedTextSegments(groundingMetadata, responseText = "") {
  if (!Array.isArray(groundingMetadata?.groundingSupports)) return [];
  const normalizedResponseText = String(responseText || "");
  return [...new Set(groundingMetadata.groundingSupports
    .filter((support) => Array.isArray(support?.groundingChunkIndices)
      && support.groundingChunkIndices.length > 0)
    .map((support) => {
      const segmentText = String(support?.segment?.text || "").trim();
      if (!segmentText || !normalizedResponseText.includes(segmentText)) return segmentText;
      const segmentStart = normalizedResponseText.indexOf(segmentText);
      const lineStart = normalizedResponseText.lastIndexOf("\n", segmentStart - 1) + 1;
      const nextLineBreak = normalizedResponseText.indexOf("\n", segmentStart + segmentText.length);
      const lineEnd = nextLineBreak >= 0 ? nextLineBreak : normalizedResponseText.length;
      return normalizedResponseText.slice(lineStart, lineEnd).trim() || segmentText;
    })
    .filter(Boolean))];
}

async function generateWithFallback(ai, prompt, options = {}) {
  const attempts = [];
  let lastError = null;

  for (const group of MODEL_PRIORITY_GROUPS) {
    for (const modelName of group.candidates) {
      const startedAt = Date.now();
      const attempt = {
        label: group.label,
        modelName,
        ok: false,
        durationMs: 0,
      };
      attempts.push(attempt);
      console.log(`API: Trying ${group.label} (${modelName})`);

      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents: prompt,
          config: buildGenerationConfig(options.taskType),
        });
        const text = response.text;

        if (!text || !text.trim()) {
          throw new Error(`Empty response from ${group.label} (${modelName})`);
        }

        attempt.ok = true;
        attempt.durationMs = Date.now() - startedAt;

        return {
          text,
          modelName,
          groundingMetadata: response?.candidates?.[0]?.groundingMetadata || null,
          attempts,
        };
      } catch (error) {
        lastError = error;
        attempt.durationMs = Date.now() - startedAt;
        attempt.error = summarizeModelError(error);
        console.warn(
          `API: ${group.label} failed on ${modelName}: ${summarizeModelError(error)}`
        );

        if (isPrepaymentCreditsDepleted(error)) {
          const billingError = new Error(
            "Gemini API prepayment credits are depleted. Please add credits or update billing in AI Studio."
          );
          billingError.cause = error;
          billingError.statusCode = 402;
          billingError.attempts = attempts;
          throw billingError;
        }
      }
    }
  }

  const finalError = new Error(
    `AI Generation Failed after ${attempts.length} model attempt(s).` +
      (lastError ? ` Last failure: ${summarizeModelError(lastError)}` : "")
  );
  finalError.cause = lastError;
  finalError.attempts = attempts;
  throw finalError;
}

module.exports = async (req, res) => {
  // CORS Setup
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Cache-Control", "no-store, max-age=0");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method === "GET") {
    return res.status(200).json({
      primary_model: PRIMARY_MODEL_NAME,
      model_cache_version: MODEL_CACHE_VERSION,
    });
  }
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const auth = await verifyRequestAuth(req);
    const { prompt, taskType } = validateGenerationPayload(req.body || {});
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: "API key not configured" });
    }

    await enforceGeminiRateLimit(auth.uid);

    const ai = new GoogleGenAI({ apiKey });
    const { text, modelName, groundingMetadata, attempts } = await generateWithFallback(ai, prompt, { taskType });

    return res.status(200).json({
      text,
      debug_used_model: modelName,
      model_cache_version: buildModelCacheVersion(modelName),
      debug_grounding_queries: Array.isArray(groundingMetadata?.webSearchQueries)
        ? groundingMetadata.webSearchQueries
        : [],
      grounded_text_segments: extractGroundedTextSegments(groundingMetadata, text),
      debug_attempts: attempts,
    });
  } catch (error) {
    console.error("API Exception:", error);
    return res.status(error.statusCode || 500).json({
      error: "AI Generation Failed",
      details: error.message,
      code: error.code,
      attempts: error.attempts,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
};

module.exports._test = {
  MODEL_PRIORITY_GROUPS,
  PRIMARY_MODEL_NAME,
  MODEL_CACHE_VERSION,
  buildGenerationConfig,
  extractGroundedTextSegments,
  generateWithFallback,
  buildRateLimitUpdate,
  validateGenerationPayload,
  GEMINI_RATE_LIMIT_PER_MINUTE,
  GEMINI_RATE_LIMIT_PER_DAY,
};
