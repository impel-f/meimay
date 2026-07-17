const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const acorn = require('acorn');

const RANKING_SOURCE_PATH = path.join(__dirname, '..', 'public', 'js', '18-ranking.js');
const FIREBASE_SOURCE_PATH = path.join(__dirname, '..', 'public', 'js', '15-firebase.js');
const CORE_SOURCE_PATH = path.join(__dirname, '..', 'public', 'js', '01-core.js');

function extractTopLevelFunction(source, name) {
  const ast = acorn.parse(source, { ecmaVersion: 'latest', sourceType: 'script' });
  const node = ast.body.find((entry) => entry.type === 'FunctionDeclaration' && entry.id?.name === name);
  assert.ok(node, `${name} must remain a top-level function`);
  return source.slice(node.start, node.end);
}

function extractObjectMethod(source, objectName, methodName) {
  const ast = acorn.parse(source, { ecmaVersion: 'latest', sourceType: 'script' });
  const declaration = ast.body.find((entry) => entry.type === 'VariableDeclaration'
    && entry.declarations.some((item) => item.id?.name === objectName));
  const objectNode = declaration?.declarations.find((item) => item.id?.name === objectName)?.init;
  const property = objectNode?.properties?.find((item) => (item.key?.name || item.key?.value) === methodName);
  assert.ok(property?.value, `${objectName}.${methodName} must remain available`);
  return source.slice(property.value.start, property.value.end);
}

test('ranking request timeout always settles and invokes cancellation', async () => {
  const source = fs.readFileSync(RANKING_SOURCE_PATH, 'utf8');
  const timeoutFunction = extractTopLevelFunction(source, 'withRankingTimeout');
  const sandbox = {
    Error,
    Promise,
    clearTimeout,
    setTimeout,
    cancelled: 0
  };
  vm.createContext(sandbox);
  vm.runInContext(`
    const RANKING_REQUEST_TIMEOUT_MS = 10000;
    ${timeoutFunction}
    globalThis.timeoutPromise = withRankingTimeout(new Promise(() => {}), {
      timeoutMs: 10,
      onTimeout: () => { cancelled += 1; }
    });
  `, sandbox);

  await assert.rejects(sandbox.timeoutPromise, (error) => error?.name === 'RankingTimeoutError');
  assert.equal(sandbox.cancelled, 1);
});

test('an Android HTTPS WebView uses the production API even before Capacitor is exposed', () => {
  const coreSource = fs.readFileSync(CORE_SOURCE_PATH, 'utf8');
  const functions = [
    'isNativeAppRuntime',
    'getMeimayProductionApiUrl',
    'getMeimayApiUrl'
  ].map((name) => extractTopLevelFunction(coreSource, name)).join('\n');
  const sandbox = {
    window: {
      location: { protocol: 'https:', hostname: 'localhost' }
    }
  };
  vm.createContext(sandbox);
  vm.runInContext(`
    const MEIMAY_PRODUCTION_API_ORIGIN = 'https://meimay.vercel.app';
    ${functions}
    globalThis.native = isNativeAppRuntime();
    globalThis.url = getMeimayApiUrl('/api/stats?gender=male');
  `, sandbox);

  assert.equal(sandbox.native, true);
  assert.equal(sandbox.url, 'https://meimay.vercel.app/api/stats?gender=male');
});

test('an uncached stalled ranking load replaces the spinner with a retry action', async () => {
  const source = fs.readFileSync(RANKING_SOURCE_PATH, 'utf8');
  const sandbox = {
    console: { error() {} },
    clearTimeout,
    setTimeout
  };
  vm.createContext(sandbox);
  vm.runInContext(`
    const RANKING_REQUEST_TIMEOUT_MS = 15;
    let currentRankingType = 'kanji';
    let currentRankingPeriod = 'allTime';
    let currentRankingTab = 'allTime';
    let currentRankingGender = 'all';
    let rankingLoadSequence = 0;
    let rankingLoadController = null;
    let abortCount = 0;
    const container = { innerHTML: '' };
    const document = { getElementById: (id) => id === 'ranking-list-container' ? container : null };
    const MeimayStats = {};
    const AbortController = class {
      constructor() { this.signal = {}; }
      abort() { abortCount += 1; }
    };
    const normalizeRankingType = (value) => value === 'reading' ? 'reading' : 'kanji';
    const normalizeRankingPeriod = (value) => value === 'monthly' ? 'monthly' : 'allTime';
    const normalizeRankingGender = (value) => ['male', 'female'].includes(value) ? value : 'all';
    const updateRankingButtonState = () => {};
    const getRankingCacheKey = () => 'kanji|allTime|all|all';
    const readRankingCacheEntry = () => null;
    const fetchRankingItems = () => new Promise(() => {});
    const filterRankingKanjiItems = (items) => items;
    const writeRankingCacheEntry = () => {};
    const isRankingViewCurrent = () => true;
    const renderRankingResult = () => {};
    const startRankingLoadingWatchdog = () => {};
    const clearRankingLoadingWatchdog = () => {};
    ${extractTopLevelFunction(source, 'getRankingLoadingMessage')}
    ${extractTopLevelFunction(source, 'getRankingLoadErrorMessage')}
    ${extractTopLevelFunction(source, 'withRankingTimeout')}
    ${extractTopLevelFunction(source, 'loadRanking')}
    globalThis.loadPromise = loadRanking();
    globalThis.container = container;
  `, sandbox);

  await sandbox.loadPromise;
  assert.match(sandbox.container.innerHTML, /もう一度読み込む/);
  assert.doesNotMatch(sandbox.container.innerHTML, /animate-spin/);
});

test('gender switches cancel the previous ranking request and expose a retry state', () => {
  const rankingSource = fs.readFileSync(RANKING_SOURCE_PATH, 'utf8');
  const firebaseSource = fs.readFileSync(FIREBASE_SOURCE_PATH, 'utf8');
  const loadRanking = extractTopLevelFunction(rankingSource, 'loadRanking');
  const errorMessage = extractTopLevelFunction(rankingSource, 'getRankingLoadErrorMessage');

  assert.match(loadRanking, /rankingLoadController\.abort\(\)/);
  assert.match(loadRanking, /withRankingTimeout\(/);
  assert.match(loadRanking, /getRankingLoadErrorMessage\(\)/);
  assert.match(loadRanking, /loadId !== rankingLoadSequence/);
  assert.match(errorMessage, /もう一度読み込む/);
  assert.match(firebaseSource, /options\?\.signal \? \{ signal: options\.signal \}/);
  assert.match(firebaseSource, /apiError\?\.name === 'AbortError'/);
});

test('ranking watchdog replaces a stuck loading surface and cancels the request', async () => {
  const source = fs.readFileSync(RANKING_SOURCE_PATH, 'utf8');
  const sandbox = {
    clearTimeout,
    setTimeout
  };
  vm.createContext(sandbox);
  vm.runInContext(`
    const RANKING_LOADING_WATCHDOG_MS = 10;
    let rankingLoadingWatchdogTimer = null;
    let rankingLoadSequence = 4;
    globalThis.abortCount = 0;
    let rankingLoadController = {
      abort() { globalThis.abortCount += 1; }
    };
    const listContainer = {
      innerHTML: '<div data-ranking-state="loading"></div>',
      querySelector(selector) {
        return selector === '[data-ranking-state="loading"]' ? {} : null;
      }
    };
    const isRankingViewCurrent = () => true;
    ${extractTopLevelFunction(source, 'getRankingLoadErrorMessage')}
    ${extractTopLevelFunction(source, 'clearRankingLoadingWatchdog')}
    ${extractTopLevelFunction(source, 'startRankingLoadingWatchdog')}
    startRankingLoadingWatchdog(4, listContainer, 'kanji', 'allTime', 'male');
    globalThis.listContainer = listContainer;
  `, sandbox);

  await new Promise((resolve) => setTimeout(resolve, 25));
  vm.runInContext(`
    globalThis.watchdogResult = {
      loadSequence: rankingLoadSequence,
      controller: rankingLoadController
    };
  `, sandbox);
  assert.equal(sandbox.abortCount, 1);
  assert.equal(sandbox.watchdogResult.loadSequence, 5);
  assert.equal(sandbox.watchdogResult.controller, null);
  assert.match(sandbox.listContainer.innerHTML, /もう一度読み込む/);
});

test('ranking API retries the production URL when a relative WebView request fails', async () => {
  const firebaseSource = fs.readFileSync(FIREBASE_SOURCE_PATH, 'utf8');
  const functions = [
    'normalizeStatsGenderValue',
    'normalizeStatsRankingItems',
    'getStatsApiRequestUrls',
    'fetchStatsApiRankings'
  ].map((name) => extractTopLevelFunction(firebaseSource, name)).join('\n');
  const sandbox = {
    Error,
    Set,
    Array,
    String,
    Number,
    console: { warn() {} },
    calls: [],
    window: {
      getMeimayProductionApiUrl(path) {
        return `https://meimay.vercel.app${path}`;
      }
    },
    getStatsApiRequestUrl(path) {
      return path;
    },
    getReadingRankingAllowlist() {
      return null;
    },
    async fetchStatsWithTimeout(url) {
      sandbox.calls.push(url);
      if (String(url).startsWith('/')) throw new Error('relative WebView request failed');
      return {
        ok: true,
        status: 200,
        async json() {
          return { gender: 'female', items: [{ kanji: '花', count: 7 }] };
        }
      };
    }
  };
  vm.createContext(sandbox);
  vm.runInContext(`${functions}\nglobalThis.promise = fetchStatsApiRankings('/api/stats?gender=female', 'kanji', 'female');`, sandbox);

  const items = await sandbox.promise;
  assert.deepEqual(sandbox.calls, [
    '/api/stats?gender=female',
    'https://meimay.vercel.app/api/stats?gender=female'
  ]);
  assert.equal(items[0].kanji, '花');
  assert.equal(items[0].count, 7);
});

test('ranking falls back to the public Firestore aggregate after API failure', async () => {
  const firebaseSource = fs.readFileSync(FIREBASE_SOURCE_PATH, 'utf8');
  const fetchRankings = extractObjectMethod(firebaseSource, 'MeimayStats', 'fetchRankings');
  const sandbox = {
    URLSearchParams,
    console: { warn() {} },
    fetchLocalStatsRankings() { return null; },
    normalizeStatsGenderValue(value) { return value; },
    async fetchStatsApiRankings() { throw new Error('API unavailable'); },
    async fetchFirestoreSdkRankings(type, kind, metric, gender) {
      return [{ kanji: gender === 'male' ? '晴' : '花', count: 5 }];
    }
  };
  vm.createContext(sandbox);
  vm.runInContext(`
    const stats = { fetchRankings: ${fetchRankings} };
    globalThis.promise = stats.fetchRankings('allTime', 'kanji', 'all', 'male');
  `, sandbox);

  const items = await sandbox.promise;
  assert.deepEqual(Array.from(items, (item) => item.kanji), ['晴']);
});

test('a slower male response cannot overwrite the selected female ranking', async () => {
  const source = fs.readFileSync(RANKING_SOURCE_PATH, 'utf8');
  const sandbox = { clearTimeout, setTimeout };
  vm.createContext(sandbox);
  vm.runInContext(`
    const RANKING_REQUEST_TIMEOUT_MS = 100;
    let currentRankingType = 'kanji';
    let currentRankingPeriod = 'allTime';
    let currentRankingTab = 'allTime';
    let currentRankingGender = 'male';
    let rankingLoadSequence = 0;
    let rankingLoadController = null;
    const container = { innerHTML: '' };
    const document = { getElementById: () => container };
    const AbortController = class { constructor() { this.signal = { aborted: false }; } abort() { this.signal.aborted = true; } };
    const MeimayStats = {};
    const normalizeRankingType = (value) => value === 'reading' ? 'reading' : 'kanji';
    const normalizeRankingPeriod = (value) => value === 'monthly' ? 'monthly' : 'allTime';
    const normalizeRankingGender = (value) => ['male', 'female'].includes(value) ? value : 'all';
    const updateRankingButtonState = () => {};
    const getRankingCacheKey = (type, period, gender) => [type, period, gender].join('|');
    const readRankingCacheEntry = () => null;
    const writeRankingCacheEntry = () => {};
    const filterRankingKanjiItems = (items) => items;
    const startRankingLoadingWatchdog = () => {};
    const clearRankingLoadingWatchdog = () => {};
    const isRankingViewCurrent = (type, period, gender) => currentRankingGender === gender;
    const fetchRankingItems = (type, period, gender) => new Promise((resolve) => {
      setTimeout(() => resolve([{ kanji: gender === 'male' ? '晴' : '花', count: 1 }]), gender === 'male' ? 25 : 5);
    });
    const renderRankingResult = (target, items) => { target.innerHTML = items[0].kanji; };
    ${extractTopLevelFunction(source, 'getRankingLoadingMessage')}
    ${extractTopLevelFunction(source, 'getRankingLoadErrorMessage')}
    ${extractTopLevelFunction(source, 'withRankingTimeout')}
    ${extractTopLevelFunction(source, 'loadRanking')}
    const malePromise = loadRanking();
    currentRankingGender = 'female';
    const femalePromise = loadRanking();
    globalThis.promise = Promise.all([malePromise, femalePromise]);
    globalThis.container = container;
  `, sandbox);

  await sandbox.promise;
  assert.equal(sandbox.container.innerHTML, '花');
});

test('rankings keep API-first and Firestore fallback paths', () => {
  const firebaseSource = fs.readFileSync(FIREBASE_SOURCE_PATH, 'utf8');
  const fetchRankings = firebaseSource.slice(
    firebaseSource.indexOf('fetchRankings: async function'),
    firebaseSource.indexOf('recordReadingSeen:', firebaseSource.indexOf('fetchRankings: async function'))
  );

  assert.match(fetchRankings, /fetchStatsApiRankings\(/);
  assert.match(fetchRankings, /fetchFirestoreSdkRankings\(/);
  assert.match(fetchRankings, /query\.set\('gender', normalizedGender\)/);
  assert.ok(fetchRankings.indexOf('fetchStatsApiRankings') < fetchRankings.indexOf('fetchFirestoreSdkRankings'));
  assert.doesNotMatch(firebaseSource, /firestore\.googleapis\.com\/v1\/projects/);
});
