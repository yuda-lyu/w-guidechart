# w-guidechart
A tool for guide charts: on a screenshot of a web page, it frames each functional area with a red box and points to it with a two-segment gray leader line (slanted + horizontal) carrying a label.

![language](https://img.shields.io/badge/language-JavaScript-orange.svg) 
[![npm version](http://img.shields.io/npm/v/w-guidechart.svg?style=flat)](https://npmjs.org/package/w-guidechart) 
[![license](https://img.shields.io/npm/l/w-guidechart.svg?style=flat)](https://npmjs.org/package/w-guidechart) 
[![npm download](https://img.shields.io/npm/dt/w-guidechart.svg)](https://npmjs.org/package/w-guidechart) 
[![npm download](https://img.shields.io/npm/dm/w-guidechart.svg)](https://npmjs.org/package/w-guidechart) 
[![jsdelivr download](https://img.shields.io/jsdelivr/npm/hm/w-guidechart.svg)](https://www.jsdelivr.com/package/npm/w-guidechart)

## Documentation
To view documentation or get support, visit [docs](https://yuda-lyu.github.io/w-guidechart/global.html).

## Core
> 功能指引圖之取景、排版與繪製:於網頁畫面之截圖上,以紅框圈選各功能區,以雙段灰色引線(斜線＋水平線)指至四周,並於水平線上方寫功能文字。輸出 svg(內嵌截圖並加陰影,可再以 Inkscape 微調)、png,以及各標籤之排版結果(可照抄為覆寫值)。

> 瀏覽器由使用端注入(`conf.env.launchBrowser`,回傳 Playwright 相容之 Browser),取景與繪製共用,套件用完即關閉;套件執行期只依賴 `wsemi`,不依賴 `playwright`、`w-playwright`、`sharp`。使用 Chromium 系瀏覽器者,**一律經自有套件 [w-playwright](https://www.npmjs.com/package/w-playwright) 啟動**(`wpw.launchChromium()`),不直接使用 `playwright`／`playwright-core`。

> 只在 Windows 11 以 Chromium(Playwright 之 headless shell)實跑驗證;字寬以繪製時之瀏覽器量測,輸出隨使用端之瀏覽器版本與系統字型而變。

## Installation

### Using npm(ES6 module):
```alias
npm i w-guidechart
npm i w-playwright
```

1. **瀏覽器之啟動工具**:`w-playwright` 由使用端安裝(本套件不依賴它);其 `dependencies` 以精確版本帶入 `playwright-core` 1.64.1,使用端不需、也不應另裝 `playwright` 或 `playwright-core`,更**不要用 `npx playwright install`**(依賴樹中他版被提升時會下載到不同版本之瀏覽器)。
2. **受管瀏覽器之取得**(預設無頭,用 Playwright 之 headless shell):於使用端程式內執行一次 `await wpw.ensureChromium()`;需完整 Chromium 時 `await wpw.ensureChromium({ kind: 'chromium' })`。`w-playwright` 預設不自動下載(未安裝而啟動即 `E_BROWSER_MISSING`),亦可於啟動時給 `autoInstall: true`。
3. **離線環境**:於可連網之機器以同版 `w-playwright` 執行 `ensureChromium()`,把 Playwright 之瀏覽器資料夾(Windows 預設 `%LOCALAPPDATA%\ms-playwright`)複製至目標機,並以環境變數 `PLAYWRIGHT_BROWSERS_PATH` 指向該資料夾;**此變數須在載入 `w-playwright` 之前設定**(執行期改動不生效)。
4. **用真 Chrome／Edge 者須自行安裝 Google Chrome／Microsoft Edge**(`wpw.launchChromium({ channel: 'chrome' })`,Edge 為 `'msedge'`);`wpw.findSystemChrome()` 只以檔案存在判定其位置,不啟動、不代表可啟動。
5. **w-playwright 一律加入之守門參數**:Windows 上 Chromium 153 起,每啟動一個新的瀏覽器根行程,即以無效密碼替目前使用者呼叫一次 `LogonUser`(安全性紀錄 4625、錯誤密碼次數 +1;本機原則連續數次即鎖定帳號)。`w-playwright` 於每次啟動之命令列**恰給一個** `--disable-features`(Playwright 預設清單＋`AutofillAiWalletPrivatePasses`＋呼叫端自給者)以停用該行為,不提供停用此守門之選項;headless shell 本即不觸發。細節見 `w-playwright` 之 README。
6. **不支援之環境**:`PWDEBUG` 為 inspector 模式之值、`SELENIUM_REMOTE_URL` 有值時,`w-playwright` 拒絕啟動(`E_ENV`)。

> 注入之 `launchBrowser` 若以 Chromium 系瀏覽器實作,須注入 `w-playwright` 之啟動函數,不得注入未經 `w-playwright` 之啟動(會使守門失效)。本套件自身之測試亦只經 `w-playwright` 啟動 headless shell。

#### Example:
```alias
import wpw from 'w-playwright' //使用端自備(npm i w-playwright); 或任何 Playwright 相容之 Browser, 但 Chromium 系須經 w-playwright 啟動
import WGuidechart from 'w-guidechart'

await wpw.ensureChromium() //取得受管之 headless shell(只需在該機器未安裝時執行)

let conf = {
    dirWork: './guide-work', //必給; shots/、data/、svg/ 置於其下(相對路徑以 cwd 解析)
    env: { launchBrowser: () => wpw.launchChromium() }, //必給; 取景與繪製共用, 套件用完即 close
    views: [{
        name: 'home', //必給; 安全檔名, 全部 views 唯一
        open: (page, helpers) => page.goto('http://localhost:8000/'), //必給; 開到取景之狀態(資料載完、動畫停止等由此處自等)
        regions: [
            { label: '查詢列', find: { sel: '.toolbar' } },
            { label: '清單', find: { sel: '#list', mode: 'box' } },
        ],
    }],
}

let res = await WGuidechart(conf, { capture: true }) //先取景再繪製; 只改排版設定時省略 capture
//res: [{ name, w, h, issues: [{ code, msg, regions }], notes: [...], decisions: [...], files: { shot, data, layout, svg, png } }]
if (res.some((r) => r.issues.length > 0)) {
    process.exitCode = 1 //離開碼由使用端決定
}
```

## 設定檔格式

```alias
{
    dirWork, dirPng?, style?, layout?,
    capture?: { mousePark?, settle?, settleMs? },
    env: { launchBrowser, openPage?, helpers?, afterCapture? },
    views: [{
        name, open, crop?, style?, layout?,
        regions: [{ label, find, side?, ax?, anchor?, tier?, x?, dx?, join? }],
        ...使用端自有之鍵(如 cap、openOpt; 套件不讀, 原樣交給 openPage)
    }],
}
```

- `find`:`{ sel }`(第一個可見之符合元素)、`{ at: [x, y], minW?, minH? }`(該點之元素往上第一個寬高皆達門檻之祖先)、`{ fn, arg? }`(於頁面內執行之函數,回傳 `{ x1, y1, x2, y2 }` 或 null)、`{ union: [find, ...] }`(聯集;任一成員量不到即量不到);另可帶 `mode: 'fit' | 'box'`(`fit` 為可見內容之聯集,不含空白;`box` 為元素外框;元素本身無子內容者如 canvas 須用 `box`)與 `pad`(外擴像素,預設 fit 6、box 與 fn 2)。
- `style`(全域 → 各圖):`frame`、`frameW`、`lead`、`leadW`、`font`、`fs`、`textColor`、`shadow`(`null` 為不加,物件則逐鍵合併);預設見 `WGuidechart.defaultStyle`。
- `layout`(全域 → 各圖):`ext`、`spread`、`edge`、`minGap`、`join`、`gapTop`、`gapBot`、`tierGap`、`sideEdges`、`maxSlope`、`rayM`、`crossPen`、`penRight`、`penLeft`、`nearM`、`nearPen`、`movePen`、`orderPen`、`framePen`、`sideGap`、`lineGap`、`pad`、`base`、`margin`、`canvasW`;預設見 `WGuidechart.defaultLayout`。
- 功能區之覆寫:`side`(`top`、`bottom`、`left`、`right`)、`ax`(0～1)、`anchor: { edge, at }`、`tier`(0～3)、`x`、`dx`、`join`(`l`、`r`、`auto`)。
- `capture`:`mousePark`(預設 `[1000, 4]`,`null` 為不停放)、`settle`(`'stable'` 預設:字型就緒、雙 rAF 後連續兩次截圖相同才取景;`'fonts'`:只等字型就緒與雙 rAF,供持續動畫之頁面)、`settleMs`(穩定等待之上限,預設 5000;逾時 reject `E_SETTLE`)。
- `opt`:`capture`、`names`(只處理之圖名)、`debug`(警告被改用預設之鍵)、`funLog(label, info)`(進度 `capture`、`render` 與警告 `warn`;預設不輸出)、`onTrace(e)`(觀察回調,事件見下)。

## 輸入之檢測
- 全部輸入先檢完才建資料夾與起瀏覽器;必給鍵(`dirWork`、`env.launchBrowser`、`views[].name`、`open`、`regions`、`label`、`find`)無效即 reject `E_ARG`,訊息只帶路徑索引,不回顯值。
- 選填鍵(`style`、`layout`、`capture`、功能區之覆寫、`opt` 各鍵)無效時視為未給、改用預設;`opt.debug` 為 true 時經 `funLog('warn', { msg })` 或 `console.warn` 警告(不含值)。數字類收數字字串並轉為數值後使用。
- 顏色只收 `#rgb`、`#rrggbb` 與英文色名;字型名稱不得含引號與 `<>&;\`;標籤與字型只收 XML 容許且非控制字元之碼點(C0／C1 控制字元、U+FFFE／U+FFFF、孤立代理字元皆拒)。
- `find.arg` 只收可傳入頁面之值:原始值(含 NaN、±Infinity、-0、BigInt)、陣列、一般物件、Date;含存取器、循環參照、函數或其他物件者視為未給。套件以其快照傳入頁面,並以帶型別之快照核對 find 是否已變更(檢測時不呼叫其 `toJSON` 或 getter)。
- `opt.funLog`、`opt.onTrace` 之拋錯與回傳之 rejection 皆被忽略,不影響流程。

## 輸出
- `<dirWork>/shots/<名稱>.png`:取景之截圖(不含紅框)。
- `<dirWork>/data/<名稱>.json`:各功能區之框(只改排版設定時沿用,改了 `find` 即要求重新取景 `E_STALE`)。繪製時讀回並驗其格式與截圖(截圖須可完整解碼且尺寸相符),不合即 `E_DATA`。
- `<dirWork>/data/<名稱>.layout.json`:`{ name, w, h, issues, notes, decisions }`。
- `<dirWork>/svg/<名稱>.svg`、`<dirPng>/<名稱>.png`(`dirPng` 預設 `<dirWork>/png`)。
- `issues`(問題,圖照常輸出):`BOX_TOO_CLOSE`、`LABEL_OVERLAP`、`LEAD_THROUGH_LABEL`、`LEAD_CROSS`、`LEAD_COVERS_TEXT`、`LINE_OUT_OF_BAND`、`NO_PATH`、`TIER_OVERFLOW`、`CANVAS_TOO_WIDE`;`notes`(注意):`LEAD_THROUGH_BOX`(無法自動排入而穿框)、`TIER_NEAR`(該層改為靠近引線落點)、`FONT_FALLBACK`(字型不在)。

## 失敗通道
一律 reject 帶 `code` 之 `Error`:`E_ARG`、`E_VIEW_NOT_FOUND`、`E_BROWSER`、`E_OPEN`、`E_SETTLE`、`E_BOX_NOT_FOUND`、`E_NOT_CAPTURED`、`E_STALE`、`E_DATA`、`E_CROP`、`E_FS`。使用端回呼與瀏覽器之錯誤經 wsemi `maskDiagErr` 遮去網址內之帳密後掛為 `cause`。已啟動之瀏覽器於成功與失敗時皆恰關閉一次(輸入無效、只繪製而資料檔不合者不啟動瀏覽器)。

## 觀察回調(opt.onTrace)
同步呼叫、凍結之事件 `{ type, ... }`,拋錯與 rejection 皆忽略,未傳時行為不變:`view-open`、`settle-fonts`、`settle-sample { view, k, same }`、`settled { view, k }`、`settle-timeout { view, k }`、`shot`、`measured { view, region }`、`captured`、`layout { view, nIssue, nNote }`、`rendered`(各事件皆帶 `view`)。

## 信任邊界
`conf` 是程式碼。`env.launchBrowser`、`env.openPage`、`views[].open`、`env.afterCapture` 以使用端之權限於 Node 執行;`find.fn` 於被截圖之頁面內執行(經 Playwright 之 `page.evaluate` 序列化,須自足,參數經 `find.arg` 傳入,不可引用外部變數)。套件不從資料檔或網路取得任何會被執行之內容,不動態執行字串;讀回之資料檔先驗其格式,截圖路徑由圖名推得。

## 已知限制
- 字寬以繪製時之瀏覽器量測,字型不在時以替代字型量測並列注意 `FONT_FALLBACK`;以 Inkscape 開啟 svg 時之字寬可能不同。
- 頁面之 `deviceScaleFactor` 須為 1(截圖與視窗尺寸不同即 reject)。截圖帶 ICC 時裁切會轉色;以 Chromium 為準。
- 每圖功能區建議 ≤10(4 層上限;實測 Node 端之排版於合成案 n=6～16 約 0.1～1.0 秒,不隨 n 單調增加;n≥12 之合成案會有排不下之問題)。
- 只在 Windows 11 實跑,未驗證非 Windows。
