//自有套件使用界線掃描(L0e): 列出使用 wsemi、w-* 時可能超出設計界線之站點; 只讀檔, 不連外, 不執行任何外部程式
//執行: node audit-own-pkg.mjs [--root <專案根, 預設工作路徑>] [--info] [--all] [--allow-pkg <套件名,套件名>]
//  --info: 另列關閉套件預設功能之站點(E1), 供核對需求
//  --all: 待判讀每條規則預設只列前 30 處, 加此旗標列全部
//  --allow-pkg: C3 無法行內註明, 已確認合法者以此旗標列出套件名, 計入「已註明」
//分級: 必修(A1、C3)任一處即離開碼 1; 待判讀只列出, 逐項答 references/自有套件濫用檢測.md 之三問
//例外: 同列或前一列註明 audit-own-pkg: allow <理由>(理由不可空), 計入「已註明」, 不計必修
//離開碼: 0 無必修; 1 有必修; 2 掃描範圍壞掉(0 檔、根目錄不存在、參數錯、package.json 無法解析): 不等於沒有問題
//掃描對象: 使用 wsemi、w-* 之專案(服務、應用、工具). 根目錄 package.json 之 name 本身是自有套件者視為「套件自身倉庫」:
//  該套件即 C2(程序與瀏覽器)、D1(對外界線)、E1(預設功能)之實作者, 此三條不掃; 其餘規則照掃
//不掃: 測試檔(test/、tests/、spec/、*.test.*)、壓縮或打包檔(單列逾 1000 字元)、node_modules、dist、docs、tmp、bin-cache、
//  連結(symlink、junction)、被 .gitignore 排除者、單檔逾 3MB、非 mjs cjs js ts vue html 檔
import fs from 'fs'
import path from 'path'

const MAX_FILE = 3 * 1024 * 1024
const MAX_LINE = 1000
const MAX_SHOW = 30
const OWN = '(?:wsemi|w-[a-z0-9-]+)'
const C1_EXEMPT = ['w-demores'] //範例資源庫, 維持 jsDelivr /npm/; 其改走 gh-pages 後移除
//B1_PUBLIC: 已確認有 JSDoc 文件頁之巢狀公開路徑(已安裝版本不一定附 docs/, 故先列於此); 新增前先確認該套件 docs/ 有此檔文件頁
const B1_PUBLIC = {
    'w-component-vue': /^src\/js\/(binarySearch|buildPopper|convertColor|createDetectDirective|createTransitionState|createVnodeEmitter|domDragDrop|domMutation|domResize|domStable|domVisible|parseDetectValue)\.mjs$/,
}
const reExt = /\.(mjs|cjs|js|ts|vue|html)$/
const reSkipDir = /^(node_modules|dist|docs|tmp|bin-cache|testPending|\.git)$/
const reSkipFile = /\.min\.|\.(umd|es|cjs|iife)\.[mc]?js$|\.map$|^audit-own-pkg/
const reTest = /(^|\/)(test|tests|spec|__tests__)([-_A-Z][^/]*)?\/|\.(test|spec)\.[mc]?[jt]s$/
const reAllow = /audit-own-pkg: allow[ \t]+(?!-->|\*\/)\S/
const reAllowEmpty = /audit-own-pkg: allow[ \t]*(-->|\*\/)?[ \t]*$/m

let usage = '用法: node audit-own-pkg.mjs [--root <專案根>] [--info] [--all] [--allow-pkg <套件名,套件名>]'
let stop = (msg, code = 2) => {
    console.log(msg)
    process.exit(code)
}
//未預期之例外(無權限讀取、讀取中檔案消失等)一律離開碼 2: 離開碼 1 只留給「有必修」
process.on('uncaughtException', (e) => {
    console.log(`掃描程式發生例外, 掃描範圍有誤: ${e.message}`)
    process.exit(2)
})

//參數
let args = process.argv.slice(2)
let optVal = (name) => {
    let i = args.indexOf(name)
    if (i < 0) {
        return null
    }
    let v = args[i + 1]
    if (v === undefined || v.startsWith('--')) {
        stop(`${name} 缺參數值\n${usage}`)
    }
    return v
}
let known = ['--root', '--info', '--all', '--allow-pkg']
args.forEach((v, i) => {
    let isVal = i > 0 && ['--root', '--allow-pkg'].includes(args[i - 1])
    if (!isVal && !known.includes(v)) {
        stop(`不認得之參數 ${v}\n${usage}`)
    }
})
let root = path.resolve(optVal('--root') ?? process.cwd())
let showInfo = args.includes('--info')
let showAll = args.includes('--all')
let allowPkgs = (optVal('--allow-pkg') ?? '').split(',').map((v) => v.trim()).filter((v) => v)
if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
    stop(`根目錄不存在或不是資料夾: ${root}`)
}

//package.json: 判定模式與取依賴
let pk = null
let fpPk = path.join(root, 'package.json')
if (fs.existsSync(fpPk)) {
    try {
        let s0 = fs.readFileSync(fpPk, 'utf8')
        pk = JSON.parse(s0.charCodeAt(0) === 0xFEFF ? s0.slice(1) : s0) //去 BOM
    }
    catch (e) {
        stop(`package.json 無法解析(${e.message}), 無法核對 C3, 掃描範圍有誤`)
    }
}
let reOwnExact = new RegExp(`^${OWN}$`)
let selfName = pk && typeof pk.name === 'string' && reOwnExact.test(pk.name) ? pk.name : ''

//.gitignore(簡化版: 逐列比對, 後列勝出, 支援 ! 反向、前導 /、結尾 /、* ? **)
let compileIgnore = (text, base) => {
    let out = []
    for (let line0 of text.split(/\r?\n/)) {
        let line = line0.replace(/\s+$/, '')
        if (!line || line.startsWith('#')) {
            continue
        }
        let neg = line.startsWith('!')
        if (neg) {
            line = line.slice(1)
        }
        let dirOnly = line.endsWith('/')
        line = line.replace(/\/+$/, '')
        let anchored = line.includes('/')
        line = line.replace(/^\//, '')
        if (!line) {
            continue
        }
        let re = line.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*\*/g, '\u0000').replace(/\*/g, '[^/]*').replace(/\?/g, '[^/]').replace(/\u0000/g, '.*')
        out.push({ neg, dirOnly, re: new RegExp(anchored ? `^${re}$` : `(^|/)${re}$`), base })
    }
    return out
}
let isIgnored = (rules, rel, isDir) => {
    let res = false
    for (let r of rules) {
        let sub = r.base ? rel.slice(r.base.length + 1) : rel //規則只傳給其所在資料夾之子樹, rel 必以 base/ 開頭
        if (r.dirOnly && !isDir) {
            continue
        }
        if (r.re.test(sub)) {
            res = !r.neg
        }
    }
    return res
}

//listFiles: 遞迴列檔, 略過連結與被忽略者
let skipped = { link: 0, big: 0, long: 0, test: 0 }
let listFiles = () => {
    let out = []
    let walk = (dir, rel0, rules0) => {
        let rules = rules0
        let fpIg = path.join(dir, '.gitignore')
        if (fs.existsSync(fpIg)) {
            rules = [...rules0, ...compileIgnore(fs.readFileSync(fpIg, 'utf8'), rel0)]
        }
        for (let e of fs.readdirSync(dir, { withFileTypes: true })) {
            let rel = rel0 ? `${rel0}/${e.name}` : e.name
            if (e.isSymbolicLink()) {
                skipped.link++
                continue
            }
            if (e.isDirectory()) {
                if (!reSkipDir.test(e.name) && !isIgnored(rules, rel, true)) {
                    walk(path.join(dir, e.name), rel, rules)
                }
            }
            else if (e.isFile() && !isIgnored(rules, rel, false)) {
                out.push(rel)
            }
        }
    }
    walk(root, '', [])
    return out
}

//splitLine: 去掉行尾 // 註解; code 保留字串, bare 把字串內容清空(避免訊息文字內之 eval( 等誤報)
let splitLine = (l) => {
    let code = ''
    let bare = ''
    let q = ''
    for (let i = 0; i < l.length; i++) {
        let c = l[i]
        if (q) {
            if (c === '\\') {
                code += c + (l[i + 1] ?? '')
                i++
            }
            else {
                code += c
                if (c === q) {
                    q = ''
                    bare += c
                }
            }
            continue
        }
        if (c === '/' && l[i + 1] === '/' && l[i - 1] !== ':') {
            break
        }
        if (c === '\'' || c === '"' || c === '`') {
            q = c
        }
        code += c
        bare += c
    }
    return { code, bare }
}

//B1 判定: 文件頁(已安裝套件之 docs/)優先, 無 docs 時依慣例(src/<檔>、src/components/<檔>、dist/、test/tools/)
let docCache = new Map()
let docNames = (pkg) => {
    if (!docCache.has(pkg)) {
        let set = null
        try {
            set = new Set(fs.readdirSync(path.join(root, 'node_modules', pkg, 'docs')))
        }
        catch (e) {
            set = null
        }
        docCache.set(pkg, set)
    }
    return docCache.get(pkg)
}
let b1Verdict = (pkg, sub) => {
    if (/(^|\/)_[^/]*/.test(sub)) {
        return '底線開頭, 內部檔'
    }
    if (/^(dist\/|package\.json$|test\/tools\/)/.test(sub) || /^src\/[^/]+\.(mjs|js|vue)$/.test(sub) || /^src\/components\/[^/]+\.(vue|mjs)$/.test(sub)) {
        return '' //慣用之引用方式: 下游以 src/<單檔>、src/components/<元件>、dist/、test/tools/ 取用
    }
    if (B1_PUBLIC[pkg] && B1_PUBLIC[pkg].test(sub)) {
        return ''
    }
    let set = docNames(pkg)
    if (set) {
        let base = path.posix.basename(sub)
        let stem = base.replace(/\.(mjs|cjs|js|vue)$/, '')
        for (let fn of set) {
            if (fn === `${base}.html` || fn.endsWith(`_${base}.html`) || fn === `module-${stem}.html`) {
                return '' //巢狀路徑有文件頁者視為公開
            }
        }
        return '套件 docs/ 無此檔文件頁'
    }
    return '未安裝或無 docs/, 無法核對文件頁'
}
let reImport = new RegExp(`(?:\\bfrom\\s+|\\bimport\\s*\\(?\\s*|\\brequire\\s*\\(\\s*)['"](${OWN})(?:/([^'"]*))?['"]`, 'g')

//rules: on 為比對之視圖(bare 為字串內容清空、code 保留字串, 皆已去註解); testRaw 對原列(含註解)比對; own 為 false 時套件自身倉庫不掃; need 為全檔須符合之條件
let rules = [
    { id: 'A1', name: '動態執行字串', hard: true, on: 'bare', test: /(^|[^$\w.])(Function|eval)\s*\(|\(\s*0\s*,\s*eval\s*\)|\bvm\.compileFunction\s*\(|\b(runInContext|runInNewContext|runInThisContext)\s*\(/ },
    { id: 'A2', name: '函式序列化', on: 'bare', test: /\b(fun[A-Z]\w*|fn[A-Z]?\w*|cb[A-Z]?\w*|callback\w*|handler\w*)\.toString\(\)|\bString\(\s*(fun[A-Z]\w*|fn[A-Z]\w*)\s*\)/ },
    { id: 'A3', name: '外部請求之內容透傳至會執行之選項', on: 'code', need: /request\.(payload|query|params|body)|req\.(body|query|params)|ctx\.request/, test: /(\b(opt|data|payload|body|query|params)\.|_\.get\(\s*(opt|data|payload|body|query|params)\s*,\s*['"])(execJs\w*|scriptsHead|stylesHead|funPageWait|funGetUrl|cOpt|executablePath|fpExe\w*|path7zexe|exePath|fpScript|k6Path|inputFile|command|cmd)\b/ },
    { id: 'B1', name: '引用套件內部模組', on: 'code' },
    { id: 'C1', name: '自有套件走公開 CDN', on: 'code', test: new RegExp(`(cdn\\.jsdelivr\\.net/npm|unpkg\\.com)/(?!(?:${C1_EXEMPT.join('|')})[@/])${OWN}[@/]`) },
    { id: 'C2', name: '自寫套件已有之功能', own: false, on: 'code', test: /\bwmic(\.exe)?\b|\btaskkill(\.exe)?\b|\bchild\w*\.kill\(|\b(chromium|firefox|webkit|puppeteer)\.launch\(/ },
    { id: 'D1', name: '服務對外界線', own: false, on: 'code', testRaw: /^\s*\/\/\s*(host|address)\s*:\s*['"]/, test: /\b(host|address|hostname|bind)\s*[:=]\s*['"](0\.0\.0\.0|::)['"]|\.listen\([^)]*['"]0\.0\.0\.0['"]|\borigin\s*:\s*\[?\s*['"`]\*['"`]|\bcors\w*\s*[:=]\s*\[\s*['"`]\*['"`]|Access-Control-Allow-Origin['"]?\s*[,:]\s*['"]\*|\bcors\s*:\s*true\b/i },
]
let ruleE1 = { id: 'E1', name: '關閉套件預設功能', own: false, on: 'code', need: /['"]w-(maplibregl|leaflet)-vue/, test: /\bshow:\s*false\b/, near: /\bpanel[A-Z]\w*\s*:\s*\{[^}]*$/ }
if (showInfo) {
    rules.push(ruleE1)
}
if (selfName) {
    rules = rules.filter((r) => r.own !== false)
}

let hits = {}
rules.forEach((r) => {
    hits[r.id] = []
})
let allowed = []
let noReason = []
let refPkgs = new Set()
let nRefFiles = 0
let files = listFiles()
let n = 0
for (let rel of files) {
    let base = path.posix.basename(rel)
    if (!reExt.test(rel) || reSkipFile.test(base)) {
        continue
    }
    if (reTest.test(rel)) {
        skipped.test++
        continue
    }
    let fp = path.join(root, rel)
    let st = fs.statSync(fp)
    if (st.size > MAX_FILE) {
        skipped.big++
        continue
    }
    let s = fs.readFileSync(fp, 'utf8')
    if (s.includes('\u0000')) {
        continue
    }
    n++
    let lines = s.split(/\r?\n/)
    let views = lines.map((l) => {
        let t = l.trim()
        let isLong = l.length > MAX_LINE
        if (isLong) {
            skipped.long++
        }
        let isComment = /^(\/\/|\*|\/\*|<!--)/.test(t)
        let sp = isLong ? { code: '', bare: '' } : splitLine(l)
        return { t, isLong, isComment, code: isComment ? '' : sp.code, bare: isComment ? '' : sp.bare, raw: isLong ? '' : l }
    })
    let fileRef = false
    for (let r of rules) {
        if (r.need && !r.need.test(s)) {
            continue
        }
        views.forEach((v, i) => {
            if (v.isLong) {
                return
            }
            let item = `${rel}:${i + 1} ${v.t.slice(0, 110)}`
            let isHit = false
            let note = ''
            if (r.id === 'B1') {
                for (let m of v.code.matchAll(reImport)) {
                    fileRef = true
                    refPkgs.add(m[1])
                    let why = m[2] === undefined ? '' : b1Verdict(m[1], m[2])
                    if (why) {
                        isHit = true
                        note = ` (${why})`
                    }
                }
            }
            else {
                let text = r.on === 'bare' ? v.bare : v.code
                let m = r.test.exec(text)
                isHit = m !== null || (r.testRaw ? r.testRaw.test(v.raw) : false)
                if (m !== null && r.near) {
                    //near: 命中處之前(含前 4 列)須處於未關閉之指定物件內
                    let win = [...views.slice(Math.max(0, i - 4), i).map((x) => x.code), text.slice(0, m.index + m[0].length)].join('\n')
                    isHit = r.near.test(win)
                }
            }
            if (!isHit) {
                return
            }
            let around = `${lines[i]}\n${i > 0 ? lines[i - 1] : ''}`
            if (reAllow.test(around)) {
                allowed.push(`[${r.id}] ${item}`)
            }
            else {
                if (reAllowEmpty.test(around)) {
                    noReason.push(`[${r.id}] ${item}`)
                }
                hits[r.id].push(item + note)
            }
        })
    }
    if (fileRef) {
        nRefFiles++
    }
}

//C3 套件修補或改用副本: 不走程式列, 看依賴宣告與留存之修補檔
let c3 = []
let reNotRegistry = /^(file:|link:|portal:|git(\+|:)|github:|gitlab:|bitbucket:|https?:|npm:|\.{1,2}[\\/]|\/)/
if (pk) {
    for (let k of ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies']) {
        for (let [name, v] of Object.entries(pk[k] || {})) {
            if (reOwnExact.test(name)) {
                refPkgs.add(name)
                if (reNotRegistry.test(String(v))) {
                    c3.push({ name, text: `package.json ${k}.${name} = ${v}` })
                }
            }
        }
    }
    for (let k of ['overrides', 'resolutions']) {
        for (let [name, v] of Object.entries(pk[k] || {})) {
            if (reOwnExact.test(name) && reNotRegistry.test(typeof v === 'string' ? v : JSON.stringify(v))) {
                c3.push({ name, text: `package.json ${k}.${name} = ${typeof v === 'string' ? v : JSON.stringify(v)}` })
            }
        }
    }
    if ((pk.dependencies || {})['patch-package'] || (pk.devDependencies || {})['patch-package']) {
        c3.push({ name: '', text: 'package.json 使用 patch-package' })
    }
}
let fdPatches = path.join(root, 'patches')
if (fs.existsSync(fdPatches) && fs.statSync(fdPatches).isDirectory()) {
    for (let fn of fs.readdirSync(fdPatches)) {
        let m = fn.match(new RegExp(`^(${OWN})\\+.*\\.patch$`))
        if (m) {
            c3.push({ name: m[1], text: `patches/${fn} 套件修補檔` })
        }
    }
}
rules.push({ id: 'C3', name: '修補或改用套件副本', hard: true })
hits.C3 = []
for (let c of c3) {
    if (c.name && allowPkgs.includes(c.name)) {
        allowed.push(`[C3] ${c.text}`)
    }
    else {
        hits.C3.push(c.text)
    }
}

console.log(`掃描 ${n} 檔, 根目錄 ${root}`)
if (n === 0) {
    stop('掃描到 0 個檔案, 掃描範圍有誤')
}
console.log(`模式: ${selfName ? `套件自身倉庫(${selfName}), 不掃 C2、D1、E1` : '使用端專案'}; 引用自有套件 ${refPkgs.size} 種、${nRefFiles} 檔; 略過 測試檔 ${skipped.test}、超長列 ${skipped.long}、超大檔 ${skipped.big}、連結 ${skipped.link}`)
if (refPkgs.size === 0) {
    console.log('提示: 未見自有套件之引用或依賴, L0e 多半不適用(下列為形狀比對, 逐項看是否與自有套件有關)')
}
let nHard = 0
let nSoft = 0
for (let r of rules) {
    let list = hits[r.id]
    if (r.hard) {
        nHard += list.length
    }
    else {
        nSoft += list.length
    }
    console.log(`[${r.id} ${r.name}] ${r.hard ? '必修' : '待判讀'} ${list.length} 處`)
    let cut = !r.hard && !showAll && list.length > MAX_SHOW
    list.slice(0, cut ? MAX_SHOW : list.length).forEach((v) => console.log(`  ${v}`))
    if (cut) {
        console.log(`  …另 ${list.length - MAX_SHOW} 處未列(--all 列全部)`)
    }
}
if (allowed.length > 0) {
    console.log(`[已註明] ${allowed.length} 處`)
    allowed.forEach((v) => console.log(`  ${v}`))
}
if (noReason.length > 0) {
    console.log(`[註明缺理由] ${noReason.length} 處(allow 後須接理由, 仍計入上列)`)
    noReason.forEach((v) => console.log(`  ${v}`))
}
console.log(`合計: 必修 ${nHard}、待判讀 ${nSoft}、已註明 ${allowed.length}`)
process.exitCode = nHard > 0 ? 1 : 0
