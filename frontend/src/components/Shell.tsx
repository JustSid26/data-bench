import { NavLink, useNavigate } from "react-router-dom";
import type { ReactNode } from "react";
import { Icon } from "./icons";
import { Button } from "./primitives";
import { count } from "../lib/format";
import { useSession } from "../state/session";
import { useTheme } from "../state/theme";

const NAV = [
  { to: "/overview", label: "Overview", icon: "grid" },
  { to: "/analyse", label: "Analyse", icon: "chart" },
  { to: "/model", label: "Model", icon: "model" },
  { to: "/results", label: "Results", icon: "check" },
];

function Sidebar() {
  const { dataset, close } = useSession();
  const { dark, toggle } = useTheme();
  const navigate = useNavigate();
  const locked = !dataset;

  return (
    <aside className="flex w-sidebar shrink-0 flex-col border-r border-line bg-surface">
      <div className="px-5 pt-5 pb-4">
        <div className="flex items-center gap-2.5">
          <span className="grid size-8 place-items-center rounded-lg bg-accent text-accent-ink">
            <Icon name="grid" className="size-4" />
          </span>
          <div>
            <p className="text-[15px] leading-tight font-bold tracking-[-0.01em]">DataBench</p>
            <p className="text-[11px] text-ink-muted">Main Workspace</p>
          </div>
        </div>
      </div>

      {dataset && (
        <div className="mx-3 mb-4 rounded-lg border border-line bg-card px-3 py-2.5">
          <div className="flex items-start gap-2">
            <Icon name="file" className="mt-[2px] size-3.5 shrink-0 text-ink-faint" />
            <p className="truncate font-mono text-[12px]" title={dataset.meta.name}>
              {dataset.meta.name}
            </p>
          </div>
          <p className="tnum mt-1 text-[11px] text-ink-faint">
            {count(dataset.meta.rows)} rows · {dataset.meta.columns} cols
          </p>
        </div>
      )}

      <nav className="flex-1 space-y-0.5 px-3">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            aria-disabled={locked}
            onClick={(event) => locked && event.preventDefault()}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg border-l-2 px-3 py-2 text-[14px] transition ${
                locked
                  ? "pointer-events-none border-transparent text-ink-faint/50"
                  : isActive
                    ? "border-accent bg-accent-soft font-semibold text-ink"
                    : "border-transparent text-ink-muted hover:bg-hover hover:text-ink"
              }`
            }
          >
            <Icon name={item.icon} />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="space-y-1 border-t border-line px-3 py-3">
        <button
          onClick={toggle}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[13px] text-ink-muted transition hover:bg-hover hover:text-ink"
        >
          <Icon name={dark ? "sun" : "moon"} />
          {dark ? "Light theme" : "Dark theme"}
        </button>
        {dataset && (
          <button
            onClick={() => {
              close();
              navigate("/");
            }}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[13px] text-ink-muted transition hover:bg-hover hover:text-ink"
          >
            <Icon name="trash" />
            Close dataset
          </button>
        )}
      </div>
    </aside>
  );
}

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
    <div className="flex h-full">
      <Sidebar />
      <main className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        {(title || actions) && (
          <header className="flex items-start justify-between gap-4 px-6 pt-6 pb-4">
            <div>
              {title && <h1 className="text-[20px] leading-tight font-semibold tracking-[-0.02em]">{title}</h1>}
              {subtitle && <p className="mt-1 text-[13px] text-ink-muted">{subtitle}</p>}
            </div>
            <div className="flex shrink-0 items-center gap-2">{actions}</div>
          </header>
        )}
        <div className="min-h-0 flex-1 px-6 pb-8">{children}</div>
      </main>
    </div>
  );
}

export function ExportButton({ data, name }: { data: unknown; name: string }) {
  return (
    <Button
      onClick={() => {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = name;
        link.click();
        URL.revokeObjectURL(url);
      }}
    >
      <Icon name="download" className="size-4" />
      Export
    </Button>
  );
}
