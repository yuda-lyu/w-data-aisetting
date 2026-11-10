---
name: role-command-windows
description: |
  Windows 上執行指令、組路徑、管理程序與大量檔案之規範(由全域設定抽出):Windows PowerShell 5.1 之已知雷區、.bat 含中文一律 Big5;路徑與檔案 I/O(cwd-relative 與 fileURLToPath 兩種出檔場景、禁用 URL.pathname、git-bash 之 /c/ 路徑不可交給原生程式或 node、寫入前印絕對路徑驗收);Git Bash 下 taskkill 寫法與取 PID(wmic 已移除);刪除／殺程序／重啟後必回驗(只殺到在監聽者、memory-mapped 檔之舊映射、健康檢查分不出新舊實例);背景 Chrome(playwright／puppeteer)孤兒程序之三層回收;大量檔案以 robocopy 鏡像空目錄刪除、目錄連結先拆再刪(robocopy 會穿過 junction)、robocopy 與 Remove-Item 分兩道指令、/E 與 /MIR 之分、離開碼判讀表;背景行程再起之子行程一律 windowsHide.
  觸發條件:Windows 上殺程序或取 PID;刪除或複製數萬以上檔案、刪除可能含目錄連結之目錄(含清 ./tmp)、以 robocopy 部署或覆蓋目錄、判讀 Windows 指令之離開碼;以 node 調用 chrome/chromium 背景繪圖或截圖且涉及常駐服務、排程重啟或清殘留;撰寫或修改會以背景方式(detached、nohup、排程、常駐服務)執行且會再起子行程之腳本;寫 .bat;只有 Windows PowerShell 5.1 之環境;組裝路徑而工作目錄含空格、中文或須在 git-bash 與原生程式之間傳遞——必先調用本技能,整篇入 context 逐項比對後才動工.
---

# role-command-windows — Windows 之指令、路徑、程序與大量檔案操作

本技能由全域設定抽出(2026-11-10,原全域 §2.2 之 PowerShell 5.1 與 bat、§3 之連結拆除、§7、§8.3、§8.4、§8.6、§8.7、§8.8).全域設定只留觸發與必記原則,細節與殷鑑在此.

## 依任務找章節

| 任務 | 章節 |
|---|---|
| 只有 Windows PowerShell 5.1 之環境;寫 `.bat` | §1 |
| 組裝路徑、寫檔、在 git-bash 與原生程式／node 之間傳路徑 | §2 |
| 殺程序、取 PID | §3 |
| 刪除、殺程序、重啟服務之後 | §4 |
| node 調用 chrome 背景繪圖或截圖之常駐服務、清 chrome 殘留 | §5 |
| 大量刪除或複製、含目錄連結之目錄(含清 `./tmp`)、robocopy 部署、離開碼 | §6 |
| 背景執行之腳本再起子行程 | §7 |

## 1. 殼層:Windows PowerShell 5.1 與 `.bat`

- **環境只有 Windows PowerShell 5.1 時**(如 Windows Server 之維運)之已知雷區:①`ConvertFrom-Json` 解析含中文之內容(如 pino JSONL log)會失敗(`Unterminated string passed in`,主控台編碼所致),改以正則抓欄位:`if ($line -match '"msg":"([^"]*)"') { $msg = $Matches[1] }`;②`Select-String` 之結果不能直接 `-split`,須先 `.ToString()`:`($line.ToString() -split '│')[6]`;③無 `&&`,`||`,三元運算子,`??`;④對原生執行檔避免 `2>&1`(會產生 NativeCommandError 並使 `$?` 為 false).離開碼之判讀見 §6(4).
- **bat**:寫`.bat`注意含中文一律 Big5(cp950)編碼:cmd.exe 用系統 codepage 解析,UTF-8 各種 workaround(BOM,`chcp 65001`)實測都壞.不要默默把現有 Big5 .bat 重存成 UTF-8.

## 2. 路徑與檔案 I/O

### 2.1 兩種出檔場景

- **場景 A:輸出落在使用者工作路徑**(測試暫存,報告,腳本產物)→ 用 cwd-relative(`./tmp/foo.json`).絕不用 `fileURLToPath(import.meta.url)`——套件被 install 後輸出會落到 `node_modules/<pkg>/`,搬動腳本時輸出位置悄悄改變.
- **場景 B:輸出落在腳本/模組所在資料夾**(套件自帶 user_data)→ 用 `fileURLToPath(import.meta.url)` + `dirname` + `join`.

### 2.2 永遠不要用 `new URL(import.meta.url).pathname` 取路徑

`pathname` 回 URL-encoded 字串:空格變 `%20`,中文變 `%E9%96%8B...`,Windows 多 leading `/D:/`,fs 會把這些字面字元當實體資料夾名建立(踩過:D 槽根目錄建出多層 `%20%E9...` 垃圾資料夾).URL → 實體路徑只有 `fileURLToPath()` 一條路,且僅場景 B 用.

### 2.3 git-bash 的 POSIX 路徑(`/d/...`,`/c/...`)絕不可跨界傳給 Windows 原生程式或 node

[`/d/` = D 槽]映射只存在 git-bash shell 內部.把這種字串交給 Windows 原生 exe 或 node 的 path/fs,開頭 `/` 被當[當前磁碟根]:`/d/tmp/x` → `D:\d\tmp\x`(多一層 d),`/c/Users/x` → `D:\c\Users\x`(磁碟機都錯).邊界判別:路徑字串最後是誰解析——Bash 工具內 `mkdir /d/tmp/...` 對;寫進 `.mjs` 再交給 spawn / `launchPersistentContext` / node fs 就錯.改用帶磁碟機代號路徑(`D:/tmp/x`)或從 `fileURLToPath` 衍生.

### 2.4 寫入前驗收

路徑經組裝(join,replace,URL 轉換)後,fs 操作前先 `console.log(path.resolve(...))` 印 absolute 路徑驗收;寫入後 `ls` 確認落點;發現孤兒資料夾立刻徵求允許後刪除.警覺訊號:工作目錄含空格,中文/非 ASCII,Windows `D:\...`——任一符合就雙倍仔細.

## 3. Windows / Git Bash 下 `taskkill` 與取 PID

- `taskkill /F /PID <pid>` 在 Git Bash 會失敗(bash 把 `/F` 當路徑).正確:`cmd //c "taskkill /F /PID <pid> /T"`(雙斜線避免 bash path 翻譯).取 PID:`netstat -ano | grep ":<port> " | grep LISTENING | awk '{print $5}' | head -1`.
- **取 PID 勿依賴 wmic**:Windows 11 已移除 wmic,靠 wmic 撈 PID 會回空輸出且不報錯(看似成功實未殺,程序續佔資源).改用 tasklist(需比對 CommandLine 時用 PowerShell `Get-CimInstance Win32_Process`)取 PID 逐一 `taskkill /F /T`,殺後必回驗(見 §4).
- 何時可主動 taskkill:專案`CLAUDE.md`明確授權或使用者明確要求,否則先回報.

## 4. 刪除 / 殺程序 / 重啟後必「回驗」成功(勿假設)

kill 與 rm 皆**不保證成功**,執行後必回頭驗證,不可假設已成功:

- **殺程序**:taskkill 後再 `netstat`/`tasklist` 確認該 PID **已消失,埠已釋放**.用埠號抓 PID 只殺得到「當下在監聽」者——卡住/未監聽之舊實例會漏殺.
- **刪檔/資料夾**:`rm -rf` 後以 `[ -d 夾 ]`/`ls` 確認**真的沒了**(rm 可能因鎖定/權限靜默失敗;Windows 下數萬檔以上之刪法見 §6).Windows 下對 memory-mapped 檔(如 LMDB `.mdb`)之 rm 會移除目錄名,但**行程仍持有舊檔映射**,存活之舊程序會無聲**續用舊資料**(假象「刪了,重建了」).
- **重啟服務**:健康檢查(如 `curl → 200`/ping)**無法分辨新舊實例**——存活之舊實例照樣回應,據此判定「重啟成功」是假陽性.通用判準是**確認新行程確實是當前提供服務者**:`netstat -ano`/`lsof -i` 查監聽該埠之 PID,須等於**你本次啟動的行程 PID**(或至少舊 PID 已消失,且出現一個新監聽 PID);並檢查新行程之輸出/log **無綁定失敗**(埠被占用類錯誤,各語言字樣不一,如 `EADDRINUSE`/`address already in use`/`bind: 已使用`).否則新實例常因埠被舊實例占用而**啟動即失敗退出**,舊實例續服務舊狀態(現象:「重啟了但狀態沒變/吃到舊快取」).服務專屬的「已啟動」log 字樣屬各專案細節,記於該專案設定而非此處.

## 5. Windows 背景 Chrome(playwright/puppeteer)程序回收

**觸發**:任何專案以 node 調用 chrome/chromium 背景繪圖或截圖(playwright、puppeteer、w-html2png 系),涉及常駐服務、排程重啟、或需清理 chrome 殘留時.

**成因**:Windows 上 playwright 以 non-detached spawn 瀏覽器且不用 Job Object,清理只掛在 node 的 exit/signal handler——node 被 **TerminateProcess**(`taskkill /F`、崩潰、OOM)時 handler 全不執行,chrome 整樹孤兒化,服務自動重啟則逐次疊加.`--remote-debugging-pipe` 斷線自關是**盡力而為非保證**(重載/卡頓機器實測不會自關),不能當防線;上游無解也不會修,須自建回收.

**回收三層**:①**啟動自掃**——常駐服務埠綁定成功後(證明無其他實例服役),查 chrome.exe 之 ExecutablePath(**限定自家瀏覽器路徑**,避免誤殺使用者瀏覽器)且**父行程已死**者,樹狀殺;②**看門狗掃已停止(stopped)之 chrome**——卡死者用一般枚舉或年齡判準看不出來,須以 `w-process-status` 之 `WProcessStatus('chrome.exe')` 查 `status==='stopped'` 才找得到,交叉自家路徑後樹狀殺;③**關閉走 tree-kill**——用 `wsemi` 之 `execProcessKillPid`(Windows 內部即 `taskkill /pid X /T /F`),**不可用 `child.kill()`**(Windows 下等同 TerminateProcess 且只殺 node 本身).

**鐵則**:①殺 chrome 必殺 root 帶 `/T`,逐個殺 renderer 無效(孤兒主程序會立即補生);②判準用[歸屬(父死)+健康(stopped)],**絕不用年齡**——常駐瀏覽器持續有請求時合法活數天,年齡判準會週期性處決健康現任;③`HandleCount=0` 之終止中卡死殭屍任何工具都殺不掉(回報[查無執行中實例]),屬 OS 層狀態,殺掉 root 後不增生即可接受,重開機歸零.

## 6. Windows 大量檔案操作(robocopy)、目錄連結與離開碼判讀

**觸發**:Windows 下刪除或複製大量檔案(數萬以上),刪除可能含目錄連結(junction/symlink)之目錄(含清 `./tmp/`),以 robocopy 部署/覆蓋目錄,或判讀 Windows 指令之離開碼時.

### (1) 大量刪檔:robocopy 鏡像空目錄清空,再刪空目錄

**不用檔案總管或 `Remove-Item -Recurse` 刪大量檔案**.檔案總管會先在記憶體建完整項目清單(數百萬筆約佔 3 GB),按[取消]後卡在[正在取消]且速度歸零、無法中止,只能結束 explorer.exe.**典型錯誤形狀**:以檔案總管刪一個數百萬小檔之資料目錄,取消不了也刪不完.

```powershell
$empty = '<專案根>\tmp\__empty__'
New-Item -ItemType Directory -Force $empty | Out-Null
$rcArgs = @('/MIR','/MT:32','/NFL','/NDL','/NJH','/NJS','/NC','/NS','/R:0','/W:0')
& robocopy $empty $target @rcArgs | Out-Null
# 另一道指令(見(2)): 刪除已清空之目錄
Remove-Item -LiteralPath $target -Recurse -Force -Confirm:$false
```

`/MT:32` 多執行緒;`/NFL /NDL /NJH /NJS /NC /NS` 關閉輸出(印檔名會大幅拖慢);`/R:0 /W:0` 失敗不重試.**耗時取決於檔案數而非容量**(實測數百萬小檔約1小時,單檔大之 85 GB 約2分鐘).刪後依 §4 回驗.

**目標內有目錄連結時,先拆連結再刪,不可直接用此法**:robocopy 鏡像會穿過 junction,把連結目標(他處之真實目錄)之內容一併刪光,加 `/XJ`、`/XJD` 亦同(實測 4 次皆然).動手前先以**不跟進連結**之方式列出連結——node 遞迴 `readdirSync` 配 `lstatSync().isSymbolicLink()`,遇連結不往下走;**不可用 `dir /AL /S`**,它同樣穿過連結,會列出連結目標內部之連結,照該清單拆會拆到原專案——逐一以 `rmdir <連結>`(目錄連結;Git Bash 內寫 `cmd //c rmdir <連結>`,只拆連結、不動目標)或刪除連結檔本身拆除,回驗連結目標完好,再刪.Git Bash `rm -rf` 與 node `fs.rmSync(..., { recursive: true })` 實測不穿過 junction,但不以此為由略過先拆.清 `./tmp/`(或遞迴刪除任何目錄)前一律先做此檢查(如臨時副本之 `node_modules` 連回原專案).**典型錯誤形狀**:臨時副本之 `node_modules` 以 junction 連回原專案,結案時以鏡像空目錄法清 `./tmp`,原專案之 `node_modules` 被清空.

### (2) robocopy 與 Remove-Item 不可寫在同一道指令

Claude Code 之安全掃描會把同一指令內 robocopy 之參數(`/MIR`,`/E`)誤判為 `Remove-Item` 之目標路徑而攔截(`Remove-Item on system path '/MIR' is blocked.`;偶發,同一寫法有時可過).兩者一律分成兩道指令執行,且 robocopy 參數以陣列(`@rcArgs`)傳遞.

### (3) 覆蓋部署用 `/E`,`/MIR` 只用於[目標須與來源完全一致]

`/E` 為疊加複製;`/MIR` 會**刪除目標端多出之檔案**.目標目錄同時放有資料(程式碼與資料目錄並存之專案根、使用者上傳區)時以 `/MIR` 部署,等同刪光資料.`/MIR` 只用於鏡像空目錄清空((1))或確定要整個取代之子目錄.

### (4) 離開碼非 0 不代表失敗,須依各指令之語意判讀

| 指令 | 回傳 | 判讀 |
|---|---|---|
| `robocopy` | **0~7 皆為正常** | 1=有複製,2=目標有多餘檔案(`/MIR` 清空時之常見值),3=1+2;**≥8 才是錯誤**,寫 `if ($LASTEXITCODE -ge 8) { 失敗 }`,不可用 `-ne 0` |
| `findstr` | 無符合時回 1 | 例:查埠占用查無結果 |
| PowerShell cmdlet 搭 `-ErrorAction SilentlyContinue` | 仍可能使工具回報 exit 1 | 須真正忽略時用 `try { … -ErrorAction Stop } catch {}` |

判定成敗看實際輸出與產物,不只看離開碼.

## 7. Windows 背景行程再起之子行程一律隱藏視窗

**觸發**:撰寫或修改會以背景方式執行(detached、`nohup`、排程、常駐服務)之腳本,且該腳本會再起子行程(`spawn`、`spawnSync`、`exec`、`execFile`、`fork`)時.

- **鐵則**:Windows 上,以 detached 起之 node 行程沒有主控台;它再起之每個子行程若未設 `windowsHide: true`,系統即為該子行程開一個新的終端機視窗(Windows 11 預設為 Windows Terminal,標題為該執行檔之路徑),每起一次跳一次,干擾正在使用機器之人.故凡可能在背景執行之腳本,其**每一處**起子行程之呼叫皆設 `windowsHide: true`,不論子行程是否會再起孫行程;起背景行程本身亦同.
- 只把最外層行程設 `windowsHide` 不夠:隱藏的是它自己的視窗,不會傳給它再起之子行程.有主控台之子行程(如經 `powershell`、`cmd` 起者)之孫行程沿用其(隱藏之)主控台,不另開視窗;沒有主控台者才會跳.
- **驗收**:背景行程跑起來後,以 `Get-Process | Where-Object { $_.MainWindowHandle -ne 0 }` 查無新出現之 `WindowsTerminal`／`cmd`／`conhost`／`node` 視窗,且在其起子行程之時點過後再查一次.
- **典型錯誤形狀**:跟跑測試之背景行程以 `spawnSync` 起測試執行器而未設 `windowsHide`,每輪測試即跳出標題為 `node.exe` 之終端機視窗;由前景 shell 起時有主控台而看不出來,改為 detached 起之後才發作.

## 完成前勾選

- [ ] 殺程序、刪除、重啟之後已回驗(§4),未以健康檢查代替「新行程即服務者」之確認
- [ ] 刪除含目錄連結之目錄前已以不跟進連結之方式列出並拆除,回驗連結目標完好(§6(1))
- [ ] robocopy 與 Remove-Item 分兩道指令;離開碼依 §6(4) 判讀
- [ ] 背景腳本之每一處起子行程皆設 `windowsHide: true`,並已以視窗清單驗收(§7)
- [ ] 交給原生程式或 node 之路徑皆為帶磁碟機代號之形式,寫入前已印絕對路徑(§2)
