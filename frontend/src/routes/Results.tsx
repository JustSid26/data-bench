import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, m } from "motion/react";
import { Shell, ExportButton, download } from "../components/Shell";
import { Button, Card, Empty, ErrorState, Meter, Skeleton } from "../components/primitives";
import { Icon } from "../components/icons";
import { useToast } from "../components/ui/Toaster";
import { ConfusionMatrix, FitTimeline, ImportanceBars, MetricTile, ProgressRing, ScoreBars, useElapsed } from "../components/viz/Training";
import { useChartTooltip, TipBody } from "../components/viz/ChartTooltip";
import { CountUp, fadeUp, scaleIn, stagger, tween } from "../lib/motion";
import { api } from "../lib/api";
import { trainingReport } from "../lib/insights";
import { algorithmName, count, decimal, duration, percent } from "../lib/format";
import { formatParam } from "../lib/params";
import type { Job, ModelResult, ParamSpec, Training } from "../lib/types";
import { useSession } from "../state/session";

/** The hyperparameters a model actually ran with, plus a script export. */
function ModelSettings({ result, specs, jobId }: { result: ModelResult; specs: ParamSpec[]; jobId: string }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const values = result.params ?? {};
  const byName = new Map(specs.map((spec) => [spec.name, spec]));
  const entries = Object.entries(values);

  const exportCode = async () => {
    setBusy(true);
    try {
      const file = await api.code(jobId, result.algorithm);
      download(file.text, file.name, "text/x-python");
      toast({ tone: "good", title: "Code exported", detail: `${file.name} — runs standalone and reproduces this score.` });
    } catch (error) {
      toast({ tone: "bad", title: "Could not export code", detail: (error as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <m.div variants={fadeUp} className="glass flex flex-col gap-3 rounded-card border border-line px-4 py-3 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-medium text-ink">{algorithmName(result.algorithm)} settings</p>
        {entries.length ? (
          <ul className="mt-1.5 flex flex-wrap gap-1.5" aria-label="Hyperparameters used">
            {entries.map(([name, value]) => {
              const spec = byName.get(name);
              const custom = spec !== undefined && spec.default !== value;
              return (
                <li
                  key={name}
                  className={`rounded-full border px-2 py-0.5 font-mono text-[11px] ${custom ? "border-accent/50 bg-accent-soft text-ink" : "border-line text-ink-muted"}`}
                  title={custom ? `changed from ${formatParam(spec, spec!.default)}` : "default"}
                >
                  {name}=<span className="font-semibold">{formatParam(spec, value)}</span>
                  {custom && <span className="sr-only"> (custom)</span>}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-[12px] text-ink-muted">Trained before settings were recorded.</p>
        )}
      </div>
      <Button onClick={exportCode} disabled={busy || !result.params} className="shrink-0">
        <Icon name="download" className="size-4" />
        {busy ? "Exporting…" : "Export code (.py)"}
      </Button>
    </m.div>
  );
}

function SupervisedDetail({ result, training, specs, jobId }: { result: ModelResult; training: Training; specs: ParamSpec[]; jobId: string }) {
  const classifying = training.task.endsWith("classification");
  const metrics = result.metrics;

  return (
    <m.div key={result.algorithm} variants={stagger(0.06)} initial="hidden" animate="show" className="space-y-4">
      <ModelSettings result={result} specs={specs} jobId={jobId} />
      <m.div variants={stagger(0.06)} className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {classifying ? (
          <>
            <MetricTile label="Balanced accuracy" value={metrics.balanced_accuracy} hint="corrects for uneven classes" emphasis icon="target" tone="blue" />
            <MetricTile icon="tick" tone="teal" label="Accuracy" value={metrics.accuracy} hint={`${count(metrics.test_rows ?? 0)} holdout rows`} />
            <MetricTile icon="chart" tone="purple" label="ROC AUC" value={metrics.roc_auc} hint="ranking quality, threshold-free" />
            <MetricTile icon="sparkle" tone="pink" label="F1" value={metrics.f1} hint={metrics.threshold != null ? `threshold ${decimal(metrics.threshold, 3)}` : "default threshold"} />
          </>
        ) : (
          <>
            <MetricTile label="R²" value={metrics.r2} places={4} hint="share of variance explained" emphasis icon="target" tone="blue" />
            <MetricTile icon="kind-numeric" tone="teal" label="MAE" value={metrics.mae} places={2} hint="average absolute error" />
            <MetricTile icon="chart" tone="purple" label="RMSE" value={metrics.rmse} places={2} hint="penalises large misses" />
            <MetricTile icon="sort" tone="pink" label="MAPE" value={metrics.mape_pct ?? null} places={1} suffix="%" hint="average relative error" />
          </>
        )}
      </m.div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card title="What drove it" icon="sparkle" tone="purple" action={<span className="text-[11px] text-ink-faint">{algorithmName(result.algorithm)}</span>}>
          {result.importance.length > 0 ? (
            <ImportanceBars items={result.importance} />
          ) : (
            <p className="text-[13px] text-ink-muted">This model exposes no per-column weights, and permutation importance is only computed for the winner.</p>
          )}
        </Card>
        {classifying && metrics.confusion && metrics.labels ? (
          <Card title="Where it was right and wrong" icon="grid" tone="pink">
            <ConfusionMatrix matrix={metrics.confusion} labels={metrics.labels} />
          </Card>
        ) : (
          <Card title="Fit time">
            <FitTimeline results={training.results} />
          </Card>
        )}
      </div>
    </m.div>
  );
}

const CLUSTER_FILL = ["var(--kind-numeric)", "var(--kind-categorical)", "var(--kind-datetime)", "var(--kind-boolean)"];

function ClusterSizes({ sizes }: { sizes: { cluster: number; count: number }[] }) {
  const total = sizes.reduce((sum, item) => sum + item.count, 0) || 1;
  const { frame, bind, node } = useChartTooltip();
  // four validated hues, then fall back to neutral steps -- never generate a fifth hue
  const fill = (index: number, cluster: number) => (cluster === -1 ? "var(--line-strong)" : index < CLUSTER_FILL.length ? CLUSTER_FILL[index] : "var(--ink-faint)");
  return (
    <div className="space-y-4">
      <div ref={frame} className="relative">
        <div className="flex h-10 w-full gap-0.5 overflow-hidden rounded-lg">
          {sizes.map((item, index) => (
            <m.div
              key={item.cluster}
              {...bind(<TipBody title={item.cluster === -1 ? "Unclustered" : `Cluster ${item.cluster}`}>{count(item.count)} rows · {percent((item.count / total) * 100, 1)}</TipBody>)}
              className="h-full origin-left"
              style={{ width: `${(item.count / total) * 100}%`, background: fill(index, item.cluster) }}
              initial={{ scaleX: 0, opacity: 0 }}
              animate={{ scaleX: 1, opacity: 1 }}
              transition={{ ...tween.draw, delay: index * 0.1 }}
            />
          ))}
        </div>
        {node}
      </div>
      <ul className="flex flex-wrap gap-x-6 gap-y-2">
        {sizes.map((item, index) => (
          <li key={item.cluster} className="flex items-center gap-2 text-[12px]">
            <span className="size-2.5 rounded-sm" style={{ background: fill(index, item.cluster) }} />
            <span className="text-ink">{item.cluster === -1 ? "unclustered" : `Cluster ${item.cluster}`}</span>
            <span className="tnum text-ink-muted">{count(item.count)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ClusteringDetail({ training, job }: { training: Training; job: Job }) {
  const kmeans = training.results.find((item) => item.algorithm === "kmeans" && item.ok);
  const forest = training.results.find((item) => item.algorithm === "isolation_forest" && item.ok);
  const dbscan = training.results.find((item) => item.algorithm === "dbscan" && item.ok);
  const grouping = kmeans ?? dbscan;
  const examples = forest?.examples ?? [];
  const exampleColumns = examples.length ? Object.keys(examples[0]) : [];
  // align a whole column by its first real value -- deciding per cell puts a
  // lone null on the wrong side of an otherwise numeric column
  const numericColumn = new Set(exampleColumns.filter((column) => typeof examples.find((row) => row[column] !== null)?.[column] === "number"));

  return (
    <m.div variants={stagger(0.08)} initial="hidden" animate="show" className="space-y-4">
      <m.div variants={stagger(0.06)} className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <MetricTile label="Clusters" value={grouping?.metrics.clusters ?? grouping?.metrics.sizes?.length} places={0} hint={grouping ? algorithmName(grouping.algorithm) : undefined} emphasis />
        <MetricTile label="Silhouette" value={grouping?.score} hint="−1 … 1, higher is tighter" />
        <MetricTile label="Outliers" value={forest?.metrics.outliers_pct} places={1} suffix="%" hint={forest ? `${count(forest.metrics.outliers ?? 0)} rows` : "isolation forest not run"} />
        <MetricTile label="Rows grouped" value={training.rows_used} places={0} />
      </m.div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
        {grouping?.metrics.sizes && (
          <Card title="Cluster distribution">
            <ClusterSizes sizes={grouping.metrics.sizes} />
          </Card>
        )}
        <Card title="Algorithm performance">
          <div className="space-y-4">
            {grouping && (
              <div>
                <div className="flex items-baseline justify-between">
                  <p className="text-[13px] font-medium">{algorithmName(grouping.algorithm)}</p>
                  <p className="text-[11px] text-ink-muted">Silhouette</p>
                </div>
                <div className="mt-1 flex items-center gap-3">
                  <span className="tnum text-[24px] font-semibold">{decimal(grouping.score, 3)}</span>
                  <Meter value={((grouping.score ?? 0) + 1) * 50} label="Silhouette, rescaled to 0–100" />
                </div>
              </div>
            )}
            {forest && (
              <div className="border-t border-line pt-4">
                <div className="flex items-baseline justify-between">
                  <p className="text-[13px] font-medium">Isolation forest</p>
                  <p className="flex items-center gap-1 text-[11px] text-warn">
                    <Icon name="warn" className="size-3" /> Outliers
                  </p>
                </div>
                <div className="mt-1 flex items-center gap-3">
                  <span className="tnum text-[24px] font-semibold">{percent(forest.metrics.outliers_pct, 1)}</span>
                  <Meter value={forest.metrics.outliers_pct ?? 0} tone="warn" label="Share of rows flagged as outliers" />
                </div>
              </div>
            )}
            <div className="border-t border-line pt-4">
              <FitTimeline results={training.results} />
            </div>
          </div>
        </Card>
      </div>

      {training.results
        .filter((item) => item.ok)
        .map((item) => (
          <ModelSettings key={item.algorithm} result={item} specs={specsFor(job, item.algorithm)} jobId={job.id} />
        ))}

      {examples.length > 0 && (
        <Card
          title={
            <span className="flex items-center gap-2">
              <Icon name="warn" className="size-4 text-warn" />
              Anomalies detected
            </span>
          }
          action={
            <span className="text-[11px] text-ink-faint">
              {count(forest?.metrics.outliers ?? 0)} rows ({percent(forest?.metrics.outliers_pct, 1)}) do not fit any pattern
            </span>
          }
          bodyClass="p-3"
        >
          <div className="overflow-auto rounded-lg border border-line">
            <table className="w-full border-collapse text-[13px]">
              <thead className="sticky top-0 bg-card-raised">
                <tr className="text-[11px] font-medium text-ink-muted">
                  {exampleColumns.map((column) => (
                    <th key={column} scope="col" className={`border-b border-line px-3 py-2 whitespace-nowrap ${numericColumn.has(column) ? "text-right" : "text-left"}`}>
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {examples.map((row, index) => (
                  <m.tr key={index} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ ...tween.base, delay: 0.3 + index * 0.04 }} className="hover:bg-hover">
                    {exampleColumns.map((column) => {
                      const value = row[column];
                      return (
                        <td
                          key={column}
                          className={`border-b border-line/60 px-3 py-2 whitespace-nowrap ${numericColumn.has(column) ? "tnum text-right font-mono" : "text-left"} ${
                            column === "deviation" ? "font-medium text-warn" : ""
                          } ${value === null ? "text-ink-faint italic" : ""}`}
                        >
                          {formatCell(value)}
                        </td>
                      );
                    })}
                  </m.tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </m.div>
  );
}

/** What the job is doing while it runs: an elapsed timer, an estimated ring
 *  and the models in the queue. */
function Running({ job, onLeave }: { job: Job; onLeave: () => void }) {
  const elapsed = useElapsed(job.started, true);
  const requested = useMemo(() => {
    try {
      const stored = JSON.parse(sessionStorage.getItem(`databench.job.${job.id}`) ?? "null") as { algorithms: string[] | null; rows: number } | null;
      if (stored?.algorithms?.length) return { algorithms: stored.algorithms, rows: stored.rows };
    } catch {
      /* fall through */
    }
    return { algorithms: job.plan.algorithms.filter((a) => a.recommended).map((a) => a.name), rows: 0 };
  }, [job]);
  // a rough guess so the ring moves at a believable pace; labelled as an estimate
  const expected = Math.max(2, requested.algorithms.length * (0.6 + (requested.rows || 20_000) / 25_000));

  return (
    <m.div variants={scaleIn} initial="hidden" animate="show" exit="exit">
      <Card>
        <div className="flex flex-col items-center gap-6 py-4 md:flex-row md:items-center md:gap-10 md:px-4">
          <ProgressRing elapsed={elapsed} expected={expected} done={false} />
          <div className="w-full min-w-0 flex-1">
            <p className="text-[16px] font-semibold">Training {requested.algorithms.length} model{requested.algorithms.length === 1 ? "" : "s"}…</p>
            <p className="mt-1 text-[13px] text-ink-muted">
              This runs on the server in the background. The page updates itself — you can leave and come back.
            </p>
            <ul className="mt-4 space-y-2" aria-label="Queued models">
              {requested.algorithms.map((name, index) => (
                <m.li key={name} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ ...tween.base, delay: index * 0.08 }} className="flex items-center gap-3 text-[13px]">
                  <span className="size-3.5 animate-spin rounded-full border-2 border-line border-t-accent" style={{ animationDelay: `${index * 120}ms` }} />
                  <span className="w-40 shrink-0">{algorithmName(name)}</span>
                  <Skeleton className="h-1.5 flex-1" />
                </m.li>
              ))}
            </ul>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button variant="quiet" onClick={onLeave}>
                <Icon name="back" className="size-4" />
                Back to model (job keeps running)
              </Button>
            </div>
            <p className="mt-2 text-[11px] text-ink-faint">The api has no cancel endpoint, so a started job always runs to completion.</p>
          </div>
        </div>
      </Card>
    </m.div>
  );
}

export function Results() {
  const { dataset, jobId, target } = useSession();
  const navigate = useNavigate();
  const toast = useToast();

  const job = useQuery({
    queryKey: ["job", jobId],
    queryFn: () => api.job(jobId!),
    enabled: Boolean(jobId),
    // poll only while the job is actually running -- and keep polling when the
    // tab is in the background, otherwise a user who switches away mid-training
    // comes back to a spinner that never resolves
    refetchInterval: (query) => (query.state.data?.state === "running" ? 700 : false),
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  const training = job.data?.result ?? null;
  const first = training?.results.find((item) => item.ok)?.algorithm ?? "";
  const selected = useSelected(first);

  // announce completion once, when a job we watched running finishes
  const sawRunning = useRef(false);
  useEffect(() => {
    if (job.data?.state === "running") sawRunning.current = true;
    else if (sawRunning.current && job.data?.state === "done" && training) {
      sawRunning.current = false;
      toast({ tone: "good", title: "Training finished", detail: `${training.best ? algorithmName(training.best) : "No model"} won in ${duration(training.train_ms)}.` });
    } else if (sawRunning.current && job.data?.state === "failed") {
      sawRunning.current = false;
      toast({ tone: "bad", title: "Training failed", detail: job.data.error });
    }
  }, [job.data?.state, training, toast, job.data?.error]);

  if (!dataset || !jobId) {
    return (
      <Shell>
        <Empty
          icon="model"
          title="Nothing trained yet"
          hint="Pick a target and the models to try; results land here."
          action={
            <Button variant="primary" onClick={() => navigate("/model")}>
              Go to model
              <Icon name="arrow" className="size-4" />
            </Button>
          }
        />
      </Shell>
    );
  }

  const detail = training?.results.find((item) => item.algorithm === selected.value) ?? null;
  const failed = training?.results.filter((item) => !item.ok) ?? [];

  return (
    <Shell
      title={training?.task === "clustering" ? "Clustering results" : "Training results"}
      subtitle={target ? `Predicting ${target}` : "No target — rows grouped by similarity"}
      actions={
        <>
          {training && job.data && (
            <>
              <ExportButton data={training} name={`${dataset.meta.name}.results.json`} label="JSON" />
              <Button
                onClick={() => {
                  download(trainingReport(dataset.meta.name, job.data!.plan, training), `${dataset.meta.name}.report.md`, "text/markdown");
                  toast({ tone: "good", title: "Report downloaded", detail: `${dataset.meta.name}.report.md` });
                }}
              >
                <Icon name="report" className="size-4" />
                Download report
              </Button>
            </>
          )}
          <Button onClick={() => navigate("/model")}>
            <Icon name="back" className="size-4" />
            Try another target
          </Button>
        </>
      }
    >
      {job.isPending && <Skeleton className="h-48 w-full" />}
      {job.error && <ErrorState error={job.error} onRetry={() => job.refetch()} title="Could not fetch the job" />}

      <AnimatePresence mode="wait">
        {job.data?.state === "running" && <Running key="running" job={job.data} onLeave={() => navigate("/model")} />}
      </AnimatePresence>

      {job.data?.state === "failed" && (
        <ErrorState error={job.data.error ?? "unknown error"} title="Training failed" onRetry={() => navigate("/model")} />
      )}

      {training && (
        <m.div variants={stagger(0.08)} initial="hidden" animate="show" className="space-y-4">
          <m.div variants={fadeUp} className="flex flex-wrap items-center gap-3 rounded-card border border-good/30 bg-good/5 px-4 py-3">
            <m.span
              initial={{ scale: 0, rotate: -45 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 15, delay: 0.1 }}
              className="grid size-7 place-items-center rounded-full bg-good text-surface"
            >
              <Icon name="tick" className="size-4" />
            </m.span>
            <p className="text-[14px]">
              {training.task === "clustering" ? "Grouped " : "Trained "}
              <span className="tnum font-semibold">
                <CountUp value={training.rows_used} />
              </span>
              {training.task === "clustering" ? " rows" : ` rows across ${training.results.length} models`} in{" "}
              <span className="tnum font-semibold">{duration(training.train_ms)}</span>
              {training.best && training.task !== "clustering" && (
                <>
                  {" "}— <span className="font-semibold">{algorithmName(training.best)}</span> wins
                </>
              )}
            </p>
            {training.rows_sampled && <span className="text-[12px] text-ink-faint sm:ml-auto">sampled from {count(dataset.meta.rows)} rows</span>}
          </m.div>

          {failed.length > 0 && (
            <m.div variants={fadeUp} className="rounded-card border border-bad/30 bg-bad/5 px-4 py-2.5 text-[13px]">
              {failed.map((item) => (
                <p key={item.algorithm} className="flex items-start gap-2 text-bad">
                  <Icon name="critical" className="mt-[2px] size-4 shrink-0" />
                  <span>
                    <span className="font-medium">{algorithmName(item.algorithm)}</span> failed: <span className="text-ink-muted">{item.error}</span>
                  </span>
                </p>
              ))}
            </m.div>
          )}

          {training.task === "clustering" ? (
            <ClusteringDetail training={training} job={job.data!} />
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
                <Card title="Leaderboard" icon="chart" tone="indigo" action={<span className="text-[11px] text-ink-faint">click a model for its detail</span>}>
                  <ScoreBars results={training.results} selected={selected.value} onSelect={selected.set} scoreName={training.score_name} />
                </Card>
                <Card title="Fit time" icon="clock" tone="teal">
                  <FitTimeline results={training.results} />
                </Card>
              </div>
              <AnimatePresence mode="wait">{detail?.ok && <SupervisedDetail key={detail.algorithm} result={detail} training={training} specs={specsFor(job.data!, detail.algorithm)} jobId={job.data!.id} />}</AnimatePresence>
            </>
          )}
        </m.div>
      )}
    </Shell>
  );
}

const specsFor = (job: Job, algorithm: string) => job.plan.algorithms.find((a) => a.name === algorithm)?.params ?? [];

/** Whole numbers should read as whole numbers -- 3, not 3.00. */
function formatCell(value: string | number | boolean | null) {
  if (value === null) return "null";
  if (typeof value !== "number") return String(value);
  return Number.isInteger(value) ? String(value) : decimal(value, 2);
}

/** Keeps the row the user clicked, but follows the winner until they click one. */
function useSelected(fallback: string) {
  const [value, set] = useState(fallback);
  const [touched, setTouched] = useState(false);
  useEffect(() => {
    if (!touched && fallback) set(fallback);
  }, [fallback, touched]);
  return {
    value,
    set: (next: string) => {
      setTouched(true);
      set(next);
    },
  };
}
