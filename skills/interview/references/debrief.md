# Debrief mode

Collect the user's original account of what happened, including approximate occurrence time and whether this was an interview or practice. Keep the historical role/company/round separate from the upcoming interview. Unknown company and round remain null. Do not invent scores, interviewer feedback or lasting ability changes.

The account-level coordinator currently owns the durable raw-history and derived-memory flow. Use its explicitly selected account, with the original text and historical subject saved in private files:

```text
npm run interview:coordinator -- debrief --user-key <selected-key> --text <absolute-original-text-file> --subject <absolute-historical-subject-json> --record-id <stable-new-record-id> --interview-id <historical-interview-id> --occurred-at <actual-ISO-time> --mode <interview-or-practice> --origin human_current_chat --output <absolute-new-node-output>
```

Subject JSON has `company`, `role` and `round`; role must be established from user evidence, and company/round may be null. Preserve the record ID on a retry so the same debrief is not appended twice. Raw text is saved before the model node. Label self-assessment, user-reported events and reported interviewer feedback distinctly; system suggestions belong only in suggested practice.

Corrections and improvement reports revise derived memory through source-linked versions while preserving the original record. A later plan should use relevant active observations and avoid treating resolved or unrelated issues as present weaknesses. Self-reported improvement is limited to its reported context.

Shared-input preparation starts without account learning. For later reuse, read [candidate learning](../../../docs/interview-learning.md): establish the actual candidate/account relationship in chat, then use host-only `interview:learning bind` and `attach` before enrichment/context capture. Build the scope from this interview's actual role/round/topics; do not ask the user to construct tool JSON. Never match accounts by candidate name or copy an entire learning database. Preserve historical subject, original text and self-report attribution in the selected practice sources. A changed/corrected debrief or revoked binding requires a fresh context and exact new plan acceptance. Synthetic fixtures must use `synthetic_test_script`. Standalone captured contexts do not establish live account identity or freshness.
