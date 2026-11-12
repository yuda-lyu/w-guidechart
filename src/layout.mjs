//功能指引圖之排版與檢核(Node 端之純函式; 字寬由頁面內量得後傳入, 本模組不碰瀏覽器)
//  規則見 sgud/rule/rulebook.md 之 R-GC-LAYOUT-01～11; 演算法與原型(頁面內之 layoutInPage)相同, 只把字寬改為傳入、問題與注意改為結構化之 { code, msg, regions }


//inp: { W0, H0, regions, widths, st, lay }
//  W0、H0: 截圖(裁切後)之寬高
//  regions[k]: { label, box: {x1,y1,x2,y2}(截圖座標), 以及各功能區之覆寫(皆可省略, 省略即自動):
//    side: 'top' | 'bottom' | 'left' | 'right' 強制側別(自動: 一律優先排上方, 上方過擠才換至下方; 不排左右側)
//    ax: 引線起點沿框緣之偏好比例(0～1, 預設 0.5)
//    anchor: { edge: 'top' | 'bottom' | 'left' | 'right', at: 0～1 } 強制引線起點
//    tier: 強制所在之層(0 為最靠近截圖之層)
//    x: 強制水平線之左端(截圖座標) | dx: 自動位置再位移之像素
//    join: 'l' | 'r' | 'auto' 覆寫全域之 join }
//  widths: 各標籤文字之寬(像素, 已取整), 為 Map 或以標籤為鍵之物件
//  st、lay: 已檢測並合併預設之樣式與排版設定
//灰線原則上不穿過他框; 無法自動排入者才允許穿過, 列於 notes
//回傳 { w, h, ox, oy, issues, notes, decisions, placed }; decisions 為各標籤之排版結果(可照抄為覆寫值), placed 為各引線之幾何(供組 svg)
function layout(inp) {
    let { W0, H0, regions, widths, st, lay } = inp
    let wMap = widths instanceof Map ? widths : new Map(Object.keys(widths).map((k) => [k, widths[k]]))
    let tw = (s) => {
        let v = wMap.get(s)
        if (typeof v !== 'number' || !Number.isFinite(v)) {
            throw new Error('layout: missing text width')
        }
        return v
    }
    let PAD = lay.pad
    let ASC = Math.round(st.fs * 0.86) //文字基線以上之高
    let DSC = Math.round(st.fs * 0.2)
    let BASE = lay.base
    let GAP_TOP = lay.gapTop
    let GAP_BOT = ASC + BASE + lay.gapBot
    let TIER = lay.tierGap ?? st.fs + 34
    let GAPX = lay.minGap
    let RAY_M = lay.rayM
    let SIDE = lay.sideGap
    let LINE_GAP = lay.lineGap ?? st.fs + 26
    let XL = -lay.ext
    let XR = W0 + lay.ext
    let EPS = 0.5
    let issues = []
    let notes = []
    let item = (code, msg, regs) => ({ code, msg, regions: regs })
    let cr = (o, u, v) => (u.x - o.x) * (v.y - o.y) - (u.y - o.y) * (v.x - o.x)
    let segSeg = (a, b, c, d) => {
        let d1 = cr(c, d, a)
        let d2 = cr(c, d, b)
        let d3 = cr(a, b, c)
        let d4 = cr(a, b, d)
        return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))
    }
    //線段與矩形是否相交(含穿越與端點在內)
    let segHitRect = (p, q, r) => {
        let inside = (x, y) => x > r.x1 && x < r.x2 && y > r.y1 && y < r.y2
        if (inside(p.x, p.y) || inside(q.x, q.y)) {
            return true
        }
        let c = [{ x: r.x1, y: r.y1 }, { x: r.x2, y: r.y1 }, { x: r.x2, y: r.y2 }, { x: r.x1, y: r.y2 }]
        for (let i = 0; i < 4; i++) {
            if (segSeg(p, q, c[i], c[(i + 1) % 4])) {
                return true
            }
        }
        return false
    }
    let boxHit = (a, b, m = 0) => !(a.x2 + m <= b.x1 || b.x2 + m <= a.x1 || a.y2 + m <= b.y1 || b.y2 + m <= a.y1)
    let grow = (r, m) => ({ x1: r.x1 - m, y1: r.y1 - m, x2: r.x2 + m, y2: r.y2 + m })
    let frames = regions.map((r) => ({ x1: r.box.x1, y1: r.box.y1, x2: r.box.x2, y2: r.box.y2 }))
    let n = regions.length
    let all = regions.map((r, i) => i)

    //一、框之間距(線寬 5, 框線不可相疊)
    for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
            if (boxHit(frames[i], frames[j], 6)) {
                issues.push(item('BOX_TOO_CLOSE', `框太近或相疊: 「${regions[i].label}」與「${regions[j].label}」`, [i, j]))
            }
        }
    }

    let fracs = []
    for (let k = 1; k <= 19; k++) {
        fracs.push(k / 20)
    }
    let anchorOf = (i, edge, at) => {
        let b = frames[i]
        if (edge === 'top' || edge === 'bottom') {
            return { x: b.x1 + (b.x2 - b.x1) * at, y: edge === 'top' ? b.y1 : b.y2 }
        }
        return { x: edge === 'left' ? b.x1 : b.x2, y: b.y1 + (b.y2 - b.y1) * at }
    }
    let lineY = (side, tier) => (side === 'top' ? -(GAP_TOP + tier * TIER) : H0 + GAP_BOT + tier * TIER)
    let hitList = (i, p, q, m) => all.filter((k) => k !== i && segHitRect(p, q, grow(frames[k], m)))
    //水平線長＝文字寬＋2×PAD＋避讓(extra: 下方層之斜線穿過文字時, 文字向接點之反方向避讓之距離, 由排版時估算)
    let extra = {}
    let lenOf = (i) => tw(regions[i].label) + PAD * 2 + (extra[i] || 0)
    //斜線自上方接至水平線之端時, 於文字頂之高度之 x, 據以估算文字須避讓之距離(另留 TXT_CLR 之空隙); 斜線自下方來者(上方層)不穿過文字
    let TXT_CLR = 8
    let textClear = (p) => {
        let topY = p.J.y - BASE - ASC - 4
        let dy = p.J.y - p.A.y
        if (dy <= 0) {
            return 0
        }
        let xTop = p.J.x + (p.A.x - p.J.x) * ((p.J.y - topY) / dy)
        if (p.end === 'l') {
            return Math.max(0, xTop + TXT_CLR - (p.J.x + PAD - 4))
        }
        return Math.max(0, (p.J.x - PAD + 4) - xTop + TXT_CLR)
    }
    let endsOf = (i) => {
        let j = regions[i].join || lay.join
        return j === 'auto' ? ['l', 'r'] : [j]
    }
    //引線之起點候選: 朝該層之框緣各點(上方層之上緣、下方層之底緣), 以及右緣、左緣靠該層之一段(sideEdges; 依序加罰 penRight、penLeft); anchor 指定者只用該點
    let edgeAnchors = (i, S) => {
        let r = regions[i]
        if (r.anchor) {
            return [{ A: anchorOf(i, r.anchor.edge, r.anchor.at), edge: r.anchor.edge, at: r.anchor.at, pen: 0 }]
        }
        let pref = r.ax ?? 0.5
        let list = fracs.map((f) => ({ A: anchorOf(i, S, f), edge: S, at: f, pen: Math.abs(f - pref) * 100 }))
        if (lay.sideEdges) {
            for (let t of [0.05, 0.15, 0.3, 0.5]) {
                let at = S === 'top' ? t : 1 - t
                list.push({ A: anchorOf(i, 'right', at), edge: 'right', at, pen: lay.penRight + t * 100 })
                list.push({ A: anchorOf(i, 'left', at), edge: 'left', at, pen: lay.penLeft + t * 100 })
            }
        }
        return list
    }
    //引線 A→P 之評估: 不穿入自身之框、不過於平躺者才可用; 回傳 { k 穿過他框數, cost } 或 null
    //  cross 為 false 時須不穿過他框(外擴 m); 為 true 時允許穿過, 每框加罰 crossPen
    let linkEval = (i, c, P, m, cross) => {
        let o = frames[i]
        if (segHitRect(c.A, P, { x1: o.x1 + 3, y1: o.y1 + 3, x2: o.x2 - 3, y2: o.y2 - 3 })) {
            return null
        }
        if (Math.abs(P.x - c.A.x) > lay.maxSlope * Math.abs(P.y - c.A.y)) {
            return null
        }
        let k = hitList(i, c.A, P, cross ? 0 : m).length
        if (k > 0 && !cross) {
            return null
        }
        let len = Math.hypot(P.x - c.A.x, P.y - c.A.y)
        let kNear = Math.max(0, hitList(i, c.A, P, lay.nearM).length - hitList(i, c.A, P, 0).length)
        return { k, len, cost: len + c.pen + k * lay.crossPen + kNear * lay.nearPen }
    }
    //該層是否到得了: 任一起點至該層(水平線落在 [XL, XR] 內)之引線之最低成本; maxK 為允許穿過之框數上限
    let probe = (i, S, cross, maxK = Infinity) => {
        let bandY = lineY(S, regions[i].tier || 0)
        let len = lenOf(i)
        let best = null
        for (let c of edgeAnchors(i, S)) {
            for (let end of endsOf(i)) {
                let lo = end === 'l' ? XL : XL + len
                let hi = end === 'l' ? XR - len : XR
                for (let bx = lo; bx <= hi; bx += 10) {
                    let e = linkEval(i, c, { x: bx, y: bandY }, RAY_M, cross)
                    if (e && e.k <= maxK && (!best || e.cost < best.cost)) {
                        best = { A: c.A, bx, end, cost: e.cost, k: e.k, len: e.len }
                    }
                }
            }
        }
        return best
    }
    //各側之探測: 先找不穿過他框者, 無則允許穿過他框(取穿過少且短者)
    let probeAny = (i, S) => probe(i, S, false) || probe(i, S, true)

    //二、側別: 一律優先排上方(不穿過他框者優先, 無則穿過他框亦排上方); 上方到不了者才排下方; 左右側只在 side 強制時
    let info = regions.map((r, i) => {
        if (r.side === 'left' || r.side === 'right') {
            return { side: r.side, at: r.anchor ? r.anchor.at : 0.5 }
        }
        let pt = r.side === 'bottom' ? null : probeAny(i, 'top')
        let pb = r.side === 'top' ? null : probeAny(i, 'bottom')
        if (pt) {
            return { side: 'top', ...pt, pt, pb }
        }
        if (pb) {
            return { side: 'bottom', ...pb, pt, pb }
        }
        issues.push(item('NO_PATH', `「${r.label}」之引線無可用之路徑(過於平躺或須穿入自身之框), 請以 anchor、side 調整`, [i]))
        let A = anchorOf(i, 'top', r.ax ?? 0.5)
        return { side: 'top', A, bx: A.x, end: endsOf(i)[0] }
    })

    //三、上下各層
    let width = XR - XL
    let fitsOne = (idx) => idx.reduce((s, i) => s + lenOf(i) + GAPX, -GAPX) <= width
    let onSide = (side) => all.filter((i) => info[i].side === side)
    //同層之水平線位置(依引線落點之順序): spread 'even' 為截圖寬內左右各留 edge, (可用寬－文字區總寬)/(數－1) 為間距, 左右對稱;
    //  文字區總寬＋(數－1)×minGap 超過可用寬時, 才往左右對稱擴展(至多截圖寬＋2×ext), 仍超過則加層; 只有 1 個或 'near' 時靠近引線落點; x、dx 逐標籤覆寫
    let idealLeft = (i) => (info[i].end === 'l' ? info[i].bx : info[i].bx - lenOf(i))
    let spreadTier = (mem, near) => {
        let lens = mem.map(lenOf)
        let sum = lens.reduce((a, b) => a + b, 0)
        let m = mem.length
        let need = sum + GAPX * (m - 1)
        if (need > width) {
            return null
        }
        let inner = W0 - 2 * lay.edge
        if (!near && lay.spread !== 'near' && m > 1) {
            let span = Math.max(inner, need)
            let g = (span - sum) / (m - 1)
            let x = W0 / 2 - span / 2
            let lefts = lens.map((l) => {
                let v = x
                x += l + g
                return v
            })
            return mem.map((i, k) => (regions[i].x !== undefined ? regions[i].x : Math.round(lefts[k] + (regions[i].dx || 0))))
        }
        //靠近引線落點: 保序之最小平方位移(PAVA), 排得下時夾於截圖寬內(左右各留 edge), 否則夾於 [XL, XR]
        let lo = need <= inner ? lay.edge : XL
        let hiEnd = need <= inner ? W0 - lay.edge : XR
        let off = []
        let s = 0
        lens.forEach((l) => {
            off.push(s)
            s += l + GAPX
        })
        let blocks = []
        mem.forEach((i, k) => {
            blocks.push({ sum: idealLeft(i) - off[k], cnt: 1 })
            while (blocks.length > 1 && blocks[blocks.length - 2].sum / blocks[blocks.length - 2].cnt > blocks[blocks.length - 1].sum / blocks[blocks.length - 1].cnt) {
                let b = blocks.pop()
                blocks[blocks.length - 1].sum += b.sum
                blocks[blocks.length - 1].cnt += b.cnt
            }
        })
        let q = []
        for (let b of blocks) {
            for (let k = 0; k < b.cnt; k++) {
                q.push(b.sum / b.cnt)
            }
        }
        let hi = hiEnd - off[m - 1] - lens[m - 1]
        let lefts = q.map((v, k) => Math.min(hi, Math.max(lo, v)) + off[k])
        return mem.map((i, k) => (regions[i].x !== undefined ? regions[i].x : Math.round(lefts[k] + (regions[i].dx || 0))))
    }
    //標籤之幾何: 水平線段為該層之 [left, left+len], 引線 A→J 接於線段之一端(end 'l' | 'r'); 避讓之距離(extra)置於接點之一側
    let geomBand = (i, side, tier, left, c, end) => {
        let len = lenOf(i)
        let Jy = lineY(side, tier)
        let J = { x: end === 'l' ? left : left + len, y: Jy }
        let E = { x: end === 'l' ? left + len : left, y: Jy }
        let w = tw(regions[i].label)
        let tx = end === 'l' ? left + (extra[i] || 0) + PAD : left + PAD
        let tb = { x1: tx - 4, y1: Jy - BASE - ASC - 4, x2: tx + w + 4, y2: Jy - BASE + DSC + 2 }
        return { i, side, tier, left, A: c.A, edge: c.edge, at: c.at, end, J, E, tx, ty: Jy - BASE, w, tb }
    }
    //左右側之標籤(只在 side 強制時)
    let sideOnes = []
    for (let side of ['left', 'right']) {
        let items = onSide(side).map((i) => {
            let A = anchorOf(i, side, info[i].at)
            return { i, A, want: A.y - 24 }
        }).sort((a, b) => a.want - b.want)
        let prev = -Infinity
        for (let it of items) {
            let Jy = Math.max(it.want, prev + LINE_GAP)
            prev = Jy
            let w = tw(regions[it.i].label)
            let L = w + PAD * 2
            let J = side === 'left' ? { x: -SIDE, y: Jy } : { x: W0 + SIDE, y: Jy }
            let E = side === 'left' ? { x: J.x - L, y: Jy } : { x: J.x + L, y: Jy }
            let tx = side === 'left' ? J.x - PAD - w : J.x + PAD
            let tb = { x1: tx - 4, y1: Jy - BASE - ASC - 4, x2: tx + w + 4, y2: Jy - BASE + DSC + 2 }
            sideOnes.push({ i: it.i, side, tier: 0, A: it.A, edge: side, at: info[it.i].at, end: side === 'left' ? 'r' : 'l', J, E, tx, ty: Jy - BASE, w, tb })
        }
    }
    let nearSides = {}
    //同層標籤之左右順序: 平分間距時各標籤之位置隨順序而定, 依各自最短引線之落點排序未必可行(例: 功能區集中於一側時,
    //  末位之標籤被推至遠端而無路可走); 故比較各種順序之總成本(各引線之最低成本, 含框緣優先序與穿框罰分; 引線相交每處 5000; 無路可走 1e6), 取最低者;
    //  6 個以內窮舉全部順序, 超過者自依落點之順序起, 以相鄰對調逐步改良
    let orderCost = (ord, side, t) => {
        let lefts = spreadTier(ord, !!nearSides[side])
        if (!lefts) {
            return Infinity
        }
        let chosen = []
        let total = 0
        let prevAx = null
        ord.forEach((i, k) => {
            let best = null
            for (let c of edgeAnchors(i, side)) {
                for (let end of endsOf(i)) {
                    let gg = geomBand(i, side, t, lefts[k], c, end)
                    let e = linkEval(i, c, gg.J, 6, false) || linkEval(i, c, gg.J, 6, true)
                    if (!e) {
                        continue
                    }
                    //引線相交; 起點 x 小於前一標籤之起點者(順序與自紅框出發之位置相反)
                    let cost = e.cost + chosen.filter((p) => segSeg(p.A, p.J, gg.A, gg.J)).length * 5000 + (prevAx !== null && gg.A.x < prevAx - 2 ? lay.orderPen : 0)
                    if (!best || cost < best.cost) {
                        best = { cost, gg }
                    }
                }
            }
            if (!best) {
                total += 1e6
                return
            }
            total += best.cost
            chosen.push(best.gg)
            prevAx = best.gg.A.x
        })
        //次要: 順序與功能區之左右位置相反者(框中心 x 相差 2 像素以內視為同欄, 以上下順序對應左右)
        let cx = (i) => (frames[i].x1 + frames[i].x2) / 2
        for (let a = 0; a < ord.length; a++) {
            for (let b = a + 1; b < ord.length; b++) {
                let d = cx(ord[a]) - cx(ord[b])
                if (d > 2 || (Math.abs(d) <= 2 && frames[ord[a]].y1 > frames[ord[b]].y1)) {
                    total += lay.framePen
                }
            }
        }
        return total
    }
    //回傳 { ord, cost }
    let bestOrder = (mem, side, t) => {
        let best = { ord: mem, cost: orderCost(mem, side, t) }
        if (mem.length <= 1 || lay.spread === 'near' || nearSides[side] || mem.some((i) => regions[i].x !== undefined)) {
            return best
        }
        if (mem.length <= 6) {
            let perm = (arr, pre) => {
                if (arr.length === 0) {
                    let c = orderCost(pre, side, t)
                    if (c < best.cost) {
                        best = { ord: pre, cost: c }
                    }
                    return
                }
                arr.forEach((v, k) => perm([...arr.slice(0, k), ...arr.slice(k + 1)], [...pre, v]))
            }
            perm(mem, [])
            return best
        }
        let improved = true
        while (improved) {
            improved = false
            for (let k = 0; k + 1 < best.ord.length; k++) {
                let o = best.ord.slice()
                let tmp = o[k]
                o[k] = o[k + 1]
                o[k + 1] = tmp
                let c = orderCost(o, side, t)
                if (c < best.cost) {
                    best = { ord: o, cost: c }
                    improved = true
                }
            }
        }
        return best
    }
    //上方 1 層過擠(文字區總寬＋(數－1)×minGap 超過截圖寬＋2×ext, 即已觸及最低間距且用完擴展之額度)時, 才將標籤換至下方:
    //  試換 1～3 個之所有組合, 取上方排得下且「上方＋下方」兩層總成本(＋每換 1 個 movePen)最低者; 皆無解則依「往上比往下吃虧」之程度逐一換
    let combos = (arr, m) => (m === 0 ? [[]] : arr.flatMap((v, k) => combos(arr.slice(k + 1), m - 1).map((c) => [v, ...c])))
    let topFree = () => onSide('top').filter((i) => regions[i].tier === undefined)
    if (!fitsOne(topFree())) {
        let movable = topFree().filter((i) => info[i].pb && !regions[i].side)
        let best = null
        for (let m = 1; m <= Math.min(3, movable.length); m++) {
            for (let set of combos(movable, m)) {
                let top = topFree().filter((i) => !set.includes(i))
                if (!fitsOne(top)) {
                    continue
                }
                let saved = set.map((i) => info[i])
                set.forEach((i) => {
                    info[i] = { ...info[i], side: 'bottom', ...info[i].pb }
                })
                let cost = bestOrder(top, 'top', 0).cost + bestOrder(onSide('bottom').filter((i) => regions[i].tier === undefined), 'bottom', 0).cost + m * lay.movePen
                set.forEach((i, k) => {
                    info[i] = saved[k]
                })
                if (cost < Infinity && (!best || cost < best.cost)) {
                    best = { set, cost }
                }
            }
        }
        if (best) {
            best.set.forEach((i) => {
                info[i] = { ...info[i], side: 'bottom', ...info[i].pb }
            })
        }
        else {
            movable.sort((a, b) => (info[b].pt.cost - info[b].pb.cost) - (info[a].pt.cost - info[a].pb.cost))
            while (!fitsOne(topFree()) && movable.length > 0) {
                let i = movable.shift()
                info[i] = { ...info[i], side: 'bottom', ...info[i].pb }
            }
        }
    }
    //上下層: 排位置(依最佳之左右順序) → 選引線(先不穿過他框者, 無則允許穿過他框), 至多 3 回合
    let placed = []
    for (let iter = 0; iter < 3; iter++) {
        placed = sideOnes.slice()
        let moved = []
        //某側(上方或下方)之排列與引線; 回傳 { chosen, moved, iss, noPath }
        let layBand = (side, idx) => {
            let iss = []
            let mv = []
            let noPath = false
            //依引線落點排序(左邊者之標籤在左, 引線不交錯)
            let sorted = idx.slice().sort((a, b) => (info[a].bx - info[b].bx) || (info[a].A.x - info[b].A.x))
            let res = null
            let maxForced = Math.max(-1, ...idx.map((i) => (regions[i].tier === undefined ? -1 : regions[i].tier)))
            //先排 1 層, 排不下才加層(未指定層者依序交錯分配)
            for (let nT = Math.max(1, maxForced + 1); nT <= 4 && !res; nT++) {
                let tierOf = {}
                sorted.filter((i) => regions[i].tier === undefined).forEach((i, k) => {
                    tierOf[i] = k % nT
                })
                idx.forEach((i) => {
                    if (regions[i].tier !== undefined) {
                        tierOf[i] = regions[i].tier
                    }
                })
                let got = []
                let ok = true
                for (let t = 0; t < nT && ok; t++) {
                    let mem = sorted.filter((i) => tierOf[i] === t)
                    if (mem.length === 0) {
                        continue
                    }
                    mem = bestOrder(mem, side, t).ord
                    let lefts = spreadTier(mem, !!nearSides[side])
                    if (!lefts) {
                        ok = false
                        break
                    }
                    mem.forEach((i, k) => got.push({ i, tier: t, left: lefts[k] }))
                }
                if (ok) {
                    res = got
                }
            }
            if (!res) {
                iss.push(item('TIER_OVERFLOW', `${side} 之標籤 4 層仍排不下`, idx.slice()))
                return { chosen: [], moved: [], iss }
            }
            //各標籤之引線: 起點候選 × 接點之端, 取不與已選之引線相交、不穿過他人之標籤與水平線者之最低成本; 由左至右依序
            res.sort((a, b) => a.left - b.left)
            let others = res.map((g) => geomBand(g.i, side, g.tier, g.left, { A: { x: 0, y: 0 } }, 'l'))
            let chosen = []
            let prevAx = {}
            for (let g of res) {
                let free = (gg) => !chosen.some((p) => segSeg(p.A, p.J, gg.A, gg.J)) &&
                    !others.some((o) => o.i !== g.i && (segHitRect(gg.A, gg.J, o.tb) || segSeg(gg.A, gg.J, { x: o.left, y: o.J.y }, { x: o.left + lenOf(o.i), y: o.J.y }))) &&
                    !sideOnes.some((p) => segSeg(p.A, p.J, gg.A, gg.J) || segSeg(p.J, p.E, gg.A, gg.J) || segHitRect(gg.A, gg.J, p.tb))
                let candsOf = (cross) => {
                    let cs = []
                    for (let c of edgeAnchors(g.i, side)) {
                        for (let end of endsOf(g.i)) {
                            let gg = geomBand(g.i, side, g.tier, g.left, c, end)
                            let e = linkEval(g.i, c, gg.J, 6, cross)
                            if (e) {
                                cs.push({ gg, ...e })
                            }
                        }
                    }
                    return cs.sort((a, b) => a.cost - b.cost)
                }
                //候選: 不穿框者與穿框者(穿框之成本含 crossPen; 只有過擠才換方向, 不因穿框而移至下方);
                //  起點 x 小於同層前一標籤之起點者加 orderPen(順序依自紅框出發之位置由左往右); 取不與他人衝突者之最低, 皆衝突則取最低
                let pv = prevAx[g.tier]
                let score = (c) => c.cost + (pv !== undefined && c.gg.A.x < pv - 2 ? lay.orderPen : 0)
                let cs = [...candsOf(false), ...candsOf(true).filter((c) => c.k > 0)].sort((a, b) => score(a) - score(b))
                let pick = cs.find(({ gg }) => free(gg)) || cs[0]
                if (!pick) {
                    pick = { gg: geomBand(g.i, side, g.tier, g.left, { A: info[g.i].A, edge: side, at: null }, endsOf(g.i)[0]), k: 0 }
                    iss.push(item('NO_PATH', `「${regions[g.i].label}」之引線無可用之路徑(過於平躺或須穿入自身之框), 請以 anchor、x、dx、side 調整`, [g.i]))
                    noPath = true
                }
                chosen.push(pick.gg)
                prevAx[g.tier] = pick.gg.A.x
            }
            return { chosen, moved: mv, iss, noPath }
        }
        for (let side of ['top', 'bottom']) {
            let idx = onSide(side)
            if (idx.length === 0) {
                continue
            }
            //下方層之斜線自上方接至水平線之端, 會穿過其上之功能文字: 依斜線角度估算文字須避讓之距離, 加長水平線(extra)後重排, 至多 5 次
            //  平分後有引線無可用之路徑者(標籤少而功能區集中於一側時), 該側改為靠近引線落點再排 1 次, 列為注意
            let r = null
            for (let att = 0; att < 2; att++) {
                for (let rep = 0; rep < 5; rep++) {
                    r = layBand(side, idx)
                    let grew = false
                    for (let p of r.chosen) {
                        let need = textClear(p)
                        if (need > (extra[p.i] || 0) + 0.5) {
                            extra[p.i] = Math.ceil(need)
                            grew = true
                        }
                    }
                    if (!grew) {
                        break
                    }
                }
                if (r.noPath && !nearSides[side] && lay.spread !== 'near') {
                    nearSides[side] = true
                    notes.push(item('TIER_NEAR', `${side === 'top' ? '上方' : '下方'}層平分間距後有引線無可用之路徑, 該層改為靠近引線落點`, idx.slice()))
                    continue
                }
                break
            }
            issues.push(...r.iss)
            moved.push(...r.moved)
            placed.push(...r.chosen)
        }
        if (moved.length === 0) {
            break
        }
        for (let [i, v] of moved) {
            info[i] = { ...info[i], ...v }
        }
    }

    //四、檢核: 標籤相疊、引線穿過他人之標籤、引線相交、水平線超出層之範圍為問題; 引線穿過他框為注意(無法自動排入時允許)
    for (let p of placed) {
        let hit = [...new Set([...hitList(p.i, p.A, p.J, 0), ...hitList(p.i, p.J, p.E, 0)])]
        if (hit.length > 0) {
            notes.push(item('LEAD_THROUGH_BOX', `「${regions[p.i].label}」之引線穿過「${hit.map((k) => regions[k].label).join('」「')}」之框(無法自動排入)`, [p.i, ...hit]))
        }
        if (segHitRect(p.A, p.J, p.tb)) {
            issues.push(item('LEAD_COVERS_TEXT', `「${regions[p.i].label}」之引線遮住其功能文字`, [p.i]))
        }
        if ((p.side === 'top' || p.side === 'bottom') && (Math.min(p.J.x, p.E.x) < XL - EPS || Math.max(p.J.x, p.E.x) > XR + EPS)) {
            issues.push(item('LINE_OUT_OF_BAND', `「${regions[p.i].label}」之水平線超出層之範圍`, [p.i]))
        }
    }
    for (let a = 0; a < placed.length; a++) {
        for (let b = a + 1; b < placed.length; b++) {
            let P = placed[a]
            let Q = placed[b]
            let nm = `「${regions[P.i].label}」與「${regions[Q.i].label}」`
            if (boxHit(P.tb, Q.tb, 6)) {
                issues.push(item('LABEL_OVERLAP', `標籤相疊: ${nm}`, [P.i, Q.i]))
            }
            if (segHitRect(P.A, P.J, Q.tb) || segHitRect(Q.A, Q.J, P.tb)) {
                issues.push(item('LEAD_THROUGH_LABEL', `引線穿過標籤: ${nm}`, [P.i, Q.i]))
            }
            let segs = (p) => [[p.A, p.J], [p.J, p.E]]
            if (segs(P).some(([p1, p2]) => segs(Q).some(([q1, q2]) => segSeg(p1, p2, q1, q2)))) {
                issues.push(item('LEAD_CROSS', `引線相交: ${nm}`, [P.i, Q.i]))
            }
        }
    }

    //五、整體範圍與平移(上下層之範圍固定為 [XL, XR]; 陰影之範圍亦計入; 左右側之標籤超出者另計)
    let M = lay.margin
    let sh = st.shadow
    let shR = sh ? sh.blur * 2.5 : 0
    let xs = [XL, XR]
    let ys = [0, H0]
    if (sh) {
        xs.push(sh.dx - shR, W0 + sh.dx + shR)
        ys.push(sh.dy - shR, H0 + sh.dy + shR)
    }
    for (let p of placed) {
        xs.push(p.tb.x1, p.tb.x2, p.J.x, p.E.x)
        ys.push(p.tb.y1, p.tb.y2, p.J.y)
    }
    let x0 = Math.min(...xs)
    let x1 = Math.max(...xs)
    if (x0 < XL - EPS) {
        x0 -= M
    }
    else {
        x0 = XL
    }
    if (x1 > XR + EPS) {
        x1 += M
    }
    else {
        x1 = XR
    }
    let ox = -x0
    let oy = M - Math.min(...ys)
    let w = Math.ceil(x1 - x0)
    let h = Math.ceil(Math.max(...ys) + oy + M)
    if (lay.canvasW > 0) {
        if (w > lay.canvasW) {
            issues.push(item('CANVAS_TOO_WIDE', `畫布寬 ${w} 超過設定之 ${lay.canvasW}`, []))
        }
        else {
            ox += Math.floor((lay.canvasW - w) / 2)
            w = lay.canvasW
        }
    }
    else if (w > XR - XL) {
        issues.push(item('CANVAS_TOO_WIDE', `畫布寬 ${w} 超過層總寬 ${XR - XL}(報告內之字級將小於他圖)`, []))
    }
    //排版結果(依功能區之順序; 可照抄為設定檔之覆寫值)
    let decisions = regions.map((r, i) => {
        let p = placed.find((q) => q.i === i)
        if (!p) {
            return { label: r.label }
        }
        return { label: r.label, side: p.side, tier: p.tier || 0, anchor: { edge: p.edge, at: p.at === null || p.at === undefined ? null : Math.round(p.at * 100) / 100 }, x: Math.round(Math.min(p.J.x, p.E.x)), len: Math.round(Math.abs(p.E.x - p.J.x)), join: p.end }
    })
    let geo = placed.map((p) => ({ i: p.i, A: { x: p.A.x, y: p.A.y }, J: { x: p.J.x, y: p.J.y }, E: { x: p.E.x, y: p.E.y }, tx: p.tx, ty: p.ty }))
    return { w, h, ox, oy, issues, notes, decisions, placed: geo }
}


export default layout
