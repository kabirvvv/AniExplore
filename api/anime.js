export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=60");
  if (req.method === "OPTIONS") return res.status(200).end();

  const { q, genres, limit = 24 } = req.query;

  const GENRE_MAP = {
    "1": "Action", "2": "Adventure", "4": "Comedy", "5": "Avant Garde",
    "6": "Mythology", "7": "Mystery", "8": "Drama", "9": "Ecchi",
    "10": "Fantasy", "13": "Historical", "14": "Horror", "17": "Martial Arts",
    "18": "Mecha", "19": "Music", "20": "Parody", "21": "Samurai",
    "22": "Romance", "23": "School", "24": "Sci-Fi", "25": "Shoujo",
    "26": "Girls Love", "27": "Shounen", "28": "Boys Love", "29": "Space",
    "30": "Sports", "31": "Super Power", "32": "Vampire", "35": "Harem",
    "36": "Slice of Life", "37": "Supernatural", "38": "Military",
    "39": "Police", "40": "Psychological", "41": "Suspense", "42": "Seinen",
    "46": "Award Winning", "47": "Gourmet", "48": "Work Life",
    "62": "Isekai", "63": "Iyashikei",
  };

  const genreFilter = genres
    ? genres.split(",").map((g) => GENRE_MAP[g]).filter(Boolean)
    : [];

  const mediaFields = `
    id
    idMal
    title { romaji english native }
    coverImage { extraLarge large }
    averageScore
    genres
    chapters
    status
    description(asHtml: false)
    format
  `;

  const query = q
    ? `
      query ($search: String, $perPage: Int) {
        Page(perPage: $perPage) {
          media(search: $search, type: MANGA, sort: [SCORE_DESC]) {
            ${mediaFields}
          }
        }
      }
    `
    : genreFilter.length > 0
    ? `
      query ($genres: [String], $perPage: Int) {
        Page(perPage: $perPage) {
          media(genre_in: $genres, type: MANGA, sort: [SCORE_DESC]) {
            ${mediaFields}
          }
        }
      }
    `
    : null;

  if (!query) return res.status(400).json({ error: "q or genres param required" });

  const variables = q
    ? { search: q, perPage: parseInt(limit) }
    : { genres: genreFilter, perPage: parseInt(limit) };

  try {
    const response = await fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ query, variables }),
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
      title_romaji: m.title.romaji,
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
      chapters: m.chapters,
      status: m.status,
      format: m.format,
      synopsis: m.description,
    }));

    return res.status(200).json({ data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
