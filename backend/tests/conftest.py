import os
import sys

import numpy as np
import pandas as pd
import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


@pytest.fixture
def frame():
    rng = np.random.default_rng(0)
    n = 600
    city = rng.choice(["pune", "delhi", "goa", "kochi"], n)
    spend = rng.random(n) * 1000
    clicks = rng.poisson(5, n)
    lift = {"pune": 0.9, "delhi": 0.2, "goa": 1.5, "kochi": -0.4}
    logit = -3 + spend / 300 + clicks * 0.2 + np.array([lift[c] for c in city])
    return pd.DataFrame({
        "id": range(n),
        "city": city,
        "spend": spend,
        "clicks": clicks,
        "day": pd.date_range("2024-01-01", periods=n, freq="h"),
        "note": ["a reasonably long free text comment number %d" % i for i in range(n)],
        "always": ["same"] * n,
        "blank": [None] * n,
        "converted": (rng.random(n) < 1 / (1 + np.exp(-logit))).astype(int),
        "revenue": spend * 2.5 + clicks * 30 + rng.normal(0, 40, n),
    })


@pytest.fixture
def csv_path(frame, tmp_path):
    path = tmp_path / "sample.csv"
    frame.to_csv(path, index=False)
    return str(path)
