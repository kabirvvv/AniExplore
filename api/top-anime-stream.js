export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=60");
  if (req.method === "OPTIONS") return res.status(200).end();

  const { limit = 24, page = 1 } = req.query;

  const query = `
    query ($perPage: Int, $page: Int) {
      Page(page: $page, perPage: $perPage) {
        pageInfo { total currentPage hasNextPage }
        media(
          type: ANIME,
          sort: [SCORE_DESC],
          status_not: NOT_YET_RELEASED,
          format_in: [TV, TV_SHORT, MOVIE, OVA, ONA, SPECIAL],
          isAdult: false
        ) {
          id
          idMal
          title { romaji english native }
          coverImage { extraLarge large }
          averageScore
          genres
          episodes
          status
          format
          seasonYear
          description(asHtml: false)
          studios(isMain: true) {
            nodes { name }
          }
        }
      }
    }
  `;

  try {
    const response = await fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        query,
        variables: { perPage: parseInt(limit), page: parseInt(page) },
      }),
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: `AniList error: ${response.status}` });
    }

    const json = await response.json();
    if (json.errors) {
      return res.status(400).json({ error: json.errors[0]?.message || "AniList query error" });
    }

    const pageInfo = json.data?.Page?.pageInfo || {};
    const media    = json.data?.Page?.media    || [];

    const data = media.map((m) => ({
      mal_id:         m.idMal,
      anilist_id:     m.id,
      title:          m.title.english || m.title.romaji,
      title_english:  m.title.english,
      title_romaji:   m.title.romaji,
      title_japanese: m.title.native,
      anipub_find_title: m.title.english || m.title.romaji,
      images: {
        webp: {
          large_image_url: m.coverImage.extraLarge || m.coverImage.large,
          image_url:       m.coverImage.large,
        },
        jpg: { large_image_url: m.coverImage.extraLarge || m.coverImage.large },
      },
      score:    m.averageScore ? (m.averageScore / 10).toFixed(1) : null,
      genres:   (m.genres || []).map((g, i) => ({ mal_id: i, name: g })),
      episodes: m.episodes,
      status:   m.status,
      format:   m.format,
      year:     m.seasonYear,
      studio:   m.studios?.nodes?.[0]?.name || null,
      synopsis: m.description,
    }));

    return res.status(200).json({
      data,
      pagination: {
        total:       pageInfo.total       || data.length,
        currentPage: pageInfo.currentPage || parseInt(page),
        hasNextPage: pageInfo.hasNextPage ?? false,
        perPage:     parseInt(limit),
      },
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
