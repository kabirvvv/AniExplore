// GET /api/anime-stream?slug={slug}&ep={n}&type={sub|dub}
//   OR ?malId={id}&title={title}&titleRomaji={t}&ep={n}&type={sub|dub}
// Proxies AniPub stream endpoint, returns { sources, subtitles, hasDub, hasSub }

const ANIPUB = "https://api.anipub.xyz";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=30");
  if (req.method === "OPTIONS") return res.status(200).end();

  const { slug, ep, type = "sub", title, titleRomaji } = req.query;
  if (!ep) return res.status(400).json({ error: "ep param required" });

  // Resolve slug from explicit param or derive from title
  const candidates = resolveSlugCandidates(slug, title, titleRomaji);
  if (!candidates.length) return res.status(400).json({ error: "slug or title param required" });

  for (const candidate of candidates) {
    try {
      const r = await fetch(`${ANIPUB}/anime/api/stream/${candidate}/${ep}`, {
        headers: {
          Accept: "application/json",
          "User-Agent": "Mozilla/5.0",
          ...(type === "dub" ? { "X-Stream-Type": "dub" } : {}),
        },
      });
      if (!r.ok) continue;
      const json = await r.json();
      if (!json || json.error) continue;

      const normalized = normalize(json, type);
      if (!normalized.sources?.length) continue;

      return res.status(200).json({ ...normalized, resolvedSlug: candidate });
    } catch (_) { continue; }
  }

  return res.status(404).json({ error: "Stream not available for this episode." });
}

function resolveSlugCandidates(slug, title, titleRomaji) {
  const set = new Set();
  if (slug)        set.add(slug);
  if (title)       set.add(toSlug(title));
  if (titleRomaji) set.add(toSlug(titleRomaji));

  // Also try without season/year suffixes
  for (const s of [...set]) {
    const stripped = s
      .replace(/-\d+(st|nd|rd|th)-season$/, "")
      .replace(/-season-\d+$/, "")
      .replace(/-part-\d+$/, "")
      .replace(/-\d{4}$/, "");
    if (stripped !== s) set.add(stripped);
  }
  return [...set];
}

function toSlug(t = "") {
  return t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function normalize(json, type) {
  // Shape A: { sub: "url", dub: "url", subtitles: [] }
  if (json.sub || json.dub) {
    const url = type === "dub" ? (json.dub || json.sub) : (json.sub || json.dub);
    return {
      sources:   [{ url, quality: "auto" }],
      subtitles: json.subtitles || json.captions || [],
      hasSub:    !!json.sub,
      hasDub:    !!json.dub,
    };
  }

  // Shape B: { sources: [{ url, quality, isM3U8 }], tracks: [] }
  if (json.sources?.length) {
    return {
      sources:   json.sources.map((s) => ({ url: s.url, quality: s.quality || "auto" })),
      subtitles: (json.tracks || []).filter((t) => t.kind === "captions" || t.kind === "subtitles"),
      hasSub:    true,
      hasDub:    false,
    };
  }

  // Shape C: { url/stream/link: "..." }
  const url = json.url || json.stream || json.link || json.streamUrl;
  if (url) {
    return {
      sources:   [{ url, quality: "auto" }],
      subtitles: json.subtitles || [],
      hasSub:    true,
      hasDub:    false,
    };
  }

  return { sources: [], subtitles: [], hasSub: false, hasDub: false };
}
