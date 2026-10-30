# Scheduling mode

Read `../../../docs/interview.md` for live setup versus local staging. A staged preparation workspace has no live Google backend. Do not present a simulated SQLite event as a Google Calendar event.

Use an existing explicitly selected test-account connection. On the shared workbench open Google account (`/settings/accounts`) and Connect Google; the developer configures the private client path once with `--google-root`. The standalone fallback is `npm run interview:connect -- --port 8766` when developer configuration already exists. The human chooses the account and grants access on Google's page. Do not ask for passwords, tokens or repeated Cloud setup. Connecting does not select a calendar, bind a candidate/account, start polling or authorize writes.

For an already configured account, host commands include:

```text
npm run interview:inbox -- status --user-key <selected-key>
npm run interview:inbox -- sync --user-key <selected-key>
npm run interview:inbox -- classify --user-key <selected-key> --message-id <selected-id> --attempts <absolute-attempt-dir>
npm run interview:inbox -- propose --user-key <selected-key> --handoff-id <selected-handoff> --live-run <absolute-new-run>
```

Sync reads Google message IDs/state; classification and proposal may invoke a model. A bounded `poll` is an explicit host operation, not an installed continuous monitor. Match account, opportunity, interview round and latest thread evidence before scheduling. Cancellation/logistics routes that remain manual must be surfaced as such.

Read availability and existing events; preserve identity when processing duplicates or rescheduling. Show the exact title, date, start/end, IANA timezone and reminders. After actual confirmation of that current action, the host records it:

```text
npm run interview:google -- confirm --workspace <absolute-google-workspace> --action <absolute-current-action-json>
```

This records confirmation, not the calendar write itself. Use the staged TOOL_GUIDE's `calendar.create` or `calendar.update` through `interview:tools`, with the returned confirmation ID. The adapter checks current state and verifies the result. Report success only after read-back. Keep uncertainty explicit; do not blindly retry an uncertain external write. No mail sending or attendee invitations are implemented.
