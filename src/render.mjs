import fs from 'fs'
import path from 'path'
import isobj from 'wsemi/src/isobj.mjs'
import isenum from 'wsemi/src/isenum.mjs'
import iseint from 'wsemi/src/iseint.mjs'
import mkErr from './mkErr.mjs'
import pngSize from './pngSize.mjs'
import layout from './layout.mjs'
import genSvg from './genSvg.mjs'
import cropInPage from './cropInPage.mjs'
import decodeInPage from './decodeInPage.mjs'
import measureTextInPage from './measureTextInPage.mjs'
import waitFontsInPage from './waitFontsInPage.mjs'


//讀並驗取景資料(R-GC-DATA-01): data/<名稱>.json 為磁碟上之輸入, 驗其 schema; 截圖路徑由名稱推得, 不取資料檔之 shot 欄;
//  核對 find 是否已變更(E_STALE)、裁切是否在截圖內且各功能區落在裁切內(E_CROP); 回 { W0, H0, crop, boxes, shot }
function readData(cfg, v) {
    let pv = `conf.views[${v.idx}]`
    let fpData = path.join(cfg.dirs.data, `${v.name}.json`)
    let fpShot = path.join(cfg.dirs.shot, `${v.name}.png`)
    if (!fs.existsSync(fpData) || !fs.existsSync(fpShot)) {
        throw mkErr('E_NOT_CAPTURED', `view not captured, run with opt.capture: ${pv}`)
    }
    let d = null
    let shot = null
    try {
        d = fs.readFileSync(fpData, 'utf8')
        shot = fs.readFileSync(fpShot)
    }
    catch (err) {
        throw mkErr('E_FS', `reading captured files failed: ${pv}`, err)
    }
    try {
        d = JSON.parse(d)
    }
    catch (err) {
        throw mkErr('E_DATA', `invalid data file (not JSON): ${pv}`)
    }
    //schema(R-GC-DATA-01): size 之寬高為正整數, regions[k].findKey 為字串, box 之四值為 N2(數字字串轉為數值後使用, K4); JSON.parse 之結果無存取器
    let bad = () => mkErr('E_DATA', `invalid data file: ${pv}`)
    let num = (v) => (typeof v === 'number' ? v : Number(String(v).trim()))
    let isN = (v) => (typeof v === 'number' || typeof v === 'string') && isenum(v)
    let isI = (v) => (typeof v === 'number' || typeof v === 'string') && iseint(v, { min: 1, max: 100000 })
    if (!isobj(d) || !isobj(d.size) || !isI(d.size.width) || !isI(d.size.height) || !Array.isArray(d.regions)) {
        throw bad()
    }
    let ks = ['x1', 'y1', 'x2', 'y2']
    let rds = d.regions.map((r) => {
        if (!isobj(r) || typeof r.findKey !== 'string' || !isobj(r.box) || ks.some((k) => !isN(r.box[k]))) {
            throw bad()
        }
        return { findKey: r.findKey, box: { x1: num(r.box.x1), y1: num(r.box.y1), x2: num(r.box.x2), y2: num(r.box.y2) } }
    })
    let W = num(d.size.width)
    let H = num(d.size.height)
    let sz = pngSize(shot)
    if (!sz || sz.width !== W || sz.height !== H) {
        throw mkErr('E_DATA', `screenshot does not match the data file: ${pv}`)
    }
    let stale = rds.length !== v.regions.length || v.regions.some((r, k) => r.findKey !== rds[k].findKey)
    if (stale) {
        throw mkErr('E_STALE', `regions (find) changed since capture, run with opt.capture: ${pv}`)
    }
    let [cx1, cy1, cx2, cy2] = v.crop || [0, 0, W, H]
    if (cx2 > W || cy2 > H) {
        throw mkErr('E_CROP', `crop exceeds the screenshot: ${pv}.crop`)
    }
    let W0 = cx2 - cx1
    let H0 = cy2 - cy1
    //功能區之框改為裁切後之座標並夾於裁切範圍內(距邊 3); 夾後寬或高不足 8 者為落在裁切外
    let boxes = rds.map((r, k) => {
        let b = { x1: Math.max(3, r.box.x1 - cx1), y1: Math.max(3, r.box.y1 - cy1), x2: Math.min(W0 - 3, r.box.x2 - cx1), y2: Math.min(H0 - 3, r.box.y2 - cy1) }
        if (b.x2 - b.x1 < 8 || b.y2 - b.y1 < 8) {
            throw mkErr('E_CROP', `region lies outside the crop: ${pv}.regions[${k}]`)
        }
        return b
    })
    return { W, H, W0, H0, crop: v.crop ? { x: cx1, y: cy1, w: W0, h: H0 } : null, boxes, shot }
}


//繪製(R-GC-RENDER-01): 裁切(頁面內 canvas)、量字寬(頁面內)、排版(Node)、組 svg、轉 png(頁面內截圖)、寫 layout.json
//  觀察回調: layout { view, nIssue, nNote }、rendered { view }
async function renderViews({ browser, cfg, views, pre, trace, log }) {
    let page = null
    let res = []
    let bw = async (pv, fn) => {
        try {
            return await fn()
        }
        catch (err) {
            throw mkErr('E_BROWSER', `rendering failed: ${pv}`, err)
        }
    }
    try {
        page = await bw('render page', () => browser.newPage({ viewport: { width: 1200, height: 800 }, deviceScaleFactor: 1 }))
        for (let v of views) {
            let pv = `conf.views[${v.idx}]`
            let D = pre[v.name] || readData(cfg, v)
            let st = v.st
            let lay = v.lay
            let b64 = D.shot.toString('base64')
            await bw(pv, () => page.setContent('<html><body style="margin:0"></body></html>'))
            //截圖須可完整解碼且尺寸與資料檔相符(只驗檔頭不足以發現破損之檔)
            let dc = await bw(pv, () => page.evaluate(decodeInPage, b64))
            if (!dc || dc.ok !== true || dc.w !== D.W || dc.h !== D.H) {
                throw mkErr('E_DATA', `screenshot cannot be decoded: ${pv}`)
            }
            if (D.crop) {
                b64 = await bw(pv, () => page.evaluate(cropInPage, { b64, x: D.crop.x, y: D.crop.y, w: D.crop.w, h: D.crop.h }))
            }
            let labels = v.regions.map((r) => r.label)
            let mt = await bw(pv, () => page.evaluate(measureTextInPage, { font: st.font, fs: st.fs, labels }))
            let widths = new Map(labels.map((s, k) => [s, mt.widths[k]]))
            //功能文字與覆寫值取自設定檔(只改這些不必重新取景)
            let regions = v.regions.map((r, k) => ({ ...r.ovr, label: r.label, box: D.boxes[k] }))
            let L = layout({ W0: D.W0, H0: D.H0, regions, widths, st, lay })
            if (!mt.fontOk) {
                L.notes.push({ code: 'FONT_FALLBACK', msg: `字型「${st.font}」不在, 字寬與文字以替代字型量測與繪製`, regions: [] })
            }
            if (trace) {
                trace('layout', { view: v.name, nIssue: L.issues.length, nNote: L.notes.length })
            }
            let svg = genSvg({ L, regions, st, W0: D.W0, H0: D.H0, b64 })
            let files = {
                shot: path.join(cfg.dirs.shot, `${v.name}.png`),
                data: path.join(cfg.dirs.data, `${v.name}.json`),
                layout: path.join(cfg.dirs.data, `${v.name}.layout.json`),
                svg: path.join(cfg.dirs.svg, `${v.name}.svg`),
                png: path.join(cfg.dirs.png, `${v.name}.png`),
            }
            await bw(pv, () => page.setViewportSize({ width: L.w, height: L.h }))
            await bw(pv, () => page.setContent(`<html><body style="margin:0">${svg}</body></html>`))
            await bw(pv, () => page.evaluate(waitFontsInPage))
            let png = await bw(pv, () => page.screenshot({ clip: { x: 0, y: 0, width: L.w, height: L.h } }))
            if (!(png instanceof Uint8Array)) {
                throw mkErr('E_BROWSER', `page.screenshot must resolve to a Buffer: ${pv}`)
            }
            let out = { name: v.name, w: L.w, h: L.h, issues: L.issues, notes: L.notes, decisions: L.decisions }
            try {
                fs.writeFileSync(files.svg, svg, 'utf8')
                fs.writeFileSync(files.png, png)
                fs.writeFileSync(files.layout, JSON.stringify(out, null, 2), 'utf8')
            }
            catch (err) {
                throw mkErr('E_FS', `writing rendered files failed: ${pv}`, err)
            }
            if (trace) {
                trace('rendered', { view: v.name })
            }
            log('render', { view: v.name, w: L.w, h: L.h, issues: L.issues, notes: L.notes, decisions: L.decisions })
            res.push({ ...out, files })
        }
    }
    finally {
        if (page) {
            try {
                await page.close()
            }
            catch (err) {} // eslint-disable-line no-empty
        }
    }
    return res
}


export { readData, renderViews }
