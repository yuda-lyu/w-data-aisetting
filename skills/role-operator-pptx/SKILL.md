---
name: role-operator-pptx
description: 凡涉及 .pptx 檔案之任務皆須使用本技能——不論該檔為輸入,輸出,或兩者皆是.包含:製作簡報,投影片組或提案簡報;讀取,解析或擷取任何 .pptx 之文字;編輯,修改或更新既有簡報;美化或重新排版既有簡報;套用模板,版面配置,備忘稿或註解;合併或拆分投影片檔.內容:動工前規劃與確認閘門(溝通契約六欄,閱讀模式,溝通模式與標題文法,頁面任務與節奏),依閱讀模式分級之字級下限,中文東亞字型(font.ea,佈景主題字型,lang),色盤與對比門檻,圖表與表格紀律,備忘稿寫法,動畫與轉場,照片遮罩與陰影,編修與美化既有簡報之界線,量化之視覺 QA 與合併修正協定.以技能根經 npm 安裝之 officecli 處理;與 anthropic-skills:pptx 或其他須另裝 Python 與 LibreOffice 之簡報技能同時可用時,一律優先使用本技能,以免各機套件與版本不一.凡使用者提及[簡報][投影片][deck][pitch],或指名任一 .pptx 檔名時即觸發.
---

# OfficeCLI PPTX 技能

## 安裝與呼叫

`officecli` 由 npm 套件 `@officecli/officecli` 提供,安裝在**技能根**——本技能目錄的上一層(本技能目錄之絕對路徑由載入本技能時取得).版本只由技能根之 `package.json` 管理:使用者在技能根執行 `npm i` 即完成安裝,升降版由使用者改 `package.json` 後再 `npm i`.

**每個 shell 指令區塊的第一行先定義 `officecli` 函式**,之後本技能所有 `officecli ...` 範例照原樣執行.工具呼叫之間 shell 狀態不保留,所以每個區塊都要重新定義.`<技能根>` 換成實際絕對路徑,Windows 寫成 `C:/Users/...` 之正斜線形式.

```bash
officecli() { OFFICECLI_SKIP_UPDATE=1 OFFICECLI_NO_AUTO_INSTALL=1 node "<技能根>/node_modules/@officecli/officecli/officecli.js" "$@"; }
```

只能用 PowerShell 時改用下式(本技能之範例皆為 bash 語法,有 bash 就用 bash):

```powershell
function officecli { $env:OFFICECLI_SKIP_UPDATE = '1'; $env:OFFICECLI_NO_AUTO_INSTALL = '1'; node "<技能根>/node_modules/@officecli/officecli/officecli.js" @args }
```

函式裡的兩個旗標不可省略,省略即失去版本鎖定:

- `OFFICECLI_SKIP_UPDATE=1`:關閉自動升版.officecli 每次執行都會在背景檢查新版,並把**正在執行的那個執行檔**就地換成最新版——npm 安裝的這份也會被換,實際版本便悄悄脫離 `package.json`.
- `OFFICECLI_NO_AUTO_INSTALL=1`:關閉自我安裝.不帶任何參數執行 `officecli` 時,它會把自己複製成全域版,寫入 PATH,並把官方技能裝進 `~/.claude/skills` 等各 agent 之技能目錄.

兩者之依據見文末〈CLI 機制〉之〈版本鎖定〉.

**不要做的事:**

- 不要在未定義函式時打裸指令 `officecli`:它走 PATH,可能命中另行安裝的全域版(版本不同,且每天自動升版),或根本找不到.
- 不要用官方安裝腳本(`install.sh` / `install.ps1`)或 `officecli install` 安裝,升級或修復:那會多出第二個版本來源.
- 找不到 `<技能根>/node_modules/@officecli/officecli/officecli.js` 時,回報使用者到技能根執行 `npm i`,不要自己另找地方安裝.

**每個工作階段第一次使用前驗證一次:**

```bash
officecli() { OFFICECLI_SKIP_UPDATE=1 OFFICECLI_NO_AUTO_INSTALL=1 node "<技能根>/node_modules/@officecli/officecli/officecli.js" "$@"; }
officecli --version
node -p "require('<技能根>/node_modules/@officecli/officecli/package.json').version"
```

兩行輸出之版本號須相同.首次執行會自動下載與套件版本相符的執行檔(數十 MB,需網路,自動比對 SHA256),之後離線可用;技能根 `npm i` 時出現 `install scripts blocked`(allowScripts)屬正常,不影響.版本號不同表示執行檔曾被未帶旗標的呼叫自動升版:停止並回報使用者兩個版本號;修復方式(經使用者同意後執行)是刪除 `<技能根>/node_modules/@officecli/officecli/vendor/` 再執行一次 `officecli --version`,即重新下載鎖定的版本.

## ⚠️ Help 優先鐵則

**本技能教的是[好的投影片長什麼樣], 不是每一個指令旗標.凡屬性名, 列舉值或別名不確定時, 一律先查 help, 不可用猜的.**

```bash
officecli help pptx                         # 列出所有 pptx 元素
officecli help pptx <element>               # 完整元素綱要(如 shape, chart, animation, connector, zoom, group)
officecli help pptx <verb> <element>        # 依動詞篩選(如 add shape, set slide)
officecli help pptx <element> --json        # 機器可讀綱要
```

help 反映已安裝之 CLI 版本.**技能與 help 衝突時, 以 help 為準**.應立即查 help 之觸發訊號:出現 `UNSUPPORTED props:` 警告, 未知之動畫預設值, `connector.shape=` 列舉漂移, 屬性與別名混淆(`lineWidth` vs `line.width`, `color` vs `font.color`).

## Shell 與執行紀律

**先定義函式.** 每個 shell 區塊的第一行定義 `officecli` 函式(見〈安裝與呼叫〉),以下所有指令都經由它執行;未定義時裸 `officecli` 會改走 PATH.

**Shell 引號(zsh / bash).** 元素路徑一律加引號(`"/slide[1]/..."`)——zsh 會把未加引號之 `[1]` glob 成 `no matches found`.跳脫分三層發生, 須分清楚(第二層 CLI 會幫你處理):

1. **Shell 層.** 值內之 `$` 仍屬 shell 管轄——整個值用單引號:`--prop text='$15M'`.雙引號之 `"$15M"` 會被展開成 `M`.CLI **不會**幫你還原 `\$`.
2. **CLI 層(`text=`).** 兩字元跳脫 `\n` 與 `\t` **會**被解讀, pptx / docx / xlsx 行為一致——`\n` 是換行 / 段落分隔, `\t` 是定位.要產生字面的反斜線 n 須寫兩次(`\\n`);這極少是你要的.
3. **JSON 層(batch heredoc).** 下方食譜以 `cat <<EOF | officecli batch` **未加引號**方式輸入, 使 `$SLIDE` / `$FILE` 可於內文展開.但同一個未加引號之 heredoc 也會展開值內之字面 `$`:`"$1.42"` 會無聲變成 `.42`, `"$2.4B"` 變成 `.4B`(`$1` / `$2` 是空的 shell 參數).**貨幣符號須跳脫為 `\$`**——`"text":"\$1.42"`——這樣 `$SLIDE` 仍可展開.JSON 內之 `\n` / `\t` 兩種寫法皆可.完全加引號之 `<<'EOF'` 會保護每個 `$`, 但 `$SLIDE` 就不會展開, 故僅在內文無 shell 變數時使用.寫入金額後, 以 `view text` 確認 `$` 有存活.

有疑慮時, 寫入後以 `view text` 逐字元比對.

**逐步執行.** 一條指令 → 檢查 exit code → 繼續.50 條指令之腳本若第 3 條失敗會無聲連鎖崩壞.任何結構性操作(新投影片, 圖表, 動畫, 連接線)後, 先 `get` 再往上疊.

## 標準工作流程

0. **先判任務型態.** 只讀或擷取 → 直接用〈讀取與分析〉.新建 → 依下列 1–8.修改既有簡報又保留其設計(改內容, 改部分頁, 補備忘稿或轉場)是**編修**;內容一字不改, 只重做版面是**美化**——兩者都先讀 [references/edit-existing-deck.md](references/edit-existing-deck.md) 再接 1–8.每一頁都要換新視覺或重新分頁, 則當成新建, 舊檔只是材料.
1. **開檔/存檔生命週期.** 開頭 `officecli open <file>`, 結尾 `officecli save <file>` 將編輯落地.`save` 只寫檔——保留常駐以利後續編輯;僅在要立即釋放常駐時(一次性交付)才用 `officecli close <file>`.兩者皆永遠安全——不會報錯或遺失工作.重複性圖形格線用 `batch`.**只在非 officecli 邊界才 flush:** officecli 自己的讀取一律看得到你的編輯;僅於非 officecli 程式要讀該檔前才 `save`/`close`(python-pptx, PowerPoint, 渲染器, 交付).
2. **先摸清狀況.** 新簡報:`officecli create "$FILE"`;中文簡報加 `--locale zh-TW` 並設佈景主題之東亞字型(見〈中文(東亞)文字〉).既有:先 `officecli view "$FILE" outline`, 並以 `officecli get "$FILE" /` 讀頁面尺寸——格線算術一律代入實際尺寸.**絕不盲目編輯**.
3. **規劃並取得確認(只規劃, 先別建).** 依〈規劃與確認〉定出溝通契約, 閱讀模式, 溝通模式, 頁數範圍, 以及完整且排序過的標題序列(每頁附頁面任務與節奏), 經使用者確認後才建立任何投影片或圖形.若有人**只讀標題**就跟不上論述, 現在就修正敘事弧——在清單階段修改遠比做完 14 頁後便宜.
4. **依展示順序建置.** 依聽眾觀看順序新增投影片:封面 → 議程 → 第一章分隔頁 → 第一章內容 → 第二章分隔頁 → … → 結尾.新增投影片時 `--index` 可用, 但線性追加會讓建置腳本更好讀, 也避開索引算術的錯誤.**最終交付前, 確認投影片數量與敘事弧符合你的建置計畫.** 關卡 3 的順序合理性檢查, 就是用來抓[封面跑到 14 頁中的第 11 頁]這種狀況.
5. **逐頁漸進.** 先建投影片 + 背景, 再標題, 再輔助圖形 / 圖表 / 連接線.自訂設計一律用 `layout=blank`.每個結構性操作後, 以 `get /slide[N] --depth 1` 確認 shape ID.超過 6 頁之簡報, 建完前 5 頁先跑一次關卡 2–3(早期關卡, 見 QA 之〈修正方式〉)再建後面的頁.
6. **依規格套格式.** 依產出要求表;格式是交付物, 不是美化.
7. **存檔 + 驗證.** `officecli save` 將檔案落地(或 `officecli close` 同時結束工作階段).交付前務必在目標簡報檢視器內開啟——圖表顏色, 動畫, 字型與 zoom 都是 `view html` 無法渲染的執行期功能.完整驗證見下方 QA.
8. **QA——預設一定有問題.** 修正並驗證, 直到某一輪找不到新問題為止.

## 規劃與確認(動工前)

頁數, 頁序, 字級與每頁的寫法都在這一步決定;做完 14 頁才發現受眾或用途搞錯, 只能整份重做.

### 溝通契約:六欄

能從使用者的需求與材料推得者直接填;推不出, 而且會改變頁面結構者才問.

| 欄位 | 要回答的問題 |
|---|---|
| 受眾 | 誰要接收這份簡報?他們已經知道什麼, 在乎什麼? |
| 目的 | 簡報要達成什麼?可以複合, 但要寫明先後 |
| 期望結果 | 聽完或讀完之後, 受眾要知道, 相信, 決定或做什麼? |
| 核心訊息 | 就算其他都忘了, 也必須留下的主張, 決策請求或行動 |
| 使用情境 | 講者帶讀, 自讀, 混合(誰為主), 或錄製自播;另有何次要用途與時間限制 |
| 會後去處 | 審批, 存檔, 轉寄, 交接, 再利用 |

**目的要落成大綱上的義務**——大綱裡要找得到下表右欄的東西, 找不到就是大綱缺頁:

| 目的 | 大綱必須讓受眾看到 |
|---|---|
| 告知 | 相關事實, 以及足以理解其重要性的脈絡 |
| 說明 | 機制, 關係, 因果或意義可被追溯 |
| 說服 | 主張 + 證據 + 重要的反對意見或替代方案 |
| 決策 | 明確的決策請求 + 選項 + 判準 + 取捨 + 延誤的後果 |
| 對齊 | 共同框架 + 優先順序 + 負責人 + 下一步 |
| 教學 | 前置知識 + 順序 + 實作應用或理解檢核 |
| 報告與交代 | 基準 + 進度 + 差異 + 證據 + 風險 + 負責人 |
| 動員 | 急迫性 + 受眾能做什麼 + 具體行動 + 立即的下一步 |
| 紀錄與交接 | 脈絡 + 決定 + 狀態 + 負責人 + 未決事項 + 可追溯的出處 |

### 閱讀模式

由使用情境與會後去處推定;它決定每頁的寫法, 頁數粒度, 備忘稿分工與字級下限(見〈產出品質要求〉).沒有特別線索時用一般商務.

| 模式 | 適用 | 每頁寫法 | 頁數與節奏 | 備忘稿 |
|---|---|---|---|---|
| 自讀/存檔 | 送審, 存檔, 會後轉寄, 非同步閱讀 | 完整的斷言, 短段落, 圖說, 表格與必要細節;只有真正並列或有序的項目才用條列 | 頁少而滿 | 補充脈絡, 不代替頁面上缺的邏輯 |
| 一般商務(預設) | 講者帶讀, 會後也會留存 | 一個主張 + 精簡說明, 結構化的證據或必要清單 | 中等粒度, 疏密交錯 | 詮釋與轉場 |
| 投影演講 | 大型會議室投影, 只靠講者 | 一頁一主張, 關鍵詞, 大圖或大數字;不放段落 | 頁多而疏 | 承載說明, 轉場與細節 |

### 溝通模式與標題文法

一份簡報只選一種溝通模式.它決定論證骨架與標題文法, 與視覺風格無關.

| 模式 | 適用 | 標題文法 | 頁面結構 |
|---|---|---|---|
| 結論先行 | 要受眾採納建議, 做出決定 | 斷言式:標題就是該頁的結論(如[EMEA 擴張使營收超標 12pp]) | 結論 → 支持論點 → 證據;資料頁附出處 |
| 敘事 | 要說服, 要引發認同 | 推進情節的節拍, 不是標籤 | 情境 → 衝突 → 解決;疏密依張力調配, 不機械交替 |
| 教學 | 訓練, 說明操作或概念 | 寫明該頁教什麼 | 由簡到繁, 前置先於依賴;一頁一個步驟, 同級概念結構平行 |
| 展示 | 產品發表, 成果展示 | 短而有畫面感 | 圖或數字領銜, 文字輔助;一頁一個大主張 |
| 彙報 | 中性而完整地告知(週報, 現況盤點) | 主題式名詞片語(如[Q3 各團隊人力]) | 同級項目同形同重, 可掃讀 |

容易混淆時:要受眾採納建議用結論先行, 只要完整告知用彙報;論點靠故事推進用敘事, 靠視覺臨場感用展示.選定後標題文法全篇一致, 絕不混用(見[文案要像人寫的]).使用者提供的大綱只當材料, 可以重組——除非他明說那就是最終頁序.

### 頁數, 標題序列, 頁面任務與節奏

- **頁數先給範圍**(如 10–12 頁), 確認後才定單一數字.確認過的頁序與頁數在建置中途不增刪合併——要改就回到本步驟重新確認.
- **標題序列每頁一行**:`P03 | <標題> | <頁面任務> | <節奏>`.頁面任務 = 這一頁要讓受眾知道, 相信或決定什麼.**說不出頁面任務的頁就是大綱缺陷**:刪掉或併頁, 不要拿裝飾補.
- **節奏標籤三種**:`錨點`(封面, 議程, 章節分隔, 結尾), `密集`(資訊密集的內容頁), `喘息`(低密度的停頓:一句大字主張, 一張滿版圖或一個大數字, 不放卡片格).資料密集的頁之後安排一頁喘息;章節入口要明顯重置版面.
- **封面**除定位資訊(見〈視覺交付底線〉)外, 要有一個具體的鉤子——最強的主張, 數字或衝突, 而不只是題目.
- **結尾**要有實質收束——結論, 決策請求或下一步行動;不放只有[Thank you]或只有聯絡資訊的頁.

### 確認閘門與快速模式

把以上整理成一則訊息交使用者確認:六欄摘要, 閱讀模式, 溝通模式, 頁數範圍, 標題序列(含頁面任務與節奏), 視覺方向(色盤, 字型, 母題).**沉默不算確認**;確認之前不建立任何投影片.

不走閘門的情形:

- 使用者說[直接做][快速][不用問] → 不問任何問題, 由你決定全部欄位, 交付時列出你做的決定.
- 使用者已給完整的大綱或規格 → 只確認缺漏的欄位.
- 只讀, 或小幅修改(改字, 改色, 補一頁) → 不需規劃.

## 產出品質要求

以下是每份簡報**必須**達到之交付標準.違反任一條即為未完成, 與內容品質無關.

### 所有簡報

**一頁一個概念.** 若某頁需要第二個標題才能說明它涵蓋什麼, 就該拆.密集的[關於 X 的一切]會在 3 秒內失去聽眾.要群組相關的單一概念頁請用章節分隔頁, 而不是做一張巨無霸投影片.

**明確的字級層級——絕不可依賴佈景主題預設.** 佈景主題預設會隨母片漂移.每個文字圖形都要明確設定字級.

| 元素 | 最小值 | 常用 | 圖形最小高度 |
|---|---|---|---|
| 投影片標題 | **≥ 36pt** 粗體 | 36–44pt | ≥ 2cm |
| 章節 / 副標 | ≥ 20pt | 20–24pt | ≥ 1.2cm |
| 內文 | **≥ 18pt** | 18–22pt | ≥ 1cm |
| 圖說 / 座標軸標籤 | ≥ 10pt 淡化 | 10–12pt | ≥ 0.6cm |

上表為**一般商務**模式(預設).其他閱讀模式(見〈規劃與確認〉)只調整內文與標題之下限, 其餘角色依同比例增減(副標約為內文之 1.2–1.5 倍):

| 閱讀模式 | 內文最小值 | 內文常用 | 標題最小值(內文下限 × 2) |
|---|---|---|---|
| 自讀/存檔 | **≥ 14pt** | 14–16pt | ≥ 28pt |
| 一般商務 | **≥ 18pt** | 18–22pt | ≥ 36pt |
| 投影演講 | **≥ 21pt** | 21–24pt | ≥ 42pt |

自讀/存檔與投影演講之數值, 取自以 1280×720 畫布量測之起始區間(18–21px 與 28–32px, 依 px × 0.75 換算為 pt), 以其下緣為下限.模式在規劃時確定, 不可為了塞進內容而臨時改模式.

經驗法則:**圖形最小高度 ≈ 字級pt × 0.05cm**.18pt 副標放在 0.8cm 高的框內會溢出——`view annotated` 抓得到.

標題必須是**內文的 2 倍以上**(36pt 對 20pt 可以;28pt 對 20pt 顯得畏縮).內文下限有四個正當例外:圖表座標軸標籤, 圖例, 頁尾 / 頁碼, 以及 ≤ 5 字之 KPI 副標(如 "Active users").描述性句子一律不低於該模式之內文下限.內文靠左對齊;只有標題與主視覺數字才置中.若[卡片放不下], 請減少卡片, 不要縮小字級.

**最多兩種字型, 一組色盤.** 一種標題字型 + 一種內文字型(如 Georgia + Calibri)——第三種*展示型*字體僅在大數字或封面主標可用, 前提是標題+內文那組維持不變.中文簡報之東亞字型另計:標題與內文各一種(常見為兩者同用微軟正黑體, 標題加粗), 不與拉丁字型合計(見〈中文(東亞)文字〉).一個主導品牌色(佔 60–70% 比重) + 一個輔助色 + 一個強調色.內文絕不可混用 4 種以上顏色.**設計原則章節內的色盤與字型配對是底線, 不是選單:**若使用者已給品牌色/字型或既有模板, 優先配合;否則那些具名組合是經過校準的種子——可自由混搭或另闢, 只要結果不比它們*差*且仍通過對比底線.

**每頁都要有一個非文字視覺元素——而且要能傳達資訊.** 圖形, 圖表, 圖示, 帶意義的漸層色帶, 而非裝飾.純項目符號的簡報與一份 Word 文件沒有區別.例外:純引文頁, 程式碼區塊, 單一彙總表格頁, 以及規劃中標為`喘息`的頁(一句大字主張或一個大數字搭配大量留白)——喘息頁不可連續兩頁.

**少即是多——每個元素都要有存在的理由.** 上一條視覺規則是防止項目符號牆, 不是給你塞滿的許可.不要用不傳達資訊的裝飾性數據, 圖示或填充章節灌水([data slop]).若某頁感覺空, 用版面與留白解決, 而不是憑空生內容——寧可縮減範圍, 也不要為了充版面而膨脹;較大的增補應提報而非擅自加入.

**改寫可以, 改內容不行.** 為了版面可改寫措辭, 精簡重複, 換呈現形式(散文, 條列, 關鍵詞);不得新增主張, 把內容搬到別頁, 或為了塞進版面而丟掉事實, 數值, 專有名詞與限定語.因果, 論證與敘事保留成句, 只有真正並列或有序的項目才用條列——[版面上好排]不是用條列的理由.**放不下時依序處置**:往空白處加大文字框 → 精簡措辭或換呈現形式 → 減少同頁元素或拆頁(拆頁會改變確認過的頁數, 先回報);**不以縮小字級解決**.

**每張內容頁都要有備忘稿.** `--type notes --prop text="..."`.講者需要腳本;聽眾不該逐字讀投影片.寫法:

- **依完成後的頁面寫, 不憑大綱.** 逐頁看最終頁面, 盤點標題與每個承載資訊的元素;每個獨立的主張, 證據, 例子與限定語都要講到, 不只念出標籤.
- **口語散文.** 不用條列符號, 舞台指示(如[停頓][點下一頁]), 重點標籤或時長行;不說[這張卡片顯示…], 不講位置, 顏色與圖示.依觀看順序串成一條論證:主張 → 證據或機制 → 意涵或過渡到下一頁.
- **長度跟著內容走.** 內容頁常見 2–5 句(不是上限), 封面, 章節與結尾 1–2 句;不為湊時間而灌水或重複.
- **圖表, 表格, KPI** 講結論, 決定性數值或趨勢, 比較基準與意涵, 不逐軸逐列念.
- **依閱讀模式分工**:自讀/存檔補充脈絡;一般商務詮釋主張與證據, 交代取捨與轉場;投影演講承載頁面刻意省略的推理與細節.頁面上必要的內容, 不可假設備忘稿會補.
- 授權與版權文字不放進備忘稿.備忘稿若要轉成語音朗讀, 數字與符號寫成口語(如[百分之六十八]而非[68%]).

**文案要像人寫的, 不像 AI.** 標題要點出內容, 不是說俏皮話.不要[不是 X, 而是 Y], 不要製造張力, 不要假洞見([魔法時刻]), 不要一詞戲劇化([氣勢.]).砍掉浮誇形容詞(無縫, 強健, 顛覆性)——讓數字自己說話.

**保留既有模板.** 檔案已有佈景主題與母片時要配合它們.既有慣例優先於本指引.編修與美化既有簡報之界線見 [references/edit-existing-deck.md](references/edit-existing-deck.md).

### 視覺交付底線(適用於每一份簡報)

宣告完成前, 逐頁渲染結果(見 QA)**必須**滿足:

- **不可有佔位符被當成內容渲染.** `{{name}}`, `$fy$24`, `<TODO>`, `lorem`, `xxxx`, 圖表標題內之空 `()`/`[]` 皆不得出現.
- **不可溢出頁面邊緣, 圖形內文字不可被截斷.** `view issues` 兩者都會標記(`shape_off_slide` + 文字容納提示).修正截斷:加大文字框或縮短內容值——**絕不可為了塞得下而刪內容**.
- **封面須帶齊定位資訊.** 主標 + 副標 + 報告者/客戶 + 日期 + 品牌色帶或關鍵結論帶——只有標題的封面讀起來像半成品.其周圍仍應大量留白;豐富 ≠ 擁擠.
- **對比.** 小字(< 18pt)之文字與其背景對比須 ≥ 4.5:1, 大字(≥ 18pt)≥ 3:1——計算式見 QA.`view issues` 會自動標記常見狀況——不透明深色文字疊在圖形自身之深色填色上(`low_contrast`).它看不到其餘部分:圖示 / 圖表系列填色, 配色方案或繼承而來的顏色, 以及疊在*另一個*背景圖形上的文字.故凡亮度 < 30% 之填色(`1E2761`, `36454F`, 深森林 / 莓果 / 櫻桃), 仍須逐一確認每個內文 run, 卡片內文, 圖表系列與圖示為 `FFFFFF` 或亮度 > 80%——中灰(`6B7B8D` ≈ 44%)在筆電上看得到, 投影出來會消失.深色填色套完後以 `view html` 抽查.

任一項不過, **停下來修好再宣告完成**.

## 設計原則

簡報不是文件.聽眾只有 3 秒理解每一頁.加任何東西前先自問:[若聽眾只讀最大的那個元素並掃一眼, 他們抓得到重點嗎?]如果非得讀項目符號才懂, 就是最大的那個元素選錯了.

### 格線, 邊界, 留白

新建簡報預設為寬螢幕 **33.87 × 19.05cm**(960 × 540pt).編修既有簡報以 `officecli get "$FILE" /` 讀回之 `slideWidth` / `slideHeight` 為準(讀回單位為 pt;cm = pt × 0.03528;4:3 為 25.4 × 19.05cm), 下方公式一律代入實際頁寬.內部視為 12 欄格線:

- **邊界 ≥ 1.27cm**(0.5")四周皆是.
- **區塊間距 ≥ 0.76cm**(0.3")於卡片 / 欄 / 列之間——挑一個值(0.76 或 1.27cm)全篇統一;間距混用看起來就是沒完工.
- **每頁留白 ≥ 20%.** 填滿每個像素讀起來就是業餘.
- **要構圖, 不要網頁式置中.** 留白是結構性的:上半部承重, 下三分之一留空是正確構圖, 不是空洞的缺陷.刻意的不對稱(內容靠左, 右側留呼吸空間)比什麼都置中更有設計感——不要只因為有空隙就去填它.
- 卡片格線:`可用寬 = 頁寬 − 2·邊界 − (N−1)·間距`, 再 `欄寬 = 可用寬 / N`.不要手挑 x 座標.
- 4:3 或直式頁面上, 文字欄寬不足約 13.8cm 時, 圖文改為上下堆疊, 不左右並排.

### 字型配對

依文件語域配對, 而非追求新奇.[最適用]是提示不是命令;表外的配對只要合適就可以——這 8 組是種子, 不是全集.

| 標題 | 內文 | 最適用 |
|---|---|---|
| Georgia | Calibri | 正式商務, 財務, 高階報告 |
| Arial Black | Arial | 強勢行銷, 產品發表 |
| Calibri | Calibri Light | 乾淨企業風, 極簡設計 |
| Cambria | Calibri | 傳統專業, 法律, 學術 |
| Trebuchet MS | Calibri | 親和科技, 新創, SaaS |
| Impact | Arial | 強勢標題, 活動簡報, 主題演講 |
| Palatino | Garamond | 優雅編輯風, 精品, 非營利 |
| Consolas | Calibri | 開發者工具, 技術 / 工程 |

兩種字型都要在每個圖形上明確設定(標題 `--prop font=Georgia`, 內文 `--prop font=Calibri`), 不可靠佈景主題繼承;中文另設 `font.ea`(見下節).**Georgia 為舊式數字**(數字高低不齊):大數字, 表格與圖表裡的數字改用 Cambria, Calibri 等齊線數字字型, Georgia 只用於標題文字.

### 中文(東亞)文字

文字圖形的字型分拉丁與東亞兩個槽.**只寫 `--prop font=Georgia` 會把東亞槽也設成 Georgia**——Georgia 沒有中文字形, 中文改由 PowerPoint 自行替代, 結果因機器而異.中文簡報三件事一次做齊:

1. **建檔帶語系.** `officecli create "$FILE" --locale zh-TW`.不帶時, 佈景主題之東亞字型依當機作業系統之語系決定, 換一台機器結果就不同.
2. **設佈景主題之東亞字型.** zh-TW 之預設為新細明體(襯線體, 不適合投影片):

    ```bash
    officecli set "$FILE" /theme --prop headingFont.ea="Microsoft JhengHei" --prop bodyFont.ea="Microsoft JhengHei"
    ```

3. **每個文字圖形明確設兩個槽與語言.** `--prop font=Calibri --prop font.ea="Microsoft JhengHei" --prop lang=zh-TW`.`lang` 寫在第一個 run;同一圖形有多個 run 時逐 run 設定.寫入後以 `get "<圖形路徑>/paragraph[1]/run[1]"` 確認讀回之 `font.ea` 與 `lang`.

| 用途 | 東亞字型(寫英文字型名) |
|---|---|
| 繁中無襯線(投影片預設) | `Microsoft JhengHei`(微軟正黑體) |
| 繁中襯線(正式公文風, 引文) | `PMingLiU`(新細明體), `DFKai-SB`(標楷體) |
| 簡中 | `Microsoft YaHei` |
| 日文 / 韓文 | `Yu Gothic` 或 `Meiryo` / `Malgun Gothic` |

- 一個角色只寫一個拉丁字型加一個東亞字型, 不寫備援清單.字型須是目標機器已安裝者, 不用只有作者機器才有的字型.
- 換行落在詞組或標點邊界, 避免最後一行只剩一個字——以調整框寬或在詞組邊界插入 `\n` 處理.
- 中文字距(`spacing`, 單位 pt)預設不動;超過字級之 5% 時降到 2% 以下.
- 截圖中的中文顯示成方框(豆腐字)時, 先查 `font.ea` 是否指向渲染機器上沒有的字型, 不要直接判為簡報缺陷.

### 顏色與對比

各欄意義:**Primary**(主導色——佔 60–70% 比重, 第一眼看到的顏色), **Secondary**(輔助色調), **Accent**(節制使用, 一次性強調), **Text**(淺色填色上之內文), **Muted**(圖說 / 座標軸標籤 / 頁尾), **Primary 上文字**(以 Primary 為填色時之文字色, 皆與 Primary 對比 ≥ 4.5:1).

| 主題 | Primary | Secondary | Accent | Text | Muted | Primary 上文字 |
|---|---|---|---|---|---|---|
| Coral Energy | `F96167` | `F9E795` | `2F3C7E` | `333333` | `817562` | `1A1A1A` |
| Midnight Executive | `1E2761` | `CADCFC` | `FFFFFF` | `333333` | `5F76A4` | `FFFFFF` / `CADCFC` |
| Forest & Moss | `2C5F2D` | `97BC62` | `F5F5F5` | `2D2D2D` | `5F7E5F` | `FFFFFF` |
| Charcoal Minimal | `36454F` | `F2F2F2` | `212121` | `333333` | `687882` | `FFFFFF` / `F2F2F2` |
| Warm Terracotta | `B85042` | `E7E8D1` | `A7BEAE` | `3D2B2B` | `82726D` | `FFFFFF` |
| Berry & Cream | `6D2E46` | `A26769` | `ECE2D0` | `3D2233` | `8C6B7A` | `FFFFFF` |
| Ocean Gradient | `065A82` | `1C7293` | `21295C` | `2B3A4E` | `557994` | `FFFFFF` |
| Teal Trust | `028090` | `00A896` | `02C39A` | `2D3B3B` | `547D7D` | `FFFFFF` |
| Sage Calm | `84B59F` | `69A297` | `50808E` | `2D3D35` | `647C71` | `2D3D35` |
| Cherry Bold | `990011` | `FCF6F5` | `2F3C7E` | `333333` | `8B6B6B` | `FFFFFF` / `FCF6F5` |

依主題挑選, 不要用預設——財務適合 Midnight Executive, 產品發表適合 Coral Energy, 安全 / 停機掛牌適合 Cherry Bold.若最接近的具名主題還是不太對, 就混搭(如 Forest 主色 + 金色 `D4A843` 強調).淺色填色上之文字用 **Text**, 圖說 / 座標軸 / 頁尾用 **Muted**(表中 Muted 在白底皆 ≥ 4.5:1), Primary 填色上之文字用 **Primary 上文字** 欄之顏色——Secondary 只有出現在該欄時才可當文字色.混搭或另闢色盤時, 以 QA 之對比計算式確認同樣門檻.

深色背景上, 文字與圖表系列須遵守上方硬性規則之對比底線.

- **顏色不可獨自承載必要的區別.** 狀態, 類別, 正負要同時以標籤, 符號, 線型或位置區分;綠/紅只用於真有正負之分的指標.
- **陰影要克制.** 每頁最多 2–3 個真正浮起的物件(壓在照片或色塊上的卡片, 主要的行動按鈕);同級卡片格, 分隔線與內文容器保持扁平.`shadow=true` 之預設不透明度為 40%, 過重——改用複合寫法 `--prop shadow=000000-<模糊pt>-90-<距離pt>-<不透明度%>`:角度 90(正下方), 距離 3–6pt, 不透明度 6–10%, 最多 20%(如 `shadow=000000-8-90-4-10`).深色底上不用黑影, 改用淺色細框.

### 圖表選擇決策表

選錯圖表類型會直接毀掉 3 秒測試:

| 資料形態 | 用 | 避免 |
|---|---|---|
| 類別比較(A vs B vs C) | `column`(直) / `bar`(≥ 6 類別, 橫) | pie(切片糊在一起), line(無時間軸) |
| 時間序列, 1–3 條系列 | `line` | area(遮蔽), bar(暗示離散) |
| 部分對整體, 2–5 個切片 | `pie` / `doughnut` | 8 個以上切片之 pie(無法閱讀) |
| 相關性 / 分佈 | `scatter` | line(暗示有排序) |
| 多類別 × 多指標, 密集 | 堆疊 `column` 或熱區圖 | 每個指標一張圖——請合併 |
| KPI 快照(單一大數字) | **大字級文字圖形**(60–72pt + ≤ 5 字副標), **不是**圖表 | 儀表圖, 迷你長條圖 |

經驗法則:若系列 > 3 且類別 > 8, 拆成兩張圖或改用表格.

**圖表與表格之紀律:**

- **先分流.** 值的大小要以長度, 位置或角度比較 → 圖表;事實由[列標題 × 欄標題]共同定位 → 表格;順序, 層級, 歸屬等關係 → 圖形 + 連接線(見食譜 (c)(f)).
- **數值照資料, 不目測.** 圖表數值取自權威資料;不沿用範本的樣本值, 也不為了構圖改數據.
- **長條 / 直條自 0 起算**(`--prop axismin=0`);非零基線必須在圖上註明.
- **直接標值**(`--prop dataLabels=value`)勝過讓讀者對照座標軸;單一系列不放圖例(`--prop legend=none`).
- **雙軸**只在兩個系列共用同一時間或類別軸, 且單位與身分不會混淆時才用, 否則拆成兩張圖;可並排比較的子圖共用值域, 刻度與類別順序.
- **配色**:單色深淺優於彩虹;對照系列用主系列之淡色, 強調色只落在關鍵資料點;目標或平均值以灰色基準線標示.
- **表格**:數字靠右, 文字靠左;欄寬依內容, 不一律等寬;只用水平線, 不用滿格線;斑馬紋要極淡;不為了版面清爽而刪列, 欄, 小計, 註腳或單位.
- **虛構數據要標明.** 示範用的 KPI, 目標或比率, 在頁面上以可見文字標[情境數據], 備忘稿也說明是示意;外部事實在頁面或備忘稿註明出處.

### 動畫與轉場

依品牌與內容需要決定用多或用少——正式財務簡報趨近於零, 產品發表可以更外放.動畫是工具, 不是裝飾.三條底線防止它傷害簡報(沒有一條限制你用多少):

- **有目的**——每個動畫都要揭露或強調(漸進式項目揭示, 逐步堆疊之圖表), 絕不做裝飾.若無助於理解就砍掉.
- **優雅降級**——pptx 動畫在各檢視器(Keynote / Slides / 網頁 / 行動裝置)渲染不一致, 甚至可能完全不播放, 故每一頁都必須以*靜態*畫面就能讀懂.**絕不可把必要內容藏在揭示動畫後面**.
- **實機驗證**——動畫是執行期功能, `view html` 與截圖都看不到, 交付前務必在真實簡報檢視器內確認.

品味導引(非禁令):`fade` / `appear` / 單一 `zoom-entrance` 配俐落時長(數百毫秒)適合多數簡報;`bounce` / `swivel` / `spin` / `fly-from-edge` 以及密集的多物件編排通常顯得業餘——只有品牌刻意走活潑路線時才用.

**物件動畫預設不加**——每個動畫都要說得出職責:`進場`(首次出現), `強調`(已在畫面上的物件重新吸引注意), `移動`(軌跡本身有空間或因果意義), `退場`(同頁內讓位;換頁不需要退場).說明文字不可早於它所說明的物件出現;背景, 頁首頁尾, 頁碼與 logo 保持靜態.錄製自播或有旁白的簡報用接續觸發, 不用點擊觸發.

**轉場依相鄰兩頁的關係選**, 不為了變化而變化.轉場設在後一頁上(進入該頁時播放):

| 相鄰兩頁之關係 | 轉場 |
|---|---|
| 同一章節內延續(多數頁) | `transition=fade-400`(淡入 400ms) |
| 沒有連續性, 直接切換 | `transition=none` 或 `cut` |
| 有方向的步驟, 時間軸, 層次推進 | `push-left` / `wipe` 一類 |
| 同一物件或場景在兩頁間改變位置, 大小或狀態 | `morph` |
| 章節開場或關鍵揭露 | `split`, `reveal` 一類, 節制使用 |

**Morph** 是[兩頁的靜態差異即動畫]:複製前一頁(`add / --from "/slide[N]"`), 只改要變化的屬性, 再於後一頁設 `transition=morph`;兩頁都必須是完整可讀的靜態畫面.要做電影感 Morph 簡報, 改載 `morph-ppt` 技能(見文末〈更專門之技能〉).

### 版面模式與資料呈現

各頁版面要有變化——重複同一模式會讓每頁看起來都一樣.以下是常見組件, 非全集——每頁挑一種, 或在內容需要時另建表外版面:

| 模式 | 使用時機 | 關鍵尺寸 |
|---|---|---|
| **雙欄**(左文右圖) | 概念 + 佐證;功能 + 截圖 | 每欄約 14-15cm;間距 1cm |
| **圖示列**(填色圓內圖示 + 粗體標題 + 說明) | 功能清單, 效益, 團隊角色 | 圖示圓 1.5-2cm;最多 3-4 列 |
| **2×2 或 2×3 格線**(卡片) | 四象限分析, SWOT, 方案比較 | 間距 ≥ 0.76cm;卡片高度一致 |
| **半出血影像**(整個左半或右半, 另一側疊內容) | 主視覺時刻, 個案研究開場 | 影像寬 16-17cm;內容欄 ≥ 14cm |
| **大型數據標註**(60-72pt 數字 + 下方 ≤5 字副標) | 單一 KPI, 里程碑, 市場規模 | 用圖形, **不是**圖表;副標 14-16pt 淡化 |

**資料呈現快速規則:**
- 2-3 個選項時, 比較欄(前/後, A vs B)勝過表格.
- 時間軸與流程:用編號步驟圖形 + 連接線, 不要用項目符號清單.

### 影像處理(僅當該頁使用照片 / 截圖 / 標誌時)

**先讀那張圖**(開啟檔案)再依所見決定處理方式——不要只看檔名就盲目擺放.

- **全出血照片** → 尺寸設為 COVER 該區域(裁掉邊緣), 不加框.
- **截圖 / 圖解 / 標誌** → 尺寸設為 FIT(絕不裁切內容).透明或 fit 的影像要放在對比色填色上——後面墊一個色塊矩形, 不要讓它浮在白底上.
- **照片上放文字** → 絕不可直接壓在影像上.放在卡片上, 或只在文字所在的那一側鋪一塊半透明深色矩形(`--prop fill=000000 --prop opacity=0.55`, 約 50–60% 不透明度)——不要把整張照片均勻壓暗, 那會讓照片失去作用.`gradient=` 的色標不支援透明度(見〈常見陷阱〉), 不要用漸層做淡出遮罩.
- 絕不可拉伸(破壞長寬比);不要在雜亂的截圖上疊文字.
- 優先使用使用者提供之影像 / 品牌素材;除非被要求, 不用表情符號或自繪圖案.

### 視覺母題之貫徹

挑**一個**具辨識度的元素(圓角影像框, 填色圓內之章節編號, 單邊框帶, 對角強調條)並貫徹到每一頁——要整份簡報一致;只裝飾一頁而其餘素面, 讀起來就是做到一半.次要母題只有在不與主母題競爭時才可加.請先在建置計畫中宣告它:`## 母題: 品牌色填色圓內之編號`.

### 應避免之 AI 視覺破綻

- **標題下方不加裝飾性底線.** 標題下的橫線 / 分隔線是最常見的 AI 投影片破綻——改用留白或背景色變化.
- **不用[圓角卡片 + 左側彩色邊條].** 另一個經典 AI 破綻——改用實心填色, 頂部強調帶, 或留白區隔.
- **不用表情符號當圖示**, 除非品牌本身在用——改用圖形或真正的圖示素材.
- **不要每頁都是同一組對稱卡片格.** 沒有頁面任務支撐的重複等寬卡片是最常見的空洞版面;依資訊權重決定版面比例(如主證據與結論 7:3).

文案層級的破綻見[文案要像人寫的].

## 快速上手

最小可用簡報:封面 + 一張內容頁 + 備忘稿.`$FILE` 代表你的檔名.

```bash
FILE="deck.pptx"
officecli create "$FILE" --locale zh-TW
officecli open "$FILE"
officecli set "$FILE" /theme --prop headingFont.ea="Microsoft JhengHei" --prop bodyFont.ea="Microsoft JhengHei"

# 封面 — 深色填色, 置中標題
officecli add "$FILE" / --type slide --prop layout=blank --prop background=1E2761
officecli add "$FILE" /slide[1] --type shape --prop text="FY26 Strategic Review" \
  --prop x=2cm --prop y=7cm --prop width=29.87cm --prop height=3cm \
  --prop font=Georgia --prop size=44 --prop bold=true --prop color=FFFFFF --prop align=center

# 內容 — 白底, 標題 + 內文 + 備忘稿
officecli add "$FILE" / --type slide --prop layout=blank --prop background=FFFFFF
officecli add "$FILE" /slide[2] --type shape --prop text="Revenue grew 18% YoY" \
  --prop x=1.5cm --prop y=1.2cm --prop width=30cm --prop height=2cm \
  --prop font=Georgia --prop size=36 --prop bold=true --prop color=1E2761
officecli add "$FILE" /slide[2] --type shape --prop text="Enterprise renewals + new EMEA region drove the beat; NRR held at 118%." \
  --prop x=1.5cm --prop y=4cm --prop width=30cm --prop height=3cm \
  --prop font=Calibri --prop size=20 --prop color=333333
officecli add "$FILE" /slide[2] --type notes --prop text="Lead with the 18% beat, preview EMEA."

officecli save "$FILE"
officecli validate "$FILE"
```

每次建置的形狀都是:open → 佈景主題字型 → 投影片+背景 → 標題 → 內文 → 備忘稿 → save → validate.內文是中文時, 每個文字圖形再加 `--prop font.ea="Microsoft JhengHei" --prop lang=zh-TW`.

## 讀取與分析

先廣後窄.先 `outline`, 確定該看哪裡後再用 `view text` / `get` / `query`.

```bash
officecli view "$FILE" outline          # 投影片數 + 標題
officecli view "$FILE" annotated        # 逐頁完整拆解, 含字型, 字級, 表格, 圖表
officecli view "$FILE" text --start 1 --end 5   # 文字傾印(含表格儲存格文字)
officecli view "$FILE" issues           # 空白頁, 溢出提示
officecli view "$FILE" stats            # 計數與總計(含缺替代文字之圖片)
officecli get "$FILE" /                 # 頁面尺寸 slideWidth/slideHeight(pt), 佈景主題字型與色
```

**檢視單一元素.** XPath 式路徑, 1 起算.**一律加引號**.優先用 `@name=` / `@id=` 選擇器而非位置 `[N]`(重新排序後仍穩定).`[last()]` 可用.加 `--json` 取得機器輸出.

```bash
officecli get "$FILE" "/slide[1]" --depth 1              # 圖形清單含 ID 與名稱
officecli get "$FILE" "/slide[1]/shape[@name=Title]"
officecli get "$FILE" "/slide[1]/table[1]" --depth 3     # 表格列 / 儲存格
```

**跨簡報查詢.** CSS 式選擇器;運算子 `=`, `!=`, `~=`, `>=`, `<=`, `[attr]`, `:contains()`, `:no-alt`.`help pptx query` 列出可查詢之元素類型.

```bash
officecli query "$FILE" 'shape:contains("Revenue")'
officecli query "$FILE" 'picture:no-alt'                 # 無障礙缺口
officecli query "$FILE" 'shape[fill=1E2761]'             # 顏色比對
officecli query "$FILE" 'shape[width>=10cm]'             # 數值
```

**`query --json` 輸出綱要.** 結果包在 `.data.results[]`——用 `jq -r '.data.results[0].format.id'`, **不是** `.[0].id`.圖形名稱是 `.name`;填色是 `.format.fill`;文字顏色是 `.format.textColor`.

**視覺預覽(重點).**

```bash
officecli view "$FILE" html                # 印出 HTML 預覽路徑; 讀取它做逐頁視覺審查(最佳結構真相來源)
officecli view "$FILE" svg --start 3 --end 3   # 單頁 SVG(圖表與漸層在 SVG 內[不會]渲染)
```

**讀輸出時——一個預期中的非缺陷:**
- **`layout=blank` 沒有標題佔位符.** 標題是普通的 `shape` 元素, 故 `view outline` 回報 `(untitled)` 是**預期現象**, 不是缺陷.只有在需要螢幕閱讀器大綱相容性時才用 `layout=title` + `placeholder[title]`.

## 建立與編輯

動詞:`add` / `set` / `remove` / `move` / `swap` / `batch` / `raw-set`.九成的簡報就是投影片, 圖形, 文字, 幾張圖表, 圖片, 連接線.

### 投影片與背景

投影片是 `/slide[N]`.自訂設計一律傳 `layout=blank`.背景:純色, 漸層, 或影像.

```bash
officecli add "$FILE" / --type slide --prop layout=blank --prop background=1E2761                 # 純色
officecli add "$FILE" / --type slide --prop layout=blank --prop "background=1E2761-CADCFC-180"   # 漸層(起-迄-角度)
officecli add "$FILE" / --type slide --prop layout=blank --prop background=image:/path/to/hero.jpg  # 影像背景(重點)
```

### 圖形

`shape` 承載文字, 填色, 框線, 位置, 以及選用之動畫 / 連結.

```bash
officecli add "$FILE" /slide[2] --type shape --prop name=Title --prop text="Key Insight" \
  --prop x=2cm --prop y=2cm --prop width=20cm --prop height=3cm \
  --prop font=Georgia --prop size=36 --prop bold=true --prop color=1E2761 --prop fill=none
```

定位是明確的——沒有版面引擎, 格線算術由你負責.`--prop preset=` 挑選幾何形狀(`rect`, `roundRect`, `ellipse`, `triangle`, `arrow`, `star5`, ...);不支援自訂 `M...Z` 路徑——請挑預設形狀.**建立時就命名圖形**(`--prop name=HeroTitle`), 之後以 `"/slide[N]/shape[@name=HeroTitle]"` 定址——名稱在 z 序調整 / 移除後重加時仍存活, 而位置式 `/shape[3]`(甚至 `@id=`)會位移.任何結構變更後, 使用位置索引前先重新 `get --depth 1`.中文文字另加 `--prop font.ea="Microsoft JhengHei" --prop lang=zh-TW`(見〈中文(東亞)文字〉).

### 圖形內文字(段落, run, 樣式)

一個圖形有段落(`paragraph[K]`)與 run(`run[K]`).單行文字用圖形上的 `--prop text=` 即可;文字內之 `\n` 產生段落分隔, `\t` 產生定位(見 Shell 與執行紀律;字面反斜線 n 用 `\\n`).`add --type paragraph` 接受與圖形相同的樣式屬性(text, align, bold, italic, size, color, font).若要在*同一行內*混合樣式, 追加帶樣式的 run:

```bash
officecli add "$FILE" "/slide[2]/shape[@name=Card1]/paragraph[1]" --type run \
  --prop text=" (inline detail)" --prop size=14 --prop italic=true --prop color=8899BB
```

### 圖表

依設計原則之圖表選擇表挑類型.完整屬性清單(chartType 列舉, `seriesN.*`, `data=`/`categories=`, 座標軸選項):`help pptx add chart`.典型的品牌配色多系列:

```bash
officecli add "$FILE" /slide[3] --type chart --prop chartType=column \
  --prop series1.name=Revenue --prop series1.values="42,45,48" --prop series1.color=1E2761 \
  --prop series2.name=Growth  --prop series2.values="2,7,7"    --prop series2.color=CADCFC \
  --prop categories="Q1,Q2,Q3" \
  --prop x=2cm --prop y=4cm --prop width=20cm --prop height=10cm
```

陷阱:(1) 含 `()`, `[]`, `TBD` 之圖表標題會原樣輸出成字面文字.(2) 某些檢視器會把圖表顏色正規化為佈景主題預設——請於目標檢視器驗證.系列可於建立後再加(`add --type series`).

### 圖片

```bash
officecli add "$FILE" /slide[4] --type picture --prop src=hero.jpg \
  --prop x=1cm --prop y=1cm --prop width=32cm --prop height=18cm \
  --prop alt="Product hero, gradient lit from right"
```

交付前以 `officecli query "$FILE" 'picture:no-alt'` 確認為空.

### 連接線(重點——流程圖 / 決策樹之一級功能)

在兩個圖形或自由座標之間畫線.完整屬性 / 列舉參考(`shape`, `headEnd`/`tailEnd` 值, `from`/`to` 參照形式):`help pptx add connector`.

```bash
officecli add "$FILE" /slide[5] --type connector \
  --prop "from=/slide[5]/shape[@name=BoxA]" --prop "to=/slide[5]/shape[@name=BoxB]" \
  --prop shape=elbow --prop color=333333 --prop tailEnd=triangle
```

**每條流程連接線都要有箭頭.** 沒有箭頭時 `bentConnector3` 會渲染成無方向性的線.`preset=rightArrow` 疊圖只適用於水平流程;菱形 / 決策樹之分歧邊需要 `tailEnd=`.

### 動畫與轉場(重點)

依上方〈動畫與轉場〉使用(有目的, 優雅降級, 實機驗證;轉場依相鄰頁關係).預設名稱與時長語法:`help pptx animation`, `help pptx transition`.

```bash
officecli set "$FILE" "/slide[2]/shape[@name=HeroCard]" --prop animation=fade-entrance-400
officecli set "$FILE" "/slide[2]/shape[@name=HeroCard]" --prop animation=none    # 清除全部
officecli set "$FILE" "/slide[3]" --prop transition=fade-400                      # 進入第 3 頁時之轉場
officecli set "$FILE" "/slide[3]" --prop transition=none                          # 移除轉場
```

### 超連結, 提示文字, 投影片跳轉

`--prop link=slide[N]` 為簡報內跳轉(1 起算;目標頁必須存在), `link=nextslide` / `firstslide` / `lastslide` / `previousslide` / `endshow` 為具名導覽, `link=https://...` 為網址, `--prop tooltip="..."` 為停留提示文字.網址一律寫含 `https://` 之完整位址;連結目標不確定時向使用者確認, 不要猜.

### 表格, 佔位符, 群組, zoom——單行說明

- **表格**——`--type table --prop rows=N --prop cols=M`.列層級 `set` 支援 `height` 與 `c1/c2/c3`(種下儲存格文字).表頭樣式是表格層級(`firstRow=true` / `headerFill=`), 不是列屬性.儲存格格式在該儲存格之段落 / run 上.請**先**填列內容**再**設表格層級字型(列操作會重置字型串接).
- **佔位符**——`layout="<版面名稱>"` 只是中繼資料:套用含佔位符之版面配置時, 佔位符**不會自動產生**.以 `--prop title="..."` / `--prop text="..."` 讓 CLI 產生標題 / 內文佔位符, 或以 `--type placeholder --prop phType=<role>` 逐一新增;之後以 `"/slide[N]/placeholder[title]"` / `placeholder[body]` 定址.可用之版面名稱以 `officecli query "$FILE" slidelayout` 列出.`layout=blank` 沒有佔位符.
- **群組**(重點)——子元素以 `"/slide[N]/group[@name=G]/shape[1]"` 定址.比位置索引更耐重新排序.
- **Zoom 投影片**(重點)——`--type zoom --prop target=N`(每個目標一個連結;別名 `slide`).多目標導覽中樞請輸出 N 個獨立 zoom 圖形.Zoom 是執行期功能——`view html` 只顯示靜態幾何, zoom 互動僅在實機簡報檢視器內運作.
- **投影片註解**——審閱者註記錨定於 `/slide[N]/comment[M]`.完整生命週期(`add / set / get / query / remove`).屬性:`text`, `author`, `initials`(自動推導), `date`(ISO 8601, 預設 UtcNow), `x` / `y`(長度錨點).
  ```bash
  officecli add "$FILE" "/slide[2]" --type comment --prop author="Alice" --prop text="Tighten this bullet" --prop x=20cm --prop y=3cm
  officecli query "$FILE" 'comment' --json | jq '.data.results | length'   # 計算所有審閱註解
  officecli remove "$FILE" "/slide[2]/comment[1]"                           # 處理完後解決掉
  ```

### 簡報層級食譜

從基本操作看不出來的模式.每則先給**視覺結果**, 再給可執行區塊.`$FILE` = 你的檔名.用 `/slide[last()]` 定址剛加入的那一頁.這些食譜示範的是**結構與座標算術**——請換上你為該主題挑的色盤 / 字型;深藍 `1E2761` + Georgia 只是範例的主題, 不是要照抄的公司樣式.

**Z 序.** 後加入的圖形在上層.裝飾性背景**先**加, 標題**最後**加.事後修正:`--prop zorder=back/front`(會重編同層序號——再往上疊前要重新 `get --depth 1`).

#### (a) 封面(與章節分隔頁)

**視覺結果.** 深藍填色, 置中 44pt 標題, 18pt 冰藍色資訊行.

```bash
officecli add "$FILE" / --type slide --prop layout=blank --prop background=1E2761
officecli add "$FILE" "/slide[last()]" --type shape --prop text="Strategic Growth Review" \
  --prop x=2cm --prop y=7cm --prop width=29.87cm --prop height=3cm \
  --prop font=Georgia --prop size=44 --prop bold=true --prop color=FFFFFF --prop align=center
officecli add "$FILE" "/slide[last()]" --type shape --prop text="Prepared for Acme Leadership — FY26 Outlook" \
  --prop x=2cm --prop y=11cm --prop width=29.87cm --prop height=1.2cm \
  --prop font=Calibri --prop size=18 --prop color=CADCFC --prop align=center
```

**章節分隔頁** = 與封面相同, 外加一個巨大的半透明編號(`size=120`, `opacity=0.15`), 且要**先**加入使其位於章節標題後方.

#### (b) 資料頁(圖表 + 評論區塊)

**視覺結果.** 左三分之二:品牌系列色之直條圖.右三分之一:[Key Insight] 卡片, 20pt 標題 + 18pt 內文——聽眾先讀到結論再去解讀長條.

```bash
officecli add "$FILE" / --type slide --prop layout=blank --prop background=FFFFFF
officecli add "$FILE" "/slide[last()]" --type shape --prop text="FY26 Revenue Beat Plan by 18%" \
  --prop x=1.5cm --prop y=1cm --prop width=30cm --prop height=1.8cm \
  --prop font=Georgia --prop size=36 --prop bold=true --prop color=1E2761

# 圖表 — 左 2/3 (標題含 `$` 故用單引號)
officecli add "$FILE" "/slide[last()]" --type chart --prop chartType=column \
  --prop series1.name=Actual --prop series1.values="42,45,48,55" --prop series1.color=1E2761 \
  --prop series2.name=Plan --prop series2.values="40,42,45,48" --prop series2.color=CADCFC \
  --prop categories="Q1,Q2,Q3,Q4" --prop x=1.5cm --prop y=3.5cm --prop width=20cm --prop height=14cm --prop title='FY26 Revenue ($M)'

# 評論卡片 — 右 1/3: 背景 + 標題 + 內文
officecli add "$FILE" "/slide[last()]" --type shape --prop preset=roundRect --prop fill=F5F7FA --prop line=none \
  --prop x=22.5cm --prop y=3.5cm --prop width=9.8cm --prop height=14cm
officecli add "$FILE" "/slide[last()]" --type shape --prop text="Key Insight" \
  --prop x=23cm --prop y=4cm --prop width=9cm --prop height=1.2cm \
  --prop font=Georgia --prop size=20 --prop bold=true --prop color=1E2761
officecli add "$FILE" "/slide[last()]" --type shape --prop text="EMEA launch + NRR at 118% drove 12pp of the 18pp beat." \
  --prop x=23cm --prop y=5.5cm --prop width=9cm --prop height=11cm \
  --prop font=Calibri --prop size=18 --prop color=333333
```

#### (c) 流程圖 / 程序圖(方塊 + 連接線)

**視覺結果.** 四個圓角方塊橫排於 y=8cm, 各 6×3cm, 深藍/冰藍交替, 以肘形連接線加三角箭頭相連.

格線算術(4 個方塊, 33.87cm 頁寬, 1.5cm 邊界):`間距 = (33.87 − 3 − 24) / 3 = 2.29cm`.x 座標:`1.5, 9.79, 18.08, 26.37`.

每個方塊以 `valign=middle` 自帶標籤(不需另外疊圖形).用 `batch` heredoc 做可攜的座標算術——不需 `bc`, 不需 bash 陣列.

```bash
cat <<EOF | officecli batch "$FILE"
[
  {"command":"add","parent":"/slide[$SLIDE]","type":"shape","props":{"name":"Step1","preset":"roundRect","fill":"1E2761","line":"none","x":"1.5cm","y":"8cm","width":"6cm","height":"3cm","text":"Step 1","font":"Georgia","size":"20","bold":"true","color":"FFFFFF","align":"center","valign":"middle"}},
  {"command":"add","parent":"/slide[$SLIDE]","type":"shape","props":{"name":"Step2","preset":"roundRect","fill":"CADCFC","line":"none","x":"9.79cm","y":"8cm","width":"6cm","height":"3cm","text":"Step 2","font":"Georgia","size":"20","bold":"true","color":"1E2761","align":"center","valign":"middle"}},
  {"command":"add","parent":"/slide[$SLIDE]","type":"shape","props":{"name":"Step3","preset":"roundRect","fill":"1E2761","line":"none","x":"18.08cm","y":"8cm","width":"6cm","height":"3cm","text":"Step 3","font":"Georgia","size":"20","bold":"true","color":"FFFFFF","align":"center","valign":"middle"}},
  {"command":"add","parent":"/slide[$SLIDE]","type":"shape","props":{"name":"Step4","preset":"roundRect","fill":"CADCFC","line":"none","x":"26.37cm","y":"8cm","width":"6cm","height":"3cm","text":"Step 4","font":"Georgia","size":"20","bold":"true","color":"1E2761","align":"center","valign":"middle"}}
]
EOF

# 連接線模式 — 任何方塊對方塊的圖都可重用.
for pair in "Step1 Step2" "Step2 Step3" "Step3 Step4"; do
  A=${pair% *}; B=${pair#* }
  officecli add "$FILE" "/slide[$SLIDE]" --type connector \
    --prop "from=/slide[$SLIDE]/shape[@name=$A]" \
    --prop "to=/slide[$SLIDE]/shape[@name=$B]" \
    --prop shape=elbow --prop color=333333 --prop tailEnd=triangle
done
```

`shape=elbow` 是正式寫法(`bentConnector2` / `bentConnector3` 亦接受).

#### (d) 多頁簡報骨架

沒有程式碼區塊——這是節奏.下列序列是**一種可行節奏之示範(深色分隔頁與白色內容頁交替), 不是規定的排列順序**——請先從內容導出你實際的敘事弧(見〈規劃與確認〉), 再借用合適的分隔/內容節奏:

- **10 頁檢討:** 封面 · 議程 · 3 個 KPI · 分隔01 · 圖表 · 圖表 · 分隔02 · 流程 · 時間軸 · 結尾
- **20 頁提案:** 同樣節奏 × 2, 分章為 問題 · 解方 · 市場 · 產品 · 成長 · 商業模式 · 團隊 · 財務 · 募資需求
- 每個分隔頁都必須出現在其章節內容**之前**(關卡 3 順序合理性)
- 封面/分隔頁 = (a);圖表頁 = (b);流程頁 = (c);KPI 頁 = (e);決策頁 = (f)

#### (e) KPI 標註——巨大數字卡片格線

**視覺結果.** 一列橫排三或四個巨大數字;每張卡片 = 單位副標 + 小型百分比變化標籤 + 一行結論.高階簡報最常見的元素.

**尺寸規則.** 大數字用齊線數字字型(Cambria 等;Georgia 為舊式數字, 數字高低不齊).實測 60pt Cambria 粗體在 9.78cm 卡片內, 5 個字元(`$84.2`)有餘裕, 6 個字元(`$84.2M`, `118.5%`)已貼齊左右邊緣.更長的值請拆開:`$84.2` 當大數字, `USD millions` 當副標——**絕不可為了塞下單位後綴而縮小字級**, 那只會造成換行.

格線算術(3 張卡, 1.5cm 邊界, 0.76cm 間距):`欄寬 = (33.87 − 3 − 1.52) / 3 = 9.78cm`.x 座標:`1.5, 12.04, 22.58`.在單一[需注意]卡片上使用強調色, 使風險一秒可辨.

```bash
# 兩張卡片: 深藍標準 + 赤陶色警示. 每張 = 背景 + 大數字 + 副標 + 標籤.
cat <<EOF | officecli batch "$FILE"
[
  {"command":"add","parent":"/slide[$SLIDE]","type":"shape","props":{"preset":"roundRect","fill":"1E2761","line":"none","x":"1.5cm","y":"4cm","width":"9.78cm","height":"7cm"}},
  {"command":"add","parent":"/slide[$SLIDE]","type":"shape","props":{"text":"84.2","x":"1.5cm","y":"4.8cm","width":"9.78cm","height":"2.8cm","font":"Cambria","size":"60","bold":"true","color":"FFFFFF","align":"center"}},
  {"command":"add","parent":"/slide[$SLIDE]","type":"shape","props":{"text":"USD millions · ARR","x":"1.5cm","y":"8cm","width":"9.78cm","height":"0.8cm","font":"Calibri","size":"14","color":"CADCFC","align":"center"}},
  {"command":"add","parent":"/slide[$SLIDE]","type":"shape","props":{"text":"+24% YoY","x":"1.5cm","y":"9cm","width":"9.78cm","height":"0.8cm","font":"Calibri","size":"14","bold":"true","color":"CADCFC","align":"center"}},
  {"command":"add","parent":"/slide[$SLIDE]","type":"shape","props":{"preset":"roundRect","fill":"B85042","line":"none","x":"22.58cm","y":"4cm","width":"9.78cm","height":"7cm"}},
  {"command":"add","parent":"/slide[$SLIDE]","type":"shape","props":{"text":"\$1.42","x":"22.58cm","y":"4.8cm","width":"9.78cm","height":"2.8cm","font":"Cambria","size":"60","bold":"true","color":"FFFFFF","align":"center"}},
  {"command":"add","parent":"/slide[$SLIDE]","type":"shape","props":{"text":"CAC payback (yrs)","x":"22.58cm","y":"8cm","width":"9.78cm","height":"0.8cm","font":"Calibri","size":"14","color":"FFFFFF","align":"center"}},
  {"command":"add","parent":"/slide[$SLIDE]","type":"shape","props":{"text":"+8% — watch","x":"22.58cm","y":"9cm","width":"9.78cm","height":"0.8cm","font":"Calibri","size":"14","bold":"true","color":"FFFFFF","align":"center"}}
]
EOF
```

#### (f) 決策樹——YES/NO 分支

**視覺結果.** 菱形置於上方中央;YES/NO 子方塊左右分歧;兩者匯入共同的終點方塊.版面:菱形 `x=13.94, y=2cm, 6×3cm`;YES 於 `3cm, 7.5cm`;NO 於 `22.87cm, 7.5cm`;終點於 `13.94cm, 13cm`.慣例:紅 = 停止/升級, 藍 = 標準, 綠 = 安全終點.**每條連接線都要有箭頭**——否則讀者會誤判方向.

```bash
cat <<EOF | officecli batch "$FILE"
[
  {"command":"add","parent":"/slide[$SLIDE]","type":"shape","props":{"name":"Decide","preset":"diamond","fill":"1E2761","line":"none","x":"13.94cm","y":"2cm","width":"6cm","height":"3cm","text":"Hazardous energy present?","font":"Calibri","size":"14","bold":"true","color":"FFFFFF","align":"center","valign":"middle"}},
  {"command":"add","parent":"/slide[$SLIDE]","type":"shape","props":{"name":"YesBox","preset":"roundRect","fill":"B85042","line":"none","x":"3cm","y":"7.5cm","width":"8cm","height":"3cm","text":"Lockout + Tagout + Verify","font":"Calibri","size":"16","bold":"true","color":"FFFFFF","align":"center","valign":"middle"}},
  {"command":"add","parent":"/slide[$SLIDE]","type":"shape","props":{"name":"NoBox","preset":"roundRect","fill":"CADCFC","line":"none","x":"22.87cm","y":"7.5cm","width":"8cm","height":"3cm","text":"Proceed with standard PPE","font":"Calibri","size":"16","bold":"true","color":"1E2761","align":"center","valign":"middle"}},
  {"command":"add","parent":"/slide[$SLIDE]","type":"shape","props":{"name":"Done","preset":"roundRect","fill":"2C5F2D","line":"none","x":"13.94cm","y":"13cm","width":"6cm","height":"2.5cm","text":"Begin service","font":"Calibri","size":"16","bold":"true","color":"FFFFFF","align":"center","valign":"middle"}}
]
EOF
```

接著用 (c) 的連接線迴圈模式加 4 條連接線(`Decide→YesBox`, `Decide→NoBox`, `YesBox→Done`, `NoBox→Done`).

## QA(必要)

**預設一定有問題.** 第一次渲染幾乎不可能正確.若你找不到任何問題, 就是看得不夠仔細.

### 交付關卡(任一項失敗即 REJECT, 不得交付)

關卡 1–2b 是文字/綱要層級(看不到渲染後的投影片);關卡 3 是唯一的視覺檢查.完成 = 每個關卡 PASS **且**關卡 3 迴圈收斂.

每個關卡都是**執行一條指令, 判讀其輸出**——officecli 指令在各作業系統(macOS / Linux / Windows)完全相同, 不需寫 shell 腳本;判讀由你負責.

- **關卡 1 — 綱要.** `officecli validate "<file>"`.任何綱要錯誤 → REJECT 並修正.
- **關卡 2 — 溢出 / 格式 / 結構.** `officecli view "<file>" issues`.若列出*任何*問題(標記 `[O1]`, `[C1]`, `[S1]`, … 之行)→ REJECT, 修正, 重跑直到乾淨.
- **關卡 2b — 殘留佔位符.** `officecli view "<file>" text`, 然後掃描輸出中之 `xxxx`, `lorem` / `ipsum`, `<TODO>`, `placeholder`, "this slide layout", 或空的 `()` / `[]`.命中任一 → REJECT.

### 關卡 3 — 視覺審查(強制)

擇**一**執行:

**截圖(預設)**——適用具視覺能力之代理.逐頁截圖——`officecli view "<file>" screenshot --page 1 -o ./tmp/<案名>/slide1.png`, 接著 `--page 2`, …——直到頁碼超出簡報範圍(一張截圖 = 一頁).每張讀進對話前先以 `file` 確認是 PNG(`PNG image data`)——內容不是合法圖片時讀進來會讓整個 session 永久壞掉.若第 1 頁就報錯, 改用下方退路.

**以檢查清單對每張 PNG 做對抗式判讀**——[預設問題存在;找不到代表你看得不夠仔細].每個問題回報一行 `slide N: <issue>`, 全數通過則回報 `PASS`.不論用何種方式執行, 此步驟皆為必要.**若**你的執行環境可派生子代理, 請把判讀工作委派給一個*全新且獨立*的子代理——建置該簡報的代理會偏向[看起來還好], 另一雙眼睛更嚴格——把截圖 + 本檢查清單 + 同樣的對抗式框架交給它.沒有子代理?那就自己照做一遍.

**退路——HTML 文字**(無視覺能力, 或截圖失敗):以文字方式讀取 `view "$FILE" html`.DOM **無法**證明**深色疊深色 / 細微重疊 / 箭頭 / 間距邊界量測 / 欄位對齊**——這些請標記為[未經視覺驗證]而非 PASS.

**選用 `--grid N`**——僅在使用者要求檢視版面節奏, 或 `view outline` 顯示版面分佈異常時使用:`officecli view "<file>" screenshot --grid 3 -o ./tmp/<案名>/grid.png`.

**逐頁檢查清單(預設問題存在):**

- **重疊**——圖形 / 圖表 / 巨大裝飾數字(01/02/03 100pt+)互相碰撞
- **文字溢出**——在頁面或圖形邊界被截斷(KPI 卡片, 窄框)
- **文字框過窄**——技術上塞得下, 但換行成很多短行(每行 1–2 字);3cm KPI 卡片內的長副標, 過窄欄內的內文行
- **深色疊深色**——填色亮度 < 30% 而文字/圖示亮度 < 80%(含深色圖示置於深色上而無對比圓底)
- **對比不足**——小字(< 18pt)< 4.5:1, 大字(≥ 18pt)< 3:1(以下方計算式求)
- **影像處理**——照片被拉伸/變形, 文字直接壓在雜亂影像上(無卡片/遮罩), 截圖或標誌被裁切, 透明影像浮在白底上, 圖說距其圖 > 1.6cm
- **缺箭頭**——流程圖連接線是純線條
- **裝飾線 / 標題不匹配**——強調條依單行標題設寬, 但標題換成兩行(或反之)
- **頁尾 / 出處碰撞**——出處行, 頁碼或註腳貼到上方內容
- **邊界 / 間距過緊**——元素距頁面邊緣約 0.5" 內, 或兩張卡片相距約 0.3" 內
- **間距不均**——一側大片空白, 另一側擁擠(節奏破壞);同一文字塊內非裝飾性空白 > 4cm(喘息頁除外)
- **行距過擠**——同一文字塊之行距 < 1.05 倍字級(調到 1.15–1.3 倍)
- **欄位 / 重複元素未對齊**——KPI 卡片 / 圖示偏離基線或寬度不一致;同欄 x 或同列基線相差 > 0.1cm, 一列卡片之間距差 > 平均之 5%
- **主角不對**——頁面上最顯眼的元素不是該頁頁面任務的主角
- **喘息頁塞卡片**——標為`喘息`的頁出現 3 張以上卡片
- **中文**——顯示成方框(豆腐字), 或字距 > 字級之 5%(見〈中文(東亞)文字〉)
- **順序合理性**——序列符合敘事(封面 → 議程 → 分隔頁在章節前 → 結尾)

以 `slide N: <issue>` 逐行 REJECT, 否則回報 "Gate 3 PASS"(HTML 文字退路須附加 "<未驗證項目> 未經視覺驗證").

**對比計算**(WCAG 相對亮度;給兩個 6 位 hex, 輸出對比值):

```bash
node -e "const L=h=>{const c=[0,2,4].map(i=>parseInt(h.slice(i,i+2),16)/255).map(v=>v<=0.03928?v/12.92:((v+0.055)/1.055)**2.4);return .2126*c[0]+.7152*c[1]+.0722*c[2]};const [a,b]=process.argv.slice(1).map(s=>L(s.replace('#',''))).sort((x,y)=>y-x);console.log(((a+.05)/(b+.05)).toFixed(2))" 333333 FFFFFF
```

**修正方式.**

- **合併修正**:讀完整份問題清單(`view issues` 全部輸出 + 關卡 3 全部頁)後一次修完, 再重跑一次;不要修一處就跑一次檢查.
- **硬性問題每項必修**:出界, 溢出截斷, 重疊, 對比不足, 影像破損或變形, 規劃中有而頁面上缺的元素.
- **軟性問題存疑不動**:對齊, 間距, 行距, 節奏類, 每輪最多修 2 項, 其餘列入回報;寧可少修, 不要來回擺盪.
- **修正引出新的硬性問題就撤回該修正**, 該項改列[需人工判斷].
- **早期關卡**:超過 6 頁的簡報, 建完前 5 頁先跑一次關卡 2–3.同一類問題出現在多頁, 是方法層(色盤, 字級, 版型或食譜)有錯, 先改方法再建後面的頁;大多數頁面都有同類問題時, 病根在規劃或版型選擇, 回到〈規劃與確認〉, 不要逐頁修.

**修正-驗證(強制, 最多 3 輪).** 修正 → 重跑關卡 3 → 重複直到零新問題;一個修正常會引出另一個.3 輪仍未收斂就**停止**——多半是來回擺盪, 模板層級成因, 或代理判讀錯誤.回報 `slide N: <issue> — attempted: <fixes> — likely root: <template|design-conflict|ambiguous>` 並交由使用者決定.

**最後 flush(屬於關卡的一部分).** 關卡 3 收斂後, 以 `officecli save "<file>"` 收尾——這保證你的編輯在交付前已寫入磁碟(一次性交付可改用 `officecli close "<file>"` 同時釋放常駐).這是必要的最後步驟, 非選用.永遠安全:不會報錯或遺失工作.

## 常見陷阱

快速檢查表——第一次上手最容易壞的地方.設計陷阱 + shell 陷阱.

| 陷阱 | 正確做法 |
|---|---|
| zsh/bash 未加引號之 `[N]` | 路徑一律加引號:`"/slide[1]"`.zsh 會把未加引號之 `[1]` glob 成 `no matches found`——初次使用第一大坑 |
| `--name "foo"` | 所有屬性都走 `--prop`:`--prop name="foo"` |
| `/shape[myname]`(括號內裸名稱) | 用 `@name=` 選擇器:`/shape[@name=myname]` 或 `/shape[@id=10007]` |
| 路徑 1 起算 vs `--index` 0 起算 | `/slide[1]` = 第一頁;`--index 0` = 第一個位置 |
| `--prop text=` 內之 `$` | 用單引號:`--prop text='$15M'`.雙引號之 `"$15M"` 會被 shell 展開成 `M` |
| `--prop text=` 內之 `\n` / `\t` | 由 CLI 解讀:`\n` = 段落分隔, `\t` = 定位.字面值請寫兩次 `\\n` |
| 中文文字只寫 `--prop font=Georgia` | 東亞槽也被設成 Georgia(沒有中文字形);另設 `--prop font.ea="Microsoft JhengHei" --prop lang=zh-TW` |
| `create` 未帶 `--locale` | 佈景主題之東亞字型隨當機作業系統而異;中文簡報一律 `--locale zh-TW`, 再設 `headingFont.ea` / `bodyFont.ea` |
| `layout="Title and Content"` 以為佔位符已在 | `layout` 只是中繼資料;以 `--prop title=` / `--prop text=` 產生佔位符, 或逐一 `--type placeholder` |
| `gradient=` 用 8 位 hex 或 `+alpha` 做透明漸層 | 色標不支援透明度:8 位 hex 會被誤讀成別的顏色, `+alpha` 被丟棄, 且都不報錯;遮罩改用 `fill` + `opacity` |
| `shadow=true` | 預設不透明度 40% 過重;用 `shadow=000000-<模糊pt>-90-<距離pt>-<6–20>` |

---

## CLI 機制(引擎層, 三種格式共用)

自原通用 `officecli` 技能併入, 使本技能自足.以上皆為簡報工藝, 本節則是 CLI 本身的行為.

### 版本鎖定:自動升版,技能同步與自我安裝

官方執行檔內建三個會改動本機的機制,都只看執行檔自己的位置,不分安裝方式.〈安裝與呼叫〉函式裡的兩個旗標就是用來關閉它們(2026-10-02 依官方 1.0.153 原始碼查核):

| 機制 | 觸發 | 動作 | 關閉方式 |
|---|---|---|---|
| 自動升版 | 幾乎每次執行(`config` / `skills` / `load_skill` / `mcp` / `install` 除外);使用者層設定 `autoUpdate` 預設為開 | 每 24 小時於背景查一次新版並下載;下一次執行時把正在執行的執行檔換成新版(Windows 會留下 `.old`) | `OFFICECLI_SKIP_UPDATE=1`;另有使用者層設定 `officecli config autoUpdate false`(存於 `~/.officecli/config.json`,本機所有 officecli 共用,是否更改由使用者決定) |
| 官方技能同步 | 執行檔版本變動後之第一次執行 | 把內建之官方技能覆寫到各 agent 技能目錄中**已存在**的官方技能(不新增) | 只有 `OFFICECLI_SKIP_UPDATE=1`(`autoUpdate false` 擋不住此項) |
| 自我安裝 | 不帶任何參數執行,且執行檔所在目錄不在 PATH 上 | 全域版不存在:複製自己為全域版(Windows `%LOCALAPPDATA%\OfficeCli`,其他 `~/.local/bin`),寫入使用者 PATH,把官方 `officecli` 技能裝進所有偵測到的 agent 技能目錄(含 `~/.claude/skills`);全域版較舊:以自己覆蓋 | `OFFICECLI_NO_AUTO_INSTALL=1` |

自動升版只豁免 Homebrew 與 Scoop 管理的路徑,npm 的 `node_modules` 不在豁免之列;而 npm 套件只在執行檔不存在時才下載,`npm i` 不會把被換掉的版本換回來——所以版本鎖定只能靠旗標,不能靠 npm.officecli 自行啟動之常駐行程會繼承這兩個旗標.

### 常駐模式與 flush

**每個指令於首次存取時會自動啟動常駐**(閒置 60 秒逾時)——自動避免檔案鎖衝突.明確 `open`/`close` 可把閒置窗口延長至 12 分鐘:

```bash
officecli open "$FILE"      # 保留於記憶體
officecli set "$FILE" ...   # 無檔案 I/O 負擔
officecli close "$FILE"     # 存檔並釋放
```

以 `OFFICECLI_NO_AUTO_RESIDENT=1` 停用自動啟動.**只在非 officecli 邊界才 flush**——officecli 自己的讀取(`get`/`query`/`view`/`dump`)一律看得到你的編輯, 故只有在 python-pptx, PowerPoint, 渲染器或交付要讀該檔前才需 `save`/`close`.閒置階段會於數秒內自動 flush;`OFFICECLI_RESIDENT_FLUSH=each` 可強制每次變更都 flush.

### 穩定 ID 定址

具穩定 ID 之元素會回傳 `@attr=value` 路徑而非位置索引.**多步驟流程優先用它**——位置索引會因插入/刪除而位移, 穩定 ID 不會.

```
/slide[1]/shape[@id=550950021]                 # 圖形
/slide[1]/table[@id=1388430425]/tr[1]/tc[2]    # 表格
/slide[1]/shape[@name=Title 1]                 # 依名稱(僅 pptx)
```

PPT 亦接受 `@name=`, 並能辨識 morph 之 `!!` 前綴.投影片, run 與表格列/儲存格沒有穩定 ID, 退回位置索引.

### view 模式——完整表

| 模式 | 說明 | 常用旗標 |
|------|-------------|-------------|
| `outline` | 簡報結構 | |
| `stats` | 統計(頁數, 圖形數) | |
| `issues` | 格式/內容/結構問題 | `--type format\|content\|structure`, `--limit N` |
| `text` | 純文字擷取 | `--start N --end N`, `--max-lines N` |
| `annotated` | 文字加格式標註 | |
| `html` | 靜態 HTML 快照——與 `watch` 同一渲染器, 免起服務 | `--browser`, `--start N --end N` |
| `screenshot` / `svg` / `pdf` | 無頭瀏覽器 PNG / 逐頁 SVG / 匯出外掛 PDF | `-o`, `--screenshot-width/-height`, `--grid N` |

一次性快照(CI 產物, 封存, 差異比對)用 `view html`;需要即時刷新或瀏覽器點選時用 `watch`.

### watch 與互動選取

```bash
officecli watch "$FILE" [--port N]        # 即時預覽服務(預設埠 26315)
officecli unwatch "$FILE"
officecli goto "$FILE" <path>             # 讓監看中的瀏覽器捲動至該元素
officecli get "$FILE" selected [--json]   # 讀取使用者點選了什麼
```

點擊選取, shift/cmd/ctrl+click 多選, 自空白處拖曳框選.`get selected` 回傳目前瀏覽器選取之 DocumentNodes(未選取則為空;無 watch 執行中則 exit != 0)——這是[使用者指, 代理做]的標準流程:

```bash
# 使用者於瀏覽器點選圖形後說[把這些變紅色]
PATHS=$(officecli get "$FILE" selected --json | jq -r '.data.Results[].path')
for p in $PATHS; do officecli set "$FILE" "$p" --prop fill=FF0000; done
```

選取狀態可跨檔案編輯保留(路徑用穩定 `@id=` 形式);所有連線之瀏覽器共用同一份選取;每個檔案只能有一個 watch.**pptx 之涵蓋範圍是三種格式中最廣的**——圖形, 圖片, 表格, 圖表, 連接線, 群組.繼承自版面配置/母片之裝飾不可定址, 且**群組圖形以整體選取**(v1 不支援深入其子元素).

### Marks——等待審查之編輯提案

當變更需要人工審查**才能**落到檔案時用 `mark`;marks 只存在於 watch 行程內.一次性變更直接用 `set`.

```bash
officecli mark "$FILE" <path> [--prop find=... color=... note=... tofix=... regex=true]
officecli unmark "$FILE" [--path <p> | --all]
officecli get-marks "$FILE" [--json]
```

`color` 接受十六進位 / `rgb(...)` / 22 種具名值.**路徑必須是 watch HTML 之 `data-path` 格式.**

### batch 原子性, dump, refresh

**預設為原子操作(v1.0.137+):** 每個項目都會執行並回報, 但只要*任一*項目失敗, 整批回滾——檔案保持位元組完全相同.`--best-effort` 可還原[成功的就套用]之舊行為(**對 pptx 而言這常是正確選擇**——`dump→batch` 重播對特殊部件是有損的, 為了一個不支援的項目而賠掉整份簡報, 比拿到部分結果更糟).`--stop-on-error` 只改變停止的早晚, 不影響已完成的工作是否保留.`--force` 與此無關(僅為 docx 保護之繞過).回滾之批次其 JSON 會帶 `"atomicRolledBack": true`.

```bash
officecli dump "$FILE" [<path>]      # 可重播之 batch JSON
officecli plugins list               # 擴充支援 .pdf 匯出
```

**pptx 之 `dump` 涵蓋範圍:** 文字 / 表格 / 圖片 / 圖表 / 備忘稿 / 佈景主題為原生支援;OLE, 3D 模型, 視訊/音訊, SmartArt, morph 與 p15 轉場則透過 `raw-set` 直通往返.

### 複製, 移動, 交換

```bash
officecli add "$FILE" / --from "/slide[1]"   # 連同所有跨部件關聯複製整頁
officecli move "$FILE" <path> [--to <parent>] [--index N] [--after <path>] [--before <path>]
officecli swap "$FILE" <path1> <path2>
```

使用 `--after`/`--before` 時可省略 `--to`——容器由錨點推導.複製投影片是維持整份簡報視覺一致最快的方法.

### 文字錨定插入(`--after find:X` / `--before find:X`)

以文字比對定位插入點.**PPT 僅支援行內類型**(run, picture, hyperlink)——區塊層級之自動切分是 docx 專屬.

```bash
officecli add "$FILE" "/slide[1]/shape[2]" --type run --after find:Revenue --prop text=" (preliminary)"
```

### pptx 元素類型(完整清單)

slide(含隱藏頁), shape(font.latin/ea/cs, direction=rtl, underline.color, highlight=COLOR, effective.X + effective.X.src;`arrow` 為 rightArrow 之別名;slideMaster/slideLayout 具名 add/set/remove), picture(SVG, brightness/contrast/glow/shadow, rotation, link, tooltip), chart(direction=rtl, pieOfPie, barOfPie, axisLine/gridline 逐屬性設定, animation + chartBuild=byCategory|bySeries, line 之 dropLines/hiLowLines/upDownBars, anchor=x,y,w,h 捷徑), table(儲存格 direction=rtl, fill/background, 內建 PowerPoint 樣式目錄, `/col[C]` get + swap/copyFrom, row/col Move/CopyFrom), row(tr), connector(from/to 需完整路徑之 `@name=`/`@id=` 形式——裸 `@name=Foo` 會被拒絕, 必須是 `/slide[N]/shape[@name=Foo]`;預設為邊到邊錨定, 以 fromSide/toSide 強制指定邊, fromIdx/toIdx 為原始 cxn 索引), group(link, tooltip, get/query/add/remove 可深入走訪, `ungroup=true` 可解散回投影片絕對座標), align/distribute(targets= 接受 `shape[@id=N]` 路徑), video/audio(loop, autoStart 別名), equation, notes(direction=rtl, lang), comment(舊版 + 現代 p188 討論串往返), animation(15 種強調 + 16 種退場預設, 多效果串接, 移動路徑預設, repeat/restart/autoReverse, 圖表動畫), transition(12 種 p15 預設 + morph/p14), paragraph(para), run, zoom, ole(preview=, 透過 add-part + raw-set 完整 dump 往返), placeholder(phType=...), model3d(rotation=ax,ay,az), smartart(透過 add-part 之 dump 往返), diagram(僅 add, mermaid → 原生圖形或渲染影像, `--type diagram`/`flowchart`).

### 格式別名與 MCP

格式別名:`ppt`/`powerpoint`→`pptx`, `word`→`docx`, `excel`→`xlsx`.動詞:`add`, `set`, `get`, `query`, `remove`.MCP 透過單一 `command` 字串參數暴露相同綱要——`{"command":"help pptx shape"}`, 原樣傳給 CLI(不是結構化物件).

### 索引基準

- 路徑為 **1 起算**(XPath 慣例):`/slide[3]` = 第三頁
- `--index` 為 **0 起算**(陣列慣例):`--index 0` = 第一個位置

### 更專門之技能

`officecli load_skill <name>` 會印出一份 SKILL.md——依其規則執行.挑最貼近者;每個產出物**只載入一個**技能, 絕不疊加;已載入之規則跨回合持續有效.

| 名稱 | 使用時機 |
|------|-------------|
| `role-operator-pptx`(別名 `pptx`) | 本技能——董事會檢討, 業務簡報, 全員大會, 產品發表 |
| `pitch-deck` | **僅限募資**——種子 / A-C 輪 / SAFE / 可轉債 / 策略性募資.業務 / 產品 / 董事會簡報不適用 |
| `morph-ppt` | 電影感 Morph 動畫簡報.靜態簡報不適用 |
| `morph-ppt-3d` | 3D Morph:GLB 模型, 鏡頭運動, 景深.純 2D Morph 不適用 |

`.docx` 或 `.xlsx` 產出物請改載入 `role-operator-docx` / `role-operator-xlsx`——各自皆為自足.
