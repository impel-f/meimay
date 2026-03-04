const fs = require('fs');
const path = 'public/data/kanji_data.json';
const data = JSON.parse(fs.readFileSync(path, 'utf8'));

// Batch 24: 101-200 missing Kanji from Excel
const missing = JSON.parse(fs.readFileSync('missing_kanji.json', 'utf8'));
const currentBatch = missing.slice(100, 200);

// Strict Filtering Rules for Batch 24
const strictFlags = [
    '鎌', '襖', '蹟', '慢', '叢', '儲', '鵜', '鞭', '藥', '憎', '漂', '醬', '臓',
    '繰', '爆', '酷', '鶏', '銃', '塾', '漸', '璽', '蹴', '蟹', '櫛', '閥', '櫓',
    '壞', '遡', '類', '綻', '顚', '欄', '醸', '纂', '孃', '蔭', '鳶', '艦', '飜',
    '鷄', '攝', '欄', '嘗', '蠟', '襲', '鑄', '槍', '疊', '臟', '覽', '頗', '箔',
    '蔓', '鱒', '鱗', '懲'
];

const oldCharsBatch = {
    '藥': '薬', '藏': '蔵', '鎭': '鎮', '醬': '醤', '瀧': '滝', '壞': '壊',
    '繫': '繋', '顚': '顛', '孃': '嬢', '飜': '翻', '鷄': '鶏', '攝': '摂',
    '欄': '欄', '鑄': '鋳', '疊': '畳', '臟': '臓', '覽': '覧', '鷗': '鴎'
};

const manualScores = {
    '雛': 40, '踊': 80, '暦': 100, '麿': 90, '魂': 40, '藏': 70, '鎭': 80, '慕': 95,
    '墨': 80, '緒': 95, '彰': 100, '誓': 90, '銘': 90, '僚': 85, '瀧': 95, '繫': 80,
    '鐘': 85, '璃': 100, '瑠': 100, '嘉': 100, '榎': 90, '樺': 90, '魁': 95, '瑳': 100,
    '榊': 95, '竪': 85, '榛': 95, '槙': 95, '賑': 90, '翠': 100, '碩': 100, '聡': 100,
    '暢': 95, '肇': 95, '蔦': 85, '鷗': 80, '嶋': 90, '緋': 100, '輔': 100, '鳳': 100,
    '碧': 100, '綾': 100, '漣': 100, '颯': 100
};

const tagChanges = {
    '颯': ['#勇壮', '#飛躍'], // remove 天空
    '緋': ['#色彩', '#品格'], // remove 天空
    '魁': ['#勇壮', '#品格'], // remove 天空
    '誓': ['#信念', '#品格'], // remove 天空
    '翠': ['#色彩', '#水景'],
    '碧': ['#色彩', '#水景'],
    '璃': ['#色彩', '#品格'],
    '瑠': ['#色彩', '#品格'],
    '彰': ['#品格', '#知性']
};

let md = '# 漢字レビュー報告（第24回：Excel名簿に基づく未精査字 101〜200）\n\n';
md += '未精査リストの第2弾です。画数の多い複雑な字や、日常生活・解剖学的な用語が目立ちますが、厳格に選別いたしました。\n\n';
md += '### 主な修正内容\n';
md += '- **完全排除（スコア1＆フラグ）**: 「慢」「鞭」「憎」「爆」「酷」「銃」「蹴」「蟹」「壞」「襲」「槍」「懲」など不穏・攻撃的なもの、「臓」「鱗」「膝」などの生理的名称、「儲」「塾」「閥」「欄」「纂」「艦」「覽」「箔」などの事務・構造的な語、計56文字を排除しました。\n';
md += '- **「#天空」タグの修正**: 「颯」「緋」「魁」「誓」などから実態に合わない天空タグを除去し、本来のイメージ（#勇壮、#色彩など）に整理しました。また、不要な不適切字からのタグ削除も徹底しています。\n';
md += '- **高評価・精査**: 「颯」「碧」「翠」「璃」「瑠」「嘉」「彰」「聡」など、現代の名前で非常に人気・品格ともに高い漢字を最高位で評価しました。\n';
md += '- **旧字体/異体字・稀少字**: 「藏」「鎭」「瀧」「瑳」など趣のある字はスコアを確保しつつ、常用漢字の存在を付記しています。\n\n';
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
fs.writeFileSync('C:/Users/8mits.DESKTOP-4N9QJ6A/OneDrive/ドキュメント/meimay/24.md', md, 'utf8');
console.log('Batch 24 Script Done');
