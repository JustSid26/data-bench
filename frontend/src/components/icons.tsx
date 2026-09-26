/** Hand-rolled 24px line icons. The Stitch export pulled the Material Symbols
 *  webfont for six glyphs; inlining them saves that request entirely.
 *  Each path is split on "M", so every subpath starts with a move. */
const paths: Record<string, string> = {
  grid: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z",
  chart: "M5 20V10M12 20V4M19 20v-6",
  model: "M6 4v6M6 14v6M6 10h6a2 2 0 0 1 2 2v0a2 2 0 0 0 2 2h2M18 4h2M18 20h2",
  check: "M9 12.5l2.5 2.5L16 9M5 5h14v14H5z",
  tick: "M5 12.5l4.5 4.5L19 7.5",
  upload: "M12 16V4M8 8l4-4 4 4M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3",
  file: "M14 3v5h5M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z",
  warn: "M12 9v5M12 17.5v.5M10.3 4.3 2.6 18a1.5 1.5 0 0 0 1.3 2.3h16.2a1.5 1.5 0 0 0 1.3-2.3L13.7 4.3a1.5 1.5 0 0 0-2.6 0z",
  critical: "M12 8v5M12 16.5v.5M8.3 3h7.4L21 8.3v7.4L15.7 21H8.3L3 15.7V8.3z",
  ok: "M8.5 12.5l2.5 2.5 4.5-5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z",
  info: "M12 11v5M12 7.5v.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z",
  sun: "M12 5V3M12 21v-2M5 12H3M21 12h-2M6.3 6.3 4.9 4.9M19.1 19.1l-1.4-1.4M6.3 17.7l-1.4 1.4M19.1 4.9l-1.4 1.4M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0z",
  moon: "M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z",
  play: "M7 4l12 8-12 8z",
  back: "M14 6l-6 6 6 6",
  next: "M10 6l6 6-6 6",
  down: "M6 10l6 6 6-6",
  up: "M6 14l6-6 6 6",
  arrow: "M5 12h14M13 6l6 6-6 6",
  trash: "M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13",
  download: "M12 4v12M8 12l4 4 4-4M4 20h16",
  search: "M20 20l-4.5-4.5M17 10.5a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0z",
  close: "M6 6l12 12M18 6 6 18",
  menu: "M4 7h16M4 12h16M4 17h16",
  sidebar: "M4 5h16v14H4zM9 5v14",
  undo: "M9 14 4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11",
  keyboard: "M3 7h18v10H3zM7 10.5h.01M11 10.5h.01M15 10.5h.01M8 14h8",
  command: "M9 9V6.5A2.5 2.5 0 1 0 6.5 9H9zM9 9h6M9 9v6M15 9V6.5A2.5 2.5 0 1 1 17.5 9H15zM15 9v6M9 15H6.5A2.5 2.5 0 1 0 9 17.5V15zM9 15h6M15 15h2.5a2.5 2.5 0 1 1-2.5 2.5V15z",
  sparkle: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z",
  wand: "M4 20 15 9M14 4v2M19 9h2M18.5 5.5 17 7M10 5.5 11 7M18.5 13.5 17 12",
  droplet: "M12 3.5s6 6.4 6 10.5a6 6 0 0 1-12 0c0-4.1 6-10.5 6-10.5z",
  layers: "M12 4 3 9l9 5 9-5zM3 14l9 5 9-5",
  sort: "M8 5v14M5 16l3 3 3-3M16 19V5M13 8l3-3 3 3",
  filter: "M4 5h16l-6 7.5V19l-4-2v-4.5z",
  stop: "M7 7h10v10H7z",
  clock: "M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z",
  copy: "M9 9h11v11H9zM5 15H4V4h11v1",
  link: "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1",
  target: "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0zM16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0zM12 12h.01",
  report: "M14 3v5h5M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8zM9 13h6M9 17h4",

  // one glyph per column kind, so a type never depends on colour alone
  "kind-numeric": "M9 4 7 20M17 4l-2 16M4 9h16M3.5 15h16",
  "kind-categorical": "M3.5 12.5 11.5 4.5H19.5V12.5L11.5 20.5ZM15.5 8.5h.01",
  "kind-boolean": "M8 7h8a5 5 0 0 1 0 10H8A5 5 0 0 1 8 7zM16 14.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z",
  "kind-datetime": "M4 6h16v14H4zM4 10h16M8 3v4M16 3v4",
  "kind-text": "M5 6V5h14v1M12 5v14M9 19h6",
  "kind-identifier": "M14.5 9.5a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0zM13.5 12l6.5 6.5M17 16l2-2",
  "kind-constant": "M5 12h14",
  "kind-empty": "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0zM5.6 18.4 18.4 5.6",

  // file types for the drop zone
  "file-csv": "M14 3v5h5M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8zM8 12h8M8 15h8M8 18h8M12 12v6",
  "file-json": "M14 3v5h5M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8zM10 12c-1 0-1 .5-1 1.5s0 1.5-1 1.5c1 0 1 .5 1 1.5s0 1.5 1 1.5M14 12c1 0 1 .5 1 1.5s0 1.5 1 1.5c-1 0-1 .5-1 1.5s0 1.5-1 1.5",
  "file-sheet": "M14 3v5h5M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8zM9 12l6 6M15 12l-6 6",
  "file-parquet": "M14 3v5h5M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8zM8 12h3v3H8zM13 12h3v3h-3zM8 17h3v1M13 17h3v1",
};

export type IconName = keyof typeof paths;

export function Icon({ name, className = "size-[18px]" }: { name: IconName | string; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {(paths[name] ?? "")
        .split("M")
        .filter(Boolean)
        .map((segment, index) => (
          <path key={index} d={"M" + segment} />
        ))}
    </svg>
  );
}
