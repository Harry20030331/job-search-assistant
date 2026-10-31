import unittest

from interview.practice import CodingSolution
from interview.practice_code import check_solution, validate_code


def solution(code="def double(n):\n    return n * 2"):
    return CodingSolution(language="python", function_name="double", code=code,
        complexity="O(1) time and space.", tests=[
            {"arguments_json": "[2]", "expected_json": "4", "expected_error": None},
            {"arguments_json": "[0]", "expected_json": "0", "expected_error": None},
            {"arguments_json": "[-1]", "expected_json": "-2", "expected_error": None}])


class PracticeCodeTests(unittest.TestCase):
    def test_actual_python_answer_runs_declared_and_independent_cases(self):
        report = check_solution(solution(), [{"arguments": [123], "expected": 246, "expected_error": None}])
        self.assertTrue(report["passed"])
        self.assertEqual(report["tests"], 4)

    def test_wrong_answers_and_pseudocode_do_not_pass(self):
        with self.assertRaisesRegex(ValueError, "failed its declared"):
            check_solution(solution("def double(n):\n    return n + 2"))
        with self.assertRaisesRegex(ValueError, "not valid Python"):
            validate_code("def double(n):\n    return ???", "double")

    def test_imports_io_reflection_and_indirect_calls_are_rejected(self):
        for code in ("import os\ndef double(n): return n * 2", "def double(n): return open('private')",
                     "def double(n): return n.__class__", "def double(n): return (lambda: 4)()",
                     "def double(n): return type(n)"):
            with self.assertRaises(ValueError):
                validate_code(code, "double")

    def test_actor_contract_lists_the_same_bounded_execution_operations(self):
        from interview.practice import DIRECT_GUIDANCE
        from interview.practice_code import BUILTINS, METHODS
        self.assertIn("Allowed callable built-ins (exact names): " + ", ".join(sorted(BUILTINS)), DIRECT_GUIDANCE)
        self.assertIn("Allowed attribute methods (exact names): " + ", ".join(sorted(METHODS)), DIRECT_GUIDANCE)
        # Preserve the boundary that rejected the first Alex demo attempt.
        with self.assertRaisesRegex(ValueError, "unsupported attribute"):
            validate_code("def prefix(word): return word.startswith('a')", "prefix")


if __name__ == "__main__": unittest.main()
