const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const acorn = require('acorn');

const FIREBASE_SOURCE_PATH = path.join(__dirname, '..', 'public', 'js', '15-firebase.js');

function getPropertyName(property) {
  if (!property || property.type !== 'Property' || property.computed) return '';
  if (property.key.type === 'Identifier') return property.key.name;
  if (property.key.type === 'Literal') return String(property.key.value);
  return '';
}

function extractBackupApplyCode() {
  const source = fs.readFileSync(FIREBASE_SOURCE_PATH, 'utf8');
  const ast = acorn.parse(source, { ecmaVersion: 'latest', sourceType: 'script' });
  const aggregate = ast.body.find(
    (node) => node.type === 'FunctionDeclaration' && node.id?.name === 'aggregateRoomSyncWorkspaceSections'
  );
  assert.ok(aggregate, 'workspace aggregation must remain discoverable');

  let backupObject = null;
  const pending = [ast];
  while (pending.length > 0 && !backupObject) {
    const node = pending.pop();
    if (!node || typeof node !== 'object') continue;
    if (node.type === 'VariableDeclarator' && node.id?.name === 'MeimayUserBackup') {
      backupObject = node.init;
      break;
    }
    Object.values(node).forEach((value) => {
      if (Array.isArray(value)) value.forEach((entry) => pending.push(entry));
      else if (value && typeof value === 'object') pending.push(value);
    });
  }
  assert.equal(backupObject?.type, 'ObjectExpression');
  const applyProperty = backupObject.properties.find(
    (property) => getPropertyName(property) === 'applyRemoteBackupPayload'
  );
  assert.ok(applyProperty, 'backup apply method must remain discoverable');

  return {
    aggregate: source.slice(aggregate.start, aggregate.end),
    applyProperty: source.slice(applyProperty.start, applyProperty.end)
  };
}

function createCompatibilityHarness() {
  const code = extractBackupApplyCode();
  const sandbox = {};
  vm.createContext(sandbox);
  vm.runInContext(`
    ${code.aggregate}
    const applied = {
      sections: null,
      hiddenReadings: null,
      encounteredReadings: null,
      workspace: null
    };
    const MeimayUserBackup = {
      _readCurrentSections() {
        return { liked: [], savedNames: [], readingStock: [] };
      },
      _mergeByKey(localItems, remoteItems) {
        return Array.isArray(remoteItems) ? remoteItems : [];
      },
      _getLikedKey(item) {
        return item?.kanji || item?.['漢字'] || '';
      },
      _getSavedKey(item) {
        return item?.fullName || '';
      },
      _getReadingStockKey(item) {
        return item?.id || item?.reading || '';
      },
      _applyHiddenReadings(values) {
        applied.hiddenReadings = values;
      },
      _applyEncounteredReadings(values) {
        applied.encounteredReadings = values;
      },
      _readChildWorkspaceStateV2() {
        return null;
      },
      _shouldApplyRemoteChildWorkspaceStateV2() {
        return true;
      },
      _applyChildWorkspaceStateV2(value) {
        applied.workspace = value;
      },
      _applySectionsToLocal(value) {
        applied.sections = value;
      },
      _currentUser() {
        return null;
      },
      ${code.applyProperty}
    };
    globalThis.compatibilityHarness = {
      async apply(serializedPayload) {
        applied.sections = null;
        applied.hiddenReadings = null;
        applied.encounteredReadings = null;
        applied.workspace = null;
        const summary = await MeimayUserBackup.applyRemoteBackupPayload(
          JSON.parse(serializedPayload),
          { replace: true }
        );
        return JSON.stringify({ applied, summary });
      }
    };
  `, sandbox, { filename: FIREBASE_SOURCE_PATH });

  return async (payload) => JSON.parse(
    await sandbox.compatibilityHarness.apply(JSON.stringify(payload))
  );
}

function legacySections() {
  return {
    liked: [{ kanji: '陽' }],
    savedNames: [{ fullName: '山田陽菜' }],
    readingStock: [{ id: 'ひな::', reading: 'ひな' }],
    hiddenReadings: ['ひみつ'],
    encounteredReadings: [{ key: 'ひな', reading: 'ひな' }]
  };
}

test('legacy raw and nested backup envelopes still restore their flat arrays', async () => {
  const apply = createCompatibilityHarness();
  const legacy = legacySections();

  for (const payload of [legacy, { backup: legacy }, { meimayBackup: legacy }]) {
    const result = await apply(payload);
    assert.equal(result.summary.likedCount, 1);
    assert.equal(result.summary.savedNamesCount, 1);
    assert.equal(result.summary.readingStockCount, 1);
    assert.deepEqual(result.applied.hiddenReadings, ['ひみつ']);
    assert.equal(result.applied.encounteredReadings.length, 1);
  }
});

test('legacy workspace aliases remain restorable when flat sections are omitted', async () => {
  const apply = createCompatibilityHarness();
  const workspace = {
    children: {
      legacy: {
        libraries: {
          kanjiStock: [{ kanji: '陽' }],
          savedNames: [{ fullName: '山田陽菜' }],
          readingStock: [{ id: 'ひな::', reading: 'ひな' }],
          hiddenReadings: ['ひみつ']
        }
      }
    }
  };

  for (const alias of ['meimayStateV2', 'childWorkspaceStateV2', 'stateV2']) {
    const result = await apply({
      backup: {
        flatSectionsOmitted: true,
        [alias]: workspace
      }
    });
    assert.equal(result.summary.likedCount, 1);
    assert.equal(result.summary.savedNamesCount, 1);
    assert.equal(result.summary.readingStockCount, 1);
    assert.deepEqual(result.applied.workspace, workspace);
  }
});
