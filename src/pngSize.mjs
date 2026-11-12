//讀 png 之寬高(IHDR); 非 png 回 null
function pngSize(buf) {
    let sig = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]
    if (!buf || buf.length < 24 || sig.some((v, k) => buf[k] !== v) || buf.toString('latin1', 12, 16) !== 'IHDR') {
        return null
    }
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) }
}


export default pngSize
