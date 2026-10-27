import { rm } from 'node:fs/promises';
import { build } from 'esbuild';
import { URL } from 'node:url';
await rm(new URL('./dist', import.meta.url), { recursive: true, force: true });
await build({
  entryPoints: ['src/index.ts'],
  outdir: 'dist',
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  external: ['ws', 'zod'],
  sourcemap: true,
  logLevel: 'info',
});
