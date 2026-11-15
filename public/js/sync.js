/**
 * sync.js — Render 雲端 / 區網即時同步 + SSE 斷線自動輪詢備援 + 本機離線備援
 */
(function (global) {
  const BNN = (global.BNN = global.BNN || {});

  function makeClientId() {
    const stored = global.sessionStorage && global.sessionStorage.getItem("bnn_cid");
    if (stored) return stored;
    const id = "c_" + Math.random().toString(36).slice(2, 10);
    try {
      global.sessionStorage.setItem("bnn_cid", id);
    } catch (_) {}
    return id;
  }

  function createSyncClient(onStateUpdate, onModeDetected) {
    const clientId = makeClientId();
    let mode = "checking"; // checking | server | local
    let currentCode = "BNN-101";
    let eventSource = null;
    let pollTimer = null;
    let heartbeatTimer = null;
    let bc = null;

    let localState = {
      code: "BNN-101",
      seed: "BNN-101",
      teamName: "",
      preset: "mix",
      selectedModuleIds: ["logic_gate", "big_button", "wire_array", "laser_maze"],
      safetyLockRequired: true,
      unlimitedTime: false,
      durationSec: 420,
      maxStrikes: 3,
      strikes: 0,
      status: "lobby",
      startedAt: null,
      endedAt: null,
      remainingSec: 420,
      serverNow: Date.now(),
      endReason: "",
      activeModuleIndex: 0,
      solvedModules: [],
      safetyUnlockedFor: null,
      mazePos: null,
      players: [],
      lastEvent: null,
      radioFeed: []
    };

    async function detectServer() {
      if (global.location && global.location.protocol === "file:") {
        mode = "local";
        onModeDetected("local");
        return "local";
      }
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 1600);
        const res = await fetch("/api/health", { signal: ctrl.signal, cache: "no-store" });
        clearTimeout(timer);
        if (res.ok) {
          mode = "server";
          onModeDetected("server");
          return "server";
        }
      } catch (_) {}
      mode = "local";
      onModeDetected("local");
      return "local";
    }

    function computeLocalRemaining(st) {
      if (st.status === "playing" && st.startedAt && !st.unlimitedTime) {
        const elapsed = Math.floor((Date.now() - st.startedAt) / 1000);
        return Math.max(0, st.durationSec - elapsed);
      }
      return st.remainingSec;
    }

    function emitLocal(broadcast = true) {
      localState.serverNow = Date.now();
      localState.remainingSec = computeLocalRemaining(localState);
      onStateUpdate(Object.assign({}, localState));
      if (broadcast && bc) {
        try {
          bc.postMessage({ type: "state", state: localState });
        } catch (_) {}
      }
    }

    function clearConnections() {
      if (eventSource) {
        eventSource.close();
        eventSource = null;
      }
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
      if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
      }
      if (bc) {
        try {
          bc.close();
        } catch (_) {}
        bc = null;
      }
    }

    function startPollingFallback(code) {
      if (pollTimer) return;
      pollTimer = setInterval(async () => {
        try {
          const res = await fetch(`/api/room/${encodeURIComponent(code)}/state`, { cache: "no-store" });
          if (res.ok) {
            const data = await res.json();
            onStateUpdate(data);
          }
        } catch (_) {}
      }, 1500);
    }

    async function joinRoom(code, role, name) {
      currentCode =
        String(code || "BNN-101")
          .trim()
          .toUpperCase()
          .replace(/[^A-Z0-9\-_]/g, "") || "BNN-101";

      clearConnections();

      if (mode === "checking") {
        await detectServer();
      }

      if (mode === "server") {
        try {
          const res = await fetch(`/api/room/${encodeURIComponent(currentCode)}/join`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ clientId, role, name })
          });
          const data = await res.json();
          onStateUpdate(data);

          eventSource = new EventSource(`/api/room/${encodeURIComponent(currentCode)}/events`);
          eventSource.onmessage = (ev) => {
            try {
              const parsed = JSON.parse(ev.data);
              onStateUpdate(parsed);
            } catch (_) {}
          };
          eventSource.onerror = () => {
            // Render or firewall proxy interrupted SSE: turn on polling fallback seamlessly
            startPollingFallback(currentCode);
          };

          heartbeatTimer = setInterval(() => {
            fetch(`/api/room/${encodeURIComponent(currentCode)}/action`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ type: "heartbeat", clientId, role })
            }).catch(() => {});
          }, 10000);
          return;
        } catch (_) {
          mode = "local";
          onModeDetected("local");
        }
      }

      // Local BroadcastChannel fallback
      localState.code = currentCode;
      localState.seed = currentCode;
      const existing = localState.players.find((p) => p.clientId === clientId);
      if (existing) {
        existing.role = role;
        existing.name = name;
      } else {
        localState.players.push({ clientId, role, name });
      }

      if (typeof BroadcastChannel !== "undefined") {
        bc = new BroadcastChannel("bnn_room_" + currentCode);
        bc.onmessage = (ev) => {
          if (ev.data && ev.data.type === "state") {
            localState = ev.data.state;
            onStateUpdate(Object.assign({}, localState));
          } else if (ev.data && ev.data.type === "hello") {
            if (!localState.players.some((p) => p.clientId === ev.data.player.clientId)) {
              localState.players.push(ev.data.player);
            }
            emitLocal(true);
          }
        };
        bc.postMessage({ type: "hello", player: { clientId, role, name } });
      }
      emitLocal(false);
    }

    async function sendAction(type, payload = {}) {
      if (mode === "server") {
        try {
          const res = await fetch(`/api/room/${encodeURIComponent(currentCode)}/action`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(Object.assign({ type, clientId }, payload))
          });
          const data = await res.json();
          onStateUpdate(data);
          return data;
        } catch (_) {}
      }

      const now = Date.now();
      if (type === "setConfig" && localState.status === "lobby") {
        Object.assign(localState, payload);
      } else if (type === "startGame") {
        localState.preset = payload.preset || localState.preset;
        if (Array.isArray(payload.selectedModuleIds) && payload.selectedModuleIds.length > 0) {
          localState.selectedModuleIds = payload.selectedModuleIds;
        }
        if (typeof payload.teamName === "string") localState.teamName = payload.teamName;
        localState.durationSec = payload.durationSec || localState.durationSec;
        localState.maxStrikes = payload.maxStrikes || localState.maxStrikes;
        localState.unlimitedTime = Boolean(payload.unlimitedTime);
        localState.safetyLockRequired = Boolean(payload.safetyLockRequired);
        localState.seed = payload.seed || currentCode;
        localState.strikes = 0;
        localState.solvedModules = [];
        localState.activeModuleIndex = 0;
        localState.safetyUnlockedFor = null;
        localState.mazePos = null;
        localState.radioFeed = [];
        localState.status = "playing";
        localState.startedAt = now;
        localState.endedAt = null;
        localState.endReason = "";
        localState.lastEvent = { id: now, type: "start", message: "拆彈任務開始！全員就位！" };
      } else if (type === "backToLobby") {
        localState.status = "lobby";
        localState.startedAt = null;
        localState.endedAt = null;
        localState.strikes = 0;
        localState.solvedModules = [];
        localState.safetyUnlockedFor = null;
        localState.mazePos = null;
      } else if (type === "selectModule") {
        localState.activeModuleIndex = Number(payload.moduleIndex || 0);
        localState.safetyUnlockedFor = null;
      } else if (type === "toggleSafetyLock") {
        const modId = payload.moduleId || null;
        localState.safetyUnlockedFor = localState.safetyUnlockedFor === modId ? null : modId;
        localState.lastEvent = {
          id: now,
          type: "safety",
          message: localState.safetyUnlockedFor ? "偵察員已解除安全插銷！" : "偵察員重新鎖上安全插銷"
        };
      } else if (type === "mazeMove") {
        localState.mazePos = payload.pos;
      } else if (type === "radioPing") {
        const msg = {
          id: `${now}`,
          senderName: payload.senderName || "隊友",
          senderRole: payload.senderRole || "",
          text: String(payload.text || "").slice(0, 60),
          at: now
        };
        localState.radioFeed.push(msg);
        if (localState.radioFeed.length > 10) localState.radioFeed.shift();
        localState.lastEvent = { id: now, type: "radio", message: `${msg.senderName}：${msg.text}` };
      } else if (type === "moduleSolved") {
        const modId = payload.moduleId;
        if (modId && !localState.solvedModules.includes(modId)) {
          localState.solvedModules.push(modId);
        }
        localState.safetyUnlockedFor = null;
        const total = Number(payload.totalModules || 4);
        if (localState.solvedModules.length >= total) {
          localState.status = "won";
          localState.endedAt = now;
          localState.endReason = "所有模組皆已解除，成功拯救香蕉炸彈實驗室！";
          localState.lastEvent = { id: now, type: "won", message: localState.endReason };
        } else {
          localState.lastEvent = { id: now, type: "defused", message: `模組 ${payload.moduleTitle || modId} 已成功解除！` };
        }
      } else if (type === "moduleStrike") {
        localState.strikes += 1;
        localState.safetyUnlockedFor = null;
        if (localState.strikes >= localState.maxStrikes) {
          localState.status = "lost";
          localState.endedAt = now;
          localState.endReason = `失誤達到 ${localState.maxStrikes} 次，香蕉炸彈變成香蕉泥了！`;
          localState.lastEvent = { id: now, type: "lost", message: localState.endReason };
        } else {
          localState.lastEvent = {
            id: now,
            type: "strike",
            message: `觸發失誤 (${localState.strikes}/${localState.maxStrikes})：${payload.reason || "操作錯誤"}`
          };
        }
      } else if (type === "timeout") {
        if (localState.status === "playing" && !localState.unlimitedTime) {
          localState.status = "lost";
          localState.endedAt = now;
          localState.endReason = "倒數時間歸零，香蕉炸彈引爆了！";
          localState.lastEvent = { id: now, type: "lost", message: localState.endReason };
        }
      }
      emitLocal(true);
      return localState;
    }

    async function fetchLeaderboard() {
      if (mode !== "server") return [];
      try {
        const res = await fetch("/api/leaderboard", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          return Array.isArray(data.entries) ? data.entries : [];
        }
      } catch (_) {}
      return [];
    }

    return {
      clientId,
      getMode: () => mode,
      detectServer,
      joinRoom,
      sendAction,
      fetchLeaderboard
    };
  }

  BNN.createSyncClient = createSyncClient;
})(window);
