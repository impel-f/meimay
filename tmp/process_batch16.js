const fs = require('fs');
const path = 'public/data/kanji_data.json';
const data = JSON.parse(fs.readFileSync(path, 'utf8'));

// User feedbacks for Batch 15:
// 笛: #奏楽
// 都: remove #色彩, so just #品格
// 黄: #色彩, maybe #調和 removed
// 曹、累、訣: unflag

data.forEach(item => {
    let kanji = item['漢字'];
    if (kanji === '笛') {
        item['分類'] = '#奏楽';
    } else if (kanji === '都') {
        item['分類'] = '#品格';
    } else if (kanji === '黄') {
        item['分類'] = '#色彩';
    } else if (['曹', '累', '訣'].includes(kanji)) {
        item['不適切フラグ'] = 0;
        if (kanji === '曹') { item['おすすめ度'] = 40; item['分類'] = '#調和'; }
        if (kanji === '累') { item['おすすめ度'] = 10; item['分類'] = '#調和'; }
        if (kanji === '訣') { item['おすすめ度'] = 10; item['分類'] = '#信念'; }

        item['男のおすすめ度'] = 50;
        item['女のおすすめ度'] = 50;
    }
});

fs.writeFileSync(path, JSON.stringify(data, null, 2));

console.log('Batch 15 fixed.');

// Extract Batch 16 (1500-1599)
const batch16 = data.slice(1500, 1600).map((k, i) => {
    return (i + 1500) + ':' + k['漢字'] + ' (Tags: ' + k['分類'] + ', Mean: ' + k['意味'].replace(/\n/g, '').substring(0, 30) + ')';
});
fs.writeFileSync('/tmp/batch16.txt', batch16.join('\n'), 'utf8');

console.log('Batch 16 extracted.');
