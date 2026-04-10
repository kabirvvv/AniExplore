import React, { useState, useEffect, useRef } from "react";
import {
  ArrowLeft, Star, Tv, Layers, Loader2, AlertTriangle, RefreshCw,
  Play, Volume2, VolumeX, ChevronLeft, ChevronRight, Clock, Calendar,
  Film, Mic, MicOff,
} from "lucide-react";

const ANIPUB = "https://anipub.xyz";
const fixImage = (p) =>
  !p ? "" : p.startsWith("https://") ? p : `${ANIPUB}/${p}`;

function getAudioType(src = "") {
  if (src.includes("/dub")) return "dub";
  if (src.includes("/sub")) return "sub";
  return null;
}

async function fetchEpsForType(anime, type) {
  const params = new URLSearchParams();
  params.set("audioType", type);
  if (anime.anipub_id) {
    params.set("anipubId", anime.anipub_id);
  } else {
    params.set("title", anime.title_english || anime.title || "");
    if (anime.title_romaji) params.set("titleRomaji", anime.title_romaji);
  }
  const res = await fetch(`/api/anime-episodes?${params}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Server error (${res.status})`);
  return (data.episodes || []).map((e) => ({
    ep: e.number,
    src: e.src,
    type: e.audioType ?? getAudioType(e.src) ?? type,
  }));
}

// ── Genre colour palette ──────────────────────────────────────────────────────
const GENRE_STYLES = {
  Action:      { bg: "rgba(239,68,68,0.12)",  border: "rgba(239,68,68,0.35)",  text: "#fca5a5" },
  Adventure:   { bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.35)", text: "#fcd34d" },
  Comedy:      { bg: "rgba(234,179,8,0.12)",  border: "rgba(234,179,8,0.35)",  text: "#fde047" },
  Drama:       { bg: "rgba(168,85,247,0.12)", border: "rgba(168,85,247,0.35)", text: "#d8b4fe" },
  Fantasy:     { bg: "rgba(99,102,241,0.12)", border: "rgba(99,102,241,0.35)", text: "#a5b4fc" },
  Horror:      { bg: "rgba(220,38,38,0.12)",  border: "rgba(220,38,38,0.35)",  text: "#fca5a5" },
  Mystery:     { bg: "rgba(15,118,110,0.12)", border: "rgba(15,118,110,0.35)", text: "#5eead4" },
  Romance:     { bg: "rgba(236,72,153,0.12)", border: "rgba(236,72,153,0.35)", text: "#f9a8d4" },
  "Sci-Fi":    { bg: "rgba(6,182,212,0.12)",  border: "rgba(6,182,212,0.35)",  text: "#67e8f9" },
  "Slice of Life": { bg: "rgba(52,211,153,0.12)", border: "rgba(52,211,153,0.35)", text: "#6ee7b7" },
  Sports:      { bg: "rgba(249,115,22,0.12)", border: "rgba(249,115,22,0.35)", text: "#fdba74" },
  Supernatural:{ bg: "rgba(139,92,246,0.12)", border: "rgba(139,92,246,0.35)", text: "#c4b5fd" },
  Thriller:    { bg: "rgba(239,68,68,0.12)",  border: "rgba(239,68,68,0.35)",  text: "#fca5a5" },
  Mecha:       { bg: "rgba(100,116,139,0.12)",border: "rgba(100,116,139,0.35)",text: "#cbd5e1" },
  Music:       { bg: "rgba(244,114,182,0.12)",border: "rgba(244,114,182,0.35)",text: "#f9a8d4" },
  Psychological:{ bg: "rgba(124,58,237,0.12)",border: "rgba(124,58,237,0.35)",text: "#c4b5fd" },
  DEFAULT:     { bg: "rgba(99,102,241,0.12)", border: "rgba(99,102,241,0.35)", text: "#a5b4fc" },
};

function GenreTag({ name }) {
  const s = GENRE_STYLES[name] || GENRE_STYLES.DEFAULT;
  return (
    <span style={{
      background: s.bg, border: `1px solid ${s.border}`, color: s.text,
      display: "inline-flex", alignItems: "center",
      padding: "3px 10px", borderRadius: 999,
      fontSize: 10, fontWeight: 800,
      letterSpacing: "0.06em", textTransform: "uppercase",
    }}>
      {name}
    </span>
  );
}

function ScoreRing({ score }) {
  const pct = Math.min((parseFloat(score) / 10) * 100, 100);
  const r = 18, c = 2 * Math.PI * r;
  const dash = (pct / 100) * c;
  const color = pct >= 75 ? "#4ade80" : pct >= 50 ? "#facc15" : "#f87171";
  return (
    <div style={{ position: "relative", width: 52, height: 52, flexShrink: 0 }}>
      <svg width={52} height={52} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={26} cy={26} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={3} />
        <circle cx={26} cy={26} r={r} fill="none" stroke={color} strokeWidth={3}
          strokeDasharray={`${dash} ${c}`} strokeLinecap="round" />
      </svg>
      <div style={{
        position: "absolute", inset: 0, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
      }}>
        <span style={{ fontSize: 13, fontWeight: 900, color, lineHeight: 1 }}>{score}</span>
        <span style={{ fontSize: 7, color: "rgba(255,255,255,0.4)", fontWeight: 700, marginTop: 1 }}>SCORE</span>
      </div>
    </div>
  );
}

function StatPill({ icon: Icon, label, value }) {
  if (!value) return null;
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 6, padding: "5px 12px",
      background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 999,
    }}>
      <Icon size={11} color="rgba(255,255,255,0.4)" />
      <span style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.07em" }}>
        {label}
      </span>
      <span style={{ fontSize: 11, fontWeight: 800, color: "rgba(255,255,255,0.85)" }}>{value}</span>
    </div>
  );
}

function EpButton({ ep, active, onClick }) {
  return (
    <button
      data-active={active}
      onClick={onClick}
      style={{
        width: "100%", display: "flex", alignItems: "center", gap: 12,
        padding: "10px 16px",
        background: active ? "rgba(99,102,241,0.18)" : "transparent",
        borderLeft: active ? "2px solid #818cf8" : "2px solid transparent",
        borderTop: "none", borderRight: "none",
        borderBottom: "1px solid rgba(255,255,255,0.04)",
        cursor: "pointer", transition: "all 0.15s ease", textAlign: "left",
      }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.background = active ? "rgba(99,102,241,0.18)" : "transparent"; }}
    >
      <div style={{
        width: 32, height: 32, borderRadius: 8, flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: active ? "#6366f1" : "rgba(255,255,255,0.08)",
        fontSize: 11, fontWeight: 900,
        color: active ? "#fff" : "rgba(255,255,255,0.5)",
      }}>
        {ep}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: active ? "#fff" : "rgba(255,255,255,0.65)", margin: 0 }}>
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
        }} />
      )}
    </button>
  );
}

// ════════════════════════════════════════════════════════════════════════════
export default function AnimeStreamPage({ anime, onBack }) {
  const [audioType,  setAudioType]  = useState("sub");
  const [allEps,     setAllEps]     = useState([]);
  const [currentEp,  setCurrentEp]  = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);
  const [expanded,   setExpanded]   = useState(false);
  const epListRef = useRef(null);

  // Inject Google Fonts once
  useEffect(() => {
    if (!document.getElementById("anime-gf")) {
      const l = document.createElement("link");
      l.id = "anime-gf"; l.rel = "stylesheet";
      l.href = "https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@400;500;600;700;800;900&display=swap";
      document.head.appendChild(l);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true); setError(null); setAllEps([]); setCurrentEp(null);
      try {
        const [subResult, dubResult] = await Promise.allSettled([
          fetchEpsForType(anime, "sub"),
          fetchEpsForType(anime, "dub"),
        ]);
        const subEps = subResult.status === "fulfilled" ? subResult.value : [];
        const dubEps = dubResult.status === "fulfilled" ? dubResult.value : [];
        const combined = [...subEps, ...dubEps];
        if (!combined.length) throw new Error("No episodes found on AniPub.");
        const defaultType = subEps.length > 0 ? "sub" : "dub";
        if (!cancelled) {
          setAllEps(combined);
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
  }, [anime]);

  const filteredEps = allEps.filter((e) => e.type === audioType);
  const subCount    = allEps.filter((e) => e.type === "sub").length;
  const dubCount    = allEps.filter((e) => e.type === "dub").length;
  const totalEps    = filteredEps.length;
  const currentSrc  = filteredEps.find((e) => e.ep === currentEp)?.src || "";
  const currentIdx  = filteredEps.findIndex((e) => e.ep === currentEp);
  const prevEp      = currentIdx > 0 ? filteredEps[currentIdx - 1]?.ep : null;
  const nextEp      = currentIdx < filteredEps.length - 1 ? filteredEps[currentIdx + 1]?.ep : null;

  useEffect(() => {
    const first = filteredEps[0]?.ep;
    if (first != null) setCurrentEp(first);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioType]);

  useEffect(() => {
    if (!epListRef.current) return;
    epListRef.current.querySelector("[data-active='true']")?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [currentEp, audioType]);

  const coverImg =
    anime.images?.webp?.large_image_url ||
    anime.images?.jpg?.large_image_url  ||
    fixImage(anime.ImagePath);

  const synopsis = anime.synopsis?.replace(/<[^>]+>/g, "") || "";

  const css = `
    @keyframes spin  { to { transform: rotate(360deg) } }
    @keyframes blink { 0%,100%{opacity:1} 50%{opacity:.3} }
    @keyframes fadeUp{ from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
    .ep-scroll::-webkit-scrollbar { width: 3px }
    .ep-scroll::-webkit-scrollbar-thumb { background: rgba(99,102,241,.35); border-radius: 4px }
    .synopsis-clamp { display:-webkit-box; -webkit-box-orient:vertical; overflow:hidden }
  `;

  return (
    <div style={{ minHeight: "100vh", background: "#080b14", color: "#e2e8f0", fontFamily: "'DM Sans', sans-serif", position: "relative", overflowX: "hidden" }}>
      <style>{css}</style>

      {/* Ambient glow */}
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, height: "55vh", pointerEvents: "none", zIndex: 0, background: "radial-gradient(ellipse 70% 50% at 15% -5%, rgba(99,102,241,0.11) 0%, transparent 70%)" }} />

      {/* ── HEADER ──────────────────────────────────────────────────────── */}
      <header style={{
        position: "sticky", top: 0, zIndex: 50,
        background: "rgba(8,11,20,0.88)", backdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(255,255,255,0.055)",
      }}>
        <div style={{
          maxWidth: 1600, margin: "0 auto", padding: "0 24px",
          height: 56, display: "flex", alignItems: "center", gap: 14,
        }}>
          {/* Back */}
          <button onClick={onBack} style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "6px 14px", background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10,
            cursor: "pointer", fontSize: 12, fontWeight: 800,
            color: "rgba(255,255,255,0.55)", fontFamily: "inherit", transition: "all 0.15s",
          }}
          onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.11)"; e.currentTarget.style.color = "#fff"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.color = "rgba(255,255,255,0.55)"; }}
          >
            <ArrowLeft size={13} /> Back
          </button>

          {/* Title */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{
              margin: 0, fontFamily: "'Bebas Neue', sans-serif",
              fontSize: 19, letterSpacing: "0.05em", color: "#fff", lineHeight: 1,
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            }}>
              {anime.title}
            </h1>
            {!loading && !error && (
              <p style={{ margin: 0, fontSize: 9, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: "#818cf8" }}>
                Ep {currentEp} / {totalEps} &nbsp;·&nbsp; {audioType.toUpperCase()}
              </p>
            )}
          </div>

          {/* Header nav */}
          {!loading && !error && (
            <div style={{ display: "flex", gap: 6 }}>
              {[
                { ep: prevEp, Icon: ChevronLeft,  dir: "prev" },
                { ep: nextEp, Icon: ChevronRight, dir: "next" },
              ].map(({ ep, Icon, dir }) => (
                <button key={dir} onClick={() => ep != null && setCurrentEp(ep)} disabled={ep == null} style={{
                  width: 32, height: 32, borderRadius: 8,
                  border: "1px solid rgba(255,255,255,0.1)",
                  background: "rgba(255,255,255,0.05)", cursor: ep == null ? "not-allowed" : "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  opacity: ep == null ? 0.3 : 1, color: "#fff",
                }}>
                  <Icon size={14} />
                </button>
              ))}
            </div>
          )}
        </div>
      </header>

      {/* ── BODY ─────────────────────────────────────────────────────────── */}
      <div style={{
        maxWidth: 1600, margin: "0 auto", padding: "24px",
        display: "flex", gap: 24, alignItems: "flex-start", position: "relative", zIndex: 1,
      }}>

        {/* LEFT */}
        <div style={{ flex: 1, minWidth: 0, animation: "fadeUp 0.4s ease" }}>

          {/* Sub/Dub toggle */}
          {!loading && !error && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <span style={{ fontSize: 9, fontWeight: 900, color: "rgba(255,255,255,0.28)", textTransform: "uppercase", letterSpacing: "0.14em" }}>
                Audio
              </span>
              <div style={{ display: "flex", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, overflow: "hidden" }}>
                {[
                  { t: "sub", count: subCount, Icon: Volume2, label: "SUB" },
                  { t: "dub", count: dubCount, Icon: VolumeX, label: "DUB" },
                ].map(({ t, count, Icon, label }) => (
                  <button key={t} onClick={() => count > 0 && setAudioType(t)} disabled={count === 0}
                    style={{
                      display: "flex", alignItems: "center", gap: 6,
                      padding: "7px 18px",
                      background: audioType === t ? "#6366f1" : "transparent",
                      border: "none", cursor: count === 0 ? "not-allowed" : "pointer",
                      fontFamily: "inherit", fontSize: 11, fontWeight: 900,
                      letterSpacing: "0.08em", textTransform: "uppercase",
                      color: audioType === t ? "#fff" : count === 0 ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.5)",
                      transition: "all 0.2s",
                    }}
                  >
                    <Icon size={11} />
                    {label}
                    {count > 0 && (
                      <span style={{ fontSize: 9, color: audioType === t ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.28)", marginLeft: 2 }}>
                        {count}
                      </span>
                    )}
                  </button>
                ))}
              </div>
              {subCount === 0 && !loading && <span style={{ fontSize: 10, fontWeight: 700, color: "#fbbf24" }}>⚠ Sub unavailable</span>}
              {dubCount === 0 && !loading && <span style={{ fontSize: 10, fontWeight: 700, color: "#fbbf24" }}>⚠ Dub unavailable</span>}
            </div>
          )}

          {/* Player */}
          <div style={{
            position: "relative", background: "#000", borderRadius: 16,
            overflow: "hidden", aspectRatio: "16/9",
            border: "1px solid rgba(255,255,255,0.07)",
            boxShadow: "0 24px 80px rgba(0,0,0,0.65), 0 0 0 1px rgba(99,102,241,0.08)",
          }}>
            {loading && (
              <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, background: "#000" }}>
                <div style={{ width: 48, height: 48, borderRadius: "50%", border: "3px solid rgba(99,102,241,0.15)", borderTop: "3px solid #6366f1", animation: "spin 0.85s linear infinite" }} />
                <p style={{ fontSize: 10, fontWeight: 800, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.15em", margin: 0 }}>
                  Loading stream…
                </p>
              </div>
            )}

            {error && (
              <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.9)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ textAlign: "center", padding: "0 32px" }}>
                  <AlertTriangle size={36} color="#f87171" style={{ display: "block", margin: "0 auto 12px" }} />
                  <p style={{ fontSize: 14, fontWeight: 700, color: "#f87171", margin: "0 0 6px" }}>Stream Error</p>
                  <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", margin: "0 0 20px", maxWidth: 280 }}>{error}</p>
                  <button onClick={() => window.location.reload()} style={{
                    display: "inline-flex", alignItems: "center", gap: 8, padding: "9px 20px",
                    background: "#6366f1", border: "none", borderRadius: 10, cursor: "pointer",
                    fontSize: 11, fontWeight: 900, color: "#fff", fontFamily: "inherit",
                    letterSpacing: "0.08em", textTransform: "uppercase",
                  }}>
                    <RefreshCw size={12} /> Retry
                  </button>
                </div>
              </div>
            )}

            {!loading && !error && currentSrc && (
              <iframe key={currentSrc} src={currentSrc}
                style={{ width: "100%", height: "100%", border: 0, display: "block" }}
                allowFullScreen allow="autoplay; fullscreen; encrypted-media"
                sandbox="allow-scripts allow-same-origin allow-presentation allow-fullscreen"
                scrolling="no"
              />
            )}
          </div>

          {/* Prev / Next row */}
          {!loading && !error && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 12 }}>
              {[
                { ep: prevEp, label: "← Prev", align: "left" },
                { ep: nextEp, label: "Next →", align: "right" },
              ].map(({ ep, label }) => (
                <button key={label} onClick={() => ep != null && setCurrentEp(ep)} disabled={ep == null} style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "7px 16px", borderRadius: 10,
                  background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)",
                  cursor: ep == null ? "not-allowed" : "pointer", opacity: ep == null ? 0.3 : 1,
                  fontSize: 11, fontWeight: 800, color: "rgba(255,255,255,0.7)", fontFamily: "inherit",
                }}>
                  {label}
                </button>
              ))}
              <span style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.3)" }}>
                {currentEp != null && `EP ${currentEp} · ${audioType.toUpperCase()}`}
              </span>
            </div>
          )}

          {/* ── Info card ─────────────────────────────────────────────── */}
          <div style={{
            marginTop: 20, background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.07)", borderRadius: 18, overflow: "hidden",
          }}>
            {/* Blurred banner */}
            {coverImg && (
              <div style={{ height: 80, position: "relative", overflow: "hidden" }}>
                <img src={coverImg} alt="" style={{
                  width: "100%", height: "100%", objectFit: "cover",
                  filter: "blur(20px) brightness(0.35) saturate(2)", transform: "scale(1.1)",
                }} />
                <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, transparent 0%, rgba(8,11,20,0.95) 100%)" }} />
              </div>
            )}

            <div style={{ padding: "0 20px 22px", marginTop: coverImg ? -36 : 20 }}>
              <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
                {coverImg && (
                  <img src={coverImg} alt={anime.title} style={{
                    width: 82, borderRadius: 10,
                    border: "2px solid rgba(255,255,255,0.12)",
                    boxShadow: "0 8px 24px rgba(0,0,0,0.55)",
                    flexShrink: 0, objectFit: "cover", position: "relative", zIndex: 1,
                  }} />
                )}
                <div style={{ flex: 1, minWidth: 0, paddingTop: coverImg ? 38 : 0 }}>
                  <h2 style={{ margin: "0 0 2px", fontFamily: "'Bebas Neue', sans-serif", fontSize: 24, letterSpacing: "0.04em", color: "#fff", lineHeight: 1 }}>
                    {anime.title}
                  </h2>
                  {anime.title_romaji && anime.title_romaji !== anime.title && (
                    <p style={{ margin: "0 0 10px", fontSize: 11, color: "rgba(255,255,255,0.35)", fontWeight: 600 }}>
                      {anime.title_romaji}
                    </p>
                  )}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", marginBottom: 12 }}>
                    {anime.score && <ScoreRing score={anime.score} />}
                    <StatPill icon={Tv}      label="Format" value={anime.format} />
                    <StatPill icon={Layers}  label="Studio" value={anime.studio} />
                    <StatPill icon={Calendar}label="Year"   value={anime.year || anime.season_year} />
                    <StatPill icon={Clock}   label="Status" value={anime.status} />
                    <StatPill icon={Film}    label="Eps"    value={anime.episodes_count} />
                  </div>
                </div>
              </div>

              {/* Genres */}
              {anime.genres?.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14, marginTop: 6 }}>
                  {anime.genres.slice(0, 8).map((g) => (
                    <GenreTag key={g.name || g} name={g.name || g} />
                  ))}
                </div>
              )}

              {/* Synopsis */}
              {synopsis && (
                <>
                  <p className="synopsis-clamp" style={{
                    fontSize: 12, lineHeight: 1.8, color: "rgba(255,255,255,0.5)",
                    margin: 0, WebkitLineClamp: expanded ? "unset" : 3,
                  }}>
                    {synopsis}
                  </p>
                  {synopsis.length > 200 && (
                    <button onClick={() => setExpanded(!expanded)} style={{
                      marginTop: 6, background: "none", border: "none", cursor: "pointer",
                      fontSize: 11, fontWeight: 800, color: "#818cf8", fontFamily: "inherit",
                      padding: 0, textTransform: "uppercase", letterSpacing: "0.06em",
                    }}>
                      {expanded ? "Show less ↑" : "Read more ↓"}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT: Episode list */}
        <div style={{ width: 295, flexShrink: 0 }}>
          <div style={{
            background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 18, overflow: "hidden", position: "sticky", top: 68,
          }}>
            {/* List header */}
            <div style={{
              padding: "14px 16px 12px", borderBottom: "1px solid rgba(255,255,255,0.06)",
              background: "rgba(255,255,255,0.02)", display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
              <div>
                <p style={{ margin: 0, fontSize: 9, fontWeight: 900, color: "#818cf8", textTransform: "uppercase", letterSpacing: "0.14em" }}>
                  Episodes
                </p>
                <p style={{ margin: 0, fontSize: 17, fontFamily: "'Bebas Neue', sans-serif", letterSpacing: "0.05em", color: "#fff", lineHeight: 1.1 }}>
                  {loading ? "…" : `${totalEps} ${audioType.toUpperCase()}`}
                </p>
              </div>
              {!loading && !error && (
                <div style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.3)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <Play size={13} color="#818cf8" />
                </div>
              )}
            </div>

            {/* Scroll list */}
            <div ref={epListRef} className="ep-scroll" style={{ overflowY: "auto", maxHeight: "calc(100vh - 200px)" }}>
              {loading && (
                <div style={{ padding: "32px 0", display: "flex", justifyContent: "center" }}>
                  <div style={{ width: 20, height: 20, borderRadius: "50%", border: "2px solid rgba(99,102,241,0.2)", borderTop: "2px solid #6366f1", animation: "spin 0.85s linear infinite" }} />
                </div>
              )}

              {!loading && filteredEps.map(({ ep }) => (
                <EpButton key={ep} ep={ep} active={ep === currentEp} onClick={() => setCurrentEp(ep)} />
              ))}

              {!loading && filteredEps.length === 0 && (
                <div style={{ padding: "32px 16px", textAlign: "center" }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.3)", margin: "0 0 10px" }}>
                    No {audioType} episodes available.
                  </p>
                  <button onClick={() => setAudioType(audioType === "sub" ? "dub" : "sub")} style={{
                    background: "none", border: "none", cursor: "pointer",
                    fontSize: 10, fontWeight: 900, color: "#818cf8",
                    textTransform: "uppercase", letterSpacing: "0.1em", fontFamily: "inherit",
                  }}>
                    Switch to {audioType === "sub" ? "DUB" : "SUB"} →
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
