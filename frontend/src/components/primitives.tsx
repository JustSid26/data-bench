import type { ReactNode } from "react";
import type { Kind } from "../lib/types";

export function Card({
  title,
  action,
  children,
  className = "",
  bodyClass = "p-4",
}: {
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClass?: string;
}) {
  return (
    <section className={`rounded-lg border border-line bg-card ${className}`}>
      {title && (
        <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <h2 className="text-[15px] font-semibold tracking-[-0.01em]">{title}</h2>
          {action}
        </header>
      )}
      <div className={bodyClass}>{children}</div>
    </section>
  );
}

const KIND_CLASS: Record<Kind, string> = {
  numeric: "text-numeric border-numeric/30 bg-numeric/10",
  categorical: "text-categorical border-categorical/30 bg-categorical/10",
  boolean: "text-boolean border-boolean/30 bg-boolean/10",
  datetime: "text-datetime border-datetime/30 bg-datetime/10",
  text: "text-text border-text/30 bg-text/10",
  identifier: "text-identifier border-identifier/30 bg-identifier/10",
  constant: "text-constant border-constant/30 bg-constant/10",
  empty: "text-constant border-constant/30 bg-constant/10",
};

const SHORT: Record<Kind, string> = {
  numeric: "num",
  categorical: "cat",
  boolean: "bool",
  datetime: "date",
  text: "text",
  identifier: "id",
  constant: "const",
  empty: "empty",
};

export function TypeBadge({ kind, short = false }: { kind: Kind; short?: boolean }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full border px-2 py-[1px] text-[10px] font-semibold uppercase tracking-[0.04em] ${KIND_CLASS[kind]}`}
    >
      {short ? SHORT[kind] : kind}
    </span>
  );
}

export function Button({
  children,
  variant = "ghost",
  className = "",
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" }) {
  const look =
    variant === "primary"
      ? "bg-accent text-accent-ink border-accent hover:brightness-110"
      : "border-line text-ink hover:bg-hover";
  return (
    <button
      {...rest}
      className={`inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-1.5 text-[13px] font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${look} ${className}`}
    >
      {children}
    </button>
  );
}

/** Horizontal meter used for completeness, importance and score bars. */
export function Meter({
  value,
  tone = "accent",
  className = "",
}: {
  value: number;
  tone?: "accent" | "muted" | "good" | "warn" | "bad";
  className?: string;
}) {
  const fill = {
    accent: "bg-accent",
    muted: "bg-ink-faint",
    good: "bg-good",
    warn: "bg-warn",
    bad: "bg-bad",
  }[tone];
  return (
    <div className={`h-1.5 w-full overflow-hidden rounded-full bg-line ${className}`}>
      <div className={`h-full rounded-full ${fill}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-[12px] text-ink-muted">{label}</span>
      <span className="tnum text-[13px] font-medium">{children}</span>
    </div>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 text-[13px] text-ink-muted">
      <span className="size-3.5 animate-spin rounded-full border-2 border-line border-t-accent" />
      {label}
    </div>
  );
}

export function Notice({ tone = "bad", children }: { tone?: "bad" | "warn"; children: ReactNode }) {
  const look = tone === "bad" ? "border-bad/30 bg-bad/10 text-bad" : "border-warn/30 bg-warn/10 text-warn";
  return <div className={`rounded-lg border px-3 py-2 text-[13px] ${look}`}>{children}</div>;
}

export function Empty({ title, hint }: { title: string; hint?: ReactNode }) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-2 text-center">
      <p className="text-[15px] font-semibold">{title}</p>
      {hint && <p className="max-w-md text-[13px] text-ink-muted">{hint}</p>}
    </div>
  );
}
