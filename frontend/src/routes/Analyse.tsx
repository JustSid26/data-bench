import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Shell, ExportButton } from "../components/Shell";
import { Button, Card, Meter, Notice, Spinner, TypeBadge } from "../components/primitives";
import { Histogram, MonthBars, TopValues } from "../components/charts";
import { Icon } from "../components/icons";
import { api } from "../lib/api";
import { count, decimal, duration, percent } from "../lib/format";
import type { ColumnStats, Warning } from "../lib/types";
import { useSession } from "../state/session";
import { NoDataset } from "./Overview";

const LEVEL: Record<Warning["level"], string> = {
  high: "border-bad/40 bg-bad/10 text-bad",
  medium: "border-warn/40 bg-warn/10 text-warn",
  low: "border-line bg-hover text-ink-muted",
};

function WarningList({ warnings }: { warnings: Warning[] }) {
  if (warnings.length === 0)
    return <p className="text-[13px] text-ink-muted">Nothing looks broken in this dataset.</p>;
  return (
    <ul className="space-y-3">
      {warnings.map((warning, index) => (
        <li key={index}>
          <div className="flex items-center gap-2">
            <span
              className={`rounded border px-1.5 py-[1px] text-[10px] font-semibold uppercase ${LEVEL[warning.level]}`}
            >
              {warning.level}
            </span>
            <span className="truncate font-mono text-[13px] font-medium">
              {warning.column ?? "dataset"}
            </span>
          </div>
          <p className="mt-1 text-[12px] leading-relaxed text-ink-muted">{warning.issue}</p>
        </li>
      ))}
    </ul>
  );
}

function ColumnCard({ column }: { column: ColumnStats }) {
  return (
    <Card
      title={
        <span className="block max-w-[11rem] truncate font-mono text-[13px]" title={column.name}>
          {column.name}
        </span>
      }
      action={<TypeBadge kind={column.kind} />}
      className="min-w-0"
    >
      <div className="space-y-3">
        <div className="flex items-center justify-between text-[11px] text-ink-muted">
          <span className="tnum">{count(column.unique)} unique</span>
          <span className="tnum">{percent(column.missing_pct, 1)} missing</span>
        </div>

        {column.histogram && <Histogram counts={column.histogram.counts} edges={column.histogram.edges} />}

        {column.kind === "numeric" && (
          <dl className="tnum grid grid-cols-2 gap-x-4 gap-y-1 text-[12px]">
            <Pair label="Min" value={decimal(column.min as number, 2)} />
            <Pair label="Median" value={decimal(column.median, 2)} />
            <Pair label="Max" value={decimal(column.max as number, 2)} />
            <Pair label="Mean" value={decimal(column.mean, 2)} />
            <Pair label="Std" value={decimal(column.std, 2)} />
            <Pair
              label="Outliers"
              value={String(column.outliers ?? 0)}
              tone={(column.outliers_pct ?? 0) >= 5 ? "warn" : undefined}
            />
          </dl>
        )}

        {column.top_values && <TopValues values={column.top_values} />}

        {column.by_month && (
          <>
            <div className="rounded border border-line px-2 py-1 text-center font-mono text-[11px] text-ink-muted">
              {String(column.min).slice(0, 10)} → {String(column.max).slice(0, 10)}
            </div>
            <MonthBars byMonth={column.by_month} />
          </>
        )}

        {column.kind === "text" && (
          <dl className="tnum grid grid-cols-2 gap-x-4 gap-y-1 text-[12px]">
            <Pair label="Avg length" value={String(column.avg_length ?? "—")} />
            <Pair label="Max length" value={String(column.max_length ?? "—")} />
          </dl>
        )}

        <div>
          <Meter value={100 - column.missing_pct} tone={column.missing_pct > 40 ? "bad" : "muted"} />
          <p className="mt-1.5 text-[11px] text-ink-faint italic">{column.reason}</p>
        </div>
      </div>
    </Card>
  );
}

function Pair({ label, value, tone }: { label: string; value: string; tone?: "warn" }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-ink-muted">{label}</dt>
      <dd className={tone === "warn" ? "font-medium text-warn" : ""}>{value}</dd>
    </div>
  );
}

export function Analyse() {
  const { dataset } = useSession();
  const navigate = useNavigate();
  const [filter, setFilter] = useState("");

  const profile = useQuery({
    queryKey: ["profile", dataset?.id],
    queryFn: () => api.profile(dataset!.id),
    enabled: Boolean(dataset),
  });

  const visible = useMemo(() => {
    const columns = profile.data?.column_stats ?? [];
    const needle = filter.trim().toLowerCase();
    return needle ? columns.filter((c) => c.name.toLowerCase().includes(needle)) : columns;
  }, [profile.data, filter]);

  if (!dataset) return <NoDataset />;

  return (
    <Shell
      title="Column analysis"
      subtitle={
        profile.data
          ? `Profiled ${count(profile.data.columns)} columns from ${count(profile.data.sampled_rows)} sampled rows in ${duration(profile.data.profile_ms)}.`
          : "Profiling…"
      }
      actions={
        <>
          {profile.data && <ExportButton data={profile.data} name={`${dataset.meta.name}.profile.json`} />}
          <Button variant="primary" onClick={() => navigate("/model")}>
            <Icon name="model" className="size-4" />
            Model
          </Button>
        </>
      }
    >
      {profile.isPending && <Spinner label="Profiling columns…" />}
      {profile.error && <Notice>{(profile.error as Error).message}</Notice>}

      {profile.data && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-x-5 gap-y-1 text-[12px] text-ink-muted">
              <span className="tnum">{percent(profile.data.missing_cells_pct, 2)} of cells missing</span>
              <span className="tnum">{count(profile.data.duplicate_rows)} duplicate rows</span>
            </div>
            <input
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              placeholder="Filter columns…"
              className="w-64 rounded-lg border border-line bg-card px-3 py-1.5 text-[13px] outline-none placeholder:text-ink-faint focus:border-accent focus:ring-2 focus:ring-accent/25"
            />
          </div>

          <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[19rem_minmax(0,1fr)]">
            <Card
              title={
                <span className="flex items-center gap-2">
                  <Icon name="warn" className="size-4 text-warn" />
                  Worth fixing
                </span>
              }
              action={
                <span className="text-[11px] text-ink-faint">{profile.data.warnings.length} items</span>
              }
            >
              <WarningList warnings={profile.data.warnings} />
            </Card>

            <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
              {visible.map((column) => (
                <ColumnCard key={column.name} column={column} />
              ))}
              {visible.length === 0 && (
                <p className="text-[13px] text-ink-muted">No column matches “{filter}”.</p>
              )}
            </div>
          </div>

          {profile.data.correlations.length > 0 && (
            <Card title="Moves together" bodyClass="p-0">
              <table className="w-full border-collapse text-[13px]">
                <thead>
                  <tr className="text-[11px] font-medium text-ink-muted">
                    <th className="border-b border-line px-4 py-2 text-left">Column A</th>
                    <th className="border-b border-line px-4 py-2 text-left">Column B</th>
                    <th className="w-20 border-b border-line px-4 py-2 text-right">r</th>
                    <th className="w-40 border-b border-line px-4 py-2 text-left">Strength</th>
                  </tr>
                </thead>
                <tbody>
                  {profile.data.correlations.map((pair) => (
                    <tr key={`${pair.a}-${pair.b}`} className="hover:bg-hover">
                      <td className="border-b border-line/60 px-4 py-2 font-mono">{pair.a}</td>
                      <td className="border-b border-line/60 px-4 py-2 font-mono">{pair.b}</td>
                      <td
                        className={`tnum border-b border-line/60 px-4 py-2 text-right font-medium ${
                          pair.r >= 0 ? "text-numeric" : "text-warn"
                        }`}
                      >
                        {pair.r > 0 ? "+" : ""}
                        {pair.r.toFixed(2)}
                      </td>
                      <td className="border-b border-line/60 px-4 py-2">
                        <Meter value={Math.abs(pair.r) * 100} tone={pair.r >= 0 ? "accent" : "warn"} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </div>
      )}
    </Shell>
  );
}
