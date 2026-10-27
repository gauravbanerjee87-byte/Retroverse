# RetroVerse

An original browser arcade with a real, server-authoritative multiplayer game: **Neon Arena**. Create a private room, invite another browser, ready up, and compete in a timed 2–8 player deathmatch. Public matchmaking pairs two waiting players. Guest profiles, match history, and leaderboards reflect this server session; they are not persistent accounts.

RetroVerse uses React, TypeScript, Vite, Phaser 3, Node.js, `ws`, Zod, Vitest, and Playwright. It needs no database, Docker, WSL, paid API, or cloud service for local development. Art and sound are generated for this project. Night Circuit and Prism Shift are clearly labeled concepts and cannot be launched.

## Quick start on Windows 11

The generated application currently lives in `/workspace/Retroverse`; it has not been pushed to GitHub. The selected GitHub repository was empty when this implementation began. Export or copy the prepared project to Windows first; cloning the unchanged remote will not retrieve these files.

Install Node.js **24 LTS** (minimum supported version: 22.12) from [nodejs.org](https://nodejs.org/), reopen PowerShell, and extract an archive of the prepared project:

```powershell
New-Item -ItemType Directory -Force D:\tools | Out-Null
New-Item -ItemType Directory -Force D:\tools\retroverse | Out-Null
Expand-Archive -Path "$env:USERPROFILE\Downloads\RetroVerse.zip" -DestinationPath D:\tools\retroverse
Set-Location D:\tools\retroverse
node --version
npm --version
npm ci
Copy-Item .env.example .env
npm run dev
```

Use the actual archive filename in place of `RetroVerse.zip`. Put its root `package.json` directly in `D:\tools\retroverse`; if the archive contains a wrapper folder, move its contents into that directory before running npm. After the generated source has been committed and pushed, Git cloning is an alternative described in [Windows setup](docs/WINDOWS_SETUP.md). `npm install` is also available when deliberately updating the lockfile; use `npm ci` for a reproducible checkout. npm 10 or newer is required. Copy `.env` only once; do not overwrite local changes.

Open **http://localhost:5173**. The backend health endpoint is **http://localhost:3001/api/health**. The Vite development server proxies `/api` and `/ws` to the backend; both processes start with `npm run dev` and stop with Ctrl+C.

Create a room in one browser, copy its invitation, then open it in a separate browser or private window. Each participant must choose Ready before the host starts. Use WASD/arrows to move, mouse to aim, left click to fire, and Escape for the game settings overlay. Desktop keyboard and mouse are required for gameplay; the website adapts to mobile screens.

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

This is a single-process guest-session MVP. Rooms, sessions, queues, match history, and leaderboard data disappear when the server restarts. Display names are not unique identities. A room code is an invitation, not an account credential. No permanent accounts, friends, persistent achievements, tournaments, payments, skill-based matching, distributed coordination, or database are implemented. Keep the server local until the hardening and authentication work in [SECURITY.md](docs/SECURITY.md) is addressed.

The automated verification report distinguishes tested behavior from unverified platforms in [VERIFICATION.md](docs/VERIFICATION.md). Windows instructions are provided, but a Linux cloud run cannot establish that Windows was tested.

## Documentation

- [Windows setup](docs/WINDOWS_SETUP.md) and [troubleshooting](docs/TROUBLESHOOTING.md)
- [Architecture](docs/ARCHITECTURE.md), [HTTP and protocol reference](docs/API.md), [multiplayer behavior](docs/MULTIPLAYER.md)
- [Security and limitations](docs/SECURITY.md), [testing](docs/TESTING.md), [deployment](docs/DEPLOYMENT.md)
- [Future persistence design](docs/PERSISTENCE.md)
