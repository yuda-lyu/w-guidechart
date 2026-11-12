//輸入檢測之測試(表驅動; dspec〈輸入參數之檢測機制〉V24): R-GC-ARG-01～05
//  必給鍵無效: 經公開入口 WGuidechart, 斷言 reject E_ARG 與訊息全文, 且無副作用(資料夾未建、launchBrowser 未被呼叫)
//  選填鍵無效: 經 parseConf(入口之檢測模組)斷言改用預設(K3)、數字字串轉為數值(K4); debug 之警告經入口斷言恰一次且不含值(K9)
import fs from 'fs'
import path from 'path'
import assert from 'assert'
import WGuidechart from '../src/WGuidechart.mjs'
import parseConf from '../src/parseConf.mjs'
import { defaultStyle, defaultLayout } from '../src/defaults.mjs'


let fdTmp = path.resolve('./test/_tmp/conf')
let spy = () => {
    let st = { n: 0 }
    let launchBrowser = () => {
        st.n++
        throw new Error('must not launch')
    }
    return { st, launchBrowser }
}
let base = (dirWork, launchBrowser) => ({
    dirWork,
    env: { launchBrowser },
    views: [{ name: 'a', open: () => {}, regions: [{ label: '甲', find: { sel: '#x' } }] }],
})
let pc = (mut, opt) => {
    let c = base('./test/_tmp/conf/pc', () => null)
    if (mut) {
        mut(c)
    }
    return parseConf(c, opt)
}
let v0 = (P) => P.cfg.views[0]
let r0 = (P) => P.cfg.views[0].regions[0]

//必給鍵之無效輸入: [說明, 改寫, 訊息]
let NAME = 'invalid conf.views[0].name: must be a safe file name (letters, digits, . _ -; not reserved)'
let FIND = 'invalid conf.views[0].regions[0].find: must be a find object with exactly one of sel, at, fn, union'
class Klass {}
let bads = [
    ['conf 為 null', (c) => null, 'invalid conf: must be a plain object'],
    ['conf 為陣列', (c) => [], 'invalid conf: must be a plain object'],
    ['conf 為類別實例', (c) => new Klass(), 'invalid conf: must be a plain object'],
    ['dirWork 未給', (c) => {
        delete c.dirWork
    }, 'invalid conf.dirWork: must be a non-empty path string without NUL'],
    ['dirWork 為 null', (c) => {
        c.dirWork = null
    }, 'invalid conf.dirWork: must be a non-empty path string without NUL'],
    ['dirWork 為空字串', (c) => {
        c.dirWork = ''
    }, 'invalid conf.dirWork: must be a non-empty path string without NUL'],
    ['dirWork 為數字', (c) => {
        c.dirWork = 5
    }, 'invalid conf.dirWork: must be a non-empty path string without NUL'],
    ['dirWork 含 NUL', (c) => {
        c.dirWork = 'a\0b'
    }, 'invalid conf.dirWork: must be a non-empty path string without NUL'],
    ['dirWork 為包裝字串', (c) => {
        c.dirWork = new String('x') // eslint-disable-line no-new-wrappers
    }, 'invalid conf.dirWork: must be a non-empty path string without NUL'],
    ['dirWork 之讀取拋錯', (c) => {
        Object.defineProperty(c, 'dirWork', {
            get() {
                throw new Error('x')
            },
            enumerable: true
        })
    }, 'invalid conf.dirWork: must be a non-empty path string without NUL'],
    ['env 未給', (c) => {
        delete c.env
    }, 'invalid conf.env: must be a plain object'],
    ['env 為陣列', (c) => {
        c.env = []
    }, 'invalid conf.env: must be a plain object'],
    ['launchBrowser 未給', (c) => {
        c.env = {}
    }, 'invalid conf.env.launchBrowser: must be a function'],
    ['launchBrowser 為字串', (c) => {
        c.env = { launchBrowser: 'chromium' }
    }, 'invalid conf.env.launchBrowser: must be a function'],
    ['views 未給', (c) => {
        delete c.views
    }, 'invalid conf.views: must be a non-empty array of plain objects'],
    ['views 為空陣列', (c) => {
        c.views = []
    }, 'invalid conf.views: must be a non-empty array of plain objects'],
    ['views 為物件', (c) => {
        c.views = {}
    }, 'invalid conf.views: must be a non-empty array of plain objects'],
    ['views[0] 為 null', (c) => {
        c.views = [null]
    }, 'invalid conf.views[0]: must be a plain object'],
    ['views[0] 為字串', (c) => {
        c.views = ['a']
    }, 'invalid conf.views[0]: must be a plain object'],
    ['name 未給', (c) => {
        delete c.views[0].name
    }, NAME],
    ['name 為空字串', (c) => {
        c.views[0].name = ''
    }, NAME],
    ['name 含 ..', (c) => {
        c.views[0].name = '../x'
    }, NAME],
    ['name 含斜線', (c) => {
        c.views[0].name = 'a/b'
    }, NAME],
    ['name 含反斜線', (c) => {
        c.views[0].name = 'a\\b'
    }, NAME],
    ['name 為保留名', (c) => {
        c.views[0].name = 'con'
    }, NAME],
    ['name 為帶副檔名之保留名', (c) => {
        c.views[0].name = 'NUL.txt'
    }, NAME],
    ['name 以 . 結尾', (c) => {
        c.views[0].name = 'x.'
    }, NAME],
    ['name 以 .layout 結尾', (c) => {
        c.views[0].name = 'x.Layout'
    }, NAME],
    ['name 以 . 開頭', (c) => {
        c.views[0].name = '.x'
    }, NAME],
    ['name 超過 100 字元', (c) => {
        c.views[0].name = 'a'.repeat(101)
    }, NAME],
    ['name 為數字', (c) => {
        c.views[0].name = 5
    }, NAME],
    ['name 重複(不分大小寫)', (c) => {
        c.views.push({ name: 'A', open: () => {}, regions: [] })
    }, 'invalid conf.views[1].name: must be unique among conf.views (case-insensitive)'],
    ['open 未給', (c) => {
        delete c.views[0].open
    }, 'invalid conf.views[0].open: must be a function'],
    ['open 為字串', (c) => {
        c.views[0].open = 'page.goto()'
    }, 'invalid conf.views[0].open: must be a function'],
    ['regions 未給', (c) => {
        delete c.views[0].regions
    }, 'invalid conf.views[0].regions: must be an array of plain objects'],
    ['regions 為物件', (c) => {
        c.views[0].regions = {}
    }, 'invalid conf.views[0].regions: must be an array of plain objects'],
    ['regions[0] 為數字', (c) => {
        c.views[0].regions = [5]
    }, 'invalid conf.views[0].regions[0]: must be a plain object'],
    ['label 未給', (c) => {
        delete c.views[0].regions[0].label
    }, 'invalid conf.views[0].regions[0].label: must be a non-empty well-formed string without control characters'],
    ['label 為空字串', (c) => {
        c.views[0].regions[0].label = ''
    }, 'invalid conf.views[0].regions[0].label: must be a non-empty well-formed string without control characters'],
    ['label 含換行', (c) => {
        c.views[0].regions[0].label = '甲\n乙'
    }, 'invalid conf.views[0].regions[0].label: must be a non-empty well-formed string without control characters'],
    ['label 含孤立代理字元', (c) => {
        c.views[0].regions[0].label = '甲\uD800乙'
    }, 'invalid conf.views[0].regions[0].label: must be a non-empty well-formed string without control characters'],
    ['label 為數字', (c) => {
        c.views[0].regions[0].label = 5
    }, 'invalid conf.views[0].regions[0].label: must be a non-empty well-formed string without control characters'],
    ['find 未給', (c) => {
        delete c.views[0].regions[0].find
    }, FIND],
    ['find 為空物件', (c) => {
        c.views[0].regions[0].find = {}
    }, FIND],
    ['find 給兩種', (c) => {
        c.views[0].regions[0].find = { sel: '#a', at: [1, 2] }
    }, FIND],
    ['find 為字串', (c) => {
        c.views[0].regions[0].find = '#a'
    }, FIND],
    ['find.sel 為空字串', (c) => {
        c.views[0].regions[0].find = { sel: '' }
    }, 'invalid conf.views[0].regions[0].find.sel: must be a non-empty string'],
    ['find.at 長度 1', (c) => {
        c.views[0].regions[0].find = { at: [1] }
    }, 'invalid conf.views[0].regions[0].find.at: must be an array of two non-negative numbers'],
    ['find.at 含負數', (c) => {
        c.views[0].regions[0].find = { at: [-1, 2] }
    }, 'invalid conf.views[0].regions[0].find.at: must be an array of two non-negative numbers'],
    ['find.at 含非數字字串', (c) => {
        c.views[0].regions[0].find = { at: ['a', 2] }
    }, 'invalid conf.views[0].regions[0].find.at: must be an array of two non-negative numbers'],
    ['find.fn 為字串(原型之函式本體)', (c) => {
        c.views[0].regions[0].find = { fn: 'return {x1:0,y1:0,x2:9,y2:9}' }
    }, 'invalid conf.views[0].regions[0].find.fn: must be a function'],
    ['find.union 為空陣列', (c) => {
        c.views[0].regions[0].find = { union: [] }
    }, 'invalid conf.views[0].regions[0].find.union: must be a non-empty array of find objects'],
    ['find.union 之成員無效', (c) => {
        c.views[0].regions[0].find = { union: [{ sel: '#a' }, {}] }
    }, 'invalid conf.views[0].regions[0].find.union[1]: must be a find object with exactly one of sel, at, fn, union'],
    ['find.union 自我參照', (c) => {
        let f = { union: [] }
        f.union.push(f)
        c.views[0].regions[0].find = f
    }, 'invalid conf.views[0].regions[0].find.union[0]: must be a find object nested at most 8 levels without cycles'],
]


describe('unit-conf', function() {

    before(function() {
        fs.rmSync(fdTmp, { recursive: true, force: true })
    })

    after(function() {
        fs.rmSync(fdTmp, { recursive: true, force: true })
        try {
            fs.rmdirSync(path.resolve('./test/_tmp')) //尚有其他測試之暫存時非空, 略過
        }
        catch (err) {} // eslint-disable-line no-empty
    })

    describe('R-GC-ARG-01 必給鍵無效即 reject E_ARG(訊息不含值), 且無副作用', function() {
        bads.forEach(([title, mut, msg], k) => {
            it(title, async function() {
                let dirWork = path.join(fdTmp, `bad${k}`)
                let s = spy()
                let c = base(dirWork, s.launchBrowser)
                let r = mut(c)
                if (r !== undefined) {
                    c = r
                }
                let err = null
                try {
                    await WGuidechart(c, { capture: true })
                }
                catch (e) {
                    err = e
                }
                assert.ok(err, 'must reject')
                assert.strictEqual(err.code, 'E_ARG')
                assert.strictEqual(err.message, msg)
                assert.strictEqual(s.st.n, 0) //未起瀏覽器
                assert.strictEqual(fs.existsSync(dirWork), false) //未建資料夾(V17)
            })
        })

        it('WGuidechart 不同步拋錯(回傳 Promise 之入口一律 reject)', function() {
            let p = WGuidechart(undefined)
            assert.ok(p instanceof Promise)
            return p.then(() => assert.fail('must reject'), (e) => assert.strictEqual(e.code, 'E_ARG'))
        })

        it('opt.names 含不存在之圖名 → reject E_VIEW_NOT_FOUND(帶索引不帶值), 且無副作用', async function() {
            let dirWork = path.join(fdTmp, 'names')
            let s = spy()
            let err = await WGuidechart(base(dirWork, s.launchBrowser), { names: ['a', 'secretName'] }).catch((e) => e)
            assert.strictEqual(err.code, 'E_VIEW_NOT_FOUND')
            assert.strictEqual(err.message, 'view not found: opt.names[1]')
            assert.strictEqual(s.st.n, 0)
            assert.strictEqual(fs.existsSync(dirWork), false)
        })
    })

    describe('R-GC-ARG-02 選填鍵無效視為未給、改用預設(K3); 數字字串轉為數值(K4)', function() {
        let rows = [
            ['dirPng 未給 → <dirWork>/png', null, (P) => P.cfg.dirs.png, path.resolve('./test/_tmp/conf/pc/png')],
            ['dirPng 為數字 → 預設', (c) => {
                c.dirPng = 5
            }, (P) => P.cfg.dirs.png, path.resolve('./test/_tmp/conf/pc/png')],
            ['dirPng 有效', (c) => {
                c.dirPng = './test/_tmp/conf/out'
            }, (P) => P.cfg.dirs.png, path.resolve('./test/_tmp/conf/out')],
            ['style 為字串 → 整份預設', (c) => {
                c.style = 'red'
            }, (P) => v0(P).st, defaultStyle],
            ['style.frame 屬性斷開之字串 → 預設', (c) => {
                c.style = { frame: '#f00" data-x="1' }
            }, (P) => v0(P).st.frame, '#FF0606'],
            ['style.frame 英文色名有效', (c) => {
                c.style = { frame: 'red' }
            }, (P) => v0(P).st.frame, 'red'],
            ['style.frame #abc 有效', (c) => {
                c.style = { frame: '#abc' }
            }, (P) => v0(P).st.frame, '#abc'],
            ['style.font 含引號 → 預設', (c) => {
                c.style = { font: 'A"B' }
            }, (P) => v0(P).st.font, 'Microsoft JhengHei'],
            ['style.font 含 < → 預設', (c) => {
                c.style = { font: 'A<B' }
            }, (P) => v0(P).st.font, 'Microsoft JhengHei'],
            ['style.font 含孤立代理字元 → 預設', (c) => {
                c.style = { font: 'A\uDC00B' }
            }, (P) => v0(P).st.font, 'Microsoft JhengHei'],
            ['label 含擴充平面字元(成對代理)有效', (c) => {
                c.views[0].regions[0].label = '甲𠀀'
            }, (P) => r0(P).label, '甲𠀀'],
            ['style.font 有效', (c) => {
                c.style = { font: 'Arial' }
            }, (P) => v0(P).st.font, 'Arial'],
            ['style.fs 數字字串 → 數值', (c) => {
                c.style = { fs: ' 30 ' }
            }, (P) => v0(P).st.fs, 30],
            ['style.fs 為 0 → 預設', (c) => {
                c.style = { fs: 0 }
            }, (P) => v0(P).st.fs, 36],
            ['style.fs 超過 400 → 預設', (c) => {
                c.style = { fs: 401 }
            }, (P) => v0(P).st.fs, 36],
            ['style.fs 為 true → 預設', (c) => {
                c.style = { fs: true }
            }, (P) => v0(P).st.fs, 36],
            ['style.fs 為包裝數字 → 預設', (c) => {
                c.style = { fs: new Number(30) } // eslint-disable-line no-new-wrappers
            }, (P) => v0(P).st.fs, 36],
            ['style.fs 為 BigInt → 預設', (c) => {
                c.style = { fs: 30n }
            }, (P) => v0(P).st.fs, 36],
            ['style.fs 為 NaN → 預設', (c) => {
                c.style = { fs: NaN }
            }, (P) => v0(P).st.fs, 36],
            ['style.fs 為 \'0x10\' → 預設', (c) => {
                c.style = { fs: '0x10' }
            }, (P) => v0(P).st.fs, 36],
            ['style.shadow 為 null → 不加陰影', (c) => {
                c.style = { shadow: null }
            }, (P) => v0(P).st.shadow, null],
            ['style.shadow 只給 blur → 逐鍵合併', (c) => {
                c.style = { shadow: { blur: 5 } }
            }, (P) => v0(P).st.shadow, { ...defaultStyle.shadow, blur: 5 }],
            ['style.shadow 之 opacity 超出 → 該鍵預設', (c) => {
                c.style = { shadow: { opacity: 2 } }
            }, (P) => v0(P).st.shadow, defaultStyle.shadow],
            ['style.shadow 為字串 → 預設', (c) => {
                c.style = { shadow: 'x' }
            }, (P) => v0(P).st.shadow, defaultStyle.shadow],
            ['各圖之 style 覆寫全域', (c) => {
                c.style = { fs: 30 }
                c.views[0].style = { frame: 'blue' }
            }, (P) => [v0(P).st.fs, v0(P).st.frame], [30, 'blue']],
            ['layout.ext 數字字串 → 數值', (c) => {
                c.layout = { ext: '100' }
            }, (P) => v0(P).lay.ext, 100],
            ['layout.ext 為 Infinity → 預設', (c) => {
                c.layout = { ext: Infinity }
            }, (P) => v0(P).lay.ext, 100],
            ['layout.minGap 含空白之數字字串 → 數值', (c) => {
                c.layout = { minGap: ' 40 ' }
            }, (P) => v0(P).lay.minGap, 40],
            ['layout.tierGap 為 null → null', (c) => {
                c.layout = { tierGap: null }
            }, (P) => v0(P).lay.tierGap, null],
            ['layout.tierGap 為 0 → 預設 null', (c) => {
                c.layout = { tierGap: 0 }
            }, (P) => v0(P).lay.tierGap, null],
            ['layout.tierGap 有效', (c) => {
                c.layout = { tierGap: 60 }
            }, (P) => v0(P).lay.tierGap, 60],
            ['layout.spread 非列舉 → 預設', (c) => {
                c.layout = { spread: 'wide' }
            }, (P) => v0(P).lay.spread, 'even'],
            ['layout.join 大寫 → 預設', (c) => {
                c.layout = { join: 'L' }
            }, (P) => v0(P).lay.join, 'l'],
            ['layout.sideEdges 為 \'false\' → 預設(B1 只收布林)', (c) => {
                c.layout = { sideEdges: 'false' }
            }, (P) => v0(P).lay.sideEdges, true],
            ['layout.sideEdges 為 false 有效', (c) => {
                c.layout = { sideEdges: false }
            }, (P) => v0(P).lay.sideEdges, false],
            ['layout.canvasW 為小數 → 預設', (c) => {
                c.layout = { canvasW: 1.5 }
            }, (P) => v0(P).lay.canvasW, 0],
            ['layout.canvasW 數字字串 → 數值', (c) => {
                c.layout = { canvasW: '2000' }
            }, (P) => v0(P).lay.canvasW, 2000],
            ['layout 為陣列 → 整份預設', (c) => {
                c.layout = []
            }, (P) => v0(P).lay, defaultLayout],
            ['capture 未給 → 預設', null, (P) => P.cfg.capture, { mousePark: [1000, 4], settle: 'stable', settleMs: 5000 }],
            ['capture.mousePark 為 null → 不停放', (c) => {
                c.capture = { mousePark: null }
            }, (P) => P.cfg.capture.mousePark, null],
            ['capture.mousePark 長度 1 → 預設', (c) => {
                c.capture = { mousePark: [1] }
            }, (P) => P.cfg.capture.mousePark, [1000, 4]],
            ['capture.mousePark 數字字串 → 數值', (c) => {
                c.capture = { mousePark: ['10', '20'] }
            }, (P) => P.cfg.capture.mousePark, [10, 20]],
            ['capture.settle 非列舉 → 預設', (c) => {
                c.capture = { settle: 'none' }
            }, (P) => P.cfg.capture.settle, 'stable'],
            ['capture.settle 為 fonts', (c) => {
                c.capture = { settle: 'fonts' }
            }, (P) => P.cfg.capture.settle, 'fonts'],
            ['capture.settleMs 為 0 → 預設', (c) => {
                c.capture = { settleMs: 0 }
            }, (P) => P.cfg.capture.settleMs, 5000],
            ['capture.settleMs 超過計時上限 → 預設', (c) => {
                c.capture = { settleMs: 2147483648 }
            }, (P) => P.cfg.capture.settleMs, 5000],
            ['capture.settleMs 數字字串 → 數值', (c) => {
                c.capture = { settleMs: '300' }
            }, (P) => P.cfg.capture.settleMs, 300],
            ['crop 長度 3 → 預設(全畫面)', (c) => {
                c.views[0].crop = [0, 0, 10]
            }, (P) => v0(P).crop, null],
            ['crop x1 ≥ x2 → 預設', (c) => {
                c.views[0].crop = [10, 0, 5, 5]
            }, (P) => v0(P).crop, null],
            ['crop 含小數 → 預設', (c) => {
                c.views[0].crop = [0, 0, 10.5, 10]
            }, (P) => v0(P).crop, null],
            ['crop 數字字串 → 數值', (c) => {
                c.views[0].crop = ['0', '0', '100', '100']
            }, (P) => v0(P).crop, [0, 0, 100, 100]],
            ['覆寫 side 非列舉 → 視為未給', (c) => {
                c.views[0].regions[0].side = 'up'
            }, (P) => r0(P).ovr, {}],
            ['覆寫 ax 超出 0～1 → 視為未給', (c) => {
                c.views[0].regions[0].ax = 2
            }, (P) => r0(P).ovr, {}],
            ['覆寫 anchor 缺 at → 整個 anchor 視為未給', (c) => {
                c.views[0].regions[0].anchor = { edge: 'top' }
            }, (P) => r0(P).ovr, {}],
            ['覆寫 anchor 有效', (c) => {
                c.views[0].regions[0].anchor = { edge: 'right', at: '0.5' }
            }, (P) => r0(P).ovr, { anchor: { edge: 'right', at: 0.5 } }],
            ['覆寫 tier 為 4 → 視為未給(至多 3)', (c) => {
                c.views[0].regions[0].tier = 4
            }, (P) => r0(P).ovr, {}],
            ['覆寫 tier 數字字串 → 數值', (c) => {
                c.views[0].regions[0].tier = '1'
            }, (P) => r0(P).ovr, { tier: 1 }],
            ['覆寫 x 非數字 → 視為未給; dx 有效', (c) => {
                c.views[0].regions[0].x = 'a'
                c.views[0].regions[0].dx = -50
            }, (P) => r0(P).ovr, { dx: -50 }],
            ['覆寫 join 非列舉 → 視為未給', (c) => {
                c.views[0].regions[0].join = 'x'
            }, (P) => r0(P).ovr, {}],
            ['find.mode 非列舉 → fit; pad 預設 fit 為 6', (c) => {
                c.views[0].regions[0].find = { sel: '#a', mode: 'x' }
            }, (P) => [r0(P).find.mode, r0(P).find.pad], ['fit', 6]],
            ['find.mode 為 box → pad 預設 2', (c) => {
                c.views[0].regions[0].find = { sel: '#a', mode: 'box' }
            }, (P) => r0(P).find.pad, 2],
            ['find.fn → pad 預設 2, arg 原樣', (c) => {
                c.views[0].regions[0].find = { fn: () => null, arg: { k: 1 } }
            }, (P) => [r0(P).find.pad, r0(P).find.arg], [2, { k: 1 }]],
            ['find.pad 為負 → 預設', (c) => {
                c.views[0].regions[0].find = { sel: '#a', pad: -1 }
            }, (P) => r0(P).find.pad, 6],
            ['find.minW 非數字 → 0; at 數字字串 → 數值', (c) => {
                c.views[0].regions[0].find = { at: ['10', 20], minW: 'a', minH: '30' }
            }, (P) => [r0(P).find.at, r0(P).find.minW, r0(P).find.minH], [[10, 20], 0, 30]],
            ['未宣告之鍵忽略(V7)', (c) => {
                c.views[0].cap = '某圖'
                c.views[0].openOpt = { a: 1 }
            }, (P) => v0(P).src.cap, '某圖'],
            ['opt 為字串 → 整份預設', null, (P) => P.o, { capture: false, debug: false, names: null, funLog: null, onTrace: null }, 'x'],
            ['opt.capture 為 \'true\' → 預設 false', null, (P) => P.o.capture, false, { capture: 'true' }],
            ['opt.names 為字串 → 預設(全部)', null, (P) => P.o.names, null, { names: 'a' }],
            ['opt.names 含空字串 → 預設(全部)', null, (P) => P.o.names, null, { names: [''] }],
            ['opt.funLog、onTrace 非函數 → 預設', null, (P) => [P.o.funLog, P.o.onTrace], [null, null], { funLog: 5, onTrace: 'x' }],
            ['選填鍵之讀取拋錯 → 預設(V11)', (c) => {
                c.style = {}
                Object.defineProperty(c.style, 'fs', {
                    get() {
                        throw new Error('x')
                    },
                    enumerable: true
                })
            }, (P) => v0(P).st.fs, 36],
        ]
        rows.forEach(([title, mut, get, want, opt]) => {
            it(title, function() {
                let P = pc(mut, opt)
                assert.strictEqual(P.err, null, P.err && P.err.message)
                assert.deepStrictEqual(get(P), want)
            })
        })

        it('不改寫呼叫端之物件(V9): 深凍結之 conf 可解析且解析結果為新物件', function() {
            let deepFreeze = (o) => {
                if (o && typeof o === 'object' && !Object.isFrozen(o)) {
                    Object.freeze(o)
                    Object.values(o).forEach(deepFreeze)
                }
                return o
            }
            let c = base('./test/_tmp/conf/pc', () => null)
            c.style = { shadow: { blur: 5 } }
            c.layout = { ext: '100' }
            deepFreeze(c)
            let P = parseConf(c)
            assert.strictEqual(P.err, null)
            assert.notStrictEqual(v0(P).st.shadow, c.style.shadow)
            assert.strictEqual(c.layout.ext, '100')
        })
    })

    describe('R-GC-ARG-03 opt.debug 之警告: 每鍵恰一次、不含值, 經 funLog 或 console.warn', function() {

        it('debug 為 true 且有 funLog: 經公開入口, 兩個無效鍵各警告一次(訊息全文), 不含值', async function() {
            let logs = []
            let c = base(path.join(fdTmp, 'warn1'), spy().launchBrowser)
            c.style = { fs: 'secret-value-1', frame: 'secret-value-2' }
            delete c.views //使入口於檢測後 reject, 不起瀏覽器
            let err = await WGuidechart(c, { debug: true, funLog: (label, info) => logs.push([label, info]) }).catch((e) => e)
            assert.strictEqual(err.code, 'E_ARG')
            assert.deepStrictEqual(logs, [
                ['warn', { msg: '[w-guidechart] invalid conf.style.frame: must be a color #rgb, #rrggbb or a color name, using the default' }],
                ['warn', { msg: '[w-guidechart] invalid conf.style.fs: must be a positive number up to 400, using the default' }],
            ])
            assert.ok(!JSON.stringify(logs).includes('secret-value'))
        })

        it('debug 為 true 而無 funLog: 經 console.warn; debug 為 false: 不警告', async function() {
            let got = []
            let w0 = console.warn
            console.warn = (m) => got.push(m)
            try {
                let c = base(path.join(fdTmp, 'warn2'), spy().launchBrowser)
                c.layout = { ext: 'x' }
                delete c.views
                await WGuidechart(c, { debug: true }).catch(() => {})
                assert.deepStrictEqual(got, ['[w-guidechart] invalid conf.layout.ext: must be a non-negative number up to 10000, using the default'])
                got.length = 0
                await WGuidechart(c, { debug: false }).catch(() => {})
                await WGuidechart(c).catch(() => {})
                assert.deepStrictEqual(got, [])
            }
            finally {
                console.warn = w0
            }
        })

        it('debug 非布林視為 false', function() {
            let P = pc((c) => {
                c.style = { fs: 'x' }
            }, { debug: 'true' })
            assert.deepStrictEqual(P.warns, [])
        })
    })

    describe('R-GC-ARG-02 宣告表之逐鍵接線: style、layout 每鍵之無效值改用預設、有效值採用(含 debug 警告恰一則)', function() {
        let all = [
            ...Object.keys(defaultStyle).filter((k) => k !== 'shadow').map((k) => ['style', k, defaultStyle[k]]),
            ...Object.keys(defaultLayout).map((k) => ['layout', k, defaultLayout[k]]),
        ]
        all.forEach(([grp, key, def]) => {
            it(`${grp}.${key}`, function() {
                let bad = pc((c) => {
                    c[grp] = { [key]: 'zz"bad' } //非數字、非列舉、非布林、非顏色, 字型亦不收引號
                }, { debug: true })
                assert.strictEqual(bad.err, null)
                let got = grp === 'style' ? v0(bad).st[key] : v0(bad).lay[key]
                assert.deepStrictEqual(got, def) //無效 → 預設
                assert.strictEqual(bad.warns.length, 1)
                assert.ok(bad.warns[0].startsWith(`[w-guidechart] invalid conf.${grp}.${key}: must be `) && !bad.warns[0].includes('zz'))
                let valid = typeof def === 'number' ? def + (key === 'canvasW' ? 100 : 1) : typeof def === 'boolean' ? !def : def === null ? 50 : def
                if (key === 'spread') {
                    valid = 'near'
                }
                if (key === 'join') {
                    valid = 'auto'
                }
                if (['frame', 'lead', 'textColor'].includes(key)) {
                    valid = 'blue'
                }
                if (key === 'font') {
                    valid = 'Arial'
                }
                let g = pc((c) => {
                    c[grp] = { [key]: valid }
                })
                assert.deepStrictEqual(grp === 'style' ? v0(g).st[key] : v0(g).lay[key], valid) //有效 → 採用
            })
        })
    })

    describe('R-GC-ARG-01、02 外審補案: 偽陣列、空洞、可撤銷之 Proxy、拋錯之 Symbol.toStringTag、F1、XML 字元、find.arg', function() {
        let rejects = async (c, msg) => {
            let s = spy()
            let err = await WGuidechart(c, { capture: true }).then(() => null, (e) => e)
            assert.ok(err, 'must reject')
            assert.strictEqual(err.code, 'E_ARG')
            assert.strictEqual(err.message, msg)
            assert.strictEqual(s.st.n, 0)
        }
        let view = () => ({ name: 'a', open: () => {}, regions: [{ label: '甲', find: { sel: '#x' } }] })

        it('views 為偽陣列(Symbol.toStringTag 為 Array)→ E_ARG; views 有空洞 → E_ARG', async function() {
            let c = base(path.join(fdTmp, 'pseudo'), spy().launchBrowser)
            c.views = { 0: view(), length: 1, [Symbol.toStringTag]: 'Array' }
            await rejects(c, 'invalid conf.views: must be a non-empty array of plain objects')
            let c2 = base(path.join(fdTmp, 'hole'), spy().launchBrowser)
            c2.views = [, view()] // eslint-disable-line no-sparse-arrays
            await rejects(c2, 'invalid conf.views[0]: must be a plain object')
        })

        it('conf 之 Symbol.toStringTag 讀取拋錯 → E_ARG(不逸出原錯誤); conf 為可撤銷之 Proxy(已撤銷)→ E_ARG', async function() {
            let c = base(path.join(fdTmp, 'tag'), spy().launchBrowser)
            Object.defineProperty(c, Symbol.toStringTag, {
                get() {
                    throw new Error('tag secret')
                }
            })
            await rejects(c, 'invalid conf: must be a plain object')
            let pr = Proxy.revocable(base(path.join(fdTmp, 'rev'), spy().launchBrowser), {})
            pr.revoke()
            await rejects(pr.proxy, 'invalid conf: must be a plain object')
        })

        it('選填之 style 為已撤銷之 Proxy → 預設; env.openPage 非函數 → 預設; env.afterCapture 非函數 → 預設', function() {
            let pr = Proxy.revocable({ fs: 30 }, {})
            pr.revoke()
            let P = pc((c) => {
                c.style = pr.proxy
                c.env.openPage = 'x'
                c.env.afterCapture = 5
            })
            assert.strictEqual(P.err, null)
            assert.deepStrictEqual(v0(P).st, defaultStyle)
            assert.strictEqual(P.cfg.env.openPage, null)
            assert.strictEqual(P.cfg.env.afterCapture, null)
        })

        it('F1 之判定同 wsemi isfun: async generator 函數作 onTrace → 預設 null; async 函數作 open 有效', function() {
            let P = pc((c) => {
                c.views[0].open = async () => {}
            }, { onTrace: async function * () {} })
            assert.strictEqual(P.err, null)
            assert.strictEqual(P.o.onTrace, null)
        })

        it('label 含 U+FFFE、C1 控制字元 U+0085 → E_ARG; font 含 U+0085 → 預設', async function() {
            for (let s of ['甲\uFFFE', '甲\u0085']) {
                let c = base(path.join(fdTmp, 'xml'), spy().launchBrowser)
                c.views[0].regions[0].label = s
                await rejects(c, 'invalid conf.views[0].regions[0].label: must be a non-empty well-formed string without control characters')
            }
            let P = pc((c) => {
                c.style = { font: 'A\u0085B' }
            })
            assert.strictEqual(v0(P).st.font, 'Microsoft JhengHei')
        })

        it('find.arg 之核對鍵帶型別: NaN 與 null、1n 與 2n、-0 與 0、undefined 與未給 各自區分或相同', function() {
            let key = (arg, has = true) => r0(pc((c) => {
                c.views[0].regions[0].find = has ? { fn: () => null, arg } : { fn: () => null }
            })).findKey
            assert.notStrictEqual(key(NaN), key(null))
            assert.notStrictEqual(key(1n), key(2n))
            assert.notStrictEqual(key(-0), key(0))
            assert.notStrictEqual(key({ a: 1 }), key({ a: '1' }))
            assert.notStrictEqual(key([1, 2]), key([2, 1]))
            assert.notStrictEqual(key(new Date(0)), key(new Date(1)))
            assert.strictEqual(key(undefined), key(null, false))
        })

        it('find.arg 檢測時不呼叫使用端之方法(toJSON、getter): 後續鍵無效而 reject 時 toJSON 未被呼叫', async function() {
            let arg = {
                calls: 0,
                toJSON() {
                    this.calls++
                    return this.calls
                },
            }
            let c = base(path.join(fdTmp, 'tojson'), spy().launchBrowser)
            c.views[0].regions[0].find = { fn: () => null, arg }
            c.views.push({ name: '', open: () => {}, regions: [] })
            await rejects(c, 'invalid conf.views[1].name: must be a safe file name (letters, digits, . _ -; not reserved)')
            assert.strictEqual(arg.calls, 0)
        })

        it('find.arg 為選填: 讀取拋錯、含存取器、循環參照、Map、函數 → 視為未給(undefined)並警告; 有效者以快照傳入(非同一參照, 內容相同)', function() {
            let cyc = { a: 1 }
            cyc.self = cyc
            let bads = [
                (f) => Object.defineProperty(f, 'arg', {
                    get() {
                        throw new Error('getter secret')
                    },
                    enumerable: true
                }),
                (f) => {
                    f.arg = {
                        get x() {
                            return 1
                        }
                    }
                },
                (f) => {
                    f.arg = cyc
                },
                (f) => {
                    f.arg = new Map([[1, 2]])
                },
                (f) => {
                    f.arg = () => 1
                },
            ]
            for (let b of bads) {
                let P = pc((c) => {
                    let f = { fn: () => null }
                    b(f)
                    c.views[0].regions[0].find = f
                }, { debug: true })
                assert.strictEqual(P.err, null)
                assert.strictEqual(r0(P).find.arg, undefined)
                assert.strictEqual(P.warns.length, 1)
                assert.ok(!P.warns[0].includes('secret'))
            }
            let a = { sel: '#list', n: [1, 2, { z: null }], d: new Date(5), big: 3n, neg: -0 }
            let P = pc((c) => {
                c.views[0].regions[0].find = { fn: () => null, arg: a }
            })
            assert.notStrictEqual(r0(P).find.arg, a)
            assert.deepStrictEqual(r0(P).find.arg, a)
            assert.ok(Object.is(r0(P).find.arg.neg, -0))
        })

        it('find.fn 之自訂 toString 拋錯不逸出(核對鍵以 Function.prototype.toString 取原始碼)', function() {
            let fn = () => null
            fn.toString = () => {
                throw new Error('fn string secret')
            }
            let P = pc((c) => {
                c.views[0].regions[0].find = { fn }
            })
            assert.strictEqual(P.err, null)
            assert.ok(r0(P).findKey.includes('() => null'))
        })
    })

})
