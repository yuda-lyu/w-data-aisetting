# dispatch-codex：Windows 讀非 ASCII 檔案之實測紀錄

本檔收 SKILL.md〈Windows 讀非 ASCII 檔案：只有原生工具直接輸出（rg／cmd /c type）不失真〉一節之實測表（2026-09-27，Codex 0.156.1）與 2026-11-13 於 Codex 0.167.0 之重驗（含對照組與未涵蓋項），以及末節〈更正舊記載〉與非沙箱重現之陷阱。原文逐字自 SKILL.md 搬移（未刪改），正文只留結論與做法。

**實測表（2026-09-27，Codex 0.156.1，`gpt-6-luna`／low，`--sandbox read-only`，Windows zh-TW 主控台代碼頁 950；以 session 紀錄 `~/.codex/sessions/…/rollout-*.jsonl` 之 `item_completed` 事件的 `aggregated_output` 判定 Codex 實際收到之內容，不經模型轉述；每個命令皆為獨立行程）**：

| 讀法 | 結果 |
|---|---|
| `rg -n '^' -- <檔>` | **完好** |
| `rg -n -m 3 '^' -- <檔>` | **完好**（限行數用 rg 自己的參數） |
| `cmd /c type "<檔>"` | **完好** |
| `rg -n '^' -- <檔> \| Select-Object -First 3` | 失真（U+FFFD 14） |
| `Get-Content -LiteralPath <檔> -TotalCount 3 -Encoding utf8` | 失真（U+FFFD 32） |
| `chcp 65001 > $null; Get-Content … -Encoding utf8` | 失真（U+FFFD 32） |
| `Get-Content -LiteralPath <檔> -TotalCount 3`（未指定編碼） | 失真（ANSI 誤解碼之亂碼） |
| `[System.IO.File]::ReadAllText(…)` | **被拒**（受限語言模式） |
| `[Console]::OutputEncoding=[System.Text.Encoding]::UTF8; Get-Content … -Encoding utf8` | **被拒**（受限語言模式） |

**重驗（2026-11-13，Codex 0.167.0；使用端回報「0.167.0 以 `rg` 讀含中文註解之行，審查者引用與原文不符」——未能重現）**：本機 `codex --version` 為 `codex-cli 0.167.0`，以技能根之 `w-dispatch-ai`（實裝 1.0.90）`dispatchCodex()`、`gpt-6.1-terra`／`model_reasoning_effort="low"`、`sandbox: 'read-only'`、`--json`，實呼 2 次；以 `--json` 事件流中 `item.completed`（`item.type` 為 `command_execution`）之 `aggregated_output`（Codex 實際收到之內容，不經模型轉述）逐行與原檔比對。事件之 `command` 欄為 `"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "…"`，與上文「Codex 以 PS 5.1 執行每個命令」一致。樣本為含中文註解、全形標點與 `〔〕「」＝→` 之公開套件原始碼：17 行節錄（另加 1 行純 ASCII），及同一檔之完整副本（1073 行、112,396 位元組）：

| 讀法 | 檔 | 結果 |
|---|---|---|
| `rg -n '^' -- <絕對路徑>` | 17 行節錄 | **完好**（17 行逐行與原檔一致，U+FFFD 0） |
| `rg -n -m 3 '^' -- <絕對路徑>` | 17 行節錄 | **完好**（3 行一致，U+FFFD 0） |
| `cmd /c type "<檔>"` | 17 行節錄 | **完好**（整段與原檔逐字相等，U+FFFD 0） |
| `rg -n '^' -- <絕對路徑> \| Select-Object -First 3` | 17 行節錄 | **失真**（U+FFFD 81，3 行皆與原檔不符）——對照組，證明本測法分辨得出失真 |
| `rg -n '^' -- providers-copy.mjs`（相對路徑、cwd 為該檔所在夾） | 完整副本 1073 行 | **完好**（1073 行逐行一致，U+FFFD 0） |
| `rg -n -C 2 'Hydrogen' -- providers-copy.mjs` | 完整副本 | **完好**（30 行一致，U+FFFD 0） |

兩次實呼中模型最後引用之原文（第 2 行；含「提出端」之第一行〔119 行〕）亦與原檔逐字一致。**結論**：`rg` 直接輸出於 0.167.0 本機（單次、模型為 terra low、各讀法各 1 次）**未見失真**，「rg 直接輸出為可行讀法」維持成立，PowerShell 管線之失真照舊。回報之失真**未能重現**，其當時所用之讀法與命令輸出**未留存**，無法確認：「審查者回覆之引用與原文不符」本身分不出是 Codex 收到之內容失真，還是模型轉述／引用出錯，也可能是當次混用了 `Get-Content`、管線或 `git diff` 等其他讀法——遇到時先看該次 `aggregated_output` 是否含 U+FFFD 或與原檔不符（見下方驗收），再判斷是讀檔失真或模型引用出錯，不要因此就捨棄 `rg`。**未涵蓋**：`gpt-6.1-terra` 以 `max` 推理之派工、更大之檔案、`git diff` 輸出、`Get-Content` 於 0.167.0 之行為（上表 0.156.1 之失真結果未重測）；單次實呼不代表不可能偶發。

## 〈更正舊記載〉與非沙箱重現之陷阱（2026-09-27）

**更正舊記載**：原載「`Get-Content -Encoding utf8` 與 `ReadAllText` 兩種寫法皆通過（2026-09-08 於 0.153.4 實測）」於 2026-09-27、0.156.1 之沙箱不成立：前者輸出端仍被編成 950 而失真，後者被受限語言模式拒絕；原載「本機實測 LanguageMode 為 FullLanguage」亦不成立（沙箱內為 ConstrainedLanguage）。當時為何通過未查證（推測當時之輸出代碼頁或語言模式與現況不同）。**非沙箱重現時的陷阱**：非沙箱之 FullLanguage 下 `[Console]::OutputEncoding=UTF8` 可用，但它改的是**整個主控台**的輸出代碼頁（`SetConsoleOutputCP`），同一主控台下之後啟動的行程全都改用 UTF-8 輸出——本機以同一 node 行程連續 spawn 驗證時（2026-09-27），第一回合 10 種讀法中 8 種失真（只有兩種先設 `[Console]::OutputEncoding` 者完好），第二回合 10 種全數「完好」，差別只在第一回合中途執行過這行。重現實驗每種讀法都要在乾淨主控台或以輸出位元組比對，不要讓前一個命令污染後一個。
