const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const acorn = require('acorn');
const crypto = require('node:crypto');

const STATS_API_SOURCE_PATH = path.join(__dirname, '..', 'api', 'stats.js');
const FIREBASE_SOURCE_PATH = path.join(__dirname, '..', 'public', 'js', '15-firebase.js');
const RANKING_SOURCE_PATH = path.join(__dirname, '..', 'public', 'js', '18-ranking.js');

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

function loadReadingPolicy() {
  const functions = extractFunctionDeclarations(STATS_API_SOURCE_PATH, [
    'normalizeStatsMetric',
    'normalizeStatsReadingKey',
    'isSafeReadingLikeValue',
    'isAllowedReadingForRanking'
  ]);
  const sandbox = {
    allowlistedReadings: new Set(['はると'])
  };
  vm.createContext(sandbox);
  vm.runInContext(`
    function isAllowedReadingForGender(reading) {
      return allowlistedReadings.has(normalizeStatsReadingKey(reading));
    }
    ${functions}
    globalThis.readingPolicy = {
      normalizeStatsReadingKey,
      isSafeReadingLikeValue,
      isAllowedReadingForRanking
    };
  `, sandbox, { filename: STATS_API_SOURCE_PATH });
  return sandbox.readingPolicy;
}

test('reading-like ranking accepts safe direct input outside the curated swipe dataset', () => {
  const policy = loadReadingPolicy();

  assert.equal(policy.isAllowedReadingForRanking('はると', 'like', 'male'), true);
  assert.equal(policy.isAllowedReadingForRanking('きよら', 'like', 'female'), true);
  assert.equal(policy.isAllowedReadingForRanking('キヨラ', 'like', 'female'), true);
  assert.equal(policy.isAllowedReadingForRanking('きよら', 'direct', 'female'), false);
});

test('reading-like ranking keeps malformed or excessively long values out', () => {
  const policy = loadReadingPolicy();

  assert.equal(policy.isSafeReadingLikeValue(''), false);
  assert.equal(policy.isSafeReadingLikeValue('123'), false);
  assert.equal(policy.isSafeReadingLikeValue('a'), false);
  assert.equal(policy.isSafeReadingLikeValue('あ1'), false);
  assert.equal(policy.isSafeReadingLikeValue('あ・'), false);
  assert.equal(policy.isSafeReadingLikeValue('あ'.repeat(25)), false);
  assert.equal(policy.isSafeReadingLikeValue('あ'.repeat(24)), true);
});

test('stats API applies the ranking policy to both writes and reads', () => {
  const source = fs.readFileSync(STATS_API_SOURCE_PATH, 'utf8');

  assert.match(
    source,
    /normalizedKind\s*!==\s*'reading'\s*\|\|\s*isAllowedReadingForRanking\(item\.reading,\s*metric,\s*gender\)/
  );
  assert.match(
    source,
    /normalizedKind\s*===\s*'reading'\s*&&\s*!isAllowedReadingForRanking\(normalizedValue,\s*normalizedMetric,\s*normalizedGender\)/
  );
  assert.match(
    source,
    /const requestedValue[\s\S]*?normalizedKind === 'reading' && !isSafeReadingLikeValue\(requestedValue\)[\s\S]*?const normalizedValue/
  );
});

test('reading ranking empty state explains both reading choices and saved names', () => {
  const source = fs.readFileSync(RANKING_SOURCE_PATH, 'utf8');
  assert.match(source, /気になる読みを選んだり、候補名を保存するとここに並びます。/);
  assert.doesNotMatch(source, /名前として保存されるとここに並びます。/);
});

test('client reading normalization rejects rather than strips malformed input', () => {
  const functions = extractFunctionDeclarations(FIREBASE_SOURCE_PATH, [
    'normalizeStatsReadingText'
  ]);
  const sandbox = {};
  vm.createContext(sandbox);
  vm.runInContext(`
    ${functions}
    globalThis.normalizeClientReading = normalizeStatsReadingText;
  `, sandbox, { filename: FIREBASE_SOURCE_PATH });

  assert.equal(sandbox.normalizeClientReading('きよら'), 'きよら');
  assert.equal(sandbox.normalizeClientReading('キヨラ'), 'きよら');
  assert.equal(sandbox.normalizeClientReading('あ1'), '');
  assert.equal(sandbox.normalizeClientReading('あ・'), '');
  assert.equal(sandbox.normalizeClientReading('あ'.repeat(25)), '');
});

function createVoteTransactionHarness() {
  const functions = extractFunctionDeclarations(STATS_API_SOURCE_PATH, [
    'normalizeStatsKind',
    'normalizeStatsMetric',
    'normalizeStatsGender',
    'normalizeStatsScope',
    'getStatsGenderTargets',
    'getStatsCollectionNames',
    'normalizeStatsUpdatePeriod',
    'getStatsWritePeriods',
    'getStatsWriteDocId',
    'getStatsUserVoteDocId',
    'cleanStatsVoteStrings',
    'applyStatsUserVote'
  ]);
  const documents = new Map();
  const FieldValue = {
    increment(value) {
      return { __increment: value };
    },
    serverTimestamp() {
      return 'server-time';
    }
  };
  const db = {
    collection(collectionName) {
      return {
        doc(docId) {
          return { path: `${collectionName}/${docId}` };
        }
      };
    },
    async runTransaction(callback) {
      const pendingWrites = [];
      const transaction = {
        async get(ref) {
          const value = documents.get(ref.path);
          return {
            exists: value !== undefined,
            data() {
              return value === undefined ? undefined : { ...value };
            }
          };
        },
        set(ref, value, options = {}) {
          pendingWrites.push({ ref, value, merge: options.merge === true });
        }
      };
      const result = await callback(transaction);
      pendingWrites.forEach(({ ref, value, merge }) => {
        const previous = merge ? { ...(documents.get(ref.path) || {}) } : {};
        Object.entries(value).forEach(([key, nextValue]) => {
          if (nextValue && typeof nextValue === 'object' && Number.isFinite(nextValue.__increment)) {
            previous[key] = (Number(previous[key]) || 0) + nextValue.__increment;
          } else {
            previous[key] = nextValue;
          }
        });
        documents.set(ref.path, previous);
      });
      return result;
    }
  };
  const sandbox = {
    crypto,
    FieldValue,
    db
  };
  vm.createContext(sandbox);
  vm.runInContext(`
    ${functions}
    globalThis.voteHarness = {
      apply(uid, reading, delta) {
        return applyStatsUserVote({
          db,
          uid,
          kind: 'reading',
          collectionName: 'statistics_reading_user_votes',
          value: reading,
          delta,
          metric: 'like',
          gender: 'all',
          scope: 'global',
          period: 'allTime'
        });
      }
    };
  `, sandbox, { filename: STATS_API_SOURCE_PATH });
  return {
    documents,
    apply(uid, reading, delta) {
      return sandbox.voteHarness.apply(uid, reading, delta);
    }
  };
}

test('reading-like transaction deduplicates per user and reverses exactly once', async () => {
  const harness = createVoteTransactionHarness();
  const uid = 'ranking-test-user';
  const reading = 'きよら';

  const first = await harness.apply(uid, reading, 1);
  const duplicate = await harness.apply(uid, reading, 1);
  const removed = await harness.apply(uid, reading, -1);
  const missing = await harness.apply(uid, reading, -1);

  assert.deepEqual(JSON.parse(JSON.stringify(first)), { applied: true, duplicate: false });
  assert.deepEqual(JSON.parse(JSON.stringify(duplicate)), { applied: false, duplicate: true });
  assert.deepEqual(JSON.parse(JSON.stringify(removed)), { applied: true, duplicate: false });
  assert.deepEqual(JSON.parse(JSON.stringify(missing)), { applied: false, missing: true });

  const aggregate = harness.documents.get('reading_like_statistics/allTime');
  assert.equal(aggregate[reading], 0);

  const voteDocuments = Array.from(harness.documents.entries())
    .filter(([key]) => key.startsWith('statistics_reading_user_votes/'));
  assert.equal(voteDocuments.length, 1);
  assert.equal(voteDocuments[0][1].active, false);
});

test('local ranking snapshot does not double-count an active reading vote', () => {
  const functions = extractFunctionDeclarations(FIREBASE_SOURCE_PATH, [
    'normalizeLocalStatsReading',
    'normalizeLocalStatsValue',
    'getLocalStatsMetric',
    'getLocalStatsVoteKey',
    'isLocalStatsVoteActive'
  ]);
  const sandbox = {};
  vm.createContext(sandbox);
  vm.runInContext(`
    ${functions}
    globalThis.localVotePolicy = {
      isActive(store, reading) {
        return isLocalStatsVoteActive(store, 'reading', 'like', reading);
      }
    };
  `, sandbox, { filename: FIREBASE_SOURCE_PATH });

  const store = {
    userVotes: {
      'reading|like|はると': {
        active: true
      }
    }
  };
  assert.equal(sandbox.localVotePolicy.isActive(store, 'ハルト'), true);
  assert.equal(sandbox.localVotePolicy.isActive(store, 'そうすけ'), false);

  const source = fs.readFileSync(FIREBASE_SOURCE_PATH, 'utf8');
  assert.match(source, /isLocalStatsVoteActive\(store,\s*'reading',\s*'like',\s*reading\)/);
});

test('a ranking vote invalidates cached entries for that ranking kind', () => {
  const functions = extractFunctionDeclarations(RANKING_SOURCE_PATH, [
    'readRankingCacheStore',
    'writeRankingCacheStore',
    'invalidateRankingCache'
  ]);
  const storage = new Map();
  const sandbox = {
    localStorage: {
      getItem(key) {
        return storage.get(key) || null;
      },
      setItem(key, value) {
        storage.set(key, value);
      }
    }
  };
  vm.createContext(sandbox);
  vm.runInContext(`
    const RANKING_CACHE_STORAGE_KEY = 'meimay_ranking_cache_v3';
    ${functions}
    globalThis.rankingCachePolicy = {
      readRankingCacheStore,
      writeRankingCacheStore,
      invalidateRankingCache
    };
  `, sandbox, { filename: RANKING_SOURCE_PATH });

  sandbox.rankingCachePolicy.writeRankingCacheStore({
    'reading|allTime|all|allTime': { cachedAt: 1, items: [{ reading: 'はると', count: 1 }] },
    'reading|weekly|all|weekly_1': { cachedAt: 1, items: [{ reading: 'はると', count: 1 }] },
    'kanji|allTime|all|allTime': { cachedAt: 1, items: [{ kanji: '陽', count: 1 }] }
  });

  assert.equal(sandbox.rankingCachePolicy.invalidateRankingCache('reading'), true);
  assert.deepEqual(
    Object.keys(sandbox.rankingCachePolicy.readRankingCacheStore()),
    ['kanji|allTime|all|allTime']
  );
  assert.equal(sandbox.rankingCachePolicy.invalidateRankingCache('reading'), false);

  const source = fs.readFileSync(RANKING_SOURCE_PATH, 'utf8');
  assert.match(source, /const normalizedKind = kind === 'reading' \? 'reading' : 'kanji';\s*invalidateRankingCache\(normalizedKind\);/);
});
