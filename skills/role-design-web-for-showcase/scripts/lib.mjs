//共用: 參數解析、自專案根載入依賴、列出圖檔、封鎖外部連線
//本技能之程式只讀 --dir 指定之 html 夾與其引用之圖檔; 只寫 render 之 --out 夾(及自我測試之 ./tmp/showcase-selftest); 不連網、不執行 shell
import fs from 'fs'
import path from 'path'
import { createRequire } from 'module'

//loadDeps: 依賴自專案根(執行時之工作路徑)載入, 技能本身不帶 node_modules; 缺依賴時印出原因並以離開碼 2 結束
export function loadDeps(cwd = process.cwd()) {
    let require = createRequire(path.join(cwd, 'noop.js'))
    try {
        return { chromium: require('playwright').chromium, PNG: require('pngjs').PNG }
    }
    catch (err) {
        console.error('請於專案根執行, 且專案須安裝 playwright 與 pngjs(npm i -D playwright pngjs; 另需 npx playwright install chromium)')
        console.error(err.message)
        process.exit(2)
    }
}

//die: 參數錯誤一律離開碼 2
let die = (msg) => {
    console.error(msg)
    process.exit(2)
}

//parseArgs: --key value 與位置參數; known 為允許之選項名單, 未知選項或缺值即離開(免得拼錯被靜默忽略)
export function parseArgs(argv, known) {
    let opt = { _: [] }
    for (let i = 0; i < argv.length; i++) {
        if (argv[i].startsWith('--')) {
            let k = argv[i].slice(2)
            if (!known.includes(k)) {
                die(`未知選項 --${k}(可用: ${known.map((v) => `--${v}`).join(' ')})`)
            }
            if (i + 1 >= argv.length || argv[i + 1].startsWith('--')) {
                die(`選項 --${k} 缺值`)
            }
            opt[k] = argv[i + 1]
            i++
        }
        else {
            opt._.push(argv[i])
        }
    }
    return opt
}

//needHex: 色碼須為 #RRGGBB
export function needHex(v, label) {
    if (!/^#[0-9a-fA-F]{6}$/.test(v)) {
        die(`${label} 須為 #RRGGBB 色碼: ${v}`)
    }
    return v
}

//needNum: 須為有限數字且落在範圍內
export function needNum(v, label, min, max) {
    let n = Number(v)
    if (!Number.isFinite(n) || n < min || n > max) {
        die(`${label} 須為 ${min}~${max} 之數字: ${v}`)
    }
    return n
}

//listFigs: 指定名稱, 否則為資料夾內除檢視頁以外之全部 html; 名稱不得含路徑分隔字元(避免讀寫跑出 --dir/--out), 且 html 須存在
export function listFigs(dir, names) {
    if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
        die(`--dir 不是資料夾: ${dir}`)
    }
    if (names.length > 0) {
        for (let n of names) {
            if (/[\\/\0]/.test(n) || n === '.' || n === '..') {
                die(`圖名不得含路徑: ${n}`)
            }
            if (!fs.existsSync(path.join(dir, `${n}.html`))) {
                die(`找不到 ${path.join(dir, `${n}.html`)}`)
            }
        }
        return names
    }
    return fs.readdirSync(dir)
        .filter((v) => v.endsWith('.html') && !/(^|-)index\.html$/.test(v))
        .map((v) => v.replace(/\.html$/, ''))
        .sort()
}

//blockNetwork: 只放行 file、data、blob、about, 其餘(http、https、ws 等)一律中止並回報, 確保渲染與檢核不連外
export async function blockNetwork(context, onBlock) {
    await context.route(/.*/, (route) => {
        let url = route.request().url()
        if (/^(file|data|blob|about):/i.test(url)) {
            return route.continue()
        }
        onBlock(url)
        return route.abort('blockedbyclient')
    })
}

//hexToRgb: 色碼轉 [r, g, b]
export function hexToRgb(hex) {
    return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
}

//hueOf: 色碼之色相(度)
export function hueOf(hex) {
    let [r, g, b] = hexToRgb(hex).map((v) => v / 255)
    let mx = Math.max(r, g, b)
    let d = mx - Math.min(r, g, b)
    if (d === 0) {
        return 0
    }
    let t = mx === r ? ((g - b) / d) % 6 : (mx === g ? (b - r) / d + 2 : (r - g) / d + 4)
    return (t * 60 + 360) % 360
}
