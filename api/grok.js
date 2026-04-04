export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed." });

  try {
    const body = req.body || {};
    const parsed = typeof body === "string" ? JSON.parse(body) : body;
    const message = parsed.message;
    const history = parsed.history || [];

    if (!message) return res.status(400).json({ error: "message is required." });

    const key = process.env.GEMINI_API_KEY;
    if (!key) return res.status(500).json({ error: "GEMINI_API_KEY not set." });

    // Build full conversation history for Gemini so it has memory of the chat
    const contents = [
      // Include previous messages (skip the initial assistant greeting at index 0)
      ...history
        .slice(1) // skip the hardcoded "System Online" greeting
        .map((m) => ({
          role: m.role === "user" ? "user" : "model",
          parts: [{ text: m.text }],
        })),
      // Add the new user message
      { role: "user", parts: [{ text: message }] },
    ];

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: {
            parts: [
              {
                text: "You are a professional Anime Consultant named AniExplore AI. Keep responses concise and helpful. When recommending anime, mention titles, genres, and why they match. Use **bold** for anime titles.",
              },
            ],
          },
          contents,
          generationConfig: { maxOutputTokens: 800 },
        }),
      }
    );

    const data = await geminiRes.json();

    if (!geminiRes.ok) {
      const isRateLimit = geminiRes.status === 429;
      return res.status(geminiRes.status).json({
        error: isRateLimit
          ? "RATE_LIMIT: AI is temporarily busy. Please wait 30 seconds and try again."
          : data.error?.message || "Gemini API error.",
        isRateLimit,
      });
    }

    const reply =
      data.candidates?.[0]?.content?.parts?.[0]?.text || "No response from AI.";
    return res.status(200).json({ reply });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
