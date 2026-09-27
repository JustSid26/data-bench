import type { ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { m } from "motion/react";
import { Button, IconButton, IconTile } from "../components/primitives";
import type { TileTone } from "../components/primitives";
import { Icon } from "../components/icons";
import { HealthRing } from "../components/viz/HealthRing";
import { TypeDonut } from "../components/viz/TypeDonut";
import { ScoreBars } from "../components/viz/Training";
import { DataField, PipelineFlow, FlowArrow } from "../components/landing/Motion";
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
import { fadeUp, inView, lift, spring, stagger } from "../lib/motion";
import type { Health } from "../lib/insights";
import type { ModelResult } from "../lib/types";
import { useTheme } from "../state/theme";

/* The hero preview uses real numbers: DataBench's own profile of the public
   Titanic dataset (891 rows) and the scores its models reached on held-out rows. */
const TITANIC_HEALTH: Health = {
  score: 91,
  parts: [
    { key: "completeness", label: "Completeness", value: 91.9, weight: 0.4, detail: "8.1% of cells are empty" },
    { key: "consistency", label: "Type consistency", value: 100, weight: 0.2, detail: "every column has a usable type" },
    { key: "uniqueness", label: "Uniqueness", value: 100, weight: 0.2, detail: "0 duplicate rows in the sample" },
    { key: "outliers", label: "Outliers", value: 70.9, weight: 0.2, detail: "7.3% of numeric values on average" },
  ],
};

const TITANIC_TYPES = [
  { kind: "numeric" as const, count: 2 },
  { kind: "categorical" as const, count: 6 },
  { kind: "boolean" as const, count: 1 },
  { kind: "text" as const, count: 1 },
  { kind: "identifier" as const, count: 2 },
];

const TITANIC_SCORES = (
  [
    ["gradient_boosting", 0.7788],
    ["logistic_regression", 0.7707],
    ["random_forest", 0.757],
    ["decision_tree", 0.7136],
  ] as const
).map(([algorithm, score]) => ({ algorithm, score, ok: true, metrics: {}, importance: [], fit_ms: 0 }) as ModelResult);

const FEATURES: { title: string; icon: string; tone: TileTone; text: string }[] = [
  { title: "Dataset health score", icon: "ok", tone: "teal", text: "One 0–100 number from completeness, type consistency, duplicates and outliers, with the breakdown one hover away." },
  { title: "Missing-data map", icon: "droplet", tone: "pink", text: "See exactly where the gaps are, row by row, and which columns are worst." },
  { title: "Correlation heatmap", icon: "link", tone: "indigo", text: "Spot columns that move together; click a cell to inspect the pair." },
  { title: "Column inspector", icon: "search", tone: "blue", text: "Any column in depth: histogram, box plot, top values, missing pattern and suggested fixes." },
  { title: "Honest model choice", icon: "sparkle", tone: "purple", text: "A rule-based planner proposes candidates for your data; every one is then trained and ranked on held-out rows." },
  { title: "Your hyperparameters", icon: "sort", tone: "violet", text: "Tune trees, depth, learning rate, regularisation or k — validated ranges, reset any time." },
  { title: "Export as Python", icon: "download", tone: "sky", text: "Download a standalone scikit-learn script that reproduces the exact score, plus the fitted model." },
  { title: "Nothing gets lost", icon: "layers", tone: "graphite", text: "Uploads and results are kept in Amazon S3, so a restart or redeploy never wipes your work." },
];

const MODELS: { name: string; task: string; tone: TileTone; art: () => ReactNode; how: string; when: string }[] = [
  { name: "Decision tree", task: "Classify · Regress", tone: "blue", art: () => <DecisionTreeArt />, how: "Asks one yes/no question about a column at a time until the rows it has left mostly agree.", when: "You need a model you can read end to end." },
  { name: "Random forest", task: "Classify · Regress", tone: "teal", art: () => <RandomForestArt />, how: "Grows many trees on random slices of rows and columns, then lets them vote.", when: "A strong, stable default that needs no tuning." },
  { name: "Gradient boosting", task: "Classify · Regress", tone: "purple", art: () => <GradientBoostingArt />, how: "Adds small trees one after another, each fixing the errors the others still make.", when: "Mixed column types, missing values, top accuracy." },
  { name: "Logistic regression", task: "Classify", tone: "indigo", art: () => <LogisticArt />, how: "Weighs each column and squashes the total through an S-curve into a probability.", when: "Fast, explainable per-column effects." },
  { name: "Ridge regression", task: "Regress", tone: "sky", art: () => <RidgeArt />, how: "Fits a straight line through the data while keeping every weight small.", when: "A baseline that says whether the signal is simple." },
  { name: "K-means", task: "Cluster", tone: "pink", art: () => <KMeansArt />, how: "Moves k centres to the middle of their nearest points until nothing changes; k is chosen for you.", when: "Grouping rows into segments with no target." },
  { name: "DBSCAN", task: "Cluster", tone: "violet", art: () => <DbscanArt />, how: "Grows clusters through dense neighbourhoods, so shapes can be anything; stragglers become noise.", when: "Odd-shaped groups and a built-in outlier flag." },
  { name: "Isolation forest", task: "Anomalies", tone: "graphite", art: () => <IsolationArt />, how: "Cuts the data at random; rows that get isolated in very few cuts are the unusual ones.", when: "Finding the rows that fit no pattern." },
];

const STACK = ["React 19", "TypeScript", "Vite", "Tailwind CSS", "Motion", "FastAPI", "pandas", "scikit-learn", "Amazon EC2", "Amazon S3", "AWS IAM", "Terraform"];

function Section({ id, eyebrow, title, lead, children }: { id: string; eyebrow: string; title: string; lead?: string; children: ReactNode }) {
  return (
    <m.section id={id} {...inView} variants={stagger(0.06)} className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16 md:px-6 md:py-24">
      <m.p variants={fadeUp} className="text-[12px] font-semibold tracking-[0.08em] text-accent-fg uppercase">
        {eyebrow}
      </m.p>
      <m.h2 variants={fadeUp} className="mt-2 max-w-2xl text-[28px] leading-tight font-semibold tracking-[-0.02em] md:text-[36px]">
        {title}
      </m.h2>
      {lead && (
        <m.p variants={fadeUp} className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink-muted">
          {lead}
        </m.p>
      )}
      <div className="mt-10">{children}</div>
    </m.section>
  );
}

/** A macOS-style window around the live preview. */
function AppWindow({ children }: { children: ReactNode }) {
  return (
    <div className="glass-sheet overflow-hidden rounded-[18px] border border-line">
      <div className="flex items-center gap-2 border-b border-line px-4 py-2.5" aria-hidden="true">
        <span className="size-3 rounded-full bg-[#ff5f57]" />
        <span className="size-3 rounded-full bg-[#febc2e]" />
        <span className="size-3 rounded-full bg-[#28c840]" />
        <span className="ml-3 truncate font-mono text-[11px] text-ink-muted">titanic.csv — DataBench</span>
      </div>
      <div className="p-4 md:p-5">{children}</div>
    </div>
  );
}

function ArchBox({ icon, tone, title, lines, className = "" }: { icon: string; tone: TileTone; title: string; lines: string[]; className?: string }) {
  return (
    <m.div variants={fadeUp} className={`glass rounded-card border border-line p-4 ${className}`}>
      <div className="flex items-center gap-2.5">
        <IconTile icon={icon} tone={tone} />
        <p className="text-[14px] font-semibold">{title}</p>
      </div>
      <ul className="mt-2.5 space-y-1 text-[12px] text-ink-muted">
        {lines.map((line) => (
          <li key={line} className="flex gap-1.5">
            <span className="text-ink-faint">•</span>
            {line}
          </li>
        ))}
      </ul>
    </m.div>
  );
}

export function Landing() {
  const navigate = useNavigate();
  const { dark, toggle } = useTheme();
  const open = () => navigate("/upload");

  return (
    <div className="min-h-full overflow-x-hidden">
      <header className="glass-chrome sticky top-0 z-30 border-b border-line">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5 md:px-6">
          <Link to="/" className="flex items-center gap-2.5" aria-label="DataBench home">
            <span className="grid size-8 place-items-center rounded-[9px] bg-accent text-accent-ink shadow-sm">
              <Icon name="layers" className="size-4" />
            </span>
            <span className="text-[16px] font-bold tracking-[-0.01em]">DataBench</span>
          </Link>
          <nav aria-label="Sections" className="ml-6 hidden items-center gap-1 text-[13px] text-ink-muted md:flex">
            {[
              ["#how", "How it works"],
              ["#models", "Models"],
              ["#features", "Features"],
              ["#results", "Results"],
              ["#architecture", "Architecture"],
            ].map(([href, label]) => (
              <a key={href} href={href} className="rounded-lg px-2.5 py-1.5 transition-colors hover:bg-hover hover:text-ink">
                {label}
              </a>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-1.5">
            <IconButton icon={dark ? "sun" : "moon"} label={dark ? "Light theme" : "Dark theme"} onClick={toggle} />
            <Button variant="primary" onClick={open}>
              Open app
              <Icon name="arrow" className="size-4" />
            </Button>
          </div>
        </div>
      </header>

      <main>
        {/* hero */}
        <div className="relative">
        <DataField />
        <section className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 pt-14 pb-16 md:px-6 md:pt-20 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-12">
          <m.div variants={stagger(0.08)} initial="hidden" animate="show">
            <m.p variants={fadeUp} className="inline-flex items-center gap-2 rounded-full border border-line bg-card px-3 py-1 text-[12px] font-medium text-ink-muted shadow-sm">
              <Icon name="sparkle" className="size-3.5 text-accent-fg" />
              Upload → understand → model, in one tab
            </m.p>
            <m.h1 variants={fadeUp} className="mt-5 text-[40px] leading-[1.05] font-bold tracking-[-0.035em] md:text-[56px]">
              Understand any dataset.
              <br />
              <span className="text-accent-fg">Train the right model.</span>
            </m.h1>
            <m.p variants={fadeUp} className="mt-5 max-w-xl text-[16px] leading-relaxed text-ink-muted md:text-[17px]">
              DataBench reads your file, profiles every column, flags what needs fixing, proposes models that suit the data,
              trains them side by side and shows you — honestly — which one wins. Then hands you the code.
            </m.p>
            <m.div variants={fadeUp} className="mt-7 flex flex-wrap items-center gap-3">
              <Button variant="primary" onClick={open} className="px-5 py-2.5 text-[15px]">
                <Icon name="upload" className="size-4" />
                Upload a dataset
              </Button>
              <a href="#how" className="rounded-lg px-4 py-2.5 text-[15px] font-medium text-ink transition-colors hover:bg-hover">
                See how it works
              </a>
            </m.div>
            <m.ul variants={fadeUp} className="mt-8 flex flex-wrap gap-2" aria-label="Supported formats">
              {[
                ["file-csv", "CSV / TSV"],
                ["file-sheet", "Excel"],
                ["file-parquet", "Parquet"],
                ["file-json", "JSON"],
              ].map(([icon, label]) => (
                <li key={label} className="flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1 text-[12px] text-ink-muted">
                  <Icon name={icon} className="size-3.5" />
                  {label}
                </li>
              ))}
            </m.ul>
          </m.div>

          <m.div initial={{ opacity: 0, y: 24, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ ...spring.soft, delay: 0.2 }}>
            <AppWindow>
              <div className="grid gap-4 sm:grid-cols-[auto_minmax(0,1fr)]">
                <div className="rounded-xl border border-line p-3">
                  <p className="mb-2 text-[12px] font-medium text-ink-muted">Dataset health</p>
                  <HealthRing health={TITANIC_HEALTH} size={104} />
                </div>
                <div className="rounded-xl border border-line p-3">
                  <p className="mb-2 text-[12px] font-medium text-ink-muted">Column types</p>
                  <TypeDonut composition={TITANIC_TYPES} size={96} />
                </div>
                <div className="rounded-xl border border-line p-3 sm:col-span-2">
                  <p className="mb-1 text-[12px] font-medium text-ink-muted">Predicting survival — held-out scores</p>
                  <ScoreBars results={TITANIC_SCORES} selected="gradient_boosting" scoreName="balanced accuracy" />
                </div>
              </div>
            </AppWindow>
            <p className="mt-3 text-center text-[11px] text-ink-faint">Real output for the public Titanic dataset (891 rows).</p>
          </m.div>
        </section>
        </div>

        <m.div {...inView} variants={stagger(0.05)} className="mx-auto max-w-6xl px-4 md:px-6">
          <StatsStrip />
        </m.div>

        <Section id="how" eyebrow="How it works" title="Five steps from raw file to a model you can ship" lead="The same pipeline runs for every dataset, and the breadcrumb at the top of the app always shows where you are.">
          <m.div variants={fadeUp}>
            <PipelineFlow />
          </m.div>
        </Section>

        <Section
          id="models"
          eyebrow="Models"
          title="Eight algorithms, and how each one thinks"
          lead="DataBench picks the candidates that suit your data and trains them side by side. Every one of them is tunable and exportable as Python."
        >
          <m.div variants={stagger(0.06)} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {MODELS.map((model) => (
              <m.article key={model.name} variants={fadeUp} {...lift} className="glass flex flex-col overflow-hidden rounded-card border border-line">
                <div className="aspect-[200/130] border-b border-line bg-hover/40 p-2">{model.art()}</div>
                <div className="flex flex-1 flex-col p-4">
                  <div className="flex items-center gap-2">
                    <IconTile icon="model" tone={model.tone} size="sm" />
                    <h3 className="text-[14px] font-semibold">{model.name}</h3>
                  </div>
                  <p className="mt-1 text-[11px] font-semibold tracking-[0.04em] text-ink-faint uppercase">{model.task}</p>
                  <p className="mt-2 text-[13px] leading-relaxed text-ink-muted">{model.how}</p>
                  <p className="mt-auto pt-3 text-[12px] text-ink">
                    <span className="font-semibold">Best for: </span>
                    {model.when}
                  </p>
                </div>
              </m.article>
            ))}
          </m.div>
        </Section>

        <Section id="features" eyebrow="Features" title="Everything you would do in a notebook, without the notebook">
          <m.div variants={stagger(0.05)} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((feature) => (
              <m.div key={feature.title} variants={fadeUp} {...lift} className="glass rounded-card border border-line p-4">
                <IconTile icon={feature.icon} tone={feature.tone} />
                <p className="mt-3 text-[14px] font-semibold">{feature.title}</p>
                <p className="mt-1 text-[13px] leading-relaxed text-ink-muted">{feature.text}</p>
              </m.div>
            ))}
          </m.div>
        </Section>

        <Section
          id="results"
          eyebrow="Results"
          title="Measured, not claimed"
          lead="Public datasets run through DataBench with default settings. Every score is on rows the models never trained on — including a dataset of pure noise, which lands at chance, exactly where an honest tool should put it."
        >
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
            <m.div variants={fadeUp} className="glass rounded-card border border-line p-5">
              <p className="mb-2 text-[13px] font-semibold">Best model per dataset</p>
              <ScoreChart />
            </m.div>
            <m.div variants={fadeUp} className="glass rounded-card border border-line p-5">
              <p className="mb-4 text-[13px] font-semibold">How the health score is built</p>
              <HealthRecipe />
            </m.div>
          </div>
        </Section>

        <Section
          id="architecture"
          eyebrow="Architecture"
          title="Three AWS services, provisioned with Terraform"
          lead="One EC2 instance serves the app and trains models; Amazon S3 keeps every upload and result; an IAM role lets the server use that bucket with no keys stored anywhere."
        >
          <m.div variants={stagger(0.08)} className="flex flex-col items-stretch lg:flex-row lg:items-center">
            <ArchBox icon="search" tone="graphite" title="Browser" lines={["React + TypeScript UI", "open to anyone with the link"]} className="lg:w-52" />
            <FlowArrow label="HTTP" />
            <m.div variants={fadeUp} className="flex-1 rounded-[20px] border-2 border-dashed border-line-strong p-3">
              <p className="mb-2 flex items-center gap-1.5 px-1 text-[11px] font-semibold tracking-[0.06em] text-ink-muted uppercase">
                <Icon name="grid" className="size-3.5" /> Amazon EC2 · t3.medium · Ubuntu 24.04
              </p>
              <div className="flex flex-col lg:flex-row lg:items-center">
                <ArchBox icon="filter" tone="indigo" title="nginx" lines={["per-visitor rate limits", "uploads up to 512 MB"]} className="flex-1" />
                <FlowArrow label="proxy" />
                <ArchBox icon="model" tone="purple" title="FastAPI + scikit-learn" lines={["profile, plan, train", "export models as Python"]} className="flex-1" />
              </div>
            </m.div>
            <FlowArrow label="IAM role" />
            <ArchBox icon="layers" tone="teal" title="Amazon S3" lines={["datasets & results", "private, encrypted"]} className="lg:w-52" />
          </m.div>
          <m.div variants={fadeUp} className="mt-4 flex flex-wrap items-center gap-2 rounded-card border border-line px-4 py-3 text-[13px] text-ink-muted">
            <IconTile icon="report" tone="violet" size="sm" />
            <span>
              <span className="font-semibold text-ink">Terraform</span> creates the instance, security group, Elastic IP, S3 bucket and IAM role — one{" "}
              <code className="rounded bg-hover px-1 font-mono text-[12px]">terraform apply</code>, one{" "}
              <code className="rounded bg-hover px-1 font-mono text-[12px]">terraform destroy</code>.
            </span>
          </m.div>

          <m.ul variants={stagger(0.03)} className="mt-10 flex flex-wrap gap-2" aria-label="Technology used">
            {STACK.map((item) => (
              <m.li key={item} variants={fadeUp} className="rounded-full border border-line px-3 py-1 text-[12px] font-medium text-ink-muted">
                {item}
              </m.li>
            ))}
          </m.ul>
        </Section>

        {/* closing call to action */}
        <m.section {...inView} variants={fadeUp} className="mx-auto max-w-6xl px-4 pb-20 md:px-6">
          <div className="glass flex flex-col items-center gap-4 rounded-[24px] border border-line px-6 py-12 text-center">
            <IconTile icon="upload" tone="blue" size="lg" />
            <h2 className="max-w-xl text-[28px] leading-tight font-semibold tracking-[-0.02em] md:text-[34px]">Bring a dataset. See what it can tell you.</h2>
            <p className="max-w-lg text-[15px] text-ink-muted">No setup, no notebook. Upload a file and the first charts appear in seconds.</p>
            <Button variant="primary" onClick={open} className="mt-2 px-6 py-2.5 text-[15px]">
              Open DataBench
              <Icon name="arrow" className="size-4" />
            </Button>
          </div>
        </m.section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-6 text-[12px] text-ink-faint sm:flex-row md:px-6">
          <span>DataBench — a cloud project on Amazon EC2, S3 and IAM.</span>
          <span>Built with React, FastAPI and scikit-learn.</span>
        </div>
      </footer>
    </div>
  );
}
