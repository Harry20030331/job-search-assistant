"""Opt-in simulation materials; historical material contracts remain unchanged."""
from typing import Literal

from pydantic import Field, model_validator

from interview.preparation import PracticeExercise, MaterialPack, MaterialSection
from interview.schemas import Contract

FORMAT = "simulation-v2"


class Artifact(Contract):
    label: str = Field(min_length=3)
    format: Literal["text", "table", "code"]
    content: str = Field(min_length=10, max_length=12000)


class Criterion(Contract):
    criterion: str = Field(min_length=5)
    strong_answer: str = Field(min_length=20)
    common_mistake: str = Field(min_length=15)


class SolutionTest(Contract):
    arguments_json: str
    expected_json: str
    expected_error: Literal["ValueError", "TypeError"] | None


class CodingSolution(Contract):
    language: Literal["python"]
    function_name: str = Field(pattern=r"^[A-Za-z][A-Za-z0-9_]*$")
    code: str = Field(min_length=30, max_length=16000)
    tests: list[SolutionTest] = Field(min_length=3, max_length=12)
    complexity: str = Field(min_length=10)


class SimulationExercise(PracticeExercise):
    exercise_type: Literal["case", "coding", "design", "behavioral", "introduction", "motivation", "questions"]
    scenario: str = Field(min_length=100, max_length=10000)
    artifacts: list[Artifact] = Field(min_length=1, max_length=4)
    constraints: list[str] = Field(min_length=2, max_length=6)
    follow_ups: list[str] = Field(min_length=2, max_length=5)
    rubric: list[Criterion] = Field(min_length=3, max_length=6)
    timebox_minutes: int = Field(gt=0, le=120)
    sample_answer: list[str] | None = Field(default=None, min_length=1, max_length=6)
    question_title: str | None = None
    question_details: list[Artifact] | None = None
    clarifying_questions: list[str] | None = None
    answer_coverage: list[str] | None = None
    solution: CodingSolution | None = None
    plan_section_id: str | None = None


class SimulationSection(MaterialSection):
    exercises: list[SimulationExercise] = Field(min_length=1, max_length=3)

    @model_validator(mode="after")
    def within_section_budget(self):
        if sum(exercise.timebox_minutes for exercise in self.exercises) != self.minutes:
            raise ValueError("Exercise timeboxes must allocate exactly the approved section minutes")
        return self


class SimulationPack(MaterialPack):
    material_format: Literal["simulation-v2"]
    sections: list[SimulationSection]
    question_bank: list[SimulationExercise] = Field(default_factory=list, max_length=12)


class SimulationNode(Contract):
    status: Literal["ready", "needs_input", "blocked"]
    material: SimulationPack | None
    questions: list[str]


class DirectExercise(SimulationExercise):
    """Required generation fields; stored historical simulation packs stay compatible."""
    question_title: str = Field(min_length=1)
    question_details: list[Artifact] = Field(max_length=4)
    sample_answer: list[str] = Field(min_length=1, max_length=6)


class DirectSection(SimulationSection):
    # Alternatives belong to question_bank, never inside another plan section.
    exercises: list[DirectExercise] = Field(min_length=1, max_length=1)


class DirectPack(SimulationPack):
    sections: list[DirectSection]
    question_bank: list[DirectExercise] = Field(default_factory=list, max_length=12)


class DirectSimulationNode(SimulationNode):
    material: DirectPack | None


def render_simulation(data):
    pack = SimulationPack.model_validate({k: v for k, v in data.items() if k != "material_id"})
    lines = ["# Interview questions", "", "Simulated practice, not verified employer questions."]
    groups = [(section.section_id + " - " + str(section.minutes) + " minutes", section.exercises) for section in pack.sections]
    if pack.question_bank:
        groups.append(("More questions - alternatives within the approved plan", pack.question_bank))
    for title, exercises in groups:
        lines.extend(["", "## " + title])
        for exercise in exercises:
            if exercise.question_title:
                lines.extend(["", "### " + exercise.question_title, exercise.prompt])
            else:
                lines.extend(["", "### Scenario", exercise.scenario, "", "### Task", exercise.prompt])
            for artifact in exercise.question_details if exercise.question_details is not None else exercise.artifacts:
                lines.extend(["", "**" + artifact.label + "**"])
                lines.extend(["```", artifact.content, "```"] if artifact.format == "code" else [artifact.content])
            lines.extend(["", "### Follow-ups", *["- " + value for value in exercise.follow_ups], "", "### Method"])
            if exercise.clarifying_questions:
                lines.extend(["", "**Clarifying questions**", *["- " + value for value in exercise.clarifying_questions]])
            lines.extend(["- " + value for value in exercise.steps])
            if exercise.answer_coverage:
                lines.extend(["", "**What a strong answer covers**", *["- " + value for value in exercise.answer_coverage]])
            lines.extend(["", "### Sample answer" if exercise.sample_answer else "### Answer notes", *["- " + value for value in exercise.sample_answer or exercise.answer_points]])
            if exercise.solution:
                lines.extend(["", "```python", exercise.solution.code, "```", exercise.solution.complexity])
    return "\n".join(lines) + "\n"


GUIDANCE = """
Generate a complete interview simulation pack in material_format simulation-v2, not another preparation outline.
Every exercise needs a self-contained invented rehearsal scenario (explicitly label hypothetical setting/data), a concrete candidate task,
and supplied artifacts. Cases include a product/business setting, decision to make, metric definitions and numerical data where relevant;
give units, denominators, experiment/randomization unit, observation window and relevant data limitations. Do not ask 'analyze a case' without the case.
Coding practice includes a precise function/API contract, input/output types, worked examples with expected outputs,
boundary/invalid-input behavior and realistic junior-level size constraints. Design practice is bounded by the supported seniority.
Behavioral/introduction/motivation practice includes the actual interviewer prompt, a concrete audience/situation, supplied candidate facts,
truthful answer scaffolding and placeholders for unknown personal details. Do not fabricate the candidate's actions, metrics or motivations.
Include at least two constraints and two concrete interviewer follow-ups that extend the scenario. Include an answer approach with
substantive reasoning, edge cases and tradeoffs, self-checks, and at least three rubric criteria with strong-answer anchors and common mistakes.
All exercise timeboxes must sum to the exact approved section minutes; keep deliverables feasible. Do not add extra homework outside that budget.
Hypothetical case data is allowed only as clearly labeled practice, never company facts, candidate achievements or actual past interview questions.
Retain original evidence references. Unknown company format and interview outcomes stay unknown. No tools or outside research are authorized here.
Write concise paragraphs and bullet points, not repetitive walls of text. The reader-facing question has only Scenario, Task and Follow-ups;
the revealed answer has only Method (steps) and Sample answer (sample_answer). Populate sample_answer for every exercise with a usable
spoken response, worked decision or implementation outline, not another instruction to the candidate. For personal questions use truthful
first-person evidence plus explicit [candidate to supply] placeholders where needed. Never invent a personal motivation or result.
Prefer one combined exercise per approved section, with timebox_minutes equal to that section minutes (the rehearsal budget, not the spoken-answer length).
Scenario: one short paragraph, normally 40-70 words. Task: one or two sentences, normally under 50 words. Give two short follow-ups,
3-5 method bullets and 1-4 short sample-answer paragraphs/bullets. Do not repeat a generic hypothetical disclaimer in every field;
label the exercise's invented setting/data once, retaining specific evidence caveats when relevant.
Place supplied data and examples in artifacts without repeating them in the task. Split numbered examples onto separate lines.
Use format code for actual signatures/implementations; ordinary explanation is text. Keep inputs, expected outputs, boundary rules and data
needed to solve the question even when shortening. Keep constraints compact and avoid restating task text. Rubric, self_check and answer_points
remain internal evaluation metadata; keep them short and consistent with sample_answer rather than expanding the visible answer.
"""

DIRECT_GUIDANCE = """
The user has now refined the requested presentation. These rules supersede the earlier Scenario/Task presentation guidance:
Write the actual interview question directly in prompt, normally 1-3 sentences and under 65 words. No 'fictional interviewer',
'hypothetical rehearsal', 'the available record', round explanations, preparation instructions, or repeated caveats in the question.
The page labels the whole pack as simulated. Give a short question_title naming the problem, not the generic plan block.
Retain scenario/artifacts for internal provenance, but put ONLY essential problem inputs, example data, function signature,
constraints or necessary subquestions in question_details. For behavioral/motivation questions question_details is usually [].
Move candidate evidence, caveats, clarification guidance and 'what a strong answer covers' into the revealed answer:
clarifying_questions: 0-4 genuinely useful clarifications, answer_coverage: 3-5 specific coverage bullets,
steps: 2-4 method bullets, sample_answer: 1-3 concise paragraphs with an actual response, not instructions.
Behavioral questions ask directly for a real example, personal contribution and evidence; ask the candidate to distinguish
observed outcomes from causal impact. Never manufacture a business story, motivation or metrics for a student candidate.
An answer may truthfully state that a business-impact example is unavailable and use explicit personal-detail placeholders.
Technical open questions may use 2-3 short named subquestions inside question_details, with all coverage guidance in the answer.

For EVERY coding exercise, solution MUST contain a complete runnable Python function, not pseudocode or an explanation alone.
No imports, I/O, filesystem, environment, network, reflection or external dependencies. Use Python built-ins and normal list/dict methods.
Include at least 3 executable tests with arguments_json (JSON positional-argument array), expected_json (JSON expected result),
and expected_error (null for success, ValueError/TypeError for an expected error; use expected_json 'null' then).
Use list/tuple/int type annotations if helpful. Match the exact question's signature and invalid-input contract.
Include complexity and boundary tests. Non-coding questions use solution=null.
If the contract requires validating every input item, validate the entire input before returning an early match.
Test malformed items after an otherwise valid matching item as well as malformed first items.

Provide about 8 distinct questions TOTAL: one main exercise per approved section plus question_bank alternatives.
The main sections still allocate exactly the approved minutes. Question-bank alternatives are a MENU to substitute into the
matching existing plan section, not extra assigned homework. Each bank item MUST name its existing plan_section_id.
Keep alternatives within that section's subject and no longer than its minutes. Do not invent a new round or scope.
Recruiter rounds need a useful bank of distinct introduction, why-role, why-company, collaboration, feedback/learning,
ownership and interviewer-question variants supported by the existing plan; do not add coding when the invitation says none.
Technical rounds can add bounded problem variants within the approved scope, with concrete data and executable coding answers.
Use 2-4 follow-ups that deepen the question rather than repeat it. Prefer short paragraphs and bullets. Avoid repeating data
across prompt, question_details and follow-ups. Unknown employer questions remain unknown; generated questions are practice only.
"""
