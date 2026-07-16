const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const acorn = require('acorn');

function readSource(file) {
  return fs.readFileSync(path.join(__dirname, '..', 'public', 'js', file), 'utf8');
}

function extractFunction(source, name) {
  const ast = acorn.parse(source, { ecmaVersion: 'latest', sourceType: 'script' });
  const node = ast.body.find((entry) => entry.type === 'FunctionDeclaration' && entry.id?.name === name);
  assert.ok(node, `${name} must remain a top-level function`);
  return source.slice(node.start, node.end);
}

test('shared operation timeout settles a stalled promise', async () => {
  const source = readSource('01-core.js');
  const sandbox = { Error, Number, Promise, clearTimeout, setTimeout };
  vm.createContext(sandbox);
  vm.runInContext(`
    const MEIMAY_DEFAULT_OPERATION_TIMEOUT_MS = 20000;
    ${extractFunction(source, 'createMeimayTimeoutError')}
    ${extractFunction(source, 'withMeimayTimeout')}
    globalThis.result = withMeimayTimeout(new Promise(() => {}), 10, 'テスト通信');
  `, sandbox);

  await assert.rejects(sandbox.result, (error) => {
    assert.equal(error?.name, 'MeimayTimeoutError');
    assert.equal(error?.code, 'meimay_timeout');
    return true;
  });
});

test('AI loading flows use bounded fetches and reject HTTP errors', () => {
  const source = readSource('04-ui-flow.js');
  for (const name of ['aiAnalyzeSoundPreferences', 'aiSuggestFreeKanji', 'executeAkinatorAI']) {
    const body = extractFunction(source, name);
    assert.match(body, /fetchWithMeimayTimeout\(/, `${name} must use the bounded fetch helper`);
    assert.match(body, /if \(!res\.ok\) throw new Error/, `${name} must reject HTTP errors`);
  }
});

test('partner sync times out, releases its lock, and schedules a retry', () => {
  const source = readSource('15-firebase.js');
  const overrideStart = source.indexOf('MeimayPairing.syncMyData = async function ()');
  assert.ok(overrideStart >= 0, 'active partner sync override must exist');
  const overrideEnd = source.indexOf('\n};', overrideStart);
  const body = source.slice(overrideStart, overrideEnd + 3);

  assert.match(body, /withMeimayTimeout\(roomDataRef\.get\(\), 15000/);
  assert.match(body, /withMeimayTimeout\(roomDataRef\.set\(roomPayload/);
  assert.match(body, /this\._syncInProgress = false/);
  assert.match(body, /const retryDelay = syncFailed \? 5000 : 250/);
  assert.match(body, /this\._syncRetryTimer = setTimeout/);
});

test('newer partner snapshots cannot be overwritten by a delayed older fallback', () => {
  const source = readSource('15-firebase.js');
  assert.match(source, /snapshotApplySequence = \(Number\(this\._partnerSnapshotApplySequence\) \|\| 0\) \+ 1/);
  assert.match(source, /snapshotApplySequence !== this\._partnerSnapshotApplySequence/);
  assert.match(source, /withMeimayTimeout\([\s\S]*?パートナーデータの補完/);
});
