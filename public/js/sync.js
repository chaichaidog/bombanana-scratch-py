/**
 * sync.js — Render 雲端 / 區網即時同步 + 老師統一開房 API + 輪流制同步
 */
(function (global) {
  const BNN = (global.BNN = global.BNN || {});
  const LOCAL_ROOMS_KEY = "bnn_local_teacher_rooms_v2";

  function makeClientId() {
    const stored = global.sessionStorage && global.sessionStorage.getItem("bnn_cid");
    if (stored) return stored;
    const id = "c_" + Math.random().toString(36).slice(2, 10);
    try {
      global.sessionStorage.setItem("bnn_cid", id);
    } catch (_) {}
    return id;
  }

  function normalizeCode(raw) {
    return String(raw || "")
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9\-_]/g, "")
      .slice(0, 24);
  }

  function readLocalRoomsMap() {
    try {
      const raw = global.localStorage && global.localStorage.getItem(LOCAL_ROOMS_KEY);
      if (raw) return JSON.parse(raw);
    } catch (_) {}
    return {};
  }

  function writeLocalRoomsMap(map) {
    try {
      global.localStorage.setItem(LOCAL_ROOMS_KEY, JSON.stringify(map));
    } catch (_) {}
  }

  function createSyncClient(onStateUpdate, onModeDetected) {
    const clientId = makeClientId();
    let mode = "checking"; // checking | server | local
    let currentCode = "";
    let eventSource = null;
    let pollTimer = null;
    let heartbeatTimer = null;
    let bc = null;
    let localState = null;

    async function detectServer() {
      if (global.location && global.location.protocol === "file:") {
        mode = "local";
        onModeDetected("local");
        return "local";
      }
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 1800);
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

    function computeLocalRemaining(st) {
      if (st.status === "playing" && st.startedAt && !st.unlimitedTime) {
        const elapsed = Math.floor((Date.now() - st.startedAt) / 1000);
        return Math.max(0, st.durationSec - elapsed);
      }
      return st.remainingSec;
    }

    function serializeLocalRoom(st) {
      const copy = JSON.parse(JSON.stringify(st));
      copy.serverNow = Date.now();
      copy.remainingSec = computeLocalRemaining(copy);
      const players = copy.players || [];
      let defuserId = null;
      if (players.length > 0) {
        const idx = copy.rotateRoles ? (copy.turnIndex || 0) % players.length : 0;
        defuserId = players[idx].clientId;
      }
      copy.defuserClientId = defuserId;
      copy.players = players.map((p) => ({
        clientId: p.clientId,
        name: p.name,
        ready: Boolean(p.ready),
        turnRole: p.clientId === defuserId ? "defuser" : "manual"
      }));
      return copy;
    }

    function saveAndEmitLocal(st, broadcast = true) {
      const map = readLocalRoomsMap();
      map[st.code] = st;
      writeLocalRoomsMap(map);
      localState = st;
      const serialized = serializeLocalRoom(st);
      onStateUpdate(serialized);
      if (broadcast && bc) {
        try {
          bc.postMessage({ type: "state", state: st });
        } catch (_) {}
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
          } else if (res.status === 404) {
            onStateUpdate({ code, status: "closed", endReason: "房間已被老師刪除或關閉" });
            clearConnections();
          }
        } catch (_) {}
      }, 1500);
    }

    async function joinRoom(code, name) {
      const cleanCode = normalizeCode(code);
      if (!cleanCode) {
        return { ok: false, error: "INVALID_CODE", message: "請輸入老師給的房號！" };
      }

      clearConnections();
      currentCode = cleanCode;

      if (mode === "checking") {
        await detectServer();
      }

      if (mode === "server") {
        try {
          const res = await fetch(`/api/room/${encodeURIComponent(cleanCode)}/join`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ clientId, name: String(name || "").trim() })
          });
          const data = await res.json();
          if (!res.ok) {
            currentCode = "";
            return {
              ok: false,
              error: data.error || "JOIN_FAILED",
              message: data.message || "找不到此房號，請確認老師給的房號！"
            };
          }

          onStateUpdate(data);

          eventSource = new EventSource(`/api/room/${encodeURIComponent(cleanCode)}/events`);
          eventSource.onmessage = (ev) => {
            try {
              const parsed = JSON.parse(ev.data);
              onStateUpdate(parsed);
            } catch (_) {}
          };
          eventSource.onerror = () => {
            startPollingFallback(cleanCode);
          };

          heartbeatTimer = setInterval(() => {
            fetch(`/api/room/${encodeURIComponent(cleanCode)}/action`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ type: "heartbeat", clientId })
            }).catch(() => {});
          }, 10000);

          return { ok: true, state: data };
        } catch (_) {
          currentCode = "";
          return { ok: false, error: "NETWORK_ERROR", message: "連線伺服器失敗，請稍後重試！" };
        }
      }

      // Local fallback mode (when running file:// without server)
      const map = readLocalRoomsMap();
      const found = map[cleanCode];
      if (!found || !found.teacherCreated) {
        currentCode = "";
        return {
          ok: false,
          error: "ROOM_NOT_FOUND",
          message: `找不到房號「${cleanCode}」，請先請老師在控制台建立房間！`
        };
      }

      found.players = found.players || [];
      const existing = found.players.find((p) => p.clientId === clientId);
      const cleanName = String(name || "").trim() || "隊員";
      if (existing) {
        existing.name = cleanName;
      } else {
        found.players.push({ clientId, name: cleanName, ready: false, joinedAt: Date.now() });
      }

      if (typeof BroadcastChannel !== "undefined") {
        bc = new BroadcastChannel("bnn_room_" + cleanCode);
        bc.onmessage = (ev) => {
          if (ev.data && ev.data.type === "state") {
            localState = ev.data.state;
            onStateUpdate(serializeLocalRoom(localState));
          } else if (ev.data && ev.data.type === "hello") {
            if (!localState.players.some((p) => p.clientId === ev.data.player.clientId)) {
              localState.players.push(ev.data.player);
            }
            saveAndEmitLocal(localState, true);
          }
        };
        bc.postMessage({ type: "hello", player: { clientId, name: cleanName, ready: false } });
      }

      saveAndEmitLocal(found, true);
      return { ok: true, state: serializeLocalRoom(found) };
    }

    async function leaveRoom() {
      const leavingCode = currentCode;
      clearConnections();
      currentCode = "";
      localState = null;

      if (!leavingCode) return;

      if (mode === "server") {
        try {
          await fetch(`/api/room/${encodeURIComponent(leavingCode)}/leave`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ clientId })
          });
        } catch (_) {}
      } else {
        const map = readLocalRoomsMap();
        const found = map[leavingCode];
        if (found) {
          found.players = (found.players || []).filter((p) => p.clientId !== clientId);
          map[leavingCode] = found;
          writeLocalRoomsMap(map);
        }
      }
    }

    async function sendAction(type, payload = {}) {
      if (!currentCode) return null;
      if (mode === "server") {
        try {
          const res = await fetch(`/api/room/${encodeURIComponent(currentCode)}/action`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(Object.assign({ type, clientId }, payload))
          });
          const data = await res.json();
          if (res.ok) {
            onStateUpdate(data);
          }
          return data;
        } catch (_) {
          return null;
        }
      }

      if (!localState) return null;
      const now = Date.now();
      if (type === "toggleReady") {
        const me = (localState.players || []).find((p) => p.clientId === clientId);
        if (me) me.ready = !me.ready;
      } else if (type === "startGame") {
        if (localState.teacherOnlyStart && !payload.asTeacher) {
          return { error: "TEACHER_ONLY_START", message: "此房間已設為「由老師統一開始」喔！" };
        }
        localState.seed = payload.seed || `${localState.code}-${Math.floor(now / 1000) % 10000}`;
        localState.strikes = 0;
        localState.solvedModules = [];
        localState.activeModuleIndex = 0;
        localState.turnIndex = 0;
        localState.mazePos = null;
        localState.status = "playing";
        localState.startedAt = now;
        localState.endedAt = null;
        localState.endReason = "";
        localState.lastEvent = { id: now, type: "start", message: "拆彈任務開始！" };
      } else if (type === "backToLobby") {
        localState.status = "lobby";
        localState.startedAt = null;
        localState.endedAt = null;
        localState.strikes = 0;
        localState.solvedModules = [];
        localState.activeModuleIndex = 0;
        localState.turnIndex = 0;
        localState.mazePos = null;
        (localState.players || []).forEach((p) => {
          p.ready = false;
        });
      } else if (type === "selectModule") {
        localState.activeModuleIndex = Math.max(0, Number(payload.moduleIndex || 0));
      } else if (type === "rotateTurn") {
        if ((localState.players || []).length >= 2) {
          localState.turnIndex = (localState.turnIndex || 0) + 1;
          const nextDef = localState.players[localState.turnIndex % localState.players.length];
          localState.lastEvent = {
            id: now,
            type: "rotate",
            nextDefuserName: nextDef.name,
            message: `🔄 職位輪流！現在換「${nextDef.name}」擔任拆彈手！`
          };
        }
      } else if (type === "mazeMove") {
        localState.mazePos = payload.pos;
      } else if (type === "moduleSolved") {
        const modId = payload.moduleId;
        if (modId && !localState.solvedModules.includes(modId)) {
          localState.solvedModules.push(modId);
        }
        const total = Number(payload.totalModules || (localState.selectedModuleIds || []).length || 4);
        if (localState.solvedModules.length >= total) {
          localState.status = "won";
          localState.endedAt = now;
          localState.endReason = "所有關卡皆已解除，成功拯救實驗室！";
          localState.lastEvent = { id: now, type: "won", message: localState.endReason };
        } else {
          const nextIdx = (localState.selectedModuleIds || []).findIndex((id) => !localState.solvedModules.includes(id));
          if (nextIdx >= 0) localState.activeModuleIndex = nextIdx;
          if (localState.rotateRoles && (localState.players || []).length >= 2) {
            localState.turnIndex = (localState.turnIndex || 0) + 1;
            const nextDef = localState.players[localState.turnIndex % localState.players.length];
            localState.lastEvent = {
              id: now,
              type: "defused",
              rotated: true,
              nextDefuserName: nextDef.name,
              message: `${payload.moduleTitle || modId} 已解除！🔄 輪到「${nextDef.name}」當拆彈手！`
            };
          } else {
            localState.lastEvent = { id: now, type: "defused", rotated: false, message: `${payload.moduleTitle || modId} 已成功解除！` };
          }
        }
      } else if (type === "moduleStrike") {
        localState.strikes += 1;
        if (localState.strikes >= localState.maxStrikes) {
          localState.status = "lost";
          localState.endedAt = now;
          localState.endReason = `失誤達到 ${localState.maxStrikes} 次，香蕉炸彈引爆了！`;
          localState.lastEvent = { id: now, type: "lost", message: localState.endReason };
        } else {
          localState.lastEvent = {
            id: now,
            type: "strike",
            message: `失誤 (${localState.strikes}/${localState.maxStrikes})：${payload.reason || "操作錯誤"}`
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

      saveAndEmitLocal(localState, true);
      return serializeLocalRoom(localState);
    }

    // ==================== 老師控制台專用 API ====================
    async function fetchRooms() {
      if (mode === "checking") await detectServer();
      if (mode === "server") {
        try {
          const res = await fetch("/api/rooms", { cache: "no-store" });
          const data = await res.json();
          return data.rooms || [];
        } catch (_) {
          return [];
        }
      }
      const map = readLocalRoomsMap();
      return Object.values(map)
        .filter((r) => r.teacherCreated && r.status !== "closed")
        .map(serializeLocalRoom)
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    }

    async function saveTeacherRoom(cfg) {
      if (mode === "checking") await detectServer();
      if (mode === "server") {
        const res = await fetch("/api/teacher/room", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(cfg)
        });
        return res.json();
      }
      const map = readLocalRoomsMap();
      const now = Date.now();
      const code = normalizeCode(cfg.code) || "BNN-101";
      const room = Object.assign(
        {
          code,
          seed: code,
          teacherCreated: true,
          teamName: cfg.teamName || `小隊 ${code}`,
          preset: cfg.preset || "mix",
          selectedModuleIds: cfg.selectedModuleIds || ["logic_gate", "big_button", "wire_array", "laser_maze"],
          rotateRoles: cfg.rotateRoles !== false,
          teacherOnlyStart: Boolean(cfg.teacherOnlyStart),
          unlimitedTime: Boolean(cfg.unlimitedTime),
          durationSec: cfg.durationSec || 420,
          maxStrikes: cfg.maxStrikes || 3,
          strikes: 0,
          status: "lobby",
          turnIndex: 0,
          startedAt: null,
          endedAt: null,
          endReason: "",
          activeModuleIndex: 0,
          solvedModules: [],
          mazePos: null,
          players: [],
          lastEvent: null,
          createdAt: now
        },
        map[code] || {},
        {
          teacherCreated: true,
          teamName: cfg.teamName || `小隊 ${code}`,
          preset: cfg.preset || "mix",
          selectedModuleIds: cfg.selectedModuleIds || ["logic_gate", "big_button", "wire_array", "laser_maze"],
          rotateRoles: cfg.rotateRoles !== false,
          teacherOnlyStart: Boolean(cfg.teacherOnlyStart),
          unlimitedTime: Boolean(cfg.unlimitedTime),
          durationSec: cfg.durationSec || 420
        }
      );
      map[code] = room;
      writeLocalRoomsMap(map);
      return { ok: true, room: serializeLocalRoom(room) };
    }

    async function batchCreateRooms(cfg) {
      if (mode === "checking") await detectServer();
      if (mode === "server") {
        const res = await fetch("/api/teacher/rooms/batch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(cfg)
        });
        return res.json();
      }
      const created = [];
      const count = Math.max(1, Math.min(15, Number(cfg.count || 4)));
      const prefix = normalizeCode(cfg.prefix || "TEAM") || "TEAM";
      for (let i = 1; i <= count; i++) {
        const code = `${prefix}-${String(i).padStart(2, "0")}`;
        const r = await saveTeacherRoom(Object.assign({}, cfg, { code, teamName: `第 ${i} 小隊` }));
        if (r && r.room) created.push(r.room);
      }
      return { ok: true, rooms: created };
    }

    async function deleteTeacherRoom(code) {
      if (mode === "server") {
        const res = await fetch(`/api/teacher/room/${encodeURIComponent(code)}`, { method: "DELETE" });
        return res.json();
      }
      const map = readLocalRoomsMap();
      delete map[normalizeCode(code)];
      writeLocalRoomsMap(map);
      return { ok: true };
    }

    async function teacherAction(code, type, payload = {}) {
      if (mode === "server") {
        const res = await fetch(`/api/room/${encodeURIComponent(code)}/action`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(Object.assign({ type, asTeacher: true }, payload))
        });
        return res.json();
      }
      const map = readLocalRoomsMap();
      const room = map[normalizeCode(code)];
      if (!room) return { error: "ROOM_NOT_FOUND" };
      const now = Date.now();
      if (type === "startGame") {
        room.seed = `${room.code}-${Math.floor(now / 1000) % 10000}`;
        room.strikes = 0;
        room.solvedModules = [];
        room.activeModuleIndex = 0;
        room.turnIndex = 0;
        room.mazePos = null;
        room.status = "playing";
        room.startedAt = now;
        room.endedAt = null;
        room.endReason = "";
      } else if (type === "backToLobby") {
        room.status = "lobby";
        room.startedAt = null;
        room.endedAt = null;
        room.strikes = 0;
        room.solvedModules = [];
        room.activeModuleIndex = 0;
        room.turnIndex = 0;
        room.mazePos = null;
      }
      map[room.code] = room;
      writeLocalRoomsMap(map);
      if (typeof BroadcastChannel !== "undefined") {
        const ch = new BroadcastChannel("bnn_room_" + room.code);
        ch.postMessage({ type: "state", state: room });
        ch.close();
      }
      return serializeLocalRoom(room);
    }

    async function fetchLeaderboard() {
      if (mode !== "server") return [];
      try {
        const res = await fetch("/api/leaderboard", { cache: "no-store" });
        const data = await res.json();
        return data.entries || [];
      } catch (_) {
        return [];
      }
    }

    return {
      getClientId: () => clientId,
      getMode: () => mode,
      detectServer,
      joinRoom,
      leaveRoom,
      sendAction,
      fetchRooms,
      saveTeacherRoom,
      batchCreateRooms,
      deleteTeacherRoom,
      teacherAction,
      fetchLeaderboard
    };
  }

  BNN.createSyncClient = createSyncClient;
})(window);
