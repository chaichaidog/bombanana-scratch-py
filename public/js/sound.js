/**
 * sound.js — Web Audio API 街機合成音效引擎（零外部音檔，支援靜音開關）
 */
(function (global) {
  const BNN = (global.BNN = global.BNN || {});

  let ctx = null;
  let muted = false;

  function ensureCtx() {
    if (muted) return null;
    if (!ctx) {
      const AudioCtx = global.AudioContext || global.webkitAudioContext;
      if (!AudioCtx) return null;
      ctx = new AudioCtx();
    }
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }
    return ctx;
  }

  function playTone(freq, duration = 0.08, type = "sine", volume = 0.12, delay = 0) {
    const c = ensureCtx();
    if (!c) return;
    const now = c.currentTime + delay;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  const Sound = {
    isMuted: () => muted,
    setMuted(val) {
      muted = Boolean(val);
      return muted;
    },
    toggleMute() {
      muted = !muted;
      return muted;
    },
    snap() {
      playTone(540, 0.045, "triangle", 0.09);
      playTone(760, 0.04, "sine", 0.06, 0.025);
    },
    click() {
      playTone(460, 0.035, "sine", 0.07);
    },
    tick(urgent = false) {
      playTone(urgent ? 1040 : 680, 0.03, "square", urgent ? 0.075 : 0.035);
    },
    unlock() {
      playTone(660, 0.07, "triangle", 0.09);
      playTone(880, 0.09, "triangle", 0.09, 0.07);
    },
    laserStep() {
      playTone(620, 0.04, "sine", 0.07);
      playTone(820, 0.045, "triangle", 0.05, 0.02);
    },
    zap() {
      playTone(220, 0.09, "sawtooth", 0.14, 0);
      playTone(130, 0.14, "square", 0.12, 0.06);
    },
    chargeDown() {
      playTone(300, 0.08, "triangle", 0.08);
    },
    chargeLit() {
      playTone(520, 0.09, "sine", 0.09);
    },
    radioPing() {
      playTone(880, 0.05, "sine", 0.06, 0);
      playTone(1174, 0.07, "sine", 0.06, 0.055);
    },
    defused() {
      playTone(523.25, 0.1, "triangle", 0.12, 0);
      playTone(659.25, 0.1, "triangle", 0.12, 0.09);
      playTone(783.99, 0.14, "triangle", 0.14, 0.18);
      playTone(1046.5, 0.24, "sine", 0.14, 0.28);
    },
    strike() {
      playTone(190, 0.18, "sawtooth", 0.15, 0);
      playTone(145, 0.28, "sawtooth", 0.16, 0.16);
    },
    win() {
      const notes = [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5];
      const times = [0, 0.1, 0.2, 0.3, 0.45, 0.56];
      notes.forEach((n, idx) => playTone(n, 0.18, "triangle", 0.13, times[idx]));
    },
    boom() {
      const c = ensureCtx();
      if (!c) return;
      const now = c.currentTime;
      const bufferSize = c.sampleRate * 0.7;
      const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (c.sampleRate * 0.22));
      }
      const noise = c.createBufferSource();
      noise.buffer = buffer;
      const filter = c.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(900, now);
      filter.frequency.exponentialRampToValueAtTime(90, now + 0.65);
      const gain = c.createGain();
      gain.gain.setValueAtTime(0.32, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.68);
      noise.connect(filter);
      filter.connect(gain);
      gain.connect(c.destination);
      noise.start(now);
      playTone(110, 0.55, "sawtooth", 0.18, 0);
    }
  };

  BNN.Sound = Sound;
})(window);
