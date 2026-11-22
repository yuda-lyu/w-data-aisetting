---
name: dispatch-antigravity
description: 當任務需要委派給 Antigravity，或需要使用其提供的 Gemini 模型時，透過 w-dispatch-ai 以非互動子程序方式執行 Google Antigravity CLI（agy）。內含依任務性質（審計／複審／調查／寫測試）決定權限下限的判準：權限不足時會以 exit 0 交回看似正常卻沒做事的結果。派工逾時：正式派工一律 4 小時，派工腳本須以 detached 行程執行並分段等待——掛在工具呼叫上（前景最長 10 分鐘、背景最長 2 小時）必被中途終止。
---

# dispatch-antigravity

使用 `w-dispatch-ai` 的 `dispatchAntigravity()` 執行自動化 Antigravity 任務（本技能對照 1.0.109，其中預設模型與〈skipPermissions: false 只擋工作區外之寫入〉另依 2026-11-13 之 1.0.92 內建條目與 agy 1.5.7 實測更新，見文末對照；固定旗標與自用鍵自 1.0.17 起未變動，**但 1.0.92 起 `timeoutMs` 無效值改用預設 300000、`printTimeout` 之推導不再另行封頂，1.0.109 起 `skipPermissions`／`addDirs`／`exe`／`cwd`／`env`／`maxRetries` 給了無效值之處置改為拒絕或視為未給，見〈逾時分層〉、〈轉接器契約〉與〈安裝檢查〉2026-11-23 對照**（1.0.73 另加自用鍵 `spawnGate`：每次 spawn 前有機器級守門，agy 預設不限，見〈逾時分層〉選項表；1.0.80 另加自用鍵 `promptVia`：提示詞不超過 30,000 字元仍走 `--print`、逐位元不變，超過才改走 stdin，見〈提示詞傳輸〉；1.0.79 起遞補層對 agy 條目於送出前先看額度，見〈逾時分層〉選項表之 `quotaGate`），**但 1.0.50 起 `printTimeout` 的推導反轉為晚於外層**，見〈逾時分層〉）。執行檔名稱是 `agy`，且 CLI 須為 **1.1.25 以上**（見下方「CLI 版本下限」；2026-11-13 以 1.5.7 實測通過）。轉接器會設定 print 模式、權限、模型／effort、工作區目錄、互相配合的內外層逾時，並維持不 reject 的結果契約。

需要變更模型 slug、effort、print 模式旗標、逾時或工作區可視範圍時，讀取 [references/agy-flags.md](references/agy-flags.md)。

## 套件裝在哪：技能目錄的上一層，不要自己另裝

`w-dispatch-ai` 與其相依（`wsemi` 等）統一裝在**技能根目錄自己的 `node_modules`**——也就是**本技能目錄的上一層**（技能根有自己的 `package.json` 管這些相依），一般是 `~/.claude/skills/node_modules/`。

```javascript
import { createRequire } from 'module';
import path from 'path';

//技能根＝本技能目錄的上一層（本技能目錄之絕對路徑由載入本技能時取得）
const skillsRoot = path.resolve('<本技能目錄之絕對路徑>', '..');
const req = createRequire(import.meta.url);
const wda = req(path.join(skillsRoot, 'node_modules', 'w-dispatch-ai'));
//取回的就是預設匯出物件本身（不會再包一層 default）：wda.KINDS／wda.dispatchAntigravity／wda.budgetFor 直接可用
```

**三條鐵則**：

- **不要在專案裡 `npm install w-dispatch-ai`**。專案若另有一份，`import 'w-dispatch-ai'` 會優先解析到專案那份（通常較舊），**使用者更新技能根的版本就永遠傳不到你這裡**——他以為在測新版，你實際跑的是另一份。
- **找不到就回報使用者**（請他到技能根 `npm i`）。不要自己找地方安裝，也不要改用其他路徑硬湊。
- **查版本要指名路徑**：直接下 `npm ls w-dispatch-ai` 或 `require.resolve('w-dispatch-ai')` 都是**從當前專案解析**，看到的可能是別份。要確認真正被載入的那一份，讀 `<技能根>/node_modules/w-dispatch-ai/package.json` 的 `version`。

## 必要預設值

除非使用者明確指定其他模型或推理強度，否則必須使用：

- 模型：`gemini-4-hydrogen-high`（Gemini 4 Hydrogen；2026-11-13 起，此前為 `gemini-3.8-flash-high`）
- 推理強度：模型 slug 已內嵌的 `high`

`high` 是本技能採用之檔位，與 `w-dispatch-ai` 1.0.92 內建條目 `agy:gemini-4-hydrogen-high` 一致。**Hydrogen 另有 `xhigh` 檔**（`agy models` 列 `gemini-4-hydrogen-xhigh`，`/effort` 之 available 含 `xhigh`，見下方實查結果），本技能**不採用、也未實測**（本輪實呼只用 `high` 檔）——與套件目錄及派工遞補鏈一致；要用 `xhigh` 須使用者明確指定，並先照〈派工前的能力探測〉以同選項驗一次。預設時不要再傳入 `effort: 'high'`；模型 slug 已包含等級，重複設定沒有必要，而且維持單一設定來源可避免 slug／effort 衝突。

**查某支模型能用哪些 effort，用 `/effort` 實查，不要看 `--help`**：

```bash
MSYS_NO_PATHCONV=1 agy -p /effort --model gemini-4-hydrogen-high --output-format json
# 回應之 command.data.available 即清單；adjustable 為 false 表示該模型不可調
# 帶檔位 slug 時 current 回該檔位（此例 high）；用不帶檔位之基礎 slug（gemini-4-hydrogen）則 current 為預設 medium
```

`MSYS_NO_PATHCONV=1` 只在 Git Bash 需要：MSYS 會把開頭為 `/` 的參數當成 POSIX 路徑，改寫成 `C:/Program Files/Git/effort` 再交給 agy。`/effort` 不呼叫模型（回應 `duration_seconds: 0`、token 全 0），不耗額度。2026-11-13 於 agy 1.5.7 實查，結果如下。

**實查結果摘要**（完整表與 `--help` 值域沿革移至 [references/agy-model-history.md](references/agy-model-history.md)；2026-11-13、agy 1.5.7）：`gemini-4-hydrogen` 之 available 為 low、medium、high、**xhigh**；`gemini-3.8-flash`、`gemini-4-argon`、`claude-opus-5-5`、`claude-sonnet-5-5` 為 low、medium、high；`gpt-oss-120b`、`gemini-pro-orchestrator-g1-pro` 不可調（`adjustable: false`）。`--help` 之 `--effort` 值域（1.5.7 為 `low|medium|high|xhigh|max`）只是 CLI 層字面值域，不是每支模型都吃：基礎 slug 搭不支援之 effort 回 `<slug> has no "<x>" effort (available: …)`，帶檔位 slug 再配不一致之 effort 回 `conflicts with --effort=<x>`（2026-10-18 於 1.4.2 實測，未於 1.5.7 重測）；**1.5.7 之型錄只有 Hydrogen 含 `xhigh`，沒有任何一支含 `max`**；Hydrogen 之 `xhigh` 本技能不採用。

不帶檔位的基礎 slug（如 `gemini-4-hydrogen`、`gemini-3.8-flash`、`gemini-4-argon`）agy 解析得出來（預設檔位 medium，可搭配 `effort`；Hydrogen 於 2026-11-13 以 `/effort` 實查確認），只是不列在 `agy models` 的輸出裡。

**Gemini 4 Argon 是另一支可選的 Gemini，不是預設**：`gemini-4-argon-{high,medium,low}` 見於 agy 1.4.0（套件記錄）、1.4.2（2026-10-18 本機）與 1.5.7（2026-11-13 本機）之型錄，`w-dispatch-ai` 1.0.50 起收為 `agy:gemini-4-argon-high` 條目。它的額度是 agy `/usage` 裡獨立的「Gemini 4 Argon」群組，只有 7 天窗口、沒有 5 小時窗口（套件 2026-10-16 以前後對照實測，與「Gemini Models」群組分開）。**未給 `model` 時 agy 預設就是 Gemini 4 Argon (Medium)**（套件 2026-10-16 以 agy 1.4.0 實測；預設由 agy 決定、可能隨版本變動），會悄悄耗用這個 7 天額度——所以派工一律明給 `model`。要改用 Argon，須使用者明確指定。

**Hydrogen 之額度池**：`/usage` 於 agy 1.5.7 仍只有「Gemini Models」「Claude and GPT models」「Gemini 4 Argon」三個群組，沒有 Hydrogen 專屬群組；`gemini-*`（不含 `gemini-4-argon*`）歸「Gemini Models」，與 3.8 Flash 同組（有 5 小時與 7 天窗口），與「Gemini 4 Argon」分開計（`w-dispatch-ai` 1.0.92 條目註解之 2026-11-13 前後對照：只呼叫 Hydrogen 時 Argon 讀數不動；Gemini Models 之 5 小時窗口讀數上升、7 天窗口讀數跳動大於增量而無法精算，同帳號他行程之用量可能混入——僅作歸屬參考，本技能未重做此對照）。

**為何是 Hydrogen（2026-11-13 由 3.8 Flash 換上）與 3.8 Flash 之沿革**：使用者於 2026-11-13 指定把派工遞補鏈之 agy 末段由 `gemini-3.8-flash-high` 改為 `gemini-4-hydrogen-high`，與 `w-dispatch-ai` 1.0.92 內建條目 `agy:gemini-4-hydrogen-high` 一致；3.8 Flash 仍在型錄、`agy:gemini-3.8-flash-high` 條目仍在（下游以 id 引用，未下架），2026-09-03 至 2026-11-13 為本技能預設。換上之查核（`agy models` 列 Hydrogen 四檔、實呼「讀中文檔第 1 行＋寫檔」13.5 秒成交、中文原樣讀回、檔案落地）與 3.8 Flash 之沿革（agy 1.1.25 進入型錄、當時之耗時數字）已移至 [references/agy-model-history.md](references/agy-model-history.md)。**agy 耗時起伏大，單次數字不可據以比較 Hydrogen 與 3.8 之快慢**。

型錄由伺服器供給，會獨立於 CLI 版本變動。固定模型前一律先跑 `agy models` 對照，不可憑推測寫入新 slug——2026-09-02 查核時 3.8 尚不存在，隔日即上架；2026-11-13 Hydrogen 同樣是當日才出現於型錄，就是這個道理。

```javascript
import wda from 'w-dispatch-ai';

const result = await wda.dispatchAntigravity('分析此專案並完成指定修改', {
    model: 'gemini-4-hydrogen-high',
    cwd: '/absolute/path/to/project',
    timeoutMs: 14_400_000,   // 正式派工一律 4 小時；須照〈逾時與等待〉以 detached 執行，不可在工具呼叫內直接 await
    validate: 'nonempty',
});

if (!result.ok) {
    throw new Error(result.error);
}
console.log(result.stdout);
```

未提供 `addDirs` 時，`dispatchAntigravity()` 會自動把實際 `cwd` 加入 agy 工作區。需要更多目錄時明確傳入 `addDirs`；若傳入 `[]`，則不公開任何目錄——那等於被派對象什麼都讀不到，見「權限」一節。**`addDirs` 給了而無效即拒絕**（1.0.109 起）：給了非陣列之定義值（字串、物件等）、不可讀之陣列、元素數逾 10000，或陣列非空而元素全無效（沒有任何非空字串）者回 `params`、不起子程序，**不再退回 `[cwd]`**（修前無效值使可視範圍被悄悄放寬）；含有效字串者，其中之無效元素照舊略過；`undefined`／`null` 才視為未給（自動加入 `cwd`）。

## CLI 版本下限：派工須 agy ≥ 1.1.25

下限訂在 1.1.25 有三個理由，前兩個是**只會在非互動派工情境出現**的卡死（會讓子程序永不結束，只能等 `timeoutMs` 到期被殺）：

- 1.1.24：headless 呼叫在 stdout／stderr 被導管接走時，離開階段會卡住（未對保留的串流設 `FD_CLOEXEC`，子程序抓著呼叫端的 pipe 不放）。`dispatchAntigravity()` 正是以 pipe 收 stdout／stderr。
- 1.1.23：`models`、`agents` 這類子命令在繼承到未關閉的 stdin pipe 時會卡住而不執行。
- 1.1.25：Gemini 3.8 Flash 才進入型錄（2026-11-13 前之預設模型之所以訂此版；現預設 Hydrogen 於 1.5.7 之型錄已有，**其最低 agy 版本未查證**——型錄由伺服器供給，不一定綁 CLI 版本）。

因此本技能之型錄查核與派工都要求 agy 1.1.25 以上（下限之主因是前兩項之卡死）；版本較舊時先 `agy update`，不要把逾時當成模型或提示詞的問題來調。

## 模型與 effort 規則

`agy models` 會輸出 `<slug> <顯示名稱>`。必須傳入第一欄 slug。2026-11-13 於 agy 1.5.7 之型錄（共 18 項，完整清單見 references）：

```text
gemini-4-argon-medium    Gemini 4 Argon (Medium)
gemini-4-argon-high      Gemini 4 Argon (High)
gemini-4-argon-low       Gemini 4 Argon (Low)
gemini-4-hydrogen-high   Gemini 4 Hydrogen (High)
gemini-4-hydrogen-xhigh  Gemini 4 Hydrogen (XHigh)
gemini-4-hydrogen-medium Gemini 4 Hydrogen (Medium)
gemini-4-hydrogen-low    Gemini 4 Hydrogen (Low)
gemini-pro-orchestrator-g1-pro  Orchestrator (Argon)
gemini-3.8-flash-high    Gemini 3.8 Flash (High)
gemini-3.8-flash-medium  Gemini 3.8 Flash (Medium)
gemini-3.8-flash-low     Gemini 3.8 Flash (Low)
claude-opus-5-5-*、claude-sonnet-5-5-*（各 low／medium／high）、gpt-oss-120b-medium
```

`gemini-pro-orchestrator-g1-pro`（顯示名 Orchestrator (Argon)）為 1.5.7 新見之項目，`/effort` 回不可調；本技能未實呼、不用於派工。3.7 Flash、3.6 Flash、3.1 Pro 與 Claude 4.6 系已全數下架（套件記錄 `gemini-3.6-flash-low`、`gemini-3.1-pro` 於 agy 1.4.0 回 `not recognized as a known model`）。

Antigravity 也接受 `--effort`（各模型實際可用值以「必要預設值」一節之 `/effort` 實查為準）。若使用轉接器的 `effort` 選項，應搭配相容的基礎模型 slug。帶有等級的 slug 若再搭配不一致的 effort，agy 會拒絕執行。本技能預設固定使用 `gemini-4-hydrogen-high`，並省略 `effort`。

## 提示詞傳輸

與另外三個轉接器不同，agy 的 `--print` 是帶值旗標，提示詞作為它的值（命令列），單次任務不會從 stdin 讀取純文字提示詞；把純文字塞進 stdin 而不帶 `--print`，agy 會進互動模式卡住。命令列受 Windows 長度上限約束，所以 1.0.80 起 `dispatchAntigravity()` 提供選項 `promptVia`（預設 `'auto'`）：

| `promptVia` | 做法 | 限制 |
|---|---|---|
| `'argv'` | `--print <prompt>`（舊行為） | 超過 30,000 字元回 `prompt too long`（`errorType: 'params'`、`attempts: 0`，不 spawn） |
| `'stdin'` | 不帶 `--print`，固定加 `--input-format stream-json --output-format stream-json`，自 stdin 送**一行** NDJSON `{"event":"user","message":{"role":"user","content":<prompt>}}` | 不受命令列長度限制（套件以 agy 1.5.2 實測 37,504 與 36,060 字元成交）；須 agy ≥ 1.1.15 |
| `'auto'`（預設） | 不超過 30,000 字元走 argv（與舊版逐位元相同），超過走 stdin | — |

**stdin 路徑的注意事項**（套件檔頭記載，agy 1.5.2 實測）：

- **判成敗只看輸出中最後一個 `result` 事件**：`status` 為 `SUCCESS` 才 `ok: true`，`stdout` 是 `result.response`（純回覆文字，`validate` 對它判定），原始 NDJSON 放結果的 `raw` 欄；`status` 不為 `SUCCESS`（如 `ERROR`）或**沒有 `result` 事件一律 `ok: false`**（`errorType: 'exec'`）。agy 對不認得的輸入事件只在 stderr 印 warning、stdout 只留 `init`、**離開碼為 0**，所以離開碼 0 或 stdout 非空都不能判成功。此失敗在 execCli 回報成功之後才判定，**不受 `maxRetries` 重試**。
- **`extraArgs` 不得含 `--output-format`、`--input-format`、`--print`／`-p`／`--prompt`、`-i`／`--prompt-interactive`**（含 `=值` 與單橫線寫法），否則回 `params` 錯誤、不 spawn。預設 `'auto'` 下，帶 `--output-format` 的呼叫一旦提示詞超過 30,000 字元，也會因此回 `params`（見〈結構化輸出〉）。
- **版本**：spawn 前先以 `agy --version`（約 0.15 秒）探測，低於 1.1.15 直接回 `params` 錯誤並指引 `agy update`；探測不確定時放行，若 agy 回「flags provided but not defined: -input-format」則 `error` 改寫為同樣的升級指引。輸入訊息形狀**只在 agy 1.5.2 實測**，1.1.15～1.5.1 未驗證（本技能的版本下限 1.1.25 已高於 1.1.15，但實測依據只有 1.5.2）。
- **斜線指令不可用**：`/usage`、`/effort` 等斜線指令在 stream-json 輸入下被 agy 拒絕（離開碼 2）；〈必要預設值〉的 `/effort` 實查走 `agy -p`（argv），不受影響。
- **升版後的行為變化**：超過 30,000 字元的呼叫此前整個被擋（`params`、`attempts: 0`，遞補層整組跳過），現在會真的派給 agy（耗額度、耗時）；依賴「超長必失敗」而讓遞補鏈略過 agy 的呼叫端，要略過的明給 `promptVia: 'argv'`。要全面改走 stdin（連帶避開含大量引號而長度未過上限者的轉義膨脹 `ENAMETOOLONG`）則明給 `promptVia: 'stdin'`，同時須確認各機 agy ≥ 1.1.15。

輸入很長時，仍可先把內容寫入允許存取目錄內的檔案，再派送一段引用該路徑的短提示詞（審計、複審本來就要被派對象自行讀檔，見〈權限〉）；要把整段長文直接當提示詞者，用上述 stdin 路徑。

## 逾時與等待：正式派工一律 4 小時，以 detached 行程執行

**轉接器預設 300000（5 分鐘）遠遠不夠**：審計要把模組讀完、複審要逐格核對、寫測試還得把測試跑起來，而 agy 光是啟動就常吃掉數秒到二十幾秒，單次派工超過 1 小時已是常態。被逾時砍掉時 token 早就燒完卻拿不到任何結果——**逾時砍掉的不是等待時間，是整批已經付過錢的工作**，重派還要再付一次。

**正式派工一律 `timeoutMs: 14_400_000`（4 小時）。逾時是上限不是固定等待**——提早做完就提早回，給大不吃虧；給小才會兩頭空。適用於所有正式派工：審計、複審、調查、寫測試、跑測試、多檔重構、產長報告，以及任何要求逐項核對者。**唯一例外是能力探測與單問一句**：維持 1–3 分鐘、前景執行——探測本來就要快失敗。

### 為何不能在工具呼叫裡直接等

Claude Code 對每一種工具呼叫都有時限，到期即終止整個行程，`timeoutMs` 給多大都沒用：

| 呼叫方式 | 預設 | 上限 |
|---|---|---|
| Bash 前景 | 120000（2 分鐘） | 600000（10 分鐘） |
| Bash `run_in_background: true` | 1800000（30 分鐘） | 7200000（2 小時） |
| `Monitor` | 300000（5 分鐘） | 1800000（30 分鐘） |

2026-10-03 實測：`run_in_background` 設 `timeout: 60000` 的指令於 60 秒整被終止、沒給 `timeout` 的指令於 30 分鐘整被終止（通知皆為 stopped after reaching its background time limit）；同日以 `nohup … &` 自前景 Bash 啟動的 node 行程，在該次工具呼叫結束後照常跑完並寫出結果檔。所以 4 小時派工必須**脫離工具呼叫**：派工腳本以 detached 行程執行、過程與結果落檔，等待則用背景指令分段進行。

### 執行步驟（正式派工一律照做）

**步驟 1：寫派工腳本。** 提示詞先寫進 `./tmp/<案名>/prompt.md`，再寫 `./tmp/<案名>/dispatch.mjs`：

```javascript
// ./tmp/<案名>/dispatch.mjs —— 由步驟 2 以 detached 啟動；過程與結果一律落檔
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

const dir = path.resolve('./tmp/<案名>');
const out = (name) => path.join(dir, name);
const skillsRoot = path.resolve('<本技能目錄之絕對路徑>', '..');
const wda = createRequire(import.meta.url)(path.join(skillsRoot, 'node_modules', 'w-dispatch-ai'));

fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(out('node.pid'), String(process.pid));   //步驟 3 判斷存活、中止時樹狀終止都靠它
let result;
try {
    result = await wda.dispatchAntigravity(fs.readFileSync(out('prompt.md'), 'utf8'), {
        model: 'gemini-4-hydrogen-high',
        cwd: '<被派對象工作目錄之絕對路徑>',   //其他要讀的目錄以 addDirs 給（見〈權限〉）
        timeoutMs: 14_400_000,   //printTimeout 由此自動推導為 14430 秒（比外層晚 30 秒、只作後備），不要另給
        validate: 'nonempty',
        onStdout: (chunk) => fs.appendFileSync(out('stdout.log'), chunk),   //失敗結果只留 500 字元，過程靠這份
    });
}
catch (err) {
    result = { ok: false, error: `dispatch.mjs 例外：${err?.stack || err}` };
}
fs.writeFileSync(out('result.json'), JSON.stringify(result, null, 2));
```

提示詞預設不超過 30,000 字元走 `--print`、超過自動改走 stdin（`promptVia: 'auto'`，見〈提示詞傳輸〉）；更長的內容仍可寫成檔案，`prompt.md` 只放引用該路徑的短提示詞。走遞補鏈或工作流時，同樣用這支腳本包住整個呼叫（把 `dispatchAntigravity` 換成 `dispatchAiFallback` 或工作流函數），步驟 2、3 不變。

**步驟 2：以 detached 啟動。** 用前景 Bash 執行，立即返回；**不要**用 `run_in_background` 跑派工本身，那會讓它受上表時限約束：

```bash
nohup node ./tmp/<案名>/dispatch.mjs > ./tmp/<案名>/run.log 2>&1 &
sleep 3; cat ./tmp/<案名>/node.pid   # 印得出 PID 才算啟動成功；印不出來先讀 run.log
```

**步驟 3：分段等待。** 用背景 Bash，`timeout` 必須明給 `7200000`（不給就是 30 分鐘）；迴圈在第 6900 秒自行結束，趕在上限之前回報：

```text
Bash({ run_in_background: true, timeout: 7200000,
  description: '等待派工 <案名>（本段至多 115 分鐘）',
  command: 'd=./tmp/<案名>; end=$(( $(date +%s) + 6900 )); while [ ! -f "$d/result.json" ] && node -e "process.kill(+process.argv[1],0)" "$(cat "$d/node.pid")" 2>/dev/null && [ "$(date +%s)" -lt "$end" ]; do sleep 30; done; if [ -f "$d/result.json" ]; then echo "DONE $(date +%H:%M:%S)"; elif [ "$(date +%s)" -ge "$end" ]; then echo "STILL-RUNNING $(date +%H:%M:%S)"; else echo "CRASHED $(date +%H:%M:%S)"; tail -20 "$d/run.log"; fi' })
```

通知回來後依輸出的第一個字處置：

| 輸出 | 意義 | 處置 |
|---|---|---|
| `DONE` | `result.json` 已寫出 | 讀它，**再驗產物**——exit 0 與非空輸出都不是成功判準，agy 被權限擋下也是 exit 0（見〈權限〉與下節） |
| `STILL-RUNNING` | 本段到期，派工仍在跑 | 原指令重掛下一段。累計超過派工應有的最長總時長（單次嘗試為 4 小時；遞補鏈與工作流依下節公式）仍未結束，才視為異常回報 |
| `CRASHED` | 行程已結束卻沒有 `result.json`（被外力終止、機器休眠、node 崩潰） | 讀 `run.log` 與 `stdout.log` 找原因；**找到原因前不要重派** |

**session 中斷或重開後**：派工照跑，不受影響（2026-10-03 實測：由 `claude -p` 的 Bash 工具以 `nohup` 啟動的行程，在該 `claude` 行程結束後照常跑完）；只有機器重開會中斷它。接手時先看 `./tmp/<案名>/`：有 `result.json` → 直接驗收；沒有、但 `node.pid` 的行程仍存活 → 重掛步驟 3；兩者皆無才考慮重派。**不要因為換了 session 就重派**——那正是浪費 token 的主因。

**中止**：Windows 用 `cmd //c "taskkill /F /T /PID <node.pid 之值>"`（`/T` 連同 agy 子行程一起結束）；其他平台以 `kill` 終止該 PID 及其子行程。中止前先徵詢使用者。

### 逾時分層：五層都要放行

**任一層先到就被截斷**（套件 README 之「Timeout 總覽」明訂②④⑤的數值須嚴格遞增；③不在這條階梯內，恆比②晚 30 秒）：

| 層 | 誰在殺 | 預設 | 正式派工怎麼設 |
|---|---|---|---|
| ①呼叫端（Claude Code 的工具呼叫時限） | harness 終止整個行程 | 見上節表格，最長 2 小時 | 派工照〈執行步驟〉detached 執行，此層即不作用；只有等待受它約束，所以等待要分段 |
| ②轉接器 `timeoutMs`（單次嘗試） | 逾時終止程序樹 | 300000 | `14_400_000`（須為 1～2147483647 之整數或其十進位數字字串；其餘〔0、負數、小數、超過 2147483647、`Infinity`、`'0x10'`、包裝物件〕視為未給而用預設 300000，不夾上限、不報錯，1.0.92 起；`14_400_000` 在範圍內） |
| ③agy 自身 `--print-timeout` | agy 自己結束，以 exit 0 交回部分輸出 | `0s`（等到完成；agy 1.4.0 與 1.4.2 之 `--help` 皆載明） | 由 `timeoutMs` 推導為 `timeoutMs + 30 秒`（給 4 小時即 14430 秒），比②晚到、只在外層強殺失效時兜底；**不要另給比 `timeoutMs` 小的 `printTimeout`**——那會讓它先到，把慢回合變成 `ok: true` 的截斷輸出 |
| ④單一名額之遞補鏈 `budgetMs` | 預算用盡即停止遞補 | `null`（不限） | 要嘛不給，要嘛 ≥ `鏈組數 K × 14_400_000`；給小了會把第②③層一起壓下去 |
| ⑤工作流總時長 | 無獨立參數，由結構推導 | 無（刻意） | `runRolePipeline` 最壞 ≈ M×K×`timeoutMs`。K=4、M=3 配 4 小時就是 **48 小時**——先算再決定要不要拆階段 |

**第③層刻意比第②層晚 30 秒到期（1.0.50 起）**：外層先砍，結果是 `TIMEOUT` 失敗（`errorType: 'timeout'`），遞補鏈才能整組跳過、記冷卻；agy 自己的計時只在外層強殺失效時兜底。**推導不再另行封頂（1.0.92 起）**：`timeoutMs` 本身須為 1～2147483647 之整數（計時器上限，與 `wsemi` `execCli` 之判定相同），超過上限、`Infinity`、`'0x10'` 等無效值視為未給而用預設 300000（**不是夾至上限**：修前超過上限者推導得 `2147513s`，現改為 `330s`），故推導值最大 2147513 秒（`timeoutMs` 恰為 2147483647 時），不會超出 agy 可解析之 Go duration 範圍（超出者 agy 回 `invalid duration`、離開碼 2）；`budgetMs` 把 `timeoutMs` 壓得再小，推導出的 `printTimeout` 也一樣晚 30 秒，不會反轉。**1.0.49 以前恰好相反**（推導為 `max(30, timeoutMs 秒數 − 30)`，內層先到）：自然耗時超過那個截止點的回合一律被當成 `ok: true` 的截斷輸出，連超過 `timeoutMs` 者亦然——舊筆記、舊腳本裡的「14370 秒」「內層先到、30 秒下限」都已不成立。

**agy 的內層逾時仍是「假成功」，只是預設不再先到**（2026-09-10 實測，套件 2026-10-16 以 agy 1.4.0 重測同型）：只有你明給比 `timeoutMs` 小的 `printTimeout` 時才會發生——agy 回 **exit 0、`ok: true`**，stdout 為已產出的部分（可能為空），stderr 只有 `[agy] print timeout after <t> with turn in progress; returning partial output`，**`errorType` 是空的**，`nonempty` 也擋不住非空的部分輸出。反過來說，**1.0.50 起慢到 `timeoutMs` 的回合一律回 `TIMEOUT` 失敗，而失敗結果的 `stdout` 只留 500 字元**——過程要保得住，只能靠 `onStdout` 落檔（〈執行步驟〉的範本已掛）。

**最常見的假象**：`timeoutMs` 明明給了 4 小時，派工卻在 2 分鐘、10 分鐘、30 分鐘或 2 小時整斷掉——全是第①層砍的：派工掛在前景，或掛在 `run_in_background` 上（沒給 `timeout` 是 30 分鐘，給滿也只有 2 小時）。**只改 `timeoutMs` 沒用：派工一定要照〈執行步驟〉detached 執行（第①層），第③層則交給轉接器由 `timeoutMs` 推導、不要另給小值**。

**單次派工還會乘上去的**：`timeoutMs` 是**每次嘗試**的上限，不是總時長；自訂 `validate` 的等待也算在同一次嘗試內（`src/runExecCli.mjs`）。`maxRetries: N`（N 須為 0～4294967295 之整數或其十進位數字字串；`Infinity`、`'0x10'`、小數、負數、超過上限視為未給＝0，1.0.109 起，修前 `Infinity` 會令驗證不過者近乎無限重試）時總時長約 `timeoutMs × (1+N)`，再加重試間隔（`retryDelayMs` 預設 5000，實際間隔為 `retryDelayMs × 已嘗試次數`、單次上限 15000）；**`TIMEOUT` 會被重試，每次耗滿 `timeoutMs`**；1.0.86 起有 `budgetMs` 時，每次重試之逾時以剩餘預算封頂、剩餘不足 `minAttemptMs` 即不再重試（1.0.85 以前不受 `budgetMs` 約束）。不重試、立即中止的只有確定性失敗：`ENOENT`（命令不存在、不存在的 `.cmd`／`.bat`、npm shim 的入口檔缺失）、exit code 2（參數錯誤）、`cwd` 不存在，以及子進程根本起不來的同步錯誤（命令列過長、權限不足、非有效執行檔、參數含空字元；這類結果 `code` 為 `null`、`errorType` 為 `spawn`）。**`printTimeout` 於呼叫前依 `timeoutMs` 推導一次，重試沿用同一組旗標，故不會累加、也不會逐次重算**。

**走遞補鏈或工作流時，三個值必須成套設，缺一即壞**（以下皆為 `w-dispatch-ai/src/dispatchAiFallback.mjs` 之實際行為）：

```javascript
{ timeoutMs: 14_400_000, minAttemptMs: 14_400_000, budgetMs: K * 14_400_000 }  // K＝遞補鏈之組數
```

| 選項 | 預設 | 實際行為與陷阱 |
|---|---|---|
| `budgetMs` | `null`（不限） | 有給時**每次嘗試的逾時被壓成 `min(timeoutMs, 剩餘預算)`**（agy 的 `printTimeout` 依壓縮後的值加 30 秒推導，仍晚於外層）；給得比 `timeoutMs` 小，4 小時等於白設；1.0.86 起 `0` 與負數為「已無時間」（不送出、回 `budget`），小數取整；被預算封頂而逾時之嘗試回 `budget`（事件 `budget-cut`），不記冷卻、不計連敗 |
| `minAttemptMs` | 20000 | **只有給了 `budgetMs` 才作用**。與 `timeoutMs` 同值時，第一家跑完剩餘必然不足 → 第二家永遠不開工；若 `budgetMs` 又給小了，**連第一次嘗試都不會發生**，直接回 `budget exhausted`（`errorType: 'budget'`），極易被誤讀成「額度用完」。1.0.109 起：呼叫端另給 `spawnGate.minAttemptMs` 時，取兩來源有效（正整數）值之**較大者**，守門與暫時性重試之預算判斷同一規則（修前呼叫端之物件優先；小數如 `1500.5` 現視為無效） |
| `cooldownMs` | `0`（關閉） | 只對**有明給 `id`** 的條目記冷卻；內建觸發只有 HTTP 429 與逾時，而 **429 僅 REST 類偵測得到**；CLI 類的限流埋在輸出文字裡，內建規則抓不到；1.0.86 起可加長：`cooldownGrowth`（預設 1＝固定視窗）、`cooldownMaxMs`（預設 24 小時），視窗外再觸發即乘以 growth、成交歸零；另有持久連敗 `coolAfterFails`（整組皆敗連續 N 次即降序，給 `store` 才跨行程累計） |
| `coolDetect` | 無 | CLI 類限流的唯一入口（依賴注入）。**須為同步函數**：回傳 Promise 或拋錯皆視同 `false`。以字樣判定時先排除驗證失敗——其 `stderr` 帶驗證函數自己的訊息，可能誤中字樣：`(r) => r.errorType !== 'validation' && /quota/i.test(r.stderr \|\| '')`。agy 額度用盡時的實際字樣與離開碼套件未驗證，先觀察到再寫 |
| `shouldStop` | 無 | 4 小時派工中途要止損的唯一手段：於每次嘗試之間，**以及 `spawnGate` 守門等待中**檢查，回 `ABORTED`／`errorType: 'aborted'`。它不會中斷進行中的那一次嘗試（守門等待尚未 spawn，所以可中止）；同為**同步契約**，回傳 Promise 視同 `false`（等於從不止損）。1.0.109 起：呼叫端另給 `spawnGate.shouldStop` 時兩來源以「**或**」合併（任一回傳恰為 `true` 即中止；修前呼叫端給了則遞補層之中止請求不能中止守門等待） |
| `spawnGate` | 未給＝**不限**（1.0.73 起；守門為 no-op：不查行程、不取樣，零成本） | CLI 類每次 spawn 前的機器級守門，**antigravity 預設不限**（只有 opencode 預設啟用，其 `opencode.exe` 單次短呼叫實測約占 1.1 核心）。**未驗證處**：`agy.exe` 在套件實測機上沒有行程，**其 CPU 占用從未量測**——預設不限是「未證實會占核故不擋」，不是「已證實不占核」，有實測後預設可能改為限制。要限者逐次明給 `spawnGate: { maxCli: N }`（數機器上 `agy.exe`〔非 Windows 為 `agy`〕之行程數，達 N 即等；RAM／CPU 門檻同樣預設關，要用另給 `ramUsedMax`／`cpuMax`），`false` 明確關閉。啟用後：每 10 秒再查、累計等逾 10 分鐘放行（fail-open，計數或取樣失敗亦放行）；等待在 spawn 之前，**不計入該次 `timeoutMs`**，有 `budgetMs` 時計入預算；1.0.109 起有期限（`budgetMs` 換算之期限與呼叫端 `spawnGate.deadlineAt` 取較早者）時，探針逾時亦不超過「期限 − `minAttemptMs` − 現在」、排互斥鎖之等候受同一期限約束，到點即 fail-open 放行（`onTrace` 之 `fail-open` 事件 `reason` 為 `'deadline'`／`'lock-timeout'`；因期限縮短而逾時者不算探針故障、不冷卻）；結果實際等過才帶 `gateWaitedMs`、逾時放行者另帶 `gateFailOpen: true` |
| `quotaGate` | 未給＝**預設開**（antigravity 條目自 1.0.79 起；此鍵為遞補層與 `createAiCaller` 的選項，不是 `dispatchAntigravity()` 的自用鍵、不轉傳轉接器） | 遞補層選到 agy 條目（**無 `keys` 者**）、呼叫轉接器前，先看**額度帳**（`store.quota`，`now < until` 即略過、不查不派），再以 `getQuotaAntigravity`（`agy -p "/usage"`，唯讀、不耗額度）查用量，**任一視窗 `usedPercent ≥ 95` 即略過、不派**——事件 `quota-skip`（帶 `source`：`'usage-api'`／`'ledger'`／`'limit-text'`）、`tried[].outcome: 'quota-skip'`、合成失敗結果 `errorType: 'quota'`、`failureKind: 'no-credit'`、`error` 以 `QUOTA_COOLDOWN:` 開頭、`attempts: 0`；**不寫條目冷卻**（`cooldownMs` 之既有語意不變）。此前額度滿期間，每輪每席都先空試一次（可達逾時）。視窗依 `model` 對到 `/usage` 的群組：`gemini-4-argon*`→「Gemini 4 Argon」、`gemini-*`→「Gemini Models」、`claude-*`／`gpt-oss-*`→「Claude and GPT models」，**對不到取全部視窗**——所以 `agy:claude-*` 條目看的是「Claude and GPT models」群組（含 5 小時窗），不是 Gemini 的。**入帳**：判定為被擋且被擋視窗的重置時刻可解析時，寫入 `store.quota`（`until` 為被擋視窗重置時刻之最晚者，上限現在＋8 天，跨行程經既有 `store` 持久化；`store` 無效時退回行程內記憶體），之後 `now < until` 不再查詢，過期才重查；agy 的額度字樣本套件未見過、**不內建**，要靠失敗文字入帳者由呼叫端注入 `quotaUntilOf(r)`（以 `entry:<id>` 入帳，只對明給 `id` 的條目有效）。**預設只作用於 `exe` 為真的 `agy`（或未給 `exe`）**，假 CLI 與包裝腳本不被預設查詢，明給 `quotaGate: true` 或物件才不論 `exe`。**fail-open**：讀者逾時、拋錯、未授權、欄位缺漏、`usedPercent` 缺漏或非數字一律不擋（另發 `quota-gate-error`）。**成本**：agy `/usage` 較慢（套件本機實測 1 次 9.5 秒；套件 README 稱 10～60 秒），讀者結果預設快取 300 秒（`antigravityCacheMs`）、查詢逾時 60 秒（`antigravityTimeoutMs`），首次呼叫與快取到期後的第一次呼叫會多等這段。**關閉**：`quotaGate: false`（遞補層頂層或單一條目；查用量、讀帳、寫帳三處全關）；只想調門檻用 `antigravityMax`（`false` 關閉該家）或 `windowMax`。帳在重置前不重查，期間若升級方案或補充額度，須清除 `store.quota` 之該鍵或 `quotaGate: false` |

遞補鏈遇到 `TIMEOUT`、`spawn`（子進程起不來，含命令列過長）或 `params`（參數與設定檢核失敗，如 `env` 不可讀或給了非物件、`exe`／`cwd`／`skipPermissions`／`addDirs` 給了而無效）時**整組跳過**，不在同組內逐把換金鑰。1.0.109 起條目層之 `params` 失敗（含上述安全相關 opt 給了而無效）於發 `try` 事件**之前**即判，**不發 `try`**（`onUsage` 不入帳；仍進 `tried`）；轉接器自身才得知之 `params`（如 `model` 缺漏）仍在 `try` 之後，結果帶 `attempts: 0` 可辨。

**`budgetFor()` 有陷阱，不要照抄**：它**只累加條目自己的 `timeoutMs`**，讀不到你寫在 opt／`defaults` 的那一個；而套件內建的 providers 條目**刻意不帶 `timeoutMs`**，所以 `budgetFor(內建條目)` 恆為「條目數 × 300000」（1.0.53 內建 21 條就是 105 分鐘）——比你的 4 小時還小，反而把它壓下去。要用它就得先把 `timeoutMs: 14_400_000` 逐條寫進每個條目，否則直接寫 `K × 14_400_000`。

**工作流層的覆寫順序**（細者覆蓋粗者）：`dispatchAiWkf` 的 `defaults` → 各工作流 `callOpt` → 階段／名額規格 → provider 條目。把 4 小時寫在 `defaults`、而某條目自帶較小的 `timeoutMs` 時，**條目會贏**。另外 1.0.49 起呼叫層的 `validate`（含寫在 `defaults` 者）會與工作流的 `parse`／`check` **取交集**，兩者皆過才算過——此前被靜默忽略，舊設定升版後可能開始擋下回覆而換家。

**與套件內建規劃的關係**：`w-dispatch-ai/src/providers.mjs` 檔頭的 timeout 規劃以「單一 AI 工作約 15 分鐘」估出 `timeoutMs: 1_200_000`，那是一般複雜任務的估法；**正式派工以本節的 4 小時為準**，不要照抄 20 分鐘把它調回去。套件內部四層（②～⑤）的權威整合說明在套件 README 的「Timeout 總覽」一節；第①層是呼叫端的事，README 不涵蓋。

**被砍時要保住已完成的部分**：失敗結果的 `stdout` 只會留 500 字元（`wsemi/src/execCli.mjs`），所以正式派工一律掛 `onStdout` 邊跑邊落檔——〈執行步驟〉的範本已寫入 `stdout.log`，不要拿掉，否則被砍就真的什麼都不剩。

**逾時與假成功是兩回事**：外層逾時被殺時 `errorType` 為 `timeout`；而**權限不足、提示詞層被禁止寫檔、明給小 `printTimeout` 時的內層逾時三者，agy 都是 exit 0，轉接器回 `ok: true`、不產生 `errorType`**——除非掛了 `validate`：權限不足時 stdout 為空，`nonempty` 會把它轉成 `validation` 失敗。看到「沒有結果但也沒有錯誤」先分清是哪一種，別互相誤診。

## 權限：先定能力下限，再往下收斂

派工前先回答一個問題：**這個任務少了哪一項能力就做不出來？** 那是下限。安全考量只能在下限之上收斂範圍（工作區目錄），不能低於下限——低於下限不是比較安全，是拿不到結果，而且會以 exit 0 回報（見下一節實測）。

| 任務類型 | 能力下限 | agy 的給法 |
|---|---|---|
| 純生成、翻譯、改寫（素材全在提示詞內） | 無 | `addDirs: []`，不公開任何目錄 |
| 探索、調研、讀碼回答 | 讀檔 | `addDirs` 須含全部待查目錄；純讀取任務**不需**跳過權限（2026-09-08 實測通過） |
| 審計、複審、調查 | 讀檔 ＋ 寫檔（報告落檔）＋ 唯讀查證指令 | `skipPermissions: true`；`addDirs` 同時含被審目錄與產出目錄 |
| 寫測試、驗證猜想、重現問題 | 讀檔 ＋ 寫測試檔 ＋ 執行測試 | 同上；agy 建檔與跑指令走的都是需要 `command` 權限的工具 |
| 修改、實作 | 讀 ＋ 寫 ＋ 執行 | 轉接器預設的 `skipPermissions: true` |

轉接器的 `skipPermissions` 預設為 `true`（加入 `--dangerously-skip-permissions`），只有在輸入與工作區可信時才適用；**它只接受原始布林**（1.0.109 起）：給了非布林（`'false'`、`0`、`''`、物件等）回 `params` 失敗、不起子程序，不再退回 `true`（修前非布林一律退回 `true` 而悄悄關掉權限閘門）。要收斂時 agy 有三個維度：**①工作區目錄**（`addDirs`，最實際——把目標複製或 `git worktree` 出一份到獨立目錄，只把該目錄加進工作區）、**②執行模式**（`extraArgs` 傳 `--mode plan` 為唯讀規劃檔位、`--mode accept-edits` 為可寫執行）、**③終端限制**（`--sandbox`）。後兩者本技能尚未實測，用前先照「派工前的能力探測」驗一次。**注意 `skipPermissions: false` 不在這三個維度之內當作唯讀用**：它只擋工作區外之寫入，工作區內仍可寫（見下方〈`skipPermissions: false` 只擋工作區外之寫入〉）。

- **審計必須自己讀檔**。把檔案內容貼進提示詞不算獨立審計：被派對象只看得到你挑給它的片段，找不出你漏掉的地方，而那正是複審的唯一價值。
- **驗證猜想必須能寫檔並執行**。不能寫測試就只剩推論；「我認為可能是 X」沒有可重現的執行結果，不是結論。
- **`addDirs: []` 等於它什麼都讀不到**，探索與審計類任務必然交白卷。
- **沿用 `w-dispatch-ai/src/providers.mjs` 的條目要先看鎖**：表內五條 agy 條目（`agy:gemini-3.8-flash-high`、`agy:gemini-4-hydrogen-high`〔1.0.92 起〕、`agy:gemini-4-argon-high`、`agy:claude-sonnet-5-5-high`、`agy:claude-opus-5-5-high`）一律帶 `skipPermissions: false` 與 `addDirs: ['.']`，那是給純文字生成與遞補用的檔位，**但它只擋工作區外之寫入，不是唯讀**（工作區內仍可寫，見下方〈`skipPermissions: false` 只擋工作區外之寫入〉）。條目註解記載的 2026-08-15 canary 實測：無此鎖時要求建檔會真的落地，`false` 之下（寫到工作區外者）寫入被擋、唯讀工具照常，而且**被擋時 agy 回 exit 0、stdout 為空**（2026-10-18 於 1.4.2、2026-11-13 於 1.5.7 重測仍是如此，見下表）。要寫入就得把它覆寫為 `true`。另外這五條在全取鏈中**相鄰**（1.0.92 前為四條），agy 整體卡頓時會連續逾時 5 次（約 5×`timeoutMs`）才輪到下一家，套件建議全取時搭配 `budgetMs` 與 `cooldownMs`（README 行為變更紀錄第 31 條；條數依 1.0.92 條目註解）。

### 第四層權限：提示詞前綴（走工作流時預設禁止寫檔）

權限共有四層，前三層在你手上、第四層在套件手上：①CLI 旗標（`--dangerously-skip-permissions`／`--mode`）②轉接器選項（`skipPermissions`／`addDirs`）③`providers.mjs` 條目自帶的鎖 ④**提示詞前綴**。

`w-dispatch-ai` 的工作流層（`dispatchAiWkf` 之 `callAi`／`runFanout`／`runRolePipeline`／`runFanoutPipeline`）**預設會在提示詞前掛上 `NO_SIDE_EFFECT`**，其內文明寫「禁止建立、修改或刪除任何檔案…任何寫入磁碟的動作都不會被採用」（唯讀查閱不在此限）。

**後果**：`skipPermissions: true` 給了、工作區也開了，模型仍會照提示詞不寫檔——exit 0、`ok: true`、報告與測試檔一個都沒有。**症狀與權限被自動拒絕完全同型**（agy 兩者都是 exit 0），差別在輸出：權限被拒時 stdout 為空、stderr 帶 `jetski: no output produced — … auto-denied` 那段訊息（agy 1.1.27 時這段訊息印在 stdout），提示詞層被擋則是模型正常回話但沒建檔。

**要落檔就必須顯式關閉**：傳 `promptPrefix: ''`。注意**只有空字串才算關閉**，傳 `null`／`undefined`／省略都會回退成掛上。直接呼叫 `dispatchAntigravity()` 不受影響——該前綴只在工作流層自動掛。

### 權限不足是 exit 0 的假成功，不是錯誤

**實測摘要**（完整實測表移至 [references/agy-permission-tests.md](references/agy-permission-tests.md)；2026-10-18、`w-dispatch-ai` 1.0.53、agy 1.4.2、模型 `gemini-3.8-flash-high`、工作區以 `addDirs` 開放、掛 `validate: 'nonempty'`、輸出檔位置當時未載明）：`skipPermissions: false` 時離開碼 **0**、stdout 空、stderr 為 `jetski: no output produced — a tool required the "write_file" permission that headless mode cannot prompt for, so it was auto-denied. …`，轉接器 `ok: false`／`errorType: 'validation'`（是 `nonempty` 擋下的，不是 agy 報錯），檔案**未**建立；`skipPermissions: true` 時離開碼 0、stdout 為 `READ=… WRITE=DONE`、`ok: true`（16.6 秒），檔案建立。

- **離開碼不是成功判準**。上述 `false` 之實測 agy 本身回 exit 0；沒掛 `validate` 時轉接器照樣回 `ok: true`、stdout 為空。
- **非空輸出也不是成功判準**。2026-09-08 於 agy 1.1.27 測同一型任務時，同一段 jetski 訊息印在 **stdout**（當時權限名為 `command`），`nonempty` 直接放行；1.4.0（套件實測）與 1.4.2（上述實測）改印到 stderr，`nonempty` 才擋得下。CLI 一改版就可能再變，**最終一律以產物是否落地驗收**。
- 無介面模式沒有人可以回答權限詢問，未預先核准者一律**自動拒絕**，不是等待、不是報錯。只讀不寫的任務不受影響（1.1.27 實測只讀第一行可正常回 `READ=…`）。
- 訊息本身指出另一個檔位：在 agy 設定檔的 `permissions.allow` 加規則（如 `write_file(<target>)`）。用它之前先確認該設定檔路徑與規則語法（以最小探測驗證），否則就用 `skipPermissions: true` 搭配收斂過的 `addDirs`。

### `skipPermissions: false` 只擋工作區外之寫入，不是唯讀

**實測摘要**（完整實測表移至 [references/agy-permission-tests.md](references/agy-permission-tests.md)；2026-11-13、agy 1.5.7、模型 `gemini-4-hydrogen-high`、`w-dispatch-ai` 1.0.90、`cwd` 與 `addDirs` 為同一目錄〔工作區〕、掛 `validate: 'nonempty'`，三種組合各實呼 1 次）：`skipPermissions: true` 寫工作區內——成功、檔案落地（13.5 秒）；`skipPermissions: false` 寫**工作區內**——離開碼 0、`ok: true`、`WRITE=DONE`、檔案**落地**（8.2 秒）；`skipPermissions: false` 寫**工作區外**（與工作區同層、不在 `addDirs` 之目錄）——離開碼 0、stdout 空、`nonempty` 擋下為 `validation`、檔案**未**建立，stderr 為 `jetski: no output produced — … auto-denied`（6.3 秒）。

- **`skipPermissions: false` 只擋「工作區之外」的寫入；工作區內仍可寫**——它不是「防寫」或「唯讀」。「工作區」在本測試中 `addDirs` 與 `cwd` 為同一目錄，二者各自的效力未分別驗證。
- 與 `w-dispatch-ai` 1.0.92 之 README〈agy「防寫」之邊界〉段與條目註解之本機金絲雀相符（Hydrogen、3.8 Flash、Argon 各 1 次，三者一致）；本技能只實呼 Hydrogen，3.8 與 Argon 引用套件之紀錄。上節 2026-10-18 之舊實測（3.8 Flash、1.4.2）當時輸出檔之位置未載，無法判斷是 agy 行為改變，或當年測的是工作區外。
- **後果**：內建 agy 條目之「防寫鎖」（`skipPermissions: false` ＋ `addDirs: ['.']`）對「提示詞引導寫工作區內檔案」不設防；`cwd` 指向真實專案時，檔案可能真的被改。提示詞層之 `NO_SIDE_EFFECT` 前綴是請求不是強制，也補不了這一點。
- **要真唯讀時：尚無已實測之機械作法。** `--mode plan`、`--sandbox`、`--settings`（1.5.7 `--help` 新見，可傳 session 專用之 settings.json 鍵）本技能皆未實測，不得當作已證之唯讀鎖；要用先以「要求寫到 `cwd` 內之檔」金絲雀驗它是否真的不落地。目前可行之降風險作法只有：把 `cwd`／`addDirs` 指向**可丟棄之副本**（目標複製或 `git worktree`），原件不在 `addDirs` 內（工作區外之寫入被擋，如上述「寫工作區外」之實測），收回後審副本之 diff。

### 派工前的能力探測

正式派工前，以**與正式派工相同的權限與工作區選項**跑一次最小探測：

```javascript
const probe = await wda.dispatchAntigravity(
    '讀取工作區內 <目標檔絕對路徑> 並原文輸出第 1 行；'
    + '再於 <產出目錄絕對路徑> 建立 probe-out.txt，內容為 OK；'
    + '最後只回一行：READ=<第1行> WRITE=<DONE 或 FAILED>',
    //探測維持短逾時、前景執行（壓在前景預設 120000 之內）；正式派工改走〈逾時與等待〉
    //100_000 時外層 100 秒先到（printTimeout 推導為 130 秒）；agy 啟動就要數秒到二十幾秒，探測任務要夠小
    { model: 'gemini-4-hydrogen-low', addDirs, cwd, timeoutMs: 100_000, validate: 'nonempty' },
);
// 只看 stdout 不算數：要確認 probe-out.txt 真的落地
```

探測可用低檔位，它驗的是權限不是推理；正式派工再換回預設模型。探測失敗時先修權限與 `addDirs`，不要改提示詞重試。（`gemini-4-hydrogen-low` 於 2026-11-13 之 `agy models` 列出、`/effort` 可查；**本輪未對 `-low` 檔實呼**，實呼只用 `-high` 檔——要用 `-low` 探測者首次使用時自行確認它回得出結果。）**要依賴 `skipPermissions: false` 擋寫入者，探測須同時含「寫到工作區內」與「寫到工作區外」兩種**，才看得出它擋的只是工作區外（見上節）。

## 結構化輸出

print 模式的輸出格式以 `extraArgs` 指定：

```javascript
await wda.dispatchAntigravity(prompt, {
    model: 'gemini-4-hydrogen-high',
    extraArgs: ['--output-format', 'json'],
    timeoutMs: 14_400_000,
    validate: 'json',
});
```

使用 `stream-json` 時，應將 stdout 當成 JSONL 解析，且不可使用單一文件的 JSON 驗證器。`--json-schema` 可接受行內 schema 字串或 schema 檔案路徑。

**提示詞超過 30,000 字元時**，預設的 `promptVia: 'auto'` 會改走 stdin（固定 `--output-format stream-json`，`stdout` 已還原為純回覆文字、原始 NDJSON 在 `raw`；見〈提示詞傳輸〉），此時 `extraArgs` 若帶 `--output-format`（如上例）會回 `params` 錯誤、不 spawn。超長提示詞的呼叫請去掉該旗標；要保留該旗標者明給 `promptVia: 'argv'` 並把提示詞縮到 30,000 字元內。

## 轉接器契約（w-dispatch-ai 1.0.109）

**給了而無效之處置（1.0.109 起，勿再依賴「無效即退回預設」）**：影響安全或可視範圍之 opt（`exe`、`cwd`、`skipPermissions`、`addDirs`、`env`）**給了而無效（含 `''`）即以 `params` 拒絕**（`ok: false`、`attempts: 0`、不起子程序〔含 stdin 路徑之 `agy --version` 探測〕、訊息不回顯值）；`undefined`／`null` 才視為未給。`timeoutMs`、`maxRetries` 等量級／次數類則**視為未給而用預設**（不報錯）。要用預設就**不給該欄**。

| 選項 | 轉接器預設值 | 行為 |
|---|---:|---|
| `exe` | `agy` | 執行檔名稱或絕對路徑；給了而非非空字串（含 `''`）回 `params`（1.0.109 起，修前退回 PATH 上之 `agy`） |
| `model` | 省略 | 展開為 `--model <slug>` |
| `effort` | 省略 | 展開為 `--effort <level>` |
| `skipPermissions` | `true` | 加入 `--dangerously-skip-permissions`；須為原始布林，給了非布林回 `params`（1.0.109 起，修前退回 `true`） |
| `printTimeout` | `timeoutMs` 秒數 + 30 | agy 內層逾時；預設推導值恆晚於外層，只作後備（推導不另行封頂，見〈逾時分層〉）。明給小於 `timeoutMs` 的值會讓慢回合變成 `ok: true` 的截斷輸出 |
| `addDirs` | 實際 `cwd` | 重複展開為 `--add-dir`；明確傳入 `[]` 可停用自動加入；給了而非陣列、不可讀、元素數逾 10000、或非空而元素全無效者回 `params`（1.0.109 起，修前退回 `[cwd]`） |
| `promptVia` | `'auto'` | **1.0.80 新增**，自用鍵、不轉交 `execCli`。`'argv'`／`'stdin'`／`'auto'`（無效值回退 `'auto'`）：不超過 30,000 字元走 `--print`、超過走 stdin 的 `--input-format stream-json`；細節見〈提示詞傳輸〉 |
| `extraArgs` | `[]` | 接在固定旗標之後、`--print <prompt>`（argv 路徑）或 `--input-format stream-json --output-format stream-json`（stdin 路徑；此路徑下不得含衝突旗標，見〈提示詞傳輸〉）之前 |
| `timeoutMs` | `300000` | 外層程序樹逾時；須為 1～2147483647 之整數或其十進位數字字串，其餘（0、負數、小數、超過上限、`Infinity`、`'0x10'`、包裝物件）視為未給而用 300000，不夾上限、不報錯（1.0.92 起） |
| `cwd` | 目前目錄 | 子程序工作目錄；給了而非非空字串（含 `''`）回 `params`（1.0.109 起，修前退回目前目錄）。**它本身不會讓 agy 看得到檔案**——agy 以自身 scratch 目錄為工作區，可視範圍只由 `--add-dir` 決定；未給 `addDirs` 時轉接器自動把有效 `cwd` 加進去，就是為了補這個落差 |
| `env` | 省略 | 額外子程序環境變數，只作用於該次呼叫、不污染 `process.env`；以淺層副本轉傳（只讀一次）；**給了而非可讀之一般物件（字串含 `''`、數字、布林、陣列、`Map`、函數、包裝物件、不可讀者如拋錯之 getter、已撤銷之 `Proxy`）於啟動前回 `errorType: 'params'`**（1.0.109 起，修前非物件視為未給而令子程序繼承 `process.env`；stdin 路徑之 `agy --version` 探測亦在判定之後） |
| `validate` | 省略 | 由套件自身判定（`src/runExecCli.mjs`；1.0.49 起不交 `execCli`）：規則字串或自訂函數，函數可回傳 Promise，等待時間算在同一次嘗試的 `timeoutMs` 內；拋錯、reject、逾時皆為 `OUTPUT_VALIDATION_FAILED`（`errorType: 'validation'`） |
| `spawnGate` | 未給＝不限 | **1.0.73 新增**，自用鍵、不轉交 `execCli`。每次 spawn 前守門（驗證不過而重試者每次重守）；預設與依據見〈逾時分層〉選項表 |
| `maxRetries` | `0` | 須為 0～4294967295 之整數或其十進位數字字串，其餘（`Infinity`、`'0x10'`、小數、負數、超過上限）視為未給＝0（1.0.109 起）；以判定後之值轉交 `execCli` |
| `retryDelayMs`、`onStdout`、`maxBuffer` 等 | 依選項而定 | 原樣轉交給 `wsemi` 的 `execCli`；長任務建議掛 `onStdout` 邊跑邊落檔 |

回傳結果包含 `{ ok, stdout, stderr, code, error, errorType, durationMs, pid, attempts }`（守門實際等過時另帶 `gateWaitedMs`，逾時放行者再帶 `gateFailOpen: true`，`durationMs` 不含守門等待）；必須檢查 `ok`。子進程未能啟動時 `code` 為 `null`、`pid` 為 `undefined`、`errorType` 為 `spawn`；`durationMs` 含驗證時間。1.0.81 起：失敗（非零離開、訊號結束、逾時）之 `error` 為 `Exit code N: <尾段>`／`TIMEOUT after Ns: <尾段>`（尾段取子進程輸出之真正尾端並遮金鑰），另帶 `errorDetail: { exitCode, stderrTail, stdoutTail? }`；成功另帶 `finish`、`outputChars`。勿以 `error` 精確比對，改看 `errorDetail.exitCode`；`coolDetect` 之字樣判定照舊讀 `stderr`。stdin 路徑另帶 `raw`（agy 原始 NDJSON 輸出，離開碼 0 之結果才有）。轉接器會捕捉提示詞過長（`promptVia: 'argv'`）與 spawn 失敗，維持不 reject 的契約。

請使用 UMD 預設匯出：`import wda from 'w-dispatch-ai'`。

### 表以外的細節一律查原始碼（當前安裝版）

上表只列常用鍵。**細部設定、權限與工作區、實際可用的模型、錯誤分類等只要不確定，就去讀當前安裝版的原始碼，不要憑記憶或猜測**——技能寫的是查核當日的狀態，套件與 CLI 都會滾動。

原始碼就在**技能根的 `node_modules/w-dispatch-ai/src/`**（見「套件裝在哪」一節）。**不要用 `npm ls` 或 `require.resolve` 查**——那兩者從當前專案解析，可能指到另一份。

| 想知道 | 讀哪個檔 |
|---|---|
| 完整選項、預設值、固定旗標與其順序、哪些鍵不轉傳給 `execCli` | `src/dispatchAntigravity.mjs`（旗標順序為 `--dangerously-skip-permissions` → `--print-timeout` → `--model` → `--effort` → 各 `--add-dir` → `extraArgs` → `--print <prompt>`〔argv 路徑；stdin 路徑改為 `--input-format stream-json --output-format stream-json`、不帶 `--print`〕；自用鍵九個：`exe`／`model`／`effort`／`skipPermissions`／`printTimeout`／`addDirs`／`extraArgs`／`input`／`promptVia`，其餘鍵經 `src/runExecCli.mjs` 轉給 `execCli`（`validate` 除外，由該檔自行判定）；提示詞上限 30000 字元（僅 argv 路徑）與 `promptVia` 的傳法、stdin 路徑判成敗與舊版 agy 的處置、`printTimeout` 推導公式（`timeoutMs` 秒數 + 30；`timeoutMs` 已先經 `castTimerMs` 判為 1～2147483647 之整數，推導不另行封頂）亦在此；stdin 輸出的解析與版本探測在 `src/parseAgyStream.mjs`、`src/checkAgyStdinSupport.mjs`） |
| 有哪些 kind、何時用 CLI 類何時用 REST 類 | `src/adapters.mjs` 檔頭（判準只有一條：這次呼叫需不需要工具） |
| 實際可用且已被實測過的模型條目（含權限鎖、`addDirs`、實測耗時） | `src/providers.mjs` |
| `validate` 規則語法與判定 | `src/buildValidator.mjs`（規則字串）與 `src/runExecCli.mjs`（判定流程）——**1.0.49 起 CLI 類不再走 `wsemi/src/execCli.mjs` 內建的驗證器**，規則語法與其逐字相同。`nonempty`／`json`／`min:N`，逗號串接須全部通過；自訂函數可回傳 Promise，拋錯或 reject 時 stderr 前綴 `validate threw: <訊息>`、逾時前綴 `validate timed out: did not settle within <N>s`。但**規則名稱打錯（如 `nonemtpy`）會被靜默忽略、等於完全沒驗**——判斷式沒有 `else` 分支，只有 `min:` 的參數打錯（如 `min:abc`）才算失敗。agy 被權限擋下（stdout 空）只靠 `nonempty` 擋得住，這個字更不能打錯 |
| `errorType` 值域與判準 | `src/getErrorType.mjs` 檔頭一覽（子進程未能啟動一律以結構判定為 `spawn`：`code` 為 `null` 且 `pid` 為 `undefined`，含命令列過長、權限不足、非有效執行檔；前置檢查擋下的提示詞過長（`promptVia: 'argv'`）則為 `params`，stdin 路徑的 `extraArgs` 衝突旗標與 agy 版本過舊亦為 `params`，stdin 路徑無 `result` 事件或 `result` 非 `SUCCESS` 為 `exec`；1.0.73 起 `spawnGate` 守門等待被 `shouldStop` 中止時亦回 `aborted`；1.0.79 起 `quotaGate` 略過條目之合成失敗結果為 `quota`） |
| 遞補層送出前的額度門檻（`quotaGate`）與額度帳 | `src/subQuotaGate.mjs` 檔頭（訂閱類條目的適用範圍、agy 群組對照、選項與快取）、`src/quotaLedger.mjs`（`store.quota` 形狀與 8 天上限）、`src/quotaJudge.mjs`（視窗判定與快取）；agy 讀者為 `src/quota/getQuotaAntigravity.mjs` |
| 逾時的完整機制 | **`README.md` 之「Timeout 總覽」是唯一把各層串起來的權威說明**（階梯結構、各參數預設、工作流總時長公式）；細節另見 `src/dfTimeoutMs.mjs`（統一預設 300000；其註解已更正：agy 1.4.0 之 `print-timeout` 預設為 `0s`，此值不再以「對齊 5m0s」為依據）、`src/castTimerMs.mjs`（`timeoutMs` 判定單一來源：1～2147483647 之整數才採用，其餘回預設，不夾上限）、`src/castCountOr.mjs`（`maxRetries` 等次數類）、`src/readSafeOpt.mjs`（`exe`／`cwd`／`skipPermissions`／`addDirs`／`env` 給了而無效即拒絕）、`src/gateHints.mjs`（`shouldStop`／`minAttemptMs` 兩來源合併）、`src/runExecCli.mjs`（自訂 `validate` 與子進程共用同一次嘗試之 `timeoutMs`）、`src/budgetFor.mjs`（只累加條目層 `timeoutMs`）、`src/dispatchAiFallback.mjs`（`budgetMs`／`minAttemptMs`／`cooldownMs`／`coolDetect`／`shouldStop` 之實際行為）、`src/dispatchAiWkf.mjs` 檔頭；守門等待在 spawn 之前、不計入 `timeoutMs`、計入 `budgetMs`，見 `src/cliSpawnGate.mjs` 檔頭【逾時歸屬】與 README 之「CLI spawn 守門」 |
| spawn 前機器級守門（`spawnGate`）：預設值與依據、同一瞬間整批放行之處理、成本實測、fail-open | `src/cliSpawnGate.mjs` 檔頭（含 `onTrace` 事件型別）與 `README.md` 之「CLI spawn 守門」；接點為 `src/runExecCli.mjs`（四家轉接器共用之單一入口） |
| 提示詞層之防寫前綴 | `src/wkf/noSideEffectPrefix.mjs`（前綴原文）、`src/wkf/callAiWithFallback.mjs`（預設掛上、`promptPrefix: ''` 才關閉） |
| 多供應商遞補、金鑰輪替、條目 id 命名規則 | `src/dispatchAiFallback.mjs` 檔頭 |

**檔頭註解是實測紀錄，不是設計說明**：`src/dispatchAntigravity.mjs` 檔頭記著一組最容易誤判的實測（2026-08-13，以隨機 token 驗證）——**只給 `cwd` 而沒有 `--add-dir` 時，弱模型直接回「找不到檔案」、強模型自行摸索（116 秒，對照帶 `--add-dir` 的 6 秒），而且兩者都是 `ok: true`**；這種情況極易被誤判成「模型能力不足」，實際是可視範圍沒開。同檔另記載 `--print` 為帶值旗標（純文字塞 stdin 會進互動模式卡住）、1.0.80 起的【提示詞兩種傳法】（`promptVia` 與預設取 `'auto'` 的理由）、【stdin路徑之判成敗】與【舊版agy → 明確錯誤】三段、model 與 effort 的衝突規則（帶檔位 slug 與 `--effort` **檔位不一致才拒絕**，一致則放行）、未給 model 時 agy 預設為 Gemini 4 Argon (Medium)、雙逾時改為外層先到的理由，以及權限被擋時 stderr 的訊息。與本技能所述不一致時，以原始碼與其實測註記為準，並回頭修技能。

## 執行期驗證

```bash
agy --version     # 須 >= 1.1.25
agy --help
agy models        # 伺服器即時型錄, 唯一可信的 slug 來源
MSYS_NO_PATHCONV=1 agy -p /effort --model <基礎slug> --output-format json   # 該模型可用之 effort; 前綴只在 Git Bash 需要
agy changelog     # 確認新版是否影響 headless 派工
```

截至 2026-11-13 審查時，本機 agy 1.5.7 之即時 `agy models` 列出 `gemini-4-hydrogen-high`（本技能預設；另有 Hydrogen 其餘三檔、Gemini 4 Argon 三檔、仍在型錄之 `gemini-3.8-flash-high` 等），並已實跑驗證。無介面模式遇到不存在的指定模型時以 exit 1 結束（`errorType: 'exec'`），不會靜默退回其他模型。

## 派什麼、怎麼驗收：審計／複審／規劃審核類派工先審表，再審方案

本技能只管「怎麼呼叫 agy」與「給到任務所需的能力」；本節是把設計複審、架構審查、規劃審核派給任何對象時「派什麼、怎麼驗收」（四個 dispatch-* 技能本節內容相同，改一處要四處同步）。所稱「表」是輸入空間表：先列軸，每軸成員以 grep 自系統取得，軸與軸做笛卡兒積，每格填「現況／應然／處置」，建法見 skill[role-coder-for-validate]〈Step 1〉。

- **被派對象必須能自行讀檔**：不能讀檔就不是獨立審查，先解決讀檔（見〈權限：先定能力下限，再往下收斂〉），不得改成把檔案內容貼進提示詞充數。派長任務前先以「讀某檔並原文引用第 N 行」做最小探測；`validate` 須要求回覆引用指定內容，不只驗非空。
- **複審的價值在找出我漏掉的格**，不在評價我已列的方案——方案再好也補不了輸入空間的漏格。提示詞必依序要求：①挑戰表的完整性（缺軸、缺格、格內現況不屬實者，附 `file:line`）；②審對標（同類成熟產品之作法與本系統之差異）與對稱性（同型元素之規則是否一致）；③最後才審方案與步驟。
- **讀到不可辨識之內容時要標明，不得臆測**：提示詞須要求被派對象遇到亂碼、替換字元（U+FFFD）或無法解碼之中文註解時，明寫「該處不可讀」，不補寫、不臆測引用；收回後把回覆中之引用與原文逐字比對，不符者先查該次工具輸出是否已失真（如 codex 之 `commands[].output`），再判斷是讀檔失真或模型引用出錯。
- **表還沒建好就先建表，不派工**：沒有表就派人審方案，等於把漏格帶進實作。
- **收回後逐格核對原始碼**（`file:line`）才採納，不整批接受，也不整批駁回；採納／駁回逐條附理由。
- **自審的表一定有洞**：曾有一張自認完整的互動矩陣，交外部複審後仍被找出 30 格缺口，且全部屬實。所以派工不是「請你確認我對」，是「請你找我漏的格」；自己檢查過也不能跳過複審。

## 安裝檢查

```bash
npm install w-dispatch-ai@latest

# Windows PowerShell
irm https://antigravity.google/cli/install.ps1 | iex

# macOS / Linux
curl -fsSL https://antigravity.google/cli/install.sh | bash

agy --version
agy update       # 版本低於 1.1.25 時升級
```

無人值守／無介面執行前，須先以互動方式完成 Google 認證。

2026-11-23 對照：以 `w-dispatch-ai` **1.0.109** 之原始碼（`src/dispatchAntigravity.mjs`、`src/readSafeOpt.mjs`、`src/castTimerMs.mjs`、`src/castCountOr.mjs`、`src/gateHints.mjs`、`src/runExecCli.mjs`、`src/cliSpawnGate.mjs`）與 README 行為變更紀錄第 73、79、82、83、86 條核對（**未實際呼叫 agy**；agy 版本、型錄與 `/effort` 仍依 2026-11-13 於 1.5.7 之實查，未重驗）。固定旗標順序與九個自用鍵（`exe`／`model`／`effort`／`skipPermissions`／`printTimeout`／`addDirs`／`extraArgs`／`input`／`promptVia`）不變；**更正 2026-11-13 查核表之「已知與 1.0.92 不符待另案更正」**（`timeoutMs` 無效值改用預設、`--print-timeout` 推導不再封頂，已於〈逾時分層〉與〈轉接器契約〉更正），並補 1.0.109 之變動——使用端若依賴「無效即退回預設」須改為不給該欄：

| 項目 | 現行行為（修前） |
|---|---|
| `timeoutMs` | 1.0.92 起：1～2147483647 之整數才採用，其餘（超過上限、`Infinity`、`'0x10'`、小數、包裝物件）用預設 300000，不夾上限（修前超過上限者 CLI 類被 `execCli` 改用其自有之 120000、REST 類被 Node 視為 1 毫秒） |
| `--print-timeout` 推導 | `floor(timeoutMs / 1000) + 30` 秒，不另行封頂；`timeoutMs` 無效而用預設時為 `330s`（修前超過上限者得 `2147513s`） |
| `skipPermissions` | 給了非布林回 `params`（修前退回 `true`，即關掉權限閘門） |
| `addDirs` | 給了非陣列、不可讀、元素數逾 10000、或非空而元素全無效者回 `params`（修前退回 `[cwd]`，放寬可視範圍）；`[]` 合法（不揭露任何目錄） |
| `exe`、`cwd` | 給了而非非空字串（含 `''`）回 `params`（修前退回 PATH 上之 `agy`／目前目錄） |
| `env` | 給了而非一般物件（含字串、數字、陣列、`Map`、函數、不可讀者）回 `params`，於 stdin 路徑之 `agy --version` 探測之前判（修前非物件視為未給、子程序繼承 `process.env`） |
| `maxRetries` | 0～4294967295 之整數或十進位數字字串才採用，`Infinity`、`'0x10'`、小數、超過上限視為未給＝0（修前 `Infinity` 令驗證不過者近乎無限重試） |
| 遞補層 `shouldStop`／`minAttemptMs`／守門期限 | 與呼叫端 `spawnGate` 物件之同名鍵以「或」／「取較大者」合併；有期限時探針與排鎖等候受期限約束（見〈逾時分層〉選項表） |
| 遞補層之條目層 `params` 失敗 | 於發 `try` 之前判，不發 `try`、`onUsage` 不入帳 |
| `providers.mjs` | agy 條目仍 5 條（`agy:gemini-3.8-flash-high`、`agy:gemini-4-hydrogen-high`、`agy:gemini-4-argon-high`、`agy:claude-sonnet-5-5-high`、`agy:claude-opus-5-5-high`）；內建 providers 現為 35 條 |

歷次查核（2026-11-13 及更早之對照表與實測紀錄）已移至 [references/agy-check-history.md](references/agy-check-history.md)；Hydrogen 換上預設與 3.8 Flash 沿革之敘述已移至 [references/agy-model-history.md](references/agy-model-history.md)。
