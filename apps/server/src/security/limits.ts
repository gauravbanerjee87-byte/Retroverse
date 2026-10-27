/** Small per-connection token bucket. Uses monotonic elapsed time and a hard burst cap. */
export class TokenBucket {
  private tokens: number;
  private at: number;
  constructor(
    private readonly rate: number,
    private readonly capacity: number,
    now = Date.now(),
  ) {
    this.tokens = capacity;
    this.at = now;
  }
  take(now = Date.now()): boolean {
    this.tokens = Math.min(
      this.capacity,
      this.tokens + (Math.max(0, now - this.at) * this.rate) / 1000,
    );
    this.at = now;
    if (this.tokens < 1) return false;
    this.tokens -= 1;
    return true;
  }
}
