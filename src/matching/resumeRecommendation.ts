import { z } from "zod";
import { resumeCategorySchema } from "../classification.js";

/** Matching owns this suggestion; a started application's binding remains Submission-owned. */
export const resumeRecommendationSchema = z.object({
  profileKey: resumeCategorySchema.nullable(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/i).nullable(),
  status: z.enum(["matched", "needs_review", "no_match", "no_resumes"]),
  confidence: z.number().finite().min(0).max(1),
  contextToken: z.string().min(1),
  evaluatedAt: z.string().datetime()
}).strict().refine(value => value.status !== "matched" || (value.profileKey !== null && value.sha256 !== null));
export type ResumeRecommendation = z.infer<typeof resumeRecommendationSchema>;
