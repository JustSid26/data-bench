import { useMemo, useState } from "react";
import { m } from "motion/react";
import { useChartTooltip, TipBody } from "./ChartTooltip";
import { tween } from "../../lib/motion";
import { correlationMatrix } from "../../lib/insights";
import type { Profile } from "../../lib/types";

/** Diverging fill: blue for positive, orange for negative, strength as opacity
 *  over a neutral base. The sign is also printed, so colour is never alone. */
function fillFor(r: number) {
  return r >= 0 ? "var(--diverge-pos)" : "var(--diverge-neg)";
}

export function CorrelationHeatmap({
  pairs,
  onSelect,
}: {
  pairs: Profile["correlations"];
  onSelect?: (a: string, b: string) => void;
}) {
  const matrix = useMemo(() => correlationMatrix(pairs), [pairs]);
  const { frame, bind, node } = useChartTooltip();
  const [hot, setHot] = useState<[number, number] | null>(null);
  const n = matrix.columns.length;

  if (n < 2) return <p className="text-[13px] text-ink-muted">No pair of numeric columns moves together strongly (|r| ≥ 0.5).</p>;

  const cell = 30;
  const label = 112;
  const size = n * cell;

  return (
    <div>
      <div ref={frame} className="relative overflow-x-auto">
        <svg
          viewBox={`0 0 ${label + size} ${label + size}`}
          className="mx-auto block w-full max-w-[36rem] min-w-[18rem]"
          role="img"
          aria-label={`Correlation matrix of ${n} columns; ${pairs.length} strong pairs`}
          onPointerLeave={() => setHot(null)}
        >
          {/* crosshair: the hovered row and column light up */}
          {hot && (
            <>
              <rect x={label} y={label + hot[0] * cell} width={size} height={cell} fill="var(--hover)" stroke="var(--line-strong)" />
              <rect x={label + hot[1] * cell} y={label} width={cell} height={size} fill="var(--hover)" stroke="var(--line-strong)" />
            </>
          )}
          {matrix.columns.map((name, i) => (
            <g key={name}>
              <text
                x={label - 6}
                y={label + i * cell + cell / 2}
                textAnchor="end"
                dominantBaseline="middle"
                fontSize={10.5}
                className="font-mono"
                fill={hot && hot[0] === i ? "var(--ink)" : "var(--ink-muted)"}
              >
                {name.length > 16 ? name.slice(0, 15) + "…" : name}
              </text>
              <text
                transform={`translate(${label + i * cell + cell / 2} ${label - 6}) rotate(-50)`}
                fontSize={10.5}
                className="font-mono"
                fill={hot && hot[1] === i ? "var(--ink)" : "var(--ink-muted)"}
              >
                {name.length > 16 ? name.slice(0, 15) + "…" : name}
              </text>
            </g>
          ))}
          {matrix.cells.map((row, y) =>
            row.map((r, x) => {
              const known = r !== null;
              const diagonal = x === y;
              const delay = (x + y) * 0.03;
              return (
                <g
                  key={`${x}-${y}`}
                  onPointerEnter={() => setHot([y, x])}
                  onClick={() => !diagonal && known && onSelect?.(matrix.columns[y], matrix.columns[x])}
                  className={!diagonal && known && onSelect ? "cursor-pointer" : undefined}
                  {...bind(
                    <TipBody title={<span className="font-mono">{diagonal ? matrix.columns[x] : `${matrix.columns[y]} × ${matrix.columns[x]}`}</span>}>
                      {diagonal ? "itself" : known ? `r = ${r! > 0 ? "+" : ""}${r!.toFixed(2)} (${Math.abs(r!) >= 0.8 ? "strong" : "moderate"} ${r! > 0 ? "positive" : "negative"})` : "|r| < 0.5 — weak or none"}
                    </TipBody>,
                  )}
                >
                  <rect x={label + x * cell + 1} y={label + y * cell + 1} width={cell - 2} height={cell - 2} rx={3} fill="var(--line)" opacity={0.45} />
                  {known && !diagonal && (
                    <m.rect
                      x={label + x * cell + 1}
                      y={label + y * cell + 1}
                      width={cell - 2}
                      height={cell - 2}
                      rx={3}
                      fill={fillFor(r!)}
                      style={{ transformBox: "fill-box", originX: 0.5, originY: 0.5 }}
                      initial={{ scale: 0, opacity: 0 }}
                      whileInView={{ scale: 1, opacity: 0.25 + Math.abs(r!) * 0.75 }}
                      viewport={{ once: true }}
                      transition={{ ...tween.slow, delay }}
                    />
                  )}
                  {diagonal && <rect x={label + x * cell + 1} y={label + y * cell + 1} width={cell - 2} height={cell - 2} rx={3} fill="var(--line-strong)" />}
                  {known && !diagonal && (
                    <text
                      x={label + x * cell + cell / 2}
                      y={label + y * cell + cell / 2}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize={9}
                      className="tnum pointer-events-none"
                      fill={Math.abs(r!) > 0.7 ? "#fff" : "var(--ink)"}
                    >
                      {(r! > 0 ? "+" : "−") + Math.abs(r!).toFixed(1).replace(/^0/, "")}
                    </text>
                  )}
                </g>
              );
            }),
          )}
        </svg>
        {node}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-ink-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-10 rounded-sm" style={{ background: "linear-gradient(90deg, var(--diverge-neg), var(--line) 50%, var(--diverge-pos))" }} />
          −1 … +1
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-line" /> weak (|r| &lt; 0.5, not reported)
        </span>
        {onSelect && <span className="ml-auto">click a cell to inspect the pair</span>}
      </div>
    </div>
  );
}
