const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const MASTER_PATH = path.join(ROOT, 'public', 'data', 'kanji_data.json');
const MEANINGS_PATH = path.join(ROOT, 'public', 'data', 'kanji_meaning_details.json');
const ETYMOLOGY_PATH = path.join(ROOT, 'public', 'data', 'kanji_etymology_facts.json');
const ENRICHMENT_PATH = path.join(__dirname, 'data', 'kanji_static_enrichment.json');
const CODEX_REVIEW_PATH = path.join(__dirname, 'data', 'kanji_static_codex_reviews.json');
const MANUAL_COMPOUND_REVIEW_PATH = path.join(__dirname, 'data', 'kanji_compound_manual_reviews.json');
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

const NAMING_IMPRESSION_BY_TAG = {
  '#伝統': '受け継がれてきた趣や、時代を越えて親しまれる印象',
  '#信念': '芯の強さや、自分の考えを大切にする印象',
  '#勇壮': '力強さや、勇ましく堂々とした印象',
  '#品格': '落ち着きや、品のある端正な印象',
  '#天空': '大空を思わせる開放感や、広がりのある印象',
  '#奏楽': '音の響きや、豊かな感性を思わせる印象',
  '#希望': '明るい未来や、前向きな可能性を感じさせる印象',
  '#幸福': '喜びや、穏やかな幸せを感じさせる印象',
  '#慈愛': '思いやりや、やさしく包み込む印象',
  '#水景': '澄んだ水や流れを思わせる、清らかな印象',
  '#知性': '聡明さや、深く考える力を感じさせる印象',
  '#自然': '草木や季節など、自然の豊かさを感じさせる印象',
  '#色彩': '色の美しさや、鮮やかな個性を感じさせる印象',
  '#調和': '人とのつながりや、穏やかに調和する印象',
  '#飛躍': 'のびやかな成長や、前へ進む力を感じさせる印象',
};

function buildMeaningDeepDive(namingMeaning, classification) {
  const factualMeaning = getFactualNamingMeaning(namingMeaning);
  const primaryTag = clean(classification).split(/\s+/).find((tag) => NAMING_IMPRESSION_BY_TAG[tag]);
  const impression = NAMING_IMPRESSION_BY_TAG[primaryTag];
  return impression
    ? `${factualMeaning}名前では、${impression}につながります。`
    : factualMeaning;
}

function getReviewedCompounds(kanji, enrichment, codexReviews, manualCompoundReviews) {
  const manualCompounds = manualCompoundReviews[kanji];
  if (Array.isArray(manualCompounds) && manualCompounds.length) {
    return manualCompounds.map(({ sourceUrl, ...compound }) => compound);
  }
  const review = codexReviews[kanji]?.status === 'reviewed' ? codexReviews[kanji] : {};
  const enriched = enrichment[kanji] || {};
  return Array.isArray(review.compounds) ? review.compounds : enriched.compounds;
}

function main() {
  const master = readJson(MASTER_PATH, []);
  const meanings = readJson(MEANINGS_PATH, {});
  const etymologies = readJson(ETYMOLOGY_PATH, { entries: {} }).entries || {};
  const enrichment = readJson(ENRICHMENT_PATH, {});
  const codexReviews = readJson(CODEX_REVIEW_PATH, { entries: {} }).entries || {};
  const manualCompoundReviewFile = readJson(MANUAL_COMPOUND_REVIEW_PATH, { entries: {}, unlistedReasons: {} });
  const manualCompoundReviews = manualCompoundReviewFile.entries || {};
  const unlistedCompoundReasons = manualCompoundReviewFile.unlistedReasons || {};
  const entries = {};

  for (const row of master) {
    const kanji = clean(row['漢字']);
    const etymology = etymologies[kanji] || {};
    const enriched = enrichment[kanji] || {};
    const review = codexReviews[kanji]?.status === 'reviewed' ? codexReviews[kanji] : {};
    const meaningDetail = clean(meanings[kanji]?.meaning || row['意味']);
    const fixedOriginText = clean(review.etymologyText || etymology.fixedOriginText);
    const namingMeaning = clean(review.namingMeaning || enriched.namingMeaning);
    const ownCompounds = getReviewedCompounds(kanji, enrichment, codexReviews, manualCompoundReviews);
    const standardKanji = clean(row['標準字体']);
    const standardCompounds = standardKanji
      ? getReviewedCompounds(standardKanji, enrichment, codexReviews, manualCompoundReviews)
      : [];
    const compounds = Array.isArray(ownCompounds) && ownCompounds.length
      ? ownCompounds
      : standardCompounds;
    const compoundNotice = clean(unlistedCompoundReasons[kanji]?.displayText);
    if (!kanji || !meaningDetail || !fixedOriginText) {
      throw new Error(`${kanji || '(empty)'}: static detail source is incomplete`);
    }
    if (!namingMeaning) {
      throw new Error(`${kanji}: static enrichment is missing`);
    }

    entries[kanji] = {
      meaningSummary: clean(row['意味']),
      meaningDetail,
      // A single factual sentence belongs here; wishes are composed for the full name elsewhere.
      namingMeaning: getFactualNamingMeaning(namingMeaning),
      meaningDeepDive: buildMeaningDeepDive(namingMeaning, row['分類']),
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
        text: fixedOriginText,
        formationTypes: Array.isArray(etymology.formationTypes) ? etymology.formationTypes : [],
        reviewStatus: clean(etymology.verificationStatus),
      },
      compounds: (Array.isArray(compounds) ? compounds : []).slice(0, 3),
      ...(compoundNotice ? { compoundNotice } : {}),
    };
  }

  const output = {
    schemaVersion: 1,
    generatedFrom: [
      'kanji_data.json',
      'kanji_meaning_details.json',
      'kanji_etymology_facts.json',
      'kanji_static_enrichment.json',
      'kanji_static_codex_reviews.json',
      'kanji_compound_manual_reviews.json',
    ],
    entries,
  };
  fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(output)}\n`, 'utf8');
  console.log(`Wrote ${path.relative(ROOT, OUTPUT_PATH)} (${Object.keys(entries).length} entries)`);
}

main();
