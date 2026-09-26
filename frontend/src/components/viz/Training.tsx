import { useEffect, useState } from "react";
import { m } from "motion/react";
import { Icon } from "../icons";
import { IconTile } from "../primitives";
import type { TileTone } from "../primitives";
import { useChartTooltip, TipBody } from "./ChartTooltip";
import { CountUp, fadeUp, spring, tween } from "../../lib/motion";
import { algorithmName, count, duration, percent } from "../../lib/format";
import type { ModelResult } from "../../lib/types";

/** Seconds since `startedAt` (epoch seconds), ticking. */
export function useElapsed(startedAt: number | undefined, running: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [running]);
  return startedAt ? Math.max(0, now / 1000 - startedAt) : 0;
}

/** Progress ring for a running job. The api reports no progress, so the arc
 *  is an estimate that eases toward -- never reaches -- 100% until the job is
 *  done; the elapsed time in the middle is real. */
export function ProgressRing({ elapsed, expected, done, size = 148 }: { elapsed: number; expected: number; done: boolean; size?: number }) {
  const stroke = 10;
  const r = (size - stroke) / 2;
  // 1 - e^(-t/τ): about 63% at the expected time, then slows, never 100%
  const estimate = done ? 1 : 1 - Math.exp(-elapsed / Math.max(expected, 1));
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth={stroke} />
        <m.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={done ? "var(--good)" : "var(--accent)"}
          strokeWidth={stroke}
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: Math.max(estimate, 0.02) }}
          transition={spring.settle}
        />
      </svg>
      {!done && (
        <m.span
          aria-hidden="true"
          className="absolute inset-0 rounded-full border-2 border-accent/30"
          animate={{ scale: [1, 1.06, 1], opacity: [0.6, 0, 0.6] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        />
      )}
      <div className="absolute inset-0 flex flex-col items-center justify-center" role="timer" aria-live="off">
        <span className="tnum text-[26px] leading-none font-semibold">{elapsed.toFixed(1)}s</span>
        <span className="mt-1 text-[11px] text-ink-muted">{done ? "finished" : `~${Math.round(estimate * 100)}% (est.)`}</span>
      </div>
    </div>
  );
}

/** A headline metric that counts up. */
export function MetricTile({
  label,
  value,
  places = 3,
  suffix = "",
  hint,
  emphasis = false,
  icon,
  tone = "blue",
}: {
  label: string;
  value: number | null | undefined;
  places?: number;
  suffix?: string;
  hint?: string;
  emphasis?: boolean;
  icon?: string;
  tone?: TileTone;
}) {
  return (
    <m.div
      variants={fadeUp}
      className={`glass rounded-card border px-4 py-3.5 ${emphasis ? "border-accent/50 ring-1 ring-accent/30" : "border-line"}`}
    >
      <div className="flex items-center gap-2">
        {icon && <IconTile icon={icon} tone={tone} size="sm" />}
        <p className="text-[11px] font-semibold tracking-[0.04em] text-ink-muted uppercase">{label}</p>
      </div>
      <p className="tnum mt-1 text-[26px] leading-none font-semibold">
        {value === null || value === undefined || Number.isNaN(value) ? (
          "—"
        ) : (
          <CountUp value={value} format={(n) => n.toFixed(places) + suffix} />
        )}
      </p>
      {hint && <p className="mt-1.5 text-[11px] text-ink-faint">{hint}</p>}
    </m.div>
  );
}

/** Feature importance bars, growing one after another. */
export function ImportanceBars({ items, limit = 12 }: { items: { column: string; weight: number }[]; limit?: number }) {
  const shown = items.slice(0, limit);
  const peak = Math.max(...shown.map((item) => item.weight), 0.0001);
  return (
    <m.ul className="space-y-2.5" initial="hidden" whileInView="show" viewport={{ once: true }} variants={{ show: { transition: { staggerChildren: 0.06 } } }}>
      {shown.map((item) => (
        <m.li key={item.column} variants={fadeUp} className="grid grid-cols-[minmax(0,8rem)_1fr_3rem] items-center gap-3">
          <span className="truncate text-right font-mono text-[12px] text-ink-muted" title={item.column}>
            {item.column}
          </span>
          <div className="h-4 w-full overflow-hidden rounded bg-line/60">
            <m.div
              className="h-full origin-left rounded bg-accent"
              variants={{ hidden: { scaleX: 0 }, show: { scaleX: item.weight / peak } }}
              transition={tween.draw}
            />
          </div>
          <span className="tnum text-[12px] text-ink-muted">{percent(item.weight * 100, item.weight < 0.1 ? 1 : 0)}</span>
        </m.li>
      ))}
    </m.ul>
  );
}

/** Confusion matrix that fills cell by cell, row-major. Correct cells use the
 *  accent, mistakes use the critical tone, and each carries a ✓ / ✕ glyph. */
export function ConfusionMatrix({ matrix, labels }: { matrix: number[][]; labels: string[] }) {
  const { frame, bind, node } = useChartTooltip();
  const n = labels.length;
  return (
    <div ref={frame} className="relative overflow-x-auto">
      <table className="tnum border-separate border-spacing-1 text-[12px]">
        <caption className="sr-only">Confusion matrix: rows are actual classes, columns are predicted</caption>
        <thead>
          <tr>
            <th />
            {labels.map((label) => (
              <th key={label} scope="col" className="px-2 pb-1 text-[11px] font-medium text-ink-muted">
                pred {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matrix.map((row, y) => {
            const total = row.reduce((sum, value) => sum + value, 0) || 1;
            return (
              <tr key={y}>
                <th scope="row" className="pr-2 text-right text-[11px] font-medium whitespace-nowrap text-ink-muted">
                  actual {labels[y]}
                </th>
                {row.map((value, x) => {
                  const share = value / total;
                  const right = x === y;
                  return (
                    <td key={x} {...bind(<TipBody title={`actual ${labels[y]} → predicted ${labels[x]}`}>{count(value)} rows · {percent(share * 100, 1)} of this class</TipBody>)}>
                      <div className="relative min-w-[5.5rem] overflow-hidden rounded border border-line">
                        <m.div
                          className={`absolute inset-0 ${right ? "bg-accent" : "bg-bad"}`}
                          initial={{ opacity: 0, scale: 0.6 }}
                          whileInView={{ opacity: 0.12 + share * 0.7, scale: 1 }}
                          viewport={{ once: true }}
                          transition={{ ...tween.slow, delay: (y * n + x) * 0.08 }}
                        />
                        <div className="relative px-3 py-3 text-center">
                          <div className="flex items-center justify-center gap-1 text-[15px] font-semibold text-ink">
                            <Icon name={right ? "tick" : "close"} className={`size-3 ${right ? "text-accent-fg" : "text-bad"}`} />
                            {count(value)}
                          </div>
                          <div className="text-[10px] text-ink-muted">{percent(share * 100, 1)}</div>
                        </div>
                      </div>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
      {node}
    </div>
  );
}

/** How long each model took, as a staggered bar per algorithm. */
export function FitTimeline({ results }: { results: ModelResult[] }) {
  const peak = Math.max(...results.map((result) => result.fit_ms), 1);
  return (
    <m.ul className="space-y-2" initial="hidden" whileInView="show" viewport={{ once: true }} variants={{ show: { transition: { staggerChildren: 0.07 } } }}>
      {results.map((result) => (
        <m.li key={result.algorithm} variants={fadeUp} className="grid grid-cols-[minmax(0,9rem)_1fr_3.5rem] items-center gap-3 text-[12px]">
          <span className="truncate text-ink-muted">{algorithmName(result.algorithm)}</span>
          <div className="h-2 overflow-hidden rounded-full bg-line/60">
            <m.div
              className={`h-full origin-left rounded-full ${result.ok ? "bg-ink-faint" : "bg-bad"}`}
              variants={{ hidden: { scaleX: 0 }, show: { scaleX: Math.max(result.fit_ms / peak, 0.02) } }}
              transition={tween.draw}
            />
          </div>
          <span className="tnum text-right text-ink-muted">{result.ok ? duration(result.fit_ms) : "failed"}</span>
        </m.li>
      ))}
    </m.ul>
  );
}

/** Ranked scores as bars; the winner is the accent, the rest recede. */
export function ScoreBars({
  results,
  selected,
  onSelect,
  scoreName,
}: {
  results: ModelResult[];
  selected?: string;
  onSelect?: (algorithm: string) => void;
  scoreName: string;
}) {
  const ok = results.filter((result) => result.ok && result.score !== null);
  const lo = Math.min(0, ...ok.map((result) => result.score!));
  const hi = Math.max(...ok.map((result) => result.score!), 0.0001);
  return (
    <m.ul className="space-y-1" initial="hidden" whileInView="show" viewport={{ once: true }} variants={{ show: { transition: { staggerChildren: 0.08 } } }}>
      {ok.map((result, index) => {
        const active = result.algorithm === selected;
        return (
          <m.li key={result.algorithm} variants={fadeUp}>
            <button
              type="button"
              onClick={() => onSelect?.(result.algorithm)}
              aria-pressed={active}
              className={`relative grid w-full grid-cols-[1.5rem_minmax(0,10rem)_1fr_4rem] items-center gap-3 rounded-lg px-2 py-2 text-left text-[13px] transition-colors ${active ? "" : "hover:bg-hover"}`}
            >
              {active && <m.span layoutId="score-active" transition={spring.soft} className="absolute inset-0 rounded-lg bg-accent-soft ring-1 ring-accent/40" />}
              <span className="tnum relative text-ink-faint">{index + 1}</span>
              <span className="relative flex items-center gap-2 truncate font-medium">
                {algorithmName(result.algorithm)}
                {index === 0 && (
                  <span className="rounded-full border border-accent/40 bg-accent-soft px-1.5 py-[1px] text-[9px] font-semibold tracking-[0.04em] text-accent-fg uppercase">Best</span>
                )}
              </span>
              <span className="relative h-2.5 overflow-hidden rounded-full bg-line/60">
                <m.span
                  className={`block h-full origin-left rounded-full ${index === 0 ? "bg-accent" : "bg-ink-faint"}`}
                  variants={{ hidden: { scaleX: 0 }, show: { scaleX: Math.max((result.score! - lo) / (hi - lo), 0.02) } }}
                  transition={tween.draw}
                />
              </span>
              <span className="tnum relative text-right font-medium">
                <CountUp value={result.score!} format={(n) => n.toFixed(3)} />
              </span>
            </button>
          </m.li>
        );
      })}
      <li className="px-2 pt-1 text-[11px] text-ink-faint">{scoreName} on the held-out rows · higher is better</li>
    </m.ul>
  );
}
