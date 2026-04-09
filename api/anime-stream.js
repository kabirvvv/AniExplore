const ANIPUB = "https://api.anipub.xyz";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=30");
  if (req.method === "OPTIONS") return res.status(200).end();

  const { slug, ep, type = "sub", title, titleRomaji } = req.query;
  if (!ep) return res.status(400).json({ error: "ep param required" });

  const candidates = resolveSlugCandidates(slug, title, titleRomaji);
  if (!candidates.length) return res.status(400).json({ error: "slug or title param required" });

  const errors = [];

  for (const candidate of candidates) {
    let text = "";
    try {
      const url = `${ANIPUB}/anime/api/stream/${candidate}/${ep}?type=${type}`;
      const r = await fetch(url, {
        headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0" },
      });

      text = await r.text();

      if (!r.ok) {
        errors.push({ candidate, status: r.status, body: text.slice(0, 300) });
        continue;
      }

      let json = null;
      try { json = JSON.parse(text); } catch (_) {
        errors.push({ candidate, reason: "invalid JSON", body: text.slice(0, 300) });
        continue;
      }

      if (!json || json.error) {
        errors.push({ candidate, apiError: json?.error || "null response" });
        continue;
      }

      const normalized = normalize(json, type);
      if (!normalized.sources?.length) {
        errors.push({ candidate, reason: "no sources", keys: Object.keys(json) });
        continue;
      }

      return res.status(200).json({ ...normalized, resolvedSlug: candidate });

    } catch (err) {
      errors.push({ candidate, exception: err.message });
    }
  }

  return res.status(404).json({
    error: "Stream not available for this episode.",
    debug: { candidates, errors },
  });
}

function resolveSlugCandidates(slug, title, titleRomaji) {
  const set = new Set();
  if (slug)        set.add(slug);
  if (title)       set.add(toSlug(title));
  if (titleRomaji) set.add(toSlug(titleRomaji));
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
  if (json.sub || json.dub) {
    const url = type === "dub" ? (json.dub || json.sub) : (json.sub || json.dub);
    return {
      sources:   [{ url, quality: "auto" }],
      subtitles: json.subtitles || json.captions || [],
      hasSub:    !!json.sub,
      hasDub:    !!json.dub,
    };
  }
  if (json.sources?.length) {
    return {
      sources:   json.sources.map((s) => ({ url: s.url, quality: s.quality || "auto" })),
      subtitles: (json.tracks || []).filter((t) => t.kind === "captions" || t.kind === "subtitles"),
      hasSub:    true,
      hasDub:    false,
    };
  }
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
