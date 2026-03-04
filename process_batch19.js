const fs = require('fs');
const path = 'public/data/kanji_data.json';
const data = JSON.parse(fs.readFileSync(path, 'utf8'));

// Apply user adjustments to Batch 18:
// 集、等、童、資、証、税、御、幾 -> unflag

const unflagList = ['集', '等', '童', '資', '証', '税', '御', '幾'];

data.forEach(item => {
    let kanji = item['漢字'];
    if (unflagList.includes(kanji)) {
        item['不適切フラグ'] = 0;
        // Adjust scores/tags for these specifically as they were previously flagged
        if (kanji === '集') { item['おすすめ度'] = 15; item['分類'] = '#飛躍'; }
        if (kanji === '等') { item['おすすめ度'] = 15; item['分類'] = '#調和'; }
        if (kanji === '童') { item['おすすめ度'] = 60; item['分類'] = '#自然'; }
        if (kanji === '資') { item['おすすめ度'] = 15; item['分類'] = '#飛躍'; }
        if (kanji === '証') { item['おすすめ度'] = 15; item['分類'] = '#信念'; }
        if (kanji === '税') { item['おすすめ度'] = 10; item['分類'] = '#調和'; }
        if (kanji === '御') { item['おすすめ度'] = 15; item['分類'] = '#品格'; }
        if (kanji === '幾') { item['おすすめ度'] = 15; item['分類'] = '#飛躍'; }

        item['男のおすすめ度'] = 50;
        item['女のおすすめ度'] = 50;
    }
});

fs.writeFileSync(path, JSON.stringify(data, null, 2));

console.log('Batch 18 final corrections applied.');

// Extract Batch 19 (1800-1899)
const batch19 = data.slice(1800, 1900).map((k, i) => {
    return (i + 1800) + ':' + k['漢字'] + ' (Tags: ' + k['分類'] + ', Mean: ' + k['意味'].replace(/\n/g, '').substring(0, 30) + ')';
});
fs.writeFileSync('batch19_full.txt', batch19.join('\n'), 'utf8');

console.log('Batch 19 extracted.');
