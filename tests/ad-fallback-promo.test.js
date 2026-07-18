const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const source = fs.readFileSync(
  path.join(__dirname, '..', 'public', 'js', '14-admob.js'),
  'utf8'
);

test('native ad failure keeps the stable dock and shows a premium promo for free users', () => {
  const start = source.indexOf('function showNativeAdMobFallbackBanner');
  const end = source.indexOf('function setupNativeAdMobBannerListeners', start);
  assert.ok(start >= 0 && end > start, 'native fallback function must remain discoverable');

  const fallbackSource = source.slice(start, end);
  assert.match(fallbackSource, /PremiumManager\.isPremium\(\)/);
  assert.doesNotMatch(fallbackSource, /if \(!isAdMobTestAdMode\(\)\)/);
  assert.match(fallbackSource, /プレミアムなら広告なし/);
  assert.match(fallbackSource, /プランを見る/);
  assert.match(fallbackSource, /updateAdLayoutSpacing\(/);
});
