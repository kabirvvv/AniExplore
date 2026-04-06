export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=60");
  if (req.method === "OPTIONS") return res.status(200).end();

  const { limit = 24 } = req.query;

  const query = `
    query ($perPage: Int) {
      Page(perPage: $perPage) {
        media(type: ANIME, format_in: [TV], sort: [SCORE_DESC], status_not: NOT_YET_RELEASED) {
          id
          idMal
          title { romaji english native }
          coverImage { extraLarge large }
          bannerImage
          averageScore
          genres
          episodes
          status
          description(asHtml: false)
          season
          seasonYear
        }
      }
    }
  `;

  try {
    const response = await fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({ query, variables: { perPage: parseInt(limit) } }),
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: `AniList error: ${response.status}` });
    }

    const json = await response.json();
    const media = json.data?.Page?.media || [];

    const data = media.map((m) => ({
      mal_id: m.idMal,
      anilist_id: m.id,
      title: m.title.english || m.title.romaji,
      title_english: m.title.english,
      title_japanese: m.title.native,
      images: {
        webp: {
          large_image_url: m.coverImage.extraLarge || m.coverImage.large,
          image_url: m.coverImage.large,
        },
        jpg: {
          large_image_url: m.coverImage.extraLarge || m.coverImage.large,
        },
      },
      score: m.averageScore ? (m.averageScore / 10).toFixed(1) : null,
      genres: (m.genres || []).map((g, i) => ({ mal_id: i, name: g })),
      episodes: m.episodes,
      status: m.status,
      synopsis: m.description,
    }));

    return res.status(200).json({ data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
