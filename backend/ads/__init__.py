'''DataBench: load a dataset, understand it, and run the models that fit it.'''

from . import ingest, profile, recommend, schema, train

# note: exported under names that differ from the submodules -- binding
# `profile`/`train` here would shadow `ads.profile` and `ads.train` themselves.
from .ingest import preview, read_any
from .profile import profile as profile_data
from .recommend import plan
from .schema import infer_schema
from .train import run as run_models

__all__ = [
    "ingest", "profile", "recommend", "schema", "train",
    "read_any", "preview", "infer_schema", "profile_data", "plan", "run_models",
]
