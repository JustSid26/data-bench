import { useRef } from "react";
import { useWindow } from "../lib/useWindow";
import type { Preview } from "../lib/types";

const ROW = 30;
const isNumber = (value: unknown) => typeof value === "number";

/** Preview rows with a sticky header and sticky row numbers. Rows are
 *  windowed once there are more than a screenful of them. */
export function DataTable({ preview, maxHeight = "26rem" }: { preview: Preview; maxHeight?: string }) {
  const scroller = useRef<HTMLDivElement>(null);
  const slice = useWindow(scroller, preview.rows.length, ROW);
  // a whole column aligns by its first real value, so a lone null never flips it
  const numeric = preview.columns.map((_, x) => isNumber(preview.rows.find((row) => row[x] !== null)?.[x]));

  return (
    <div ref={scroller} className="overflow-auto rounded-lg border border-line" style={{ maxHeight }} tabIndex={0} aria-label="Data preview">
      <table className="w-full border-collapse text-[13px]">
        <thead className="sticky top-0 z-10 bg-card-raised">
          <tr>
            <th scope="col" className="sticky left-0 z-10 w-10 border-b border-line bg-card-raised px-3 py-2 text-right text-[11px] font-medium text-ink-faint">
              #
            </th>
            {preview.columns.map((name, x) => (
              <th
                key={name}
                scope="col"
                className={`border-b border-line px-3 py-2 text-[11px] font-medium whitespace-nowrap text-ink-muted ${numeric[x] ? "text-right" : "text-left"}`}
              >
                {name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {slice.padTop > 0 && <tr style={{ height: slice.padTop }} aria-hidden="true" />}
          {preview.rows.slice(slice.start, slice.end).map((row, offset) => {
            const y = slice.start + offset;
            return (
              <tr key={y} className="group hover:bg-hover" style={{ height: ROW }}>
                <td className="tnum sticky left-0 border-b border-line/60 bg-card px-3 py-1.5 text-right text-[11px] text-ink-faint group-hover:bg-card-raised">{y}</td>
                {row.map((value, x) => (
                  <td
                    key={x}
                    className={`max-w-[18rem] truncate border-b border-line/60 px-3 py-1.5 whitespace-nowrap ${numeric[x] ? "tnum text-right font-mono" : "text-left"} ${
                      value === null ? "text-ink-faint italic" : ""
                    }`}
                    title={value === null ? undefined : String(value)}
                  >
                    {value === null ? "null" : String(value)}
                  </td>
                ))}
              </tr>
            );
          })}
          {slice.padBottom > 0 && <tr style={{ height: slice.padBottom }} aria-hidden="true" />}
        </tbody>
      </table>
    </div>
  );
}
