// 効果音を Web Audio で合成して鳴らす。音声ファイルは使わない（オフラインで動く）
// 後で素材に差し替えるときは play() の中身だけ替えればよい
import type { SoundCue } from './cues';

type Wave = OscillatorType;

interface Tone {
  wave: Wave;
  from: number; // Hz
  to?: number; // Hz（指定すると滑らかに変化）
  at: number; // 開始（秒、play からの相対）
  dur: number; // 長さ（秒）
  gain: number;
}

/** ド（C5）から半音 n 個上の周波数 */
const note = (n: number) => 523.25 * 2 ** (n / 12);
// 連鎖の段ごとに上がっていく音（ペンタトニック）
const CHAIN_STEPS = [0, 2, 4, 7, 9, 12, 14, 16, 19];

function tonesFor(cue: SoundCue): { tones: Tone[]; noise?: { at: number; dur: number; gain: number } } {
  switch (cue.name) {
    case 'select':
      return { tones: [{ wave: 'sine', from: 1400, at: 0, dur: 0.03, gain: 0.04 }] };
    case 'rotate':
      return {
        tones: [
          { wave: 'triangle', from: note(7), at: 0, dur: 0.05, gain: 0.07 },
          { wave: 'triangle', from: note(12), at: 0.05, dur: 0.06, gain: 0.07 },
        ],
      };
    case 'clear': {
      // 必殺に使ったオーブだけが消える段（step 0）は、連鎖の音と区別して高く短いきらめきにする
      if (cue.step === 0) {
        return {
          tones: [
            { wave: 'triangle', from: note(19), at: 0, dur: 0.1, gain: 0.05 },
            { wave: 'triangle', from: note(24), at: 0.05, dur: 0.14, gain: 0.05 },
          ],
        };
      }
      const base = CHAIN_STEPS[Math.min(cue.step - 1, CHAIN_STEPS.length - 1)];
      return {
        tones: [
          { wave: 'sine', from: note(base), at: 0, dur: 0.12, gain: 0.09 },
          { wave: 'sine', from: note(base + 7), at: 0.06, dur: 0.16, gain: 0.07 },
        ],
      };
    }
    case 'special':
      // きらめくアルペジオ
      return {
        tones: [0, 4, 7, 12, 16, 19, 24].map((n, i) => ({
          wave: 'triangle' as Wave,
          from: note(n),
          at: i * 0.06,
          dur: 0.32,
          gain: 0.06,
        })),
      };
    case 'hit':
      return {
        tones: [
          {
            wave: 'sine',
            from: cue.big ? 180 : 220,
            to: 60,
            at: 0,
            dur: cue.big ? 0.3 : 0.14,
            gain: cue.big ? 0.22 : 0.14,
          },
        ],
        noise: { at: 0, dur: cue.big ? 0.25 : 0.08, gain: cue.big ? 0.12 : 0.06 },
      };
    case 'heal':
      return {
        tones: [
          { wave: 'sine', from: note(0), to: note(12), at: 0, dur: 0.28, gain: 0.07 },
          ...(cue.big ? [{ wave: 'sine' as Wave, from: note(7), to: note(19), at: 0.12, dur: 0.36, gain: 0.06 }] : []),
        ],
      };
    case 'hurt':
      return { tones: [{ wave: 'square', from: 180, to: 90, at: 0, dur: 0.16, gain: 0.05 }] };
    case 'victory':
      return {
        tones: [0, 4, 7, 12].map((n, i) => ({
          wave: 'triangle' as Wave,
          from: note(n),
          at: i * 0.13,
          dur: i === 3 ? 0.5 : 0.14,
          gain: 0.09,
        })),
      };
    case 'defeat':
      return {
        tones: [7, 3, 0, -5].map((n, i) => ({
          wave: 'triangle' as Wave,
          from: note(n - 12),
          at: i * 0.18,
          dur: 0.22,
          gain: 0.08,
        })),
      };
  }
}

export interface SoundPlayer {
  play(cue: SoundCue): void;
  /** タップの中で呼ぶ（iOS は操作の中でないと音を出せない） */
  unlock(): void;
  setEnabled(on: boolean): void;
  enabled(): boolean;
}

export function createSoundPlayer(initiallyOn: boolean): SoundPlayer {
  let ctx: AudioContext | null = null;
  let on = initiallyOn;
  let noiseBuffer: AudioBuffer | null = null;

  // 音を出す仕組みが使えないとわかったら、以後は音なしで続ける（ゲームは止めない）
  let broken = false;

  function context(): AudioContext | null {
    if (ctx || broken) return ctx;
    const w = typeof window === 'undefined' ? undefined : window;
    const Ctor =
      w?.AudioContext ?? (w as unknown as { webkitAudioContext?: typeof AudioContext } | undefined)?.webkitAudioContext;
    if (!Ctor) {
      broken = true;
      return null;
    }
    // iOS 17 以降：マナーモード（消音スイッチ）に従う種類にする
    const session = (navigator as unknown as { audioSession?: { type: string } }).audioSession;
    if (session) {
      try {
        session.type = 'ambient';
      } catch {
        // 対応していなければそのまま
      }
    }
    try {
      ctx = new Ctor();
    } catch {
      broken = true;
    }
    return ctx;
  }

  function noise(c: AudioContext): AudioBuffer {
    if (noiseBuffer) return noiseBuffer;
    const buf = c.createBuffer(1, Math.floor(c.sampleRate * 0.3), c.sampleRate);
    const data = buf.getChannelData(0);
    // 効果音の質感用で、ゲームの乱数ではない
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    noiseBuffer = buf;
    return buf;
  }

  function render(c: AudioContext, cue: SoundCue) {
    const t0 = c.currentTime + 0.005;
    const { tones, noise: n } = tonesFor(cue);
    for (const t of tones) {
      const osc = c.createOscillator();
      const g = c.createGain();
      osc.type = t.wave;
      osc.frequency.setValueAtTime(t.from, t0 + t.at);
      if (t.to) osc.frequency.exponentialRampToValueAtTime(t.to, t0 + t.at + t.dur);
      g.gain.setValueAtTime(0.0001, t0 + t.at);
      g.gain.exponentialRampToValueAtTime(t.gain, t0 + t.at + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + t.at + t.dur);
      osc.connect(g).connect(c.destination);
      osc.start(t0 + t.at);
      osc.stop(t0 + t.at + t.dur + 0.02);
    }
    if (n) {
      const src = c.createBufferSource();
      const g = c.createGain();
      const filter = c.createBiquadFilter();
      src.buffer = noise(c);
      filter.type = 'lowpass';
      filter.frequency.value = 1200;
      g.gain.setValueAtTime(n.gain, t0 + n.at);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + n.at + n.dur);
      src.connect(filter).connect(g).connect(c.destination);
      src.start(t0 + n.at);
      src.stop(t0 + n.at + n.dur + 0.02);
    }
  }

  return {
    unlock() {
      if (!on) return;
      const c = context();
      // iOS はアプリを裏に回すと 'interrupted' になるので、running 以外なら戻す
      if (c && c.state !== 'running') {
        try {
          c.resume().catch(() => undefined);
        } catch {
          // 戻せなくてもゲームは続ける
        }
      }
    },
    play(cue) {
      if (!on) return;
      try {
        const c = context();
        if (!c || c.state !== 'running') return;
        render(c, cue);
      } catch {
        // 音で失敗しても、ターンの進行や画面は止めない
      }
    },
    setEnabled(value) {
      on = value;
      if (on) this.unlock();
    },
    enabled: () => on,
  };
}
