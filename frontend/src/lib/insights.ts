/** Derived views over what the api returns. Pure functions, no fetching: every
 *  infographic binds to one of these, so the charts stay dumb and the rules
 *  that grade the data live in one place. */
import { KIND_ORDER } from "./tokens";
import type { Column, ColumnStats, Kind, Plan, Preview, Profile, Training } from "./types";
import { algorithmName, decimal, percent, taskName } from "./format";

const clamp = (value: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, value));

/* ------------------------------------------------------------ health score */

export interface HealthPart {
  key: "completeness" | "consistency" | "uniqueness" | "outliers";
  label: string;
  value: number;
  weight: number;
  detail: string;
}

export interface Health {
  score: number;
  parts: HealthPart[];
}

/** 0-100 from completeness, type consistency, duplicates and outliers.
 *  Takes the column stats separately so a staged cleaning recipe can pass a
 *  projected set and get a projected score back. */
export function healthScore(profile: Profile, columns: ColumnStats[] = profile.column_stats): Health {
  const n = columns.length || 1;
  const missing = columns.reduce((sum, column) => sum + column.missing_pct, 0) / n;
  const broken = columns.filter((column) => column.kind === "empty" || column.kind === "constant").length;
  const duplicates = profile.sampled_rows ? profile.duplicate_rows / profile.sampled_rows : 0;
  const numeric = columns.filter((column) => column.kind === "numeric");
  const outlierPct = numeric.length
    ? numeric.reduce((sum, column) => sum + (column.outliers_pct ?? 0), 0) / numeric.length
    : 0;

  const parts: HealthPart[] = [
    {
      key: "completeness",
      label: "Completeness",
      value: clamp(100 - missing),
      weight: 0.4,
      detail: `${percent(missing, 1)} of cells are empty`,
    },
    {
      key: "consistency",
      label: "Type consistency",
      value: clamp(100 - (broken / n) * 100),
      weight: 0.2,
      detail: broken ? `${broken} empty or constant column${broken > 1 ? "s" : ""}` : "every column has a usable type",
    },
    {
      key: "uniqueness",
      label: "Uniqueness",
      // duplicates hurt twice as much as their share -- 10% repeated rows is a real problem
      value: clamp(100 - duplicates * 200),
      weight: 0.2,
      detail: `${profile.duplicate_rows.toLocaleString("en-US")} duplicate rows in the sample`,
    },
    {
      key: "outliers",
      label: "Outliers",
      value: clamp(100 - outlierPct * 4),
      weight: 0.2,
      detail: numeric.length ? `${percent(outlierPct, 1)} of numeric values on average` : "no numeric columns",
    },
  ];
  const score = Math.round(parts.reduce((sum, part) => sum + part.value * part.weight, 0));
  return { score, parts };
}

/* ------------------------------------------------------ type composition */

export function typeComposition(schema: Pick<Column, "kind">[]) {
  const counts = new Map<Kind, number>();
  for (const column of schema) counts.set(column.kind, (counts.get(column.kind) ?? 0) + 1);
  return KIND_ORDER.filter((kind) => counts.has(kind)).map((kind) => ({ kind, count: counts.get(kind)! }));
}

/* --------------------------------------------------------- missing matrix */

export interface MissingMatrix {
  columns: string[];
  /** rows × columns, true where the cell is null */
  cells: boolean[][];
  /** share of nulls per shown column, in the preview rows */
  rate: number[];
  sampledColumns: boolean;
}

/** Nulls in the preview rows -- the only per-row data the api hands out. Wide
 *  tables are thinned to `maxColumns` evenly spaced columns so the matrix
 *  stays readable and cheap. */
export function missingMatrix(preview: Preview, maxColumns = 48): MissingMatrix {
  const all = preview.columns.map((name, index) => ({ name, index }));
  const step = Math.max(1, all.length / maxColumns);
  const picked = all.length > maxColumns ? Array.from({ length: maxColumns }, (_, i) => all[Math.floor(i * step)]) : all;
  const cells = preview.rows.map((row) => picked.map(({ index }) => row[index] === null || row[index] === ""));
  const rows = cells.length || 1;
  const rate = picked.map((_, x) => cells.reduce((sum, row) => sum + (row[x] ? 1 : 0), 0) / rows);
  return { columns: picked.map((column) => column.name), cells, rate, sampledColumns: picked.length < all.length };
}

/* ----------------------------------------------------- correlation matrix */

export interface CorrelationMatrix {
  columns: string[];
  /** r where reported, null where |r| was below the backend's 0.5 floor */
  cells: (number | null)[][];
}

/** The api reports only strong pairs (|r| >= 0.5, top 25), so the matrix is
 *  built from those; everything else is shown as "weak" rather than guessed. */
export function correlationMatrix(pairs: Profile["correlations"], maxColumns = 14): CorrelationMatrix {
  const order: string[] = [];
  for (const pair of pairs) {
    for (const name of [pair.a, pair.b]) if (!order.includes(name) && order.length < maxColumns) order.push(name);
  }
  const index = new Map(order.map((name, i) => [name, i]));
  const cells = order.map((_, y) => order.map((_, x) => (x === y ? 1 : null as number | null)));
  for (const pair of pairs) {
    const a = index.get(pair.a);
    const b = index.get(pair.b);
    if (a === undefined || b === undefined) continue;
    cells[a][b] = pair.r;
    cells[b][a] = pair.r;
  }
  return { columns: order, cells };
}

/* ---------------------------------------------------------------- box plot */

export interface BoxStats {
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
  lowWhisker: number;
  highWhisker: number;
  mean?: number;
}

export function boxStats(column: ColumnStats): BoxStats | null {
  const { q1, q3, median } = column;
  const min = typeof column.min === "number" ? column.min : undefined;
  const max = typeof column.max === "number" ? column.max : undefined;
  if ([q1, q3, median, min, max].some((value) => value === undefined || value === null)) return null;
  const iqr = q3! - q1!;
  return {
    min: min!,
    max: max!,
    q1: q1!,
    q3: q3!,
    median: median!,
    lowWhisker: Math.max(min!, q1! - 1.5 * iqr),
    highWhisker: Math.min(max!, q3! + 1.5 * iqr),
    mean: column.mean,
  };
}

/* ------------------------------------------------- fixes and the recipe */

export type CleanAction = "drop" | "impute" | "cast" | "encode" | "scale" | "log" | "clip";

export interface Fix {
  action: CleanAction;
  /** e.g. median / mode / category */
  option?: string;
  label: string;
  why: string;
}

/** Suggested fixes for one column, from its profile. Highest-impact first. */
export function suggestFixes(column: ColumnStats): Fix[] {
  const fixes: Fix[] = [];
  const { kind, missing_pct } = column;
  if (kind === "empty" || kind === "constant") {
    fixes.push({ action: "drop", label: "Drop column", why: kind === "empty" ? "it has no values at all" : "the same value in every row carries no signal" });
    return fixes;
  }
  if (kind === "identifier") {
    fixes.push({ action: "drop", label: "Drop column", why: "ids are unique per row and never generalise" });
  }
  if (missing_pct >= 60) {
    fixes.push({ action: "drop", label: "Drop column", why: `${percent(missing_pct, 0)} missing is too much to fill in honestly` });
  } else if (missing_pct > 0) {
    const option = kind === "numeric" ? ((Math.abs(column.skew ?? 0) >= 1 ? "median" : "mean")) : "mode";
    fixes.push({
      action: "impute",
      option,
      label: `Impute with ${option}`,
      why:
        option === "median"
          ? `fills ${percent(missing_pct, 1)} gaps; median because the column is skewed`
          : `fills ${percent(missing_pct, 1)} gaps with the ${option === "mode" ? "most common value" : "average"}`,
    });
  }
  if (kind === "numeric" && Math.abs(column.skew ?? 0) >= 2 && typeof column.min === "number" && column.min >= 0) {
    fixes.push({ action: "log", label: "Log-transform", why: `skew of ${decimal(column.skew, 1)} squashes most values into a few bins` });
  }
  if (kind === "numeric" && (column.outliers_pct ?? 0) >= 2) {
    fixes.push({ action: "clip", label: "Clip outliers", why: `${percent(column.outliers_pct, 1)} of values sit beyond 1.5 × IQR` });
  }
  if (kind === "numeric") {
    fixes.push({ action: "scale", label: "Standardise", why: "linear models and k-means need features on one scale" });
  }
  if (kind === "categorical" || kind === "boolean") {
    fixes.push({
      action: "encode",
      option: column.unique > 20 ? "frequency" : "one-hot",
      label: column.unique > 20 ? "Frequency-encode" : "One-hot encode",
      why: column.unique > 20 ? `${column.unique} categories would explode into as many columns` : `${column.unique} categories become ${column.unique} indicator columns`,
    });
  }
  if (kind === "text" && column.unique_pct < 5) {
    fixes.push({ action: "cast", option: "categorical", label: "Cast to categorical", why: `only ${column.unique} distinct values -- it behaves like a category` });
  }
  return fixes;
}

export interface RecipeStep extends Fix {
  id: string;
  column: string;
  at: number;
}

/** What a column's stats would look like after the staged steps run. Only
 *  the stats a step provably changes are touched. */
export function projectColumn(column: ColumnStats, steps: RecipeStep[]): ColumnStats | null {
  let next: ColumnStats = { ...column };
  for (const step of steps) {
    if (step.column !== column.name) continue;
    if (step.action === "drop") return null;
    if (step.action === "impute") next = { ...next, missing_pct: 0 };
    if (step.action === "clip") next = { ...next, outliers: 0, outliers_pct: 0 };
    if (step.action === "cast" && step.option === "categorical") next = { ...next, kind: "categorical" };
  }
  return next;
}

export function projectProfile(profile: Profile, steps: RecipeStep[]) {
  return profile.column_stats.map((column) => projectColumn(column, steps)).filter(Boolean) as ColumnStats[];
}

/* ------------------------------------------------------ model reasoning */

/** Data-driven reasons to add under the planner's own "why". Pure rules over
 *  the profile -- no score is invented. */
export function modelReasons(algorithm: string, plan: Plan, profile?: Profile): string[] {
  const reasons: string[] = [];
  const categorical = plan.features.categorical.length;
  const numeric = plan.features.numeric.length;
  const rows = profile?.rows ?? 0;
  const missing = profile?.missing_cells_pct ?? 0;
  const skewed = profile?.column_stats.filter((c) => Math.abs(c.skew ?? 0) >= 2).length ?? 0;
  const tree = ["gradient_boosting", "random_forest", "decision_tree", "isolation_forest"].includes(algorithm);

  if (tree && categorical) reasons.push(`splits on ${categorical} categorical feature${categorical > 1 ? "s" : ""} without needing scaling`);
  if (tree && skewed) reasons.push(`indifferent to the ${skewed} heavily skewed column${skewed > 1 ? "s" : ""}`);
  if (algorithm === "gradient_boosting" && missing > 0) reasons.push(`handles the ${percent(missing, 1)} missing cells natively`);
  if (algorithm === "gradient_boosting" && rows > 10_000) reasons.push("scales well past 10k rows with histogram binning");
  if ((algorithm === "logistic_regression" || algorithm === "ridge") && numeric) reasons.push(`a fast, explainable baseline over ${numeric} numeric feature${numeric > 1 ? "s" : ""}`);
  if (algorithm === "decision_tree") reasons.push("depth 6 keeps the tree readable end to end");
  if (algorithm === "kmeans") reasons.push("k is picked automatically from 2–8 by silhouette score");
  if (plan.target_summary.imbalanced && algorithm !== "ridge") reasons.push("trained with balanced class weights for the uneven target");
  return reasons;
}

/* ---------------------------------------------------------------- report */

/** A markdown summary of a finished run, built client side for download. */
export function trainingReport(name: string, plan: Plan, training: Training) {
  const lines = [
    `# DataBench report — ${name}`,
    "",
    `- **Task:** ${taskName[training.task] ?? training.task}${training.target ? ` (target \`${training.target}\`)` : ""}`,
    `- **Why:** ${plan.task_reason}`,
    `- **Rows used:** ${training.rows_used.toLocaleString("en-US")}${training.rows_sampled ? " (sampled)" : ""}`,
    `- **Features:** ${[...plan.features.numeric, ...plan.features.categorical, ...plan.features.temporal].length}`,
    `- **Trained in:** ${(training.train_ms / 1000).toFixed(1)}s`,
    "",
    `## Leaderboard (${training.score_name})`,
    "",
    "| # | algorithm | score | fit time |",
    "| --- | --- | --- | --- |",
    ...training.results.map((result, index) =>
      result.ok
        ? `| ${index + 1} | ${algorithmName(result.algorithm)} | ${decimal(result.score, 4)} | ${(result.fit_ms / 1000).toFixed(2)}s |`
        : `| — | ${algorithmName(result.algorithm)} | failed: ${result.error} | |`,
    ),
  ];
  const tuned = training.results.filter((result) => result.ok && result.params && Object.keys(result.params).length);
  if (tuned.length) {
    lines.push("", "## Settings used", "");
    for (const result of tuned)
      lines.push(`- **${algorithmName(result.algorithm)}:** ${Object.entries(result.params!).map(([k, v]) => `\`${k}=${v === null ? "none" : v}\``).join(", ")}`);
    if (training.test_size) lines.push(`- **Held out for scoring:** ${Math.round(training.test_size * 100)}%`);
  }
  const best = training.results.find((result) => result.ok);
  if (best?.importance.length) {
    lines.push("", `## What drove ${algorithmName(best.algorithm)}`, "");
    for (const item of best.importance.slice(0, 10)) lines.push(`- \`${item.column}\` — ${percent(item.weight * 100, 1)}`);
  }
  if (plan.notes.length) lines.push("", "## Notes", "", ...plan.notes.map((note) => `- ${note}`));
  return lines.join("\n") + "\n";
}
