export const count = (value: number) => value.toLocaleString("en-US");

export const compact = (value: number) =>
  value >= 1000 ? Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value) : String(value);

export function decimal(value: number | null | undefined, places = 3) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  if (Math.abs(value) >= 1e6 || (Math.abs(value) < 1e-4 && value !== 0)) return value.toExponential(2);
  return value.toFixed(places);
}

export const percent = (value: number | null | undefined, places = 1) =>
  value === null || value === undefined ? "—" : `${value.toFixed(places)}%`;

export function duration(ms: number | null | undefined) {
  if (ms === null || ms === undefined) return "—";
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

const ALGORITHM_NAME: Record<string, string> = {
  gradient_boosting: "Gradient boosting",
  random_forest: "Random forest",
  logistic_regression: "Logistic regression",
  decision_tree: "Decision tree",
  ridge: "Ridge regression",
  kmeans: "K-means",
  dbscan: "DBSCAN",
  isolation_forest: "Isolation forest",
};

/** Human label for an algorithm id coming back from the api. */
export function algorithmName(id: string) {
  return ALGORITHM_NAME[id] ?? id.replace(/_/g, " ");
}

export const taskName: Record<string, string> = {
  binary_classification: "Binary classification",
  multiclass_classification: "Multiclass classification",
  regression: "Regression",
  clustering: "Clustering",
};
