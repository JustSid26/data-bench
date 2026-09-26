import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, m } from "motion/react";
import { Icon } from "./icons";
import { Kbd } from "./primitives";
import { NAV } from "./nav";
import { spring, tween } from "../lib/motion";
import { api } from "../lib/api";
import { HYPERPARAMETERS } from "../lib/insights";
import { algorithmName, count } from "../lib/format";
import { KIND } from "../lib/tokens";
import type { Loaded } from "../lib/types";
import { useReturnFocus } from "../lib/useReturnFocus";
import { useSession } from "../state/session";
import { ACCENTS, useTheme } from "../state/theme";
import { useUi } from "../state/ui";

interface Item {
  id: string;
  group: string;
  label: string;
  hint?: string;
  icon: string;
  keywords?: string;
  run: () => void;
}

/** Subsequence match, scored so prefix and word-start hits rank first. */
function score(query: string, text: string) {
  if (!query) return 1;
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  const direct = t.indexOf(q);
  if (direct === 0) return 100;
  if (direct > 0) return 60 - Math.min(direct, 40);
  let at = 0;
  let gaps = 0;
  for (const char of q) {
    const next = t.indexOf(char, at);
    if (next < 0) return 0;
    gaps += next - at;
    at = next + 1;
  }
  return Math.max(1, 20 - gaps);
}

export function CommandPalette() {
  const { palette, setPalette, inspect, toggleCollapsed, setShortcuts } = useUi();
  const { dataset, open, close } = useSession();
  const { dark, toggle, accent, setAccent } = useTheme();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const list = useRef<HTMLUListElement>(null);
  const returnFocus = useReturnFocus(palette);

  const recent = useQuery({ queryKey: ["datasets"], queryFn: api.list, enabled: palette, staleTime: 0 });
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

  const items = useMemo<Item[]>(() => {
    const go = (to: string) => () => navigate(to);
    const all: Item[] = [
      { id: "nav-upload", group: "Go to", label: "Upload", icon: "upload", hint: "g u", run: go("/") },
      ...(dataset ? NAV.map((item) => ({ id: `nav-${item.to}`, group: "Go to", label: item.label, icon: item.icon, hint: `g ${item.shortcut}`, run: go(item.to) })) : []),
      ...(dataset?.schema ?? []).map((column) => ({
        id: `col-${column.name}`,
        group: "Columns",
        label: column.name,
        hint: KIND[column.kind].label,
        icon: KIND[column.kind].icon,
        run: () => inspect(column.name),
      })),
      ...(recent.data?.datasets ?? [])
        .filter((item) => item.id !== dataset?.id)
        .map((item) => ({
          id: `ds-${item.id}`,
          group: "Datasets",
          label: item.name,
          hint: `${count(item.rows)} rows`,
          icon: "file",
          run: () => reopen.mutate(item.id),
        })),
      ...(dataset
        ? Object.keys(HYPERPARAMETERS).map((name) => ({
            id: `model-${name}`,
            group: "Models",
            label: algorithmName(name),
            icon: "model",
            keywords: name,
            run: go("/model"),
          }))
        : []),
      { id: "act-theme", group: "Actions", label: dark ? "Switch to light theme" : "Switch to dark theme", icon: dark ? "sun" : "moon", hint: "t", run: toggle },
      ...ACCENTS.filter((option) => option.id !== accent).map((option) => ({
        id: `accent-${option.id}`,
        group: "Actions",
        label: `Accent colour: ${option.label}`,
        icon: "sparkle",
        keywords: "theme colour color accent",
        run: () => setAccent(option.id),
      })),
      { id: "act-sidebar", group: "Actions", label: "Toggle sidebar", icon: "sidebar", hint: "[", run: toggleCollapsed },
      { id: "act-keys", group: "Actions", label: "Keyboard shortcuts", icon: "keyboard", hint: "?", run: () => setShortcuts(true) },
      ...(dataset ? [{ id: "act-close", group: "Actions", label: "Close dataset", icon: "trash", run: () => { close(); navigate("/"); } }] : []),
    ];
    return all;
  }, [dataset, recent.data, dark, accent, navigate, inspect, toggle, setAccent, toggleCollapsed, setShortcuts, close, reopen]);

  const results = useMemo(() => {
    const scored = items
      .map((item) => ({ item, score: Math.max(score(query, item.label), score(query, item.keywords ?? "") * 0.8) }))
      .filter((entry) => entry.score > 0);
    if (query) scored.sort((a, b) => b.score - a.score);
    // columns can number in the hundreds; cap each group so the list stays fast
    const perGroup = new Map<string, number>();
    return scored
      .filter(({ item }) => {
        const seen = perGroup.get(item.group) ?? 0;
        perGroup.set(item.group, seen + 1);
        return seen < (query ? 12 : 6);
      })
      .map((entry) => entry.item);
  }, [items, query]);

  useEffect(() => setActive(0), [query, palette]);
  useEffect(() => {
    if (!palette) setQuery("");
  }, [palette]);
  useEffect(() => {
    list.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const run = (item: Item | undefined) => {
    if (!item) return;
    setPalette(false);
    item.run();
  };

  let lastGroup = "";

  return (
    <Dialog.Root open={palette} onOpenChange={setPalette}>
      <AnimatePresence>
        {palette && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild forceMount>
              <m.div className="fixed inset-0 z-50 bg-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={tween.fast} />
            </Dialog.Overlay>
            <Dialog.Content asChild forceMount aria-describedby={undefined} onCloseAutoFocus={returnFocus}>
              <m.div
                initial={{ opacity: 0, scale: 0.96, y: -8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={spring.snappy}
                className="fixed top-[12vh] left-1/2 z-50 w-[min(38rem,calc(100vw-2rem))] -translate-x-1/2 glass-sheet overflow-hidden rounded-[20px] border border-line"
              >
                <Dialog.Title className="sr-only">Command palette</Dialog.Title>
                <div className="flex items-center gap-2 border-b border-line px-4">
                  <Icon name="search" className="size-4 text-ink-faint" />
                  <input
                    autoFocus
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "ArrowDown") {
                        event.preventDefault();
                        setActive((index) => Math.min(index + 1, results.length - 1));
                      } else if (event.key === "ArrowUp") {
                        event.preventDefault();
                        setActive((index) => Math.max(index - 1, 0));
                      } else if (event.key === "Enter") {
                        event.preventDefault();
                        run(results[active]);
                      }
                    }}
                    placeholder={dataset ? "Jump to a screen, column, dataset or model…" : "Jump to a screen or dataset…"}
                    className="h-14 min-w-0 flex-1 bg-transparent text-[18px] font-light outline-none placeholder:text-ink-faint"
                    role="combobox"
                    aria-expanded="true"
                    aria-controls="palette-list"
                    aria-activedescendant={results[active] ? `palette-opt-${active}` : undefined}
                    spellCheck={false}
                  />
                  <Kbd>Esc</Kbd>
                </div>
                <ul ref={list} id="palette-list" role="listbox" className="max-h-[min(24rem,60vh)] overflow-y-auto p-2">
                  {results.length === 0 && <li className="px-3 py-6 text-center text-[13px] text-ink-muted">No match for “{query}”.</li>}
                  {results.map((item, index) => {
                    const header = item.group !== lastGroup;
                    lastGroup = item.group;
                    const selected = index === active;
                    return (
                      <li key={item.id} role="presentation">
                        {header && <p className="px-3 pt-2 pb-1 text-[10px] font-semibold tracking-[0.06em] text-ink-faint uppercase">{item.group}</p>}
                        <div
                          id={`palette-opt-${index}`}
                          role="option"
                          aria-selected={selected}
                          data-index={index}
                          onPointerMove={() => setActive(index)}
                          onClick={() => run(item)}
                          className="relative flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-[13px]"
                        >
                          {selected && <m.span layoutId="palette-active" transition={spring.snappy} className="absolute inset-0 rounded-lg bg-accent-soft" />}
                          <Icon name={item.icon} className="relative size-4 shrink-0 text-ink-muted" />
                          <span className={`relative flex-1 truncate ${item.group === "Columns" || item.group === "Datasets" ? "font-mono text-[12px]" : ""}`}>{item.label}</span>
                          {item.hint && <span className="relative shrink-0 text-[11px] text-ink-faint">{item.hint}</span>}
                        </div>
                      </li>
                    );
                  })}
                </ul>
                <div className="flex items-center gap-3 border-t border-line px-4 py-2 text-[11px] text-ink-faint">
                  <span className="flex items-center gap-1"><Kbd>↑</Kbd><Kbd>↓</Kbd> move</span>
                  <span className="flex items-center gap-1"><Kbd>↵</Kbd> open</span>
                  {reopen.isPending && <span className="ml-auto">Opening dataset…</span>}
                </div>
              </m.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
