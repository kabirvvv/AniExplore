import React, { useState, useEffect } from "react";
import { X, ChevronLeft, ChevronRight, BookOpen, Loader2, AlertTriangle, List } from "lucide-react";

export default function MangaReader({ anime, onClose }) {
  const [mangaId, setMangaId] = useState(null);
  const [mangaTitle, setMangaTitle] = useState("");
  const [chapters, setChapters] = useState([]);
  const [totalChapters, setTotalChapters] = useState(0);
  const [chapOffset, setChapOffset] = useState(0);
  const [pages, setPages] = useState([]);
  const [currentChapter, setCurrentChapter] = useState(null);
  const [view, setView] = useState("search");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    searchManga();
  }, []);

  // Build progressively simpler title variants to maximize MangaDex match rate
  const buildTitleVariants = (anime) => {
    const clean = (t) =>
      t
        ?.replace(/\s+(season|part|cour|s)\s*\d+/gi, "") // "Season 3 Part 2"
        ?.replace(/\s+\d+(st|nd|rd|th)\s+season/gi, "") // "3rd Season"
        ?.replace(/\s*[：:]\s*.+$/, "")                  // subtitle after colon
        ?.replace(/\s*[-–]\s*.+$/, "")                   // subtitle after dash
        ?.replace(/\s*!+$/, "")                          // trailing exclamation
        ?.replace(/\s*\(.*?\)\s*/g, "")                  // anything in brackets
        ?.trim();

    return [
      anime.title_english,
      clean(anime.title_english),
      anime.title,
      clean(anime.title),
      anime.title_japanese,
    ]
      .filter(Boolean)
      .filter((v, i, arr) => arr.indexOf(v) === i); // deduplicate
  };

  const searchManga = async () => {
    setLoading(true);
    setError(null);
    try {
      const titles = buildTitleVariants(anime);

      let found = null;
      for (const title of titles) {
        const res = await fetch(`/api/mangadex?action=search&title=${encodeURIComponent(title)}`);
        const data = await res.json();
        if (data.data && data.data.length > 0) {
          found = data.data[0];
          break;
        }
      }

      if (!found) {
        throw new Error(`Could not find "${anime.title}" on MangaDex. It may not have an English translation available.`);
      }

      const title =
        found.attributes.title.en ||
        Object.values(found.attributes.title)[0] ||
        anime.title;

      setMangaId(found.id);
      setMangaTitle(title);
      await fetchChapters(found.id, 0);
      setView("chapters");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchChapters = async (id, offset) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/mangadex?action=chapters&id=${id}&offset=${offset}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load chapters");

      const seen = new Set();
      const unique = (data.data || []).filter((ch) => {
        const num = ch.attributes.chapter || "Oneshot";
        if (seen.has(num)) return false;
        seen.add(num);
        return true;
      });

      setChapters((prev) => (offset === 0 ? unique : [...prev, ...unique]));
      setTotalChapters(data.total || 0);
      setChapOffset(offset);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const readChapter = async (chapter) => {
    setLoading(true);
    setError(null);
    setPages([]);
    try {
      const res = await fetch(`/api/mangadex?action=pages&chapterId=${chapter.id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load pages");

      const { baseUrl, chapter: chData } = data;
      // Route through our server-side proxy to bypass MangaDex hotlink protection
      const imageUrls = chData.data.map(
        (file) =>
          `/api/mangadex?action=image&url=${encodeURIComponent(
            `${baseUrl}/data/${chData.hash}/${file}`
          )}`
      );

      setPages(imageUrls);
      setCurrentChapter(chapter);
      setView("reading");
      window.scrollTo(0, 0);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadMoreChapters = () => {
    if (mangaId) fetchChapters(mangaId, chapOffset + 96);
  };

  if (loading && view === "search") {
    return (
      <div className="fixed inset-0 z-50 bg-gray-950 flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
        <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">
          Searching MangaDex...
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

  if (view === "reading") {
    const currentIndex = chapters.findIndex((ch) => ch.id === currentChapter?.id);
    const prevChapter = currentIndex > 0 ? chapters[currentIndex - 1] : null;
    const nextChapter =
      currentIndex < chapters.length - 1 ? chapters[currentIndex + 1] : null;

    return (
      <div className="fixed inset-0 z-50 bg-[#0a0a0a] overflow-y-auto">
        <div className="sticky top-0 z-50 bg-black/95 backdrop-blur-xl border-b border-white/5 px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => setView("chapters")}
            className="flex items-center gap-2 text-gray-400 hover:text-white transition text-sm font-bold"
          >
            <List className="w-4 h-4" /> Chapters
          </button>
          <span className="text-white font-black text-sm truncate max-w-[200px]">
            Ch. {currentChapter?.attributes.chapter || "Oneshot"} — {mangaTitle}
          </span>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-xl transition"
          >
            <X className="w-5 h-5 text-gray-400 hover:text-white" />
          </button>
        </div>

        <div className="flex flex-col items-center w-full max-w-3xl mx-auto">
          {loading ? (
            <div className="flex items-center justify-center py-32">
              <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
            </div>
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

  return (
    <div className="fixed inset-0 z-50 bg-gray-950 overflow-y-auto">
      <div className="sticky top-0 z-50 bg-gray-950/95 backdrop-blur-xl border-b border-white/5 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BookOpen className="w-5 h-5 text-indigo-400" />
          <div>
            <h2 className="font-black text-white tracking-tighter leading-none">
              {mangaTitle}
            </h2>
            <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest mt-0.5">
              {totalChapters} chapters on MangaDex
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

      {error && (
        <div className="mx-6 mt-4 p-4 bg-red-950/30 border border-red-500/20 rounded-2xl text-red-400 text-sm">
          {error}
        </div>
      )}

      <div className="max-w-4xl mx-auto px-6 py-8">
        {chapters.length === 0 && !loading ? (
          <div className="text-center py-20 text-gray-500">
            No English chapters found.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {chapters.map((ch) => (
              <button
                key={ch.id}
                onClick={() => readChapter(ch)}
                className="flex flex-col gap-1 p-4 bg-white/5 hover:bg-indigo-600/20 border border-white/5 hover:border-indigo-500/30 rounded-2xl text-left transition group"
              >
                <span className="text-white font-black text-sm group-hover:text-indigo-300 transition">
                  Ch. {ch.attributes.chapter || "Oneshot"}
                </span>
                {ch.attributes.title && (
                  <span className="text-[10px] text-gray-500 truncate">
                    {ch.attributes.title}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        {chapters.length < totalChapters && (
          <div className="flex justify-center mt-8">
            <button
              onClick={loadMoreChapters}
              disabled={loading}
              className="px-8 py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 hover:text-white rounded-2xl font-black text-xs uppercase tracking-widest transition disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Load More Chapters
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
