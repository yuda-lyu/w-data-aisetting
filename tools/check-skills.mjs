//全域技能與全域設定原稿之自檢(主控 agent, 2026-10-22; 使用者指示: 調整時或推送前輔助自檢)
//用法: node <本 repo>/tools/check-skills.mjs [--quiet]
//      repo 根目錄由本檔位置推得(tools/ 之上一層),不依賴工作目錄; --quiet 只印錯誤
//檢查:
//  [技能] skills/<名>/SKILL.md 存在; frontmatter 有 name 與 description; name 與資料夾名相同且為小寫連字號(≤64 字);
//         description 非空, 超過 1024 字元提示(Agent Skills 規格上限; 過長可能於技能清單被截斷)
//  [連結] 技能內 markdown 相對連結之目標檔存在(含 references/ 等子檔; 略過 http、mailto、純錨點)
//  [引用] CLAUDE_global.md 與技能內 skill[名] 之名稱須為 skills/ 下既有技能
//  [同步] sync.bat 須純 ASCII 且全為 CRLF(cmd.exe 對 LF 批次檔之 goto 標籤不可靠)
//  [設定] settings_global.json 須為合法 JSON、不得寫死使用者路徑(用 {{HOME}})、只用已知佔位字、hook 指令引用之 hooks/<檔> 須存在
//  [依賴] skills/.npmrc 須存在且除註解外只有一行 registry=<http(s) 網址>(不得含權杖等其他設定);
//         skills/package.json 之自有套件(wsemi、w-*)寫 ^x.y.z、外部套件寫確切版本 x.y.z(外部經檢查才升版, ^ 會讓各台 npm update 未經檢查即升)
//  [公開] 本 repo 為 GitHub 公開庫: 追蹤檔(含未忽略之新檔)不得含金鑰樣式; 內網 IPv4(127.0.0.1、0.0.0.0 除外)只可出現於 CLAUDE_global.md 與 skills/.npmrc 之 registry 一行
//結果: 第一行為 CHECK-SKILLS errors=<n> warnings=<m>; 有錯誤離開碼 1, 只有提示離開碼 0
import fs from 'fs'
import path from 'path'
import { execFileSync } from 'child_process'
import { fileURLToPath } from 'url'

let quiet = process.argv.includes('--quiet')
let root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
let fdSkills = path.join(root, 'skills')
let errs = []
let warns = []
let err = (where, msg) => errs.push(`ERROR ${where}: ${msg}`)
let warn = (where, msg) => warns.push(`WARN  ${where}: ${msg}`)
let rel = (fp) => path.relative(root, fp).replace(/\\/g, '/')

if (!fs.existsSync(fdSkills) || !fs.existsSync(path.join(root, 'CLAUDE_global.md'))) {
    console.log(`CHECK-SKILLS errors=1 warnings=0\nERROR 位置: 本檔須位於 w-data-aisetting 之 tools/ 下(找不到 skills/ 或 CLAUDE_global.md): ${root}`)
    process.exit(1)
}

//listMd, 遞迴列出資料夾內之 .md(略過 node_modules)
let listMd = (fd) => {
    let r = []
    for (let d of fs.readdirSync(fd, { withFileTypes: true })) {
        if (d.name === 'node_modules') {
            continue
        }
        let fp = path.join(fd, d.name)
        if (d.isDirectory()) {
            r.push(...listMd(fp))
        }
        else if (d.name.endsWith('.md')) {
            r.push(fp)
        }
    }
    return r
}

//parseFrontmatter, 只解析 name 與 description(單行值,或 | / > 區塊)
let parseFrontmatter = (txt) => {
    let lines = txt.replace(/^﻿/, '').split(/\r?\n/)
    if (lines[0] !== '---') {
        return null
    }
    let end = lines.indexOf('---', 1)
    if (end < 0) {
        return null
    }
    let fm = {}
    for (let i = 1; i < end; i++) {
        let m = /^([A-Za-z_-]+):\s*(.*)$/.exec(lines[i])
        if (!m) {
            continue
        }
        let [, k, v] = m
        if (/^[|>][+-]?$/.test(v.trim())) {
            let buf = []
            while (i + 1 < end && (/^\s+\S/.test(lines[i + 1]) || lines[i + 1].trim() === '')) {
                buf.push(lines[++i].trim())
            }
            v = buf.join('\n').trim()
        }
        fm[k] = v.trim().replace(/^(['"])(.*)\1$/, '$2')
    }
    return fm
}

//skills
let skillNames = new Set()
let dirs = fs.readdirSync(fdSkills, { withFileTypes: true }).filter((d) => d.isDirectory() && d.name !== 'node_modules')
for (let d of dirs) {
    skillNames.add(d.name)
}
for (let d of dirs) {
    let where = `skills/${d.name}`
    let fpSkill = path.join(fdSkills, d.name, 'SKILL.md')
    if (!fs.existsSync(fpSkill)) {
        err(where, '缺 SKILL.md')
        continue
    }
    let fm = parseFrontmatter(fs.readFileSync(fpSkill, 'utf8'))
    if (!fm) {
        err(`${where}/SKILL.md`, 'frontmatter 缺或格式錯(首行須為 ---,並以 --- 結束)')
        continue
    }
    if (!fm.name) {
        err(`${where}/SKILL.md`, 'frontmatter 缺 name')
    }
    else {
        if (fm.name !== d.name) {
            err(`${where}/SKILL.md`, `name「${fm.name}」與資料夾名「${d.name}」不同`)
        }
        if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(fm.name) || fm.name.length > 64) {
            err(`${where}/SKILL.md`, `name「${fm.name}」須為小寫英數與連字號、至多 64 字`)
        }
    }
    if (!fm.description) {
        err(`${where}/SKILL.md`, 'frontmatter 缺 description 或為空')
    }
    else if (fm.description.length > 1024) {
        warn(`${where}/SKILL.md`, `description ${fm.description.length} 字元,超過 1024(Agent Skills 規格上限;技能清單可能截斷或不顯示)`)
    }
}

//mdFiles, 技能內全部 .md 與全域設定原稿
let mdFiles = listMd(fdSkills)
let fpGlobal = path.join(root, 'CLAUDE_global.md')
for (let fp of [...mdFiles, fpGlobal]) {
    let txt = fs.readFileSync(fp, 'utf8')
    //去掉圍欄程式碼區塊, 避免把範例當成連結或引用
    let body = txt.replace(/^```[\s\S]*?^```/gm, '')
    //markdown 相對連結
    if (fp !== fpGlobal) {
        for (let m of body.matchAll(/\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
            let target = m[1]
            if (/^(https?:|mailto:|#)/i.test(target) || /^<.*>$/.test(target)) {
                continue
            }
            let p = decodeURIComponent(target.split('#')[0])
            if (!p) {
                continue
            }
            //不像路徑者(無 / 且無副檔名, 如 [標記](§1))多為誤寫成連結之文字: 渲染後成為壞連結, 只提示
            if (!/[/\\]/.test(p) && !/\.[A-Za-z0-9]{1,5}$/.test(p)) {
                warn(rel(fp), `疑似誤寫成連結(渲染後為壞連結): [${m[0].slice(0, 40)}`)
                continue
            }
            if (!fs.existsSync(path.resolve(path.dirname(fp), p))) {
                err(rel(fp), `連結目標不存在: ${target}`)
            }
        }
    }
    //skill[名] 引用
    for (let m of body.matchAll(/skill\[([^\]\s]+)\]/g)) {
        if (!skillNames.has(m[1])) {
            err(rel(fp), `引用之技能不存在: skill[${m[1]}]`)
        }
    }
}

//sync.bat
let fpBat = path.join(root, 'sync.bat')
if (fs.existsSync(fpBat)) {
    let buf = fs.readFileSync(fpBat)
    if (buf.some((b) => b > 0x7f)) {
        err('sync.bat', '含非 ASCII 字元(須純 ASCII)')
    }
    let s = buf.toString('latin1')
    let nLf = (s.match(/\n/g) || []).length
    let nCrlf = (s.match(/\r\n/g) || []).length
    if (nLf !== nCrlf) {
        err('sync.bat', `換行須全為 CRLF(LF ${nLf} 個,其中 CRLF ${nCrlf} 個)`)
    }
}
else {
    err('sync.bat', '不存在')
}

//settings_global.json(sync.bat 以 tools/install-settings.mjs 產生各台之 ~/.claude/settings.json)
let fpSet = path.join(root, 'settings_global.json')
if (fs.existsSync(fpSet)) {
    let s = fs.readFileSync(fpSet, 'utf8')
    try {
        JSON.parse(s)
    }
    catch (e) {
        err('settings_global.json', `不是合法 JSON: ${e.message}`)
    }
    if (/[A-Za-z]:[\\/]+Users[\\/]+[^{\\/"]+|\/home\/[^{/"]+/i.test(s)) {
        err('settings_global.json', '寫死使用者路徑(改用佔位字 {{HOME}},由 sync.bat 依各台填入)')
    }
    for (let m of s.matchAll(/\{\{(\w+)\}\}/g)) {
        if (m[1] !== 'HOME') {
            err('settings_global.json', `未知之佔位字 ${m[0]}(只支援 {{HOME}})`)
        }
    }
    for (let m of s.matchAll(/\{\{HOME\}\}\/\.claude\/hooks\/([^"\\]+)/g)) {
        if (!fs.existsSync(path.join(root, 'hooks', m[1]))) {
            err('settings_global.json', `hook 指令引用之 hooks/${m[1]} 不存在`)
        }
    }
}
else {
    err('settings_global.json', '不存在')
}

//skills/.npmrc 與 skills/package.json(技能根之安裝來源與版本寫法)
let fpNpmrc = path.join(fdSkills, '.npmrc')
if (fs.existsSync(fpNpmrc)) {
    let lines = fs.readFileSync(fpNpmrc, 'utf8').split(/\r?\n/).map((s) => s.trim()).filter((s) => s && !/^[#;]/.test(s))
    let nReg = lines.filter((s) => /^registry=https?:\/\/[^\s]+\/$/.test(s)).length
    if (nReg !== 1 || lines.length !== 1) {
        err('skills/.npmrc', `除註解外須只有一行 registry=<http(s) 網址,結尾 />(現有 ${lines.length} 行設定,其中合格之 registry ${nReg} 行);權杖等設定不得入庫`)
    }
}
else {
    err('skills/.npmrc', '不存在(技能根之自有套件須自內網 Verdaccio 安裝)')
}
let fpSkPj = path.join(fdSkills, 'package.json')
try {
    let deps = JSON.parse(fs.readFileSync(fpSkPj, 'utf8')).dependencies || {}
    for (let [n, v] of Object.entries(deps)) {
        let own = n === 'wsemi' || n.startsWith('w-')
        if (own && !/^\^\d+\.\d+\.\d+$/.test(v)) {
            err('skills/package.json', `自有套件 ${n} 須寫 ^x.y.z(現為 ${v})`)
        }
        if (!own && !/^\d+\.\d+\.\d+$/.test(v)) {
            err('skills/package.json', `外部套件 ${n} 須釘確切版本 x.y.z(現為 ${v});升版經供應鏈檢查後才改`)
        }
    }
}
catch (e) {
    err('skills/package.json', `讀取或解析失敗: ${e.message}`)
}

//公開庫衛生: 追蹤檔與未忽略之新檔
let files = []
try {
    files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).split('\0').filter(Boolean)
}
catch (e) {
    warn('git', `無法列出檔案,略過公開庫衛生檢查: ${e.message}`)
}
let reSecret = /(sk-[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY-----)/
let reIp = /(?<![\d.])((?:10|127|172|192|100)\.\d{1,3}\.\d{1,3}\.\d{1,3})(?![\d.])/g
let isInternal = (ip) => {
    let [a, b] = ip.split('.').map(Number)
    return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127)
}
for (let f of files) {
    if (f.includes('node_modules/')) {
        continue
    }
    let fp = path.join(root, f)
    let st
    try {
        st = fs.statSync(fp)
    }
    catch (e) {
        continue
    }
    if (!st.isFile() || st.size > 2 * 1024 * 1024) {
        continue
    }
    let buf = fs.readFileSync(fp)
    if (buf.includes(0)) {
        continue //二進位檔
    }
    let txt = buf.toString('utf8')
    let lines = txt.split(/\r?\n/)
    lines.forEach((ln, i) => {
        if (reSecret.test(ln)) {
            err(`${f}:${i + 1}`, '疑似金鑰或私鑰(公開庫不得含)')
        }
        //例外: CLAUDE_global.md(內網 Gitea 資訊)、skills/.npmrc 之 registry 一行(自有套件之 Verdaccio,同一主機已見於 CLAUDE_global.md;使用者 2026-10-29)
        let allowIp = f === 'CLAUDE_global.md' || (f === 'skills/.npmrc' && /^registry=http:\/\/[\d.]+:\d+\/$/.test(ln))
        if (!allowIp) {
            for (let m of ln.matchAll(reIp)) {
                if (isInternal(m[1])) {
                    err(`${f}:${i + 1}`, `內網位址 ${m[1]}(僅 CLAUDE_global.md 與 skills/.npmrc 之 registry 一行可含)`)
                }
            }
        }
    })
}

console.log(`CHECK-SKILLS errors=${errs.length} warnings=${warns.length} skills=${dirs.length} md=${mdFiles.length}`)
for (let s of errs) {
    console.log(s)
}
if (!quiet) {
    for (let s of warns) {
        console.log(s)
    }
}
process.exitCode = errs.length > 0 ? 1 : 0
