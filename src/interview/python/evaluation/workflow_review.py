"""Blinded human pilot, reviewed-label form and optional independent judge."""
import argparse
import csv
import html
import json
import os
from pathlib import Path

from evaluation import judge
from interview.storage import canonical, digest, read_json, write_json

DIMENSIONS = ["specificity", "grounding", "actionability", "constraints"]
# Prespecified one-output-per-episode audit; never select by observed score.
AUDIT = [("W07", "materials"), ("W08", "materials"), ("W10", "debrief_1"), ("W11", "debrief_2"), ("W12", "next_proposal")]


def page(title, introduction, cards, fields, key):
    rows = []
    for identity, text in cards:
        controls = []
        for field in fields:
            options = ["", "keep", "revise", "drop"] if field == "label_decision" else ["", "0", "1", "2"]
            controls.append('<label>' + field + ' <select data-id="' + identity + '" data-field="' + field + '">' + ''.join('<option value="' + x + '">' + (x or 'Pending') + '</option>' for x in options) + '</select></label>')
        rows.append('<section><h2>' + html.escape(identity) + '</h2><pre>' + html.escape(text) + '</pre>' + ''.join(controls) + '<label>Evidence / reason<textarea data-notes="' + identity + '"></textarea></label></section>')
    script = r'''<script>
const key=KEY;
const selects=[...document.querySelectorAll('select')];
const notes=[...document.querySelectorAll('textarea')];
let saved={};try{saved=JSON.parse(localStorage.getItem(key)||'{}')}catch(e){}
function update(){document.getElementById('progress').textContent=selects.filter(e=>e.value!=='').length+' / '+selects.length+' fields rated'}
function save(){let state={};selects.forEach(e=>state[e.dataset.id+':'+e.dataset.field]=e.value);notes.forEach(e=>state['note:'+e.dataset.notes]=e.value);try{localStorage.setItem(key,JSON.stringify(state))}catch(e){}update()}
selects.forEach(e=>{e.value=saved[e.dataset.id+':'+e.dataset.field]||'';e.addEventListener('change',save)});
notes.forEach(e=>{e.value=saved['note:'+e.dataset.notes]||'';e.addEventListener('input',save)});
function download(){let rows=[['sample_id','dimension','score','evidence','reason']];selects.forEach(e=>{const note=notes.find(n=>n.dataset.notes===e.dataset.id).value;rows.push([e.dataset.id,e.dataset.field,e.value,note,''])});const q=s=>'"'+String(s).replaceAll('"','""')+'"';const blob=new Blob(['\ufeff'+rows.map(r=>r.map(q).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=key+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}update();
</script>'''.replace("KEY", json.dumps(key))
    return '<!doctype html><html lang="en"><meta charset="utf-8"><title>' + title + '</title><style>body{font:16px/1.6 system-ui;max-width:1000px;margin:30px auto;padding:0 20px}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#f5f5f5;padding:16px;max-height:650px;overflow:auto}section{border:1px solid #ccc;padding:20px;margin:20px 0}label{display:block;margin:12px 0}select,button,textarea{font:inherit;padding:8px}textarea{display:block;width:95%;min-height:70px}.bar{position:sticky;top:0;background:white;padding:15px;border:1px solid #ccc}</style><h1>' + title + '</h1><p>' + html.escape(introduction) + '</p><div class="bar"><span id="progress"></span> <button onclick="download()">Export CSV</button></div>' + ''.join(rows) + script + '</html>'


def export(root):
    output = root / "review"
    output.mkdir(exist_ok=False)
    manifest = read_json(root / "batch_manifest.json")
    case_cards = []
    for cid in manifest["selected"]:
        case = root / "dataset_snapshot" / cid
        spec, gold = read_json(case / "case.json"), read_json(case / "gold.json")
        public = {"scenario": spec, "proposed_labels": gold}
        if (case / "input.json").exists():
            public["mail"] = read_json(case / "input.json")
        elif (case / "inputs").exists():
            public["evidence"] = {p.relative_to(case).as_posix(): p.read_text(encoding="utf-8") for p in (case / "inputs").rglob("*") if p.is_file()}
        case_cards.append((cid, json.dumps(public, indent=2, ensure_ascii=False)))
    (output / "case-review.html").write_text(page("Workflow case and label review", "Review each fictional scenario, source and expected behavior. Keep = correct and usable; revise = specify corrections in the note; drop = unsuitable. These labels were authored with AI assistance and are not frozen. Review labels before treating any output score as research evidence.", case_cards, ["label_decision"], "case-review-" + manifest["dataset_hash"][:12]), encoding="utf-8")
    rubric = (root / "implementation_snapshot/evaluation/rubrics/workflow-v1.md").read_text(encoding="utf-8")
    selected, cards, missing = [], [], []
    for cid, phase in AUDIT:
        if cid not in manifest["selected"]:
            continue
        packet = root / cid / "quality" / (phase + ".packet.json")
        if not packet.exists():
            packet = root / cid / "next-session/quality" / (phase + ".packet.json")
        if not packet.exists():
            missing.append({"case_id": cid, "phase": phase, "reason": "Prespecified artifact unavailable; no score-based substitute"})
            continue
        sid = "R-" + digest({"dataset": manifest["dataset_hash"], "case": cid, "phase": phase})[:10]
        selected.append({"sample_id": sid, "case_id": cid, "phase": phase, "packet": str(packet.relative_to(root))})
        cards.append((sid, "RUBRIC\n" + rubric + "\n\nSOURCES AND OUTPUT\n" + json.dumps(read_json(packet), indent=2, ensure_ascii=False)))
    # Stable hash randomizes presentation without consulting quality scores.
    cards.sort(key=lambda item: item[0])
    pack_fingerprint = digest({"rubric": rubric, "samples_and_outputs": cards})
    write_json(output / "private-index.json", {"samples": selected, "missing": missing, "pack_fingerprint": pack_fingerprint, "selection": "Prespecified AUDIT list, one artifact per episode; no outcome-based replacement"})
    write_json(output / "pack-manifest.json", {"dataset_hash": manifest["dataset_hash"], "pack_fingerprint": pack_fingerprint, "rubric_hash": digest(rubric), "exporter_hash": digest(Path(__file__).read_text(encoding="utf-8")), "human_ratings": "pending"})
    (output / "rubric.md").write_text(rubric, encoding="utf-8")
    (output / "exporter_snapshot.py").write_text(Path(__file__).read_text(encoding="utf-8"), encoding="utf-8")
    (output / "human-review.html").write_text(page("Workflow human-rating pilot", "Rate independently before reading judge results. 0 = incorrect/absent; 1 = partially met; 2 = supported and useful. Add evidence for each sample. This is a small single-rater calibration pilot with shared fixture sources, not an inter-rater reliability study. Missing planned artifacts are recorded separately and never silently replaced. Blank ratings stay pending.", cards, DIMENSIONS, "human-review-" + pack_fingerprint[:12]), encoding="utf-8")
    with (output / "ratings-template.csv").open("w", encoding="utf-8", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=["sample_id", "dimension", "score", "evidence", "reason"])
        writer.writeheader()
        writer.writerows({"sample_id": sample["sample_id"], "dimension": d} for sample in selected for d in DIMENSIONS)
    (output / "START-HERE.md").write_text("# Human review tasks\n\n1. Open case-review.html and review each scenario/label. Export its CSV. For revisions, give the corrected behavior and why.\n2. After the cases are acceptable, open human-review.html and score the available prespecified outputs using the displayed rubric; do not inspect judge results first. Export its CSV.\n3. Give the two exported local file paths to the agent for validation and agreement analysis. Leave genuine unknowns explicit; do not fill ratings by guessing.\n\nThis is a single-rater developer pilot. Changes to labels or protocol require a new frozen version and separate runs; these development outputs never become held-out data retroactively. A future research audit should predefine a larger independent-story sample and use two independent raters where feasible.\n", encoding="utf-8")
    return {"cases": len(case_cards), "rating_samples": len(cards), "rating_dimensions": len(cards)*4, "missing_prespecified": missing}


def load_judge_env(path):
    if path is None:
        return
    # Host-only dotenv subset; never print, copy or interpolate the value.
    for line in path.read_text(encoding="utf-8-sig").splitlines():
        key, separator, value = line.partition("=")
        if separator and key.strip() == "OPENROUTER_API_KEY":
            os.environ["OPENROUTER_API_KEY"] = value.strip().strip("\"'")


def judge_audit(root, env=None):
    load_judge_env(env)
    index = read_json(root / "review/private-index.json")
    manifest = read_json(root / "batch_manifest.json")
    rubric = (root / "implementation_snapshot/evaluation/rubrics/workflow-v1.md").read_text(encoding="utf-8")
    results = []
    for sample in index["samples"]:
        destination = root / "judge-results" / (sample["sample_id"] + ".json")
        try:
            result = judge.evaluate(read_json(root / sample["packet"]), destination, rubric_text=rubric, settings=manifest["settings"])
            results.append({"sample_id": sample["sample_id"], "status": "scored_uncalibrated", "usage": result.get("usage")})
        except (judge.JudgeAccessError, ValueError) as exc:
            results.append({"sample_id": sample["sample_id"], "status": "judge_failed", "error": str(exc)})
        write_json(root / "judge-status.json", {"results": results, "human_calibrated": False})
        print(canonical({"judge_sample": sample["sample_id"], "status": results[-1]["status"]}), flush=True)
    return results


def compare(root, ratings):
    samples = read_json(root / "review/private-index.json")["samples"]
    expected = {(s["sample_id"], d) for s in samples for d in DIMENSIONS}
    with ratings.open(encoding="utf-8-sig", newline="") as stream:
        rows = list(csv.DictReader(stream))
    pairs, seen = [], set()
    for row in rows:
        key = row["sample_id"], row["dimension"]
        if key not in expected or key in seen or row["score"] not in {"0", "1", "2"} or not (row.get("evidence", "").strip() or row.get("reason", "").strip()):
            raise ValueError("Invalid, duplicate, blank or unsupported human rating; no values were auto-filled")
        seen.add(key)
        result = read_json(root / "judge-results" / (key[0] + ".json"))
        judge_score = next(d["score"] for d in result["judgment"]["dimensions"] if d["name"] == key[1])
        pairs.append((int(row["score"]), judge_score))
    if seen != expected or not pairs:
        raise ValueError("Complete ratings for every planned available sample are required")
    result = {"source_episodes": len(samples), "dimension_rows": len(pairs), "mean_absolute_error": sum(abs(a-b) for a,b in pairs)/len(pairs), "exact_agreement": sum(a==b for a,b in pairs)/len(pairs), "single_rater_development_pilot": True,
              "note": "Dimension rows are correlated; no population reliability or inter-rater agreement claim."}
    write_json(root / "human-judge-comparison.json", result)
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("phase", choices=["export", "judge", "compare"])
    parser.add_argument("--batch", type=Path, required=True)
    parser.add_argument("--judge-env", type=Path)
    parser.add_argument("--ratings", type=Path)
    args = parser.parse_args()
    if args.phase == "compare" and args.ratings is None:
        parser.error("compare requires --ratings")
    result = export(args.batch.resolve()) if args.phase == "export" else judge_audit(args.batch.resolve(), args.judge_env) if args.phase == "judge" else compare(args.batch.resolve(), args.ratings)
    print(canonical(result))


if __name__ == "__main__":
    main()
