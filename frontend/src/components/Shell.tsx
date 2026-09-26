import type { ReactNode } from "react";
import { m } from "motion/react";
import { Icon } from "./icons";
import { Button } from "./primitives";
import { fadeUp, stagger } from "../lib/motion";

/** One screen's header and body. The sidebar and top bar live in Layout, which
 *  stays mounted across routes; this is only what changes per page. */
export function Shell({
  title,
  subtitle,
  actions,
  children,
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <m.div variants={stagger(0.05)} initial="hidden" animate="show" className="flex min-h-full flex-col">
      {(title || actions) && (
        <m.header
          variants={fadeUp}
          className="flex flex-col gap-3 px-4 pt-6 pb-4 sm:flex-row sm:items-start sm:justify-between md:px-6"
        >
          <div className="min-w-0">
            {title && <h1 className="text-[20px] leading-tight font-semibold tracking-[-0.02em]">{title}</h1>}
            {subtitle && <p className="mt-1 truncate text-[13px] text-ink-muted">{subtitle}</p>}
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
        </m.header>
      )}
      <div className="min-h-0 flex-1 px-4 pb-10 md:px-6">{children}</div>
    </m.div>
  );
}

export function ExportButton({ data, name, label = "Export" }: { data: unknown; name: string; label?: string }) {
  return (
    <Button onClick={() => download(JSON.stringify(data, null, 2), name, "application/json")}>
      <Icon name="download" className="size-4" />
      {label}
    </Button>
  );
}

/** Save a string as a file, entirely client side. */
export function download(content: string, name: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}
