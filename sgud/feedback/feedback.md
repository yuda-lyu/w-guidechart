# 回饋

本檔記任務中發現之自有套件、全域技能、全域設定之調整與抽提提案;一條一列,只增不改,處置結果另記一列並寫明承接哪一列.

| 日期 | 類別 | 對象 | 內容 | 依據 |
|---|---|---|---|---|
| 2026-11-12 | 自有套件 | wsemi | 〈輸入參數之檢測機制〉§7 之公開 opt 解析函數尚未提供,本套件只能以公開判斷函數逐鍵手寫宣告表(約 80 鍵,`src/parseConf.mjs`);各新套件之寫法易分歧,建議提高其排程優先序 | `src/parseConf.mjs`;`sgud/rule/rulebook.md` R-GC-ARG-05 |
| 2026-11-12 | 自有套件 | wsemi | `htmlEncode` 把非 ASCII 編為數值參照(`功能` → `&#x529F;&#x80FD;`),svg 可正常顯示但不易閱讀與以 Inkscape 編修;建議提供只跳脫 `& < > " '` 之選項(其底層 he 有 `escape`) | `src/genSvg.mjs`(標籤經 `htmlEncode`);實跑輸出之 svg |
| 2026-11-12 | 全域技能 | role-coder-for-test(references/timer-tests) | 測「等畫面穩定」類函數時,「頁面動 N 影格後自停」看似以事件同步,實則依賴「動畫比 Node 端往返久」之時間假設:於取景前加 1.5 秒之非缺陷延遲,舊設計之斷言 0/3 成立;改為「觀察到第一個 same:false 事件後才由測試停止動畫」後 3/3 成立.建議於 §1 或 §5 加此型之錯誤形狀與正解(外部渲染器之動畫之停止時點須由被測物之事件決定) | `test/api-WGuidechart.test.mjs` R-GC-SETTLE-01;主控任務 20261112180920 `gc-impl-evidence/timing.log` |
| 2026-11-12 | 自有套件 | wsemi | `isfun`(lodash `isFunction`)對 async generator 函數回 false,與 dspec〈輸入參數之檢測機制〉§3.6 之 F1 定義(`typeof v === 'function'`)不一致;本套件為與 `getTrace` 同一判定而沿用 `isfun` 並於帳本註明.建議 wsemi 釐清 F1 之判定(或於 `isfun` JSDoc 寫明不含 async generator) | `src/parseConf.mjs` kFun;`test/unit-conf.test.mjs`〈F1 之判定同 wsemi isfun〉;外審 F11 |
| 2026-11-13 | 自有套件 | w-playwright | 帳本 R-PW-ONLY 之盤點正則若寫進使用端之單元測試,會因掃描範圍含測試檔本身而自我命中(樣本字串、正則字面);建議在 R-PW-ONLY 補一句作法(以程式組成樣本與正則),或由 w-playwright 提供可 deep import 之共用掃描函數,各使用端不必各寫一份 | `test/unit-pkg.test.mjs` R-PW-ONLY 兩案;`sgud/exp/experience.md` 2026-11-13 第 3 條 |
| 2026-11-13 | 自有套件 | w-playwright | R-PW-ONLY 範圍為 `.mjs`／`.js`,不含各使用端 `docs/`(jsdoc 產物,仍含舊範例);建議在帳本或 README 註明 `docs/` 於發布時重產、不列入盤點,避免使用端自行判斷 | `docs/WGuidechart.mjs.html`;`sgud/state/state.md` 已知限制 |
| 2026-11-12 | 全域技能 | role-coder-for-test(§8 之變異證據)／role-coder-for-validate | 植入「未關閉資源」(瀏覽器未 close、逾時失效)類變異時,mocha 須加 `--exit`,否則行程不退出而等到外層逾時(本次 10 分鐘);結束後以 tasklist 回驗無殘留之瀏覽器行程.建議於變異證據之作法加註 | `sgud/exp/experience.md` 第 6 條 |
