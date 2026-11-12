//截圖之裁切(內部模組; 於瀏覽器頁面內執行, 以 page.evaluate(cropInPage, inp) 呼叫; 取代原型之 sharp)
//  規則 R-GC-PAGE-01: 本函式只能用參數與頁面全域, 不得引用模組層識別字; 本模組只放本函式之 export; 不用會被轉譯之語法(展開、??、?.、async)
//inp: { b64(png 之 base64), x, y, w, h }
//回傳 Promise: 裁切後 png 之 base64(canvas drawImage → toDataURL; 截圖不帶 ICC 時與 sharp extract 逐位元組相同之像素)
function cropInPage(inp) {
    return new Promise(function(resolve, reject) {
        let img = new Image()
        img.onload = function() {
            let c = document.createElement('canvas')
            c.width = inp.w
            c.height = inp.h
            let g = c.getContext('2d')
            g.drawImage(img, inp.x, inp.y, inp.w, inp.h, 0, 0, inp.w, inp.h)
            let u = c.toDataURL('image/png')
            resolve(u.slice(u.indexOf(',') + 1))
        }
        img.onerror = function() {
            reject(new Error('png decode failed'))
        }
        img.src = 'data:image/png;base64,' + inp.b64
    })
}


export default cropInPage
