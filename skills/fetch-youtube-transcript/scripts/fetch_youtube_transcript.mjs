#!/usr/bin/env node
// fetch_youtube_transcript.mjs — CLI 包裝
//
// 用法:
//   node fetch_youtube_transcript.mjs <url-or-id> [outputPath] [--language=zh-TW] [--no-fallback] [--headed] [--no-escalate] [--user-data-dir=<dir>]
//   影片 ID 以 - 開頭時，在其前加 --：node fetch_youtube_transcript.mjs -- -abcdefghij
//
// 離開碼: 0 成功; 1 抓取失敗(結果 JSON 之 status 為 error，reason 見 SKILL.md); 2 參數錯誤(未抓取); 3 抓取後寫檔失敗
//
// --no-fallback：主路徑非確定性失敗時不退回瀏覽器（回 reason:'primary-failed'）
// --headed、--no-escalate、--user-data-dir 只影響備援路徑：備援採階梯，預設先無頭（不顯示視窗），無頭之非確定性失敗才升級為有頭再試一次；
//   --headed 一開始就顯示視窗（首次登入 YouTube 時用）；--no-escalate 不升級為有頭（不能跳視窗之場合用）
// 持久 profile：預設 ~/.w-yt-chrome-profile（首次登入 YouTube 後登入態沿用），--user-data-dir 可覆寫

import fs from 'node:fs'
import path from 'node:path'
import { fetchYoutubeTranscript } from './fetchYoutubeTranscript.mjs'

const USAGE = 'Usage: node fetch_youtube_transcript.mjs <url-or-id> [outputPath] [--language=zh-TW] [--no-fallback] [--headed] [--no-escalate] [--user-data-dir=<dir>]\n'
const LANG_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,34}$/

// Windows 保留裝置名（含 CONIN$／CONOUT$、COM0-9、上標 ¹²³）：不分大小寫、副檔名、尾端空白與句點，路徑中任一層都算。
// 即使 Windows 11 實測 fs 會建出名為 nul／con 的實體檔，此類檔名仍使 git 等工具無法處理，故一律拒絕
const WIN_DEVICE_RE = /^(con|prn|aux|nul|conin\$|conout\$|clock\$|com[0-9¹²³]|lpt[0-9¹²³])$/

// 檢查輸出路徑，不合格丟 Error；回傳絕對路徑
function guardOutputPath(p) {
    if (typeof p !== 'string' || p.trim() === '' || p.includes('\0')) throw new Error('輸出路徑無效')
    const abs = path.resolve(p)
    // 訊息不回顯路徑本身（只說明違反哪一條）
    if (process.platform === 'win32') {
        if (/^[\\/]{2}[.?][\\/]/.test(p) || /^[\\/]{2}[.?][\\/]/.test(abs)) throw new Error('輸出路徑：禁止寫入 Windows 裝置命名空間路徑（\\\\.\\ 或 \\\\?\\）')
        const rest = abs.slice(path.parse(abs).root.length)
        if (rest.includes(':')) throw new Error('輸出路徑：含磁碟機代號以外的冒號（可能是 NTFS 替代資料流）')
        for (const seg of rest.split(/[\\/]+/)) {
            const base = seg.split('.')[0].replace(/[ .]+$/, '').toLowerCase()  // 取第一個句點前（NUL.txt、NUL.tar.gz 皆等同 NUL），並去尾端空白
            if (WIN_DEVICE_RE.test(base)) throw new Error('輸出路徑：禁止使用 Windows 保留裝置名稱（nul、con、prn、aux、com0-9、lpt0-9 等）')
        }
    }
    if (fs.existsSync(abs) && fs.statSync(abs).isDirectory()) throw new Error('輸出路徑：是既有資料夾，請指定檔案')
    return abs
}

// 解析參數；錯誤丟 Error
function parseArgs(argv) {
    const positional = []
    const options = {}
    let rest = false
    for (const a of argv) {
        if (rest) positional.push(a)
        else if (a === '--') rest = true
        else if (a.startsWith('--language=')) {
            const v = a.slice('--language='.length)
            if (!LANG_RE.test(v)) throw new Error('--language 須為語言代碼（英數字、底線、連字號，如 zh-TW、ko、zh-Hans）')
            options.language = v
        }
        else if (a.startsWith('--user-data-dir=')) {
            const v = a.slice('--user-data-dir='.length)
            if (v === '') throw new Error('--user-data-dir 不可為空')
            options.userDataDir = v
        }
        else if (a === '--headed') options.headless = false
        else if (a === '--no-fallback') options.fallback = false
        else if (a === '--no-escalate') options.escalate = false
        else if (a.startsWith('-')) throw new Error(`未知的選項: ${a}`)
        else positional.push(a)
    }
    if (positional.length < 1) throw new Error('缺少 <url-or-id>')
    if (positional.length > 2) throw new Error('參數過多（只收 <url-or-id> 與 [outputPath]）')
    return { urlOrId: positional[0], outputPath: positional[1], options }
}

// 寫出一段文字到 stdout，等刷出完成再讓行程自然結束（不直接 process.exit；TTY 於 Windows 為非同步輸出，立即結束可能截斷）
function writeStdout(text) {
    return new Promise((resolve) => process.stdout.write(text, () => resolve()))
}

async function main() {
    const argv = process.argv.slice(2)
    if (argv.length === 0 || argv.includes('-h') || argv.includes('--help')) {
        process.stderr.write(USAGE)
        return argv.length === 0 ? 2 : 0
    }

    let parsed
    let outAbs = null
    try {
        parsed = parseArgs(argv)
        if (parsed.outputPath !== undefined) outAbs = guardOutputPath(parsed.outputPath)  // 空字串也要擋：呼叫端的變數為空時，不可悄悄改成印到 stdout
    }
    catch (err) {
        process.stderr.write(`參數錯誤：${err.message}\n${USAGE}`)
        return 2
    }

    let result
    try {
        result = await fetchYoutubeTranscript(parsed.urlOrId, parsed.options)
    }
    catch (err) {
        result = { status: 'error', url: String(parsed.urlOrId).slice(0, 200), message: String(err && err.message || err), reason: 'unexpected-error', attempts: 0 }
    }
    const payload = JSON.stringify(result, null, 2)
    const code = result.status === 'success' ? 0 : 1

    if (!outAbs) {
        await writeStdout(payload + '\n')
        return code
    }

    try {
        fs.mkdirSync(path.dirname(outAbs), { recursive: true })
        fs.writeFileSync(outAbs, payload, 'utf-8')
    }
    catch (err) {
        process.stderr.write(`寫檔失敗（${err && err.code || 'unknown'}）\n`)
        return 3
    }
    const { segments, plainText, timestampedText, ...meta } = result
    await writeStdout(JSON.stringify({ ...meta, output_path: outAbs }, null, 2) + '\n')
    return code
}

main().catch((err) => {
    process.stderr.write(`未預期的錯誤：${err && err.stack || err}\n`)
    return 1
}).then((code) => {
    process.exitCode = code
    // 不在此直接 process.exit()：讓事件迴圈自然排空，輸出刷完才結束，也不與仍在關閉中的控制代碼競爭。若有殘留控制代碼使行程不結束，10 秒後強制結束（計時器不阻止自然結束）
    setTimeout(() => process.exit(), 10000).unref()
})
