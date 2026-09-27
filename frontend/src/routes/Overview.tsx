import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import * as Popover from "@radix-ui/react-popover";
import { AnimatePresence, LayoutGroup, m } from "motion/react";
import { Shell, ExportButton } from "../components/Shell";
import { Button, Card, Empty, ErrorState, Hint, IconTile, QualityBadge, Skeleton, SkeletonCard } from "../components/primitives";
import type { TileTone } from "../components/primitives";
import { DataTable } from "../components/DataTable";
import { Icon } from "../components/icons";
import { useApplyFix } from "../components/cleaning";
import { HealthRing } from "../components/viz/HealthRing";
import { TypeDonut } from "../components/viz/TypeDonut";
import { MissingBars, MissingMatrixChart } from "../components/viz/Missing";
import { CardinalityCard, DuplicatesCard } from "../components/viz/QualityCards";
import { CountUp, fadeUp, spring, stagger, tween } from "../lib/motion";
import { healthScore, suggestFixes, typeComposition } from "../lib/insights";
import { useProfile } from "../lib/queries";
import { KIND, KIND_ORDER, QUALITY, missingQuality } from "../lib/tokens";
import { compact, duration, percent } from "../lib/format";
import type { Column, ColumnStats, Kind } from "../lib/types";
import { useWindow } from "../lib/useWindow";
import { useCleaning } from "../state/cleaning";
import { useSession } from "../state/session";
import { useUi } from "../state/ui";

function HeroStat({ label, value, format, hint, icon, tone }: { label: string; value: number; format?: (n: number) => string; hint?: string; icon: string; tone: TileTone }) {
  return (
    <m.div variants={fadeUp} className="flex min-w-0 items-start gap-3 glass rounded-card border border-line px-3 py-3 sm:px-4 sm:py-3.5">
      <span className="hidden sm:block">
        <IconTile icon={icon} tone={tone} />
      </span>
      <div className="min-w-0">
        <p className="truncate text-[11px] font-semibold tracking-[0.04em] text-ink-muted uppercase">{label}</p>
        <p className="tnum mt-0.5 text-[19px] leading-tight font-semibold sm:text-[24px]">
          <CountUp value={value} format={format} />
        </p>
        {hint && <p className="hidden truncate text-[11px] text-ink-faint sm:block">{hint}</p>}
      </div>
    </m.div>
  );
}

export function Overview() {
  const { dataset } = useSession();
  const navigate = useNavigate();
  const { inspect } = useUi();
  const profile = useProfile(dataset?.id);
  const [kindFilter, setKindFilter] = useState<Kind | null>(null);

  const health = useMemo(() => (profile.data ? healthScore(profile.data) : null), [profile.data]);
  const composition = useMemo(() => (dataset ? typeComposition(dataset.schema) : []), [dataset]);

  if (!dataset) return <NoDataset />;
  const { meta, schema, preview } = dataset;

  return (
    <Shell
      title="Dataset overview"
      subtitle={meta.name}
      actions={
        <>
          <ExportButton data={{ meta, schema }} name={`${meta.name}.schema.json`} />
          <Button variant="primary" onClick={() => navigate("/analyse")}>
            <Icon name="chart" className="size-4" />
            Analyse columns
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* hero: the four numbers that say what this dataset is */}
        <m.div variants={stagger(0.06)} className="grid grid-cols-3 gap-2 sm:gap-3 xl:grid-cols-[minmax(0,1.7fr)_repeat(3,minmax(0,1fr))]">
          <m.div variants={fadeUp} className="flex items-center gap-4 glass rounded-card border border-line px-4 py-3 col-span-3 xl:col-span-1">
            {health ? (
              <HealthRing health={health} size={92} showBreakdown />
            ) : profile.error ? (
              <p className="text-[12px] text-ink-muted">Health needs the profile, which failed to load.</p>
            ) : (
              <div className="flex w-full items-center gap-4" aria-label="Computing health score">
                <Skeleton className="size-[92px] shrink-0 !rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3" />
                  <Skeleton className="h-3 w-4/5" />
                  <Skeleton className="h-3 w-3/5" />
                </div>
              </div>
            )}
          </m.div>
          <HeroStat label="Rows" value={meta.rows} icon="layers" tone="sky" hint={meta.truncated ? "truncated on read" : `${meta.format} · read in ${duration(meta.read_ms)}`} />
          <HeroStat label="Columns" value={meta.columns} icon="grid" tone="indigo" hint={`${schema.filter((c) => c.modelable).length} usable as features`} />
          <HeroStat label="In memory" value={meta.memory_mb} format={(n) => `${n.toFixed(1)} MB`} icon="file" tone="purple" />
        </m.div>

        {/* infographics */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_minmax(0,1fr)]">
          <Card title="Column types" icon="layers" tone="indigo" action={kindFilter && <FilterChip kind={kindFilter} onClear={() => setKindFilter(null)} />}>
            <TypeDonut composition={composition} onSelect={(kind) => setKindFilter((current) => (current === kind ? null : kind))} />
          </Card>
          <Card title="Missing values" icon="droplet" tone="pink" action={<span className="text-[11px] text-ink-faint">preview rows</span>}>
            <MissingMatrixChart preview={preview} onSelect={inspect} />
          </Card>
          <Card title="Most incomplete columns" icon="filter" tone="violet" className="lg:col-span-2 2xl:col-span-1">
            {profile.data ? (
              <MissingBars columns={profile.data.column_stats} limit={7} onSelect={inspect} />
            ) : profile.error ? (
              <ErrorState error={profile.error} onRetry={() => profile.refetch()} title="Profile failed" />
            ) : (
              <div className="space-y-2.5">
                {Array.from({ length: 6 }, (_, i) => (
                  <Skeleton key={i} className="h-3" />
                ))}
              </div>
            )}
          </Card>
          {profile.data ? (
            <>
              <Card>
                <DuplicatesCard profile={profile.data} />
              </Card>
              <Card className="2xl:col-span-2">
                <CardinalityCard columns={profile.data.column_stats} onSelect={inspect} />
              </Card>
            </>
          ) : (
            !profile.error && (
              <>
                <SkeletonCard lines={2} />
                <SkeletonCard lines={2} chart className="2xl:col-span-2" />
              </>
            )
          )}
        </div>

        <ColumnTable schema={schema} stats={profile.data?.column_stats} kindFilter={kindFilter} setKindFilter={setKindFilter} />

        <Card icon="file" tone="graphite" title={`Preview (first ${preview.rows.length})`} action={<span className="tnum text-[11px] text-ink-faint">of {compact(meta.rows)} rows</span>} bodyClass="p-3">
          <DataTable preview={preview} maxHeight="24rem" />
        </Card>
      </div>
    </Shell>
  );
}

function FilterChip({ kind, onClear }: { kind: Kind; onClear: () => void }) {
  return (
    <button type="button" onClick={onClear} className="flex items-center gap-1 rounded-full border border-accent/40 bg-accent-soft px-2 py-0.5 text-[11px] font-medium">
      {KIND[kind].label}
      <Icon name="close" className="size-3" />
      <span className="sr-only">clear filter</span>
    </button>
  );
}

type SortKey = "index" | "name" | "kind" | "missing" | "unique";
const ROW = 44;

function ColumnTable({
  schema,
  stats,
  kindFilter,
  setKindFilter,
}: {
  schema: Column[];
  stats?: ColumnStats[];
  kindFilter: Kind | null;
  setKindFilter: (kind: Kind | null) => void;
}) {
  const { inspect } = useUi();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "index", dir: 1 });
  const scroller = useRef<HTMLDivElement>(null);
  const byName = useMemo(() => new Map((stats ?? []).map((column) => [column.name, column])), [stats]);

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const list = schema
      .map((column, index) => ({ column, index, stats: byName.get(column.name) }))
      .filter((row) => (!kindFilter || row.column.kind === kindFilter) && (!needle || row.column.name.toLowerCase().includes(needle)));
    const value = (row: (typeof list)[number]): number | string => {
      switch (sort.key) {
        case "name":
          return row.column.name.toLowerCase();
        case "kind":
          return KIND_ORDER.indexOf(row.column.kind);
        case "missing":
          return row.stats?.missing_pct ?? -1;
        case "unique":
          return row.stats?.unique_pct ?? -1;
        default:
          return row.index;
      }
    };
    return [...list].sort((a, b) => (value(a) < value(b) ? -sort.dir : value(a) > value(b) ? sort.dir : a.index - b.index));
  }, [schema, byName, query, kindFilter, sort]);

  const slice = useWindow(scroller, rows.length, ROW);
  // layout animation on hundreds of rows costs more than it shows; windowed tables skip it
  const animate = !slice.active;

  const header = (key: SortKey, label: string, className = "") => {
    const active = sort.key === key;
    return (
      <th scope="col" className={`border-b border-line px-3 py-2 text-left ${className}`} aria-sort={active ? (sort.dir === 1 ? "ascending" : "descending") : "none"}>
        <button
          type="button"
          onClick={() => setSort((current) => ({ key, dir: current.key === key ? (current.dir === 1 ? -1 : 1) : key === "missing" || key === "unique" ? -1 : 1 }))}
          className={`inline-flex items-center gap-1 rounded transition-colors hover:text-ink ${active ? "text-ink" : ""}`}
        >
          {label}
          <m.span animate={{ rotate: active && sort.dir === -1 ? 180 : 0, opacity: active ? 1 : 0.35 }} transition={spring.snappy}>
            <Icon name="up" className="size-3" />
          </m.span>
        </button>
      </th>
    );
  };

  return (
    <Card
      icon="grid"
      tone="blue"
      title={`Columns (${rows.length}${rows.length !== schema.length ? ` of ${schema.length}` : ""})`}
      bodyClass="p-0"
      action={
        <div className="flex items-center gap-2">
          <label className="relative">
            <span className="sr-only">Filter columns</span>
            <Icon name="search" className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-ink-faint" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Filter…"
              className="w-36 rounded-lg border border-line bg-card py-1 pr-2 pl-8 text-[12px] transition-[width,box-shadow] outline-none placeholder:text-ink-faint focus:w-48 focus:border-accent focus:ring-4 focus:ring-accent/20 sm:w-44 sm:focus:w-56"
            />
          </label>
          {kindFilter && <FilterChip kind={kindFilter} onClear={() => setKindFilter(null)} />}
        </div>
      }
    >
      <div ref={scroller} className="max-h-[32rem] overflow-auto">
        <table className="w-full min-w-[46rem] border-collapse text-[13px]">
          <thead className="sticky top-0 z-10 bg-card-raised">
            <tr className="text-[11px] font-medium text-ink-muted">
              {header("index", "#", "w-12 text-right")}
              {header("name", "Name")}
              {header("kind", "Type", "w-36")}
              {header("missing", "Missing", "w-48")}
              {header("unique", "Unique", "w-24")}
              <th scope="col" className="border-b border-line px-3 py-2 text-left">Why</th>
              <th scope="col" className="w-12 border-b border-line px-3 py-2">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <LayoutGroup>
            <tbody>
              {slice.padTop > 0 && <tr style={{ height: slice.padTop }} aria-hidden="true" />}
              <AnimatePresence initial={false}>
                {rows.slice(slice.start, slice.end).map((row) => (
                  <ColumnRow key={row.column.name} {...row} animate={animate} onOpen={() => inspect(row.column.name)} />
                ))}
              </AnimatePresence>
              {slice.padBottom > 0 && <tr style={{ height: slice.padBottom }} aria-hidden="true" />}
            </tbody>
          </LayoutGroup>
        </table>
        {rows.length === 0 && (
          <p className="px-4 py-8 text-center text-[13px] text-ink-muted">
            No column matches{query ? ` “${query}”` : ""}{kindFilter ? ` of type ${KIND[kindFilter].label.toLowerCase()}` : ""}.
          </p>
        )}
      </div>
    </Card>
  );
}

function ColumnRow({ column, index, stats, animate, onOpen }: { column: Column; index: number; stats?: ColumnStats; animate: boolean; onOpen: () => void }) {
  const token = KIND[column.kind];
  const quality = stats ? missingQuality(stats.missing_pct) : null;
  return (
    <m.tr
      layout={animate ? "position" : false}
      initial={animate ? { opacity: 0 } : false}
      animate={{ opacity: column.modelable ? 1 : 0.6 }}
      exit={animate ? { opacity: 0, transition: tween.fast } : undefined}
      transition={spring.soft}
      onClick={onOpen}
      className="group cursor-pointer transition-colors hover:bg-hover"
      style={{ height: ROW }}
    >
      <td className="tnum border-b border-line/60 px-3 text-right text-[11px] text-ink-faint">{index + 1}</td>
      <td className="border-b border-line/60 px-3">
        <button type="button" onClick={(event) => { event.stopPropagation(); onOpen(); }} className="flex max-w-[16rem] items-center gap-2 text-left transition-transform group-hover:translate-x-0.5">
          <m.span layoutId={`col-name-${column.name}`} className="truncate font-mono whitespace-nowrap">
            {column.name}
          </m.span>
          {!column.modelable && <span className="shrink-0 rounded border border-line px-1 text-[9px] text-ink-faint uppercase">not a feature</span>}
        </button>
      </td>
      <td className="border-b border-line/60 px-3">
        <span className={`inline-flex items-center gap-1.5 text-[12px] ${token.text}`}>
          <Icon name={token.icon} className="size-3.5" />
          <span className="text-ink">{token.label}</span>
          <span className="font-mono text-[10px] text-ink-faint">{column.dtype}</span>
        </span>
      </td>
      <td className="border-b border-line/60 px-3">
        {stats && quality ? (
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-20 overflow-hidden rounded-full bg-line">
              <m.span
                className={`block h-full origin-left rounded-full ${QUALITY[quality].bg}`}
                initial={{ scaleX: 0 }}
                animate={{ scaleX: Math.max(stats.missing_pct, stats.missing_pct > 0 ? 3 : 0) / 100 }}
                transition={tween.draw}
              />
            </span>
            <span className={`tnum flex items-center gap-1 text-[12px] ${stats.missing_pct > 0 ? QUALITY[quality].text : "text-ink-faint"}`}>
              {stats.missing_pct > 0 && <Icon name={QUALITY[quality].icon} className="size-3" />}
              {percent(stats.missing_pct, stats.missing_pct > 0 && stats.missing_pct < 10 ? 1 : 0)}
            </span>
          </div>
        ) : (
          <Skeleton className="h-2 w-24" />
        )}
      </td>
      <td className="tnum border-b border-line/60 px-3 text-[12px] text-ink-muted">{stats ? compact(stats.unique) : <Skeleton className="h-2 w-10" />}</td>
      <td className="max-w-[20rem] truncate border-b border-line/60 px-3 text-[12px] text-ink-muted italic" title={column.reason}>
        {column.reason}
      </td>
      <td className="border-b border-line/60 px-2" onClick={(event) => event.stopPropagation()}>
        {stats && <QuickActions column={stats} />}
      </td>
    </m.tr>
  );
}

/** Drop / impute / cast / encode from the table row, via a small popover. */
function QuickActions({ column }: { column: ColumnStats }) {
  const { dataset } = useSession();
  const profile = useProfile(dataset?.id);
  const apply = useApplyFix(profile.data);
  const { has } = useCleaning();
  const [open, setOpen] = useState(false);
  const fixes = suggestFixes(column);
  const drop = fixes.find((fix) => fix.action === "drop") ?? { action: "drop" as const, label: "Drop column", why: "exclude it from the model" };
  const options = [drop, ...fixes.filter((fix) => fix.action !== "drop")];

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Hint label="Quick actions">
        <Popover.Trigger asChild>
          <button type="button" aria-label={`Actions for ${column.name}`} className="grid size-7 place-items-center rounded-md text-ink-faint opacity-60 transition hover:bg-card-raised hover:text-ink group-hover:opacity-100 focus-visible:opacity-100">
            <Icon name="wand" className="size-4" />
          </button>
        </Popover.Trigger>
      </Hint>
      <AnimatePresence>
        {open && (
          <Popover.Portal forceMount>
            <Popover.Content asChild forceMount align="end" sideOffset={4}>
              <m.div
                initial={{ opacity: 0, scale: 0.95, y: -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={spring.snappy}
                className="z-50 w-64 glass-sheet origin-top-right rounded-[14px] border border-line p-1.5"
              >
                <p className="truncate px-2 pt-1 pb-1.5 font-mono text-[11px] text-ink-faint">{column.name}</p>
                {options.map((fix) => {
                  const staged = has(column.name, fix.action);
                  return (
                    <button
                      key={fix.action}
                      type="button"
                      disabled={staged}
                      onClick={() => {
                        apply(column, fix);
                        setOpen(false);
                      }}
                      className="flex w-full items-start gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-hover disabled:opacity-60"
                    >
                      <Icon name={fix.action === "drop" ? "trash" : fix.action === "impute" ? "droplet" : "wand"} className={`mt-[2px] size-3.5 shrink-0 ${fix.action === "drop" ? "text-bad" : "text-ink-muted"}`} />
                      <span className="min-w-0">
                        <span className="flex items-center gap-1.5 text-[13px] font-medium">
                          {fix.label}
                          {staged && <QualityBadge quality="good">staged</QualityBadge>}
                        </span>
                        <span className="block text-[11px] text-ink-muted">{fix.why}</span>
                      </span>
                    </button>
                  );
                })}
              </m.div>
            </Popover.Content>
          </Popover.Portal>
        )}
      </AnimatePresence>
    </Popover.Root>
  );
}

export function NoDataset() {
  const navigate = useNavigate();
  return (
    <Shell>
      <Empty
        icon="upload"
        title="No dataset loaded"
        hint="Every screen here works on one dataset at a time. Load a file to get started."
        action={
          <Button variant="primary" onClick={() => navigate("/upload")}>
            <Icon name="upload" className="size-4" />
            Go to upload
          </Button>
        }
      />
    </Shell>
  );
}

