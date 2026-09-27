/** Animated sketches of how each algorithm works, for the landing page.
 *  Every sketch loops only while on screen and holds its final frame when the
 *  viewer prefers reduced motion. Colours come from the validated class hues. */
import { useRef } from "react";
import type { ReactNode } from "react";
import { m, useInView, useReducedMotion } from "motion/react";

const A = "var(--kind-numeric)"; // class A / cluster 1
const B = "var(--kind-categorical)"; // class B / cluster 2
const C = "var(--kind-boolean)"; // cluster 3
const INK = "var(--ink-faint)";
const LINE = "var(--line-strong)";

/** Tiny seeded generator, so every render draws the same points. */
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function blob(cx: number, cy: number, n: number, spread: number, seed: number) {
  const r = rng(seed);
  return Array.from({ length: n }, () => {
    const angle = r() * Math.PI * 2;
    const dist = Math.sqrt(r()) * spread;
    return [cx + Math.cos(angle) * dist, cy + Math.sin(angle) * dist] as const;
  });
}

/** Wraps a sketch: reports whether it should be animating. */
function Frame({ label, children }: { label: string; children: (live: boolean) => ReactNode }) {
  const ref = useRef<SVGSVGElement>(null);
  const seen = useInView(ref, { amount: 0.3 });
  const reduced = useReducedMotion();
  return (
    <svg ref={ref} viewBox="0 0 200 130" className="h-full w-full" role="img" aria-label={label}>
      {children(Boolean(seen) && !reduced)}
    </svg>
  );
}

const loop = (live: boolean, duration: number, delay = 0, repeatDelay = 1.2) =>
  live ? { duration, delay, repeat: Infinity, repeatDelay, ease: "easeInOut" as const } : { duration: 0 };

/* ------------------------------------------------------------ decision tree */
export function DecisionTreeArt() {
  const nodes = [
    { x: 100, y: 16, label: "age < 30" },
    { x: 55, y: 58, label: "fare < 12" },
    { x: 145, y: 58, label: "class = 1" },
  ];
  const leaves = [
    { x: 30, y: 104, c: A },
    { x: 80, y: 104, c: B },
    { x: 120, y: 104, c: B },
    { x: 170, y: 104, c: A },
  ];
  const edges = [
    [100, 24, 55, 50],
    [100, 24, 145, 50],
    [55, 66, 30, 96],
    [55, 66, 80, 96],
    [145, 66, 120, 96],
    [145, 66, 170, 96],
  ];
  return (
    <Frame label="A decision tree splitting rows on one question at a time">
      {(live) => (
        <>
          {edges.map(([x1, y1, x2, y2], i) => (
            <m.path
              key={i}
              d={`M${x1} ${y1} L${x2} ${y2}`}
              stroke={LINE}
              strokeWidth={1.5}
              fill="none"
              initial={{ pathLength: live ? 0 : 1 }}
              animate={{ pathLength: live ? [0, 1, 1, 0] : 1 }}
              transition={{ ...loop(live, 4.5, 0.3 + (i < 2 ? 0 : 0.6)), times: [0, 0.2, 0.85, 1] }}
            />
          ))}
          {nodes.map((node, i) => (
            <m.g
              key={node.label}
              initial={{ opacity: live ? 0 : 1 }}
              animate={{ opacity: live ? [0, 1, 1, 0] : 1 }}
              transition={{ ...loop(live, 4.5, i === 0 ? 0 : 0.35), times: [0, 0.12, 0.85, 1] }}
            >
              <rect x={node.x - 30} y={node.y - 9} width={60} height={17} rx={5} fill="var(--card-raised)" stroke={LINE} />
              <text x={node.x} y={node.y + 3} textAnchor="middle" fontSize={8.5} className="font-mono" fill="var(--ink)">
                {node.label}
              </text>
            </m.g>
          ))}
          {leaves.map((leaf, i) => (
            <m.circle
              key={i}
              cx={leaf.x}
              cy={leaf.y + 8}
              r={9}
              fill={leaf.c}
              initial={{ opacity: live ? 0 : 0.9 }}
              animate={{ opacity: live ? [0, 0.9, 0.9, 0] : 0.9 }}
              transition={{ ...loop(live, 4.5, 1.2 + i * 0.12), times: [0, 0.12, 0.85, 1] }}
            />
          ))}
        </>
      )}
    </Frame>
  );
}

/* ----------------------------------------------------------- random forest */
function MiniTree({ x, color, live, delay }: { x: number; color: string; live: boolean; delay: number }) {
  const path = `M${x} 18 L${x - 16} 44 M${x} 18 L${x + 16} 44 M${x - 16} 44 L${x - 24} 66 M${x - 16} 44 L${x - 8} 66 M${x + 16} 44 L${x + 24} 66`;
  return (
    <m.g initial={{ opacity: live ? 0 : 1 }} animate={{ opacity: live ? [0, 1, 1, 0] : 1 }} transition={{ ...loop(live, 4.4, delay), times: [0, 0.15, 0.85, 1] }}>
      <path d={path} stroke={LINE} strokeWidth={1.4} fill="none" />
      {[
        [x, 18],
        [x - 16, 44],
        [x + 16, 44],
      ].map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r={3.5} fill={INK} />
      ))}
      {[x - 24, x - 8, x + 8, x + 24].map((cx, i) => (
        <circle key={i} cx={cx} cy={66} r={4} fill={i % 2 ? color : color === A ? B : A} opacity={0.85} />
      ))}
      <m.path
        d={`M${x} 74 L100 104`}
        stroke={color}
        strokeWidth={1.5}
        strokeDasharray="3 3"
        fill="none"
        initial={{ pathLength: live ? 0 : 1 }}
        animate={{ pathLength: live ? [0, 0, 1, 1, 0] : 1 }}
        transition={{ ...loop(live, 4.4, delay), times: [0, 0.3, 0.5, 0.85, 1] }}
      />
    </m.g>
  );
}

export function RandomForestArt() {
  return (
    <Frame label="A random forest: many trees vote and the majority wins">
      {(live) => (
        <>
          <MiniTree x={40} color={A} live={live} delay={0} />
          <MiniTree x={100} color={A} live={live} delay={0.2} />
          <MiniTree x={160} color={B} live={live} delay={0.4} />
          <m.g initial={{ scale: live ? 0 : 1 }} animate={{ scale: live ? [0, 0, 1, 1, 0] : 1 }} transition={{ ...loop(live, 4.4, 0.4), times: [0, 0.5, 0.6, 0.85, 1] }} style={{ transformBox: "fill-box", originX: 0.5, originY: 0.5 }}>
            <rect x={78} y={104} width={44} height={18} rx={9} fill={A} />
            <text x={100} y={116} textAnchor="middle" fontSize={8.5} fontWeight={600} fill="#fff">
              vote 2 : 1
            </text>
          </m.g>
        </>
      )}
    </Frame>
  );
}

/* -------------------------------------------------------- gradient boosting */
export function GradientBoostingArt() {
  const residuals = [34, -26, 40, -18, 30, -36, 22, -28];
  return (
    <Frame label="Gradient boosting: each new tree shrinks the errors left by the ones before">
      {(live) => (
        <>
          <line x1={14} x2={186} y1={62} y2={62} stroke={LINE} strokeWidth={1} />
          <text x={14} y={14} fontSize={8} fill={INK}>
            errors after each round
          </text>
          {residuals.map((r, i) => {
            const x = 22 + i * 21;
            const steps = [1, 0.6, 0.35, 0.18, 0.1].map((f) => f);
            return (
              <m.rect
                key={i}
                x={x}
                width={11}
                rx={2}
                y={r > 0 ? 62 - Math.abs(r) : 62}
                height={Math.abs(r)}
                fill={r > 0 ? A : B}
                opacity={0.85}
                style={{ transformBox: "fill-box", originY: r > 0 ? 1 : 0 }}
                initial={{ scaleY: 1 }}
                animate={{ scaleY: live ? [...steps, 1] : 0.1 }}
                transition={{ ...loop(live, 5, i * 0.04, 0.4), times: [0, 0.2, 0.4, 0.6, 0.85, 1] }}
              />
            );
          })}
          {["1", "50", "100", "200"].map((round, i) => (
            <m.text
              key={round}
              x={100}
              y={120}
              textAnchor="middle"
              fontSize={9}
              className="font-mono"
              fill="var(--ink-muted)"
              initial={{ opacity: live ? 0 : i === 3 ? 1 : 0 }}
              animate={{ opacity: live ? [0, 1, 1, 0] : i === 3 ? 1 : 0 }}
              transition={{ ...(live ? { duration: 1.1, delay: i * 1.05, repeat: Infinity, repeatDelay: 4.6 - 1.1 } : { duration: 0 }), times: [0, 0.1, 0.8, 1] }}
            >
              round {round}
            </m.text>
          ))}
        </>
      )}
    </Frame>
  );
}

/* ------------------------------------------------------ logistic regression */
export function LogisticArt() {
  const r = rng(7);
  const points = Array.from({ length: 22 }, (_, i) => {
    const x = 16 + (i / 21) * 168 + (r() - 0.5) * 10;
    const positive = x > 100 ? r() > 0.12 : r() < 0.12;
    return { x, y: positive ? 22 + r() * 10 : 98 + r() * 10, positive };
  });
  const curve = Array.from({ length: 41 }, (_, i) => {
    const x = 10 + i * 4.5;
    const p = 1 / (1 + Math.exp(-(x - 100) / 14));
    return `${i ? "L" : "M"}${x.toFixed(1)} ${(108 - p * 84).toFixed(1)}`;
  }).join(" ");
  return (
    <Frame label="Logistic regression: an S-curve turns a score into a probability">
      {(live) => (
        <>
          <m.line x1={100} x2={100} y1={10} y2={118} stroke={INK} strokeDasharray="3 3" initial={{ opacity: 0.6 }} />
          <text x={104} y={124} fontSize={7.5} fill={INK}>
            p = 0.5
          </text>
          {points.map((p, i) => (
            <m.circle
              key={i}
              cx={p.x}
              cy={p.y}
              r={3.2}
              fill={p.positive ? B : A}
              initial={{ opacity: live ? 0.25 : 0.9 }}
              animate={{ opacity: live ? [0.25, 0.25, 0.9, 0.9, 0.25] : 0.9 }}
              transition={{ ...loop(live, 4.6, 0, 0.6), times: [0, 0.35 + (p.x / 200) * 0.2, 0.55 + (p.x / 200) * 0.2, 0.9, 1] }}
            />
          ))}
          <m.path
            d={curve}
            stroke="var(--accent)"
            strokeWidth={2.5}
            fill="none"
            initial={{ pathLength: live ? 0 : 1 }}
            animate={{ pathLength: live ? [0, 1, 1, 0] : 1 }}
            transition={{ ...loop(live, 4.6, 0, 0.6), times: [0, 0.4, 0.9, 1] }}
          />
        </>
      )}
    </Frame>
  );
}

/* --------------------------------------------------------- ridge regression */
export function RidgeArt() {
  const r = rng(3);
  const points = Array.from({ length: 24 }, (_, i) => {
    const x = 18 + (i / 23) * 164;
    return { x, y: 104 - (x - 18) * 0.42 - 8 + (r() - 0.5) * 30 };
  });
  return (
    <Frame label="Ridge regression: the line settles where squared errors are smallest">
      {(live) => (
        <>
          {points.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={3} fill={A} opacity={0.75} />
          ))}
          <m.g
            style={{ originX: "100px", originY: "65px" }}
            initial={{ rotate: live ? 18 : -21 }}
            animate={{ rotate: live ? [18, -34, -12, -24, -21, -21] : -21 }}
            transition={{ ...loop(live, 4.2, 0, 0.8), times: [0, 0.25, 0.45, 0.6, 0.72, 1] }}
          >
            <line x1={10} x2={190} y1={65} y2={65} stroke="var(--accent)" strokeWidth={2.5} strokeLinecap="round" />
          </m.g>
          <text x={14} y={124} fontSize={8} fill={INK}>
            fitting…  y = w·x + b, with |w| kept small
          </text>
        </>
      )}
    </Frame>
  );
}

/* ------------------------------------------------------------------ k-means */
export function KMeansArt() {
  const groups = [blob(52, 44, 11, 22, 11), blob(146, 40, 11, 22, 23), blob(100, 98, 11, 20, 37)];
  const colors = [A, B, C];
  const centroidPath = [
    { x: [30, 70, 55, 52], y: [100, 70, 50, 44] },
    { x: [100, 120, 140, 146], y: [20, 30, 38, 40] },
    { x: [180, 140, 110, 100], y: [110, 104, 100, 98] },
  ];
  return (
    <Frame label="K-means: centres move to the middle of their points until nothing changes">
      {(live) => (
        <>
          {groups.map((group, g) =>
            group.map(([x, y], i) => (
              <m.circle
                key={`${g}-${i}`}
                cx={x}
                cy={y}
                r={3.2}
                initial={{ fill: live ? INK : colors[g] }}
                animate={{ fill: live ? [INK, INK, colors[g], colors[g], INK] : colors[g] }}
                transition={{ ...loop(live, 5, 0, 0.5), times: [0, 0.35, 0.6, 0.92, 1] }}
              />
            )),
          )}
          {centroidPath.map((path, i) => (
            <m.g
              key={i}
              initial={{ x: live ? path.x[0] : path.x[3], y: live ? path.y[0] : path.y[3] }}
              animate={{ x: live ? [...path.x, path.x[3], path.x[0]] : path.x[3], y: live ? [...path.y, path.y[3], path.y[0]] : path.y[3] }}
              transition={{ ...loop(live, 5, 0, 0.5), times: [0, 0.2, 0.4, 0.6, 0.92, 1] }}
            >
              <path d="M-6 -6 L6 6 M6 -6 L-6 6" stroke={colors[i]} strokeWidth={3} strokeLinecap="round" />
              <path d="M-6 -6 L6 6 M6 -6 L-6 6" stroke="var(--surface)" strokeWidth={1} strokeLinecap="round" />
            </m.g>
          ))}
        </>
      )}
    </Frame>
  );
}

/* ------------------------------------------------------------------- dbscan */
export function DbscanArt() {
  const moon = Array.from({ length: 16 }, (_, i) => {
    const t = Math.PI * (i / 15);
    return [60 + Math.cos(t) * 40, 70 - Math.sin(t) * 38] as const;
  });
  const ring = Array.from({ length: 14 }, (_, i) => {
    const t = (Math.PI * 2 * i) / 14;
    return [148 + Math.cos(t) * 24, 66 + Math.sin(t) * 24] as const;
  });
  const noise = [
    [20, 118],
    [110, 18],
    [104, 116],
    [188, 110],
  ] as const;
  return (
    <Frame label="DBSCAN: dense neighbourhoods become clusters of any shape; stragglers are noise">
      {(live) => (
        <>
          {[moon, ring].map((shape, s) =>
            shape.map(([x, y], i) => (
              <g key={`${s}-${i}`}>
                <m.circle
                  cx={x}
                  cy={y}
                  r={11}
                  fill={s ? B : A}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: live ? [0, 0.12, 0.12, 0] : 0 }}
                  transition={{ ...loop(live, 4.8, (i / shape.length) * 1.4 + s * 0.3, 0.4), times: [0, 0.15, 0.7, 1] }}
                />
                <m.circle
                  cx={x}
                  cy={y}
                  r={3.2}
                  initial={{ fill: live ? INK : s ? B : A }}
                  animate={{ fill: live ? [INK, s ? B : A, s ? B : A, INK] : s ? B : A }}
                  transition={{ ...loop(live, 4.8, (i / shape.length) * 1.4 + s * 0.3, 0.4), times: [0, 0.15, 0.8, 1] }}
                />
              </g>
            )),
          )}
          {noise.map(([x, y], i) => (
            <g key={i}>
              <circle cx={x} cy={y} r={3.2} fill={INK} />
              <m.circle
                cx={x}
                cy={y}
                r={7}
                fill="none"
                stroke="var(--warn)"
                strokeWidth={1.2}
                initial={{ opacity: live ? 0 : 0.9 }}
                animate={{ opacity: live ? [0, 0, 0.9, 0.9, 0] : 0.9 }}
                transition={{ ...loop(live, 4.8, 0, 0.4), times: [0, 0.55, 0.65, 0.9, 1] }}
              />
            </g>
          ))}
        </>
      )}
    </Frame>
  );
}

/* --------------------------------------------------------- isolation forest */
export function IsolationArt() {
  const crowd = blob(76, 70, 26, 30, 51);
  const outlier = [172, 22] as const;
  const cuts = [
    "M150 6 L150 124",
    "M120 40 L196 40",
    "M160 6 L160 40",
    "M150 30 L196 30",
  ];
  return (
    <Frame label="Isolation forest: odd rows are cut off from the rest in very few random splits">
      {(live) => (
        <>
          {crowd.map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r={3} fill={A} opacity={0.7} />
          ))}
          {cuts.map((d, i) => (
            <m.path
              key={i}
              d={d}
              stroke={INK}
              strokeWidth={1.2}
              strokeDasharray="4 3"
              fill="none"
              initial={{ pathLength: live ? 0 : 1 }}
              animate={{ pathLength: live ? [0, 1, 1, 0] : 1 }}
              transition={{ ...loop(live, 4.4, i * 0.45, 0.6), times: [0, 0.12, 0.85, 1] }}
            />
          ))}
          <circle cx={outlier[0]} cy={outlier[1]} r={4} fill="var(--warn)" />
          <m.circle
            cx={outlier[0]}
            cy={outlier[1]}
            r={4}
            fill="none"
            stroke="var(--warn)"
            strokeWidth={1.5}
            style={{ transformBox: "fill-box", originX: 0.5, originY: 0.5 }}
            initial={{ scale: 1, opacity: 0 }}
            animate={live ? { scale: [1, 1, 3.2], opacity: [0, 0.9, 0] } : { scale: 2, opacity: 0.6 }}
            transition={live ? { duration: 1.6, delay: 2, repeat: Infinity, repeatDelay: 3.4 } : { duration: 0 }}
          />
          <text x={132} y={124} fontSize={8} fill="var(--warn)">
            isolated in 4 cuts
          </text>
        </>
      )}
    </Frame>
  );
}
