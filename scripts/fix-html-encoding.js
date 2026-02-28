// fix-html-encoding.js: index.html の全文字化けを安全に一括修正
// カタストロフィックバックトラックを避けるため正規表現を単純に保つ
const iconv = require('iconv-lite');
const fs = require('fs');

let content = fs.readFileSync('public/index.html', 'utf8');
const original = content;
let fixedCount = 0;

// 文字を1文字ずつ読み進めて、半角カナ(FF61-FF9F)が出たら
// それを含む連続する「非-ASCII-ASCII」チャンクを収集してiconv変換する
const chars = [...content]; // Unicode文字の配列
const result = [];
let i = 0;

while (i < chars.length) {
    const cp = chars[i].codePointAt(0);

    // 半角カナが見つかったらチャンクを収集
    if (cp >= 0xFF61 && cp <= 0xFF9F) {
        // このチャンクの開始点を探す（全角文字が続いている範囲を取得）
        let chunkStart = i;
        // 前に遡って全角文字がある限り含める
        while (chunkStart > 0) {
            const prevCp = chars[chunkStart - 1].codePointAt(0);
            if (prevCp > 0x2000) { chunkStart--; } // 全角文字なら前に
            else break;
        }
        // 後ろに進んで全角文字がある限り含める
        let chunkEnd = i;
        while (chunkEnd < chars.length - 1) {
            const nextCp = chars[chunkEnd + 1].codePointAt(0);
            if (nextCp > 0x2000) { chunkEnd++; }
            else break;
        }

        const chunk = chars.slice(chunkStart, chunkEnd + 1).join('');

        // iconv逆変換を試みる
        let fixed = chunk;
        try {
            const bytes = iconv.encode(chunk, 'shift_jis');
            const decoded = iconv.decode(bytes, 'utf8');
            if (!decoded.includes('\uFFFD') && decoded !== chunk) {
                fixed = decoded;
                fixedCount++;
            }
        } catch (e) { }

        // resultの末尾からchunkStart分削除してfixedを追加
        result.splice(result.length - (i - chunkStart), i - chunkStart);
        result.push(fixed);
        i = chunkEnd + 1;
    } else {
        result.push(chars[i]);
        i++;
    }
}

const newContent = result.join('');
fs.writeFileSync('public/index.html', newContent, 'utf8');

const remaining = [...newContent.matchAll(/[\uFF61-\uFF9F]/g)].length;
console.log('Fixed chunks:', fixedCount);
console.log('Remaining half-kana:', remaining);
console.log('Original size:', original.length, '→ New size:', newContent.length);
