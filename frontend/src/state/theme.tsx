import { useCallback, useEffect, useState } from "react";

const KEY = "databench.theme";

/** Dark by default -- these screens were designed dark first. */
export function useTheme() {
  const [dark, setDark] = useState(() => {
    try {
      return localStorage.getItem(KEY) !== "light";
    } catch {
      return true;
    }
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    try {
      localStorage.setItem(KEY, dark ? "dark" : "light");
    } catch {
      /* storage blocked -- theme still applies for this page view */
    }
  }, [dark]);

  return { dark, toggle: useCallback(() => setDark((on) => !on), []) };
}
