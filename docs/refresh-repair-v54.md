# Manual refresh repair v54

Maintenance date: 2026-11-02. User reported Refresh jobs disabled after preferences saved. No commit or push authorized.

The standalone preview had no `data/chat-runner.json`. Status therefore reported disconnected, but its displayed pause prioritized automatic updates being off. The button was genuinely disconnected; turning automatic updates on would not have repaired that connection.

| Before | After |
| --- | --- |
| Standalone CLI read connection from the source checkout | Resolve the selected canonical data workspace for connection and input ownership |
| Missing hosting-chat connection | Bind from hosting CODEX_THREAD_ID only when absent; preserve existing explicit bindings and exclusive file creation |
| Timer pause shown as manual blocker | Separate manualEnabled/manualBlockedReason and automaticPausedReason; legacy pausedReason carries the manual blocker |
| Preview could confuse data workspace and source directory | Pass workspaceRoot and source repositoryRoot separately |

Connections do not dispatch messages. Startup/status reads do not request research when automatic is false. Demo application tasks retain inline local execution rather than being accidentally rerouted through the new matching connection. Actual manual clicks retain durable request deduplication, current-context validation, one claim, provider/source boundaries and evidence-backed completion freshness. No new source or application authorization is granted.

584 tests across 56 files passed; TypeScript, boundary and distribution checks passed. Tests cover missing/invalid hosting chat, preserved explicit bindings, racing connection writers, canonical workspace derivation, automatic-off/manual-on status, actual intercepted manual dispatch, in-progress disabling and disconnected explanations. Existing origin, deduplication and completion checks remain. The installed CLI supports queue --resume (help inspected without sending). Actual browser verified Refresh jobs disabled=false in the preserved five-role case. No button click, queue message, Jev call or new search was performed in the current workspace.

Screenshot: `beyondautofill-refresh-ready-v54.png` in the task visualization directory. Historical manifests remain intact. Availability is not evidence of completed live matching.
