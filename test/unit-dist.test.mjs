//dist 之實跑驗證(R-GC-DIST-01; dspec〈自有套件之發布與建置腳本〉規則 4): 複製 src、toolg/gDistRollup.mjs、package.json 至 test/_tmp/dist/ 並以 spawn 指定 cwd 執行 toolg 腳本(不改寫 repo 之 dist/),
//  再以 dist 之 WGuidechart 跑合成頁之全流程(含裁切, 使頁面內之量框、量字寬、裁切、等待函式皆經 dist 執行), 結果須與 src 相同
import fs from 'fs'
import path from 'path'
import assert from 'assert'
import { builtinModules, createRequire } from 'module'
import { spawnSync } from 'child_process'
import { chromium } from 'playwright'
import WGuidechartSrc from '../src/WGuidechart.mjs'
import { demoHtml, demoRegions } from './tools/demoPage.mjs'


describe('unit-dist', function() {
    this.timeout(300000)

    let fdTest = path.resolve('./test/_tmp/dist')
    let fdRepo = path.resolve('.')
    let fdOk = path.join(fdTest, 'ok')
    let res = null

    before(function() {
        fs.rmSync(fdTest, { recursive: true, force: true })
        fs.mkdirSync(path.join(fdOk, 'src'), { recursive: true })
        fs.mkdirSync(path.join(fdOk, 'toolg'), { recursive: true })
        for (let fn of fs.readdirSync(path.join(fdRepo, 'src'))) {
            fs.copyFileSync(path.join(fdRepo, 'src', fn), path.join(fdOk, 'src', fn))
        }
        fs.copyFileSync(path.join(fdRepo, 'toolg', 'gDistRollup.mjs'), path.join(fdOk, 'toolg', 'gDistRollup.mjs'))
        fs.copyFileSync(path.join(fdRepo, 'package.json'), path.join(fdOk, 'package.json'))
        let r = spawnSync(process.execPath, ['toolg/gDistRollup.mjs'], { cwd: fdOk, encoding: 'utf8', timeout: 300000, windowsHide: true })
        res = { code: r.status, out: (r.stdout || '') + (r.stderr || '') }
    })

    after(function() {
        fs.rmSync(fdTest, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 })
        try {
            fs.rmdirSync(path.resolve('./test/_tmp')) //尚有其他測試之暫存時非空, 略過
        }
        catch (err) {} // eslint-disable-line no-empty
    })

    it('建置離開碼 0、無無法解析之引入, 產 dist/w-guidechart.umd.js(與 package.json 之 main 相符)', function() {
        assert.strictEqual(res.code, 0, res.out.slice(-1000))
        assert.ok(!/could not be resolved/.test(res.out), res.out)
        let main = JSON.parse(fs.readFileSync(path.join(fdRepo, 'package.json'), 'utf8')).main
        assert.strictEqual(main, 'dist/w-guidechart.umd.js')
        assert.ok(fs.existsSync(path.join(fdOk, main)))
    })

    it('dist 之外部模組只有 Node 內建與 dependencies; 不 require playwright、sharp', function() {
        let c = fs.readFileSync(path.join(fdOk, 'dist', 'w-guidechart.umd.js'), 'utf8')
        let reqs = [...new Set([...c.matchAll(/require\("([^"]+)"\)/g)].map((m) => m[1]))]
        let deps = Object.keys(JSON.parse(fs.readFileSync(path.join(fdRepo, 'package.json'), 'utf8')).dependencies)
        assert.ok(reqs.length > 0)
        assert.deepStrictEqual(reqs.filter((m) => !builtinModules.includes(m) && !deps.includes(m)), [])
        assert.ok(!reqs.includes('playwright') && !reqs.includes('sharp'))
    })

    it('dist 以 require 載入為函數, 只帶靜態之 defaultStyle、defaultLayout(深凍結, 與 src 相同)', function() {
        let W = createRequire(import.meta.url)(path.join(fdOk, 'dist', 'w-guidechart.umd.js'))
        assert.strictEqual(typeof W, 'function')
        assert.deepStrictEqual(Object.keys(W).sort(), ['defaultLayout', 'defaultStyle'])
        assert.deepStrictEqual(W.defaultStyle, WGuidechartSrc.defaultStyle)
        assert.deepStrictEqual(W.defaultLayout, WGuidechartSrc.defaultLayout)
        assert.ok(Object.isFrozen(W.defaultStyle) && Object.isFrozen(W.defaultStyle.shadow) && Object.isFrozen(W.defaultLayout))
    })

    it('以 dist 跑合成頁之全流程(取景、裁切、繪製), layout.json 與 src 逐鍵相同', async function() {
        let W = createRequire(import.meta.url)(path.join(fdOk, 'dist', 'w-guidechart.umd.js'))
        let mk = (dirWork) => ({
            dirWork,
            env: { launchBrowser: () => chromium.launch() },
            views: [
                { name: 'demo-main', open: (page) => page.setContent(demoHtml()), regions: demoRegions() },
                { name: 'demo-crop', crop: [300, 100, 1400, 800], open: (page) => page.setContent(demoHtml()), regions: demoRegions().filter((g) => ['查詢列', '圖區', '分頁列'].includes(g.label)) },
            ],
        })
        let a = await W(mk(path.join(fdTest, 'w-dist')), { capture: true })
        let b = await WGuidechartSrc(mk(path.join(fdTest, 'w-src')), { capture: true })
        assert.strictEqual(a.length, 2)
        for (let k = 0; k < 2; k++) {
            let ja = JSON.parse(fs.readFileSync(a[k].files.layout, 'utf8'))
            let jb = JSON.parse(fs.readFileSync(b[k].files.layout, 'utf8'))
            assert.deepStrictEqual(ja, jb)
            assert.ok(Buffer.compare(fs.readFileSync(a[k].files.shot), fs.readFileSync(b[k].files.shot)) === 0) //取景之截圖相同
            assert.strictEqual(fs.readFileSync(a[k].files.svg, 'utf8'), fs.readFileSync(b[k].files.svg, 'utf8')) //svg(含裁切後之內嵌截圖)相同
        }
    })

})
