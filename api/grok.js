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

    const key = process.env.XAI_API_KEY;
    if (!key) return res.status(500).json({ error: "XAI_API_KEY not set." });

    // Build conversation history for multi-turn memory
    const messages = [
      {
        role: "system",
        content:
          "You are a professional Anime Consultant named AniExplore AI. Keep responses concise and helpful. When recommending anime, mention titles, genres, and why they match. Use **bold** for anime titles.",
      },
      // Include previous messages (skip the hardcoded greeting at index 0)
      ...history.slice(1).map((m) => ({
        role: m.role === "user" ? "user" : "assistant",
        content: m.text,
      })),
      // Add the new user message
      { role: "user", content: message },
    ];

    const xaiRes = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: "grok-3-mini-beta",
        messages,
        max_tokens: 800,
      }),
    });

    const data = await xaiRes.json();

    if (!xaiRes.ok) {
      const isRateLimit = xaiRes.status === 429;
      // Return full error details so we can debug exactly what xAI is rejecting
      return res.status(xaiRes.status).json({
        error: isRateLimit
          ? "RATE_LIMIT: AI is temporarily busy. Please wait 30 seconds and try again."
          : `xAI ${xaiRes.status}: ${data.error?.message || data.error?.code || JSON.stringify(data)}`,
        isRateLimit,
      });
    }

    const reply = data.choices?.[0]?.message?.content || "No response from AI.";
    return res.status(200).json({ reply });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
