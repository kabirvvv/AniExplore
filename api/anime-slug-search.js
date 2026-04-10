const ANIPUB = "https://anipub.xyz"; // ✅ fixed

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(200).end();

  const { q } = req.query;
  if (!q) return res.status(400).json({ error: "q param required" });

  try {
    // ✅ /api/search/:name — path param, not query string
    const r = await fetch(
      `${ANIPUB}/api/search/${encodeURIComponent(q)}`,
      {
        headers: {
          Accept: "application/json",
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
        },
        cache: "no-store",
      }
    );
    const json = await r.json();
    // Returns: [{ Name, Id, Image, finder }, ...]
    return res.status(200).json(json);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
