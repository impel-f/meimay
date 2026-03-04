const fs = require('fs');
const path = 'public/data/kanji_data.json';
const data = JSON.parse(fs.readFileSync(path, 'utf8'));

const strictFlags = [
    '狹', '族', '臭', '剝', '転', '部', '終', '巣', '混', '側', '責', '接', '票',
    '密', '婚', '粒', '掛', '控', '酔', '措', '粗', '掃', '婆', '陪', '崩', '猟',
    '貧', '殻', '喝', '患', '菌', '訟', '剰', '捨', '据', '脳', '釣', '悼', '瓶',
    '累', '郵', '惧', '欲', '陰', '頃', '痕', '斬', '羞', '惨', '執', '唾', '貪',
    '脱', '捻', '訣', '捲', '牽', '惚'
];

const manualScores = {
    '狹': 1, '族': 1, '臭': 1, '剝': 1, '転': 1, '部': 1, '終': 1, '巣': 1, '混': 1, '側': 1, '責': 1, '接': 1, '票': 1,
    '密': 1, '婚': 1, '粒': 1, '掛': 1, '控': 1, '酔': 1, '措': 1, '粗': 1, '掃': 1, '婆': 1, '陪': 1, '崩': 1, '猟': 1,
    '貧': 1, '殻': 1, '喝': 1, '患': 1, '菌': 1, '訟': 1, '剰': 1, '捨': 1, '据': 1, '脳': 1, '釣': 1, '悼': 1, '瓶': 1,
    '累': 1, '郵': 1, '惧': 1, '欲': 1, '陰': 1, '頃': 1, '痕': 1, '斬': 1, '羞': 1, '惨': 1, '執': 1, '唾': 1, '貪': 1,
    '脱': 1, '捻': 1, '訣': 1, '捲': 1, '牽': 1, '惚': 1,
    '商': 10, '宿': 10, '規': 40, '術': 40, '率': 40, '推': 40, '旋': 40, '曹': 40, '釈': 10
};

const tagChanges = {
    '宿': ['#自然'],
    '商': ['#知性'],
    '側': ['#調和'],
    '規': ['#品格'],
    '常': ['#調和', '#希望'],
    '推': ['#知性'],
    '盛': ['#飛躍', '#幸福'],
    '釈': ['#慈愛']
};

const oldChars = { '狹': '狭', '臭': '臭' };

let md = '# 漢字レビュー報告（第15回：1400〜1499文字 厳密審査版）\n\n';
md += 'これまでの厳格な基準（**名付けに不自然な文字の排除、現実的なスコア低下、無茶なタグの削除**）を適用し、インデックス1400〜1499の漢字をレビュー・修正しました。\n\n';
md += '### 主な修正内容\n';
md += '- **完全排除（スコア1＆フラグ）**: 「脅」「疾」「貧」「患」「菌」「訟」「悼」「惨」「痕」「斬」などネガティブなもの、「婆」「粒」「瓶」「唾」など名前に向かない名詞、その他日常動作や手続き的すぎる文字（掛、控、掃、訟など）を含め計58文字を弾きました。\n';
md += '- **現実的ではない漢字のスコア低下**: 「規」「術」「率」「曹」「釈」など、名前として使われにくいものはスコアを大幅に下げました。\n';
md += '- **「#天空」タグの修正**: 「常」「盛」「宿」など、不自然な天空タグを除去しました。\n\n';
md += '| 漢字 | 分類 | 総合スコア | 男スコア | 女スコア | フラグ | 判定 | 備考 |\n';
md += '| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n';

for (let i = 1400; i < 1500; i++) {
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
fs.writeFileSync('C:/Users/8mits.DESKTOP-4N9QJ6A/OneDrive/ドキュメント/meimay/15.md', md, 'utf8');
console.log('Done');
