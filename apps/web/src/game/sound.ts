export class ArcadeSound {
  private context: AudioContext | null = null;
  unlock() {
    try {
      if (!this.context) this.context = new AudioContext();
      void this.context.resume().catch(() => undefined);
    } catch {
      /* Audio is optional on browsers without Web Audio support. */
    }
  }
  play(frequency = 250, duration = 0.045) {
    if (
      localStorage.getItem('retroverse.mute') === 'true' ||
      !this.context ||
      this.context.state !== 'running'
    )
      return;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = 'square';
    oscillator.frequency.setValueAtTime(frequency, this.context.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(
      frequency / 2,
      this.context.currentTime + duration,
    );
    gain.gain.setValueAtTime(0.025, this.context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.context.currentTime + duration);
    oscillator.connect(gain);
    gain.connect(this.context.destination);
    oscillator.start();
    oscillator.stop(this.context.currentTime + duration);
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
    };
  }
  destroy() {
    if (this.context) void this.context.close().catch(() => undefined);
    this.context = null;
  }
}
