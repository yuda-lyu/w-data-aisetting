# 範本衛生：盤查、清理與改後檢查

本檔為 SKILL 第 4 節之作法。改範本用 skill[role-operator-docx] 之 officecli（呼叫方式、旗標與 help 優先之規則依該技能）；下列腳本只讀檔、不改檔，以 `unzip` 讀部件（Git Bash 內建 `unzip`；無者改用專案既有之 zip 套件）。暫存與備份依全域之暫存檔規則。

**逐一讀部件時檔名須改寫**：`unzip` 把檔名參數當萬用字元樣式，`[Content_Types].xml` 之 `[Content_Types]` 被當成字元集合，`unzip -p <檔.docx> "[Content_Types].xml"` 會失敗（`caution: filename not matched`）。把檔名中之 `[` 改寫為 `[[]`（`p.replace(/\[/g, '[[]')`）則不論自 Node（`execFileSync`，不經 shell）或自 Git Bash 命令列呼叫都讀得到，下列需列舉全部部件之腳本已內含；反斜線跳脫只在 Git Bash 命令列有效，自 Node 呼叫無效，故不採用。只讀固定部件（styles.xml、document.xml、settings.xml）者不受影響。

## 1. 備份

改範本前先複製一份原檔到暫存區，並以原範本轉一份代表性之 md（含目錄、圖、表）留作比對基準（第 4 節）。

## 2. 盤查：範本有哪些樣式、產出實際用了哪些、有沒有業主字樣

**列出樣式**（styleId、名稱、類型、是否自訂、是否於樣式庫顯示、basedOn）：

```js
//listStyles: node listStyles.mjs <檔.docx>
import { execFileSync } from 'child_process'
let xml = execFileSync('unzip', ['-p', process.argv[2], 'word/styles.xml'], { maxBuffer: 64 * 1024 * 1024 }).toString('utf8')
let rows = []
for (let m of xml.matchAll(/<w:style\b([^>]*)>([\s\S]*?)<\/w:style>/g)) {
    let [a, b] = [m[1], m[2]]
    rows.push([
        (a.match(/w:styleId="([^"]*)"/) || [])[1],
        (b.match(/<w:name w:val="([^"]*)"/) || [])[1],
        (a.match(/w:type="([^"]*)"/) || [])[1],
        /w:customStyle="1"/.test(a) ? 'custom' : '',
        /<w:qFormat\/>/.test(b) ? 'qFormat' : '',
        /<w:semiHidden\/>/.test(b) ? 'semiHidden' : '',
        (b.match(/<w:basedOn w:val="([^"]*)"/) || [])[1] || '',
    ].join('\t'))
}
console.log(`樣式共 ${rows.length} 個\n${rows.join('\n')}`)
```

**統計實際被引用之樣式**（對範本與一份以上之產出 docx 跑；含編號定義與頁首頁尾；Word 另存會重編 styleId，故依各檔自身之 styles.xml 還原為名稱）：

```js
//usedStyles: node usedStyles.mjs <檔.docx...>
import { execFileSync } from 'child_process'
let rd = (fp, p) => execFileSync('unzip', ['-p', fp, p.replace(/\[/g, '[[]')], { maxBuffer: 256 * 1024 * 1024 }).toString('utf8')
let kp = {}
for (let fp of process.argv.slice(2)) {
    let file = fp.replace(/^.*[\\/]/, '')
    let names = {}
    for (let m of rd(fp, 'word/styles.xml').matchAll(/<w:style\b([^>]*)>([\s\S]*?)<\/w:style>/g)) {
        let id = (m[1].match(/w:styleId="([^"]*)"/) || [])[1]
        names[id] = { name: (m[2].match(/<w:name w:val="([^"]*)"/) || [])[1] || '', custom: /w:customStyle="1"/.test(m[1]) }
    }
    let parts = execFileSync('unzip', ['-Z1', fp]).toString('utf8').split(/\r?\n/)
        .filter((v) => /^word\/(document|header\d*|footer\d*|footnotes|endnotes|numbering|comments)\.xml$/.test(v))
    for (let p of parts) {
        for (let m of rd(fp, p).matchAll(/<w:(pStyle|rStyle|tblStyle|numStyleLink|styleLink) w:val="([^"]*)"/g)) {
            let nm = names[m[2]] || { name: '(styles.xml 無此 id)', custom: false }
            let key = `${nm.name}\t${nm.custom ? 'custom' : ''}`
            kp[key] = kp[key] || { n: 0, where: new Set() }
            kp[key].n++
            kp[key].where.add(`${file}:${p.replace('word/', '')}`)
        }
    }
}
console.log('名稱\t自訂\t次數\t所在')
for (let [k, v] of Object.entries(kp).sort((a, b) => b[1].n - a[1].n)) console.log(`${k}\t${v.n}\t${[...v.where].slice(0, 4).join(' ')}`)
```

**比對範本與產出之自訂樣式**（三條判準之一與之三，另含更名檢查；`<前綴>` 為專案前綴）：

```js
//cmpStyles: node cmpStyles.mjs <範本.docx> <產出.docx> <前綴>
//  判準1(範本): 自訂樣式之 styleId 或名稱須帶專案前綴; 連結內建樣式之字元樣式(「…字元」, w:link 指向非自訂之樣式)不計
//  判準3(產出): 範本沒有、名稱為 CSS 類別形式者, 為轉檔時由 HTML 帶入, 另列計數, 不算範本問題
//  更名檢查: 範本之樣式名稱在產出中不存在者, 多半是 Word 把與內建樣式本地化名稱同名之自訂樣式更名(如「目錄標題」→「目錄標題1」)
import { execFileSync } from 'child_process'
let [fpTpl, fpOut, prefix] = process.argv.slice(2)
let readStyles = (fp) => {
    let xml = execFileSync('unzip', ['-p', fp, 'word/styles.xml'], { maxBuffer: 64 * 1024 * 1024 }).toString('utf8')
    let rows = []
    for (let m of xml.matchAll(/<w:style\b([^>]*)>([\s\S]*?)<\/w:style>/g)) {
        let [a, b] = [m[1], m[2]]
        rows.push({
            id: (a.match(/w:styleId="([^"]*)"/) || [])[1] || '',
            name: (b.match(/<w:name w:val="([^"]*)"/) || [])[1] || '',
            type: (a.match(/w:type="([^"]*)"/) || [])[1] || '',
            custom: /w:customStyle="1"/.test(a),
            link: (b.match(/<w:link w:val="([^"]*)"/) || [])[1] || '',
        })
    }
    return rows
}
let tpl = readStyles(fpTpl)
let out = readStyles(fpOut)
let byId = new Map(tpl.map((s) => [s.id, s]))
let isPrefixed = (s) => s.id.startsWith(prefix) || s.name.startsWith(prefix)
let isLinkedChar = (s) => s.type === 'character' && s.link !== '' && byId.has(s.link) && !byId.get(s.link).custom

//判準1: 範本之自訂樣式
let c1 = tpl.filter((s) => s.custom)
let g1 = { 專案前綴: [], 內建樣式之連結字元樣式: [], 其餘: [] }
for (let s of c1) {
    if (isPrefixed(s)) {
        g1.專案前綴.push(s)
    }
    else if (isLinkedChar(s)) {
        g1.內建樣式之連結字元樣式.push(s)
    }
    else {
        g1.其餘.push(s)
    }
}
console.log(`[判準1] 範本自訂樣式 ${c1.length} 個: 專案前綴 ${g1.專案前綴.length}, 內建樣式之連結字元樣式 ${g1.內建樣式之連結字元樣式.length}, 其餘 ${g1.其餘.length}(逐個判讀)`)
for (let s of g1.其餘) console.log(`  其餘\t${s.id}\t${s.name}`)

//判準3: 產出之自訂樣式分類
let tplNames = new Set(tpl.map((s) => s.name))
let isCssClass = (n) => /^[a-z][a-z0-9_\-.>:#+*~(),=\[\]\s]*$/.test(n)   //全小寫 ASCII、無中日韓字: 如 msonormal、katex-display、mfrac>span>span
let c2 = out.filter((s) => s.custom)
let g2 = { 範本帶入: [], HTML帶入_CSS類別: [], 其他: [] }
for (let s of c2) {
    if (tplNames.has(s.name)) {
        g2.範本帶入.push(s)
    }
    else if (isCssClass(s.name)) {
        g2.HTML帶入_CSS類別.push(s)
    }
    else {
        g2.其他.push(s)
    }
}
console.log(`[判準3] 產出自訂樣式 ${c2.length} 個: 範本帶入 ${g2.範本帶入.length}, HTML 帶入(CSS 類別) ${g2.HTML帶入_CSS類別.length}, 其他 ${g2.其他.length}(逐個判讀: 轉檔套件依選項新建者, 或 Word 另存重編者)`)
for (let s of g2.其他) console.log(`  其他\t${s.id}\t${s.name}`)
console.log(`  HTML帶入前20\t${g2.HTML帶入_CSS類別.slice(0, 20).map((s) => s.name).join(' | ')}`)

//更名檢查: 範本之樣式名稱在產出中是否仍在
let outNames = new Set(out.map((s) => s.name))
let lost = tpl.filter((s) => !outNames.has(s.name))
console.log(`[更名檢查] 範本樣式名稱在產出中不存在者 ${lost.length} 個(應為 0; 有則多半被 Word 更名)`)
for (let s of lost) console.log(`  不存在\t${s.id}\t${s.name}`)
```

**掃描業主字樣**（判準二；全部部件，含 `docProps/*`、`customXml/*`、頁首頁尾、編號、`[Content_Types].xml`，樣式名稱在 `word/styles.xml` 內；每一命中列出所在部件）：

- 對**範本**：字樣放本案與他案委託單位之名稱、簡稱與其樣式前綴，命中須為 0（範本不含任何業主資訊）。
- 對**產出 docx**：字樣放他案委託單位之名稱、簡稱與其樣式前綴，命中須為 0。本案委託單位之名稱另掃一次，命中只可出現在 `word/document.xml`、頁首頁尾（正文與封面），不可出現在 `word/styles.xml`、`word/numbering.xml`、`docProps/*`、`customXml/*`、`[Content_Types].xml`。

```js
//scanOwner: node scanOwner.mjs <檔.docx> <字樣...>
//  逐一讀出全部文字部件(含 docProps、customXml、頁首頁尾、樣式名稱所在之 styles.xml)搜尋字樣, 不分大小寫, 每一命中列出所在部件
//  document、頁首頁尾、註腳、註解另對串接後之文字節點搜尋(Word 常把一句話拆成多個 <w:t>, 字樣可能被切開)
import { execFileSync } from 'child_process'
let [fp, ...words] = process.argv.slice(2)
let parts = execFileSync('unzip', ['-Z1', fp]).toString('utf8').split(/\r?\n/).filter((v) => v !== '' && !v.endsWith('/'))
let hits = 0
let scanned = 0
for (let p of parts) {
    if (/^word\/media\//.test(p) || !/\.(xml|rels|vml)$/i.test(p)) {
        continue   //圖檔等二進位部件不掃
    }
    scanned++
    //unzip 把檔名參數當萬用字元樣式: [Content_Types].xml 之 [ 須改寫為 [[], 否則讀不到
    let raw = execFileSync('unzip', ['-p', fp, p.replace(/\[/g, '[[]')], { maxBuffer: 256 * 1024 * 1024 }).toString('utf8').toLowerCase()
    let hay = [raw]
    if (/^word\/(document|header\d*|footer\d*|footnotes|endnotes|comments)\.xml$/.test(p)) {
        hay.push([...raw.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g)].map((m) => m[1]).join(''))
    }
    for (let w of words) {
        let n = Math.max(...hay.map((h) => h.split(w.toLowerCase()).length - 1))
        if (n > 0) {
            hits += n
            console.log(`${p}\t${w}\t${n}`)
        }
    }
}
console.log(`掃描 ${scanned} 個文字部件(共 ${parts.length} 個部件), 字樣 ${words.length} 個, 命中 ${hits} 處`)
```

判讀：

- 產出 docx 引用到之自訂樣式即「產線樣式」，須改名（第 3 節）；只在範本存在、產出未引用之自訂樣式即可刪。轉檔套件也會依選項新建樣式（如 `toc` 之 `headStyles`），以產出實查為準，不以範本為準。
- **產出有、範本沒有、名稱為 CSS 類別者（`msonormal`、`katex*`、`hljs-*`、`mord`、`mfrac>span>span` 等），是轉檔時由 HTML 帶入之樣式**：md 含數學式、程式碼區塊等時才出現，數量可達數百，另列計數，**不要當成範本殘留去刪範本**。`cmpStyles` 以「全小寫 ASCII、無中日韓字」為啟發式辨識，只印前 20 個名稱，請抽看確認皆為 CSS 類別形狀；他案樣式前綴若恰為全小寫 ASCII 也會被歸入此類，故判準二之字樣掃描（含 `word/styles.xml`）不可省。
- `cmpStyles` 的判準一「其餘」不是自動判錯：逐個看名稱，無業主字樣且為產線所用者可保留並登記，其餘依第 3 節刪除。
- 更名檢查「不存在」者：範本之樣式名稱在產出中消失，多半是被 Word 更名（繁體中文版 Word 對與內建樣式本地化名稱同名之自訂樣式即如此），回頭改範本與轉檔呼叫之樣式名稱（第 3 節第 1 點）。

## 3. 清理步驟

依序做，每一步以 `officecli get`／第 2 節之腳本回查後再做下一步。

1. **產線樣式改名**：名稱改為專案前綴之中性名稱（例：名稱「<前綴>目錄標題」）；styleId 一併改為帶前綴者（例：`<前綴>TocTitle`）較整齊，但 `officecli set` 不能改 styleId（其 help 載明），要改須以 `raw-set` 連同全部引用一起改，不改則以名稱帶前綴為準（判準一容許擇一）；名稱**不得與 Word 內建樣式之本地化名稱同名**（如「目錄標題」本身），加專案前綴即避開；轉檔呼叫之 `titleStyle` 等同步改為新名稱（SKILL 第 5 節）。改名後以真 Word 轉一份，用 `cmpStyles` 之更名檢查比對範本與產出之樣式名稱，範本有而產出無者即被 Word 更名。
2. **範本內之段落改套 Normal**：範本之本文若只剩一個空段落而套著他案樣式，移除其 `pStyle`。
3. **斷開對待刪樣式之引用**：編號定義（`/numbering`）各層之 `pStyle`；各樣式之 `w:link`（連結之字元樣式）、`w:next`（下一段樣式，例如標題 1～9 之下一段改指 Normal）、`w:basedOn`；表格樣式之 `w:aliases`（如 Table Grid 被加上他案別名）。
4. **刪除樣式**：與產線無關之自訂樣式全部刪除；與產線無關之內建樣式（如日期、註解類、結語、問候、文件引導模式、Normal (Web)、Placeholder Text、各種表格配色樣式）一併刪除。
5. **保留**：Word 核心預設與轉檔會用之內建樣式——Normal、標題 1～9、目錄 1～9、TOC Heading、caption、table of figures、頁首頁尾、page number、Hyperlink、FollowedHyperlink、Table Grid、註腳與章節附註、List Paragraph、Strong 等；實際清單以第 2 節之「產出實際引用」加上 Word 預設為準。
6. **頁首頁尾欄位之暫存值**：PAGE 等欄位之快取文字若留著他案之頁碼格式，改為中性值（如「1」）。
7. **文件屬性與附加範本**：`docProps/core.xml`、`docProps/app.xml` 之作者、公司、最後修改者、套用範本名稱，`word/settings.xml` 之附加範本路徑（`attachedTemplate`）及其 `word/_rels/settings.xml.rels` 之外部連結（可含本機路徑），清空或改為中性值。
8. **確認旗標**：`word/settings.xml` 仍有 `<w:doNotAutoCompressPictures/>`。
9. `officecli validate` 通過。

officecli 之對應操作（旗標以已安裝版本之 `officecli help` 為準；以下依 1.0.158 之 help 核對）：改樣式名稱用 `set "<檔>" "/styles/<styleId>" --prop name=<新名稱>`（styleId 不能由 `set` 改）；刪除元素、移除或改寫屬性用 `raw-set "<檔>" <部件> --xpath "<XPath>" --action append|prepend|insertbefore|insertafter|replace|remove|setattr [--xml ...]`（`--xpath` 與 `--action` 必給），部件如 `/styles`、`/document`、`/numbering`、`"/footer[1]"`。改 styleId 須連同全部引用一起改，改前先以第 2 節之腳本列出引用處。

## 4. 改後檢查

依 SKILL 第 4 節之三條判準，各用第 2 節之腳本：

- **判準一（範本）**：`cmpStyles` 對範本與一份產出跑，自訂樣式只剩專案前綴者（styleId 或名稱帶前綴皆可；連結字元樣式不計，「其餘」逐個判讀並登記）；更名檢查無「不存在」；`usedStyles` 列出之被引用樣式皆存在且為預期者。
- **判準二（產出全面）**：`scanOwner` 對範本與產出 docx 各跑一次（字樣放法見第 2 節），命中 0（本案委託單位名稱在產出只可見於正文與封面）。
- **判準三（HTML 帶入）**：`cmpStyles` 之 HTML 帶入計數另列於回報，不計入判準一與二。
- 以新範本重轉第 1 節之代表性 md，與基準比對：
  - 頁數相同（以 Word 實排或 docProps 之頁數）；
  - 正文文字雜湊相同（取 document.xml 串接後之文字節點計算）；
  - 目錄標題與各級標題套用預期之產線樣式；
  - `doNotAutoCompressPictures` 在、圖數一致。
- 通過後才替換正式範本並全部重產（SKILL 第 8 節）。

## 5. 升級轉檔套件後

升級後以同一份代表性 md 重轉並跑第 4 節之比對：套件之預設樣式名稱、會新建之樣式、內附範本都可能改變（1.0.29 即改了 `titleStyle` 預設，並以中性之 `temp.docx` 取代舊內附範本）；轉檔呼叫已明確指定樣式名稱者，仍須確認產出未多出非專案前綴之自訂樣式（HTML 帶入者除外，另列計數）。自舊內附範本衍生之專案範本，其目錄標題樣式若沿用舊名，須在 `titleStyle` 給完整舊名，否則 1.0.29 起改用新建之置中粗體樣式（外觀不同）。
