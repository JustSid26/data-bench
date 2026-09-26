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
| `/clean` | the profile; a staged, client-only cleaning recipe |
| `/model` | `GET /api/datasets/{id}/plan?target=` then `POST .../train` |
| `/results` | `GET /api/jobs/{id}`, polled until the job finishes |

## Layout

```
src/lib/         api client, response types, formatters, insights (pure
                 derivations the charts bind to), tokens, motion/
src/state/       session, theme, ui chrome, staged cleaning recipe
src/components/  Layout + Shell, primitives, inspector, palette, viz/ charts
src/routes/      one file per screen, lazy-loaded except Upload
```

## Notes

- **Tokens live in `src/index.css`**, not a `tailwind.config.js` — Tailwind v4 is
  css-first. Colours are defined once on `:root` / `.dark` and mapped into
  Tailwind names in the `@theme` block, so switching theme is one class change.
  The values come from `mockups/DESIGN.md`.
- **No chart library.** Every chart is hand-written SVG + `motion` in
  `components/viz/`. They are small; a plotting runtime would cost more than
  it renders.
- **Motion goes through `lib/motion`.** `LazyMotion strict` means a stray
  `motion.div` throws — use `m.div` and the shared presets. Reduced motion is
  honoured globally. Don't put `whileInView` on an element that starts at
  `scale(0)`: it has no area and never "enters" view; observe a parent.
- See `../UI_AUDIT.md` for what is staged or estimated (cleaning, progress).
- **No icon webfont.** The Stitch export pulled Material Symbols for six glyphs;
  those are inlined SVG paths in `components/icons.tsx` instead.
- **Job polling keeps running in a background tab** (`refetchIntervalInBackground`).
  Without it, switching tabs mid-training leaves a spinner that never resolves.
- `mockups/` holds the original Stitch screens (`screen.png` + `code.html`) as
  visual reference. They are not built or imported.
