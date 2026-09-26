import { useRef } from "react";
import type { ReactNode } from "react";
import { m, useInView } from "motion/react";
import type { HTMLMotionProps } from "motion/react";
import * as Tooltip from "@radix-ui/react-tooltip";
import { Icon } from "./icons";
import { KIND, QUALITY } from "../lib/tokens";
import type { Quality } from "../lib/tokens";
import type { Kind } from "../lib/types";
import { fadeUp, inView, lift, press, spring, tween } from "../lib/motion";

export function Card({
  title,
  action,
  children,
  className = "",
  bodyClass = "p-4",
  hover = false,
  id,
}: {
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClass?: string;
  /** lift on hover -- for cards that are themselves interactive */
  hover?: boolean;
  id?: string;
}) {
  return (
    <m.section
      id={id}
      variants={fadeUp}
      {...(hover ? lift : {})}
      className={`rounded-card border border-line bg-card shadow-sm ${hover ? "hover:shadow-md" : ""} ${className}`}
    >
      {title && (
        <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <h2 className="min-w-0 text-[15px] font-semibold tracking-[-0.01em]">{title}</h2>
          {action}
        </header>
      )}
      <div className={bodyClass}>{children}</div>
    </m.section>
  );
}

/** A card that plays its own entrance when scrolled into view. */
export function RevealCard(props: Parameters<typeof Card>[0]) {
  return (
    <m.div {...inView} className={props.className?.includes("h-full") ? "h-full" : undefined}>
      <Card {...props} />
    </m.div>
  );
}

export function TypeBadge({ kind, short = false }: { kind: Kind; short?: boolean }) {
  const token = KIND[kind];
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-[1px] text-[10px] font-semibold tracking-[0.04em] uppercase ${token.badge}`}
    >
      <Icon name={token.icon} className={`size-3 ${token.text}`} />
      {short ? token.short : kind}
    </span>
  );
}

export function QualityBadge({ quality, children }: { quality: Quality; children?: ReactNode }) {
  const token = QUALITY[quality];
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-[1px] text-[10px] font-semibold tracking-[0.04em] uppercase ${token.soft} ${token.text}`}
    >
      <Icon name={token.icon} className="size-3" />
      {children ?? token.label}
    </span>
  );
}

type ButtonProps = HTMLMotionProps<"button"> & { variant?: "primary" | "ghost" | "danger" | "quiet" };

export function Button({ children, variant = "ghost", className = "", type = "button", ...rest }: ButtonProps) {
  const look = {
    primary: "bg-accent text-accent-ink border-accent shadow-sm hover:brightness-110",
    ghost: "border-line bg-card text-ink hover:bg-hover hover:border-line-strong",
    danger: "border-bad/40 bg-bad/10 text-bad hover:bg-bad/15",
    quiet: "border-transparent text-ink-muted hover:bg-hover hover:text-ink",
  }[variant];
  return (
    <m.button
      type={type}
      {...(rest.disabled ? {} : press)}
      {...rest}
      className={`inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-1.5 text-[13px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${look} ${className}`}
    >
      {children}
    </m.button>
  );
}

/** Square icon-only button; `label` becomes both the aria-label and the tooltip. */
export function IconButton({
  icon,
  label,
  className = "",
  shortcut,
  ...rest
}: Omit<ButtonProps, "children"> & { icon: string; label: string; shortcut?: string }) {
  return (
    <Hint label={label} shortcut={shortcut}>
      <Button variant="quiet" aria-label={label} className={`size-8 !px-0 ${className}`} {...rest}>
        <Icon name={icon} className="size-4" />
      </Button>
    </Hint>
  );
}

/** Tooltip on hover and keyboard focus. */
export function Hint({
  label,
  shortcut,
  children,
  side = "top",
}: {
  label: ReactNode;
  shortcut?: string;
  children: ReactNode;
  side?: "top" | "right" | "bottom" | "left";
}) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          side={side}
          sideOffset={6}
          className="z-50 flex items-center gap-2 rounded-md border border-line bg-card-raised px-2 py-1 text-[12px] text-ink shadow-md"
        >
          {label}
          {shortcut && <Kbd>{shortcut}</Kbd>}
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded border border-line-strong bg-card px-1.5 py-[1px] font-mono text-[10px] text-ink-muted">
      {children}
    </kbd>
  );
}

const FILL = {
  accent: "bg-accent",
  muted: "bg-ink-faint",
  good: "bg-good",
  warn: "bg-warn",
  bad: "bg-bad",
};

/** Horizontal meter used for completeness, importance and score bars. Grows
 *  with scaleX, so it never triggers layout. */
export function Meter({
  value,
  tone = "accent",
  className = "",
  delay = 0,
  label,
}: {
  value: number;
  tone?: keyof typeof FILL;
  className?: string;
  delay?: number;
  /** accessible name; when set the meter is exposed as role=meter */
  label?: string;
}) {
  const clamped = Math.max(0, Math.min(100, value));
  // observe the track, not the fill: a fill at scaleX(0) has no area and never "enters" view
  const track = useRef<HTMLDivElement>(null);
  const seen = useInView(track, { once: true });
  return (
    <div
      ref={track}
      className={`h-1.5 w-full overflow-hidden rounded-full bg-line ${className}`}
      {...(label
        ? { role: "meter", "aria-label": label, "aria-valuenow": Math.round(clamped), "aria-valuemin": 0, "aria-valuemax": 100 }
        : {})}
    >
      <m.div
        className={`h-full origin-left rounded-full ${FILL[tone]}`}
        initial={{ scaleX: 0 }}
        animate={{ scaleX: seen ? clamped / 100 : 0 }}
        transition={{ ...tween.draw, delay }}
      />
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
    <div className="flex items-center gap-2 text-[13px] text-ink-muted" role="status">
      <span className="size-3.5 animate-spin rounded-full border-2 border-line border-t-accent" />
      {label}
    </div>
  );
}

export function Notice({ tone = "bad", children }: { tone?: "bad" | "warn" | "info"; children: ReactNode }) {
  const look = {
    bad: "border-bad/30 bg-bad/10 text-bad",
    warn: "border-warn/30 bg-warn/10 text-warn",
    info: "border-accent/30 bg-accent-soft text-ink",
  }[tone];
  const icon = { bad: "critical", warn: "warn", info: "info" }[tone];
  return (
    <m.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={spring.soft}
      role={tone === "bad" ? "alert" : undefined}
      className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-[13px] ${look}`}
    >
      <Icon name={icon} className="mt-[1px] size-4 shrink-0" />
      <div className="min-w-0">{children}</div>
    </m.div>
  );
}

export function Empty({
  title,
  hint,
  icon = "layers",
  action,
}: {
  title: string;
  hint?: ReactNode;
  icon?: string;
  action?: ReactNode;
}) {
  return (
    <m.div
      variants={fadeUp}
      initial="hidden"
      animate="show"
      className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-center"
    >
      <span className="grid size-14 place-items-center rounded-2xl border border-line bg-card text-ink-muted shadow-sm">
        <Icon name={icon} className="size-6" />
      </span>
      <p className="text-[15px] font-semibold">{title}</p>
      {hint && <p className="max-w-md text-[13px] text-ink-muted">{hint}</p>}
      {action}
    </m.div>
  );
}

/** Error with a retry, for any screen whose data failed to load. */
export function ErrorState({ error, onRetry, title = "Something went wrong" }: { error: unknown; onRetry?: () => void; title?: string }) {
  return (
    <div role="alert" className="flex flex-col items-start gap-3 rounded-card border border-bad/30 bg-bad/5 p-4">
      <div className="flex items-center gap-2 text-bad">
        <Icon name="critical" className="size-4" />
        <p className="text-[14px] font-semibold">{title}</p>
      </div>
      <p className="text-[13px] text-ink-muted">{error instanceof Error ? error.message : String(error)}</p>
      {onRetry && (
        <Button onClick={onRetry}>
          <Icon name="undo" className="size-4" />
          Try again
        </Button>
      )}
    </div>
  );
}

/** Placeholder block for loading states. */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`skeleton ${className}`} />;
}

/** A card-shaped skeleton; `lines` sets how tall it looks. */
export function SkeletonCard({ className = "", lines = 4, chart = false }: { className?: string; lines?: number; chart?: boolean }) {
  return (
    <div className={`rounded-card border border-line bg-card p-4 ${className}`} aria-hidden="true">
      <Skeleton className="h-4 w-1/3" />
      {chart && <Skeleton className="mt-4 h-24 w-full" />}
      <div className="mt-4 space-y-2.5">
        {Array.from({ length: lines }, (_, index) => (
          <Skeleton key={index} className="h-3" />
        ))}
      </div>
    </div>
  );
}

/** Small uppercase label above a section. */
export function Eyebrow({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <p className={`text-[11px] font-semibold tracking-[0.06em] text-ink-faint uppercase ${className}`}>{children}</p>
  );
}
