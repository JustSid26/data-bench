import { useCallback, useRef, useState } from "react";
import type { ReactNode, PointerEvent as ReactPointerEvent } from "react";
import { AnimatePresence, m } from "motion/react";
import { tween } from "../../lib/motion";

interface Tip {
  x: number;
  y: number;
  content: ReactNode;
}

/** Hover tooltip for svg/div charts. Wrap the chart in `frame`, spread
 *  `bind(content)` on each mark. Positioned against the frame, so it works
 *  inside scrolled containers without portals. Keyboard: marks that are
 *  focusable call `bind` too and the tip anchors to the mark instead. */
export function useChartTooltip() {
  const frame = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<Tip | null>(null);

  const place = useCallback((clientX: number, clientY: number, content: ReactNode) => {
    const rect = frame.current?.getBoundingClientRect();
    if (!rect) return;
    setTip({ x: clientX - rect.left, y: clientY - rect.top, content });
  }, []);

  const bind = useCallback(
    (content: ReactNode) => ({
      onPointerMove: (event: ReactPointerEvent) => place(event.clientX, event.clientY, content),
      onPointerLeave: () => setTip(null),
      onFocus: (event: React.FocusEvent<Element>) => {
        const box = event.currentTarget.getBoundingClientRect();
        place(box.left + box.width / 2, box.top, content);
      },
      onBlur: () => setTip(null),
    }),
    [place],
  );

  const node = (
    <AnimatePresence>
      {tip && (
        <m.div
          role="tooltip"
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={tween.fast}
          style={{ left: tip.x, top: tip.y }}
          className="pointer-events-none absolute z-30 -translate-x-1/2 -translate-y-[calc(100%+10px)] glass-sheet rounded-lg border border-line px-2.5 py-1.5 text-[12px] whitespace-nowrap text-ink shadow-md"
        >
          {tip.content}
        </m.div>
      )}
    </AnimatePresence>
  );

  return { frame, bind, node, clear: () => setTip(null) };
}

/** Two-line tooltip body: a label and a value. */
export function TipBody({ title, children }: { title: ReactNode; children?: ReactNode }) {
  return (
    <div>
      <div className="font-medium">{title}</div>
      {children && <div className="tnum text-ink-muted">{children}</div>}
    </div>
  );
}
