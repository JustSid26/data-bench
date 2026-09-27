import { useLayoutEffect, useRef } from "react";
import type { ReactNode } from "react";
import { IconTile, TypeBadge } from "../primitives";
import type { TileTone } from "../primitives";
import { Icon } from "../icons";
import { MissingBars } from "../viz/Missing";
import { ScoreBars } from "../viz/Training";
import { MOTION_OK, gsap } from "../../lib/gsap";
import { TITANIC_MISSING, TITANIC_SCORES } from "./data";

/* The five steps, told with the Titanic dataset from end to end. The clean
   step's projected health (91 -> 94) is DataBench's own formula: dropping
   Cabin and filling Age / Embarked takes completeness to 100%. */
const STEPS: { title: string; icon: string; tone: TileTone; lead: string; visual: ReactNode }[] = [
  {
    title: "Ingest",
    icon: "upload",
    tone: "blue",
    lead: "Drop a file. Separators, column types and blank cells are worked out for you.",
    visual: (
      <div className="flex h-full flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed border-line-strong p-6 text-center">
        <div className="flex gap-2 text-ink-muted" aria-hidden="true">
          {["file-csv", "file-sheet", "file-parquet", "file-json"].map((icon) => (
            <span key={icon} className="grid size-11 place-items-center rounded-xl border border-line bg-card">
              <Icon name={icon} className="size-5" />
            </span>
          ))}
        </div>
        <p className="font-mono text-[13px]">titanic.csv</p>
        <p className="tnum text-[12px] text-ink-muted">891 rows × 12 columns · typed in milliseconds</p>
        <div className="flex flex-wrap justify-center gap-1.5">
          <TypeBadge kind="numeric" />
          <TypeBadge kind="categorical" />
          <TypeBadge kind="boolean" />
          <TypeBadge kind="identifier" />
        </div>
      </div>
    ),
  },
  {
    title: "Profile",
    icon: "chart",
    tone: "teal",
    lead: "Every column gets its distribution, gaps, outliers and a verdict. The gaps jump out first.",
    visual: (
      <div className="rounded-xl border border-line bg-card/60 p-4">
        <p className="mb-3 text-[12px] font-medium text-ink-muted">Missing values by column</p>
        <MissingBars columns={TITANIC_MISSING} limit={3} />
        <p className="mt-4 text-[12px] text-ink-muted">
          Health score <span className="tnum font-semibold text-ink">91 / 100</span> · 0 duplicate rows
        </p>
      </div>
    ),
  },
  {
    title: "Clean",
    icon: "wand",
    tone: "pink",
    lead: "Fixes are suggested per column, each with its effect on data health before you commit.",
    visual: (
      <ul className="space-y-2">
        {[
          ["trash", "Drop column", "Cabin", "77% missing"],
          ["droplet", "Impute with median", "Age", "fills 19.9% gaps"],
          ["droplet", "Impute with mode", "Embarked", "fills 2 rows"],
        ].map(([icon, fix, column, why]) => (
          <li key={column} className="flex items-center gap-3 rounded-xl border border-line bg-card/60 px-3 py-2.5">
            <Icon name={icon} className="size-4 shrink-0 text-ink-muted" />
            <span className="min-w-0 flex-1 text-[13px]">
              <span className="font-medium">{fix}</span> <span className="font-mono text-[12px] text-accent-fg">{column}</span>
              <span className="block text-[11px] text-ink-muted">{why}</span>
            </span>
            <Icon name="tick" className="size-4 text-good" />
          </li>
        ))}
        <li className="tnum px-1 pt-1 text-[13px] text-ink-muted">
          Projected health <span className="text-ink-faint line-through">91</span> → <span className="font-semibold text-good">94</span>
        </li>
      </ul>
    ),
  },
  {
    title: "Model",
    icon: "model",
    tone: "purple",
    lead: "Pick what to predict. The task is inferred and suitable models proposed — each fully tunable.",
    visual: (
      <div className="space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {["Survived", "Pclass", "Sex", "Age", "Fare"].map((target, i) => (
            <span key={target} className={`rounded-full border px-3 py-1 font-mono text-[12px] ${i === 0 ? "border-accent bg-accent-soft text-ink" : "border-line text-ink-muted"}`}>
              {target}
            </span>
          ))}
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-accent/30 bg-accent-soft px-3 py-2.5">
          <IconTile icon="kind-boolean" tone="blue" size="sm" />
          <span className="text-[13px]">
            <span className="font-semibold">Binary classification</span>
            <span className="block text-[11px] text-ink-muted">target has two outcomes</span>
          </span>
        </div>
        <div className="rounded-xl border border-line bg-card/60 p-3 font-mono text-[12px]">
          <p className="mb-1.5 font-sans text-[11px] font-medium text-ink-muted">Random forest · hyperparameters</p>
          {[
            ["n_estimators", "300"],
            ["max_depth", "8"],
            ["class_weight", "balanced"],
          ].map(([k, v]) => (
            <p key={k} className="flex justify-between">
              <span className="text-ink-muted">{k}</span>
              <span className="font-semibold">{v}</span>
            </p>
          ))}
        </div>
      </div>
    ),
  },
  {
    title: "Train",
    icon: "check",
    tone: "sky",
    lead: "Models train side by side and are ranked on rows they never saw. Export the winner as Python.",
    visual: (
      <div className="rounded-xl border border-line bg-card/60 p-3">
        <ScoreBars results={TITANIC_SCORES} selected="gradient_boosting" scoreName="balanced accuracy" />
      </div>
    ),
  },
];

export function StoryScroll() {
  const section = useRef<HTMLElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLDivElement>(null);

  // wide screens with motion: pin the section and scrub the steps sideways.
  // everyone else reads the same panels stacked, no pinning
  useLayoutEffect(() => {
    const media = gsap.matchMedia();
    media.add(`(min-width: 1024px) and ${MOTION_OK}`, () => {
      // how far the row of panels overflows the visible section. measure against
      // the section: the track itself grows to its content, so its own width
      // minus its scroll width is always zero
      const distance = () => (track.current && section.current ? Math.max(0, track.current.scrollWidth - section.current.clientWidth) : 0);
      const tween = gsap.to(track.current, {
        x: () => -distance(),
        ease: "none",
        scrollTrigger: {
          trigger: section.current,
          start: "top top",
          end: () => `+=${distance()}`,
          pin: true,
          scrub: 1,
          invalidateOnRefresh: true,
          onUpdate: (self) => gsap.set(bar.current, { scaleX: self.progress }),
        },
      });
      return () => tween.scrollTrigger?.kill();
    });
    return () => media.revert();
  }, []);

  return (
    <section ref={section} id="how" className="relative scroll-mt-16 overflow-hidden py-20 lg:flex lg:h-screen lg:flex-col lg:justify-center lg:py-0">
      <div className="mx-auto w-full max-w-6xl px-4 md:px-6">
        <p className="text-[12px] font-semibold tracking-[0.08em] text-accent-fg uppercase">How it works</p>
        <div className="mt-2 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <h2 className="font-display max-w-xl text-[32px] leading-[1.08] font-bold tracking-[-0.03em] md:text-[44px]">
            Raw file to ranked models in five steps.
          </h2>
          <div className="hidden w-64 lg:block" aria-hidden="true">
            <div className="flex justify-between text-[11px] text-ink-faint">
              <span>Ingest</span>
              <span>Train</span>
            </div>
            <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-line">
              <div ref={bar} className="h-full origin-left rounded-full bg-accent" style={{ transform: "scaleX(0)" }} />
            </div>
          </div>
        </div>
      </div>

      <div
        ref={track}
        className="mx-auto mt-10 grid max-w-6xl gap-4 px-4 md:px-6 lg:flex lg:w-max lg:max-w-none lg:gap-6 lg:px-[max(1.5rem,calc((100vw-72rem)/2+1.5rem))]"
      >
        {STEPS.map((step, i) => (
          <article key={step.title} className="glass flex flex-col rounded-[20px] border border-line p-5 lg:w-[30rem] lg:shrink-0 lg:p-6">
            <div className="flex items-center gap-3">
              <IconTile icon={step.icon} tone={step.tone} />
              <span className="tnum text-[12px] font-semibold text-ink-faint">STEP {i + 1} / 5</span>
            </div>
            <h3 className="font-display mt-4 text-[24px] font-bold tracking-[-0.02em]">{step.title}</h3>
            <p className="mt-1.5 text-[14px] leading-relaxed text-ink-muted">{step.lead}</p>
            <div className="mt-5 flex-1">{step.visual}</div>
          </article>
        ))}
      </div>
    </section>
  );
}
