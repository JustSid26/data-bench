import { Fragment } from "react";
import { Link, useLocation } from "react-router-dom";
import { skipToken, useQuery } from "@tanstack/react-query";
import { m } from "motion/react";
import { Icon } from "./icons";
import { spring } from "../lib/motion";
import type { Job, Profile } from "../lib/types";
import { useSession } from "../state/session";

const STEPS = [
  { label: "Ingest", to: "/upload", routes: ["/upload"] },
  { label: "Profile", to: "/analyse", routes: ["/overview", "/analyse"] },
  { label: "Clean", to: "/clean", routes: ["/clean"] },
  { label: "Model", to: "/model", routes: ["/model"] },
  { label: "Train", to: "/results", routes: ["/results"] },
];

/** Ingest → Profile → Clean → Model → Train, as a breadcrumb that shows where
 *  you are and what is already done. Reads only what react-query has cached --
 *  it never fetches on its own. */
export function Pipeline() {
  const { pathname } = useLocation();
  const { dataset, jobId } = useSession();
  const profile = useQuery<Profile>({ queryKey: ["profile", dataset?.id], queryFn: skipToken });
  const job = useQuery<Job>({ queryKey: ["job", jobId], queryFn: skipToken });

  const done = [
    Boolean(dataset),
    Boolean(profile.data),
    Boolean(profile.data), // cleaning is optional, so it counts once the data is understood
    Boolean(jobId),
    job.data?.state === "done",
  ];
  const current = STEPS.findIndex((step) => step.routes.includes(pathname));

  return (
    <nav aria-label="Pipeline" className="min-w-0">
      <ol className="flex items-center gap-0.5 overflow-x-auto text-[12px] [scrollbar-width:none]">
        {STEPS.map((step, index) => {
          const active = index === current;
          const locked = index > 0 && !dataset;
          const state = active ? "current" : done[index] ? "done" : "todo";
          const body = (
            <>
              {active && (
                <m.span
                  layoutId="pipeline-active"
                  transition={spring.soft}
                  className="absolute inset-0 rounded-full bg-accent-soft ring-1 ring-accent/40"
                />
              )}
              <span
                className={`relative grid size-[18px] shrink-0 place-items-center rounded-full border text-[10px] leading-none font-bold tabular-nums [text-box:trim-both_cap_alphabetic] ${
                  state === "done"
                    ? "border-good bg-good text-surface"
                    : state === "current"
                      ? "border-accent-fg text-accent-fg"
                      : "border-line-strong text-ink-faint"
                }`}
              >
                {state === "done" ? <Icon name="tick" className="size-2.5" /> : index + 1}
              </span>
              <span className={`relative ${active ? "" : "hidden lg:inline"}`}>{step.label}</span>
            </>
          );
          const className = `relative flex shrink-0 items-center gap-1.5 rounded-full px-2 py-1 whitespace-nowrap transition-colors ${
            active ? "font-semibold text-ink" : locked ? "text-ink-faint/60" : "text-ink-muted hover:text-ink"
          }`;
          return (
            <Fragment key={step.label}>
              {index > 0 && <Icon name="next" className="size-3 shrink-0 text-ink-faint" />}
              <li>
                {locked ? (
                  <span className={className} aria-disabled="true" title={`${step.label} — load a dataset first`}>
                    {body}
                  </span>
                ) : (
                  <Link
                    to={step.to}
                    className={className}
                    aria-current={active ? "step" : undefined}
                    aria-label={`${step.label}${state === "done" ? " (done)" : ""}`}
                  >
                    {body}
                  </Link>
                )}
              </li>
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}
