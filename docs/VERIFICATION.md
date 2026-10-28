# Verification report

Observed on **28 October 2026** in the Linux cloud workspace, with Node **24.19.0**, npm **11.9.0**, and system Chromium **154**. This report supersedes the original single-game checkpoint. The catalogue now contains 25 original, compact 2D multiplayer games; each has an authoritative simulation and a matching Phaser rendering/input path. See [GAME_CATALOGUE.md](GAME_CATALOGUE.md) for the exact implemented rules and limitations.

## Revised fidelity scope

The later requirement is exact reference fidelity, with all 25 games equally prioritized and the latest patches of the named original titles. **No game is reference-verified.** Current registry entries explicitly record `fidelity: prototype`; their playability checks below do not demonstrate replica fidelity. Reference editions/builds and usable assets remain outstanding; see [REFERENCE_TARGETS.md](REFERENCE_TARGETS.md).

For this scope/label update, strict type checking, lint, 16 catalogue/protocol tests, the production build, and direct Chromium checks of all 25 prototype badges, equal-priority presentation, fidelity notice, and selector labels passed. No page exceptions occurred. The full 151-test and 29-browser results below describe the preceding mechanics checkpoint; that full matrix was not rerun for this metadata/presentation update.

## Executed checks

| Check                                                                    | Observed result                                                       |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------- |
| `npm run typecheck`                                                      | Passed all workspaces, load tooling, and browser tests in strict mode |
| `npm run lint`                                                           | Passed                                                                |
| `npm run format:check`                                                   | Passed                                                                |
| `npm test`                                                               | **151 passed**, 11 files, no skipped tests; final run 14.87 seconds   |
| `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e` | **29 passed**, no failed/skipped tests; final full run 4.6 minutes    |
| `npm run build`                                                          | Frontend and bundled Node backend built successfully                  |
| `npm run test:load`                                                      | 2-, 4-, and 8-client probes completed with zero protocol errors       |
| `npm audit --cache /workspace/.npm-cache --audit-level=low`              | **0 known vulnerabilities** for the current lockfile                  |

No new dependencies or lockfile changes were required for this expansion. Existing pinned dependencies were reused. Native Windows 11 execution and remote GitHub Actions outcomes have not been verified here.

## Gameplay and transport evidence

The unit/rules suite covers each of the four engine families, plus the existing projectile arena. It exercises ordered race gates and laps, motorcycle combat, city checkpoints/deliveries, boosts, gravity/jumps, gallery waves/civilians/reload, cooperative wins and failed missions, tactical rounds, stealth and extraction, fighter combos/blocking, bomb chains/destructible cover, maze objectives, falling-block rotation/row clears, snake growth/body collisions, marble matching, paddle rebounds/goals, cell growth, legal dice moves/captures/exact home, pool physics/fouls/legal eight-ball finishes, hidden roles/tasks/voting, and golf turns/physics/scoring.

Motorcycle races and rooftop courses were completed with real control sequences, without teleporting to the finish. Tests also exercise input expiry/sequence ordering, role privacy, turn authorization, disconnects, forfeits, room capacities, compatibility queues, cleanup, payload/rate/origin limits, score/history filters, and shutdown.

Every one of the 25 games was exercised through real independent WebSocket connections: room creation, joining, readiness, start, input acknowledgment, state broadcast, completion, and history. Late input after completion is also tested for every game: it cannot mutate finished state or produce a spurious match error. Membership authorization and transport limits remain enforced.

The browser matrix uses independent browser contexts for each guest, including four for Hidden Signal. For each game it checks selection, private-room launch, the game-specific canvas/HUD, input acknowledged on the other browser's snapshot, consistent authoritative results, and absence of browser/protocol errors. Additional tests cover search/mobile layout, actual cross-client movement and firing, rematch/leave, public matchmaking/cancellation, invitations, and reload identity recovery. Engine tests establish rules; browser launch/control/result checks are not a claim that every strategy or every complete human-played course has been explored.

## Compiled application smoke check

Started the built Node server on loopback port 3012 with a five-second test match timer and explicit local origin. Vite and source watchers were not involved.

- Health returned HTTP 200 with `{"status":"ok","protocol":1}`.
- The frontend HTML, JavaScript, CSS, and original favicon loaded; security headers were present.
- Real browser guests publicly matched and finished **Asphalt Rivals (2 players)**, **Hidden Signal (4 players)**, and **Corner Pocket (2 players)**.
- Each game's filtered leaderboard contained its participants and history contained its completed record with the invite code redacted.
- No page exceptions occurred. SIGTERM stopped the compiled server with exit code 0.
- Seven genre-specific multiplayer screenshots were inspected: motorcycles, falling blocks, pool, dice, social deduction, gallery shooting, and fighting. Local diagnostics are ignored under `.local/`.

## Boundedness and local load observations

Every game was simulated for 16 seconds at its advertised maximum player count. Checked player values remained finite, object counts remained below 1,600, and serialized snapshots remained below 256 KiB. This checks boundedness, not sustained production capacity.

The network load utility separately exercises Prism Skirmish with about 25 input messages/second/player for four seconds per run:

| Players | Inputs | Snapshots/client | p95 local ping RTT | Whole-process CPU | RSS    | Protocol errors |
| ------- | ------ | ---------------- | ------------------ | ----------------- | ------ | --------------- |
| 2       | 196    | 49               | 2 ms               | 114 ms            | 83 MiB | 0               |
| 4       | 396    | 50               | 2 ms               | 124 ms            | 87 MiB | 0               |
| 8       | 792    | 50               | 1 ms               | 120 ms            | 89 MiB | 0               |

Server and load clients share a process, so CPU/RSS include both. These short loopback results do not certify many rooms, high latency, sustained capacity, or every engine's network cost. Simulation targets 25 Hz and broadcasts bounded full JSON snapshots at roughly 12.5 Hz. Delta compression and local movement prediction are not implemented; the renderer interpolates authoritative positions.

## Browser failures found and resolved

The first matrix was stopped after three failures and one interrupted case. React StrictMode's discarded Phaser mount left another input timer running: actual live probes measured about 50 input packets/second, triggering the unchanged server limits. Cancellable boot, explicit scene disposal, shutdown/destroy cleanup, and input listener/timer cleanup restored about 25/second with zero rate-limit errors in the same live probe. Four input regression tests also cover discarded mounts, short Space presses, outside-canvas coordinates, and listener destruction. StrictMode remains enabled.

A subsequent full browser run passed 27 cases and found two match-ending races: input already in flight could arrive after the final snapshot and produce `NO_MATCH`. The server now treats late input from an existing finished-room member as an immutable no-op. Waiting-room/nonmember input authorization and payload/rate validation are retained. The final all-game rerun passed all 29 cases with no browser exceptions, console errors, or protocol errors in the checked sessions. No assertion was disabled to hide the errors.

## Remaining limits

- These are original **2D arcade MVPs**, not licensed ports, commercial 3D recreations, full campaigns, or every variant within each genre. Per-game rules are documented explicitly.
- Windows, Edge, Firefox, real adverse-network conditions, long-running sessions, public hosting, and fresh cloud-task restoration have not been independently executed here. Chromium automation alone does not establish those outcomes.
- Rooms, queues, guest identities, roles, scores, history, and rankings are single-process in-memory data and reset on server restart. Persistent accounts, friends, achievements, tournaments, payments, databases, and multi-instance coordination remain future work.
- Keyboard and mouse are required; touch gameplay is not implemented. Hidden Signal needs at least four independent guests and uses out-of-band discussion; no in-app voice/text chat is included.
- Playwright's managed browser download was previously blocked by cloud network policy. The installed system Chromium was used with an explicit executable override; Windows can use the normal Playwright install command.
- Vite reports its standard large-chunk warning for the on-demand Phaser bundle (~1.23 MB minified / 339 KB gzip) and two upstream Zod comment-annotation warnings. Builds succeed; warnings were not hidden.
- Source publication to GitHub, the saved cloud configuration draft, cloud snapshot publication, and public application deployment are separate operations. No cloud snapshot publication or public application deployment is claimed.
