import path from 'path'
import isobj from 'wsemi/src/isobj.mjs'
import isestr from 'wsemi/src/isestr.mjs'
import isfun from 'wsemi/src/isfun.mjs'
import isbol from 'wsemi/src/isbol.mjs'
import isenum from 'wsemi/src/isenum.mjs'
import iseint from 'wsemi/src/iseint.mjs'
import mkErr from './mkErr.mjs'
import { defaultStyle, defaultLayout } from './defaults.mjs'


//輸入檢測之宣告表與套用(R-GC-ARG-01～05; 種類代號依 dspec〈輸入參數之檢測機制〉§3)
//  暫行: 以 wsemi 公開之判斷函數逐鍵宣告; wsemi 之公開 opt 解析函數上線後改用之(R-GC-ARG-05, 待辦)
//  必給鍵無效 → 回 E_ARG 之錯誤(由入口 reject); 選填鍵無效 → 視為未給、改用預設(K3), opt.debug 時警告(不含值, K9)
//  全部檢測先於任何副作用(V17); 不改寫呼叫端之物件(V9); 每鍵只讀一次, 讀取拋錯即無效(V11); 未宣告之鍵忽略(V7)


let NG = { ok: false }
let ok = (v) => ({ ok: true, v })
let toNum = (v) => (typeof v === 'number' ? v : Number(String(v).trim()))

//種類判定本身拋錯(可撤銷之 Proxy、拋錯之 Symbol.toStringTag 等)一律視為不屬該種類, 不讓例外逸出
let safe = (fn) => (v) => {
    try {
        return fn(v)
    }
    catch (err) {
        return false
    }
}
//O1 一般物件: 原型為 Object.prototype 或 null
let isPlain = safe((v) => {
    if (!isobj(v)) {
        return false
    }
    let p = Object.getPrototypeOf(v)
    return p === Object.prototype || p === null
})
//A1～A3 之容器: 真陣列(Array.isArray; 不以 Object.prototype.toString 判定, 免被 Symbol.toStringTag 冒充)
let isArray = safe((v) => Array.isArray(v))

//執行種類判定(判定本身拋錯即不屬該種類)
let run = (k, v) => {
    try {
        return k(v)
    }
    catch (err) {
        return NG
    }
}

//讀鍵一次(存取器拋錯即無效)
let rd = (o, k) => {
    try {
        return { ok: true, v: o[k] }
    }
    catch (err) {
        return { ok: false, v: undefined }
    }
}

//各種類之判定(回 { ok, v }, v 為轉換後之值; desc 為訊息之種類描述)
let mk = (desc, fn) => {
    fn.desc = desc
    return fn
}
let kObj = mk('a plain object', (v) => (isPlain(v) ? ok(v) : NG))
let kStr = mk('a non-empty string', (v) => (typeof v === 'string' && isestr(v) ? ok(v) : NG))
//F1 之判定為 wsemi isfun(一般、generator、async 函數; async generator 函數不屬之), 與觀察回調之取得(wsemi getTrace)同一判定
let kFun = mk('a function', (v) => (safe(isfun)(v) ? ok(v) : NG))
let kBol = mk('a boolean', (v) => (typeof v === 'boolean' && isbol(v) ? ok(v) : NG))
let kNum = (desc, o) => mk(desc, (v) => ((typeof v === 'number' || typeof v === 'string') && isenum(v, o) ? ok(toNum(v)) : NG))
let kInt = (desc, o) => mk(desc, (v) => ((typeof v === 'number' || typeof v === 'string') && iseint(v, o) ? ok(toNum(v)) : NG))
let kEnum = (list) => mk(`one of ${list.map((s) => `'${s}'`).join(', ')}`, (v) => (typeof v === 'string' && list.includes(v) ? ok(v) : NG))
let kPath = mk('a non-empty path string without NUL', (v) => (typeof v === 'string' && isestr(v) && !v.includes('\0') && v.length <= 4096 ? ok(v) : NG))
//S4 安全檔名: 英數開頭, 只含英數與 . _ -, 至多 100 字元, 不以 . 結尾, 非 Windows 保留名(含帶副檔名者), 不以 .layout 結尾(與排版結果檔 <名稱>.layout.json 相撞)
let RESERVED = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(\..*)?$/i
let kName = mk('a safe file name (letters, digits, . _ -; not reserved)', (v) => (typeof v === 'string' && /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/.test(v) && !v.endsWith('.') && !RESERVED.test(v) && !/\.layout$/i.test(v) ? ok(v) : NG))
//寫入 svg 之文字只收 XML 1.0 容許且非控制字元之碼點: U+0020～U+007E、U+00A0～U+D7FF、U+E000～U+FFFD 與成對之代理字元(擴充平面);
//  C0／C1 控制字元、U+FFFE／U+FFFF、孤立代理字元皆拒(否則成為 XML 不容許之字元參照, 原則 3 收嚴)
let xmlText = (s) => {
    if (s.length === 0) {
        return false
    }
    for (let ch of s) { //依碼點走訪: 成對之代理字元為一個碼點, 孤立者為 0xD800～0xDFFF
        let c = ch.codePointAt(0)
        let good = (c >= 0x20 && c <= 0x7E) || (c >= 0xA0 && c <= 0xD7FF) || (c >= 0xE000 && c <= 0xFFFD) || (c >= 0x10000 && c <= 0x10FFFF)
        if (!good) {
            return false
        }
    }
    return true
}
//標籤: S1, 只含上列碼點
let kLabel = mk('a non-empty well-formed string without control characters', (v) => (typeof v === 'string' && isestr(v) && xmlText(v) ? ok(v) : NG))
//顏色: #rgb、#rrggbb、英文色名
let kColor = mk('a color #rgb, #rrggbb or a color name', (v) => (typeof v === 'string' && /^(#[0-9A-Fa-f]{3}|#[0-9A-Fa-f]{6}|[A-Za-z]{3,20})$/.test(v) ? ok(v) : NG))
//字型: S1, 不含 " ' < > & ; \ 與控制字元, 至多 100 字元
let kFont = mk('a font family name without quotes or markup characters', (v) => (typeof v === 'string' && isestr(v) && v.length <= 100 && v.trim() === v && !/["'<>&;\\]/.test(v) && xmlText(v) ? ok(v) : NG))
let kNullOr = (k) => {
    let f = mk(`null or ${k.desc}`, (v) => (v === null ? ok(null) : k(v)))
    f.nullable = true
    return f
}

let nNonNeg = (max) => kNum(`a non-negative number up to ${max}`, { min: 0, max })
let nPos = (max) => kNum(`a positive number up to ${max}`, { gt: 0, max })
let nAny = (lim) => kNum(`a number from -${lim} to ${lim}`, { min: -lim, max: lim })
let kRatio = kNum('a number from 0 to 1', { use: 'ratio' })
let kSide = kEnum(['top', 'bottom', 'left', 'right'])
let kJoin = kEnum(['l', 'r', 'auto'])

//樣式之宣告(鍵 → 種類)
let STYLE = {
    frame: kColor,
    frameW: nPos(50),
    lead: kColor,
    leadW: nPos(50),
    font: kFont,
    fs: nPos(400),
    textColor: kColor,
}
let SHADOW = {
    dx: nAny(200),
    dy: nAny(200),
    blur: nNonNeg(100),
    color: kColor,
    opacity: kRatio,
}
//排版之宣告(數值皆 N2, 上限防止畫布尺寸失控)
let LAYOUT = {
    ext: nNonNeg(10000),
    spread: kEnum(['even', 'near']),
    edge: nNonNeg(10000),
    minGap: nNonNeg(10000),
    join: kJoin,
    gapTop: nNonNeg(10000),
    gapBot: nNonNeg(10000),
    tierGap: kNullOr(nPos(10000)),
    sideEdges: kBol,
    maxSlope: nPos(100),
    rayM: nNonNeg(1000),
    crossPen: nNonNeg(1e9),
    penRight: nNonNeg(1e9),
    penLeft: nNonNeg(1e9),
    nearM: nNonNeg(1000),
    nearPen: nNonNeg(1e9),
    movePen: nNonNeg(1e9),
    orderPen: nNonNeg(1e9),
    framePen: nNonNeg(1e9),
    sideGap: nNonNeg(10000),
    lineGap: kNullOr(nPos(10000)),
    pad: nNonNeg(1000),
    base: nNonNeg(1000),
    margin: nNonNeg(1000),
    canvasW: kInt('a non-negative integer up to 16384 (0 for auto)', { min: 0, max: 16384 }),
}


//解析; 回 { err, cfg, o, warns }(不拋錯)
function parseConf(conf, opt) {
    let warns = []
    let debug = false
    let warn = (p, k) => {
        if (!debug) {
            return
        }
        let msg = `[w-guidechart] invalid ${p}: must be ${k.desc}, using the default`
        if (!warns.includes(msg)) {
            warns.push(msg)
        }
    }
    let argErr = (p, desc) => mkErr('E_ARG', `invalid ${p}: must be ${desc}`)

    //選填鍵: 未給(undefined、null)取預設; 給了而非該種類者改用預設並警告
    let opt1 = (o, key, k, def, p) => {
        if (!o) {
            return def
        }
        let r = rd(o, key)
        if (!r.ok) {
            warn(p, k)
            return def
        }
        if (r.v === undefined || (r.v === null && !k.nullable)) {
            return def
        }
        let c = run(k, r.v)
        if (!c.ok) {
            warn(p, k)
            return def
        }
        return c.v
    }
    //必給鍵: 無效即拋
    let req = (o, key, k, p) => {
        let r = rd(o, key)
        if (!r.ok || r.v === undefined || r.v === null) {
            throw argErr(p, k.desc)
        }
        let c = run(k, r.v)
        if (!c.ok) {
            throw argErr(p, k.desc)
        }
        return c.v
    }
    //選填之子物件: 未給回 null; 非一般物件視為未給並警告
    let sub = (o, key, p) => {
        let r = rd(o, key)
        if (!r.ok) {
            warn(p, kObj)
            return null
        }
        if (r.v === undefined || r.v === null) {
            return null
        }
        if (!isPlain(r.v)) {
            warn(p, kObj)
            return null
        }
        return r.v
    }
    //陣列: 讀長度與各元素各一次
    let arrOf = (v) => {
        let n = rd(v, 'length')
        if (!n.ok || !Number.isSafeInteger(n.v) || n.v < 0 || n.v > 100000) {
            return null
        }
        let out = []
        for (let i = 0; i < n.v; i++) {
            let r = rd(v, i)
            if (!r.ok) {
                return null
            }
            out.push(r.v)
        }
        return out
    }

    let parseStyle = (src, base, p) => {
        if (!src) {
            return base
        }
        let st = { ...base }
        for (let key of Object.keys(STYLE)) {
            st[key] = opt1(src, key, STYLE[key], base[key], `${p}.${key}`)
        }
        //shadow: null 為不加; 物件逐鍵與繼承之陰影(無則預設)合併
        let r = rd(src, 'shadow')
        if (!r.ok) {
            warn(`${p}.shadow`, kNullOr(kObj))
        }
        else if (r.v === null) {
            st.shadow = null
        }
        else if (r.v !== undefined) {
            if (!isPlain(r.v)) {
                warn(`${p}.shadow`, kNullOr(kObj))
            }
            else {
                let sb = base.shadow || defaultStyle.shadow
                let sh = {}
                for (let key of Object.keys(SHADOW)) {
                    sh[key] = opt1(r.v, key, SHADOW[key], sb[key], `${p}.shadow.${key}`)
                }
                st.shadow = sh
            }
        }
        return st
    }
    let parseLayout = (src, base, p) => {
        if (!src) {
            return base
        }
        let lay = { ...base }
        for (let key of Object.keys(LAYOUT)) {
            lay[key] = opt1(src, key, LAYOUT[key], base[key], `${p}.${key}`)
        }
        return lay
    }

    //find: sel、at、fn、union 恰給其一; union 遞迴(深度至多 8, 不得自我參照)
    let parseFind = (f, p, depth, stack) => {
        let one = 'a find object with exactly one of sel, at, fn, union'
        if (!isPlain(f)) {
            throw argErr(p, one)
        }
        if (depth > 8 || stack.includes(f)) {
            throw argErr(p, 'a find object nested at most 8 levels without cycles')
        }
        let g = (key) => {
            let r = rd(f, key)
            if (!r.ok) {
                throw argErr(`${p}.${key}`, 'a readable value')
            }
            return r.v
        }
        let sel = g('sel')
        let at = g('at')
        let fn = g('fn')
        let union = g('union')
        let given = [sel, at, fn, union].filter((v) => v !== undefined && v !== null).length
        if (given !== 1) {
            throw argErr(p, one)
        }
        let mode = opt1(f, 'mode', kEnum(['fit', 'box']), 'fit', `${p}.mode`)
        let nf = null
        if (sel !== undefined && sel !== null) {
            if (!kStr(sel).ok) {
                throw argErr(`${p}.sel`, kStr.desc)
            }
            nf = { sel, mode }
        }
        else if (at !== undefined && at !== null) {
            let a = isArray(at) ? arrOf(at) : null
            let kXY = nNonNeg(100000)
            if (!a || a.length !== 2 || !kXY(a[0]).ok || !kXY(a[1]).ok) {
                throw argErr(`${p}.at`, 'an array of two non-negative numbers')
            }
            nf = { at: [kXY(a[0]).v, kXY(a[1]).v], minW: opt1(f, 'minW', nNonNeg(100000), 0, `${p}.minW`), minH: opt1(f, 'minH', nNonNeg(100000), 0, `${p}.minH`), mode }
        }
        else if (fn !== undefined && fn !== null) {
            if (!kFun(fn).ok) {
                throw argErr(`${p}.fn`, kFun.desc)
            }
            //arg: 選填; 只收可傳入頁面之值, 取快照(檢測之值即傳入頁面之值, K4、V11), 不呼叫使用端之方法(toJSON、getter 皆不觸發, V9、V17)
            let sa = opt1(f, 'arg', kArg, null, `${p}.arg`)
            nf = { fn, arg: sa ? sa.v : undefined, argKey: sa ? sa.k : 'u', mode }
        }
        else {
            let a = isArray(union) ? arrOf(union) : null
            if (!a || a.length === 0) {
                throw argErr(`${p}.union`, 'a non-empty array of find objects')
            }
            let st2 = [...stack, f]
            nf = { union: a.map((m, k) => parseFind(m, `${p}.union[${k}]`, depth + 1, st2)), mode }
        }
        nf.pad = opt1(f, 'pad', nNonNeg(1000), (mode === 'box' || nf.fn) ? 2 : 6, `${p}.pad`)
        return nf
    }

    let o = { capture: false, debug: false, names: null, funLog: null, onTrace: null }
    try {
        //opt(先取 debug)
        if (opt !== undefined && opt !== null && isPlain(opt)) {
            debug = opt1(opt, 'debug', kBol, false, 'opt.debug')
            o.debug = debug
            o.funLog = opt1(opt, 'funLog', kFun, null, 'opt.funLog')
            o.onTrace = opt1(opt, 'onTrace', kFun, null, 'opt.onTrace')
            o.capture = opt1(opt, 'capture', kBol, false, 'opt.capture')
            let r = rd(opt, 'names')
            let kNames = mk('an array of non-empty strings', () => NG)
            if (!r.ok) {
                warn('opt.names', kNames)
            }
            else if (r.v !== undefined && r.v !== null) {
                let a = isArray(r.v) ? arrOf(r.v) : null
                if (!a || a.some((s) => !kStr(s).ok)) {
                    warn('opt.names', kNames)
                }
                else {
                    o.names = a
                }
            }
        }

        //conf
        if (!isPlain(conf)) {
            throw argErr('conf', kObj.desc)
        }
        let dirWork = path.resolve(req(conf, 'dirWork', kPath, 'conf.dirWork'))
        let dp = opt1(conf, 'dirPng', kPath, null, 'conf.dirPng')
        let dirPng = dp === null ? path.join(dirWork, 'png') : path.resolve(dp)
        let envSrc = req(conf, 'env', kObj, 'conf.env')
        let env = {
            launchBrowser: req(envSrc, 'launchBrowser', kFun, 'conf.env.launchBrowser'),
            openPage: opt1(envSrc, 'openPage', kFun, null, 'conf.env.openPage'),
            helpers: rd(envSrc, 'helpers').v, //X: 不檢, 原樣交給 open(V8)
            afterCapture: opt1(envSrc, 'afterCapture', kFun, null, 'conf.env.afterCapture'),
        }
        let stG = parseStyle(sub(conf, 'style', 'conf.style'), defaultStyle, 'conf.style')
        let layG = parseLayout(sub(conf, 'layout', 'conf.layout'), defaultLayout, 'conf.layout')
        let capSrc = sub(conf, 'capture', 'conf.capture')
        let kPark = kNullOr(mk('an array of two non-negative numbers', (v) => {
            let a = isArray(v) ? arrOf(v) : null
            let kXY = nNonNeg(100000)
            if (!a || a.length !== 2 || !kXY(a[0]).ok || !kXY(a[1]).ok) {
                return NG
            }
            return ok([kXY(a[0]).v, kXY(a[1]).v])
        }))
        let capture = {
            mousePark: opt1(capSrc, 'mousePark', kPark, [1000, 4], 'conf.capture.mousePark'),
            settle: opt1(capSrc, 'settle', kEnum(['stable', 'fonts']), 'stable', 'conf.capture.settle'),
            settleMs: opt1(capSrc, 'settleMs', kNum('a positive timer value in milliseconds', { use: 'timer', gt: 0 }), 5000, 'conf.capture.settleMs'),
        }

        let vsRaw = rd(conf, 'views')
        let vs = vsRaw.ok && isArray(vsRaw.v) ? arrOf(vsRaw.v) : null
        if (!vs || vs.length === 0) {
            throw argErr('conf.views', 'a non-empty array of plain objects')
        }
        let seen = new Set()
        let views = vs.map((v, i) => {
            let pv = `conf.views[${i}]`
            if (!isPlain(v)) {
                throw argErr(pv, kObj.desc)
            }
            let name = req(v, 'name', kName, `${pv}.name`)
            let lower = name.toLowerCase()
            if (seen.has(lower)) {
                throw argErr(`${pv}.name`, 'unique among conf.views (case-insensitive)')
            }
            seen.add(lower)
            let open = req(v, 'open', kFun, `${pv}.open`)
            let rr = rd(v, 'regions')
            let rs = rr.ok && isArray(rr.v) ? arrOf(rr.v) : null
            if (!rs) {
                throw argErr(`${pv}.regions`, 'an array of plain objects')
            }
            let kCrop = mk('an array [x1, y1, x2, y2] of non-negative integers with x1 < x2 and y1 < y2', (c) => {
                let a = isArray(c) ? arrOf(c) : null
                let kI = kInt('', { min: 0, max: 100000 })
                if (!a || a.length !== 4 || a.some((x) => !kI(x).ok)) {
                    return NG
                }
                let q = a.map((x) => kI(x).v)
                return q[0] < q[2] && q[1] < q[3] ? ok(q) : NG
            })
            let crop = opt1(v, 'crop', kCrop, null, `${pv}.crop`)
            let st = parseStyle(sub(v, 'style', `${pv}.style`), stG, `${pv}.style`)
            let lay = parseLayout(sub(v, 'layout', `${pv}.layout`), layG, `${pv}.layout`)
            let regions = rs.map((r, j) => {
                let pr = `${pv}.regions[${j}]`
                if (!isPlain(r)) {
                    throw argErr(pr, kObj.desc)
                }
                let label = req(r, 'label', kLabel, `${pr}.label`)
                let fr = rd(r, 'find')
                if (!fr.ok) {
                    throw argErr(`${pr}.find`, 'a readable value')
                }
                let find = parseFind(fr.v, `${pr}.find`, 1, [])
                //功能區之覆寫(選填; 無效者視為未給)
                let ovr = {}
                let set = (key, val) => {
                    if (val !== null) {
                        ovr[key] = val
                    }
                }
                set('side', opt1(r, 'side', kSide, null, `${pr}.side`))
                set('ax', opt1(r, 'ax', kRatio, null, `${pr}.ax`))
                let an = sub(r, 'anchor', `${pr}.anchor`)
                if (an) {
                    let kAn = mk('{ edge: one of top, bottom, left, right; at: a number from 0 to 1 }', () => NG)
                    let e = rd(an, 'edge')
                    let a = rd(an, 'at')
                    let ce = e.ok ? kSide(e.v) : NG
                    let ca = a.ok ? kRatio(a.v) : NG
                    if (ce.ok && ca.ok) {
                        ovr.anchor = { edge: ce.v, at: ca.v }
                    }
                    else {
                        warn(`${pr}.anchor`, kAn)
                    }
                }
                set('tier', opt1(r, 'tier', kInt('an integer from 0 to 3', { min: 0, max: 3 }), null, `${pr}.tier`))
                set('x', opt1(r, 'x', nAny(100000), null, `${pr}.x`))
                set('dx', opt1(r, 'dx', nAny(100000), null, `${pr}.dx`))
                set('join', opt1(r, 'join', kJoin, null, `${pr}.join`))
                return { label, find, findKey: findKeyOf(find), ovr }
            })
            return { idx: i, name, open, src: v, crop, st, lay, regions }
        })

        let cfg = {
            dirWork,
            dirPng,
            dirs: { shot: path.join(dirWork, 'shots'), data: path.join(dirWork, 'data'), svg: path.join(dirWork, 'svg'), png: dirPng },
            env,
            capture,
            views,
        }
        return { err: null, cfg, o, warns }
    }
    catch (err) {
        //o 供入口於 reject 前把警告交給 opt.funLog; 非預期之例外亦以固定詞彙之 E_ARG 回報(不回顯)
        let e = err && err.code === 'E_ARG' ? err : mkErr('E_ARG', 'invalid conf: must be readable plain data')
        return { err: e, cfg: null, o, warns }
    }
}


//find.arg 之快照與核對鍵: 只收原始值(含 NaN、±Infinity、-0、BigInt)、真陣列、一般物件、Date;
//  只讀自有之資料屬性(存取器、循環參照、函數、Symbol、其他物件皆不收), 不呼叫使用端之方法; 核對鍵帶型別標記, 不同之值不相撞
function snapArg(v) {
    let seen = []
    let dataOf = (x, key) => {
        let d = Object.getOwnPropertyDescriptor(x, key)
        if (!d) {
            return undefined
        }
        if ('get' in d || 'set' in d) {
            throw new Error('accessor')
        }
        return d.value
    }
    let put = (o, key, val) => Object.defineProperty(o, key, { value: val, enumerable: true, writable: true, configurable: true })
    let walk = (x, depth) => {
        if (depth > 32) {
            throw new Error('depth')
        }
        if (x === undefined) {
            return { v: undefined, k: 'u' }
        }
        if (x === null) {
            return { v: null, k: 'n' }
        }
        let t = typeof x
        if (t === 'boolean') {
            return { v: x, k: x ? 'T' : 'F' }
        }
        if (t === 'number') {
            return { v: x, k: Object.is(x, -0) ? 'd-0' : `d${String(x)}` }
        }
        if (t === 'bigint') {
            return { v: x, k: `g${x.toString()}` }
        }
        if (t === 'string') {
            return { v: x, k: `s${JSON.stringify(x)}` }
        }
        if (t !== 'object' || seen.includes(x)) {
            throw new Error('kind')
        }
        seen.push(x)
        let r = null
        if (Array.isArray(x)) {
            let n = dataOf(x, 'length')
            if (n > 100000) {
                throw new Error('size')
            }
            let vs = []
            let ks = []
            for (let i = 0; i < n; i++) {
                let s = walk(dataOf(x, String(i)), depth + 1)
                vs.push(s.v)
                ks.push(s.k)
            }
            r = { v: vs, k: `[${ks.join(',')}]` }
        }
        else if (Object.getPrototypeOf(x) === Date.prototype) {
            let ms = Date.prototype.getTime.call(x)
            r = { v: new Date(ms), k: `D${ms}` }
        }
        else if (isPlain(x)) {
            let o = {}
            let ks = []
            for (let key of Object.keys(x)) {
                let s = walk(dataOf(x, key), depth + 1)
                put(o, key, s.v)
                ks.push(`${JSON.stringify(key)}:${s.k}`)
            }
            r = { v: o, k: `{${ks.join(',')}}` }
        }
        else {
            throw new Error('kind')
        }
        seen.pop()
        return r
    }
    try {
        return walk(v, 0)
    }
    catch (err) {
        return null
    }
}
let kArg = mk('a value passable to the page (primitive, array, plain object or Date; no accessors or cycles)', (v) => {
    let s = snapArg(v)
    return s ? ok(s) : NG
})
kArg.nullable = true


//find 之核對鍵(只作比較、不執行): 正規化後之 find, fn 以其原始碼字串(Function.prototype.toString, 不呼叫使用端之 toString)、arg 以帶型別標記之快照鍵表示
function findKeyOf(nf) {
    let canon = (f) => {
        if (f.union) {
            return { union: f.union.map(canon), mode: f.mode, pad: f.pad }
        }
        if (f.fn) {
            let src = ''
            try {
                src = Function.prototype.toString.call(f.fn)
            }
            catch (err) {
                src = '(no source)'
            }
            return { fn: src, arg: f.argKey, pad: f.pad }
        }
        if (f.at) {
            return { at: f.at, minW: f.minW, minH: f.minH, mode: f.mode, pad: f.pad }
        }
        return { sel: f.sel, mode: f.mode, pad: f.pad }
    }
    return JSON.stringify(canon(nf))
}


export default parseConf
