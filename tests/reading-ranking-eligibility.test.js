const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const acorn = require('acorn');

const CORE_SOURCE_PATH = path.join(__dirname, '..', 'public', 'js', '01-core.js');
const UI_FLOW_SOURCE_PATH = path.join(__dirname, '..', 'public', 'js', '04-ui-flow.js');

function extractFunctionDeclarations(filePath, functionNames) {
  const source = fs.readFileSync(filePath, 'utf8');
  const ast = acorn.parse(source, { ecmaVersion: 'latest', sourceType: 'script' });
  const requested = new Set(functionNames);
  const declarations = ast.body
    .filter((node) => node.type === 'FunctionDeclaration' && requested.has(node.id.name));
  const found = new Set(declarations.map((node) => node.id.name));

  assert.deepEqual([...found].sort(), [...requested].sort(), `all functions must remain discoverable in ${filePath}`);
  return declarations.map((node) => source.slice(node.start, node.end)).join('\n');
}

function createRankingEligibilityHarness() {
  const coreFunctions = extractFunctionDeclarations(CORE_SOURCE_PATH, [
    'normalizeReadingComparisonValue'
  ]);
  const flowFunctions = extractFunctionDeclarations(UI_FLOW_SOURCE_PATH, [
    'getReadingStockKey',
    'resolveReadingStockValue',
    'normalizeReadingStockItem',
    'getReadingBaseReading',
    'isReadingStockPromoted',
    'isReadingStockStarred',
    'sortReadingStockMatches',
    'findReadingStockItemInStock',
    'areReadingStockFieldValuesEqual',
    'assignReadingStockField',
    'upsertReadingStockEntry',
    'addReadingToStock',
    'matchesReadingStockTarget',
    'removeReadingFromStock'
  ]);
  const rankingCalls = [];
  const sandbox = {
    console: {
      log() {},
      warn() {},
      error() {}
    },
    gender: 'neutral',
    appMode: 'sound',
    rankingCalls,
    localStorage: {
      getItem() {
        return null;
      },
      setItem() {}
    },
    window: {}
  };

  vm.createContext(sandbox);
  vm.runInContext(`
    let currentReadingStock = [];
    function getReadingStock() {
      return currentReadingStock;
    }
    function saveReadingStock(stock) {
      currentReadingStock = stock;
    }
    function forgetHiddenReading() {}
    function recordSoundPreferenceFromReadingAction() {}
    function syncReadingStockRankingStats(reading, delta, period, options) {
      rankingCalls.push({ reading, delta, period, options });
    }

    ${coreFunctions}
    ${flowFunctions}

    globalThis.rankingEligibilityHarness = {
      setStock(serialized) {
        currentReadingStock = JSON.parse(serialized);
      },
      add(reading, options) {
        return addReadingToStock(reading, '', [], options);
      },
      remove(reading) {
        return removeReadingFromStock(reading);
      },
      stockSnapshot() {
        return JSON.stringify(currentReadingStock);
      }
    };
  `, sandbox, { filename: UI_FLOW_SOURCE_PATH });

  return {
    rankingCalls,
    setStock(items) {
      sandbox.rankingEligibilityHarness.setStock(JSON.stringify(items));
      rankingCalls.length = 0;
    },
    add(reading, options = {}) {
      return sandbox.rankingEligibilityHarness.add(reading, options);
    },
    remove(reading) {
      return sandbox.rankingEligibilityHarness.remove(reading);
    },
    stockSnapshot() {
      return JSON.parse(sandbox.rankingEligibilityHarness.stockSnapshot());
    }
  };
}

function untrackedStock(reading, overrides = {}) {
  return {
    id: `${reading}::`,
    reading,
    segments: [],
    baseNickname: '',
    basePosition: '',
    tags: [],
    isSuper: false,
    ownSuper: false,
    partnerSuper: false,
    source: '',
    gender: 'neutral',
    addedAt: '2026-01-01T00:00:00.000Z',
    statsTracked: false,
    readingPromoted: false,
    ...overrides
  };
}

test('reading swipe like and super each activate one deduplicated ranking vote', () => {
  const likeHarness = createRankingEligibilityHarness();
  likeHarness.setStock([]);
  const liked = likeHarness.add('はると', {
    source: 'reading-swipe',
    trackRankingVote: true
  });

  assert.equal(liked.statsTracked, true);
  assert.equal(likeHarness.rankingCalls.length, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(likeHarness.rankingCalls[0])), {
    reading: 'はると',
    delta: 1,
    period: 'all',
    options: {
      gender: 'neutral',
      scope: 'all'
    }
  });

  likeHarness.add('はると', {
    source: 'reading-swipe',
    trackRankingVote: true,
    isSuper: true
  });
  assert.equal(likeHarness.rankingCalls.length, 1, 'a second action for the same reading must not add another vote');
  assert.equal(likeHarness.stockSnapshot()[0].isSuper, true);

  const superHarness = createRankingEligibilityHarness();
  superHarness.setStock([]);
  const starred = superHarness.add('あおい', {
    source: 'reading-swipe',
    trackRankingVote: true,
    isSuper: true
  });
  assert.equal(starred.statsTracked, true);
  assert.equal(superHarness.rankingCalls.length, 1);
});

test('an existing untracked reading is promoted to a ranking vote by an explicit user choice', () => {
  const harness = createRankingEligibilityHarness();
  harness.setStock([untrackedStock('みなと', { source: 'reading-search' })]);

  const entry = harness.add('みなと', {
    source: 'reading-swipe',
    trackRankingVote: true
  });

  assert.equal(entry.statsTracked, true);
  assert.equal(harness.rankingCalls.length, 1);
  assert.equal(harness.stockSnapshot().length, 1);
});

test('validated direct-name save can activate a reading ranking vote', () => {
  const harness = createRankingEligibilityHarness();
  harness.setStock([]);

  const entry = harness.add('きよら', {
    source: 'direct-name',
    trackRankingVote: true
  });

  assert.equal(entry.statsTracked, true);
  assert.equal(entry.source, 'direct-name');
  assert.equal(harness.rankingCalls.length, 1);
});

test('sync, import, and passive stock additions remain excluded from reading ranking votes', () => {
  const harness = createRankingEligibilityHarness();
  harness.setStock([]);

  const synced = harness.add('つむぎ', {
    source: 'partner-reading'
  });
  const imported = harness.add('さくら', {
    source: 'child-import',
    trackStats: false
  });

  assert.equal(synced.statsTracked, false);
  assert.equal(imported.statsTracked, false);
  assert.equal(harness.rankingCalls.length, 0);
});

test('removing a reading reverses only an active ranking vote', () => {
  const trackedHarness = createRankingEligibilityHarness();
  trackedHarness.setStock([untrackedStock('りん', { statsTracked: true })]);
  trackedHarness.remove('りん');
  assert.equal(trackedHarness.rankingCalls.length, 1);
  assert.equal(trackedHarness.rankingCalls[0].delta, -1);

  const untrackedHarness = createRankingEligibilityHarness();
  untrackedHarness.setStock([untrackedStock('れん')]);
  untrackedHarness.remove('れん');
  assert.equal(untrackedHarness.rankingCalls.length, 0);
});

function createReadingRankingOutboxHarness(options = {}) {
  const functions = extractFunctionDeclarations(UI_FLOW_SOURCE_PATH, [
    'getReadingBaseReading',
    'normalizeReadingRankingOutboxReading',
    'normalizeReadingRankingOutboxEntry',
    'readReadingRankingOutbox',
    'writeReadingRankingOutbox',
    'enqueueReadingRankingOutbox',
    'scheduleReadingRankingOutboxRetry',
    'flushReadingRankingOutbox',
    'syncReadingStockRankingStats'
  ]);
  const storage = new Map(Object.entries(options.storage || {}));
  const warnings = [];
  const calls = [];
  const timers = new Map();
  let nextTimerId = 1;
  const outcomes = Array.isArray(options.outcomes) ? [...options.outcomes] : [];
  const record = (reading, delta, period, methodOptions) => {
    calls.push({ reading, delta, period, options: methodOptions });
    const outcome = outcomes.length > 0 ? outcomes.shift() : true;
    if (typeof outcome === 'function') return outcome();
    if (outcome instanceof Error) return Promise.reject(outcome);
    return Promise.resolve(outcome);
  };
  const sandbox = {
    warnings,
    calls,
    Date,
    console: {
      warn(...args) {
        warnings.push(args.map(String).join(' '));
      }
    },
    localStorage: {
      getItem(key) {
        return storage.has(key) ? storage.get(key) : null;
      },
      setItem(key, value) {
        storage.set(key, String(value));
      },
      removeItem(key) {
        storage.delete(key);
      }
    },
    setTimeout(callback) {
      const timerId = nextTimerId;
      nextTimerId += 1;
      timers.set(timerId, callback);
      return timerId;
    },
    clearTimeout(timerId) {
      timers.delete(timerId);
    },
    MeimayStats: {
      recordReadingLike(reading, delta, period, methodOptions) {
        return record(reading, delta, period, methodOptions);
      },
      recordReadingUnlike(reading, delta, period, methodOptions) {
        return record(reading, delta, period, methodOptions);
      }
    }
  };
  vm.createContext(sandbox);
  vm.runInContext(`
    const READING_RANKING_OUTBOX_STORAGE_KEY = 'meimay_reading_ranking_outbox_v1';
    const READING_RANKING_OUTBOX_RETRY_DELAYS = [5000, 30000, 120000, 300000];
    let readingRankingOutboxFlushPromise = null;
    let readingRankingOutboxRetryTimer = null;
    let readingRankingOutboxRetryAttempt = 0;

    ${functions}
    globalThis.outboxHarness = {
      sync(delta = 1) {
        return syncReadingStockRankingStats('はると', 1, 'all', {
          gender: 'neutral',
          scope: 'all'
        });
      },
      syncValue(reading, delta = 1) {
        return syncReadingStockRankingStats(reading, delta, 'all', {
          gender: 'neutral',
          scope: 'all'
        });
      },
      flush() {
        return flushReadingRankingOutbox();
      },
      read() {
        return JSON.stringify(readReadingRankingOutbox());
      }
    };
  `, sandbox, { filename: UI_FLOW_SOURCE_PATH });

  return {
    calls,
    outcomes,
    storage,
    timers,
    warnings,
    sync(reading = 'はると', delta = 1) {
      return sandbox.outboxHarness.syncValue(reading, delta);
    },
    flush() {
      return sandbox.outboxHarness.flush();
    },
    read() {
      return JSON.parse(sandbox.outboxHarness.read());
    }
  };
}

test('a failed remote reading vote stays queued without blocking the saved stock', async () => {
  const harness = createReadingRankingOutboxHarness({
    outcomes: [new Error('simulated remote failure')]
  });

  let request;
  assert.doesNotThrow(() => {
    request = harness.sync('はると', 1);
  });
  assert.equal(await request, false);
  assert.equal(harness.read()['はると'].active, true);
  assert.equal(harness.timers.size, 1);
  assert.match(harness.warnings.join('\n'), /reading stock sync failed/);
  assert.match(harness.warnings.join('\n'), /remains queued/);
});

test('a queued reading vote is removed only after a successful retry', async () => {
  const harness = createReadingRankingOutboxHarness({ outcomes: [false] });

  assert.equal(await harness.sync('はると', 1), false);
  assert.equal(harness.read()['はると'].active, true);

  harness.outcomes.push(true);
  assert.equal(await harness.flush(), true);
  assert.deepEqual(harness.read(), {});
  assert.equal(harness.calls.length, 2);
  assert.deepEqual(harness.calls.map((call) => call.delta), [1, 1]);
});

test('a newer unlike is not erased by an older in-flight like', async () => {
  let resolveFirst;
  const firstRequest = new Promise((resolve) => {
    resolveFirst = resolve;
  });
  const harness = createReadingRankingOutboxHarness({
    outcomes: [() => firstRequest, true]
  });

  const likePromise = harness.sync('はると', 1);
  const unlikePromise = harness.sync('はると', -1);
  assert.equal(harness.read()['はると'].active, false);

  resolveFirst(true);
  assert.equal(await likePromise, true);
  assert.equal(await unlikePromise, true);
  assert.deepEqual(harness.calls.map((call) => call.delta), [1, -1]);
  assert.deepEqual(harness.read(), {});
});

test('the new outbox leaves legacy reading stock data untouched', async () => {
  const legacyStock = JSON.stringify([
    { reading: 'はると', statsTracked: true },
    { reading: 'みなと' }
  ]);
  const harness = createReadingRankingOutboxHarness({
    storage: {
      meimay_reading_stock: legacyStock
    },
    outcomes: [true]
  });

  assert.equal(await harness.sync('はると', 1), true);
  assert.equal(harness.storage.get('meimay_reading_stock'), legacyStock);
  assert.deepEqual(harness.read(), {});
});

test('malformed reading votes are rejected before entering the retry outbox', async () => {
  const harness = createReadingRankingOutboxHarness({ outcomes: [true] });

  assert.equal(await harness.sync('あ1', 1), false);
  assert.equal(await harness.sync('あ・', 1), false);
  assert.equal(await harness.sync('あ'.repeat(25), 1), false);
  assert.equal(harness.calls.length, 0);
  assert.deepEqual(harness.read(), {});
});
