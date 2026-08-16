const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const source = fs.readFileSync(
  path.join(__dirname, '..', 'public', 'js', '12-history.js'),
  'utf8'
);

test('saved-name memo editing is limited to candidates created by the current user', () => {
  assert.match(source, /source === 'own'[\s\S]*item\.fromPartner !== true[\s\S]*item\.approvedFromPartner !== true/);
  assert.match(source, /canEditSavedNameMemo\(item, source\)/);
});

test('saved-name memo edits persist and join partner synchronization', () => {
  assert.match(source, /persistActiveChildWorkspaceSnapshot\('edit-saved-name-memo'\)/);
  assert.match(source, /StorageBox\.saveSavedNames\(\)/);
  assert.match(source, /MeimayPairing\._autoSyncDebounced\?\.\(\)/);
});

test('saved-name memo text is escaped before detail rendering', () => {
  assert.match(source, /const safeMessage = escapeSavedNameMemoText\(item\.message \|\| ''\)/);
  assert.match(source, /safeMessage \|\| 'まだメモはありません。'/);
});
