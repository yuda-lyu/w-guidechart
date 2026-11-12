# 累積經驗

本檔為執行工作時特有之累積經驗,留給後續之嘗試、執行與判斷,由agent自行編列、擴充與維護.過長時抽出舊者為`experience_<年月日>.md`,並於本檔註明何時抽出.

## 2026-11-12 首版實作(Gitea #133)

1. **排版移至 Node 之等價比對法**:原型之頁面內排版只在 `tw()` 用到瀏覽器(canvas 量字),故以「同一頁量得之字寬」傳入 Node 端之 `layout`,與原型逐案比 decisions、issues／notes 之訊息、w／h／ox／oy 與 svg 之框／引線／文字座標;69 案全同.改 `layout.mjs` 時應重跑此比對,不以單元測試之綠燈代替(單元測試之字寬為注入之確定值,不涵蓋真實字寬).
2. **`document.fonts.check` 不能判斷系統字型是否存在**(對不在 FontFaceSet 之字型恆回 true);改以 canvas 量同一字串比較「指定字型＋泛用字型」與「只用泛用字型」,三種泛用字型皆相同者視為不在.
3. **fit 量框對無子內容之元素(canvas、按鈕本身)量不到**:fit 只取根元素之子孫與文字,根本身不計;canvas 圖區、按鈕外框要用 `mode: 'box'`.示範頁之登出鈕即以 union 之成員 `mode: 'box'` 量.
4. **reject 前之 debug 警告要交 funLog**:檢測失敗時若不回傳已解析之 opt,警告會落到 console.warn;已由 `unit-conf` 之警告案抓到(先紅後綠).
5. **穩定等待之兩道防線須各有測試**:首版之「逾時旗標」與競速之 deadline 重疊(微任務之續行先於計時器之巨任務,旗標於步首永不為真,只移除旗標為等價變異;只移除競速則真頁面之測試仍綠),外審指出後改為:①競速(操作卡住時)②步首比對時刻(操作立即完成而不讓出時),並以可控之頁面替身(`unit-waitSettle`)各測一案,兩種變異皆轉紅.
6. **變異試驗之 mocha 須加 `--exit`**:植入「reject 路徑不關閉瀏覽器」或「逾時失效」之變異後,未關之瀏覽器使 mocha 行程不退出,spawnSync 等到其逾時(10 分);加 `--exit` 並於結束後以 tasklist 確認無殘留之 `chrome-headless-shell.exe`.
7. **穩定等待之測試不可讓動畫「動 N 影格自停」**:看似以影格計而非時間,實則 Node 端之往返(open 後至第一次截圖)若被擱置超過 N 影格,第一張截圖已是最終態,「settled 前至少 1 次 same:false」即不成立;以取景前延遲 1.5 秒之變異驗得舊設計 0/3.改由測試於觀察到第一個 `same:false` 事件後才停止動畫(3/3).
8. **檢測期間不得呼叫使用端之方法**:以 `JSON.stringify` 建 `find.arg` 之核對鍵會觸發其 `toJSON`(且 NaN 與 null、BigInt 等相撞);改以只讀自有資料屬性、帶型別標記之快照建鍵,並以快照傳入頁面.`String(fn)` 會呼叫使用端之 `toString`,改用 `Function.prototype.toString.call(fn)`.
9. **編輯工具會把字串參數內之 `\uXXXX`(非代理字元者)解碼為字面字元**:寫正規式之字元範圍時改以碼點比較(`codePointAt`),或以腳本產生跳脫;交付前以碼點掃描原始檔有無不可見字元.
10. **eslint `--ext .mjs`**:本套件之 eslint 8 對資料夾預設只掃 `.js`,lint 指令須帶 `--ext .mjs`(`npx eslint --ext .mjs src test toolg/gDistRollup.mjs`).
