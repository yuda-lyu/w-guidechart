//等頁面繪出 2 個影格(雙 rAF; 內部模組; 於瀏覽器頁面內執行, 以 page.evaluate(waitFramesInPage) 呼叫)
//  規則 R-GC-PAGE-01: 本函式只能用參數與頁面全域, 不得引用模組層識別字; 本模組只放本函式之 export; 不用會被轉譯之語法
function waitFramesInPage() {
    return new Promise(function(resolve) {
        requestAnimationFrame(function() {
            requestAnimationFrame(function() {
                resolve(true)
            })
        })
    })
}


export default waitFramesInPage
