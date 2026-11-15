/**
 * manual_ui.js — 國二生專用「Python 程式規格書 ＋ 特務小遊戲拆彈手冊」
 * 國二生看不到炸彈畫面，透過發問與筆記板取得外殼特徵，指導國一完成 Scratch 程式與動作小遊戲！
 */
(function (global) {
  const BNN = (global.BNN = global.BNN || {});

  const MANUAL_CHAPTERS = [
    {
      id: "logic_gate",
      kind: "scratch",
      title: "模組 1｜⚡ 雙重防爆邏輯閘",
      askHint: "先問國一偵察員：① 香蕉電池有幾顆？ ② ⚡OVERLOAD 燈有亮嗎？",
      scratchTip: "Scratch 沒有 elif，請提醒國一用兩層「如果...那麼...否則」包起來；感測值請拉藍色 (power) 與 (mode)。",
      variants: [
        {
          condText: "電池數 ≥ 2 且 ⚡OVERLOAD 亮燈",
          match: (n) => n.batteries !== null && n.overload !== null && n.batteries >= 2 && n.overload === true,
          code: `# 規則 A\nif power >= 60 and mode == "X":\n    output("SAFE")\nelif power < 30 or mode == "Y":\n    output("DRAIN")\nelse:\n    output("BLOCK")`
        },
        {
          condText: "電池數 ≥ 2 且 ⚡OVERLOAD 熄滅",
          match: (n) => n.batteries !== null && n.overload !== null && n.batteries >= 2 && n.overload === false,
          code: `# 規則 B\nif power > 50 or mode == "Y":\n    output("DRAIN")\nelif power <= 20 and mode == "X":\n    output("BLOCK")\nelse:\n    output("SAFE")`
        },
        {
          condText: "電池數 < 2 且 ⚡OVERLOAD 亮燈",
          match: (n) => n.batteries !== null && n.overload !== null && n.batteries < 2 && n.overload === true,
          code: `# 規則 C\nif mode == "Y" and power >= 40:\n    output("BLOCK")\nelif power < 40 or mode == "X":\n    output("SAFE")\nelse:\n    output("DRAIN")`
        },
        {
          condText: "電池數 < 2 且 ⚡OVERLOAD 熄滅",
          match: (n) => n.batteries !== null && n.overload !== null && n.batteries < 2 && n.overload === false,
          code: `# 規則 D\nif power >= 70 or (mode == "X" and power >= 30):\n    output("SAFE")\nelif mode == "Y" and power < 50:\n    output("BLOCK")\nelse:\n    output("DRAIN")`
        }
      ]
    },
    {
      id: "loop_coolant",
      kind: "scratch",
      title: "模組 2｜🍌 連環香蕉計數器",
      askHint: "先問國一偵察員：① 型號標籤是什麼 (ALPHA / BETA / OMEGA)？ ② 序號最後一位數字是奇數還是偶數？",
      scratchTip: "提醒國一：一開始一定要「設變數 energy 為 (感測值 start)」，在重複迴圈內先算新能量，再「發射冷卻脈衝 (energy)」！",
      variants: [
        {
          condText: '標籤為 "ALPHA" 且 序號末碼為奇數',
          match: (n) => n.label === "ALPHA" && n.serialOdd === true,
          code: `energy = start\nfor i in range(4):\n    energy = energy + 5\n    pulse(energy)`
        },
        {
          condText: '標籤為 "ALPHA" 且 序號末碼為偶數',
          match: (n) => n.label === "ALPHA" && n.serialOdd === false,
          code: `energy = start\nfor i in range(3):\n    energy = energy * 2\n    pulse(energy)`
        },
        {
          condText: '標籤為 "BETA"（不限序號奇偶）',
          match: (n) => n.label === "BETA",
          code: `energy = start\nfor i in range(5):\n    energy = energy + 3\n    pulse(energy)`
        },
        {
          condText: '標籤為 "OMEGA"（不限序號奇偶）',
          match: (n) => n.label === "OMEGA",
          code: `energy = start\nfor i in range(4):\n    energy = energy * 2 + 1\n    pulse(energy)`
        }
      ]
    },
    {
      id: "wire_array",
      kind: "scratch",
      title: "模組 3｜🔌 彩線矩陣密碼鎖",
      askHint: "先問國一偵察員：① 序號前兩個英文字母有包含母音 (A, E, I, O, U) 嗎？ ② 香蕉電池數量是偶數還是奇數？",
      scratchTip: "🚨 超重要！Python 的 wires[0] 是 Scratch 的「第 (1) 項」、wires[-1] 是「第 (清單長度) 項」！但 cut_wire(pos) 直接寫第幾條線即可！",
      variants: [
        {
          condText: "序號含母音 且 電池數為偶數 (0, 2, 4)",
          match: (n) => n.hasVowel === true && n.batteries !== null && n.batteries % 2 === 0,
          code: `if wires[0] == "紅" and wires[-1] == "藍":\n    cut_wire(2)\nelif wires[1] == "黃" or wires[2] == "綠":\n    cut_wire(4)\nelse:\n    cut_wire(len(wires))`
        },
        {
          condText: "序號含母音 且 電池數為奇數 (1, 3)",
          match: (n) => n.hasVowel === true && n.batteries !== null && n.batteries % 2 === 1,
          code: `if wires[1] == "藍" and "白" in wires:\n    cut_wire(1)\nelif wires[0] == "綠" or wires[-1] == "紅":\n    cut_wire(3)\nelse:\n    cut_wire(2)`
        },
        {
          condText: "序號無母音 且 電池數為偶數 (0, 2, 4)",
          match: (n) => n.hasVowel === false && n.batteries !== null && n.batteries % 2 === 0,
          code: `if wires[2] == "紅":\n    cut_wire(len(wires) - 1)\nelif wires[0] == "黃" and wires[1] == "藍":\n    cut_wire(1)\nelse:\n    cut_wire(4)`
        },
        {
          condText: "序號無母音 且 電池數為奇數 (1, 3)",
          match: (n) => n.hasVowel === false && n.batteries !== null && n.batteries % 2 === 1,
          code: `if wires[-1] == "黃" or wires[0] == "白":\n    cut_wire(3)\nelif wires[1] == "紅" and wires[2] == "綠":\n    cut_wire(2)\nelse:\n    cut_wire(len(wires))`
        }
      ]
    },
    {
      id: "while_cooling",
      kind: "scratch",
      title: "模組 4｜❄️ 反應爐降溫閥",
      askHint: "先問國一偵察員：① 🛡️SHIELD 燈有亮嗎？ ② 序號末碼是奇數還是偶數？",
      scratchTip: "🚨 Python `while temp > 30:` 在 Scratch「重複直到」要寫相反條件 `< temp ≤ 30 >`！一開始先設 temp = start_temp，跳出迴圈再呼叫 lock_core()！",
      variants: [
        {
          condText: "🛡️SHIELD 亮燈 且 序號末碼為奇數",
          match: (n) => n.shield === true && n.serialOdd === true,
          code: `temp = start_temp\nwhile temp > 30:\n    temp = temp - 12\n    vent()\nlock_core()`
        },
        {
          condText: "🛡️SHIELD 亮燈 且 序號末碼為偶數",
          match: (n) => n.shield === true && n.serialOdd === false,
          code: `temp = start_temp\nwhile temp >= 25:\n    if temp > 60:\n        temp = temp - 20\n    else:\n        temp = temp - 10\n    vent()\nlock_core()`
        },
        {
          condText: "🛡️SHIELD 熄滅 且 序號末碼為奇數",
          match: (n) => n.shield === false && n.serialOdd === true,
          code: `temp = start_temp\nwhile temp > 20:\n    temp = temp - 15\n    vent()\nlock_core()`
        },
        {
          condText: "🛡️SHIELD 熄滅 且 序號末碼為偶數",
          match: (n) => n.shield === false && n.serialOdd === false,
          code: `temp = start_temp\nwhile temp >= 35:\n    if temp % 2 == 0:\n        temp = temp - 14\n    else:\n        temp = temp - 9\n    vent()\nlock_core()`
        }
      ]
    },
    {
      id: "led_binary",
      kind: "scratch",
      title: "模組 5｜💡 香蕉二進位譯碼器",
      askHint: "先問國一偵察員：① 🍌TURBO 燈有亮嗎？ ② 序號四個數字「相加總和」是偶數還是奇數？",
      scratchTip: "leds 清單共 4 項（亮=1、滅=0）。若用迴圈計數記得設變數 i 從 1 開始；餘數 % 用綠色「除以...的餘數」。",
      variants: [
        {
          condText: "🍌TURBO 亮燈 且 序號數字總和為偶數",
          match: (n) => n.turbo === true && n.serialSumEven === true,
          code: `code = leds[0]*8 + leds[1]*4 + leds[2]*2 + leds[3]*1\nsubmit_code(code)`
        },
        {
          condText: "🍌TURBO 亮燈 且 序號數字總和為奇數",
          match: (n) => n.turbo === true && n.serialSumEven === false,
          code: `total = 0\nfor i in range(4):\n    total = total + leds[i] * (i + 1)\nsubmit_code((total * 3) % 10)`
        },
        {
          condText: "🍌TURBO 熄滅 且 序號數字總和為偶數",
          match: (n) => n.turbo === false && n.serialSumEven === true,
          code: `count = 0\nfor i in range(4):\n    if leds[i] == 1:\n        count = count + 1\nsubmit_code(count * 10 + (leds[0] + leds[3]))`
        },
        {
          condText: "🍌TURBO 熄滅 且 序號數字總和為奇數",
          match: (n) => n.turbo === false && n.serialSumEven === false,
          code: `code = leds[3]*8 + leds[2]*4 + leds[1]*2 + leds[0]*1\nsubmit_code(code % 12)`
        }
      ]
    },
    {
      id: "func_cipher",
      kind: "scratch",
      title: "模組 6｜🐒 猴子解密函式機",
      askHint: "先問國一偵察員：① 序號含母音嗎？ ② 標籤是 OMEGA 或電池數 ≥ 3 嗎？",
      scratchTip: "Python 的 `//` 是整數除法，Scratch 要用綠色「無條件捨去 ((x) / (2))」！最後用「回傳密碼 ( )」輸出。",
      variants: [
        {
          condText: "序號含母音 且 (標籤為 OMEGA 或 電池 ≥ 3)",
          match: (n) => n.hasVowel === true && (n.label === "OMEGA" || (n.batteries !== null && n.batteries >= 3)),
          code: `def decrypt(x):\n    if x % 2 == 0:\n        return x // 2 + 5\n    else:\n        return x * 3 + 1`
        },
        {
          condText: "序號含母音 且 (非 OMEGA 且 電池 < 3)",
          match: (n) => n.hasVowel === true && n.label && n.label !== "OMEGA" && n.batteries !== null && n.batteries < 3,
          code: `def decrypt(x):\n    if x >= 10:\n        return (x - 4) * 2\n    else:\n        return x + 15`
        },
        {
          condText: "序號無母音 且 (標籤為 OMEGA 或 電池 ≥ 3)",
          match: (n) => n.hasVowel === false && (n.label === "OMEGA" || (n.batteries !== null && n.batteries >= 3)),
          code: `def decrypt(x):\n    if x % 3 == 0:\n        return x // 3 + 10\n    elif x % 2 == 0:\n        return x + 7\n    else:\n        return x * 2`
        },
        {
          condText: "序號無母音 且 (非 OMEGA 且 電池 < 3)",
          match: (n) => n.hasVowel === false && n.label && n.label !== "OMEGA" && n.batteries !== null && n.batteries < 3,
          code: `def decrypt(x):\n    ans = (x * 2 + 3) % 10\n    if ans < 5:\n        return ans + 10\n    return ans`
        }
      ]
    },
    {
      id: "big_button",
      kind: "minigame",
      title: "小遊戲｜🔴 終極香蕉大按鈕",
      askHint: "先問國一：① 按鈕是什麼顏色？ ② 上面寫什麼字？ ③ 電池有幾顆、TURBO/OVERLOAD 亮燈嗎？"
    },
    {
      id: "laser_maze",
      kind: "minigame",
      title: "小遊戲｜🧭 隱藏雷射迷宮",
      askHint: "先問國一：兩個「青色定位環 ⭕」在哪兩個座標 (欄,列)？ 猴子 🐒 和旗幟 🚩 在哪裡？"
    },
    {
      id: "morse_radio",
      kind: "minigame",
      title: "小遊戲｜📻 摩斯香蕉電台",
      askHint: "請國一盯住閃爍燈號，一長一短唸出每個字母的「點 ●」與「劃 ━」，查出單字後告訴他幾 MHz！"
    }
  ];

  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function renderBigButtonManual(notes) {
    return `
      <div class="mini-manual-wrap">
        <div class="rule-card-list">
          <h4>第一步：由上往下找「第一個符合」的條件</h4>
          <ol class="btn-rule-list">
            <li>如果按鈕是 <b>藍色</b> 且寫著 <b>「引爆」</b> → <span class="tag-hold">按住不放</span></li>
            <li class="${notes.batteries !== null && notes.batteries > 1 ? "hint-hit" : ""}">如果 <b>電池數 &gt; 1 (2顆以上)</b> 且寫著 <b>「引爆」</b> → <span class="tag-tap">點一下立刻放開</span></li>
            <li class="${notes.overload === true ? "hint-hit" : ""}">如果按鈕是 <b>白色</b> 且 <b>⚡OVERLOAD 亮燈</b> → <span class="tag-hold">按住不放</span></li>
            <li class="${notes.batteries !== null && notes.batteries > 2 && notes.turbo === true ? "hint-hit" : ""}">如果 <b>電池數 &gt; 2 (3顆以上)</b> 且 <b>🍌TURBO 亮燈</b> → <span class="tag-tap">點一下立刻放開</span></li>
            <li>如果按鈕是 <b>黃色</b> → <span class="tag-hold">按住不放</span></li>
            <li>如果按鈕是 <b>紅色</b> 且寫著 <b>「按住」</b> → <span class="tag-tap">點一下立刻放開</span></li>
            <li>以上都不符合 → <span class="tag-hold">按住不放</span></li>
          </ol>
        </div>

        <div class="strip-guide-box">
          <h4>第二步：如果必須「按住不放」，請叫國一看旁邊亮起的光條顏色！</h4>
          <div class="strip-grid">
            <div class="strip-item s-blue"><strong>🔵 藍色光條</strong><span>計時器出現數字 <b>4</b> 時放開！</span></div>
            <div class="strip-item s-white"><strong>⚪ 白色光條</strong><span>計時器出現數字 <b>1</b> 時放開！</span></div>
            <div class="strip-item s-yellow"><strong>🟡 黃色光條</strong><span>計時器出現數字 <b>5</b> 時放開！</span></div>
            <div class="strip-item s-red"><strong>🔴 其他(紅)光條</strong><span>計時器出現數字 <b>2</b> 時放開！</span></div>
          </div>
          <small>💡 例如目標數字 4：無論倒數剩 <code>04:12</code>、<code>01:49</code> 或 <code>00:04</code>，只要畫面任一位數字有 4 就能放開！</small>
        </div>
      </div>
    `;
  }

  function renderMazeGridSvg(maze) {
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
      <div class="manual-maze-card">
        <div class="manual-maze-title">${maze.name} <small>定位環 ${markerTxt}</small></div>
        <div class="manual-maze-grid">${cells.join("")}</div>
      </div>
    `;
  }

  function renderLaserMazeManual() {
    const maps = BNN.MAZE_MAPS || [];
    return `
      <div class="mini-manual-wrap">
        <div class="maze-coord-tip">
          📐 <b>座標讀法：</b>(橫軸 X 1~6, 縱軸 Y 1~6)。左上角是 <code>(1,1)</code>，右下角是 <code>(6,6)</code>。先用兩個青色圓圈 ⭕ 找出對應地圖，再叫國一避開白色牆壁！
        </div>
        <div class="manual-maze-atlas">
          ${maps.map((m) => renderMazeGridSvg(m)).join("")}
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
          <span>🔍 點按國一唸出的節奏快速篩選字母：</span>
          <div class="morse-filter-btns">
            <button type="button" class="mf-btn" data-morse-add=".">● 短點 (.)</button>
            <button type="button" class="mf-btn" data-morse-add="-">━ 長劃 (-)</button>
            <button type="button" class="mf-btn clr" data-morse-clr="1">清除</button>
            <span class="mf-cur">目前查詢：<code>${escapeHtml(morseFilter || "(全部)")}</code></span>
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
          <h4>📡 實驗室目標單字與對應頻率</h4>
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
    const notes = {
      batteries: null,
      hasVowel: null,
      serialOdd: null,
      serialSumEven: null,
      label: null,
      turbo: null,
      overload: null,
      shield: null
    };

    const allowedIds = new Set((mission.modules || []).map((m) => m.id));
    const chapters = MANUAL_CHAPTERS.filter((c) => allowedIds.has(c.id));
    let activeChapterId = chapters[0] ? chapters[0].id : "logic_gate";
    let morseFilter = "";

    function render() {
      const solvedSet = new Set(roomState.solvedModules || []);
      const ch = chapters.find((c) => c.id === activeChapterId) || chapters[0];

      let chapterContentHtml = "";
      if (ch.id === "big_button") {
        chapterContentHtml = renderBigButtonManual(notes);
      } else if (ch.id === "laser_maze") {
        chapterContentHtml = renderLaserMazeManual();
      } else if (ch.id === "morse_radio") {
        chapterContentHtml = renderMorseManual(morseFilter);
      } else {
        chapterContentHtml = `
          <div class="manual-scratch-tip">
            <strong>🧩 國一翻譯小撇步：</strong>${escapeHtml(ch.scratchTip)}
          </div>
          <div class="manual-variants">
            ${ch.variants
              .map((v, i) => {
                const matched = v.match(notes);
                return `
                  <div class="variant-card ${matched ? "matched" : ""}">
                    <div class="variant-head">
                      <span class="variant-idx">情境 ${i + 1}</span>
                      <span class="variant-cond">${escapeHtml(v.condText)}</span>
                      ${matched ? '<span class="variant-match-tag">✅ 符合你的筆記</span>' : ""}
                    </div>
                    <pre class="variant-code"><code>${escapeHtml(v.code)}</code></pre>
                  </div>
                `;
              })
              .join("")}
          </div>
        `;
      }

      container.innerHTML = `
        <div class="manual-shell">
          <div class="manual-notepad">
            <div class="notepad-head">
              <span>📝 特務指揮官筆記板（問國一外殼資料後點選）</span>
              <small>紀錄後會自動幫你高亮對應的規則分支！</small>
            </div>
            <div class="notepad-grid">
              <div class="note-item">
                <label>🔋 香蕉電池數</label>
                <div class="note-pills">
                  ${[0, 1, 2, 3, 4]
                    .map((v) => `<button type="button" class="note-btn ${notes.batteries === v ? "active" : ""}" data-note="batteries" data-val="${v}">${v}</button>`)
                    .join("")}
                </div>
              </div>
              <div class="note-item">
                <label>🏷️ 型號標籤</label>
                <div class="note-pills">
                  ${["ALPHA", "BETA", "OMEGA"]
                    .map((v) => `<button type="button" class="note-btn ${notes.label === v ? "active" : ""}" data-note="label" data-val="${v}">${v}</button>`)
                    .join("")}
                </div>
              </div>
              <div class="note-item">
                <label>🔤 序號含母音</label>
                <div class="note-pills">
                  <button type="button" class="note-btn ${notes.hasVowel === true ? "active" : ""}" data-note="hasVowel" data-val="true">有</button>
                  <button type="button" class="note-btn ${notes.hasVowel === false ? "active" : ""}" data-note="hasVowel" data-val="false">無</button>
                </div>
              </div>
              <div class="note-item">
                <label>🔢 序號末碼</label>
                <div class="note-pills">
                  <button type="button" class="note-btn ${notes.serialOdd === true ? "active" : ""}" data-note="serialOdd" data-val="true">奇數</button>
                  <button type="button" class="note-btn ${notes.serialOdd === false ? "active" : ""}" data-note="serialOdd" data-val="false">偶數</button>
                </div>
              </div>
              <div class="note-item">
                <label>➕ 序號4數字和</label>
                <div class="note-pills">
                  <button type="button" class="note-btn ${notes.serialSumEven === true ? "active" : ""}" data-note="serialSumEven" data-val="true">偶數</button>
                  <button type="button" class="note-btn ${notes.serialSumEven === false ? "active" : ""}" data-note="serialSumEven" data-val="false">奇數</button>
                </div>
              </div>
              <div class="note-item">
                <label>💡 指示燈狀態</label>
                <div class="note-pills">
                  <button type="button" class="note-btn ${notes.turbo === true ? "active" : notes.turbo === false ? "off" : ""}" data-tri="turbo">TURBO:${notes.turbo === null ? "?" : notes.turbo ? "亮" : "滅"}</button>
                  <button type="button" class="note-btn ${notes.overload === true ? "active" : notes.overload === false ? "off" : ""}" data-tri="overload">OVER:${notes.overload === null ? "?" : notes.overload ? "亮" : "滅"}</button>
                  <button type="button" class="note-btn ${notes.shield === true ? "active" : notes.shield === false ? "off" : ""}" data-tri="shield">SHIELD:${notes.shield === null ? "?" : notes.shield ? "亮" : "滅"}</button>
                </div>
              </div>
            </div>
          </div>

          <div class="manual-tabs">
            ${chapters
              .map(
                (c) => `
              <button type="button" class="manual-tab ${c.id === ch.id ? "active" : ""} ${solvedSet.has(c.id) ? "solved" : ""} ${c.kind === "minigame" ? "kind-mini" : ""}" data-chap="${c.id}">
                ${solvedSet.has(c.id) ? "✅ " : ""}${escapeHtml(c.title)}
              </button>
            `
              )
              .join("")}
          </div>

          <div class="manual-body">
            <div class="manual-ask-box">
              <strong>🎙️ 溝通指引：</strong>${escapeHtml(ch.askHint)}
            </div>
            ${chapterContentHtml}
          </div>
        </div>
      `;

      bindEvents();
    }

    function bindEvents() {
      container.querySelectorAll("[data-chap]").forEach((btn) => {
        btn.addEventListener("click", () => {
          activeChapterId = btn.dataset.chap;
          const mod = (mission.modules || []).find((m) => m.id === activeChapterId);
          if (mod && onSelectRefCategory) onSelectRefCategory(mod.pyCategory);
          render();
        });
      });

      container.querySelectorAll("[data-note]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const key = btn.dataset.note;
          let val = btn.dataset.val;
          if (key === "batteries") val = Number(val);
          else if (val === "true") val = true;
          else if (val === "false") val = false;
          notes[key] = notes[key] === val ? null : val;
          render();
        });
      });

      container.querySelectorAll("[data-tri]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const key = btn.dataset.tri;
          if (notes[key] === null) notes[key] = true;
          else if (notes[key] === true) notes[key] = false;
          else notes[key] = null;
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
        roomState = nextRoomState;
        render();
      }
    };
  }

  BNN.MANUAL_CHAPTERS = MANUAL_CHAPTERS;
  BNN.renderManualView = renderManualView;
})(window);
