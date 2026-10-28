# Original game catalogue

RetroVerse contains 25 original, server-authoritative **2D arcade implementations**, all registered as playable in version 0.2.0. These are compact games with the rule sets below; they are not licensed ports, commercial-game remakes, full 3D worlds, or emulated ROMs. Names, maps, procedural artwork, and synthesized effects are original project content. Working project names are not a claim of trademark clearance.

`packages/shared/src/catalogue.ts` is the canonical metadata source. `apps/server/src/games/arcade/registry.ts` connects the 24 arcade titles to racing, action, casual, and tabletop/social engine families; the original arena engine supplies Prism Skirmish. Availability means an implementation is registered, not that every possible genre feature exists. Actual test results and platform limits belong in [VERIFICATION.md](VERIFICATION.md).

## Lineup and player limits

| #   | Title                 | Stable ID           | Players | Mode       |
| --- | --------------------- | ------------------- | ------- | ---------- |
| 1   | **Asphalt Rivals**    | `asphalt-rivals`    | 2–8     | Arcade     |
| 2   | **Vector Patrol**     | `vector-patrol`     | 2       | Arcade     |
| 3   | **Metro Roam**        | `metro-roam`        | 2–8     | Arcade     |
| 4   | **Breach Protocol**   | `breach-protocol`   | 2–8     | Arcade     |
| 5   | **Sunset Borough**    | `sunset-borough`    | 2–8     | Arcade     |
| 6   | **Night Circuit**     | `night-circuit`     | 2–8     | Arcade     |
| 7   | **Midnight Outbreak** | `midnight-outbreak` | 2       | Arcade     |
| 8   | **Shadow Relay**      | `shadow-relay`      | 2–4     | Arcade     |
| 9   | **Pulse Clash**       | `pulse-clash`       | 2       | Arcade     |
| 10  | **Pocket Drift**      | `pocket-drift`      | 2–8     | Arcade     |
| 11  | **Homebound Dice**    | `homebound-dice`    | 2–4     | Arcade     |
| 12  | **Corner Pocket**     | `corner-pocket`     | 2       | Arcade     |
| 13  | **Fuse Frenzy**       | `fuse-frenzy`       | 2–8     | Arcade     |
| 14  | **Tumble Circuit**    | `tumble-circuit`    | 2–8     | Arcade     |
| 15  | **Hidden Signal**     | `hidden-signal`     | 4–8     | Arcade     |
| 16  | **Stack Surge**       | `stack-surge`       | 2       | Arcade     |
| 17  | **Pixel Serpent**     | `pixel-serpent`     | 2–4     | Arcade     |
| 18  | **Orbit Marbles**     | `orbit-marbles`     | 2       | Arcade     |
| 19  | **Paddle Pulse**      | `paddle-pulse`      | 2       | Arcade     |
| 20  | **Glimmer Maze**      | `glimmer-maze`      | 2–4     | Arcade     |
| 21  | **Rooftop Rush**      | `rooftop-rush`      | 2–8     | Arcade     |
| 22  | **Bloom Arena**       | `bloom-arena`       | 2–8     | Arcade     |
| 23  | **Coil Circuit**      | `coil-circuit`      | 2–8     | Arcade     |
| 24  | **Orbit Putt**        | `orbit-putt`        | 2–8     | Arcade     |
| 25  | **Prism Skirmish**    | `neon-arena`        | 2–8     | Deathmatch |

All 25 games have equal high priority. The current implementations are playable prototypes, with no reference-verified replicas yet. See [REFERENCE_TARGETS.md](REFERENCE_TARGETS.md) for the revised fidelity requirement. Prism Skirmish keeps the stable internal ID `neon-arena`; invitations, room state, history filters, saved recent IDs, and protocol messages use stable IDs rather than display names.

## Shared controls and presentation

Open a game detail page before creating its room. Most games need two independent guests; Hidden Signal needs four. Public queues only match the same game and mode. Entering a room code automatically selects that room's game. Hosts cannot exceed the metadata capacity or start before the minimum connected members are Ready.

The Phaser canvas uses a fixed logical 960×600 2D world scaled to fit. It renders server-provided world objects, players/projectiles, labels, and live `info` hints; vehicles, side-view characters, board tokens, cells, and trails share a universal renderer. WASD/arrows usually move, pointer movement aims, and click or Space is the primary action. Table/social action buttons supply legal-choice indices. Some actions require a new press rather than a held button. Escape opens local settings and releases local input while the server/timer continues. Keyboard/mouse are supported; responsive site layout does not mean touch gameplay.

## Actual rules and controls

### Asphalt Rivals (`asphalt-rivals`)

**Controls:** WASD / arrows to ride. Click / Space to strike a nearby rival. Pass gates 2 → 3 → 4 → 1 in order; three laps wins.

Pass 12 ordered gates (three laps); close-range strikes damage riders and cause brief crash recovery. Timeout uses gate progress.

### Vector Patrol (`vector-patrol`)

**Controls:** Aim and hold click at magenta hostiles. Green civilians must survive. Six shots, then automatic reload. Clear three rescue scenes.

Clear three target encounters together. Six shots trigger an automatic reload. Shooting civilians penalizes the shooter and hurts the team. A cleared mission can share winners; team defeat or timeout has none.

### Metro Roam (`metro-roam`)

**Controls:** WASD / arrows explore the city. Reach your colored checkpoint to discover the next district. Hold Click / Space for precision braking. Ten checkpoints wins.

Reach 10 assigned checkpoints around solid city buildings. This is a bounded top-down exploration/checkpoint race, not an open-world city simulation.

### Breach Protocol (`breach-protocol`)

**Controls:** WASD move, aim and hold click to fire. Attackers occupy relay for 3s to plant; defenders occupy for 3s to defuse. Cover blocks shots.

Alternating teams fight rounds behind cover. Uncontested relay occupancy plants/defuses after three seconds; planted devices count down. First team to three round wins finishes, with round-score handling at timeout.

### Sunset Borough (`sunset-borough`)

**Controls:** WASD / arrows drive. At your colored parcel marker press Click / Space to collect, then drive to your destination and press again. Complete five deliveries.

Collect at a personal parcel marker, then deliver to the destination with another action. First to five deliveries finishes; timeout uses completed delivery count.

### Night Circuit (`night-circuit`)

**Controls:** WASD / arrows to drive. Click / Space for a timed boost. Avoid pursuit cars; pass numbered gates in order. Three laps wins.

Complete 12 ordered gates while avoiding two moving pursuit cars. A timed boost has a cooldown. This is one compact circuit, not a campaign or traffic simulator.

### Midnight Outbreak (`midnight-outbreak`)

**Controls:** Aim and hold click to stop advancing creatures. Six shots, then automatic reload. Survive three waves together.

Stop advancing creatures through three cooperative waves. Missed advancing enemies hurt the team; six-shot weapons reload automatically. Team defeat or uncleared timeout has no winners.

### Shadow Relay (`shadow-relay`)

**Controls:** WASD to scout. Avoid red patrols and their forward detection zones. Collect four intel caches, then everyone reaches green extraction.

Gather four shared intel caches, then bring surviving guests into extraction. Guard facing/range and wall visibility affect detection. Team defeat or incomplete extraction at timeout has no winners.

### Pulse Clash (`pulse-clash`)

**Controls:** A/D move, W/Up jumps. Hold S/Down to block on the ground. Click/Space punches; timed repeated hits build a three-hit combo. First to three rounds wins.

Move/jump, block on the ground, and punch within reach. Timed repeat attacks cycle a three-hit combo. First to three knockout rounds wins; timeout uses round score.

### Pocket Drift (`pocket-drift`)

**Controls:** WASD / arrows to steer. Hold Click / Space to drift; release after charging for a turbo. Collect boost stars. Two laps wins.

Complete eight ordered gates (two laps). Hold action while moving to charge a drift, release for boost, or collect turbo pickups. No licensed kart characters or commercial tracks.

### Homebound Dice (`homebound-dice`)

**Controls:** Current player: click or Space to roll. Roll six to leave the yard. Then choose a legal token.

Each player has four tokens. Roll six to leave the yard; captures apply off safe cells, exact rolls reach home, and six grants another roll. Turn timeout passes after 15 seconds. All four home wins; overall timeout uses progress score.

### Corner Pocket (`corner-pocket`)

**Controls:** Aim from the white cue ball and click/Space. Aim distance sets power. Clear your group, then legally pocket black 8.

Two-player simplified eight-ball: server physics, solids/stripes assignment, first-hit/scratch fouls, ball-in-hand, and legal/illegal black-ball result. Pointer distance sets shot strength; no spin, call-shot UI, or promise of a complete governing-body ruleset. Shot timeout is 20 seconds.

### Fuse Frenzy (`fuse-frenzy`)

**Controls:** Move with WASD. Click/Space places a 2-second bomb. Blasts travel three tiles, break crates, chain bombs, and eliminate players. Last survivor wins.

Action places up to two live bombs per guest. Two-second fuses create three-tile blasts blocked by solid walls/crates and can chain bombs. Last living guest wins; simultaneous elimination can have no winner.

### Tumble Circuit (`tumble-circuit`)

**Controls:** A/D or ←/→ run. W / ↑ / Click / Space jumps. Pass both checkpoint rings and reach the finish. Moving traps return you to your last checkpoint.

Run/jump through one side-view course, pass both checkpoints, avoid moving traps, and finish. Traps return you to a checkpoint; timeout uses course progress. No multi-round elimination tournament is implemented.

### Hidden Signal (`hidden-signal`)

**Controls:** Complete tasks at three stations with Space/click. Call a meeting to vote. Your private role is shown only to you.

Four to eight players, one server-random saboteur. Crew finish three stations each or vote out the saboteur; saboteur eliminates nearby crew on cooldown or survives until timeout. Meetings freeze movement for voting; living guests vote once, ties/skip eject nobody. Use external voice/text to discuss; no built-in voice chat is claimed.

### Stack Surge (`stack-surge`)

**Controls:** ←/→ move · ↑ rotate · ↓ soft drop · Click / Space hard drop. Clear full rows; survive the stack.

Each guest owns a separate falling-block board. Move/rotate/drop shapes, clear rows, and avoid top-out. Last surviving board can win; score breaks a timed/all-top-out result. There is no solo mode or incoming garbage mechanic.

### Pixel Serpent (`pixel-serpent`)

**Controls:** Arrows / WASD steer. Click / Space accelerates. Eat fruit; avoid walls and every snake body.

Grid snake steering disallows immediate reversal. Collect fruit, accelerate, and avoid boundaries/body collisions; defeated snakes respawn. Highest fruit score at timeout wins.

### Orbit Marbles (`orbit-marbles`)

**Controls:** Aim with the mouse, click / Space to launch. Match 3+ adjacent colors before the chain reaches the gate.

Fire colored shots into a shared moving chain; matching three or more adjacent colors scores removals. Clearing the chain, four breaches, or timeout finishes by score. This is a competitive score contest on one shared chain, not a campaign.

### Paddle Pulse (`paddle-pulse`)

**Controls:** W/S or ↑/↓ move your paddle. Click / Space to serve. First to 7 wins.

Vertical paddles, click/Space serve, server-simulated rebounds and goals. First to seven wins; tied high score can share a timed result.

### Glimmer Maze (`glimmer-maze`)

**Controls:** WASD through the corridors. Collect sparks for 10 points each. Sentinels steal health and 10 points. Reach the green exit with at least 50 points to win.

Collect sparks worth 10, avoid moving sentinels that remove health/points, and reach the exit with at least 50 points. Defeated players respawn. Reaching the qualified exit wins; timeout uses score.

### Rooftop Rush (`rooftop-rush`)

**Controls:** A/D or ←/→ run. W / ↑ / Click / Space jumps when grounded. Land on each rooftop and reach the glowing finish on the highest roof.

Gravity, grounded jumps, platform/side collisions, and a raised finish. Climb the rooftops to finish first; timeout uses recorded height/progress. The complete course fits one 2D screen.

### Bloom Arena (`bloom-arena`)

**Controls:** WASD / arrows glide. Eat motes, outgrow rivals, and absorb smaller cells. Click / Space dashes at a mass cost.

Collect motes for mass; absorb rivals only with a sufficient mass advantage. Dash spends mass; absorbed guests respawn. Timed result uses mass, not knockout count.

### Coil Circuit (`coil-circuit`)

**Controls:** Aim with the mouse to steer continuously. Hold click / Space to boost and spend energy. Avoid rival trails and walls.

Mouse-steered continuous movement, bounded turning speed, energy pickups, body growth, rival-trail/wall collisions, and respawn. Boost spends energy. Timed result uses energy score.

### Orbit Putt (`orbit-putt`)

**Controls:** Take turns: aim from your ball, then click or Space. Aim distance sets power. Lowest total strokes wins after three holes.

Take turns across three compact obstacle courses. Aim from your ball; pointer distance sets power. Fewest strokes after completed courses wins. Overall timeout ranks completed holes, proximity to the current cup, then strokes; a 20-second turn timeout adds a penalty stroke.

### Prism Skirmish (`neon-arena`)

**Controls:** Move with WASD or arrow keys.

Top-down deathmatch with solid cover, authoritative projectiles, 100 health, 25 damage per hit, knockout scores, and 1.8-second respawn. Most knockouts at the timer wins; ties share the win.

## Implementation and release limits

Every title uses an authoritative server engine: clients submit intent, not positions, dice outcomes, legal turns, damage, scores, or winners. Input validation and room authorization apply to every title. Hidden Signal role text is unicast as `secret` to its guest and is absent from public snapshots/history. Shared snapshots include typed `objects` and `info`; board/tile-heavy games can cost more bandwidth than the original combat arena.

Guest identity and all rooms, queues, hidden roles, histories, and leaderboard aggregates are in memory and vanish on restart. There are no persistent accounts, solo bots, skill ratings, voice chat, licensed third-party assets, monetization, or multi-instance coordination. Use game-specific filters for history/leaderboards: scores have different meanings across titles, and a negative golf score represents strokes.

Unit/mechanic tests, real-WebSocket all-game lifecycle checks, and browser launch/render coverage provide different evidence. A launch test alone does not prove a whole objective was completed by human input, and metadata does not certify Windows or internet-scale performance. Consult the verification report for what actually ran.

To add another game, provide a server engine with legal input/outcome handling, register it, supply honest metadata and renderer support, and test its rules, capacity, matchmaking compatibility, disconnections, results, and rematch before enabling Play.
