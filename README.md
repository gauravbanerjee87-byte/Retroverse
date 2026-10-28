# RetroVerse

An original browser arcade with **25 playable, server-authoritative 2D multiplayer prototypes**. Race motorcycles in **Asphalt Rivals**, compete across puzzle and party games, or jump into **Prism Skirmish** combat. Create a private room, invite independent guests, ready up, and start a match. Public matchmaking groups compatible guests by game, with two players for most games and four for Hidden Signal. Profiles, match history, and leaderboards reflect this server session; they are not persistent accounts.

RetroVerse uses React, TypeScript, Vite, Phaser 3, Node.js, `ws`, Zod, Vitest, and Playwright. It needs no database, Docker, WSL, paid API, or cloud service for local development. The catalogue connects 25 original titles to authoritative 2D game engines across racing, action, puzzle, sports, board, and social play. Artwork is procedural/vector-based and sound effects are synthesized. These are compact original arcade games, not licensed ports or recreations of commercial 3D games. Read [the game catalogue](docs/GAME_CATALOGUE.md) for each game's rules, controls, player count, and implementation limits.

The requested next standard is faithful recreation of the specifically named titles at their latest patches, with all 25 games equally prioritized. **The current prototypes do not meet that visual-fidelity standard.** See [reference targets and outstanding inputs](docs/REFERENCE_TARGETS.md).

## Quick start on Windows 11

The source is available on GitHub on the `main` branch. Install Node.js **24 LTS** (minimum 22.12), reopen PowerShell, and clone into a fresh directory:

```powershell
New-Item -ItemType Directory -Force D:\tools | Out-Null
Set-Location D:\tools
git clone --branch main https://github.com/gauravbanerjee87-byte/Retroverse.git retroverse
Set-Location D:\tools\retroverse
npm ci
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
npm run dev
```

Alternatively, use GitHub's **Code → Download ZIP** and extract the folder so its `package.json` is directly inside `D:\tools\retroverse`. npm 10 or newer is required. Preserve any existing local configuration.

Open **http://localhost:5173**. The backend health endpoint is **http://localhost:3001/api/health**. The Vite development server proxies `/api` and `/ws` to the backend; both processes start with `npm run dev` and stop with Ctrl+C.

Choose a game from the library, create its room in one browser, and open its invitation in a separate browser or private window. Each participant must choose Ready before the host starts. Most games need at least two players; Hidden Signal needs four. Capacity and controls follow the selected game, and entering a code joins that room's game automatically. Public matchmaking groups guests only with others queuing for the same game/mode.

Common inputs are WASD/arrows, mouse aim, and click or Space for the primary action, but rules differ: falling blocks rotate/drop, paddle play uses vertical movement, dice and social voting use action buttons, and pool/golf use pointer distance for shot power. Follow the game details and live in-game hints. Escape opens the local settings overlay; it does not pause the server. Desktop keyboard/mouse gameplay is supported; the website adapts to mobile screens without claiming touch gameplay.

## Commands

Run these from the repository root:

| Command                           | Purpose                                              |
| --------------------------------- | ---------------------------------------------------- |
| `npm run dev`                     | Start Vite and the authoritative game server         |
| `npm run typecheck`               | Check all three workspaces in strict TypeScript mode |
| `npm run lint`                    | Run ESLint                                           |
| `npm run format:check`            | Check formatting                                     |
| `npm run format`                  | Apply Prettier formatting                            |
| `npm test`                        | Run Vitest unit and WebSocket integration tests      |
| `npx playwright install chromium` | Install the browser used by end-to-end tests         |
| `npm run test:e2e`                | Run independent-browser multiplayer tests            |
| `npm run test:load`               | Run the local WebSocket load probe                   |
| `npm run build`                   | Build the web app and backend                        |
| `npm start`                       | Run the built backend, serving the built frontend    |
| `npm audit`                       | Inspect current dependency advisories                |

To smoke-test the compiled application locally:

```powershell
npm run build
$env:NODE_ENV = 'development'
$env:WEB_ORIGINS = 'http://localhost:3001,http://127.0.0.1:3001'
npm start
```

Open **http://localhost:3001**. Stop the server before returning to development, then clear these session overrides with `Remove-Item Env:NODE_ENV, Env:WEB_ORIGINS -ErrorAction SilentlyContinue`. This local HTTP smoke test uses development security mode. Public production mode requires `NODE_ENV=production`, HTTPS origins in `WEB_ORIGINS`, and HTTPS/WSS at the reverse proxy.

## Project map

```text
apps/web/           React website, WebSocket client, Phaser renderer and input
apps/server/        HTTP, sessions, rooms, queue, simulation and server tests
packages/shared/   Versioned protocol, validation, catalogue and arena constants
scripts/           Load-test utility
tests/e2e/         Playwright tests using separate browser contexts
docs/              Architecture, Windows setup, security, deployment and results
```

## Scope and limitations

This is a single-process guest-session 2D arcade MVP. Each title has a compact implemented rule set; it does not promise a full commercial game campaign, 3D world, licensed assets, or every variant associated with its genre. Rooms, sessions, queues, match history, and leaderboard data disappear when the server restarts. Display names are not unique identities. A room code is an invitation, not an account credential. No permanent accounts, friends, persistent achievements, tournaments, payments, skill-based matching, distributed coordination, or database are implemented. Keep the server local until the hardening and authentication work in [SECURITY.md](docs/SECURITY.md) is addressed.

The automated verification report distinguishes tested behavior from unverified platforms in [VERIFICATION.md](docs/VERIFICATION.md). Windows instructions are provided, but a Linux cloud run cannot establish that Windows was tested.

## Documentation

- [Windows setup](docs/WINDOWS_SETUP.md) and [troubleshooting](docs/TROUBLESHOOTING.md)
- [Architecture](docs/ARCHITECTURE.md), [HTTP and protocol reference](docs/API.md), [multiplayer behavior](docs/MULTIPLAYER.md)
- [Security and limitations](docs/SECURITY.md), [testing](docs/TESTING.md), [deployment](docs/DEPLOYMENT.md)
- [Game catalogue and controls](docs/GAME_CATALOGUE.md)
- [Future persistence design](docs/PERSISTENCE.md)
