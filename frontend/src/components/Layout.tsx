import { Suspense, createContext, lazy, useContext, useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { NavLink, useLocation, useNavigate, useOutlet } from "react-router-dom";
import { AnimatePresence, m, useScroll, useSpring, useTransform } from "motion/react";
import { Icon } from "./icons";
import { Hint, IconButton, Kbd } from "./primitives";
import { NAV } from "./nav";
import { Pipeline } from "./Pipeline";
import { useGlobalShortcuts } from "./useGlobalShortcuts";
import { count } from "../lib/format";
import { PageTransition, spring, tween } from "../lib/motion";
import { useSession } from "../state/session";
import { useTheme } from "../state/theme";
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
  const { dark, toggle } = useTheme();
  const { toggleCollapsed, collapsed, setPalette } = useUi();
  const navigate = useNavigate();
  const locked = !dataset;

  const row = `flex items-center rounded-lg text-[14px] transition-colors ${compact ? "justify-center size-10 mx-auto" : "gap-3 px-3 py-2"}`;

  return (
    <div className="flex h-full flex-col">
      <div className={`flex items-center pt-5 pb-4 ${compact ? "justify-center px-2" : "justify-between px-5"}`}>
        <NavLink to="/" onClick={onNavigate} className="flex items-center gap-2.5" aria-label="DataBench home">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent text-accent-ink shadow-sm">
            <Icon name="grid" className="size-4" />
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
          className="mx-3 mb-3 flex items-center gap-2 rounded-lg border border-line bg-card px-3 py-1.5 text-left text-[13px] text-ink-muted shadow-sm transition-colors hover:border-line-strong hover:text-ink"
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
            className="mx-3 mb-4 rounded-lg border border-line bg-card px-3 py-2.5"
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

      <nav aria-label="Workspace" className="flex-1 space-y-0.5 px-3">
        <NavItem to="/" label="Upload" icon="upload" compact={compact} end onNavigate={onNavigate} className={row} />
        {NAV.map((item) => (
          <NavItem key={item.to} to={item.to} label={item.label} icon={item.icon} compact={compact} locked={locked} onNavigate={onNavigate} className={row} />
        ))}
      </nav>

      <div className={`space-y-1 border-t border-line py-3 ${compact ? "px-2" : "px-3"}`}>
        <FooterButton compact={compact} icon={dark ? "sun" : "moon"} label={dark ? "Light theme" : "Dark theme"} onClick={toggle} />
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
  compact,
  locked = false,
  end = false,
  onNavigate,
  className,
}: {
  to: string;
  label: string;
  icon: string;
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
            ? "pointer-events-none text-ink-faint/60"
            : isActive
              ? "font-semibold text-ink"
              : "text-ink-muted hover:bg-hover hover:text-ink"
        }`
      }
    >
      {({ isActive }) => (
        <>
          {isActive && !locked && (
            <m.span
              layoutId="nav-active"
              transition={spring.soft}
              className="absolute inset-0 rounded-lg border-l-2 border-accent bg-accent-soft"
            />
          )}
          <span className="relative">
            <Icon name={icon} />
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
      <div className="flex h-full">
        <m.aside
          aria-label="Sidebar"
          animate={{ width: collapsed ? 64 : 232 }}
          initial={false}
          transition={spring.soft}
          className="hidden shrink-0 overflow-hidden border-r border-line bg-surface md:block"
        >
          <Sidebar compact={collapsed} />
        </m.aside>

        <AnimatePresence>
          {mobileNav && (
            <>
              <m.div
                key="scrim"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setMobileNav(false)}
                className="fixed inset-0 z-40 bg-scrim md:hidden"
              />
              <m.aside
                key="drawer"
                aria-label="Sidebar"
                initial={{ x: "-100%" }}
                animate={{ x: 0 }}
                exit={{ x: "-100%" }}
                transition={spring.soft}
                className="fixed inset-y-0 left-0 z-50 w-[264px] border-r border-line bg-surface shadow-lg md:hidden"
              >
                <Sidebar compact={false} onNavigate={() => setMobileNav(false)} />
              </m.aside>
            </>
          )}
        </AnimatePresence>

        <main ref={scroller} className="relative flex min-w-0 flex-1 flex-col overflow-y-auto">
          <ReadingProgress target={scroller} />
          <div className="sticky top-0 z-20 flex items-center gap-2 border-b border-line bg-surface/85 px-3 py-2 backdrop-blur md:px-6">
            <IconButton icon="menu" label="Open navigation" className="md:hidden" onClick={() => setMobileNav(true)} />
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
