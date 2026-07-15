const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const acorn = require('acorn');

function extractFunctions(filePath, functionNames) {
  const source = fs.readFileSync(filePath, 'utf8');
  const names = new Set(functionNames);
  const ast = acorn.parse(source, { ecmaVersion: 'latest', sourceType: 'script' });
  const declarations = ast.body
    .filter((node) => node.type === 'FunctionDeclaration' && names.has(node.id.name))
    .map((node) => source.slice(node.start, node.end));
  assert.equal(declarations.length, names.size, 'saved matching functions must remain discoverable');
  return declarations.join('\n');
}

const historyPath = path.join(__dirname, '..', 'public', 'js', '12-history.js');
const firebasePath = path.join(__dirname, '..', 'public', 'js', '15-firebase.js');

function loadSavedMatchingHelpers() {
  const sandbox = { toHira: (value) => String(value || '') };
  vm.createContext(sandbox);
  vm.runInContext(`
    ${extractFunctions(historyPath, ['markSavedCandidateApprovedByPartnerSelection'])}
    ${extractFunctions(firebasePath, [
      'getPairingSavedNameCombinationKey',
      'getPairingSavedNameGivenName',
      'getPairingSavedNameGivenReading',
      'buildPairingSavedNameKey',
      'canonicalizePairingSavedNameKey',
      'getPairingExplicitApprovedSavedKey'
    ])}
    globalThis.savedMatching = {
      markSavedCandidateApprovedByPartnerSelection,
      buildPairingSavedNameKey,
      getPairingExplicitApprovedSavedKey
    };
  `, sandbox);
  return sandbox.savedMatching;
}

const helpers = loadSavedMatchingHelpers();

test('independently saving the same name does not create an explicit match', () => {
  const own = {
    givenName: '陽斗',
    givenReading: 'はると',
    combinationKeys: ['陽', '斗']
  };
  const partner = { ...own };

  assert.equal(helpers.buildPairingSavedNameKey(own), helpers.buildPairingSavedNameKey(partner));
  assert.equal(helpers.getPairingExplicitApprovedSavedKey(own), '');
  assert.equal(helpers.getPairingExplicitApprovedSavedKey(partner), '');
});

test('selecting the partner candidate marks the existing own candidate as matched', () => {
  const own = {
    givenName: '陽斗',
    givenReading: 'はると',
    combinationKeys: ['陽', '斗'],
    approvedFromPartner: false
  };
  const sourceKey = helpers.buildPairingSavedNameKey(own);
  const selected = helpers.markSavedCandidateApprovedByPartnerSelection(
    own,
    sourceKey,
    '2026-07-15T00:00:00.000Z'
  );

  assert.equal(selected.approvedFromPartner, false, 'the original candidate must stay owned by the user');
  assert.equal(selected.approvedPartnerSavedKey, sourceKey);
  assert.equal(selected.mainSelected, true);
  assert.equal(helpers.getPairingExplicitApprovedSavedKey(selected), sourceKey);
});
