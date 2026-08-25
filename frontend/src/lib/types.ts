/** Mirrors of what backend/ads returns. Kept flat and boring on purpose. */

export type Kind =
  | "numeric"
  | "categorical"
  | "boolean"
  | "datetime"
  | "text"
  | "identifier"
  | "constant"
  | "empty";

export interface Meta {
  name: string;
  format: string;
  rows: number;
  columns: number;
  memory_mb: number;
  truncated: boolean;
  read_ms: number;
}

export interface Column {
  name: string;
  dtype: string;
  kind: Kind;
  reason: string;
  modelable: boolean;
}

export interface Preview {
  columns: string[];
  rows: (string | number | boolean | null)[][];
}

export interface Loaded {
  id: string;
  meta: Meta;
  schema: Column[];
  preview: Preview;
  suggested_targets: { name: string; kind: Kind }[];
}

export interface TopValue {
  value: string | number | boolean | null;
  count: number;
  pct: number;
}

export interface ColumnStats extends Column {
  missing_pct: number;
  unique: number;
  unique_pct: number;
  min?: number | string;
  max?: number | string;
  mean?: number;
  std?: number;
  median?: number;
  q1?: number;
  q3?: number;
  zeros_pct?: number;
  negative_pct?: number;
  skew?: number;
  outliers?: number;
  outliers_pct?: number;
  histogram?: { counts: number[]; edges: number[] };
  span_days?: number;
  by_month?: Record<string, number>;
  top_values?: TopValue[];
  balance?: number;
  avg_length?: number;
  max_length?: number;
}

export interface Warning {
  column: string | null;
  level: "high" | "medium" | "low";
  issue: string;
}

export interface Profile {
  rows: number;
  columns: number;
  sampled_rows: number;
  duplicate_rows: number;
  missing_cells_pct: number;
  column_stats: ColumnStats[];
  correlations: { a: string; b: string; r: number }[];
  warnings: Warning[];
  profile_ms: number;
}

export type Task =
  | "binary_classification"
  | "multiclass_classification"
  | "regression"
  | "clustering";

export interface Plan {
  target: string | null;
  task: Task;
  task_reason: string;
  features: {
    numeric: string[];
    categorical: string[];
    temporal: string[];
    dropped: { name: string; why: string }[];
  };
  target_summary: {
    kind?: "numeric" | "classes";
    min?: number;
    max?: number;
    mean?: number;
    std?: number;
    classes?: number;
    balance?: number;
    imbalanced?: boolean;
    distribution?: { value: string; count: number }[];
  };
  algorithms: { name: string; recommended: boolean; why: string }[];
  notes: string[];
}

export interface Metrics {
  accuracy?: number;
  balanced_accuracy?: number;
  f1?: number;
  roc_auc?: number;
  threshold?: number | null;
  labels?: string[];
  confusion?: number[][];
  test_rows?: number;
  r2?: number;
  mae?: number;
  rmse?: number;
  mape_pct?: number | null;
  clusters?: number;
  silhouette?: number | null;
  sizes?: { cluster: number; count: number }[];
  outliers?: number;
  outliers_pct?: number;
  normal_rows?: number;
}

export interface ModelResult {
  algorithm: string;
  ok: boolean;
  error?: string;
  score: number | null;
  metrics: Metrics;
  importance: { column: string; weight: number }[];
  fit_ms: number;
  labels_preview?: number[];
  examples?: Record<string, string | number | boolean | null>[];
}

export interface Training {
  task: Task;
  target: string | null;
  rows_used: number;
  rows_sampled: boolean;
  score_name: string;
  best: string | null;
  results: ModelResult[];
  train_ms: number;
}

export interface Job {
  id: string;
  dataset: string;
  state: "running" | "done" | "failed";
  plan: Plan;
  started: number;
  result: Training | null;
  error: string | null;
  elapsed_ms?: number;
}
