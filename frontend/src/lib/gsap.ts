/** GSAP with ScrollTrigger registered once. Landing-page only -- the app itself
 *  animates with motion. Every effect built on this goes through
 *  `gsap.matchMedia()` so reduced-motion users get the final state, still. */
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export const MOTION_OK = "(prefers-reduced-motion: no-preference)";

export { gsap, ScrollTrigger };
