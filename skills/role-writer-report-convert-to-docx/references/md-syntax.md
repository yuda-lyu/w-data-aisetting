# md 端語法（以 w-md2docx 轉檔時）

下列語法僅於以該轉檔套件產製時適用；不用該套件者，圖表編號與交叉引用依專案之產製方式（無者以 md 手編並於回報註明）。報告正文不寫轉檔套件之名稱。

語法由 md→html 階段處理（轉檔套件所依賴之 `w-md2html`）：圖題與引用之規則載於其 README〈Figure and Table Numbering〉；`data-for` 標記載於其規則帳本（`sgud/rule/rulebook.md` R-SYNTAX-01）與原始碼（`src/md2html.mjs` 之 DOM 後處理），轉檔套件本身之說明僅在圖高預留處提到 `data-for="br"`。專案內可用自己之小型 md 轉檔並解開 docx 核對一次，確認已安裝版本（`node_modules/w-md2html/package.json`）之行為相同。

## 1. 範例

```html
<div style="padding:2rem 0; text-align:center;">
    <img style="width:100%; max-width:700px;" src="pics/申請流程圖.png" />
    <div style="padding-top:0.5rem;">圖n 申請流程圖</div>
</div>

<div style="text-align:center;" data-for="br"></div>   <!-- 連續多圖之間 -->

<div style="margin:1rem 0; text-align:center; page-break-after:avoid;">表n 構面要點表</div>
<div data-for="tab" data-style-th-0="white-space:nowrap;" data-style-td-0="white-space:nowrap; text-align:center;"></div>

| 欄一 | 欄二 | 欄三 |
|---|---|---|

<div style="margin:1rem 0;" data-for="br"></div>       <!-- 表下留白 -->
```

## 2. 自動編號與交叉引用

- 作者在 md 內寫字面之 `圖n 名稱`、`表n 名稱`（`n` 即字母 n，不寫成 `圖1`），轉換時依序換成圖 1、表 1；內文以 `{名稱}` 引用，名稱須完全一致。
- **對不上者只印一行警告（`warning: N reference(s) match no figure/table name: {名稱}`）而不中斷，`{名稱}` 字面會留在輸出**，須自行檢查警告。警告只印在轉檔行程之標準輸出，不在回傳值內（經轉檔服務者印在服務端，用戶端看不到），故轉檔後仍須以 docx 內 `{…}` 殘留檢查（SKILL 第 7 節）補強。圖題若寫成 `圖1 …`，引用即全部未解析。
- 編號以名稱為鍵：名稱重複或含 `{`、`}` 皆會誤引，產 md 之程式應在重名時拋錯。正文要說明 `{n}` 這類語法時用行內程式碼（反引號）包住，否則會多一行警告。
- **docx 端之圖題判定**為「圖1 名稱」形式（標號後空一格）；「圖1：名稱」不算圖題（列於 `warns`）；使用目錄（`toc`）時編號須由 1 依序，否則轉檔失敗。
- 圖題在圖下、表題在表上；圖表名稱之用字（末字、長度、可否含英數代號）依各報告類技能與專案裁定。

## 3. 標記

- **`data-for="br"`**：空段落，撐開垂直留白。轉檔會丟掉 md 之純空段落，需要空行處（封面之上下留白、圖與圖之間）一律用此標記。
- **`data-for="tab"`**：把 `data-style-th`、`data-style-td`（整表之 th、td 行內樣式）與 `data-style-th-N`、`data-style-td-N`（N 為由 0 起算之欄索引，內容為任意行內樣式字串；逐欄樣式於整表樣式之後套用，可追加或覆寫）追加到其後第一張表格；多個標記會疊加，故**同一表格前只放 1 個**；標記須與表格同層，找不到表格時標記被靜默移除。
- 原始 `<img>` 之寫法依已安裝之 w-md2html 版本，以其 README〈Upgrade Notes〉為準：〈Breaking changes after 1.1.12〉所述之版本，同一行可有任意多個 `<img>`，`src` 可為雙引號、單引號或無引號；更早版本，同一行寫兩個以上 `<img src>` 會拋錯（`size(s)!==2`），且只處理雙引號之 `src`，須分行並用雙引號。

## 4. 留白與表格

- **留白**：圖外框用 padding，垂直留白以 `data-for="br"` 撐開（經驗作法；套件原始碼註解載明的是區塊表格之 `margin:auto` 無法帶入 docx，並未說所有 margin 皆無效）。
- **短欄不折行**（經驗，版式參數）：5 字以內一律不換行，6～10 字酌情，不換行欄加總不超過內文寬（A4 直式約 37 字）；超過時 Word 仍會壓縮欄寬，依序減少不換行之欄、縮小字級與邊距、長表頭以 `<br>` 斷為 2 行。
- **表格格內換行**用 `<br>`（經驗）。
- 幾欄以上才用表格、兩欄是否改條列，屬報告文體，依各報告類技能與專案裁定。

## 5. 圖片

- 路徑以 md 所在資料夾解析；圖檔不存在即 reject。md 圖語法之路徑含空白時用角括號：`![說明](<圖 資料夾/a.png>)`，否則整段被當成文字。
- 報告內之圖以固定最大寬度顯示，窄圖會被放大；最小圖寬之墊寬作法屬產圖，依各報告類技能（例：role-writer-report-final〈產圖規範〉）。
- 過寬之圖之畫質靠範本之 `doNotAutoCompressPictures`（SKILL 第 4 節）。
- 同一張圖檔被多處引用時，docx 內嵌媒體數少於圖數（轉檔器去重），版面不受影響，驗證時說明；SVG 之圖則每張內嵌 svg 與 png 預覽兩份，媒體數可大於圖數（SKILL 第 7 節）。
- md 內含數學式或程式碼區塊時，產出 docx 會多出名稱為 CSS 類別之樣式（如 `mord`、`hljs-keyword`），屬 HTML 帶入之樣式，另列計數、不算範本問題（SKILL 第 4 節判準三）。
