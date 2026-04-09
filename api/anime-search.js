export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "s-maxage=120, stale-while-revalidate=60");
  if (req.method === "OPTIONS") return res.status(200).end();

  const { q, limit = 24, page = 1 } = req.query;
  if (!q?.trim()) return res.status(400).json({ error: "q param required" });

  const gql = `
    query ($search: String, $perPage: Int, $page: Int) {
      Page(page: $page, perPage: $perPage) {
        pageInfo { total currentPage hasNextPage }
        media(search: $search, type: ANIME, sort: [SEARCH_MATCH], isAdult: false) {
          id idMal
          title { romaji english native }
          coverImage { extraLarge large }
          averageScore
          genres
          episodes
          status
          description(asHtml: false)
          format
          seasonYear
        }
      }
    }
  `;

  try {
    const r = await fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ query: gql, variables: { search: q.trim(), perPage: parseInt(limit), page: parseInt(page) } }),
    });
    const json = await r.json();
    if (!r.ok || json.errors) throw new Error(json.errors?.[0]?.message || `AniList ${r.status}`);

    const pageInfo = json.data.Page.pageInfo;
    const media    = json.data.Page.media || [];

    const data = media.map((m) => ({
      anilist_id: m.id,
      mal_id:     m.idMal,
      title:      m.title.english || m.title.romaji,
      title_english: m.title.english,
      title_romaji:  m.title.romaji,
      title_japanese: m.title.native,
      anipub_slug: toSlug(m.title.english || m.title.romaji),
      images: {
        webp: { large_image_url: m.coverImage.extraLarge || m.coverImage.large, image_url: m.coverImage.large },
        jpg:  { large_image_url: m.coverImage.extraLarge || m.coverImage.large },
      },
      score:    m.averageScore ? (m.averageScore / 10).toFixed(1) : null,
      genres:   (m.genres || []).map((g, i) => ({ mal_id: i, name: g })),
      episodes: m.episodes,
      status:   m.status,
      format:   m.format,
      year:     m.seasonYear,
      synopsis: m.description,
    }));

    return res.status(200).json({
      data,
      pagination: {
        total: pageInfo.total || data.length,
        currentPage: pageInfo.currentPage || parseInt(page),
        hasNextPage: pageInfo.hasNextPage ?? false,
        perPage: parseInt(limit),
      },
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

function toSlug(title = "") {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
