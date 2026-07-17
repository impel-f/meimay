const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const acorn = require('acorn');

function extractFunction(source, functionName) {
  const ast = acorn.parse(source, { ecmaVersion: 'latest', sourceType: 'script' });
  const declaration = ast.body.find((node) =>
    node.type === 'FunctionDeclaration' && node.id.name === functionName
  );
  assert.ok(declaration, `${functionName} must remain discoverable`);
  return source.slice(declaration.start, declaration.end);
}

const admobPath = path.join(__dirname, '..', 'public', 'js', '14-admob.js');
const source = fs.readFileSync(admobPath, 'utf8');
const sandbox = { setTimeout, clearTimeout };
vm.createContext(sandbox);
vm.runInContext(`
  const calls = { initialize: 0, show: 0, hide: 0, resume: 0, layout: 0 };
  const plugin = {
    initialize: async () => { calls.initialize += 1; },
    showBanner: async () => { calls.show += 1; },
    hideBanner: async () => { calls.hide += 1; },
    resumeBanner: async () => { calls.resume += 1; }
  };
  let pluginEnabled = true;
  let htmlSurfaceVisible = false;
  let htmlContainerEnabled = false;
  const htmlContainer = { style: {}, innerHTML: '', firstElementChild: {} };
  const PremiumManager = { isPremium: () => false };
  const AdMobConfig = { android: { bannerId: 'test' }, ios: { bannerId: 'test' } };
  const AdMobPrivacyConfig = { nonPersonalizedAds: true, publisherFirstPartyIdEnabled: false, maxAdContentRating: 'General' };
  const NativeAdMobAutoStartConfig = { androidShowBannerEnabled: true };
  const NATIVE_AD_BANNER_MIN_HEIGHT = 50;
  const NATIVE_AD_BANNER_RETRY_BASE_MS = 1;
  const NATIVE_AD_BANNER_RETRY_MAX_ATTEMPTS = 3;
  let adBannerDesiredVisible = true;
  let adBannerVisible = false;
  let adBannerMode = null;
  let adBannerSuppressedByOverlay = false;
  let nativeAdMobInitializePromise = null;
  let nativeAdMobShowPromise = null;
  let nativeAdMobBannerRequested = false;
  let nativeAdMobBannerPaused = false;
  let nativeAdMobBannerHeight = NATIVE_AD_BANNER_MIN_HEIGHT;
  let nativeAdMobRetryTimer = null;
  let nativeAdMobRetryAttempt = 0;
  let nativeAdMobBannerLoaded = false;
  let nativeAdMobBannerFailed = false;
  const document = { getElementById: () => htmlContainerEnabled ? htmlContainer : null };
  const console = { log() {}, warn() {} };
  function getAdMobPlugin() { return pluginEnabled ? plugin : null; }
  function installAdKeyboardLayoutControl() {}
  function ensureAdOverlayObserver() {}
  function getAdBannerFooterMargin() { return 0; }
  function showNativeAdMobFallbackBanner() {}
  function showNativeAdMobBackdrop() {}
  function setupNativeAdMobBannerListeners() {}
  function clearHtmlAdBanner() {}
  function isAdMobTestAdMode() { return false; }
  function getAdMobBannerId() { return 'test'; }
  function getPlatform() { return 'android'; }
  function isNativeAdMobAutoStartDisabled() { return false; }
  function isHtmlAdBannerSurfaceVisible() { return htmlSurfaceVisible; }
  function measureAdBannerHeight() { return 52; }
  function updateAdLayoutSpacing() { calls.layout += 1; }
  function getAdMobPremiumHoldReason() { return ''; }
  function showHtmlAdBannerForHoldReason() { return false; }
  function scheduleDeferredAdMobInit() {}
  function hideAdBanner() {}
  function setHtmlAdBannerSuppressed() {}
  function showAdBanner() { calls.show += 1; }

  ${extractFunction(source, 'setNativeAdMobBannerSuppressed')}
  ${extractFunction(source, 'restoreAdBannerForFreeUser')}
  ${extractFunction(source, 'clearNativeAdMobRetry')}
  ${extractFunction(source, 'scheduleNativeAdMobRetry')}
  ${extractFunction(source, 'initNativeAdMob')}

  globalThis.adBannerTest = {
    calls,
    initNativeAdMob,
    restoreAdBannerForFreeUser,
    scheduleNativeAdMobRetry,
    setNativeAdMobBannerSuppressed,
    setState(next) {
      if (Object.prototype.hasOwnProperty.call(next, 'requested')) nativeAdMobBannerRequested = next.requested;
      if (Object.prototype.hasOwnProperty.call(next, 'loaded')) nativeAdMobBannerLoaded = next.loaded;
      if (Object.prototype.hasOwnProperty.call(next, 'paused')) nativeAdMobBannerPaused = next.paused;
      if (Object.prototype.hasOwnProperty.call(next, 'desired')) adBannerDesiredVisible = next.desired;
      if (Object.prototype.hasOwnProperty.call(next, 'mode')) adBannerMode = next.mode;
      if (Object.prototype.hasOwnProperty.call(next, 'plugin')) pluginEnabled = next.plugin;
      if (Object.prototype.hasOwnProperty.call(next, 'htmlVisible')) htmlSurfaceVisible = next.htmlVisible;
      if (Object.prototype.hasOwnProperty.call(next, 'htmlContainer')) htmlContainerEnabled = next.htmlContainer;
    }
  };
`, sandbox);

test('fixed native banner height matches the 50dp BANNER size', () => {
  assert.match(source, /const NATIVE_AD_BANNER_MIN_HEIGHT = 50;/);
});

test('restoring an already loaded banner does not reload or resume it', () => {
  const api = sandbox.adBannerTest;
  api.setState({ requested: true, loaded: true, paused: false, desired: true });
  api.restoreAdBannerForFreeUser('screen:first');
  api.restoreAdBannerForFreeUser('screen:second');

  assert.equal(api.calls.show, 0);
  assert.equal(api.calls.resume, 0);
  assert.equal(api.calls.layout, 2);
});

test('production native fallback is an opaque premium promotion instead of an empty slot', () => {
  const fallbackSource = extractFunction(source, 'showNativeAdMobFallbackBanner');
  const rendererSource = extractFunction(source, 'renderAdMobFallbackSurface');
  const backdropSource = extractFunction(source, 'showNativeAdMobBackdrop');

  assert.doesNotMatch(fallbackSource, /!isAdMobTestAdMode\(\)[\s\S]*clearHtmlAdBanner/);
  assert.match(fallbackSource, /renderAdMobFallbackSurface/);
  assert.match(rendererSource, /プレミアムなら広告なし/);
  assert.match(rendererSource, /backgroundColor = '#f5f0e8'/);
  assert.match(backdropSource, /backgroundColor = '#f5f0e8'/);
});
test('restoring the web fallback keeps the existing banner DOM mounted', () => {
  const api = sandbox.adBannerTest;
  const showCallsBefore = api.calls.show;
  api.setState({
    requested: false,
    paused: false,
    desired: true,
    mode: 'web',
    plugin: false,
    htmlVisible: true,
    htmlContainer: true
  });
  api.restoreAdBannerForFreeUser('screen:web');

  assert.equal(api.calls.show, showCallsBefore);
});

test('native visibility commands run only when the visibility state changes', () => {
  const api = sandbox.adBannerTest;
  api.setState({ requested: true, paused: false, plugin: true });
  api.setNativeAdMobBannerSuppressed(true, 'premium');
  api.setNativeAdMobBannerSuppressed(true, 'premium-again');
  api.setNativeAdMobBannerSuppressed(false, 'free');
  api.setNativeAdMobBannerSuppressed(false, 'free-again');

  assert.equal(api.calls.hide, 1);
  assert.equal(api.calls.resume, 1);
});

test('concurrent and repeated initialization requests load one native banner', async () => {
  const api = sandbox.adBannerTest;
  api.setState({ requested: false, paused: false, desired: true, mode: null, plugin: true, htmlContainer: false });
  await Promise.all([
    api.initNativeAdMob('android'),
    api.initNativeAdMob('android')
  ]);
  await api.initNativeAdMob('android');

  assert.equal(api.calls.initialize, 1);
  assert.equal(api.calls.show, 1);
});

test('native load failure recovery is coalesced into one retry', async () => {
  const api = sandbox.adBannerTest;
  const showCallsBefore = api.calls.show;
  api.setState({ requested: false, paused: false, desired: true, plugin: true });
  api.scheduleNativeAdMobRetry('first-failure');
  api.scheduleNativeAdMobRetry('duplicate-failure');
  await new Promise((resolve) => setTimeout(resolve, 20));

  assert.equal(api.calls.show, showCallsBefore + 1);
});
