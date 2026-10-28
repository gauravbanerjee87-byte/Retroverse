# Multiplayer behavior

## Guest identity and invitations

The server issues random guest IDs and a cryptographically random resume token after the versioned handshake. The client keeps the token in `sessionStorage` so a reload can resume the same tab's temporary identity. Independent browser contexts receive distinct identities. A display name is not authentication; two guests may choose the same name.

A private invitation is a 12-character cryptographically random uppercase hex code (48 random bits). Share its URL containing `?room=CODE` or enter the code. The server resolves the selected game from the room itself, validates membership/capacity/status, and refuses new participants in an active match. Anyone holding the invitation may attempt to join; do not post it publicly if the room should remain private.

## Game-aware rooms and queue

Choose a title before creating a room. Its shared catalogue entry defines the minimum and maximum player count. Most games need two participants; Hidden Signal needs four. Maximums vary from two to eight. A private start requires the minimum number, all current members connected and Ready, and the host's Start action. Capacity cannot exceed that game's maximum or fall below its minimum.

The room transitions `waiting → playing → finished`. Only the server computes scores, winners, legal actions, and completion. Some games finish at a goal or elimination condition before the match timer; the remaining timer is a bounded session limit. Winner rules differ by game: shared cooperative wins, survival, goals, turns, progress, or score. The host can request a rematch, returning the same game and roster to waiting with ready flags reset. Leaving updates the roster and transfers host responsibility where needed. Earned scores remain in history, but departed players do not retain winner eligibility.

Public matchmaking uses FIFO ordering within the selected game's compatible queue. Protocol mode is `deathmatch` for Prism Skirmish (stable ID `neon-arena`) and `arcade` for the other 24 titles. It starts the game's minimum-sized group automatically: two for most games, four for Hidden Signal. Guests queuing for different games are not paired together. This is not rating/skill-based matching. Duplicate queue entries, concurrent room assignments, and a mismatched mode are rejected. Cancellation and disconnect remove the queued guest; entering a room does not leave another hidden queue assignment.

## Reconnection and cleanup

Disconnected room members retain a 15-second reservation. Their stored input is cleared so a lost connection cannot leave movement/fire held. After grace expires membership is removed. Empty rooms disappear immediately; waiting/finished rooms expire after 30 minutes of inactivity. Disconnected sessions expire after 10 minutes since their last activity. Only the latest 200 match records and top 100 aggregate leaderboard entries are retained. Explicit leave bypasses grace. A process restart invalidates all in-memory sessions, rooms, queues, roles, and results.

Guest resume tokens reclaim a live temporary identity. They do not restore a game after server restart. Reconnection resends the authoritative room state and, for Hidden Signal, only that player's private role. Duplicate use of a token replaces the prior connection; use independent browser contexts to test distinct players.

## Authoritative simulation and rendering

The server targets 25 simulation ticks/second and 12.5 full snapshots/second. A selected game engine owns state and legal input interpretation. Shared 960×600 coordinates support top-down driving/combat, side-view platforming/fighting, boards, puzzles, and pointer-driven ball games. Clients send directional intent, aim, fire/action, monotonic sequence numbers, optional pointer coordinates, and bounded choice indices. They cannot submit positions, score changes, dice rolls, damage, votes on another guest's behalf, or winners.

Phaser renders the authoritative players, projectiles, and typed world objects. Live `info` supplies score labels, phases, active turns, rounds, team labels, and control hints. Snapshot interpolation smooths remote movement; the React HUD runs separately from Phaser's render loop. The universal renderer supports the implemented 2D rules, not a licensed 3D port. See [GAME_CATALOGUE.md](GAME_CATALOGUE.md) for actual controls and per-game limits. Escape opens a local overlay and clears local input; it does not pause the server or other players.

Prism Skirmish retains its original rules: three cover blocks, server-owned movement/projectiles, 25 damage per hit against 100 health, 1.8-second respawn, and most knockouts before time expires. Those rules do not apply automatically to the other games. For example dice/pool/golf enforce turns, Hidden Signal restricts votes by phase/living status, and cooperative missions can finish with no winners on failure.

## Network and performance limitations

The prototype sends JSON full dynamic snapshots at the reduced broadcast cadence rather than delta compression. New arcade snapshots include world-object geometry/labels, so some games send substantially more data than the original combat arena. Shared Prism Skirmish obstacle geometry is static, while other engines publish their own walls, boards, tiles, and markers. Measure each target game, room size, and host before raising capacity; an eight-player metadata limit is not evidence of large-scale throughput.

There is no promised perfect synchronization, client rollback, lag-compensated hits, lockstep recovery, or restart persistence. Latency can cause visible corrections and disadvantages. Browser background throttling can delay rendering/input while the server continues. Reconnect backoff can outlast the room grace period; the UI must then show a recoverable state rather than pretend a reservation remains.

Use [TESTING.md](TESTING.md) and [VERIFICATION.md](VERIFICATION.md) for measured evidence. A short local probe of one engine does not validate all 25 games under sustained internet load.
