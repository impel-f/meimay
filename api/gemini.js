const { GoogleGenerativeAI } = require("@google/generative-ai");

module.exports = async (req, res) => {
  // CORS Setup
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { prompt } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!prompt) return res.status(400).json({ error: 'Prompt is required' });
    if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

    console.log("API: Fetching available models...");

    // 1. Fetch available models first to ensure we use a valid one
    let targetModelName = 'gemini-pro'; // Default fallback
    let debugAvailable = [];

    try {
      const listRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
      if (!listRes.ok) throw new Error(`List fetch failed: ${listRes.status}`);

      const listData = await listRes.json();
      if (listData.models) {
        debugAvailable = listData.models.map(m => m.name);
        console.log("API: Available models:", debugAvailable);

        // Prefer 1.5-flash, then 1.5-pro, then pro
        const preferred = [
          'gemini-1.5-flash',
          'gemini-1.5-pro',
          'gemini-pro',
          'gemini-1.0-pro'
        ];

        let found = null;
        for (const p of preferred) {
          // exact match or match with models/ prefix
          const match = listData.models.find(m => m.name === `models/${p}` || m.name === p);
          if (match) {
            // SDK usually wants "gemini-1.5-flash" without "models/" but supports both.
            // Let's clean it just in case.
            targetModelName = match.name.replace('models/', '');
            found = p;
            break;
          }
        }

        if (!found && listData.models.length > 0) {
          // If no preferred model found, use the first available gemini model
          const firstGemini = listData.models.find(m => m.name.includes('gemini'));
          if (firstGemini) {
            targetModelName = firstGemini.name.replace('models/', '');
          }
        }
      }
    } catch (listErr) {
      console.warn("API: Warning - could not list models, using fallback.", listErr);
    }

    console.log(`API: Selected Model = ${targetModelName}`);

    // 2. Generate Content
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: targetModelName });

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    return res.status(200).json({
      text,
      debug_used_model: targetModelName
    });

  } catch (error) {
    console.error('API Exception:', error);
    return res.status(500).json({
      error: 'AI Generation Failed',
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};
