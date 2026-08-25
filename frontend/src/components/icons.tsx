/** Hand-rolled 20px line icons. The Stitch export pulled the Material Symbols
 *  webfont for six glyphs; inlining them saves that request entirely. */
const paths: Record<string, string> = {
  grid: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z",
  chart: "M5 20V10M12 20V4M19 20v-6",
  model: "M6 4v6M6 14v6M6 10h6a2 2 0 0 1 2 2v0a2 2 0 0 0 2 2h2M18 4h2M18 20h2",
  check: "M9 12.5l2.5 2.5L16 9M5 5h14v14H5z",
  upload: "M12 16V4M8 8l4-4 4 4M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3",
  file: "M14 3v5h5M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z",
  warn: "M12 9v5M12 17.5v.5M10.3 4.3 2.6 18a1.5 1.5 0 0 0 1.3 2.3h16.2a1.5 1.5 0 0 0 1.3-2.3L13.7 4.3a1.5 1.5 0 0 0-2.6 0z",
  sun: "M12 5V3M12 21v-2M5 12H3M21 12h-2M6.3 6.3 4.9 4.9M19.1 19.1l-1.4-1.4M6.3 17.7l-1.4 1.4M19.1 4.9l-1.4 1.4M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0z",
  moon: "M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z",
  play: "M7 4l12 8-12 8z",
  back: "M14 6l-6 6 6 6",
  trash: "M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13",
  download: "M12 4v12M8 12l4 4 4-4M4 20h16",
};

export function Icon({ name, className = "size-[18px]" }: { name: keyof typeof paths | string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {(paths[name] ?? "").split("M").filter(Boolean).map((segment, index) => (
        <path key={index} d={"M" + segment} />
      ))}
    </svg>
  );
}
