const fs = require('fs');
const path = 'public/data/kanji_data.json';
const data = JSON.parse(fs.readFileSync(path, 'utf8'));

// Apply user adjustments to Batch 19:
// 殖 -> flag as inappropriate
// 蒐、堪、増、適 -> unflag

data[1804]['不適切フラグ'] = 1; // 殖
data[1804]['おすすめ度'] = 1;
data[1804]['分類'] = '';

const unflagList = ['蒐', '堪', '増', '適'];
const unflagIndices = [1841, 1854, 1880, 1883];

unflagIndices.forEach((idx, i) => {
    const kanji = unflagList[i];
    data[idx]['不適切フラグ'] = 0;
    data[idx]['おすすめ度'] = 15;
    if (kanji === '蒐') data[idx]['分類'] = '#知性';
    if (kanji === '堪') data[idx]['分類'] = '#勇壮';
    if (kanji === '増') data[idx]['分類'] = '#調和';
    if (kanji === '適') data[idx]['分類'] = '#調和';
    data[idx]['男のおすすめ度'] = 50;
    data[idx]['女のおすすめ度'] = 50;
});

fs.writeFileSync(path, JSON.stringify(data, null, 2));

console.log('Batch 19 final corrections applied.');

// Extract Batch 20 (1900-1999)
const batch20 = data.slice(1900, 2000).map((k, i) => {
    return (i + 1900) + ':' + k['漢字'] + ' (Tags: ' + k['分類'] + ', Mean: ' + k['意味'].replace(/\n/g, '').substring(0, 30) + ')';
});
fs.writeFileSync('batch20_full.txt', batch20.join('\n'), 'utf8');

console.log('Batch 20 extracted.');
