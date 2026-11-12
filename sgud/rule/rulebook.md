# 規則帳本

本檔為套件設計與開發階段之規則帳本(藍圖),為要求程式碼須長成什麼樣,或由規格產出之測試(項目/說明/流程)有哪些,包含軸、單一擁有者、已知限制、破壞性變更紀錄,以及對應是哪些測試檔案或指令等,由agent自行編列、擴充與維護.當前已做到哪些記於`sgud/state/state.md`.過長時依類型拆為`rulebook_<類型>.md`,本檔只留索引.

- 需求出處:使用端之 Gitea #133(功能指引圖之取景、排版與繪製;原型 3 檔約 900 行);設計與裁定見主控任務 20261112180920 之設計報告(7 點與 D-2、D-3).
- 測試指令:全套 `npm test`;單檔 `npx mocha --no-parallel "test/<檔>" --timeout 180000`.本套件無 `e2e-`(無使用者 UI),不開埠.
- 改動範圍 → 測試檔:`src/layout.mjs`、`genSvg.mjs`、`defaults.mjs` → `unit-layout`(另跑 L3 等價比對,見 R-GC-LAYOUT-00);頁面內函式(`*InPage.mjs`)→ `unit-measureInPage`、`unit-dist`、`api-WGuidechart`;`parseConf.mjs` → `unit-conf`;`waitSettle.mjs` → `unit-waitSettle`、`api-WGuidechart`;`WGuidechart.mjs`、`capture.mjs`、`render.mjs`、`mkErr.mjs` → `api-WGuidechart`;`toolg/gDistRollup.mjs`、`package.json` → `unit-dist`、`unit-pkg`.

## 一、排版(R-GC-LAYOUT)

排版為 Node 端純函式 `src/layout.mjs`(主控裁定 D-2:原型之頁面內 `layoutInPage` 移至 Node,頁面內只量框與量字寬);演算法與原型相同,只把字寬改為傳入、問題與注意改為 `{ code, msg, regions }`.

- **R-GC-LAYOUT-00 與原型等價**:原型 `layoutInPage`(頁面內、canvas 量字)與 `layout`(Node、字寬由同頁 `measureTextInPage` 量得)之 decisions、issues 與 notes 之訊息、w／h／ox／oy、svg 之框／引線／文字座標皆相同.不留為常駐測試(避免成為現狀指紋);改 `layout.mjs` 時重跑一次比對(腳本見主控任務資料夾 `agent-out/gc-impl-evidence/l3.mjs`,於套件根執行,需原型檔).2026-11-12 結果(外審後補定向案):標籤 439/439、案 82/82 全項相同(原型 11 案＋合成 n=6～16＋示範頁 11 組設定＋定向 13 案〔重複標籤、單一長標籤、強制 tier 0／3、x 與 dx 之邊界、強制相交、框太近、標籤相疊、anchor 左緣／底緣〕＋固定種子隨機 40 案);檢核碼除 `LEAD_COVERS_TEXT`(下方層之避讓於重排內即消除,未能構造出觸發之輸入;該段兩版逐字相同)外皆至少觸發 1 次,側別四向、框緣四向、接點 l／r、tier 0～3 皆出現.
  - 比較範圍外之刻意差異:svg 之標籤跳脫(原型 `&amp;`／`&lt;`,新版 `htmlEncode` 之數值參照)、`FONT_FALLBACK`(render 加)、未裁切時內嵌原始截圖(原型經 sharp 重新編碼;像素相同,位元組可能不同).
- 規則 1～11(預設值見 `src/defaults.mjs` 之 `defaultLayout`;測試檔 `test/unit-layout.test.mjs`,字寬注入 `字數×fs`):

| 條 | 規則 | 實作(`src/layout.mjs`) | 測試 |
|---|---|---|---|
| 01 | 一律優先排上方 1 層;不穿框之引線優先,無則穿框亦排上方 | 二、側別 `info`、`probeAny` | `R-GC-LAYOUT-01 一律優先往上排` |
| 02 | 同層間距平分且左右對稱(`spread:'even'`,`edge` 20);`'near'` 靠近落點 | `spreadTier` | `R-GC-LAYOUT-02` 2 案 |
| 03 | 總寬＋(數－1)×`minGap` 超過可用寬才對稱擴展,至多截圖寬＋2×`ext` | `spreadTier`、`fitsOne` | `R-GC-LAYOUT-03` |
| 04 | 過擠才換至下方:比較換 1～3 個之所有組合取兩層總成本最低(`movePen`) | `combos`、`topFree` 段 | `R-GC-LAYOUT-04` |
| 05 | 同層順序依起點 x 由左往右(`orderPen`);次要與框之左右位置對應(`framePen`) | `orderCost`、`prevAx` | `R-GC-LAYOUT-05、10` |
| 06 | 起點之框緣優先序:上方層上緣→右緣→左緣;下方層底緣→右緣→左緣(`penRight`、`penLeft`) | `edgeAnchors` | `R-GC-LAYOUT-06` |
| 07 | 灰線原則上不穿框,無法自動排入才穿並列注意;不貼他框(`nearM`、`nearPen`)、不相交 | `linkEval`、四、檢核 | `R-GC-LAYOUT-07` |
| 08 | 引線預設接於水平線左端(`join:'l'`) | `endsOf` | `R-GC-LAYOUT-08` |
| 09 | 下方層依斜線角度估算文字避讓,加長水平線後重排 | `textClear`、`extra` | `R-GC-LAYOUT-09` |
| 10 | 同層順序以總成本比較(6 個以內窮舉,超過逐對交換改良) | `bestOrder` | `R-GC-LAYOUT-05、10`、`R-GC-LAYOUT-10 超過 6 個` |
| 11 | 平分後無路可走之層改為靠近落點,列注意 `TIER_NEAR` | `nearSides`;左右側只在 `side` 強制,左側接點在右端 | `R-GC-LAYOUT-11`、`R-GC-OVR-01 tier、x、join…` |

- **R-GC-CHECK-01 檢核碼**:issues(不擋出圖)`BOX_TOO_CLOSE`、`LABEL_OVERLAP`、`LEAD_THROUGH_LABEL`、`LEAD_CROSS`、`LEAD_COVERS_TEXT`、`LINE_OUT_OF_BAND`、`NO_PATH`、`TIER_OVERFLOW`、`CANVAS_TOO_WIDE`;notes `LEAD_THROUGH_BOX`、`TIER_NEAR`、`FONT_FALLBACK`(render 加).`msg` 保留原型之中文句,`regions` 為功能區索引.盤點:`git grep -n "item('" src/layout.mjs`、`git grep -n "code: '" src`.測試:`unit-layout` 之 `R-GC-CHECK-01` 3 案.
- **R-GC-OVR-01 三層覆寫**:功能區 > 各圖 > 全域 > 預設;功能區鍵 `side`、`ax`、`anchor`、`tier`、`x`、`dx`、`join`.測試:`unit-layout` `R-GC-OVR-01` 2 案、`unit-conf` 覆寫列.
- **R-GC-ORDER-01 與輸入順序無關(原則 2)**:regions 經固定種子之隨機排列後,依 label 對應之 decisions、issues、notes、w、h 相同.測試:`unit-layout` `R-GC-ORDER-01`(4 組 × 4 種子);2026-11-12 另以 9 組 × 8 種子探測 72/72 相同.同成本之決勝若日後出現依輸入順序者,屬缺陷.
- **效能(L4 不適用,無 SLA)**:每圖功能區建議 ≤10;Node 端合成案 n=6/8/10/12/14/16 實測 151/997/158/112/172/191 ms(2026-11-12,不隨 n 單調);n≥12 之合成案有排不下之問題.窮舉上限 6、換向上限 3 為現行設計.

## 二、頁面內函式(R-GC-PAGE、R-GC-MEASURE)

- **R-GC-PAGE-01 自足**:經 `page.evaluate` 序列化執行之函式只能用參數與頁面全域,不得引用模組層識別字;每個模組只放該函式之 default export;不用展開、`??`、`?.`、`async`(免 rollup 轉譯注入輔助函式而於頁面內 ReferenceError).站點全集:`measureInPage`、`measureTextInPage`、`cropInPage`、`decodeInPage`、`waitFontsInPage`、`waitFramesInPage`.盤點:`git grep -n "page.evaluate(" src`(呼叫點只能傳上列 6 者或使用端之 `find.fn`);`ls src/*InPage.mjs` 須與 `unit-pkg` 之清單相同.測試:`unit-pkg` `R-GC-PAGE-01`(靜態,含站點全集之比對)、`unit-measureInPage`(src 經 page.evaluate)、`unit-dist`(dist 經全流程).
- **R-GC-MEASURE-01 量框**:`sel`、`at`＋`minW`/`minH`、`rect`(由 `find.fn` 於 Node 端先求)、`union`;`mode` `fit`(可見內容之聯集:文字、img／svg／canvas／輸入元件、字型圖示、小於容器一半之底色／漸層底／邊框／陰影元素;不足 4 像素之分隔線不計)/`box`;`pad`(只用最外層者);夾於視窗內距邊 3;寬或高 <8 為量不到.測試:`unit-measureInPage` 7 案、`api` `find.fn 為函數並以 arg 傳參`.
- **R-GC-MEASURE-02 union 收嚴**:任一成員量不到即整區量不到(原型為靜默略過;原則 3).測試:`unit-measureInPage`、`api` `R-GC-MEASURE-02`.
- **R-GC-MEASURE-03 字寬**:`ceil(measureText)`,字型字串 `${fs}px "${font}"`(與原型同);`fontOk` 以「指定字型＋泛用字型」對「只用泛用字型」三組比較判定(`document.fonts.check` 對系統字型恆回 true,不用).測試:`unit-measureInPage` `R-GC-MEASURE-03`.

## 三、輸入檢測(R-GC-ARG;dspec〈輸入參數之檢測機制〉)

- **R-GC-ARG-01 必給鍵無效即 reject `E_ARG`**,訊息 `invalid <路徑>: must be <種類描述>`,不回顯值;全部檢測先於任何副作用(V17);入口為 async,不同步拋錯(§5.1).
- **R-GC-ARG-02 選填鍵無效視為未給、改用預設(K3)**;每鍵只讀一次,讀取拋錯即無效(V11);不改寫呼叫端之物件(V9);未宣告之鍵忽略(V7).種類判定本身拋錯(可撤銷之 Proxy、拋錯之 `Symbol.toStringTag`)視為不屬該種類,不讓例外逸出;非預期之例外一律回固定詞彙之 `E_ARG`(`invalid conf: must be readable plain data`).檢測期間不呼叫使用端之方法(`find.arg` 之 `toJSON`、getter 皆不觸發;`find.fn` 之原始碼以 `Function.prototype.toString` 取).
  - 結構類(A1～A3)之容器以 `Array.isArray` 判定(不以 `Object.prototype.toString`,免被 `Symbol.toStringTag` 冒充),長度至多 100000;空洞讀為 undefined.
  - F1 之判定為 wsemi `isfun`(一般、generator、async 函數;async generator 函數不屬之),與觀察回調之取得(`getTrace`)同一判定.
- **R-GC-ARG-03 `opt.debug`**:為 true 時警告被改用預設之鍵,經 `opt.funLog('warn', { msg })` 或 `console.warn`;訊息不含值;同一次呼叫內每則只一次(本入口每批呼叫一次,不設行程層之去重——刻意不套 K3 之「每個行程只警告一次」,因其目的為逐筆呼叫之判斷函數不洗版).reject 前之警告亦交 `funLog`.
- **R-GC-ARG-04 數字字串轉為數值後使用(K4)**:以 wsemi `isenum`／`iseint` 判定,`Number(String(v).trim())` 轉換.
- **R-GC-ARG-05 暫行手寫宣告表(主控裁定 D-3,待辦)**:以 wsemi 公開之判斷函數(`isobj`、`isestr`、`isfun`、`isbol`、`isenum`、`iseint`)與 `Array.isArray` 逐鍵宣告於 `src/parseConf.mjs`,不引用 wsemi 內部之 `_optVal`;**wsemi 之公開 opt 解析函數上線後改用之**,屆時本表之語意不變.
- 盤點:`git grep -n "req(\|opt1(\|sub(" src/parseConf.mjs`(宣告點全集);`git grep -n "wsemi/src/_" src`(須 0).測試:`test/unit-conf.test.mjs`(必給 54 案經公開入口斷言訊息全文與無副作用;另 2 案 E_VIEW_NOT_FOUND 與不同步拋錯;選填 71 案;V9 1 案;debug 3 案;style、layout 每鍵之逐鍵接線 32 案〔無效值改用預設並警告恰一則、有效值採用〕;外審補案 9 案〔偽陣列、空洞、可撤銷之 Proxy、拋錯之 toStringTag、F1、XML 字元、find.arg 之核對鍵、toJSON 不被呼叫、find.arg 之 K3〕;合計 172).

### 宣告表

種類代號依 dspec §3;「必給」無效 → reject `E_ARG`;「選填」無效 → 預設(K3).

| 路徑 | 種類 | 必給 | 預設 | 備註 |
|---|---|---|---|---|
| `conf` | O1(原型為 Object 或 null) | 是 | — | |
| `conf.dirWork` | S4 路徑(S1,不含 NUL,≤4096) | 是 | — | `path.resolve`(cwd 相對) |
| `conf.dirPng` | S4 路徑 | 否 | `<dirWork>/png` | |
| `conf.env` | O1 | 是 | — | |
| `env.launchBrowser` | F1 | 是 | — | 回傳值見下列「回呼之回傳值」 |
| `env.openPage` | F1 | 否 | `browser.newPage({ viewport: 1600×900, deviceScaleFactor: 1 })` | 回傳值見下列 |
| `env.helpers` | X | 否 | undefined | 原樣交給 `open`(V8) |
| `env.afterCapture` | F1 | 否 | 不呼叫 | |
| `conf.style`、`views[i].style` | O1 | 否 | 繼承 | 非物件 → 整份視為未給 |
| `style.frame`、`lead`、`textColor` | 顏色 `#rgb`、`#rrggbb`、`^[A-Za-z]{3,20}$` | 否 | `#FF0606`、`#999999`、`#000000` | |
| `style.frameW`、`leadW` | N2 `gt:0`、`max:50` | 否 | 5、3 | |
| `style.font` | S1,≤100,無頭尾空白,不含 `"'<>&;\`;只含 XML 文字碼點(見 label) | 否 | `Microsoft JhengHei` | |
| `style.fs` | N2 `gt:0`、`max:400` | 否 | 36 | |
| `style.shadow` | `null` 或 O1 逐鍵合併:`dx`、`dy` N2 ±200;`blur` N2 0～100;`color` 顏色;`opacity` ratio | 否 | `{ dx:0, dy:4, blur:10, color:'#000000', opacity:0.35 }` | 非物件非 null → 繼承;個別鍵錯 → 該鍵繼承 |
| `conf.layout`、`views[i].layout` | O1 | 否 | 繼承 | |
| `layout.ext`、`edge`、`minGap`、`gapTop`、`gapBot`、`sideGap` | N2 0～10000 | 否 | `defaultLayout` | |
| `layout.rayM`、`nearM`、`pad`、`base`、`margin` | N2 0～1000 | 否 | 同上 | |
| `layout.crossPen`、`penRight`、`penLeft`、`nearPen`、`movePen`、`orderPen`、`framePen` | N2 0～1e9 | 否 | 同上 | |
| `layout.maxSlope` | N2 `gt:0`、`max:100` | 否 | 2.5 | |
| `layout.tierGap`、`lineGap` | `null` 或 N2 `gt:0`、`max:10000` | 否 | null | |
| `layout.spread` | S3 `even`／`near` | 否 | `even` | |
| `layout.join` | S3 `l`／`r`／`auto` | 否 | `l` | |
| `layout.sideEdges` | B1 | 否 | true | |
| `layout.canvasW` | 整數 0～16384(0 自動) | 否 | 0 | |
| `conf.capture` | O1 | 否 | `{}` | |
| `capture.mousePark` | `null` 或 `[x, y]` N2 0～100000 | 否 | `[1000, 4]` | 超出視窗者該圖不停放(debug 警告) |
| `capture.settle` | S3 `stable`／`fonts` | 否 | `stable` | |
| `capture.settleMs` | N2 `use:'timer'`、`gt:0` | 否 | 5000 | |
| `conf.views` | A2 非空,每列 O1;任一列錯即整批拒絕 | 是 | — | |
| `views[i].name` | S4 安全檔名 `^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$`,不以 `.` 或 `.layout` 結尾,非 Windows 保留名(含帶副檔名者),全部 views 唯一(不分大小寫) | 是 | — | |
| `views[i].open` | F1 | 是 | — | |
| `views[i].regions` | A2(可空) | 是 | — | |
| `views[i].crop` | `[x1,y1,x2,y2]` 整數 0～100000,x1<x2、y1<y2 | 否 | 全畫面 | 超出截圖或功能區落在裁切外 → `E_CROP`(繪製時) |
| `regions[j]` | O1 | 是 | — | |
| `regions[j].label` | S1,只含 U+0020～U+007E、U+00A0～U+D7FF、U+E000～U+FFFD 與成對之代理字元(C0／C1 控制字元、U+FFFE／U+FFFF、孤立代理字元皆拒) | 是 | — | 寫入 svg 須為 XML 1.0 容許之字元(原則 3) |
| `regions[j].find` | O1;`sel`、`at`、`fn`、`union` 恰給其一;union 深度 ≤8、不得自我參照 | 是 | — | |
| `find.sel` | S1 | 擇一 | — | |
| `find.at` | `[x, y]` N2 0～100000 | 擇一 | — | |
| `find.fn` | F1 | 擇一 | — | 原型之字串函式本體不收 |
| `find.arg` | 可傳入頁面之值:原始值(含 NaN、±Infinity、-0、BigInt)、真陣列、一般物件、Date;只讀自有之資料屬性,深度 ≤32、陣列長 ≤100000;存取器、循環參照、函數、Symbol、其他物件皆無效 | 否 | undefined | 取快照傳入頁面(檢測之值即使用之值);核對鍵帶型別標記(NaN 與 null、1n 與 2n、-0 與 0 皆不同) |
| `find.union` | A2 非空,元素為 find | 擇一 | — | |
| `find.mode` | S3 `fit`／`box` | 否 | `fit` | |
| `find.pad` | N2 0～1000 | 否 | box 與 fn 為 2,其餘 6 | 只用最外層者 |
| `find.minW`、`minH` | N2 0～100000 | 否 | 0 | |
| `regions[j].side` | S3 `top`／`bottom`／`left`／`right` | 否 | 自動 | |
| `regions[j].ax` | ratio | 否 | 0.5 | |
| `regions[j].anchor` | O1 `{ edge: S3, at: ratio }` | 否 | 自動 | 任一鍵錯 → 整個 anchor 視為未給 |
| `regions[j].tier` | 整數 0～3 | 否 | 自動 | |
| `regions[j].x`、`dx` | N2 ±100000 | 否 | 自動、0 | |
| `regions[j].join` | S3 `l`／`r`／`auto` | 否 | `layout.join` | |
| `opt` | O1 | 否 | `{}` | |
| `opt.capture`、`opt.debug` | B1 | 否 | false | |
| `opt.names` | A3 元素 S1 | 否 | 全部 | 型別錯 → 預設;名稱不存在 → `E_VIEW_NOT_FOUND`(引用不到,原則 3) |
| `opt.funLog`、`opt.onTrace` | F1 | 否 | 無 | |
| 未宣告之鍵 | — | — | — | 忽略(V7) |

回呼之回傳值與讀回之資料檔(皆為套件之輸入):

| 來源 | 種類 | 無效之處置 |
|---|---|---|
| `launchBrowser()` 之回傳 | 物件,其 `newPage`、`close` 為函數(各讀一次,讀取拋錯視為缺) | `E_BROWSER`;讀得到 `close` 者仍關閉之 |
| `openPage()` 之回傳(或預設之 `browser.newPage`) | 物件,`screenshot`、`evaluate`、`viewportSize` 為函數;`viewportSize()` 非 null(固定視窗) | `E_OPEN` |
| `page.screenshot()` 之回傳 | U1 二進位(`Uint8Array`,含 Buffer);取景截圖之寬高須等於視窗(deviceScaleFactor 為 1) | 非二進位 → `E_BROWSER`;尺寸不符 → `E_OPEN` |
| `find.fn` 經 `page.evaluate` 之回傳 | `null`/`undefined`(量不到)或一般物件,`x1`、`y1`、`x2`、`y2` 為 N3 嚴格數字(有限之原始 number;Playwright 回傳之值無數字字串之需),各讀一次以快照檢測與使用 | `E_BOX_NOT_FOUND` |
| `data/<名稱>.json` | 一般物件;`size.width`、`size.height` 為整數 1～100000(N2,數字字串轉換);`regions` 為真陣列,每列 `findKey` 為字串、`box` 四值為 N2(轉換後使用) | `E_DATA`(非 JSON 亦同) |
| `shots/<名稱>.png` | 可完整解碼之 PNG(於繪製頁以 `img.decode()` 驗),寬高等於 `size` | `E_DATA` |

- **R-GC-DATA-01 讀回之資料檔亦為輸入**:依上表驗 schema 與截圖 → 否則 `E_DATA`;截圖路徑由名稱推得,不取資料檔之 `shot` 欄;find 之核對鍵(正規化後之 find,`fn` 以 `Function.prototype.toString` 之原始碼、`arg` 以帶型別標記之快照鍵,只比較不執行)不符 → `E_STALE`;未取景 → `E_NOT_CAPTURED`.只繪製時於起瀏覽器前先驗(解碼之驗於繪製頁).測試:`api` `R-GC-DATA-01` 4 案(改 find／未取景、schema 與 shot 欄、數字字串之資料、破損之截圖).
- **R-GC-CROP-01**:裁切於繪製頁內以 canvas `drawImage` 完成(移除 sharp);超出截圖或功能區(夾後寬或高 <8)落在裁切外 → `E_CROP`.測試:`api` `R-GC-CROP-01`、`unit-measureInPage` `R-GC-RENDER-02`(與同區截圖之像素逐位元組相同).

## 四、穩定等待與觀察回調(R-GC-SETTLE、R-GC-TRACE;dspec〈計時器相關函數之觀察回調與測試〉)

- **R-GC-SETTLE-01**(`src/waitSettle.mjs`):`document.fonts.ready` → 雙 rAF → 截圖;`settle:'stable'` 時再「雙 rAF → 截圖 → 與前一張逐位元組比對」直到相同;`'fonts'` 時不比對.`settleMs` 為整段上限(真實計時器),逾時 reject `E_SETTLE`(不出圖,原則 1);兩道防線各管一事:①每個頁面操作與上限之計時器競速(操作卡住永不完成時,於上限即 reject);②每步開始前比對時刻(操作皆立即完成而不讓出給計時器時,仍於上限停止).逾時後仍在進行之頁面操作之 rejection 已吸收.截圖之回傳須為二進位,否則 `E_BROWSER`(不回顯值).取景之截圖即最後一張.應用層之就緒(資料載完、地圖靜止)由使用端寫在 `open` 內.
- **R-GC-TRACE-01**:`opt.onTrace` 經 wsemi `getTrace`(單一擁有者);事件 `view-open`、`settle-fonts`、`settle-sample { view, k, same }`、`settled { view, k }`、`settle-timeout { view, k }`、`shot`、`measured { view, region }`、`captured`、`layout { view, nIssue, nNote }`、`rendered`;皆帶 `view`(圖名);凍結、同步、拋錯與 rejection 忽略、未傳時不組事件.盤點:`git grep -n "trace('" src`.
- 測試(以事件與入口之完成同步,無固定等待):`api` `R-GC-SETTLE-01` 2 案(持續動畫之頁,測試於觀察到第一個 `same:false` 事件後才停止動畫——停止時點由事件決定,不以「動 N 影格自停」,因後者依賴「動畫比 Node 端往返久」之時間假設;斷言其後才 settled、截圖為最終態;持續動畫加 `settleMs:300` → `E_SETTLE` 與 `settle-timeout`;`settle:'fonts'` 不比對;不表達規格之上限一律給 120000 只防懸置)、`R-GC-TRACE-01`(五種回調結果相同、`this` 為 undefined);`unit-waitSettle` 5 案(可控之頁面替身:A、B、B 之比對語意;fonts;防線①操作永不完成 → E_SETTLE 且其後之 rejection 不成為未處理;防線②操作立即完成 → E_SETTLE;非二進位之截圖與操作拋錯 → E_BROWSER).變異證據(2026-11-12):固定等待 800ms、不比對截圖、上限失效、回調不隔離、只移除防線①、只移除防線②、不驗截圖之二進位 皆轉紅(防線②之變異使測試行程陷入無限之微任務迴圈而以 134 結束,亦屬未通過).首版曾有之「逾時旗標」與競速重疊(只移除競速者存活、只移除旗標者為等價變異),外審後移除旗標、改為時刻比對之防線②.非缺陷之時序變異(取景於 open 後延遲 1.5 秒):舊之「動 60 影格自停」設計 0/3、現行設計 3/3.負載試驗:本輪未做(派工未列).

## 五、入口、失敗通道與信任邊界

- **R-GC-API-01**:只 `export default WGuidechart`;靜態 `defaultStyle`、`defaultLayout` 為深凍結之複本;不提供 `runCli`(行程層之政策歸使用端,〈wsemi收錄原則〉§二).測試:`unit-pkg` `R-GC-API-01`、`unit-dist`.
- **R-GC-ERR-01**:一律 reject 帶 `code` 之 Error(`E_ARG`、`E_VIEW_NOT_FOUND`、`E_BROWSER`、`E_OPEN`、`E_SETTLE`、`E_BOX_NOT_FOUND`、`E_NOT_CAPTURED`、`E_STALE`、`E_DATA`、`E_CROP`、`E_FS`);訊息為固定英文詞彙只帶路徑索引;外來錯誤(使用端回呼、瀏覽器)經 wsemi `maskDiagErr`(秘密來源為空,只依內建樣式遮網址帳密)後掛 `cause`;已啟動之瀏覽器於成功與失敗皆恰關閉一次(以首次讀得之 `close` 呼叫);`opt.funLog` 之同步拋錯與回傳之 rejection 皆吸收.盤點:`git grep -n "mkErr('" src`.測試:`api` `R-GC-ERR-01`、各 reject 案之關閉次數.
- **R-GC-FLOW-01～04**:流程(檢測 → names → 只繪製時先驗資料 → 建資料夾 → launchBrowser → 取景 → 繪製 → 關閉);輸出 5 檔;png 寬＝截圖寬＋2×ext;`funLog` 收 `capture`、`render`、`warn`,預設不寫 console(〈診斷輸出與遮罩〉D2).測試:`api` `R-GC-FLOW-01～04`.
- **R-GC-TRUST-01 信任邊界**:conf 為程式碼;`launchBrowser`、`openPage`、`open`、`afterCapture` 於 Node 以使用端權限執行;`find.fn` 經 `page.evaluate(fn, arg)` 於被截圖之頁面內執行;套件內無 `new Function`、`eval`,不從資料檔或網路取得會被執行之內容.盤點:`git grep -n "new Function\|eval(" src`(須 0).測試:`unit-pkg` `R-GC-PKG-01`.README 〈信任邊界〉.
- **R-GC-SVG-01**:標籤以 wsemi `htmlEncode`;顏色與字型先過白名單、寫入時再 `htmlEncode`;數值為檢測後之 number.測試:`unit-layout`、`api` `R-GC-SVG-01`.
- **R-GC-RENDER-01**:字型不在時 notes 加 `FONT_FALLBACK`.測試:`api` `R-GC-RENDER-01`.

## 六、套件與建置(R-GC-PKG、R-GC-DIST)

- **R-GC-PKG-01**:`dependencies` 只有 `wsemi`(層級 4);`playwright` 列 devDependencies 供測試;不依 sharp;`scripts` 之測試類只有 `test`.測試:`unit-pkg`.
- **R-GC-DIST-01**:`toolg/gDistRollup.mjs` 依〈自有套件之發布與建置腳本〉標準寫法(`'./src'`、`'./dist'`,`fns: 'WGuidechart.mjs'`,`runin: 'nodejs'`,external／globals 只有 `fs`、`path`);測試以副本指定 cwd 執行該腳本,再以 dist 跑合成頁全流程(含裁切),layout.json、截圖、svg 與 src 相同.測試:`unit-dist` 4 案.

## 七、破壞性變更紀錄(相對原型)

原型未發布,依原則 14 不設相容層:具名匯出 8 個 → default 1 個;`runCli` 刪除;`find.fn` 由字串改函數＋`arg`;issues、notes 由字串改物件;union 收嚴;`settleMs` 由固定等待改上限(預設 5000);`dirPng`、`env.openPage` 改選填;繪製亦用注入之瀏覽器;進度改經 `funLog`.
