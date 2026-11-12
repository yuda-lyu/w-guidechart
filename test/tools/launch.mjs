import { chromium } from 'playwright'


//啟動瀏覽器之注入函數: 真 chromium.launch()(接縫不用替身), 外包一層只計啟動與關閉之次數
function makeLauncher() {
    let st = { launched: 0, closed: 0 }
    let launchBrowser = async () => {
        st.launched++
        let b = await chromium.launch()
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


export { makeLauncher, makeRecorder }
