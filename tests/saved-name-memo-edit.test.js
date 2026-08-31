const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const source = fs.readFileSync(
  path.join(__dirname, '..', 'public', 'js', '12-history.js'),
  'utf8'
);
const firebaseSource = fs.readFileSync(
  path.join(__dirname, '..', 'public', 'js', '15-firebase.js'),
  'utf8'
);

test('saved-name memos can be added independently by both partners', () => {
  assert.match(source, /SAVED_NAME_SHARED_MEMO_KEY/);
  assert.match(source, /source === 'partner'[\s\S]*MeimayPairing\.roomCode/);
  assert.match(source, /自分のメモ/);
  assert.match(source, /partnerMemoLabel/);
  assert.match(source, /getSavedNameSharedMemo\(sourceKey, 'partner'\)/);
});

test('saved-name memo edits persist and join partner synchronization', () => {
  assert.match(source, /persistActiveChildWorkspaceSnapshot\('edit-saved-name-memo'\)/);
  assert.match(source, /persistSavedNameSharedMemo\(candidateKey, message\)/);
  assert.match(source, /StorageBox\.saveSavedNames\(\)/);
  assert.match(source, /MeimayPairing\._autoSyncDebounced\?\.\(\)/);
  assert.match(firebaseSource, /savedNameMemos: cloneRoomArray\(savedNameMemos\)/);
  assert.match(firebaseSource, /savedNameMemos: savedNameMemosSource/);
  assert.match(firebaseSource, /savedNameMemos: roomPayload\.savedNameMemos/);
});

test('saved-name memo text is escaped before detail rendering', () => {
  assert.match(source, /escapeSavedNameMemoText\(entry\.label\)/);
  assert.match(source, /escapeSavedNameMemoText\(entry\.message\)/);
  assert.match(source, /まだメモはありません。/);
});

test('origin proposal uses a full-width action below the proposal text', () => {
  assert.match(source, /line-clamp-3/);
  assert.match(source, /data-name-origin-action="saved"[\s\S]*class="mt-4 w-full/);
});

test('saved origins retain version metadata and survive backup merging', () => {
  assert.match(firebaseSource, /function mergeSavedNameOriginState\(existing, incoming, base = \{\}\)/);
  assert.match(firebaseSource, /if \(!existingOrigin && !incomingOrigin\) return base/);
  assert.match(firebaseSource, /!existingStamp[\s\S]*!incomingStamp[\s\S]*existingStamp >= incomingStamp/);
  assert.match(firebaseSource, /originPromptVersion: this\._normalizeString\(item\?\.originPromptVersion\)/);
  assert.match(firebaseSource, /originModelCacheVersion: this\._normalizeString\(item\?\.originModelCacheVersion\)/);
  assert.match(firebaseSource, /originUpdatedAt: this\._normalizeString\(item\?\.originUpdatedAt\)/);
  assert.match(firebaseSource, /mergeSavedNameOriginState\(existing, clone, base\)/);
});
