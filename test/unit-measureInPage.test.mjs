//頁面內之函式(量框 measureInPage、字寬 measureTextInPage、裁切 cropInPage)之測試: 真 Chromium, 以 page.evaluate 執行 src 之函式
//  (函式若引用模組層識別字, 於頁面內即 ReferenceError, 故本檔亦證其自足, R-GC-PAGE-01); 頁面為合成之示範頁(視窗 1600×900)
import assert from 'assert'
import { chromium } from 'playwright'
import measureInPage from '../src/measureInPage.mjs'
import measureTextInPage from '../src/measureTextInPage.mjs'
import cropInPage from '../src/cropInPage.mjs'
import { demoHtml } from './tools/demoPage.mjs'


describe('unit-measureInPage', function() {

    let browser = null
    let page = null
    let rectOf = (sel) => page.evaluate((s) => {
        let r = document.querySelector(s).getBoundingClientRect()
        return { x1: r.left, y1: r.top, x2: r.right, y2: r.bottom }
    }, sel)
    let m = (find) => page.evaluate(measureInPage, find)

    before(async function() {
        browser = await chromium.launch()
        page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 })
        await page.setContent(demoHtml())
    })

    after(async function() {
        await browser.close()
    })

    it('R-GC-MEASURE-01 fit 取可見內容之聯集而不含空白: 清單之框遠窄於其容器', async function() {
        let r = await m({ sel: '#list', mode: 'fit', pad: 6 })
        let c = await rectOf('#list')
        assert.ok(r.box)
        assert.ok(r.box.x2 - r.box.x1 < (c.x2 - c.x1) / 2, JSON.stringify(r.box)) //不含右側空白
        assert.ok(r.box.y2 - r.box.y1 < (c.y2 - c.y1) / 2, JSON.stringify(r.box)) //不含下方空白
    })

    it('R-GC-MEASURE-01 fit 含漸層底之圖示鈕與字型圖示 <i class="mdi">, 不含不足 4 像素之分隔線', async function() {
        let r = await m({ sel: '#tool', mode: 'fit', pad: 6 })
        let mdi = await rectOf('#tool i.mdi')
        let ib = await rectOf('#tool .ib')
        let tool = await rectOf('#tool')
        assert.ok(r.box.x2 >= mdi.x2 && r.box.x1 <= ib.x1, JSON.stringify(r.box)) //含圖示
        assert.ok(r.box.x2 < tool.x2 - 300, JSON.stringify(r.box)) //分隔線(寬 1264、高 2)不算內容
        assert.ok(r.box.y2 < tool.y2 - 1, JSON.stringify(r.box))
    })

    it('R-GC-MEASURE-01 fit 含 svg; canvas 本身無子內容時 fit 量不到(why empty), 改用 box 量得', async function() {
        let r = await m({ sel: '#info', mode: 'fit', pad: 6 })
        let ico = await rectOf('#ico')
        assert.ok(r.box.x2 >= ico.x2 && r.box.y2 >= ico.y2, JSON.stringify(r.box))
        let e = await m({ sel: '#chart', mode: 'fit', pad: 6 })
        assert.deepStrictEqual(e, { box: null, why: 'empty' })
        let b = await m({ sel: '#chart', mode: 'box', pad: 2 })
        let c = await rectOf('#chart')
        assert.deepStrictEqual(b.box, { x1: c.x1 - 2, y1: c.y1 - 2, x2: c.x2 + 2, y2: c.y2 + 2 })
    })

    it('R-GC-MEASURE-01 box 為元素外框加 pad; 框夾於視窗內且距邊至少 3', async function() {
        let c = await rectOf('#list')
        let b = await m({ sel: '#list', mode: 'box', pad: 10 })
        assert.deepStrictEqual(b.box, { x1: c.x1 - 10, y1: c.y1 - 10, x2: c.x2 + 10, y2: c.y2 + 10 })
        let h = await m({ sel: '#hdr', mode: 'box', pad: 2 })
        assert.deepStrictEqual(h.box, { x1: 3, y1: 3, x2: 1597, y2: 66 })
    })

    it('R-GC-MEASURE-01 at 取該點元素往上第一個寬高皆達 minW、minH 之祖先', async function() {
        let c = await rectOf('#list')
        let b = await m({ at: [60, 160], minW: 200, minH: 300, mode: 'box', pad: 0 })
        assert.deepStrictEqual(b.box, c)
        let n = await m({ at: [60, 160], minW: 5000, minH: 0, mode: 'box', pad: 0 })
        assert.strictEqual(n.box, null)
    })

    it('R-GC-MEASURE-02 union 為各者之聯集; 任一成員量不到即整個量不到(原型為靜默略過)', async function() {
        let u = await m({ union: [{ sel: '#hdr .user', mode: 'fit' }, { sel: '#hdr .logout', mode: 'box' }], mode: 'fit', pad: 0 })
        let a = await rectOf('#hdr .user')
        let b = await rectOf('#hdr .logout')
        assert.ok(u.box.x1 <= a.x1 + 1 && u.box.x2 >= b.x2 - 0.01, JSON.stringify(u.box))
        let miss = await m({ union: [{ sel: '#hdr .user', mode: 'fit' }, { sel: '#none', mode: 'fit' }], mode: 'fit', pad: 0 })
        assert.strictEqual(miss.box, null)
    })

    it('R-GC-MEASURE-01 rect 葉(find.fn 於 Node 端先求得之矩形)夾於視窗後加 pad; 無效之選擇器回 why selector; 不存在者回 why none', async function() {
        let r = await m({ rect: { x1: -50, y1: 100, x2: 200, y2: 300 }, pad: 2 })
        assert.deepStrictEqual(r.box, { x1: 3, y1: 98, x2: 202, y2: 302 })
        assert.deepStrictEqual(await m({ sel: '##bad', mode: 'fit', pad: 6 }), { box: null, why: 'selector' })
        assert.deepStrictEqual(await m({ sel: '#none', mode: 'fit', pad: 6 }), { box: null, why: 'none' })
    })

    it('R-GC-MEASURE-03 measureTextInPage: 字寬隨字數遞增且為整數; 不存在之字型 fontOk 為 false', async function() {
        let r = await page.evaluate(measureTextInPage, { font: 'Microsoft JhengHei', fs: 36, labels: ['甲', '甲乙', '甲乙丙丁'] })
        assert.ok(r.widths[0] > 0 && r.widths[0] < r.widths[1] && r.widths[1] < r.widths[2], JSON.stringify(r))
        r.widths.forEach((w) => assert.ok(Number.isInteger(w)))
        let n = await page.evaluate(measureTextInPage, { font: 'NoSuchFontXyz123', fs: 36, labels: ['甲'] })
        assert.strictEqual(n.fontOk, false)
        if (process.platform === 'win32') {
            let a = await page.evaluate(measureTextInPage, { font: 'Arial', fs: 36, labels: ['甲'] }) //Windows 必有 Arial
            assert.strictEqual(a.fontOk, true)
        }
    })

    it('R-GC-RENDER-02 cropInPage: 裁切結果之像素與同區之截圖逐位元組相同', async function() {
        let full = await page.screenshot()
        let clip = await page.screenshot({ clip: { x: 100, y: 50, width: 300, height: 200 } })
        let b64 = await page.evaluate(cropInPage, { b64: full.toString('base64'), x: 100, y: 50, w: 300, h: 200 })
        let p2 = await browser.newPage()
        let nDiff = await p2.evaluate(([a, b]) => {
            let load = (s) => new Promise((resolve) => {
                let img = new Image()
                img.onload = () => resolve(img)
                img.src = 'data:image/png;base64,' + s
            })
            return Promise.all([load(a), load(b)]).then(([ia, ib]) => {
                let px = (img) => {
                    let c = document.createElement('canvas')
                    c.width = img.width
                    c.height = img.height
                    let g = c.getContext('2d')
                    g.drawImage(img, 0, 0)
                    return { w: img.width, h: img.height, d: g.getImageData(0, 0, img.width, img.height).data }
                }
                let x = px(ia)
                let y = px(ib)
                if (x.w !== y.w || x.h !== y.h) {
                    return -1
                }
                let n = 0
                for (let i = 0; i < x.d.length; i++) {
                    if (x.d[i] !== y.d[i]) {
                        n++
                    }
                }
                return n
            })
        }, [b64, clip.toString('base64')])
        await p2.close()
        assert.strictEqual(nDiff, 0)
    })

})
