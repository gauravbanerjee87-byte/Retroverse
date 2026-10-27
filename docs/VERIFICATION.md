# Verification report

Observed on 27 October 2026 in the Linux cloud workspace `/workspace/Retroverse`, using Node **24.19.0**, npm **11.9.0**, and system Chromium **154.0.8037.57**. This verifies the local guest-session development workflow. It does not establish native Windows execution, public-launch security, publication, or fresh-task restoration.

## Executed checks

| Check                                                                    | Observed result                                                                      |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| `npm ci --cache /workspace/.npm-cache --no-fund --no-audit`              | Clean lockfile install succeeded: 220 packages; no manifest/lockfile repair required |
| `npm run typecheck`                                                      | Passed all workspaces, tooling, load utility, and browser tests in strict mode       |
| `npm run lint`                                                           | Passed                                                                               |
| `npm run format:check`                                                   | Passed                                                                               |
| `npm test`                                                               | **34 passed**, 4 files, no failed/skipped tests; final run 2.72 seconds              |
| `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e` | **4 passed**, no failed/skipped tests; final run 26.5 seconds                        |
| `npm run build`                                                          | React/Vite frontend and esbuild Node backend both built successfully                 |
| `npm run test:load`                                                      | 2-, 4-, and 8-client runs completed with zero protocol errors                        |
| `npm audit --cache /workspace/.npm-cache --audit-level=low`              | **0 known vulnerabilities** for this lockfile at verification time                   |

Browser tests use independent contexts, not shared in-memory client objects. They cover homepage/library search and honest planned-game labels, mobile layout, private create/join/readiness/start, movement observed by the other browser, projectile synchronization, server-timed completion/results, rematch/leave, public cancellation/pairing/completion, invitation URL joining, and reload reconnection into the same guest identity and room. The final run asserted no browser page exceptions or console errors.

Unit and real-WebSocket integration tests cover schemas, room code generation, membership/capacity/host authorization, duplicate queues and cancellation, disconnected/expired sessions, room expiry and empty cleanup, stale inputs, boundaries/cover/projectiles, damage/scoring/respawn/winners, malformed/binary/oversize messages, rate/connection limits, origin checks, session takeover, private-code redaction, and graceful shutdown.

## Compiled application smoke check

Started the built `apps/server/dist/index.js` directly on loopback port 3012 in local development security mode, with a five-second match duration and that exact origin allowlisted. This used the built assets, without Vite or source watchers.

- Health returned HTTP 200 and `{"status":"ok","protocol":1}`.
- The frontend document, JavaScript, CSS, and original favicon loaded successfully; security headers were present.
- Two independent Chromium guests joined public matchmaking and finished an actual game.
- The leaderboard contained both participants; history contained one completed match with the invitation code redacted.
- Both guests' profile pages displayed their own completed match.
- No page exceptions occurred. SIGTERM stopped the compiled server with exit code 0.

Desktop (1440 pixels wide) and mobile (390 pixels wide) homepage screenshots were also inspected. Local screenshots and the smoke result are under ignored `.local/`; they are not required source files.

## Measured local workload

Each run sent roughly 25 input messages/second/player for four seconds in one room. Every client received 50 snapshots (~12.5/second).

| Players | Inputs | Received bytes, all clients | p95 local ping RTT | Process CPU | RSS    | Protocol errors |
| ------- | ------ | --------------------------- | ------------------ | ----------- | ------ | --------------- |
| 2       | 198    | 129,317                     | 1 ms               | 117 ms      | 80 MiB | 0               |
| 4       | 396    | 532,594                     | 1 ms               | 154 ms      | 86 MiB | 0               |
| 8       | 792    | 1,998,556                   | 3 ms               | 140 ms      | 88 MiB | 0               |

Server and load clients share a process, so CPU and memory include both. These short loopback runs do not certify sustained capacity, remote latency, many rooms, or thousands of users. Simulation targets 25 Hz; bounded full JSON snapshots broadcast every second simulation tick. Delta compression and local movement prediction are not implemented. Remote rendering interpolates authoritative state.

## Phase checkpoints

1. **Foundation:** npm workspaces, strict TypeScript, shared schemas/registry, config/logging, and health endpoint implemented; shared compilation and 12 shared tests passed.
2. **Multiplayer infrastructure:** real WebSockets, guest resume, private rooms, FIFO public queue, validation/limits, and cleanup implemented; real-socket integration suite passed.
3. **First playable game:** authoritative Neon Arena plus Phaser Canvas rendering/input, damage, respawn, timer, winners, sounds, and rematch implemented; 8 simulation tests and two-browser gameplay checks passed.
4. **Frontend:** all MVP routes, searchable/filterable library, invitations/lobbies, queue, game HUD/results, guest profile/history/leaderboard/settings, responsive layout, error states, and keyboard focus implemented; browser journeys passed.
5. **Quality:** 34 unit/integration tests and 4 browser tests passed; type/lint/format/audit/load/build checks passed. Review findings were corrected and rechecked.
6. **Documentation and release preparation:** Windows/architecture/protocol/network/security/testing/deployment/troubleshooting/future-persistence guides and compiled build completed. Reusable cloud `install_script`, `start_skill`, and the actual checkout declaration were saved as a configuration draft. The user still needs to review/save environment settings and publish; neither operation is claimed completed.

## Resolved setup and review findings

- npm's original cache location was unwritable; using `/workspace/.npm-cache` fixed installation without weakening verification.
- The first chosen Vite/Vitest tooling versions had advisories. Compatible updates removed all reported advisories. ESLint was updated to its supported major.
- The initial backend bundler CLI failed. A small direct esbuild script replaced it, also removing a deprecated transitive build dependency. The corrected build and compiled startup passed.
- Review found malformed upgrade requests leaking connection capacity and public history revealing private invite codes. Both were fixed and regression-tested.
- Reconnect handling now clears stale views and stops takeover retry loops. A missing favicon caused browser console 404s during stricter checks; the original local favicon fixed them and the final suite passed without errors.

## Remaining limitations and next work

- Native Windows 11, Edge, Firefox, long-running sessions, adverse network conditions, and public-host deployment have **not** been executed here. A Windows/Ubuntu CI workflow is supplied but has not run remotely.
- Playwright's managed browser download returned HTTP 403 (`Domain forbidden`) from `cdn.playwright.dev`. Existing system Chromium was used successfully. On Windows, install the normal Playwright browser as documented; the system-browser override is optional.
- Vite reports its standard large-chunk warning for the lazy-loaded Phaser game bundle (~1.22 MB minified / 337 KB gzip). The game loads on demand. Zod also emits two upstream comment-annotation warnings; the build completes. No warnings were hidden.
- Rooms, queues, guest identities, history, and leaderboards are bounded, single-process, in-memory data and reset on server restart. Permanent accounts, friends, achievements, tournaments, monetization, databases, touch gameplay, and distributed hosting are future work. Only Neon Arena is playable.
- Explicitly leaving a game forfeits winner eligibility but retains the participant's result in history. Disconnects reserve membership for 15 seconds; server restart cannot recover it.
- Generated source remains local and uncommitted in the originally empty repository. Nothing was pushed to GitHub or deployed. Export the prepared source archive or review and commit/push the project before expecting a remote clone to contain it.

The next implementation phase is native Windows acceptance and sustained/network-condition testing, followed by durable authentication and persistence before a public release. See `SECURITY.md` and `PERSISTENCE.md` for that boundary.
