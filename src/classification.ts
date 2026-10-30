import { z } from "zod";

/** User-configured job direction. Legacy category keys remain valid direction values. */
export const jobDirectionSchema = z.string().trim().min(1).max(120).refine(value => !/[\u0000-\u001f\u007f]/.test(value), "invalid_job_direction");
export type JobDirection = z.infer<typeof jobDirectionSchema>;

/** An explicit key in the selected approved-resume manifest, not a job taxonomy. */
export const resumeCategorySchema = z.string().regex(/^[a-z][a-z0-9_-]{0,63}$/);
export type ResumeCategory = z.infer<typeof resumeCategorySchema>;

// Read compatibility only: older applications inherited these keys from their job.
export const legacyResumeCategories = ["llm", "robotics", "recommendation"] as const;
export function isLegacyResumeCategory(value: string): boolean {
  return (legacyResumeCategories as readonly string[]).includes(value);
}
