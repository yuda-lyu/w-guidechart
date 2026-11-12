import maskDiagErr from 'wsemi/src/maskDiagErr.mjs'
import getDiagSecrets from 'wsemi/src/getDiagSecrets.mjs'


//本套件不持有憑證, 秘密來源為空: maskDiagErr 只依其內建樣式遮網址內之帳密等憑證(dspec〈診斷輸出與遮罩〉D3)
let secrets = getDiagSecrets({})


//建立對外之錯誤(R-GC-ERR-01): message 為固定英文詞彙且只帶路徑索引, 不回顯輸入值; code 為固定字串;
//  cause 為使用端回呼或瀏覽器拋出之外來值, 先經 maskDiagErr 再掛上
function mkErr(code, msg, cause) {
    let e = new Error(msg)
    e.code = code
    if (cause !== undefined) {
        e.cause = maskDiagErr(cause, secrets)
    }
    return e
}


export default mkErr
