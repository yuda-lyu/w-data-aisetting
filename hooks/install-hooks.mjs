//安裝本 repo 之全域 hook(主控 agent, 2026-10-28; 由 sync.bat 呼叫, 亦可手動執行)
//用法: node <本 repo>/hooks/install-hooks.mjs [--dry] [--uninstall]
//做兩件事:
//  1. 把 HOOKS 所列腳本自本檔所在資料夾複製到 ~/.claude/hooks/
//  2. 把對應之 hook 設定合併進 ~/.claude/settings.json: 只增改以腳本檔名辨識之本 repo 條目, 其他設定與他人之 hook 一律不動
//settings.json 存在但非合法 JSON 時中止且不寫入(避免覆蓋使用者設定); 有變更才寫, 寫前先備份為 settings.json.bak
//--dry: 只印出將寫入之 settings.json, 不複製不寫入; --uninstall: 移除本 repo 之條目(腳本檔保留)
import fs from 'fs'
import os from 'os'
import path from 'path'
import { fileURLToPath } from 'url'

let HOOKS = [
    { file: 'transcript-size-warn.mjs', events: ['UserPromptSubmit', 'SessionStart'], timeout: 10 },
]

let dry = process.argv.includes('--dry')
let uninstall = process.argv.includes('--uninstall')
let fdSrc = path.dirname(fileURLToPath(import.meta.url))
let fdClaude = path.join(os.homedir(), '.claude')
let fdHooks = path.join(fdClaude, 'hooks')
let fpSettings = path.join(fdClaude, 'settings.json')

//cmdOf, hook 指令: 以帶磁碟機代號之正斜線絕對路徑呼叫 node(Git Bash 與 PowerShell 皆可解析)
let cmdOf = (file) => {
    let fp = path.join(fdHooks, file).replace(/\\/g, '/')
    return `node "${fp}"`
}

//isOurs, 判斷 hook 條目是否為本 repo 之某腳本
let isOurs = (h, file) => {
    return h && h.type === 'command' && String(h.command || '').includes(file)
}

let settings = {}
if (fs.existsSync(fpSettings)) {
    try {
        settings = JSON.parse(fs.readFileSync(fpSettings, 'utf8'))
    }
    catch (err) {
        console.log(`[install-hooks] FAIL ${fpSettings} 不是合法 JSON, 中止且未寫入: ${err.message}`)
        process.exit(1)
    }
}
let before = JSON.stringify(settings)
settings.hooks = settings.hooks || {}

for (let hk of HOOKS) {
    for (let ev of hk.events) {
        let groups = Array.isArray(settings.hooks[ev]) ? settings.hooks[ev] : []
        //先移除本腳本之舊條目(路徑可能不同), 再視需要補上
        groups = groups
            .map((g) => ({ ...g, hooks: (g.hooks || []).filter((h) => !isOurs(h, hk.file)) }))
            .filter((g) => g.hooks.length > 0)
        if (!uninstall) {
            groups.push({ hooks: [{ type: 'command', command: cmdOf(hk.file), timeout: hk.timeout }] })
        }
        if (groups.length > 0) {
            settings.hooks[ev] = groups
        }
        else {
            delete settings.hooks[ev]
        }
    }
}
if (Object.keys(settings.hooks).length === 0) {
    delete settings.hooks
}
let after = JSON.stringify(settings)

if (dry) {
    console.log(JSON.stringify(settings, null, 2))
    process.exit(0)
}

if (!uninstall) {
    fs.mkdirSync(fdHooks, { recursive: true })
    for (let hk of HOOKS) {
        let fpFrom = path.join(fdSrc, hk.file)
        let fpTo = path.join(fdHooks, hk.file)
        fs.copyFileSync(fpFrom, fpTo)
        console.log(`[install-hooks] copy ${path.resolve(fpTo)}`)
    }
}

if (after === before) {
    console.log(`[install-hooks] ${fpSettings} 無變更`)
    process.exit(0)
}
if (fs.existsSync(fpSettings)) {
    fs.copyFileSync(fpSettings, `${fpSettings}.bak`)
}
let fpTmp = `${fpSettings}.${process.pid}.tmp`
fs.writeFileSync(fpTmp, JSON.stringify(settings, null, 2) + '\n')
JSON.parse(fs.readFileSync(fpTmp, 'utf8'))
fs.renameSync(fpTmp, fpSettings)
console.log(`[install-hooks] ${uninstall ? '已移除' : '已寫入'} hook 設定: ${path.resolve(fpSettings)}(原檔備份為 settings.json.bak)`)
