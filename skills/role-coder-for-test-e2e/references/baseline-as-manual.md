# 標準圖作為操作手冊用圖：紅框決定表、量測 helper 設計、已知缺陷協定、假時鐘、產製與目視紀律

本篇是 SKILL.md §7 的深入層。所有樣板皆為**跨專案的抽象寫法**，元件名（抽屜、彈窗、標籤、樹狀區）是視覺單位的通稱，不是某專案的組件；落地時以專案映射表對應實際 selector。

## 1. 為什麼紅框會畫錯：四種根因

2026-09 一輪 150 張標準圖被業主連續退回八次，每次都是「圖產出來了、掃描也過了、我沒看」。退回的圖歸納只有四種根因，任何專案都會再犯：

| 根因 | 徵狀 | 對策（本篇章節） |
|---|---|---|
| 沒先決定「這一步的反應是什麼」就寫截圖 | 結果圖框整欄 / 整區（大片空白）、框到還沒變的東西、兩處各畫一框 | §2 決定表：每步先寫下反應對象，再選量測方式 |
| 量測 helper 用 DOM 尺寸區間碰運氣 | 同一 helper 對短文字框到整列、對長文字只框到文字；標籤只框到字不含圖示 | §3 以視覺單位定義量測 |
| 目標不在可視範圍或被蓋住 | 紅框被夾到畫面外變成沒框、框在被彈窗蓋住的位置 | §2 表末兩列 + §3 通用規則「先捲入再量」 |
| 產完沒看 | 以上全部 | §6 逐張目視，掃描只當輔助 |

## 2. 反應類型 → 框什麼（決定表）

寫每個截圖前先回答「使用者做了這一步，畫面上**哪個東西**變了或出現了」，填進程式碼註解（`//結果: …(框住…)`）與 spec 視覺項的括號，兩處字句一致。表中「整顆」指含圖示、底色、邊框、移除鈕等視覺上屬於同一物件的全部。

| 這一步是什麼 | 框什麼 | 不可以 |
|---|---|---|
| **點擊前**：圖示鈕 / 圓鈕 | 圖示矩形外擴數 px（恰包住圓底） | 框父容器（尺寸不一，常框到空白） |
| 點擊前：文字按鈕 | 按鈕整顆 | 只框字 |
| 點擊前：狀態標籤 / 條件標籤 / 關鍵字標籤 | 標籤整顆（圖示＋文字＋移除鈕） | 只框文字 |
| 點擊前：下拉選擇器 | 整顆含箭頭 | 只框目前值 |
| 點擊前：超連結（區塊撐滿整列者） | 文字墨跡（Range 量測）外擴數 px | 框整列 |
| 點擊前：樹狀 / 清單項目 | 該列（含圖示與文字） | 框整欄 |
| 點擊前：表格列、待勾選列 | 該列整列 | 框整表 |
| 輸入前：表單欄位 | 標籤 ∪ 輸入框（直式表單標籤在上方時尤其要含輸入框） | 只框標籤列 |
| 進入頁面 / 切換展示模式 | 主要內容區**有內容的部分**（樹狀區當時可見之全部節點列的聯集） | 框整個內容區 |
| 清單 / 樹重新列出 | 當時列出之項目列的聯集（三列就框三列） | 框整欄 |
| 展開 / 縮合 | 縮合後只剩一列就框那一列 | 沿用展開時的整區矩形 |
| 開啟抽屜 / 側欄；切換抽屜版次；拖寬抽屜 | 整個面板含標頭（寬度改變後仍是整個面板） | 只框內容區塊、框到舊寬度 |
| 收合 / 隱藏 / 關閉抽屜、側欄、目錄、面板 | 因此擴滿或露出之內容區整個（含標題）／地圖或場景繪圖區／文件區；工具列收合這類不讓出區域者才框收合後之工具列本身 | 框新出現之「顯示」鈕（與下一張點擊前之圖相同，讀者當成重複貼圖；業主明確退件） |
| 開啟彈窗 | 彈窗面板（標頭＋內容） | 框遮罩層 |
| 彈窗最大化 | 全螢幕框（面板就是整個視窗） | 落到內層區塊 |
| 彈窗切換模式（檢視 ↔ 編輯） | 整個彈窗（整份表單都變了） | 只框標頭幾顆鈕 |
| 選單展開 | 選單本體 | 框觸發鈕 |
| 表格出現 / 重算 | 標頭＋有資料之列，夾在表格框內（不含容器下方空白） | 框表格容器 |
| 表格某列新增 / 填值 / 被選 | 該列（先把該列捲入可視範圍） | 框整表 |
| 表格首列被刪 | 捲回頂端後框整個（縮短的）表格，讓讀者看到首列已換人 | 停在捲到底的位置（讀者以為只是捲過去） |
| 計數 / 狀態文字改變 | 該段文字（同列各段文字之聯集） | 框整條列 |
| 條件標籤新增 | 標籤整顆 | — |
| 條件標籤移除 | 回復後的計數文字 | 框空掉的整列 |
| 提示訊息（toast） | 訊息本體，等其滑入定位且位置連續兩次相同 | 剛出現時就量（仍在視窗外） |
| 確認對話框 | 對話框整體 | — |
| 另開新分頁 | 新分頁上**使用者第一眼看到的東西**：若自動開了彈窗就框彈窗 | 框被彈窗蓋住的標籤 |
| 目標被遮罩 / 彈窗蓋住 | 改框蓋在上面的那個東西，並在 spec 註明「條件標籤位於彈窗之後，不框」 | 照原計畫框被蓋住的位置 |
| 下載類（無畫面終態） | 只有點擊前那張 | 整個 case 無圖 |
| 點擊前：畫布內的圖徵（點／線／面，無 DOM） | 由可讀資訊反算的位置外擴數 px（點圖示含錨點偏移；線／面取游標將放大之處） | 框整個畫布 |
| 放大／平移後顯示圖徵 | 畫布本身，且截圖前以圖徵顏色像素計數證明主體在框內 | 主體已離開視野的畫布（海面／背景一片） |
| 點擊前：點遮罩、看圖視窗背景、透明攔截層或面板以外之處，以關閉面板或進行下一步 | 「點擊即會使面板隱藏或消失之區域」中面積最大之矩形，四邊內縮後繪框（判定、點擊處另選與參考實作見 §3.1） | 框點擊處之小方框（讀者以為該處有按鈕）；只框其中一小塊（讀者以為框外可點者不能點）；避開被遮罩所蓋之選單項或按鈕（讀者以為被蓋者不能點；遮罩在上，點其上任一處只會關閉面板，被蓋者亦屬可點區） |
| 全畫面覆蓋層開啟（圖片瀏覽器） | 大圖本身；工具列另一張框各鈕之聯集 | 框整個覆蓋層或透明整條工具列 |
| 彈窗分頁切換 | 分頁列（各分頁名之聯集）或被點的分頁名；切換後框內容區可視範圍 | 框整個彈窗 |
| 鍵盤觸發的提示區出現 | 提示區整塊面板；之後各步框面板內的查詢列／筆數與標籤／項目列 | 框編輯器 |
| 提示區點項目後插入內容 | 插入的連結文字墨跡（Range 量測） | 框整個編輯器 |

**一張圖只畫一個框**。要同時標兩處（如左欄樹與右欄清單）就拆成兩個步驟各截一張；相鄰的兩個東西（計數文字＋其後的標籤）取聯集為一框即可。多框讓讀者不知該看哪裡，業主明確否決。聯集只用於同一個反應由多個相鄰元素組成者（過濾後清單之各列、計數文字＋其後之標籤、工具列狀態改變之各項），不用於合併上一步之結果與下一步之目標（兼任圖只框下一步之目標，SKILL §7.1）。

## 3. 量測 helper：以視覺單位定義，不以尺寸區間碰運氣

反模式：`自文字往上找第一個寬在 [minW,maxW]、高在 [minH,maxH] 的祖先`。它對不同長度的文字命中不同層級（短文字命中整列、長文字命中文字本身），對含圖示的標籤只命中文字節點，對整欄容器也會命中。每個視覺單位要有自己的判準：

| 視覺單位 | 判準 |
|---|---|
| 標籤 / chip | 自文字葉節點往上找第一個「有底色或邊框」且尺寸為標籤級（寬 ≤ 400、高 ≤ 44）的祖先 |
| 圖示鈕 | 圖示元素本身矩形外擴 6–8 px；不取父層 |
| 樹狀區可見節點 | 區域內每個文字葉節點 → 各自往上找列容器（寬在列級、高在單列級）→ 全部列的聯集 |
| 清單項目 | 同上，並排除頂端路徑列與底部統計列 |
| 表格有內容範圍 | 標頭格 ∪ 可見資料列，逐一與表格框相交後取聯集；另回傳最後一列矩形供「新增列」用 |
| 抽屜 / 側欄面板 | 以標頭之識別文字（可見、位於畫面上方、位於畫面右半）為錨，往上找寬在面板級（300–1000）且高 ≥ 500 的祖先；寬度變化後自然跟著變 |
| 彈窗面板 | 最上層 `position:fixed` 且寬 > 300 的容器為遮罩層；遮罩層內第一個寬 ≥ 300 且**小於遮罩層**、高 ≥ 80 的 div 為面板；若遮罩層內存在「還原尺寸」鈕（已最大化）則直接回遮罩層矩形 |
| 超連結文字墨跡 | `document.createRange().selectNodeContents(leaf).getBoundingClientRect()` **外擴 4px**（框幾何只在目標外 1px 留白，不外擴即壓字，SKILL §7.3-8） |
| 無可見邊界之元件（整行訊息、開關與標籤、勾選列、狀態圖示＋文字、無內距之欄位列） | 可見內容（有邊界之子元素框 ∪ 文字行框）整體外擴 4px，子元素與文字同留白；可見內容恰為單一有邊界元素者視同框該元素；有可見邊界者（底色異於背後、邊框、陰影）量元素本身。共用層 `itemsUnionBox(目標, { fit:true })` |
| canvas 內之圖例列、翻頁箭頭、圖例項 | 圖表程式庫回報之矩形外擴 4px（共用層 `inkRect`）；緊鄰其他圖例項或頁次文字時以 `neighbors`（鄰項之可見矩形）使框線不越過間隙正中。圖表庫回報之矩形常比字形寬約 3px，目標與鄰項先經 `canvasInkRects`（讀 canvas 像素）收斂到實際墨跡；鄰項要含被捲動窗裁掉一部分的項目，不能只取完整顯示者 |
| 緊鄰項目（清單列、分段、晶片）之單項 | 框線中心置於與鄰項**可見範圍**之間隙正中（外擴 6、線寬 5 → 目標邊內縮至「中點 ± 3.5」）；可見範圍取有邊界者之元素框、無邊界者之子元素與文字聯集，不取含透明內距之元素框；空白間隔不算鄰項。自身文字與鄰項文字都不可貼線 |
| 浮層（無遮罩之下拉清單、浮出面板）與其內項目 | 以命中測試找浮層外四周最近之可見內容（觸發區、背後露出之晶片與文字），框線中心置於「目標內容」與「浮層外內容」之間隙正中：背後有內容就退入浮層內距，四周空白照常外擴；不一律畫在內側（內距小之清單會貼字）；有遮罩之彈窗照常外擴 |
| 表單欄位 | 標籤所在列容器 ∪ 「與標籤垂直重疊或緊接其下 40px 內」的 input/textarea |
| 計數文字 | 計數句首段文字（如「共」「已查詢到」類）葉節點之父層的全部子節點矩形聯集（不含父層本身的撐滿寬度） |
| 訊息 toast | 等 `right ≤ innerWidth` 且 `(left,top)` 連續兩次相同，再量 |
| 彈窗／popup 的內容區 | 容器內 `overflow-y:auto` 且高度 > 門檻、且不被其他候選包含的最外層 div（排除同為 `overflow:auto` 的分頁列與表格內層捲動區）；框時四邊內縮數 px 使框帶落在內距內 |
| 圖片於內部捲動容器 | 圖片矩形 ∩ 內容區矩形（可視部分）；點擊點取可視部分中心，不取圖片幾何中心（常在容器外） |
| 工具列（圓鈕群） | 各按鈕矩形之聯集，不取容器（容器常是透明整條或含 `pointer-events:none` 外殼） |
| 浮層（Teleport 到 body 的提示區／色盤） | 「寬高為面板級且內含識別文字」的可見浮層，不取第一個同 class 元素（tooltip 常共用 class） |
| 點擊外側之可點區與點擊處 | 依 §3.1 先判定可點區再取其最大矩形、四邊內縮；框與點擊處分開選（原點擊處在框內即沿用，否則取框內最近之純背景點），點擊處以 `elementFromPoint` 守門 |
| 樹狀列被展開的子清單撐高時 | 以子清單上緣為界切出上半列（列本體），不沿用整列矩形 |

通用規則：

- **有彈窗時一律以最上層彈窗為範圍**找文字與輸入框；抽屜與彈窗常有同名標籤、同名圖示，從 `document` 起找會命中被蓋住的那份（探索時 `.first()` 抓到背後抽屜的圖示、輸入框走到表格過濾框都是此因）。
- **目標在內部捲動容器可視範圍外時先捲入再量**：`el.scrollIntoView({block:'start'})` 後把文件捲動歸零（`window.scrollTo(0,0)`，否則頁首被切數 px）；表格本身是虛擬捲動時再把表格的內部捲動區（各表格庫之 body viewport）捲到底或回頂。`fullPage` 截圖延伸不到內部捲動容器，紅框會被夾到畫面外變成「沒框」。
- **每個 rect helper 上線前用真圖驗一次**：改了 helper 就重產受影響的圖並用眼睛看，不是只跑 `--check`。
- 直接給定矩形 `{x,y,w,h}` 的介面要保留（供無穩定 selector 的區域由呼叫端自行量測，如拖曳把手外擴）。

### 3.1 點擊外側之可點區：判定、框與點擊處分開、參考實作

適用：點遮罩、看圖視窗背景、透明攔截層或面板以外之處，其反應是面板隱藏或消失、或進行下一步。**框的是「點到哪裡都會使面板隱藏或消失（或進行下一步）」之整個區域，不是點擊處**。三種錯法都會讓讀者誤讀：框點擊處之小方框，讀者以為該處有按鈕；只框其中一小塊，讀者以為框外可點者不能點；避開被遮罩所蓋之選單項或按鈕，讀者以為被蓋者不能點，與事實相反（遮罩在上，點其上任一處只會關閉面板，被蓋之選單項、按鈕、卡片皆屬可點區）。殷鑑：依舊規則畫點擊處之小方框，使用者指出讀者會誤以為該處有按鈕；改為「避開遮罩下按鈕之空白處」，又被指出遮罩在上、被蓋者亦可點；無遮罩之彈窗只框「無文字之背景」，框成彈窗旁一小塊，被指出四周皆可點。

**一、判定可點區：先分三型，不憑外觀猜**

| 型 | 可點區 | 判法 |
|---|---|---|
| 有遮罩（半透明遮罩、看圖視窗之背景、透明攔截層） | 最上層為該遮罩元素之點，**不論其下為何** | 視窗每 step 像素取一點，以 `elementFromPoint` 判定最上層是否為點擊處之遮罩元素；於網格上取全為遮罩之最大矩形（逐列累計高度，以堆疊求直方圖下之最大矩形） |
| 無遮罩，點外部任一處即關閉（以 document 層級偵測外部點擊之彈窗、選單） | 整個視窗（或指定外側範圍）扣掉面板；疊於其上之工具列等照算（點它們同樣會關閉面板，只是點擊處不選它們，見二） | 取面板左、右、上、下 4 側中面積最大之一側（例：彈窗在左，即其右緣往上下延伸、再往右之整片）；示例碼用同一網格引擎，條件改為「不與面板相交」，單一面板時與取 4 側最大者之結果相同 |
| 無遮罩，只在點特定區域時才關閉（例：地圖彈窗只在點地圖畫布時關閉，點標題列、清單皆不關閉） | 限於該區域，且**最上層須為該區域之元素**，疊於其上之工具列、圖例、座標列、縮放鈕不算；點了會重新開啟該面板之錨點（如彈窗所指之圖示）避開 | 網格法，條件改為「最上層元素符合該區域之選擇器」並排除錨點矩形 |

**無遮罩者先讀元件之關閉機制（原始碼）再分型**：同為無遮罩之彈窗，有「點外部任一處即關閉」者，也有「只在點特定區域才關閉」者，兩者可點區差很大，不能由外觀猜。

**各型共同處理**：四邊內縮（例 16px，**不得小於取樣間距**，且須大於共用層紅框之外擴量約 6px 再加半格，step 10 時 16 已足）使框線不貼面板與畫面邊緣；網格取樣之邊界誤差至多一格，內縮即吸收；小於取樣間距之細障礙（分隔線、捲軸）可能漏判，必要時調小 step。可點區若非矩形（例：L 形），取其中面積最大之矩形，框外仍有可點處屬預期（一圖一框只取最大一塊，spec 視覺項括號註明「可點區中最大一塊」）；SKILL §7.6-4 之目視問題只在另有更大之可點矩形未被選時才退件。

**二、判定可點區與選點擊處是兩件事**

框照實框住全部可點區。點擊處另選：原點擊處在框內即沿用（其後之畫面與原標準圖一致）；否則於框內取最近原點擊處之**純背景**點，避開點下去另有作用之處（數據圖、站點與圖徵、按鈕、連結、輸入框、帶文字之容器），否則其後之畫面會改變而須重產（殷鑑：點擊處落在數據圖上，點擊後頁面變動，其後各張與原標準圖不同；落在地圖上，畫面上隨游標位置顯示之資訊（如座標）隨之改變）。純背景之判斷：一般 DOM 以「非可操作元件（button、a[href]、input、role、cursor:pointer、tabindex）、非圖像、無自身文字之元素」，遮罩本身即預期之點擊目標，不受此限（即使帶 cursor:pointer）；畫布（地圖、圖表）內有無圖徵因程式庫而異，由呼叫端注入回呼 `hasFeatureAt`，未注入則畫布一律不當純背景。

**三、參考實作（通用化；與專案耦合者一律由呼叫端注入）**

關鍵步驟：①依型建立「一格是否可點」之判定（遮罩型：格中心之最上層元素即遮罩；區域型：最上層元素符合選擇器；外部型：格不與面板相交；錨點矩形一律以矩形相交排除）→ ②網格取樣＋直方圖求最大矩形 → ③四邊內縮成框 → ④原點擊處在框內即沿用，否則取框內最近之純背景點 → ⑤守門（點擊處須仍在可點區、框過小即拋錯）。回傳之框同 `locator.boundingBox()` 格式，交共用層之紅框合成；點擊用真滑鼠 `page.mouse.click(click.x, click.y)`。呼叫前須就緒（遮罩與面板之進場動畫結束、矩形連續數次不變），否則取樣失準。

```js
// 求「點擊即會使面板隱藏或消失」之最大矩形（框），並另選點擊處。座標為視窗座標。
// opt.point         原點擊處 { x, y }
// opt.mode          'mask'（有遮罩）| 'region'（無遮罩，只在點特定區域時關閉）| 'outside'（無遮罩，點外部任一處即關閉）
// opt.region        mode='region' 必填：該區域元素之 CSS 選擇器（只比對最上層元素本身，例：地圖畫布）
// opt.panel         mode='outside' 必填，其餘模式供點擊處避開：面板之 CSS 選擇器（取可見者）
// opt.area          可選：外側範圍之 CSS 選擇器（預設整個視窗）
// opt.avoidRects    點了會重新開啟面板之錨點矩形 [{ x, y, width, height }]
// opt.hasFeatureAt  可選，由呼叫端注入：(x, y, el, r) => boolean，畫布 el 上視窗座標（x, y）附近 r 像素有無圖徵；
//                   需局部座標者由回呼自行以 el.getBoundingClientRect() 換算。於頁面內以 String(fn) + new Function 重建，
//                   須為自足之箭頭函式或 function 表達式（方法簡寫與已綁定函式重建時會 SyntaxError，亦不可引用外層變數）
// opt.step / inset / minSize   取樣間距 10 / 內縮 16（不得小於 step）/ 最小邊長 40
// 回傳 { x, y, width, height, click: { x, y } }
async function outsideClickRegion(page, opt) {
    let { point, mode, region = '', panel = '', area = '', avoidRects = [], hasFeatureAt = null, step = 10, inset = 16, minSize = 40 } = opt
    if (inset < step) {
        throw new Error('outsideClickRegion: inset 不得小於 step')
    }
    if (!['mask', 'region', 'outside'].includes(mode)) {
        throw new Error("outsideClickRegion: mode 須為 'mask'、'region' 或 'outside'")
    }
    let r = await page.evaluate((a) => {
        let { point, mode, region, panel, area, avoidRects, step, inset, minSize } = a
        let hasFeature = a.hasFeatureAtSrc ? new Function(`return (${a.hasFeatureAtSrc})`)() : null
        let W = window.innerWidth
        let H = window.innerHeight
        let visible = (e) => {
            let b = e.getBoundingClientRect()
            let cs = getComputedStyle(e)
            return b.width > 0 && b.height > 0 && cs.display !== 'none' && cs.visibility !== 'hidden'
        }
        let rectOf = (e) => {
            let b = e.getBoundingClientRect()
            return { x0: b.left, y0: b.top, x1: b.right, y1: b.bottom }
        }
        let inRect = (x, y, q) => x >= q.x0 && x <= q.x1 && y >= q.y0 && y <= q.y1
        let panels = panel ? [...document.querySelectorAll(panel)].filter(visible).map(rectOf) : []
        let ea = area ? [...document.querySelectorAll(area)].find(visible) : null
        if (area && !ea) {
            return { err: `找不到外側範圍 ${area}` }
        }
        let A = ea ? rectOf(ea) : { x0: 0, y0: 0, x1: W, y1: H }
        A = { x0: Math.max(0, A.x0), y0: Math.max(0, A.y0), x1: Math.min(W, A.x1), y1: Math.min(H, A.y1) }
        let blockers = avoidRects.map((q) => ({ x0: q.x, y0: q.y, x1: q.x + q.width, y1: q.y + q.height }))
        let maskEl = mode === 'mask' ? document.elementFromPoint(point.x, point.y) : null
        if (mode === 'mask' && (!maskEl || maskEl === document.body || maskEl === document.documentElement)) {
            return { err: '原點擊處不在遮罩上' }
        }
        if (mode === 'mask' && panels.some((q) => inRect(point.x, point.y, q))) {
            return { err: '原點擊處在面板上，不在遮罩上' }
        }
        if (mode === 'region' && !region) {
            return { err: "mode='region' 須給 region" }
        }
        if (mode === 'outside') {
            if (panels.length === 0) {
                return { err: `找不到開啟中之面板 ${panel}` }
            }
            blockers = blockers.concat(panels)
        }
        //一格（或一點）是否可點：幾何排除用矩形相交；最上層元素之判定用中心點
        let okBox = (x0, y0, x1, y1) => {
            if (x0 < A.x0 || y0 < A.y0 || x1 > A.x1 || y1 > A.y1) {
                return false
            }
            if (blockers.some((q) => x0 < q.x1 && x1 > q.x0 && y0 < q.y1 && y1 > q.y0)) {
                return false
            }
            if (mode === 'outside') {
                return true
            }
            let t = document.elementFromPoint((x0 + x1) / 2, (y0 + y1) / 2)
            return mode === 'mask' ? t === maskEl : !!t && t.matches(region)
        }
        //網格取樣 + 直方圖下之最大矩形（單調堆疊）
        let nc = Math.floor(W / step)
        let nr = Math.floor(H / step)
        let h = new Array(nc).fill(0)
        let best = null
        for (let r = 0; r < nr; r++) {
            for (let c = 0; c < nc; c++) {
                h[c] = okBox(c * step, r * step, (c + 1) * step, (r + 1) * step) ? h[c] + 1 : 0
            }
            let st = []
            for (let c = 0; c <= nc; c++) {
                let hc = c < nc ? h[c] : 0
                let start = c
                while (st.length > 0 && st[st.length - 1].h >= hc) {
                    let t = st.pop()
                    let s = t.h * (c - t.c)
                    if (t.h > 0 && (!best || s > best.s)) {
                        best = { s, c0: t.c, c1: c, r0: r - t.h + 1, r1: r + 1 }
                    }
                    start = t.c
                }
                st.push({ c: start, h: hc })
            }
        }
        if (!best) {
            return { err: '找不到可點區' }
        }
        let b = { x: best.c0 * step + inset, y: best.r0 * step + inset, width: (best.c1 - best.c0) * step - inset * 2, height: (best.r1 - best.r0) * step - inset * 2 }
        if (b.width < minSize || b.height < minSize) {
            return { err: `可點區過小（內縮後 ${Math.round(b.width)}x${Math.round(b.height)}），請查面板與遮罩，或調整 step／inset` }
        }
        //純背景：點下去不會另有作用之處
        let interactive = 'button, a[href], input, select, textarea, label, summary, [role="button"], [role="link"], [role="checkbox"], [role="switch"], [role="tab"], [role="menuitem"], [role="option"]'
        let isInteractive = (e) => {
            for (let n = e; n && n !== document.body && n !== document.documentElement; n = n.parentElement) {
                if (n.matches(interactive) || getComputedStyle(n).cursor === 'pointer' || (n.tagName !== 'CANVAS' && n.hasAttribute('tabindex') && n.tabIndex >= 0)) {
                    return true
                }
            }
            return false
        }
        let isPure = (x, y) => {
            let t = document.elementFromPoint(x, y)
            if (!t || panels.some((q) => inRect(x, y, q))) {
                return false
            }
            if (t === maskEl) {
                return true //遮罩本身即預期之點擊目標（即使帶 cursor:pointer）
            }
            if (t.tagName === 'CANVAS') {
                return !!hasFeature && !hasFeature(x, y, t, step)
            }
            if (/^(IMG|VIDEO|IFRAME|PICTURE|OBJECT|EMBED)$/i.test(t.tagName) || t.closest('svg') || isInteractive(t)) {
                return false
            }
            return ![...t.childNodes].some((n) => n.nodeType === 3 && n.nodeValue.trim() !== '')
        }
        //點擊處：原點擊處在框內即沿用，否則取框內最近原點擊處之純背景點
        let click = inRect(point.x, point.y, { x0: b.x, y0: b.y, x1: b.x + b.width, y1: b.y + b.height }) ? { x: point.x, y: point.y } : null
        if (!click) {
            let bestD = Infinity
            for (let y = b.y + step; y <= b.y + b.height - step; y += step) {
                for (let x = b.x + step; x <= b.x + b.width - step; x += step) {
                    let d = Math.hypot(x - point.x, y - point.y)
                    if (d < bestD && isPure(x, y)) {
                        bestD = d
                        click = { x: Math.round(x), y: Math.round(y) }
                    }
                }
            }
        }
        if (!click) {
            return { err: '框內找不到可安全點擊之純背景點（畫布內之點須注入 hasFeatureAt 才會被判為純背景）' }
        }
        if (!okBox(click.x - 1, click.y - 1, click.x + 1, click.y + 1)) {
            return { err: '點擊處不在可點區內' } //守門
        }
        return { ...b, click }
    }, { point, mode, region, panel, area, avoidRects, step, inset, minSize, hasFeatureAtSrc: hasFeatureAt ? String(hasFeatureAt) : '' })
    if (r.err) {
        throw new Error(`outsideClickRegion: ${r.err}`)
    }
    return r
}
```

呼叫端：先取框與點擊處，截圖時以 `r`（去掉 `click`）為紅框矩形，再 `page.mouse.click(r.click.x, r.click.y)`。注入之回呼例（地圖畫布，依各程式庫自寫）：`hasFeatureAt: (x, y, el, r) => <以該程式庫查詢（x, y）±r 範圍內之渲染圖徵，有則 true>`。

**四、守門與盤查**

- 目視：點擊外側之框是否為可點區中最大之一塊？框外是否還有可點而未框之處？（SKILL §7.6-4，§6.3 清單）。可點區非矩形而框外仍有可點處屬預期（見上〈各型共同處理〉），只在另有更大之可點矩形未被選時才退件。
- 盤查既有標準圖：**不以紅框之顏色量框大小判定「已是大框」**——地圖之紅色圖層、粉紅圖示等會被當成框而誤判；以程式碼（呼叫之框選函式是否為本節之作法）確認。此限定於框之大小與作法；有無框仍依 SKILL §7.3-7 以像素掃描證明。
- 既有之小方框圖屬類別缺陷：同類全掃（§6.2-3），重產依 SKILL §7.9 取得授權，只重產受影響者；其後之結果圖若因點擊處改變而不同（例：點擊處落在地圖上、畫面上隨游標位置顯示之資訊隨之改變），一併列入。

## 4. 已知缺陷協定（壞畫面不凍結為標準圖）

產品缺陷出現在結果畫面（未捕捉例外、空白表格、開發伺服器的全頁錯誤覆蓋層）時：

1. **先排除測試環境**：以未注入任何測試 hook（真時鐘、不改設定）的環境重現一次；重現才算產品缺陷，寫進 spec〈已知落差〉附 `檔案:行號`。
2. **案例走到缺陷徵狀為止**：徵狀可偵測（列內容全空白、pageerror 訊息）→ `throw Object.assign(new Error('已知缺陷: …; 不產 <圖名>, 修復後補產'), { knownDefect: true })`。
3. **mocha 端**：`it()` 內 catch 到 `err.knownDefect` → 印一行 `[pending]` 訊息後 `this.skip()`（不綠不紅）。
4. **regen 端**：迴圈 catch 到 `knownDefect` → 印「已知缺陷，該步不產圖」後 `continue`，不列入失敗。
5. **修復後自動翻紅**：缺陷修好時徵狀消失 → 走到截圖 → 因缺標準圖而失敗 → 此時才補產。
6. 不用 `allowPageErrors` 放行、不把錯誤畫面當現況凍結——「標準圖凍結的是現況畫面」這句話本身就是錯的：現況壞掉的部分不是規格。
7. **修正（含上游升版）之後**：徵狀偵測保留為回歸守門並改為**直接判失敗**（已修正之缺陷再現是回歸；標 pending 會被當成略過而漏看）；偵測條件放寬到徵狀之整個類別，不留在當初撞到的那一個文字或元素（殷鑑：只認「儲存變更」之提示框偵測，漏掉對話框標題列 Save 鈕之同型殘留，已凍結進 6 張標準圖，升版後比對才揭露）。已凍結缺陷之標準圖以 `--write-mode changed` 只重產超出容差者，並以新舊差異範圍審圖（差異應只落在徵狀處）。

## 5. 程序級假時鐘（執行期寫入之時間戳不遮，固定它）

適用：資料庫建立 / 更新時間、登入時間等由**程式於執行期取當下時間**寫入的欄位。先追寫入點到底：schema 預設值、ORM 服務層的欄位補齊、批次 Worker、前端暫態——常見情況是決定性的那層在**後端**。

不適用：建置／打包時寫入之產製時間（寫入發生在測試之外）、兩時間點之差（耗時；`Date.now()` 刻意保留，差值必然浮動）——假時鐘管不到，走 SKILL §8.2 之比對端覆蓋，見 [unfixable-values-masking.md](unfixable-values-masking.md)。把它們當成「時間戳不遮」而放著不處理，每次重建或執行都會改寫標準圖。

```js
// preload 模組（node --import <file URL>），只攔無參數 new Date() / Date()，保留 Date.now()
// isShifted = false：凍結（預設）；true：平移（錨點＋掛上後之真實經過時間，見下）
function installFakeClock(anchorIso, g = globalThis, isShifted = false) {
    let RealDate = g.Date
    let anchor = new RealDate(anchorIso).getTime()
    let t0 = RealDate.now()
    let nowMs = () => (isShifted ? anchor + (RealDate.now() - t0) : anchor)
    function FakeDate(...args) {
        if (!new.target) { return new RealDate(nowMs()).toString() }
        if (args.length === 0) { return Reflect.construct(RealDate, [nowMs()], new.target) }
        return Reflect.construct(RealDate, args, new.target)
    }
    FakeDate.prototype = RealDate.prototype
    Object.setPrototypeOf(FakeDate, RealDate)
    FakeDate.now = () => RealDate.now()
    Object.defineProperty(RealDate.prototype, 'constructor', { value: FakeDate, writable: true, configurable: true })
    g.Date = FakeDate
}
```

- 兩個錨點：**種子錨點**（建庫程序）< **執行期錨點**（e2e 自行啟動的後端與瀏覽器），使測試中新增的資料在「最近項目」排序仍正確、且一眼分得出哪些是測試期間產生的。
- `Date.now()` 必須保留：debounce / throttle 靠差值，凍住即永不觸發。代價是寫入與讀取可能不同時鐘，須盤點（SKILL §8.2〈盤點寫入時鐘與讀取時鐘〉）。
- `--import` 用絕對 file URL；worker_threads 會繼承。
- 瀏覽器端以 `context.addInitScript` 掛同一段（限定 origin；函式需序列化，用字串形式：`` `(${installFakeClock})(${JSON.stringify(anchorIso)}, globalThis, ${isShifted})` ``）：**預設凍結**（日期選擇器預設月份等須固定者）；有以 `+new Date()` 算動畫經過時間的圖表頁改掛**平移**（`isShifted = true`）——凍結會讓動畫停在第 0 幀，但**不是不掛**：不掛則該頁之 `new Date()` 取真時鐘，與錨點資料脫節（依現在算出之值恆為 0 或恆為過期，見 SKILL §8.2〈盤點寫入時鐘與讀取時鐘〉）。只有確實須真實時間者才不掛，且須先盤點該頁有無瀏覽器端依現在算出之值。否決 Playwright `clock.setFixedTime`（管不到後端，且連 `Date.now()` 一起凍）。
- **平移之代價**：`new Date()` 隨案例實際耗時前進，案例須跑超過門檻才會跨過下一格（「最近 N 分鐘」之桶、「N 分鐘前」之字樣）。門檻以小時、天計者，實例中案例僅數分鐘，不受影響；門檻為分鐘級者另行評估（錨點距下一格之時間是否大於案例最長耗時）。平移使 `new Date()` 之值每輪略異，截圖若含其秒級以下之值（毫秒、秒），列入不可固定之值盤點（[unfixable-values-masking.md](unfixable-values-masking.md) §1）。
- 瀏覽類測試檔在 `before` 重置一次資料庫作守門，否則日常以真時鐘重建的資料庫會讓整檔假紅。
- 遮罩函數保留為 opt-in，且要做遮擋判定（`elementFromPoint`），否則黑塊會畫到上層彈窗之上。

## 6. 產製與目視紀律

### 6.1 每個實例一條鏈、一個程序、一份新 log

- 重產與 mocha 共用同一實例之後端與資料庫，**同一實例內同一時間只能有一個**在跑。啟動前列出所有 `baseline|mocha|srv` 程序並以監聽埠與命令列之路徑辨識所屬實例，本實例內者殺乾淨或等它結束（他實例之鏈不動）；不是自己啟動的先問。要並行就建埠位移之臨時實例、流程互斥分配（SKILL §1.5、[full-run-and-instances.md](full-run-and-instances.md) §5），不在同一實例內開第二條鏈。
- 多個重產批次串成一條 `(a; b; c)` 背景鏈，序列執行；每次執行用**沒用過的 log 檔名**。殷鑑：用 `until grep EXIT old.log` 等待，卻匹配到上一輪同名 log 的 EXIT，於是第二條重產與第一條並行，其 `startServersOnce` 殺掉第一條的後端，第一條剩下的案例全部逾時而圖仍是舊檔——結果我以為重產過了。
- 等待用 harness 的任務完成通知或**本輪** log 的 EXIT；中止背景鏈會連後段一起中止。背景任務到 `timeout` 即被終止（沒給是 30 分鐘、最長 2 小時；2026-10-03 實測），後段之 mocha／瀏覽器會以 exit 3221225794（0xC0000142）數秒內「失敗」——那不是重產失敗而是沒跑；背景鏈一律明給 `timeout`，預估超過 115 分鐘之長鏈改以 detached 執行再分段等待（SKILL §11.1），並以圖檔 mtime 核對哪些真的重產了。
- 異常結束後以**圖檔 mtime 對照本輪起訖時間**判斷哪些圖真的重產了，不憑 log 尾巴。`--write-mode changed` 保留之圖 mtime 不變，故案例是否跑過以產製端之 `[write]`／`[keep]` 紀錄判定，mtime 只確認寫檔。

### 6.2 產完先掃、再逐張看、再交審、才跑 mocha

1. **無框掃描**：偵測「長段紅線（同色連續 ≥ 20 px 的水平 / 垂直段）」才算框；統計紅像素數會被頁面本身的紅字（計數、標籤、警示）假陽性。輸出每張的框外接矩形，尺寸異常大（近整欄 / 整頁）者列為嫌疑。
2. **逐張目視**：每張圖對照 spec 視覺項那句「框住…」逐格核對——框的是不是那個東西、是否整顆、有沒有空白、有沒有被蓋、有沒有超出容器、是否只有一框。這一步不可用掃描取代；掃描只回答「有沒有框」，回答不了「框對不對」。
3. **同類全掃**：使用者退回一張，就是退回一個類別（框整欄、只框文字、多框、被蓋住…），把同類別的每張圖都翻出來查，不是只修被點名那張。殷鑑：八輪退圖，每輪都只修被點名的那張，下一張同類問題又被點名。
3a. **新舊圖都有的異狀也要追**：審重產圖時除了看差異範圍，也看新舊兩張共有之畫面是否合理——兩張都有代表它早已被凍結為標準圖，不代表它是規格（殷鑑：審「提示框殘留」之重產圖時，新舊兩張之紅色儲存鈕點擊後都呈淡灰底，追下去是焦點色只設了一半，三專案同病）。
3b. **審圖者對他人主張只認圖不認話**：實作者（或子代理）說「既有圖也是這樣」「這是元件既有行為」「掃描全過」時，審圖者自己開既有圖、或以探測重現後才採信；殷鑑：實作者稱既有查詢標籤圖只框到文字而提議整批重產，審圖者實際開圖兩張皆已框整顆，若照單全收會無故換掉已審過的真理。「約 1px、已無法再外移，請審圖時裁量」也是主張：審圖者自己逐列量像素，依 SKILL §7.3-8 之判準（≤ 1px 即缺陷）判定，不轉交使用者裁量（殷鑑：照轉後實測為 0～1px，同類全掃另找出 2 張，見 SKILL §7.3-10）。
3c. **框落在圖片邊緣之量測**：框之任一側落在圖片邊緣（外緣即圖片邊界或距邊界等於夾邊留距）時，沿該側逐列（或逐欄）找框線內緣之後第一個與底色亮度差 > 20 之像素，取最小距離；以框色長段紅線定框之前，先排除頁面本身同色系之元素（側欄之強調色條、紅字），否則外接矩形會抓錯。標出者逐張放大看，分三類：壓到文字或圖示墨跡（缺陷，依 SKILL §7.3-10 改框選目標）、只貼到目標自身之底色或外框（可）、目標本就超出畫面而被裁切處（可，SKILL §7.3-5 之「框可見部分」）。
3d. **整齊之結果要對照資料**：整欄全 0、全部過期、整表同值、整列空白這類「整齊」之結果，位元相同（連跑多輪不變、比對全綠）不代表正確——依現在算出之值落在錯的時鐘時，結果恆為同一個整齊之值，穩定性反而掩蓋錯誤。看到就對照種子資料或查詢結果（用量表逐列對種子資料加總）確認該值是否本該如此；本該如此者於映射表註明依據，否則先依 SKILL §8.2〈盤點寫入時鐘與讀取時鐘〉查讀取時鐘（含瀏覽器端）。殷鑑：統計頁之用量表「最近 N」各欄全為 0，凍入標準圖與手冊用圖數月，輪對輪位元相同而無人起疑。
4. **交使用者審圖**：標準圖同時是手冊用圖，業主要先看圖；使用者難以逐張開圖檔時以圖文對照之審圖報告交審（只收本輪新增／變動案例、每圖附圖鍵與框住對象，見 dispatch-and-review-workflow §6），已有手冊者手冊同輪更新；未經認可不跑 mocha 比對（跑了也只是把未審的圖當真理；全量執行依 SKILL §7.11，採用經審差異後即 `--accept` 或比對、由使用者事後檢視）。
5. 認可後才跑 mocha 全跑與 `--grep` 單跑一致性，然後回報。

### 6.3 每張圖的目視核對清單

```
- [ ] 先讀圖名與檢查點之用途(操作前／操作後／兼任),定出此圖要指的是哪一個元素,再看框是否正好框住它;兼任圖只框下一步之目標(SKILL §7.1)
- [ ] 檔名之序號、階段序、kebab 名與 spec 視覺項一致
- [ ] 點擊前的圖：框在將被點的那個元素上，元素整顆入框（點擊外側者改依下一項）
- [ ] 點擊外側（遮罩、背景、面板以外）之圖：框是否為可點區中最大之一塊？框外是否還有可點而未框之處？框不是點擊處之小方框（§3.1）
- [ ] 點擊後的圖：框在 spec 括號所寫的反應對象上；對象整顆；不含大片空白
- [ ] 只有一個框
- [ ] 框沒被夾到畫面外、沒超出所在容器（彈窗 / 抽屜）
- [ ] 框任一側落在圖片邊緣者：該側框內緣至墨跡 ≥ 2px（逐列量像素；≤ 1px 依 SKILL §7.3-10 改框選目標）
- [ ] 被遮罩或彈窗蓋住的目標已改框上層
- [ ] 表格 / 清單只框有內容處；抽屜 / 彈窗框整個面板
- [ ] 畫面本身沒有錯誤覆蓋層、空白表格、載入中狀態
- [ ] 整欄全 0、全部過期、整表同值這類整齊之結果已對照資料確認（位元相同不代表正確，§6.2 3d）
- [ ] 游標已移開，畫面上沒有殘留之提示框或 hover 底色；剛點過之按鈕其焦點外觀與按鈕身分一致（強色按鈕點擊後不應變灰、圖示仍清楚）
- [ ] 頁首沒有因捲動被切掉數 px（與同流程其他圖對齊）
```
