//scan-connectives: 列出「同一段內同類承接語出現 2 次以上」之候選,含換詞連用(因此…因而…故)
//  只列候選,不下判斷;候選須由人逐條判讀(對稱句之刻意重複、因果鏈可保留),不改亦寫理由
//  用法: node scan-connectives.mjs [--min 2] <md 檔或資料夾>...
//        node scan-connectives.mjs --self-test
//  掃產出之文字(md),不掃產製它的程式(字串拼接、條件分支會漏)
//  段落: 連續非空白行為一段; 標題、表格列、HTML 行、程式碼圍欄不掃; 條列項各為一段
//  不計: 反引號內文字、「」內文字(畫面原文照錄者)
//  計次: 承接語須在段首或句號、分號、逗號、冒號之後(分句首); 依類別計次,同類 >= min 即列
//  已知缺口: 只看同一段,跨段或跨節之重複要另外統計; 只認下列詞表; 繁體中文; 順序類(首先、其次、最後)為條列用語,不計
//  資料夾請限定在報告所在處(不要傳整個專案根); 不跟進符號連結與目錄連接點; 不尊重 .gitignore
import fs from 'fs'
import path from 'path'

let CLASSES = {
    因果類: ['因此', '因而', '故', '所以', '是以', '從而', '據此', '以致'],
    累加類: ['此外', '另外', '再者', '同時', '並且', '而且', '另'],
}
//單字承接語易誤中複合詞(故障、故意、另行、另一...),於其後排除
let EXCL = { 故: '障意鄉事宮人居', 另: '行一有外案' }

let RES = Object.entries(CLASSES).map(([k, ws]) => {
    return [k, ws.map((w) => [w, new RegExp(`(^|[。！？；，：])${w}${EXCL[w] ? `(?![${EXCL[w]}])` : ''}`, 'g')])]
})

//scanPara, 回傳該段之命中說明(空陣列表示不是候選)
let scanPara = (txt, min) => {
    let t = txt.replace(/`[^`]*`/g, '').replace(/「[^」]*」/g, '')
    let out = []
    for (let [k, items] of RES) {
        let cnt = {}
        let total = 0
        for (let [w, re] of items) {
            let n = (t.match(re) || []).length
            if (n) {
                cnt[w] = n
                total += n
            }
        }
        if (total >= min) {
            let same = Object.values(cnt).some((v) => v >= min)
            let ws = Object.entries(cnt).map(([w, v]) => (v > 1 ? `${w}×${v}` : w)).join('、')
            out.push(`${k}×${total}(${ws})${same ? '同詞重複' : '換詞連用'}`)
        }
    }
    return out
}

//splitParas, 回傳 [{ line, text }]
let splitParas = (src) => {
    let paras = []
    let cur = null
    let fence = false
    let flush = () => {
        if (cur) {
            paras.push(cur)
            cur = null
        }
    }
    src.split(/\r?\n/).forEach((l, i) => {
        if (/^\s*(```|~~~)/.test(l)) {
            flush()
            fence = !fence
            return
        }
        if (fence || !l.trim() || /^\s*(#|\||<)/.test(l)) {
            flush()
            return
        }
        let item = /^\s*([-*+]|\d+[.)])\s+/.exec(l)
        if (item) {
            flush()
            cur = { line: i + 1, text: l.slice(item[0].length) }
        }
        else if (cur) {
            cur.text += l.trim()
        }
        else {
            cur = { line: i + 1, text: l.trim() }
        }
    })
    flush()
    return paras
}

let scanText = (src, min = 2) => {
    let r = []
    for (let p of splitParas(src)) {
        let hits = scanPara(p.text, min)
        if (hits.length) {
            r.push({ line: p.line, hits, head: p.text.slice(0, 50) })
        }
    }
    return r
}

let selfTest = () => {
    let cases = [
        ['同詞重複', '資料先入庫，因此報表可用。內容已更新，因此不須重跑。', 1],
        ['換詞連用(因此、因而、故)', '資料先入庫，因此報表可用。內容已更新，因而不須重跑。檢查通過，故可上線。', 1],
        ['累加類同詞', '系統已上線。此外，備援已完成。此外，監控已啟用。', 1],
        ['累加類換詞', '系統已上線。此外，備援已完成。另外，監控已啟用。', 1],
        ['單次不列', '資料先入庫，因此報表可用，備援亦已完成。', 0],
        ['跨類不合計', '資料先入庫，因此報表可用。此外，備援已完成。', 0],
        ['複合詞不誤中', '設備故障，故障排除後另行通知。另一項工作隨後處理。', 0],
        ['順序用語不計', '首先備份，其次還原，最後驗證。', 0],
        ['引號內不計', '畫面顯示「因此」與「因此」兩字，另有說明。', 0],
        ['行內程式碼不計', '參數 `因此，因此` 為保留字。', 0],
        ['程式碼圍欄不掃', '```\n因此，因此，因此\n```', 0],
        ['表格不掃', '| 因此，因此 | 此外，此外 |', 0],
        ['硬換行合併成一段', '資料先入庫，因此報表可用。\n內容已更新，因此不須重跑。', 1],
        ['空行分段不累計', '資料先入庫，因此報表可用。\n\n內容已更新，因此不須重跑。', 0],
        ['條列各為一段', '- 因此，甲\n- 因此，乙', 0],
        ['--min 3 提高門檻', '甲，因此乙。丙，因此丁。', 0, 3],
    ]
    let bad = 0
    for (let [name, src, want, min] of cases) {
        let got = scanText(src, min || 2).length
        if (got !== want) {
            bad++
        }
        console.log(`${got === want ? 'PASS' : 'FAIL'} ${name}(候選段 ${got},預期 ${want})`)
    }
    console.log(bad ? `SELFTEST FAIL ${bad}` : 'SELFTEST PASS')
    process.exitCode = bad ? 1 : 0
}

let walk = (p, acc) => {
    let st = fs.lstatSync(p)
    if (st.isSymbolicLink()) {
        return acc
    }
    if (st.isDirectory()) {
        for (let d of fs.readdirSync(p)) {
            if (d !== 'node_modules' && d !== '.git') {
                walk(path.join(p, d), acc)
            }
        }
    }
    else if (p.endsWith('.md')) {
        acc.push(p)
    }
    return acc
}

let args = process.argv.slice(2)
if (args.includes('--self-test')) {
    selfTest()
}
else {
    let min = 2
    let targets = []
    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--min') {
            min = Number(args[++i])
        }
        else {
            targets.push(args[i])
        }
    }
    if (!targets.length || !(min >= 2)) {
        console.log('用法: node scan-connectives.mjs [--min 2] <md 檔或資料夾>...  或  --self-test')
        process.exit(2)
    }
    let missing = targets.filter((t) => !fs.existsSync(t))
    if (missing.length) {
        console.log(`路徑不存在: ${missing.join(', ')}`)
        process.exit(2)
    }
    let files = targets.flatMap((t) => walk(t, []))
    let n = 0
    let nPara = 0
    for (let f of files) {
        let src = fs.readFileSync(f, 'utf8')
        nPara += splitParas(src).length
        for (let r of scanText(src, min)) {
            n++
            console.log(`${f.replace(/\\/g, '/')}:${r.line} [${r.hits.join(';')}] ${r.head}…`)
        }
    }
    console.log(`\n候選 ${n} 段(${files.length} 檔,${nPara} 段);候選須逐條判讀,不是違規清單`)
}
