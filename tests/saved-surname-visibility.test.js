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

const historyPath = path.join(__dirname, '..', 'public', 'js', '12-history.js');

function createDisplaySandbox(showSurname) {
  const sandbox = {
    localStorage: {
      getItem(key) {
        return key === 'meimay_saved_show_surname' && !showSurname ? '0' : null;
      }
    }
  };
  vm.createContext(sandbox);
  vm.runInContext(`
    const SAVED_SURNAME_VISIBILITY_KEY = 'meimay_saved_show_surname';
    ${extractFunction(historyPath, 'getSavedCandidateCombinationKeyLocal')}
    ${extractFunction(historyPath, 'getSavedCandidateGivenNameLocal')}
    ${extractFunction(historyPath, 'getSavedCandidateGivenReadingLocal')}
    ${extractFunction(historyPath, 'shouldShowSavedSurname')}
    ${extractFunction(historyPath, 'getSavedCandidateDisplayParts')}
    ${extractFunction(historyPath, 'getSavedCandidateVisibleDisplayParts')}
    globalThis.savedDisplay = { getSavedCandidateDisplayParts, getSavedCandidateVisibleDisplayParts };
  `, sandbox);
  return sandbox.savedDisplay;
}

const savedName = {
  fullName: '佐藤 怜',
  reading: 'さとう れい',
  givenName: '怜',
  combination: [{ '漢字': '怜' }]
};

test('saved surname visibility hides only the displayed surname and reading', () => {
  const hiddenDisplay = createDisplaySandbox(false);
  const canonical = hiddenDisplay.getSavedCandidateDisplayParts(savedName);
  const visible = hiddenDisplay.getSavedCandidateVisibleDisplayParts(savedName);

  assert.equal(canonical.fullName, '佐藤 怜');
  assert.equal(canonical.reading, 'さとう れい');
  assert.equal(visible.fullName, '怜');
  assert.equal(visible.reading, 'れい');
  assert.equal(visible.surname, '');
});

test('saved surname visibility defaults to showing the full name', () => {
  const shownDisplay = createDisplaySandbox(true);
  const visible = shownDisplay.getSavedCandidateVisibleDisplayParts(savedName);

  assert.equal(visible.fullName, '佐藤 怜');
  assert.equal(visible.reading, 'さとう れい');
});
