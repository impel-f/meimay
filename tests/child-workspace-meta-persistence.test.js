const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const acorn = require('acorn');

const CHILD_WORKSPACES_SOURCE_PATH = path.join(__dirname, '..', 'public', 'js', '21-child-workspaces.js');

function getPropertyName(property) {
  if (!property || property.type !== 'Property' || property.computed) return '';
  if (property.key.type === 'Identifier') return property.key.name;
  if (property.key.type === 'Literal') return String(property.key.value);
  return '';
}

function findObjectDeclarator(ast, objectName) {
  const pending = [ast];
  while (pending.length > 0) {
    const node = pending.pop();
    if (!node || typeof node !== 'object') continue;
    if (node.type === 'VariableDeclarator' && node.id?.name === objectName) {
      return node;
    }
    Object.keys(node).forEach((key) => {
      if (key === 'start' || key === 'end') return;
      const value = node[key];
      if (Array.isArray(value)) {
        value.forEach((entry) => {
          if (entry && typeof entry === 'object') pending.push(entry);
        });
      } else if (value && typeof value === 'object') {
        pending.push(value);
      }
    });
  }
  return null;
}

function findFunctionDeclarations(ast, functionNames) {
  const requested = new Set(functionNames);
  const found = [];
  const pending = [ast];
  while (pending.length > 0) {
    const node = pending.pop();
    if (!node || typeof node !== 'object') continue;
    if (node.type === 'FunctionDeclaration' && requested.has(node.id?.name)) {
      found.push(node);
    }
    Object.keys(node).forEach((key) => {
      if (key === 'start' || key === 'end') return;
      const value = node[key];
      if (Array.isArray(value)) {
        value.forEach((entry) => {
          if (entry && typeof entry === 'object') pending.push(entry);
        });
      } else if (value && typeof value === 'object') {
        pending.push(value);
      }
    });
  }
  return found;
}

function extractFunctionDeclarations(filePath, functionNames) {
  const source = fs.readFileSync(filePath, 'utf8');
  const ast = acorn.parse(source, { ecmaVersion: 'latest', sourceType: 'script' });
  const requested = new Set(functionNames);
  const declarations = findFunctionDeclarations(ast, functionNames);
  const found = new Set(declarations.map((node) => node.id?.name).filter(Boolean));
  assert.deepEqual([...found].sort(), [...requested].sort(), 'required helper functions must remain discoverable');
  const selected = declarations.map((node) => source.slice(node.start, node.end));
  return selected.join('\n');
}

function extractObjectProperties(filePath, objectName, propertyNames) {
  const source = fs.readFileSync(filePath, 'utf8');
  const ast = acorn.parse(source, { ecmaVersion: 'latest', sourceType: 'script' });
  const declarator = findObjectDeclarator(ast, objectName);
  assert.ok(declarator, `${objectName} declaration must remain discoverable`);
  assert.equal(declarator?.init?.type, 'ObjectExpression', `${objectName} must remain an object literal`);

  const requested = new Set(propertyNames);
  const selected = declarator.init.properties
    .filter((property) => requested.has(getPropertyName(property)));
  const found = new Set(selected.map(getPropertyName));
  assert.deepEqual([...found].sort(), [...requested].sort(), `${objectName} properties must remain discoverable`);

  return selected.map((property) => source.slice(property.start, property.end)).join(',\n');
}

function createHarness() {
  const helperCode = extractFunctionDeclarations(CHILD_WORKSPACES_SOURCE_PATH, [
    'getLegacyWizardChildDateValue'
  ]);
  const objectCode = extractObjectProperties(CHILD_WORKSPACES_SOURCE_PATH, 'MeimayChildWorkspaces', [
    'captureCurrentChildRecord',
    'persistActiveChildSnapshot'
  ]);

  const sandbox = {
    console: {
      log() {},
      warn() {},
      error() {}
    }
  };
  vm.createContext(sandbox);
  vm.runInContext(`
    let gender = 'neutral';
    let liked = [];
    let savedNames = [];
    let selectedImageTags = ['none'];
    let segments = [];
    let currentPos = 0;
    let currentIdx = 0;
    let swipes = 0;
    let buildMode = 'reading';
    let selectedPieces = [];
    let currentBuildResult = {};
    let fbChoices = [];
    let fbChoicesUseMark = {};
    let shownFbSlots = 1;
    let fbSelectedReading = null;
    let fbSelectedReadingSource = 'auto';
    let currentFbRecommendedReadings = [];
    let excludedKanjiFromBuild = [];
    let rule = 'strict';
    let prioritizeFortune = false;
    let surnameStr = '';
    let surnameReading = '';
    let userTags = {};
    let soundPreferenceData = { liked: [], noped: [] };
    let shareMode = 'auto';
    let __wizardData = { completed: true, dueDate: '', birthDate: '' };
    let __savedRoots = [];
    const document = {
      getElementById() {
        return null;
      }
    };
    const window = {
      getCompoundBuildFlow() {
        return null;
      }
    };
    const localStorage = {
      getItem() { return null; },
      setItem() {},
      removeItem() {}
    };
    const WizardData = {
      get() {
        return __wizardData;
      },
      save(next) {
        __wizardData = JSON.parse(JSON.stringify(next));
      }
    };
    function cloneData(value, fallback) {
      if (value === undefined) return JSON.parse(JSON.stringify(fallback));
      return JSON.parse(JSON.stringify(value));
    }
    function normalizePositiveInteger(value, fallback = 1) {
      const num = Number(value);
      return Number.isFinite(num) && num > 0 ? Math.floor(num) : fallback;
    }
    function normalizeNonNegativeInteger(value, fallback = 0) {
      const num = Number(value);
      return Number.isFinite(num) && num >= 0 ? Math.floor(num) : fallback;
    }
    function normalizeTwinIndex(value) {
      if (value === null || value === undefined || value === '') return null;
      const num = Number(value);
      return Number.isFinite(num) && num >= 0 ? Math.floor(num) : null;
    }
    function normalizeMultipleCount(value, fallback = 2) {
      const num = Number(value);
      return Number.isFinite(num) && num >= 2 ? Math.floor(num) : fallback;
    }
    function normalizeGenderValue(value) {
      return value === 'male' || value === 'female' ? value : 'neutral';
    }
    function buildDisplayLabel(birthOrder, twinIndex = null, multipleCount = null) {
      const safeOrder = normalizePositiveInteger(birthOrder, 1);
      if (twinIndex === null || multipleCount === null) return '第' + safeOrder + '子';
      return '第' + safeOrder + '子(' + (Number(twinIndex) + 1) + '/' + multipleCount + ')';
    }
    function getNowIso() {
      return '2026-07-31T00:00:00.000Z';
    }
    function getSavedCanvasStateSnapshot() {
      return {};
    }
    function createBlankBuildResult() {
      return {};
    }
    function getReadingStock() {
      return [];
    }
    function readJsonArray() {
      return [];
    }
    ${helperCode}
    const MeimayChildWorkspaces = {
      initialized: true,
      _persistenceLocked: false,
      _snapshotPersistTimer: null,
      _pendingSnapshotReason: '',
      _pendingSnapshotOptions: null,
      root: null,
      normalizeReadingLibrary(items) {
        return Array.isArray(items) ? cloneData(items, []) : [];
      },
      normalizeKanjiLibrary(items) {
        return Array.isArray(items) ? cloneData(items, []) : [];
      },
      normalizeSavedLibrary(items) {
        return Array.isArray(items) ? cloneData(items, []) : [];
      },
      captureCurrentFamilyState() {
        return { saved: true };
      },
      buildOrderedChildIds(root) {
        return Object.keys(root.children || {});
      },
      getActiveChild() {
        if (!this.root) return null;
        return this.root.children[this.root.activeChildId] || null;
      },
      saveRoot(root, options = {}) {
        __savedRoots.push({
          root: JSON.parse(JSON.stringify(root)),
          options: JSON.parse(JSON.stringify(options))
        });
      },
      ${objectCode}
    };
    globalThis.metaHarness = {
      setGlobals(nextGender, wizardDueDate) {
        gender = nextGender;
        __wizardData = { completed: true, dueDate: wizardDueDate || '', birthDate: '' };
      },
      capture(existingMeta) {
        return MeimayChildWorkspaces.captureCurrentChildRecord(existingMeta);
      },
      persist(root, nextGender, wizardDueDate) {
        __savedRoots = [];
        gender = nextGender;
        __wizardData = { completed: true, dueDate: wizardDueDate || '', birthDate: '' };
        MeimayChildWorkspaces.root = JSON.parse(JSON.stringify(root));
        MeimayChildWorkspaces.persistActiveChildSnapshot('test');
        return {
          root: JSON.parse(JSON.stringify(MeimayChildWorkspaces.root)),
          savedRoots: JSON.parse(JSON.stringify(__savedRoots))
        };
      }
    };
  `, sandbox, { filename: CHILD_WORKSPACES_SOURCE_PATH });

  return sandbox.metaHarness;
}

test('captureCurrentChildRecord keeps the child gender when globals differ', () => {
  const harness = createHarness();
  harness.setGlobals('neutral', '2026-12-24');

  const record = harness.capture({
    id: 'child_1',
    birthOrder: 1,
    gender: 'female',
    dueDate: '2026-09-01',
    createdAt: '2026-07-01T00:00:00.000Z'
  });

  assert.equal(record.meta.gender, 'female');
  assert.equal(record.meta.dueDate, '2026-09-01');
});

test('captureCurrentChildRecord does not revive an old wizard date when the child date is intentionally blank', () => {
  const harness = createHarness();
  harness.setGlobals('male', '2026-12-24');

  const record = harness.capture({
    id: 'child_1',
    birthOrder: 1,
    gender: 'male',
    dueDate: '',
    createdAt: '2026-07-01T00:00:00.000Z'
  });

  assert.equal(record.meta.dueDate, '');
});

test('persistActiveChildSnapshot preserves active child meta instead of overwriting it from globals', () => {
  const harness = createHarness();
  const result = harness.persist({
    activeChildId: 'child_1',
    children: {
      child_1: {
        meta: {
          id: 'child_1',
          birthOrder: 1,
          displayLabel: '第一子',
          gender: 'female',
          dueDate: '2026-09-01',
          birthDate: '',
          createdAt: '2026-07-01T00:00:00.000Z',
          updatedAt: '2026-07-10T00:00:00.000Z'
        },
        prefs: {},
        draft: {},
        libraries: {}
      }
    },
    family: {}
  }, 'neutral', '2026-12-24');

  assert.equal(result.root.children.child_1.meta.gender, 'female');
  assert.equal(result.root.children.child_1.meta.dueDate, '2026-09-01');
  assert.equal(result.savedRoots.length, 1);
  assert.equal(result.savedRoots[0].root.children.child_1.meta.gender, 'female');
  assert.equal(result.savedRoots[0].root.children.child_1.meta.dueDate, '2026-09-01');
});
