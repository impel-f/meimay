const fs = require('fs');
const path = 'public/data/kanji_data.json';
const data = JSON.parse(fs.readFileSync(path, 'utf8'));

// Apply user adjustments to Batch 24:
// 類 -> unflag

const unflagList = ['類'];

data.forEach(item => {
    let kanji = item['漢字'];
    if (unflagList.includes(kanji)) {
        item['不適切フラグ'] = 0;
        item['おすすめ度'] = 60;
        item['男のおすすめ度'] = 60;
        item['女のおすすめ度'] = 60;
        item['分類'] = '#調和'; // Based on its meaning "kind/category"
    }
});

fs.writeFileSync(path, JSON.stringify(data, null, 2));

console.log('Batch 24 corrections applied (類).');

// Extract Batch 25 (next 100 missing: 200-300 range)
const missing = JSON.parse(fs.readFileSync('missing_kanji.json', 'utf8'));
const currentBatch = missing.slice(200, 300);

const dataMap = {};
data.forEach(k => { dataMap[k['漢字']] = k; });

const batchText = currentBatch.map(k => {
    const d = dataMap[k] || { '漢字': k, '分類': '未定義', '意味': 'データなし' };
    return k + ' (Tags: ' + d['分類'] + ', Mean: ' + d['意味'].replace(/\n/g, '').substring(0, 30) + ')';
});

fs.writeFileSync('batch25_missing.txt', batchText.join('\n'), 'utf8');
console.log('Batch 25 extracted.');
