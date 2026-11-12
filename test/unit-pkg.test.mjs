//套件層之規則(R-GC-PKG-01、R-GC-PAGE-01、R-GC-API-01): 依賴只有 wsemi; src 不引用 playwright、sharp, 不動態執行字串, 不引用 wsemi 之內部模組;
//  頁面內函式之模組只有該函式之 export 且不引用模組層識別字(無 import); 對外只有 default 匯出
import fs from 'fs'
import path from 'path'
import assert from 'assert'


let fdSrc = path.resolve('./src')
let srcs = () => fs.readdirSync(fdSrc).filter((f) => f.endsWith('.mjs')).map((f) => ({ f, c: fs.readFileSync(path.join(fdSrc, f), 'utf8') }))
let codeOf = (c) => c.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter((s) => !/^\s*\/\//.test(s)).join('\n') //去註解(JSDoc 之範例含使用端之 import)
let PAGE = ['measureInPage.mjs', 'measureTextInPage.mjs', 'cropInPage.mjs', 'decodeInPage.mjs', 'waitFontsInPage.mjs', 'waitFramesInPage.mjs']


describe('unit-pkg', function() {

    it('R-GC-PKG-01 package.json 之 dependencies 只有 wsemi; playwright 只在 devDependencies; 不依 sharp', function() {
        let pkg = JSON.parse(fs.readFileSync('./package.json', 'utf8'))
        assert.deepStrictEqual(Object.keys(pkg.dependencies), ['wsemi'])
        assert.ok(pkg.devDependencies.playwright)
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
