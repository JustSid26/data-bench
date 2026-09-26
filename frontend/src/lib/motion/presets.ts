/** Shared motion vocabulary. Everything animates transform / opacity only, so
 *  the compositor does the work and layout never thrashes. */
import type { Transition, Variants } from "motion/react";

export const spring = {
  /** buttons, chips, toggles -- quick and a touch of bounce */
  snappy: { type: "spring", stiffness: 520, damping: 32, mass: 0.7 },
  /** cards, drawers, anything with some mass */
  soft: { type: "spring", stiffness: 260, damping: 30 },
  /** bars and fills that should settle without overshoot */
  settle: { type: "spring", stiffness: 140, damping: 24, restDelta: 0.001 },
} satisfies Record<string, Transition>;

export const tween = {
  fast: { duration: 0.14, ease: [0.4, 0, 0.2, 1] },
  base: { duration: 0.24, ease: [0.2, 0, 0, 1] },
  slow: { duration: 0.6, ease: [0.16, 1, 0.3, 1] },
  /** svg strokes and bar growth */
  draw: { duration: 0.9, ease: [0.16, 1, 0.3, 1] },
} satisfies Record<string, Transition>;

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: tween.base },
  exit: { opacity: 0, y: -6, transition: tween.fast },
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: tween.base },
  exit: { opacity: 0, transition: tween.fast },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.94 },
  show: { opacity: 1, scale: 1, transition: spring.soft },
  exit: { opacity: 0, scale: 0.97, transition: tween.fast },
};

export const slideIn = (from: "left" | "right" | "up" | "down" = "right", distance = 24): Variants => {
  const sign = from === "left" || from === "up" ? -1 : 1;
  const offset = (amount: number) => (from === "left" || from === "right" ? { x: amount } : { y: amount });
  return {
    hidden: { opacity: 0, ...offset(sign * distance) },
    show: { opacity: 1, ...offset(0), transition: spring.soft },
    exit: { opacity: 0, ...offset(sign * distance * 0.5), transition: tween.fast },
  };
};

/** Parent variant that staggers its children's `show`. */
export const stagger = (each = 0.045, delay = 0): Variants => ({
  hidden: {},
  show: { transition: { staggerChildren: each, delayChildren: delay } },
  exit: { transition: { staggerChildren: 0.02, staggerDirection: -1 } },
});

/** Props that make a motion element play its variants once it scrolls into view. */
export const inView = {
  initial: "hidden",
  whileInView: "show",
  viewport: { once: true, amount: 0.15 },
} as const;

/** Props for press feedback on anything clickable. */
export const press = {
  whileHover: { scale: 1.02 },
  whileTap: { scale: 0.98 },
  transition: spring.snappy,
} as const;

/** Cards that lift on hover. */
export const lift = {
  whileHover: { y: -2 },
  transition: spring.snappy,
} as const;
