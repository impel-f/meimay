const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

const excelPath = path.join(__dirname, '..', '読み方リスト_タグ付き.xlsx');
const outputPath = path.join(__dirname, '..', 'src', 'data', 'readings_data.json');

console.log(`Reading Excel file: ${excelPath}`);

try {
    const workbook = xlsx.readFile(excelPath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    // Read raw data
    const rawData = xlsx.utils.sheet_to_json(sheet, { defval: '' });

    console.log(`Found ${rawData.length} rows.`);

    const formattedData = rawData.map(row => {
        // Parse tags logic (e.g., "#爽やか #レトロ" -> ["#爽やか", "#レトロ"])
        let tagsArray = [];
        if (row.tags && typeof row.tags === 'string') {
            tagsArray = row.tags
                .split(/[\s　]+/) // Split by full/half-width space
                .map(t => t.trim())
                .filter(t => t.length > 0 && t.startsWith('#'));
        }

        // Gender parsing
        const rawGender = String(row['性別'] || '').trim();
        let genderStr = 'neutral';
        if (rawGender.includes('男')) genderStr = 'male';
        if (rawGender.includes('女')) genderStr = 'female';

        return {
            reading: String(row['読み'] || '').trim(),
            isPopular: String(row['人気'] || '').trim() === '〇',
            count: Number(row['件数']) || 0,
            examples: String(row['名前例'] || '').trim(),
            gender: genderStr,
            isNeutral: String(row['中性フラグ'] || '').trim() !== '' || rawGender === '中性',
            tags: tagsArray
        };
    }).filter(item => item.reading.length > 0);

    // Save to src/data/readings_data.json
    fs.writeFileSync(outputPath, JSON.stringify(formattedData, null, 2));
    console.log(`Successfully wrote ${formattedData.length} records to ${outputPath}`);

} catch (e) {
    console.error(`Error building readings data: ${e.message}`);
    process.exit(1);
}
