import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Shell } from "../components/Shell";
import { Button, Notice, Spinner } from "../components/primitives";
import { Icon } from "../components/icons";
import { api } from "../lib/api";
import { count } from "../lib/format";
import type { Loaded } from "../lib/types";
import { useSession } from "../state/session";

export function Upload() {
  const { open } = useSession();
  const navigate = useNavigate();
  const queries = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const [path, setPath] = useState("");
  const [dragging, setDragging] = useState(false);

  const recent = useQuery({ queryKey: ["datasets"], queryFn: api.list, staleTime: 0 });

  const load = useMutation({
    mutationFn: (source: File | string) =>
      typeof source === "string" ? api.fromPath(source) : api.upload(source),
    onSuccess: (loaded: Loaded) => {
      open(loaded);
      queries.invalidateQueries({ queryKey: ["datasets"] });
      navigate("/overview");
    },
  });

  const reopen = useMutation({
    mutationFn: async (id: string) => {
      const [described, preview] = await Promise.all([api.describe(id), api.preview(id, 50)]);
      return { ...described, preview } as Loaded;
    },
    onSuccess: (loaded) => {
      open(loaded);
      navigate("/overview");
    },
  });

  const drop = (event: React.DragEvent) => {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) load.mutate(file);
  };

  const busy = load.isPending || reopen.isPending;
  const failure = (load.error ?? reopen.error) as Error | null;

  return (
    <Shell>
      <div className="mx-auto flex min-h-full max-w-2xl flex-col justify-center py-10">
        <div className="text-center">
          <h1 className="text-[22px] font-semibold tracking-[-0.02em]">Upload dataset</h1>
          <p className="mt-1.5 text-[13px] text-ink-muted">
            Initialize your workspace by importing a compatible data file.
          </p>
        </div>

        <div
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={drop}
          onClick={() => fileInput.current?.click()}
          className={`mt-7 cursor-pointer rounded-lg border-2 border-dashed px-6 py-14 text-center transition ${
            dragging ? "border-accent bg-accent-soft" : "border-line hover:border-line-strong"
          }`}
        >
          <span className="mx-auto grid size-14 place-items-center rounded-full bg-card-raised text-ink-muted">
            <Icon name="upload" className="size-6" />
          </span>
          <p className="mt-4 text-[15px] font-semibold">
            {busy ? "Reading…" : "Drop a dataset to begin"}
          </p>
          <p className="mt-1 text-[13px] text-ink-muted">csv, excel, parquet or json — up to 512 MB</p>
          <p className="mt-4 text-[13px] font-medium text-accent">Browse files instead</p>
          <input
            ref={fileInput}
            type="file"
            accept=".csv,.tsv,.txt,.xlsx,.xlsm,.xls,.parquet,.pq,.json,.jsonl,.ndjson"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) load.mutate(file);
              event.target.value = "";
            }}
          />
        </div>

        <div className="my-6 flex items-center gap-3">
          <span className="h-px flex-1 bg-line" />
          <span className="text-[11px] font-semibold tracking-[0.06em] text-ink-faint uppercase">
            or load from a path on this machine
          </span>
          <span className="h-px flex-1 bg-line" />
        </div>

        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (path.trim()) load.mutate(path.trim());
          }}
        >
          <input
            value={path}
            onChange={(event) => setPath(event.target.value)}
            placeholder="/Users/you/data/sales_2026.parquet"
            spellCheck={false}
            className="min-w-0 flex-1 rounded-lg border border-line bg-card px-3 py-2 font-mono text-[13px] outline-none placeholder:text-ink-faint focus:border-accent focus:ring-2 focus:ring-accent/25"
          />
          <Button type="submit" disabled={!path.trim() || busy}>
            Load
          </Button>
        </form>

        <div className="mt-4 min-h-6">
          {busy && <Spinner label="Reading and profiling…" />}
          {failure && <Notice>{failure.message}</Notice>}
        </div>

        {recent.data && recent.data.datasets.length > 0 && (
          <div className="mt-6">
            <p className="mb-2 text-[11px] font-semibold tracking-[0.06em] text-ink-faint uppercase">
              Already loaded
            </p>
            <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-card">
              {recent.data.datasets.map((item) => (
                <li key={item.id} className="flex items-center gap-3 px-3 py-2.5 hover:bg-hover">
                  <Icon name="file" className="size-4 shrink-0 text-ink-faint" />
                  <button className="min-w-0 flex-1 text-left" onClick={() => reopen.mutate(item.id)}>
                    <p className="truncate font-mono text-[13px]">{item.name}</p>
                    <p className="tnum text-[11px] text-ink-faint">
                      {count(item.rows)} rows × {item.columns} columns · {item.memory_mb} MB
                    </p>
                  </button>
                  <button
                    title="Forget this dataset"
                    className="rounded p-1.5 text-ink-faint transition hover:bg-hover hover:text-bad"
                    onClick={async () => {
                      await api.forget(item.id);
                      queries.invalidateQueries({ queryKey: ["datasets"] });
                    }}
                  >
                    <Icon name="trash" className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Shell>
  );
}
