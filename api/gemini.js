const {
  GoogleGenAI,
} = require("@google/genai");

const MODEL_REQUEST_TIMEOUT_MS = 12_000;

const MODEL_PRIORITY_GROUPS = [
  {
    label: "Gemini 3.6 Flash",
    candidates: ["gemini-3.6-flash"],
  },
  {
    label: "Gemini 3.5 Flash",
    candidates: ["gemini-3.5-flash"],
  },
  {
    label: "Gemini 3.5 Flash-Lite",
    candidates: ["gemini-3.5-flash-lite"],
  },
];

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

function buildGenerationConfig() {
  return {
    maxOutputTokens: 2048,
    httpOptions: {
      timeout: MODEL_REQUEST_TIMEOUT_MS,
    },
  };
}

async function generateWithFallback(ai, prompt) {
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
          config: buildGenerationConfig(),
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
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { prompt } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!prompt) return res.status(400).json({ error: "Prompt is required" });
    if (!apiKey) {
      return res.status(500).json({ error: "API key not configured" });
    }

    const ai = new GoogleGenAI({ apiKey });
    const { text, modelName, attempts } = await generateWithFallback(ai, prompt);

    return res.status(200).json({
      text,
      debug_used_model: modelName,
      debug_attempts: attempts,
    });
  } catch (error) {
    console.error("API Exception:", error);
    return res.status(error.statusCode || 500).json({
      error: "AI Generation Failed",
      details: error.message,
      attempts: error.attempts,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
};

module.exports._test = {
  MODEL_PRIORITY_GROUPS,
  buildGenerationConfig,
  generateWithFallback,
};
