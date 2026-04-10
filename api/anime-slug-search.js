const ANIPUB = "https://anipub.xyz";

// AniPub image paths can be relative (e.g. "One-Piece.jpg") — prepend base URL
const fixImage = (p) =>
  !p ? "" : p.startsWith("https://") ? p : `${ANIPUB}/${p}`;

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "s-maxage=120, stale-while-revalidate=60");
  if (req.method === "OPTIONS") return res.status(200).end();

  const { q } = req.query;
  if (!q) return res.status(400).json({ error: "q param required" });

  try {
    // GET /api/search/:name — path param, returns [{ Name, Id, Image, finder }, ...]
    const r = await fetch(
      `${ANIPUB}/api/search/${encodeURIComponent(q)}`,
      {
        headers: {
          Accept: "application/json",
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
        },
      }
    );

    if (!r.ok)
      return res.status(r.status).json({ error: `AniPub error: ${r.status}` });

    const json = await r.json();

    // Fix relative image paths before returning to client
    if (!Array.isArray(json)) return res.status(200).json(json);
    const fixed = json.map((item) => ({ ...item, Image: fixImage(item.Image) }));

    return res.status(200).json(fixed);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
