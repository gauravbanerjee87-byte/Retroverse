# Deployment

Local development is free and requires only native Node/npm tools. This document describes a later conventional Node hosting deployment; it does not deploy or purchase anything.

## Single-instance topology

Use a long-running Node process with WebSocket upgrade support behind an HTTPS reverse proxy. Serve the compiled frontend on the same public origin, either from Node or a static file host/reverse proxy. Route `/api/*` and `/ws` to the backend. If using a separate static host, configure its reverse proxy so browser `/api` and `/ws` requests still reach the backend under the frontend origin; the current client uses relative paths. Do not assume a serverless function can retain arbitrary long-lived sockets.

```text
https://arcade.example
  /           -> built apps/web/dist assets and SPA document fallback
  /api/*      -> Node HTTP
  /ws         -> Node WebSocket upgrade (persistent connection)
```

The public domain above is illustrative, not a configured endpoint.

## Build and run

From the repository root on the deployment machine:

```powershell
npm ci
npm run typecheck
npm test
npm run build
$env:NODE_ENV = 'production'
$env:HOST = '127.0.0.1'
$env:PORT = '3001'
$env:WEB_ORIGINS = 'https://arcade.example'
npm start
```

Replace the example origin with the actual frontend origin. Keep `HOST=127.0.0.1` behind a proxy on the same machine; use the hosting platform's required binding when it connects over an internal network. Never expose an untrusted management/debug port. The root `.env` is optional in production because the process environment supplies configuration. Do not put secrets into the static bundle.

Keep installed runtime dependencies available to the server. The server bundle includes shared contracts and imports its external runtime packages. Ship `apps/web/dist`, `apps/server/dist`, package manifests/lockfile, and installed runtime dependencies, or build directly in the deployed checkout. Verify the exact working directory used by the service so the frontend assets can be found.

## Proxy and operations requirements

- Terminate TLS and redirect public HTTP to HTTPS. Browser sockets must use WSS.
- Preserve WebSocket upgrade headers and support long-lived connections. Set idle timeouts above the heartbeat interval.
- Configure the exact `WEB_ORIGINS` allowlist; development origins do not belong in a public production allowlist.
- Restrict HTTP methods/body sizes and connection rates at the proxy. Keep backend validation and limits enabled.
- Preserve security headers; tune Content Security Policy to the actual app without allowing unnecessary external scripts.
- Probe `/api/health`; monitor process restarts, memory, socket counts, event-loop delay, rates, and application errors.
- Capture structured logs with bounded retention. Do not log session tokens or raw credentials. Connect an external error monitor only after choosing and configuring it; none is mandatory locally.
- Run the process under a service manager. Allow graceful termination time before killing it. All in-memory rooms and identities are lost on restart, even with a graceful shutdown.
- Pin Node and use `npm ci` with the committed lockfile. Review `npm audit --omit=dev` and patch advisories deliberately.

## Scaling and persistence

This design supports one authoritative backend process. A second process has a different session/room map. Random load balancing breaks reconnect and matchmaking expectations. Scaling requires a room-aware router or sticky assignment, shared identity, coordinated queues, ownership of simulations, and measured cross-instance behavior. Redis is justified only when implementing that coordination; it is not needed for the local MVP.

Before durable accounts or match history launch, introduce PostgreSQL migrations and backup/restore procedures. Define recovery objectives, encrypt backups, test restore, and apply retention/deletion policies. There is no useful backup guarantee for the current ephemeral maps. See [PERSISTENCE.md](PERSISTENCE.md).

Publication of a cloud development snapshot and deployment of a public service are separate operations. Neither has been performed by this documentation.
