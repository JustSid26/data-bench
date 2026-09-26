import type { TileTone } from "./primitives";

/** The screens behind a loaded dataset, with their `g` + letter shortcut and
 *  the tile colour that identifies them in the sidebar and palette. */
export const NAV: { to: string; label: string; icon: string; shortcut: string; tone: TileTone }[] = [
  { to: "/overview", label: "Overview", icon: "grid", shortcut: "o", tone: "indigo" },
  { to: "/analyse", label: "Analyse", icon: "chart", shortcut: "a", tone: "teal" },
  { to: "/clean", label: "Clean", icon: "wand", shortcut: "c", tone: "pink" },
  { to: "/model", label: "Model", icon: "model", shortcut: "m", tone: "purple" },
  { to: "/results", label: "Results", icon: "check", shortcut: "r", tone: "sky" },
];
