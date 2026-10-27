import { network } from '../services/network';
export class ArenaInput {
  private keys = new Set<string>();
  private timer: ReturnType<typeof setInterval>;
  private active = true;
  angle = 0;
  firing = false;
  private keyDown = (event: KeyboardEvent) => {
    if (
      !this.active ||
      event.target instanceof HTMLInputElement ||
      event.target instanceof HTMLSelectElement ||
      event.target instanceof HTMLTextAreaElement
    )
      return;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(event.key))
      event.preventDefault();
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
  private send() {
    const has = (a: string, b: string) => this.active && (this.keys.has(a) || this.keys.has(b));
    if (network.view.room?.status !== 'playing') return;
    network.input({
      up: has('w', 'arrowup'),
      down: has('s', 'arrowdown'),
      left: has('a', 'arrowleft'),
      right: has('d', 'arrowright'),
      angle: this.angle,
      fire: this.active && this.firing,
    });
  }
  destroy() {
    this.active = false;
    this.blur();
    clearInterval(this.timer);
    window.removeEventListener('keydown', this.keyDown);
    window.removeEventListener('keyup', this.keyUp);
    window.removeEventListener('blur', this.blur);
  }
}
