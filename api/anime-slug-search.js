const ANIPUB = "https://api.anipub.xyz";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(200).end();

  const { q } = req.query;
  if (!q) return res.status(400).json({ error: "q param required" });

  try {
    const r = await fetch(`${ANIPUB}/anime/api/search?q=${encodeURIComponent(q)}`, {
      headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0" },
    });
    const text = await r.text();
    let json;
    try { json = JSON.parse(text); } catch (_) {
      return res.status(500).json({ error: "Invalid JSON from AniPub", raw: text.slice(0, 300) });
    }
    return res.status(200).json(json);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
