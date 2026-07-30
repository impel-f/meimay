const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const { performance } = require('node:perf_hooks');
const acorn = require('acorn');

const STORAGE_SOURCE_PATH = path.join(__dirname, '..', 'public', 'js', '09-storage.js');
const DATASET_SIZES = [100, 300, 1000];
const WARMUP_RUNS = 2;
const MEASURED_RUNS = 7;

function getPropertyName(property) {
  if (!property || property.type !== 'Property') return '';
  if (property.computed) return '';
  if (property.key.type === 'Identifier') return property.key.name;
  if (property.key.type === 'Literal') return String(property.key.value);
  return '';
}

function extractStorageBoxProperties(propertyNames) {
  const source = fs.readFileSync(STORAGE_SOURCE_PATH, 'utf8');
  const ast = acorn.parse(source, { ecmaVersion: 'latest', sourceType: 'script' });
  const declaration = ast.body.find((node) =>
    node.type === 'VariableDeclaration'
    && node.declarations.some((entry) => entry.id?.name === 'StorageBox')
  );
  assert.ok(declaration, 'StorageBox declaration must remain discoverable');

  const storageDeclarator = declaration.declarations.find((entry) => entry.id?.name === 'StorageBox');
  assert.equal(storageDeclarator?.init?.type, 'ObjectExpression', 'StorageBox must remain an object literal');

  const requested = new Set(propertyNames);
  const selected = storageDeclarator.init.properties
    .filter((property) => requested.has(getPropertyName(property)));
  const found = new Set(selected.map(getPropertyName));
  assert.deepEqual([...found].sort(), [...requested].sort(), 'all persistence properties must remain discoverable');

  return selected.map((property) => source.slice(property.start, property.end)).join(',\n');
}

function createCounters() {
  return {
    getCalls: 0,
    setCalls: 0,
    removeCalls: 0,
    writtenChars: 0,
    parseCalls: 0,
    stringifyCalls: 0,
    stringifyArrayCalls: 0,
    stringifyObjectCalls: 0,
    serializedChars: 0,
    syncReadingCalls: 0,
    syncReadingItems: 0,
    partnerQueueCalls: 0,
    notifyCalls: 0
  };
}

function resetCounters(counters) {
  Object.keys(counters).forEach((key) => {
    counters[key] = 0;
  });
}

function createMemoryStorage(counters) {
  const store = new Map();
  return {
    clear() {
      store.clear();
    },
    getItem(key) {
      counters.getCalls += 1;
      return store.has(String(key)) ? store.get(String(key)) : null;
    },
    setItem(key, value) {
      const serialized = String(value);
      counters.setCalls += 1;
      counters.writtenChars += serialized.length;
      store.set(String(key), serialized);
    },
    removeItem(key) {
      counters.removeCalls += 1;
      store.delete(String(key));
    }
  };
}

function createInstrumentedJson(counters) {
  return {
    parse(value) {
      counters.parseCalls += 1;
      return JSON.parse(value);
    },
    stringify(value) {
      const serialized = JSON.stringify(value);
      counters.stringifyCalls += 1;
      counters.serializedChars += serialized.length;
      if (Array.isArray(value)) {
        counters.stringifyArrayCalls += 1;
      } else {
        counters.stringifyObjectCalls += 1;
      }
      return serialized;
    }
  };
}

function createPersistenceHarness() {
  const counters = createCounters();
  const localStorage = createMemoryStorage(counters);
  const propertySource = extractStorageBoxProperties([
    'KEY_LIKED',
    'KEY_LIKED_LEGACY',
    'KEY_LIKED_BACKUP',
    'KEY_LIKED_META',
    'KEY_LIKED_CLEARED',
    'KEY_BUILD_EXCLUDED',
    'KEY_LIKED_REMOVED',
    '_readStoredArray',
    '_normalizeLikedRemovalKey',
    '_extractLikedRemovalKeys',
    '_loadLikedRemovalState',
    '_isRemovedLikedItem',
    '_filterRemovedLikedItems',
    '_persistLikedState',
    '_persistBuildExclusionState',
    'saveLiked'
  ]);
  const sandbox = {
    console: {
      log() {},
      warn() {},
      error() {}
    },
    counters,
    JSON: createInstrumentedJson(counters),
    localStorage,
    syncReadingStockFromLiked(items) {
      counters.syncReadingCalls += 1;
      counters.syncReadingItems += Array.isArray(items) ? items.length : 0;
    },
    queuePartnerStockSync() {
      counters.partnerQueueCalls += 1;
    },
    notifyStockStateChanged() {
      counters.notifyCalls += 1;
    }
  };

  vm.createContext(sandbox);
  vm.runInContext(`
    const StorageBox = {
      ${propertySource}
    };
    globalThis.performanceTarget = StorageBox;
  `, sandbox, { filename: STORAGE_SOURCE_PATH });

  return {
    counters,
    localStorage,
    reset() {
      localStorage.clear();
      resetCounters(counters);
    },
    run(items, options = {}) {
      sandbox.liked = items;
      return sandbox.performanceTarget.saveLiked(options);
    }
  };
}

function buildLikedItems(count) {
  return Array.from({ length: count }, (_, index) => {
    const readingIndex = index % 150;
    return {
      '漢字': `字${index}`,
      reading: `よみ${readingIndex}`,
      sessionReading: `よみ${readingIndex}`,
      sessionSegments: [`よ`, `み${readingIndex}`],
      slot: index % 3,
      tags: [`tag-${index % 12}`, `tone-${index % 5}`],
      gender: index % 2 === 0 ? 'male' : 'female',
      isSuper: index % 20 === 0,
      fromPartner: false
    };
  });
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

test('saveLiked persistence cost is characterized for 100, 300, and 1000 items', (t) => {
  const harness = createPersistenceHarness();
  const measurements = [];

  DATASET_SIZES.forEach((size) => {
    const items = buildLikedItems(size);
    const originalSnapshot = JSON.stringify(items);
    const elapsed = [];
    let lastCounters = null;

    for (let runIndex = 0; runIndex < WARMUP_RUNS + MEASURED_RUNS; runIndex += 1) {
      harness.reset();
      const startedAt = performance.now();
      const result = harness.run(items);
      const durationMs = performance.now() - startedAt;

      assert.equal(result, true);
      if (runIndex >= WARMUP_RUNS) elapsed.push(durationMs);
      lastCounters = { ...harness.counters };
    }

    const storedLiked = JSON.parse(harness.localStorage.getItem('naming_app_liked_chars'));
    const storedMeta = JSON.parse(harness.localStorage.getItem('meimay_liked_meta_v1'));
    const storedBuildExcluded = JSON.parse(harness.localStorage.getItem('meimay_build_excluded'));

    assert.equal(storedLiked.length, size);
    assert.equal(storedLiked[0]['漢字'], '字0');
    assert.equal(storedLiked.at(-1)['漢字'], `字${size - 1}`);
    assert.equal(storedMeta.count, size);
    assert.deepEqual(storedBuildExcluded, []);
    assert.equal(JSON.stringify(items), originalSnapshot, 'saveLiked must not mutate the input collection');

    assert.equal(lastCounters.syncReadingCalls, 1);
    assert.equal(lastCounters.syncReadingItems, size);
    assert.equal(lastCounters.stringifyCalls, 3, 'liked, metadata, and build exclusions are serialized');
    assert.equal(lastCounters.stringifyArrayCalls, 2, 'liked and build exclusions are full-array serializations');
    assert.equal(lastCounters.stringifyObjectCalls, 1, 'liked metadata is serialized once');
    assert.equal(lastCounters.setCalls, 3, 'liked, metadata, and build exclusions are written');
    assert.equal(lastCounters.partnerQueueCalls, 1);
    assert.equal(lastCounters.notifyCalls, 1);

    measurements.push({
      items: size,
      medianMs: Number(median(elapsed).toFixed(3)),
      storedKiB: Number((harness.localStorage.getItem('naming_app_liked_chars').length * 2 / 1024).toFixed(1)),
      stringifyCalls: lastCounters.stringifyCalls,
      localStorageWrites: lastCounters.setCalls,
      writtenKiB: Number((lastCounters.writtenChars * 2 / 1024).toFixed(1))
    });
  });

  t.diagnostic(`saveLiked baseline: ${JSON.stringify(measurements)}`);
});

test('saveLiked skipPartnerSync prevents partner scheduling without changing persistence', () => {
  const harness = createPersistenceHarness();
  const items = buildLikedItems(100);

  harness.reset();
  assert.equal(harness.run(items, { skipPartnerSync: true }), true);

  assert.equal(harness.counters.partnerQueueCalls, 0);
  assert.equal(harness.counters.notifyCalls, 1);
  assert.equal(JSON.parse(harness.localStorage.getItem('naming_app_liked_chars')).length, 100);
});
