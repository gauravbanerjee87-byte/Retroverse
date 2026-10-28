# Faithful recreation targets

The revised request is for exact visual/gameplay matching, new public game names, equal high priority for every game, and the **latest patches of the specifically named titles**. New franchise entries, remasters, and sequels are not automatic substitutes. For example, Counter-Strike 2 does not replace Counter-Strike 1.6 and Tekken 8 does not replace Tekken 3.

## Current status

All 25 current games are playable 2D prototypes. **0 of 25 are reference-verified recreations.** Their mechanical/browser test results do not establish visual fidelity to the requested games. No source engine has been rebuilt into a faithful recreation by this scope update.

The registry records `priority: high` for every game and `fidelity: prototype`. Playability and fidelity are separate. Featured placement is editorial selection, not development priority. New display names and stable internal IDs remain unchanged.

## Named reference titles

| Original reference          | RetroVerse working name | Baseline policy / outstanding identification                                                                 |
| --------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------ |
| Road Rash                   | Asphalt Rivals          | Classic named release, latest official patch; platform/edition/build must be identified                      |
| Virtua Cop 2                | Vector Patrol           | Named release, latest official patch; exact reference build required                                         |
| Midtown Madness 2           | Metro Roam              | Original named PC release, latest official patch; build unverified                                           |
| Counter-Strike 1.6          | Breach Protocol         | Original 1.6 branch, latest official update; distributor/build ID must be recorded                           |
| GTA: Vice City              | Sunset Borough          | Original named release, latest official patch; no automatic Definitive Edition substitution                  |
| Need for Speed: Most Wanted | Night Circuit           | Classic named release intended by the brief; distinguish editions bearing the same title before verification |
| The House of the Dead 2     | Midnight Outbreak       | Named release, latest official patch; platform/build must be identified                                      |
| Project I.G.I.              | Shadow Relay            | Original named release, latest official patch; build unverified                                              |
| Tekken 3                    | Pulse Clash             | Named game, latest revision; arcade versus PlayStation reference must be identified                          |

No numeric patch version is asserted without evidence from an identified reference build or authoritative release documentation. Unofficial community mods, texture packs, emulators, regional variants, and fan patches are not silently included as official updates.

## Remaining entries

Kart racing, dice board play, pool, bomb arenas, obstacle parties, social deduction, falling blocks, grid snake, marble matching, paddle play, maze survival, platform racing, cell growth, continuous snake arenas, and mini golf are genre descriptions rather than uniquely identified commercial titles. They do not determine a single latest patch or exact visual reference. Each needs an agreed reference game/build or its own explicit visual/rule specification. Prism Skirmish is the original flagship, previously displayed as Neon Arena; it also needs an agreed visual target for any new fidelity standard.

## Public-reference-first research

Start from public release documentation, gameplay footage, screenshots, manuals, and technical references. Do not require the user to upload archives or prepare a 25-game manifest before researching. Use documented baseline defaults where reasonable, keep uncertain versions explicit, and ask only for a specific unresolved input that blocks implementation. [PUBLIC_REFERENCE_RESEARCH.md](PUBLIC_REFERENCE_RESEARCH.md) records accessed sources, findings, practical defaults, and remaining gaps.

Actual asset/source import is a separate step. If an exact implementation needs files or permissions not available publicly, identify those concrete materials at that point rather than making them a blanket research prerequisite.

For each target, record:

- Platform, edition, language/region, official patch/build identifier, and how it was verified.
- Authorized access to reference builds and any source/assets intended for reuse, including applicable redistribution permissions. Ownership of an installed copy alone does not establish asset redistribution rights.
- Reference screenshots/video for menus, HUD, camera, maps, animation, lighting, materials, and representative gameplay sequences.
- Rules, controls, physics/timing, audio, match flow, and multiplayer requirements against which the recreation will be evaluated.
- Browser/Windows performance targets and accepted differences, if any. No differences are currently approved by the user.

A name change does not itself supply asset rights or reference evidence. Do not extract or publish proprietary assets without an appropriate basis. Exact appearance cannot be verified against absent reference material.

## Verification gate

A game can be marked `reference-verified` only after the identified build and permitted materials are available, implementation matches the agreed scope, and side-by-side visual and behavioral comparisons pass. Record camera/resolution, input recordings, physics checkpoints, UI states, and any remaining differences. Functional smoke tests alone cannot pass this gate. The current renderer and prototype simulations must not be described as completed replicas.
