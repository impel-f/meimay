/**
 * scripts/fix-encoding.js
 * 文字化けした閉じタグを自動修正するスクリプト
 * 
 * 使い方: node scripts/fix-encoding.js
 */

const fs = require('fs');
const path = require('path');

const targetDirs = ['public'];
const extensions = ['.html', '.js'];

function fixFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    const matches = [...content.matchAll(/([\u0080-\uFFFF])(\/[a-zA-Z][a-zA-Z0-9]*>)/g)];

    if (matches.length === 0) return 0;

    content = content.replace(/([\u0080-\uFFFF])(\/[a-zA-Z][a-zA-Z0-9]*>)/g, (m, bad, tag) => '<' + tag);
    fs.writeFileSync(filePath, content, 'utf8');
    return matches.length;
}

function walkDir(dir) {
    const files = fs.readdirSync(dir);
    let total = 0;

    for (const f of files) {
        const fullPath = path.join(dir, f);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory() && !f.startsWith('.') && f !== 'node_modules') {
            total += walkDir(fullPath);
        } else if (extensions.includes(path.extname(f))) {
            const fixed = fixFile(fullPath);
            if (fixed > 0) {
                console.log(`✅ ${fullPath}: ${fixed}箇所を修正`);
                total += fixed;
            }
        }
    }
    return total;
}

console.log('🔧 文字化け修正スクリプト起動...');
const total = walkDir('public');
console.log(`\n完了: 合計 ${total}箇所 を修正しました`);
