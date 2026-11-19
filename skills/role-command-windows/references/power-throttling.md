# 背景 node 行程之節能排程(Power Throttling):判讀指令與 API 實測紀錄(`SKILL.md` §7.4 之細節)

實測日 2026-11-19.環境:Windows 11 Pro(10.0.26300,中文版)、Node v24.22.1、Windows PowerShell 5.1;本機為虛擬機,CPU 名稱顯示 12th Gen Intel Core i7-12700,系統只露出 4 核 8 個邏輯處理器.下列 PowerShell 僅為量測(讀取各邏輯處理器負載、驗證 API 可呼叫),不是解除用之範例程式.

## 1. 本機有無效能核心／節能核心之區分

以 `GetSystemCpuSetInformation`(kernel32;逐筆 `SYSTEM_CPU_SET_INFORMATION`,`EfficiencyClass` 在該結構 CpuSet 欄位內,自結構起始偏移 18 之 1 位元組)讀出各邏輯處理器之 `EfficiencyClass`:

```
logical=0 core=0 efficiencyClass=0
logical=1 core=0 efficiencyClass=0
logical=2 core=2 efficiencyClass=0
logical=3 core=2 efficiencyClass=0
logical=4 core=4 efficiencyClass=0
logical=5 core=4 efficiencyClass=0
logical=6 core=6 efficiencyClass=0
logical=7 core=6 efficiencyClass=0
```

8 個邏輯處理器之 `EfficiencyClass` 全為 0:本機**沒有**效能核心與節能核心之區分,故提案端所述「節能核心滿載、效能核心閒置」**無法於本機重現**,§7.4 之現象依提案端兩次觀察,標為未實測.依該 API 之說明,混合架構機器上 `EfficiencyClass` 會出現不同之值(值較小者較省電),本機未驗.

## 2. 判讀各邏輯處理器之負載

兩種寫法皆於本機實測可用(皆列出 8 個邏輯處理器與 `_Total`):

```bash
# Git Bash(須 MSYS_NO_PATHCONV=1,否則 \Processor 之反斜線與 / 旗標被改寫;輸出為 cp950,只看數字時可略)
MSYS_NO_PATHCONV=1 typeperf "\Processor(*)\% Processor Time" -sc 3
```

```powershell
# Windows PowerShell 5.1
(Get-Counter '\Processor(*)\% Processor Time').CounterSamples | Select-Object Path, CookedValue
```

判讀:各邏輯處理器之負載是否不均——一組邏輯處理器(混合架構上對應節能核心者)接近 100%,另一組幾乎閒置.整機 `_Total` 低不代表有餘裕.

## 3. `ProcessPowerThrottling` 之呼叫與回讀

`SetProcessInformation(hProcess, ProcessPowerThrottling = 4, &state, sizeof(state))`,`state` 為 `PROCESS_POWER_THROTTLING_STATE`(3 個 ULONG,共 12 位元組):`Version = 1`(`PROCESS_POWER_THROTTLING_CURRENT_VERSION`)、`ControlMask`、`StateMask`;`PROCESS_POWER_THROTTLING_EXECUTION_SPEED = 0x1`.

| ControlMask | StateMask | 意義 |
|---|---|---|
| 0x1 | 0 | 由行程自管,且**關閉**節能排程(解除用) |
| 0x1 | 0x1 | 由行程自管,且**開啟**節能排程 |
| 0 | 0 | 不自管,交由系統決定(預設) |

實測(以 P/Invoke 對自起之隱藏 node 子行程,取其 `Process.Handle`,該控制代碼具足夠之存取權):

```
initial:                 get ok=True Control=0 State=0
set Control=1 State=0:   ok=True
after Control=1 State=0: get ok=True Control=1 State=0
set Control=1 State=1:   ok=True
after Control=1 State=1: get ok=True Control=1 State=1
set Control=0 State=0:   ok=True
after Control=0 State=0: get ok=True Control=0 State=0
```

即該 API 於本機可呼叫、狀態可回讀,且只作用於該子行程.**已驗:呼叫成功與回讀;未驗:解除後工作者實際由節能核心移到效能核心、速率回升**(本機無節能核心).`GetLastWin32Error` 在成功時可能殘留舊值(實測回 203),判成敗只看回傳值.

## 4. 行程樹

工作者為子行程者,須涵蓋整個行程樹(提案端之作法):對行程樹內每一個行程呼叫;列舉子行程時以「建立時間晚於父行程」過濾,防 PID 重用而誤設到他人之行程.子行程是否繼承父行程之設定、起跑後才建立之子行程是否須另設,本次**未實測**,以逐一涵蓋為準.
