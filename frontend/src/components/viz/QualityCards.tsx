import { useMemo, useRef } from "react";
import { m, useInView } from "motion/react";
import { Icon } from "../icons";
import { QualityBadge } from "../primitives";
import { useChartTooltip, TipBody } from "./ChartTooltip";
import { CountUp, tween } from "../../lib/motion";
import { KIND } from "../../lib/tokens";
import { percent } from "../../lib/format";
import type { ColumnStats, Profile } from "../../lib/types";

/** Duplicate rows: the count, the share, and a split bar. */
export function DuplicatesCard({ profile }: { profile: Profile }) {
  const share = profile.sampled_rows ? (profile.duplicate_rows / profile.sampled_rows) * 100 : 0;
  const quality = share >= 5 ? "critical" : share > 0 ? "warning" : "good";
  const bar = useRef<HTMLDivElement>(null);
  const seen = useInView(bar, { once: true });
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[12px] text-ink-muted">Duplicate rows</p>
          <p className="tnum mt-1 text-[28px] leading-none font-semibold">
            <CountUp value={profile.duplicate_rows} />
          </p>
        </div>
        <QualityBadge quality={quality}>{percent(share, share < 1 ? 2 : 1)}</QualityBadge>
      </div>
      <div className="mt-auto pt-4">
        <div ref={bar} className="flex h-2 gap-0.5 overflow-hidden rounded-full" role="img" aria-label={`${percent(100 - share, 1)} unique, ${percent(share, 1)} duplicated`}>
          <m.span className="h-full origin-left rounded-l-full bg-accent" style={{ width: `${100 - share}%` }} initial={{ scaleX: 0 }} animate={{ scaleX: seen ? 1 : 0 }} transition={tween.draw} />
          {share > 0 && (
            <m.span className="h-full min-w-1 origin-left rounded-r-full bg-bad" style={{ width: `${share}%` }} initial={{ scaleX: 0 }} animate={{ scaleX: seen ? 1 : 0 }} transition={{ ...tween.draw, delay: 0.6 }} />
          )}
        </div>
        <p className="tnum mt-1.5 text-[11px] text-ink-faint">
          of {profile.sampled_rows.toLocaleString("en-US")} {profile.sampled_rows < profile.rows ? "sampled " : ""}rows
        </p>
      </div>
    </div>
  );
}

/** Cardinality: distinct-value share per column as a sorted sparkline, with
 *  the most and least varied columns called out. */
export function CardinalityCard({ columns, onSelect }: { columns: ColumnStats[]; onSelect?: (name: string) => void }) {
  const sorted = useMemo(() => [...columns].sort((a, b) => b.unique_pct - a.unique_pct), [columns]);
  const { frame, bind, node } = useChartTooltip();
  const seen = useInView(frame, { once: true });
  const high = sorted.filter((column) => column.kind === "categorical" && column.unique > 50).length;
  const W = Math.max(sorted.length * 6, 60);
  const H = 44;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[12px] text-ink-muted">Cardinality</p>
          <p className="tnum mt-1 text-[28px] leading-none font-semibold">
            <CountUp value={high} />
            <span className="ml-1.5 text-[12px] font-normal text-ink-muted">high-cardinality categoricals</span>
          </p>
        </div>
        {high > 0 && <QualityBadge quality="warning" />}
      </div>
      <div ref={frame} className="relative mt-auto pt-4">
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-11 w-full" role="img" aria-label="Distinct-value share per column, highest first">
          {sorted.map((column, index) => {
            const h = Math.max((column.unique_pct / 100) * H, 1.5);
            return (
              <g key={column.name} onClick={() => onSelect?.(column.name)} className={onSelect ? "cursor-pointer" : undefined} {...bind(<TipBody title={<span className="font-mono">{column.name}</span>}>{percent(column.unique_pct, 1)} distinct · {column.unique.toLocaleString("en-US")} values</TipBody>)}>
                <rect x={index * (W / sorted.length)} y={0} width={W / sorted.length} height={H} fill="transparent" />
                <m.rect
                  x={index * (W / sorted.length) + 0.5}
                  y={H - h}
                  width={Math.max(W / sorted.length - 1, 0.5)}
                  height={h}
                  rx={1}
                  fill={KIND[column.kind].color}
                  style={{ transformBox: "fill-box", originY: 1 }}
                  initial={{ scaleY: 0 }}
                  animate={{ scaleY: seen ? 1 : 0 }}
                  transition={{ ...tween.draw, delay: Math.min(index * 0.02, 0.6) }}
                />
              </g>
            );
          })}
        </svg>
        {node}
        <p className="mt-1.5 flex items-center gap-1 text-[11px] text-ink-faint">
          <Icon name="sort" className="size-3" />
          {sorted.length} columns by % distinct, coloured by type
        </p>
      </div>
    </div>
  );
}
