"""Frozen semantic audit packs, hidden-method human forms and explicit judge comparison."""
from __future__ import annotations

import argparse
import csv
import hashlib
import html
import json
from pathlib import Path

from evaluation import judge
from evaluation.preparation_quality import DIMENSIONS, RUBRIC, PreparationJudgment, add_evidence_catalog, evaluate, judgment_schema, source_texts, validate_judgment
from evaluation.workflow_review import load_judge_env
from interview.context_preparation import render_proposal
from interview.preparation import render_material
from interview.schemas import strict_schema
from interview.storage import canonical, digest, read_json, write_json


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def within(root, relative):
    path = (root / relative).resolve()
    if not path.is_relative_to(root.resolve()):
        raise ValueError("Audit source must stay inside the selected run")
    return path


def blind(value):
    replacements = {key: "[" + key.replace("_", "-") + "]" for key in
                    ("proposal_id", "proposal_hash", "context_hash", "policy_hash", "material_id", "input_fingerprint")}
    if isinstance(value, dict):
        return {key: replacements.get(key, blind(item)) for key, item in value.items()}
    if isinstance(value, list):
        return [blind(item) for item in value]
    return value


def packet_for(node, stage):
    public = read_json(node / "public_request.json")
    invocation = read_json(node / "invocation-result.json")
    output = invocation.get("output", {}).get("proposal" if stage == "proposal" else "material")
    if not isinstance(output, dict):
        return None
    if "preparation_policy" not in public:
        raise ValueError("This semantic protocol requires the explicit policy contract; do not silently relabel legacy runs")
    packet = blind({"protocol": "preparation-semantic-v1.1", "stage": stage, "request": public["request"],
        "analysis": public["analysis"], "preparation_policy": public["preparation_policy"],
        "approved_proposal": public.get("approved_proposal"), "candidate_output": output})
    try:
        if stage == "proposal":
            previous = public.get("previous_proposal")
            text = render_proposal({"version": previous["version"] + 1 if previous else 1, "draft": packet["candidate_output"]})
        else:
            text = render_material(packet["approved_proposal"], packet["candidate_output"])
    except (KeyError, TypeError):
        text = json.dumps(packet["candidate_output"], indent=2, ensure_ascii=False)
    packet["output_text"] = text
    return add_evidence_catalog(packet)


def review_page(samples, rubric, fingerprint):
    cards = []
    for sid, packet in samples:
        fields = []
        for dimension in DIMENSIONS:
            key = sid + ":" + dimension
            fields.append('<fieldset><legend>' + dimension + '</legend><label>Score <select data-key="' + key + ':score"><option value="">Pending</option><option>0</option><option>1</option><option>2</option></select></label>'
                '<label>Output/source evidence or explicit omission<textarea data-key="' + key + ':evidence"></textarea></label>'
                '<label>Reason<textarea data-key="' + key + ':reason"></textarea></label></fieldset>')
        sources = {s["source_id"]: s["content"] for s in packet["request"]["sources"]}
        supporting = {"identity": packet["request"]["identity"], "budget_minutes": packet["request"]["budget_minutes"],
                      "preparation_policy": packet["preparation_policy"], "original_sources": sources,
                      "derived_analysis_not_independent_truth": packet["analysis"], "approved_proposal": packet["approved_proposal"]}
        cards.append('<section><h2>' + sid + ' / ' + packet["stage"] + '</h2><details><summary>Sources, policy and task context</summary><pre>' +
                     html.escape(json.dumps(supporting, indent=2, ensure_ascii=False)) + '</pre></details><h3>Artifact to score</h3><pre>' +
                     html.escape(packet["output_text"]) + '</pre>' + ''.join(fields) + '</section>')
    script = r'''<script>
const pack=PACK, dimensions=DIMS, ids=IDS;
const controls=[...document.querySelectorAll('[data-key]')];let active='';
const identity=document.getElementById('rater');
function storageKey(){return 'prep-semantic-'+pack+':'+active}
function progress(){document.getElementById('progress').textContent=controls.filter(e=>e.tagName==='SELECT'&&e.value!=='').length+' / '+ids.length*dimensions.length+' scores'}
function save(){if(!active)return;let state={};controls.forEach(e=>state[e.dataset.key]=e.value);try{localStorage.setItem(storageKey(),JSON.stringify(state))}catch(e){}progress()}
function loadRater(){const next=identity.value.trim();if(!next){alert('Enter a rater alias such as rater1.');return}save();active=next;let state={};try{state=JSON.parse(localStorage.getItem(storageKey())||'{}')}catch(e){}controls.forEach(e=>{e.value=state[e.dataset.key]||'';e.disabled=false});document.getElementById('active').textContent='Active rater: '+active;progress()}
controls.forEach(e=>{e.disabled=true;e.addEventListener('input',save)});
function download(){
if(!active){alert('Load a rater first.');return}
if(identity.value.trim()!==active){alert('Load the edited rater alias before exporting.');return}
save();let rows=[['pack_fingerprint','rater_id','sample_id','dimension','score','evidence','reason']];
ids.forEach(id=>dimensions.forEach(d=>{const value=field=>controls.find(e=>e.dataset.key===id+':'+d+':'+field).value;rows.push([pack,active,id,d,value('score'),value('evidence'),value('reason')])}));
const q=s=>String.fromCharCode(34)+String(s).replaceAll(String.fromCharCode(34),String.fromCharCode(34,34))+String.fromCharCode(34);
const blob=new Blob([String.fromCharCode(65279)+rows.map(r=>r.map(q).join(',')).join(String.fromCharCode(13,10))],{type:'text/csv;charset=utf-8'});
const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='human-semantic-'+pack.slice(0,12)+'-'+active.replace(/[^a-zA-Z0-9_-]/g,'_')+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)
}progress();
</script>'''.replace("PACK", json.dumps(fingerprint)).replace("DIMS", json.dumps(DIMENSIONS)).replace("IDS", json.dumps([sid for sid, _ in samples]))
    return ('<!doctype html><html lang="en"><meta charset="utf-8"><title>Preparation semantic review</title><style>'
        'body{font:16px/1.5 system-ui;max-width:1060px;margin:24px auto;padding:0 16px}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#f5f5f5;padding:16px;max-height:550px;overflow:auto}'
        'section{border:1px solid #bbb;padding:20px;margin:24px 0}fieldset{margin:14px 0}label{display:block;margin:8px 0}textarea{width:96%;min-height:55px;font:inherit}button,input,select{font:inherit;padding:7px}.bar{position:sticky;top:0;background:white;border:1px solid #bbb;padding:12px}</style>'
        '<h1>Preparation semantic review</h1><p>Score sources and actual content, using the correct stage. Method labels and judge scores are not displayed. '
        'You may recognize previously inspected development outputs; hidden labels do not establish independent blinding. Score before opening private-index or judge results. '
        '0 = materially missing/incorrect; 1 = partly useful; 2 = well supported/useful. Blank stays pending. Use a distinct alias for each rater. '
        'For this human form, write excerpts/omission evidence and reasons in the controls. The rubric JSON and evidence-ID instructions apply to the automated judge.</p>'
        '<details><summary>Read the frozen rubric and stage-specific anchors</summary><pre>' + html.escape(rubric) + '</pre></details>'
        '<div class="bar"><input id="rater" aria-label="Rater alias" placeholder="rater1"><button onclick="loadRater()">Load rater</button> '
        '<span id="active">No rater loaded</span> / <span id="progress"></span> <button onclick="download()">Export CSV</button></div>' + ''.join(cards) + script + '</html>')


def export(pilot, output):
    pilot, output = Path(pilot).resolve(), Path(output).resolve()
    manifest = read_json(pilot / "pilot-manifest.json")
    rubric = RUBRIC.read_text(encoding="utf-8")
    settings = {k: v for k, v in manifest["settings"].items() if k.startswith("judge_")}
    packets, index, missing, source_hashes = {}, [], [], {"pilot-manifest.json": sha(pilot / "pilot-manifest.json")}
    for ordinal, entry in enumerate(manifest["schedule"]):
        for stage in (["proposal", "materials"] if entry["synthetic_accept_material_audit"] else ["proposal"]):
            relative = entry["key"] + "--" + entry["method"] + "/" + stage
            node = within(pilot, relative)
            required = [node / "public_request.json", node / "invocation-result.json"]
            if not all(path.is_file() for path in required):
                missing.append({"interview_id": entry["interview_id"], "method": entry["method"], "stage": stage, "reason": "Scheduled artifact unavailable; no substitute"})
                continue
            packet = packet_for(node, stage)
            for path in required:
                source_hashes[path.relative_to(pilot).as_posix()] = sha(path)
            if packet is None:
                missing.append({"interview_id": entry["interview_id"], "method": entry["method"], "stage": stage, "reason": "First invocation has no artifact payload; not filled with zero or replaced"})
                continue
            sid = "Q-" + digest({"pilot": source_hashes["pilot-manifest.json"], "ordinal": ordinal, "stage": stage, "packet": packet, "rubric": rubric})[:12]
            packets[sid] = packet
            index.append({"sample_id": sid, "interview_id": entry["interview_id"], "method": entry["method"], "stage": stage,
                          "source_node": relative, "packet_sha256": digest(packet)})
    schema = strict_schema(PreparationJudgment)
    source_stories = len({e["interview_id"] for e in manifest["schedule"]})
    planned = len(manifest["schedule"]) + sum(bool(e["synthetic_accept_material_audit"]) for e in manifest["schedule"])
    fingerprint = digest({"samples": {key: digest(value) for key, value in packets.items()}, "rubric": rubric,
                          "settings": settings, "schema": schema, "missing": missing, "source_hashes": source_hashes,
                          "index": index, "artifact_count": len(packets), "source_stories": source_stories, "planned_artifacts": planned})
    if any(sha(within(pilot, relative)) != expected for relative, expected in source_hashes.items()):
        raise ValueError("Pilot evidence changed during semantic export")
    output.mkdir(parents=True, exist_ok=False)
    for sid, packet in packets.items():
        write_json(output / "packets" / (sid + ".json"), packet)
    (output / "rubric.md").write_text(rubric, encoding="utf-8")
    write_json(output / "judge-settings.json", settings)
    write_json(output / "judge-schema.json", schema)
    write_json(output / "private-index.json", {"samples": index, "missing": missing})
    (output / "exporter_snapshot.py").write_bytes(Path(__file__).read_bytes())
    (output / "judge_implementation.py").write_bytes((Path(__file__).parent / "preparation_quality.py").read_bytes())
    write_json(output / "pack-manifest.json", {"protocol": "preparation-semantic-v1.1", "pack_fingerprint": fingerprint,
        "rubric_hash": digest(rubric), "settings_hash": digest(settings), "schema_hash": digest(schema), "source_hashes": source_hashes,
        "artifact_count": len(packets), "source_stories": source_stories, "planned_artifacts": planned,
        "missing": missing, "human_review": "pending", "judge_validation": "pending_human_calibration",
        "selection": "All scheduled first proposal payloads and only the predeclared materials audit; retain raw semantic artifacts even when host validation failed.",
        "limitations": "Development rubric authored after inspecting outputs. Artifacts share stories; no population, held-out, independent-blinding or causal-effect claim."})
    cards = sorted(packets.items())
    (output / "human-review.html").write_text(review_page(cards, rubric, fingerprint), encoding="utf-8")
    with (output / "ratings-template.csv").open("w", encoding="utf-8-sig", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=["pack_fingerprint", "rater_id", "sample_id", "dimension", "score", "evidence", "reason"])
        writer.writeheader()
        writer.writerows({"pack_fingerprint": fingerprint, "sample_id": sid, "dimension": d} for sid in sorted(packets) for d in DIMENSIONS)
    return {"status": "semantic_pack_exported", "pack_fingerprint": fingerprint, "artifacts": len(packets), "rating_rows": len(packets)*6, "missing": missing}


def verify_pack(root):
    manifest, index = read_json(root / "pack-manifest.json"), read_json(root / "private-index.json")
    rubric = (root / "rubric.md").read_text(encoding="utf-8")
    settings, schema = read_json(root / "judge-settings.json"), read_json(root / "judge-schema.json")
    ids = [row["sample_id"] for row in index["samples"]]
    if len(ids) != len(set(ids)) or any(not sid.startswith("Q-") or not sid[2:].isalnum() for sid in ids):
        raise ValueError("Invalid or duplicate semantic sample IDs")
    packets = {sid: read_json(within(root, "packets/" + sid + ".json")) for sid in ids}
    if (digest(rubric), digest(settings), digest(schema)) != (manifest["rubric_hash"], manifest["settings_hash"], manifest["schema_hash"]):
        raise ValueError("Frozen rubric/settings/schema changed; export a new review pack")
    if schema != strict_schema(PreparationJudgment) or any(digest(packets[row["sample_id"]]) != row["packet_sha256"] for row in index["samples"]):
        raise ValueError("Packet or applicable judge schema changed")
    for packet in packets.values():
        catalog = packet["evidence_catalog"]
        sources = source_texts(packet)
        if (any(not quote.strip() or quote not in packet["output_text"] for quote in catalog["output"].values()) or
                any(ref["source_id"] not in sources or not ref["quote"].strip() or ref["quote"] not in sources[ref["source_id"]] for ref in catalog["sources"].values())):
            raise ValueError("Evidence catalog must resolve to original text")
    expected = digest({"samples": {key: digest(value) for key, value in packets.items()}, "rubric": rubric, "settings": settings,
                       "schema": schema, "missing": index["missing"], "source_hashes": manifest["source_hashes"],
                       "index": index["samples"], "artifact_count": manifest["artifact_count"], "source_stories": manifest["source_stories"],
                       "planned_artifacts": manifest["planned_artifacts"]})
    if expected != manifest["pack_fingerprint"] or index["missing"] != manifest["missing"]:
        raise ValueError("Review pack binding changed")
    if manifest["artifact_count"] != len(packets) or manifest["planned_artifacts"] != len(packets) + len(index["missing"]):
        raise ValueError("Semantic artifact denominators changed")
    return manifest, index, packets, rubric, settings


def cache_path(root, packet, rubric, settings):
    fingerprint = digest({"packet": packet, "rubric": rubric, "settings": settings, "schema": judgment_schema(packet)})
    return root / "judge-results" / (fingerprint + ".json")


def judge_pack(root, *, request_fn=judge.request_structured):
    _, _, packets, rubric, settings = verify_pack(root)
    rows = []
    for sid, packet in sorted(packets.items()):
        destination = cache_path(root, packet, rubric, settings)
        try:
            cached = destination.exists()
            result = evaluate(packet, destination, rubric=rubric, settings=settings, request_fn=request_fn)
            rows.append({"sample_id": sid, "status": "scored_uncalibrated", "cache_hit": cached,
                "result_file": destination.relative_to(root).as_posix(), "result_sha256": sha(destination), "usage": result.get("usage")})
        except (judge.JudgeAccessError, ValueError, KeyError, TypeError, OSError) as exc:
            rows.append({"sample_id": sid, "status": "judge_failed", "error": str(exc)})
        write_json(root / "judge-status.json", {"human_calibrated": False, "results": rows})
        print(canonical({"sample_id": sid, "status": rows[-1]["status"]}), flush=True)
    return {"scored": sum(r["status"] == "scored_uncalibrated" for r in rows), "planned_available": len(packets), "human_calibrated": False}


def load_ratings(path, manifest, packets):
    with Path(path).open(encoding="utf-8-sig", newline="") as stream:
        rows = list(csv.DictReader(stream))
    expected = {(sid, dimension) for sid in packets for dimension in DIMENSIONS}
    seen, raters = set(), set()
    for row in rows:
        key = row.get("sample_id"), row.get("dimension")
        if (key in seen or key not in expected or row.get("pack_fingerprint") != manifest["pack_fingerprint"] or
                row.get("score") not in {"0", "1", "2"} or not row.get("rater_id", "").strip() or
                not row.get("evidence", "").strip() or not row.get("reason", "").strip()):
            raise ValueError("Ratings need exact pack/rater binding, unique complete scores, evidence and reasons; nothing is auto-filled")
        seen.add(key)
        raters.add(row["rater_id"].strip())
    if seen != expected or not expected or len(raters) != 1:
        raise ValueError("One complete, consistently identified rater per CSV is required")
    return rows


def compare(root, ratings):
    manifest, _, packets, rubric, settings = verify_pack(root)
    rows = load_ratings(ratings, manifest, packets)
    status = read_json(root / "judge-status.json")
    evidence = {row["sample_id"]: row for row in status["results"]}
    pairs = []
    for row in rows:
        sid, dimension = row["sample_id"], row["dimension"]
        cache = cache_path(root, packets[sid], rubric, settings)
        receipt = evidence.get(sid, {})
        if receipt.get("status") != "scored_uncalibrated" or not cache.is_file() or sha(cache) != receipt.get("result_sha256"):
            raise ValueError("Complete unchanged judge results are required; comparison makes no model calls")
        result = read_json(cache)
        if result.get("fingerprint") != cache.stem:
            raise ValueError("Judge cache fingerprint mismatch")
        judgment = validate_judgment(packets[sid], result["judgment"])
        score = next(d for d in judgment.dimensions if d.name == dimension)
        pairs.append({"sample_id": sid, "dimension": dimension, "human": int(row["score"]), "judge": score.score,
                      "human_evidence": row["evidence"], "human_reason": row["reason"], "judge_reason": score.reason})
    def metrics(items):
        return {"rows": len(items), "exact_agreement": sum(p["human"] == p["judge"] for p in items)/len(items),
                "mean_absolute_error": sum(abs(p["human"]-p["judge"]) for p in items)/len(items)}
    result = {"pack_fingerprint": manifest["pack_fingerprint"], "rater_id": rows[0]["rater_id"], "artifacts": len(packets),
        "source_stories": manifest["source_stories"], **metrics(pairs),
        "by_dimension": {d: metrics([p for p in pairs if p["dimension"] == d]) for d in DIMENSIONS},
        "disagreements": [p for p in pairs if p["human"] != p["judge"]],
        "note": "Single-rater development comparison; correlated dimensions and repeated stories. Not inter-rater reliability, population accuracy or validated judge status."}
    destination = root / "comparisons" / sha(ratings)
    if destination.exists():
        return read_json(destination / "comparison.json")
    destination.mkdir(parents=True)
    (destination / "submitted-ratings.csv").write_bytes(Path(ratings).read_bytes())
    write_json(destination / "comparison.json", result)
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("phase", choices=["export", "judge", "compare"])
    parser.add_argument("--pilot", type=Path)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--pack", type=Path)
    parser.add_argument("--judge-env", type=Path)
    parser.add_argument("--ratings", type=Path)
    args = parser.parse_args()
    if args.phase == "export":
        if args.pilot is None or args.output is None:
            parser.error("export requires --pilot and a new --output")
        result = export(args.pilot, args.output)
    else:
        if args.pack is None:
            parser.error("judge/compare requires --pack")
        if args.phase == "judge":
            load_judge_env(args.judge_env)
            result = judge_pack(args.pack.resolve())
        else:
            if args.ratings is None:
                parser.error("compare requires --ratings")
            result = compare(args.pack.resolve(), args.ratings.resolve())
    print(canonical(result))


if __name__ == "__main__":
    main()
