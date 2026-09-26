import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { AnimatePresence, LayoutGroup, m } from "motion/react";
import { Shell } from "../components/Shell";
import { Button, Card, ErrorState, Notice, Skeleton, SkeletonCard } from "../components/primitives";
import { Icon } from "../components/icons";
import { ModelCard, TaskInference } from "../components/viz/ModelRecommendation";
import { fadeUp, spring, stagger, tween } from "../lib/motion";
import { api } from "../lib/api";
import { usePlan, useProfile } from "../lib/queries";
import { KIND } from "../lib/tokens";
import { compact, count, decimal, percent } from "../lib/format";
import type { Plan } from "../lib/types";
import { useSession } from "../state/session";
import { NoDataset } from "./Overview";

// mirrors backend/ads/train.py: MAX_TRAIN_ROWS and TEST_SIZE
const DEFAULT_ROWS = 100_000;
const TEST_SHARE = 0.2;
const TONES = ["bg-accent", "bg-datetime", "bg-categorical", "bg-numeric", "bg-boolean"];

function TargetDistribution({ plan }: { plan: Plan }) {
  const summary = plan.target_summary;
  if (summary.kind === "numeric") {
    return (
      <dl className="tnum grid grid-cols-2 gap-2 text-[13px]">
        {(["min", "max", "mean", "std"] as const).map((key) => (
          <m.div key={key} variants={fadeUp} className="rounded-xl border border-line bg-hover px-3 py-2">
            <dt className="text-[11px] text-ink-muted capitalize">{key}</dt>
            <dd className="font-medium">{decimal(summary[key], 2)}</dd>
          </m.div>
        ))}
      </dl>
    );
  }
  const distribution = summary.distribution ?? [];
  const total = distribution.reduce((sum, item) => sum + item.count, 0) || 1;
  return (
    <div className="space-y-3">
      <div className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full" role="img" aria-label={distribution.map((item) => `${item.value} ${percent((item.count / total) * 100, 0)}`).join(", ")}>
        {distribution.map((item, index) => (
          <m.div
            key={item.value}
            className={`h-full origin-left ${TONES[index % TONES.length]}`}
            style={{ width: `${(item.count / total) * 100}%` }}
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ ...tween.draw, delay: index * 0.1 }}
          />
        ))}
      </div>
      <ul className="flex flex-wrap gap-x-5 gap-y-1.5">
        {distribution.slice(0, 8).map((item, index) => (
          <li key={item.value} className="flex items-center gap-2 text-[12px]">
            <span className={`size-2 rounded-full ${TONES[index % TONES.length]}`} />
            <span className="text-ink">{item.value}</span>
            <span className="tnum text-ink-muted">{percent((item.count / total) * 100, 0)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Training-rows slider bound to the api's `max_rows`, with the 80/20
 *  train/test split drawn live underneath. */
function RowBudget({ rows, value, onChange, supervised }: { rows: number; value: number; onChange: (value: number) => void; supervised: boolean }) {
  const min = Math.min(rows, 500);
  const used = Math.min(value, rows);
  const test = supervised ? Math.round(used * TEST_SHARE) : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor="rows" className="text-[13px] font-medium">
          Rows to train on
        </label>
        <span className="tnum text-[13px] font-semibold">
          {count(used)} <span className="font-normal text-ink-muted">of {count(rows)}</span>
        </span>
      </div>
      <input
        id="rows"
        type="range"
        min={min}
        max={rows}
        step={Math.max(1, Math.round(rows / 200))}
        value={used}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-3 w-full accent-[var(--accent)]"
        aria-valuetext={`${count(used)} rows`}
      />
      <div className="mt-3 flex h-7 overflow-hidden rounded-lg text-[11px] font-medium" aria-hidden="true">
        <m.div layout transition={spring.soft} className="flex items-center justify-center bg-accent text-accent-ink" style={{ flexGrow: used - test }}>
          train {compact(used - test)}
        </m.div>
        {supervised && (
          <m.div layout transition={spring.soft} className="flex items-center justify-center bg-warn/80 text-surface" style={{ flexGrow: test, minWidth: "4.5rem" }}>
            test {compact(test)}
          </m.div>
        )}
        {rows > used && (
          <m.div layout transition={spring.soft} className="flex items-center justify-center bg-line text-ink-muted" style={{ flexGrow: rows - used, minWidth: "3.5rem" }}>
            unused
          </m.div>
        )}
      </div>
      <p className="mt-1.5 text-[11px] text-ink-faint">
        {supervised ? "20% of the rows are held back to score each model (fixed by the backend)." : "Clustering uses every sampled row; there is no holdout."} Fewer rows train faster.
      </p>
    </div>
  );
}

export function Model() {
  const { dataset, target, setTarget, setJobId } = useSession();
  const navigate = useNavigate();
  const [chosen, setChosen] = useState<string[] | null>(null);
  const [budget, setBudget] = useState(() => Math.min(dataset?.meta.rows ?? DEFAULT_ROWS, DEFAULT_ROWS));

  const plan = usePlan(dataset?.id, target);
  const profile = useProfile(dataset?.id);

  // whenever the plan changes, fall back to whatever it recommends
  useEffect(() => {
    if (plan.data) setChosen(plan.data.algorithms.filter((a) => a.recommended).map((a) => a.name));
  }, [plan.data]);

  const start = useMutation({
    mutationFn: () => api.train(dataset!.id, { target, algorithms: chosen ?? undefined, max_rows: budget }),
    onSuccess: (started) => {
      // the job record does not echo back what was asked for; keep it for the progress screen
      try {
        sessionStorage.setItem(`databench.job.${started.job}`, JSON.stringify({ algorithms: chosen, rows: Math.min(budget, dataset!.meta.rows) }));
      } catch {
        /* progress screen falls back to the plan's recommendations */
      }
      setJobId(started.job);
      navigate("/results");
    },
  });

  const features = plan.data?.features;
  const used = useMemo(() => (features ? [...features.numeric, ...features.categorical, ...features.temporal] : []), [features]);

  if (!dataset) return <NoDataset />;
  const kindOf = (name: string) => dataset.schema.find((c) => c.name === name)?.kind ?? "text";
  const supervised = plan.data ? plan.data.task !== "clustering" : Boolean(target);

  return (
    <Shell title="Model configuration" subtitle="Choose what to predict, check the features, pick the algorithms.">
      <div className="space-y-4">
        <Card>
          <TaskInference plan={plan.data} targets={dataset.suggested_targets} target={target} onTarget={setTarget} />
          {plan.isFetching && !plan.data && <Skeleton className="mt-4 h-14 w-full" />}
        </Card>

        {plan.error && <ErrorState error={plan.error} onRetry={() => plan.refetch()} title="Could not plan this target" />}
        {plan.isPending && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }, (_, index) => (
              <SkeletonCard key={index} lines={4} />
            ))}
          </div>
        )}

        {plan.data && (
          <>
            <m.div variants={stagger(0.06)} initial="hidden" animate="show" className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] 2xl:grid-cols-[minmax(0,22rem)_minmax(0,1fr)_minmax(0,24rem)]">
              <Card title={plan.data.target ? "Target distribution" : "No target"} icon="target" tone="pink">
                {plan.data.target ? (
                  <m.div variants={stagger(0.05)} initial="hidden" animate="show" className="space-y-4">
                    <TargetDistribution plan={plan.data} />
                    {plan.data.notes.map((note) => (
                      <Notice key={note} tone="warn">
                        {note}
                      </Notice>
                    ))}
                  </m.div>
                ) : (
                  <p className="text-[13px] text-ink-muted">Rows will be grouped into clusters and the odd ones flagged as outliers.</p>
                )}
              </Card>

              <Card icon="layers" tone="indigo" title={`Features (${used.length})`} action={features && features.dropped.length > 0 && <span className="text-[11px] text-ink-faint">{features.dropped.length} left out</span>}>
                <LayoutGroup>
                  <ul className="flex flex-wrap gap-1.5" aria-label="Feature columns">
                    <AnimatePresence initial={false}>
                      {used.map((name, index) => {
                        const token = KIND[kindOf(name)];
                        return (
                          <m.li
                            key={name}
                            layout
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1, transition: { ...spring.snappy, delay: Math.min(index * 0.015, 0.4) } }}
                            exit={{ opacity: 0, scale: 0.8, transition: tween.fast }}
                            className="inline-flex items-center gap-1.5 rounded-full border border-line bg-hover px-2.5 py-1 font-mono text-[12px]"
                          >
                            <Icon name={token.icon} className={`size-3 ${token.text}`} />
                            {name}
                            <span className="sr-only">({token.label})</span>
                          </m.li>
                        );
                      })}
                    </AnimatePresence>
                  </ul>
                </LayoutGroup>
                {used.length === 0 && <p className="text-[13px] text-ink-muted">No usable feature columns.</p>}
                {features && features.dropped.length > 0 && (
                  <details className="group mt-4 text-[12px]">
                    <summary className="flex cursor-pointer list-none items-center gap-1 text-ink-muted hover:text-ink">
                      <Icon name="next" className="size-3.5 transition-transform group-open:rotate-90" />
                      Not used ({features.dropped.length})
                    </summary>
                    <ul className="mt-2 space-y-1 pl-5">
                      {features.dropped.map((item) => (
                        <li key={item.name} className="text-ink-faint">
                          <span className="font-mono text-ink-muted line-through">{item.name}</span> — {item.why}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </Card>

              <Card title="Training data" icon="sort" tone="teal" className="lg:col-span-2 2xl:col-span-1">
                <RowBudget rows={dataset.meta.rows} value={budget} onChange={setBudget} supervised={supervised} />
              </Card>
            </m.div>

            <section aria-labelledby="algos">
              <div className="mb-3 flex items-baseline justify-between gap-3">
                <h2 id="algos" className="text-[15px] font-semibold tracking-[-0.01em]">
                  Candidate models
                </h2>
                <span className="text-[12px] text-ink-muted">ranked by the planner for this data · {chosen?.length ?? 0} selected</span>
              </div>
              <m.div key={plan.data.task} variants={stagger(0.07)} initial="hidden" animate="show" className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {plan.data.algorithms.map((algorithm, index) => {
                  const on = (chosen ?? []).includes(algorithm.name);
                  return (
                    <ModelCard
                      key={algorithm.name}
                      algorithm={algorithm}
                      rank={index + 1}
                      of={plan.data.algorithms.length}
                      plan={plan.data}
                      profile={profile.data}
                      selected={on}
                      onToggle={() =>
                        setChosen((current) => {
                          const list = current ?? [];
                          return on ? list.filter((name) => name !== algorithm.name) : [...list, algorithm.name];
                        })
                      }
                    />
                  );
                })}
              </m.div>
            </section>

            <m.div variants={fadeUp} initial="hidden" animate="show" className="sticky bottom-4 z-10 mx-auto flex w-fit flex-col items-center gap-2 glass-sheet rounded-[20px] border border-line px-5 py-3">
              <Button
                variant="primary"
                className="px-8 py-2.5 text-[15px]"
                disabled={!chosen?.length || start.isPending || used.length === 0}
                onClick={() => start.mutate()}
              >
                <Icon name="play" className="size-4" />
                {start.isPending ? "Starting…" : `Train ${chosen?.length ?? 0} model${chosen?.length === 1 ? "" : "s"}`}
              </Button>
              <p className="tnum text-[12px] text-ink-faint">
                on {count(Math.min(budget, dataset.meta.rows))} rows · {used.length} features
              </p>
              {start.error && <Notice>{(start.error as Error).message}</Notice>}
            </m.div>
          </>
        )}
      </div>
    </Shell>
  );
}
