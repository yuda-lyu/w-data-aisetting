//自我測試: 以各種壞版面確認 check-layout、check-crops、render 抓得到, 好版面不誤報; 另測選色器、viewer、檢視頁; 暫存放 ./tmp/showcase-selftest, 結束即刪
//執行(於專案根): node <技能根>/scripts/selftest.mjs
import fs from 'fs'
import path from 'path'
import { spawnSync } from 'child_process'
import { fileURLToPath, pathToFileURL } from 'url'
import { loadDeps } from './lib.mjs'

let { chromium, PNG } = loadDeps()
let dirSelf = path.dirname(fileURLToPath(import.meta.url))
let dirAssets = path.resolve(dirSelf, '../assets')
//暫存只放 <工作路徑>/tmp/showcase-selftest; tmp 或該夾為連結(symlink/junction)時不執行, 免得刪除穿到他處
let dir = path.resolve(process.cwd(), 'tmp/showcase-selftest')
let dirTmp = path.dirname(dir)
let isLink = (p) => {
    try {
        return fs.lstatSync(p).isSymbolicLink()
    }
    catch (e) {
        return false
    }
}
if (isLink(dirTmp) || isLink(dir)) {
    console.error(`${dirTmp} 或 ${dir} 為連結, 不執行`)
    process.exit(2)
}
let tmpExisted = fs.existsSync(dirTmp)
console.log(`暫存夾: ${dir}`)
fs.rmSync(dir, { recursive: true, force: true })
fs.mkdirSync(dir, { recursive: true })
fs.copyFileSync(path.join(dirAssets, 'base.css'), path.join(dir, 'base.css'))
fs.copyFileSync(path.join(dirAssets, 'color-tool.js'), path.join(dir, 'color-tool.js'))

let svg = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="currentColor"/></svg>'
let title = (style = '', mk = '') => `<header class="ttl" style="left:40px;top:16px;${style}"><div class="mk" style="${mk}"><i data-ic="a">${svg}</i></div><div><h1>範例<em>主張句</em></h1><div class="kw"><span>關鍵詞</span></div></div></header>`
let colL = '<div class="panel" style="left:40px;top:112px;width:900px;height:928px"></div>'
let colR = '<div class="panel" style="left:956px;top:112px;width:924px;height:928px"></div>'
let page = (body) => `<!doctype html><html lang="zh-Hant-TW"><head><meta charset="utf-8"><link rel="stylesheet" href="base.css"></head><body><main class="stage">${body}</main></body></html>`
let arrows = (cs) => `<svg class="ov" viewBox="0 0 1920 1080"><defs><path id="ar" d="M0 -15 L60 -15 L60 15 L0 15 Z"/></defs>${cs.map((c, i) => `<use href="#ar" transform="translate(${200 + i * 100} 600)" fill="${c}"/>`).join('')}</svg>`
let good = [title(), colL, colR].join('')
//band: 深底橫帶內兩段白字置中, 第二段以 position:relative 偏移 shift 像素(模擬高亮區大字偏上)
let band = (shift) => `<div class="abs" style="left:60px;top:900px;width:800px;height:80px;background:#0F1E30;display:flex;align-items:center;justify-content:center;gap:12px;color:#fff;font-size:44px;font-weight:700"><span>左段文字</span><span style="position:relative;top:${shift}px">右段文字</span></div>`
let cases = {
    good: { html: good, want: null },
    bleed: { html: [title(), colL, colR, '<div class="panel" style="left:0;top:0;width:1920px;height:60px"></div>'].join(''), want: '滿版' },
    align: { html: [title(), colL, '<div class="panel" style="left:956px;top:24px;width:924px;height:1016px"></div>'].join(''), want: '區塊對齊' },
    gap: { html: [title(), colL, '<div class="pic" data-sub="r" style="left:956px;top:112px;width:400px;height:500px"></div><div class="pic" data-sub="r" style="left:1413px;top:112px;width:467px;height:500px"></div><div class="panel" data-sub="r" style="left:956px;top:624px;width:924px;height:416px"></div>'].join(''), want: '間距分層' },
    titlepos: { html: [title('left:1000px'), colL, colR].join(''), want: '標題位置' },
    titleicon: { html: [title('', 'color:#D6124F'), colL, colR].join(''), want: '標題圖示' },
    accentarea: { html: [title(), colL, '<div class="panel" style="left:956px;top:112px;width:924px;height:928px;background:#D6124F"></div>'].join(''), want: '配色' },
    peer: { html: [title(), colL, colR, '<div class="abs" data-peer style="left:60px;top:200px;font-size:52px">甲</div><div class="abs" data-peer style="left:60px;top:300px;font-size:34px">乙</div>'].join(''), want: '同階字級' },
    fanjump: { html: [title(), colL, colR, arrows(['#1F5F8B', '#3F86BE', '#D18B47', '#E3B27E'])].join(''), want: '同組配色' },
    //色相跨度與步距合格(45 度), 但整組離強調色過遠(約 160 度): 只有「與強調色相差」一項會報
    fanfar: { html: [title(), colL, colR, arrows(['#1CB5B5', '#1C8FB5', '#1C6AB5', '#1C44B5'])].join(''), want: '同組配色' },
    //合格之同組配色(貼近強調色、跨度約 60 度、步距 11~19 度)不應誤報
    fangood: { html: [title(), colL, colR, arrows(['#D6124F', '#DE2F2F', '#E6591F', '#EA8A1D', '#EDB41D'])].join(''), want: null },
    titlepos200: { html: [title('left:200px'), colL, colR].join(''), want: '標題位置' },
    fannear: { html: [title(), colL, colR, arrows(['#D6124F', '#D61250', '#D61251', '#D61252'])].join(''), want: '同組配色' },
    contrast: { html: [title(), colL, colR, '<div class="abs" style="left:60px;top:200px;width:400px;height:100px;background:#D6124F;color:#FFD27A;font-size:40px;font-weight:700">黃字</div>'].join(''), want: '對比' },
    //文字與深色底為兄弟節點(絕對定位疊放, 骨架即如此排): 白字不應誤報、深字應報
    sibdark: { html: [title(), colL, colR, '<div class="panel" style="left:60px;top:600px;width:600px;height:200px;background:#0F1E30"></div><div class="abs" style="left:80px;top:640px;font-size:40px;font-weight:700;color:#FFFFFF">深底白字</div>'].join(''), want: null },
    sibbad: { html: [title(), colL, colR, '<div class="panel" style="left:60px;top:600px;width:600px;height:200px;background:#0F1E30"></div><div class="abs" style="left:80px;top:640px;font-size:40px;font-weight:700;color:#2A3A55">深底深字</div>'].join(''), want: '對比' },
    overlap: { html: [title(), colL, colR, '<div class="abs" style="left:60px;top:200px;font-size:30px">重疊甲</div><div class="abs" style="left:70px;top:204px;font-size:30px">重疊乙</div>'].join(''), want: '重疊' },
    outbox: { html: [title(), colL, colR, '<div class="abs" style="left:60px;top:200px;width:40px;height:40px;background:#F3F6F9;font-size:30px;white-space:nowrap">超出底塊之文字</div>'].join(''), want: '超出所在底塊' },
    offcanvas: { html: [title(), colL, colR, '<div class="abs" style="left:1800px;top:200px;font-size:40px;white-space:nowrap">超出畫布右緣之文字</div>'].join(''), want: '超出畫布' },
    //邊界值: 偏差 12px 應報、4px 不應報(區塊對齊容差 6); 強調色 13.5% 應報、8% 不應報(上限 10%); 墨跡偏 5px 應報、不偏不應報(容差 1.5)
    align12: { html: [title(), colL, '<div class="panel" style="left:956px;top:124px;width:924px;height:916px"></div>'].join(''), want: '區塊對齊' },
    align4: { html: [title(), colL, '<div class="panel" style="left:956px;top:116px;width:924px;height:924px"></div>'].join(''), want: null },
    accent13: { html: [title(), colL, '<div class="panel" style="left:956px;top:112px;width:924px;height:928px"></div><div class="abs" style="left:980px;top:140px;width:700px;height:400px;background:#D6124F"></div>'].join(''), want: '配色' },
    accent8: { html: [title(), colL, '<div class="panel" style="left:956px;top:112px;width:924px;height:928px"></div><div class="abs" style="left:980px;top:140px;width:560px;height:300px;background:#D6124F"></div>'].join(''), want: null },
    ink5: { html: [title(), colL, colR, band(-5)].join(''), want: '對齊' },
    ink0: { html: [title(), colL, colR, band(0)].join(''), want: null },
    clip: { html: [title(), colL, colR, `<div class="abs" style="left:60px;top:200px;width:20px;height:20px;overflow:hidden"><i data-ic="b" style="font-size:40px">${svg}</i></div>`].join(''), want: '裁切' },
    norender: { html: [title(), colL, colR, '<i class="abs" data-ic="c" style="left:60px;top:200px;font-size:40px"></i>'].join(''), want: '未渲染' },
    ink: { html: [title(), colL, colR, `<div class="abs" style="left:60px;top:200px;display:flex;align-items:center;gap:12px;font-size:60px"><i data-ic="d">${svg}</i><span style="position:relative;top:14px">偏下</span></div>`].join(''), want: '對齊' },
    //選項: 同樣之壞版面, 以 --skip-align、--accent、--max-accent 調整後應不再回報
    skipalign: { html: [title(), colL, '<div class="panel" style="left:956px;top:24px;width:924px;height:1016px"></div>'].join(''), want: null, args: ['--skip-align', 'skipalign'] },
    accentopt: { html: [title(), colL, '<div class="panel" style="left:956px;top:112px;width:924px;height:928px;background:#D6124F"></div>'].join(''), want: null, args: ['--accent', '#7A3E9D'] },
    maxaccent: { html: [title(), colL, '<div class="panel" style="left:956px;top:112px;width:924px;height:928px;background:#D6124F"></div>'].join(''), want: null, args: ['--max-accent', '0.99'] },
}
let run = (name, args = []) => {
    let r = spawnSync(process.execPath, [path.join(dirSelf, 'check-layout.mjs'), '--dir', dir, ...args, name], { encoding: 'utf8', cwd: process.cwd() })
    return r.stdout
}
let bad = 0
try {
    for (let [name, c] of Object.entries(cases)) {
        fs.writeFileSync(path.join(dir, `${name}.html`), page(c.html), 'utf8')
        let outText = run(name, c.args)
        let ngs = outText.split('\n').filter((l) => l.startsWith('NG'))
        let ok = c.want === null ? ngs.length === 0 : ngs.some((l) => l.includes(c.want))
        bad += ok ? 0 : 1
        console.log(`${ok ? 'OK' : 'FAIL'} ${name}: 預期 ${c.want || '無'}; 實得 ${ngs.length === 0 ? '無' : ngs.map((l) => l.split(' ')[1]).join('、')}`)
    }
    //選色器: 截圖環境不顯示; 實際瀏覽器環境可切換與還原
    let cs = ['#DC50A2', '#DC41BF', '#D432DC', '#A923DC', '#771ED2', '#481AC7']
    fs.writeFileSync(path.join(dir, 'tool.html'), page([title(), colL, colR, arrows(cs), `<i class="abs" data-ic="e" style="left:60px;top:200px;font-size:40px;color:${cs[0]}">${svg}</i>`].join('')).replace('</body>', `<script src="color-tool.js" data-colors="${cs.join(',')}"></script></body>`), 'utf8')
    let url = pathToFileURL(path.join(dir, 'tool.html')).href
    let check = (ok, msg) => {
        bad += ok ? 0 : 1
        console.log(`${ok ? 'OK' : 'FAIL'} 選色器 ${msg}`)
    }
    let b1 = await chromium.launch()
    let p1 = await b1.newPage()
    await p1.goto(url)
    check(await p1.locator('#colorTool').count() === 0, '截圖環境不顯示')
    await b1.close()
    let b2 = await chromium.launch({ ignoreDefaultArgs: ['--enable-automation'], args: ['--disable-blink-features=AutomationControlled'] })
    let p2 = await b2.newPage()
    await p2.goto(url)
    check(await p2.locator('#colorTool').isVisible(), '實際瀏覽器顯示')
    let fills = () => p2.$$eval('svg.ov use', (es) => es.map((e) => e.getAttribute('fill')))
    let f0 = await fills()
    await p2.evaluate(() => {
        for (let [i, c] of [['cL', '#7a3e9d'], ['cR', '#e08a2e']]) {
            let e = document.getElementById(i)
            e.value = c
            e.dispatchEvent(new Event('input', { bubbles: true }))
        }
    })
    let f1 = await fills()
    check(f1[0] === '#7A3E9D' && f1[5] === '#E08A2E' && new Set(f1).size === 6, `切換兩端並內插 ${f1.join(' ')}`)
    check(await p2.evaluate(() => getComputedStyle(document.querySelector('.stage i[data-ic="e"]')).color) === 'rgb(122, 62, 157)', '圖示隨之變色')
    await p2.click('#cReset')
    check((await fills()).join() === f0.join(), '還原')
    await b2.close()

    //check-crops: 以合成之標準圖確認裁切、圖源與文字規則抓得到
    let dirPics = path.join(dir, 'test/pics')
    fs.mkdirSync(dirPics, { recursive: true })
    let mkPng = (fp, isOn, color) => {
        let p = new PNG({ width: 800, height: 600 })
        p.data.fill(255)
        for (let y = 0; y < 600; y++) {
            for (let x = 0; x < 800; x++) {
                if (isOn(x, y)) {
                    let i = (800 * y + x) * 4
                    p.data[i] = color[0]
                    p.data[i + 1] = color[1]
                    p.data[i + 2] = color[2]
                }
            }
        }
        fs.writeFileSync(fp, PNG.sync.write(p))
    }
    let inFrame = (x, y) => x >= 100 && x < 700 && y >= 100 && y < 500 && (x < 105 || x >= 695 || y < 105 || y >= 495)
    mkPng(path.join(dirPics, 'frame.png'), inFrame, [255, 34, 102])
    mkPng(path.join(dirPics, 'band.png'), (x, y) => y === 50, [230, 120, 150])
    fs.copyFileSync(path.join(dirPics, 'frame.png'), path.join(dir, 'other.png'))
    let ruleFile = path.join(dir, 'rules.mjs')
    fs.writeFileSync(ruleFile, "export default [{ name: '測試禁詞', re: /禁用字樣/ }]\n", 'utf8')
    let pic = (src, left, top) => `<div class="pic" style="left:40px;top:112px;width:300px;height:200px"><img src="${src}" alt="測試" style="width:800px;left:${left}px;top:${top}px"></div>`
    let titleOf = (t) => title().replace('範例<em>主張句</em>', t)
    let cropCases = {
        cropgood: { html: [title(), pic('test/pics/frame.png', -150, -150)].join(''), want: null },
        cropframe: { html: [title(), pic('test/pics/frame.png', -50, -50)].join(''), want: '紅框線段' },
        cropedge: { html: [title(), pic('test/pics/band.png', 0, -50)].join(''), want: '邊緣殘紅' },
        cropout: { html: [title(), pic('test/pics/frame.png', -700, -150)].join(''), want: '超出來源' },
        cropsrc: { html: [title(), pic('other.png', -150, -150)].join(''), want: '非標準圖' },
        titlecolon: { html: titleOf('某功能:敘述'), want: '標目加冒號' },
        titleyear: { html: titleOf('2030 年度成果'), want: '標期別' },
        footnote: { html: [title(), '<div class="foot abs" style="left:40px;top:1000px">說明</div>'].join(''), want: '左下角' },
        gridicon: { html: [title(), `<i class="abs" data-ic="grid-2x2" style="left:60px;top:200px">${svg}</i>`].join(''), want: '田字形' },
        gaugeicon: { html: [title(), `<i class="abs" data-ic="gauge" style="left:60px;top:200px">${svg}</i>`].join(''), want: '半圓儀表' },
        ruletext: { html: [title(), '<div class="abs" style="left:60px;top:200px">禁用字樣</div>'].join(''), want: '測試禁詞', args: ['--rules', ruleFile] },
    }
    for (let [name, c] of Object.entries(cropCases)) {
        fs.writeFileSync(path.join(dir, `${name}.html`), page(c.html), 'utf8')
        let r = spawnSync(process.execPath, [path.join(dirSelf, 'check-crops.mjs'), '--dir', dir, ...(c.args || []), name], { encoding: 'utf8', cwd: process.cwd() })
        let ngs = r.stdout.split('\n').filter((l) => l.startsWith('NG'))
        let ok = c.want === null ? ngs.length === 0 && r.status === 0 : ngs.some((l) => l.includes(c.want))
        bad += ok ? 0 : 1
        console.log(`${ok ? 'OK' : 'FAIL'} ${name}: 預期 ${c.want || '無'}; 實得 ${ngs.length === 0 ? '無' : ngs.join('｜').slice(0, 80)}`)
    }

    //render: 尺寸隨倍率, 破圖回報且離開碼非 0
    let check2 = (ok, msg) => {
        bad += ok ? 0 : 1
        console.log(`${ok ? 'OK' : 'FAIL'} ${msg}`)
    }
    let runRender = (name, scale) => spawnSync(process.execPath, [path.join(dirSelf, 'render.mjs'), '--dir', dir, '--out', path.join(dir, 'png'), '--scale', String(scale), name], { encoding: 'utf8', cwd: process.cwd() })
    let r1 = runRender('good', 2)
    let pGood = PNG.sync.read(fs.readFileSync(path.join(dir, 'png/good.png')))
    check2(r1.status === 0 && pGood.width === 3840 && pGood.height === 2160, `render 倍率 2 輸出 ${pGood.width}x${pGood.height}, 離開碼 ${r1.status}`)
    fs.writeFileSync(path.join(dir, 'broken.html'), page(`${title()}<div class="pic" style="left:40px;top:112px;width:300px;height:200px"><img src="nope.png" alt="缺檔"></div>`), 'utf8')
    let r2 = runRender('broken', 1)
    check2(r2.status === 1 && r2.stdout.includes('破圖'), `render 破圖回報, 離開碼 ${r2.status}`)

    //viewer: 視窗 1920x1080 時比例為 1(不影響截圖); 其他視窗依比例縮放, 滾輪放大, 雙擊還原
    fs.copyFileSync(path.join(dirAssets, 'viewer.js'), path.join(dir, 'viewer.js'))
    fs.writeFileSync(path.join(dir, 'view.html'), page(good).replace('</body>', '<script src="viewer.js"></script></body>'), 'utf8')
    let b3 = await chromium.launch()
    let scaleOf = (p) => p.evaluate(() => new DOMMatrix(getComputedStyle(document.querySelector('.stage')).transform).a)
    let p3 = await b3.newPage({ viewport: { width: 1920, height: 1080 } })
    await p3.goto(pathToFileURL(path.join(dir, 'view.html')).href)
    check2(await scaleOf(p3) === 1, 'viewer 1920x1080 比例為 1')
    await p3.close()
    let p4 = await b3.newPage({ viewport: { width: 960, height: 540 } })
    await p4.goto(pathToFileURL(path.join(dir, 'view.html')).href)
    let s0 = await scaleOf(p4)
    await p4.mouse.move(480, 270)
    await p4.mouse.wheel(0, -100)
    await p4.waitForFunction((v) => new DOMMatrix(getComputedStyle(document.querySelector('.stage')).transform).a > v, s0)
    let s1 = await scaleOf(p4)
    await p4.mouse.dblclick(480, 270)
    let s2 = await scaleOf(p4)
    check2(s0 === 0.5 && Math.abs(s1 - 0.6) < 0.001 && s2 === 0.5, `viewer 縮放 ${s0} -> 滾輪 ${s1.toFixed(2)} -> 雙擊 ${s2}`)
    await p4.close()

    //骨架範例須通過檢核
    let rEx = spawnSync(process.execPath, [path.join(dirSelf, 'check-layout.mjs'), '--dir', dirAssets, 'example'], { encoding: 'utf8', cwd: process.cwd() })
    let ngEx = rEx.stdout.split('\n').filter((l) => l.startsWith('NG'))
    check2(rEx.status === 0 && ngEx.length === 0, `骨架範例 check-layout 不合格 ${ngEx.length} 項 ${ngEx.join('｜').slice(0, 120)}`)

    //檢視頁: 切換鈕換圖並更新網址 hash
    let tpl = fs.readFileSync(path.join(dirAssets, 'index.html'), 'utf8')
    let replaced = tpl.replace(/var figs = \[[\s\S]*?\];/, "var figs = [['a', 'good.html', 'A'], ['b', 'view.html', 'B']];")
    check2(replaced !== tpl, '檢視頁範本之 figs 可替換')
    fs.writeFileSync(path.join(dir, 'index.html'), replaced, 'utf8')
    let p5 = await b3.newPage()
    await p5.goto(pathToFileURL(path.join(dir, 'index.html')).href)
    let srcOf = () => p5.evaluate(() => document.getElementById('view').getAttribute('src'))
    let first = await srcOf()
    await p5.click('button[data-key="b"]')
    let second = await srcOf()
    let hash = await p5.evaluate(() => location.hash)
    check2(first === 'good.html' && second === 'view.html' && hash === '#b', `檢視頁切換 ${first} -> ${second}, hash ${hash}`)
    await b3.close()

    //--allow-runs: 把 cropframe 回報之紅框線段列入允許後, 不應再回報紅框線段
    let rFrame = spawnSync(process.execPath, [path.join(dirSelf, 'check-crops.mjs'), '--dir', dir, 'cropframe'], { encoding: 'utf8', cwd: process.cwd() })
    let runs = rFrame.stdout.match(/橫y\d+@x\d+|直x\d+@y\d+/g) || []
    fs.writeFileSync(path.join(dir, 'allow.json'), JSON.stringify({ 'frame.png': runs }), 'utf8')
    let rAllow = spawnSync(process.execPath, [path.join(dirSelf, 'check-crops.mjs'), '--dir', dir, '--allow-runs', path.join(dir, 'allow.json'), 'cropframe'], { encoding: 'utf8', cwd: process.cwd() })
    check2(runs.length > 0 && rFrame.stdout.includes('紅框線段') && !rAllow.stdout.includes('紅框線段'), `--allow-runs 允許 ${runs.length} 段後不再回報紅框線段`)

    //render 之 data-t 出界與 --baseline 圖源檢查
    fs.writeFileSync(path.join(dir, 'datat.html'), page(`${title()}<div class="abs" data-t style="left:1800px;top:200px;font-size:40px;white-space:nowrap">資料文字超出畫布</div>`), 'utf8')
    let rT = runRender('datat', 1)
    check2(rT.status === 1 && rT.stdout.includes('出界'), `render data-t 出界回報, 離開碼 ${rT.status}`)
    let runRenderBase = (name) => spawnSync(process.execPath, [path.join(dirSelf, 'render.mjs'), '--dir', dir, '--out', path.join(dir, 'png'), '--scale', '1', '--baseline', 'test/pics/', name], { encoding: 'utf8', cwd: process.cwd() })
    let rB1 = runRenderBase('cropsrc')
    let rB2 = runRenderBase('cropgood')
    check2(rB1.status === 1 && rB1.stdout.includes('非標準圖') && rB2.status === 0, `render --baseline 非標準圖離開碼 ${rB1.status}、標準圖離開碼 ${rB2.status}`)

    //未指名時列檔: 只取 .html 且排除檢視頁(index.html、*-index.html)
    let dirList = path.join(dir, 'list')
    fs.mkdirSync(dirList, { recursive: true })
    fs.copyFileSync(path.join(dir, 'base.css'), path.join(dirList, 'base.css'))
    fs.writeFileSync(path.join(dirList, 'ok.html'), page(good), 'utf8')
    fs.writeFileSync(path.join(dirList, 'index.html'), '<!doctype html><title>檢視頁</title>', 'utf8')
    fs.writeFileSync(path.join(dirList, 'x-index.html'), '<!doctype html><title>檢視頁</title>', 'utf8')
    fs.writeFileSync(path.join(dirList, 'note.txt'), '不是 html', 'utf8')
    let rList = spawnSync(process.execPath, [path.join(dirSelf, 'check-layout.mjs'), '--dir', dirList], { encoding: 'utf8', cwd: process.cwd() })
    check2(rList.status === 0 && rList.stdout.includes('-- ok:') && !rList.stdout.includes('index'), `未指名列檔只檢核 ok.html, 離開碼 ${rList.status}`)

    //骨架範例須通過 check-crops(無 .pic 時裁切 0 個)
    let rEx2 = spawnSync(process.execPath, [path.join(dirSelf, 'check-crops.mjs'), '--dir', dirAssets, 'example'], { encoding: 'utf8', cwd: process.cwd() })
    check2(rEx2.status === 0 && rEx2.stdout.includes('不合格 0 項'), `骨架範例 check-crops 離開碼 ${rEx2.status}: ${rEx2.stdout.trim().split('\n').pop()}`)

    //標準圖路徑含中文與空格仍能檢核(以 file URL 轉路徑, 不自行拼接)
    let dirOdd = path.join(dirPics, '中文 夾')
    fs.mkdirSync(dirOdd, { recursive: true })
    fs.copyFileSync(path.join(dirPics, 'frame.png'), path.join(dirOdd, '框 圖.png'))
    fs.writeFileSync(path.join(dir, 'cropname.html'), page([title(), pic('test/pics/中文 夾/框 圖.png', -150, -150)].join('')), 'utf8')
    let rOdd = spawnSync(process.execPath, [path.join(dirSelf, 'check-crops.mjs'), '--dir', dir, 'cropname'], { encoding: 'utf8', cwd: process.cwd() })
    check2(rOdd.status === 0, `check-crops 圖源路徑含中文與空格 離開碼 ${rOdd.status} ${rOdd.stdout.split('\n').filter((l) => l.startsWith('NG')).join('｜').slice(0, 100)}`)

    //外部連線一律封鎖: 127.0.0.1:9 無人監聽, 未封鎖時錯誤為 ERR_CONNECTION_REFUSED, 封鎖時為 ERR_BLOCKED_BY_CLIENT
    fs.writeFileSync(path.join(dir, 'net.html'), page(`${title()}<div class="pic" style="left:40px;top:112px;width:300px;height:200px"><img src="http://127.0.0.1:9/x.png" alt="外連"></div>`), 'utf8')
    let rNet = spawnSync(process.execPath, [path.join(dirSelf, 'render.mjs'), '--dir', dir, '--out', path.join(dir, 'png'), '--scale', '1', 'net'], { encoding: 'utf8', cwd: process.cwd() })
    check2(rNet.status === 1 && rNet.stdout.includes('ERR_BLOCKED_BY_CLIENT') && !rNet.stdout.includes('ERR_CONNECTION_REFUSED'), `render 封鎖外部連線, 離開碼 ${rNet.status}`)
    let rNet2 = run('net')
    check2(rNet2.includes('NG 外連'), 'check-layout 封鎖外部連線並記為不合格')

    //參數與路徑防護: 未知選項、缺值、錯誤色碼、圖名含路徑皆離開碼 2; 圖名含 .. 不得寫到 --out 之外
    let cli = (script, args) => spawnSync(process.execPath, [path.join(dirSelf, script), ...args], { encoding: 'utf8', cwd: process.cwd() })
    let r3 = cli('check-layout.mjs', ['--dir', dir, '--acent', '#FFFFFF', 'good'])
    check2(r3.status === 2 && r3.stderr.includes('未知選項'), `未知選項離開碼 ${r3.status}`)
    let r4 = cli('check-layout.mjs', ['good', '--dir'])
    check2(r4.status === 2 && r4.stderr.includes('缺值'), `選項缺值離開碼 ${r4.status}`)
    let r5 = cli('check-layout.mjs', ['--dir', dir, '--accent', 'red', 'good'])
    check2(r5.status === 2 && r5.stderr.includes('#RRGGBB'), `錯誤色碼離開碼 ${r5.status}`)
    let r6 = cli('render.mjs', ['--dir', path.join(dir, 'test'), '--out', path.join(dir, 'png2'), '../good'])
    check2(r6.status === 2 && !fs.existsSync(path.join(dir, 'good.png')) && !fs.existsSync(path.join(dir, 'png2/../good.png')), `圖名含路徑離開碼 ${r6.status}, 未寫出 --out 之外`)

    //缺依賴: 於磁碟根目錄(無 node_modules)執行, 應印出原因並離開碼 2; 根目錄有 node_modules 而解得到依賴時略過
    let r7 = spawnSync(process.execPath, [path.join(dirSelf, 'check-layout.mjs'), '--dir', dir, 'good'], { encoding: 'utf8', cwd: path.parse(process.cwd()).root })
    let r7missing = r7.stderr.includes('請於專案根執行')
    check2((r7missing && r7.status === 2) || r7.stdout.includes('不合格'), `缺依賴報錯離開碼 ${r7.status}${r7missing ? '' : '(磁碟根目錄解得到依賴, 本項改驗可正常執行)'}`)
}
finally {
    fs.rmSync(dir, { recursive: true, force: true })
    //自己建立之空 tmp 一併移除; 原本就有之 tmp 不動
    if (!tmpExisted && fs.existsSync(dirTmp) && fs.readdirSync(dirTmp).length === 0) {
        fs.rmdirSync(dirTmp)
    }
}
console.log(bad === 0 ? 'PASS' : `FAIL ${bad}`)
process.exit(bad === 0 ? 0 : 1)
