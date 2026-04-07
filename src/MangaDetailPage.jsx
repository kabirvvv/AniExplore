import React, { useState, useEffect, useRef } from "react";
import {
  ArrowLeft, BookOpen, Star, Users, Clock, BookMarked,
  Globe, ChevronDown, ChevronUp, Loader2, AlertTriangle,
  Heart, TrendingUp, Calendar, Layers, Play,
} from "lucide-react";
import MangaReader from "./MangaReader";

const STATUS_COLOR = {
  FINISHED:   "bg-green-500/20 text-green-400 border-green-500/30",
  RELEASING:  "bg-blue-500/20 text-blue-400 border-blue-500/30",
  CANCELLED:  "bg-red-500/20 text-red-400 border-red-500/30",
  HIATUS:     "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  NOT_YET_RELEASED: "bg-gray-500/20 text-gray-400 border-gray-500/30",
};

const FORMAT_LABEL = {
  MANGA: "Manga", ONE_SHOT: "One Shot", NOVEL: "Novel",
  MANHWA: "Manhwa", MANHUA: "Manhua", DOUJINSHI: "Doujinshi",
};

function StatPill({ icon: Icon, label, value }) {
  if (!value && value !== 0) return null;
  return (
    <div className="flex flex-col items-center gap-1 px-4 py-3 bg-white/5 rounded-2xl border border-white/5 min-w-[72px]">
      <Icon className="w-4 h-4 text-indigo-400" />
      <span className="text-white font-black text-sm leading-none">{value}</span>
      <span className="text-gray-500 text-[9px] uppercase tracking-widest font-bold">{label}</span>
    </div>
  );
}

function CharacterCard({ character }) {
  return (
    <div className="flex flex-col items-center gap-2 group">
      <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden bg-gray-800 border border-white/5 flex-shrink-0">
        {character.image ? (
          <img
            src={character.image}
            alt={character.name}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-600">
            <Users className="w-6 h-6" />
          </div>
        )}
      </div>
      <div className="text-center">
        <p className="text-white text-[10px] sm:text-xs font-bold line-clamp-2 leading-tight">
          {character.name}
        </p>
        <p className="text-indigo-400 text-[9px] uppercase tracking-wider font-bold mt-0.5">
          {character.role === "MAIN" ? "Main" : "Supporting"}
        </p>
      </div>
    </div>
  );
}

function StaffCard({ staff }) {
  return (
    <div className="flex items-center gap-3 p-3 bg-white/5 rounded-2xl border border-white/5 hover:bg-white/8 transition">
      <div className="w-12 h-12 rounded-xl overflow-hidden bg-gray-800 flex-shrink-0">
        {staff.image ? (
          <img src={staff.image} alt={staff.name} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-600">
            <Users className="w-5 h-5" />
          </div>
        )}
      </div>
      <div className="min-w-0">
        <p className="text-white text-xs font-bold truncate">{staff.name}</p>
        <p className="text-indigo-400 text-[10px] font-bold uppercase tracking-wider truncate">{staff.role}</p>
      </div>
    </div>
  );
}

function MiniCard({ item, onClick }) {
  return (
    <div
      onClick={() => onClick && onClick(item)}
      className={`flex-shrink-0 w-28 sm:w-32 ${onClick ? "cursor-pointer" : ""} group`}
    >
      <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-gray-800 border border-white/5 mb-2">
        {item.cover ? (
          <img
            src={item.cover}
            alt={item.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-600">
            <BookOpen className="w-6 h-6" />
          </div>
        )}
        {item.score && (
          <div className="absolute top-1.5 right-1.5 bg-black/70 backdrop-blur px-1.5 py-0.5 rounded-lg flex items-center gap-1">
            <Star className="w-2.5 h-2.5 text-yellow-400 fill-yellow-400" />
            <span className="text-white text-[9px] font-bold">{item.score}</span>
          </div>
        )}
      </div>
      <p className="text-gray-300 text-[10px] font-bold line-clamp-2 leading-tight">{item.title}</p>
      {item.relation_type && (
        <p className="text-indigo-400 text-[9px] uppercase tracking-wider font-bold mt-0.5">
          {item.relation_type.replace(/_/g, " ")}
        </p>
      )}
    </div>
  );
}

export default function MangaDetailPage({ manga: initialManga, onBack, onSelectManga }) {
  const [detail, setDetail]         = useState(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [synopsisExpanded, setSynopsisExpanded] = useState(false);
  const [reading, setReading]       = useState(false);
  const [activeTab, setActiveTab]   = useState("about"); // about | characters | staff | related
  const scrollRef = useRef(null);

  useEffect(() => {
    loadDetail();
    scrollRef.current?.scrollTo(0, 0);
    window.scrollTo(0, 0);
  }, [initialManga.anilist_id]);

  const loadDetail = async () => {
    setLoading(true);
    setError(null);
    try {
      const res  = await fetch(`/api/manga-detail?id=${initialManga.anilist_id}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load");
      setDetail(json.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const manga = detail || initialManga;
  const synopsis = manga.synopsis?.replace(/<[^>]+>/g, "").replace(/\n\n+/g, "\n\n").trim() || "";
  const shortSynopsis = synopsis.length > 300 ? synopsis.slice(0, 300) + "…" : synopsis;
  const statusClass = STATUS_COLOR[manga.status] || STATUS_COLOR.HIATUS;

  if (reading) {
    return <MangaReader anime={manga} onClose={() => setReading(false)} />;
  }

  return (
    <div className="fixed inset-0 z-40 bg-gray-950 overflow-y-auto" ref={scrollRef}>

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <div className="relative w-full">
        {/* Banner */}
        <div className="absolute inset-0 h-64 sm:h-80 overflow-hidden">
          {manga.banner_image ? (
            <img
              src={manga.banner_image}
              alt=""
              className="w-full h-full object-cover"
            />
          ) : (
            <div
              className="w-full h-full"
              style={{
                background: `linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #1e1b4b 100%)`,
              }}
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-gray-950/60 to-gray-950" />
        </div>

        {/* Back button */}
        <div className="relative z-10 px-4 sm:px-6 pt-4 sm:pt-6">
          <button
            onClick={onBack}
            className="flex items-center gap-2 px-4 py-2 bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl text-gray-300 hover:text-white transition text-sm font-bold"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
        </div>

        {/* Cover + Title */}
        <div className="relative z-10 px-4 sm:px-6 pt-4 pb-0 flex gap-4 sm:gap-6 items-end" style={{ marginTop: "100px" }}>
          {/* Cover */}
          <div className="flex-shrink-0 w-28 sm:w-36 md:w-44 aspect-[2/3] rounded-2xl overflow-hidden shadow-2xl border border-white/10">
            <img
              src={manga.cover?.extraLarge || manga.images?.webp?.large_image_url}
              alt={manga.title}
              className="w-full h-full object-cover"
            />
          </div>

          {/* Title + badges */}
          <div className="flex-1 min-w-0 pb-2">
            {manga.title_japanese && (
              <p className="text-gray-500 text-xs font-bold mb-1 truncate">{manga.title_japanese}</p>
            )}
            <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-white tracking-tight leading-tight line-clamp-3">
              {manga.title}
            </h1>
            {manga.title_romaji && manga.title_romaji !== manga.title && (
              <p className="text-gray-400 text-xs mt-1 truncate">{manga.title_romaji}</p>
            )}

            <div className="flex flex-wrap gap-2 mt-3">
              <span className={`px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider border ${statusClass}`}>
                {manga.status?.replace(/_/g, " ")}
              </span>
              {manga.format && (
                <span className="px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider bg-white/5 text-gray-400 border border-white/10">
                  {FORMAT_LABEL[manga.format] || manga.format}
                </span>
              )}
              {manga.country && (
                <span className="px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider bg-white/5 text-gray-400 border border-white/10 flex items-center gap-1">
                  <Globe className="w-2.5 h-2.5" />{manga.country}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── STATS ROW ────────────────────────────────────────────────────── */}
      <div className="px-4 sm:px-6 mt-5">
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          <StatPill icon={Star}       label="Score"    value={manga.score} />
          <StatPill icon={TrendingUp} label="Popularity" value={manga.popularity?.toLocaleString()} />
          <StatPill icon={Heart}      label="Favourites" value={manga.favourites?.toLocaleString()} />
          <StatPill icon={BookMarked} label="Chapters"  value={manga.chapters ?? "?"} />
          <StatPill icon={Layers}     label="Volumes"   value={manga.volumes ?? "?"} />
          {manga.start_date && (
            <StatPill icon={Calendar} label="Published"  value={manga.start_date} />
          )}
        </div>
      </div>

      {/* ── GENRES ───────────────────────────────────────────────────────── */}
      <div className="px-4 sm:px-6 mt-4">
        <div className="flex flex-wrap gap-2">
          {manga.genres?.map((g) => (
            <span
              key={g.name || g}
              className="px-3 py-1.5 bg-indigo-600/15 border border-indigo-500/25 text-indigo-300 text-[10px] font-black uppercase tracking-wider rounded-xl"
            >
              {g.name || g}
            </span>
          ))}
        </div>
      </div>

      {/* ── START READING BUTTON ─────────────────────────────────────────── */}
      <div className="px-4 sm:px-6 mt-5">
        <button
          onClick={() => setReading(true)}
          className="w-full flex items-center justify-center gap-3 py-4 bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] text-white rounded-2xl font-black text-sm uppercase tracking-widest transition-all shadow-xl shadow-indigo-600/30"
        >
          <BookOpen className="w-5 h-5" />
          Start Reading
        </button>
      </div>

      {/* ── TABS ─────────────────────────────────────────────────────────── */}
      <div className="px-4 sm:px-6 mt-6">
        <div className="flex gap-1 bg-white/5 p-1 rounded-2xl border border-white/5">
          {["about", "characters", "staff", "related"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2.5 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-wider transition-all ${
                activeTab === tab
                  ? "bg-indigo-600 text-white shadow-lg"
                  : "text-gray-500 hover:text-gray-300"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* ── TAB CONTENT ──────────────────────────────────────────────────── */}
      <div className="px-4 sm:px-6 mt-6 pb-16">

        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <AlertTriangle className="w-10 h-10 text-red-500/50" />
            <p className="text-red-400 text-sm">{error}</p>
            <button onClick={loadDetail} className="px-6 py-2 bg-indigo-600 rounded-xl text-white text-xs font-bold uppercase tracking-wider">
              Retry
            </button>
          </div>
        )}

        {!loading && !error && (
          <>
            {/* ABOUT */}
            {activeTab === "about" && (
              <div className="space-y-6">
                {/* Synopsis */}
                {synopsis && (
                  <div>
                    <h3 className="text-xs font-black text-indigo-400 uppercase tracking-widest mb-3">Synopsis</h3>
                    <p className="text-gray-300 text-sm leading-relaxed">
                      {synopsisExpanded ? synopsis : shortSynopsis}
                    </p>
                    {synopsis.length > 300 && (
                      <button
                        onClick={() => setSynopsisExpanded(!synopsisExpanded)}
                        className="flex items-center gap-1 mt-2 text-indigo-400 text-xs font-bold hover:text-indigo-300 transition"
                      >
                        {synopsisExpanded ? (
                          <><ChevronUp className="w-3.5 h-3.5" /> Show less</>
                        ) : (
                          <><ChevronDown className="w-3.5 h-3.5" /> Read more</>
                        )}
                      </button>
                    )}
                  </div>
                )}

                {/* Info grid */}
                <div>
                  <h3 className="text-xs font-black text-indigo-400 uppercase tracking-widest mb-3">Details</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: "Format",    value: FORMAT_LABEL[manga.format] || manga.format },
                      { label: "Status",    value: manga.status?.replace(/_/g, " ") },
                      { label: "Chapters",  value: manga.chapters ?? "Unknown" },
                      { label: "Volumes",   value: manga.volumes  ?? "Unknown" },
                      { label: "Published", value: manga.start_date },
                      { label: "Finished",  value: manga.end_date  || (manga.status === "RELEASING" ? "Ongoing" : null) },
                      { label: "Source",    value: manga.source?.replace(/_/g, " ") },
                      { label: "Country",   value: manga.country },
                    ].filter((i) => i.value).map((item) => (
                      <div key={item.label} className="p-3 bg-white/5 rounded-xl border border-white/5">
                        <p className="text-gray-500 text-[9px] uppercase tracking-widest font-bold">{item.label}</p>
                        <p className="text-white text-xs font-bold mt-0.5">{item.value}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Tags */}
                {manga.tags?.length > 0 && (
                  <div>
                    <h3 className="text-xs font-black text-indigo-400 uppercase tracking-widest mb-3">Tags</h3>
                    <div className="flex flex-wrap gap-2">
                      {manga.tags.map((t) => (
                        <span
                          key={t.name}
                          className="px-3 py-1 bg-white/5 border border-white/8 text-gray-400 text-[10px] font-bold rounded-xl"
                        >
                          {t.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* CHARACTERS */}
            {activeTab === "characters" && (
              <div>
                {manga.characters?.length > 0 ? (
                  <>
                    {/* Main characters */}
                    {manga.characters.filter((c) => c.role === "MAIN").length > 0 && (
                      <div className="mb-6">
                        <h3 className="text-xs font-black text-indigo-400 uppercase tracking-widest mb-4">Main Characters</h3>
                        <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-3 sm:gap-4">
                          {manga.characters.filter((c) => c.role === "MAIN").map((c) => (
                            <CharacterCard key={c.id} character={c} />
                          ))}
                        </div>
                      </div>
                    )}
                    {/* Supporting */}
                    {manga.characters.filter((c) => c.role !== "MAIN").length > 0 && (
                      <div>
                        <h3 className="text-xs font-black text-indigo-400 uppercase tracking-widest mb-4">Supporting</h3>
                        <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-3 sm:gap-4">
                          {manga.characters.filter((c) => c.role !== "MAIN").map((c) => (
                            <CharacterCard key={c.id} character={c} />
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-16 text-gray-600">No character data available.</div>
                )}
              </div>
            )}

            {/* STAFF */}
            {activeTab === "staff" && (
              <div>
                {manga.staff?.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {manga.staff.map((s) => (
                      <StaffCard key={`${s.id}-${s.role}`} staff={s} />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-16 text-gray-600">No staff data available.</div>
                )}
              </div>
            )}

            {/* RELATED */}
            {activeTab === "related" && (
              <div className="space-y-8">
                {manga.relations?.length > 0 && (
                  <div>
                    <h3 className="text-xs font-black text-indigo-400 uppercase tracking-widest mb-4">Related</h3>
                    <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
                      {manga.relations.map((r) => (
                        <MiniCard
                          key={r.id}
                          item={r}
                          onClick={onSelectManga ? () => onSelectManga({ anilist_id: r.id, ...r }) : null}
                        />
                      ))}
                    </div>
                  </div>
                )}
                {manga.recommendations?.length > 0 && (
                  <div>
                    <h3 className="text-xs font-black text-indigo-400 uppercase tracking-widest mb-4">You May Also Like</h3>
                    <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
                      {manga.recommendations.map((r) => (
                        <MiniCard
                          key={r.id}
                          item={r}
                          onClick={onSelectManga ? () => onSelectManga({ anilist_id: r.id, ...r }) : null}
                        />
                      ))}
                    </div>
                  </div>
                )}
                {!manga.relations?.length && !manga.recommendations?.length && (
                  <div className="text-center py-16 text-gray-600">No related titles found.</div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      <style>{`
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}
