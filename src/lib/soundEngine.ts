// Sound Engine — synthesized sounds using Web Audio API only. No external files.

class SoundEngine {
  private ctx: AudioContext | null = null;
  private lastPriceTick = 0;

  init() {
    if (this.ctx) return;
    try {
      this.ctx = new AudioContext();
    } catch {
      // AudioContext not available (SSR or restricted)
    }
  }

  private getCtx(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      try {
        this.ctx = new AudioContext();
      } catch {
        return null;
      }
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  createWhiteNoise(ctx: AudioContext, duration: number): AudioBufferSourceNode {
    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    return source;
  }

  playCannonFire() {
    const ctx = this.getCtx();
    if (!ctx) return;

    const now = ctx.currentTime;

    // Deep boom: sawtooth oscillator 80→20Hz
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(80, now);
    osc.frequency.exponentialRampToValueAtTime(20, now + 0.4);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.8, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.4);

    // Add noise burst for texture
    const noise = this.createWhiteNoise(ctx, 0.15);
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.3, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    noise.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noise.start(now);
  }

  playTorpedoHit() {
    const ctx = this.getCtx();
    if (!ctx) return;

    const now = ctx.currentTime;

    // Underwater thud: sine 120Hz
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(120, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.3);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.6, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.3);

    // Noise component
    const noise = this.createWhiteNoise(ctx, 0.3);
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.2, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

    // Low pass filter for underwater feel
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(400, now);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noise.start(now);
  }

  playExplosion() {
    const ctx = this.getCtx();
    if (!ctx) return;

    const now = ctx.currentTime;

    // White noise burst
    const noise = this.createWhiteNoise(ctx, 1.2);
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(1.0, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
    noise.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noise.start(now);

    // Low rumble
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(60, now);
    osc.frequency.exponentialRampToValueAtTime(15, now + 1.0);
    const oscGain = ctx.createGain();
    oscGain.gain.setValueAtTime(0.7, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 1.0);
    osc.connect(oscGain);
    oscGain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 1.0);

    // Second rumble layer (reverb-ish)
    const osc2 = ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(40, now + 0.1);
    osc2.frequency.exponentialRampToValueAtTime(20, now + 1.2);
    const oscGain2 = ctx.createGain();
    oscGain2.gain.setValueAtTime(0.0, now);
    oscGain2.gain.linearRampToValueAtTime(0.5, now + 0.1);
    oscGain2.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
    osc2.connect(oscGain2);
    oscGain2.connect(ctx.destination);
    osc2.start(now);
    osc2.stop(now + 1.2);
  }

  playVictory() {
    const ctx = this.getCtx();
    if (!ctx) return;

    const now = ctx.currentTime;
    // Ascending arpeggio: C4→E4→G4→C5
    const notes = [261.63, 329.63, 392.00, 523.25];
    const duration = 0.18;

    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * duration);

      const gain = ctx.createGain();
      const t = now + i * duration;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.4, t + 0.02);
      gain.gain.setValueAtTime(0.4, t + duration - 0.04);
      gain.gain.linearRampToValueAtTime(0, t + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + duration);
    });
  }

  playDefeat() {
    const ctx = this.getCtx();
    if (!ctx) return;

    const now = ctx.currentTime;
    // Descending minor: C4→Bb3→Ab3→F3
    const notes = [261.63, 233.08, 207.65, 174.61];
    const duration = 0.15;

    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * duration);

      const gain = ctx.createGain();
      const t = now + i * duration;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.35, t + 0.02);
      gain.gain.setValueAtTime(0.35, t + duration - 0.04);
      gain.gain.linearRampToValueAtTime(0, t + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + duration);
    });
  }

  playPriceTick() {
    const now = Date.now();
    if (now - this.lastPriceTick < 2000) return;
    this.lastPriceTick = now;

    const ctx = this.getCtx();
    if (!ctx) return;

    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, t);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.05, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.02);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.02);
  }

  playCombo(multiplier: number) {
    const ctx = this.getCtx();
    if (!ctx) return;

    const now = ctx.currentTime;
    const baseFreq = 300 + multiplier * 80;

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.linearRampToValueAtTime(baseFreq * 1.5, now + 0.25);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.3);
  }

  playMissionComplete() {
    const ctx = this.getCtx();
    if (!ctx) return;

    const now = ctx.currentTime;
    // 3-note triumphant chord: C5, E5, G5 played briefly together then sustained
    const notes = [523.25, 659.25, 783.99];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.25, now + 0.05 + i * 0.06);
      gain.gain.setValueAtTime(0.25, now + 0.5);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.8);
    });
  }
}

export const soundEngine = new SoundEngine();
