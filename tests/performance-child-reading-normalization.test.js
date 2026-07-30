const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const { performance } = require('node:perf_hooks');
const acorn = require('acorn');

const FIREBASE_SOURCE_PATH = path.join(__dirname, '..', 'public', 'js', '15-firebase.js');
const CHILD_WORKSPACES_SOURCE_PATH = path.join(__dirname, '..', 'public', 'js', '21-child-workspaces.js');
const READING_SOURCE_COUNT = 11313;
const DEFAULT_DATASET_SIZES = [22, 100, 300];
const DATASET_SIZES = process.env.MEIMAY_PERF_FULL === '1'
  ? [...DEFAULT_DATASET_SIZES, 1000]
  : DEFAULT_DATASET_SIZES;

function getPropertyName(property) {
  if (!property || property.type !== 'Property' || property.computed) return '';
  if (property.key.type === 'Identifier') return property.key.name;
  if (property.key.type === 'Literal') return String(property.key.value);
  return '';
}

function findObjectDeclarator(ast, objectName) {
  const pending = [ast];
  while (pending.length > 0) {
    const node = pending.pop();
    if (!node || typeof node !== 'object') continue;
    if (node.type === 'VariableDeclarator' && node.id?.name === objectName) {
      return node;
    }
    Object.keys(node).forEach((key) => {
      if (key === 'start' || key === 'end') return;
      const value = node[key];
      if (Array.isArray(value)) {
        value.forEach((entry) => {
          if (entry && typeof entry === 'object') pending.push(entry);
        });
      } else if (value && typeof value === 'object') {
        pending.push(value);
      }
    });
  }
  return null;
}

function extractObjectProperties(filePath, objectName, propertyNames) {
  const source = fs.readFileSync(filePath, 'utf8');
  const ast = acorn.parse(source, { ecmaVersion: 'latest', sourceType: 'script' });
  const declarator = findObjectDeclarator(ast, objectName);
  assert.ok(declarator, `${objectName} declaration must remain discoverable`);
  assert.equal(declarator?.init?.type, 'ObjectExpression', `${objectName} must remain an object literal`);

  const requested = new Set(propertyNames);
  const selected = declarator.init.properties
    .filter((property) => requested.has(getPropertyName(property)));
  const found = new Set(selected.map(getPropertyName));
  assert.deepEqual([...found].sort(), [...requested].sort(), `${objectName} properties must remain discoverable`);

  return selected.map((property) => source.slice(property.start, property.end)).join(',\n');
}

function createNormalizationHarness() {
  const counters = {
    readingSourceComparisons: 0
  };
  const payloadProperties = extractObjectProperties(FIREBASE_SOURCE_PATH, 'MeimayFirestorePayload', [
    '_normalizeString',
    '_normalizeReading',
    '_normalizeList',
    '_normalizeExamples',
    '_getReadingSourceIndex',
    '_findReadingSource',
    'hydrateReadingStockItem'
  ]);
  const childProperties = extractObjectProperties(CHILD_WORKSPACES_SOURCE_PATH, 'MeimayChildWorkspaces', [
    'normalizeReadingLibrary'
  ]);
  const sandbox = {
    console: {
      log() {},
      warn() {},
      error() {}
    },
    counters,
    window: {}
  };

  vm.createContext(sandbox);
  vm.runInContext(`
    let readingsData = [];
    const nativeFind = Array.prototype.find;
    Array.prototype.find = function (predicate, thisArg) {
      return nativeFind.call(this, (value, index, array) => {
        counters.readingSourceComparisons += 1;
        return predicate.call(thisArg, value, index, array);
      });
    };

    function normalizeReadingStockItem(item) {
      return item;
    }

    const MeimayFirestorePayload = {
      ${payloadProperties}
    };
    const MeimayChildWorkspaces = {
      mergeReadingLibraries(currentItems, nextItems) {
        return { items: Array.isArray(nextItems) ? nextItems : [] };
      },
      ${childProperties}
    };
    window.MeimayFirestorePayload = MeimayFirestorePayload;

    globalThis.normalizationHarness = {
      setReadingSources(serialized) {
        readingsData = JSON.parse(serialized);
      },
      resetCounters() {
        counters.readingSourceComparisons = 0;
      },
      run(items) {
        return MeimayChildWorkspaces.normalizeReadingLibrary(items);
      }
    };
  `, sandbox, { filename: CHILD_WORKSPACES_SOURCE_PATH });

  return {
    counters,
    setReadingSources(items) {
      sandbox.normalizationHarness.setReadingSources(JSON.stringify(items));
    },
    resetCounters() {
      sandbox.normalizationHarness.resetCounters();
    },
    run(items) {
      return sandbox.normalizationHarness.run(items);
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

function buildReadingSources() {
  return Array.from({ length: READING_SOURCE_COUNT }, (_, index) => ({
    reading: `も${kanaKey(index)}`,
    adana: '',
    tags: [`source-${index % 12}`],
    examples: []
  }));
}

function buildUnmatchedReadingStock(count) {
  return Array.from({ length: count }, (_, index) => {
    const reading = `よ${kanaKey(index)}`;
    return {
      id: `${reading}::`,
      reading,
      segments: [],
      tags: [],
      examples: [],
      gender: 'neutral'
    };
  });
}

test('child reading normalization bounds full reading-source scans', (t) => {
  const harness = createNormalizationHarness();
  harness.setReadingSources(buildReadingSources());
  const measurements = [];

  DATASET_SIZES.forEach((size) => {
    const items = buildUnmatchedReadingStock(size);
    harness.resetCounters();
    const startedAt = performance.now();
    const normalized = harness.run(items);
    const elapsedMs = performance.now() - startedAt;
    const currentUpperBound = size * READING_SOURCE_COUNT;

    assert.equal(normalized.length, size);
    assert.equal(
      harness.counters.readingSourceComparisons,
      0,
      `indexed reading-source lookup must avoid the previous ${currentUpperBound} linear comparisons`
    );

    measurements.push({
      readingStock: size,
      readingSources: READING_SOURCE_COUNT,
      elapsedMs: Number(elapsedMs.toFixed(3)),
      readingSourceComparisons: harness.counters.readingSourceComparisons
    });
  });

  if (!DATASET_SIZES.includes(1000)) {
    measurements.push({
      readingStock: 1000,
      readingSources: READING_SOURCE_COUNT,
      expectedReadingSourceComparisons: 0,
      note: 'Set MEIMAY_PERF_FULL=1 to execute the full 1000-item case'
    });
  }

  t.diagnostic(`child reading normalization baseline: ${JSON.stringify(measurements)}`);
});

test('reading-source index preserves first-match precedence and invalidates on source replacement', () => {
  const harness = createNormalizationHarness();
  harness.setReadingSources([
    { reading: 'あお', adana: 'そら', tags: ['first'], examples: [] },
    { reading: 'そら', adana: '', tags: ['second'], examples: [] }
  ]);

  const firstResult = harness.run([
    { id: 'そら::', reading: 'そら', segments: [], tags: [], examples: [] }
  ]);
  assert.deepEqual(Array.from(firstResult[0].tags), ['first']);

  harness.setReadingSources([
    { reading: 'そら', adana: '', tags: ['replacement'], examples: [] }
  ]);
  const replacementResult = harness.run([
    { id: 'そら::', reading: 'そら', segments: [], tags: [], examples: [] }
  ]);
  assert.deepEqual(Array.from(replacementResult[0].tags), ['replacement']);
});
