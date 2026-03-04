const fs = require('fs');
const XLSX = require('xlsx');

// 1. Read directly from the source Excel file to guarantee accuracy
const wbSource = XLSX.readFile('人名漢字.xlsx');
const sheetName = wbSource.SheetNames[0];
const wsSource = wbSource.Sheets[sheetName];
const excelData = XLSX.utils.sheet_to_json(wsSource, { header: 1 });

// Extract A column, skip header
const rawExcelKanji = excelData.map(row => row[0]).filter(Boolean).slice(1);
const uniqueExcel = [...new Set(rawExcelKanji)];

// 2. Read the compiled kanji JSON data
const data = JSON.parse(fs.readFileSync('public/data/kanji_data.json', 'utf8'));

const dataMap = new Map();
for (let i = data.length - 1; i >= 0; i--) {
    let kanji = data[i]['漢字'];
    if (!dataMap.has(kanji)) {
        dataMap.set(kanji, data[i]);
    }
}

// 3. Prepare data for the new Excel sheet
const rsData = [];
rsData.push(['漢字', '分類', '総合スコア', '男スコア', '女スコア', 'フラグ', '判定', '備考']);

uniqueExcel.forEach(kanji => {
    let item = dataMap.get(kanji);
    if (item) {
        let flagVal = (item['不適切フラグ'] === 1 || item['不適切フラグ'] === '1') ? 1 : 0;
        let status = (flagVal === 1) ? '要注意' : 'OK';
        rsData.push([
            kanji,
            item['分類'] || '',
            item['おすすめ度'],
            item['男のおすすめ度'],
            item['女のおすすめ度'],
            flagVal,
            status,
            ''
        ]);
    } else {
        rsData.push([kanji, '', '', '', '', '', '', 'データ未存在（空白）']);
    }
});

// 4. Write Excel
const wb = XLSX.utils.book_new();
const ws = XLSX.utils.aoa_to_sheet(rsData);
XLSX.utils.book_append_sheet(wb, ws, '統合結果');
const outputPath = 'kanji_master_2999_final.xlsx';
XLSX.writeFile(wb, outputPath);

// 5. Write CSV just in case
let csv = '\uFEFF漢字,分類,総合スコア,男スコア,女スコア,フラグ,判定,備考\n';
uniqueExcel.forEach(kanji => {
    let item = dataMap.get(kanji);
    if (item) {
        let flagVal = (item['不適切フラグ'] === 1 || item['不適切フラグ'] === '1') ? 1 : 0;
        let status = (flagVal === 1) ? '要注意' : 'OK';
        csv += `${kanji},"${item['分類'] || ''}",${item['おすすめ度']},${item['男のおすすめ度']},${item['女のおすすめ度']},${flagVal},${status},\n`;
    } else {
        csv += `${kanji},,,,,,データ未存在（空白）\n`;
    }
});
fs.writeFileSync('kanji_master_2999_final.csv', csv, 'utf8');

console.log('SUCCESS, processed', uniqueExcel.length, 'unique characters from source Excel.');
