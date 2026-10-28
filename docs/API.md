# HTTP and WebSocket API

Development base: `http://localhost:3001`. Browser development requests use Vite's same-origin proxy. Production uses the deployed site's origin. HTTP responses are JSON except static frontend assets and document routes.

## HTTP endpoints

| Method and path                                | Purpose                                                                                                             |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `GET /api/health`                              | `{ "status": "ok", "protocol": 1 }`; 503 while stopping                                                             |
| `GET /api/stats`                               | `{ "onlinePlayers": number, "rooms": number, "queuedPlayers": number }`                                             |
| `GET /api/leaderboard?gameId=<id>`             | `{ "entries": LeaderboardEntry[] }`, at most 100 entries, sorted by wins then aggregate score; optional game filter |
| `GET /api/history?playerId=<uuid>&gameId=<id>` | `{ "matches": MatchRecord[] }`, at most 50 recent results; either/both filters optional                             |

These public prototype statistics do not authenticate an account and must not be treated as proof of ownership. Display names are public labels. History and leaderboard data disappear on restart. Unknown game filters return 400. The legacy leaderboard field `kills` aggregates the game score, so it is not literally knockouts outside Prism Skirmish; compare scores within a game. No endpoint accepts a client-written score. Public history responses redact the private room code to an empty string; current room members still receive their invitation in their room view. Unknown API paths return 404; unsupported HTTP methods return 405; excessive API requests return 429.

## WebSocket endpoint

Connect to `/ws` using `ws://` locally or `wss://` in production. Text messages are JSON objects with a discriminant `type`. Client schemas are strict: unknown properties, invalid fields, malformed JSON, unsupported version, non-finite inputs, and invalid action state are rejected. The shared source is the canonical protocol contract.

Handshake example:

```json
{ "type": "hello", "version": 1, "name": "Nova" }
```

A successful `welcome` includes `playerId`, `name`, `token`, `version`, and `resumed`. Hold the token in tab-scoped `sessionStorage`, never include it in invitation URLs or logs. To resume, supply `token` in the next `hello` message. It is a bearer credential for a temporary guest, not permanent authentication.

## Client messages

| Type           | Required data and behavior                                                                         |
| -------------- | -------------------------------------------------------------------------------------------------- |
| `hello`        | `version: 1`, valid `name`; optional 64-character hex `token`                                      |
| `create`       | Optional `gameId` and `capacity`; game-specific bounds enforced, default game `neon-arena`         |
| `join`         | `code`: 12 uppercase hexadecimal characters                                                        |
| `leave`        | Remove current membership                                                                          |
| `ready`        | `ready`: boolean; waiting-room members only                                                        |
| `start`        | Host-only; selected game minimum, all current participants ready/connected                         |
| `rematch`      | Host-only; completed room returns to waiting                                                       |
| `queue`        | Known `gameId`; `mode: "deathmatch"` for `neon-arena`, `"arcade"` for every other game             |
| `cancel_queue` | Remove caller from public queue                                                                    |
| `input`        | `input` with monotonic `seq`, directions, `angle`, `fire`, optional `targetX`, `targetY`, `choice` |
| `ping`         | Numeric `at` timestamp, echoed in `pong`                                                           |

Names contain 2–20 Unicode letters/numbers, spaces, underscores, or hyphens. Input directions and fire are booleans. Aim is a finite angle between `-2π` and `2π`. Optional pointer targets are finite world coordinates (`targetX` 0–960, `targetY` 0–600). Optional `choice` is an integer 0–15, interpreted by the selected game: for example token indices or meeting/vote actions. The server still checks legal turn, phase, target, and action; passing schema validation alone does not authorize a move. Sequence numbers are nonnegative safe integers. Repeated or stale input sequences do not advance simulation authority. Room and queue operations act on the server's session identity, not a supplied player ID.

## Server messages

| Type              | Content                                                                          |
| ----------------- | -------------------------------------------------------------------------------- |
| `secret`          | Private role/instructions for this guest only; never part of the public snapshot |
| `welcome`         | Issued identity and resume result                                                |
| `room`            | Authoritative room view, members, host, ready flags, status, optional match      |
| `state`           | Authoritative match snapshot                                                     |
| `finished`        | Final room view and immutable match record                                       |
| `left`            | Membership was removed                                                           |
| `queued`          | Current queue position                                                           |
| `queue_cancelled` | Queue removal confirmed                                                          |
| `pong`            | Echoed `at` and `serverTime`                                                     |
| `error`           | Safe `code` and user-facing `message`                                            |

Room membership changes appear as updated `room` rosters; there are no separate `player_joined`/`player_left` wire messages. A `state` carries `gameId`, tick, player positions/angles/health/scores/last accepted sequence, live projectiles, recent kill events, timing, winner IDs, typed world `objects`, and live `info`. The latter includes `label`, `message`, optional `phase`, `turnId`, `round`, `goal`, and team labels. Rooms and history records carry their `gameId` too. The original stable ID `neon-arena` now displays as Prism Skirmish; display names are not protocol identifiers. Snapshot cadence is lower than simulation cadence; see [MULTIPLAYER.md](MULTIPLAYER.md). Do not send forged health, position, damage, winner, or score fields: the schema and simulation do not accept them.

Room examples:

```json
{ "type": "create", "gameId": "homebound-dice", "capacity": 4 }
```

```json
{ "type": "queue", "gameId": "hidden-signal", "mode": "arcade" }
```

A `join` carries only its code; the server resolves its game. Quick matching never substitutes a different game to fill a queue. The catalogue is the canonical list of game IDs and bounds; Hidden Signal requires 4–8, most games require at least two, and two-player/table limits are enforced server-side.

Limits, idle cleanup, backpressure, and error behavior are documented in [SECURITY.md](SECURITY.md). The protocol is an MVP contract; changes must update shared schemas, client, server, and tests together.

Valid input packets already in flight when a match finishes are ignored for existing room members. Finished state is immutable; waiting-room and nonmember input still fails authorization/lifecycle checks, and all payload and rate limits remain enforced.
