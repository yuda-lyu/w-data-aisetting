
程式碼是強約束的檢查與執行軌跡, 提示詞是弱約束的執行原則與要點, 須針對專案/套件之[指引要求]類文字檔進行優化或重組, 請於專案/套件內進行:

1. 創建 ./sgud, 專門儲存[指引要求]類文字, 此會入版控, CLAUDE*.md仍不入版控

2. CLAUDE_experience.md 請移入與更名:
./sgud/exp/experience.md

針對[經驗類]文檔, 若一般情況就直接儲存單檔(experience.md)
若你或執行agent判斷已過長不好找、太浪費token, 請自行抽提舊經驗成為備份檔, 檔名規則為: experience_{年月日}.md, experience.md內就只要提及何時已抽出歷史經驗至experience_{年月日}.md, 供agent自行再判斷是否要去調閱查找久遠歷史經驗

3. CLAUDE_process.md 請移入與更名:
./sgud/proc/process.md

針對[處理要點類]文檔, 若一般情況就直接儲存單檔(process.md)
若你或執行agent判斷已過長不好找、太浪費token, 請自行依照類型分拆拆成: process_{類型}.md, 類型該怎麼訂則依照專案/套件各自情形去決定即可, 原本process.md就只提到哪些類型該查哪些md檔

4. CLAUDE_rulebook.md 請移入與更名:
./sgud/rule/rulebook.md

針對[規則帳本類]文檔, 若一般情況就直接儲存單檔(rulebook.md)
若你或執行agent判斷已過長不好找、太浪費token, 請自行依照類型分拆拆成: rulebook_{類型}.md, 類型該怎麼訂則依照專案/套件各自情形去決定即可, 原本rulebook.md就只提到哪些類型該查哪些md檔

5. CLAUDE_state.md, 請移入與更名:
./sgud/state/state.md
若無, 但若有需要就請創建: ./sgud/state/state.md
跟rulebook差別主要是rulebook是已識別或規劃出可能之規則帳本清單, 專案/套件當前未必完全能實作完, 故rulebook是藍圖, state.md是要儲存當前已開發功能最新狀態, 與rulebook比對就能知道還有哪些沒做, 而且主要可用於接續工作時的判斷, 不用再去翻experience, 減少token浪費

看還有什麼缺漏須補完, 就由你再去處理

----

CLAUDE.md

# Agent 工作規則

[指引要求]類文字置於`./sgud`,由agent自行編列、擴充與維護;過長時之抽出與分拆依全域設定或此處設定:

- 執行工作時特有之[累積經驗]須紀錄至`sgud/exp/experience.md`,主要為留給後續嘗試,執行,判斷之經驗.過長時抽出舊者為`experience_<年月日>.md`,並於`experience.md`留索引並說明何時抽出.

- 設計與開發階段之[規則帳本]須儲存至`sgud/rule/rulebook.md`,主要為以[規則]為單位(而非以缺陷站點為單位)記載[程式碼須長成什麼樣],每條附可重跑之盤點指令、站點全集與其判準(已套/未套/刻意不套),或由規格產出之測試(項目/說明/流程)須有哪些,對應是哪些測試檔案與指令等.規則帳本為藍圖;過長時依類型拆為`rulebook_<類型>.md`,`rulebook.md`只留索引.

- 執行工作時特有之[重要處理要點]須紀錄至`sgud/proc/process.md`,主要為業務端之特化要求事項與其對應之處理流程與方式.過長時依類型拆為`process_<類型>.md`,`process.md`只留索引.

- 若有需要,可將目前已有之機制、工具與設定之最新狀態須記於`sgud/state/state.md`,接續工作時先讀此檔,與規則帳本比對即知尚未做到者.

特有之[設定資訊]須儲存至`CLAUDE_settings.md`,agent請勿自行修改.

專案特有之[計畫資訊]須儲存至`CLAUDE_project.md`,agent請勿自行修改.

----
