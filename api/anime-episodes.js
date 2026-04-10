// GET /api/anime-episodes?anipubId=10
// Now accepts anipubId directly from the listing — zero title matching, zero slug guessing.
// Falls back to title search only if anipubId is not supplied.

const ANIPUB = "https://anipub.xyz";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "OPTIONS") return res.status(200).end();

  const { anipubId, title } = req.query;
  if (!anipubId && !title?.trim())
    return res.status(400).json({ error: "anipubId or title param required" });

  const headers = {
    Accept: "application/json",
    "Cache-Control": "no-cache",
    Pragma: "no-cache",
  };

  try {
    let resolvedId = anipubId ? parseInt(anipubId) : null;

    // ── Only runs if anipubId was NOT passed ──────────────────────────────────
    if (!resolvedId) {
      // Try exact match first
      const findRes = await fetch(
        `${ANIPUB}/api/find/${encodeURIComponent(title.trim())}`,
        { headers }
      );
      if (findRes.ok) {
        const d = await findRes.json();
        if (d.exist && d.id) resolvedId = d.id;
      }

      // Fuzzy search fallback
      if (!resolvedId) {
        const searchRes = await fetch(
          `${ANIPUB}/api/search/${encodeURIComponent(title.trim())}`,
          { headers }
        );
        if (searchRes.ok) {
          const d = await searchRes.json();
          if (Array.isArray(d) && d.length) resolvedId = d[0].Id;
        }
      }

      if (!resolvedId)
        return res.status(404).json({ error: `"${title}" not found on AniPub.` });
    }

    // ── Fetch streaming links ─────────────────────────────────────────────────
    // GET /v1/api/details/:id → { local: { link: "src=...", ep: [{ link }, ...] } }
    const detailRes = await fetch(`${ANIPUB}/v1/api/details/${resolvedId}`, { headers });
    if (!detailRes.ok)
      return res.status(detailRes.status).json({ error: `Details failed (${detailRes.status})` });

    const { local } = await detailRes.json();
    if (!local?.link)
      return res.status(404).json({ error: "No streaming links returned from AniPub." });

    // ── Build episode list ────────────────────────────────────────────────────
    // local.link       = EP 1  (has "src=" prefix — strip it)
    // local.ep[0].link = EP 2
    // local.ep[1].link = EP 3 … etc.
    const stripSrc = (link = "") => link.replace(/^src=/, "").trim();

    const episodes = [
      { number: 1, src: stripSrc(local.link) },
      ...(local.ep || []).map((e, i) => ({
        number: i + 2,
        src: stripSrc(e.link),
      })),
    ];

    return res.status(200).json({
      anipubId: resolvedId,
      title: local.name || title || "",
      totalEpisodes: episodes.length,
      episodes, // [{ number: 1, src: "https://www.anipub.xyz/video/2142/sub" }, ...]
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
