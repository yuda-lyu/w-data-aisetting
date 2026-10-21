# 進階參考：框架無關的樣板與資源

本檔收錄**與框架無關**的樣板與設計資源。框架專屬的元件樣板（React／Vue 3／Vue 2 版的裝置外框、Tweaks 面板、動畫引擎、ThemeProvider、設計畫布）請見：

- [patterns-react.md](patterns-react.md) —— React 18 + Babel inline JSX
- [patterns-vue3.md](patterns-vue3.md) —— Vue 3 + Composition API
- [patterns-vue2.md](patterns-vue2.md) —— Vue 2 + Options API

## 目錄

1. [響應式簡報引擎](#響應式簡報引擎)
2. [資料視覺化樣板](#資料視覺化樣板)
3. [配色系統：角色、oklch 與取色程序](#配色系統角色oklch-與取色程序)
4. [字體選擇程序](#字體選擇程序)

**為什麼這裡不給「推薦字體表」與「推薦配色表」**：每一份公開的「改用這個」清單，幾個月內就變成下一波 AI 味（taste-skill 的 tells 紀錄把這列為原則）。所以本檔給的是**程序**——從品牌、從主題本身取得字體與顏色——加上明確禁止的族群，而不是某幾套現成組合。

---

## 響應式簡報引擎

用來製作固定尺寸、自動適應任何 viewport 的簡報。**純 HTML + JS，不依賴框架**，可直接嵌入任何專案。

**關鍵約定**：
- 內部陣列使用 0-indexed，**但呈現給使用者的數字永遠是 1-indexed**
- 每個 `<section class="slide">` 加上 `data-screen-label="01 Title"`、`data-screen-label="02 Agenda"` 等**屬性**以便引用；這是給人與工具對照用的標籤，不要把「01」「02」印在投影片上當裝飾（見主檔預設禁令），頁面上的位置用右下角的一般計數（「3 / 12」）
- 控制按鈕放在 `.stage` 縮放容器**外部**，確保在小螢幕上仍可使用
- 字體來自 Step 3 宣告的字體 token，不在樣板裡寫死

```html
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { 
    background: #000; 
    display: flex; 
    align-items: center; 
    justify-content: center;
    height: 100vh;
    overflow: hidden;
    font-family: var(--font-text);   /* 依「字體選擇程序」定義於 :root */
  }
  .stage {
    width: 1920px;
    height: 1080px;
    position: relative;
    transform-origin: center center;
  }
  .slide {
    position: absolute;
    inset: 0;
    display: none;
    padding: 80px;
  }
  .slide.active { display: flex; }
  .controls {
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    gap: 12px;
    z-index: 1000;
  }
  .controls button {
    padding: 8px 16px;
    border: none;
    border-radius: 6px;
    background: rgba(255,255,255,0.15);
    color: white;
    cursor: pointer;
    font-size: 14px;
  }
  .slide-counter {
    position: fixed;
    bottom: 20px;
    right: 20px;
    color: rgba(255,255,255,0.6);
    font-size: 14px;
  }
</style>

<script>
  // 自動縮放適應
  function scaleStage() {
    const stage = document.querySelector('.stage');
    const scaleX = window.innerWidth / 1920;
    const scaleY = window.innerHeight / 1080;
    const scale = Math.min(scaleX, scaleY);
    stage.style.transform = `scale(${scale})`;
  }
  window.addEventListener('resize', scaleStage);
  scaleStage();

  // 投影片導覽
  let current = parseInt(localStorage.getItem('slideIndex') || '0');
  const slides = document.querySelectorAll('.slide');
  
  function showSlide(n) {
    current = Math.max(0, Math.min(n, slides.length - 1));
    slides.forEach((s, i) => s.classList.toggle('active', i === current));
    localStorage.setItem('slideIndex', current);
    // 呈現給使用者的是 1-indexed，內部儲存為 0-indexed
    document.querySelector('.slide-counter').textContent = `${current + 1} / ${slides.length}`;
  }
  
  document.addEventListener('keydown', e => {
    if (e.key === 'ArrowRight' || e.key === ' ') showSlide(current + 1);
    if (e.key === 'ArrowLeft') showSlide(current - 1);
  });
  
  showSlide(current);
</script>
```

每一張投影片照頁面的規則看待：一張海報、一個主角、標題兩行以內（[page-craft.md](page-craft.md)）。

---

## 資料視覺化樣板

**優先順序（由高至低）**：

| 情境 | 推薦 | 理由 |
|---|---|---|
| 儀表板、複雜互動、大資料集 | **ECharts**（預設） | 涵蓋折線/長條/圓餅/散點/熱力/關係圖等數十種圖表類型、內建 zoom/pan/tooltip/legend、支援百萬級資料點 |
| 小規模、快速拋棄式原型、簡單需求 | **Chart.js** | 輕量、API 最簡單、適合登陸頁上的單一圖表 |
| 完全客製視覺、藝術向資料藝術 | **D3.js**（見主檔 SKILL.md 常用 CDN 一節） | 最底層，學習曲線陡，但表現力最強 |

不確定時選 ECharts —— 它涵蓋 Chart.js 八成的使用情境，且從小圖表延伸到複雜儀表板不需換庫。

**圖表的設計規則**（哪種問題用哪種圖、一圖一序列、格線與刻度、直線段、單一色相、圖例、註記）在 [app-screens.md](app-screens.md) §6；下面的樣板已照那些規則設定。兩個重點：

- **顏色全部從 CSS token 讀**：ECharts／Chart.js 不直接讀 CSS 變數，用 `getComputedStyle` 讀出後傳入。不要在圖表設定裡寫死色碼（`#3b82f6` 這類預設藍就是「野色」）。
- **不用 ECharts 內建的 `'dark'` 主題**：它自帶一個帶藍的深色背景與自己的色盤，會蓋掉設計系統。切換主題時重新讀 token、重設 option 即可。

---

### ECharts（優先）

```html
<div id="chart" style="width: 100%; height: 240px;"></div>
<script src="https://cdn.jsdelivr.net/npm/echarts@5.5.1/dist/echarts.min.js"></script>
<script src="data.js"></script>   <!-- window.DATA = { revenue: [...], target: ... }；內容由使用者提供，見主檔「缺資料」 -->
<script>
  const DATA = window.DATA;

  // 從 CSS token 讀色（工作畫面 token 名見 app-screens.md §9.5；頁面用 --ink / --muted 等）
  function readTokens() {
    const css = getComputedStyle(document.documentElement);
    const v = (name) => css.getPropertyValue(name).trim();
    return { text: v('--text'), muted: v('--muted'), grid: v('--grid'), accent: v('--accent'), surface: v('--surface'), font: v('--font') };
  }

  function buildOption(t) {
    return {
      backgroundColor: 'transparent',            // 底色交給頁面
      textStyle: { fontFamily: t.font },
      tooltip: {                                 // 素面框、無箭頭；標籤與數值一行
        trigger: 'axis',
        backgroundColor: t.surface, borderColor: t.grid, borderWidth: 1, padding: [6, 10],
        textStyle: { color: t.text, fontSize: 12 }
      },
      legend: { show: false },                   // 單一序列不放圖例：卡片標題已說明它是什麼
      grid: { left: 40, right: 16, top: 16, bottom: 28 },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: ['1月', '2月', '3月', '4月', '5月', '6月'],
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: t.muted, fontSize: 12, rotate: 0 }   // 標籤水平，不旋轉
      },
      yAxis: {
        type: 'value',
        splitNumber: 4,                          // 3–5 條淡格線
        axisLine: { show: false },               // 沒有 y 軸線
        splitLine: { lineStyle: { color: t.grid, width: 1 } },
        axisLabel: { color: t.muted, fontSize: 12 }
      },
      series: [{
        name: '營收',
        type: 'line',
        smooth: false,                           // 直線段：平滑曲線會捏造兩點之間的數值
        showSymbol: false,                       // 不畫資料點，只有 hover 時出現
        lineStyle: { color: t.accent, width: 2 },// 唯一的色相放在主要資料元素上
        itemStyle: { color: t.accent },
        data: DATA.revenue,                      // 資料來自資料檔（見 app-screens.md §2.1），不寫死在這裡
        markLine: {                              // 參考線：1px 虛線、標籤在末端
          symbol: 'none',
          lineStyle: { type: 'dashed', width: 1, color: t.muted },
          label: { position: 'end', color: t.muted, fontSize: 12 },
          data: [{ yAxis: DATA.target, name: '目標' }]
        }
      }]
    };
  }

  const chartEl = document.getElementById('chart');
  const chart = echarts.init(chartEl);           // 不指定內建主題
  chart.setOption(buildOption(readTokens()));

  // 主題切換（prefers-color-scheme 或 Tweaks）：token 改了之後重讀並重設，不必 dispose
  function applyTheme() { chart.setOption(buildOption(readTokens()), true); }
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);

  // 響應式：容器尺寸變動時重繪
  new ResizeObserver(() => chart.resize()).observe(chartEl);
</script>
```

**常用配置要點**：
- `tooltip.trigger: 'axis'`：折線／長條圖用；`'item'`：散點／環圖用。
- **註記重要事件**：比平常變化大約三倍以上的跳升或尖峰，用 `markLine`（`xAxis` 指向該點）加 12px 標籤寫出原因。
- **面積**：真的需要時 `areaStyle: { color: t.accent, opacity: 0.14 }`（約 14% 平塗），不用漸層 colorStops。
- **長條**：`itemStyle.borderRadius: [4, 4, 0, 0]` 以內（頂部最多 4px、底部直角）；堆疊段用 1–2px 縫（`borderColor` 設為卡片底色、`borderWidth: 1`）。
- `dataZoom`：`[{ type: 'inside' }, { type: 'slider' }]` —— 時序大資料集才需要。
- 大資料集：`large: true, largeThreshold: 2000` 啟用優化渲染路徑。

---

### Chart.js（輕量替代）

```html
<canvas id="myChart" width="800" height="240"></canvas>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.7/dist/chart.umd.min.js"></script>
<script src="data.js"></script>   <!-- window.DATA，同上 -->
<script>
  const DATA = window.DATA;
  const css = getComputedStyle(document.documentElement);
  const tok = (name) => css.getPropertyValue(name).trim();

  const ctx = document.getElementById('myChart').getContext('2d');
  const chart = new Chart(ctx, {
    type: 'line', // bar 等；份額用細環或 100% 堆疊長條，最多五份
    data: {
      labels: ['1月', '2月', '3月', '4月', '5月', '6月'],
      datasets: [{
        label: '營收',
        data: DATA.revenue,          // 來自資料檔
        borderColor: tok('--accent'),
        borderWidth: 2,
        tension: 0,                  // 直線段
        pointRadius: 0,              // 不畫資料點
        pointHoverRadius: 4,
        fill: false
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false }   // 單一序列不放圖例
      },
      scales: {
        y: {
          beginAtZero: true,
          border: { display: false },                // 沒有 y 軸線
          grid: { color: tok('--grid') },
          ticks: { color: tok('--muted'), maxTicksLimit: 5 }
        },
        x: {
          grid: { display: false },
          ticks: { color: tok('--muted'), maxRotation: 0 }   // 不旋轉
        }
      }
    }
  });

  // 容器尺寸變動時重繪
  new ResizeObserver(() => chart.resize())
    .observe(document.querySelector('#myChart').parentElement);
</script>
```

---

## 配色系統：角色、oklch 與取色程序

### 1. 角色

頁面用下列角色；**全站每一個顏色都來自這些 token**。元件裡出現一個原始色碼，就是第二套配色的開始。不要在角色之間加灰：要較安靜的文字就是 `--muted`，要較安靜的表面就是 `--surface`。（工作畫面用 [app-screens.md](app-screens.md) §9.5 的 token：`--ground` 對應 `--bg`、`--text` 對應 `--ink`。）

```css
:root {
  --bg: …;          /* 底：大部分面積 */
  --surface: …;     /* 與底差一階：實心面板、表單欄位、磚 */
  --ink: …;         /* 主要文字與最強的標記 */
  --muted: …;       /* 次要文字；在 --bg 上讀得清（參考 4.5:1，需做無障礙時為門檻） */
  --accent: …;      /* 唯一的強調色 */
  --accent-ink: …;  /* 強調色上的文字 */
  /* 有段落色域時：--field-1 … --field-n，各配自己的 --field-n-ink */
}
```

### 2. 用 oklch 衍生

oklch 在亮度維度上是感知均勻的，從一個顏色衍生出表面與次要文字最自然：

```css
:root {
  /* 色相與彩度由「取色程序」決定，下列數值只是示範結構 */
  --bg: oklch(0.97 0.01 var(--ground-h));
  --surface: oklch(from var(--bg) calc(l - 0.04) c h);       /* 差 2–6 個亮度點：一階就夠 */
  --ink: oklch(0.22 0.02 var(--ground-h));
  --muted: oklch(from var(--ink) calc(l + 0.25) c h);        /* 調到在 --bg 上讀得清（需做無障礙時 ≥ 4.5:1） */
  --accent: oklch(0.55 0.15 var(--accent-h));
}
```

（相對色語法 `oklch(from …)` 不支援的瀏覽器，直接寫出算好的 `oklch(L C H)` 值。）設計系統／UI Kit 探索需要一整條中性色階時，可沿用同一色相、只動亮度產生 50–900 階，但頁面上實際使用的仍只取上面的角色。

### 3. 比例

上色前先決定比例，並在截圖上檢查：

- **底**：頁面的 70–90%。
- **墨**：文字，加上可能一段反白（墨當底、底當墨）。
- **強調色**：任何一屏都少於 5%。標示動作，加上最多一個重複出現的東西；出現在五個地方就不再代表「這裡」。強調色不給標題、icon、項目符號、框線或底線（除非設計系統明定）；標題是墨色。
- **段落色域**：每段一片全強度色域，比例規則在段內適用（色域、它的墨，沒有別的）。

研究：高分網站在段落之間換底色更常見（段落底色中位數 2 種，低分網站 1 種）；52% 的網站按鈕是中性色（黑、白、灰），彩色按鈕是選擇不是必要。

### 4. 沒有線與陰影的表面

```css
.panel { background: var(--surface); }
.field { background: var(--surface); border: 0; }
.field:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
```

- 一階就夠；面板讀不出來時先加內距或用空間分隔，再考慮第二階。
- 面板不要套面板。
- 圖片不需要框；淺色照片融進淺色底時，換裁切或放到 `--surface` 上，不要描邊。
- 4px 以上的粗條（墨色或強調色）是圖形元素，設計需要時可以；1px 線不行（工作畫面例外，見 app-screens.md §13）。

### 5. 色域

整段換底色是最強的色彩動作，同時取代分隔線、卡片與背景裝飾。

- 色域之間硬邊相接，沒有任何漸變。
- 每片色域有自己指定的墨色；色域上不用 `--muted`，用該色域的墨色全強度，或在對比仍過時用 70% 不透明度當次要文字。
- 相鄰色域在**亮度**上要不同，不能只有色相不同，否則畫面會抖。
- 像章節一樣排序：強開場、休息、驚喜、以很暗或很亮收尾。

### 6. 深色頁

- 根元素加 `color-scheme: dark`，讓表單控制項與捲軸跟著變。
- 底是帶一點配色色調的深色，墨是柔和的亮色，不是 `#000` 上 `#fff`（除非刻意的極簡雙色調）。
- 次要文字是深色頁最常失敗的地方：在截圖上確認 `--muted` 對底讀得清（參考 4.5:1，需做無障礙時為門檻）。
- 深度來自較亮的表面階，絕不來自光暈或彩色光。
- 用比淺色頁輕一級的字重。

### 7. 顏色與照片

- 照片承載顏色時，介面保持中性，墨取照片中最深的色調。
- 不要用品牌色蓋照片；要嘛不處理，要嘛全頁所有圖同一種處理。
- 從照片取樣的一片平塗（它的天空、它的陰影）能讓一段與那張圖坐在一起。

### 8. 對比

依主檔〈受眾分級〉分兩層：

- **所有受眾（可讀性）**：次要文字、色域上的字、照片上的字在截圖上都讀得清；以內文 4.5:1、顯示字與大數字 3:1 為參考值，墨對底最好到 7:1。不要降低文字不透明度讓它「柔和」到讀不清；hover 與選中狀態提高對比，絕不降低。照片上的文字工具算不到，要在截圖上自己看。
- **需做無障礙時（合規）**：上述數值是硬門檻，每一組文字與底色逐組驗證；另加 icon、表單邊框、焦點框等非文字元素 3:1；focus 狀態同樣只能提高對比。
- 計算：用瀏覽器 DevTools 的對比檢查，或把顏色轉成 sRGB 後依 WCAG 相對亮度公式算。

### 9. 取色程序（沒有品牌色時）

1. **先找品牌**：logo、既有頁面、設計系統、codebase 的 token——有就全部對應到第 1 節的角色，停在這裡。
2. **從主題本身取**：回到盤點清單（[page-craft.md](page-craft.md) §1）的材料、顏色、地方——木頭、釉色、那條街的油漆、窗外的風景。挑一個當底的方向（亮或暗、偏暖或偏冷的低彩度）、一個墨、一個強調色。主題有明確的自身顏色時，比例照上面、顏色取自主題。
3. **檢查有沒有落進禁止的族群**（下一節）。
4. **檢查對比**：調 `--muted` 與強調色上的文字到讀得清；需做無障礙時算到合格（第 8 節）。
5. **在 Step 3 的 Design Decisions 寫出來源**：「底取自 XX 的石材色、強調色取自招牌的琺瑯綠」。

### 10. 禁止的族群，以及這裡的「溫暖」是什麼

- **奶油色配赤陶色**：偏黃、明亮且有明顯彩度的奶油底（色相約 22–62），配鐵鏽、陶土、焦橙強調色，是 AI 助理與它們生成的頁面的招牌外觀；任一半單獨出現都可疑，兩者一起就無可辯駁。研究：246 個網站只有 1 個用赤陶色主要按鈕，0 個用紫色；溫暖的米白底確實存在（32 個），但幾乎都配深色或綠色的墨，不是橘色強調色。
- **紫色與靛色**：第一波生成頁面是紫的，現在讀起來仍是。
- **藍紫漸層、紫粉漸層**：漸層本身已是預設禁令。

需求要溫暖時，溫暖來自：低彩度的石、骨、油灰色底（飽和度約 15% 以下）；深綠、棕、牛血紅的墨；照片；或一片平塗、有信念的暖色域（芥末黃、番茄紅、粉紅）。溫暖不是米色。

**品牌本身擁有被禁止的顏色時，它是品牌的**：保留、照品牌用，並在交付回報說明這是品牌破例。

---

## 字體選擇程序

### 1. 程序

1. **品牌或設計系統已指定字體 → 照用。** 停在這裡。
2. **沒有指定時，依主題個性選**：寫一句這個主題的聲音（「安靜、精密」「厚實、手作」「大聲、好玩」），挑一個在 Google Fonts（或使用者可用的字體服務）上能載入、且符合那句話的字族。看它在**你的實際文字**（含中文、數字、價格）上的樣子，不是看字體網站的範例句。
3. **一個字族是常態**（研究中三分之一的網站全站只用一個字族），**最多兩個**：一個設標題、一個設其他一切，各自的工作不互換。不要為標籤、數字或引言加第三種；不要在同一個標題裡混兩種字體。斜體只用在作品名與段落內真正的強調，不當裝飾。
4. **避開被用爛的字體**：Inter、Roboto、Arial、Fraunces、system-ui——這些是 AI 生成內容濫用的字體，一眼就會被認出。也不要因為某個字體「最近很多人推薦」就選它：推薦本身就是下一波的訊號。
5. **在 Step 3 的 Design Decisions 寫出選擇理由**：「標題用 XX，因為它的窄比例能讓店名在手機上撐滿一行」。

### 2. 字級：少、而且拉開

研究（202 個可量測網站）：主視覺標題中位數 72px（5.0vw，高分網站 6.0vw）；頁面最大字級高分網站 8.4vw、低分 5.0vw；手機主標中位數 40px；內文 16px；標題÷內文 4.3（高分 4.7）；48% 的主標是一般字重——大字不需要粗。

```css
:root {
  --step-small: clamp(0.8125rem, 0.79rem + 0.1vw, 0.875rem);   /* 13–14px  圖說、法律文字 */
  --step-body:  clamp(1.0625rem, 1rem + 0.25vw, 1.1875rem);    /* 17–19px  段落 */
  --step-lead:  clamp(1.25rem, 1.1rem + 0.7vw, 1.625rem);      /* 20–26px  說明句、大內文 */
  --step-head:  clamp(2rem, 1.3rem + 3.2vw, 4rem);             /* 32–64px  段落標題 */
  --step-display: clamp(3rem, 1rem + 9vw, 9rem);               /* 主視覺；依構圖調整 */
}
```

- 兩到三種字級承擔可見的工作：一個很大、一個小，中間沒有。**五種是上限**。常見失敗是九種彼此接近的尺寸（16、18、20、24、28、32……），讀起來是一團。
- 桌機上顯示字級至少是內文的四倍；`--step-lead` 與 `--step-head` 之間不要再塞一級。兩個尺寸看起來差不多，就讓它們一樣。
- 工作畫面的字級另見 [app-screens.md](app-screens.md) §9.1（標題 18–32px，沒有 48px 以上的數字）。

### 3. 顯示字的設定（40px 以上）

```css
.display {
  font-size: var(--step-display);
  line-height: 0.95;              /* 0.85–1.05；大寫與窄體更緊 */
  letter-spacing: -0.035em;       /* -0.02 到 -0.05em（拉丁文） */
  font-kerning: normal;
  text-wrap: balance;
  max-width: 14ch;                /* 中文用 em：例如 max-width: 8em 約一行 8 字 */
  margin: 0;
}
```

- **字距隨字級變**：字越大越緊；適合 120px 的值會把 32px 勒死。每一級各設字距。中文顯示字通常不需要負字距，以截圖確認不擠。
- 行高低於 1.0 要檢查下伸部與下一行的上伸部、聲調符號是否相撞。
- 全大寫：微開字距（0 到 +0.03em），行高約 0.9。
- **視覺對齊**：左緣是圓或斜的大字母（O、C、A、T、W）看起來內縮，往左拉約 0.04–0.06em 與下方文字視覺對齊。
- 顯示字不加文字陰影、不加描邊、不加漸層填色。

### 4. 內文的設定

```css
body { font-size: var(--step-body); line-height: 1.5; font-kerning: normal; text-rendering: optimizeLegibility; }
p { max-width: 62ch; text-wrap: pretty; margin: 0; }   /* 中文段落改用 em 控制行長 */
p + p { margin-top: 0.9em; }
.lead { font-size: var(--step-lead); line-height: 1.35; max-width: 40ch; }
small, .caption { font-size: var(--step-small); line-height: 1.45; }
```

- 拉丁文行長 45–75 字元；中文字身 1em 見方，用 `max-width: <N>em` 控制每行字數，並以截圖確認長文不會一行過長。
- 行高：內文 1.45–1.6；較大的說明句 1.3–1.4；長篇閱讀更鬆。
- 次要文字是同一字體、較柔的墨（`--muted`），不是更細的字重，也不小於 13px。
- 不置中超過三行的段落。
- 深底上的淺字看起來較重：降一級字重或加 0.01em 字距，行高略增。
- 標題上方的空間至少是下方的兩倍；連結用 `text-underline-offset: 0.18em; text-decoration-thickness: 0.07em` 讓底線避開下伸部；`::selection` 與 `:focus-visible` 用強調色，讓瀏覽器自己的狀態也屬於設計。

### 5. 載入

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=<字族>:wght@<只列用到的字重>&display=swap" rel="stylesheet">
```

```css
:root {
  --font-display: "<標題字族>", <同類後備字族>;
  --font-text: "<內文字族>", <同類後備字族>;
}
```

- 只請求用到的字重（通常全部兩到三個）。
- 一律給同類的後備字族（無襯線配無襯線、襯線配襯線）。
- 截圖前確認字體真的載入了；截到後備字體的截圖，判斷的一切都不是真的。

### 6. 中文頁面

- `<html lang="zh-Hant-TW">`（或對應語系），瀏覽器才會選對中文字形。
- **一個西文字族＋一個中文字族**，或只用一個本身含中文的字族。`font-family` 先列西文、再列中文，讓拉丁字母與數字用西文字體：`"<西文字族>", "<中文字族>", "PingFang TC", "Microsoft JhengHei", sans-serif`。
- 中文 webfont 檔案大；Google Fonts 對中文字族以 `unicode-range` 切片載入（2026-10-19 實查：Noto Sans TC 單一字重回傳 108 個切片），只下載頁面用到的字。不要自行下載整份字體檔塞進頁面。
- 沒有載入中文 webfont 時，一定要有上面那樣的同類系統字後備，不要落到 `system-ui`。
- 標點用全形；數字與單位不斷行；需要對齊的數字用 `font-variant-numeric: tabular-nums`，並確認選用的西文字族真的有等寬數字。
