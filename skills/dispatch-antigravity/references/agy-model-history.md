# dispatch-antigravity：預設模型換上與舊預設之沿革

本檔收 SKILL.md〈必要預設值〉中「為何是 Hydrogen」（2026-11-13 由 3.8 Flash 換上之查核）與「3.8 Flash 是仍在型錄之舊預設」（沿革與當時數字）兩段，以及該節之 `/effort` 實查表與 `--help` 值域沿革（見下方第二節）（原文逐字自 SKILL.md 搬移，未刪改；其中數字為查核當日之歷史紀錄）。

**為何是 Hydrogen（2026-11-13 由 3.8 Flash 換上）**：使用者於 2026-11-13 指定把派工遞補鏈之 agy 末段由 `gemini-3.8-flash-high` 改為 `gemini-4-hydrogen-high`；使用端稱 Hydrogen 於同日推出、Google 以之取代 Flash 品牌（轉述，無官方出處，本技能未查證）。`w-dispatch-ai` 1.0.92 已收錄內建條目 `agy:gemini-4-hydrogen-high`，置 3.8 之後、Argon 之前，3.8 條目未刪。本機 2026-11-13（agy 1.5.7）之查核：`agy models` 列 `gemini-4-hydrogen-{high,xhigh,medium,low}` 四檔；以技能根之 `w-dispatch-ai`（實裝 1.0.90，`dispatchAntigravity()` 之固定旗標自 1.0.17 起未變）對 `gemini-4-hydrogen-high` 實呼「讀中文檔第 1 行＋寫檔」（`skipPermissions: true`、`addDirs` 含檔案與輸出目錄、`validate: 'nonempty'`）：13.5 秒成交、中文原樣讀回、檔案落地。**agy 耗時起伏大，單次數字不可據以比較 Hydrogen 與 3.8 之快慢**。

**3.8 Flash 是仍在型錄之舊預設**（2026-09-03 至 2026-11-13 為本技能預設；2026-11-13 之 `agy models` 仍列三檔、`agy:gemini-3.8-flash-high` 條目仍在，下游以 id 引用，尚未下架）。以下為其沿革，屬歷史紀錄，保留當時之數字：Gemini 3.8 Flash 於 agy **1.1.25** 進入型錄（changelog 記為「Added Gemini 3.8 Flash to the model catalog when connecting with a `GEMINI_API_KEY`」），2026-09-03 本機 `agy models` 已實際列出三檔 slug，並以 `agy -p ... --model gemini-3.8-flash-high` 實跑通過（8.8 秒、exit 0）。`w-dispatch-ai` 1.0.34 之 providers 表同日自 3.7 升為 3.8，附實測：**回應 12.5s（3.7 為 62.2s）、讀檔 14.6s（3.7 為 57.6s）**。

## 〈必要預設值〉之 /effort 實查表與 --help 值域沿革（2026-11-13，agy 1.5.7）

| 基礎 slug | available |
|---|---|
| `gemini-4-hydrogen` | low, medium, high, **xhigh** |
| `gemini-3.8-flash`（仍在型錄之舊預設） | low, medium, high |
| `gemini-4-argon` | low, medium, high |
| `claude-opus-5-5`、`claude-sonnet-5-5` | low, medium, high |
| `gpt-oss-120b`、`gemini-pro-orchestrator-g1-pro` | 不可調（`adjustable: false`） |

同一版的 `--help` 把 `--effort` 列為 `low|medium|high|xhigh|max`（1.2.6 為 `low|medium|high`，1.2.13 為 `low|medium|high|max`，1.4.2 與 1.5.7 為 `low|medium|high|xhigh|max`）——那只是 CLI 層的字面值域，不是每支模型都吃。2026-10-18 於 1.4.2 實測：`--model gemini-3.8-flash --effort max` 回 `gemini-3.8-flash has no "max" effort (available: low, medium, high)`；帶檔位 slug 再配不一致的 effort（如 `--model gemini-3.8-flash-high --effort max`）回 `conflicts with --effort=max`（此二例未於 1.5.7 重測）。**1.5.7 之型錄只有 Hydrogen 的 available 含 `xhigh`，沒有任何一支含 `max`**；Hydrogen 之 `xhigh` 本技能不採用（見上）。
