// GET /api/top-anime?page=1&limit=24
// Top-rated MANGA from AniList.
// Fixes: corrected Cache-Control (no-cache conflicted with s-maxage), clamped page/limit,
//        added fetch timeout.

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  // Fixed: removed "no-cache" which contradicted s-maxage and disabled CDN caching
  res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=60");
  if (req.method === "OPTIONS") return res.status(200).end();

  const limit = Math.min(Math.max(parseInt(req.query.limit) || 24, 1), 50);
  const page  = Math.min(Math.max(parseInt(req.query.page)  || 1,  1), 500);

  const query = `
    query ($perPage: Int, $page: Int) {
      Page(page: $page, perPage: $perPage) {
        pageInfo { total currentPage hasNextPage }
        media(
          type: MANGA,
          sort: [SCORE_DESC],
          status_not: NOT_YET_RELEASED,
          format_in: [MANGA, ONE_SHOT],
          isAdult: false
        ) {
          id
          idMal
          title { romaji english native }
          coverImage { extraLarge large }
          averageScore
          genres
          chapters
          status
          format
          description(asHtml: false)
        }
      }
    }
  `;

  try {
    const response = await fetch("https://graphql.anilist.co", {
      method:  "POST",
      signal:  AbortSignal.timeout(10_000),
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body:    JSON.stringify({ query, variables: { perPage: limit, page } }),
    });

    if (!response.ok)
      return res.status(response.status).json({ error: `AniList error: ${response.status}` });

    const json = await response.json();
    if (json.errors)
      return res.status(400).json({ error: json.errors[0]?.message || "AniList query error" });

    const pageInfo = json.data?.Page?.pageInfo || {};
    const media    = json.data?.Page?.media    || [];

    const data = media.map((m) => ({
      mal_id:         m.idMal,
      anilist_id:     m.id,
      title:          m.title.english || m.title.romaji,
      title_english:  m.title.english,
      title_romaji:   m.title.romaji,
      title_japanese: m.title.native,
      images: {
        webp: {
          large_image_url: m.coverImage.extraLarge || m.coverImage.large,
          image_url:       m.coverImage.large,
        },
        jpg: { large_image_url: m.coverImage.extraLarge || m.coverImage.large },
      },
      score:    m.averageScore ? (m.averageScore / 10).toFixed(1) : null,
      genres:   (m.genres || []).map((g, i) => ({ mal_id: i, name: g })),
      chapters: m.chapters,
      status:   m.status,
      format:   m.format,
      synopsis: m.description,
    }));

    return res.status(200).json({
      data,
      pagination: {
        total:       pageInfo.total || data.length,
        currentPage: pageInfo.currentPage || page,
        hasNextPage: pageInfo.hasNextPage ?? false,
        perPage:     limit,
      },
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
