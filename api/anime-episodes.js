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
    // Build a rich candidate list to handle titles with colons, apostrophes, etc.
    // e.g. "Frieren: Beyond Journey's End" → AniPub needs "Frieren" or stripped form
    const buildCandidates = (t) => {
      if (!t) return [];
      const clean  = t.replace(/[^a-zA-Z0-9 ]/g, " ").replace(/\s+/g, " ").trim(); // strip special chars
      const keyword = t.split(/[:\s,]/)[0].trim(); // first word before colon/comma
      return [t, clean, keyword].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i);
    };

    const candidates = [
      ...buildCandidates(title.trim()),
      ...buildCandidates(titleRomaji?.trim()),
    ].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i);

    let anipubId = null;

    // Pass 1: /api/find/ — exact match, fast
    for (const t of candidates) {
      const r = await fetch(`${ANIPUB}/api/find/${encodeURIComponent(t)}`, { headers });
      if (r.ok) {
        const d = await r.json();
        if (d.exist && d.id) { anipubId = d.id; break; }
      }
    }

    // Pass 2: /api/search/ — fuzzy match
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
