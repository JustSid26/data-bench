import { useMemo } from "react";
import { m, useInView } from "motion/react";
import { useChartTooltip, TipBody } from "./ChartTooltip";
import { tween } from "../../lib/motion";
import { boxStats } from "../../lib/insights";
import { count, decimal, percent } from "../../lib/format";
import type { ColumnStats, TopValue } from "../../lib/types";

const grow = (index: number, total: number) => ({ ...tween.draw, delay: Math.min(index * (0.5 / Math.max(total, 1)), 0.5) });

/** Numeric distribution. Bars grow from the baseline in sequence. */
export function HistogramSpark({
  counts,
  edges,
  height = 64,
  highlight,
}: {
  counts: number[];
  edges: number[];
  height?: number;
  /** [lo, hi] range to emphasise, e.g. the IQR */
  highlight?: [number, number];
}) {
  const { frame, bind, node } = useChartTooltip();
  const seen = useInView(frame, { once: true });
  const peak = Math.max(...counts, 1);
  const width = counts.length * 10;

  return (
    <div>
      <div ref={frame} className="relative">
        <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="w-full" style={{ height }} role="img" aria-label={`Histogram, ${counts.length} bins from ${decimal(edges[0], 2)} to ${decimal(edges[edges.length - 1], 2)}`}>
          {counts.map((value, index) => {
            const h = value > 0 ? Math.max((value / peak) * height, 2) : 0;
            const inside = highlight ? edges[index + 1] > highlight[0] && edges[index] < highlight[1] : true;
            return (
              <g key={index} {...bind(<TipBody title={`${decimal(edges[index], 2)} – ${decimal(edges[index + 1], 2)}`}>{count(value)} rows</TipBody>)}>
                <rect x={index * 10} y={0} width={10} height={height} fill="transparent" />
                <m.rect
                  x={index * 10 + 1}
                  y={height - h}
                  width={8}
                  height={h}
                  rx={1.5}
                  fill="var(--kind-numeric)"
                  opacity={inside ? 0.85 : 0.35}
                  style={{ originY: 1, transformBox: "fill-box" }}
                  initial={{ scaleY: 0 }}
                  animate={{ scaleY: seen ? 1 : 0 }}
                  transition={grow(index, counts.length)}
                />
              </g>
            );
          })}
        </svg>
        {node}
      </div>
      <div className="tnum mt-1 flex justify-between text-[10px] text-ink-faint">
        <span>{decimal(edges[0], 1)}</span>
        <span>{decimal(edges[edges.length - 1], 1)}</span>
      </div>
    </div>
  );
}

/** Top categories as horizontal bars, with an "other" remainder. */
export function TopNBars({ values, limit = 5 }: { values: TopValue[]; limit?: number }) {
  const shown = values.slice(0, limit);
  const covered = shown.reduce((sum, item) => sum + item.pct, 0);
  return (
    <m.ul className="space-y-1.5" initial="hidden" whileInView="show" viewport={{ once: true }} variants={{ show: { transition: { staggerChildren: 0.05 } } }}>
      {shown.map((item, index) => (
        <li key={index} className="text-[12px]">
          <div className="flex items-baseline gap-2">
            <span className="truncate text-ink" title={String(item.value ?? "null")}>
              {item.value === null ? <span className="text-ink-faint italic">null</span> : String(item.value)}
            </span>
            <span className="tnum ml-auto shrink-0 text-ink-muted">{percent(item.pct, item.pct < 10 ? 1 : 0)}</span>
          </div>
          <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-line">
            <m.div
              className="h-full origin-left rounded-full bg-categorical"
              variants={{ hidden: { scaleX: 0 }, show: { scaleX: item.pct / 100 } }}
              transition={tween.draw}
              title={`${count(item.count)} rows`}
            />
          </div>
        </li>
      ))}
      {covered < 99.5 && (
        <li className="flex items-baseline gap-2 text-[12px] text-ink-faint">
          <span>all other values</span>
          <span className="tnum ml-auto">{percent(100 - covered, 0)}</span>
        </li>
      )}
    </m.ul>
  );
}

/** Rows per month as an area that draws left to right. */
export function TimelineDensity({ byMonth, height = 56 }: { byMonth: Record<string, number>; height?: number }) {
  const entries = useMemo(() => Object.entries(byMonth), [byMonth]);
  const { frame, bind, node } = useChartTooltip();
  const peak = Math.max(...entries.map(([, value]) => value), 1);
  const width = Math.max(entries.length - 1, 1) * 10;
  const points = entries.map(([, value], index) => [index * 10, height - (value / peak) * (height - 4) - 2] as const);
  const line = points.map(([x, y], index) => `${index ? "L" : "M"} ${x} ${y}`).join(" ");
  const area = `${line} L ${width} ${height} L 0 ${height} Z`;

  if (entries.length < 2) return <p className="text-[12px] text-ink-muted">All rows fall in {entries[0]?.[0] ?? "one month"}.</p>;

  return (
    <div>
      <div ref={frame} className="relative">
        <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="w-full overflow-visible" style={{ height }} role="img" aria-label={`Rows per month, ${entries[0][0]} to ${entries[entries.length - 1][0]}`}>
          <m.path d={area} fill="var(--kind-datetime)" initial={{ opacity: 0 }} whileInView={{ opacity: 0.18 }} viewport={{ once: true }} transition={{ ...tween.slow, delay: 0.4 }} />
          <m.path
            d={line}
            fill="none"
            stroke="var(--kind-datetime)"
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
            initial={{ pathLength: 0 }}
            whileInView={{ pathLength: 1 }}
            viewport={{ once: true }}
            transition={tween.draw}
          />
          {entries.map(([month, value], index) => (
            <rect
              key={month}
              x={index * 10 - 5}
              y={0}
              width={10}
              height={height}
              fill="transparent"
              {...bind(<TipBody title={month}>{count(value)} rows</TipBody>)}
            />
          ))}
        </svg>
        {node}
      </div>
      <div className="tnum mt-1 flex justify-between text-[10px] text-ink-faint">
        <span>{entries[0][0]}</span>
        <span>{entries[entries.length - 1][0]}</span>
      </div>
    </div>
  );
}

/** Box plot for one numeric column, drawn over its histogram so the shape
 *  and the quartiles read together. Whiskers stop at 1.5 × IQR. */
export function BoxPlot({ column }: { column: ColumnStats }) {
  const stats = boxStats(column);
  const { frame, bind, node } = useChartTooltip();
  if (!stats) return <p className="text-[13px] text-ink-muted">Not enough numeric values for a box plot.</p>;

  const lo = stats.min;
  const hi = stats.max === stats.min ? stats.min + 1 : stats.max;
  const W = 400;
  const x = (value: number) => ((value - lo) / (hi - lo)) * W;
  const mid = 34;
  const counts = column.histogram?.counts ?? [];
  const peak = Math.max(...counts, 1);

  return (
    <div>
      <div ref={frame} className="relative">
        <svg viewBox={`-8 0 ${W + 16} 86`} className="w-full" role="img" aria-label={`Box plot: min ${decimal(stats.min, 2)}, first quartile ${decimal(stats.q1, 2)}, median ${decimal(stats.median, 2)}, third quartile ${decimal(stats.q3, 2)}, max ${decimal(stats.max, 2)}, ${column.outliers ?? 0} outliers`}>
          {/* the histogram, faint, as a violin-like silhouette behind the box */}
          {counts.map((value, index) => {
            const w = W / counts.length;
            const h = (value / peak) * 26;
            return <rect key={index} x={index * w} y={mid - h} width={Math.max(w - 1, 0.5)} height={h * 2} fill="var(--kind-numeric)" opacity={0.12} rx={1} />;
          })}
          <m.g initial={{ opacity: 0, scaleX: 0.6 }} whileInView={{ opacity: 1, scaleX: 1 }} viewport={{ once: true }} transition={tween.slow} style={{ originX: `${(x(stats.median) / W) * 100}%` }}>
            <line x1={x(stats.lowWhisker)} x2={x(stats.q1)} y1={mid} y2={mid} stroke="var(--ink-muted)" strokeWidth={1.5} />
            <line x1={x(stats.q3)} x2={x(stats.highWhisker)} y1={mid} y2={mid} stroke="var(--ink-muted)" strokeWidth={1.5} />
            <line x1={x(stats.lowWhisker)} x2={x(stats.lowWhisker)} y1={mid - 8} y2={mid + 8} stroke="var(--ink-muted)" strokeWidth={1.5} />
            <line x1={x(stats.highWhisker)} x2={x(stats.highWhisker)} y1={mid - 8} y2={mid + 8} stroke="var(--ink-muted)" strokeWidth={1.5} />
            <rect
              x={x(stats.q1)}
              y={mid - 14}
              width={Math.max(x(stats.q3) - x(stats.q1), 2)}
              height={28}
              rx={4}
              fill="var(--kind-numeric)"
              fillOpacity={0.25}
              stroke="var(--kind-numeric)"
              strokeWidth={1.5}
              {...bind(<TipBody title="Middle 50%">{decimal(stats.q1, 2)} – {decimal(stats.q3, 2)}</TipBody>)}
            />
            <line x1={x(stats.median)} x2={x(stats.median)} y1={mid - 14} y2={mid + 14} stroke="var(--ink)" strokeWidth={2.5} {...bind(<TipBody title="Median">{decimal(stats.median, 3)}</TipBody>)} />
            {stats.mean !== undefined && (
              <path d={`M ${x(stats.mean)} ${mid + 18} l 5 7 h -10 z`} fill="var(--accent-fg)" {...bind(<TipBody title="Mean">{decimal(stats.mean, 3)}</TipBody>)} />
            )}
            {/* outliers exist beyond the whiskers; mark the tails that have them */}
            {stats.min < stats.lowWhisker && <circle cx={x(stats.min)} cy={mid} r={4} fill="none" stroke="var(--warn)" strokeWidth={2} {...bind(<TipBody title="Low outliers">down to {decimal(stats.min, 2)}</TipBody>)} />}
            {stats.max > stats.highWhisker && <circle cx={x(stats.max)} cy={mid} r={4} fill="none" stroke="var(--warn)" strokeWidth={2} {...bind(<TipBody title="High outliers">up to {decimal(stats.max, 2)}</TipBody>)} />}
          </m.g>
          <line x1={0} x2={W} y1={72} y2={72} stroke="var(--line-strong)" />
          {/* min, median, max -- the median label only when it clears both ends */}
          {[
            { value: stats.min, anchor: "start" as const },
            ...(x(stats.median) > 70 && x(stats.median) < W - 70 ? [{ value: stats.median, anchor: "middle" as const }] : []),
            { value: stats.max, anchor: "end" as const },
          ].map((tick) => (
            <text key={tick.anchor} x={x(tick.value)} y={84} textAnchor={tick.anchor} className="tnum" fontSize={10} fill="var(--ink-faint)">
              {decimal(tick.value, 1)}
            </text>
          ))}
        </svg>
        {node}
      </div>
      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-ink-muted">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-4 rounded-sm border border-numeric bg-numeric/25" /> IQR</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-0.5 bg-ink" /> median</span>
        {stats.mean !== undefined && <span className="flex items-center gap-1.5"><span className="text-accent-fg">▲</span> mean</span>}
        <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full border-2 border-warn" /> outlier tail</span>
        <span className="tnum ml-auto">{count(column.outliers ?? 0)} outliers ({percent(column.outliers_pct ?? 0, 1)})</span>
      </div>
    </div>
  );
}
