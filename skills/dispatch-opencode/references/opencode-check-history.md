# dispatch-opencode：歷次查核對照表（自 SKILL.md〈安裝檢查〉移入）

本檔收 SKILL.md〈安裝檢查〉2026-11-13 及更早之各次對照表與實測紀錄（原文逐字自 SKILL.md 搬移，未刪改；其中「全表 N 條」「opencode N 條」「`oc:` N 條」「`WDispatchAi` N 個鍵」「`ocgo:` 9 條」等為查核當日之狀態，不代表現況）。最新一次對照（2026-11-23，w-dispatch-ai 1.0.109）留在 SKILL.md。

2026-11-13 對照（Gitea #141）：本機 opencode **1.19.5**，技能根實裝 `w-dispatch-ai` **1.0.90**（讀原始碼庫 1.0.92 之 `dispatchOpencode.mjs`、`parseOpencodeEvents.mjs`、`failureDiag.mjs` 核對 `finish` 之來源）。只重查「權限被自動拒絕」之行為：實呼免費模型 `deepseek-v4.1-flash-free` 共 21 次（各設定之最小重現與補充探測，結果見〈`ask` 被自動拒絕＝整個工作階段結束〉），另以 `opencode agent list` 注入各 `config` 查生效規則、自執行檔內之程式字串核對 `continue_loop_on_deny` 之鍵名與位置；其餘段落未重驗。

2026-11-07 對照：以 `w-dispatch-ai` **1.0.80** 之原始碼與 README 行為變更紀錄第 66～68 條核對（讀 `src/providers.mjs` 檔頭與 `ocgo:` 條目、`src/filterOpencodeFree.mjs`、`src/subQuotaGate.mjs`、`src/goQuotaGate.mjs`、`src/dispatchAiFallback.mjs` 檔頭；條目數以唯讀腳本對 `providers` 實際計數；**未重跑 opencode、未實際呼叫模型**，條目註解所載之金絲雀與逐模型額度的實測皆為套件或提出端於 2026-11-07 的紀錄，本技能未重驗）：

| 項目 | 結果 |
|---|---|
| `providers.mjs` | 全表 **38 條**（byKind：opencode 19、claude 5、antigravity 4、codex 3、api-anthropic 3、api-typesafe-systemone 2、api-openai-compat 2）；`oc:` 10 條與 1.0.72 同 id、同順序；`ocgo:` 由 8 條增為 9 條（`beam-free` 之後新增 `crouton-alpha-free`，`detectTruncation: true`、`--variant high`）；19 條 opencode 條目權限皆為 `{ edit:'deny', bash:'ask' }` |
| 匯出 | `WDispatchAi` 仍 **34** 個鍵 |
| Go 型錄 | 2026-11-07 公開型錄 30 個＝已收 9＋未收 21（套件記載之漂移：新增 `hy4`〔未收〕與 `crouton-alpha-free`〔已收〕，公開型錄已無 `mimo-v2.5`／`mimo-v2.5-pro`）；官方月額表入套件檔頭（未實測） |
| 免費額度 | 診斷段改為**逐模型計**（提出端 2026-11-07 實測），原「整個免費層暫不可用」之說法已更正；免費池核對：`/zen/v1/models` 單價 0 者 11 個、目錄 `oc:opencode/*` 收 8 個皆仍在，另 3 個未收（`crouton-alpha-free`、`iceman-free`、`inkling-2-small-free`） |
| `quotaGate`（1.0.79） | 擴及訂閱類條目（claude 無金鑰者、codex、antigravity），預設開；Go 條目判定、快取、事件逐案不變，`quota-skip` 事件與 `tried` 項多 `source` 欄；`goQuotaGate.mjs` 檔頭新增「用量端點只回整把金鑰百分比」之限制（不改行為） |
| `filterOpencodeFree` | 讀 1.0.80 原始碼：只判 `kind` 為 `opencode` 且 `model` 以 `opencode/` 開頭者，其餘含 `free` 字樣者歸 `unchecked`；故 `ocgo:` 條目中含 `free` 字樣者現為三條（`beam-free`、`crouton-alpha-free`、`iceman-contributor-free`，此前兩條），皆歸 `unchecked`（讀碼所得，未實跑） |
| `dispatchOpencode()` | README 第 66～68 條未涉及此轉接器；1.0.80 僅改 `dispatchAntigravity` |

2026-11-04 對照：以已發布的 `w-dispatch-ai` **1.0.73** 原始碼核對（取自 `npm pack` 之實際程式，讀 `src/cliSpawnGate.mjs`、`src/goQuotaGate.mjs`、`src/runExecCli.mjs`、`src/dispatchAiFallback.mjs`、`src/dispatchOpencode.mjs`、`src/WDispatchAi.mjs`、`src/providers.mjs` 與 README 新段；**未重跑 opencode、未實際呼叫模型**，守門與 Go 用量之實測數字為套件於同日之紀錄，本技能未重驗）：

| 項目 | 結果 |
|---|---|
| `spawnGate` | 新增。預設啟用之 kind 只有 `opencode`（`KIND_DEFAULT_LIMITED`），claude／codex／antigravity 預設不限；預設值與行為已寫入〈逾時與等待〉選項表 |
| `quotaGate` | 新增。只作用於 `ocgo:` Go 條目且有金鑰者；門檻各 95、快取 60000 ms、查詢逾時 5000 ms；取代原「遞補層不接用量」之說法 |
| `providers.mjs` | 全表仍 **37 條**（`oc:` 10、`ocgo:` 8），條目未動 |
| 匯出 | `WDispatchAi` 仍 **34** 個鍵，不新增守門相關匯出 |
| `dispatchOpencode()` | 固定參數順序（`run` → `--agent <值>` → `-m` → `extraArgs`）未變；多一個自用鍵 `spawnGate`（與 `spawnGateKind` 同為 `runExecCli` 自用、不轉交 `execCli`） |

2026-11-03 對照：以已發布的 `w-dispatch-ai` **1.0.72** 原始碼核對（讀 `src/providers.mjs`、`src/WDispatchAi.mjs`、`src/opencodeGoUsage.mjs` 與兩份檔頭；**未重跑 opencode**，條目註解所載的實測皆為套件於 2026-11-03 以 opencode 1.19.5 所做）：

| 項目 | 結果 |
|---|---|
| `providers.mjs` | 全表 **37 條**（byKind：opencode 18、claude 5、antigravity 4、codex 3、api-anthropic 3、api-typesafe-systemone 2、api-openai-compat 2）；`oc:` 10 條與 1.0.60 同 id、同 variant；新增 `ocgo:` 8 條；18 條 opencode 條目權限皆為 `{ edit:'deny', bash:'ask' }` |
| 匯出 | `WDispatchAi` 共 **34** 個鍵，相對 1.0.71 新增 `opencodeGoUsage`（33 → 34） |
| `zen:jev-1.13-free` | `baseURL` 為 `https://opencode.ai/inference/systemone/v1`；檔頭改稱 OpenCode Console，並補 429 `FreeUsageLimitError`／`Policy budget exceeded`、400 `MissingSessionID` 診斷 |
| `dispatchOpencode()` | 自用鍵與預設（`exe: opencode`、`agent: build`）未變；Go 不需改轉接器 |

2026-10-19 查核：技能根實裝 `w-dispatch-ai` **1.0.54**，本機 opencode 為 **1.19.3**。

| 項目 | 結果 |
|---|---|
| **必要預設值更換（使用者指示）** | `opencode/beam-free` ＋ `max` 改為 **`opencode/deepseek-v4.1-flash-free` ＋ `--variant max` ＋ 匿名**；型錄確認 `status: active`、`toolcall: true`、variants `low`／`high`／`max`、脈絡窗 200,000、輸出 32,000；以 1.0.54 實跑讀中文檔＋寫檔兩次皆通過（21.8 秒、18.2 秒，檔案落地），`opencode export` 之工作階段紀錄兩次皆為 `deepseek-v4.1-flash-free`／variant `max` |
| 脈絡限制 | 套件條目註解（同日實測）：伺服器實收約 239K、本機約 168K 起自動壓縮且 stdout 混入摘要仍 `ok: true`；長提示詞控制在約 160K 以下（見〈必要預設值〉） |
| `providers.mjs` | 全表由 21 條增為 **24 條**；`kind: 'opencode'` 者由 9 條增為 **12 條**、自家條目由 7 條增為 **10 條**：新增 `nemotron-3-ultra-free`、`nemotron-3.5-lightning-free`、`nemotron-3.5-super-vl-free`（排在 opencode 免費條目之末），`space-bunny-free` 以原位改為 `minimax-m3.1-flash-free`（同一模型恢復真名，舊 id 呼叫回 `UnknownError`） |
| `dispatchOpencode()` | 固定參數與自用鍵不變（README 行為變更紀錄第 38、39 條只涉及條目） |

2026-10-18 查核：技能根實裝 `w-dispatch-ai` **1.0.53**，本機 opencode 為 **1.19.3**。以 `opencode models opencode --verbose` 重查型錄，並讀 1.0.53 原始碼核對（未重跑旗標表）：

| 項目 | 結果 |
|---|---|
| **必要預設值更換** | `opencode/muse-spark-1.3-contributor-free` ＋ `--variant xhigh` **已失效**（不在型錄、套件移除條目），改為 **`opencode/beam-free` ＋ `--variant max` ＋ 匿名**；型錄確認 `status: active`、`toolcall: true`、variants `low`／`medium`／`high`／`xhigh`／`max`；以 1.0.53 實跑讀中文檔＋寫檔兩次皆通過（8.3 秒、11.4 秒，檔案落地） |
| `dispatchOpencode()` 固定參數與自用鍵 | 不變（`run` → `--agent <值>` → `-m` → `extraArgs`），**呼叫方式不變** |
| `providers.mjs` | 全表 **21 條**；`kind: 'opencode'` 者由 7 條增為 **9 條**，自家條目由 5 條增為 **7 條**且仍全為匿名：新增 `longcat-2.5-preview-free`、`beam-free`、`deepseek-v4.1-flash-free`、`glm-5.3-flash-free`，移除 `muse-spark-1.2`／`1.3-contributor-free`；有檔位者仍帶 `--variant high`，唯讀鎖仍為 `{ edit:'deny', bash:'ask' }` |
| REST 側 | `zen:space-bunny-free` 已移除（免費層閘門之例外收回、REST 一律 403）；`zen:jev-1.13-free` 之 `baseURL` 改為 `https://opencode.ai/inference/v1` |
| 被擋下的回覆長相 | beam-free、deepseek-v4.1-flash-free 寫檔被唯讀鎖擋下時回空字串而 `ok: true`（套件金絲雀），須掛 `validate: 'nonempty'` |
| `validate` | 1.0.49 起由套件自行判定（`src/runExecCli.mjs`）：可回傳 Promise、與子進程共用 `timeoutMs`，拋錯與逾時回 `validation`；規則名打錯仍被靜默忽略 |
| 啟動失敗與參數 | 1.0.48 起子進程未能啟動一律回結果物件（`spawn`），不重試、遞補鏈整組跳過；`config` 不可序列化或 `env` 不可讀回 `params`（此前 reject） |
| 控制回調 | `coolDetect`／`shouldStop` 為同步契約（回傳 Promise 視同 `false`）；`coolDetect` 宜先排除 `validation`；`onEvent` 的 rejection 被承接 |

2026-09-08 於本機 `opencode-ai` 1.18.29 查核：`opencode run` 之旗標（`--agent`、`-m`、`--variant`、`--dir`、`--auto`、`--format`、`--file`）皆與本技能所載一致。

2026-09-30 查核：本機 opencode 為 **1.18.33**、`w-dispatch-ai` 最新為 **1.0.40**（技能根實裝 1.0.39）。以 `opencode models opencode --verbose` 重查預設模型之型錄，並讀 1.0.40 原始碼核對（未重跑旗標表）：

| 項目 | 結果 |
|---|---|
| 必要預設值 | `opencode/muse-spark-1.3-contributor-free` ＋ `--variant xhigh` 維持不變；型錄重查確認 `status: active`、`reasoning: true`、`toolcall: true`、variants 仍為 `minimal`／`low`／`medium`／`high`／`xhigh`（**最深是 `xhigh`，沒有 `max`**） |
| 以預設值實跑 | `opencode run --agent build -m opencode/muse-spark-1.3-contributor-free --variant xhigh` 回覆正確 |
| `providers.mjs` | 全表由 15 條增為 **17 條**；`kind: 'opencode'` 者由 6 條增為 **7 條**（新增 `oc:opencode/space-bunny-free`），自家條目由四條增為五條且仍全為匿名 |
| **條目新增自帶 variant** | 有檔位的三條（muse-spark 1.2／1.3、space-bunny）帶 `['--variant','high']`；`big-pickle`、`mimo` 與第三方兩條無檔位故不帶。**是 `high` 不是本技能的 `xhigh`** |
| REST 側 | 新增 `zen:space-bunny-free`（`api-openai-compat`），是對話型免費模型中少數 REST 可通者——免費層閘門對它未套用（匿名與帶金鑰皆 200），**但套件註解明寫此例外可能隨時收回**；其 `max_tokens` 刻意設 32768 而非慣例的 8192，因推理 token 計入該上限，8192 易截斷 |
| 唯讀鎖 | 仍為 `{ edit:'deny', bash:'ask' }`，未再變動 |

以下為 2026-09-23 於 opencode 1.18.31 ＋ 套件 1.0.34 之查核（部分項目已被上表取代，保留以對照沿革）：

| 項目 | 結果 |
|---|---|
| `dispatchOpencode()` 固定參數 | 與 1.0.17 起各版相同（`run` → `--agent <值>` → `-m` → `extraArgs`），**呼叫方式不變**；自用鍵多一個 `useStoredAuth` |
| 必要預設值 | `opencode/muse-spark-1.3-contributor-free` ＋ `--variant xhigh` 維持不變；型錄重查確認 `status: active`、`toolcall: true`、variants 仍為 `minimal`／`low`／`medium`／`high`／`xhigh`（**最深是 `xhigh`，沒有 `max`**）、脈絡窗 1,048,576、費用 0 |
| `providers.mjs` | 全表由 20 條縮為 **15 條**；`kind: 'opencode'` 者仍 6 條但內容換血（移除 deepseek 與 union-alpha，新增 big-pickle 與 mimo-v2.6-flash-free），四個自家條目改為匿名（`useStoredAuth: false`），全部不帶 `timeoutMs` |
| **唯讀鎖改法** | 由 `{ edit:'deny', write:'deny', bash:'deny' }` 改為 **`{ edit:'deny', bash:'ask' }`**——`deny` bash 會觸發免費層閘門而 403，`ask` 在非互動下等同拒絕仍是機械鎖（前提：呼叫端不可加 `--auto`） |
| `resolveProviders()` | 回傳為 `{ providers, table, skipped, missing, hints }`，另有 `exes`／`patch` 後處理選項 |
| `src/quota/` | 三支訂閱額度查詢函數，**不含 opencode** |
| `errorType` | CLI 類實際用得到的仍只有 `params`／`timeout`／`spawn`／`validation`／`exec` 五種 |
| 條目之版本漂移 | 1.0.25 把 Agnes 由 2.5 換成 3.0；1.0.26 新增 union-alpha；**1.0.34 移除 union-alpha 與 deepseek、新增 big-pickle 與 mimo-v2.6-flash-free、自家條目全改匿名**。**轉接器不動、條目一直動**，故 id 一律對安裝版核對 |
