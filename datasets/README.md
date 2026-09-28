# Sample datasets

Messy-on-purpose CSVs for demoing DataBench's profile and clean steps. Each has
real relationships to learn, so trained models beat chance. Regenerate with
`python3 make_samples.py` (seeded, so the files come out identical).

| File | Target | Task | Planted problems |
|---|---|---|---|
| `retail_customers_messy.csv` (920 rows) | `churned` | classification | id column, 13% missing `age`, 6% missing `city`, skewed `monthly_spend` with outliers, `total_spend` stored as text with blanks, constant `country`, `referral_code` 81% missing, 20 duplicate rows |
| `hospital_bills_messy.csv` (700 rows) | `bill_amount` | regression | id column, 18% missing `bmi`, `999` "not recorded" codes in `systolic_bp`, missing `smoker`, empty `insurance_provider`, constant `ward` |
| `student_results_messy.csv` (420 rows) | `passed` | classification | id column, 14% missing `study_hours_week`, `1000` typos in `attendance_pct`, missing `previous_score` and `parental_education`, empty `remarks` |

Quick-check scores (5-fold, gradient boosting): retail 0.70 balanced accuracy,
hospital R² 0.74, students 0.72 balanced accuracy.
