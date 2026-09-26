import { useMemo, useState } from "react";
import { m } from "motion/react";
import { Icon } from "../icons";
import { CountUp, tween } from "../../lib/motion";
import { KIND } from "../../lib/tokens";
import type { Kind } from "../../lib/types";

function arc(cx: number, cy: number, r: number, start: number, end: number) {
  const point = (angle: number) => [cx + r * Math.cos(angle), cy + r * Math.sin(angle)];
  const [x0, y0] = point(start);
  const [x1, y1] = point(end);
  return `M ${x0} ${y0} A ${r} ${r} 0 ${end - start > Math.PI ? 1 : 0} 1 ${x1} ${y1}`;
}

/** Column-type mix as a donut: each segment draws in turn, the legend carries
 *  a glyph + name + count so identity never rests on colour. */
export function TypeDonut({
  composition,
  size = 148,
  onSelect,
}: {
  composition: { kind: Kind; count: number }[];
  size?: number;
  onSelect?: (kind: Kind) => void;
}) {
  const [hovered, setHovered] = useState<Kind | null>(null);
  const total = composition.reduce((sum, item) => sum + item.count, 0) || 1;
  const stroke = size / 7.5;
  const r = (size - stroke) / 2;
  // a surface-coloured gap between segments, in radians
  const gap = composition.length > 1 ? 3 / r : 0;

  const segments = useMemo(() => {
    let angle = -Math.PI / 2;
    return composition.map((item) => {
      const sweep = (item.count / total) * Math.PI * 2;
      const start = angle + gap / 2;
      const end = angle + Math.max(sweep - gap / 2, gap / 2 + 0.0001);
      angle += sweep;
      // a single full-circle arc degenerates; split it at the bottom
      const d =
        composition.length === 1
          ? `${arc(size / 2, size / 2, r, -Math.PI / 2, Math.PI / 2)} ${arc(size / 2, size / 2, r, Math.PI / 2, (3 * Math.PI) / 2 - 0.0001).replace("M", "L")}`
          : arc(size / 2, size / 2, r, start, end);
      return { ...item, d };
    });
  }, [composition, total, gap, r, size]);

  const focus = hovered ? composition.find((item) => item.kind === hovered) : null;

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={composition.map((item) => `${item.count} ${KIND[item.kind].label.toLowerCase()}`).join(", ")}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth={stroke} opacity={0.5} />
          {segments.map((segment, index) => (
            <m.path
              key={segment.kind}
              d={segment.d}
              fill="none"
              stroke={KIND[segment.kind].color}
              strokeWidth={stroke}
              initial={{ pathLength: 0, opacity: 0 }}
              whileInView={{ pathLength: 1, opacity: hovered && hovered !== segment.kind ? 0.3 : 1 }}
              viewport={{ once: true }}
              transition={{ pathLength: { ...tween.draw, delay: index * 0.12 }, opacity: tween.fast }}
              onPointerEnter={() => setHovered(segment.kind)}
              onPointerLeave={() => setHovered(null)}
              onClick={() => onSelect?.(segment.kind)}
              className={onSelect ? "cursor-pointer" : undefined}
            />
          ))}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="tnum text-[26px] leading-none font-semibold">
            {focus ? focus.count : <CountUp value={total} />}
          </span>
          <span className="mt-1 text-[11px] text-ink-muted">{focus ? KIND[focus.kind].label.toLowerCase() : "columns"}</span>
        </div>
      </div>

      <ul className="grid w-full min-w-0 grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-1">
        {composition.map((item) => {
          const token = KIND[item.kind];
          const Tag = onSelect ? "button" : "div";
          return (
            <li key={item.kind}>
              <Tag
                {...(onSelect ? { type: "button" as const, onClick: () => onSelect(item.kind) } : {})}
                onPointerEnter={() => setHovered(item.kind)}
                onPointerLeave={() => setHovered(null)}
                onFocus={() => setHovered(item.kind)}
                onBlur={() => setHovered(null)}
                className={`flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left text-[12px] transition-colors ${
                  hovered === item.kind ? "bg-hover" : ""
                }`}
              >
                <span className="size-2.5 shrink-0 rounded-sm" style={{ background: token.color }} />
                <Icon name={token.icon} className={`size-3.5 shrink-0 ${token.text}`} />
                <span className="truncate text-ink">{token.label}</span>
                <span className="tnum ml-auto text-ink-muted">{item.count}</span>
                <span className="tnum w-9 text-right text-ink-faint">{Math.round((item.count / total) * 100)}%</span>
              </Tag>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
