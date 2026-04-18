// GET /api/anime-episodes?anipubId=10&title=Naruto&titleRomaji=Naruto
//
// FIX #1: Always search by title alongside anipubId to find the companion
//         series (dub if sub was provided, sub if dub was provided).
// FIX #2: Replaced fragile URL-sniffing getAudioType() with name-based
//         detection — AniPub consistently names dub series with "(Dub)"
//         or "Dubbed" in the title. URL /sub /dub is unreliable.

const ANIPUB = "https://anipub.xyz";

const FETCH_HEADERS = {
  Accept: "application/json",
  "Cache-Control": "no-cache",
  Pragma: "no-cache",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const stripSrc = (link = "") => link.replace(/^src=/, "").trim();

// FIX #2: Detect audio type from the series NAME, not the episode URL.
// AniPub consistently appends "(Dub)", "Dubbed", or "(English Dub)" to dub series.
function detectTypeFromName(name = "") {
  const n = name.toLowerCase();
  if (
    n.includes("(dub)") ||
    n.includes(" dub)") ||
    n.includes("dubbed") ||
    n.includes("(english dub)") ||
    n.endsWith(" dub")
  ) {
    return "dub";
  }
  // Everything else is sub (original audio)
  return "sub";
}

// Fetch a single series from AniPub by numeric ID.
// Returns { id, name, type, episodes } or null on failure.
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
    ].filter((e) => e.src);

    if (!episodes.length) return null;

    // FIX #2: Type from series name, not URL
    const type = detectTypeFromName(local.name || "");

    return { id, name: local.name || "", type, episodes };
  } catch {
    return null;
  }
}

// Search AniPub for a title — collects ALL matching IDs (sub + dub are separate entries).
async function searchAllIds(title) {
  const ids = [];

  // Exact match first (/api/find/)
  try {
    const res = await fetch(
      `${ANIPUB}/api/find/${encodeURIComponent(title.trim())}`,
      { headers: FETCH_HEADERS }
    );
    if (res.ok) {
      const d = await res.json();
      if (d.exist && d.id) ids.push(parseInt(d.id));
    }
  } catch { /* ignore */ }

  // Fuzzy search — collects ALL results including "(Dub)" companion
  try {
    const res = await fetch(
      `${ANIPUB}/api/search/${encodeURIComponent(title.trim())}`,
      { headers: FETCH_HEADERS }
    );
    if (res.ok) {
      const d = await res.json();
      if (Array.isArray(d)) {
        for (const item of d) {
          const id = parseInt(item.Id ?? item.id);
          if (Number.isFinite(id) && !ids.includes(id)) ids.push(id);
        }
      }
    }
  } catch { /* ignore */ }

  return ids;
}

// ── Main Handler ──────────────────────────────────────────────────────────────

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

    // ── Step 1: collect candidate IDs ────────────────────────────────────────
    if (anipubId) {
      const parsedId = parseInt(anipubId);
      if (!Number.isFinite(parsedId))
        return res.status(400).json({ error: "anipubId must be a valid integer." });
      candidateIds.push(parsedId);
    }

    // FIX #1: ALWAYS search by title too — even when anipubId is provided.
    // This finds the COMPANION series (dub series if sub ID was given, and vice versa).
    // Previously this branch was skipped when anipubId was present, which is why
    // the toggle always showed 0 episodes on one side.
    const searchTitle = title?.trim() || titleRomaji?.trim();
    if (searchTitle) {
      const found = await searchAllIds(searchTitle);
      for (const id of found) {
        if (!candidateIds.includes(id)) candidateIds.push(id);
      }
    }

    if (!candidateIds.length)
      return res.status(404).json({ error: `"${searchTitle || anipubId}" not found on AniPub.` });

    // ── Step 2: fetch all candidate series in parallel ────────────────────────
    const results = await Promise.all(candidateIds.map(fetchSeriesById));
    const validSeries = results.filter(Boolean);

    if (!validSeries.length)
      return res.status(404).json({ error: "No streaming links returned from AniPub." });

    // ── Step 3: separate sub and dub ──────────────────────────────────────────
    // If multiple series resolve to the same type, prefer the one with more episodes.
    const byType = { sub: null, dub: null };

    for (const series of validSeries) {
      const t = series.type; // always "sub" or "dub" now (no null)
      if (!byType[t] || series.episodes.length > byType[t].episodes.length) {
        byType[t] = series;
      }
    }

    // ── Step 4: build unified episode list ────────────────────────────────────
    const allEpisodes = [];

    for (const type of ["sub", "dub"]) {
      const series = byType[type];
      if (!series) continue;
      for (const ep of series.episodes) {
        allEpisodes.push({
          number:    ep.number,
          src:       ep.src,
          audioType: type,
        });
      }
    }

    if (!allEpisodes.length)
      return res.status(404).json({ error: "No episodes could be built from AniPub data." });

    const subCount = allEpisodes.filter((e) => e.audioType === "sub").length;
    const dubCount = allEpisodes.filter((e) => e.audioType === "dub").length;

    return res.status(200).json({
      anipubIdSub:   byType.sub?.id    ?? null,
      anipubIdDub:   byType.dub?.id    ?? null,
      subName:       byType.sub?.name  ?? null,
      dubName:       byType.dub?.name  ?? null,
      subEpisodes:   subCount,
      dubEpisodes:   dubCount,
      totalEpisodes: allEpisodes.length,
      episodes:      allEpisodes,
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
