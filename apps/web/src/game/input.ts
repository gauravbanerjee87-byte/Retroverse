import { network } from '../services/network';
export class ArenaInput {
  private keys = new Set<string>();
  private timer: ReturnType<typeof setInterval>;
  private active = true;
  private destroyed = false;
  angle = 0;
  firing = false;
  targetX = 480;
  targetY = 300;
  private pulseUntil = 0;
  private choiceUntil = 0;
  private choice: number | undefined;
  private keyDown = (event: KeyboardEvent) => {
    if (
      !this.active ||
      event.target instanceof HTMLInputElement ||
      event.target instanceof HTMLSelectElement ||
      event.target instanceof HTMLTextAreaElement ||
      event.target instanceof HTMLButtonElement ||
      event.target instanceof HTMLAnchorElement
    )
      return;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(event.key))
      event.preventDefault();
    if (event.key === ' ' && !this.keys.has(' ')) this.action();
    this.keys.add(event.key.toLowerCase());
  };
  private keyUp = (event: KeyboardEvent) => {
    this.keys.delete(event.key.toLowerCase());
  };
  private blur = () => {
    this.keys.clear();
    this.firing = false;
    this.send();
  };
  constructor() {
    window.addEventListener('keydown', this.keyDown);
    window.addEventListener('keyup', this.keyUp);
    window.addEventListener('blur', this.blur);
    this.timer = setInterval(() => this.send(), 40);
  }
  setActive(active: boolean) {
    this.active = active;
    if (!active) this.blur();
  }
  action(choice?: number) {
    if (!this.active || this.destroyed) return;
    this.choice = choice;
    this.pulseUntil = performance.now() + 100;
    this.choiceUntil = performance.now() + 180;
    // Release then press so a button action is a new server-side edge.
    network.input({
      up: false,
      down: false,
      left: false,
      right: false,
      angle: Number.isFinite(this.angle) ? this.angle : 0,
      fire: false,
      targetX: this.coordinate(this.targetX, 960),
      targetY: this.coordinate(this.targetY, 600),
    });
    this.send();
  }
  private coordinate(value: number, max: number) {
    return Number.isFinite(value) ? Math.max(0, Math.min(max, value)) : max / 2;
  }
  private send() {
    if (this.destroyed) return;
    const has = (a: string, b: string) => this.active && (this.keys.has(a) || this.keys.has(b));
    if (network.view.room?.status !== 'playing') return;
    network.input({
      up: has('w', 'arrowup'),
      down: has('s', 'arrowdown'),
      left: has('a', 'arrowleft'),
      right: has('d', 'arrowright'),
      angle: Number.isFinite(this.angle) ? this.angle : 0,
      fire:
        this.active && (this.firing || this.keys.has(' ') || performance.now() < this.pulseUntil),
      ...(performance.now() < this.choiceUntil && this.choice !== undefined
        ? { choice: this.choice }
        : {}),
      targetX: this.coordinate(this.targetX, 960),
      targetY: this.coordinate(this.targetY, 600),
    });
  }
  destroy() {
    if (this.destroyed) return;
    this.active = false;
    this.blur();
    this.destroyed = true;
    clearInterval(this.timer);
    window.removeEventListener('keydown', this.keyDown);
    window.removeEventListener('keyup', this.keyUp);
    window.removeEventListener('blur', this.blur);
  }
}
