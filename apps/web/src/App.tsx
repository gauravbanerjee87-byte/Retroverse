import {
  lazy,
  Suspense,
  useEffect,
  useState,
  useSyncExternalStore,
  type FormEvent,
  type ReactNode,
} from 'react';
import {
  CATEGORIES,
  GAMES,
  type GameDefinition,
  type LeaderboardEntry,
  type MatchRecord,
} from '@retroverse/shared';
import { network, recentGames } from './services/network';
import { Artwork } from './components/Artwork';
const Arena = lazy(() => import('./game/Arena'));
function useRoute() {
  const [route, setRoute] = useState(location.hash.slice(1) || '/');
  useEffect(() => {
    const update = () => {
      setRoute(location.hash.slice(1) || '/');
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', update);
    return () => window.removeEventListener('hashchange', update);
  }, []);
  return route;
}
function useAPI<T>(url: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setData(null);
    setError('');
    fetch(url, { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error('The server could not load this data.');
        return r.json() as Promise<T>;
      })
      .then(setData)
      .catch((e: unknown) => {
        if (!controller.signal.aborted)
          setError(e instanceof Error ? e.message : 'Could not connect.');
      });
    return () => controller.abort();
  }, [url, retry]);
  return { data, error, reload: () => setRetry((v) => v + 1) };
}
function Icon({
  type,
}: {
  type: 'arrow' | 'game' | 'bolt' | 'users' | 'chevron' | 'search' | 'sound';
}) {
  const paths = {
    arrow: 'M5 12h14m-6-6 6 6-6 6',
    game: 'M6 7h12l3 10-3 1-3-3H9l-3 3-3-1 3-10Zm1 3v4m-2-2h4m7-1h.01m2 2h.01',
    bolt: 'm13 2-8 12h6l-1 8 9-13h-6l1-7Z',
    users:
      'M16 21v-3a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v3m18 0v-3a4 4 0 0 0-3-3.87M9 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm7-7.87a4 4 0 0 1 0 7.75',
    chevron: 'm9 5 7 7-7 7',
    search: 'm21 21-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z',
    sound: 'm11 5-6 4H2v6h3l6 4V5Zm4 3a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14',
  };
  return (
    <svg
      aria-hidden="true"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={paths[type]} />
    </svg>
  );
}
function ButtonLink({
  to,
  children,
  secondary = false,
}: {
  to: string;
  children: ReactNode;
  secondary?: boolean;
}) {
  return (
    <a className={`button ${secondary ? 'secondary' : ''}`} href={`#${to}`}>
      {children}
    </a>
  );
}
function PageIntro({ eyebrow, title, text }: { eyebrow: string; title: string; text: string }) {
  return (
    <div className="page-intro">
      <span className="eyebrow">{eyebrow}</span>
      <h1>{title}</h1>
      <p>{text}</p>
    </div>
  );
}
function Empty({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="empty">
      <span className="empty-symbol">✦</span>
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}
function ErrorBox({ message, retry }: { message: string; retry?: () => void }) {
  return (
    <div className="notice error" role="alert">
      {message}
      {retry && (
        <button className="text-button" onClick={retry}>
          Try again
        </button>
      )}
    </div>
  );
}
function GameCard({ game }: { game: GameDefinition }) {
  return (
    <article className="game-card">
      <a href={`#/game/${game.id}`} className="art-link" aria-label={`View ${game.name}`}>
        <Artwork kind={game.artwork} />
        <span className={`status-tag ${game.status}`}>
          {game.status === 'playable' ? 'PLAYABLE NOW' : 'IN THE PIPELINE'}
        </span>
        {game.featured && <span className="featured-tag">✦ ORIGINAL</span>}
      </a>
      <div className="card-body">
        <span className="card-genre">{game.genre}</span>
        <h3>
          <a href={`#/game/${game.id}`}>{game.name}</a>
        </h3>
        <p>
          {game.status === 'playable'
            ? 'Fast rounds. Bright lights. Friendly rivalries.'
            : game.description}
        </p>
        <div className="card-bottom">
          <span>
            <Icon type="users" />
            {game.minPlayers === game.maxPlayers
              ? game.minPlayers
              : `${game.minPlayers}–${game.maxPlayers}`}{' '}
            {game.multiplayer ? 'players' : 'player'}
          </span>
          <a href={`#/game/${game.id}`} aria-label={`Explore ${game.name}`}>
            <Icon type="arrow" />
          </a>
        </div>
      </div>
    </article>
  );
}
function Home() {
  const { data } = useAPI<{ onlinePlayers?: number; rooms?: number; queuedPlayers?: number }>(
    '/api/stats',
  );
  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <div className="pill">
            <span className="live-dot" /> THE ARCADE IS OPEN
          </div>
          <h1>
            Play a little.
            <br />
            Stay a <span>while.</span>
          </h1>
          <p>
            Old-school spirit. A whole new playground.
            <br className="desktop-br" /> Original browser games, good friends, and one more round.
          </p>
          <div className="hero-actions">
            <ButtonLink to="/game/neon-arena">
              <Icon type="game" /> Play Neon Arena <Icon type="arrow" />
            </ButtonLink>
            <ButtonLink to="/library" secondary>
              Explore the arcade
            </ButtonLink>
          </div>
          <div className="hero-facts">
            <span>
              <i /> Free to play
            </span>
            <span>
              <i /> No downloads
            </span>
            <span>
              <i /> Made for multiplayer
            </span>
          </div>
        </div>
        <div className="hero-visual">
          <div className="orbit-label">INSERT FRIENDS. START FUN.</div>
          <Artwork hero />
          <div className="hero-game-label">
            <span className="live-dot" />
            <div>
              <small>STEP INTO THE SPOTLIGHT</small>
              <strong>NEON ARENA</strong>
            </div>
            <a href="#/game/neon-arena" aria-label="Discover Neon Arena">
              <Icon type="arrow" />
            </a>
          </div>
          <span className="visual-corner">RV / ORIGINALS — 001</span>
        </div>
      </section>
      <div className="ticker" aria-label="Arcade features">
        <span>BUILT FOR GOOD TIMES</span>
        <b>✦</b>
        <span>REAL-TIME MULTIPLAYER</span>
        <b>✦</b>
        <span>NO INSTALLS. JUST PLAY.</span>
        <b>✦</b>
        <span>YOUR NEXT RIVAL IS A FRIEND</span>
        <b>✦</b>
      </div>
      <section className="section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">FIND YOUR NEXT OBSESSION</span>
            <h2>
              Small games. Big energy<span className="accent">.</span>
            </h2>
          </div>
          <a className="inline-link" href="#/library">
            View the library <Icon type="arrow" />
          </a>
        </div>
        <div className="game-grid">
          {GAMES.map((game) => (
            <GameCard key={game.id} game={game} />
          ))}
        </div>
        <p className="honest-note">
          One original game to play today. More ideas in the pipeline — clearly marked until they’re
          ready.
        </p>
      </section>
      <section className="friends-banner">
        <div className="friend-symbol">
          <Icon type="users" />
        </div>
        <div>
          <span className="eyebrow">BETTER WITH YOUR PEOPLE</span>
          <h2>Your crew. Your arena.</h2>
          <p>Create a room, send the link, and settle that friendly rivalry.</p>
        </div>
        <ButtonLink to="/room" secondary>
          Create a private room <Icon type="arrow" />
        </ButtonLink>
      </section>
      <section className="section how">
        <div>
          <span className="eyebrow">LESS SETUP. MORE PLAY.</span>
          <h2>
            Three steps to
            <br />
            “one more round.”
          </h2>
          <p>
            All you need is a modern browser,
            <br />a keyboard, and a little competitive spirit.
          </p>
        </div>
        <ol>
          <li>
            <span>01</span>
            <div>
              <h3>Pick your playground</h3>
              <p>Discover original arcade games made for the browser.</p>
            </div>
          </li>
          <li>
            <span>02</span>
            <div>
              <h3>Bring a friend. Or find a rival.</h3>
              <p>Share a private room or join the public queue.</p>
            </div>
          </li>
          <li>
            <span>03</span>
            <div>
              <h3>Make it a good game</h3>
              <p>Jump in, play fair, and chase your next high score.</p>
            </div>
          </li>
        </ol>
      </section>
      <div className="community-strip">
        <span className="live-dot" />
        <strong>LIVE FROM THIS SERVER</strong>
        <span>{data?.onlinePlayers ?? '—'} connected guests</span>
        <span>{data?.rooms ?? '—'} active rooms</span>
        <span>Guest prototype · scores reset on restart</span>
      </div>
    </>
  );
}
function Library() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All games');
  const [multi, setMulti] = useState(false);
  const [players, setPlayers] = useState('any');
  const [sort, setSort] = useState('featured');
  const recent = recentGames();
  const games = GAMES.filter(
    (g) =>
      (!search || `${g.name} ${g.description}`.toLowerCase().includes(search.toLowerCase())) &&
      (category === 'All games' || g.genre === category) &&
      (!multi || g.multiplayer) &&
      (players === 'any' || (Number(players) >= g.minPlayers && Number(players) <= g.maxPlayers)),
  ).sort((a, b) =>
    sort === 'name'
      ? a.name.localeCompare(b.name)
      : sort === 'recent'
        ? (recent.indexOf(a.id) === -1 ? 99 : recent.indexOf(a.id)) -
          (recent.indexOf(b.id) === -1 ? 99 : recent.indexOf(b.id))
        : Number(b.featured) - Number(a.featured),
  );
  return (
    <section className="section page">
      <PageIntro
        eyebrow="CHOOSE YOUR PLAYGROUND"
        title="The arcade library"
        text="Original worlds. Familiar fun. Find a game that feels like your kind of escape."
      />
      <div className="library-tools">
        <label className="search-box">
          <Icon type="search" />
          <input
            type="search"
            aria-label="Search games"
            placeholder="Search the arcade…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <label>
          Sort by
          <select aria-label="Sort games" value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="featured">Featured first</option>
            <option value="name">Name A–Z</option>
            <option value="recent">Recently played</option>
          </select>
        </label>
      </div>
      <div className="filter-row">
        {['All games', ...CATEGORIES].map((c) => (
          <button
            key={c}
            className={`filter-chip ${category === c ? 'selected' : ''}`}
            onClick={() => setCategory(c)}
          >
            {c}
          </button>
        ))}
      </div>
      <div className="filter-extras">
        <label className="checkbox">
          <input type="checkbox" checked={multi} onChange={(e) => setMulti(e.target.checked)} />{' '}
          Multiplayer only
        </label>
        <label>
          Players
          <select
            aria-label="Player count"
            value={players}
            onChange={(e) => setPlayers(e.target.value)}
          >
            <option value="any">Any group size</option>
            {[1, 2, 4, 8].map((n) => (
              <option key={n} value={n}>
                {n} players
              </option>
            ))}
          </select>
        </label>
        <span>
          {games.length} {games.length === 1 ? 'game' : 'games'}
        </span>
      </div>
      {games.length ? (
        <div className="game-grid">
          {games.map((g) => (
            <GameCard key={g.id} game={g} />
          ))}
        </div>
      ) : (
        <Empty title="No games in this corner yet">
          Try another category or a different search.
        </Empty>
      )}
    </section>
  );
}
function Details({ id }: { id: string }) {
  const game = GAMES.find((g) => g.id === id);
  if (!game) return <NotFound />;
  return (
    <section className="section page">
      <a className="back-link" href="#/library">
        ← Back to the arcade
      </a>
      <div className="details-grid">
        <div>
          <span className="eyebrow">{game.genre} / RETROVERSE ORIGINAL</span>
          <h1>{game.name}</h1>
          <p className="large-copy">{game.description}</p>
          <div className="detail-tags">
            <span>
              {game.minPlayers}–{game.maxPlayers} players
            </span>
            <span>{game.engine}</span>
            <span>v{game.version}</span>
            <span>{game.status === 'playable' ? 'Playable now' : 'Planned concept'}</span>
          </div>
          {game.status === 'playable' ? (
            <>
              <div className="stack-actions">
                <ButtonLink to="/matchmaking">
                  <Icon type="bolt" /> Quick match
                </ButtonLink>
                <ButtonLink to="/room" secondary>
                  Create or join a room <Icon type="users" />
                </ButtonLink>
              </div>
              <p className="honest-note">
                Requires 2 players, a keyboard, and a mouse. No bots. Invite a friend or wait for
                another guest in matchmaking.
              </p>
            </>
          ) : (
            <div className="notice">
              This game is an idea in the pipeline. Gameplay and a release date are not available.
            </div>
          )}
        </div>
        <Artwork kind={game.artwork} />
      </div>
      {game.status === 'playable' && (
        <div className="info-grid">
          <article className="panel">
            <h2>Know the controls</h2>
            <div className="control-row">
              <kbd>W A S D</kbd>
              <span>or arrow keys to move</span>
            </div>
            <div className="control-row">
              <kbd>MOUSE</kbd>
              <span>Aim · hold left click to fire</span>
            </div>
            <div className="control-row">
              <kbd>ESC</kbd>
              <span>Open game settings · match keeps running</span>
            </div>
          </article>
          <article className="panel">
            <h2>Make every shot count</h2>
            <ul className="instruction-list">
              {game.instructions.map((i) => (
                <li key={i}>{i}</li>
              ))}
            </ul>
            <p className="muted">
              Mode: {game.modes.join(', ')} · Short timed rounds · Server-authoritative scoring
            </p>
          </article>
        </div>
      )}
    </section>
  );
}
function RoomPage() {
  const view = useSyncExternalStore(network.subscribe, network.snapshot);
  const [code, setCode] = useState(
    new URLSearchParams(location.search).get('room')?.toUpperCase() || '',
  );
  const [capacity, setCapacity] = useState(8);
  const [copied, setCopied] = useState('');
  const room = view.room;
  const connected = view.status === 'connected';
  function join(e: FormEvent) {
    e.preventDefault();
    if (network.send({ type: 'join', code: code.trim().toUpperCase() })) {
      history.replaceState(null, '', `${location.pathname}${location.hash}`);
    }
  }
  if (room?.status === 'playing' || room?.status === 'finished')
    return (
      <Suspense fallback={<div className="empty">Loading Neon Arena…</div>}>
        <Arena />
      </Suspense>
    );
  if (!room)
    return (
      <section className="section page narrow">
        <PageIntro
          eyebrow="YOUR CREW. YOUR RULES."
          title="Meet in the arcade"
          text="Set up a private arena or enter an invitation from a friend."
        />
        <div className="info-grid">
          <form
            className="panel"
            onSubmit={(e) => {
              e.preventDefault();
              network.send({ type: 'create', capacity });
            }}
          >
            <span className="panel-icon">
              <Icon type="users" />
            </span>
            <h2>Start something good</h2>
            <p>Create a private Neon Arena lobby. Share your invite with 1–7 friends.</p>
            <label>
              Room capacity
              <select value={capacity} onChange={(e) => setCapacity(Number(e.target.value))}>
                {[2, 3, 4, 5, 6, 7, 8].map((n) => (
                  <option key={n} value={n}>
                    {n} players
                  </option>
                ))}
              </select>
            </label>
            <button className="button" disabled={!connected} type="submit">
              Create room <Icon type="arrow" />
            </button>
          </form>
          <form className="panel" onSubmit={join}>
            <span className="panel-icon purple">
              <Icon type="game" />
            </span>
            <h2>Got an invitation?</h2>
            <p>A room code is your way in. Ask your host for the 12-character code.</p>
            <label>
              Room code
              <input
                placeholder="A1B2C3D4E5F6"
                autoComplete="off"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                minLength={12}
                maxLength={12}
                pattern="[A-Fa-f0-9]{12}"
                required
              />
            </label>
            <button className="button secondary" disabled={!connected} type="submit">
              Join room <Icon type="arrow" />
            </button>
          </form>
        </div>
        <p className="muted">
          Your guest name: <strong>{view.name}</strong>. <a href="#/settings">Change in settings</a>
          .
        </p>
      </section>
    );
  const me = room.players.find((p) => p.id === view.playerId);
  const isHost = room.hostId === view.playerId;
  const canStart = room.players.length >= 2 && room.players.every((p) => p.ready && p.connected);
  return (
    <section className="section page narrow">
      <PageIntro
        eyebrow="PRIVATE NEON ARENA LOBBY"
        title="The gang’s almost here"
        text="Share the invite, ready up, and let the good games begin."
      />
      <div className="lobby-layout">
        <div className="panel">
          <div className="roster-heading">
            <h2>Player roster</h2>
            <span>
              {room.players.length} / {room.capacity}
            </span>
          </div>
          <ul className="roster">
            {room.players.map((p, i) => (
              <li key={p.id}>
                <span className={`avatar avatar-${i % 4}`}>{p.name.slice(0, 2).toUpperCase()}</span>
                <div>
                  <strong>
                    {p.name}
                    {p.id === view.playerId && ' (you)'}
                  </strong>
                  <small>
                    {p.id === room.hostId ? 'HOST' : 'PLAYER'}
                    {!p.connected && ' · Reconnecting'}
                  </small>
                </div>
                <span className={p.ready ? 'ready-label' : 'muted'}>
                  {p.ready ? 'Ready' : 'Not ready'}
                </span>
              </li>
            ))}
          </ul>
          {room.players.length < 2 && (
            <p className="notice">Invite at least one friend to start a match.</p>
          )}
          <div className="lobby-actions">
            <button
              className="button"
              onClick={() => network.send({ type: 'ready', ready: !me?.ready })}
              disabled={!connected}
            >
              {me?.ready ? 'Not ready' : 'Ready up'}
            </button>
            {isHost && (
              <button
                className="button secondary"
                disabled={!canStart || !connected}
                onClick={() => network.send({ type: 'start' })}
              >
                Start match <Icon type="arrow" />
              </button>
            )}
          </div>
          {isHost && !canStart && (
            <p className="muted">Everyone must be connected and ready before the host can start.</p>
          )}
          {!isHost && <p className="muted">Your host will start once everyone is ready.</p>}
        </div>
        <aside className="panel invite-panel">
          <span className="eyebrow">THE SECRET HANDSHAKE</span>
          <h2>Invite your people</h2>
          <p>Room code</p>
          <strong className="room-code" data-testid="room-code">
            {room.code}
          </strong>
          <button
            className="button secondary"
            onClick={() => {
              const url = new URL(location.href);
              url.hash = '/room';
              url.search = `?room=${room.code}`;
              if (!navigator.clipboard) {
                setCopied(`Invitation: ${url.toString()}`);
                return;
              }
              navigator.clipboard
                .writeText(url.toString())
                .then(() => setCopied('Invitation copied!'))
                .catch(() => setCopied(`Copy this code: ${room.code}`));
            }}
          >
            Copy invite link
          </button>
          <span role="status" className="muted">
            {copied}
          </span>
          <hr />
          <p>Neon Arena · Deathmatch</p>
          <small className="muted">
            Keyboard + mouse required. Rooms and guest sessions are temporary.
          </small>
          <button className="text-button danger" onClick={() => network.send({ type: 'leave' })}>
            Leave room
          </button>
        </aside>
      </div>
    </section>
  );
}
function Matchmaking() {
  const view = useSyncExternalStore(network.subscribe, network.snapshot);
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (view.queued === null) {
      setElapsed(0);
      return;
    }
    const timer = setInterval(() => setElapsed((v) => v + 1), 1000);
    return () => clearInterval(timer);
  }, [view.queued]);
  return (
    <section className="section page narrow">
      <PageIntro
        eyebrow="NEW RIVALS. SAME GOOD ENERGY."
        title="Find your next match"
        text="Join a fair, first-in, first-out queue for Neon Arena. Two connected guests start a round."
      />
      <div className="matchmaking-panel panel">
        <div className={`queue-symbol ${view.queued !== null ? 'searching' : ''}`}>
          <Icon type="bolt" />
        </div>
        <h2>
          {view.queued !== null ? 'Finding your next rival…' : 'A little friendly competition?'}
        </h2>
        <p>
          {view.queued !== null
            ? `Waiting ${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')} · Queue position ${view.queued}`
            : 'Neon Arena · 2 players · Deathmatch'}
        </p>
        {view.queued !== null ? (
          <>
            <button
              className="button secondary"
              onClick={() => network.send({ type: 'cancel_queue' })}
            >
              Cancel search
            </button>
            <p className="muted">
              A match starts automatically when another guest joins. There are no bots.
            </p>
          </>
        ) : (
          <>
            <button
              className="button"
              disabled={view.status !== 'connected' || Boolean(view.room)}
              onClick={() =>
                network.send({ type: 'queue', gameId: 'neon-arena', mode: 'deathmatch' })
              }
            >
              Find match <Icon type="arrow" />
            </button>
            {view.room ? (
              <p className="notice">
                Leave your current room before joining the queue. <a href="#/room">Go to room</a>.
              </p>
            ) : (
              <p className="muted">
                Prefer a familiar face? <a href="#/room">Create a private room</a>.
              </p>
            )}
          </>
        )}
        {elapsed >= 60 && (
          <p className="notice">
            It’s quiet right now. You can keep waiting or invite a friend into the queue.
          </p>
        )}
      </div>
    </section>
  );
}
function ResultsTable({ records, playerId }: { records: MatchRecord[]; playerId?: string }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Match</th>
            <th>Result</th>
            <th>Knockouts</th>
            <th>Played</th>
          </tr>
        </thead>
        <tbody>
          {records.map((r) => {
            const p = r.players.find((p) => p.id === playerId);
            return (
              <tr key={r.id}>
                <td>
                  Neon Arena
                  <small>
                    {r.players.length} players · {r.roomCode}
                  </small>
                </td>
                <td>
                  {playerId
                    ? r.winnerIds.includes(playerId)
                      ? 'Victory'
                      : 'Completed'
                    : r.winnerIds
                        .map((id) => r.players.find((p) => p.id === id)?.name)
                        .join(', ') || 'Draw'}
                </td>
                <td>{p?.score ?? r.players.reduce((s, p) => s + p.score, 0)}</td>
                <td>{new Date(r.endedAt).toLocaleString()}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
function PlayerProfile({ historyOnly = false }: { historyOnly?: boolean }) {
  const view = useSyncExternalStore(network.subscribe, network.snapshot);
  const { data, error, reload } = useAPI<MatchRecord[] | { matches: MatchRecord[] }>(
    `/api/history?playerId=${encodeURIComponent(view.playerId || 'pending-guest')}`,
  );
  const records = data ? (Array.isArray(data) ? data : data.matches) : [];
  const wins = records.filter((r) => r.winnerIds.includes(view.playerId)).length;
  const kills = records.reduce(
    (n, r) => n + (r.players.find((p) => p.id === view.playerId)?.score || 0),
    0,
  );
  return (
    <section className="section page">
      <PageIntro
        eyebrow={historyOnly ? 'EVERY ROUND HAS A STORY' : 'YOUR CORNER OF THE ARCADE'}
        title={historyOnly ? 'Match history' : `Hey, ${view.name}`}
        text="Your current guest session, all in one place. This data is held in memory and resets when the server restarts."
      />
      {!historyOnly && (
        <>
          <div className="profile-stats">
            <article className="panel">
              <span>Matches played</span>
              <strong>{records.length}</strong>
            </article>
            <article className="panel">
              <span>Victories</span>
              <strong>{wins}</strong>
            </article>
            <article className="panel">
              <span>Knockouts</span>
              <strong>{kills}</strong>
            </article>
          </div>
          <div className="notice">
            You’re playing as a temporary guest. Persistent accounts, friends, avatars, and
            achievements belong to a future phase.
          </div>
          <div className="section-heading">
            <h2>Your recent rounds</h2>
            <a className="inline-link" href="#/history">
              All match history <Icon type="arrow" />
            </a>
          </div>
        </>
      )}
      {error ? (
        <ErrorBox message={error} retry={reload} />
      ) : !data ? (
        <p role="status">Loading match history…</p>
      ) : records.length ? (
        <ResultsTable
          records={historyOnly ? records : records.slice(0, 5)}
          playerId={view.playerId}
        />
      ) : (
        <Empty title="A fresh start">
          Play your first Neon Arena match to write a little arcade history.
        </Empty>
      )}
      <div className="stack-actions">
        <ButtonLink to="/game/neon-arena">
          Play Neon Arena <Icon type="arrow" />
        </ButtonLink>
      </div>
    </section>
  );
}
function Leaderboards() {
  const { data, error, reload } = useAPI<LeaderboardEntry[] | { entries: LeaderboardEntry[] }>(
    '/api/leaderboard',
  );
  const entries = data ? (Array.isArray(data) ? data : data.entries) : [];
  return (
    <section className="section page">
      <PageIntro
        eyebrow="A LITTLE BRAGGING IS ALLOWED"
        title="The high-score crowd"
        text="Neon Arena results from this server’s current run. Guest scores are temporary, with no skill rating or global ranking."
      />
      {error ? (
        <ErrorBox message={error} retry={reload} />
      ) : !data ? (
        <p role="status">Loading leaderboard…</p>
      ) : entries.length ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Rank</th>
                <th>Player</th>
                <th>Wins</th>
                <th>Knockouts</th>
                <th>Matches</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((p, i) => (
                <tr key={p.id}>
                  <td className="rank">{String(i + 1).padStart(2, '0')}</td>
                  <td>{p.name}</td>
                  <td>{p.wins}</td>
                  <td>{p.kills}</td>
                  <td>{p.matches}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty title="The top spot is wide open">Finish a match to put a name on the board.</Empty>
      )}
      <div className="stack-actions">
        <button className="button secondary" onClick={reload}>
          Refresh scores
        </button>
        <ButtonLink to="/matchmaking">
          Find a match <Icon type="arrow" />
        </ButtonLink>
      </div>
    </section>
  );
}
function Settings() {
  const view = useSyncExternalStore(network.subscribe, network.snapshot);
  const [name, setName] = useState(view.name);
  const [mute, setMute] = useState(localStorage.getItem('retroverse.mute') === 'true');
  const [reduced, setReduced] = useState(localStorage.getItem('retroverse.reduced') === 'true');
  const [message, setMessage] = useState('');
  function save(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!/^[\p{L}\p{N} _-]{2,20}$/u.test(trimmed)) {
      setMessage('Choose 2–20 letters, numbers, spaces, underscores or hyphens.');
      return;
    }
    localStorage.setItem('retroverse.mute', String(mute));
    localStorage.setItem('retroverse.reduced', String(reduced));
    document.documentElement.dataset.reduced = String(reduced);
    window.dispatchEvent(new Event('retroverse-settings'));
    if (trimmed !== view.name) network.setName(trimmed);
    setMessage('Settings saved on this browser.');
  }
  return (
    <section className="section page narrow">
      <PageIntro
        eyebrow="MAKE YOURSELF AT HOME"
        title="Your settings"
        text="Small adjustments for a better time in the arcade."
      />
      <form className="panel settings-form" onSubmit={save}>
        <label>
          Display name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            minLength={2}
            maxLength={20}
            required
            autoComplete="nickname"
          />
        </label>
        <p className="muted">
          Your guest name is public in rooms and match results. Saving a new name reconnects your
          session.
        </p>
        <label className="toggle-row">
          <div>
            <strong>Mute game sound</strong>
            <small>Turn off generated arcade sound effects.</small>
          </div>
          <input type="checkbox" checked={mute} onChange={(e) => setMute(e.target.checked)} />
        </label>
        <label className="toggle-row">
          <div>
            <strong>Reduce visual effects</strong>
            <small>Keep animation and decorative effects to a minimum.</small>
          </div>
          <input type="checkbox" checked={reduced} onChange={(e) => setReduced(e.target.checked)} />
        </label>
        <button className="button" type="submit">
          Save settings
        </button>
        <p role="status">{message}</p>
      </form>
      <div className="notice">
        No passwords or permanent accounts are used in this prototype. Your guest credential stays
        in session storage and expires on the server.
      </div>
    </section>
  );
}
function NotFound() {
  return (
    <section className="section page narrow">
      <PageIntro
        eyebrow="404 / WRONG TURN"
        title="This cabinet is empty"
        text="The page you’re looking for isn’t in this arcade."
      />
      <ButtonLink to="/library">
        Back to the games <Icon type="arrow" />
      </ButtonLink>
    </section>
  );
}
export default function App() {
  const route = useRoute();
  const view = useSyncExternalStore(network.subscribe, network.snapshot);
  const [menu, setMenu] = useState(false);
  useEffect(() => {
    network.connect();
    document.documentElement.dataset.reduced =
      localStorage.getItem('retroverse.reduced') || 'false';
    if (new URLSearchParams(location.search).has('room')) location.hash = '#/room';
  }, []);
  useEffect(() => setMenu(false), [route]);
  const inGame = route === '/room' && view.room?.status === 'playing';
  let content: ReactNode;
  if (route === '/') content = <Home />;
  else if (route === '/library') content = <Library />;
  else if (route.startsWith('/game/')) content = <Details id={route.slice(6)} />;
  else if (route === '/room') content = <RoomPage />;
  else if (route === '/matchmaking') content = <Matchmaking />;
  else if (route === '/profile') content = <PlayerProfile />;
  else if (route === '/history') content = <PlayerProfile historyOnly />;
  else if (route === '/leaderboards') content = <Leaderboards />;
  else if (route === '/settings') content = <Settings />;
  else content = <NotFound />;
  return (
    <>
      <a
        className="skip-link"
        href="#main"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById('main')?.focus();
        }}
      >
        Skip to content
      </a>
      <header className="site-header">
        <a href="#/" className="brand" aria-label="RetroVerse home">
          <span className="brand-mark">
            <Icon type="game" />
          </span>
          <span>
            retro<span className="brand-light">verse</span>
            <i>✦</i>
          </span>
        </a>
        <button
          className="menu-button"
          aria-expanded={menu}
          aria-controls="main-navigation"
          onClick={() => setMenu(!menu)}
        >
          Menu
        </button>
        <nav id="main-navigation" className={menu ? 'open' : ''} aria-label="Main navigation">
          <a className={route === '/' ? 'active' : ''} href="#/">
            Home
          </a>
          <a className={route === '/library' ? 'active' : ''} href="#/library">
            Library
          </a>
          <a className={route === '/matchmaking' ? 'active' : ''} href="#/matchmaking">
            Multiplayer
          </a>
          <a className={route === '/leaderboards' ? 'active' : ''} href="#/leaderboards">
            Leaderboards
          </a>
          {view.room && (
            <a href="#/room" className="room-nav">
              Your room
            </a>
          )}
        </nav>
        <div className="header-right">
          <span className={`connection ${view.status}`} role="status">
            <i />
            {view.status === 'connected'
              ? 'Connected'
              : view.status === 'offline'
                ? 'Offline'
                : 'Connecting'}
          </span>
          <a className="guest-link" href="#/profile" aria-label="Profile">
            <span className="avatar avatar-small">{view.name.slice(0, 1).toUpperCase()}</span>
            <span>{view.name}</span>
          </a>
          <a className="settings-link" href="#/settings" aria-label="Settings">
            ⚙
          </a>
        </div>
      </header>
      {view.status !== 'connected' && (
        <div className="connection-banner" role="status">
          {view.status === 'offline' ? (
            <>
              The server is unavailable. <button onClick={network.connect}>Reconnect</button>
            </>
          ) : (
            'Connecting to the arcade server…'
          )}
          {view.room && ' Reconnecting guests keep their place briefly. The match continues.'}
        </div>
      )}
      {view.error && (
        <div className="global-error" role="alert">
          <span>{view.error}</span>
          <button aria-label="Dismiss error" onClick={() => network.clearError()}>
            ×
          </button>
        </div>
      )}
      <main id="main" tabIndex={-1} className={inGame ? 'game-main' : ''}>
        {content}
      </main>
      {!inGame && (
        <footer className="site-footer">
          <div>
            <a href="#/" className="brand">
              retro<span className="brand-light">verse</span>
              <i>✦</i>
            </a>
            <p>Old-school soul. New-school play.</p>
          </div>
          <nav aria-label="Footer navigation">
            <a href="#/library">The arcade</a>
            <a href="#/room">Play with friends</a>
            <a href="#/history">Match history</a>
            <a href="#/settings">Settings</a>
          </nav>
          <div className="footer-note">
            Made for the love of the game.
            <br />
            <span>Original games · Guest prototype · No paid features</span>
          </div>
        </footer>
      )}
    </>
  );
}
