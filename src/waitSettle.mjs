import mkErr from './mkErr.mjs'
import waitFontsInPage from './waitFontsInPage.mjs'
import waitFramesInPage from './waitFramesInPage.mjs'


let DEAD = Symbol('settle-deadline')


//取景前之畫面穩定等待(R-GC-SETTLE-01): 依序等 document.fonts.ready → 雙 rAF → 連續兩次截圖相同(settle 'stable');
//  settle 'fonts' 時略過截圖比對(供持續動畫之頁面); settleMs 為整段等待之上限, 逾時 reject E_SETTLE(不出圖, 原則 1)
//  每次比對之間先等雙 rAF(至少經過 1 個影格), 故以影格而非毫秒推進; 回傳最後一張截圖(即取景之截圖)
//  兩道防線各管一事: ①每個頁面操作皆與上限之計時器競速——操作本身卡住(永不完成)時, 於上限即 reject;
//  ②每步開始前比對時刻——操作皆立即完成而不讓出給計時器時, 仍於上限停止; 逾時後仍在進行之操作, 其後之 rejection 已吸收
//觀察回調(trace 為 getTrace 之結果或 null): settle-fonts { view }、settle-sample { view, k, same }、settled { view, k }、settle-timeout { view, k }
async function waitSettle(page, { settle, settleMs, trace, view, idx }) {
    let timer = null
    let deadline = new Promise((resolve) => {
        timer = setTimeout(() => {
            resolve(DEAD)
        }, settleMs)
    })
    let endAt = Date.now() + settleMs
    let k = 0
    let step = async (fn) => {
        //已過上限者不再啟動新的頁面操作(頁面操作若不經計時器即完成, 上限之計時器無從觸發, 由此擋下)
        if (Date.now() >= endAt) {
            return DEAD
        }
        let pm = null
        try {
            pm = Promise.resolve(fn())
        }
        catch (err) {
            pm = Promise.reject(err)
        }
        pm.catch(() => {}) //逾時後仍在進行之頁面操作, 其後之 rejection 不成為未處理
        let r = null
        try {
            r = await Promise.race([pm, deadline])
        }
        catch (err) {
            throw mkErr('E_BROWSER', `page operation failed while waiting to settle: conf.views[${idx}]`, err)
        }
        return r
    }
    let timeout = () => {
        if (trace) {
            trace('settle-timeout', { view, k })
        }
        return mkErr('E_SETTLE', `page did not settle within capture.settleMs: conf.views[${idx}]`)
    }
    //截圖之回傳須為二進位(Buffer／Uint8Array); 否則為瀏覽器介面不合, 以固定詞彙回報(不回顯值)
    let shot = async () => {
        let b = await step(() => page.screenshot({ fullPage: false }))
        if (b === DEAD) {
            throw timeout()
        }
        if (!(b instanceof Uint8Array)) {
            throw mkErr('E_BROWSER', `page.screenshot must resolve to a Buffer: conf.views[${idx}]`)
        }
        return b
    }
    try {
        if (await step(() => page.evaluate(waitFontsInPage)) === DEAD) {
            throw timeout()
        }
        if (trace) {
            trace('settle-fonts', { view })
        }
        if (await step(() => page.evaluate(waitFramesInPage)) === DEAD) {
            throw timeout()
        }
        let prev = await shot()
        k = 1
        if (settle === 'fonts') {
            if (trace) {
                trace('settled', { view, k })
            }
            return prev
        }
        for (;;) {
            if (await step(() => page.evaluate(waitFramesInPage)) === DEAD) {
                throw timeout()
            }
            let cur = await shot()
            k++
            let same = Buffer.compare(prev, cur) === 0
            if (trace) {
                trace('settle-sample', { view, k, same })
            }
            if (same) {
                if (trace) {
                    trace('settled', { view, k })
                }
                return cur
            }
            prev = cur
        }
    }
    finally {
        clearTimeout(timer)
    }
}


export default waitSettle
