const xlsx = require('xlsx');
const fs = require('fs');

const inputFile = '読み方リスト_整形済.xlsx';
const baseFile = '読み方リスト.xlsx'; // To read perfectly chunked known names if needed

// First, build a set of known valid names from the original base file's perfectly-divided rows
const wbBase = xlsx.readFile(baseFile);
const validNames = new Set();
// Also build a mapping from reading to set of names just in case
const readingToNames = new Map();

wbBase.SheetNames.forEach(sheet => {
    const data = xlsx.utils.sheet_to_json(wbBase.Sheets[sheet], { header: 1 });
    for (let i = 1; i < data.length; i++) {
        const row = data[i];
        if (!row || !row[0] || (!row[1] && row[1] !== '')) continue;
        const yomiStr = row[0];
        const kanjiStr = String(row[1]);
        const match = yomiStr.match(/^(.+?)(\d+)件$/);
        const yomi = match ? match[1] : yomiStr;
        const count = match ? parseInt(match[2], 10) : 0;
        const ex = Math.min(count, 6);

        if (ex > 0 && kanjiStr.length > 0 && kanjiStr.length % ex === 0) {
            const size = kanjiStr.length / ex;
            for (let j = 0; j < kanjiStr.length; j += size) {
                const name = kanjiStr.substring(j, j + size);
                validNames.add(name);
                if (!readingToNames.has(yomi)) readingToNames.set(yomi, new Set());
                readingToNames.get(yomi).add(name);
            }
        }
    }
});

let memo = new Map();
function getBestPartition(str, yomi) {
    if (str.length === 0) return [];
    const memoKey = str + '|' + yomi;
    if (memo.has(memoKey)) return memo.get(memoKey);

    let best = null;
    let bestScore = -1;

    // We can have lengths 1 to min(str.length, 6)
    for (let len = 1; len <= Math.min(6, str.length); len++) {
        const part = str.substring(0, len);
        const rest = getBestPartition(str.substring(len), yomi);
        if (rest !== null) {
            let score = 0;
            // Heavily reward if known for this reading
            if (readingToNames.has(yomi) && readingToNames.get(yomi).has(part)) {
                score += 100;
            }
            // Reward if it is a known name at all
            else if (validNames.has(part)) {
                score += 10;
            }
            // Penalty for length 4 unless very confident
            if (len === 4) score -= 5;

            score += rest.score !== undefined ? rest.score : 0;

            // Prefer 2-character names if it's a tie
            if (len === 2) score += 1;

            if (score > bestScore) {
                bestScore = score;
                best = [part, ...rest];
                best.score = score;
            }
        }
    }
    memo.set(memoKey, best);
    return best;
}

const wbUser = xlsx.readFile(inputFile);
const newWb = xlsx.utils.book_new();
const appData = [];

// The columns: [ '読み', '人気', '件数', '名前例' ]
wbUser.SheetNames.forEach(sheetName => {
    const ws = wbUser.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(ws, { header: 1 });

    const newData = [];
    if (data.length > 0) {
        newData.push(['読み', '人気', '件数', '名前例']);
    }

    for (let i = 1; i < data.length; i++) {
        const row = data[i];
        if (!row || row.length === 0) continue;

        let yomi = row[0] || '';
        let popular = row[1] || '';
        let count = parseInt(row[2]) || 0;
        let spacedNames = row[3] || '';

        // Recover original concatenated string
        let kanjiStr = String(spacedNames).replace(/\s/g, '').replace(/\(要手動確認\)/g, '');

        const ex = Math.min(count, 6);
        let formattedKanji = spacedNames;
        let examples = [];

        if (ex > 0 && kanjiStr.length > 0) {
            const partition = getBestPartition(kanjiStr, yomi);
            if (partition) {
                examples = [...partition];
                formattedKanji = partition.join(' ');
            } else if (kanjiStr.length % ex === 0) {
                // Fallback to equal chunks
                const size = kanjiStr.length / ex;
                for (let j = 0; j < kanjiStr.length; j += size) {
                    examples.push(kanjiStr.substring(j, j + size));
                }
                formattedKanji = examples.join(' ');
            } else {
                formattedKanji = kanjiStr + ' (エラー)';
            }
        }

        newData.push([yomi, popular, count, formattedKanji]);

        // Only output to app if there's actual logic
        appData.push({
            yomi,
            popular: popular.includes('○') || popular.includes('〇'),
            count,
            examples,
            gender: sheetName.includes('男') ? 'male' : (sheetName.includes('女') ? 'female' : 'both')
        });
    }

    const newWs = xlsx.utils.aoa_to_sheet(newData);
    newWs['!cols'] = [{ wch: 15 }, { wch: 5 }, { wch: 10 }, { wch: 100 }];
    xlsx.utils.book_append_sheet(newWb, newWs, sheetName);
});

// Sort appData: popular ones first, then count descending
appData.sort((a, b) => {
    if (a.popular && !b.popular) return -1;
    if (!a.popular && b.popular) return 1;
    return b.count - a.count;
});

const outExcel = '読み方リスト_精緻化済.xlsx';
const outJson = 'public/data/yomi_search_data.json';

xlsx.writeFile(newWb, outExcel);
fs.writeFileSync(outJson, JSON.stringify(appData, null, 2));

console.log(`Saved refined Excel to ${outExcel}`);
console.log(`Saved JSON data to ${outJson}`);
