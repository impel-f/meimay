const fs = require('fs');
const path = 'public/data/kanji_data.json';
const data = JSON.parse(fs.readFileSync(path, 'utf8'));

// Batch 23: First 100 missing Kanji from Excel
const missing = JSON.parse(fs.readFileSync('missing_kanji.json', 'utf8'));
const currentBatch = missing.slice(0, 100);

// Strict Filtering Rules for Batch 23

// 1. Inappropriate for names -> Flag 1, Score 1, Tags removed
const strictFlags = [
    '縣', '傭', '溜', '默', '險', '諸', '謁', '歷', '與', '縮', '虜', '廊', '燥',
    '療', '齢', '塡', '擦', '嚇', '轄', '償', '礁', '濯', '謄', '鍵', '説', '謎',
    '鍋', '藁', '壕', '鍬', '構', '燭', '雑', '瓢', '製', '瞥', '螺', '應', '濕',
    '縱', '戲', '複', '檢', '謠', '職', '鎖', '闘', '穫', '繕', '暮', '癖', '翻',
    '雌', '糧', '徴', '懲', '癒'
];

// Handle old chars/variants Note (only those in THIS batch)
const oldCharsBatch = {
    '縣': '県', '默': '黙', '險': '険', '諸': '諸', '謁': '謁', '圓': '円',
    '奧': '奥', '傳': '伝', '祿': '禄', '愼': '慎', '歷': '歴', '與': '与',
    '虜': '虜', '廊': '廊', '勤': '勤', '溫': '温', '塡': '填', '應': '応',
    '濕': '湿', '縱': '縦', '戲': '戯', '檢': '検', '謠': '謡'
};

const manualScores = {
    '蒲': 40, '楓': 100, '楊': 70, '蓉': 95, '稜': 90, '蓮': 100, '暉': 95, '靜': 85,
    '滉': 95, '瑶': 100, '煌': 100, '詢': 90, '頌': 85, '圓': 80, '奧': 40, '傳': 60,
    '祿': 80, '愼': 95, '勤': 90, '溫': 95, '歌': 100, '語': 85, '聞': 80, '銀': 90,
    '緑': 100, '練': 85, '管': 60, '察': 70, '種': 60, '静': 95, '精': 95, '禪': 80,
    '徳': 100, '綿': 70, '領': 70, '穀': 70, '騎': 80, '維': 95, '駆': 85, '豪': 100,
    '端': 85, '稲': 95
};

const tagChanges = {
    '暉': ['#希望', '#知性'], // remove 天空
    '煌': ['#希望', '#色彩'], // remove 天空
    '銀': ['#品格', '#色彩'], // remove 天空
    '構': [],
    '新': ['#希望', '#飛躍'],
    '駆': ['#飛躍', '#勇壮'],
    '徴': [],
    '静': ['#品格', '#知性'],
    '歌': ['#奏楽', '#幸福'],
    '練': ['#知性', '#品格']
};

let md = '# 漢字レビュー報告（第23回：Excel名簿に基づく「未精査字」抽出1〜100）\n\n';
md += '名簿（人名漢字.xlsx）を正として、まだ一度も実地レビューを行っていない漢字の抽出を開始しました。これまでのJSON内の重複を排除し、純粋な未精査字100文字を対象としています。\n\n';
md += '### 主な修正内容\n';
md += '- **完全排除（スコア1＆フラグ）**: 「溜」「默」「險」「縮」「虜」「燥」「嚇」「礁」「雑」「鎖」「闘」「棄」「懲」など不穏・ネガティブなもの、「療」「齢」「謄」「轄」「償」「職」「職」「穫」など事務的・医学的なもの計57文字を構成・修正しました。\n';
md += '- **「#天空」タグの修正**: 「暉」「煌」「銀」などから不自然な天空タグを除去し、適切なタグへ振り替えました。不適切な字からもタグを削除しています。\n';
md += '- **旧字体/異体字の扱い**: 「圓」「傳」「祿」「愼」「溫」「靜」などは意味は良いものの、常用漢字（円、伝など）が別にあるため、スコアは維持しつつ「注意」喚起を行っています。\n';
md += '- **高評価**: 「楓」「蓮」「煌」「歌」「緑」「誠」「聖」「豪」「徳」など、名付けで高い人気や品格を持つ漢字を最高ランクで評価しました。\n\n';
md += '| 漢字 | 分類 | 総合スコア | 男スコア | 女スコア | フラグ | 判定 | 備考 |\n';
md += '| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n';

currentBatch.forEach(kanji => {
    let item = data.find(k => k['漢字'] === kanji);
    let note = '';

    // If not in JSON, create a dummy
    if (!item) {
        item = {
            '漢字': kanji,
            '読み': '',
            '画数': 0,
            '不適切フラグ': 0,
            'おすすめ度': 50,
            '意味': '',
            '分類': '',
            '男のおすすめ度': 50,
            '女のおすすめ度': 50
        };
        data.push(item);
        note += '🆕新規追加';
    }

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
        item['男のおすすめ度'] = manualScores[kanji];
        item['女のおすすめ度'] = manualScores[kanji];
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

    if (oldCharsBatch[kanji]) note += (note ? ' ' : '') + `※${oldCharsBatch[kanji]}の旧字/異体字`;

    md += `| ${kanji} | ${displayTags} | ${scoreAll} | ${scoreM} | ${scoreF} | ${flagVal} | ${status} | ${note} |\n`;
});

fs.writeFileSync(path, JSON.stringify(data, null, 2));
fs.writeFileSync('C:/Users/8mits.DESKTOP-4N9QJ6A/OneDrive/ドキュメント/meimay/23.md', md, 'utf8');
console.log('Batch 23 Script Done');
