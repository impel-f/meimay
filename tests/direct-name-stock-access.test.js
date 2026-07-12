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

function extractObjectMethod(filePath, objectName, methodName) {
  const source = fs.readFileSync(filePath, 'utf8');
  const ast = acorn.parse(source, { ecmaVersion: 'latest', sourceType: 'script' });
  const declaration = ast.body.find((node) =>
    node.type === 'VariableDeclaration'
    && node.declarations.some((entry) => entry.id.name === objectName)
  );
  const target = declaration?.declarations.find((entry) => entry.id.name === objectName)?.init;
  const method = target?.properties.find((property) => property.key?.name === methodName);
  assert.ok(method, `${objectName}.${methodName} must remain discoverable`);
  return source.slice(method.start, method.end);
}

const enginePath = path.join(__dirname, '..', 'public', 'js', '02-engine.js');
const flowPath = path.join(__dirname, '..', 'public', 'js', '04-ui-flow.js');
const firebasePath = path.join(__dirname, '..', 'public', 'js', '15-firebase.js');

function createSandbox() {
  const sandbox = {
    premiumActive: false,
    liked: [],
    master: [
      { '漢字': '陽', '常用漢字': true, '画数': 12, gender: 'neutral' },
      { '漢字': '怜', '常用漢字': false, '画数': 8, gender: 'neutral' }
    ],
    saveCount: 0,
    rankingLikes: [],
    StorageBox: {
      saveLiked() {
        sandbox.saveCount += 1;
        return true;
      }
    },
    MeimayStats: {
      recordKanjiLike(kanji) {
        sandbox.rankingLikes.push(kanji);
      }
    }
  };
  vm.createContext(sandbox);
  vm.runInContext(`
    const KANJI_STOCK_ACCESS_PREMIUM_REQUIRED = 'premium-required';
    const KANJI_STOCK_ACCESS_UNLOCKED = 'unlocked';
    function isPremiumAccessActive() { return premiumActive; }
    ${extractFunction(enginePath, 'isCommonKanjiEntry')}
    ${extractFunction(enginePath, 'isPremiumRequiredKanjiStockItem')}
    ${extractFunction(enginePath, 'isKanjiStockPermanentlyUnlocked')}
    ${extractFunction(enginePath, 'isKanjiStockItemUsable')}
    ${extractFunction(enginePath, 'promotePremiumRequiredKanjiStockItems')}
    ${extractFunction(flowPath, 'isDirectNameCjkKanji')}
    ${extractFunction(flowPath, 'findDirectNameMasterKanji')}
    ${extractFunction(flowPath, 'addDirectNameKanjiStock')}
    globalThis.stockAccess = {
      isKanjiStockPermanentlyUnlocked,
      isKanjiStockItemUsable,
      promotePremiumRequiredKanjiStockItems,
      addDirectNameKanjiStock
    };
  `, sandbox);
  return sandbox;
}

test('free direct-name jinmeiyo stock is visible but locked and excluded from ranking likes', () => {
  const sandbox = createSandbox();
  const added = sandbox.stockAccess.addDirectNameKanjiStock([{ '漢字': '怜' }]);

  assert.equal(added.length, 1);
  assert.equal(sandbox.liked[0].stockAccess, 'premium-required');
  assert.equal(sandbox.liked[0].sessionReading, 'FREE');
  assert.equal(sandbox.stockAccess.isKanjiStockItemUsable(sandbox.liked[0]), false);
  assert.deepEqual(sandbox.rankingLikes, []);
  assert.equal(sandbox.saveCount, 1);
});

test('premium permanently promotes own locked stock without mutating partner-owned stock', () => {
  const sandbox = createSandbox();
  sandbox.stockAccess.addDirectNameKanjiStock([{ '漢字': '怜' }]);
  sandbox.liked.push({
    '漢字': '怜',
    sessionReading: 'FREE',
    stockAccess: 'premium-required',
    fromPartner: true
  });

  sandbox.premiumActive = true;
  assert.equal(sandbox.stockAccess.promotePremiumRequiredKanjiStockItems({ reason: 'partner' }), 1);
  assert.equal(sandbox.liked[0].stockAccess, 'unlocked');
  assert.equal(sandbox.liked[1].stockAccess, 'premium-required');

  sandbox.premiumActive = false;
  assert.equal(sandbox.stockAccess.isKanjiStockItemUsable(sandbox.liked[0]), true);
  assert.equal(sandbox.stockAccess.isKanjiStockItemUsable(sandbox.liked[1]), false);
});

test('legacy stock stays unlocked and a later free direct save never downgrades it', () => {
  const sandbox = createSandbox();
  sandbox.liked.push({ '漢字': '怜', sessionReading: 'FREE', fromPartner: false });

  assert.equal(sandbox.stockAccess.isKanjiStockPermanentlyUnlocked(sandbox.liked[0]), true);
  sandbox.stockAccess.addDirectNameKanjiStock([{ '漢字': '怜' }]);
  assert.notEqual(sandbox.liked[0].stockAccess, 'premium-required');
  assert.equal(sandbox.stockAccess.isKanjiStockItemUsable(sandbox.liked[0]), true);
});

test('an unlocked reading-bound stock prevents a locked FREE duplicate', () => {
  const sandbox = createSandbox();
  sandbox.liked.push({
    '漢字': '怜',
    sessionReading: 'れい',
    slot: 0,
    fromPartner: false,
    stockAccess: 'unlocked'
  });

  const added = sandbox.stockAccess.addDirectNameKanjiStock([{ '漢字': '怜' }]);
  assert.equal(added.length, 0);
  assert.equal(sandbox.liked.length, 1);
  assert.equal(sandbox.liked[0].stockAccess, 'unlocked');
});

test('Firestore projection preserves locked and permanently unlocked stock access', () => {
  const sandbox = {};
  vm.createContext(sandbox);
  vm.runInContext(`
    globalThis.payload = {
      _normalizeString(value) { return String(value || '').trim(); },
      _resolveLikedKanji(item) { return String(item?.['漢字'] || item?.kanji || '').trim(); },
      ${extractObjectMethod(firebasePath, 'MeimayFirestorePayload', 'minifyLikedItem')}
    };
  `, sandbox);

  const locked = sandbox.payload.minifyLikedItem({
    '漢字': '怜',
    sessionReading: 'FREE',
    stockAccess: 'premium-required',
    directInput: true,
    statsTracked: false
  });
  const legacy = sandbox.payload.minifyLikedItem({ '漢字': '怜', sessionReading: 'FREE' });

  assert.equal(locked.stockAccess, 'premium-required');
  assert.equal(locked.directInput, true);
  assert.equal(locked.statsTracked, false);
  assert.equal(legacy.stockAccess, 'unlocked');
});
