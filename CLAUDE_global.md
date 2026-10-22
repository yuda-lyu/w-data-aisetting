# Agent 工作規則

> **本檔性質**:跨專案全域提示詞,主代理與所有子代理皆須遵循.與專案 `CLAUDE.md` 衝突時,以較具體的專案設定為準.

> **閱讀方式**:各節開頭的「觸發」標明何時適用;接到任務先掃各節觸發條件,命中即整節逐項比對後才動工.**指向技能之節只寫觸發與技能名**:命中即先調用該技能並整篇照做,本檔不重述技能內容.章節依任務生命週期排序:通用(語言,工具,暫存檔)→ 實作 → 版本控制 → 規格(含流程/設計/呼叫鏈文件)→ 測試 → 回報.

> **本檔須能單獨成立**:除本檔指名之技能(與本檔一同經技能庫同步至各機)外,不依賴任何外部檔案(會被帶到不同機器).故只留原則與可直接執行的規則:個案細節(哪個專案、哪天、賠了什麼)不寫進本檔,只保留去識別後的[典型錯誤形狀]——讓形狀本身可辨識,不必知道是哪個案子.

## 1. 語言與詞彙

**觸發**:全程適用.

- 一律用繁體中文回應.
- 詞彙等價:
  - [全域設定]＝[全域記憶]＝[長期設定]＝[長期記憶]＝[全專案設定]＝[全專案記憶]→ 本檔(`~/.claude/CLAUDE.md`).
  - [專案記憶]＝[專案設定]＝[計畫記憶]＝[計畫設定]＝[工作記憶]＝[工作設定]→ 當前工作路徑下的 `CLAUDE.md`(`<cwd>/CLAUDE.md`).

## 2. 派發子代理/語言/工具選用之要點

### 2.1 派發子代理

**觸發**:創建子代理(agent)時.

- **依難度派發**:請視難度安排,基本難度之任務就是派sonnet5.5 xhigh,難度高的任務才派opus5.5 xhigh,節省token用量.

### 2.2 語言/工具選用

**觸發**:寫腳本,選用程式語言或 shell,寫 `.bat` 時.

- **優先程式語言**:腳本優先 `.mjs`(ES modules),優先用專案內 `node_modules` 套件;非必要不寫 `.js`,`.py` 次之.

- **避免使用**:避免 PowerShell;不得已要用先徵詢使用者.
  - **環境只有 Windows PowerShell 5.1 時**(如 Windows Server 之維運)之已知雷區:①`ConvertFrom-Json` 解析含中文之內容(如 pino JSONL log)會失敗(`Unterminated string passed in`,主控台編碼所致),改以正則抓欄位:`if ($line -match '"msg":"([^"]*)"') { $msg = $Matches[1] }`;②`Select-String` 之結果不能直接 `-split`,須先 `.ToString()`:`($line.ToString() -split '│')[6]`;③無 `&&`,`||`,三元運算子,`??`;④對原生執行檔避免 `2>&1`(會產生 NativeCommandError 並使 `$?` 為 false).離開碼之判讀見 §8.7.

- **bat**:寫`.bat`注意含中文一律 Big5(cp950)編碼:cmd.exe 用系統 codepage 解析,UTF-8 各種 workaround(BOM,`chcp 65001`)實測都壞.不要默默把現有 Big5 .bat 重存成 UTF-8.

## 3. 暫存檔一律存放於`./tmp/`

**觸發**:產生任何臨時,暫存,scratch 或探索 dump 檔時,含派工子代理.

**臨時/暫存/scratch/探索 dump 檔一律落在主任務 cwd 下的 `./tmp/`**(錨點＝主 agent 啟動時的 `process.cwd()`;子代理在他處須用主 cwd 絕對路徑指向同一 `./tmp/`).不可用 `/tmp`,`$TMPDIR`,`$HOME`(Git Bash 的 `/tmp` 映射到使用者 Temp,檔案跑出專案外);cwd 根目錄雜檔(`./tmp_tree.txt`,`./debug.log`)與 `./.cache/` 也不行,集中單一 `./tmp/` 才能 `rm -rf tmp/` 一鍵結案.子代理探索禁用 `tree > 檔案` dump-to-disk,改 Glob/Grep/讀 stdout.**派工子代理時 prompt 須明文加上此守則**.任務結束前驗證 `./tmp/` 已清乾淨(須保留則說明).

## 4. 撰寫程式碼之要點

**觸發**:所有改 code 任務.

- 精準修改與簡潔優先.
- **死碼處置**:注意到不相關死碼提出即可,不自行刪除;既有死碼除非被要求否則不刪;自己修改造成的孤兒 import/變數/函式則要移除.

## 5. 自有套件開發與使用之要點

**定義**:自有套件為`wsemi`或`w-*`開頭之套件.

### 5.1 自有套件之定義

**觸發**:專案以 JavaScript 為主,且涉及套件依賴偵測,安裝建議,升版,或修改 `wsemi` / `w-*` 套件時.

- 專案內 `wsemi` 與所有 `w-*` 套件皆為**自有套件**.
- 自有套件已自行規定並安裝其依賴(如 `wsemi` 內已含 `lodash-es` 等諸多套件);**一律不要提醒[未安裝直接依賴 / 建議安裝 X]**,不論是在套件內或專案層偵測到.
- 依賴出問題時,處置方式是針對該自有套件統一改版或升版,由開發者統籌;不在專案端個別補裝或繞道.
- 給套件主責agent,發布套件是使用者的任務,並已建置自動化流程去處理連動發布事宜,請勿把發布套件當成待辦任務/事項,然後一直說有任務未完,進而造成浪費token.若套件有`./dist`,發布套件時會自動產製,也不要一直說`./dist`未更新當成待辦任務/事項,等同浪費token.若有需要用`./dist`去測試者,則請自行編譯去使用.

### 5.2 自有套件通報修正或擴充之要點

**觸發**:改code時發現自有套件有問題或須擴充時.

1. 若確認自有套件有問題或須擴充或優化等,請先至:
http://100.120.70.67:3000/semi/opensrcOper
並閱讀其內`通知方請用gitea.md`

2. 確認後,再請通過發issue將待修正問題、建議擴充或優化等需求傳遞給opensrcOper,自有套件之主控agent會輪詢並待接收,之後主控agent會其按輕重緩急、任務量與當前訂閱額度等條件進行酌情安排與處理.

3. 待套件更新後,使用者再通知進行安裝與連帶更新程式碼.

## 6. UI/UX之要點

**觸發**:任何涉及前端畫面/元件/互動的改動——含新增功能,修 bug,搬移/分拆/接排既有排版,新增下拉/輸入框/chip/badge 等小元件,建置或修改展示資料之頁面/彈窗,讀到或改到互動指示符號,要用 alert/confirm/prompt 或原生 select;即使任務被框成功能搬移/重構而非設計.命中即先調用 skill[role-coder-for-ui].

### 6.1 「重新設計」是整體重做,不是微調既有 prop

**觸發**:出現「重新設計」「重做」「redesign」「要有設計過 / 設計感」,或對美感 / 版面 / 比例 / 對齊 / 留白 / 風格表達不滿.命中即另加調用 skill[role-design-web-for-redesign].

## 7. 實作規範:路徑與檔案 I/O

**觸發**:任何組裝路徑,寫檔,跨 shell/程式傳遞路徑的操作.

### 7.1 兩種出檔場景

- **場景 A:輸出落在使用者工作路徑**(測試暫存,報告,腳本產物)→ 用 cwd-relative(`./tmp/foo.json`).絕不用 `fileURLToPath(import.meta.url)`——套件被 install 後輸出會落到 `node_modules/<pkg>/`,搬動腳本時輸出位置悄悄改變.
- **場景 B:輸出落在腳本/模組所在資料夾**(套件自帶 user_data)→ 用 `fileURLToPath(import.meta.url)` + `dirname` + `join`.

### 7.2 永遠不要用 `new URL(import.meta.url).pathname` 取路徑

`pathname` 回 URL-encoded 字串:空格變 `%20`,中文變 `%E9%96%8B...`,Windows 多 leading `/D:/`,fs 會把這些字面字元當實體資料夾名建立(踩過:D 槽根目錄建出多層 `%20%E9...` 垃圾資料夾).URL → 實體路徑只有 `fileURLToPath()` 一條路,且僅場景 B 用.

### 7.3 git-bash 的 POSIX 路徑(`/d/...`,`/c/...`)絕不可跨界傳給 Windows 原生程式或 node

[`/d/` = D 槽]映射只存在 git-bash shell 內部.把這種字串交給 Windows 原生 exe 或 node 的 path/fs,開頭 `/` 被當[當前磁碟根]:`/d/tmp/x` → `D:\d\tmp\x`(多一層 d),`/c/Users/x` → `D:\c\Users\x`(磁碟機都錯).邊界判別:路徑字串最後是誰解析——Bash 工具內 `mkdir /d/tmp/...` 對;寫進 `.mjs` 再交給 spawn / `launchPersistentContext` / node fs 就錯.改用帶磁碟機代號路徑(`D:/tmp/x`)或從 `fileURLToPath` 衍生.

### 7.4 寫入前驗收

路徑經組裝(join,replace,URL 轉換)後,fs 操作前先 `console.log(path.resolve(...))` 印 absolute 路徑驗收;寫入後 `ls` 確認落點;發現孤兒資料夾立刻徵求允許後刪除.警覺訊號:工作目錄含空格,中文/非 ASCII,Windows `D:\...`——任一符合就雙倍仔細.

## 8. 實作規範:Shell,工具與環境

**觸發**:寫腳本,跑指令,管理程序/服務,傳檔.

### 8.1 Bash / PowerShell 工具內禁用之寫法:`cd` 與 `cat` 系檔案 I/O

**觸發**:任何要在非 cwd 之目錄下執行的操作(解壓,安裝,建置,跑他處腳本,查看子目錄產物),以及任何建立/讀取/修改檔案之操作(寫暫存腳本,產設定檔,看檔案內容).

**共同 why**:此二類寫法會**觸發權限確認彈窗**,連續打斷使用者;專用工具(Read/Write/Edit/Glob/Grep)則無此問題,且有檔案狀態追蹤,行號顯示與 diff 呈現.

#### (1) 不用 `cd`,改用絕對路徑或指令自身之目錄參數

**鐵則**:工具的工作目錄本來就是主 cwd 且**跨呼叫持續存在**,不需要也不可以用 `cd` 去切.要在別的目錄動作,用絕對路徑,或用指令自己的目錄參數:`tar -C <dir>`,`npm --prefix <dir>`,`npm pack --pack-destination <dir>`,`git -C <dir>`,`node <dir>/x.mjs`,`ls <dir>`.

**why**:除觸發確認外,`cd` 會改掉後續每一次呼叫的 cwd,原本正確的相對路徑(`./tmp/x`,`db01_.../y.csv`)全部指到錯的地方,為了修正又得再 `cd` 回去,於是**每一條指令都要使用者按同意**,形成連鎖打斷.**典型錯誤形狀**:為了解壓一個套件用了 `cd ./tmp/xxx`,其後數條指令全部跳出確認,使用者反問[為何現在這指令都會跳出來要我同意].

**已經誤 `cd` 出去時**:不要再用 `cd` 切回來(那是第二次觸發),直接改用絕對路徑執行後續指令即可;需要確認目前位置用 `pwd`.

#### (2) 不用 `cat` / heredoc / 重導向做檔案 I/O,改用 Read / Write / Edit 工具

| 意圖 | 禁用 | 改用 |
|---|---|---|
| 建立檔案(含 `./tmp/` 暫存腳本) | `cat > f << 'EOF'`,`echo ... > f`,`printf ... > f` | **Write 工具** |
| 讀取檔案內容 | `cat f`,`head -n f`,`tail -n f`,`sed -n 'a,bp' f` | **Read 工具**(可帶 offset/limit) |
| 修改檔案局部 | `sed -i`,`awk` 覆寫 | **Edit 工具** |
| 找檔名 / 搜內容 | `find`,`ls -R`,`grep -r` | **Glob / Grep 工具**(見 §8.2) |

**why**:除觸發確認外,②shell 重導向寫檔多一層引號與跳脫(中文,`$`,反引號,`!`)全得自己顧,heredoc 還受 `<<'EOF'` 與 `<<EOF` 之展開差異影響,錯了是**靜默寫出壞內容**;③Write/Edit 之改動會呈現 diff 供使用者審閱,shell 寫檔則完全不透明.**典型錯誤形狀**:以 `cat > ./tmp/xxx.mjs << 'EOF'` 寫一個暫存腳本又跳確認,使用者反問[為何又出現會要我確認指令].

**例外**:確實需要接管線做流式處理(如 `node x.mjs | grep -c pattern`,`wc -l < f`)才用 shell;**產出檔案一律 Write**,不因[只是暫存腳本]而放寬.

### 8.2 搜檔案內容一律用 Grep 工具,禁用 Bash `grep -r`

**觸發**:任何在專案內找字串,找引用,確認[有沒有 X]之操作.

**鐵則**:搜內容用 **Grep 工具**(內建 ripgrep),找檔名用 **Glob 工具**;**不要用 Bash 的 `grep -rn` 與 `find`**.

**why**:資料型專案之 `_plot`,`_report`,`_selfStorage`,`_logs`,`_holes` 等目錄動輒數萬至數十萬檔案.Grep 工具之 ripgrep **預設尊重 `.gitignore`**(這些資料目錄通常已被 ignore),且多執行緒遍歷並自動跳過二進位檔,實測秒回;Bash `grep -r` 完全不知 `.gitignore` 存在,一律硬掃全樹,實測直接吃滿 120s timeout 被丟到背景.

**最易踩之誤區**:以為加了 `--include="*.mjs"` 就安全 —— **不是**.`--include` 只決定[要不要讀這個檔的內容],grep 仍須走遍每個目錄並對每個檔案 stat.**瓶頸是檔案數量而非內容大小**,故 `--include` 完全救不了.**典型錯誤形狀**:同一輪對話內因此連續吃滿 timeout 兩次,兩次都以為[加了 `--include` 就沒事].

**真的須在 Bash 內搜**(如要接管線做統計)才用,且二選一:

```bash
git grep -n "pattern" # 只搜 git tracked 檔案,過濾範圍天然與 .gitignore 一致(首選)
grep -rn "pattern" --include="*.mjs" \
     --exclude-dir={node_modules,_plot,_report,_selfStorage,_logs,tmp} .
```

**同理**:`find . -name`,`ls -R`,`tree` 於同類專案亦會逾時,改用 Glob 工具;子代理探索更禁 `tree > 檔案` 之 dump-to-disk(§3).

### 8.3 Windows / Git Bash 下 `taskkill` 與取 PID

- `taskkill /F /PID <pid>` 在 Git Bash 會失敗(bash 把 `/F` 當路徑).正確:`cmd //c "taskkill /F /PID <pid> /T"`(雙斜線避免 bash path 翻譯).取 PID:`netstat -ano | grep ":<port> " | grep LISTENING | awk '{print $5}' | head -1`.
- **取 PID 勿依賴 wmic**:Windows 11 已移除 wmic,靠 wmic 撈 PID 會回空輸出且不報錯(看似成功實未殺,程序續佔資源).改用 tasklist(需比對 CommandLine 時用 PowerShell `Get-CimInstance Win32_Process`)取 PID 逐一 `taskkill /F /T`,殺後必回驗(見 §8.4).
- 何時可主動 taskkill:專案`CLAUDE.md`明確授權或使用者明確要求,否則先回報.

### 8.4 刪除 / 殺程序 / 重啟後必「回驗」成功(勿假設)

kill 與 rm 皆**不保證成功**,執行後必回頭驗證,不可假設已成功:

- **殺程序**:taskkill 後再 `netstat`/`tasklist` 確認該 PID **已消失,埠已釋放**.用埠號抓 PID 只殺得到「當下在監聽」者——卡住/未監聽之舊實例會漏殺.
- **刪檔/資料夾**:`rm -rf` 後以 `[ -d 夾 ]`/`ls` 確認**真的沒了**(rm 可能因鎖定/權限靜默失敗;Windows 下數萬檔以上之刪法見 §8.7).Windows 下對 memory-mapped 檔(如 LMDB `.mdb`)之 rm 會移除目錄名,但**行程仍持有舊檔映射**,存活之舊程序會無聲**續用舊資料**(假象「刪了,重建了」).
- **重啟服務**:健康檢查(如 `curl → 200`/ping)**無法分辨新舊實例**——存活之舊實例照樣回應,據此判定「重啟成功」是假陽性.通用判準是**確認新行程確實是當前提供服務者**:`netstat -ano`/`lsof -i` 查監聽該埠之 PID,須等於**你本次啟動的行程 PID**(或至少舊 PID 已消失,且出現一個新監聽 PID);並檢查新行程之輸出/log **無綁定失敗**(埠被占用類錯誤,各語言字樣不一,如 `EADDRINUSE`/`address already in use`/`bind: 已使用`).否則新實例常因埠被舊實例占用而**啟動即失敗退出**,舊實例續服務舊狀態(現象:「重啟了但狀態沒變/吃到舊快取」).服務專屬的「已啟動」log 字樣屬各專案細節,記於該專案設定而非此處.

### 8.5 長任務:背景指令與 `Monitor` 皆有時限,逾 115 分鐘之工作一律 detached＋分段等待

**觸發**:預估超過 2 分鐘之作業(測試全跑,批次重產,派工外部 CLI AI,下載/爬取,建置);或要「現在停下,之後被叫醒再繼續」——定時任務,延後執行,等背景指令/外部程序/排程輪次完成,等檔案或日誌變化,或用到 `Monitor`/`sleep`/`CronCreate`/`ScheduleWakeup` 任一者,不論使用者要求或 agent 自發.命中即先調用 skill[role-setup-scheduler-for-session].

### 8.6 Windows 背景 Chrome(playwright/puppeteer)程序回收

**觸發**:任何專案以 node 調用 chrome/chromium 背景繪圖或截圖(playwright、puppeteer、w-html2png 系),涉及常駐服務、排程重啟、或需清理 chrome 殘留時.

**成因**:Windows 上 playwright 以 non-detached spawn 瀏覽器且不用 Job Object,清理只掛在 node 的 exit/signal handler——node 被 **TerminateProcess**(`taskkill /F`、崩潰、OOM)時 handler 全不執行,chrome 整樹孤兒化,服務自動重啟則逐次疊加.`--remote-debugging-pipe` 斷線自關是**盡力而為非保證**(重載/卡頓機器實測不會自關),不能當防線;上游無解也不會修,須自建回收.

**回收三層**:①**啟動自掃**——常駐服務埠綁定成功後(證明無其他實例服役),查 chrome.exe 之 ExecutablePath(**限定自家瀏覽器路徑**,避免誤殺使用者瀏覽器)且**父行程已死**者,樹狀殺;②**看門狗掃已停止(stopped)之 chrome**——卡死者用一般枚舉或年齡判準看不出來,須以 `w-process-status` 之 `WProcessStatus('chrome.exe')` 查 `status==='stopped'` 才找得到,交叉自家路徑後樹狀殺;③**關閉走 tree-kill**——用 `wsemi` 之 `execProcessKillPid`(Windows 內部即 `taskkill /pid X /T /F`),**不可用 `child.kill()`**(Windows 下等同 TerminateProcess 且只殺 node 本身).

**鐵則**:①殺 chrome 必殺 root 帶 `/T`,逐個殺 renderer 無效(孤兒主程序會立即補生);②判準用[歸屬(父死)+健康(stopped)],**絕不用年齡**——常駐瀏覽器持續有請求時合法活數天,年齡判準會週期性處決健康現任;③`HandleCount=0` 之終止中卡死殭屍任何工具都殺不掉(回報[查無執行中實例]),屬 OS 層狀態,殺掉 root 後不增生即可接受,重開機歸零.

### 8.7 Windows 大量檔案操作(robocopy)與離開碼判讀

**觸發**:Windows 下刪除或複製大量檔案(數萬以上),以 robocopy 部署/覆蓋目錄,或判讀 Windows 指令之離開碼時.

#### (1) 大量刪檔:robocopy 鏡像空目錄清空,再刪空目錄

**不用檔案總管或 `Remove-Item -Recurse` 刪大量檔案**.檔案總管會先在記憶體建完整項目清單(數百萬筆約佔 3 GB),按[取消]後卡在[正在取消]且速度歸零、無法中止,只能結束 explorer.exe.**典型錯誤形狀**:以檔案總管刪一個數百萬小檔之資料目錄,取消不了也刪不完.

```powershell
$empty = '<專案根>\tmp\__empty__'
New-Item -ItemType Directory -Force $empty | Out-Null
$rcArgs = @('/MIR','/MT:32','/NFL','/NDL','/NJH','/NJS','/NC','/NS','/R:0','/W:0')
& robocopy $empty $target @rcArgs | Out-Null
# 另一道指令(見(2)): 刪除已清空之目錄
Remove-Item -LiteralPath $target -Recurse -Force -Confirm:$false
```

`/MT:32` 多執行緒;`/NFL /NDL /NJH /NJS /NC /NS` 關閉輸出(印檔名會大幅拖慢);`/R:0 /W:0` 失敗不重試.**耗時取決於檔案數而非容量**(實測數百萬小檔約1小時,單檔大之 85 GB 約2分鐘).刪後依 §8.4 回驗.

#### (2) robocopy 與 Remove-Item 不可寫在同一道指令

Claude Code 之安全掃描會把同一指令內 robocopy 之參數(`/MIR`,`/E`)誤判為 `Remove-Item` 之目標路徑而攔截(`Remove-Item on system path '/MIR' is blocked.`;偶發,同一寫法有時可過).兩者一律分成兩道指令執行,且 robocopy 參數以陣列(`@rcArgs`)傳遞.

#### (3) 覆蓋部署用 `/E`,`/MIR` 只用於[目標須與來源完全一致]

`/E` 為疊加複製;`/MIR` 會**刪除目標端多出之檔案**.目標目錄同時放有資料(程式碼與資料目錄並存之專案根、使用者上傳區)時以 `/MIR` 部署,等同刪光資料.`/MIR` 只用於鏡像空目錄清空((1))或確定要整個取代之子目錄.

#### (4) 離開碼非 0 不代表失敗,須依各指令之語意判讀

| 指令 | 回傳 | 判讀 |
|---|---|---|
| `robocopy` | **0~7 皆為正常** | 1=有複製,2=目標有多餘檔案(`/MIR` 清空時之常見值),3=1+2;**≥8 才是錯誤**,寫 `if ($LASTEXITCODE -ge 8) { 失敗 }`,不可用 `-ne 0` |
| `findstr` | 無符合時回 1 | 例:查埠占用查無結果 |
| PowerShell cmdlet 搭 `-ErrorAction SilentlyContinue` | 仍可能使工具回報 exit 1 | 須真正忽略時用 `try { … -ErrorAction Stop } catch {}` |

判定成敗看實際輸出與產物,不只看離開碼.

## 9. 版本控制(Git)

**觸發**:使用者要求 commit 時.平時一律不要詢問是否 commit;使用者需要時會自行說執行全部或部份 commit.

**[全部commit]一律單一 commit,不主動依議題拆分**:`git add` 全部後單一 commit,message 用多段 bullet 涵蓋所有議題.例外:使用者明確說[分開/拆/按議題]才分.why:使用者要的是[動詞 commit + 受詞全部],自作主張拆分＝擅自加工指令.

## 10. 規格 Spec

**觸發**:從 spec 衍生 predicate/實作/文件;spec 有歧義或缺漏;實作、實測、產圖或撰寫手冊時發現與 spec 不符;新寫、改寫、擴充、複審任何 spec(含 e2e 流程 spec 之 `E2E-NNN` 案例、〈已知落差〉、待裁示,以及因 e2e 實作/標準圖產製/手冊產製/產品修復而回頭修 spec);撰寫流程文件,設計文件,呼叫鏈文件(trace 某函式,為 spec API event 產出 markdown 規格).命中即先調用 skill[role-coder-for-spec].

## 11. 測試

**觸發**:寫、改、審、拆、移除、重構任何測試;新增測試檔或盤查 test 目錄;產或重產 baseline;設定 `package.json` 之 test script、runner 或 port;跑測試;產製測試/樣本/示範數據.命中即先調用 skill[role-coder-for-test];凡接觸 e2e 測試檔(檔名含 `e2e-`)——寫/改/審/拆/移除/重構/完整度盤查/flake 排查/標準圖(pixel baseline)產製,比對或重產——另加調用 skill[role-coder-for-test-e2e].測試全綠只證明回歸未壞;宣告完成依 §12.

## 12. 回報誠實性

**觸發**:所有任務回報.

- 寫[全盤/完整/所有/全部檢查]之前,回報內必附輸入空間表或其統計(軸、格數、已測/刻意允許/已知不修/未填各幾格;表的作法見 skill[role-coder-for-validate]);沒有表不得用這些詞.只做了部分就寫[部分:做了 X,未做 Y].
- 回報[完成]須通過完成判準:改程式依 skill[role-coder-for-validate],寫報告或文件依 skill[role-writer-validate];缺項要明寫缺哪一項.
- 自身失敗之歸因先找自己:被指出反覆失敗時,第一段先寫自己流程漏做了哪一步;環境因素(工具,沙箱,context 壓縮,缺文件)只能列為次因,並回答[即使沒有該環境因素,我是否仍會失敗?].

## 13. 全域技能與全域設定之通報

**觸發**:發現全域技能(`~/.claude/skills/<技能名>`)或本檔(全域設定)有誤、過時、不足,或需要新增技能時.

1. 不要直接修改 `~/.claude/skills` 或 `~/.claude/CLAUDE.md`:兩者為同步產物,原稿在`自有ai全域技能與設定庫`(GitHub `https://github.com/yuda-lyu/w-data-aisetting`),下次同步即被覆蓋.

2. 與自有套件同一管道(§5.2),先至:
http://100.120.70.67:3000/semi/opensrcOper
並閱讀其內`通知方請用gitea.md`之「AI設定庫」線,確認後再以發 issue 傳遞需求——標題須用 `建議全域技能{技能名}修正/調整:`、`建議新增全域技能{技能名}:` 或 `建議全域設定修正/調整:`,使主控能與自有套件之建議區分;主控agent會輪詢並待接收,修改原稿並推上 GitHub 後,使用者再於各電腦執行 `sync.bat` 同步.

3. 只屬單一專案之要求寫進該專案之 `CLAUDE.md`,不要提到全域;自有套件之問題依 §5.2.

## 14. 專案/套件之指引要求文件(sgud)

**觸發**:接手或接續專案/套件之工作;撰寫或更新其經驗、處理要點、規則帳本、狀態類文件.

**why**:程式碼是強約束的檢查與執行軌跡,提示詞是弱約束的原則與要點;指引要求類文字集中於固定位置並納入版控,才能追蹤其演變、避免散落與重複讀取浪費 token.

- **配置**:專案/套件根目錄之 `CLAUDE.md`(進入點,自動載入)＋ `./sgud/`:

| 類 | 檔 | 內容 |
|---|---|---|
| 經驗 | `sgud/exp/experience.md` | 執行時之累積經驗,留給後續嘗試、執行、判斷 |
| 處理要點 | `sgud/proc/process.md` | 業務端之特化要求與其處理流程 |
| 規則帳本 | `sgud/rule/rulebook.md` | **藍圖**:以規則為單位記程式碼須長成什麼樣,附盤點指令、站點全集與判準,或由規格產出之測試清單 |
| 狀態 | `sgud/state/state.md` | **現況**:當前已開發功能之最新狀態(各功能做到哪裡、對應之規則帳本條目與測試檔、已知缺口與待辦、最近一次驗證或發布之版本);與規則帳本比對即知尚未做到者 |

- **舊制對應**:根目錄之 `CLAUDE_experience.md`、`CLAUDE_process.md`、`CLAUDE_rulebook.md`、`CLAUDE_state.md` 依序對應上表四檔.遇舊制者照其現有位置讀寫,不自行遷移;遷移由該專案之主控或使用者安排(自有套件由 opensrcOper 主控於該套件下次更新時遷移).
- **接續工作先讀 `state.md`**,不必翻經驗檔;完成一項功能或結束一輪工作時即更新 `state.md`.**只記現況、不寫過程**(過程寫入經驗).
- **過長即整理**(判準:不好找、或整份讀入太浪費 token;約 30KB 以上即應考慮):
  - 經驗:把舊經驗抽出為 `experience_<年月日>.md`,`experience.md` 註明何時抽出至哪檔;需要久遠經驗時再調閱.
  - 處理要點、規則帳本:依類型拆為 `process_<類型>.md`、`rulebook_<類型>.md`(類型依專案自訂),主檔只留「哪類查哪檔」之索引.
  - 狀態:依功能類型拆為 `state_<類型>.md`,`state.md` 只留索引.
  - 整理時節號與標題不變,既有引用才對得上;不刪內容,只搬移.
- **版控與發布**:**只有 `sgud/` 納入 git 版控**;`CLAUDE.md`(給 agent 之進入點)與 `CLAUDE_settings.md` 等 `CLAUDE*.md` **維持不入版控**——`.gitignore` 保留 `CLAUDE*.md`,**不得加 `!CLAUDE.md`**,也不得排除 `sgud`.`sgud/` 不入 npm 包(`.npmignore` 列 `CLAUDE*.md` 與 `sgud`;原無 `.npmignore` 者以原 `.gitignore` 內容為底建立,維持既有打包範圍).repo 為公開庫時,`sgud/` 內容不得含金鑰、權杖、內網位址或帳號資訊.
