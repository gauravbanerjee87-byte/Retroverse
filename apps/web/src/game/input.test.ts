import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { inputSchema } from '@retroverse/shared';
import { ArenaInput } from './input';
import { network } from '../services/network';
vi.mock('../services/network', () => ({
  network: { view: { room: { status: 'playing' } }, input: vi.fn() },
}));
const instances: ArenaInput[] = [];
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('window', new EventTarget());
  for (const name of [
    'HTMLInputElement',
    'HTMLSelectElement',
    'HTMLTextAreaElement',
    'HTMLButtonElement',
    'HTMLAnchorElement',
  ])
    vi.stubGlobal(name, class {});
  vi.mocked(network.input).mockClear();
});
afterEach(() => {
  for (const input of instances.splice(0)) input.destroy();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
function input() {
  const controls = new ArenaInput();
  instances.push(controls);
  return controls;
}
describe('browser input lifecycle and action packets', () => {
  it('releases the discarded mount timer and emits only 25 regular inputs per second', () => {
    const discarded = input();
    discarded.destroy();
    discarded.destroy();
    input();
    vi.mocked(network.input).mockClear();
    vi.advanceTimersByTime(1000);
    expect(network.input).toHaveBeenCalledTimes(25);
  });
  it('captures a Space tap shorter than the regular input interval', () => {
    input();
    window.dispatchEvent(Object.assign(new Event('keydown'), { key: ' ' }));
    window.dispatchEvent(Object.assign(new Event('keyup'), { key: ' ' }));
    expect(vi.mocked(network.input).mock.calls.some(([packet]) => packet.fire)).toBe(true);
  });
  it('bounds outside-canvas coordinates on the immediate release and press packets', () => {
    const controls = input();
    controls.targetX = -200;
    controls.targetY = 900;
    controls.action(2);
    expect(network.input).toHaveBeenCalledTimes(2);
    for (const [packet] of vi.mocked(network.input).mock.calls) {
      expect(inputSchema.safeParse({ ...packet, seq: 1 }).success).toBe(true);
      expect(packet.targetX).toBe(0);
      expect(packet.targetY).toBe(600);
    }
    expect(vi.mocked(network.input).mock.calls[1][0]).toMatchObject({ fire: true, choice: 2 });
  });
  it('does not retain keyboard listeners or emit periodic inputs after destroy', () => {
    const controls = input();
    controls.destroy();
    vi.mocked(network.input).mockClear();
    window.dispatchEvent(Object.assign(new Event('keydown'), { key: ' ' }));
    vi.advanceTimersByTime(1000);
    expect(network.input).not.toHaveBeenCalled();
  });
});
