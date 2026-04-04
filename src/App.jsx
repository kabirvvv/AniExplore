import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  Search, Play, Star, Info, Hash, Sparkles, Send, X,
  ChevronDown, ChevronUp, ImageOff, FilterX, Lightbulb,
  Zap, Layers, RefreshCw, AlertTriangle, WifiOff,
} from "lucide-react";

// Relative paths — works both locally (via Vite proxy) and on Vercel
const API = {
  anime: "/api/anime",
  topAnime: "/api/top-anime",
  grok: "/api/gemini",
};

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

const AnimeCard = ({ anime, isPriority }) => {
  const [imageError, setImageError] = useState(false);
  const coverUrl = useMemo(() => (
    anime.images?.webp?.large_image_url ||
    anime.images?.jpg?.large_image_url ||
    anime.images?.webp?.image_url
  ), [anime]);

  return (
    <div className={`group cursor-pointer transition-all duration-500 ${isPriority ? "ring-2 ring-indigo-500/50 rounded-2xl scale-[1.02]" : "hover:scale-[1.03]"}`}>
      <div className="relative aspect-[2/3] rounded-2xl overflow-hidden shadow-2xl bg-gray-900 border border-gray-800">
        {coverUrl && !imageError ? (
          <img src={coverUrl} alt={anime.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" loading="lazy" onError={() => setImageError(true)} />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-gray-900 text-gray-700 p-6 text-center">
            <ImageOff className="w-12 h-12 mb-3 opacity-20" />
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-40">Visual Data Missing</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-gray-950 via-gray-950/20 to-transparent opacity-90" />
        {isPriority && (
          <div className="absolute top-3 left-3 bg-indigo-600/90 backdrop-blur-md px-2.5 py-1 rounded-lg flex items-center gap-1.5 border border-white/20 shadow-xl z-10">
            <Zap className="w-3 h-3 text-white fill-white" />
            <span className="text-[10px] font-black text-white uppercase tracking-tighter">Priority Match</span>
          </div>
        )}
        <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md px-2 py-1 rounded-lg flex items-center gap-1 border border-white/10 z-10">
          <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
          <span className="text-[11px] font-bold text-white">{anime.score || "N/A"}</span>
        </div>
        <div className="absolute bottom-0 left-0 right-0 p-5 transform translate-y-1 group-hover:translate-y-0 transition-transform duration-300">
          <h3 className="font-bold text-white text-sm leading-tight mb-2 drop-shadow-2xl line-clamp-2 group-hover:text-indigo-300 transition-colors">{anime.title}</h3>
          <div className="flex flex-wrap gap-1.5">
            {anime.genres?.slice(0, 2).map((g) => (
              <span key={g.mal_id} className="text-[9px] font-bold bg-white/5 backdrop-blur-md text-gray-300 px-2 py-0.5 rounded border border-white/10 uppercase tracking-tighter">{g.name}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const FormattedText = ({ text }) => {
  if (!text) return null;
  const parts = text.split(/(\*{4}.*?\*{4}|\*{2}.*?\*{2})/g);
  return (
    <span>
      {parts.map((part, i) => {
        if (part.startsWith("****") && part.endsWith("****")) return <strong key={i} className="font-black text-white">{part.slice(4, -4)}</strong>;
        if (part.startsWith("**") && part.endsWith("**")) return <em key={i} className="italic text-indigo-300">{part.slice(2, -2)}</em>;
        return part;
      })}
    </span>
  );
};

export default function App() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGenres, setSelectedGenres] = useState([]);
  const [animeList, setAnimeList] = useState([]);
  const [priorityIds, setPriorityIds] = useState(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [errorType, setErrorType] = useState(null);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiInput, setAiInput] = useState("");
  const [showAllGenres, setShowAllGenres] = useState(false);
  const [fallbackMode, setFallbackMode] = useState(null);
  const [chatHistory, setChatHistory] = useState([
    { role: "assistant", text: "System Online. Grok intelligence ready. How can I assist your selection today?" },
  ]);
  const [isTyping, setIsTyping] = useState(false);
  const chatEndRef = useRef(null);

  const fetchAnime = async () => {
    setIsLoading(true);
    setFetchError(null);
    setErrorType(null);
    try {
      const params = new URLSearchParams();
      params.append("limit", "24");
      params.append("sfw", "true");
      params.append("type", "tv");

      let endpoint;
      if (searchQuery.trim()) {
        endpoint = API.anime;
        params.append("q", searchQuery.trim());
        params.append("order_by", "score");
        params.append("sort", "desc");
        setFallbackMode(null);
      } else if (selectedGenres.length > 0) {
        endpoint = API.anime;
        params.append("genres", selectedGenres.map((g) => GENRE_MAP[g]).join(","));
        params.append("order_by", "score");
        params.append("sort", "desc");
        params.append("min_score", "6");
        setFallbackMode(null);
      } else {
        endpoint = API.topAnime;
        setFallbackMode(null);
      }

      let response;
      try {
        response = await fetch(`${endpoint}?${params.toString()}`);
      } catch (networkErr) {
        setErrorType("network");
        throw new Error(`Cannot reach the API.\n${networkErr.message}`);
      }

      const json = await response.json();
      if (!response.ok) {
        setErrorType(response.status === 429 ? "ratelimit" : "http");
        throw new Error(json.error || `HTTP ${response.status}`);
      }

      const data = json.data || [];

      if (selectedGenres.length > 1 && data.length > 0) {
        const targetIds = selectedGenres.map((g) => GENRE_MAP[g]);
        const perfect = data.filter((a) => targetIds.every((id) => (a.genres?.map((g) => g.mal_id) || []).includes(id)));
        const rest = data.filter((a) => !targetIds.every((id) => (a.genres?.map((g) => g.mal_id) || []).includes(id)));
        setPriorityIds(new Set(perfect.map((a) => a.mal_id)));
        if (perfect.length > 0) setFallbackMode("discovery");
        setAnimeList([...perfect, ...rest]);
      } else {
        setPriorityIds(new Set());
        setAnimeList(data);
      }
    } catch (err) {
      setFetchError(err.message || "Unknown error.");
      if (!errorType) setErrorType("unknown");
      setAnimeList([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(fetchAnime, 700);
    return () => clearTimeout(t);
  }, [searchQuery, selectedGenres]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory]);

  const toggleGenre = (genre) =>
    setSelectedGenres((prev) => prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre]);

  const handleAiSearch = async (e) => {
    e.preventDefault();
    if (!aiInput.trim() || isTyping) return;
    const userMsg = aiInput;
    setAiInput("");
    setChatHistory((prev) => [...prev, { role: "user", text: userMsg }]);
    setIsTyping(true);
    try {
      const response = await fetch(API.gemini, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMsg }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Grok error");
      setChatHistory((prev) => [...prev, { role: "assistant", text: data.reply }]);
    } catch (err) {
      setChatHistory((prev) => [...prev, { role: "assistant", text: `Analysis offline: ${err.message}` }]);
    } finally {
      setIsTyping(false);
    }
  };

  const displayedGenres = showAllGenres ? ALL_GENRES : ALL_GENRES.slice(0, 10);
  const errorIcon = errorType === "network"
    ? <WifiOff className="w-10 h-10 text-red-500/60" />
    : <AlertTriangle className="w-10 h-10 text-red-500/60" />;
  const errorTitle = errorType === "ratelimit" ? "Rate Limited" : errorType === "network" ? "Network Unreachable" : "Data Pipeline Error";

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 font-sans selection:bg-indigo-500 selection:text-white">
      <header className="sticky top-0 z-30 bg-gray-950/80 backdrop-blur-2xl border-b border-white/5 shadow-2xl">
        <div className="max-w-[1600px] mx-auto px-6 py-5">
          <div className="flex items-center justify-between gap-8">
            <div className="flex items-center gap-4">
              <div className="bg-indigo-600 p-2.5 rounded-2xl shadow-xl shadow-indigo-600/30">
                <Play className="w-6 h-6 text-white fill-white" />
              </div>
              <div>
                <h1 className="text-2xl font-black tracking-tighter bg-gradient-to-br from-white to-gray-500 bg-clip-text text-transparent">ANIEXPLORE</h1>
                <p className="text-[10px] font-bold text-indigo-400 tracking-[0.2em] uppercase leading-none mt-1">High-Res Terminal</p>
              </div>
            </div>
            <div className="flex flex-1 max-w-2xl items-center gap-4">
              <div className="relative w-full group">
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 group-focus-within:text-indigo-400 transition-colors" />
                <input type="text" placeholder="Universal Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-14 pr-6 py-3.5 bg-white/5 border border-white/10 rounded-2xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all placeholder:text-gray-600 focus:bg-white/10" />
              </div>
              <button onClick={() => setAiOpen(true)} className="flex items-center gap-2.5 px-6 py-3.5 bg-indigo-600 hover:bg-indigo-500 rounded-2xl font-bold text-sm transition-all shadow-2xl shadow-indigo-600/20 active:scale-95 group whitespace-nowrap">
                <Sparkles className="w-4 h-4 group-hover:animate-pulse" />
                <span className="hidden md:inline">Ask AI</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-6 py-10">
        <section className="mb-14 bg-white/5 p-8 rounded-[2.5rem] border border-white/5 shadow-inner">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-500/10 rounded-xl"><Hash className="w-5 h-5 text-indigo-400" /></div>
              <h2 className="font-black text-white tracking-widest uppercase text-xs">Thematic Matrices</h2>
            </div>
            <div className="flex gap-6">
              {selectedGenres.length > 0 && (
                <button onClick={() => { setSelectedGenres([]); setFallbackMode(null); }} className="text-[10px] font-black text-red-400 hover:text-red-300 flex items-center gap-1.5 transition-colors uppercase tracking-widest">
                  Clear All <FilterX className="w-3.5 h-3.5" />
                </button>
              )}
              <button onClick={() => setShowAllGenres(!showAllGenres)} className="text-[10px] font-black text-indigo-400 hover:text-indigo-300 flex items-center gap-1.5 transition-colors uppercase tracking-widest">
                {showAllGenres ? "Simplify View" : "Expand Catalog"}
                {showAllGenres ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            {displayedGenres.map((genre) => (
              <button key={genre} onClick={() => toggleGenre(genre)} className={`px-6 py-2.5 rounded-2xl text-[11px] font-bold uppercase tracking-wider transition-all duration-300 border ${selectedGenres.includes(genre) ? "bg-indigo-600 text-white shadow-xl shadow-indigo-600/40 border-indigo-500 scale-105" : "bg-white/5 text-gray-500 hover:bg-white/10 hover:text-gray-200 border-white/5"}`}>{genre}</button>
            ))}
          </div>
        </section>

        <div className="flex items-end justify-between mb-10 px-4">
          <div className="space-y-2">
            <div className="flex items-center gap-3 text-indigo-500 text-[10px] font-black uppercase tracking-[0.4em]"><Layers className="w-4 h-4" />Real-Time Feed</div>
            <div className="flex items-center gap-4">
              <h2 className="text-4xl font-black text-white tracking-tighter">
                {searchQuery ? `"${searchQuery}"` : selectedGenres.length > 0 ? "Curated Matrix" : "Top Tier Content"}
              </h2>
              {!isLoading && !fetchError && (
                <span className="bg-white/5 border border-white/10 px-3 py-1 rounded-full text-[10px] font-bold text-gray-400 uppercase tracking-widest">{animeList.length} Units Found</span>
              )}
            </div>
            {fallbackMode === "discovery" && (
              <div className="flex items-center gap-3 mt-4 py-2 px-5 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl w-fit">
                <Lightbulb className="w-4 h-4 text-indigo-400" />
                <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Discovery Pipeline: Prioritizing Combo Matches</span>
              </div>
            )}
          </div>
          {!isLoading && (
            <button onClick={fetchAnime} className="flex items-center gap-2 px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-[10px] font-black text-gray-400 hover:text-white transition-all uppercase tracking-widest">
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
          )}
        </div>

        {isLoading && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-8 animate-pulse">
            {[...Array(12)].map((_, i) => <div key={i} className="aspect-[2/3] bg-white/5 rounded-[2rem] border border-white/5" />)}
          </div>
        )}

        {!isLoading && fetchError && (
          <div className="text-center py-24 bg-red-950/10 rounded-[3rem] border border-dashed border-red-500/20 mx-4">
            <div className="bg-gray-900 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 shadow-2xl">{errorIcon}</div>
            <h3 className="text-2xl font-black text-red-400/80 mb-3 tracking-tighter">{errorTitle}</h3>
            <pre className="text-xs text-gray-600 mb-8 font-mono max-w-md mx-auto whitespace-pre-wrap break-words px-6 text-left bg-black/20 py-4 rounded-2xl">{fetchError}</pre>
            <div className="flex gap-4 justify-center">
              <button onClick={fetchAnime} className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black transition-all uppercase text-xs tracking-widest active:scale-95 flex items-center gap-2">
                <RefreshCw className="w-3.5 h-3.5" /> Retry
              </button>
              <button onClick={() => { setSearchQuery(""); setSelectedGenres([]); setFallbackMode(null); }} className="px-8 py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 hover:text-white rounded-2xl font-black transition-all uppercase text-xs tracking-widest">
                Reset Filters
              </button>
            </div>
          </div>
        )}

        {!isLoading && !fetchError && animeList.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-8">
            {animeList.map((anime) => (
              <AnimeCard key={anime.mal_id} anime={anime} isPriority={priorityIds.has(anime.mal_id)} />
            ))}
          </div>
        )}

        {!isLoading && !fetchError && animeList.length === 0 && (
          <div className="text-center py-40 bg-white/5 rounded-[4rem] border border-dashed border-white/10 mx-4">
            <div className="bg-gray-900 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-8 shadow-2xl"><Info className="w-10 h-10 text-gray-700" /></div>
            <h3 className="text-3xl font-black text-gray-400 mb-3 tracking-tighter">No Results Found</h3>
            <button onClick={() => { setSearchQuery(""); setSelectedGenres([]); setFallbackMode(null); }} className="px-10 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black transition-all uppercase text-xs tracking-widest active:scale-95">Reset Filters</button>
          </div>
        )}
      </main>

      {aiOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-xl bg-gray-950 h-full flex flex-col shadow-2xl border-l border-white/5">
            <div className="p-8 border-b border-white/5 flex items-center justify-between bg-white/5 backdrop-blur-xl">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-indigo-600 rounded-2xl shadow-xl shadow-indigo-600/20"><Sparkles className="w-6 h-6 text-white" /></div>
                <div>
                  <h3 className="font-black text-xl text-white uppercase tracking-tighter leading-none">AI Consultant</h3>
                  <p className="text-[10px] text-indigo-400 font-black uppercase tracking-[0.3em] mt-1">Powered by Google Gemini</p>
                </div>
              </div>
              <button onClick={() => setAiOpen(false)} className="p-3 hover:bg-white/10 rounded-2xl transition-colors group">
                <X className="w-6 h-6 text-gray-500 group-hover:text-white transition-colors" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar bg-gray-950/50">
              {chatHistory.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] px-6 py-4 rounded-[2rem] text-sm leading-relaxed shadow-2xl ${msg.role === "user" ? "bg-indigo-600 text-white rounded-tr-none" : "bg-white/5 text-gray-300 rounded-tl-none border border-white/10"}`}>
                    {msg.text.split("\n").map((line, idx) => (
                      <p key={idx} className={idx > 0 ? "mt-3" : ""}><FormattedText text={line} /></p>
                    ))}
                  </div>
                </div>
              ))}
              {isTyping && (
                <div className="flex justify-start">
                  <div className="bg-white/5 px-8 py-4 rounded-[2rem] rounded-tl-none border border-white/10 flex items-center gap-4">
                    <div className="flex gap-1">
                      <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: "-0.3s" }}></div>
                      <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: "-0.15s" }}></div>
                      <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce"></div>
                    </div>
                    <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Gemini Processing...</span>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
            <form onSubmit={handleAiSearch} className="p-8 border-t border-white/5 bg-white/5 backdrop-blur-xl">
              <div className="relative group">
                <input type="text" placeholder="Ask AI about anime..." value={aiInput} onChange={(e) => setAiInput(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-[1.5rem] py-5 pl-6 pr-16 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all text-sm font-medium placeholder:text-gray-700 group-focus-within:bg-white/10" />
                <button type="submit" disabled={isTyping} className="absolute right-3 top-1/2 -translate-y-1/2 p-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-500 transition-all active:scale-90 shadow-xl disabled:opacity-50">
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.05); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.1); }
      `}</style>
    </div>
  );
}
