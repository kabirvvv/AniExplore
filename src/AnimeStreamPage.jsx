import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  ArrowLeft, Play, Pause, Volume2, VolumeX, Maximize, Minimize,
  Loader2, AlertTriangle, ChevronLeft, ChevronRight, Tv, Star,
  Calendar, Layers, RefreshCw,
} from "lucide-react";

const STREAM_API = "/api/anime-stream";
const HLS_CDN    = "https://cdnjs.cloudflare.com/ajax/libs/hls.js/1.5.7/hls.min.js";

// ── Helpers ────────────────────────────────────────────────────────────────────
function fmtTime(s) {
  if (!isFinite(s) || s < 0) return "0:00";
  const m = Math.floor(s / 60), ss = Math.floor(s % 60);
  return `${m}:${ss.toString().padStart(2, "0")}`;
}

function loadHlsScript(cb) {
  if (window.Hls) { cb(); return; }
  const s = document.createElement("script");
  s.src = HLS_CDN;
  s.onload  = cb;
  s.onerror = () => console.error("Failed to load hls.js");
  document.head.appendChild(s);
}

// ── AnimeStreamPage ────────────────────────────────────────────────────────────
export default function AnimeStreamPage({ anime, onBack }) {
  const totalEps   = anime.episodes || 12;
  const episodes   = Array.from({ length: totalEps }, (_, i) => i + 1);

  // State
  const [currentEp,    setCurrentEp]    = useState(1);
  const [audioType,    setAudioType]    = useState("sub");
  const [sources,      setSources]      = useState([]);
  const [streamLoading, setStreamLoading] = useState(false);
  const [streamError,  setStreamError]  = useState(null);

  // Player state
  const [playing,      setPlaying]      = useState(false);
  const [currentTime,  setCurrentTime]  = useState(0);
  const [duration,     setDuration]     = useState(0);
  const [volume,       setVolume]       = useState(1);
  const [muted,        setMuted]        = useState(false);
  const [buffering,    setBuffering]    = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [qualityIdx,   setQualityIdx]   = useState(0);

  const videoRef     = useRef(null);
  const hlsRef       = useRef(null);
  const wrapperRef   = useRef(null);
  const controlTimer = useRef(null);
  const epListRef    = useRef(null);

  // ── Fetch stream ─────────────────────────────────────────────────────────────
  const fetchStream = useCallback(async () => {
    setStreamLoading(true);
    setStreamError(null);
    setSources([]);
    try {
      const p = new URLSearchParams({
        malId:       anime.mal_id      || "",
        anilistId:   anime.anilist_id  || "",
        title:       anime.title_english || anime.title || "",
        titleRomaji: anime.title_romaji  || "",
        ep:          currentEp,
        type:        audioType,
      });
      const res  = await fetch(`${STREAM_API}?${p}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Stream not found");
      if (!data.sources?.length) throw new Error("No playable sources returned");
      setSources(data.sources);
      setQualityIdx(0);
    } catch (e) {
      setStreamError(e.message);
    } finally {
      setStreamLoading(false);
    }
  }, [currentEp, audioType, anime]);

  useEffect(() => { fetchStream(); }, [fetchStream]);

  // ── Init / swap HLS when source changes ──────────────────────────────────────
  useEffect(() => {
    if (!sources.length || !videoRef.current) return;
    const src = sources[qualityIdx]?.url;
    if (!src) return;

    const attach = () => {
      if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
      const vid = videoRef.current;

      if (window.Hls?.isSupported()) {
        const hls = new window.Hls({ enableWorker: true, lowLatencyMode: false });
        hls.loadSource(src);
        hls.attachMedia(vid);
        hls.on(window.Hls.Events.MANIFEST_PARSED, () => {
          vid.play().catch(() => {});
        });
        hls.on(window.Hls.Events.ERROR, (_, d) => {
          if (d.fatal) setStreamError("Playback error — try another quality or reload.");
        });
        hlsRef.current = hls;
      } else if (vid.canPlayType("application/vnd.apple.mpegurl")) {
        vid.src = src;
        vid.play().catch(() => {});
      } else {
        setStreamError("HLS not supported in this browser.");
      }
    };

    loadHlsScript(attach);
    return () => { if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; } };
  }, [sources, qualityIdx]);

  // ── Scroll active episode into view ──────────────────────────────────────────
  useEffect(() => {
    if (!epListRef.current) return;
    const active = epListRef.current.querySelector("[data-active='true']");
    active?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [currentEp]);

  // ── Video event handlers ──────────────────────────────────────────────────────
  const onPlay        = () => setPlaying(true);
  const onPause       = () => setPlaying(false);
  const onTimeUpdate  = () => setCurrentTime(videoRef.current?.currentTime || 0);
  const onDurationChange = () => setDuration(videoRef.current?.duration || 0);
  const onWaiting     = () => setBuffering(true);
  const onCanPlay     = () => setBuffering(false);
  const onFullChange  = () => setIsFullscreen(!!document.fullscreenElement);

  useEffect(() => {
    document.addEventListener("fullscreenchange", onFullChange);
    return () => document.removeEventListener("fullscreenchange", onFullChange);
  }, []);

  // ── Controls visibility ───────────────────────────────────────────────────────
  const showCtrl = () => {
    setShowControls(true);
    clearTimeout(controlTimer.current);
    controlTimer.current = setTimeout(() => playing && setShowControls(false), 3000);
  };

  // ── Player actions ────────────────────────────────────────────────────────────
  const togglePlay = () => {
    if (!videoRef.current) return;
    playing ? videoRef.current.pause() : videoRef.current.play();
  };

  const seek = (e) => {
    if (!videoRef.current || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct  = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    videoRef.current.currentTime = pct * duration;
  };

  const changeVolume = (e) => {
    const v = parseFloat(e.target.value);
    setVolume(v);
    if (videoRef.current) videoRef.current.volume = v;
    setMuted(v === 0);
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    const next = !muted;
    videoRef.current.muted = next;
    setMuted(next);
  };

  const toggleFullscreen = () => {
    if (!wrapperRef.current) return;
    if (!document.fullscreenElement) wrapperRef.current.requestFullscreen();
    else document.exitFullscreen();
  };

  const goEp = (n) => {
    if (n < 1 || n > totalEps) return;
    setCurrentEp(n);
  };

  const progress = duration ? (currentTime / duration) * 100 : 0;

  // ── Render ────────────────────────────────────────────────────────────────────
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

        {/* ── LEFT: Player + Info ───────────────────────────────────────────── */}
        <div className="flex-1 min-w-0">

          {/* PLAYER WRAPPER */}
          <div
            ref={wrapperRef}
            onMouseMove={showCtrl}
            onMouseLeave={() => playing && setShowControls(false)}
            className="relative bg-black rounded-2xl overflow-hidden aspect-video group"
          >
            {/* Video element */}
            <video
              ref={videoRef}
              className="w-full h-full object-contain"
              onPlay={onPlay}
              onPause={onPause}
              onTimeUpdate={onTimeUpdate}
              onDurationChange={onDurationChange}
              onWaiting={onWaiting}
              onCanPlay={onCanPlay}
              onClick={togglePlay}
              playsInline
            />

            {/* Loading overlay */}
            {(streamLoading || buffering) && !streamError && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="w-10 h-10 text-indigo-400 animate-spin" />
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">
                    {streamLoading ? "Loading stream…" : "Buffering…"}
                  </p>
                </div>
              </div>
            )}

            {/* Error overlay */}
            {streamError && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/80">
                <div className="text-center px-6">
                  <AlertTriangle className="w-10 h-10 text-red-400 mx-auto mb-3" />
                  <p className="text-sm font-bold text-red-400 mb-1">Stream Error</p>
                  <p className="text-xs text-gray-500 mb-4 max-w-xs">{streamError}</p>
                  <button
                    onClick={fetchStream}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-xs font-black uppercase tracking-widest transition mx-auto"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Retry
                  </button>
                </div>
              </div>
            )}

            {/* Big play/pause button (center) */}
            {!streamLoading && !streamError && !buffering && (
              <div
                onClick={togglePlay}
                className={`absolute inset-0 flex items-center justify-center transition-opacity duration-200 cursor-pointer ${
                  showControls && !playing ? "opacity-100" : "opacity-0 pointer-events-none"
                }`}
              >
                <div className="w-16 h-16 rounded-full bg-white/10 backdrop-blur flex items-center justify-center border border-white/20">
                  <Play className="w-7 h-7 text-white ml-1" />
                </div>
              </div>
            )}

            {/* CONTROLS BAR */}
            <div className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent px-4 pb-4 pt-10 transition-opacity duration-300 ${showControls || !playing ? "opacity-100" : "opacity-0"}`}>

              {/* Progress bar */}
              <div
                className="relative h-1.5 bg-white/20 rounded-full mb-3 cursor-pointer group/seek"
                onClick={seek}
              >
                <div
                  className="absolute top-0 left-0 h-full bg-indigo-500 rounded-full transition-all"
                  style={{ width: `${progress}%` }}
                />
                <div
                  className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-lg opacity-0 group-hover/seek:opacity-100 transition"
                  style={{ left: `calc(${progress}% - 6px)` }}
                />
              </div>

              <div className="flex items-center gap-3">
                {/* Play/Pause */}
                <button onClick={togglePlay} className="text-white hover:text-indigo-300 transition">
                  {playing
                    ? <Pause className="w-5 h-5" />
                    : <Play  className="w-5 h-5" />}
                </button>

                {/* Ep prev/next */}
                <button onClick={() => goEp(currentEp - 1)} disabled={currentEp <= 1}
                  className="text-gray-400 hover:text-white disabled:opacity-30 transition">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button onClick={() => goEp(currentEp + 1)} disabled={currentEp >= totalEps}
                  className="text-gray-400 hover:text-white disabled:opacity-30 transition">
                  <ChevronRight className="w-4 h-4" />
                </button>

                {/* Time */}
                <span className="text-xs font-mono text-gray-300 tabular-nums">
                  {fmtTime(currentTime)} / {fmtTime(duration)}
                </span>

                <div className="flex-1" />

                {/* Quality selector */}
                {sources.length > 1 && (
                  <select
                    value={qualityIdx}
                    onChange={(e) => setQualityIdx(Number(e.target.value))}
                    className="bg-white/10 border border-white/20 text-white text-[11px] font-bold rounded-lg px-2 py-1 focus:outline-none"
                  >
                    {sources.map((s, i) => (
                      <option key={i} value={i} className="bg-gray-900">
                        {s.quality || `Source ${i + 1}`}
                      </option>
                    ))}
                  </select>
                )}

                {/* Volume */}
                <div className="flex items-center gap-1.5">
                  <button onClick={toggleMute} className="text-gray-300 hover:text-white transition">
                    {muted || volume === 0
                      ? <VolumeX className="w-4 h-4" />
                      : <Volume2 className="w-4 h-4" />}
                  </button>
                  <input
                    type="range" min="0" max="1" step="0.05"
                    value={muted ? 0 : volume}
                    onChange={changeVolume}
                    className="w-16 accent-indigo-500 cursor-pointer"
                  />
                </div>

                {/* Fullscreen */}
                <button onClick={toggleFullscreen} className="text-gray-300 hover:text-white transition">
                  {isFullscreen
                    ? <Minimize className="w-4 h-4" />
                    : <Maximize className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          {/* ANIME INFO */}
          <div className="mt-5 bg-white/5 rounded-2xl border border-white/5 p-5">
            <div className="flex items-start gap-4">
              <img
                src={anime.images?.webp?.large_image_url || anime.images?.jpg?.large_image_url}
                alt={anime.title}
                className="w-16 h-22 rounded-xl object-cover flex-shrink-0"
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
            <div
              ref={epListRef}
              className="overflow-y-auto"
              style={{ maxHeight: "calc(100vh - 160px)" }}
            >
              {episodes.map((ep) => (
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
