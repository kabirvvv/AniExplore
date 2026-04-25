// POST /api/grok  { message: string, history: Array }
// Fixes applied:
//   - Server-side rate limit (10 req/min per IP) — client cooldown was bypassable
//   - CORS restricted to ALLOWED_ORIGIN env var (no longer wildcard)
//   - Fetch timeout on Groq API call
//   - Input length limits and history cap retained

// ── Server-side rate limiter (in-memory, per serverless instance) ─────────────
// Not perfect across instances but stops burst/script attacks effectively.
const rateLimitMap = new Map(); // ip → { count, resetAt }
const RATE_LIMIT   = 10;        // requests per minute per IP
const RATE_WINDOW  = 60_000;    // 1 minute in ms

function isRateLimited(ip) {
  const now   = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW });
    return false;
  }
  if (entry.count >= RATE_LIMIT) return true;
  entry.count++;
  return false;
}

// ── CORS helper ───────────────────────────────────────────────────────────────
// Set ALLOWED_ORIGIN in your Vercel env vars (e.g. https://your-app.vercel.app).
// Falls back to blocking unknown origins. Same-origin requests (no Origin header)
// always pass through.
function resolveAllowedOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return "*"; // same-origin / server-to-server — allow
  const allowed = process.env.ALLOWED_ORIGIN;
  if (allowed && origin === allowed) return origin;
  // Also allow Vercel preview deployments for the same project
  const vercelUrl = process.env.VERCEL_URL;
  if (vercelUrl) {
    const projectSlug = vercelUrl.split(".")[0]; // e.g. "aniexplore"
    if (origin.includes(projectSlug)) return origin;
  }
  return "null"; // block unknown origins
}

// ── Handler ───────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  const allowedOrigin = resolveAllowedOrigin(req);
  res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")   return res.status(405).json({ error: "Method not allowed." });

  // ── Server-side rate limit ────────────────────────────────────────────────
  const ip = (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "unknown";
  if (isRateLimited(ip))
    return res.status(429).json({
      error: "RATE_LIMIT: Too many requests. Please wait a minute and try again.",
      isRateLimit: true,
    });

  try {
    const body   = req.body || {};
    const parsed = typeof body === "string" ? JSON.parse(body) : body;

    const message = parsed.message;
    if (!message || typeof message !== "string")
      return res.status(400).json({ error: "message is required." });
    if (message.trim().length === 0)
      return res.status(400).json({ error: "message cannot be empty." });
    if (message.length > 2000)
      return res.status(400).json({ error: "Message too long (max 2000 chars)." });

    // Cap history to last 20 turns
    const rawHistory = Array.isArray(parsed.history) ? parsed.history : [];
    const history    = rawHistory.slice(-20);

    const key = process.env.GROQ_API_KEY;
    if (!key) return res.status(500).json({ error: "GROQ_API_KEY not configured." });

    const messages = [
      {
        role: "system",
        content:
          "You are a professional Anime Consultant named AniExplore AI. Keep responses concise and helpful. When recommending anime, mention titles, genres, and why they match. Use **bold** for anime titles.",
      },
      ...history.slice(1).map((m) => ({
        role:    m.role === "user" ? "user" : "assistant",
        content: String(m.text || "").slice(0, 4000),
      })),
      { role: "user", content: message },
    ];

    const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      signal: AbortSignal.timeout(15_000), // 15s — Groq can be slow under load
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
      const isLimit = groqRes.status === 429;
      return res.status(groqRes.status).json({
        error: isLimit
          ? "RATE_LIMIT: AI is temporarily busy. Please wait 30 seconds and try again."
          : `Groq ${groqRes.status}: ${data.error?.message || data.error?.code || JSON.stringify(data)}`,
        isRateLimit: isLimit,
      });
    }

    const reply = data.choices?.[0]?.message?.content || "No response from AI.";
    return res.status(200).json({ reply });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
