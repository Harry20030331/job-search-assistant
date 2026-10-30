"""Blinded calibration pilot: 4 real outputs, 4 format controls, 4 injected defects.

These twelve samples represent four source stories, not twelve independent tasks.
Never auto-fill a human rating or mix controlled variants into agent benchmark runs.
"""
from __future__ import annotations

import argparse
import copy
import csv
import hashlib
import html
import io
import json
import random
from pathlib import Path

from evaluation import judge
from interview.schemas import AgentResult
from interview.storage import canonical, read_json, write_json

BASE = ["specificity", "grounding", "actionability", "constraints"]
MEMORY = ["memory_relevance", "memory_updates", "memory_impact"]


def dimensions(packet):
    return BASE + (MEMORY if packet["suite"] == "memory" else [])


def mutate(packet: dict, case_id: str) -> tuple[dict, dict]:
    packet = copy.deepcopy(packet)
    answer = packet["candidate_output"]
    prep = answer["preparation"]
    if case_id == "P01":
        prep["summary"] += " Your QueueLab project served 10 million real production users, so emphasize that proven production scale."
        defect = {"kind": "fabricated_candidate_fact", "zero_dimensions": ["grounding"], "serious_error_expected": True}
    elif case_id == "P02":
        prep["exercises"][0]["minutes"] += packet["current_visit_input"]["profile"]["preparation_budget_minutes"]
        defect = {"kind": "budget_overrun", "zero_dimensions": ["constraints"], "serious_error_expected": False}
    elif case_id == "M01":
        prep["memory_impact"] = "The user's main CURRENT weakness is unclear personal contribution. Treat the old project-story problem as unresolved and prioritize fixing it despite the later update."
        prep["exercises"][0]["topic"] = "Fix your unresolved project-story attribution weakness"
        prep["exercises"][0]["method"] = "Prioritize the old unclear-contribution weakness as still current, instead of the updated capacity-estimation need."
        answer["memory_refs"] = ["old-project"]
        defect = {"kind": "superseded_memory_as_current", "zero_dimensions": ["memory_updates"], "serious_error_expected": True}
    elif case_id == "M02":
        prep["summary"] = "Prepare well for the interview."
        prep["exercises"] = [{"topic": "Review topics", "method": "Study relevant things and practice more.", "minutes": packet["current_visit_input"]["profile"]["preparation_budget_minutes"], "basis_refs": ["jd"]}]
        defect = {"kind": "generic_nonactionable_plan", "zero_dimensions": ["specificity", "actionability"], "serious_error_expected": False}
    else:
        raise ValueError("Pilot requires P01, P02, M01 and M02")
    AgentResult.model_validate(answer)
    return packet, defect


def create_pack(run_paths: list[Path], output: Path, seed=329) -> dict:
    if output.exists() and any(output.iterdir()):
        raise FileExistsError("Use a new output directory; human work is never overwritten")
    records = {read_json(p / "manifest.json")["case_id"]: p for p in run_paths}
    if len(run_paths) != 4 or set(records) != {"P01", "P02", "M01", "M02"}:
        raise ValueError("Provide exactly one run each for P01/P02/M01/M02")
    output.mkdir(parents=True, exist_ok=True)
    rubric = (judge.ROOT / "evaluation" / "rubrics" / "quality.md").read_text(encoding="utf-8")
    (output / "rubric.md").write_text(rubric, encoding="utf-8")
    write_json(output / "settings.json", judge.config())
    samples, private = [], []
    for case_id, run in sorted(records.items()):
        manifest = read_json(run / "manifest.json")
        if manifest["status"] != "completed":
            raise ValueError("Source run incomplete")
        packet = read_json(run / "judge_packet.json")
        for variant in ["original", "format_control", "injected_defect"]:
            sample = copy.deepcopy(packet)
            defect = None
            if variant == "format_control":
                sample["candidate_output"]["preparation"]["summary"] = "\n" + sample["candidate_output"]["preparation"]["summary"] + "\n"
            elif variant == "injected_defect":
                sample, defect = mutate(sample, case_id)
            sample["evaluation_scope"] = "Rate the displayed final candidate_output. Model-authored earlier plans in action traces do not override that output or establish user facts."
            sample_id = "sample-" + hashlib.sha256((f"pilot-v1:{seed}:{case_id}:{variant}:" + canonical(sample)).encode()).hexdigest()[:10]
            write_json(output / "packets" / (sample_id + ".json"), sample)
            samples.append({"sample_id": sample_id, "dimensions": dimensions(sample)})
            private.append({"sample_id": sample_id, "source_case": case_id, "source_run": str(run.resolve()), "variant": variant, "known_defect": defect})
    random.Random(seed).shuffle(samples)
    write_json(output / "samples.json", {"sample_count": 12, "independent_source_stories": 4, "human_status": "pending", "samples": samples})
    write_json(output / "private_manifest.json", private)
    with (output / "ratings-template.csv").open("w", newline="", encoding="utf-8") as stream:
        writer = csv.DictWriter(stream, fieldnames=["sample_id", "dimension", "score", "evidence", "reason"])
        writer.writeheader()
        for sample in samples:
            for name in sample["dimensions"]:
                writer.writerow({"sample_id": sample["sample_id"], "dimension": name})
    sections = []
    for index, sample in enumerate(samples, 1):
        packet = read_json(output / "packets" / (sample["sample_id"] + ".json"))
        source_view = {k: v for k, v in packet.items() if k != "candidate_output"}
        controls = "".join(f'<label>{html.escape(name)} <select data-sample="{sample["sample_id"]}" data-dimension="{name}"><option value="">Not rated</option><option>0</option><option>1</option><option>2</option></select></label>' for name in sample["dimensions"])
        sections.append(f'<section id="{sample["sample_id"]}"><h2>{index}. {sample["sample_id"]}</h2><details><summary>View sources, candidate facts and history</summary><pre>{html.escape(json.dumps(source_view,ensure_ascii=False,indent=2))}</pre></details><h3>Output to rate</h3><pre>{html.escape(json.dumps(packet["candidate_output"],ensure_ascii=False,indent=2))}</pre><div class="scores">{controls}</div><label>Evidence and reason (quote specific text)<textarea data-notes="{sample["sample_id"]}" rows="3"></textarea></label></section>')
    page = r'''<!doctype html><html lang="en"><meta charset="utf-8"><title>Judge calibration: human review</title><style>body{font:16px/1.6 system-ui;max-width:1000px;margin:32px auto;padding:0 20px;background:#f6f7fa;color:#17202a}section{background:white;padding:24px;margin:24px 0;border:1px solid #ddd;border-radius:12px}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:13px/1.6 monospace;max-height:550px;overflow:auto;background:#f5f5f5;padding:16px}.scores{display:flex;gap:16px;flex-wrap:wrap}label{display:block;margin:10px 0}select,textarea,button{font:inherit;padding:8px}textarea{display:block;width:95%}.bar{position:sticky;top:0;background:#fff;padding:12px;border:1px solid #ddd}button{cursor:pointer}</style><h1>Human review: judge calibration pilot</h1><p>These 12 outputs come from four source stories and include format controls and injected defects; they are not 12 independent cases. Group/model names and judge scores are hidden, but output content may reveal the method. Read the shared rubric before rating independently. Blank ratings remain pending.</p><p>0 = incorrect or absent; 1 = partially met; 2 = complete and supported. Candidate statements and source documents establish facts; model-authored tool notes do not.</p><details><summary>Full rubric</summary><pre>RUBRIC</pre></details><div class="bar"><span id="progress"></span> <button onclick="downloadRatings()">Export ratings CSV</button></div>SECTIONS<script>
const key='interview-calibration-PACK_KEY';
function update(){const els=[...document.querySelectorAll('select')];document.getElementById('progress').textContent=els.filter(e=>e.value!=='').length+' / '+els.length+' dimensions rated';}
function save(){const state={};document.querySelectorAll('select').forEach(e=>state[e.dataset.sample+':'+e.dataset.dimension]=e.value);document.querySelectorAll('textarea').forEach(e=>state['notes:'+e.dataset.notes]=e.value);try{localStorage.setItem(key,JSON.stringify(state));}catch(e){}update();}
let saved={};try{saved=JSON.parse(localStorage.getItem(key)||'{}');}catch(e){}
document.querySelectorAll('select').forEach(e=>{e.value=saved[e.dataset.sample+':'+e.dataset.dimension]||'';e.addEventListener('change',save);});document.querySelectorAll('textarea').forEach(e=>{e.value=saved['notes:'+e.dataset.notes]||'';e.addEventListener('input',save);});
function downloadRatings(){const quote=s=>'"'+String(s).replaceAll('"','""')+'"';const rows=[['sample_id','dimension','score','evidence','reason']];document.querySelectorAll('select').forEach(e=>{const notes=document.querySelector('textarea[data-notes="'+e.dataset.sample+'"]').value;rows.push([e.dataset.sample,e.dataset.dimension,e.value,notes,'']);});const blob=new Blob(['\ufeff'+rows.map(r=>r.map(quote).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='human-ratings.csv';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}
update();</script></html>'''
    pack_key = hashlib.sha256(canonical(samples).encode()).hexdigest()[:16]
    (output / "human-review.html").write_text(page.replace("RUBRIC", html.escape(rubric)).replace("SECTIONS", "\n".join(sections)).replace("PACK_KEY", pack_key), encoding="utf-8")
    return {"sample_count": 12, "source_stories": 4, "dimensions": sum(len(s["dimensions"]) for s in samples), "output": str(output)}


def judge_pack(pack: Path):
    samples = read_json(pack / "samples.json")["samples"]
    for index, sample in enumerate(samples, 1):
        result = judge.evaluate(read_json(pack / "packets" / (sample["sample_id"] + ".json")), pack / "judge" / (sample["sample_id"] + ".json"), rubric_text=(pack / "rubric.md").read_text(encoding="utf-8"), settings=read_json(pack / "settings.json"))
        print(canonical({"completed": index, "total": len(samples), "sample_id": sample["sample_id"], "cost": result.get("usage", {}).get("cost")}), flush=True)


def compare(pack: Path, ratings: Path) -> dict:
    samples = read_json(pack / "samples.json")["samples"]
    expected = {(s["sample_id"], d) for s in samples for d in s["dimensions"]}
    with ratings.open(encoding="utf-8-sig", newline="") as stream:
        rows = list(csv.DictReader(stream))
    supplied = {}
    for row in rows:
        key = (row["sample_id"], row["dimension"])
        if key not in expected or key in supplied:
            raise ValueError("Unexpected or duplicate rating row")
        if row["score"] not in {"0", "1", "2"}:
            raise ValueError("Human ratings incomplete: each score must be 0, 1 or 2; no auto-filling")
        supplied[key] = int(row["score"])
    if set(supplied) != expected:
        raise ValueError("Human ratings incomplete: missing dimensions")
    errors, matches = [], []
    judgments = {}
    for sample in samples:
        judged = read_json(pack / "judge" / (sample["sample_id"] + ".json"))["judgment"]
        by_name = {d["name"]: d["score"] for d in judged["dimensions"]}
        judgments[sample["sample_id"]] = judged
        for name in sample["dimensions"]:
            a, b = supplied[(sample["sample_id"], name)], by_name[name]
            errors.append(abs(a-b)); matches.append(a == b)
    detections = []
    for item in read_json(pack / "private_manifest.json"):
        defect = item["known_defect"]
        if defect:
            judgment = judgments[item["sample_id"]]
            scores = {d["name"]: d["score"] for d in judgment["dimensions"]}
            detected = all(scores[name] == 0 for name in defect["zero_dimensions"]) and (not defect["serious_error_expected"] or bool(judgment["serious_errors"]))
            detections.append({"sample_id": item["sample_id"], "kind": defect["kind"], "detected": detected})
    mae, exact = sum(errors)/len(errors), sum(matches)/len(matches)
    result = {"sample_count": len(samples), "source_stories": 4, "rated_dimensions": len(errors), "mae": mae, "exact_agreement": exact, "known_defect_checks": detections, "operational_gate_passed": mae <= 0.5 and exact >= 0.7 and all(d["detected"] for d in detections), "limitation": "Single-rater pilot; dependent controlled variants, no inter-rater reliability or population-level conclusion."}
    write_json(pack / "comparison.json", result)
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    create = sub.add_parser("export")
    create.add_argument("--run", type=Path, action="append", required=True)
    create.add_argument("--output", type=Path, default=Path("deliverables/calibration-pilot"))
    score = sub.add_parser("judge")
    score.add_argument("--pack", type=Path, required=True)
    comparison = sub.add_parser("compare")
    comparison.add_argument("--pack", type=Path, required=True)
    comparison.add_argument("--ratings", type=Path, required=True)
    args = parser.parse_args()
    try:
        if args.command == "export":
            print(canonical(create_pack(args.run, args.output)))
        elif args.command == "judge":
            judge_pack(args.pack)
        else:
            print(canonical(compare(args.pack, args.ratings)))
        return 0
    except (ValueError, FileExistsError, FileNotFoundError, judge.JudgeAccessError) as exc:
        print(canonical({"ok": False, "error": str(exc)}))
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
