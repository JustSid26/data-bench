import { useLayoutEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { m } from "motion/react";
import { Button, IconTile } from "../primitives";
import { Icon } from "../icons";
import { HealthRing } from "../viz/HealthRing";
import { TypeDonut } from "../viz/TypeDonut";
import { MissingBars } from "../viz/Missing";
import { ScoreBars } from "../viz/Training";
import { MOTION_OK, gsap } from "../../lib/gsap";
import { spring } from "../../lib/motion";
import { TITANIC_HEALTH, TITANIC_MISSING, TITANIC_SCORES, TITANIC_TYPES } from "./data";

const HEADLINE = [
  ["Understand", "any", "dataset."],
  ["Train", "the", "right", "model."],
];

export function Hero() {
  const navigate = useNavigate();
  const stage = useRef<HTMLDivElement>(null);
  const mockup = useRef<HTMLDivElement>(null);

  // the product window starts tipped back and settles flat as it scrolls up
  useLayoutEffect(() => {
    const media = gsap.matchMedia();
    media.add(MOTION_OK, () => {
      gsap.fromTo(
        mockup.current,
        { rotateX: 22, scale: 0.9, y: 40, transformPerspective: 1400, transformOrigin: "50% 0%" },
        {
          rotateX: 0,
          scale: 1,
          y: 0,
          ease: "none",
          scrollTrigger: { trigger: stage.current, start: "top 85%", end: "top 15%", scrub: 1 },
        },
      );
    });
    return () => media.revert();
  }, []);

  let word = 0;
  return (
    <section className="relative overflow-hidden">
      <div aria-hidden="true" className="dot-grid pointer-events-none absolute inset-0 [mask-image:linear-gradient(to_bottom,black,transparent_85%)]" />

      <div className="relative mx-auto max-w-6xl px-4 pt-16 text-center md:px-6 md:pt-24">
        <m.a
          href="#code"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...spring.soft, delay: 0.05 }}
          className="inline-flex items-center gap-2 rounded-full border border-line bg-card py-1 pr-3 pl-1 text-[12px] font-medium text-ink-muted shadow-sm transition-colors hover:border-line-strong hover:text-ink"
        >
          <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold tracking-[0.04em] text-accent-ink uppercase">New</span>
          Export any trained model as runnable Python
          <Icon name="next" className="size-3.5" />
        </m.a>

        <h1 className="font-display mx-auto mt-6 max-w-4xl text-[44px] leading-[1.02] font-extrabold tracking-[-0.045em] sm:text-[60px] md:text-[76px]">
          {HEADLINE.map((line, l) => (
            <span key={l} className={`block ${l === 1 ? "text-accent-fg" : ""}`}>
              {line.map((text) => {
                const index = word++;
                return (
                  <m.span
                    key={text + index}
                    className="inline-block"
                    initial={{ opacity: 0, y: "0.4em", filter: "blur(8px)" }}
                    animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                    transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: 0.12 + index * 0.07 }}
                  >
                    {text}
                    {" "}
                  </m.span>
                );
              })}
            </span>
          ))}
        </h1>

        <m.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.7 }}
          className="mx-auto mt-6 max-w-2xl text-[17px] leading-relaxed text-ink-muted md:text-[19px]"
        >
          DataBench profiles every column, flags what needs fixing, trains the models that suit your data side by side — and
          shows you honestly which one wins. Then it hands you the code.
        </m.p>

        <m.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.85 }}
          className="mt-8 flex flex-wrap items-center justify-center gap-3"
        >
          <Button variant="primary" onClick={() => navigate("/upload")} className="h-12 px-6 text-[15px]">
            <Icon name="upload" className="size-4" />
            Upload a dataset
          </Button>
          <a
            href="#how"
            className="inline-flex h-12 items-center gap-2 rounded-lg border border-line bg-card px-6 text-[15px] font-medium shadow-sm transition-colors hover:border-line-strong"
          >
            <Icon name="play" className="size-3.5" />
            See it work
          </a>
        </m.div>
        <m.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.05 }} className="mt-4 text-[12px] text-ink-faint">
          No sign-up · CSV, Excel, Parquet, JSON · runs on AWS
        </m.p>
      </div>

      {/* the product, at full size */}
      <div ref={stage} className="relative mx-auto mt-14 max-w-6xl px-4 pb-8 md:px-6 md:pb-16">
        <m.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring.soft, delay: 0.9 }}>
          <div ref={mockup} className="will-change-transform">
            <div className="glass-sheet overflow-hidden rounded-[20px] border border-line">
              <div className="flex items-center gap-2 border-b border-line px-4 py-3" aria-hidden="true">
                <span className="size-3 rounded-full bg-[#ff5f57]" />
                <span className="size-3 rounded-full bg-[#febc2e]" />
                <span className="size-3 rounded-full bg-[#28c840]" />
                <span className="mx-auto rounded-md border border-line bg-hover px-3 py-0.5 font-mono text-[11px] text-ink-muted">databench · titanic.csv</span>
              </div>
              <div className="grid md:grid-cols-[13rem_minmax(0,1fr)]">
                <aside aria-hidden="true" className="hidden border-r border-line p-3 md:block">
                  {[
                    ["upload", "blue", "Upload"],
                    ["grid", "indigo", "Overview"],
                    ["chart", "teal", "Analyse"],
                    ["wand", "pink", "Clean"],
                    ["model", "purple", "Model"],
                    ["check", "sky", "Results"],
                  ].map(([icon, tone, label], i) => (
                    <div key={label} className={`flex items-center gap-2.5 rounded-[10px] px-2 py-1.5 text-[13px] ${i === 2 ? "bg-accent-soft font-semibold" : ""}`}>
                      <IconTile icon={icon} tone={tone as never} size="sm" />
                      {label}
                    </div>
                  ))}
                </aside>
                <div className="grid gap-3 p-4 text-left sm:grid-cols-2 lg:grid-cols-[auto_minmax(0,1fr)_minmax(0,1.1fr)]">
                  <Panel title="Dataset health">
                    <HealthRing health={TITANIC_HEALTH} size={104} />
                  </Panel>
                  <Panel title="Column types">
                    <TypeDonut composition={TITANIC_TYPES} size={92} />
                  </Panel>
                  <Panel title="Most incomplete columns" className="sm:col-span-2 lg:col-span-1">
                    <MissingBars columns={TITANIC_MISSING} limit={3} />
                  </Panel>
                  <Panel title="Predicting survival — scored on held-out rows" className="sm:col-span-2 lg:col-span-3">
                    <ScoreBars results={TITANIC_SCORES} selected="gradient_boosting" scoreName="balanced accuracy" />
                  </Panel>
                </div>
              </div>
            </div>
          </div>
          <p className="mt-4 text-center text-[12px] text-ink-faint">Real DataBench output for the public Titanic dataset — 891 passengers, 12 columns.</p>
        </m.div>
      </div>
    </section>
  );
}

function Panel({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-line bg-card/60 p-3 ${className}`}>
      <p className="mb-2 text-[12px] font-medium text-ink-muted">{title}</p>
      {children}
    </div>
  );
}
