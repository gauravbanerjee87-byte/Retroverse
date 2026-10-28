import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import Phaser from 'phaser';
import { ARENA, GAMES } from '@retroverse/shared';
import { network } from '../services/network';
import { ArenaScene } from './scene';
export default function Arena() {
  const view = useSyncExternalStore(network.subscribe, network.snapshot);
  const game = GAMES.find((game) => game.id === (view.room?.gameId || 'neon-arena'))!;
  const container = useRef<HTMLDivElement>(null);
  const scene = useRef<ArenaScene | null>(null);
  const modal = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);
  const [exit, setExit] = useState(false);
  const [mute, setMute] = useState(localStorage.getItem('retroverse.mute') === 'true');
  const [now, setNow] = useState(Date.now());
  const [loaded, setLoaded] = useState(false);
  const [gameError, setGameError] = useState('');
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!container.current) return;
    const arenaScene = new ArenaScene();
    scene.current = arenaScene;
    let game: Phaser.Game | undefined;
    let cancelled = false;
    // Defer creation so StrictMode can cancel its discarded effect before Phaser boots.
    const boot = requestAnimationFrame(() => {
      if (cancelled) return;
      try {
        game = new Phaser.Game({
          type: Phaser.CANVAS,
          parent: container.current,
          width: ARENA.width,
          height: ARENA.height,
          backgroundColor: '#0b1423',
          scene: arenaScene,
          banner: false,
          audio: { noAudio: true },
          render: { antialias: false, pixelArt: true },
          scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
          callbacks: {
            postBoot: () => {
              if (!cancelled) setLoaded(true);
              else {
                arenaScene.dispose();
                game?.destroy(true);
              }
            },
          },
        });
      } catch {
        setGameError(
          'This browser could not initialize the game canvas. Try a current version of Chrome, Edge, or Firefox.',
        );
      }
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(boot);
      arenaScene.dispose();
      game?.destroy(true);
      scene.current = null;
    };
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (exit) setExit(false);
        else setPaused((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [exit]);
  useEffect(() => {
    scene.current?.controls?.setActive(!paused && !exit);
  }, [paused, exit, loaded]);
  useEffect(() => {
    if (!paused && !exit) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusable = () =>
      Array.from(
        modal.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), a[href], input, select, [tabindex="0"]',
        ) || [],
      );
    const frame = requestAnimationFrame(() => focusable()[0]?.focus());
    const trap = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const elements = focusable();
      const first = elements[0];
      const last = elements.at(-1);
      if (!first || !last) return;
      if (
        event.shiftKey &&
        (document.activeElement === first || !modal.current?.contains(document.activeElement))
      ) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last || !modal.current?.contains(document.activeElement))
      ) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', trap, true);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('keydown', trap, true);
      if (previous?.isConnected) previous.focus();
    };
  }, [paused, exit]);
  const room = view.room;
  const state = view.hud;
  if (!room || !state)
    return <div className="empty">Waiting for the authoritative game state…</div>;
  const me = state.players.find((p) => p.id === view.playerId);
  const remaining = Math.max(0, Math.ceil((state.endsAt - now) / 1000));
  const finished = room.status === 'finished';
  const scores = [...state.players].sort((a, b) => b.score - a.score);
  const scoreLabel = game.id === 'orbit-putt' ? 'Strokes' : state.info?.label || 'Knockouts';
  const scoreValue = (score: number) => (game.id === 'orbit-putt' ? Math.abs(score) : score);
  const turnName = state.players.find((player) => player.id === state.info?.turnId)?.name;
  const myTurn = !state.info?.turnId || state.info.turnId === view.playerId;
  const showHealth = ![
    'homebound-dice',
    'corner-pocket',
    'orbit-putt',
    'stack-surge',
    'paddle-pulse',
    'orbit-marbles',
  ].includes(game.id);
  function primary(choice?: number) {
    scene.current?.controls?.action(choice);
  }
  const winners = state.winnerIds
    .map((id) => state.players.find((p) => p.id === id)?.name)
    .filter(Boolean);
  const isHost = room.hostId === view.playerId;
  function toggleMute() {
    const value = !mute;
    setMute(value);
    localStorage.setItem('retroverse.mute', String(value));
  }
  function leave() {
    network.send({ type: 'leave' });
  }
  return (
    <section className="game-page" data-testid="game-screen">
      <div className="game-top">
        <div className="game-title">
          <h1>{game.name}</h1>
          <span>
            {game.modes.join(' / ').toUpperCase()} · {room.code}
          </span>
        </div>
        <div className="match-timer" aria-label={`${remaining} seconds remaining`}>
          {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')}
        </div>
        <div className="game-tools">
          <button onClick={toggleMute} aria-pressed={mute}>
            {mute ? 'Unmute' : 'Mute'}
          </button>
          <button onClick={() => setPaused(true)}>Game settings</button>
          <button onClick={() => setExit(true)}>Exit to library</button>
        </div>
      </div>
      <p className="desktop-warning">
        {game.controls.join(' and ')} controls. The website works on mobile; touch gameplay is not
        supported.
      </p>
      <div className="game-layout">
        <div>
          <div className="canvas-wrap">
            <div className="canvas-host" ref={container} />
            {(!loaded || gameError) && (
              <div className="game-loading" role="status">
                {gameError || 'Starting your arena…'}
              </div>
            )}
            {me && me.health <= 0 && !finished && (
              <div className="respawn-notice">
                {me.respawnAt > 0
                  ? `Back in the game in ${Math.max(1, Math.ceil((me.respawnAt - now) / 1000))}…`
                  : 'Out this round — watch the remaining players.'}
              </div>
            )}
            {finished ? (
              <div className="game-overlay" data-testid="match-results">
                <div className="panel">
                  <span className="eyebrow">THAT WAS A GOOD ROUND</span>
                  <h2>
                    {state.winnerIds.includes(view.playerId)
                      ? 'Victory looks good.'
                      : 'One more round?'}
                  </h2>
                  <p className="muted">
                    {winners.length
                      ? `${winners.join(' & ')} ${winners.length > 1 ? 'share the win' : 'takes the win'}.`
                      : 'The match has ended.'}
                  </p>
                  <div className="results-score">
                    {scores.map((p) => (
                      <p key={p.id}>
                        <span>
                          {p.name}
                          {p.id === view.playerId ? ' (you)' : ''}
                        </span>
                        <strong>
                          {scoreValue(p.score)} {scoreLabel}
                        </strong>
                      </p>
                    ))}
                  </div>
                  <div className="stack-actions">
                    {isHost ? (
                      <button className="button" onClick={() => network.send({ type: 'rematch' })}>
                        Rematch
                      </button>
                    ) : (
                      <p className="muted">Your host can open a rematch lobby.</p>
                    )}
                    <button className="button secondary" onClick={leave}>
                      Return to library
                    </button>
                  </div>
                </div>
              </div>
            ) : exit ? (
              <div className="game-overlay">
                <div
                  ref={modal}
                  className="panel"
                  role="dialog"
                  aria-modal="true"
                  aria-label="Leave match"
                >
                  <h2>Calling it a round?</h2>
                  <p>Leaving removes you from this room. The match continues for everyone else.</p>
                  <div className="stack-actions">
                    <button className="button secondary" autoFocus onClick={() => setExit(false)}>
                      Keep playing
                    </button>
                    <button className="button" onClick={leave}>
                      Leave match
                    </button>
                  </div>
                </div>
              </div>
            ) : paused ? (
              <div className="game-overlay">
                <div
                  ref={modal}
                  className="panel"
                  role="dialog"
                  aria-modal="true"
                  aria-label="Game settings"
                >
                  <h2>Take a breath.</h2>
                  <p>
                    The multiplayer match keeps running. Your movement and firing are released while
                    this panel is open.
                  </p>
                  <div className="stack-actions">
                    <button className="button secondary" onClick={toggleMute}>
                      {mute ? 'Unmute sound' : 'Mute sound'}
                    </button>
                    <button className="button" autoFocus onClick={() => setPaused(false)}>
                      Back to the arena
                    </button>
                  </div>
                  <button
                    className="text-button danger"
                    onClick={() => {
                      setPaused(false);
                      setExit(true);
                    }}
                  >
                    Leave match
                  </button>
                </div>
              </div>
            ) : null}
          </div>
          <div className="game-hints">
            <span>
              <kbd>WASD</kbd> Move
            </span>
            <span>
              <kbd>MOUSE</kbd> Aim · <kbd>SPACE</kbd> Action
            </span>
            <span>
              <kbd>ESC</kbd> Settings
            </span>
            <span>
              {view.latency === null
                ? 'Server-authoritative · 25 Hz'
                : `${view.latency} ms round trip · 25 Hz`}
            </span>
          </div>
        </div>
        <aside className="game-sidebar">
          <div className="panel">
            <h2>Your corner</h2>
            <strong style={{ fontSize: 13 }}>{me?.name || view.name}</strong>
            {showHealth && (
              <div className="hud-health">
                <span style={{ width: `${me?.health ?? 0}%` }} />
              </div>
            )}
            <span className="muted">
              {showHealth && `${me?.health ?? 0} / 100 health · `}
              {scoreValue(me?.score ?? 0)} {scoreLabel}
            </span>
            <h2 style={{ marginTop: 25 }}>The standings</h2>
            <ol className="score-list">
              {scores.map((p) => (
                <li key={p.id}>
                  <span>
                    <i className="score-dot" style={{ background: p.color }} />
                    {p.name}
                  </span>
                  <strong>{scoreValue(p.score)}</strong>
                </li>
              ))}
            </ol>
          </div>
          <div className="panel game-rules">
            <h2>Play your way</h2>
            {state.info && (
              <>
                <strong>
                  {state.info.phase ? state.info.phase.replaceAll('-', ' ') : game.name}
                </strong>
                <p role="status">{state.info.message}</p>
                {state.info.round !== undefined && (
                  <p>
                    {game.id === 'homebound-dice'
                      ? state.info.round
                        ? `Die: ${state.info.round}`
                        : 'Roll to begin'
                      : `Round ${state.info.round}`}
                  </p>
                )}
              </>
            )}
            {turnName && (
              <p className={myTurn ? 'ready-label' : 'muted'}>
                {myTurn ? 'Your turn' : `${turnName}’s turn`}
              </p>
            )}
            {view.secret && (
              <div className="private-role" role="status">
                <strong>Your private role</strong>
                <p>{view.secret}</p>
                <small>Only your guest receives this role. Keep it private.</small>
              </div>
            )}
            {!finished && (
              <div className="game-action-buttons">
                <button
                  className="button secondary"
                  disabled={!loaded || !myTurn || paused || exit}
                  onClick={() => primary()}
                >
                  {game.id === 'homebound-dice'
                    ? 'Roll dice'
                    : game.id === 'corner-pocket' || game.id === 'orbit-putt'
                      ? 'Take shot at cursor'
                      : 'Primary action (Space)'}
                </button>
                {game.id === 'homebound-dice' && (
                  <div className="token-actions" aria-label="Choose a token">
                    {[0, 1, 2, 3].map((choice) => (
                      <button
                        key={choice}
                        className="button secondary"
                        disabled={!myTurn || paused || exit}
                        onClick={() => primary(choice)}
                      >
                        Token {choice + 1}
                      </button>
                    ))}
                  </div>
                )}
                {game.id === 'hidden-signal' && (
                  <>
                    <button className="button secondary" onClick={() => primary(8)}>
                      Call meeting
                    </button>
                    <p className="muted">During a meeting, vote for a player:</p>
                    {state.players.map((player, index) => (
                      <button
                        className="button secondary"
                        key={player.id}
                        onClick={() => primary(index)}
                      >
                        Vote {player.name}
                      </button>
                    ))}
                    <button className="button secondary" onClick={() => primary(9)}>
                      Skip vote
                    </button>
                  </>
                )}
              </div>
            )}
            <ul className="instruction-list">
              {game.instructions.map((instruction) => (
                <li key={instruction}>{instruction}</li>
              ))}
            </ul>
          </div>
          <div className="panel">
            <h2>Match events</h2>
            {state.kills.length ? (
              <ul className="kill-feed">
                {state.kills
                  .slice(-5)
                  .reverse()
                  .map((k) => (
                    <li key={k.id}>
                      <b>{k.killer}</b> knocked out {k.victim}
                    </li>
                  ))}
              </ul>
            ) : (
              <p className="muted">Match actions and objectives are decided by the server.</p>
            )}
          </div>
        </aside>
      </div>
    </section>
  );
}
