//檢核亮點展示圖之圖源、裁切與圖內文字: 可見範圍內不得有紅框線段, 裁切四邊不得殘留紅框邊緣, 不得超出來源圖, 來源須為標準圖; 圖內文字不得有版面禁用項; 只讀檔
//執行(於專案根): node check-crops.mjs --dir <html 夾> [--baseline test/pics/] [--rules <規則檔.mjs>] [--allow-runs <json 檔>] [名稱...]
//  --baseline: img 之 src 須含此字串(預設 test/pics/); 給空字串時不檢查來源
//  --rules: 專案之用字規則, 預設匯出陣列; 每條為 { name, re }(逐行套用於圖內文字)或 { name, when, need }(整張圖文字符合 when 而不符合 need 即不合格); 格式不符離開碼 2(以 import 載入該檔, 即會執行其程式, 只用專案自己之規則檔)
//標題: .stage .ttl h1 與 [data-title](無標題列版型之主張文字)皆套標題規則; 圖內全文([data-axis] 逐年座標軸除外)不得出現「N 年度」「N 年期」
//  --allow-runs: 畫面內容與紅框同色而誤判者, 格式 { "圖檔名": ["橫y569@x1476"] }, 須裁切放大目視確認後才列
import fs from 'fs'
import path from 'path'
import { pathToFileURL, fileURLToPath } from 'url'
import { loadDeps, parseArgs, listFigs, blockNetwork } from './lib.mjs'

let { chromium, PNG } = loadDeps()
let opt = parseArgs(process.argv.slice(2), ['dir', 'baseline', 'rules', 'allow-runs'])
let dir = path.resolve(process.cwd(), opt.dir || '.')
let names = listFigs(dir, opt._)
let baseline = opt.baseline === undefined ? 'test/pics/' : opt.baseline
let allowRuns = opt['allow-runs'] ? JSON.parse(fs.readFileSync(path.resolve(process.cwd(), opt['allow-runs']), 'utf8')) : {}
let lintRules = opt.rules ? (await import(pathToFileURL(path.resolve(process.cwd(), opt.rules)).href)).default : []
let isRe = (v) => v instanceof RegExp
if (!Array.isArray(lintRules) || lintRules.some((r) => !r || typeof r.name !== 'string' || !(isRe(r.re) || (isRe(r.when) && isRe(r.need))))) {
    console.error('--rules 規則格式不符: 須預設匯出陣列, 每條為 { name, re } 或 { name, when, need }(re、when、need 皆為正則)')
    process.exit(2)
}
//全圖年度: 本期年度不標於圖內任何位置; 「期」單字不入(「第 2 期工程」等有正當用法), 「年期間」不算, 專案另有寫法由 --rules 補
let yearRule = /\d+\s*(年度|年期(?!間))/
//圖專屬之規則: 全頁文字或標題
let pageRules = [
    { name: '左下角說明文字', sel: '.foot' },
    { name: '田字形圖示(會被讀成田字)', sel: '[data-ic="grid-2x2"]' },
    { name: '半圓儀表圖示(下方開口, 會被讀成被裁切)', sel: '[data-ic="gauge"]' },
]
let titleRules = [
    { name: '標題用標目加冒號', re: /[:：]/ },
    { name: '標題標期別', re: /\d+\s*(年度|年期|期)/ },
]
let cache = {}
let readPng = (fp) => {
    if (!cache[fp]) {
        cache[fp] = PNG.sync.read(fs.readFileSync(fp))
    }
    return cache[fp]
}
//isFrame: 紅框色(e2e 標準圖之外框); isEdgeRed: 含反鋸齒之紅框邊緣(只用於裁切四邊, 畫面內容之色塊不會整條貼邊)
let isFrame = (p, x, y) => {
    let i = (p.width * y + x) * 4
    return p.data[i] > 215 && p.data[i + 1] < 70 && p.data[i + 2] > 70 && p.data[i + 2] < 130
}
let isEdgeRed = (p, x, y) => {
    let i = (p.width * y + x) * 4
    return p.data[i] > 170 && p.data[i + 1] < 150 && p.data[i + 2] > 60 && p.data[i + 2] < 180 && p.data[i] - p.data[i + 1] > 60
}
let edgeRatios = (p, x0, y0, x1, y1) => {
    let ratio = (pts) => pts.filter(([x, y]) => isEdgeRed(p, x, y)).length / pts.length
    let row = (y) => Array.from({ length: x1 - x0 }, (_, k) => [x0 + k, y])
    let col = (x) => Array.from({ length: y1 - y0 }, (_, k) => [x, y0 + k])
    return { 上: ratio(row(y0)), 下: ratio(row(y1 - 1)), 左: ratio(col(x0)), 右: ratio(col(x1 - 1)) }
}
//findRuns: 區域內長度達 30 像素之紅框線段
let findRuns = (p, x0, y0, x1, y1) => {
    let at = []
    for (let y = y0; y < y1; y++) {
        let run = 0
        for (let x = x0; x < x1; x++) {
            run = isFrame(p, x, y) ? run + 1 : 0
            if (run === 30) {
                at.push(`橫y${y}@x${x - 29}`)
            }
        }
    }
    for (let x = x0; x < x1; x++) {
        let run = 0
        for (let y = y0; y < y1; y++) {
            run = isFrame(p, x, y) ? run + 1 : 0
            if (run === 30) {
                at.push(`直x${x}@y${y - 29}`)
            }
        }
    }
    return at
}

let browser = await chromium.launch()
let bad = 0
let total = 0
let ng = (msg) => {
    bad++
    console.log(`NG  ${msg}`)
}
try {
    let context = await browser.newContext({ viewport: { width: 1920, height: 1080 } })
    await blockNetwork(context, (url) => ng(`外連 已封鎖外部連線: ${url.slice(0, 80)}`))
    for (let name of names) {
        let page = await context.newPage()
        await page.goto(pathToFileURL(path.join(dir, `${name}.html`)).href, { waitUntil: 'load' })
        await page.evaluate(async () => {
            await Promise.all(Array.from(document.images).map((img) => img.decode().catch(() => null)))
        })
        for (let t of pageRules) {
            if (await page.evaluate((sel) => document.querySelectorAll(sel).length > 0, t.sel)) {
                ng(`${name} 圖內: ${t.name}`)
            }
        }
        let title = await page.evaluate(() => [...document.querySelectorAll('.stage .ttl h1, .stage [data-title]')].map((e) => e.innerText).join('\n'))
        for (let t of titleRules) {
            if (t.re.test(title)) {
                ng(`${name} ${t.name}: ${title.replace(/\n/g, ' ')}`)
            }
        }
        let figText = await page.evaluate(() => document.querySelector('.stage').innerText)
        for (let line of figText.split('\n')) {
            for (let r of lintRules.filter((v) => v.re)) {
                if (r.re.test(line)) {
                    ng(`${name} 圖內文字 ${r.name}: ${line.slice(0, 40)}`)
                }
            }
        }
        for (let r of lintRules.filter((v) => !v.re)) {
            if (r.when.test(figText) && !r.need.test(figText)) {
                ng(`${name} 圖內文字 ${r.name}`)
            }
        }
        //全圖年度: 暫時隱藏 data-axis 後取文字, 取完即還原(後續之量測不受影響)
        let textNoAxis = await page.evaluate(() => {
            let s = document.querySelector('.stage')
            let axes = [...s.querySelectorAll('[data-axis]')]
            let saved = axes.map((e) => e.style.display)
            axes.forEach((e) => {
                e.style.display = 'none'
            })
            let t = s.innerText
            axes.forEach((e, i) => {
                e.style.display = saved[i]
            })
            return t
        })
        for (let line of textNoAxis.split('\n')) {
            if (yearRule.test(line)) {
                ng(`${name} 圖內標年度: ${line.slice(0, 40)}`)
            }
        }
        let items = await page.evaluate(() => Array.from(document.querySelectorAll('.stage .pic img')).map((img) => {
            let a = img.getBoundingClientRect()
            let b = img.parentElement.getBoundingClientRect()
            return { src: img.getAttribute('src'), url: img.currentSrc || img.src, alt: img.getAttribute('alt'), nw: img.naturalWidth, nh: img.naturalHeight, a: [a.left, a.top, a.width, a.height], b: [b.left, b.top, b.width, b.height] }
        }))
        for (let v of items) {
            total++
            //圖檔路徑自瀏覽器解析後之 file URL 轉出(含中文、空格與 %20), 不自行拼接 src
            let fp = null
            try {
                let u = new URL(v.url)
                fp = u.protocol === 'file:' ? fileURLToPath(u) : null
            }
            catch (e) {}
            if (!fp || v.nw === 0 || !fs.existsSync(fp)) {
                ng(`${name} ${v.alt} 圖源無法檢核(${!fp ? '非本機檔案' : (v.nw === 0 ? '破圖' : '檔案不存在')}): ${String(v.src).slice(0, 60)}`)
                continue
            }
            let s = v.a[2] / v.nw
            let x0 = (v.b[0] - v.a[0]) / s
            let y0 = (v.b[1] - v.a[1]) / s
            let x1 = x0 + v.b[2] / s
            let y1 = y0 + v.b[3] / s
            let p
            try {
                p = readPng(fp)
            }
            catch (e) {
                ng(`${name} ${v.alt} 圖源不是可讀之 PNG(標準圖須為 PNG): ${String(v.src).slice(0, 60)}`)
                continue
            }
            let out = x0 < 0 || y0 < 0 || x1 > v.nw + 0.5 || y1 > v.nh + 0.5
            let box = [Math.max(0, Math.floor(x0)), Math.max(0, Math.floor(y0)), Math.min(v.nw, Math.ceil(x1)), Math.min(v.nh, Math.ceil(y1))]
            let okAt = allowRuns[path.basename(v.src)] || []
            let at = findRuns(p, ...box).filter((k) => !okAt.includes(k))
            let edgeBad = Object.entries(edgeRatios(p, ...box)).filter(([, r]) => r > 0.5).map(([k, r]) => `${k}${r.toFixed(2)}`)
            let std = !baseline || v.src.includes(baseline)
            if (out || at.length > 0 || edgeBad.length > 0 || !std) {
                ng(`${name} ${v.alt} src=(${x0.toFixed(1)},${y0.toFixed(1)})~(${x1.toFixed(1)},${y1.toFixed(1)}) ${at.length > 0 ? `紅框線段 ${at.join(' ')} ` : ''}${edgeBad.length > 0 ? `邊緣殘紅 ${edgeBad.join(',')} ` : ''}${out ? '超出來源 ' : ''}${std ? '' : '非標準圖'}`)
            }
        }
        await page.close()
    }
    await context.close()
}
finally {
    await browser.close()
}
console.log(`共 ${total} 個裁切, 不合格 ${bad} 項`)
if (bad > 0) {
    process.exitCode = 1
}
