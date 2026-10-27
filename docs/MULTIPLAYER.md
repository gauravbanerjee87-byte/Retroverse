# Multiplayer behavior

## Guest identity and invitations

The server issues random guest IDs and a cryptographically random resume token after the versioned handshake. The client keeps the token in `sessionStorage` so a reload can resume the same tab's temporary identity. New independent browser contexts receive distinct identities. A display name is not authentication; two guests may choose the same name.

A private room invitation is a 12-character cryptographically random uppercase hex code (48 random bits). Share the invitation URL containing `?room=CODE` or enter the code in the join form. Anyone with a valid invitation can attempt to join; the server checks capacity, status, and membership. Active matches do not admit new players. Do not post an invitation publicly if the room should remain private.

## Room and queue lifecycle

Private rooms support 2–8 participants. Waiting players toggle Ready; only the host starts, and all current participants must be connected and ready. During play, membership and scoring belong to the server. At the timer's end, the server computes winners; equal top scores produce a shared win. The host can request a rematch, returning everyone to the waiting room with ready flags reset. Leaving updates the roster and transfers host responsibility when needed. A participant who leaves retains their earned score in the match record but forfeits winner eligibility.

Public matchmaking has one compatible queue: Neon Arena deathmatch. It pairs two guests in FIFO order and starts their public match. There is no rating or skill-based matching. Duplicate queue entries and concurrent room assignments are rejected. Cancellation and disconnection remove queued users; room creation/joining does not leave a hidden duplicate queue assignment.

Disconnected room participants retain a 15-second reservation for reconnection. Their input stops so a lost connection does not leave firing/movement held indefinitely. After grace expires, membership is removed. Empty rooms are removed immediately; waiting/finished rooms expire after 30 minutes of inactivity. Disconnected sessions expire after 10 minutes since their last activity. Only the latest 200 match records and top 100 aggregate leaderboard entries are retained. An explicit leave bypasses reconnect grace. A process restart invalidates everything in memory.

## Authoritative simulation

The server runs Neon Arena at 25 ticks/second and broadcasts at 12.5 snapshots/second. Each match uses a 960×600 arena with three fixed cover blocks. Players move at the server-defined speed, projectiles have fixed speed and lifetime, four 25-damage hits deplete 100 health, and defeated players respawn after 1.8 seconds. Fire cadence, collision, world boundaries, health, kill score, deaths, and end time are enforced server-side.

Clients send keyboard intent, aim angle, fire state, and monotonic sequence numbers. They cannot submit positions or outcomes. Stale input sequences are ignored. Rendering interpolates snapshots so remote movement is smoother than raw update cadence. The HUD is separate from the high-frequency Phaser render loop. Pausing the local overlay does not pause a multiplayer match.

## Network limitations

This prototype sends compact JSON full dynamic snapshots at the reduced broadcast cadence, rather than implementing a delta-compression protocol. Static arena geometry is shared and not retransmitted. With at most eight players and bounded projectiles, this is deliberately simple; measure bandwidth before extending player count. It does not claim perfect synchronization, client rollback, lag-compensated hits, or deterministic recovery across server restarts. High latency and packet delay can cause visible corrections and disadvantage a participant.

Browser background throttling can pause input/rendering. Server simulation remains authoritative. Reconnection attempts use backoff and may outlast the membership grace window; the UI should then show a new session or a recoverable error rather than pretending the match was retained.

Use the load utility and tests in [TESTING.md](TESTING.md) to measure the actual target host. The configured eight-player room ceiling is not evidence of thousands of supported concurrent users.
