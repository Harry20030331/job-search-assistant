"""Host-only acceptance/rejection of an exact preparation proposal."""
import argparse
from pathlib import Path

from interview.preparation import approve, reject
from interview.storage import Store, canonical, read_json, write_json


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--workspace", type=Path, required=True)
    parser.add_argument("--proposal", type=Path, required=True)
    parser.add_argument("--decision", choices=["accept", "reject"], required=True)
    parser.add_argument("--origin", choices=["human_current_chat", "synthetic_test_script"], required=True)
    parser.add_argument("--evidence", required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    record = read_json(args.proposal)
    store = Store(args.workspace)
    evidence = args.origin + ": " + args.evidence
    if args.decision == "accept":
        approval_id = approve(store, record["interview_id"], record["proposal_id"], record["proposal_hash"], evidence)
    else:
        reject(store, record["interview_id"], record["proposal_id"])
        approval_id = None
    result = {"decision": args.decision, "origin": args.origin, "proposal_id": record["proposal_id"], "proposal_hash": record["proposal_hash"], "approval_id": approval_id}
    write_json(args.output, result)
    print(canonical(result))


if __name__ == "__main__":
    main()
