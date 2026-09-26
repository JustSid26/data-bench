import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, LayoutGroup, m } from "motion/react";
import { Shell, ExportButton } from "../components/Shell";
import { Button, Card, ErrorState, QualityBadge, Skeleton, SkeletonCard } from "../components/primitives";
import { Icon } from "../components/icons";
import { HealthRing } from "../components/viz/HealthRing";
import { MiniProfile } from "../components/viz/MiniProfile";
import { CorrelationHeatmap } from "../components/viz/CorrelationHeatmap";
import { BoxPlot, HistogramSpark } from "../components/viz/Distribution";
import { MissingBars } from "../components/viz/Missing";
import { fadeUp, spring, stagger, tween } from "../lib/motion";
import { healthScore } from "../lib/insights";
import { useProfile } from "../lib/queries";
import { KIND, LEVEL_QUALITY } from "../lib/tokens";
import { count, decimal, duration, percent } from "../lib/format";
import type { Kind, Warning } from "../lib/types";
import { useSession } from "../state/session";
import { useUi } from "../state/ui";
import { NoDataset } from "./Overview";

const LEVEL_RANK = { high: 0, medium: 1, low: 2 } as const;

function WarningList({ warnings, onOpen }: { warnings: Warning[]; onOpen: (column: string) => void }) {
  const sorted = useMemo(() => [...warnings].sort((a, b) => LEVEL_RANK[a.level] - LEVEL_RANK[b.level]), [warnings]);
  if (sorted.length === 0)
    return (
      <p className="flex items-center gap-2 text-[13px] text-ink-muted">
        <Icon name="ok" className="size-4 text-good" /> Nothing looks broken in this dataset.
      </p>
    );
  return (
    <m.ul variants={stagger(0.04)} initial="hidden" whileInView="show" viewport={{ once: true }} className="-mx-1.5 space-y-0.5">
      {sorted.map((warning, index) => (
        <m.li key={index} variants={fadeUp}>
          <button
            type="button"
            disabled={!warning.column}
            onClick={() => warning.column && onOpen(warning.column)}
            className="w-full rounded-lg px-1.5 py-1.5 text-left transition-colors enabled:hover:bg-hover"
          >
            <span className="flex items-center gap-2">
              <QualityBadge quality={LEVEL_QUALITY[warning.level]}>{warning.level}</QualityBadge>
              <span className="truncate font-mono text-[12px] font-medium">{warning.column ?? "whole dataset"}</span>
              {warning.column && <Icon name="next" className="ml-auto size-3.5 shrink-0 text-ink-faint" />}
            </span>
            <span className="mt-0.5 block text-[12px] leading-relaxed text-ink-muted">{warning.issue}</span>
          </button>
        </m.li>
      ))}
    </m.ul>
  );
}

export function Analyse() {
  const { dataset } = useSession();
  const navigate = useNavigate();
  const { inspect } = useUi();
  const [filter, setFilter] = useState("");
  const [kinds, setKinds] = useState<Kind[]>([]);
  const [outlierColumn, setOutlierColumn] = useState<string | null>(null);

  const profile = useProfile(dataset?.id);
  const data = profile.data;

  const health = useMemo(() => (data ? healthScore(data) : null), [data]);
  const presentKinds = useMemo(() => [...new Set(data?.column_stats.map((c) => c.kind) ?? [])], [data]);
  const visible = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    return (data?.column_stats ?? []).filter(
      (c) => (!needle || c.name.toLowerCase().includes(needle)) && (kinds.length === 0 || kinds.includes(c.kind)),
    );
  }, [data, filter, kinds]);
  const numeric = useMemo(
    () => (data?.column_stats ?? []).filter((c) => c.kind === "numeric" && c.q1 !== undefined).sort((a, b) => (b.outliers_pct ?? 0) - (a.outliers_pct ?? 0)),
    [data],
  );
  const boxed = numeric.find((c) => c.name === outlierColumn) ?? numeric[0];

  if (!dataset) return <NoDataset />;

  return (
    <Shell
      title="Column analysis"
      subtitle={
        data
          ? `Profiled ${count(data.columns)} columns from ${count(data.sampled_rows)} ${data.sampled_rows < data.rows ? "sampled " : ""}rows in ${duration(data.profile_ms)}.`
          : "Profiling every column…"
      }
      actions={
        <>
          {data && <ExportButton data={data} name={`${dataset.meta.name}.profile.json`} />}
          <Button onClick={() => navigate("/clean")}>
            <Icon name="wand" className="size-4" />
            Clean
          </Button>
          <Button variant="primary" onClick={() => navigate("/model")}>
            <Icon name="model" className="size-4" />
            Model
          </Button>
        </>
      }
    >
      {profile.isPending && <AnalyseSkeleton />}
      {profile.error && <ErrorState error={profile.error} onRetry={() => profile.refetch()} title="Profiling failed" />}

      {data && health && (
        <div className="space-y-4">
          <m.div variants={stagger(0.06)} className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1fr)]">
            <Card title="Dataset health">
              <HealthRing health={health} size={120} showBreakdown />
              <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 border-t border-line pt-3 text-[12px] text-ink-muted">
                <span className="tnum">{percent(data.missing_cells_pct, 2)} of cells missing</span>
                <span className="tnum">{count(data.duplicate_rows)} duplicate rows</span>
                <span className="tnum">{data.correlations.length} strong correlations</span>
              </div>
            </Card>
            <Card
              title={
                <span className="flex items-center gap-2">
                  <Icon name="warn" className="size-4 text-warn" />
                  Worth fixing
                </span>
              }
              action={<span className="text-[11px] text-ink-faint">{data.warnings.length} items</span>}
              bodyClass="max-h-80 overflow-y-auto p-4"
            >
              <WarningList warnings={data.warnings} onOpen={inspect} />
            </Card>
            <Card title="Missing by column" className="lg:col-span-2 2xl:col-span-1">
              <MissingBars columns={data.column_stats} limit={8} onSelect={inspect} />
            </Card>
          </m.div>

          <section aria-labelledby="profiles-heading">
            <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 id="profiles-heading" className="text-[15px] font-semibold tracking-[-0.01em]">
                Column profiles <span className="tnum font-normal text-ink-muted">({visible.length})</span>
              </h2>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex flex-wrap gap-1" role="group" aria-label="Filter by type">
                  {presentKinds.map((kind) => {
                    const on = kinds.includes(kind);
                    return (
                      <m.button
                        key={kind}
                        type="button"
                        aria-pressed={on}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setKinds((current) => (on ? current.filter((k) => k !== kind) : [...current, kind]))}
                        className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] transition-colors ${
                          on ? `${KIND[kind].badge} font-semibold` : "border-line text-ink-muted hover:border-line-strong"
                        }`}
                      >
                        <Icon name={KIND[kind].icon} className={`size-3 ${KIND[kind].text}`} />
                        {KIND[kind].label}
                      </m.button>
                    );
                  })}
                </div>
                <label className="relative">
                  <span className="sr-only">Filter columns by name</span>
                  <Icon name="search" className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-ink-faint" />
                  <input
                    value={filter}
                    onChange={(event) => setFilter(event.target.value)}
                    placeholder="Filter columns…"
                    className="w-52 rounded-lg border border-line bg-card py-1.5 pr-3 pl-8 text-[13px] transition-shadow outline-none placeholder:text-ink-faint focus:border-accent focus:ring-4 focus:ring-accent/20"
                  />
                </label>
              </div>
            </div>

            <LayoutGroup>
              <m.div
                variants={stagger(0.035)}
                initial="hidden"
                whileInView="show"
                viewport={{ once: true, amount: 0.05 }}
                className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 min-[1800px]:grid-cols-5"
              >
                <AnimatePresence initial={false}>
                  {visible.map((column) => (
                    <MiniProfile key={column.name} column={column} onOpen={inspect} />
                  ))}
                </AnimatePresence>
              </m.div>
            </LayoutGroup>
            {visible.length === 0 && (
              <p className="py-8 text-center text-[13px] text-ink-muted">
                No column matches.{" "}
                <button type="button" className="text-accent-fg underline" onClick={() => { setFilter(""); setKinds([]); }}>
                  Clear filters
                </button>
              </p>
            )}
          </section>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <Card title="Correlations" action={<span className="text-[11px] text-ink-faint">numeric pairs, |r| ≥ 0.5</span>}>
              <CorrelationHeatmap pairs={data.correlations} onSelect={(a) => inspect(a)} />
            </Card>

            <Card
              title="Outliers & spread"
              action={
                numeric.length > 0 && (
                  <label className="flex items-center gap-2 text-[12px] text-ink-muted">
                    <span className="sr-only sm:not-sr-only">Column</span>
                    <select
                      value={boxed?.name}
                      onChange={(event) => setOutlierColumn(event.target.value)}
                      className="max-w-44 rounded-lg border border-line bg-card px-2 py-1 font-mono text-[12px] outline-none focus:border-accent focus:ring-4 focus:ring-accent/20"
                    >
                      {numeric.map((column) => (
                        <option key={column.name} value={column.name}>
                          {column.name} {(column.outliers_pct ?? 0) > 0 ? `(${percent(column.outliers_pct, 1)})` : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                )
              }
            >
              {boxed ? (
                <AnimatePresence mode="wait">
                  <m.div key={boxed.name} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={tween.base} className="space-y-4">
                    <BoxPlot column={boxed} />
                    {boxed.histogram && <HistogramSpark counts={boxed.histogram.counts} edges={boxed.histogram.edges} height={72} highlight={[boxed.q1!, boxed.q3!]} />}
                    <dl className="tnum grid grid-cols-3 gap-2 text-[12px]">
                      {[
                        ["Skew", decimal(boxed.skew, 2)],
                        ["Std", decimal(boxed.std, 2)],
                        ["IQR", decimal((boxed.q3 ?? 0) - (boxed.q1 ?? 0), 2)],
                      ].map(([label, value]) => (
                        <div key={label} className="rounded-lg border border-line bg-card-raised px-2.5 py-1.5">
                          <dt className="text-ink-faint">{label}</dt>
                          <dd className="font-medium">{value}</dd>
                        </div>
                      ))}
                    </dl>
                    <m.button type="button" whileHover={{ x: 2 }} transition={spring.snappy} onClick={() => inspect(boxed.name)} className="flex items-center gap-1 text-[12px] font-medium text-accent-fg">
                      Inspect {boxed.name} <Icon name="arrow" className="size-3.5" />
                    </m.button>
                  </m.div>
                </AnimatePresence>
              ) : (
                <p className="text-[13px] text-ink-muted">No numeric columns to draw.</p>
              )}
            </Card>
          </div>
        </div>
      )}
    </Shell>
  );
}

function AnalyseSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Profiling columns">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <SkeletonCard chart />
        <SkeletonCard lines={5} />
        <SkeletonCard lines={5} />
      </div>
      <Skeleton className="h-5 w-40" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {Array.from({ length: 8 }, (_, index) => (
          <SkeletonCard key={index} chart lines={1} />
        ))}
      </div>
    </div>
  );
}
