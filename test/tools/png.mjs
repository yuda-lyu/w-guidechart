import fs from 'fs'


//讀 png 檔之寬高(IHDR)
function pngSizeOf(fp) {
    let b = fs.readFileSync(fp)
    if (b.toString('latin1', 1, 4) !== 'PNG' || b.toString('latin1', 12, 16) !== 'IHDR') {
        return null
    }
    return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) }
}


export { pngSizeOf }
