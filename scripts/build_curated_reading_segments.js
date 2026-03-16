const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const ROOT = path.resolve(__dirname, '..');
const REVIEW_XLSX_PATH = path.join(ROOT, 'reading_segment_review.xlsx');
const RULES_JSON_PATH = path.join(ROOT, 'public', 'data', 'reading_segment_rules.json');
const REVIEW_SHEET_NAME = 'segments_freq';
const CANDIDATE_COLUMNS = ['candidate_1', 'candidate_2', 'candidate_3', 'candidate_4'];

function normalizeReading(value) {
  return String(value || '')
    .normalize('NFKC')
    .replace(/[\u30a1-\u30f6]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0x60))
    .replace(/[^\u3041-\u3093\u30fc]/g, '');
}

function normalizeKanji(value) {
  return String(value || '').trim();
}

function loadReviewWorkbook(filePath) {
  const workbook = XLSX.readFile(filePath);
  const worksheet = workbook.Sheets[REVIEW_SHEET_NAME];

  if (!worksheet) {
    throw new Error(`Missing sheet: ${REVIEW_SHEET_NAME}`);
  }

  const rows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
  const approvedSegments = new Map();
  const disabledSegments = new Set();
  const warnings = [];

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const segment = normalizeReading(row.segment);
    if (!segment) return;

    const candidates = CANDIDATE_COLUMNS
      .map((column) => normalizeKanji(row[column]))
      .filter(Boolean);

    if (candidates.length === 0) {
      disabledSegments.add(segment);
      return;
    }

    if (candidates.length > 4) {
      warnings.push(`Row ${rowNumber}: ${segment} has more than 4 candidates.`);
    }

    const dedupedCandidates = [...new Set(candidates)].slice(0, 4);
    if (dedupedCandidates.length !== candidates.length) {
      warnings.push(`Row ${rowNumber}: ${segment} had duplicate candidates and was deduped.`);
    }

    approvedSegments.set(segment, dedupedCandidates);
    disabledSegments.delete(segment);
  });

  return {
    approvedSegments,
    disabledSegments,
    warnings,
  };
}

function writeRulesJson(approvedSegments, disabledSegments) {
  const rules = {
    generatedAt: new Date().toISOString(),
    sourceWorkbook: path.basename(REVIEW_XLSX_PATH),
    sourceSheet: REVIEW_SHEET_NAME,
    reviewPolicy: {
      baseline: 'male_shared',
      appliesToGenders: ['male', 'female', 'neutral'],
      disabledSegmentBehavior: 'skip_segment',
      maxCandidatesPerSegment: 4,
    },
    approvedSegments: Object.fromEntries(
      [...approvedSegments.entries()].sort((a, b) => a[0].localeCompare(b[0], 'ja')),
    ),
    disabledSegments: [...disabledSegments].sort((a, b) => a.localeCompare(b, 'ja')),
  };

  fs.writeFileSync(RULES_JSON_PATH, JSON.stringify(rules, null, 2) + '\n', 'utf8');
  return rules;
}

function main() {
  const { approvedSegments, disabledSegments, warnings } = loadReviewWorkbook(REVIEW_XLSX_PATH);
  const rules = writeRulesJson(approvedSegments, disabledSegments);

  console.log(`Wrote curated segment rules to ${RULES_JSON_PATH}`);
  console.log(
    JSON.stringify(
      {
        approvedSegments: Object.keys(rules.approvedSegments).length,
        disabledSegments: rules.disabledSegments.length,
        policy: rules.reviewPolicy,
        warnings,
      },
      null,
      2,
    ),
  );
}

main();
