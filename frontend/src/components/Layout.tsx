import { Suspense, createContext, lazy, useContext, useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { NavLink, useLocation, useNavigate, useOutlet } from "react-router-dom";
import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, LayoutGroup, m, useScroll, useSpring, useTransform } from "motion/react";
import { Icon } from "./icons";
import { Hint, IconButton, IconTile, Kbd } from "./primitives";
import type { TileTone } from "./primitives";
import { NAV } from "./nav";
import { Pipeline } from "./Pipeline";
import { useGlobalShortcuts } from "./useGlobalShortcuts";
import { count } from "../lib/format";
import { PageTransition, spring, tween } from "../lib/motion";
import { useSession } from "../state/session";
import { ACCENTS, useTheme } from "../state/theme";
import { useUi } from "../state/ui";

// overlays load on first open, keeping charts and the dialog runtime out of the first paint
const ColumnInspector = lazy(() => import("./ColumnInspector").then((m) => ({ default: m.ColumnInspector })));
const CommandPalette = lazy(() => import("./CommandPalette").then((m) => ({ default: m.CommandPalette })));
const ShortcutsDialog = lazy(() => import("./Shortcuts").then((m) => ({ default: m.ShortcutsDialog })));

/** Mounts `children` once `open` first turns true, then keeps them mounted so
 *  their own exit animations can play. */
function OnceOpened({ open, children }: { open: boolean; children: React.ReactNode }) {
  const [opened, setOpened] = useState(open);
  if (open && !opened) setOpened(true);
  return opened ? <Suspense fallback={null}>{children}</Suspense> : null;
}

/** The scrolling element, for anything that reacts to scroll (reading progress). */
const ScrollContext = createContext<RefObject<HTMLElement | null> | null>(null);
export const useScrollContainer = () => useContext(ScrollContext);

function Sidebar({ compact, onNavigate }: { compact: boolean; onNavigate?: () => void }) {
  const { dataset, close } = useSession();
  const { dark, toggle, accent, setAccent } = useTheme();
  const { toggleCollapsed, collapsed, setPalette } = useUi();
  const navigate = useNavigate();
  const locked = !dataset;

  const row = `flex items-center rounded-[10px] text-[14px] transition-colors ${compact ? "justify-center size-10 mx-auto" : "gap-2.5 px-2 py-1.5"}`;

  return (
    <div className="flex h-full flex-col">
      <div className={`flex items-center pt-5 pb-4 ${compact ? "justify-center px-2" : "justify-between px-5"}`}>
        <NavLink to="/" onClick={onNavigate} className="flex items-center gap-2.5" aria-label="DataBench home">
          {/* app icon: a squircle in the accent, lit from the top like a dock icon */}
          <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-accent bg-gradient-to-b from-white/25 to-transparent text-accent-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_4px_10px_-2px_var(--accent-soft)]">
            <Icon name="layers" className="size-5" />
          </span>
          {!compact && (
            <span>
              <span className="block text-[15px] leading-tight font-bold tracking-[-0.01em]">DataBench</span>
              <span className="block text-[11px] text-ink-muted">Main workspace</span>
            </span>
          )}
        </NavLink>
      </div>

      {!compact && (
        <button
          type="button"
          onClick={() => {
            onNavigate?.();
            setPalette(true);
          }}
          className="mx-3 mb-3 flex items-center gap-2 rounded-[10px] bg-hover px-3 py-1.5 text-left text-[13px] text-ink-muted transition-colors hover:bg-line hover:text-ink"
        >
          <Icon name="search" className="size-4" />
          <span className="flex-1">Jump to…</span>
          <Kbd>⌘K</Kbd>
        </button>
      )}

      <AnimatePresence initial={false}>
        {dataset && !compact && (
          <m.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={tween.base}
            className="glass mx-3 mb-4 rounded-xl border border-line px-3 py-2.5"
          >
            <div className="flex items-start gap-2">
              <Icon name="file" className="mt-[2px] size-3.5 shrink-0 text-ink-faint" />
              <p className="truncate font-mono text-[12px]" title={dataset.meta.name}>
                {dataset.meta.name}
              </p>
            </div>
            <p className="tnum mt-1 text-[11px] text-ink-faint">
              {count(dataset.meta.rows)} rows · {dataset.meta.columns} cols
            </p>
          </m.div>
        )}
      </AnimatePresence>

      <nav aria-label="Workspace" className="flex-1 space-y-0.5 overflow-y-auto px-3">
        {!compact && <p className="px-2 pt-1 pb-1.5 text-[11px] font-semibold text-ink-faint">Workspace</p>}
        <NavItem to="/" label="Upload" icon="upload" tone="blue" compact={compact} end onNavigate={onNavigate} className={row} />
        {NAV.map((item) => (
          <NavItem key={item.to} to={item.to} label={item.label} icon={item.icon} tone={item.tone} compact={compact} locked={locked} onNavigate={onNavigate} className={row} />
        ))}
      </nav>

      <div className={`space-y-2 border-t border-line py-3 ${compact ? "px-2" : "px-3"}`}>
        {compact ? (
          <FooterButton compact icon={dark ? "sun" : "moon"} label={dark ? "Light theme" : "Dark theme"} onClick={toggle} />
        ) : (
          <>
            {/* iOS segmented control for appearance */}
            <div role="radiogroup" aria-label="Appearance" className="relative grid grid-cols-2 rounded-[9px] bg-hover p-0.5 text-[12px] font-medium">
              {[
                { on: !dark, label: "Light", icon: "sun" },
                { on: dark, label: "Dark", icon: "moon" },
              ].map((option) => (
                <button
                  key={option.label}
                  type="button"
                  role="radio"
                  aria-checked={option.on}
                  onClick={() => !option.on && toggle()}
                  className={`relative flex items-center justify-center gap-1.5 rounded-[7px] py-1 transition-colors ${option.on ? "text-ink" : "text-ink-muted hover:text-ink"}`}
                >
                  {option.on && (
                    <m.span layoutId="appearance" transition={spring.snappy} className="absolute inset-0 rounded-[7px] bg-card-raised shadow-[0_1px_3px_rgba(0,0,0,0.15)]" />
                  )}
                  <span className="relative">
                    <Icon name={option.icon} className="size-3.5" />
                  </span>
                  <span className="relative">{option.label}</span>
                </button>
              ))}
            </div>
            {/* accent swatches, as in macOS System Settings */}
            <div role="radiogroup" aria-label="Accent colour" className="flex items-center justify-between px-1">
              {ACCENTS.map((option) => {
                const on = option.id === accent;
                return (
                  <Hint key={option.id} label={option.label}>
                    <m.button
                      type="button"
                      role="radio"
                      aria-checked={on}
                      aria-label={`${option.label} accent`}
                      onClick={() => setAccent(option.id)}
                      whileHover={{ scale: 1.15 }}
                      whileTap={{ scale: 0.9 }}
                      transition={spring.snappy}
                      className="relative grid size-5 place-items-center rounded-full shadow-[inset_0_-1px_1px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.3)]"
                      style={{ background: option.swatch }}
                    >
                      {on && <m.span layoutId="accent-dot" transition={spring.snappy} className="size-1.5 rounded-full bg-white" />}
                    </m.button>
                  </Hint>
                );
              })}
            </div>
          </>
        )}
        {dataset && (
          <FooterButton
            compact={compact}
            icon="trash"
            label="Close dataset"
            onClick={() => {
              close();
              onNavigate?.();
              navigate("/");
            }}
          />
        )}
        {!onNavigate && (
          <FooterButton
            compact={compact}
            icon="sidebar"
            label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            shortcut="["
            onClick={toggleCollapsed}
          />
        )}
      </div>
    </div>
  );
}

function NavItem({
  to,
  label,
  icon,
  tone,
  compact,
  locked = false,
  end = false,
  onNavigate,
  className,
}: {
  to: string;
  label: string;
  icon: string;
  tone: TileTone;
  compact: boolean;
  locked?: boolean;
  end?: boolean;
  onNavigate?: () => void;
  className: string;
}) {
  const link = (
    <NavLink
      to={to}
      end={end}
      aria-disabled={locked || undefined}
      aria-label={compact ? label : undefined}
      tabIndex={locked ? -1 : undefined}
      onClick={(event) => (locked ? event.preventDefault() : onNavigate?.())}
      className={({ isActive }) =>
        `relative ${className} ${
          locked
            ? "pointer-events-none text-ink-faint opacity-50 grayscale"
            : isActive
              ? "font-semibold text-ink"
              : "text-ink hover:bg-hover"
        }`
      }
    >
      {({ isActive }) => (
        <>
          {isActive && !locked && (
            <m.span
              layoutId="nav-active"
              transition={spring.soft}
              className="absolute inset-0 rounded-[10px] bg-accent-soft"
            />
          )}
          <span className="relative">
            <IconTile icon={icon} tone={tone} size="sm" />
          </span>
          {!compact && <span className="relative">{label}</span>}
        </>
      )}
    </NavLink>
  );
  return compact ? (
    <Hint label={label} side="right">
      {link}
    </Hint>
  ) : (
    link
  );
}

function FooterButton({
  compact,
  icon,
  label,
  onClick,
  shortcut,
}: {
  compact: boolean;
  icon: string;
  label: string;
  onClick: () => void;
  shortcut?: string;
}) {
  if (compact) return <IconButton icon={icon} label={label} onClick={onClick} shortcut={shortcut} className="mx-auto flex" />;
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[13px] text-ink-muted transition-colors hover:bg-hover hover:text-ink"
    >
      <Icon name={icon} />
      <span className="flex-1 text-left">{label}</span>
      {shortcut && <Kbd>{shortcut}</Kbd>}
    </button>
  );
}

/** Thin bar at the top of the content that fills as the page scrolls. */
function ReadingProgress({ target }: { target: RefObject<HTMLElement | null> }) {
  const { scrollY, scrollYProgress } = useScroll({ container: target });
  const scaleX = useSpring(scrollYProgress, { stiffness: 200, damping: 30, restDelta: 0.001 });
  // a page that does not scroll reports progress 1; only show the bar once scrolled
  const opacity = useTransform(scrollY, (y) => (y > 8 ? 1 : 0));
  return (
    <m.div
      aria-hidden="true"
      style={{ scaleX, opacity }}
      className="pointer-events-none sticky top-0 z-30 -mb-0.5 h-0.5 origin-left bg-accent"
    />
  );
}

export function Layout() {
  const outlet = useOutlet();
  const location = useLocation();
  const { collapsed, mobileNav, setMobileNav, setPalette, setShortcuts, palette, shortcuts, inspected } = useUi();
  const scroller = useRef<HTMLElement>(null);
  useGlobalShortcuts();

  // each route starts at the top, not wherever the previous one was scrolled to
  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 });
    setMobileNav(false);
  }, [location.pathname, setMobileNav]);

  return (
    <ScrollContext.Provider value={scroller}>
      {/* one root for the mobile nav, so its trigger and drawer share state and focus return */}
      <Dialog.Root open={mobileNav} onOpenChange={setMobileNav}>
        <div className="flex h-full">
          <m.aside
            aria-label="Sidebar"
            animate={{ width: collapsed ? 76 : 248 }}
            initial={false}
            transition={spring.soft}
            className="hidden shrink-0 overflow-hidden p-2 md:block"
          >
            {/* a floating vibrancy panel, inset from the window edge like the macOS sidebar */}
            <div className="glass-chrome h-full overflow-hidden rounded-[18px] border border-line shadow-md">
              {/* separate layout groups: both sidebars are mounted at once, and a shared
                  "nav-active" layoutId would fly the pill between them */}
              <LayoutGroup id="sidebar">
                <Sidebar compact={collapsed} />
              </LayoutGroup>
            </div>
          </m.aside>

          {/* mobile nav as a real dialog: Esc closes it, focus is trapped inside
              and returns to the menu button */}
          <AnimatePresence>
            {mobileNav && (
              <Dialog.Portal forceMount>
                <Dialog.Overlay asChild forceMount>
                  <m.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-40 bg-scrim md:hidden"
                  />
                </Dialog.Overlay>
                <Dialog.Content asChild forceMount aria-describedby={undefined}>
                  <m.aside
                    initial={{ x: "-110%" }}
                    animate={{ x: 0 }}
                    exit={{ x: "-110%" }}
                    transition={spring.soft}
                    className="glass-sheet fixed inset-y-2 left-2 z-50 w-[264px] overflow-hidden rounded-[18px] border border-line outline-none md:hidden"
                  >
                    <Dialog.Title className="sr-only">Navigation</Dialog.Title>
                    <LayoutGroup id="drawer">
                      <Sidebar compact={false} onNavigate={() => setMobileNav(false)} />
                    </LayoutGroup>
                  </m.aside>
                </Dialog.Content>
              </Dialog.Portal>
            )}
          </AnimatePresence>

          <main ref={scroller} className="relative flex min-w-0 flex-1 flex-col overflow-y-auto">
            <ReadingProgress target={scroller} />
            <div className="glass-chrome sticky top-0 z-20 flex items-center gap-2 border-b border-line px-3 py-2 md:px-6">
              <Dialog.Trigger asChild>
                <IconButton icon="menu" label="Open navigation" className="md:hidden" />
              </Dialog.Trigger>
              <Pipeline />
              <div className="ml-auto flex items-center gap-1">
                <IconButton icon="search" label="Command palette" shortcut="⌘K" onClick={() => setPalette(true)} />
                <IconButton icon="keyboard" label="Keyboard shortcuts" shortcut="?" onClick={() => setShortcuts(true)} />
              </div>
            </div>
            <AnimatePresence mode="wait" initial={false}>
              <PageTransition key={location.pathname} className="flex-1">
                {outlet}
              </PageTransition>
            </AnimatePresence>
          </main>
        </div>
      </Dialog.Root>
      <OnceOpened open={Boolean(inspected)}>
        <ColumnInspector />
      </OnceOpened>
      <OnceOpened open={palette}>
        <CommandPalette />
      </OnceOpened>
      <OnceOpened open={shortcuts}>
        <ShortcutsDialog />
      </OnceOpened>
    </ScrollContext.Provider>
  );
}
