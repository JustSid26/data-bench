/** Real numbers shown on the landing page. Titanic figures are DataBench's own
 *  profile of the public Titanic dataset (891 rows) and the balanced accuracy
 *  its models reached on held-out rows; missing shares are the dataset's own. */
import type { Health } from "../../lib/insights";
import type { ColumnStats, ModelResult } from "../../lib/types";

export const TITANIC_HEALTH: Health = {
  score: 91,
  parts: [
    { key: "completeness", label: "Completeness", value: 91.9, weight: 0.4, detail: "8.1% of cells are empty" },
    { key: "consistency", label: "Type consistency", value: 100, weight: 0.2, detail: "every column has a usable type" },
    { key: "uniqueness", label: "Uniqueness", value: 100, weight: 0.2, detail: "0 duplicate rows in the sample" },
    { key: "outliers", label: "Outliers", value: 70.9, weight: 0.2, detail: "7.3% of numeric values on average" },
  ],
};

export const TITANIC_TYPES = [
  { kind: "numeric" as const, count: 2 },
  { kind: "categorical" as const, count: 6 },
  { kind: "boolean" as const, count: 1 },
  { kind: "text" as const, count: 1 },
  { kind: "identifier" as const, count: 2 },
];

export const TITANIC_MISSING = [
  { name: "Cabin", kind: "categorical", missing_pct: 77.1 },
  { name: "Age", kind: "numeric", missing_pct: 19.9 },
  { name: "Embarked", kind: "categorical", missing_pct: 0.2 },
] as unknown as ColumnStats[];

export const TITANIC_SCORES = (
  [
    ["gradient_boosting", 0.7788],
    ["logistic_regression", 0.7707],
    ["random_forest", 0.757],
    ["decision_tree", 0.7136],
  ] as const
).map(([algorithm, score]) => ({ algorithm, score, ok: true, metrics: {}, importance: [], fit_ms: 0 }) as ModelResult);
