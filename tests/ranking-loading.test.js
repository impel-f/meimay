const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const acorn = require('acorn');

const RANKING_SOURCE_PATH = path.join(__dirname, '..', 'public', 'js', '18-ranking.js');
const FIREBASE_SOURCE_PATH = path.join(__dirname, '..', 'public', 'js', '15-firebase.js');

function extractTopLevelFunction(source, name) {
  const ast = acorn.parse(source, { ecmaVersion: 'latest', sourceType: 'script' });
  const node = ast.body.find((entry) => entry.type === 'FunctionDeclaration' && entry.id?.name === name);
  assert.ok(node, `${name} must remain a top-level function`);
  return source.slice(node.start, node.end);
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

test('rankings use the established API path without a preflight data source', () => {
  const firebaseSource = fs.readFileSync(FIREBASE_SOURCE_PATH, 'utf8');
  const fetchRankings = firebaseSource.slice(
    firebaseSource.indexOf('fetchRankings: async function'),
    firebaseSource.indexOf('recordReadingSeen:', firebaseSource.indexOf('fetchRankings: async function'))
  );

  assert.match(fetchRankings, /fetchStatsWithTimeout\(getStatsApiRequestUrl/);
  assert.match(fetchRankings, /query\.set\('gender', normalizedGender\)/);
  assert.match(fetchRankings, /options\?\.signal \? \{ signal: options\.signal \} : \{\}/);
  assert.doesNotMatch(fetchRankings, /fetchFirestoreSdkRankings|fetchPublicFirestoreRankings/);
  assert.doesNotMatch(firebaseSource, /firestore\.googleapis\.com\/v1\/projects/);
});
