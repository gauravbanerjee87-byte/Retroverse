# Security and prototype limits

RetroVerse is a local guest-session MVP, not an authenticated public gaming service. No passwords, payment data, permanent accounts, or paid API keys are required. Do not interpret a username, room code, or public history query as identity proof.

## Implemented boundaries

- Strict runtime schemas validate every client message before dispatch. The protocol version and action lifecycle are checked.
- Server-issued guest identity determines room membership and host privileges; clients cannot select another member's ID to perform an action.
- Secure random room invitations and independent random resume tokens reduce guessing. Invitations grant room access; resume tokens grant temporary identity access.
- Position, hits, damage, health, scores, and winners are calculated by the authoritative server.
- WebSocket payload/connection/rate limits, heartbeat handling, bounded collections, cleanup, and slow-client/backpressure handling constrain abuse and resource use.
- Production origin checks compare the browser's `Origin` to an explicit allowlist. Configure exact scheme, hostname, and port.
- Safe client errors omit stack traces; structured server logs aid diagnosis. Avoid logging raw incoming messages or resume tokens.
- Graceful shutdown stops accepting activity and closes sockets/timers.

The current limits are:

| Resource                      | Limit                                              |
| ----------------------------- | -------------------------------------------------- |
| WebSocket payload             | 4,096 bytes; compression disabled                  |
| Handshake deadline            | 5 seconds                                          |
| Connections                   | 200 total, 16 per socket IP                        |
| Live sessions / rooms / queue | 1,000 / 100 / 200                                  |
| All messages per socket       | 60/second, burst 120                               |
| Input messages per socket     | 35/second, burst 50                                |
| Other messages per socket     | 8/second, burst 16                                 |
| API requests per socket IP    | 10/second, burst 30                                |
| Outgoing buffered bytes       | Slow sockets terminated above 262,144 bytes        |
| Invalid message strikes       | Close after 5 invalid payloads                     |
| WebSocket heartbeat           | Ping every 15 seconds; terminate missing responses |

The canonical values live in the backend source. IP limits use the direct socket address; behind a proxy, many users may share that address. A public deployment needs an explicit trusted-proxy strategy before relying on per-user IP limits. Origin checking is a browser defense, not authentication: a nonbrowser client can forge an allowed origin.

## Secrets and browser storage

`.env` is ignored; `.env.example` contains only nonsecret defaults. The prototype does not need credentials. Session resume tokens stay in tab-scoped `sessionStorage`, not URLs, long-lived local storage, or invitation links. Display preferences may use `localStorage`. An XSS vulnerability could still read a JavaScript-held token; production account sessions should instead use carefully scoped Secure/HttpOnly/SameSite cookies, server-side expiry and rotation, and CSRF protection for state-changing HTTP operations.

Never commit a real secret. Do not print tokens in logs, diagnostics, crash reports, or screenshots. A database password or future signing key belongs in the deployment provider's secret store, not source or a client-side Vite variable.

## Public release work

Before public launch, add durable account authentication/session management, abuse reporting, privacy notices, retention/deletion policies, operational alerting, authenticated account/history APIs, and security review. Apply HTTPS/WSS, an exact production origin allowlist, reverse-proxy request/connection/time limits, and a deployment firewall. Evaluate per-IP controls behind trusted proxies without trusting arbitrary `X-Forwarded-For` headers.

The in-memory prototype has no distributed rate-limit store, anti-bot system, persistent ban system, cheat-proof client, independent DDoS protection, or recoverable match state. Resume tokens are temporary credentials and are not a substitute for account security. The single-process server is not highly available.

## Dependency review

```powershell
npm audit
npm audit --omit=dev
```

Record results for the installed lockfile and date. Investigate advisories and compatible fixes; do not blindly run `npm audit fix --force`, disable TLS/signature verification, or claim a clean audit from an unexecuted command. Review [VERIFICATION.md](VERIFICATION.md) for actual observed checks.

## Content and monetization

Only original procedural/vector artwork and synthesized effects are included. Do not add proprietary ROMs, copied characters, music, maps, or trademarks without a verified license. Monetization, ads, subscriptions, and purchases are outside the MVP; a future Indian public launch needs appropriate privacy, consumer, taxation, and age-related legal review.
