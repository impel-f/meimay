const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const acorn = require('acorn');

const uiPath = path.join(__dirname, '..', 'public', 'js', '05-ui-render.js');
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

function kanjiCandidate(kanji, slot) {
  return {
    '漢字': kanji,
    slot,
    sessionReading: 'はると',
    sessionSegments: ['はる', 'と']
  };
}

const readingStock = [{ reading: 'はると', segments: ['はる', 'と'] }];

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
