
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

    // Switched from XAI_API_KEY to GROQ_API_KEY
    const key = process.env.GROQ_API_KEY;
    if (!key) return res.status(500).json({ error: "GROQ_API_KEY not set." });

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

    // Groq uses an OpenAI-compatible endpoint, so only the URL and model name change
    const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile", // Groq-hosted Llama 3.3 70B
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
