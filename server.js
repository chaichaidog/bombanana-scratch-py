/**
 * BOMBANANA 程式拆彈實驗室 — 老師統一開房 + 統一職位輪流制後端伺服器
 * 零外部套件相依，支援 SSE 即時推播、輪詢容錯、職位自動輪替與拆彈排行榜
 */
const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");

const PORT = Number(process.env.PORT || 3000);
const PUBLIC_DIR = path.join(__dirname, "public");
const DATA_DIR = path.join(__dirname, "data");
const LEADERBOARD_FILE = path.join(DATA_DIR, "leaderboard.json");

const PRESET_MODULES = {
  mix: ["logic_gate", "big_button", "wire_array", "laser_maze"],
  party_all: ["logic_gate", "big_button", "loop_coolant", "laser_maze", "while_cooling", "morse_radio", "func_cipher"],
  code_only: ["logic_gate", "loop_coolant", "wire_array", "while_cooling"],
  minigame_only: ["big_button", "laser_maze", "morse_radio"],
  challenge_all: [
    "logic_gate",
    "loop_coolant",
    "wire_array",
    "while_cooling",
    "led_binary",
    "func_cipher",
    "big_button",
    "laser_maze",
    "morse_radio"
  ],
  unlimited: ["logic_gate", "big_button", "wire_array", "laser_maze"]
};

const PRESET_DEFAULTS = {
  mix: { durationSec: 420, unlimitedTime: false },
  party_all: { durationSec: 720, unlimitedTime: false },
  code_only: { durationSec: 480, unlimitedTime: false },
  minigame_only: { durationSec: 300, unlimitedTime: false },
  challenge_all: { durationSec: 900, unlimitedTime: false },
  unlimited: { durationSec: 420, unlimitedTime: true }
};

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon"
};

/** @type {Array<any>} */
let leaderboard = loadLeaderboard();

function loadLeaderboard() {
  try {
    if (fs.existsSync(LEADERBOARD_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(LEADERBOARD_FILE, "utf8"));
      if (Array.isArray(parsed)) return parsed.slice(0, 30);
    }
  } catch (_) {}
  return [];
}

function saveLeaderboard() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(LEADERBOARD_FILE, JSON.stringify(leaderboard.slice(0, 30), null, 2), "utf8");
  } catch (_) {}
}

function recordWinToLeaderboard(room, elapsedSec) {
  const names = Object.values(room.players)
    .map((p) => p.name)
    .filter(Boolean);
  const teamLabel = room.teamName || (names.length ? [...new Set(names)].join(" × ") : room.code);
  const entry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    team: String(teamLabel).slice(0, 40),
    roomCode: room.code,
    preset: room.preset,
    moduleCount: (room.selectedModuleIds || []).length || room.solvedModules.length,
    strikes: room.strikes,
    elapsedSec: Math.max(1, elapsedSec),
    unlimitedTime: Boolean(room.unlimitedTime),
    createdAt: new Date().toISOString()
  };
  leaderboard.unshift(entry);
  leaderboard.sort((a, b) => {
    if (b.moduleCount !== a.moduleCount) return b.moduleCount - a.moduleCount;
    if (a.strikes !== b.strikes) return a.strikes - b.strikes;
    return a.elapsedSec - b.elapsedSec;
  });
  leaderboard = leaderboard.slice(0, 20);
  saveLeaderboard();
}

/** @type {Map<string, any>} */
const rooms = new Map();

function normalizeCode(raw) {
  return String(raw || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9\-_]/g, "")
    .slice(0, 24);
}

function generateRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  for (let attempt = 0; attempt < 20; attempt++) {
    let code = "BNN-";
    for (let i = 0; i < 3; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    if (!rooms.has(code)) return code;
  }
  return "BNN-" + String(Date.now()).slice(-4);
}

function createRoomRecord(cfg) {
  const now = Date.now();
  const cleanCode = normalizeCode(cfg.code) || generateRoomCode();
  const preset = PRESET_DEFAULTS[cfg.preset] ? cfg.preset : "mix";
  const presetDef = PRESET_DEFAULTS[preset];
  const modules =
    Array.isArray(cfg.selectedModuleIds) && cfg.selectedModuleIds.length > 0
      ? cfg.selectedModuleIds.map(String).slice(0, 12)
      : (PRESET_MODULES[preset] || PRESET_MODULES.mix).slice();

  const existing = rooms.get(cleanCode);
  if (existing) {
    existing.teacherCreated = true;
    existing.teamName = String(cfg.teamName || existing.teamName || `小隊 ${cleanCode}`).trim().slice(0, 30);
    existing.preset = preset;
    existing.selectedModuleIds = modules;
    existing.durationSec =
      typeof cfg.durationSec === "number" && cfg.durationSec > 0 ? cfg.durationSec : presetDef.durationSec;
    existing.unlimitedTime =
      typeof cfg.unlimitedTime === "boolean" ? cfg.unlimitedTime : presetDef.unlimitedTime;
    existing.maxStrikes =
      typeof cfg.maxStrikes === "number" ? Math.max(1, Math.min(5, cfg.maxStrikes)) : existing.maxStrikes;
    existing.rotateRoles =
      typeof cfg.rotateRoles === "boolean" ? cfg.rotateRoles : existing.rotateRoles;
    existing.teacherOnlyStart =
      typeof cfg.teacherOnlyStart === "boolean" ? cfg.teacherOnlyStart : existing.teacherOnlyStart;
    existing.updatedAt = now;
    return existing;
  }

  const room = {
    code: cleanCode,
    seed: cleanCode,
    teacherCreated: true,
    teamName: String(cfg.teamName || `小隊 ${cleanCode}`).trim().slice(0, 30),
    preset,
    selectedModuleIds: modules,
    rotateRoles: cfg.rotateRoles !== false,
    teacherOnlyStart: Boolean(cfg.teacherOnlyStart),
    unlimitedTime: typeof cfg.unlimitedTime === "boolean" ? cfg.unlimitedTime : presetDef.unlimitedTime,
    durationSec: typeof cfg.durationSec === "number" && cfg.durationSec > 0 ? cfg.durationSec : presetDef.durationSec,
    maxStrikes: typeof cfg.maxStrikes === "number" ? Math.max(1, Math.min(5, cfg.maxStrikes)) : 3,
    strikes: 0,
    status: "lobby", // lobby | playing | won | lost | closed
    turnIndex: 0,
    startedAt: null,
    endedAt: null,
    endReason: "",
    activeModuleIndex: 0,
    solvedModules: [],
    mazePos: null,
    players: {},
    lastEvent: null,
    clients: new Set(),
    createdAt: now,
    updatedAt: now
  };
  rooms.set(cleanCode, room);
  return room;
}

function getOrderedPlayers(room) {
  const now = Date.now();
  for (const [cid, info] of Object.entries(room.players)) {
    if (now - info.lastSeen > 35000) {
      delete room.players[cid];
    }
  }
  return Object.values(room.players).sort((a, b) => {
    if ((a.joinedAt || 0) !== (b.joinedAt || 0)) return (a.joinedAt || 0) - (b.joinedAt || 0);
    return String(a.clientId).localeCompare(String(b.clientId));
  });
}

function serializeRoom(room) {
  const now = Date.now();
  const ordered = getOrderedPlayers(room);

  let remainingSec = room.durationSec;
  if (room.status === "playing" && room.startedAt && !room.unlimitedTime) {
    const elapsed = Math.floor((now - room.startedAt) / 1000);
    remainingSec = Math.max(0, room.durationSec - elapsed);
    if (remainingSec === 0) {
      room.status = "lost";
      room.endedAt = now;
      room.endReason = "倒數時間歸零，香蕉炸彈引爆了！";
      room.lastEvent = { id: now, type: "lost", message: room.endReason };
    }
  } else if ((room.status === "won" || room.status === "lost") && room.startedAt && room.endedAt && !room.unlimitedTime) {
    const elapsed = Math.floor((room.endedAt - room.startedAt) / 1000);
    remainingSec = Math.max(0, room.durationSec - elapsed);
  }

  let defuserClientId = null;
  if (ordered.length > 0) {
    const idx = room.rotateRoles ? (room.turnIndex || 0) % ordered.length : 0;
    defuserClientId = ordered[idx].clientId;
  }

  return {
    code: room.code,
    seed: room.seed,
    teacherCreated: Boolean(room.teacherCreated),
    teamName: room.teamName,
    preset: room.preset,
    selectedModuleIds: room.selectedModuleIds,
    rotateRoles: Boolean(room.rotateRoles),
    teacherOnlyStart: Boolean(room.teacherOnlyStart),
    unlimitedTime: Boolean(room.unlimitedTime),
    durationSec: room.durationSec,
    maxStrikes: room.maxStrikes,
    strikes: room.strikes,
    status: room.status,
    turnIndex: room.turnIndex || 0,
    defuserClientId,
    startedAt: room.startedAt,
    endedAt: room.endedAt,
    remainingSec,
    serverNow: now,
    endReason: room.endReason,
    activeModuleIndex: room.activeModuleIndex,
    solvedModules: room.solvedModules,
    mazePos: room.mazePos,
    players: ordered.map((p) => ({
      clientId: p.clientId,
      name: p.name,
      ready: Boolean(p.ready),
      turnRole: p.clientId === defuserClientId ? "defuser" : "manual"
    })),
    lastEvent: room.lastEvent,
    createdAt: room.createdAt
  };
}

function broadcastRoom(room) {
  const payload = `data: ${JSON.stringify(serializeRoom(room))}\n\n`;
  for (const res of room.clients) {
    try {
      res.write(payload);
    } catch (_) {
      room.clients.delete(res);
    }
  }
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 1024 * 64) {
        reject(new Error("Payload too large"));
      }
    });
    req.on("end", () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

function sendJson(res, status, obj) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(obj));
}

function serveStatic(req, res, pathname) {
  let targetPath = pathname === "/" ? "/index.html" : pathname;
  try {
    targetPath = decodeURIComponent(targetPath);
  } catch (_) {
    res.writeHead(400);
    res.end("Bad Request");
    return;
  }
  const resolved = path.resolve(PUBLIC_DIR, "." + targetPath);
  if (!resolved.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.stat(resolved, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404);
      res.end("Not Found");
      return;
    }
    const ext = path.extname(resolved).toLowerCase();
    const mime = MIME_TYPES[ext] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": mime, "Cache-Control": "no-store" });
    fs.createReadStream(resolved).pipe(res);
  });
}

const server = http.createServer(async (req, res) => {
  const reqUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const pathname = reqUrl.pathname;

  if (pathname === "/api/health" && req.method === "GET") {
    return sendJson(res, 200, { ok: true, mode: "cloud-server", now: Date.now() });
  }

  if (pathname === "/api/leaderboard" && req.method === "GET") {
    return sendJson(res, 200, { entries: leaderboard });
  }

  // ==================== 老師控制台 API ====================
  if (pathname === "/api/rooms" && req.method === "GET") {
    const list = [];
    for (const room of rooms.values()) {
      if (room.teacherCreated && room.status !== "closed") {
        list.push(serializeRoom(room));
      }
    }
    list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    return sendJson(res, 200, { rooms: list });
  }

  if (pathname === "/api/teacher/room" && req.method === "POST") {
    try {
      const body = await readJsonBody(req);
      const room = createRoomRecord(body || {});
      broadcastRoom(room);
      return sendJson(res, 200, { ok: true, room: serializeRoom(room) });
    } catch (e) {
      return sendJson(res, 400, { error: e.message });
    }
  }

  if (pathname === "/api/teacher/rooms/batch" && req.method === "POST") {
    try {
      const body = await readJsonBody(req);
      const count = Math.max(1, Math.min(15, Number(body.count || 4)));
      const prefix = normalizeCode(body.prefix || "TEAM") || "TEAM";
      const created = [];
      for (let i = 1; i <= count; i++) {
        const num = String(i).padStart(2, "0");
        const code = `${prefix}-${num}`;
        const room = createRoomRecord({
          code,
          teamName: `第 ${i} 小隊`,
          preset: body.preset,
          selectedModuleIds: body.selectedModuleIds,
          durationSec: body.durationSec,
          unlimitedTime: body.unlimitedTime,
          maxStrikes: body.maxStrikes,
          rotateRoles: body.rotateRoles,
          teacherOnlyStart: body.teacherOnlyStart
        });
        broadcastRoom(room);
        created.push(serializeRoom(room));
      }
      return sendJson(res, 200, { ok: true, rooms: created });
    } catch (e) {
      return sendJson(res, 400, { error: e.message });
    }
  }

  const delMatch = pathname.match(/^\/api\/teacher\/room\/([^/]+)$/);
  if (delMatch && req.method === "DELETE") {
    const code = normalizeCode(decodeURIComponent(delMatch[1]));
    const room = rooms.get(code);
    if (!room) {
      return sendJson(res, 404, { error: "ROOM_NOT_FOUND", message: "找不到此房間" });
    }
    room.status = "closed";
    room.lastEvent = { id: Date.now(), type: "closed", message: "老師已關閉此房間" };
    broadcastRoom(room);
    for (const clientRes of room.clients) {
      try {
        clientRes.end();
      } catch (_) {}
    }
    room.clients.clear();
    rooms.delete(code);
    return sendJson(res, 200, { ok: true });
  }

  // ==================== 房間連線 & 遊戲動作 API ====================
  const roomMatch = pathname.match(/^\/api\/room\/([^/]+)\/(events|join|leave|action|state)$/);
  if (roomMatch) {
    const code = normalizeCode(decodeURIComponent(roomMatch[1]));
    const endpoint = roomMatch[2];
    const room = rooms.get(code);

    if (!room || !room.teacherCreated) {
      return sendJson(res, 404, {
        error: "ROOM_NOT_FOUND",
        message: `找不到房號「${code || "(空白)"}」，請向老師確認房號（或由老師先在控制台建立房間）`
      });
    }

    if (endpoint === "events" && req.method === "GET") {
      res.writeHead(200, {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no"
      });
      room.clients.add(res);
      res.write(`data: ${JSON.stringify(serializeRoom(room))}\n\n`);

      const keepAlive = setInterval(() => {
        try {
          res.write(": ping\n\n");
        } catch (_) {
          clearInterval(keepAlive);
        }
      }, 12000);

      req.on("close", () => {
        clearInterval(keepAlive);
        room.clients.delete(res);
      });
      return;
    }

    if (endpoint === "state" && req.method === "GET") {
      return sendJson(res, 200, serializeRoom(room));
    }

    if (endpoint === "join" && req.method === "POST") {
      try {
        const body = await readJsonBody(req);
        const clientId = String(body.clientId || "anon").slice(0, 48);
        const cleanName = String(body.name || "").trim().slice(0, 20) || "隊員";
        const now = Date.now();
        const existing = room.players[clientId];
        room.players[clientId] = {
          clientId,
          name: cleanName,
          ready: existing ? Boolean(existing.ready) : false,
          joinedAt: existing ? existing.joinedAt : now,
          lastSeen: now
        };
        room.updatedAt = now;
        broadcastRoom(room);
        return sendJson(res, 200, serializeRoom(room));
      } catch (e) {
        return sendJson(res, 400, { error: e.message });
      }
    }

    if (endpoint === "leave" && req.method === "POST") {
      try {
        const body = await readJsonBody(req);
        const clientId = String(body.clientId || "").slice(0, 48);
        if (clientId && room.players[clientId]) {
          delete room.players[clientId];
          room.updatedAt = Date.now();
          broadcastRoom(room);
        }
        return sendJson(res, 200, { ok: true });
      } catch (e) {
        return sendJson(res, 400, { error: e.message });
      }
    }

    if (endpoint === "action" && req.method === "POST") {
      try {
        const body = await readJsonBody(req);
        const type = body.type;
        const now = Date.now();
        room.updatedAt = now;

        if (body.clientId && room.players[body.clientId]) {
          room.players[body.clientId].lastSeen = now;
        }

        if (type === "heartbeat") {
          return sendJson(res, 200, serializeRoom(room));
        } else if (type === "toggleReady") {
          if (room.status === "lobby" && body.clientId && room.players[body.clientId]) {
            room.players[body.clientId].ready = !room.players[body.clientId].ready;
          }
        } else if (type === "startGame") {
          if (room.teacherOnlyStart && !body.asTeacher) {
            return sendJson(res, 403, {
              error: "TEACHER_ONLY_START",
              message: "此房間已設為「由老師統一開始」，請等待老師啟動喔！"
            });
          }
          room.seed = String(body.seed || `${room.code}-${Math.floor(now / 1000) % 10000}`);
          room.strikes = 0;
          room.solvedModules = [];
          room.activeModuleIndex = 0;
          room.turnIndex = 0;
          room.mazePos = null;
          room.status = "playing";
          room.startedAt = now;
          room.endedAt = null;
          room.endReason = "";
          const ordered = getOrderedPlayers(room);
          const firstName = ordered[0] ? ordered[0].name : "隊員";
          room.lastEvent = {
            id: now,
            type: "start",
            message: `拆彈開始！第 1 關由「${firstName}」擔任拆彈手！`
          };
        } else if (type === "backToLobby") {
          room.status = "lobby";
          room.startedAt = null;
          room.endedAt = null;
          room.strikes = 0;
          room.solvedModules = [];
          room.activeModuleIndex = 0;
          room.turnIndex = 0;
          room.mazePos = null;
          room.endReason = "";
          for (const p of Object.values(room.players)) {
            p.ready = false;
          }
          room.lastEvent = { id: now, type: "lobby", message: "已回到房間等待室" };
        } else if (type === "selectModule") {
          room.activeModuleIndex = Math.max(0, Number(body.moduleIndex || 0));
        } else if (type === "rotateTurn") {
          const ordered = getOrderedPlayers(room);
          if (ordered.length >= 2) {
            room.turnIndex = (room.turnIndex || 0) + 1;
            const nextDefuser = ordered[room.turnIndex % ordered.length];
            room.lastEvent = {
              id: now,
              type: "rotate",
              nextDefuserName: nextDefuser.name,
              message: `🔄 職位輪流！現在換「${nextDefuser.name}」擔任拆彈手！`
            };
          }
        } else if (type === "mazeMove") {
          if (body.pos && typeof body.pos.x === "number" && typeof body.pos.y === "number") {
            room.mazePos = { x: body.pos.x, y: body.pos.y };
          }
        } else if (type === "moduleSolved") {
          const modId = String(body.moduleId || "");
          if (modId && !room.solvedModules.includes(modId)) {
            room.solvedModules.push(modId);
          }
          const modList = room.selectedModuleIds || [];
          const totalModules = Number(body.totalModules || modList.length || 4);
          if (room.solvedModules.length >= totalModules) {
            room.status = "won";
            room.endedAt = now;
            room.endReason = "所有關卡皆已解除，成功拯救實驗室！";
            room.lastEvent = { id: now, type: "won", message: room.endReason };
            const elapsedSec = room.startedAt ? Math.floor((now - room.startedAt) / 1000) : 1;
            recordWinToLeaderboard(room, elapsedSec);
          } else {
            // Auto advance to next unsolved module
            const nextIdx = modList.findIndex((id) => !room.solvedModules.includes(id));
            if (nextIdx >= 0) {
              room.activeModuleIndex = nextIdx;
            }
            const ordered = getOrderedPlayers(room);
            if (room.rotateRoles && ordered.length >= 2) {
              room.turnIndex = (room.turnIndex || 0) + 1;
              const nextDefuser = ordered[room.turnIndex % ordered.length];
              room.lastEvent = {
                id: now,
                type: "defused",
                rotated: true,
                nextDefuserName: nextDefuser.name,
                message: `${body.moduleTitle || modId} 已解除！🔄 輪到「${nextDefuser.name}」當拆彈手！`
              };
            } else {
              room.lastEvent = {
                id: now,
                type: "defused",
                rotated: false,
                message: `${body.moduleTitle || modId} 已成功解除！`
              };
            }
          }
        } else if (type === "moduleStrike") {
          room.strikes += 1;
          if (room.strikes >= room.maxStrikes) {
            room.status = "lost";
            room.endedAt = now;
            room.endReason = `失誤達到 ${room.maxStrikes} 次，香蕉炸彈引爆了！`;
            room.lastEvent = { id: now, type: "lost", message: room.endReason };
          } else {
            room.lastEvent = {
              id: now,
              type: "strike",
              message: `失誤 (${room.strikes}/${room.maxStrikes})：${body.reason || "操作錯誤"}`
            };
          }
        } else if (type === "timeout") {
          if (room.status === "playing" && !room.unlimitedTime) {
            room.status = "lost";
            room.endedAt = now;
            room.endReason = "倒數時間歸零，香蕉炸彈引爆了！";
            room.lastEvent = { id: now, type: "lost", message: room.endReason };
          }
        }

        broadcastRoom(room);
        return sendJson(res, 200, serializeRoom(room));
      } catch (e) {
        return sendJson(res, 400, { error: e.message });
      }
    }
  }

  serveStatic(req, res, pathname);
});

setInterval(() => {
  const cutoff = Date.now() - 4 * 60 * 60 * 1000;
  for (const [code, room] of rooms.entries()) {
    if (room.updatedAt < cutoff && room.clients.size === 0 && Object.keys(room.players).length === 0) {
      rooms.delete(code);
    }
  }
}, 10 * 60 * 1000);

function getLanIPs() {
  const nets = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === "IPv4" && !net.internal) {
        ips.push(net.address);
      }
    }
  }
  return ips;
}

server.listen(PORT, "0.0.0.0", () => {
  console.log("");
  console.log("=========================================================");
  console.log("  🍌 BOMBANANA 程式拆彈實驗室 (老師統一開房 + 輪流制後端)");
  console.log("=========================================================");
  console.log(`  ▶ 本機網址: http://localhost:${PORT}`);
  const ips = getLanIPs();
  if (ips.length > 0) {
    ips.forEach((ip) => {
      console.log(`  ▶ 教室區網連線: http://${ip}:${PORT}`);
    });
  }
  console.log("=========================================================");
  console.log("");
});

function shutdown() {
  server.close(() => process.exit(0));
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
