import htmlEncode from 'wsemi/src/htmlEncode.mjs'


//組 svg(內嵌截圖並加陰影, 可再以 Inkscape 微調); 規則見 sgud/rule/rulebook.md 之 R-GC-SVG-01
//  數值一律為已檢測之 number(座標以 fm 取至 0.1, 其餘照原值, 與原型相同); 屬性值(顏色、字型)已過白名單, 寫入時再經 htmlEncode; 標籤文字經 htmlEncode
//inp: { L(layout 之結果), regions(裁切後座標之功能區), st, W0, H0, b64(截圖 png 之 base64) }
function genSvg(inp) {
    let { L, regions, st, W0, H0, b64 } = inp
    let fm = (v) => Math.round(v * 10) / 10
    let ea = (s) => htmlEncode(String(s))
    let ox = L.ox
    let oy = L.oy
    let sh = st.shadow
    //截圖之陰影(以 feGaussianBlur＋feOffset＋feFlood 組成, 相容於 Inkscape)
    let defs = ''
    if (sh) {
        defs = `<defs><filter id="shot-shadow" x="-10%" y="-10%" width="120%" height="120%" color-interpolation-filters="sRGB"><feGaussianBlur in="SourceAlpha" stdDeviation="${sh.blur}"/><feOffset dx="${sh.dx}" dy="${sh.dy}" result="ob"/><feFlood flood-color="${ea(sh.color)}" flood-opacity="${sh.opacity}"/><feComposite in2="ob" operator="in"/><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>`
    }
    let out = []
    for (let r of regions) {
        let b = r.box
        out.push(`<rect x="${fm(b.x1 + ox)}" y="${fm(b.y1 + oy)}" width="${fm(b.x2 - b.x1)}" height="${fm(b.y2 - b.y1)}" fill="none" stroke="${ea(st.frame)}" stroke-width="${st.frameW}"/>`)
    }
    for (let p of L.placed) {
        out.push(`<polyline points="${fm(p.A.x + ox)},${fm(p.A.y + oy)} ${fm(p.J.x + ox)},${fm(p.J.y + oy)} ${fm(p.E.x + ox)},${fm(p.E.y + oy)}" fill="none" stroke="${ea(st.lead)}" stroke-width="${st.leadW}" stroke-linejoin="round"/>`)
        out.push(`<text x="${fm(p.tx + ox)}" y="${fm(p.ty + oy)}" font-family="${ea(st.font)}, 微軟正黑體, sans-serif" font-size="${st.fs}" fill="${ea(st.textColor)}">${htmlEncode(regions[p.i].label)}</text>`)
    }
    let flt = sh ? ' filter="url(#shot-shadow)"' : ''
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${L.w}" height="${L.h}" viewBox="0 0 ${L.w} ${L.h}">\n${defs}\n<rect width="100%" height="100%" fill="#ffffff"/>\n<image x="${ox}" y="${oy}" width="${W0}" height="${H0}"${flt} xlink:href="data:image/png;base64,${b64}"/>\n${out.join('\n')}\n</svg>\n`
    return svg
}


export default genSvg
