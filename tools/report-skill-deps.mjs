//列出技能根之自有套件(wsemi、w-*)已安裝版本與 registry 最新版之對照(由 sync.bat 於 npm i／update 後呼叫, 亦可手動)
//用法: node tools/report-skill-deps.mjs <技能根> [--registry <網址>]
//只報告, 一律離開碼 0(registry 取不到時該列標 unknown);落後者標 STALE, 末行 SKILL-DEPS own=<n> stale=<m>
import fs from 'fs'
import path from 'path'
import { spawnSync } from 'child_process'

let argv = process.argv.slice(2)
let fdSkills = path.resolve(argv[0] || '.')
let i = argv.indexOf('--registry')
let registry = i >= 0 ? argv[i + 1] : ''
let isWin = process.platform === 'win32'

//runNpm, 優先以 node 直跑 npm-cli.js(免經 shell), 找不到才用 npm(.cmd)
let npmCli = path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js')
let runNpm = (args) => (fs.existsSync(npmCli)
    ? spawnSync(process.execPath, [npmCli, ...args], { encoding: 'utf8', timeout: 60000 })
    : spawnSync(isWin ? 'npm.cmd' : 'npm', args, { encoding: 'utf8', timeout: 60000, shell: isWin }))

let cmpVer = (a, b) => {
    let pa = String(a).split(/[.-]/).map((v) => Number(v) || 0)
    let pb = String(b).split(/[.-]/).map((v) => Number(v) || 0)
    for (let k = 0; k < 3; k++) {
        if (pa[k] !== pb[k]) {
            return pa[k] - pb[k]
        }
    }
    return 0
}

let pj = JSON.parse(fs.readFileSync(path.join(fdSkills, 'package.json'), 'utf8'))
let own = Object.keys(pj.dependencies || {}).filter((n) => n === 'wsemi' || n.startsWith('w-'))
let nStale = 0
console.log(`[skill-deps] registry: ${registry || '(npm 預設)'}`)
for (let name of own) {
    let installed = ''
    try {
        installed = JSON.parse(fs.readFileSync(path.join(fdSkills, 'node_modules', name, 'package.json'), 'utf8')).version
    }
    catch (e) {
        installed = '(未安裝)'
    }
    let r = runNpm(['view', name, 'version', ...(registry ? ['--registry', registry] : [])])
    let latest = r.status === 0 ? String(r.stdout || '').trim() : ''
    let mark = 'ok'
    if (!latest) {
        mark = 'unknown'
    }
    else if (installed === '(未安裝)' || cmpVer(installed, latest) < 0) {
        mark = 'STALE'
        nStale++
    }
    console.log(`[skill-deps] ${mark.padEnd(7)} ${name} installed=${installed} latest=${latest || '?'}`)
}
console.log(`SKILL-DEPS own=${own.length} stale=${nStale}`)
