# dispatch-antigravity：權限相關之實測表

本檔收 SKILL.md〈權限〉下兩個小節之實測表（原文逐字自 SKILL.md 搬移，未刪改）：①〈權限不足是 exit 0 的假成功，不是錯誤〉之 2026-10-18 實測（agy 1.4.2）；②〈`skipPermissions: false` 只擋工作區外之寫入，不是唯讀〉之 2026-11-13 實測（agy 1.5.7）。結論與做法留在 SKILL.md。另有 ③〈`readOnly`：agy 真防寫〉之套件側實測摘要（2026-11-24，agy 1.5.12；**非本技能實呼**，轉錄自 `w-dispatch-ai` 1.0.112 之檔頭與條目註解）。

## ①〈權限不足是 exit 0 的假成功，不是錯誤〉之實測（2026-10-18）

2026-10-18 以 `w-dispatch-ai` 1.0.53 於 agy 1.4.2 實測：同一道「讀 `probe.txt` 第一行 ＋ 建立輸出檔」的任務，模型 `gemini-3.8-flash-high`，工作區以 `addDirs` 開放，掛 `validate: 'nonempty'`（**輸出檔位於工作區內或外，當時紀錄未載明**——`false` 列之「被擋」是否僅限工作區外，見下節 2026-11-13 之重測）：

| `skipPermissions` | 離開碼 | stdout | stderr | 轉接器結果 | 檔案真的建立？ |
|---|---:|---|---|---|---|
| `false` | **0** | 空 | `jetski: no output produced — a tool required the "write_file" permission that headless mode cannot prompt for, so it was auto-denied. Add an allow-rule under permissions.allow in settings.json (e.g. write_file(<target>)). Alternatively, re-run with --dangerously-skip-permissions …` | `ok: false`、`errorType: 'validation'`——是 `nonempty` 擋下的，不是 agy 報錯 | **否** |
| `true` | 0 | `READ=探針第一行:… WRITE=DONE` | 空 | `ok: true`，16.6 秒 | 是 |

## ②〈`skipPermissions: false` 只擋工作區外之寫入，不是唯讀〉之實測（2026-11-13）

2026-11-13 於 agy 1.5.7，模型 `gemini-4-hydrogen-high`，以技能根之 `w-dispatch-ai`（實裝 1.0.90）呼叫 `dispatchAntigravity()`，`cwd` 與 `addDirs` 為同一目錄（工作區），掛 `validate: 'nonempty'`；三種組合各實呼 1 次，提示詞皆只要求讀檔與建檔：

| 組合 | 要求寫到 | 離開碼／轉接器結果 | stdout | 檔案真的建立？ |
|---|---|---|---|---|
| `skipPermissions: true`，`addDirs` 含探針檔與輸出目錄 | 工作區內 | 0／`ok: true`，13.5 秒 | `READ=探針第一行:派工測試ABC123 WRITE=DONE` | **是** |
| `skipPermissions: false` | **工作區內** | 0／`ok: true`，8.2 秒 | 同上（`WRITE=DONE`） | **是（落地）** |
| `skipPermissions: false` | **工作區外**（與工作區同層、不在 `addDirs` 之目錄） | 0／`ok: false`、`errorType: 'validation'`（`nonempty` 擋下），6.3 秒 | 空 | **否**；stderr 為 `jetski: no output produced — a tool required the "write_file" permission that headless mode cannot prompt for, so it was auto-denied. …` |

## ③〈`readOnly`：agy 真防寫〉之套件側實測摘要（2026-11-24，agy 1.5.12）

以下為 `w-dispatch-ai` 1.0.112 之 `src/dispatchAntigravity.mjs` 檔頭【真防寫】、`src/providers.mjs` 之 agy 條目註解與 README 行為變更紀錄第 90 條所載之實測結果，由套件側以 agy 1.5.12 於本機實測；**本技能未重跑**，耗時等逐次數字不轉錄。提示詞皆為固定之無害任務（要求把檔寫到工作區內；讀取案為讀工作區內檔之首行）；「落地」指檔案是否真的建立：

| 組合 | 模型 | 工作區內寫入 | 說明 |
|---|---|---|---|
| `skipPermissions: false`，無 `--settings`（基準） | Hydrogen | **落地** | 與官方〈Agent permissions〉頁一致：`write_file` 與工作區內 shell 指令預設為「Ask（工作區內自動允許）」；1.5.7 時 Hydrogen、3.8、Argon 皆落地，1.5.12 重測 Hydrogen 同 |
| `--settings` deny `write_file(*)` ＋ `command(*)`（即 `readOnly: true`） | Hydrogen、Argon、3.8（經轉接器各 1 次） | **被擋** | 模型回 `Permission denied for write_file(…). Matches user-configured deny rule`；`ok: true`、stdout 非空 |
| 同上，改為讀取工作區內檔案 | Hydrogen | 讀取成功 | 讀取照常 |
| 只 deny `write_file(*)`（不 deny `command`） | Hydrogen | **落地** | 模型改用 shell 繞過；故 `command(*)` 缺一不可 |
| `readOnly: true` ＋ `skipPermissions: true` | Hydrogen | **被擋** | deny 不被 always-proceed 取代 |
| OS 層唯讀工作區（ACL 拒絕寫入），`skipPermissions: false` | Hydrogen | **被擋** | `write_file` 得 `Access is denied`、shell 亦被擋；但須呼叫端自管副本與權限（平台相依），轉接器不提供 |
| `readOnly: true` | `agy:claude-sonnet-5-5-high`、`agy:claude-opus-5-5-high` | **未實測** | 套件註記該額度群組用量近滿；規則由 agy 權限引擎執行 |
