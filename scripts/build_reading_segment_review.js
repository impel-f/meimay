const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'public', 'data');
const MASTER_PATH = path.join(DATA_DIR, 'kanji_data.json');
const READINGS_PATH = path.join(DATA_DIR, 'readings_data.json');
const CSV_PATH = path.join(ROOT, 'reading_segment_review.csv');
const XLSX_PATH = path.join(ROOT, 'reading_segment_review.xlsx');

const KANJI_KEY = '\u6f22\u5b57';
const ON_KEY = '\u97f3';
const KUN_KEY = '\u8a13';
const NANORI_KEY = '\u4f1d\u7d71\u540d\u306e\u308a';
const RECOMMEND_KEY = '\u304a\u3059\u3059\u3081\u5ea6';
const MALE_RECOMMEND_KEY = '\u7537\u306e\u304a\u3059\u3059\u3081\u5ea6';
const FEMALE_RECOMMEND_KEY = '\u5973\u306e\u304a\u3059\u3059\u3081\u5ea6';
const INAPPROPRIATE_KEY = '\u4e0d\u9069\u5207\u30d5\u30e9\u30b0';

const DAKUTEN_TO_SEION = {
  '\u304c': '\u304b',
  '\u304e': '\u304d',
  '\u3050': '\u304f',
  '\u3052': '\u3051',
  '\u3054': '\u3053',
  '\u3056': '\u3055',
  '\u3058': '\u3057',
  '\u305a': '\u3059',
  '\u305c': '\u305b',
  '\u305e': '\u305d',
  '\u3060': '\u305f',
  '\u3062': '\u3061',
  '\u3065': '\u3064',
  '\u3067': '\u3066',
  '\u3069': '\u3068',
  '\u3070': '\u306f',
  '\u3073': '\u3072',
  '\u3076': '\u3075',
  '\u3079': '\u3078',
  '\u307c': '\u307b',
  '\u3071': '\u306f',
  '\u3074': '\u3072',
  '\u3077': '\u3075',
  '\u307a': '\u3078',
  '\u307d': '\u307b',
};

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function toHira(value) {
  return String(value || '')
    .normalize('NFKC')
    .replace(/[\u30a1-\u30f6]/g, (char) =>
      String.fromCharCode(char.charCodeAt(0) - 0x60),
    );
}

function normalizeReading(value) {
  return toHira(value).replace(/[^\u3041-\u3093\u30fc]/g, '');
}

function toSeion(value) {
  return Array.from(String(value || ''))
    .map((char) => DAKUTEN_TO_SEION[char] || char)
    .join('');
}

function isInvalidReadingSegment(part) {
  return !part || /^[\u3093\u3041\u3043\u3045\u3047\u3049\u3083\u3085\u3087\u308e\u3063]/.test(part);
}

function splitReadingIntoMoraUnits(rawReading) {
  const reading = normalizeReading(rawReading);
  const units = [];

  Array.from(reading).forEach((char) => {
    if (/^[\u3083\u3085\u3087\u3041\u3043\u3045\u3047\u3049\u308e]$/.test(char) && units.length > 0) {
      units[units.length - 1] += char;
      return;
    }

    units.push(char);
  });

  return units;
}

function isInappropriate(item) {
  const flag = item[INAPPROPRIATE_KEY];
  return !!(flag && flag !== '0' && flag !== 'false' && flag !== 'FALSE');
}

function getRecommendationScore(item) {
  const allScore = parseInt(item[RECOMMEND_KEY], 10) || 0;
  const maleScore = parseInt(item[MALE_RECOMMEND_KEY], 10) || 0;
  const femaleScore = parseInt(item[FEMALE_RECOMMEND_KEY], 10) || 0;

  return allScore * 100 + Math.max(maleScore, femaleScore) * 10;
}

function splitKanjiReadings(item, keys) {
  return keys
    .map((key) => item[key] || '')
    .join(',')
    .split(/[\u3001,\uff0c\s/]+/)
    .map((value) => normalizeReading(String(value || '').trim()))
    .filter(Boolean);
}

function buildKanjiCandidatesBySegment(master) {
  const segmentMap = new Map();
  const validReadingsSet = new Set();

  master.forEach((item) => {
    if (isInappropriate(item)) return;

    const kanji = String(item[KANJI_KEY] || '').trim();
    if (!kanji) return;

    const majorReadings = splitKanjiReadings(item, [ON_KEY, KUN_KEY]);
    const minorReadings = splitKanjiReadings(item, [NANORI_KEY]);
    const score = getRecommendationScore(item);

    [...majorReadings, ...minorReadings].forEach((reading) => {
      validReadingsSet.add(reading);
    });

    const seenForKanji = new Set();

    majorReadings.forEach((reading) => {
      if (Array.from(reading).length > 3 || isInvalidReadingSegment(reading)) return;
      if (seenForKanji.has(`major:${reading}`)) return;
      seenForKanji.add(`major:${reading}`);
      upsertSegmentCandidate(segmentMap, reading, {
        kanji,
        tier: 1,
        score,
      });
    });

    minorReadings.forEach((reading) => {
      if (Array.from(reading).length > 3 || isInvalidReadingSegment(reading)) return;
      if (seenForKanji.has(`minor:${reading}`)) return;
      seenForKanji.add(`minor:${reading}`);
      upsertSegmentCandidate(segmentMap, reading, {
        kanji,
        tier: 2,
        score,
      });
    });
  });

  segmentMap.forEach((value, key) => {
    const sorted = [...value.values()].sort((a, b) => {
      if (a.tier !== b.tier) return a.tier - b.tier;
      if (a.score !== b.score) return b.score - a.score;
      return a.kanji.localeCompare(b.kanji, 'ja');
    });
    segmentMap.set(key, sorted);
  });

  return {
    segmentMap,
    validReadingsSet,
  };
}

function upsertSegmentCandidate(segmentMap, reading, nextCandidate) {
  if (!segmentMap.has(reading)) {
    segmentMap.set(reading, new Map());
  }

  const byKanji = segmentMap.get(reading);
  const existing = byKanji.get(nextCandidate.kanji);
  if (!existing) {
    byKanji.set(nextCandidate.kanji, nextCandidate);
    return;
  }

  if (nextCandidate.tier < existing.tier) {
    byKanji.set(nextCandidate.kanji, nextCandidate);
    return;
  }

  if (nextCandidate.tier === existing.tier && nextCandidate.score > existing.score) {
    byKanji.set(nextCandidate.kanji, nextCandidate);
  }
}

function hasExactKanjiForReading(part, segmentCandidates) {
  return segmentCandidates.has(part);
}

function getFallbackReadingSegmentPaths(rawReading, segmentCandidates, limit = 5) {
  const units = splitReadingIntoMoraUnits(rawReading);
  if (!units.length) return [];

  const candidates = [];
  const pushPath = (path) => {
    if (!Array.isArray(path) || path.length === 0 || path.length > 3) return;
    if (path.some(isInvalidReadingSegment)) return;
    if (path.some((segment) => !hasExactKanjiForReading(segment, segmentCandidates))) return;
    candidates.push(path);
  };

  pushPath([units.join('')]);

  for (let index = 1; index < units.length; index += 1) {
    pushPath([units.slice(0, index).join(''), units.slice(index).join('')]);
  }

  for (let first = 1; first < units.length - 1; first += 1) {
    for (let second = first + 1; second < units.length; second += 1) {
      pushPath([
        units.slice(0, first).join(''),
        units.slice(first, second).join(''),
        units.slice(second).join(''),
      ]);
    }
  }

  const scored = candidates
    .map((path) => {
      let score = 0;
      if (path.length === 2) score += 2000;
      else if (path.length === 3) score += 1800;
      else score += 400;

      path.forEach((segment) => {
        const length = Array.from(segment).length;
        if (length === 2) score += 450;
        else if (length === 3) score += 320;
        else if (length === 1) score += 80;
      });

      return { path, score };
    })
    .sort((a, b) => b.score - a.score);

  return uniquePaths(scored.map((item) => item.path)).slice(0, limit);
}

function getReadingSegmentPaths(rawReading, validReadingsSet, segmentCandidates, limit = 5) {
  const reading = normalizeReading(rawReading);
  if (!reading || !/^[\u3041-\u3093]+$/.test(reading)) {
    return [];
  }

  const allPaths = [];

  function canUseReadingSegment(part) {
    if (isInvalidReadingSegment(part)) return false;

    const partSeion = toSeion(part);
    const partSokuon = part.replace(/\u3063$/, '\u3064');
    const hasStrictReading =
      validReadingsSet.has(part) ||
      validReadingsSet.has(partSeion) ||
      (partSokuon !== part && validReadingsSet.has(partSokuon));

    return hasStrictReading && hasExactKanjiForReading(part, segmentCandidates);
  }

  function findPath(remaining, currentPath) {
    if (currentPath.length > 3) return;

    if (!remaining.length) {
      if (currentPath.length >= 1) {
        allPaths.push([...currentPath]);
      }
      return;
    }

    for (let length = 1; length <= Math.min(3, remaining.length); length += 1) {
      const part = remaining.slice(0, length);
      if (!canUseReadingSegment(part)) continue;
      currentPath.push(part);
      findPath(remaining.slice(length), currentPath);
      currentPath.pop();
    }
  }

  findPath(reading, []);

  const scored = allPaths
    .map((path) => {
      let score = 0;

      if (path.length === 2) score += 2000;
      else if (path.length === 3) score += 1800;
      else if (path.length === 1) score += 500;

      path.forEach((segment) => {
        const length = Array.from(segment).length;
        if (length === 2) score += 500;
        if (length === 1) {
          if (['\u305f', '\u307e', '\u3068', '\u306e', '\u304b', '\u307b', '\u3072', '\u307f', '\u306a', '\u308a', '\u3055', '\u3053', '\u3042'].includes(segment)) {
            score += 200;
          } else {
            score += 50;
          }
        }
      });

      let singleCombo = 0;
      let maxSingleCombo = 0;
      path.forEach((segment) => {
        if (Array.from(segment).length === 1) singleCombo += 1;
        else singleCombo = 0;
        maxSingleCombo = Math.max(maxSingleCombo, singleCombo);
      });
      if (maxSingleCombo >= 3) score -= 3000;

      return { path, score };
    })
    .sort((a, b) => b.score - a.score);

  const unique = uniquePaths(scored.filter((item) => item.score > -1000).map((item) => item.path));
  if (unique.length > 0) {
    return unique.slice(0, limit);
  }

  return getFallbackReadingSegmentPaths(reading, segmentCandidates, limit);
}

function uniquePaths(paths) {
  const seen = new Set();
  const unique = [];

  paths.forEach((path) => {
    const key = JSON.stringify(path);
    if (seen.has(key)) return;
    seen.add(key);
    unique.push(path);
  });

  return unique;
}

function aggregateReadings(readingsData) {
  const map = new Map();

  readingsData.forEach((item) => {
    const reading = normalizeReading(item.reading || '');
    if (!reading) return;

    const nextWeight = Math.max(1, Number(item.count) || 1);
    const existing = map.get(reading) || {
      reading,
      weight: 0,
      rawExamples: [],
      exampleNames: [],
    };

    existing.weight += nextWeight;
    if (existing.rawExamples.length < 5 && !existing.rawExamples.includes(item.reading)) {
      existing.rawExamples.push(item.reading);
    }
    splitExampleNames(item.examples).forEach((exampleName) => {
      if (existing.exampleNames.length < 12 && !existing.exampleNames.includes(exampleName)) {
        existing.exampleNames.push(exampleName);
      }
    });

    map.set(reading, existing);
  });

  return [...map.values()].sort((a, b) => b.weight - a.weight);
}

function splitExampleNames(rawExamples) {
  return String(rawExamples || '')
    .split(/[\s\u3000]+/)
    .map((value) => String(value || '').trim())
    .filter(Boolean);
}

function buildSegmentReviewRows(aggregatedReadings, validReadingsSet, segmentCandidates) {
  const stats = new Map();
  const uncovered = [];
  let coveredWeight = 0;

  aggregatedReadings.forEach((entry) => {
    const paths = getReadingSegmentPaths(entry.reading, validReadingsSet, segmentCandidates, 3);
    const primaryPath = paths[0] || [];

    if (primaryPath.length === 0) {
      uncovered.push({
        reading: entry.reading,
        total_name_count: entry.weight,
        examples: entry.rawExamples.join(' / '),
      });
      return;
    }

    coveredWeight += entry.weight;
    const splitLabel = primaryPath.join('/');
    const seenSegments = new Set(primaryPath);
    const exampleEvidence = buildExampleEvidence(entry.exampleNames, primaryPath, segmentCandidates);

    seenSegments.forEach((segment) => {
      const existing = stats.get(segment) || {
        segment,
        segment_length: Array.from(segment).length,
        reading_count: 0,
        total_name_count: 0,
        example_splits: [],
        candidate_pool: segmentCandidates.get(segment) || [],
        example_kanji_counts: new Map(),
      };

      existing.reading_count += 1;
      existing.total_name_count += entry.weight;

      const displayLabel = `${entry.reading} (${splitLabel})`;
      if (existing.example_splits.length < 6 && !existing.example_splits.includes(displayLabel)) {
        existing.example_splits.push(displayLabel);
      }
      if (exampleEvidence.has(segment)) {
        const segmentEvidence = exampleEvidence.get(segment);
        segmentEvidence.forEach((count, kanji) => {
          const currentCount = existing.example_kanji_counts.get(kanji) || 0;
          existing.example_kanji_counts.set(kanji, currentCount + count);
        });
      }

      stats.set(segment, existing);
    });
  });

  const rows = [...stats.values()]
    .map((entry) => {
      const candidatePool = Array.isArray(entry.candidate_pool) ? entry.candidate_pool : [];
      const rankedCandidates = rankSegmentCandidates(candidatePool, entry.example_kanji_counts);
      const topKanji = rankedCandidates.slice(0, 4).map((candidate) => candidate.kanji);
      const reviewKanji = rankedCandidates.slice(0, 8).map((candidate) => candidate.kanji).join(' ');
      const exampleBacked = rankedCandidates
        .filter((candidate) => candidate.exampleCount > 0)
        .slice(0, 6)
        .map((candidate) => `${candidate.kanji}:${candidate.exampleCount}`)
        .join(' ');

      return {
        segment: entry.segment,
        segment_length: entry.segment_length,
        reading_count: entry.reading_count,
        total_name_count: entry.total_name_count,
        example_splits: entry.example_splits.join(' / '),
        candidate_1: topKanji[0] || '',
        candidate_2: topKanji[1] || '',
        candidate_3: topKanji[2] || '',
        candidate_4: topKanji[3] || '',
        example_backed: exampleBacked,
        review_pool: reviewKanji,
        status: '',
        notes: '',
      };
    })
    .sort((a, b) => {
      if (a.total_name_count !== b.total_name_count) return b.total_name_count - a.total_name_count;
      if (a.segment_length !== b.segment_length) return a.segment_length - b.segment_length;
      return a.segment.localeCompare(b.segment, 'ja');
    });

  return {
    rows,
    uncovered: uncovered.sort((a, b) => b.total_name_count - a.total_name_count),
    summary: {
      unique_readings: aggregatedReadings.length,
      covered_readings: aggregatedReadings.length - uncovered.length,
      uncovered_readings: uncovered.length,
      covered_weight: coveredWeight,
      unique_segments: rows.length,
    },
  };
}

function buildExampleEvidence(exampleNames, primaryPath, segmentCandidates) {
  const evidence = new Map();
  if (!Array.isArray(exampleNames) || exampleNames.length === 0) return evidence;
  if (!Array.isArray(primaryPath) || primaryPath.length === 0) return evidence;

  exampleNames.forEach((exampleName) => {
    const chars = Array.from(String(exampleName || '').trim());
    if (chars.length !== primaryPath.length) return;

    chars.forEach((kanji, index) => {
      const segment = primaryPath[index];
      const allowed = segmentCandidates.get(segment) || [];
      if (!allowed.some((candidate) => candidate.kanji === kanji)) return;

      if (!evidence.has(segment)) {
        evidence.set(segment, new Map());
      }

      const segmentEvidence = evidence.get(segment);
      const currentCount = segmentEvidence.get(kanji) || 0;
      segmentEvidence.set(kanji, currentCount + 1);
    });
  });

  return evidence;
}

function rankSegmentCandidates(candidatePool, exampleCounts) {
  const counts = exampleCounts instanceof Map ? exampleCounts : new Map();
  return candidatePool
    .map((candidate, index) => ({
      ...candidate,
      poolIndex: index,
      exampleCount: counts.get(candidate.kanji) || 0,
    }))
    .sort((a, b) => {
      if (a.exampleCount !== b.exampleCount) return b.exampleCount - a.exampleCount;
      if (a.tier !== b.tier) return a.tier - b.tier;
      if (a.score !== b.score) return b.score - a.score;
      return a.poolIndex - b.poolIndex;
    });
}

function writeCsv(rows, filePath) {
  const headers = [
    'segment',
    'segment_length',
    'reading_count',
    'total_name_count',
    'example_splits',
    'candidate_1',
    'candidate_2',
    'candidate_3',
    'candidate_4',
    'example_backed',
    'review_pool',
    'status',
    'notes',
  ];

  const csvLines = [
    headers.join(','),
    ...rows.map((row) => headers.map((header) => escapeCsvValue(row[header])).join(',')),
  ];

  fs.writeFileSync(filePath, csvLines.join('\n') + '\n', 'utf8');
}

function escapeCsvValue(value) {
  const stringValue = String(value ?? '');
  if (!/[",\n]/.test(stringValue)) return stringValue;
  return `"${stringValue.replace(/"/g, '""')}"`;
}

function writeWorkbook(rowsByFreq, uncovered, summary, filePath) {
  const workbook = XLSX.utils.book_new();

  const rowsByKana = [...rowsByFreq].sort((a, b) => a.segment.localeCompare(b.segment, 'ja'));
  const summaryRows = Object.entries(summary).map(([key, value]) => ({ key, value }));

  appendSheet(workbook, 'segments_freq', rowsByFreq);
  appendSheet(workbook, 'segments_kana', rowsByKana);
  appendSheet(workbook, 'uncovered', uncovered);
  appendSheet(workbook, 'summary', summaryRows);

  XLSX.writeFile(workbook, filePath);
}

function appendSheet(workbook, name, rows) {
  const sheet = XLSX.utils.json_to_sheet(rows);
  const firstRow = rows[0] || {};
  sheet['!cols'] = Object.keys(firstRow).map((key) => ({
    wch: Math.min(Math.max(String(key).length + 4, 14), 42),
  }));
  XLSX.utils.book_append_sheet(workbook, sheet, name);
}

function main() {
  const master = loadJson(MASTER_PATH);
  const readingsData = loadJson(READINGS_PATH);
  const aggregatedReadings = aggregateReadings(readingsData);
  const { segmentMap, validReadingsSet } = buildKanjiCandidatesBySegment(master);
  const { rows, uncovered, summary } = buildSegmentReviewRows(
    aggregatedReadings,
    validReadingsSet,
    segmentMap,
  );

  writeCsv(rows, CSV_PATH);
  writeWorkbook(rows, uncovered, summary, XLSX_PATH);

  console.log(`Wrote ${rows.length} segment rows to ${CSV_PATH}`);
  console.log(`Wrote review workbook to ${XLSX_PATH}`);
  console.log(JSON.stringify(summary, null, 2));
}

main();
