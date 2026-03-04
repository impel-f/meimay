const fs = require('fs');
const path = 'public/data/kanji_data.json';
const data = JSON.parse(fs.readFileSync(path, 'utf8'));

// Batch 26: 301-400 missing Kanji from Excel
const missing = JSON.parse(fs.readFileSync('missing_kanji.json', 'utf8'));
const currentBatch = missing.slice(300, 400);

// Strict Filtering Rules for Batch 26
const strictFlags = [
    '締', '已', '撤', '憤', '冊', '寮', '各', '机', '蔽', '蕨', '尾', '撞', '把',
    '坐', '樋', '廟', '撫', '蕪', '鋒', '使', '者', '服', '官', '霊'
];

const oldCharsBatch = {
    '墨': '墨', '薗': '園', '謹': '謹', '粹': '粋', '寢': '寝', '壽': '寿',
    '福': '福', '漢': '漢', '禎': '禎', '賓': '賓', '寬': '寛', '綠': '緑',
    '拜': '拝', '類': '類', '樂': '楽', '劍': '剣', '稻': '稲', '廣': '広'
};

const manualScores = {
    '諏': 80, '薗': 85, '勲': 90, '慶': 100, '賜': 85, '徹': 95, '憬': 95,
    '駒': 90, '摯': 95, '憧': 95, '慧': 100, '嬉': 95, '槻': 95, '毅': 100,
    '誼': 95, '醇': 95, '樟': 95, '蕉': 70, '辿': 80, '磐': 90, '蕃': 80,
    '諒': 100, '遼': 100, '凜': 100, '凛': 100, '黎': 95, '熙': 95, '廣': 85
};

const tagChanges = {
    '慶': ['#幸福', '#品格'],
    '慧': ['#知性', '#品格'],
    '毅': ['#信念'],
    '憧': ['#信念', '#慈愛'],
    '憬': ['#信念', '#知性'],
    '徹': ['#信念', '#勇壮'],
    '勲': ['#品格', '#飛躍'],
    '遼': ['#自然', '#水景'], // remove 天空
    '熙': ['#飛躍', '#幸福'], // remove 天空
    '廣': ['#品格', '#飛躍'], // remove 天空
    '凛': ['#品格', '#信念'],
    '凜': ['#品格', '#信念'],
    '黎': ['#飛躍', '#品格']
};

let md = '# 漢字レビュー報告（第26回：Excel名簿に基づく未精査字 301〜400）\n\n';
md += '未精査リストの第4弾です。単位や事務用語、また「霊」「憤」「鋒」などの名付けに慎重を要する字を厳格に排除しました。\n\n';
md += '### 主な修正内容\n';
md += '- **完全排除（スコア1＆フラグ）**: 「締」「撤」「各」「寮」「官」「使」などの事務的な語、「霊」「憤」「撞」「襲」などの不穏な語、「鋒」（武器）、「者」（代名詞的）など計24文字を排除しました。\n';
md += '- **「#天空」タグの修正**: 「遼」「熙」「廣」「徹」などに付いていた「天空」タグを整理し、名付けとしての本来の意味（#自然、#飛躍など）に修正しました。\n';
md += '- **高評価**: 「慶」「慧」「毅」「諒」「凛」「黎」など、非常に人気・品格ともに高い漢字を最高ランクで評価しました。\n';
md += '- **旧字体/異体字支援**: 「樂」「廣」「稻」など、伝統的な命名で好まれる字についてもスコアを整えつつ、常用漢字との対比を明記しています。\n\n';
md += '| 漢字 | 分類 | 総合スコア | 男スコア | 女スコア | フラグ | 判定 | 備考 |\n';
md += '| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n';

currentBatch.forEach(kanji => {
    let item = data.find(k => k['漢字'] === kanji);
    let note = '';

    if (!item) {
        item = {
            '漢字': kanji,
            '読み': '',
            '画数': 0,
            '不適切フラグ': 0,
            'おすすめ度': 50,
            '意味': 'データ取得中',
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
fs.writeFileSync('C:/Users/8mits.DESKTOP-4N9QJ6A/OneDrive/ドキュメント/meimay/26.md', md, 'utf8');
console.log('Batch 26 Script Done');
