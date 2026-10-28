import { useId } from 'react';
import type { GameArtwork } from '@retroverse/shared';
export function Artwork({ kind = 'arena', hero = false }: { kind?: GameArtwork; hero?: boolean }) {
  const id = useId().replace(/:/g, '');
  if (kind !== 'arena') return <ThemedArtwork kind={kind} id={id} />;
  return (
    <svg
      className={`game-art ${hero ? 'hero-art' : ''}`}
      viewBox="0 0 640 400"
      role="img"
      aria-label="Original neon arena illustration with glowing geometric players"
    >
      <defs>
        <linearGradient id={`${id}bg`} x2="1" y2="1">
          <stop stopColor="#121e37" />
          <stop offset="1" stopColor="#281640" />
        </linearGradient>
        <linearGradient id={`${id}glow`}>
          <stop stopColor="#7cf3fa" />
          <stop offset="1" stopColor="#b88aff" />
        </linearGradient>
        <pattern id={`${id}grid`} width="32" height="32" patternUnits="userSpaceOnUse">
          <path d="M32 0H0V32" fill="none" stroke="#a2b6ff" strokeOpacity=".1" />
        </pattern>
        <filter id={`${id}blur`}>
          <feGaussianBlur stdDeviation="10" />
        </filter>
      </defs>
      <rect width="640" height="400" fill={`url(#${id}bg)`} />
      <rect width="640" height="400" fill={`url(#${id}grid)`} />
      {kind === 'arena' ? (
        <g>
          <ellipse cx="330" cy="310" rx="230" ry="44" fill="#071021" opacity=".7" />
          <g transform="translate(320 210) rotate(-27) skewX(26)">
            <rect
              x="-205"
              y="-125"
              width="410"
              height="250"
              rx="8"
              fill="#0e172c"
              stroke="#6d5fa9"
              strokeWidth="3"
            />
            <path
              d="M-188 -108H188V108H-188Z"
              fill={`url(#${id}grid)`}
              stroke="#60cfdb"
              strokeOpacity=".4"
            />
            <rect x="-100" y="-60" width="75" height="24" fill="#354275" stroke="#9c8ae6" />
            <rect x="45" y="45" width="80" height="25" fill="#354275" stroke="#9c8ae6" />
            <rect x="-10" y="-15" width="28" height="48" fill="#354275" stroke="#9c8ae6" />
            <path
              d="M-142 58L77 -48"
              stroke="#65ffff"
              strokeWidth="14"
              opacity=".3"
              filter={`url(#${id}blur)`}
            />
            <path d="M-134 52L62 -44" stroke="#71fbff" strokeWidth="3" strokeDasharray="9 12" />
            <circle cx="-147" cy="60" r="17" fill="#0c303b" stroke="#60f7ff" strokeWidth="4" />
            <circle cx="-147" cy="60" r="7" fill="#9bffff" />
            <circle cx="90" cy="-60" r="17" fill="#3c1638" stroke="#ff6bcd" strokeWidth="4" />
            <circle cx="90" cy="-60" r="7" fill="#ffb7eb" />
            <circle cx="135" cy="65" r="14" fill="#29164a" stroke="#a386ff" strokeWidth="4" />
            <path
              d="M82 -85L82 -100M106 -78L120 -88M114 -52L132 -52"
              stroke="#ff9cde"
              strokeWidth="3"
            />
          </g>
          <g fill="#65eef5">
            <rect x="96" y="105" width="5" height="5" />
            <rect x="530" y="275" width="7" height="7" />
            <path d="M510 90h14m-7-7v14" stroke="#65eef5" />
          </g>
        </g>
      ) : null}
      <path
        d="M20 20h20M20 20v20M620 20h-20M620 20v20M20 380h20M20 380v-20M620 380h-20M620 380v-20"
        stroke="#d0d4ff"
        strokeOpacity=".3"
        fill="none"
      />
    </svg>
  );
}

function ThemedArtwork({ kind, id }: { kind: GameArtwork; id: string }) {
  const palettes: Partial<Record<GameArtwork, [string, string]>> = {
    motorcycle: ['#ffb267', '#ff65a8'],
    city: ['#80ddde', '#bb88ff'],
    horror: ['#b1a3ef', '#72e2a5'],
    shooting: ['#69e5e8', '#e8a4a9'],
    board: ['#ffce77', '#ac8afa'],
    pool: ['#78e8bc', '#8cbdff'],
    golf: ['#9be4b4', '#d5b1ff'],
    blocks: ['#b79aff', '#f58bbe'],
    paddle: ['#83f4ed', '#e3a8ff'],
    social: ['#eab0fc', '#8fb9ef'],
  };
  const [accent, second] = palettes[kind] || ['#92b5ff', '#f08fd4'];
  let glyph;
  switch (kind) {
    case 'motorcycle':
      glyph = (
        <>
          <path d="M-170 60H170M-30 0 45-55 85-55M45-55 90 60M-85 60-30 0 55 10 90 60M-30 0-75-35-110-35" />
          <circle cx="-85" cy="60" r="43" />
          <circle cx="90" cy="60" r="43" />
          <path d="M-60-40 30-40 15-5H-20Z" fill={second} />
          <path d="M-160-20h-50m50 30h-80m80 30h-50" />
        </>
      );
      break;
    case 'city':
      glyph = (
        <>
          <path d="M-210 110V-40h65v150m20 0V-110h85v220m50 0V-65h80v175m30 0V-20h80v130M-230 110h460" />
          {[-100, -60, 30, 70, 150].map((x, i) => (
            <path key={x} d={`M${x} ${-40 + (i % 2) * 40}h12m-12 30h12m-12 30h12`} />
          ))}
          <path d="M-65 85-45 45h100l30 40v35H-65Z" fill={second} />
        </>
      );
      break;
    case 'shooting':
    case 'tactical':
      glyph = (
        <>
          <circle r="95" />
          <circle r="45" />
          <path d="M0-130v65M0 65v65M-130 0h65M65 0h65M-195-95h45m-45 0v45M195 95h-45m45 0v-45" />
          {kind === 'tactical' && <path d="m-20-20 70 20-70 65Z" fill={second} />}
        </>
      );
      break;
    case 'horror':
      glyph = (
        <>
          <path d="M-70 90-100-30-45-100 45-100 100-30 70 90 30 60 0 100-30 60Z" fill="#26392e" />
          <circle cx="-35" cy="-20" r="17" fill={second} />
          <circle cx="35" cy="-20" r="17" fill={second} />
          <path d="m-35 45 20-15 15 15 15-15 20 15M-155-95l-25 25m335 135 25 25" />
        </>
      );
      break;
    case 'stealth':
      glyph = (
        <>
          <path d="m0-120 100 45v80q0 85-100 130Q-100 90-100 5v-80Z" fill="#202b41" />
          <path d="m-55 0 55-40L55 0 0 40Z" />
          <circle r="15" fill={second} />
          <path d="M-180 100-145 65m290-130 35-35" />
        </>
      );
      break;
    case 'fighting':
      glyph = (
        <>
          <path
            d="M-30-50-80-100-125-70-100-20-45 10-80 95M-45 10 10 70M30-50 80-100 125-70 100-20 45 10 80 95M45 10-10 70"
            strokeWidth="16"
          />
          <circle cx="-70" cy="-115" r="25" fill={accent} />
          <circle cx="70" cy="-115" r="25" fill={second} />
          <path d="m-10-20 20-30-5 30h20l-30 40 5-40Z" fill={second} />
        </>
      );
      break;
    case 'kart':
    case 'racing':
      glyph = (
        <>
          <path
            d="m-220 135 140-220h160l140 220M0-70v50m0 25v50m0 25v50"
            strokeDasharray={kind === 'racing' ? '20 15' : undefined}
          />
          <path d="M-75 100V-5l30-45h90L75-5v105Z" fill={second} />
          <path d="M-50-15h100v55H-50Z" fill="#142138" />
          <path d="M-95 10v55m190-55v55" strokeWidth="18" />
        </>
      );
      break;
    case 'board':
      glyph = (
        <>
          {[
            [-100, -80],
            [30, -80],
            [-100, 50],
            [30, 50],
          ].map(([x, y], i) => (
            <g key={i} transform={`translate(${x} ${y})`}>
              <rect width="70" height="70" rx="12" fill={i % 2 ? second : accent} opacity=".8" />
              <circle cx="35" cy="35" r="9" fill="#142138" />
            </g>
          ))}
          <path d="M-15-90v190M-110 5H110" />
          <rect x="130" y="-20" width="65" height="65" rx="12" fill="#142138" />
          <circle cx="147" cy="-3" r="4" />
          <circle cx="177" cy="28" r="4" />
          <circle cx="162" cy="12" r="4" />
        </>
      );
      break;
    case 'pool':
      glyph = (
        <>
          <rect x="-200" y="-110" width="400" height="220" rx="30" fill="#173f38" />
          {[
            [-170, -80],
            [170, -80],
            [-170, 80],
            [170, 80],
            [0, -90],
            [0, 90],
          ].map(([x, y]) => (
            <circle key={`${x}${y}`} cx={x} cy={y} r="12" fill="#080f20" />
          ))}
          <circle cx="-95" cy="45" r="21" fill="#e5f7ff" />
          <circle cx="45" cy="-10" r="22" fill={second} />
          <circle cx="85" cy="30" r="22" fill="#121827" />
          <path d="m-220 110 115-55" strokeWidth="8" />
        </>
      );
      break;
    case 'bombs':
      glyph = (
        <>
          <circle cx="-10" cy="20" r="75" fill="#211e35" />
          <path d="M20-50q50-80 90-20m-5-25 5 25 30-10m-30 10 20 30M-140 55h-40m40-30h-25" />
          <circle cx="-35" cy="-5" r="12" fill={second} />
        </>
      );
      break;
    case 'obstacle':
    case 'platformer':
      glyph = (
        <>
          <path d="M-210 110h120V55h110V0h110v-55h100" strokeWidth="12" />
          <circle cx="-45" cy="-70" r="20" fill={second} />
          <path d="m-45-50 5 50-40 35m40-35 40 35m-40-55-40-10m40 10 35-35" strokeWidth="12" />
          {kind === 'obstacle' && <path d="m130 70 20-35 20 35 20-35 20 35" />}
        </>
      );
      break;
    case 'social':
      glyph = (
        <>
          <path
            d="M-140 10q0-70 60-70t60 70v85H-140ZM20 10q0-70 60-70t60 70v85H20Z"
            fill="#27324b"
          />
          <path d="M-120-5h80v35h-80M40-5h80v35H40" fill={accent} />
          <path d="M-10-110q0-30 25-30t25 30q0 20-25 30v15m0 15v5" stroke={second} />
        </>
      );
      break;
    case 'blocks':
    case 'puzzle':
      glyph = (
        <>
          {[
            [0, 0],
            [1, 0],
            [2, 0],
            [1, 1],
            [-2, 1],
            [-2, 2],
            [-1, 2],
            [0, 2],
            [2, 2],
            [2, 3],
          ].map(([x, y], i) => (
            <rect
              key={i}
              x={x * 52 - 25}
              y={y * 52 - 105}
              width="45"
              height="45"
              rx="6"
              fill={i % 3 ? second : accent}
            />
          ))}
        </>
      );
      break;
    case 'snake':
      glyph = (
        <>
          <path d="M-160 80H60q65 0 65-65v-45q0-60-65-60H-25q-60 0-60 60v25" strokeWidth="35" />
          <circle cx="-85" cy="-5" r="25" fill={second} />
          <circle cx="-93" cy="-10" r="4" fill="#121827" />
          <circle cx="-78" cy="-10" r="4" fill="#121827" />
          <circle cx="-170" cy="-70" r="18" fill={accent} />
        </>
      );
      break;
    case 'marbles':
      glyph = (
        <>
          <path d="M-200 80h300q80 0 80-70T100-60H-100" />
          {Array.from({ length: 10 }, (_, i) => (
            <circle key={i} cx={-180 + i * 35} cy={80} r="19" fill={i % 2 ? second : accent} />
          ))}
          <path d="M-25-10 25-10 10 30H-10Z" fill={second} />
          <circle cx="0" cy="-45" r="18" fill={accent} />
        </>
      );
      break;
    case 'paddle':
      glyph = (
        <>
          <path d="M-185-75v150M185-20v150" strokeWidth="20" />
          <path d="M0-125v250" strokeDasharray="10 15" />
          <circle cx="40" cy="-15" r="17" fill={second} />
          <path d="m-130 85 170-100 100-75" opacity=".4" />
        </>
      );
      break;
    case 'maze':
      glyph = (
        <>
          <path d="M-180-110H180V110H-180Z M-120-110v140h70v80M-60-50H65v100h60V-50h55M-180 65h65M0 50v60" />
          <circle cx="-150" cy="-80" r="14" fill={second} />
          <path d="m110 70 10 20 20 2-15 14 5 20-20-10-20 10 5-20-15-14 20-2Z" fill={accent} />
        </>
      );
      break;
    case 'cells':
      glyph = (
        <>
          <circle r="75" fill="#25354a" />
          <circle cx="-125" cy="-70" r="32" fill={second} />
          <circle cx="145" cy="65" r="40" fill={accent} />
          <circle cx="-130" cy="90" r="11" />
          <circle cx="120" cy="-90" r="14" />
          <circle cx="30" cy="0" r="14" fill={accent} />
          <circle cx="-25" cy="-20" r="9" fill={second} />
        </>
      );
      break;
    case 'golf':
      glyph = (
        <>
          <path d="M-200 110q15-130 140-150t250-55v205Z" fill="#1b3b36" />
          <ellipse cx="105" cy="20" rx="30" ry="12" fill="#071421" />
          <path d="M105 15V-110l75 30-75 15" fill={second} />
          <circle cx="-90" cy="70" r="20" fill="#efffff" />
          <path d="m-60 60 100-30" strokeDasharray="8 12" />
        </>
      );
      break;
    default:
      glyph = <circle r="80" />;
  }
  return (
    <svg
      className="game-art"
      viewBox="0 0 640 400"
      role="img"
      aria-label={`Original ${kind} game illustration`}
    >
      <defs>
        <linearGradient id={`${id}-theme`} x2="1" y2="1">
          <stop stopColor="#111e32" />
          <stop offset="1" stopColor="#291d3c" />
        </linearGradient>
        <pattern id={`${id}-grid`} width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M40 0H0V40" stroke={accent} opacity=".08" fill="none" />
        </pattern>
      </defs>
      <rect width="640" height="400" fill={`url(#${id}-theme)`} />
      <rect width="640" height="400" fill={`url(#${id}-grid)`} />
      <circle cx="320" cy="205" r="145" fill={accent} opacity=".035" />
      <g
        transform="translate(320 205)"
        stroke={accent}
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      >
        {glyph}
      </g>
      <path
        d="M20 45V20h25m550 0h25v25M20 355v25h25m550 0h25v-25"
        fill="none"
        stroke={second}
        opacity=".5"
      />
    </svg>
  );
}
