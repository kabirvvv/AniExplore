// AnimeStreamPage.jsx — fully rewritten
// Fixes applied:
//   BUG #1  Always sends title + anipubId so companion series is found
//   BUG #2  Removed URL-sniffing getAudioType(); trust API's audioType field
//   BUG #3  Fixed episodes_count → episodes field
//   BUG #8  useEffect keyed on stable id/title string, not object reference
// UI:
//   Mobile  — stacked layout, bottom-sheet episode drawer, touch-friendly
//   Desktop — side-by-side player + episode list
//   TV      — large controls, focus-ring nav, keyboard arrow key support

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  ArrowLeft, Star, Tv, Layers, Loader2, AlertTriangle, RefreshCw,
  Play, Volume2, VolumeX, ChevronLeft, ChevronRight, Clock, Calendar,
  Film, List, X, ChevronDown, ChevronUp,
} from "lucide-react";

// ── Constants ─────────────────────────────────────────────────────────────────

const ANIPUB = "https://anipub.xyz";
const fixImage = (p) =>
  !p ? "" : p.startsWith("https://") ? p : `${ANIPUB}/${p}`;

// ── Data fetching ─────────────────────────────────────────────────────────────

// FIX #1: Always sends BOTH anipubId AND title so the API can find the
// companion series (e.g. the dub when the primary ID is the sub, or vice versa).
async function fetchAllEps(anime) {
  const params = new URLSearchParams();

  // Always include anipubId when available
  if (anime.anipub_id) params.set("anipubId", String(anime.anipub_id));

  // ALWAYS include title — this is what finds the companion series
  const titleStr = anime.title_english || anime.title || "";
  if (titleStr) params.set("title", titleStr);
  if (anime.title_romaji) params.set("titleRomaji", anime.title_romaji);

  const res  = await fetch(`/api/anime-episodes?${params}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Server error (${res.status})`);

  // FIX #2: Trust the API's explicit audioType field; no URL sniffing needed
  return (data.episodes || [])
    .map((e) => ({
      ep:   e.number,
      src:  e.src,
      type: e.audioType, // "sub" | "dub" — always set by the fixed API
    }))
    .filter((e) => e.type === "sub" || e.type === "dub");
}

// ── Genre colour map ──────────────────────────────────────────────────────────

const GENRE_STYLES = {
  Action:       { bg: "rgba(239,68,68,0.12)",  border: "rgba(239,68,68,0.35)",  text: "#fca5a5" },
  Adventure:    { bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.35)", text: "#fcd34d" },
  Comedy:       { bg: "rgba(234,179,8,0.12)",  border: "rgba(234,179,8,0.35)",  text: "#fde047" },
  Drama:        { bg: "rgba(168,85,247,0.12)", border: "rgba(168,85,247,0.35)", text: "#d8b4fe" },
  Fantasy:      { bg: "rgba(99,102,241,0.12)", border: "rgba(99,102,241,0.35)", text: "#a5b4fc" },
  Horror:       { bg: "rgba(220,38,38,0.12)",  border: "rgba(220,38,38,0.35)",  text: "#fca5a5" },
  Mystery:      { bg: "rgba(15,118,110,0.12)", border: "rgba(15,118,110,0.35)", text: "#5eead4" },
  Romance:      { bg: "rgba(236,72,153,0.12)", border: "rgba(236,72,153,0.35)", text: "#f9a8d4" },
  "Sci-Fi":     { bg: "rgba(6,182,212,0.12)",  border: "rgba(6,182,212,0.35)",  text: "#67e8f9" },
  "Slice of Life":{ bg:"rgba(52,211,153,0.12)",border:"rgba(52,211,153,0.35)", text:"#6ee7b7" },
  Sports:       { bg: "rgba(249,115,22,0.12)", border: "rgba(249,115,22,0.35)", text: "#fdba74" },
  Supernatural: { bg: "rgba(139,92,246,0.12)", border: "rgba(139,92,246,0.35)", text: "#c4b5fd" },
  Thriller:     { bg: "rgba(239,68,68,0.12)",  border: "rgba(239,68,68,0.35)",  text: "#fca5a5" },
  Mecha:        { bg: "rgba(100,116,139,0.12)",border: "rgba(100,116,139,0.35)",text: "#cbd5e1" },
  Psychological:{ bg: "rgba(124,58,237,0.12)", border: "rgba(124,58,237,0.35)", text: "#c4b5fd" },
  DEFAULT:      { bg: "rgba(99,102,241,0.12)", border: "rgba(99,102,241,0.35)", text: "#a5b4fc" },
};

// ── Sub-components ────────────────────────────────────────────────────────────

function GenreTag({ name }) {
  const s = GENRE_STYLES[name] || GENRE_STYLES.DEFAULT;
  return (
    <span style={{
      background: s.bg, border: `1px solid ${s.border}`, color: s.text,
      display: "inline-flex", alignItems: "center",
      padding: "3px 9px", borderRadius: 999,
      fontSize: 10, fontWeight: 800,
      letterSpacing: "0.06em", textTransform: "uppercase",
      flexShrink: 0,
    }}>
      {name}
    </span>
  );
}

function ScoreRing({ score }) {
  const pct   = Math.min((parseFloat(score) / 10) * 100, 100);
  const r = 18, c = 2 * Math.PI * r;
  const dash  = (pct / 100) * c;
  const color = pct >= 75 ? "#4ade80" : pct >= 50 ? "#facc15" : "#f87171";
  return (
    <div style={{ position: "relative", width: 46, height: 46, flexShrink: 0 }}>
      <svg width={46} height={46} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={23} cy={23} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={3}/>
        <circle cx={23} cy={23} r={r} fill="none" stroke={color} strokeWidth={3}
          strokeDasharray={`${dash} ${c}`} strokeLinecap="round"/>
      </svg>
      <div style={{ position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center" }}>
        <span style={{ fontSize: 12, fontWeight: 900, color, lineHeight: 1 }}>{score}</span>
        <span style={{ fontSize: 6, color: "rgba(255,255,255,0.4)", fontWeight: 700, marginTop: 1, letterSpacing: "0.05em" }}>SCORE</span>
      </div>
    </div>
  );
}

function StatPill({ icon: Icon, label, value }) {
  if (!value) return null;
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 5, padding: "4px 10px",
      background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 999, flexShrink: 0,
    }}>
      <Icon size={10} color="rgba(255,255,255,0.4)"/>
      <span style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.07em" }}>
        {label}
      </span>
      <span style={{ fontSize: 10, fontWeight: 800, color: "rgba(255,255,255,0.85)" }}>{value}</span>
    </div>
  );
}

// Audio toggle — used in both mobile and desktop layouts
function AudioToggle({ audioType, setAudioType, subCount, dubCount, loading }) {
  if (loading) return null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
      <span style={{ fontSize: 9, fontWeight: 900, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.14em" }}>
        Audio
      </span>
      <div style={{
        display: "flex",
        background: "rgba(255,255,255,0.05)",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 10, overflow: "hidden",
      }}>
        {[
          { t: "sub", count: subCount, Icon: Volume2,  label: "SUB" },
          { t: "dub", count: dubCount, Icon: VolumeX,  label: "DUB" },
        ].map(({ t, count, Icon, label }) => (
          <button
            key={t}
            onClick={() => count > 0 && setAudioType(t)}
            disabled={count === 0}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "8px 20px",
              background: audioType === t ? "#6366f1" : "transparent",
              border: "none", cursor: count === 0 ? "not-allowed" : "pointer",
              fontFamily: "inherit", fontSize: 11, fontWeight: 900,
              letterSpacing: "0.08em", textTransform: "uppercase",
              color: audioType === t ? "#fff" : count === 0 ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.5)",
              transition: "all 0.18s",
              minHeight: 44, // touch target
            }}
          >
            <Icon size={12}/>
            {label}
            {count > 0 && (
              <span style={{ fontSize: 9, color: audioType === t ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.28)", marginLeft: 1 }}>
                {count}
              </span>
            )}
          </button>
        ))}
      </div>
      {!loading && subCount === 0 && (
        <span style={{ fontSize: 10, fontWeight: 700, color: "#fbbf24" }}>⚠ Sub unavailable</span>
      )}
      {!loading && dubCount === 0 && (
        <span style={{ fontSize: 10, fontWeight: 700, color: "#fbbf24" }}>⚠ Dub unavailable</span>
      )}
    </div>
  );
}

// Single episode row button
function EpButton({ ep, active, onClick }) {
  return (
    <button
      data-active={active}
      onClick={onClick}
      style={{
        width: "100%", display: "flex", alignItems: "center", gap: 12,
        padding: "12px 16px",
        background: active ? "rgba(99,102,241,0.18)" : "transparent",
        borderLeft: active ? "2px solid #818cf8" : "2px solid transparent",
        borderTop: "none", borderRight: "none",
        borderBottom: "1px solid rgba(255,255,255,0.04)",
        cursor: "pointer", transition: "all 0.15s ease", textAlign: "left",
        minHeight: 52, // comfortable touch target
      }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.background = active ? "rgba(99,102,241,0.18)" : "transparent"; }}
    >
      <div style={{
        width: 34, height: 34, borderRadius: 8, flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: active ? "#6366f1" : "rgba(255,255,255,0.08)",
        fontSize: 11, fontWeight: 900,
        color: active ? "#fff" : "rgba(255,255,255,0.5)",
      }}>
        {ep}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: active ? "#fff" : "rgba(255,255,255,0.65)", margin: 0 }}>
          Episode {ep}
        </p>
        {active && (
          <p style={{ fontSize: 9, fontWeight: 800, color: "#818cf8", textTransform: "uppercase", letterSpacing: "0.08em", margin: 0 }}>
            ▶ Now Playing
          </p>
        )}
      </div>
      {active && (
        <div style={{
          width: 6, height: 6, borderRadius: "50%", background: "#818cf8",
          flexShrink: 0, boxShadow: "0 0 6px #818cf8", animation: "blink 2s infinite",
        }}/>
      )}
    </button>
  );
}

// Episode list panel — used in both drawer and sidebar
function EpList({ filteredEps, currentEp, setCurrentEp, audioType, loading, epListRef }) {
  return (
    <div ref={epListRef} className="ep-scroll" style={{ overflowY: "auto", flex: 1, minHeight: 0 }}>
      {loading && (
        <div style={{ padding: "40px 0", display: "flex", justifyContent: "center" }}>
          <div style={{ width: 22, height: 22, borderRadius: "50%", border: "2px solid rgba(99,102,241,0.2)", borderTop: "2px solid #6366f1", animation: "spin 0.85s linear infinite" }}/>
        </div>
      )}
      {!loading && filteredEps.map(({ ep }) => (
        <EpButton key={ep} ep={ep} active={ep === currentEp} onClick={() => setCurrentEp(ep)}/>
      ))}
      {!loading && filteredEps.length === 0 && (
        <div style={{ padding: "32px 16px", textAlign: "center" }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.3)", margin: "0 0 8px" }}>
            No {audioType} episodes available.
          </p>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// Main component
// ════════════════════════════════════════════════════════════════════════════════

export default function AnimeStreamPage({ anime, onBack }) {
  const [audioType,   setAudioType]   = useState("sub");
  const [allEps,      setAllEps]      = useState([]);
  const [currentEp,   setCurrentEp]   = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(null);
  const [expanded,    setExpanded]    = useState(false);
  const [retryKey,    setRetryKey]    = useState(0);
  const [drawerOpen,  setDrawerOpen]  = useState(false); // mobile episode drawer
  const [infoOpen,    setInfoOpen]    = useState(false); // mobile info drawer
  const [isMobile,    setIsMobile]    = useState(false);
  const [isTV,        setIsTV]        = useState(false);
  const epListRef  = useRef(null);
  const playerRef  = useRef(null);
  const drawerRef  = useRef(null);

  // Inject fonts once
  useEffect(() => {
    if (!document.getElementById("anime-gf")) {
      const l = document.createElement("link");
      l.id = "anime-gf"; l.rel = "stylesheet";
      l.href = "https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:ital,wght@0,400;0,500;0,600;0,700;0,800;0,900;1,400&display=swap";
      document.head.appendChild(l);
    }
  }, []);

  // Responsive breakpoints
  useEffect(() => {
    const check = () => {
      setIsMobile(window.innerWidth < 768);
      setIsTV(window.innerWidth >= 1920);
    };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // TV keyboard navigation
  useEffect(() => {
    if (!isTV) return;
    const handler = (e) => {
      if (e.key === "ArrowLeft"  && prevEp != null) setCurrentEp(prevEp);
      if (e.key === "ArrowRight" && nextEp != null) setCurrentEp(nextEp);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  // FIX #8: Stable dependency — key on id or title string, not the object reference
  const animeKey = anime?.anipub_id ? String(anime.anipub_id) : (anime?.title || "");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true); setError(null); setAllEps([]); setCurrentEp(null);
      try {
        const episodes = await fetchAllEps(anime);
        if (!episodes.length) throw new Error("No episodes found on AniPub.");
        const subEps = episodes.filter((e) => e.type === "sub");
        const dubEps = episodes.filter((e) => e.type === "dub");
        const defaultType = subEps.length > 0 ? "sub" : "dub";
        if (!cancelled) {
          setAllEps(episodes);
          setAudioType(defaultType);
          setCurrentEp((subEps.length > 0 ? subEps : dubEps)[0]?.ep ?? 1);
          setLoading(false);
        }
      } catch (e) {
        if (!cancelled) { setError(e.message); setLoading(false); }
      }
    }
    load();
    return () => { cancelled = true; };
  // FIX #8: Use stable string key instead of anime object
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animeKey, retryKey]);

  const filteredEps  = allEps.filter((e) => e.type === audioType);
  const subCount     = allEps.filter((e) => e.type === "sub").length;
  const dubCount     = allEps.filter((e) => e.type === "dub").length;
  const totalEps     = filteredEps.length;
  const currentSrc   = filteredEps.find((e) => e.ep === currentEp)?.src || "";
  const currentIdx   = filteredEps.findIndex((e) => e.ep === currentEp);
  const prevEp       = currentIdx > 0 ? filteredEps[currentIdx - 1]?.ep : null;
  const nextEp       = currentIdx < filteredEps.length - 1 ? filteredEps[currentIdx + 1]?.ep : null;

  // Reset to first episode of new audio type when toggling
  useEffect(() => {
    const first = filteredEps[0]?.ep;
    if (first != null) setCurrentEp(first);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioType]);

  // Auto-scroll active episode into view
  useEffect(() => {
    if (!epListRef.current) return;
    epListRef.current.querySelector("[data-active='true']")?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [currentEp, audioType]);

  // Lock body scroll when drawer open on mobile
  useEffect(() => {
    document.body.style.overflow = (drawerOpen || infoOpen) ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [drawerOpen, infoOpen]);

  const coverImg =
    anime.images?.webp?.large_image_url ||
    anime.images?.jpg?.large_image_url  ||
    fixImage(anime.ImagePath);

  const synopsis = (anime.synopsis || "").replace(/<[^>]+>/g, "");

  // FIX #3: Field is anime.episodes not anime.episodes_count
  const epCount = anime.episodes_count ?? anime.episodes;

  const tvScale = isTV ? 1.35 : 1;

  // ── CSS ──────────────────────────────────────────────────────────────────────
  const css = `
    @keyframes spin    { to { transform: rotate(360deg) } }
    @keyframes blink   { 0%,100%{opacity:1} 50%{opacity:.3} }
    @keyframes fadeUp  { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
    @keyframes slideUp { from{transform:translateY(100%)} to{transform:translateY(0)} }
    @keyframes backdropIn { from{opacity:0} to{opacity:1} }
    .ep-scroll::-webkit-scrollbar { width: 3px }
    .ep-scroll::-webkit-scrollbar-thumb { background: rgba(99,102,241,.35); border-radius:4px }
    .ep-scroll { -webkit-overflow-scrolling: touch; }
    .drawer { animation: slideUp 0.32s cubic-bezier(0.32,0.72,0,1) }
    .backdrop { animation: backdropIn 0.25s ease }
    .anime-btn:focus-visible { outline: 2px solid #818cf8; outline-offset: 2px; }
    @media (hover: hover) {
      .ep-row:hover { background: rgba(255,255,255,0.05) !important; }
    }
  `;

  // ── Shared player block ───────────────────────────────────────────────────────
  const playerBlock = (
    <div ref={playerRef} style={{
      position: "relative", background: "#000",
      borderRadius: isMobile ? 0 : 14,
      overflow: "hidden", aspectRatio: "16/9",
      border: isMobile ? "none" : "1px solid rgba(255,255,255,0.07)",
      boxShadow: isMobile ? "none" : "0 20px 60px rgba(0,0,0,0.6)",
      width: "100%",
    }}>
      {/* Loading */}
      {loading && (
        <div style={{ position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:14,background:"#000" }}>
          <div style={{ width:44,height:44,borderRadius:"50%",border:"3px solid rgba(99,102,241,0.15)",borderTop:"3px solid #6366f1",animation:"spin 0.85s linear infinite" }}/>
          <p style={{ fontSize:10,fontWeight:800,color:"rgba(255,255,255,0.3)",textTransform:"uppercase",letterSpacing:"0.15em",margin:0 }}>
            Loading stream…
          </p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{ position:"absolute",inset:0,background:"rgba(0,0,0,0.92)",display:"flex",alignItems:"center",justifyContent:"center" }}>
          <div style={{ textAlign:"center",padding:"0 32px" }}>
            <AlertTriangle size={34} color="#f87171" style={{ display:"block",margin:"0 auto 12px" }}/>
            <p style={{ fontSize:14,fontWeight:700,color:"#f87171",margin:"0 0 6px" }}>Stream Error</p>
            <p style={{ fontSize:12,color:"rgba(255,255,255,0.45)",margin:"0 0 22px",maxWidth:280 }}>{error}</p>
            <button
              className="anime-btn"
              onClick={() => setRetryKey((k) => k + 1)}
              style={{ display:"inline-flex",alignItems:"center",gap:8,padding:"10px 22px",background:"#6366f1",border:"none",borderRadius:10,cursor:"pointer",fontSize:11,fontWeight:900,color:"#fff",fontFamily:"inherit",letterSpacing:"0.08em",textTransform:"uppercase",minHeight:44 }}
            >
              <RefreshCw size={13}/> Retry
            </button>
          </div>
        </div>
      )}

      {/* Player iframe */}
      {!loading && !error && currentSrc && (
        <iframe
          key={currentSrc}
          src={currentSrc}
          style={{ width:"100%",height:"100%",border:0,display:"block" }}
          allowFullScreen
          allow="autoplay; fullscreen; encrypted-media"
          sandbox="allow-scripts allow-same-origin allow-presentation allow-fullscreen"
          scrolling="no"
          title={`Episode ${currentEp}`}
        />
      )}
    </div>
  );

  // ── Prev / Next bar ───────────────────────────────────────────────────────────
  const navBar = !loading && !error && (
    <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginTop:10,gap:8 }}>
      <button
        className="anime-btn"
        onClick={() => prevEp != null && setCurrentEp(prevEp)}
        disabled={prevEp == null}
        style={{ display:"flex",alignItems:"center",gap:6,padding:"9px 16px",borderRadius:10,background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",cursor:prevEp==null?"not-allowed":"pointer",opacity:prevEp==null?0.3:1,fontSize:11,fontWeight:800,color:"rgba(255,255,255,0.75)",fontFamily:"inherit",minHeight:44,flex:1 }}
      >
        <ChevronLeft size={14}/> Prev
      </button>
      <span style={{ fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.28)",whiteSpace:"nowrap",padding:"0 4px",textAlign:"center" }}>
        {currentEp != null && `EP ${currentEp} · ${audioType.toUpperCase()}`}
      </span>
      <button
        className="anime-btn"
        onClick={() => nextEp != null && setCurrentEp(nextEp)}
        disabled={nextEp == null}
        style={{ display:"flex",alignItems:"center",justifyContent:"flex-end",gap:6,padding:"9px 16px",borderRadius:10,background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",cursor:nextEp==null?"not-allowed":"pointer",opacity:nextEp==null?0.3:1,fontSize:11,fontWeight:800,color:"rgba(255,255,255,0.75)",fontFamily:"inherit",minHeight:44,flex:1 }}
      >
        Next <ChevronRight size={14}/>
      </button>
    </div>
  );

  // ── Info card (synopsis, genres, stats) ───────────────────────────────────────
  const infoCard = (
    <div style={{ background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:16,overflow:"hidden" }}>
      {/* Banner */}
      {coverImg && (
        <div style={{ height:70,position:"relative",overflow:"hidden" }}>
          <img src={coverImg} alt="" style={{ width:"100%",height:"100%",objectFit:"cover",filter:"blur(18px) brightness(0.3) saturate(2)",transform:"scale(1.1)" }}/>
          <div style={{ position:"absolute",inset:0,background:"linear-gradient(to bottom, transparent 0%, rgba(8,11,20,0.97) 100%)" }}/>
        </div>
      )}
      <div style={{ padding:`${coverImg?"0":"20px"} 18px 20px`,marginTop:coverImg?-32:0 }}>
        <div style={{ display:"flex",gap:14,alignItems:"flex-start" }}>
          {coverImg && (
            <img src={coverImg} alt={anime.title} style={{ width:72,borderRadius:8,border:"2px solid rgba(255,255,255,0.1)",boxShadow:"0 6px 20px rgba(0,0,0,0.5)",flexShrink:0,objectFit:"cover",position:"relative",zIndex:1 }}/>
          )}
          <div style={{ flex:1,minWidth:0,paddingTop:coverImg?30:0 }}>
            <h2 style={{ margin:"0 0 2px",fontFamily:"'Bebas Neue',sans-serif",fontSize:Math.round(22*tvScale),letterSpacing:"0.04em",color:"#fff",lineHeight:1 }}>
              {anime.title}
            </h2>
            {anime.title_romaji && anime.title_romaji !== anime.title && (
              <p style={{ margin:"0 0 10px",fontSize:11,color:"rgba(255,255,255,0.35)",fontWeight:600 }}>
                {anime.title_romaji}
              </p>
            )}
            <div style={{ display:"flex",flexWrap:"wrap",gap:6,alignItems:"center",marginBottom:10 }}>
              {anime.score  && <ScoreRing score={anime.score}/>}
              <StatPill icon={Tv}      label="Format" value={anime.format}/>
              <StatPill icon={Layers}  label="Studio" value={anime.studio}/>
              <StatPill icon={Calendar}label="Year"   value={anime.year || anime.season_year}/>
              <StatPill icon={Clock}   label="Status" value={anime.status}/>
              {/* FIX #3 */}
              <StatPill icon={Film}    label="Eps"    value={epCount}/>
            </div>
          </div>
        </div>

        {/* Genres */}
        {anime.genres?.length > 0 && (
          <div style={{ display:"flex",flexWrap:"wrap",gap:6,marginBottom:12,marginTop:8 }}>
            {anime.genres.slice(0,8).map((g) => (
              <GenreTag key={g.name||g} name={g.name||g}/>
            ))}
          </div>
        )}

        {/* Synopsis */}
        {synopsis && (
          <>
            <p style={{
              fontSize:12,lineHeight:1.8,color:"rgba(255,255,255,0.5)",margin:0,
              display:"-webkit-box", WebkitBoxOrient:"vertical", overflow:"hidden",
              WebkitLineClamp: expanded ? "unset" : 3,
            }}>
              {synopsis}
            </p>
            {synopsis.length > 200 && (
              <button
                onClick={() => setExpanded(!expanded)}
                style={{ marginTop:6,background:"none",border:"none",cursor:"pointer",fontSize:11,fontWeight:800,color:"#818cf8",fontFamily:"inherit",padding:0,textTransform:"uppercase",letterSpacing:"0.06em",minHeight:32 }}
              >
                {expanded ? "Show less ↑" : "Read more ↓"}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );

  // ── Episode sidebar panel (desktop) ──────────────────────────────────────────
  const episodeSidebar = (
    <div style={{
      width: isTV ? 340 : 275,
      flexShrink: 0,
      display: "flex",
      flexDirection: "column",
      position: "sticky",
      top: 68,
      maxHeight: "calc(100vh - 88px)",
    }}>
      <div style={{ background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:16,overflow:"hidden",display:"flex",flexDirection:"column",height:"100%" }}>
        {/* Header */}
        <div style={{ padding:"14px 16px 12px",borderBottom:"1px solid rgba(255,255,255,0.06)",background:"rgba(255,255,255,0.02)",flexShrink:0 }}>
          <p style={{ margin:0,fontSize:8,fontWeight:900,color:"#818cf8",textTransform:"uppercase",letterSpacing:"0.14em" }}>
            Episodes
          </p>
          <p style={{ margin:0,fontSize:Math.round(16*tvScale),fontFamily:"'Bebas Neue',sans-serif",letterSpacing:"0.05em",color:"#fff",lineHeight:1.1 }}>
            {loading ? "…" : `${totalEps} ${audioType.toUpperCase()}`}
          </p>
        </div>
        <EpList
          filteredEps={filteredEps} currentEp={currentEp}
          setCurrentEp={setCurrentEp} audioType={audioType}
          loading={loading} epListRef={epListRef}
        />
      </div>
    </div>
  );

  // ════════════════════════════════════════════════════════════════════════════
  // MOBILE LAYOUT
  // ════════════════════════════════════════════════════════════════════════════

  if (isMobile) {
    return (
      <div style={{ minHeight:"100vh",background:"#080b14",color:"#e2e8f0",fontFamily:"'DM Sans',sans-serif",overflowX:"hidden" }}>
        <style>{css}</style>

        {/* ── Sticky header ── */}
        <header style={{ position:"sticky",top:0,zIndex:60,background:"rgba(8,11,20,0.94)",backdropFilter:"blur(16px)",borderBottom:"1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ display:"flex",alignItems:"center",gap:10,padding:"0 12px",height:52 }}>
            <button
              className="anime-btn"
              onClick={onBack}
              style={{ width:36,height:36,borderRadius:9,border:"1px solid rgba(255,255,255,0.1)",background:"rgba(255,255,255,0.06)",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",color:"rgba(255,255,255,0.7)",flexShrink:0 }}
            >
              <ArrowLeft size={16}/>
            </button>
            <div style={{ flex:1,minWidth:0 }}>
              <h1 style={{ margin:0,fontFamily:"'Bebas Neue',sans-serif",fontSize:17,letterSpacing:"0.05em",color:"#fff",lineHeight:1,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis" }}>
                {anime.title}
              </h1>
              {!loading && !error && (
                <p style={{ margin:0,fontSize:9,fontWeight:800,letterSpacing:"0.1em",textTransform:"uppercase",color:"#818cf8" }}>
                  Ep {currentEp} of {totalEps} · {audioType.toUpperCase()}
                </p>
              )}
            </div>
          </div>
        </header>

        {/* ── Player (full width, no border radius on mobile) ── */}
        {playerBlock}

        {/* ── Controls bar ── */}
        <div style={{ background:"rgba(8,11,20,0.95)",borderBottom:"1px solid rgba(255,255,255,0.06)",padding:"10px 12px",display:"flex",flexDirection:"column",gap:10 }}>
          {/* Sub/Dub toggle */}
          <AudioToggle audioType={audioType} setAudioType={setAudioType} subCount={subCount} dubCount={dubCount} loading={loading}/>

          {/* Prev/Next + Episode list trigger */}
          {!loading && !error && (
            <div style={{ display:"flex",gap:8 }}>
              <button
                className="anime-btn"
                onClick={() => prevEp != null && setCurrentEp(prevEp)}
                disabled={prevEp == null}
                style={{ flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:5,padding:"10px 0",borderRadius:10,background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",cursor:prevEp==null?"not-allowed":"pointer",opacity:prevEp==null?0.3:1,fontSize:12,fontWeight:800,color:"rgba(255,255,255,0.75)",fontFamily:"inherit",minHeight:44 }}
              >
                <ChevronLeft size={15}/> Prev
              </button>
              <button
                className="anime-btn"
                onClick={() => setDrawerOpen(true)}
                style={{ flex:2,display:"flex",alignItems:"center",justifyContent:"center",gap:6,padding:"10px 0",borderRadius:10,background:"rgba(99,102,241,0.15)",border:"1px solid rgba(99,102,241,0.3)",cursor:"pointer",fontSize:12,fontWeight:800,color:"#a5b4fc",fontFamily:"inherit",minHeight:44 }}
              >
                <List size={14}/> Episodes ({totalEps})
              </button>
              <button
                className="anime-btn"
                onClick={() => nextEp != null && setCurrentEp(nextEp)}
                disabled={nextEp == null}
                style={{ flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:5,padding:"10px 0",borderRadius:10,background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",cursor:nextEp==null?"not-allowed":"pointer",opacity:nextEp==null?0.3:1,fontSize:12,fontWeight:800,color:"rgba(255,255,255,0.75)",fontFamily:"inherit",minHeight:44 }}
              >
                Next <ChevronRight size={15}/>
              </button>
            </div>
          )}
        </div>

        {/* ── Collapsible info section ── */}
        <div style={{ padding:"0 12px" }}>
          <button
            className="anime-btn"
            onClick={() => setInfoOpen(!infoOpen)}
            style={{ width:"100%",display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 0",background:"none",border:"none",borderBottom:"1px solid rgba(255,255,255,0.06)",cursor:"pointer",color:"rgba(255,255,255,0.6)",fontFamily:"inherit",fontSize:12,fontWeight:700 }}
          >
            <span>About this anime</span>
            {infoOpen ? <ChevronUp size={15}/> : <ChevronDown size={15}/>}
          </button>
          {infoOpen && (
            <div style={{ paddingTop:14,paddingBottom:16,animation:"fadeUp 0.25s ease" }}>
              {infoCard}
            </div>
          )}
        </div>

        {/* ── Episode bottom drawer ── */}
        {drawerOpen && (
          <>
            {/* Backdrop */}
            <div
              className="backdrop"
              onClick={() => setDrawerOpen(false)}
              style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",zIndex:80,backdropFilter:"blur(4px)" }}
            />
            {/* Drawer */}
            <div
              ref={drawerRef}
              className="drawer"
              style={{ position:"fixed",bottom:0,left:0,right:0,zIndex:90,background:"#0f1220",borderTop:"1px solid rgba(255,255,255,0.1)",borderRadius:"20px 20px 0 0",maxHeight:"80vh",display:"flex",flexDirection:"column" }}
            >
              {/* Drag handle */}
              <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 16px 10px",borderBottom:"1px solid rgba(255,255,255,0.06)",flexShrink:0 }}>
                <div>
                  <p style={{ margin:0,fontSize:8,fontWeight:900,color:"#818cf8",textTransform:"uppercase",letterSpacing:"0.14em" }}>Episodes</p>
                  <p style={{ margin:0,fontSize:18,fontFamily:"'Bebas Neue',sans-serif",letterSpacing:"0.05em",color:"#fff",lineHeight:1.1 }}>
                    {totalEps} {audioType.toUpperCase()}
                  </p>
                </div>
                <button
                  className="anime-btn"
                  onClick={() => setDrawerOpen(false)}
                  style={{ width:34,height:34,borderRadius:8,border:"1px solid rgba(255,255,255,0.12)",background:"rgba(255,255,255,0.06)",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",color:"rgba(255,255,255,0.55)" }}
                >
                  <X size={15}/>
                </button>
              </div>
              <EpList
                filteredEps={filteredEps} currentEp={currentEp}
                setCurrentEp={(ep) => { setCurrentEp(ep); setDrawerOpen(false); }}
                audioType={audioType} loading={loading} epListRef={epListRef}
              />
              {/* Safe area */}
              <div style={{ height:"env(safe-area-inset-bottom,0px)",flexShrink:0 }}/>
            </div>
          </>
        )}
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // DESKTOP / TV LAYOUT
  // ════════════════════════════════════════════════════════════════════════════

  return (
    <div style={{ minHeight:"100vh",background:"#080b14",color:"#e2e8f0",fontFamily:"'DM Sans',sans-serif",overflowX:"hidden" }}>
      <style>{css}</style>

      {/* Ambient glow */}
      <div style={{ position:"fixed",top:0,left:0,right:0,height:"55vh",pointerEvents:"none",zIndex:0,background:"radial-gradient(ellipse 70% 50% at 15% -5%, rgba(99,102,241,0.1) 0%, transparent 70%)" }}/>

      {/* ── Header ── */}
      <header style={{ position:"sticky",top:0,zIndex:50,background:"rgba(8,11,20,0.88)",backdropFilter:"blur(20px)",borderBottom:"1px solid rgba(255,255,255,0.055)" }}>
        <div style={{ maxWidth:1700,margin:"0 auto",padding:`0 ${isTV?40:24}px`,height:isTV?68:56,display:"flex",alignItems:"center",gap:14 }}>
          <button
            className="anime-btn"
            onClick={onBack}
            style={{ display:"flex",alignItems:"center",gap:6,padding:"6px 14px",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:10,cursor:"pointer",fontSize:isTV?14:12,fontWeight:800,color:"rgba(255,255,255,0.55)",fontFamily:"inherit",transition:"all 0.15s",minHeight:40 }}
            onMouseEnter={e => { e.currentTarget.style.background="rgba(255,255,255,0.11)"; e.currentTarget.style.color="#fff"; }}
            onMouseLeave={e => { e.currentTarget.style.background="rgba(255,255,255,0.06)"; e.currentTarget.style.color="rgba(255,255,255,0.55)"; }}
          >
            <ArrowLeft size={isTV?16:13}/> Back
          </button>

          <div style={{ flex:1,minWidth:0 }}>
            <h1 style={{ margin:0,fontFamily:"'Bebas Neue',sans-serif",fontSize:isTV?26:19,letterSpacing:"0.05em",color:"#fff",lineHeight:1,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis" }}>
              {anime.title}
            </h1>
            {!loading && !error && (
              <p style={{ margin:0,fontSize:9,fontWeight:800,letterSpacing:"0.12em",textTransform:"uppercase",color:"#818cf8" }}>
                Ep {currentEp} / {totalEps} &nbsp;·&nbsp; {audioType.toUpperCase()}
              </p>
            )}
          </div>

          {/* Header prev/next */}
          {!loading && !error && (
            <div style={{ display:"flex",gap:6 }}>
              {[{ep:prevEp,Icon:ChevronLeft,dir:"prev"},{ep:nextEp,Icon:ChevronRight,dir:"next"}].map(({ ep, Icon, dir }) => (
                <button
                  key={dir}
                  className="anime-btn"
                  onClick={() => ep != null && setCurrentEp(ep)}
                  disabled={ep == null}
                  style={{ width:isTV?40:32,height:isTV?40:32,borderRadius:8,border:"1px solid rgba(255,255,255,0.1)",background:"rgba(255,255,255,0.05)",cursor:ep==null?"not-allowed":"pointer",display:"flex",alignItems:"center",justifyContent:"center",opacity:ep==null?0.3:1,color:"#fff",transition:"background 0.15s" }}
                  onMouseEnter={e => { if (ep != null) e.currentTarget.style.background="rgba(255,255,255,0.12)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background="rgba(255,255,255,0.05)"; }}
                >
                  <Icon size={isTV?18:14}/>
                </button>
              ))}
            </div>
          )}
        </div>
      </header>

      {/* ── Body ── */}
      <div style={{ maxWidth:1700,margin:"0 auto",padding:`${isTV?32:22}px ${isTV?40:24}px`,display:"flex",gap:isTV?28:22,alignItems:"flex-start",position:"relative",zIndex:1 }}>

        {/* Left column */}
        <div style={{ flex:1,minWidth:0,animation:"fadeUp 0.4s ease" }}>

          {/* Sub/Dub toggle */}
          <div style={{ marginBottom:12 }}>
            <AudioToggle audioType={audioType} setAudioType={setAudioType} subCount={subCount} dubCount={dubCount} loading={loading}/>
          </div>

          {/* Player */}
          {playerBlock}

          {/* Prev/Next */}
          {navBar}

          {/* TV keyboard hint */}
          {isTV && !loading && !error && (
            <p style={{ fontSize:11,color:"rgba(255,255,255,0.2)",margin:"8px 0 0",textAlign:"center",fontWeight:600 }}>
              ← → arrow keys to navigate episodes
            </p>
          )}

          {/* Info card */}
          <div style={{ marginTop:isTV?28:20 }}>
            {infoCard}
          </div>
        </div>

        {/* Right: Episode sidebar */}
        {episodeSidebar}
      </div>
    </div>
  );
}
