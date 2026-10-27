# Windows 11 setup

The local workflow uses native Windows tools. Docker, Kubernetes, WSL, PostgreSQL, Redis, and paid services are unnecessary.

## 1. Install tools

Install Node.js **24 LTS** from [the official downloads page](https://nodejs.org/en/download). The project supports Node 22.12 or later and npm 10 or later. Keep npm enabled in the installer. Install Git for Windows if cloning; a downloaded source archive also works. Reopen PowerShell after installation.

```powershell
node --version
npm --version
git --version
```

If PowerShell blocks `npm.ps1`, use `npm.cmd` and `npx.cmd` in the commands below. You do not need to weaken the machine's execution policy.

## 2. Get the project

The prepared code currently lives in the cloud checkout `/workspace/Retroverse` and has not been pushed. The selected remote was empty at inspection. Export/download the prepared project first; cloning the unchanged remote will not retrieve the application.

For an exported archive named `RetroVerse.zip` in Downloads:

```powershell
New-Item -ItemType Directory -Force D:\tools\retroverse | Out-Null
Expand-Archive -Path "$env:USERPROFILE\Downloads\RetroVerse.zip" -DestinationPath D:\tools\retroverse
Set-Location D:\tools\retroverse
Test-Path .\package.json
```

Use your actual archive filename. Extract so `D:\tools\retroverse\package.json` exists. Avoid an accidental wrapper folder such as `retroverse\Retroverse-main`; move its contents to the intended root if needed. All following commands run in `D:\tools\retroverse`.

After the owner commits and pushes the generated project, cloning is an alternative for a fresh directory:

```powershell
New-Item -ItemType Directory -Force D:\tools | Out-Null
Set-Location D:\tools
git clone https://github.com/gauravbanerjee87-byte/Retroverse.git retroverse
Set-Location D:\tools\retroverse
```

## 3. Install and configure

```powershell
npm ci
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
notepad .env
```

`npm ci` installs the versions recorded by `package-lock.json`. `.env` is ignored by Git. The root `.env` configures the server; no credential is required for the prototype. Default values bind the backend to `127.0.0.1:3001`, permit local Vite origins on port 5173 and built-app origins on port 3001, and use a 120-second match. Shell environment variables take precedence over `.env`; stop and restart the server after changes.

Keep the defaults for the first run. Changing the backend port alone also requires changing the Vite proxy target; see [troubleshooting](TROUBLESHOOTING.md). Do not expose a development server to the public internet.

## 4. Start development

```powershell
npm run dev
```

Keep this PowerShell window open. Open `http://localhost:5173` in Chrome or Edge. Check the backend in a second PowerShell window:

```powershell
Invoke-RestMethod http://localhost:3001/api/health
Invoke-RestMethod http://localhost:3001/api/stats
```

The frontend development server rebuilds changed React code. The backend watcher restarts changed server code; restarting also clears in-memory rooms and sessions. Ctrl+C stops both child processes.

## 5. Test multiplayer manually

1. Use a normal browser window for player one and a private/InPrivate window or another browser for player two. Do not duplicate one live guest session into two clients.
2. Choose distinct display names. Open Neon Arena and create a private room.
3. Copy the invitation and open it in the second browser, or enter the room code.
4. Both players choose Ready; the host starts the match.
5. Move with WASD or arrow keys. Aim using the mouse and hold left click to shoot. Confirm movement, damage, respawn, score, timer, results, and rematch in both browsers.
6. For public matchmaking, leave the room, choose Quick Match in each browser, and wait for the pair to start.
7. Reload one participant to exercise reconnect within the grace period. Restarting the server invalidates all guest sessions.

Gameplay needs keyboard and mouse. Mobile users can browse and manage rooms, but touch gameplay is not implemented.

## 6. Run automated checks

Stop an existing development server if it conflicts with the test runner's ports.

```powershell
npm run typecheck
npm run lint
npm run format:check
npm test
npx playwright install chromium
npm run test:e2e
npm run test:load
npm audit
```

Playwright downloads its own Chromium. Browser tests create independent contexts, so both participants have separate cookie and storage state. See [TESTING.md](TESTING.md) for scope, results, and limitations.

## 7. Build and run the compiled bundle locally

```powershell
npm run build
$env:NODE_ENV = 'development'
$env:WEB_ORIGINS = 'http://localhost:3001,http://127.0.0.1:3001'
npm start
```

Open `http://localhost:3001` and test `http://localhost:3001/api/health`. This runs the built Node server and built static frontend, without Vite or source watchers. The local HTTP smoke test uses development security mode; production mode requires HTTPS origins and a TLS proxy. Real public deployments require a reverse proxy providing HTTPS/WSS and a matching `WEB_ORIGINS` allowlist.

After Ctrl+C, return to development defaults:

```powershell
Remove-Item Env:NODE_ENV, Env:WEB_ORIGINS -ErrorAction SilentlyContinue
npm run dev
```

## 8. Diagnose common failures

Inspect ports before stopping anything:

```powershell
Get-NetTCPConnection -LocalPort 3001,5173 -ErrorAction SilentlyContinue |
  Select-Object LocalAddress,LocalPort,State,OwningProcess
Get-Process -Id <OwningProcess>
```

Replace `<OwningProcess>` with the ID shown. If it is a stale RetroVerse process you own, stop it with `Stop-Process -Id <OwningProcess>`. Do not stop unrelated applications. For missing modules, stop the dev server and rerun `npm ci`. For WebSocket failures, check backend health, the exact browser origin, and [TROUBLESHOOTING.md](TROUBLESHOOTING.md).
