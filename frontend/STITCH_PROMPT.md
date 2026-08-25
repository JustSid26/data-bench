# Stitch prompts for the DataBench UI

Paste the **Design system** block first, then one screen block per generation.
Stitch does better with one screen at a time than with the whole app at once.

---

## Design system (paste this first, and re-paste at the top of each screen prompt)

> A desktop web app called DataBench — a workbench where an analyst drops in a
> spreadsheet and it explains the data and runs the right machine learning models
> on it. Calm, dense, professional data-tool look, closer to Linear or Vercel than
> to a consumer dashboard. Light and dark theme. Near-white `#FAFAFA` background
> and white cards in light mode, `#0B0C0E` background and `#141619` cards in dark.
> One indigo accent `#4F46E5` used only for the primary action and the selected
> state. Inter, 14px body, 13px for table text, tabular numerals for anything
> numeric. 8px corner radius, 1px hairline borders, no drop shadows, generous
> whitespace between sections. Column-type badges are small pill labels in muted
> colours, one colour per type: numeric blue, categorical purple, boolean green,
> datetime amber, text grey, identifier slate, constant/empty faded red.
> A persistent left sidebar, 220px wide, holds the DataBench wordmark, the name of
> the loaded file with its row and column count underneath, and four nav items:
> Overview, Analyse, Model, Results. Every screen is the content area to the right
> of that sidebar.

---

## Screen 1 — Upload

> The empty state of DataBench. Centred on the page, a large dashed-border drop
> zone about 560px wide with an upload glyph, the headline "Drop a dataset to
> begin", the subline "csv, excel, parquet or json — up to 512 MB", and a
> secondary "browse files" text button. Under the drop zone, a small monospace
> line reading "or load from a path on this machine" with a slim inline text input
> and a Load button. Below that, a "Recent datasets" list of four rows, each row
> showing a file-type icon, the file name, a muted "1,000,000 rows × 8 columns ·
> 50.4 MB" line, a relative timestamp on the right, and a hover-only remove icon.
> The left sidebar is present but its nav items are greyed out and unclickable.

---

## Screen 2 — Overview

> The Overview screen of DataBench, shown right after a file loads. Across the top
> a thin strip of four inline stats separated by hairline dividers: Rows
> 1,000,000 · Columns 8 · Memory 21.0 MB · Read in 136 ms — the last one in muted
> green to signal speed. Below it, a section titled "Columns" holding a table with
> the columns: name, a type badge, dtype in monospace, a thin horizontal
> completeness bar showing the filled percentage, unique count, and a muted
> italic reason string such as "each row has a different integer" or "integer with
> only 9 different values". Rows whose type badge is identifier, constant or empty
> are dimmed to show they will not be used for modelling. Under that, a section
> titled "Preview" with a dense scrollable data table, 10 visible rows, sticky
> header, monospace right-aligned numbers, and empty cells rendered as a faint
> "null". Top right of the content area has a primary indigo "Analyse" button.

---

## Screen 3 — Analyse

> The Analyse screen of DataBench. At the top, a "Worth fixing" panel: a bordered
> card listing four warnings, each row a small severity chip (high in red, medium
> in amber, low in grey), then the column name in medium weight, then the issue in
> plain language — "column is completely empty", "looks like an id, will be
> excluded from models", "7% of values are missing", "heavily skewed, a log
> transform may help". Below it, a responsive grid of column cards, three per row.
> A numeric column card shows the column name with its type badge, a small
> 20-bucket histogram sparkline filling the card width, and a two-column list of
> min, median, max, mean, std and outliers. A categorical column card shows the
> name, the badge, and a horizontal stacked bar of the top values with a legend of
> value and percentage. A datetime card shows a small monthly volume bar chart and
> the date range underneath. At the bottom, a section titled "Moves together"
> listing correlated numeric pairs, each as a row of "column a — column b" with a
> signed correlation value on the right and a small bar whose length and colour
> encode strength and sign.

---

## Screen 4 — Model

> The Model screen of DataBench, where the user chooses what to predict. At the
> top, a "Predict" row: a searchable dropdown of target columns where each option
> shows the column name plus its type badge, and beside it a large auto-detected
> task chip reading "Binary classification" with a muted explanation underneath,
> "target has two outcomes". Under it, two side-by-side cards. The left card,
> "Target", shows a horizontal class-balance bar split 81% / 19% with counts, and
> a small amber note "classes are uneven, scores are balanced to compensate". The
> right card, "Features", shows six included columns as small chips with type
> badges, and beneath a dimmed "Not used" line listing dropped columns with the
> reason "identifier columns are not used as features". Below both, a section
> titled "Algorithms" with four selectable cards in a row: Gradient boosting,
> Random forest, Logistic regression, Decision tree. Each card has a checkbox in
> the corner, the algorithm name, and one muted sentence of reasoning such as
> "handles mixed column types and missing values, usually the strongest here".
> The two recommended cards are pre-checked, carry a small indigo "Recommended"
> tag, and have an indigo border; the others are unchecked and faded. A wide
> primary indigo "Train models" button sits at the bottom with a muted line beside
> it reading "will train on 100,000 of 1,000,000 rows".

---

## Screen 5 — Results

> The Results screen of DataBench after training finishes. A slim completion strip
> at the top reads "Trained 2 models on 100,000 rows in 6.2s". Below it, a
> leaderboard table ranking the models by balanced accuracy: rank, algorithm name,
> a score bar with the numeric value, accuracy, ROC AUC, and fit time in ms. The
> winning row is highlighted with an indigo left border and a small "Best" tag.
> Under the leaderboard, two side-by-side panels for the winning model. The left
> panel, "What drove it", is a horizontal bar chart of feature importance with one
> bar per original column, sorted descending, labelled with the column name and
> its percentage. The right panel, "Where it was right and wrong", is a 2×2
> confusion matrix rendered as a heatmap of four cells, with true and predicted
> axis labels and the count plus row percentage inside each cell. Below both, a
> row of four metric tiles — Balanced accuracy, Accuracy, ROC AUC, Decision
> threshold — each showing a large tabular-numeral value with a small muted
> caption. Top right of the content area, two secondary buttons: "Export results"
> and "Try another target".

---

## Screen 6 — Clustering results (no target chosen)

> A variant of the DataBench Results screen for when no target column was picked
> and the tool clustered the rows instead. The completion strip reads "Grouped
> 100,000 rows into 4 clusters". A leaderboard lists K-means with a silhouette
> score and Isolation forest with an outlier percentage. The main panel is a
> horizontal stacked bar showing the relative size of each cluster in a muted
> categorical palette, with a legend listing cluster number and row count. Beside
> it, a card titled "Unusual rows" showing a large count, the caption "5% of rows
> do not fit any pattern", and a small dense table of five example rows.
