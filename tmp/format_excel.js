const xlsx = require('xlsx');
const fs = require('fs');

const inputFile = '読み方リスト.xlsx';
const outputFile = '読み方リスト_整形済.xlsx';

const wb = xlsx.readFile(inputFile);
const newWb = xlsx.utils.book_new();

wb.SheetNames.forEach(sheetName => {
    const ws = wb.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(ws, { header: 1 });

    // Process data
    const newData = [];

    // Header
    if (data.length > 0) {
        newData.push(['読み', '件数', '名前例']);
    }

    for (let i = 1; i < data.length; i++) {
        const row = data[i];
        if (!row || row.length === 0) continue;

        let yomiStr = row[0] || '';
        let kanjiStr = row[1] || '';

        // Extract yomi and count
        let yomi = '';
        let count = 0;

        const match = yomiStr.match(/^(.+?)(\d+)件$/);
        if (match) {
            yomi = match[1];
            count = parseInt(match[2], 10);
        } else {
            yomi = yomiStr;
        }

        // Format kanji string
        let formattedKanji = kanjiStr;
        if (count > 0 && kanjiStr.length > 0) {
            // The number of examples seems to be exactly min(count, 6) based on data patterns
            const numExamples = Math.min(count, 6);
            if (kanjiStr.length % numExamples === 0) {
                const chunkSize = kanjiStr.length / numExamples;
                const chunks = [];
                for (let j = 0; j < kanjiStr.length; j += chunkSize) {
                    chunks.push(kanjiStr.substring(j, j + chunkSize));
                }
                formattedKanji = chunks.join(' ');
            } else {
                // If it doesn't divide evenly, we still want to separate it somehow if possible
                // Fallback: just put a space every 2 characters since most names are 2 kanji
                const chunks = [];
                for (let j = 0; j < kanjiStr.length; j += 2) {
                    chunks.push(kanjiStr.substring(j, j + 2));
                }
                formattedKanji = chunks.join(' ');
            }
        }

        newData.push([yomi, count, formattedKanji]);
    }

    const newWs = xlsx.utils.aoa_to_sheet(newData);

    // Adjust column widths roughly
    newWs['!cols'] = [
        { wch: 15 }, // 読み
        { wch: 10 }, // 件数
        { wch: 100 } // 名前例
    ];

    xlsx.utils.book_append_sheet(newWb, newWs, sheetName);
});

xlsx.writeFile(newWb, outputFile);
console.log(`Saved output to ${outputFile}`);
