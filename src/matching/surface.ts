import { realpath } from "node:fs/promises";
import { resolveRecoveryInputs } from "../review/reviewRecovery.js";
import { startReviewServer } from "../review/reviewServer.js";

/** Serve the chosen existing workspace without example loading or port collisions. */
export async function startMatchingSurface(workspace: string) {
  const root = await realpath(workspace);
  const inputs = await resolveRecoveryInputs(root);
  const server = await startReviewServer({ ...inputs, port: 0 });
  return { server, workspace: root, statusUrl: `${server.address}/status/us`, reviewUrl: `${server.address}/review` };
}
