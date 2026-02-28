/**
 * safe-fix-mojibake.js
 * Shift-JIS→UTF-8 二重エンコードの安全な逆変換
 * 
 * ? (U+FFFD)や制御文字が出た場合はスキップする
 */
const fs = require('fs');
const path = require('path');
const iconv = require('iconv-lite');

// 文字化けパターン（縺・繧 などShift-JISの上位バイト+下位バイトが
// UTF-8で表現された場合に出るUnicode範囲）
// 典型的な文字化け文字: 縺(U+7E34) 繧(U+7E67) 繝(U+7E5D)など U+7D00-U+7FFF付近
const MOJIBAKE_RE = /[\u7D50-\u7FFF\u7A00-\u7D4F]{2,}/g;

let totalFixed = 0;

function tryFix(str) {
    try {
        const bytes = iconv.encode(str, 'shift_jis');
        // byteに変換出来なかった文字(0x3F='?')が含まれるかチェック
        if (bytes.includes(0x3F)) return null; // 変換失敗
        const decoded = iconv.decode(bytes, 'utf8');
        if (decoded.includes('\uFFFD')) return null; // 変換失敗
        // 変換後が妥当な日本語かチェック（ひらがな・カタカナ・漢字が含まれる）
        if (!/[\u3040-\u30FF\u4E00-\u9FFF\u3000-\u303F]/.test(decoded)) return null;
        return decoded;
    } catch (e) {
        return null;
    }
}

function processFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    let changed = false;

    const newContent = content.replace(MOJIBAKE_RE, (match) => {
        const fixed = tryFix(match);
        if (fixed && fixed !== match) {
            changed = true;
            return fixed;
        }
        return match;
    });

    if (changed) {
        // 構文チェック（JSファイルのみ）
        if (filePath.endsWith('.js')) {
            const { execSync } = require('child_process');
            fs.writeFileSync(filePath + '.tmp', newContent, 'utf8');
            try {
                execSync(`node --check ${filePath}.tmp`, { stdio: 'pipe' });
                fs.unlinkSync(filePath + '.tmp');
                fs.writeFileSync(filePath, newContent, 'utf8');
                console.log(`✅ ${path.basename(filePath)}: fixed`);
                totalFixed++;
            } catch (e) {
                fs.unlinkSync(filePath + '.tmp');
                console.log(`⚠️  ${path.basename(filePath)}: skipped (syntax error after fix)`);
            }
        } else {
            fs.writeFileSync(filePath, newContent, 'utf8');
            console.log(`✅ ${path.basename(filePath)}: fixed`);
            totalFixed++;
        }
    }
}

// 全ファイルを処理
const jsFiles = fs.readdirSync('public/js').filter(f => f.endsWith('.js'));
jsFiles.forEach(f => processFile(path.join('public/js', f)));
processFile('public/index.html');

console.log(`\n完了: ${totalFixed}ファイルを修正`);
