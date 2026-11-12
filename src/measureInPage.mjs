//功能指引圖之量框(內部模組; 於瀏覽器頁面內執行, 以 page.evaluate(measureInPage, find) 呼叫)
//  規則 R-GC-PAGE-01: 本函式只能用參數與頁面全域, 不得引用模組層識別字; 本模組只放本函式之 export; 不用會被轉譯之語法(展開、??、?.、async)
//find 為 Node 端已檢測並正規化者:
//  { sel: 'css', mode, pad }                第一個可見之符合元素
//  { at: [x, y], minW, minH, mode, pad }     該點之元素往上第一個寬高皆達門檻之祖先
//  { rect: {x1,y1,x2,y2}, pad }              Node 端先以 page.evaluate(find.fn, find.arg) 得出之矩形
//  { union: [find, ...], mode, pad }         各者之聯集(任一成員量不到即整個量不到)
//  mode: 'fit'(取可見內容之聯集, 不含空白) | 'box'(元素之外框); pad: 外擴之像素(只用最外層者)
//回傳 { box: { x1, y1, x2, y2 } }(視窗座標, 已含內距並夾於視窗內, 距視窗邊至少 3) 或 { box: null, why: 'selector' | 'none' | 'empty' }
function measureInPage(find) {
    let VW = window.innerWidth
    let VH = window.innerHeight
    let why = 'none'
    let toR = function(r) {
        return { x1: r.left, y1: r.top, x2: r.right, y2: r.bottom }
    }
    let vis = function(e) {
        let cs = getComputedStyle(e)
        let r = e.getBoundingClientRect()
        return cs.display !== 'none' && cs.visibility !== 'hidden' && parseFloat(cs.opacity) > 0 && r.width > 0 && r.height > 0
    }
    let uni = function(rs) {
        let a = null
        for (let i = 0; i < rs.length; i++) {
            let b = rs[i]
            a = a ? { x1: Math.min(a.x1, b.x1), y1: Math.min(a.y1, b.y1), x2: Math.max(a.x2, b.x2), y2: Math.max(a.y2, b.y2) } : b
        }
        return a
    }
    let clipV = function(r) {
        return r ? { x1: Math.max(0, r.x1), y1: Math.max(0, r.y1), x2: Math.min(VW, r.x2), y2: Math.min(VH, r.y2) } : null
    }
    //可見內容之聯集: 文字、替換元素(圖片、svg、canvas、輸入框)、字型圖示, 以及有底色、漸層底、邊框或陰影而小於容器一半之元素
    let fitOf = function(root) {
        let rr = root.getBoundingClientRect()
        let area = rr.width * rr.height
        let rs = []
        let tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
        while (tw.nextNode()) {
            let n = tw.currentNode
            if (!n.textContent.trim() || !vis(n.parentElement)) {
                continue
            }
            let rg = document.createRange()
            rg.selectNodeContents(n)
            let crs = rg.getClientRects()
            for (let i = 0; i < crs.length; i++) {
                if (crs[i].width > 0 && crs[i].height > 0) {
                    rs.push(toR(crs[i]))
                }
            }
        }
        let els = root.querySelectorAll('*')
        let tags = ['img', 'svg', 'canvas', 'input', 'select', 'textarea', 'button']
        for (let k = 0; k < els.length; k++) {
            let e = els[k]
            if (!vis(e)) {
                continue
            }
            let r = e.getBoundingClientRect()
            let tag = e.tagName.toLowerCase()
            let cs = getComputedStyle(e)
            //漸層底(background-image)之圖示底塊亦為可見內容
            let deco = (cs.backgroundColor && !/rgba\(0, 0, 0, 0\)|transparent/.test(cs.backgroundColor)) || (cs.backgroundImage && cs.backgroundImage !== 'none') || parseFloat(cs.borderTopWidth) > 0 || parseFloat(cs.borderBottomWidth) > 0 || cs.boxShadow !== 'none'
            //分隔線(高或寬不足 4 像素)不算內容, 否則框會被拉至整列寬; 字型圖示(<i>、mdi)以 ::before 繪製, 無文字節點, 須另計
            let icon = tag === 'i' || /\bmdi\b|\bv-icon\b/.test(typeof e.className === 'string' ? e.className : '')
            if (tags.indexOf(tag) >= 0 || icon || (deco && r.width * r.height < area * 0.5 && r.width > 3 && r.height > 3)) {
                rs.push(toR(r))
            }
        }
        //只計容器內之部分
        let cut = []
        for (let j = 0; j < rs.length; j++) {
            let c = { x1: Math.max(rs[j].x1, rr.left), y1: Math.max(rs[j].y1, rr.top), x2: Math.min(rs[j].x2, rr.right), y2: Math.min(rs[j].y2, rr.bottom) }
            if (c.x2 > c.x1 && c.y2 > c.y1) {
                cut.push(c)
            }
        }
        let u = clipV(uni(cut))
        if (!u) {
            why = 'empty'
        }
        return u
    }
    let elOf = function(f) {
        if (f.sel) {
            let list = null
            try {
                list = document.querySelectorAll(f.sel)
            }
            catch (err) {
                why = 'selector'
                return null
            }
            for (let i = 0; i < list.length; i++) {
                if (vis(list[i])) {
                    return list[i]
                }
            }
            return null
        }
        if (f.at) {
            let e = document.elementFromPoint(f.at[0], f.at[1])
            while (e && e !== document.body) {
                let r = e.getBoundingClientRect()
                if (r.width >= f.minW && r.height >= f.minH) {
                    return e
                }
                e = e.parentElement
            }
            return null
        }
        return null
    }
    let one = function(f) {
        if (f.union) {
            let rs = []
            for (let i = 0; i < f.union.length; i++) {
                let r = one(f.union[i])
                if (!r) {
                    return null
                }
                rs.push(r)
            }
            return uni(rs)
        }
        if (f.rect) {
            return clipV(f.rect)
        }
        let e = elOf(f)
        if (!e) {
            return null
        }
        return f.mode === 'box' ? clipV(toR(e.getBoundingClientRect())) : fitOf(e)
    }
    let r = one(find)
    if (!r) {
        return { box: null, why }
    }
    let pad = find.pad
    let m = 3
    return { box: { x1: Math.max(m, r.x1 - pad), y1: Math.max(m, r.y1 - pad), x2: Math.min(VW - m, r.x2 + pad), y2: Math.min(VH - m, r.y2 + pad) } }
}


export default measureInPage
