//合成之示範頁面(自足、不連網、無 CDN; 供測試與範例): 中性之「示範系統」, 視窗 1600×900
//  頁首(標題、使用者名稱、登出鈕)、頁首與內容之間夾一條分頁列、左側清單、工具列(輸入框、按鈕、漸層底之圖示鈕、字型圖示 <i class="mdi">)、
//  不足 4 像素之分隔線、canvas 圖區、說明區; 另有供 fit 與 box 對照之空白容器


let css = `
html, body { margin: 0; padding: 0; background: #f4f6f9; font-family: Arial, sans-serif; }
#hdr { position: absolute; left: 0; top: 0; width: 1600px; height: 64px; background: #2b4a6f; color: #fff; }
#hdr .title { position: absolute; left: 24px; top: 16px; font-size: 24px; }
#hdr .user { position: absolute; right: 120px; top: 22px; font-size: 16px; }
#hdr .logout { position: absolute; right: 24px; top: 16px; width: 80px; height: 32px; }
#tabs { position: absolute; left: 0; top: 72px; width: 1600px; height: 40px; }
#tabs .bar { position: absolute; left: 560px; top: 4px; width: 480px; height: 32px; display: flex; gap: 8px; }
#tabs .tab { flex: 1; text-align: center; line-height: 32px; background: #dde3ea; border-radius: 4px; font-size: 16px; }
#list { position: absolute; left: 16px; top: 128px; width: 284px; height: 756px; background: #fff; }
#list ul { margin: 12px 0 0 0; padding: 0 0 0 28px; font-size: 16px; line-height: 32px; }
#tool { position: absolute; left: 320px; top: 128px; width: 1264px; height: 60px; background: #fff; }
#tool input { position: absolute; left: 16px; top: 14px; width: 220px; height: 28px; }
#tool .q { position: absolute; left: 252px; top: 14px; width: 72px; height: 32px; }
#tool .ib { position: absolute; top: 14px; width: 32px; height: 32px; border-radius: 6px; background-image: linear-gradient(135deg, #6aa6ff, #2a5bd7); }
#tool i.mdi { position: absolute; top: 18px; width: 24px; height: 24px; display: inline-block; }
#tool .sep { position: absolute; left: 0; top: 58px; width: 1264px; height: 2px; background: #c8ced6; }
#chart { position: absolute; left: 320px; top: 204px; width: 780px; height: 680px; background: #fff; }
#info { position: absolute; left: 1116px; top: 204px; width: 468px; height: 680px; background: #fff; }
#info p { margin: 16px 20px; font-size: 16px; line-height: 26px; }
#blank { position: absolute; left: 1116px; top: 128px; width: 10px; height: 10px; }
`

let body = `
<div id="hdr"><span class="title">示範系統</span><span class="user">使用者甲</span><button class="logout">登出</button></div>
<div id="tabs"><div class="bar"><div class="tab">總覽</div><div class="tab">清單</div><div class="tab">設定</div></div></div>
<div id="list"><ul>${['第一項', '第二項', '第三項', '第四項', '第五項', '第六項'].map((s) => `<li>${s}</li>`).join('')}</ul></div>
<div id="tool">
  <input type="text" value="">
  <button class="q">查詢</button>
  <div class="ib" style="left:360px"></div><div class="ib" style="left:404px"></div>
  <i class="mdi" style="left:460px;border:2px solid #888;box-sizing:border-box"></i>
  <div class="sep"></div>
</div>
<canvas id="chart" width="780" height="680"></canvas>
<div id="info"><p>說明區之第一段文字。</p><p>說明區之第二段文字, 用於量框之測試。</p><svg id="ico" style="position:absolute;left:380px;top:600px" width="40" height="40"><circle cx="20" cy="20" r="16" fill="#2a5bd7"/></svg></div>
<div id="blank"></div>
<script>
(function () {
  var c = document.getElementById('chart').getContext('2d');
  c.fillStyle = '#ffffff'; c.fillRect(0, 0, 780, 680);
  c.strokeStyle = '#2a5bd7'; c.lineWidth = 3; c.beginPath();
  for (var i = 0; i <= 20; i++) { var x = 40 + i * 35; var y = 340 + Math.round(Math.sin(i / 3) * 200); if (i === 0) { c.moveTo(x, y) } else { c.lineTo(x, y) } }
  c.stroke();
})();
</script>
`

let demoHtml = () => `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body>${body}</body></html>`


//以 rAF 持續動畫之頁面(方塊每影格右移 4 像素; window.__frames 為已動之影格數); 動到 nFrames 個影格或 window.__stop 為 true 時停止;
//  nFrames 為 Infinity 時只由 window.__stop 停止(測試於觀察到事件後才設, 停止之時點由事件決定而非時間)
let animHtml = (nFrames) => `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:#fff}#m{position:absolute;left:0;top:100px;width:40px;height:40px;background:#c00}</style></head><body><div id="m"></div><script>
window.__frames = 0;
window.__stop = false;
var N = ${Number.isFinite(nFrames) ? nFrames : 'Infinity'};
function tick() { if (window.__stop || window.__frames >= N) { return } window.__frames++; document.getElementById('m').style.left = (window.__frames * 4 % 1500) + 'px'; requestAnimationFrame(tick) }
requestAnimationFrame(tick);
</script></body></html>`


//示範頁之功能區(標籤皆為通用詞)
let demoRegions = () => [
    { label: '系統標題', find: { sel: '#hdr .title' } },
    { label: '使用者與登出', find: { union: [{ sel: '#hdr .user' }, { sel: '#hdr .logout', mode: 'box' }] } },
    { label: '分頁列', find: { sel: '#tabs .bar' } },
    { label: '清單', find: { sel: '#list' } },
    { label: '查詢列', find: { sel: '#tool' } },
    { label: '圖區', find: { sel: '#chart', mode: 'box' } },
    { label: '說明區', find: { sel: '#info' } },
]


export { demoHtml, animHtml, demoRegions }
