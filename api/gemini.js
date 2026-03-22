const {
  GoogleGenerativeAI,
} = require("@google/generative-ai");

const MODEL_REQUEST_TIMEOUT_MS = 12_000;

const MODEL_PRIORITY_GROUPS = [
  {
    label: "Gemini 3 Flash",
    candidates: ["gemini-3-flash-preview"],
  },
  {
    label: "Gemini 2.5 Flash",
    candidates: ["gemini-2.5-flash", "gemini-2.5-flash-preview-09-2025"],
  },
  {
    label: "Gemini 3.1 Flash-Lite",
    candidates: ["gemini-3.1-flash-lite-preview"],
  },
  {
    label: "Gemini 2.5 Flash-Lite",
    candidates: ["gemini-2.5-flash-lite", "gemini-2.5-flash-lite-preview-09-2025"],
  },
  {
    label: "Gemma 3 27B",
    candidates: ["gemma-3-27b-it"],
  },
  {
    label: "Gemma 3 12B",
    candidates: ["gemma-3-12b-it"],
  },
  {
    label: "Gemma 3 4B",
    candidates: ["gemma-3-4b-it"],
  },
  {
    label: "Gemma 3 2B (tentative)",
    candidates: ["gemma-3-2b-it"],
  },
  {
    label: "Gemma 3 1B",
    candidates: ["gemma-3-1b-it"],
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

function buildModel(genAI, modelName) {
  return genAI.getGenerativeModel({
    model: modelName,
    generationConfig: {
maxOutputTokens: 2048,
      temperature: 0.2,
    },
  });
}

async function generateWithFallback(genAI, prompt) {
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
        const model = buildModel(genAI, modelName);
        const result = await model.generateContent(prompt, {
          timeout: MODEL_REQUEST_TIMEOUT_MS,
        });
        const response = await result.response;
        const text = response.text();

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

    const genAI = new GoogleGenerativeAI(apiKey);
    const { text, modelName, attempts } = await generateWithFallback(genAI, prompt);

    return res.status(200).json({
      text,
      debug_used_model: modelName,
      debug_attempts: attempts,
    });
  } catch (error) {
    console.error("API Exception:", error);
    return res.status(500).json({
      error: "AI Generation Failed",
      details: error.message,
      attempts: error.attempts,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
};
