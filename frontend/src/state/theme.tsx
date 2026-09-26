import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

const KEY = "databench.theme";

interface Theme {
  dark: boolean;
  toggle: () => void;
}

const ThemeContext = createContext<Theme | null>(null);

/** Dark by default -- these screens were designed dark first. One provider, so
 *  the sidebar, the command palette and the shortcut all flip the same state. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [dark, setDark] = useState(() => {
    try {
      return localStorage.getItem(KEY) !== "light";
    } catch {
      return true;
    }
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    document.documentElement.style.colorScheme = dark ? "dark" : "light";
    try {
      localStorage.setItem(KEY, dark ? "dark" : "light");
    } catch {
      /* storage blocked -- theme still applies for this page view */
    }
  }, [dark]);

  const toggle = useCallback(() => setDark((on) => !on), []);
  const value = useMemo(() => ({ dark, toggle }), [dark, toggle]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("useTheme must be used inside ThemeProvider");
  return value;
}
