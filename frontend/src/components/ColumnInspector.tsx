import { useMemo } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, m } from "motion/react";
import { Icon } from "./icons";
import { Button, Eyebrow, IconButton, QualityBadge, Skeleton, TypeBadge } from "./primitives";
import { BoxPlot, HistogramSpark, TimelineDensity, TopNBars } from "./viz/Distribution";
import { useApplyFix } from "./cleaning";
import { fadeUp, spring, stagger, tween } from "../lib/motion";
import { suggestFixes } from "../lib/insights";
import { useProfile } from "../lib/queries";
import { useReturnFocus } from "../lib/useReturnFocus";
import { LEVEL_QUALITY, missingQuality } from "../lib/tokens";
import { count, decimal, percent } from "../lib/format";
import type { ColumnStats } from "../lib/types";
import { useCleaning } from "../state/cleaning";
import { useSession } from "../state/session";
import { useUi } from "../state/ui";

/** Right-hand drawer with everything about one column. Opened from any table
 *  row, profile card or chart; the column name morphs in from where it was
 *  clicked (shared layoutId). */
export function ColumnInspector() {
  const { inspected, inspect } = useUi();
  const { dataset } = useSession();
  const profile = useProfile(dataset?.id);
  const returnFocus = useReturnFocus(Boolean(inspected));
  const column = profile.data?.column_stats.find((c) => c.name === inspected) ?? null;
  const schemaColumn = dataset?.schema.find((c) => c.name === inspected);

  return (
    // non-modal: the page stays live behind the panel, and toasts (with their
    // undo buttons) stay reachable instead of being made inert
    <Dialog.Root modal={false} open={Boolean(inspected)} onOpenChange={(open) => !open && inspect(null)}>
      <AnimatePresence>
        {inspected && (
          <Dialog.Portal forceMount>
            <m.div
              aria-hidden="true"
              className="fixed inset-0 z-40 bg-scrim"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={tween.base}
              onClick={() => inspect(null)}
            />
            <Dialog.Content
              asChild
              forceMount
              aria-describedby={undefined}
              onCloseAutoFocus={returnFocus}
              onOpenAutoFocus={(event) => {
                // focus the panel itself, not the close button (which would pop its tooltip)
                event.preventDefault();
                (event.currentTarget as HTMLElement).focus();
              }}
              onInteractOutside={(event) => {
                // acting on a toast (undo) must not close the panel
                if ((event.target as Element | null)?.closest?.("[data-toaster]")) event.preventDefault();
              }}
            >
              <m.aside
                tabIndex={-1}
                initial={{ x: "100%" }}
                animate={{ x: 0 }}
                exit={{ x: "100%" }}
                transition={spring.soft}
                className="glass-sheet fixed inset-y-0 right-0 z-50 flex w-full max-w-[34rem] flex-col border-l border-line outline-none sm:inset-y-2 sm:right-2 sm:rounded-[20px] sm:border"
              >
                <header className="flex items-start gap-3 border-b border-line px-5 py-4">
                  <div className="min-w-0 flex-1">
                    <Eyebrow>Column</Eyebrow>
                    <Dialog.Title asChild>
                      <m.h2 layoutId={`col-name-${inspected}`} className="mt-1 truncate font-mono text-[17px] font-semibold">
                        {inspected}
                      </m.h2>
                    </Dialog.Title>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {schemaColumn && <TypeBadge kind={schemaColumn.kind} />}
                      {schemaColumn && <span className="font-mono text-[11px] text-ink-faint">stored as {schemaColumn.dtype}</span>}
                      {schemaColumn && !schemaColumn.modelable && <QualityBadge quality="warning">not a feature</QualityBadge>}
                    </div>
                  </div>
                  <Dialog.Close asChild>
                    <IconButton icon="close" label="Close inspector" shortcut="Esc" />
                  </Dialog.Close>
                </header>

                <div className="flex-1 overflow-y-auto px-5 py-4">
                  {profile.isPending && (
                    <div className="space-y-3" aria-label="Loading column profile">
                      <Skeleton className="h-4 w-2/3" />
                      <Skeleton className="h-28 w-full" />
                      <Skeleton className="h-20 w-full" />
                    </div>
                  )}
                  {profile.error && <p className="text-[13px] text-bad">{(profile.error as Error).message}</p>}
                  {column && <InspectorBody key={column.name} column={column} />}
                </div>
              </m.aside>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <m.section variants={fadeUp} className="border-b border-line py-4 first:pt-0 last:border-0">
      <h3 className="mb-3 text-[13px] font-semibold">{title}</h3>
      {children}
    </m.section>
  );
}

function InspectorBody({ column }: { column: ColumnStats }) {
  const { dataset } = useSession();
  const profile = useProfile(dataset?.id);
  const { inspect } = useUi();
  const { has } = useCleaning();
  const apply = useApplyFix(profile.data);
  const fixes = useMemo(() => suggestFixes(column), [column]);
  const warnings = profile.data?.warnings.filter((warning) => warning.column === column.name) ?? [];
  const related = profile.data?.correlations.filter((pair) => pair.a === column.name || pair.b === column.name) ?? [];
  const numeric = column.kind === "numeric";

  // nulls in the preview, in row order: the missing pattern for this column
  const pattern = useMemo(() => {
    const index = dataset?.preview.columns.indexOf(column.name) ?? -1;
    return index < 0 ? [] : dataset!.preview.rows.map((row) => row[index] === null || row[index] === "");
  }, [dataset, column.name]);

  const stats: [string, string][] = [
    ["Unique", `${count(column.unique)} (${percent(column.unique_pct, 1)})`],
    ["Missing", percent(column.missing_pct, 2)],
    ...(numeric
      ? ([
          ["Min", decimal(column.min as number, 3)],
          ["Max", decimal(column.max as number, 3)],
          ["Mean", decimal(column.mean, 3)],
          ["Median", decimal(column.median, 3)],
          ["Std", decimal(column.std, 3)],
          ["Skew", decimal(column.skew, 2)],
          ["Zeros", percent(column.zeros_pct, 1)],
          ["Negative", percent(column.negative_pct, 1)],
        ] as [string, string][])
      : []),
    ...(column.kind === "datetime" ? ([["From", String(column.min).slice(0, 10)], ["To", String(column.max).slice(0, 10)], ["Span", `${count(column.span_days ?? 0)} days`]] as [string, string][]) : []),
    ...(column.kind === "text" ? ([["Avg length", decimal(column.avg_length, 0)], ["Max length", String(column.max_length ?? "—")]] as [string, string][]) : []),
    ...(column.balance !== undefined ? ([["Balance", decimal(column.balance, 2)]] as [string, string][]) : []),
  ];

  return (
    <m.div variants={stagger(0.06, 0.1)} initial="hidden" animate="show">
      <m.p variants={fadeUp} className="mb-4 flex items-start gap-2 text-[12px] text-ink-muted italic">
        <Icon name="info" className="mt-[1px] size-3.5 shrink-0 not-italic" />
        {column.reason}
      </m.p>

      <Section title="Statistics">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-[13px]">
          {stats.map(([label, value]) => (
            <div key={label} className="flex justify-between gap-2 border-b border-line/60 pb-1">
              <dt className="text-ink-muted">{label}</dt>
              <dd className="tnum font-medium">{value}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section title="Distribution">
        {column.histogram && <HistogramSpark counts={column.histogram.counts} edges={column.histogram.edges} height={96} />}
        {numeric && (
          <div className="mt-4">
            <BoxPlot column={column} />
          </div>
        )}
        {column.top_values && <TopNBars values={column.top_values} limit={8} />}
        {column.by_month && <TimelineDensity byMonth={column.by_month} height={80} />}
        {!column.histogram && !column.top_values && !column.by_month && <p className="text-[13px] text-ink-muted">No distribution for a {column.kind} column.</p>}
      </Section>

      <Section title="Missing pattern">
        <div className="flex items-center gap-2">
          <QualityBadge quality={missingQuality(column.missing_pct)}>{percent(column.missing_pct, 1)} overall</QualityBadge>
          <span className="text-[11px] text-ink-faint">first {pattern.length} rows, left to right</span>
        </div>
        <div className="mt-2 flex h-5 gap-px overflow-hidden rounded" role="img" aria-label={`${pattern.filter(Boolean).length} of the first ${pattern.length} rows are null`}>
          {pattern.map((missing, index) => (
            <m.span
              key={index}
              className={`flex-1 ${missing ? "bg-bad" : "bg-line"}`}
              initial={{ scaleY: 0 }}
              animate={{ scaleY: 1 }}
              transition={{ ...tween.base, delay: 0.2 + index * 0.008 }}
            />
          ))}
        </div>
      </Section>

      {warnings.length > 0 && (
        <Section title="Flagged by the profiler">
          <ul className="space-y-2">
            {warnings.map((warning, index) => (
              <li key={index} className="flex items-start gap-2 text-[13px]">
                <QualityBadge quality={LEVEL_QUALITY[warning.level]}>{warning.level}</QualityBadge>
                <span className="text-ink-muted">{warning.issue}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="Suggested fixes">
        {fixes.length === 0 && <p className="text-[13px] text-ink-muted">Nothing to fix — this column is ready to use.</p>}
        <ul className="space-y-2">
          {fixes.map((fix) => {
            const staged = has(column.name, fix.action);
            return (
              <m.li key={fix.action + (fix.option ?? "")} layout className="flex items-start gap-3 rounded-xl border border-line bg-card p-3">
                <Icon name={fix.action === "drop" ? "trash" : fix.action === "impute" ? "droplet" : "wand"} className="mt-[2px] size-4 shrink-0 text-ink-muted" />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium">{fix.label}</p>
                  <p className="text-[12px] text-ink-muted">{fix.why}</p>
                </div>
                <AnimatePresence mode="wait" initial={false}>
                  {staged ? (
                    <m.span
                      key="staged"
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={spring.snappy}
                      className="flex shrink-0 items-center gap-1 rounded-lg border border-good/30 bg-good/10 px-2.5 py-1.5 text-[12px] font-medium text-good"
                    >
                      <Icon name="tick" className="size-3.5" /> Staged
                    </m.span>
                  ) : (
                    <m.span key="stage" exit={{ opacity: 0, scale: 0.9 }} transition={tween.fast} className="shrink-0">
                      <Button onClick={() => apply(column, fix)} aria-label={`Stage ${fix.label}`}>
                        Stage
                      </Button>
                    </m.span>
                  )}
                </AnimatePresence>
              </m.li>
            );
          })}
        </ul>
        <p className="mt-2 text-[11px] text-ink-faint">Staged fixes are collected on the Clean screen; they do not change the data yet.</p>
      </Section>

      {related.length > 0 && (
        <Section title="Moves together with">
          <ul className="space-y-1">
            {related.map((pair) => {
              const other = pair.a === column.name ? pair.b : pair.a;
              return (
                <li key={other}>
                  <button type="button" onClick={() => inspect(other)} className="flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left text-[13px] transition-colors hover:bg-hover">
                    <span className="flex-1 truncate font-mono">{other}</span>
                    <span className={`tnum font-medium ${pair.r >= 0 ? "text-numeric" : "text-warn"}`}>
                      {pair.r > 0 ? "+" : "−"}
                      {Math.abs(pair.r).toFixed(2)}
                    </span>
                    <Icon name="next" className="size-3.5 text-ink-faint" />
                  </button>
                </li>
              );
            })}
          </ul>
        </Section>
      )}
    </m.div>
  );
}
