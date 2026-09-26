import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, m } from "motion/react";
import { Shell, ExportButton } from "../components/Shell";
import { Button, Card, ErrorState, Notice, SkeletonCard } from "../components/primitives";
import { Icon } from "../components/icons";
import { useApplyFix, useRemoveStep } from "../components/cleaning";
import { HealthRing } from "../components/viz/HealthRing";
import { CountUp, fadeUp, spring, stagger, tween } from "../lib/motion";
import { healthScore, projectProfile, suggestFixes } from "../lib/insights";
import type { CleanAction } from "../lib/insights";
import { useProfile } from "../lib/queries";
import { LEVEL_QUALITY, QUALITY, scoreQuality } from "../lib/tokens";
import { useCleaning } from "../state/cleaning";
import { useSession } from "../state/session";
import { useUi } from "../state/ui";
import { NoDataset } from "./Overview";

const ACTION_ICON: Record<CleanAction, string> = {
  drop: "trash",
  impute: "droplet",
  cast: "kind-categorical",
  encode: "layers",
  scale: "sort",
  log: "chart",
  clip: "filter",
};

/** A staged cleaning recipe. Suggestions come from the profile; every step
 *  shows its projected effect on dataset health. Nothing here changes the
 *  data yet -- there is no cleaning endpoint -- so the page says so plainly. */
export function Clean() {
  const { dataset } = useSession();
  const navigate = useNavigate();
  const { inspect } = useUi();
  const profile = useProfile(dataset?.id);
  const { steps, clear, has } = useCleaning();
  const apply = useApplyFix(profile.data);
  const removeStep = useRemoveStep();

  const before = useMemo(() => (profile.data ? healthScore(profile.data) : null), [profile.data]);
  const after = useMemo(() => (profile.data ? healthScore(profile.data, projectProfile(profile.data, steps)) : null), [profile.data, steps]);

  // the single most useful fix per column, for columns the profiler flagged first
  const suggestions = useMemo(() => {
    if (!profile.data) return [];
    const flagged = new Map(profile.data.warnings.filter((w) => w.column).map((w) => [w.column!, w.level]));
    return profile.data.column_stats
      .map((column) => ({ column, fix: suggestFixes(column).find((fix) => fix.action === "drop" || fix.action === "impute" || fix.action === "clip" || fix.action === "cast"), level: flagged.get(column.name) }))
      .filter((item) => item.fix && !has(item.column.name, item.fix.action))
      .sort((a, b) => (a.level ? ["high", "medium", "low"].indexOf(a.level) : 3) - (b.level ? ["high", "medium", "low"].indexOf(b.level) : 3))
      .slice(0, 12);
  }, [profile.data, has]);

  if (!dataset) return <NoDataset />;

  return (
    <Shell
      title="Clean"
      subtitle="Stage fixes, see what they would do, export the recipe."
      actions={
        <>
          {steps.length > 0 && (
            <Button variant="quiet" onClick={clear}>
              Clear all
            </Button>
          )}
          <ExportButton data={{ dataset: dataset.meta.name, steps }} name={`${dataset.meta.name}.recipe.json`} label="Export recipe" />
          <Button variant="primary" onClick={() => navigate("/model")}>
            <Icon name="model" className="size-4" />
            Continue to model
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Notice tone="info">
          <strong className="font-semibold">Staged, not applied.</strong> The backend has no cleaning endpoint yet, so models still train on
          the raw data (they already impute, encode and scale internally). The numbers below are projections from the profile.
        </Notice>

        {profile.isPending && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <SkeletonCard chart />
            <SkeletonCard lines={6} />
          </div>
        )}
        {profile.error && <ErrorState error={profile.error} onRetry={() => profile.refetch()} />}

        {before && after && (
          <m.div variants={stagger(0.06)} className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
            <Card title="Projected health" icon="sparkle" tone="teal">
              <div className="flex flex-wrap items-center gap-6">
                <HealthRing health={after} size={128} />
                <div className="space-y-1">
                  <p className="text-[12px] text-ink-muted">Before → after</p>
                  <p className="tnum flex items-baseline gap-2 text-[28px] font-semibold">
                    <span className="text-ink-faint">{before.score}</span>
                    <Icon name="arrow" className="size-5 self-center text-ink-faint" />
                    <CountUp value={after.score} />
                    {after.score !== before.score && (
                      <m.span
                        key={after.score}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`text-[14px] font-semibold ${after.score > before.score ? "text-good" : "text-bad"}`}
                      >
                        {after.score > before.score ? "+" : ""}
                        {after.score - before.score}
                      </m.span>
                    )}
                  </p>
                  <p className="text-[12px] text-ink-muted">{steps.length} staged step{steps.length === 1 ? "" : "s"}</p>
                </div>
              </div>
              <ul className="mt-5 space-y-2.5">
                {after.parts.map((part, index) => {
                  const was = before.parts[index].value;
                  const quality = scoreQuality(part.value);
                  return (
                    <li key={part.key} className="text-[12px]">
                      <div className="flex items-baseline justify-between">
                        <span className="text-ink-muted">{part.label}</span>
                        <span className="tnum">
                          {Math.round(was) !== Math.round(part.value) && <span className="mr-1.5 text-ink-faint line-through">{Math.round(was)}</span>}
                          <span className="font-medium">{Math.round(part.value)}</span>
                        </span>
                      </div>
                      <div className="relative mt-1 h-1.5 overflow-hidden rounded-full bg-line">
                        <span className="absolute inset-y-0 left-0 rounded-full bg-ink-faint/40" style={{ width: `${was}%` }} />
                        <m.span className={`absolute inset-y-0 left-0 w-full origin-left rounded-full ${QUALITY[quality].bg}`} initial={false} animate={{ scaleX: part.value / 100 }} transition={spring.settle} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Card>

            <Card title="Recipe" icon="report" tone="pink" action={<span className="tnum text-[11px] text-ink-faint">{steps.length} step{steps.length === 1 ? "" : "s"}</span>}>
              {steps.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-8 text-center">
                  <span className="grid size-11 place-items-center rounded-xl border border-line bg-card-raised text-ink-muted">
                    <Icon name="wand" className="size-5" />
                  </span>
                  <p className="text-[14px] font-medium">No steps yet</p>
                  <p className="max-w-xs text-[12px] text-ink-muted">Stage a suggestion below, or use the wand on any column in the overview table or inspector.</p>
                </div>
              ) : (
                <ol className="space-y-1.5">
                  <AnimatePresence initial={false}>
                    {steps.map((step, index) => (
                      <m.li
                        key={step.id}
                        layout
                        initial={{ opacity: 0, x: -12 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 24, transition: tween.fast }}
                        transition={spring.soft}
                        className="flex items-center gap-3 rounded-xl border border-line bg-hover px-3 py-2"
                      >
                        <span className="tnum w-5 text-[11px] text-ink-faint">{index + 1}</span>
                        <Icon name={ACTION_ICON[step.action]} className={`size-4 shrink-0 ${step.action === "drop" ? "text-bad" : "text-ink-muted"}`} />
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px]">
                            <span className="font-medium">{step.label}</span>{" "}
                            <button type="button" onClick={() => inspect(step.column)} className="font-mono text-[12px] text-accent-fg hover:underline">
                              {step.column}
                            </button>
                          </p>
                          <p className="truncate text-[11px] text-ink-muted">{step.why}</p>
                        </div>
                        <button type="button" onClick={() => removeStep(step)} aria-label={`Remove ${step.label} on ${step.column}`} className="rounded-md p-1.5 text-ink-faint transition-colors hover:bg-hover hover:text-bad">
                          <Icon name="close" className="size-3.5" />
                        </button>
                      </m.li>
                    ))}
                  </AnimatePresence>
                </ol>
              )}
            </Card>
          </m.div>
        )}

        {profile.data && (
          <Card title="Suggested fixes" icon="wand" tone="violet" action={<span className="text-[11px] text-ink-faint">flagged columns first</span>}>
            {suggestions.length === 0 ? (
              <p className="flex items-center gap-2 text-[13px] text-ink-muted">
                <Icon name="ok" className="size-4 text-good" /> Nothing left to suggest.
              </p>
            ) : (
              <m.ul variants={stagger(0.03)} initial="hidden" animate="show" className="grid grid-cols-1 gap-2 md:grid-cols-2 2xl:grid-cols-3">
                <AnimatePresence initial={false}>
                  {suggestions.map(({ column, fix, level }) => (
                    <m.li key={column.name + fix!.action} layout variants={fadeUp} exit={{ opacity: 0, scale: 0.96, transition: tween.fast }} className="flex items-start gap-3 rounded-lg border border-line p-3">
                      <Icon name={ACTION_ICON[fix!.action]} className="mt-[2px] size-4 shrink-0 text-ink-muted" />
                      <div className="min-w-0 flex-1">
                        <p className="flex flex-wrap items-center gap-1.5 text-[13px]">
                          <span className="font-medium">{fix!.label}</span>
                          <button type="button" onClick={() => inspect(column.name)} className="truncate font-mono text-[12px] text-accent-fg hover:underline">
                            {column.name}
                          </button>
                          {level && (
                            <span className={`inline-flex items-center gap-0.5 text-[10px] font-semibold uppercase ${QUALITY[LEVEL_QUALITY[level]].text}`}>
                              <Icon name={QUALITY[LEVEL_QUALITY[level]].icon} className="size-3" />
                              {level}
                            </span>
                          )}
                        </p>
                        <p className="mt-0.5 text-[12px] text-ink-muted">{fix!.why}</p>
                      </div>
                      <Button className="shrink-0" onClick={() => apply(column, fix!)}>
                        Stage
                      </Button>
                    </m.li>
                  ))}
                </AnimatePresence>
              </m.ul>
            )}
          </Card>
        )}
      </div>
    </Shell>
  );
}
