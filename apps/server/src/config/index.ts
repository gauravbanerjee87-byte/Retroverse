import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { resolve } from 'node:path';

export interface ServerConfig {
  port: number;
  host: string;
  production: boolean;
  origins: string[];
  matchSeconds: number;
  disconnectGraceMs: number;
  roomTtlMs: number;
  sessionTtlMs: number;
  maxConnections: number;
  maxConnectionsPerIp: number;
  maxRooms: number;
  maxSessions: number;
  staticDir: string;
  silent: boolean;
}
export function readConfig(): ServerConfig {
  const candidate = [resolve(process.cwd(), '.env'), resolve(process.cwd(), '../../.env')].find(
    existsSync,
  );
  if (candidate) loadEnvFile(candidate);
  if (process.env.NODE_ENV && !['development', 'test', 'production'].includes(process.env.NODE_ENV))
    throw new Error('NODE_ENV must be development, test or production');
  const production = process.env.NODE_ENV === 'production';
  const port = numberSetting('PORT', 3001, 1, 65535);
  const matchSeconds = numberSetting('MATCH_SECONDS', 120, 5, 600);
  const origins = (
    process.env.WEB_ORIGINS ??
    (production
      ? ''
      : 'http://localhost:5173,http://127.0.0.1:5173,http://localhost:3001,http://127.0.0.1:3001')
  )
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
  if (production && !origins.length)
    throw new Error('WEB_ORIGINS must explicitly list the HTTPS frontend origin in production');
  for (const origin of origins) {
    const parsed = new URL(origin);
    if (parsed.origin !== origin || !['http:', 'https:'].includes(parsed.protocol))
      throw new Error('WEB_ORIGINS must contain complete origins without a path');
    if (production && parsed.protocol !== 'https:')
      throw new Error('Production WEB_ORIGINS must use HTTPS');
  }
  return {
    port,
    host: process.env.HOST ?? '127.0.0.1',
    production,
    origins,
    matchSeconds,
    disconnectGraceMs: 15000,
    roomTtlMs: 30 * 60000,
    sessionTtlMs: 10 * 60000,
    maxConnections: 200,
    maxConnectionsPerIp: 16,
    maxRooms: 100,
    maxSessions: 1000,
    staticDir: resolve(process.cwd(), 'dist'),
    silent: false,
  };
}
function numberSetting(name: string, fallback: number, min: number, max: number): number {
  const value = process.env[name] === undefined ? fallback : Number(process.env[name]);
  if (!Number.isInteger(value) || value < min || value > max)
    throw new Error(`${name} must be an integer between ${min} and ${max}`);
  return value;
}
