# w-data-aisetting:自有ai全域技能與設定庫

Claude Code 之**全域技能與全域設定的原稿**.各電腦以 `sync.bat` 把原稿同步到使用者家目錄之 `~/.claude/`,Claude Code 再從那裡載入.

- GitHub:https://github.com/yuda-lyu/w-data-aisetting(公開,讀取免登入;branch **`master`**)

## 結構

| 路徑 | 內容 | 同步到 |
|---|---|---|
| `CLAUDE_global.md` | 全域設定原稿 | `~/.claude/CLAUDE.md`(改名) |
| `skills/` | 全域技能原稿(每個技能一個資料夾,含 `SKILL.md`)與其 `package.json` | `~/.claude/skills/`(其後 `npm i` 與 `npm update`) |
| `sync.bat` | 同步腳本 | — |
| `script.txt` | 原稿修改後推上 GitHub 之指令 | — |
| `.gitattributes` | `.bat` 以 CRLF 原樣入庫(cmd.exe 對 LF 批次檔之 `goto` 標籤不可靠) | — |
| `skillsOld/`、`skillsTemp/`、`CLAUDE_temp*.md`、`g_*.md` | 舊版、暫存、草稿與筆記 | 不同步 |

全域設定原稿刻意不叫 `CLAUDE.md`:Claude Code 會把工作目錄下之 `CLAUDE.md` 自動當成該專案之規範載入,在本 repo 工作時會把「全域設定稿件」誤當成「本 repo 之專案規範」.

## 同步(各電腦)

取得 `sync.bat`(https://raw.githubusercontent.com/yuda-lyu/w-data-aisetting/master/sync.bat 或 clone 本 repo)後執行:

1. 自 GitHub clone 本 repo 之 `master` 最新版到暫存資料夾;
2. 把 `skills\*` 複製到 `%USERPROFILE%\.claude\skills`(覆蓋同名,不刪除;已廢棄之技能資料夾須手動刪);
3. 把 `CLAUDE_global.md` 複製為 `%USERPROFILE%\.claude\CLAUDE.md`;
4. 於 `~/.claude/skills` 先刪本機 `package-lock.json`,再執行 `npm i`(補裝缺少者)與 `npm update`(把已安裝者升到 `package.json` 範圍內最新版);
5. 刪除暫存資料夾.

同步後**新啟動之 agent** 才讀得到新版.`~/.claude/skills` 與 `~/.claude/CLAUDE.md` 是同步產物,直接修改會在下次同步被覆蓋;需修改時依全域設定 §13.
