const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const acorn = require('acorn');

const BUILD_SOURCE_PATH = path.join(__dirname, '..', 'public', 'js', '07-build.js');

function extractFunctions(source, functionNames) {
  const names = new Set(functionNames);
  const ast = acorn.parse(source, { ecmaVersion: 'latest', sourceType: 'script' });
  const declarations = ast.body
    .filter((node) => node.type === 'FunctionDeclaration' && names.has(node.id.name))
    .map((node) => source.slice(node.start, node.end));
  assert.equal(declarations.length, names.size, 'free-build preference functions must remain discoverable');
  return declarations.join('\n');
}

function loadFreeBuildPreferenceHelpers() {
  const source = fs.readFileSync(BUILD_SOURCE_PATH, 'utf8');
  const declarations = extractFunctions(source, [
    'resolveLikedCandidateKanji',
    'mergeLikedCandidateOwnershipState',
    'mergeFreeBuildKanjiCandidates',
    'hydrateLikedCandidate',
    'getCardSuperFlags',
    'hasBuildSuperPreference',
    'getFreeBuildCandidatePriority',
    'renderBuildSuperStars'
  ]);
  const sandbox = {
    window: {
      renderMeimaySuperStars({ self, partner }) {
        return `${self ? 'S' : ''}${partner ? 'P' : ''}`;
      }
    },
    findBuildMasterItem: () => null
  };
  vm.createContext(sandbox);
  vm.runInContext(`
    ${declarations}
    globalThis.helpers = {
      hydrateLikedCandidate,
      mergeFreeBuildKanjiCandidates,
      getCardSuperFlags,
      hasBuildSuperPreference,
      getFreeBuildCandidatePriority,
      renderBuildSuperStars
    };
  `, sandbox, { filename: BUILD_SOURCE_PATH });
  return sandbox.helpers;
}

const helpers = loadFreeBuildPreferenceHelpers();

test('free build merges both users preference for the same kanji', () => {
  const own = helpers.hydrateLikedCandidate({ kanji: '怜', isSuper: true });
  const partner = helpers.hydrateLikedCandidate({ kanji: '怜', isSuper: true }, { fromPartner: true });
  const merged = helpers.mergeFreeBuildKanjiCandidates([own], [partner]);

  assert.equal(merged.length, 1);
  assert.equal(merged[0].ownSuper, true);
  assert.equal(merged[0].partnerSuper, true);
  assert.equal(merged[0].isSuper, true);
  assert.equal(merged[0].partnerAlsoPicked, true);
  assert.deepEqual({ ...helpers.getCardSuperFlags(merged[0]) }, { self: true, partner: true });
  assert.equal(helpers.renderBuildSuperStars(merged[0]), 'SP');
});

test('ownership-specific preference remains recognized even without legacy isSuper', () => {
  const own = helpers.hydrateLikedCandidate({ kanji: '陽', ownSuper: true, isSuper: false });
  const partner = helpers.hydrateLikedCandidate(
    { kanji: '凪', partnerSuper: true, isSuper: false },
    { fromPartner: true }
  );

  assert.equal(helpers.hasBuildSuperPreference(own), true);
  assert.equal(helpers.hasBuildSuperPreference(partner), true);
  assert.equal(helpers.getFreeBuildCandidatePriority(own), 1);
  assert.equal(helpers.getFreeBuildCandidatePriority(partner), 2);
});
