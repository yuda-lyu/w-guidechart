//套件層之規則(R-GC-PKG-01、R-GC-PW-01、R-GC-PAGE-01、R-GC-API-01): 依賴只有 wsemi; dev 以 w-playwright 啟動測試用之瀏覽器, 任何依賴類別皆無 playwright、playwright-core;
//  src 不引用 playwright、sharp, 不動態執行字串, 不引用 wsemi 之內部模組; src、test、toolg 不直接匯入 playwright、playwright-core(R-PW-ONLY);
//  頁面內函式之模組只有該函式之 export 且不引用模組層識別字(無 import); 對外只有 default 匯出
import fs from 'fs'
import path from 'path'
import assert from 'assert'


let fdSrc = path.resolve('./src')
let srcs = () => fs.readdirSync(fdSrc).filter((f) => f.endsWith('.mjs')).map((f) => ({ f, c: fs.readFileSync(path.join(fdSrc, f), 'utf8') }))
let codeOf = (c) => c.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter((s) => !/^\s*\/\//.test(s)).join('\n') //去註解(JSDoc 之範例含使用端之 import)
let PAGE = ['measureInPage.mjs', 'measureTextInPage.mjs', 'cropInPage.mjs', 'decodeInPage.mjs', 'waitFontsInPage.mjs', 'waitFramesInPage.mjs']

//R-PW-ONLY 之掃描範圍: src、test、toolg 之 .mjs／.js(不含 test/_tmp 之暫存與 node_modules); 含註解(JSDoc 範例一併改寫, 不設註解例外)
let listJs = (fd) => {
    let out = []
    for (let ent of fs.readdirSync(fd, { withFileTypes: true })) {
        let fp = path.join(fd, ent.name)
        if (ent.isDirectory()) {
            if (!['_tmp', 'node_modules'].includes(ent.name)) {
                out.push(...listJs(fp))
            }
        }
        else if (/\.(mjs|js)$/.test(ent.name)) {
            out.push(fp)
        }
    }
    return out
}
let relOf = (fp) => path.relative(path.resolve('.'), fp).split(path.sep).join('/')
let filesAll = () => ['src', 'test', 'toolg'].flatMap((d) => listJs(path.resolve(d)))
//直接匯入 playwright／playwright-core(靜態 import、動態 import()、require()、含其子路徑); 帳本 R-PW-ONLY 之正則
let RE_PW = /(from\s+|import\(\s*|require\(\s*)['"`]playwright(-core)?['"`/]/
//啟動點(w-playwright 之兩個啟動函數, 及 chromium 物件之 launch 呼叫): 以字串組成, 使本檔不命中自身
let RE_LAUNCH = new RegExp(['\\blaunchChromium(Persistent)?', '\\s*\\(|\\bchromium\\s*\\.\\s*launch'].join(''))


describe('unit-pkg', function() {

    it('R-GC-PKG-01 package.json 之 dependencies 只有 wsemi; dev 有 w-playwright、無 playwright／playwright-core(任何依賴類別); 不依 sharp', function() {
        let pkg = JSON.parse(fs.readFileSync('./package.json', 'utf8'))
        assert.deepStrictEqual(Object.keys(pkg.dependencies), ['wsemi'])
        assert.ok(/^\^1\./.test(pkg.devDependencies['w-playwright'])) //w-playwright 1.x(1.0.1 起)
        for (let k of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies', 'overrides']) {
            let s = JSON.stringify(pkg[k] || {})
            assert.ok(!/"(playwright|playwright-core)"/.test(s), k)
        }
        assert.ok(!JSON.stringify(pkg).includes('sharp'))
        assert.deepStrictEqual(Object.keys(pkg.scripts).filter((k) => /test/.test(k)), ['test'])
    })

    it('R-GC-PKG-01 src 不引用 playwright、sharp; 不動態執行字串(new Function、eval); 不引用 wsemi 之內部模組(_ 開頭)', function() {
        for (let { f, c } of srcs()) {
            let code = codeOf(c)
            assert.ok(!/from\s+'(playwright|sharp)/.test(code), f)
            assert.ok(!/new Function\s*\(|\beval\s*\(/.test(code), f)
            assert.ok(!/from\s+'wsemi\/src\/_/.test(code), f)
        }
    })

    it('R-PW-ONLY 掃描正則有效: 命中靜態、動態 import 與 require(含 playwright-core 與子路徑), 不命中 w-playwright 與一般文字', function() {
        let q = String.fromCharCode(39) //單引號(以程式組成, 使本檔不命中自身之掃描)
        let hit = [
            `import { chromium } from ${q}playwright${q}`,
            `import { chromium } from ${q}playwright-core${q}`,
            `let m = await import(${q}playwright${q})`,
            `let m = require(${q}playwright-core${q})`,
            `import t from ${q}playwright/test${q}`,
        ]
        let miss = [
            `import wpw from ${q}w-playwright${q}`,
            `let m = await import(${q}w-playwright${q})`,
            '//經 playwright 啟動的說明文字',
        ]
        for (let s of hit) {
            assert.ok(RE_PW.test(s), s)
        }
        for (let s of miss) {
            assert.ok(!RE_PW.test(s), s)
        }
    })

    it('R-PW-ONLY src、test、toolg 之 .mjs／.js(含註解與 JSDoc 範例)無直接匯入 playwright／playwright-core(0 處; 掃描範圍非空)', function() {
        let files = filesAll()
        assert.ok(files.length >= 20, String(files.length)) //防空集合: src 16 檔、test 與 test/tools、toolg 5 檔
        assert.ok(files.some((fp) => relOf(fp) === 'src/WGuidechart.mjs') && files.some((fp) => relOf(fp) === 'test/tools/launch.mjs') && files.some((fp) => relOf(fp) === 'toolg/gDistRollup.mjs'))
        let hits = files.filter((fp) => RE_PW.test(fs.readFileSync(fp, 'utf8'))).map(relOf)
        assert.deepStrictEqual(hits, [])
    })

    it('R-GC-PW-01 啟動點全集: src 無任何啟動(瀏覽器由使用端注入); 測試之啟動只在 test/tools/launch.mjs(唯一啟動點)與 api-wpwWiring.test.mjs(README 範例形式之接線案)', function() {
        let hits = filesAll().filter((fp) => RE_LAUNCH.test(codeOf(fs.readFileSync(fp, 'utf8')))).map(relOf).sort() //去註解: src 之 JSDoc 範例為使用端之寫法, 不是啟動點
        assert.deepStrictEqual(hits, ['test/api-wpwWiring.test.mjs', 'test/tools/launch.mjs'])
        assert.ok(!hits.some((f) => f.startsWith('src/')))
        assert.ok(/wpw\.launchChromium\(/.test(fs.readFileSync('./test/tools/launch.mjs', 'utf8'))) //唯一啟動點經 w-playwright
    })

    it('R-GC-PAGE-01 頁面內函式之模組: 無 import、只有一個函式與其 default export, 不用展開、??、?.、async', function() {
        assert.deepStrictEqual(fs.readdirSync(fdSrc).filter((f) => /InPage\.mjs$/.test(f)).sort(), PAGE.slice().sort()) //站點全集
        for (let f of PAGE) {
            let code = codeOf(fs.readFileSync(path.join(fdSrc, f), 'utf8'))
            assert.ok(!/^\s*import\s/m.test(code), f)
            assert.strictEqual((code.match(/^function\s/mg) || []).length, 1, f)
            assert.strictEqual((code.match(/^export\s/mg) || []).length, 1, f)
            assert.ok(/^export default \w+$/m.test(code), f)
            assert.ok(!/\.\.\.|\?\?|\?\.|\basync\b|\bawait\b/.test(code), f)
        }
    })

    it('R-GC-API-01 入口只有 default 匯出(不加具名匯出)', function() {
        let c = codeOf(fs.readFileSync(path.join(fdSrc, 'WGuidechart.mjs'), 'utf8'))
        assert.deepStrictEqual(c.match(/^export\s.*$/mg), ['export default WGuidechart'])
    })

})
