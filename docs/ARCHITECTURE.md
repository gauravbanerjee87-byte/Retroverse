# Architecture

RetroVerse is an npm-workspaces TypeScript monorepo. One Node process owns live multiplayer state; a React application presents the website, and Phaser renders the active game. The 25 titles use one projectile arena plus four arcade engine families: racing/platforming (7), action (7), casual (6), and tabletop/social (4). Shared schemas connect the two.

```text
Browser: React routes / settings / lobby / HUD
              |                 |
              | HTTP /api       | WebSocket /ws (protocol v1)
              v                 v
        Node HTTP server + WebSocket gateway
              |
    Guest sessions / rooms / FIFO queue
              |
    Selected authoritative game engine (25 Hz)
              |
    Bounded in-memory results and leaderboard
```

## Boundaries

- `packages/shared/src/protocol.ts` defines client messages and strict runtime validation. `game-types.ts` defines snapshots, the 960×600 world, world-object rendering contracts, game hints, and room views. `catalogue.ts` defines metadata and honest availability.
- `apps/server` owns connection/session identity, validation, authorization, rooms, ready state, queue assignments, selected-game simulation, physics, hits, legal turns/actions, scores, match completion, and cleanup. The client sends intent rather than positions or outcomes.
- `apps/web` owns navigation, forms, preferences, connection status, input collection, interpolation, and rendering. Gameplay updates go to Phaser rather than requiring a full React tree update on each simulation tick.
- `tests/e2e` tests actual browser participants. Server tests exercise real sockets as well as deterministic simulation functions.

## Browser navigation and preferences

The React application uses hash routes: `#/`, `#/library`, `#/game/<game-id>`, `#/room`, `#/matchmaking`, `#/profile`, `#/history`, `#/leaderboards`, and `#/settings`. Unknown routes show a not-found page. An invitation's `?room=CODE` query opens the room form. Display name, mute, reduced effects, and recent-game IDs are local browser preferences; the guest token and player ID use tab-scoped session storage. Saving a changed name reconnects the guest session.

## Deployment topology

Development uses Vite on port 5173 and Node on 3001. Vite forwards `/api` and `/ws` to Node, keeping browser requests same-origin. Production builds the frontend into `apps/web/dist`; the Node production process serves it alongside the API and WebSocket endpoint. A reverse proxy can instead serve the static files and forward the same API/WebSocket paths to Node. No long-lived WebSocket support is assumed from serverless functions.

## Lifecycle

A client introduces a protocol version and display name. The server creates a random guest identity and bearer resume token. A private room transitions `waiting → playing → finished`; a host rematch returns it to `waiting`. Private starts require the selected game's minimum connected, ready players. Public matching uses FIFO ordering within each game and starts its minimum-sized group automatically: two for most titles, four for Hidden Signal. Room creation validates game-specific capacities; joins resolve the game from the room code. Disconnect grace allows a returning guest to reclaim its room; explicit leave removes membership immediately. Reconnect and room expiry are bounded and do not survive a process restart.

## Rendering and private state

The Phaser scene is a universal 2D renderer. The server publishes typed `objects` (walls, targets, pickups, hazards, balls, zones, tiles, trails, bombs, finishes, and markers), player/projectile state, plus `info` for score labels, phase, turn, round, teams, and live hints. The scene chooses vehicle, character, cell, or board rendering from the stable game ID. The camera fits a fixed logical 960×600 world to the available canvas; it is not a 3D engine or a claim of separate bespoke art pipelines for every title.

Hidden Signal's role text uses a unicast `secret` message via the engine's `privateInfo(playerId)` hook. Public snapshots and history must not contain the saboteur identity. Reconnection reissues the guest's private role to that guest only. Keep secret-role handling separate from shared render state when adding hidden-information games.

## Extension points

Add a game to the shared registry only when its metadata is complete; mark it playable only after adding its server rules, renderer, controls, and tests. Keep a future game's simulation separate from transport and room allocation. PostgreSQL account/history design is documented in [PERSISTENCE.md](PERSISTENCE.md); it is a future phase, not a runtime prerequisite.

There is no distributed queue or shared state. Do not run multiple backend instances behind a random load balancer and expect rooms or guest tokens to work across them. Scaling requires explicit room routing and coordination.
