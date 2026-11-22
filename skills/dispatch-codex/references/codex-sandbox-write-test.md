# dispatch-codex：沙箱擋寫之實測表（2026-09-08，Codex 0.153.4）

本檔收 SKILL.md〈沙箱擋寫的實際樣子〉之實測表（原文逐字自 SKILL.md 搬移，未刪改）。結論與做法留在 SKILL.md。

同一段提示詞（讀 `probe.txt` 第一行，再於同目錄建立 `out.txt`），以 `--sandbox read-only` 執行：

| 觀察點 | 結果 |
|---|---|
| 讀取 | 成功（Codex 起 PowerShell 讀檔——再次印證讀檔就是執行 shell） |
| 寫入 | 被拒，stderr 出現 `error=patch rejected: writing is blocked by read-only sandbox; rejected by user approval settings` |
| `out.txt` | **未建立** |
| stdout | 一行看似正常的回覆 |
| 離開碼 | **0** |
| `--output-last-message <FILE>` 指定的檔案 | **有**建立——該檔由 CLI 本身寫出，不經模型的沙箱 |
