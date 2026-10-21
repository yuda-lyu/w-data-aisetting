# 動效工法：預算、曲線、時長、配方、禁忌

**先讀這一段**：動效是最後一道工序。靜態頁面必須先完成、先在三個寬度的截圖上站得住（主檔 Step 5、Step 6）；動效不是拿來救弱版面的。工具的輕重層級（CSS → 框架狀態＋`requestAnimationFrame` → 自訂時間軸 → Popmotion；避免 GSAP／Framer Motion／Lottie 等重型函式庫）見主檔〈動畫／影片示範〉，本檔管「動什麼、怎麼動」。

**數據出處**：研究數字出自 [taste-skill](https://github.com/Leonxlnx/taste-skill)（MIT）對 2026-07 至 10 月 99 個 Awwwards Sites of the Day 的量測（1440 與 390 寬，記錄載入與捲動時實際執行的 transition、tween 與捲動觸發）。

## 目錄

1. 不同產物的動效預算
2. 動手前的四個問題
3. Token
4. 時長、錯開、揭示
5. 捲動相關動效
6. 招牌動作
7. 配方
8. 減少動態與效能
9. 一眼就是生成的動效
10. 規則總表

---

## 1. 不同產物的動效預算

| 產物 | 預算 |
|---|---|
| **頁面**（登陸頁、行銷頁、作品集） | 四個部分，見下 |
| **工作畫面**（儀表板、後台、設定、清單） | **只有回饋**：按壓、hover、focus、選單或面板開啟、新列抵達。畫面上沒有任何東西做進場表演 |
| **互動原型** | 依其內容是頁面或工作畫面，套對應的預算；轉場依產品本身的動效語言 |
| **簡報** | 換頁轉場一種、全份一致；單張內的進場最多一個序列 |
| **動態示範／影片** | 由時間軸驅動，見主檔〈動畫／影片示範〉；本檔的曲線與時長仍適用 |

**頁面的四個部分**：

1. **一個招牌動作**：訪客一小時後會描述的那件事——從遮罩升起的標題、像快門打開的圖、隨捲動縮放的字標（§6）。只做一個、做好；它是唯一被允許大聲的動作。
2. **每段依內容編排的進場**：段落的各部分依閱讀順序抵達（標題 → 文字 → 圖 → 細節），錯開 60–90ms、上升 16–32px 並帶透明度，只觸發一次。依內容換方式，不要每段蓋同一個預設：清單逐列、圖從遮罩打開或從微放大落定、數字只算一次、陳述逐行升起。不是整塊一個淡入，也絕不在腳本失敗時讓內容一直藏著。
3. **手底下的回饋**：按鈕按下有反應、連結回應指標、卡片與圖在 hover 時有一個一致而小的反應、選單從被點的地方打開。
4. **一個動的畫面**（有真實素材時）：使用者提供的影片做成靜音循環並有海報幀，或大照片上緩慢的漂移、縮放，或主視覺圖隨捲動移動。

不動的頁面讀起來像 mock-up；整頁每塊都同一種淡入讀起來像沒人做過決定。編排過、只有一個被保護的高潮，讀起來是有人決定過。

---

## 2. 動手前的四個問題

1. **一次造訪會看到幾次？** 一次（主視覺載入、段落揭示）：可以慢慢來。很多次（hover、選單、手風琴）：快而小。上百次（鍵盤操作、打字）：不要動畫。
2. **它做什麼用？** 有效的答案：說明東西從哪來、確認一個動作、讓變化不突兀、解釋產品怎麼運作、它就是招牌動作。「好看」只對招牌動作有效。
3. **用哪種曲線？** 進入或離開：ease-out，讓動作在視線到達的瞬間就開始。在畫面上兩處之間移動：ease-in-out。hover 的顏色與透明度：`ease`。等速移動（跑馬燈、進度）：`linear`。`ease-in` 讓介面感覺慢（前幾幀幾乎不動），只用於「永久離開」。CSS 關鍵字曲線太弱，用 §3 的 token。
4. **多長？** 按壓回饋 100–160ms；hover 150–200ms；選單與 popover 150–250ms；對話框與抽屜 250–450ms；段落與主視覺揭示 500–900ms。離開比抵達快（約 70%）。

---

## 3. Token

```css
:root {
  --ease-out: cubic-bezier(0.22, 1, 0.36, 1);          /* 進場、會移動的 hover、600ms 以下的 UI */
  --ease-expo: cubic-bezier(0.16, 1, 0.3, 1);          /* 800ms 以上的揭示、逐行升起、圖的打開 */
  --ease-in-out: cubic-bezier(0.76, 0, 0.24, 1);       /* 擦拭、面板、可見狀態下移動的東西 */
  --ease-soft: cubic-bezier(0.33, 1, 0.68, 1);         /* 照片上緩慢的縮放與漂移 */
  --ease-exit: cubic-bezier(0.55, 0.055, 0.675, 0.19); /* 永久離開的東西，短 */
  --t-press: 140ms;
  --t-hover: 180ms;
  --t-ui: 240ms;
  --t-reveal: 800ms;
  --t-open: 1200ms;                                    /* 圖的打開、clip 擦拭 */
  --stagger-line: 90ms;
  --stagger-item: 70ms;
}
```

研究依據：quint out（`--ease-out`）是實際執行的轉場中最常被選用的曲線；expo out（`--ease-expo`）在 28 份樣式表出現、14 個網站實際執行，是長揭示用的曲線；所有實際執行動作的中位時長是 420ms。不採用：框架預設的 `.4,0,.2,1`，以及介面元素上的回彈（overshoot）曲線。

---

## 4. 時長、錯開、揭示

- **時長**：按壓 140ms；hover 顏色 180–200ms；會移動東西的 hover（標籤翻滾、箭頭）300–400ms；選單 240ms；揭示 700–900ms；圖的打開 1100–1300ms；離開是對應進場的 60–70%。
- **錯開**：行 80–110ms；清單項 50–90ms；字元 20–40ms 且只用在一到三個字的標題；任何一個序列最多四步。
- **揭示**：只觸發一次，元素頂端到達視窗由上往下約 85–90% 時；上升 12–32px 或從行遮罩升起；畫面內的東西藏起來不超過 900ms；**首屏內容不等捲動**。
- **首幀**：標題、說明句、主圖都在 HTML 裡、第一幀就畫出來。載入序列不等 load 事件，1.2 秒內落定，最多四個元素。研究中，讀者稱為「有禮貌」的開場約在 1–1.2 秒內結束；三分之一的頁面到 4.5 秒仍不可讀。
- **沒有載入畫面、計數器、進站門檻、自訂游標、滾輪劫持。** 研究中 60 個網站開頭是載入畫面，但它們蓋住的多半是早已載完的頁面；讀者的設計分數不受等待影響，只有可用性下降。

---

## 5. 捲動相關動效

- **與捲軸鎖定、線性**：捲動本身就是曲線。研究中 18 個做捲動擦洗的網站，14 個不加平滑。
- **視差**行程小於元素的 8%；縮放在 0.94–1.15 之間；用 CSS 捲動時間軸寫在 `@supports (animation-timeline: view())` 裡，不支援的瀏覽器得到靜態狀態。
- **捲動時間軸需要一個捲動容器**：`animation-timeline: view()` 取最近的捲動容器，而 `overflow: hidden` 會製造一個——放在 `overflow: hidden` 框裡的圖因此永遠不會動。框改用 `overflow: clip`，或在段落上命名時間軸（`view-timeline-name: --hero`）讓子元素指向它。
- **釘住的舞台**（`position: sticky`）：一步約一屏、一個舞台最多三屏，每一屏釘住的畫面都要有一行字。研究中有釘住元素的頁面長度是兩倍、每屏字數卻更少。
- **依章節換色**：在段落邊緣硬切，固定的頁首墨色在 300ms 內跟上；絕不從 observer 重新上色整頁。
- **橫向移動**：優先用原生可拖曳列（`overflow-x: auto; scroll-snap-type: x mandatory`）；釘住的橫向畫廊只用在不到三屏長的列，並支援鍵盤。
- **頁到頁**：View Transitions，最長 480ms，減少動態時關閉。

---

## 6. 招牌動作

依主題挑一個；動作若不說明主題的任何事，它就是裝飾，頁面沒有它更好。

| 動作 | 發生什麼 | 怎麼做 |
|---|---|---|
| 遮罩標題 | 各行從自己的基線後方升起 | §7「遮罩逐行升起」 |
| 快門圖 | 主視覺或展示圖從一邊打開，同時由 1.12 倍落定 | §7「快門圖」 |
| 縮放字標 | 巨大的字標隨主視覺捲出而縮放幾個百分比 | 捲動時間軸驅動 `scale` |
| 釘住的故事 | 標題釘住，項目從旁捲過 | `position: sticky` |
| 索引＋預覽 | 文字列，hover 的那列顯示它的圖，錨定在該列 | 作品集首選 |
| 幕簾頁尾 | 捲到底時最後一段從頁面下方露出 | `position: sticky; bottom: 0` 的頁尾，主內容有背景與 `z-index` |
| 緩慢交叉淡化 | 主視覺在 3–4 張照片間交叉淡化，每張 5–6 秒 | 疊放的圖、opacity keyframes，分頁隱藏時暫停 |
| 滿版跑馬燈 | 一行巨大的字緩慢橫移 | 內容複製一份、`translateX(-50%)` 線性循環；hover 與減少動態時暫停；全頁最多一個 |
| 拖曳列 | 一排大圖可橫向捲動、有吸附 | 原生 scroll snap，不用函式庫 |
| 依章節換色 | 每章一片滿版色域，固定頁首取下方章節的墨色 | 段落背景用 CSS |
| 開窗 | 字的畫面交棒給大圖：釘住舞台中間的一扇窗在約一屏內打開成滿版 | 捲動時間軸驅動 `clip-path` |
| 墨水填色陳述 | 一句陳述隨升起穿過畫面，從 45% 墨色填到全墨色 | 全頁一次 |
| 圖上覆紙 | 一張滿版照片釘住一屏，下一章以不透明紙面滑上蓋過 | 100svh 的 `position: sticky; top: 0` figure，後接有自己背景與更高 `z-index` 的段落，不用腳本 |
| 推行的一行 | 一行巨大的字被捲動推著橫移，在行程中段完整可讀 | `animation-timeline: view()`、`translateX` 從 12% 到 -12%、線性；不支援時靜態 |
| 滾動的數字 | 撐起論點的幾個數字只滾動到位一次 | 報告、基金、以數字領頭的專業 |

依主題挑：作品集要索引＋預覽；餐廳要緩慢交叉淡化；產品要它主視覺物件上的快門；有一張好照片的產品或地方用開窗；每章各有一張圖用圖上覆紙；品牌主張是一個字用推行的一行。

---

## 7. 配方

所有配方在 JavaScript 關閉時內容照樣可見，所有「隱藏起始狀態」都放在 `prefers-reduced-motion: no-preference` 裡（這樣寫，完成狀態就是起點，不論受眾都照寫；需做無障礙時它同時是減少動態的合規作法，見 §8），並使用 §3 的 token。隱藏狀態只在 `html.js` 下生效，由一行內嵌腳本設定：

```html
<script>document.documentElement.classList.add('js')</script>
```

### 1.2 秒內的載入序列

```html
<header class="hero">
  <h1 class="display lines">
    <span class="line"><span data-line style="--i:0">給小廚房的</span></span>
    <span class="line"><span data-line style="--i:1">凳子</span></span>
  </h1>
  <p class="lead" data-load style="--d:420ms">…</p>
  <a class="button" data-load style="--d:480ms" href="#stools">看看這些凳子</a>
  <figure class="hero__picture" data-open><img src="stool.jpg" alt="…" fetchpriority="high"></figure>
</header>
```

```css
.hero__picture { overflow: clip; margin: 0; }
@media (prefers-reduced-motion: no-preference) {
  .js .hero [data-line] { transform: translateY(105%); animation: load-line 800ms var(--ease-expo) forwards; animation-delay: calc(100ms + var(--i) * var(--stagger-line)); }
  .js .hero [data-load] { opacity: 0; transform: translateY(12px); animation: load-rise 500ms var(--ease-out) forwards; animation-delay: var(--d); }
  .js .hero [data-open] { clip-path: inset(0 0 100% 0); animation: load-open 1000ms var(--ease-in-out) 150ms forwards; }
  .js .hero [data-open] img { transform: scale(1.08); animation: load-settle 1100ms var(--ease-expo) 100ms forwards; }
}
@keyframes load-line { to { transform: none; } }
@keyframes load-rise { to { opacity: 1; transform: none; } }
@keyframes load-open { to { clip-path: inset(0); } }
@keyframes load-settle { to { transform: none; } }
```

時間線：標題各行在 100–990ms 升起，圖在 150–1150ms 打開，說明句與按鈕在 420–980ms 抵達；1.2 秒內全部落定，最多四件事。預載顯示字體（`<link rel="preload" as="font" type="font/woff2" crossorigin>`），讓各行用真正的字體升起；圖加 `fetchpriority="high"` 並給它一個取自圖本身的底色，慢圖才會打開在自己的顏色上而不是空框。

### 遮罩逐行升起

標題最多兩行，所以斷行由你寫、每行各包一層：

```css
.lines .line { display: block; overflow: hidden; padding-bottom: 0.08em; margin-bottom: -0.08em; }
.lines [data-line] { display: block; }
@media (prefers-reduced-motion: no-preference) {
  .js .lines [data-line] { transform: translateY(105%); animation: line-up 900ms var(--ease-out) forwards; animation-delay: calc(var(--i) * 110ms + 150ms); }
}
@keyframes line-up { to { transform: none; } }
```

`padding-bottom` 與負 margin 這一對，讓下伸部（g、y、p）不被遮罩切掉。手機上兩行可能各自再折行：看手機截圖，必要時寫一組較短的手機斷行，或縮小字級。

### 捲動揭示（只一次）

只給值得的兩三段，不是每一塊：

```css
@media (prefers-reduced-motion: no-preference) {
  .js [data-reveal] { opacity: 0; transform: translateY(24px); transition: opacity 700ms var(--ease-out), transform 900ms var(--ease-out); }
  .js [data-reveal].is-in { opacity: 1; transform: none; }
}
```

```js
const io = new IntersectionObserver((entries) => {
  for (const e of entries) if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
}, { rootMargin: '0px 0px -12% 0px', threshold: 0.1 });
document.querySelectorAll('[data-reveal]').forEach((el) => io.observe(el));
```

絕不用 scroll 事件掛揭示、絕不在元素重新進入時重播、絕不在 observer 沒觸發時讓東西停在 `opacity: 0`（`html.js` 處理無 JS，`unobserve` 處理重播）。

### 快門圖

```css
.shutter { overflow: hidden; }
@media (prefers-reduced-motion: no-preference) {
  .js .shutter { clip-path: inset(0 0 100% 0); transition: clip-path 1100ms var(--ease-in-out); }
  .js .shutter img { transform: scale(1.12); transition: transform 1500ms var(--ease-soft); }
  .js .shutter.is-in { clip-path: inset(0); }
  .js .shutter.is-in img { transform: none; }
}
```

### 按壓與 hover

```css
.button { transition: transform var(--t-press) var(--ease-out), background-color var(--t-hover) ease, color var(--t-hover) ease; }
.button:active { transform: scale(0.97); }
.link { text-decoration: underline; text-decoration-color: transparent; text-underline-offset: 0.2em; text-decoration-thickness: 0.07em; transition: text-decoration-color var(--t-hover) ease; }
@media (hover: hover) and (pointer: fine) {
  .button:hover { background-color: var(--accent-strong); }
  .link:hover { text-decoration-color: currentColor; }
}
```

hover 放在 `(hover: hover)` 後面，因為觸控裝置點一下會觸發 hover 並卡住。hover 要提高對比、絕不降低；hover 時不改字重（文字會重排）；不要每張卡片 hover 都上浮或放大，一個一致而小的反應就夠。

### 不用 JavaScript 的捲動連動

```css
@supports (animation-timeline: view()) {
  @media (prefers-reduced-motion: no-preference) {
    .drift { animation: drift linear both; animation-timeline: view(); animation-range: entry 0% exit 100%; }
    @keyframes drift { from { transform: translateY(-4%); } to { transform: translateY(4%); } }
  }
}
```

### 釘住的故事

```css
.story { display: grid; grid-template-columns: 5fr 7fr; gap: var(--gutter); align-items: start; }
.story__title { position: sticky; top: 18vh; }
@media (max-width: 800px) { .story { grid-template-columns: 1fr; } .story__title { position: static; } }
```

---

## 8. 減少動態與效能

- **減少動態（需做無障礙時必做，受眾分級見主檔〈受眾分級〉）**：`prefers-reduced-motion: reduce` 是「更少、更溫和」，不是「完全沒有」：保留透明度與顏色變化，拿掉位移、縮放、視差與自動播放。所有隱藏狀態都寫在 `no-preference` 區塊裡，減少動態的狀態就是完成狀態。研究中 99 個網站只有 35 個有任何 `prefers-reduced-motion` 規則。不做無障礙的受眾照 §7 配方寫即可，不另做減少動態的驗證。
- 只動 `transform`、`opacity`、`clip-path`。動 `width`、`height`、`top`、`left`、`margin`、`padding` 每一幀都會觸發排版；手風琴用 `grid-template-rows` 是可接受的例外（短且少見）。
- 不要用父層一個變動的 CSS 變數驅動很多子元素；把 transform 設在真正要動的元素上。
- `will-change` 只給即將動的元素，動完移除。
- 循環在畫面外或分頁隱藏時暫停。
- 沒有滾輪劫持、沒有自訂游標；平滑捲動函式庫不預設使用。

---

## 9. 一眼就是生成的動效

- 每一塊都同一個淡入上升。
- 主視覺裡十幾個錯開的進場。
- 每張卡片、每張圖 hover 都上浮或放大。
- 介面元素用回彈或彈性曲線。
- 沒有意義的無限循環：脈動的圓點、漂浮的形狀、閃爍的文字、旋轉的徽章。
- 沒觸發的揭示，在頁面留下一條空白帶（動效做完後重新截圖，逐張找缺掉的內容）。
- 載入畫面與計數器、進站門檻、滾輪劫持、自訂游標。
- 打字機與亂碼解碼效果：標題四秒讀不出來、動作等打字結束才出現。真的字整個抵達。
- 內容停在零透明度：等捲動停下才顯示的文字、非作用中的項目淡到 10–15%、陳述停在半淡。揭示只在首屏以下、只一次、在畫面內不超過 900ms；淡化不低於 40%；填色從 45% 開始。
- 動作壓過文字：跑馬燈與漂浮物件橫越陳述、滑動的一行切掉自己的字、移動中殘留模糊。正在被讀的文字上不能有東西移動；移動的一行在行程中某一點必須完整可讀。
- 沒有關閉方式的無盡循環：顆粒、脈動圓點、等化器、旋轉徽章，多數沒有減少動態規則。

研究網站常見、但本技能改寫的作法：釘住舞台上的細線進度條與刻度軌，改成內文字體的「2／4」；補零的計數器（「01／08」）改成一般計數或不放；交叉淡化的漸層底改成依章節硬切的平塗色；等寬 HUD 標籤改成內文字體的小字。

---

## 10. 規則總表

1. **首幀**：標題、說明句、主圖在 HTML 裡、第一幀畫出；載入序列不等 load 事件，1.2 秒內落定，最多四個元素。
2. **不要**：載入畫面、計數器、門檻、自訂游標、滾輪劫持。
3. **曲線**：600ms 以下用 `--ease-out`；800ms 以上的揭示用 `--ease-expo`；擦拭與移動用 `--ease-in-out`；只有永久離開用 `--ease-exit`；捲動連動與循環用 `linear`；顏色用 `ease`。不回彈。
4. **時長**：按壓 140ms；hover 顏色 180–200ms；會移動的 hover 300–400ms；選單 240ms；揭示 700–900ms；圖的打開 1100–1300ms；離開是進場的 60–70%。
5. **錯開**：行 80–110ms；清單項 50–90ms；字元 20–40ms 且只用在一到三個字的標題；一個序列最多四步。
6. **揭示**：只一次、元素頂端到視窗 85–90% 處觸發；上升 12–32px 或從行遮罩；畫面內的東西藏起來不超過 900ms；首屏不等捲動。
7. **捲動連動保持安靜**：線性且鎖定捲軸；視差小於元素 8%；縮放 0.94–1.15；寫在 `@supports` 裡、不支援時靜態；釘住舞台一步約一屏、最多三屏、每一屏都有一行字。
8. **各一個**：一個招牌動作、一個動的畫面、最多一個跑馬燈。
9. **文字保持可讀**：填色從 45% 墨色開始；淡化不低於 40%；模糊最多 8px 且落定後消失；正在被讀的文字上沒有東西移動。
10. **依章節換色**：段落邊緣硬切；固定頁首的墨色 300ms 內跟上。
11. **減少動態**（需做無障礙時）：所有隱藏狀態都在 `prefers-reduced-motion: no-preference` 裡；減少動態的頁面就是完成的頁面；循環停止。
12. **工作畫面**：只有回饋，沒有進場表演。
