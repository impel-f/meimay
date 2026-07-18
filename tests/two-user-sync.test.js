const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const acorn = require('acorn');

const FIREBASE_SOURCE_PATH = path.join(__dirname, '..', 'public', 'js', '15-firebase.js');
const ROOM_SYNC_PAYLOAD_MAX_BYTES = 850 * 1024;

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
