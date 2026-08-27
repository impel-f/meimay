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

const root = path.join(__dirname, '..');
const originPath = path.join(root, 'public', 'js', '08-origin.js');

function createSandbox() {
  const values = new Map();
  const legacyCache = {};
  const sandbox = {
    membership: { active: false, isTrial: false },
    localStorage: {
      getItem(key) {
        return values.has(key) ? values.get(key) : null;
      },
      setItem(key, value) {
        values.set(key, String(value));
      },
      removeItem(key) {
        values.delete(key);
      }
    },
    PremiumManager: {
      getMembershipState() {
        return sandbox.membership;
      }
    },
    StorageBox: {
      getKanjiAiCache(kanji) {
        return legacyCache[kanji] || null;
      }
    },
    legacyCache
  };
  vm.createContext(sandbox);
  vm.runInContext(`
    const DAILY_KANJI_DETAIL_LIMIT = 1;
    const KANJI_DETAIL_FREE_UNLOCKS_KEY = 'meimay_kanji_detail_free_unlocks_v1';
    function isPremiumAccessActive() { return membership.active; }
    function isCommonKanjiEntry(item) { return item?.['常用漢字'] === true; }
    ${extractFunction(originPath, '_getDailyKanjiDetailKey')}
    ${extractFunction(originPath, 'getDailyKanjiDetailUseCount')}
    ${extractFunction(originPath, 'canUseDailyKanjiDetailAI')}
    ${extractFunction(originPath, 'consumeDailyKanjiDetailUse')}
    ${extractFunction(originPath, 'refundDailyKanjiDetailUse')}
    ${extractFunction(originPath, 'getFreeKanjiDetailUnlocks')}
    ${extractFunction(originPath, 'saveFreeKanjiDetailUnlocks')}
    ${extractFunction(originPath, 'isKanjiDetailUnlockedForFree')}
    ${extractFunction(originPath, 'getKanjiDetailMembershipState')}
    ${extractFunction(originPath, 'isKanjiDetailFreeEligible')}
    ${extractFunction(originPath, 'getKanjiDetailAccessModel')}
    ${extractFunction(originPath, 'unlockKanjiDetailForFree')}
    globalThis.detailAccess = {
      getKanjiDetailAccessModel,
      unlockKanjiDetailForFree,
      getDailyKanjiDetailUseCount
    };
  `, sandbox);
  return sandbox;
}

test('free users permanently unlock one common-kanji detail per day', () => {
  const sandbox = createSandbox();
  const sea = { '漢字': '海', '常用漢字': true };
  const sky = { '漢字': '空', '常用漢字': true };

  assert.equal(sandbox.detailAccess.getKanjiDetailAccessModel('海', sea).canUnlockToday, true);
  assert.equal(sandbox.detailAccess.unlockKanjiDetailForFree('海', sea).ok, true);
  assert.equal(sandbox.detailAccess.getDailyKanjiDetailUseCount(), 1);
  assert.equal(sandbox.detailAccess.getKanjiDetailAccessModel('海', sea).autoDisplay, true);
  assert.equal(sandbox.detailAccess.unlockKanjiDetailForFree('海', sea).alreadyUnlocked, true);
  assert.equal(sandbox.detailAccess.getDailyKanjiDetailUseCount(), 1);
  assert.equal(sandbox.detailAccess.getKanjiDetailAccessModel('空', sky).canUnlockToday, false);
});

test('free users cannot spend the daily detail allowance on non-common kanji', () => {
  const sandbox = createSandbox();
  const jinmeiyo = { '漢字': '晟', '常用漢字': false };

  assert.equal(sandbox.detailAccess.getKanjiDetailAccessModel('晟', jinmeiyo).premiumRequired, true);
  assert.equal(sandbox.detailAccess.unlockKanjiDetailForFree('晟', jinmeiyo).reason, 'premium-required');
  assert.equal(sandbox.detailAccess.getDailyKanjiDetailUseCount(), 0);
});

test('trial details auto-display only while the trial remains active', () => {
  const sandbox = createSandbox();
  const jinmeiyo = { '漢字': '晟', '常用漢字': false };
  sandbox.membership = { active: true, isTrial: true };

  assert.equal(sandbox.detailAccess.getKanjiDetailAccessModel('晟', jinmeiyo).source, 'trial');
  assert.equal(sandbox.detailAccess.getKanjiDetailAccessModel('晟', jinmeiyo).autoDisplay, true);

  sandbox.membership = { active: false, isTrial: false };
  assert.equal(sandbox.detailAccess.getKanjiDetailAccessModel('晟', jinmeiyo).premiumRequired, true);
});

test('legacy AI detail users keep access to the reviewed fixed detail', () => {
  const sandbox = createSandbox();
  const sea = { '漢字': '海', '常用漢字': true };
  sandbox.legacyCache['海'] = {
    text: 'legacy detail',
    savedAt: '2026-01-01T00:00:00.000Z'
  };

  assert.equal(sandbox.detailAccess.getKanjiDetailAccessModel('海', sea).source, 'free-unlocked');
  assert.equal(sandbox.detailAccess.getDailyKanjiDetailUseCount(), 0);
});

test('detail UI auto-loads premium content and the comparison table matches access rules', () => {
  const renderSource = fs.readFileSync(path.join(root, 'public', 'js', '05-ui-render.js'), 'utf8');
  const premiumSource = fs.readFileSync(path.join(root, 'public', 'js', '14-admob.js'), 'utf8');
  assert.match(renderSource, /if \(detailAccess\.autoDisplay\)/);
  assert.match(renderSource, /意味・成り立ちを詳しく見る/);
  assert.match(renderSource, /無料で見られる1字分は利用済みです。明日また使えます。/);
  assert.match(premiumSource, /state\.active && !state\.isTrial/);
  assert.match(premiumSource, /詳しい漢字情報', free: '1日1字', premium: '自動表示'/);
});

test('kanji detail action rows use the same full width', () => {
  const indexSource = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8');

  assert.match(indexSource, /id="modal-stock-btns" class="flex gap-2 w-full mt-3"/);
  assert.match(indexSource, /id="modal-ai-button-slot" class="w-full mt-3"/);
  assert.doesNotMatch(indexSource, /id="modal-(?:stock-btns|ai-button-slot)"[^>]*max-w-/);
});
