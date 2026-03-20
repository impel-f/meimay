const {
  GoogleGenerativeAI,
  GoogleGenerativeAIRequestInputError,
} = require("@google/generative-ai");

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
];

function summarizeModelError(error) {
  if (!error || typeof error !== "object") {
    return "Unknown error";
  }

  const status = typeof error.status === "number" ? ` status=${error.status}` : "";
  return `${error.name || "Error"}: ${error.message || String(error)}${status}`;
}

async function generateWithFallback(genAI, prompt) {
  const attempts = [];
  let lastError = null;

  for (const group of MODEL_PRIORITY_GROUPS) {
    for (const modelName of group.candidates) {
      attempts.push(modelName);
      console.log(`API: Trying ${group.label} (${modelName})`);

      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        if (!text || !text.trim()) {
          throw new Error(`Empty response from ${group.label} (${modelName})`);
        }

        return {
          text,
          modelName,
          attempts,
        };
      } catch (error) {
        lastError = error;
        console.warn(
          `API: ${group.label} failed on ${modelName}: ${summarizeModelError(error)}`
        );

        if (error instanceof GoogleGenerativeAIRequestInputError) {
          throw error;
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

    const genAI = new GoogleGenerativeAI(apiKey);
    const { text, modelName } = await generateWithFallback(genAI, prompt);

    return res.status(200).json({
      text,
      debug_used_model: modelName,
    });
  } catch (error) {
    console.error("API Exception:", error);
    return res.status(500).json({
      error: "AI Generation Failed",
      details: error.message,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
};
