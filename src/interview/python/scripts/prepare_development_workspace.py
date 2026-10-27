"""Create a host-owned isolated development workspace and immutable source snapshots."""
import argparse
import shutil
from pathlib import Path

from evaluation.runner import ROOT, implementation_hashes, prepare_workspace, source_hashes
from interview.storage import write_json


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--example", type=Path, required=True)
    parser.add_argument("--run", type=Path, required=True)
    parser.add_argument("--group", choices=["C", "D"], default="C")
    args = parser.parse_args()
    run = args.run.resolve()
    run.mkdir(parents=True, exist_ok=False)
    work, spec, initial = prepare_workspace(args.example.resolve(), args.group, run)
    write_json(run / "case_snapshot.json", spec)
    write_json(run / "initial_state_snapshot.json", initial)
    write_json(run / "source_hashes.json", source_hashes(work))
    hashes = implementation_hashes()
    write_json(run / "implementation_hashes.json", hashes)
    for path in hashes:
        target = run / "implementation_snapshot" / path
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(ROOT / path, target)
    write_json(run / "manifest.json", {"kind": "preparation-v4-development-not-benchmark", "group": args.group,
               "synthetic_candidate": True, "status": "context_ready", "live_google_writes": 0})
    print("Isolated development workspace created. No Google backend is configured.")


if __name__ == "__main__":
    main()
