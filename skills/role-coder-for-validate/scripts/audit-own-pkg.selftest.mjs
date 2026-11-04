//audit-own-pkg 自我測試: 以壞樣本確認每條規則抓得到, 乾淨樣本不誤報, 掃描範圍壞掉時不得回報通過; 暫存放 ./tmp/audit-own-pkg-selftest, 結束即刪
//執行(於專案根): node <技能根>/scripts/audit-own-pkg.selftest.mjs [--verbose]
//結果: 末行 PASS <通過>/<總數> 且離開碼 0 才算通過; 任一項不符印 FAIL 列並離開碼 1
import fs from 'fs'
import path from 'path'
import { spawnSync } from 'child_process'
import { fileURLToPath } from 'url'

let verbose = process.argv.includes('--verbose')
let dirSelf = path.dirname(fileURLToPath(import.meta.url))
let exe = path.join(dirSelf, 'audit-own-pkg.mjs')
let dirBase = path.resolve(process.cwd(), 'tmp', 'audit-own-pkg-selftest')
let nAll = 0
let nBad = 0
let check = (ok, msg) => {
    nAll++
    nBad += ok ? 0 : 1
    if (!ok || verbose) {
        console.log(`${ok ? 'OK  ' : 'FAIL'} ${msg}`)
    }
}
let seq = 0
//run: 在 dirBase 下建樣本專案(files 為 相對路徑 → 內容)並掃描; dirName 可指定含中文與空格之資料夾名
let run = (files, extra = [], dirName = '') => {
    let dir = path.join(dirBase, dirName || `c${seq++}`)
    fs.mkdirSync(dir, { recursive: true })
    for (let [fn, s] of Object.entries(files)) {
        fs.mkdirSync(path.dirname(path.join(dir, fn)), { recursive: true })
        fs.writeFileSync(path.join(dir, fn), s, 'utf8')
    }
    let r = spawnSync(process.execPath, [exe, '--root', dir, ...extra], { encoding: 'utf8', windowsHide: true })
    return { code: r.status, out: r.stdout, dir }
}
//count: 取某規則之處數; 該規則未列出時回 -1
let count = (out, id) => {
    let m = out.match(new RegExp(`\\[${id} [^\\]]*\\] (?:必修|待判讀) (\\d+) 處`))
    return m ? Number(m[1]) : -1
}
//t: 一個案例; want 為 規則 → 處數(-1 代表該規則不得列出); code 為預期離開碼; has/not 為輸出須含/不得含之字串
let t = (msg, files, want, code, o = {}) => {
    let r = run(files, o.extra || [], o.dirName || '')
    let bad = []
    for (let [id, n] of Object.entries(want)) {
        if (count(r.out, id) !== n) {
            bad.push(`${id} 預期 ${n} 實得 ${count(r.out, id)}`)
        }
    }
    if (code !== undefined && r.code !== code) {
        bad.push(`離開碼預期 ${code} 實得 ${r.code}`)
    }
    for (let s of o.has || []) {
        if (!r.out.includes(s)) {
            bad.push(`輸出應含「${s}」`)
        }
    }
    for (let s of o.not || []) {
        if (r.out.includes(s)) {
            bad.push(`輸出不應含「${s}」`)
        }
    }
    check(bad.length === 0, `${msg}${bad.length ? ': ' + bad.join('; ') : ''}`)
    return r
}
let pkgJson = (o) => JSON.stringify(o)

if (path.basename(dirBase) !== 'audit-own-pkg-selftest') {
    throw new Error('暫存路徑異常')
}
fs.rmSync(dirBase, { recursive: true, force: true })
try {
    //A1 動態執行字串(必修)
    t('A1 new Function', { 'a.mjs': 'let f = (new Function(`return (${s})`))()\n' }, { A1: 1 }, 1)
    t('A1 eval', { 'a.mjs': 'let v = eval(code)\n' }, { A1: 1 }, 1)
    t('A1 Function 不帶 new', { 'a.mjs': 'let g = Function("return this")()\n' }, { A1: 1 }, 1)
    t('A1 間接 eval', { 'a.mjs': 'let v = (0, eval)(code)\n' }, { A1: 1 }, 1)
    t('A1 vm.runInNewContext', { 'a.mjs': 'let v = vm.runInNewContext(code, {})\n' }, { A1: 1 }, 1)
    t('A1 vm.compileFunction', { 'a.mjs': 'let f = vm.compileFunction(code, [])\n' }, { A1: 1 }, 1)
    t('A1 解構匯入之 runInContext', { 'a.mjs': "import { runInContext } from 'vm'\nlet v = runInContext(code, ctx)\n" }, { A1: 1 }, 1)
    t('A1 必修逾 30 處仍全列(不截斷)', { 'a.mjs': Array.from({ length: 31 }, (v, i) => `let v${i} = eval(x${i})`).join('\n') + '\n' }, { A1: 31 }, 1, { not: ['未列'] })
    t('A1 含 NUL 之檔視為二進位略過', { 'a.js': 'eval(x)\u0000\n', 'ok.mjs': 'let a = 1\n' }, { A1: 0 }, 0)
    t('A1 Playwright 之 $eval、$$eval、evaluate 不算', { 'a.mjs': 'await page.$$eval(sel, f)\nawait page.$eval(sel, f)\nawait page.evaluate(f)\n' }, { A1: 0 }, 0)
    t('A1 名稱含 eval 或 Function 之識別字不算', { 'a.mjs': 'let a = retrieval(x) + medieval(y) + isFunction(z) + obj.eval(w)\n' }, { A1: 0 }, 0)
    t('A1 字串內之字樣不算(訊息文字)', { 'a.mjs': 'fail("X", `inner runs from eval(nodejs) or new Function(blob)`)\n' }, { A1: 0 }, 0)
    t('A1 註解內之字樣不算', { 'a.mjs': '//原以 new Function 還原, 已移除\nlet a = 1 // 不用 eval(x)\n/* eval(y) */\n * eval(z)\n' }, { A1: 0 }, 0)
    t('A1 new vm.Script 只編譯不執行, 不算', { 'a.mjs': 'new vm.Script(code, { filename: "x" })\n' }, { A1: 0 }, 0)
    t('A1 測試檔略過(test/、*.test.、test-xxx/、spec/)', { 'test/a.mjs': 'eval(x)\n', 'b.test.mjs': 'eval(x)\n', 'test-html/c.js': 'eval(x)\n', 'spec/d.mjs': 'eval(x)\n', 'ok.mjs': 'let a = 1\n' }, { A1: 0 }, 0, { has: ['測試檔 4'] })
    t('A1 單列逾 1000 字元(壓縮檔)略過並計數', { 'a.js': `var a=${'x'.repeat(1100)};eval(a)\n`, 'ok.mjs': 'let a = 1\n' }, { A1: 0 }, 0, { has: ['超長列 1'] })
    t('A1 字串內含跳脫引號仍視為字串', { 'a.mjs': "let s = 'it\\'s eval(x)'\n" }, { A1: 0 }, 0)
    t('A1 壓縮或打包檔(*.min.*、*.umd.js、*.es.js)略過', { 'x.min.js': 'eval(x)\n', 'y.umd.js': 'eval(x)\n', 'z.es.js': 'eval(x)\n', 'ok.mjs': 'let a = 1\n' }, { A1: 0 }, 0)
    t('A1 單檔逾 3MB 略過並計數', { 'big.mjs': 'eval(x)\n' + 'let a = 1\n'.repeat(330000), 'ok.mjs': 'let a = 1\n' }, { A1: 0 }, 0, { has: ['超大檔 1'] })
    t('A1 註明理由者計入已註明, 不計必修(同列)', { 'a.mjs': 'let v = eval(code) //audit-own-pkg: allow 沙箱內評估已固定之算式\n' }, { A1: 0 }, 0, { has: ['已註明 1'] })
    t('A1 註明理由者(前一列)', { 'a.mjs': '//audit-own-pkg: allow 測試用途\nlet v = eval(code)\n' }, { A1: 0 }, 0, { has: ['已註明 1'] })
    t('A1 註明缺理由者仍計必修並列出', { 'a.mjs': 'let v = eval(code) //audit-own-pkg: allow\n', 'b.html': '<!-- audit-own-pkg: allow -->\n<script>eval(x)</script>\n' }, { A1: 2 }, 1, { has: ['註明缺理由'] })

    //A2 函式序列化
    t('A2 函式 toString', { 'a.mjs': 'opt.funPageWait = funPageWait.toString()\n' }, { A2: 1 }, 0)
    t('A2 String(函式)', { 'a.mjs': 'opt.funPageWait = String(funPageWait)\n' }, { A2: 1 }, 0)
    t('A2 一般數值 toString 不算', { 'a.mjs': 'let s = count.toString() + id.toString()\n' }, { A2: 0 }, 0)
    t('A2 測試檔略過', { 'test/a.mjs': 'let s = fn.toString()\n', 'ok.mjs': 'let a = 1\n' }, { A2: 0 }, 0)

    //A3 外部請求之內容透傳
    t('A3 請求透傳', { 'a.mjs': `let data = request.payload\nwhOpt.execJsHead = opt.execJsHead\nlet c = _.get(data, 'cOpt')\n` }, { A3: 2 }, 0)
    t('A3 req.body 與 cmd', { 'a.mjs': 'let q = req.body\nrun(data.cmd)\n' }, { A3: 1 }, 0)
    t('A3 服務內固定之函式不算', { 'a.mjs': 'let data = request.payload\nlet funPageWait = () => true\nlet o = { funPageWait }\n' }, { A3: 0 }, 0)
    t('A3 程式內部選項不算(funEvent)', { 'a.mjs': 'let data = request.payload\nlet f = opt.funEvent\nlet g = opt.funNow\n' }, { A3: 0 }, 0)
    t('A3 非請求處理不算', { 'a.mjs': 'whOpt.execJsHead = opt.execJsHead\n' }, { A3: 0 }, 0)

    //B1 引用套件內部模組(含文件頁核對)
    t('B1 內部模組', { 'a.mjs': `import { f } from 'w-foo/src/js/inner.mjs'\n` }, { B1: 1 }, 0)
    t('B1 慣用入口不算', { 'a.mjs': `import f from 'wsemi/src/iseobj.mjs'\nimport c from 'w-foo/src/components/Foo.vue'\nimport g from 'w-foo'\nimport d from 'w-foo/dist/w-foo.umd.js'\nimport u from 'w-foo/test/tools/y.mjs'\nimport p from 'w-foo/package.json'\n` }, { B1: 0 }, 0)
    t('B1 底線開頭之內部檔', { 'a.mjs': `import t from 'wsemi/src/_trace.mjs'\n` }, { B1: 1 }, 0, { has: ['底線'] })
    t('B1 動態 import 與 require 亦計', { 'a.mjs': `let m = await import('w-foo/src/js/inner.mjs')\nlet n = require('w-foo/src/js/other.mjs')\n` }, { B1: 2 }, 0)
    t('B1 巢狀路徑有已安裝套件之文件頁者不算', { 'a.mjs': `import a from 'w-foo/src/js/inner.mjs'\nimport b from 'w-foo/src/wkf/x.mjs'\n`, 'node_modules/w-foo/docs/inner.mjs.html': '<html></html>', 'node_modules/w-foo/docs/wkf_x.mjs.html': '<html></html>' }, { B1: 0 }, 0)
    t('B1 巢狀路徑無文件頁者列出', { 'a.mjs': `import a from 'w-foo/src/js/inner.mjs'\nimport b from 'w-foo/src/js/none.mjs'\n`, 'node_modules/w-foo/docs/inner.mjs.html': '<html></html>' }, { B1: 1 }, 0, { has: ['無此檔文件頁'] })
    t('B1 元件類巢狀路徑以 module-<名>.html 文件頁核對', { 'a.mjs': `import a from 'w-foo/src/js/Foo.vue'\n`, 'node_modules/w-foo/docs/module-Foo.html': '<html></html>' }, { B1: 0 }, 0)
    t('B1 已知公開路徑不算, 未列者算', { 'a.mjs': `import a from 'w-component-vue/src/js/domResize.mjs'\nimport b from 'w-component-vue/src/js/parseSpace.mjs'\n` }, { B1: 1 }, 0)
    t('B1 node_modules 內之檔不掃', { 'a.mjs': 'let a = 1\n', 'node_modules/w-foo/src/x.mjs': `import q from 'w-bar/src/js/inner.mjs'\nlet v = eval(code)\n` }, { B1: 0, A1: 0 }, 0)

    //C1 自有套件走公開 CDN
    t('C1 jsDelivr npm', { 'a.html': '<script src="https://cdn.jsdelivr.net/npm/w-foo@1.0.0/dist/a.js"></script>\n' }, { C1: 1 }, 0)
    t('C1 unpkg', { 'a.html': '<script src="https://unpkg.com/wsemi/dist/wsemi.umd.js"></script>\n' }, { C1: 1 }, 0)
    t('C1 無引號之網址不被當成行尾註解', { 'a.html': '<script src=https://unpkg.com/w-foo@1.0.0/a.js></script>\n' }, { C1: 1 }, 0)
    t('C1 第三方、/gh/、範例資源庫 w-demores 不算', { 'a.html': '<script src="https://cdn.jsdelivr.net/npm/vue@2.7.16/dist/vue.js"></script>\n<script src="https://cdn.jsdelivr.net/gh/someone/w-foo@1.0.0/dist/a.js"></script>\n<script src="https://cdn.jsdelivr.net/npm/w-demores/res/data/dataEasy.js"></script>\n' }, { C1: 0 }, 0)

    //C2 自寫套件已有之功能
    t('C2 wmic', { 'a.mjs': 'exec(`wmic process get name`)\n' }, { C2: 1 }, 0)
    t('C2 taskkill、child.kill、chromium.launch、puppeteer.launch', { 'a.mjs': `spawn('taskkill', ['/F'])\nchild.kill()\nawait chromium.launch()\nawait puppeteer.launch()\n` }, { C2: 4 }, 0)
    t('C2 測試檔與註解提及不算', { 'test/a.mjs': 'child.kill()\n', 'b.mjs': 'let a = 1 //不依賴wmic\n' }, { C2: 0 }, 0)

    //D1 服務對外界線
    t('D1 註解掉之 host 與 CORS *', { 'a.mjs': `let s = Hapi.server({\n    //host: 'localhost',\n    routes: { cors: { origin: ['*'] } },\n})\n` }, { D1: 2 }, 0)
    t('D1 聽全部介面、cors: true、listen 第二參數', { 'a.mjs': `let s = { host: '0.0.0.0' }\nlet t = { cors: true }\nsrv.listen(8080, '0.0.0.0')\n` }, { D1: 3 }, 0)
    t('D1 corsOrigins 陣列與回應標頭', { 'a.mjs': `let corsOrigins = ['*']\nres.setHeader('Access-Control-Allow-Origin', '*')\n` }, { D1: 2 }, 0)
    t('D1 本機位址、註解內之預設值說明、資料值不算', { 'a.mjs': `let s = { host: '127.0.0.1' }\n/**\n * @param {String} [opt.host='0.0.0.0'] 預設值說明\n */\nlet v = get(p, '0.0.0.0', null)\n` }, { D1: 0 }, 0)

    //C3 修補或改用副本(必修)
    t('C3 file: 副本依賴', { 'a.mjs': 'let a = 1\n', 'package.json': pkgJson({ name: 'app', dependencies: { 'w-foo': 'file:../w-foo' } }) }, { C3: 1 }, 1)
    t('C3 git+、tgz、npm: 別名', { 'a.mjs': 'let a = 1\n', 'package.json': pkgJson({ name: 'app', dependencies: { 'w-foo': 'git+https://example.com/w-foo.git', wsemi: './wsemi.tgz', 'w-bar': 'npm:w-bar-fork@1.0.0' } }) }, { C3: 3 }, 1)
    t('C3 overrides 指向副本算、僅釘版號不算', { 'a.mjs': 'let a = 1\n', 'package.json': pkgJson({ name: 'app', overrides: { 'w-foo': 'file:../w-foo', wsemi: '^1.9.49' } }) }, { C3: 1 }, 1)
    t('C3 patch-package 與 patches/ 內之套件修補檔', { 'a.mjs': 'let a = 1\n', 'package.json': pkgJson({ name: 'app', devDependencies: { 'patch-package': '8.0.0' } }), 'patches/w-foo+1.0.0.patch': 'x', 'patches/lodash+4.0.0.patch': 'x' }, { C3: 2 }, 1)
    t('C3 登錄庫版號與第三方 file: 不算', { 'a.mjs': 'let a = 1\n', 'package.json': pkgJson({ name: 'app', dependencies: { 'w-foo': '^1.0.0', wsemi: '1.9.49', 'my-lib': 'file:../my-lib' } }) }, { C3: 0 }, 0)
    t('C3 --allow-pkg 已確認合法者計入已註明', { 'a.mjs': 'let a = 1\n', 'package.json': pkgJson({ name: 'app', dependencies: { 'w-foo': 'file:../w-foo' } }) }, { C3: 0 }, 0, { extra: ['--allow-pkg', 'w-foo'], has: ['已註明 1'] })

    //E1 關閉預設功能(--info 才列)
    let e1 = { 'a.vue': `import M from 'w-maplibregl-vue/src/components/WMaplibreglVue.vue'\nlet o = {\n    panelScale: {\n        show: false,\n    },\n    panelZoom: { show: false, position: 'x' },\n    title: { show: false },\n}\n` }
    t('E1 --info 列出 panel* 之 show:false(含多列與單列), 不計必修', e1, { E1: 2 }, 0, { extra: ['--info'] })
    t('E1 未加 --info 不列', e1, { E1: -1 }, 0)
    t('E1 非 panel* 之 show:false 不算', { 'a.vue': `import M from 'w-leaflet-vue'\nlet o = { panelX: { show: true }, legend: { show: false } }\n` }, { E1: 0 }, 0, { extra: ['--info'] })
    t('E1 未用地圖元件者不算', { 'a.vue': `import E from 'w-echarts-vue'\nlet o = { panelY: { show: false } }\n` }, { E1: 0 }, 0, { extra: ['--info'] })

    //模式與輸出
    t('套件自身倉庫: 不掃 C2、D1(實作者), 仍掃 A1', { 'a.mjs': `exec('taskkill')\nlet s = { host: '0.0.0.0' }\nlet v = eval(x)\n`, 'package.json': pkgJson({ name: 'w-foo' }) }, { C2: -1, D1: -1, A1: 1 }, 1, { has: ['套件自身倉庫(w-foo)'] })
    t('使用端專案: 掃 C2、D1', { 'a.mjs': `exec('taskkill')\nlet s = { host: '0.0.0.0' }\n`, 'package.json': pkgJson({ name: 'my-app' }) }, { C2: 1, D1: 1 }, 0, { has: ['使用端專案'] })
    t('引用自有套件之種數與檔數', { 'a.mjs': `import a from 'wsemi/src/iseobj.mjs'\nimport b from 'w-foo'\n`, 'b.mjs': `import a from 'wsemi/src/isfun.mjs'\n` }, {}, 0, { has: ['引用自有套件 2 種、2 檔'], not: ['未見自有套件'] })
    t('未引用自有套件時提示 L0e 多半不適用', { 'a.mjs': 'let a = 1\n' }, {}, 0, { has: ['未見自有套件之引用'] })
    t('待判讀逾 30 處只列前 30 並註明', { 'a.html': Array.from({ length: 31 }, (v, i) => `<script src="https://unpkg.com/w-foo${i}/a.js"></script>`).join('\n') + '\n' }, { C1: 31 }, 0, { has: ['另 1 處未列'] })
    t('--all 列全部', { 'a.html': Array.from({ length: 31 }, (v, i) => `<script src="https://unpkg.com/w-foo${i}/a.js"></script>`).join('\n') + '\n' }, { C1: 31 }, 0, { extra: ['--all'], not: ['未列'] })
    t('路徑含中文與空格', { 'a.mjs': 'let v = eval(code)\n' }, { A1: 1 }, 1, { dirName: '中文 路徑 測試', has: ['a.mjs:1'] })
    t('掃描程式自身與其自我測試之檔名不掃', { 'audit-own-pkg.mjs': 'eval(x)\n', 'audit-own-pkg.selftest.mjs': 'eval(x)\n', 'ok.mjs': 'let a = 1\n' }, { A1: 0 }, 0)

    //.gitignore 與連結
    t('.gitignore 排除之資料夾與檔不掃(含巢狀 .gitignore、反向 !)', {
        '.gitignore': '_plot/\n/out\n*.gen.mjs\n!keep.gen.mjs\n',
        '_plot/a.mjs': 'eval(x)\n',
        'out/b.mjs': 'eval(x)\n',
        'c.gen.mjs': 'eval(x)\n',
        'keep.gen.mjs': 'eval(x)\n',
        'sub/.gitignore': 'inner.mjs\n/only-here.mjs\n',
        'sub/inner.mjs': 'eval(x)\n',
        'sub/only-here.mjs': 'eval(x)\n',
        'sub/other.mjs': 'let a = 1\n',
        'inner.mjs': 'eval(x)\n',
        'only-here.mjs': 'eval(x)\n',
        'zzz-other/inner.mjs': 'eval(x)\n',
    }, { A1: 4 }, 1, { has: ['keep.gen.mjs:1', 'zzz-other/inner.mjs:1', 'only-here.mjs:1'], not: ['sub/inner.mjs', 'sub/only-here.mjs'] })
    t('dist、docs、tmp、bin-cache 不掃', { 'dist/a.js': 'eval(x)\n', 'docs/a.js': 'eval(x)\n', 'tmp/a.mjs': 'eval(x)\n', 'bin-cache/a.js': 'eval(x)\n', 'ok.mjs': 'let a = 1\n' }, { A1: 0 }, 0)
    let rj = run({ 'ok.mjs': 'let a = 1\n', 'real/bad.mjs': 'eval(x)\n' })
    let dirLink = path.join(rj.dir, 'lnk')
    fs.symlinkSync(path.join(rj.dir, 'real'), dirLink, 'junction')
    let rj2 = spawnSync(process.execPath, [exe, '--root', rj.dir], { encoding: 'utf8', windowsHide: true })
    check(count(rj2.stdout, 'A1') === 1 && rj2.stdout.includes('連結 1') && !rj2.stdout.includes('lnk/'), `連結(junction 或 symlink)不跟進: A1 預期 1(只掃 real/)實得 ${count(rj2.stdout, 'A1')}`)
    check(fs.existsSync(path.join(rj.dir, 'real', 'bad.mjs')), '掃描後連結目標之檔仍在(只讀)')
    fs.rmdirSync(dirLink) //只拆連結, 不動目標

    //掃描範圍壞掉不得回報通過(離開碼 2)與參數錯誤
    let r0 = run({ 'readme.txt': 'x' })
    check(r0.code === 2 && r0.out.includes('掃描到 0 個檔案'), `掃描到 0 個檔案: 離開碼 2, 不得回報通過(實得 ${r0.code})`)
    let rEmpty = run({})
    check(rEmpty.code === 2 && rEmpty.out.includes('掃描到 0 個檔案'), `完全空的資料夾: 離開碼 2(實得 ${rEmpty.code})`)
    let spawnAudit = (args) => spawnSync(process.execPath, [exe, ...args], { encoding: 'utf8', windowsHide: true })
    let rNo = spawnAudit(['--root', path.join(dirBase, 'no-such-dir')])
    check(rNo.status === 2 && rNo.stdout.includes('不存在'), `根目錄不存在: 離開碼 2(實得 ${rNo.status})`)
    let rMiss = spawnAudit(['--root'])
    check(rMiss.status === 2 && rMiss.stdout.includes('缺參數值'), `--root 缺參數值: 離開碼 2 並提示(實得 ${rMiss.status})`)
    let rMiss2 = spawnAudit(['--root', '--info'])
    check(rMiss2.status === 2 && rMiss2.stdout.includes('缺參數值'), `--root 後接另一旗標視為缺值: 離開碼 2 並提示(實得 ${rMiss2.status})`)
    let rUnk = spawnAudit(['--bogus'])
    check(rUnk.status === 2 && rUnk.stdout.includes('不認得'), `不認得之參數: 離開碼 2(實得 ${rUnk.status})`)
    let rBadPk = run({ 'a.mjs': 'let a = 1\n', 'package.json': '{ "name": ' })
    check(rBadPk.code === 2 && rBadPk.out.includes('package.json 無法解析'), `package.json 無法解析: 離開碼 2(實得 ${rBadPk.code})`)
    let rExc = run({ 'a.mjs': 'let a = 1\n', '.gitignore/x.txt': 'x' }) //.gitignore 為資料夾: 讀取時拋例外
    check(rExc.code === 2 && rExc.out.includes('掃描程式發生例外'), `未預期之例外: 離開碼 2 而非 1(實得 ${rExc.code})`)
    let rBom = run({ 'a.mjs': 'let a = 1\n', 'package.json': String.fromCharCode(0xFEFF) + pkgJson({ name: 'app', dependencies: { 'w-foo': 'file:../x' } }) })
    check(rBom.code === 1 && count(rBom.out, 'C3') === 1, `package.json 帶 BOM 仍可解析(實得離開碼 ${rBom.code})`)

    //歷史形狀: 把 HTML 轉圖搬成 HTTP 服務時的連鎖(函式轉字串、請求內容還原執行、透傳選項、CORS *、註解掉本機限制、自寫程序查詢)
    t('歷史形狀: 呼叫端函式轉字串、服務端還原執行、透傳、CORS *、註解掉 host、wmic', {
        'client.mjs': `import WHtml2png from 'w-html2png'\nlet funPageWait = () => true\nlet body = { funPageWait: funPageWait.toString(), execJsHead: [] }\n`,
        'srv.mjs': `import Hapi from '@hapi/hapi'\nimport WHtml2png from 'w-html2png'\nlet server = Hapi.server({\n    port: 8080,\n    //host: 'localhost',\n    routes: { cors: { origin: ['*'] } },\n})\nserver.route({ method: 'POST', path: '/plot', handler: async (request) => {\n    let data = request.payload\n    let whOpt = {}\n    whOpt.execJsHead = data.execJsHead\n    whOpt.funPageWait = (new Function(\`return (\${data.funPageWait})\`))()\n    exec('wmic process get name')\n    return await WHtml2png(800, 600, 1, data.html, whOpt)\n} })\n`,
        'package.json': pkgJson({ name: 'plot-svc', dependencies: { 'w-html2png': '^1.0.0' } }),
    }, { A1: 1, A2: 1, A3: 2, C2: 1, D1: 2 }, 1, { has: ['引用自有套件 1 種'] })
}
finally {
    fs.rmSync(dirBase, { recursive: true, force: true })
}
console.log(`${nBad === 0 ? 'PASS' : 'FAIL'} ${nAll - nBad}/${nAll}`)
process.exit(nBad === 0 ? 0 : 1)
