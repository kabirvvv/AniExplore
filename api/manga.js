/**
 * /api/manga.js
 * Replaces /api/mangadex — serves MangaPill (primary) + AtsuMoe (fallback)
 *
 * Actions:
 *   GET ?action=search&title=...               → find manga on sources
 *   GET ?action=chapters&path=...&source=...   → chapter list
 *   GET ?action=pages&path=...&source=...      → page image URLs
 *   GET ?action=image&url=...                  → proxy a page image (fixes CORS / hotlink)
 */

import * as cheerio from "cheerio";

// ─── CORS / CACHE HEADERS ────────────────────────────────────────────────────

function setHeaders(res, cache = 60) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", `s-maxage=${cache}, stale-while-revalidate=30`);
}

// ─── FETCH HELPER ────────────────────────────────────────────────────────────

async function fetchHTML(url, referer) {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      Referer: referer || url,
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} — ${url}`);
  return res.text();
}

// ─── MANGAPILL ────────────────────────────────────────────────────────────────

const PILL = "https://mangapill.com";

async function pillSearch(title) {
  const html = await fetchHTML(`${PILL}/search?q=${encodeURIComponent(title)}&type=&status=`);
  const $ = cheerio.load(html);
  const results = [];

  // Each result card is an <a> linking to /manga/{id}/{slug}
  $("a[href^='/manga/']").each((_, el) => {
    const href = $(el).attr("href");
    const parts = href.split("/").filter(Boolean); // ["manga","123","slug"]
    if (parts.length < 3) return;
    const [, id, slug] = parts;
    // Grab title from the first visible text child div
    const titleText =
      $(el).find("div").first().text().trim() ||
      $(el).attr("title") ||
      slug.replace(/-/g, " ");
    if (!results.find((r) => r.id === id)) {
      results.push({ id, slug, title: titleText, path: href, source: "mangapill" });
    }
  });

  return results;
}

async function pillChapters(mangaPath) {
  const html = await fetchHTML(`${PILL}${mangaPath}`, PILL);
  const $ = cheerio.load(html);
  const chapters = [];

  $("a[href^='/chapters/']").each((_, el) => {
    const href = $(el).attr("href"); // /chapters/10001001/0001
    const label = $(el).text().trim();
    const idMatch = href.match(/\/chapters\/(\d+)/);
    if (!idMatch) return;
    chapters.push({
      id: idMatch[1],
      number: label.replace(/chapter/i, "").trim(),
      title: label,
      path: href,
      source: "mangapill",
    });
  });

  // MangaPill lists newest first — reverse so index 0 = ch.1
  return chapters.reverse();
}

async function pillPages(chapterPath) {
  const html = await fetchHTML(`${PILL}${chapterPath}`, PILL);
  const $ = cheerio.load(html);
  const pages = [];

  $("img[data-src], img[src]").each((_, el) => {
    const src = $(el).attr("data-src") || $(el).attr("src");
    if (src && src.match(/\.(jpg|jpeg|png|webp)/i) && !src.includes("logo")) {
      pages.push(src.startsWith("//") ? `https:${src}` : src);
    }
  });

  return pages;
}

// ─── ATSUMOE ──────────────────────────────────────────────────────────────────

const ATSU = "https://atsu.moe";

async function atsuSearch(title) {
  const html = await fetchHTML(`${ATSU}/?s=${encodeURIComponent(title)}`);
  const $ = cheerio.load(html);
  const results = [];

  $("a[href*='/manga/']").each((_, el) => {
    const href = $(el).attr("href") || "";
    // Match /manga/s1/slug  (AtsuMoe uses a server prefix like s1)
    const slugMatch = href.match(/\/manga\/[^/]+\/([^/?#]+)/);
    if (!slugMatch) return;
    const slug = slugMatch[1];
    const path = href.startsWith("http") ? new URL(href).pathname : href;
    const titleText = $(el).text().trim() || slug.replace(/-/g, " ");
    if (!results.find((r) => r.slug === slug)) {
      results.push({ slug, title: titleText, path, source: "atsumoe" });
    }
  });

  return results;
}

async function atsuChapters(mangaPath) {
  const html = await fetchHTML(`${ATSU}${mangaPath}`, ATSU);
  const $ = cheerio.load(html);
  const chapters = [];

  $("a[href*='/manga/']").each((_, el) => {
    const href = $(el).attr("href") || "";
    // Chapter links are deeper: /manga/s1/slug/chapter-X
    if (!href.match(/\/manga\/[^/]+\/[^/]+\/[^/]+/)) return;
    const label = $(el).text().trim();
    const numMatch = label.match(/(\d+(?:\.\d+)?)/);
    const path = href.startsWith("http") ? new URL(href).pathname : href;
    chapters.push({
      id: path,           // use path as ID since there's no numeric ID
      number: numMatch ? numMatch[1] : label,
      title: label,
      path,
      source: "atsumoe",
    });
  });

  return chapters.reverse();
}

async function atsuPages(chapterPath) {
  const url = chapterPath.startsWith("http") ? chapterPath : `${ATSU}${chapterPath}`;
  const html = await fetchHTML(url, ATSU);
  const $ = cheerio.load(html);
  const pages = [];

  $("img[src], img[data-src]").each((_, el) => {
    const src = $(el).attr("data-src") || $(el).attr("src");
    if (src && src.match(/\.(jpg|jpeg|png|webp)/i) && !src.includes("logo")) {
      pages.push(src.startsWith("//") ? `https:${src}` : src);
    }
  });

  return pages;
}

// ─── UNIFIED SEARCH (tries all title variants, falls back to AtsuMoe) ────────

async function searchWithFallback(titles) {
  // Try MangaPill with each title variant
  for (const title of titles) {
    if (!title) continue;
    try {
      const results = await pillSearch(title);
      if (results.length > 0) return { source: "mangapill", results };
    } catch (e) {
      console.warn("[MangaPill] search error:", e.message);
    }
  }

  // Fall back to AtsuMoe
  for (const title of titles) {
    if (!title) continue;
    try {
      const results = await atsuSearch(title);
      if (results.length > 0) return { source: "atsumoe", results };
    } catch (e) {
      console.warn("[AtsuMoe] search error:", e.message);
    }
  }

  return { source: null, results: [] };
}

// ─── IMAGE PROXY ─────────────────────────────────────────────────────────────

async function proxyImage(res, imageUrl, source) {
  const referer = source === "atsumoe" ? ATSU : PILL;
  const upstream = await fetch(imageUrl, {
    headers: {
      Referer: referer,
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    },
  });

  if (!upstream.ok) {
    res.status(upstream.status).end();
    return;
  }

  const contentType = upstream.headers.get("content-type") || "image/jpeg";
  res.setHeader("Content-Type", contentType);
  res.setHeader("Cache-Control", "public, s-maxage=86400");
  res.setHeader("Access-Control-Allow-Origin", "*");

  const buffer = await upstream.arrayBuffer();
  res.status(200).send(Buffer.from(buffer));
}

// ─── HANDLER ─────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    setHeaders(res);
    return res.status(200).end();
  }

  const { action, title, title_english, title_japanese, path, source, url } = req.query;

  // ── IMAGE PROXY ──────────────────────────────────────────────────────────
  if (action === "image") {
    if (!url) return res.status(400).json({ error: "url param required" });
    try {
      return await proxyImage(res, decodeURIComponent(url), source || "mangapill");
    } catch (err) {
      return res.status(502).json({ error: err.message });
    }
  }

  setHeaders(res, action === "search" ? 300 : 120);

  // ── SEARCH ───────────────────────────────────────────────────────────────
  if (action === "search") {
    if (!title) return res.status(400).json({ error: "title param required" });

    // Build title variants from what AniList provides
    const variants = [
      title_english,
      title,                        // romaji / fallback
      title_japanese,
    ].filter(Boolean);

    try {
      const { source: foundSource, results } = await searchWithFallback(variants);
      if (!results.length) {
        return res.status(404).json({ error: `No manga found for "${title}"` });
      }
      // Return the best match (first result) plus the source so the client
      // can pass it back for chapter / page requests.
      return res.status(200).json({
        source: foundSource,
        match: results[0],
        results,
      });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ── CHAPTERS ─────────────────────────────────────────────────────────────
  if (action === "chapters") {
    if (!path) return res.status(400).json({ error: "path param required" });

    try {
      let chapters;
      if (source === "atsumoe") {
        chapters = await atsuChapters(path);
      } else {
        try {
          chapters = await pillChapters(path);
        } catch (e) {
          console.warn("[MangaPill] chapters failed, trying AtsuMoe:", e.message);
          chapters = await atsuChapters(path);
        }
      }
      return res.status(200).json({ chapters, total: chapters.length, source });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ── PAGES ────────────────────────────────────────────────────────────────
  if (action === "pages") {
    if (!path) return res.status(400).json({ error: "path param required" });

    try {
      let pages;
      if (source === "atsumoe") {
        pages = await atsuPages(path);
      } else {
        try {
          pages = await pillPages(path);
        } catch (e) {
          console.warn("[MangaPill] pages failed:", e.message);
          return res.status(502).json({ error: "MangaPill failed. Supply an AtsuMoe path." });
        }
      }

      // Return proxied URLs so the browser never hits the source CDN directly
      const proxied = pages.map(
        (u) => `/api/manga?action=image&source=${source || "mangapill"}&url=${encodeURIComponent(u)}`
      );

      return res.status(200).json({ pages: proxied, total: proxied.length });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(400).json({ error: "Invalid action. Use: search | chapters | pages | image" });
}
