/**
 * app.js — BOMBANANA 程式拆彈實驗室主控制器 (國中生街機合作版)
 */
(function (global) {
  const BNN = (global.BNN = global.BNN || {});

  const PRESETS = {
    mix: { label: "🔥 經典混搭 (2程式+2小遊戲｜7分)", durationSec: 420, unlimitedTime: false },
    party_all: { label: "⚡ 爆笑大亂鬥 (4程式+3小遊戲｜12分)", durationSec: 720, unlimitedTime: false },
    code_only: { label: "🧩 純程式特訓 (4 Scratch×PY｜8分)", durationSec: 480, unlimitedTime: false },
    minigame_only: { label: "🎉 純派對暖身 (3 動作小遊戲｜5分)", durationSec: 300, unlimitedTime: false },
    challenge_all: { label: "💀 終極全9關 (6程式+3小遊戲｜15分)", durationSec: 900, unlimitedTime: false },
    unlimited: { label: "🎓 課堂練習 (混搭4模組｜不限時)", durationSec: 420, unlimitedTime: true }
  };

  const ROLES = [
    {
      id: "commander",
      badge: "國二專用",
      icon: "🕶️",
      title: "Python 指揮官",
      desc: "看不到炸彈！手握 Python 規格書、迷宮牆壁地圖、摩斯表與 PY↔Scratch 對照表，全場發問＋口頭指揮！"
    },
    {
      id: "coop",
      badge: "國一 2人共用1台",
      icon: "🛠️",
      title: "國一雙人共用機",
      desc: "兩位國一坐同台電腦並肩作戰！每解完一個關卡自動提醒「偵察手 ⇄ 積木/特務手」交換滑鼠，誰都不會發呆！"
    },
    {
      id: "observer",
      badge: "國一並排｜角色A",
      icon: "🔭",
      title: "國一現場偵察員",
      desc: "兩位國一各用一台並排坐時選這個！負責看炸彈特徵、控管程式安全插銷，並親手操作「大按鈕 / 迷宮 / 摩斯電台」！"
    },
    {
      id: "coder",
      badge: "國一並排｜角色B",
      icon: "🧩",
      title: "國一 Scratch 程式師",
      desc: "兩位國一各用一台並排坐時選這個！專屬 Scratch 積木區＋PY對照表，小遊戲關卡時還有搭檔紀錄助手可以一起喊！"
    },
    {
      id: "demo",
      badge: "老師／單人體驗",
      icon: "🎓",
      title: "全視角示範模式",
      desc: "一鍵切換「炸彈與動作小遊戲 / Scratch」與「國二專家手冊」，適合老師示範或自己試玩。"
    }
  ];

  const RADIO_CALLOUTS = [
    "🆘 救命！國二快救援！",
    "🔋 請報電池數與指示燈！",
    "🔓 保險解鎖！衝啊！",
    "🔥 穩住不要慌！",
    "😎 這題太簡單了吧！"
  ];

  const state = {
    roomCode: "BNN-101",
    playerName: "香蕉特務",
    teamName: "",
    role: "coop",
    selectedPreset: "mix",
    selectedModuleIds: (BNN.PRESET_MODULES && BNN.PRESET_MODULES.mix.slice()) || ["logic_gate", "big_button", "wire_array", "laser_maze"],
    safetyLockRequired: true,
    syncMode: "checking",
    roomState: null,
    mission: null,
    activeModuleIdx: 0,
    demoTab: "bomb",
    showPyRef: true,
    rotationEnabled: true,
    swapFlag: false,
    savedAsts: {},
    lastExecLog: null,
    lastEventId: null,
    lastRadioId: null,
    clockOffsetMs: 0,
    lastTickSec: null,
    leaderboard: [],
    morseScratchpad: ""
  };

  let syncClient = null;
  let workspaceCtrl = null;
  let bombCtrl = null;
  let manualCtrl = null;
  let pyRefCtrl = null;
  let renderedSignature = "";
  let timerInterval = null;
  let timeoutSent = false;

  const root = document.getElementById("app");

  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function formatTime(sec) {
    const s = Math.max(0, Math.floor(sec));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
  }

  function getComputedRemainingSec() {
    const rs = state.roomState;
    if (!rs) return 420;
    if (rs.unlimitedTime) {
      if (!rs.startedAt) return 0;
      const now = Date.now() + state.clockOffsetMs;
      const end = rs.endedAt || now;
      return Math.max(0, Math.floor((end - rs.startedAt) / 1000));
    }
    if (rs.status === "playing" && rs.startedAt) {
      const now = Date.now() + state.clockOffsetMs;
      const elapsed = Math.floor((now - rs.startedAt) / 1000);
      return Math.max(0, rs.durationSec - elapsed);
    }
    return rs.remainingSec ?? rs.durationSec;
  }

  function showToast(msg, kind = "info") {
    const toast = document.getElementById("global-toast");
    if (!toast) return;
    toast.textContent = msg;
    toast.className = `global-toast show ${kind}`;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => toast.classList.remove("show"), 4000);
  }

  function openHelpModal() {
    const modal = document.getElementById("help-modal");
    if (modal) modal.classList.add("open");
  }

  function closeHelpModal() {
    const modal = document.getElementById("help-modal");
    if (modal) modal.classList.remove("open");
  }

  function buildMissionIfNeeded() {
    const rs = state.roomState;
    if (!rs) return;
    const presetKey = rs.preset || "mix";
    const seed = rs.seed || rs.code || "BNN-101";
    const modIds = Array.isArray(rs.selectedModuleIds) && rs.selectedModuleIds.length > 0 ? rs.selectedModuleIds : null;
    const modSig = modIds ? modIds.join(",") : presetKey;

    if (!state.mission || state.mission.seed !== seed || state.mission._modSig !== modSig) {
      state.mission = BNN.generateBombMission(seed, presetKey, modIds);
      state.mission._modSig = modSig;
      state.savedAsts = {};
      state.lastExecLog = null;
      state.activeModuleIdx = 0;
    }
  }

  async function refreshLeaderboard() {
    if (!syncClient) return;
    const list = await syncClient.fetchLeaderboard();
    state.leaderboard = list || [];
    if (!state.roomState || state.roomState.status === "lobby") {
      const lbEl = document.getElementById("lobby-leaderboard-list");
      if (lbEl) lbEl.innerHTML = renderLeaderboardRows();
    }
  }

  function onRoomStateUpdate(nextState) {
    const prevStatus = state.roomState ? state.roomState.status : null;
    state.roomState = nextState;
    if (nextState.serverNow) {
      state.clockOffsetMs = nextState.serverNow - Date.now();
    }
    if (typeof nextState.activeModuleIndex === "number" && (state.role === "observer" || state.role === "coder")) {
      state.activeModuleIdx = nextState.activeModuleIndex;
    }

    if (nextState.lastEvent && nextState.lastEvent.id !== state.lastEventId) {
      state.lastEventId = nextState.lastEvent.id;
      const ev = nextState.lastEvent;
      if (ev.type === "defused") {
        if (BNN.Sound) BNN.Sound.defused();
        state.swapFlag = !state.swapFlag;
        showToast("🎉 " + ev.message, "success");
      } else if (ev.type === "strike") {
        if (BNN.Sound) BNN.Sound.strike();
        showToast("💥 " + ev.message, "danger");
        const shell = document.querySelector(".game-shell");
        if (shell) {
          shell.classList.remove("shake");
          void shell.offsetWidth;
          shell.classList.add("shake");
        }
      } else if (ev.type === "won") {
        if (BNN.Sound) BNN.Sound.win();
        refreshLeaderboard();
      } else if (ev.type === "lost") {
        if (BNN.Sound) BNN.Sound.boom();
      } else if (ev.type === "safety") {
        showToast("🔐 " + ev.message, "info");
      } else if (ev.type === "radio") {
        if (BNN.Sound) BNN.Sound.radioPing();
        showToast("📡 " + ev.message, "radio");
      }
    }

    if (nextState.status === "playing") {
      timeoutSent = false;
      buildMissionIfNeeded();
    } else if (nextState.status === "lobby" && prevStatus !== "lobby") {
      refreshLeaderboard();
    }

    renderApp();
  }

  function renderLeaderboardRows() {
    if (!state.leaderboard || state.leaderboard.length === 0) {
      return `<div class="lb-empty">目前還沒有通關紀錄，快成為第一支拆彈傳奇小隊！</div>`;
    }
    return state.leaderboard
      .slice(0, 8)
      .map(
        (entry, i) => `
      <div class="lb-row">
        <span class="lb-rank">${i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}</span>
        <span class="lb-team">${escapeHtml(entry.team)}</span>
        <span class="lb-meta">${entry.moduleCount}關 · ${entry.strikes}失誤 · <b>${formatTime(entry.elapsedSec)}</b></span>
      </div>
    `
      )
      .join("");
  }

  function renderTopBar() {
    const rs = state.roomState;
    const isPlaying = rs && rs.status === "playing";
    const isMuted = BNN.Sound && BNN.Sound.isMuted();
    const rem = getComputedRemainingSec();
    const urgent = isPlaying && rs && !rs.unlimitedTime && rem <= 30;
    const solvedCount = rs ? (rs.solvedModules || []).length : 0;
    const totalCount = state.mission ? state.mission.modules.length : 0;
    const strikes = rs ? rs.strikes : 0;
    const maxStrikes = rs ? rs.maxStrikes : 3;
    const roleObj = ROLES.find((r) => r.id === state.role) || ROLES[1];

    return `
      <header class="topbar">
        <div class="brand">
          <span class="brand-logo">🍌💣</span>
          <div>
            <div class="brand-title">BOMBANANA 程式拆彈實驗室</div>
            <div class="brand-sub">Scratch × Python × 動作派對合作挑戰</div>
          </div>
        </div>

        ${
          rs && rs.status !== "lobby"
            ? `
          <div class="hud-strip">
            <div class="hud-pill role-pill">${roleObj.icon} ${escapeHtml(roleObj.title)}</div>
            <div class="hud-pill led-clock ${urgent ? "urgent" : ""}" id="hud-timer">
              ${rs.unlimitedTime ? "⏱ " : ""}${formatTime(rem)}
            </div>
            <div class="hud-pill strikes-pill" id="hud-strikes">
              ${Array.from({ length: maxStrikes }, (_, i) => (i < strikes ? '<span class="strike-x hit">✖</span>' : '<span class="strike-x">○</span>')).join("")}
            </div>
            <div class="hud-pill progress-pill" id="hud-progress">
              ✅ ${solvedCount}/${totalCount} 解除
            </div>
          </div>
        `
            : ""
        }

        <div class="top-actions">
          <span class="sync-badge ${state.syncMode}">
            ${state.syncMode === "server" ? "🟢 雲端即時連線" : "🟡 單機／種子模式"}
          </span>
          <button type="button" class="btn-top" id="btn-toggle-pyref">
            📖 PY對照表 ${state.showPyRef ? "開" : "關"}
          </button>
          <button type="button" class="btn-top" id="btn-help">❓ 怎麼玩</button>
          <button type="button" class="btn-top" id="btn-mute">${isMuted ? "🔇 靜音" : "🔊 音效"}</button>
          ${rs && rs.status !== "lobby" ? `<button type="button" class="btn-top warn" id="btn-back-lobby">🏠 回大廳</button>` : ""}
        </div>
      </header>
    `;
  }

  function renderLobby() {
    const rs = state.roomState || {};
    const players = rs.players || [];
    const presetCfg = PRESETS[state.selectedPreset] || PRESETS.mix;
    const modMeta = BNN.MODULE_META || [];

    return `
      <div class="lobby-wrap">
        <section class="lobby-hero">
          <div class="hero-left">
            <div class="hero-tag">🎮 國二 Python × 國一 Scratch × 派對動作小遊戲</div>
            <h1>3 人特務小隊集結！<br>講得清楚、寫得正確、手腳夠快才能活下來！</h1>
            <p>
              沒有盲人與聾人限制！<strong>🕶️ 國二指揮官</strong>看著手冊裡的 Python 規則、迷宮地圖與摩斯密碼表；
              坐在另一側的<strong>兩位國一搭檔</strong>並肩分工，一邊操作 <b>Scratch 積木</b>（旁邊就有 <b>PY 對照表</b>），
              一邊挑戰 <b>按住讀秒大按鈕、盲眼雷射迷宮、摩斯調頻電台</b>！
            </p>
            <div class="hero-badges">
              <span>🧩 6 種程式拆彈</span>
              <span>🕹️ 3 種爆笑小遊戲</span>
              <span>📖 互動式 PY↔Scratch 對照表</span>
              <span>📡 無線電快捷喊話</span>
            </div>
          </div>

          <div class="hero-room-box">
            <div class="room-box-title">🔑 小隊報到處</div>
            <div class="form-row">
              <label>房間代碼（同隊輸入一樣的代碼就能連線！）</label>
              <div class="input-with-btn">
                <input type="text" id="inp-room-code" value="${escapeHtml(state.roomCode)}" maxlength="20" />
                <button type="button" class="btn-secondary" id="btn-rand-code">🎲 換房號</button>
              </div>
            </div>
            <div class="form-grid-2">
              <div class="form-row">
                <label>你的特務代號</label>
                <input type="text" id="inp-player-name" value="${escapeHtml(state.playerName)}" maxlength="16" />
              </div>
              <div class="form-row">
                <label>小隊名稱（上榜用，選填）</label>
                <input type="text" id="inp-team-name" value="${escapeHtml(state.teamName)}" placeholder="例：八年一班最強隊" maxlength="24" />
              </div>
            </div>
            <div class="online-list">
              <span>已進房隊友 (${players.length})：</span>
              ${
                players.length === 0
                  ? "<small>等待隊友...</small>"
                  : players
                      .map((p) => {
                        const r = ROLES.find((x) => x.id === p.role);
                        return `<span class="player-chip">${r ? r.icon : "👤"} ${escapeHtml(p.name)} (${r ? r.title : p.role})</span>`;
                      })
                      .join("")
              }
            </div>
          </div>
        </section>

        <section class="lobby-roles">
          <h2>👥 選擇你的特務職位（依教室座位挑選）</h2>
          <div class="role-cards">
            ${ROLES.map(
              (r) => `
              <button type="button" class="role-card ${state.role === r.id ? "selected" : ""}" data-select-role="${r.id}">
                <div class="role-card-top">
                  <span class="role-icon">${r.icon}</span>
                  <span class="role-badge">${r.badge}</span>
                </div>
                <h3>${r.title}</h3>
                <p>${r.desc}</p>
              </button>
            `
            ).join("")}
          </div>
        </section>

        <section class="lobby-config">
          <div class="cfg-col">
            <h3>🎮 選擇遊戲模式 & 自由搭配關卡</h3>
            <div class="preset-pills">
              ${Object.entries(PRESETS)
                .map(
                  ([key, info]) => `
                <button type="button" class="preset-btn ${state.selectedPreset === key ? "active" : ""}" data-preset="${key}">${info.label}</button>
              `
                )
                .join("")}
            </div>

            <div class="module-picker-title">✨ 已勾選本局模組（${state.selectedModuleIds.length} 個，點擊可自由增減）：</div>
            <div class="module-picker-grid">
              ${modMeta
                .map((m) => {
                  const picked = state.selectedModuleIds.includes(m.id);
                  return `
                  <button type="button" class="mod-pick-chip ${picked ? "picked" : ""} ${m.kind === "minigame" ? "is-mini" : ""}" data-pick-mod="${m.id}">
                    <span class="pick-dot">${picked ? "☑" : "☐"}</span>
                    <span>${escapeHtml(m.title)}</span>
                    <small>${escapeHtml(m.tag)}</small>
                  </button>
                `;
                })
                .join("")}
            </div>

            <label class="chk-line">
              <input type="checkbox" id="chk-safety-lock" ${state.safetyLockRequired ? "checked" : ""} />
              <span><strong>國一雙機「安全插銷鎖」</strong>（偵察員與程式師分兩台時，程式模組須由偵察員按解鎖後才能執行）</span>
            </label>
          </div>

          <div class="cfg-right">
            <div class="cfg-start">
              <div class="start-summary">
                <div>房號：<b>${escapeHtml(state.roomCode)}</b></div>
                <div>關卡數：<b>${state.selectedModuleIds.length} 個</b></div>
              </div>
              <div class="start-preset-name">${presetCfg.label}</div>
              <button type="button" class="btn-start-game" id="btn-start-game" ${state.selectedModuleIds.length === 0 ? "disabled" : ""}>🚀 全員就位，開始拆彈！</button>
              <small class="start-note">任一隊友按下開始後，同房所有裝置將同步進入任務</small>
            </div>

            <div class="leaderboard-box">
              <div class="lb-head">🏆 實驗室拆彈英雄榜</div>
              <div class="lb-list" id="lobby-leaderboard-list">${renderLeaderboardRows()}</div>
            </div>
          </div>
        </section>
      </div>
    `;
  }

  function renderEndScreen() {
    const rs = state.roomState;
    const isWon = rs.status === "won";
    const rem = getComputedRemainingSec();

    return `
      <div class="end-screen ${isWon ? "won" : "lost"}">
        <div class="end-card">
          <div class="end-emoji">${isWon ? "🎉🍌🏆" : "💥🍌💀"}</div>
          <h1>${isWon ? "完美拆彈！實驗室得救了！" : "轟隆！變成滿地香蕉泥了！"}</h1>
          <p class="end-reason">${escapeHtml(rs.endReason || "")}</p>
          <div class="end-stats">
            <div class="stat-box"><span>任務代碼</span><strong>${escapeHtml(rs.seed || rs.code)}</strong></div>
            <div class="stat-box"><span>${rs.unlimitedTime ? "完成耗時" : "剩餘時間"}</span><strong>${formatTime(rem)}</strong></div>
            <div class="stat-box"><span>完成模組</span><strong>${(rs.solvedModules || []).length} / ${state.mission ? state.mission.modules.length : 0}</strong></div>
            <div class="stat-box"><span>累積失誤</span><strong>${rs.strikes} / ${rs.maxStrikes}</strong></div>
          </div>
          <div class="end-actions">
            <button type="button" class="btn-start-game" id="btn-play-again">🔄 換新題目再挑戰一局</button>
            <button type="button" class="btn-secondary big" id="btn-end-lobby">🏠 回大廳換模式／角色</button>
          </div>
        </div>
      </div>
    `;
  }

  function renderGameLayout() {
    const rs = state.roomState;
    const mission = state.mission;
    const modules = mission.modules || [];
    if (state.activeModuleIdx >= modules.length) state.activeModuleIdx = 0;
    const activeMod = modules[state.activeModuleIdx];
    const solvedSet = new Set(rs.solvedModules || []);
    const isModSolved = activeMod && solvedSet.has(activeMod.id);
    const isMiniGame = activeMod && activeMod.kind === "minigame";

    const role = state.role;
    const showDemoTabs = role === "demo";
    const showBomb = role === "coop" || role === "observer" || (role === "demo" && state.demoTab === "bomb");
    // Only show Scratch workspace when current module is a Scratch coding module!
    const showScratchArea = (role === "coop" && !isMiniGame) || role === "coder" || (role === "demo" && state.demoTab === "bomb" && !isMiniGame);
    const showManual = role === "commander" || (role === "demo" && state.demoTab === "manual");

    const needsSafetyUnlock =
      role === "coder" &&
      !isMiniGame &&
      rs.safetyLockRequired &&
      activeMod &&
      rs.safetyUnlockedFor !== activeMod.id;

    const coopPartnerBanner =
      role === "coop" && state.rotationEnabled
        ? `
      <div class="coop-turn-banner">
        <span>🤝 <b>國一雙人共用分工：</b>
          目前由 <strong>${state.swapFlag ? "夥伴 B" : "夥伴 A"}</strong> 主控操作（${isMiniGame ? "🕹️ 動作小遊戲" : "🧩 拉 Scratch 積木"}），
          <strong>${state.swapFlag ? "夥伴 A" : "夥伴 B"}</strong> 負責「🔭 報炸彈特徵、盯閃燈、核對 PY 表」！
        </span>
        <button type="button" class="btn-mini" id="btn-manual-swap">🔄 立即換手</button>
      </div>
    `
        : "";

    const demoSwitcher = showDemoTabs
      ? `
      <div class="demo-tabs">
        <button type="button" class="demo-tab ${state.demoTab === "bomb" ? "active" : ""}" data-demo-tab="bomb">💣 國一現場：炸彈 ＋ Scratch ＋ 小遊戲</button>
        <button type="button" class="demo-tab ${state.demoTab === "manual" ? "active" : ""}" data-demo-tab="manual">🕶️ 國二指揮官：Python ＋ 小遊戲手冊</button>
      </div>
    `
      : "";

    const radioBar = `
      <div class="radio-bar">
        <span class="radio-title">📡 無線電喊話：</span>
        <div class="radio-btns">
          ${RADIO_CALLOUTS.map((txt) => `<button type="button" class="radio-chip" data-radio-txt="${escapeHtml(txt)}">${escapeHtml(txt)}</button>`).join("")}
        </div>
        <div class="radio-latest" id="radio-latest">
          ${
            rs.radioFeed && rs.radioFeed.length > 0
              ? `<span>最新：<b>${escapeHtml(rs.radioFeed[rs.radioFeed.length - 1].senderName)}</b>「${escapeHtml(rs.radioFeed[rs.radioFeed.length - 1].text)}」</span>`
              : "<small>點擊左方按鈕快速發送團隊暗號</small>"
          }
        </div>
      </div>
    `;

    let scratchOrCompanionHtml = "";
    if (showScratchArea) {
      if (isMiniGame && role === "coder") {
        // Coder looking at a non-programming mini-game tab gets a super helpful companion helper!
        scratchOrCompanionHtml = `
          <section class="panel-scratch companion-mode">
            <div class="scratch-mod-bar">
              <div>
                <span class="scratch-mod-badge">🕹️ 非程式小遊戲</span>
                <strong>${escapeHtml(activeMod.title)}</strong>
                <div class="scratch-goal-txt">這關不用寫程式！快幫旁邊的「國一偵察員」一起破關！</div>
              </div>
              <div class="coder-mod-tabs">
                ${modules
                  .map((m, i) => `<button type="button" class="coder-mod-pill ${i === state.activeModuleIdx ? "active" : ""} ${solvedSet.has(m.id) ? "solved" : ""}" data-coder-mod="${i}">${solvedSet.has(m.id) ? "✅" : m.kind === "minigame" ? `🕹️${i + 1}` : `🧩${i + 1}`}</button>`)
                  .join("")}
              </div>
            </div>
            <div class="companion-card">
              <h3>🤝 並排搭檔助攻指南</h3>
              ${
                activeMod.id === "morse_radio"
                  ? `
                <p>盯著偵察員螢幕的閃燈，在這裡點按鈕幫大家記下摩斯電碼再唸給國二！</p>
                <div class="morse-pad-box">
                  <div class="morse-pad-display" id="coder-morse-pad">${escapeHtml(state.morseScratchpad || "尚未紀錄...")}</div>
                  <div class="morse-pad-btns">
                    <button type="button" class="mf-btn" data-pad-add="●">● 短點</button>
                    <button type="button" class="mf-btn" data-pad-add="━">━ 長劃</button>
                    <button type="button" class="mf-btn" data-pad-add=" / ">␣ 換下個字母</button>
                    <button type="button" class="mf-btn clr" data-pad-clr="1">🗑️ 清空</button>
                  </div>
                </div>
              `
                  : activeMod.id === "big_button"
                  ? `<p>幫偵察員盯著右上角倒數計時器！國二一唸出目標數字（1 / 2 / 4 / 5），大喊「放開！」</p>`
                  : `<p>幫偵察員聽國二的走法指令（「上、右、下...」），小心不要讓猴子撞到隱形雷射牆！</p>`
              }
            </div>
          </section>
        `;
      } else {
        scratchOrCompanionHtml = `
          <section class="panel-scratch" id="panel-scratch">
            <div class="scratch-mod-bar">
              <div>
                <span class="scratch-mod-badge">${isModSolved ? "✅ 已解除" : `🧩 模組 ${state.activeModuleIdx + 1}/${modules.length}`}</span>
                <strong>${escapeHtml(activeMod.title)}</strong>
                <div class="scratch-goal-txt">🎯 ${escapeHtml(activeMod.goalHint)}</div>
              </div>
              ${
                role === "coder"
                  ? `
                <div class="coder-mod-tabs">
                  ${modules
                    .map((m, i) => `<button type="button" class="coder-mod-pill ${i === state.activeModuleIdx ? "active" : ""} ${solvedSet.has(m.id) ? "solved" : ""}" data-coder-mod="${i}">${solvedSet.has(m.id) ? "✅" : m.kind === "minigame" ? `🕹️${i + 1}` : `🧩${i + 1}`}</button>`)
                    .join("")}
                </div>
              `
                  : ""
              }
            </div>

            <div class="scratch-editor-host" id="scratch-editor-host"></div>

            <div class="scratch-run-bar">
              <div class="run-status-wrap" id="safety-status-wrap">
                ${
                  role === "coder" && rs.safetyLockRequired && !isModSolved
                    ? needsSafetyUnlock
                      ? `<span class="lock-wait">🔒 等待旁邊「國一偵察員」按下解除保險後才能執行</span>`
                      : `<span class="lock-ready">🔓 偵察員已解除保險！準備好就可以執行拆彈</span>`
                    : `<span class="run-hint">💡 寫好積木後按執行，系統會逐條測試你的 Scratch 邏輯</span>`
                }
              </div>
              <div class="run-btns">
                <button type="button" class="btn-run-bomb" id="btn-run-scratch" ${isModSolved || needsSafetyUnlock ? "disabled" : ""}>
                  ${isModSolved ? "✅ 此模組已解除" : "▶ 執行 Scratch 拆彈"}
                </button>
              </div>
            </div>

            <div class="exec-log-box" id="exec-log-box">${renderExecLogHtml()}</div>
          </section>
        `;
      }
    }

    const layoutModeClass =
      showBomb && showScratchArea
        ? "layout-split2"
        : "layout-single";

    return `
      <div class="game-shell">
        ${demoSwitcher}
        ${coopPartnerBanner}
        ${radioBar}
        <div class="game-grid ${layoutModeClass} ${state.showPyRef ? "has-ref" : ""}">
          ${showBomb ? `<section class="panel-bomb" id="panel-bomb"></section>` : ""}
          ${scratchOrCompanionHtml}
          ${showManual ? `<section class="panel-manual" id="panel-manual"></section>` : ""}
          ${state.showPyRef ? `<aside class="panel-pyref" id="panel-pyref"></aside>` : ""}
        </div>
      </div>
    `;
  }

  function renderExecLogHtml() {
    if (!state.lastExecLog) {
      return `<div class="exec-empty">📋 執行紀錄區：按下「▶ 執行 Scratch 拆彈」後，這裡會顯示逐步驗證與除錯訊息。</div>`;
    }
    const log = state.lastExecLog;
    return `
      <div class="exec-result ${log.pass ? "pass" : "fail"}">
        <div class="exec-head">${log.pass ? "✅ 驗證通過！" : "⚠️ " + escapeHtml(log.reason)}</div>
        ${
          log.logs && log.logs.length > 0
            ? `<ul class="exec-steps">${log.logs.map((l) => `<li>${escapeHtml(l)}</li>`).join("")}</ul>`
            : ""
        }
      </div>
    `;
  }

  function updatePlayingHudAndStatusOnly() {
    const rs = state.roomState;
    if (!rs || rs.status !== "playing") return;

    const rem = getComputedRemainingSec();
    const timerEl = document.getElementById("hud-timer");
    if (timerEl) {
      timerEl.textContent = `${rs.unlimitedTime ? "⏱ " : ""}${formatTime(rem)}`;
      timerEl.classList.toggle("urgent", !rs.unlimitedTime && rem <= 30);
    }

    const strikesEl = document.getElementById("hud-strikes");
    if (strikesEl) {
      const s = rs.strikes;
      const m = rs.maxStrikes;
      strikesEl.innerHTML = Array.from({ length: m }, (_, i) =>
        i < s ? '<span class="strike-x hit">✖</span>' : '<span class="strike-x">○</span>'
      ).join("");
    }

    const progEl = document.getElementById("hud-progress");
    if (progEl && state.mission) {
      progEl.textContent = `✅ ${(rs.solvedModules || []).length}/${state.mission.modules.length} 解除`;
    }

    const radioLatest = document.getElementById("radio-latest");
    if (radioLatest && rs.radioFeed && rs.radioFeed.length > 0) {
      const last = rs.radioFeed[rs.radioFeed.length - 1];
      radioLatest.innerHTML = `<span>最新：<b>${escapeHtml(last.senderName)}</b>「${escapeHtml(last.text)}」</span>`;
    }

    if (bombCtrl) bombCtrl.update(rs);
    if (manualCtrl) manualCtrl.updateRoomState(rs);

    const modules = state.mission ? state.mission.modules : [];
    const activeMod = modules[state.activeModuleIdx];
    const solvedSet = new Set(rs.solvedModules || []);
    const isModSolved = activeMod && solvedSet.has(activeMod.id);
    const isMiniGame = activeMod && activeMod.kind === "minigame";
    const needsSafetyUnlock =
      state.role === "coder" &&
      !isMiniGame &&
      rs.safetyLockRequired &&
      activeMod &&
      rs.safetyUnlockedFor !== activeMod.id;

    const runBtn = document.getElementById("btn-run-scratch");
    if (runBtn) {
      runBtn.disabled = Boolean(isModSolved || needsSafetyUnlock);
      runBtn.textContent = isModSolved ? "✅ 此模組已解除" : "▶ 執行 Scratch 拆彈";
    }
    const statusWrap = document.getElementById("safety-status-wrap");
    if (statusWrap && state.role === "coder" && !isMiniGame && rs.safetyLockRequired && !isModSolved) {
      statusWrap.innerHTML = needsSafetyUnlock
        ? `<span class="lock-wait">🔒 等待旁邊「國一偵察員」按下解除保險後才能執行</span>`
        : `<span class="lock-ready">🔓 偵察員已解除保險！準備好就可以執行拆彈</span>`;
    }
    document.querySelectorAll("[data-coder-mod]").forEach((btn) => {
      const idx = Number(btn.dataset.coderMod);
      const m = modules[idx];
      if (m) {
        btn.classList.toggle("solved", solvedSet.has(m.id));
        btn.textContent = solvedSet.has(m.id) ? "✅" : m.kind === "minigame" ? `🕹️${idx + 1}` : `🧩${idx + 1}`;
      }
    });
  }

  function renderApp() {
    const rs = state.roomState;
    const status = rs ? rs.status : "lobby";
    const seed = rs ? rs.seed : "";
    const sig =
      status === "playing"
        ? `playing|${seed}|${state.role}|${state.activeModuleIdx}|${state.demoTab}|${state.showPyRef}|${state.swapFlag}`
        : status === "lobby"
        ? `lobby|${state.roomCode}|${state.role}|${state.selectedPreset}|${state.selectedModuleIds.join(",")}|${state.safetyLockRequired}|${(rs && rs.players ? rs.players.length : 0)}`
        : `${status}|${seed}|${rs ? rs.strikes : 0}`;

    if (sig === renderedSignature && status === "playing") {
      updatePlayingHudAndStatusOnly();
      return;
    }
    renderedSignature = sig;

    if (bombCtrl && typeof bombCtrl.destroy === "function") {
      bombCtrl.destroy();
      bombCtrl = null;
    }

    let bodyHtml = "";
    if (status === "lobby") {
      bodyHtml = renderLobby();
    } else if (status === "won" || status === "lost") {
      bodyHtml = renderEndScreen();
    } else {
      bodyHtml = renderGameLayout();
    }

    root.innerHTML = `${renderTopBar()}<main class="main-area">${bodyHtml}</main>`;
    bindGlobalHeaderEvents();

    if (status === "lobby") bindLobbyEvents();
    else if (status === "won" || status === "lost") bindEndEvents();
    else mountGameSubComponents();
  }

  function bindGlobalHeaderEvents() {
    const pyBtn = document.getElementById("btn-toggle-pyref");
    if (pyBtn) {
      pyBtn.addEventListener("click", () => {
        state.showPyRef = !state.showPyRef;
        renderedSignature = "";
        renderApp();
      });
    }
    const muteBtn = document.getElementById("btn-mute");
    if (muteBtn) {
      muteBtn.addEventListener("click", () => {
        const m = BNN.Sound.toggleMute();
        muteBtn.textContent = m ? "🔇 靜音" : "🔊 音效";
      });
    }
    const helpBtn = document.getElementById("btn-help");
    if (helpBtn) helpBtn.addEventListener("click", openHelpModal);

    const backBtn = document.getElementById("btn-back-lobby");
    if (backBtn) {
      backBtn.addEventListener("click", () => {
        syncClient.sendAction("backToLobby");
      });
    }
  }

  function bindLobbyEvents() {
    const codeInp = document.getElementById("inp-room-code");
    if (codeInp) {
      codeInp.addEventListener("change", (e) => {
        const clean = e.target.value.trim().toUpperCase().replace(/[^A-Z0-9\-_]/g, "") || "BNN-101";
        state.roomCode = clean;
        e.target.value = clean;
        syncClient.joinRoom(state.roomCode, state.role, state.playerName);
      });
    }

    const nameInp = document.getElementById("inp-player-name");
    if (nameInp) {
      nameInp.addEventListener("change", (e) => {
        state.playerName = e.target.value.trim() || "香蕉特務";
        syncClient.joinRoom(state.roomCode, state.role, state.playerName);
      });
    }

    const teamInp = document.getElementById("inp-team-name");
    if (teamInp) {
      teamInp.addEventListener("input", (e) => {
        state.teamName = e.target.value;
      });
    }

    const randBtn = document.getElementById("btn-rand-code");
    if (randBtn) {
      randBtn.addEventListener("click", () => {
        state.roomCode = BNN.randomRoomCode();
        if (BNN.Sound) BNN.Sound.click();
        syncClient.joinRoom(state.roomCode, state.role, state.playerName);
        renderApp();
      });
    }

    document.querySelectorAll("[data-select-role]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.role = btn.dataset.selectRole;
        if (BNN.Sound) BNN.Sound.click();
        syncClient.joinRoom(state.roomCode, state.role, state.playerName);
        renderApp();
      });
    });

    document.querySelectorAll("[data-preset]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const key = btn.dataset.preset;
        state.selectedPreset = key;
        if (BNN.PRESET_MODULES && BNN.PRESET_MODULES[key]) {
          state.selectedModuleIds = BNN.PRESET_MODULES[key].slice();
        }
        if (BNN.Sound) BNN.Sound.click();
        renderApp();
      });
    });

    document.querySelectorAll("[data-pick-mod]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.pickMod;
        const idx = state.selectedModuleIds.indexOf(id);
        if (idx >= 0) {
          if (state.selectedModuleIds.length > 1) state.selectedModuleIds.splice(idx, 1);
          else showToast("至少要選擇 1 個拆彈模組喔！", "danger");
        } else {
          state.selectedModuleIds.push(id);
        }
        if (BNN.Sound) BNN.Sound.click();
        renderApp();
      });
    });

    const lockChk = document.getElementById("chk-safety-lock");
    if (lockChk) {
      lockChk.addEventListener("change", (e) => {
        state.safetyLockRequired = e.target.checked;
      });
    }

    const startBtn = document.getElementById("btn-start-game");
    if (startBtn) {
      startBtn.addEventListener("click", () => {
        if (state.selectedModuleIds.length === 0) return;
        const cfg = PRESETS[state.selectedPreset] || PRESETS.mix;
        const freshSeed =
          syncClient.getMode() === "server"
            ? `${state.roomCode}-${Math.floor(Date.now() / 1000) % 10000}`
            : state.roomCode;
        if (BNN.Sound) BNN.Sound.unlock();
        syncClient.sendAction("startGame", {
          preset: state.selectedPreset,
          selectedModuleIds: state.selectedModuleIds.slice(),
          teamName: state.teamName,
          durationSec: cfg.durationSec,
          unlimitedTime: cfg.unlimitedTime,
          safetyLockRequired: state.safetyLockRequired,
          seed: freshSeed
        });
      });
    }
  }

  function bindEndEvents() {
    const againBtn = document.getElementById("btn-play-again");
    if (againBtn) {
      againBtn.addEventListener("click", () => {
        const cfg = PRESETS[state.selectedPreset] || PRESETS.mix;
        const newCode = syncClient.getMode() === "local" ? BNN.randomRoomCode() : state.roomCode;
        state.roomCode = newCode;
        const freshSeed =
          syncClient.getMode() === "server"
            ? `${newCode}-${Math.floor(Date.now() / 1000) % 10000}`
            : newCode;
        syncClient.sendAction("startGame", {
          preset: state.selectedPreset,
          selectedModuleIds: state.selectedModuleIds.slice(),
          teamName: state.teamName,
          durationSec: cfg.durationSec,
          unlimitedTime: cfg.unlimitedTime,
          safetyLockRequired: state.safetyLockRequired,
          seed: freshSeed
        });
      });
    }
    const lobbyBtn = document.getElementById("btn-end-lobby");
    if (lobbyBtn) {
      lobbyBtn.addEventListener("click", () => {
        syncClient.sendAction("backToLobby");
      });
    }
  }

  function mountGameSubComponents() {
    const rs = state.roomState;
    const mission = state.mission;
    const modules = mission.modules || [];
    const activeMod = modules[state.activeModuleIdx];

    manualCtrl = null;
    workspaceCtrl = null;
    pyRefCtrl = null;

    const pyRefHost = document.getElementById("panel-pyref");
    if (pyRefHost) {
      pyRefCtrl = BNN.renderReferencePanel(pyRefHost, {
        initialCategory: activeMod ? activeMod.pyCategory : "all"
      });
    }

    const bombHost = document.getElementById("panel-bomb");
    if (bombHost) {
      bombCtrl = BNN.renderBombPanel(bombHost, mission, rs, {
        showSafetySwitch: state.role === "observer" && rs.safetyLockRequired,
        getTimerDisplay: () => formatTime(getComputedRemainingSec()),
        onSelectModule(idx) {
          state.activeModuleIdx = idx;
          state.lastExecLog = null;
          if (state.role === "observer") {
            syncClient.sendAction("selectModule", { moduleIndex: idx });
          } else {
            renderedSignature = "";
            renderApp();
          }
        },
        onToggleSafety(modId) {
          syncClient.sendAction("toggleSafetyLock", { moduleId: modId });
        },
        onMazeMove(pos) {
          syncClient.sendAction("mazeMove", { pos });
        },
        onSolved(modId, modTitle, message) {
          showToast(message || "成功解除！", "success");
          syncClient.sendAction("moduleSolved", {
            moduleId: modId,
            moduleTitle: modTitle,
            totalModules: modules.length
          });
        },
        onStrike(modId, reason) {
          syncClient.sendAction("moduleStrike", {
            moduleId: modId,
            reason
          });
        }
      });
    }

    const scrHost = document.getElementById("scratch-editor-host");
    if (scrHost && activeMod && activeMod.kind === "scratch") {
      workspaceCtrl = BNN.createWorkspaceEditor(
        scrHost,
        activeMod,
        state.savedAsts[activeMod.id],
        (ast) => {
          state.savedAsts[activeMod.id] = ast;
        }
      );
    }

    const manHost = document.getElementById("panel-manual");
    if (manHost) {
      manualCtrl = BNN.renderManualView(manHost, mission, rs, (cat) => {
        if (pyRefCtrl) pyRefCtrl.filterCategory(cat);
      });
    }

    // Bind Radio callouts
    document.querySelectorAll("[data-radio-txt]").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (BNN.Sound) BNN.Sound.radioPing();
        syncClient.sendAction("radioPing", {
          text: btn.dataset.radioTxt,
          senderName: state.playerName,
          senderRole: state.role
        });
      });
    });

    // Bind Coder Morse helper pad
    document.querySelectorAll("[data-pad-add]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.morseScratchpad += btn.dataset.padAdd;
        const padEl = document.getElementById("coder-morse-pad");
        if (padEl) padEl.textContent = state.morseScratchpad;
      });
    });
    const padClr = document.querySelector("[data-pad-clr]");
    if (padClr) {
      padClr.addEventListener("click", () => {
        state.morseScratchpad = "";
        const padEl = document.getElementById("coder-morse-pad");
        if (padEl) padEl.textContent = "尚未紀錄...";
      });
    }

    document.querySelectorAll("[data-demo-tab]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.demoTab = btn.dataset.demoTab;
        renderedSignature = "";
        renderApp();
      });
    });

    document.querySelectorAll("[data-coder-mod]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = Number(btn.dataset.coderMod);
        state.activeModuleIdx = idx;
        state.lastExecLog = null;
        syncClient.sendAction("selectModule", { moduleIndex: idx });
        renderedSignature = "";
        renderApp();
      });
    });

    const swapBtn = document.getElementById("btn-manual-swap");
    if (swapBtn) {
      swapBtn.addEventListener("click", () => {
        state.swapFlag = !state.swapFlag;
        if (BNN.Sound) BNN.Sound.click();
        renderedSignature = "";
        renderApp();
      });
    }

    const runBtn = document.getElementById("btn-run-scratch");
    if (runBtn && activeMod && activeMod.kind === "scratch") {
      runBtn.addEventListener("click", () => {
        const ast = workspaceCtrl ? workspaceCtrl.getAst() : [];
        const check = BNN.validateProgram(ast, activeMod);
        if (!check.valid) {
          if (BNN.Sound) BNN.Sound.click();
          state.lastExecLog = { pass: false, reason: check.message, logs: [] };
          const logBox = document.getElementById("exec-log-box");
          if (logBox) logBox.innerHTML = renderExecLogHtml();
          return;
        }

        const result = activeMod.evaluate(ast);
        state.lastExecLog = result;
        const logBox = document.getElementById("exec-log-box");
        if (logBox) logBox.innerHTML = renderExecLogHtml();

        if (result.pass) {
          syncClient.sendAction("moduleSolved", {
            moduleId: activeMod.id,
            moduleTitle: activeMod.title,
            totalModules: modules.length
          });
        } else {
          syncClient.sendAction("moduleStrike", {
            moduleId: activeMod.id,
            reason: result.reason
          });
        }
      });
    }
  }

  function startTimerLoop() {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      const rs = state.roomState;
      if (!rs || rs.status !== "playing") return;
      const rem = getComputedRemainingSec();
      if (rem !== state.lastTickSec) {
        state.lastTickSec = rem;
        updatePlayingHudAndStatusOnly();
        if (!rs.unlimitedTime && rem <= 15 && rem > 0) {
          if (BNN.Sound) BNN.Sound.tick(true);
        } else if (!rs.unlimitedTime && rem <= 30 && rem > 0 && rem % 2 === 0) {
          if (BNN.Sound) BNN.Sound.tick(false);
        }
        if (!rs.unlimitedTime && rem <= 0 && !timeoutSent) {
          timeoutSent = true;
          syncClient.sendAction("timeout");
        }
      }
    }, 250);
  }

  async function init() {
    const closeHelp = document.getElementById("btn-close-help");
    if (closeHelp) closeHelp.addEventListener("click", closeHelpModal);
    const helpModal = document.getElementById("help-modal");
    if (helpModal) {
      helpModal.addEventListener("click", (e) => {
        if (e.target === helpModal) closeHelpModal();
      });
    }

    syncClient = BNN.createSyncClient(onRoomStateUpdate, (detected) => {
      state.syncMode = detected;
      if (detected === "server") refreshLeaderboard();
      renderApp();
    });

    await syncClient.detectServer();
    await syncClient.joinRoom(state.roomCode, state.role, state.playerName);
    if (syncClient.getMode() === "server") await refreshLeaderboard();
    startTimerLoop();
  }

  init();
})(window);
