/**
 * app.js — BOMBANANA 程式拆彈實驗室主控制器
 * 流程：步驟1(輸入房號與暱稱) → 步驟2(進房看模式/隊友預覽) → 步驟3(統一職位輪流實戰)
 * 老師控制台：統一開房、設定小隊名稱、遊戲模式與監控即時狀態
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

  const state = {
    view: "entry", // entry | room | teacher
    syncMode: "checking",
    roomCode: "",
    playerName: "",
    entryError: "",
    joining: false,

    // Room & gameplay state
    roomState: null,
    mission: null,
    activeModuleIdx: 0,
    soloView: "defuser", // defuser | manual (only when <= 1 player in room)
    defuserRightTab: "scratch", // scratch | pyref
    savedAsts: {},
    lastExecLog: null,
    lastEventId: null,
    clockOffsetMs: 0,
    lastTickSec: null,
    leaderboard: [],
    swapBannerText: "",
    swapBannerUntil: 0,

    // Teacher form state
    teacherForm: {
      code: "TEAM-01",
      teamName: "第 1 小隊",
      preset: "mix",
      selectedModuleIds: (BNN.PRESET_MODULES && BNN.PRESET_MODULES.mix.slice()) || [
        "logic_gate",
        "big_button",
        "wire_array",
        "laser_maze"
      ],
      rotateRoles: true,
      teacherOnlyStart: false,
      batchPrefix: "TEAM",
      batchCount: 4
    },
    teacherRooms: [],
    teacherNotice: ""
  };

  let syncClient = null;
  let workspaceCtrl = null;
  let bombCtrl = null;
  let manualCtrl = null;
  let pyRefCtrl = null;
  let renderedSignature = "";
  let timerInterval = null;
  let teacherPollTimer = null;
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

  function openModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.add("open");
  }

  function closeModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.remove("open");
  }

  function getMyTurnRole() {
    const rs = state.roomState;
    if (!rs) return "defuser";
    const players = rs.players || [];
    if (players.length <= 1) return state.soloView;
    return rs.defuserClientId === syncClient.getClientId() ? "defuser" : "manual";
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
      state.activeModuleIdx = Number(rs.activeModuleIndex || 0);
      state.defuserRightTab = "scratch";
    }
  }

  async function refreshLeaderboard() {
    if (!syncClient) return;
    const list = await syncClient.fetchLeaderboard();
    state.leaderboard = list || [];
    const host = document.getElementById("modal-lb-body");
    if (host) host.innerHTML = renderLeaderboardRows();
  }

  function renderLeaderboardRows() {
    if (!state.leaderboard || state.leaderboard.length === 0) {
      return `<div class="lb-empty">目前還沒有通關紀錄，快組隊成為第一支傳奇拆彈小隊！</div>`;
    }
    return state.leaderboard
      .slice(0, 12)
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

  function onRoomStateUpdate(nextState) {
    if (state.view !== "room") return;
    const prevStatus = state.roomState ? state.roomState.status : null;
    state.roomState = nextState;
    if (nextState.serverNow) {
      state.clockOffsetMs = nextState.serverNow - Date.now();
    }
    if (typeof nextState.activeModuleIndex === "number") {
      if (state.activeModuleIdx !== nextState.activeModuleIndex) {
        state.activeModuleIdx = nextState.activeModuleIndex;
        state.lastExecLog = null;
        state.defuserRightTab = "scratch";
      }
    }

    if (nextState.lastEvent && nextState.lastEvent.id !== state.lastEventId) {
      state.lastEventId = nextState.lastEvent.id;
      const ev = nextState.lastEvent;
      if (ev.type === "defused") {
        if (BNN.Sound) BNN.Sound.defused();
        if (ev.rotated) {
          state.swapBannerText = ev.message;
          state.swapBannerUntil = Date.now() + 4500;
        }
        showToast("🎉 " + ev.message, "success");
      } else if (ev.type === "rotate") {
        if (BNN.Sound) BNN.Sound.click();
        state.swapBannerText = ev.message;
        state.swapBannerUntil = Date.now() + 4000;
        showToast(ev.message, "info");
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
      }
    }

    if (nextState.status === "playing") {
      timeoutSent = false;
      buildMissionIfNeeded();
    } else if (nextState.status === "lobby" && prevStatus !== "lobby") {
      state.swapBannerText = "";
      state.swapBannerUntil = 0;
    }

    renderApp();
  }

  // ==================== 頂部極簡導覽列 ====================
  function renderTopBar() {
    const rs = state.view === "room" ? state.roomState : null;
    const isPlaying = rs && rs.status === "playing";
    const isMuted = BNN.Sound && BNN.Sound.isMuted();
    const rem = getComputedRemainingSec();
    const urgent = isPlaying && rs && !rs.unlimitedTime && rem <= 30;
    const solvedCount = rs ? (rs.solvedModules || []).length : 0;
    const totalCount = state.mission ? state.mission.modules.length : 0;
    const strikes = rs ? rs.strikes : 0;
    const maxStrikes = rs ? rs.maxStrikes : 3;
    const myRole = isPlaying ? getMyTurnRole() : null;

    return `
      <header class="topbar">
        <div class="brand">
          <span class="brand-logo">🍌💣</span>
          <div>
            <div class="brand-title">BOMBANANA 拆彈實驗室</div>
            <div class="brand-sub">
              ${
                rs && rs.teamName
                  ? `${escapeHtml(rs.teamName)} · 房號 ${escapeHtml(rs.code)}`
                  : state.view === "teacher"
                  ? "👩‍🏫 老師統一開房與模式管理"
                  : "Scratch × Python 合作拆彈"
              }
            </div>
          </div>
        </div>

        ${
          isPlaying
            ? `
          <div class="hud-strip">
            <div class="hud-pill role-badge-pill ${myRole === "defuser" ? "is-defuser" : "is-manual"}">
              ${myRole === "defuser" ? "💣 本關職位：拆彈手" : "📖 本關職位：指揮官"}
            </div>
            <div class="hud-pill led-clock ${urgent ? "urgent" : ""}" id="hud-timer">
              ${rs.unlimitedTime ? "⏱ " : ""}${formatTime(rem)}
            </div>
            <div class="hud-pill strikes-pill" id="hud-strikes">
              ${Array.from({ length: maxStrikes }, (_, i) => (i < strikes ? '<span class="strike-x hit">✖</span>' : '<span class="strike-x">❤️</span>')).join("")}
            </div>
            <div class="hud-pill progress-pill" id="hud-progress">
              🚩 ${solvedCount}/${totalCount} 關
            </div>
          </div>
        `
            : ""
        }

        <div class="top-actions">
          <span class="sync-badge ${state.syncMode}">
            ${state.syncMode === "server" ? "🟢 連線中" : "🟡 本機模式"}
          </span>
          <button type="button" class="btn-top" id="btn-open-lb">🏆 排行</button>
          <button type="button" class="btn-top" id="btn-help">❓ 規則</button>
          <button type="button" class="btn-top" id="btn-mute">${isMuted ? "🔇" : "🔊"}</button>
          ${rs ? `<button type="button" class="btn-top warn" id="btn-leave-room">🚪 離開房間</button>` : ""}
        </div>
      </header>
    `;
  }

  // ==================== 步驟 1：極簡輸入房號 + 暱稱 ====================
  function renderEntryView() {
    return `
      <div class="entry-shell">
        <form class="entry-card" id="entry-form">
          <div class="entry-tag">👋 歡迎來到拆彈小隊</div>
          <h1>先輸入房號與暱稱</h1>
          <p class="entry-sub">由老師統一建立房間與小隊模式，輸入老師給的房號就能進入下一步！</p>

          <div class="entry-field">
            <label for="inp-room-code">🔑 房間代碼（例：TEAM-01）</label>
            <input type="text" id="inp-room-code" value="${escapeHtml(state.roomCode)}" placeholder="請輸入老師給的房號" maxlength="20" autocomplete="off" />
          </div>

          <div class="entry-field">
            <label for="inp-player-name">😎 你的暱稱</label>
            <input type="text" id="inp-player-name" value="${escapeHtml(state.playerName)}" placeholder="請輸入你的名字或代號" maxlength="16" autocomplete="off" />
          </div>

          ${state.entryError ? `<div class="entry-error">⚠️ ${escapeHtml(state.entryError)}</div>` : ""}

          <button type="submit" class="btn-primary-xl" id="btn-enter-room" ${state.joining ? "disabled" : ""}>
            ${state.joining ? "正在連線進房..." : "下一步：進入房間 →"}
          </button>

          <div class="entry-divider"><span>或</span></div>

          <button type="button" class="btn-teacher-entry" id="btn-goto-teacher">
            👩‍🏫 我是老師：前往統一開房＆設定小隊模式
          </button>
        </form>
      </div>
    `;
  }

  // ==================== 老師控制台：統一開房、隊名、模式與監控 ====================
  function renderTeacherView() {
    const tf = state.teacherForm;
    const modMeta = BNN.MODULE_META || [];
    const presetCfg = PRESETS[tf.preset] || PRESETS.mix;

    return `
      <div class="teacher-shell">
        <div class="teacher-topbar">
          <div>
            <h2>👩‍🏫 老師統一開房控制台</h2>
            <p>先在這裡建立房間並指定「小隊名稱」與「遊戲模式」，學生只要輸入房號＋暱稱即可加入。</p>
          </div>
          <button type="button" class="btn-secondary big" id="btn-teacher-back">← 回到學生輸入房號頁</button>
        </div>

        ${state.teacherNotice ? `<div class="teacher-notice">${escapeHtml(state.teacherNotice)}</div>` : ""}

        <div class="teacher-grid">
          <div class="t-card">
            <h3>➕ 建立或更新單一房間</h3>
            <div class="form-grid-2">
              <div class="form-row">
                <label>🔑 房號</label>
                <div class="input-with-btn">
                  <input type="text" id="t-room-code" value="${escapeHtml(tf.code)}" maxlength="20" />
                  <button type="button" class="btn-secondary" id="btn-t-rand">🎲</button>
                </div>
              </div>
              <div class="form-row">
                <label>🏷️ 小隊名稱</label>
                <input type="text" id="t-team-name" value="${escapeHtml(tf.teamName)}" placeholder="例：第 1 小隊" maxlength="24" />
              </div>
            </div>

            <div class="t-section-lbl">🎮 選擇此小隊遊戲模式（已選 ${tf.selectedModuleIds.length} 關 · ${presetCfg.unlimitedTime ? "不限時" : Math.round(presetCfg.durationSec / 60) + " 分鐘"}）</div>
            <div class="preset-pills">
              ${Object.entries(PRESETS)
                .map(
                  ([key, info]) => `
                <button type="button" class="preset-btn ${tf.preset === key ? "active" : ""}" data-t-preset="${key}">${info.label}</button>
              `
                )
                .join("")}
            </div>

            <details class="t-details">
              <summary>🔧 微調本局關卡組合（目前 ${tf.selectedModuleIds.length} 個）</summary>
              <div class="module-picker-grid">
                ${modMeta
                  .map((m) => {
                    const picked = tf.selectedModuleIds.includes(m.id);
                    return `
                    <button type="button" class="mod-pick-chip ${picked ? "picked" : ""} ${m.kind === "minigame" ? "is-mini" : ""}" data-t-mod="${m.id}">
                      <span>${picked ? "☑" : "☐"} ${escapeHtml(m.title)}</span>
                      <small>${escapeHtml(m.tag)}</small>
                    </button>
                  `;
                  })
                  .join("")}
              </div>
            </details>

            <div class="t-checks">
              <label class="chk-line">
                <input type="checkbox" id="chk-t-rotate" ${tf.rotateRoles ? "checked" : ""} />
                <span><strong>🔄 每過一關自動輪流職位</strong>（全體隊員統一輪替「拆彈手 ⇄ 指揮官」）</span>
              </label>
              <label class="chk-line">
                <input type="checkbox" id="chk-t-teacher-only" ${tf.teacherOnlyStart ? "checked" : ""} />
                <span><strong>🔒 僅限老師按開始</strong>（打勾後須由老師在右側房間列表按「🚀 開始」，適合全班計時競賽）</span>
              </label>
            </div>

            <button type="button" class="btn-primary-xl" id="btn-t-save">✅ 建立／發布此房間</button>

            <div class="t-batch-box">
              <div class="t-batch-title">⚡ 班級多組快速開房（套用上方模式）</div>
              <div class="t-batch-row">
                <label>前綴 <input type="text" id="t-batch-prefix" value="${escapeHtml(tf.batchPrefix)}" maxlength="10" /></label>
                <label>隊數
                  <select id="t-batch-count">
                    ${[2, 3, 4, 6, 8, 10].map((n) => `<option value="${n}" ${tf.batchCount === n ? "selected" : ""}>${n} 隊</option>`).join("")}
                  </select>
                </label>
                <button type="button" class="btn-secondary" id="btn-t-batch">一鍵建立</button>
              </div>
            </div>
          </div>

          <div class="t-card">
            <div class="t-list-head">
              <h3>📋 教室已開房間總覽</h3>
              <button type="button" class="btn-mini" id="btn-t-refresh">🔄 立即刷新</button>
            </div>
            <div class="t-rooms-list" id="teacher-rooms-list">
              ${renderTeacherRoomsHtml()}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function renderTeacherRoomsHtml() {
    if (!state.teacherRooms || state.teacherRooms.length === 0) {
      return `<div class="t-empty">目前尚未建立任何房間，請在左側填寫房號、小隊名稱與模式後點擊「建立／發布此房間」。</div>`;
    }
    return state.teacherRooms
      .map((rm) => {
        const players = rm.players || [];
        const total = (rm.selectedModuleIds || []).length || 4;
        const solved = (rm.solvedModules || []).length;
        const pInfo = PRESETS[rm.preset];
        const statusMap = {
          lobby: { text: "⏳ 等待進房中", cls: "st-lobby" },
          playing: { text: `🔥 拆彈中 (${solved}/${total})`, cls: "st-playing" },
          won: { text: "🎉 已通關！", cls: "st-won" },
          lost: { text: "💥 已引爆", cls: "st-lost" }
        };
        const st = statusMap[rm.status] || statusMap.lobby;
        return `
          <div class="t-room-item">
            <div class="t-room-top">
              <div>
                <span class="t-room-code">${escapeHtml(rm.code)}</span>
                <strong class="t-room-team">${escapeHtml(rm.teamName || "未命名小隊")}</strong>
              </div>
              <span class="t-room-st ${st.cls}">${st.text}</span>
            </div>
            <div class="t-room-meta">
              模式：${escapeHtml(pInfo ? pInfo.label : rm.preset)} · ${rm.rotateRoles ? "🔄 自動輪流" : "固定順序"}
            </div>
            <div class="t-room-players">
              隊員 (${players.length})：
              ${
                players.length === 0
                  ? "<small>尚無學生進房</small>"
                  : players.map((p) => `<span class="player-chip">${escapeHtml(p.name)}${rm.status === "lobby" && p.ready ? " ✅" : ""}</span>`).join("")
              }
            </div>
            <div class="t-room-actions">
              <button type="button" class="btn-mini" data-t-copy="${escapeHtml(rm.code)}">📋 複製房號</button>
              <button type="button" class="btn-mini" data-t-edit="${escapeHtml(rm.code)}">✏️ 修改設定</button>
              ${
                rm.status === "lobby"
                  ? `<button type="button" class="btn-mini primary" data-t-start="${escapeHtml(rm.code)}">🚀 開始這房</button>`
                  : `<button type="button" class="btn-mini" data-t-reset="${escapeHtml(rm.code)}">🔄 重回大廳</button>`
              }
              <button type="button" class="btn-mini danger" data-t-del="${escapeHtml(rm.code)}">🗑️ 刪除</button>
            </div>
          </div>
        `;
      })
      .join("");
  }

  // ==================== 步驟 2：已進房等待室 ====================
  function renderRoomLobbyView() {
    const rs = state.roomState;
    if (!rs || rs.status === "closed") {
      return `
        <div class="entry-shell">
          <div class="entry-card">
            <h2>🚪 房間已關閉</h2>
            <p class="entry-sub">老師已關閉或刪除此房間，請返回首頁重新輸入房號。</p>
            <button type="button" class="btn-primary-xl" id="btn-closed-back">← 返回輸入房號</button>
          </div>
        </div>
      `;
    }

    const players = rs.players || [];
    const me = players.find((p) => p.clientId === syncClient.getClientId());
    const presetCfg = PRESETS[rs.preset] || PRESETS.mix;
    const modMeta = BNN.MODULE_META || [];
    const mods = (rs.selectedModuleIds || []).map((id) => modMeta.find((m) => m.id === id) || { id, title: id });

    return `
      <div class="room-lobby-shell">
        <div class="step-pill-bar">步驟 2 / 2 · 已進入房間，確認團隊與關卡後按下開始！</div>

        <div class="mission-banner-card">
          <div class="mb-top">
            <div>
              <div class="mb-kicker">🏷️ 老師指定小隊</div>
              <h1>${escapeHtml(rs.teamName || rs.code)}</h1>
            </div>
            <div class="mb-code-box">
              <span>房號</span>
              <strong>${escapeHtml(rs.code)}</strong>
            </div>
          </div>

          <div class="mb-specs">
            <span class="spec-chip">🎮 ${escapeHtml(presetCfg.label)}</span>
            <span class="spec-chip">🚩 共 ${mods.length} 關</span>
            <span class="spec-chip">${rs.rotateRoles ? "🔄 每過 1 關自動輪流「拆彈手 ⇄ 指揮官」" : "👥 固定分工進行"}</span>
          </div>

          <div class="mb-mod-trail">
            ${mods.map((m, i) => `<span class="trail-pill">${i + 1}. ${escapeHtml(m.title)}</span>`).join("")}
          </div>
        </div>

        <div class="roster-card">
          <div class="roster-head">
            <h3>👥 小隊報到名單（${players.length} 人）</h3>
            <span class="roster-hint">不分年級與固定身分，人人輪流擔任「💣 拆彈手」與「📖 指揮官」！</span>
          </div>

          <div class="roster-list">
            ${players
              .map((p, idx) => {
                const isMe = p.clientId === syncClient.getClientId();
                const firstRoleText = idx === 0 ? "第 1 關先當 💣 拆彈手" : "第 1 關先當 📖 指揮官";
                return `
                  <div class="roster-player ${isMe ? "is-me" : ""}">
                    <div class="rp-left">
                      <span class="rp-avatar">${idx === 0 ? "💣" : "📖"}</span>
                      <div>
                        <div class="rp-name">${escapeHtml(p.name)} ${isMe ? '<span class="me-tag">你</span>' : ""}</div>
                        <div class="rp-role-note">${players.length <= 1 ? "單人練習可自由切換視角" : firstRoleText}</div>
                      </div>
                    </div>
                    <span class="rp-ready ${p.ready ? "yes" : "no"}">${p.ready ? "✅ 已就位" : "⏳ 準備中"}</span>
                  </div>
                `;
              })
              .join("")}
          </div>

          ${
            players.length < 2
              ? `<div class="solo-tip">💡 目前房間內只有你 1 人：請隊友也輸入房號 <b>${escapeHtml(rs.code)}</b> 與暱稱進來，就能兩人輪流配合拆彈！（也可以直接按開始先測試）</div>`
              : ""
          }
        </div>

        <div class="lobby-actions-bar">
          <button type="button" class="btn-secondary big" id="btn-lobby-back">← 換房號 / 換暱稱</button>
          <button type="button" class="btn-secondary big ${me && me.ready ? "ready-on" : ""}" id="btn-toggle-ready">
            ${me && me.ready ? "✅ 已準備（點此取消）" : "🙋 我準備好了"}
          </button>
          ${
            rs.teacherOnlyStart
              ? `<button type="button" class="btn-primary-xl" disabled>⏳ 此房設定由老師統一按下開始...</button>`
              : `<button type="button" class="btn-primary-xl" id="btn-start-mission">🚀 下一步：開始拆彈！</button>`
          }
        </div>
      </div>
    `;
  }

  // ==================== 步驟 3：超清爽不混亂的遊戲畫面 ====================
  function renderGameLayout() {
    const rs = state.roomState;
    buildMissionIfNeeded();
    const mission = state.mission;
    const modules = mission.modules || [];
    if (state.activeModuleIdx >= modules.length) state.activeModuleIdx = 0;
    const activeMod = modules[state.activeModuleIdx];
    const solvedSet = new Set(rs.solvedModules || []);
    const isModSolved = activeMod && solvedSet.has(activeMod.id);
    const isMiniGame = activeMod && activeMod.kind === "minigame";

    const players = rs.players || [];
    const isSolo = players.length <= 1;
    const myRole = getMyTurnRole();
    const defuserPlayer = players.find((p) => p.clientId === rs.defuserClientId) || players[0];
    const commanderNames = players
      .filter((p) => p.clientId !== (defuserPlayer && defuserPlayer.clientId))
      .map((p) => p.name);

    const showSwapBanner = state.swapBannerText && Date.now() < state.swapBannerUntil;

    const ribbonHtml = `
      <div class="mission-ribbon">
        <div class="ribbon-steps">
          ${modules
            .map((m, idx) => {
              const solved = solvedSet.has(m.id);
              const current = idx === state.activeModuleIdx;
              const shortName = m.title.replace(/^[^\s]+\s/, "");
              return `
                <button type="button" class="step-chip ${current ? "active" : ""} ${solved ? "solved" : ""}" data-step-mod="${idx}">
                  <span>${solved ? "✅" : idx + 1}</span>
                  <span>${escapeHtml(shortName)}</span>
                </button>
              `;
            })
            .join("")}
        </div>

        <div class="ribbon-turn">
          ${
            isSolo
              ? `
            <div class="solo-switch">
              <span>單人切換視角：</span>
              <button type="button" class="solo-tab ${state.soloView === "defuser" ? "active" : ""}" data-solo-view="defuser">💣 拆彈手</button>
              <button type="button" class="solo-tab ${state.soloView === "manual" ? "active" : ""}" data-solo-view="manual">📖 指揮官</button>
            </div>
          `
              : `
            <span class="turn-summary">
              💣 拆彈手：<b>${escapeHtml(defuserPlayer ? defuserPlayer.name : "?")}</b>
              · 📖 指揮官：<b>${escapeHtml(commanderNames.join("、") || "?")}</b>
            </span>
            <button type="button" class="btn-mini" id="btn-manual-rotate">🔄 換手輪流</button>
          `
          }
        </div>
      </div>
    `;

    const swapBannerHtml = showSwapBanner
      ? `<div class="swap-callout-banner"><span>${escapeHtml(state.swapBannerText)}</span></div>`
      : "";

    let mainWorkspaceHtml = "";

    if (myRole === "defuser") {
      if (isMiniGame) {
        // 動作小遊戲：置中大舞台，零多餘面板干擾！
        mainWorkspaceHtml = `
          <div class="stage-centered">
            <div class="role-focus-tip defuser">
              <strong>💣 你是本關【拆彈手】</strong> — 大聲把畫面條件唸給指揮官，照他的指示操作小遊戲！
            </div>
            <section class="panel-bomb" id="panel-bomb"></section>
          </div>
        `;
      } else {
        // Scratch 程式關卡：最多兩欄！左欄題目+執行，右欄切換「Scratch 積木」或「PY對照表」
        const isRefTab = state.defuserRightTab === "pyref";
        mainWorkspaceHtml = `
          <div class="role-focus-tip defuser">
            <strong>💣 你是本關【拆彈手】</strong> — 問指揮官這關怎麼寫，右邊拼好積木後點「▶ 執行程式」！
          </div>
          <div class="clean-split-2 defuser-split">
            <div class="left-col-stack">
              <section class="panel-bomb" id="panel-bomb"></section>
              <div class="scratch-run-card">
                <button type="button" class="btn-run-bomb" id="btn-run-scratch" ${isModSolved ? "disabled" : ""}>
                  ${isModSolved ? "✅ 此關已解除" : "▶ 執行 Scratch 拆彈"}
                </button>
                <div class="exec-log-box" id="exec-log-box">${renderExecLogHtml()}</div>
              </div>
            </div>

            <section class="panel-scratch-tabs">
              <div class="right-pane-tabs">
                <button type="button" class="rp-tab ${!isRefTab ? "active" : ""}" data-def-tab="scratch">🧩 Scratch 積木工作區</button>
                <button type="button" class="rp-tab ${isRefTab ? "active" : ""}" data-def-tab="pyref">📖 PY ↔ Scratch 對照表</button>
              </div>
              <div id="scratch-pane-wrap" class="${isRefTab ? "hidden" : ""}">
                <div class="scratch-goal-strip">🎯 <b>${escapeHtml(activeMod.title)}：</b>${escapeHtml(activeMod.goalHint)}</div>
                <div class="scratch-editor-host" id="scratch-editor-host"></div>
              </div>
              <div id="pyref-pane-wrap" class="${isRefTab ? "" : "hidden"}">
                <aside class="panel-pyref-inline" id="panel-pyref"></aside>
              </div>
            </section>
          </div>
        `;
      }
    } else {
      // 指揮官畫面：完全看不到炸彈！小遊戲置中大卡片，程式關卡左規則+右對照表
      if (isMiniGame) {
        mainWorkspaceHtml = `
          <div class="stage-centered wide">
            <div class="role-focus-tip manual">
              <strong>📖 你是本關【指揮官】</strong> — 你看不到炸彈！聽拆彈手報出線索，口頭指揮過關！
            </div>
            <section class="panel-manual" id="panel-manual"></section>
          </div>
        `;
      } else {
        mainWorkspaceHtml = `
          <div class="role-focus-tip manual">
            <strong>📖 你是本關【指揮官】</strong> — 你看不到炸彈！先問左側 2 個問題鎖定規則，再參考右邊對照表教拆彈手拼 Scratch！
          </div>
          <div class="clean-split-2 manual-split">
            <section class="panel-manual" id="panel-manual"></section>
            <aside class="panel-pyref" id="panel-pyref"></aside>
          </div>
        `;
      }
    }

    return `
      <div class="game-shell">
        ${ribbonHtml}
        ${swapBannerHtml}
        ${mainWorkspaceHtml}
      </div>
    `;
  }

  function renderExecLogHtml() {
    if (!state.lastExecLog) {
      return `<div class="exec-empty">📋 按下「▶ 執行 Scratch 拆彈」後，這裡會顯示測試步驟與結果。</div>`;
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

  // ==================== 步驟 4：結算畫面 ====================
  function renderEndScreen() {
    const rs = state.roomState;
    const isWon = rs.status === "won";
    const rem = getComputedRemainingSec();

    return `
      <div class="end-screen ${isWon ? "won" : "lost"}">
        <div class="end-card">
          <div class="end-emoji">${isWon ? "🎉🍌🏆" : "💥🍌💀"}</div>
          <h1>${isWon ? "完美拆彈！實驗室得救了！" : "轟隆！炸彈引爆了！"}</h1>
          <p class="end-reason">${escapeHtml(rs.endReason || "")}</p>
          <div class="end-stats">
            <div class="stat-box"><span>小隊名稱</span><strong>${escapeHtml(rs.teamName || rs.code)}</strong></div>
            <div class="stat-box"><span>${rs.unlimitedTime ? "完成耗時" : "剩餘時間"}</span><strong>${formatTime(rem)}</strong></div>
            <div class="stat-box"><span>完成關卡</span><strong>${(rs.solvedModules || []).length} / ${state.mission ? state.mission.modules.length : (rs.selectedModuleIds || []).length}</strong></div>
            <div class="stat-box"><span>累積失誤</span><strong>${rs.strikes} / ${rs.maxStrikes}</strong></div>
          </div>
          <div class="end-actions">
            ${
              rs.teacherOnlyStart
                ? `<span class="wait-teacher-txt">⏳ 等待老師統一重開或回等待室...</span>`
                : `<button type="button" class="btn-primary-xl" id="btn-play-again">🔄 換新題目再挑戰一局</button>`
            }
            <button type="button" class="btn-secondary big" id="btn-end-lobby">🏠 回到房間等待室</button>
          </div>
        </div>
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
        i < s ? '<span class="strike-x hit">✖</span>' : '<span class="strike-x">❤️</span>'
      ).join("");
    }

    const progEl = document.getElementById("hud-progress");
    if (progEl && state.mission) {
      progEl.textContent = `🚩 ${(rs.solvedModules || []).length}/${state.mission.modules.length} 關`;
    }

    if (bombCtrl) bombCtrl.update(rs);
    if (manualCtrl) manualCtrl.updateRoomState(rs);

    const modules = state.mission ? state.mission.modules : [];
    const activeMod = modules[state.activeModuleIdx];
    const solvedSet = new Set(rs.solvedModules || []);
    const isModSolved = activeMod && solvedSet.has(activeMod.id);

    const runBtn = document.getElementById("btn-run-scratch");
    if (runBtn) {
      runBtn.disabled = Boolean(isModSolved);
      runBtn.textContent = isModSolved ? "✅ 此關已解除" : "▶ 執行 Scratch 拆彈";
    }
  }

  function renderApp() {
    const view = state.view;
    const rs = state.roomState;
    const status = view === "room" && rs ? rs.status : view;
    const myRole = view === "room" && rs && rs.status === "playing" ? getMyTurnRole() : "";

    let sig = `${view}|${state.syncMode}`;
    if (view === "entry") {
      sig = `entry|${state.entryError}|${state.joining}|${state.syncMode}`;
    } else if (view === "teacher") {
      const tf = state.teacherForm;
      sig = `teacher|${tf.code}|${tf.preset}|${tf.selectedModuleIds.join(",")}|${tf.rotateRoles}|${tf.teacherOnlyStart}|${state.teacherNotice}`;
    } else if (view === "room" && rs) {
      if (rs.status === "playing") {
        const swapVis = state.swapBannerText && Date.now() < state.swapBannerUntil ? state.swapBannerText : "";
        sig = `playing|${rs.seed}|${myRole}|${rs.activeModuleIndex}|${state.activeModuleIdx}|${rs.turnIndex}|${(rs.players || []).map((p) => p.clientId).join(",")}|${swapVis}`;
      } else if (rs.status === "lobby") {
        sig = `lobby|${rs.code}|${rs.teamName}|${rs.preset}|${rs.rotateRoles}|${rs.teacherOnlyStart}|${(rs.players || []).map((p) => p.clientId + ":" + p.name + ":" + p.ready).join(",")}`;
      } else {
        sig = `end|${rs.status}|${rs.seed}|${rs.strikes}|${rs.teacherOnlyStart}`;
      }
    }

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
    if (view === "entry") {
      bodyHtml = renderEntryView();
    } else if (view === "teacher") {
      bodyHtml = renderTeacherView();
    } else if (!rs || rs.status === "lobby" || rs.status === "closed") {
      bodyHtml = renderRoomLobbyView();
    } else if (rs.status === "won" || rs.status === "lost") {
      bodyHtml = renderEndScreen();
    } else {
      bodyHtml = renderGameLayout();
    }

    root.innerHTML = `${renderTopBar()}<main class="main-area">${bodyHtml}</main>`;
    bindGlobalHeaderEvents();

    if (view === "entry") bindEntryEvents();
    else if (view === "teacher") bindTeacherEvents();
    else if (!rs || rs.status === "lobby" || rs.status === "closed") bindRoomLobbyEvents();
    else if (rs.status === "won" || rs.status === "lost") bindEndEvents();
    else mountGameSubComponents();
  }

  function bindGlobalHeaderEvents() {
    const muteBtn = document.getElementById("btn-mute");
    if (muteBtn) {
      muteBtn.addEventListener("click", () => {
        const m = BNN.Sound.toggleMute();
        muteBtn.textContent = m ? "🔇" : "🔊";
      });
    }
    const helpBtn = document.getElementById("btn-help");
    if (helpBtn) helpBtn.addEventListener("click", () => openModal("help-modal"));

    const lbBtn = document.getElementById("btn-open-lb");
    if (lbBtn) {
      lbBtn.addEventListener("click", async () => {
        await refreshLeaderboard();
        openModal("lb-modal");
      });
    }

    const leaveBtn = document.getElementById("btn-leave-room");
    if (leaveBtn) {
      leaveBtn.addEventListener("click", async () => {
        await syncClient.leaveRoom();
        state.roomState = null;
        state.mission = null;
        state.entryError = "";
        state.view = "entry";
        renderedSignature = "";
        renderApp();
      });
    }
  }

  function bindEntryEvents() {
    const form = document.getElementById("entry-form");
    const codeInp = document.getElementById("inp-room-code");
    const nameInp = document.getElementById("inp-player-name");
    const teacherBtn = document.getElementById("btn-goto-teacher");

    if (codeInp) {
      codeInp.addEventListener("input", (e) => {
        state.roomCode = e.target.value.toUpperCase();
        state.entryError = "";
      });
    }
    if (nameInp) {
      nameInp.addEventListener("input", (e) => {
        state.playerName = e.target.value;
        state.entryError = "";
      });
    }
    if (form) {
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const cleanCode = String(state.roomCode || "")
          .trim()
          .toUpperCase()
          .replace(/[^A-Z0-9\-_]/g, "");
        const cleanName = String(state.playerName || "").trim();

        if (!cleanCode) {
          state.entryError = "請輸入老師給的房號！";
          renderedSignature = "";
          renderApp();
          return;
        }
        if (!cleanName) {
          state.entryError = "請先輸入你的暱稱！";
          renderedSignature = "";
          renderApp();
          return;
        }

        state.roomCode = cleanCode;
        state.playerName = cleanName;
        state.joining = true;
        state.entryError = "";
        renderedSignature = "";
        renderApp();

        if (BNN.Sound) BNN.Sound.unlock();
        const res = await syncClient.joinRoom(cleanCode, cleanName);
        state.joining = false;
        if (res.ok) {
          try {
            global.sessionStorage.setItem("bnn_last_join", JSON.stringify({ code: cleanCode, name: cleanName }));
          } catch (_) {}
          state.view = "room";
          if (BNN.Sound) BNN.Sound.click();
          renderedSignature = "";
          onRoomStateUpdate(res.state);
          return;
        } else {
          state.entryError = res.message || "無法進入此房間，請確認房號！";
        }
        renderedSignature = "";
        renderApp();
      });
    }
    if (teacherBtn) {
      teacherBtn.addEventListener("click", async () => {
        state.view = "teacher";
        state.teacherNotice = "";
        state.teacherRooms = await syncClient.fetchRooms();
        startTeacherPolling();
        renderedSignature = "";
        renderApp();
      });
    }
  }

  function startTeacherPolling() {
    if (teacherPollTimer) clearInterval(teacherPollTimer);
    teacherPollTimer = setInterval(async () => {
      if (state.view !== "teacher") {
        clearInterval(teacherPollTimer);
        teacherPollTimer = null;
        return;
      }
      state.teacherRooms = await syncClient.fetchRooms();
      const listEl = document.getElementById("teacher-rooms-list");
      if (listEl) {
        listEl.innerHTML = renderTeacherRoomsHtml();
        bindTeacherRoomListButtons();
      }
    }, 2500);
  }

  function bindTeacherRoomListButtons() {
    document.querySelectorAll("[data-t-copy]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const code = btn.dataset.tCopy;
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(code).catch(() => {});
        }
        showToast(`已複製房號 ${code}！快請學生輸入這組房號！`, "info");
      });
    });

    document.querySelectorAll("[data-t-edit]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const code = btn.dataset.tEdit;
        const rm = state.teacherRooms.find((r) => r.code === code);
        if (!rm) return;
        state.teacherForm.code = rm.code;
        state.teacherForm.teamName = rm.teamName;
        state.teacherForm.preset = rm.preset;
        state.teacherForm.selectedModuleIds = (rm.selectedModuleIds || []).slice();
        state.teacherForm.rotateRoles = Boolean(rm.rotateRoles);
        state.teacherForm.teacherOnlyStart = Boolean(rm.teacherOnlyStart);
        state.teacherNotice = `已載入「${rm.code}（${rm.teamName}）」，修改後按「✅ 建立／發布此房間」即可更新。`;
        renderedSignature = "";
        renderApp();
      });
    });

    document.querySelectorAll("[data-t-start]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const code = btn.dataset.tStart;
        await syncClient.teacherAction(code, "startGame");
        state.teacherRooms = await syncClient.fetchRooms();
        const listEl = document.getElementById("teacher-rooms-list");
        if (listEl) {
          listEl.innerHTML = renderTeacherRoomsHtml();
          bindTeacherRoomListButtons();
        }
        showToast(`🚀 房間 ${code} 已啟動！`, "success");
      });
    });

    document.querySelectorAll("[data-t-reset]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const code = btn.dataset.tReset;
        await syncClient.teacherAction(code, "backToLobby");
        state.teacherRooms = await syncClient.fetchRooms();
        const listEl = document.getElementById("teacher-rooms-list");
        if (listEl) {
          listEl.innerHTML = renderTeacherRoomsHtml();
          bindTeacherRoomListButtons();
        }
      });
    });

    document.querySelectorAll("[data-t-del]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const code = btn.dataset.tDel;
        await syncClient.deleteTeacherRoom(code);
        state.teacherRooms = await syncClient.fetchRooms();
        const listEl = document.getElementById("teacher-rooms-list");
        if (listEl) {
          listEl.innerHTML = renderTeacherRoomsHtml();
          bindTeacherRoomListButtons();
        }
        showToast(`已刪除房間 ${code}`, "info");
      });
    });
  }

  function bindTeacherEvents() {
    const tf = state.teacherForm;
    const backBtn = document.getElementById("btn-teacher-back");
    if (backBtn) {
      backBtn.addEventListener("click", () => {
        if (teacherPollTimer) {
          clearInterval(teacherPollTimer);
          teacherPollTimer = null;
        }
        state.view = "entry";
        renderedSignature = "";
        renderApp();
      });
    }

    const codeInp = document.getElementById("t-room-code");
    if (codeInp) {
      codeInp.addEventListener("input", (e) => {
        tf.code = e.target.value.toUpperCase();
      });
    }
    const teamInp = document.getElementById("t-team-name");
    if (teamInp) {
      teamInp.addEventListener("input", (e) => {
        tf.teamName = e.target.value;
      });
    }
    const randBtn = document.getElementById("btn-t-rand");
    if (randBtn) {
      randBtn.addEventListener("click", () => {
        tf.code = BNN.randomRoomCode();
        renderedSignature = "";
        renderApp();
      });
    }

    document.querySelectorAll("[data-t-preset]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const key = btn.dataset.tPreset;
        tf.preset = key;
        if (BNN.PRESET_MODULES && BNN.PRESET_MODULES[key]) {
          tf.selectedModuleIds = BNN.PRESET_MODULES[key].slice();
        }
        if (BNN.Sound) BNN.Sound.click();
        renderedSignature = "";
        renderApp();
      });
    });

    document.querySelectorAll("[data-t-mod]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.tMod;
        const idx = tf.selectedModuleIds.indexOf(id);
        if (idx >= 0) {
          if (tf.selectedModuleIds.length > 1) tf.selectedModuleIds.splice(idx, 1);
          else showToast("至少要留 1 個關卡喔！", "danger");
        } else {
          tf.selectedModuleIds.push(id);
        }
        renderedSignature = "";
        renderApp();
      });
    });

    const rotChk = document.getElementById("chk-t-rotate");
    if (rotChk) rotChk.addEventListener("change", (e) => (tf.rotateRoles = e.target.checked));
    const onlyChk = document.getElementById("chk-t-teacher-only");
    if (onlyChk) onlyChk.addEventListener("change", (e) => (tf.teacherOnlyStart = e.target.checked));

    const saveBtn = document.getElementById("btn-t-save");
    if (saveBtn) {
      saveBtn.addEventListener("click", async () => {
        const presetCfg = PRESETS[tf.preset] || PRESETS.mix;
        const cleanCode = String(tf.code || "").trim().toUpperCase().replace(/[^A-Z0-9\-_]/g, "") || "TEAM-01";
        tf.code = cleanCode;
        const res = await syncClient.saveTeacherRoom({
          code: cleanCode,
          teamName: String(tf.teamName || "").trim() || `小隊 ${cleanCode}`,
          preset: tf.preset,
          selectedModuleIds: tf.selectedModuleIds.slice(),
          durationSec: presetCfg.durationSec,
          unlimitedTime: presetCfg.unlimitedTime,
          rotateRoles: tf.rotateRoles,
          teacherOnlyStart: tf.teacherOnlyStart
        });
        if (res && res.ok) {
          state.teacherNotice = `✅ 房間「${cleanCode}（${res.room.teamName}）」已發布！請學生輸入房號 ${cleanCode} 與暱稱進房。`;
          state.teacherRooms = await syncClient.fetchRooms();
          showToast(`已發布房間 ${cleanCode}！`, "success");
          renderedSignature = "";
          renderApp();
        }
      });
    }

    const prefixInp = document.getElementById("t-batch-prefix");
    if (prefixInp) prefixInp.addEventListener("input", (e) => (tf.batchPrefix = e.target.value.toUpperCase()));
    const countSel = document.getElementById("t-batch-count");
    if (countSel) countSel.addEventListener("change", (e) => (tf.batchCount = Number(e.target.value)));

    const batchBtn = document.getElementById("btn-t-batch");
    if (batchBtn) {
      batchBtn.addEventListener("click", async () => {
        const presetCfg = PRESETS[tf.preset] || PRESETS.mix;
        const res = await syncClient.batchCreateRooms({
          prefix: tf.batchPrefix || "TEAM",
          count: tf.batchCount || 4,
          preset: tf.preset,
          selectedModuleIds: tf.selectedModuleIds.slice(),
          durationSec: presetCfg.durationSec,
          unlimitedTime: presetCfg.unlimitedTime,
          rotateRoles: tf.rotateRoles,
          teacherOnlyStart: tf.teacherOnlyStart
        });
        if (res && res.ok) {
          state.teacherRooms = await syncClient.fetchRooms();
          const codes = (res.rooms || []).map((r) => r.code).join("、");
          state.teacherNotice = `⚡ 已批次建立 ${res.rooms.length} 間房間：${codes}`;
          showToast(`成功建立 ${res.rooms.length} 組班級房間！`, "success");
          renderedSignature = "";
          renderApp();
        }
      });
    }

    const refreshBtn = document.getElementById("btn-t-refresh");
    if (refreshBtn) {
      refreshBtn.addEventListener("click", async () => {
        state.teacherRooms = await syncClient.fetchRooms();
        const listEl = document.getElementById("teacher-rooms-list");
        if (listEl) {
          listEl.innerHTML = renderTeacherRoomsHtml();
          bindTeacherRoomListButtons();
        }
      });
    }

    bindTeacherRoomListButtons();
  }

  function bindRoomLobbyEvents() {
    const backClosed = document.getElementById("btn-closed-back");
    if (backClosed) {
      backClosed.addEventListener("click", async () => {
        await syncClient.leaveRoom();
        state.roomState = null;
        state.view = "entry";
        renderedSignature = "";
        renderApp();
      });
    }

    const backBtn = document.getElementById("btn-lobby-back");
    if (backBtn) {
      backBtn.addEventListener("click", async () => {
        await syncClient.leaveRoom();
        state.roomState = null;
        state.view = "entry";
        renderedSignature = "";
        renderApp();
      });
    }

    const readyBtn = document.getElementById("btn-toggle-ready");
    if (readyBtn) {
      readyBtn.addEventListener("click", () => {
        if (BNN.Sound) BNN.Sound.click();
        syncClient.sendAction("toggleReady");
      });
    }

    const startBtn = document.getElementById("btn-start-mission");
    if (startBtn) {
      startBtn.addEventListener("click", async () => {
        if (BNN.Sound) BNN.Sound.unlock();
        const rs = state.roomState;
        const freshSeed = `${rs.code}-${Math.floor(Date.now() / 1000) % 10000}`;
        const res = await syncClient.sendAction("startGame", { seed: freshSeed });
        if (res && res.error === "TEACHER_ONLY_START") {
          showToast(res.message, "danger");
        }
      });
    }
  }

  function bindEndEvents() {
    const againBtn = document.getElementById("btn-play-again");
    if (againBtn) {
      againBtn.addEventListener("click", () => {
        const rs = state.roomState;
        const freshSeed = `${rs.code}-${Math.floor(Date.now() / 1000) % 10000}`;
        syncClient.sendAction("startGame", { seed: freshSeed });
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
    const myRole = getMyTurnRole();

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
    if (bombHost && myRole === "defuser") {
      bombCtrl = BNN.renderBombPanel(bombHost, mission, rs, {
        getTimerDisplay: () => formatTime(getComputedRemainingSec()),
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
    if (scrHost && activeMod && activeMod.kind === "scratch" && myRole === "defuser") {
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
    if (manHost && myRole === "manual") {
      manualCtrl = BNN.renderManualView(manHost, mission, rs, (cat) => {
        if (pyRefCtrl) pyRefCtrl.filterCategory(cat);
      });
    }

    // Bind Step Chips
    document.querySelectorAll("[data-step-mod]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = Number(btn.dataset.stepMod);
        state.activeModuleIdx = idx;
        state.lastExecLog = null;
        state.defuserRightTab = "scratch";
        if (BNN.Sound) BNN.Sound.click();
        syncClient.sendAction("selectModule", { moduleIndex: idx });
        renderedSignature = "";
        renderApp();
      });
    });

    // Solo Perspective Tabs
    document.querySelectorAll("[data-solo-view]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.soloView = btn.dataset.soloView;
        if (BNN.Sound) BNN.Sound.click();
        renderedSignature = "";
        renderApp();
      });
    });

    // Manual Role Rotate Button
    const rotBtn = document.getElementById("btn-manual-rotate");
    if (rotBtn) {
      rotBtn.addEventListener("click", () => {
        if (BNN.Sound) BNN.Sound.click();
        syncClient.sendAction("rotateTurn");
      });
    }

    // Defuser Right Pane Tabs (Scratch Blocks <-> PY Reference) without losing Scratch AST!
    document.querySelectorAll("[data-def-tab]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const nextTab = btn.dataset.defTab;
        state.defuserRightTab = nextTab;
        document.querySelectorAll("[data-def-tab]").forEach((b) => b.classList.toggle("active", b === btn));
        const scrWrap = document.getElementById("scratch-pane-wrap");
        const refWrap = document.getElementById("pyref-pane-wrap");
        if (scrWrap) scrWrap.classList.toggle("hidden", nextTab !== "scratch");
        if (refWrap) refWrap.classList.toggle("hidden", nextTab !== "pyref");
      });
    });

    // Run Scratch Program
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
      if (state.view !== "room") return;
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
      if (state.swapBannerText && Date.now() >= state.swapBannerUntil) {
        state.swapBannerText = "";
        state.swapBannerUntil = 0;
        const banner = document.querySelector(".swap-callout-banner");
        if (banner) banner.remove();
      }
    }, 250);
  }

  async function init() {
    document.querySelectorAll("[data-close-modal]").forEach((btn) => {
      btn.addEventListener("click", () => closeModal(btn.dataset.closeModal));
    });
    document.querySelectorAll(".modal-backdrop").forEach((bd) => {
      bd.addEventListener("click", (e) => {
        if (e.target === bd) bd.classList.remove("open");
      });
    });

    // Pre-fill last code/name if refreshing browser
    try {
      const saved = JSON.parse(global.sessionStorage.getItem("bnn_last_join") || "null");
      if (saved && saved.code) state.roomCode = saved.code;
      if (saved && saved.name) state.playerName = saved.name;
    } catch (_) {}

    syncClient = BNN.createSyncClient(onRoomStateUpdate, (detected) => {
      state.syncMode = detected;
      renderApp();
    });

    await syncClient.detectServer();
    renderApp();
    startTimerLoop();
  }

  init();
})(window);
