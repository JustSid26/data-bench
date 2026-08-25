import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Shell } from "../components/Shell";
import { Button, Card, Notice, Spinner, TypeBadge } from "../components/primitives";
import { Icon } from "../components/icons";
import { api } from "../lib/api";
import { algorithmName, count, decimal, percent, taskName } from "../lib/format";
import type { Plan } from "../lib/types";
import { useSession } from "../state/session";
import { NoDataset } from "./Overview";

const NO_TARGET = "__none__";

function TargetDistribution({ plan }: { plan: Plan }) {
  const summary = plan.target_summary;

  if (summary.kind === "numeric") {
    return (
      <dl className="tnum grid grid-cols-2 gap-x-6 gap-y-2 text-[13px]">
        {(["min", "max", "mean", "std"] as const).map((key) => (
          <div key={key} className="flex justify-between">
            <dt className="text-ink-muted capitalize">{key}</dt>
            <dd className="font-medium">{decimal(summary[key], 2)}</dd>
          </div>
        ))}
      </dl>
    );
  }

  const distribution = summary.distribution ?? [];
  const total = distribution.reduce((sum, item) => sum + item.count, 0) || 1;
  const tones = ["bg-accent", "bg-datetime", "bg-categorical", "bg-numeric", "bg-boolean"];

  return (
    <div className="space-y-3">
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-line">
        {distribution.map((item, index) => (
          <div
            key={item.value}
            className={tones[index % tones.length]}
            style={{ width: `${(item.count / total) * 100}%` }}
            title={`${item.value}: ${count(item.count)}`}
          />
        ))}
      </div>
      <ul className="flex flex-wrap gap-x-5 gap-y-1.5">
        {distribution.slice(0, 8).map((item, index) => (
          <li key={item.value} className="flex items-center gap-2 text-[12px]">
            <span className={`size-2 rounded-full ${tones[index % tones.length]}`} />
            <span className="text-ink-muted">{item.value}</span>
            <span className="tnum text-ink-faint">{percent((item.count / total) * 100, 0)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Model() {
  const { dataset, target, setTarget, setJobId } = useSession();
  const navigate = useNavigate();
  const [chosen, setChosen] = useState<string[] | null>(null);

  const plan = useQuery({
    queryKey: ["plan", dataset?.id, target],
    queryFn: () => api.plan(dataset!.id, target),
    enabled: Boolean(dataset),
  });

  // whenever the plan changes, fall back to whatever it recommends
  useEffect(() => {
    if (plan.data) setChosen(plan.data.algorithms.filter((a) => a.recommended).map((a) => a.name));
  }, [plan.data]);

  const start = useMutation({
    mutationFn: () => api.train(dataset!.id, { target, algorithms: chosen ?? undefined }),
    onSuccess: (started) => {
      setJobId(started.job);
      navigate("/results");
    },
  });

  if (!dataset) return <NoDataset />;

  const features = plan.data?.features;
  const used = features ? [...features.numeric, ...features.categorical, ...features.temporal] : [];
  const kindOf = (name: string) => dataset.schema.find((c) => c.name === name)?.kind ?? "text";
  const trainRows = Math.min(dataset.meta.rows, 100_000);

  return (
    <Shell
      title="Model configuration"
      subtitle="Choose what to predict, then pick the algorithms to fit."
    >
      <div className="space-y-4">
        <Card>
          <div className="flex flex-wrap items-center gap-4">
            <label className="text-[13px] text-ink-muted">Predict</label>
            <select
              value={target ?? NO_TARGET}
              onChange={(event) =>
                setTarget(event.target.value === NO_TARGET ? null : event.target.value)
              }
              className="min-w-56 rounded-lg border border-line bg-card px-3 py-2 font-mono text-[13px] outline-none focus:border-accent focus:ring-2 focus:ring-accent/25"
            >
              <option value={NO_TARGET}>— no target, group the rows —</option>
              {dataset.suggested_targets.map((option) => (
                <option key={option.name} value={option.name}>
                  {option.name} ({option.kind})
                </option>
              ))}
            </select>

            {plan.data && (
              <>
                <Icon name="back" className="size-4 rotate-180 text-ink-faint" />
                <span className="rounded-lg border border-accent/40 bg-accent-soft px-3 py-2 text-[13px] font-medium">
                  {taskName[plan.data.task] ?? plan.data.task}
                </span>
                <span className="text-[12px] text-ink-muted">{plan.data.task_reason}</span>
              </>
            )}
            {plan.isPending && <Spinner />}
          </div>
        </Card>

        {plan.error && <Notice>{(plan.error as Error).message}</Notice>}

        {plan.data && (
          <>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[22rem_minmax(0,1fr)]">
              <Card title={plan.data.target ? "Target distribution" : "No target"}>
                {plan.data.target ? (
                  <div className="space-y-4">
                    <TargetDistribution plan={plan.data} />
                    {plan.data.notes.map((note) => (
                      <Notice key={note} tone="warn">
                        {note}
                      </Notice>
                    ))}
                  </div>
                ) : (
                  <p className="text-[13px] text-ink-muted">
                    Rows will be grouped into clusters and the odd ones flagged as outliers.
                  </p>
                )}
              </Card>

              <Card title={`Features included (${used.length})`}>
                <div className="flex flex-wrap gap-2">
                  {used.map((name) => (
                    <span
                      key={name}
                      className="inline-flex items-center gap-2 rounded-lg border border-line bg-card-raised px-2.5 py-1.5 font-mono text-[12px]"
                    >
                      {name}
                      <TypeBadge kind={kindOf(name)} short />
                    </span>
                  ))}
                  {used.length === 0 && (
                    <p className="text-[13px] text-ink-muted">No usable feature columns.</p>
                  )}
                </div>
                {features && features.dropped.length > 0 && (
                  <p className="mt-4 text-[12px] text-ink-faint">
                    <span className="font-medium">Not used:</span>{" "}
                    {features.dropped.map((item) => item.name).join(", ")} — {features.dropped[0].why}
                  </p>
                )}
              </Card>
            </div>

            <div>
              <h2 className="mb-2 text-[15px] font-semibold tracking-[-0.01em]">Algorithms</h2>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                {plan.data.algorithms.map((algorithm) => {
                  const on = (chosen ?? []).includes(algorithm.name);
                  return (
                    <button
                      key={algorithm.name}
                      onClick={() =>
                        setChosen((current) => {
                          const list = current ?? [];
                          return on
                            ? list.filter((name) => name !== algorithm.name)
                            : [...list, algorithm.name];
                        })
                      }
                      className={`relative rounded-lg border p-4 text-left transition ${
                        on ? "border-accent bg-accent-soft" : "border-line bg-card hover:border-line-strong"
                      }`}
                    >
                      {algorithm.recommended && (
                        <span className="absolute -top-2 right-3 rounded-full bg-accent px-2 py-[1px] text-[9px] font-semibold tracking-[0.04em] text-accent-ink uppercase">
                          Recommended
                        </span>
                      )}
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-[14px] font-medium">{algorithmName(algorithm.name)}</p>
                        <span
                          className={`mt-[2px] grid size-4 shrink-0 place-items-center rounded-full border ${
                            on ? "border-accent bg-accent text-accent-ink" : "border-line-strong"
                          }`}
                        >
                          {on && <Icon name="back" className="size-2.5 -rotate-90" />}
                        </span>
                      </div>
                      <p className="mt-1.5 text-[12px] leading-relaxed text-ink-muted">{algorithm.why}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-col items-center gap-2 pt-2">
              <Button
                variant="primary"
                className="px-8 py-2.5 text-[15px]"
                disabled={!chosen?.length || start.isPending || used.length === 0}
                onClick={() => start.mutate()}
              >
                <Icon name="play" className="size-4" />
                {start.isPending ? "Starting…" : "Train models"}
              </Button>
              <p className="tnum text-[12px] text-ink-faint">
                will train on {count(trainRows)}
                {dataset.meta.rows > trainRows ? ` of ${count(dataset.meta.rows)}` : ""} rows
              </p>
              {start.error && <Notice>{(start.error as Error).message}</Notice>}
            </div>
          </>
        )}
      </div>
    </Shell>
  );
}
