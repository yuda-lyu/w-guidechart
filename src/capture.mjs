import fs from 'fs'
import path from 'path'
import isobj from 'wsemi/src/isobj.mjs'
import isfun from 'wsemi/src/isfun.mjs'
import isenum from 'wsemi/src/isenum.mjs'
import mkErr from './mkErr.mjs'
import waitSettle from './waitSettle.mjs'
import measureInPage from './measureInPage.mjs'
import pngSize from './pngSize.mjs'


//find.fn 先於 Node 端以 page.evaluate(fn, arg) 執行(Playwright 之公開機制, 套件內不動態執行字串), 換為 { rect } 葉; 其餘轉為純資料
async function resolveFind(page, f, p) {
    if (f.union) {
        let us = []
        for (let k = 0; k < f.union.length; k++) {
            us.push(await resolveFind(page, f.union[k], `${p}.union[${k}]`))
        }
        return { union: us, mode: f.mode, pad: f.pad }
    }
    if (f.fn) {
        let r = null
        try {
            r = await page.evaluate(f.fn, f.arg)
        }
        catch (err) {
            throw mkErr('E_BOX_NOT_FOUND', `find.fn failed: ${p}`, err)
        }
        //回傳值為使用端之輸出: null 為量不到; 否則須為一般物件, 四值為 N3 嚴格數字(有限之原始 number); 各值只讀一次並以快照檢測與使用(V11、K4)
        if (r === null || r === undefined) {
            return { rect: null, pad: f.pad }
        }
        let s = {}
        let bad = false
        try {
            bad = !isobj(r)
            for (let k of ['x1', 'y1', 'x2', 'y2']) {
                s[k] = bad ? undefined : r[k]
                bad = bad || typeof s[k] !== 'number' || !isenum(s[k])
            }
        }
        catch (err) {
            bad = true
        }
        if (bad) {
            throw mkErr('E_BOX_NOT_FOUND', `find.fn must return { x1, y1, x2, y2 } of finite numbers or null: ${p}`)
        }
        return { rect: s, pad: f.pad }
    }
    if (f.at) {
        return { at: f.at.slice(), minW: f.minW, minH: f.minH, mode: f.mode, pad: f.pad }
    }
    return { sel: f.sel, mode: f.mode, pad: f.pad }
}


//取景(R-GC-CAP-01): 開頁 → open → 停放滑鼠 → 穩定等待 → 量框 → afterCapture → 寫 shots/<名稱>.png 與 data/<名稱>.json
//  觀察回調: view-open、shot、measured { view, region }、captured(另見 waitSettle)
async function captureView({ browser, cfg, v, trace, log, warn }) {
    let pv = `conf.views[${v.idx}]`
    let page = null
    try {
        page = cfg.env.openPage ? await cfg.env.openPage(browser, v.src) : await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 })
    }
    catch (err) {
        throw mkErr('E_OPEN', `openPage failed: ${pv}`, err)
    }
    if (!page || !isfun(page.screenshot) || !isfun(page.evaluate) || !isfun(page.viewportSize)) {
        throw mkErr('E_OPEN', `openPage must resolve to a page: ${pv}`)
    }
    try {
        try {
            await v.open(page, cfg.env.helpers)
        }
        catch (err) {
            throw mkErr('E_OPEN', `open failed: ${pv}`, err)
        }
        if (trace) {
            trace('view-open', { view: v.name })
        }
        let vp = page.viewportSize()
        if (!vp) {
            throw mkErr('E_OPEN', `page must have a fixed viewport: ${pv}`)
        }
        //取景前: 滑鼠停於不影響畫面處(避免停留提示、hover 樣式與滑鼠座標改變); 超出視窗者不停放
        let mp = cfg.capture.mousePark
        if (mp) {
            if (mp[0] < vp.width && mp[1] < vp.height) {
                try {
                    await page.mouse.move(mp[0], mp[1])
                }
                catch (err) {
                    throw mkErr('E_BROWSER', `mouse move failed: ${pv}`, err)
                }
            }
            else {
                warn('conf.capture.mousePark', 'inside the viewport of each view (skipped for this view)')
            }
        }
        let shot = await waitSettle(page, { settle: cfg.capture.settle, settleMs: cfg.capture.settleMs, trace, view: v.name, idx: v.idx })
        let sz = pngSize(shot)
        if (!sz || sz.width !== vp.width || sz.height !== vp.height) {
            throw mkErr('E_OPEN', `screenshot size differs from the viewport (deviceScaleFactor must be 1): ${pv}`)
        }
        if (trace) {
            trace('shot', { view: v.name })
        }
        let regions = []
        for (let j = 0; j < v.regions.length; j++) {
            let r = v.regions[j]
            let pr = `${pv}.regions[${j}].find`
            let rf = await resolveFind(page, r.find, pr)
            let m = null
            try {
                m = await page.evaluate(measureInPage, rf)
            }
            catch (err) {
                throw mkErr('E_BROWSER', `measuring failed: ${pr}`, err)
            }
            let b = m && m.box
            if (!b || b.x2 - b.x1 < 8 || b.y2 - b.y1 < 8) {
                let hint = m && m.why === 'selector' ? ' (invalid selector)' : m && m.why === 'empty' ? ' (no visible content; use mode \'box\' for elements without child content)' : ''
                throw mkErr('E_BOX_NOT_FOUND', `box not found: ${pr}${hint}`)
            }
            if (trace) {
                trace('measured', { view: v.name, region: j })
            }
            regions.push({ label: r.label, findKey: r.findKey, box: { x1: Math.round(b.x1), y1: Math.round(b.y1), x2: Math.round(b.x2), y2: Math.round(b.y2) } })
        }
        if (cfg.env.afterCapture) {
            try {
                await cfg.env.afterCapture(page)
            }
            catch (err) {
                throw mkErr('E_OPEN', `afterCapture failed: ${pv}`, err)
            }
        }
        let out = { name: v.name, shot: `shots/${v.name}.png`, size: { width: vp.width, height: vp.height }, regions }
        let fpShot = path.join(cfg.dirs.shot, `${v.name}.png`)
        let fpData = path.join(cfg.dirs.data, `${v.name}.json`)
        try {
            fs.writeFileSync(fpShot, shot)
            fs.writeFileSync(fpData, JSON.stringify(out, null, 2), 'utf8')
        }
        catch (err) {
            throw mkErr('E_FS', `writing captured files failed: ${pv}`, err)
        }
        if (trace) {
            trace('captured', { view: v.name })
        }
        log('capture', { view: v.name, regions: regions.map((r) => ({ label: r.label, box: r.box })) })
    }
    finally {
        try {
            await page.context().close()
        }
        catch (err) {
            try {
                await page.close()
            }
            catch (err2) {} // eslint-disable-line no-empty
        }
    }
}


export default captureView
