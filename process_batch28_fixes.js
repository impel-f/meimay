const fs = require('fs');
const path = 'public/data/kanji_data.json';
const data = JSON.parse(fs.readFileSync(path, 'utf8'));

// Apply user adjustments to Redo Batch 27:
// 砂, 専, 甚 -> unflag

const okScores = {
    '砂': { tags: ['#自然', '#調和'], score: 60 },
    '専': { tags: ['#信念', '#知性'], score: 70 },
    '甚': { tags: ['#調和', '#飛躍'], score: 60 },
};

data.forEach(item => {
    let kanji = item['漢字'];
    if (okScores[kanji]) {
        item['不適切フラグ'] = 0;
        item['おすすめ度'] = okScores[kanji].score;
        item['男のおすすめ度'] = okScores[kanji].score;
        item['女のおすすめ度'] = okScores[kanji].score;
        item['分類'] = okScores[kanji].tags.join(' ');
    }
});

fs.writeFileSync(path, JSON.stringify(data, null, 2));
console.log('Corrections applied for 砂, 専, 甚.');
