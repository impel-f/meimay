const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

const ROOT_DIR = path.join(__dirname, '..');
const SRC_OUTPUT_PATH = path.join(ROOT_DIR, 'src', 'data', 'readings_data.json');
const PUBLIC_OUTPUT_PATH = path.join(ROOT_DIR, 'public', 'data', 'readings_data.json');
const KANJI_DATA_PATH = path.join(ROOT_DIR, 'public', 'data', 'kanji_data.json');
const POPULAR_GENDER_DOMINANCE_RATIO = 4;
const POPULAR_GENDER_MINOR_COUNT_LIMIT = 5;
const STRONG_GENDER_DOMINANCE_RATIO = 12;
const STRONG_GENDER_MINOR_COUNT_LIMIT = 10;
const READING_GENDER_OVERRIDES = new Map([
    ['こう', 'male'],
    ['しゅう', 'male']
]);

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

function toHira(value) {
    return String(value || '')
        .normalize('NFKC')
        .replace(/[\u30a1-\u30f6]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0x60));
}

function normalizeReading(value) {
    return toHira(value)
        .replace(/[っッ]/g, 'つ')
        .replace(/\s+/g, '')
        .replace(/[^\u3041-\u3093\u30fc]/g, '');
}

function splitReadingEntries(value) {
    return String(value || '')
        .split(/[、,，\s/]+/)
        .map((entry) => entry.trim())
        .filter(Boolean);
}

function getReadingForms(value, includeStem = false) {
    const forms = new Set();

    splitReadingEntries(value).forEach((entry) => {
        const hira = toHira(entry);
        const full = normalizeReading(hira);
        if (full) forms.add(full);

        if (!includeStem) return;

        const stemBreaks = ['.', '（', '(']
            .map((marker) => hira.indexOf(marker))
            .filter((index) => index > 0);
        if (stemBreaks.length === 0) return;

        const stem = normalizeReading(hira.slice(0, Math.min(...stemBreaks)));
        if (stem) forms.add(stem);
    });

    return [...forms];
}

function buildKanjiReadingMap() {
    if (!fs.existsSync(KANJI_DATA_PATH)) return new Map();

    const kanjiData = JSON.parse(fs.readFileSync(KANJI_DATA_PATH, 'utf8'));
    const map = new Map();
    kanjiData.forEach((item) => {
        const kanji = String(item['漢字'] || '').trim();
        if (!kanji) return;
        const readings = new Set([
            ...getReadingForms(`${item['音'] || ''},${item['訓'] || ''}`, true),
            ...getReadingForms(item['伝統名のり'] || '', false)
        ]);
        map.set(kanji, [...readings]);
    });
    return map;
}

const KANJI_RE = /[\u3400-\u9fff々〆ヵヶ]+/g;
const KANJI_TOKEN_RE = /^[\u3400-\u9fff々〆ヵヶ]+$/;
const KANJI_READING_MAP = buildKanjiReadingMap();
const LEADING_SUFFIX_KANJI = new Set(['子', '男', '夫', '女']);
const READING_EXAMPLE_EXCLUSIONS = new Map([
    ['こう', new Set(['倖幸'])],
    ['さき', new Set(['未来', '咲早', '喜咲'])],
    ['ゆいか', new Set(['花由', '衣歌'])],
    ['いおり', new Set(['庵利', '織衣', '唯央', '里伊'])],
    ['ほのか', new Set(['花穂', '香歩', '萌乃'])],
    ['しおり', new Set(['里史'])],
    ['みゆ', new Set(['自由'])],
    ['りく', new Set(['大地'])],
    ['るい', new Set(['塁瑠', '偉類'])],
    ['とき', new Set(['揮翔', '喜翔', '妃翔', '翔葵'])],
    ['ななみ', new Set(['美七', '奈美'])],
    ['ななこ', new Set(['虹七'])]
]);

function isKanjiToken(value) {
    return KANJI_TOKEN_RE.test(String(value || '').trim());
}

function getKanjiOnlyToken(value) {
    const pieces = String(value || '').match(KANJI_RE);
    return pieces ? pieces.join('') : '';
}

function isValidExampleNameToken(value, reading = '') {
    const token = String(value || '').trim();
    if (!isKanjiToken(token)) return false;
    const normalizedReading = normalizeReading(reading);
    if (normalizedReading && READING_EXAMPLE_EXCLUSIONS.get(normalizedReading)?.has(token)) return false;
    if (token.startsWith('々')) return false;
    if (token.length > 1 && LEADING_SUFFIX_KANJI.has(Array.from(token)[0])) return false;

    const chars = Array.from(token);
    if (chars.length >= 2 && !token.includes('々') && chars.every((char) => char === chars[0])) {
        return false;
    }

    return true;
}

function canReadKanjiNameAs(name, reading) {
    const target = normalizeReading(reading);
    if (!target || !isKanjiToken(name) || KANJI_READING_MAP.size === 0) return false;

    const chars = Array.from(name);
    const memo = new Map();

    function walk(index, position) {
        const key = `${index}:${position}`;
        if (memo.has(key)) return memo.get(key);
        if (index >= chars.length) return position === target.length;

        const readings = chars[index] === '々' && index > 0
            ? (KANJI_READING_MAP.get(chars[index - 1]) || [])
            : (KANJI_READING_MAP.get(chars[index]) || []);
        const matched = readings.some((candidate) =>
            candidate && target.startsWith(candidate, position) && walk(index + 1, position + candidate.length)
        );
        memo.set(key, matched);
        return matched;
    }

    return walk(0, 0);
}

function splitExamples(value, reading) {
    if (typeof value !== 'string') return [];
    const chunks = value
        .split(/[\s\u3000,、/]+/)
        .map(getKanjiOnlyToken)
        .filter(Boolean);

    const examples = [];
    const seen = new Set();
    let index = 0;

    function addExample(example) {
        if (!isValidExampleNameToken(example, reading) || seen.has(example)) return;
        seen.add(example);
        examples.push(example);
    }

    while (index < chunks.length) {
        let merged = '';
        let mergeLength = 0;
        for (let length = Math.min(4, chunks.length - index); length >= 2; length--) {
            const candidate = chunks.slice(index, index + length).join('');
            if (canReadKanjiNameAs(candidate, reading)) {
                merged = candidate;
                mergeLength = length;
                break;
            }
        }

        if (merged) {
            addExample(merged);
            index += mergeLength;
            continue;
        }

        const current = chunks[index];
        if ((current.includes('々') && canReadKanjiNameAs(current, reading))
            || (!current.includes('々') && (Array.from(current).length > 1 || canReadKanjiNameAs(current, reading)))) {
            addExample(current);
        }
        index += 1;
    }

    return examples;
}

function getBlankGenderStats() {
    return {
        male: { count: 0, popular: false },
        female: { count: 0, popular: false }
    };
}

function getSourceStats(entry) {
    const stats = getBlankGenderStats();
    if (entry.sourceGender === 'male' || entry.sourceGender === 'female') {
        stats[entry.sourceGender] = {
            count: entry.count || 0,
            popular: !!entry.isPopular
        };
    }
    return stats;
}

function mergeSourceStats(a = getBlankGenderStats(), b = getBlankGenderStats()) {
    return {
        male: {
            count: (a.male?.count || 0) + (b.male?.count || 0),
            popular: !!(a.male?.popular || b.male?.popular)
        },
        female: {
            count: (a.female?.count || 0) + (b.female?.count || 0),
            popular: !!(a.female?.popular || b.female?.popular)
        }
    };
}

function getDominantGender(stats = getBlankGenderStats()) {
    const male = stats.male || { count: 0, popular: false };
    const female = stats.female || { count: 0, popular: false };
    const maleCount = male.count || 0;
    const femaleCount = female.count || 0;

    if (male.popular && !female.popular && (maleCount >= femaleCount * POPULAR_GENDER_DOMINANCE_RATIO || femaleCount <= POPULAR_GENDER_MINOR_COUNT_LIMIT)) {
        return 'male';
    }

    if (female.popular && !male.popular && (femaleCount >= maleCount * POPULAR_GENDER_DOMINANCE_RATIO || maleCount <= POPULAR_GENDER_MINOR_COUNT_LIMIT)) {
        return 'female';
    }

    const minorCount = Math.min(maleCount, femaleCount);
    const majorCount = Math.max(maleCount, femaleCount);
    const ratio = majorCount / Math.max(1, minorCount);
    if (ratio >= STRONG_GENDER_DOMINANCE_RATIO && minorCount <= STRONG_GENDER_MINOR_COUNT_LIMIT) {
        return maleCount > femaleCount ? 'male' : 'female';
    }

    return '';
}

function getReadingGenderOverride(reading) {
    const gender = READING_GENDER_OVERRIDES.get(String(reading || '').trim());
    return gender === 'male' || gender === 'female' || gender === 'neutral' ? gender : '';
}

function cleanTagsForGender(tags, gender) {
    const normalizedTags = Array.isArray(tags) ? tags : [];
    if (gender === 'neutral') return normalizedTags;
    return normalizedTags.filter((tag) => tag !== '#中性的');
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
                examples: splitExamples(String(row['名前例'] || ''), reading),
                gender: hasNeutralFlag ? 'neutral' : baseGender,
                isNeutral: hasNeutralFlag,
                tags: splitTags(row.tags),
                adana: String(row['あだな'] || '').trim(),
                sourceGender: baseGender
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
                tags: [...entry.tags],
                sourceStats: getSourceStats(entry)
            });
            return;
        }

        const mergedExamples = [...new Set([...existing.examples, ...entry.examples])];
        const mergedTags = [...new Set([...existing.tags, ...entry.tags])];
        const mergedGender = existing.gender === entry.gender ? existing.gender : 'neutral';
        const sourceStats = mergeSourceStats(existing.sourceStats, getSourceStats(entry));

        merged.set(entry.reading, {
            reading: entry.reading,
            isPopular: existing.isPopular || entry.isPopular,
            count: existing.count + entry.count,
            examples: mergedExamples,
            gender: mergedGender,
            isNeutral: existing.isNeutral || entry.isNeutral || mergedGender === 'neutral',
            tags: mergedTags,
            adana: existing.adana || entry.adana || '',
            sourceStats
        });
    });

    return [...merged.values()]
        .map((entry) => {
            const genderOverride = getReadingGenderOverride(entry.reading);
            const dominantGender = genderOverride || (entry.gender === 'neutral' ? getDominantGender(entry.sourceStats) : '');
            const gender = dominantGender || entry.gender;
            return {
                ...entry,
                gender,
                isNeutral: gender === 'neutral',
                tags: cleanTagsForGender(entry.tags, gender)
            };
        })
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
