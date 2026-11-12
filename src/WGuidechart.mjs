import fs from 'fs'
import isfun from 'wsemi/src/isfun.mjs'
import getTrace from 'wsemi/src/getTrace.mjs'
import mkErr from './mkErr.mjs'
import parseConf from './parseConf.mjs'
import captureView from './capture.mjs'
import { readData, renderViews } from './render.mjs'
import { defaultStyle, defaultLayout } from './defaults.mjs'


let deepFreeze = (o) => {
    if (o && typeof o === 'object') {
        Object.values(o).forEach(deepFreeze)
        Object.freeze(o)
    }
    return o
}


/**
 * 功能指引圖之取景、排版與繪製: 於網頁畫面之截圖上, 以紅框圈選各功能區, 以雙段灰色引線(斜線＋水平線)指至四周, 並於水平線上方寫功能文字
 *
 * 流程: 檢測全部輸入(無效即 reject E_ARG, 無任何副作用) → 解析 opt.names → (未取景時先驗資料檔) → 建立輸出資料夾 → env.launchBrowser() →
 * opt.capture 為 true 時逐圖取景(截圖不含紅框並量框, 寫 <dirWork>/shots/<名稱>.png、data/<名稱>.json) → 逐圖繪製(寫 svg/<名稱>.svg、<dirPng>/<名稱>.png、data/<名稱>.layout.json) → 關閉瀏覽器(恰一次, 含 reject 路徑)
 *
 * 信任邊界: conf 為程式碼。env.launchBrowser、env.openPage、view.open、env.afterCapture 以使用端之權限於 Node 執行, find.fn 於被截圖之頁面內執行(經 Playwright 之 page.evaluate 序列化, 須自足, 參數經 find.arg 傳入);
 * 套件不從資料檔或網路取得任何會被執行之內容, 不動態執行字串。瀏覽器由使用端注入(Playwright 相容之 Browser), 套件執行期不依賴 playwright
 *
 * 失敗通道: 一律 reject Error 並帶 code(E_ARG、E_VIEW_NOT_FOUND、E_BROWSER、E_OPEN、E_SETTLE、E_BOX_NOT_FOUND、E_NOT_CAPTURED、E_STALE、E_DATA、E_CROP、E_FS);
 * 訊息為固定英文詞彙且只帶路徑索引(如 invalid conf.views[2].name: must be a safe file name …), 不回顯輸入值; 使用端回呼或瀏覽器之錯誤經 wsemi maskDiagErr 後掛為 cause。
 * 排版之「問題」不 reject: 圖照常輸出, 問題列於 issues(使用端自行決定離開碼)
 *
 * 輸入之種類(dspec〈輸入參數之檢測機制〉; 全表見 README 與 sgud/rule/rulebook.md 之 R-GC-ARG): conf 之必給鍵無效即 reject E_ARG; 選填鍵(含 style、layout、capture、功能區之覆寫、opt 各鍵)無效時視為未給、改用預設, opt.debug 為 true 時經 opt.funLog('warn', { msg }) 或 console.warn 警告(不含值)
 *
 * Unit Test: {@link https://github.com/yuda-lyu/w-guidechart/blob/master/test/api-WGuidechart.test.mjs Github}
 * @param {Object} conf 輸入設定物件(一般物件, 必給)
 * @param {String} conf.dirWork 輸入工作資料夾字串(路徑, 必給; 相對路徑以 cwd 解析), shots/、data/、svg/ 置於其下
 * @param {String} [conf.dirPng] 輸入 png 輸出資料夾字串(路徑), 預設 <dirWork>/png
 * @param {Object} conf.env 輸入環境物件(必給)
 * @param {Function} conf.env.launchBrowser 輸入啟動瀏覽器函數(必給), 回傳 Playwright 相容之 Browser(須有 newPage、close); 取景與繪製共用, 套件用完即 close
 * @param {Function} [conf.env.openPage] 輸入開頁函數(browser, view) => page(view 為使用端之原物件), 預設 browser.newPage({ viewport: 1600×900, deviceScaleFactor: 1 }); 頁面之 deviceScaleFactor 須為 1(截圖與視窗尺寸不同即 reject E_OPEN); 每圖取景後關閉該頁之 context
 * @param {*} [conf.env.helpers] 輸入任意值, 原樣交給 view.open 之第 2 參數
 * @param {Function} [conf.env.afterCapture] 輸入取景後之回呼(page) => {}, 預設不呼叫
 * @param {Object} [conf.style] 輸入全域樣式(鍵見 WGuidechart.defaultStyle), 各鍵無效改用預設; shadow 為 null 不加陰影, 為物件則逐鍵合併
 * @param {Object} [conf.layout] 輸入全域排版設定(鍵見 WGuidechart.defaultLayout), 各鍵無效改用預設
 * @param {Object} [conf.capture] 輸入取景設定
 * @param {Array|null} [conf.capture.mousePark=[1000, 4]] 輸入取景前滑鼠停放之點 [x, y](非負數), null 為不停放; 超出視窗者該圖不停放
 * @param {String} [conf.capture.settle='stable'] 輸入穩定之判定, 'stable' 為字型就緒、雙 rAF 後連續兩次截圖相同; 'fonts' 為只等字型就緒與雙 rAF(供持續動畫之頁面)
 * @param {Number} [conf.capture.settleMs=5000] 輸入穩定等待之上限毫秒(正數, 至多 2147483647), 逾時 reject E_SETTLE
 * @param {Array} conf.views 輸入各圖之陣列(非空, 必給), 每圖 { name, open, regions, crop, style, layout }, 其餘鍵(如 cap)套件不讀
 * @param {String} conf.views[].name 輸入圖名(安全檔名: 英數開頭, 只含英數與 . _ -, 至多 100 字元, 非 Windows 保留名, 不以 . 或 .layout 結尾; 全部 views 唯一, 不分大小寫)
 * @param {Function} conf.views[].open 輸入開至取景狀態之函數(page, helpers) => Promise
 * @param {Array} conf.views[].regions 輸入功能區陣列(可空), 每區 { label, find, side, ax, anchor, tier, x, dx, join }
 * @param {Array} [conf.views[].crop] 輸入裁切 [x1, y1, x2, y2](非負整數, x1<x2、y1<y2), 預設全畫面; 超出截圖或功能區落在裁切外時 reject E_CROP
 * @param {Object} [opt={}] 輸入設定物件, 非一般物件視為 {}
 * @param {Boolean} [opt.capture=false] 輸入是否先取景再繪製
 * @param {Array} [opt.names] 輸入只處理之圖名陣列, 預設全部; 有不存在之名稱時 reject E_VIEW_NOT_FOUND
 * @param {Boolean} [opt.debug=false] 輸入是否警告被改用預設之鍵
 * @param {Function} [opt.funLog] 輸入進度與警告之接收函數(label, info) => {}, label 為 'capture'、'render'、'warn'; 預設不輸出
 * @param {Function} [opt.onTrace] 輸入觀察回調(e) => {}, e 為凍結之 { type, ... }; type 為 view-open、settle-fonts、settle-sample、settled、settle-timeout、shot、measured、captured、layout、rendered; 預設 null
 * @returns {Promise} 回傳 Promise, resolve 為各圖之結果陣列 [{ name, w, h, issues, notes, decisions, files: { shot, data, layout, svg, png } }], issues、notes 為 [{ code, msg, regions }]; reject 為帶 code 之 Error
 * @example
 *
 * import { chromium } from 'playwright' //使用端自備
 * import WGuidechart from 'w-guidechart'
 *
 * let conf = {
 *     dirWork: './guide-work',
 *     env: { launchBrowser: () => chromium.launch() },
 *     views: [{
 *         name: 'home',
 *         open: (page) => page.goto('http://localhost:8000/'),
 *         regions: [{ label: '查詢列', find: { sel: '.toolbar' } }],
 *     }],
 * }
 * let res = await WGuidechart(conf, { capture: true })
 * if (res.some((r) => r.issues.length > 0)) {
 *     process.exitCode = 1
 * }
 *
 */
async function WGuidechart(conf, opt) {
    let P = parseConf(conf, opt)
    let funLog = P.o.funLog
    //呼叫使用端之 funLog: 同步拋錯與回傳之 rejection 皆吸收(不影響本流程、不產生未處理之 rejection)
    let callLog = (label, info) => {
        try {
            let r = funLog(label, info)
            if (r && typeof r.then === 'function') {
                r.then(null, () => {})
            }
        }
        catch (err) {} // eslint-disable-line no-empty
    }
    let emit = (msg) => {
        if (funLog) {
            callLog('warn', { msg })
        }
        else {
            console.warn(msg)
        }
    }
    P.warns.forEach(emit)
    if (P.err) {
        throw P.err
    }
    let { cfg, o } = P
    let trace = getTrace({ onTrace: o.onTrace })
    let log = (label, info) => {
        if (funLog) {
            callLog(label, info)
        }
    }
    let warned = new Set()
    let warn = (p, desc) => {
        let msg = `[w-guidechart] invalid ${p}: must be ${desc}`
        if (o.debug && !warned.has(msg)) {
            warned.add(msg)
            emit(msg)
        }
    }

    //圖之選取(引用不到即拒絕)
    let views = cfg.views
    if (o.names && o.names.length > 0) {
        o.names.forEach((s, k) => {
            if (!views.some((v) => v.name === s)) {
                throw mkErr('E_VIEW_NOT_FOUND', `view not found: opt.names[${k}]`)
            }
        })
        views = views.filter((v) => o.names.includes(v.name))
    }

    //只繪製時, 先驗資料檔(未取景、已過期、裁切不合者不起瀏覽器)
    let pre = {}
    if (!o.capture) {
        for (let v of views) {
            pre[v.name] = readData(cfg, v)
        }
    }

    try {
        Object.values(cfg.dirs).forEach((d) => fs.mkdirSync(d, { recursive: true }))
    }
    catch (err) {
        throw mkErr('E_FS', 'creating output folders failed', err)
    }

    let browser = null
    try {
        browser = await cfg.env.launchBrowser()
    }
    catch (err) {
        throw mkErr('E_BROWSER', 'conf.env.launchBrowser failed', err)
    }
    //回傳之瀏覽器: newPage、close 各只讀一次(讀取拋錯視為缺); 缺者 reject E_BROWSER, 讀得到 close 者仍關閉之
    let fClose = null
    let okNew = false
    try {
        fClose = browser ? browser.close : null
    }
    catch (err) {
        fClose = null
    }
    try {
        okNew = !!browser && isfun(browser.newPage)
    }
    catch (err) {
        okNew = false
    }
    let closeBrowser = async () => {
        try {
            await fClose.call(browser)
        }
        catch (err) {} // eslint-disable-line no-empty
    }
    if (!okNew || !isfun(fClose)) {
        if (isfun(fClose)) {
            await closeBrowser()
        }
        throw mkErr('E_BROWSER', 'conf.env.launchBrowser must resolve to a browser with newPage and close')
    }
    try {
        if (o.capture) {
            for (let v of views) {
                await captureView({ browser, cfg, v, trace, log, warn })
            }
        }
        return await renderViews({ browser, cfg, views, pre, trace, log })
    }
    finally {
        await closeBrowser()
    }
}


//靜態屬性: 預設樣式與排版設定之深凍結複本(不加具名匯出)
WGuidechart.defaultStyle = deepFreeze(JSON.parse(JSON.stringify(defaultStyle)))
WGuidechart.defaultLayout = deepFreeze(JSON.parse(JSON.stringify(defaultLayout)))


export default WGuidechart
