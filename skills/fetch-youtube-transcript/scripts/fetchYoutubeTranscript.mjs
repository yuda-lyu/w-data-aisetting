// fetchYoutubeTranscript.mjs — 抓 YouTube 影片字幕
//
// 對外匯出 fetchYoutubeTranscript(url, options) → { status, ... }（不 reject，失敗以 status:'error' + reason 回傳）
//
// 主路徑：自有套件 w-dwload-dlp 之 dwloadSubtitle（不開瀏覽器、不需登入；yt-dlp.exe 由套件依清單校驗後取得，不需全域安裝）
// 備援路徑：主路徑發生非確定性失敗（限流、連線、需登入等）時，退回 Playwright + 本機 Chrome（專用持久 profile）走 YouTube 自家 UI。
//   確定性失敗（無字幕、影片不存在、網址無效）不退回，直接回報。
//   備援採階梯：預設先無頭（不跳視窗）；無頭之非確定性失敗（playwright-error、transcript-empty）才升級為有頭再試一次；
//   走到備援代表主路徑已非確定性失敗，此時讀不到字幕軌可能是同意畫面或驗證擋住，故 no-captions 也升級；options.escalate=false 則不升級（不能跳視窗之場合）；options.headless=false 則一開始就有頭。
//
// 以下至 import 前為備援路徑之設計說明。
//
// Profile 策略：
//   Chrome 136（2025-04）起，remote debugging（CDP）對「預設 user data directory」一律拒絕生效，
//   而 Playwright 驅動 Chrome 全靠 CDP，故不能直接掛使用者日常的預設 profile（日常 Chrome 開著時 profile 也被鎖）。
//   做法：launchPersistentContext 掛專用持久 profile（預設 ~/.w-yt-chrome-profile，可用 options.userDataDir 覆寫），
//   首次在開出的視窗手動登入一次 YouTube，登入態即留在此 profile；未登入也能抓一般公開影片的字幕。
//   本檔拒絕把 userDataDir 指向常見瀏覽器的日常 User Data 目錄（見 _isDailyBrowserDir），使「不讀不寫日常瀏覽資料」成立。
//
// 核心策略：走 YouTube 自家 UI，不由本檔直接打 /api/timedtext（該端點要求頁面產生之 POT 驗證權杖）：
//   1. goto watch 頁
//   2. 等 ytInitialPlayerResponse.captions 就緒
//   3. 等到「顯示轉錄稿」按鈕可見（它在說明區內，說明未展開時盒子為 0×0，故沒有可見者時定期展開說明），
//      以短逾時捲動並點擊（Playwright 原生 click；合成事件會被 YouTube 過濾；失敗不致命）＋按 c 開啟播放器 CC
//   4. 三路徑並行等待，誰先成功用誰：
//      (A) DOM：transcript 段落元素出現
//      (B) 網路：/youtubei/v1/get_transcript 回應
//      (C) 網路：播放器 CC 自己帶 POT 打的 /api/timedtext（json3）回應——未登入／新 profile 時 get_transcript 可能回 400，此路徑不受影響
//   路徑 C 必須以 URL 之 v=<videoId> 過濾：前置廣告也是影片、也會抓自己的 timedtext，不過濾會把廣告字幕當成主影片字幕

import path from 'node:path'
import os from 'node:os'

const MAX_RETRIES = 2  // 備援路徑：含初始最多 3 次
const INITIAL_WAIT_MS = 3000
const MAX_WAIT_MS = 9000
const DEFAULT_NAV_TIMEOUT_MS = 30000
const DEFAULT_TRANSCRIPT_TIMEOUT_MS = 60000  // 需容納前置廣告播完（廣告期間主影片的 timedtext 不會來）
const DEFAULT_CAPTIONS_TIMEOUT_MS = 30000
const POLL_INTERVAL_MS = 500
const MAX_INPUT_LENGTH = 2048
const DEFAULT_BUTTON_WAIT_MS = 8000  // 等「顯示轉錄稿」按鈕可見（含展開說明）之上限；逾時不致命，改走播放器 CC 路徑
const BUTTON_ACTION_TIMEOUT_MS = 5000  // 對該按鈕之捲動與點擊用短逾時（Playwright 預設 30 秒）；失敗不致命
const EXPAND_RETRY_MS = 1500  // 按鈕仍不可見時，每隔此時間再點一次「展開說明」
const ESCALATE_REASONS = new Set(['playwright-error', 'transcript-empty', 'no-captions'])  // 無頭失敗之原因：升級為有頭再試一次。no-captions 也算：真正沒字幕者主路徑已回 [noSubtitle] 而不會走到備援，這裡多半是頁面被擋

const TRANSCRIPT_BTN_KEYWORDS = ['顯示轉錄稿', '轉錄稿', '顯示文字記錄', 'Show transcript']

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const retryWaitMs = (attempt) => Math.min(INITIAL_WAIT_MS * attempt, MAX_WAIT_MS)

function ts() {
    const d = new Date()
    const pad = (n) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

function timestampFromMs(ms) {
    const total = Math.floor(ms / 1000)
    const hh = Math.floor(total / 3600)
    const mm = Math.floor((total % 3600) / 60)
    const ss = total % 60
    const pad = (n) => String(n).padStart(2, '0')
    return hh > 0 ? `${pad(hh)}:${pad(mm)}:${pad(ss)}` : `${pad(mm)}:${pad(ss)}`
}

function _extractVideoId(input) {
    if (!input || typeof input !== 'string') return null
    const s = input.trim()
    if (s.length > MAX_INPUT_LENGTH) return null
    if (/^[\w-]{11}$/.test(s)) return s
    let m
    if ((m = s.match(/[?&]v=([\w-]{11})(?![\w-])/))) return m[1]
    if ((m = s.match(/youtu\.be\/([\w-]{11})(?![\w-])/))) return m[1]
    if ((m = s.match(/\/shorts\/([\w-]{11})(?![\w-])/))) return m[1]
    if ((m = s.match(/\/embed\/([\w-]{11})(?![\w-])/))) return m[1]
    return null
}

// 日常瀏覽器之 User Data 目錄（備援路徑不得使用）：Chrome 136+ 對它們不開 CDP，且會讀寫日常瀏覽資料
function _dailyBrowserDirs() {
    const home = os.homedir()
    const dirs = []
    if (process.platform === 'win32') {
        const local = process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local')
        for (const p of [
            ['Google', 'Chrome', 'User Data'], ['Google', 'Chrome Beta', 'User Data'], ['Google', 'Chrome SxS', 'User Data'],
            ['Chromium', 'User Data'], ['Microsoft', 'Edge', 'User Data'], ['BraveSoftware', 'Brave-Browser', 'User Data'],
        ]) dirs.push(path.join(local, ...p))
    }
    else if (process.platform === 'darwin') {
        const base = path.join(home, 'Library', 'Application Support')
        for (const p of [['Google', 'Chrome'], ['Chromium'], ['Microsoft Edge'], ['BraveSoftware', 'Brave-Browser']]) dirs.push(path.join(base, ...p))
    }
    else {
        const base = path.join(home, '.config')
        for (const p of ['google-chrome', 'google-chrome-beta', 'chromium', 'microsoft-edge', path.join('BraveSoftware', 'Brave-Browser')]) dirs.push(path.join(base, p))
    }
    return dirs
}

// dir 是否為日常瀏覽器之 User Data 目錄或其內（Windows 路徑不分大小寫）
function _isDailyBrowserDir(dir) {
    const norm = (p) => (process.platform === 'win32' ? path.resolve(p).toLowerCase() : path.resolve(p))
    const target = norm(dir)
    return _dailyBrowserDirs().some((d) => {
        const base = norm(d)
        return target === base || target.startsWith(base + path.sep)
    })
}

function _isLangMatch(track, lang) {
    if (!lang) return false
    const code = (track.languageCode || '').toLowerCase()
    const want = lang.toLowerCase()
    return code === want || code.startsWith(want + '-') || want.startsWith(code + '-')
}

// 備援路徑用：由頁面上的字幕軌挑出偏好者（僅用於回報 requestedLanguage*，實際載入哪一軌由 YouTube 決定）
function _pickTrack(tracks, preferLang) {
    if (!tracks || tracks.length === 0) return null
    const manualOnly = tracks.filter((t) => t.kind === 'manual')
    const pool = manualOnly.length > 0 ? manualOnly : tracks  // 優先手動字幕
    if (preferLang) {
        const exact = pool.find((t) => _isLangMatch(t, preferLang))
        if (exact) return exact
    }
    for (const code of LANGS_DEFAULT) {
        const hit = pool.find((t) => _isLangMatch(t, code))
        if (hit) return hit
    }
    return pool[0]
}

// ---------- 主路徑：w-dwload-dlp（不開瀏覽器） ----------
// 字幕由套件之 yt-dlp.exe 下載（json3，手動軌優先；挑軌規則見 w-dwload-dlp 之 README〈下載字幕〉）

const LANGS_DEFAULT = ['zh-TW', 'zh-Hant', 'zh', 'en']  // 與 w-dwload-dlp 之預設相同；此處明列使兩條路徑的偏好序一致
const MAX_ASR_TRACKS = 20  // 自動軌動輒 150+ 語言，全列會撐爆輸出

// 判定主路徑之失敗（reject 為字串，首行 `[代碼] 說明`）：
// 確定性之結論（影片無字幕、不存在、網址無效）不必開瀏覽器再試，回傳對應之 reason；其餘（限流、連線、需登入、套件或執行檔問題等）回傳 null，退回備援路徑
export function classifyDwloadError(err) {
    const code = (String(err).match(/^\[(\w+)\]/) || [])[1] || ''
    const map = { noSubtitle: 'no-captions', invalidUrl: 'invalid-url', unavailable: 'unavailable' }
    return Object.prototype.hasOwnProperty.call(map, code) ? map[code] : null
}

// 載入 w-dwload-dlp 並確認有 dwloadSubtitle（1.0.60 起提供）；載不到或版本過舊時 reject，由呼叫端退回備援路徑
async function _loadDwload() {
    let mod
    try {
        mod = await import('w-dwload-dlp')
    }
    catch (err) {
        throw new Error(`w-dwload-dlp not installed (run npm i in the skills root): ${err.code || err.message}`)
    }
    const WDwloadDlp = mod.default || mod
    if (typeof WDwloadDlp?.dwloadSubtitle !== 'function') {
        throw new Error('installed w-dwload-dlp has no dwloadSubtitle (need >= 1.0.60, run npm i in the skills root)')
    }
    return WDwloadDlp
}

async function _tryDwloadDlp(watchUrl, videoId, preferLang, fetchedAt) {
    const WDwloadDlp = await _loadDwload()
    const langs = preferLang ? [preferLang, ...LANGS_DEFAULT] : LANGS_DEFAULT
    const r = await WDwloadDlp.dwloadSubtitle(watchUrl, { langs })

    // 套件依 YouTube 所給順序回傳，json3 偶有事件不依時間排列（實測有影片的原始回傳首筆為 16:38 之句子），
    // 故依時間穩定排序，供依序閱讀
    const segments = [...r.segments].sort((x, y) => x.tMs - y.tMs)

    const manual = r.availableTracks.filter((t) => t.kind === 'manual')
    const tracks = manual.length > 0 ? manual : r.availableTracks.slice(0, MAX_ASR_TRACKS)
    return {
        status: 'success',
        url: watchUrl,
        videoId,
        title: r.title,
        channel: r.channel,
        uploadDate: r.uploadDate,
        durationString: r.durationString,
        description: r.description,
        language: r.language,
        languageName: r.languageName || null,
        kind: r.kind,
        translated: r.translated,
        languageVerified: true,  // 下載的就是所挑之軌，語言與種類確定
        requestedLanguage: r.language,
        requestedLanguageName: r.languageName || null,
        requestedKind: r.kind,
        availableTracks: tracks,
        availableTracksTotal: r.availableTracks.length,
        segments,
        segmentsCount: segments.length,
        plainText: segments.map((v) => v.txt).join('\n'),
        timestampedText: segments.map((v) => `[${v.t}] ${v.txt}`).join('\n'),
        source: 'ytdlp-json3',
        method: 'w-dwload-dlp',
        fetchedAt,
        attempts: 1,
    }
}

// ---------- 備援路徑：解析 ----------

// 解析播放器 CC 的 /api/timedtext（fmt=json3）回應為 segments
// json3 結構：{ events: [{ tStartMs, segs: [{ utf8 }] }] }；無 segs 的 event 是視窗定義，略過
function _parseTimedtextJson3(jsonStr) {
    let data
    try { data = JSON.parse(jsonStr) } catch { return null }
    const events = data?.events
    if (!Array.isArray(events) || events.length === 0) return null
    const out = []
    for (const ev of events) {
        if (!Array.isArray(ev.segs)) continue
        const txt = ev.segs.map((s) => s.utf8 || '').join('').replace(/\s+/g, ' ').trim()
        if (!txt) continue
        out.push({ tMs: parseInt(ev.tStartMs ?? '0', 10), txt })
    }
    return out.length > 0 ? out : null
}

// 解析 /get_transcript 回的 JSON 結構為 segments
function _parseGetTranscriptJson(jsonStr) {
    let data
    try { data = JSON.parse(jsonStr) } catch { return null }

    const tryPaths = [
        () => data.actions?.[0]?.updateEngagementPanelAction?.content?.transcriptRenderer?.content?.transcriptSearchPanelRenderer?.body?.transcriptSegmentListRenderer?.initialSegments,
        () => data.actions?.[0]?.updateEngagementPanelAction?.content?.transcriptRenderer?.body?.transcriptBodyRenderer?.cueGroups,
    ]
    let segs = null
    for (const fn of tryPaths) {
        try { segs = fn(); if (segs) break } catch { /* noop */ }
    }
    if (!Array.isArray(segs) || segs.length === 0) return null

    const out = []
    for (const it of segs) {
        // 新結構（2024+）：transcriptSegmentRenderer
        const r = it.transcriptSegmentRenderer
        if (r) {
            const startMs = parseInt(r.startMs ?? '0', 10)
            const txt = r.snippet?.runs?.map((x) => x.text).join('') || r.snippet?.simpleText || ''
            if (txt.trim()) out.push({ tMs: startMs, txt: txt.replace(/\s+/g, ' ').trim() })
            continue
        }
        // 舊結構：cueGroup
        const cue = it.transcriptCueGroupRenderer?.cues?.[0]?.transcriptCueRenderer
        if (cue) {
            const startMs = parseInt(cue.startOffsetMs ?? '0', 10)
            const txt = cue.cue?.simpleText || cue.cue?.runs?.map((x) => x.text).join('') || ''
            if (txt.trim()) out.push({ tMs: startMs, txt: txt.replace(/\s+/g, ' ').trim() })
        }
    }
    return out
}

async function _readSegmentsFromDOM(page) {
    return await page.evaluate(() => {
        // 新版 panel（2026-05+，target-id="PAmodern_transcript_view"）
        const newItems = document.querySelectorAll('transcript-segment-view-model')
        if (newItems.length > 0) {
            return Array.from(newItems).map((it) => {
                const t = it.querySelector('.ytwTranscriptSegmentViewModelTimestamp')?.textContent?.trim() || ''
                const txt = it.querySelector('[role="text"], .ytAttributedStringHost')?.textContent?.trim() || ''
                return { t, txt }
            }).filter((s) => s.txt)
        }
        // 舊版 panel（target-id="engagement-panel-searchable-transcript"），保留作 fallback
        const oldItems = document.querySelectorAll('ytd-transcript-segment-renderer')
        return Array.from(oldItems).map((it) => {
            const t = it.querySelector('.segment-timestamp')?.textContent?.trim() || ''
            const txt = it.querySelector('.segment-text, yt-formatted-string.segment-text')?.textContent?.trim() || ''
            return { t, txt }
        }).filter((s) => s.txt)
    })
}

// 取得頁面上第一個「可見」之轉錄稿按鈕（文件順序）；沒有則回 null。
// 「顯示轉錄稿」按鈕在說明區內：說明未展開時它在 DOM 內、但盒子為 0×0（實測）；面板內另有一份副本，平時同樣不可見。
// 故不可取「第一個文字相符者」（可能是不可見者，對它捲動會逾時），須取可見者。可見＝盒子寬高皆大於 0 且 visibility 不是 hidden
async function _pickVisibleTranscriptButton(page) {
    const handle = await page.evaluateHandle((kws) => {
        const all = document.querySelectorAll('button, [role="button"], ytd-button-renderer, tp-yt-paper-button')
        for (const el of all) {
            const txt = (el.textContent || '').trim()
            if (!kws.some((k) => txt.includes(k) || txt.toLowerCase().includes(k.toLowerCase()))) continue
            const r = el.getBoundingClientRect()
            if (r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden') return el
        }
        return null
    }, TRANSCRIPT_BTN_KEYWORDS)
    const btn = handle.asElement()
    if (!btn) await handle.dispose().catch(() => { /* noop */ })
    return btn
}

// 展開說明（點 #expand）；找得到展開鈕才算點了
async function _expandDescription(page) {
    return await page.evaluate(() => {
        const expand = document.querySelector('tp-yt-paper-button#expand, ytd-text-inline-expander #expand')
        if (!expand) return false
        expand.click()
        return true
    }).catch(() => false)
}

// 等到有可見之轉錄稿按鈕或逾時：沒有可見者時定期點「展開說明」（展開鈕可能尚未渲染、或點了沒反應，故重複），回傳按鈕 ElementHandle 或 null
async function _findVisibleTranscriptButton(page, timeoutMs) {
    const deadline = Date.now() + timeoutMs
    let lastExpandAt = 0
    for (;;) {
        const el = await _pickVisibleTranscriptButton(page).catch(() => null)
        if (el) return el
        if (Date.now() >= deadline) return null
        if (Date.now() - lastExpandAt >= EXPAND_RETRY_MS) {
            if (await _expandDescription(page)) lastExpandAt = Date.now()
        }
        await sleep(300)
    }
}

// MM:SS 或 HH:MM:SS → ms（DOM 路徑用，因為 DOM 只有顯示字串沒有 ms）
function _domTimestampToMs(t) {
    if (!t) return 0
    const parts = t.split(':').map((x) => parseInt(x, 10))
    if (parts.some(isNaN)) return 0
    let sec = 0
    for (const p of parts) sec = sec * 60 + p
    return sec * 1000
}

/**
 * 抓取 YouTube 影片字幕
 * @param {string} url - YouTube watch URL / youtu.be 短網址 / shorts URL / embed URL / 11 字 video ID
 * @param {object} [options]
 * @param {string} [options.language] - 偏好字幕語言（如 'zh-TW', 'en'），未指定則 zh-TW > zh-Hant > zh > en
 * @param {boolean} [options.fallback=true] - false 則主路徑發生非確定性失敗時不退回備援，直接回 reason:'primary-failed'（不開瀏覽器、不建立 profile）
 * @param {boolean} [options.headless=true] - 備援路徑：一開始是否無頭（預設 true，不顯示視窗）；首次登入 YouTube 或除錯時傳 false（一開始就有頭）
 * @param {boolean} [options.escalate=true] - 備援路徑：無頭失敗（reason 為 playwright-error、transcript-empty 或 no-captions）時，是否升級為有頭再試一次（會跳出瀏覽器視窗）。
 *   false 則不升級，無頭失敗即回報（不能跳視窗之場合用）；headless:false 時已是有頭，本選項無作用
 * @param {string} [options.chromeChannel='chrome'] - 備援路徑：playwright launch channel
 * @param {string} [options.userDataDir=~/.w-yt-chrome-profile] - 備援路徑：持久 profile 目錄；首次在此 profile 登入 YouTube 後，後續執行皆帶登入態。
 *   不可指向日常瀏覽器的 User Data 目錄（會以 reason:'invalid-option' 拒絕）
 * @param {number} [options.navigationTimeoutMs=30000] - 備援路徑
 * @param {number} [options.captionsWaitMs=30000] - 備援路徑：等 ytInitialPlayerResponse 的 timeout
 * @param {number} [options.transcriptWaitMs=60000] - 備援路徑：等 transcript 載入的 timeout（含前置廣告播完的時間）
 * @param {number} [options.buttonWaitMs=8000] - 備援路徑：等「顯示轉錄稿」按鈕可見（含展開說明）的上限；逾時或按鈕之捲動／點擊失敗皆不致命，改走播放器 CC 路徑
 * @returns {Promise<object>} 成功：{status:'success', url, videoId, language, languageName, kind, languageVerified, requestedLanguage*, availableTracks, segments, segmentsCount, plainText, timestampedText, source, method, fetchedAt, attempts, ...}
 *   失敗：{status:'error', url, videoId, message, reason, method?, fetchedAt, attempts}
 *   走備援（method:'playwright-ui'）之結果另有 mode（'headless'｜'headed'，最後一次嘗試所用之模式）與 ladder（每個模式一筆：{mode, attempts, status, reason}）；
 *   此時 attempts 為各模式嘗試次數之總和。主路徑之結果沒有 mode 與 ladder。
 *   備援路徑載入的是 YouTube 為本影片決定的「預設」字幕語言，本流程不切換 UI 字幕語言；
 *   language/languageName/kind 僅在 languageVerified 時反映實際載入內容（字幕軌唯一，或 source='timedtext' 由 URL 之 lang=/kind= 標明載入軌），否則為 null；
 *   requestedLanguage* 永遠記錄偏好挑選到的 track，僅供參考。
 */
export async function fetchYoutubeTranscript(url, options = {}) {
    const fetchedAt = ts()
    const opt = options && typeof options === 'object' ? options : {}

    const videoId = typeof url === 'string' ? _extractVideoId(url) : null
    if (!videoId) {
        return { status: 'error', url: typeof url === 'string' ? url.slice(0, 200) : String(url), message: 'invalid YouTube URL or video ID', reason: 'invalid-url', fetchedAt, attempts: 0 }
    }
    const watchUrl = `https://www.youtube.com/watch?v=${videoId}`

    const str = (v) => (typeof v === 'string' && v.trim() !== '' ? v.trim() : null)
    const posInt = (v, def) => (Number.isInteger(v) && v > 0 ? v : def)
    const language = str(opt.language)
    const userDataDir = str(opt.userDataDir) || path.join(os.homedir(), '.w-yt-chrome-profile')
    if (_isDailyBrowserDir(userDataDir)) {
        return { status: 'error', url: watchUrl, videoId, message: 'userDataDir must be a dedicated profile folder, not the daily browser User Data folder', reason: 'invalid-option', fetchedAt, attempts: 0 }
    }

    const headless = opt.headless !== false

    // 主路徑：w-dwload-dlp——不開瀏覽器、不需登入；確定性失敗直接回報，其餘才退回 Playwright UI
    try {
        return await _tryDwloadDlp(watchUrl, videoId, language, fetchedAt)
    }
    catch (err) {
        const reason = classifyDwloadError(err)
        if (reason) {
            return { status: 'error', url: watchUrl, videoId, message: String(err), reason, method: 'w-dwload-dlp', fetchedAt, attempts: 1 }
        }
        if (opt.fallback === false) {
            return { status: 'error', url: watchUrl, videoId, message: String(err), reason: 'primary-failed', method: 'w-dwload-dlp', fetchedAt, attempts: 1 }
        }
        process.stderr.write(`[fetch-youtube-transcript] w-dwload-dlp 路徑失敗（${String(err).split('\n')[0]}），退回 Playwright UI 路徑（${headless ? `背景執行，不顯示視窗${opt.escalate === false ? '；失敗時不升級為有頭' : '；無頭失敗時將升級為有頭模式再試一次'}` : '將開啟瀏覽器視窗'}）\n`)
    }

    // 備援路徑
    let chromium
    try {
        ({ chromium } = await import('playwright'))
    }
    catch {
        return { status: 'error', url: watchUrl, videoId, message: 'playwright not installed (run npm i in the skills root)', reason: 'missing-deps', fetchedAt, attempts: 0 }
    }

    const cfg = {
        chromium,
        watchUrl,
        videoId,
        language,
        userDataDir,
        fetchedAt,
        chromeChannel: str(opt.chromeChannel) || 'chrome',
        navTimeout: posInt(opt.navigationTimeoutMs, DEFAULT_NAV_TIMEOUT_MS),
        captionsWaitMs: posInt(opt.captionsWaitMs, DEFAULT_CAPTIONS_TIMEOUT_MS),
        transcriptWaitMs: posInt(opt.transcriptWaitMs, DEFAULT_TRANSCRIPT_TIMEOUT_MS),
        buttonWaitMs: posInt(opt.buttonWaitMs, DEFAULT_BUTTON_WAIT_MS),
    }

    // 階梯：先以 headless 指定之模式跑；無頭失敗（ESCALATE_REASONS）才升級為有頭再試一次，其餘直接回報
    const ladder = []
    let result = await _runBrowserRung(cfg, headless)
    ladder.push({ mode: result.mode, attempts: result.attempts, status: result.status, reason: result.reason || null })
    if (result.status === 'error' && headless && opt.escalate !== false && ESCALATE_REASONS.has(result.reason)) {
        process.stderr.write(`[fetch-youtube-transcript] 無頭備援失敗（${result.reason}：${String(result.message).split('\n')[0]}），升級為有頭模式再試一次（會開啟瀏覽器視窗；不想開視窗請加 --no-escalate）\n`)
        result = await _runBrowserRung(cfg, false)
        ladder.push({ mode: result.mode, attempts: result.attempts, status: result.status, reason: result.reason || null })
    }
    return { ...result, attempts: ladder.reduce((sum, x) => sum + x.attempts, 0), ladder }
}

// 備援之單一模式（無頭或有頭）：含該模式內之重試（瀏覽器啟動或導航失敗最多共 MAX_RETRIES + 1 次）；不 reject，回傳成功或失敗結果（attempts 為本模式之次數，mode 為本模式）
async function _runBrowserRung(c, headless) {
    const { chromium, watchUrl, videoId, language, userDataDir, fetchedAt, chromeChannel, navTimeout, captionsWaitMs, transcriptWaitMs, buttonWaitMs } = c
    const mode = headless ? 'headless' : 'headed'
    let lastMessage = ''
    let lastReason = 'unknown'

    for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
        let context = null
        let interceptedTranscript = null
        let interceptedTimedtext = null  // { body, url }，路徑 C
        try {
            // 持久 profile：登入態留在 userDataDir，跨執行沿用（Chrome 136+ 只允許對非預設目錄開 CDP）
            context = await chromium.launchPersistentContext(userDataDir, {
                headless,
                channel: chromeChannel,
                args: ['--disable-blink-features=AutomationControlled', '--mute-audio'],
                locale: 'zh-TW',
                viewport: { width: 1280, height: 720 },
            })
            const page = context.pages()[0] || await context.newPage()
            await page.addInitScript(() => {
                Object.defineProperty(navigator, 'webdriver', { get: () => false })
            })

            // 網路攔截：監聽 get_transcript（路徑 B）與播放器 CC 的 timedtext（路徑 C）
            page.on('response', async (res) => {
                const u = res.url()
                if (u.includes('/youtubei/v1/get_transcript')) {
                    try {
                        const body = await res.text()
                        if (res.status() === 200 && body.length > 100 && !interceptedTranscript) {
                            interceptedTranscript = body
                        }
                    } catch { /* noop */ }
                    return
                }
                if (u.includes('/api/timedtext')) {
                    // 必須過濾 v=<videoId>：前置廣告也會抓自己的 timedtext，不濾會拿到廣告字幕
                    if (!new RegExp(`[?&]v=${videoId}(&|$)`).test(u)) return
                    try {
                        const body = await res.text()
                        if (res.status() === 200 && body.length > 100 && !interceptedTimedtext) {
                            interceptedTimedtext = { body, url: u }
                        }
                    } catch { /* noop */ }
                }
            })

            await page.goto(watchUrl, { waitUntil: 'domcontentloaded', timeout: navTimeout })

            // 等 ytInitialPlayerResponse.captions 就緒；逾時即判定無字幕（註：頁面被同意畫面或驗證擋住時也會逾時，無從區分）
            try {
                await page.waitForFunction(() => {
                    return !!window.ytInitialPlayerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks
                }, { timeout: captionsWaitMs })
            } catch {
                lastMessage = 'video has no captionTracks (no subtitles available)'
                lastReason = 'no-captions'
                throw new Error(lastMessage)
            }

            const tracks = await page.evaluate(() => {
                return window.ytInitialPlayerResponse.captions.playerCaptionsTracklistRenderer.captionTracks.map((t) => ({
                    languageCode: t.languageCode,
                    name: t.name?.simpleText || t.name?.runs?.[0]?.text || '',
                    kind: t.kind || 'manual',
                }))
            })
            const picked = _pickTrack(tracks, language)

            // 注意：點「顯示轉錄稿」只會載入 YouTube 為本影片決定的「預設」字幕語言，
            // 本流程並未實際切換 UI 字幕語言到 picked。因此只有在「字幕軌唯一」時，
            // 載入內容才必然等於 picked；多軌時無法保證 segments 與 picked 同語言，
            // 此時不可把 picked 的語言碼當成實際內容的語言標籤（會 metadata 與內容不符）。
            const languageVerified = tracks.length === 1

            // 滾到 description 區；按鈕在說明區內，說明未展開時其盒子為 0×0（不可見），故等到按鈕可見為止（沒有可見者時定期展開說明）
            await page.evaluate(() => window.scrollTo(0, 500))
            const btnElem = await _findVisibleTranscriptButton(page, buttonWaitMs)

            // 捲動與點擊用 Playwright 原生 click（真實滑鼠事件；合成事件會被 YouTube 過濾）、短逾時；
            // 找不到可見按鈕、捲動或點擊失敗皆不致命——路徑 C（播放器 CC）與 DOM 路徑仍可能成功，不重試同一個必定失敗之動作
            if (btnElem) {
                try {
                    await btnElem.scrollIntoViewIfNeeded({ timeout: BUTTON_ACTION_TIMEOUT_MS })
                    await sleep(400)
                    await btnElem.click({ timeout: BUTTON_ACTION_TIMEOUT_MS })
                } catch (err) {
                    process.stderr.write(`[fetch-youtube-transcript] "Show transcript" button action failed（${String(err && err.message || err).split('\n')[0]}），僅走播放器 CC 備援路徑\n`)
                }
            } else {
                process.stderr.write(`[fetch-youtube-transcript] "Show transcript" visible button not found within ${buttonWaitMs}ms，僅走播放器 CC 備援路徑\n`)
            }

            // 路徑 C 觸發：點播放器取得 user gesture／焦點；CC 開啟改由迴圈內「讀狀態再補」確保
            await page.click('#movie_player', { position: { x: 320, y: 180 }, timeout: BUTTON_ACTION_TIMEOUT_MS }).catch(() => { /* noop */ })
            await sleep(300)

            // 三路徑並行等待
            const start = Date.now()
            let segments = null
            let source = null

            while (Date.now() - start < transcriptWaitMs) {
                const domSegs = await _readSegmentsFromDOM(page)
                if (domSegs.length > 0) {
                    // 頁面顯示的時戳為 0:01 或 1:02:03，轉成 ms 後重新格式化，使 t 與主路徑相同（00:01、01:02:03）
                    segments = domSegs.map((s) => { const tMs = _domTimestampToMs(s.t); return { tMs, t: timestampFromMs(tMs), txt: s.txt } })
                    source = 'dom'
                    break
                }
                if (interceptedTranscript) {
                    const netSegs = _parseGetTranscriptJson(interceptedTranscript)
                    if (netSegs && netSegs.length > 0) {
                        segments = netSegs.map((s) => ({ tMs: s.tMs, t: timestampFromMs(s.tMs), txt: s.txt }))
                        source = 'network'
                        break
                    }
                }
                if (interceptedTimedtext) {
                    const ttSegs = _parseTimedtextJson3(interceptedTimedtext.body)
                    if (ttSegs && ttSegs.length > 0) {
                        segments = ttSegs.map((s) => ({ tMs: s.tMs, t: timestampFromMs(s.tMs), txt: s.txt }))
                        source = 'timedtext'
                        break
                    }
                }
                // 有前置廣告時主影片 timedtext 要等廣告播完才會來：點「略過廣告」須用原生 click
                //（廣告按鈕過濾合成事件，evaluate 內 el.click() 無效）
                try {
                    const skipHandle = await page.evaluateHandle(() => document.querySelector('.ytp-skip-ad-button, .ytp-ad-skip-button, .ytp-ad-skip-button-modern'))
                    const skipElem = skipHandle.asElement()
                    if (skipElem) await skipElem.click({ timeout: BUTTON_ACTION_TIMEOUT_MS })  // 短逾時：按鈕尚不可見時不卡 30 秒，下一輪再試
                } catch { /* noop */ }
                // 確保影片在播放（timedtext 由播放器載入；被暫停就永遠等不到）
                const paused = await page.evaluate(() => document.querySelector('#movie_player video')?.paused ?? null).catch(() => null)
                if (paused === true) await page.keyboard.press('k').catch(() => { /* noop */ })
                // 確保 CC 開啟：讀 aria-pressed 判斷狀態再補按 c（避免盲按把已開的 CC 關掉）
                const ccOn = await page.evaluate(() => document.querySelector('.ytp-subtitles-button')?.getAttribute('aria-pressed') || null).catch(() => null)
                if (ccOn === 'false') await page.keyboard.press('c').catch(() => { /* noop */ })
                await sleep(POLL_INTERVAL_MS)
            }

            if (!segments) {
                lastMessage = `transcript did not load within ${transcriptWaitMs}ms (no segments appeared from the transcript panel, get_transcript or player CC)`
                lastReason = 'transcript-empty'
                throw new Error(lastMessage)
            }

            // YouTube 同時渲染多個 transcript panel 容器時 DOM 會把每段抓到兩次；用 tMs+txt 去重再依 tMs 排序，對 network 路徑為 no-op
            {
                const seen = new Map()
                for (const s of segments) {
                    const k = `${s.tMs}|${s.txt}`
                    if (!seen.has(k)) seen.set(k, s)
                }
                segments = [...seen.values()].sort((a, b) => a.tMs - b.tMs)
            }

            const timestampedText = segments.map((s) => `[${s.t}] ${s.txt}`).join('\n')
            const plainText = segments.map((s) => s.txt).join('\n')

            // language/languageName/kind 只在能確認實際載入內容時給值：
            //   - 字幕軌唯一 (languageVerified)：載入的必然是那一軌
            //   - 路徑 C (timedtext)：URL 的 lang= / kind=asr 參數直接標明實際載入的軌，最可信
            let effLanguage = languageVerified ? (picked?.languageCode || null) : null
            let effLanguageName = languageVerified ? (picked?.name || null) : null
            let effKind = languageVerified ? (picked?.kind || null) : null
            let effVerified = languageVerified
            if (source === 'timedtext' && interceptedTimedtext?.url) {
                const mLang = interceptedTimedtext.url.match(/[?&]lang=([^&]+)/)
                if (mLang) {
                    effLanguage = decodeURIComponent(mLang[1])
                    effKind = /[?&]kind=asr(&|$)/.test(interceptedTimedtext.url) ? 'asr' : 'manual'
                    effLanguageName = tracks.find((t) => t.languageCode === effLanguage)?.name || null
                    effVerified = true
                }
            }

            return {
                status: 'success',
                url: watchUrl,
                videoId,
                language: effLanguage,
                languageName: effLanguageName,
                kind: effKind,
                languageVerified: effVerified,
                requestedLanguage: picked?.languageCode || null,
                requestedLanguageName: picked?.name || null,
                requestedKind: picked?.kind || null,
                availableTracks: tracks,
                segments,
                segmentsCount: segments.length,
                plainText,
                timestampedText,
                source,
                method: 'playwright-ui',
                mode,
                fetchedAt,
                attempts: attempt,
            }
        } catch (err) {
            lastMessage = err.message || String(err)
            // 已分類的錯誤直接 propagate
            if (lastReason === 'no-captions' || lastReason === 'transcript-empty') {
                return {
                    status: 'error', url: watchUrl, videoId,
                    message: lastMessage, reason: lastReason,
                    method: 'playwright-ui', mode, fetchedAt, attempts: attempt,
                }
            }
            // 其他例外（瀏覽器啟動、導航等）→ retry
            if (attempt <= MAX_RETRIES) {
                const waitTime = retryWaitMs(attempt)
                process.stderr.write(`[fetch-youtube-transcript] error: ${lastMessage}，等 ${waitTime}ms 後重試 (${attempt}/${MAX_RETRIES})\n`)
                await sleep(waitTime)
                continue
            }
            return {
                status: 'error', url: watchUrl, videoId,
                message: lastMessage, reason: 'playwright-error',
                method: 'playwright-ui', mode, fetchedAt, attempts: attempt,
            }
        } finally {
            if (context) await context.close().catch(() => { /* noop */ })
        }
    }

    return { status: 'error', url: watchUrl, videoId, message: lastMessage || 'max retries exceeded', reason: lastReason || 'unknown', method: 'playwright-ui', mode, fetchedAt, attempts: MAX_RETRIES + 1 }
}

export default fetchYoutubeTranscript
