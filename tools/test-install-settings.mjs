//install-settings.mjs 之離線測試: node tools/test-install-settings.mjs → 末行 RESULT cases=N fail=0
//以暫存之假 repo(tools/install-settings.mjs＋settings_global.json＋hooks/)與假使用者目錄(USERPROFILE／HOME 指向暫存夾)執行,不動本機真實設定
import fs from 'fs'
import os from 'os'
import path from 'path'
import { spawnSync } from 'child_process'
import { fileURLToPath } from 'url'

let root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
let fdT = fs.mkdtempSync(path.join(os.tmpdir(), 'test-install-settings-'))
let n = 0
let bad = 0
let check = (name, ok, info = '') => {
    n++
    if (!ok) {
        bad++
    }
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : ` → ${String(info).slice(-400)}`}`)
}

//mkRepo, 建假 repo;tpl 為 settings_global.json 之內容
let mkRepo = (name, tpl) => {
    let r = path.join(fdT, name)
    fs.mkdirSync(path.join(r, 'tools'), { recursive: true })
    fs.mkdirSync(path.join(r, 'hooks'), { recursive: true })
    fs.copyFileSync(path.join(root, 'tools', 'install-settings.mjs'), path.join(r, 'tools', 'install-settings.mjs'))
    fs.writeFileSync(path.join(r, 'hooks', 'h1.mjs'), 'console.log(1)\n')
    fs.writeFileSync(path.join(r, 'settings_global.json'), tpl)
    return r
}
let run = (repo, home, args = []) => {
    let r = spawnSync(process.execPath, [path.join(repo, 'tools', 'install-settings.mjs'), ...args], { encoding: 'utf8', env: { ...process.env, USERPROFILE: home, HOME: home } })
    return { code: r.status, out: (r.stdout || '') + (r.stderr || '') }
}
let tplOk = JSON.stringify({ a: 1, hooks: { SessionStart: [{ hooks: [{ type: 'command', command: 'node "{{HOME}}/.claude/hooks/h1.mjs"' }] }] } }, null, 2)

//1. 使用者名稱含空白與非 ASCII:{{HOME}} 換為該使用者目錄(正斜線),hook 複製,寫出合法 JSON
let home1 = path.join(fdT, 'Users', 'test 使用者')
fs.mkdirSync(home1, { recursive: true })
let repo1 = mkRepo('repo1', tplOk)
let r = run(repo1, home1)
let fpS1 = path.join(home1, '.claude', 'settings.json')
let s1 = fs.existsSync(fpS1) ? JSON.parse(fs.readFileSync(fpS1, 'utf8')) : {}
let cmd1 = s1.hooks && s1.hooks.SessionStart[0].hooks[0].command
check('{{HOME}} 換為本機使用者目錄', r.code === 0 && cmd1 === `node "${home1.replace(/\\/g, '/')}/.claude/hooks/h1.mjs"`, r.out + ' ' + cmd1)
check('hook 腳本複製至 ~/.claude/hooks', fs.existsSync(path.join(home1, '.claude', 'hooks', 'h1.mjs')), r.out)

//2. 再跑一次:無變更、不產生備份
r = run(repo1, home1)
check('內容相同時無變更且不備份', r.code === 0 && /無變更/.test(r.out) && !fs.existsSync(`${fpS1}.bak`), r.out)

//3. 本機已有不同之 settings.json:整份取代並備份原檔
fs.writeFileSync(fpS1, JSON.stringify({ old: true }))
r = run(repo1, home1)
check('不同時整份取代並備份為 settings.json.bak', r.code === 0 && JSON.parse(fs.readFileSync(`${fpS1}.bak`, 'utf8')).old === true && JSON.parse(fs.readFileSync(fpS1, 'utf8')).a === 1, r.out)

//4. 未知之佔位字:失敗且不寫入
let home4 = path.join(fdT, 'home4')
fs.mkdirSync(home4, { recursive: true })
let repo4 = mkRepo('repo4', tplOk.replace('{{HOME}}', '{{USERNAME}}'))
r = run(repo4, home4)
check('未知佔位字即失敗且不寫入', r.code === 1 && /未知之佔位字/.test(r.out) && !fs.existsSync(path.join(home4, '.claude', 'settings.json')), r.out)

//5. 範本非合法 JSON:失敗且不寫入
let repo5 = mkRepo('repo5', '{ "a": 1, }')
r = run(repo5, home4)
check('範本非合法 JSON 即失敗且不寫入', r.code === 1 && /不是合法 JSON/.test(r.out) && !fs.existsSync(path.join(home4, '.claude', 'settings.json')), r.out)

//6. 使用者目錄含引號(JSON 須跳脫):產出仍為合法 JSON 且值正確
let home6 = path.join(fdT, 'Users', 'a"b')
let ok6 = true
try {
    fs.mkdirSync(home6, { recursive: true })
}
catch (err) {
    ok6 = false //Windows 不允許檔名含引號,略過
}
if (ok6) {
    r = run(repo1, home6)
    let s6 = JSON.parse(fs.readFileSync(path.join(home6, '.claude', 'settings.json'), 'utf8'))
    check('使用者目錄含引號時仍為合法 JSON', s6.hooks.SessionStart[0].hooks[0].command.includes('a"b'), r.out)
}
else {
    console.log('skip 使用者目錄含引號(本平台不允許此檔名)')
}

//7. --dry 不寫入
let home7 = path.join(fdT, 'home7')
fs.mkdirSync(home7, { recursive: true })
r = run(repo1, home7, ['--dry'])
check('--dry 只印不寫', r.code === 0 && /settings\.json →/.test(r.out) && !fs.existsSync(path.join(home7, '.claude')), r.out)

fs.rmSync(fdT, { recursive: true, force: true })
console.log(`RESULT cases=${n} fail=${bad}`)
