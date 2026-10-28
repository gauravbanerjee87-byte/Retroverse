# Troubleshooting

Run commands from `D:\tools\retroverse` in PowerShell. Keep the failing command's output; avoid dumping `.env`, process environments, credential files, or session tokens.

## Node/npm unavailable or incompatible

```powershell
node --version
npm --version
Get-Command node
Get-Command npm
```

Install Node 24 LTS, reopen PowerShell, and verify Node is at least 22.12 and npm at least 10. If `npm.ps1` is blocked by execution policy, use `npm.cmd`/`npx.cmd`; do not disable machine security policy. Run `npm ci` after changing Node versions.

## Dependency installation fails

Verify `package.json` and `package-lock.json` are in the current directory, network access to `registry.npmjs.org` works, and the cache directory is writable. A supported user-writable cache override is:

```powershell
npm ci --cache "$env:LOCALAPPDATA\RetroVerse\npm-cache"
```

Keep TLS/integrity verification enabled. Do not delete the lockfile to work around package errors. If a corporate proxy is used, use its approved npm/proxy/CA settings rather than disabling certificate checks.

## Port already in use

```powershell
Get-NetTCPConnection -LocalPort 3001,5173 -ErrorAction SilentlyContinue |
  Select-Object LocalAddress,LocalPort,State,OwningProcess
Get-Process -Id <OwningProcess>
```

Replace the placeholder ID with the reported value and stop only a stale process you recognize. Default Vite uses strict port 5173; it does not silently move and invalidate the configured origin allowlist.

To change the backend port intentionally, change `PORT` in root `.env` and the `/api` and `/ws` targets in `apps/web/vite.config.ts` to the same port. To change the frontend port, change the Vite `server.port` and add its exact localhost origins to `WEB_ORIGINS`. These are configuration changes; do not edit game code. Restart both processes afterward. Prefer defaults during initial setup.

## Website loads but multiplayer fails

```powershell
Invoke-RestMethod http://localhost:3001/api/health
```

If health fails, inspect the backend terminal and port. If health succeeds, open browser developer tools and inspect the `/ws` handshake and connection status. Use `http://localhost:5173` or `http://127.0.0.1:5173` locally; `file://` and an unexpected hostname are not equivalent origins. Vite must be running to proxy dev WebSockets. Production proxies must preserve Upgrade/Connection headers, permit `/ws`, and use WSS under HTTPS. A production origin rejection requires correcting `WEB_ORIGINS`, not disabling origin checks.

## Cannot start/join a room

Private matches need the selected game's minimum participants and every participant Ready. Hidden Signal needs four; most titles need two. Capacity also follows the game's maximum. Only the current host can start/rematch. Invitations are uppercase 12-character hex codes; full, expired, nonexistent, and already-playing rooms cannot admit a new guest. Leave an existing room or cancel the queue before trying a conflicting action. Public matching groups only the same game; check that every guest selected the same title and mode. An invitation resolves the game from its room code even if another title was selected on the join screen. Reload reconnects only while the original in-memory session remains valid. Server restarts require a new room.

Use an independent private window/browser for another participant. Duplicating a tab can copy session storage; two clients holding the same resume token are one guest identity, not two players.

## Wrong controls, missing role, or action not accepted

Read the selected game's details and the live hint beside the canvas. The same primary action has different meanings: roll, punch, place bomb, jump, drop, serve, shoot, or interact. Dice and social votes require a fresh action and legal choice; holding the mouse does not automatically choose a token. Pool/golf only accept the active player's shot while balls are stationary, with power based on pointer distance. Hidden Signal's role is a private message shown only to that guest; public state deliberately omits the saboteur identity. Reconnect with the same temporary token to receive your role again while the session survives.

If a game appears under an older internal identifier such as `neon-arena`, use its displayed title **Prism Skirmish** in the UI; stable IDs are retained for compatibility. No commercial game executable, ROM, 3D assets, or external emulator is needed.

## No movement or sound

Click the game area, use a desktop keyboard and mouse, and close the local overlay with Escape. Touch movement is not implemented. If the browser tab was backgrounded, return focus. Check connection status and verify the match is playing rather than waiting/finished. Sound requires a user interaction under browser autoplay rules; inspect the mute preference and system volume. The local settings overlay does not pause other players or the server timer.

## Build/test failures

Stop stale dev processes, run `npm ci`, then rerun the exact failing command. Browser packages and browser binaries are separate: use `npx playwright install chromium` before `npm run test:e2e`. Do not suppress TypeScript errors or disable assertions to make checks pass. A browser download or missing host dependency must be reported as an environment problem. Check [VERIFICATION.md](VERIFICATION.md) for known results and limitations.

## Production starts but assets are missing

Run `npm run build` from the root before `npm start`. Confirm `apps/web/dist/index.html` and `apps/server/dist/index.js` exist and have been deployed together. Use `http://localhost:3001`, not the stopped Vite server. Ensure the service's working directory and asset paths match the checkout layout. Public deep links need a document fallback while `/api` and `/ws` keep their own routing.

## Data disappeared

This is expected after backend restart: sessions, rooms, queue, history, and leaderboard are in memory. Display preferences may remain in browser storage. PostgreSQL persistence is a future phase; no automatic restoration or database backup exists for this MVP.
