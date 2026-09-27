/** Client-side mirror of backend/ads/params.py `check`, so a bad value is
 *  flagged next to its field instead of coming back as a 400 after Train. */
import type { ParamSpec, ParamValue, ParamValues } from "./types";

export function paramError(spec: ParamSpec, value: ParamValue): string | null {
  if (value === null) return spec.nullable ? null : "required";
  if (spec.type === "bool") return typeof value === "boolean" ? null : "must be on or off";
  if (spec.type === "choice") return spec.choices?.includes(String(value)) ? null : "pick one of the options";
  if (typeof value !== "number" || Number.isNaN(value)) return "must be a number";
  if (spec.type === "int" && !Number.isInteger(value)) return "whole numbers only";
  if (spec.min !== undefined && value < spec.min) return `at least ${spec.min}`;
  if (spec.max !== undefined && value > spec.max) return `at most ${spec.max}`;
  return null;
}

/** The value a field shows: the user's override, else the default. */
export const valueOf = (spec: ParamSpec, overrides: ParamValues | undefined): ParamValue =>
  overrides && spec.name in overrides ? overrides[spec.name] : spec.default;

/** True when any override for these specs is invalid. */
export const hasErrors = (specs: ParamSpec[] | undefined, overrides: ParamValues | undefined) =>
  (specs ?? []).some((spec) => overrides && spec.name in overrides && paramError(spec, overrides[spec.name]) !== null);

/** Human rendering of a value, for the "settings used" chips. */
export function formatParam(spec: ParamSpec | undefined, value: ParamValue): string {
  if (value === null) return spec?.none_label ?? "none";
  if (typeof value === "boolean") return value ? "on" : "off";
  return String(value);
}
