const fs = require('fs');
const path = 'public/data/kanji_data.json';
const data = JSON.parse(fs.readFileSync(path, 'utf8'));

// Apply user adjustments to Batch 26:
const flagList = ['干', '巾', '勺', '片', '皿', '召', '寺', '坂', '阪', '岸', '所', '昔'];

data.forEach(item => {
    if (flagList.includes(item['漢字'])) {
        item['不適切フラグ'] = 1;
        item['おすすめ度'] = 1;
        item['男のおすすめ度'] = 1;
        item['女のおすすめ度'] = 1;
        item['分類'] = '';
    }
});

fs.writeFileSync(path, JSON.stringify(data, null, 2));
console.log('Corrections applied for Batch 26.');

// Extract Batch 28 (next 100 missing: 501-600 range)
const missing = JSON.parse(fs.readFileSync('missing_kanji.json', 'utf8'));
const currentBatch = missing.slice(500, 600);

const dataMap = {};
data.forEach(k => { dataMap[k['漢字']] = k; });

const batchText = currentBatch.map(k => {
    const d = dataMap[k] || { '漢字': k, '分類': '未定義', '意味': 'データ取得中' };
    return k + ' (Tags: ' + d['分類'] + ', Mean: ' + d['意味'].replace(/\n/g, '').substring(0, 30) + ')';
});

fs.writeFileSync('batch28_missing.txt', batchText.join('\n'), 'utf8');
console.log('Batch 28 extracted.');
