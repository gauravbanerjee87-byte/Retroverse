# Public reference research

Research started on 28 October 2026. Public references are sufficient to begin edition, visual, and behavioral research. **User uploads and a 25-game asset manifest are not prerequisites for this work.** Asset delivery or permission questions should be raised only when a specific integration actually needs them. All 25 targets retain equal priority.

## Practical baseline defaults

Use the classic Windows PC edition where one exists: Road Rash's classic PC port, Virtua Cop 2, Midtown Madness 2, Counter-Strike 1.6's Steam Windows branch, original GTA: Vice City, the 2005 Need for Speed: Most Wanted, The House of the Dead 2, and Project I.G.I. For Tekken 3, use the original PlayStation presentation as a working visual default and keep arcade-revision evidence separate. These are documented research defaults based on the nostalgic-PC brief, not claims that a specific binary/build was verified. Do not replace these titles with modern franchise successors or remasters.

Research official updates for the chosen editions. A community fix's current version, a ROM revision, and a Steam build ID are different kinds of evidence. None automatically proves the latest official PC patch. Unverified numeric versions stay unverified.

## Accessed sources and findings

The following public files returned HTTP 200 and were read at the pinned commits below. No game executables, ROMs, models, textures, maps, or music were downloaded or copied into RetroVerse.

### Counter-Strike / GoldSrc technical context

[Valve's official Half-Life repository README](https://github.com/ValveSoftware/halflife/blob/b1b5cf5892918535619b2937bb927e46cb097ba1/README.md)

- Official source for the Half-Life engine family, issue reporting, SDK building, and the SDK's own distribution terms.
- Useful for engine-family and build/toolchain research.
- Does not establish the current Counter-Strike 1.6 Steam build ID, supply Counter-Strike assets, or demonstrate an exact browser port. Those claims remain unverified.

### Midtown Madness 2 technical context

[MM2Hook README](https://github.com/Fireboyd78/mm2hook/blob/bcb44806ac22c9bc4c0072911fd5c219c4320f0e/README.md)

- Describes a third-party hooking module, crash/heap fixes, scripting, display arguments, and geometry tooling for Midtown Madness 2.
- Useful compatibility and presentation research; it explicitly discusses resolution/window modes and vehicle geometry features.
- It is a community project, not proof of the latest Microsoft patch, and is not the original game source or an asset license.

### GTA: Vice City technical context

[SilentPatch README](https://github.com/CookiePLMonster/SilentPatch/blob/74976544adc196fa664831ddc59778e684cf6af0/README.md)

- Identifies community fixes for original 3D-era GTA games and lists Vice City's RenderWare 3.4/D3D8 SDK dependency for compiling that patch.
- Helps distinguish the original game's technology from a modern remaster and from the existing Phaser prototype.
- SilentPatch is an unofficial patch family. Its release number must not be presented as the original publisher's latest official patch.

### Need for Speed: Most Wanted technical context

[Most Wanted widescreen-fix source](https://github.com/ThirteenAG/WidescreenFixesPack/blob/2f4fd579289c67af593b2164f5376bd008de0d35/source/NFSMostWanted.WidescreenFix/dllmain.cpp)

- Directly identifies a Most Wanted-specific fix implementation using D3D9-related integration, game resolution, cursor/window handling, and menu/process callbacks.
- Useful for investigating the classic game's rendering/UI integration.
- This inspected file does not prove a specific latest official patch number or provide the game's original assets. No such patch number is asserted here.

### Tekken 3 arcade-revision evidence

[MAME Namco System 12 driver](https://github.com/mamedev/mame/blob/c91d2b989bb75deeb6958a9f32d177755f8d4751/src/mame/namco/namcos12.cpp#L3678)

- Lists Tekken 3's World `TET2/VER.E1` set, earlier A/B/C/D sets, and regional variants.
- Provides concrete arcade revision evidence and shows why region/release distinctions matter.
- Does not identify the latest PlayStation disc revision, establish that arcade and PlayStation presentations are interchangeable, or authorize ROM distribution. No ROM data was obtained.

### Virtua Cop 2 arcade-platform evidence

[MAME Sega Model 2 driver](https://github.com/mamedev/mame/blob/c91d2b989bb75deeb6958a9f32d177755f8d4751/src/mame/sega/model2.cpp#L7668)

- Registers Virtua Cop 2 on its Model 2A implementation and separately identifies the cartridge/board metadata earlier in the file.
- Useful arcade-platform context; it is not a Windows patch source.
- The same file's first House of the Dead entries must not be mistaken for House of the Dead **2**.

### The House of the Dead 2 arcade-platform evidence

[MAME Sega NAOMI driver](https://github.com/mamedev/mame/blob/c91d2b989bb75deeb6958a9f32d177755f8d4751/src/mame/sega/naomi.cpp#L11669)

- Identifies the second game's USA, original, Export, and prototype entries under the NAOMI implementation.
- Helps keep this sequel and its regional sets distinct from the first game and from the Windows port.
- Does not prove the latest Windows patch, provide a reference video, or grant asset-distribution rights.

Road Rash and Project I.G.I. still need usable public release/patch sources. No successful source was found for those titles in this initial pass; guessed URLs returning 404 were excluded from the bibliography.

## Visual and behavior capture queue

These are investigation checklists, not claims of completed side-by-side visual verification:

| Target                  | Reference views and behavior to capture                                                                      |
| ----------------------- | ------------------------------------------------------------------------------------------------------------ |
| Road Rash               | Behind-rider road perspective, horizon/scenery, leaning, close-range combat, crash/recovery, race HUD, menus |
| Virtua Cop 2            | Rail camera, target/civilian presentation, two-player crosshairs, reload, route transitions, HUD             |
| Midtown Madness 2       | Vehicle/cockpit cameras, city scale/streets, vehicle animation, traffic, handling, race/free-roam UI         |
| Counter-Strike 1.6      | First-person camera/viewmodels, movement and weapon timing, map scale, buy/round/score interfaces            |
| GTA: Vice City          | Character/vehicle cameras, city/material palette, character motion, driving, mission flow, HUD/map           |
| Most Wanted (2005)      | Chase camera, handling/drift, pursuit behavior, road/world scale, effects, race/pursuit/menu HUD             |
| The House of the Dead 2 | Rail camera, enemy/boss animation, hit reactions, two-player aiming/reload, branching scenes                 |
| Project I.G.I.          | First-person/optic views, terrain/buildings, stealth/detection, weapons, mission and inventory UI            |
| Tekken 3                | Side-on 3D camera, fighters/animation, arena scale, input/combo/block timing, rounds and character-select UI |

The other entries are genre descriptions rather than uniquely named editions. Research representative, period-appropriate examples and document candidate selections instead of asking the user for another full manifest. Do not silently describe those candidates as user-approved pixel-identical targets, or assign them invented patch versions. The original flagship also needs a documented visual target.

## Current network limitation

Direct requests to Wikipedia, PCGamingWiki, Steam's store, and GitHub's search API were rejected by the cloud CONNECT proxy with HTTP 403. Raw public GitHub files and read-only Git operations succeeded. A blocked request is not a missing reference or a missing user asset.

For broader public-reference access, the environment's existing network settings need additive access to `en.wikipedia.org`, `www.pcgamingwiki.com`, `store.steampowered.com`, and `api.github.com`; video-reference hosts may be identified later. The current custom allowlist could not be read with the available tools, so it was not replaced. No proxy, TLS, or verification bypass was attempted.

## What this research establishes

The project can begin public reference work without uploads. The seven accessed technical sources establish specific, limited facts; they do not establish complete visual coverage, all latest patch numbers, asset access, or a finished replica. Current games remain `fidelity: prototype`. Only measured side-by-side visual and gameplay comparisons against identified references can change that status.
