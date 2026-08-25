import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Shell, ExportButton } from "../components/Shell";
import { Button, Card, Empty, Meter, Notice, Spinner } from "../components/primitives";
import { ClusterSizes, ConfusionMatrix, ImportanceBars } from "../components/charts";
import { Icon } from "../components/icons";
import { api } from "../lib/api";
import { algorithmName, count, decimal, duration, percent } from "../lib/format";
import type { ModelResult, Training } from "../lib/types";
import { useSession } from "../state/session";

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card bodyClass="px-4 py-3.5">
      <p className="text-[11px] font-semibold tracking-[0.04em] text-ink-muted uppercase">{label}</p>
      <p className="tnum mt-1 text-[26px] leading-none font-semibold">{value}</p>
      {hint && <p className="mt-1.5 text-[11px] text-ink-faint">{hint}</p>}
    </Card>
  );
}

function Leaderboard({
  training,
  selected,
  onSelect,
}: {
  training: Training;
  selected: string;
  onSelect: (algorithm: string) => void;
}) {
  const classifying = training.task.endsWith("classification");
  const best = training.results.find((item) => item.ok)?.score ?? 1;

  return (
    <Card title="Leaderboard" bodyClass="p-0">
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr className="text-[11px] font-medium text-ink-muted">
            <th className="w-12 border-b border-line px-4 py-2 text-left">#</th>
            <th className="border-b border-line px-4 py-2 text-left">Algorithm</th>
            <th className="border-b border-line px-4 py-2 text-left">{training.score_name}</th>
            {classifying && <th className="w-24 border-b border-line px-4 py-2 text-right">Accuracy</th>}
            {classifying && <th className="w-24 border-b border-line px-4 py-2 text-right">ROC AUC</th>}
            <th className="w-24 border-b border-line px-4 py-2 text-right">Fit time</th>
          </tr>
        </thead>
        <tbody>
          {training.results.map((item, index) => {
            const active = item.algorithm === selected;
            if (!item.ok) {
              return (
                <tr key={item.algorithm} className="opacity-60">
                  <td className="border-b border-line/60 px-4 py-3 text-ink-faint">—</td>
                  <td className="border-b border-line/60 px-4 py-3">{algorithmName(item.algorithm)}</td>
                  <td colSpan={classifying ? 4 : 2} className="border-b border-line/60 px-4 py-3 text-bad">
                    failed: {item.error}
                  </td>
                </tr>
              );
            }
            return (
              <tr
                key={item.algorithm}
                onClick={() => onSelect(item.algorithm)}
                className={`cursor-pointer border-l-2 hover:bg-hover ${
                  active ? "border-accent bg-accent-soft" : "border-transparent"
                }`}
              >
                <td className="tnum border-b border-line/60 px-4 py-3 text-ink-muted">{index + 1}</td>
                <td className="border-b border-line/60 px-4 py-3">
                  <span className="font-medium">{algorithmName(item.algorithm)}</span>
                  {index === 0 && (
                    <span className="ml-2 rounded-full border border-accent/40 bg-accent-soft px-2 py-[1px] text-[9px] font-semibold tracking-[0.04em] text-accent uppercase">
                      Best
                    </span>
                  )}
                </td>
                <td className="border-b border-line/60 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Meter
                      value={item.score === null ? 0 : (item.score / (best || 1)) * 100}
                      className="max-w-40"
                    />
                    <span className="tnum w-12 shrink-0 font-medium">{decimal(item.score, 3)}</span>
                  </div>
                </td>
                {classifying && (
                  <td className="tnum border-b border-line/60 px-4 py-3 text-right">
                    {decimal(item.metrics.accuracy, 3)}
                  </td>
                )}
                {classifying && (
                  <td className="tnum border-b border-line/60 px-4 py-3 text-right">
                    {decimal(item.metrics.roc_auc, 3)}
                  </td>
                )}
                <td className="tnum border-b border-line/60 px-4 py-3 text-right text-ink-muted">
                  {duration(item.fit_ms)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}

function SupervisedDetail({ result, training }: { result: ModelResult; training: Training }) {
  const classifying = training.task.endsWith("classification");
  const metrics = result.metrics;

  const tiles = classifying
    ? [
        { label: "Balanced accuracy", value: decimal(metrics.balanced_accuracy, 3), hint: "corrects for uneven classes" },
        { label: "Accuracy", value: decimal(metrics.accuracy, 3), hint: `${count(metrics.test_rows ?? 0)} holdout rows` },
        { label: "ROC AUC", value: decimal(metrics.roc_auc, 3), hint: "ranking quality, threshold-free" },
        {
          label: "Threshold",
          value: metrics.threshold === null || metrics.threshold === undefined ? "0.500" : decimal(metrics.threshold, 3),
          hint: "tuned on held-back training rows",
        },
      ]
    : [
        { label: "R²", value: decimal(metrics.r2, 4), hint: "share of variance explained" },
        { label: "MAE", value: decimal(metrics.mae, 2), hint: "average absolute error" },
        { label: "RMSE", value: decimal(metrics.rmse, 2), hint: "penalises large misses" },
        { label: "MAPE", value: metrics.mape_pct == null ? "—" : percent(metrics.mape_pct, 1), hint: "average relative error" },
      ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {tiles.map((tile) => (
          <Tile key={tile.label} {...tile} />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card title="What drove it">
          {result.importance.length > 0 ? (
            <ImportanceBars items={result.importance} />
          ) : (
            <p className="text-[13px] text-ink-muted">
              This model exposes no per-column weights, and permutation importance is only computed for the
              winner.
            </p>
          )}
        </Card>

        {classifying && metrics.confusion && metrics.labels && (
          <Card title="Where it was right and wrong">
            <ConfusionMatrix matrix={metrics.confusion} labels={metrics.labels} />
          </Card>
        )}
      </div>
    </div>
  );
}

function ClusteringDetail({ training }: { training: Training }) {
  const kmeans = training.results.find((item) => item.algorithm === "kmeans" && item.ok);
  const forest = training.results.find((item) => item.algorithm === "isolation_forest" && item.ok);
  const dbscan = training.results.find((item) => item.algorithm === "dbscan" && item.ok);
  const grouping = kmeans ?? dbscan;
  const examples = forest?.examples ?? [];
  const exampleColumns = examples.length ? Object.keys(examples[0]) : [];
  // align a whole column by its first real value -- deciding per cell puts a
  // lone null on the wrong side of an otherwise numeric column
  const numericColumn = new Set(
    exampleColumns.filter((column) =>
      typeof examples.find((row) => row[column] !== null)?.[column] === "number",
    ),
  );

  return (
    <div className="space-y-4">
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
                  <Meter value={((grouping.score ?? 0) + 1) * 50} />
                </div>
              </div>
            )}
            {forest && (
              <div className="border-t border-line pt-4">
                <div className="flex items-baseline justify-between">
                  <p className="text-[13px] font-medium">Isolation forest</p>
                  <p className="text-[11px] text-warn">Outliers</p>
                </div>
                <div className="mt-1 flex items-center gap-3">
                  <span className="tnum text-[24px] font-semibold">
                    {percent(forest.metrics.outliers_pct, 1)}
                  </span>
                  <Meter value={forest.metrics.outliers_pct ?? 0} tone="warn" />
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>

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
              {count(forest?.metrics.outliers ?? 0)} rows ({percent(forest?.metrics.outliers_pct, 1)}) do not fit
              any pattern
            </span>
          }
          bodyClass="p-3"
        >
          <div className="overflow-auto rounded-lg border border-line">
            <table className="w-full border-collapse text-[13px]">
              <thead className="bg-card-raised">
                <tr className="text-[11px] font-medium text-ink-muted">
                  {exampleColumns.map((column) => (
                    <th
                      key={column}
                      className={`border-b border-line px-3 py-2 whitespace-nowrap ${
                        column === "deviation" ? "text-right" : "text-left"
                      }`}
                    >
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {examples.map((row, index) => (
                  <tr key={index} className="hover:bg-hover">
                    {exampleColumns.map((column) => {
                      const value = row[column];
                      const isDeviation = column === "deviation";
                      return (
                        <td
                          key={column}
                          className={`border-b border-line/60 px-3 py-2 whitespace-nowrap ${
                            numericColumn.has(column) ? "tnum text-right font-mono" : "text-left"
                          } ${isDeviation ? "font-medium text-warn" : ""} ${
                            value === null ? "text-ink-faint italic" : ""
                          }`}
                        >
                          {formatCell(value)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

export function Results() {
  const { dataset, jobId, target } = useSession();
  const navigate = useNavigate();

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

  if (!dataset || !jobId) {
    return (
      <Shell>
        <Empty
          title="Nothing trained yet"
          hint={
            <>
              Pick a target and train some models —{" "}
              <button className="text-accent underline" onClick={() => navigate("/model")}>
                go to model
              </button>
              .
            </>
          }
        />
      </Shell>
    );
  }

  const detail = training?.results.find((item) => item.algorithm === selected.value) ?? null;

  return (
    <Shell
      title={training?.task === "clustering" ? "Clustering results" : "Training results"}
      subtitle={target ? `Predicting ${target}` : "No target — rows grouped by similarity"}
      actions={
        <>
          {training && <ExportButton data={training} name={`${dataset.meta.name}.results.json`} />}
          <Button onClick={() => navigate("/model")}>
            <Icon name="back" className="size-4" />
            Try another target
          </Button>
        </>
      }
    >
      {job.isPending && <Spinner label="Fetching job…" />}
      {job.error && <Notice>{(job.error as Error).message}</Notice>}

      {job.data?.state === "running" && (
        <Card>
          <Spinner label="Training models… this runs in the background, the page updates itself." />
        </Card>
      )}

      {job.data?.state === "failed" && <Notice>Training failed: {job.data.error}</Notice>}

      {training && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-lg border border-line bg-card px-4 py-3">
            <span className="grid size-6 place-items-center rounded-full border border-good/40 bg-good/10 text-good">
              <Icon name="back" className="size-3.5 -rotate-90" />
            </span>
            <p className="text-[14px]">
              {training.task === "clustering" ? "Grouped " : "Trained "}
              <span className="tnum font-semibold">{count(training.rows_used)}</span>
              {training.task === "clustering" ? " rows" : ` rows across ${training.results.length} models`} in{" "}
              <span className="tnum font-semibold">{duration(training.train_ms)}</span>
            </p>
            {training.rows_sampled && (
              <span className="ml-auto text-[12px] text-ink-faint">
                sampled from {count(dataset.meta.rows)} rows
              </span>
            )}
          </div>

          {training.task === "clustering" ? (
            <ClusteringDetail training={training} />
          ) : (
            <>
              <Leaderboard training={training} selected={selected.value} onSelect={selected.set} />
              {detail?.ok && <SupervisedDetail result={detail} training={training} />}
            </>
          )}
        </div>
      )}
    </Shell>
  );
}

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
