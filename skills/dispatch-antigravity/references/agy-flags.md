# Antigravity（`agy`）CLI 派工參考

以下內容於 2026-10-18 透過這些來源驗證（旗標表首建於 2026-09-03 之 1.1.25，其後於 1.2.6、1.4.2 逐項重查）：

- 本機 `agy` 1.4.2
- 本機 `agy --help`、即時 `agy models`、`agy -p /effort --model <slug> --output-format json`、`agy changelog`
- [Antigravity 官方模型頁](https://antigravity.google/docs/models/)
- [Antigravity 官方無介面模式文件](https://antigravity.google/docs/cli/headless/)
- [Antigravity CLI 官方儲存庫](https://github.com/google-antigravity/antigravity-cli)

2026-11-07 增補（`--input-format` 與提示詞走 stdin 的行為）之來源：`w-dispatch-ai` **1.0.80** 之 `src/dispatchAntigravity.mjs` 檔頭與其實測紀錄（agy 1.5.2；本檔**未重跑**）。

2026-11-13 更新（預設模型改 Gemini 4 Hydrogen、型錄、`/effort`、`--help`）之來源：本機 `agy` **1.5.7** 之 `agy --version`、`agy models`、`agy --help`、`agy -p /effort --model <slug> --output-format json`，以及以技能根 `w-dispatch-ai`（實裝 1.0.90）對 `gemini-4-hydrogen-high` 之三次實呼（`skipPermissions` 真假、工作區內外寫檔，細節見 SKILL.md〈`skipPermissions: false` 只擋工作區外之寫入〉）；內建條目依 `w-dispatch-ai` 1.0.92 之 `src/providers.mjs`。下方「主要旗標」「子命令」「輸出與離開狀態」之表仍為 2026-10-18（1.4.2）之建表，僅就 1.5.7 `--help` 補列新見項（見該節）。

模型型錄由伺服器提供，可能獨立於本文件變更。修改固定模型前，須重新執行 `agy models`。

## 非互動語法

```text
agy --print "prompt" [flags]
agy -p "prompt" [flags]
```

提示詞是 `--print` 的必要參數值；單次執行不會從 stdin 讀取純文字提示詞（純文字塞 stdin 而不帶 `--print` 會進互動模式卡住）。因此 `dispatchAntigravity()` 在提示詞不超過 30,000 字元時把它當成命令列參數（argv 路徑）；1.0.80 起預設（`promptVia: 'auto'`）超過 30,000 字元改走 stdin 的 `--input-format stream-json`（stream 輸入必須搭配 stream 輸出，須 agy ≥ 1.1.15），做法與限制見 SKILL.md〈提示詞傳輸〉。

## 必要模型與最深推理

```text
--model gemini-4-hydrogen-high
```

即時型錄（`agy models` 完整輸出，2026-11-13 於 agy 1.5.7；共 18 項，較 2026-10-18 之 1.4.2 多出 Hydrogen 四檔與 `gemini-pro-orchestrator-g1-pro`）：

```text
gemini-4-argon-medium     Gemini 4 Argon (Medium)
gemini-4-argon-high       Gemini 4 Argon (High)
gemini-4-argon-low        Gemini 4 Argon (Low)
gemini-4-hydrogen-high    Gemini 4 Hydrogen (High)
gemini-4-hydrogen-xhigh   Gemini 4 Hydrogen (XHigh)
gemini-4-hydrogen-medium  Gemini 4 Hydrogen (Medium)
gemini-4-hydrogen-low     Gemini 4 Hydrogen (Low)
gemini-pro-orchestrator-g1-pro  Orchestrator (Argon)
gemini-3.8-flash-high     Gemini 3.8 Flash (High)
gemini-3.8-flash-medium   Gemini 3.8 Flash (Medium)
gemini-3.8-flash-low      Gemini 3.8 Flash (Low)
claude-opus-5-5-low       Claude Opus 5.5 (Low)
claude-opus-5-5-medium    Claude Opus 5.5 (Medium)
claude-opus-5-5-high      Claude Opus 5.5 (High)
claude-sonnet-5-5-low     Claude Sonnet 5.5 (Low)
claude-sonnet-5-5-medium  Claude Sonnet 5.5 (Medium)
claude-sonnet-5-5-high    Claude Sonnet 5.5 (High)
gpt-oss-120b-medium       GPT-OSS 120B (Medium)
```

**`gemini-4-hydrogen-high` 是本技能之預設值**（2026-11-13 起，使用者指定；`w-dispatch-ai` 1.0.92 內建條目 `agy:gemini-4-hydrogen-high` 同檔位）。Hydrogen 另有 `gemini-4-hydrogen-xhigh`（`/effort` 之 available 含 `xhigh`），本技能**不採用、未實測**。2026-11-13 以技能根之 `w-dispatch-ai`（實裝 1.0.90）於 agy 1.5.7 對 `gemini-4-hydrogen-high` 實呼「讀中文檔第 1 行＋寫檔」（`skipPermissions: true`）通過：13.5 秒、中文原樣讀回、檔案落地；agy 耗時起伏大，單次數字不可據以比較快慢。額度歸 `/usage` 之「Gemini Models」群組（無 Hydrogen 專屬群組，與 3.8 Flash 同組，見 SKILL.md〈必要預設值〉）。

**`gemini-3.8-flash-*` 是仍在型錄之舊預設**（2026-09-03 至 2026-11-13 為本技能預設，2026-11-13 之 `agy models` 仍列三檔；以下為歷史紀錄，保留當時之數字）：2026-10-18 以 `w-dispatch-ai` 1.0.53 於 agy 1.4.2 實跑「讀檔＋寫檔」通過（16.6 秒、中文原樣讀回、檔案落地）。沿革：Gemini 3.8 Flash 隨 agy 1.1.25 進入型錄（changelog：「Added Gemini 3.8 Flash to the model catalog when connecting with a `GEMINI_API_KEY`」），2026-09-03 於 1.1.25 實跑 8.8 秒、exit 0；`w-dispatch-ai` 之 providers 表同日由 3.7 升為 3.8，附實測：回應 12.5s（3.7 為 62.2s）、讀檔 14.6s（3.7 為 57.6s）。

**Gemini 4 Argon（`gemini-4-argon-*`）是另一支可選的 Gemini，不是預設**。它的額度是 agy `/usage` 裡獨立的「Gemini 4 Argon」群組，只有 7 天窗口、沒有 5 小時窗口（`w-dispatch-ai` 2026-10-16 以前後對照實測，與「Gemini Models」群組分開），套件 1.0.50 起收為 `agy:gemini-4-argon-high` 條目。**未給 `--model` 時 agy 預設就是 Gemini 4 Argon (Medium)**（套件 2026-10-16 以 agy 1.4.0 實測；預設由 agy 決定、可能隨版本變動；2026-11-13 之 1.5.7 本技能未重驗此預設），會悄悄耗用這個 7 天額度，所以派工一律明給 `--model`。改用 Argon 須使用者明確指定。

**查某支模型可用的 effort，用 `/effort`，不要看 `--help`**：

```bash
MSYS_NO_PATHCONV=1 agy -p /effort --model gemini-4-hydrogen-high --output-format json
# 回應之 command.data.available 即清單；adjustable 為 false 表示該模型不可調
# 帶檔位 slug 時 current 回該檔位；基礎 slug（如 gemini-4-hydrogen）則 current 為預設 medium
```

`MSYS_NO_PATHCONV=1` 只在 Git Bash 需要：MSYS 會把開頭為 `/` 的參數當成 POSIX 路徑，改寫成 `C:/Program Files/Git/effort` 再交給 agy（PowerShell／cmd 不受影響）。`/effort` 不呼叫模型（`duration_seconds: 0`、token 全 0），不耗額度。2026-11-13 於 agy 1.5.7 實查：

| 基礎 slug | available |
|---|---|
| `gemini-4-hydrogen` | low, medium, high, **xhigh** |
| `gemini-3.8-flash`（仍在型錄之舊預設） | low, medium, high |
| `gemini-4-argon` | low, medium, high |
| `claude-opus-5-5`、`claude-sonnet-5-5` | low, medium, high |
| `gpt-oss-120b`、`gemini-pro-orchestrator-g1-pro` | 不可調（`adjustable: false`） |

同一版 `--help` 把 `--effort` 列為 `low|medium|high|xhigh|max`（1.2.6 為 `low|medium|high`，1.2.13 為 `low|medium|high|max`，1.4.2 與 1.5.7 為 `low|medium|high|xhigh|max`）——那是 CLI 層的字面值域，不是每個模型都吃。2026-10-18 於 1.4.2 實測：`--model gemini-3.8-flash --effort max` 回 `gemini-3.8-flash has no "max" effort (available: low, medium, high)`（未於 1.5.7 重測）。**1.5.7 之型錄只有 Hydrogen 的 available 含 `xhigh`，沒有任何一支含 `max`**；Hydrogen 之 `xhigh` 本技能不採用、未實測。

`agy models` 只列帶檔位的 slug（`-high`／`-medium`／`-low`，Hydrogen 另有 `-xhigh`），但**不帶檔位的基礎 slug 解析得出來**（預設檔位 medium，可搭配 `--effort`；Hydrogen 於 2026-11-13 以 `/effort` 確認）。本技能之正解是直接用 `gemini-4-hydrogen-high` 並**省略 `--effort`**——檔位已在 slug 裡，再傳一次只會多一個衝突來源：檔位不一致才拒絕（2026-10-18 於 1.4.2 實測 `gemini-3.8-flash-high` ＋ `--effort max` 回 `conflicts with`；Hydrogen 未重測），一致則放行。

**型錄變動速度是本節重點**：2026-08-23 型錄尚有 `gemini-3.5-flash-*` 而無 3.8；2026-09-02 3.5 已移除、最新仍只到 3.7；2026-09-03 即出現 3.8 三檔；到 2026-10-18，3.7 Flash、3.6 Flash、3.1 Pro 與 Claude 4.6 系已全數下架，改為 Gemini 4 Argon 與 Claude 5.5 系（`w-dispatch-ai` 記錄 `gemini-3.6-flash-low`、`gemini-3.1-pro` 於 agy 1.4.0 回 `not recognized as a known model`）；2026-11-13 型錄新增 Gemini 4 Hydrogen 四檔與 `gemini-pro-orchestrator-g1-pro`，3.8 Flash 三檔仍在。故固定任何 slug 前一律先跑 `agy models` 對照，不可依本文件的清單直接寫入。

必須使用第一欄 slug，不可傳入顯示名稱（agy 的錯誤訊息列的是顯示名稱，容易誤導）。

需要非 Gemini 的推理時，型錄另有 `claude-opus-5-5-*`、`claude-sonnet-5-5-*`（套件條目 `agy:claude-opus-5-5-high`、`agy:claude-sonnet-5-5-high`；額度走 agy 之「Claude and GPT models」群組，與 Claude Code 訂閱無關）。但本技能定位為 Gemini 派工，改用前須經使用者同意（且 Enterprise 方案對 Claude／GPT 項目有存取限制）。

## 主要旗標（1.1.25 建表，2026-10-18 於 1.4.2 逐項重查）

1.4.2 之 `--help` 與下表逐行相符。相對早期版本的差異：`--effort` 值域擴為 `low|medium|high|xhigh|max`、`--print-timeout` 預設載明為 `0s`（等到完成；早期文件記為 `5m0s`，舊版實際預設未驗證）、`--mode` 多出 `auto`；另有 `--remote-control` 與子指令 `mic-serve`、`plugin`／`plugins`、`remote-control`，皆與非互動派工無關，派工不使用。

| 旗標 | 用途 |
|---|---|
| `-p`、`--print <text>` | 非互動執行一次提示詞，完成後離開 |
| `--prompt <text>` | `--print` 的別名 |
| `-i`、`--prompt-interactive <text>` | 帶初始提示詞進入互動模式；派工不可使用 |
| `--model <slug>` | 固定使用 `agy models` 中的模型；未給時由 agy 決定（套件以 1.4.0 實測為 Gemini 4 Argon (Medium)） |
| `--effort low\|medium\|high\|xhigh\|max` | 設定推理強度。CLI 層之字面值域，**未必被模型接受**（每模型之 available 以 `/effort` 實查，見「必要模型與最深推理」） |
| `--dangerously-skip-permissions` | 自動核准所有工具權限請求 |
| `--print-timeout <duration>` | 限制 print 模式等待時間；**預設 `0s`＝等到完成**。到期時 agy 以 exit 0 交回部分輸出，不是錯誤。`dispatchAntigravity()` 未給 `printTimeout` 時推導為 `timeoutMs` 秒數 + 30，令外層先逾時 |
| `--add-dir <path>` | 增加工作區目錄；可重複使用 |
| `--output-format text\|json\|stream-json` | 選擇 print 模式輸出格式 |
| `--input-format text\|stream-json` | 選擇 print 模式輸入格式；stream 輸入必須搭配 stream 輸出。`stream-json` 自 agy 1.1.15 起（`agy changelog`）；輸入為每行一個 JSON 事件，如 `{"event":"user","message":{"role":"user","content":"…"}}`，**不得同時帶 `-p`**（離開碼 2）；**斜線指令**（`/usage`、`/effort` 等）在此輸入格式下被 CLI 拒絕（離開碼 2）。`dispatchAntigravity()` 的 stdin 路徑即使用此格式 |
| `--json-schema <schema-or-path>` | 限制最終結果結構 |
| `-c`、`--continue` | 延續最近一次對話 |
| `--conversation <id>` | 以 ID 恢復對話 |
| `--mode accept-edits\|auto\|plan` | 選擇執行模式 |
| `--agent <name>` | 選擇自訂代理 |
| `--project <id-or-name>` | 選擇專案 |
| `--new-project` | 為本次執行建立專案 |
| `--disable-slash-commands` | 停用 print 模式的 slash command 與技能展開 |
| `--sandbox` | 啟用 Antigravity 終端限制 |
| `--log-file <path>` | 覆寫 CLI log 檔路徑 |
| `--settings <json-or-path>` | **1.5.7 `--help` 新見（2026-11-13，本檔未實測）**：僅本次 session 有效之 settings.json 鍵（行內 JSON 物件或檔案路徑），不存檔；與派工之權限規則是否相關未驗 |
| `--remote-agent` | **1.5.7 新見（未實測）**：以遠端 agent 執行對話；派工不使用 |

模型沒有 `-m` 短旗標，必須使用 `--model`。

## 子命令

| 命令 | 用途 |
|---|---|
| `agy models` | 列出即時模型 slug |
| `agy agent`、`agy agents` | 列出代理 |
| `agy mcp` | 管理 MCP server |
| `agy plugin`、`agy plugins` | 管理 plugin |
| `agy changelog` | 顯示版本說明 |
| `agy install` | 設定環境路徑與 shell 設定 |
| `agy acp` | **1.5.7 新見（未實測）**：啟動 Agent Client Protocol（ACP）之 stdio 伺服器；派工不使用 |
| `agy mic-serve` | 把本機麥克風分享給另一台主機上的 CLI |
| `agy remote-control` | 管理遠端連線背景常駐程式 |
| `agy help` | 顯示子命令說明 |
| `agy update` | 更新 CLI |

## 版本下限：1.1.25

派工要求 agy ≥ 1.1.25，三個理由：

- **1.1.25**：Gemini 3.8 Flash 才進入型錄（2026-11-13 前之預設模型之所以訂此版；現預設 Hydrogen 於 1.5.7 之型錄已有，其最低 agy 版本未查證——型錄由伺服器供給，不一定綁 CLI 版本）。
- **1.1.24**：headless 呼叫在 stdout／stderr 被導管接走時，離開階段卡住（未對保留的串流設 `FD_CLOEXEC`，子程序抓著呼叫端 pipe 不放）。`dispatchAntigravity()` 就是以 pipe 收輸出，必中。
- **1.1.23**：`models`、`agents` 等子命令繼承到未關閉的 stdin pipe 時會卡住而不執行——即「跑 `agy models` 查型錄卻沒有回應」的成因。

症狀是子程序不結束、只能等 `timeoutMs` 到期被殺；遇到請先確認版本，不要當成模型或提示詞問題去調參數。

## 輸出與離開狀態

```text
agy -p "task" --model gemini-4-hydrogen-high --output-format json
agy -p "task" --model gemini-4-hydrogen-high --output-format stream-json
```

`json` 是單一結果物件；`stream-json` 是 NDJSON。

agy 的非成功結局多半是 **exit 0**，只看離開碼分不出來：

| 情境 | 離開碼 | stdout | stderr |
|---|---:|---|---|
| 權限閘門擋下（未加 `--dangerously-skip-permissions`，工具需要寫入**工作區外**之路徑；寫到工作區內者於 1.5.7 實測放行而落地，見 SKILL.md〈`skipPermissions: false` 只擋工作區外之寫入〉） | 0 | 空 | `jetski: no output produced — a tool required the "write_file" permission that headless mode cannot prompt for, so it was auto-denied. …`（2026-10-18 於 1.4.2 實測；1.1.27 時同段訊息印在 stdout、權限名為 `command`） |
| `--print-timeout` 到期 | 0 | 已產出之部分，可能為空 | `[agy] print timeout after <t> with turn in progress; returning partial output` |
| 指定了不存在的模型 | 1 | — | 錯誤訊息（不會靜默退回其他模型） |
| stream-json 輸入：未知的 `event` 值（如 `user_message`） | **0** | 只有 `init` 事件、沒有 `result` | warning；**離開碼 0 不代表成功**，須以有無 `result` 事件判斷（2026-11-07 套件於 agy 1.5.2 實測） |
| stream-json 輸入：缺 `event` 欄，或 `event` 為 `user` 但缺 `message` | 1 | — | 如 `stream input message is missing the "event" field` |
| `-p` 併 `--input-format` | 2 | — | 提示詞不得同時由命令列給 |

## 工作區與認證

agy 透過明確指定的工作區目錄決定檔案可視範圍。未提供 `addDirs` 時，`dispatchAntigravity()` 會自動加入實際 `cwd`。

無人值守執行前，須先在互動式 `agy` 工作階段完成 Google 認證。`--dangerously-skip-permissions` 不會執行 OAuth。

## 執行期驗證

```bash
agy --version
agy --help
agy models
MSYS_NO_PATHCONV=1 agy -p /effort --model <基礎slug> --output-format json
agy changelog
```

若型錄已不包含 `gemini-4-hydrogen-high`，應明確回報失敗並要求重新選擇模型，不可依賴隱含備援。
