---
name: role-setup-ai-cli-logs
description: |
  AI CLI（Claude Code、Codex、OpenCode、Antigravity agy）本機對話紀錄之盤查與清理：各家紀錄位置與保留機制（以實查為準）、盤查步驟（只量路徑與大小，不讀對話內容與憑證）、清理原則（刪除一律先列清單與大小並經使用者確認，本技能不授權 agent 自行清理；`~/.claude/projects` 預設不動）、派發呼叫「不落紀錄」旗標之取捨（依賴續接之派工不得關閉 session 持久化）、清理與效能之判讀、典型錯誤形狀。
  觸發條件：使用者要求清理 AI 紀錄、釋放硬碟、查四家 CLI 佔用空間；懷疑紀錄膨脹拖慢 AI CLI 啟動或使單次呼叫卡住；要決定派發的 `claude -p`、`codex exec`、`opencode run`、`agy` 呼叫是否加 `--no-session-persistence`、`--ephemeral` 等不落紀錄旗標；定期維護提醒（建議每月）。
---

# role-setup-ai-cli-logs — AI CLI 本機對話紀錄之盤查與清理

> 本技能只做「盤查、列清單、提建議」。**刪除不在 agent 的自主權限內**：清單與大小經使用者確認後才可動手（§1 鐵則一）。

## 0. 一分鐘看懂

**解決什麼**：四家 CLI 每次呼叫都把對話（含工具輸出、檔案內容；Claude 另含系統提示詞與工具定義，見官方說明）以明文寫到本機；長期累積佔大量硬碟，各家保留機制不一，有的未查到自清機制。

**不解決什麼**：額度用盡、限流、網路問題造成的卡頓（§6）；套件層派發條目要不要預設加旗標（屬派發套件之議題，依全域設定 §5.2 通報，不在此改）。

**流程**：

| 步 | 做什麼 | 產物 |
|---|---|---|
| 1 | 實查版本、旗標與路徑（§3.1） | 各家版本、路徑存在與否 |
| 2 | 只量大小，不讀內容（§3.2） | 路徑 × 大小 × 修改時間 |
| 3 | 分類（§3.3） | 每筆一個標籤：當前 session／他 session／派發工作者／設定憑證／快取日誌 |
| 4 | 列清單與大小，請使用者確認（§3.4） | 待確認清單 |
| 5 | 確認後才執行，執行後回驗（§4） | 回驗結果 |

## 1. 鐵則

1. **刪除一律先列清單與大小，經使用者確認**。本技能不授權 agent 自行清理；「定期維護」也只是提醒使用者，不是排程自動刪除。使用者只說「看一下佔多少」時，交付只到清單為止。
2. **`~/.claude/projects` 預設不動**。當前與他 session 的 transcripts 可能是其他工作接續（`--resume`、`--continue`）的依據；釋放空間優先調 `cleanupPeriodDays` 讓 Claude Code 自清。「派發用」專案目錄也不因此直接刪，一律列入清單待使用者確認（派發工作者與主代理 session 難以只憑目錄名分辨，分錯即丟接續依據）。
3. **依賴續接（resume）的派工流程不得關閉 session 持久化**。`--no-session-persistence`、`--ephemeral`、`CLAUDE_CODE_SKIP_PROMPT_HISTORY` 只適用「確定不續接的一次性呼叫」；取捨見 §5。**不寫成「一律加」**。
4. **不讀紀錄內容**。紀錄與憑證檔明文含工具輸出、`.env` 內容與金鑰；盤查只用 `du`、`ls`（路徑、大小、時間），不 `cat`、不 Read、不 Grep 對話與憑證檔。要判斷歸屬時看目錄名與修改時間，不開檔。
5. **大量檔案與目錄連結的刪除處理**依全域設定 §3（暫存與連結）、§8.4（刪後回驗）與 skill[role-command-windows] §6（robocopy 鏡像空目錄法、先拆目錄連結），本技能不重抄。

## 2. 位置與保留機制（以實查為準）

下表為 2026-11-03 於 Windows 11 核對之結果（Claude Code 2.1.317、Codex 0.166.0、OpenCode 1.19.5、agy 1.4.12）。路徑以 `%USERPROFILE%` 為家目錄（macOS／Linux 為 `~`）；各家可被環境變數搬移（Claude Code 的 `CLAUDE_CONFIG_DIR`、Codex 的 `CODEX_HOME`），**各台版本與設定不同，動手前依 §3.1 重查**。逐項出處與查證狀態見 [references/各家紀錄位置與查證表.md](references/各家紀錄位置與查證表.md)。

| CLI | 對話紀錄位置 | 內建保留機制 | 官方刪除指令 | 派發呼叫不落紀錄 |
|---|---|---|---|---|
| Claude Code | `~/.claude/projects/<專案>/<session>.jsonl`＋同名目錄（`subagents/`、`tool-results/`） | **有**：`cleanupPeriodDays`（預設 30、最小 1，`0` 會驗證失敗；`-p --bare` 不掃） | `claude purge <路徑> --dry-run`（連 auto memory 一起刪） | `-p --no-session-persistence`（僅 `-p` 有效）；`CLAUDE_CODE_SKIP_PROMPT_HISTORY=1` |
| Codex | `~/.codex/sessions/<年>/<月>/<日>/rollout-*.jsonl` | **未查到**（官方參考頁只有手動 archive／delete） | `codex delete <id或名稱>`；`codex archive` 只隱藏，不釋放空間 | `codex exec --ephemeral` |
| OpenCode | sqlite，路徑以 `opencode db path` 為準（執行中另有 `-wal`、`-shm`） | 官方設定頁未載；本機日誌有 `cleanup prune=7.days` 行，**作用未查證** | `opencode session delete <id>`；刪列不縮檔，需另行 VACUUM | **無**（`opencode run --help` 無此類旗標） |
| Antigravity（agy） | `~/.gemini/antigravity-cli/conversations/`、`brain/` | 官方未載 | `/resume` 選單內刪除（官方頁載為 F4＋確認） | **無**（`agy --help` 只有 `--continue`、`--conversation`） |

另有各家的其他大檔（Claude 的 `file-history/`；Codex 的 `*.sqlite`；OpenCode 的 `log/`、`snapshot/`；agy 的 `log/`），見 reference。

## 3. 盤查步驟（先量再列；不印任何金鑰）

### 3.1 實查版本與旗標

issue 或舊筆記所載旗標一律先查再用，查不到不寫成事實：

```bash
claude --version ; claude purge --help
codex --version ; codex exec --help      # 找 --ephemeral
opencode --version ; opencode run --help ; opencode db path
agy --version ; agy --help
```

各家路徑存在與否用 `ls`／`[ -e 路徑 ]`；Claude Code 看 `CLAUDE_CONFIG_DIR`、Codex 看 `CODEX_HOME` 是否已設。

### 3.2 只量大小

`du -sh <路徑>` 只印大小。紀錄目錄常有數萬以上小檔，`du` 可能數分鐘：預估逾 2 分鐘者依全域設定 §8.5 背景執行；搜檔名用 Glob，不用 `find`／`ls -R`（全域 §8.2）。單一長 session 的 jsonl 常是大宗，用 `ls -laS <目錄> | head` 找最大者（只看名稱與大小）。

### 3.3 分類與確認無人使用

1. 執行中行程：`tasklist | grep -i -E "claude|codex|opencode|agy"`（Windows）。各家執行中不可刪其紀錄（OpenCode 的 sqlite 被行程開啟；Claude 進行中的 session 持續寫入），否則行程續持舊控制代碼，看似刪了實未釋放（全域 §8.4）。**自己這個 session 正在寫的 `projects/<專案>/<本 session>.jsonl` 不可動。**
2. 每筆貼一個標籤：
   - **當前 session**：不動。
   - **他 session**（含同專案的歷史 session）：預設不動（鐵則二）。
   - **派發工作者**（由主代理派發、不需續接的呼叫）：可列入清單，由使用者決定。Claude Code 以派發時的 cwd 建專案目錄；歸屬無法確定者一律歸「他 session」。
   - **設定與憑證**：不動（§4 不可刪表）。
   - **快取與日誌**：可列入清單。
3. 看各家內建清理是否已設：Claude Code 看 `cleanupPeriodDays`（只 Grep 該鍵，不讀整份設定）。**`~/.claude/settings.json` 是技能庫同步產物**，直接改會在下次同步被覆蓋；要長期生效須改稿件庫的 `settings_global.json`（依全域設定 §13 通報），僅暫時調整才改本機。

### 3.4 列清單請使用者確認

清單每列：路徑、大小、最後修改時間、標籤、**刪了會失去什麼**（見 reference 的「刪除代價」）。附建議與理由，最後問使用者要動哪幾列。使用者未點頭的列一律不執行。

## 4. 清理原則（經使用者確認後）

**順序**：①設定自清（`cleanupPeriodDays`）→ ②官方指令（`claude purge`、`codex delete`、`opencode session delete`、agy 的 `/resume` 刪除）→ ③手動刪檔（最後手段，須先確認無行程）。

| CLI | 做法 | 注意 |
|---|---|---|
| Claude Code | 調低 `cleanupPeriodDays`（最小 1），下次啟動非 `--bare` 的 session 時自清；單一專案才釋放時，先 `claude purge <路徑> --dry-run` 看清單，確認後再去掉 `--dry-run` | `purge` 會刪該專案 **auto memory**；不加 `--all`、`-y`，除非使用者明說；`purge` 不碰 `shell-snapshots/`、`backups/` |
| Codex | 逐筆 `codex delete`；整批刪 `sessions/` 前先與使用者確認 | `codex archive` 不釋放空間；第三方回報直接刪目錄可能使索引殘留孤兒，**未於本機驗證**，刪後以一次最短呼叫確認 CLI 能啟動 |
| OpenCode | 全部行程關閉後，`opencode session delete <id>` 再 `opencode db "VACUUM"`；或整個換新 db | VACUUM 需額外暫存空間，作用出自第三方回報，**未於本機驗證**；換新 db 會丟全部 session，須使用者明確同意；授權檔位置以實查為準，勿刪 |
| agy | 在 `/resume` 選單內刪除；目錄級刪除只動 `antigravity-cli/` 之下，且先確認 | `~/.gemini` 是共用家目錄，不可整個清；手刪 `conversations/` 後清單索引可能殘留，無法讀取（論壇回報） |

**不可刪（任何情況，除非使用者明說且理解後果）**：各家憑證與設定（Claude `.credentials.json`、`settings.json`、`~/.claude.json`；Codex `auth.json`、`config.toml`；OpenCode、agy 的授權與設定檔）；`~/.claude/plugins/`、`~/.claude/agent-memory/`；`projects/<專案>/memory/`（auto memory）；當前執行中的 session 檔。

**刪後回驗**（全域 §8.4）：目錄大小確實下降；該 CLI 以一次最短呼叫確認可啟動；沒有殘留行程持舊檔。

## 5. 派發呼叫「不落紀錄」的取捨

四家中只有 Claude 與 Codex 有旗標；OpenCode 與 agy 只能事後清。

| 做法 | 得到 | 代價 |
|---|---|---|
| 不加旗標（預設） | 可 `--resume`／`exec resume` 續接追問；事後有 transcript 可稽核「它當時做了什麼」 | 佔硬碟，要靠 §4 定期清 |
| `claude -p --no-session-persistence`；`codex exec --ephemeral` | 該次呼叫不留 session 檔 | 無法續接；事後無紀錄可查。`codex exec --ephemeral` 與 `exec resume` 的互斥是推論（無檔可續），未實跑 |
| `CLAUDE_CODE_SKIP_PROMPT_HISTORY=1` | 不寫 prompt history 與 transcripts | **官方稱作用於任何模式**，若設成全域環境變數，主代理自己的 session 也不落紀錄、不出現在 `--resume`；只在派發子行程的環境內設 |

**判準**：

- 確定一次性、不會追問或接續（例如單次審查摘要、一問一答）→ 可加。
- 依賴續接（分段審查、逾時後接續、修正輪追問、需要事後稽核）→ **不加**，改靠定期清理。
- 不確定 → 不加。

本技能不修改派發工具的呼叫條目；要預設加旗標屬派發套件之議題。

## 6. 判讀：清理與效能

- **紀錄大不等於慢**。卡住先看各家自身日誌，不要把額度或限流當成紀錄膨脹：OpenCode 看 `log/opencode.log` 的 `level=ERROR`，派發時加 `--print-logs --log-level ERROR`（既有派工經驗：遇免費層 429 時 `run` 可能不結束，本次未實跑）；Claude 用 `--debug`／`--debug-file`（官方另有 `claude doctor`）；Codex 用 `codex doctor`（`--help` 列為診斷指令）；agy 看 `log/` 內的日誌檔。日誌也可能夾帶對話片段，只看錯誤與狀態行（鐵則四）。
- **清理的確定好處是釋放硬碟**。對啟動速度、session 索引與續接清單的實益**未經量測，視為推測**，要寫進報告須先實測前後對照。
- **單一 session 檔過大**（會使 VS Code 開不了該 session）的處理是開新 session，不是刪檔；本庫的 `transcript-size-warn` hook 即為此提醒。

## 7. 定期維護 = 提醒

建議每月一次：只做 §3.1～§3.4，把清單與建議交給使用者；不排程自動刪除。若使用者要求排程提醒，依全域設定 §8.5 的機制，提醒內容仍只到清單為止。

## 8. 典型錯誤形狀

1. 把整個 `~/.claude` 當暫存清掉，連 auto memory、登入、plugins 一起丟。
2. 在 CLI 執行中刪 sqlite 或 jsonl，行程續寫舊控制代碼，看似刪了實未釋放（全域 §8.4）。
3. 以為紀錄膨脹造成卡頓而反覆清，實為額度用盡或限流。
4. 以「派發用」為由直接刪 `projects/*`，其中夾有他 session 的續接依據與 auto memory。
5. 把 `--no-session-persistence`／`--ephemeral` 一律加進所有派發，結果續接與追問全數失效，事後也無紀錄可稽核。
6. 把 `CLAUDE_CODE_SKIP_PROMPT_HISTORY` 設成全域環境變數，主代理 session 也不落紀錄。
7. 以為 `codex archive` 會釋放空間。
8. 把 issue 或舊筆記所載旗標（含本技能日後過時的內容）未經 `--help` 就寫成事實。
9. 直接改 `~/.claude/settings.json` 的 `cleanupPeriodDays`，下次同步被覆蓋。
10. 為了「判斷哪些可刪」而開啟紀錄檔閱讀，把其中的金鑰與 `.env` 內容讀進對話。
11. 使用者只問「佔多少」就順手清理。

## 9. 完成前勾選

```
完成前勾選
- [ ] 版本與旗標已實查（§3.1），未查到者標「未查證」
- [ ] 只用 du／ls，未讀紀錄與憑證內容
- [ ] 清單含路徑、大小、時間、標籤、刪除代價，並已請使用者確認
- [ ] 未經確認的列一律未執行
- [ ] 若有執行：無行程持舊檔、大小已回驗、CLI 最短呼叫可啟動
- [ ] 派發旗標建議已依 §5 判準區分「一次性」與「依賴續接」
```
