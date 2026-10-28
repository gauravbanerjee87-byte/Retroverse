# Future persistence design

No database is used by the current MVP. This is a design for a later authenticated phase, not an applied schema or an available feature. Use PostgreSQL and a maintained migration tool when durable accounts/history justify it; avoid automatic production schema synchronization.

| Table                | Core data and constraints                                                                                                                     |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `users`              | UUID primary key, unique normalized email/provider identity, created/disabled timestamps; password hash only if password login is implemented |
| `profiles`           | One-to-one user FK, display name, avatar reference, public visibility controls                                                                |
| `games`              | Unique stable game ID, version, licensed metadata, release status                                                                             |
| `matches`            | UUID, game/version FK, mode, server start/end time, completion status; index `(game_id, ended_at)`                                            |
| `match_participants` | Unique `(match_id, user_id)`, scores, deaths, result; indexes by user/time for history                                                        |
| `scores`             | Server-validated score, game/mode/season, user/match FK; ranking index by game/season/score                                                   |
| `achievements`       | Unique game/key definition plus a unique user/achievement grant relation                                                                      |
| `friends`            | Canonical ordered user-pair unique constraint, request/accepted state; prohibit self-pairs                                                    |
| `reports`            | Reporter/reported-user/match references, category, moderation status, timestamp; restricted access                                            |
| `account_settings`   | One row per user, preference schema version, privacy choices                                                                                  |

Store stable `game_id` and the rule-version on each match; the 25 titles have different score meanings and win conditions. Rank within game/mode/season rather than adding unlike scores. Hidden roles are transient secrets and should not be exposed through a public replay/history table.

Persist completed match and participant rows in a transaction using a server-generated unique match ID, so retries cannot duplicate scores. Never accept client-submitted authoritative outcomes. Add foreign keys, nonnegative score checks, status enums/check constraints, and explicit deletion behavior. Profile display names need not be unique; account identity must be independently authenticated.

Migration files should be committed, reviewed, applied by an explicit deployment step, and tested on a disposable database plus a copy of representative data. Destructive migrations require backup and a rollback/recovery plan. Test backup restoration rather than assuming snapshots are usable.

Define retention before collecting data: minimize IP/security logs, restrict moderation records, support account export/deletion, and decide whether historical match labels are anonymized on deletion. Encrypt transport and backups, isolate database credentials, and separate application runtime privileges from migration privileges.

Redis should be introduced only if multiple instances need coordinated queues, shared rate limits, session lookup, or room routing. An authoritative room simulation still needs a single owner and a designed failure/recovery model; a cache alone does not solve distributed game state.
