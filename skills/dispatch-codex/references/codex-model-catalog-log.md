# dispatch-codex：模型型錄表（2026-10-27，Codex 0.163.0）

本檔收 SKILL.md〈模型驗證〉之型錄表（原文逐字自 SKILL.md 搬移，未刪改；型錄幾週內就會重排，**不得照抄本表**，固定 slug 前一律重跑 `codex debug models`）。

| slug | priority | 預設 effort | 脈絡 | 備註 |
|---|---|---|---|---|
| `gpt-6.1-sol` | 1 | `low` | 500K | `Latest workhorse model for coding and everyday work.`；2026-09-30～10-27 之本技能預設值 |
| `gpt-6-astra` | 2 | `low` | 272K | `Frontier intelligence for the most demanding work.`（2026-09-30 之前曾為 priority 1） |
| **`gpt-6.1-terra`** | **3** | **`low`** | 500K | **本技能必要預設值**（2026-10-27 起）；單價為 Sol 之半 |
| `gpt-6-sol` | 4 | `medium` | 272K | `Previous generation workhorse model.` |
| `gpt-6-luna` | 5 | `medium` | 272K | `Fast and affordable model for easier tasks.`；2026-10-18 查時**不支援 `ultra`** |
| `gpt-5.6-sol`／`-terra`／`-luna` | 6／8／9 | `low`／`medium`／`medium` | 272K | 前代，描述皆標 `Older …`；`gpt-5.5` 已自型錄移除（2026-09-30 時仍在） |
