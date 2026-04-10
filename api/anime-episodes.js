// GET /api/anime-episodes?anipubId=10&title=Naruto
// Fetches BOTH sub and dub series from AniPub in parallel.
// anipubId is treated as the "primary" series — the API auto-detects whether
// it's sub or dub, then searches for the companion series by title.

const ANIPUB = "https://anipub.xyz";

const FETCH_HEADERS = {
  Accept: "application/json",
  "Cache-Control": "no-cache",
  Pragma: "no-cache",
};

// ── Helpers ──────────────────────────────────────────────────────────────────

const stripSrc = (link = "") => link.replace(/^src=/, "").trim();

function getAudioType(src = "") {
  if (src.includes("/dub")) return "dub";
  if (src.includes("/sub")) return "sub";
  return null;
}

// Fetch a single series from AniPub by numeric ID.
// Returns { id, type, episodes } or null on failure.
async function fetchSeriesById(id) {
  try {
    const res = await fetch(`${ANIPUB}/v1/api/details/${id}`, {
      headers: FETCH_HEADERS,
    });
    if (!res.ok) return null;

    const { local } = await res.json();
    if (!local?.link) return null;

    const episodes = [
      { number: 1, src: stripSrc(local.link) },
      ...(local.ep || []).map((e, i) => ({
        number: i + 2,
        src: stripSrc(e.link),
      })),
    ];

    // Detect type from the first episode URL
    const type = getAudioType(episodes[0]?.src || "");

    return { id, name: local.name || "", type, episodes };
  } catch {
    return null;
  }
}

// Search AniPub for a title, return all matching IDs (not just the first).
// AniPub often lists sub and dub as separate entries in search results.
async function searchAllIds(title) {
  const ids = [];

  // Try exact match first
  try {
    const res = await fetch(
      `${ANIPUB}/api/find/${encodeURIComponent(title.trim())}`,
      { headers: FETCH_HEADERS }
    );
    if (res.ok) {
      const d = await res.json();
      if (d.exist && d.id) ids.push(d.id);
    }
  } catch { /* ignore */ }

  // Fuzzy search — collect ALL results, not just first
  try {
    const res = await fetch(
      `${ANIPUB}/api/search/${encodeURIComponent(title.trim())}`,
      { headers: FETCH_HEADERS }
    );
    if (res.ok) {
      const d = await res.json();
      if (Array.isArray(d)) {
        for (const item of d) {
          const id = item.Id || item.id;
          if (id && !ids.includes(id)) ids.push(id);
        }
      }
    }
  } catch { /* ignore */ }

  return ids; // e.g. [42, 43]  — one sub, one dub
}

// ── Main Handler ─────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "OPTIONS") return res.status(200).end();

  const { anipubId, title, titleRomaji } = req.query;

  if (!anipubId && !title?.trim())
    return res.status(400).json({ error: "anipubId or title param required" });

  try {
    let candidateIds = [];

    // ── Step 1: collect candidate IDs ──────────────────────────────────────
    if (anipubId) {
      candidateIds.push(parseInt(anipubId));
    }

    // Always search by title too — this finds the COMPANION series
    // (e.g. anipubId may be the dub, but title search finds the sub too)
    const searchTitle = title?.trim() || titleRomaji?.trim();
    if (searchTitle) {
      const found = await searchAllIds(searchTitle);
      for (const id of found) {
        if (!candidateIds.includes(id)) candidateIds.push(id);
      }
    }

    if (!candidateIds.length)
      return res.status(404).json({ error: `"${title}" not found on AniPub.` });

    // ── Step 2: fetch all candidate series in parallel ──────────────────────
    const results = await Promise.all(candidateIds.map(fetchSeriesById));
    const validSeries = results.filter(Boolean);

    if (!validSeries.length)
      return res.status(404).json({ error: "No streaming links returned from AniPub." });

    // ── Step 3: separate sub and dub ────────────────────────────────────────
    // If multiple series return the same type, prefer the one with more episodes.
    const byType = { sub: null, dub: null };

    for (const series of validSeries) {
      const t = series.type; // "sub", "dub", or null
      if (!t) continue;
      if (!byType[t] || series.episodes.length > byType[t].episodes.length) {
        byType[t] = series;
      }
    }

    // ── Step 4: build unified episode list ──────────────────────────────────
    const allEpisodes = [];

    for (const type of ["sub", "dub"]) {
      const series = byType[type];
      if (!series) continue;
      for (const ep of series.episodes) {
        allEpisodes.push({
          number:    ep.number,
          src:       ep.src,
          audioType: type,            // ← explicit field so frontend doesn't guess
        });
      }
    }

    if (!allEpisodes.length)
      return res.status(404).json({ error: "Episodes found but audio type could not be detected." });

    const subCount = allEpisodes.filter((e) => e.audioType === "sub").length;
    const dubCount = allEpisodes.filter((e) => e.audioType === "dub").length;

    return res.status(200).json({
      anipubIdSub:    byType.sub?.id    ?? null,
      anipubIdDub:    byType.dub?.id    ?? null,
      subEpisodes:    subCount,
      dubEpisodes:    dubCount,
      totalEpisodes:  allEpisodes.length,
      episodes:       allEpisodes,
      // [{ number: 1, src: "https://anipub.xyz/video/42/sub",  audioType: "sub" },
      //  { number: 1, src: "https://anipub.xyz/video/43/dub",  audioType: "dub" }, ...]
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
