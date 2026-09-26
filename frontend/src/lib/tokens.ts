/** Design tokens the TypeScript side needs by name: the semantic palettes for
 *  column kinds and data quality. The colours themselves live in index.css;
 *  these map meaning -> tailwind class / css var, plus a glyph and a word so
 *  nothing is ever encoded by colour alone. */
import type { Kind } from "./types";

export interface KindToken {
  label: string;
  short: string;
  icon: string;
  /** css custom property, for svg fills */
  color: string;
  text: string;
  bg: string;
  badge: string;
}

// class names are spelled out in full so tailwind's scanner can find them
export const KIND: Record<Kind, KindToken> = {
  numeric: {
    label: "Numeric",
    short: "num",
    icon: "kind-numeric",
    color: "var(--kind-numeric)",
    text: "text-numeric",
    bg: "bg-numeric",
    badge: "text-numeric border-numeric/30 bg-numeric/10",
  },
  categorical: {
    label: "Categorical",
    short: "cat",
    icon: "kind-categorical",
    color: "var(--kind-categorical)",
    text: "text-categorical",
    bg: "bg-categorical",
    badge: "text-categorical border-categorical/30 bg-categorical/10",
  },
  boolean: {
    label: "Boolean",
    short: "bool",
    icon: "kind-boolean",
    color: "var(--kind-boolean)",
    text: "text-boolean",
    bg: "bg-boolean",
    badge: "text-boolean border-boolean/30 bg-boolean/10",
  },
  datetime: {
    label: "Datetime",
    short: "date",
    icon: "kind-datetime",
    color: "var(--kind-datetime)",
    text: "text-datetime",
    bg: "bg-datetime",
    badge: "text-datetime border-datetime/30 bg-datetime/10",
  },
  text: {
    label: "Text",
    short: "text",
    icon: "kind-text",
    color: "var(--kind-text)",
    text: "text-text",
    bg: "bg-text",
    badge: "text-text border-text/30 bg-text/10",
  },
  identifier: {
    label: "Identifier",
    short: "id",
    icon: "kind-identifier",
    color: "var(--kind-identifier)",
    text: "text-identifier",
    bg: "bg-identifier",
    badge: "text-identifier border-identifier/30 bg-identifier/10",
  },
  constant: {
    label: "Constant",
    short: "const",
    icon: "kind-constant",
    color: "var(--kind-constant)",
    text: "text-constant",
    bg: "bg-constant",
    badge: "text-constant border-constant/30 bg-constant/10",
  },
  empty: {
    label: "Empty",
    short: "empty",
    icon: "kind-empty",
    color: "var(--kind-constant)",
    text: "text-constant",
    bg: "bg-constant",
    badge: "text-constant border-constant/30 bg-constant/10",
  },
};

/** Order kinds appear in legends: most useful for modelling first. */
export const KIND_ORDER: Kind[] = [
  "numeric",
  "categorical",
  "datetime",
  "text",
  "boolean",
  "identifier",
  "constant",
  "empty",
];

export type Quality = "good" | "warning" | "critical";

export const QUALITY: Record<Quality, { label: string; icon: string; color: string; text: string; bg: string; soft: string }> = {
  good: { label: "Good", icon: "ok", color: "var(--good)", text: "text-good", bg: "bg-good", soft: "border-good/30 bg-good/10" },
  warning: { label: "Warning", icon: "warn", color: "var(--warn)", text: "text-warn", bg: "bg-warn", soft: "border-warn/30 bg-warn/10" },
  critical: {
    label: "Critical",
    icon: "critical",
    color: "var(--bad)",
    text: "text-bad",
    bg: "bg-bad",
    soft: "border-bad/30 bg-bad/10",
  },
};

/** Grade a missing-value share. 5% and 40% match the backend's own warning floor. */
export function missingQuality(pct: number): Quality {
  if (pct >= 40) return "critical";
  if (pct >= 5) return "warning";
  return "good";
}

/** Grade a 0-100 score where higher is better. */
export function scoreQuality(score: number): Quality {
  if (score >= 80) return "good";
  if (score >= 55) return "warning";
  return "critical";
}

export const LEVEL_QUALITY = { high: "critical", medium: "warning", low: "good" } as const;
