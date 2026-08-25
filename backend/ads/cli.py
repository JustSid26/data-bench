'''
same pipeline from the terminal, for when you do not want the ui

    python -m ads.cli data.csv                  # schema + analysis
    python -m ads.cli data.csv --target churn   # plus the models that fit it
'''
import argparse
import json
import sys

from .ingest import read_any
from .profile import profile
from .recommend import plan
from .schema import infer_schema
from .train import run


def main(argv=None):
    parser = argparse.ArgumentParser(prog="databench", description=__doc__)
    parser.add_argument("path", help="csv, excel, parquet or json file")
    parser.add_argument("--target", help="column to predict, omit to cluster instead")
    parser.add_argument("--algorithms", nargs="*", help="override the recommended models")
    parser.add_argument("--train", action="store_true", help="actually fit the models")
    parser.add_argument("--json", action="store_true", help="print raw json instead")
    args = parser.parse_args(argv)

    df, meta = read_any(args.path)
    schema = infer_schema(df)
    report = profile(df, schema)
    steps = {"meta": meta, "schema": schema, "profile": report}

    if args.target or args.train:
        steps["plan"] = plan(df, schema, args.target)
        if args.train:
            steps["training"] = run(df, steps["plan"], args.algorithms)

    if args.json:
        print(json.dumps(steps, indent=2, default=str))
        return 0

    show(steps)
    return 0


def show(steps):
    meta, report = steps["meta"], steps["profile"]
    print("\n%s  %s rows x %s columns  (%s MB, read in %sms)" % (
        meta["name"], f"{meta['rows']:,}", meta["columns"], meta["memory_mb"], meta["read_ms"]))

    print("\ncolumns")
    for col in report["column_stats"]:
        print("  %-24s %-12s %5.1f%% missing  %s" % (
            col["name"][:24], col["kind"], col["missing_pct"], col["reason"]))

    if report["correlations"]:
        print("\nmoves together")
        for pair in report["correlations"][:5]:
            print("  %-20s %-20s r=%+.2f" % (pair["a"], pair["b"], pair["r"]))

    if report["warnings"]:
        print("\nworth fixing")
        for note in report["warnings"]:
            where = note["column"] or "dataset"
            print("  [%s] %-20s %s" % (note["level"], where, note["issue"]))

    if "plan" in steps:
        chosen = steps["plan"]
        print("\nplan: %s  (%s)" % (chosen["task"], chosen["task_reason"]))
        for algo in chosen["algorithms"]:
            print("  %s %-20s %s" % ("*" if algo["recommended"] else " ", algo["name"], algo["why"]))
        for note in chosen["notes"]:
            print("  ! %s" % note)

    if "training" in steps:
        results = steps["training"]
        print("\nresults on %s rows  (%sms)" % (f"{results['rows_used']:,}", results["train_ms"]))
        for item in results["results"]:
            if not item.get("ok"):
                print("  %-20s failed: %s" % (item["algorithm"], item["error"]))
                continue
            print("  %-20s %s = %s" % (item["algorithm"], results["score_name"], item["score"]))
            for weight in item["importance"][:5]:
                print("      %-20s %.1f%%" % (weight["column"], weight["weight"] * 100))
        print("\nbest: %s" % results["best"])


if __name__ == "__main__":
    sys.exit(main())
