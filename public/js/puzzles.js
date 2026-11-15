/**
 * puzzles.js — 炸彈外殼特徵 + 6 種 Scratch×Python 程式模組 + 3 種非程式合作拆彈小遊戲
 */
(function (global) {
  const BNN = (global.BNN = global.BNN || {});

  const WIRE_COLORS = ["紅", "藍", "黃", "綠", "白"];
  const LETTERS_VOWEL = ["A", "E", "I", "O", "U"];
  const LETTERS_CONS = ["B", "K", "M", "N", "R", "X", "Z"];

  const MORSE_CODE = {
    A: ".-", B: "-...", C: "-.-.", D: "-..", E: ".", F: "..-.",
    G: "--.", H: "....", I: "..", J: ".---", K: "-.-", L: ".-..",
    M: "--", N: "-.", O: "---", P: ".--.", Q: "--.-", R: ".-.",
    S: "...", T: "-", U: "..-", V: "...-", W: ".--", X: "-..-",
    Y: "-.--", Z: "--.."
  };

  const MORSE_CHANNELS = [
    { word: "CODE", freq: "3.515" },
    { word: "BOMB", freq: "3.522" },
    { word: "TEST", freq: "3.535" },
    { word: "LOOP", freq: "3.545" },
    { word: "BYTE", freq: "3.555" },
    { word: "LIST", freq: "3.565" },
    { word: "HACK", freq: "3.582" },
    { word: "STAR", freq: "3.595" }
  ];

  const ALL_FREQS = ["3.505", "3.515", "3.522", "3.535", "3.545", "3.555", "3.565", "3.582", "3.595", "3.600"];

  // 預先生成 6 張保證 100% 連通的 6x6 迷宮地圖（座標 x:1..6, y:1..6）
  const MAZE_MARKER_PAIRS = [
    [{ x: 1, y: 2 }, { x: 6, y: 3 }],
    [{ x: 2, y: 4 }, { x: 5, y: 2 }],
    [{ x: 4, y: 4 }, { x: 6, y: 4 }],
    [{ x: 1, y: 1 }, { x: 1, y: 4 }],
    [{ x: 5, y: 3 }, { x: 4, y: 6 }],
    [{ x: 5, y: 1 }, { x: 3, y: 5 }]
  ];

  function generateFixedMaze(index) {
    const rng = BNN.createPRNG(`BNN-MAZE-MAP-${index + 1}`);
    const size = 6;
    const rightOpen = new Set();
    const downOpen = new Set();
    const visited = Array.from({ length: size + 1 }, () => Array(size + 1).fill(false));

    function carve(x, y) {
      visited[y][x] = true;
      const dirs = rng.shuffle([
        { dx: 1, dy: 0 },
        { dx: -1, dy: 0 },
        { dx: 0, dy: 1 },
        { dx: 0, dy: -1 }
      ]);
      for (const d of dirs) {
        const nx = x + d.dx;
        const ny = y + d.dy;
        if (nx >= 1 && nx <= size && ny >= 1 && ny <= size && !visited[ny][nx]) {
          if (d.dx === 1) rightOpen.add(`${x},${y}`);
          if (d.dx === -1) rightOpen.add(`${nx},${ny}`);
          if (d.dy === 1) downOpen.add(`${x},${y}`);
          if (d.dy === -1) downOpen.add(`${nx},${ny}`);
          carve(nx, ny);
        }
      }
    }
    carve(1, 1);

    // 多開 3 條捷徑增加路線變化但仍保有阻礙感
    for (let k = 0; k < 3; k++) {
      const rx = rng.int(1, 5);
      const ry = rng.int(1, 5);
      if (rng.bool(0.5)) rightOpen.add(`${rx},${ry}`);
      else downOpen.add(`${rx},${ry}`);
    }

    const rightWalls = [];
    const downWalls = [];
    for (let y = 1; y <= size; y++) {
      for (let x = 1; x <= size; x++) {
        if (x < size && !rightOpen.has(`${x},${y}`)) rightWalls.push(`${x},${y}`);
        if (y < size && !downOpen.has(`${x},${y}`)) downWalls.push(`${x},${y}`);
      }
    }

    return {
      id: index + 1,
      name: `地圖 #${index + 1}`,
      markers: MAZE_MARKER_PAIRS[index],
      rightWalls: new Set(rightWalls),
      downWalls: new Set(downWalls)
    };
  }

  const MAZE_MAPS = Array.from({ length: 6 }, (_, i) => generateFixedMaze(i));

  function canMazeMove(maze, x, y, dx, dy) {
    const nx = x + dx;
    const ny = y + dy;
    if (nx < 1 || nx > 6 || ny < 1 || ny > 6) return false;
    if (dx === 1) return !maze.rightWalls.has(`${x},${y}`);
    if (dx === -1) return !maze.rightWalls.has(`${nx},${ny}`);
    if (dy === 1) return !maze.downWalls.has(`${x},${y}`);
    if (dy === -1) return !maze.downWalls.has(`${nx},${ny}`);
    return false;
  }

  function generateEdgework(rng) {
    const useVowel = rng.bool(0.5);
    const l1 = useVowel ? rng.pick(LETTERS_VOWEL) : rng.pick(LETTERS_CONS);
    const l2 = rng.pick(LETTERS_CONS);
    const digits = [rng.int(1, 9), rng.int(0, 9), rng.int(0, 9), rng.int(0, 9)];
    const serial = `${l1}${l2}-${digits.join("")}`;
    const serialLastDigit = digits[3];
    const serialSum = digits.reduce((a, b) => a + b, 0);

    return {
      serial,
      serialLastDigit,
      serialIsOdd: serialLastDigit % 2 === 1,
      serialSum,
      hasVowel: useVowel,
      batteries: rng.int(0, 4),
      label: rng.pick(["ALPHA", "BETA", "OMEGA"]),
      indicators: {
        TURBO: rng.bool(0.5),
        OVERLOAD: rng.bool(0.5),
        SHIELD: rng.bool(0.5)
      }
    };
  }

  // =========================================================================
  // 程式模組 1~6 (Scratch × Python)
  // =========================================================================
  function buildLogicGateModule(rng, edge) {
    let variantKey = "D";
    if (edge.batteries >= 2 && edge.indicators.OVERLOAD) variantKey = "A";
    else if (edge.batteries >= 2 && !edge.indicators.OVERLOAD) variantKey = "B";
    else if (edge.batteries < 2 && edge.indicators.OVERLOAD) variantKey = "C";

    const RULES = {
      A: (p, m) => (p >= 60 && m === "X" ? "SAFE" : p < 30 || m === "Y" ? "DRAIN" : "BLOCK"),
      B: (p, m) => (p > 50 || m === "Y" ? "DRAIN" : p <= 20 && m === "X" ? "BLOCK" : "SAFE"),
      C: (p, m) => (m === "Y" && p >= 40 ? "BLOCK" : p < 40 || m === "X" ? "SAFE" : "DRAIN"),
      D: (p, m) => (p >= 70 || (m === "X" && p >= 30) ? "SAFE" : m === "Y" && p < 50 ? "BLOCK" : "DRAIN")
    };

    const CASES_GEN = {
      A: () => [{ power: rng.int(65, 95), mode: "X" }, { power: rng.int(10, 25), mode: "Z" }, { power: rng.int(35, 55), mode: "Z" }],
      B: () => [{ power: rng.int(58, 90), mode: "Z" }, { power: rng.int(5, 19), mode: "X" }, { power: rng.int(26, 46), mode: "Z" }],
      C: () => [{ power: rng.int(45, 90), mode: "Y" }, { power: rng.int(10, 35), mode: "Z" }, { power: rng.int(45, 85), mode: "Z" }],
      D: () => [{ power: rng.int(72, 95), mode: "Z" }, { power: rng.int(10, 45), mode: "Y" }, { power: rng.int(52, 68), mode: "Z" }]
    };

    const testCases = rng.shuffle(CASES_GEN[variantKey]()).map((tc, i) => ({
      name: `脈衝 #${i + 1}`,
      power: tc.power,
      mode: tc.mode,
      expected: RULES[variantKey](tc.power, tc.mode)
    }));

    return {
      id: "logic_gate",
      kind: "scratch",
      title: "⚡ 雙重防爆邏輯閘",
      subtitle: "使用「如果...那麼...否則」與「且 / 或」，通過全部 3 組脈衝驗證",
      goalHint: "依序測試 3 組 (power, mode) 訊號並輸出正確動作",
      pyCategory: "control",
      sensorOptions: ["power", "mode"],
      varOptions: ["power"],
      listOptions: [],
      testCases,
      palette: [
        { type: "c_if", label: "如果 < > 那麼" },
        { type: "c_ifelse", label: "如果 < > 那麼 ... 否則" },
        { type: "sensor", arg: "power", label: "(感測值 [power / mode])" },
        { type: "mode_lit", arg: "X", label: "(模式 [X / Y / Z])" },
        { type: "cmp", presetOp: ">=", label: "< ( ) ≥ ( ) >" },
        { type: "cmp", presetOp: "<", label: "< ( ) < ( ) >" },
        { type: "cmp", presetOp: "=", label: "< ( ) = ( ) >" },
        { type: "logic_and", label: "< ( ) 且 ( ) >" },
        { type: "logic_or", label: "< ( ) 或 ( ) >" },
        { type: "logic_not", label: "< 不成立 ( ) >" },
        { type: "action_output", label: "輸出動作 [SAFE/DRAIN/BLOCK]" }
      ],
      evaluate(ast) {
        const logs = [];
        for (const tc of testCases) {
          const res = BNN.runProgram(ast, { sensors: { power: tc.power, mode: tc.mode } });
          if (!res.ok) return { pass: false, reason: res.error, logs: res.trace };
          const out = res.actions.filter((a) => a.type === "output").map((a) => a.value);
          logs.push(`${tc.name} (power=${tc.power}, mode="${tc.mode}") → 輸出 [${out.join(", ") || "無"}]（正確為 ${tc.expected}）`);
          if (out.length !== 1 || out[0] !== tc.expected) {
            return {
              pass: false,
              reason: `${tc.name} (power=${tc.power}, mode=${tc.mode}) 預期輸出 ${tc.expected}，你的程式輸出「${out.join(", ") || "無動作"}」`,
              logs
            };
          }
        }
        return { pass: true, logs };
      }
    };
  }

  function buildLoopCoolantModule(rng, edge) {
    let variantKey = "OMEGA";
    if (edge.label === "ALPHA" && edge.serialIsOdd) variantKey = "A1";
    else if (edge.label === "ALPHA" && !edge.serialIsOdd) variantKey = "A2";
    else if (edge.label === "BETA") variantKey = "BETA";

    const startVal = rng.int(2, 8);
    function computeExpected(start) {
      let e = start;
      const seq = [];
      if (variantKey === "A1") {
        for (let i = 0; i < 4; i++) { e += 5; seq.push(e); }
      } else if (variantKey === "A2") {
        for (let i = 0; i < 3; i++) { e *= 2; seq.push(e); }
      } else if (variantKey === "BETA") {
        for (let i = 0; i < 5; i++) { e += 3; seq.push(e); }
      } else {
        for (let i = 0; i < 4; i++) { e = e * 2 + 1; seq.push(e); }
      }
      return seq;
    }
    const expectedSeq = computeExpected(startVal);

    return {
      id: "loop_coolant",
      kind: "scratch",
      title: "🍌 連環香蕉計數器",
      subtitle: "初始化變數 energy 並使用「重複 (N) 次」逐步發射精準脈衝",
      goalHint: `起始能量 start = ${startVal}，請依 Python 迴圈步驟逐次發射脈衝`,
      pyCategory: "loop",
      sensorOptions: ["start"],
      varOptions: ["energy"],
      listOptions: [],
      startVal,
      expectedSeq,
      palette: [
        { type: "set_var", arg: "energy", label: "設變數 [energy] 為 ( )" },
        { type: "change_var", arg: "energy", label: "變數 [energy] 改變 ( )" },
        { type: "c_repeat", arg: "4", label: "重複 ( ) 次" },
        { type: "var_get", arg: "energy", label: "(變數 [energy])" },
        { type: "sensor", arg: "start", label: "(感測值 [start])" },
        { type: "math_bin", presetOp: "+", label: "(( ) + ( ))" },
        { type: "math_bin", presetOp: "*", label: "(( ) * ( ))" },
        { type: "action_pulse", label: "發射冷卻脈衝 ( )" }
      ],
      evaluate(ast) {
        const res = BNN.runProgram(ast, { sensors: { start: startVal } });
        if (!res.ok) return { pass: false, reason: res.error, logs: [] };
        const pulses = res.actions.filter((a) => a.type === "pulse").map((a) => a.value);
        const logs = [`起始 start=${startVal}`, `你的脈衝序列：[${pulses.join(" → ") || "無"}]`];
        if (pulses.length !== expectedSeq.length) {
          return { pass: false, reason: `共需發射 ${expectedSeq.length} 次脈衝，但你的程式發射了 ${pulses.length} 次！`, logs };
        }
        for (let i = 0; i < expectedSeq.length; i++) {
          if (pulses[i] !== expectedSeq[i]) {
            return { pass: false, reason: `第 ${i + 1} 次脈衝數值錯誤：你的程式發射了 ${pulses[i]}`, logs };
          }
        }
        return { pass: true, logs };
      }
    };
  }

  function buildWireArrayModule(rng, edge) {
    const len = rng.pick([4, 5]);
    let variantKey = "R4";
    if (edge.hasVowel && edge.batteries % 2 === 0) variantKey = "R1";
    else if (edge.hasVowel && edge.batteries % 2 === 1) variantKey = "R2";
    else if (!edge.hasVowel && edge.batteries % 2 === 0) variantKey = "R3";

    const RULES = {
      R1: (w) => (w[0] === "紅" && w[w.length - 1] === "藍" ? 2 : w[1] === "黃" || w[2] === "綠" ? 4 : w.length),
      R2: (w) => (w[1] === "藍" && w.includes("白") ? 1 : w[0] === "綠" || w[w.length - 1] === "紅" ? 3 : 2),
      R3: (w) => (w[2] === "紅" ? w.length - 1 : w[0] === "黃" && w[1] === "藍" ? 1 : 4),
      R4: (w) => (w[w.length - 1] === "黃" || w[0] === "白" ? 3 : w[1] === "紅" && w[2] === "綠" ? 2 : w.length)
    };

    function randomWires() {
      return Array.from({ length: len }, () => rng.pick(WIRE_COLORS));
    }

    function makeCraftedArrays() {
      const a1 = randomWires();
      const a2 = randomWires();
      const a3 = randomWires();
      if (variantKey === "R1") {
        a1[0] = "紅"; a1[len - 1] = "藍";
        a2[0] = "白"; a2[1] = "黃"; a2[len - 1] = "綠";
        a3[0] = "藍"; a3[1] = "紅"; a3[2] = "白"; a3[len - 1] = "黃";
      } else if (variantKey === "R2") {
        a1[1] = "藍"; a1[len - 1] = "白";
        a2[0] = "綠"; a2[1] = "黃"; a2[2] = "黃"; a2[3] = "黃"; if (a2[len - 1] === "白") a2[len - 1] = "黃";
        a3[0] = "黃"; a3[1] = "紅"; a3[2] = "藍"; a3[len - 1] = "綠";
      } else if (variantKey === "R3") {
        a1[2] = "紅";
        a2[0] = "黃"; a2[1] = "藍"; a2[2] = "綠";
        a3[0] = "白"; a3[1] = "白"; a3[2] = "藍";
      } else {
        a1[0] = "白";
        a2[0] = "藍"; a2[1] = "紅"; a2[2] = "綠"; a2[len - 1] = "藍";
        a3[0] = "紅"; a3[1] = "黃"; a3[2] = "白"; a3[len - 1] = "綠";
      }
      return rng.shuffle([a1, a2, a3]);
    }

    const testCases = makeCraftedArrays().map((wires, idx) => ({
      name: `線排測試 #${idx + 1}`,
      wires,
      expectedCut: RULES[variantKey](wires)
    }));

    return {
      id: "wire_array",
      kind: "scratch",
      title: "🔌 彩線矩陣密碼鎖",
      subtitle: "小心 Python [0] 與 Scratch 第 (1) 項的差異！通過 3 組線排檢查",
      goalHint: `每組共 ${len} 條線，請用「清單 [wires]」判斷應剪斷第幾條`,
      pyCategory: "var",
      sensorOptions: [],
      varOptions: ["pos"],
      listOptions: ["wires"],
      wireCount: len,
      testCases,
      palette: [
        { type: "c_ifelse", label: "如果 < > 那麼 ... 否則" },
        { type: "c_if", label: "如果 < > 那麼" },
        { type: "list_item", arg: "wires", label: "(清單 [wires] 第 ( ) 項)" },
        { type: "list_len", arg: "wires", label: "(清單 [wires] 的長度)" },
        { type: "list_contains", arg: "wires", label: "<清單 [wires] 包含 ( )>" },
        { type: "color_lit", arg: "紅", label: "(顏色 [紅/藍/黃/綠/白])" },
        { type: "cmp", presetOp: "=", label: "< ( ) = ( ) >" },
        { type: "logic_and", label: "< ( ) 且 ( ) >" },
        { type: "logic_or", label: "< ( ) 或 ( ) >" },
        { type: "math_bin", presetOp: "-", label: "(( ) - ( ))" },
        { type: "action_cut", label: "剪斷第 ( ) 條線" }
      ],
      evaluate(ast) {
        const logs = [];
        for (const tc of testCases) {
          const res = BNN.runProgram(ast, { lists: { wires: tc.wires } });
          if (!res.ok) return { pass: false, reason: res.error, logs: [] };
          const cuts = res.actions.filter((a) => a.type === "cut").map((a) => a.value);
          logs.push(`${tc.name} [${tc.wires.join(",")}] → 剪第 ${cuts.join(",") || "無"} 條（應剪第 ${tc.expectedCut} 條）`);
          if (cuts.length !== 1 || cuts[0] !== tc.expectedCut) {
            return {
              pass: false,
              reason: `${tc.name} [${tc.wires.join("、")}] 應剪斷第 ${tc.expectedCut} 條，你的程式剪了「${cuts.join(",") || "沒剪"}」`,
              logs
            };
          }
        }
        return { pass: true, logs };
      }
    };
  }

  function buildWhileCoolingModule(rng, edge) {
    let variantKey = "D";
    if (edge.indicators.SHIELD && edge.serialIsOdd) variantKey = "A";
    else if (edge.indicators.SHIELD && !edge.serialIsOdd) variantKey = "B";
    else if (!edge.indicators.SHIELD && edge.serialIsOdd) variantKey = "C";

    function simulate(startTemp) {
      let t = startTemp;
      const vents = [];
      if (variantKey === "A") while (t > 30) { t -= 12; vents.push(t); }
      else if (variantKey === "B") while (t >= 25) { t -= t > 60 ? 20 : 10; vents.push(t); }
      else if (variantKey === "C") while (t > 20) { t -= 15; vents.push(t); }
      else while (t >= 35) { t -= t % 2 === 0 ? 14 : 9; vents.push(t); }
      return { vents, finalTemp: t };
    }

    const t1 = rng.int(71, 89);
    const t2 = rng.int(98, 122);
    const testCases = [t1, t2].map((startTemp, idx) => ({
      name: `反應爐測試 #${idx + 1}`,
      startTemp,
      expected: simulate(startTemp)
    }));

    return {
      id: "while_cooling",
      kind: "scratch",
      title: "❄️ 反應爐降溫閥",
      subtitle: "把 Python 的 while 翻譯成 Scratch「重複直到」(注意條件要相反！)",
      goalHint: "先設變數 temp = start_temp，降溫並 vent()，最後 lock_core()",
      pyCategory: "loop",
      sensorOptions: ["start_temp"],
      varOptions: ["temp"],
      listOptions: [],
      testCases,
      palette: [
        { type: "set_var", arg: "temp", label: "設變數 [temp] 為 ( )" },
        { type: "change_var", arg: "temp", label: "變數 [temp] 改變 ( )" },
        { type: "c_until", label: "重複直到 < >" },
        { type: "c_ifelse", label: "如果 < > 那麼 ... 否則" },
        { type: "var_get", arg: "temp", label: "(變數 [temp])" },
        { type: "sensor", arg: "start_temp", label: "(感測值 [start_temp])" },
        { type: "cmp", presetOp: "<=", label: "< ( ) ≤ ( ) >" },
        { type: "cmp", presetOp: "<", label: "< ( ) < ( ) >" },
        { type: "cmp", presetOp: ">", label: "< ( ) > ( ) >" },
        { type: "cmp", presetOp: "=", label: "< ( ) = ( ) >" },
        { type: "math_bin", presetOp: "-", label: "(( ) - ( ))" },
        { type: "math_mod", label: "(( ) 除以 ( ) 的餘數)" },
        { type: "logic_not", label: "< 不成立 ( ) >" },
        { type: "action_vent", label: "開啟排熱閥 vent()" },
        { type: "action_lock", label: "鎖定核心 lock_core()" }
      ],
      evaluate(ast) {
        const logs = [];
        for (const tc of testCases) {
          const res = BNN.runProgram(ast, { sensors: { start_temp: tc.startTemp } });
          if (!res.ok) return { pass: false, reason: res.error, logs: [] };
          const vents = res.actions.filter((a) => a.type === "vent").map((a) => a.value);
          const locks = res.actions.filter((a) => a.type === "lock").map((a) => a.value);
          const exp = tc.expected;
          logs.push(`${tc.name} (${tc.startTemp}°C) → 排熱 [${vents.join("→") || "無"}]，鎖定=${locks.length > 0 ? locks[0] + "°C" : "未鎖定"}`);
          if (vents.length !== exp.vents.length || vents.some((v, i) => v !== exp.vents[i])) {
            return { pass: false, reason: `${tc.name} (${tc.startTemp}°C) 降溫步驟或「重複直到」條件有誤！`, logs };
          }
          const lastAction = res.actions[res.actions.length - 1];
          if (!lastAction || lastAction.type !== "lock" || locks.length !== 1) {
            return { pass: false, reason: `${tc.name} 迴圈結束後必須呼叫一次「鎖定核心 lock_core()」！`, logs };
          }
        }
        return { pass: true, logs };
      }
    };
  }

  function buildLedBinaryModule(rng, edge) {
    let variantKey = "V4";
    if (edge.indicators.TURBO && edge.serialSum % 2 === 0) variantKey = "V1";
    else if (edge.indicators.TURBO && edge.serialSum % 2 === 1) variantKey = "V2";
    else if (!edge.indicators.TURBO && edge.serialSum % 2 === 0) variantKey = "V3";

    function computeCode(leds) {
      if (variantKey === "V1") return leds[0] * 8 + leds[1] * 4 + leds[2] * 2 + leds[3];
      if (variantKey === "V2") {
        let total = 0;
        for (let i = 0; i < 4; i++) total += leds[i] * (i + 1);
        return (total * 3) % 10;
      }
      if (variantKey === "V3") {
        let count = 0;
        for (let i = 0; i < 4; i++) if (leds[i] === 1) count++;
        return count * 10 + (leds[0] + leds[3]);
      }
      return (leds[3] * 8 + leds[2] * 4 + leds[1] * 2 + leds[0]) % 12;
    }

    function randomPattern() { return [rng.int(0, 1), rng.int(0, 1), rng.int(0, 1), rng.int(0, 1)]; }
    const p1 = randomPattern();
    let p2 = randomPattern();
    let guard = 0;
    while (computeCode(p1) === computeCode(p2) && guard < 15) { p2 = randomPattern(); guard++; }
    if (computeCode(p1) === computeCode(p2)) p2 = [p1[0] ^ 1, p1[1], p1[2], p1[3] ^ 1];

    const testCases = [p1, p2].map((leds, idx) => ({ name: `燈號組 #${idx + 1}`, leds, expected: computeCode(leds) }));

    return {
      id: "led_binary",
      kind: "scratch",
      title: "💡 香蕉二進位譯碼器",
      subtitle: "讀取 4 顆香蕉燈號清單 leds (亮=1, 滅=0)，計算並提交解鎖密碼",
      goalHint: "通過 2 組燈號測試，注意清單第 1~4 項與餘數運算 %",
      pyCategory: "math",
      sensorOptions: [],
      varOptions: ["total", "count", "i", "code"],
      listOptions: ["leds"],
      testCases,
      palette: [
        { type: "set_var", arg: "total", label: "設變數 [total/i/code] 為 ( )" },
        { type: "change_var", arg: "i", label: "變數 [ ] 改變 ( )" },
        { type: "c_repeat", arg: "4", label: "重複 ( ) 次" },
        { type: "c_if", label: "如果 < > 那麼" },
        { type: "var_get", arg: "total", label: "(變數 [total/i/code])" },
        { type: "list_item", arg: "leds", label: "(清單 [leds] 第 ( ) 項)" },
        { type: "cmp", presetOp: "=", label: "< ( ) = ( ) >" },
        { type: "math_bin", presetOp: "+", label: "(( ) + ( ))" },
        { type: "math_bin", presetOp: "*", label: "(( ) * ( ))" },
        { type: "math_mod", label: "(( ) 除以 ( ) 的餘數)" },
        { type: "action_submit_code", label: "提交解鎖碼 ( )" }
      ],
      evaluate(ast) {
        const logs = [];
        for (const tc of testCases) {
          const res = BNN.runProgram(ast, { lists: { leds: tc.leds } });
          if (!res.ok) return { pass: false, reason: res.error, logs: [] };
          const subs = res.actions.filter((a) => a.type === "submit_code").map((a) => a.value);
          logs.push(`${tc.name} [${tc.leds.join("")}] → 提交 [${subs.join(",") || "無"}]（正確為 ${tc.expected}）`);
          if (subs.length !== 1 || subs[0] !== tc.expected) {
            return { pass: false, reason: `${tc.name} [${tc.leds.join("")}] 預期密碼為 ${tc.expected}，你的程式提交了「${subs.join(",") || "無"}」`, logs };
          }
        }
        return { pass: true, logs };
      }
    };
  }

  function buildFuncCipherModule(rng, edge) {
    const highPow = edge.label === "OMEGA" || edge.batteries >= 3;
    let variantKey = "D";
    if (edge.hasVowel && highPow) variantKey = "A";
    else if (edge.hasVowel && !highPow) variantKey = "B";
    else if (!edge.hasVowel && highPow) variantKey = "C";

    const FUNCS = {
      A: (x) => (x % 2 === 0 ? Math.floor(x / 2) + 5 : x * 3 + 1),
      B: (x) => (x >= 10 ? (x - 4) * 2 : x + 15),
      C: (x) => (x % 3 === 0 ? Math.floor(x / 3) + 10 : x % 2 === 0 ? x + 7 : x * 2),
      D: (x) => { const ans = (x * 2 + 3) % 10; return ans < 5 ? ans + 10 : ans; }
    };

    const INPUTS_GEN = {
      A: () => [rng.pick([6, 8, 12, 14]), rng.pick([3, 5, 7, 9]), rng.pick([10, 16])],
      B: () => [rng.int(11, 18), rng.int(3, 9), rng.int(10, 14)],
      C: () => [rng.pick([6, 9, 12, 15]), rng.pick([4, 8, 10]), rng.pick([5, 7, 11])],
      D: () => [rng.pick([1, 6, 11]), rng.pick([3, 4, 8]), rng.pick([2, 7])]
    };

    const testCases = rng.shuffle(INPUTS_GEN[variantKey]()).map((x, idx) => ({
      name: `密文 #${idx + 1}`,
      x,
      expected: FUNCS[variantKey](x)
    }));

    return {
      id: "func_cipher",
      kind: "scratch",
      title: "🐒 猴子解密函式機",
      subtitle: "實作 Python decrypt(x) 函式（注意 // 整數除法要用「無條件捨去」）",
      goalHint: "依序代入 3 個挑戰輸入 x 並用「回傳密碼」輸出結果",
      pyCategory: "math",
      sensorOptions: ["x"],
      varOptions: ["ans"],
      listOptions: [],
      testCases,
      palette: [
        { type: "c_ifelse", label: "如果 < > 那麼 ... 否則" },
        { type: "c_if", label: "如果 < > 那麼" },
        { type: "set_var", arg: "ans", label: "設變數 [ans] 為 ( )" },
        { type: "var_get", arg: "ans", label: "(變數 [ans])" },
        { type: "sensor", arg: "x", label: "(感測值 [x])" },
        { type: "cmp", presetOp: "=", label: "< ( ) = ( ) >" },
        { type: "cmp", presetOp: ">=", label: "< ( ) ≥ ( ) >" },
        { type: "cmp", presetOp: "<", label: "< ( ) < ( ) >" },
        { type: "math_bin", presetOp: "+", label: "(( ) + ( ))" },
        { type: "math_bin", presetOp: "-", label: "(( ) - ( ))" },
        { type: "math_bin", presetOp: "*", label: "(( ) * ( ))" },
        { type: "math_floor_div", label: "(無條件捨去 (( ) / ( )))" },
        { type: "math_mod", label: "(( ) 除以 ( ) 的餘數)" },
        { type: "action_return", label: "回傳密碼 ( )" }
      ],
      evaluate(ast) {
        const logs = [];
        for (const tc of testCases) {
          const res = BNN.runProgram(ast, { sensors: { x: tc.x } });
          if (!res.ok) return { pass: false, reason: res.error, logs: [] };
          const rets = res.actions.filter((a) => a.type === "return").map((a) => a.value);
          logs.push(`${tc.name} x=${tc.x} → 回傳 [${rets.join(",") || "無"}]（正確為 ${tc.expected}）`);
          if (rets.length !== 1 || rets[0] !== tc.expected) {
            return { pass: false, reason: `${tc.name} (x=${tc.x}) 預期回傳 ${tc.expected}，你的程式回傳了「${rets.join(",") || "無"}」`, logs };
          }
        }
        return { pass: true, logs };
      }
    };
  }

  // =========================================================================
  // 非程式小遊戲 7：🔴 終極香蕉大按鈕 (Big Button — 點一下 vs 按住讀秒)
  // =========================================================================
  function buildBigButtonModule(rng, edge) {
    const color = rng.pick(["紅", "藍", "黃", "白"]);
    const label = rng.pick(["引爆", "按住", "香蕉萬歲", "緊急停止"]);
    const stripColor = rng.pick(["藍", "白", "黃", "紅"]);

    let expectedAction = "hold";
    if (color === "藍" && label === "引爆") expectedAction = "hold";
    else if (edge.batteries > 1 && label === "引爆") expectedAction = "tap";
    else if (color === "白" && edge.indicators.OVERLOAD) expectedAction = "hold";
    else if (edge.batteries > 2 && edge.indicators.TURBO) expectedAction = "tap";
    else if (color === "黃") expectedAction = "hold";
    else if (color === "紅" && label === "按住") expectedAction = "tap";
    else expectedAction = "hold";

    const targetDigit =
      stripColor === "藍" ? "4" : stripColor === "白" ? "1" : stripColor === "黃" ? "5" : "2";

    return {
      id: "big_button",
      kind: "minigame",
      title: "🔴 終極香蕉大按鈕",
      subtitle: "非程式快手挑戰！問指揮官這顆該「點一下放開」還是「按住看光條」",
      goalHint: "按住不放時旁邊光條會發亮！依指揮官指示決定直接點按或讀秒放開",
      pyCategory: "all",
      color,
      label,
      stripColor,
      expectedAction,
      targetDigit,
      evaluateButtonRelease({ heldMs, timerDisplay }) {
        const isTap = heldMs < 420;
        if (expectedAction === "tap") {
          if (isTap) return { pass: true, message: "⚡ 精準單點！成功解除香蕉大按鈕！" };
          return { pass: false, reason: "應該「點一下立刻放開」就好，不能長按！" };
        }
        // Hold mode
        if (isTap) {
          return { pass: false, reason: "這顆按鈕必須「按住不放」，等旁邊光條亮起再對秒數！" };
        }
        if (String(timerDisplay || "").includes(targetDigit)) {
          return { pass: true, message: `🎯 在時間 ${timerDisplay}（含數字 ${targetDigit}）完美放開！` };
        }
        return {
          pass: false,
          reason: `光條是「${stripColor}色」，要在計時器出現數字 ${targetDigit} 時放開（你放開時是 ${timerDisplay}）！`
        };
      }
    };
  }

  // =========================================================================
  // 非程式小遊戲 8：🧭 隱藏雷射迷宮 (Blind Maze Navigation)
  // =========================================================================
  function buildLaserMazeModule(rng) {
    const mapIndex = rng.int(0, MAZE_MAPS.length - 1);
    const maze = MAZE_MAPS[mapIndex];
    const start = { x: rng.int(1, 6), y: rng.int(1, 6) };
    let goal = { x: rng.int(1, 6), y: rng.int(1, 6) };
    let guard = 0;
    while (Math.abs(goal.x - start.x) + Math.abs(goal.y - start.y) < 5 && guard < 40) {
      goal = { x: rng.int(1, 6), y: rng.int(1, 6) };
      guard++;
    }
    if (start.x === goal.x && start.y === goal.y) {
      goal = { x: start.x === 6 ? 1 : 6, y: start.y === 6 ? 1 : 6 };
    }

    return {
      id: "laser_maze",
      kind: "minigame",
      title: "🧭 隱藏雷射迷宮",
      subtitle: "非程式盲走合作！你看得到座標與定位環，指揮官才看得到雷射牆壁！",
      goalHint: "報出兩個青色圓圈 ⭕ 的座標給指揮官找地圖，聽指揮帶 🐒 走到 🚩",
      pyCategory: "all",
      maze,
      start,
      goal
    };
  }

  // =========================================================================
  // 非程式小遊戲 9：📻 摩斯香蕉電台 (Morse Code + Radio Tuner)
  // =========================================================================
  function buildMorseRadioModule(rng) {
    const target = rng.pick(MORSE_CHANNELS);
    const patternPerLetter = target.word.split("").map((ch) => ({
      letter: ch,
      code: MORSE_CODE[ch]
    }));

    return {
      id: "morse_radio",
      kind: "minigame",
      title: "📻 摩斯香蕉電台",
      subtitle: "非程式解碼挑戰！把信號燈的短點 ● 與長亮 ━ 唸給指揮官查出單字",
      goalHint: "認出閃爍單字後，將頻率調到對應 MHz 並按下發射",
      pyCategory: "all",
      targetWord: target.word,
      targetFreq: target.freq,
      patternPerLetter,
      allFreqs: ALL_FREQS
    };
  }

  const MODULE_BUILDERS = {
    logic_gate: buildLogicGateModule,
    loop_coolant: buildLoopCoolantModule,
    wire_array: buildWireArrayModule,
    while_cooling: buildWhileCoolingModule,
    led_binary: buildLedBinaryModule,
    func_cipher: buildFuncCipherModule,
    big_button: buildBigButtonModule,
    laser_maze: buildLaserMazeModule,
    morse_radio: buildMorseRadioModule
  };

  const MODULE_META = [
    { id: "logic_gate", kind: "scratch", title: "⚡ 雙重防爆邏輯閘", tag: "Scratch if/else" },
    { id: "loop_coolant", kind: "scratch", title: "🍌 連環香蕉計數器", tag: "Scratch 重複迴圈" },
    { id: "wire_array", kind: "scratch", title: "🔌 彩線矩陣密碼鎖", tag: "Scratch 清單索引" },
    { id: "while_cooling", kind: "scratch", title: "❄️ 反應爐降溫閥", tag: "Scratch 重複直到" },
    { id: "led_binary", kind: "scratch", title: "💡 香蕉二進位譯碼器", tag: "Scratch 迴圈+餘數" },
    { id: "func_cipher", kind: "scratch", title: "🐒 猴子解密函式機", tag: "Scratch 函式+整除" },
    { id: "big_button", kind: "minigame", title: "🔴 終極香蕉大按鈕", tag: "小遊戲｜按住讀秒" },
    { id: "laser_maze", kind: "minigame", title: "🧭 隱藏雷射迷宮", tag: "小遊戲｜盲眼導航" },
    { id: "morse_radio", kind: "minigame", title: "📻 摩斯香蕉電台", tag: "小遊戲｜閃燈調頻" }
  ];

  const PRESET_MODULES = {
    mix: ["logic_gate", "big_button", "wire_array", "laser_maze"],
    party_all: ["logic_gate", "big_button", "loop_coolant", "laser_maze", "while_cooling", "morse_radio", "func_cipher"],
    code_only: ["logic_gate", "loop_coolant", "wire_array", "while_cooling"],
    minigame_only: ["big_button", "laser_maze", "morse_radio"],
    challenge_all: Object.keys(MODULE_BUILDERS),
    unlimited: ["logic_gate", "big_button", "wire_array", "laser_maze"]
  };

  function generateBombMission(seedStr, preset = "mix", customModuleIds = null) {
    const rng = BNN.createPRNG(seedStr);
    const edgework = generateEdgework(rng);

    const moduleIds =
      Array.isArray(customModuleIds) && customModuleIds.length > 0
        ? customModuleIds.filter((id) => Boolean(MODULE_BUILDERS[id]))
        : PRESET_MODULES[preset] || PRESET_MODULES.mix;

    const modules = moduleIds.map((id) => MODULE_BUILDERS[id](rng, edgework));

    return {
      seed: seedStr,
      preset,
      edgework,
      modules
    };
  }

  BNN.MAZE_MAPS = MAZE_MAPS;
  BNN.canMazeMove = canMazeMove;
  BNN.MORSE_CODE = MORSE_CODE;
  BNN.MORSE_CHANNELS = MORSE_CHANNELS;
  BNN.MODULE_META = MODULE_META;
  BNN.PRESET_MODULES = PRESET_MODULES;
  BNN.generateBombMission = generateBombMission;
})(window);
