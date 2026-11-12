//排版與檢核(src/layout.mjs, Node 端純函式)之規則測試: 截圖 1600×900, 預設樣式與排版; 字寬以注入之確定函數(字數 × 字級)代替瀏覽器量測, 不受字型影響
//  每條斷言註明對應之帳本條目(sgud/rule/rulebook.md); 原型 test/ 之 11 案移植為 R-GC-LAYOUT-01～11
import assert from 'assert'
import layout from '../src/layout.mjs'
import genSvg from '../src/genSvg.mjs'
import parseConf from '../src/parseConf.mjs'
import { defaultStyle, defaultLayout } from '../src/defaults.mjs'


let W0 = 1600
let H0 = 900
let wOf = (rs, fs = 36) => new Map(rs.map((r) => [r.label, [...r.label].length * fs]))
let lay = (regions, layOver = {}, stOver = {}) => {
    let st = { ...defaultStyle, ...stOver }
    return layout({ W0, H0, regions, widths: wOf(regions, st.fs), st, lay: { ...defaultLayout, ...layOver } })
}
let R = (label, x1, y1, x2, y2, ovr = {}) => ({ label, box: { x1, y1, x2, y2 }, ...ovr })
let dec = (L, label) => L.decisions.find((d) => d.label === label)
let codes = (xs) => xs.map((x) => x.code)
let anchorX = (r, d) => {
    let b = r.box
    if (d.anchor.edge === 'left') {
        return b.x1
    }
    if (d.anchor.edge === 'right') {
        return b.x2
    }
    return b.x1 + (b.x2 - b.x1) * d.anchor.at
}


describe('unit-layout', function() {

    it('R-GC-LAYOUT-02 同層間距平分且左右對稱: 排於截圖寬內, 首尾距截圖邊 edge', function() {
        let regions = [R('甲功能', 100, 100, 300, 150), R('乙功能區', 500, 100, 700, 150), R('丙', 900, 100, 1100, 150), R('丁功能', 1300, 100, 1500, 150)]
        let L = lay(regions)
        assert.deepStrictEqual(L.issues, [])
        let ds = regions.map((r) => dec(L, r.label)).sort((a, b) => a.x - b.x)
        ds.forEach((d) => assert.strictEqual(d.side, 'top'))
        assert.ok(Math.abs(ds[0].x - defaultLayout.edge) <= 1, `首端 ${ds[0].x}`) //首端距截圖左緣 edge
        let last = ds[ds.length - 1]
        assert.ok(Math.abs(last.x + last.len - (W0 - defaultLayout.edge)) <= 1, `尾端 ${last.x + last.len}`) //尾端距截圖右緣 edge
        let gaps = ds.slice(1).map((d, k) => d.x - (ds[k].x + ds[k].len))
        assert.ok(Math.max(...gaps) - Math.min(...gaps) <= 2, `間距 ${gaps}`) //間距平分
    })

    it('R-GC-LAYOUT-03 文字區總寬＋最低間距超過可用寬時, 才往左右對稱擴展且不超過 ext', function() {
        let names = ['甲甲甲甲甲甲甲甲', '乙乙乙乙乙乙乙乙', '丙丙丙丙丙丙丙丙', '丁丁丁丁丁丁丁丁', '戊戊戊戊戊戊戊戊']
        let regions = names.map((s, k) => R(s, 60 + k * 310, 100, 300 + k * 310, 150))
        let L = lay(regions)
        assert.deepStrictEqual(L.issues, [])
        let ds = regions.map((r) => dec(L, r.label)).sort((a, b) => a.x - b.x)
        let lo = ds[0].x
        let hi = ds[ds.length - 1].x + ds[ds.length - 1].len
        assert.ok(lo < defaultLayout.edge && hi > W0 - defaultLayout.edge, `已擴展 ${lo}～${hi}`) //超過可用寬才擴展
        assert.ok(lo >= -defaultLayout.ext - 1 && hi <= W0 + defaultLayout.ext + 1, `不超過 ext ${lo}～${hi}`) //至多截圖寬＋2×ext
        assert.ok(Math.abs((0 - lo) - (hi - W0)) <= 2, `左右對稱 ${lo}～${hi}`) //左右對稱
    })

    it('R-GC-LAYOUT-01 一律優先往上排: 畫面下方之框不過擠時亦排上方', function() {
        let regions = [R('上方功能', 200, 100, 400, 150), R('下方功能', 1000, 780, 1300, 880)]
        let L = lay(regions)
        assert.deepStrictEqual(L.issues, [])
        assert.strictEqual(dec(L, '下方功能').side, 'top')
    })

    it('R-GC-LAYOUT-04 上方過擠才換至下方, 且換後無問題', function() {
        let names = ['甲甲甲甲甲甲甲甲甲', '乙乙乙乙乙乙乙乙乙', '丙丙丙丙丙丙丙丙丙', '丁丁丁丁丁丁丁丁丁', '戊戊戊戊戊戊戊戊戊', '己己己己己己己己己']
        let regions = names.map((s, k) => R(s, 40 + k * 260, k % 2 === 0 ? 100 : 700, 240 + k * 260, k % 2 === 0 ? 150 : 760))
        let L = lay(regions)
        assert.deepStrictEqual(L.issues, [])
        let sides = L.decisions.map((d) => d.side)
        assert.ok(sides.includes('top') && sides.includes('bottom'), `側別 ${sides}`) //過擠時部分換至下方
        let nBottom = sides.filter((s) => s === 'bottom').length
        assert.ok(nBottom >= 1 && nBottom <= 3, `換 1～3 個 ${nBottom}`) //換向之組合為 1～3 個
    })

    it('R-GC-LAYOUT-08 引線預設接於水平線之左端(灰線往右轉)', function() {
        let L = lay([R('甲功能', 300, 300, 600, 400), R('乙功能', 900, 300, 1200, 400)])
        L.decisions.forEach((d) => assert.strictEqual(d.join, 'l'))
    })

    it('R-GC-LAYOUT-06 框緣優先序: 上緣可行用上緣; 上緣之引線(含斜拉)皆被他框擋住時改用右緣而不用左緣', function() {
        //丙緊貼於甲之正下方(同寬、間隔 6 像素): 丙之上緣任一點往上皆貼著甲, 右側開闊 → 丙用右緣
        let regions = [R('甲上方框', 200, 100, 600, 200), R('丙下方框', 200, 206, 600, 300)]
        let L = lay(regions)
        assert.deepStrictEqual(L.issues, [])
        assert.strictEqual(dec(L, '甲上方框').anchor.edge, 'top')
        assert.strictEqual(dec(L, '丙下方框').anchor.edge, 'right')
        assert.ok(!L.notes.some((s) => /丙下方框/.test(s.msg)), '丙不須穿框')
    })

    it('R-GC-LAYOUT-05、10 同層順序依引線自紅框出發之位置由左往右(以總成本比較各順序)', function() {
        let regions = [R('左下框', 100, 500, 400, 600), R('右上框', 800, 100, 1100, 200), R('中框', 500, 300, 700, 400)]
        let L = lay(regions)
        assert.deepStrictEqual(L.issues, [])
        let top = regions.map((r) => ({ r, d: dec(L, r.label) })).filter((o) => o.d.side === 'top').sort((a, b) => a.d.x - b.d.x)
        let xs = top.map((o) => anchorX(o.r, o.d))
        xs.slice(1).forEach((x, k) => assert.ok(x >= xs[k] - 2, `起點 x ${xs}`))
    })

    it('R-GC-LAYOUT-10 超過 6 個時以相鄰對調改良: 8 個功能區之同層順序仍依起點由左往右且無問題', function() {
        let regions = []
        for (let k = 0; k < 8; k++) {
            let x1 = 40 + (k % 6) * 260
            let y1 = 80 + Math.floor(k / 6) * 260 + ((k % 6) % 2) * 90
            regions.push(R(`功能${k + 1}`, x1, y1, x1 + 200, y1 + 70))
        }
        let L = lay(regions)
        assert.deepStrictEqual(L.issues, [])
        for (let side of ['top', 'bottom']) {
            for (let t of [0, 1, 2, 3]) {
                let mem = regions.map((r) => ({ r, d: dec(L, r.label) })).filter((o) => o.d.side === side && o.d.tier === t).sort((a, b) => a.d.x - b.d.x)
                let xs = mem.map((o) => anchorX(o.r, o.d))
                xs.slice(1).forEach((x, k) => assert.ok(x >= xs[k] - 2, `${side}${t} 起點 x ${xs}`))
            }
        }
    })

    it('R-GC-LAYOUT-09 下方層之斜線不遮住其功能文字(文字避讓並加長水平線)', function() {
        let regions = [R('左邊下方功能', 1300, 600, 1500, 700, { side: 'bottom' }), R('右邊下方功能文字', 1350, 750, 1550, 820, { side: 'bottom' })]
        let L = lay(regions)
        assert.ok(!codes(L.issues).includes('LEAD_COVERS_TEXT'), JSON.stringify(L.issues))
        let d = dec(L, '左邊下方功能')
        assert.ok(d.len > 6 * 36 + 2 * defaultLayout.pad, `水平線已加長 ${d.len}`) //避讓使水平線長於文字寬＋2×pad
    })

    it('R-GC-LAYOUT-07 灰線原則上不穿過他框; 上下皆被擋者才穿過並列為注意', function() {
        let regions = [R('頁首', 20, 20, 1580, 120), R('分頁列', 600, 140, 1000, 180), R('內容', 20, 200, 1580, 880)]
        let L = lay(regions)
        assert.deepStrictEqual(L.issues, [])
        let n = L.notes.find((s) => s.code === 'LEAD_THROUGH_BOX' && /分頁列/.test(s.msg))
        assert.ok(n, JSON.stringify(L.notes))
        assert.strictEqual(n.regions[0], 1) //注意之對象為分頁列(索引 1)
        assert.ok(!L.notes.some((s) => /「頁首」之引線穿過/.test(s.msg)), '頁首不須穿框')
    })

    it('R-GC-CHECK-01 框太近或相疊列為問題 BOX_TOO_CLOSE, 帶兩區之索引', function() {
        let L = lay([R('甲', 100, 100, 300, 200), R('乙', 302, 100, 500, 200)])
        let x = L.issues.find((s) => s.code === 'BOX_TOO_CLOSE')
        assert.ok(x)
        assert.deepStrictEqual(x.regions, [0, 1])
        assert.strictEqual(x.msg, '框太近或相疊: 「甲」與「乙」') //msg 保留原型之中文句
    })

    it('R-GC-OVR-01 逐標籤覆寫: side、anchor、dx 生效', function() {
        let L0 = lay([R('甲功能', 300, 300, 600, 400), R('乙功能', 900, 300, 1200, 400)])
        let L1 = lay([R('甲功能', 300, 300, 600, 400, { side: 'bottom', anchor: { edge: 'right', at: 0.5 } }), R('乙功能', 900, 300, 1200, 400, { dx: -50 })])
        assert.strictEqual(dec(L1, '甲功能').side, 'bottom')
        assert.deepStrictEqual(dec(L1, '甲功能').anchor, { edge: 'right', at: 0.5 })
        assert.notStrictEqual(dec(L1, '乙功能').x, dec(L0, '乙功能').x)
    })

    it('R-GC-OVR-01 tier、x、join(r、auto)、左右側之覆寫生效; 左側之接點在水平線右端', function() {
        let L = lay([
            R('甲功能', 300, 300, 600, 400, { tier: 1 }),
            R('乙功能', 900, 300, 1200, 400, { x: 700 }),
            R('丙功能', 100, 600, 300, 700, { side: 'left' }),
            R('丁功能', 1300, 600, 1500, 700, { side: 'right' }),
        ])
        assert.strictEqual(dec(L, '甲功能').tier, 1)
        assert.strictEqual(dec(L, '乙功能').x, 700)
        assert.strictEqual(dec(L, '丙功能').side, 'left')
        assert.strictEqual(dec(L, '丙功能').join, 'r') //左側接於右端(R-GC-LAYOUT-11 之左右側)
        assert.strictEqual(dec(L, '丁功能').side, 'right')
        let Lr = lay([R('甲功能', 300, 300, 600, 400), R('乙功能', 900, 300, 1200, 400)], { join: 'r' })
        Lr.decisions.forEach((d) => assert.strictEqual(d.join, 'r'))
        let La = lay([R('甲功能', 300, 300, 600, 400, { join: 'auto' }), R('乙功能', 900, 300, 1200, 400)])
        assert.ok(['l', 'r'].includes(dec(La, '甲功能').join))
        assert.strictEqual(dec(La, '乙功能').join, 'l')
    })

    it('R-GC-LAYOUT-11 平分後無路可走之層改為靠近引線落點, 列為注意 TIER_NEAR', function() {
        //兩框集中於右上: 平分時左端之標籤之引線過於平躺(超過 maxSlope) → 該層改為靠近落點
        let L = lay([R('甲', 1400, 150, 1480, 200), R('乙', 1500, 150, 1580, 200)])
        assert.ok(L.notes.some((s) => s.code === 'TIER_NEAR'), JSON.stringify(L.notes))
        assert.deepStrictEqual(L.issues, [])
    })

    it('R-GC-LAYOUT-02 spread near: 各自靠近引線落點(不平分)', function() {
        let regions = [R('甲功能', 100, 300, 300, 400), R('乙功能', 400, 300, 600, 400)]
        let Le = lay(regions)
        let Ln = lay(regions, { spread: 'near' })
        let last = (L) => Math.max(...L.decisions.map((d) => d.x + d.len))
        assert.ok(Math.abs(last(Le) - (W0 - defaultLayout.edge)) <= 1) //even 尾端貼齊右側可用寬
        assert.ok(last(Ln) < W0 / 2, `near 靠近落點 ${last(Ln)}`) //near 留在功能區附近
    })

    it('R-GC-CHECK-01 4 層仍排不下者列為問題 TIER_OVERFLOW', function() {
        let regions = []
        for (let k = 0; k < 20; k++) {
            regions.push(R(`很長之功能名稱第${k + 1}`, 20 + (k % 10) * 158, 300 + Math.floor(k / 10) * 200, 160 + (k % 10) * 158, 360 + Math.floor(k / 10) * 200, { side: 'top' }))
        }
        let L = lay(regions)
        let x = L.issues.find((s) => s.code === 'TIER_OVERFLOW')
        assert.ok(x, JSON.stringify(codes(L.issues)))
        assert.strictEqual(x.regions.length, 20)
    })

    it('R-GC-CHECK-01 canvasW: 較窄者左右補白至 canvasW; 超過者列為問題 CANVAS_TOO_WIDE', function() {
        let regions = [R('甲功能', 300, 300, 600, 400)]
        let L = lay(regions, { canvasW: 2000 })
        assert.strictEqual(L.w, 2000)
        let L2 = lay(regions, { canvasW: 1700 })
        assert.ok(L2.issues.some((s) => s.code === 'CANVAS_TOO_WIDE'))
        let L3 = lay(regions)
        assert.strictEqual(L3.w, W0 + 2 * defaultLayout.ext) //預設畫布寬＝截圖寬＋2×ext
    })

    it('R-GC-ARG-03 style.shadow 只給 blur 時逐鍵合併, 畫布寬高為有限數(原型為 NaN)', function() {
        let P = parseConf({ dirWork: 'x', env: { launchBrowser: () => null }, style: { shadow: { blur: 5 } }, views: [{ name: 'a', open: () => {}, regions: [] }] })
        let st = P.cfg.views[0].st
        assert.deepStrictEqual(st.shadow, { ...defaultStyle.shadow, blur: 5 })
        let L = layout({ W0, H0, regions: [R('甲', 300, 300, 600, 400)], widths: wOf([R('甲', 0, 0, 0, 0)]), st, lay: defaultLayout })
        assert.ok(Number.isFinite(L.w) && Number.isFinite(L.h), `${L.w}x${L.h}`)
    })

    it('R-GC-ARG-04 數字字串與數值之結果相同(K4): layout.ext 為 \'100\'、minGap 為 \' 40 \'', function() {
        let mkP = (layout) => parseConf({ dirWork: 'x', env: { launchBrowser: () => null }, layout, views: [{ name: 'a', open: () => {}, regions: [] }] }).cfg.views[0].lay
        let rs = [R('甲功能', 100, 100, 300, 150), R('乙功能區', 500, 100, 700, 150)]
        let a = layout({ W0, H0, regions: rs, widths: wOf(rs), st: defaultStyle, lay: mkP({ ext: '100', minGap: ' 40 ' }) })
        let b = layout({ W0, H0, regions: rs, widths: wOf(rs), st: defaultStyle, lay: mkP({ ext: 100, minGap: 40 }) })
        assert.deepStrictEqual(a, b)
        assert.strictEqual(a.w, 1800) //原型為 1600200(字串串接)
    })

    it('R-GC-SVG-01 標籤含 & < > " \' 時 svg 經跳脫且可解析; 屬性值經跳脫', function() {
        let rs = [R('甲&乙<丙>"丁\'', 300, 300, 600, 400)]
        let L = layout({ W0, H0, regions: rs, widths: wOf(rs), st: defaultStyle, lay: defaultLayout })
        let svg = genSvg({ L, regions: rs, st: defaultStyle, W0, H0, b64: 'AA==' })
        let t = svg.match(/<text[^>]*>([^<]*)<\/text>/)
        assert.ok(t, svg)
        assert.ok(!/[<>"']/.test(t[1]) && !/&(?!#x[0-9A-F]+;|[a-z]+;)/i.test(t[1]), t[1]) //文字內無未跳脫之 < > " ' &
        assert.ok(/font-family="Microsoft JhengHei, 微軟正黑體, sans-serif"/.test(svg))
        assert.ok(/stroke="#FF0606"/.test(svg))
    })

    it('R-GC-ORDER-01 regions 之順序不影響結果(原則 2): 多組固定種子之隨機排列後, 依 label 對應之 decisions、issues、notes、w、h 相同', function() {
        let rng = (seed) => () => {
            seed |= 0
            seed = (seed + 0x6D2B79F5) | 0
            let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296
        }
        let shuffle = (a, r) => {
            let b = a.slice()
            for (let i = b.length - 1; i > 0; i--) {
                let j = Math.floor(r() * (i + 1))
                let tmp = b[i]
                b[i] = b[j]
                b[j] = tmp
            }
            return b
        }
        let sig = (L) => ({
            dec: Object.fromEntries(L.decisions.map((d) => [d.label, d])),
            iss: L.issues.map((x) => x.msg).sort(),
            not: L.notes.map((x) => x.msg).sort(),
            wh: [L.w, L.h],
        })
        let sets = [
            [R('甲功能', 100, 100, 300, 150), R('乙功能區', 500, 100, 700, 150), R('丙', 900, 100, 1100, 150), R('丁功能', 1300, 100, 1500, 150)],
            ['甲甲甲甲甲甲甲甲甲', '乙乙乙乙乙乙乙乙乙', '丙丙丙丙丙丙丙丙丙', '丁丁丁丁丁丁丁丁丁', '戊戊戊戊戊戊戊戊戊', '己己己己己己己己己'].map((s, k) => R(s, 40 + k * 260, k % 2 === 0 ? 100 : 700, 240 + k * 260, k % 2 === 0 ? 150 : 760)),
            [R('左下框', 100, 500, 400, 600), R('右上框', 800, 100, 1100, 200), R('中框', 500, 300, 700, 400)],
            [R('頁首', 20, 20, 1580, 120), R('分頁列', 600, 140, 1000, 180), R('內容', 20, 200, 1580, 880)],
        ]
        for (let rs of sets) {
            let base = sig(lay(rs))
            for (let s = 1; s <= 4; s++) {
                assert.deepStrictEqual(sig(lay(shuffle(rs, rng(s * 104729)))), base)
            }
        }
    })

})
