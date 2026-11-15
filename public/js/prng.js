/**
 * prng.js — 確定性種子亂數生成器 (Mulberry32 + FNV-1a Hash)
 * 只要輸入相同的任務種子碼 (Seed)，國一與國二所有裝置都會產生完全相同的炸彈與手冊！
 */
(function (global) {
  const BNN = (global.BNN = global.BNN || {});

  function hashString(str) {
    let h = 2166136261 >>> 0;
    const text = String(str || "BNN-101");
    for (let i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function createPRNG(seedStr) {
    let state = hashString(seedStr) || 0x12345678;

    function next() {
      state |= 0;
      state = (state + 0x6d2b79f5) | 0;
      let t = Math.imul(state ^ (state >>> 15), 1 | state);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }

    function int(min, max) {
      return Math.floor(next() * (max - min + 1)) + min;
    }

    function pick(arr) {
      return arr[Math.floor(next() * arr.length)];
    }

    function shuffle(arr) {
      const copy = arr.slice();
      for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        const tmp = copy[i];
        copy[i] = copy[j];
        copy[j] = tmp;
      }
      return copy;
    }

    function bool(prob = 0.5) {
      return next() < prob;
    }

    return { next, int, pick, shuffle, bool };
  }

  function randomRoomCode() {
    const words = ["BNN", "PY", "SCR", "LAB", "MONK", "CODE", "BOOM"];
    const w = words[Math.floor(Math.random() * words.length)];
    const num = Math.floor(100 + Math.random() * 900);
    return `${w}-${num}`;
  }

  BNN.createPRNG = createPRNG;
  BNN.randomRoomCode = randomRoomCode;
})(window);

