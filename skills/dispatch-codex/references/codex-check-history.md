# dispatch-codex：歷次查核對照表（自 SKILL.md〈安裝檢查〉移入）

本檔收 SKILL.md〈安裝檢查〉2026-11-13 及更早之各次對照表與實測紀錄（原文逐字自 SKILL.md 搬移，未刪改；其中「全表 N 條」「尚無 terra 條目」等為查核當日之狀態，不代表現況）。最新兩次對照（2026-11-23，w-dispatch-ai 1.0.110 與 1.0.109）留在 SKILL.md。

2026-11-13 查核：本機 Codex CLI **0.167.0**，技能根實裝 `w-dispatch-ai` **1.0.90**（npm 最新 1.0.92）；本輪只重驗「Windows 讀非 ASCII 檔案」一節：

| 項目 | 結果 |
|---|---|
| 讀中文檔（`read-only` 沙箱，`gpt-6.1-terra`／low，`--json` 事件比對，實呼 2 次） | `rg -n '^' -- <檔>`、`rg -n -m 3`、`rg -n -C 2 '<字>'`、`cmd /c type` 皆完好（含 1073 行完整檔，逐行與原檔一致、U+FFFD 0）；PowerShell 管線對照組失真（U+FFFD 81）。使用端回報之「`rg` 讀中文註解失真」**未能重現**，條件未留存；詳見該節〈重驗〉 |
| 驗收方式 | 派工加 `--json`，事件流之 `item.completed`（`command_execution`）`aggregated_output` 即 Codex 實際收到之內容（0.167.0 實測），不必翻 session 紀錄 |
| 未重驗 | 旗標表、型錄、沙箱擋寫、`dispatchCodex()` 與 1.0.91～1.0.92 之差異（未比對原始碼）；上表 0.156.1 之 `Get-Content` 等失真結果未於 0.167.0 重測 |

2026-11-07 對照：以 `w-dispatch-ai` **1.0.80** 之原始碼與 README 行為變更紀錄第 67 條核對（讀 `src/subQuotaGate.mjs`、`src/quotaLedger.mjs`、`src/dispatchAiFallback.mjs` 檔頭與 `dispatchCodex.mjs` 之自用鍵；**未實際呼叫模型**，讀者耗時為套件同日之本機實測紀錄，本技能未重驗）：

| 項目 | 結果 |
|---|---|
| `dispatchCodex()` 固定參數與自用鍵 | 不變（`exec`、`--sandbox`、`--skip-git-repo-check`、`-m`；自用鍵 `exe`／`model`／`sandbox`／`extraArgs`／`input`）；`quotaGate`／`quotaUntilOf` 為遞補層選項，不是本轉接器的自用鍵、不轉傳，**呼叫方式不變** |
| `quotaGate`（1.0.79） | 擴及 `codex` 條目（無 `keys` 者），預設開：額度帳 → `getQuotaCodex` → 任一適用視窗 ≥95% 即略過；codex 額度字樣不內建；讀者失敗一律不擋 |
| 額度帳之帳號比對與重探（1.0.82） | 入帳時另記帳號識別（登入 email 之雜湊，帳內不存本文）；讀帳命中後依節流以讀者重探：有帳號識別之帳每 30 分鐘、無者之長視窗（距重置逾 6 小時）每 6 小時，節流起點記於帳、跨行程有效；帳號改變或重探之用量證據已低於門檻即作廢該帳並改依現況判定（換訂閱帳號後最長約 30 分鐘自動恢復）；讀者失敗、取不到帳號或無證據一律維持帳。要立即清帳：`forgetQuota(state 或 store, 'codex')`（`WDispatchAi.forgetQuota`；家族名、精確鍵或 `'*'`）。作廢時記 `quota-ledger-void` 事件（帳號只記雜湊前 8 碼） |
| `providers.mjs` | codex 條目仍 3 條（`codex:gpt-5.6-luna`、`codex:gpt-6.1-terra`、`codex:gpt-6.1-sol`）；全表 38 條（1.0.78 新增的 1 條為 `ocgo:`，與 codex 無關） |

2026-11-04 對照：以已發布的 `w-dispatch-ai` **1.0.73** 原始碼核對（取自 `npm pack` 之實際程式；**未實際呼叫模型**，守門之 CPU 實測為套件同日之紀錄，本技能未重驗）：

| 項目 | 結果 |
|---|---|
| `dispatchCodex()` 固定參數與自用鍵 | 固定參數不變（`exec`、`--sandbox`、`--skip-git-repo-check`、`-m`）；**新增自用鍵 `spawnGate`**（與 `spawnGateKind` 同為 `runExecCli` 自用、不轉交 `execCli`），**呼叫方式不變** |
| `spawnGate` 預設 | `KIND_DEFAULT_LIMITED` 只有 `opencode`；codex 未給即守門為 no-op（不查 `tasklist`／`ps`、不取樣）。依據為現役 `codex.exe` 之觀察，**未以真實 `codex exec` 派工量測** |

2026-10-28 追加：`w-dispatch-ai` **1.0.59** 新增條目 `codex:gpt-6.1-terra`（`sandbox: 'read-only'`、強度 `high`，排在 luna 之後、sol 之前；欄位比照 sol）。`dispatchCodex()` 未變。唯讀沙箱金絲雀未對 terra 重測（沿用 sol 條目之實測）。

2026-10-27 查核：本機 Codex CLI **0.163.0**，技能根實裝 `w-dispatch-ai` **1.0.55**（npm 最新 1.0.57；`dispatchCodex()` 未變）。

| 項目 | 結果 |
|---|---|
| 必要預設模型 | `gpt-6.1-sol` → **`gpt-6.1-terra`**（使用者指定；OpenAI 同日發表）。`-m gpt-6.1-terra -c model_reasoning_effort="max"` 實跑通過，CLI 標頭回報 `model: gpt-6.1-terra`／`reasoning effort: max`；`dispatchCodex`＋`workspace-write` 以 `rg` 讀中文檔並寫檔通過（29 秒） |
| 型錄 | 10 支；`gpt-6.1-terra` 為 priority 3、預設 effort `low`、脈絡 500K（見「模型驗證」） |
| `providers.mjs` | 當時尚無 terra 條目（1.0.59 起才有，見上段），codex 為 `codex:gpt-5.6-luna`、`codex:gpt-6.1-sol` |

本次未重驗旗標表、沙箱與 Windows 讀非 ASCII 檔案之實測表（除上列 `rg` 讀中文外）。

2026-10-18 查核：技能根實裝 `w-dispatch-ai` **1.0.53**，本機 Codex CLI 為 **0.163.0**。

| 項目 | 結果 |
|---|---|
| `dispatchCodex()` 固定參數與自用鍵 | 不變（`exec`、`--sandbox`、`--skip-git-repo-check`、`-m`），**呼叫方式不變** |
| 必要預設值 | `gpt-6.1-sol` ＋ `model_reasoning_effort="max"` 維持不變；以 1.0.53、`sandbox: 'workspace-write'` 實跑「以 `rg` 讀中文檔＋寫檔」通過（69 秒、中文原樣讀回、檔案落地；CLI 標頭回報 `model: gpt-6.1-sol`） |
| 型錄 | 9 支，`gpt-6.1-sol` 仍為 priority 1、預設 effort `low`；`gpt-5.5` 已移除（見「模型驗證」） |
| `providers.mjs` | `codex:gpt-5.6-luna` 與 `codex:gpt-6.1-sol` 兩條不變，皆帶 `sandbox: 'read-only'` 與 `model_reasoning_effort="high"`；全表由 17 條增為 21 條（增加的是 opencode 與 agy 條目） |
| `validate` | 1.0.49 起由套件自行判定（`src/runExecCli.mjs`）：可回傳 Promise、與子進程共用 `timeoutMs`，拋錯與逾時回 `validation`；規則名打錯仍被靜默忽略。「靜默失敗警語」要求的自訂驗證函數因此也可以是 async |
| 啟動失敗與重試 | 1.0.48 起子進程未能啟動一律回結果物件（`spawn`，此前部分情形 reject），不重試、遞補鏈整組跳過；`env` 不可讀回 `params` |
| 控制回調 | `coolDetect`／`shouldStop` 為同步契約（回傳 Promise 視同 `false`）；`coolDetect` 宜先排除 `validation` |

本次未於 0.163.0 重驗旗標表與 Windows 讀非 ASCII 檔案之實測表；`rg` 讀中文於本次探測仍完好。

2026-09-27 補查：技能根實裝 `w-dispatch-ai` 1.0.39，`src/dispatchCodex.mjs` 之參數與固定旗標與 1.0.34 相同（`exe`／`model`／`sandbox`／`extraArgs`／`timeoutMs`／`cwd`／`validate`／`maxRetries`，旗標順序 `exec` → `--sandbox` → `--skip-git-repo-check` → `-m` → `extraArgs`）；Codex CLI 0.156.1。同日實測沙箱內 PowerShell 為受限語言模式與中文讀法（見「Windows 讀非 ASCII 檔案」），並新增「提示詞之限制句」一節。

2026-09-30 查核：npm 最新版為 `w-dispatch-ai` **1.0.40**（技能根實裝 1.0.39）、Codex CLI **0.159.2**。

| 項目 | 結果 |
|---|---|
| `dispatchCodex()` 固定參數與選項 | 與 1.0.17 起各版相同（`exec`、`--sandbox`、`--skip-git-repo-check`、`-m`），**呼叫方式不變** |
| 必要預設模型 | `gpt-6-sol` → **`gpt-6.1-sol`**（使用者指定）。以 `-m gpt-6.1-sol -c model_reasoning_effort="max" --sandbox read-only` 實跑通過，CLI 標頭回報 `model: gpt-6.1-sol`／`reasoning effort: max` |
| 型錄重排 | `gpt-6.1-sol` 升為 priority 1、預設 effort 為 `low`；`gpt-6-sol` 退為 priority 3 並改標為前代（見「模型驗證」） |
| 推理值域 | 沿用 2026-09-23 由 API 400 錯誤訊息取得之權威清單：`none`／`minimal`／`low`／`medium`／`high`／`xhigh`／`max`；型錄另列 `ultra`（編排模式非更深推理） |
| `providers.mjs` | `codex:gpt-6-sol` 已換成 **`codex:gpt-6.1-sol`**（套件同日跟進使用者指示），與 `codex:gpt-5.6-luna` 並存；**兩條都新增自帶推理強度 `['--config','model_reasoning_effort="high"']`**——是 `high` 不是本技能的 `max`，照抄條目要自己覆寫。全表由 15 條增為 17 條 |
| 條目為何寫全名不寫別名 | 套件條目註解記載：Codex 沒有「最新版 sol」之別名（官方 Models 文件未載、`model/list` 各筆亦無別名欄位且 `upgrade` 為 null），不給 `-m` 則改用執行機 `config.toml` 之 model（實測不帶 `-m` 時跑 `gpt-5.6-sol`），故新版發布時**必須手動換 slug** |

Codex 0.152.1 相對 0.149.0 之派工相關差異（沿用前次查核）：`--full-auto` 已移除（實測回 `unexpected argument`），新增 `--enable`／`--disable`／`--approve-for-me`／`--dangerously-bypass-hook-trust`／`--thread-source`／`--color`；詳見 references。**0.156.1 未重新逐項比對旗標表**，Windows elevated 沙箱之行為亦維持 0.149／0.152.1 之查核結論（本機 `setup_marker.json` 存在，`--sandbox read-only` 於 0.156.1 實跑正常）。
