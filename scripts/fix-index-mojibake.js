const iconv = require('iconv-lite');
const fs = require('fs');

let content = fs.readFileSync('public/index.html', 'utf8');

function tryFix(str) {
    if (!/[\uFF61-\uFF9F]/.test(str)) return str;
    try {
        const bytes = iconv.encode(str, 'shift_jis');
        const decoded = iconv.decode(bytes, 'utf8');
        if (!decoded.includes('\uFFFD') && decoded !== str) return decoded;
    } catch (e) { }
    return str;
}

// 半角カナ(FF61-FF9F)が含まれる連続文字列を全て逆変換
let totalFixed = 0;
const newContent = content.replace(/[\u3040-\uFFFF]+/g, (chunk) => {
    if (!/[\uFF61-\uFF9F]/.test(chunk)) return chunk;
    const fixed = tryFix(chunk);
    if (fixed !== chunk) {
        totalFixed++;
        return fixed;
    }
    return chunk;
});

fs.writeFileSync('public/index.html', newContent, 'utf8');
const remaining = [...newContent.matchAll(/[\uFF61-\uFF9F]/g)].length;
console.log('Fixed chunks:', totalFixed, '| Remaining half-kana chars:', remaining);
