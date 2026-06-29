// A self contained Web Audio sound engine tuned for a soft, warm, bouncy feel
// (gentle marimba and mallet tones with a touch of reverb). It also plays an
// engaging looping background track: a warm chord progression with a bassline,
// a marimba melody and light percussion, all sequenced with a lookahead
// scheduler. Everything is synthesized at runtime, so there are no audio files.
// The engine unlocks on the first user gesture and persists the mute choice.

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

const N = {
  C2: 65.41, F2: 87.31, G2: 98.0, A2: 110.0,
  A3: 220.0, B3: 246.94, C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.0, A4: 440.0, B4: 493.88,
  C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99, A5: 880.0,
  C6: 1046.5, D6: 1174.66, E6: 1318.51,
};

const pentatonic = [N.C5, N.D5, N.E5, N.G5, N.A5, N.C6, N.D6, N.E6];

// One warm chord per bar (C - G - Am - F), with pad voicing, bass root and a
// pool of chord tones for the melody to dance over.
interface Bar {
  pad: number[];
  bass: number;
  arp: number[];
}
const PROGRESSION: Bar[] = [
  { pad: [N.C4, N.E4, N.G4], bass: N.C2, arp: [N.C4, N.E4, N.G4, N.C5] },
  { pad: [N.B3, N.D4, N.G4], bass: N.G2, arp: [N.D4, N.G4, N.B4, N.D5] },
  { pad: [N.C4, N.E4, N.A4], bass: N.A2, arp: [N.E4, N.A4, N.C5, N.E5] },
  { pad: [N.A3, N.C4, N.F4], bass: N.F2, arp: [N.F4, N.A4, N.C5, N.F5] },
];
// Melody pattern over the eight eighth notes in a bar (index into arp, -1 rest).
const ARP_PATTERN = [0, -1, 2, 1, 3, -1, 2, 3];

interface NoteOptions {
  delay?: number;
  dur?: number;
  gain?: number;
  type?: OscillatorType;
  reverb?: number;
  attack?: number;
  mallet?: boolean;
  glideTo?: number;
}

class SoundEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private reverb: ConvolverNode | null = null;
  private musicBus: GainNode | null = null;
  private musicStarted = false;
  private schedulerId: number | null = null;
  private nextStepTime = 0;
  private step = 0;
  private readonly eighth = 0.3; // ~100 BPM
  private muted = false;
  private listeners = new Set<(muted: boolean) => void>();

  init() {
    if (typeof window === "undefined") return;
    if (this.ctx === null) {
      this.muted = window.localStorage.getItem(muteKey) === "1";
    }
    if (this.ctx) return;
    const Ctor =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;

    this.ctx = new Ctor();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.82;
    this.master.connect(this.ctx.destination);

    this.reverb = this.ctx.createConvolver();
    this.reverb.buffer = this.makeImpulse(1.8, 2.6);
    const wet = this.ctx.createGain();
    wet.gain.value = 0.5;
    this.reverb.connect(wet);
    wet.connect(this.master);
  }

  private makeImpulse(duration: number, decay: number) {
    const ctx = this.ctx!;
    const rate = ctx.sampleRate;
    const length = Math.floor(rate * duration);
    const buffer = ctx.createBuffer(2, length, rate);
    for (let ch = 0; ch < 2; ch += 1) {
      const data = buffer.getChannelData(ch);
      for (let i = 0; i < length; i += 1) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
      }
    }
    return buffer;
  }

  unlock() {
    this.init();
    if (!this.ctx) return;
    if (this.ctx.state === "suspended") void this.ctx.resume();
    this.startMusic();
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
      this.master.gain.linearRampToValueAtTime(value ? 0 : 0.82, now + 0.15);
    }
    this.listeners.forEach((fn) => fn(value));
  }

  // ----- Background music -----------------------------------------------------

  private startMusic() {
    if (this.musicStarted || !this.ctx || !this.master) return;
    this.musicStarted = true;
    const ctx = this.ctx;

    const bus = ctx.createGain();
    bus.gain.value = 0.55;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 5200;
    bus.connect(lp);
    lp.connect(this.master);
    if (this.reverb) {
      const send = ctx.createGain();
      send.gain.value = 0.16;
      bus.connect(send);
      send.connect(this.reverb);
    }
    this.musicBus = bus;

    this.nextStepTime = ctx.currentTime + 0.18;
    this.step = 0;
    if (typeof window !== "undefined") {
      this.schedulerId = window.setInterval(() => this.scheduler(), 25);
    }
  }

  private scheduler() {
    if (!this.ctx) return;
    const ahead = 0.13;
    while (this.nextStepTime < this.ctx.currentTime + ahead) {
      this.scheduleStep(this.step, this.nextStepTime);
      this.nextStepTime += this.eighth;
      this.step = (this.step + 1) % (PROGRESSION.length * 8);
    }
  }

  private scheduleStep(step: number, when: number) {
    const bar = Math.floor(step / 8) % PROGRESSION.length;
    const inBar = step % 8;
    const chord = PROGRESSION[bar];

    if (inBar === 0) {
      chord.pad.forEach((f) => this.pad(when, f, this.eighth * 8 * 0.95));
      this.bass(when, chord.bass);
      this.kick(when);
    }
    if (inBar === 4) {
      this.bass(when, chord.bass * 1.5);
      this.kick(when);
    }
    if (inBar % 2 === 1) this.hat(when);

    const ai = ARP_PATTERN[inBar];
    if (ai >= 0) this.musicNote(when, chord.arp[ai]);
  }

  private pad(when: number, freq: number, dur: number) {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.value = freq;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, when);
    env.gain.linearRampToValueAtTime(0.05, when + 0.12);
    env.gain.setValueAtTime(0.05, when + dur * 0.6);
    env.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    osc.connect(env);
    env.connect(this.musicBus!);
    osc.start(when);
    osc.stop(when + dur + 0.05);
  }

  private bass(when: number, freq: number) {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.value = freq;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, when);
    env.gain.exponentialRampToValueAtTime(0.16, when + 0.01);
    env.gain.exponentialRampToValueAtTime(0.0001, when + 0.42);
    osc.connect(env);
    env.connect(this.musicBus!);
    osc.start(when);
    osc.stop(when + 0.5);
  }

  private kick(when: number) {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(140, when);
    osc.frequency.exponentialRampToValueAtTime(48, when + 0.12);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.16, when);
    env.gain.exponentialRampToValueAtTime(0.0001, when + 0.18);
    osc.connect(env);
    env.connect(this.musicBus!);
    osc.start(when);
    osc.stop(when + 0.2);
  }

  private hat(when: number) {
    const ctx = this.ctx!;
    const frames = Math.floor(ctx.sampleRate * 0.03);
    const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = 7000;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.045, when);
    env.gain.exponentialRampToValueAtTime(0.0001, when + 0.03);
    src.connect(filter);
    filter.connect(env);
    env.connect(this.musicBus!);
    src.start(when);
    src.stop(when + 0.04);
  }

  private musicNote(when: number, freq: number) {
    this.voice(when, freq, { dur: 0.34, gain: 0.1, reverb: 0.3, bus: this.musicBus ?? undefined });
  }

  // ----- Sound effects --------------------------------------------------------

  // The core mallet voice. `when` is an absolute AudioContext time.
  private voice(when: number, freq: number, opts: NoteOptions & { bus?: GainNode } = {}) {
    if (!this.ctx || !this.master) return;
    const { dur = 0.45, gain = 0.26, type = "sine", reverb = 0.32, attack = 0.006, mallet = true, glideTo, bus } = opts;
    const ctx = this.ctx;
    const out = bus ?? this.master;

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, when);
    env.gain.exponentialRampToValueAtTime(gain, when + attack);
    env.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, when);
    if (glideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(glideTo, 1), when + dur);
    osc.connect(env);
    env.connect(out);
    if (reverb > 0 && this.reverb) {
      const send = ctx.createGain();
      send.gain.value = reverb;
      env.connect(send);
      send.connect(this.reverb);
    }
    osc.start(when);
    osc.stop(when + dur + 0.06);

    if (mallet) {
      const env2 = ctx.createGain();
      const malletDur = Math.min(dur, 0.16);
      env2.gain.setValueAtTime(0.0001, when);
      env2.gain.exponentialRampToValueAtTime(gain * 0.35, when + attack);
      env2.gain.exponentialRampToValueAtTime(0.0001, when + malletDur);
      const osc2 = ctx.createOscillator();
      osc2.type = "sine";
      osc2.frequency.value = freq * 2.01;
      osc2.connect(env2);
      env2.connect(out);
      osc2.start(when);
      osc2.stop(when + malletDur + 0.05);
    }
  }

  private note(freq: number, opts: NoteOptions = {}) {
    if (!this.ctx) return;
    this.voice(this.ctx.currentTime + (opts.delay ?? 0), freq, opts);
  }

  private softNoise(opts: { delay?: number; duration?: number; gain?: number; from?: number; to?: number }) {
    if (!this.ctx || !this.master) return;
    const { delay = 0, duration = 0.4, gain = 0.12, from = 1400, to = 300 } = opts;
    const ctx = this.ctx;
    const start = ctx.currentTime + delay;
    const frames = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(from, start);
    filter.frequency.exponentialRampToValueAtTime(to, start + duration);
    const env = ctx.createGain();
    env.gain.setValueAtTime(gain, start);
    env.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    src.connect(filter);
    filter.connect(env);
    env.connect(this.master);
    if (this.reverb) env.connect(this.reverb);
    src.start(start);
    src.stop(start + duration);
  }

  pop(index = 0) {
    this.init();
    if (!this.ctx || this.muted) return;
    if (this.ctx.state === "suspended") void this.ctx.resume();
    const freq = pentatonic[((index % pentatonic.length) + pentatonic.length) % pentatonic.length];
    this.note(freq, { dur: 0.42, gain: 0.24, reverb: 0.4, glideTo: freq * 1.5 });
  }

  play(name: SoundName) {
    this.init();
    if (!this.ctx || this.muted) return;
    if (this.ctx.state === "suspended") void this.ctx.resume();

    switch (name) {
      case "hover":
        this.note(N.A5, { dur: 0.1, gain: 0.05, reverb: 0.18, mallet: false });
        break;
      case "click":
        this.note(N.E5, { dur: 0.26, gain: 0.18 });
        break;
      case "back":
        this.note(N.G4, { dur: 0.2, gain: 0.16 });
        this.note(N.D4, { delay: 0.08, dur: 0.24, gain: 0.16 });
        break;
      case "join":
        [N.C5, N.E5, N.G5].forEach((f, i) => this.note(f, { delay: i * 0.08, dur: 0.34, gain: 0.2 }));
        break;
      case "stake":
        [N.G5, N.C6, N.E6].forEach((f, i) => this.note(f, { delay: i * 0.075, dur: 0.4, gain: 0.18, reverb: 0.5 }));
        break;
      case "start":
        this.softNoise({ duration: 0.5, gain: 0.08, from: 500, to: 1800 });
        [N.C5, N.G5, N.C6].forEach((f, i) => this.note(f, { delay: i * 0.1, dur: 0.5, gain: 0.2, reverb: 0.5, attack: 0.03 }));
        break;
      case "test":
        this.note(N.E5, { dur: 0.16, gain: 0.13 });
        this.note(N.E5, { delay: 0.1, dur: 0.16, gain: 0.13 });
        break;
      case "success":
        [N.C5, N.E5, N.G5, N.C6].forEach((f, i) => this.note(f, { delay: i * 0.09, dur: 0.42, gain: 0.22, reverb: 0.45 }));
        break;
      case "error":
        this.note(N.G4, { dur: 0.28, gain: 0.18, type: "triangle", reverb: 0.25, mallet: false });
        this.note(N.D4, { delay: 0.09, dur: 0.3, gain: 0.16, type: "triangle", mallet: false, glideTo: N.C2 });
        break;
      case "alert":
        for (let i = 0; i < 3; i += 1) {
          this.note(N.A4, { delay: i * 0.34, dur: 0.26, gain: 0.18, type: "triangle", reverb: 0.4, mallet: false });
          this.note(N.E5, { delay: i * 0.34 + 0.15, dur: 0.22, gain: 0.16, type: "triangle", reverb: 0.4, mallet: false });
        }
        break;
      case "vote":
        this.note(N.D5, { dur: 0.2, gain: 0.18, glideTo: N.G5 });
        break;
      case "win":
        [N.C5, N.D5, N.E5, N.G5, N.A5, N.C6].forEach((f, i) => this.note(f, { delay: i * 0.1, dur: 0.5, gain: 0.22, reverb: 0.55 }));
        [N.C5, N.E5, N.G5].forEach((f) => this.note(f, { delay: 0.66, dur: 0.9, gain: 0.16, reverb: 0.6, attack: 0.02 }));
        break;
      case "lose":
        [N.A4, N.G4, N.E4, N.C4].forEach((f, i) =>
          this.note(f, { delay: i * 0.16, dur: 0.4, gain: 0.18, type: "triangle", reverb: 0.4, mallet: false })
        );
        break;
      case "eject":
        this.softNoise({ duration: 0.6, gain: 0.1, from: 1200, to: 200 });
        this.note(N.C4, { dur: 0.6, gain: 0.18, type: "sine", reverb: 0.4, glideTo: N.C2, mallet: false });
        break;
    }
  }
}

const sound = new SoundEngine();
export default sound;
export type { SoundName };
