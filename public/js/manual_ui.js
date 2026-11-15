/**
 * manual_ui.js — 簡潔導引式「指揮官拆彈手冊」
 * 預設自動對準拆彈手目前所在關卡；每關只問這關需要的 1~2 個條件，立刻高亮對應規則！
 */
(function (global) {
  const BNN = (global.BNN = global.BNN || {});

  const MANUAL_CHAPTERS = [
    {
      id: "logic_gate",
      kind: "scratch",
      title: "⚡ 雙重防爆邏輯閘",
      askHint: "問拆彈手：① 香蕉電池有幾顆？ ② ⚡OVERLOAD 燈亮還是滅？",
      scratchTip: "Scratch 沒有 elif，請用兩層「如果...那麼...否則」包起來；感測值拉藍色 (power) 與 (mode)。",
      questions: [
        {
          key: "lg_batt",
          label: "🔋 電池數量",
          options: [
            { val: "ge2", text: "2 顆以上 (≥2)" },
            { val: "lt2", text: "0 或 1 顆 (<2)" }
          ]
        },
        {
          key: "lg_over",
          label: "⚡ OVERLOAD 燈",
          options: [
            { val: "on", text: "亮燈" },
            { val: "off", text: "熄滅" }
          ]
        }
      ],
      variants: [
        {
          condText: "電池 ≥ 2 且 ⚡OVERLOAD 亮燈",
          match: (a) => a.lg_batt === "ge2" && a.lg_over === "on",
          code: `# 規則 A\nif power >= 60 and mode == "X":\n    output("SAFE")\nelif power < 30 or mode == "Y":\n    output("DRAIN")\nelse:\n    output("BLOCK")`
        },
        {
          condText: "電池 ≥ 2 且 ⚡OVERLOAD 熄滅",
          match: (a) => a.lg_batt === "ge2" && a.lg_over === "off",
          code: `# 規則 B\nif power > 50 or mode == "Y":\n    output("DRAIN")\nelif power <= 20 and mode == "X":\n    output("BLOCK")\nelse:\n    output("SAFE")`
        },
        {
          condText: "電池 < 2 且 ⚡OVERLOAD 亮燈",
          match: (a) => a.lg_batt === "lt2" && a.lg_over === "on",
          code: `# 規則 C\nif mode == "Y" and power >= 40:\n    output("BLOCK")\nelif power < 40 or mode == "X":\n    output("SAFE")\nelse:\n    output("DRAIN")`
        },
        {
          condText: "電池 < 2 且 ⚡OVERLOAD 熄滅",
          match: (a) => a.lg_batt === "lt2" && a.lg_over === "off",
          code: `# 規則 D\nif power >= 70 or (mode == "X" and power >= 30):\n    output("SAFE")\nelif mode == "Y" and power < 50:\n    output("BLOCK")\nelse:\n    output("DRAIN")`
        }
      ]
    },
    {
      id: "loop_coolant",
      kind: "scratch",
      title: "🍌 連環香蕉計數器",
      askHint: "問拆彈手：① 型號標籤是什麼？ ② 若是 ALPHA，序號最後一碼是奇數還是偶數？",
      scratchTip: "開頭要設「energy = start」，進「重複幾次」迴圈內先算新能量，再「發射冷卻脈衝 (energy)」。",
      questions: [
        {
          key: "lc_label",
          label: "🏷️ 型號標籤",
          options: [
            { val: "ALPHA", text: "ALPHA" },
            { val: "BETA", text: "BETA" },
            { val: "OMEGA", text: "OMEGA" }
          ]
        },
        {
          key: "lc_odd",
          label: "🔢 序號末碼 (ALPHA才需要)",
          options: [
            { val: "odd", text: "奇數" },
            { val: "even", text: "偶數" }
          ]
        }
      ],
      variants: [
        {
          condText: '標籤為 "ALPHA" 且 序號末碼為奇數',
          match: (a) => a.lc_label === "ALPHA" && a.lc_odd === "odd",
          code: `energy = start\nfor i in range(4):\n    energy = energy + 5\n    pulse(energy)`
        },
        {
          condText: '標籤為 "ALPHA" 且 序號末碼為偶數',
          match: (a) => a.lc_label === "ALPHA" && a.lc_odd === "even",
          code: `energy = start\nfor i in range(3):\n    energy = energy * 2\n    pulse(energy)`
        },
        {
          condText: '標籤為 "BETA"（不限奇偶）',
          match: (a) => a.lc_label === "BETA",
          code: `energy = start\nfor i in range(5):\n    energy = energy + 3\n    pulse(energy)`
        },
        {
          condText: '標籤為 "OMEGA"（不限奇偶）',
          match: (a) => a.lc_label === "OMEGA",
          code: `energy = start\nfor i in range(4):\n    energy = energy * 2 + 1\n    pulse(energy)`
        }
      ]
    },
    {
      id: "wire_array",
      kind: "scratch",
      title: "🔌 彩線矩陣密碼鎖",
      askHint: "問拆彈手：① 序號有母音 (A,E,I,O,U) 嗎？ ② 電池是偶數顆還是奇數顆？",
      scratchTip: "🚨 Python 的 wires[0] = Scratch「第 (1) 項」、wires[-1] =「第 (清單長度) 項」！",
      questions: [
        {
          key: "wa_vowel",
          label: "🔤 序號含母音",
          options: [
            { val: "yes", text: "有母音" },
            { val: "no", text: "無母音" }
          ]
        },
        {
          key: "wa_batt",
          label: "🔋 電池奇偶",
          options: [
            { val: "even", text: "偶數 (0, 2, 4)" },
            { val: "odd", text: "奇數 (1, 3)" }
          ]
        }
      ],
      variants: [
        {
          condText: "序號含母音 且 電池為偶數",
          match: (a) => a.wa_vowel === "yes" && a.wa_batt === "even",
          code: `if wires[0] == "紅" and wires[-1] == "藍":\n    cut_wire(2)\nelif wires[1] == "黃" or wires[2] == "綠":\n    cut_wire(4)\nelse:\n    cut_wire(len(wires))`
        },
        {
          condText: "序號含母音 且 電池為奇數",
          match: (a) => a.wa_vowel === "yes" && a.wa_batt === "odd",
          code: `if wires[1] == "藍" and "白" in wires:\n    cut_wire(1)\nelif wires[0] == "綠" or wires[-1] == "紅":\n    cut_wire(3)\nelse:\n    cut_wire(2)`
        },
        {
          condText: "序號無母音 且 電池為偶數",
          match: (a) => a.wa_vowel === "no" && a.wa_batt === "even",
          code: `if wires[2] == "紅":\n    cut_wire(len(wires) - 1)\nelif wires[0] == "黃" and wires[1] == "藍":\n    cut_wire(1)\nelse:\n    cut_wire(4)`
        },
        {
          condText: "序號無母音 且 電池為奇數",
          match: (a) => a.wa_vowel === "no" && a.wa_batt === "odd",
          code: `if wires[-1] == "黃" or wires[0] == "白":\n    cut_wire(3)\nelif wires[1] == "紅" and wires[2] == "綠":\n    cut_wire(2)\nelse:\n    cut_wire(len(wires))`
        }
      ]
    },
    {
      id: "while_cooling",
      kind: "scratch",
      title: "❄️ 反應爐降溫閥",
      askHint: "問拆彈手：① 🛡️SHIELD 燈亮還是滅？ ② 序號最後一碼是奇數還是偶數？",
      scratchTip: "🚨 while temp > 30 在 Scratch「重複直到」要寫相反條件 < temp ≤ 30 >！結束迴圈再呼叫 lock_core()。",
      questions: [
        {
          key: "wc_shield",
          label: "🛡️ SHIELD 燈",
          options: [
            { val: "on", text: "亮燈" },
            { val: "off", text: "熄滅" }
          ]
        },
        {
          key: "wc_odd",
          label: "🔢 序號末碼",
          options: [
            { val: "odd", text: "奇數" },
            { val: "even", text: "偶數" }
          ]
        }
      ],
      variants: [
        {
          condText: "🛡️SHIELD 亮燈 且 末碼奇數",
          match: (a) => a.wc_shield === "on" && a.wc_odd === "odd",
          code: `temp = start_temp\nwhile temp > 30:\n    temp = temp - 12\n    vent()\nlock_core()`
        },
        {
          condText: "🛡️SHIELD 亮燈 且 末碼偶數",
          match: (a) => a.wc_shield === "on" && a.wc_odd === "even",
          code: `temp = start_temp\nwhile temp >= 25:\n    if temp > 60:\n        temp = temp - 20\n    else:\n        temp = temp - 10\n    vent()\nlock_core()`
        },
        {
          condText: "🛡️SHIELD 熄滅 且 末碼奇數",
          match: (a) => a.wc_shield === "off" && a.wc_odd === "odd",
          code: `temp = start_temp\nwhile temp > 20:\n    temp = temp - 15\n    vent()\nlock_core()`
        },
        {
          condText: "🛡️SHIELD 熄滅 且 末碼偶數",
          match: (a) => a.wc_shield === "off" && a.wc_odd === "even",
          code: `temp = start_temp\nwhile temp >= 35:\n    if temp % 2 == 0:\n        temp = temp - 14\n    else:\n        temp = temp - 9\n    vent()\nlock_core()`
        }
      ]
    },
    {
      id: "led_binary",
      kind: "scratch",
      title: "💡 香蕉二進位譯碼器",
      askHint: "問拆彈手：① 🍌TURBO 燈亮還是滅？ ② 序號 4 個數字「加起來」是偶數還是奇數？",
      scratchTip: "leds 共 4 項（亮=1、滅=0）；若用迴圈計數記得設變數 i 從 1 開始；餘數 % 用綠色「除以...的餘數」。",
      questions: [
        {
          key: "lb_turbo",
          label: "🍌 TURBO 燈",
          options: [
            { val: "on", text: "亮燈" },
            { val: "off", text: "熄滅" }
          ]
        },
        {
          key: "lb_sum",
          label: "➕ 序號4數字和",
          options: [
            { val: "even", text: "偶數" },
            { val: "odd", text: "奇數" }
          ]
        }
      ],
      variants: [
        {
          condText: "🍌TURBO 亮燈 且 數字和偶數",
          match: (a) => a.lb_turbo === "on" && a.lb_sum === "even",
          code: `code = leds[0]*8 + leds[1]*4 + leds[2]*2 + leds[3]*1\nsubmit_code(code)`
        },
        {
          condText: "🍌TURBO 亮燈 且 數字和奇數",
          match: (a) => a.lb_turbo === "on" && a.lb_sum === "odd",
          code: `total = 0\nfor i in range(4):\n    total = total + leds[i] * (i + 1)\nsubmit_code((total * 3) % 10)`
        },
        {
          condText: "🍌TURBO 熄滅 且 數字和偶數",
          match: (a) => a.lb_turbo === "off" && a.lb_sum === "even",
          code: `count = 0\nfor i in range(4):\n    if leds[i] == 1:\n        count = count + 1\nsubmit_code(count * 10 + (leds[0] + leds[3]))`
        },
        {
          condText: "🍌TURBO 熄滅 且 數字和奇數",
          match: (a) => a.lb_turbo === "off" && a.lb_sum === "odd",
          code: `code = leds[3]*8 + leds[2]*4 + leds[1]*2 + leds[0]*1\nsubmit_code(code % 12)`
        }
      ]
    },
    {
      id: "func_cipher",
      kind: "scratch",
      title: "🐒 猴子解密函式機",
      askHint: "問拆彈手：① 序號有母音嗎？ ② 標籤是 OMEGA 或電池 ≥ 3 顆嗎？",
      scratchTip: "Python 的 // 是無條件捨去除法！Scratch 請用綠色「無條件捨去 ((x) / (2))」，最後用「回傳密碼」。",
      questions: [
        {
          key: "fc_vowel",
          label: "🔤 序號含母音",
          options: [
            { val: "yes", text: "有母音" },
            { val: "no", text: "無母音" }
          ]
        },
        {
          key: "fc_high",
          label: "🏷️ OMEGA 或 電池≥3",
          options: [
            { val: "yes", text: "符合其一 (是)" },
            { val: "no", text: "都沒有 (否)" }
          ]
        }
      ],
      variants: [
        {
          condText: "含母音 且 (OMEGA 或 電池 ≥ 3)",
          match: (a) => a.fc_vowel === "yes" && a.fc_high === "yes",
          code: `def decrypt(x):\n    if x % 2 == 0:\n        return x // 2 + 5\n    else:\n        return x * 3 + 1`
        },
        {
          condText: "含母音 且 非OMEGA 且 電池 < 3",
          match: (a) => a.fc_vowel === "yes" && a.fc_high === "no",
          code: `def decrypt(x):\n    if x >= 10:\n        return (x - 4) * 2\n    else:\n        return x + 15`
        },
        {
          condText: "無母音 且 (OMEGA 或 電池 ≥ 3)",
          match: (a) => a.fc_vowel === "no" && a.fc_high === "yes",
          code: `def decrypt(x):\n    if x % 3 == 0:\n        return x // 3 + 10\n    elif x % 2 == 0:\n        return x + 7\n    else:\n        return x * 2`
        },
        {
          condText: "無母音 且 非OMEGA 且 電池 < 3",
          match: (a) => a.fc_vowel === "no" && a.fc_high === "no",
          code: `def decrypt(x):\n    ans = (x * 2 + 3) % 10\n    if ans < 5:\n        return ans + 10\n    return ans`
        }
      ]
    },
    {
      id: "big_button",
      kind: "minigame",
      title: "🔴 終極香蕉大按鈕",
      askHint: "先問拆彈手：① 按鈕「顏色」與「文字」 ② 電池數與 TURBO / OVERLOAD 燈！"
    },
    {
      id: "laser_maze",
      kind: "minigame",
      title: "🧭 隱藏雷射迷宮",
      askHint: "先問拆彈手：兩個青色定位環 ⭕ 的座標 (X, Y) 在哪裡？"
    },
    {
      id: "morse_radio",
      kind: "minigame",
      title: "📻 摩斯香蕉電台",
      askHint: "請拆彈手唸出燈號「短點 ●」和「長亮 ━」，你點擊篩選找出單字！"
    }
  ];

  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function renderBigButtonManual(answers, setAnswer) {
    const bCount = answers.bb_batt; // "0-1", "2", "3-4"
    const turboOn = answers.bb_turbo; // "on" | "off"
    const overOn = answers.bb_over; // "on" | "off"

    const pill = (key, val, text) =>
      `<button type="button" class="q-pill ${answers[key] === val ? "active" : ""}" data-qkey="${key}" data-qval="${val}">${text}</button>`;

    return `
      <div class="mini-manual-wrap">
        <div class="q-filter-box">
          <div class="q-row">
            <span>🔋 電池數量</span>
            <div class="q-pills">${pill("bb_batt", "0-1", "0~1顆")}${pill("bb_batt", "2", "2顆")}${pill("bb_batt", "3-4", "3~4顆")}</div>
          </div>
          <div class="q-row">
            <span>⚡ OVERLOAD燈</span>
            <div class="q-pills">${pill("bb_over", "on", "亮")}${pill("bb_over", "off", "滅")}</div>
          </div>
          <div class="q-row">
            <span>🍌 TURBO燈</span>
            <div class="q-pills">${pill("bb_turbo", "on", "亮")}${pill("bb_turbo", "off", "滅")}</div>
          </div>
        </div>

        <div class="rule-card-list">
          <h4>第一步：由上往下找「第一個符合」的條件</h4>
          <ol class="btn-rule-list">
            <li>如果按鈕是 <b>藍色</b> 且寫著 <b>「引爆」</b> → <span class="tag-hold">按住不放</span></li>
            <li class="${bCount === "2" || bCount === "3-4" ? "hint-hit" : ""}">如果 <b>電池 ≥ 2 顆</b> 且寫著 <b>「引爆」</b> → <span class="tag-tap">點一下立刻放開</span></li>
            <li class="${overOn === "on" ? "hint-hit" : ""}">如果按鈕是 <b>白色</b> 且 <b>⚡OVERLOAD 亮燈</b> → <span class="tag-hold">按住不放</span></li>
            <li class="${bCount === "3-4" && turboOn === "on" ? "hint-hit" : ""}">如果 <b>電池 ≥ 3 顆</b> 且 <b>🍌TURBO 亮燈</b> → <span class="tag-tap">點一下立刻放開</span></li>
            <li>如果按鈕是 <b>黃色</b> → <span class="tag-hold">按住不放</span></li>
            <li>如果按鈕是 <b>紅色</b> 且寫著 <b>「按住」</b> → <span class="tag-tap">點一下立刻放開</span></li>
            <li>以上都不符合 → <span class="tag-hold">按住不放</span></li>
          </ol>
        </div>

        <div class="strip-guide-box">
          <h4>第二步：若必須「按住不放」，問旁邊亮起的光條顏色！</h4>
          <div class="strip-grid">
            <div class="strip-item s-blue"><strong>🔵 藍光條</strong><span>倒數出現數字 <b>4</b> 時放開！</span></div>
            <div class="strip-item s-white"><strong>⚪ 白光條</strong><span>倒數出現數字 <b>1</b> 時放開！</span></div>
            <div class="strip-item s-yellow"><strong>🟡 黃光條</strong><span>倒數出現數字 <b>5</b> 時放開！</span></div>
            <div class="strip-item s-red"><strong>🔴 紅光條</strong><span>倒數出現數字 <b>2</b> 時放開！</span></div>
          </div>
          <small>💡 例如目標數字 4：無論剩 <code>04:12</code>、<code>01:49</code> 或 <code>00:04</code>，畫面任一位有 4 就能放開！</small>
        </div>
      </div>
    `;
  }

  function renderMazeGridSvg(maze, highlighted) {
    const cells = [];
    for (let y = 1; y <= 6; y++) {
      for (let x = 1; x <= 6; x++) {
        const hasRight = maze.rightWalls.has(`${x},${y}`);
        const hasDown = maze.downWalls.has(`${x},${y}`);
        const isMarker = maze.markers.some((m) => m.x === x && m.y === y);
        const cls = [
          "mcell",
          hasRight ? "w-right" : "",
          hasDown ? "w-down" : "",
          isMarker ? "has-marker" : ""
        ].join(" ");
        cells.push(`<div class="${cls}" title="(${x},${y})">${isMarker ? "⭕" : ""}</div>`);
      }
    }
    const markerTxt = maze.markers.map((m) => `(${m.x},${m.y})`).join(" 與 ");
    return `
      <div class="manual-maze-card ${highlighted ? "matched-maze" : ""}">
        <div class="manual-maze-title">${maze.name} <small>⭕ ${markerTxt}</small></div>
        <div class="manual-maze-grid">${cells.join("")}</div>
      </div>
    `;
  }

  function renderLaserMazeManual(selectedMazeId) {
    const maps = BNN.MAZE_MAPS || [];
    return `
      <div class="mini-manual-wrap">
        <div class="maze-coord-tip">
          📐 <b>先選定位環 ⭕ 找對地圖：</b>左上為 (1,1)、右下為 (6,6)。點擊拆彈手唸出的定位環即可放大這張圖：
          <div class="maze-quick-picks">
            <button type="button" class="q-pill ${!selectedMazeId ? "active" : ""}" data-pick-maze="">顯示全部 6 張</button>
            ${maps
              .map((m) => {
                const label = m.markers.map((k) => `(${k.x},${k.y})`).join(" / ");
                return `<button type="button" class="q-pill ${selectedMazeId === m.id ? "active" : ""}" data-pick-maze="${m.id}">⭕ ${label}</button>`;
              })
              .join("")}
          </div>
        </div>
        <div class="manual-maze-atlas ${selectedMazeId ? "single-focus" : ""}">
          ${maps
            .filter((m) => !selectedMazeId || m.id === selectedMazeId)
            .map((m) => renderMazeGridSvg(m, selectedMazeId === m.id))
            .join("")}
        </div>
      </div>
    `;
  }

  function renderMorseManual(morseFilter) {
    const MORSE = BNN.MORSE_CODE || {};
    const CHANNELS = BNN.MORSE_CHANNELS || [];
    const usedLetters = [...new Set(CHANNELS.map((c) => c.word.split("")).flat())].sort();

    const filteredLetters = usedLetters.filter((l) => {
      if (!morseFilter) return true;
      return MORSE[l].startsWith(morseFilter);
    });

    return `
      <div class="mini-manual-wrap">
        <div class="morse-helper-bar">
          <span>🔍 點按拆彈手唸出的閃燈節奏，篩選字母：</span>
          <div class="morse-filter-btns">
            <button type="button" class="mf-btn" data-morse-add=".">● 短點 (.)</button>
            <button type="button" class="mf-btn" data-morse-add="-">━ 長劃 (-)</button>
            <button type="button" class="mf-btn clr" data-morse-clr="1">清除</button>
            <span class="mf-cur">目前：<code>${escapeHtml(morseFilter || "(全部)")}</code></span>
          </div>
        </div>

        <div class="morse-letters-grid">
          ${filteredLetters
            .map(
              (l) => `
            <div class="morse-letter-pill">
              <strong>${l}</strong>
              <span class="morse-dots">${MORSE[l].replace(/\./g, "●").replace(/-/g, "━")}</span>
            </div>
          `
            )
            .join("")}
        </div>

        <div class="morse-freq-table">
          <h4>📡 單字對應頻率表</h4>
          <div class="freq-grid">
            ${CHANNELS.map(
              (ch) => `
              <div class="freq-card">
                <div class="freq-word">${ch.word}</div>
                <div class="freq-code">${ch.word.split("").map((c) => MORSE[c].replace(/\./g, "●").replace(/-/g, "━")).join(" ")}</div>
                <div class="freq-mhz">${ch.freq} MHz</div>
              </div>
            `
            ).join("")}
          </div>
        </div>
      </div>
    `;
  }

  function renderManualView(container, mission, roomState, onSelectRefCategory) {
    const answers = {};
    const chapters = MANUAL_CHAPTERS.filter((c) => (mission.modules || []).some((m) => m.id === c.id));
    let lastSyncedModIdx = Number(roomState.activeModuleIndex || 0);
    let activeChapterId =
      ((mission.modules || [])[lastSyncedModIdx] && (mission.modules || [])[lastSyncedModIdx].id) ||
      (chapters[0] && chapters[0].id) ||
      "logic_gate";
    let showAllVariants = false;
    let selectedMazeId = null;
    let morseFilter = "";

    function render() {
      const solvedSet = new Set(roomState.solvedModules || []);
      const ch = chapters.find((c) => c.id === activeChapterId) || chapters[0];
      if (!ch) return;

      const curModIdx = (mission.modules || []).findIndex((m) => m.id === ch.id);
      const isDefuserHere = curModIdx === Number(roomState.activeModuleIndex || 0);

      let chapterContentHtml = "";
      if (ch.id === "big_button") {
        chapterContentHtml = renderBigButtonManual(answers);
      } else if (ch.id === "laser_maze") {
        chapterContentHtml = renderLaserMazeManual(selectedMazeId);
      } else if (ch.id === "morse_radio") {
        chapterContentHtml = renderMorseManual(morseFilter);
      } else {
        const matchedVariants = ch.variants.filter((v) => v.match(answers));
        const hasSingleMatch = matchedVariants.length === 1;
        const visibleVariants = hasSingleMatch && !showAllVariants ? matchedVariants : ch.variants;

        chapterContentHtml = `
          <div class="q-filter-box">
            <div class="q-filter-head">① 點選拆彈手的回答，馬上鎖定唯一規則：</div>
            ${ch.questions
              .map(
                (q) => `
              <div class="q-row">
                <span>${escapeHtml(q.label)}</span>
                <div class="q-pills">
                  ${q.options
                    .map(
                      (opt) => `
                    <button type="button" class="q-pill ${answers[q.key] === opt.val ? "active" : ""}" data-qkey="${q.key}" data-qval="${opt.val}">
                      ${escapeHtml(opt.text)}
                    </button>
                  `
                    )
                    .join("")}
                </div>
              </div>
            `
              )
              .join("")}
          </div>

          <div class="variants-section">
            <div class="variants-head">
              <span>② ${hasSingleMatch ? "✅ 已鎖定這關唯一的 Python 規則！" : "請先點選上方條件（或下方 4 種可能先看過一遍）："}</span>
              ${
                hasSingleMatch
                  ? `<button type="button" class="btn-mini" id="btn-toggle-all-variants">${showAllVariants ? "只顯示符合規則" : "查看全部 4 條"}</button>`
                  : ""
              }
            </div>
            <div class="manual-variants ${hasSingleMatch && !showAllVariants ? "single-hit" : ""}">
              ${visibleVariants
                .map((v) => {
                  const matched = v.match(answers);
                  return `
                    <div class="variant-card ${matched ? "matched" : hasSingleMatch ? "dimmed" : ""}">
                      <div class="variant-head">
                        <span class="variant-cond">${escapeHtml(v.condText)}</span>
                        ${matched ? '<span class="variant-match-tag">✅ 就是這條</span>' : ""}
                      </div>
                      <pre class="variant-code"><code>${escapeHtml(v.code)}</code></pre>
                    </div>
                  `;
                })
                .join("")}
            </div>
          </div>

          <div class="manual-scratch-tip">
            <strong>💡 提醒拆彈手：</strong>${escapeHtml(ch.scratchTip)}
          </div>
        `;
      }

      container.innerHTML = `
        <div class="manual-shell">
          <div class="manual-top-head">
            <div>
              <div class="manual-cur-badge">${isDefuserHere ? "📍 拆彈手目前正在解這關" : "👀 預覽其他關卡手冊"}</div>
              <h3>${escapeHtml(ch.title)}</h3>
            </div>
            <div class="manual-tabs-mini">
              ${chapters
                .map(
                  (c, idx) => `
                <button type="button" class="manual-tab-sm ${c.id === ch.id ? "active" : ""} ${solvedSet.has(c.id) ? "solved" : ""}" data-chap="${c.id}">
                  ${solvedSet.has(c.id) ? "✅" : idx + 1} ${escapeHtml(c.title.replace(/^[^\s]+\s/, ""))}
                </button>
              `
                )
                .join("")}
            </div>
          </div>

          <div class="manual-ask-box">
            <strong>🎙️ 開口問：</strong>${escapeHtml(ch.askHint)}
          </div>

          <div class="manual-body">${chapterContentHtml}</div>
        </div>
      `;

      bindEvents();
    }

    function bindEvents() {
      container.querySelectorAll("[data-chap]").forEach((btn) => {
        btn.addEventListener("click", () => {
          activeChapterId = btn.dataset.chap;
          showAllVariants = false;
          const mod = (mission.modules || []).find((m) => m.id === activeChapterId);
          if (mod && onSelectRefCategory) onSelectRefCategory(mod.pyCategory);
          render();
        });
      });

      container.querySelectorAll("[data-qkey]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const k = btn.dataset.qkey;
          const v = btn.dataset.qval;
          answers[k] = answers[k] === v ? undefined : v;
          showAllVariants = false;
          if (BNN.Sound) BNN.Sound.click();
          render();
        });
      });

      const toggleVarBtn = container.querySelector("#btn-toggle-all-variants");
      if (toggleVarBtn) {
        toggleVarBtn.addEventListener("click", () => {
          showAllVariants = !showAllVariants;
          render();
        });
      }

      container.querySelectorAll("[data-pick-maze]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const raw = btn.dataset.pickMaze;
          selectedMazeId = raw ? Number(raw) : null;
          if (BNN.Sound) BNN.Sound.click();
          render();
        });
      });

      container.querySelectorAll("[data-morse-add]").forEach((btn) => {
        btn.addEventListener("click", () => {
          if (morseFilter.length < 5) morseFilter += btn.dataset.morseAdd;
          render();
        });
      });

      const clrBtn = container.querySelector("[data-morse-clr]");
      if (clrBtn) {
        clrBtn.addEventListener("click", () => {
          morseFilter = "";
          render();
        });
      }
    }

    render();

    return {
      updateRoomState(nextRoomState) {
        const nextIdx = Number(nextRoomState.activeModuleIndex || 0);
        const prevSolved = (roomState.solvedModules || []).length;
        const nextSolved = (nextRoomState.solvedModules || []).length;
        const prevTurn = roomState.turnIndex || 0;
        const nextTurn = nextRoomState.turnIndex || 0;
        roomState = nextRoomState;

        let changed = prevSolved !== nextSolved || prevTurn !== nextTurn;
        if (nextIdx !== lastSyncedModIdx) {
          lastSyncedModIdx = nextIdx;
          const targetMod = (mission.modules || [])[nextIdx];
          if (targetMod) {
            activeChapterId = targetMod.id;
            showAllVariants = false;
            if (onSelectRefCategory) onSelectRefCategory(targetMod.pyCategory);
            changed = true;
          }
        }
        if (changed) {
          render();
        }
      }
    };
  }

  BNN.MANUAL_CHAPTERS = MANUAL_CHAPTERS;
  BNN.renderManualView = renderManualView;
})(window);
