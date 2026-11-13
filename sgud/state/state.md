# 狀態

本檔為已開發功能之現況(各功能做到哪裡、對應之規則帳本條目與測試檔、已知缺口與待辦、最近一次驗證或發布之版本);藍圖見 `sgud/rule/rulebook.md`.接續工作先讀本檔;只記現況,過程寫入經驗.

- 版本:發布由主控之流程遞增(本檔更新時 `package.json` 為 1.0.2).最近驗證:2026-11-13(遷移至 w-playwright 之後),`npm test` 240 passing、0 failing、0 pending(8 檔;Windows 11、Node 24、經 w-playwright 1.0.1〔playwright-core 1.64.1〕啟動之 chromium headless shell 1248);遷移前基線同日 235 passing(7 檔),新增 5 案(`unit-pkg` 3 案、`api-wpwWiring` 2 案).外審(terra)19 條(2026-11-12)已逐條處置;遷移輪不派外審.

## 功能現況

| 功能 | 狀態 | 帳本條目 | 測試檔 |
|---|---|---|---|
| 排版(Node 端純函式,規則 1～11、檢核碼、覆寫、與順序無關) | 完成;與原型 L3 等價 439/439 標籤、82/82 案(`LEAD_COVERS_TEXT` 未能構造觸發) | R-GC-LAYOUT-00～11、R-GC-CHECK-01、R-GC-OVR-01、R-GC-ORDER-01 | `unit-layout` |
| 量框(sel、at、fn＋arg、union 收嚴、fit／box、pad)與字寬、字型存在判定 | 完成 | R-GC-PAGE-01、R-GC-MEASURE-01～03 | `unit-measureInPage`、`api-WGuidechart` |
| 輸入檢測(宣告表含回呼之回傳值與資料檔、K3、K4、debug 警告、V9、V11、V17;不呼叫使用端之方法) | 完成(暫行手寫,見待辦) | R-GC-ARG-01～05 | `unit-conf` |
| 取景(注入之瀏覽器、停放滑鼠、條件式穩定等待之兩道防線、onTrace) | 完成 | R-GC-SETTLE-01、R-GC-TRACE-01 | `unit-waitSettle`、`api-WGuidechart` |
| 繪製(資料檔驗證〔N2 轉換、截圖可解碼〕、E_STALE、canvas 裁切、svg 跳脫、png、layout.json、FONT_FALLBACK) | 完成 | R-GC-DATA-01、R-GC-CROP-01、R-GC-SVG-01、R-GC-RENDER-01 | `api-WGuidechart`、`unit-measureInPage` |
| 入口、失敗通道與遮罩、信任邊界 | 完成 | R-GC-API-01、R-GC-ERR-01、R-GC-FLOW-01～04、R-GC-TRUST-01 | `api-WGuidechart`、`unit-pkg` |
| 依賴與建置(dist 實跑與 src 相同) | 完成 | R-GC-PKG-01、R-GC-DIST-01 | `unit-pkg`、`unit-dist` |
| 瀏覽器啟動經 w-playwright(測試唯一啟動點、接線、R-PW-ONLY 掃描、README／JSDoc 之安裝與守門說明) | 完成(2026-11-13,排程第 442 項遷移輪);`src` 不啟動瀏覽器故邏輯未動;dev 依賴 `w-playwright ^1.0.1`,無 `playwright`／`playwright-core` | R-GC-PW-01 | `unit-pkg`、`api-wpwWiring`(及全部啟動瀏覽器之測試經 `test/tools/launch.mjs`) |

## 已知限制

- 字寬以繪製時之瀏覽器量測,輸出(字寬、png)隨使用端注入之瀏覽器版本與系統字型而變;字型不在時列 `FONT_FALLBACK`.
- 只在 Windows 11 實跑,未驗證非 Windows;`unit-measureInPage` 之「Arial 存在」一斷言只在 win32 執行.
- 本套件之測試只啟動 headless shell;真 Chrome、Edge、完整 Chromium 下之取景與繪製結果未實測(字寬隨瀏覽器而變,README 已註明).
- `docs/` 為發布流程(jsdoc)產物,現存內容仍含遷移前之範例(直接匯入 `playwright`),下次發布重產.
- 頁面之 `deviceScaleFactor` 須為 1;截圖帶 ICC 時 canvas 裁切會轉色(Chromium 之截圖實測不帶).
- `vis()` 只看元素本身之 opacity,祖先 `opacity:0` 之元素仍被算入(沿用原型;未見實害).
- 每圖功能區建議 ≤10;n≥12 之合成案有排不下之問題.
- 截圖之可解碼性以 Chromium 之 `img.decode()` 判定:只有檔頭而無影像資料者被拒;影像資料部分截斷而仍可解碼者之行為隨瀏覽器而定(未逐一實測).
- 頁面替身(非 Playwright)之回傳若為存取器等, 只在 `find.fn` 之回傳與瀏覽器物件之 `newPage`／`close` 處以單次讀取處理;其餘頁面方法視為 Playwright 之語意.

## 待辦

- R-GC-ARG-05:wsemi 之公開 opt 解析函數上線後,`src/parseConf.mjs` 改用之(主控裁定 D-3).
- 未做:標準圖(pixel baseline;本輪決定不採,`test/pics` 未建)、負載試驗(派工未列).
