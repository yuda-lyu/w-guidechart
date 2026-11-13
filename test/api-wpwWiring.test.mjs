//啟動接線(R-GC-PW-01; 帳本 R-PW-WIRING): 本套件執行期不啟動瀏覽器(由使用端注入 env.launchBrowser), 注入者須注入 w-playwright 之 wpw.launchChromium(README 範例形式);
//  以 wpw.setBrowserTypeForTest 之替身斷言測試用之唯一啟動點(test/tools/launch.mjs)與 README 範例形式之注入函數皆經 w-playwright,
//  替身收到之選項為合併後者(args 末元素為恰一串 --disable-features 且含守門功能 AutofillAiWalletPrivatePasses), 且斷言替身確被呼叫(次數 >0; 依賴樹有兩份 w-playwright 時替身只作用於測試所引用之一份)
//  至少一案接縫不用替身: 替身以 next() 走真路徑(真啟動 headless shell)跑 WGuidechart 全流程; 本檔只啟動 headless shell, 不啟動真 Chrome、Edge、完整 Chromium
import fs from 'fs'
import path from 'path'
import assert from 'assert'
import wpw from 'w-playwright'
import WGuidechart from '../src/WGuidechart.mjs'
import { demoHtml, demoRegions } from './tools/demoPage.mjs'
import { launchTestBrowser, makeLauncher } from './tools/launch.mjs'


let fdTmp = path.resolve('./test/_tmp/wpwWiring')
let GUARD = 'AutofillAiWalletPrivatePasses'

//替身: 記錄 w-playwright 送來之合併後選項; mode 'next' 以 next() 真啟動, 'fake' 回傳不啟動之假瀏覽器
let mkFake = (mode) => {
    let seen = []
    let fake = {
        launch: async (o, next) => {
            seen.push(o)
            if (mode === 'next') {
                return next()
            }
            return { newPage: async () => ({}), close: async () => {} }
        },
    }
    return { seen, fake }
}

//守門斷言: args 內恰一個 --disable-features, 為最後一個元素, 且含守門功能
let assertGuard = (o) => {
    let ds = o.args.filter((a) => /^--disable-features=/.test(a))
    assert.strictEqual(ds.length, 1)
    assert.strictEqual(o.args[o.args.length - 1], ds[0])
    assert.ok(ds[0].slice('--disable-features='.length).split(',').includes(GUARD), ds[0])
}


describe('api-wpwWiring', function() {

    before(function() {
        fs.rmSync(fdTmp, { recursive: true, force: true })
    })

    after(function() {
        fs.rmSync(fdTmp, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 })
        try {
            fs.rmdirSync(path.resolve('./test/_tmp')) //尚有其他測試之暫存時非空, 略過
        }
        catch (err) {} // eslint-disable-line no-empty
    })

    it('R-GC-PW-01 唯一啟動點 launchTestBrowser 與其包裝 makeLauncher 皆經 w-playwright: 替身被呼叫, 收到合併後選項(含守門), 預設無頭', async function() {
        let { seen, fake } = mkFake('fake')
        let restore = wpw.setBrowserTypeForTest(fake)
        try {
            let lc = makeLauncher()
            let b = await lc.launchBrowser()
            await b.close()
            assert.deepStrictEqual(lc.st, { launched: 1, closed: 1 })
            assert.strictEqual(seen.length, 1) //替身確被呼叫(次數 >0)
            let b2 = await launchTestBrowser()
            assert.ok(typeof b2.close === 'function')
            assert.strictEqual(seen.length, 2)
            for (let o of seen) {
                assertGuard(o)
                assert.notStrictEqual(o.headless, false) //無頭(headless shell), 不啟動真 Chrome、Edge、完整 Chromium
                assert.ok(!o.channel && !o.executablePath) //不指定通道與執行檔
            }
        }
        finally {
            restore()
        }
    })

    it('R-GC-PW-01 README 範例形式 launchBrowser: () => wpw.launchChromium() 注入 WGuidechart 跑全流程(替身 next() 真啟動 headless shell): 啟動恰 1 次經 w-playwright、選項含守門, 圖照常輸出', async function() {
        let { seen, fake } = mkFake('next')
        let restore = wpw.setBrowserTypeForTest(fake)
        try {
            let conf = {
                dirWork: path.join(fdTmp, 'flow'),
                env: { launchBrowser: () => wpw.launchChromium() }, //同 README 範例
                views: [{ name: 'demo-main', open: (page) => page.setContent(demoHtml()), regions: demoRegions() }],
            }
            let res = await WGuidechart(conf, { capture: true })
            assert.strictEqual(seen.length, 1) //取景與繪製共用一個瀏覽器, 只啟動一次, 且經 w-playwright
            assertGuard(seen[0])
            assert.strictEqual(res.length, 1)
            for (let k of ['shot', 'data', 'layout', 'svg', 'png']) {
                assert.ok(fs.existsSync(res[0].files[k]), k) //真瀏覽器取景並繪製, 5 檔皆在
            }
            assert.deepStrictEqual(res[0].issues, [])
        }
        finally {
            restore()
        }
    })

})
