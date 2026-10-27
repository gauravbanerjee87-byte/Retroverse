# HTTP and WebSocket API

Development base: `http://localhost:3001`. Browser development requests use Vite's same-origin proxy. Production uses the deployed site's origin. HTTP responses are JSON except static frontend assets and document routes.

## HTTP endpoints

| Method and path                  | Purpose                                                                                |
| -------------------------------- | -------------------------------------------------------------------------------------- |
| `GET /api/health`                | `{ "status": "ok", "protocol": 1 }`; 503 while stopping                                |
| `GET /api/stats`                 | `{ "onlinePlayers": number, "rooms": number, "queuedPlayers": number }`                |
| `GET /api/leaderboard`           | `{ "entries": LeaderboardEntry[] }`, at most 100 entries, sorted by wins then kills    |
| `GET /api/history?playerId=<id>` | `{ "matches": MatchRecord[] }`, at most 50 recent results, optionally filtered by UUID |

These public prototype statistics do not authenticate an account and must not be treated as proof of ownership. Display names are public labels. History and leaderboard data disappear on restart. No endpoint accepts a client-written score. Public history responses redact the private room code to an empty string; current room members still receive their invitation in their room view. Unknown API paths return 404; unsupported HTTP methods return 405; excessive API requests return 429.

## WebSocket endpoint

Connect to `/ws` using `ws://` locally or `wss://` in production. Text messages are JSON objects with a discriminant `type`. Client schemas are strict: unknown properties, invalid fields, malformed JSON, unsupported version, non-finite inputs, and invalid action state are rejected. The shared source is the canonical protocol contract.

Handshake example:

```json
{ "type": "hello", "version": 1, "name": "Nova" }
```

A successful `welcome` includes `playerId`, `name`, `token`, `version`, and `resumed`. Hold the token in tab-scoped `sessionStorage`, never include it in invitation URLs or logs. To resume, supply `token` in the next `hello` message. It is a bearer credential for a temporary guest, not permanent authentication.

## Client messages

| Type           | Required data and behavior                                                          |
| -------------- | ----------------------------------------------------------------------------------- |
| `hello`        | `version: 1`, valid `name`; optional 64-character hex `token`                       |
| `create`       | `capacity` integer 2–8; creates private room                                        |
| `join`         | `code`: 12 uppercase hexadecimal characters                                         |
| `leave`        | Remove current membership                                                           |
| `ready`        | `ready`: boolean; waiting-room members only                                         |
| `start`        | Host-only; private room with at least two ready participants                        |
| `rematch`      | Host-only; completed room returns to waiting                                        |
| `queue`        | `gameId: "neon-arena"`, `mode: "deathmatch"`                                        |
| `cancel_queue` | Remove caller from public queue                                                     |
| `input`        | `input` object with monotonic `seq`, `up`, `down`, `left`, `right`, `angle`, `fire` |
| `ping`         | Numeric `at` timestamp, echoed in `pong`                                            |

Names contain 2–20 Unicode letters/numbers, spaces, underscores, or hyphens. Input directions and fire are booleans. Aim is a finite angle between `-2π` and `2π`. Sequence numbers are nonnegative safe integers. Repeated or stale input sequences do not advance simulation authority. Room and queue operations act on the server's session identity, not a supplied player ID.

## Server messages

| Type              | Content                                                                     |
| ----------------- | --------------------------------------------------------------------------- |
| `welcome`         | Issued identity and resume result                                           |
| `room`            | Authoritative room view, members, host, ready flags, status, optional match |
| `state`           | Authoritative match snapshot                                                |
| `finished`        | Final room view and immutable match record                                  |
| `left`            | Membership was removed                                                      |
| `queued`          | Current queue position                                                      |
| `queue_cancelled` | Queue removal confirmed                                                     |
| `pong`            | Echoed `at` and `serverTime`                                                |
| `error`           | Safe `code` and user-facing `message`                                       |

Room membership changes appear as updated `room` rosters; there are no separate `player_joined`/`player_left` wire messages. A `state` carries tick, player positions/angles/health/scores/last accepted sequence, live projectiles, recent kill events, timing, and winner IDs. Snapshot cadence is lower than simulation cadence; see [MULTIPLAYER.md](MULTIPLAYER.md). Do not send forged health, position, damage, winner, or score fields: the schema and simulation do not accept them.

Limits, idle cleanup, backpressure, and error behavior are documented in [SECURITY.md](SECURITY.md). The protocol is an MVP contract; changes must update shared schemas, client, server, and tests together.
