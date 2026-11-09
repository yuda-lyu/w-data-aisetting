# docx 驗證作法（不憑回傳值）

本檔為 SKILL 第 7 節之作法。所有指令以專案根為工作目錄。各報告類技能另有 md 層之核對（如手冊之節數、圖數、測試字樣），依各技能；本檔只管 docx 層。

## 1. 實體檔

- 存在、修改時間晚於本次產出之 md、大小合理（圖多之冊達數十 MB 屬正常）。
- 轉檔失敗時套件會刪除剛產出之 docx 再 reject，但舊檔可能仍在：以時間戳判定是否為本次產物。
- 經轉檔服務產製者，同樣只認本機寫出之檔：存在、時間戳晚於本次 md、大小合理，再依第 2 節核對 document.xml。用戶端回傳之 `docx.size` 是用戶端對自己寫出的檔取得之大小，恆與本機檔相符，不能當作服務端成功之佐證；回傳值可疑或連線異常時，先以服務端之 `GET /api/selftest` 確認 Word 可用，再重試或改本機轉檔。
- 轉檔無法在回傳值取得交叉引用警告：`reference(s) match no figure/table name` 只印在轉檔行程之標準輸出（經轉檔服務者印在服務端，用戶端看不到），故以第 2 節之 `{…}` 殘留檢查為準。

## 2. document.xml 之文字節點核對

Word 把一句話拆成多個 `<w:t>`，直接對原始 XML 找「圖1 」會漏；原始 XML 內之大括號多為圖片識別碼，直接掃會誤判殘留。先取出所有 `<w:t …>…</w:t>` 之內文串成一條字串，再計數：

```js
//chkDocx: node chkDocx.mjs <檔.docx> [圖數] [表數]
import { execFileSync } from 'child_process'
let [fp, nFig, nTab] = process.argv.slice(2)
let rd = (p) => execFileSync('unzip', ['-p', fp, p], { maxBuffer: 512 * 1024 * 1024 }).toString('utf8')
let xml = rd('word/document.xml')
let tOf = (s) => [...s.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g)].map((m) => m[1]).join('')
let txt = tOf(xml)
let paras = xml.split('</w:p>').map(tOf)   //圖題、表題是以「圖1 」「表1 」起首之段落, 內文裡的「圖2 」不算
let capNums = (lab) => paras.map((t) => (t.match(new RegExp(`^${lab}(\\d+) `)) || [])[1]).filter(Boolean).map(Number)
let figs = capNums('圖')
let cnt = (re) => (txt.match(re) || []).length
let out = {
    圖題: new Set(figs).size,   //啟用 toc 時圖目錄、表目錄會再列一次圖題表題, 故以不重複之編號計
    表題: new Set(capNums('表')).size,
    最後圖號: figs.length ? Math.max(...figs) : 0,
    圖引用: cnt(/如圖\d+所示/g),
    表引用: cnt(/如表\d+所示/g),
    大括號殘留: cnt(/\{[^}]*\}/g),
    大括號內容前5: (txt.match(/\{[^}]*\}/g) || []).slice(0, 5),   //程式碼區塊、數學式內之大括號也會計入, 逐筆看是否為 {圖表名稱} 形狀
    drawing: (xml.match(/<w:drawing>/g) || []).length,
    TOC欄位: (xml.match(/TOC \\/g) || []).length,
    SEQ欄位: (xml.match(/SEQ /g) || []).length,
    不壓縮圖片旗標: /doNotAutoCompressPictures/.test(rd('word/settings.xml')),
    媒體數: execFileSync('unzip', ['-Z1', fp]).toString('utf8').split(/\r?\n/).filter((v) => v.startsWith('word/media/')).length,
}
console.log(out)
if (nFig && out.圖題 !== +nFig) console.log(`圖題數 ${out.圖題} ≠ 圖數 ${nFig}`)
if (nTab && out.表題 !== +nTab) console.log(`表題數 ${out.表題} ≠ 表數 ${nTab}`)
```

判準：

| 項 | 應 |
|---|---|
| 圖題 | ＝md 之圖數（以不重複之編號計：啟用 `toc` 時圖目錄會再列一次全部圖題，直接計數會成兩倍） |
| 表題 | ＝md 之表數（同上） |
| 最後圖號 | ＝圖數（編號連續之簡易檢查） |
| 圖引用、表引用 | 與 md 之引用數一致（引用句型依專案；不用「如…所示」者改正則） |
| 大括號殘留 | 0；md 含程式碼區塊或數學式者，其內之大括號會計入，逐筆看 `大括號內容前5`，非 `{圖表名稱}` 形狀者不算殘留 |
| drawing | ＝圖數 |
| TOC、SEQ 欄位 | 啟用 `toc` 者：TOC 欄位存在，SEQ 數＝圖表題數；未啟用 `toc` 者無這兩種欄位屬正常 |
| 不壓縮圖片旗標 | true |
| 媒體數 | PNG、JPG 之圖：≤ 圖數；少於圖數屬轉檔器對相同圖檔去重（同一張圖被兩處引用、或連續相同之兩張圖），回報時說明。SVG 之圖每張內嵌 svg 與 png 預覽兩份媒體，含 SVG 者媒體數可大於圖數，扣除預覽後再比 |

圖題、表題之字樣（「圖1 」帶半形空格）依轉檔套件之圖題判定；專案若有測試字樣等禁字（如手冊不得出現 `e2e`），在同一串接文字上加掃。

## 3. 樣式與業主字樣

依 [範本衛生](template-hygiene.md) 第 2 節之腳本對產出 docx 跑，並依 SKILL 第 4 節的三條判準分開回報：

- 範本之自訂樣式只剩專案前綴者，且範本樣式名稱在產出中未被 Word 更名（`cmpStyles` 判準一與更名檢查，對範本與產出跑）；
- 產出 docx 之全部樣式名稱與全部部件之他案業主字樣為 0；本案委託單位名稱只見於正文與封面（`scanOwner`，含 `[Content_Types].xml`，字樣放法見範本衛生第 2 節）；
- 轉檔時由 HTML 帶入之樣式（名稱為 CSS 類別）另列計數，不算範本問題（`cmpStyles` 判準三）。

範本未變動時可只抽一份；範本或轉檔套件變動後每份都跑。

## 4. 版面

- 首欄不換行等欄寬設定：抽表格首欄之段落或儲存格屬性確認 nowrap 類設定存在，或人工開檔抽查一節。
- 版面有疑義者以 Word 實排轉圖目視（skill[role-operator-docx] 之截圖會短暫啟動 Word，截圖期間不得同時轉檔）。
- **同一表內字級一致**：同一張表內有文字之 run，字級（`w:sz`）只應有 1 種。成因：Word 匯入 html 時，行內 `<code>` 不繼承所在儲存格之字級，其 run 無 `w:sz` 而沿用文件預設字級，與同表帶 `w:sz` 之文字並存；固定行高（`mso-line-height-rule:exactly`）之表格，較大之字會被裁切（底線被截；w-md2html README 之說明，非本技能實測）。第 2 節之文字節點核對與上列欄寬抽查都涵蓋不到，以技能內之腳本逐份掃：

  ```
  node <技能根>/role-writer-report-convert-to-docx/scripts/chkTableRunSizes.mjs <檔.docx>…
  ```

  `<技能根>` 為本技能目錄之上一層（其 `node_modules` 內之 w-zip 只讀 `word/document.xml`，不解壓整包，不需外部 `unzip`；一般為 `~/.claude/skills`）；`--self-test` 驗證腳本本身。腳本逐表收集有文字之 run 之字級（無 `w:sz` 者記為「預設」，即沿用段落樣式或文件之字級），同一表出現 2 種以上即列出該表、各字級之 run 數與 1 個例字，輸出如：

  ```
  <檔.docx>: 表 4 張, 字級不一 3 張
    表1: 9pt×9(例:系統)、預設×3(例:unit01)
  ```

  判讀與處置：
  - 不一時先查 md 端之 w-md2html 版本（`node_modules/w-md2html/package.json`）：低於 1.1.22 者，表格與標題內之行內程式碼不隨所在元素之字級，升版後重轉（升版依自有套件之管道，專案端不繞道）。
  - 已是 1.1.22 以上仍列出者，多為手寫 html 表格：儲存格之字級以手寫 `style` 設定（而非 `data-for="tab"` 之標記）時，其內 `<code>` 採 w-md2html 之表格字級選項（`fontSizeTab`，預設 11pt），與儲存格之字級（如 9pt）不同即被列出；改以標記設儲存格字級（[md 端語法](md-syntax.md) 第 3 節），或於 `<code>` 自帶儲存格之字級。
  - 「預設」與明訂值實際相同（段落樣式即為該字級）者屬誤報；表頭與內文刻意不同字級者亦會列出，屬預期；開檔目視確認。巢狀表格以最外層表為單位，內層表之 run 一併計入。

## 5. 殘留行程

產後列出 WINWORD 行程（Windows：`tasklist //FI "IMAGENAME eq WINWORD.EXE"`）應為空。有者先等數十秒再查（截圖所啟會自行結束），並確認不是裁定者自己開的 Word；確為轉檔殘留才結束並記錄。

## 6. 回報

逐份列出：路徑、大小、產出時間、第 2 節之數字與判定、媒體去重之說明、樣式與業主字樣之結果（三條判準各一行，HTML 帶入者附計數）、字級不一之表數（第 4 節；0，或列出各表與處置）、未做之項目與原因。
