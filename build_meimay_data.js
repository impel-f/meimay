const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');

// 1. Process 人名漢字.xlsx for kanji_data.json
console.log("Processing 人名漢字.xlsx...");
const jinmeiWorkbook = xlsx.readFile('人名漢字.xlsx');
const jinmeiSheet = jinmeiWorkbook.Sheets[jinmeiWorkbook.SheetNames[0]];
const jinmeiData = xlsx.utils.sheet_to_json(jinmeiSheet);

// Load old kanji data to preserve original meanings (`意味`)
const oldKanjiPath = path.join(__dirname, 'build_temp_old_kanji.json');
let oldKanjiMap = new Map();
if (fs.existsSync(oldKanjiPath)) {
    const oldKanjiData = require(oldKanjiPath);
    oldKanjiData.forEach(k => {
        if (k['漢字']) {
            oldKanjiMap.set(k['漢字'], k['意味'] || '');
        }
    });
    console.log(`Loaded ${oldKanjiMap.size} old kanji meanings.`);
}

// Define default values or clean up the data where needed
const cleanJinmei = jinmeiData.map(kanji => {
    return {
        ...kanji,
        'おすすめ度': kanji['おすすめ度'] !== undefined ? kanji['おすすめ度'] : 50,
        '男のおすすめ度': kanji['男のおすすめ度'] !== undefined ? kanji['男のおすすめ度'] : 50,
        '女のおすすめ度': kanji['女のおすすめ度'] !== undefined ? kanji['女のおすすめ度'] : 50,
        '不適切フラグ': kanji['不適切フラグ'] || 0,
        '分類': kanji['分類'] || '',
        '意味': oldKanjiMap.has(kanji['漢字']) && oldKanjiMap.get(kanji['漢字']) ? oldKanjiMap.get(kanji['漢字']) : (kanji['意味'] || ''),
        // Clean empty properties created by xlsx like __EMPTY
        __EMPTY: undefined
    };
}).map(k => {
    // Remove the undefined properties
    const cleaned = {};
    for (let key in k) {
        if (k[key] !== undefined) {
            cleaned[key] = k[key];
        }
    }
    return cleaned;
});

const kanjiDataPath = path.join(__dirname, 'public', 'data', 'kanji_data.json');
fs.writeFileSync(kanjiDataPath, JSON.stringify(cleanJinmei, null, 2));
console.log(`Wrote ${cleanJinmei.length} records to kanji_data.json`);

// 2. Process kanji_all_苗字画数用.xlsx for stroke_data.json
console.log("Processing kanji_all_苗字画数用.xlsx...");
const strokeWorkbook = xlsx.readFile('kanji_all_苗字画数用.xlsx');
const strokeSheet = strokeWorkbook.Sheets[strokeWorkbook.SheetNames[0]];
const strokeRawData = xlsx.utils.sheet_to_json(strokeSheet);

const strokeData = {};
strokeRawData.forEach(row => {
    if (row['漢字'] && row['画数']) {
        strokeData[row['漢字']] = parseInt(row['画数']);
    }
});

const strokeDataPath = path.join(__dirname, 'public', 'data', 'stroke_data.json');
fs.writeFileSync(strokeDataPath, JSON.stringify(strokeData, null, 2));
console.log(`Wrote ${Object.keys(strokeData).length} unique characters to stroke_data.json`);

console.log("Data generation completed.");
