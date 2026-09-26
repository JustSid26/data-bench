import { m } from "motion/react";
import * as Tooltip from "@radix-ui/react-tooltip";
import { Icon } from "../icons";
import { Meter } from "../primitives";
import { CountUp, tween } from "../../lib/motion";
import { QUALITY, scoreQuality } from "../../lib/tokens";
import type { Health } from "../../lib/insights";

/** Dataset health, 0–100, as a ring that draws itself in. Hover or focus
 *  shows how each component contributed. */
export function HealthRing({ health, size = 132, showBreakdown = false }: { health: Health; size?: number; showBreakdown?: boolean }) {
  const quality = scoreQuality(health.score);
  const token = QUALITY[quality];
  const stroke = Math.max(8, size / 13);
  const radius = (size - stroke) / 2;

  const ring = (
    <button
      type="button"
      aria-label={`Dataset health ${health.score} out of 100, ${token.label.toLowerCase()}. ${health.parts
        .map((part) => `${part.label} ${Math.round(part.value)}`)
        .join(", ")}`}
      className="relative grid shrink-0 place-items-center rounded-full"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--line)" strokeWidth={stroke} />
        <m.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={token.color}
          strokeWidth={stroke}
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          whileInView={{ pathLength: health.score / 100 }}
          viewport={{ once: true }}
          transition={{ ...tween.draw, duration: 1.1 }}
        />
      </svg>
      <span className="absolute inset-0 flex flex-col items-center justify-center">
        <span style={{ fontSize: Math.round(size / 4.2) }}>
          <CountUp value={health.score} className="tnum leading-none font-semibold tracking-[-0.03em]" duration={1.1} />
        </span>
        <span className={`mt-1 flex items-center gap-1 text-[11px] font-semibold ${token.text}`}>
          <Icon name={token.icon} className="size-3" />
          {token.label}
        </span>
      </span>
    </button>
  );

  return (
    <div className={`flex w-full gap-5 ${showBreakdown ? "flex-col items-start min-[480px]:flex-row min-[480px]:items-center" : "items-center"}`}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>{ring}</Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            side="right"
            sideOffset={8}
            className="glass-sheet z-50 w-64 rounded-[16px] border border-line p-3 text-[12px]"
          >
            <p className="mb-2 font-semibold">How the score is built</p>
            <Breakdown health={health} />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
      {showBreakdown && (
        <div className="w-full min-w-0 flex-1">
          <Breakdown health={health} compact />
        </div>
      )}
    </div>
  );
}

function Breakdown({ health, compact = false }: { health: Health; compact?: boolean }) {
  return (
    <ul className={compact ? "grid grid-cols-2 gap-x-5 gap-y-2.5 text-[12px]" : "space-y-2"}>
      {health.parts.map((part, index) => {
        const quality = scoreQuality(part.value);
        return (
          <li key={part.key}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="truncate text-ink-muted">
                {part.label} {!compact && <span className="text-ink-faint">×{part.weight}</span>}
              </span>
              <span className="tnum font-medium">{Math.round(part.value)}</span>
            </div>
            <Meter
              value={part.value}
              tone={quality === "good" ? "good" : quality === "warning" ? "warn" : "bad"}
              delay={0.1 + index * 0.08}
              className="mt-1"
            />
            <p className={`mt-0.5 text-[11px] text-ink-faint ${compact ? "truncate" : ""}`} title={part.detail}>
              {part.detail}
            </p>
          </li>
        );
      })}
    </ul>
  );
}
