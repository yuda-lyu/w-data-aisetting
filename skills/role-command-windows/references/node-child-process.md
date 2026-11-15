# node 起子行程:啟動失敗之判讀與環境變數繼承之實測紀錄(`SKILL.md` §7.2、§7.3 之細節)

實測日 2026-11-15.環境:Windows 11 Pro(10.0.26300,中文版,主控台碼頁 cp950)、Node v24.22.1、Git Bash(GNU tar 1.35).§1 之測試 exe 一律以本機 .NET Framework 之 `csc.exe`(`C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe`,`-platform:x64 -win32manifest:<manifest 檔>`)自編;§3 之腳本另以系統之 `notepad.exe` 與 `node.exe` 驗證.全程未下載、未安裝任何東西.

## 1. 啟動失敗:同一支 exe 在各種起法之結果

測試 exe 皆為 x64,主程式只印一行字;差別只在內嵌 manifest.

| 測試 exe | node `spawn` | `spawnSync`、`execFile`、`execFileSync` | `cmd /c`(`exec`、`execSync` 之底層) | .NET `Process.Start` 之 `NativeErrorCode` |
|---|---|---|---|---|
| 無相依(對照) | 正常 | 正常 | 正常 | — |
| 相依本機不存在之並存組件 | **同步拋出** `spawn UNKNOWN`(`code: 'UNKNOWN'`、`errno: -4094`);`'error'` 事件不發 | `error.code` 為 `UNKNOWN`(`spawnSync <路徑> UNKNOWN`);`execFile` 亦同步拋出,`execFileSync` 拋出同 code | 離開碼 1,stderr 為「因為應用程式的並列設定不正確…請…使用命令列工具 sxstrace.exe」 | 14001 |
| 相依 `Microsoft.VC80.CRT`(本機 `WinSxS` 有 8.0.50727.9680,經 policy 導向) | 正常 | 正常 | 正常 | — |
| 相依 `Microsoft.VC80.CRT` 與 `Microsoft.VC80.MFC`(本機無 MFC) | 同「不存在之並存組件」 | 同 | 同 | 14001 |
| manifest 為 `requireAdministrator`,本 session 未提權 | `'error'` 事件(不拋出),`code: 'EACCES'`、`errno: -4092` | `EACCES` | 離開碼 1,stderr 為「存取被拒。」 | 740 |

- `getSystemErrorName(-4094)` 為 `UNKNOWN`(`util.getSystemErrorName`).
- 取 Win32 原始錯誤碼之法:以 csc 編一支約十行之 C# 程式,`Process.Start`(`UseShellExecute = false`)包 `try`,`catch (Win32Exception e)` 印 `e.NativeErrorCode`.14001 即 `ERROR_SXS_CANT_GEN_ACTCTX`(並存組態錯誤).`libuv` 對此碼無對應名稱而回 `UNKNOWN` 為依上列結果之推論,未讀 libuv 原始碼.
- 缺並存組件時,每次起動各在 Application 事件記錄留一筆:對同一支 exe 以上表四欄之起法各起一次,共四筆,內容相同.

## 2. SideBySide 事件(缺並存組件之直接證據)

指令(Git Bash,`/q:`、`/c:` 等旗標以 `MSYS_NO_PATHCONV=1` 保住;實測不加時回「指定太多引數」):

```bash
MSYS_NO_PATHCONV=1 wevtutil qe Application /q:"*[System[Provider[@Name='SideBySide']]]" /c:3 /rd:true /f:text | node -p "new TextDecoder('big5').decode(require('fs').readFileSync(0))"
```

輸出為 cp950,直接顯示在 Bash 工具會亂碼,故以 node 解碼(`node -p` 只把結果印出,不寫檔).實測輸出(節錄,中文版):

```
  Source: SideBySide
  Event ID: 33
  Level: 錯誤
  Description:
"<exe 路徑>" 的啟用內容產生失敗。 找不到依存組合 Microsoft.VC80.MFC,processorArchitecture="amd64",publicKeyToken="1fc8b3b9a1e18e3b",type="win32",version="8.0.50727.4053"。 請使用 sxstrace.exe 進行詳細的診斷。
```

事件內文直接給出缺少之組件名、架構與版本,不必再解析 manifest;`<exe 路徑>` 可核對是否為剛才失敗之那支.`sxstrace.exe` 須系統管理員,未實測.

## 3. 讀 exe 之 PE 架構與 manifest 相依

PE 架構先用 Git Bash 之 `file <exe>`(實測自編 x64 exe 印 `PE32+ executable … x86-64 …`,`SysWOW64\notepad.exe` 印 `PE32 executable … Intel i386`).manifest 相依以下列腳本取(實測於自編 exe 與 `notepad.exe` 正確列出相依組件與提權設定;`node.exe` 無相依,只列提權設定;manifest 非明文或為外部檔者讀不到,改以本檔 §2 之事件判讀):

```js
//用法: node manifest-deps.mjs <exe>
import fs from 'fs'

let buf = fs.readFileSync(process.argv[2])
let machine = buf.readUInt16LE(buf.readUInt32LE(0x3c) + 4)
console.log('PE machine:', { 0x8664: 'x64(amd64)', 0x14c: 'x86', 0xaa64: 'arm64' }[machine] || `0x${machine.toString(16)}`)

let m = /<assembly[\s\S]*?<\/assembly>/.exec(buf.toString('latin1'))
if (!m) {
    console.log('無明文 manifest')
    process.exit(0)
}
for (let d of m[0].matchAll(/<dependentAssembly[^>]*>\s*<assemblyIdentity([^>]*)\/?>/g)) {
    console.log('dependentAssembly:', d[1].replace(/\s+/g, ' ').trim())
}
let lv = /requestedExecutionLevel[^>]*level\s*=\s*"([^"]*)"/.exec(m[0])
console.log('requestedExecutionLevel:', lv ? lv[1] : '(未宣告)')
```

只想快查 VC 執行階段時,`grep -a -o 'Microsoft\.VC[0-9]*\.[A-Za-z]*" version="[0-9.]*"' <exe>` 實測可列出 `Microsoft.VC80.CRT" version="8.0.50727.4053"` 等,但屬性順序或換行不同者會漏.

`WinSxS` 查詢(實測本機有 `amd64_microsoft.vc80.crt_…_8.0.50727.9680` 與 `x86_microsoft.vc80.crt_…_8.0.50727.9680`,無任何 `vc80.mfc`):

```bash
ls -d /c/Windows/WinSxS/amd64_microsoft.vc80.mfc*    # 無輸出(ls 報找不到)＝本機沒有該組件
ls -d /c/Windows/WinSxS/amd64_microsoft.vc80.crt*
```

## 4. 環境變數之繼承:實測

以專用名之使用者環境變數(`setx <名> <值>`,之後 `reg delete` 刪除並以 `reg query` 回驗)測試;測試期間 Claude 之 session 一直在執行,變數是 session 啟動後才寫入.各讀取點之結果:

| 讀取點 | 結果 |
|---|---|
| `reg query "HKCU\Environment" /v <名>`(`MSYS_NO_PATHCONV=1`) | 有值 |
| 本 session 之 Git Bash 變數 `$名` | 無 |
| `node -p "process.env.<名>"` | `undefined` |
| 本 session 起之 `cmd` 子行程之 `%名%` | 不展開(印出原文 `%名%`) |
| node `spawn` 子行程(繼承 `process.env`) | `undefined` |
| node `spawn` 子行程(`env: { ...process.env, [名]: 值 }`) | 讀得到 |
| `cmd` 子行程(同上補 `env`) | 讀得到 |
| Git Bash 不加 `MSYS_NO_PATHCONV=1` 下 `reg query … /v <名>`(值確實存在) | 「語法不正確」,離開碼 1 |

於 node 內讀登錄檔並補入子行程之寫法(實測;`reg` 以參數陣列傳入,免受 Git Bash 路徑改寫):

```js
import { spawnSync } from 'child_process'

//讀登錄檔之字串值,取不到回 undefined
let regGet = (key, name) => {
    let r = spawnSync('reg', ['query', key, '/v', name], { windowsHide: true, encoding: 'latin1' })
    if (r.status !== 0) {
        return undefined
    }
    let m = new RegExp(`^\\s+${name}\\s+REG_(?:EXPAND_)?SZ\\s+(.*)$`, 'mi').exec(r.stdout)
    return m ? m[1].trim() : undefined
}

//使用者於本 session 啟動後才設之 X:本 session 之 process.env 沒有,於起子行程時補入(示意片段:exe、args、X 依實況替換)
let v = regGet('HKCU\\Environment', 'X')
spawnSync(exe, args, { windowsHide: true, env: { ...process.env, X: v } })
```

`REG_EXPAND_SZ` 之值內若含 `%其他變數%` 不會被上式展開,遇到時須自行展開(未實測).

## 5. 未實測項

- 系統層(HKLM `Session Manager\Environment`)之環境變數:機制同為「子行程於建立時自父行程繼承」,但寫入須系統管理員權限,不為測試改系統層,故未獨立重現.
- 使用者重開 agent 之宿主程式後新 session 即讀得到:依繼承機制之推論,未實測.
- 相容性設定 `RUNASADMIN`(`AppCompatFlags\Layers`)、`Zone.Identifier` 對 `spawn` 之影響.
- `sxstrace.exe`(須系統管理員)、32 位元 exe 缺 `x86_` 組件之實際事件文字(只驗了 `WinSxS` 有 `x86_` 前綴之目錄).
- 非中文版 Windows 之訊息文字(上列 stderr 與事件內文為中文版實測).
