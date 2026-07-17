const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const acorn = require('acorn');

const FIREBASE_SOURCE_PATH = path.join(__dirname, '..', 'public', 'js', '15-firebase.js');
const STORAGE_SOURCE_PATH = path.join(__dirname, '..', 'public', 'js', '09-storage.js');
const FLOW_SOURCE_PATH = path.join(__dirname, '..', 'public', 'js', '04-ui-flow.js');
const ROOM_SYNC_PAYLOAD_MAX_BYTES = 850 * 1024;

function extractTopLevelFunction(source, functionName) {
  const ast = acorn.parse(source, { ecmaVersion: 'latest', sourceType: 'script' });
  const node = ast.body.find((entry) => entry.type === 'FunctionDeclaration' && entry.id?.name === functionName);
  assert.ok(node, `${functionName} must remain a top-level function`);
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

function extractAssignedFunction(source, objectName, methodName) {
  const ast = acorn.parse(source, { ecmaVersion: 'latest', sourceType: 'script' });
  const statement = ast.body.find((entry) => {
    const assignment = entry.type === 'ExpressionStatement' ? entry.expression : null;
    const left = assignment?.type === 'AssignmentExpression' ? assignment.left : null;
    return left?.type === 'MemberExpression'
      && left.object?.name === objectName
      && (left.property?.name || left.property?.value) === methodName;
  });
  const functionNode = statement?.expression?.right;
  assert.ok(functionNode, `${objectName}.${methodName} assigned function must remain available`);
  return source.slice(functionNode.start, functionNode.end);
}

function loadSyncProtocol() {
  const source = fs.readFileSync(FIREBASE_SOURCE_PATH, 'utf8');
  const ast = acorn.parse(source, { ecmaVersion: 'latest', sourceType: 'script' });
  const functionNames = new Set([
    'safeJsonCloneForRoomSync',
    'estimateSerializedSizeBytes',
    'projectWorkspaceLibrariesForRemote',
    'buildRoomSyncWorkspaceState',
    'aggregateRoomSyncWorkspaceSections',
    'buildBoundedRoomSyncPayload',
    'buildRoomSyncWorkspaceStateFingerprintValue',
    'attachRoomSyncWorkspaceState',
    'buildRoomSyncContentFingerprint'
  ]);
  const declarations = ast.body
    .filter((node) => node.type === 'FunctionDeclaration' && functionNames.has(node.id.name))
    .map((node) => source.slice(node.start, node.end));

  assert.equal(declarations.length, functionNames.size, 'sync protocol functions must remain discoverable');

  const sandbox = {
    Blob,
    TextEncoder,
    console,
    master: [],
    MeimayFirestorePayload: {
      projectSections(sections = {}) {
        return {
          liked: Array.isArray(sections.liked) ? sections.liked : [],
          savedNames: Array.isArray(sections.savedNames) ? sections.savedNames : [],
          readingStock: Array.isArray(sections.readingStock) ? sections.readingStock : [],
          encounteredReadings: Array.isArray(sections.encounteredReadings) ? sections.encounteredReadings : []
        };
      }
    }
  };
  vm.createContext(sandbox);
  vm.runInContext(`
    const ROOM_SYNC_PAYLOAD_MAX_BYTES = ${ROOM_SYNC_PAYLOAD_MAX_BYTES};
    ${declarations.join('\n')}
    globalThis.syncProtocol = {
      estimateSerializedSizeBytes,
      aggregateRoomSyncWorkspaceSections,
      attachRoomSyncWorkspaceState,
      buildRoomSyncContentFingerprint
    };
  `, sandbox, { filename: FIREBASE_SOURCE_PATH });
  return sandbox.syncProtocol;
}

const protocol = loadSyncProtocol();

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createWorkspace(owner, children) {
  const childMap = {};
  children.forEach((child, index) => {
    childMap[child.id] = {
      meta: {
        id: child.id,
        displayLabel: child.label || `${owner}-${index + 1}`,
        updatedAt: child.updatedAt || '2026-07-12T00:00:00.000Z'
      },
      prefs: { rule: 'strict' },
      libraries: {
        kanjiStock: clone(child.kanjiStock || []),
        readingStock: clone(child.readingStock || []),
        savedNames: clone(child.savedNames || []),
        hiddenReadings: clone(child.hiddenReadings || [])
      }
    };
  });
  return {
    version: 2,
    activeChildId: children[0]?.id || '',
    childOrder: children.map((child) => child.id),
    children: childMap,
    createdAt: '2026-07-12T00:00:00.000Z',
    updatedAt: '2026-07-12T00:00:00.000Z'
  };
}

function createRoomPayload({ uid, displayName, workspace, sections = {} }) {
  const base = {
    role: uid === 'user-a' ? 'mama' : 'papa',
    displayName,
    username: displayName,
    nickname: displayName,
    themeId: uid === 'user-a' ? 'sakura' : 'sky',
    liked: clone(sections.liked || []),
    savedNames: clone(sections.savedNames || []),
    readingStock: clone(sections.readingStock || []),
    encounteredReadings: clone(sections.encounteredReadings || []),
    hiddenReadings: clone(sections.hiddenReadings || []),
    likedRemoved: clone(sections.likedRemoved || []),
    meimayBackup: {
      likedCount: (sections.liked || []).length,
      savedNamesCount: (sections.savedNames || []).length,
      readingStockCount: (sections.readingStock || []).length
    },
    roomSyncFlatSectionsOmitted: false,
    roomSyncTruncated: false,
    roomSyncTruncatedFields: [],
    isPremium: false
  };
  const payload = protocol.attachRoomSyncWorkspaceState(base, workspace, workspace?.updatedAt || '');
  payload.roomSyncFingerprint = protocol.buildRoomSyncContentFingerprint(payload);
  return payload;
}

function hydratePartnerPayload(payload) {
  if (!payload) return null;
  const sections = payload.roomSyncFlatSectionsOmitted === true && payload.meimayStateV2
    ? protocol.aggregateRoomSyncWorkspaceSections(payload.meimayStateV2)
    : {
        liked: clone(payload.liked || []),
        savedNames: clone(payload.savedNames || []),
        readingStock: clone(payload.readingStock || []),
        hiddenReadings: clone(payload.hiddenReadings || [])
      };
  return {
    displayName: payload.displayName,
    workspace: clone(payload.meimayStateV2 || null),
    ...clone(sections)
  };
}

class InMemoryPairRoom {
  constructor() {
    this.documents = new Map();
    this.listeners = new Map();
    this.writeCount = 0;
  }

  listenToUser(uid, listener) {
    const listeners = this.listeners.get(uid) || new Set();
    listeners.add(listener);
    this.listeners.set(uid, listeners);
    if (this.documents.has(uid)) listener(clone(this.documents.get(uid)));
    return () => listeners.delete(listener);
  }

  write(uid, payload) {
    const current = this.documents.get(uid);
    if (current?.roomSyncFingerprint === payload.roomSyncFingerprint) return false;
    this.documents.set(uid, clone(payload));
    this.writeCount += 1;
    const listeners = this.listeners.get(uid) || [];
    for (const listener of listeners) listener(clone(payload));
    return true;
  }

  read(uid) {
    return clone(this.documents.get(uid) || null);
  }
}

class PairClient {
  constructor(uid, room) {
    this.uid = uid;
    this.room = room;
    this.online = true;
    this.pendingPayload = null;
    this.partnerSnapshot = null;
  }

  connectTo(partnerUid) {
    this.unsubscribe = this.room.listenToUser(partnerUid, (payload) => {
      this.partnerSnapshot = hydratePartnerPayload(payload);
    });
  }

  setOnline(online) {
    this.online = online;
    if (online && this.pendingPayload) {
      const payload = this.pendingPayload;
      this.pendingPayload = null;
      this.room.write(this.uid, payload);
    }
  }

  sync(payload) {
    if (!this.online) {
      this.pendingPayload = clone(payload);
      return false;
    }
    return this.room.write(this.uid, payload);
  }
}

test('two users receive only the partner snapshot in both directions', () => {
  const room = new InMemoryPairRoom();
  const userA = new PairClient('user-a', room);
  const userB = new PairClient('user-b', room);
  userA.connectTo('user-b');
  userB.connectTo('user-a');

  const workspaceA = createWorkspace('A', [{
    id: 'a-child',
    kanjiStock: [{ kanji: '陽' }],
    readingStock: [{ id: 'haruto', reading: 'はると' }]
  }]);
  const workspaceB = createWorkspace('B', [{
    id: 'b-child',
    kanjiStock: [{ kanji: '凪' }],
    readingStock: [{ id: 'minato', reading: 'みなと' }]
  }]);

  userA.sync(createRoomPayload({
    uid: 'user-a',
    displayName: 'A',
    workspace: workspaceA,
    sections: { liked: [{ kanji: '陽' }], readingStock: [{ id: 'haruto', reading: 'はると' }] }
  }));
  userB.sync(createRoomPayload({
    uid: 'user-b',
    displayName: 'B',
    workspace: workspaceB,
    sections: { liked: [{ kanji: '凪' }], readingStock: [{ id: 'minato', reading: 'みなと' }] }
  }));

  assert.equal(userA.partnerSnapshot.displayName, 'B');
  assert.deepEqual(userA.partnerSnapshot.liked.map((item) => item.kanji), ['凪']);
  assert.equal(userB.partnerSnapshot.displayName, 'A');
  assert.deepEqual(userB.partnerSnapshot.liked.map((item) => item.kanji), ['陽']);
  assert.equal(room.writeCount, 2, 'partner hydration must not create an echo write');
});

test('concurrent owner updates stay in separate room documents', async () => {
  const room = new InMemoryPairRoom();
  const userA = new PairClient('user-a', room);
  const userB = new PairClient('user-b', room);
  userA.connectTo('user-b');
  userB.connectTo('user-a');

  const payloadA = createRoomPayload({
    uid: 'user-a',
    displayName: 'A',
    workspace: createWorkspace('A', [{ id: 'a-child', kanjiStock: [{ kanji: '街' }] }]),
    sections: { liked: [{ kanji: '街' }] }
  });
  const payloadB = createRoomPayload({
    uid: 'user-b',
    displayName: 'B',
    workspace: createWorkspace('B', [{ id: 'b-child', kanjiStock: [{ kanji: '皆' }] }]),
    sections: { liked: [{ kanji: '皆' }] }
  });

  await Promise.all([
    Promise.resolve().then(() => userA.sync(payloadA)),
    Promise.resolve().then(() => userB.sync(payloadB))
  ]);

  assert.deepEqual(room.read('user-a').liked.map((item) => item.kanji), ['街']);
  assert.deepEqual(room.read('user-b').liked.map((item) => item.kanji), ['皆']);
  assert.deepEqual(userA.partnerSnapshot.liked.map((item) => item.kanji), ['皆']);
  assert.deepEqual(userB.partnerSnapshot.liked.map((item) => item.kanji), ['街']);
});

test('unchanged data is skipped and reconnect sends only the latest offline snapshot', () => {
  const room = new InMemoryPairRoom();
  const userA = new PairClient('user-a', room);
  const userB = new PairClient('user-b', room);
  userB.connectTo('user-a');

  const initial = createRoomPayload({
    uid: 'user-a',
    displayName: 'A',
    workspace: createWorkspace('A', [{ id: 'a-child', kanjiStock: [{ kanji: '示' }] }]),
    sections: { liked: [{ kanji: '示' }] }
  });
  assert.equal(userA.sync(initial), true);
  assert.equal(userA.sync(clone(initial)), false, 'same fingerprint must not write twice');

  userA.setOnline(false);
  userA.sync(createRoomPayload({
    uid: 'user-a',
    displayName: 'A',
    workspace: createWorkspace('A', [{ id: 'a-child', kanjiStock: [{ kanji: '示' }, { kanji: '侯' }] }]),
    sections: { liked: [{ kanji: '示' }, { kanji: '侯' }] }
  }));
  userA.sync(createRoomPayload({
    uid: 'user-a',
    displayName: 'A',
    workspace: createWorkspace('A', [{ id: 'a-child', kanjiStock: [{ kanji: '示' }, { kanji: '侯' }, { kanji: '勒' }] }]),
    sections: { liked: [{ kanji: '示' }, { kanji: '侯' }, { kanji: '勒' }] }
  }));

  assert.deepEqual(userB.partnerSnapshot.liked.map((item) => item.kanji), ['示']);
  userA.setOnline(true);
  assert.deepEqual(userB.partnerSnapshot.liked.map((item) => item.kanji), ['示', '侯', '勒']);
  assert.equal(room.writeCount, 2, 'offline intermediate state must be coalesced');
});

test('child workspaces remain separated and aggregate correctly for a partner', () => {
  const workspace = createWorkspace('A', [
    {
      id: 'first-child',
      label: '第一子',
      kanjiStock: [{ kanji: '陽' }],
      readingStock: [{ id: 'haruto', reading: 'はると' }],
      savedNames: [{ fullName: '陽斗', givenName: '陽斗' }]
    },
    {
      id: 'second-child',
      label: '第二子',
      kanjiStock: [{ kanji: '凪' }],
      readingStock: [{ id: 'minato', reading: 'みなと' }],
      savedNames: [{ fullName: '湊', givenName: '湊' }]
    }
  ]);
  const payload = createRoomPayload({
    uid: 'user-a',
    displayName: 'A',
    workspace,
    sections: {
      liked: [{ kanji: '陽' }, { kanji: '凪' }],
      readingStock: [{ id: 'haruto', reading: 'はると' }, { id: 'minato', reading: 'みなと' }]
    }
  });
  const hydrated = hydratePartnerPayload(payload);

  assert.deepEqual(Object.keys(hydrated.workspace.children).sort(), ['first-child', 'second-child']);
  assert.deepEqual(hydrated.workspace.children['first-child'].libraries.kanjiStock.map((item) => item.kanji), ['陽']);
  assert.deepEqual(hydrated.workspace.children['second-child'].libraries.kanjiStock.map((item) => item.kanji), ['凪']);
  assert.deepEqual(hydrated.liked.map((item) => item.kanji), ['陽', '凪']);
});

test('a sole legacy partner child remains readable before explicit child linking', () => {
  const firebaseSource = fs.readFileSync(FIREBASE_SOURCE_PATH, 'utf8');
  const childIdResolver = extractTopLevelFunction(firebaseSource, 'getWorkspaceChildRecordIds');
  const soleChildResolver = extractTopLevelFunction(firebaseSource, 'getSolePartnerChildRecord');
  const getPartnerChildContext = extractObjectMethod(firebaseSource, 'MeimayPartnerInsights', '_getPartnerChildContext');
  const suppressFallback = extractObjectMethod(firebaseSource, 'MeimayPartnerInsights', '_shouldSuppressUnscopedPartnerFallback');
  const getPartnerChildRecord = extractObjectMethod(firebaseSource, 'MeimayPartnerInsights', '_getPartnerChildRecord');
  const sandbox = { console: { warn() {} } };
  vm.createContext(sandbox);
  vm.runInContext(`
    ${childIdResolver}
    ${soleChildResolver}
    const soleChild = {
      meta: { id: 'partner-first-child' },
      libraries: {
        kanjiStock: [{ kanji: '陽' }],
        readingStock: [{ reading: 'はると' }],
        savedNames: [{ givenName: '陽斗' }]
      }
    };
    const partnerRoot = {
      activeChildId: 'partner-first-child',
      childOrder: ['partner-first-child'],
      children: { 'partner-first-child': soleChild }
    };
    const context = {
      requiresScopedChild: true,
      partnerRoot,
      partnerChild: null,
      partnerChildCount: 1
    };
    const MeimayChildWorkspaces = {
      root: {
        activeChildId: 'local-first-child',
        childOrder: ['local-first-child'],
        children: { 'local-first-child': { meta: { id: 'local-first-child', birthOrder: 1 } } }
      },
      getActiveChild() { return this.root.children['local-first-child']; },
      getPartnerWorkspaceRoot() { return partnerRoot; },
      getPartnerChildForChild() { return null; },
      isPartnerAlignmentReviewRequired() { return true; }
    };
    const contextInsights = { _getPartnerChildContext: ${getPartnerChildContext} };
    const resolvedContext = contextInsights._getPartnerChildContext();
    const insights = {
      _getPartnerChildContext() { return context; },
      _shouldSuppressUnscopedPartnerFallback: ${suppressFallback},
      _getPartnerChildRecord: ${getPartnerChildRecord}
    };
    globalThis.result = {
      resolved: getSolePartnerChildRecord(partnerRoot),
      resolvedContext,
      suppressed: insights._shouldSuppressUnscopedPartnerFallback(),
      record: insights._getPartnerChildRecord()
    };
  `, sandbox);

  assert.equal(sandbox.result.suppressed, false);
  assert.equal(sandbox.result.resolved.meta.id, 'partner-first-child');
  assert.equal(sandbox.result.resolvedContext.partnerChild.meta.id, 'partner-first-child');
  assert.equal(sandbox.result.record.libraries.readingStock[0].reading, 'はると');
});

test('legacy flat partner stocks survive an empty sole-child projection', () => {
  const firebaseSource = fs.readFileSync(FIREBASE_SOURCE_PATH, 'utf8');
  const methodNames = [
    '_getCachedPartnerValue',
    '_setCachedPartnerValue',
    '_shouldSuppressUnscopedPartnerFallback',
    '_shouldUseScopedPartnerChildOnly',
    '_getPartnerChildRecord',
    '_getPartnerChildLibraries',
    'getPartnerLikedRaw',
    'getPartnerSaved'
  ];
  const methods = Object.fromEntries(methodNames.map((name) => [name, extractObjectMethod(firebaseSource, 'MeimayPartnerInsights', name)]));
  const getPartnerReadingStock = extractAssignedFunction(firebaseSource, 'MeimayPartnerInsights', 'getPartnerReadingStock');
  const sandbox = { console: { warn() {} } };
  vm.createContext(sandbox);
  vm.runInContext(`
    const MeimayShare = {
      partnerSnapshot: {
        liked: [{ kanji: '怜' }],
        readingStock: [{ reading: 'れい' }],
        savedNames: [{ givenName: '怜', reading: 'れい' }]
      }
    };
    const MeimayFirestorePayload = {
      hydrateLikedItem(item) { return { ...item, kanji: item.kanji || item['漢字'] }; }
    };
    const normalizeReadingStockItem = (item) => item;
    const child = {
      meta: { id: 'partner-first-child' },
      libraries: { kanjiStock: [], readingStock: [], savedNames: [] }
    };
    const context = {
      requiresScopedChild: true,
      partnerRoot: {
        activeChildId: 'partner-first-child',
        childOrder: ['partner-first-child'],
        children: { 'partner-first-child': child }
      },
      partnerChild: null,
      partnerChildCount: 1
    };
    const insights = {
      _cache: {},
      _getPartnerContextCacheKey() { return 'legacy-one-child'; },
      _getPartnerChildContext() { return context; },
      _safeClone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); },
      getPartnerHiddenReadingSet() { return new Set(); },
      _isHiddenReadingItem() { return false; },
      _getCachedPartnerValue: ${methods._getCachedPartnerValue},
      _setCachedPartnerValue: ${methods._setCachedPartnerValue},
      _shouldSuppressUnscopedPartnerFallback: ${methods._shouldSuppressUnscopedPartnerFallback},
      _shouldUseScopedPartnerChildOnly: ${methods._shouldUseScopedPartnerChildOnly},
      _getPartnerChildRecord: ${methods._getPartnerChildRecord},
      _getPartnerChildLibraries: ${methods._getPartnerChildLibraries},
      getPartnerLikedRaw: ${methods.getPartnerLikedRaw},
      getPartnerSaved: ${methods.getPartnerSaved},
      getPartnerReadingStock: ${getPartnerReadingStock}
    };
    globalThis.result = {
      liked: insights.getPartnerLikedRaw(),
      readings: insights.getPartnerReadingStock(),
      saved: insights.getPartnerSaved()
    };
  `, sandbox);

  assert.deepEqual(Array.from(sandbox.result.liked, (item) => item.kanji), ['怜']);
  assert.deepEqual(Array.from(sandbox.result.readings, (item) => item.reading), ['れい']);
  assert.deepEqual(Array.from(sandbox.result.saved, (item) => item.givenName), ['怜']);
});

test('unlinked multi-child partner data stays isolated until the child is identified', () => {
  const firebaseSource = fs.readFileSync(FIREBASE_SOURCE_PATH, 'utf8');
  const childIdResolver = extractTopLevelFunction(firebaseSource, 'getWorkspaceChildRecordIds');
  const soleChildResolver = extractTopLevelFunction(firebaseSource, 'getSolePartnerChildRecord');
  const suppressFallback = extractObjectMethod(firebaseSource, 'MeimayPartnerInsights', '_shouldSuppressUnscopedPartnerFallback');
  const sandbox = {};
  vm.createContext(sandbox);
  vm.runInContext(`
    ${childIdResolver}
    ${soleChildResolver}
    const partnerRoot = {
      childOrder: ['first'],
      children: { first: {}, second: {} }
    };
    const insights = {
      _getPartnerChildContext() {
        return {
          requiresScopedChild: true,
          partnerRoot,
          partnerChild: null,
          partnerChildCount: getWorkspaceChildRecordIds(partnerRoot).length
        };
      },
      _shouldSuppressUnscopedPartnerFallback: ${suppressFallback}
    };
    globalThis.result = {
      childCount: getWorkspaceChildRecordIds(partnerRoot).length,
      soleChild: getSolePartnerChildRecord(partnerRoot),
      suppressed: insights._shouldSuppressUnscopedPartnerFallback()
    };
  `, sandbox);

  assert.equal(sandbox.result.childCount, 2);
  assert.equal(sandbox.result.soleChild, null);
  assert.equal(sandbox.result.suppressed, true);
});

test('partner snapshot follows candidate and child deletion without stale data', () => {
  const room = new InMemoryPairRoom();
  const userA = new PairClient('user-a', room);
  const userB = new PairClient('user-b', room);
  userB.connectTo('user-a');

  userA.sync(createRoomPayload({
    uid: 'user-a',
    displayName: 'A',
    workspace: createWorkspace('A', [
      { id: 'first-child', kanjiStock: [{ kanji: '陽' }] },
      { id: 'second-child', kanjiStock: [{ kanji: '凪' }] }
    ]),
    sections: { liked: [{ kanji: '陽' }, { kanji: '凪' }] }
  }));
  assert.deepEqual(userB.partnerSnapshot.liked.map((item) => item.kanji), ['陽', '凪']);

  userA.sync(createRoomPayload({
    uid: 'user-a',
    displayName: 'A',
    workspace: createWorkspace('A', [
      { id: 'first-child', kanjiStock: [{ kanji: '陽' }] }
    ]),
    sections: { liked: [{ kanji: '陽' }] }
  }));

  assert.deepEqual(userB.partnerSnapshot.liked.map((item) => item.kanji), ['陽']);
  assert.deepEqual(Object.keys(userB.partnerSnapshot.workspace.children), ['first-child']);
});

test('reading, kanji, and saved-name mutations stay connected to realtime partner sync', () => {
  const storageSource = fs.readFileSync(STORAGE_SOURCE_PATH, 'utf8');
  const flowSource = fs.readFileSync(FLOW_SOURCE_PATH, 'utf8');
  const firebaseSource = fs.readFileSync(FIREBASE_SOURCE_PATH, 'utf8');

  assert.match(extractObjectMethod(storageSource, 'StorageBox', 'saveLiked'), /queuePartnerStockSync\('saveLiked'\)/);
  assert.match(extractObjectMethod(storageSource, 'StorageBox', 'saveSavedNames'), /queuePartnerStockSync\('saveSavedNames'\)/);
  assert.match(extractTopLevelFunction(flowSource, 'saveReadingStock'), /queuePartnerStockSync\('saveReadingStock'\)/);
  assert.match(extractTopLevelFunction(flowSource, 'removeCompletedReadingFromStock'), /rememberHiddenReading\(/);
  assert.match(extractTopLevelFunction(firebaseSource, 'queuePartnerStockSync'), /_autoSyncDebounced\(reason\)/);
  assert.match(extractTopLevelFunction(firebaseSource, 'buildRoomSyncContentFingerprint'), /hiddenReadings/);
  assert.match(firebaseSource, /\.onSnapshot\(\(doc\) =>/);
});

test('partner view follows reading, kanji, and saved-name additions and removals', () => {
  const room = new InMemoryPairRoom();
  const userA = new PairClient('user-a', room);
  const userB = new PairClient('user-b', room);
  userB.connectTo('user-a');

  const firstWorkspace = createWorkspace('A', [{
    id: 'a-child',
    kanjiStock: [{ kanji: '陽' }],
    readingStock: [{ id: 'haruto', reading: 'はると' }],
    savedNames: [{ fullName: '陽斗', givenName: '陽斗' }]
  }]);
  userA.sync(createRoomPayload({
    uid: 'user-a',
    displayName: 'A',
    workspace: firstWorkspace,
    sections: {
      liked: [{ kanji: '陽' }],
      readingStock: [{ id: 'haruto', reading: 'はると' }],
      savedNames: [{ fullName: '陽斗', givenName: '陽斗' }]
    }
  }));
  assert.deepEqual(userB.partnerSnapshot.liked.map((item) => item.kanji), ['陽']);
  assert.deepEqual(userB.partnerSnapshot.readingStock.map((item) => item.reading), ['はると']);
  assert.deepEqual(userB.partnerSnapshot.savedNames.map((item) => item.givenName), ['陽斗']);

  const secondWorkspace = createWorkspace('A', [{
    id: 'a-child',
    kanjiStock: [{ kanji: '凪' }],
    readingStock: [{ id: 'minato', reading: 'みなと' }],
    savedNames: [{ fullName: '湊', givenName: '湊' }]
  }]);
  const removalPayload = createRoomPayload({
    uid: 'user-a',
    displayName: 'A',
    workspace: secondWorkspace,
    sections: {
      liked: [{ kanji: '凪' }],
      readingStock: [{ id: 'minato', reading: 'みなと' }],
      savedNames: [{ fullName: '湊', givenName: '湊' }]
    }
  });
  userA.sync(removalPayload);
  assert.deepEqual(userB.partnerSnapshot.liked.map((item) => item.kanji), ['凪']);
  assert.deepEqual(userB.partnerSnapshot.readingStock.map((item) => item.reading), ['みなと']);
  assert.deepEqual(userB.partnerSnapshot.savedNames.map((item) => item.givenName), ['湊']);

  // The final reading is retained remotely for compatibility but hidden immediately
  // on both partner views by the synchronized hidden-reading marker.
  const emptyWorkspace = createWorkspace('A', [{ id: 'a-child' }]);
  const emptyPayload = createRoomPayload({
    uid: 'user-a',
    displayName: 'A',
    workspace: emptyWorkspace,
    sections: { hiddenReadings: ['みなと'] }
  });
  emptyPayload.readingStock = clone(removalPayload.readingStock);
  emptyPayload.roomSyncFingerprint = protocol.buildRoomSyncContentFingerprint(emptyPayload);
  userA.sync(emptyPayload);

  const hiddenReadings = new Set(userB.partnerSnapshot.hiddenReadings);
  const visiblePartnerReadings = userB.partnerSnapshot.readingStock.filter((item) => !hiddenReadings.has(item.reading));
  assert.deepEqual(userB.partnerSnapshot.liked, []);
  assert.deepEqual(userB.partnerSnapshot.savedNames, []);
  assert.deepEqual(visiblePartnerReadings, []);
});

test('oversized sync keeps workspace data and stays below the Firestore safety limit', () => {
  const workspace = createWorkspace('A', [{
    id: 'a-child',
    kanjiStock: [{ kanji: '陽' }],
    readingStock: [{ id: 'haruto', reading: 'はると' }]
  }]);
  const oversizedLiked = Array.from({ length: 12000 }, (_, index) => ({
    kanji: `字${index}`,
    note: 'x'.repeat(80)
  }));
  const payload = createRoomPayload({
    uid: 'user-a',
    displayName: 'A',
    workspace,
    sections: { liked: oversizedLiked }
  });
  const bytes = protocol.estimateSerializedSizeBytes(payload);
  const hydrated = hydratePartnerPayload(payload);

  assert.ok(bytes <= ROOM_SYNC_PAYLOAD_MAX_BYTES, `payload was ${bytes} bytes`);
  assert.equal(payload.roomSyncFlatSectionsOmitted, true);
  assert.ok(payload.meimayStateV2, 'workspace must survive flat-section compaction');
  assert.deepEqual(hydrated.liked.map((item) => item.kanji), ['陽']);
});
