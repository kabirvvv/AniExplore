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
    try {
      // ✅ FIX 1: pass type as a query param, not a header
      const url = `${ANIPUB}/anime/api/stream/${candidate}/${ep}?type=${type}`;

      const r = await fetch(url, {
        headers: {
          Accept: "application/json",
          "User-Agent": "Mozilla/5.0",
        },
      });

      // ✅ FIX 2: capture the body even on failure so we can debug
      const text = await r.text();
      let json;
      try { json = JSON.parse(text); } catch { json = null; }

      if (!r.ok) {
        errors.push({ candidate, status: r.status, body: text.slice(0, 200) });
        continue;
      }
      if (!json || json.error) {
        errors.push({ candidate, status: r.status, apiError: json?.error || "empty body" });
        continue;
      }

      const normalized = normalize(json, type);
      if (!normalized.sources?.length) {
        errors.push({ candidate, status: r.status, reason: "no sources in response", shape: Object.keys(json) });
        continue;
      }

      return res.status(200).json({ ...normalized, resolvedSlug: candidate });
    } catch (err) {
      errors.push({ candidate, exception: err.message });
    }
  }

  // ✅ FIX 3: return debug info so you can see what's actually going wrong
  return res.status(404).json({
    error: "Stream not available for this episode.",
    debug: { candidates, errors },
  });
}
