'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

// ── Constants ─────────────────────────────────────────────────────────────────

const H        = 340;   // total SVG height px
const PAD_T    = 16;    // top padding
const PAD_R    = 72;    // right (price tick labels)
const PAD_B    = 32;    // bottom (x-axis labels)
const PAD_L    = 4;     // left
const VOL_ZONE = 50;    // height reserved for volume bars at bottom
const VOL_GAP  = 12;    // gap between price area and volume area
const TENSION  = 0.38;  // bezier control-point pull (0 = linear, higher = smoother)

// Derived constants (all from the above, never change)
const C_B      = H - PAD_B;                       // bottom of chart area
const PRICE_B  = C_B - VOL_ZONE - VOL_GAP;        // bottom of price area
const PRICE_H  = PRICE_B - PAD_T;                 // height of price area

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ChartPoint {
  label: string;
  price: number | null;
  volume: number;
}

// ── Tiny helpers ──────────────────────────────────────────────────────────────

function gpTick(n: number): string {
  const a = Math.abs(n);
  if (a >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (a >= 1_000_000)     return `${(n / 1_000_000).toFixed(1)}M`;
  if (a >= 1_000)         return `${Math.round(n / 1_000)}K`;
  return Math.round(n).toLocaleString();
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/** Build a cubic-bezier path through an array of {x,y} points. */
function smoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length === 0) return '';
  if (pts.length === 1) return `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) {
    const dx = pts[i].x - pts[i - 1].x;
    const cp1x = (pts[i - 1].x + dx * TENSION).toFixed(1);
    const cp2x = (pts[i].x     - dx * TENSION).toFixed(1);
    d += ` C ${cp1x},${pts[i - 1].y.toFixed(1)} ${cp2x},${pts[i].y.toFixed(1)} ${pts[i].x.toFixed(1)},${pts[i].y.toFixed(1)}`;
  }
  return d;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function PriceChart({ points }: { points: ChartPoint[] }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [w, setW]         = useState(640);
  const [hover, setHover] = useState<number | null>(null);

  // Track container width
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const next = entries[0]?.contentRect.width;
      if (next) setW(next);
    });
    ro.observe(el);
    // Read immediately (ResizeObserver may not fire synchronously)
    const init = el.getBoundingClientRect().width;
    if (init > 0) setW(init);
    return () => ro.disconnect();
  }, []);

  const n  = points.length;
  const cL = PAD_L;
  const cR = w - PAD_R;
  const cW = Math.max(1, cR - cL);

  /** X pixel for data index i. */
  const xAt = (i: number) => (n <= 1 ? cL + cW / 2 : cL + (i / (n - 1)) * cW);

  // ── Price domain ────────────────────────────────────────────────────────────
  const { priceLo, priceHi } = useMemo(() => {
    const vals = points.flatMap((p) => (p.price != null ? [p.price] : []));
    if (vals.length === 0) return { priceLo: 0, priceHi: 1 };
    const lo = Math.min(...vals);
    const hi = Math.max(...vals);
    const pad = ((hi - lo) || Math.max(hi * 0.1, 1)) * 0.07;
    return { priceLo: lo - pad, priceHi: hi + pad };
  }, [points]);

  const priceY = (p: number) =>
    PRICE_B - ((p - priceLo) / (priceHi - priceLo)) * PRICE_H;

  // ── Volume domain ────────────────────────────────────────────────────────────
  const volMax = useMemo(() => Math.max(1, ...points.map((p) => p.volume)), [points]);
  const volY   = (v: number) => C_B - (v / volMax) * VOL_ZONE;

  // ── Line segments (split at nulls = data gaps) ───────────────────────────────
  const segments = useMemo(() => {
    const segs: { i: number; price: number }[][] = [];
    let cur: { i: number; price: number }[] = [];
    for (let i = 0; i < n; i++) {
      const p = points[i].price;
      if (p != null) {
        cur.push({ i, price: p });
      } else if (cur.length > 0) {
        segs.push(cur);
        cur = [];
      }
    }
    if (cur.length > 0) segs.push(cur);
    return segs;
  }, [points, n]);

  // ── SVG paths per segment ─────────────────────────────────────────────────
   
  const paths = useMemo(() => {
    return segments.map((seg) => {
      const pts = seg.map((s) => ({ x: xAt(s.i), y: priceY(s.price) }));
      const line = smoothPath(pts);
      const first = pts[0];
      const last  = pts[pts.length - 1];
      // Close the area shape down to the price-area baseline
      const fill  = `${line} L ${last.x.toFixed(1)},${PRICE_B} L ${first.x.toFixed(1)},${PRICE_B} Z`;
      return { line, fill };
    });
  }, [segments, w, priceLo, priceHi]); // w / price domain drive geometry

  // ── Y-axis ticks (5 evenly spaced) ──────────────────────────────────────────
  const yTicks = useMemo(
    () =>
      Array.from({ length: 5 }, (_, i) => {
        const frac = i / 4;
        return {
          y:   PRICE_B - frac * PRICE_H,
          val: priceLo + frac * (priceHi - priceLo),
        };
      }),
    [priceLo, priceHi],
  );

  // ── X-axis ticks (max 7 evenly spread, always include last) ─────────────────
  const xTicks = useMemo(() => {
    if (n === 0) return [];
    const step = Math.max(1, Math.ceil(n / 7));
    const ticks: { i: number; label: string }[] = [];
    for (let i = 0; i < n; i += step) ticks.push({ i, label: points[i].label });
    if (ticks[ticks.length - 1].i !== n - 1)
      ticks.push({ i: n - 1, label: points[n - 1].label });
    return ticks;
  }, [n, points]);

  // ── Hover ────────────────────────────────────────────────────────────────────
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (n === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const cLv  = PAD_L;
    const cWv  = rect.width - PAD_R - PAD_L;
    if (cWv <= 0) return;
    const idx  = clamp(Math.round(((e.clientX - rect.left - cLv) / cWv) * (n - 1)), 0, n - 1);
    setHover(idx);
  };

  const hp  = hover != null ? points[hover]  : null;
  const hx  = hover != null ? xAt(hover)     : null;
  const hy  = hp?.price != null ? priceY(hp.price) : null;

  // Tooltip: flip to left when near right edge
  const ttLeft = hx != null
    ? hx > w * 0.65 ? hx - 160 : hx + 14
    : 0;

  // ── Empty state ──────────────────────────────────────────────────────────────
  if (n === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 text-neutral-600">
        <svg className="w-12 h-12 opacity-25" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
        </svg>
        <p className="text-sm font-medium">No price data for this range</p>
      </div>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div ref={rootRef} className="relative w-full select-none" style={{ height: H }}>
      <svg
        width={w}
        height={H}
        style={{ display: 'block' }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id="pgFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#34d399" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#34d399" stopOpacity="0.01" />
          </linearGradient>
        </defs>

        {/* Horizontal grid lines */}
        {yTicks.map((t, i) => (
          <line key={i}
            x1={cL} y1={t.y} x2={cR} y2={t.y}
            stroke="rgba(255,255,255,0.032)" strokeWidth={1}
          />
        ))}

        {/* Volume bars */}
        {points.map((p, i) => {
          const bw = Math.max(1, (cW / n) * 0.65);
          const by = volY(p.volume);
          const bh = C_B - by;
          if (bh <= 0) return null;
          return (
            <rect key={i}
              x={xAt(i) - bw / 2} y={by} width={bw} height={bh}
              fill={i === hover ? 'rgba(100,116,139,0.45)' : 'rgba(100,116,139,0.20)'}
              rx={1.5}
            />
          );
        })}

        {/* Price gradient fill */}
        {paths.map((p, i) => (
          <path key={i} d={p.fill} fill="url(#pgFill)" />
        ))}

        {/* Price line */}
        {paths.map((p, i) => (
          <path key={i} d={p.line} fill="none" stroke="#34d399" strokeWidth={1.75} />
        ))}

        {/* Hover crosshair */}
        {hx != null && (
          <line
            x1={hx} y1={PAD_T} x2={hx} y2={C_B}
            stroke="rgba(255,255,255,0.13)" strokeWidth={1} strokeDasharray="4 3"
          />
        )}
        {hx != null && hy != null && (
          <circle cx={hx} cy={hy} r={4} fill="#34d399" stroke="#0a0a0e" strokeWidth={2} />
        )}

        {/* Y-axis price labels */}
        {yTicks.map((t, i) => (
          <text key={i}
            x={cR + 9} y={t.y + 4}
            fontSize={10} fill="#475569"
            textAnchor="start"
            fontFamily="ui-monospace, monospace"
          >
            {gpTick(t.val)}
          </text>
        ))}

        {/* X-axis labels */}
        {xTicks.map((t) => (
          <text key={t.i}
            x={xAt(t.i)} y={H - 8}
            fontSize={10} fill="#475569"
            textAnchor={t.i === 0 ? 'start' : t.i === n - 1 ? 'end' : 'middle'}
          >
            {t.label}
          </text>
        ))}
      </svg>

      {/* Floating tooltip */}
      {hover != null && hp != null && (
        <div
          className="pointer-events-none absolute top-4 z-20 min-w-[136px] bg-[#0a0a0e]/96 border border-white/[0.08] rounded-xl px-3.5 py-2.5 shadow-2xl"
          style={{ left: ttLeft }}
        >
          <p className="text-[10px] font-medium text-neutral-600 mb-1.5 truncate">{hp.label}</p>
          {hp.price != null && (
            <p className="text-sm font-bold text-white tabular-nums">
              {Math.round(hp.price).toLocaleString()}
              <span className="text-xs font-normal text-neutral-500 ml-1">GP</span>
            </p>
          )}
          {hp.volume > 0 && (
            <p className="text-xs text-neutral-500 mt-0.5 tabular-nums">
              Vol&nbsp;{hp.volume.toLocaleString()}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
