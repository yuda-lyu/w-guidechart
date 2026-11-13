//公開入口 WGuidechart 之整合測試: 真 Chromium(headless shell; launchBrowser 為經 w-playwright 之真啟動, 外包一層只計關閉次數; 接縫不用替身)加真檔案系統, 合成之示範頁
//  每條斷言註明對應之帳本條目(sgud/rule/rulebook.md); 等待之測試以觀察回調之事件與入口之完成為同步點, 不以延時
import fs from 'fs'
import path from 'path'
import assert from 'assert'
import WGuidechart from '../src/WGuidechart.mjs'
import { demoHtml, animHtml, demoRegions } from './tools/demoPage.mjs'
import { launchTestBrowser, makeLauncher, makeRecorder } from './tools/launch.mjs'
import { pngSizeOf } from './tools/png.mjs'


let fdTmp = path.resolve('./test/_tmp/api')
let mkConf = (name, launchBrowser, more = {}) => ({
    dirWork: path.join(fdTmp, name),
    env: { launchBrowser },
    views: [{ name: 'demo-main', open: (page) => page.setContent(demoHtml()), regions: demoRegions() }],
    ...more,
})
let readJson = (fp) => JSON.parse(fs.readFileSync(fp, 'utf8'))
let rejectOf = async (pm) => {
    try {
        await pm
    }
    catch (err) {
        return err
    }
    throw new Error('must reject')
}


describe('api-WGuidechart', function() {

    let browser = null //測試自用(解析 svg、比對截圖)
    let ref = null //示範頁之取景結果(供只繪製、過期等案共用)

    before(async function() {
        fs.rmSync(fdTmp, { recursive: true, force: true })
        browser = await launchTestBrowser()
    })

    after(async function() {
        await browser.close()
        fs.rmSync(fdTmp, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 })
        try {
            fs.rmdirSync(path.resolve('./test/_tmp')) //尚有其他測試之暫存時非空, 略過
        }
        catch (err) {} // eslint-disable-line no-empty
    })

    it('R-GC-FLOW-01 示範頁全流程: 5 檔皆在且為絕對路徑; png 寬＝截圖寬＋2×ext; issues 為空; layout.json 與回傳一致; svg 可解析; 瀏覽器恰關閉一次', async function() {
        let lc = makeLauncher()
        let conf = mkConf('flow', lc.launchBrowser)
        let res = await WGuidechart(conf, { capture: true })
        assert.strictEqual(res.length, 1)
        let r = res[0]
        assert.strictEqual(r.name, 'demo-main')
        for (let k of ['shot', 'data', 'layout', 'svg', 'png']) {
            assert.ok(path.isAbsolute(r.files[k]) && fs.existsSync(r.files[k]), k)
        }
        assert.strictEqual(r.files.png, path.join(conf.dirWork, 'png', 'demo-main.png')) //dirPng 預設 <dirWork>/png
        assert.deepStrictEqual(pngSizeOf(r.files.shot), { width: 1600, height: 900 })
        assert.strictEqual(pngSizeOf(r.files.png).width, 1600 + 2 * 100) //畫布寬＝截圖寬＋2×ext(驗證建議 2)
        assert.deepStrictEqual(pngSizeOf(r.files.png), { width: r.w, height: r.h })
        assert.deepStrictEqual(r.issues, []) //示範頁之問題為 0
        let lj = readJson(r.files.layout)
        assert.deepStrictEqual(lj, { name: r.name, w: r.w, h: r.h, issues: r.issues, notes: r.notes, decisions: r.decisions })
        assert.deepStrictEqual(r.decisions.map((d) => d.label), demoRegions().map((g) => g.label)) //decisions 依功能區之順序
        let svg = fs.readFileSync(r.files.svg, 'utf8')
        let p = await browser.newPage()
        let nErr = await p.evaluate((s) => new DOMParser().parseFromString(s, 'image/svg+xml').getElementsByTagName('parsererror').length, svg)
        await p.close()
        assert.strictEqual(nErr, 0)
        assert.strictEqual((svg.match(/<rect x=/g) || []).length, demoRegions().length) //每功能區一個紅框
        let d = readJson(r.files.data)
        assert.strictEqual(d.regions.length, demoRegions().length)
        assert.deepStrictEqual(lc.st, { launched: 1, closed: 1 })
        ref = { conf, res }
    })

    it('R-GC-FLOW-02 只繪製(不取景)時沿用 data/, 不重寫截圖與資料檔, 結果與取景時相同; 改了功能文字或排版不必重新取景', async function() {
        let fpShot = ref.res[0].files.shot
        let fpData = ref.res[0].files.data
        let b0 = fs.readFileSync(fpShot)
        let d0 = fs.readFileSync(fpData, 'utf8')
        let lc = makeLauncher()
        let res = await WGuidechart({ ...ref.conf, env: { launchBrowser: lc.launchBrowser } })
        assert.deepStrictEqual(res[0].decisions, ref.res[0].decisions)
        assert.ok(Buffer.compare(fs.readFileSync(fpShot), b0) === 0)
        assert.strictEqual(fs.readFileSync(fpData, 'utf8'), d0)
        let rs = demoRegions()
        rs[0].label = '標題'
        let res2 = await WGuidechart({ ...ref.conf, layout: { spread: 'near' }, views: [{ ...ref.conf.views[0], regions: rs }], env: { launchBrowser: lc.launchBrowser } })
        assert.strictEqual(res2[0].decisions[0].label, '標題')
        assert.deepStrictEqual(lc.st, { launched: 2, closed: 2 })
    })

    it('R-GC-DATA-01 改了 find → reject E_STALE; 未取景 → E_NOT_CAPTURED; 皆不起瀏覽器', async function() {
        let lc = makeLauncher()
        let rs = demoRegions()
        rs[1].find = { sel: '#hdr .user' }
        let e1 = await rejectOf(WGuidechart({ ...ref.conf, views: [{ ...ref.conf.views[0], regions: rs }], env: { launchBrowser: lc.launchBrowser } }))
        assert.strictEqual(e1.code, 'E_STALE')
        assert.strictEqual(e1.message, 'regions (find) changed since capture, run with opt.capture: conf.views[0]')
        let e2 = await rejectOf(WGuidechart({ ...ref.conf, views: [{ ...ref.conf.views[0], name: 'other' }], env: { launchBrowser: lc.launchBrowser } }))
        assert.strictEqual(e2.code, 'E_NOT_CAPTURED')
        assert.deepStrictEqual(lc.st, { launched: 0, closed: 0 })
    })

    it('R-GC-DATA-01 資料檔之 schema 不合 → E_DATA; 截圖路徑不取資料檔之 shot 欄', async function() {
        let dirWork = path.join(fdTmp, 'data')
        fs.mkdirSync(path.join(dirWork, 'data'), { recursive: true })
        fs.mkdirSync(path.join(dirWork, 'shots'), { recursive: true })
        fs.copyFileSync(ref.res[0].files.shot, path.join(dirWork, 'shots', 'demo-main.png'))
        let d = readJson(ref.res[0].files.data)
        d.shot = '../../../elsewhere.png' //不被讀取
        fs.writeFileSync(path.join(dirWork, 'data', 'demo-main.json'), JSON.stringify(d))
        let lc = makeLauncher()
        let res = await WGuidechart({ ...ref.conf, dirWork, env: { launchBrowser: lc.launchBrowser } })
        assert.deepStrictEqual(res[0].decisions, ref.res[0].decisions)
        d.regions[0].box.x1 = 'x'
        fs.writeFileSync(path.join(dirWork, 'data', 'demo-main.json'), JSON.stringify(d))
        let e = await rejectOf(WGuidechart({ ...ref.conf, dirWork, env: { launchBrowser: lc.launchBrowser } }))
        assert.strictEqual(e.code, 'E_DATA')
        fs.writeFileSync(path.join(dirWork, 'data', 'demo-main.json'), '{bad')
        let e2 = await rejectOf(WGuidechart({ ...ref.conf, dirWork, env: { launchBrowser: lc.launchBrowser } }))
        assert.strictEqual(e2.code, 'E_DATA')
    })

    it('R-GC-FLOW-03 opt.names 只處理子集; 結果與檔案只含該圖', async function() {
        let lc = makeLauncher()
        let conf = mkConf('names', lc.launchBrowser)
        conf.views.push({ name: 'demo-b', open: (page) => page.setContent(demoHtml()), regions: demoRegions().slice(0, 2) })
        let res = await WGuidechart(conf, { capture: true, names: ['demo-b'] })
        assert.deepStrictEqual(res.map((r) => r.name), ['demo-b'])
        assert.deepStrictEqual(fs.readdirSync(path.join(conf.dirWork, 'png')), ['demo-b.png'])
        assert.deepStrictEqual(lc.st, { launched: 1, closed: 1 })
    })

    it('R-GC-CROP-01 crop: 輸出寬＝裁切寬＋2×ext; 裁切超出截圖或功能區落在裁切外 → E_CROP', async function() {
        let lc = makeLauncher()
        let conf = mkConf('crop', lc.launchBrowser)
        conf.views[0].name = 'demo-crop'
        conf.views[0].crop = [300, 100, 1400, 800]
        conf.views[0].regions = demoRegions().filter((g) => ['查詢列', '圖區', '分頁列'].includes(g.label))
        let res = await WGuidechart(conf, { capture: true })
        assert.strictEqual(pngSizeOf(res[0].files.png).width, 1100 + 2 * 100)
        let svg = fs.readFileSync(res[0].files.svg, 'utf8')
        let m = svg.match(/<image x="[^"]+" y="[^"]+" width="(\d+)" height="(\d+)"/)
        assert.deepStrictEqual([Number(m[1]), Number(m[2])], [1100, 700]) //內嵌之截圖為裁切後之尺寸
        let e1 = await rejectOf(WGuidechart({ ...conf, views: [{ ...conf.views[0], crop: [0, 0, 1700, 900] }] }))
        assert.strictEqual(e1.code, 'E_CROP')
        assert.strictEqual(e1.message, 'crop exceeds the screenshot: conf.views[0].crop')
        let rs = demoRegions().filter((g) => ['查詢列', '圖區', '分頁列', '清單'].includes(g.label))
        let e2 = await rejectOf(WGuidechart({ ...conf, views: [{ ...conf.views[0], regions: rs }] }, { capture: true }))
        assert.strictEqual(e2.code, 'E_CROP')
        assert.strictEqual(e2.message, 'region lies outside the crop: conf.views[0].regions[1]') //清單(x 38～98)在裁切 x1 300 之左
        assert.deepStrictEqual(lc.st, { launched: 2, closed: 2 }) //E_CROP(取景後)亦恰關閉一次
    })

    it('R-GC-SVG-01 標籤含 & < > " \' 時 svg 可解析且文字原樣顯示', async function() {
        let lc = makeLauncher()
        let conf = mkConf('esc', lc.launchBrowser)
        conf.views[0].regions = [{ label: '甲&乙<丙>"丁\'', find: { sel: '#list' } }]
        let res = await WGuidechart(conf, { capture: true })
        let svg = fs.readFileSync(res[0].files.svg, 'utf8')
        let p = await browser.newPage()
        let r = await p.evaluate((s) => {
            let doc = new DOMParser().parseFromString(s, 'image/svg+xml')
            return { nErr: doc.getElementsByTagName('parsererror').length, text: doc.getElementsByTagName('text')[0].textContent }
        }, svg)
        await p.close()
        assert.deepStrictEqual(r, { nErr: 0, text: '甲&乙<丙>"丁\'' })
    })

    it('R-GC-MEASURE-02 量不到框 → E_BOX_NOT_FOUND(提示 box、無效選擇器); union 成員量不到亦然; 瀏覽器恰關閉一次', async function() {
        let lc = makeLauncher()
        let one = async (find) => rejectOf(WGuidechart({ ...mkConf('box', lc.launchBrowser), views: [{ name: 'v', open: (page) => page.setContent(demoHtml()), regions: [{ label: '甲', find }] }] }, { capture: true }))
        let e1 = await one({ sel: '#chart' })
        assert.strictEqual(e1.code, 'E_BOX_NOT_FOUND')
        assert.strictEqual(e1.message, 'box not found: conf.views[0].regions[0].find (no visible content; use mode \'box\' for elements without child content)')
        let e2 = await one({ sel: '##bad' })
        assert.strictEqual(e2.message, 'box not found: conf.views[0].regions[0].find (invalid selector)')
        let e3 = await one({ union: [{ sel: '#list' }, { sel: '#none' }] })
        assert.strictEqual(e3.code, 'E_BOX_NOT_FOUND')
        let e4 = await one({ fn: () => ({ x1: 'a' }) })
        assert.strictEqual(e4.message, 'find.fn must return { x1, y1, x2, y2 } of finite numbers or null: conf.views[0].regions[0].find')
        let e5 = await one({
            fn: () => {
                throw new Error('boom')
            }
        })
        assert.strictEqual(e5.code, 'E_BOX_NOT_FOUND')
        assert.ok(e5.cause instanceof Error)
        assert.deepStrictEqual(lc.st, { launched: 5, closed: 5 })
    })

    it('R-GC-MEASURE-01 find.fn 為函數並以 arg 傳參(page.evaluate 執行, 不經字串)', async function() {
        let lc = makeLauncher()
        let conf = mkConf('fn', lc.launchBrowser)
        conf.views[0].regions = [{
            label: '自訂',
            find: {
                fn: (sel) => {
                    let r = document.querySelector(sel).getBoundingClientRect()
                    return { x1: r.left, y1: r.top, x2: r.right, y2: r.bottom }
                },
                arg: '#list'
            }
        }]
        let res = await WGuidechart(conf, { capture: true })
        let d = readJson(res[0].files.data)
        assert.deepStrictEqual(d.regions[0].box, { x1: 14, y1: 126, x2: 302, y2: 886 }) //#list 之外框(16,128,300,884)加 pad 2
    })

    it('R-GC-ERR-01 使用端回呼之錯誤: E_OPEN(cause 經遮罩, 不含網址內之密碼); launchBrowser 拋錯或回傳非瀏覽器 → E_BROWSER', async function() {
        let lc = makeLauncher()
        let conf = mkConf('err', lc.launchBrowser)
        conf.views[0].open = () => {
            throw new Error('connect to http://user1:pw-secret-77@db.example.com/x failed')
        }
        let e1 = await rejectOf(WGuidechart(conf, { capture: true }))
        assert.strictEqual(e1.code, 'E_OPEN')
        assert.strictEqual(e1.message, 'open failed: conf.views[0]')
        assert.ok(e1.cause instanceof Error)
        assert.ok(!e1.cause.message.includes('pw-secret-77'), e1.cause.message)
        assert.deepStrictEqual(lc.st, { launched: 1, closed: 1 })
        let e2 = await rejectOf(WGuidechart({
            ...conf,
            env: {
                launchBrowser: () => {
                    throw new Error('no browser')
                }
            }
        }, { capture: true }))
        assert.strictEqual(e2.code, 'E_BROWSER')
        assert.strictEqual(e2.cause.message, 'no browser')
        let nClose = 0
        let e3 = await rejectOf(WGuidechart({
            ...conf,
            env: {
                launchBrowser: () => ({
                    close: () => {
                        nClose++
                    }
                })
            }
        }, { capture: true }))
        assert.strictEqual(e3.code, 'E_BROWSER')
        assert.strictEqual(nClose, 1) //回傳物件缺 newPage 時仍關閉之
        let e4 = await rejectOf(WGuidechart({
            ...conf,
            views: [{ ...conf.views[0], open: (page) => page.setContent(demoHtml()) }],
            env: {
                launchBrowser: lc.launchBrowser,
                afterCapture: () => {
                    throw new Error('missing record')
                }
            }
        }, { capture: true }))
        assert.strictEqual(e4.code, 'E_OPEN')
        assert.strictEqual(e4.message, 'afterCapture failed: conf.views[0]')
        assert.deepStrictEqual(lc.st, { launched: 2, closed: 2 })
    })

    it('R-GC-SETTLE-01 穩定等待: 持續動畫之頁於觀察到第一個 same:false 事件後才停止動畫(停止時點由事件決定), 等到 settled 事件; 截圖為最終態', async function() {
        let lc = makeLauncher()
        let rec = makeRecorder()
        let fin = {}
        let pg = null
        let stopAt = null //停止動畫時之事件序號
        let onTrace = (e) => {
            rec.onTrace(e)
            if (e.type === 'settle-sample' && e.same === false && stopAt === null) {
                stopAt = rec.evs.length - 1
                pg.evaluate(() => {
                    window.__stop = true
                }).catch(() => {})
            }
        }
        let conf = {
            dirWork: path.join(fdTmp, 'settle'),
            env: {
                launchBrowser: lc.launchBrowser,
                afterCapture: async (page) => {
                    fin.stop = await page.evaluate(() => window.__stop)
                    fin.shot = await page.screenshot()
                },
            },
            capture: { settleMs: 120000 }, //上限只防懸置, 不表達規格
            views: [{
                name: 'anim',
                open: async (page) => {
                    pg = page
                    await page.setContent(animHtml(Infinity))
                },
                regions: [{ label: '方塊', find: { sel: '#m', mode: 'box' } }],
            }],
        }
        let res = await WGuidechart(conf, { capture: true, onTrace })
        let types = rec.evs.map((e) => e.type)
        let iSettled = types.indexOf('settled')
        assert.ok(stopAt !== null && iSettled > stopAt, types.join(',')) //動畫期間之截圖不同(same:false), 停止後才 settled
        let samples = rec.evs.slice(0, iSettled).filter((e) => e.type === 'settle-sample')
        assert.strictEqual(samples[samples.length - 1].same, true) //最後一次比對相同才 settled
        assert.ok(samples.slice(0, -1).every((e) => e.same === false)) //相同之前皆不同(未提早 settled)
        assert.strictEqual(rec.evs[iSettled].k, samples[samples.length - 1].k)
        assert.strictEqual(fin.stop, true) //取景時動畫已停
        assert.ok(Buffer.compare(fs.readFileSync(res[0].files.shot), fin.shot) === 0) //取景之截圖為最終態
        //事件之順序與內容
        assert.deepStrictEqual(types.filter((t) => !['settle-sample'].includes(t)), ['view-open', 'settle-fonts', 'settled', 'shot', 'measured', 'captured', 'layout', 'rendered'])
        rec.evs.forEach((e) => assert.ok(Object.isFrozen(e)))
        assert.deepStrictEqual(rec.evs.find((e) => e.type === 'measured'), { type: 'measured', view: 'anim', region: 0 })
        assert.deepStrictEqual(lc.st, { launched: 1, closed: 1 })
    })

    it('R-GC-SETTLE-01 持續動畫且 settleMs 300 → reject E_SETTLE, 有 settle-timeout 事件, 不寫取景檔; settle fonts 則不比對截圖而取景', async function() {
        let lc = makeLauncher()
        let rec = makeRecorder()
        let conf = {
            dirWork: path.join(fdTmp, 'settle2'),
            env: { launchBrowser: lc.launchBrowser },
            capture: { settleMs: 300 },
            views: [{ name: 'forever', open: (page) => page.setContent(animHtml(Infinity)), regions: [{ label: '方塊', find: { sel: '#m', mode: 'box' } }] }],
        }
        let e = await rejectOf(WGuidechart(conf, { capture: true, onTrace: rec.onTrace }))
        assert.strictEqual(e.code, 'E_SETTLE')
        assert.strictEqual(e.message, 'page did not settle within capture.settleMs: conf.views[0]')
        let to = rec.evs.find((x) => x.type === 'settle-timeout')
        assert.ok(to && to.view === 'forever', JSON.stringify(rec.evs))
        assert.ok(!rec.evs.some((x) => x.type === 'settled'))
        assert.strictEqual(fs.existsSync(path.join(conf.dirWork, 'data', 'forever.json')), false)
        assert.deepStrictEqual(lc.st, { launched: 1, closed: 1 })
        let rec2 = makeRecorder()
        let res = await WGuidechart({ ...conf, capture: { settle: 'fonts', settleMs: 120000 } }, { capture: true, onTrace: rec2.onTrace }) //上限只防懸置
        assert.strictEqual(res.length, 1)
        assert.ok(!rec2.evs.some((x) => x.type === 'settle-sample'))
        assert.deepStrictEqual(rec2.evs.find((x) => x.type === 'settled'), { type: 'settled', view: 'forever', k: 1 })
    })

    it('R-GC-TRACE-01 未傳回調時行為不變: 未傳、紀錄器、拋錯、回傳 rejection、非函數五種之結果相同, 回調之 this 為 undefined', async function() {
        let lc = makeLauncher()
        let thisSeen = []
        let variants = [
            undefined,
            function(e) {
                thisSeen.push(this)
            },
            () => {
                throw new Error('x')
            },
            () => Promise.reject(new Error('y')),
            'not-a-function',
        ]
        let outs = []
        for (let k = 0; k < variants.length; k++) {
            let conf = mkConf(`trace${k}`, lc.launchBrowser)
            let res = await WGuidechart(conf, { capture: true, onTrace: variants[k] })
            outs.push(JSON.stringify(res.map((r) => ({ w: r.w, h: r.h, issues: r.issues, notes: r.notes, decisions: r.decisions }))))
        }
        outs.forEach((o) => assert.strictEqual(o, outs[0]))
        assert.ok(thisSeen.length > 0 && thisSeen.every((t) => t === undefined))
        assert.deepStrictEqual(lc.st, { launched: 5, closed: 5 })
    })

    it('R-GC-ARG-04 數字字串之設定與數值之結果相同(經公開入口)', async function() {
        let lc = makeLauncher()
        let a = await WGuidechart({ ...ref.conf, env: { launchBrowser: lc.launchBrowser }, layout: { ext: '120', minGap: ' 50 ' }, style: { fs: '30' } })
        let b = await WGuidechart({ ...ref.conf, env: { launchBrowser: lc.launchBrowser }, layout: { ext: 120, minGap: 50 }, style: { fs: 30 } })
        assert.deepStrictEqual(a[0].decisions, b[0].decisions)
        assert.strictEqual(a[0].w, 1600 + 2 * 120)
    })

    it('R-GC-RENDER-01 字型不在時列注意 FONT_FALLBACK; 預設字型(Windows)不列', async function() {
        let lc = makeLauncher()
        let a = await WGuidechart({ ...ref.conf, env: { launchBrowser: lc.launchBrowser }, style: { font: 'NoSuchFontXyz123' } })
        assert.ok(a[0].notes.some((n) => n.code === 'FONT_FALLBACK'), JSON.stringify(a[0].notes))
        if (process.platform === 'win32') {
            assert.ok(!ref.res[0].notes.some((n) => n.code === 'FONT_FALLBACK'))
        }
    })

    it('R-GC-FLOW-04 funLog 收進度(capture、render), 預設不寫 console', async function() {
        let lc = makeLauncher()
        let logs = []
        let got = []
        let w0 = console.log
        console.log = (...args) => got.push(args)
        try {
            await WGuidechart(mkConf('log1', lc.launchBrowser), { capture: true })
        }
        finally {
            console.log = w0
        }
        assert.deepStrictEqual(got, [])
        await WGuidechart(mkConf('log2', lc.launchBrowser), { capture: true, funLog: (label, info) => logs.push(label) })
        assert.deepStrictEqual(logs, ['capture', 'render'])
    })

    it('R-GC-FLOW-04 funLog 回傳 rejection(警告與進度兩路)不成為未處理之 rejection', async function() {
        let lc = makeLauncher()
        let un = []
        let h = (reason) => un.push(reason)
        process.on('unhandledRejection', h)
        try {
            let conf = mkConf('log3', lc.launchBrowser)
            conf.style = { fs: 'x' } //debug 警告一則
            await WGuidechart(conf, { capture: true, debug: true, funLog: () => Promise.reject(new Error('log failure')) })
            for (let i = 0; i < 5; i++) {
                await new Promise((resolve) => setImmediate(resolve)) //否定斷言之觀察窗
            }
        }
        finally {
            process.off('unhandledRejection', h)
        }
        assert.deepStrictEqual(un, [])
    })

    it('R-GC-DATA-01 資料檔之數值為 N2: 數字字串轉為數值後使用, 結果與數值相同', async function() {
        let dirWork = path.join(fdTmp, 'data-n2')
        fs.mkdirSync(path.join(dirWork, 'data'), { recursive: true })
        fs.mkdirSync(path.join(dirWork, 'shots'), { recursive: true })
        fs.copyFileSync(ref.res[0].files.shot, path.join(dirWork, 'shots', 'demo-main.png'))
        let d = readJson(ref.res[0].files.data)
        d.size = { width: '1600', height: ' 900 ' }
        d.regions.forEach((r) => {
            r.box = { x1: String(r.box.x1), y1: ` ${r.box.y1} `, x2: String(r.box.x2), y2: String(r.box.y2) }
        })
        fs.writeFileSync(path.join(dirWork, 'data', 'demo-main.json'), JSON.stringify(d))
        let lc = makeLauncher()
        let res = await WGuidechart({ ...ref.conf, dirWork, env: { launchBrowser: lc.launchBrowser } })
        assert.deepStrictEqual(res[0].decisions, ref.res[0].decisions)
        assert.strictEqual(res[0].w, ref.res[0].w)
    })

    it('R-GC-DATA-01 截圖破損(檔頭與尺寸相符而無影像資料)→ E_DATA; 瀏覽器恰關閉一次', async function() {
        let dirWork = path.join(fdTmp, 'data-png')
        fs.mkdirSync(path.join(dirWork, 'data'), { recursive: true })
        fs.mkdirSync(path.join(dirWork, 'shots'), { recursive: true })
        let head = fs.readFileSync(ref.res[0].files.shot).subarray(0, 33) //簽章＋IHDR 區塊, 無 IDAT／IEND
        fs.writeFileSync(path.join(dirWork, 'shots', 'demo-main.png'), head)
        fs.copyFileSync(ref.res[0].files.data, path.join(dirWork, 'data', 'demo-main.json'))
        let lc = makeLauncher()
        let e = await rejectOf(WGuidechart({ ...ref.conf, dirWork, env: { launchBrowser: lc.launchBrowser } }))
        assert.strictEqual(e.code, 'E_DATA')
        assert.strictEqual(e.message, 'screenshot cannot be decoded: conf.views[0]')
        assert.deepStrictEqual(lc.st, { launched: 1, closed: 1 })
    })

    it('R-GC-ERR-01 launchBrowser 回傳之物件讀 newPage 拋錯 → E_BROWSER(固定訊息), 仍呼叫 close', async function() {
        let nClose = 0
        let fake = {
            get newPage() {
                throw new Error('browser getter secret')
            },
            close() {
                nClose++
            },
        }
        let e = await rejectOf(WGuidechart({ ...ref.conf, env: { launchBrowser: () => fake } }))
        assert.strictEqual(e.code, 'E_BROWSER')
        assert.strictEqual(e.message, 'conf.env.launchBrowser must resolve to a browser with newPage and close')
        assert.strictEqual(nClose, 1)
    })

})
