# Local fictional walkthrough

For the original Alex Liu profile and five saved candidate roles, use the separate [five-role demo](alex-case-demo.md). The walkthrough below is the optional single-form submission fixture.

Run `npm run demo -- --dir /tmp/job-search-demo` after installation. Use a new path for each reset. The command prints two loopback origins: the unchanged Review/Status server and a separate fictional employer form. Ports are allocated automatically, so this can coexist with an existing personal installation.

1. Open the printed form URL in Codex's in-app Browser. Read `examples/candidate.json` and the supplied resume; fill Alex Liu's name and email, attach `examples/alex-liu-resume.pdf`, and draft a short answer grounded in Study Search or the Example Labs internship. Leave relocation unknown.
2. Click **Prepare for review**. This fixture validates exact identity and PDF bytes, then publishes the actual received draft through the existing API.
3. Open the printed Review URL. Choose Yes or No for the fictional relocation question, read the answer and click Approve. During an automated smoke test the operator may choose either synthetic value; this is not authorization for any real application.
4. Return to the employer form and apply the exact selected relocation answer. Click **Submit fictional application**. Missing approval, changed prose or a mismatched choice must fail. The fixture checks the received form against approved content, verifies the desired revision, consumes the approval once, and emits a local receipt.
5. Open Status: the same role is Submitted. Review is empty; the temporary draft was pruned only after success evidence was recorded. Inspect `data/opportunities.json` and `data/demo-receipt.json` in the printed runtime directory. The receipt explicitly identifies itself as fictional.

The fixture's HTTPS example.com role URL is a record identity, not an instruction to visit that domain. Actual demo interactions use only the printed loopback form URL. This mapping is confined to demo code; production URL validation remains HTTPS-only. The local receipt is simulation evidence, never proof of an employer submission.

The form starts blank and does not generate answers or authorize itself. The source Review renderer is unchanged. This walkthrough demonstrates integration and control flow; it does not evaluate agent quality across ATS sites. Live browser connectivity and real employer session recovery remain separate concerns.

The demo command intentionally refuses an existing directory; restart from a new directory. Do not delete personal runtime data to reset a fixture.
