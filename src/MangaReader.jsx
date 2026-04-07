import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  X, ChevronLeft, ChevronRight, BookOpen,
  Loader2, AlertTriangle, List, ZoomIn, ZoomOut,
} from "lucide-react";

export default function MangaReader({ anime, onClose }) {
  const [mangaMatch, setMangaMatch]         = useState(null);
  const [chapters, setChapters]             = useState([]);
  const [totalChapters, setTotalChapters]   = useState(0);
  const [pages, setPages]                   = useState([]);
  const [currentChapter, setCurrentChapter] = useState(null);
  const [view, setView]                     = useState("search");
  const [loading, setLoading]               = useState(false);
  const [error, setError]                   = useState(null);
  const [sidebarOpen, setSidebarOpen]       = useState(false);
  const [zoom, setZoom]                     = useState(100);
  const [headerVisible, setHeaderVisible]   = useState(true);
  const lastScrollY = useRef(0);
  const readingRef  = useRef(null);

  useEffect(() => { findManga(); }, []);

  useEffect(() => {
    if (view !== "reading") return;
    const el = readingRef.current;
    if (!el) return;
    const onScroll = () => {
      const y = el.scrollTop;
      setHeaderVisible(y < lastScrollY.current || y < 80);
      lastScrollY.current = y;
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [view]);

  const findManga = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        action:         "search",
        title:          anime.title          || "",
        title_english:  anime.title_english  || "",
        title_japanese: anime.title_japanese || "",
      });
      const res  = await fetch(`/api/manga?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Manga not found");
      const { source, match } = data;
      setMangaMatch({ path: match.path, source, title: match.title || anime.title });
      await fetchChapters(match.path, source);
      setView("chapters");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchChapters = async (mangaPath, source) => {
    setLoading(true);
    try {
      const res  = await fetch(
        `/api/manga?action=chapters&path=${encodeURIComponent(mangaPath)}&source=${source}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load chapters");
      setChapters(data.chapters || []);
      setTotalChapters(data.total || 0);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const readChapter = useCallback(async (chapter) => {
    setLoading(true);
    setError(null);
    setPages([]);
    setSidebarOpen(false);
    try {
      const res  = await fetch(
        `/api/manga?action=pages&path=${encodeURIComponent(chapter.path)}&source=${mangaMatch.source}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load pages");
      setPages(data.pages || []);
      setCurrentChapter(chapter);
      setView("reading");
      if (readingRef.current) readingRef.current.scrollTo(0, 0);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [mangaMatch]);

  // ── LOADING ───────────────────────────────────────────────────────────────
  if (loading && view === "search") {
    return (
      <div className="fixed inset-0 z-50 bg-gray-950 flex flex-col items-center justify-center gap-4">
        <div className="relative">
          <div className="w-16 h-16 rounded-full border-2 border-indigo-500/20 border-t-indigo-500 animate-spin" />
          <BookOpen className="absolute inset-0 m-auto w-6 h-6 text-indigo-400" />
        </div>
        <p className="text-gray-400 font-black uppercase tracking-widest text-xs mt-2">Finding manga...</p>
        <p className="text-gray-600 text-xs max-w-[200px] text-center">{anime.title}</p>
        <button onClick={onClose} className="mt-6 text-gray-600 hover:text-white text-xs uppercase tracking-widest transition">
          Cancel
        </button>
      </div>
    );
  }

  // ── ERROR ─────────────────────────────────────────────────────────────────
  if (error && view === "search") {
    return (
      <div className="fixed inset-0 z-50 bg-gray-950 flex flex-col items-center justify-center gap-4 p-8 text-center">
        <AlertTriangle className="w-12 h-12 text-red-500/50" />
        <h3 className="text-xl font-black text-red-400 tracking-tighter">Not Found</h3>
        <p className="text-gray-500 text-sm max-w-xs leading-relaxed">{error}</p>
        <button onClick={onClose} className="mt-2 px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black uppercase text-xs tracking-widest transition">
          Go Back
        </button>
      </div>
    );
  }

  // ── READING VIEW ──────────────────────────────────────────────────────────
  if (view === "reading") {
    const currentIndex = chapters.findIndex((ch) => ch.id === currentChapter?.id);
    const prevChapter  = currentIndex > 0 ? chapters[currentIndex - 1] : null;
    const nextChapter  = currentIndex < chapters.length - 1 ? chapters[currentIndex + 1] : null;

    return (
      <div className="fixed inset-0 z-50 bg-[#0a0a0a] flex flex-col">
        {/* Header */}
        <div
          className={`flex-shrink-0 bg-black/95 backdrop-blur-xl border-b border-white/5 px-3 sm:px-5 py-3 flex items-center justify-between transition-all duration-300 ${
            headerVisible ? "translate-y-0 opacity-100" : "-translate-y-full opacity-0 pointer-events-none"
          } sticky top-0 z-10`}
        >
          <button
            onClick={() => setSidebarOpen(true)}
            className="flex items-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-gray-400 hover:text-white transition text-xs font-bold border border-white/5"
          >
            <List className="w-4 h-4" />
            <span className="hidden sm:inline">Chapters</span>
          </button>
          <div className="flex flex-col items-center min-w-0 px-2">
            <span className="text-white font-black text-xs sm:text-sm truncate max-w-[140px] sm:max-w-[260px]">
              {mangaMatch?.title}
            </span>
            <span className="text-indigo-400 text-[10px] font-bold">Chapter {currentChapter?.number}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-1 bg-white/5 rounded-xl border border-white/5 p-1">
              <button onClick={() => setZoom((z) => Math.max(60, z - 20))} className="p-1.5 hover:bg-white/10 rounded-lg transition text-gray-400 hover:text-white">
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="text-gray-400 text-[10px] font-black w-9 text-center">{zoom}%</span>
              <button onClick={() => setZoom((z) => Math.min(200, z + 20))} className="p-1.5 hover:bg-white/10 rounded-lg transition text-gray-400 hover:text-white">
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl transition">
              <X className="w-5 h-5 text-gray-400 hover:text-white" />
            </button>
          </div>
        </div>

        {/* Pages */}
        <div ref={readingRef} className="flex-1 overflow-y-auto">
          <div
            className="flex flex-col items-center mx-auto transition-all"
            style={{ maxWidth: zoom === 100 ? "800px" : `${zoom * 8}px` }}
          >
            {loading ? (
              <div className="flex items-center justify-center py-32">
                <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
              </div>
            ) : pages.length === 0 ? (
              <div className="py-32 text-gray-500 text-sm">No pages found.</div>
            ) : (
              pages.map((url, i) => (
                <img
                  key={i}
                  src={url}
                  alt={`Page ${i + 1}`}
                  className="w-full h-auto object-contain select-none"
                  loading="lazy"
                  draggable={false}
                />
              ))
            )}
          </div>

          {/* Bottom nav */}
          <div className="flex items-center justify-center gap-3 p-6 sm:p-10">
            <button
              onClick={() => prevChapter && readChapter(prevChapter)}
              disabled={!prevChapter || loading}
              className="flex items-center gap-2 px-5 sm:px-7 py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 hover:text-white rounded-2xl font-black text-xs uppercase tracking-widest disabled:opacity-30 disabled:cursor-not-allowed transition"
            >
              <ChevronLeft className="w-4 h-4" /><span className="hidden sm:inline">Prev</span>
            </button>
            <span className="text-gray-600 text-xs font-bold px-2">{currentIndex + 1} / {chapters.length}</span>
            <button
              onClick={() => nextChapter && readChapter(nextChapter)}
              disabled={!nextChapter || loading}
              className="flex items-center gap-2 px-5 sm:px-7 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest disabled:opacity-30 disabled:cursor-not-allowed transition"
            >
              <span className="hidden sm:inline">Next</span><ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Sidebar drawer */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-60 flex">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
            <div className="relative z-10 w-72 sm:w-80 bg-gray-950 border-r border-white/5 h-full flex flex-col shadow-2xl">
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
                <div>
                  <h3 className="text-white font-black text-sm truncate max-w-[180px]">{mangaMatch?.title}</h3>
                  <p className="text-indigo-400 text-[10px] font-bold uppercase tracking-wider">
                    {totalChapters} Chapters · {mangaMatch?.source === "atsumoe" ? "AtsuMoe" : "MangaPill"}
                  </p>
                </div>
                <button onClick={() => setSidebarOpen(false)} className="p-2 hover:bg-white/10 rounded-xl transition">
                  <X className="w-4 h-4 text-gray-400" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
                {chapters.map((ch) => (
                  <button
                    key={ch.id}
                    onClick={() => readChapter(ch)}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-left transition ${
                      ch.id === currentChapter?.id
                        ? "bg-indigo-600 text-white"
                        : "bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white"
                    }`}
                  >
                    <span className="font-black text-xs">Ch. {ch.number}</span>
                    {ch.title && ch.title !== `Chapter ${ch.number}` && (
                      <span className="text-[10px] opacity-60 truncate max-w-[120px] ml-2">{ch.title}</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── CHAPTER LIST ──────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 bg-gray-950 flex flex-col">
      <div className="flex-shrink-0 bg-gray-950/95 backdrop-blur-xl border-b border-white/5 px-4 sm:px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <BookOpen className="w-5 h-5 text-indigo-400 flex-shrink-0" />
          <div className="min-w-0">
            <h2 className="font-black text-white text-sm sm:text-base truncate">{mangaMatch?.title || anime.title}</h2>
            <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest mt-0.5">
              {totalChapters} chapters · {mangaMatch?.source === "atsumoe" ? "AtsuMoe" : "MangaPill"}
            </p>
          </div>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl transition flex-shrink-0">
          <X className="w-5 h-5 text-gray-400 hover:text-white" />
        </button>
      </div>
      {error && (
        <div className="mx-4 mt-3 p-3 bg-red-950/30 border border-red-500/20 rounded-2xl text-red-400 text-xs">{error}</div>
      )}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        {loading ? (
          <div className="flex items-center justify-center py-32">
            <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
          </div>
        ) : chapters.length === 0 ? (
          <div className="text-center py-20 text-gray-500 text-sm">No chapters found.</div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2 sm:gap-3">
            {chapters.map((ch) => (
              <button
                key={ch.id}
                onClick={() => readChapter(ch)}
                className="flex flex-col gap-1 p-3 sm:p-4 bg-white/5 hover:bg-indigo-600/20 border border-white/5 hover:border-indigo-500/30 rounded-xl sm:rounded-2xl text-left transition group active:scale-95"
              >
                <span className="text-white font-black text-xs sm:text-sm group-hover:text-indigo-300 transition">{ch.number}</span>
                <span className="text-gray-600 text-[9px] uppercase tracking-wider">Ch.</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
