const fs = require('fs');
const path = 'public/data/kanji_data.json';
const data = JSON.parse(fs.readFileSync(path, 'utf8'));

// Apply user adjustments to Batch 23:
// 礁、濯 -> unflag

const unflagList = ['礁', '濯'];

data.forEach(item => {
    let kanji = item['漢字'];
    if (unflagList.includes(kanji)) {
        item['不適切フラグ'] = 0;
        item['おすすめ度'] = 60; // Standard score for acceptable name kanji
        item['男のおすすめ度'] = 60;
        item['女のおすすめ度'] = 60;
        if (kanji === '礁') item['分類'] = '#水景';
        if (kanji === '濯') item['分類'] = '#水景';
    }
});

fs.writeFileSync(path, JSON.stringify(data, null, 2));

console.log('Batch 23 corrections applied.');

// Extract Batch 24 (next 100 missing)
const missing = JSON.parse(fs.readFileSync('missing_kanji.json', 'utf8'));
// We already did 0-100 in Batch 23. Now 100-200.
const currentBatch = missing.slice(100, 200);

const kanjiData = JSON.parse(fs.readFileSync('public/data/kanji_data.json', 'utf8'));
const dataMap = {};
kanjiData.forEach(k => { dataMap[k['漢字']] = k; });

const batchText = currentBatch.map(k => {
    const d = dataMap[k] || { '漢字': k, '分類': '未定義', '意味': 'データなし' };
    return k + ' (Tags: ' + d['分類'] + ', Mean: ' + d['意味'].replace(/\n/g, '').substring(0, 30) + ')';
});

fs.writeFileSync('batch24_missing.txt', batchText.join('\n'), 'utf8');
console.log('Batch 24 extracted.');
