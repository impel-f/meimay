const { GoogleGenerativeAI } = require("@google/generative-ai");

module.exports = async (req, res) => {
  // CORS Setup
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Safe Model Name Construction
  // "gemini-1.5-flash" constructed via char codes to avoid any source encoding issues
  // 45 is hyphen
  const MODEL_NAME = ['gemini', '1.5', 'flash'].join(String.fromCharCode(45));

  // Debug: Capture char codes
  const modelCodes = [];
  for (let i = 0; i < MODEL_NAME.length; i++) {
    modelCodes.push(MODEL_NAME.charCodeAt(i));
  }

  try {
    const { prompt } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!prompt) return res.status(400).json({ error: 'Prompt is required' });
    if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

    console.log(`API Start: Model=${MODEL_NAME}`);

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    return res.status(200).json({ text });

  } catch (error) {
    console.error('API Exception:', error);
    return res.status(500).json({
      error: 'AI Generation Failed',
      details: error.message,
      debug_model_str: MODEL_NAME,
      debug_model_codes: modelCodes, // Verify if hyphen is 45
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};
