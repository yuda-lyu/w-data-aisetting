//檢核亮點展示圖之版面: 以實際渲染之墨跡量對齊, 另查對比、重疊與出界、圖示裁切、滿版色塊、強調色面積、同階字級與粗細、同組配色、標題位置與圖示色、標題色條、大區塊對齊、間距分層、實底內白框、同區強調色大字互搶、焦點內字級差、白底框蓋圖、放射等長等角; 只讀檔
//執行(於專案根): node check-layout.mjs --dir <html 夾> [--accent #D6124F] [--max-accent 0.1] [--skip-align 名稱,名稱] [名稱...]
//  --skip-align: 放射等非分欄版面, 略過大區塊對齊與間距分層
//  名稱不含副檔名與路徑; 渲染時只放行 file/data/blob, 外部連線一律封鎖並記為不合格
//標記: .stage 畫布; .ttl 標題; .ttl .mk 圓形圖示; .pic 裁切圖; .hd 欄內小標題; [data-peer] 同階標題; [data-sub="組別"] 同組子區塊; [data-minor] 次要文字; svg.ov use[fill] 同組裝飾色
//  [data-stack] 同一焦點上下排之文字容器(直接子元素為各行); [data-core] 放射核心(有此標記時, svg.ov 內之 use 皆視為放射箭頭)
import path from 'path'
import { pathToFileURL } from 'url'
import { loadDeps, parseArgs, needHex, needNum, listFigs, blockNetwork, hexToRgb, hueOf } from './lib.mjs'

let { chromium, PNG } = loadDeps()
let opt = parseArgs(process.argv.slice(2), ['dir', 'accent', 'max-accent', 'skip-align'])
let dir = path.resolve(process.cwd(), opt.dir || '.')
let names = listFigs(dir, opt._)
let ACCENT = needHex(opt.accent || '#D6124F', '--accent')
let MAX_ACCENT_AREA = needNum(opt['max-accent'] || 0.1, '--max-accent', 0, 1) //強調色實底佔畫布比例上限(60-30-10)
let ALIGN_SKIP = (opt['skip-align'] || '').split(',').filter((v) => v)
let SCALE = 2
//墨跡中心之容差(像素, 1920 畫布): 大字 1.5、小字 2; 含下伸部(g、p、y、括號)之文字其墨跡下緣較低, 放寬為 4
let tolOf = (size, labels) => (labels.some((s) => /[gjpqy(),]/.test(s)) ? 4 : (size >= 28 ? 1.5 : 2))
let MIN_CONTRAST = 4.5
let MIN_CONTRAST_MINOR = 3
let TOL_ALIGN = 6 //並排大矩形區塊上下緣之容差
let TITLE_MAX_X = 60
let TITLE_MAX_Y = 40
let FAN_SPAN_MIN = 40
let FAN_SPAN_MAX = 100
let FAN_STEP_MIN = 6
let FAN_FROM_ACCENT_MAX = 90
let TITLE_ICON_FROM_ACCENT_MIN = 30
let BIG_NUM_MIN = 56 //強調色大字之字級下限(經驗值: 版型之大數字 60、強調句 68、主要亮點 72; 小標題最大 30)
let STACK_RATIO_MIN = 1.2 //焦點內相鄰行之字級比下限(產線自擬; 放射核心為 176/92/52)
let COVER_RATIO_MIN = 0.3 //白底框與 .pic 之交集佔該框面積之比例下限(產線自擬)
let COVER_AREA_MAX = 0.4 //白底框面積佔畫布之上限, 免把整頁容器當成框(產線自擬)
let FAN_DIST_TOL = 6 //放射箭頭與核心中心之距離差上限(像素, 產線自擬)
let FAN_ANGLE_TOL = 4 //放射相鄰角差之最大差上限(度, 產線自擬)

//inkBox: 矩形內之墨跡範圍(與矩形內最常見色差異大者為墨跡), 回傳 1920 畫布之座標
let inkBox = (p, r) => {
    let x0 = Math.max(0, Math.floor(r.x * SCALE))
    let y0 = Math.max(0, Math.floor(r.y * SCALE))
    let x1 = Math.min(p.width, Math.ceil((r.x + r.width) * SCALE))
    let y1 = Math.min(p.height, Math.ceil((r.y + r.height) * SCALE))
    let hist = new Map()
    for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
            let i = (p.width * y + x) * 4
            let k = (p.data[i] << 16) | (p.data[i + 1] << 8) | p.data[i + 2]
            hist.set(k, (hist.get(k) || 0) + 1)
        }
    }
    let bg = [...hist.entries()].sort((a, b) => b[1] - a[1])[0]
    if (!bg) {
        return null
    }
    let [br, bgc, bb] = [(bg[0] >> 16) & 255, (bg[0] >> 8) & 255, bg[0] & 255]
    let t = null
    let b = null
    for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
            let i = (p.width * y + x) * 4
            if (Math.abs(p.data[i] - br) + Math.abs(p.data[i + 1] - bgc) + Math.abs(p.data[i + 2] - bb) > 90) {
                t = t === null ? y : Math.min(t, y)
                b = b === null ? y : Math.max(b, y)
            }
        }
    }
    if (t === null) {
        return null
    }
    return { cy: (t + b + 1) / 2 / SCALE }
}

//collect: 頁面內量測(於瀏覽器內執行, 所需常數由參數帶入)
let collect = ({ accent, coverRatio, coverAreaMax }) => {
    let solid = (c) => {
        let m = c.match(/rgba?\(([^)]+)\)/)
        if (!m) {
            return null
        }
        let v = m[1].split(',').map((s) => parseFloat(s))
        return v.length === 4 && v[3] === 0 ? null : v.slice(0, 3)
    }
    let rectOf = (r) => ({ x: r.left, y: r.top, width: r.width, height: r.height })
    let edge = (r) => ({ l: r.left, r: r.right, t: r.top, b: r.bottom })
    let leafRange = (n) => {
        let g = document.createRange()
        g.selectNodeContents(n)
        return g.getBoundingClientRect()
    }
    let all = [...document.querySelectorAll('.stage *')]
    let rows = []
    for (let el of all) {
        let cs = getComputedStyle(el)
        if (cs.display !== 'flex' || cs.alignItems !== 'center' || cs.flexDirection !== 'row') {
            continue
        }
        let items = []
        for (let n of el.childNodes) {
            if (n.nodeType === 3 && n.textContent.trim()) {
                items.push({ label: n.textContent.trim().slice(0, 14), rect: rectOf(leafRange(n)) })
            }
            else if (n.nodeType === 1 && n.getBoundingClientRect().width > 0) {
                let lb = n.textContent.trim().slice(0, 14) || `<${n.tagName.toLowerCase()}>`
                items.push({ label: lb, rect: rectOf(n.getBoundingClientRect()) })
            }
        }
        if (items.length > 0) {
            rows.push({ label: el.textContent.trim().slice(0, 18), box: rectOf(el.getBoundingClientRect()), hasBg: solid(cs.backgroundColor) !== null, size: parseFloat(cs.fontSize), items })
        }
    }
    let texts = []
    let walker = document.createTreeWalker(document.querySelector('.stage'), NodeFilter.SHOW_TEXT)
    while (walker.nextNode()) {
        let n = walker.currentNode
        let p = n.parentElement
        if (!n.textContent.trim() || p.closest('svg') || p.tagName === 'STYLE' || p.tagName === 'SCRIPT') {
            continue
        }
        let cs = getComputedStyle(p)
        let r = leafRange(n)
        if (r.width === 0) {
            continue
        }
        //底色: 取文字中心點下方由上而下第一個實色底(含祖先, 以及以絕對定位疊在其下之兄弟區塊, 骨架即如此排); 在 .pic 上者無法判定
        //中心點在視窗外或文字元素不可點擊時, 退回只看祖先
        let bg = null
        let box = null
        let onPic = false
        let under = document.elementsFromPoint(r.left + r.width / 2, r.top + r.height / 2)
        let chain = under.indexOf(p) >= 0 ? under.slice(under.indexOf(p)) : []
        if (chain.length === 0) {
            for (let a = p; a; a = a.parentElement) {
                chain.push(a)
            }
        }
        for (let a of chain) {
            if (a.tagName === 'BODY' || a.tagName === 'HTML') {
                break
            }
            if (a.classList.contains('pic')) {
                onPic = true
                break
            }
            let c = solid(getComputedStyle(a).backgroundColor)
            if (c) {
                bg = c
                if (!a.classList.contains('stage')) {
                    box = rectOf(a.getBoundingClientRect())
                }
                break
            }
        }
        texts.push({ text: n.textContent.trim().slice(0, 20), rect: rectOf(r), color: solid(cs.color), size: parseFloat(cs.fontSize), weight: parseInt(cs.fontWeight, 10) || 400, minor: p.closest('[data-minor]') !== null, bg, box, onPic })
    }
    //圖示不得未渲染或被外層裁切
    let clipped = []
    for (let ic of document.querySelectorAll('.stage i[data-ic]')) {
        if (!ic.querySelector('svg')) {
            clipped.push(`${ic.getAttribute('data-ic')}(未渲染)`)
            continue
        }
        let r = ic.getBoundingClientRect()
        for (let a = ic.parentElement; a && a.tagName !== 'BODY'; a = a.parentElement) {
            if (getComputedStyle(a).overflow === 'visible') {
                continue
            }
            let b = a.getBoundingClientRect()
            if (r.left < b.left - 0.5 || r.right > b.right + 0.5 || r.top < b.top - 0.5 || r.bottom > b.bottom + 0.5) {
                clipped.push(ic.getAttribute('data-ic'))
                break
            }
        }
    }
    //強調色實底面積; 貼齊畫布邊界之色塊或圖
    let accentArea = 0
    let bleed = []
    for (let el of all) {
        let c = solid(getComputedStyle(el).backgroundColor)
        let r = el.getBoundingClientRect()
        if (c && c.every((v, i) => Math.abs(v - accent[i]) <= 2)) {
            accentArea += r.width * r.height
        }
        if ((c || el.tagName === 'IMG') && r.width > 2 && !el.closest('.pic') && (r.left < 1 || r.top < 1 || r.right > 1919 || r.bottom > 1079)) {
            bleed.push(el.className || el.tagName)
        }
    }
    let peers = [...new Set([...document.querySelectorAll('.stage [data-peer]')].map((e) => {
        let cs = getComputedStyle(e)
        return `${cs.fontSize}/${cs.fontWeight}`
    }))]
    let fills = [...document.querySelectorAll('.stage svg.ov use[fill]')].map((e) => e.getAttribute('fill'))
    let ttl = document.querySelector('.stage .ttl')
    let ttlRect = ttl ? rectOf(ttl.getBoundingClientRect()) : null
    let mk = document.querySelector('.stage .ttl .mk')
    let mkColor = mk ? solid(getComputedStyle(mk).color) : null
    let near = (c, ref, tol) => c !== null && c.every((v, i) => Math.abs(v - ref[i]) <= tol)
    let isWhite = (c, min) => c !== null && c.every((v) => v >= min)
    let bgOf = (el) => solid(getComputedStyle(el).backgroundColor)
    let short = (el) => el.textContent.trim().replace(/\s+/g, ' ').slice(0, 12)
    //實底內白框: 近白底(R、G、B 皆 ≥ 245)、面積 ≥ 600 且含字之框, 落在強調色實底之範圍內者(後代或以絕對定位疊放其上之兄弟皆算)
    let whiteIn = new Set()
    let accEls = all.filter((el) => near(bgOf(el), accent, 2))
    for (let a of accEls) {
        let ra = a.getBoundingClientRect()
        for (let d of all) {
            if (d === a || d.contains(a) || !isWhite(bgOf(d), 245) || !d.textContent.trim()) {
                continue
            }
            let r = d.getBoundingClientRect()
            if (r.width * r.height >= 600 && r.left >= ra.left - 0.5 && r.right <= ra.right + 0.5 && r.top >= ra.top - 0.5 && r.bottom <= ra.bottom + 0.5) {
                whiteIn.add(short(d))
            }
        }
    }
    whiteIn = [...whiteIn]
    //白底框蓋圖: 底色近白(≥ 250)、含字之框(含 .pic 內之標籤), 與 .pic 之交集達該框面積之一定比例; .pic 本身、包含該 .pic 之容器與整頁容器不算
    let pics = [...document.querySelectorAll('.stage .pic')]
    let whiteCover = []
    for (let el of all) {
        if (el.classList.contains('pic') || !isWhite(bgOf(el), 250) || !el.textContent.trim()) {
            continue
        }
        let r = el.getBoundingClientRect()
        let area = r.width * r.height
        if (area === 0 || area >= 1920 * 1080 * coverAreaMax) {
            continue
        }
        for (let pc of pics) {
            if (el.contains(pc)) {
                continue
            }
            let p = pc.getBoundingClientRect()
            let w = Math.min(r.right, p.right) - Math.max(r.left, p.left)
            let h = Math.min(r.bottom, p.bottom) - Math.max(r.top, p.top)
            if (w > 0 && h > 0 && w * h >= area * coverRatio) {
                whiteCover.push(short(el))
                break
            }
        }
    }
    //焦點內字級: data-stack 之各直接子元素為一行, 取行內文字之最大字級(無字之行不計)
    let stacks = [...document.querySelectorAll('.stage [data-stack]')].map((st) => {
        let lines = [...st.children].map((ch) => {
            let mx = 0
            let w = document.createTreeWalker(ch, NodeFilter.SHOW_TEXT)
            while (w.nextNode()) {
                if (w.currentNode.textContent.trim()) {
                    mx = Math.max(mx, parseFloat(getComputedStyle(w.currentNode.parentElement).fontSize))
                }
            }
            return mx
        }).filter((v) => v > 0)
        return { label: short(st), lines }
    })
    //放射: data-core 之中心至各箭頭(svg.ov use)幾何中心之距離與方位角; 箭頭中心取其本身座標之外框中心, 經 getScreenCTM 轉為頁面座標, 不受旋轉影響
    let fan = null
    let core = document.querySelector('.stage [data-core]')
    if (core) {
        let cr = core.getBoundingClientRect()
        let cx = cr.left + cr.width / 2
        let cy = cr.top + cr.height / 2
        fan = [...document.querySelectorAll('.stage svg.ov use')].map((u) => {
            let b = u.getBBox()
            let p = new DOMPoint(b.x + b.width / 2, b.y + b.height / 2).matrixTransform(u.getScreenCTM())
            return { d: Math.hypot(p.x - cx, p.y - cy), a: ((Math.atan2(p.y - cy, p.x - cx) * 180) / Math.PI + 360) % 360 }
        })
    }
    //標題色條: .ttl 及其後代(含 ::before、::after)中, 只有左框線(≥ 3px)者, 或寬 ≤ 10、高 ≥ 24 之實色條
    let titleBar = []
    if (ttl) {
        for (let el of [ttl, ...ttl.querySelectorAll('*')]) {
            for (let pe of [null, '::before', '::after']) {
                let cs = getComputedStyle(el, pe)
                if (pe && (cs.content === 'none' || cs.content === 'normal' || cs.display === 'none')) {
                    continue
                }
                let bw = (s) => (cs[`border${s}Style`] === 'none' ? 0 : parseFloat(cs[`border${s}Width`]) || 0)
                let leftOnly = bw('Left') >= 3 && bw('Top') === 0 && bw('Right') === 0 && bw('Bottom') === 0
                let w = parseFloat(cs.width)
                let h = parseFloat(cs.height)
                let narrow = w > 0 && w <= 10 && h >= 24 && solid(cs.backgroundColor) !== null
                if (leftOnly || narrow) {
                    titleBar.push(`${el.tagName.toLowerCase()}${pe || ''}`)
                }
            }
        }
    }
    //並排之大矩形區塊: 依水平範圍分欄, 各欄之上下緣須對齊; 欄內小標題 .hd 算上緣, 即次邊界對齊
    let blocks = all.filter((el) => {
        if (el.closest('.pic') && !el.classList.contains('pic')) {
            return false
        }
        let c = solid(getComputedStyle(el).backgroundColor)
        let r = el.getBoundingClientRect()
        return (el.classList.contains('pic') || (c && c.join(',') !== '255,255,255')) && r.width >= 200 && r.height >= 150
    }).map((el) => edge(el.getBoundingClientRect()))
    let cols = []
    for (let v of blocks.sort((a, b) => a.l - b.l)) {
        let c = cols[cols.length - 1]
        if (c && v.l < c.r) {
            c.r = Math.max(c.r, v.r)
            c.t = Math.min(c.t, v.t)
            c.b = Math.max(c.b, v.b)
        }
        else {
            cols.push({ ...v })
        }
    }
    for (let m of document.querySelectorAll('.stage .hd')) {
        let r = m.getBoundingClientRect()
        for (let c of cols) {
            if (r.left < c.r && r.right > c.l) {
                c.t = Math.min(c.t, r.top)
            }
        }
    }
    //間距分層: 同組子區塊之間距須小於大區塊之間距; 水平與垂直各取最近鄰, 否則較小之一向會蓋掉較大之一向
    let groups = {}
    for (let el of document.querySelectorAll('.stage [data-sub]')) {
        groups[el.dataset.sub] = groups[el.dataset.sub] || []
        groups[el.dataset.sub].push(edge(el.getBoundingClientRect()))
    }
    let subGaps = []
    for (let list of Object.values(groups)) {
        for (let a of list) {
            let nearX = []
            let nearY = []
            for (let b of list) {
                if (b.l >= a.r && b.t < a.b && b.b > a.t) {
                    nearX.push(b.l - a.r)
                }
                if (b.t >= a.b && b.l < a.r && b.r > a.l) {
                    nearY.push(b.t - a.b)
                }
            }
            for (let near of [nearX, nearY]) {
                if (near.length > 0) {
                    subGaps.push(Math.min(...near))
                }
            }
        }
    }
    let outer = cols.map((c) => ({ l: c.l, r: c.r }))
    for (let list of Object.values(groups)) {
        let u = { l: Math.min(...list.map((v) => v.l)), r: Math.max(...list.map((v) => v.r)) }
        outer = outer.filter((c) => {
            if (c.r > u.l && c.l < u.r) {
                u.l = Math.min(u.l, c.l)
                u.r = Math.max(u.r, c.r)
                return false
            }
            return true
        })
        outer.push(u)
    }
    outer.sort((a, b) => a.l - b.l)
    let majors = outer.slice(1).map((c, i) => c.l - outer[i].r)
    return { rows, texts, clipped, peers, bleed, fills, ttlRect, mkColor, cols, subGaps, majors, accentRatio: accentArea / (1920 * 1080), whiteIn, whiteCover, stacks, fan, titleBar }
}

let lum = (c) => {
    let f = c.map((v) => {
        let s = v / 255
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
    })
    return 0.2126 * f[0] + 0.7152 * f[1] + 0.0722 * f[2]
}
let contrast = (a, b) => {
    let [x, y] = [lum(a), lum(b)].sort((p, q) => q - p)
    return (x + 0.05) / (y + 0.05)
}
let rgbToHex = (c) => `#${c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`
//hueDiff: 相對強調色之色相差(-180~180)
let hueAcc = hueOf(ACCENT)
let hueDiff = (h) => ((h - hueAcc + 540) % 360) - 180

let browser = await chromium.launch()
let bad = 0
let ng = (msg) => {
    bad++
    console.log(`NG ${msg}`)
}
try {
    let context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: SCALE })
    await blockNetwork(context, (url) => ng(`外連 已封鎖外部連線: ${url.slice(0, 80)}`))
    for (let name of names) {
        let page = await context.newPage()
        await page.goto(pathToFileURL(path.join(dir, `${name}.html`)).href, { waitUntil: 'load' })
        await page.evaluate(async () => {
            await document.fonts.ready
            await Promise.all(Array.from(document.images).map((img) => img.decode().catch(() => null)))
        })
        let d = await page.evaluate(collect, { accent: hexToRgb(ACCENT), coverRatio: COVER_RATIO_MIN, coverAreaMax: COVER_AREA_MAX })
        if (!ALIGN_SKIP.includes(name)) {
            if (d.subGaps.length > 0 && d.majors.length > 0 && Math.max(...d.subGaps) >= Math.min(...d.majors)) {
                ng(`間距分層 ${name} 子區塊間距最大 ${Math.max(...d.subGaps).toFixed(0)}, 大區塊間距最小 ${Math.min(...d.majors).toFixed(0)}`)
            }
            if (d.cols.length > 1) {
                let dt = Math.max(...d.cols.map((c) => c.t)) - Math.min(...d.cols.map((c) => c.t))
                let db = Math.max(...d.cols.map((c) => c.b)) - Math.min(...d.cols.map((c) => c.b))
                if (dt > TOL_ALIGN || db > TOL_ALIGN) {
                    ng(`區塊對齊 ${name} 各欄上緣差 ${dt.toFixed(0)}、下緣差 ${db.toFixed(0)}: ${d.cols.map((c) => `x${c.l.toFixed(0)}~${c.r.toFixed(0)} y${c.t.toFixed(0)}~${c.b.toFixed(0)}`).join('、')}`)
                }
            }
        }
        if (d.mkColor && Math.abs(hueDiff(hueOf(rgbToHex(d.mkColor)))) < TITLE_ICON_FROM_ACCENT_MIN) {
            ng(`標題圖示 ${name} 標題圖示與強調色同色系(強調色留給亮點)`)
        }
        if (d.ttlRect && (d.ttlRect.x > TITLE_MAX_X || d.ttlRect.y > TITLE_MAX_Y)) {
            ng(`標題位置 ${name} 標題不在左上角(x ${d.ttlRect.x.toFixed(0)}, y ${d.ttlRect.y.toFixed(0)})`)
        }
        if (d.fills.length > 1) {
            let hs = d.fills.map(hueOf).map(hueDiff).sort((a, b) => a - b)
            let far = Math.max(...hs.map(Math.abs))
            if (far > FAN_FROM_ACCENT_MAX) {
                ng(`同組配色 ${name} 與強調色相差 ${far.toFixed(0)} 度(應 ${FAN_FROM_ACCENT_MAX} 度內)`)
            }
            let span = hs[hs.length - 1] - hs[0]
            let minStep = Math.min(...hs.slice(1).map((v, i) => v - hs[i]))
            if (span < FAN_SPAN_MIN || span > FAN_SPAN_MAX || minStep < FAN_STEP_MIN) {
                ng(`同組配色 ${name} 色相跨度 ${span.toFixed(0)} 度、最小步 ${minStep.toFixed(0)} 度(應 ${FAN_SPAN_MIN}~${FAN_SPAN_MAX} 度、每步至少 ${FAN_STEP_MIN} 度)`)
            }
        }
        if (d.bleed.length > 0) {
            ng(`滿版 ${name} 色塊貼齊畫布邊界: ${d.bleed.join('、')}`)
        }
        if (d.peers.length > 1) {
            ng(`同階字級 ${name} 同階標題字級或粗細不一: ${d.peers.join('、')}`)
        }
        for (let v of d.titleBar) {
            ng(`標題色條 ${name} 標題以左側色條呈現: ${v}`)
        }
        for (let v of d.whiteIn) {
            ng(`實底內白框 ${name} 「${v}」`)
        }
        for (let v of d.whiteCover) {
            ng(`白底框蓋圖 ${name} 「${v}」`)
        }
        for (let st of d.stacks) {
            if (st.lines.length < 2) {
                continue
            }
            let mx = Math.max(...st.lines)
            let ratios = st.lines.slice(1).map((v, i) => Math.max(v, st.lines[i]) / Math.min(v, st.lines[i]))
            if (st.lines.filter((v) => v === mx).length > 1 || Math.min(...ratios) < STACK_RATIO_MIN) {
                ng(`焦點字級 ${name} 「${st.label}」 各行字級 ${st.lines.join('/')}(相鄰行字級比應 ≥ ${STACK_RATIO_MIN}, 最大字級只一行)`)
            }
        }
        //放射: 箭頭少於 3 支不查
        if (d.fan && d.fan.length >= 3) {
            let ds = d.fan.map((v) => v.d)
            let dd = Math.max(...ds) - Math.min(...ds)
            //相鄰角差: 含首尾繞回之一差; 開口扇形之最大缺口(大於中位數 1.5 倍)不計
            let as = d.fan.map((v) => v.a).sort((a, b) => a - b)
            let gaps = as.slice(1).map((v, i) => v - as[i]).concat(360 - as[as.length - 1] + as[0])
            let mid = [...gaps].sort((a, b) => a - b)[Math.floor(gaps.length / 2)]
            let big = Math.max(...gaps)
            if (big > mid * 1.5) {
                gaps.splice(gaps.indexOf(big), 1)
            }
            let da = Math.max(...gaps) - Math.min(...gaps)
            if (dd > FAN_DIST_TOL || da > FAN_ANGLE_TOL) {
                ng(`放射不等長等角 ${name} 距離差 ${dd.toFixed(1)} px、角度差 ${da.toFixed(1)} 度(上限 ${FAN_DIST_TOL} px、${FAN_ANGLE_TOL} 度)`)
            }
        }
        //同區強調色大字互搶: 字級 ≥ BIG_NUM_MIN 且文字色為強調色者, 依所在底塊分組; 同一行(垂直重疊過半)之字算一個(數字加量詞、前後對照), 同組 2 個以上即報
        //直接放在白色畫布上(無底塊)者不查: 整張畫布不等於「同區」, 各格無底塊之版面會誤報
        let accRgb = hexToRgb(ACCENT)
        let bigs = d.texts.filter((t) => t.box && t.size >= BIG_NUM_MIN && t.color && t.color.every((v, i) => Math.abs(v - accRgb[i]) <= 2))
        let byBox = {}
        for (let t of bigs) {
            let k = `${t.box.x},${t.box.y},${t.box.width},${t.box.height}`
            byBox[k] = byBox[k] || []
            let same = byBox[k].find((u) => Math.min(u.rect.y + u.rect.height, t.rect.y + t.rect.height) - Math.max(u.rect.y, t.rect.y) > Math.min(u.rect.height, t.rect.height) / 2)
            if (same) {
                same.text = `${same.text}${t.text}`
            }
            else {
                byBox[k].push({ ...t })
            }
        }
        for (let list of Object.values(byBox)) {
            if (list.length >= 2) {
                ng(`強調色大字互搶 ${name} ${list.map((t) => `「${t.text}」`).join('')}(次要者換中性色)`)
            }
        }
        if (d.accentRatio > MAX_ACCENT_AREA) {
            ng(`配色 ${name} 強調色實底佔畫布 ${(d.accentRatio * 100).toFixed(1)}%(上限 ${MAX_ACCENT_AREA * 100}%)`)
        }
        for (let v of d.clipped) {
            ng(`裁切 ${name} 圖示 ${v} 被外層裁切`)
        }
        let png = PNG.sync.read(await page.screenshot())
        for (let row of d.rows) {
            let inks = row.items.map((v) => ({ ...v, ink: inkBox(png, v.rect) })).filter((v) => v.ink)
            if (inks.length === 0) {
                continue
            }
            let cys = inks.map((v) => v.ink.cy)
            let spread = Math.max(...cys) - Math.min(...cys)
            let boxCy = row.box.y + row.box.height / 2
            let off = row.hasBg ? Math.max(...cys.map((v) => Math.abs(v - boxCy))) : 0
            let tol = tolOf(row.size, inks.map((v) => v.label))
            if (spread > tol || off > tol) {
                ng(`對齊 ${name} 「${row.label}」 列內差 ${spread.toFixed(1)}${row.hasBg ? ` 距底塊中心 ${off.toFixed(1)}` : ''}: ${inks.map((v) => `${v.label}=${v.ink.cy.toFixed(1)}`).join(' ')}`)
            }
        }
        for (let t of d.texts) {
            if (t.rect.x < 0 || t.rect.y < 0 || t.rect.x + t.rect.width > 1920 || t.rect.y + t.rect.height > 1080) {
                ng(`出界 ${name} 「${t.text}」 超出畫布`)
            }
            if (!t.bg || t.onPic || !t.color) {
                continue
            }
            let important = (t.weight >= 600 || t.size >= 28) && !t.minor
            let ct = contrast(t.color, t.bg)
            if ((important && ct < MIN_CONTRAST) || (t.minor && ct < MIN_CONTRAST_MINOR)) {
                ng(`對比 ${name} 「${t.text}」 ${ct.toFixed(2)} (字 ${t.size}px ${t.weight})`)
            }
            if (t.box && (t.rect.x < t.box.x - 0.5 || t.rect.x + t.rect.width > t.box.x + t.box.width + 0.5 || t.rect.y < t.box.y - 0.5 || t.rect.y + t.rect.height > t.box.y + t.box.height + 0.5)) {
                ng(`出界 ${name} 「${t.text}」 超出所在底塊`)
            }
        }
        for (let i = 0; i < d.texts.length; i++) {
            for (let j = i + 1; j < d.texts.length; j++) {
                let a = d.texts[i]
                let b = d.texts[j]
                let w = Math.min(a.rect.x + a.rect.width, b.rect.x + b.rect.width) - Math.max(a.rect.x, b.rect.x)
                //行框含上下留白, 垂直方向以字高之 7 成核算, 免把緊鄰之兩行誤判為重疊
                let aH = a.rect.height * 0.7
                let bH = b.rect.height * 0.7
                let aY = a.rect.y + (a.rect.height - aH) / 2
                let bY = b.rect.y + (b.rect.height - bH) / 2
                let h = Math.min(aY + aH, bY + bH) - Math.max(aY, bY)
                if (w > 2 && h > 2) {
                    ng(`重疊 ${name} 「${a.text}」與「${b.text}」`)
                }
            }
        }
        console.log(`-- ${name}: 列 ${d.rows.length}、文字 ${d.texts.length}、強調色實底 ${(d.accentRatio * 100).toFixed(1)}%`)
        await page.close()
    }
    await context.close()
}
finally {
    await browser.close()
}
console.log(`不合格 ${bad} 項`)
if (bad > 0) {
    process.exitCode = 1
}
