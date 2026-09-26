import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

/** Chrome state that is not about the data: sidebar, overlays, and which
 *  column the inspector drawer is showing. */
interface Ui {
  collapsed: boolean;
  toggleCollapsed: () => void;
  mobileNav: boolean;
  setMobileNav: (open: boolean) => void;
  palette: boolean;
  setPalette: (open: boolean) => void;
  shortcuts: boolean;
  setShortcuts: (open: boolean) => void;
  inspected: string | null;
  inspect: (column: string | null) => void;
}

const UiContext = createContext<Ui | null>(null);
const KEY = "databench.sidebar";

export function UiProvider({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(KEY) === "collapsed";
    } catch {
      return false;
    }
  });
  const [mobileNav, setMobileNav] = useState(false);
  const [palette, setPalette] = useState(false);
  const [shortcuts, setShortcuts] = useState(false);
  const [inspected, inspect] = useState<string | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, collapsed ? "collapsed" : "open");
    } catch {
      /* not worth surfacing */
    }
  }, [collapsed]);

  const toggleCollapsed = useCallback(() => setCollapsed((on) => !on), []);

  const value = useMemo(
    () => ({
      collapsed,
      toggleCollapsed,
      mobileNav,
      setMobileNav,
      palette,
      setPalette,
      shortcuts,
      setShortcuts,
      inspected,
      inspect,
    }),
    [collapsed, toggleCollapsed, mobileNav, palette, shortcuts, inspected],
  );
  return <UiContext.Provider value={value}>{children}</UiContext.Provider>;
}

export function useUi() {
  const value = useContext(UiContext);
  if (!value) throw new Error("useUi must be used inside UiProvider");
  return value;
}
