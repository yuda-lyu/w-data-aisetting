# 回饋(任務中發現之自有套件、全域技能、全域設定之調整與抽提提案)

只增不改;處置結果另記一列。一條一列:日期、類別、對象、內容、依據。公開庫:不寫金鑰、內網位址、帳號與使用端專案之名稱與案情。

| 日期 | 類別 | 對象 | 內容 | 依據 |
|---|---|---|---|---|
| 2026-11-09 | 全域技能 | role-writer-report-convert-to-docx | `references/verification.md` 第 2 節 `chkDocx` 與 `references/template-hygiene.md` 第 2 節之 `listStyles`、`usedStyles`、`cmpStyles`、`scanOwner` 仍以外部 `unzip` 讀 docx 部件;Windows 不一定有,`template-hygiene.md` 僅註「無者改用專案既有之 zip 套件」,且須處理 `[Content_Types].xml` 之 `[` 改寫。建議改為以技能根 w-zip(`mZip.listEntries`、`mZip.readEntry`,以完整檔名讀取,無萬用字元問題)讀部件,與本次新增之 `scripts/chkTableRunSizes.mjs` 一致,並可抽成共用輔助 | `skills/role-writer-report-convert-to-docx/references/verification.md:20,40`;`references/template-hygiene.md:3,18,40,49,75,150,159`;`scripts/chkTableRunSizes.mjs` |
| 2026-11-09 | 全域技能 | role-writer-report-convert-to-docx | `SKILL.md` 第 7 節第 6 點(版面)、第 10 節完成前勾選、第 1 節〈依任務找章節〉未提及新增之「同一表內字級一致」檢查與 `scripts/` 目錄(本輪限定只改 `verification.md` 與 `md-syntax.md`,未同步);建議同步,並避免 `description` 增長 | `skills/role-writer-report-convert-to-docx/SKILL.md:19-27,138,176-181` |
| 2026-11-09 | 自有套件 | w-md2html | 無標記之 html 表格,儲存格以手寫 `style` 設字級時,其內 `<code>` 於 docx 採 `fontSizeTab`(預設 11pt)而非儲存格字級(實測儲存格 9pt、程式碼 11pt,以 `chkTableRunSizes.mjs` 列出);README 之「例外」只寫「於瀏覽器」。建議:`<code>` 亦繼承所在 th／td 之 inline `font-size`(不限標記表),或 README 之例外註明 docx 亦然 | w-md2html `README.md` 〈Upgrade Notes〉Behavior change after 1.1.21 之「例外」;`src/md2html.mjs:832-845`(僅處理 `data-for="tab"` 標記表);w-html2docx 1.0.49 轉出之 docx,程式碼 run `w:sz` 為 22 對儲存格 18 |
| 2026-11-09 | 自有套件 | w-md2html | README〈Table Markup〉`data-merge-v` 列「後列之欄只在前列各欄之同一合併區塊內才合併」之「列」與表格之列(row)同字,易誤讀;建議改為「後面列出之欄」,並與同節「區塊」用詞一致 | w-md2html `README.md` 〈Table Markup〉`data-merge-v` 列 |
| 2026-11-09 | 全域設定 | 技能根 `node_modules` 之更新 | 本機技能根實裝版本落後 `skills/package.json`(`wsemi` 1.9.25 < `^1.9.52`、`w-zip` 1.0.48 < `^1.0.57`);本次腳本只用 `mZip.readEntry`,1.0.48 與 1.0.58 皆有,不受影響,但他技能若依賴新版功能會在各機行為不一;建議 `sync.bat` 或同步說明提醒各機於技能根 `npm i` | `skills/node_modules/wsemi/package.json`、`skills/node_modules/w-zip/package.json` 之 `version`;`skills/package.json:15-16` |
