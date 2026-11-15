# 🍌💣 BOMBANANA 程式拆彈實驗室

專為台灣國中資訊社團／課堂設計的合作拆彈網頁遊戲：結合 **國一 Scratch 積木程式**、**國二 Python 專家手冊與 PY↔Scratch 對照表**，再加上刺激爆笑的 **非程式動作拆彈小遊戲**（大按鈕讀秒、隱藏雷射迷宮、摩斯調頻電台）！

## 👥 角色與座位設計（專為 1 位國二 ＋ 2 位坐旁邊的國一）

- **沒有盲人／聾人等感官障礙限制**，把資訊隔閡設在「**國二指揮官**」與「**國一現場雙人組**」之間。
- **🧠 國二 Python 指揮官**：看不到炸彈畫面，看著 Python 拆彈規格書、迷宮地圖、摩斯表與 **PY↔Scratch 對照表**，發問並指揮國一。
- **國一雙人並肩合作（兩位坐旁邊超順暢）**：
  - **並排兩台電腦**：一人當 **🔍 國一現場偵察員**（看炸彈外殼、控「安全插銷」並親手玩大按鈕／走迷宮／調摩斯電台），另一人當 **🧩 國一 Scratch 程式師**（超大積木工作區 + PY 對照表，並幫忙看閃燈／核對秒數）。
  - **共用一台電腦**：選 **🛠️ 國一雙人共用機**，系統會在每個模組解除後提醒「偵察手 ⇄ 積木手」交換滑鼠！

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

