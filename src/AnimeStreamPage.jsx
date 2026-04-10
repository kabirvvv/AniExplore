import React, { useState, useEffect, useRef } from "react";
import {
  ArrowLeft, Star, Calendar, Tv, Layers, Loader2, AlertTriangle, RefreshCw,
} from "lucide-react";

// AniPub has no CORS preflight support — all calls must go through
// the Vercel proxy (/api/anime-episodes) instead of hitting anipub.xyz directly.

// Fix relative image paths (still needed for cover images)
const ANIPUB = "https://anipub.xyz";
const fixImage = (p) =>
  !p ? "" : p.startsWith("https://") ? p : `${ANIPUB}/${p}`;

export default function AnimeStreamPage({ anime, onBack }) {
  const [currentEp, setCurrentEp] = useState(1);
  const [allEps,    setAllEps]    = useState([]); // [{ ep: 1, src: "https://..." }, ...]
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);

  const epListRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      setAllEps([]);

      // AniPub 500s on CORS OPTIONS preflight — proxy through Vercel instead.
      // /api/anime-episodes runs server-side, calls AniPub fine, returns episodes.
      const title      = anime.title_english || anime.title || "";
      const titleRomaji = anime.title_romaji || "";

      try {
        const params = new URLSearchParams({ title });
        if (titleRomaji) params.set("titleRomaji", titleRomaji);

        const res  = await fetch(`/api/anime-episodes?${params}`);
        const data = await res.json();

        if (!res.ok) throw new Error(data.error || `Server error (${res.status})`);
        if (!data.episodes?.length) throw new Error("No episodes returned.");

        // /api/anime-episodes returns: { episodes: [{ number, src }], title, totalEpisodes }
        const eps = data.episodes.map((e) => ({ ep: e.number, src: e.src }));

        if (!cancelled) {
          setAllEps(eps);
          setLoading(false);
        }
      } catch (e) {
        console.error("[AnimeStream]", e);
        if (!cancelled) {
          setError(e.message);
          setLoading(false);
        }
      }
    }

    load();
    return () => { cancelled = true; };
  }, [anime]);

  // Scroll active episode into view
  useEffect(() => {
    if (!epListRef.current) return;
    const active = epListRef.current.querySelector("[data-active='true']");
    active?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [currentEp]);

  const totalEps   = allEps.length;
  const currentSrc = allEps.find((e) => e.ep === currentEp)?.src || "";
  const coverImg   =
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
              {loading ? "Finding stream…" : `Episode ${currentEp} of ${totalEps}`}
            </p>
          </div>
        </div>
      </header>

      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-6 flex flex-col lg:flex-row gap-6">

        {/* ── LEFT: iframe + Info ───────────────────────────────────────────── */}
        <div className="flex-1 min-w-0">

          {/* PLAYER */}
          <div className="relative bg-black rounded-2xl overflow-hidden aspect-video">

            {loading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black">
                <Loader2 className="w-10 h-10 text-indigo-400 animate-spin" />
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">
                  Finding stream…
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

            {/* key forces full iframe remount on every episode change */}
            {!loading && !error && currentSrc && (
              <iframe
                key={currentSrc}
                src={currentSrc}
                className="w-full h-full"
                allowFullScreen
                allow="autoplay; fullscreen; encrypted-media"
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
                  {anime.year && (
                    <span className="flex items-center gap-1 text-xs font-bold text-gray-400">
                      <Calendar className="w-3.5 h-3.5" /> {anime.year}
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
                {loading ? "…" : `${totalEps} total`}
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
              {!loading && allEps.map(({ ep }) => (
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
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
