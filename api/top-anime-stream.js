// GET /api/top-anime-stream?page=1&limit=24
// Fetches top-rated ANIME from AniPub directly (no AniList).
// AniPub response includes _id so anime-episodes never needs title matching.

const ANIPUB = "https://anipub.xyz";

const fixImage = (p) =>
  !p ? "" : p.startsWith("https://") ? p : `${ANIPUB}/${p}`;

function normalizeAnipub(item) {
  const img = fixImage(item.ImagePath || item.Image || "");
  return {
    anipub_id:         item._id || item.Id,           // ← used directly in anime-episodes
    anipub_finder:     item.finder || null,
    title:             item.Name,
    title_english:     item.Name,
    title_romaji:      item.Synonyms || item.Name,
    title_japanese:    null,
    anipub_find_title: item.Name,
    images: {
      webp: { large_image_url: img, image_url: img },
      jpg:  { large_image_url: img },
    },
    score:    item.MALScore   || null,
    genres:   (item.Genres    || []).map((g, i) => ({ mal_id: i, name: g })),
    episodes: item.epCount    || null,
    status:   item.Status     || null,
    format:   item.format     || null,
    year:     item.Premiered  || null,
    studio:   item.Studios    || null,
    synopsis: item.DescripTion || null,
  };
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=60");
  if (req.method === "OPTIONS") return res.status(200).end();

  const page = parseInt(req.query.page) || 1;

  try {
    // GET /api/findbyrating?page=N → { currentPage, AniData: [...] }
    const r = await fetch(`${ANIPUB}/api/findbyrating?page=${page}`, {
      headers: { Accept: "application/json", "Cache-Control": "no-cache" },
    });
    if (!r.ok) return res.status(r.status).json({ error: `AniPub error: ${r.status}` });

    const json = await r.json();
    const items = json.AniData || json.data || [];

    // Fetch full info for each item to get epCount, Genres, Studios etc.
    // AniPub /api/findbyrating only returns minimal fields — enrich with /api/info/:id
    // But to avoid 24 extra requests we return what we have and let the detail page fetch more.
    const data = items.map(normalizeAnipub);

    return res.status(200).json({
      data,
      pagination: {
        currentPage: json.currentPage || page,
        hasNextPage: data.length > 0,
        perPage:     data.length,
      },
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
