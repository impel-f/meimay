const fs = require('fs');
const path = 'public/data/kanji_data.json';
const data = JSON.parse(fs.readFileSync(path, 'utf8'));

// Apply user adjustments to Batch 21:
// 漢 -> #勇壮
// 選、舗、歳、雷、撰 -> unflag

const unflagList = ['選', '舗', '歳', '雷', '撰'];

data.forEach(item => {
    let kanji = item['漢字'];
    if (unflagList.includes(kanji)) {
        item['不適切フラグ'] = 0;
        item['おすすめ度'] = 15;
        item['男のおすすめ度'] = 50;
        item['女のおすすめ度'] = 50;
        if (kanji === '選') item['分類'] = '#知性';
        if (kanji === '舗') item['分類'] = '#調和';
        if (kanji === '歳') item['分類'] = '#品格';
        if (kanji === '雷') item['分類'] = '#勇壮';
        if (kanji === '撰') item['分類'] = '#知性';
    }
    if (kanji === '漢') {
        item['分類'] = '#勇壮';
        item['不適切フラグ'] = 0;
        item['おすすめ度'] = 50;
    }
});

fs.writeFileSync(path, JSON.stringify(data, null, 2));

console.log('Batch 21 final corrections applied.');

// Extract Batch 22 (2100-2199)
const batch22 = data.slice(2100, 2200).map((k, i) => {
    return (i + 2100) + ':' + k['漢字'] + ' (Tags: ' + k['分類'] + ', Mean: ' + k['意味'].replace(/\n/g, '').substring(0, 30) + ')';
});
fs.writeFileSync('batch22_full.txt', batch22.join('\n'), 'utf8');

console.log('Batch 22 extracted.');
