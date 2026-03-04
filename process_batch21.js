const fs = require('fs');
const path = 'public/data/kanji_data.json';
const data = JSON.parse(fs.readFileSync(path, 'utf8'));

// Apply user adjustments to Batch 20:
// 渾 -> unflag
// 遠 -> flag as inappropriate

const itemKon = data.find(i => i['漢字'] === '渾');
if (itemKon) {
    itemKon['不適切フラグ'] = 0;
    itemKon['おすすめ度'] = 15;
    itemKon['分類'] = '#勇壮';
    itemKon['男のおすすめ度'] = 50;
    itemKon['女のおすすめ度'] = 50;
}

const itemEn = data.find(i => i['漢字'] === '遠');
if (itemEn) {
    itemEn['不適切フラグ'] = 1;
    itemEn['おすすめ度'] = 1;
    itemEn['分類'] = '';
    itemEn['男のおすすめ度'] = 1;
    itemEn['女のおすすめ度'] = 1;
}

fs.writeFileSync(path, JSON.stringify(data, null, 2));

console.log('Batch 20 final corrections applied.');

// Extract Batch 21 (2000-2099)
const batch21 = data.slice(2000, 2100).map((k, i) => {
    return (i + 2000) + ':' + k['漢字'] + ' (Tags: ' + k['分類'] + ', Mean: ' + k['意味'].replace(/\n/g, '').substring(0, 30) + ')';
});
fs.writeFileSync('batch21_full.txt', batch21.join('\n'), 'utf8');

console.log('Batch 21 extracted.');
