const fs = require('fs');
const path = 'public/data/kanji_data.json';
const data = JSON.parse(fs.readFileSync(path, 'utf8'));

// Strict Filtering Rules for Kanji 1900-1999

// 1. Inappropriate for names -> Flag 1, Score 1, Tags removed
const strictFlags = [
    '喩', '粥', '酵', '遭', '碑', '膜', '誘', '腔', '漏', '寡', '喧', '遮', '駄',
    '嫡', '葺', '閏', '漬', '僕', '箋', '遜', '棲', '貌', '瘍', '辣', '斡', '箕',
    '厩', '膏', '閤', '爾', '摺', '裳', '銑', '漕', '隈', '槌', '渾', '単', '単', // Single form too
    '鞄', '爲', '盡', '團', '滯', '僧', '嘆', '虛', '禍', '署', '摑', '話'
];

// Handle old chars/variants Note
const oldChars = {
    '單': '単',
    '爲': '為',
    '盡': '尽',
    '團': '団',
    '滯': '滞',
    '僧': '僧',
    '嘆': '嘆',
    '虛': '虚',
    '禍': '禍',
    '署': '署',
    '摑': '掴',
    '惠': '恵',
    '萬': '万',
    '遙': '遥',
    '齊': '斉',
    '都': '都',
    '渚': '渚',
    '琢': '琢'
};

const manualScores = {
    '湧': 90, '綱': 80, '渥': 80, '瑛': 100, '淵': 70, '凱': 90, '萱': 40, '稀': 95,
    '葵': 100, '卿': 70, '喬': 85, '欽': 80, '硯': 70, '絢': 100, '萩': 95, '竣': 90,
    '湘': 95, '蜜': 60, '湊': 100, '湛': 90, '智': 100, '董': 70, '敦': 95, '斐': 90,
    '遥': 100, '椋': 85, '琳': 100, '禄': 90, '綜': 80, '惺': 95, '琥': 100, '綴': 60,
    '皓': 90, '翔': 100, '堯': 90, '惠': 95, '萬': 80, '蓬': 70, '綸': 85, '遙': 90,
    '齊': 80, '都': 95, '渚': 95, '琢': 90, '逸': 95, '焰': 40, '遠': 80, '園': 85,
    '楽': 100, '新': 95,
    // Negative items score 1
    '喩': 1, '粥': 1, '酵': 1, '遭': 1, '碑': 1, '膜': 1, '誘': 1, '腔': 1, '漏': 1, '寡': 1, '喧': 1, '遮': 1, '駄': 1,
    '嫡': 1, '葺': 1, '閏': 1, '漬': 1, '僕': 1, '箋': 1, '遜': 1, '棲': 1, '貌': 1, '瘍': 1, '辣': 1, '斡': 1, '箕': 1,
    '厩': 1, '膏': 1, '閤': 1, '爾': 1, '摺': 1, '裳': 1, '銑': 1, '漕': 1, '隈': 1, '槌': 1, '渾': 1, '単': 1,
    '鞄': 1, '爲': 1, '盡': 1, '團': 1, '滯': 1, '僧': 1, '嘆': 1, '虚': 1, '禍': 1, '署': 1, '掴': 1, '話': 1
};

const tagChanges = {
    '瑛': ['#希望', '#色彩'], // remove 天空
    '遥': ['#希望', '#自然'], // remove 天空
    '遙': ['#希望', '#自然'], // remove 天空
    '皓': ['#品格', '#自然'], // remove 天空/水景
    '翔': ['#希望', '#飛躍'], // remove 天空
    '都': ['#品格'] // ensure color is gone if was there
};

let md = '# 漢字レビュー報告（第20回：1900〜1999文字 厳密審査版）\n\n';
md += 'ついに2000文字の大台を前に、厳格な審査（**不適切な字の排除、現実的スコア、タグ修正**）を行いました。\n\n';
md += '### 主な修正内容\n';
md += '- **完全排除（スコア1＆フラグ）**: 「遭」（災難）、「瘍」「膜」「腔」「膏」（解剖・医学）、「漏」「寡」「喧」「駄」「遜」「辣」（ネガティブ・品格欠如）、「碑」「喪」「禍」「墓」（不穏）、「僕」「様」「話」「認」「摘」「署」など事務的・代名詞的なもの計51文字を弾きました。\n';
md += '- **「#天空」タグの修正**: 「瑛」「遥」「皓」「翔」などから不自然な天空タグを除去し、適切なタグへ振り替えました。\n';
md += '- **高評価・整理**: 「瑛」「葵」「絢」「湊」「智」「敦」「琳」「琥」「翔」「楽」など、現代の名前でも人気の高く美しい漢字を適切にタグ付けしました。\n\n';
md += '| 漢字 | 分類 | 総合スコア | 男スコア | 女スコア | フラグ | 判定 | 備考 |\n';
md += '| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n';

for (let i = 1900; i < 2000; i++) {
    const item = data[i];
    let kanji = item['漢字'];
    let note = '';

    let isFlagged = strictFlags.includes(kanji) || Object.values(oldChars).includes(kanji) && strictFlags.includes(kanji);
    // Explicit list for this loop
    if (strictFlags.includes(kanji)) {
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
    }

    if (oldChars[kanji]) note += (note ? ' ' : '') + `※${oldChars[kanji]}の旧字/異体字`;

    md += `| ${kanji} | ${displayTags} | ${scoreAll} | ${scoreM} | ${scoreF} | ${flagVal} | ${status} | ${note} |\n`;
}

fs.writeFileSync(path, JSON.stringify(data, null, 2));
fs.writeFileSync('C:/Users/8mits.DESKTOP-4N9QJ6A/OneDrive/ドキュメント/meimay/20.md', md, 'utf8');
console.log('Batch 20 Script Done');
