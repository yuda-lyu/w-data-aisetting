//chkTableRunSizes: 逐表檢查 docx 內有文字之 run 之字級是否只有 1 種
//用法: node <技能根>/role-writer-report-convert-to-docx/scripts/chkTableRunSizes.mjs <檔.docx>…
//      node <技能根>/role-writer-report-convert-to-docx/scripts/chkTableRunSizes.mjs --self-test
//  <技能根>為本技能目錄之上一層(其 node_modules 內有 w-zip); 讀 docx 以 w-zip 之 mZip.readEntry 只讀 word/document.xml, 不解壓整包, 不需外部 unzip
//  逐表收集有文字之 run 之字級(w:sz, 半點; 無 w:sz 者記為「預設」, 即沿用段落樣式或文件之字級), 同一表出現 2 種以上即列出(各字級之 run 數與 1 個例字)
//  巢狀表格以最外層表為單位, 內層表之 run 一併計入; 「預設」與明訂值實際相同、表頭與內文刻意不同字級者亦會列出, 屬誤報, 開檔目視確認
//  離開碼: 有檔案讀不到或不是 docx 時為 1, 其餘為 0(字級不一者只列出, 不當作失敗)


//splitTables, 取出最外層之表(以 <w:tbl> 與 </w:tbl> 之深度計數, 巢狀表格隨外層一併收集)
function splitTables(xml) {
    let tbls = []
    let depth = 0
    let start = -1
    for (let m of xml.matchAll(/<w:tbl>|<\/w:tbl>/g)) {
        if (m[0] === '<w:tbl>') {
            if (depth === 0) {
                start = m.index
            }
            depth++
        }
        else if (depth > 0) {
            depth--
            if (depth === 0) {
                tbls.push(xml.slice(start, m.index + m[0].length))
            }
        }
    }
    return tbls
}


//sizesOfTable, 收集一張表內有文字之 run 之字級: { 字級: { n: run 數, ex: 例字 } }
function sizesOfTable(tbl) {
    let kp = {}
    for (let r of (tbl.match(/<w:r(?:\s[^>]*)?>[\s\S]*?<\/w:r>/g) || [])) {
        let text = [...r.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g)].map((m) => m[1]).join('')
        if (text.trim() === '') {
            continue
        }
        let sz = r.match(/<w:sz w:val="(\d+)"/)
        let s = sz ? `${sz[1] / 2}pt` : '預設'
        kp[s] = kp[s] || { n: 0, ex: [...text].slice(0, 16).join('') }
        kp[s].n++
    }
    return kp
}


//scanXml, 掃一份 document.xml, 回傳 { nTable, bad: [{ k: 表序(1起算), kp }] }
function scanXml(xml) {
    let tbls = splitTables(xml)
    let bad = []
    tbls.forEach((t, k) => {
        let kp = sizesOfTable(t)
        if (Object.keys(kp).length > 1) {
            bad.push({ k: k + 1, kp })
        }
    })
    return { nTable: tbls.length, bad }
}


//fmt, 一張字級不一之表之輸出列
function fmt(b) {
    return `表${b.k}: ${Object.entries(b.kp).map(([s, v]) => `${s}×${v.n}(例:${v.ex})`).join('、')}`
}


//selfTest, 以合成之 XML 驗證判定邏輯
function selfTest() {
    let run = (t, sz, attr = '') => `<w:r${attr}><w:rPr>${sz ? `<w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/>` : ''}</w:rPr><w:t>${t}</w:t></w:r>`
    let tbl = (...runs) => `<w:tbl><w:tblPr/><w:tr><w:tc><w:p>${runs.join('')}</w:p></w:tc></w:tr></w:tbl>`
    let cases = [
        ['單一字級之表不列出', `<w:body>${tbl(run('甲', 18), run('乙', 18, ' w:rsidR="00A1B2C3"'))}</w:body>`, 1, 0],
        ['文字帶 w:sz、程式碼無 w:sz 之表列出', `<w:body>${tbl(run('說明', 18), run('unit01', ''))}</w:body>`, 1, 1],
        ['只有 szCs 之 run 記為預設, 不被當成 sz', `<w:body>${tbl(run('甲', 18), '<w:r><w:rPr><w:szCs w:val="18"/></w:rPr><w:t>乙</w:t></w:r>')}</w:body>`, 1, 1],
        ['僅空白之 run 不計', `<w:body>${tbl(run('甲', 18), run('  ', ''))}</w:body>`, 1, 0],
        ['無表', '<w:body><w:p>無表</w:p></w:body>', 0, 0],
        ['巢狀表以最外層為單位且內層 run 計入', `<w:body><w:tbl><w:tr><w:tc>${run('外', 18)}${tbl(run('內', 20))}</w:tc></w:tr></w:tbl></w:body>`, 1, 1],
        ['兩張表各自判定', `<w:body>${tbl(run('甲', 18))}${tbl(run('乙', 18), run('丙', 21))}</w:body>`, 2, 1],
    ]
    let nFail = 0
    for (let [name, xml, nTable, nBad] of cases) {
        let r = scanXml(xml)
        let ok = r.nTable === nTable && r.bad.length === nBad
        if (!ok) {
            nFail++
        }
        console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}(表 ${r.nTable}, 字級不一 ${r.bad.length}; 預期 ${nTable}, ${nBad})`)
    }
    let r2 = scanXml(`<w:body>${tbl(run('說明', 21), run('code', ''))}</w:body>`)
    let line = fmt(r2.bad[0])
    let okFmt = line === '表1: 10.5pt×1(例:說明)、預設×1(例:code)'
    if (!okFmt) {
        nFail++
    }
    console.log(`${okFmt ? 'PASS' : 'FAIL'}  輸出列格式: ${line}`)
    console.log(nFail === 0 ? 'SELF-TEST ok' : `SELF-TEST failed: ${nFail}`)
    process.exitCode = nFail === 0 ? 0 : 1
}


async function main() {
    let args = process.argv.slice(2)
    if (args.includes('--self-test')) {
        selfTest()
        return
    }
    if (args.length === 0) {
        console.log('用法: node chkTableRunSizes.mjs <檔.docx>…  或  --self-test')
        process.exitCode = 1
        return
    }

    //w-zip 自本腳本所在位置向上解析至技能根之 node_modules, 不用專案內之版本
    let { default: mZip } = await import('w-zip/src/mZip.mjs')

    for (let fp of args) {
        try {
            let xml = await mZip.readEntry(fp, 'word/document.xml')
            let { nTable, bad } = scanXml(xml)
            console.log(`${fp}: 表 ${nTable} 張, 字級不一 ${bad.length} 張`)
            for (let b of bad) {
                console.log(`  ${fmt(b)}`)
            }
        }
        catch (err) {
            console.log(`${fp}: 讀取失敗: ${err instanceof Error ? err.message : err}`)
            process.exitCode = 1
        }
    }
}


main()
