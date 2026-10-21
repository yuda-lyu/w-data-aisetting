# w-data-aisetting:自有ai全域技能與設定庫

本 repo 是**全電腦共用之 Claude 全域技能與全域設定的原稿**,不是一般專案.各電腦以 `sync.bat` 把原稿同步到使用者家目錄之 `~/.claude/`,Claude Code 再從那裡載入.

- GitHub:https://github.com/yuda-lyu/w-data-aisetting(公開,讀取免登入;branch **`master`**)
- 本機位置:`C:\opensrcPkg\w-data-aisetting`

## 重要:本 repo 沒有自己的 `CLAUDE.md`

全域設定之原稿檔名是 **`CLAUDE_global.md`**,同步時才改名為 `~/.claude/CLAUDE.md`.

刻意不叫 `CLAUDE.md` 的原因:Claude Code 會把工作目錄下之 `CLAUDE.md` 自動當成**該專案之指導原則**載入.若原稿也叫 `CLAUDE.md`,在本 repo 工作之 agent 會把「全電腦之全域設定稿件」誤當成「本 repo 之專案規範」去執行或修改.

因此:

- **在本 repo 工作之 agent**:`CLAUDE_global.md` 是要被編修之**稿件**,不是你要遵循之本專案規範;你遵循的仍是已同步到 `~/.claude/CLAUDE.md` 之全域設定與你被交辦之任務.
- **其他專案之 agent**:不要把本 repo 之任何檔案當成你專案之指導原則;你的專案規範在你專案自己的 `CLAUDE.md`.
- `CLAUDE_temp*.md` 為使用者之草稿/備份,不會被同步.

## 結構

| 路徑 | 用途 | 同步到 |
|---|---|---|
| `CLAUDE_global.md` | 全域設定原稿 | `~/.claude/CLAUDE.md`(改名) |
| `skills/` | 全域技能原稿(每個技能一個資料夾,含 `SKILL.md`)與其 `package.json` | `~/.claude/skills/`(其後 `npm i` 與 `npm update`) |
| `sync.bat` | 同步腳本(自 GitHub clone 本 repo 之 `master` → 複製技能與全域設定 → `npm i` → `npm update`) | — |
| `script.txt` | 原稿修改後推上 GitHub(`master`)之指令 | — |
| `.gitattributes` | `.bat` 以 CRLF 原樣入庫(cmd.exe 對 LF 批次檔之 `goto` 標籤不可靠;各機自 GitHub 下載 `sync.bat`) | — |
| `skillsOld/`、`skillsTemp/`、`CLAUDE_temp*.md`、`g_*.md` | 使用者之舊版、暫存、草稿與筆記 | 不同步 |

## 同步(各電腦)

自 GitHub 取得 `sync.bat`(https://raw.githubusercontent.com/yuda-lyu/w-data-aisetting/master/sync.bat 或 clone 本 repo)後執行:

1. 自 GitHub clone 本 repo 之 `master` 最新版到暫存資料夾;
2. 把 `skills\*` 複製到 `%USERPROFILE%\.claude\skills`(覆蓋同名,不刪除;已廢棄之技能資料夾須手動刪);
3. 把 `CLAUDE_global.md` 複製為 `%USERPROFILE%\.claude\CLAUDE.md`;
4. 於 `~/.claude/skills` 先刪本機 `package-lock.json`,再執行 `npm i`(補裝缺少者)與 `npm update`(把已安裝者升到 `package.json` 範圍內最新版;**只跑 `npm i` 時,已安裝且符合範圍之舊版不會升級**,2026-10-21 實測);
5. 刪除暫存資料夾.

同步後**新啟動之 agent** 才讀得到新版.

> **2026-10-21 起改用 GitHub**(原內網 Gitea `semi/aisetting` 停用):舊版 `sync.bat` 仍指向 Gitea,請先自 GitHub 取得新版 `sync.bat` 再執行.

## 修改與通報

- **不要直接修改 `~/.claude/skills` 或 `~/.claude/CLAUDE.md`**:那是同步產物,下次 `sync.bat` 會被原稿覆蓋.
- 發現全域技能或全域設定有誤、過時、不足,或需要新增技能:**與自有套件同一管道**,於內網 Gitea `http://100.120.70.67:3000/semi/opensrcOper` 開 issue,並依其 `通知方請用gitea.md` 之「AI設定庫」線寫標題(`建議全域技能{技能名}修正/調整:`、`建議新增全域技能{技能名}:`、`建議全域設定修正/調整:`).本 repo 在 GitHub,**不在 GitHub 開 issue**.
- 收件與修改由主控 agent(專案 `C:\opensrcOper`)負責:修改原稿後依 `script.txt` 推上 GitHub `master`,於 issue 回覆提交編號並提醒各電腦執行 `sync.bat`.
