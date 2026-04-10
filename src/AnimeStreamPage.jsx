import React, { useState, useEffect, useRef } from "react";
import {
  ArrowLeft, Star, Tv, Layers, Loader2, AlertTriangle, RefreshCw,
} from "lucide-react";

const ANIPUB = "https://anipub.xyz";
const fixImage = (p) =>
  !p ? "" : p.startsWith("https://") ? p : `${ANIPUB}/${p}`;

// ─── helper ────────────────────────────────────────────────────────────────
function getAudioType(src = "") {
  if (src.includes("/dub")) return "dub"; // ← use includes(), not endsWith()
  if (src.includes("/sub")) return "sub"; // in case query-strings are appended
  return null; // unknown — we'll filter these out
}

// ─── fetch ONE audio type from your API ────────────────────────────────────
async function fetchEpsForType(anime, type) {
  const params = new URLSearchParams();
  params.set("audioType", type); // ← NEW: tell the API which type you want

  if (anime.anipub_id) {
    params.set("anipubId", anime.anipub_id);
  } else {
    params.set("title", anime.title_english || anime.title || "");
    if (anime.title_romaji) params.set("titleRomaji", anime.title_romaji);
  }

  const res  = await fetch(`/api/anime-episodes?${params}`);
  const data = await res.json();

  if (!res.ok) throw new Error(data.error || `Server error (${res.status})`);

  return (data.episodes || []).map((e) => ({
    ep:   e.number,
    src:  e.src,
    type: getAudioType(e.src) || type, // fall back to the requested type
  }));
}

// ───────────────────────────────────────────────────────────────────────────
export default function AnimeStreamPage({ anime, onBack }) {
  const [audioType,  setAudioType]  = useState("sub");
  const [allEps,     setAllEps]     = useState([]);
  const [currentEp,  setCurrentEp]  = useState(null); // ← null until loaded
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);

  const epListRef = useRef(null);

  // ── LOAD BOTH SUB AND DUB IN PARALLEL ────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      setAllEps([]);
      setCurrentEp(null);

      try {
        // Fetch sub + dub at the same time; ignore whichever fails
        const [subResult, dubResult] = await Promise.allSettled([
          fetchEpsForType(anime, "sub"),
          fetchEpsForType(anime, "dub"),
        ]);

        const subEps = subResult.status === "fulfilled" ? subResult.value : [];
        const dubEps = dubResult.status === "fulfilled" ? dubResult.value : [];

        const combined = [...subEps, ...dubEps];

        if (!combined.length) {
          throw new Error("No episodes found on AniPub for sub or dub.");
        }

        // Default audio type: prefer sub if available
        const hasSub = subEps.length > 0;
        const defaultType = hasSub ? "sub" : "dub";
        const defaultEps  = hasSub ? subEps : dubEps;

        if (!cancelled) {
          setAllEps(combined);
          setAudioType(defaultType);
          setCurrentEp(defaultEps[0]?.ep ?? 1); // ← safe first episode
          setLoading(false);
        }
      } catch (e) {
        console.error("[AnimeStream]", e);
        if (!cancelled) { setError(e.message); setLoading(false); }
      }
    }

    load();
    return () => { cancelled = true; };
  }, [anime]);

  // ── DERIVED ──────────────────────────────────────────────────────────────
  const filteredEps = allEps.filter((e) => e.type === audioType);
  const subCount    = allEps.filter((e) => e.type === "sub").length;
  const dubCount    = allEps.filter((e) => e.type === "dub").length;
  const totalEps    = filteredEps.length;
  const currentSrc  = filteredEps.find((e) => e.ep === currentEp)?.src || "";

  // ── WHEN TOGGLE SWITCHES, JUMP TO FIRST EP OF NEW TYPE ───────────────────
  useEffect(() => {
    const first = filteredEps[0]?.ep;
    if (first != null) setCurrentEp(first);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioType]);

  // ── SCROLL ACTIVE EP INTO VIEW ────────────────────────────────────────────
  useEffect(() => {
    if (!epListRef.current) return;
    const active = epListRef.current.querySelector("[data-active='true']");
    active?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [currentEp, audioType]);

  const coverImg =
    anime.images?.webp?.large_image_url ||
    anime.images?.jpg?.large_image_url  ||
    fixImage(anime.ImagePath);

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 font-sans">

      {/* TOP BAR */}
      <header className="sticky top-0 z-30 bg-gray-950/90 backdrop-blur-2xl border-b border-white/5">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-3 flex items-center gap-4">
          <button
            onClick={onBack}
            className="flex items-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 rounded-xl transition text-sm font-bold text-gray-400 hover:text-white"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="font-black text-white tracking-tight truncate text-base sm:text-xl">
              {anime.title}
            </h1>
            <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">
              {loading
                ? "Loading…"
                : currentEp != null
                  ? `Episode ${currentEp} of ${totalEps} · ${audioType.toUpperCase()}`
                  : ""}
            </p>
          </div>
        </div>
      </header>

      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-6 flex flex-col lg:flex-row gap-6">

        {/* ── LEFT ─────────────────────────────────────────────────────────── */}
        <div className="flex-1 min-w-0">

          {/* SUB / DUB TOGGLE */}
          {!loading && !error && (
            <div className="flex items-center gap-3 mb-3">
              <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">
                Audio
              </span>
              <div className="flex items-center bg-white/5 border border-white/10 rounded-xl overflow-hidden">
                {[
                  { t: "sub", count: subCount, label: "SUB" },
                  { t: "dub", count: dubCount, label: "DUB" },
                ].map(({ t, count, label }) => (
                  <button
                    key={t}
                    onClick={() => count > 0 && setAudioType(t)}
                    disabled={count === 0}
                    className={`px-5 py-2 text-[11px] font-black uppercase tracking-widest transition ${
                      audioType === t
                        ? "bg-indigo-600 text-white"
                        : count === 0
                        ? "text-gray-700 cursor-not-allowed"
                        : "text-gray-500 hover:text-white"
                    }`}
                  >
                    {label}
                    {count > 0 && (
                      <span className={`ml-1.5 text-[9px] font-bold ${audioType === t ? "text-indigo-300" : "text-gray-600"}`}>
                        {count}ep
                      </span>
                    )}
                  </button>
                ))}
              </div>
              {subCount === 0 && !loading && (
                <span className="text-[10px] text-yellow-500 font-bold">Sub not available</span>
              )}
              {dubCount === 0 && !loading && (
                <span className="text-[10px] text-yellow-500 font-bold">Dub not available</span>
              )}
            </div>
          )}

          {/* PLAYER */}
          <div className="relative bg-black rounded-2xl overflow-hidden aspect-video">
            {loading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black">
                <Loader2 className="w-10 h-10 text-indigo-400 animate-spin" />
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">
                  Loading stream…
                </p>
              </div>
            )}

            {error && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/90">
                <div className="text-center px-6">
                  <AlertTriangle className="w-10 h-10 text-red-400 mx-auto mb-3" />
                  <p className="text-sm font-bold text-red-400 mb-1">Stream Error</p>
                  <p className="text-xs text-gray-500 mb-4 max-w-xs">{error}</p>
                  <button
                    onClick={() => window.location.reload()}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-xs font-black uppercase tracking-widest transition mx-auto"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Retry
                  </button>
                </div>
              </div>
            )}

            {!loading && !error && currentSrc && (
              <iframe
                key={currentSrc}
                src={currentSrc}
                className="w-full h-full"
                allowFullScreen
                allow="autoplay; fullscreen; encrypted-media"
                sandbox="allow-scripts allow-same-origin allow-presentation allow-fullscreen"
                frameBorder="0"
                scrolling="no"
              />
            )}
          </div>

          {/* ANIME INFO */}
          <div className="mt-5 bg-white/5 rounded-2xl border border-white/5 p-5">
            <div className="flex items-start gap-4">
              {coverImg && (
                <img
                  src={coverImg}
                  alt={anime.title}
                  className="w-16 rounded-xl object-cover flex-shrink-0"
                />
              )}
              <div className="flex-1 min-w-0">
                <h2 className="font-black text-white text-lg tracking-tight">{anime.title}</h2>
                <div className="flex flex-wrap items-center gap-3 mt-1 mb-3">
                  {anime.score && (
                    <span className="flex items-center gap-1 text-xs font-bold text-yellow-400">
                      <Star className="w-3.5 h-3.5 fill-yellow-400" /> {anime.score}
                    </span>
                  )}
                  {anime.format && (
                    <span className="flex items-center gap-1 text-xs font-bold text-gray-400">
                      <Tv className="w-3.5 h-3.5" /> {anime.format}
                    </span>
                  )}
                  {anime.studio && (
                    <span className="flex items-center gap-1 text-xs font-bold text-indigo-400">
                      <Layers className="w-3.5 h-3.5" /> {anime.studio}
                    </span>
                  )}
                </div>
                {anime.genres?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {anime.genres.slice(0, 6).map((g) => (
                      <span
                        key={g.name}
                        className="px-2 py-0.5 bg-indigo-500/10 border border-indigo-500/20 rounded-lg text-[10px] font-bold text-indigo-400 uppercase tracking-wide"
                      >
                        {g.name}
                      </span>
                    ))}
                  </div>
                )}
                {anime.synopsis && (
                  <p className="text-gray-400 text-xs leading-relaxed line-clamp-3">
                    {anime.synopsis.replace(/<[^>]+>/g, "")}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── RIGHT: Episode List ───────────────────────────────────────────── */}
        <div className="lg:w-72 xl:w-80 flex-shrink-0">
          <div className="bg-white/5 rounded-2xl border border-white/5 overflow-hidden sticky top-20">
            <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
              <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">
                Episodes
              </span>
              <span className="text-[10px] font-bold text-gray-500">
                {loading ? "…" : `${totalEps} ${audioType}`}
              </span>
            </div>
            <div
              ref={epListRef}
              className="overflow-y-auto"
              style={{ maxHeight: "calc(100vh - 160px)" }}
            >
              {loading && (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="w-5 h-5 text-indigo-400 animate-spin" />
                </div>
              )}
              {!loading && filteredEps.map(({ ep }) => (
                <button
                  key={ep}
                  data-active={ep === currentEp}
                  onClick={() => setCurrentEp(ep)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left transition border-b border-white/5 last:border-0 ${
                    ep === currentEp
                      ? "bg-indigo-600/20 border-l-2 border-l-indigo-500"
                      : "hover:bg-white/5"
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black flex-shrink-0 ${
                    ep === currentEp
                      ? "bg-indigo-600 text-white"
                      : "bg-white/10 text-gray-400"
                  }`}>
                    {ep}
                  </div>
                  <div>
                    <p className={`text-xs font-bold ${ep === currentEp ? "text-white" : "text-gray-300"}`}>
                      Episode {ep}
                    </p>
                    {ep === currentEp && (
                      <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-wide">
                        Now Playing
                      </p>
                    )}
                  </div>
                </button>
              ))}
              {!loading && filteredEps.length === 0 && (
                <div className="px-4 py-8 text-center">
                  <p className="text-xs font-bold text-gray-500">
                    No {audioType} episodes available.
                  </p>
                  <button
                    onClick={() => setAudioType(audioType === "sub" ? "dub" : "sub")}
                    className="mt-2 text-[10px] font-black text-indigo-400 uppercase tracking-widest hover:text-indigo-300"
                  >
                    Switch to {audioType === "sub" ? "dub" : "sub"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
