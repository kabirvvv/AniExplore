import React, { useState, useEffect } from "react";
import {
  X, ChevronLeft, ChevronRight, BookOpen,
  Loader2, AlertTriangle, List,
} from "lucide-react";

export default function MangaReader({ anime, onClose }) {
  const [mangaMatch, setMangaMatch] = useState(null); // { path, source, title }
  const [chapters, setChapters]     = useState([]);
  const [totalChapters, setTotalChapters] = useState(0);
  const [pages, setPages]           = useState([]);
  const [currentChapter, setCurrentChapter] = useState(null);
  const [view, setView]             = useState("search"); // search | chapters | reading
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState(null);

  useEffect(() => { findManga(); }, []);

  // ── 1. FIND MANGA ON SOURCE ────────────────────────────────────────────────

  const findManga = async () => {
    setLoading(true);
    setError(null);
    try {
      // Pass all title variants so the API can try each one
      const params = new URLSearchParams({
        action: "search",
        title:          anime.title          || "",
        title_english:  anime.title_english  || "",
        title_japanese: anime.title_japanese || "",
      });

      const res  = await fetch(`/api/manga?${params}`);
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Manga not found");

      const { source, match } = data;
      const displayTitle = match.title || anime.title;

      setMangaMatch({ path: match.path, source, title: displayTitle });
      await fetchChapters(match.path, source);
      setView("chapters");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ── 2. FETCH CHAPTER LIST ─────────────────────────────────────────────────

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

  // ── 3. READ A CHAPTER ─────────────────────────────────────────────────────

  const readChapter = async (chapter) => {
    setLoading(true);
    setError(null);
    setPages([]);
    try {
      const res  = await fetch(
        `/api/manga?action=pages&path=${encodeURIComponent(chapter.path)}&source=${mangaMatch.source}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load pages");

      setPages(data.pages || []);
      setCurrentChapter(chapter);
      setView("reading");
      window.scrollTo(0, 0);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ── LOADING SCREEN ────────────────────────────────────────────────────────

  if (loading && view === "search") {
    return (
      <div className="fixed inset-0 z-50 bg-gray-950 flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
        <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">
          Finding manga...
        </p>
        <button
          onClick={onClose}
          className="mt-8 text-gray-600 hover:text-white text-xs uppercase tracking-widest"
        >
          Cancel
        </button>
      </div>
    );
  }

  // ── ERROR SCREEN ──────────────────────────────────────────────────────────

  if (error && view === "search") {
    return (
      <div className="fixed inset-0 z-50 bg-gray-950 flex flex-col items-center justify-center gap-4 p-8 text-center">
        <AlertTriangle className="w-12 h-12 text-red-500/60" />
        <h3 className="text-xl font-black text-red-400 tracking-tighter">Not Found</h3>
        <p className="text-gray-500 text-sm max-w-sm">{error}</p>
        <button
          onClick={onClose}
          className="mt-4 px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black uppercase text-xs tracking-widest"
        >
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
      <div className="fixed inset-0 z-50 bg-[#0a0a0a] overflow-y-auto">
        {/* Top bar */}
        <div className="sticky top-0 z-50 bg-black/95 backdrop-blur-xl border-b border-white/5 px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => setView("chapters")}
            className="flex items-center gap-2 text-gray-400 hover:text-white transition text-sm font-bold"
          >
            <List className="w-4 h-4" /> Chapters
          </button>
          <span className="text-white font-black text-sm truncate max-w-[200px]">
            Ch. {currentChapter?.number || "?"} — {mangaMatch?.title}
          </span>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-xl transition"
          >
            <X className="w-5 h-5 text-gray-400 hover:text-white" />
          </button>
        </div>

        {/* Pages */}
        <div className="flex flex-col items-center w-full max-w-3xl mx-auto">
          {loading ? (
            <div className="flex items-center justify-center py-32">
              <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
            </div>
          ) : pages.length === 0 ? (
            <div className="py-32 text-gray-500 text-sm">No pages found for this chapter.</div>
          ) : (
            pages.map((url, i) => (
              <img
                key={i}
                src={url}
                alt={`Page ${i + 1}`}
                className="w-full h-auto object-contain"
                loading="lazy"
              />
            ))
          )}
        </div>

        {/* Prev / Next */}
        <div className="flex items-center justify-center gap-4 p-8">
          <button
            onClick={() => prevChapter && readChapter(prevChapter)}
            disabled={!prevChapter}
            className="flex items-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 hover:text-white rounded-2xl font-black text-xs uppercase tracking-widest disabled:opacity-30 disabled:cursor-not-allowed transition"
          >
            <ChevronLeft className="w-4 h-4" /> Prev
          </button>
          <button
            onClick={() => nextChapter && readChapter(nextChapter)}
            disabled={!nextChapter}
            className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest disabled:opacity-30 disabled:cursor-not-allowed transition"
          >
            Next <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  // ── CHAPTER LIST VIEW ─────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 bg-gray-950 overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-gray-950/95 backdrop-blur-xl border-b border-white/5 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BookOpen className="w-5 h-5 text-indigo-400" />
          <div>
            <h2 className="font-black text-white tracking-tighter leading-none">
              {mangaMatch?.title || anime.title}
            </h2>
            <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest mt-0.5">
              {totalChapters} chapters · via{" "}
              {mangaMatch?.source === "atsumoe" ? "AtsuMoe" : "MangaPill"}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:bg-white/10 rounded-xl transition"
        >
          <X className="w-5 h-5 text-gray-400 hover:text-white" />
        </button>
      </div>

      {/* Inline error banner (non-fatal) */}
      {error && (
        <div className="mx-6 mt-4 p-4 bg-red-950/30 border border-red-500/20 rounded-2xl text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Chapter grid */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-32">
            <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
          </div>
        ) : chapters.length === 0 ? (
          <div className="text-center py-20 text-gray-500">No chapters found.</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {chapters.map((ch) => (
              <button
                key={ch.id}
                onClick={() => readChapter(ch)}
                className="flex flex-col gap-1 p-4 bg-white/5 hover:bg-indigo-600/20 border border-white/5 hover:border-indigo-500/30 rounded-2xl text-left transition group"
              >
                <span className="text-white font-black text-sm group-hover:text-indigo-300 transition">
                  Ch. {ch.number}
                </span>
                {ch.title && ch.title !== `Chapter ${ch.number}` && (
                  <span className="text-[10px] text-gray-500 truncate">{ch.title}</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
