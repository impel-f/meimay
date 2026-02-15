const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

// Try with absolute path first
const excelPath = path.resolve('C:\\Users\\8mits.DESKTOP-4N9QJ6A\\OneDrive\\ドキュメント\\antigravity-meimay\\漢字_四字熟語_ことわざデータ.xlsx');
const outputPath = path.resolve(__dirname, '../public/data/idioms.json');

console.log('Reading from:', excelPath);

try {
    if (!fs.existsSync(excelPath)) {
        throw new Error(`File not found at ${excelPath}`);
    }

    const workbook = XLSX.readFile(excelPath);
    console.log('Sheets:', workbook.SheetNames);

    let allIdioms = [];

    const targetSheets = ['yojijukugo_data', 'kotowaza_data'];

    targetSheets.forEach(sheetName => {
        if (!workbook.SheetNames.includes(sheetName)) {
            console.warn(`Warning: Sheet "${sheetName}" not found in workbook.`);
            return;
        }

        const sheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(sheet);

        if (data.length > 0) {
            console.log(`Processing sheet "${sheetName}"...`);

            // Filter by "名づけフラグ" == 1
            const filtered = data.filter(row => {
                // Flexible matching for flag column just in case, but user specified "名づけフラグ"
                const flagVal = row['名づけフラグ'] || row['名付けフラグ'] || row['flag'];
                return flagVal == 1;
            });

            console.log(`  - Total rows: ${data.length}`);
            console.log(`  - Positive (flag=1): ${filtered.length}`);

            filtered.forEach(row => {
                // Normalized object structure
                allIdioms.push({
                    "漢字": row['漢字'] || row['四字熟語'] || row['ことわざ'], // Main text
                    "読み": row['読み'],
                    "意味": row['意味'],
                    "type": sheetName === 'yojijukugo_data' ? '四字熟語' : 'ことわざ',
                    "_sourceSheet": sheetName
                });
            });
        }
    });

    // Ensure directory exists
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(outputPath, JSON.stringify(allIdioms, null, 2));
    console.log(`Successfully wrote ${allIdioms.length} items to ${outputPath}`);

} catch (e) {
    console.error('Error:', e);
}
