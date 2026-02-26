const xlsx = require('xlsx');
const fs = require('fs');

const workbook = xlsx.readFile('kanji_all_苗字画数用.xlsx');
console.log("Sheet names:", workbook.SheetNames);

for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const json = xlsx.utils.sheet_to_json(sheet);
    fs.writeFileSync(`dump_${sheetName}.json`, JSON.stringify(json, null, 2));
    console.log(`Wrote dump_${sheetName}.json with ${json.length} rows`);
}
