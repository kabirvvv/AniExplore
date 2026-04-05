export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  const { action, ...params } = req.query;

  try {
    let url;

    if (action === "search") {
      // Search manga by title — tries English title first, falls back to romaji
      const title = params.title || "";
      url = `https://api.mangadex.org/manga?title=${encodeURIComponent(title)}&limit=5&contentRating[]=safe&contentRating[]=suggestive`;

    } else if (action === "chapters") {
      // Get chapter list with pagination
      const { id, offset = 0 } = params;
      url = `https://api.mangadex.org/manga/${id}/feed?translatedLanguage[]=en&order[chapter]=asc&limit=96&offset=${offset}&contentRating[]=safe&contentRating[]=suggestive`;

    } else if (action === "pages") {
      // Get page image URLs for a chapter
      const { chapterId } = params;
      url = `https://api.mangadex.org/at-home/server/${chapterId}`;

    } else {
      return res.status(400).json({ error: "Invalid action. Use: search, chapters, pages" });
    }

    const response = await fetch(url, {
      headers: { "User-Agent": "AniExplore/1.0" }
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).json({ error: `MangaDex error: ${response.status} — ${errText}` });
    }

    const data = await response.json();
    res.status(200).json(data);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
