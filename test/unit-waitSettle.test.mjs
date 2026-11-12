//穩定等待(src/waitSettle.mjs)之單元測試: 以可控之頁面替身(只實作 evaluate、screenshot)驗兩道防線與比對語意(R-GC-SETTLE-01)
//  ①頁面操作卡住(永不完成)時, 於上限 reject E_SETTLE 且不等該操作; 其後該操作 reject 不成為未處理之 rejection
//  ②頁面操作皆立即完成而不讓出給計時器時, 仍於上限停止
//  同步點為被測函數之完成與觀察回調之事件, 不以延時; 上限之值即規格(逾時), 測試只斷言結果與事件, 不斷言耗時
import assert from 'assert'
import waitSettle from '../src/waitSettle.mjs'


let mkTrace = () => {
    let evs = []
    let trace = (type, info) => {
        evs.push({ type, ...info })
    }
    return { evs, trace }
}
let rejectOf = async (pm) => {
    try {
        await pm
    }
    catch (err) {
        return err
    }
    throw new Error('must reject')
}
let buf = (n) => Buffer.from([0x89, n])


describe('unit-waitSettle', function() {

    it('連兩次截圖相同才 settled: 截圖依序為 A、B、B → settle-sample k=2 不同、k=3 相同, 回傳 B', async function() {
        let shots = [buf(1), buf(2), buf(2)]
        let page = { evaluate: async () => true, screenshot: async () => shots.shift() }
        let t = mkTrace()
        let r = await waitSettle(page, { settle: 'stable', settleMs: 120000, trace: t.trace, view: 'v', idx: 0 })
        assert.ok(Buffer.compare(r, buf(2)) === 0)
        assert.deepStrictEqual(t.evs, [
            { type: 'settle-fonts', view: 'v' },
            { type: 'settle-sample', view: 'v', k: 2, same: false },
            { type: 'settle-sample', view: 'v', k: 3, same: true },
            { type: 'settled', view: 'v', k: 3 },
        ])
    })

    it('settle fonts: 不比對截圖, 回傳第一張', async function() {
        let page = { evaluate: async () => true, screenshot: async () => buf(7) }
        let t = mkTrace()
        let r = await waitSettle(page, { settle: 'fonts', settleMs: 120000, trace: t.trace, view: 'v', idx: 0 })
        assert.ok(Buffer.compare(r, buf(7)) === 0)
        assert.deepStrictEqual(t.evs.map((e) => e.type), ['settle-fonts', 'settled'])
    })

    it('防線①: 頁面操作永不完成時, 於上限 reject E_SETTLE 並有 settle-timeout 事件; 其後該操作 reject 不成為未處理之 rejection', async function() {
        let fail = null
        let started = 0
        let page = {
            evaluate: () => {
                started++
                return new Promise((resolve, reject) => {
                    fail = reject
                })
            },
            screenshot: async () => buf(1),
        }
        let t = mkTrace()
        let e = await rejectOf(waitSettle(page, { settle: 'stable', settleMs: 50, trace: t.trace, view: 'v', idx: 3 }))
        assert.strictEqual(e.code, 'E_SETTLE')
        assert.strictEqual(e.message, 'page did not settle within capture.settleMs: conf.views[3]')
        assert.deepStrictEqual(t.evs, [{ type: 'settle-timeout', view: 'v', k: 0 }])
        assert.strictEqual(started, 1) //卡住之操作仍未完成即已 reject
        let un = []
        let h = (reason) => un.push(reason)
        process.on('unhandledRejection', h)
        try {
            fail(new Error('late failure'))
            //否定斷言之觀察窗: 讓出數輪事件迴圈, 使未處理之 rejection(若有)得以發出
            for (let i = 0; i < 5; i++) {
                await new Promise((resolve) => setImmediate(resolve))
            }
        }
        finally {
            process.off('unhandledRejection', h)
        }
        assert.deepStrictEqual(un, [])
    })

    it('防線②: 頁面操作皆立即完成(不讓出給計時器)且截圖恆不同時, 仍於上限 reject E_SETTLE', async function() {
        let n = 0
        let page = {
            evaluate: () => Promise.resolve(true),
            screenshot: () => Promise.resolve(buf(n++ % 250)),
        }
        let t = mkTrace()
        let e = await rejectOf(waitSettle(page, { settle: 'stable', settleMs: 30, trace: t.trace, view: 'v', idx: 0 }))
        assert.strictEqual(e.code, 'E_SETTLE')
        assert.strictEqual(t.evs[t.evs.length - 1].type, 'settle-timeout')
        assert.ok(t.evs.filter((x) => x.type === 'settle-sample').every((x) => x.same === false))
    })

    it('截圖之回傳非二進位 → E_BROWSER(固定詞彙, 不回顯值); 頁面操作拋錯 → E_BROWSER, cause 經遮罩', async function() {
        let page = { evaluate: async () => true, screenshot: async () => 'shot-secret' }
        let e = await rejectOf(waitSettle(page, { settle: 'stable', settleMs: 120000, trace: null, view: 'v', idx: 1 }))
        assert.strictEqual(e.code, 'E_BROWSER')
        assert.strictEqual(e.message, 'page.screenshot must resolve to a Buffer: conf.views[1]')
        let page2 = {
            evaluate: async () => {
                throw new Error('target closed http://u1:pw-secret-9@h.example.com/x')
            },
            screenshot: async () => buf(1),
        }
        let e2 = await rejectOf(waitSettle(page2, { settle: 'stable', settleMs: 120000, trace: null, view: 'v', idx: 1 }))
        assert.strictEqual(e2.code, 'E_BROWSER')
        assert.strictEqual(e2.message, 'page operation failed while waiting to settle: conf.views[1]')
        assert.ok(!e2.cause.message.includes('pw-secret-9'), e2.cause.message)
    })

})
