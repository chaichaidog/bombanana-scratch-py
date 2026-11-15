/**
 * BOMBANANA 程式拆彈實驗室 — 區網 / Render 雲端多人同步後端伺服器
 * 零外部套件相依，支援 SSE 即時推播、輪詢容錯、快速無線電喊話、雙人安全鎖與拆彈排行榜
 */
const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");

const PORT = Number(process.env.PORT || 3000);
const PUBLIC_DIR = path.join(__dirname, "public");
const DATA_DIR = path.join(__dirname, "data");
const LEADERBOARD_FILE = path.join(DATA_DIR, "leaderboard.json");

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
  const teamLabel = room.teamName || (names.length ? [...new Set(names)].join(" × ") : "神秘特務小隊");
  const entry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    team: String(teamLabel).slice(0, 40),
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
  return (
    String(raw || "BNN-101")
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9\-_]/g, "")
      .slice(0, 24) || "BNN-101"
  );
}

function getOrCreateRoom(code) {
  const cleanCode = normalizeCode(code);
  if (!rooms.has(cleanCode)) {
    rooms.set(cleanCode, {
      code: cleanCode,
      seed: cleanCode,
      teamName: "",
      preset: "mix",
      selectedModuleIds: ["logic_gate", "big_button", "wire_array", "laser_maze"],
      safetyLockRequired: true,
      unlimitedTime: false,
      durationSec: 420,
      maxStrikes: 3,
      strikes: 0,
      status: "lobby", // lobby | playing | won | lost
      startedAt: null,
      endedAt: null,
      endReason: "",
      activeModuleIndex: 0,
      solvedModules: [],
      safetyUnlockedFor: null,
      mazePos: null,
      players: {},
      lastEvent: null,
      radioFeed: [],
      clients: new Set(),
      updatedAt: Date.now()
    });
  }
  return rooms.get(cleanCode);
}

function serializeRoom(room) {
  const now = Date.now();
  for (const [cid, info] of Object.entries(room.players)) {
    if (now - info.lastSeen > 35000) {
      delete room.players[cid];
    }
  }
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

  return {
    code: room.code,
    seed: room.seed,
    teamName: room.teamName,
    preset: room.preset,
    selectedModuleIds: room.selectedModuleIds,
    safetyLockRequired: room.safetyLockRequired,
    unlimitedTime: room.unlimitedTime,
    durationSec: room.durationSec,
    maxStrikes: room.maxStrikes,
    strikes: room.strikes,
    status: room.status,
    startedAt: room.startedAt,
    endedAt: room.endedAt,
    remainingSec,
    serverNow: now,
    endReason: room.endReason,
    activeModuleIndex: room.activeModuleIndex,
    solvedModules: room.solvedModules,
    safetyUnlockedFor: room.safetyUnlockedFor,
    mazePos: room.mazePos,
    players: Object.values(room.players).map((p) => ({
      clientId: p.clientId,
      role: p.role,
      name: p.name
    })),
    lastEvent: room.lastEvent,
    radioFeed: room.radioFeed.slice(-6)
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

  const roomMatch = pathname.match(/^\/api\/room\/([^/]+)\/(events|join|action|state)$/);
  if (roomMatch) {
    const code = normalizeCode(decodeURIComponent(roomMatch[1]));
    const endpoint = roomMatch[2];
    const room = getOrCreateRoom(code);

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
        room.players[clientId] = {
          clientId,
          role: String(body.role || "coop"),
          name: String(body.name || "隊員").slice(0, 20),
          lastSeen: Date.now()
        };
        room.updatedAt = Date.now();
        broadcastRoom(room);
        return sendJson(res, 200, serializeRoom(room));
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
          if (body.role) room.players[body.clientId].role = String(body.role);
        }

        if (type === "heartbeat") {
          return sendJson(res, 200, serializeRoom(room));
        } else if (type === "setConfig") {
          if (room.status === "lobby") {
            if (body.preset) room.preset = String(body.preset);
            if (Array.isArray(body.selectedModuleIds) && body.selectedModuleIds.length > 0) {
              room.selectedModuleIds = body.selectedModuleIds.map(String).slice(0, 10);
            }
            if (typeof body.durationSec === "number") room.durationSec = body.durationSec;
            if (typeof body.maxStrikes === "number") room.maxStrikes = Math.max(1, Math.min(5, body.maxStrikes));
            if (typeof body.unlimitedTime === "boolean") room.unlimitedTime = body.unlimitedTime;
            if (typeof body.safetyLockRequired === "boolean") room.safetyLockRequired = body.safetyLockRequired;
            if (typeof body.teamName === "string") room.teamName = body.teamName.trim().slice(0, 30);
          }
        } else if (type === "startGame") {
          room.preset = String(body.preset || room.preset);
          if (Array.isArray(body.selectedModuleIds) && body.selectedModuleIds.length > 0) {
            room.selectedModuleIds = body.selectedModuleIds.map(String).slice(0, 10);
          }
          if (typeof body.teamName === "string") room.teamName = body.teamName.trim().slice(0, 30);
          room.durationSec = Number(body.durationSec || room.durationSec || 420);
          room.maxStrikes = Number(body.maxStrikes || room.maxStrikes || 3);
          room.unlimitedTime = Boolean(body.unlimitedTime);
          room.safetyLockRequired = Boolean(body.safetyLockRequired);
          room.seed = String(body.seed || `${room.code}-${Math.floor(now / 1000) % 10000}`);
          room.strikes = 0;
          room.solvedModules = [];
          room.activeModuleIndex = 0;
          room.safetyUnlockedFor = null;
          room.mazePos = null;
          room.radioFeed = [];
          room.status = "playing";
          room.startedAt = now;
          room.endedAt = null;
          room.endReason = "";
          room.lastEvent = { id: now, type: "start", message: "拆彈任務開始！全員就位！" };
        } else if (type === "backToLobby") {
          room.status = "lobby";
          room.startedAt = null;
          room.endedAt = null;
          room.strikes = 0;
          room.solvedModules = [];
          room.safetyUnlockedFor = null;
          room.mazePos = null;
          room.lastEvent = { id: now, type: "lobby", message: "已回到開局大廳" };
        } else if (type === "selectModule") {
          room.activeModuleIndex = Number(body.moduleIndex || 0);
          room.safetyUnlockedFor = null;
        } else if (type === "toggleSafetyLock") {
          const modId = body.moduleId || null;
          room.safetyUnlockedFor = room.safetyUnlockedFor === modId ? null : modId;
          room.lastEvent = {
            id: now,
            type: "safety",
            message: room.safetyUnlockedFor ? "偵察員已解除安全插銷！" : "偵察員重新鎖上安全插銷"
          };
        } else if (type === "mazeMove") {
          if (body.pos && typeof body.pos.x === "number" && typeof body.pos.y === "number") {
            room.mazePos = { x: body.pos.x, y: body.pos.y };
          }
        } else if (type === "radioPing") {
          const sender = room.players[body.clientId];
          const text = String(body.text || "").trim().slice(0, 60);
          if (text) {
            const msg = {
              id: `${now}-${Math.random().toString(36).slice(2, 5)}`,
              senderName: sender ? sender.name : String(body.senderName || "隊友").slice(0, 20),
              senderRole: sender ? sender.role : String(body.senderRole || ""),
              text,
              at: now
            };
            room.radioFeed.push(msg);
            if (room.radioFeed.length > 15) room.radioFeed.shift();
            room.lastEvent = { id: now, type: "radio", message: `${msg.senderName}：${msg.text}` };
          }
        } else if (type === "moduleSolved") {
          const modId = String(body.moduleId || "");
          if (modId && !room.solvedModules.includes(modId)) {
            room.solvedModules.push(modId);
          }
          room.safetyUnlockedFor = null;
          const totalModules = Number(body.totalModules || (room.selectedModuleIds || []).length || 4);
          if (room.solvedModules.length >= totalModules) {
            room.status = "won";
            room.endedAt = now;
            room.endReason = "所有模組皆已解除，成功拯救香蕉炸彈實驗室！";
            room.lastEvent = { id: now, type: "won", message: room.endReason };
            const elapsedSec = room.startedAt ? Math.floor((now - room.startedAt) / 1000) : 1;
            recordWinToLeaderboard(room, elapsedSec);
          } else {
            room.lastEvent = { id: now, type: "defused", message: `模組 ${body.moduleTitle || modId} 已成功解除！` };
          }
        } else if (type === "moduleStrike") {
          room.strikes += 1;
          room.safetyUnlockedFor = null;
          if (room.strikes >= room.maxStrikes) {
            room.status = "lost";
            room.endedAt = now;
            room.endReason = `失誤達到 ${room.maxStrikes} 次，香蕉炸彈變成香蕉泥了！`;
            room.lastEvent = { id: now, type: "lost", message: room.endReason };
          } else {
            room.lastEvent = {
              id: now,
              type: "strike",
              message: `觸發失誤 (${room.strikes}/${room.maxStrikes})：${body.reason || "操作錯誤"}`
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
  const cutoff = Date.now() - 3 * 60 * 60 * 1000;
  for (const [code, room] of rooms.entries()) {
    if (room.updatedAt < cutoff && room.clients.size === 0) {
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
  console.log("  🍌 BOMBANANA 程式拆彈實驗室 (Render/GitHub 多人後端)");
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
