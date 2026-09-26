import { useMemo, useState } from "react";
import { m } from "motion/react";
import { Icon } from "../icons";
import { useChartTooltip, TipBody } from "./ChartTooltip";
import { spring, tween } from "../../lib/motion";
import { missingMatrix } from "../../lib/insights";
import { QUALITY, missingQuality } from "../../lib/tokens";
import type { ColumnStats, Preview } from "../../lib/types";
import { percent } from "../../lib/format";

/** Rows × columns of the preview, a mark for every null. Columns reveal left
 *  to right; hovering a column highlights it and names it. */
export function MissingMatrixChart({ preview, onSelect }: { preview: Preview; onSelect?: (column: string) => void }) {
  const matrix = useMemo(() => missingMatrix(preview), [preview]);
  const { frame, bind, node } = useChartTooltip();
  const [hot, setHot] = useState<number | null>(null);
  const rows = matrix.cells.length;
  const cols = matrix.columns.length;
  const totalMissing = matrix.cells.reduce((sum, row) => sum + row.filter(Boolean).length, 0);

  if (!rows || !cols) return <p className="text-[13px] text-ink-muted">No preview rows to draw.</p>;

  // square-ish cells, but never wider than the frame allows
  const cell = 10;
  const width = cols * cell;
  const height = rows * (cell * 0.6);

  return (
    <div>
      <div ref={frame} className="relative">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
          className="h-44 w-full rounded-md"
          role="img"
          aria-label={`${totalMissing} missing cells in the first ${rows} rows across ${cols} columns`}
          onPointerLeave={() => setHot(null)}
        >
          <rect width={width} height={height} fill="var(--line)" opacity={0.35} />
          {matrix.columns.map((name, x) => (
            <m.g
              key={name}
              initial={{ opacity: 0 }}
              whileInView={{ opacity: hot === null || hot === x ? 1 : 0.35 }}
              viewport={{ once: true }}
              transition={{ opacity: { ...tween.base, delay: hot === null ? x * 0.015 : 0 } }}
              onPointerEnter={() => setHot(x)}
              onClick={() => onSelect?.(name)}
              className={onSelect ? "cursor-pointer" : undefined}
              {...bind(
                <TipBody title={<span className="font-mono">{name}</span>}>
                  {percent(matrix.rate[x] * 100, 0)} null in these {rows} rows
                </TipBody>,
              )}
            >
              {/* full-height hit target so thin columns are still easy to hover */}
              <rect x={x * cell} y={0} width={cell} height={height} fill="transparent" />
              {matrix.cells.map((row, y) =>
                row[x] ? (
                  <rect
                    key={y}
                    x={x * cell + 1}
                    y={y * cell * 0.6 + 0.5}
                    width={cell - 2}
                    height={cell * 0.6 - 1}
                    rx={1}
                    fill="var(--bad)"
                  />
                ) : null,
              )}
            </m.g>
          ))}
        </svg>
        {node}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-ink-muted">
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-bad" /> missing
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-line" /> present
        </span>
        <span className="ml-auto tnum">
          first {rows} rows{matrix.sampledColumns ? `, ${cols} of ${preview.columns.length} columns` : ""}
        </span>
      </div>
    </div>
  );
}

/** Per-column missing share, worst first. Bars grow on mount and carry a
 *  severity glyph as well as a colour. */
export function MissingBars({
  columns,
  limit = 12,
  onSelect,
}: {
  columns: ColumnStats[];
  limit?: number;
  onSelect?: (column: string) => void;
}) {
  const sorted = useMemo(
    () => [...columns].sort((a, b) => b.missing_pct - a.missing_pct).filter((column) => column.missing_pct > 0),
    [columns],
  );
  const [all, setAll] = useState(false);
  const shown = all ? sorted : sorted.slice(0, limit);

  if (!sorted.length)
    return (
      <p className="flex items-center gap-2 text-[13px] text-ink-muted">
        <Icon name="ok" className="size-4 text-good" /> Every column is complete.
      </p>
    );

  return (
    <div>
      <m.ul
        className="space-y-1"
        initial="hidden"
        whileInView="show"
        viewport={{ once: true }}
        variants={{ show: { transition: { staggerChildren: 0.04 } } }}
      >
        {shown.map((column) => {
          const quality = missingQuality(column.missing_pct);
          const token = QUALITY[quality];
          return (
            <m.li key={column.name} layout transition={spring.soft} variants={{ hidden: { opacity: 0, x: -6 }, show: { opacity: 1, x: 0 } }}>
              <button
                type="button"
                onClick={() => onSelect?.(column.name)}
                className="grid w-full grid-cols-[minmax(0,9rem)_1fr_3.5rem] items-center gap-3 rounded-md px-1.5 py-1 text-left transition-colors hover:bg-hover"
                aria-label={`${column.name}: ${percent(column.missing_pct, 1)} missing, ${token.label}`}
              >
                <span className="truncate font-mono text-[12px]" title={column.name}>
                  {column.name}
                </span>
                <span className="h-2 overflow-hidden rounded-full bg-line">
                  <m.span
                    className={`block h-full origin-left rounded-full ${token.bg}`}
                    variants={{ hidden: { scaleX: 0 }, show: { scaleX: Math.max(column.missing_pct, 1) / 100 } }}
                    transition={tween.draw}
                  />
                </span>
                <span className={`tnum flex items-center justify-end gap-1 text-[12px] ${token.text}`}>
                  <Icon name={token.icon} className="size-3" />
                  {percent(column.missing_pct, column.missing_pct < 10 ? 1 : 0)}
                </span>
              </button>
            </m.li>
          );
        })}
      </m.ul>
      {sorted.length > limit && (
        <button
          type="button"
          onClick={() => setAll((on) => !on)}
          className="mt-2 text-[12px] font-medium text-accent-fg hover:underline"
        >
          {all ? "Show fewer" : `Show all ${sorted.length}`}
        </button>
      )}
    </div>
  );
}
