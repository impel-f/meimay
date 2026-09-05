const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const acorn = require('acorn');

const historySource = fs.readFileSync(
  path.join(__dirname, '..', 'public', 'js', '12-history.js'),
  'utf8'
);
const originSource = fs.readFileSync(
  path.join(__dirname, '..', 'public', 'js', '08-origin.js'),
  'utf8'
);

function getFunctionSource(source, name) {
  const ast = acorn.parse(source, { ecmaVersion: 'latest', sourceType: 'script' });
  const node = ast.body.find(
    (entry) => entry.type === 'FunctionDeclaration' && entry.id?.name === name
  );
  assert.ok(node, `${name} must remain discoverable`);
  return source.slice(node.start, node.end);
}

test('saved detail closes only after the destination modal becomes active', () => {
  const helper = getFunctionSource(historySource, 'closeSavedNameDetailIfDestinationOpened');
  assert.match(helper, /classList\.contains\('active'\)/);
  assert.match(helper, /if \(!destination\?\.classList\.contains\('active'\)\) return false/);
  assert.match(helper, /closeSavedNameDetail\(\)/);
});

test('saved name actions stop click propagation before opening another modal', () => {
  assert.match(historySource, /event\.stopPropagation\(\); showSavedNameKanjiDetail/);
  assert.match(historySource, /event\.stopPropagation\(\); generateOriginFromSaved/);
  assert.match(historySource, /event\.stopPropagation\(\); showFortuneDetailFromSaved/);
});

test('saved origin keeps its detail open until the origin modal is visible', () => {
    const handler = getFunctionSource(originSource, 'generateOriginFromSaved');
    assert.doesNotMatch(handler, /currentBuildResult[^]*closeSavedNameDetail\(\)[^]*await generateOrigin/);
    assert.match(handler, /closeSavedNameDetailIfDestinationOpened\('modal-origin'\)/);
    assert.match(handler, /const originTask = generateOrigin\(/);
    assert.match(handler, /await originTask/);
});

test('name origin loading appears before cache and allowance requests', () => {
  const generator = getFunctionSource(originSource, 'generateOrigin');
  const loadingIndex = generator.indexOf('renderNameOriginLoading(target)');
  const staticDataIndex = generator.indexOf('await loadKanjiStaticDetails()');
  const allowanceIndex = generator.indexOf('await consumeDailyNameOriginUseForGeneration()');
  assert.ok(loadingIndex >= 0, 'loading renderer must be called');
  assert.ok(loadingIndex < staticDataIndex, 'loading must appear before static data initialization');
  assert.ok(loadingIndex < allowanceIndex, 'loading must appear before allowance checks');
});
