const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const { performance } = require('node:perf_hooks');
const acorn = require('acorn');

const FIREBASE_SOURCE_PATH = path.join(__dirname, '..', 'public', 'js', '15-firebase.js');
const ROOM_SYNC_PAYLOAD_MAX_BYTES = 850 * 1024;
const DATASET_SIZES = [100, 300, 1000];
const BACKUP_DATASET_SIZES = [100, 300, 500, 550, 600, 1000];
const BACKUP_BOUNDARY_DATASET_SIZES = [1500, 2000];

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
    if (node.type === 'VariableDeclarator' && node.id?.name === objectName) return node;
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

function extractObjectProperties(source, ast, objectName, propertyNames) {
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

function extractFunctionDeclarations(source, ast, functionNames) {
  const requested = new Set(functionNames);
  const declarations = ast.body
    .filter((node) => node.type === 'FunctionDeclaration' && requested.has(node.id.name));
  const found = new Set(declarations.map((node) => node.id.name));
  assert.deepEqual([...found].sort(), [...requested].sort(), 'room sync functions must remain discoverable');
  return declarations.map((node) => source.slice(node.start, node.end)).join('\n');
}

function createCounters() {
  return {
    jsonStringifyCalls: 0,
    jsonParseCalls: 0,
    stringifiedChars: 0,
    sizeEstimateCalls: 0,
    projectSectionsCalls: 0,
    firestoreSetCalls: 0,
    lastPatchBytes: 0,
    lastBackupBytes: 0,
    lastFingerprintChars: 0,
    lastBackupTruncated: false,
    lastBackupHasWorkspace: false,
    lastBackupLikedItems: 0,
    lastBackupSavedItems: 0,
    lastBackupReadingItems: 0
  };
}

function createSyncPayloadHarness() {
  const source = fs.readFileSync(FIREBASE_SOURCE_PATH, 'utf8');
  const ast = acorn.parse(source, { ecmaVersion: 'latest', sourceType: 'script' });
  const roomFunctions = extractFunctionDeclarations(source, ast, [
    'safeJsonCloneForRoomSync',
    'estimateSerializedSizeBytes',
    'projectWorkspaceLibrariesForRemote',
    'buildRoomSyncWorkspaceState',
    'aggregateRoomSyncWorkspaceSections',
    'buildBoundedRoomSyncPayload',
    'buildBoundedUserBackupPayload',
    'buildBoundedUserBackupPatch',
    'buildRoomSyncWorkspaceStateFingerprintValue',
    'attachRoomSyncWorkspaceState',
    'buildRoomSyncContentFingerprint'
  ]);
  const backupProperties = extractObjectProperties(source, ast, 'MeimayUserBackup', [
    '_safeClone',
    '_normalizeReadingStockList',
    '_hashFingerprintValue',
    '_fingerprint',
    '_matchesRemoteFingerprint',
    '_buildRemotePatch',
    'syncLocalToRemote'
  ]);
  const counters = createCounters();
  const hostEncoder = new TextEncoder();
  class CountingTextEncoder {
    encode(value) {
      counters.sizeEstimateCalls += 1;
      return hostEncoder.encode(value);
    }
  }
  const sandbox = {
    console: {
      log() {},
      warn() {},
      error() {}
    },
    counters,
    TextEncoder: CountingTextEncoder,
    Blob,
    window: {},
    localStorage: {
      getItem() {
        return null;
      }
    }
  };

  vm.createContext(sandbox);
  vm.runInContext(`
    const ROOM_SYNC_PAYLOAD_MAX_BYTES = ${ROOM_SYNC_PAYLOAD_MAX_BYTES};
    const nativeJsonStringify = JSON.stringify.bind(JSON);
    const nativeJsonParse = JSON.parse.bind(JSON);
    JSON.stringify = function (value) {
      const serialized = nativeJsonStringify(value);
      counters.jsonStringifyCalls += 1;
      counters.stringifiedChars += serialized.length;
      return serialized;
    };
    JSON.parse = function (value) {
      counters.jsonParseCalls += 1;
      return nativeJsonParse(value);
    };

    const MeimayFirestorePayload = {
      projectSections(sections = {}) {
        counters.projectSectionsCalls += 1;
        return {
          liked: Array.isArray(sections.liked) ? sections.liked : [],
          savedNames: Array.isArray(sections.savedNames) ? sections.savedNames : [],
          readingStock: Array.isArray(sections.readingStock) ? sections.readingStock : [],
          encounteredReadings: Array.isArray(sections.encounteredReadings) ? sections.encounteredReadings : []
        };
      }
    };
    const firebase = {
      firestore: {
        FieldValue: {
          delete() {
            return { operation: 'delete' };
          },
          serverTimestamp() {
            return { operation: 'serverTimestamp' };
          }
        }
      }
    };
    const firebaseDb = {
      collection() {
        return {
          doc() {
            return {
              async set(patch) {
                counters.firestoreSetCalls += 1;
                counters.lastPatchBytes = new TextEncoder().encode(nativeJsonStringify(patch)).length;
                counters.lastBackupBytes = new TextEncoder().encode(nativeJsonStringify(patch.meimayBackup || {})).length;
                counters.lastFingerprintChars = String(patch.meimayBackupFingerprint || '').length;
                counters.lastBackupTruncated = patch.meimayBackup?.backupTruncated === true;
                counters.lastBackupHasWorkspace = !!patch.meimayBackup?.meimayStateV2;
                counters.lastBackupLikedItems = Array.isArray(patch.meimayBackup?.liked) ? patch.meimayBackup.liked.length : 0;
                counters.lastBackupSavedItems = Array.isArray(patch.meimayBackup?.savedNames) ? patch.meimayBackup.savedNames.length : 0;
                counters.lastBackupReadingItems = Array.isArray(patch.meimayBackup?.readingStock) ? patch.meimayBackup.readingStock.length : 0;
              }
            };
          }
        };
      }
    };
    function normalizeReadingStockItem(item) {
      if (!item || typeof item !== 'object') return null;
      return {
        ...item,
        tags: Array.isArray(item.tags) ? [...item.tags] : [],
        segments: Array.isArray(item.segments) ? [...item.segments] : []
      };
    }

    ${roomFunctions}

    const MeimayUserBackup = {
      _lastSyncedFingerprint: '',
      _lastRemoteBackupFingerprint: '',
      _remoteBackupDisabled: false,
      _isAppDataDeletionInProgress() {
        return false;
      },
      _hasData() {
        return true;
      },
      _isPermissionDeniedError() {
        return false;
      },
      _readChildWorkspaceStateV2() {
        return null;
      },
      ${backupProperties}
    };

    let currentSections = null;
    let currentWorkspace = null;

    function cloneRoomArray(items) {
      return safeJsonCloneForRoomSync(Array.isArray(items) ? items : [], []);
    }

    globalThis.syncPayloadHarness = {
      setData(serializedSections, serializedWorkspace) {
        currentSections = nativeJsonParse(serializedSections);
        currentWorkspace = nativeJsonParse(serializedWorkspace);
      },
      resetCounters() {
        Object.keys(counters).forEach((key) => {
          counters[key] = 0;
        });
      },
      resetBackupFingerprint() {
        MeimayUserBackup._lastSyncedFingerprint = '';
        MeimayUserBackup._lastRemoteBackupFingerprint = '';
      },
      runRoomProtocol() {
        const basePayload = {
          role: 'mama',
          displayName: '性能計測',
          username: '性能計測',
          nickname: '性能計測',
          themeId: 'sakura',
          liked: cloneRoomArray(currentSections.liked),
          savedNames: cloneRoomArray(currentSections.savedNames),
          readingStock: cloneRoomArray(currentSections.readingStock),
          encounteredReadings: cloneRoomArray(currentSections.encounteredReadings),
          hiddenReadings: cloneRoomArray(currentSections.hiddenReadings),
          likedRemoved: cloneRoomArray(currentSections.likedRemoved),
          meimayBackup: {
            likedCount: currentSections.liked.length,
            savedNamesCount: currentSections.savedNames.length,
            readingStockCount: currentSections.readingStock.length
          },
          roomSyncFlatSectionsOmitted: false,
          roomSyncTruncated: false,
          roomSyncTruncatedFields: [],
          isPremium: false
        };
        const payload = attachRoomSyncWorkspaceState(
          basePayload,
          currentWorkspace,
          currentWorkspace.updatedAt
        );
        const fingerprint = buildRoomSyncContentFingerprint(payload);
        return {
          fingerprint,
          payloadBytes: new TextEncoder().encode(nativeJsonStringify(payload)).length,
          flatSectionsOmitted: payload.roomSyncFlatSectionsOmitted === true,
          truncated: payload.roomSyncTruncated === true,
          workspaceIncluded: !!payload.meimayStateV2
        };
      },
      async runBackup(force = false) {
        return MeimayUserBackup.syncLocalToRemote(
          { uid: 'performance-user' },
          { sections: currentSections, force }
        );
      },
      getFingerprintPair() {
        const local = MeimayUserBackup._fingerprint(currentSections);
        return {
          local,
          remote: MeimayUserBackup._hashFingerprintValue(local)
        };
      },
      matchesRemoteFingerprint(remote, local) {
        return MeimayUserBackup._matchesRemoteFingerprint(remote, local);
      }
    };
  `, sandbox, { filename: FIREBASE_SOURCE_PATH });

  return {
    counters,
    setData(sections, workspace) {
      sandbox.syncPayloadHarness.setData(JSON.stringify(sections), JSON.stringify(workspace));
    },
    resetCounters() {
      sandbox.syncPayloadHarness.resetCounters();
    },
    resetBackupFingerprint() {
      sandbox.syncPayloadHarness.resetBackupFingerprint();
    },
    runRoomProtocol() {
      return sandbox.syncPayloadHarness.runRoomProtocol();
    },
    runBackup(force = false) {
      return sandbox.syncPayloadHarness.runBackup(force);
    },
    getFingerprintPair() {
      return sandbox.syncPayloadHarness.getFingerprintPair();
    },
    matchesRemoteFingerprint(remote, local) {
      return sandbox.syncPayloadHarness.matchesRemoteFingerprint(remote, local);
    }
  };
}

function buildDataset(size) {
  const liked = Array.from({ length: size }, (_, index) => ({
    kanji: `字${index}`,
    reading: `よみ${index}`,
    sessionReading: `よみ${index}`,
    slot: index % 3,
    tags: [`tag-${index % 12}`]
  }));
  const readingStock = Array.from({ length: size }, (_, index) => ({
    id: `よみ${index}::`,
    reading: `よみ${index}`,
    segments: [],
    tags: [`tag-${index % 12}`],
    gender: index % 2 === 0 ? 'male' : 'female'
  }));
  const savedNames = Array.from({ length: size }, (_, index) => ({
    fullName: `性能 名${index}`,
    givenName: `名${index}`,
    reading: `よみ${index}`,
    combinationKeys: [`字${index}`]
  }));
  const encounteredReadings = Array.from({ length: size }, (_, index) => ({
    key: `よみ${index}`,
    reading: `よみ${index}`,
    seenCount: 1,
    likeCount: 1
  }));
  const hiddenReadings = Array.from({ length: Math.ceil(size / 10) }, (_, index) => `ひみつ${index}`);
  const likedRemoved = Array.from({ length: Math.ceil(size / 20) }, (_, index) => `削除${index}`);
  const sections = {
    liked,
    savedNames,
    readingStock,
    encounteredReadings,
    hiddenReadings,
    likedRemoved
  };
  const workspace = {
    version: 2,
    activeChildId: 'child-1',
    childOrder: ['child-1'],
    family: {
      surnameDefault: { kanji: '性能', reading: 'せいのう' },
      appSettings: { shareMode: 'auto', showInappropriateKanji: false }
    },
    children: {
      'child-1': {
        meta: {
          id: 'child-1',
          displayLabel: '第1子',
          updatedAt: '2026-07-30T00:00:00.000Z'
        },
        prefs: { rule: 'strict' },
        libraries: {
          kanjiStock: liked,
          readingStock,
          savedNames,
          hiddenReadings
        }
      }
    },
    deletedChildren: {},
    createdAt: '2026-07-30T00:00:00.000Z',
    updatedAt: '2026-07-30T00:00:00.000Z'
  };
  sections.childWorkspaceStateV2 = workspace;
  return { sections, workspace };
}

function snapshotCounters(counters) {
  return {
    jsonStringifyCalls: counters.jsonStringifyCalls,
    jsonParseCalls: counters.jsonParseCalls,
    stringifiedMiB: Number((counters.stringifiedChars * 2 / 1024 / 1024).toFixed(2)),
    sizeEstimateCalls: counters.sizeEstimateCalls,
    projectSectionsCalls: counters.projectSectionsCalls,
    firestoreSetCalls: counters.firestoreSetCalls,
    lastPatchKiB: Number((counters.lastPatchBytes / 1024).toFixed(1)),
    lastBackupKiB: Number((counters.lastBackupBytes / 1024).toFixed(1)),
    lastFingerprintKiChars: Number((counters.lastFingerprintChars / 1024).toFixed(1)),
    backupTruncated: counters.lastBackupTruncated === true,
    backupHasWorkspace: counters.lastBackupHasWorkspace === true,
    backupLikedItems: counters.lastBackupLikedItems,
    backupSavedItems: counters.lastBackupSavedItems,
    backupReadingItems: counters.lastBackupReadingItems,
    overSafetyLimit: counters.lastPatchBytes > ROOM_SYNC_PAYLOAD_MAX_BYTES,
    overFirestoreDocumentLimit: counters.lastPatchBytes > 1024 * 1024
  };
}

test('room sync payload construction characterizes full cloning and fingerprint work', (t) => {
  const harness = createSyncPayloadHarness();
  const measurements = [];

  DATASET_SIZES.forEach((size) => {
    const { sections, workspace } = buildDataset(size);
    harness.setData(sections, workspace);
    harness.resetCounters();
    const startedAt = performance.now();
    const result = harness.runRoomProtocol();
    const elapsedMs = performance.now() - startedAt;
    const counters = snapshotCounters(harness.counters);

    assert.ok(result.fingerprint.length > 0);
    assert.ok(result.payloadBytes <= ROOM_SYNC_PAYLOAD_MAX_BYTES);
    assert.equal(result.workspaceIncluded, true);
    assert.ok(counters.jsonStringifyCalls <= 80, 'room payload serialization count exceeded the current ceiling');
    assert.ok(counters.jsonParseCalls <= 40, 'room payload clone count exceeded the current ceiling');

    measurements.push({
      itemsPerSection: size,
      elapsedMs: Number(elapsedMs.toFixed(3)),
      payloadKiB: Number((result.payloadBytes / 1024).toFixed(1)),
      flatSectionsOmitted: result.flatSectionsOmitted,
      truncated: result.truncated,
      ...counters
    });
  });

  t.diagnostic(`room sync payload baseline: ${JSON.stringify(measurements)}`);
});

test('user backup skips unchanged Firestore writes after rebuilding the fingerprint', async (t) => {
  const harness = createSyncPayloadHarness();
  const measurements = [];

  for (const size of BACKUP_DATASET_SIZES) {
    const { sections, workspace } = buildDataset(size);
    harness.setData(sections, workspace);
    harness.resetBackupFingerprint();

    harness.resetCounters();
    const firstStartedAt = performance.now();
    assert.equal(await harness.runBackup(false), true);
    const first = {
      elapsedMs: Number((performance.now() - firstStartedAt).toFixed(3)),
      ...snapshotCounters(harness.counters)
    };

    harness.resetCounters();
    const unchangedStartedAt = performance.now();
    assert.equal(await harness.runBackup(false), true);
    const unchanged = {
      elapsedMs: Number((performance.now() - unchangedStartedAt).toFixed(3)),
      ...snapshotCounters(harness.counters)
    };

    const changed = buildDataset(size + 1);
    harness.setData(changed.sections, changed.workspace);
    harness.resetCounters();
    const changedStartedAt = performance.now();
    assert.equal(await harness.runBackup(false), true);
    const changedResult = {
      elapsedMs: Number((performance.now() - changedStartedAt).toFixed(3)),
      ...snapshotCounters(harness.counters)
    };

    assert.equal(first.firestoreSetCalls, 1);
    assert.equal(unchanged.firestoreSetCalls, 0, 'unchanged backup must not write to Firestore');
    assert.equal(changedResult.firestoreSetCalls, 1);
    assert.ok(first.lastFingerprintKiChars < 0.1, 'backup fingerprint must remain a compact deterministic hash');
    assert.ok(changedResult.lastFingerprintKiChars < 0.1, 'changed backup fingerprint must remain compact');
    assert.ok(unchanged.jsonStringifyCalls <= first.jsonStringifyCalls);
    assert.ok(unchanged.projectSectionsCalls <= first.projectSectionsCalls);

    measurements.push({
      itemsPerSection: size,
      first,
      unchanged,
      changed: changedResult
    });
  }

  t.diagnostic(`user backup baseline: ${JSON.stringify(measurements)}`);
});

test('backup fingerprint remains compact while accepting the legacy raw value', () => {
  const harness = createSyncPayloadHarness();
  const first = buildDataset(100);
  harness.setData(first.sections, first.workspace);
  const firstPair = harness.getFingerprintPair();

  assert.ok(firstPair.local.length > firstPair.remote.length);
  assert.ok(firstPair.remote.length < 64);
  assert.equal(harness.matchesRemoteFingerprint(firstPair.local, firstPair.local), true);
  assert.equal(harness.matchesRemoteFingerprint(firstPair.remote, firstPair.local), true);

  const changed = buildDataset(101);
  harness.setData(changed.sections, changed.workspace);
  const changedPair = harness.getFingerprintPair();
  assert.notEqual(changedPair.remote, firstPair.remote);
  assert.equal(harness.matchesRemoteFingerprint(firstPair.remote, changedPair.local), false);
});

test('workspace backups stay below the final Firestore safety limit at boundary sizes', async () => {
  const harness = createSyncPayloadHarness();

  for (const size of BACKUP_BOUNDARY_DATASET_SIZES) {
    const { sections, workspace } = buildDataset(size);
    harness.setData(sections, workspace);
    harness.resetBackupFingerprint();
    harness.resetCounters();

    assert.equal(await harness.runBackup(true), true);
    const snapshot = snapshotCounters(harness.counters);
    assert.equal(snapshot.firestoreSetCalls, 1);
    assert.equal(snapshot.overSafetyLimit, false, `${size} item workspace backup exceeded the safety limit`);
    assert.equal(snapshot.overFirestoreDocumentLimit, false);
    assert.equal(snapshot.backupHasWorkspace, true);
  }
});

test('legacy flat backups without meimayStateV2 remain readable and bounded', async () => {
  const harness = createSyncPayloadHarness();

  for (const size of [100, ...BACKUP_BOUNDARY_DATASET_SIZES]) {
    const { sections } = buildDataset(size);
    delete sections.childWorkspaceStateV2;
    harness.setData(sections, null);
    harness.resetBackupFingerprint();
    harness.resetCounters();

    assert.equal(await harness.runBackup(true), true);
    const snapshot = snapshotCounters(harness.counters);
    assert.equal(snapshot.firestoreSetCalls, 1);
    assert.equal(snapshot.overSafetyLimit, false, `${size} item legacy backup exceeded the safety limit`);
    assert.equal(snapshot.overFirestoreDocumentLimit, false);
    assert.equal(snapshot.backupHasWorkspace, false);
    if (size === 100) {
      assert.equal(snapshot.backupTruncated, false);
      assert.equal(snapshot.backupLikedItems, 100);
      assert.equal(snapshot.backupSavedItems, 100);
      assert.equal(snapshot.backupReadingItems, 100);
    }
  }
});
