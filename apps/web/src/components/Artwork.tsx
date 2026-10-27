import { useId } from 'react';
export function Artwork({
  kind = 'arena',
  hero = false,
}: {
  kind?: 'arena' | 'racing' | 'puzzle';
  hero?: boolean;
}) {
  const id = useId().replace(/:/g, '');
  return (
    <svg
      className={`game-art ${hero ? 'hero-art' : ''}`}
      viewBox="0 0 640 400"
      role="img"
      aria-label={
        kind === 'arena'
          ? 'Original neon arena illustration with glowing geometric players'
          : kind === 'racing'
            ? 'Original neon road illustration'
            : 'Original geometric puzzle illustration'
      }
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
      ) : kind === 'racing' ? (
        <g>
          <path d="M270 130L50 400H590L370 130Z" fill="#101524" stroke="#9465dd" strokeWidth="3" />
          <path d="M320 145V400" stroke="#d67afb" strokeWidth="4" strokeDasharray="20 24" />
          <circle cx="320" cy="110" r="55" fill="#f977ac" opacity=".8" />
          <path d="M0 140H640M0 154H640M0 175H640" stroke="#a56bde" />
          <path
            d="M260 350v-65l25-25h70l25 25v65Z"
            fill="#7543b5"
            stroke="#efa9ff"
            strokeWidth="3"
          />
          <rect x="279" y="276" width="81" height="36" fill="#152033" />
          <path d="M267 332h30m46 0h30" stroke="#84f7ff" strokeWidth="7" />
        </g>
      ) : (
        <g transform="translate(170 70) rotate(-10 150 120)">
          {Array.from({ length: 9 }, (_, i) => (
            <rect
              key={i}
              x={(i % 3) * 92}
              y={Math.floor(i / 3) * 84}
              width="75"
              height="68"
              rx="10"
              fill={['#8357da', '#335f83', '#9b448e'][i % 3]}
              stroke={['#b794ff', '#66ddf1', '#f989cf'][i % 3]}
              strokeWidth="3"
            />
          ))}
        </g>
      )}
      <path
        d="M20 20h20M20 20v20M620 20h-20M620 20v20M20 380h20M20 380v-20M620 380h-20M620 380v-20"
        stroke="#d0d4ff"
        strokeOpacity=".3"
        fill="none"
      />
    </svg>
  );
}
