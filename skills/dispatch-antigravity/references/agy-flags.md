# Antigravity（`agy`）CLI 派工參考

以下內容於 2026-10-18 透過這些來源驗證（旗標表首建於 2026-09-03 之 1.1.25，其後於 1.2.6、1.4.2 逐項重查）：

- 本機 `agy` 1.4.2
- 本機 `agy --help`、即時 `agy models`、`agy -p /effort --model <slug> --output-format json`、`agy changelog`
- [Antigravity 官方模型頁](https://antigravity.google/docs/models/)
- [Antigravity 官方無介面模式文件](https://antigravity.google/docs/cli/headless/)
- [Antigravity CLI 官方儲存庫](https://github.com/google-antigravity/antigravity-cli)

模型型錄由伺服器提供，可能獨立於本文件變更。修改固定模型前，須重新執行 `agy models`。

## 非互動語法

```text
agy --print "prompt" [flags]
agy -p "prompt" [flags]
```

提示詞是 `--print` 的必要參數值；單次執行不會從 stdin 讀取提示詞。因此 `dispatchAntigravity()` 會把提示詞當成命令列參數，並套用 30,000 字元上限。

## 必要模型與最深推理

```text
--model gemini-3.8-flash-high
```

即時型錄（`agy models` 完整輸出，2026-10-18 於 agy 1.4.2）：

```text
gemini-4-argon-medium     Gemini 4 Argon (Medium)
gemini-4-argon-high       Gemini 4 Argon (High)
gemini-4-argon-low        Gemini 4 Argon (Low)
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

**`gemini-3.8-flash-high` 是本技能之預設值**，也是 Gemini 3.8 Flash 能給到的最深檔。2026-10-18 以 `w-dispatch-ai` 1.0.53 於 agy 1.4.2 實跑「讀檔＋寫檔」通過（16.6 秒、中文原樣讀回、檔案落地）。沿革：Gemini 3.8 Flash 隨 agy 1.1.25 進入型錄（changelog：「Added Gemini 3.8 Flash to the model catalog when connecting with a `GEMINI_API_KEY`」），2026-09-03 於 1.1.25 實跑 8.8 秒、exit 0；`w-dispatch-ai` 之 providers 表同日由 3.7 升為 3.8，附實測：回應 12.5s（3.7 為 62.2s）、讀檔 14.6s（3.7 為 57.6s）。

**Gemini 4 Argon（`gemini-4-argon-*`）是另一支可選的 Gemini，不是預設**。它的額度是 agy `/usage` 裡獨立的「Gemini 4 Argon」群組，只有 7 天窗口、沒有 5 小時窗口（`w-dispatch-ai` 2026-10-16 以前後對照實測，與「Gemini Models」群組分開），套件 1.0.50 起收為 `agy:gemini-4-argon-high` 條目。**未給 `--model` 時 agy 預設就是 Gemini 4 Argon (Medium)**（套件 2026-10-16 以 agy 1.4.0 實測；預設由 agy 決定、可能隨版本變動），會悄悄耗用這個 7 天額度，所以派工一律明給 `--model`。改用 Argon 須使用者明確指定。

**查某支模型可用的 effort，用 `/effort`，不要看 `--help`**：

```bash
MSYS_NO_PATHCONV=1 agy -p /effort --model gemini-3.8-flash --output-format json
# 回應之 command.data.available 即清單；adjustable 為 false 表示該模型不可調
```

`MSYS_NO_PATHCONV=1` 只在 Git Bash 需要：MSYS 會把開頭為 `/` 的參數當成 POSIX 路徑，改寫成 `C:/Program Files/Git/effort` 再交給 agy（PowerShell／cmd 不受影響）。2026-10-18 於 agy 1.4.2 實查：

| 基礎 slug | available |
|---|---|
| `gemini-3.8-flash` | low, medium, high |
| `gemini-4-argon` | low, medium, high |
| `claude-opus-5-5`、`claude-sonnet-5-5` | low, medium, high |
| `gpt-oss-120b` | 不可調（`adjustable: false`） |

同一版 `--help` 卻把 `--effort` 列為 `low|medium|high|xhigh|max`（1.2.6 為 `low|medium|high`，1.2.13 為 `low|medium|high|max`）——那是 CLI 層的字面值域，不是每個模型都吃。實際傳 `--model gemini-3.8-flash --effort max` 回 `gemini-3.8-flash has no "max" effort (available: low, medium, high)`。**當前型錄沒有任何一支接受 `xhigh` 或 `max`**，故 `high` 仍是 3.8 Flash 的最深檔。

`agy models` 只列帶檔位的 slug（`-high`／`-medium`／`-low`），但**不帶檔位的基礎 slug 解析得出來**（預設檔位 medium，可搭配 `--effort`）。最深思考的正解仍是直接用 `gemini-3.8-flash-high` 並**省略 `--effort`**——檔位已在 slug 裡，再傳一次只會多一個衝突來源：檔位不一致才拒絕（實測 `gemini-3.8-flash-high` ＋ `--effort max` 回 `conflicts with`），一致則放行。

**型錄變動速度是本節重點**：2026-08-23 型錄尚有 `gemini-3.5-flash-*` 而無 3.8；2026-09-02 3.5 已移除、最新仍只到 3.7；2026-09-03 即出現 3.8 三檔；到 2026-10-18，3.7 Flash、3.6 Flash、3.1 Pro 與 Claude 4.6 系已全數下架，改為 Gemini 4 Argon 與 Claude 5.5 系（`w-dispatch-ai` 記錄 `gemini-3.6-flash-low`、`gemini-3.1-pro` 於 agy 1.4.0 回 `not recognized as a known model`）。故固定任何 slug 前一律先跑 `agy models` 對照，不可依本文件的清單直接寫入。

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
| `--input-format text\|stream-json` | 選擇 print 模式輸入格式；stream 輸入必須搭配 stream 輸出 |
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
| `agy mic-serve` | 把本機麥克風分享給另一台主機上的 CLI |
| `agy remote-control` | 管理遠端連線背景常駐程式 |
| `agy help` | 顯示子命令說明 |
| `agy update` | 更新 CLI |

## 版本下限：1.1.25

派工要求 agy ≥ 1.1.25，三個理由：

- **1.1.25**：Gemini 3.8 Flash 才進入型錄；舊版沒有本技能的預設模型。
- **1.1.24**：headless 呼叫在 stdout／stderr 被導管接走時，離開階段卡住（未對保留的串流設 `FD_CLOEXEC`，子程序抓著呼叫端 pipe 不放）。`dispatchAntigravity()` 就是以 pipe 收輸出，必中。
- **1.1.23**：`models`、`agents` 等子命令繼承到未關閉的 stdin pipe 時會卡住而不執行——即「跑 `agy models` 查型錄卻沒有回應」的成因。

症狀是子程序不結束、只能等 `timeoutMs` 到期被殺；遇到請先確認版本，不要當成模型或提示詞問題去調參數。

## 輸出與離開狀態

```text
agy -p "task" --model gemini-3.8-flash-high --output-format json
agy -p "task" --model gemini-3.8-flash-high --output-format stream-json
```

`json` 是單一結果物件；`stream-json` 是 NDJSON。

agy 的非成功結局多半是 **exit 0**，只看離開碼分不出來：

| 情境 | 離開碼 | stdout | stderr |
|---|---:|---|---|
| 權限閘門擋下（未加 `--dangerously-skip-permissions`，工具需要寫入） | 0 | 空 | `jetski: no output produced — a tool required the "write_file" permission that headless mode cannot prompt for, so it was auto-denied. …`（2026-10-18 於 1.4.2 實測；1.1.27 時同段訊息印在 stdout、權限名為 `command`） |
| `--print-timeout` 到期 | 0 | 已產出之部分，可能為空 | `[agy] print timeout after <t> with turn in progress; returning partial output` |
| 指定了不存在的模型 | 1 | — | 錯誤訊息（不會靜默退回其他模型） |

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

若型錄已不包含 `gemini-3.8-flash-high`，應明確回報失敗並要求重新選擇模型，不可依賴隱含備援。
