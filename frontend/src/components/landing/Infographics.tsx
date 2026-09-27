/** Infographics for the landing page. Every number here is real: counts come
 *  from the code (algorithms, formats, tests) and scores from runs on public
 *  datasets with default settings, measured on held-out rows. */
import { useRef } from "react";
import { m, useInView } from "motion/react";
import { IconTile } from "../primitives";
import type { TileTone } from "../primitives";
import { CountUp, fadeUp, stagger, tween } from "../../lib/motion";

const STATS: { value: number; suffix?: string; label: string; icon: string; tone: TileTone }[] = [
  { value: 8, label: "ML algorithms", icon: "model", tone: "purple" },
  { value: 4, label: "task types detected", icon: "target", tone: "pink" },
  { value: 15, suffix: "+", label: "statistics per column", icon: "chart", tone: "teal" },
  { value: 4, label: "file formats", icon: "file", tone: "blue" },
  { value: 3, label: "AWS services", icon: "layers", tone: "sky" },
  { value: 74, label: "automated tests", icon: "ok", tone: "indigo" },
];

export function StatsStrip() {
  return (
    <m.ul variants={stagger(0.06)} className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {STATS.map((stat) => (
        <m.li key={stat.label} variants={fadeUp} className="glass rounded-card border border-line p-4">
          <IconTile icon={stat.icon} tone={stat.tone} size="sm" />
          <p className="tnum mt-3 text-[30px] leading-none font-bold tracking-[-0.02em]">
            <CountUp value={stat.value} />
            {stat.suffix}
          </p>
          <p className="mt-1.5 text-[12px] text-ink-muted">{stat.label}</p>
        </m.li>
      ))}
    </m.ul>
  );
}

/* ---------------------------------------------- how the health score is built */

const WEIGHTS = [
  { label: "Completeness", share: 40, color: "var(--kind-numeric)", text: "share of cells that are filled in" },
  { label: "Type consistency", share: 20, color: "var(--kind-categorical)", text: "no empty or constant columns" },
  { label: "Uniqueness", share: 20, color: "var(--kind-boolean)", text: "duplicate rows count double against" },
  { label: "Outliers", share: 20, color: "var(--kind-datetime)", text: "values beyond 1.5 × IQR" },
];

export function HealthRecipe() {
  const ref = useRef<SVGSVGElement>(null);
  const seen = useInView(ref, { once: true, amount: 0.4 });
  const R = 52;
  const C = 2 * Math.PI * R;
  let start = 0;
  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center">
      <div className="relative size-40 shrink-0">
        <svg ref={ref} viewBox="0 0 140 140" className="size-40 -rotate-90" role="img" aria-label="Health score weights: completeness 40%, type consistency 20%, uniqueness 20%, outliers 20%">
          <circle cx={70} cy={70} r={R} fill="none" stroke="var(--line)" strokeWidth={16} />
          {WEIGHTS.map((w, i) => {
            const length = (w.share / 100) * C - 3;
            const offset = -start;
            start += (w.share / 100) * C;
            return (
              <m.circle
                key={w.label}
                cx={70}
                cy={70}
                r={R}
                fill="none"
                stroke={w.color}
                strokeWidth={16}
                strokeDashoffset={offset}
                initial={{ strokeDasharray: `0 ${C}` }}
                animate={{ strokeDasharray: seen ? `${length} ${C}` : `0 ${C}` }}
                transition={{ ...tween.draw, delay: i * 0.18 }}
              />
            );
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[26px] leading-none font-bold">0–100</span>
          <span className="mt-1 text-[11px] text-ink-muted">health score</span>
        </div>
      </div>
      <ul className="w-full space-y-2.5">
        {WEIGHTS.map((w) => (
          <li key={w.label} className="flex items-start gap-3">
            <span className="mt-1 size-3 shrink-0 rounded-sm" style={{ background: w.color }} />
            <div className="min-w-0 flex-1">
              <p className="flex items-baseline justify-between gap-2 text-[13px] font-medium">
                {w.label}
                <span className="tnum text-ink-muted">{w.share}%</span>
              </p>
              <p className="text-[12px] text-ink-muted">{w.text}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------------------------ measured scores, as bars */

const TASK_COLOR: Record<string, string> = {
  Binary: "var(--kind-numeric)",
  "3 classes": "var(--kind-categorical)",
  Regression: "var(--kind-boolean)",
};

const SCORES = [
  { name: "Penguins", rows: "344", task: "3 classes", model: "Decision tree", score: 0.989, metric: "balanced accuracy" },
  { name: "Breast cancer (UCI)", rows: "569", task: "Binary", model: "Gradient boosting", score: 0.969, metric: "balanced accuracy" },
  { name: "California housing", rows: "20,640", task: "Regression", model: "Gradient boosting", score: 0.842, metric: "R²" },
  { name: "Titanic", rows: "891", task: "Binary", model: "Gradient boosting", score: 0.779, metric: "balanced accuracy" },
  { name: "Telco customer churn", rows: "7,043", task: "Binary", model: "Logistic regression", score: 0.766, metric: "balanced accuracy" },
  { name: "Pure random noise", rows: "3,000", task: "Binary", model: "any", score: 0.5, metric: "balanced accuracy — chance" },
];

export function ScoreChart() {
  const ref = useRef<HTMLDivElement>(null);
  const seen = useInView(ref, { once: true, amount: 0.3 });
  return (
    <div ref={ref}>
      <div className="relative">
        {/* the chance line: a classifier that guesses scores 0.5 */}
        <div className="pointer-events-none absolute inset-y-0 left-[calc(14.5rem+0.75rem)] right-[4.5rem] hidden sm:block" aria-hidden="true">
          <div className="absolute inset-y-0 left-1/2 border-l border-dashed border-line-strong" />
          <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] whitespace-nowrap text-ink-faint">0.5 = chance</span>
        </div>
        <ul className="space-y-3 pt-5">
          {SCORES.map((row, i) => (
            <li key={row.name} className="grid grid-cols-[minmax(0,1fr)_3.75rem] items-center gap-3 sm:grid-cols-[14.5rem_minmax(0,1fr)_3.75rem]">
              <div className="col-span-2 min-w-0 sm:col-span-1">
                <p className="truncate text-[13px] font-medium">{row.name}</p>
                <p className="truncate text-[11px] text-ink-muted">
                  {row.rows} rows · {row.task} · {row.model}
                </p>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-line/70" role="img" aria-label={`${row.score} ${row.metric}`}>
                <m.div
                  className="h-full origin-left rounded-full"
                  style={{ background: TASK_COLOR[row.task] }}
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: seen ? row.score : 0 }}
                  transition={{ ...tween.draw, delay: 0.1 + i * 0.1 }}
                />
              </div>
              <p className="tnum text-right text-[15px] font-semibold">{row.score === 0.5 ? "≈0.50" : row.score.toFixed(3)}</p>
            </li>
          ))}
        </ul>
      </div>
      <div className="mt-5 flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-ink-muted">
        {Object.entries(TASK_COLOR).map(([task, color]) => (
          <span key={task} className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm" style={{ background: color }} />
            {task === "Binary" ? "binary classification" : task === "3 classes" ? "multiclass" : "regression (R²)"}
          </span>
        ))}
        <span>classification = balanced accuracy · all scores on held-out rows, 0–1</span>
      </div>
    </div>
  );
}
