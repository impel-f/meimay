const XLSX = require('xlsx');
const fs = require('fs');

const workbook = XLSX.readFile('人名漢字.xlsx');
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const data = XLSX.utils.sheet_to_json(sheet, { header: 'A' });

const kanjiList = data.map(row => row['A']).filter(val => val && val.length === 1);

const kanjiData = JSON.parse(fs.readFileSync('public/data/kanji_data.json', 'utf8'));
const reviewedSet = new Set();
// We've reviewed up to index 2199 (effectively, but with duplicates)
// Actually, it's safer to just check which ones are in our "reviewed" history 
// or simply which ones have been processed in batches 1-22.
// Let's assume everything currently in the JSON with recommendations/flags adjusted is "reviewed"
// but the user wants to know which ones from the EXCEL list are NOT DONE.

// Let's get the unique kanji from the first 22 batches (0-2199 index range in current JSON)
const reviewedInJson = new Set();
for (let i = 0; i < 2200; i++) {
    if (kanjiData[i]) {
        reviewedInJson.add(kanjiData[i]['漢字']);
    }
}

const missing = kanjiList.filter(k => !reviewedInJson.has(k));

console.log('Total in Excel:', kanjiList.length);
console.log('Reviewed so far:', reviewedInJson.size);
console.log('Missing from Excel list:', missing.length);
console.log('First 50 missing:', JSON.stringify(missing.slice(0, 50)));

fs.writeFileSync('missing_kanji.json', JSON.stringify(missing, null, 2));
