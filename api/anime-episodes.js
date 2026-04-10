// GET /api/anime-episodes?title={title}
// Uses confirmed AniPub endpoints:
//   1. GET https://anipub.xyz/api/find/:name  → { exist, id, ep }
//   2. GET https://anipub.xyz/v1/api/details/:id → { local: { link, ep[] } }

const ANIPUB = "https://anipub.xyz";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "OPTIONS") return res.status(200).end();

  const { title, titleRomaji } = req.query;
  if (!title?.trim()) return res.status(400).json({ error: "title param required" });

  const headers = {
    Accept: "application/json",
    "Cache-Control": "no-cache",
    Pragma: "no-cache",
  };

  try {
    // ── Step 1: resolve AniPub ID ─────────────────────────────────────────────
    // Try all title candidates with /api/find/ first (exact, fast)
    // then fall back to /api/search/ (fuzzy)
    let anipubId = null;
    const candidates = [title.trim(), titleRomaji?.trim()].filter(Boolean);

    for (const t of candidates) {
      const r = await fetch(`${ANIPUB}/api/find/${encodeURIComponent(t)}`, { headers });
      if (r.ok) {
        const d = await r.json();
        if (d.exist && d.id) { anipubId = d.id; break; }
      }
    }

    // Fallback: /api/search/ → [{ Name, Id, Image, finder }]
    if (!anipubId) {
      for (const t of candidates) {
        const r = await fetch(`${ANIPUB}/api/search/${encodeURIComponent(t)}`, { headers });
        if (!r.ok) continue;
        const d = await r.json();
        if (Array.isArray(d) && d.length > 0) { anipubId = d[0].Id; break; }
      }
      if (!anipubId) {
        return res.status(404).json({ error: `"${title}" not found on AniPub.` });
      }
    }

    // ── Step 2: get streaming links ───────────────────────────────────────────
    // GET /v1/api/details/:id → { local: { link: "src=...", ep: [{ link }, ...] } }
    const detailRes = await fetch(`${ANIPUB}/v1/api/details/${anipubId}`, { headers });
    if (!detailRes.ok) {
      return res.status(detailRes.status).json({ error: `Details fetch failed (${detailRes.status})` });
    }

    const { local } = await detailRes.json();
    if (!local?.link) {
      return res.status(404).json({ error: "No streaming links returned from AniPub." });
    }

    // ── Step 3: build episode list ────────────────────────────────────────────
    // local.link       = EP 1  (strip "src=" prefix)
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
      anipubId,
      title: local.name || title,
      totalEpisodes: episodes.length,
      episodes,
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
