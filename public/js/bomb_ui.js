/**
 * bomb_ui.js — 簡潔街機風格香蕉炸彈外殼 + 6 程式模組儀表 + 3 大動作小遊戲
 */
(function (global) {
  const BNN = (global.BNN = global.BNN || {});

  const WIRE_COLOR_MAP = {
    紅: "#ef4444",
    藍: "#3b82f6",
    黃: "#facc15",
    綠: "#22c55e",
    白: "#f8fafc"
  };

  const BTN_COLOR_CLASS = {
    紅: "btn-c-red",
    藍: "btn-c-blue",
    黃: "btn-c-yellow",
    白: "btn-c-white"
  };

  const STRIP_COLOR_CLASS = {
    藍: "strip-blue",
    白: "strip-white",
    黃: "strip-yellow",
    紅: "strip-red"
  };

  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function renderEdgeworkStrip(edgework) {
    const indList = [
      { key: "TURBO", icon: "🍌", name: "TURBO", on: edgework.indicators.TURBO },
      { key: "OVERLOAD", icon: "⚡", name: "OVERLOAD", on: edgework.indicators.OVERLOAD },
      { key: "SHIELD", icon: "🛡️", name: "SHIELD", on: edgework.indicators.SHIELD }
    ];

    return `
      <div class="edge-strip">
        <div class="edge-strip-title">🏷️ 炸彈外殼特徵（指揮官看不到，問什麼報什麼！）</div>
        <div class="edge-strip-grid">
          <div class="edge-tile">
            <span class="edge-tile-lbl">序號</span>
            <strong class="mono">${escapeHtml(edgework.serial)}</strong>
            <small>${edgework.hasVowel ? "含母音" : "無母音"} · 末碼${edgework.serialIsOdd ? "奇數" : "偶數"}</small>
          </div>
          <div class="edge-tile">
            <span class="edge-tile-lbl">電池</span>
            <strong>🔋 ${edgework.batteries} 顆</strong>
            <small>${edgework.batteries % 2 === 0 ? "偶數顆" : "奇數顆"}</small>
          </div>
          <div class="edge-tile">
            <span class="edge-tile-lbl">型號</span>
            <strong class="tag-badge">${escapeHtml(edgework.label)}</strong>
            <small>外殼標籤</small>
          </div>
          <div class="edge-tile edge-tile-leds">
            <span class="edge-tile-lbl">指示燈</span>
            <div class="edge-inds">
              ${indList
                .map(
                  (ind) => `<span class="led-pill ${ind.on ? "on" : "off"}">${ind.icon} ${ind.name}:${ind.on ? "亮" : "滅"}</span>`
                )
                .join("")}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function renderScratchVisualizer(mod, isSolved) {
    if (mod.id === "logic_gate") {
      return `
        <div class="vis-desc">程式送出時會同時測試以下 <b>3 組脈衝數值</b>：</div>
        <div class="vis-grid-3">
          ${mod.testCases
            .map(
              (tc) => `
            <div class="pulse-card">
              <div class="pulse-title">${escapeHtml(tc.name)}</div>
              <div class="pulse-metric">power = <b>${tc.power}</b></div>
              <div class="pulse-metric">mode = <b>"${escapeHtml(tc.mode)}"</b></div>
            </div>
          `
            )
            .join("")}
        </div>
      `;
    }
    if (mod.id === "loop_coolant") {
      return `
        <div class="vis-desc">透過「重複次數迴圈」依序發射冷卻脈衝：</div>
        <div class="coolant-box">
          <div class="coolant-stat">
            <span>起始感測值 <code>start</code></span>
            <strong>${mod.startVal}</strong>
          </div>
          <div class="coolant-steps">
            ${mod.expectedSeq
              .map((_, i) => `<div class="coolant-slot ${isSolved ? "done" : ""}">${isSolved ? mod.expectedSeq[i] : `脈衝 #${i + 1}`}</div>`)
              .join("")}
          </div>
        </div>
      `;
    }
    if (mod.id === "wire_array") {
      return `
        <div class="vis-desc">程式需同時通過這 <b>3 組彩線</b>（每組共 ${mod.wireCount} 條，左起為第 1～${mod.wireCount} 條）：</div>
        <div class="wires-cases">
          ${mod.testCases
            .map(
              (tc) => `
            <div class="wire-case-card">
              <div class="wire-case-name">${escapeHtml(tc.name)}</div>
              <div class="wire-rack">
                ${tc.wires
                  .map(
                    (c, idx) => `
                  <div class="wire-strand">
                    <span class="wire-idx">${idx + 1}</span>
                    <span class="wire-line" style="background:${WIRE_COLOR_MAP[c] || "#94a3b8"}"></span>
                    <span class="wire-cname">${escapeHtml(c)}</span>
                  </div>
                `
                  )
                  .join("")}
              </div>
            </div>
          `
            )
            .join("")}
        </div>
      `;
    }
    if (mod.id === "while_cooling") {
      return `
        <div class="vis-desc">反應爐在兩個初始溫度下都要安全降溫並鎖定（用 <code>重複直到</code>）：</div>
        <div class="vis-grid-2">
          ${mod.testCases
            .map(
              (tc) => `
            <div class="temp-card">
              <div class="temp-title">${escapeHtml(tc.name)}</div>
              <div class="temp-gauge"><div class="temp-bar" style="width:${Math.min(100, Math.round((tc.startTemp / 130) * 100))}%"></div></div>
              <div class="temp-val">起始爐溫 <code>start_temp</code> = <b>${tc.startTemp}°C</b></div>
            </div>
          `
            )
            .join("")}
        </div>
      `;
    }
    if (mod.id === "led_binary") {
      return `
        <div class="vis-desc">讀取 4 顆香蕉燈清單 <code>leds</code>（亮=1、滅=0），需通過 2 組測試：</div>
        <div class="vis-grid-2">
          ${mod.testCases
            .map(
              (tc) => `
            <div class="led-case-card">
              <div class="led-case-name">${escapeHtml(tc.name)}</div>
              <div class="led-row">
                ${tc.leds
                  .map(
                    (bit, i) => `
                  <div class="led-unit">
                    <div class="led-bulb ${bit === 1 ? "lit" : "dark"}">${bit}</div>
                    <small>第${i + 1}項</small>
                  </div>
                `
                  )
                  .join("")}
              </div>
            </div>
          `
            )
            .join("")}
        </div>
      `;
    }
    if (mod.id === "func_cipher") {
      return `
        <div class="vis-desc">對以下 3 個輸入數字 <code>x</code>，算出並回傳正確密碼：</div>
        <div class="vis-grid-3">
          ${mod.testCases
            .map(
              (tc) => `
            <div class="cipher-card">
              <div class="cipher-title">${escapeHtml(tc.name)}</div>
              <div class="cipher-in">x = <strong>${tc.x}</strong></div>
            </div>
          `
            )
            .join("")}
        </div>
      `;
    }
    return "";
  }

  function renderMiniGameVisualizer(mod, isSolved, miniState) {
    if (mod.id === "big_button") {
      const btnCls = BTN_COLOR_CLASS[mod.color] || "btn-c-red";
      const stripCls = miniState.stripLit ? STRIP_COLOR_CLASS[mod.stripColor] || "strip-red" : "";
      return `
        <div class="vis-desc">報出按鈕的「<b>顏色</b>」與「<b>文字</b>」給指揮官，照指令快點一下或長按等光條放開！</div>
        <div class="big-btn-stage">
          <div class="big-btn-pedestal">
            <button type="button" id="act-big-btn" class="arcade-big-btn ${btnCls} ${miniState.holding ? "pressed" : ""}" ${isSolved ? "disabled" : ""}>
              <span class="big-btn-color-tag">${escapeHtml(mod.color)}色</span>
              <span class="big-btn-label">${escapeHtml(mod.label)}</span>
            </button>
            <div class="big-btn-hint">${isSolved ? "✅ 已成功解除！" : miniState.holding ? "⚡ 按住中！快報光條顏色給指揮官，等目標數字出現放開！" : "👆 點一下放開 或 長按不放"}</div>
          </div>
          <div class="charge-strip-wrap">
            <div class="charge-strip-lbl">光條指示器</div>
            <div class="charge-strip ${stripCls}" id="big-btn-strip">
              ${miniState.stripLit ? `${escapeHtml(mod.stripColor)}光` : "未亮"}
            </div>
          </div>
        </div>
      `;
    }

    if (mod.id === "laser_maze") {
      const pos = miniState.mazePos || mod.start;
      const trail = miniState.mazeTrail || new Set([`${pos.x},${pos.y}`]);
      const cells = [];
      cells.push(`<div class="mplay-corner">X\\Y</div>`);
      for (let x = 1; x <= 6; x++) cells.push(`<div class="mplay-axis">${x}</div>`);
      for (let y = 1; y <= 6; y++) {
        cells.push(`<div class="mplay-axis">${y}</div>`);
        for (let x = 1; x <= 6; x++) {
          const isMarker = mod.maze.markers.some((m) => m.x === x && m.y === y);
          const isPlayer = pos.x === x && pos.y === y;
          const isGoal = mod.goal.x === x && mod.goal.y === y;
          const isTrail = trail.has(`${x},${y}`);
          const cls = [
            "mplay-cell",
            isMarker ? "marker" : "",
            isPlayer ? "player" : "",
            isGoal ? "goal" : "",
            isTrail ? "trail" : ""
          ].join(" ");
          let icon = "";
          if (isPlayer) icon = "🐒";
          else if (isGoal) icon = "🚩";
          else if (isMarker) icon = "⭕";
          cells.push(`<div class="${cls}" title="(${x},${y})">${icon}</div>`);
        }
      }

      return `
        <div class="vis-desc">把兩個青色圈圈 ⭕ 座標報給指揮官！依指揮走去旗幟 🚩（可用方向鍵 / WASD）</div>
        <div class="maze-stage">
          <div class="maze-play-grid ${miniState.mazeShock ? "shock" : ""}">
            ${cells.join("")}
          </div>
          <div class="maze-dpad-col">
            <div class="maze-coords-box">
              <div>🐒 猴子：<b>(${pos.x}, ${pos.y})</b></div>
              <div>🚩 終點：<b>(${mod.goal.x}, ${mod.goal.y})</b></div>
              <div>⭕ 定位環：<b>${mod.maze.markers.map((m) => `(${m.x},${m.y})`).join("、")}</b></div>
            </div>
            <div class="dpad">
              <div></div>
              <button type="button" class="dpad-btn" data-maze-dir="0,-1" ${isSolved ? "disabled" : ""}>⬆</button>
              <div></div>
              <button type="button" class="dpad-btn" data-maze-dir="-1,0" ${isSolved ? "disabled" : ""}>⬅</button>
              <div class="dpad-center">🐒</div>
              <button type="button" class="dpad-btn" data-maze-dir="1,0" ${isSolved ? "disabled" : ""}>➡</button>
              <div></div>
              <button type="button" class="dpad-btn" data-maze-dir="0,1" ${isSolved ? "disabled" : ""}>⬇</button>
              <div></div>
            </div>
          </div>
        </div>
      `;
    }

    if (mod.id === "morse_radio") {
      const freqs = mod.allFreqs;
      const curIdx = miniState.freqIdx ?? 0;
      const curFreq = freqs[curIdx] || freqs[0];
      return `
        <div class="vis-desc">把信號燈的「短閃 ●」與「長亮 ━」唸給指揮官查單字，調到正確 MHz 發射！</div>
        <div class="morse-stage">
          <div class="morse-lamp-box">
            <div class="morse-bulb" id="morse-bulb"></div>
            <div class="morse-readout" id="morse-readout">準備接收摩斯電報...</div>
            <div class="morse-history" id="morse-history"></div>
          </div>

          <div class="radio-tuner-box">
            <div class="tuner-screen">
              <span class="tuner-lbl">CARRIER FREQUENCY</span>
              <strong class="tuner-mhz" id="tuner-mhz">${curFreq} MHz</strong>
            </div>
            <div class="tuner-controls">
              <button type="button" class="tuner-step" id="btn-freq-prev" ${isSolved || curIdx <= 0 ? "disabled" : ""}>◀ 降頻</button>
              <input type="range" id="rng-freq" min="0" max="${freqs.length - 1}" value="${curIdx}" ${isSolved ? "disabled" : ""} />
              <button type="button" class="tuner-step" id="btn-freq-next" ${isSolved || curIdx >= freqs.length - 1 ? "disabled" : ""}>升頻 ▶</button>
            </div>
            <button type="button" class="btn-tx-morse" id="btn-tx-morse" ${isSolved ? "disabled" : ""}>
              ${isSolved ? "✅ 已成功發射！" : `📡 發射 ${curFreq} MHz 拆彈訊號`}
            </button>
          </div>
        </div>
      `;
    }

    return "";
  }

  function renderBombPanel(container, mission, roomState, options = {}) {
    let activeIdx = Number(roomState.activeModuleIndex || 0);
    let morseTimer = null;
    let holdTimer = null;

    const miniState = {
      holding: false,
      holdStartAt: 0,
      stripLit: false,
      mazePos: null,
      mazeTrail: new Set(),
      mazeShock: false,
      freqIdx: 2
    };

    function stopTimers() {
      if (morseTimer) {
        clearTimeout(morseTimer);
        morseTimer = null;
      }
      if (holdTimer) {
        clearTimeout(holdTimer);
        holdTimer = null;
      }
    }

    function startMorseLoop(mod) {
      if (!mod || mod.id !== "morse_radio") return;
      const letters = mod.patternPerLetter || [];
      let lIdx = 0;
      let sIdx = 0;
      let currentWordTrail = [];

      function setLamp(on, sym = "", note = "") {
        const bulb = container.querySelector("#morse-bulb");
        const readout = container.querySelector("#morse-readout");
        const hist = container.querySelector("#morse-history");
        if (!bulb || !readout || !hist) return false;
        bulb.classList.toggle("on", on);
        bulb.classList.toggle("dash", on && sym === "-");
        readout.textContent = note;
        hist.textContent = currentWordTrail.join("  ");
        return true;
      }

      function step() {
        if (lIdx >= letters.length) {
          currentWordTrail = [];
          if (!setLamp(false, "", "🔁 單字播放完畢，2 秒後重播...")) return;
          lIdx = 0;
          sIdx = 0;
          morseTimer = setTimeout(step, 1800);
          return;
        }
        const entry = letters[lIdx];
        if (sIdx === 0) currentWordTrail.push("");
        const sym = entry.code[sIdx];
        const isDash = sym === "-";
        const glyph = isDash ? "━" : "●";
        currentWordTrail[currentWordTrail.length - 1] += glyph;

        if (!setLamp(true, sym, `第 ${lIdx + 1}/${letters.length} 字母：${isDash ? "長亮 ━" : "短閃 ●"}`)) return;

        morseTimer = setTimeout(() => {
          if (!setLamp(false, "", `第 ${lIdx + 1}/${letters.length} 字母`)) return;
          sIdx++;
          if (sIdx >= entry.code.length) {
            sIdx = 0;
            lIdx++;
            morseTimer = setTimeout(step, 800);
          } else {
            morseTimer = setTimeout(step, 240);
          }
        }, isDash ? 560 : 210);
      }

      step();
    }

    function moveMaze(mod, dx, dy) {
      if (!mod || mod.id !== "laser_maze") return;
      const cur = miniState.mazePos || mod.start;
      const nx = cur.x + dx;
      const ny = cur.y + dy;
      if (nx < 1 || nx > 6 || ny < 1 || ny > 6) return;

      if (!BNN.canMazeMove(mod.maze, cur.x, cur.y, dx, dy)) {
        if (BNN.Sound) BNN.Sound.zap();
        miniState.mazeShock = true;
        paint();
        setTimeout(() => {
          miniState.mazeShock = false;
          paint();
        }, 420);
        if (options.onStrike) {
          options.onStrike(mod.id, `迷宮撞到隱藏雷射牆！(${cur.x},${cur.y}) 無法往該方向移動！`);
        }
        return;
      }

      if (BNN.Sound) BNN.Sound.laserStep();
      miniState.mazePos = { x: nx, y: ny };
      miniState.mazeTrail.add(`${nx},${ny}`);
      if (options.onMazeMove) options.onMazeMove(miniState.mazePos);

      if (nx === mod.goal.x && ny === mod.goal.y) {
        if (options.onSolved) {
          options.onSolved(mod.id, mod.title, "🧭 成功穿過隱藏雷射迷宮抵達終點！");
        }
      } else {
        paint();
      }
    }

    function onKeyDown(e) {
      const modules = mission.modules || [];
      const mod = modules[activeIdx];
      const solvedSet = new Set(roomState.solvedModules || []);
      if (!mod || mod.id !== "laser_maze" || solvedSet.has(mod.id)) return;
      if (e.target && ["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName)) return;
      const map = {
        ArrowUp: [0, -1], w: [0, -1], W: [0, -1],
        ArrowDown: [0, 1], s: [0, 1], S: [0, 1],
        ArrowLeft: [-1, 0], a: [-1, 0], A: [-1, 0],
        ArrowRight: [1, 0], d: [1, 0], D: [1, 0]
      };
      const delta = map[e.key];
      if (delta) {
        e.preventDefault();
        moveMaze(mod, delta[0], delta[1]);
      }
    }
    document.addEventListener("keydown", onKeyDown);

    function paint() {
      stopTimers();
      const modules = mission.modules || [];
      if (activeIdx >= modules.length) activeIdx = 0;
      const mod = modules[activeIdx];
      const solvedSet = new Set(roomState.solvedModules || []);
      const isSolved = mod && solvedSet.has(mod.id);

      if (mod && mod.id === "laser_maze" && !miniState.mazePos) {
        miniState.mazePos = { x: mod.start.x, y: mod.start.y };
        miniState.mazeTrail = new Set([`${mod.start.x},${mod.start.y}`]);
      }

      const bodyHtml =
        mod && mod.kind === "minigame"
          ? renderMiniGameVisualizer(mod, isSolved, miniState)
          : renderScratchVisualizer(mod, isSolved);

      container.innerHTML = `
        <div class="bomb-casing">
          ${options.hideEdgework ? "" : renderEdgeworkStrip(mission.edgework)}
          <div class="module-hardware-box ${isSolved ? "is-solved" : ""}">
            <div class="mod-hw-head">
              <div>
                <h3>${escapeHtml(mod.title)}</h3>
                <p>${escapeHtml(mod.subtitle)}</p>
              </div>
              <span class="mod-status-pill ${isSolved ? "solved" : "armed"}">${isSolved ? "✅ 已解除" : mod.kind === "minigame" ? "🕹️ 現場動作" : "🧩 程式武裝"}</span>
            </div>
            <div class="mod-hw-body">${bodyHtml}</div>
          </div>
        </div>
      `;

      // Bind Big Button
      const bigBtn = container.querySelector("#act-big-btn");
      if (bigBtn && mod && mod.id === "big_button" && !isSolved) {
        const startHold = (e) => {
          e.preventDefault();
          if (miniState.holding) return;
          miniState.holding = true;
          miniState.stripLit = false;
          miniState.holdStartAt = Date.now();
          bigBtn.classList.add("pressed");
          if (BNN.Sound) BNN.Sound.chargeDown();

          holdTimer = setTimeout(() => {
            if (!miniState.holding) return;
            miniState.stripLit = true;
            if (BNN.Sound) BNN.Sound.chargeLit();
            const stripEl = container.querySelector("#big-btn-strip");
            if (stripEl) {
              stripEl.className = `charge-strip ${STRIP_COLOR_CLASS[mod.stripColor] || "strip-red"}`;
              stripEl.textContent = `${mod.stripColor}光`;
            }
            const hintEl = container.querySelector(".big-btn-hint");
            if (hintEl) hintEl.textContent = "⚡ 按住中！快報光條顏色給指揮官，等目標數字出現放開！";
          }, 420);
        };

        const endHold = () => {
          if (!miniState.holding) return;
          const heldMs = Date.now() - miniState.holdStartAt;
          miniState.holding = false;
          miniState.stripLit = false;
          if (holdTimer) {
            clearTimeout(holdTimer);
            holdTimer = null;
          }
          const timerDisplay = options.getTimerDisplay ? options.getTimerDisplay() : "00:00";
          const res = mod.evaluateButtonRelease({ heldMs, timerDisplay });
          if (res.pass) {
            if (options.onSolved) options.onSolved(mod.id, mod.title, res.message);
          } else {
            if (options.onStrike) options.onStrike(mod.id, res.reason);
          }
          paint();
        };

        bigBtn.addEventListener("pointerdown", startHold);
        bigBtn.addEventListener("pointerup", endHold);
        bigBtn.addEventListener("pointerleave", () => {
          if (miniState.holding) endHold();
        });
      }

      // Bind Maze D-Pad
      container.querySelectorAll("[data-maze-dir]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const [dx, dy] = btn.dataset.mazeDir.split(",").map(Number);
          moveMaze(mod, dx, dy);
        });
      });

      // Bind Morse Radio
      if (mod && mod.id === "morse_radio" && !isSolved) {
        startMorseLoop(mod);
        const rngFreq = container.querySelector("#rng-freq");
        const prevBtn = container.querySelector("#btn-freq-prev");
        const nextBtn = container.querySelector("#btn-freq-next");
        const txBtn = container.querySelector("#btn-tx-morse");

        const updateFreqDisplay = (nextIdx) => {
          miniState.freqIdx = Math.max(0, Math.min(mod.allFreqs.length - 1, nextIdx));
          const freqStr = mod.allFreqs[miniState.freqIdx];
          const mhzEl = container.querySelector("#tuner-mhz");
          if (mhzEl) mhzEl.textContent = `${freqStr} MHz`;
          if (rngFreq) rngFreq.value = String(miniState.freqIdx);
          if (prevBtn) prevBtn.disabled = miniState.freqIdx <= 0;
          if (nextBtn) nextBtn.disabled = miniState.freqIdx >= mod.allFreqs.length - 1;
          if (txBtn) txBtn.textContent = `📡 發射 ${freqStr} MHz 拆彈訊號`;
        };

        if (rngFreq) {
          rngFreq.addEventListener("input", (e) => {
            if (BNN.Sound) BNN.Sound.click();
            updateFreqDisplay(Number(e.target.value));
          });
        }
        if (prevBtn) {
          prevBtn.addEventListener("click", () => {
            if (BNN.Sound) BNN.Sound.click();
            updateFreqDisplay(miniState.freqIdx - 1);
          });
        }
        if (nextBtn) {
          nextBtn.addEventListener("click", () => {
            if (BNN.Sound) BNN.Sound.click();
            updateFreqDisplay(miniState.freqIdx + 1);
          });
        }
        if (txBtn) {
          txBtn.addEventListener("click", () => {
            const chosen = mod.allFreqs[miniState.freqIdx];
            if (chosen === mod.targetFreq) {
              if (options.onSolved) {
                options.onSolved(mod.id, mod.title, `📻 電台驗證通過（${mod.targetWord} = ${chosen} MHz）！`);
              }
            } else {
              if (options.onStrike) {
                options.onStrike(mod.id, `頻率 ${chosen} MHz 不正確！請重新確認摩斯單字後再發射！`);
              }
            }
          });
        }
      }
    }

    paint();

    return {
      update(nextRoomState) {
        const prevIdx = activeIdx;
        const prevSolved = (roomState.solvedModules || []).length;
        roomState = nextRoomState;
        activeIdx = Number(nextRoomState.activeModuleIndex || 0);
        if (prevIdx !== activeIdx || prevSolved !== (nextRoomState.solvedModules || []).length) {
          paint();
        }
      },
      destroy() {
        stopTimers();
        document.removeEventListener("keydown", onKeyDown);
      }
    };
  }

  BNN.renderBombPanel = renderBombPanel;
  BNN.renderEdgeworkStrip = renderEdgeworkStrip;
})(window);
