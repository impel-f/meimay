const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const acorn = require('acorn');

const firebasePath = path.join(__dirname, '..', 'public', 'js', '15-firebase.js');
const source = fs.readFileSync(firebasePath, 'utf8');
const ast = acorn.parse(source, { ecmaVersion: 'latest', sourceType: 'script' });
const helper = ast.body.find(
  (node) => node.type === 'FunctionDeclaration' && node.id?.name === 'mergeSavedNameOriginState'
);
assert.ok(helper, 'saved origin merge helper must remain discoverable');

const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(`${source.slice(helper.start, helper.end)}; globalThis.mergeOrigin = mergeSavedNameOriginState;`, sandbox);

function merge(existing, incoming) {
  return JSON.parse(JSON.stringify(sandbox.mergeOrigin(existing, incoming, { ...existing, ...incoming })));
}

test('an empty remote origin never erases an existing local origin', () => {
  const result = merge(
    { origin: '家族で決めた由来です。', originPromptVersion: 'legacy' },
    { origin: '', originPromptVersion: '' }
  );
  assert.equal(result.origin, '家族で決めた由来です。');
  assert.equal(result.originPromptVersion, 'legacy');
});

test('legacy origin conflicts keep the currently displayed local text', () => {
  const result = merge(
    { origin: '端末にある由来です。' },
    { origin: '旧バックアップの由来です。' }
  );
  assert.equal(result.origin, '端末にある由来です。');
});

test('a timestamped cloud record does not replace a legacy local origin automatically', () => {
  const result = merge(
    { origin: 'アップデート前から保存している由来です。' },
    {
      origin: '別の由来です。',
      originUpdatedAt: '2026-08-31T00:00:00.000Z'
    }
  );
  assert.equal(result.origin, 'アップデート前から保存している由来です。');
  assert.equal(result.originUpdatedAt, '');
});

test('a newly regenerated origin wins when it has the newer origin timestamp', () => {
  const result = merge(
    { origin: '以前の由来です。', originUpdatedAt: '2026-08-01T00:00:00.000Z' },
    {
      origin: '新しく作り直した由来です。',
      originPromptVersion: 'name_origin_v33',
      originModelCacheVersion: 'gemini_model_gemini-3.7-flash',
      originUpdatedAt: '2026-08-31T00:00:00.000Z'
    }
  );
  assert.equal(result.origin, '新しく作り直した由来です。');
  assert.equal(result.originPromptVersion, 'name_origin_v33');
  assert.equal(result.originUpdatedAt, '2026-08-31T00:00:00.000Z');
});
