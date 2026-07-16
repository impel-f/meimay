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

test('premium-only partner snapshots skip data hydration and screen refresh', () => {
  const source = readSource('15-firebase.js');
  const unchangedGuard = source.indexOf('partnerContentFingerprint === this._lastPartnerContentFingerprint');
  const cleanup = source.indexOf('cleanupLegacyPartnerLocalData()', unchangedGuard);
  const guardEnd = source.indexOf('return;', unchangedGuard);

  assert.ok(unchangedGuard >= 0, 'partner content fingerprint guard must exist');
  assert.ok(guardEnd > unchangedGuard && guardEnd < cleanup, 'unchanged content must return before hydration');
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
  const requestRender = extractFunction(source, 'requestRenderHomeProfile');
  const timers = [];
  const sandbox = {
    timers,
    clearTimeout() {},
    requestAnimationFrame() {},
    setTimeout(callback) {
      timers.push(callback);
      return timers.length;
    },
    document: {
      getElementById: () => ({ classList: { contains: () => true } })
    },
    renderCount: 0,
    renderHomeProfile() {
      sandbox.renderCount += 1;
    }
  };
  vm.createContext(sandbox);
  vm.runInContext(`
    let _homeRenderRequest = null;
    let _homeRenderPendingWhileHidden = false;
    ${isActive}
    ${requestRender}
    requestRenderHomeProfile({ force: true, afterPaint: false });
  `, sandbox);

  assert.equal(sandbox.renderCount, 0);
  assert.equal(timers.length, 1);
  timers.shift()();
  assert.equal(sandbox.renderCount, 1);
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
