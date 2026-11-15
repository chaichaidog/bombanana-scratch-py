/**
 * py_reference.js — 互動式 Python ↔ Scratch 雙語對照表
 * 國二生用來把 Python 規則翻譯成 Scratch 語彙；國一生用來快速看懂國二講的 Python 關鍵字！
 */
(function (global) {
  const BNN = (global.BNN = global.BNN || {});

  const REFERENCE_ITEMS = [
    {
      id: "if_basic",
      category: "control",
      catLabel: "條件判斷",
      title: "單一條件判斷 (if)",
      python: "if x >= 50:\n    do_something()",
      scratchHtml: `<span class="mini-blk blk-control">如果 <span class="mini-slot op">&lt; x ≥ 50 &gt;</span> 那麼</span><br><span class="mini-indent">└ <span class="mini-blk blk-action">執行動作</span></span>`,
      tip: "Python 用縮排（4 個空白）表示在條件裡面；Scratch 則是把積木「包」進 C 字形缺口內。",
      keywords: "if 如果 條件 縮排"
    },
    {
      id: "if_else",
      category: "control",
      catLabel: "條件判斷",
      title: "二選一條件 (if / else)",
      python: "if x == 0:\n    a()\nelse:\n    b()",
      scratchHtml: `<span class="mini-blk blk-control">如果 <span class="mini-slot op">&lt; x = 0 &gt;</span> 那麼</span><br><span class="mini-indent">└ <span class="mini-blk blk-action">a()</span></span><br><span class="mini-blk blk-control">否則</span><br><span class="mini-indent">└ <span class="mini-blk blk-action">b()</span></span>`,
      tip: "⚠️ Python 判斷相等要寫兩個等號 `==`；Scratch 的等號積木只有一個 `=`！",
      keywords: "if else 如果 否則 等於 =="
    },
    {
      id: "elif",
      category: "control",
      catLabel: "條件判斷",
      title: "多選一條件 (if / elif / else)",
      python: "if cond1:\n    a()\nelif cond2:\n    b()\nelse:\n    c()",
      scratchHtml: `<span class="mini-blk blk-control">如果 &lt;cond1&gt; 那麼</span> a()<br><span class="mini-blk blk-control">否則</span><br><span class="mini-indent">└ <span class="mini-blk blk-control">如果 &lt;cond2&gt; 那麼</span> b() <span class="mini-blk blk-control">否則</span> c()</span>`,
      tip: "⚠️ Scratch 沒有 `elif` 積木！要把第二組「如果...那麼...否則」塞進第一組的「否則」缺口裡。",
      keywords: "elif 巢狀 多選一 如果 否則"
    },
    {
      id: "for_range",
      category: "loop",
      catLabel: "迴圈",
      title: "固定次數迴圈 (for range)",
      python: "for i in range(4):\n    energy = energy + 5",
      scratchHtml: `<span class="mini-blk blk-control">重複 <span class="mini-slot num">( 4 )</span> 次</span><br><span class="mini-indent">└ <span class="mini-blk blk-var">變數 [energy] 改變 (5)</span></span>`,
      tip: "`range(4)` 會執行 4 次（i 依序是 0, 1, 2, 3）。在 Scratch 直接用「重複 (4) 次」就好！",
      keywords: "for range 重複 次 迴圈"
    },
    {
      id: "for_index",
      category: "loop",
      catLabel: "迴圈",
      title: "帶索引 i 的迴圈 (for i in range)",
      python: "for i in range(4):\n    use(leds[i] * (i + 1))",
      scratchHtml: `<span class="mini-blk blk-var">設變數 [i] 為 (1)</span><br><span class="mini-blk blk-control">重複 (4) 次</span><br><span class="mini-indent">├ 用 <span class="mini-blk blk-list">清單 [leds] 第 (i) 項</span> × (i)</span><br><span class="mini-indent">└ <span class="mini-blk blk-var">變數 [i] 改變 (1)</span></span>`,
      tip: "⚠️ Python `i` 從 `0` 開始，所以 `(i + 1)` 是 1,2,3,4；Scratch 設 `i` 從 `1` 開始就能直接拿來當第 i 項！",
      keywords: "for i range index 索引 迴圈"
    },
    {
      id: "while_loop",
      category: "loop",
      catLabel: "迴圈",
      title: "條件迴圈 (while ↔ 重複直到)",
      python: "while temp > 30:\n    temp = temp - 12",
      scratchHtml: `<span class="mini-blk blk-control">重複直到 <span class="mini-slot op">&lt; temp ≤ 30 &gt;</span></span><br><span class="mini-indent">└ <span class="mini-blk blk-var">變數 [temp] 改變 (-12)</span></span>`,
      tip: "🚨 超級大陷阱！Python `while` 是「條件成立就繼續」；Scratch `重複直到` 是「條件成立就停止」，條件要寫**相反**！（`>` 的相反是 `<=`，或用「不成立」）",
      keywords: "while 重複直到 條件 相反 until"
    },
    {
      id: "var_set_change",
      category: "var",
      catLabel: "變數與清單",
      title: "設定與改變變數",
      python: "x = 10\nx = x + 3   # 或 x += 3\nx = x * 2",
      scratchHtml: `<span class="mini-blk blk-var">設變數 [x] 為 (10)</span><br><span class="mini-blk blk-var">變數 [x] 改變 (3)</span><br><span class="mini-blk blk-var">設變數 [x] 為 ((x) * (2))</span>`,
      tip: "Scratch 的「變數改變 (N)」只做加法（減法填負數 `-12`）。如果是乘法 `x = x * 2`，要用「設變數為」。",
      keywords: "變數 assign += = 改變 設為"
    },
    {
      id: "list_index",
      category: "var",
      catLabel: "變數與清單",
      title: "清單第 N 項 (0-index vs 1-index)",
      python: 'wires[0]   # 第1條\nwires[2]   # 第3條\nwires[-1]  # 最後一條',
      scratchHtml: `<span class="mini-blk blk-list">清單 [wires] 的第 (1) 項</span><br><span class="mini-blk blk-list">清單 [wires] 的第 (3) 項</span><br><span class="mini-blk blk-list">清單 [wires] 的第 (<span class="mini-blk blk-list">清單長度</span>) 項</span>`,
      tip: "🚨 經典必考題！Python 清單第 1 個是 `[0]`；Scratch 第 1 個是 `第 (1) 項`！所以 Python `[k]` = Scratch `第 (k + 1) 項`！",
      keywords: "list wires 清單 陣列 索引 0 1 -1 len 長度"
    },
    {
      id: "logic_ops",
      category: "math",
      catLabel: "數學與邏輯",
      title: "邏輯運算 (and / or / not)",
      python: 'a >= 60 and b == "X"\na < 20 or b == "Y"\nnot (a > 30)',
      scratchHtml: `<span class="mini-blk blk-op">&lt; (a ≥ 60) <span class="mini-kw">且</span> (b = X) &gt;</span><br><span class="mini-blk blk-op">&lt; (a &lt; 20) <span class="mini-kw">或</span> (b = Y) &gt;</span><br><span class="mini-blk blk-op">&lt; <span class="mini-kw">不成立</span> (a &gt; 30) &gt;</span>`,
      tip: "`and` = 且（兩個都對才對）；`or` = 或（其中一個對就對）；`not` = 不成立（真假反轉）。",
      keywords: "and or not 且 或 不成立 邏輯"
    },
    {
      id: "math_mod_div",
      category: "math",
      catLabel: "數學與邏輯",
      title: "取餘數 (%) 與整數除法 (//)",
      python: "x % 2 == 0   # 是否偶數\nx // 2       # 整數除法捨去小數",
      scratchHtml: `<span class="mini-blk blk-op">&lt; ((x) 除以 (2) 的餘數) = (0) &gt;</span><br><span class="mini-blk blk-op">(無條件捨去 ((x) / (2)))</span>`,
      tip: "⚠️ Python 的 `/` 會算出小數（例如 `7/2 = 3.5`），`//` 才會無條件捨去變 `3`！Scratch 要用綠色「無條件捨去」包住除法。",
      keywords: "% // 餘數 整數除法 mod 無條件捨去 奇偶"
    }
  ];

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function renderReferencePanel(container, options = {}) {
    if (!container) return;
    let activeCategory = options.initialCategory || "all";
    let searchQuery = "";

    container.innerHTML = `
      <div class="pyref-shell">
        <div class="pyref-header">
          <div class="pyref-title">📖 Python ↔ Scratch 對照表</div>
          <div class="pyref-sub">指揮官看 Python 規則 · 拆彈手拼 Scratch 積木（每關輪流）</div>
        </div>
        <div class="pyref-controls">
          <input type="text" class="pyref-search" placeholder="🔍 搜尋語法（如 while, elif, %, 清單...）" />
          <div class="pyref-tabs">
            <button type="button" class="pyref-tab ${activeCategory === "all" ? "active" : ""}" data-cat="all">全部</button>
            <button type="button" class="pyref-tab ${activeCategory === "control" ? "active" : ""}" data-cat="control">條件</button>
            <button type="button" class="pyref-tab ${activeCategory === "loop" ? "active" : ""}" data-cat="loop">迴圈</button>
            <button type="button" class="pyref-tab ${activeCategory === "var" ? "active" : ""}" data-cat="var">變數/清單</button>
            <button type="button" class="pyref-tab ${activeCategory === "math" ? "active" : ""}" data-cat="math">運算/邏輯</button>
          </div>
        </div>
        <div class="pyref-list"></div>
      </div>
    `;

    const searchInput = container.querySelector(".pyref-search");
    const listEl = container.querySelector(".pyref-list");
    const tabBtns = container.querySelectorAll(".pyref-tab");

    function paintList() {
      const q = searchQuery.trim().toLowerCase();
      const filtered = REFERENCE_ITEMS.filter((item) => {
        if (activeCategory !== "all" && item.category !== activeCategory) return false;
        if (!q) return true;
        const blob = `${item.title} ${item.python} ${item.tip} ${item.keywords}`.toLowerCase();
        return blob.includes(q);
      });

      if (filtered.length === 0) {
        listEl.innerHTML = `<div class="pyref-empty">找不到符合「${escapeHtml(searchQuery)}」的語法對照項目</div>`;
        return;
      }

      listEl.innerHTML = filtered
        .map(
          (item) => `
          <div class="pyref-card" data-ref-id="${item.id}">
            <div class="pyref-card-head">
              <span class="pyref-badge">${item.catLabel}</span>
              <span class="pyref-card-title">${escapeHtml(item.title)}</span>
            </div>
            <div class="pyref-grid">
              <div class="pyref-col">
                <div class="pyref-col-lbl py-lbl">🐍 Python (手冊規則)</div>
                <pre class="pyref-code"><code>${escapeHtml(item.python)}</code></pre>
              </div>
              <div class="pyref-col">
                <div class="pyref-col-lbl scr-lbl">🧩 Scratch 積木</div>
                <div class="pyref-scratch">${item.scratchHtml}</div>
              </div>
            </div>
            <div class="pyref-tip">${escapeHtml(item.tip)}</div>
          </div>
        `
        )
        .join("");
    }

    tabBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        activeCategory = btn.dataset.cat;
        tabBtns.forEach((b) => b.classList.toggle("active", b === btn));
        paintList();
      });
    });

    searchInput.addEventListener("input", (e) => {
      searchQuery = e.target.value;
      paintList();
    });

    paintList();

    return {
      filterCategory(cat) {
        activeCategory = cat;
        tabBtns.forEach((b) => b.classList.toggle("active", b.dataset.cat === cat));
        paintList();
      }
    };
  }

  BNN.PY_REFERENCE_ITEMS = REFERENCE_ITEMS;
  BNN.renderReferencePanel = renderReferencePanel;
})(window);

