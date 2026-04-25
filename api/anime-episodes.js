// GET /api/anime-episodes?anipubId=10&title=Naruto&titleRomaji=Naruto
//
// SUB/DUB FIX: Search ALL title variants (title + titleRomaji) so the
// companion series is always found. Strip dub qualifiers before searching
// so clicking a "Naruto (Dub)" card still finds the "Naruto" sub series.
// Fetch timeouts added to prevent Vercel function hangs.
// Promise.all capped at 8 IDs to avoid AniPub rate-limiting.

const ANIPUB = "https://anipub.xyz";

const FETCH_HEADERS = {
  Accept: "application/json",
  "Cache-Control": "no-cache",
  Pragma: "no-cache",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const stripSrc = (link = "") => link.replace(/^src=/, "").trim();

// Strip "(Dub)", "Dubbed", "(English Dub)" etc. from the END of a title
// so we can search for the sub companion of a dub card.
function stripDubSuffix(name = "") {
  return name
    .replace(/\s*[\[(]?\s*(dub|dubbed|english[\s-]dub)\s*[\])]?\s*$/i, "")
    .trim();
}

// Detect audio type from the series NAME, not the episode URL.
// AniPub consistently appends "(Dub)", "Dubbed", or "(English Dub)" to dub series.
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

// Fetch a single series from AniPub by numeric ID.
// Returns { id, name, type, episodes } or null on failure.
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

    const type = detectTypeFromName(local.name || "");
    return { id, name: local.name || "", type, episodes };
  } catch {
    return null;
  }
}

// Search AniPub for an array of title strings — collects ALL matching IDs.
// For each title we also search the dub-stripped version so that clicking
// a "(Dub)" card still finds its sub companion and vice versa.
async function searchAllIds(titles) {
  const seen = new Set();
  const ids  = [];

  for (const rawTitle of titles) {
    if (!rawTitle?.trim()) continue;
    const clean    = rawTitle.trim();
    const stripped = stripDubSuffix(clean);
    // Search both the original and the stripped version (deduped)
    const toSearch = [clean, ...(stripped !== clean ? [stripped] : [])];

    for (const t of toSearch) {
      // Exact match (/api/find/) — fast, high precision
      try {
        const res = await fetch(
          `${ANIPUB}/api/find/${encodeURIComponent(t)}`,
          { headers: FETCH_HEADERS, signal: AbortSignal.timeout(6000) }
        );
        if (res.ok) {
          const d = await res.json();
          if (d.exist && d.id) {
            const id = parseInt(d.id);
            if (Number.isFinite(id) && !seen.has(id)) { seen.add(id); ids.push(id); }
          }
        }
      } catch { /* ignore */ }

      // Fuzzy search (/api/search/) — catches companion sub/dub entries
      try {
        const res = await fetch(
          `${ANIPUB}/api/search/${encodeURIComponent(t)}`,
          { headers: FETCH_HEADERS, signal: AbortSignal.timeout(6000) }
        );
        if (res.ok) {
          const d = await res.json();
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

  if (!anipubId && !title?.trim() && !titleRomaji?.trim())
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

    // Search ALL title variants (title + titleRomaji) — not just one.
    // This is critical: searching both finds sub AND dub companions reliably.
    const searchTitles = [title?.trim(), titleRomaji?.trim()].filter(Boolean);
    if (searchTitles.length > 0) {
      const found = await searchAllIds(searchTitles);
      for (const id of found) {
        if (!candidateIds.includes(id)) candidateIds.push(id);
      }
    }

    if (!candidateIds.length)
      return res.status(404).json({ error: `"${title || titleRomaji || anipubId}" not found on AniPub.` });

    // ── Step 2: fetch all candidate series in parallel (capped at 8) ─────────
    // Cap prevents hammering AniPub and avoids Vercel 10s timeout.
    const cappedIds = candidateIds.slice(0, 8);
    const results   = await Promise.all(cappedIds.map(fetchSeriesById));
    const validSeries = results.filter(Boolean);

    if (!validSeries.length)
      return res.status(404).json({ error: "No streaming links returned from AniPub." });

    // ── Step 3: separate sub and dub ──────────────────────────────────────────
    // If multiple series resolve to the same type, prefer the one with more episodes.
    const byType = { sub: null, dub: null };

    for (const series of validSeries) {
      const t = series.type; // "sub" | "dub"
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
