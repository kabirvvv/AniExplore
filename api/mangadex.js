export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  const { action, ...params } = req.query;

  try {
    // ── Image proxy ───────────────────────────────────────────────────────────
    // MangaDex blocks direct browser requests due to hotlink protection.
    // We fetch images server-side with the correct Referer and pipe them back.
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
      res.setHeader("Cache-Control", "public, max-age=86400"); // cache images for 24h

      const buffer = await imageRes.arrayBuffer();
      return res.status(200).send(Buffer.from(buffer));
    }

    // ── Search ────────────────────────────────────────────────────────────────
    if (action === "search") {
      const title = params.title || "";
      // includes coverArt so we get cover images back
      // hasAvailableChapters=true filters out manga with no readable content
      // availableTranslatedLanguage[]=en ensures English chapters exist
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

    return res.status(400).json({ error: "Invalid action. Use: search, chapters, pages, image" });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
