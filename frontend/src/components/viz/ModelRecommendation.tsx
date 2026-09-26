import { useState } from "react";
import { AnimatePresence, m } from "motion/react";
import { Icon } from "../icons";
import { fadeUp, lift, spring, tween } from "../../lib/motion";
import { HYPERPARAMETERS, modelReasons } from "../../lib/insights";
import { algorithmName, taskName } from "../../lib/format";
import { KIND } from "../../lib/tokens";
import type { Kind, Plan, Profile } from "../../lib/types";

const TASK_ICON: Record<string, string> = {
  binary_classification: "kind-boolean",
  multiclass_classification: "kind-categorical",
  regression: "kind-numeric",
  clustering: "layers",
};

/** What the planner inferred: the task, why, and the target options as chips. */
export function TaskInference({
  plan,
  targets,
  target,
  onTarget,
}: {
  plan?: Plan;
  targets: { name: string; kind: Kind }[];
  target: string | null;
  onTarget: (name: string | null) => void;
}) {
  const options: { name: string | null; kind?: Kind }[] = [{ name: null }, ...targets];
  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 flex items-center gap-2 text-[12px] font-medium text-ink-muted">
          <Icon name="target" className="size-3.5" /> What should the model predict?
        </p>
        <div role="radiogroup" aria-label="Prediction target" className="flex flex-wrap gap-1.5">
          {options.map((option, index) => {
            const on = option.name === target;
            const token = option.kind ? KIND[option.kind] : null;
            return (
              <m.button
                key={option.name ?? "__none__"}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => onTarget(option.name)}
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.96 }}
                transition={spring.snappy}
                className={`relative flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] transition-colors ${
                  on ? "border-accent text-ink" : "border-line text-ink-muted hover:border-line-strong hover:text-ink"
                }`}
              >
                {on && <m.span layoutId="target-chip" transition={spring.soft} className="absolute inset-0 rounded-full bg-accent-soft" />}
                <span className="relative flex items-center gap-1.5">
                  {token ? <Icon name={token.icon} className={`size-3 ${token.text}`} /> : <Icon name="layers" className="size-3" />}
                  <span className={option.name ? "font-mono" : ""}>{option.name ?? "No target — find groups"}</span>
                  {index === 1 && !on && (
                    <span className="rounded-full bg-accent/15 px-1.5 text-[9px] font-semibold tracking-[0.04em] text-accent-fg uppercase">suggested</span>
                  )}
                </span>
              </m.button>
            );
          })}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {plan && (
          <m.div
            key={plan.task + (plan.target ?? "")}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={tween.base}
            className="flex items-start gap-3 rounded-lg border border-accent/30 bg-accent-soft px-3 py-2.5"
          >
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent text-accent-ink">
              <Icon name={TASK_ICON[plan.task] ?? "model"} className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="text-[14px] font-semibold">{taskName[plan.task] ?? plan.task}</p>
              <p className="text-[12px] text-ink-muted">{plan.task_reason}</p>
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** A candidate algorithm: planner rank as a bar, the planner's reason plus
 *  data-driven ones, the fixed hyperparameters, and a selection toggle. */
export function ModelCard({
  algorithm,
  rank,
  of,
  plan,
  profile,
  selected,
  onToggle,
}: {
  algorithm: Plan["algorithms"][number];
  rank: number;
  of: number;
  plan: Plan;
  profile?: Profile;
  selected: boolean;
  onToggle: () => void;
}) {
  const [open, setOpen] = useState(false);
  const reasons = modelReasons(algorithm.name, plan, profile);
  const params = HYPERPARAMETERS[algorithm.name] ?? {};
  const classifying = plan.task.endsWith("classification");
  const panel = `params-${algorithm.name}`;

  return (
    <m.div
      variants={fadeUp}
      {...lift}
      layout
      transition={spring.soft}
      className={`relative flex flex-col rounded-card border bg-card p-4 shadow-sm transition-colors ${
        selected ? "border-accent" : "border-line hover:border-line-strong"
      }`}
    >
      {selected && (
        <m.span
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="pointer-events-none absolute inset-0 rounded-card bg-accent-soft"
        />
      )}
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[14px] font-semibold">{algorithmName(algorithm.name)}</p>
          {algorithm.recommended && (
            <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-accent px-2 py-[1px] text-[9px] font-semibold tracking-[0.04em] text-accent-ink uppercase">
              <Icon name="sparkle" className="size-2.5" /> Recommended
            </span>
          )}
        </div>
        <m.button
          type="button"
          role="switch"
          aria-checked={selected}
          aria-label={`Train ${algorithmName(algorithm.name)}`}
          onClick={onToggle}
          whileTap={{ scale: 0.9 }}
          className={`relative h-5 w-9 shrink-0 rounded-full border transition-colors ${selected ? "border-accent bg-accent" : "border-line-strong bg-line"}`}
        >
          <m.span
            layout
            transition={spring.snappy}
            className={`absolute top-0.5 size-3.5 rounded-full bg-white shadow-sm ${selected ? "right-0.5" : "left-0.5"}`}
          />
        </m.button>
      </div>

      <div className="relative mt-3">
        <div className="flex items-baseline justify-between text-[11px] text-ink-muted">
          <span>Planner rank</span>
          <span className="tnum font-medium text-ink">
            #{rank} <span className="text-ink-faint">of {of}</span>
          </span>
        </div>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-line" role="img" aria-label={`Ranked ${rank} of ${of} by the planner`}>
          <m.div
            className={`h-full origin-left rounded-full ${algorithm.recommended ? "bg-accent" : "bg-ink-faint"}`}
            initial={{ scaleX: 0 }}
            whileInView={{ scaleX: (of - rank + 1) / of }}
            viewport={{ once: true }}
            transition={{ ...tween.draw, delay: rank * 0.08 }}
          />
        </div>
      </div>

      <div className="relative mt-3 flex-1">
        <p className="text-[12px] font-medium text-ink">Why this model</p>
        <ul className="mt-1 space-y-1 text-[12px] leading-relaxed text-ink-muted">
          <li className="flex gap-1.5">
            <Icon name="tick" className="mt-[3px] size-3 shrink-0 text-accent-fg" />
            {algorithm.why}
          </li>
          {reasons.map((reason) => (
            <li key={reason} className="flex gap-1.5">
              <Icon name="tick" className="mt-[3px] size-3 shrink-0 text-accent-fg" />
              {reason}
            </li>
          ))}
        </ul>
      </div>

      <button
        type="button"
        aria-expanded={open}
        aria-controls={panel}
        onClick={() => setOpen((on) => !on)}
        className="relative mt-3 flex items-center gap-1 self-start text-[12px] font-medium text-accent-fg hover:underline"
      >
        Hyperparameters
        <m.span animate={{ rotate: open ? 180 : 0 }} transition={spring.snappy}>
          <Icon name="down" className="size-3.5" />
        </m.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <m.div
            id={panel}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={tween.base}
            className="relative overflow-hidden"
          >
            <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 rounded-lg border border-line bg-card-raised p-2.5 font-mono text-[11px]">
              {Object.entries(params).map(([key, value]) => (
                <div key={key} className="contents">
                  <dt className="text-ink-faint">{key}</dt>
                  <dd className="text-right text-ink">{classifying || !value.endsWith("*") ? value.replace("*", "") : "—"}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-1.5 text-[11px] text-ink-faint">Fixed by the backend — the api does not take overrides yet.</p>
          </m.div>
        )}
      </AnimatePresence>
    </m.div>
  );
}
