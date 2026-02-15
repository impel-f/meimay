const { GoogleGenerativeAI } = require("@google/generative-ai");

module.exports = async (req, res) => {
  // CORS設定（通信許可）
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { prompt } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!prompt) {
      console.error('API Error: Prompt is missing');
      return res.status(400).json({ error: 'Prompt is required' });
    }

    if (!apiKey) {
      console.error('API Error: GEMINI_API_KEY is not set in environment variables');
      return res.status(500).json({ error: 'API key configuration missing' });
    }

    console.log(`API Start: Length of prompt = ${prompt.length}`);

    const MODEL_NAME = "gemini-pro";
    console.log(`API Model: Using model ${MODEL_NAME}`);
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    console.log('API Success: Generated text length =', text.length);

    return res.status(200).json({ text });
  } catch (error) {
    console.error('Gemini API Exception:', error);
    // Return the actual error message to help debugging (in dev/admin contexts)
    return res.status(500).json({
      error: 'AI Generation Failed',
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};
