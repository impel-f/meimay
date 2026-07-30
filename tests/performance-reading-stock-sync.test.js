const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const { performance } = require('node:perf_hooks');
const acorn = require('acorn');

const CORE_SOURCE_PATH = path.join(__dirname, '..', 'public', 'js', '01-core.js');
const UI_FLOW_SOURCE_PATH = path.join(__dirname, '..', 'public', 'js', '04-ui-flow.js');
const DATASET_SIZES = [100, 300, 1000];

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

function createSyncHarness() {
  const counters = {
    findComparisons: 0,
    filterComparisons: 0,
    sortComparisons: 0,
    saveCalls: 0,
    savedItems: 0
  };
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
    'normalizeHiddenReadingValue',
    'syncReadingStockFromLiked'
  ]);
  const sandbox = {
    console: {
      log() {},
      warn() {},
      error() {}
    },
    counters,
    gender: 'neutral',
    localStorage: {
      getItem() {
        return null;
      }
    },
    window: {}
  };

  vm.createContext(sandbox);
  vm.runInContext(`
    let currentReadingStock = [];
    const nativeFind = Array.prototype.find;
    const nativeFilter = Array.prototype.filter;
    const nativeSort = Array.prototype.sort;

    Array.prototype.find = function (predicate, thisArg) {
      return nativeFind.call(this, (value, index, array) => {
        counters.findComparisons += 1;
        return predicate.call(thisArg, value, index, array);
      });
    };
    Array.prototype.filter = function (predicate, thisArg) {
      return nativeFilter.call(this, (value, index, array) => {
        counters.filterComparisons += 1;
        return predicate.call(thisArg, value, index, array);
      });
    };
    Array.prototype.sort = function (compareFn) {
      return nativeSort.call(this, (left, right) => {
        counters.sortComparisons += 1;
        return compareFn(left, right);
      });
    };

    function getReadingStock() {
      return currentReadingStock;
    }
    function saveReadingStock(stock) {
      counters.saveCalls += 1;
      counters.savedItems = Array.isArray(stock) ? stock.length : 0;
    }

    ${coreFunctions}
    ${flowFunctions}

    globalThis.syncHarness = {
      setStock(serialized) {
        currentReadingStock = JSON.parse(serialized);
      },
      resetCounters() {
        Object.keys(counters).forEach((key) => {
          counters[key] = 0;
        });
      },
      run(items) {
        syncReadingStockFromLiked(items);
      },
      stockLength() {
        return currentReadingStock.length;
      },
      stockSnapshot() {
        return JSON.stringify(currentReadingStock);
      }
    };
  `, sandbox, { filename: UI_FLOW_SOURCE_PATH });

  return {
    counters,
    setStock(items) {
      sandbox.syncHarness.setStock(JSON.stringify(items));
    },
    resetCounters() {
      sandbox.syncHarness.resetCounters();
    },
    run(items) {
      sandbox.syncHarness.run(items);
    },
    stockLength() {
      return sandbox.syncHarness.stockLength();
    },
    stockSnapshot() {
      return JSON.parse(sandbox.syncHarness.stockSnapshot());
    }
  };
}

const KANA_DIGITS = [
  'あ', 'い', 'う', 'え', 'お',
  'か', 'き', 'く', 'け', 'こ',
  'さ', 'し', 'す', 'せ', 'そ',
  'た', 'ち', 'つ', 'て', 'と',
  'な', 'に', 'ぬ', 'ね', 'の',
  'は', 'ひ', 'ふ', 'へ', 'ほ',
  'ま', 'み', 'む', 'め', 'も',
  'や', 'ゆ', 'よ',
  'ら', 'り', 'る', 'れ', 'ろ',
  'わ'
];

function kanaKey(index) {
  const base = KANA_DIGITS.length;
  let value = index;
  let result = '';
  for (let digit = 0; digit < 3; digit += 1) {
    result = KANA_DIGITS[value % base] + result;
    value = Math.floor(value / base);
  }
  return result;
}

function readingFor(prefix, index) {
  return `${prefix}${kanaKey(index)}`;
}

function buildLikedItems(count, prefix = 'よ') {
  return Array.from({ length: count }, (_, index) => ({
    reading: readingFor(prefix, index),
    sessionReading: readingFor(prefix, index),
    tags: [],
    gender: 'neutral',
    fromPartner: false,
    readingPromoted: false,
    isSuper: false
  }));
}

function buildReadingStock(count, prefix = 'す') {
  return Array.from({ length: count }, (_, index) => {
    const reading = readingFor(prefix, index);
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
      statsTracked: true,
      readingPromoted: false
    };
  });
}

function runMeasuredSync(harness, likedItems, stockItems) {
  harness.setStock(stockItems);
  harness.resetCounters();
  const startedAt = performance.now();
  harness.run(likedItems);
  const elapsedMs = performance.now() - startedAt;
  return {
    elapsedMs,
    stockLength: harness.stockLength(),
    counters: { ...harness.counters }
  };
}

test('reading-stock sync characterizes the exact-match path', (t) => {
  const harness = createSyncHarness();
  const measurements = [];

  DATASET_SIZES.forEach((size) => {
    const likedItems = buildLikedItems(size, 'よ');
    const stockItems = buildReadingStock(size, 'よ');
    const result = runMeasuredSync(harness, likedItems, stockItems);
    const expectedFindComparisons = size * (size + 1) / 2;

    assert.ok(
      result.counters.findComparisons <= expectedFindComparisons,
      `exact-match comparisons exceeded ${expectedFindComparisons}`
    );
    assert.equal(result.counters.filterComparisons, 0);
    assert.equal(result.counters.sortComparisons, 0);
    assert.equal(result.counters.saveCalls, 0, 'unchanged exact matches must not rewrite reading stock');
    assert.equal(result.stockLength, size);

    measurements.push({
      liked: size,
      stock: size,
      elapsedMs: Number(result.elapsedMs.toFixed(3)),
      findComparisons: result.counters.findComparisons,
      filterComparisons: result.counters.filterComparisons,
      saveCalls: result.counters.saveCalls
    });
  });

  t.diagnostic(`reading sync exact-match baseline: ${JSON.stringify(measurements)}`);
});

test('reading-stock sync characterizes the no-match path', (t) => {
  const harness = createSyncHarness();
  const measurements = [];

  DATASET_SIZES.forEach((size) => {
    const likedItems = buildLikedItems(size, 'よ');
    const stockItems = buildReadingStock(size, 'す');
    const result = runMeasuredSync(harness, likedItems, stockItems);
    const comparisonsPerMethod = size * size + size * (size - 1) / 2;

    assert.ok(
      result.counters.findComparisons <= comparisonsPerMethod,
      `no-match find comparisons exceeded ${comparisonsPerMethod}`
    );
    assert.ok(
      result.counters.filterComparisons <= comparisonsPerMethod,
      `no-match filter comparisons exceeded ${comparisonsPerMethod}`
    );
    assert.equal(result.counters.sortComparisons, 0);
    assert.equal(result.counters.saveCalls, 1);
    assert.equal(result.counters.savedItems, size * 2);
    assert.equal(result.stockLength, size * 2);

    measurements.push({
      liked: size,
      initialStock: size,
      elapsedMs: Number(result.elapsedMs.toFixed(3)),
      findComparisons: result.counters.findComparisons,
      filterComparisons: result.counters.filterComparisons,
      totalComparisons: result.counters.findComparisons + result.counters.filterComparisons,
      saveCalls: result.counters.saveCalls
    });
  });

  t.diagnostic(`reading sync no-match baseline: ${JSON.stringify(measurements)}`);
});

test('reading-stock index preserves exact-id priority and ranked fallback selection', () => {
  const harness = createSyncHarness();
  const baseItem = {
    reading: 'よし',
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
    statsTracked: true,
    readingPromoted: false
  };

  harness.setStock([
    { ...baseItem, id: 'よし::', tags: ['exact'] },
    { ...baseItem, id: 'legacy-star', tags: ['star'], isSuper: true, ownSuper: true }
  ]);
  harness.run([
    {
      reading: 'よし',
      sessionReading: 'よし',
      tags: ['new'],
      gender: 'neutral',
      fromPartner: false,
      readingPromoted: false,
      isSuper: false
    }
  ]);
  let snapshot = harness.stockSnapshot();
  assert.deepEqual(snapshot[0].tags, ['exact', 'new']);
  assert.deepEqual(snapshot[1].tags, ['star']);

  harness.setStock([
    { ...baseItem, id: 'legacy-normal', tags: ['normal'] },
    { ...baseItem, id: 'legacy-star', tags: ['star'], isSuper: true, ownSuper: true }
  ]);
  harness.run([
    {
      reading: 'よし',
      sessionReading: 'よし',
      tags: ['fallback'],
      gender: 'neutral',
      fromPartner: false,
      readingPromoted: false,
      isSuper: false
    }
  ]);
  snapshot = harness.stockSnapshot();
  assert.deepEqual(snapshot[0].tags, ['normal']);
  assert.deepEqual(snapshot[1].tags, ['star', 'fallback']);
});
