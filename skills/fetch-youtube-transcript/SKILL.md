---
name: fetch-youtube-transcript
description: 抓取 YouTube 影片字幕（轉錄稿、逐字稿），回傳含時戳之段落、純文字與影片資訊（標題、頻道、上傳日、片長）。主路徑用自有套件 w-dwload-dlp：不開瀏覽器、不需登入、不需全域安裝 yt-dlp；限流、連線等非確定性失敗時才退回背景瀏覽器（Playwright）。觸發條件：要取得 YouTube 影片的字幕、轉錄稿、逐字稿，或把 YouTube 影片轉成文字、摘要、筆記時。一般網頁文章不適用，改用 fetch-web。
---

# fetch-youtube-transcript — 抓 YouTube 字幕

## 概述

輸入 YouTube 影片網址或 11 字 ID，輸出一份 JSON：字幕段落（時戳、毫秒、文字）、可直接閱讀的 `timestampedText` 與 `plainText`，以及影片資訊。手動字幕與自動字幕都支援。

| 路徑 | 何時走 | 特性 |
|---|---|---|
| **主路徑**：`w-dwload-dlp` 的 `dwloadSubtitle` | 一律先走 | 不開瀏覽器、不需登入；只支援 Windows；手動軌優先；語言與種類確定（`languageVerified: true`）；標示是否為機器翻譯（`translated`） |
| **備援**：Playwright + 本機 Chrome | 主路徑發生**非確定性**失敗（限流、連線、需登入、套件或執行檔問題等） | 階梯式：先無頭（不顯示視窗），無頭之非確定性失敗再升級為**有頭**（會跳出視窗）重試一次；可用專用 profile 保留登入態；載入的語言由 YouTube 決定，不一定是所要的軌 |

**確定性失敗**（影片確實沒有字幕、不存在、網址無效）直接回報，不啟動瀏覽器。可用 `--no-fallback` 完全禁止備援；只想禁止跳視窗（保留無頭備援）用 `--no-escalate`。

**不適用**：
- 沒有字幕的影片（回 `reason: 'no-captions'`）；本技能不做語音辨識或 OCR。
- 播放清單、頻道頁（只收單一影片）。
- 一次跑數百部以上的高頻場景（YouTube 會限流，見〈邊界與已知限制〉）。

## 與 fetch-web 的分工

- **YouTube 影片字幕 → 本技能**。fetch-web 針對文章型網頁抽取正文；影片字幕不是頁面正文，由本技能專職處理。
- **其他網頁 → fetch-web**。本技能只認 YouTube 影片網址，其他網址一律回 `invalid-url`。
- 兩者各自獨立：本技能的備援自己啟動 Playwright 並使用專用持久 profile，不經過 fetch-web，也不共用其瀏覽器。

## 依賴與前置條件

依賴裝在技能根目錄（通常為使用者資料夾下的 `.claude/skills`），由技能庫同步時在該處執行 `npm i`，不需另外安裝，也**不需要 `pip install yt-dlp`**：

| 套件 | 用途 | 備註 |
|---|---|---|
| `w-dwload-dlp`（≥ 1.0.60） | 主路徑 | `dwloadSubtitle` 自 1.0.60 起提供。首次呼叫時由套件依清單校驗後取得 `yt-dlp.exe`（約 23 MB，存於套件夾內的 `bin-cache`；乾淨安裝後首次取得實測約 8 秒，網路慢時較久）；套件升版後會重新取得。每次呼叫會先連 GitHub 取一次清單（數百位元組）；離線或鏡像用法見 w-dwload-dlp 的 README〈外部執行檔〉 |
| `playwright` | 只有備援用 | 由 `w-fetch-web` 帶入並提升到技能根的 `node_modules`，本技能不另列。動態載入，載不到時回 `reason: 'missing-deps'`，不影響主路徑。透過 `channel: 'chrome'` 使用本機已安裝的 Chrome，不另下載瀏覽器 |

本技能的腳本只用 Node 內建模組、`w-dwload-dlp` 與 `playwright`。

安裝後檢查（在技能根目錄執行）：

```bash
node -p "require('w-dwload-dlp/package.json').version"
```

版本 < 1.0.60，或查不到新版時，確認技能根的 `.npmrc` 指向內網倉庫（自有套件只發布於該處）。

## 執行方式

### CLI

```bash
node <技能根>/fetch-youtube-transcript/scripts/fetch_youtube_transcript.mjs <url-or-id> [outputPath] [--language=zh-TW] [--no-fallback] [--headed] [--no-escalate] [--user-data-dir=<dir>]
```

PowerShell 不會展開 `~`，請寫完整路徑（如 `$HOME\.claude\skills\…`）。

- `url-or-id`（必填）— watch 網址、`youtu.be` 短網址、shorts、embed 網址或 11 字 ID。影片 ID 以 `-` 開頭時，前面加 `--`：`… -- -abcdefghij`。
- `outputPath`（選填）— 輸出 JSON 路徑（上層資料夾自動建立，既有檔會被覆寫）；未指定則印到 stdout。路徑含中文、空格皆可。
- `--language=`（選填）— 偏好字幕語言代碼（如 `zh-TW`、`ko`、`zh-Hans`），排在預設序之前；預設 `zh-TW` > `zh-Hant` > `zh` > `en`。
- `--no-fallback`（選填）— 主路徑發生非確定性失敗時不啟動瀏覽器，回 `reason: 'primary-failed'`。
- `--headed`、`--no-escalate`、`--user-data-dir=`（選填）— 只影響備援（階梯見〈備援路徑〉）：
  - `--headed`：備援一開始就用有頭（顯示瀏覽器視窗）；首次登入 YouTube 時用。
  - `--no-escalate`：不升級為有頭——無頭失敗就回報，**不會跳出任何視窗**；不能跳視窗的場合（遠端、排程、使用者正在操作電腦）用它。與 `--headed` 併用時本旗標無作用（已經是有頭）。
  - `--user-data-dir=`：指定專用 profile（預設 `~/.w-yt-chrome-profile`）。

**離開碼**：

| 碼 | 意思 |
|---|---|
| 0 | 成功（`status: "success"`） |
| 1 | 抓取失敗（`status: "error"`，原因見 `reason`） |
| 2 | 參數錯誤（未知的選項、`--language` 格式不合、輸出路徑不安全等），**未發出任何請求** |
| 3 | 抓取成功但寫檔失敗（如上層路徑是檔案） |

**成功判準**是離開碼 0 且 JSON 的 `status` 為 `success`。指定 `outputPath` 時，失敗結果（`status: "error"`）也會寫入該檔，所以「檔案存在」不代表成功。

```bash
# 抓單一影片，輸出到檔案（stdout 只印不含 segments／plainText／timestampedText 的摘要與 output_path）
node <技能根>/fetch-youtube-transcript/scripts/fetch_youtube_transcript.mjs "https://www.youtube.com/watch?v=dQw4w9WgXcQ" "./out/影片 字幕.json"

# 指定語言
node <技能根>/fetch-youtube-transcript/scripts/fetch_youtube_transcript.mjs dQw4w9WgXcQ ./out/ja.json --language=ja
```

### 程式化呼叫

```javascript
import { fetchYoutubeTranscript } from './scripts/fetchYoutubeTranscript.mjs'  // 於本技能資料夾內

const r = await fetchYoutubeTranscript('https://www.youtube.com/watch?v=dQw4w9WgXcQ', { language: 'ja' })
if (r.status === 'success') {
    console.log(r.title, r.channel, r.uploadDate, r.durationString)
    console.log(r.timestampedText)
}
else {
    console.log(r.reason, r.message)
}
```

函數不 reject，失敗以 `status: 'error'` 回傳。選項：`language`、`fallback`（`false` 同 `--no-fallback`）；只影響備援的有 `headless`（預設 `true`；`false` 同 `--headed`）、`escalate`（預設 `true`；`false` 同 `--no-escalate`）、`userDataDir`、`chromeChannel`、`navigationTimeoutMs`、`captionsWaitMs`、`buttonWaitMs`（等「顯示轉錄稿」按鈕可見的上限，預設 8000）、`transcriptWaitMs`。`fallback`、`escalate` 只有布林 `false` 才關閉。

只需要字幕、不需要備援與排序時，也可直接呼叫 `WDwloadDlp.dwloadSubtitle(url, opt)`（見 w-dwload-dlp 的 README〈下載字幕〉）；差別是它失敗時 reject 字串，且段落依 YouTube 給的順序。

## 輸出格式

### 成功（`status: "success"`）

以下為主路徑的實際輸出（長欄位以 `…` 縮短）：

```json
{
  "status": "success",
  "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  "videoId": "dQw4w9WgXcQ",
  "title": "Rick Astley - Never Gonna Give You Up (Official Video) (4K Remaster)",
  "channel": "Rick Astley",
  "uploadDate": "20091025",
  "durationString": "3:33",
  "description": "The official video for “Never Gonna Give You Up” by Rick Astley. …",
  "language": "en",
  "languageName": "English",
  "kind": "manual",
  "translated": false,
  "languageVerified": true,
  "requestedLanguage": "en",
  "requestedLanguageName": "English",
  "requestedKind": "manual",
  "availableTracks": [
    { "languageCode": "en", "name": "English", "kind": "manual" },
    { "languageCode": "de-DE", "name": "German (Germany)", "kind": "manual" },
    { "languageCode": "ja", "name": "Japanese", "kind": "manual" },
    { "languageCode": "pt-BR", "name": "Portuguese (Brazil)", "kind": "manual" },
    { "languageCode": "es-419", "name": "Spanish (Latin America)", "kind": "manual" }
  ],
  "availableTracksTotal": 5,
  "segments": [{ "tMs": 1360, "t": "00:01", "txt": "[♪♪♪]" }],
  "segmentsCount": 61,
  "plainText": "[♪♪♪]\n♪ We're no strangers to love ♪\n…",
  "timestampedText": "[00:01] [♪♪♪]\n[00:18] ♪ We're no strangers to love ♪\n…",
  "source": "ytdlp-json3",
  "method": "w-dwload-dlp",
  "fetchedAt": "2026-11-04 23:45:55",
  "attempts": 1
}
```

- `segments`、`plainText`、`timestampedText` 三者內容重複，檔案因此較大；只要文字時讀 `timestampedText` 或 `plainText`。
- `segments` **依時間排序**：YouTube 的 json3 偶有事件不依時間排列（實測某部影片原始回傳的第一筆是 16:38 的句子），套件依 YouTube 給的順序回傳，本技能再依時間穩定排序。
- `kind`：`manual` 手動字幕，`asr` 自動字幕。
- `translated`：是否為 YouTube 機器翻譯；無原文軌而無從判定者為 `false`。寫筆記前先看它，機器翻譯品質低；要原文請用 `--language=` 指定原文語言。
- `availableTracks`：有手動軌時全列手動軌；否則列自動軌的前 20 筆（自動軌動輒百餘種語言），`availableTracksTotal` 為實際總數。
- 標題、頻道、上傳日（`YYYYMMDD`）直接取自影片資訊，不受終端機 codepage 影響。
- 走備援時 `method` 為 `playwright-ui`，另有 `mode`（`headless`／`headed`，最後一次嘗試所用的模式）與 `ladder`（每個模式一筆 `{mode, attempts, status, reason}`；`reason` 成功時為 `null`），`attempts` 為各模式嘗試次數的總和。例：無頭失敗後升級有頭並成功 → `mode: "headed"`、`ladder` 兩筆。主路徑的結果沒有 `mode`、`ladder`。
- 走備援時 `source` 為 `dom`／`network`／`timedtext`，**沒有** `title` 等影片資訊與 `translated`；段落是 YouTube 轉錄稿面板的分組，切法與主路徑不同（同一影片實測 24 段對 61 段，內容相同）；多字幕軌時 `languageVerified: false`，此時 `language`／`languageName`／`kind` 為 `null`（語言不確定，`requested*` 只是偏好挑選之軌）。

### 錯誤（`status: "error"`）

```json
{
  "status": "error",
  "url": "https://www.youtube.com/watch?v=aaaaaaaaaaa",
  "videoId": "aaaaaaaaaaa",
  "message": "[unavailable] video does not exist, has been removed, or is not accessible\nERROR: [youtube] aaaaaaaaaaa: This video is unavailable",
  "reason": "unavailable",
  "method": "w-dwload-dlp",
  "fetchedAt": "2026-11-04 23:42:50",
  "attempts": 1
}
```

| `reason` | 意思 | 會啟動瀏覽器嗎 |
|---|---|---|
| `invalid-url` | 無法解析出 11 字影片 ID（含播放清單、頻道頁、非 YouTube 網址） | 否 |
| `invalid-option` | `userDataDir` 指向日常瀏覽器的 User Data 目錄 | 否 |
| `no-captions` | 影片沒有可用字幕。主路徑對應套件的 `[noSubtitle]`；備援是 30 秒內讀不到字幕軌資訊——多半是頁面被同意畫面或驗證擋住（真正沒字幕者主路徑已回 `[noSubtitle]`，不會走到備援），所以無頭時會升級有頭再試一次（除非 `--no-escalate`）；兩個模式都讀不到才回報 | 主路徑判定：否；備援判定：是（已在瀏覽器內） |
| `unavailable` | 影片不存在、已移除或無法存取（套件的 `[unavailable]`，對應 yt-dlp 的 `This video is unavailable`）。私人、年齡限制、會員專屬等影片的 yt-dlp 訊息不同，依套件原始碼不歸入此類而視為非確定性失敗（未逐一實測） | 否 |
| `primary-failed` | 用了 `--no-fallback`，且主路徑發生非確定性失敗；`message` 含套件的 `[代碼]` 與 yt-dlp 原文 | 否 |
| `missing-deps` | 主路徑已失敗，且 `playwright` 載不到 | 否 |
| `transcript-empty` | 備援等待逾時，三條路徑都沒取得段落（無頭時會升級有頭再試一次，除非 `--no-escalate`） | 是 |
| `playwright-error` | 備援的瀏覽器啟動、導航或例外（每個模式各重試到共 3 次；無頭失敗會升級有頭再試一次，除非 `--no-escalate`） | 是 |
| `unexpected-error` | CLI 捕捉到未預期的例外 | — |

`message` 是診斷用文字，格式不保證穩定，請以 `reason` 判斷。

## 字幕語言挑選邏輯

**主路徑**（語言確定）：只考慮有 json3 格式的軌；有手動字幕時只從手動字幕挑（任何語言的手動字幕都優先於自動字幕，即使偏好語言只有自動字幕）；依偏好語言依序比對（大小寫不分，先完全相同，再語言前綴，例如 `zh` 可中 `zh-Hans`、`de` 可中 `de-DE`）；自動字幕中語言相符者先取非機器翻譯者，只有機器翻譯相符時才取並標 `translated: true`；皆不符則取原文軌（`-orig`），無原文軌取清單第 1 筆。完整規則見 w-dwload-dlp 的 README〈下載字幕〉。

**備援**：點「顯示轉錄稿」載入的是 YouTube 為影片決定的預設語言，本技能無法切換；單一字幕軌時語言確定，多軌時不確定（見上）。

## 備援路徑

何時走：主路徑 reject 的錯誤不是 `[noSubtitle]`、`[invalidUrl]`、`[unavailable]`。常見如限流（`HTTP Error 429`）、連線失敗、`yt-dlp.exe` 取得失敗、非 Windows（`[osNotSupported]`）、需登入。stderr 會印一行說明原因與是否顯示視窗。

**階梯**（無頭不跳視窗，有頭是最後手段，兩者都留著最穩）：

1. 預設先無頭（不顯示視窗）。
2. 無頭的結果是 `playwright-error`、`transcript-empty` 或 `no-captions` 時，升級為**有頭**再試一次——會跳出瀏覽器視窗，升級前 stderr 會先印一行說明。`no-captions` 也升級，因為走到備援代表主路徑已被擋，此時讀不到字幕軌多半是頁面被擋；`missing-deps`、`invalid-option` 根本沒有開瀏覽器，不升級。
3. `--no-escalate`（程式化呼叫 `escalate: false`）不升級，無頭失敗就回報——**不能跳視窗的場合用它**；`--headed`（`headless: false`）一開始就有頭，沒有更高一階。
4. 結果的 `mode` 是最後一次所用的模式，`ladder` 記每個模式的嘗試次數與結果，`attempts` 是總和（欄位見〈輸出格式〉）。

流程（每個模式相同；走 YouTube 自家網頁，不由本技能直接打 `/api/timedtext`，該端點要求頁面產生的 POT 驗證權杖）：

1. 啟動本機 Chrome（`launchPersistentContext`，專用持久 profile）。
2. 開 watch 頁，等字幕軌資訊就緒。
3. 等到「顯示轉錄稿」按鈕**可見**（寬高大於 0）。按鈕在說明區內，說明未展開時它在 DOM 裡但盒子是 0×0，所以沒有可見者時每 1.5 秒點一次「展開說明」，最久等 8 秒；挑第一個**可見**的符合元素（不是第一個文字相符的）。捲動與點擊用 5 秒的短逾時（Playwright 預設 30 秒）。找不到可見按鈕、捲動或點擊失敗都**不致命**，不重試同一個動作，直接走下面的路徑 (C) 等其他路徑；同時按 `c` 開啟播放器 CC。
4. 三路並行等待，誰先成功用誰：(A) 轉錄稿面板的 DOM；(B) `/youtubei/v1/get_transcript` 回應；(C) 播放器 CC 的 `/api/timedtext`（json3，以網址的 `v=<影片ID>` 過濾，否則會把前置廣告的字幕當成主影片字幕）。
5. 解析、去重、依時間排序。

要點：

- **專用 profile**：預設 `~/.w-yt-chrome-profile`，首次執行會建立（無頭實測約 16 MB，有頭約 63 MB）。Chrome 136 起不接受對預設 User Data 目錄的遠端除錯，所以不使用日常 profile；本技能也拒絕把 `--user-data-dir` 指向常見瀏覽器的日常目錄（回 `invalid-option`）。需要登入態（會員、年齡限制影片）時，用 `--headed` 在開出的視窗手動登入一次，之後沿用。
- **有頭會跳視窗**：升級或 `--headed` 都會在本機桌面開出可見的 Chrome 視窗；使用者正在操作電腦、遠端或排程執行時請加 `--no-escalate`。
- **不可併行**：同一個 profile 同時只能被一個 Chrome 使用，併行的第二個備援會立即啟動失敗（實測）。主路徑可併行。同一次呼叫內無頭與有頭是先後關係（無頭的 Chrome 關閉後才開有頭），共用同一個 profile。
- **殘留**：行程被強制終止（不帶 `/T`）時，Chrome 通常會因連線中斷自行關閉（實測無頭 0 殘留），但不保證；若殘留並占住 profile，下次備援啟動會失敗，此時只結束使用該 profile 的 `chrome.exe` 樹（不要動日常 Chrome）。
- 瀏覽器啟動或導航失敗，每個模式各自最多重試 2 次（共 3 次，等待 3 秒、6 秒）；已分類的結果（`no-captions`、`transcript-empty`）不在同一模式內重試，由無頭升級有頭才再試。

## 邊界與已知限制

1. **限流**：YouTube 對字幕下載會限流（`HTTP Error 429`），機器翻譯軌（語言與原文不同的自動軌）尤其容易。主路徑不重試，預設會退回備援（機器翻譯軌被限流時，備援載入的是 YouTube 的預設字幕軌——常是原文軌，`language`／`languageVerified` 會如實標示，不一定是所要的語言）；不想啟動瀏覽器請加 `--no-fallback`，只是不想跳視窗請加 `--no-escalate`，並自行延後重試。批次抓取請自行間隔（建議每部間隔 5 秒以上，以 8 秒間隔連續抓取數部影片實測未遇限流）。
2. **主路徑沒有整體逾時**（w-dwload-dlp 1.0.60 的已知限制）：yt-dlp 對無回應的連線 20 秒後放棄，但對方持續少量送出資料時可能一直等。因應由呼叫端負責：
   - 正常一次約 5～11 秒（成功 8 次實測 5.3～11.1 秒；確定性失敗 3 次實測 3.0～4.8 秒；首次另含取得 `yt-dlp.exe`）。超過 2 分鐘仍無輸出，視為卡住。
   - 終止時要連子行程一起結束：`taskkill /F /T /PID <node 的 PID>`。只結束 node 時 `yt-dlp.exe` 會殘留（實測只結束 node 後仍有 1 個 `yt-dlp.exe` 行程；用 `/T` 則為 0）。結束後以 `tasklist` 確認 `yt-dlp.exe` 已消失。
   - 強制終止後，`%TEMP%` 下可能殘留 `_MEI…` 資料夾（yt-dlp 的解壓暫存，實測約 30 MB），可手動刪除。
3. **主路徑只支援 Windows**：其他平台回 `[osNotSupported]`，退回備援（備援未在非 Windows 驗證）。
4. **字幕內容由 YouTube 提供**：常有錯字與口語贅字，整理時自行修正。
5. **備援的「顯示轉錄稿」按鈕要說明展開後才可見，與有頭或無頭無關**：按鈕在說明區內，說明未展開時它在 DOM 裡但盒子是 0×0（真實頁面實測：未展開時持續不可見至少 8.7 秒，補點「展開說明」後 8 毫秒內可見）。早期版本取「第一個文字相符的元素」，並只在固定時間點展開一次；展開落空時就對不可見的元素捲動，每次逾時 30 秒、共重試 3 次（約 110 秒），錯誤訊息是 `elementHandle.scrollIntoViewIfNeeded: Timeout 30000ms exceeded … waiting for element to be stable … element is not visible`——曾有一次有頭備援失敗即是這個形狀（在假頁面上以早期版本重現出相同的錯誤訊息）。現在改為挑可見者、輪詢等待並重複展開、失敗不致命。**那一次展開為何落空未直接觀察到**（推測：展開鈕尚未渲染，或點擊在頁面未就緒前無效；需實測確認）。有頭與無頭在實測中沒有差別：同一部影片無頭 2/2、有頭（視窗在畫面外）2/2 成功，另一部影片亦同；所以有頭只是升級的最後手段，不是「比較穩」的模式。

## 安全設計

- **輸出路徑防護**（發出請求前先檢查，不合格離開碼 2）：拒絕 Windows 保留裝置名（`nul`、`con`、`prn`、`aux`、`com0-9`、`lpt0-9` 等，路徑任一層、帶副檔名或尾端空白皆算）、`\\.\` 與 `\\?\` 裝置路徑、磁碟機代號以外的冒號（NTFS 替代資料流）、既有資料夾、空字串。這類檔名會讓 git 等工具無法處理。
- **輸入只取影片 ID**：網址一律只取出 11 字 ID，實際請求的網址固定為 `https://www.youtube.com/watch?v=<ID>`，輸入中的其他主機不會被連線；ID 以 `-` 開頭也不會被當成 yt-dlp 選項。
- **專用 profile 與日常瀏覽器隔離**：不讀不寫日常瀏覽資料；不讀瀏覽器 cookies。
- **資源釋放**：備援的 `context.close()` 放在 `finally`，每次嘗試（含例外）都會關閉；CLI 不用 `process.exit()` 截斷輸出，讓行程自然結束，另設 10 秒保險計時器避免殘留控制代碼使行程不結束。
- 主路徑的工作夾由套件在每次呼叫的暫存夾內建立並於結束時刪除（見 w-dwload-dlp README）。

## 驗證狀態

在 Windows 11、Node 24、`w-dwload-dlp` 1.0.60、`playwright` 1.64.1、Chrome 156 上驗證（主路徑 2026-11-04；備援階梯與按鈕挑選 2026-11-05）：

- **已驗證**：從乾淨的技能根安裝（`npm i`）後執行；手動軌（中文、英文各一部）、自動軌（韓文）、`--language` 指定、真實無字幕的影片（`no-captions`）、不存在的影片 ID（`unavailable`），這兩種確定性失敗皆未啟動瀏覽器；段落依時間排序；其餘失敗分類與「確定性失敗不啟動瀏覽器」（以替身注入各錯誤代碼）；輸出路徑防護、中文與空格路徑；終止行程樹後無 `yt-dlp.exe` 殘留。
- **備援（真實 YouTube，主路徑以 429 替身觸發）**：兩部影片各做無頭與有頭（視窗在畫面外）各 2 次，8/8 成功，各約 5～8 秒；機器翻譯軌的完整流程（不注入）：主路徑仍 429，備援無頭一次救回（原文韓文自動軌 32 段，約 19 秒）。
- **備援（真實 Chromium + 假 YouTube 頁，無任何真實請求）**：可見按鈕排在不可見元素之後、說明收合、展開鈕延遲出現或一開始點了沒反應、展開鈕不存在、按鈕被遮擋、無按鈕、無字幕頁——共 12 案，按鈕問題不致命且改走播放器 CC 或 DOM 路徑成功；階梯（無頭失敗升級有頭、`--no-escalate` 不升級、有頭起手不再升級）以替身驗證。
- **未驗證**：非 Windows；需登入的影片；機器翻譯軌在主路徑的成功下載（實測遇 429）；主路徑真的卡住時的行為；**真實 YouTube 上的「無頭失敗 → 升級有頭」**（實測中無頭未失敗，升級只以替身與假頁面驗證）；有頭模式在可見視窗、遠端桌面工作階段下的行為（實測的有頭都把視窗移到畫面外）。
