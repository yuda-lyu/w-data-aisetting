# w-data-aisetting

自有AI全域技能與設定庫. 針對 Claude Code 之**全域技能與全域設定的原稿**進行備份同步. 各執行端電腦將以 `sync.bat` 把原稿同步到使用者家目錄之 `~/.claude/`, Claude Code 再從那裡載入.

- GitHub:https://github.com/yuda-lyu/w-data-aisetting(公開,讀取免登入;branch **`master`**)

## 結構

| 路徑 | 內容 | 同步到 |
|---|---|---|
| `CLAUDE_global.md` | 全域設定原稿 | `~/.claude/CLAUDE.md`(改名) |
| `skills/` | 全域技能原稿(每個技能一個資料夾,含 `SKILL.md`)與其 `package.json` | `~/.claude/skills/`(其後 `npm i` 與 `npm update`) |
| `hooks/` | `settings_global.json` 之 hook 所執行之腳本:`transcript-size-warn.mjs`(對話紀錄達 800 MB 提醒一次、達 1,500 MB 每則提醒;背景工作通知不算) | `~/.claude/hooks/` |
| `settings_global.json` | 全域 Claude Code 設定原稿(權限、沙箱、模型設定、hook 等);hook 指令之路徑寫成 `{{HOME}}/.claude/hooks/<檔>`,**不寫死使用者**;不得放金鑰(公開庫) | `~/.claude/settings.json`(整份取代;`{{HOME}}` 由 `tools/install-settings.mjs` 填入該台之使用者目錄,原檔備份為 `settings.json.bak`) |
| `tools/report-skill-deps.mjs` | 列出技能根之自有套件已安裝版與 registry 最新版(`node tools/report-skill-deps.mjs <技能根> [--registry <網址>]`;只報告) | 不同步(由 `sync.bat` 執行) |
| `tools/install-settings.mjs` | 安裝 hook 腳本並以 `settings_global.json` 產生 `settings.json`(`--dry` 預覽);測試 `tools/test-install-settings.mjs` | 不同步(由 `sync.bat` 自暫存 clone 執行) |
| `sync.bat` | 同步腳本 | — |
| `supd.bat` | 更新本機之 AI CLI:`claude update`、`codex update`、`agy update`、`npm install -g opencode-ai@latest`(各步失敗不中斷,末尾列出失敗者) | — |
| `script.txt` | 原稿修改後推上 GitHub 之指令 | — |
| `tools/check-skills.mjs` | 原稿自檢:技能 frontmatter、連結與 `skill[名]` 引用、`sync.bat` 編碼與換行、`settings_global.json`(合法 JSON、不寫死使用者路徑、只用 `{{HOME}}`、引用之 hook 存在)、公開庫衛生(`node tools/check-skills.mjs`,有錯誤離開碼 1) | 不同步 |
| `.gitattributes` | `.bat` 以 CRLF 原樣入庫(cmd.exe 對 LF 批次檔之 `goto` 標籤不可靠) | — |
| `skillsOld/`、`skillsTemp/`、`CLAUDE_temp*.md`、`g_*.md` | 舊版、暫存、草稿與筆記 | 不同步 |

全域設定原稿刻意不叫 `CLAUDE.md`:Claude Code 會把工作目錄下之 `CLAUDE.md` 自動當成該專案之規範載入, 在本 repo 工作時會把「全域設定稿件」誤當成「本 repo 之專案規範」.

## 同步(各電腦)

取得 `sync.bat`(https://raw.githubusercontent.com/yuda-lyu/w-data-aisetting/master/sync.bat 或 clone 本 repo)後執行:

1. 自 GitHub clone 本 repo 之 `master` 最新版到暫存資料夾;
2. 把 `skills\*` 複製到 `%USERPROFILE%\.claude\skills`(覆蓋同名,不刪除;已廢棄之技能資料夾須手動刪);
3. 把 `CLAUDE_global.md` 複製為 `%USERPROFILE%\.claude\CLAUDE.md`;
4. 執行 `tools\install-settings.mjs`:把 `hooks\*.mjs` 複製到 `%USERPROFILE%\.claude\hooks`,並以 `settings_global.json` 產生 `%USERPROFILE%\.claude\settings.json`——**整份取代**(各台以 `/config` 等於本機改過之設定會被蓋回;原檔備份為 `settings.json.bak`),其中 `{{HOME}}` 填入該台之使用者目錄(如 `C:/Users/<使用者>`),故各台使用者名稱不同亦可直接同步;範本非合法 JSON 或有未知佔位字時中止且不寫入;
5. 於 `~/.claude/skills` 先刪本機 `package-lock.json`, 再執行 `npm i`(補裝缺少者)與 `npm update`(把已安裝者升到 `package.json` 範圍內最新版)——**registry 用 `sync.bat` 之 `NPM_REG`(內網 Verdaccio)**:技能依賴之自有套件(`wsemi`、`w-*`)先發布至 Verdaccio,npmjs 可能落後;先 `npm ping`,連得到即以 `--registry` 安裝,連不到(如不在內網)退回 npm 預設 registry 並警告(仍完成同步,自有套件可能較舊).裝完以 `tools/report-skill-deps.mjs` 列出各自有套件之已安裝版與最新版,落後者標 `STALE`;
6. 刪除暫存資料夾.

hook 門檻可於各機以 `~/.claude/hooks/transcript-size-warn.json`(`{ "warnMB": 800, "alertMB": 1500 }`)調整,此檔不由同步覆蓋.

同步後**新啟動之 agent** 才讀得到新版.`~/.claude/skills`、`~/.claude/CLAUDE.md`、`~/.claude/hooks/` 之腳本與 `~/.claude/settings.json` 是同步產物, 直接修改會在下次同步被覆蓋; 需修改時改本 repo 之原稿(依全域設定 §13).

## 更新 AI CLI(各電腦)

取得 `supd.bat`(https://raw.githubusercontent.com/yuda-lyu/w-data-aisetting/master/supd.bat 或 clone 本 repo)後執行,依序更新 Claude Code(`claude update`)、Codex(`codex update`)、Antigravity(`agy update`)與 OpenCode(`npm install -g --allow-scripts=opencode-ai opencode-ai@latest`).各步失敗不中斷,結束時列出失敗者.首次安裝之指令寫在檔內註解.**更新前先確認本機沒有正在跑之派工 agent**(更新中之 CLI 被替換可能使進行中之派工失敗).
