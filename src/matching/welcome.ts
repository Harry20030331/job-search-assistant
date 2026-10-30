/** Read-only first-contact message; no candidate is selected or initialized. */
export const matchingWelcome = `Welcome to Job Search Assistant!

I can help you set up your background and preferences, find relevant jobs, and refine the shortlist based on your feedback.

How would you like to begin?
1. Set up a new candidate
2. Continue an existing search
3. Try the fictional example

Reply with a number or describe what you need. I will guide you here in chat and open the results page when it is ready.`;

export const backgroundSourcePrompt = `Let's set up your profile.

You can share any of the following here:
- A LinkedIn profile URL
- A resume or background document (PDF, DOCX, TXT, or Markdown)
- Pasted text describing your education, experience, and skills

You can combine sources or simply tell me about yourself. I will review what you provide, ask only for missing details and job preferences, and show you a summary to confirm before saving.`;
