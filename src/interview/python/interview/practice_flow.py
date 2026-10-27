"""Generate scenario-based practice only after exact current plan acceptance."""
import argparse
from pathlib import Path

from interview.context_preparation_flow import run_node
from interview.storage import canonical


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--workspace", required=True, type=Path)
    parser.add_argument("--approval-id", required=True)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    print(canonical(run_node(args.workspace, args.output, approval_id=args.approval_id, material_format="simulation-v2", direct_questions=True)))


if __name__ == "__main__": main()
