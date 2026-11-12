import rollupFiles from 'w-package-tools/src/rollupFiles.mjs'


let fdSrc = './src'
let fdTar = './dist'

rollupFiles({ //rollupFiles預設會clean folder
    fns: 'WGuidechart.mjs',
    fdSrc,
    fdTar,
    nameDistType: 'kebabCase',
    runin: 'nodejs',
    globals: {
        'fs': 'fs',
        'path': 'path',
    },
    external: [ //Node 內建模組; 瀏覽器由使用端注入, 執行期不依 playwright
        'fs',
        'path',
    ],
})
