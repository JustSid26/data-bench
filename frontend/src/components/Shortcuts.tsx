import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, m } from "motion/react";
import { IconButton, Kbd } from "./primitives";
import { NAV } from "./nav";
import { spring, tween } from "../lib/motion";
import { useSession } from "../state/session";
import { useTheme } from "../state/theme";
import { useUi } from "../state/ui";

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

/** Global keys: ⌘K / Ctrl+K palette, ? help, [ sidebar, t theme, g + letter to navigate. */
export function useGlobalShortcuts() {
  const { setPalette, setShortcuts, toggleCollapsed, palette } = useUi();
  const { toggle } = useTheme();
  const { dataset } = useSession();
  const navigate = useNavigate();
  const pendingG = useRef(0);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPalette(!palette);
        return;
      }
      if (event.metaKey || event.ctrlKey || event.altKey || isTyping(event.target)) return;
      // any open dialog owns the keyboard
      if (document.querySelector("[role=dialog]")) return;

      if (pendingG.current && Date.now() - pendingG.current < 1200) {
        pendingG.current = 0;
        const key = event.key.toLowerCase();
        if (key === "u") return navigate("/");
        const target = NAV.find((item) => item.shortcut === key);
        if (target && dataset) navigate(target.to);
        return;
      }
      if (event.key === "g") pendingG.current = Date.now();
      else if (event.key === "?") setShortcuts(true);
      else if (event.key === "[") toggleCollapsed();
      else if (event.key === "t") toggle();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setPalette, setShortcuts, toggleCollapsed, toggle, navigate, dataset, palette]);
}

const GROUPS: { title: string; keys: [string[], string][] }[] = [
  {
    title: "Anywhere",
    keys: [
      [["⌘", "K"], "Command palette (Ctrl+K on Windows / Linux)"],
      [["?"], "This list"],
      [["["], "Collapse or expand the sidebar"],
      [["t"], "Toggle light / dark theme"],
      [["Esc"], "Close a drawer or dialog"],
    ],
  },
  {
    title: "Go to",
    keys: [[["g", "u"], "Upload"], ...NAV.map((item) => [["g", item.shortcut], item.label] as [string[], string])],
  },
];

export function ShortcutsDialog() {
  const { shortcuts, setShortcuts } = useUi();
  return (
    <Dialog.Root open={shortcuts} onOpenChange={setShortcuts}>
      <AnimatePresence>
        {shortcuts && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild forceMount>
              <m.div className="fixed inset-0 z-50 bg-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={tween.fast} />
            </Dialog.Overlay>
            <Dialog.Content asChild forceMount aria-describedby={undefined}>
              <m.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={spring.snappy}
                className="fixed top-1/2 left-1/2 z-50 w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-card border border-line bg-card p-5 shadow-lg"
              >
                <div className="flex items-center justify-between">
                  <Dialog.Title className="text-[15px] font-semibold">Keyboard shortcuts</Dialog.Title>
                  <Dialog.Close asChild>
                    <IconButton icon="close" label="Close" />
                  </Dialog.Close>
                </div>
                {GROUPS.map((group) => (
                  <div key={group.title} className="mt-4">
                    <p className="mb-2 text-[11px] font-semibold tracking-[0.06em] text-ink-faint uppercase">{group.title}</p>
                    <dl className="space-y-1.5">
                      {group.keys.map(([keys, label]) => (
                        <div key={label} className="flex items-center justify-between gap-3 text-[13px]">
                          <dt className="text-ink-muted">{label}</dt>
                          <dd className="flex shrink-0 items-center gap-1">
                            {keys.map((key, index) => (
                              <span key={index} className="flex items-center gap-1">
                                {index > 0 && keys[0] === "g" && <span className="text-[10px] text-ink-faint">then</span>}
                                <Kbd>{key}</Kbd>
                              </span>
                            ))}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                ))}
              </m.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
