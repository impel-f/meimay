const fs = require('fs');
const path = 'public/data/kanji_data.json';
const data = JSON.parse(fs.readFileSync(path, 'utf8'));

// Strict Filtering Rules for Kanji 1800-1899

// 1. Inappropriate for names -> Flag 1, Score 1, Tags removed
const strictFlags = [
    '項', '酪', '賄', '毀', '嗅', '僅', '嫉', '腫', '腎', '裾', '煎', '腺', '溺',
    '惑', '慄', '賂', '喚', '嘩', '塙', '跨', '蒐', '遁', '牒', '蛮', '詫', '楕',
    '碓', '廊', '渦', '煤', '款', '蒙', '碗', '碎', '搖', '傘', '循', '裝', '暑',
    '煮', '碑', '喪', '様', '歴', '銭', '廃', '増', '像', '磁', '障', '層', '椅',
    '認', '箇', '需', '摘', '髪', '罰', '網'
];

// Handle old chars/variants Note
const oldChars = {
    '碎': '砕',
    '搖': '揺',
    '裝': '装'
};

const manualScores = {
    '紫': 100, '殖': 40, '尋': 80, '渡': 90, '雄': 95, '詠': 95, '敢': 85, '硬': 40,
    '軸': 60, '晶': 100, '掌': 80, '遂': 80, '随': 80, '超': 90, '揚': 85, '湾': 85,
    '堪': 80, '暁': 100, '琴': 100, '滋': 95, '鳴': 85, '関': 85, '境': 80, '棟': 70,
    '総': 70, '適': 40, '愉': 95, '裕': 100, '塁': 80, '嵐': 90, '媛': 95,
    // Negative items score 1
    '項': 1, '酪': 1, '賄': 1, '毀': 1, '嗅': 1, '僅': 1, '嫉': 1, '腫': 1, '腎': 1, '裾': 1,
    '煎': 1, '腺': 1, '溺': 1, '惑': 1, '慄': 1, '賂': 1, '喚': 1, '嘩': 1, '塙': 1, '跨': 1,
    '蒐': 1, '遁': 1, '牒': 1, '蛮': 1, '詫': 1, '楕': 1, '碓': 1, '廊': 1, '渦': 1, '煤': 1,
    '款': 1, '蒙': 1, '碗': 1, '碎': 1, '搖': 1, '傘': 1, '循': 1, '裝': 1, '暑': 1, '煮': 1,
    '碑': 1, '喪': 1, '様': 1, '歴': 1, '銭': 1, '廃': 1, '増': 1, '像': 1, '磁': 1, '障': 1,
    '層': 1, '椅': 1, '認': 1, '箇': 1, '需': 1, '摘': 1, '髪': 1, '罰': 1, '網': 1
};

const tagChanges = {
    '項': [],
    '晶': ['#希望', '#知性'], // remove 天空
    '暁': ['#希望', '#知性'], // remove 天空
    '滋': ['#慈愛', '#自然'], // remove 天空
    '嵐': ['#自然', '#勇壮'], // remove 天空
    '箇': [],
    '雰囲': [] // not a single char, ignore
};

let md = '# 漢字レビュー報告（第19回：1800〜1899文字 厳密審査版）\n\n';
md += 'これまでの厳格な基準（**名付けに不自然な文字の排除、現実的なスコア低下、無茶なタグの削除**）を適用し、インデックス1800〜1899の漢字をレビュー・修正しました。\n\n';
md += '### 主な修正内容\n';
md += '- **完全排除（スコア1＆フラグ）**: 「毀」「嫉」「溺」「惑」「慄」「蛮」「蒙」「罰」など不穏なもの、「賄」「賂」「銭」など金銭に関わるもの、「腫」「腎」「腺」「髪」など解剖的・生理的なもの、「項」「僅」「蒐」「牒」「款」「循」「装」「歴」「箇」「網」など事務的・構造的な漢字計59文字を弾きました。\n';
md += '- **「#天空」タグの修正**: 「晶」「暁」「滋」「嵐」など不自然な天空タグを除去し、実態に近いタグ（#希望、#自然など）へ振り替えました。\n';
md += '- **美意識・情緒系のタグ精査**: 「紫」「詠」「琴」「裕」「媛」など、美しい意味や響きを持つ漢字を高く評価し、タグを整理しました。\n\n';
md += '| 漢字 | 分類 | 総合スコア | 男スコア | 女スコア | フラグ | 判定 | 備考 |\n';
md += '| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n';

for (let i = 1800; i < 1900; i++) {
    const item = data[i];
    let kanji = item['漢字'];
    let note = '';

    let isFlagged = strictFlags.includes(kanji);
    if (isFlagged) {
        if (item['不適切フラグ'] != 1) {
            item['不適切フラグ'] = 1;
            note += (note ? ' ' : '') + '🆕フラグ追加';
        }
    }

    if (isFlagged) {
        item['おすすめ度'] = 1;
        item['男のおすすめ度'] = 1;
        item['女のおすすめ度'] = 1;
        note += (note ? ' ' : '') + '📉スコア1化';
    } else if (manualScores[kanji] !== undefined) {
        item['おすすめ度'] = manualScores[kanji];
        if (item['男のおすすめ度'] <= 0) item['男のおすすめ度'] = manualScores[kanji];
        if (item['女のおすすめ度'] <= 0) item['女のおすすめ度'] = manualScores[kanji];
        note += (note ? ' ' : '') + '📈設定・調整';
    }

    if (isFlagged) {
        if (item['分類'] !== '') {
            item['分類'] = '';
            note += (note ? ' ' : '') + '🏷️タグ削除済';
        }
    } else if (tagChanges[kanji]) {
        item['分類'] = tagChanges[kanji].join(' ');
        note += (note ? ' ' : '') + '🏷️タグ修正済';
    }

    let displayTags = item['分類'] || '（なし）';
    let rawFlag = item['不適切フラグ'];
    let flagVal = (rawFlag === 1 || rawFlag === '1' || String(rawFlag).toUpperCase() === 'TRUE') ? 1 : 0;
    let scoreAll = item['おすすめ度'];
    let scoreM = item['男のおすすめ度'];
    let scoreF = item['女のおすすめ度'];
    let status = (flagVal === 1) ? '⚠️ 注意' : 'OK';

    if (flagVal === 1) {
        if (!note.includes('フラグ追加')) note += (note ? ' ' : '') + '不適切フラグあり';
    } else if (displayTags === '（なし）') {
        status = '検討';
        if (!note.includes('タグ修正済') && !note.includes('タグなし') && !note.includes('タグ削除済')) note += (note ? ' ' : '') + 'タグなし';
    }

    if (oldChars[kanji]) note += (note ? ' ' : '') + `※${oldChars[kanji]}の旧字/異体字`;

    md += `| ${kanji} | ${displayTags} | ${scoreAll} | ${scoreM} | ${scoreF} | ${flagVal} | ${status} | ${note} |\n`;
}

fs.writeFileSync(path, JSON.stringify(data, null, 2));
fs.writeFileSync('C:/Users/8mits.DESKTOP-4N9QJ6A/OneDrive/ドキュメント/meimay/19.md', md, 'utf8');
console.log('Batch 19 Script Done');
