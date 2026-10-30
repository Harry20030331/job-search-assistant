"""Authored, clearly hypothetical simulations for the isolated UI preview only."""
from interview.practice import SimulationPack

FACTS = ("Documented fictional candidate facts: Alex compared two classifiers on a public synthetic dataset and wrote an error-analysis notebook. "
         "Alex also built a course transit-status API with a teammate, implemented request validation and wrote integration tests. "
         "Production ownership, impact metrics, personal motivations and interviewer feedback are not established.")


def criterion(name, strong, mistake):
    return {"criterion": name, "strong_answer": strong, "common_mistake": mistake}


def exercise(kind, minutes, scenario, prompt, artifacts, constraints, followups, answers, rubric, steps=None):
    return {"kind": "suggested_practice", "exercise_type": kind, "timebox_minutes": minutes, "scenario": scenario,
        "prompt": prompt, "artifacts": [{"label": name, "format": fmt, "content": content} for name, fmt, content in artifacts],
        "constraints": constraints, "follow_ups": followups, "rubric": rubric,
        "steps": steps or ["Read the setting and identify the decision or audience.", "State assumptions, then work through the supplied information.", "Give a bounded answer and address one follow-up."],
        "answer_points": answers, "self_check": ["I answered the concrete task within this block's timebox.", "I separated supplied facts, hypothetical assumptions and unknowns."],
        "basis_refs": ["candidate", "invitation", "jd", "company"]}


def common(section):
    sid, minutes = section["section_id"], section["minutes"]
    if sid == "intro":
        return exercise("introduction", minutes,
            "Hypothetical opening: a recruiter or interviewer has read your application but has not seen your course projects. You have 60 seconds to introduce yourself, followed by a short motivation question. The candidate facts below are the only established personal evidence; genuine interests must come from the candidate.",
            "Give a 60-second introduction, then outline a truthful 30-second response to 'Why this role?' and one genuine question or reflection about the company's stated focus.",
            [("Candidate evidence", "text", FACTS), ("Audience and company context", "text", "Audience: an early-career interviewer. The fictional company values clear explanations and learning from users. A specific personal reason for joining has not been supplied.")],
            ["Use only documented project facts; do not invent employment, metrics or personal motivation.", "Use one project example in the introduction, not a full technical project walkthrough."],
            ["Which part of that project did you personally implement?", "What would you want to learn about this team before deciding whether the role fits?"],
            ["Open with the supplied project/background rather than an invented degree or employment title.", "Use a problem, personal contribution and learning structure; keep details for follow-ups.", "For why-role/company, connect a real interest supplied by the candidate to a documented responsibility; leave [your genuine reason] where it is missing."],
            [criterion("Truthful scope", "Names only documented project contributions and explicitly leaves missing motivation as a prompt.", "Invents impact figures, healthcare experience or personal beliefs."),
             criterion("Audience and structure", "Explains the user problem before implementation and stays near 60 seconds.", "Lists tools for several minutes without explaining the project purpose."),
             criterion("Role connection", "Separates what the role involves from what the candidate genuinely wants to do.", "Uses a generic company compliment as a claimed personal motivation.")])
    if sid == "story":
        return exercise("behavioral", minutes,
            "Hypothetical interviewer prompt: 'Tell me about a time you worked through a technical decision with someone else.' Your documented course API project involved a teammate, validation and tests. No disagreement, division of work or quantified outcome has been supplied. Use a real recalled example, or clearly identify the missing details before rehearsing.",
            "Prepare a two-minute story about an actual collaboration decision from the course API. Distinguish your action, your teammate's role, the evidence considered and one learning.",
            [("Available candidate facts", "text", FACTS), ("Story worksheet", "text", "Situation: [actual course/API context]\nDecision: [actual choice discussed]\nMy action: [what I personally did]\nOther person's contribution: [actual contribution]\nResult and learning: [observed result, no invented numbers]")],
            ["Do not invent a conflict or a successful production launch to fill the worksheet.", "Use at most 30 seconds for situation/task and reserve time for action, reasoning and reflection."],
            ["What alternative did the other person suggest, and why did you consider it?", "What would you change if you made the same decision again?"],
            ["A strong structure is situation/task, personal action with evidence, result, reflection.", "It is acceptable to say the available profile does not establish the specific disagreement; ask the candidate for a real example.", "Describe the teammate fairly, separate individual from team contributions, and avoid manufacturing feedback or impact."],
            [criterion("Specific evidence", "Anchors the story in an actual recalled decision and distinguishes known facts from placeholders.", "Turns an invented conflict into a claimed personal event."),
             criterion("Personal contribution", "Explains a concrete personal action and the collaborator's contribution separately.", "Uses only 'we' or claims the whole team outcome as individual work."),
             criterion("Reflection", "Explains one tradeoff or learning and responds directly to the follow-up.", "Provides a polished success claim without a reasoned decision or learning.")])
    return exercise("questions", minutes,
        "Hypothetical closing: the interviewer leaves a few minutes for your questions. You know the role's responsibilities from the supplied JD, but not the team's actual mentorship process or evaluation workflow. The company description is fictional preview evidence, not knowledge of a real team's practices.",
        "Choose two questions you genuinely want answered about this role, and explain what each answer would help you decide.",
        [("Known versus unknown", "text", "Known: early-career role; responsibilities in the selected JD. Unknown: exact first project, mentorship cadence, team ownership boundaries and later-round format.")],
        ["Ask open questions grounded in the role, without asserting an undocumented company process.", "Fit two short questions and one sentence about your purpose within this block."],
        ["If the interviewer says 'it depends on the project', what would you ask next?", "Which answer would most change your view of whether the role fits your interests?"],
        ["Suggested topics include how a new graduate receives feedback and how the team decides whether work is successful.", "The candidate chooses the topics; do not claim that mentorship or a particular technology is their established priority.", "A useful follow-up asks for a concrete recent example rather than repeating the original question."],
        [criterion("Grounding", "References a documented responsibility and asks about an unknown process.", "Assumes the team uses an unverified stack, product or mentorship policy."),
         criterion("Decision value", "Explains how the answer would inform a genuine candidate decision.", "Asks a question only to sound impressive without a purpose."),
         criterion("Conversation", "Uses brief, open questions and an adaptive follow-up.", "Bundles many unrelated questions or asks for confidential interview answers.")])


def specialized(section):
    sid, minutes = section["section_id"], section["minutes"]
    if sid == "experiment":
        return exercise("case", minutes,
            "Hypothetical product DS case, using invented data: a workflow-tool vendor is testing a new onboarding checklist to help newly created workspaces reach first value. Workspaces, not individual teammates, are randomized 1:1. The PM wants to launch on day 7 of a planned 14-day experiment. Activation means at least one completed workflow within seven days of workspace creation. Your decision must account for both benefit and the predeclared latency guardrail.",
            "Define the hypothesis and analysis unit, interpret the interim results, and recommend launch, continue or stop. Explain what additional checks you need before treating the activation lift as causal and decision-ready.",
            [("Invented interim results", "table", "Metric                              Control   Treatment\nEligible randomized workspaces       800       810\nActivated within 7 days               400       454\np95 onboarding load time (ms)          480       590\nEnterprise share of sample            20%       35%\nObservation at interim               day 7     day 7"),
             ("Predeclared decision rules", "text", "Planned run: 14 days. Primary outcome: seven-day workspace activation. Latency guardrail: treatment p95 may increase by at most 50 ms. Do not declare a winner from repeated unadjusted interim p-values. New workspaces entering late may not yet have a full seven-day outcome window.")],
            ["Use workspace-level observations; teammates in one workspace are not independent experimental units.", "Respect the 14-day plan, outcome maturity and the +50 ms guardrail; do not invent missing variance or segment-level outcomes."],
            ["Activation is roughly six percentage points higher, but latency rises by 110 ms. Does a positive primary metric justify launch?", "How would the enterprise-share imbalance and incomplete seven-day follow-up affect your next checks?", "If enterprise users invite teammates into other workspaces, which interference risks would you investigate?"],
            ["Activation rates are 400/800=50.0% and 454/810≈56.05%, about +6.05 percentage points or +12.1% relative; distinguish the two.", "The p95 difference is +110 ms, exceeding the predeclared +50 ms guardrail. Do not recommend an unconditional launch from this interim result.", "Check exposure/instrumentation, workspace deduplication, assignment integrity, balanced segments and outcome maturity. The aggregate table alone cannot establish segment effects or an adjusted uncertainty estimate.", "A defensible recommendation is continue only under the agreed guardrail monitoring/escalation policy, or pause/investigate the regression; explain which missing operational rule determines that choice."],
            [criterion("Metric and unit", "Defines workspace activation with its seven-day denominator/window and computes absolute versus relative lift correctly.", "Treats individual teammates as independent or calls six percentage points a six-percent relative lift."),
             criterion("Decision discipline", "Recognizes the breached latency guardrail and planned duration; proposes a qualified decision and next checks.", "Ships immediately because the primary point estimate increased."),
             criterion("Validity and uncertainty", "Names outcome-maturity, segment and instrumentation limitations without fabricating confidence or causal certainty.", "Invents a significant p-value or segment conclusion from missing data.")])
    if sid == "metrics":
        return exercise("case", minutes,
            "Hypothetical product-metrics case: a vendor introduces reusable workflow templates for small teams. The PM says 'template creation doubled, so the feature is successful.' You have one week's aggregate counts and must propose a metric tree that distinguishes setup, repeated value and possible user harm. These counts are invented practice data and do not describe the prospective employer.",
            "Choose a primary product-success metric, two diagnostics and one guardrail. Explain why creation count alone is insufficient, which denominators/windows you need, and what decision the supplied data supports.",
            [("Invented weekly observations", "table", "Measure                                        Count\nEligible workspaces                             1,000\nWorkspaces shown the template feature             600\nTemplates created (events, not unique users)        420\nUnique workspaces creating a template              210\nUnique workspaces using a template in a workflow   120\nWorkspaces reusing a template on a later day        70\nTemplate-related support tickets                    45"),
             ("Measurement scope", "text", "No control group, prior-week retention cohort or ticket baseline is supplied. 'Later day' is not yet a seven-day retention definition. A workspace can create multiple templates. The business goal is repeated useful workflow completion, not maximizing setup events.")],
            ["Do not confuse creation events with unique workspaces or infer a causal effect without a comparison.", "Define eligibility, exposure and outcome windows before comparing segments or weeks."],
            ["Would you use 70/120 or 70/600 as retention, and what does each denominator actually measure?", "Creation grows while reuse stays flat and support tickets rise. What would you investigate before expanding rollout?"],
            ["A possible primary metric is eligible-workspace rate of repeated successful template-assisted workflows over a fixed follow-up window; define successful and repeated before measurement.", "Use exposure-to-first-use and first-use-to-reuse as diagnostics. For the supplied week, 120/600 is an exposed-to-use conversion and 70/120 is later-day reuse among first-use workspaces, not a fully matured retention rate.", "Track a harm guardrail such as template-related failures or support-ticket rate with a defined denominator and baseline. Forty-five tickets alone cannot establish a regression.", "Ask for cohort timestamps, successful workflow counts and appropriate baselines/control data. The table identifies funnel questions; it does not prove the feature improved the business."],
            [criterion("Goal alignment", "Connects the primary metric to repeated user value with a defined unit and observation window.", "Optimizes raw creation events simply because they increased."),
             criterion("Denominator clarity", "Separates events from unique workspaces and explains what each conversion denominator means.", "Labels any convenient fraction as retention without a cohort/window definition."),
             criterion("Limits and harms", "Uses diagnostics and a measurable harm guardrail while acknowledging missing comparison data.", "Claims causality or a support regression from the aggregate counts alone.")])
    if sid == "coding":
        return exercise("coding", minutes,
            "Hypothetical junior software interview: an interview-coordination app receives unsorted busy intervals from a calendar integration, including duplicates and overlaps. You must return the maximal free intervals within one working day. Intervals use integer minute offsets and half-open semantics [start, end); this exercise deliberately excludes timezones and external Calendar calls so you can focus on a precise algorithm and tests.",
            "Implement available_slots(busy, day_start, day_end, min_duration). Return sorted maximal free intervals of at least min_duration, after clipping valid busy intervals to the working day. State complexity and test boundary cases.",
            [("Function contract", "code", "def available_slots(busy: list[tuple[int, int]], day_start: int, day_end: int, min_duration: int) -> list[tuple[int, int]]:\n    ...\n# All endpoints are integers in [0, 1440].\n# Require 0 <= day_start < day_end <= 1440 and min_duration > 0.\n# Require start < end for every busy interval; otherwise raise ValueError.\n# Ignore valid intervals entirely outside the working day.\n# Do not split maximal gaps into every possible appointment window."),
             ("Examples with expected output", "code", "available_slots([(600,660),(630,690),(900,960),(600,660)],540,1020,45)\n# -> [(540,600),(690,900),(960,1020)]\navailable_slots([],540,1020,45)\n# -> [(540,1020)]\navailable_slots([(500,560),(1000,1100)],540,1020,30)\n# -> [(560,1000)]\navailable_slots([(600,660),(660,690)],540,720,31)\n# -> [(540,600)]\navailable_slots([(600,600)],540,1020,45)\n# -> raises ValueError")],
            ["Support up to 100,000 intervals; target O(n log n) time and O(n) or better extra space.", "Touching busy intervals leave no free gap; validate original intervals before clipping and do not mutate the caller's list."],
            ["How do you handle a busy interval that contains the entire working day?", "What breaks if you emit a gap before merging overlapping intervals?", "If busy intervals arrive already sorted, what time complexity can you achieve?"],
            ["Validate day bounds, positive minimum and each original interval. Clip overlaps to the day, discard empty clipped intervals, and sort a new list by start/end.", "Maintain a cursor at day_start. For each sorted interval, emit (cursor,start) only if its length meets the minimum, then set cursor=max(cursor,end). Emit the final suffix if long enough.", "Overlaps, duplicates and touching endpoints are absorbed by the monotone cursor. A fully covering busy interval yields no free intervals.", "Sorting dominates O(n log n); scanning is O(n), with O(n) storage for a non-mutating clipped copy/output. Already sorted input supports a linear scan after validation.", "Test empty/full coverage, clipping on both ends, duplicates, touching intervals, gaps exactly equal to min_duration and invalid original intervals."],
            [criterion("Contract correctness", "Returns sorted maximal half-open gaps, handles clipping and validates invalid original intervals as specified.", "Returns every appointment-sized subwindow or silently accepts zero-length invalid intervals."),
             criterion("Overlap handling", "Uses a monotone cursor or equivalent merge so duplicate/overlapping/touching busy periods cannot create false gaps.", "Compares only adjacent raw intervals without maintaining the merged right boundary."),
             criterion("Complexity and tests", "Meets O(n log n), preserves the input and tests boundary/minimum-duration cases.", "Enumerates all minutes or possible windows without explaining constraints or off-by-one behavior.")])
    if sid == "design":
        return exercise("design", minutes,
            "Hypothetical bounded API design: one small service lets a candidate reserve an interview slot. A client may retry after a network timeout, and two requests may race for the same slot. The service has one instance and a transactional database; traffic is about 200 requests per minute. You do not need sharding, consensus or a multi-region architecture.",
            "Design the request validation and idempotency behavior for POST /reservations. Specify duplicate-key, changed-payload and conflicting-slot responses and explain the transaction boundaries.",
            [("Request and expected behavior", "code", "POST /reservations\nIdempotency-Key: request-123\n{\"candidate_id\":\"candidate-A\",\"slot_id\":\"slot-42\"}\n\nFirst valid request: 201 with reservation_id.\nSame key + same normalized payload: return the original result, no second reservation.\nSame key + different payload: 409 conflict.\nDifferent key + an already reserved slot: 409 conflict.\nMissing IDs or invalid key: 400.\nSlot IDs refer to existing predefined slots; timezone conversion is outside this task.")],
            ["Use one service and an ordinary transactional database; avoid adding distributed architecture without a requirement.", "A timeout does not prove the first write failed. Define idempotency-key retention and preserve successful results across a restart."],
            ["Two requests with different keys reserve the same slot concurrently. Which database constraint prevents double booking?", "The server commits and then the response is lost. What does the retried request observe?"],
            ["Validate IDs and key, normalize the payload, and store a payload hash plus outcome under a unique idempotency key.", "Use a transaction with a uniqueness constraint on the reservable slot and a unique key record so concurrent attempts cannot both book it.", "Commit the reservation and reproducible response atomically. A same-key/same-payload retry returns that outcome even if the first response was lost.", "Explain changed-payload conflict, slot conflict and retention semantics; a finite key TTL needs a documented retry horizon. There is no requirement for distributed consensus here."],
            [criterion("Retry semantics", "Distinguishes same-payload replay from changed-payload conflict and persists the original result.", "Treats every timeout as a failed write and blindly creates another reservation."),
             criterion("Atomicity", "Explains transaction and database uniqueness boundaries for both key replay and slot conflicts.", "Relies on a non-atomic check-then-insert in application memory."),
             criterion("Appropriate scope", "Covers validation, error codes and restart/retention behavior within the single-service constraints.", "Spends the whole exercise proposing multi-region architecture unrelated to the requirements.")])
    return common(section)


def pack(proposal):
    value = {"material_format": "simulation-v2", "proposal_id": proposal["proposal_id"], "proposal_version": proposal["version"],
        "proposal_hash": proposal["proposal_hash"], "unknowns": ["All scenarios and numerical data are hypothetical rehearsal content, not verified employer questions or candidate facts."],
        "sections": [{"section_id": section["section_id"], "minutes": section["minutes"], "exercises": [specialized(section)]} for section in proposal["draft"]["sections"]]}
    return SimulationPack.model_validate(value).model_dump()
