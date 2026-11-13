import wpw from 'w-playwright'


//測試啟動瀏覽器之唯一啟動點: 一律經 w-playwright(headless shell; 帳本 R-GC-PW-01、R-PW-ONLY、R-PW-WIRING)
//  本套件之測試只啟動 headless shell(無頭、不指定 channel), 不啟動真 Chrome、Edge、完整 Chromium; 其餘測試檔不得自行啟動瀏覽器, 一律經此函數
function launchTestBrowser() {
    return wpw.launchChromium()
}


//啟動瀏覽器之注入函數: 真啟動(接縫不用替身), 外包一層只計啟動與關閉之次數
function makeLauncher() {
    let st = { launched: 0, closed: 0 }
    let launchBrowser = async () => {
        st.launched++
        let b = await launchTestBrowser()
        let close0 = b.close.bind(b)
        b.close = async () => {
            st.closed++
            return close0()
        }
        return b
    }
    return { st, launchBrowser }
}


//觀察回調之紀錄器(事件依序收集; 測試以 await 被測入口之完成為同步點, 不以延時)
function makeRecorder() {
    let evs = []
    let onTrace = (e) => {
        evs.push(e)
    }
    return { evs, onTrace }
}


export { launchTestBrowser, makeLauncher, makeRecorder }
