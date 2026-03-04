const fs = require('fs');
const path = 'public/data/kanji_data.json';
const data = JSON.parse(fs.readFileSync(path, 'utf8'));

// 1. Deduplicate missing_kanji.json
const missing = JSON.parse(fs.readFileSync('missing_kanji.json', 'utf8'));
const uniqueMissing = [...new Set(missing)];
fs.writeFileSync('missing_kanji.json', JSON.stringify(uniqueMissing, null, 2));

console.log(`missing_kanji.json: deduplicated from ${missing.length} to ${uniqueMissing.length} items`);

// 2. Deduplicate kanji_data.json based on '漢字' field, keeping the latest/most processed version
// To keep the most processed, we will iterate backwards, so the last occurrence is kept.
const dataMap = new Map();
for (let i = data.length - 1; i >= 0; i--) {
    let kanji = data[i]['漢字'];
    if (!dataMap.has(kanji)) {
        dataMap.set(kanji, data[i]);
    }
}
const dedupData = Array.from(dataMap.values()).reverse();
console.log(`kanji_data.json: deduplicated from ${data.length} to ${dedupData.length} items`);

// Apply user adjustments to Batch 29:
// 擢、繁、観、菱、稚、趣 -> unflag
const okScores = {
    '擢': { tags: ['#飛躍', '#品格'], score: 85 },
    '繁': { tags: ['#自然', '#飛躍'], score: 90 }, // 繁の異体字
    '観': { tags: ['#知性', '#天空'], score: 80 },
    '菱': { tags: ['#調和', '#色彩'], score: 70 },
    '稚': { tags: ['#自然', '#調和'], score: 60 },
    '趣': { tags: ['#品格', '#知性'], score: 70 },
};

dedupData.forEach(item => {
    let kanji = item['漢字'];
    if (okScores[kanji]) {
        item['不適切フラグ'] = 0;
        item['おすすめ度'] = okScores[kanji].score;
        item['男のおすすめ度'] = okScores[kanji].score;
        item['女のおすすめ度'] = okScores[kanji].score;
        item['分類'] = okScores[kanji].tags.join(' ');
    }
});

fs.writeFileSync(path, JSON.stringify(dedupData, null, 2));
console.log('Corrections applied for 擢、繁、観、菱、稚、趣.');

// Determine what has actually been reviewed vs what is missing
// The user reviewed up to batch 29, meaning 700 raw items processed. 
// However, since we deduplicated, we need to know where to start Batch 30.
// Let's figure out how many of uniqueMissing have already been given a strict evaluation.
// Since we processed 700 items, let's find the first character in uniqueMissing that hasn't been strictly reviewed?
// Wait, the index might have shifted.
// To be safe, the original list up to index 700 contained duplicates. 
// We should find the exact characters that haven't been reviewed yet.
// A simpler way: we just find elements in uniqueMissing that have ONLY score=50, flag=0, tags='' or similar default data?
// But it's easier to just find the index of the character that was LAST in Batch 29 (e.g. '瀬'). 
// Where is '瀬' in uniqueMissing?
let lastIndex = uniqueMissing.indexOf('瀬');
console.log(`Last reviewed character '瀬' found at index: ${lastIndex}`);

let startIndex = lastIndex !== -1 ? lastIndex + 1 : 0;
const currentBatch = uniqueMissing.slice(startIndex, startIndex + 100);

const batchText = currentBatch.map(k => {
    const d = dedupData.find(x => x['漢字'] === k) || { '漢字': k, '分類': '未定義', '意味': 'データ取得中' };
    return k + ' (Tags: ' + d['分類'] + ', Mean: ' + d['意味'].replace(/\n/g, '').substring(0, 30) + ')';
});

fs.writeFileSync('batch30_missing.txt', batchText.join('\n'), 'utf8');
console.log(`Batch 30 extracted starting from index ${startIndex}. Contains ${currentBatch.length} items.`);
