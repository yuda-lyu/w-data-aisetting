//安裝全域設定與 hook(由 sync.bat 呼叫, 亦可手動執行): node <本 repo>/tools/install-settings.mjs [--dry]
//做兩件事:
//  1. 把本 repo hooks/ 之 *.mjs 複製到 ~/.claude/hooks/(hook 腳本)
//  2. 以本 repo 之 settings_global.json 為範本產生 ~/.claude/settings.json(整份取代, 即同步):
//     範本內之 {{HOME}} 換為本機使用者目錄(os.homedir(), 正斜線, 如 C:/Users/<使用者>), 使範本不寫死使用者
//安全: 範本須為合法 JSON、不得殘留未知之 {{...}}、產出須為合法 JSON; 有變更才寫, 寫前備份為 settings.json.bak, 以暫存檔改名寫入
//--dry: 只印出將寫入之 settings.json 與將複製之 hook, 不寫入
import fs from 'fs'
import os from 'os'
import path from 'path'
import { fileURLToPath } from 'url'

let dry = process.argv.includes('--dry')
let root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
let fpTpl = path.join(root, 'settings_global.json')
let fdHooksSrc = path.join(root, 'hooks')
let fdClaude = path.join(os.homedir(), '.claude')
let fdHooks = path.join(fdClaude, 'hooks')
let fpSettings = path.join(fdClaude, 'settings.json')

let fail = (msg) => {
    console.log(`[install-settings] FAIL ${msg}`)
    process.exit(1)
}

//render, 範本之佔位字代換; 佔位字之值以 JSON 字串跳脫(路徑含引號或反斜線亦不破壞 JSON)
let home = os.homedir().replace(/\\/g, '/')
let vars = { HOME: home }
let tpl = fs.readFileSync(fpTpl, 'utf8')
try {
    JSON.parse(tpl)
}
catch (err) {
    fail(`${fpTpl} 不是合法 JSON: ${err.message}`)
}
let out = tpl.replace(/\{\{(\w+)\}\}/g, (s, k) => {
    if (!(k in vars)) {
        fail(`${fpTpl} 含未知之佔位字 ${s}(只支援 ${Object.keys(vars).map((v) => `{{${v}}}`).join('、')})`)
    }
    return JSON.stringify(vars[k]).slice(1, -1)
})
let settings = null
try {
    settings = JSON.parse(out)
}
catch (err) {
    fail(`代換後不是合法 JSON: ${err.message}`)
}
let text = JSON.stringify(settings, null, 2) + '\n'

let hookFiles = fs.existsSync(fdHooksSrc) ? fs.readdirSync(fdHooksSrc).filter((f) => f.endsWith('.mjs')) : []

if (dry) {
    console.log(`[install-settings] hooks → ${fdHooks}: ${hookFiles.join(', ') || '(無)'}`)
    console.log(`[install-settings] settings.json → ${fpSettings}:`)
    process.stdout.write(text)
    process.exit(0)
}

fs.mkdirSync(fdHooks, { recursive: true })
for (let f of hookFiles) {
    fs.copyFileSync(path.join(fdHooksSrc, f), path.join(fdHooks, f))
    console.log(`[install-settings] copy hook ${path.join(fdHooks, f)}`)
}

let old = fs.existsSync(fpSettings) ? fs.readFileSync(fpSettings, 'utf8') : null
if (old !== null && old.replace(/\r\n/g, '\n') === text) {
    console.log(`[install-settings] ${fpSettings} 無變更`)
    process.exit(0)
}
if (old !== null) {
    fs.copyFileSync(fpSettings, `${fpSettings}.bak`)
}
let fpTmp = `${fpSettings}.${process.pid}.tmp`
fs.writeFileSync(fpTmp, text)
JSON.parse(fs.readFileSync(fpTmp, 'utf8'))
fs.renameSync(fpTmp, fpSettings)
console.log(`[install-settings] 已寫入 ${fpSettings}(以 settings_global.json 產生,{{HOME}}=${home}${old !== null ? ';原檔備份為 settings.json.bak' : ''})`)
