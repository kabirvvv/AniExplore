import React, { useState } from "react";
import {
  ArrowLeft, Star, Calendar, Tv, Layers,
} from "lucide-react";

const ANIPUB = "https://api.anipub.xyz";

function toSlug(t = "") {
  return t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export default function AnimeStreamPage({ anime, onBack }) {
  const totalEps = anime.episodes || 12;
  const episodes = Array.from({ length: totalEps }, (_, i) => i + 1);

  const [currentEp, setCurrentEp] = useState(1);
  const [audioType, setAudioType] = useState("sub");

  const slug = toSlug(anime.title_english || anime.title || "");

  // AniPub embed URL — adjust path if AniPub uses a different embed route
  const iframeSrc = `${ANIPUB}/anime/embed/${slug}/${currentEp}?type=${audioType}`;

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
              Episode {currentEp} · {audioType.toUpperCase()}
            </p>
          </div>
          {/* Sub / Dub toggle */}
          <div className="flex items-center bg-white/5 border border-white/10 rounded-xl overflow-hidden flex-shrink-0">
            {["sub", "dub"].map((t) => (
              <button
                key={t}
                onClick={() => setAudioType(t)}
                className={`px-4 py-2 text-[11px] font-black uppercase tracking-widest transition ${
                  audioType === t
                    ? "bg-indigo-600 text-white"
                    : "text-gray-500 hover:text-white"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-6 flex flex-col lg:flex-row gap-6">

        {/* ── LEFT: iframe + Info ───────────────────────────────────────────── */}
        <div className="flex-1 min-w-0">

          {/* IFRAME PLAYER */}
          <div className="relative bg-black rounded-2xl overflow-hidden aspect-video">
            <iframe
              key={`${slug}-${currentEp}-${audioType}`}
              src={iframeSrc}
              className="w-full h-full"
              allowFullScreen
              allow="autoplay; fullscreen; encrypted-media"
              frameBorder="0"
              scrolling="no"
            />
          </div>

          {/* ANIME INFO */}
          <div className="mt-5 bg-white/5 rounded-2xl border border-white/5 p-5">
            <div className="flex items-start gap-4">
              <img
                src={anime.images?.webp?.large_image_url || anime.images?.jpg?.large_image_url}
                alt={anime.title}
                className="w-16 rounded-xl object-cover flex-shrink-0"
              />
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
                      <span key={g.name} className="px-2 py-0.5 bg-indigo-500/10 border border-indigo-500/20 rounded-lg text-[10px] font-bold text-indigo-400 uppercase tracking-wide">
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
                {totalEps} total
              </span>
            </div>
            <div className="overflow-y-auto" style={{ maxHeight: "calc(100vh - 160px)" }}>
              {episodes.map((ep) => (
                <button
                  key={ep}
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
