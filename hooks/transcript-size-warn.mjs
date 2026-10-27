//對話紀錄(transcript)大小提醒 hook(主控 agent, 2026-10-28; 使用者指示: 對話紀錄過大會使 VS Code 開不了該 session, 超過門檻就提醒)
//掛在 UserPromptSubmit 與 SessionStart; 由 install-hooks.mjs 複製到 ~/.claude/hooks/ 並寫入 ~/.claude/settings.json
//行為:
//  未達提醒門檻(預設 800 MB): 不輸出
//  達提醒門檻、未達警告門檻(預設 1500 MB): SessionStart 每次提醒; UserPromptSubmit 每個 session 只提醒一次(記於狀態檔)
//  達警告門檻: 每次都提醒
//提醒同時送給使用者(systemMessage)與模型(additionalContext), 讓模型在適當斷點建議開新 session
//背景工作完成通知(<task-notification>)觸發之 UserPromptSubmit 一律略過, 只對使用者送出之訊息提醒
//門檻可調: 環境變數 CLAUDE_TRANSCRIPT_WARN_MB / CLAUDE_TRANSCRIPT_ALERT_MB 優先, 其次 ~/.claude/hooks/transcript-size-warn.json 之 { warnMB, alertMB }
//  該 json 另可設 debug: true, 把每次收到之輸入摘要(欄位名、事件、prompt 前 160 字)追加至 ~/.claude/hooks/transcript-size-warn.debug.jsonl, 供排查
//任何讀取失敗一律靜默結束(離開碼 0), 不得擋住使用者送出訊息
import fs from 'fs'
import os from 'os'
import path from 'path'

let fdHooks = path.join(os.homedir(), '.claude', 'hooks')
let fpConfig = path.join(fdHooks, 'transcript-size-warn.json')
let fpState = path.join(fdHooks, 'transcript-size-warn.state.json')
let dayMs = 24 * 60 * 60 * 1000

//readJson, 讀 json 檔, 失敗回 null
let readJson = (fp) => {
    try {
        return JSON.parse(fs.readFileSync(fp, 'utf8'))
    }
    catch (err) {
        return null
    }
}

//getThresholds, 取門檻(MB)
let getThresholds = () => {
    let cfg = readJson(fpConfig) || {}
    let pick = (envName, cfgVal, df) => {
        let v = Number(process.env[envName] || cfgVal)
        return v > 0 ? v : df
    }
    let warnMB = pick('CLAUDE_TRANSCRIPT_WARN_MB', cfg.warnMB, 800)
    let alertMB = pick('CLAUDE_TRANSCRIPT_ALERT_MB', cfg.alertMB, 1500)
    return { warnMB, alertMB: Math.max(alertMB, warnMB) }
}

//fmtSize, 一律以 MB 顯示(門檻也以 MB 設定, 避免 1500 MB 被換算成 1.46 GB 之混淆)
let fmtSize = (mb) => {
    return `${Math.round(mb).toLocaleString('en-US')} MB`
}

//markWarned, 記錄該 session 已提醒過, 並清掉 14 天前之紀錄
let markWarned = (state, sessionId) => {
    let now = Date.now()
    let next = {}
    for (let k of Object.keys(state)) {
        if (now - Number(state[k]) < 14 * dayMs) {
            next[k] = state[k]
        }
    }
    next[sessionId] = now
    try {
        fs.mkdirSync(fdHooks, { recursive: true })
        let fpTmp = `${fpState}.${process.pid}.tmp`
        fs.writeFileSync(fpTmp, JSON.stringify(next, null, 2))
        fs.renameSync(fpTmp, fpState)
    }
    catch (err) {}
}

let main = (raw) => {
    let input = {}
    try {
        input = JSON.parse(raw || '{}')
    }
    catch (err) {
        return
    }
    if ((readJson(fpConfig) || {}).debug) {
        try {
            let rec = { t: new Date().toISOString(), keys: Object.keys(input), event: input.hook_event_name, source: input.source, promptHead: String(input.prompt || '').slice(0, 160) }
            fs.appendFileSync(path.join(fdHooks, 'transcript-size-warn.debug.jsonl'), JSON.stringify(rec) + '\n')
        }
        catch (err) {}
    }
    let fpTranscript = input.transcript_path
    let event = input.hook_event_name || 'UserPromptSubmit'
    let sessionId = input.session_id || fpTranscript
    if (!fpTranscript) {
        return
    }
    //背景工作完成通知(<task-notification>)也會觸發 UserPromptSubmit(2026-10-28 實測), 不是使用者送出之訊息:
    //略過, 免得「只提醒一次」被通知用掉, 也免得每則通知都把提醒塞進模型脈絡
    if (event === 'UserPromptSubmit' && /^\s*<task-notification>/.test(String(input.prompt || ''))) {
        return
    }
    let size = 0
    try {
        size = fs.statSync(fpTranscript).size
    }
    catch (err) {
        return
    }
    let mb = size / 1024 / 1024
    let { warnMB, alertMB } = getThresholds()
    if (mb < warnMB) {
        return
    }

    let isAlert = mb >= alertMB
    if (!isAlert && event === 'UserPromptSubmit') {
        let state = readJson(fpState) || {}
        if (state[sessionId]) {
            return
        }
        markWarned(state, sessionId)
    }

    let level = isAlert ? '警告' : '提醒'
    let userMsg = `[對話紀錄${level}] 本 session 之對話紀錄已達 ${fmtSize(mb)}(提醒門檻 ${fmtSize(warnMB)}、警告門檻 ${fmtSize(alertMB)})。`
        + `紀錄超過約 2,400 MB 時 VS Code 可能再也開不了此 session;建議請 agent 把進行中之狀態寫進檔案後,開新 session 接續。`
        + (isAlert ? '(已達警告門檻,之後每則訊息都會提醒)' : '(本 session 只提醒這一次,達警告門檻後改為每則提醒)')
    let modelMsg = `[對話紀錄${level}] 本 session 之 transcript 檔已達 ${fmtSize(mb)}(${fpTranscript})。`
        + `紀錄超過約 2,400 MB 時 VS Code 可能無法再開啟此 session。請在目前工作的適當斷點,先把進行中之任務狀態、待辦與必要脈絡寫入專案之狀態檔或任務資料夾,`
        + `再建議使用者開新 session 接續;不要為此中斷正在執行的步驟,也不要自行刪除或搬移任何對話紀錄檔。`
    process.stdout.write(JSON.stringify({
        systemMessage: userMsg,
        hookSpecificOutput: {
            hookEventName: event,
            additionalContext: modelMsg,
        },
    }))
}

let chunks = []
process.stdin.on('data', (c) => chunks.push(c))
process.stdin.on('end', () => {
    try {
        main(Buffer.concat(chunks).toString('utf8'))
    }
    catch (err) {}
    process.exit(0)
})
process.stdin.on('error', () => process.exit(0))
