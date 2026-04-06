export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  const { action, ...params } = req.query;

  try {
    // ── Image proxy ───────────────────────────────────────────────────────────
    if (action === "image") {
      const imageUrl = params.url;
      if (!imageUrl) return res.status(400).json({ error: "url param required" });

      const imageRes = await fetch(decodeURIComponent(imageUrl), {
        headers: {
          "Referer": "https://mangadex.org",
          "User-Agent": "Mozilla/5.0 (compatible; AniExplore/1.0)",
        },
      });

      if (!imageRes.ok) {
        return res.status(imageRes.status).json({ error: `Image fetch failed: ${imageRes.status}` });
      }

      const contentType = imageRes.headers.get("content-type") || "image/jpeg";
      res.setHeader("Content-Type", contentType);
      res.setHeader("Cache-Control", "public, max-age=86400");

      const buffer = await imageRes.arrayBuffer();
      return res.status(200).send(Buffer.from(buffer));
    }

    // ── Lookup by MAL ID (primary — used when AniList provides idMal) ─────────
    // MangaDex stores MAL IDs in manga links, so this is 100% accurate
    if (action === "mal") {
      const { malId } = params;
      if (!malId) return res.status(400).json({ error: "malId param required" });

      const url = [
        `https://api.mangadex.org/manga`,
        `?links[mal]=${malId}`,
        `&includes[]=coverArt`,
        `&contentRating[]=safe`,
        `&contentRating[]=suggestive`,
        `&hasAvailableChapters=true`,
        `&availableTranslatedLanguage[]=en`,
      ].join("");

      const response = await fetch(url, {
        headers: { "User-Agent": "AniExplore/1.0" },
      });

      if (!response.ok) {
        const errText = await response.text();
        return res.status(response.status).json({ error: `MangaDex error: ${response.status} — ${errText}` });
      }

      const data = await response.json();
      return res.status(200).json(data);
    }

    // ── Search by title (fallback — used when MAL ID lookup returns nothing) ──
    if (action === "search") {
      const title = params.title || "";
      const url = [
        `https://api.mangadex.org/manga`,
        `?title=${encodeURIComponent(title)}`,
        `&limit=5`,
        `&hasAvailableChapters=true`,
        `&availableTranslatedLanguage[]=en`,
        `&contentRating[]=safe`,
        `&contentRating[]=suggestive`,
        `&includes[]=coverArt`,
        `&order[relevance]=desc`,
      ].join("");

      const response = await fetch(url, {
        headers: { "User-Agent": "AniExplore/1.0" },
      });

      if (!response.ok) {
        const errText = await response.text();
        return res.status(response.status).json({ error: `MangaDex error: ${response.status} — ${errText}` });
      }

      const data = await response.json();
      return res.status(200).json(data);
    }

    // ── Chapters ──────────────────────────────────────────────────────────────
    if (action === "chapters") {
      const { id, offset = 0 } = params;
      if (!id) return res.status(400).json({ error: "id param required" });

      const url = [
        `https://api.mangadex.org/manga/${id}/feed`,
        `?translatedLanguage[]=en`,
        `&order[chapter]=asc`,
        `&limit=96`,
        `&offset=${offset}`,
        `&contentRating[]=safe`,
        `&contentRating[]=suggestive`,
        `&includes[]=scanlation_group`,
      ].join("");

      const response = await fetch(url, {
        headers: { "User-Agent": "AniExplore/1.0" },
      });

      if (!response.ok) {
        const errText = await response.text();
        return res.status(response.status).json({ error: `MangaDex error: ${response.status} — ${errText}` });
      }

      const data = await response.json();
      return res.status(200).json(data);
    }

    // ── Pages ─────────────────────────────────────────────────────────────────
    if (action === "pages") {
      const { chapterId } = params;
      if (!chapterId) return res.status(400).json({ error: "chapterId param required" });

      const url = `https://api.mangadex.org/at-home/server/${chapterId}`;
      const response = await fetch(url, {
        headers: { "User-Agent": "AniExplore/1.0" },
      });

      if (!response.ok) {
        const errText = await response.text();
        return res.status(response.status).json({ error: `MangaDex error: ${response.status} — ${errText}` });
      }

      const data = await response.json();
      return res.status(200).json(data);
    }

    return res.status(400).json({ error: "Invalid action. Use: mal, search, chapters, pages, image" });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
