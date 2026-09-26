import { m } from "motion/react";
import { Icon } from "../icons";
import { QualityBadge, TypeBadge } from "../primitives";
import { HistogramSpark, TimelineDensity, TopNBars } from "./Distribution";
import { fadeUp, lift } from "../../lib/motion";
import { missingQuality } from "../../lib/tokens";
import { compact, decimal, percent } from "../../lib/format";
import type { ColumnStats } from "../../lib/types";

function Stat({ label, value, tone }: { label: string; value: string; tone?: "warn" }) {
  return (
    <span className="inline-flex items-baseline gap-1 rounded-md border border-line bg-card-raised px-1.5 py-0.5 text-[11px]">
      <span className="text-ink-faint">{label}</span>
      <span className={`tnum font-medium ${tone === "warn" ? "text-warn" : ""}`}>{value}</span>
    </span>
  );
}

/** One column at a glance: the right chart for its kind plus its key numbers
 *  as badges. The whole card opens the column inspector. */
export function MiniProfile({ column, onOpen }: { column: ColumnStats; onOpen: (name: string) => void }) {
  const quality = missingQuality(column.missing_pct);
  const numeric = column.kind === "numeric";

  return (
    <m.article variants={fadeUp} {...lift} layout="position" className="group min-w-0">
      <button
        type="button"
        onClick={() => onOpen(column.name)}
        className="flex h-full w-full flex-col rounded-card border border-line bg-card p-4 text-left shadow-sm transition-shadow hover:border-line-strong hover:shadow-md"
        aria-label={`Inspect column ${column.name}`}
      >
        <div className="flex w-full items-start justify-between gap-2">
          <m.span layoutId={`col-name-${column.name}`} className="min-w-0 truncate font-mono text-[13px] font-medium" title={column.name}>
            {column.name}
          </m.span>
          <TypeBadge kind={column.kind} short />
        </div>

        <div className="mt-3 min-h-[5.5rem] w-full">
          {column.histogram && (
            <HistogramSpark
              counts={column.histogram.counts}
              edges={column.histogram.edges}
              height={60}
              highlight={column.q1 !== undefined && column.q3 !== undefined ? [column.q1, column.q3] : undefined}
            />
          )}
          {column.top_values && !column.histogram && <TopNBars values={column.top_values} limit={4} />}
          {column.by_month && <TimelineDensity byMonth={column.by_month} height={52} />}
          {column.kind === "text" && !column.top_values && (
            <p className="text-[12px] text-ink-muted">
              Free text, {decimal(column.avg_length ?? null, 0)} characters on average (max {column.max_length ?? "—"}).
            </p>
          )}
          {(column.kind === "identifier" || column.kind === "constant" || column.kind === "empty") && !column.top_values && (
            <p className="flex items-start gap-1.5 text-[12px] text-ink-muted">
              <Icon name="info" className="mt-[1px] size-3.5 shrink-0" />
              {column.reason}
            </p>
          )}
        </div>

        <div className="mt-3 flex w-full flex-wrap gap-1">
          {numeric && (
            <>
              <Stat label="min" value={decimal(column.min as number, 2)} />
              <Stat label="max" value={decimal(column.max as number, 2)} />
              <Stat label="mean" value={decimal(column.mean, 2)} />
              <Stat label="std" value={decimal(column.std, 2)} />
            </>
          )}
          <Stat label="unique" value={compact(column.unique)} />
          {numeric && (column.outliers_pct ?? 0) > 0 && (
            <Stat label="outliers" value={percent(column.outliers_pct, 1)} tone={(column.outliers_pct ?? 0) >= 5 ? "warn" : undefined} />
          )}
          <span className="ml-auto">
            <QualityBadge quality={quality}>{percent(column.missing_pct, column.missing_pct && column.missing_pct < 1 ? 2 : 0)} null</QualityBadge>
          </span>
        </div>
      </button>
    </m.article>
  );
}
