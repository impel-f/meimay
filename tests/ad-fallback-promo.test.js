const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const source = fs.readFileSync(
  path.join(__dirname, '..', 'public', 'js', '14-admob.js'),
  'utf8'
);
const styles = fs.readFileSync(
  path.join(__dirname, '..', 'public', 'css', 'main.css'),
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

test('ad dock and footer stay opaque while the native banner loads', () => {
  assert.match(source, /function showNativeAdMobBackdrop/);
  assert.match(source, /container\.style\.backgroundColor = '#f5f0e8'/);
  assert.match(styles, /#admob-banner\s*\{[^}]*background:\s*#f5f0e8/s);
  assert.match(styles, /body\.has-ad-banner #universal-footer\s*\{[^}]*background:\s*#fdfaf5 !important/s);
});

test('native, fallback, and premium promo banners share the standard 50px dock height', () => {
  assert.match(source, /const WEB_AD_BANNER_MIN_HEIGHT = 50;/);
  assert.match(source, /const NATIVE_AD_BANNER_MIN_HEIGHT = 50;/);
  assert.match(source, /container\.style\.height = `\$\{NATIVE_AD_BANNER_MIN_HEIGHT\}px`/);
  assert.match(source, /container\.style\.height = `\$\{WEB_AD_BANNER_MIN_HEIGHT\}px`/);
  assert.match(styles, /#admob-banner\s*\{[^}]*height:\s*50px;[^}]*min-height:\s*50px;/s);
  assert.match(styles, /#admob-banner \.meimay-ad-banner-row\s*\{[^}]*height:\s*50px;[^}]*min-height:\s*50px;/s);
  assert.doesNotMatch(styles, /var\(--ad-footer-offset,\s*56px\)/);
});

test('native ad failures keep the fallback visible while retrying with backoff', () => {
  assert.match(source, /const NATIVE_AD_BANNER_RETRY_DELAYS = \[30000, 60000, 120000, 300000\];/);
  assert.match(source, /function scheduleNativeAdMobBannerRetry/);
  assert.match(source, /scheduleNativeAdMobBannerRetry\(reason \|\| 'native-fallback'\)/);
  assert.match(source, /function startNativeAdMobBannerLoadTimer/);
  assert.match(source, /const keepFallbackVisible = adBannerMode === 'native-fallback'/);
  assert.match(source, /if \(!keepFallbackVisible\)/);
});

test('slow native loads show the promo quickly without cancelling the failure watchdog', () => {
  const promoDelay = Number(source.match(/const NATIVE_AD_BANNER_PROMO_DELAY_MS = (\d+);/)?.[1]);
  const loadTimeout = Number(source.match(/const NATIVE_AD_BANNER_LOAD_TIMEOUT_MS = (\d+);/)?.[1]);
  const initStart = source.indexOf('async function initNativeAdMob');
  const initEnd = source.indexOf('function showAdBanner', initStart);
  const initSource = source.slice(initStart, initEnd);
  assert.equal(promoDelay, 700);
  assert.equal(loadTimeout, 8000);
  assert.ok(promoDelay < loadTimeout);
  assert.match(source, /function startNativeAdMobBannerPromoTimer/);
  assert.match(source, /showNativeAdMobFallbackBanner\('', null, \{ loading: true \}\)/);
  assert.match(source, /if \(isLoadingPromo\) return;/);
  assert.match(source, /startNativeAdMobBannerPromoTimer\(\);\s*startNativeAdMobBannerLoadTimer\(\);/);
  assert.match(source, /if \(nativeAdMobBannerPromoTimer\) \{\s*clearTimeout\(nativeAdMobBannerPromoTimer\);/);
  assert.ok(
    initSource.indexOf('startNativeAdMobBannerPromoTimer();') < initSource.indexOf('await nativeAdMobInitializePromise;'),
    'promo timer must include slow SDK initialization'
  );
  assert.match(initSource, /await nativeAdMobInitializePromise;\s*[\s\S]*?if \(nativeAdMobBannerFailed\) return;\s*await AdMob\.showBanner/);
});

test('premium activation invalidates in-flight native banners and late load events', () => {
  const initStart = source.indexOf('async function initNativeAdMob');
  const initEnd = source.indexOf('function showAdBanner', initStart);
  const initSource = source.slice(initStart, initEnd);
  const listenerStart = source.indexOf('function setupNativeAdMobBannerListeners');
  const listenerEnd = source.indexOf('function initAdMob', listenerStart);
  const listenerSource = source.slice(listenerStart, listenerEnd);
  const hideStart = source.indexOf('function hideAdBanner');
  const hideEnd = source.indexOf('window.MeimayAdMobDebug', hideStart);
  const hideSource = source.slice(hideStart, hideEnd);

  assert.match(source, /let nativeAdMobBannerLifecycleEpoch = 0;/);
  assert.match(hideSource, /nativeAdMobBannerLifecycleEpoch \+= 1;/);
  assert.match(initSource, /const requestEpoch = nativeAdMobBannerLifecycleEpoch;/);
  assert.match(
    initSource,
    /await nativeAdMobInitializePromise;\s*if \(requestEpoch !== nativeAdMobBannerLifecycleEpoch \|\| PremiumManager\.isPremium\(\)\) return;/
  );
  assert.match(initSource, /await AdMob\.showBanner\([\s\S]*?requestEpoch !== nativeAdMobBannerLifecycleEpoch \|\| PremiumManager\.isPremium\(\)[\s\S]*?AdMob\.hideBanner\(\)/);
  assert.match(source, /let nativeAdMobBannerActiveRequestEpoch = -1;/);
  assert.match(initSource, /nativeAdMobBannerActiveRequestEpoch = requestEpoch;/);
  assert.match(listenerSource, /addBannerListener\('bannerAdLoaded', \(\) => \{[\s\S]*?PremiumManager\.isPremium\(\)[\s\S]*?nativeAdMobBannerActiveRequestEpoch !== nativeAdMobBannerLifecycleEpoch[\s\S]*?hideAdBanner\(\);/);
  assert.match(listenerSource, /addBannerListener\('bannerAdSizeChanged', \(size\) => \{[\s\S]*?nativeAdMobBannerActiveRequestEpoch !== nativeAdMobBannerLifecycleEpoch[\s\S]*?hideAdBanner\(\);/);
});

test('an elapsed retry is retained while another native request is still in flight', () => {
  const retryStart = source.indexOf('function scheduleNativeAdMobBannerRetry');
  const retryEnd = source.indexOf('function startNativeAdMobBannerPromoTimer', retryStart);
  const retrySource = source.slice(retryStart, retryEnd);
  const initStart = source.indexOf('async function initNativeAdMob');
  const initEnd = source.indexOf('function showAdBanner', initStart);
  const initSource = source.slice(initStart, initEnd);

  assert.match(source, /let nativeAdMobBannerPendingRequest = null;/);
  assert.match(retrySource, /if \(nativeAdMobBannerRequestInFlight\) \{\s*nativeAdMobBannerPendingRequest = \{[\s\S]*?reason: reason \|\| 'native-retry'/);
  assert.match(initSource, /if \(nativeAdMobBannerRequestInFlight\) \{[\s\S]*?reason: 'request-while-in-flight'/);
  assert.match(initSource, /const pendingRequest = nativeAdMobBannerPendingRequest;\s*nativeAdMobBannerPendingRequest = null;/);
  assert.match(initSource, /pendingRequest[\s\S]*?pendingRequest\.epoch === nativeAdMobBannerLifecycleEpoch[\s\S]*?!nativeAdMobBannerLoaded[\s\S]*?!PremiumManager\.isPremium\(\)[\s\S]*?initNativeAdMob\(pendingRequest\.platform \|\| getPlatform\(\)\)/);
});
