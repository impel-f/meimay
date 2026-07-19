const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const { performance } = require('node:perf_hooks');
const acorn = require('acorn');

const uiPath = path.join(__dirname, '..', 'public', 'js', '05-ui-render.js');
const buildPath = path.join(__dirname, '..', 'public', 'js', '07-build.js');
const firebasePath = path.join(__dirname, '..', 'public', 'js', '15-firebase.js');

function extractFunctions(filePath, functionNames) {
  const source = fs.readFileSync(filePath, 'utf8');
  const ast = acorn.parse(source, { ecmaVersion: 'latest', sourceType: 'script' });
  const names = new Set(functionNames);
  const declarations = ast.body
    .filter((node) => node.type === 'FunctionDeclaration' && names.has(node.id.name))
    .map((node) => source.slice(node.start, node.end));
  assert.equal(declarations.length, names.size, 'home overview functions must remain discoverable');
  return declarations.join('\n');
}

function extractLastAssignedFunction(filePath, objectName, propertyName) {
  const source = fs.readFileSync(filePath, 'utf8');
  const ast = acorn.parse(source, { ecmaVersion: 'latest', sourceType: 'script' });
  const assignments = ast.body.filter((node) => {
    const expression = node.type === 'ExpressionStatement' ? node.expression : null;
    const left = expression?.type === 'AssignmentExpression' ? expression.left : null;
    return left?.type === 'MemberExpression'
      && left.computed === false
      && left.object?.type === 'Identifier'
      && left.object.name === objectName
      && left.property?.type === 'Identifier'
      && left.property.name === propertyName
      && expression.right?.type === 'FunctionExpression';
  });
  const assignment = assignments.at(-1)?.expression;
  assert.ok(assignment, `${objectName}.${propertyName} must remain discoverable`);
  return source.slice(assignment.right.start, assignment.right.end);
}

const sandbox = {
  console,
  window: {},
  getSavedCandidateKey(item) {
    return `${item.givenName || ''}::${item.givenReading || ''}`;
  }
};
vm.createContext(sandbox);
vm.runInContext(`
  const _homeBuildPatternCountCache = new Map();
  const _homeBuildPatternCountStaleCache = new Map();
  const HOME_BUILD_PATTERN_DEFER_WORK_LIMIT = Number.MAX_SAFE_INTEGER;
  let _homeBuildPatternCountLastValue = 0;
  ${extractFunctions(uiPath, [
    'normalizeHomeBuildReadingValue',
    'sanitizeHomeBuildSegments',
    'getHomeBuildPatternSegments',
    'normalizeHomeBuildPool',
    'getHomeDataStateFingerprint',
    'getHomeBuildPatternKey',
    'getHomeBuildSlotCandidateCount',
    'getHomeBuildPatternCount',
    'getHomeAuthoredSavedItems',
    'getHomeSavedIdentityKey',
    'getHomeSavedModeCounts',
    'getHomeAggregateCounts',
    'getHomeOverviewStageSnapshot'
  ])}
  function getHomeOverviewMode(pairing) {
    return pairing?.mode || 'self';
  }
  function getWizardHomeState() {
    return { hasReadingCandidate: false };
  }
  globalThis.homeOverview = {
    getHomeBuildPatternCount,
    getHomeDataStateFingerprint,
    getHomeSavedModeCounts,
    getHomeOverviewStageSnapshot
  };
`, sandbox, { filename: uiPath });

const overview = sandbox.homeOverview;

vm.runInContext(`
  function isCompoundSlotPlaceholder() { return false; }
  function hydrateLikedCandidate(item) { return { ...item }; }
  function isImportedKanjiLibraryItem() { return false; }
  function isKanjiStockItemUsable() { return true; }
  let hiddenBuildReadings = new Set();
  function getBuildHiddenReadingSet() { return hiddenBuildReadings; }
  function setHiddenBuildReadings(values) { hiddenBuildReadings = new Set(values); }
  function getLatestReadingHistoryLookup() { return {}; }
  function getReadingBaseReading(value) { return String(value || '').split('::')[0].trim(); }
  function getPreferredReadingSegments() { return []; }
  function getDisplaySegmentsForReading(reading) { return [reading]; }
  function getCompoundFixedPieceForSlot() { return null; }
  function resolveLikedCandidateKanji(item) { return String(item?.['漢字'] || item?.kanji || ''); }
  function buildLikedCandidateKey(item) { return resolveLikedCandidateKanji(item); }
  function getLikedCandidateKanjiKey(item) { return resolveLikedCandidateKanji(item); }
  function getLikedCandidateDisplayKey(item) { return resolveLikedCandidateKanji(item); }
  function mergeLikedCandidateOwnershipState(target) { return target; }
  function toHira(value) { return String(value || ''); }
  ${extractFunctions(buildPath, [
    'getBuildCandidateSegmentsForReading',
    'getExactBuildPatternCountForSources',
    'getBuildSlotCandidateCacheKey',
    'getBuildSlotCandidates',
    'getUniqueBuildSlotCandidates',
    'normalizeLikedCandidateSegmentKey',
    'getSegmentKanjiCandidateKey'
  ])}
  window.getExactBuildPatternCountForSources = getExactBuildPatternCountForSources;
  globalThis.exactBuildPatternCount = getExactBuildPatternCountForSources;
  globalThis.setHiddenBuildReadingsForTest = setHiddenBuildReadings;
`, sandbox, { filename: buildPath });

function kanjiCandidate(kanji, slot) {
  return {
    '漢字': kanji,
    slot,
    sessionReading: 'はると',
    sessionSegments: ['はる', 'と']
  };
}

const readingStock = [{ reading: 'はると', segments: ['はる', 'と'] }];

function buildCandidate(kanji, reading, segments, slot, extra = {}) {
  return {
    '漢字': kanji,
    slot,
    sessionReading: reading,
    sessionSegments: segments,
    ...extra
  };
}

test('shared build count uses the union of both users and is never below either user', () => {
  const ownCandidates = [kanjiCandidate('陽', 0), kanjiCandidate('斗', 1)];
  const partnerCandidates = [kanjiCandidate('晴', 0), kanjiCandidate('人', 1)];

  const own = overview.getHomeBuildPatternCount(ownCandidates, readingStock);
  const partner = overview.getHomeBuildPatternCount(partnerCandidates, readingStock);
  const shared = overview.getHomeBuildPatternCount(
    [...ownCandidates, ...partnerCandidates],
    [...readingStock, ...readingStock]
  );

  assert.equal(own, 1);
  assert.equal(partner, 1);
  assert.equal(shared, 4);
  assert.ok(shared >= own);
  assert.ok(shared >= partner);
});

test('home build count matches the build screen slot candidates without enumerating names', () => {
  const yoshi = Array.from('佳吉義良嘉善芳喜慶', (kanji) => ({
    '漢字': kanji,
    slot: 0,
    sessionReading: 'よしはる',
    sessionSegments: ['よし', 'はる']
  }));
  const haru = Array.from('春晴陽温暖', (kanji) => ({
    '漢字': kanji,
    slot: 1,
    sessionReading: 'よしはる',
    sessionSegments: ['よし', 'はる']
  }));
  const stock = [{ reading: 'よしはる', segments: ['よし', 'はる'] }];

  assert.equal(sandbox.exactBuildPatternCount([...yoshi, ...haru], stock), 45);
  assert.equal(overview.getHomeBuildPatternCount([...yoshi, ...haru], stock), 45);
});

test('an early fallback result cannot stay cached after the exact counter becomes ready', () => {
  const candidates = [
    buildCandidate('奏', 'そうすけ', ['そう', 'すけ'], 0),
    buildCandidate('礎', 'そうすけ', ['そ', 'う', 'すけ'], 0),
    buildCandidate('介', 'そうすけ', ['そう', 'すけ'], 1)
  ];
  const stock = [{ reading: 'そうすけ', segments: ['そう', 'すけ'] }];
  const exactCounter = sandbox.window.getExactBuildPatternCountForSources;

  delete sandbox.window.getExactBuildPatternCountForSources;
  const fallbackResult = overview.getHomeBuildPatternCount(candidates, stock);
  sandbox.window.getExactBuildPatternCountForSources = exactCounter;
  const exactResult = overview.getHomeBuildPatternCount(candidates, stock);

  assert.equal(fallbackResult, 2);
  assert.equal(exactResult, 1);
});

test('a reading and at least one kanji for every segment are necessary and sufficient', () => {
  const first = buildCandidate('陽', 'はると', ['はる', 'と'], 0);
  const second = buildCandidate('斗', 'はると', ['はる', 'と'], 1);
  const unrelated = buildCandidate('碧', 'あおと', ['あお', 'と'], 0);

  assert.equal(sandbox.exactBuildPatternCount([], readingStock), 0);
  assert.equal(sandbox.exactBuildPatternCount([first], readingStock), 0);
  assert.equal(sandbox.exactBuildPatternCount([second], readingStock), 0);
  assert.equal(sandbox.exactBuildPatternCount([first, second], []), 0);
  assert.equal(sandbox.exactBuildPatternCount([first, second], readingStock), 1);
  assert.equal(sandbox.exactBuildPatternCount([first, second, unrelated], readingStock), 1);
});

test('duplicate stock entries do not inflate combinations', () => {
  const first = buildCandidate('陽', 'はると', ['はる', 'と'], 0);
  const duplicateFirst = { ...first, fromPartner: true };
  const seconds = [
    buildCandidate('斗', 'はると', ['はる', 'と'], 1),
    buildCandidate('人', 'はると', ['はる', 'と'], 1)
  ];

  assert.equal(sandbox.exactBuildPatternCount(
    [first, duplicateFirst, ...seconds],
    [...readingStock, ...readingStock]
  ), 2);
});

test('the same stock totals can yield different counts depending on segment distribution', () => {
  const balanced = [
    buildCandidate('陽', 'はると', ['はる', 'と'], 0),
    buildCandidate('晴', 'はると', ['はる', 'と'], 0),
    buildCandidate('斗', 'はると', ['はる', 'と'], 1),
    buildCandidate('人', 'はると', ['はる', 'と'], 1)
  ];
  const unbalanced = [
    buildCandidate('陽', 'はると', ['はる', 'と'], 0),
    buildCandidate('晴', 'はると', ['はる', 'と'], 0),
    buildCandidate('春', 'はると', ['はる', 'と'], 0),
    buildCandidate('斗', 'はると', ['はる', 'と'], 1)
  ];

  assert.equal(balanced.length, unbalanced.length);
  assert.equal(sandbox.exactBuildPatternCount(balanced, readingStock), 4);
  assert.equal(sandbox.exactBuildPatternCount(unbalanced, readingStock), 3);
});

test('multiple readings add their own products and three segments multiply fully', () => {
  const haruto = [
    buildCandidate('陽', 'はると', ['はる', 'と'], 0),
    buildCandidate('晴', 'はると', ['はる', 'と'], 0),
    buildCandidate('斗', 'はると', ['はる', 'と'], 1),
    buildCandidate('人', 'はると', ['はる', 'と'], 1)
  ];
  const yoshiki = [
    buildCandidate('佳', 'よしき', ['よし', 'き'], 0),
    buildCandidate('吉', 'よしき', ['よし', 'き'], 0),
    buildCandidate('義', 'よしき', ['よし', 'き'], 0),
    buildCandidate('樹', 'よしき', ['よし', 'き'], 1)
  ];
  const threeSegments = [
    ...Array.from('佐沙', kanji => buildCandidate(kanji, 'さくらこ', ['さ', 'くら', 'こ'], 0)),
    ...Array.from('倉久良', kanji => buildCandidate(kanji, 'さくらこ', ['さ', 'くら', 'こ'], 1)),
    ...Array.from('子湖心香', kanji => buildCandidate(kanji, 'さくらこ', ['さ', 'くら', 'こ'], 2))
  ];
  const stocks = [
    ...readingStock,
    { reading: 'よしき', segments: ['よし', 'き'] },
    { reading: 'さくらこ', segments: ['さ', 'くら', 'こ'] }
  ];

  assert.equal(sandbox.exactBuildPatternCount([...haruto, ...yoshiki], stocks.slice(0, 2)), 7);
  assert.equal(sandbox.exactBuildPatternCount(threeSegments, [stocks[2]]), 24);
  assert.equal(sandbox.exactBuildPatternCount([...haruto, ...yoshiki, ...threeSegments], stocks), 31);
});

test('shared stock creates cross-user combinations from the union', () => {
  const own = [
    buildCandidate('陽', 'はると', ['はる', 'と'], 0),
    buildCandidate('晴', 'はると', ['はる', 'と'], 0),
    buildCandidate('斗', 'はると', ['はる', 'と'], 1)
  ];
  const partner = [
    buildCandidate('春', 'はると', ['はる', 'と'], 0, { fromPartner: true }),
    buildCandidate('人', 'はると', ['はる', 'と'], 1, { fromPartner: true }),
    buildCandidate('翔', 'はると', ['はる', 'と'], 1, { fromPartner: true })
  ];

  const ownCount = sandbox.exactBuildPatternCount(own, readingStock);
  const partnerCount = sandbox.exactBuildPatternCount(partner, readingStock);
  const sharedCount = sandbox.exactBuildPatternCount([...own, ...partner], [...readingStock, ...readingStock]);

  assert.equal(ownCount, 2);
  assert.equal(partnerCount, 2);
  assert.equal(sharedCount, 9);
  assert.ok(sharedCount > ownCount + partnerCount);
});

test('28 self, 3 partner, and 62 shared can include 45 yoshiharu combinations', () => {
  const own = [
    ...Array.from('佳吉義良', kanji => buildCandidate(kanji, 'よしはる', ['よし', 'はる'], 0)),
    ...Array.from('春晴陽温暖', kanji => buildCandidate(kanji, 'よしはる', ['よし', 'はる'], 1)),
    ...Array.from('秋明', kanji => buildCandidate(kanji, 'あきと', ['あき', 'と'], 0)),
    ...Array.from('斗人翔都', kanji => buildCandidate(kanji, 'あきと', ['あき', 'と'], 1)),
    ...Array.from('美実', kanji => buildCandidate(kanji, 'みなこ', ['みな', 'こ'], 0))
  ];
  const partner = [
    ...Array.from('嘉善芳喜慶', kanji => buildCandidate(kanji, 'よしはる', ['よし', 'はる'], 0, { fromPartner: true })),
    ...Array.from('葵碧蒼', kanji => buildCandidate(kanji, 'あおい', ['あお', 'い'], 0, { fromPartner: true })),
    buildCandidate('依', 'あおい', ['あお', 'い'], 1, { fromPartner: true }),
    ...Array.from('子湖心', kanji => buildCandidate(kanji, 'みなこ', ['みな', 'こ'], 1, { fromPartner: true }))
  ];
  const ownStocks = [
    { reading: 'よしはる', segments: ['よし', 'はる'] },
    { reading: 'あきと', segments: ['あき', 'と'] },
    { reading: 'みなこ', segments: ['みな', 'こ'] }
  ];
  const partnerStocks = [
    { reading: 'よしはる', segments: ['よし', 'はる'] },
    { reading: 'あおい', segments: ['あお', 'い'] },
    { reading: 'みなこ', segments: ['みな', 'こ'] }
  ];

  assert.equal(sandbox.exactBuildPatternCount(own, ownStocks), 28);
  assert.equal(sandbox.exactBuildPatternCount(partner, partnerStocks), 3);
  assert.equal(sandbox.exactBuildPatternCount([...own, ...partner], [...ownStocks, ...partnerStocks]), 62);
  assert.equal(sandbox.exactBuildPatternCount(
    [...own, ...partner],
    [{ reading: 'よしはる', segments: ['よし', 'はる'] }]
  ), 45);
});

test('readings hidden from the build screen are also excluded from the home count', () => {
  const candidates = [
    buildCandidate('陽', 'はると', ['はる', 'と'], 0),
    buildCandidate('斗', 'はると', ['はる', 'と'], 1)
  ];

  sandbox.setHiddenBuildReadingsForTest(['はると']);
  assert.equal(sandbox.exactBuildPatternCount(candidates, readingStock), 0);
  sandbox.setHiddenBuildReadingsForTest([]);
  assert.equal(sandbox.exactBuildPatternCount(candidates, readingStock), 1);
});

test('large stock counts products without enumerating every completed name', () => {
  const stocks = [];
  const candidates = [];
  for (let readingIndex = 0; readingIndex < 100; readingIndex += 1) {
    const reading = `reading-${readingIndex}`;
    const segments = [`first-${readingIndex}`, `second-${readingIndex}`];
    stocks.push({ reading, segments });
    for (let index = 0; index < 5; index += 1) {
      candidates.push(buildCandidate(`A${readingIndex}-${index}`, reading, segments, 0));
    }
    for (let index = 0; index < 4; index += 1) {
      candidates.push(buildCandidate(`B${readingIndex}-${index}`, reading, segments, 1));
    }
  }

  const startedAt = performance.now();
  const total = sandbox.exactBuildPatternCount(candidates, stocks);
  const elapsedMs = performance.now() - startedAt;

  assert.equal(total, 2000);
  assert.ok(elapsedMs < 2000, `large stock count took ${elapsedMs.toFixed(1)}ms`);
});

test('a stock the size shown in the linked screenshots stays lightweight', () => {
  const stocks = [];
  const candidates = [];
  for (let readingIndex = 0; readingIndex < 22; readingIndex += 1) {
    const reading = `linked-${readingIndex}`;
    const segments = [`linked-first-${readingIndex}`, `linked-second-${readingIndex}`];
    stocks.push({ reading, segments });
    candidates.push(buildCandidate(`F${readingIndex}-0`, reading, segments, 0));
    candidates.push(buildCandidate(`F${readingIndex}-1`, reading, segments, 0));
    candidates.push(buildCandidate(`S${readingIndex}-0`, reading, segments, 1));
  }
  candidates.push(buildCandidate('F0-2', stocks[0].reading, stocks[0].segments, 0));

  const startedAt = performance.now();
  const total = sandbox.exactBuildPatternCount(candidates, stocks);
  const elapsedMs = performance.now() - startedAt;

  assert.equal(candidates.length, 67);
  assert.equal(total, 45);
  assert.ok(elapsedMs < 500, `linked-size stock count took ${elapsedMs.toFixed(1)}ms`);
});

test('home mode snapshots preserve individual counts and expand the shared build pool', () => {
  const ownCandidates = [kanjiCandidate('陽', 0), kanjiCandidate('斗', 1)];
  const partnerCandidates = [kanjiCandidate('晴', 0), kanjiCandidate('人', 1)];
  const pairing = {
    counts: {
      own: { reading: 1, kanji: 2, saved: 0 },
      partner: { reading: 1, kanji: 2, saved: 0 },
      matched: { reading: 1, kanji: 0, saved: 0 }
    },
    _homeData: {
      ownReadingItems: readingStock,
      partnerReadingItems: readingStock,
      ownLikedItems: ownCandidates,
      partnerLikedItems: partnerCandidates,
      ownSavedItems: [],
      partnerSavedItems: []
    }
  };

  const own = overview.getHomeOverviewStageSnapshot(2, 1, 0, { ...pairing, mode: 'self' });
  const partner = overview.getHomeOverviewStageSnapshot(2, 1, 0, { ...pairing, mode: 'partner' });
  const shared = overview.getHomeOverviewStageSnapshot(2, 1, 0, { ...pairing, mode: 'shared' });

  assert.equal(own.buildCount, 1);
  assert.equal(partner.buildCount, 1);
  assert.equal(shared.buildCount, 4);
  assert.ok(shared.buildCount >= own.buildCount);
  assert.ok(shared.buildCount >= partner.buildCount);
});

test('build-count cache fingerprint changes when same-length candidate contents change', () => {
  const first = [kanjiCandidate('陽', 0), kanjiCandidate('斗', 1)];
  const second = [kanjiCandidate('晴', 0), kanjiCandidate('人', 1)];

  assert.notEqual(
    overview.getHomeDataStateFingerprint(first, readingStock),
    overview.getHomeDataStateFingerprint(second, readingStock)
  );
});

test('saved counts exclude internal partner approvals and deduplicate the shared view', () => {
  const own = Array.from({ length: 8 }, (_, index) => ({
    givenName: `own-${index}`,
    givenReading: `own-reading-${index}`
  }));
  const partner = Array.from({ length: 8 }, (_, index) => ({
    givenName: index === 0 ? 'own-0' : `partner-${index}`,
    givenReading: index === 0 ? 'own-reading-0' : `partner-reading-${index}`
  }));
  own.push({
    givenName: 'partner-1',
    givenReading: 'partner-reading-1',
    approvedFromPartner: true
  });
  partner.push({
    givenName: 'own-1',
    givenReading: 'own-reading-1',
    approvedFromPartner: true
  });

  const counts = overview.getHomeSavedModeCounts(own, partner);

  assert.equal(counts.own, 8);
  assert.equal(counts.partner, 8);
  assert.equal(counts.shared, 15);
});

test('partner summary reports visible saved counts instead of internal approval copies', () => {
  const ownVisible = Array.from({ length: 8 }, (_, index) => ({
    givenName: `own-${index}`,
    givenReading: `own-reading-${index}`
  }));
  const partnerVisible = Array.from({ length: 8 }, (_, index) => ({
    givenName: `partner-${index}`,
    givenReading: `partner-reading-${index}`
  }));
  const ownRaw = [...ownVisible, {
    givenName: 'partner-0',
    givenReading: 'partner-reading-0',
    approvedFromPartner: true,
    approvedPartnerSavedKey: 'partner-0::partner-reading-0'
  }];
  const summarySandbox = {
    window: {},
    MeimayPairing: { roomCode: 'room', partnerUid: 'partner' },
    canonicalizePairingSavedNameKey(value) { return String(value || ''); }
  };
  vm.createContext(summarySandbox);
  vm.runInContext(`
    globalThis.getPartnerSummary = ${extractLastAssignedFunction(
      firebasePath,
      'MeimayPartnerInsights',
      'getSummary'
    )};
  `, summarySandbox, { filename: firebasePath });

  const key = (item) => `${item?.givenName || ''}::${item?.givenReading || ''}`;
  const context = {
    getOwnReadingStock: () => [],
    getPartnerReadingStock: () => [],
    getOwnLiked: () => [],
    getPartnerLiked: () => [],
    getOwnSaved: () => ownRaw,
    getPartnerSaved: () => partnerVisible,
    buildReadingStockKey: key,
    buildLikedMatchKey: key,
    buildSavedMatchKey: key,
    getPartnerDisplayName: () => 'partner',
    _getPartnerContextCacheKey: () => 'room:partner',
    _getCachedPartnerValue: () => null,
    _setCachedPartnerValue: (_cacheKey, value) => value
  };

  const summary = summarySandbox.getPartnerSummary.call(context);

  assert.equal(summary.ownSavedCount, 8);
  assert.equal(summary.partnerSavedCount, 8);
  assert.equal(summary.counts.own.saved, 8);
  assert.equal(summary.counts.partner.saved, 8);
  assert.equal(summary._homeData.ownSavedItems.length, 9, 'raw copies stay available for explicit match detection');
});
