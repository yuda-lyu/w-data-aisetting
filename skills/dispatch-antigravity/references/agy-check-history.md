# dispatch-antigravity：歷次查核對照表（自 SKILL.md〈安裝檢查〉移入）

本檔收 SKILL.md〈安裝檢查〉2026-11-13 及更早之各次對照表與實測紀錄（原文逐字自 SKILL.md 搬移，未刪改；其中「全表 N 條」「尚無／僅 N 條 agy 條目」等為查核當日之狀態，不代表現況）。2026-11-13 查核表末列之「**已知與 1.0.92 不符待另案更正**」（`timeoutMs` 無效值改用預設、`--print-timeout` 推導不再封頂）已於 2026-11-23 更正於 SKILL.md〈逾時分層〉與〈轉接器契約〉。最新三次對照（2026-11-24 之 w-dispatch-ai 1.0.112、2026-11-23 之 1.0.110 與 1.0.109）留在 SKILL.md。

2026-11-13 查核：本機 agy **1.5.7**；技能根實裝 `w-dispatch-ai` **1.0.90**（npm 最新 1.0.92，技能根尚未升到該版；呼叫以 1.0.90 之 `dispatchAntigravity()` 進行，其固定旗標自 1.0.17 起未變）；條目依 1.0.92 原始碼 `src/providers.mjs` 與 README〈agy「防寫」之邊界〉段核對：

| 項目 | 結果 |
|---|---|
| 預設模型 | `gemini-3.8-flash-high` → **`gemini-4-hydrogen-high`**（使用者 2026-11-13 指定；與 1.0.92 內建條目 `agy:gemini-4-hydrogen-high` 一致）。實呼 `skipPermissions: true` 讀中文檔第 1 行＋寫檔：13.5 秒、中文原樣讀回、檔案落地 |
| `agy models` | 18 項：Gemini 4 Argon 三檔、**Gemini 4 Hydrogen 四檔（high／xhigh／medium／low）**、`gemini-pro-orchestrator-g1-pro`（新見，未用）、3.8 Flash 三檔（仍在）、Claude Opus／Sonnet 5.5 各三檔、GPT-OSS 120B |
| `/effort` | Hydrogen：low, medium, high, **xhigh**（1.4.2 時尚無任何一支含 `xhigh`）；3.8、Argon、Claude 5.5 系：low, medium, high；`gpt-oss-120b`、`gemini-pro-orchestrator-g1-pro`：不可調。`xhigh` 檔本技能不採用、未實呼 |
| `agy --help` | `--effort` 值域與 1.4.2 同（`low\|medium\|high\|xhigh\|max`）；**新見** `--remote-agent`、`--settings`（session 專用之 settings.json 鍵）與子命令 `acp`，皆未實測、與本技能之派工無關 |
| `skipPermissions: false` | 實測只擋工作區外之寫入，工作區內寫入落地（見〈權限〉之同名小節），與套件 1.0.92 README 記載一致；舊文「唯讀檔位」「防寫鎖」之說法已改 |
| `providers.mjs`（1.0.92） | agy 條目 5 條（`agy:gemini-3.8-flash-high`、**`agy:gemini-4-hydrogen-high`**〔新〕、`agy:gemini-4-argon-high`、`agy:claude-sonnet-5-5-high`、`agy:claude-opus-5-5-high`），皆帶 `skipPermissions: false` 與 `addDirs: ['.']`；全表 38 條（2026-11-13 以 Grep 計 `src/providers.mjs` 之 `id:` 行） |
| 未重驗 | 本輪只就預設模型、型錄、`/effort`、`--help`、防寫邊界重驗；〈逾時分層〉等其餘各節仍依 1.0.80 之查核。**已知與 1.0.92 不符待另案更正**：1.0.92 起 `timeoutMs` 之無效值（超過 2147483647、`Infinity`、非十進位字串等）一律取各入口預設（300000），`--print-timeout` 之推導不再以計時器上限封頂（`src/dispatchAntigravity.mjs` 271～277 行與 README 第 73 條）；〈逾時分層〉第③層「以計時器上限封頂」一句為 1.0.80 時之說法 |

2026-11-07 對照：以 `w-dispatch-ai` **1.0.80** 之原始碼與 README 行為變更紀錄第 67、68 條核對（讀 `src/dispatchAntigravity.mjs`〔檔頭與程式本體〕、`src/subQuotaGate.mjs`、`src/quotaLedger.mjs`、`src/dispatchAiFallback.mjs` 檔頭；**未實際呼叫模型、未重跑 agy**，stdin 路徑之 agy 1.5.2 實測與 `/usage` 讀者耗時為套件同日之紀錄，本技能未重驗）：

| 項目 | 結果 |
|---|---|
| `dispatchAntigravity()` 固定旗標與自用鍵 | argv 路徑旗標順序不變（`--dangerously-skip-permissions`、`--print-timeout`、`--model`、`--effort`、`--add-dir`、`extraArgs`、`--print <prompt>`）；**新增自用鍵 `promptVia`**（自用鍵八個 → 九個），預設 `'auto'`：不超過 30,000 字元走 argv、逐位元不變，超過改走 stdin（旗標尾端改為 `--input-format stream-json --output-format stream-json`、不帶 `--print`）；結果新增 `raw` 欄（僅 stdin 路徑） |
| stdin 路徑 | 判成敗只看最後一個 `result` 事件，無 `result` 事件一律 `ok: false`（`errorType: 'exec'`，不受 `maxRetries` 重試）；`extraArgs` 衝突旗標回 `params`；agy 低於 1.1.15 回 `params` 並指引 `agy update`；輸入訊息形狀僅在 agy 1.5.2 實測；斜線指令在 stream-json 輸入下被 agy 拒絕 |
| `quotaGate`（1.0.79） | 擴及 antigravity 條目（無 `keys` 者），預設開：額度帳 → `getQuotaAntigravity` 查 `/usage` → 任一適用視窗 ≥95% 即略過；快取預設 300 秒、查詢逾時 60 秒；agy 額度字樣不內建；讀者失敗一律不擋 |
| 額度帳之帳號比對與重探（1.0.82） | 入帳時另記帳號識別（登入 email 之雜湊，帳內不存本文）；讀帳命中後依節流以讀者重探：有帳號識別之帳每 30 分鐘、無者之長視窗（距重置逾 6 小時）每 6 小時，節流起點記於帳、跨行程有效；帳號改變或重探之用量證據已低於門檻即作廢該帳並改依現況判定（換訂閱帳號後最長約 30 分鐘自動恢復）；讀者失敗、取不到帳號或無證據一律維持帳。要立即清帳：`forgetQuota(state 或 store, 'antigravity')`（`WDispatchAi.forgetQuota`；家族名、精確鍵或 `'*'`）。作廢時記 `quota-ledger-void` 事件（帳號只記雜湊前 8 碼） |
| `providers.mjs` | agy 條目仍 4 條（`agy:gemini-3.8-flash-high`、`agy:gemini-4-argon-high`、`agy:claude-sonnet-5-5-high`、`agy:claude-opus-5-5-high`）；全表 38 條（1.0.78 新增的 1 條為 `ocgo:`，與 agy 無關） |

2026-11-04 對照：以已發布的 `w-dispatch-ai` **1.0.73** 原始碼核對（取自 `npm pack` 之實際程式；**未實際呼叫模型、未重跑 agy**）：

| 項目 | 結果 |
|---|---|
| `dispatchAntigravity()` 固定旗標與自用鍵 | 旗標順序不變（`--dangerously-skip-permissions`、`--print-timeout`、`--model`、`--effort`、`--add-dir`、`extraArgs`、`--print <prompt>`）；**新增自用鍵 `spawnGate`**（與 `spawnGateKind` 同為 `runExecCli` 自用、不轉交 `execCli`），**呼叫方式不變** |
| `spawnGate` 預設 | `KIND_DEFAULT_LIMITED` 只有 `opencode`；antigravity 未給即守門為 no-op（不查 `tasklist`／`ps`、不取樣）。`agy.exe` 之 CPU 占用套件亦未量測，見〈逾時分層〉選項表 |

2026-10-18 查核：技能根實裝 `w-dispatch-ai` **1.0.53**，本機 agy 為 **1.4.2**。

| 項目 | 結果 |
|---|---|
| 必要預設值 | `gemini-3.8-flash-high` 維持不變；以 1.0.53 實跑「讀檔＋寫檔」通過（16.6 秒、中文原樣讀回、檔案落地） |
| **`printTimeout` 推導反轉（1.0.50）** | 由 `max(30, timeoutMs 秒數 − 30)` 改為 `timeoutMs 秒數 + 30`：外層先逾時，慢回合由 `ok: true` 的截斷輸出改為 `TIMEOUT` 失敗。本技能原有的「14370 秒」「30 秒下限」「內層先到」等說法已全數改寫 |
| `--print-timeout` 預設 | agy 1.4.2 `--help` 載明為 `0s`（等到完成；套件記錄 1.4.0 亦同），舊稱 `5m0s` 不符 |
| `--effort` 值域 | `--help` 擴為 `low\|medium\|high\|xhigh\|max`；以 `/effort` 實查 3.8 Flash、Gemini 4 Argon、Claude 5.5 系之 available 皆為 `low, medium, high`，`high` 仍為最深 |
| `agy models` 型錄 | 13 項：Gemini 4 Argon 三檔、3.8 Flash 三檔、Claude Opus／Sonnet 5.5 各三檔、GPT-OSS 120B；3.7／3.6 Flash、3.1 Pro、Claude 4.6 系已下架 |
| 未給 `model` 時 | agy 預設 Gemini 4 Argon (Medium)，耗用其獨立之 7 天額度（套件 2026-10-16 實測） |
| 權限被擋 | exit 0、stdout 空、jetski 訊息改在 stderr、權限名為 `write_file`；`nonempty` 擋得下（2026-10-18 實測） |
| `providers.mjs` | agy 條目由 1 條增為 4 條（新增 `agy:gemini-4-argon-high`、`agy:claude-sonnet-5-5-high`、`agy:claude-opus-5-5-high`），皆帶 `skipPermissions: false` 與 `addDirs: ['.']`、不帶 `effort`；全表由 17 條增為 21 條 |
| `validate` 與重試 | 1.0.49 起由套件自行判定（可回傳 Promise、與子進程共用 `timeoutMs`），規則名打錯仍被靜默忽略；子進程未能啟動一律 `spawn` 且不重試、遞補鏈整組跳過（1.0.48） |
| 控制回調 | `coolDetect`／`shouldStop` 為同步契約（回傳 Promise 視同 `false`）；`coolDetect` 宜先排除 `validation`；agy 額度用盡之字樣套件未驗證 |

2026-09-30 查核：npm 最新版 `w-dispatch-ai` 為 **1.0.40**（技能根實裝 1.0.39），本機 agy 為 **1.2.13**。

| 項目 | 結果 |
|---|---|
| 必要預設值 | `gemini-3.8-flash-high` 維持不變，當日於 1.2.13 實跑通過 |
| **`--effort` 值域擴充但不影響結論** | `--help` 由 `low|medium|high` 擴為 `low|medium|high|max`；但實測 3.8 Flash 之 available 仍只有 `low, medium, high`，**無任何 Gemini 接受 `max`**，故 `high` 仍為最深（三種傳法之錯誤訊息見「必要預設值」一節） |
| `agy models` 型錄 | 3.8 Flash 三檔 slug 仍在 |
| `providers.mjs` | `agy:gemini-3.8-flash-high` 條目不變（仍帶 `skipPermissions: false` 與 `addDirs: ['.']`），**且刻意不帶 `effort`**——套件同版把其他三家條目都補上 `high` 強度，agy 則因 slug 已內嵌檔位而不另帶（與本技能一致）；全表由 15 條增為 17 條 |

以下為 2026-09-23 於 agy 1.2.6 之查核（旗標表與型錄清單未於 1.2.13 逐項重驗，僅重查 `--effort` 與 3.8 slug）。

| 項目 | 結果 |
|---|---|
| `dispatchAntigravity()` 固定旗標與選項 | 與 1.0.17／1.0.22 相同（`--dangerously-skip-permissions`、`--print-timeout`、`--model`、`--effort`、`--add-dir`、`--print`），自用鍵仍為八個，**呼叫方式不變** |
| 必要預設值 | `gemini-3.8-flash-high` 維持不變，當日於 1.2.6 實跑通過；**當時 `--effort` 值域只有 `low|medium|high`**（1.2.13 已擴為含 `max`，但模型仍不支援，結論不變——見上表） |
| `agy models` 型錄 | 與 2026-09-03 查得之十四項**逐行相同**，3.8 Flash 三檔仍在 |
| `agy --help` | 與 references 之旗標表逐行相符，另多 `--remote-control`；子指令新增 `mic-serve`／`plugin`／`remote-control`，皆與非互動派工無關 |
| `providers.mjs` | `agy:gemini-3.8-flash-high` 條目不變（仍帶 `skipPermissions: false` 之防寫鎖與 `addDirs: ['.']`）；全表由 20 條縮為 15 條 |
