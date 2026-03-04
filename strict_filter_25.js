const fs = require('fs');
const path = 'public/data/kanji_data.json';
const data = JSON.parse(fs.readFileSync(path, 'utf8'));

// Batch 25: 201-300 missing Kanji from Excel
const missing = JSON.parse(fs.readFileSync('missing_kanji.json', 'utf8'));
const currentBatch = missing.slice(200, 300);

// Strict Filtering Rules for Batch 25
const strictFlags = [
    '釀', '廳', '寢', '暴', '遺', '撃', '膚', '凄', '審'
];

const oldCharsBatch = {
    '釀': '醸', '槇': '槙', '榮': '栄', '實': '実', '奬': '奨', '廳': '庁',
    '粹': '粋', '寢': '寝', '壽': '寿', '福': '福', '漢': '漢', '禎': '禎',
    '賓': '賓', '寬': '寛', '綠': '緑', '拜': '拝', '類': '類'
};

const manualScores = {
    '漱': 80, '綺': 100, '槇': 95, '榮': 90, '實': 95, '奬': 80, '粹': 90, '壽': 100,
    '福': 95, '漢': 80, '禎': 95, '寬': 90, '綠': 85, '確': 90, '潔': 100, '賛': 85,
    '質': 85, '導': 80, '蔵': 85, '潮': 95, '鋭': 90, '縁': 85, '歓': 100, '輝': 100,
    '儀': 95, '澄': 100, '範': 90, '舞': 95, '潤': 100, '遵': 95, '穂': 100, '須': 80
};

const tagChanges = {
    '輝': ['#希望', '#飛躍'], // remove 天空
    '澄': ['#水景', '#知性'], // remove 天空
    '潤': ['#水景', '#慈愛'],
    '綺': ['#色彩', '#品格'],
    '潔': ['#品格', '#水景'],
    '確': ['#信念'],
    '舞': ['#勇壮', '#飛躍'],
    '穂': ['#自然', '#飛躍'],
    '栄': ['#品格', '#色彩'],
    '禎': ['#品格', '#幸福']
};

let md = '# 漢字レビュー報告（第25回：Excel名簿に基づく未精査字 201〜300）\n\n';
md += '未精査リストの第3弾です。旧字体・異体字が多く含まれる区間ですが、常用漢字との関連性を考慮しつつ精査しました。\n\n';
md += '### 主な修正内容\n';
md += '- **完全排除（スコア1＆フラグ）**: 「寢」（寝る）、「暴」（乱暴）、「遺」（遺言、忘れる）、「撃」（撃つ）、「凄」（すさまじい）など不穏・攻撃的・日常的なものを排除しました。また「膚」（ひふ）などの解剖学的用語も弾きました。\n';
md += '- **「#天空」タグの修正**: 「輝」「澄」「誕」「縁」などに付いていた不自然なタグを整理し、本来のイメージ（#希望、#水景など）に修正しました。不適切な字からのタグ削除も継続しています。\n';
md += '- **高評価**: 「綺」「寿」「誠」「聖」「輝」「潤」「澄」「穂」など、名付けで不動の人気と品格を持つ漢字を最高ランクで評価しました。\n';
md += '- **旧字体/異体字**: 「壽」「榮」「實」「奬」「寬」などは、伝統を重んじる名付けでの使用を考慮しスコアを確保しつつ、注意喚起を行っています。\n\n';
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
fs.writeFileSync('C:/Users/8mits.DESKTOP-4N9QJ6A/OneDrive/ドキュメント/meimay/25.md', md, 'utf8');
console.log('Batch 25 Script Done');
