/* ============================================================
   MODULE 14: ADMOB & PREMIUM (V19.0)
   広告管理・有料プラン制御
   ============================================================ */

const AdMobConfig = {
    android: {
        appId: 'ca-app-pub-9172754377890289~3397321817',
        bannerId: 'ca-app-pub-9172754377890289/2546450164'
    },
    ios: {
        appId: 'ca-app-pub-9172754377890289~1972559504',
        bannerId: 'ca-app-pub-9172754377890289/4985735650'
    }
};

const PremiumManager = {
    KEY: 'meimay_premium',
    DEV_FALLBACK_KEY: 'meimay_allow_local_premium',
    TOKEN_KEY: 'meimay_app_account_token',
    _remotePremium: null,
    _remotePremiumSource: null,
    _remoteStatus: null,
    _remoteAppStoreExpiresAt: null,
    _remoteExpiresAt: null,
    _remoteProductId: null,
    _remoteLastNotificationType: null,
    _remoteTrialStatus: null,
    _remoteTrialStartedAt: null,
    _remoteTrialEndsAt: null,
    _remoteTrialConsumedAt: null,
    _remoteTrialConsumedByRoom: false,
    _userDocUnsub: null,
    _trialStartInProgress: false,

    getLocalPremiumState: function () {
        try {
            const data = localStorage.getItem(this.KEY);
            if (!data) return false;
            const parsed = JSON.parse(data);
            return parsed && parsed.active === true;
        } catch (e) {
            return false;
        }
    },

    getPublicPremiumSnapshot: function () {
        const remoteStatus = String(this._remoteStatus || '').trim().toLowerCase();
        const remoteTrialStatus = String(this._remoteTrialStatus || '').trim().toLowerCase();
        const remotePremiumSource = String(this._remotePremiumSource || '').trim().toLowerCase();
        const remoteExpiresAt = normalizePremiumDate(this._remoteExpiresAt || this._remoteTrialEndsAt);
        const remoteExpired = !!remoteExpiresAt && remoteExpiresAt.getTime() <= Date.now();
        let isPremium = isLocalPremiumFallbackAllowed() ? this.getLocalPremiumState() : false;

        if (this._remotePremium === true) {
            isPremium = !remoteExpired;
        } else if (this._remotePremium === false) {
            isPremium = false;
        } else if (remoteStatus === 'active' || remoteStatus === 'trialing' || remoteTrialStatus === 'active') {
            isPremium = !remoteExpired;
        } else if (remoteExpired || remoteStatus === 'expired' || remoteStatus === 'refunded' || remoteStatus === 'revoked' || remoteStatus === 'billing_retry') {
            isPremium = false;
        }

        return {
            isPremium,
            premiumSource: remotePremiumSource || null,
            subscriptionStatus: remoteStatus || null,
            premiumStatus: remoteStatus || null,
            appStoreExpiresAt: this._remoteAppStoreExpiresAt || null,
            premiumExpiresAt: this._remoteExpiresAt || this._remoteTrialEndsAt || null,
            appStoreProductId: this._remoteProductId || null,
            premiumProductId: this._remoteProductId || null,
            appStoreLastNotificationType: this._remoteLastNotificationType || null,
            latestNotificationType: this._remoteLastNotificationType || null,
            trialStatus: remoteTrialStatus || null,
            trialStartedAt: this._remoteTrialStartedAt || null,
            trialEndsAt: this._remoteTrialEndsAt || null,
            trialConsumedAt: this._remoteTrialConsumedAt || null,
            trialConsumedByRoom: this._remoteTrialConsumedByRoom === true
        };
    },

    getAppAccountToken: function () {
        try {
            let token = localStorage.getItem(this.TOKEN_KEY);
            if (token) return token;

            if (window.crypto && typeof window.crypto.randomUUID === 'function') {
                token = window.crypto.randomUUID();
            } else {
                token = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
                    const r = Math.random() * 16 | 0;
                    const v = c === 'x' ? r : (r & 0x3 | 0x8);
                    return v.toString(16);
                });
            }

            localStorage.setItem(this.TOKEN_KEY, token);
            return token;
        } catch (e) {
            return null;
        }
    },

    isPremium: function () {
        if (typeof this.getMembershipState === 'function') {
            const state = this.getMembershipState();
            return !!(state && state.active);
        }
        return this.getLocalPremiumState();
    },

    activate: function () {
        localStorage.setItem(this.KEY, JSON.stringify({
            active: true,
            activatedAt: new Date().toISOString()
        }));
        hideAdBanner();
        updatePremiumUI();
        if (typeof MeimayShare !== 'undefined' && MeimayShare && typeof MeimayShare.syncPremiumState === 'function') {
            const publicPremiumState = typeof this.getPublicPremiumSnapshot === 'function'
                ? this.getPublicPremiumSnapshot()
                : null;
            MeimayShare.syncPremiumState(publicPremiumState);
        }
    },

    deactivate: function () {
        localStorage.removeItem(this.KEY);
        showAdBanner();
        updatePremiumUI();
        if (typeof MeimayShare !== 'undefined' && MeimayShare && typeof MeimayShare.syncPremiumState === 'function') {
            const publicPremiumState = typeof this.getPublicPremiumSnapshot === 'function'
                ? this.getPublicPremiumSnapshot()
                : null;
            MeimayShare.syncPremiumState(publicPremiumState);
        }
    },

    toggle: function () {
        if (this.isPremium()) {
            this.deactivate();
        } else {
            this.activate();
        }
    },

    bindToUserDoc: async function (user) {
        if (!user || typeof firebaseDb === 'undefined' || !firebaseDb) return;

        const token = this.getAppAccountToken();
        if (!token) return;

        const platform = getPlatform();
        const docRef = firebaseDb.collection('users').doc(user.uid);

        try {
            await docRef.set({
                appAccountToken: token,
                premiumPlatform: platform,
                appStoreBundleId: 'com.impelf.meimay',
                premiumLinkedAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
        } catch (e) {
            console.warn('PREMIUM: Failed to link appAccountToken', e);
        }

        if (this._userDocUnsub) {
            this._userDocUnsub();
            this._userDocUnsub = null;
        }

        this._userDocUnsub = docRef.onSnapshot((doc) => {
            const data = doc.exists ? (doc.data() || {}) : {};
            this._remotePremium = typeof data.isPremium === 'boolean' ? data.isPremium : null;
            this._remotePremiumSource = typeof data.premiumSource === 'string'
                ? data.premiumSource.trim().toLowerCase()
                : null;
            this._remoteStatus = typeof data.subscriptionStatus === 'string'
                ? data.subscriptionStatus.trim().toLowerCase()
                : null;
            this._remoteAppStoreExpiresAt = data.appStoreExpiresAt || null;
            this._remoteExpiresAt = data.appStoreExpiresAt || data.premiumExpiresAt || data.trialEndsAt || null;
            this._remoteProductId = typeof data.appStoreProductId === 'string'
                ? data.appStoreProductId
                : (typeof data.premiumProductId === 'string' ? data.premiumProductId : null);
            this._remoteLastNotificationType = typeof data.appStoreLastNotificationType === 'string'
                ? data.appStoreLastNotificationType
                : (typeof data.latestNotificationType === 'string' ? data.latestNotificationType : null);
            this._remoteTrialStatus = typeof data.trialStatus === 'string'
                ? data.trialStatus.trim().toLowerCase()
                : null;
            this._remoteTrialStartedAt = data.trialStartedAt || null;
            this._remoteTrialEndsAt = data.trialEndsAt || null;
            this._remoteTrialConsumedAt = data.trialConsumedAt || null;
            this._remoteTrialConsumedByRoom = data.trialConsumedByRoom === true;

            if (this.isPremium()) {
                hideAdBanner();
            } else {
                showAdBanner();
            }
            updatePremiumUI();

            if (typeof MeimayShare !== 'undefined' && MeimayShare && typeof MeimayShare.syncPremiumState === 'function') {
                const publicPremiumState = typeof this.getPublicPremiumSnapshot === 'function'
                    ? this.getPublicPremiumSnapshot()
                    : null;
                if (publicPremiumState) {
                    MeimayShare.syncPremiumState(publicPremiumState);
                }
            }
        }, (error) => {
            console.warn('PREMIUM: Failed to subscribe user doc', error);
        });
    }
};

function normalizePremiumDate(value) {
    if (!value) return null;

    if (typeof value.toDate === 'function') {
        const date = value.toDate();
        return Number.isNaN(date.getTime()) ? null : date;
    }

    if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? null : value;
    }

    if (typeof value === 'number') {
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? null : date;
    }

    if (typeof value === 'string') {
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? null : date;
    }

    return null;
}

function formatPremiumDateLabel(date) {
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}

function escapePremiumHtml(value) {
    return String(value == null ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function isLocalPremiumFallbackAllowed() {
    try {
        const locationInfo = window.location || {};
        const protocol = String(locationInfo.protocol || '').toLowerCase();
        const hostname = String(locationInfo.hostname || '').toLowerCase();
        const isLocalHost = protocol === 'file:'
            || hostname === 'localhost'
            || hostname === '127.0.0.1'
            || hostname === '::1';
        if (!isLocalHost) return false;

        const params = new URLSearchParams(String(locationInfo.search || ''));
        return params.get('localPremium') === '1'
            || localStorage.getItem(PremiumManager.DEV_FALLBACK_KEY) === 'true';
    } catch (e) {
        return false;
    }
}

function buildPremiumState(source, activeHint, status, expiresAt) {
    const normalizedStatus = String(status || '').trim().toLowerCase();
    const expiresDate = normalizePremiumDate(expiresAt);
    const expiredByDate = !!expiresDate && expiresDate.getTime() <= Date.now();
    const expiredStatuses = new Set(['expired', 'refunded', 'revoked', 'billing_retry']);
    const isExpired = expiredByDate || expiredStatuses.has(normalizedStatus);
    const isActive = !isExpired && (activeHint === true || normalizedStatus === 'active');
    const baseTitle = source === 'partner' ? '👑プレミアムモード（パートナー）' : '👑プレミアムモード';

    if (isActive) {
        return {
            source,
            active: true,
            expired: false,
            title: baseTitle,
            subtitle: expiresDate ? `(${formatPremiumDateLabel(expiresDate)}まで有効)` : '',
            detail: source === 'partner'
                ? '連携中はパートナーのプレミアムを利用できます。'
                : 'ご自身のプレミアム会員です。'
        };
    }

    if (isExpired) {
        return {
            source,
            active: false,
            expired: true,
            title: '👑プレミアムモード：期限切れ',
            subtitle: '',
            detail: expiresDate
                ? `有効期限は${formatPremiumDateLabel(expiresDate)}まででした。`
                : 'プレミアム会員の有効期限は切れています。'
        };
    }

    return {
        source,
        active: false,
        expired: false,
        title: '👑プレミアムモード：未登録',
        subtitle: '',
        detail: 'まだプレミアム購入情報がありません。'
    };
}

function getPlatform() {
    const ua = navigator.userAgent || '';
    if (/android/i.test(ua)) return 'android';
    if (/iPad|iPhone|iPod/.test(ua)) return 'ios';
    return 'web';
}

function getBottomFooterHeight() {
    const candidates = [
        document.getElementById('bottom-nav'),
        document.getElementById('universal-footer')
    ].filter(Boolean);

    let height = 0;
    candidates.forEach((el) => {
        const rect = el.getBoundingClientRect();
        height = Math.max(height, Math.ceil(rect.height || el.offsetHeight || 0));
    });

    return height;
}

const AD_BANNER_GAP = 16;
const WEB_AD_BANNER_MIN_HEIGHT = 52;
const NATIVE_AD_BANNER_MIN_HEIGHT = 56;
let adBannerVisible = false;
let adBannerMode = null;

function measureAdBannerHeight(container) {
    if (!container) return 0;
    const content = container.firstElementChild || container;
    const rect = content.getBoundingClientRect();
    return Math.ceil(rect.height || content.offsetHeight || container.offsetHeight || 0);
}

function updateAdLayoutSpacing(bannerHeight) {
    if (PremiumManager.isPremium()) {
        adBannerVisible = false;
        adBannerMode = null;
        document.body.style.removeProperty('--ad-screen-safe-space');
        document.body.classList.remove('has-ad-banner');
        return 0;
    }

    const container = document.getElementById('admob-banner');
    const footerHeight = getBottomFooterHeight();
    let measuredHeight = typeof bannerHeight === 'number' ? bannerHeight : 0;

    if (adBannerVisible && measuredHeight <= 0) {
        if (adBannerMode === 'web') {
            measuredHeight = measureAdBannerHeight(container) || WEB_AD_BANNER_MIN_HEIGHT;
        } else if (adBannerMode === 'native') {
            measuredHeight = NATIVE_AD_BANNER_MIN_HEIGHT;
        }
    }

    if (adBannerMode === 'web' && container) {
        container.style.bottom = `${footerHeight}px`;
    }

    if (measuredHeight > 0) {
        const safeSpace = Math.max(160, footerHeight + measuredHeight + AD_BANNER_GAP);
        document.body.style.setProperty('--ad-screen-safe-space', `${safeSpace}px`);
        document.body.classList.add('has-ad-banner');
        return safeSpace;
    }

    document.body.style.removeProperty('--ad-screen-safe-space');
    if (!container || container.style.display === 'none') {
        document.body.classList.remove('has-ad-banner');
    }
    return 0;
}

function initAdMob() {
    if (PremiumManager.isPremium()) {
        hideAdBanner();
        return;
    }

    const platform = getPlatform();

    // Native AdMob (Capacitor/Cordova)
    if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.AdMob) {
        initNativeAdMob(platform);
        return;
    }

    // Web fallback: show placeholder banner
    showWebAdBanner();
}

function initNativeAdMob(platform) {
    const config = platform === 'ios' ? AdMobConfig.ios : AdMobConfig.android;
    const footerHeight = getBottomFooterHeight();

    try {
        const { AdMob } = window.Capacitor.Plugins;

        AdMob.initialize({
            requestTrackingAuthorization: true,
            testingDevices: [],
            initializeForTesting: false
        });

        AdMob.showBanner({
            adId: config.bannerId,
            adSize: 'BANNER',
            position: 'BOTTOM_CENTER',
            margin: footerHeight,
            isTesting: false
        });

        adBannerVisible = true;
        adBannerMode = 'native';
        updateAdLayoutSpacing(NATIVE_AD_BANNER_MIN_HEIGHT);

        console.log('ADMOB: Native banner initialized');
    } catch (e) {
        console.warn('ADMOB: Native init failed, falling back to web', e);
        showWebAdBanner();
    }
}

function showAdBanner() {
    if (PremiumManager.isPremium()) return;
    const platform = getPlatform();
    if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.AdMob) {
        initNativeAdMob(platform);
    } else {
        showWebAdBanner();
    }
}

function showWebAdBanner() {
    const container = document.getElementById('admob-banner');
    if (!container || PremiumManager.isPremium()) return;

    adBannerVisible = true;
    adBannerMode = 'web';
    const footerHeight = getBottomFooterHeight();
    container.style.bottom = `${footerHeight}px`;
    container.style.display = 'flex';
    container.innerHTML = `
        <div class="w-full max-w-[728px] bg-[#f5f0e8] border-t border-[#eee5d8] py-2 px-4 flex items-center justify-between gap-3">
            <div class="flex min-w-0 flex-1 items-center gap-2">
                <span class="shrink-0 text-[9px] text-[#a6967a] font-bold bg-white px-1.5 py-0.5 rounded">AD</span>
                <div class="min-w-0 flex-1 overflow-x-auto whitespace-nowrap">
                    <span class="block text-[10px] text-[#8b7e66] pr-3">繝｡繧､繝｡繝ｼ繧偵ｂ縺｣縺ｨ蠢ｫ驕ｩ縺ｫ</span>
                </div>
            </div>
            <button onclick="showPremiumModal()" class="shrink-0 px-3 py-1 bg-[#bca37f] text-white rounded-full text-[10px] font-bold hover:bg-[#8b7e66] transition-all">
                蠎・相繧帝撼陦ｨ遉ｺ
            </button>
        </div>
    `;

    const adBannerRow = container.firstElementChild;
    if (adBannerRow) {
        const scrollArea = adBannerRow.querySelector('div.min-w-0.flex-1.overflow-x-auto');
        if (scrollArea) {
            scrollArea.style.overflowX = 'hidden';
        }
        const spans = adBannerRow.querySelectorAll('span');
        if (spans.length > 1) {
            spans[1].textContent = '\u7121\u6599\u4f1a\u54e1\u5411\u3051\u5e83\u544a\u3092\u8868\u793a\u4e2d';
            spans[1].title = '\u7121\u6599\u4f1a\u54e1\u5411\u3051\u5e83\u544a\u3092\u8868\u793a\u4e2d';
        }
        const bannerButton = adBannerRow.querySelector('button');
        if (bannerButton) {
            bannerButton.textContent = '\u30d7\u30e9\u30f3\u3092\u898b\u308b';
        }
    }

    document.body.classList.add('has-ad-banner');
    updateAdLayoutSpacing(measureAdBannerHeight(container) || WEB_AD_BANNER_MIN_HEIGHT);
}

function hideAdBanner() {
    const container = document.getElementById('admob-banner');
    if (container) {
        container.style.display = 'none';
        container.style.bottom = '';
        container.innerHTML = '';
    }
    adBannerVisible = false;
    adBannerMode = null;
    document.body.style.removeProperty('--ad-screen-safe-space');
    document.body.classList.remove('has-ad-banner');

    if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.AdMob) {
        try {
            window.Capacitor.Plugins.AdMob.hideBanner();
        } catch (e) { console.warn('ADMOB: hideBanner failed', e); }
    }
}

window.addEventListener('resize', () => {
    if (adBannerVisible) {
        updateAdLayoutSpacing();
    }
});

function openPremiumModalFromDrawer() {
    if (typeof closeDrawer === 'function') {
        closeDrawer();
        setTimeout(() => {
            if (typeof showPremiumModal === 'function') {
                showPremiumModal();
            }
        }, 320);
        return;
    }

    if (typeof showPremiumModal === 'function') {
        showPremiumModal();
    }
}

function closePremiumModal() {
    const modal = document.getElementById('modal-ai-sound');
    if (modal) modal.classList.remove('active');
}

// 初期化
function initAdSystem() {
    setTimeout(() => {
        initAdMob();
        updatePremiumUI();
    }, 2000); // アプリ起動2秒後に広告を表示
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAdSystem);
} else {
    setTimeout(initAdSystem, 2000);
}

// Premium state helpers and exports
function formatPremiumMembershipDate(date) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
    return date.getFullYear() + '年' + (date.getMonth() + 1) + '月' + date.getDate() + '日';
}

function getConnectedPartnerPremiumSnapshot() {
    if (typeof MeimayPairing === 'undefined' || !MeimayPairing || !MeimayPairing.roomCode || !MeimayPairing.partnerUid) {
        return null;
    }
    if (typeof MeimayShare === 'undefined' || !MeimayShare) {
        return null;
    }
    return MeimayShare.partnerUserSnapshot || null;
}

function getConnectedPremiumPartnerSnapshot() {
    return getConnectedPartnerPremiumSnapshot();
}

function buildPremiumMembershipState(record, source, options = {}) {
    const data = record || {};
    const status = String(data.subscriptionStatus || data.premiumStatus || '').trim().toLowerCase();
    const premiumSource = String(data.premiumSource || '').trim().toLowerCase();
    const trialStatus = String(data.trialStatus || '').trim().toLowerCase();
    const trialEndsAt = normalizePremiumDate(data.trialEndsAt || null);
    const trialConsumedAt = normalizePremiumDate(data.trialConsumedAt || null);
    const expiresAt = normalizePremiumDate(data.appStoreExpiresAt || data.premiumExpiresAt || data.trialEndsAt || null);
    const productId = String(data.appStoreProductId || data.premiumProductId || '').trim();
    const explicitPremium = typeof data.isPremium === 'boolean' ? data.isPremium : null;
    const hasTrialIndicators = !!trialStatus || !!trialEndsAt || !!trialConsumedAt || premiumSource === 'trial';
    const hasPremiumIndicators = explicitPremium !== null || !!status || !!expiresAt || !!productId || hasTrialIndicators;
    const expiredStatuses = new Set(['expired', 'refunded', 'revoked', 'billing_retry']);
    const expiredByDate = !!expiresAt && expiresAt.getTime() <= Date.now();
    const expired = expiredByDate || expiredStatuses.has(status);
    const isTrial = premiumSource === 'trial' || status === 'trialing' || trialStatus === 'active';
    const trialConsumed = !!trialConsumedAt || trialStatus === 'consumed' || trialStatus === 'expired' || (hasTrialIndicators && expired);
    const localFallbackActive = options.allowLocalFallback === true
        && !hasPremiumIndicators
        && options.localPremium === true;
    const active = !expired && (explicitPremium === true || status === 'active' || status === 'trialing' || trialStatus === 'active' || localFallbackActive);
    const isPartner = source === 'partner';
    const expiresLabel = expiresAt ? formatPremiumMembershipDate(expiresAt) : '';

    let label = 'プレミアム未登録';
    let detail = isPartner
        ? 'パートナーのプレミアム状態はまだ確認できていません。'
        : 'このアカウントのプレミアム状態はまだ確認できていません。';

    if (active) {
        if (isTrial) {
            label = isPartner ? '3日無料プレミアム有効\nパートナー特典' : '3日無料プレミアム有効';
        } else {
            label = isPartner ? 'プレミアム有効\nパートナー特典' : 'プレミアム有効';
        }
        if (expiresLabel && !expiredByDate) {
            label += '\n' + expiresLabel + 'まで';
        }
        if (localFallbackActive) {
            label = '開発用プレミアム有効';
            detail = 'ローカル確認用のプレミアム状態です。本番では購入情報を確認します。';
        } else if (isTrial) {
            detail = isPartner
                ? '連携中のパートナーの無料体験で、プレミアム特典を利用できます。'
                : '無料体験期間中です。気に入ったら有料プランへ進めます。';
        } else {
            detail = isPartner
                ? '連携中のパートナーのプレミアム特典を利用できます。'
                : 'このアカウントでプレミアム特典を利用できます。';
        }
    } else if (expired) {
        label = 'プレミアム期限切れ';
        detail = expiresLabel
            ? '有効期限は' + expiresLabel + 'まででした。'
            : 'プレミアムの有効期限が切れています。';
    }

    return {
        source,
        premiumSource,
        active,
        expired,
        hasPremiumIndicators,
        isTrial,
        trialStatus,
        trialEndsAt,
        trialConsumed,
        trialConsumedByRoom: data.trialConsumedByRoom === true,
        title: label,
        label,
        detail,
        expiresAt,
        status,
        productId
    };
}

function getSelfPremiumMembershipState() {
    return buildPremiumMembershipState({
        isPremium: PremiumManager._remotePremium,
        premiumSource: PremiumManager._remotePremiumSource,
        subscriptionStatus: PremiumManager._remoteStatus,
        appStoreExpiresAt: PremiumManager._remoteAppStoreExpiresAt,
        premiumExpiresAt: PremiumManager._remoteExpiresAt,
        appStoreProductId: PremiumManager._remoteProductId,
        premiumProductId: PremiumManager._remoteProductId,
        trialStatus: PremiumManager._remoteTrialStatus,
        trialStartedAt: PremiumManager._remoteTrialStartedAt,
        trialEndsAt: PremiumManager._remoteTrialEndsAt,
        trialConsumedAt: PremiumManager._remoteTrialConsumedAt,
        trialConsumedByRoom: PremiumManager._remoteTrialConsumedByRoom
    }, 'self', {
        localPremium: typeof PremiumManager.getLocalPremiumState === 'function'
            ? PremiumManager.getLocalPremiumState()
            : false,
        allowLocalFallback: isLocalPremiumFallbackAllowed()
    });
}

function getDefaultPremiumMembershipState() {
    return buildPremiumMembershipState({}, 'self', { allowLocalFallback: false });
}

PremiumManager.isPremium = function () {
    const state = this.getMembershipState();
    return !!(state && state.active);
};

PremiumManager.getMembershipState = function () {
    const selfState = getSelfPremiumMembershipState();
    const partnerSnapshot = getConnectedPartnerPremiumSnapshot();
    const partnerState = partnerSnapshot
        ? buildPremiumMembershipState(partnerSnapshot, 'partner', { allowLocalFallback: false })
        : null;

    if (selfState.active) return selfState;
    if (partnerState && partnerState.active) return partnerState;
    if (selfState.expired) return selfState;
    if (partnerState && partnerState.expired) return partnerState;
    if (selfState.hasPremiumIndicators) return selfState;
    if (partnerState && partnerState.hasPremiumIndicators) return partnerState;

    return getDefaultPremiumMembershipState();
};

PremiumManager.getDrawerStatusLabel = function () {
    const state = this.getMembershipState();
    return state.label;
};

PremiumManager.getStatusSummary = function () {
    const state = this.getMembershipState();
    return {
        title: state.label,
        detail: state.detail,
        source: state.source,
        active: state.active,
        expired: state.expired
    };
};

PremiumManager.refreshPurchaseState = async function () {
    const user = typeof MeimayAuth !== 'undefined' && MeimayAuth.getCurrentUser
        ? MeimayAuth.getCurrentUser()
        : null;

    if (!user) {
        if (typeof showToast === 'function') {
            showToast('購入状態の確認には接続準備が必要です', 'i');
        }
        return false;
    }

    try {
        await this.bindToUserDoc(user);
        if (typeof MeimayShare !== 'undefined' && MeimayShare && typeof MeimayShare.syncPremiumState === 'function') {
            const publicPremiumState = typeof this.getPublicPremiumSnapshot === 'function'
                ? this.getPublicPremiumSnapshot()
                : null;
            await MeimayShare.syncPremiumState(publicPremiumState);
        }
        if (typeof showToast === 'function') {
            showToast(this.isPremium() ? '購入状態を更新しました' : '現在の購入状態を確認しました', this.isPremium() ? 'OK' : 'i');
        }
        return true;
    } catch (e) {
        console.warn('PREMIUM: refreshPurchaseState failed', e);
        if (typeof showToast === 'function') {
            showToast('購入状態を確認できませんでした', '!');
        }
        return false;
    }
};

function getPremiumTrialRoomNotice() {
    const inRoom = typeof MeimayPairing !== 'undefined' && MeimayPairing && MeimayPairing.roomCode;
    const hasPartner = inRoom && !!MeimayPairing.partnerUid;
    if (hasPartner) {
        return 'パートナー連携中なので、開始すると二人分の無料枠を同時に使います。';
    }
    if (inRoom) {
        return 'パートナー参加前に開始すると、この端末の無料枠だけを使います。';
    }
    return '好きなタイミングで1回だけ開始できます。';
}

function getPremiumTrialButtonLabel() {
    if (PremiumManager._trialStartInProgress) return '開始しています...';
    const hasPartner = typeof MeimayPairing !== 'undefined' && MeimayPairing && MeimayPairing.roomCode && MeimayPairing.partnerUid;
    return hasPartner ? '二人で3日間試す' : '3日間無料で試す';
}

function getPremiumTrialToastMessage(result) {
    const status = String(result?.status || '').trim();
    if (status === 'started') {
        return result?.consumesRoom ? '二人の無料体験を開始しました' : '3日間の無料体験を開始しました';
    }
    if (status === 'trial_active') return '無料体験はすでに有効です';
    if (status === 'partner_trial_active') return 'パートナーの無料体験が有効です';
    if (status === 'paid_active') return 'すでにプレミアムが有効です';
    if (status === 'trial_unavailable') return '無料体験は利用済みです';
    return '無料体験の状態を確認しました';
}

PremiumManager.startTrial = async function () {
    if (this._trialStartInProgress) return false;

    const user = typeof MeimayAuth !== 'undefined' && MeimayAuth.getCurrentUser
        ? MeimayAuth.getCurrentUser()
        : null;
    if (!user) {
        if (typeof showToast === 'function') {
            showToast('無料体験の開始には接続準備が必要です', 'i');
        }
        return false;
    }

    this._trialStartInProgress = true;
    if (typeof showPremiumModal === 'function') showPremiumModal();

    try {
        const headers = typeof getFirebaseRequestHeaders === 'function'
            ? await getFirebaseRequestHeaders()
            : { 'Content-Type': 'application/json' };
        const response = await fetch('/api/premium-trial', {
            method: 'POST',
            headers,
            body: JSON.stringify({
                roomCode: typeof MeimayPairing !== 'undefined' && MeimayPairing && MeimayPairing.roomCode
                    ? MeimayPairing.roomCode
                    : ''
            })
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || result.ok === false) {
            throw new Error(result.details || result.error || `HTTP ${response.status}`);
        }

        if (typeof showToast === 'function') {
            showToast(getPremiumTrialToastMessage(result), result.status === 'started' ? 'OK' : 'i');
        }

        await this.refreshPurchaseState();
        if (typeof showPremiumModal === 'function') showPremiumModal();
        return result.status === 'started' || result.status === 'trial_active' || result.status === 'partner_trial_active' || result.status === 'paid_active';
    } catch (e) {
        console.warn('PREMIUM: startTrial failed', e);
        if (typeof showToast === 'function') {
            showToast('無料体験を開始できませんでした', '!');
        }
        return false;
    } finally {
        this._trialStartInProgress = false;
        if (typeof updatePremiumUI === 'function') updatePremiumUI();
        if (typeof showPremiumModal === 'function') showPremiumModal();
    }
};

function updatePremiumUI() {
    const state = typeof PremiumManager !== 'undefined' && typeof PremiumManager.getMembershipState === 'function'
        ? PremiumManager.getMembershipState()
        : getDefaultPremiumMembershipState();

    if (state.active) {
        hideAdBanner();
    } else {
        showAdBanner();
    }

    const premiumBadge = document.getElementById('premium-badge');
    if (premiumBadge) {
        premiumBadge.classList.toggle('hidden', !state.active);
        premiumBadge.title = state.label || '';
    }

    if (typeof updateDrawerProfile === 'function') {
        updateDrawerProfile();
    }

    if (typeof renderHomeProfile === 'function' && document.getElementById('scr-mode')) {
        renderHomeProfile();
    }

    if (typeof renderSavedScreen === 'function' && document.getElementById('scr-saved')) {
        renderSavedScreen();
    }

    if (typeof renderSettingsScreen === 'function') {
        renderSettingsScreen();
    }
}

function formatPremiumMatrixCell(value) {
    return escapePremiumHtml(value).replace(/\n/g, '<br>');
}

function renderPremiumComparisonMatrix() {
    const rows = [
        { item: '使える漢字', free: '常用漢字中心', premium: '常用漢字\n＋人名用漢字' },
        { item: '広告', free: 'あり', premium: 'なし' },
        { item: '読みスワイプ', free: '1日100回', premium: '無制限' },
        { item: '漢字スワイプ', free: '1日100回', premium: '無制限' },
        { item: 'AI漢字深掘り', free: '1日1回', premium: '無制限' }
    ];

    return ''
        + '<div class="relative overflow-hidden rounded-[22px] border border-[#e4d9c6] bg-[#fffdf7]">'
        + '<div class="pointer-events-none absolute z-0 rounded-[18px] border-2 border-[#d7b57c] bg-[linear-gradient(180deg,rgba(255,247,232,0.96),rgba(255,252,243,0.92))] shadow-[0_10px_28px_rgba(183,145,85,0.12)]" style="top:8px;bottom:8px;left:calc(61.31% + 6px);right:8px;"></div>'
        + '<div class="relative z-10">'
        + '<div class="grid grid-cols-[1.05fr_0.82fr_1.18fr] gap-x-2 border-b border-[#eadfcd] bg-[#f6eddb] px-3 py-2.5 text-[11px] sm:text-[12px] font-black text-[#5b4f3f]">'
        + '<div class="flex items-center">項目</div>'
        + '<div class="flex items-center justify-center">無料</div>'
        + '<div class="flex items-center justify-center"><span class="inline-flex items-center justify-center rounded-full bg-[#fff5df] px-3 py-1 text-[#8e6c36] shadow-sm">プレミアム</span></div>'
        + '</div>'
        + '<div class="divide-y divide-[#efe5d3]">'
        + rows.map(({ item, free, premium }) => ''
            + '<div class="grid grid-cols-[1.05fr_0.82fr_1.18fr] items-stretch gap-x-2 px-3 py-2.5 text-[11px] sm:text-[12px] leading-[1.5] text-[#2f271e]">'
            + '<div class="flex items-center font-bold">' + formatPremiumMatrixCell(item) + '</div>'
            + '<div class="flex items-center justify-center text-center"><span class="inline-flex min-h-[44px] w-full items-center justify-center whitespace-nowrap rounded-[14px] bg-white px-2 py-2 text-[10px] sm:text-[11px] font-semibold text-[#5d5444]">' + formatPremiumMatrixCell(free) + '</span></div>'
            + '<div class="flex items-center justify-center text-center"><span class="inline-flex min-h-[44px] w-full items-center justify-center rounded-[14px] bg-transparent px-2 py-2 font-black text-[#5b4f3f]">' + formatPremiumMatrixCell(premium) + '</span></div>'
            + '</div>'
        ).join('')
        + '</div></div></div>';
}

function renderPremiumLabelMarkup(label) {
    const lines = String(label || '').split('\n').map((line) => line.trim()).filter(Boolean);
    if (!lines.length) return '';
    if (lines.length === 1) {
        return '<span class="block text-[11px] font-black leading-tight">' + escapePremiumHtml(lines[0]) + '</span>';
    }
    return ''
        + '<span class="block text-[11px] font-black leading-tight">' + escapePremiumHtml(lines[0]) + '</span>'
        + '<span class="mt-0.5 block text-[9px] font-medium leading-tight text-[#8b7e66]">' + escapePremiumHtml(lines.slice(1).join(' ')) + '</span>';
}

function renderPremiumTrialCard(state) {
    if (!state || state.active) return '';
    const selfState = getSelfPremiumMembershipState();
    const partnerSnapshot = getConnectedPartnerPremiumSnapshot();
    const partnerState = partnerSnapshot
        ? buildPremiumMembershipState(partnerSnapshot, 'partner', { allowLocalFallback: false })
        : null;
    const unavailable = selfState.trialConsumed || (partnerState && partnerState.trialConsumed);
    const buttonDisabled = unavailable || PremiumManager._trialStartInProgress;
    const disabledClass = buttonDisabled ? ' opacity-60 pointer-events-none' : '';
    const body = unavailable
        ? 'このアカウント、または連携中のパートナーは無料体験を利用済みです。'
        : getPremiumTrialRoomNotice();

    return ''
        + '<div class="rounded-[20px] border border-[#d7b57c] bg-[#fff7e8] px-3 py-3 shadow-[0_10px_24px_rgba(183,145,85,0.10)]">'
        + '<div class="flex items-start justify-between gap-3">'
        + '<div>'
        + '<div class="text-[10px] font-black tracking-[0.14em] text-[#b48642]">無料体験</div>'
        + '<div class="mt-1 text-[15px] sm:text-[17px] font-black text-[#4b3a24]">好きなタイミングから3日間</div>'
        + '<p class="mt-1 text-[12px] sm:text-[13px] leading-[1.65] text-[#6d5a3d]">' + escapePremiumHtml(body) + '</p>'
        + '</div>'
        + '</div>'
        + '<button type="button" onclick="PremiumManager.startTrial()" class="mt-3 w-full py-2.5 rounded-2xl bg-[#b98942] text-white text-sm font-black shadow-md active:scale-[0.99]' + disabledClass + '">'
        + escapePremiumHtml(unavailable ? '無料体験は利用済み' : getPremiumTrialButtonLabel())
        + '</button>'
        + '</div>';
}

function showPremiumModal() {
    const modal = document.getElementById('modal-ai-sound');
    if (!modal) return;

    const state = typeof PremiumManager !== 'undefined' && typeof PremiumManager.getMembershipState === 'function'
        ? PremiumManager.getMembershipState()
        : { active: false, label: 'プレミアム未登録', detail: '' };

    modal.classList.add('active');
    modal.innerHTML = ''
        + '<div class="detail-sheet max-w-none" style="max-width:min(92vw, 860px); max-height:min(88vh, 760px); overflow-x:hidden; overflow-y:auto; padding: clamp(16px, 2.6vw, 24px); background:#f7efdde6; border:1px solid #e4d9c6; box-shadow:0 24px 80px rgba(93,77,62,0.18);" onclick="event.stopPropagation()">'
        + '<button class="modal-close-btn" onclick="closePremiumModal()">×</button>'
        + '<div class="space-y-3">'
        + '<div class="text-center">'
        + '<div class="text-[9px] font-black text-[#b9965b] tracking-[0.18em]">プレミアムプラン</div>'
        + '<h3 class="mt-1 text-[1.2rem] sm:text-[1.5rem] font-black text-[#5b4f3f]">プレミアム機能</h3>'
        + '</div>'
        + renderPremiumComparisonMatrix()
        + renderPremiumTrialCard(state)
        + '<div class="rounded-[18px] border border-[#e4d9c6] bg-[#fffaf1] px-3 py-3">'
        + '<div class="text-[13px] sm:text-[15px] font-black text-[#2f271e] mb-1">現在の状態</div>'
        + '<div class="text-[12px] sm:text-[14px] leading-[1.65] text-[#5d5444]">' + renderPremiumLabelMarkup(state.label) + '</div>'
        + '<p class="mt-2 text-[12px] sm:text-[14px] leading-[1.65] text-[#5d5444]">' + escapePremiumHtml(state.detail || '') + '</p>'
        + '</div>'
        + '<div class="grid grid-cols-1 sm:grid-cols-2 gap-2">'
        + (state.active
            ? '<button onclick="closePremiumModal()" class="w-full py-2.5 bg-gradient-to-r from-[#bca37f] to-[#8b7e66] text-white rounded-2xl font-bold text-sm shadow-md">閉じる</button>'
            : '<button onclick="PremiumManager.refreshPurchaseState()" class="w-full py-2.5 bg-gradient-to-r from-[#bca37f] to-[#8b7e66] text-white rounded-2xl font-bold text-sm shadow-md">購入状態を確認</button>')
        + '<button onclick="closePremiumModal()" class="w-full py-2.5 rounded-2xl border border-[#e6dccb] bg-white text-[#8b7e66] font-bold text-sm">あとで見る</button>'
        + '</div>'
        + '</div></div>';
}

window.PremiumManager = PremiumManager;
window.showPremiumModal = showPremiumModal;
window.renderPremiumComparisonMatrix = renderPremiumComparisonMatrix;
window.formatPremiumMembershipDate = formatPremiumMembershipDate;
window.getConnectedPartnerPremiumSnapshot = getConnectedPartnerPremiumSnapshot;
window.getConnectedPremiumPartnerSnapshot = getConnectedPremiumPartnerSnapshot;
window.buildPremiumMembershipState = buildPremiumMembershipState;
window.isLocalPremiumFallbackAllowed = isLocalPremiumFallbackAllowed;
window.openPremiumModalFromDrawer = openPremiumModalFromDrawer;
window.closePremiumModal = closePremiumModal;
window.hideAdBanner = hideAdBanner;
window.showAdBanner = showAdBanner;
