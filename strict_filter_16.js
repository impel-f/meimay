const fs = require('fs');
const path = 'public/data/kanji_data.json';
const data = JSON.parse(fs.readFileSync(path, 'utf8'));

// Strict Filtering Rules for Kanji 1500-1599

// 1. Unquestionably bad for names -> Flag 1, Score 1, Tags removed
const strictFlags = [
    '悉', '這', '雀', '逗', '虚', '偶', '釧', '桶', '萄', '惜', '菩', '掠', '淋',
    '逮', '圈', '従', '巣', '涙', '萊', '場', '買', '軽', '着', '街', '尉', '象',
    '隊', '絶', '揮', '装', '圏', '蛇', '煮', '畳', '塔', '鈍', '傍', '絡', '腕',
    '軟', '雇', '絞', '湿', '偏', '堀', '婿', '痘', '募', '淫', '揺', '裂', '梗',
    '隅', '硝', '粧', '詔', '戚', '診', '疎', '堆', '堕', '惰'
];

// Handle old chars Note
const oldChars = {
    '圈': '圏',
    '從': '従',
    '巢': '巣',
    '淚': '涙'
};

const extraOldFormFlags = ['圈', '従', '巣', '涙']; // already in strictFlags usually, but let's just make sure. Wait, the actual chars in 1500-1599 are 従, 巣, 涙. They are already in strictFlags list above.

const manualScores = {
    '悉': 1, '這': 1, '雀': 1, '逗': 1, '虚': 1, '偶': 1, '釧': 1, '桶': 1, '萄': 1, '惜': 1, '菩': 1, '掠': 1, '淋': 1,
    '逮': 1, '圈': 1, '従': 1, '巣': 1, '涙': 1, '萊': 1, '場': 1, '買': 1, '軽': 1, '着': 1, '街': 1, '尉': 1, '象': 1,
    '隊': 1, '絶': 1, '揮': 1, '装': 1, '圏': 1, '蛇': 1, '煮': 1, '畳': 1, '塔': 1, '鈍': 1, '傍': 1, '絡': 1, '腕': 1,
    '軟': 1, '雇': 1, '絞': 1, '湿': 1, '偏': 1, '堀': 1, '婿': 1, '痘': 1, '募': 1, '淫': 1, '揺': 1, '裂': 1, '梗': 1,
    '隅': 1, '硝': 1, '粧': 1, '詔': 1, '戚': 1, '診': 1, '疎': 1, '堆': 1, '堕': 1, '惰': 1,
    '梯': 10, '条': 40, '運': 40, '備': 40, '斎': 40, '粛': 40, '庶': 10, '普': 40, '眺': 10,
    '棋': 40, '唯': 40, '亀': 10, '閑': 40, '爽': 40
};

const tagChanges = {
    '虚': [], // removed entirely by flag
    '桂': ['#自然'],
    '宿': ['#自然'],
    '転': [],
    '側': [],
    '常': ['#調和', '#希望'],
    '捨': [],
    '推': ['#知性'],
    '盛': ['#飛躍', '#幸福'],
    '釈': ['#慈愛'],
    '脱': [],
    // newly found
    '爽': ['#調和', '#希望'], // removing #天空
    '眺': ['#自然'], // removing #天空
    '培': ['#自然'] // removing #天空
};

let md = '# 漢字レビュー報告（第16回：1500〜1599文字 厳密審査版）\n\n';
md += 'これまでの厳格な基準（**名付けに不自然な文字の排除、現実的なスコア低下、無茶なタグの削除**）を適用し、インデックス1500〜1599の漢字をレビュー・修正しました。\n\n';
md += '### 主な修正内容\n';
md += '- **完全排除（スコア1＆フラグ）**: 「虚」「掠」「淋」「逮」「絶」「鈍」「軟」「痘」「淫」「裂」「堕」「惰」などネガティブなもの、「這」「買」「着」「煮」「雇」「絞」「湿」「診」などの日常的な動詞・状態、「雀」「桶」「葡萄」「涙」「場」「街」「隊」「圏」「蛇」「畳」「塔」「腕」「婿」「堀」「硝」「粧」など名前に向かない名詞、極端なものを含め多数を弾きました。\n';
md += '- **現実的ではない漢字のスコア低下**: 「条」「運」「備」「斎」「粛」「棋」「唯」「閑」など、名前として一定の需要はありそうでも一般的ではないものはスコアを大幅に下げました。\n';
md += '- **「#天空」タグの修正**: 「爽」「眺」「培」などから不自然な天空タグを除去しました。\n\n';
md += '| 漢字 | 分類 | 総合スコア | 男スコア | 女スコア | フラグ | 判定 | 備考 |\n';
md += '| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n';

for (let i = 1500; i < 1600; i++) {
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
        if (item['おすすめ度'] !== manualScores[kanji]) {
            item['おすすめ度'] = manualScores[kanji];
            item['男のおすすめ度'] = manualScores[kanji];
            item['女のおすすめ度'] = manualScores[kanji];
            note += (note ? ' ' : '') + '📉スコア修正';
        }
    }

    if (isFlagged) {
        if (item['分類'] !== '') {
            item['分類'] = '';
            note += (note ? ' ' : '') + '🏷️タグ削除済';
        }
    } else if (tagChanges[kanji]) {
        if (item['分類'] !== tagChanges[kanji].join(' ')) {
            item['分類'] = tagChanges[kanji].join(' ');
            note += (note ? ' ' : '') + '🏷️タグ修正済';
        }
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

    if (oldChars[kanji]) note += (note ? ' ' : '') + `※${oldChars[kanji]}の異体字`;

    md += `| ${kanji} | ${displayTags} | ${scoreAll} | ${scoreM} | ${scoreF} | ${flagVal} | ${status} | ${note} |\n`;
}

fs.writeFileSync(path, JSON.stringify(data, null, 2));
fs.writeFileSync('C:/Users/8mits.DESKTOP-4N9QJ6A/OneDrive/ドキュメント/meimay/16.md', md, 'utf8');
console.log('Batch 16 Script Done');
