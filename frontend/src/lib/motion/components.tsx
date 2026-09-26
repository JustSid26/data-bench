import { useEffect, useLayoutEffect, useRef } from "react";
import type { ReactNode } from "react";
import { LazyMotion, MotionConfig, animate, m, useInView, useReducedMotion } from "motion/react";
import { fadeUp } from "./presets";

const loadFeatures = () => import("./features").then((module) => module.default);

/** Wraps the app once. `strict` makes a stray `motion.div` a runtime error, so
 *  nothing bypasses the lazy bundle; `reducedMotion="user"` turns transform
 *  animations into instant jumps when the OS asks for less motion. */
export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={loadFeatures} strict>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  );
}

/** One route's content. Keyed by pathname inside an AnimatePresence. */
export function PageTransition({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <m.div variants={fadeUp} initial="hidden" animate="show" exit="exit" className={className}>
      {children}
    </m.div>
  );
}

/** Counts from the last shown value to `value` when it changes or scrolls into
 *  view. Writes textContent directly -- no re-render per frame. */
export function CountUp({
  value,
  format = (n) => Math.round(n).toLocaleString("en-US"),
  duration = 0.9,
  className,
}: {
  value: number;
  format?: (n: number) => string;
  duration?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const shown = useRef(0);
  const seen = useInView(ref, { once: true });
  const reduced = useReducedMotion();
  // the latest formatter without restarting the animation when a caller passes an inline one
  const formatRef = useRef(format);
  formatRef.current = format;

  // paint the starting value before the browser shows anything
  useLayoutEffect(() => {
    if (ref.current && !ref.current.textContent) ref.current.textContent = formatRef.current(reduced ? value : 0);
  }, []);

  useEffect(() => {
    const node = ref.current;
    if (!node || !seen) return;
    if (reduced || !Number.isFinite(value)) {
      shown.current = value;
      node.textContent = formatRef.current(value);
      return;
    }
    const controls = animate(shown.current, value, {
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (latest) => {
        shown.current = latest;
        node.textContent = formatRef.current(latest);
      },
    });
    return () => controls.stop();
  }, [value, seen, reduced, duration]);

  // the ticking span is hidden from assistive tech; readers get the final value once
  return (
    <span className={className}>
      <span ref={ref} aria-hidden="true" />
      <span className="sr-only">{format(value)}</span>
    </span>
  );
}
