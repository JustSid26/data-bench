import { useEffect, useState } from "react";
import type { RefObject } from "react";

/** Minimal fixed-row-height virtualiser: which rows of `count` are inside the
 *  scrolling `container`, plus the padding that stands in for the rest.
 *  Off (every row rendered) below `threshold`, where it would only add work. */
export function useWindow(container: RefObject<HTMLElement | null>, count: number, rowHeight: number, threshold = 120, overscan = 8) {
  const [range, setRange] = useState({ top: 0, height: 800 });
  const active = count > threshold;

  useEffect(() => {
    const node = container.current;
    if (!active || !node) return;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setRange({ top: node.scrollTop, height: node.clientHeight }));
    };
    update();
    node.addEventListener("scroll", update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => {
      cancelAnimationFrame(frame);
      node.removeEventListener("scroll", update);
      observer.disconnect();
    };
  }, [container, active]);

  if (!active) return { active, start: 0, end: count, padTop: 0, padBottom: 0 };
  const start = Math.max(0, Math.floor(range.top / rowHeight) - overscan);
  const end = Math.min(count, Math.ceil((range.top + range.height) / rowHeight) + overscan);
  return { active, start, end, padTop: start * rowHeight, padBottom: (count - end) * rowHeight };
}
