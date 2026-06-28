// A self contained Web Audio sound engine. Every sound is synthesized at
// runtime with oscillators and noise, so there are no audio asset files to ship
// or fetch and nothing can fail to load. The engine unlocks on the first user
// gesture (browser autoplay policy) and persists the mute preference.

type SoundName =
  | "hover"
  | "click"
  | "back"
  | "join"
  | "stake"
  | "start"
  | "test"
  | "success"
  | "error"
  | "alert"
  | "vote"
  | "win"
  | "lose"
  | "eject";

const muteKey = "amongsol.muted";

class SoundEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private ambientGain: GainNode | null = null;
  private ambientStarted = false;
  private muted = false;
  private listeners = new Set<(muted: boolean) => void>();

  init() {
    if (typeof window === "undefined") return;
    if (this.muted === false) {
      this.muted = window.localStorage.getItem(muteKey) === "1";
    }
    if (this.ctx) return;
    const Ctor =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    this.ctx = new Ctor();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.9;
    this.master.connect(this.ctx.destination);
  }

  // Call from a user gesture to satisfy autoplay rules and start ambience.
  unlock() {
    this.init();
    if (!this.ctx) return;
    if (this.ctx.state === "suspended") {
      void this.ctx.resume();
    }
    this.startAmbient();
  }

  isMuted() {
    if (typeof window !== "undefined" && this.ctx === null) {
      this.muted = window.localStorage.getItem(muteKey) === "1";
    }
    return this.muted;
  }

  subscribe(fn: (muted: boolean) => void) {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  toggleMuted() {
    this.setMuted(!this.muted);
  }

  setMuted(value: boolean) {
    this.muted = value;
    if (typeof window !== "undefined") {
      window.localStorage.setItem(muteKey, value ? "1" : "0");
    }
    if (this.master && this.ctx) {
      const now = this.ctx.currentTime;
      this.master.gain.cancelScheduledValues(now);
      this.master.gain.linearRampToValueAtTime(value ? 0 : 0.9, now + 0.12);
    }
    this.listeners.forEach((fn) => fn(value));
  }

  private startAmbient() {
    if (this.ambientStarted || !this.ctx || !this.master) return;
    this.ambientStarted = true;

    const gain = this.ctx.createGain();
    gain.gain.value = 0.05;
    gain.connect(this.master);
    this.ambientGain = gain;

    // A slow two note pad drone with a gentle low frequency wobble.
    const voices: Array<[number, OscillatorType]> = [
      [55, "sine"],
      [82.4, "sine"],
      [110, "triangle"],
    ];
    voices.forEach(([freq, type]) => {
      const osc = this.ctx!.createOscillator();
      osc.type = type;
      osc.frequency.value = freq;
      const lfo = this.ctx!.createOscillator();
      lfo.frequency.value = 0.08 + Math.random() * 0.1;
      const lfoGain = this.ctx!.createGain();
      lfoGain.gain.value = 1.5;
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);
      osc.connect(gain);
      osc.start();
      lfo.start();
    });
  }

  private tone(opts: {
    freq: number;
    type?: OscillatorType;
    duration?: number;
    gain?: number;
    delay?: number;
    slideTo?: number;
  }) {
    if (!this.ctx || !this.master) return;
    const { freq, type = "sine", duration = 0.18, gain = 0.3, delay = 0, slideTo } = opts;
    const start = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (slideTo) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(slideTo, 1), start + duration);
    }
    env.gain.setValueAtTime(0.0001, start);
    env.gain.exponentialRampToValueAtTime(gain, start + 0.012);
    env.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(env);
    env.connect(this.master);
    osc.start(start);
    osc.stop(start + duration + 0.04);
  }

  private noise(opts: { duration?: number; gain?: number; delay?: number; highpass?: number }) {
    if (!this.ctx || !this.master) return;
    const { duration = 0.25, gain = 0.2, delay = 0, highpass = 800 } = opts;
    const start = this.ctx.currentTime + delay;
    const frames = Math.floor(this.ctx.sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, frames, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i += 1) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = highpass;
    const env = this.ctx.createGain();
    env.gain.setValueAtTime(gain, start);
    env.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    src.connect(filter);
    filter.connect(env);
    env.connect(this.master);
    src.start(start);
    src.stop(start + duration);
  }

  play(name: SoundName) {
    this.init();
    if (!this.ctx || this.muted) return;
    if (this.ctx.state === "suspended") void this.ctx.resume();

    switch (name) {
      case "hover":
        this.tone({ freq: 660, type: "sine", duration: 0.05, gain: 0.08 });
        break;
      case "click":
        this.tone({ freq: 420, type: "square", duration: 0.07, gain: 0.16, slideTo: 620 });
        break;
      case "back":
        this.tone({ freq: 480, type: "square", duration: 0.09, gain: 0.14, slideTo: 300 });
        break;
      case "join":
        this.tone({ freq: 523, duration: 0.12, gain: 0.22 });
        this.tone({ freq: 784, duration: 0.16, gain: 0.22, delay: 0.1 });
        break;
      case "stake":
        this.tone({ freq: 392, type: "triangle", duration: 0.1, gain: 0.22 });
        this.tone({ freq: 587, type: "triangle", duration: 0.12, gain: 0.22, delay: 0.08 });
        this.tone({ freq: 880, type: "triangle", duration: 0.18, gain: 0.2, delay: 0.16 });
        break;
      case "start":
        this.noise({ duration: 0.5, gain: 0.18, highpass: 300 });
        this.tone({ freq: 220, type: "sawtooth", duration: 0.5, gain: 0.2, slideTo: 880 });
        break;
      case "test":
        this.tone({ freq: 700, type: "square", duration: 0.06, gain: 0.12 });
        this.tone({ freq: 700, type: "square", duration: 0.06, gain: 0.12, delay: 0.09 });
        break;
      case "success":
        [523, 659, 784, 1047].forEach((freq, i) =>
          this.tone({ freq, type: "triangle", duration: 0.18, gain: 0.22, delay: i * 0.09 })
        );
        break;
      case "error":
        this.tone({ freq: 200, type: "sawtooth", duration: 0.28, gain: 0.22, slideTo: 90 });
        break;
      case "alert":
        for (let i = 0; i < 3; i += 1) {
          this.tone({ freq: 720, type: "sawtooth", duration: 0.22, gain: 0.22, delay: i * 0.34, slideTo: 420 });
          this.tone({ freq: 420, type: "sawtooth", duration: 0.12, gain: 0.18, delay: i * 0.34 + 0.22 });
        }
        break;
      case "vote":
        this.tone({ freq: 330, type: "square", duration: 0.1, gain: 0.2, slideTo: 500 });
        break;
      case "win":
        [523, 659, 784, 1047, 1319].forEach((freq, i) =>
          this.tone({ freq, type: "triangle", duration: 0.22, gain: 0.24, delay: i * 0.12 })
        );
        break;
      case "lose":
        [440, 392, 330, 247].forEach((freq, i) =>
          this.tone({ freq, type: "sawtooth", duration: 0.26, gain: 0.2, delay: i * 0.16 })
        );
        break;
      case "eject":
        this.noise({ duration: 0.6, gain: 0.16, highpass: 200 });
        this.tone({ freq: 320, type: "sawtooth", duration: 0.6, gain: 0.2, slideTo: 80 });
        break;
    }
  }
}

const sound = new SoundEngine();
export default sound;
export type { SoundName };
