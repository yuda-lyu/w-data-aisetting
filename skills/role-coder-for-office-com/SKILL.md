---
name: role-coder-for-office-com
description: |
  以程式經 COM 驅動本機 Microsoft Office(Word 為主;Excel、PowerPoint 同理而未實測者標明)之規範:取得實例一律 DispatchEx 不用 Dispatch(ROT 借用他人之實例、Quit 關掉他人文件)、只結束自己之文件且有他人文件或無法判定時不 Quit、例外路徑經 finally 收尾、輸入唯讀開啟(輸出即輸入時例外)、隱藏實例仍會跳出可見對話框(檔案使用中、安全性注意事項、上次開啟發生嚴重錯誤;DisplayAlerts 擋不住)、強制結束後之 Resiliency\DisabledItems 與擁有者檔 ~$、轉檔器成敗不看離開碼而依輸出 fail-closed 判定並驗輸出檔、PowerShell 讀 COM 屬性之寫法;測試:全機單一資源集中同檔、測試閘、跑修前版本先起可見視窗看門狗、只結束本組新起之 /Automation 實例、清除自己造成之停用項目並回驗、以可觀察條件扣住「轉檔進行中」之時點.
  觸發條件:撰寫、修改、審查以 COM(pywin32 之 win32com、PowerShell 之 New-Object -ComObject、VBScript、.NET Interop)驅動 Word／Excel／PowerPoint 之程式或其測試;轉檔器(docx、html、pdf 互轉、分割、目錄更新)出現「Word 被關掉、文件遺失、跳出對話框卡住、轉檔失敗卻回成功、殘留 WINWORD」任一症狀;要強制結束 Office 程序——必先調用本技能,整篇入 context 逐項比對後才動工.只讀寫 .docx／.pptx／.xlsx 檔案內容而不驅動 Office 者用 role-operator-docx／pptx／xlsx,非本技能.
---

# role-coder-for-office-com — 以 COM 驅動 Microsoft Office

**定位**:寫程式呼叫本機已安裝之 Office 去開檔、轉檔、存檔(常見於轉檔器:html→docx、docx→html、docx→pdf、分割、目錄更新).與 skill[role-operator-docx]、skill[role-operator-pptx]、skill[role-operator-xlsx] 之分工:那三個技能以 officecli 直接讀寫檔案內容,不需安裝 Office;本技能管的是**驅動 Office 本身**之程式.Windows 之程序、路徑與子行程規範另見 skill[role-command-windows],測試之共通規範見 skill[role-coder-for-test].

**證據範圍**:下列規則皆於 Word(Office 16)實測;標〔未實測〕者為依 COM 機制推論之 Excel／PowerPoint 適用,動手前須自行實測.

**why**:Office 是全機共用、帶使用者介面之資源.轉檔器寫錯時,後果不是自己失敗,而是**關掉使用者或他行程正在用的 Office、遺失未存文件、或跳出可見對話框讓整條管線停住**——且多半在多行程並行、或使用者正開著 Word 時才現形,單獨測試永遠是綠的.

## 依任務找章節

| 任務 | 章節 |
|---|---|
| 取得 Office 實例 | §1 |
| 轉檔結束、例外路徑之收尾 | §2 |
| 開啟輸入檔、模板 | §3 |
| 不跳視窗、對話框卡住 | §4 |
| 強制結束了 Office 之後 | §5 |
| 判定轉檔成敗 | §6 |
| 寫或跑驅動 Office 之測試 | §7 |
| 以 PowerShell 操作 COM 物件 | §8 |

## 1. 取得實例:一律 `DispatchEx`,不用 `Dispatch`

- pywin32 之 `win32com.client.Dispatch('Word.Application')` 內部先以 `pythoncom.connect`(GetActiveObject)連上**已登錄於 ROT 之執行中實例**——他行程之轉檔、PowerShell 起之自動化實例、使用者開啟後失焦之 Word——失敗才新建.轉完呼叫 `Quit(0)` 即以**不儲存**結束對方:對方之文件被關、未存內容遺失(實測:他人持有之文件讀取變 null、借用者文件數歸 0;行程未必結束).
- 一律 `win32com.client.DispatchEx('Word.Application')`(CoCreateInstanceEx;Word 為 single-use 伺服器,實測已有隱藏 Word 時兩次皆另起 WINWORD、看到 0 份文件).PowerShell 之 `New-Object -ComObject Word.Application` 亦為新建.
- **只改 `DispatchEx` 不夠**:`DispatchEx` 所建之實例**仍登錄於 ROT**,他行程之 `Dispatch` 照樣連得上並在其中開文件(實測)——收尾須依 §2 判斷,不能無條件 Quit.
- 〔未實測〕Excel 同為多實例伺服器,同理.**PowerPoint 為單一實例之應用程式**,`DispatchEx` 亦會連上既有實例——驅動 PowerPoint 之程式須假設實例是共用的,收尾只關自己開的簡報、一律不 Quit(或先實測確認).
- 盤點:`git grep -n "Dispatch(\|DispatchEx(\|GetActiveObject\|\.Quit(" -- <轉檔器原始碼目錄>`;判準:取得實例只有 `DispatchEx` 一處、無 `Dispatch(`、`.Quit(` 只在收尾函數內.

## 2. 收尾:只關自己之文件;有他人文件或無法判定就不 Quit

1. **關閉本行程之文件**(輸入、模板、各輸出):以 **COM 物件身分**比對是否屬本行程(pywin32 之 `CDispatch.__eq__` 比較 `_oleobj_`,即 IUnknown 身分),**不以路徑**(`FullName`)比對——他人可能在本行程關閉後重開同一路徑.關閉失敗者仍屬本行程.
2. **盤點實例內非本行程之文件**:`Documents` 之外另查**受保護檢視**(`ProtectedViewWindows`,不在 `Documents` 內).讀取失敗時有界重試(如 10 次 × 0.5 秒).
3. **判定**:有他人文件,**或無法判定**(重試後仍失敗)→ 不 Quit,於 stderr 印一行說明(勿以失敗字樣起首,免被成敗判定誤判,見 §6);實例已不存在(RPC 斷線類錯誤 `0x800706BA`、`0x800706BE`、`0x80010108`)→ 不再動作;其餘 → `Quit(0)`.寧可留下實例,不關他人之文件.
4. **例外路徑同一套**:`Visible`／`DisplayAlerts` 之設定與轉檔同在 `try` 內,任何例外(開檔失敗、圖片連結失敗、另存失敗)皆經 `finally` 走上述收尾,不殘留實例.
- 已知限制:盤點與 Quit 之間他人仍可能連入;他人取用本行程已開之**同一文件物件**時,本行程之 Close 仍會關掉它——須對方也改用 `DispatchEx`.

## 3. 開檔:輸入與模板唯讀開啟

- 輸入檔與模板一律唯讀開啟:Word 為 `Documents.Open(fp, False, True)`(位置參數依序為 FileName、ConfirmConversions、ReadOnly).why:各轉檔各起一個實例後,兩個實例以可寫方式同開同一檔(如共用之內建模板)時,**後開者跳出「檔案使用中」對話框**(可見)而停住;`DisplayAlerts = False` 擋不住.
- **例外**:輸出路徑即該輸入檔(以輸出覆寫模板等)時須可寫開啟——唯讀開啟則 Word 拒絕另存回原路徑(「這是唯讀檔案,無法儲存」).判定同檔用正規化後之路徑比較(`realpath`＋`normcase` 或等效),寫成 `ReadOnly = not isSamePath(fp, fpOut)`.
- 可寫開啟或被強制結束時,Word 在檔案旁留下擁有者檔 `~$<檔名>`;唯讀開啟不產生.清理時只刪自己造成者.
- 唯讀只解鎖檔情境;編碼選擇、密碼、修復提示、安全警告等互動仍可能出現(見 §4).

## 4. 不跳視窗:隱藏實例仍會跳出可見對話框

- 一律 `app.Visible = False`、`app.DisplayAlerts = False`(Word 為 `0`／`wdAlertsNone`);測試中扮演他行程之 Office 亦一律隱藏.
- **以下對話框 `DisplayAlerts` 擋不住**,出現即整條管線停住等人按:
  - 「檔案使用中」(`bosa_sdm_msword`):可寫開啟已被他實例開著之檔(§3).
  - 「上次開啟時發生嚴重錯誤,要開啟嗎」(`#32770`,標題 Microsoft Word):該檔已被列入停用清單(§5).
  - 「安全性注意事項」:輸入 docx 含外部連結(`a:blip r:link` 之 External 圖)時,Word 向網址取圖前詢問.
- 共用實例被交錯使用時(甲開檔中乙連上同一實例),Word 主視窗曾變為可見;改 `DispatchEx`＋§2 後未再出現.
- 驗收:轉檔期間列出全部 WINWORD 之可見頂層視窗,應為 0(作法見 §7 看門狗).

## 5. 強制結束之後:停用清單與殘留

- **強制結束(taskkill)開著文件之 Office 後,該文件被列入停用清單** `HKCU\Software\Microsoft\Office\16.0\<App>\Resiliency\DisabledItems`(Word 之 `<App>` 為 `Word`),此後任何實例開該檔都跳出 §4 之「上次開啟時發生嚴重錯誤」而停住——包括轉檔器自己之內建模板,於是**之後每次轉檔都卡住**.
- 處置:刪除指向該檔之值即恢復.值為 REG_BINARY:前 12 位元組為標頭(第 5～8 位元組為路徑位元組數,含結尾空字元),其後為 UTF-16LE 路徑.**只清自己造成者**(路徑落在本 repo 或本任務暫存夾內),清後回讀確認已刪;同一機碼下 `PotentialDataLossInfo2` 等為 Office 自行維護之標記,不動.
- 能不強制結束就不強制結束;非結束不可時,先以 §7 之方式只結束本組新起之自動化實例,結束後依上列清停用清單、刪 `~$` 擁有者檔並回驗.殺程序之寫法與回驗見 skill[role-command-windows] §3、§4.

## 6. 成敗判定:不看離開碼,依輸出 fail-closed

- 轉檔器(Python 打包之 exe、腳本)常把例外吞掉、印一行錯誤後仍以**離開碼 0** 結束,呼叫端只看離開碼即「轉換失敗仍回成功」——若輸出路徑已有舊檔,呼叫端還會讀到舊內容而不自知.
- 呼叫端依輸出判定,且 **fail-closed**:任一行以 `error:` 起首即失敗(即使同時有 `success` 行),取首個之原因;無 `error:` 行時須有**整行**為 `success` 才成功;空輸出、未知輸出、非字串一律失敗,且不回顯其餘輸出.§2 之「實例保留」說明行不得以 `error:` 起首.
- **失敗之形態不只一種,以真執行檔實測其輸出,不要只讀原始碼**:曾見同家族之轉檔器內層吞例外後印出錯誤字典(`{'type': …, 'message': …}`)再印 `success`,完全沒有 `error:` 行——判定須一併辨識該形態並取其 `message`;下次重建執行檔時改為失敗即拋出.
- 判成功後**另驗輸出檔存在、為檔案且大小 > 0**:例如輸出路徑無副檔名時 Word 另存為 `<路徑>.htm`,轉檔器照報成功.
- 呼叫中文系統之轉檔器時,以系統字碼頁解碼輸出(如 wsemi `execProcess` 之 `codeCmd: 'auto'`),否則失敗原因成亂碼.

## 7. 測試

- **全機單一資源**:驅動 Office 之測試在 `mocha --parallel` 下一律集中於同一測試檔依序執行(skill[role-coder-for-test] §5);跨套件同時跑時另經全機之 Office 測試閘(一次一個),兩組同時驅動 Word 會互相關掉或搶走實例,現形為偶發之內容錯誤.
- **跑修前版本(或任何可能跳視窗之版本)之前先起可見視窗看門狗**:每 200～300 ms 列出 WINWORD 之可見頂層視窗,自動化實例出現可見視窗即記錄並結束之;各案以「期間 0 筆」斷言.修前版本常跳「檔案使用中」等對話框,不先起看門狗即卡住數分鐘.
- **只結束本組新起之自動化實例**:記下測試開始前之 WINWORD PID,結束時只處理期間新出現且命令列含 `/Automation` 者;無法區分他人於期間另起者,故須在測試閘內執行.結束後依 §5 清停用清單並回驗.
- **扮演他人之 Word**:以 PowerShell 另起隱藏 Word 並持有一份含未存文字之文件(扮演使用者或他行程);以 GetActiveObject 連上並新增文件(扮演舊寫法之他行程).斷言:轉檔後對方之實例仍在、文件數與未存文字不變、無殘留 WINWORD、無可見視窗.
- **「轉檔進行中」之確定時點**:輸入可引用 http 資源者(html),以本機 http 伺服器扣住圖片回應,Word 停在匯入中而仍受理他行程之 COM 呼叫,據此寫「借用」「交錯」案,不靠固定等待.**輸入為 docx 者不可用外部連結扣住**(會跳 §4 之安全性注意事項);改以多段落 docx 與拉長轉檔之參數,配合可觀察條件(轉檔期間取樣 WINWORD 判定已另起實例)同步.
- 實例隔離之最小案組:①既有實例(含未存文件)不被借用亦不被結束;②兩行程交錯與並行轉檔(含同時開始、錯開)皆成功且不殘留;③例外路徑(開檔失敗、輸出路徑無效)亦只結束自己之實例;④本行程之實例被他行程連上並開文件時,轉檔成功而不結束該實例;⑤輸出即輸入時照改前行為.
- 新舊執行檔之輸出比對:去除 `w:rsid*`、`w14:paraId`／`textId`、`wp14:anchorId`／`editId`、`<w:nsid>`、`<w:tmpl>` 等逐次雜訊後再比;同一執行檔連轉兩次亦有編號、字型表次序之差異.

## 8. 以 PowerShell 操作 COM 物件

- 經 `[Runtime.InteropServices.Marshal]::GetActiveObject('Word.Application')` 取得之物件:`foreach ($x in $w.Documents)` 列不出文件、`Item(i).FullName` 讀回空字串,但 `$w.Documents.Count` 與 `$w.Documents.Add()` 正常;`New-Object -ComObject` 取得者屬性讀寫正常.
- 計數用 `$w.Documents.Count`;以 `InvokeMember('Count', GetProperty, …)` 讀會回 `DISP_E_UNKNOWNNAME`.
- Word 忙碌(匯入中)時 `$d.Content.Text = …` 報「找不到屬性 'Text'」,改以 `$o.GetType().InvokeMember(名, [Reflection.BindingFlags]::SetProperty, $null, $o, @(值))` 經 IDispatch 寫入,仍可能被拒十餘秒——測試先回報「已新增」,放行後再重試寫入.Word 不忙時兩種寫法皆可.
- Windows PowerShell 5.1 以 `-File` 執行無 BOM 之 UTF-8 腳本時以系統字碼頁(中文系統為 cp950)解讀,首行中文註解可吞掉換行使 `param(...)` 失效;暫存之 `.ps1` 只用 ASCII,或存成帶 BOM 之 UTF-8(其餘 PowerShell 5.1 雷區見 skill[role-command-windows] §1).

## 完成前勾選

- [ ] 取得實例只有 `DispatchEx`(或 `New-Object -ComObject`),無 `Dispatch`／GetActiveObject;PowerPoint 等單一實例者已假設共用(§1)
- [ ] 收尾以 COM 物件身分只關自己之文件,含受保護檢視之盤點;有他人文件或無法判定時不 Quit;例外路徑經 `finally`(§2)
- [ ] 輸入與模板唯讀開啟,輸出即輸入者例外可寫(§3)
- [ ] `Visible`／`DisplayAlerts` 已關;已知擋不住之對話框之觸發條件已排除(§4)
- [ ] 未強制結束 Office;非結束不可時只結束本組新起者,並已清自己造成之停用清單與 `~$` 檔且回驗(§5)
- [ ] 成敗依輸出 fail-closed 判定,已以真執行檔實測失敗輸出之各形態,判成功後另驗輸出檔(§6)
- [ ] 測試集中同檔、經 Office 測試閘、跑修前版本前已起可見視窗看門狗;實例隔離最小案組齊全(§7)
