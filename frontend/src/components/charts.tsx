import { count, decimal, percent } from "../lib/format";
import type { Preview, TopValue } from "../lib/types";

/** Column distribution. Plain divs rather than a chart library -- these are
 *  20 bars, and shipping a plotting runtime for them is not worth the bytes. */
export function Histogram({ counts, edges }: { counts: number[]; edges: number[] }) {
  const peak = Math.max(...counts, 1);
  return (
    <div>
      <div className="flex h-20 items-end gap-[2px]">
        {counts.map((value, index) => (
          <div
            key={index}
            title={`${decimal(edges[index], 2)} – ${decimal(edges[index + 1], 2)}: ${count(value)}`}
            className="flex-1 rounded-sm bg-numeric/70 transition hover:bg-numeric"
            style={{ height: `${Math.max((value / peak) * 100, value > 0 ? 3 : 0)}%` }}
          />
        ))}
      </div>
      <div className="tnum mt-1 flex justify-between text-[10px] text-ink-faint">
        <span>{decimal(edges[0], 1)}</span>
        <span>{decimal(edges[edges.length - 1], 1)}</span>
      </div>
    </div>
  );
}

const SLICE = ["bg-categorical", "bg-categorical/80", "bg-categorical/60", "bg-categorical/45", "bg-categorical/30"];

export function TopValues({ values }: { values: TopValue[] }) {
  const shown = values.slice(0, 5);
  const covered = shown.reduce((sum, item) => sum + item.pct, 0);
  // the api only sends the top values, so recover the row count from any one of
  // them -- sizing "other" against the distinct-value count gives nonsense
  const total = values[0]?.pct ? Math.round((values[0].count / values[0].pct) * 100) : 0;
  return (
    <div className="space-y-2.5">
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-line">
        {shown.map((item, index) => (
          <div key={index} className={SLICE[index]} style={{ width: `${item.pct}%` }} />
        ))}
      </div>
      <ul className="space-y-1">
        {shown.map((item, index) => (
          <li key={index} className="flex items-center gap-2 text-[12px]">
            <span className={`size-1.5 shrink-0 rounded-full ${SLICE[index]}`} />
            <span className="truncate text-ink-muted">{String(item.value ?? "null")}</span>
            <span className="tnum ml-auto shrink-0 text-ink-faint">
              {percent(item.pct, 0)} ({count(item.count)})
            </span>
          </li>
        ))}
        {covered < 99.5 && (
          <li className="flex items-center gap-2 text-[12px]">
            <span className="size-1.5 shrink-0 rounded-full bg-ink-faint/40" />
            <span className="text-ink-faint">other</span>
            <span className="tnum ml-auto text-ink-faint">
              {percent(100 - covered, 0)} ({count(Math.max(total - shown.reduce((s, i) => s + i.count, 0), 0))})
            </span>
          </li>
        )}
      </ul>
    </div>
  );
}

export function MonthBars({ byMonth }: { byMonth: Record<string, number> }) {
  const entries = Object.entries(byMonth);
  const peak = Math.max(...entries.map(([, value]) => value), 1);
  return (
    <div>
      <div className="flex h-12 items-end gap-[2px]">
        {entries.map(([month, value]) => (
          <div
            key={month}
            title={`${month}: ${count(value)}`}
            className="flex-1 rounded-sm bg-datetime/60 transition hover:bg-datetime"
            style={{ height: `${Math.max((value / peak) * 100, 3)}%` }}
          />
        ))}
      </div>
      <div className="tnum mt-1 flex justify-between text-[10px] text-ink-faint">
        <span>{entries[0]?.[0]}</span>
        <span>{entries[entries.length - 1]?.[0]}</span>
      </div>
    </div>
  );
}

export function ImportanceBars({ items }: { items: { column: string; weight: number }[] }) {
  const peak = Math.max(...items.map((item) => item.weight), 0.0001);
  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item.column} className="grid grid-cols-[minmax(0,7rem)_1fr_2.75rem] items-center gap-3">
          <span className="truncate text-right text-[12px] text-ink-muted" title={item.column}>
            {item.column}
          </span>
          <div className="h-4 w-full overflow-hidden rounded bg-line">
            <div className="h-full rounded bg-accent" style={{ width: `${(item.weight / peak) * 100}%` }} />
          </div>
          <span className="tnum text-[12px] text-ink-muted">{percent(item.weight * 100, 0)}</span>
        </li>
      ))}
    </ul>
  );
}

/** Confusion matrix as a heatmap: correct cells indigo, mistakes red,
 *  intensity by the share of that actual row. */
export function ConfusionMatrix({ matrix, labels }: { matrix: number[][]; labels: string[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="tnum border-separate border-spacing-1 text-[12px]">
        <thead>
          <tr>
            <th />
            {labels.map((label) => (
              <th key={label} className="px-2 pb-1 text-[11px] font-medium text-ink-muted">
                pred {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matrix.map((row, y) => {
            const total = row.reduce((sum, value) => sum + value, 0) || 1;
            return (
              <tr key={y}>
                <th className="pr-2 text-right text-[11px] font-medium whitespace-nowrap text-ink-muted">
                  actual {labels[y]}
                </th>
                {row.map((value, x) => {
                  const share = value / total;
                  const right = x === y;
                  return (
                    <td key={x}>
                      <div
                        className={`min-w-[5.5rem] rounded px-3 py-3 text-center ${right ? "bg-accent" : "bg-bad"}`}
                        style={{ opacity: 0.18 + share * 0.82 }}
                      >
                        <div className="text-[15px] font-semibold text-ink">{count(value)}</div>
                        <div className="text-[10px] text-ink/70">{percent(share * 100, 1)}</div>
                      </div>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const CLUSTER = [
  "bg-accent",
  "bg-accent/75",
  "bg-accent/55",
  "bg-accent/40",
  "bg-categorical/70",
  "bg-categorical/50",
  "bg-numeric/60",
  "bg-numeric/40",
];

export function ClusterSizes({ sizes }: { sizes: { cluster: number; count: number }[] }) {
  const total = sizes.reduce((sum, item) => sum + item.count, 0) || 1;
  return (
    <div className="space-y-4">
      <div className="flex h-10 w-full overflow-hidden rounded-lg border border-line">
        {sizes.map((item, index) => (
          <div
            key={item.cluster}
            title={`cluster ${item.cluster}: ${count(item.count)}`}
            className={CLUSTER[index % CLUSTER.length]}
            style={{ width: `${(item.count / total) * 100}%` }}
          />
        ))}
      </div>
      <ul className="flex flex-wrap gap-x-6 gap-y-2">
        {sizes.map((item, index) => (
          <li key={item.cluster} className="flex items-center gap-2 text-[12px]">
            <span className={`size-2 rounded-full ${CLUSTER[index % CLUSTER.length]}`} />
            <span className="text-ink-muted">
              {item.cluster === -1 ? "unclustered" : `Cluster ${item.cluster}`}
            </span>
            <span className="tnum text-ink-faint">{count(item.count)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const isNumber = (value: unknown) => typeof value === "number";

export function DataTable({ preview, maxHeight = "26rem" }: { preview: Preview; maxHeight?: string }) {
  return (
    <div className="overflow-auto rounded-lg border border-line" style={{ maxHeight }}>
      <table className="w-full border-collapse text-[13px]">
        <thead className="sticky top-0 z-10 bg-card-raised">
          <tr>
            <th className="w-10 border-b border-line px-3 py-2 text-right text-[11px] font-medium text-ink-faint">
              #
            </th>
            {preview.columns.map((name) => (
              <th
                key={name}
                className="border-b border-line px-3 py-2 text-left text-[11px] font-medium whitespace-nowrap text-ink-muted"
              >
                {name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {preview.rows.map((row, y) => (
            <tr key={y} className="hover:bg-hover">
              <td className="tnum border-b border-line/60 px-3 py-1.5 text-right text-[11px] text-ink-faint">{y}</td>
              {row.map((value, x) => (
                <td
                  key={x}
                  className={`border-b border-line/60 px-3 py-1.5 whitespace-nowrap ${
                    isNumber(value) ? "tnum text-right font-mono" : "text-left"
                  } ${value === null ? "text-ink-faint italic" : ""}`}
                >
                  {value === null ? "null" : String(value)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
