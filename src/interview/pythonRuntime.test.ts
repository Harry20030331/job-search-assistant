import { join } from "node:path";
import { expect, test } from "vitest";
import { interviewEnvironment, resolveInterviewPython } from "./pythonRuntime.mjs";

test("explicit Python selection wins and the project environment is independent of candidate cwd",()=>{
 expect(resolveInterviewPython({environment:{INTERVIEW_PYTHON:"explicit-python"},platform:"darwin",exists:()=>true})).toBe("explicit-python");
 expect(resolveInterviewPython({environment:{},platform:"darwin",exists:()=>true})).toBe(join(interviewEnvironment,"bin","python"));
 expect(resolveInterviewPython({environment:{},platform:"win32",exists:()=>true})).toBe(join(interviewEnvironment,"Scripts","python.exe"));
});
test("missing local environments use a platform command and do not silently override explicit selection",()=>{
 expect(resolveInterviewPython({environment:{},platform:"darwin",exists:()=>false})).toBe("python3");
 expect(resolveInterviewPython({environment:{},platform:"win32",exists:()=>false})).toBe("python");
 expect(resolveInterviewPython({environment:{INTERVIEW_PYTHON:"missing-explicit-python"},exists:()=>false})).toBe("missing-explicit-python");
});
