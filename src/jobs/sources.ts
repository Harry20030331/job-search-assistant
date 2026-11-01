/** Actual discovery provenance, independent of job direction or approved resume profile. */
export const jobSources = ["simplify-new-grad", "speedyapply-2027-ai", "speedyapply-2027-swe", "user-provided", "official-careers"] as const;

/** Current website discovery boundary; historical source IDs above remain readable. */
export const websiteDiscoveryScope = {
  cohort: "new-grad",
  source: "simplify-new-grad",
  repositoryUrl: "https://github.com/SimplifyJobs/New-Grad-Positions",
  productManagementUrl: "https://github.com/SimplifyJobs/New-Grad-Positions#-product-management-new-grad-roles",
  allowOpenWebSearch: false
} as const;
