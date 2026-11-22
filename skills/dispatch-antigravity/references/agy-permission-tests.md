# dispatch-antigravity：權限相關之實測表

本檔收 SKILL.md〈權限〉下兩個小節之實測表（原文逐字自 SKILL.md 搬移，未刪改）：①〈權限不足是 exit 0 的假成功，不是錯誤〉之 2026-10-18 實測（agy 1.4.2）；②〈`skipPermissions: false` 只擋工作區外之寫入，不是唯讀〉之 2026-11-13 實測（agy 1.5.7）。結論與做法留在 SKILL.md。

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
