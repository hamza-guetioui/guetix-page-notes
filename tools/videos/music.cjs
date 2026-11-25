/* Original background music, synthesized from scratch (no samples, no licenses needed).
   node music.cjs lofi <seconds> out.wav   |   node music.cjs pop <seconds> out.wav */
const fs = require('fs');
const SR = 44100;
const [, , style = 'lofi', secs = '60', out = 'music.wav'] = process.argv;
const N = Math.ceil(+secs * SR);
const L = new Float32Array(N), R = new Float32Array(N);
let seed = 7;
const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const add = (i, l, r = l) => { if (i >= 0 && i < N) { L[i] += l; R[i] += r; } };

function kick(t0, amp = 0.9, pitch = 52) {
  const s0 = Math.round(t0 * SR), len = Math.round(0.45 * SR);
  let ph = 0;
  for (let i = 0; i < len; i++) {
    const t = i / SR, f = pitch + 110 * Math.exp(-t * 32);
    ph += (2 * Math.PI * f) / SR;
    const v = Math.sin(ph) * Math.exp(-t * 7.5) * amp + (i < 60 ? (rnd() - 0.5) * 0.25 * amp : 0);
    add(s0 + i, v);
  }
}
function noiseHit(t0, { dur = 0.2, amp = 0.3, decay = 18, hp = 0.6, pan = 0, tone = 0 }) {
  const s0 = Math.round(t0 * SR), len = Math.round(dur * SR);
  let lp = 0, prev = 0;
  for (let i = 0; i < len; i++) {
    const t = i / SR, n = rnd() * 2 - 1;
    lp += (n - lp) * hp; // brightness
    const hpf = n - lp * (1 - hp); // crude high-pass mix
    let v = (hp > 0.5 ? hpf : lp) * Math.exp(-t * decay) * amp;
    if (tone) v += Math.sin(2 * Math.PI * tone * t) * Math.exp(-t * decay * 1.4) * amp * 0.6;
    prev = v;
    add(s0 + i, v * (1 - pan), v * (1 + pan));
  }
}
/** Soft keys / pad voice: a few harmonics, slow attack, exponential release; one-pole low-pass. */
function voice(t0, dur, midi, { amp = 0.12, attack = 0.01, rel = 0.6, harm = [1, 0.5, 0.25, 0.12], cut = 0.25, detune = 0, pan = 0, vib = 0 }) {
  const s0 = Math.round(t0 * SR), len = Math.round((dur + rel) * SR), f = mtof(midi);
  let lpL = 0, lpR = 0;
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    const env = (t < attack ? t / attack : 1) * (t > dur ? Math.exp(-(t - dur) / (rel / 4)) : 1) * Math.exp(-t * 0.6);
    let a = 0, b = 0;
    const fv = f * (1 + vib * Math.sin(2 * Math.PI * 5 * t));
    harm.forEach((h, k) => {
      a += h * Math.sin(2 * Math.PI * fv * (k + 1) * t * (1 + detune));
      b += h * Math.sin(2 * Math.PI * fv * (k + 1) * t * (1 - detune));
    });
    lpL += (a - lpL) * cut; lpR += (b - lpR) * cut;
    add(s0 + i, lpL * env * amp * (1 - pan), lpR * env * amp * (1 + pan));
  }
}
function bass(t0, dur, midi, amp = 0.32) {
  const s0 = Math.round(t0 * SR), len = Math.round((dur + 0.08) * SR), f = mtof(midi);
  let lp = 0;
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    const env = Math.min(1, t / 0.008) * (t > dur ? Math.exp(-(t - dur) * 40) : 1);
    const raw = Math.sin(2 * Math.PI * f * t) + 0.35 * Math.sin(2 * Math.PI * f * 2 * t) + 0.15 * Math.sign(Math.sin(2 * Math.PI * f * t));
    lp += (raw - lp) * 0.18;
    add(s0 + i, lp * env * amp);
  }
}

if (style === 'lofi') {
  // 84 bpm, Fmaj9 – Em7 – Dm9 – Cmaj7 ; warm keys, dusty drums, round bass, a little vinyl
  const bpm = 84, beat = 60 / bpm, bar = beat * 4;
  const chords = [[53, 57, 60, 64, 67], [52, 55, 59, 62, 66 - 1], [50, 53, 57, 60, 64], [48, 52, 55, 59, 62]];
  const roots = [41, 40, 38, 36];
  const mel = [72, 74, 76, 79, 76, 74, 72, 69, 71, 72, 74, 72, 69, 67, 69, 72];
  for (let b = 0; b * bar < +secs; b++) {
    const t = b * bar, c = b % 4, sw = beat * 0.08;
    chords[c].forEach((m, k) => voice(t + k * 0.012, bar * 0.92, m, { amp: 0.055, attack: 0.02, rel: 1.2, cut: 0.12, detune: 0.0015, pan: (k - 2) * 0.12 }));
    if (b % 2 === 1) chords[c].slice(1, 4).forEach((m) => voice(t + beat * 2.5 + sw, beat * 1.2, m + 12, { amp: 0.03, cut: 0.1, rel: 0.8 }));
    bass(t, beat * 1.6, roots[c]); bass(t + beat * 2.5 + sw, beat * 0.9, roots[c] + (c % 2 ? 7 : 12) - 12 + 12 - 12);
    if (b >= 2) for (let s = 0; s < 4; s++) { const m = mel[(b * 4 + s) % mel.length]; if (rnd() > 0.35) voice(t + s * beat + (s % 2 ? sw : 0), beat * 0.7, m, { amp: 0.035, harm: [1, 0.2, 0.05], cut: 0.2, rel: 0.5, vib: 0.002, pan: 0.2 }); }
    if (b >= 1) {
      kick(t, 0.6); kick(t + beat * 1.75 + sw, 0.42); kick(t + beat * 2.5 + sw, 0.5);
      noiseHit(t + beat, { amp: 0.12, decay: 18, hp: 0.2, tone: 190 }); noiseHit(t + beat * 3, { amp: 0.12, decay: 18, hp: 0.2, tone: 190 });
      for (let h = 0; h < 8; h++) noiseHit(t + h * beat / 2 + (h % 2 ? sw : 0), { dur: 0.04, amp: h % 2 ? 0.018 : 0.026, decay: 80, hp: 0.9, pan: 0.3 });
    }
  }
  for (let i = 0; i < N; i += 1) if (rnd() > 0.99985) noiseHit(i / SR, { dur: 0.004, amp: 0.05, decay: 900, hp: 0.95 }); // crackle
} else {
  // 118 bpm, upbeat: Am – F – C – G, four-on-the-floor, sidechained pads, pluck arp, claps; filtered 2-bar intro then drop
  const bpm = 118, beat = 60 / bpm, bar = beat * 4;
  const chords = [[57, 60, 64, 69], [53, 57, 60, 65], [48, 52, 55, 60], [55, 59, 62, 67]];
  const roots = [33, 29, 36, 31];
  for (let b = 0; b * bar < +secs; b++) {
    const t = b * bar, c = b % 4, intro = b < 2, outro = (b + 1) * bar > +secs - bar * 1.0;
    chords[c].forEach((m, k) => {
      for (let q = 0; q < 4; q++) voice(t + q * beat + 0.06, beat * 0.62, m, { amp: intro ? 0.03 : 0.045, attack: 0.05, rel: 0.25, harm: [1, 0.6, 0.4, 0.3, 0.2, 0.12], cut: intro ? 0.05 : 0.14, detune: 0.004, pan: (k - 1.5) * 0.2 });
    });
    const arp = [0, 1, 2, 3, 2, 1, 2, 3];
    if (!intro) for (let s = 0; s < 16; s++) voice(t + s * beat / 4, beat / 5, chords[c][arp[s % 8]] + 12, { amp: 0.03, attack: 0.002, rel: 0.12, harm: [1, 0.4, 0.2, 0.1], cut: 0.3, pan: s % 2 ? 0.35 : -0.35 });
    if (!intro) for (let q = 0; q < 8; q++) bass(t + q * beat / 2 + (q % 2 ? 0 : 0.02), beat / 2.4, roots[c] + (q % 4 === 3 ? 12 : 0), 0.26);
    for (let q = 0; q < 4; q++) {
      if (!outro || q < 2) kick(t + q * beat, intro ? 0.45 : 0.85, 50);
      noiseHit(t + q * beat + beat / 2, { dur: 0.06, amp: intro ? 0.02 : 0.04, decay: 60, hp: 0.92, pan: 0.2 });
      if (!intro && (q === 1 || q === 3)) { noiseHit(t + q * beat, { amp: 0.13, decay: 24, hp: 0.35, tone: 220 }); noiseHit(t + q * beat + 0.012, { amp: 0.08, decay: 28, hp: 0.4, pan: 0.2 }); }
    }
    if (b === 1) for (let s = 0; s < 8; s++) noiseHit(t + bar / 2 + s * beat / 4, { dur: 0.1, amp: 0.03 + s * 0.012, decay: 30, hp: 0.85 }); // riser into the drop
  }
  // sidechain: duck everything on each beat
  for (let i = 0; i < N; i++) {
    const t = i / SR, ph = (t % beat) / beat;
    const d = 0.55 + 0.45 * Math.min(1, ph / 0.35);
    L[i] *= d; R[i] *= d;
  }
  // re-add kicks un-ducked? (kept simple)
}

// master: fade in/out, normalize, soft clip
const fin = 0.8 * SR, fout = 2.2 * SR;
let peak = 0;
for (let i = 0; i < N; i++) {
  const g = Math.min(1, i / fin, (N - i) / fout);
  L[i] *= g; R[i] *= g;
  peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
}
const k = 0.89 / (peak || 1);
const buf = Buffer.alloc(44 + N * 4);
buf.write('RIFF', 0); buf.writeUInt32LE(36 + N * 4, 4); buf.write('WAVEfmt ', 8); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22);
buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(N * 4, 40);
for (let i = 0; i < N; i++) {
  buf.writeInt16LE(Math.round(Math.tanh(L[i] * k * 1.1) * 32000), 44 + i * 4);
  buf.writeInt16LE(Math.round(Math.tanh(R[i] * k * 1.1) * 32000), 46 + i * 4);
}
fs.writeFileSync(out, buf);
console.log('wrote', out, secs + 's');
