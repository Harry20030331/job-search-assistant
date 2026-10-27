"""Bounded checks for dependency-free Python interview answers, not a general code runner."""
import ast
import json
import subprocess
import sys

BUILTINS = {"len", "min", "max", "sorted", "range", "enumerate", "zip", "reversed", "list", "tuple", "dict", "set",
            "int", "float", "bool", "str", "abs", "sum", "any", "all", "isinstance", "ValueError", "TypeError"}
METHODS = {"append", "extend", "sort", "copy", "pop", "items", "keys", "values", "add", "remove", "discard", "get"}


def validate_code(code, function_name):
    try:
        tree = ast.parse(code)
    except SyntaxError as error:
        raise ValueError("Coding answer is not valid Python") from error
    functions = {node.name for node in ast.walk(tree) if isinstance(node, ast.FunctionDef)}
    if function_name not in functions:
        raise ValueError("Coding answer omits its declared function")
    forbidden = (ast.Import, ast.ImportFrom, ast.Global, ast.Nonlocal, ast.ClassDef, ast.With, ast.AsyncFunctionDef,
                 ast.Await, ast.Yield, ast.YieldFrom)
    for node in ast.walk(tree):
        if isinstance(node, forbidden):
            raise ValueError("Coding answer uses an unsupported construct")
        if isinstance(node, ast.Name) and node.id.startswith("__"):
            raise ValueError("Coding answer uses a reserved name")
        if isinstance(node, ast.Attribute) and node.attr not in METHODS:
            raise ValueError("Coding answer uses an unsupported attribute")
        if isinstance(node, ast.Call):
            if isinstance(node.func, ast.Name) and node.func.id not in BUILTINS | functions:
                raise ValueError("Coding answer calls an unsupported function")
            if not isinstance(node.func, (ast.Name, ast.Attribute)):
                raise ValueError("Coding answer uses an indirect call")
    compile(tree, "<interview-answer>", "exec")


WORKER = r'''
import builtins, json, sys
payload = json.load(sys.stdin)
allowed = {name: getattr(builtins, name) for name in payload["builtins"]}
scope = {"__builtins__": allowed}
exec(compile(payload["code"], "<interview-answer>", "exec"), scope)
results = []
for test in payload["tests"]:
    try:
        actual = scope[payload["function_name"]](*test["arguments"])
        actual = json.loads(json.dumps(actual))
        passed = not test["expected_error"] and actual == test["expected"]
    except (ValueError, TypeError) as error:
        passed = type(error).__name__ == test["expected_error"]
    results.append(passed)
print(json.dumps({"passed": all(results), "tests": len(results), "results": results}))
'''


def check_solution(solution, extra_tests=()):
    validate_code(solution.code, solution.function_name)
    tests = []
    for test in solution.tests:
        arguments, expected = json.loads(test.arguments_json), json.loads(test.expected_json)
        if not isinstance(arguments, list):
            raise ValueError("Coding test arguments must be a JSON array")
        tests.append({"arguments": arguments, "expected": expected, "expected_error": test.expected_error})
    tests.extend(extra_tests)
    payload = {"code": solution.code, "function_name": solution.function_name, "builtins": sorted(BUILTINS), "tests": tests}
    try:
        result = subprocess.run([sys.executable, "-I", "-S", "-c", WORKER], input=json.dumps(payload), text=True,
                                capture_output=True, timeout=3, encoding="utf-8")
    except subprocess.TimeoutExpired as error:
        raise ValueError("Coding answer exceeded its test time limit") from error
    if result.returncode or not result.stdout:
        raise ValueError("Coding answer failed bounded execution")
    report = json.loads(result.stdout)
    if not report["passed"]:
        raise ValueError("Coding answer failed its declared examples or boundary tests")
    return report


def check_direct_pack(pack, section_minutes):
    main = [exercise for section in pack.sections for exercise in section.exercises]
    if len(main) + len(pack.question_bank) < 6:
        raise ValueError("Direct practice requires at least six distinct main/alternative questions")
    reports = []
    for exercise in main + pack.question_bank:
        if not exercise.question_title or exercise.question_details is None or not exercise.sample_answer:
            raise ValueError("Direct question omits its title, problem details or sample answer")
        if exercise in pack.question_bank:
            if exercise.plan_section_id not in section_minutes or exercise.timebox_minutes > section_minutes[exercise.plan_section_id]:
                raise ValueError("Alternative question must fit an existing approved plan section")
        if exercise.exercise_type == "coding":
            if exercise.solution is None:
                raise ValueError("Coding questions require a complete executable answer")
            reports.append({"question": exercise.question_title, **check_solution(exercise.solution)})
    return {"questions": len(main) + len(pack.question_bank), "coding": reports,
            "scope": "Bounded dependency-free Python examples; not a security sandbox or a proof of correctness."}
