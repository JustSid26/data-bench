# DataBench UI

Vite + React + Tailwind v4. Five screens over the DataBench API.

```bash
npm install
npm run dev        # :5173, proxies /api to the backend on :8000
npm run build      # emits dist/, which the backend serves at /
npm run typecheck
```

## Screens

| route | reads |
| --- | --- |
| `/` | `POST /api/datasets`, `/api/datasets/from-path`, `GET /api/datasets` |
| `/overview` | the upload response — meta strip, column table, preview |
| `/analyse` | `GET /api/datasets/{id}/profile` |
| `/model` | `GET /api/datasets/{id}/plan?target=` then `POST .../train` |
| `/results` | `GET /api/jobs/{id}`, polled until the job finishes |

## Layout

```
src/lib/         api client, response types, formatters
src/state/       session (open dataset, target, job) and theme
src/components/  Shell + sidebar, primitives, charts, icons
src/routes/      one file per screen
```

## Notes

- **Tokens live in `src/index.css`**, not a `tailwind.config.js` — Tailwind v4 is
  css-first. Colours are defined once on `:root` / `.dark` and mapped into
  Tailwind names in the `@theme` block, so switching theme is one class change.
  The values come from `mockups/DESIGN.md`.
- **No chart library.** Histograms, confusion matrices, importance bars and
  cluster bars are divs and tables. They are twenty bars each; a plotting
  runtime would cost more than it renders.
- **No icon webfont.** The Stitch export pulled Material Symbols for six glyphs;
  those are inlined SVG paths in `components/icons.tsx` instead.
- **Job polling keeps running in a background tab** (`refetchIntervalInBackground`).
  Without it, switching tabs mid-training leaves a spinner that never resolves.
- `mockups/` holds the original Stitch screens (`screen.png` + `code.html`) as
  visual reference. They are not built or imported.
