export const interviewPythonRoot: string;
export const interviewEnvironment: string;
export function resolveInterviewPython(options?: { environment?: NodeJS.ProcessEnv; platform?: NodeJS.Platform; exists?: (path: string) => boolean }): string;
export function probeInterviewPython(executable?: string): Promise<{ executable: string; available: boolean; coreReady: boolean; googleReady: boolean; missing: string[]; version: number[] }>;
