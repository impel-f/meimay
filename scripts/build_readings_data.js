const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

const ROOT_DIR = path.join(__dirname, '..');
const SRC_OUTPUT_PATH = path.join(ROOT_DIR, 'src', 'data', 'readings_data.json');
const PUBLIC_OUTPUT_PATH = path.join(ROOT_DIR, 'public', 'data', 'readings_data.json');

function findSourceWorkbookPath() {
    const candidates = fs.readdirSync(ROOT_DIR)
        .filter((name) => name.toLowerCase().endsWith('.xlsx'))
        .map((name) => path.join(ROOT_DIR, name));

    for (const candidate of candidates) {
        try {
            const workbook = xlsx.readFile(candidate);
            if (!workbook.SheetNames.includes('male_yomi') || !workbook.SheetNames.includes('female_yomi')) {
                continue;
            }

            const maleRows = xlsx.utils.sheet_to_json(workbook.Sheets.male_yomi, { defval: '' });
            const firstRow = maleRows[0] || {};
            if (Object.prototype.hasOwnProperty.call(firstRow, 'tags')) {
                return candidate;
            }
        } catch (error) {
            console.warn(`Skipping workbook ${path.basename(candidate)}: ${error.message}`);
        }
    }

    throw new Error('読み方リストのタグ付き Excel が見つかりませんでした');
}

function splitTags(value) {
    if (typeof value !== 'string') return [];
    return value
        .split(/[\s\u3000]+/)
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0 && tag.startsWith('#'));
}

function splitExamples(value) {
    if (typeof value !== 'string') return [];
    return value
        .split(/[\s\u3000,、/]+/)
        .map((name) => name.trim())
        .filter(Boolean);
}

function parseSheetRows(rows, baseGender) {
    return rows
        .map((row) => {
            const reading = String(row['読み'] || '').trim();
            if (!reading) return null;

            const hasNeutralFlag = String(row['中性フラグ'] || '').trim().length > 0;

            return {
                reading,
                isPopular: String(row['人気'] || '').trim() === '〇',
                count: Number(row['件数']) || 0,
                examples: splitExamples(String(row['名前例'] || '')),
                gender: hasNeutralFlag ? 'neutral' : baseGender,
                isNeutral: hasNeutralFlag,
                tags: splitTags(row.tags),
                adana: String(row['あだな'] || '').trim()
            };
        })
        .filter(Boolean);
}

function mergeReadings(entries) {
    const merged = new Map();

    entries.forEach((entry) => {
        const existing = merged.get(entry.reading);
        if (!existing) {
            merged.set(entry.reading, {
                ...entry,
                examples: [...entry.examples],
                tags: [...entry.tags]
            });
            return;
        }

        const mergedExamples = [...new Set([...existing.examples, ...entry.examples])];
        const mergedTags = [...new Set([...existing.tags, ...entry.tags])];
        const mergedGender = existing.gender === entry.gender ? existing.gender : 'neutral';

        merged.set(entry.reading, {
            reading: entry.reading,
            isPopular: existing.isPopular || entry.isPopular,
            count: existing.count + entry.count,
            examples: mergedExamples,
            gender: mergedGender,
            isNeutral: existing.isNeutral || entry.isNeutral || mergedGender === 'neutral',
            tags: mergedTags,
            adana: existing.adana || entry.adana || ''
        });
    });

    return [...merged.values()]
        .sort((a, b) => {
            if (a.isPopular !== b.isPopular) return a.isPopular ? -1 : 1;
            if (a.count !== b.count) return b.count - a.count;
            return a.reading.localeCompare(b.reading, 'ja');
        })
        .map((entry) => ({
            reading: entry.reading,
            isPopular: entry.isPopular,
            count: entry.count,
            examples: entry.examples.join(' '),
            gender: entry.gender,
            isNeutral: entry.isNeutral,
            tags: entry.tags,
            adana: entry.adana
        }));
}

function writeJson(filePath, data) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function main() {
    const workbookPath = findSourceWorkbookPath();
    console.log(`Reading workbook: ${path.basename(workbookPath)}`);

    const workbook = xlsx.readFile(workbookPath);
    const maleRows = xlsx.utils.sheet_to_json(workbook.Sheets.male_yomi, { defval: '' });
    const femaleRows = xlsx.utils.sheet_to_json(workbook.Sheets.female_yomi, { defval: '' });

    const merged = mergeReadings([
        ...parseSheetRows(maleRows, 'male'),
        ...parseSheetRows(femaleRows, 'female')
    ]);

    writeJson(SRC_OUTPUT_PATH, merged);
    writeJson(PUBLIC_OUTPUT_PATH, merged);

    const stats = merged.reduce((acc, entry) => {
        acc[entry.gender] = (acc[entry.gender] || 0) + 1;
        return acc;
    }, { male: 0, female: 0, neutral: 0 });

    console.log(`Wrote ${merged.length} readings to ${SRC_OUTPUT_PATH}`);
    console.log(`Wrote ${merged.length} readings to ${PUBLIC_OUTPUT_PATH}`);
    console.log(`Gender breakdown: male=${stats.male}, female=${stats.female}, neutral=${stats.neutral}`);
}

main();
