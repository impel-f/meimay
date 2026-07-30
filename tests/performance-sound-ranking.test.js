const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const { performance } = require('node:perf_hooks');
const acorn = require('acorn');

const UI_FLOW_SOURCE_PATH = path.join(__dirname, '..', 'public', 'js', '04-ui-flow.js');
const DATASET_SIZES = [100, 300, 500];

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

function createRankingHarness() {
  const counters = {
    profileCalls: 0,
    sortCalls: 0,
    sortComparisons: 0,
    mapCallbacks: 0,
    filterCallbacks: 0,
    spliceCalls: 0,
    spliceShiftedItems: 0,
    objectKeyItems: 0
  };
  const functions = extractFunctionDeclarations(UI_FLOW_SOURCE_PATH, [
    'getVowelPattern',
    'createSoundStatBucket',
    'createSoundAttributeStore',
    'createSoundPreferenceBucket',
    'normalizeSoundStringList',
    'normalizeSoundStatBucket',
    'normalizeSoundAttributeStore',
    'normalizeSoundEventRecord',
    'normalizeSoundPreferenceData',
    'getSoundCanonicalReading',
    'normalizeSoundGenderTilt',
    'getSoundCandidateProfile',
    'getSoundPreferenceInteractionCount',
    'getSoundStatAffinity',
    'getSoundProfileAffinity',
    'incrementCounter',
    'buildSoundCandidateDistribution',
    'getSoundPreferenceBlend',
    'getSoundFrequencyRarity',
    'getSoundExplorationBonus',
    'getSoundFreshnessBonus',
    'getSoundProfileSimilarity',
    'getSoundSimilarityPenalty',
    'getSoundRepetitionPenalty',
    'getSoundFatiguePenalty',
    'buildSoundRankReason',
    'isSoundRankingDebugEnabled',
    'logSoundRankingDebug',
    'getSoundDiversityConflictScore',
    'diversifySoundCandidates',
    'rankSoundCandidates',
    'rerankRemainingSoundCandidates',
    'getReadingCandidateRankScore'
  ]);
  const sandbox = {
    console: {
      log() {},
      warn() {},
      error() {},
      groupCollapsed() {},
      table() {},
      groupEnd() {}
    },
    counters,
    location: {
      hostname: 'performance.invalid',
      search: ''
    },
    localStorage: {
      getItem() {
        return null;
      }
    },
    window: {}
  };

  vm.createContext(sandbox);
  vm.runInContext(`
    const SOUND_PREFERENCE_SCHEMA_VERSION = 2;
    const SOUND_SESSION_WARMUP_LIMIT = 12;
    const SOUND_EVENT_LOG_LIMIT = 240;
    const SOUND_RANK_DEBUG_STORAGE_KEY = 'meimay_sound_debug_rank';
    const SOUND_DIVERSIFY_LOOKBACK = 5;
    const normalizedSoundPreferenceBuckets = new WeakSet();

    let soundPreferenceData;
    let SwipeState = {
      mode: 'sound',
      candidates: [],
      currentIndex: 0,
      soundSession: null
    };

    function toHira(value) {
      return String(value || '');
    }
    function splitReadingIntoMoraUnits(value) {
      return Array.from(String(value || ''));
    }
    function applySoundEventToProfile() {
      throw new Error('legacy migration is outside this ranking performance scenario');
    }

    ${functions}

    function legacyDiversifySoundCandidates(scoredCandidates, recentProfiles = []) {
      const source = Array.isArray(scoredCandidates) ? [...scoredCandidates] : [];
      const result = [];
      const seedHistory = Array.isArray(recentProfiles) ? recentProfiles.filter(Boolean) : [];
      while (source.length > 0) {
        const history = [...seedHistory, ...result.map(item => item._soundProfile).filter(Boolean)];
        let chosenIndex = 0;
        let chosenPenalty = Infinity;
        const lookahead = Math.min(12, source.length);
        for (let i = 0; i < lookahead; i += 1) {
          const candidate = source[i];
          const penalty = getSoundDiversityConflictScore(candidate?._soundProfile, history);
          if (penalty <= 0) {
            chosenIndex = i;
            chosenPenalty = penalty;
            break;
          }
          if (penalty < chosenPenalty) {
            chosenPenalty = penalty;
            chosenIndex = i;
          }
        }
        result.push(source.splice(chosenIndex, 1)[0]);
      }
      return result;
    }

    const nativeProfile = getSoundCandidateProfile;
    getSoundCandidateProfile = function (...args) {
      counters.profileCalls += 1;
      return nativeProfile(...args);
    };

    const nativeSort = Array.prototype.sort;
    const nativeMap = Array.prototype.map;
    const nativeFilter = Array.prototype.filter;
    const nativeSplice = Array.prototype.splice;
    const nativeObjectKeys = Object.keys;

    Array.prototype.sort = function (compareFn) {
      counters.sortCalls += 1;
      if (typeof compareFn !== 'function') return nativeSort.call(this);
      return nativeSort.call(this, (left, right) => {
        counters.sortComparisons += 1;
        return compareFn(left, right);
      });
    };
    Array.prototype.map = function (callback, thisArg) {
      return nativeMap.call(this, (value, index, array) => {
        counters.mapCallbacks += 1;
        return callback.call(thisArg, value, index, array);
      });
    };
    Array.prototype.filter = function (callback, thisArg) {
      return nativeFilter.call(this, (value, index, array) => {
        counters.filterCallbacks += 1;
        return callback.call(thisArg, value, index, array);
      });
    };
    Array.prototype.splice = function (start, deleteCount, ...items) {
      counters.spliceCalls += 1;
      const normalizedStart = start < 0
        ? Math.max(this.length + start, 0)
        : Math.min(start, this.length);
      const normalizedDeleteCount = arguments.length < 2
        ? this.length - normalizedStart
        : Math.max(0, Math.min(Number(deleteCount) || 0, this.length - normalizedStart));
      counters.spliceShiftedItems += Math.max(0, this.length - normalizedStart - normalizedDeleteCount);
      return nativeSplice.call(this, start, deleteCount, ...items);
    };
    Object.keys = function (value) {
      const keys = nativeObjectKeys(value);
      counters.objectKeyItems += keys.length;
      return keys;
    };

    globalThis.rankingHarness = {
      configure(serializedCandidates, serializedPreference, serializedSessionProfile) {
        soundPreferenceData = normalizeSoundPreferenceData(JSON.parse(serializedPreference));
        const sessionProfile = JSON.parse(serializedSessionProfile);
        SwipeState = {
          mode: 'sound',
          candidates: JSON.parse(serializedCandidates),
          currentIndex: 0,
          soundSession: {
            recentShown: [],
            profile: sessionProfile,
            lastRerankAt: 0
          }
        };
      },
      resetCounters() {
        Object.keys(counters).forEach((key) => {
          counters[key] = 0;
        });
      },
      run() {
        return rerankRemainingSoundCandidates();
      },
      candidateCount() {
        return SwipeState.candidates.length;
      },
      compareDiversification(serializedCandidates) {
        const candidates = JSON.parse(serializedCandidates);
        const scored = candidates.map((candidate, index) => ({
          ...candidate,
          _soundProfile: getSoundCandidateProfile(candidate),
          _soundScore: candidates.length - index
        }));
        const recentProfiles = scored.slice(0, 5).map(item => item._soundProfile);
        return {
          current: diversifySoundCandidates(scored, recentProfiles).map(item => item.reading),
          legacy: legacyDiversifySoundCandidates(scored, recentProfiles).map(item => item.reading)
        };
      }
    };
  `, sandbox, { filename: UI_FLOW_SOURCE_PATH });

  return {
    counters,
    configure(candidates, preference, sessionProfile) {
      sandbox.rankingHarness.configure(
        JSON.stringify(candidates),
        JSON.stringify(preference),
        JSON.stringify(sessionProfile)
      );
    },
    resetCounters() {
      sandbox.rankingHarness.resetCounters();
    },
    run() {
      return sandbox.rankingHarness.run();
    },
    candidateCount() {
      return sandbox.rankingHarness.candidateCount();
    },
    compareDiversification(candidates) {
      return sandbox.rankingHarness.compareDiversification(JSON.stringify(candidates));
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

function buildCandidates(count) {
  const tags = ['やさしい', '透明感', '力強い', '古風', 'モダン', '自然'];
  return Array.from({ length: count }, (_, index) => ({
    reading: kanaKey(index),
    tags: [tags[index % tags.length], tags[(index + 2) % tags.length]],
    gender: index % 3 === 0 ? 'male' : index % 3 === 1 ? 'female' : 'neutral',
    rawCount: (index * 17) % 80,
    score: (index * 13) % 100,
    popular: index % 5 === 0
  }));
}

function createStatBucket(index) {
  return {
    shown: index % 8,
    opened: index % 4,
    liked: index % 3,
    skipped: index % 2,
    saved: index % 5 === 0 ? 1 : 0,
    builtFromReading: 0,
    positive: index % 4,
    negative: index % 2,
    score: ((index % 9) - 4) / 2,
    eventCount: index % 7,
    firstSeenAt: 1700000000000 + index,
    lastSeenAt: 1700001000000 + index,
    lastActionAt: 1700002000000 + index,
    lastDwellMs: 800
  };
}

function buildAttributeStats() {
  const values = {
    moraCount: ['2', '3', '4'],
    headGroup: KANA_DIGITS.slice(0, 20),
    tailType: KANA_DIGITS.slice(10, 30),
    vowelPattern: ['aaa', 'aiu', 'ueo', 'ioa', 'eai'],
    styleTags: ['やさしい', '透明感', '力強い', '古風', 'モダン', '自然'],
    popularityBand: ['定番', '準定番', 'やや珍しい'],
    genderTilt: ['male', 'female', 'neutral']
  };
  return Object.fromEntries(
    Object.entries(values).map(([dimension, keys]) => [
      dimension,
      Object.fromEntries(keys.map((key, index) => [key, createStatBucket(index)]))
    ])
  );
}

function buildPreference(readingStatCount, eventCount) {
  const readingStats = Object.fromEntries(
    Array.from({ length: readingStatCount }, (_, index) => [kanaKey(index), createStatBucket(index)])
  );
  const events = Array.from({ length: eventCount }, (_, index) => ({
    reading: kanaKey(index % Math.max(readingStatCount, 1)),
    eventType: index % 3 === 0 ? 'liked' : index % 3 === 1 ? 'shown' : 'skipped',
    timestamp: new Date(1700000000000 + index * 1000).toISOString(),
    dwellMs: 800,
    scoreDelta: index % 3 === 2 ? -0.65 : 1.8
  }));
  return {
    version: 2,
    liked: [],
    noped: [],
    events,
    readingStats,
    attributeStats: buildAttributeStats(),
    meta: {
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
      interactionCount: readingStatCount,
      showCount: readingStatCount * 2,
      lastInteractionAt: 1700002000000,
      lastShownAt: 1700001000000,
      legacyMigrated: true
    }
  };
}

function runMeasuredRerank(harness, candidates, preference, sessionProfile) {
  harness.configure(candidates, preference, sessionProfile);
  harness.resetCounters();
  const startedAt = performance.now();
  harness.run();
  const elapsedMs = performance.now() - startedAt;
  return {
    elapsedMs,
    candidateCount: harness.candidateCount(),
    counters: { ...harness.counters }
  };
}

test('sound swipe reranking characterizes full-suffix ranking with long-term history', (t) => {
  const harness = createRankingHarness();
  const preference = buildPreference(1000, 240);
  const sessionProfile = buildPreference(40, 20);
  const measurements = [];

  DATASET_SIZES.forEach((size) => {
    const result = runMeasuredRerank(
      harness,
      buildCandidates(size),
      preference,
      sessionProfile
    );
    const rankedCount = size - 1;
    assert.equal(result.candidateCount, size);
    assert.equal(result.counters.profileCalls, rankedCount * 2);
    assert.equal(result.counters.spliceCalls, 0);
    assert.equal(result.counters.spliceShiftedItems, 0);
    assert.ok(
      result.counters.mapCallbacks <= (rankedCount * 20) + 5000,
      'sound reranking map callbacks exceeded the indexed linear ceiling'
    );

    measurements.push({
      candidates: size,
      rankedSuffix: rankedCount,
      elapsedMs: Number(result.elapsedMs.toFixed(3)),
      profileCalls: result.counters.profileCalls,
      sortCalls: result.counters.sortCalls,
      sortComparisons: result.counters.sortComparisons,
      mapCallbacks: result.counters.mapCallbacks,
      filterCallbacks: result.counters.filterCallbacks,
      spliceCalls: result.counters.spliceCalls,
      spliceShiftedItems: result.counters.spliceShiftedItems,
      objectKeyItems: result.counters.objectKeyItems
    });
  });

  t.diagnostic(`sound rerank long-history baseline: ${JSON.stringify(measurements)}`);
});

test('optimized sound diversification preserves the legacy candidate order', () => {
  const harness = createRankingHarness();
  [20, 100, 500].forEach((size) => {
    const result = harness.compareDiversification(buildCandidates(size));
    assert.deepEqual(Array.from(result.current), Array.from(result.legacy));
  });
});
