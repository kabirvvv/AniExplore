export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  // Cache responses on Vercel's CDN for 5 minutes to reduce Jikan API hits
  res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=60");

  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const params = new URLSearchParams(req.query);
    const response = await fetch(`https://api.jikan.moe/v4/top/anime?${params.toString()}`);

    if (response.status === 429) {
      return res.status(429).json({ error: "Jikan rate limit hit. Please wait a moment and retry." });
    }
    if (!response.ok) {
      return res.status(response.status).json({ error: `Jikan API error: ${response.status}` });
    }

    const data = await response.json();
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
