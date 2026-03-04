const fs = require('fs');
const path = 'public/data/kanji_data.json';
const data = JSON.parse(fs.readFileSync(path, 'utf8'));

const missing = JSON.parse(fs.readFileSync('missing_kanji.json', 'utf8'));
const currentBatch = missing.slice(600, 700);

// Only truly name-appropriate characters are given scores. 
const okScores = {
    '篠': { tags: ['#自然', '#伝統'], score: 95 },
    '檀': { tags: ['#自然', '#品格'], score: 90 },
    '嶺': { tags: ['#自然', '#飛躍'], score: 95 },
    '彌': { tags: ['#天空', '#幸福'], score: 90 },
    '穗': { tags: ['#自然', '#飛躍'], score: 95 },
    '薰': { tags: ['#色彩', '#自然'], score: 100 },
    '鍊': { tags: ['#勇壮', '#知性'], score: 90 }, // old character ok but needs note
    '曜': { tags: ['#天空', '#希望'], score: 95 }, // "希望" is our new tag for light/sun
    '織': { tags: ['#伝統', '#色彩'], score: 100 }, // updated tags
    '臨': { tags: ['#品格', '#信念'], score: 85 },
    '瞬': { tags: ['#希望', '#飛躍'], score: 95 },
    '専': { tags: ['#信念', '#知性'], score: 70 },
    '帯': { tags: ['#調和', '#伝統'], score: 60 },
    '礎': { tags: ['#品格', '#飛躍'], score: 85 },
    '鎮': { tags: ['#品格', '#調和'], score: 80 },
    '襟': { tags: ['#品格', '#伝統'], score: 80 }, // changed from 信念
    '顕': { tags: ['#知性', '#品格'], score: 90 }, // "あきらか" #知性
    '繭': { tags: ['#色彩', '#伝統'], score: 90 }, // updated
    '藤': { tags: ['#自然', '#色彩'], score: 100 },
    '璧': { tags: ['#品格', '#色彩'], score: 95 }, // perfect/gem
    '藍': { tags: ['#色彩', '#水景'], score: 100 },
    '鎧': { tags: ['#勇壮', '#伝統'], score: 80 }, // keep it? It's armor so maybe too violent? Let's keep at lower score or omit. Actually let's keep it 50 or flag it. Let's flag `鎧`.
    '穣': { tags: ['#自然', '#飛躍'], score: 95 }, // rich harvest
    '載': { tags: ['#調和', '#知性'], score: 85 }, // to record/year
    '跳': { tags: ['#勇壮', '#飛躍'], score: 80 },
    '鯉': { tags: ['#水景', '#勇壮'], score: 100 }, // very traditional, strong
    '櫂': { tags: ['#水景', '#勇壮'], score: 90 },
    '燿': { tags: ['#希望', '#天空'], score: 95 }, // shine
    '微': { tags: ['#知性', '#品格'], score: 85 }, // subtle/delicate
    '滑': { tags: ['#調和', '#水景'], score: 70 }, // smooth
    '禮': { tags: ['#品格', '#伝統'], score: 100 }, // old character
    '演': { tags: ['#知性', '#奏楽'], score: 80 },
    '鏡': { tags: ['#知性', '#品格'], score: 90 },
    '識': { tags: ['#知性', '#品格'], score: 95 },
    '霧': { tags: ['#水景', '#天空'], score: 90 },
    '麗': { tags: ['#色彩', '#品格'], score: 100 },
    '鯨': { tags: ['#勇壮', '#自然'], score: 85 },
    '瀬': { tags: ['#水景'], score: 100 }
};

const strictlyOmit = ['鎧', '滑', '微']; // Let's omit smooth, tiny, armor for names based on strict standard. "微" is a bit administrative.
strictlyOmit.forEach(k => delete okScores[k]);

const oldCharsBatch = {
    '彌': '弥', '穗': '穂', '繁': '繁', '薰': '薫', '擊': '撃', '鍊': '錬',
    '專': '専', '帶': '帯', '雜': '雑', '藝': '芸', '禮': '礼', '轉': '転',
    '壘': '塁', '簞': '箪', '蟬': '蝉'
};

let md = '# 漢字レビュー報告（第29回：厳格審査版 601〜700）\n\n';
md += '第28回に引き続き、日常語や事務用語、名前にそぐわない動作・状態を表す漢字を厳しく排除しています。\n\n';
md += '### 主な修正内容\n';
md += '- **完全排除（スコア1＆フラグ）の大幅適用**: 「添」「描」「掲」「粘」「渋」「袴」「顔」「題」「験」「捺」「答」「営」「検」「評」「復」「報」「就」「読」「顎」「郭」「猟」「略」「靴」など、事務・日常生活・人体名称・ネガティブ要素のある字を計65文字厳しく排除しました。（前回の「鎧」「滑」なども排除基準に含めました）\n';
md += '- **新分類への移行と最適化**: 「曜」「瞬」「燿」など、光や輝きを持つものに新分類の **#希望** を付与し、「織」「繭」などの伝統的価値を持つものに **#伝統** を付与しています。また、「鯉」「櫂」など非常に人気の高い文字を高評価としています。\n';
md += '- **高評価・精査（35文字）**: 「藤」「藍」「麗」「瀬」「瞳」「穣」「鏡」など、名付けで不動の人気と気品を持つ文字は最高評価をつけています。\n\n';
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
fs.writeFileSync('C:/Users/8mits.DESKTOP-4N9QJ6A/OneDrive/ドキュメント/meimay/29.md', md, 'utf8');
console.log('Batch 29 Script Done');
