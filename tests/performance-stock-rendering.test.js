const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const { performance } = require('node:perf_hooks');
const acorn = require('acorn');

const CORE_SOURCE_PATH = path.join(__dirname, '..', 'public', 'js', '01-core.js');
const UI_FLOW_SOURCE_PATH = path.join(__dirname, '..', 'public', 'js', '04-ui-flow.js');
const BUILD_SOURCE_PATH = path.join(__dirname, '..', 'public', 'js', '07-build.js');
const FIREBASE_SOURCE_PATH = path.join(__dirname, '..', 'public', 'js', '15-firebase.js');
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

function createFakeElementFactory(counters) {
  return function createFakeElement() {
    let innerHTML = '';
    const element = {
      children: [],
      className: '',
      id: '',
      dataset: {},
      style: {},
      classList: {
        toggle() {}
      },
      appendChild(child) {
        counters.domAppendCalls += 1;
        this.children.push(child);
        return child;
      },
      setAttribute() {
        counters.attributeWrites += 1;
      }
    };
    Object.defineProperty(element, 'innerHTML', {
      get() {
        return innerHTML;
      },
      set(value) {
        innerHTML = String(value || '');
        counters.innerHTMLAssignments += 1;
        counters.innerHTMLCharacters += innerHTML.length;
      }
    });
    return element;
  };
}

function createKanjiStockRenderHarness() {
  const counters = {
    findComparisons: 0,
    filterCallbacks: 0,
    mapCallbacks: 0,
    sortComparisons: 0,
    domCreateCalls: 0,
    domAppendCalls: 0,
    attributeWrites: 0,
    innerHTMLAssignments: 0,
    innerHTMLCharacters: 0
  };
  const renderStockSource = extractFunctionDeclarations(BUILD_SOURCE_PATH, ['renderStock']);
  const createFakeElement = createFakeElementFactory(counters);
  const stockContainer = createFakeElement();
  const sandbox = {
    console: {
      log() {},
      warn() {},
      error() {}
    },
    counters,
    stockContainer,
    document: {
      getElementById(id) {
        return id === 'stock-list' ? stockContainer : null;
      },
      createElement() {
        counters.domCreateCalls += 1;
        return createFakeElement();
      }
    },
    window: {}
  };

  vm.createContext(sandbox);
  vm.runInContext(`
    let liked = [];

    function isImportedKanjiLibraryItem() {
      return false;
    }
    function hydrateLikedCandidate(item) {
      return item;
    }
    function buildLikedCandidateKey(item) {
      return \`\${item?.sessionReading || ''}::\${item?.kanji || item?.['漢字'] || ''}\`;
    }
    function mergeLikedCandidateOwnershipState(target) {
      return target;
    }
    function getReadingHistory() {
      return [];
    }
    function getLatestReadingHistoryLookup() {
      return {};
    }
    function isCompoundSlotPlaceholder() {
      return false;
    }
    function getReadableSegmentForItem(item) {
      return item?.sessionReading || '';
    }
    function getSegmentKanjiCandidateKey(item, segment) {
      return \`\${segment || ''}::\${item?.kanji || item?.['漢字'] || ''}\`;
    }
    function getStockOwnershipKind() {
      return 'self';
    }
    function isStockMutualCard() {
      return false;
    }
    function getStockCardSurfaceStyle() {
      return {
        card: 'background:#fff',
        kanjiColor: '#000',
        strokesColor: '#555'
      };
    }
    function renderStockSuperStars() {
      return '';
    }

    ${renderStockSource}

    const nativeFind = Array.prototype.find;
    const nativeFilter = Array.prototype.filter;
    const nativeMap = Array.prototype.map;
    const nativeSort = Array.prototype.sort;

    Array.prototype.find = function (callback, thisArg) {
      return nativeFind.call(this, (value, index, array) => {
        counters.findComparisons += 1;
        return callback.call(thisArg, value, index, array);
      });
    };
    Array.prototype.filter = function (callback, thisArg) {
      return nativeFilter.call(this, (value, index, array) => {
        counters.filterCallbacks += 1;
        return callback.call(thisArg, value, index, array);
      });
    };
    Array.prototype.map = function (callback, thisArg) {
      return nativeMap.call(this, (value, index, array) => {
        counters.mapCallbacks += 1;
        return callback.call(thisArg, value, index, array);
      });
    };
    Array.prototype.sort = function (compareFn) {
      if (typeof compareFn !== 'function') return nativeSort.call(this);
      return nativeSort.call(this, (left, right) => {
        counters.sortComparisons += 1;
        return compareFn(left, right);
      });
    };

    globalThis.kanjiStockRenderHarness = {
      configure(serializedItems) {
        liked = JSON.parse(serializedItems);
        stockContainer.children.length = 0;
      },
      resetCounters() {
        counters.findComparisons = 0;
        counters.filterCallbacks = 0;
        counters.mapCallbacks = 0;
        counters.sortComparisons = 0;
        counters.domCreateCalls = 0;
        counters.domAppendCalls = 0;
        counters.attributeWrites = 0;
        counters.innerHTMLAssignments = 0;
        counters.innerHTMLCharacters = 0;
      },
      run() {
        renderStock();
      }
    };
  `, sandbox, { filename: BUILD_SOURCE_PATH });

  return {
    counters,
    configure(items) {
      sandbox.kanjiStockRenderHarness.configure(JSON.stringify(items));
    },
    resetCounters() {
      sandbox.kanjiStockRenderHarness.resetCounters();
    },
    run() {
      sandbox.kanjiStockRenderHarness.run();
    }
  };
}

function createReadingStockRenderHarness() {
  const counters = {
    baseReadingCalls: 0,
    stockLookupCalls: 0,
    filterCallbacks: 0,
    mapCallbacks: 0,
    sortComparisons: 0,
    stringifyCalls: 0,
    stringifiedCharacters: 0,
    innerHTMLAssignments: 0,
    innerHTMLCharacters: 0,
    domAppendCalls: 0,
    attributeWrites: 0
  };
  const coreFunctions = extractFunctionDeclarations(CORE_SOURCE_PATH, [
    'normalizeReadingComparisonValue'
  ]);
  const flowFunctions = extractFunctionDeclarations(UI_FLOW_SOURCE_PATH, [
    'normalizeReadingStockSoundValue',
    'getReadingStockSoundFilter',
    'getReadingStockGroupKey',
    'getReadingStockKey',
    'resolveReadingStockValue',
    'getReadingDisplayLabel',
    'getReadingBaseReading',
    'isReadingStockPromoted',
    'isReadingStockStarred',
    'sortReadingStockMatches',
    'findReadingStockItemInStock',
    'findReadingStockItem',
    'getPartnerViewReadingKey',
    'getPartnerViewNormalizedReading',
    'renderReadingStockSectionV2'
  ]);
  const createFakeElement = createFakeElementFactory(counters);
  const readingSection = createFakeElement();
  const emptyMessage = createFakeElement();
  const sandbox = {
    console: {
      log() {},
      warn() {},
      error() {}
    },
    counters,
    readingSection,
    emptyMessage,
    localStorage: {
      getItem() {
        return null;
      }
    },
    document: {
      getElementById(id) {
        if (id === 'reading-stock-section') return readingSection;
        if (id === 'reading-stock-empty') return emptyMessage;
        return null;
      }
    },
    window: {}
  };

  vm.createContext(sandbox);
  vm.runInContext(`
    let readingStockSoundFilter = null;
    let currentReadingStock = [];
    let currentOwnLiked = [];

    function getReadingStock() {
      return currentReadingStock;
    }
    function getVisibleOwnLikedReadingsForUI() {
      return currentOwnLiked;
    }
    function getReadingHistory() {
      return [];
    }
    function getHiddenReadingSet() {
      return new Set();
    }
    function isReadingStockVisible() {
      return true;
    }
    function getReadingCardToneV2() {
      return {
        card: 'border:1px solid #eee;background:#fff',
        title: '#222',
        sub: '#777',
        action: 'background:#888;color:#fff',
        actionGhost: 'background:#fff;color:#888'
      };
    }
    function renderReadingTitleWithStarsV2(label) {
      return \`<span class="reading-title-text">\${String(label || '')}</span>\`;
    }

    ${coreFunctions}
    ${flowFunctions}

    const nativeBaseReading = getReadingBaseReading;
    getReadingBaseReading = function (...args) {
      counters.baseReadingCalls += 1;
      return nativeBaseReading(...args);
    };
    const nativeStockLookup = findReadingStockItem;
    findReadingStockItem = function (...args) {
      counters.stockLookupCalls += 1;
      return nativeStockLookup(...args);
    };

    const nativeFilter = Array.prototype.filter;
    const nativeMap = Array.prototype.map;
    const nativeSort = Array.prototype.sort;
    const nativeStringify = JSON.stringify;

    Array.prototype.filter = function (callback, thisArg) {
      return nativeFilter.call(this, (value, index, array) => {
        counters.filterCallbacks += 1;
        return callback.call(thisArg, value, index, array);
      });
    };
    Array.prototype.map = function (callback, thisArg) {
      return nativeMap.call(this, (value, index, array) => {
        counters.mapCallbacks += 1;
        return callback.call(thisArg, value, index, array);
      });
    };
    Array.prototype.sort = function (compareFn) {
      if (typeof compareFn !== 'function') return nativeSort.call(this);
      return nativeSort.call(this, (left, right) => {
        counters.sortComparisons += 1;
        return compareFn(left, right);
      });
    };
    JSON.stringify = function (...args) {
      counters.stringifyCalls += 1;
      const result = nativeStringify(...args);
      counters.stringifiedCharacters += typeof result === 'string' ? result.length : 0;
      return result;
    };

    globalThis.readingStockRenderHarness = {
      configure(serializedStock, serializedOwnLiked) {
        currentReadingStock = JSON.parse(serializedStock);
        currentOwnLiked = JSON.parse(serializedOwnLiked);
      },
      resetCounters() {
        counters.baseReadingCalls = 0;
        counters.stockLookupCalls = 0;
        counters.filterCallbacks = 0;
        counters.mapCallbacks = 0;
        counters.sortComparisons = 0;
        counters.stringifyCalls = 0;
        counters.stringifiedCharacters = 0;
        counters.innerHTMLAssignments = 0;
        counters.innerHTMLCharacters = 0;
        counters.domAppendCalls = 0;
        counters.attributeWrites = 0;
      },
      run() {
        renderReadingStockSectionV2();
      }
    };
  `, sandbox, { filename: UI_FLOW_SOURCE_PATH });

  return {
    counters,
    configure(stock, ownLiked) {
      sandbox.readingStockRenderHarness.configure(
        JSON.stringify(stock),
        JSON.stringify(ownLiked)
      );
    },
    resetCounters() {
      sandbox.readingStockRenderHarness.resetCounters();
    },
    run() {
      sandbox.readingStockRenderHarness.run();
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

function buildKanjiStockItems(count) {
  return Array.from({ length: count }, (_, index) => ({
    kanji: `字${kanaKey(index)}`,
    '漢字': `字${kanaKey(index)}`,
    '画数': (index % 20) + 1,
    sessionReading: 'あお',
    sessionSegments: ['あ'],
    slot: 0,
    fromPartner: false,
    isSuper: index % 20 === 0,
    ownSuper: index % 20 === 0,
    partnerSuper: false
  }));
}

function buildReadingStockItems(count) {
  return Array.from({ length: count }, (_, index) => ({
    id: `pending-${index}`,
    reading: `ま${kanaKey(index)}`,
    segments: [],
    baseNickname: '',
    basePosition: '',
    isSuper: index % 20 === 0,
    ownSuper: index % 20 === 0,
    partnerSuper: false,
    readingPromoted: index % 2 === 0,
    addedAt: new Date(1700000000000 + index * 1000).toISOString()
  }));
}

function buildCompletedLikedItems(count) {
  return Array.from({ length: count }, (_, index) => ({
    sessionReading: `よ${kanaKey(index)}`,
    sessionSegments: [`よ${kanaKey(index)}`],
    slot: 0,
    kanji: `字${kanaKey(index)}`,
    fromPartner: false
  }));
}

test('kanji stock rendering indexes same-segment duplicates and preserves DOM work', (t) => {
  const harness = createKanjiStockRenderHarness();
  const measurements = [];

  DATASET_SIZES.forEach((size) => {
    harness.configure(buildKanjiStockItems(size));
    harness.resetCounters();
    const startedAt = performance.now();
    harness.run();
    const elapsedMs = performance.now() - startedAt;
    assert.equal(harness.counters.findComparisons, 0);
    assert.equal(harness.counters.domCreateCalls, size + 2);
    assert.equal(harness.counters.domAppendCalls, size + 2);

    measurements.push({
      stockItems: size,
      elapsedMs: Number(elapsedMs.toFixed(3)),
      findComparisons: harness.counters.findComparisons,
      filterCallbacks: harness.counters.filterCallbacks,
      mapCallbacks: harness.counters.mapCallbacks,
      sortComparisons: harness.counters.sortComparisons,
      domCreateCalls: harness.counters.domCreateCalls,
      domAppendCalls: harness.counters.domAppendCalls,
      innerHTMLAssignments: harness.counters.innerHTMLAssignments,
      innerHTMLCharacters: harness.counters.innerHTMLCharacters
    });
  });

  t.diagnostic(`kanji stock render baseline: ${JSON.stringify(measurements)}`);
});

test('reading stock rendering indexes completed counts and pending lookups', (t) => {
  const harness = createReadingStockRenderHarness();
  const measurements = [];

  DATASET_SIZES.forEach((size) => {
    harness.configure(
      buildReadingStockItems(size),
      buildCompletedLikedItems(size)
    );
    harness.resetCounters();
    const startedAt = performance.now();
    harness.run();
    const elapsedMs = performance.now() - startedAt;

    assert.equal(harness.counters.stockLookupCalls, 0);
    assert.ok(
      harness.counters.filterCallbacks <= size * 20,
      'reading-stock indexed rendering exceeded the linear characterization ceiling'
    );

    measurements.push({
      pendingStock: size,
      completedReadings: size,
      elapsedMs: Number(elapsedMs.toFixed(3)),
      baseReadingCalls: harness.counters.baseReadingCalls,
      stockLookupCalls: harness.counters.stockLookupCalls,
      filterCallbacks: harness.counters.filterCallbacks,
      mapCallbacks: harness.counters.mapCallbacks,
      sortComparisons: harness.counters.sortComparisons,
      stringifyCalls: harness.counters.stringifyCalls,
      stringifiedCharacters: harness.counters.stringifiedCharacters,
      innerHTMLAssignments: harness.counters.innerHTMLAssignments,
      innerHTMLCharacters: harness.counters.innerHTMLCharacters
    });
  });

  t.diagnostic(`reading stock render baseline: ${JSON.stringify(measurements)}`);
});

test('partner refresh renders only the visible stock tab', () => {
  const refreshSource = extractFunctionDeclarations(FIREBASE_SOURCE_PATH, ['refreshPartnerAwareUI']);
  const counters = {
    kanjiRenders: 0,
    readingRenders: 0
  };
  const sandbox = {
    counters,
    document: {
      getElementById(id) {
        if (id !== 'scr-stock') return null;
        return {
          classList: {
            contains(className) {
              return className === 'active';
            }
          }
        };
      }
    },
    window: {}
  };

  vm.createContext(sandbox);
  vm.runInContext(`
    let currentStockTab = 'kanji';
    function renderStock() {
      counters.kanjiRenders += 1;
    }
    function renderReadingStockSection() {
      counters.readingRenders += 1;
    }

    ${refreshSource}

    globalThis.partnerRefreshHarness = {
      setTab(tab) {
        currentStockTab = tab;
      },
      run() {
        refreshPartnerAwareUI();
      }
    };
  `, sandbox, { filename: FIREBASE_SOURCE_PATH });

  sandbox.partnerRefreshHarness.run();
  assert.deepEqual(counters, { kanjiRenders: 1, readingRenders: 0 });

  sandbox.partnerRefreshHarness.setTab('reading');
  sandbox.partnerRefreshHarness.run();
  assert.deepEqual(counters, { kanjiRenders: 1, readingRenders: 1 });
});
