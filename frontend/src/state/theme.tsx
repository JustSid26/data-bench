import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

const KEY = "databench.theme";
const ACCENT_KEY = "databench.accent";

/** Accent themes, in the order the picker shows them. Values live in index.css. */
export const ACCENTS = [
  { id: "blue", label: "Blue", swatch: "#0064d2" },
  { id: "indigo", label: "Indigo", swatch: "#4f46e5" },
  { id: "purple", label: "Purple", swatch: "#8e3fc7" },
  { id: "pink", label: "Pink", swatch: "#c71f66" },
  { id: "teal", label: "Teal", swatch: "#0b7285" },
  { id: "graphite", label: "Graphite", swatch: "#5a5a60" },
] as const;
export type Accent = (typeof ACCENTS)[number]["id"];

interface Theme {
  dark: boolean;
  toggle: () => void;
  accent: Accent;
  setAccent: (accent: Accent) => void;
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

  const [accent, setAccent] = useState<Accent>(() => {
    try {
      const stored = localStorage.getItem(ACCENT_KEY);
      return ACCENTS.some((a) => a.id === stored) ? (stored as Accent) : "blue";
    } catch {
      return "blue";
    }
  });

  useEffect(() => {
    document.documentElement.dataset.accent = accent;
    try {
      localStorage.setItem(ACCENT_KEY, accent);
    } catch {
      /* applies for this page view only */
    }
  }, [accent]);

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
  const value = useMemo(() => ({ dark, toggle, accent, setAccent }), [dark, toggle, accent]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("useTheme must be used inside ThemeProvider");
  return value;
}
