import { useCallback, useRef } from "react";

/** Radix only restores focus to a `Dialog.Trigger`; these dialogs open from
 *  shortcuts, rows and charts instead. Remember what had focus when `open`
 *  turned true and hand back an `onCloseAutoFocus` that returns there. */
export function useReturnFocus(open: boolean) {
  const saved = useRef<HTMLElement | null>(null);
  const wasOpen = useRef(false);
  // captured during render, before Radix's focus scope moves focus on mount
  if (open && !wasOpen.current && typeof document !== "undefined") saved.current = document.activeElement as HTMLElement | null;
  wasOpen.current = open;

  return useCallback((event: Event) => {
    event.preventDefault();
    const target = saved.current;
    if (target?.isConnected && target !== document.body) target.focus();
  }, []);
}
