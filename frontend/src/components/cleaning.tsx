import { useCallback } from "react";
import { Icon } from "./icons";
import { useToast } from "./ui/Toaster";
import { healthScore, projectColumn, projectProfile } from "../lib/insights";
import type { Fix, RecipeStep } from "../lib/insights";
import { percent } from "../lib/format";
import type { ColumnStats, Profile } from "../lib/types";
import { useCleaning } from "../state/cleaning";

/** Before → after for the one stat a step changes, plus the projected health. */
export function StatDiff({ label, before, after }: { label: string; before: string; after: string }) {
  return (
    <span className="tnum inline-flex items-center gap-1.5">
      <span className="text-ink-muted">{label}</span>
      <span className="text-ink-faint line-through">{before}</span>
      <Icon name="arrow" className="size-3 text-good" />
      <span className="font-semibold text-ink">{after}</span>
    </span>
  );
}

function describeChange(before: ColumnStats | null, after: ColumnStats | null, fix: Fix) {
  if (!after) return <span>column will be dropped before training</span>;
  if (before && after.missing_pct !== before.missing_pct)
    return <StatDiff label="missing" before={percent(before.missing_pct, 1)} after={percent(after.missing_pct, 0)} />;
  if (before && (after.outliers_pct ?? 0) !== (before.outliers_pct ?? 0))
    return <StatDiff label="outliers" before={percent(before.outliers_pct ?? 0, 1)} after={percent(after.outliers_pct ?? 0, 0)} />;
  if (before && after.kind !== before.kind) return <StatDiff label="type" before={before.kind} after={after.kind} />;
  return <span>{fix.why}</span>;
}

/** Stage a fix with instant feedback: a toast with the before/after diff and
 *  an undo. Returns the staged step. */
export function useApplyFix(profile: Profile | undefined) {
  const { steps, add, remove } = useCleaning();
  const toast = useToast();

  return useCallback(
    (column: ColumnStats, fix: Fix) => {
      const replacing = steps.filter((s) => !(s.column === column.name && s.action === fix.action));
      const step = add(column.name, fix);
      const next = [...replacing, step];
      const before = projectColumn(column, replacing);
      const after = projectColumn(column, next);
      const scores = profile
        ? [healthScore(profile, projectProfile(profile, replacing)).score, healthScore(profile, projectProfile(profile, next)).score]
        : null;
      toast({
        tone: "good",
        title: `${fix.label} · ${column.name}`,
        detail: (
          <span className="flex flex-col gap-0.5">
            {describeChange(before, after, fix)}
            {scores && scores[0] !== scores[1] && <StatDiff label="health (projected)" before={String(scores[0])} after={String(scores[1])} />}
          </span>
        ),
        action: { label: "Undo", run: () => remove(step.id) },
      });
      return step;
    },
    [steps, add, remove, profile, toast],
  );
}

/** Remove a staged step with an undo toast. */
export function useRemoveStep() {
  const { remove, restore } = useCleaning();
  const toast = useToast();
  return useCallback(
    (step: RecipeStep) => {
      remove(step.id);
      toast({ title: `Removed "${step.label}" on ${step.column}`, action: { label: "Undo", run: () => restore(step) } });
    },
    [remove, restore, toast],
  );
}
