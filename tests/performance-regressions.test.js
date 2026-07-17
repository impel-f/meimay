const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const acorn = require('acorn');

function readSource(file) {
  return fs.readFileSync(path.join(__dirname, '..', 'public', 'js', file), 'utf8');
}

function extractFunction(source, functionName) {
  const ast = acorn.parse(source, { ecmaVersion: 'latest', sourceType: 'script' });
  const declaration = ast.body.find((node) =>
    node.type === 'FunctionDeclaration' && node.id.name === functionName
  );
  assert.ok(declaration, `${functionName} must remain discoverable`);
  return source.slice(declaration.start, declaration.end);
}

test('swipe candidate lookup scales with stock size instead of master times stock', () => {
  const source = readSource('02-engine.js');
  const helper = extractFunction(source, 'getSelectedKanjiSetForReadingSlot');
  const buildCandidates = extractFunction(source, 'buildSwipeStackCandidates');
  const sandbox = {
    liked: Array.from({ length: 5000 }, (_, index) => ({
      slot: index % 3,
      sessionReading: index % 2 ? 'はると' : 'みなと',
      '漢字': `字${index}`
    })),
    normalizeReadingComparisonValue: (value) => String(value || '').trim()
  };
  vm.createContext(sandbox);
  vm.runInContext(`${helper}; globalThis.makeSet = getSelectedKanjiSetForReadingSlot;`, sandbox);

  const selected = sandbox.makeSet(1, 'はると');
  assert.equal(selected.size, 834);
  assert.match(buildCandidates, /selectedKanjiSet\.has/);
  assert.doesNotMatch(buildCandidates, /isKanjiSelectedForReadingSlot\(/);
});

test('unchanged premium notifications do not rerender the active data screen', () => {
  const source = readSource('14-admob.js');
  const updatePremiumUI = extractFunction(source, 'updatePremiumUI');
  const sandbox = { calls: { saved: 0, drawer: 0, dependent: 0 }, console };
  vm.createContext(sandbox);
  vm.runInContext(`
    let lastPremiumUiMembershipFingerprint = '';
    const membership = {
      active: false,
      expired: false,
      source: 'self',
      premiumSource: '',
      status: '',
      productId: '',
      isTrial: false,
      expiresAt: null,
      label: 'プレミアム未登録'
    };
    const PremiumManager = { getMembershipState: () => membership };
    const premiumBadge = { classList: { toggle() {} }, title: '' };
    const document = {
      querySelector: () => ({ id: 'scr-saved' }),
      getElementById(id) {
        if (id === 'premium-badge') return premiumBadge;
        return null;
      }
    };
    function getDefaultPremiumMembershipState() { return membership; }
    function showAdBanner() {}
    function hideAdBanner() {}
    function updateDrawerProfile() { calls.drawer += 1; }
    function renderSavedScreen() { calls.saved += 1; }
    function updateDailyRemainingDisplay() {}
    function refreshPremiumDependentScreens() { calls.dependent += 1; }
    ${updatePremiumUI}
    updatePremiumUI();
    updatePremiumUI();
  `, sandbox);

  assert.equal(sandbox.calls.saved, 1);
  assert.equal(sandbox.calls.drawer, 1);
  assert.equal(sandbox.calls.dependent, 1);
});

test('partner-aware refreshes in the same frame are coalesced', () => {
  const source = readSource('15-firebase.js');
  const refreshPartnerAwareUI = extractFunction(source, 'refreshPartnerAwareUI');
  const queued = [];
  const sandbox = { calls: { saved: 0, drawer: 0 }, queued };
  vm.createContext(sandbox);
  vm.runInContext(`
    let partnerAwareUiRefreshPending = false;
    let partnerAwareUiRefreshSequence = 0;
    const document = { querySelector: () => ({ id: 'scr-saved' }) };
    function runAfterNextPaint(callback) { queued.push(callback); }
    function applyProfileTheme() {}
    function renderSavedScreen() { calls.saved += 1; }
    function updateDrawerProfile() { calls.drawer += 1; }
    ${refreshPartnerAwareUI}
    refreshPartnerAwareUI();
    refreshPartnerAwareUI();
  `, sandbox);

  assert.equal(queued.length, 1);
  queued.shift()();
  assert.equal(sandbox.calls.saved, 1);
  assert.equal(sandbox.calls.drawer, 1);
});

test('premium-only partner snapshots are reused only after full partner hydration', () => {
  const source = readSource('15-firebase.js');
  const unchangedGuard = source.indexOf('if (canReuseHydratedPartnerSnapshot)');
  const cleanup = source.indexOf('cleanupLegacyPartnerLocalData()', unchangedGuard);
  const guardEnd = source.indexOf('return;', unchangedGuard);

  assert.ok(unchangedGuard >= 0, 'hydrated partner fingerprint guard must exist');
  assert.ok(guardEnd > unchangedGuard && guardEnd < cleanup, 'unchanged content must return before hydration');
  assert.match(source, /partnerContentFingerprint === hydratedPartnerFingerprint/);
  assert.match(source, /contentFingerprint: partnerContentFingerprint/);
});

test('heavy destination screens render after the first screen paint', () => {
  const core = readSource('01-core.js');
  const flow = readSource('04-ui-flow.js');
  const build = readSource('07-build.js');
  const settings = readSource('11-settings.js');
  const history = readSource('12-history.js');

  assert.match(core, /function runAfterScreenPaint\(/);
  assert.match(extractFunction(flow, 'openKanjiSearch'), /runAfterScreenPaint\('scr-kanji-search'/);
  assert.match(extractFunction(flow, 'openReadingSearch'), /runAfterScreenPaint\('scr-kanji-search'/);
  assert.match(extractFunction(settings, 'openSettings'), /runAfterScreenPaint\('scr-settings'/);
  assert.match(extractFunction(history, 'openSavedNames'), /runAfterScreenPaint\('scr-saved'/);
  assert.match(extractFunction(build, 'openStock'), /runAfterScreenPaint\('scr-stock'/);
  assert.match(extractFunction(build, 'openBuild'), /runAfterScreenPaint\('scr-build'/);
});

test('deferred build rendering catches timer errors and replaces the loading state', () => {
  const source = readSource('07-build.js');
  const requestRender = extractFunction(source, 'requestRenderBuildSelection');
  const errorState = extractFunction(source, 'showBuildRenderErrorState');

  assert.match(requestRender, /try\s*\{\s*renderBuildSelection\(\)/);
  assert.match(requestRender, /showBuildRenderErrorState\(\)/);
  assert.match(errorState, /ビルドを表示できませんでした/);
  assert.match(errorState, /もう一度ビルドを開いてください/);
});

test('shared deferred renderer runs even when the native WebView skips an animation frame', () => {
  const source = readSource('01-core.js');
  const runAfterNextPaint = extractFunction(source, 'runAfterNextPaint');
  const timers = [];
  const sandbox = {
    timers,
    clearTimeout() {},
    requestAnimationFrame() {},
    setTimeout(callback) {
      timers.push(callback);
      return timers.length;
    },
    callbackCount: 0
  };
  vm.createContext(sandbox);
  vm.runInContext(`
    ${runAfterNextPaint}
    runAfterNextPaint(() => { callbackCount += 1; });
  `, sandbox);

  assert.equal(sandbox.callbackCount, 0);
  assert.equal(timers.length, 1);
  timers.shift()();
  assert.equal(sandbox.callbackCount, 1);
});

test('reading search stock markers use only visible reading stock', () => {
  const source = readSource('04-ui-flow.js');
  const getStockedKeys = extractFunction(source, 'getReadingSearchStockedKeySet');
  const sandbox = {};
  vm.createContext(sandbox);
  vm.runInContext(`
    function getReadingStock() { return [{ reading: 'はると' }, { reading: 'みなと' }]; }
    function getVisibleReadingStock() { return [{ reading: 'はると' }]; }
    function resolveReadingStockValue(item) { return item.reading; }
    function getReadingBaseReading(value) { return String(value || '').split('::')[0]; }
    function normalizeReadingComparisonValue(value) { return String(value || '').trim(); }
    ${getStockedKeys}
    globalThis.stockedKeys = getReadingSearchStockedKeySet();
  `, sandbox);

  assert.deepEqual([...sandbox.stockedKeys], ['はると']);
});

test('home profile still renders when the native WebView skips an animation frame', () => {
  const source = readSource('01-core.js');
  const isActive = extractFunction(source, 'isHomeProfileRenderTargetActive');
  const isMounted = extractFunction(source, 'isHomeProfileContentMounted');
  const clearRecovery = extractFunction(source, 'clearHomeProfileRecovery');
  const scheduleRecovery = extractFunction(source, 'scheduleHomeProfileRecovery');
  const requestRender = extractFunction(source, 'requestRenderHomeProfile');
  const timers = [];
  const sandbox = {
    timers,
    console,
    clearTimeout() {},
    requestAnimationFrame() {},
    setTimeout(callback) {
      timers.push(callback);
      return timers.length;
    },
    stageMounted: false,
    document: {
      getElementById(id) {
        if (id === 'scr-mode') return { classList: { contains: () => true } };
        if (id === 'home-stage-track' && sandbox.stageMounted) return { childElementCount: 1 };
        return null;
      }
    },
    renderCount: 0,
    renderHomeProfile() {
      sandbox.renderCount += 1;
      sandbox.stageMounted = true;
    }
  };
  vm.createContext(sandbox);
  vm.runInContext(`
    let _homeRenderRequest = null;
    let _homeRenderPendingWhileHidden = false;
    let _homeRenderRecoveryTimer = null;
    let _homeRenderRecoveryAttempts = 0;
    const HOME_RENDER_RECOVERY_MAX_ATTEMPTS = 3;
    ${isActive}
    ${isMounted}
    ${clearRecovery}
    ${scheduleRecovery}
    ${requestRender}
    requestRenderHomeProfile({ force: true, afterPaint: false });
  `, sandbox);

  assert.equal(sandbox.renderCount, 0);
  assert.equal(timers.length, 1);
  timers.shift()();
  assert.equal(sandbox.renderCount, 1);
});

test('home profile retries after a transient render failure and then mounts content', () => {
  const source = readSource('01-core.js');
  const isActive = extractFunction(source, 'isHomeProfileRenderTargetActive');
  const isMounted = extractFunction(source, 'isHomeProfileContentMounted');
  const clearRecovery = extractFunction(source, 'clearHomeProfileRecovery');
  const scheduleRecovery = extractFunction(source, 'scheduleHomeProfileRecovery');
  const requestRender = extractFunction(source, 'requestRenderHomeProfile');
  const timers = [];
  const sandbox = {
    timers,
    console: { error() {}, warn() {} },
    clearTimeout() {},
    requestAnimationFrame() {},
    setTimeout(callback) {
      timers.push(callback);
      return timers.length;
    },
    stageMounted: false,
    document: {
      getElementById(id) {
        if (id === 'scr-mode') return { classList: { contains: () => true } };
        if (id === 'home-stage-track' && sandbox.stageMounted) return { childElementCount: 1 };
        return null;
      }
    },
    renderCount: 0,
    renderHomeProfile() {
      sandbox.renderCount += 1;
      if (sandbox.renderCount === 1) throw new Error('transient');
      sandbox.stageMounted = true;
    }
  };
  vm.createContext(sandbox);
  vm.runInContext(`
    let _homeRenderRequest = null;
    let _homeRenderPendingWhileHidden = false;
    let _homeRenderRecoveryTimer = null;
    let _homeRenderRecoveryAttempts = 0;
    const HOME_RENDER_RECOVERY_MAX_ATTEMPTS = 3;
    ${isActive}
    ${isMounted}
    ${clearRecovery}
    ${scheduleRecovery}
    ${requestRender}
    requestRenderHomeProfile({ force: true, afterPaint: false });
  `, sandbox);

  timers.shift()();
  assert.equal(sandbox.renderCount, 1);
  assert.equal(timers.length, 1);
  timers.shift()();
  assert.equal(timers.length, 1);
  timers.shift()();
  assert.equal(sandbox.renderCount, 2);
  assert.equal(sandbox.stageMounted, true);
});

test('home and partner summaries normalize malformed legacy collections', () => {
  const renderSource = readSource('05-ui-render.js');
  const readHomeList = extractFunction(renderSource, 'readHomeList');
  const resolveCounts = extractFunction(renderSource, 'getHomeResolvedStageCounts');
  const localFallback = extractFunction(renderSource, 'getHomeLocalStageSnapshotFallback');
  const sandbox = {
    console: { warn() {} },
    window: {},
    getHomeBuildPatternCountSafe(candidatePool, readingStock) {
      return candidatePool.length === 2 && readingStock.length === 1 ? 6 : 0;
    }
  };
  vm.createContext(sandbox);
  vm.runInContext(`
    ${readHomeList}
    ${resolveCounts}
    ${localFallback}
    globalThis.fromInvalid = readHomeList({ bad: true }, ['fallback'], 'invalid');
    globalThis.fromThrow = readHomeList(() => { throw new Error('legacy'); }, ['fallback'], 'throwing');
    globalThis.localStage = getHomeLocalStageSnapshotFallback({
      ownLikedCount: 4,
      ownReadingCount: 2,
      ownSavedCount: 1,
      ownLikedItems: [{ kanji: '陽' }, { kanji: '斗' }],
      ownReadingItems: [{ reading: 'はると' }]
    }, { hasPartner: true });
  `, sandbox);

  assert.deepEqual([...sandbox.fromInvalid], ['fallback']);
  assert.deepEqual([...sandbox.fromThrow], ['fallback']);
  assert.equal(sandbox.localStage.mode, 'shared');
  assert.equal(sandbox.localStage.likedCount, 2);
  assert.equal(sandbox.localStage.readingStock.length, 1);
  assert.equal(sandbox.localStage.buildCount, 6);
  assert.equal(sandbox.localStage.actions.build, 'build');

  const firebaseSource = readSource('15-firebase.js');
  assert.match(firebaseSource, /const readList = \(methodName\) => \{/);
  assert.match(firebaseSource, /const ownReadingItems = readList\('getOwnReadingStock'\)/);
  assert.match(firebaseSource, /return Array\.isArray\(list\) \? list : \[\]/);
  assert.match(renderSource, /Shared overview failed; rendering local status/);
});

test('home build cache fingerprint changes when middle candidate data changes', () => {
  const renderSource = readSource('05-ui-render.js');
  const fingerprint = extractFunction(renderSource, 'getHomeDataStateFingerprint');
  const sandbox = {};
  vm.createContext(sandbox);
  vm.runInContext(`
    ${fingerprint}
    const readings = [{ reading: 'はると', segments: ['はる', 'と'] }];
    globalThis.before = getHomeDataStateFingerprint([
      { kanji: '陽', slot: 0, sessionReading: 'はると', sessionSegments: ['はる', 'と'] },
      { kanji: '斗', slot: 1, sessionReading: 'はると', sessionSegments: ['はる', 'と'] },
      { kanji: '翔', slot: 1, sessionReading: 'はると', sessionSegments: ['はる', 'と'] }
    ], readings);
    globalThis.after = getHomeDataStateFingerprint([
      { kanji: '陽', slot: 0, sessionReading: 'はると', sessionSegments: ['はる', 'と'] },
      { kanji: '人', slot: 1, sessionReading: 'はると', sessionSegments: ['はる', 'と'] },
      { kanji: '翔', slot: 1, sessionReading: 'はると', sessionSegments: ['はる', 'と'] }
    ], readings);
  `, sandbox);

  assert.notEqual(sandbox.before, sandbox.after);
});

test('home build count uses the provided kanji and reading pools', () => {
  const renderSource = readSource('05-ui-render.js');
  const functions = [
    'normalizeHomeBuildReadingValue',
    'sanitizeHomeBuildSegments',
    'getHomeBuildPatternSegments',
    'normalizeHomeBuildPool',
    'getHomeDataStateFingerprint',
    'getHomeBuildPatternKey',
    'getHomeBuildSlotCandidateCount',
    'getHomeBuildPatternCount'
  ].map(name => extractFunction(renderSource, name)).join('\n');
  const sandbox = { console: { warn() {} }, window: {} };
  vm.createContext(sandbox);
  vm.runInContext(`
    const _homeBuildPatternCountCache = new Map();
    const _homeBuildPatternCountStaleCache = new Map();
    const HOME_BUILD_PATTERN_DEFER_WORK_LIMIT = 5000;
    let _homeBuildPatternCountLastValue = 0;
    ${functions}
    globalThis.buildCount = getHomeBuildPatternCount([
      { kanji: '陽', slot: 0, sessionReading: 'はると', sessionSegments: ['はる', 'と'] },
      { kanji: '晴', slot: 0, sessionReading: 'はると', sessionSegments: ['はる', 'と'] },
      { kanji: '斗', slot: 1, sessionReading: 'はると', sessionSegments: ['はる', 'と'] }
    ], [
      { reading: 'はると', segments: ['はる', 'と'] }
    ]);
  `, sandbox);

  assert.equal(sandbox.buildCount, 2);
});

test('shared home build count uses the explicit union of own and partner sources', () => {
  const renderSource = readSource('05-ui-render.js');
  const buildSources = extractFunction(renderSource, 'getHomeSharedBuildSources');
  const snapshot = extractFunction(renderSource, 'getHomeOverviewStageSnapshot');
  const sandbox = {};
  vm.createContext(sandbox);
  vm.runInContext(`
    ${buildSources}
    globalThis.sources = getHomeSharedBuildSources(
      [{ kanji: '陽' }],
      [{ kanji: '斗' }],
      [{ reading: 'はる' }],
      [{ reading: 'と' }]
    );
  `, sandbox);

  assert.deepEqual(Array.from(sandbox.sources.candidatePool, (item) => item.kanji), ['陽', '斗']);
  assert.deepEqual(Array.from(sandbox.sources.readingStock, (item) => item.reading), ['はる', 'と']);
  assert.match(snapshot, /sharedBuildSources\.candidatePool/);
  assert.doesNotMatch(snapshot, /getHomeBuildPatternCountSafe\(\s*undefined,/);
});

test('shared build combinations cannot drop below the own-mode combinations', () => {
  const renderSource = readSource('05-ui-render.js');
  const functions = [
    'normalizeHomeBuildReadingValue',
    'sanitizeHomeBuildSegments',
    'getHomeBuildPatternSegments',
    'normalizeHomeBuildPool',
    'getHomeDataStateFingerprint',
    'getHomeBuildPatternKey',
    'getHomeBuildSlotCandidateCount',
    'getHomeBuildPatternCount',
    'getHomeSharedBuildSources'
  ].map(name => extractFunction(renderSource, name)).join('\n');
  const sandbox = { console: { warn() {} }, window: {} };
  vm.createContext(sandbox);
  vm.runInContext(`
    const _homeBuildPatternCountCache = new Map();
    const _homeBuildPatternCountStaleCache = new Map();
    const HOME_BUILD_PATTERN_DEFER_WORK_LIMIT = 5000;
    let _homeBuildPatternCountLastValue = 0;
    ${functions}
    const ownLiked = [
      { kanji: '陽', slot: 0, sessionReading: 'はると', sessionSegments: ['はる', 'と'] },
      { kanji: '斗', slot: 1, sessionReading: 'はると', sessionSegments: ['はる', 'と'] },
      { kanji: '翔', slot: 1, sessionReading: 'はると', sessionSegments: ['はる', 'と'] }
    ];
    const partnerLiked = [
      { kanji: '春', slot: 0, sessionReading: 'はると', sessionSegments: ['はる', 'と'] },
      { kanji: '人', slot: 1, sessionReading: 'はると', sessionSegments: ['はる', 'と'] }
    ];
    const ownReadings = [{ reading: 'はると', segments: ['はる', 'と'] }];
    const sources = getHomeSharedBuildSources(ownLiked, partnerLiked, ownReadings, []);
    const emptyPartnerSources = getHomeSharedBuildSources(ownLiked, [], ownReadings, []);
    globalThis.ownCount = getHomeBuildPatternCount(ownLiked, ownReadings);
    globalThis.sharedCount = getHomeBuildPatternCount(sources.candidatePool, sources.readingStock);
    globalThis.emptyPartnerSharedCount = getHomeBuildPatternCount(
      emptyPartnerSources.candidatePool,
      emptyPartnerSources.readingStock
    );
  `, sandbox);

  assert.equal(sandbox.ownCount, 2);
  assert.equal(sandbox.sharedCount, 6);
  assert.equal(sandbox.emptyPartnerSharedCount, sandbox.ownCount);
  assert.ok(sandbox.sharedCount >= sandbox.ownCount);
});

test('home mode counts ignore stale summaries and use the same live candidate arrays', () => {
  const renderSource = readSource('05-ui-render.js');
  const resolveCounts = extractFunction(renderSource, 'getHomeResolvedStageCounts');
  const sandbox = {
    console: { warn() {} },
    window: {
      getVisibleKanjiStockCardCount(focus, items) {
        if (focus === 'self') return items.filter((item) => item.fromPartner !== true).length;
        if (focus === 'partner') return items.filter((item) => item.fromPartner === true).length;
        return items.length;
      }
    }
  };
  vm.createContext(sandbox);
  vm.runInContext(`
    ${resolveCounts}
    const ownLikedItems = Array.from({ length: 34 }, (_, index) => ({ kanji: '自' + index }));
    const ownReadingItems = Array.from({ length: 15 }, (_, index) => ({ reading: 'よみ' + index }));
    const ownSavedItems = Array.from({ length: 8 }, (_, index) => ({ givenName: '名' + index }));
    const emptyPartner = {
      counts: {
        own: { reading: 15, kanji: 14, saved: 5 },
        partner: { reading: 0, kanji: 0, saved: 0 },
        matched: { reading: 0, kanji: 0, saved: 0 }
      },
      _homeData: {
        ownReadingItems,
        partnerReadingItems: [],
        ownLikedItems,
        partnerLikedItems: [],
        ownSavedItems,
        partnerSavedItems: [],
        matchedReadingItems: [],
        matchedLikedItems: [],
        matchedSavedItems: []
      }
    };
    globalThis.emptyPartnerCounts = getHomeResolvedStageCounts(14, 15, 5, emptyPartner);

    const partnerData = {
      ...emptyPartner,
      _homeData: {
        ...emptyPartner._homeData,
        partnerReadingItems: [{ reading: 'みなと' }],
        partnerLikedItems: [{ kanji: '凪', fromPartner: true }],
        partnerSavedItems: [{ givenName: '湊' }]
      }
    };
    globalThis.partnerCounts = getHomeResolvedStageCounts(14, 15, 5, partnerData);
  `, sandbox);

  assert.deepEqual({ ...sandbox.emptyPartnerCounts.own }, { reading: 15, kanji: 34, saved: 8 });
  assert.deepEqual({ ...sandbox.emptyPartnerCounts.aggregate }, { reading: 15, kanji: 34, saved: 8 });
  assert.deepEqual({ ...sandbox.partnerCounts.partner }, { reading: 1, kanji: 1, saved: 1 });
  assert.deepEqual({ ...sandbox.partnerCounts.aggregate }, { reading: 16, kanji: 35, saved: 9 });
});

test('home fallback cannot restore stale linked summary counts', () => {
  const renderSource = readSource('05-ui-render.js');
  const resolveCounts = extractFunction(renderSource, 'getHomeResolvedStageCounts');
  const fallbackSnapshot = extractFunction(renderSource, 'getHomeLocalStageSnapshotFallback');
  const sandbox = {
    console: { warn() {} },
    window: {
      getVisibleKanjiStockCardCount(focus, items) {
        if (focus === 'self') return items.filter((item) => item.fromPartner !== true).length;
        if (focus === 'partner') return items.filter((item) => item.fromPartner === true).length;
        return items.length;
      }
    },
    readHomeList(value, fallback) {
      const resolved = typeof value === 'function' ? value() : value;
      return Array.isArray(resolved) ? resolved : (Array.isArray(fallback) ? fallback : []);
    },
    getHomeOverviewMode() { return 'shared'; },
    getHomeBuildPatternCountSafe(likedItems) { return likedItems.length; }
  };
  vm.createContext(sandbox);
  vm.runInContext(`
    ${resolveCounts}
    ${fallbackSnapshot}
    const ownLikedItems = Array.from({ length: 34 }, (_, index) => ({ kanji: '自' + index }));
    const ownReadingItems = Array.from({ length: 15 }, (_, index) => ({ reading: 'よみ' + index }));
    const ownSavedItems = Array.from({ length: 8 }, (_, index) => ({ givenName: '名' + index }));
    globalThis.result = getHomeLocalStageSnapshotFallback({
      ownLikedCount: 34,
      ownReadingCount: 15,
      ownSavedCount: 8,
      ownLikedItems,
      ownReadingItems,
      ownSavedItems
    }, {
      counts: {
        own: { reading: 15, kanji: 14, saved: 5 },
        partner: { reading: 0, kanji: 0, saved: 0 },
        matched: { reading: 0, kanji: 0, saved: 0 }
      },
      _homeData: {
        ownReadingItems,
        partnerReadingItems: [],
        ownLikedItems,
        partnerLikedItems: [],
        ownSavedItems,
        partnerSavedItems: []
      }
    });
  `, sandbox);

  assert.equal(sandbox.result.mode, 'shared');
  assert.equal(sandbox.result.readingStockCount, 15);
  assert.equal(sandbox.result.likedCount, 34);
  assert.equal(sandbox.result.savedCount, 8);
  assert.deepEqual({ ...sandbox.result.aggregateCounts }, {
    likedCount: 34,
    readingStockCount: 15,
    savedCount: 8
  });
});

test('home overview isolates saved-name selection failures from build counts', () => {
  const renderSource = readSource('05-ui-render.js');
  const readCanvas = extractFunction(renderSource, 'readHomeSavedCanvasState');
  const sandbox = {
    console: { warn() {} },
    window: {
      MeimayPartnerInsights: {
        getSavedNameCanvasState() {
          throw new Error('legacy saved canvas');
        }
      }
    }
  };
  vm.createContext(sandbox);
  vm.runInContext(`
    ${readCanvas}
    globalThis.canvas = readHomeSavedCanvasState(8);
  `, sandbox);

  assert.equal(sandbox.canvas, null);
  assert.match(renderSource, /getHomeSharedBuildSources\(/);
  assert.match(renderSource, /getHomeBuildPatternCountSafe\(\s*sharedBuildSources\.candidatePool,\s*aggregateReadingStock/);
});

test('large stock screens avoid quadratic grouping and yield between batches', () => {
  const build = readSource('07-build.js');
  const renderStock = extractFunction(build, 'renderStock');
  const countStock = extractFunction(build, 'getVisibleKanjiStockCardCount');
  const readingStock = extractFunction(readSource('04-ui-flow.js'), 'renderReadingStockSectionV2');

  assert.match(renderStock, /segGroupItemMaps\[seg\]\.get/);
  assert.doesNotMatch(renderStock, /segGroups\[seg\]\.find/);
  assert.match(renderStock, /STOCK_RENDER_BATCH_CARD_LIMIT/);
  assert.match(renderStock, /runAfterNextPaint\(renderNextStockBatch\)/);
  assert.match(renderStock, /stockScreen\.classList\.contains\('active'\)/);
  assert.match(countStock, /segGroupItemMaps\[seg\]\.get/);
  assert.doesNotMatch(countStock, /segGroups\[seg\]\.find/);
  assert.match(readingStock, /ownKanjiCountByReading\.get/);
  assert.doesNotMatch(readingStock, /ownLiked\.filter\(item => getReadingBaseReading/);
});

test('storage does not resave every collection on a fixed interval', () => {
  const source = readSource('09-storage.js');
  assert.doesNotMatch(source, /setInterval\([\s\S]*?StorageBox\.saveAll/);
  assert.match(source, /beforeunload[\s\S]*?StorageBox\.saveAll\(\)/);
});

test('reading stock synchronization builds one lookup index for large collections', () => {
  const source = readSource('04-ui-flow.js');
  const syncReading = extractFunction(source, 'syncReadingStockFromLiked');
  const upsert = extractFunction(source, 'upsertReadingStockEntry');

  assert.match(syncReading, /const lookupIndex = buildReadingStockLookupIndex\(stock\)/);
  assert.match(syncReading, /lookupIndex/);
  assert.match(upsert, /lookupIndex\.byId\.get/);
  assert.match(upsert, /lookupIndex\.byReading\.get/);
});

test('search paging renders once per smaller incremental batch', () => {
  const source = readSource('04-ui-flow.js');
  const kanjiBatch = Number(source.match(/const KANJI_SEARCH_BATCH_SIZE = (\d+)/)?.[1]);
  const readingBatch = Number(source.match(/const READING_SEARCH_BATCH_SIZE = (\d+)/)?.[1]);
  const loadKanji = extractFunction(source, 'loadMoreKanjiSearchResults');
  const loadReading = extractFunction(source, 'loadMoreReadingSearchResults');
  const countCalls = (body, call) => (body.match(new RegExp(`${call}\\(\\)`, 'g')) || []).length;

  assert.ok(kanjiBatch > 0 && kanjiBatch <= 80);
  assert.ok(readingBatch > 0 && readingBatch <= 80);
  assert.equal(countCalls(loadKanji, 'executeKanjiSearch'), 1);
  assert.equal(countCalls(loadReading, 'executeReadingSearch'), 1);
});

test('linked workspace snapshots are coalesced after rapid local changes', () => {
  const source = readSource('21-child-workspaces.js');
  const schedule = source.slice(
    source.indexOf('scheduleActiveChildSnapshot(reason'),
    source.indexOf('persistActiveChildSnapshot(reason', source.indexOf('scheduleActiveChildSnapshot(reason'))
  );
  assert.match(schedule, /clearTimeout\(this\._snapshotPersistTimer\)/);
  assert.match(schedule, /}, 600\)/);
});

test('AI kanji removal resolves the master item before either branch', () => {
  const source = readSource('04-ui-flow.js');
  const stockSuggestion = extractFunction(source, 'stockAISuggestion');
  const foundDeclaration = stockSuggestion.indexOf("const found = master.find");
  const branch = stockSuggestion.indexOf('if (isStocked)');
  assert.ok(foundDeclaration >= 0 && foundDeclaration < branch);
});

test('reading candidate generation reuses the normalized source and indexed tags', () => {
  const source = readSource('engine_v2_generator.js');
  const context = extractFunction(source, 'getNameCandidateSourceContext');
  const getReading = extractFunction(source, 'getNameCandidateSourceReading');
  const getValue = extractFunction(source, 'getNameCandidateSourceValue');
  const generate = extractFunction(source, 'generateNameCandidates');
  let mapCalls = 0;
  const readings = Array.from({ length: 5000 }, (_, index) => ({
    reading: index === 0 ? 'はると' : `はる${index}`,
    count: 5000 - index,
    isPopular: index < 10,
    gender: 'male',
    examples: '',
    tags: ['test']
  }));
  readings.map = function (...args) {
    mapCalls += 1;
    return Array.prototype.map.apply(this, args);
  };
  const sandbox = { readingsData: readings, console };
  vm.createContext(sandbox);
  vm.runInContext(`
    let nameCandidateSourceCache = {
      sourceRef: null,
      sourceLength: -1,
      sourceKind: '',
      sourceData: [],
      sourceByReading: new Map(),
      filteredByGender: new Map()
    };
    const noped = new Set();
    ${getReading}
    ${context}
    ${getValue}
    ${generate}
    globalThis.first = generateNameCandidates('はる', 'male');
    globalThis.second = generateNameCandidates('はる', 'male');
  `, sandbox);

  assert.equal(mapCalls, 0);
  assert.equal(sandbox.first.length, sandbox.second.length);
  assert.equal(sandbox.first.find(candidate => candidate.reading === 'はると').tags[0], 'test');
  assert.match(generate, /sourceByReading\.get\(candidate\.reading\)/);
  assert.doesNotMatch(generate, /sourceData\.find/);
  assert.doesNotMatch(context, /sourceRef\.map/);
});

test('encountered candidate rendering uses indexed liked and reading stock state', () => {
  const source = extractFunction(readSource('12-history.js'), 'renderEncounteredLibrary');
  assert.match(source, /const likedKanjiSet = new Set/);
  assert.match(source, /const stockedReadingSet =/);
  assert.doesNotMatch(source, /liked\.some/);
  assert.doesNotMatch(source, /getReadingStock\(\)\.some/);
});

test('free build reading suggestions reuse a reading index', () => {
  const source = readSource('07-build.js');
  const lookup = extractFunction(source, 'getBuildReadingLookup');
  const allowed = extractFunction(source, 'getAllowedReadingsForBuild');
  const suggest = extractFunction(source, 'suggestReadingsForKanji');
  assert.match(lookup, /byReading\.get\(normalizedReading\)/);
  assert.match(allowed, /allowedByGender\.has/);
  assert.match(suggest, /readingLookup\.byReading\.get/);
  assert.doesNotMatch(suggest, /dictionaryReadings\.filter/);
});

test('partner sync has one active implementation and bounded room creation', () => {
  const source = readSource('15-firebase.js');
  const implementations = source.match(/syncMyData\s*:\s*async|MeimayPairing\.syncMyData\s*=/g) || [];
  assert.equal(implementations.length, 1);
  const createStart = source.indexOf('_createUniqueRoomDocument: async function');
  const createEnd = source.indexOf('updateMyRole:', createStart);
  const createRoom = source.slice(createStart, createEnd);
  assert.ok(createStart >= 0 && createEnd > createStart);
  assert.match(createRoom, /withMeimayTimeout\(firebaseDb\.runTransaction/);
});
