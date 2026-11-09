---
name: role-writer-report-convert-to-docx
description: |
  以 w-md2docx（Windows 加 Microsoft Word，或連線其轉檔服務）把產線產出之 md 報告轉為 docx 之方法技能：md 端為轉檔所寫之語法（圖表自動編號與交叉引用、data-for 標記、留白、欄寬、空段落標記）、轉檔呼叫與選項（範本、keepCaption、toc 與其目錄樣式名稱須明確指定、開 toc 須用自備範本）、遠端轉檔服務、範本衛生（範本用專案自己的；不帶業主或他案業主之樣式與資訊；產線樣式改專案前綴之中性名稱且不與 Word 內建樣式之本地化名稱同名；清理步驟與改後三條判準）、執行紀律（Word 單一實例故一次轉一份、審稿者開著 docx 時不重產、殘留行程判定、舊版 .vbs 遭防毒隔離）、驗證（以實體檔與 document.xml 之文字節點核對，不憑回傳值）、產物管理、陷阱表與完成前勾選。
  觸發條件：要把 md 報告、手冊、審圖報告等轉為 docx；建立、修改、替換或清理 docx 範本；撰寫或修改轉檔程式（genDocx 類）；升級 w-md2docx；驗證產出之 docx；docx 之目錄、圖表編號、樣式名稱、圖片畫質有問題時——必先調用本技能，整篇入 context 逐項比對後才動工。
  不適用：報告內容之撰寫（依 role-writer-report-final、role-writer-report-e2e-to-manual、role-writer-report）；讀取、檢查與直接修改既有 docx 而非經 md 轉檔者（依 role-operator-docx）。
---

# md 報告轉 docx 規範

**定位**：報告之 md 由各報告類技能之產線產出，本技能只管「md → docx」這一段：md 端為轉檔所寫之語法、轉檔呼叫、範本、執行紀律、驗證與產物管理。專案已有轉檔模組與範本者沿用，不自造；專案未安裝轉檔套件、無範本，或既無 Word 也無可連線之轉檔服務者，不自行加裝，先問裁定者，或改依 skill[role-operator-docx] 另建 docx。

**版本前提**：本技能所述選項、預設值與檔案位置依 w-md2docx 1.0.29；專案安裝版本以 `node_modules/w-md2docx/package.json` 為準，版本不同時以該版套件說明（README、`docs`）為準，並把差異記入專案要點。

**名詞**：「轉檔套件」指 w-md2docx（其 md→html 階段為 w-md2html，docx 寫出階段為 w-html2docx，各依套件說明）；「轉檔服務」指轉檔套件之 `rmApiServer`，其用戶端為 `rmApiClient`；「範本」指轉檔時 `fpInTemp` 所指之 docx；「產線樣式」指轉檔時寫進產出 docx 之自訂樣式（目錄標題、章節標題等）；「專案前綴」指專案為自家樣式訂定之樣式名稱或 styleId 前綴（本技能以 `<前綴>` 表示），讓人一眼認出是產線所用；「裁定者」指向 agent 下指示、審稿與裁定之人；「業主字樣」指他案委託單位之名稱、簡稱與其樣式前綴（本案委託單位之名稱只應出現在正文與封面，不應出現在範本、樣式名稱與文件屬性）。

## 1. 依任務找章節

| 任務 | 讀 |
|---|---|
| 寫 md 之圖、表、交叉引用、留白、欄寬 | [md 端語法](references/md-syntax.md) |
| 寫或改轉檔程式、選項 | 第 5 節 |
| 無 Word 之機器要轉檔，或架轉檔服務 | 第 5 節〈遠端轉檔服務〉 |
| 建立、替換、清理範本；換範本或升級轉檔套件後之檢查 | 第 4 節與 [範本衛生](references/template-hygiene.md) |
| 跑轉檔（單份、多份、圖多之冊） | 第 6 節 |
| 驗證產出之 docx | 第 7 節與 [驗證作法](references/verification.md)；表內字級之檢查腳本在 `scripts/` |
| 報告改名、改版次、交審順序 | 第 8 節 |

## 2. 與其他技能之分工

| 技能 | 分工 |
|---|---|
| skill[role-writer-report-final] | 成果類報告之內容與 md 產線（圖清單、產文、內建檢查）；轉檔一段依本技能 |
| skill[role-writer-report-e2e-to-manual] | 操作手冊之內容、parseSpec、genMd 檢核與手冊專屬之 md 層與 docx 層判準（表題數＝節數等）；genDocx 與 docx 層核對之通用作法依本技能 |
| skill[role-coder-for-test-e2e] | 審圖報告（圖文對照之 md→docx，非交付）之內容；轉檔與核對依本技能 |
| skill[role-writer-report] | 服務建議書之內容；若以 md 產線轉 docx，轉檔一段依本技能 |
| skill[role-operator-docx] | 讀取、檢查、直接修改 docx（含範本清理所用之 officecli） |
| skill[role-writer-validate] | 報告內容之檢測與完成判準；本技能只驗轉檔產物 |

## 3. 動工前盤查（缺一不可）

1. 讀專案之報告產製要點：轉檔模組（共用者只有一份）、範本路徑、各報告之轉檔入口、已裁定之版式。
2. 環境：轉檔在 Windows 且已安裝 Word 之機器上進行，或經轉檔服務（第 5 節）；轉檔套件已安裝，版本依本技能開頭之版本前提。啟用 `toc` 時套件內部以 Windows PowerShell 5.1 經 COM 驅動 Word（腳本以 `-EncodedCommand` 帶於命令列、不落地）；全域設定要求避免 PowerShell，故首次啟用前先徵詢裁定者。首次轉檔須自網路取得轉檔所需之執行檔（依套件說明）。
3. 範本：是專案自己的，且已通過第 4 節之檢查；未檢查過者先檢查再轉。**要開 `toc` 者須用自備範本**（第 5 節）。
4. Word 狀態：目標 docx 未被開啟（同資料夾無 `~$` 開頭之鎖定檔），無轉檔外之 WINWORD 行程。有則停下告知裁定者，不強制結束（可能是裁定者正在審閱）。
5. 審稿狀態：md 是否已審定；裁定者是否交代過「只更新 md、docx 待指示再產」。

## 4. 範本衛生

**原則**：

1. **範本用專案自己的，不混用他案範本**。自他案範本改來者，樣式名稱、表格樣式之別名、頁首頁尾欄位之暫存值、文件屬性（作者、公司、附加範本路徑）、自訂 XML 都會帶入他案之業主字樣。委託單位於 Word 之樣式清單看到他案業主之樣式名稱，即會誤解為抄用他案文件，即使正文一處也沒用到。
2. **「產線不用範本之樣式」不能憑印象，要以產出 docx 實查**。典型錯誤形狀：以為產線已不用範本樣式，實查發現 `toc` 之目錄標題樣式取自套件預設，範本唯一之本文段落也套著他案樣式。
3. **產線樣式改為專案前綴之中性名稱，並於轉檔呼叫明確指定**（第 5 節之 `titleStyle`、`headStyles`）。名稱須同時滿足三點：帶專案前綴；不含業主字樣；**不得與 Word 內建樣式之本地化名稱同名**。繁體中文版 Word 會把與內建樣式之本地化名稱相同的自訂樣式更名：實測案例為「目錄標題」（內建樣式 TOC Heading 之本地化名稱），自訂樣式取此名經 Word 轉檔後被改成「目錄標題1」，範本自有之樣式因而不被沿用，轉檔套件另建者在另存時亦被改成「目錄標題2」。上游只實測這一例，並據以規定樣式名稱一律不得為內建樣式之本地化名稱，本技能從之。styles.xml 內看不出衝突，只有經 Word 轉檔後才見，故**更動樣式名稱後，以真 Word 轉一份，比對範本與產出之全部樣式名稱（`cmpStyles` 之更名檢查；範本有而產出無者即被更名）**；加專案前綴即可避開。不依賴套件之預設名稱——預設值會隨套件版本改變（1.0.29 前後即不同），指定後才不受影響。
4. **只留 Word 核心預設與產線、轉檔會用到之內建樣式**，其餘自訂樣式與無關之內建樣式刪除；刪除時同步修正引用（編號定義之 `pStyle`、樣式之 `link`、`next`、`basedOn`，表格樣式之 `aliases`），範本內之段落改套 Normal。
5. **範本必須帶 `<w:doNotAutoCompressPictures/>`**（`word/settings.xml`），否則 Word 會把過寬之圖降採樣存成低畫質；套件內附之 `temp.docx` 與 w-html2docx 之內建範本皆已含，自備或清理過之範本須確認仍在，不以未帶此旗標之範本替換。
6. **清理後之範本不含任何業主資訊**，可直接供其他專案使用；專案名、委託單位等只出現在 md 產出之正文與封面。

**換範本、清理範本或升級轉檔套件後之檢查**（作法見 [範本衛生](references/template-hygiene.md)）。判準分三條，各管一件事，不可混為一條：

1. **範本帶入者（以範本之 styles.xml 檢查）**：自訂樣式只剩專案前綴者（styleId 或名稱帶前綴皆可）。Word 為內建樣式自動配對之連結字元樣式（如「標題 1 字元」）不計；其餘不帶前綴者逐個判讀，無業主字樣且為產線所用者可保留並登記於專案要點，其餘刪除。範本之樣式名稱經 Word 轉檔後皆仍在（未被更名），實際被引用之樣式皆存在且為預期者。
2. **產出 docx（全面）**：全部樣式名稱與全部部件（styles、numbering、document、頁首頁尾、docProps、customXml、`[Content_Types].xml` 等）之業主字樣為 0；本案委託單位之名稱只見於正文與封面。範本本身則本案與他案之委託單位字樣皆為 0。
3. **轉檔時由 HTML 帶入者**：名稱為 CSS 類別之樣式（如 `msonormal`、`katex*`、`hljs-*`）另列計數，**不算範本問題**，也不要為此去刪範本。轉檔套件是否應避免把這類樣式帶入產出，屬套件之行為，專案端不繞道，需要時依全域設定之自有套件通報管道提出。

另：以改前之範本與改後之範本各轉同一份 md，頁數、正文文字雜湊相同，目錄與各級標題所套之樣式為預期之產線樣式；`officecli validate` 通過；`doNotAutoCompressPictures` 仍在。

## 5. 轉檔呼叫

```js
import WMd2docx from 'w-md2docx/src/WMd2docx.mjs'   // 套件說明之範例以 src 入口匯入
let r = await WMd2docx.cvMdToDocx('./report/報告.md', './report/報告.docx', {
    fpInTemp: '<專案之範本>.docx', // 建議絕對路徑；範本須含 doNotAutoCompressPictures；開 toc 者必給
    keepCaption: true,             // 圖名表名與其圖表同頁
    toc: {                         // 章節、圖、表目錄並重編頁碼；是否開啟依專案版式
        titleStyle: '<前綴>目錄標題',                                  // 明確指定，不依賴套件預設
        headStyles: ['<前綴>章標題', '<前綴>節標題', '<前綴>小節標題'],
    },
    // optHtml2docx: { imgHeightReserveLines: 4 }, // 預設 4，大圖下方預留間隔段與圖名
})
// r 恆有 fpOutDocx、sizeDocx、sizeHtml、ms；啟用 keepCaption、toc 時另有同名欄位；fpOutHtml 只在 opt.fpOutHtml 時有
// r.toc.warns 與 r.keepCaption.warns 須檢查（如圖題寫成「圖1：名稱」即不算圖題，列於警告）
```

- **共用一個轉檔模組**：專案內各報告之轉檔程式都經同一個模組呼叫，範本路徑與 `toc` 之樣式名稱只寫在該模組；各報告傳 `toc: true` 時由模組補上專案之樣式名稱，傳物件時與其合併。
- **`toc` 之樣式名稱與預設**：`titleStyle` 預設為「報告目錄標題」（目錄、圖目錄、表目錄之三個標題用），`headStyles` 預設為 `['章標題','節標題','小節標題']`，皆為中性名稱，但仍依第 4 節第 3 點明確指定。範本沒有該名稱之樣式時，套件另建（`titleStyle` 為置中粗體，`headStyles` 為粗體）；`headStyles` 所指之既有樣式若自身未設粗體（只看該樣式自身，不含 `basedOn` 之繼承）則拋錯。舊版之預設為舊內附範本之目錄標題樣式，名稱帶他案業主前綴；自舊內附範本衍生之專案範本若未指定 `titleStyle`，升到 1.0.29 後目錄標題會改用新建之「報告目錄標題」（置中粗體 16pt），不再沿用舊樣式，無舊名相容。
- **內附範本**：`src/templates/temp.docx`（A4、行格線、樣式名稱中性、報告用樣式之 styleId 前綴為 `Rpt`、文件屬性與附加範本連結皆空、已含 `doNotAutoCompressPictures`），為套件說明之範例所用，也是轉檔服務之預設範本；舊版內附之範本含他案業主前綴之樣式，已移除。直接用 `temp.docx` 作專案範本可以（不帶業主資訊）：其另有 Word 生成之中性自訂樣式（如「表格格線1」「無清單1」，styleId 不帶 `Rpt`），依第 4 節判準一逐個判讀並登記即可；要改為專案前綴者，自其衍生（保留排版，樣式改專案前綴）。
- **開 `toc` 須用自備範本**：未給 `fpInTemp`（用 w-html2docx 內建範本）時，`toc: true` 於真 Word 被拒（`TOC check failed (1): the cover section should have no footer`；內建範本含頁首頁尾，上游已知限制、尚未修）。真 Word 下開目錄的範本用 `temp.docx` 或其衍生。
- **`toc` 之其他選項**（`labels`、`titles`、`replaceTocStyles` 等）與其預設值依已安裝版本之套件說明，不憑記憶。
- **工作目錄與範本**：相對路徑與預設範本皆依工作目錄解析；未給 `fpInTemp` 時於工作目錄之 `./src/tmp.docx` 或 `./node_modules/w-html2docx/src/tmp.docx` 找內建範本，找不到即失敗。以專案根為工作目錄或給絕對路徑。
- **圖片**：不存在即 reject（一次列出全部缺圖之絕對路徑）；路徑以 md 所在資料夾解析；Word 解析不到之圖（如網址取不到）於後段 reject。
- **失敗時不留檔**：`toc` 或 `keepCaption` 失敗時轉檔會刪除剛產出之 docx 再 reject；不以「檔案存在」判斷成敗。

### 遠端轉檔服務（無 Word 之機器）

轉檔服務跑在「Windows 加 Word」之機器上；其他機器以用戶端送 md 與其引用之圖，取回 docx 寫到本機。範本衛生（第 4 節）、md 語法與驗證（第 7 節）與本機轉檔相同。

```js
import WMd2docx from 'w-md2docx/src/WMd2docx.mjs'
// 服務端（Windows 加 Word）
let { server, stop } = await WMd2docx.rmApiServer({ port: 22000, token: '<權杖>' })
// 用戶端（任何機器）
let r = await WMd2docx.rmApiClient.cvMdTo({
    host: '<服務主機>', port: 22000, token: '<權杖>',
    fpInMd: './report/報告.md', fpOutDocx: './report/報告.docx',
    fpInTemp: '<專案之範本>.docx', // 以 base64 夾帶至服務端；或改給 templateName 指定服務端模板（服務端預設 temp.docx）
    keepCaption: true, toc: { titleStyle: '<前綴>目錄標題' },
})
// r 有 ms、nAssets、template、docx: { fp, size }（輸出為 html 時另有 html），keepCaption、toc 為服務端之同名結果
```

- **服務在同一行程內排隊轉檔**；用戶端 `timeoutMs` 預設 10 分鐘（含排隊與 Word 啟動），連線層失敗自動重試 3 次，逾時與 HTTP 錯誤不重試。服務所在機器上不得手動開 Word（第 6 節同樣適用）。
- **權杖**：服務端 `token` 非空時，`/api/*` 皆須帶 `x-api-token`；用戶端之 `host`、`port`、`token` 未給時取環境變數 `WMD2DOCX_HOST`、`WMD2DOCX_PORT`、`WMD2DOCX_TOKEN`。權杖不寫進專案檔與 md。
- **檢查服務**：`GET /api/health` 的 `docxReady` 只表示作業系統條件（診斷用）；要確認 Word 真的可用，用 `GET /api/selftest`（實跑一次最小轉檔）。用戶端 `health()` 在權杖錯誤等情形仍回傳服務端之狀態物件（含 `success: false`），以 `success` 判斷，不以是否 resolve 判斷。
- **`keepCaption`、`toc` 由服務端執行**；`toc.timeoutMs` 服務端不採用。用戶端遇服務端（舊版）未回報這兩項之結果時 reject 且不寫檔。
- **上限**：回傳之 docx 與 html 以 base64 置於同一 JSON，合計約 401,866,734 位元組，超過回 500；更大者改用本機 `cvMdToDocx`。夾帶之圖與範本受服務端 `maxMb`（預設 256）限制。缺圖在送出前即 reject。
- **成敗以本機實體檔判定**，不憑回傳值：檔案存在、修改時間晚於本次 md、大小合理，再依第 7 節核對 document.xml。`r.docx.size` 是用戶端對自己寫出的檔取得之大小，恆與本機檔相符，不能佐證服務端成功。連線中斷或回應異常時同樣只認實體檔，必要時先查 `GET /api/selftest` 再重試或改本機轉檔。交叉引用警告（`reference(s) match no figure/table name`）印在服務端，用戶端看不到，以 docx 內 `{…}` 殘留檢查補強（第 7 節第 3 點）。

## 6. 執行紀律

1. **一次一份**：同一 Node 行程內之轉檔會自動排隊，跨行程不保證；Word 為單一實例，並行會互相拒絕（後到者得「接收者已拒絕這個呼叫」，並可能遺留 WINWORD 與鎖定檔）。多份依序寫在同一支背景指令內，每份印出路徑、大小與耗時；預估超過 2 分鐘者依 skill[role-setup-scheduler-for-session] 明給 `timeout`，超過 115 分鐘者 detached 執行。
2. **產製期間不開 Word**；裁定者開著 docx 審閱時，只更新 md，待其關檔並指示後才重產。遇鎖定或 Word 行程即停下告知，不強制結束。
3. **殘留行程之判定**：產後列出 WINWORD 行程應為空。判定為轉檔殘留前，先排除兩種情形：officecli 之截圖會短暫啟動 Word，數十秒後自行結束（使用端經驗，套件說明未載）；裁定者自己開的 Word。確認是轉檔殘留（如目錄更新逾時：套件結束 powershell 之行程樹，但經 COM 啟動之 WINWORD 不在其中）且無他人使用，才結束並記錄。
4. **防毒與 `.vbs`（依安裝版本分辨）**：
   - 舊版（目錄功能加入後至 1.0.23 止）以套件內之 `src/updateDocxToc.vbs` 更新目錄；該檔曾被 Microsoft Defender 以機器學習判為惡意腳本（誤報），任何程式一讀取即隔離，此後 `toc: true` 之轉檔拋「updateDocxToc.vbs is not found」；使用端另遇自另一專案複製補回，連帶使來源專案之副本也被隔離。仍用舊版者：任何工具（Read、Grep、cp、雜湊、解壓）都不觸碰該檔，檢視套件時以套件說明為據、不解開套件全樹、Grep 避開套件 `src`；遇「Permission denied」或「not found」而同資料夾他檔可讀時，先查 Defender 之事件紀錄（Windows Defender/Operational，事件 1116 偵測、1117 處置）再動作；還原與加例外屬使用者之安全設定，交使用者處理；並依自有套件之升版管道改用新版。
   - 1.0.24 起已移除該檔，目錄更新改由 Windows PowerShell 5.1 經 COM 驅動 Word，腳本以 `-EncodedCommand` 帶於命令列、不落地，故 `src/` 內沒有可被隔離之腳本檔，檢視 `src/` 不必避讀。限制：受限語言模式（AppLocker、WDAC）禁用 COM 物件，該類機器無法以此法驅動 Word。
   - 現行版隨包仍有 `test/tools/figurePages.vbs`：套件自己的測試工具（量測圖名頁碼），轉檔不使用，上游尚列為待處理；檢視套件時不需讀取或執行它。
5. **圖多之冊**：docx 可達數十 MB、轉檔數分鐘（Word 處理每張圖約 0.6 秒），屬正常；依第 1 點之時限規則執行。

## 7. 驗證（不憑回傳值）

作法與可重跑之腳本見 [驗證作法](references/verification.md)。

1. **實體檔**：存在、時間戳晚於本次 md、大小合理。
2. **docx 是 zip**，以 zip 工具直接讀部件，不解壓整包；逐一讀部件時，檔名中之 `[` 須改寫為 `[[]`（`[Content_Types].xml` 否則讀不到；自 Node 呼叫時反斜線跳脫無效），寫法見 [範本衛生](references/template-hygiene.md) 開頭。
3. **`word/document.xml` 先串接文字節點再計數**：Word 把一句話拆成多個 `<w:t>`，直接對原始 XML 找「圖1 」會漏。圖題數＝圖數、表題數＝表數（以不重複之編號計：啟用 `toc` 時圖目錄、表目錄會再列一次，直接計數會成兩倍），最後圖號＝圖數、「如圖N所示」等引用數與 md 一致、`{…}` 殘留為 0（只在串接後之文字上掃；原始 XML 內之大括號多為圖片識別碼；程式碼區塊、數學式內之大括號會計入，須逐筆看是否為 `{圖表名稱}` 形狀）。
4. **欄位與圖**：啟用 `toc` 者，目錄欄位（`TOC`）存在、圖表編號欄位（`SEQ`）數＝圖表題數（未啟用者無這兩種欄位屬正常）；`<w:drawing>` 數與 md 之圖數一致。內嵌媒體數少於圖數屬轉檔器對相同圖檔去重，回報時說明；SVG 之圖每張內嵌 svg 與 png 預覽兩份，含 SVG 者媒體數可大於圖數。
5. **範本旗標與樣式**：`word/settings.xml` 含 `doNotAutoCompressPictures`；樣式與業主字樣依第 4 節三條判準（範本帶入者、產出全面、HTML 帶入者另列）。
6. **版面**：首欄不換行等欄寬設定生效（抽表格首欄之段落屬性或人工開檔抽查）；同一表內字級只有 1 種（以 `scripts/chkTableRunSizes.mjs` 檢查，作法見 [驗證作法](references/verification.md) 第 4 節）；版面有疑義者以 Word 實排轉圖目視。
7. **殘留行程**：依第 6 節第 3 點。
8. **md 抽查**：交叉引用全解析（轉檔無 `reference(s) match no figure/table name` 警告）、圖檔存在、表格完整、定稿句在位。

## 8. 產物管理

- **md 與 docx 皆為純產物**，手改會在下次重產時消失；改來源後重產，不手改 docx。
- **審稿順序**：md 交審定後才產 docx（裁定者要求看 docx 者依其指示）；只重產受影響之報告。
- **報告改名或改版次後清除舊檔**：輸出夾內留著舊檔名之 docx 與 md，會被當成現行版本誤交或誤審。確認無引用後刪除，並回驗已不存在。
- **轉檔模組或範本改動後**，全部報告依序重產並逐份驗證（第 7 節），回報逐份列出路徑、大小與驗證結果。

## 9. 陷阱與對策（皆已實際踩過）

| 陷阱 | 對策 |
|---|---|
| 範本自他案改來，樣式清單留著他案業主之樣式名稱（數十個），表格樣式有他案業主之別名，頁尾頁碼暫存值為他案之頁碼格式 | 依第 4 節清理；產出全部部件掃描業主字樣為 0 |
| 以為產線已不用範本樣式，實際上目錄標題與範本本文段落都套他案樣式 | 以產出 docx 實查被引用之樣式（template-hygiene §2） |
| 依賴 `toc` 之樣式名稱預設值 | 轉檔呼叫明確指定專案前綴之名稱 |
| 自訂樣式取了 Word 內建樣式之本地化名稱（如「目錄標題」），經 Word 轉檔被更名為「目錄標題1」，範本樣式失效 | 樣式名稱加專案前綴；改名後以真 Word 轉一份，比對範本與產出之樣式名稱 |
| 未給 `fpInTemp`（內建範本）卻開 `toc`，真 Word 拒絕（封面節不得有頁尾） | 開目錄須用自備範本，如 `temp.docx` 或其衍生 |
| 產出 docx 有大量名稱為 CSS 類別之自訂樣式（`katex*`、`hljs-*`、`msonormal`），被當成範本殘留去刪範本 | 這是轉檔時由 HTML 帶入之樣式，另列計數、不算範本問題；以範本之 styles.xml 單獨檢查範本（第 4 節三條判準） |
| 換範本後圖片變糊 | 範本缺 `doNotAutoCompressPictures`；補回後重產 |
| 以回傳值或「檔案存在」判定成功 | 實體檔之時間與大小，加 document.xml 核對 |
| 對原始 XML 數「圖1 」或大括號 | 先串接文字節點再掃 |
| 啟用 `toc` 後圖題、表題直接計數成兩倍 | 以不重複之編號計 |
| 圖題寫成 `圖1 名稱` 或 `圖1：名稱` | 寫字面 `圖n 名稱`；docx 端只認「圖1 名稱」形式 |
| 交叉引用之名稱差一字，轉檔只印一行警告，`{名稱}` 留在 docx | 轉檔後檢查警告；document.xml 掃 `{` 殘留 |
| 以 `unzip -p` 逐一讀部件，`[Content_Types].xml` 讀不到（`filename not matched`）而整支腳本中止 | 檔名中之 `[` 改寫為 `[[]` |
| 多份並行轉檔，Word 互相拒絕 | 同一支指令內依序轉 |
| 裁定者開著 docx 審閱時重產 | 只更新 md，待指示再產；遇鎖定停下告知 |
| 截圖工具啟動之 Word 被當成轉檔殘留而結束 | 等數十秒再查；不殺他人之 Word |
| 舊版（≤1.0.23）讀取套件內之 `.vbs` 使其被防毒隔離，目錄轉檔隨即失敗；自他案複製補檔，他案之副本也被隔離 | 任何工具都不碰該檔；只讀套件說明，Grep 避開套件 `src`；隔離之還原交使用者；升到 1.0.24 以上 |
| 轉檔服務連線異常或回傳值可疑 | 只認本機實體檔（時間戳、大小）與 document.xml 核對；先查 `GET /api/selftest` |
| 報告改名後舊檔留在輸出夾 | 確認無引用後刪除並回驗 |
| 長時間之依序重產未給 `timeout`，30 分鐘被終止 | 依 role-setup-scheduler-for-session 明給 `timeout` 或 detached |

## 10. 完成前勾選

- [ ] 範本為專案自己的；三條判準皆過（範本之自訂樣式只剩專案前綴者，其餘已逐個判讀並登記；產出全部樣式名稱與部件之業主字樣為 0；HTML 帶入之樣式已另列計數）；樣式名稱未與 Word 內建樣式之本地化名稱同名，更名檢查無「不存在」；`doNotAutoCompressPictures` 在；範本改過者 `officecli validate` 通過且改前改後產出比對一致
- [ ] 轉檔呼叫明確指定 `toc` 之樣式名稱；開 `toc` 者用自備範本；範本路徑與樣式名稱只寫在共用之轉檔模組
- [ ] 產製期間未開 Word；轉檔一次一份；無殘留之 WINWORD 行程（已排除截圖與他人所開者）
- [ ] 每份 docx 以實體檔時間與大小驗證；document.xml 文字節點核對圖題、表題、引用、殘留皆符合；媒體去重已說明；同一表內字級不一之表數為 0 或已逐表說明
- [ ] md 已審定才產 docx，或依裁定者指示；改名或改版次後之舊檔已清除並回驗
- [ ] 回報逐份列出路徑、大小、驗證結果與未做之項目
