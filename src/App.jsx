import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  Search, BookOpen, Star, Info, Hash, Sparkles, Send, X,
  ChevronDown, ChevronUp, ImageOff, FilterX, Lightbulb,
  Zap, Layers, RefreshCw, AlertTriangle, WifiOff, Clock,
} from "lucide-react";
import MangaDetailPage from "./MangaDetailPage";

const API = { manga: "/api/anime", topManga: "/api/top-anime", grok: "/api/grok" };

const GENRE_MAP = {
  "Action": 1, "Adventure": 2, "Avant Garde": 5, "Award Winning": 46, "Boys Love": 28,
  "Comedy": 4, "Drama": 8, "Ecchi": 9, "Fantasy": 10,
  "Girls Love": 26, "Gourmet": 47, "Horror": 14, "Isekai": 62, "Iyashikei": 63,
  "Mecha": 18, "Military": 38, "Music": 19, "Mystery": 7, "Mythology": 6,
  "Psychological": 40, "Romance": 22, "Sci-Fi": 24, "Seinen": 42, "Shoujo": 25,
  "Shounen": 27, "Slice of Life": 36, "Sports": 30, "Supernatural": 37, "Suspense": 41,
  "Work Life": 48, "History": 13, "Martial Arts": 17, "Parody": 20, "Samurai": 21,
  "Space": 29, "Vampire": 32, "Harem": 35, "Police": 39, "School": 23, "Super Power": 31,
};
const ALL_GENRES = Object.keys(GENRE_MAP).sort();

// ── MANGA CARD ────────────────────────────────────────────────────────────────
const MangaCard = ({ manga, isPriority, onClick }) => {
  const [imageError, setImageError] = useState(false);
  const coverUrl = useMemo(() => (
    manga.images?.webp?.large_image_url ||
    manga.images?.jpg?.large_image_url ||
    manga.images?.webp?.image_url
  ), [manga]);

  return (
    <div
      onClick={() => onClick(manga)}
      className={`group cursor-pointer transition-all duration-300 active:scale-95 ${
        isPriority ? "ring-2 ring-indigo-500/50 rounded-2xl" : ""
      }`}
    >
      <div className="relative aspect-[2/3] rounded-xl sm:rounded-2xl overflow-hidden shadow-xl bg-gray-900 border border-gray-800/50">
        {coverUrl && !imageError ? (
          <img
            src={coverUrl}
            alt={manga.title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-gray-900 text-gray-700 p-4 text-center">
            <ImageOff className="w-8 h-8 mb-2 opacity-20" />
            <span className="text-[9px] font-bold uppercase tracking-wider opacity-30">No Cover</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-gray-950 via-gray-950/10 to-transparent" />

        {isPriority && (
          <div className="absolute top-2 left-2 bg-indigo-600/90 backdrop-blur px-2 py-0.5 rounded-lg flex items-center gap-1 z-10">
            <Zap className="w-2.5 h-2.5 text-white fill-white" />
            <span className="text-[8px] font-black text-white uppercase">Top</span>
          </div>
        )}
        <div className="absolute top-2 right-2 bg-black/60 backdrop-blur px-1.5 py-0.5 rounded-lg flex items-center gap-0.5 z-10">
          <Star className="w-2.5 h-2.5 text-yellow-400 fill-yellow-400" />
          <span className="text-[10px] font-bold text-white">{manga.score || "?"}</span>
        </div>

        {/* Hover overlay — desktop only */}
        <div className="absolute inset-0 bg-indigo-600/0 group-hover:bg-indigo-600/15 transition-all duration-300 hidden sm:flex items-center justify-center">
          <div className="opacity-0 group-hover:opacity-100 transition-all duration-200 flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600/90 backdrop-blur rounded-xl">
            <BookOpen className="w-3.5 h-3.5 text-white" />
            <span className="text-[10px] font-black text-white uppercase tracking-wider">View</span>
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-3">
          <h3 className="font-bold text-white text-xs sm:text-sm leading-tight line-clamp-2 group-hover:text-indigo-300 transition-colors">
            {manga.title}
          </h3>
          <div className="flex flex-wrap gap-1 mt-1.5">
            {manga.genres?.slice(0, 2).map((g) => (
              <span key={g.mal_id} className="text-[8px] sm:text-[9px] font-bold bg-white/5 text-gray-400 px-1.5 py-0.5 rounded border border-white/10 uppercase tracking-tight">
                {g.name}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const FormattedText = ({ text }) => {
  if (!text) return null;
  return (
    <span>
      {text.split(/(\*{4}.*?\*{4}|\*{2}.*?\*{2})/g).map((part, i) => {
        if (part.startsWith("****") && part.endsWith("****"))
          return <strong key={i} className="font-black text-white">{part.slice(4, -4)}</strong>;
        if (part.startsWith("**") && part.endsWith("**"))
          return <em key={i} className="italic text-indigo-300">{part.slice(2, -2)}</em>;
        return part;
      })}
    </span>
  );
};

// ── APP ───────────────────────────────────────────────────────────────────────
export default function App() {
  const [searchQuery, setSearchQuery]       = useState("");
  const [selectedGenres, setSelectedGenres] = useState([]);
  const [mangaList, setMangaList]           = useState([]);
  const [priorityIds, setPriorityIds]       = useState(new Set());
  const [isLoading, setIsLoading]           = useState(true);
  const [fetchError, setFetchError]         = useState(null);
  const [errorType, setErrorType]           = useState(null);
  const [aiOpen, setAiOpen]                 = useState(false);
  const [aiInput, setAiInput]               = useState("");
  const [showAllGenres, setShowAllGenres]   = useState(false);
  const [fallbackMode, setFallbackMode]     = useState(null);
  const [chatHistory, setChatHistory]       = useState([
    { role: "assistant", text: "System Online. Ask me for manga recommendations, comparisons, or anything!" },
  ]);
  const [isTyping, setIsTyping]             = useState(false);
  const [aiCooldown, setAiCooldown]         = useState(0);
  const [selectedManga, setSelectedManga]   = useState(null); // opens detail page

  const cooldownRef = useRef(null);
  const chatEndRef  = useRef(null);

  const startCooldown = (seconds = 30) => {
    setAiCooldown(seconds);
    if (cooldownRef.current) clearInterval(cooldownRef.current);
    cooldownRef.current = setInterval(() => {
      setAiCooldown((prev) => {
        if (prev <= 1) { clearInterval(cooldownRef.current); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  useEffect(() => () => clearInterval(cooldownRef.current), []);

  const fetchManga = async () => {
    setIsLoading(true);
    setFetchError(null);
    let resolvedErrorType = null;
    try {
      const params = new URLSearchParams({ limit: "24" });
      let endpoint;
      if (searchQuery.trim()) {
        endpoint = API.manga;
        params.append("q", searchQuery.trim());
        setFallbackMode(null);
      } else if (selectedGenres.length > 0) {
        endpoint = API.manga;
        params.append("genres", selectedGenres.map((g) => GENRE_MAP[g]).join(","));
        setFallbackMode(null);
      } else {
        endpoint = API.topManga;
        setFallbackMode(null);
      }

      let response;
      try { response = await fetch(`${endpoint}?${params}`); }
      catch (networkErr) { resolvedErrorType = "network"; throw new Error(`Cannot reach the API.\n${networkErr.message}`); }

      const json = await response.json();
      if (!response.ok) { resolvedErrorType = response.status === 429 ? "ratelimit" : "http"; throw new Error(json.error || `HTTP ${response.status}`); }

      const data = json.data || [];
      if (selectedGenres.length > 1 && data.length > 0) {
        const targetIds = selectedGenres.map((g) => GENRE_MAP[g]);
        const perfect = data.filter((m) => targetIds.every((id) => (m.genres?.map((g) => g.mal_id) || []).includes(id)));
        const rest = data.filter((m) => !targetIds.every((id) => (m.genres?.map((g) => g.mal_id) || []).includes(id)));
        setPriorityIds(new Set(perfect.map((m) => m.mal_id)));
        if (perfect.length > 0) setFallbackMode("discovery");
        setMangaList([...perfect, ...rest]);
      } else {
        setPriorityIds(new Set());
        setMangaList(data);
      }
    } catch (err) {
      setFetchError(err.message || "Unknown error.");
      setErrorType(resolvedErrorType || "unknown");
      setMangaList([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { const t = setTimeout(fetchManga, 700); return () => clearTimeout(t); }, [searchQuery, selectedGenres]);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatHistory]);

  const toggleGenre = (genre) =>
    setSelectedGenres((prev) => prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre]);

  const handleAiSearch = async (e) => {
    e.preventDefault();
    if (!aiInput.trim() || isTyping || aiCooldown > 0) return;
    const userMsg = aiInput;
    setAiInput("");
    const currentHistory = chatHistory;
    setChatHistory((prev) => [...prev, { role: "user", text: userMsg }]);
    setIsTyping(true);
    try {
      const response = await fetch("/api/grok", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMsg, history: currentHistory }),
      });
      const data = await response.json();
      if (!response.ok) {
        if (data.isRateLimit || response.status === 429) {
          startCooldown(30);
          setChatHistory((prev) => [...prev, { role: "assistant", text: "AI is temporarily rate-limited. Please wait 30 seconds." }]);
        } else throw new Error(data.error || "AI error");
        return;
      }
      setChatHistory((prev) => [...prev, { role: "assistant", text: data.reply }]);
    } catch (err) {
      setChatHistory((prev) => [...prev, { role: "assistant", text: `Connection error: ${err.message}` }]);
    } finally {
      setIsTyping(false);
    }
  };

  const displayedGenres = showAllGenres ? ALL_GENRES : ALL_GENRES.slice(0, 12);
  const errorIcon = errorType === "network" ? <WifiOff className="w-10 h-10 text-red-500/60" /> : <AlertTriangle className="w-10 h-10 text-red-500/60" />;

  // ── DETAIL PAGE ────────────────────────────────────────────────────────────
  if (selectedManga) {
    return (
      <MangaDetailPage
        manga={selectedManga}
        onBack={() => setSelectedManga(null)}
        onSelectManga={(m) => setSelectedManga(m)}
      />
    );
  }

  // ── MAIN PAGE ──────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 font-sans selection:bg-indigo-500 selection:text-white">

      {/* ── HEADER ── */}
      <header className="sticky top-0 z-30 bg-gray-950/90 backdrop-blur-2xl border-b border-white/5 shadow-xl">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center gap-3 sm:gap-6">
            {/* Logo */}
            <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
              <div className="bg-indigo-600 p-2 sm:p-2.5 rounded-xl sm:rounded-2xl shadow-lg shadow-indigo-600/30">
                <BookOpen className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </div>
              <div className="hidden sm:block">
                <h1 className="text-xl sm:text-2xl font-black tracking-tighter bg-gradient-to-br from-white to-gray-500 bg-clip-text text-transparent">
                  MANGAEXPLORE
                </h1>
                <p className="text-[9px] font-bold text-indigo-400 tracking-[0.2em] uppercase leading-none">
                  Discovery Terminal
                </p>
              </div>
              <h1 className="sm:hidden text-lg font-black tracking-tighter text-white">MANGA</h1>
            </div>

            {/* Search */}
            <div className="relative flex-1 group">
              <Search className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 group-focus-within:text-indigo-400 transition-colors" />
              <input
                type="text"
                placeholder="Search manga..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 sm:pl-12 pr-3 sm:pr-5 py-2.5 sm:py-3.5 bg-white/5 border border-white/10 rounded-xl sm:rounded-2xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all placeholder:text-gray-600 focus:bg-white/10"
              />
            </div>

            {/* AI button */}
            <button
              onClick={() => setAiOpen(true)}
              className="flex items-center gap-1.5 sm:gap-2.5 px-3 sm:px-5 py-2.5 sm:py-3.5 bg-indigo-600 hover:bg-indigo-500 rounded-xl sm:rounded-2xl font-bold text-xs sm:text-sm transition-all shadow-lg shadow-indigo-600/20 active:scale-95 flex-shrink-0"
            >
              <Sparkles className="w-4 h-4" />
              <span className="hidden sm:inline">Ask AI</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 py-6 sm:py-10">

        {/* ── GENRE FILTERS ── */}
        <section className="mb-8 sm:mb-12 bg-white/5 p-4 sm:p-8 rounded-2xl sm:rounded-[2.5rem] border border-white/5">
          <div className="flex items-center justify-between mb-4 sm:mb-6">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-1.5 sm:p-2 bg-indigo-500/10 rounded-lg sm:rounded-xl">
                <Hash className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-400" />
              </div>
              <h2 className="font-black text-white tracking-widest uppercase text-[10px] sm:text-xs">Genres</h2>
            </div>
            <div className="flex gap-3 sm:gap-5">
              {selectedGenres.length > 0 && (
                <button
                  onClick={() => { setSelectedGenres([]); setFallbackMode(null); }}
                  className="text-[10px] font-black text-red-400 hover:text-red-300 flex items-center gap-1 transition uppercase tracking-widest"
                >
                  Clear <FilterX className="w-3 h-3" />
                </button>
              )}
              <button
                onClick={() => setShowAllGenres(!showAllGenres)}
                className="text-[10px] font-black text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition uppercase tracking-widest"
              >
                {showAllGenres ? "Less" : "More"}
                {showAllGenres ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {displayedGenres.map((genre) => (
              <button
                key={genre}
                onClick={() => toggleGenre(genre)}
                className={`px-3 sm:px-5 py-1.5 sm:py-2 rounded-xl sm:rounded-2xl text-[10px] sm:text-[11px] font-bold uppercase tracking-wider transition-all duration-200 border active:scale-95 ${
                  selectedGenres.includes(genre)
                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 border-indigo-500"
                    : "bg-white/5 text-gray-500 hover:bg-white/10 hover:text-gray-200 border-white/5"
                }`}
              >
                {genre}
              </button>
            ))}
          </div>
        </section>

        {/* ── RESULTS HEADER ── */}
        <div className="flex items-center justify-between mb-5 sm:mb-8 px-1">
          <div>
            <div className="flex items-center gap-2 text-indigo-500 text-[9px] sm:text-[10px] font-black uppercase tracking-[0.3em] sm:tracking-[0.4em] mb-1">
              <Layers className="w-3.5 h-3.5" /> Live Feed
            </div>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tighter">
                {searchQuery ? `"${searchQuery}"` : selectedGenres.length > 0 ? "Filtered" : "Top Manga"}
              </h2>
              {!isLoading && !fetchError && (
                <span className="bg-white/5 border border-white/10 px-2.5 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  {mangaList.length}
                </span>
              )}
            </div>
            {fallbackMode === "discovery" && (
              <div className="flex items-center gap-2 mt-2 py-1.5 px-3 sm:px-4 bg-indigo-500/10 border border-indigo-500/20 rounded-xl w-fit">
                <Lightbulb className="w-3.5 h-3.5 text-indigo-400" />
                <span className="text-[9px] sm:text-[10px] font-bold text-indigo-400 uppercase tracking-widest">
                  Prioritizing exact matches
                </span>
              </div>
            )}
          </div>
          {!isLoading && (
            <button
              onClick={fetchManga}
              className="flex items-center gap-1.5 px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-[10px] font-black text-gray-400 hover:text-white transition uppercase tracking-widest"
            >
              <RefreshCw className="w-3 h-3" />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          )}
        </div>

        {/* ── SKELETON ── */}
        {isLoading && (
          <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-6 animate-pulse">
            {[...Array(12)].map((_, i) => (
              <div key={i} className="aspect-[2/3] bg-white/5 rounded-xl sm:rounded-[2rem] border border-white/5" />
            ))}
          </div>
        )}

        {/* ── ERROR ── */}
        {!isLoading && fetchError && (
          <div className="text-center py-16 sm:py-24 bg-red-950/10 rounded-2xl sm:rounded-[3rem] border border-dashed border-red-500/20 mx-2">
            <div className="bg-gray-900 w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6">
              {errorIcon}
            </div>
            <h3 className="text-xl sm:text-2xl font-black text-red-400/80 mb-2 tracking-tighter">
              {errorType === "ratelimit" ? "Rate Limited" : errorType === "network" ? "Network Error" : "Error"}
            </h3>
            <pre className="text-[10px] text-gray-600 mb-6 font-mono max-w-xs mx-auto whitespace-pre-wrap break-words px-4">{fetchError}</pre>
            <div className="flex gap-3 justify-center">
              <button onClick={fetchManga} className="px-5 sm:px-8 py-2.5 sm:py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black transition uppercase text-xs tracking-widest active:scale-95 flex items-center gap-2">
                <RefreshCw className="w-3.5 h-3.5" /> Retry
              </button>
              <button onClick={() => { setSearchQuery(""); setSelectedGenres([]); }} className="px-5 sm:px-8 py-2.5 sm:py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 hover:text-white rounded-2xl font-black transition uppercase text-xs tracking-widest">
                Reset
              </button>
            </div>
          </div>
        )}

        {/* ── MANGA GRID ── */}
        {!isLoading && !fetchError && mangaList.length > 0 && (
          <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-3 sm:gap-5 md:gap-6">
            {mangaList.map((manga) => (
              <MangaCard
                key={manga.anilist_id || manga.mal_id}
                manga={manga}
                isPriority={priorityIds.has(manga.mal_id)}
                onClick={setSelectedManga}
              />
            ))}
          </div>
        )}

        {/* ── EMPTY ── */}
        {!isLoading && !fetchError && mangaList.length === 0 && (
          <div className="text-center py-28 bg-white/5 rounded-[3rem] border border-dashed border-white/10">
            <Info className="w-10 h-10 text-gray-700 mx-auto mb-4" />
            <h3 className="text-2xl font-black text-gray-400 mb-4 tracking-tighter">No Results</h3>
            <button onClick={() => { setSearchQuery(""); setSelectedGenres([]); }} className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black transition uppercase text-xs tracking-widest active:scale-95">
              Reset
            </button>
          </div>
        )}
      </main>

      {/* ── AI PANEL ── */}
      {aiOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-full sm:max-w-xl bg-gray-950 h-full flex flex-col shadow-2xl border-l border-white/5">
            <div className="p-5 sm:p-8 border-b border-white/5 flex items-center justify-between bg-white/5">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="p-2.5 sm:p-3 bg-indigo-600 rounded-xl sm:rounded-2xl shadow-lg shadow-indigo-600/20">
                  <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-black text-lg sm:text-xl text-white uppercase tracking-tighter leading-none">AI Consultant</h3>
                  <p className="text-[9px] sm:text-[10px] text-indigo-400 font-black uppercase tracking-[0.3em] mt-0.5">Powered by Groq</p>
                </div>
              </div>
              <button onClick={() => setAiOpen(false)} className="p-2.5 hover:bg-white/10 rounded-xl transition">
                <X className="w-5 h-5 text-gray-500 hover:text-white transition" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-5 sm:space-y-8 bg-gray-950/50">
              {chatHistory.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[88%] px-4 sm:px-6 py-3 sm:py-4 rounded-[1.5rem] sm:rounded-[2rem] text-sm leading-relaxed shadow-xl ${
                    msg.role === "user"
                      ? "bg-indigo-600 text-white rounded-tr-none"
                      : "bg-white/5 text-gray-300 rounded-tl-none border border-white/10"
                  }`}>
                    {msg.text.split("\n").map((line, idx) => (
                      <p key={idx} className={idx > 0 ? "mt-2 sm:mt-3" : ""}>
                        <FormattedText text={line} />
                      </p>
                    ))}
                  </div>
                </div>
              ))}
              {isTyping && (
                <div className="flex justify-start">
                  <div className="bg-white/5 px-6 py-3 rounded-[2rem] rounded-tl-none border border-white/10 flex items-center gap-3">
                    <div className="flex gap-1">
                      {["-0.3s", "-0.15s", "0s"].map((d) => (
                        <div key={d} className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: d }} />
                      ))}
                    </div>
                    <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Processing...</span>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            <div className="p-4 sm:p-8 border-t border-white/5 bg-white/5 space-y-2">
              {aiCooldown > 0 && (
                <div className="flex items-center gap-2 px-3 py-2 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
                  <Clock className="w-3.5 h-3.5 text-yellow-400 animate-pulse" />
                  <span className="text-[10px] font-black text-yellow-400 uppercase tracking-widest">Cooling Down — {aiCooldown}s</span>
                </div>
              )}
              <div className="relative">
                <input
                  type="text"
                  placeholder={aiCooldown > 0 ? `Wait ${aiCooldown}s...` : "Ask about manga..."}
                  value={aiInput}
                  onChange={(e) => setAiInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAiSearch(e)}
                  disabled={aiCooldown > 0}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-5 pr-14 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all text-sm font-medium placeholder:text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
                />
                <button
                  onClick={handleAiSearch}
                  disabled={isTyping || aiCooldown > 0 || !aiInput.trim()}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-500 transition active:scale-90 shadow-lg disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {aiCooldown > 0 ? <Clock className="w-4 h-4" /> : <Send className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}
