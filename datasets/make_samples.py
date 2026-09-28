"""Messy-but-realistic sample CSVs for demoing DataBench's clean step.
Seeded, so the files are reproducible. Every problem is deliberate."""
import numpy as np, pandas as pd
rng = np.random.default_rng(7)

def blank(s, frac):
    s = s.astype(object).copy()
    s[rng.random(len(s)) < frac] = np.nan
    return s

# 1. retail customers -> predict churned (binary classification)
n = 900
age = rng.integers(18, 70, n)
tenure = rng.integers(1, 72, n)
spend = np.round(rng.lognormal(7.2, 0.8, n), 2)            # right-skewed rupees
spend[rng.random(n) < 0.03] *= 12                          # a few whales = outliers
support = rng.poisson(1.5, n)
tier = rng.choice(["Bronze", "Silver", "Gold", "Platinum"], n, p=[.45, .3, .18, .07])
city = rng.choice(["Mumbai", "Delhi", "Bengaluru", "Pune", "Chennai", "Hyderabad"], n)
logit = 1.0 - 0.06 * tenure + 0.7 * support - 0.9 * (tier == "Gold") - 1.6 * (tier == "Platinum") + 0.02 * (45 - age)
churned = np.where(rng.random(n) < 1 / (1 + np.exp(-logit)), "Yes", "No")
total = (spend * tenure).round(2).astype(str)
total[rng.random(n) < 0.02] = " "                          # blanks inside a numeric column
retail = pd.DataFrame({
    "customer_id": [f"CUST-{10000 + i}" for i in range(n)],  # id -> drop
    "age": blank(age, 0.12),                                 # 12% missing -> impute
    "city": blank(city, 0.06),                               # 6% missing -> impute mode
    "loyalty_tier": tier,
    "tenure_months": tenure,
    "monthly_spend": spend,                                  # skewed + outliers -> log / clip
    "total_spend": total,                                    # numbers stored as text
    "support_tickets": support,
    "country": "India",                                      # constant -> drop
    "referral_code": blank(pd.Series([f"REF{rng.integers(100, 999)}" for _ in range(n)]), 0.82),  # 82% missing -> drop
    "churned": churned,
})
retail = pd.concat([retail, retail.sample(20, random_state=1)])  # 20 duplicate rows
retail.to_csv("retail_customers_messy.csv", index=False)

# 2. hospital visits -> predict bill_amount (regression)
n = 700
age = rng.integers(1, 90, n)
bmi = np.round(rng.normal(25, 4.5, n), 1)
smoker = rng.choice(["Yes", "No"], n, p=[.22, .78])
dept = rng.choice(["Cardiology", "Orthopaedics", "General", "Neurology", "Paediatrics"], n)
stay = np.maximum(1, np.round(rng.gamma(2, 1.6, n) + (dept == "Cardiology") * 2 + (age > 65) * 1.5)).astype(int)
bill = np.round(4000 * stay + 180 * age + 9000 * (smoker == "Yes") + 800 * np.maximum(bmi - 25, 0) + rng.normal(0, 6000, n), -1)
bp = np.round(rng.normal(125, 15, n)).astype(object)
bp[rng.random(n) < 0.04] = 999                               # sentinel "not recorded" codes -> outliers
hospital = pd.DataFrame({
    "visit_id": range(50001, 50001 + n),                     # numeric id -> drop
    "admission_date": pd.date_range("2025-01-01", periods=n, freq="11h").strftime("%Y-%m-%d"),
    "age": age,
    "bmi": blank(bmi, 0.18),                                 # 18% missing
    "systolic_bp": bp,                                       # 999 codes
    "smoker": blank(smoker, 0.08),                           # 8% missing
    "department": dept,
    "length_of_stay_days": stay,
    "insurance_provider": np.nan,                            # completely empty -> drop
    "ward": "B",                                             # constant -> drop
    "bill_amount": bill,
})
hospital.to_csv("hospital_bills_messy.csv", index=False)

# 3. students -> predict passed (binary), small and gappy
n = 420
hours = np.round(rng.gamma(3, 2.2, n), 1)
attend = np.round(np.clip(rng.normal(82, 10, n), 30, 100), 1)
attend[rng.random(n) < 0.03] = 1000                          # typo: 1000 instead of 100.0
prev = np.round(np.clip(rng.normal(62, 14, n), 10, 100))
sleep = np.round(rng.normal(7, 1.1, n), 1)
parent = rng.choice(["High school", "Graduate", "Postgraduate", "No formal education"], n, p=[.4, .35, .15, .1])
score = 0.35 * prev + 2.2 * hours + 0.25 * np.minimum(attend, 100) + 1.5 * (sleep - 7) + rng.normal(0, 8, n)
students = pd.DataFrame({
    "roll_no": [f"S{2025000 + i}" for i in range(n)],        # id
    "study_hours_week": blank(hours, 0.15),                  # 15% missing, skewed -> median
    "attendance_pct": attend,                                # 1000 typos -> outliers
    "previous_score": blank(prev, 0.07),
    "sleep_hours": sleep,
    "parental_education": blank(parent, 0.1),
    "internet_at_home": rng.choice(["Yes", "No"], n, p=[.8, .2]),
    "remarks": np.nan,                                       # empty
    "passed": np.where(score > np.median(score), "Pass", "Fail"),
})
students.to_csv("student_results_messy.csv", index=False)
print("ok")
