const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const masterPath = path.join(root, 'public', 'data', 'kanji_data.json');
const dumpPath = path.join(root, 'dump_jinmei_Sheet1.json');
const outputPath = path.join(root, 'public', 'data', 'kanji_meaning_details.json');

function readJson(filePath) {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function clean(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
}

const master = readJson(masterPath);
const dumpRows = readJson(dumpPath);
const detailByKanji = new Map();

dumpRows.forEach((row) => {
    const kanji = clean(row['漢字']);
    const meaning = clean(row['意味']);
    if (!kanji || !meaning || detailByKanji.has(kanji)) return;
    detailByKanji.set(kanji, meaning);
});

const output = {};
let found = 0;
let richer = 0;

master.forEach((row) => {
    const kanji = clean(row['漢字']);
    const summaryMeaning = clean(row['意味']);
    const detailedMeaning = detailByKanji.get(kanji) || '';
    if (!kanji || !detailedMeaning) return;

    found += 1;
    if (detailedMeaning !== summaryMeaning && detailedMeaning.length > summaryMeaning.length) {
        richer += 1;
    }

    output[kanji] = {
        meaning: detailedMeaning
    };
});

fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({
    output: path.relative(root, outputPath),
    master: master.length,
    found,
    richer
}, null, 2));
