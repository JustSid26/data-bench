import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AnimatePresence, m } from "motion/react";
import { Button, IconButton, IconTile } from "../components/primitives";
import type { TileTone } from "../components/primitives";
import { Icon } from "../components/icons";
import { Hero } from "../components/landing/Hero";
import { StoryScroll } from "../components/landing/StoryScroll";
import { CodeShowcase } from "../components/landing/CodeShowcase";
import { FlowArrow } from "../components/landing/Motion";
import { HealthRecipe, ScoreChart, StatsStrip } from "../components/landing/Infographics";
import {
  DbscanArt,
  DecisionTreeArt,
  GradientBoostingArt,
  IsolationArt,
  KMeansArt,
  LogisticArt,
  RandomForestArt,
  RidgeArt,
} from "../components/landing/ModelArt";
import { fadeUp, inView, lift, spring, stagger, tween } from "../lib/motion";
import { useTheme } from "../state/theme";

const REPO = "https://github.com/JustSid26/data-bench";

const MARQUEE: [string, string][] = [
  ["file-csv", "CSV & TSV"],
  ["file-sheet", "Excel"],
  ["file-parquet", "Parquet"],
  ["file-json", "JSON"],
  ["model", "scikit-learn"],
  ["chart", "pandas"],
  ["grid", "FastAPI"],
  ["layers", "React 19"],
  ["sparkle", "Motion & GSAP"],
  ["search", "Amazon EC2"],
  ["droplet", "Amazon S3"],
  ["target", "AWS IAM"],
  ["report", "Terraform"],
];

const MODELS: { name: string; task: string; tone: TileTone; art: () => ReactNode; how: string; wide?: boolean }[] = [
  { name: "Gradient boosting", task: "Classification · Regression", tone: "purple", art: () => <GradientBoostingArt />, how: "Adds small trees one after another, each correcting the errors the others still make. Usually the most accurate on mixed data.", wide: true },
  { name: "K-means", task: "Clustering", tone: "pink", art: () => <KMeansArt />, how: "Moves k centres to the middle of their nearest points until nothing changes — k is chosen by silhouette score.", wide: true },
  { name: "Decision tree", task: "Classification · Regression", tone: "blue", art: () => <DecisionTreeArt />, how: "One yes/no question at a time until the rows agree. Readable end to end." },
  { name: "Random forest", task: "Classification · Regression", tone: "teal", art: () => <RandomForestArt />, how: "Many trees on random slices of the data, then a vote. A strong, stable default." },
  { name: "Logistic regression", task: "Classification", tone: "indigo", art: () => <LogisticArt />, how: "Weighs each column and squashes the total through an S-curve into a probability." },
  { name: "Ridge regression", task: "Regression", tone: "sky", art: () => <RidgeArt />, how: "A straight line through the data, with every weight kept small." },
  { name: "DBSCAN", task: "Clustering", tone: "violet", art: () => <DbscanArt />, how: "Clusters of any shape, grown through dense neighbourhoods; stragglers become noise.", wide: true },
  { name: "Isolation forest", task: "Anomaly detection", tone: "graphite", art: () => <IsolationArt />, how: "Random cuts isolate unusual rows in very few steps — that is how they are found.", wide: true },
];

const FEATURES: { title: string; icon: string; tone: TileTone; text: string }[] = [
  { title: "Health score", icon: "ok", tone: "teal", text: "One 0–100 verdict on completeness, types, duplicates and outliers." },
  { title: "Missing-data map", icon: "droplet", tone: "pink", text: "Where the gaps are, row by row, worst columns first." },
  { title: "Correlation heatmap", icon: "link", tone: "indigo", text: "Columns that move together, one click from the detail." },
  { title: "Column inspector", icon: "search", tone: "blue", text: "Histogram, box plot, top values and suggested fixes per column." },
  { title: "Honest model choice", icon: "sparkle", tone: "purple", text: "Rule-based candidates, then every model trained and ranked for real." },
  { title: "Tunable hyperparameters", icon: "sort", tone: "violet", text: "Validated ranges for every setting, reset any time." },
  { title: "Python export", icon: "download", tone: "sky", text: "A standalone script that reproduces the exact score." },
  { title: "Durable storage", icon: "layers", tone: "graphite", text: "Uploads and results kept in Amazon S3 across restarts." },
];

const FAQ: [string, string][] = [
  [
    "Is the model recommendation AI?",
    "No — and we say so. A transparent rule set proposes candidates from your data's shape (rows, feature count, target type). What decides the winner is real: every candidate is trained with scikit-learn and scored on rows it never saw.",
  ],
  [
    "Are the scores on this page real?",
    "Yes. They come from running public datasets through DataBench with default settings. A dataset of pure random noise lands at 0.50 — chance — which is exactly what an honest evaluation should report.",
  ],
  [
    "What file types and sizes work?",
    "CSV, TSV, Excel, Parquet and JSON / JSON Lines, up to 512 MB. Semicolon-separated files and numbers stored as text are handled automatically.",
  ],
  [
    "Can I use the model outside DataBench?",
    "Yes. Export any trained model as a Python script that retrains it with your exact settings and saves the fitted pipeline with joblib.",
  ],
  [
    "Where does my data go?",
    "It is processed on a single Amazon EC2 server and kept in a private, encrypted Amazon S3 bucket. This demo workspace is shared, so please don't upload anything sensitive.",
  ],
];

function SectionHead({ eyebrow, title, lead, center = false }: { eyebrow: string; title: string; lead?: string; center?: boolean }) {
  return (
    <m.div variants={stagger(0.06)} className={center ? "mx-auto max-w-2xl text-center" : "max-w-2xl"}>
      <m.p variants={fadeUp} className="text-[12px] font-semibold tracking-[0.08em] text-accent-fg uppercase">
        {eyebrow}
      </m.p>
      <m.h2 variants={fadeUp} className="font-display mt-2 text-[32px] leading-[1.08] font-bold tracking-[-0.03em] md:text-[44px]">
        {title}
      </m.h2>
      {lead && (
        <m.p variants={fadeUp} className="mt-4 text-[16px] leading-relaxed text-ink-muted">
          {lead}
        </m.p>
      )}
    </m.div>
  );
}

function Section({ id, children, className = "" }: { id?: string; children: ReactNode; className?: string }) {
  return (
    <m.section id={id} {...inView} variants={stagger(0.08)} className={`mx-auto max-w-6xl scroll-mt-16 px-4 py-20 md:px-6 md:py-28 ${className}`}>
      {children}
    </m.section>
  );
}

function ArchBox({ icon, tone, title, lines, className = "" }: { icon: string; tone: TileTone; title: string; lines: string[]; className?: string }) {
  return (
    <div className={`glass rounded-card border border-line p-4 ${className}`}>
      <div className="flex items-center gap-2.5">
        <IconTile icon={icon} tone={tone} />
        <p className="text-[14px] font-semibold">{title}</p>
      </div>
      <ul className="mt-2.5 space-y-1 text-[12px] text-ink-muted">
        {lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </div>
  );
}

function FaqItem({ q, a, index }: { q: string; a: string; index: number }) {
  const [open, setOpen] = useState(false);
  const id = `faq-answer-${index}`;
  return (
    <m.li variants={fadeUp} className="border-b border-line">
      <button type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen((on) => !on)} className="flex w-full items-center justify-between gap-4 py-5 text-left">
        <span className="text-[16px] font-semibold">{q}</span>
        <m.span animate={{ rotate: open ? 45 : 0 }} transition={spring.snappy} className="grid size-8 shrink-0 place-items-center rounded-full border border-line text-ink-muted">
          <Icon name="close" className="size-3.5 rotate-45" />
        </m.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <m.div id={id} initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={tween.base} className="overflow-hidden">
            <p className="max-w-3xl pb-5 text-[15px] leading-relaxed text-ink-muted">{a}</p>
          </m.div>
        )}
      </AnimatePresence>
    </m.li>
  );
}

export function Landing() {
  const navigate = useNavigate();
  const { dark, toggle } = useTheme();
  const [scrolled, setScrolled] = useState(false);
  const open = () => navigate("/upload");

  // the header frosts over only once the page has moved
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="min-h-full overflow-x-clip">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-card focus:px-3 focus:py-2">
        Skip to content
      </a>
      <header className={`sticky top-0 z-40 border-b transition-colors duration-300 ${scrolled ? "glass-chrome border-line" : "border-transparent"}`}>
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 md:px-6">
          <Link to="/" className="flex items-center gap-2.5" aria-label="DataBench home">
            <span className="grid size-8 place-items-center rounded-[9px] bg-accent text-accent-ink shadow-sm">
              <Icon name="layers" className="size-4" />
            </span>
            <span className="font-display text-[17px] font-bold tracking-[-0.02em]">DataBench</span>
          </Link>
          <nav aria-label="Sections" className="ml-8 hidden items-center gap-1 text-[14px] text-ink-muted lg:flex">
            {[
              ["#how", "How it works"],
              ["#models", "Models"],
              ["#results", "Results"],
              ["#code", "Export"],
              ["#architecture", "Architecture"],
              ["#faq", "FAQ"],
            ].map(([href, label]) => (
              <a key={href} href={href} className="rounded-lg px-3 py-2 transition-colors hover:bg-hover hover:text-ink">
                {label}
              </a>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-1.5">
            <IconButton icon={dark ? "sun" : "moon"} label={dark ? "Light theme" : "Dark theme"} onClick={toggle} />
            <Button variant="primary" onClick={open} className="h-9 px-4">
              Open app
              <Icon name="arrow" className="size-4" />
            </Button>
          </div>
        </div>
      </header>

      <main id="main">
        <Hero />

        {/* what it works with -- a quiet ticker that pauses on hover */}
        <div className="marquee border-y border-line py-5">
          <p className="sr-only">Works with {MARQUEE.map(([, label]) => label).join(", ")}.</p>
          <div aria-hidden="true" className="overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]">
            <ul className="marquee-track flex w-max gap-10 pr-10">
              {[...MARQUEE, ...MARQUEE].map(([icon, label], i) => (
                <li key={i} className="flex items-center gap-2 text-[14px] font-medium whitespace-nowrap text-ink-muted">
                  <Icon name={icon} className="size-4" />
                  {label}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <Section className="!pb-0">
          <StatsStrip />
        </Section>

        <StoryScroll />

        <Section id="models">
          <SectionHead
            eyebrow="Models"
            title="Eight algorithms. One honest leaderboard."
            lead="DataBench proposes the candidates that suit your data, trains them side by side and ranks them on rows they never saw. Here is how each one thinks."
          />
          <m.div variants={stagger(0.06)} className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {MODELS.map((model) => (
              <m.article
                key={model.name}
                variants={fadeUp}
                {...lift}
                className={`glass flex flex-col overflow-hidden rounded-[20px] border border-line transition-shadow hover:shadow-lg ${model.wide ? "lg:col-span-2" : ""}`}
              >
                <div className={`border-b border-line p-3 ${model.wide ? "aspect-[200/130] lg:aspect-auto lg:h-56" : "aspect-[200/130]"}`}>{model.art()}</div>
                <div className="flex flex-1 flex-col p-5">
                  <div className="flex items-center gap-2.5">
                    <IconTile icon="model" tone={model.tone} size="sm" />
                    <h3 className="text-[15px] font-semibold">{model.name}</h3>
                  </div>
                  <p className="mt-1 text-[11px] font-semibold tracking-[0.04em] text-ink-faint uppercase">{model.task}</p>
                  <p className="mt-2.5 text-[13px] leading-relaxed text-ink-muted">{model.how}</p>
                </div>
              </m.article>
            ))}
          </m.div>
        </Section>

        <div className="border-y border-line bg-hover/40">
          <Section>
            <SectionHead eyebrow="Features" title="Everything a notebook does. None of the setup." center />
            <m.div variants={stagger(0.04)} className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
              {FEATURES.map((feature) => (
                <m.div key={feature.title} variants={fadeUp} className="flex gap-3.5">
                  <IconTile icon={feature.icon} tone={feature.tone} />
                  <div>
                    <p className="text-[15px] font-semibold">{feature.title}</p>
                    <p className="mt-1 text-[13px] leading-relaxed text-ink-muted">{feature.text}</p>
                  </div>
                </m.div>
              ))}
            </m.div>
          </Section>
        </div>

        <Section id="results">
          <SectionHead
            eyebrow="Results"
            title="Measured, not claimed."
            lead="Public datasets, default settings, every score on held-out rows — including pure random noise, which lands at chance, exactly where an honest tool should put it."
          />
          <div className="mt-12 grid gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
            <m.div variants={fadeUp} className="glass rounded-[20px] border border-line p-6">
              <p className="mb-3 text-[14px] font-semibold">Best model per dataset</p>
              <ScoreChart />
            </m.div>
            <m.div variants={fadeUp} className="glass rounded-[20px] border border-line p-6">
              <p className="mb-5 text-[14px] font-semibold">How the health score is built</p>
              <HealthRecipe />
            </m.div>
          </div>
        </Section>

        <Section id="code">
          <CodeShowcase />
        </Section>

        <Section id="architecture">
          <SectionHead
            eyebrow="Architecture"
            title="Three AWS services. One Terraform apply."
            lead="One EC2 instance serves the app and trains models; Amazon S3 keeps every upload and result; an IAM role lets the server reach that bucket with no keys stored anywhere."
          />
          <m.div variants={fadeUp} className="mt-12 flex flex-col items-stretch lg:flex-row lg:items-center">
            <ArchBox icon="search" tone="graphite" title="Browser" lines={["React + TypeScript UI", "open to anyone with the link"]} className="lg:w-52" />
            <FlowArrow label="HTTP" />
            <div className="flex-1 rounded-[22px] border-2 border-dashed border-line-strong p-3">
              <p className="mb-2 flex items-center gap-1.5 px-1 text-[11px] font-semibold tracking-[0.06em] text-ink-muted uppercase">
                <Icon name="grid" className="size-3.5" /> Amazon EC2 · t3.medium · Ubuntu 24.04
              </p>
              <div className="flex flex-col lg:flex-row lg:items-center">
                <ArchBox icon="filter" tone="indigo" title="nginx" lines={["per-visitor rate limits", "uploads up to 512 MB"]} className="flex-1" />
                <FlowArrow label="proxy" />
                <ArchBox icon="model" tone="purple" title="FastAPI + scikit-learn" lines={["profile, plan, train", "export models as Python"]} className="flex-1" />
              </div>
            </div>
            <FlowArrow label="IAM role" />
            <ArchBox icon="layers" tone="teal" title="Amazon S3" lines={["datasets & results", "private, encrypted"]} className="lg:w-52" />
          </m.div>
          <m.p variants={fadeUp} className="mt-5 flex flex-wrap items-center gap-2 text-[13px] text-ink-muted">
            <IconTile icon="report" tone="violet" size="sm" />
            <span>
              <span className="font-semibold text-ink">Terraform</span> provisions the instance, security group, Elastic IP, bucket and role —{" "}
              <code className="rounded bg-hover px-1.5 py-0.5 font-mono text-[12px]">terraform apply</code> to build,{" "}
              <code className="rounded bg-hover px-1.5 py-0.5 font-mono text-[12px]">terraform destroy</code> to remove.
            </span>
          </m.p>
        </Section>

        <Section id="faq">
          <SectionHead eyebrow="FAQ" title="Straight answers." />
          <m.ul variants={stagger(0.05)} className="mt-8 border-t border-line">
            {FAQ.map(([q, a], index) => (
              <FaqItem key={q} q={q} a={a} index={index} />
            ))}
          </m.ul>
        </Section>

        <Section className="!pt-0">
          <m.div variants={fadeUp} className="relative overflow-hidden rounded-[28px] bg-ink px-6 py-16 text-center text-surface md:py-20">
            <div aria-hidden="true" className="dot-grid pointer-events-none absolute inset-0 opacity-40" />
            <div className="relative">
              <h2 className="font-display mx-auto max-w-2xl text-[34px] leading-[1.05] font-extrabold tracking-[-0.035em] md:text-[52px]">
                Bring a dataset. See what it can tell you.
              </h2>
              <p className="mx-auto mt-4 max-w-lg text-[16px] opacity-75">No sign-up and no notebook. The first charts appear in seconds.</p>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <m.button
                  type="button"
                  onClick={open}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  transition={spring.snappy}
                  className="inline-flex h-12 items-center gap-2 rounded-lg bg-surface px-6 text-[15px] font-semibold text-ink"
                >
                  <Icon name="upload" className="size-4" />
                  Upload a dataset
                </m.button>
                <a href={REPO} target="_blank" rel="noreferrer" className="inline-flex h-12 items-center gap-2 rounded-lg border border-surface/25 px-6 text-[15px] font-semibold transition-colors hover:bg-surface/10">
                  View the source
                  <Icon name="arrow" className="size-4" />
                </a>
              </div>
            </div>
          </m.div>
        </Section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:grid-cols-[minmax(0,1.5fr)_repeat(3,minmax(0,1fr))] md:px-6">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="grid size-7 place-items-center rounded-[8px] bg-accent text-accent-ink">
                <Icon name="layers" className="size-3.5" />
              </span>
              <span className="font-display text-[16px] font-bold">DataBench</span>
            </div>
            <p className="mt-3 max-w-xs text-[13px] text-ink-muted">Understand any dataset and train the right model — in one browser tab.</p>
          </div>
          {(
            [
              ["Product", [["How it works", "#how"], ["Models", "#models"], ["Results", "#results"], ["Export", "#code"]]],
              ["App", [["Upload", "/upload"], ["Overview", "/overview"], ["Model", "/model"], ["Results", "/results"]]],
              ["Project", [["Source code", REPO], ["Deploy guide", `${REPO}/tree/main/deploy`], ["Architecture", "#architecture"], ["FAQ", "#faq"]]],
            ] as [string, [string, string][]][]
          ).map(([heading, links]) => (
            <nav key={heading} aria-label={heading}>
              <p className="text-[13px] font-semibold">{heading}</p>
              <ul className="mt-3 space-y-2 text-[13px] text-ink-muted">
                {links.map(([label, href]) => (
                  <li key={label}>
                    {href.startsWith("/") ? (
                      <Link to={href} className="transition-colors hover:text-ink">
                        {label}
                      </Link>
                    ) : (
                      <a href={href} {...(href.startsWith("http") ? { target: "_blank", rel: "noreferrer" } : {})} className="transition-colors hover:text-ink">
                        {label}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <div className="border-t border-line">
          <p className="mx-auto max-w-6xl px-4 py-5 text-[12px] text-ink-faint md:px-6">DataBench · built with React, FastAPI and scikit-learn · hosted on Amazon EC2 and S3</p>
        </div>
      </footer>
    </div>
  );
}
