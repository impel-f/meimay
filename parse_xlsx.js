const XLSX = require('xlsx');
const fs = require('fs');

const wb = XLSX.readFile('誕生日.xlsx', { cellDates: true });
const sheet = wb.Sheets[wb.SheetNames[0]];
const data = XLSX.utils.sheet_to_json(sheet);

const result = {};
let count = 0;

data.forEach(row => {
    let dateObj = row['日付'];
    let kanji = row['漢字'];
    let person = row['誕生日'] || '';

    if (!kanji) return;
    kanji = kanji.trim();
    person = person.toString().trim();

    let mmdd = null;

    if (dateObj instanceof Date) {
        let m = (dateObj.getUTCMonth() + 1).toString().padStart(2, '0');
        let d = dateObj.getUTCDate().toString().padStart(2, '0');
        mmdd = `${m}-${d}`;
    } else if (typeof dateObj === 'string') {
        // Parse string like "1/1" or "01-01" or "1月1日"
        let match = dateObj.match(/(\d+)\s*[\/\-月]\s*(\d+)/);
        if (match) {
            let m = match[1].padStart(2, '0');
            let d = match[2].padStart(2, '0');
            mmdd = `${m}-${d}`;
        }
    } else if (typeof dateObj === 'number') {
        // sometimes 101 = Jan 1
        let s = dateObj.toString();
        if (s.length >= 3 && s.length <= 4) {
            let m = s.slice(0, s.length - 2).padStart(2, '0');
            let d = s.slice(-2).padStart(2, '0');
            mmdd = `${m}-${d}`;
        }
    }

    if (mmdd) {
        result[mmdd] = { kanji, person };
        count++;
    } else {
        console.log("Failed to parse date:", row);
    }
});

const content = `const TodaysKanjiData = ${JSON.stringify(result, null, 2)};\n`;
fs.writeFileSync('public/js/data/todays-kanji-data.js', content);
console.log(`Finished writing ${count} entries.`);
