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

const admobPath = path.join(__dirname, '..', 'public', 'js', '14-admob.js');
const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(`
  function isLifetimePremiumProduct(productId) {
    return String(productId || '').includes('lifetime');
  }
  function formatPremiumMembershipDate(value) {
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
  }
  ${extractFunction(admobPath, 'normalizePremiumDate')}
  ${extractFunction(admobPath, 'buildPremiumMembershipState')}
  globalThis.premiumState = { normalizePremiumDate, buildPremiumMembershipState };
`, sandbox);

test('premium dates accept Firestore timestamp objects', () => {
  const date = sandbox.premiumState.normalizePremiumDate({ seconds: 2_000_000_000, nanoseconds: 500_000_000 });
  assert.equal(date.toISOString(), '2033-05-18T03:33:20.500Z');
});

test('non-lifetime premium cannot remain active without an expiry', () => {
  const state = sandbox.premiumState.buildPremiumMembershipState({
    isPremium: true,
    subscriptionStatus: 'active',
    premiumProductId: 'meimay_monthly'
  }, 'self');

  assert.equal(state.active, false);
  assert.equal(state.missingRequiredExpiry, true);
});

test('future subscriptions and lifetime purchases remain active', () => {
  const subscription = sandbox.premiumState.buildPremiumMembershipState({
    isPremium: true,
    subscriptionStatus: 'active',
    premiumProductId: 'meimay_monthly',
    premiumExpiresAt: '2099-01-01T00:00:00.000Z'
  }, 'self');
  const lifetime = sandbox.premiumState.buildPremiumMembershipState({
    isPremium: true,
    subscriptionStatus: 'active',
    premiumProductId: 'meimay_lifetime'
  }, 'self');

  assert.equal(subscription.active, true);
  assert.equal(lifetime.active, true);
});

test('a partner free trial is not shared as a partner benefit', () => {
  const state = sandbox.premiumState.buildPremiumMembershipState({
    isPremium: true,
    premiumSource: 'trial',
    trialStatus: 'active',
    trialEndsAt: '2099-01-01T00:00:00.000Z'
  }, 'partner');

  assert.equal(state.isTrial, true);
  assert.equal(state.active, false);
});
