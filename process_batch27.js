const fs = require('fs');
const path = 'public/data/kanji_data.json';
const data = JSON.parse(fs.readFileSync(path, 'utf8'));

// Apply user adjustments to Batch 26:
// 断, 別 -> flag inappropriate

const listToFlag = ['断', '別'];

data.forEach(item => {
    if (listToFlag.includes(item['漢字'])) {
        item['不適切フラグ'] = 1;
        item['おすすめ度'] = 1;
        item['男のおすすめ度'] = 1;
        item['女のおすすめ度'] = 1;
        item['分類'] = '';
    }
});

fs.writeFileSync(path, JSON.stringify(data, null, 2));

console.log('Batch 26 corrections applied (断, 別).');

// Extract Batch 27 (next 100 missing: 400-500 range)
const missing = JSON.parse(fs.readFileSync('missing_kanji.json', 'utf8'));
const currentBatch = missing.slice(400, 500);

const dataMap = {};
data.forEach(k => { dataMap[k['漢字']] = k; });

const batchText = currentBatch.map(k => {
    const d = dataMap[k] || { '漢字': k, '分類': '未定義', '意味': 'データ取得中' };
    return k + ' (Tags: ' + d['分類'] + ', Mean: ' + d['意味'].replace(/\n/g, '').substring(0, 30) + ')';
});

fs.writeFileSync('batch27_missing.txt', batchText.join('\n'), 'utf8');
console.log('Batch 27 extracted.');
