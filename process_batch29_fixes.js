const fs = require('fs');
const path = 'public/data/kanji_data.json';
const data = JSON.parse(fs.readFileSync(path, 'utf8'));

// Apply user adjustments to Strict Batch 28:
// 衿, 帯, 檎, 探 -> unflag

const okScores = {
    '衿': { tags: ['#調和', '#色彩'], score: 70 },
    '帯': { tags: ['#調和', '#伝統'], score: 60 },
    '檎': { tags: ['#自然'], score: 60 },
    '探': { tags: ['#知性', '#飛躍'], score: 60 },
};

data.forEach(item => {
    let kanji = item['漢字'];
    if (okScores[kanji]) {
        item['不適切フラグ'] = 0;
        item['おすすめ度'] = okScores[kanji].score;
        item['男のおすすめ度'] = okScores[kanji].score;
        item['女のおすすめ度'] = okScores[kanji].score;
        item['分類'] = okScores[kanji].tags.join(' ');
    }
});

fs.writeFileSync(path, JSON.stringify(data, null, 2));
console.log('Corrections applied for 衿, 帯, 檎, 探.');

// Extract Batch 29 (next 100 missing: 601-700 range)
const missing = JSON.parse(fs.readFileSync('missing_kanji.json', 'utf8'));
const currentBatch = missing.slice(600, 700);

const dataMap = {};
data.forEach(k => { dataMap[k['漢字']] = k; });

const batchText = currentBatch.map(k => {
    const d = dataMap[k] || { '漢字': k, '分類': '未定義', '意味': 'データ取得中' };
    return k + ' (Tags: ' + d['分類'] + ', Mean: ' + d['意味'].replace(/\n/g, '').substring(0, 30) + ')';
});

fs.writeFileSync('batch29_missing.txt', batchText.join('\n'), 'utf8');
console.log('Batch 29 extracted.');
