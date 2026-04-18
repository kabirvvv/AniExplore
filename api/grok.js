// POST /api/grok  { message: string, history: Array }
// FIX #6: Added input length limits and history cap to prevent
//         token exhaustion / DoS attacks.

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed." });

  try {
    const body   = req.body || {};
    const parsed = typeof body === "string" ? JSON.parse(body) : body;

    // FIX #6: Validate and cap inputs
    const message = parsed.message;
    if (!message || typeof message !== "string")
      return res.status(400).json({ error: "message is required." });
    if (message.trim().length === 0)
      return res.status(400).json({ error: "message cannot be empty." });
    if (message.length > 2000)
      return res.status(400).json({ error: "Message too long (max 2000 chars)." });

    // FIX #6: Cap history to last 20 turns to prevent oversized requests
    const rawHistory = Array.isArray(parsed.history) ? parsed.history : [];
    const history = rawHistory.slice(-20);

    // FIX #7: Correct env var name is GROQ_API_KEY (README said GROK_API_KEY — wrong)
    const key = process.env.GROQ_API_KEY;
    if (!key) return res.status(500).json({ error: "GROQ_API_KEY not configured." });

    const messages = [
      {
        role: "system",
        content:
          "You are a professional Anime Consultant named AniExplore AI. Keep responses concise and helpful. When recommending anime, mention titles, genres, and why they match. Use **bold** for anime titles.",
      },
      ...history.slice(1).map((m) => ({
        role: m.role === "user" ? "user" : "assistant",
        content: String(m.text || "").slice(0, 4000), // cap each history message too
      })),
      { role: "user", content: message },
    ];

    const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model:      "llama-3.3-70b-versatile",
        messages,
        max_tokens: 800,
      }),
    });

    const data = await groqRes.json();

    if (!groqRes.ok) {
      const isRateLimit = groqRes.status === 429;
      return res.status(groqRes.status).json({
        error: isRateLimit
          ? "RATE_LIMIT: AI is temporarily busy. Please wait 30 seconds and try again."
          : `Groq ${groqRes.status}: ${data.error?.message || data.error?.code || JSON.stringify(data)}`,
        isRateLimit,
      });
    }

    const reply = data.choices?.[0]?.message?.content || "No response from AI.";
    return res.status(200).json({ reply });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
