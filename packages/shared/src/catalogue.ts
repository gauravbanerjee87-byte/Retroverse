export const CATEGORIES = [
  'Racing',
  'Arcade shooting',
  'Arena combat',
  'Fighting',
  'Sports',
  'Platformers',
  'Puzzle',
  'Strategy',
  'Co-op adventure',
] as const;
export interface GameDefinition {
  id: string;
  name: string;
  description: string;
  genre: (typeof CATEGORIES)[number];
  artwork: 'arena' | 'racing' | 'puzzle';
  minPlayers: number;
  maxPlayers: number;
  controls: string[];
  multiplayer: boolean;
  status: 'playable' | 'planned';
  engine: string;
  version: string;
  instructions: string[];
  modes: string[];
  featured: boolean;
}
export const GAMES: GameDefinition[] = [
  {
    id: 'neon-arena',
    name: 'Neon Arena',
    description:
      'Every angle is an opportunity. Dash between neon cover, line up your shot, and own the arena in a fast, original multiplayer deathmatch.',
    genre: 'Arena combat',
    artwork: 'arena',
    minPlayers: 2,
    maxPlayers: 8,
    controls: ['Keyboard', 'Mouse'],
    multiplayer: true,
    status: 'playable',
    engine: 'Phaser 3',
    version: '0.1.0',
    instructions: [
      'Move with WASD or arrow keys.',
      'Aim with your mouse. Hold left click to fire.',
      'Four hits score a knockout. Respawn after 1.8 seconds.',
      'Most knockouts at the end of the timer wins. Ties share the win.',
    ],
    modes: ['Deathmatch'],
    featured: true,
  },
  {
    id: 'night-circuit',
    name: 'Night Circuit',
    description: 'An original street-racing concept. Not yet implemented.',
    genre: 'Racing',
    artwork: 'racing',
    minPlayers: 2,
    maxPlayers: 8,
    controls: ['Keyboard'],
    multiplayer: true,
    status: 'planned',
    engine: 'Unassigned',
    version: '0.0.0',
    instructions: [],
    modes: [],
    featured: false,
  },
  {
    id: 'prism-shift',
    name: 'Prism Shift',
    description:
      'A geometric puzzle concept for a quieter kind of high score. Not yet implemented.',
    genre: 'Puzzle',
    artwork: 'puzzle',
    minPlayers: 1,
    maxPlayers: 1,
    controls: ['Keyboard'],
    multiplayer: false,
    status: 'planned',
    engine: 'Unassigned',
    version: '0.0.0',
    instructions: [],
    modes: [],
    featured: false,
  },
];
