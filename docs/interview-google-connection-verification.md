# Google connection repair

Maintenance date: 2026-10-26. The user reported returning from Google login to a generic authorization failure.

## Observed cause and live result

The shared workbench had been launched in a network-restricted execution context. An unauthenticated HEAD request to Google's public token endpoint failed with Windows error 10013 in that context; the same request in an approved network-enabled context reached Google and returned HTTP 404. The latter is an endpoint response, not token validation. No credentials or user data were sent in these diagnostic probes.

The same local loopback service was restarted through the approved network-enabled execution path, retaining its runtime and developer client paths. The human then completed a fresh Google authorization. The real Account page displayed Connected, the selected account identity and verified requested permissions. The callback verified identity with Gmail getProfile and saved account-bound credentials privately. The screenshot is retained only in parent-workspace `runs/oauth-connection-fix-20261026/connected.jpg`; no real identity or credentials are committed here.

This confirms successful authorization and Gmail identity verification, not automatic inbox import, a selected calendar, an event write, Calendar API data access or a production login system. The connected helper remains running; restarting it clears its in-memory browser session. Saved provider grants do not automatically log another session in.

## Diagnostic and compatibility changes

Previously the callback swallowed all exceptions behind one generic message. It now records fixed failure stages and categories in the account status and private `oauth-diagnostic.json`. Categories distinguish missing permissions, expired/reused codes, client configuration, network/TLS failure, API HTTP errors and local storage errors where recognized. The private file is the last failure with a timestamp, not the current connection state. It never serializes exception text, tokens, callback codes/URLs, headers or account identity. Current status is read from the browser-bound session.

Installed oauthlib also raises a Warning when Google returns a scope superset from an earlier grant. The callback now accepts that parsed token only when all required scopes are present, retaining actual granted scopes and avoiding a second exchange of the one-use code. Partial or explicitly empty grants are rejected. No global scope-relaxation setting, extra requested permission or TLS bypass was introduced. This compatibility issue was reproduced with synthetic token data against the installed library; it was not established as the cause of the user's original failure.

## Checks

- Final targeted onboarding, workbench OAuth and Google adapter suite: 32 passed, including the portable scope-warning fixtures.
- Synthetic installed-oauthlib probe confirmed acceptance of required-scope supersets and rejection of missing access.
- Tests cover safe diagnostic serialization, one-use callbacks, browser isolation, PKCE, host/origin/CSRF checks and rejection of empty grants. Core fixtures do not require the optional Google packages.
- Existing UI v4 hashes remain unchanged. Boundary, privacy/language and whitespace checks passed. No whole-repository test result is claimed by this targeted repair.
