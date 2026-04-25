// GET /api/anime-episodes?anipubId=10&title=Naruto&titleRomaji=Naruto
//
// STRATEGY:
//   1. The card's own anipubId is ALWAYS trusted for its own audio type.
//      We fetch it first, determine if it's sub or dub, and lock it in.
//   2. We then search by title to find ONLY the companion type (the other one).
//      This ensures wrong search results can never override the card's own links.
//   3. stripDubSuffix() is applied before companion search so clicking a
//      "Naruto (Dub)" card still finds the "Naruto" sub series.

const ANIPUB = "https://anipub.xyz";

const FETCH_HEADERS = {
  Accept: "application/json",
  "Cache-Control": "no-cache",
  Pragma: "no-cache",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const stripSrc = (link = "") => link.replace(/^src=/, "").trim();

function stripDubSuffix(name = "") {
  return name
    .replace(/\s*[\[(]?\s*(dub|dubbed|english[\s-]dub)\s*[\])]?\s*$/i, "")
    .trim();
}

function detectTypeFromName(name = "") {
  const n = name.toLowerCase();
  if (
    n.includes("(dub)") ||
    n.includes("dubbed") ||
    n.includes("(english dub)") ||
    n.endsWith(" dub")
  ) {
    return "dub";
  }
  return "sub";
}

// Fetch a single series. Returns { id, name, type, episodes } or null.
async function fetchSeriesById(id) {
  try {
    const res = await fetch(`${ANIPUB}/v1/api/details/${id}`, {
      headers: FETCH_HEADERS,
      signal: AbortSignal.timeout(8000),
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

    return {
      id,
      name: local.name || "",
      type: detectTypeFromName(local.name || ""),
      episodes,
    };
  } catch {
    return null;
  }
}

// Search AniPub for the COMPANION series of the opposite type.
// We only call this after we know the primary type, so we look for the other one.
// Returns an array of candidate series of the given targetType.
async function findCompanion(titles, targetType) {
  const seen = new Set();
  const ids  = [];

  for (const rawTitle of titles) {
    if (!rawTitle?.trim()) continue;
    // Always search the dub-stripped version so "(Dub)" cards find their sub companion
    const stripped = stripDubSuffix(rawTitle.trim());
    const toSearch = [...new Set([rawTitle.trim(), stripped])];

    for (const t of toSearch) {
      // /api/find/ — exact match
      try {
        const r = await fetch(
          `${ANIPUB}/api/find/${encodeURIComponent(t)}`,
          { headers: FETCH_HEADERS, signal: AbortSignal.timeout(6000) }
        );
        if (r.ok) {
          const d = await r.json();
          if (d.exist && d.id) {
            const id = parseInt(d.id);
            if (Number.isFinite(id) && !seen.has(id)) { seen.add(id); ids.push(id); }
          }
        }
      } catch { /* ignore */ }

      // /api/search/ — fuzzy, finds companion sub/dub entries
      try {
        const r = await fetch(
          `${ANIPUB}/api/search/${encodeURIComponent(t)}`,
          { headers: FETCH_HEADERS, signal: AbortSignal.timeout(6000) }
        );
        if (r.ok) {
          const d = await r.json();
          if (Array.isArray(d)) {
            for (const item of d) {
              const id = parseInt(item.Id ?? item.id);
              if (Number.isFinite(id) && !seen.has(id)) { seen.add(id); ids.push(id); }
            }
          }
        }
      } catch { /* ignore */ }
    }
  }

  // Fetch each candidate (cap at 6) and return only those matching targetType
  const capped  = ids.slice(0, 6);
  const results = await Promise.all(capped.map(fetchSeriesById));
  return results.filter((s) => s && s.type === targetType);
}

// ── Main Handler ──────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "OPTIONS") return res.status(200).end();

  const { anipubId, title, titleRomaji } = req.query;

  if (!anipubId && !title?.trim() && !titleRomaji?.trim())
    return res.status(400).json({ error: "anipubId or title param required" });

  try {
    // ── Step 1: Fetch the primary series (the card's own ID) ─────────────────
    // This is ALWAYS trusted. We never override it with search results.
    let primary = null;

    if (anipubId) {
      const parsedId = parseInt(anipubId);
      if (!Number.isFinite(parsedId))
        return res.status(400).json({ error: "anipubId must be a valid integer." });
      primary = await fetchSeriesById(parsedId);
    }

    // If no anipubId (or fetch failed), fall back to title search for primary
    if (!primary && (title?.trim() || titleRomaji?.trim())) {
      const searchTitles = [title?.trim(), titleRomaji?.trim()].filter(Boolean);
      for (const t of searchTitles) {
        try {
          const r = await fetch(
            `${ANIPUB}/api/find/${encodeURIComponent(t)}`,
            { headers: FETCH_HEADERS, signal: AbortSignal.timeout(6000) }
          );
          if (r.ok) {
            const d = await r.json();
            if (d.exist && d.id) {
              primary = await fetchSeriesById(parseInt(d.id));
              if (primary) break;
            }
          }
        } catch { /* ignore */ }
      }
    }

    if (!primary)
      return res.status(404).json({
        error: `"${title || titleRomaji || anipubId}" not found on AniPub.`,
      });

    // ── Step 2: Find COMPANION series (opposite audio type) ───────────────────
    // Use title search, but exclude the primary ID so we don't duplicate.
    const companionType    = primary.type === "sub" ? "dub" : "sub";
    const searchTitles     = [title?.trim(), titleRomaji?.trim()].filter(Boolean);
    const companionCandidates = await findCompanion(searchTitles, companionType);

    // Pick companion with most episodes (if multiple found), exclude primary ID
    const companion = companionCandidates
      .filter((s) => s.id !== primary.id)
      .sort((a, b) => b.episodes.length - a.episodes.length)[0] || null;

    // ── Step 3: Build byType map ──────────────────────────────────────────────
    const byType = {
      [primary.type]:    primary,
      [companionType]:   companion,
    };

    // ── Step 4: Build unified episode list ────────────────────────────────────
    const allEpisodes = [];
    for (const type of ["sub", "dub"]) {
      const series = byType[type];
      if (!series) continue;
      for (const ep of series.episodes) {
        allEpisodes.push({ number: ep.number, src: ep.src, audioType: type });
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
