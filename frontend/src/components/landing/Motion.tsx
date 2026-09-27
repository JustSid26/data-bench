/** Motion graphics for the landing page: the live data field behind the hero,
 *  the pipeline a data packet travels through, and packets along arrows. All
 *  transform / opacity only, paused off screen, still for reduced motion. */
import { useEffect, useRef, useState } from "react";
import { m, useInView, useReducedMotion } from "motion/react";
import { IconTile } from "../primitives";
import type { TileTone } from "../primitives";

function useLive<T extends Element>() {
  const ref = useRef<T>(null);
  const seen = useInView(ref, { amount: 0.1 });
  const reduced = useReducedMotion();
  return [ref, Boolean(seen) && !reduced] as const;
}

/** A soft field of histogram bars that breathe, fading out toward the edges. */
export function DataField() {
  const [ref, live] = useLive<SVGSVGElement>();
  const bars = Array.from({ length: 48 }, (_, i) => {
    const base = 0.25 + 0.6 * Math.exp(-(((i - 24) / 11) ** 2));
    return { i, base, peak: Math.min(1, base + 0.18 + ((i * 37) % 11) / 40) };
  });
  return (
    <svg
      ref={ref}
      aria-hidden="true"
      viewBox="0 0 480 160"
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-x-0 bottom-0 h-[55%] w-full opacity-[0.2] [mask-image:linear-gradient(to_top,black,transparent),linear-gradient(to_right,transparent,black_20%,black_80%,transparent)] [mask-composite:intersect] dark:opacity-[0.26]"
    >
      {bars.map((bar) => (
        <m.rect
          key={bar.i}
          x={bar.i * 10 + 1}
          y={0}
          width={8}
          height={160}
          rx={2}
          fill="var(--accent)"
          style={{ originY: 1, transformBox: "fill-box" }}
          initial={{ scaleY: bar.base }}
          animate={live ? { scaleY: [bar.base, bar.peak, bar.base] } : { scaleY: bar.base }}
          transition={live ? { duration: 2.4 + (bar.i % 5) * 0.35, repeat: Infinity, ease: "easeInOut", delay: (bar.i % 7) * 0.2 } : { duration: 0 }}
        />
      ))}
    </svg>
  );
}

export const STAGES: { title: string; icon: string; tone: TileTone; text: string }[] = [
  { title: "Ingest", icon: "upload", tone: "blue", text: "Drop a CSV, Excel, Parquet or JSON file. Separators, types and blank cells are detected for you." },
  { title: "Profile", icon: "chart", tone: "teal", text: "Every column is typed and profiled: distributions, missing values, outliers, correlations, a health score." },
  { title: "Clean", icon: "wand", tone: "pink", text: "Suggested fixes per column — drop, impute, encode, clip — with the projected effect on data health." },
  { title: "Model", icon: "model", tone: "purple", text: "Pick a target; the task is inferred and suitable models proposed, each with editable hyperparameters." },
  { title: "Train", icon: "check", tone: "sky", text: "Models train side by side and are scored on rows they never saw. Export the winner as Python." },
];

/** The five stages on a track, with a packet of data travelling through them
 *  and each stage lighting up as the packet arrives. */
export function PipelineFlow() {
  const [ref, live] = useLive<HTMLDivElement>();
  const track = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const node = track.current;
    if (!node) return;
    const observer = new ResizeObserver(() => setWidth(node.clientWidth));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const n = STAGES.length;
  const CYCLE = 7.5;
  // the packet pauses at every stage: move, hold, move, hold...
  const stops = Array.from({ length: n }, (_, i) => (width * (i + 0.5)) / n);
  const xs = stops.flatMap((x) => [x, x]);
  const times = stops.flatMap((_, i) => [i / n, (i + 0.6) / n]);

  return (
    <div ref={ref}>
      <div ref={track} className="relative mb-4 hidden h-8 lg:block" aria-hidden="true">
        <div className="absolute inset-x-[10%] top-1/2 h-0.5 -translate-y-1/2 rounded-full bg-line" />
        {live && width > 0 && (
          <m.div
            className="absolute top-1/2 left-0 -mt-2.5 size-5 -translate-x-1/2 rounded-full bg-accent shadow-[0_0_0_6px_var(--accent-soft),0_0_24px_var(--accent)]"
            initial={{ x: stops[0] }}
            animate={{ x: [...xs, stops[0]] }}
            transition={{ duration: CYCLE, times: [...times, 1], repeat: Infinity, ease: "easeInOut" }}
          />
        )}
      </div>
      <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {STAGES.map((stage, i) => (
          <li key={stage.title} className="glass relative overflow-hidden rounded-card border border-line p-4">
            {live && (
              <m.span
                aria-hidden="true"
                className="absolute inset-0 rounded-card bg-accent-soft"
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 0, 1, 0, 0] }}
                transition={{ duration: CYCLE, times: [0, i / n, (i + 0.3) / n, (i + 1) / n, 1], repeat: Infinity }}
              />
            )}
            <div className="relative flex items-center justify-between">
              <IconTile icon={stage.icon} tone={stage.tone} />
              <span className="tnum text-[28px] leading-none font-bold text-ink-faint/40">{i + 1}</span>
            </div>
            <p className="relative mt-3 text-[15px] font-semibold">{stage.title}</p>
            <p className="relative mt-1 text-[13px] leading-relaxed text-ink-muted">{stage.text}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** An arrow with packets flowing along it, for the architecture diagram:
 *  downward when the diagram stacks on phones, rightward on wide screens.
 *  Plain css keyframes (index.css), so reduced motion stops them too. */
export function FlowArrow({ label }: { label: string }) {
  return (
    <div className="flex shrink-0 flex-col items-center justify-center gap-1 px-1 py-2 lg:py-0" aria-hidden="true">
      <div className="relative h-9 w-0.5 overflow-hidden rounded-full bg-line lg:h-0.5 lg:w-14">
        <span className="flow-dot" />
        <span className="flow-dot [animation-delay:0.6s]" />
      </div>
      <span className="text-[10px] font-medium tracking-[0.04em] text-ink-faint uppercase">{label}</span>
    </div>
  );
}
