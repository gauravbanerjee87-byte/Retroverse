# Testing

Run commands from the repository root with the supported Node/npm versions. Install dependencies with `npm ci`. The expanded catalogue has 25 registered authoritative 2D engines. Metadata alone is not validation; test each game's actual mechanics and room path. Test results are recorded in [VERIFICATION.md](VERIFICATION.md); a command listed here is not a claim that it passed.

A GitHub Actions matrix is configured in `.github/workflows/ci.yml` for Ubuntu and Windows with Node 24. A workflow file is not an executed CI result; it will run only after source is pushed and the workflow is enabled.

## Static and deterministic checks

```powershell
npm run typecheck
npm run lint
npm run format:check
npm test
```

Type checking covers web, server, and shared contracts in strict mode. Vitest discovers `apps/**/*.test.ts` and `packages/**/*.test.ts`; tests should cover validation, room membership/capacity/lifecycle, game-aware queue uniqueness/cancellation, min/max player limits, engine-specific objectives/actions, simulation movement/collision/damage/scoring, timer completion, stale input, limits, and cleanup. Family suites cover racing/platforming, action, casual, and tabletop/social rules; shared registry tests check unique names/IDs and engine coverage. WebSocket integration tests use separate `ws` connections to a real ephemeral server and must close all sockets and timers.

## Browser multiplayer

```powershell
npx playwright install chromium
npm run test:e2e
```

Playwright installs a browser separately from npm packages. The runner starts the application with its test configuration. Stop other processes using its ports before testing. Each multiplayer participant must use an independent browser context; two pages sharing a guest session are not two independent players. Tests exercise the homepage/library, room creation and invitation, readiness, game launch and state synchronization, public matching, completion, and return navigation according to the implemented suite. The all-games browser suite is a launch/render/lifecycle check; it does not by itself prove that every objective can be completed through human input. Keep detailed mechanic tests and browser smoke coverage distinct.

A meaningful synchronization assertion observes behavior or changing authoritative state on both clients, rather than merely finding a canvas. A meaningful finish assertion verifies results from a completed match. Keep test-only shortened match durations in runner configuration, never disable production assertions to make tests pass.

On Linux CI, Playwright may require system browser libraries (`npx playwright install --with-deps chromium` with suitable package-manager permission). Windows normally needs only the regular browser install command. A browser download or host-library failure is an environment blocker, not a passing browser suite. Chrome, Edge, and Firefox compatibility should be reported separately; Chromium tests alone do not establish all-browser support.

## Load probe

```powershell
npm run test:load
```

The utility starts its own ephemeral local server and opens real WebSocket clients for 2-, 4-, and 8-player runs, each with four seconds of 25 Hz input. It records snapshot counts, received bytes, local ping RTT, process CPU, and RSS. Server and simulated clients run in the same process, so CPU/RSS include both. The existing probe targets the original projectile arena, not every new game. Large tile/board snapshots need separate game-specific measurement before broad throughput claims. It is a development probe, not a production capacity certification. Run increasing client counts on the intended host, record duration and resource usage, and test through the real TLS/proxy path before setting public capacity. Do not extrapolate a local short run to thousands of concurrent players.

## Compiled-application smoke check

```powershell
npm run build
$env:NODE_ENV = 'development'
$env:WEB_ORIGINS = 'http://localhost:3001,http://127.0.0.1:3001'
npm start
```

In another window, call `Invoke-RestMethod http://localhost:3001/api/health`, open the built frontend at `http://localhost:3001`, and exercise a two-browser match. Stop the server with Ctrl+C and confirm its port is released. Restore development shell variables afterward as described in the README.

Windows, mobile layout, touch controls, browser-family compatibility, reconnect under real network loss, long-running memory use, and public-host performance require their own evidence. Touch gameplay is outside current scope. Never report skipped, unrun, expected-failure, or zero-test runs as passed.
