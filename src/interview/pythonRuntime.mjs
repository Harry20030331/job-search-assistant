import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

export const interviewPythonRoot = fileURLToPath(new URL("./python/", import.meta.url));
export const interviewEnvironment = join(interviewPythonRoot, ".venv");
/** Resolve from the source installation, never the candidate's working directory. */
export function resolveInterviewPython({ environment = process.env, platform = process.platform, exists = existsSync } = {}) {
  if (environment.INTERVIEW_PYTHON?.trim()) return environment.INTERVIEW_PYTHON.trim();
  const local = platform === "win32" ? join(interviewEnvironment, "Scripts", "python.exe") : join(interviewEnvironment, "bin", "python");
  if (exists(local)) return local;
  return platform === "win32" ? "python" : "python3";
}
export async function probeInterviewPython(executable = resolveInterviewPython()) {
  const required = Object.fromEntries(readFileSync(join(interviewPythonRoot, "requirements.lock"), "utf8").split(/\r?\n/).flatMap(line => {
    const match = /^([A-Za-z0-9_-]+)==([^\s]+)$/.exec(line.trim());
    return match ? [[match[1], match[2]]] : [];
  }));
  const script = `import importlib.util,importlib.metadata,json,sys\nrequired=json.loads(sys.argv[1])\nmissing=[]\nfor name,expected in required.items():\n try:\n  actual=importlib.metadata.version(name)\n  if actual != expected: missing.append(name+'=='+expected+' (installed '+actual+')')\n except importlib.metadata.PackageNotFoundError: missing.append(name+'=='+expected)\noptional=['googleapiclient','google_auth_oauthlib']\nprint(json.dumps({'version':list(sys.version_info[:3]),'coreReady':sys.version_info >= (3,12) and not missing,'missing':missing,'googleReady':all(importlib.util.find_spec(name) is not None for name in optional)}))`;
  try {
    const { stdout } = await promisify(execFile)(executable, ["-c", script, JSON.stringify(required)], { timeout: 10000, maxBuffer: 16000, env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" } });
    return { executable, ...JSON.parse(stdout), available: true };
  } catch { return { executable, available: false, coreReady: false, googleReady: false, missing: [], version: [] }; }
}
