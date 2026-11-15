/**
 * scratch_blocks.js — Scratch 3.0 風格積木編輯器 + 真實 AST 解譯器
 * 支援：點擊插入、拖曳移動、巢狀 C 形控制積木、巢狀數值/布林積木、復原 (Undo)、步驟追蹤除錯
 */
(function (global) {
  const BNN = (global.BNN = global.BNN || {});

  let nextUid = 1;
  function uid() {
    return "blk_" + nextUid++;
  }

  function cloneAst(node) {
    if (node === null || node === undefined) return node;
    return JSON.parse(JSON.stringify(node));
  }

  /**
   * 積木定義表 (繁體中文 Scratch 3.0 用語)
   */
  const BLOCK_CATALOG = {
    // --- Control (C-blocks) ---
    c_if: {
      kind: "stmt",
      category: "control",
      label: "如果 ... 那麼",
      create: () => ({ id: uid(), type: "c_if", cond: null, body: [] })
    },
    c_ifelse: {
      kind: "stmt",
      category: "control",
      label: "如果 ... 那麼 ... 否則",
      create: () => ({ id: uid(), type: "c_ifelse", cond: null, body: [], elseBody: [] })
    },
    c_repeat: {
      kind: "stmt",
      category: "control",
      label: "重複 ( ) 次",
      create: (count = "3") => ({
        id: uid(),
        type: "c_repeat",
        count: { kind: "lit", value: String(count) },
        body: []
      })
    },
    c_until: {
      kind: "stmt",
      category: "control",
      label: "重複直到 < >",
      create: () => ({ id: uid(), type: "c_until", cond: null, body: [] })
    },

    // --- Variables ---
    set_var: {
      kind: "stmt",
      category: "var",
      label: "設變數 [ ] 為 ( )",
      create: (varName = "energy") => ({
        id: uid(),
        type: "set_var",
        varName,
        value: { kind: "lit", value: "0" }
      })
    },
    change_var: {
      kind: "stmt",
      category: "var",
      label: "變數 [ ] 改變 ( )",
      create: (varName = "energy") => ({
        id: uid(),
        type: "change_var",
        varName,
        value: { kind: "lit", value: "1" }
      })
    },
    var_get: {
      kind: "expr",
      category: "var",
      label: "(變數 [ ])",
      create: (varName = "energy") => ({ id: uid(), type: "var_get", varName })
    },

    // --- Lists ---
    list_item: {
      kind: "expr",
      category: "list",
      label: "(清單 [ ] 第 ( ) 項)",
      create: (listName = "wires") => ({
        id: uid(),
        type: "list_item",
        listName,
        index: { kind: "lit", value: "1" }
      })
    },
    list_len: {
      kind: "expr",
      category: "list",
      label: "(清單 [ ] 的長度)",
      create: (listName = "wires") => ({ id: uid(), type: "list_len", listName })
    },
    list_contains: {
      kind: "bool",
      category: "list",
      label: "<清單 [ ] 包含 ( )>",
      create: (listName = "wires") => ({
        id: uid(),
        type: "list_contains",
        listName,
        value: { kind: "lit", value: "黃" }
      })
    },

    // --- Sensing / Literals ---
    sensor: {
      kind: "expr",
      category: "sensing",
      label: "(感測值 [ ])",
      create: (sensorName = "power") => ({ id: uid(), type: "sensor", sensorName })
    },
    color_lit: {
      kind: "expr",
      category: "sensing",
      label: "(顏色 [紅])",
      create: (val = "紅") => ({ id: uid(), type: "preset_lit", presetGroup: "color", value: val })
    },
    mode_lit: {
      kind: "expr",
      category: "sensing",
      label: "(模式 [X])",
      create: (val = "X") => ({ id: uid(), type: "preset_lit", presetGroup: "mode", value: val })
    },

    // --- Operators (Bool) ---
    cmp: {
      kind: "bool",
      category: "op",
      label: "< ( ) = ( ) >",
      create: (op = "=") => ({
        id: uid(),
        type: "cmp",
        op,
        left: { kind: "lit", value: "" },
        right: { kind: "lit", value: "" }
      })
    },
    logic_and: {
      kind: "bool",
      category: "op",
      label: "< ( ) 且 ( ) >",
      create: () => ({ id: uid(), type: "logic_and", left: null, right: null })
    },
    logic_or: {
      kind: "bool",
      category: "op",
      label: "< ( ) 或 ( ) >",
      create: () => ({ id: uid(), type: "logic_or", left: null, right: null })
    },
    logic_not: {
      kind: "bool",
      category: "op",
      label: "< 不成立 ( ) >",
      create: () => ({ id: uid(), type: "logic_not", inner: null })
    },

    // --- Operators (Expr) ---
    math_bin: {
      kind: "expr",
      category: "op",
      label: "(( ) + ( ))",
      create: (op = "+") => ({
        id: uid(),
        type: "math_bin",
        op,
        left: { kind: "lit", value: "" },
        right: { kind: "lit", value: "" }
      })
    },
    math_mod: {
      kind: "expr",
      category: "op",
      label: "(( ) 除以 ( ) 的餘數)",
      create: () => ({
        id: uid(),
        type: "math_mod",
        left: { kind: "lit", value: "" },
        right: { kind: "lit", value: "2" }
      })
    },
    math_floor_div: {
      kind: "expr",
      category: "op",
      label: "(無條件捨去 (( ) / ( )))",
      create: () => ({
        id: uid(),
        type: "math_floor_div",
        left: { kind: "lit", value: "" },
        right: { kind: "lit", value: "2" }
      })
    },

    // --- Bomb Actions ---
    action_output: {
      kind: "stmt",
      category: "action",
      label: "輸出動作 [SAFE]",
      create: () => ({ id: uid(), type: "action_output", value: "SAFE" })
    },
    action_pulse: {
      kind: "stmt",
      category: "action",
      label: "發射冷卻脈衝 ( )",
      create: () => ({
        id: uid(),
        type: "action_pulse",
        value: { kind: "lit", value: "" }
      })
    },
    action_cut: {
      kind: "stmt",
      category: "action",
      label: "剪斷第 ( ) 條線",
      create: () => ({
        id: uid(),
        type: "action_cut",
        value: { kind: "lit", value: "1" }
      })
    },
    action_vent: {
      kind: "stmt",
      category: "action",
      label: "開啟排熱閥 vent()",
      create: () => ({ id: uid(), type: "action_vent" })
    },
    action_lock: {
      kind: "stmt",
      category: "action",
      label: "鎖定反應爐 lock_core()",
      create: () => ({ id: uid(), type: "action_lock" })
    },
    action_submit_code: {
      kind: "stmt",
      category: "action",
      label: "提交解鎖碼 ( )",
      create: () => ({
        id: uid(),
        type: "action_submit_code",
        value: { kind: "lit", value: "0" }
      })
    },
    action_return: {
      kind: "stmt",
      category: "action",
      label: "回傳密碼 ( )",
      create: () => ({
        id: uid(),
        type: "action_return",
        value: { kind: "lit", value: "0" }
      })
    }
  };

  /**
   * 驗證 AST 完整性（不讓空白積木無辜觸發炸彈爆炸）
   */
  function validateProgram(stmts) {
    const missing = [];
    let actionCount = 0;

    function checkExpr(node) {
      if (!node) return;
      if (node.kind === "lit") {
        if (String(node.value).trim() === "") {
          missing.push("有空白的數值/文字格子尚未填寫");
        }
        return;
      }
      if (node.type === "list_item") checkExpr(node.index);
      if (node.type === "math_bin" || node.type === "math_mod" || node.type === "math_floor_div") {
        checkExpr(node.left);
        checkExpr(node.right);
      }
    }

    function checkBool(node) {
      if (!node) {
        missing.push("有空白的 <條件> 六角框尚未放入積木");
        return;
      }
      if (node.type === "cmp") {
        checkExpr(node.left);
        checkExpr(node.right);
      } else if (node.type === "logic_and" || node.type === "logic_or") {
        checkBool(node.left);
        checkBool(node.right);
      } else if (node.type === "logic_not") {
        checkBool(node.inner);
      } else if (node.type === "list_contains") {
        checkExpr(node.value);
      }
    }

    function checkList(list) {
      for (const s of list || []) {
        if (s.type === "c_if") {
          checkBool(s.cond);
          checkList(s.body);
        } else if (s.type === "c_ifelse") {
          checkBool(s.cond);
          checkList(s.body);
          checkList(s.elseBody);
        } else if (s.type === "c_repeat") {
          checkExpr(s.count);
          checkList(s.body);
        } else if (s.type === "c_until") {
          checkBool(s.cond);
          checkList(s.body);
        } else if (s.type === "set_var" || s.type === "change_var") {
          checkExpr(s.value);
        } else if (
          s.type === "action_output" ||
          s.type === "action_vent" ||
          s.type === "action_lock"
        ) {
          actionCount++;
        } else if (
          s.type === "action_pulse" ||
          s.type === "action_cut" ||
          s.type === "action_submit_code" ||
          s.type === "action_return"
        ) {
          actionCount++;
          checkExpr(s.value);
        }
      }
    }

    checkList(stmts);
    if (!stmts || stmts.length === 0) {
      return { valid: false, message: "程式區還是空的！請從左側拖曳或點擊積木開始寫程式。" };
    }
    if (actionCount === 0) {
      return { valid: false, message: "程式裡沒有任何紅色「炸彈動作積木」（例如輸出、剪線、發射脈衝等）。" };
    }
    if (missing.length > 0) {
      return { valid: false, message: missing[0] + "（本次不扣失誤次數）" };
    }
    return { valid: true };
  }

  /**
   * 執行 Scratch AST 解譯器
   */
  function runProgram(stmts, envInput = {}) {
    const vars = Object.assign({}, envInput.vars || {});
    const sensors = Object.assign({}, envInput.sensors || {});
    const lists = Object.assign({}, envInput.lists || {});
    const actions = [];
    const trace = [];
    let steps = 0;
    const MAX_STEPS = 450;
    let returned = false;

    function normStr(v) {
      const s = String(v ?? "").trim();
      if (/^[a-zA-Z]+$/.test(s)) return s.toUpperCase();
      return s;
    }

    function toNum(v) {
      if (typeof v === "number") return v;
      const n = Number(String(v ?? "").trim());
      return Number.isFinite(n) ? n : 0;
    }

    function isNumericStr(v) {
      if (typeof v === "number") return Number.isFinite(v);
      const s = String(v ?? "").trim();
      if (s === "") return false;
      return Number.isFinite(Number(s));
    }

    function evalExpr(node) {
      if (!node) return 0;
      if (node.kind === "lit" || node.type === "preset_lit") {
        const s = String(node.value ?? "").trim();
        if (s !== "" && Number.isFinite(Number(s))) return Number(s);
        return s;
      }
      if (node.type === "var_get") {
        return vars[node.varName] !== undefined ? vars[node.varName] : 0;
      }
      if (node.type === "sensor") {
        return sensors[node.sensorName] !== undefined ? sensors[node.sensorName] : 0;
      }
      if (node.type === "list_item") {
        const arr = lists[node.listName] || [];
        const idx = Math.trunc(toNum(evalExpr(node.index))); // Scratch is 1-based!
        if (idx < 1 || idx > arr.length) return "";
        return arr[idx - 1];
      }
      if (node.type === "list_len") {
        const arr = lists[node.listName] || [];
        return arr.length;
      }
      if (node.type === "math_bin") {
        const a = toNum(evalExpr(node.left));
        const b = toNum(evalExpr(node.right));
        if (node.op === "+") return a + b;
        if (node.op === "-") return a - b;
        if (node.op === "*") return a * b;
        if (node.op === "/") return b === 0 ? 0 : a / b;
      }
      if (node.type === "math_mod") {
        const a = toNum(evalExpr(node.left));
        const b = toNum(evalExpr(node.right));
        if (b === 0) return 0;
        return ((a % b) + Math.abs(b)) % Math.abs(b);
      }
      if (node.type === "math_floor_div") {
        const a = toNum(evalExpr(node.left));
        const b = toNum(evalExpr(node.right));
        return b === 0 ? 0 : Math.floor(a / b);
      }
      return 0;
    }

    function evalBool(node) {
      if (!node) return false;
      if (node.type === "cmp") {
        const l = evalExpr(node.left);
        const r = evalExpr(node.right);
        if (node.op === "=") {
          if (isNumericStr(l) && isNumericStr(r)) return toNum(l) === toNum(r);
          return normStr(l) === normStr(r);
        }
        if (node.op === "!=") {
          if (isNumericStr(l) && isNumericStr(r)) return toNum(l) !== toNum(r);
          return normStr(l) !== normStr(r);
        }
        const ln = toNum(l);
        const rn = toNum(r);
        if (node.op === ">") return ln > rn;
        if (node.op === ">=") return ln >= rn;
        if (node.op === "<") return ln < rn;
        if (node.op === "<=") return ln <= rn;
      }
      if (node.type === "logic_and") {
        return evalBool(node.left) && evalBool(node.right);
      }
      if (node.type === "logic_or") {
        return evalBool(node.left) || evalBool(node.right);
      }
      if (node.type === "logic_not") {
        return !evalBool(node.inner);
      }
      if (node.type === "list_contains") {
        const arr = lists[node.listName] || [];
        const target = normStr(evalExpr(node.value));
        return arr.some((item) => normStr(item) === target);
      }
      return false;
    }

    function tick(blockId, detail) {
      steps++;
      if (steps > MAX_STEPS) {
        throw new Error("無限迴圈警報！程式執行超過 450 步，請檢查「重複直到」或迴圈次數。");
      }
      trace.push({ step: steps, blockId, detail, vars: Object.assign({}, vars) });
    }

    function execList(list) {
      for (const s of list || []) {
        if (returned) return;
        if (s.type === "set_var") {
          const val = evalExpr(s.value);
          vars[s.varName] = val;
          tick(s.id, `設 ${s.varName} = ${val}`);
        } else if (s.type === "change_var") {
          const delta = toNum(evalExpr(s.value));
          vars[s.varName] = toNum(vars[s.varName] ?? 0) + delta;
          tick(s.id, `${s.varName} 改變 ${delta} → ${vars[s.varName]}`);
        } else if (s.type === "c_if") {
          const ok = evalBool(s.cond);
          tick(s.id, `如果條件 → ${ok ? "成立" : "不成立"}`);
          if (ok) execList(s.body);
        } else if (s.type === "c_ifelse") {
          const ok = evalBool(s.cond);
          tick(s.id, `如果/否則條件 → ${ok ? "走那麼" : "走否則"}`);
          if (ok) execList(s.body);
          else execList(s.elseBody);
        } else if (s.type === "c_repeat") {
          const times = Math.max(0, Math.min(200, Math.trunc(toNum(evalExpr(s.count)))));
          tick(s.id, `準備重複 ${times} 次`);
          for (let i = 0; i < times; i++) {
            if (returned) break;
            execList(s.body);
          }
        } else if (s.type === "c_until") {
          tick(s.id, `開始「重複直到」迴圈`);
          while (!evalBool(s.cond)) {
            if (returned) break;
            execList(s.body);
            steps++;
            if (steps > MAX_STEPS) {
              throw new Error("無限迴圈警報！「重複直到」條件一直沒有成立！");
            }
          }
        } else if (s.type === "action_output") {
          actions.push({ type: "output", value: s.value });
          tick(s.id, `輸出動作 [${s.value}]`);
        } else if (s.type === "action_pulse") {
          const val = toNum(evalExpr(s.value));
          actions.push({ type: "pulse", value: val });
          tick(s.id, `發射冷卻脈衝 (${val})`);
        } else if (s.type === "action_cut") {
          const val = Math.trunc(toNum(evalExpr(s.value)));
          actions.push({ type: "cut", value: val });
          tick(s.id, `剪斷第 ${val} 條線`);
        } else if (s.type === "action_vent") {
          const t = vars.temp !== undefined ? toNum(vars.temp) : toNum(sensors.temp);
          actions.push({ type: "vent", value: t });
          tick(s.id, `排熱閥開啟 (目前溫度 ${t}°C)`);
        } else if (s.type === "action_lock") {
          const t = vars.temp !== undefined ? toNum(vars.temp) : toNum(sensors.temp);
          actions.push({ type: "lock", value: t });
          tick(s.id, `鎖定核心 (目前溫度 ${t}°C)`);
        } else if (s.type === "action_submit_code") {
          const val = toNum(evalExpr(s.value));
          actions.push({ type: "submit_code", value: val });
          tick(s.id, `提交解鎖碼 (${val})`);
        } else if (s.type === "action_return") {
          const val = toNum(evalExpr(s.value));
          actions.push({ type: "return", value: val });
          tick(s.id, `回傳密碼 (${val})`);
          returned = true;
        }
      }
    }

    try {
      execList(stmts);
      return { ok: true, actions, vars, trace };
    } catch (err) {
      return { ok: false, error: err.message, actions, vars, trace };
    }
  }

  /**
   * 互動式 Scratch 3.0 積木工作區 UI 元件
   */
  function createWorkspaceEditor(container, moduleSpec, savedAst, onChange) {
    let stmts = savedAst ? cloneAst(savedAst) : [];
    const undoStack = [];
    // target: { kind: 'stmt', listPath: [...], listRef } OR { kind: 'slot', ownerId, field, accept: 'expr'|'bool' }
    let activeTarget = { kind: "root" };
    let draggedInfo = null;

    function pushUndo() {
      undoStack.push(cloneAst(stmts));
      if (undoStack.length > 30) undoStack.shift();
    }

    function notifyChange() {
      if (typeof onChange === "function") onChange(cloneAst(stmts));
    }

    function findStatementLocation(id, list = stmts) {
      for (let i = 0; i < list.length; i++) {
        const s = list[i];
        if (s.id === id) return { list, index: i, node: s };
        if (s.body) {
          const res = findStatementLocation(id, s.body);
          if (res) return res;
        }
        if (s.elseBody) {
          const res = findStatementLocation(id, s.elseBody);
          if (res) return res;
        }
      }
      return null;
    }

    function findNodeById(id, nodeList = stmts) {
      function searchExpr(e) {
        if (!e || typeof e !== "object") return null;
        if (e.id === id) return e;
        return searchExpr(e.left) || searchExpr(e.right) || searchExpr(e.index) || searchExpr(e.inner) || searchExpr(e.value);
      }
      for (const s of nodeList || []) {
        if (s.id === id) return s;
        const found =
          searchExpr(s.cond) ||
          searchExpr(s.count) ||
          searchExpr(s.value) ||
          findNodeById(id, s.body) ||
          findNodeById(id, s.elseBody);
        if (found) return found;
      }
      return null;
    }

    function getTargetStmtList() {
      if (activeTarget.kind === "branch") {
        const owner = findNodeById(activeTarget.ownerId);
        if (owner && Array.isArray(owner[activeTarget.field])) {
          return owner[activeTarget.field];
        }
      }
      return stmts;
    }

    function createBlockInstance(paletteItem) {
      const def = BLOCK_CATALOG[paletteItem.type];
      if (!def) return null;
      const node = def.create(paletteItem.arg);
      if (paletteItem.presetOp && node.op !== undefined) node.op = paletteItem.presetOp;
      return node;
    }

    function insertFromPalette(paletteItem) {
      const def = BLOCK_CATALOG[paletteItem.type];
      if (!def) return;
      const newNode = createBlockInstance(paletteItem);
      if (!newNode) return;

      if (def.kind === "stmt") {
        pushUndo();
        const targetList = getTargetStmtList();
        targetList.push(newNode);
        // Auto-focus inside newly created C-block body if empty
        if (newNode.body && Array.isArray(newNode.body)) {
          activeTarget = { kind: "branch", ownerId: newNode.id, field: "body" };
        }
        if (BNN.Sound) BNN.Sound.snap();
        notifyChange();
        render();
        return;
      }

      // Expr or Bool block: must go into a compatible active slot
      if (activeTarget.kind === "slot") {
        const owner = findNodeById(activeTarget.ownerId);
        if (owner) {
          const acceptsBool = activeTarget.accept === "bool";
          if ((acceptsBool && def.kind === "bool") || (!acceptsBool && def.kind === "expr")) {
            pushUndo();
            owner[activeTarget.field] = newNode;
            if (BNN.Sound) BNN.Sound.snap();
            // Auto advance focus to first empty child slot if applicable
            if (newNode.left === null) {
              activeTarget = { kind: "slot", ownerId: newNode.id, field: "left", accept: def.kind === "bool" ? (newNode.type === "cmp" ? "expr" : "bool") : "expr" };
            } else if (newNode.type === "cmp") {
              activeTarget = { kind: "slot", ownerId: newNode.id, field: "left", accept: "expr" };
            }
            notifyChange();
            render();
            return;
          }
        }
      }

      // Friendly toast if user clicked an expr/bool without picking a slot first
      showWorkspaceHint(
        def.kind === "bool"
          ? "💡 請先點擊積木上的「<空白條件>」六角框，再點選綠色邏輯積木！"
          : "💡 請先點擊積木上的「(數值框)」，再點選藍色感測／橘色變數／綠色運算積木！"
      );
    }

    function showWorkspaceHint(msg) {
      const hintEl = container.querySelector(".scr-hint-banner");
      if (!hintEl) return;
      hintEl.textContent = msg;
      hintEl.classList.add("show");
      clearTimeout(hintEl._t);
      hintEl._t = setTimeout(() => hintEl.classList.remove("show"), 3200);
    }

    function escapeHtml(s) {
      return String(s ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
    }

    function renderSelect(nodeId, field, options, current) {
      return `<select class="scr-select" data-node="${nodeId}" data-field="${field}">
        ${options
          .map((opt) => {
            const val = typeof opt === "object" ? opt.value : opt;
            const lbl = typeof opt === "object" ? opt.label : opt;
            return `<option value="${escapeHtml(val)}" ${String(val) === String(current) ? "selected" : ""}>${escapeHtml(lbl)}</option>`;
          })
          .join("")}
      </select>`;
    }

    function renderSlot(owner, field, accept) {
      const val = owner[field];
      const isFocused =
        activeTarget.kind === "slot" &&
        activeTarget.ownerId === owner.id &&
        activeTarget.field === field;

      if (accept === "bool") {
        if (!val) {
          return `<button type="button" class="scr-slot scr-slot-bool ${isFocused ? "focused" : ""}" data-slot-owner="${owner.id}" data-slot-field="${field}" data-slot-accept="bool">&lt; 放入條件 &gt;</button>`;
        }
        return `<span class="scr-inline-wrap ${isFocused ? "focused" : ""}" data-slot-owner="${owner.id}" data-slot-field="${field}" data-slot-accept="bool">
          ${renderBoolNode(val)}
          <button type="button" class="scr-pop-btn" title="取出此條件" data-pop-owner="${owner.id}" data-pop-field="${field}" data-pop-accept="bool">×</button>
        </span>`;
      }

      // Expr slot
      if (!val || val.kind === "lit") {
        const textVal = val ? val.value : "";
        return `<span class="scr-slot scr-slot-expr ${isFocused ? "focused" : ""}" data-slot-owner="${owner.id}" data-slot-field="${field}" data-slot-accept="expr">
          <input type="text" class="scr-num-input" value="${escapeHtml(textVal)}" placeholder="?" data-lit-owner="${owner.id}" data-lit-field="${field}" size="${Math.max(2, String(textVal).length + 1)}" />
        </span>`;
      }
      return `<span class="scr-inline-wrap ${isFocused ? "focused" : ""}" data-slot-owner="${owner.id}" data-slot-field="${field}" data-slot-accept="expr">
        ${renderExprNode(val)}
        <button type="button" class="scr-pop-btn" title="取出此積木" data-pop-owner="${owner.id}" data-pop-field="${field}" data-pop-accept="expr">×</button>
      </span>`;
    }

    function renderExprNode(node) {
      if (!node) return "";
      if (node.type === "var_get") {
        return `<span class="scr-pill scr-cat-var">${renderSelect(node.id, "varName", moduleSpec.varOptions || ["energy"], node.varName)}</span>`;
      }
      if (node.type === "sensor") {
        return `<span class="scr-pill scr-cat-sensing">${renderSelect(node.id, "sensorName", moduleSpec.sensorOptions || ["power"], node.sensorName)}</span>`;
      }
      if (node.type === "preset_lit") {
        const opts = node.presetGroup === "color" ? ["紅", "藍", "黃", "綠", "白"] : ["X", "Y", "Z"];
        return `<span class="scr-pill scr-cat-sensing">${renderSelect(node.id, "value", opts, node.value)}</span>`;
      }
      if (node.type === "list_item") {
        return `<span class="scr-pill scr-cat-list">清單 ${renderSelect(node.id, "listName", moduleSpec.listOptions || ["wires"], node.listName)} 第 ${renderSlot(node, "index", "expr")} 項</span>`;
      }
      if (node.type === "list_len") {
        return `<span class="scr-pill scr-cat-list">清單 ${renderSelect(node.id, "listName", moduleSpec.listOptions || ["wires"], node.listName)} 長度</span>`;
      }
      if (node.type === "math_bin") {
        return `<span class="scr-pill scr-cat-op">${renderSlot(node, "left", "expr")} ${renderSelect(node.id, "op", ["+", "-", "*", "/"], node.op)} ${renderSlot(node, "right", "expr")}</span>`;
      }
      if (node.type === "math_mod") {
        return `<span class="scr-pill scr-cat-op">${renderSlot(node, "left", "expr")} 除以 ${renderSlot(node, "right", "expr")} 的餘數</span>`;
      }
      if (node.type === "math_floor_div") {
        return `<span class="scr-pill scr-cat-op">無條件捨去 (${renderSlot(node, "left", "expr")} / ${renderSlot(node, "right", "expr")})</span>`;
      }
      return "";
    }

    function renderBoolNode(node) {
      if (!node) return "";
      if (node.type === "cmp") {
        const ops = [
          { value: "=", label: "=" },
          { value: "!=", label: "≠" },
          { value: ">", label: ">" },
          { value: ">=", label: "≥" },
          { value: "<", label: "<" },
          { value: "<=", label: "≤" }
        ];
        return `<span class="scr-hex scr-cat-op">${renderSlot(node, "left", "expr")} ${renderSelect(node.id, "op", ops, node.op)} ${renderSlot(node, "right", "expr")}</span>`;
      }
      if (node.type === "logic_and") {
        return `<span class="scr-hex scr-cat-op">${renderSlot(node, "left", "bool")} <b>且</b> ${renderSlot(node, "right", "bool")}</span>`;
      }
      if (node.type === "logic_or") {
        return `<span class="scr-hex scr-cat-op">${renderSlot(node, "left", "bool")} <b>或</b> ${renderSlot(node, "right", "bool")}</span>`;
      }
      if (node.type === "logic_not") {
        return `<span class="scr-hex scr-cat-op"><b>不成立</b> ${renderSlot(node, "inner", "bool")}</span>`;
      }
      if (node.type === "list_contains") {
        return `<span class="scr-hex scr-cat-list">清單 ${renderSelect(node.id, "listName", moduleSpec.listOptions || ["wires"], node.listName)} 包含 ${renderSlot(node, "value", "expr")}</span>`;
      }
      return "";
    }

    function renderBranchTarget(ownerId, field, list) {
      const isFocused =
        activeTarget.kind === "branch" &&
        activeTarget.ownerId === ownerId &&
        activeTarget.field === field;
      return `
        <div class="scr-branch-body ${isFocused ? "focused" : ""}" data-branch-owner="${ownerId}" data-branch-field="${field}">
          ${(list || []).map((child) => renderStmt(child)).join("")}
          <button type="button" class="scr-add-here ${isFocused ? "focused" : ""}" data-branch-owner="${ownerId}" data-branch-field="${field}">
            ${isFocused ? "📍 目前插入位置（點左側積木放入）" : "＋ 點此切換到這個裡面放積木"}
          </button>
        </div>
      `;
    }

    function renderStmtControls(id) {
      return `
        <span class="scr-stmt-ctrls">
          <button type="button" class="scr-ctrl-btn" data-move-up="${id}" title="上移">▲</button>
          <button type="button" class="scr-ctrl-btn" data-move-down="${id}" title="下移">▼</button>
          <button type="button" class="scr-ctrl-btn del" data-del="${id}" title="刪除">✕</button>
        </span>
      `;
    }

    function renderStmt(s) {
      if (s.type === "c_if") {
        return `
          <div class="scr-cblock scr-cat-control" data-block-id="${s.id}" draggable="true">
            <div class="scr-block-row">
              <span class="scr-blk-text">如果 ${renderSlot(s, "cond", "bool")} 那麼</span>
              ${renderStmtControls(s.id)}
            </div>
            ${renderBranchTarget(s.id, "body", s.body)}
            <div class="scr-cblock-foot"></div>
          </div>
        `;
      }
      if (s.type === "c_ifelse") {
        return `
          <div class="scr-cblock scr-cat-control" data-block-id="${s.id}" draggable="true">
            <div class="scr-block-row">
              <span class="scr-blk-text">如果 ${renderSlot(s, "cond", "bool")} 那麼</span>
              ${renderStmtControls(s.id)}
            </div>
            ${renderBranchTarget(s.id, "body", s.body)}
            <div class="scr-cblock-mid">否則</div>
            ${renderBranchTarget(s.id, "elseBody", s.elseBody)}
            <div class="scr-cblock-foot"></div>
          </div>
        `;
      }
      if (s.type === "c_repeat") {
        return `
          <div class="scr-cblock scr-cat-control" data-block-id="${s.id}" draggable="true">
            <div class="scr-block-row">
              <span class="scr-blk-text">重複 ${renderSlot(s, "count", "expr")} 次</span>
              ${renderStmtControls(s.id)}
            </div>
            ${renderBranchTarget(s.id, "body", s.body)}
            <div class="scr-cblock-foot"></div>
          </div>
        `;
      }
      if (s.type === "c_until") {
        return `
          <div class="scr-cblock scr-cat-control" data-block-id="${s.id}" draggable="true">
            <div class="scr-block-row">
              <span class="scr-blk-text">重複直到 ${renderSlot(s, "cond", "bool")}</span>
              ${renderStmtControls(s.id)}
            </div>
            ${renderBranchTarget(s.id, "body", s.body)}
            <div class="scr-cblock-foot"></div>
          </div>
        `;
      }

      let cat = "var";
      let bodyHtml = "";
      if (s.type === "set_var") {
        bodyHtml = `設變數 ${renderSelect(s.id, "varName", moduleSpec.varOptions || ["energy"], s.varName)} 為 ${renderSlot(s, "value", "expr")}`;
      } else if (s.type === "change_var") {
        bodyHtml = `變數 ${renderSelect(s.id, "varName", moduleSpec.varOptions || ["energy"], s.varName)} 改變 ${renderSlot(s, "value", "expr")}`;
      } else if (s.type === "action_output") {
        cat = "action";
        bodyHtml = `輸出動作 ${renderSelect(s.id, "value", ["SAFE", "DRAIN", "BLOCK"], s.value)}`;
      } else if (s.type === "action_pulse") {
        cat = "action";
        bodyHtml = `發射冷卻脈衝 ${renderSlot(s, "value", "expr")}`;
      } else if (s.type === "action_cut") {
        cat = "action";
        bodyHtml = `剪斷第 ${renderSlot(s, "value", "expr")} 條線`;
      } else if (s.type === "action_vent") {
        cat = "action";
        bodyHtml = `開啟排熱閥 <code>vent()</code>`;
      } else if (s.type === "action_lock") {
        cat = "action";
        bodyHtml = `鎖定反應爐 <code>lock_core()</code>`;
      } else if (s.type === "action_submit_code") {
        cat = "action";
        bodyHtml = `提交解鎖碼 ${renderSlot(s, "value", "expr")}`;
      } else if (s.type === "action_return") {
        cat = "action";
        bodyHtml = `回傳密碼 ${renderSlot(s, "value", "expr")}`;
      }

      return `
        <div class="scr-stmt scr-cat-${cat}" data-block-id="${s.id}" draggable="true">
          <span class="scr-blk-text">${bodyHtml}</span>
          ${renderStmtControls(s.id)}
        </div>
      `;
    }

    function renderPalette() {
      const groups = [
        { key: "control", name: "控制" },
        { key: "var", name: "變數" },
        { key: "list", name: "清單" },
        { key: "sensing", name: "感測 / 值" },
        { key: "op", name: "運算 / 邏輯" },
        { key: "action", name: "拆彈動作" }
      ];
      return groups
        .map((g) => {
          const items = (moduleSpec.palette || []).filter((p) => {
            const def = BLOCK_CATALOG[p.type];
            return def && def.category === g.key;
          });
          if (items.length === 0) return "";
          return `
            <div class="scr-pal-group">
              <div class="scr-pal-title cat-${g.key}">${g.name}</div>
              <div class="scr-pal-items">
                ${items
                  .map((p, idx) => {
                    const def = BLOCK_CATALOG[p.type];
                    const shapeCls = def.kind === "bool" ? "pal-hex" : def.kind === "expr" ? "pal-pill" : "pal-stmt";
                    return `<button type="button" class="scr-pal-btn scr-cat-${g.key} ${shapeCls}" draggable="true" data-pal-idx="${moduleSpec.palette.indexOf(p)}">${escapeHtml(p.label || def.label)}</button>`;
                  })
                  .join("")}
              </div>
            </div>
          `;
        })
        .join("");
    }

    function render() {
      const rootFocused = activeTarget.kind === "root";
      container.innerHTML = `
        <div class="scr-editor">
          <div class="scr-palette">
            <div class="scr-pal-head">🧩 積木工具箱 <small>點擊或拖曳放入</small></div>
            <div class="scr-pal-scroll">${renderPalette()}</div>
          </div>
          <div class="scr-canvas">
            <div class="scr-canvas-bar">
              <span class="scr-canvas-tip">💡 先點工作區插入點或格子，再點左側積木</span>
              <div class="scr-canvas-tools">
                <button type="button" class="btn-mini" data-action="undo" ${undoStack.length === 0 ? "disabled" : ""}>↩️ 復原</button>
                <button type="button" class="btn-mini danger" data-action="clear">🗑️ 清空</button>
              </div>
            </div>
            <div class="scr-hint-banner"></div>
            <div class="scr-workspace-scroll">
              <div class="scr-hat">🏁 當按下「▶ 執行拆彈」</div>
              <div class="scr-root-stack ${rootFocused ? "focused" : ""}" data-root-drop="true">
                ${stmts.map((s) => renderStmt(s)).join("")}
                <button type="button" class="scr-add-here ${rootFocused ? "focused" : ""}" data-root-drop="true">
                  ${rootFocused ? "📍 目前插入位置（點左側積木接在這裡）" : "＋ 點此回到主程式尾端"}
                </button>
              </div>
            </div>
          </div>
        </div>
      `;
      bindEvents();
    }

    function bindEvents() {
      // Palette click & drag
      container.querySelectorAll(".scr-pal-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
          const item = moduleSpec.palette[Number(btn.dataset.palIdx)];
          if (item) insertFromPalette(item);
        });
        btn.addEventListener("dragstart", (e) => {
          draggedInfo = { source: "palette", palIdx: Number(btn.dataset.palIdx) };
          e.dataTransfer.effectAllowed = "copy";
          e.dataTransfer.setData("text/plain", "palette:" + btn.dataset.palIdx);
        });
      });

      // Target root stack click
      container.querySelectorAll("[data-root-drop]").forEach((el) => {
        el.addEventListener("click", (e) => {
          if (e.target.closest("button, select, input")) {
            if (!e.target.hasAttribute("data-root-drop")) return;
          }
          e.stopPropagation();
          activeTarget = { kind: "root" };
          render();
        });
        el.addEventListener("dragover", (e) => {
          if (draggedInfo) e.preventDefault();
        });
        el.addEventListener("drop", (e) => {
          e.preventDefault();
          e.stopPropagation();
          handleDropOnBranch(stmts, null);
        });
      });

      // Branch drop targets
      container.querySelectorAll("[data-branch-owner]").forEach((el) => {
        el.addEventListener("click", (e) => {
          const btn = e.target.closest("[data-branch-owner]");
          if (!btn || btn !== el) return;
          if (e.target.closest("select, input, .scr-ctrl-btn, .scr-slot, .scr-pop-btn")) return;
          e.stopPropagation();
          activeTarget = {
            kind: "branch",
            ownerId: el.dataset.branchOwner,
            field: el.dataset.branchField
          };
          render();
        });
        el.addEventListener("dragover", (e) => {
          if (draggedInfo) {
            e.preventDefault();
            e.stopPropagation();
          }
        });
        el.addEventListener("drop", (e) => {
          e.preventDefault();
          e.stopPropagation();
          const owner = findNodeById(el.dataset.branchOwner);
          if (owner && Array.isArray(owner[el.dataset.branchField])) {
            handleDropOnBranch(owner[el.dataset.branchField], {
              kind: "branch",
              ownerId: el.dataset.branchOwner,
              field: el.dataset.branchField
            });
          }
        });
      });

      // Slot clicks & drops
      container.querySelectorAll("[data-slot-owner]").forEach((el) => {
        el.addEventListener("click", (e) => {
          if (e.target.closest(".scr-pop-btn") || e.target.tagName === "SELECT") return;
          e.stopPropagation();
          activeTarget = {
            kind: "slot",
            ownerId: el.dataset.slotOwner,
            field: el.dataset.slotField,
            accept: el.dataset.slotAccept
          };
          // Preserve focus if clicking direct input
          if (e.target.tagName === "INPUT") {
            const ownerId = el.dataset.slotOwner;
            const field = el.dataset.slotField;
            render();
            const inp = container.querySelector(`input[data-lit-owner="${ownerId}"][data-lit-field="${field}"]`);
            if (inp) inp.focus();
          } else {
            render();
          }
        });
        el.addEventListener("dragover", (e) => {
          if (draggedInfo && draggedInfo.source === "palette") {
            e.preventDefault();
            e.stopPropagation();
          }
        });
        el.addEventListener("drop", (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (draggedInfo && draggedInfo.source === "palette") {
            activeTarget = {
              kind: "slot",
              ownerId: el.dataset.slotOwner,
              field: el.dataset.slotField,
              accept: el.dataset.slotAccept
            };
            const item = moduleSpec.palette[draggedInfo.palIdx];
            draggedInfo = null;
            if (item) insertFromPalette(item);
          }
        });
      });

      // Pop reporter/bool out of slot
      container.querySelectorAll("[data-pop-owner]").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          const owner = findNodeById(btn.dataset.popOwner);
          if (!owner) return;
          pushUndo();
          owner[btn.dataset.popField] = btn.dataset.popAccept === "bool" ? null : { kind: "lit", value: "" };
          activeTarget = {
            kind: "slot",
            ownerId: btn.dataset.popOwner,
            field: btn.dataset.popField,
            accept: btn.dataset.popAccept
          };
          if (BNN.Sound) BNN.Sound.click();
          notifyChange();
          render();
        });
      });

      // Inline literal inputs
      container.querySelectorAll(".scr-num-input").forEach((inp) => {
        inp.addEventListener("input", (e) => {
          const owner = findNodeById(inp.dataset.litOwner);
          if (!owner) return;
          owner[inp.dataset.litField] = { kind: "lit", value: e.target.value };
          inp.size = Math.max(2, e.target.value.length + 1);
          notifyChange();
        });
      });

      // Dropdowns
      container.querySelectorAll(".scr-select").forEach((sel) => {
        sel.addEventListener("change", (e) => {
          const node = findNodeById(sel.dataset.node);
          if (!node) return;
          pushUndo();
          node[sel.dataset.field] = e.target.value;
          if (BNN.Sound) BNN.Sound.click();
          notifyChange();
        });
      });

      // Reorder / Delete buttons
      container.querySelectorAll("[data-move-up]").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          const loc = findStatementLocation(btn.dataset.moveUp);
          if (loc && loc.index > 0) {
            pushUndo();
            const tmp = loc.list[loc.index - 1];
            loc.list[loc.index - 1] = loc.list[loc.index];
            loc.list[loc.index] = tmp;
            if (BNN.Sound) BNN.Sound.snap();
            notifyChange();
            render();
          }
        });
      });
      container.querySelectorAll("[data-move-down]").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          const loc = findStatementLocation(btn.dataset.moveDown);
          if (loc && loc.index < loc.list.length - 1) {
            pushUndo();
            const tmp = loc.list[loc.index + 1];
            loc.list[loc.index + 1] = loc.list[loc.index];
            loc.list[loc.index] = tmp;
            if (BNN.Sound) BNN.Sound.snap();
            notifyChange();
            render();
          }
        });
      });
      container.querySelectorAll("[data-del]").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          const loc = findStatementLocation(btn.dataset.del);
          if (loc) {
            pushUndo();
            loc.list.splice(loc.index, 1);
            activeTarget = { kind: "root" };
            if (BNN.Sound) BNN.Sound.click();
            notifyChange();
            render();
          }
        });
      });

      // Drag existing statements
      container.querySelectorAll("[data-block-id]").forEach((el) => {
        el.addEventListener("dragstart", (e) => {
          e.stopPropagation();
          draggedInfo = { source: "stmt", blockId: el.dataset.blockId };
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData("text/plain", "stmt:" + el.dataset.blockId);
        });
      });

      // Undo / Clear
      const undoBtn = container.querySelector('[data-action="undo"]');
      if (undoBtn) {
        undoBtn.addEventListener("click", () => {
          if (undoStack.length > 0) {
            stmts = undoStack.pop();
            activeTarget = { kind: "root" };
            notifyChange();
            render();
          }
        });
      }
      const clearBtn = container.querySelector('[data-action="clear"]');
      if (clearBtn) {
        clearBtn.addEventListener("click", () => {
          if (stmts.length > 0) {
            pushUndo();
            stmts = [];
            activeTarget = { kind: "root" };
            notifyChange();
            render();
          }
        });
      }
    }

    function handleDropOnBranch(targetList, newActiveTarget) {
      if (!draggedInfo) return;
      const info = draggedInfo;
      draggedInfo = null;

      if (info.source === "palette") {
        const item = moduleSpec.palette[info.palIdx];
        if (!item) return;
        const def = BLOCK_CATALOG[item.type];
        if (!def || def.kind !== "stmt") {
          showWorkspaceHint("💡 圓形/六角形積木請放到「數值框」或「條件框」裡喔！");
          return;
        }
        pushUndo();
        targetList.push(createBlockInstance(item));
        if (newActiveTarget) activeTarget = newActiveTarget;
        if (BNN.Sound) BNN.Sound.snap();
        notifyChange();
        render();
      } else if (info.source === "stmt") {
        const loc = findStatementLocation(info.blockId);
        if (!loc) return;
        // Prevent dropping a block inside itself
        if (newActiveTarget && findNodeById(newActiveTarget.ownerId, [loc.node])) return;
        pushUndo();
        const [moved] = loc.list.splice(loc.index, 1);
        targetList.push(moved);
        if (BNN.Sound) BNN.Sound.snap();
        notifyChange();
        render();
      }
    }

    render();

    return {
      getAst() {
        return cloneAst(stmts);
      },
      setAst(nextAst) {
        stmts = cloneAst(nextAst || []);
        render();
      },
      highlightBlock(blockId) {
        container.querySelectorAll(".scr-running").forEach((el) => el.classList.remove("scr-running"));
        if (blockId) {
          const target = container.querySelector(`[data-block-id="${blockId}"]`);
          if (target) target.classList.add("scr-running");
        }
      }
    };
  }

  BNN.BLOCK_CATALOG = BLOCK_CATALOG;
  BNN.validateProgram = validateProgram;
  BNN.runProgram = runProgram;
  BNN.createWorkspaceEditor = createWorkspaceEditor;
})(window);

