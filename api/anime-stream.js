// GET /api/anime-stream?title={title}&ep={number}
// Uses confirmed AniPub endpoints:
//   1. GET https://anipub.xyz/api/find/:name  → { exist, id, ep }
//   2. GET https://anipub.xyz/api/search/:name → [{ Name, Id, Image, finder }]
//   3. GET https://anipub.xyz/v1/api/details/:id → { local: { link, ep[] } }
// Fix: Added AbortSignal.timeout(8000) to all fetch calls.

const ANIPUB = "https://anipub.xyz";

const apiFetch = (url) =>
  fetch(url, {
    signal: AbortSignal.timeout(8000),
    headers: { Accept: "application/json", "Cache-Control": "no-cache", Pragma: "no-cache" },
  });

const stripSrc = (link = "") => link.replace(/^src=/, "").trim();

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=30");
  if (req.method === "OPTIONS") return res.status(200).end();

  const { title, titleRomaji, ep } = req.query;

  if (!title && !titleRomaji)
    return res.status(400).json({ error: "title param required" });
  if (!ep)
    return res.status(400).json({ error: "ep param required" });

  const epNum = parseInt(ep);
  if (isNaN(epNum) || epNum < 1)
    return res.status(400).json({ error: "ep must be a positive integer" });

  try {
    let anipubId = null;
    const titleCandidates = [title, titleRomaji].filter(Boolean);

    for (const t of titleCandidates) {
      const r = await apiFetch(`${ANIPUB}/api/find/${encodeURIComponent(t.trim())}`);
      if (r.ok) {
        const d = await r.json();
        if (d.exist && d.id) { anipubId = d.id; break; }
      }
    }

    if (!anipubId) {
      for (const t of titleCandidates) {
        const r = await apiFetch(`${ANIPUB}/api/search/${encodeURIComponent(t.trim())}`);
        if (!r.ok) continue;
        const d = await r.json();
        if (Array.isArray(d) && d.length > 0) { anipubId = d[0].Id; break; }
      }
    }

    if (!anipubId)
      return res.status(404).json({ error: `"${title}" not found on AniPub.` });

    const detailRes = await apiFetch(`${ANIPUB}/v1/api/details/${anipubId}`);
    if (!detailRes.ok)
      return res.status(detailRes.status).json({ error: `Details fetch failed (${detailRes.status})` });

    const { local } = await detailRes.json();
    if (!local?.link)
      return res.status(404).json({ error: "No streaming links returned from AniPub." });

    const allEps = [
      { ep: 1, src: stripSrc(local.link) },
      ...(local.ep || []).map((e, i) => ({ ep: i + 2, src: stripSrc(e.link) })),
    ];

    const epEntry = allEps.find((e) => e.ep === epNum);
    if (!epEntry)
      return res.status(404).json({
        error: `Episode ${epNum} not available. AniPub has ${allEps.length} episodes.`,
        totalEpisodes: allEps.length,
      });

    return res.status(200).json({
      anipubId,
      title:         local.name || title,
      episode:       epNum,
      totalEpisodes: allEps.length,
      iframeSrc:     epEntry.src,
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
