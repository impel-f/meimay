const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const acorn = require('acorn');

function extractFunction(filePath, functionName) {
  const source = fs.readFileSync(filePath, 'utf8');
  const ast = acorn.parse(source, { ecmaVersion: 'latest', sourceType: 'script' });
  const declaration = ast.body.find((node) =>
    node.type === 'FunctionDeclaration' && node.id.name === functionName
  );
  assert.ok(declaration, `${functionName} must remain discoverable`);
  return source.slice(declaration.start, declaration.end);
}

const corePath = path.join(__dirname, '..', 'public', 'js', '01-core.js');
const flowPath = path.join(__dirname, '..', 'public', 'js', '04-ui-flow.js');
const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(`
  ${extractFunction(corePath, 'toHira')}
  ${extractFunction(flowPath, 'normalizeDirectNameReadingValue')}
  ${extractFunction(flowPath, 'isValidDirectNameReading')}
  globalThis.directNameReading = {
    normalizeDirectNameReadingValue,
    isValidDirectNameReading
  };
`, sandbox);

const reading = sandbox.directNameReading;

test('direct-name reading accepts hiragana and normalizes katakana', () => {
  assert.equal(reading.normalizeDirectNameReadingValue(' はると '), 'はると');
  assert.equal(reading.normalizeDirectNameReadingValue('ハルト'), 'はると');
  assert.equal(reading.isValidDirectNameReading('はると'), true);
  assert.equal(reading.isValidDirectNameReading('りょうすけ'), true);
});

test('direct-name reading rejects kanji, latin letters, and symbols', () => {
  assert.equal(reading.isValidDirectNameReading('怜'), false);
  assert.equal(reading.isValidDirectNameReading('はる怜'), false);
  assert.equal(reading.isValidDirectNameReading('haruto'), false);
  assert.equal(reading.isValidDirectNameReading('はる・と'), false);
  assert.equal(reading.isValidDirectNameReading(''), false);
});

test('opening a new direct-name entry clears the previous form values', () => {
  const fields = new Map([
    ['direct-name-given', { value: '怜奈' }],
    ['direct-name-reading', { value: 'れな' }],
    ['direct-name-message', { value: '前のメモ' }]
  ]);
  const formSandbox = {
    document: { getElementById: (id) => fields.get(id) || null },
    previewUpdates: 0,
    updateDirectNameInputPreview() {
      formSandbox.previewUpdates += 1;
    }
  };
  vm.createContext(formSandbox);
  vm.runInContext(`
    ${extractFunction(flowPath, 'resetDirectNameInputForm')}
    resetDirectNameInputForm();
  `, formSandbox);

  assert.equal(fields.get('direct-name-given').value, '');
  assert.equal(fields.get('direct-name-reading').value, '');
  assert.equal(fields.get('direct-name-message').value, '');
  assert.equal(formSandbox.previewUpdates, 1);
});

test('direct-name values are cleared before the input screen is shown', () => {
  const fields = new Map([
    ['direct-name-given', { value: '怜奈' }],
    ['direct-name-reading', { value: 'れな' }],
    ['direct-name-message', { value: '前のメモ' }]
  ]);
  const openSandbox = {
    document: { getElementById: (id) => fields.get(id) || null },
    openedScreen: '',
    changeScreen(screen) {
      openSandbox.openedScreen = screen;
    },
    setTimeout() {},
    updateDirectNameInputPreview() {}
  };
  vm.createContext(openSandbox);
  vm.runInContext(`
    let directNameInputOrigin = 'search';
    ${extractFunction(flowPath, 'resetDirectNameInputForm')}
    ${extractFunction(flowPath, 'openDirectNameInput')}
    openDirectNameInput('search_footer');
  `, openSandbox);

  assert.equal(fields.get('direct-name-given').value, '');
  assert.equal(fields.get('direct-name-reading').value, '');
  assert.equal(fields.get('direct-name-message').value, '');
  assert.equal(openSandbox.openedScreen, 'scr-direct-name-input');
});
