"""Shared, evidence-limited topic normalization for new and historical memory.

Read-time views never migrate records or infer ability. Generic evaluation is not
an alias for experimentation: only the selected observation can refine it.
"""
from __future__ import annotations

import re

POLICY = "memory-topics-v1"
ALIASES = {
    "a/b testing": "experimentation", "a/b test": "experimentation",
    "ab_testing": "experimentation", "ab_test": "experimentation",
    "experiment_design": "experimentation", "experimental_design": "experimentation",
    "randomization_unit": "experimentation", "randomisation_unit": "experimentation",
    "product_metric": "product_metrics",
    "model_evaluation": "ml_evaluation", "llm_evaluation": "ml_evaluation",
    "machine_learning_evaluation": "ml_evaluation",
    "capacity": "capacity_estimation", "capacity_estimation": "capacity_estimation",
}
PATTERNS = {
    "experimentation": re.compile(
        r"\b(?:a\s*/\s*b\s+test(?:ing|s)?|ab[_ -]test(?:ing|s)?|"
        r"randomi[sz]ation\s+unit|network\s+interference|treatment\s+assignment|"
        r"sample[ -]ratio\s+mismatch|randomi[sz]ed\s+controlled\s+(?:trial|experiment))\b", re.I),
    "product_metrics": re.compile(
        r"\b(?:(?:product|business)\s+metrics?|north[ -]star\s+metric|"
        r"(?:activation|retention|conversion)\s+(?:rates?|metrics?|definitions?|denominators?))\b", re.I),
    "ml_evaluation": re.compile(
        r"\b(?:hallucinations?|citation\s+(?:precision|recall|support)|"
        r"(?:llm|model|classifier|classification)\s+evaluation)\b", re.I),
}


def normalize_topic(value: str) -> str:
    label = value.strip().lower()
    label = ALIASES.get(label, re.sub(r"[\s-]+", "_", label))
    return ALIASES.get(label, label)


def canonical_topics(values) -> set[str]:
    return {normalize_topic(value) for value in values if value.strip()}


def observation_topics(values, observation: str = "") -> set[str]:
    """Refine only a broad evaluation tag from this observation, never advice/history."""
    topics = canonical_topics(values)
    if "evaluation" in topics:
        topics.update(topic for topic, pattern in PATTERNS.items() if pattern.search(observation))
    return topics


def memory_topics(note) -> set[str]:
    return observation_topics(note["topics"], note.get("observation", ""))


def revision_matches(incoming: set[str], previous: set[str]) -> bool:
    # Explicit domain evidence prevents the shared generic label from connecting
    # different issues. A genuinely generic correction retains legacy behavior.
    specific_new, specific_old = incoming - {"evaluation"}, previous - {"evaluation"}
    if specific_new and specific_old:
        return bool(specific_new & specific_old)
    return bool(incoming & previous)
