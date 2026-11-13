# OpenCode CLI 派工參考

以下內容於 2026-10-19 透過這些來源驗證（首建於 2026-09-02 之 1.18.26，2026-09-08 於 1.18.29 改寫模型章節，2026-10-18 重查旗標表）：

- 本機 `opencode` 1.19.3
- 本機 `opencode run --help`、`opencode models --refresh`、`opencode models opencode --verbose`、`opencode session list`／`opencode export`
- `w-dispatch-ai` 1.0.54 之 `src/providers.mjs` 條目註解（各免費模型之實測紀錄）
- [OpenCode 官方 CLI 文件](https://opencode.ai/docs/cli/)
- [OpenCode 官方模型與 variant 文件](https://opencode.ai/docs/models/)

`opencode auth list`、`opencode agent list` 與第三方供應商之實測沿用 2026-09-08 之結果（見各節日期）。

2026-11-03 增補（OpenCode Go 與 Console 改名兩節）之來源：已發布的 `w-dispatch-ai` **1.0.72** 之 `src/providers.mjs`、`src/dispatchOpencode.mjs`、`src/opencodeGoUsage.mjs` 檔頭與條目註解（其中〔本機實測〕為套件於 2026-11-03 以 opencode 1.19.5 對官方 Console 文件與已訂閱 Go 之金鑰所做；本檔**未重跑**）。

2026-11-07 增補（`crouton-alpha-free`、Go 型錄漂移與未收清單、免費額度逐模型計三處）之來源：`w-dispatch-ai` **1.0.80** 之 `src/providers.mjs` 檔頭與條目註解、`src/filterOpencodeFree.mjs`（其中〔本機實測〕與逐模型額度為套件或提出端於 2026-11-07 以 opencode 1.19.5 所做；本檔**未重跑**）。

## 非互動語法

```text
opencode run [message..]
```

未提供位置 message 時，目前版本的 OpenCode 會從 stdin 讀取內容。`dispatchOpencode()` 使用 stdin，因此長篇與多行提示詞不會遇到命令列長度與引號問題。

## 必要模型與 variant

```text
--model opencode/deepseek-v4.1-flash-free --variant max
```

另以 `useStoredAuth: false` 匿名取用（見 SKILL.md「免費模型走匿名」）。2026-10-19 之型錄（1.19.3，`opencode models opencode --verbose`）：

```text
供應商／模型：opencode/deepseek-v4.1-flash-free
名稱：DeepSeek V4.1 Flash Free
狀態：status: active（release_date 2026-09-10）
能力：reasoning: true、toolcall: true；輸入可為文字與圖片
variant：low、high、max
脈絡窗：200,000；最大輸出：32,000
費用：input／output 皆 0
```

`max` 是此項目最深的一檔（這支沒有 `medium`、`xhigh`）。**不傳 `--variant` 就是跑供應商預設，不是 `max`。** 2026-10-19 依使用者指示由 `opencode/beam-free` 換上；更早的 `opencode/muse-spark-1.3-contributor-free` 已自型錄消失，見下方「已確認不可用之項目」。**脈絡限制**：伺服器實收輸入約 239K token，但預設設定下 opencode 約 168K 起就在本機自動壓縮、stdout 混入摘要而仍 `ok: true`，長提示詞控制在約 160K 以下（細節見 SKILL.md〈必要預設值〉）。

**同名的另一條路**：`opencode models --refresh` 另列 `nvidia/deepseek-ai/deepseek-v4.1-flash`，走 NVIDIA 供應商、需要 NVIDIA 憑證，不是本技能的預設，本技能未實跑；`cline/deepseek/deepseek-v4-flash` 型錄為 `reasoning: false`、無 variant（見下表）。

### `opencode` 供應商之免費模型（2026-10-19 型錄，皆 `status: active`、`toolcall: true`、費用 0）

| 模型 ID | variants | 脈絡窗／最大輸出 | 實測 |
|---|---|---|---|
| `opencode/deepseek-v4.1-flash-free` | low／high／max | 200,000／32,000 | **本技能必要預設值**。2026-10-19 以 `--variant max`、匿名跑讀中文檔＋建檔兩次皆通過（21.8 秒、18.2 秒，檔案落地、中文原樣往返），工作階段紀錄確認 variant 為 `max` |
| `opencode/beam-free` | low／medium／high／xhigh／max | 1,048,576／131,072 | 套件條目；2026-10-18 以 `--variant max`、匿名跑讀中文檔＋建檔兩次皆通過（8.3 秒、11.4 秒）；10-18 至 10-19 曾為預設 |
| `opencode/glm-5.3-flash-free` | low／high／max | 200,000／32,000 | 套件條目；上游不穩（10 次中 4 次約 80 秒後失敗） |
| `opencode/flint-40b-free` | low／medium／high／xhigh／max | 262,144／65,536 | 套件條目（1.0.60 起，條目帶 `--variant high`）；2026-10-30 實測簡答約 5～6 秒、讀檔 25 秒；high 與 low 之推理 token 皆 0，未見檔位差異；只收文字輸入 |
| `opencode/big-pickle` | 無 | 200,000／32,000 | 套件條目 |
| `opencode/mimo-v2.6-flash-free` | 無 | 200,000／32,000 | 套件條目 |
| `opencode/nemotron-3.5-lightning-free` | 無 | 262,144／262,144 | 套件條目（1.0.54 起）；NVIDIA 免費端點，勿送個人或機密資料 |
| `opencode/nemotron-3.5-super-vl-free` | none／minimal／low／medium／high／xhigh | 1,048,576／131,072 | 套件條目（1.0.54 起）；同上 |

**2026-11-07 重查（套件記載）**：`opencode models opencode --refresh` 列 11 個免費模型（匿名 `GET …/zen/v1/models` 單價 0 者亦為 11 個），目錄 `oc:opencode/*` 收 8 個皆仍在（`filterOpencodeFree(providers, { refresh: true })` 回 `removed` 為空），`uncatalogued` 為 3 個：`opencode/crouton-alpha-free`（同一模型已另以 Go 路徑收為 `ocgo:opencode-go/crouton-alpha-free`）、`opencode/iceman-free`、`opencode/inkling-2-small-free`。這 3 個未收（收錄須簡答、推理題、read、寫檔金絲雀、型錄欄位、REST 對照與脈絡長度全數實測），上表只涵蓋已收的 8 個。

各模型的檔位名稱並不一致（有的只到 `high`、有的跳過 `medium`、有的到 `xhigh` 為止、有的沒有檔位），換模型時以 `--verbose` 實查，不要套用別支的檔位。型錄上新出現、尚未收為套件條目的，用之前先照下節查核並實跑。

**組遞補鏈或評比名單前，先以 `wda.filterOpencodeFree(providers)` 對一次**（w-dispatch-ai 1.0.60 起）：它以 `opencode models` 之輸出篩出目錄中確實仍供應之免費條目，回 `available`／`removed`（目錄有、CLI 型錄已無）／`unchecked`／`uncatalogued`（CLI 有、目錄未收）；查詢失敗（`opencode` 不存在、非零離開、逾時、空輸出）回 `ok: false` 與 `errorType`，各清單為 `null`——**不可把 `null` 當成「全部下架」**。`refresh: true` 會加 `--refresh` 重抓型錄（`opencode models` 有本機快取，剛下架者可能仍列一次）。型錄有列仍不等於可用（見下節 nvidia 之例），關鍵派工仍以實跑為準。**它只判 `model` 以 `opencode/` 開頭的條目**（讀 1.0.80 原始碼所得，未實跑）：`ocgo:` 的 `opencode-go/…` 前綴不符，含 `free` 字樣的 `beam-free`、`iceman-contributor-free` 兩條（1.0.85 移除 `crouton-alpha-free` 前為三條）會列入 `unchecked`（不判下架；Go 條目之下架由套件之連網守門測試對照官方 Go 型錄發現），其餘 Go 條目不含 `free` 字樣、不被處理。

### 已確認不可用之項目

| 項目 | 實測結果 |
|---|---|
| `opencode/minimax-m3.1-flash-free`、`longcat-2.5-preview-free`、`nemotron-3-ultra-free` | 2026-10-29／30 已自 CLI 型錄消失（`--refresh` 亦不列），依條目呼叫約 1.5～2 秒回 `UnknownError`；匿名 REST 對 minimax 回 400 `Model is unavailable`；`w-dispatch-ai` 1.0.60 移除三條（issue #25） |
| `opencode/space-bunny-free` | 2026-10-19 已自 CLI 型錄與官方文件消失、呼叫回 `UnknownError`；同一模型恢復真名為 `opencode/minimax-m3.1-flash-free`，套件 1.0.54 以新 id 置於原位（該 id 亦於 1.0.60 下架，見上列） |
| `opencode/muse-spark-1.3-contributor-free` | 2026-10-18 已不在 1.19.3 之型錄，呼叫即敗；`w-dispatch-ai` 1.0.53 移除條目（官方文件改列付費之 `muse-spark-1.3`）。**曾為本技能必要預設值** |
| `opencode/muse-spark-1.2-contributor-free` | 2026-09-30 起自 CLI 型錄消失、呼叫回 `UnknownError`；套件 1.0.42 移除條目 |
| `opencode/ling-3.1-flash-free`、`fledge-alpha-free`、`cat-jam-free`、`step-5-preview-free` | 套件 1.0.42 之後收錄、數週內自 CLI 型錄與官方文件消失（呼叫回 `UnknownError`），已移除條目 |
| `nvidia/deepseek-ai/deepseek-v4-flash` | 2026-09-08：HTTP 410 `Gone`，`detail` 為 has reached its end of life on 2026-08-07 |
| `nvidia/deepseek-ai/deepseek-v4-pro` | 同上 410 |
| `nvidia/deepseek-ai/deepseek-v4-flash-0731`、`…/deepseek-v4-pro-0813` | 2026-09-08：403 `Authorization failed` |
| `nvidia/poolside/laguna-xs-2.1` | 2026-09-08：403 `Authorization failed` |
| `cline/deepseek/deepseek-v4-flash` | 型錄為 `reasoning: false`、`variants: {}`，無推理變體 |
| **所有免費模型之 REST 路徑** | **2026-09-17 起一律 403 `FreeTierError`**（`OpenCode's free tier can only be used from within OpenCode`）——維護者於 issue #49580 明示這是刻意的反濫用政策，付費模型不受限。**屬政策非故障，再等再試也不會通**，只能走 `oc:` CLI 版。2026-11-03：OpenCode Zen 已改稱 **OpenCode Console**，官方 Console 文件（`api/inference`、`harnesses` 頁）現已載明同一政策（免費對話模型離開 OpenCode 一律 403，即使帶金鑰）；但同日實測 REST 直呼免費對話模型是**先遇 429 `FreeUsageLimitError`**（該免費模型之額度用盡；同一模型的 CLI 與 REST 共用該模型之額度，額度**逐模型計**、非整個免費層共用一池，2026-11-07 提出端實測），兩者並存時的先後次序未驗證，429 的處置見 SKILL.md〈Console（原 Zen）免費層閘門〉。`w-dispatch-ai` 1.0.34 因此把大量 `zen:` REST 條目移除；唯一曾通的 `zen:space-bunny-free` 也於 2026-10-13 因例外收回而移除。`/systemone` 端點的決策模型不受此限（2026-09-22 實測帶金鑰或匿名皆 200） |
| `opencode/union-alpha`、`opencode/deepseek-v4-flash-free` | 1.0.34 起已自 `providers` 表移除（union-alpha 曾於 1.0.26 收錄；deepseek-v4-flash-free 則 2026-08-21 即實測 `UnknownError`） |

照抄已移除的條目 id 會在 `resolveProviders` 的 `pick` 落入 `missing`。**nvidia 那四項在同一天的 `opencode models nvidia --refresh` 中照樣列得出來**——型錄查得到不等於供應商還在服務；muse-spark 則是型錄先拿掉。兩種方向都有，所以查型錄之外一定要實跑。

### 供應商沒設定就等於模型不存在——但可用 `config` 當場注入

`opencode models` 只列出**已認證或已在設定中定義**之供應商的模型。2026-09-08 本機（`opencode auth list` 顯示 Nvidia、cline 兩筆憑證，加上內建 `opencode`）共 111 項模型、僅此三家。查未設定的供應商回 `Error: Provider not found: <名稱>`；硬用 `-m <該供應商>/<模型>` 派工則回 `UnknownError`（伺服器錯誤），訊息不會告訴你是沒認證。

**但這兩種錯誤都不等於「該模型不能用」**：轉接器的 `config` 選項會為當次程序注入 provider 定義，型錄查不到照樣派得動。`w-dispatch-ai/src/providers.mjs` 內建的第三方條目即為此形式（需 `config` 帶 provider 定義）：

| 條目 id | `model` | `provider` | 金鑰環境變數 | baseURL | npm 轉接器 |
|---|---|---|---|---|---|
| `oc:agnes-ai/agnes-3.0-flash` | `agnes-ai/agnes-3.0-flash` | `agnes-ai` | `AGNES_KEYS` | `https://apihub.agnes-ai.com/v1` | `@ai-sdk/openai-compatible` |
| `oc:poolside/poolside/laguna-s-2.1` | `poolside/poolside/laguna-s-2.1` | `poolside` | `POOLSIDE_KEYS` | `https://inference.poolside.ai/v1` | `@ai-sdk/openai-compatible` |

走 OpenCode 自家供應商的另外八條（1.0.60 起：`big-pickle`、`mimo-v2.6-flash-free`、`beam-free`、`deepseek-v4.1-flash-free`、`glm-5.3-flash-free`、`flint-40b-free`、`nemotron-3.5-lightning-free`、`nemotron-3.5-super-vl-free`）**不需要 provider 定義也不帶金鑰**，`config` 內只有權限鎖，且一律 `useStoredAuth: false` 走匿名免費存取。**改匿名的理由是帶金鑰反而受該金鑰所屬工作區之模型開關影響**（實測回 `Model access is disabled` 且耗 76s），結果會隨執行機器而異。全表之 `kind: 'opencode'` 條目共 19 條（`oc:` 10 條，自 1.0.60 起不變；1.0.72 起另有 `ocgo:` 8 條、1.0.78 增為 9 條，**與上述八條相反，須金鑰、不匿名**，見下節），逐條說明見 SKILL.md 之「條目表」與「OpenCode Go」。

上表之 `nvidia/poolside/laguna-xs-2.1`（403）是 **NVIDIA 轉售的另一個 laguna 項目**，與此處 Poolside 官方 REST／CLI 路徑無關，別混為一談。同一個模型經不同路徑屬不同供應商，額度池與故障域各自獨立。

該表另有同名模型的 REST 條目（`agnes:agnes-3.0-flash`、`poolside:laguna-s-2.1`，kind 為 `api-openai-compat`），走 `dispatchApiOpenaiCompat` 而非本轉接器：免 CLI、快，但**無工具能力**，只適合純文字生成。

### OpenCode Go（`opencode-go` 供應商）：CLI 型錄與錯誤字樣

使用判準（provider 分流、`OPENCODE_GO_KEYS`、隱私前提、實測狀態）在 SKILL.md〈OpenCode Go〉，本節只放查型錄與診斷用的欄位與字樣（2026-11-03，opencode 1.19.5）。

**型錄要帶金鑰才查得到**：`dispatchOpencode` 給 `provider: 'opencode-go'` ＋ `key` 時，以 `provider` 為鍵注入 `OPENCODE_AUTH_CONTENT={"opencode-go":{"type":"api","key":…}}`，不必 `config`、不必改轉接器（`model` 前綴須與 `provider` 同名）。查型錄同理需注入同形的 `OPENCODE_AUTH_CONTENT`，之後 `opencode models opencode-go --verbose`（2026-11-03 當日 30 個）；匿名可查的公開型錄是 `GET …/inference/go/v1/models`（2026-11-03 為 28 個、2026-11-07 為 30 個），models.dev 的 `opencode-go` 則列 37 個（2026-11-03，其中 7 個標 deprecated）——三者數字不同，**判「能不能用」仍以實際要用的那把金鑰所注入的 CLI 型錄加實跑為準**。2026-11-07 的公開型錄 30 個＝已收 9＋未收 21；套件記載相對先前新增 `hy4`（未收）與 `crouton-alpha-free`（已收），公開型錄已無 `mimo-v2.5`／`mimo-v2.5-pro`（官方月額表與隱私表仍列，屬文件落後；帶金鑰注入的 CLI 型錄 `opencode models opencode-go --refresh --verbose` 仍列 32 個＝公開 30 個＋此二者，未呼叫驗證）。**本機 opencode 型錄快取舊時不認新模型**（2026-11-07 實測：未 `--refresh` 時不列 `crouton-alpha-free`，依條目呼叫 1.6～3.5 秒即 `Exit code 1`），新條目要先 `opencode models opencode-go --refresh`。**2026-11-10**：`crouton-alpha-free` 已自公開 Go 型錄下架（同日 Go 型錄仍 30 個，新增 `longcat-2.5-free`〔未收；非改名後繼，收錄須依套件帳本實測〕），`w-dispatch-ai` 1.0.85 依帳本 R-OCGO-1 自目錄移除。

**未收的 21 個 Go 模型**（2026-11-07 公開型錄；提出端未測、套件不對付費模型多次發請求實測，故不收，要用時以 `resolveCatalogue` 的 `extraProviders` 自帶條目；其中 11 個的 Go 方案月額僅 $15）：`kimi-k3`、`kimi-k3.1-pro`、`glm-5.3`、`glm-5.2`、`gpt-6-luna`、`gpt-5.6-luna`、`claude-haiku-5-5`、`gemini-4-argon`、`grok-4.7`、`deepseek-v4-pro`、`qwen3.8-max`、`qwen3.7-plus`、`minimax-m3`、`longcat-2.0`、`hy3`、`hy4`、`hy4-preview`、`step-5-preview`、`mimo-v2.6-pro`、`kimi-k2.7-code`、`muse-spark-1.2-contributor`。Go 型錄沒有 Claude Sonnet，Claude 只有 `claude-haiku-5-5`。

8 條 `ocgo:opencode-go/…` 的型錄欄位（〔CLI型錄〕＋官方 Go 頁；「月額」為 Go 方案值，Go Plus／Go Teams 另計；單價見條目註解；`crouton-alpha-free` 於 2026-11-10 自官方 Go 型錄下架，`w-dispatch-ai` 1.0.85 已移除，下表不再列）：

| 模型 | 脈絡窗／最大輸出 | 輸入 | 檔位 | Go 方案月額 |
|---|---|---|---|---|
| `beam-free` | 1,048,576／131,072 | 僅文字 | low／medium／high／xhigh／max | 官方標 Free（限時）、Unlimited |
| `deepseek-v4.1-flash` | 1,000,000／384,000 | 文字與圖片 | low／high／max | $100 |
| `minimax-m3.1-flash` | 1,000,000／512,000 | 文字與圖片 | low／medium／high／xhigh／max | $20（最低） |
| `qwen3.8-flash` | 1,000,000／131,072 | 文字與圖片 | low／medium／**xhigh（無 high）** | $30 |
| `glm-5.3-flash` | 1,000,000／131,072 | 文字與圖片 | low／high／max | $60 |
| `mimo-v2.6-flash` | 1,048,576／131,072 | 文字與圖片 | 無檔位 | $60 |
| `iceman-contributor-free` | 262,144／131,072 | 僅文字 | 無檔位 | 官方標 Free（限時）、Unlimited |
| `muse-spark-1.3-contributor` | 1,048,576／131,072 | 文字與圖片 | minimal／low／medium／high／xhigh | $60 |

型錄脈絡窗不等於實際可用：`iceman-contributor-free` 伺服器上限 262,139 且 opencode 預設預留 32,000 給 completion（本機實測約 18.9 萬 token 答對、輸入約 23.6 萬被拒）；`beam-free` 本機只測到約 84.5 萬 token；付費條目的實際上限未測。

**錯誤字樣對照**（〔本機實測〕＝套件當日於已訂閱 Go 的金鑰實跑；〔提出端〕＝issue 提出端自述，本機工作區隱私開關已開、未重現）：

| 字樣 | 成因 | 處置 |
|---|---|---|
| `Upstream request failed: An active OpenCode Go subscription is required to use Go models.` | 〔本機實測〕金鑰所屬工作區沒有 Go 訂閱（用量端點對同一把回 403 `EntitlementError`）；opencode 內部重試後 **77.2s** 才 exit 1，`errorType: 'exec'` | 換已訂閱的金鑰；未訂閱的金鑰不要放進 `OPENCODE_GO_KEYS`，可先以 `opencodeGoUsage` 的 `noGoSubscription` 篩 |
| `ProviderModelNotFoundError: Model not found: opencode-go/<id>.` | 〔本機實測〕id 不在 Go 型錄（寫錯或已下架），約 **1.7s** 即 exit 1 | 以注入金鑰後的 `opencode models opencode-go` 核 id |
| `Free usage limit reached…subscribe to OpenCode Go to keep going` | 〔本機實測〕該 `opencode/*` 免費模型的當日額度用盡（**逐模型計**，非整個免費層共用一池，2026-11-07 提出端實測），不是 Go 額度；`run` 不結束，以逾時（`TIMEOUT`）回報；同一分鐘內 `opencode-go/` 的模型照常 | 換其他免費條目（可能仍可用），全部免費條目皆見此字樣才整批換家，或改走 `ocgo:` |
| `Upstream request failed: Model access is disabled` | 〔提出端〕兩種成因：①按量工作區沒開該模型；②付費或 Go 專屬 id 誤用 `opencode/` 前綴（應為 `opencode-go/`） | 先看前綴，再看工作區模型開關 |
| `This Go model requires Global regions. Select Global in your workspace's Privacy settings to use it.` | 〔提出端〕DeepSeek 須工作區 Settings›Privacy 的 Regions 選 Global | 由 owner／admin 改設定 |
| `This Go model trains on request data. Allow paid endpoints that train on request data in your workspace's Privacy settings to use it.` | 〔提出端〕Muse／Iceman Contributor 須開「Allow paid endpoints that train on request data」；開了即表示該工作區接受以提示詞訓練 | 由 owner／admin 決定；敏感內容勿走 |
| `Model is unavailable` | 〔提出端〕以 `OPENCODE_CONFIG_CONTENT` 自行補定義 Go 專屬 id 後的回應（`ocgo:` 條目不必補定義） | 移除自補的定義 |
| Go 額度到頂 | **未撞過**，字樣與 `run` 是否結束皆未知 | 以 `timeoutMs` 封頂，勿預寫簽章；遞補層 1.0.73 起預設以 `quotaGate` 於用量 ≥95% 時略過該把金鑰（到頂前即停，見 SKILL.md〈逾時與等待〉） |

### `config` 內的權限設定

同一個 `config` 物件除了 provider 定義，還吃 `permission`，可逐項給 `allow`／`ask`／`deny`：

```javascript
config: { permission: { edit: 'deny', bash: 'ask' } }   // 1.0.34 起之唯讀鎖
```

`providers.mjs` 的每個 opencode 條目都帶這把唯讀鎖（套件內以 `OC_READONLY` 常數單一來源管理）。**`bash` 刻意用 `ask` 而非 `deny`**：免費層閘門以「請求的工具清單是否含 bash」為指紋之一，`deny` 會把 bash 移出清單而被判定非 opencode 客戶端（403 `FreeTierError`）；`ask` 則工具仍在，而 `opencode run` 為非互動故 `ask` 一律自動拒絕（stderr 出現 `The user rejected permission`），仍是機械鎖。**前提是呼叫端不可加 `--auto`**——那會把 `ask` 放行。

**`permission` 可用之鍵**（2026-11-13 自 opencode 1.19.5 執行檔內之設定綱要查得）：`read`、`edit`、`glob`、`grep`、`list`、`bash`、`task`、`external_directory`、`todowrite`、`question`、`webfetch`、`websearch`、`lsp`、`doom_loop`、`skill`，另接受任意字串鍵；值為 `allow`／`ask`／`deny` 或「樣式 → 動作」之物件，字串值展開為 `{ '*': <值> }`。使用者規則接在代理預設規則之後，比對取最後一筆符合者。`build` 代理預設為 `ask` 者：`external_directory`、`doom_loop`、`read` 之 `*.env` 與 `*.env.*`。

**`ask` 被拒會結束工作階段，`deny` 不會**：`ask` 在 `opencode run` 被自動拒絕後，整個工作階段於該步驟結束後停止（離開碼 0）；`deny` 只是該次工具呼叫失敗。`config.experimental.continue_loop_on_deny: true`（`experimental` 與 `permission` 同層、不在其下；布林；綱要說明 `Continue the agent loop when a tool call is denied`）可讓被拒只把錯誤交回模型、工作階段續跑。行為、判別法、代價與 `external_directory` 之陷阱見 SKILL.md〈`ask` 被自動拒絕＝整個工作階段結束〉。

被鎖擋下時的回覆長相因模型而異：2026-09-08 以舊鎖（`edit`／`write`／`bash` 全 `deny`）實測，讀取照常、建檔失敗且 `out.txt` 未建立，但**離開碼仍為 0、stdout 非空**，轉錄裡甚至出現 `✓ Create out.txt file`（建檔被轉交子代理，子代理回報成功）；套件 2026-10-18 對 beam-free、deepseek-v4.1-flash-free 的寫檔金絲雀則是**回空字串而 `ok: true`**。派需要寫入的任務時要把對應項目放開，一律以產物是否落地判成敗，並掛 `validate: 'nonempty'` 讓空回覆判失敗。

型錄會動態變更。應使用 `opencode models <provider> --refresh` 與 `--verbose` 查核，不可猜測模型 ID 或 variant。

## `opencode run` 旗標（2026-10-18 於 1.19.3 之 help 重查）

| 旗標 | 用途 |
|---|---|
| `-m`、`--model <provider/model>` | 選擇模型；ID 可能包含多個斜線 |
| `--variant <name>` | 套用供應商／模型專屬的推理 variant（如 `high`、`max`、`minimal`） |
| `--agent <name>` | 選擇代理；轉接器預設為 `build` |
| `--format default\|json` | 人類可讀輸出或 JSONL 事件 |
| `-f`、`--file <file...>` | 附加檔案 |
| `--dir <path>` | 設定專案目錄；若 `--attach` 遠端 server 則為遠端路徑 |
| `--command <name>` | 執行指定命令，message 作為其參數 |
| `--thinking` | 顯示可用的 thinking 區塊 |
| `--auto` | 自動核准未被明確拒絕的權限；具有風險 |
| `-c`、`--continue` | 延續上一個工作階段 |
| `-s`、`--session <id>` | 延續指定工作階段 |
| `--fork` | 延續前先分叉工作階段（須搭配 `--continue` 或 `--session`） |
| `--title <text>` | 設定工作階段標題 |
| `--pure` | 不載入外部 plugin |
| `--attach <url>` | 連接正在執行的 OpenCode server |
| `--port <n>` | 指定本機 server 埠（預設隨機） |
| `-i`、`--interactive` | 直接互動 split-footer 模式；派工不可使用 |
| `--print-logs` | 將 log 印至 stderr |
| `--log-level <level>` | `DEBUG`、`INFO`、`WARN` 或 `ERROR` |

1.18.26 時另有 `--share`（分享此工作階段），1.19.3 之 help 已不列。

**`-p` 在 `opencode run` 是 `--password`（basic auth），不是提示詞**，`-u` 則是 `--username`。不可套用 Claude 的 `-p` 用法（Codex 的 `-p` 又是 `--profile`，三者互不相同）。

## 模型與 variant

模型選擇優先順序如下：

1. `--model`／`-m`
2. 設定檔中的 `model`
3. 上次使用的模型
4. 內部優先順序

variant 是型錄定義的請求覆寫。不可假設每個推理模型都有 `high` 或 `max`；使用前應檢查 `opencode models <provider> --verbose`。

`opencode models` 支援 `[provider]` 位置參數過濾、`--refresh`（自 models.dev 重抓快取）與 `--verbose`（含成本與 variants 等中繼資料）。2026-09-08 本機可用之供應商為 `cline`、`nvidia`、`opencode`（共 111 項模型）；不在此列者一律 `Provider not found`。

## 認證

```bash
opencode auth login
opencode auth list
opencode auth logout
```

必要預設模型以匿名取用 OpenCode 自家供應商的免費模型（`useStoredAuth: false`），不需登入；要用付費模型或改走自己的帳號時，`opencode auth login` 完成一次即可。第三方供應商（如 NVIDIA）的模型才需要該供應商憑證；`dispatchOpencode()` 也能透過 `provider` 與 `key`，僅為當次程序注入 `OPENCODE_AUTH_CONTENT`，不會修改已保存的認證檔案。

第三方供應商定義可透過轉接器的 `config` 選項注入為 `OPENCODE_CONFIG_CONTENT`。供應商、模型、base URL 與憑證來源必須互相對應。

## 輸出與工作階段

```text
opencode run --format json --model opencode/deepseek-v4.1-flash-free --variant max
opencode run --continue "繼續"
opencode run --session <SESSION_ID> "後續指令"
```

`--format json` 是每行一個 JSON 值的事件流，必須當成 JSONL 解析。

## 執行期驗證

```bash
opencode --version
opencode run --help
opencode auth list
opencode models opencode --refresh
opencode models opencode --verbose
opencode agent list                 # 各代理的實際生效權限規則
npm view opencode-ai version
```

查完型錄還要實跑一次最小任務才算驗證過（型錄會照列已下線的模型）。若指定模型或 `max` variant 已消失，應明確回報失敗並要求選擇新的模型／供應商，不可靜默改派其他模型。
