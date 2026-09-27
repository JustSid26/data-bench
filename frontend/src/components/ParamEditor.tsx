import { useEffect, useState } from "react";
import { m } from "motion/react";
import { Hint } from "./primitives";
import { Icon } from "./icons";
import { spring } from "../lib/motion";
import { paramError, valueOf } from "../lib/params";
import type { ParamSpec, ParamValue, ParamValues } from "../lib/types";

/** Editable hyperparameters for one algorithm. Only changed values are kept
 *  as overrides; setting a field back to its default removes the override. */
export function ParamEditor({
  specs,
  overrides,
  onChange,
  idPrefix,
}: {
  specs: ParamSpec[];
  overrides: ParamValues | undefined;
  onChange: (name: string, value: ParamValue | undefined) => void;
  idPrefix: string;
}) {
  return (
    <div className="space-y-2.5">
      {specs.map((spec) => {
        const value = valueOf(spec, overrides);
        const changed = overrides !== undefined && spec.name in overrides;
        const set = (next: ParamValue) => onChange(spec.name, next === spec.default ? undefined : next);
        const id = `${idPrefix}-${spec.name}`;
        return (
          <div key={spec.name}>
            <div className="mb-1 flex items-center gap-1.5">
              <label htmlFor={id} className="text-[12px] font-medium text-ink">
                {spec.label}
              </label>
              <code className="font-mono text-[10px] text-ink-faint">{spec.name}</code>
              {spec.help && (
                <Hint label={spec.help}>
                  <button type="button" aria-label={`About ${spec.label}`} className="text-ink-faint hover:text-ink">
                    <Icon name="info" className="size-3" />
                  </button>
                </Hint>
              )}
              {changed && (
                <button
                  type="button"
                  onClick={() => onChange(spec.name, undefined)}
                  className="ml-auto text-[11px] text-accent-fg hover:underline"
                  aria-label={`Reset ${spec.label} to ${String(spec.default ?? spec.none_label)}`}
                >
                  reset
                </button>
              )}
            </div>
            <Field spec={spec} value={value} onChange={set} id={id} />
          </div>
        );
      })}
    </div>
  );
}

function Field({ spec, value, onChange, id }: { spec: ParamSpec; value: ParamValue; onChange: (v: ParamValue) => void; id: string }) {
  if (spec.type === "bool") {
    const on = Boolean(value);
    return (
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={on}
        onClick={() => onChange(!on)}
        className={`relative h-5 w-9 rounded-full border transition-colors ${on ? "border-accent bg-accent" : "border-line-strong bg-line"}`}
      >
        <m.span layout transition={spring.snappy} className={`absolute top-0.5 size-3.5 rounded-full bg-white shadow-sm ${on ? "right-0.5" : "left-0.5"}`} />
      </button>
    );
  }

  if (spec.type === "choice") {
    const choices = spec.choices ?? [];
    if (choices.length <= 3) {
      return (
        <div id={id} role="radiogroup" aria-label={spec.label} className="grid rounded-[9px] bg-hover p-0.5 text-[12px]" style={{ gridTemplateColumns: `repeat(${choices.length}, minmax(0, 1fr))` }}>
          {choices.map((choice) => {
            const on = choice === value;
            return (
              <button
                key={choice}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => onChange(choice)}
                className={`relative truncate rounded-[7px] px-2 py-1 font-mono transition-colors ${on ? "bg-card-raised text-ink shadow-[0_1px_3px_rgba(0,0,0,0.15)]" : "text-ink-muted hover:text-ink"}`}
              >
                {choice}
              </button>
            );
          })}
        </div>
      );
    }
    return (
      <select
        id={id}
        value={String(value)}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-line bg-card px-2 py-1.5 font-mono text-[12px] outline-none focus:border-accent focus:ring-4 focus:ring-accent/20"
      >
        {choices.map((choice) => (
          <option key={choice}>{choice}</option>
        ))}
      </select>
    );
  }

  return <NumberField spec={spec} value={value} onChange={onChange} id={id} />;
}

/** A number box (plus a slider for modest linear ranges). Keeps the raw text
 *  while typing so "0." or "" does not snap back, and flags bad values inline. */
function NumberField({ spec, value, onChange, id }: { spec: ParamSpec; value: ParamValue; onChange: (v: ParamValue) => void; id: string }) {
  const isNull = value === null;
  const [draft, setDraft] = useState(isNull ? "" : String(value));
  useEffect(() => {
    setDraft(value === null ? "" : String(value));
  }, [value]);

  const parsed = draft.trim() === "" ? NaN : Number(draft);
  const error = isNull ? null : paramError(spec, parsed);
  const step = spec.type === "int" ? 1 : spec.max !== undefined && spec.max <= 1 ? 0.01 : 0.1;
  const slider = !spec.log && spec.min !== undefined && spec.max !== undefined && spec.max - spec.min <= 1000;
  const fallback = (spec.default ?? spec.min ?? 1) as number;

  return (
    <div>
      <div className="flex items-center gap-2">
        {slider && !isNull && (
          <input
            type="range"
            aria-hidden="true"
            tabIndex={-1}
            min={spec.min}
            max={spec.max}
            step={step}
            value={Number.isFinite(parsed) ? parsed : fallback}
            onChange={(event) => onChange(Number(event.target.value))}
            className="min-w-0 flex-1 accent-[var(--accent)]"
          />
        )}
        <input
          id={id}
          type="number"
          inputMode="decimal"
          disabled={isNull}
          min={spec.min}
          max={spec.max}
          step={step}
          value={isNull ? "" : draft}
          placeholder={isNull ? spec.none_label : undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          onChange={(event) => {
            setDraft(event.target.value);
            const next = event.target.value.trim() === "" ? NaN : Number(event.target.value);
            onChange(next as ParamValue);
          }}
          className={`tnum rounded-lg border bg-card px-2 py-1 font-mono text-[12px] outline-none focus:ring-4 disabled:opacity-60 ${
            slider && !isNull ? "w-24" : "w-full"
          } ${error ? "border-bad focus:ring-bad/20" : "border-line focus:border-accent focus:ring-accent/20"}`}
        />
      </div>
      {spec.nullable && (
        <label className="mt-1 flex items-center gap-1.5 text-[11px] text-ink-muted">
          <input
            type="checkbox"
            checked={isNull}
            onChange={(event) => onChange(event.target.checked ? null : fallback === null ? (spec.min ?? 1) : fallback)}
            className="accent-[var(--accent)]"
          />
          {spec.none_label ?? "none"}
        </label>
      )}
      {error ? (
        <p id={`${id}-error`} className="mt-0.5 flex items-center gap-1 text-[11px] text-bad">
          <Icon name="critical" className="size-3" /> {error}
        </p>
      ) : (
        spec.min !== undefined &&
        !isNull && <p className="tnum mt-0.5 text-[10px] text-ink-faint">{spec.min} – {spec.max}{spec.log ? " (log scale)" : ""}</p>
      )}
    </div>
  );
}
