import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { NAV } from "./nav";
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
