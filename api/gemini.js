const { GoogleGenerativeAI } = require("@google/generative-ai");

module.exports = async (req, res) => {
  // CORS Check
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Dynamic Model Name Construction to avoid encoding issues
  // "gemini-1.5-pro"
  const MODEL_PARTS = ["gemini", "1.5", "pro"];
  const MODEL_NAME = MODEL_PARTS.join("-");

  try {
    const { prompt } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!prompt) {
      console.error('API Error: Prompt is missing');
      return res.status(400).json({ error: 'Prompt is required' });
    }

    if (!apiKey) {
      console.error('API Error: KEY missing');
      return res.status(500).json({ error: 'API key not configured' });
    }

    console.log(`API Start: Model=${MODEL_NAME}`);

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    console.log('API Success');

    return res.status(200).json({ text, debug_model: MODEL_NAME });

  } catch (error) {
    console.error('API Exception:', error);
    return res.status(500).json({
      error: 'AI Generation Failed',
      details: error.message,
      debug_model: MODEL_NAME, // Return what we TRIED to use
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};
