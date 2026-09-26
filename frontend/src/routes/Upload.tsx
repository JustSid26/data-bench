import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, m, useReducedMotion } from "motion/react";
import { Shell } from "../components/Shell";
import { Button, Eyebrow, Notice, Skeleton, TypeBadge } from "../components/primitives";
import { DataTable } from "../components/DataTable";
import { Icon } from "../components/icons";
import { useToast } from "../components/ui/Toaster";
import { fadeUp, slideIn, spring, stagger, tween } from "../lib/motion";
import { api } from "../lib/api";
import { uploadWithProgress } from "../lib/upload";
import { typeComposition } from "../lib/insights";
import { count, duration } from "../lib/format";
import type { Loaded } from "../lib/types";
import { useSession } from "../state/session";

type Stage = "idle" | "uploading" | "reading" | "detecting" | "profiling" | "done";

const STEPS: { stage: Stage; label: string }[] = [
  { stage: "uploading", label: "Uploading" },
  { stage: "reading", label: "Reading" },
  { stage: "detecting", label: "Detecting types" },
  { stage: "profiling", label: "Profiling" },
  { stage: "done", label: "Done" },
];
const ORDER: Stage[] = ["idle", "uploading", "reading", "detecting", "profiling", "done"];

const ACCEPT = ".csv,.tsv,.txt,.xlsx,.xlsm,.xls,.parquet,.pq,.json,.jsonl,.ndjson";

function fileIcon(name: string) {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (["json", "jsonl", "ndjson"].includes(ext)) return "file-json";
  if (["xlsx", "xlsm", "xls"].includes(ext)) return "file-sheet";
  if (["parquet", "pq"].includes(ext)) return "file-parquet";
  if (["csv", "tsv", "txt"].includes(ext)) return "file-csv";
  return "file";
}

const bytes = (size: number) =>
  size >= 1e6 ? `${(size / 1e6).toFixed(1)} MB` : size >= 1e3 ? `${(size / 1e3).toFixed(0)} KB` : `${size} B`;

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function Upload() {
  const { open } = useSession();
  const navigate = useNavigate();
  const queries = useQueryClient();
  const toast = useToast();
  const reduced = useReducedMotion();
  const fileInput = useRef<HTMLInputElement>(null);
  const abort = useRef<AbortController | null>(null);
  const [path, setPath] = useState("");
  const [dragging, setDragging] = useState(false);
  const [stage, setStage] = useState<Stage>("idle");
  const [progress, setProgress] = useState(0);
  const [source, setSource] = useState<{ name: string; size?: number } | null>(null);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [failure, setFailure] = useState<Error | null>(null);
  const [profileNote, setProfileNote] = useState<string | null>(null);

  const recent = useQuery({ queryKey: ["datasets"], queryFn: api.list, staleTime: 0 });
  const busy = stage !== "idle" && stage !== "done";

  async function ingest(input: File | string) {
    setFailure(null);
    setLoaded(null);
    setProfileNote(null);
    setProgress(0);
    try {
      let result: Loaded;
      if (typeof input === "string") {
        setSource({ name: input.split("/").pop() || input });
        setStage("reading");
        result = await api.fromPath(input);
      } else {
        setSource({ name: input.name, size: input.size });
        setStage("uploading");
        abort.current = new AbortController();
        result = await uploadWithProgress(
          input,
          (fraction) => {
            setProgress(fraction);
            // bytes are all sent; the server is parsing now
            if (fraction >= 1) setStage("reading");
          },
          abort.current.signal,
        );
      }
      // the schema came back with the response -- hold the step long enough to read it
      setStage("detecting");
      open(result);
      setLoaded(result);
      queries.invalidateQueries({ queryKey: ["datasets"] });
      if (!reduced) await pause(500);

      // warm the profile now, so Overview and Analyse open instantly
      setStage("profiling");
      try {
        await queries.fetchQuery({ queryKey: ["profile", result.id], queryFn: () => api.profile(result.id) });
      } catch (error) {
        setProfileNote((error as Error).message);
      }
      setStage("done");
    } catch (error) {
      setFailure(error as Error);
      setStage("idle");
    } finally {
      abort.current = null;
    }
  }

  const reopen = useMutation({
    mutationFn: async (id: string) => {
      const [described, preview] = await Promise.all([api.describe(id), api.preview(id, 50)]);
      return { ...described, preview } as Loaded;
    },
    onSuccess: (result) => {
      open(result);
      navigate("/overview");
    },
  });

  const forget = useMutation({
    mutationFn: (item: { id: string; name: string }) => api.forget(item.id).then(() => item),
    onSuccess: (item) => {
      queries.invalidateQueries({ queryKey: ["datasets"] });
      toast({ title: `Forgot ${item.name}`, detail: "Removed from the server's cache." });
    },
    onError: (error) => toast({ tone: "bad", title: "Could not forget dataset", detail: (error as Error).message }),
  });

  const drop = (event: React.DragEvent) => {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file && !busy) ingest(file);
  };

  const composition = useMemo(() => (loaded ? typeComposition(loaded.schema) : []), [loaded]);
  const reached = ORDER.indexOf(stage);

  return (
    <Shell>
      <div className="mx-auto flex min-h-full max-w-3xl flex-col justify-center py-10">
        <m.div variants={fadeUp} className="text-center">
          <h1 className="text-[24px] font-semibold tracking-[-0.02em]">Upload a dataset</h1>
          <p className="mt-1.5 text-[13px] text-ink-muted">
            DataBench reads it, types every column, profiles it and suggests the models that fit.
          </p>
        </m.div>

        {/* drop zone: a real button for keyboard users, a drop target for everyone else */}
        <m.button
          type="button"
          variants={fadeUp}
          disabled={busy}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={drop}
          onClick={() => fileInput.current?.click()}
          animate={{ scale: dragging ? 1.015 : 1 }}
          transition={spring.snappy}
          aria-describedby="upload-help"
          className={`relative mt-7 overflow-hidden rounded-card border-2 border-dashed px-6 py-12 text-center transition-colors disabled:cursor-progress ${
            dragging ? "border-accent bg-accent-soft" : "border-line bg-card hover:border-line-strong"
          }`}
        >
          <m.span
            className="mx-auto grid size-14 place-items-center rounded-2xl bg-card-raised text-ink-muted shadow-sm"
            animate={dragging ? { y: -6, scale: 1.08 } : { y: 0, scale: 1 }}
            transition={spring.snappy}
          >
            <Icon name="upload" className="size-6" />
          </m.span>
          <p className="mt-4 text-[15px] font-semibold">{dragging ? "Release to upload" : "Drop a dataset to begin"}</p>
          <p id="upload-help" className="mt-1 text-[13px] text-ink-muted">
            CSV, TSV, Excel, Parquet or JSON — up to 512 MB
          </p>
          <div className="mt-4 flex items-center justify-center gap-3 text-ink-faint" aria-hidden="true">
            {["file-csv", "file-sheet", "file-parquet", "file-json"].map((icon, index) => (
              <m.span key={icon} animate={{ y: dragging ? [0, -4, 0] : 0 }} transition={{ duration: 0.6, delay: index * 0.06, repeat: dragging ? Infinity : 0 }}>
                <Icon name={icon} className="size-5" />
              </m.span>
            ))}
          </div>
          <p className="mt-4 text-[13px] font-medium text-accent-fg">Browse files instead</p>
        </m.button>
        <input
          ref={fileInput}
          type="file"
          accept={ACCEPT}
          className="hidden"
          tabIndex={-1}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) ingest(file);
            event.target.value = "";
          }}
        />

        <AnimatePresence>
          {stage !== "idle" && source && (
            <m.div
              key="progress"
              initial={{ opacity: 0, y: 8, height: 0 }}
              animate={{ opacity: 1, y: 0, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={tween.base}
              className="overflow-hidden"
            >
              <div className="mt-4 rounded-card border border-line bg-card p-4 shadow-sm" aria-live="polite">
                <div className="flex items-center gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent-fg">
                    <Icon name={fileIcon(source.name)} className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-mono text-[13px]">{source.name}</p>
                    <p className="tnum text-[11px] text-ink-faint">
                      {source.size !== undefined ? bytes(source.size) : "local path"}
                      {stage === "uploading" && ` · ${Math.round(progress * 100)}% sent`}
                      {loaded && ` · ${count(loaded.meta.rows)} rows × ${loaded.meta.columns} columns · read in ${duration(loaded.meta.read_ms)}`}
                    </p>
                  </div>
                  {stage === "uploading" && (
                    <Button variant="quiet" onClick={() => abort.current?.abort()}>
                      Cancel
                    </Button>
                  )}
                </div>

                {stage === "uploading" && (
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-line" role="progressbar" aria-label="Upload progress" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100}>
                    <m.div className="h-full origin-left rounded-full bg-accent" animate={{ scaleX: progress }} transition={spring.settle} />
                  </div>
                )}

                <ol className="mt-4 grid grid-cols-5 gap-1" aria-label="Ingest steps">
                  {STEPS.map((step) => {
                    const index = ORDER.indexOf(step.stage);
                    const skipped = step.stage === "uploading" && source.size === undefined;
                    const state = skipped ? "skipped" : index < reached || stage === "done" ? "done" : index === reached ? "active" : "todo";
                    return (
                      <li key={step.stage} className="flex flex-col items-center gap-1.5 text-center" aria-current={state === "active" ? "step" : undefined}>
                        <span className="relative flex w-full items-center">
                          <span className={`h-0.5 flex-1 rounded-full ${index > 1 ? (state === "todo" ? "bg-line" : "bg-accent") : "bg-transparent"}`} />
                          <m.span
                            className={`grid size-6 place-items-center rounded-full border-2 ${
                              state === "done" ? "border-good bg-good text-surface" : state === "active" ? "border-accent bg-card text-accent-fg" : "border-line bg-card text-ink-faint"
                            }`}
                            animate={state === "active" ? { scale: [1, 1.12, 1] } : { scale: 1 }}
                            transition={state === "active" ? { duration: 1.2, repeat: Infinity } : spring.snappy}
                          >
                            {state === "done" ? (
                              <Icon name="tick" className="size-3.5" />
                            ) : state === "active" ? (
                              <span className="size-2 rounded-full bg-accent" />
                            ) : state === "skipped" ? (
                              <Icon name="kind-constant" className="size-3" />
                            ) : null}
                          </m.span>
                          <span className={`h-0.5 flex-1 rounded-full ${index < 5 ? (index < reached ? "bg-accent" : "bg-line") : "bg-transparent"}`} />
                        </span>
                        <span className={`text-[11px] ${state === "active" ? "font-semibold text-ink" : "text-ink-muted"}`}>
                          {step.label}
                          <span className="sr-only"> — {state}</span>
                        </span>
                      </li>
                    );
                  })}
                </ol>

                <AnimatePresence>
                  {loaded && (
                    <m.div key="types" variants={stagger(0.04)} initial="hidden" animate="show" className="mt-4 flex flex-wrap items-center gap-1.5">
                      <span className="mr-1 text-[12px] text-ink-muted">Detected</span>
                      {composition.map((item) => (
                        <m.span key={item.kind} variants={fadeUp} className="flex items-center gap-1">
                          <TypeBadge kind={item.kind} />
                          <span className="tnum text-[12px] text-ink-muted">×{item.count}</span>
                        </m.span>
                      ))}
                    </m.div>
                  )}
                </AnimatePresence>
                {profileNote && (
                  <div className="mt-3">
                    <Notice tone="warn">Profiling failed ({profileNote}); the overview still works, analysis will retry.</Notice>
                  </div>
                )}
              </div>
            </m.div>
          )}
        </AnimatePresence>

        {failure && (
          <div className="mt-4">
            <Notice>{failure.message}</Notice>
          </div>
        )}

        <AnimatePresence>
          {stage === "done" && loaded && (
            <m.section key="preview" variants={slideIn("up", 24)} initial="hidden" animate="show" exit="exit" className="mt-6" aria-label="Sample preview">
              <div className="mb-2 flex items-center justify-between gap-3">
                <Eyebrow>Sample — first {loaded.preview.rows.length} rows</Eyebrow>
                <div className="flex gap-2">
                  <Button onClick={() => navigate("/analyse")}>Analyse</Button>
                  <Button variant="primary" autoFocus onClick={() => navigate("/overview")}>
                    Open overview
                    <Icon name="arrow" className="size-4" />
                  </Button>
                </div>
              </div>
              <DataTable preview={loaded.preview} maxHeight="18rem" />
            </m.section>
          )}
        </AnimatePresence>

        {stage === "idle" && (
          <>
            <m.div variants={fadeUp} className="my-6 flex items-center gap-3">
              <span className="h-px flex-1 bg-line" />
              <Eyebrow>or load from a path on this machine</Eyebrow>
              <span className="h-px flex-1 bg-line" />
            </m.div>

            <m.form
              variants={fadeUp}
              className="flex gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                if (path.trim()) ingest(path.trim());
              }}
            >
              <label htmlFor="path" className="sr-only">
                File path
              </label>
              <input
                id="path"
                value={path}
                onChange={(event) => setPath(event.target.value)}
                placeholder="/Users/you/data/sales_2026.parquet"
                spellCheck={false}
                className="min-w-0 flex-1 rounded-lg border border-line bg-card px-3 py-2 font-mono text-[13px] transition-shadow outline-none placeholder:text-ink-faint focus:border-accent focus:ring-4 focus:ring-accent/20"
              />
              <Button type="submit" disabled={!path.trim()}>
                Load
              </Button>
            </m.form>
          </>
        )}

        <div className="mt-8">
          <Eyebrow className="mb-2">Already loaded</Eyebrow>
          {recent.isPending && (
            <div className="space-y-2">
              <Skeleton className="h-12" />
              <Skeleton className="h-12" />
            </div>
          )}
          {recent.error && <p className="text-[12px] text-ink-muted">Could not reach the api — is the backend running on :8000?</p>}
          {recent.data?.datasets.length === 0 && <p className="text-[13px] text-ink-muted">Nothing yet. Datasets you load stay here while the server runs.</p>}
          {recent.data && recent.data.datasets.length > 0 && (
            <m.ul variants={stagger(0.04)} initial="hidden" animate="show" className="overflow-hidden rounded-card border border-line bg-card">
              <AnimatePresence initial={false}>
                {recent.data.datasets.map((item) => (
                  <m.li
                    key={item.id}
                    layout
                    variants={fadeUp}
                    exit={{ opacity: 0, x: -20, transition: tween.fast }}
                    className="flex items-center gap-3 border-b border-line px-3 py-2.5 transition-colors last:border-0 hover:bg-hover"
                  >
                    <Icon name={fileIcon(item.name)} className="size-4 shrink-0 text-ink-faint" />
                    <button type="button" className="min-w-0 flex-1 text-left" onClick={() => reopen.mutate(item.id)} disabled={reopen.isPending}>
                      <p className="truncate font-mono text-[13px]">{item.name}</p>
                      <p className="tnum text-[11px] text-ink-faint">
                        {count(item.rows)} rows × {item.columns} columns · {item.memory_mb} MB
                      </p>
                    </button>
                    {reopen.isPending && reopen.variables === item.id && <span className="size-3.5 animate-spin rounded-full border-2 border-line border-t-accent" />}
                    <button
                      type="button"
                      aria-label={`Forget ${item.name}`}
                      title="Forget this dataset"
                      className="rounded p-1.5 text-ink-faint transition-colors hover:bg-hover hover:text-bad"
                      onClick={() => forget.mutate({ id: item.id, name: item.name })}
                    >
                      <Icon name="trash" className="size-4" />
                    </button>
                  </m.li>
                ))}
              </AnimatePresence>
            </m.ul>
          )}
          {reopen.error && (
            <div className="mt-2">
              <Notice>{(reopen.error as Error).message}</Notice>
            </div>
          )}
        </div>
      </div>
    </Shell>
  );
}
