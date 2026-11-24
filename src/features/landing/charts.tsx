/** Hand-drawn SVG charts with fixed sample data for the landing page (no chart library). */

/** Five years of sample net worth (₹ lakh), ending at ₹48.75 L. */
const TREND = [
  31.2, 32.0, 33.5, 33.1, 35.4, 36.8, 38.2, 37.6, 40.1, 42.3, 43.0, 44.9, 46.2, 45.8, 47.4, 48.75,
];
const YEARS = ['2021', '2022', '2023', '2024', '2025', '2026'];

export function TrendChart({
  className,
  labelled = false,
}: {
  className?: string;
  labelled?: boolean;
}) {
  const w = 300;
  const h = 100;
  const min = Math.min(...TREND) - 2;
  const max = Math.max(...TREND) + 2;
  const pts = TREND.map(
    (v, i) => [(i / (TREND.length - 1)) * w, h - ((v - min) / (max - min)) * h] as const,
  );
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  return (
    <div className={className}>
      <svg
        viewBox={`0 0 ${String(w)} ${String(h)}`}
        preserveAspectRatio="none"
        className="h-full w-full overflow-visible"
        role="img"
        aria-label="Sample chart: net worth rising from ₹31 lakh to ₹48.75 lakh over five years"
      >
        <defs>
          <linearGradient id="trend-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
          </linearGradient>
          {/* The logo's green → cyan → blue, as in the app's charts. */}
          <linearGradient id="trend-line" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="#10b981" />
            <stop offset="55%" stopColor="#06b6d4" />
            <stop offset="100%" stopColor="#3b82f6" />
          </linearGradient>
        </defs>
        <path d={`${line} L${String(w)},${String(h)} L0,${String(h)} Z`} fill="url(#trend-fill)" />
        <path
          d={line}
          fill="none"
          stroke="url(#trend-line)"
          strokeWidth="2.5"
          vectorEffect="non-scaling-stroke"
          strokeLinejoin="round"
        />
      </svg>
      {labelled && (
        <div className="mt-2 flex justify-between text-xs text-ink-faint" aria-hidden="true">
          {YEARS.map((y) => (
            <span key={y}>{y}</span>
          ))}
        </div>
      )}
    </div>
  );
}

/** Sample allocation of ₹62 L in assets. */
const ALLOCATION = [
  ['Real Estate', 45, '#0f766e'],
  ['Mutual Funds', 24, '#14b8a6'],
  ['Retirement (EPF/PPF/NPS)', 15, '#38bdf8'],
  ['Cash & Deposits', 9, '#818cf8'],
  ['Gold', 7, '#f59e0b'],
] as const;

export function AllocationDonut({ className }: { className?: string }) {
  const r = 40;
  const c = 2 * Math.PI * r;
  // Where each segment starts along the circle (cumulative share of the earlier ones).
  const starts = ALLOCATION.map((_, i) =>
    ALLOCATION.slice(0, i).reduce((sum, [, pct]) => sum + (pct / 100) * c, 0),
  );
  return (
    <div className={`flex items-center gap-5 ${className ?? ''}`}>
      <svg
        viewBox="0 0 100 100"
        className="h-32 w-32 shrink-0 -rotate-90"
        role="img"
        aria-label="Sample asset allocation chart"
      >
        {ALLOCATION.map(([label, pct, color], i) => {
          const dash = (pct / 100) * c;
          return (
            <circle
              key={label}
              cx="50"
              cy="50"
              r={r}
              fill="none"
              stroke={color}
              strokeWidth="16"
              strokeDasharray={`${String(dash)} ${String(c - dash)}`}
              strokeDashoffset={-(starts[i] ?? 0)}
            />
          );
        })}
      </svg>
      <ul className="space-y-1 text-sm">
        {ALLOCATION.map(([label, pct, color]) => (
          <li key={label} className="flex items-center gap-2 text-ink-soft">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: color }}
              aria-hidden="true"
            />
            {label} <span className="tabular-nums text-ink-muted">{pct}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
