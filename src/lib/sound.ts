export type SoundKind = 'move' | 'capture' | 'check' | 'castle' | 'promote' | 'start' | 'end' | 'illegal' | 'lowtime';

let ctx: AudioContext | null = null;
let noiseBuf: AudioBuffer | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  if (!ctx) {
    try {
      ctx = new AC();
    } catch {
      return null;
    }
  }
  if (ctx.state === 'suspended') void ctx.resume().catch(() => {});
  return ctx;
}

function noise(c: AudioContext) {
  if (!noiseBuf) {
    noiseBuf = c.createBuffer(1, Math.floor(c.sampleRate * 0.3), c.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return noiseBuf;
}

/** "Toc" de madeira sintetizado: ruído filtrado + batida grave. */
function tok(c: AudioContext, at: number, vol: number, freq: number, len: number) {
  const src = c.createBufferSource();
  src.buffer = noise(c);
  const bp = c.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = freq;
  bp.Q.value = 1.2;
  const g = c.createGain();
  g.gain.setValueAtTime(vol, at);
  g.gain.exponentialRampToValueAtTime(0.0001, at + len);
  src.connect(bp).connect(g).connect(c.destination);
  src.start(at);
  src.stop(at + len + 0.02);

  const o = c.createOscillator();
  const og = c.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(freq / 5, at);
  o.frequency.exponentialRampToValueAtTime(freq / 9, at + len);
  og.gain.setValueAtTime(vol * 0.9, at);
  og.gain.exponentialRampToValueAtTime(0.0001, at + len);
  o.connect(og).connect(c.destination);
  o.start(at);
  o.stop(at + len + 0.02);
}

function tone(c: AudioContext, at: number, vol: number, freq: number, len: number, type: OscillatorType = 'triangle') {
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(vol, at + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, at + len);
  o.connect(g).connect(c.destination);
  o.start(at);
  o.stop(at + len + 0.02);
}

export function playSound(kind: SoundKind, volume = 0.6) {
  const c = getCtx();
  if (!c) return;
  const t = c.currentTime + 0.005;
  const v = Math.min(1, Math.max(0, volume));
  try {
    switch (kind) {
      case 'move':
        tok(c, t, 0.7 * v, 1100, 0.09);
        break;
      case 'capture':
        tok(c, t, 1.0 * v, 700, 0.16);
        tok(c, t + 0.05, 0.6 * v, 1400, 0.08);
        break;
      case 'castle':
        tok(c, t, 0.7 * v, 1000, 0.09);
        tok(c, t + 0.11, 0.8 * v, 900, 0.1);
        break;
      case 'promote':
        tok(c, t, 0.7 * v, 1100, 0.09);
        tone(c, t + 0.08, 0.18 * v, 880, 0.18);
        tone(c, t + 0.16, 0.18 * v, 1320, 0.22);
        break;
      case 'check':
        tok(c, t, 0.8 * v, 900, 0.12);
        tone(c, t + 0.06, 0.2 * v, 660, 0.14, 'square');
        break;
      case 'start':
        tone(c, t, 0.16 * v, 523, 0.14);
        tone(c, t + 0.1, 0.16 * v, 659, 0.2);
        break;
      case 'end':
        [392, 494, 587, 784].forEach((f, i) => tone(c, t + i * 0.11, 0.18 * v, f, 0.4));
        break;
      case 'illegal':
        tone(c, t, 0.12 * v, 150, 0.12, 'sawtooth');
        break;
      case 'lowtime':
        tone(c, t, 0.15 * v, 1000, 0.08, 'square');
        break;
    }
  } catch {
    /* áudio é opcional */
  }
}
