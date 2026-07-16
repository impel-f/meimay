const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const acorn = require('acorn');

const projectRoot = path.join(__dirname, '..');

function readProjectFile(...segments) {
  return fs.readFileSync(path.join(projectRoot, ...segments), 'utf8');
}

function extractFunction(source, functionName) {
  const ast = acorn.parse(source, { ecmaVersion: 'latest', sourceType: 'script' });
  const declaration = ast.body.find((node) =>
    node.type === 'FunctionDeclaration' && node.id.name === functionName
  );
  assert.ok(declaration, `${functionName} must remain discoverable`);
  return source.slice(declaration.start, declaration.end);
}

function createClassList(initial = []) {
  const values = new Set(initial);
  return {
    add: (...classes) => classes.forEach((className) => values.add(className)),
    remove: (...classes) => classes.forEach((className) => values.delete(className)),
    contains: (className) => values.has(className),
    toggle(className, force) {
      if (force === true) values.add(className);
      else if (force === false) values.delete(className);
      else if (values.has(className)) values.delete(className);
      else values.add(className);
      return values.has(className);
    }
  };
}

test('every literal screen transition points to an existing screen', () => {
  const html = readProjectFile('public', 'index.html');
  const screenIds = new Set(
    [...html.matchAll(/id="(scr-[^"]+)"/g)].map((match) => match[1])
  );
  const jsDirectory = path.join(projectRoot, 'public', 'js');
  const sources = [
    ['public/index.html', html],
    ...fs.readdirSync(jsDirectory)
      .filter((file) => file.endsWith('.js'))
      .map((file) => [`public/js/${file}`, fs.readFileSync(path.join(jsDirectory, file), 'utf8')])
  ];
  const missing = [];

  sources.forEach(([file, source]) => {
    for (const match of source.matchAll(/changeScreen\s*\(\s*['"](scr-[^'"]+)['"]/g)) {
      if (!screenIds.has(match[1])) missing.push(`${match[1]} in ${file}`);
    }
  });

  assert.equal(screenIds.size, 24);
  assert.deepEqual(missing, []);
});

test('an invalid destination cannot hide the current screen', () => {
  const core = readProjectFile('public', 'js', '01-core.js');
  const runSafely = extractFunction(core, 'runScreenTaskSafely');
  const changeScreen = extractFunction(core, 'changeScreen');
  const currentScreen = {
    id: 'scr-mode',
    classList: createClassList(['screen', 'active'])
  };
  let screenQueryCount = 0;
  const sandbox = {
    console: { log() {}, error() {} },
    window: {},
    document: {
      getElementById() {
        return null;
      },
      querySelector() {
        return currentScreen;
      },
      querySelectorAll(selector) {
        if (selector === '.screen') screenQueryCount += 1;
        return [];
      }
    }
  };
  vm.createContext(sandbox);
  vm.runInContext(`
    ${runSafely}
    ${changeScreen}
    globalThis.result = changeScreen('scr-missing');
  `, sandbox);

  assert.equal(sandbox.result, false);
  assert.equal(currentScreen.classList.contains('active'), true);
  assert.equal(screenQueryCount, 0);
});

test('a failed ad layout update does not stop the rest of a screen transition', () => {
  const core = readProjectFile('public', 'js', '01-core.js');
  const runSafely = extractFunction(core, 'runScreenTaskSafely');
  const changeScreen = extractFunction(core, 'changeScreen');
  const currentScreen = {
    id: 'scr-mode',
    scrollTop: 0,
    classList: createClassList(['screen', 'active'])
  };
  const targetScreen = {
    id: 'scr-settings',
    scrollTop: 50,
    classList: createClassList(['screen'])
  };
  const calls = { adRefresh: 0, coachmark: 0, recovery: 0 };
  const sandbox = {
    calls,
    console: { log() {}, error() {} },
    window: {},
    document: {
      getElementById(id) {
        if (id === 'scr-mode') return currentScreen;
        if (id === 'scr-settings') return targetScreen;
        return null;
      },
      querySelector(selector) {
        if (selector === '.screen.active') {
          return [currentScreen, targetScreen].find((screen) => screen.classList.contains('active')) || null;
        }
        return null;
      },
      querySelectorAll(selector) {
        if (selector === '.screen') return [currentScreen, targetScreen];
        return [];
      }
    },
    setTimeout(callback) {
      callback();
      return 1;
    }
  };
  vm.createContext(sandbox);
  vm.runInContext(`
    function shouldKeepNativeTextEditingForScreen() { return false; }
    function clearNativeTextEditingContext() {}
    function updateNavHighlight() {}
    function scheduleActiveScreenRecovery() { calls.recovery += 1; }
    function updateAdLayoutSpacing() { throw new Error('ad layout failed'); }
    function refreshAdBannerAfterScreenChange() { calls.adRefresh += 1; }
    function maybeShowContextualCoachmark() { calls.coachmark += 1; }
    ${runSafely}
    ${changeScreen}
    globalThis.result = changeScreen('scr-settings');
  `, sandbox);

  assert.equal(sandbox.result, true);
  assert.equal(currentScreen.classList.contains('active'), false);
  assert.equal(targetScreen.classList.contains('active'), true);
  assert.equal(targetScreen.scrollTop, 0);
  assert.equal(calls.adRefresh, 1);
  assert.equal(calls.coachmark, 1);
  assert.equal(calls.recovery, 1);
});

test('failed search data leaves an error state instead of permanent loading text', () => {
  const flow = readProjectFile('public', 'js', '04-ui-flow.js');
  const readingSearch = extractFunction(flow, 'executeReadingSearch');
  const kanjiSearch = extractFunction(flow, 'executeKanjiSearch');

  assert.match(readingSearch, /getCandidateDataLoadStatus\('readingsData'\)/);
  assert.match(readingSearch, /読みデータを読み込めませんでした/);
  assert.match(kanjiSearch, /getCandidateDataLoadStatus\('master'\)/);
  assert.match(kanjiSearch, /漢字データを読み込めませんでした/);
});
