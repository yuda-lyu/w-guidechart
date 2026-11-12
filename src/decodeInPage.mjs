//截圖之解碼檢查(內部模組; 於瀏覽器頁面內執行, 以 page.evaluate(decodeInPage, b64) 呼叫)
//  規則 R-GC-PAGE-01: 本函式只能用參數與頁面全域, 不得引用模組層識別字; 本模組只放本函式之 export; 不用會被轉譯之語法(展開、??、?.、async)
//輸入 png 之 base64; 回傳 Promise: { ok: true, w, h }(可完整解碼) 或 { ok: false }(無法解碼; 不 reject, 使呼叫端可分辨「資料不合」與「瀏覽器失敗」)
function decodeInPage(b64) {
    let img = new Image()
    img.src = 'data:image/png;base64,' + b64
    return img.decode().then(function() {
        return { ok: true, w: img.naturalWidth, h: img.naturalHeight }
    }, function() {
        return { ok: false }
    })
}


export default decodeInPage
