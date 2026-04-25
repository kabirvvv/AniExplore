// GET /api/anime-search?q=one+piece&page=1
// Searches AniPub directly — returns anipub_id so episodes never need title matching.
// Fixes: fetch timeout, corrected hasNextPage logic, clamped page/limit.

const ANIPUB = "https://anipub.xyz";

const fixImage = (p) =>
  !p ? "" : p.startsWith("https://") ? p : `${ANIPUB}/${p}`;

function normalizeAnipub(item) {
  const img = fixImage(item.ImagePath || item.Image || "");
  return {
    anipub_id:         item._id || item.Id,
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
    score:    item.MALScore    || null,
    genres:   (item.Genres     || []).map((g, i) => ({ mal_id: i, name: g })),
    episodes: item.epCount     || null,
    status:   item.Status      || null,
    format:   item.format      || null,
    year:     item.Premiered   || null,
    studio:   item.Studios     || null,
    synopsis: item.DescripTion || null,
  };
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "s-maxage=120, stale-while-revalidate=60");
  if (req.method === "OPTIONS") return res.status(200).end();

  const { q } = req.query;
  if (!q?.trim()) return res.status(400).json({ error: "q param required" });

  const page  = Math.max(parseInt(req.query.page)  || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit) || 24, 1), 50);

  try {
    const r = await fetch(
      `${ANIPUB}/api/searchall/${encodeURIComponent(q.trim())}?page=${page}`,
      {
        signal:  AbortSignal.timeout(8000),
        headers: { Accept: "application/json", "Cache-Control": "no-cache" },
      }
    );
    if (!r.ok) return res.status(r.status).json({ error: `AniPub error: ${r.status}` });

    const json  = await r.json();
    const items = json.AniData || (Array.isArray(json) ? json : []);
    const data  = items.map(normalizeAnipub);

    return res.status(200).json({
      data,
      pagination: {
        currentPage: json.currentPage || page,
        // AniPub controls its own page size so we can't compare against limit.
        // Show Load More as long as the page returned results.
        hasNextPage: data.length > 0,
        perPage:     data.length,
      },
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
