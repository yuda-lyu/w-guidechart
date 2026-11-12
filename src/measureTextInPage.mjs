//功能文字之字寬量測(內部模組; 於瀏覽器頁面內執行, 以 page.evaluate(measureTextInPage, inp) 呼叫)
//  規則 R-GC-PAGE-01: 本函式只能用參數與頁面全域, 不得引用模組層識別字; 本模組只放本函式之 export; 不用會被轉譯之語法(展開、??、?.、async)
//inp: { font, fs, labels }
//回傳 { widths, fontOk }
//  widths: 各標籤之字寬(canvas measureText 之寬取 ceil, 字型字串為 `${fs}px "${font}"`, 與原型相同)
//  fontOk: 字型是否存在(以「指定字型＋泛用字型」與「只用泛用字型」量同一字串, 三種泛用字型皆相同者視為不存在);
//    document.fonts.check 對系統字型恆回 true, 不能用於判斷
function measureTextInPage(inp) {
    let cv = document.createElement('canvas').getContext('2d')
    cv.font = inp.fs + 'px "' + inp.font + '"'
    let widths = []
    for (let i = 0; i < inp.labels.length; i++) {
        widths.push(Math.ceil(cv.measureText(inp.labels[i]).width))
    }
    let probe = 'mmmmmmmmmmlliWWQQ@#0123456789' + inp.labels.join('')
    let gens = ['monospace', 'serif', 'sans-serif']
    let fontOk = false
    for (let k = 0; k < gens.length; k++) {
        cv.font = inp.fs + 'px "' + inp.font + '", ' + gens[k]
        let a = cv.measureText(probe).width
        cv.font = inp.fs + 'px ' + gens[k]
        let b = cv.measureText(probe).width
        if (a !== b) {
            fontOk = true
        }
    }
    return { widths, fontOk }
}


export default measureTextInPage
