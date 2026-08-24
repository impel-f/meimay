const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const MASTER_PATH = path.join(ROOT, 'public', 'data', 'kanji_data.json');
const MEANINGS_PATH = path.join(ROOT, 'public', 'data', 'kanji_meaning_details.json');
const ETYMOLOGY_PATH = path.join(ROOT, 'public', 'data', 'kanji_etymology_facts.json');
const ENRICHMENT_PATH = path.join(__dirname, 'data', 'kanji_static_enrichment.json');
const OUTPUT_PATH = path.join(ROOT, 'public', 'data', 'kanji_static_details.json');

function readJson(filePath, fallback = {}) {
  return fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath, 'utf8')) : fallback;
}

function clean(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function getNameUseCategory(row) {
  if (row['常用漢字'] === true) return '常用漢字';
  if (row['常用漢字'] === false) return '人名用漢字';
  if (row['字形種別']) return clean(row['字形種別']);
  return '要確認';
}

function getFactualNamingMeaning(value) {
  const firstSentence = clean(value).split('。').map(clean).find(Boolean) || '';
  return `${firstSentence
    .replace(/を表す名づけに用いられる$/, 'を表す')
    .replace(/名づけに用いられる$/, '名づけに使われる')
  }。`;
}

function main() {
  const master = readJson(MASTER_PATH, []);
  const meanings = readJson(MEANINGS_PATH, {});
  const etymologies = readJson(ETYMOLOGY_PATH, { entries: {} }).entries || {};
  const enrichment = readJson(ENRICHMENT_PATH, {});
  const entries = {};

  for (const row of master) {
    const kanji = clean(row['漢字']);
    const etymology = etymologies[kanji] || {};
    const enriched = enrichment[kanji] || {};
    const meaningDetail = clean(meanings[kanji]?.meaning || row['意味']);
    if (!kanji || !meaningDetail || !clean(etymology.fixedOriginText)) {
      throw new Error(`${kanji || '(empty)'}: static detail source is incomplete`);
    }
    if (!clean(enriched.namingMeaning)) {
      throw new Error(`${kanji}: static enrichment is missing`);
    }

    entries[kanji] = {
      meaningSummary: clean(row['意味']),
      meaningDetail,
      // A single factual sentence belongs here; wishes are composed for the full name elsewhere.
      namingMeaning: getFactualNamingMeaning(enriched.namingMeaning),
      readings: {
        on: clean(row['音']),
        kun: clean(row['訓']),
        nanori: clean(row['伝統名のり']),
      },
      strokes: Number(row['画数']) || 0,
      nameUse: {
        category: getNameUseCategory(row),
        glyphType: clean(row['字形種別']),
        standardForm: clean(row['標準字体']),
      },
      etymology: {
        text: clean(etymology.fixedOriginText),
        formationTypes: Array.isArray(etymology.formationTypes) ? etymology.formationTypes : [],
        reviewStatus: clean(etymology.verificationStatus),
      },
      compounds: (Array.isArray(enriched.compounds) ? enriched.compounds : []).slice(0, 3),
    };
  }

  const output = {
    schemaVersion: 1,
    generatedFrom: [
      'kanji_data.json',
      'kanji_meaning_details.json',
      'kanji_etymology_facts.json',
      'kanji_static_enrichment.json',
    ],
    entries,
  };
  fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(output)}\n`, 'utf8');
  console.log(`Wrote ${path.relative(ROOT, OUTPUT_PATH)} (${Object.keys(entries).length} entries)`);
}

main();
