/**
 * fix-all-mojibake.js
 * 全HTMLとJSファイルのShift-JIS→UTF-8二重エンコード（文字化け）を逆変換修復する
 * 確認済み: 「隱ｭ縺ｿ」→「読み」など正しく変換できる
 */
const fs = require('fs');
const path = require('path');
const iconv = require('iconv-lite');

function fixMojibakeChunk(chunk) {
    try {
        const bytes = iconv.encode(chunk, 'shift_jis');
        const decoded = iconv.decode(bytes, 'utf8');
        if (decoded.includes('\uFFFD')) return null;
        return decoded;
    } catch (e) {
        return null;
    }
}

function processFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');

    // 半角カタカナ(U+FF61-FF9F)と全角文字の混在塊を修正対象とする
    const MOJIBAKE_CHUNK = /(?:[\u7000-\uFFFF]|[\uFF61-\uFF9F]){3,}/g;

    let changed = false;
    const newContent = content.replace(MOJIBAKE_CHUNK, (match) => {
        // 半角カタカナが含まれていなければスキップ（通常の漢字連続）
        if (!/[\uFF61-\uFF9F]/.test(match)) return match;

        const fixed = fixMojibakeChunk(match);
        if (fixed && fixed !== match && !fixed.includes('\uFFFD')) {
            changed = true;
            return fixed;
        }
        return match;
    });

    if (changed) {
        fs.writeFileSync(filePath, newContent, 'utf8');
        return true;
    }
    return false;
}

let fixedCount = 0;
if (processFile('public/index.html')) { console.log('✅ index.html: fixed'); fixedCount++; }

const jsFiles = fs.readdirSync('public/js').filter(f => f.endsWith('.js'));
jsFiles.forEach(f => {
    if (processFile(path.join('public/js', f))) {
        console.log(`✅ ${f}: fixed`);
        fixedCount++;
    }
});

console.log(`\n完了: ${fixedCount}ファイルを修正`);
