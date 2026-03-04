const fs = require('fs');
const path = 'public/data/kanji_data.json';
const data = JSON.parse(fs.readFileSync(path, 'utf8'));

// Batch 27: 401-500 missing Kanji from Excel
const missing = JSON.parse(fs.readFileSync('missing_kanji.json', 'utf8'));
const currentBatch = missing.slice(400, 500);

// Strict Filtering Rules for Batch 27
const strictFlags = [
    '憎', '徵', '頭', '録', '築', '激', '奮', '玩', '憶', '股', '獣', '曇',
    '負', '面', '凝', '軍', '錯', '壇', '独', '謀', '憾', '錮', '冒', '諦',
    '胞', '厘'
];

const oldCharsBatch = {
    '憎': '憎', '穀': '穀', '節': '節', '練': '練', '德': '徳', '緖': '緒',
    '徵': '徴', '緣': '縁'
};

const manualScores = {
    '妻': 40, '沿': 50, '呼': 40, '担': 10, '依': 80, '德': 100, '緖': 100,
    '緣': 80, '親': 85, '橋': 80, '整': 85, '肯': 60, '機': 80, '積': 80,
    '衛': 100, '興': 100, '憲': 100, '鋼': 90, '樹': 100, '操': 90, '附': 50,
    '繁': 95, '待': 60, '穏': 100, '賢': 100, '約': 60, '要': 70, '篤': 100,
    '擁': 90, '錬': 90, '懐': 100, '還': 80, '薫': 100, '衡': 90, '儒': 90,
    '壌': 90, '磨': 95, '諭': 95, '諧': 85, '錦': 100, '叡': 100, '燕': 90,
    '橘': 100
};

const tagChanges = {
    '德': ['#信念', '#品格'],
    '樹': ['#自然', '#品格'], // remove 天空
    '叡': ['#知性', '#品格'], // remove 天空
    '繁': ['#自然', '#飛躍'],
    '穏': ['#慈愛', '#調和'],
    '賢': ['#知性', '#品格'],
    '篤': ['#信念', '#慈愛'],
    '懐': ['#慈愛', '#品格'],
    '薫': ['#色彩', '#自然'],
    '錦': ['#色彩', '#品格'],
    '衡': ['#品格'], // remove 天空
    '築': [], // flag
    '操': ['#信念', '#品格'], // remove 天空
    '徴': [], // flag
    '誕': ['#飛躍', '#幸福'], // remove 天空
    '影': ['#色彩'], // remove 天空
    '錬': ['#知性', '#勇壮']
};

let md = '# 漢字レビュー報告（第27回：Excel名簿に基づく未精査字 401〜500）\n\n';
md += '未精査リストの第5弾です。日常動作、事務的な語、旧字体、そして「激」「奮」「獄」など強すぎる、あるいは不穏な字を厳格に選別しました。\n\n';
md += '### 主な修正内容\n';
md += '- **完全排除（スコア1＆フラグ）**: 「頭」（解剖学・事務的）、「激」「奮」（強すぎる）、「獣」「謀」「憾」「錮」「諦」など不穏・ネガティブな語、「築」「録」「徴」「厘」など事務的・単位に関わるもの、計26文字を排除しました。\n';
md += '- **「#天空」タグの修正**: 「樹」「叡」「操」「衡」など、名付けの実態に合わないタグを本来のイメージ（#自然、#知性、#品格など）へ修正しました。\n';
md += '- **高評価・精査**: 「徳（德）」「樹」「賢」「篤」「懐」「薫」「錦」「叡」「橘」など、名付けで不動の人気と品格を持つ漢字を最高ランクで評価しました。\n';
md += '- **旧字体/異体字支援**: 「德」「緖」「緣」など、氏名で好んで使われる伝統的な字体について適切にスコアを設定しました。\n\n';
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
fs.writeFileSync('C:/Users/8mits.DESKTOP-4N9QJ6A/OneDrive/ドキュメント/meimay/27.md', md, 'utf8');
console.log('Batch 27 Script Done');
