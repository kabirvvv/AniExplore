// GET /api/anime-episodes?slug={anipub_slug}&malId={mal_id}&titleRomaji={romaji}
// Tries multiple slug strategies to find the anime on AniPub

const ANIPUB = "https://api.anipub.xyz";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "s-maxage=600, stale-while-revalidate=120");
  if (req.method === "OPTIONS") return res.status(200).end();

  const { slug, malId, titleRomaji } = req.query;
  if (!slug) return res.status(400).json({ error: "slug param required" });

  // Build candidate slugs to try in order
  const candidates = buildCandidates(slug, titleRomaji);

  for (const candidate of candidates) {
    try {
      const r = await fetch(`${ANIPUB}/anime/api/${candidate}`, {
        headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0" },
      });
      if (!r.ok) continue;
      const json = await r.json();
      if (!json || json.error) continue;

      // Normalize the episode list — AniPub may return different shapes
      const episodes = normalizeEpisodes(json);
      if (!episodes.length) continue;

      return res.status(200).json({
        slug: candidate,
        title: json.Name || json.name || slug,
        episodes,
        hasSub: json.hasSub ?? true,
        hasDub: json.hasDub ?? false,
      });
    } catch (_) {
      continue;
    }
  }

  return res.status(404).json({ error: "Anime not found on AniPub. Try searching directly." });
}

// Try progressively looser slug variations
function buildCandidates(slug, titleRomaji) {
  const candidates = [slug];

  // Try romaji slug as well
  if (titleRomaji) {
    const romajiSlug = titleRomaji.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    if (romajiSlug !== slug) candidates.push(romajiSlug);
  }

  // Strip trailing "-season-1" / "-1st-season" artifacts
  const withoutSeason = slug
    .replace(/-\d+(st|nd|rd|th)-season$/, "")
    .replace(/-season-\d+$/, "")
    .replace(/-part-\d+$/, "");
  if (withoutSeason !== slug) candidates.push(withoutSeason);

  // Strip trailing year "-2023"
  const withoutYear = slug.replace(/-\d{4}$/, "");
  if (withoutYear !== slug && withoutYear !== withoutSeason) candidates.push(withoutYear);

  return [...new Set(candidates)]; // dedupe
}

function normalizeEpisodes(json) {
  // AniPub could return episodes as an array or nested object
  const raw = json.episodes || json.Episodes || json.episodeList || [];
  if (Array.isArray(raw)) {
    return raw.map((ep, i) => ({
      number: ep.number ?? ep.Number ?? ep.ep ?? i + 1,
      title:  ep.title  || ep.Title  || ep.name || `Episode ${i + 1}`,
      thumb:  ep.thumb  || ep.image  || ep.thumbnail || null,
    }));
  }
  // If it's a count (some APIs just return { episodes: 24 })
  if (typeof raw === "number" && raw > 0) {
    return Array.from({ length: raw }, (_, i) => ({
      number: i + 1,
      title:  `Episode ${i + 1}`,
      thumb:  null,
    }));
  }
  return [];
}
