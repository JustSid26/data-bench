import { useNavigate } from "react-router-dom";
import { Shell, ExportButton } from "../components/Shell";
import { Button, Card, Empty, TypeBadge } from "../components/primitives";
import { DataTable } from "../components/charts";
import { Icon } from "../components/icons";
import { compact, count, percent } from "../lib/format";
import { useSession } from "../state/session";

function StatStrip({
  items,
}: {
  items: { label: string; value: string; tone?: "good" | "plain" }[];
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
      {items.map((item, index) => (
        <div key={item.label} className="flex items-center gap-6">
          {index > 0 && <span className="h-4 w-px bg-line" />}
          <p className="flex items-baseline gap-2">
            <span className="text-[12px] text-ink-muted">{item.label}</span>
            <span className={`tnum font-mono text-[14px] ${item.tone === "good" ? "text-good" : ""}`}>
              {item.value}
            </span>
          </p>
        </div>
      ))}
    </div>
  );
}

export function Overview() {
  const { dataset } = useSession();
  const navigate = useNavigate();

  if (!dataset) return <NoDataset />;
  const { meta, schema, preview } = dataset;

  return (
    <Shell
      title="Dataset overview"
      subtitle={meta.name}
      actions={
        <>
          <ExportButton data={{ meta, schema }} name={`${meta.name}.schema.json`} />
          <Button variant="primary" onClick={() => navigate("/analyse")}>
            <Icon name="play" className="size-3.5" />
            Analyse
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <StatStrip
          items={[
            { label: "Rows", value: count(meta.rows) },
            { label: "Columns", value: String(meta.columns) },
            { label: "Memory", value: `${meta.memory_mb} MB` },
            { label: "Read in", value: `${meta.read_ms} ms`, tone: "good" },
          ]}
        />

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <Card title={`Columns (${schema.length})`} bodyClass="p-0">
            <div className="max-h-[30rem] overflow-auto">
              <table className="w-full border-collapse text-[13px]">
                <thead className="sticky top-0 bg-card-raised">
                  <tr className="text-[11px] font-medium text-ink-muted">
                    <th className="w-8 border-b border-line px-3 py-2 text-right">#</th>
                    <th className="border-b border-line px-3 py-2 text-left">Name</th>
                    <th className="border-b border-line px-3 py-2 text-left">Type</th>
                    <th className="w-28 border-b border-line px-3 py-2 text-left">Stored as</th>
                    <th className="border-b border-line px-3 py-2 text-left">Why</th>
                  </tr>
                </thead>
                <tbody>
                  {schema.map((column, index) => (
                    <tr
                      key={column.name}
                      className={`hover:bg-hover ${column.modelable ? "" : "opacity-55"}`}
                    >
                      <td className="tnum border-b border-line/60 px-3 py-2 text-right text-[11px] text-ink-faint">
                        {index + 1}
                      </td>
                      <td className="border-b border-line/60 px-3 py-2 font-mono whitespace-nowrap">
                        {column.name}
                      </td>
                      <td className="border-b border-line/60 px-3 py-2">
                        <TypeBadge kind={column.kind} />
                      </td>
                      <td className="border-b border-line/60 px-3 py-2">
                        <span className="font-mono text-[11px] text-ink-faint">{column.dtype}</span>
                      </td>
                      <td className="border-b border-line/60 px-3 py-2 text-[12px] text-ink-muted italic">
                        {column.reason}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card
            title={`Preview (first ${preview.rows.length})`}
            action={
              <span className="tnum text-[11px] text-ink-faint">
                of {compact(meta.rows)} rows
              </span>
            }
            bodyClass="p-3"
          >
            <DataTable preview={preview} maxHeight="27rem" />
          </Card>
        </div>

        <p className="text-[12px] text-ink-faint">
          {percent((schema.filter((c) => c.modelable).length / schema.length) * 100, 0)} of columns can be
          used as model features — the dimmed rows cannot.
        </p>
      </div>
    </Shell>
  );
}

export function NoDataset() {
  const navigate = useNavigate();
  return (
    <Shell>
      <Empty
        title="No dataset loaded"
        hint={
          <>
            Load a file first —{" "}
            <button className="text-accent underline" onClick={() => navigate("/")}>
              go to upload
            </button>
            .
          </>
        }
      />
    </Shell>
  );
}
