import { readChatTaskConfig } from "../review/chatTaskBridge.js";
import { z } from "zod";
import { interviewRequestHistory, requestInterviewWork } from "../workbench/interviewRequests.js";
import { linkDemoInterview, readInterviewBoard, type WorkbenchPaths } from "./workbench.js";

/** One button starts one source-bound fictional preparation request in the owning chat. */
export async function startDemoInterviewPreparation(paths: WorkbenchPaths, root: string, repository: string, input: unknown) {
  // Fail before creating a round when there is no executor to continue the workflow.
  if (!await readChatTaskConfig(root)) throw new Error("runner_unavailable");
  const requestId = z.object({ taskId: z.string().uuid() }).passthrough().parse(input).taskId;
  const history = await interviewRequestHistory(root);
  if (!history.some(item => item.requestId === requestId) && history.some(item => ["pending_delivery", "delivered", "running"].includes(item.state))) {
    throw new Error("task_already_active");
  }
  const result = await linkDemoInterview(paths, input);
  const board = await readInterviewBoard(paths);
  const entry = board.find(item => item.entry.interviewId === result.interviewId)?.entry;
  if (!entry?.demoSubmission) throw new Error("demo_interview_changed");
  if (entry.workspace) return result; // Never replace an existing plan or its approval.
  // The completed submission task is a UUID and uniquely identifies this simulated round.
  await requestInterviewWork(root, repository, {
    requestId, action: "preparation", applicationId: result.applicationId, interviewId: result.interviewId,
    message: "Prepare a 60-minute Plan for this fictional early-career interview. Cover introductions and motivation, project stories, relevant technical practice, and questions to ask. The interview round, date and interviewer are unknown. Use the saved example only. Show the Plan for review; generate Practice only after approval of the current Plan."
  }, "demo");
  return { ...result, preparationRequestId: requestId };
}
