//把亮點展示圖之 html 輸出為 PNG(1920x1080 畫布); 檢查破圖、資料文字出界、瀏覽器錯誤; 給 --baseline 時檢查圖源
//執行(於專案根): node render.mjs --dir <html 夾> [--out <輸出夾, 預設 <dir>/png>] [--scale 2] [--baseline test/pics/] [名稱...]
import fs from 'fs'
import path from 'path'
import { pathToFileURL } from 'url'
import { loadDeps, parseArgs, needNum, listFigs, blockNetwork } from './lib.mjs'

let { chromium } = loadDeps()
let opt = parseArgs(process.argv.slice(2), ['dir', 'out', 'scale', 'baseline'])
let dir = path.resolve(process.cwd(), opt.dir || '.')
let out = path.resolve(process.cwd(), opt.out || path.join(dir, 'png'))
let scale = needNum(opt.scale || 2, '--scale', 0.5, 4)
let names = listFigs(dir, opt._)
fs.mkdirSync(out, { recursive: true })

let browser = await chromium.launch()
let nProblem = 0
try {
    let context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: scale })
    //只放行 file/data/blob; 外部連線被中止後由 requestfailed 回報(errorText 為 net::ERR_BLOCKED_BY_CLIENT)
    await blockNetwork(context, () => {})
    for (let name of names) {
        let page = await context.newPage()
        page.on('console', (m) => {
            if (m.type() === 'error' || m.type() === 'warning') {
                nProblem++
                console.log(`[${name}] console ${m.type()}: ${m.text()}`)
            }
        })
        page.on('pageerror', (e) => {
            nProblem++
            console.log(`[${name}] pageerror: ${e.message}`)
        })
        page.on('requestfailed', (r) => {
            nProblem++
            console.log(`[${name}] requestfailed: ${r.url().slice(0, 100)} ${r.failure() ? r.failure().errorText : ''}`)
        })
        await page.goto(pathToFileURL(path.join(dir, `${name}.html`)).href, { waitUntil: 'load' })
        await page.evaluate(async () => {
            await document.fonts.ready
            await Promise.all(Array.from(document.images).map((img) => img.decode().catch(() => null)))
        })
        let problems = await page.evaluate(() => {
            let list = []
            for (let img of document.images) {
                if (!img.complete || img.naturalWidth === 0) {
                    list.push(`破圖 ${img.getAttribute('src')}`)
                }
            }
            let stage = document.querySelector('.stage')
            let box = stage.getBoundingClientRect()
            for (let el of stage.querySelectorAll('[data-t]')) {
                let r = el.getBoundingClientRect()
                if (r.left < box.left - 0.5 || r.right > box.right + 0.5 || r.top < box.top - 0.5 || r.bottom > box.bottom + 0.5) {
                    list.push(`出界 ${el.textContent.trim().slice(0, 20)}`)
                }
            }
            return list
        })
        if (opt.baseline) {
            let srcs = await page.$$eval('.stage img', (els) => els.map((e) => e.getAttribute('src')))
            for (let s of srcs) {
                if (!(s || '').includes(opt.baseline)) {
                    problems.push(`非標準圖 ${s}`)
                }
            }
        }
        let fp = path.join(out, `${name}.png`)
        await page.screenshot({ path: fp, clip: { x: 0, y: 0, width: 1920, height: 1080 } })
        nProblem += problems.length
        console.log(`${name} -> ${fp} ${problems.join('；')}`)
        await page.close()
    }
    await context.close()
}
finally {
    await browser.close()
}
console.log(`完成 ${names.length} 張, 問題 ${nProblem} 項`)
if (nProblem > 0) {
    process.exitCode = 1
}
