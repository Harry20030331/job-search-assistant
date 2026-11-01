import { randomUUID } from "node:crypto";
import { matchingContext } from "../matching/matching.js";
import { workspaceMatchingPaths } from "../matching/intake.js";
import { requestWebsiteSearch, searchRefreshSnapshot, type SearchExecution } from "./searchRequests.js";

export interface SearchRefreshOptions extends SearchExecution { automatic: boolean; pausedReason?: string; pollMs?: number }
/** A service-local timer plus durable request reservations survives tabs, restarts and concurrent hosts. */
export class SearchRefreshService {
  private timer?: ReturnType<typeof setInterval>;
  private pending?: Promise<void>;
  private stopped = false;
  private error: string | null = null;
  constructor(private root: string, private repository: string, readonly options: SearchRefreshOptions) {}
  start() {
    if (this.timer || this.stopped) return;
    if (this.options.automatic && !this.options.pausedReason) {
      this.timer = setInterval(() => { void this.check("scheduled"); }, this.options.pollMs ?? 60000);
      this.timer.unref();
    }
  }
  async check(trigger: "opened" | "scheduled" = "opened") {
    if (this.stopped || !this.options.automatic || this.options.pausedReason) return;
    if (this.pending) return this.pending;
    this.pending = (async () => {
      try {
        const context = await matchingContext(workspaceMatchingPaths(this.root));
        await requestWebsiteSearch(this.root, this.repository, { requestId: randomUUID(), token: context.token }, this.options, trigger);
        this.error = null;
      } catch(error) {
        this.error = error instanceof Error && error.message === "runner_unavailable" ? "Reconnect Codex to resume automatic updates." : "Automatic update could not start. Your saved shortlist is available; try refreshing manually.";
      }
    })();
    try { await this.pending; } finally { this.pending = undefined; }
  }
  async snapshot() {
    const state = await searchRefreshSnapshot(this.root, this.options.automatic, this.options.pausedReason ?? null, (this.options.now ?? Date.now)());
    return { ...state, message: state.message ?? this.error };
  }
  async close() { this.stopped = true; if (this.timer) clearInterval(this.timer); await this.pending; }
}
