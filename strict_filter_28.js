const fs = require('fs');
const path = 'public/data/kanji_data.json';
const data = JSON.parse(fs.readFileSync(path, 'utf8'));

const missing = JSON.parse(fs.readFileSync('missing_kanji.json', 'utf8'));
const currentBatch = missing.slice(500, 600);

// Only truly name-appropriate characters are given scores. 
const okScores = {
    '橙': { tags: ['#自然', '#色彩'], score: 90 },
    '澪': { tags: ['#水景'], score: 100 },
    '燎': { tags: ['#天空', '#色彩'], score: 85 },
    '蕾': { tags: ['#自然', '#色彩'], score: 95 },
    '燈': { tags: ['#天空'], score: 50 }, // Keep as variant of 灯
    '龍': { tags: ['#勇壮', '#伝統'], score: 100 },
    '曉': { tags: ['#知性', '#天空'], score: 100 },
    '勳': { tags: ['#飛躍', '#品格'], score: 90 },
    '衞': { tags: ['#勇壮', '#品格'], score: 100 },
    '賴': { tags: ['#勇壮', '#慈愛'], score: 85 },
    '曆': { tags: ['#天空', '#伝統'], score: 100 },
    '績': { tags: ['#信念', '#飛躍'], score: 85 },
    '厳': { tags: ['#品格', '#信念'], score: 90 },
    '優': { tags: ['#品格', '#慈愛'], score: 100 },
    '環': { tags: ['#調和', '#飛躍'], score: 95 },
    '鮮': { tags: ['#色彩', '#飛躍'], score: 90 },
    '翼': { tags: ['#天空', '#勇壮'], score: 100 },
    '鍛': { tags: ['#知性', '#勇壮'], score: 80 },
    '聴': { tags: ['#知性', '#調和'], score: 85 },
    '謹': { tags: ['#信念', '#品格'], score: 90 },
    '謙': { tags: ['#信念', '#品格'], score: 95 },
    '瞳': { tags: ['#慈愛', '#色彩'], score: 100 },
    '瞭': { tags: ['#知性'], score: 90 },
    '霞': { tags: ['#天空', '#自然'], score: 90 },
    '徽': { tags: ['#色彩', '#品格'], score: 80 },
    '磯': { tags: ['#水景'], score: 80 },
    '鴻': { tags: ['#飛躍', '#勇壮'], score: 90 },
    '燦': { tags: ['#天空', '#色彩'], score: 100 },
    '駿': { tags: ['#品格', '#飛躍'], score: 100 },
    '曙': { tags: ['#天空', '#飛躍'], score: 90 }
};

const oldCharsBatch = {
    '盃': '杯', '者': '者', '卽': '即', '燈': '灯', '曉': '暁', '勳': '勲',
    '戰': '戦', '燒': '焼', '衞': '衛', '橫': '横', '賴': '頼', '曆': '暦',
    '錄': '録', '祖': '祖'
};

let md = '# 漢字レビュー報告（第28回：厳格審査版 501〜600）\n\n';
md += '第27回やり直し基準に基づき、徹底した厳格選別を実施しました。\n\n';
md += '### 主な修正内容\n';
md += '- **完全排除（スコア1＆フラグ）の大幅適用**: 日常動作や事務的用語（「按」「輯」「校」「案」「郡」「候」「講」「謝」「購」「副」「設」）、不穏なもの・動物・人体名称（「憐」「醜」「闇」「寂」「豹」「息」「眼」「頰」）など、名前にふさわしくない70文字を容赦なく排除しました。\n';
md += '- **高評価・精査（30文字）**: 「龍」「優」「翼」「瞳」「燦」「駿」「澪」など、名付けで不動の人気と気品を持つ漢字のみを高評価で残しました。\n';
md += '- **無難・旧字体等**: 「曉」「勳」「衞」「賴」「曆」など、特定の年代・伝統において需要のある旧字体についても適正に分類しています。\n\n';
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
            '意味': 'データ',
            '分類': '',
            '男のおすすめ度': 50,
            '女のおすすめ度': 50
        };
        data.push(item);
        note += '🆕新規追加';
    }

    if (okScores[kanji]) {
        item['不適切フラグ'] = 0;
        item['おすすめ度'] = okScores[kanji].score;
        item['男のおすすめ度'] = okScores[kanji].score;
        item['女のおすすめ度'] = okScores[kanji].score;
        item['分類'] = okScores[kanji].tags.join(' ');
        note += '📈厳密評価';
    } else {
        item['不適切フラグ'] = 1;
        item['おすすめ度'] = 1;
        item['男のおすすめ度'] = 1;
        item['女のおすすめ度'] = 1;
        item['分類'] = '';
        note += '📉厳密排除 🏷️タグ削除済';
    }

    let displayTags = item['分類'] || '（なし）';
    let rawFlag = item['不適切フラグ'];
    let flagVal = (rawFlag === 1 || rawFlag === '1') ? 1 : 0;
    let scoreAll = item['おすすめ度'];
    let scoreM = item['男のおすすめ度'];
    let scoreF = item['女のおすすめ度'];
    let status = (flagVal === 1) ? '⚠️ 注意' : 'OK';

    if (flagVal === 1) {
        if (!note.includes('排除')) note += (note ? ' ' : '') + '不適切フラグあり';
    }
    if (oldCharsBatch[kanji]) note += (note ? ' ' : '') + ` ※${oldCharsBatch[kanji]}の旧字/異体字`;

    md += `| ${kanji} | ${displayTags} | ${scoreAll} | ${scoreM} | ${scoreF} | ${flagVal} | ${status} | ${note} |\n`;
});

fs.writeFileSync(path, JSON.stringify(data, null, 2));
fs.writeFileSync('C:/Users/8mits.DESKTOP-4N9QJ6A/OneDrive/ドキュメント/meimay/28.md', md, 'utf8');
console.log('Batch 28 Strict Script Done');
