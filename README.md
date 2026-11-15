# 🍌💣 BOMBANANA 程式拆彈實驗室

專為國中資訊課堂設計的合作拆彈網頁遊戲：結合 **Scratch 積木程式**、**Python 手冊與 PY↔Scratch 對照表**，再加上刺激爆笑的 **非程式動作拆彈小遊戲**（大按鈕讀秒、隱藏雷射迷宮、摩斯調頻電台）！

## 🏫 教室流程設計（老師統一開房 × 學生兩步進房 × 職位輪流制）

- **👩‍🏫 老師統一開房控制台**：由老師統一建立房號（支援單房或一鍵批次開多組小隊房間）、指定 **小隊名稱** 與 **遊戲模式**，並從後台監控與統一啟動。
- **🔑 學生兩步驟進房**：所有學生介面統一、極簡不混亂——
  1. **步驟 1**：輸入老師給的「房號」與「你的暱稱」 → **進入房間**。
  2. **步驟 2**：在等待室確認小隊名稱、模式與隊友名單 → **下一步開始拆彈**。
- **🔄 不分人統一職位輪流**：不綁定年級或固定角色，每解除 1 關系統自動輪換 **💣 拆彈手**（看炸彈寫 Scratch / 玩小遊戲）與 **📖 指揮官**（看手冊與 PY 對照表導引），每個人都能玩到所有位置！

## 🧩 9 種隨機變化模組

### Scratch × Python 程式模組（6 種）
1. `⚡ 雙重防爆邏輯閘`：`if / elif / else` ＋ `and / or`
2. `🍌 連環香蕉計數器`：`for` 迴圈 ＋ 變數初始化與累加
3. `🔌 彩線矩陣密碼鎖`：`list` 清單索引（Python `[0]` vs Scratch `第 1 項`）
4. `❄️ 反應爐降溫閥`：`while` 迴圈 vs Scratch `重複直到`（條件反轉）
5. `💡 香蕉二進位譯碼器`：`for` ＋ `%` 取餘數
6. `🐒 猴子解密函式機`：`def` 函式 ＋ `//` 整數除法（無條件捨去）

### 非程式特務動作小遊戲（3 種）
7. `🔴 終極香蕉大按鈕`：判斷外殼電池／指示燈決定「點一下」或「按住不放等光條變色＋計時器包含指定數字才放開」
8. `🧭 隱藏雷射迷宮`：國二看完整迷宮牆壁、國一看座標與兩個定位環，即時喊方向走迷宮（支援方向鍵 / WASD）
9. `📻 摩斯香蕉電台`：現場閃爍摩斯信號燈（含視覺點劃紀錄），國二查表辨識單字後調到對應 MHz 發射

---

## 💻 本機執行

```bash
npm start
```
或直接雙擊 `啟動拆彈遊戲.bat`，開啟 `http://localhost:3000`。

---

## ☁️ 上傳 GitHub 並免費部署到 Render

本專案使用零外部相依的 Node.js 後端（`server.js`），支援多人即時同步、SSE + 自動輪詢備援及拆彈排行榜。

### 步驟 1：推上 GitHub
```bash
git init
git add .
git commit -m "Initial BOMBANANA Scratch x Python game"
git branch -M main
git remote add origin https://github.com/<你的帳號>/<你的倉庫名>.git
git push -u origin main
```

### 步驟 2：部署到 Render（使用內附 `render.yaml`）
1. 登入 [Render](https://render.com/)，點選 **New +** → **Blueprint**。
2. 連結你剛推上去的 GitHub Repository。
3. Render 會自動讀取根目錄的 `render.yaml`（設定 `npm install`、`node server.js` 與健康檢查 `/api/health`）。
4. 點擊 **Apply / Create Web Service**，等待約 1 分鐘即可獲得專屬公開網址（例如 `https://bombanana-scratch-py.onrender.com`），全班手機、平板、電腦輸入同一個房號就能直接連線同樂！

