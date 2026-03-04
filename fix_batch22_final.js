const fs = require('fs');
const path = 'public/data/kanji_data.json';
const data = JSON.parse(fs.readFileSync(path, 'utf8'));

// Apply user adjustments to Batch 22:
// 稽、摩 -> unflag

const unflagList = ['稽', '摩'];

data.forEach(item => {
    let kanji = item['漢字'];
    if (unflagList.includes(kanji)) {
        item['不適切フラグ'] = 0;
        item['おすすめ度'] = 15;
        item['男のおすすめ度'] = 50;
        item['女のおすすめ度'] = 50;
        if (kanji === '稽') item['分類'] = '#知性';
        if (kanji === '摩') item['分類'] = '#知性';
    }
});

fs.writeFileSync(path, JSON.stringify(data, null, 2));

console.log('Batch 22 final corrections for 稽/摩 applied.');
