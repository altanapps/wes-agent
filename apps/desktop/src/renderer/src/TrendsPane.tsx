import { useEffect, useRef, useState } from "react";
import type { ProfileStatus, TrendPoint, TrendsData } from "../../shared/ipc.js";

/**
 * Proof of progress: one stat tile + sparkline per speech metric, the current
 * coaching profile, and the flywheel controls. Single series per tile — the
 * accent carries the line; text stays in ink tokens.
 */
export function TrendsPane() {
  const [data, setData] = useState<TrendsData | null>(null);
  const [profileStatus, setProfileStatus] = useState<ProfileStatus | null>(null);

  const refresh = () => void window.wes.trendsGet().then(setData);

  useEffect(() => {
    refresh();
    const offCall = window.wes.onCallUpdated(() => refresh());
    const offProfile = window.wes.onProfileStatus((s) => {
      setProfileStatus(s);
      if (s.status === "updated") refresh();
    });
    return () => {
      offCall();
      offProfile();
    };
  }, []);

  const series = data?.series ?? [];

  return (
    <div className="panel">
      <div className="panel-scroll">
        <div className="panel-inner wide">
          <h1>Trends</h1>
          <p className="sub">
            Every reviewed call adds a point. The goal isn't a pretty line — it's needing Wes
            less.
          </p>

          {series.length < 2 ? (
            <div className="card">
              <p className="status">
                {series.length === 0
                  ? "No reviewed calls yet — trends appear after your first recording."
                  : "One call in — record another and the lines start."}
              </p>
            </div>
          ) : (
            <div className="tiles">
              <TrendTile
                label="Fillers / 100 words"
                points={pick(series, (p) => p.fillersPer100)}
                format={(v) => v.toFixed(1)}
                betterWhen="down"
              />
              <TrendTile
                label="Pace"
                unit="wpm"
                points={pick(series, (p) => p.wpm)}
                format={(v) => String(Math.round(v))}
                betterWhen="steady"
              />
              <TrendTile
                label="Talk time"
                points={pick(series, (p) => (p.talkRatio != null ? p.talkRatio * 100 : null))}
                format={(v) => `${Math.round(v)}%`}
                betterWhen="steady"
              />
              <TrendTile
                label="Rubric score"
                unit="/30"
                points={pick(series, (p) => p.rubricTotal)}
                format={(v) => String(Math.round(v))}
                betterWhen="up"
              />
            </div>
          )}

          <div className="section-label">Coaching profile</div>
          <div className="card">
            {data?.profile ? (
              <MiniMarkdown text={data.profile} />
            ) : (
              <p className="status">
                No profile yet — it generates automatically every few calls, or import a source
                in Settings and refresh.
              </p>
            )}
            <div className="row">
              <button
                className="btn secondary"
                disabled={profileStatus?.status === "regenerating"}
                onClick={() => void window.wes.profileRefresh()}
              >
                {profileStatus?.status === "regenerating" ? "Regenerating…" : "Refresh profile"}
              </button>
              <span className="status">
                {profileStatus?.status === "failed" && `⚠️ ${profileStatus.detail}`}
                {profileStatus?.status === "updated" && "Profile updated ✓"}
                {data &&
                  ` Corpus: ${Object.entries(data.corpusCounts)
                    .map(([c, n]) => `${n} ${c}`)
                    .join(" · ") || "empty"}`}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function pick(
  series: TrendPoint[],
  get: (p: TrendPoint) => number | null,
): { t: number; v: number }[] {
  return series
    .map((p) => ({ t: p.startedAt, v: get(p) }))
    .filter((p): p is { t: number; v: number } => p.v != null);
}

function TrendTile({
  label,
  unit,
  points,
  format,
  betterWhen,
}: {
  label: string;
  unit?: string;
  points: { t: number; v: number }[];
  format: (v: number) => string;
  betterWhen: "up" | "down" | "steady";
}) {
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  if (points.length < 2) {
    return (
      <div className="tile card">
        <span className="tile-label">{label}</span>
        <span className="tile-value">—</span>
        <span className="status">not enough data</span>
      </div>
    );
  }

  const W = 260;
  const H = 64;
  const PAD = 6;
  const vs = points.map((p) => p.v);
  const min = Math.min(...vs);
  const max = Math.max(...vs);
  const span = max - min || 1;
  const x = (i: number) => PAD + (i / (points.length - 1)) * (W - PAD * 2);
  const y = (v: number) => H - PAD - ((v - min) / span) * (H - PAD * 2);
  const path = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");
  const area = `${path} L${x(points.length - 1).toFixed(1)},${H - 1} L${x(0).toFixed(1)},${H - 1} Z`;

  const latest = points[points.length - 1].v;
  const prev = points[points.length - 2].v;
  const delta = latest - prev;
  const deltaGood =
    betterWhen === "steady" ? null : (betterWhen === "down" ? delta < 0 : delta > 0) ? true : delta === 0 ? null : false;
  const active = hover ?? points.length - 1;

  return (
    <div className="tile card">
      <span className="tile-label">{label}</span>
      <span className="tile-value">
        {format(hover != null ? points[active].v : latest)}
        {unit && <small> {unit}</small>}
      </span>
      <span
        className={`tile-delta ${deltaGood === true ? "good" : deltaGood === false ? "bad" : ""}`}
      >
        {hover != null
          ? new Date(points[active].t).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
            })
          : `${delta > 0 ? "+" : ""}${format(delta).replace("+", "")} vs last call`}
      </span>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="spark"
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const rect = svgRef.current!.getBoundingClientRect();
          const px = ((e.clientX - rect.left) / rect.width) * W;
          const i = Math.round(((px - PAD) / (W - PAD * 2)) * (points.length - 1));
          setHover(Math.max(0, Math.min(points.length - 1, i)));
        }}
      >
        <path d={area} className="spark-area" />
        <path d={path} className="spark-line" />
        <circle cx={x(active)} cy={y(points[active].v)} r={3.5} className="spark-dot" />
      </svg>
    </div>
  );
}

/** Tiny renderer for the profile markdown — headings, bullets, paragraphs. */
function MiniMarkdown({ text }: { text: string }) {
  const blocks = text
    .replace(/<!--[\s\S]*?-->/g, "")
    .split("\n")
    .filter((l) => l.trim());
  return (
    <div className="mini-md">
      {blocks.map((line, i) => {
        const t = line.trim();
        if (t.startsWith("## ")) return <h4 key={i}>{t.slice(3)}</h4>;
        if (t.startsWith("# ")) return <h3 key={i}>{t.slice(2)}</h3>;
        if (t.startsWith("- ") || t.startsWith("* "))
          return <p key={i} className="md-li">• {strip(t.slice(2))}</p>;
        return <p key={i}>{strip(t)}</p>;
      })}
    </div>
  );
}

const strip = (s: string) => s.replace(/\*\*(.+?)\*\*/g, "$1").replace(/\*(.+?)\*/g, "$1");
