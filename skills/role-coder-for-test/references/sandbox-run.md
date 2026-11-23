# 跑他套件(複本、沙箱、發布包解開之目錄)之測試:解析守門與配置

> 本檔為 SKILL.md §5.1 之細則.實測環境:Windows,Node v24.22.1,2026-11-19(夾具:上層目錄之 `node_modules` 放 `outerpkg`,沙箱自建 `node_modules` 放 `innerpkg`;沙箱內之測試檔分別以 ESM 與 CJS 匯入).

**觸發**:在某專案之樹下,對另一個套件之複本(沙箱、`npm pack` 解開之目錄)跑其測試;審查此類作法;要證明測試沒有讀到沙箱以外之模組.

## 1. 為何要守門

裸名匯入(`import x from 'pkg'`)在沙箱之 `node_modules` 找不到時,會**向上層目錄逐層尋找**:沙箱位於另一個專案之樹下時,解析到上層專案之 `node_modules`,版本不同而測試照過,沒有任何訊息.實測(無守門):沙箱內 `import x from 'outerpkg'`(ESM)與 `require('outerpkg')`(CJS)皆成功解析到上層目錄之副本,離開碼 0.git 與 eslint 同理向上讀上層專案之設定(§5.1 第 3 點).

## 2. 解析守門模組

以 `NODE_OPTIONS=--import=<守門模組之 file URL>` 載入,以 `module.registerHooks`(同步鉤子;對 `import` 與 `require` 皆生效)攔下解析結果,凡落在沙箱根之外即拋錯:

```js
//guard.mjs:沙箱解析守門
import { registerHooks } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

let root = path.resolve(process.env.SANDBOX_ROOT || process.cwd()).toLowerCase() + path.sep
let inside = (p) => (path.resolve(p).toLowerCase() + path.sep).startsWith(root)

registerHooks({
    resolve(specifier, context, nextResolve) {
        let r = nextResolve(specifier, context)
        if (r.url.startsWith('file:')) {
            let p = fileURLToPath(r.url)
            if (!inside(p)) {
                throw new Error(`[sandbox-guard] 解析到沙箱之外: ${specifier} -> ${p}`)
            }
        }
        return r
    },
})
```

用法(bash):

```bash
NODE_OPTIONS="--import=file:///<守門模組絕對路徑>" SANDBOX_ROOT=<沙箱根絕對路徑> npm --prefix <沙箱根> test
```

實測結果(夾具同上,工作目錄故意取在沙箱之外以模擬誤用):

| 配置 | 結果 |
|---|---|
| 無守門,沙箱內匯入 `outerpkg`(ESM／CJS) | 解析到上層目錄之副本,離開碼 0(兩者皆是) |
| 有守門,沙箱內匯入 `outerpkg`(ESM／CJS) | 拋 `[sandbox-guard] 解析到沙箱之外`,離開碼 1(兩者皆是) |
| 有守門,沙箱內匯入沙箱自建之 `innerpkg` 與 `node:fs`(ESM／CJS) | 正常,離開碼 0 |

要點與限制:
- 守門只擋**模組解析**;以 `fs` 讀設定檔(如依 `process.cwd()` 找設定)不被擋,故仍須以複本之根為工作目錄(§5.1 第 2 點).
- 路徑比對在 Windows 不分大小寫;Node 解析時預設還原符號連結／目錄連結為真實路徑,故以目錄連結接回上層專案之 `node_modules` 者,守門會視為沙箱之外而擋下——這也是沙箱不建目錄連結之理由.
- `--import` 之值須為 file URL(Windows 之磁碟機代號路徑不可直接給).
- 未實測:`mocha --parallel` 之 worker 是否繼承 `NODE_OPTIONS`(環境變數預設由子行程繼承,啟用前先以「故意解析到沙箱外」之案確認守門在 worker 內亦觸發);僅於 Node v24.22.1 實測,其他版本之 `registerHooks` 可用性未測.

## 3. 沙箱配置

1. 沙箱自建 `node_modules`,放相依套件之**發布包複本**(`npm pack <套件>@<版本>` 解開之內容),不建目錄連結.
2. 不用 git(沙箱在另一個倉庫之樹下時,git 會向上找到上層專案之倉庫);eslint 明指該套件之設定:`-c <設定檔>`(eslint 8 另有 `--no-eslintrc`,8.57.1 實測有此旗標;9 以上之 flat config 無此旗標,依其說明).
3. 於發布包解開之目錄跑全套:`npm pack` 之發布包**不含 `.gitignore`**(實測 `npm pack --dry-run`,tarball 內只有 `package.json` 與原始檔),依賴它之測試於此配置必敗,驗證步驟須寫明哪些測試因此排除;安裝相依所產生之 `package-lock.json` 於提案端環境含倉庫位址,須在跑「發布內容不含內網位址」類之測試前檢查並刪除(本機 npm 12.1.0 所產鎖檔無 `resolved` 欄,視 npm 版本與設定而異,故不假設,以檢查為準).
4. 以 `npm --prefix <根> test` 起測時,script 之 `process.cwd()` 即 `<根>`(實測).
5. **發布包配置之全套(每輪)**(提案端之作法,本庫未另行實跑):`npm pack` → 解開 → 複製 lockfile → `npm ci`(依 lockfile 精確安裝)→ 被測物會起外部程式者,移除真實 CLI 之 PATH 並以 `where`／`which` 驗證(SKILL §5.2)→ 平行執行時 `--jobs` 不超過邏輯核數減 2(以免占滿使用中之機器).
   - 本機 npm 設有新版冷卻期(`min-release-age`)而 lockfile 之版本仍在冷卻期內者,`npm ci` 報 `ETARGET`(提案所述:約 3 分鐘後才失敗,並留下半裝之 `node_modules`,重試前先刪除);只在 lockfile 之版本與工作樹已安裝者相同時,才對該驗證複本以 `--min-release-age=0` 覆寫——不藉此引入新版本.
   - 解開之目錄自帶 `node_modules`、無目錄連結,可兼作變異之鏡像根.
   - 每輪步驟相同而各套件各寫一份包裝者,宜提案由自有套件之共用工具提供,不在技能內附腳本.
