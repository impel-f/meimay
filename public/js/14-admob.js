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
    TOKEN_KEY: 'meimay_app_account_token',
    _remotePremium: null,
    _remoteStatus: null,
    _remoteExpiresAt: null,
    _remoteProductId: null,
    _remoteLastNotificationType: null,
    _userDocUnsub: null,

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
        const remoteExpiresAt = normalizePremiumDate(this._remoteExpiresAt);
        const remoteExpired = !!remoteExpiresAt && remoteExpiresAt.getTime() <= Date.now();
        let isPremium = this.getLocalPremiumState();

        if (this._remotePremium === true) {
            isPremium = !remoteExpired;
        } else if (this._remotePremium === false) {
            isPremium = false;
        } else if (remoteStatus === 'active') {
            isPremium = !remoteExpired;
        } else if (remoteExpired || remoteStatus === 'expired' || remoteStatus === 'refunded' || remoteStatus === 'revoked' || remoteStatus === 'billing_retry') {
            isPremium = false;
        }

        return {
            isPremium,
            subscriptionStatus: remoteStatus || null,
            premiumStatus: remoteStatus || null,
            appStoreExpiresAt: this._remoteExpiresAt || null,
            premiumExpiresAt: this._remoteExpiresAt || null,
            appStoreProductId: this._remoteProductId || null,
            premiumProductId: this._remoteProductId || null,
            appStoreLastNotificationType: this._remoteLastNotificationType || null,
            latestNotificationType: this._remoteLastNotificationType || null
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
        const remoteStatus = String(this._remoteStatus || '').trim().toLowerCase();
        const remoteExpiresAt = normalizePremiumDate(this._remoteExpiresAt);
        const remoteExpired = !!remoteExpiresAt && remoteExpiresAt.getTime() <= Date.now();

        if (this._remotePremium === true) return !remoteExpired;
        if (this._remotePremium === false) return false;
        if (remoteStatus === 'active') return !remoteExpired;
        if (remoteExpired || remoteStatus === 'expired' || remoteStatus === 'refunded' || remoteStatus === 'revoked' || remoteStatus === 'billing_retry') {
            return false;
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
            this._remoteStatus = typeof data.subscriptionStatus === 'string'
                ? data.subscriptionStatus.trim().toLowerCase()
                : null;
            this._remoteExpiresAt = data.appStoreExpiresAt || data.premiumExpiresAt || null;
            this._remoteProductId = typeof data.appStoreProductId === 'string'
                ? data.appStoreProductId
                : (typeof data.premiumProductId === 'string' ? data.premiumProductId : null);
            this._remoteLastNotificationType = typeof data.appStoreLastNotificationType === 'string'
                ? data.appStoreLastNotificationType
                : (typeof data.latestNotificationType === 'string' ? data.latestNotificationType : null);

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

function getConnectedPremiumPartnerSnapshot() {
    if (typeof MeimayPairing === 'undefined' || !MeimayPairing.roomCode || !MeimayPairing.partnerUid) {
        return null;
    }
    if (typeof MeimayShare === 'undefined' || !MeimayShare) {
        return null;
    }
    return MeimayShare.partnerUserSnapshot || null;
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

function showWebAdBanner() {
    const container = document.getElementById('admob-banner');
    if (!container || PremiumManager.isPremium()) return;

    const footerHeight = getBottomFooterHeight();
    container.style.bottom = `${footerHeight}px`;
    container.style.display = 'flex';
    container.innerHTML = `
        <div class="w-full max-w-[728px] bg-[#f5f0e8] border-t border-[#eee5d8] py-2 px-4 flex items-center justify-between">
            <div class="flex items-center gap-2">
                <span class="text-[9px] text-[#a6967a] font-bold bg-white px-1.5 py-0.5 rounded">AD</span>
                <span class="text-[10px] text-[#8b7e66]">メイメーをもっと快適に</span>
            </div>
            <button onclick="showPremiumModal()" class="px-3 py-1 bg-[#bca37f] text-white rounded-full text-[10px] font-bold hover:bg-[#8b7e66] transition-all">
                広告を非表示
            </button>
        </div>
    `;

    // 広告がある場合、全画面にpaddingを追加
    document.body.classList.add('has-ad-banner');
}

function hideAdBanner() {
    const container = document.getElementById('admob-banner');
    if (container) {
        container.style.display = 'none';
        container.style.bottom = '';
        container.innerHTML = '';
    }
    document.body.classList.remove('has-ad-banner');

    // Native AdMob hide
    if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.AdMob) {
        try {
            window.Capacitor.Plugins.AdMob.hideBanner();
        } catch (e) { console.warn('ADMOB: hideBanner failed', e); }
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

function showPremiumModal() {
    const modal = document.getElementById('modal-ai-sound');
    if (!modal) return;

    const isPremium = PremiumManager.isPremium();

    modal.classList.add('active');
    modal.innerHTML = `
        <div class="detail-sheet max-w-md" onclick="event.stopPropagation()">
            <button class="modal-close-btn" onclick="closePremiumModal()">✕</button>
            <div class="text-center py-6">
                <div class="text-[10px] font-black text-[#bca37f] mb-4 tracking-widest uppercase">Premium Plan</div>
                <div class="text-4xl mb-4">👑</div>
                <h3 class="text-lg font-black text-[#5d5444] mb-2">メイメー プレミアム</h3>
                <p class="text-xs text-[#a6967a] mb-6">広告なしで快適に名前探し</p>

                ${isPremium ? `
                    <div class="bg-[#f0fdf4] border border-green-200 rounded-2xl p-4 mb-6">
                        <p class="text-sm font-bold text-green-700">プレミアム有効中</p>
                    </div>
                    <button onclick="PremiumManager.deactivate();closePremiumModal()" class="w-full py-3 bg-[#fef2f2] text-[#f28b82] rounded-2xl font-bold text-sm">
                        プレミアムを解除
                    </button>
                ` : `
                    <div class="space-y-3 mb-6 text-left px-4">
                        <div class="flex items-center gap-3">
                            <span class="text-lg">✅</span>
                            <span class="text-sm text-[#5d5444]">広告の完全非表示</span>
                        </div>
                        <div class="flex items-center gap-3">
                            <span class="text-lg">✅</span>
                            <span class="text-sm text-[#5d5444]">今日の直感スワイプが無制限</span>
                        </div>
                        <div class="flex items-center gap-3">
                            <span class="text-lg">✅</span>
                            <span class="text-sm text-[#5d5444]">申請版以降のプレミアム機能に優先アクセス</span>
                        </div>
                    </div>
                    <button onclick="PremiumManager.activate();closePremiumModal()" class="w-full py-4 bg-gradient-to-r from-[#bca37f] to-[#8b7e66] text-white rounded-2xl font-bold text-sm shadow-md">
                        プレミアムを有効にする
                    </button>
                    <p class="text-[9px] text-[#a6967a] mt-3">※ 現在はベータ版のため無料でお試しいただけます</p>
                `}
            </div>
        </div>
    `;
}

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

function updatePremiumUI() {
    // 設定画面等にプレミアム状態を反映
    const premiumBadge = document.getElementById('premium-badge');
    if (premiumBadge) {
        premiumBadge.classList.toggle('hidden', !PremiumManager.isPremium());
    }

    if (typeof updateDrawerProfile === 'function') {
        updateDrawerProfile();
    }

    if (typeof renderSettingsScreen === 'function') {
        renderSettingsScreen();
    }

    if (typeof updateKanjiSearchTitle === 'function') {
        updateKanjiSearchTitle();
    }
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

// Global exports
window.PremiumManager = PremiumManager;
window.showPremiumModal = showPremiumModal;
// EOF premium override
window.formatPremiumMembershipDate = function (date) {
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
};

window.getConnectedPartnerPremiumSnapshot = function () {
    if (typeof MeimayPairing === 'undefined' || !MeimayPairing || !MeimayPairing.roomCode || !MeimayPairing.partnerUid) {
        return null;
    }
    if (typeof MeimayShare === 'undefined' || !MeimayShare) {
        return null;
    }
    return MeimayShare.partnerUserSnapshot || null;
};

window.getConnectedPremiumPartnerSnapshot = function () {
    return window.getConnectedPartnerPremiumSnapshot();
};

window.buildPremiumMembershipState = function (record, source, options = {}) {
    const data = record || {};
    const status = String(data.subscriptionStatus || data.premiumStatus || '').trim().toLowerCase();
    const expiresAt = normalizePremiumDate(data.appStoreExpiresAt || data.premiumExpiresAt || null);
    const productId = String(data.appStoreProductId || data.premiumProductId || '').trim();
    const explicitPremium = typeof data.isPremium === 'boolean' ? data.isPremium : null;
    const hasPremiumIndicators = explicitPremium !== null || !!status || !!expiresAt || !!productId;
    const expiredStatuses = new Set(['expired', 'refunded', 'revoked', 'billing_retry']);
    const expiredByDate = !!expiresAt && expiresAt.getTime() <= Date.now();
    const isExpired = expiredByDate || expiredStatuses.has(status);
    const allowLocalFallback = options.allowLocalFallback === true
        && !hasPremiumIndicators
        && options.localPremium === true;
    const isActive = !isExpired && (explicitPremium === true || status === 'active' || allowLocalFallback);
    const isPartner = source === 'partner';
    const expiresLabel = expiresAt ? window.formatPremiumMembershipDate(expiresAt) : '';
    const activeLabel = isPartner
        ? '👑プレミアムモード：有効（パートナー特典）'
        : '👑プレミアムモード：有効';

    let label = '👑プレミアムモード：未登録';
    let detail = isPartner
        ? '連携中のパートナーのプレミアム状態を表示します。'
        : 'このアカウントのプレミアム状態を表示します。';

    if (isActive) {
        label = expiresAt && !expiredByDate
            ? `${activeLabel}\n${expiresLabel}まで有効`
            : activeLabel;
        detail = isPartner
            ? (expiresAt && !expiredByDate
                ? `連携中のパートナーのプレミアムモードは${expiresLabel}まで有効です。`
                : '連携中のパートナーのプレミアムモードは有効です。')
            : (expiresAt && !expiredByDate
                ? `このアカウントのプレミアムモードは${expiresLabel}まで有効です。`
                : 'このアカウントのプレミアムモードは有効です。');
    } else if (isExpired) {
        label = '👑プレミアムモード：期限切れ';
        detail = expiresAt
            ? `有効期限は${expiresLabel}で終了しました。`
            : 'プレミアムの有効期限は切れています。';
    }

    return {
        source,
        active: isActive,
        expired: isExpired,
        hasPremiumIndicators,
        title: label,
        label,
        detail,
        expiresAt,
        status,
        productId
    };
};

PremiumManager.isPremium = function () {
    const state = this.getMembershipState();
    return !!(state && state.active);
};

PremiumManager.getMembershipState = function () {
    const selfState = window.buildPremiumMembershipState({
        isPremium: this._remotePremium,
        subscriptionStatus: this._remoteStatus,
        appStoreExpiresAt: this._remoteExpiresAt,
        premiumExpiresAt: this._remoteExpiresAt,
        appStoreProductId: this._remoteProductId,
        premiumProductId: this._remoteProductId
    }, 'self', {
        localPremium: typeof this.getLocalPremiumState === 'function' ? this.getLocalPremiumState() : false,
        allowLocalFallback: true
    });

    const partnerSnapshot = window.getConnectedPartnerPremiumSnapshot();
    const partnerState = partnerSnapshot
        ? window.buildPremiumMembershipState(partnerSnapshot, 'partner', { allowLocalFallback: false })
        : null;

    if (partnerState && partnerState.active) return partnerState;
    if (selfState.active) return selfState;
    if (selfState.expired) return selfState;
    if (partnerState && partnerState.expired) return partnerState;
    if (partnerState && partnerState.hasPremiumIndicators) return partnerState;
    if (selfState.hasPremiumIndicators) return selfState;

    return window.buildPremiumMembershipState({}, 'self', { allowLocalFallback: false });
};

PremiumManager.getDrawerStatusLabel = function () {
    return this.getMembershipState().label;
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
function renderPremiumComparisonMatrix() {
    const rows = [
        ['使える漢字', '常用漢字のみ', '常用漢字 + 人名用漢字'],
        ['広告', 'あり', 'なし'],
        ['読みスワイプ', '1日100回まで', '無制限'],
        ['漢字スワイプ', '1日100回まで', '無制限'],
        ['AI漢字深掘り', '1日1回まで', '無制限']
    ];

    return `
        <div class="overflow-hidden rounded-[22px] border border-[#e4d9c6] bg-[#fffdf7]">
            <div class="grid grid-cols-[1.1fr_0.8fr_1.15fr] gap-x-1.5 border-b border-[#eadfcd] bg-[#f6eddb] px-3 py-2 text-[9px] font-black text-[#5b4f3f]">
                <div>項目</div>
                <div class="text-center">無料</div>
                <div class="text-center">プレミアム</div>
            </div>
            <div class="divide-y divide-[#efe5d3]">
                ${rows.map(([item, free, premium]) => `
                    <div class="grid grid-cols-[1.1fr_0.8fr_1.15fr] gap-x-1.5 px-3 py-2 text-[9px] leading-[1.35] text-[#2f271e]">
                        <div class="font-bold">${escapePremiumHtml(item)}</div>
                        <div class="text-center">${escapePremiumHtml(free)}</div>
                        <div class="text-center">${escapePremiumHtml(premium)}</div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

function showPremiumModal() {
    const modal = document.getElementById('modal-ai-sound');
    if (!modal) return;

    const state = typeof PremiumManager !== 'undefined' && typeof PremiumManager.getMembershipState === 'function'
        ? PremiumManager.getMembershipState()
        : {
            active: false
        };

    modal.classList.add('active');
    modal.innerHTML = `
        <div class="detail-sheet max-w-none" style="max-width:min(92vw, 860px); max-height:min(88vh, 760px); overflow-x:hidden; overflow-y:auto; padding: clamp(16px, 2.6vw, 24px); background:#f7efdde6; border:1px solid #e4d9c6; box-shadow:0 24px 80px rgba(93,77,62,0.18);" onclick="event.stopPropagation()">
            <button class="modal-close-btn" onclick="closePremiumModal()">×</button>
            <div class="space-y-3">
                <div>
                    <div class="text-[9px] font-black text-[#b9965b] tracking-[0.35em] uppercase">Premium Plan</div>
                    <h3 class="mt-1 text-[1.15rem] sm:text-[1.45rem] font-black text-[#5b4f3f]">プレミアム案内</h3>
                </div>

                ${renderPremiumComparisonMatrix()}

                <div class="rounded-[18px] border border-[#e4d9c6] bg-[#fffaf1] px-3 py-2.5">
                    <div class="text-[12px] font-black text-[#2f271e] mb-0.5">パートナー特典</div>
                    <p class="text-[10px] leading-[1.55] text-[#5d5444]">どちらか1人がプレミアムに加入すると、連携中の相手もプレミアム機能を利用できます。</p>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    ${state.active ? `
                        <button onclick="closePremiumModal()" class="w-full py-2.5 bg-gradient-to-r from-[#bca37f] to-[#8b7e66] text-white rounded-2xl font-bold text-sm shadow-md">
                            閉じる
                        </button>
                    ` : `
                        <button onclick="PremiumManager.activate();closePremiumModal()" class="w-full py-2.5 bg-gradient-to-r from-[#bca37f] to-[#8b7e66] text-white rounded-2xl font-bold text-sm shadow-md">
                            プレミアムを有効にする
                        </button>
                    `}
                    <button onclick="PremiumManager.refreshPurchaseState()" class="w-full py-2.5 rounded-2xl border border-[#e6dccb] bg-white text-[#8b7e66] font-bold text-sm">
                        購入状態を更新
                    </button>
                </div>
            </div>
        </div>
    `;
}

window.renderPremiumComparisonMatrix = renderPremiumComparisonMatrix;
window.showPremiumModal = showPremiumModal;
function renderPremiumComparisonMatrix() {
    const rows = [
        ['使える漢字', '常用漢字のみ', '常用漢字 + 人名用漢字'],
        ['広告', 'あり', 'なし'],
        ['読みスワイプ', '1日100回まで', '無制限'],
        ['漢字スワイプ', '1日100回まで', '無制限'],
        ['AI漢字深掘り', '1日1回まで', '無制限']
    ];

    return `
        <div class="overflow-hidden rounded-[22px] border border-[#e4d9c6] bg-[#fffdf7]">
            <div class="grid grid-cols-[1.1fr_0.8fr_1.15fr] gap-x-1.5 border-b border-[#eadfcd] bg-[#f6eddb] px-3 py-2 text-[9px] font-black text-[#5b4f3f]">
                <div>項目</div>
                <div class="text-center">無料</div>
                <div class="text-center">プレミアム</div>
            </div>
            <div class="divide-y divide-[#efe5d3]">
                ${rows.map(([item, free, premium]) => `
                    <div class="grid grid-cols-[1.1fr_0.8fr_1.15fr] gap-x-1.5 px-3 py-2 text-[9px] leading-[1.35] text-[#2f271e]">
                        <div class="font-bold">${escapePremiumHtml(item)}</div>
                        <div class="text-center">${escapePremiumHtml(free)}</div>
                        <div class="text-center">${escapePremiumHtml(premium)}</div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

function showPremiumModal() {
    const modal = document.getElementById('modal-ai-sound');
    if (!modal) return;

    const state = typeof PremiumManager !== 'undefined' && typeof PremiumManager.getMembershipState === 'function'
        ? PremiumManager.getMembershipState()
        : {
            active: false
        };

    modal.classList.add('active');
    modal.innerHTML = `
        <div class="detail-sheet max-w-none" style="max-width:min(92vw, 860px); max-height:min(88vh, 760px); overflow-x:hidden; overflow-y:auto; padding: clamp(16px, 2.6vw, 24px); background:#f7efdde6; border:1px solid #e4d9c6; box-shadow:0 24px 80px rgba(93,77,62,0.18);" onclick="event.stopPropagation()">
            <button class="modal-close-btn" onclick="closePremiumModal()">×</button>
            <div class="space-y-3">
                <div>
                    <div class="text-[9px] font-black text-[#b9965b] tracking-[0.35em] uppercase">Premium Plan</div>
                    <h3 class="mt-1 text-[1.15rem] sm:text-[1.45rem] font-black text-[#5b4f3f]">プレミアム案内</h3>
                </div>

                ${renderPremiumComparisonMatrix()}

                <div class="rounded-[18px] border border-[#e4d9c6] bg-[#fffaf1] px-3 py-2.5">
                    <div class="text-[12px] font-black text-[#2f271e] mb-0.5">パートナー特典</div>
                    <p class="text-[10px] leading-[1.55] text-[#5d5444]">どちらか1人がプレミアムに加入すると、連携中の相手もプレミアム機能を利用できます。</p>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    ${state.active ? `
                        <button onclick="closePremiumModal()" class="w-full py-2.5 bg-gradient-to-r from-[#bca37f] to-[#8b7e66] text-white rounded-2xl font-bold text-sm shadow-md">
                            閉じる
                        </button>
                    ` : `
                        <button onclick="PremiumManager.activate();closePremiumModal()" class="w-full py-2.5 bg-gradient-to-r from-[#bca37f] to-[#8b7e66] text-white rounded-2xl font-bold text-sm shadow-md">
                            プレミアムを有効にする
                        </button>
                    `}
                    <button onclick="PremiumManager.refreshPurchaseState()" class="w-full py-2.5 rounded-2xl border border-[#e6dccb] bg-white text-[#8b7e66] font-bold text-sm">
                        購入状態を更新
                    </button>
                </div>
            </div>
        </div>
    `;
}

window.renderPremiumComparisonMatrix = renderPremiumComparisonMatrix;
window.showPremiumModal = showPremiumModal;

function renderPremiumComparisonMatrix() {
    const rows = [
        ['使える漢字', '常用漢字のみ', '常用漢字 + 人名用漢字'],
        ['広告', 'あり', 'なし'],
        ['読みスワイプ', '1日100回まで', '無制限'],
        ['漢字スワイプ', '1日100回まで', '無制限'],
        ['AI漢字深掘り', '1日1回まで', '無制限']
    ];

    return `
        <div class="overflow-hidden rounded-[24px] border border-[#e4d9c6] bg-[#fffdf7] shadow-[0_8px_24px_rgba(102,84,54,0.06)]">
            <div class="grid grid-cols-[1.1fr_0.85fr_1.2fr] gap-x-2 border-b border-[#eadfcd] bg-[#f6eddb] px-3 py-2 text-[10px] sm:text-[11px] font-black text-[#5b4f3f]">
                <div>項目</div>
                <div class="text-center">無料</div>
                <div class="text-center">プレミアム</div>
            </div>
            <div class="divide-y divide-[#efe5d3]">
                ${rows.map(([item, free, premium]) => `
                    <div class="grid grid-cols-[1.1fr_0.85fr_1.2fr] gap-x-2 px-3 py-2 text-[10px] sm:text-[11px] leading-[1.35] text-[#2f271e]">
                        <div class="font-bold">${escapePremiumHtml(item)}</div>
                        <div class="text-center">${escapePremiumHtml(free)}</div>
                        <div class="text-center">${escapePremiumHtml(premium)}</div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

function showPremiumModal() {
    const modal = document.getElementById('modal-ai-sound');
    if (!modal) return;

    const state = PremiumManager.getMembershipState();

    modal.classList.add('active');
    modal.innerHTML = `
        <div class="detail-sheet max-w-none" style="max-width:min(92vw, 860px); max-height:min(88vh, 760px); padding: clamp(16px, 2.8vw, 28px); background:#f7efdde6; border:1px solid #e4d9c6; box-shadow:0 24px 80px rgba(93,77,62,0.18);" onclick="event.stopPropagation()">
            <button class="modal-close-btn" onclick="closePremiumModal()">×</button>
            <div class="space-y-4">
                <div>
                    <div class="text-[9px] font-black text-[#b9965b] tracking-[0.35em] uppercase">Premium Plan</div>
                    <h3 class="mt-1 text-[1.25rem] sm:text-[1.6rem] font-black text-[#5b4f3f]">プレミアム案内</h3>
                </div>

                <div>
                    ${renderPremiumComparisonMatrix()}
                </div>

                <div class="rounded-[22px] border border-[#e4d9c6] bg-[#fffaf1] px-4 py-3">
                    <div class="text-[13px] sm:text-[15px] font-black text-[#2f271e] mb-1">パートナー特典</div>
                    <p class="text-[11px] sm:text-[12px] leading-[1.6] text-[#5d5444]">どちらか1人がプレミアムに加入すると、連携中の相手もプレミアム機能を利用できます。</p>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    ${state.active ? `
                        <button onclick="closePremiumModal()" class="w-full py-2.5 bg-gradient-to-r from-[#bca37f] to-[#8b7e66] text-white rounded-2xl font-bold text-sm shadow-md">
                            閉じる
                        </button>
                    ` : `
                        <button onclick="PremiumManager.activate();closePremiumModal()" class="w-full py-2.5 bg-gradient-to-r from-[#bca37f] to-[#8b7e66] text-white rounded-2xl font-bold text-sm shadow-md">
                            プレミアムを有効にする
                        </button>
                    `}
                    <button onclick="PremiumManager.refreshPurchaseState()" class="w-full py-2.5 rounded-2xl border border-[#e6dccb] bg-white text-[#8b7e66] font-bold text-sm">
                        購入状態を更新
                    </button>
                </div>

                <p class="text-[9px] leading-[1.5] text-[#a6967a]">購入後の反映に少し時間がかかる場合があります。</p>
            </div>
        </div>
    `;
}

window.showPremiumModal = showPremiumModal;

function getConnectedPartnerPremiumSnapshot() {
    if (typeof MeimayShare === 'undefined' || !MeimayShare) {
        return null;
    }
    if (typeof MeimayShare.getConnectedPremiumSnapshot === 'function') {
        const premiumSnapshot = MeimayShare.getConnectedPremiumSnapshot();
        if (premiumSnapshot) return premiumSnapshot;
    }
    if (MeimayShare.partnerUserSnapshot) {
        return MeimayShare.partnerUserSnapshot;
    }
    if (MeimayShare.partnerSnapshot && MeimayShare.partnerSnapshot.premiumState) {
        return MeimayShare.partnerSnapshot.premiumState;
    }
    return null;
}

function getConnectedPremiumPartnerSnapshot() {
    return getConnectedPartnerPremiumSnapshot();
}

window.getConnectedPartnerPremiumSnapshot = getConnectedPartnerPremiumSnapshot;
window.getConnectedPremiumPartnerSnapshot = getConnectedPremiumPartnerSnapshot;
function formatPremiumMembershipDate(date) {
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}

function getConnectedPartnerPremiumSnapshot() {
    if (typeof MeimayShare === 'undefined' || !MeimayShare) {
        return null;
    }
    if (typeof MeimayShare.getConnectedPremiumSnapshot === 'function') {
        const premiumSnapshot = MeimayShare.getConnectedPremiumSnapshot();
        if (premiumSnapshot) return premiumSnapshot;
    }
    if (MeimayShare.partnerUserSnapshot) {
        return MeimayShare.partnerUserSnapshot;
    }
    if (MeimayShare.partnerSnapshot && MeimayShare.partnerSnapshot.premiumState) {
        return MeimayShare.partnerSnapshot.premiumState;
    }
    return null;
}

function getConnectedPremiumPartnerSnapshot() {
    return getConnectedPartnerPremiumSnapshot();
}

function buildPremiumMembershipState(record, source, options = {}) {
    const data = record || {};
    const status = String(data.subscriptionStatus || data.premiumStatus || '').trim().toLowerCase();
    const expiresAt = normalizePremiumDate(data.appStoreExpiresAt || data.premiumExpiresAt || null);
    const productId = String(data.appStoreProductId || data.premiumProductId || '').trim();
    const explicitPremium = typeof data.isPremium === 'boolean' ? data.isPremium : null;
    const hasPremiumIndicators = explicitPremium !== null || !!status || !!expiresAt || !!productId;
    const expiredStatuses = new Set(['expired', 'refunded', 'revoked', 'billing_retry']);
    const expiredByDate = !!expiresAt && expiresAt.getTime() <= Date.now();
    const isExpired = expiredByDate || expiredStatuses.has(status);
    const allowLocalFallback = options.allowLocalFallback === true
        && !hasPremiumIndicators
        && options.localPremium === true;
    const isActive = !isExpired && (explicitPremium === true || status === 'active' || allowLocalFallback);
    const isPartner = source === 'partner';
    const expiresLabel = expiresAt ? formatPremiumMembershipDate(expiresAt) : '';
    const activeLabel = '👑 プレミアム：有効';
    const partnerActiveLabel = '👑 プレミアム：有効';

    let label = '👑 プレミアム：未登録';
    let detail = isPartner
        ? '連携中のパートナーのプレミアム状態を表示します。'
        : 'このアカウントのプレミアム状態を表示します。';

    if (isActive) {
        if (isPartner) {
            label = expiresAt && !expiredByDate
                ? `${partnerActiveLabel}\nパートナー特典・${expiresLabel}まで`
                : `${partnerActiveLabel}\nパートナー特典`;
        } else {
            label = expiresAt && !expiredByDate
                ? `${activeLabel}\n${expiresLabel}まで有効`
                : activeLabel;
        }
        detail = isPartner
            ? (expiresAt && !expiredByDate
                ? `連携中のパートナーのプレミアムモードは${expiresLabel}まで有効です。`
                : '連携中のパートナーのプレミアムモードは有効です。')
            : (expiresAt && !expiredByDate
                ? `このアカウントのプレミアムモードは${expiresLabel}まで有効です。`
                : 'このアカウントのプレミアムモードは有効です。');
    } else if (isExpired) {
        label = '👑 プレミアム：期限切れ';
        detail = expiresAt
            ? `有効期限は${expiresLabel}で終了しました。`
            : 'プレミアムの有効期限は切れています。';
    }

    return {
        source,
        active: isActive,
        expired: isExpired,
        hasPremiumIndicators,
        title: label,
        label,
        detail,
        expiresAt,
        status,
        productId
    };
}

window.formatPremiumMembershipDate = formatPremiumMembershipDate;
window.getConnectedPartnerPremiumSnapshot = getConnectedPartnerPremiumSnapshot;
window.getConnectedPremiumPartnerSnapshot = getConnectedPremiumPartnerSnapshot;
window.buildPremiumMembershipState = buildPremiumMembershipState;

function renderPremiumLabelMarkup(label) {
    const lines = String(label || '').split('\n').map((line) => line.trim()).filter(Boolean);
    if (!lines.length) {
        return '';
    }

    if (lines.length === 1) {
        return `<span class="block text-[11px] font-black leading-tight">${escapePremiumHtml(lines[0])}</span>`;
    }

    return `
        <span class="block text-[11px] font-black leading-tight">${escapePremiumHtml(lines[0])}</span>
        <span class="mt-0.5 block text-[9px] font-medium leading-tight text-[#8b7e66]">${escapePremiumHtml(lines.slice(1).join(' '))}</span>
    `;
}

PremiumManager.isPremium = function () {
    const state = this.getMembershipState();
    return !!(state && state.active);
};

PremiumManager.getMembershipState = function () {
    const selfState = buildPremiumMembershipState({
        isPremium: this._remotePremium,
        subscriptionStatus: this._remoteStatus,
        appStoreExpiresAt: this._remoteExpiresAt,
        premiumExpiresAt: this._remoteExpiresAt,
        appStoreProductId: this._remoteProductId,
        premiumProductId: this._remoteProductId
    }, 'self', {
        localPremium: typeof this.getLocalPremiumState === 'function' ? this.getLocalPremiumState() : false,
        allowLocalFallback: true
    });

    const partnerSnapshot = getConnectedPartnerPremiumSnapshot();
    const partnerState = partnerSnapshot
        ? buildPremiumMembershipState(partnerSnapshot, 'partner', { allowLocalFallback: false })
        : null;

    if (partnerState && partnerState.active) return partnerState;
    if (selfState.active) return selfState;
    if (selfState.expired) return selfState;
    if (partnerState && partnerState.expired) return partnerState;
    if (partnerState && partnerState.hasPremiumIndicators) return partnerState;
    if (selfState.hasPremiumIndicators) return selfState;

    return buildPremiumMembershipState({}, 'self', { allowLocalFallback: false });
};

PremiumManager.getDrawerStatusLabel = function () {
    return this.getMembershipState().label;
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

function formatPremiumMembershipDate(date) {
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}

function getConnectedPartnerPremiumSnapshot() {
    if (typeof MeimayShare === 'undefined' || !MeimayShare) {
        return null;
    }
    if (typeof MeimayShare.getConnectedPremiumSnapshot === 'function') {
        const premiumSnapshot = MeimayShare.getConnectedPremiumSnapshot();
        if (premiumSnapshot) return premiumSnapshot;
    }
    if (MeimayShare.partnerUserSnapshot) {
        return MeimayShare.partnerUserSnapshot;
    }
    if (MeimayShare.partnerSnapshot && MeimayShare.partnerSnapshot.premiumState) {
        return MeimayShare.partnerSnapshot.premiumState;
    }
    return null;
}

function getConnectedPremiumPartnerSnapshot() {
    return getConnectedPartnerPremiumSnapshot();
}

function buildPremiumMembershipState(record, source, options = {}) {
    const data = record || {};
    const status = String(data.subscriptionStatus || data.premiumStatus || '').trim().toLowerCase();
    const expiresAt = normalizePremiumDate(data.appStoreExpiresAt || data.premiumExpiresAt || null);
    const productId = String(data.appStoreProductId || data.premiumProductId || '').trim();
    const explicitPremium = typeof data.isPremium === 'boolean' ? data.isPremium : null;
    const hasPremiumIndicators = explicitPremium !== null || !!status || !!expiresAt || !!productId;
    const expiredStatuses = new Set(['expired', 'refunded', 'revoked', 'billing_retry']);
    const expiredByDate = !!expiresAt && expiresAt.getTime() <= Date.now();
    const isExpired = expiredByDate || expiredStatuses.has(status);
    const allowLocalFallback = options.allowLocalFallback === true
        && !hasPremiumIndicators
        && options.localPremium === true;
    const isActive = !isExpired && (explicitPremium === true || status === 'active' || allowLocalFallback);
    const isPartner = source === 'partner';
    const expiresLabel = expiresAt ? formatPremiumMembershipDate(expiresAt) : '';
    const activeLabel = '👑 プレミアム：有効';
    const partnerActiveLabel = '👑 プレミアム：有効';

    let label = '👑 プレミアム：未登録';
    let detail = isPartner
        ? '連携中のパートナーのプレミアム状態を表示します。'
        : 'このアカウントのプレミアム状態を表示します。';

    if (isActive) {
        if (isPartner) {
            label = expiresAt && !expiredByDate
                ? `${partnerActiveLabel}\nパートナー特典・${expiresLabel}まで`
                : `${partnerActiveLabel}\nパートナー特典`;
        } else {
            label = expiresAt && !expiredByDate
                ? `${activeLabel}\n${expiresLabel}まで有効`
                : activeLabel;
        }
        detail = isPartner
            ? (expiresAt && !expiredByDate
                ? `連携中のパートナーのプレミアムモードは${expiresLabel}まで有効です。`
                : '連携中のパートナーのプレミアムモードは有効です。')
            : (expiresAt && !expiredByDate
                ? `このアカウントのプレミアムモードは${expiresLabel}まで有効です。`
                : 'このアカウントのプレミアムモードは有効です。');
    } else if (isExpired) {
        label = '👑 プレミアム：期限切れ';
        detail = expiresAt
            ? `有効期限は${expiresLabel}で終了しました。`
            : 'プレミアムの有効期限は切れています。';
    }

    return {
        source,
        active: isActive,
        expired: isExpired,
        hasPremiumIndicators,
        title: label,
        label,
        detail,
        expiresAt,
        status,
        productId
    };
}

window.formatPremiumMembershipDate = formatPremiumMembershipDate;
window.getConnectedPartnerPremiumSnapshot = getConnectedPartnerPremiumSnapshot;
window.getConnectedPremiumPartnerSnapshot = getConnectedPremiumPartnerSnapshot;
window.buildPremiumMembershipState = buildPremiumMembershipState;

PremiumManager.isPremium = function () {
    const state = this.getMembershipState();
    return !!(state && state.active);
};

PremiumManager.getMembershipState = function () {
    const selfState = buildPremiumMembershipState({
        isPremium: this._remotePremium,
        subscriptionStatus: this._remoteStatus,
        appStoreExpiresAt: this._remoteExpiresAt,
        premiumExpiresAt: this._remoteExpiresAt,
        appStoreProductId: this._remoteProductId,
        premiumProductId: this._remoteProductId
    }, 'self', {
        localPremium: typeof this.getLocalPremiumState === 'function' ? this.getLocalPremiumState() : false,
        allowLocalFallback: true
    });

    const partnerSnapshot = getConnectedPartnerPremiumSnapshot();
    const partnerState = partnerSnapshot
        ? buildPremiumMembershipState(partnerSnapshot, 'partner', { allowLocalFallback: false })
        : null;

    if (partnerState && partnerState.active) return partnerState;
    if (selfState.active) return selfState;
    if (selfState.expired) return selfState;
    if (partnerState && partnerState.expired) return partnerState;
    if (partnerState && partnerState.hasPremiumIndicators) return partnerState;
    if (selfState.hasPremiumIndicators) return selfState;

    return buildPremiumMembershipState({}, 'self', { allowLocalFallback: false });
};

PremiumManager.getDrawerStatusLabel = function () {
    return this.getMembershipState().label;
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

function buildPremiumMembershipState(record, source, options = {}) {
    const data = record || {};
    const status = normalizePremiumStatus(data.subscriptionStatus || data.premiumStatus || '');
    const expiresAt = normalizePremiumDate(data.appStoreExpiresAt || data.premiumExpiresAt || null);
    const productId = String(data.appStoreProductId || data.premiumProductId || '').trim();
    const explicitPremium = typeof data.isPremium === 'boolean' ? data.isPremium : null;
    const hasPremiumIndicators = explicitPremium !== null || !!status || !!expiresAt || !!productId;
    const expiredStatuses = new Set(['expired', 'refunded', 'revoked', 'billing_retry']);
    const expiredByDate = !!expiresAt && expiresAt.getTime() <= Date.now();
    const isExpired = expiredByDate || expiredStatuses.has(status);
    const allowLocalFallback = options.allowLocalFallback === true
        && !hasPremiumIndicators
        && options.localPremium === true;
    const isActive = !isExpired && (explicitPremium === true || status === 'active' || allowLocalFallback);
    const isPartner = source === 'partner';
    const activeLabel = isPartner
        ? '👑プレミアムモード：有効（パートナー特典）'
        : '👑プレミアムモード：有効';
    const unregisteredLabel = '👑プレミアムモード：未登録';
    const expiredLabel = '👑プレミアムモード：期限切れ';
    const expiresLabel = expiresAt ? formatPremiumMembershipDate(expiresAt) : '';

    let label = unregisteredLabel;
    let detail = isPartner
        ? 'パートナーのプレミアム特典はありません。'
        : 'このアカウントにプレミアム登録がありません。';

    if (isActive) {
        label = expiresAt && !expiredByDate
            ? `${activeLabel}\n${expiresLabel}まで有効`
            : activeLabel;
        detail = isPartner
            ? (expiresAt && !expiredByDate
                ? `パートナーのプレミアム特典は${expiresLabel}まで有効です。`
                : 'パートナーのプレミアム特典が有効です。')
            : (expiresAt && !expiredByDate
                ? `このアカウントのプレミアムは${expiresLabel}まで有効です。`
                : 'このアカウントのプレミアムが有効です。');
    } else if (isExpired) {
        label = expiredLabel;
        detail = expiresAt && expiredByDate
            ? `有効期限は${expiresLabel}で切れています。`
            : '有効期限が切れています。';
    }

    return {
        source,
        active: isActive,
        expired: isExpired,
        hasPremiumIndicators,
        title: label,
        label,
        detail,
        expiresAt,
        status,
        productId
    };
}

PremiumManager.getMembershipState = function () {
    const selfState = buildPremiumMembershipState({
        isPremium: this._remotePremium,
        subscriptionStatus: this._remoteStatus,
        appStoreExpiresAt: this._remoteExpiresAt,
        premiumExpiresAt: this._remoteExpiresAt,
        appStoreProductId: this._remoteProductId,
        premiumProductId: this._remoteProductId
    }, 'self', {
        localPremium: typeof this.getLocalPremiumState === 'function' ? this.getLocalPremiumState() : false,
        allowLocalFallback: true
    });

    const partnerSnapshot = getConnectedPremiumPartnerSnapshot();
    const partnerState = partnerSnapshot
        ? buildPremiumMembershipState(partnerSnapshot, 'partner', { allowLocalFallback: false })
        : null;

    if (partnerState && partnerState.active) return partnerState;
    if (selfState.active) return selfState;
    if (partnerState && partnerState.expired) return partnerState;
    if (selfState.expired) return selfState;
    if (partnerState && partnerState.hasPremiumIndicators) return partnerState;
    if (selfState.hasPremiumIndicators) return selfState;

    return buildPremiumMembershipState({}, 'self', { allowLocalFallback: false });
};

PremiumManager.getDrawerStatusLabel = function () {
    return this.getMembershipState().label;
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

window.PremiumManager = PremiumManager;
window.showPremiumModal = showPremiumModal;

// Final premium overrides with partner priority
PremiumManager.getMembershipState = function () {
    const selfState = buildPremiumMembershipState({
        isPremium: this._remotePremium,
        subscriptionStatus: this._remoteStatus,
        appStoreExpiresAt: this._remoteExpiresAt,
        premiumExpiresAt: this._remoteExpiresAt,
        appStoreProductId: this._remoteProductId,
        premiumProductId: this._remoteProductId
    }, 'self', {
        localPremium: typeof this.getLocalPremiumState === 'function' ? this.getLocalPremiumState() : false,
        allowLocalFallback: true
    });

    const partnerSnapshot = getConnectedPremiumPartnerSnapshot();
    const partnerState = partnerSnapshot
        ? buildPremiumMembershipState(partnerSnapshot, 'partner', { allowLocalFallback: false })
        : null;

    if (partnerState && partnerState.active) return partnerState;
    if (selfState.active) return selfState;
    if (selfState.expired) return selfState;
    if (partnerState && partnerState.expired) return partnerState;
    if (partnerState && partnerState.hasPremiumIndicators) return partnerState;
    if (selfState.hasPremiumIndicators) return selfState;

    return buildPremiumMembershipState({}, 'self', { allowLocalFallback: false });
};

PremiumManager.getDrawerStatusLabel = function () {
    return this.getMembershipState().label;
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

function showPremiumModal() {
    const modal = document.getElementById('modal-ai-sound');
    if (!modal) return;

    const state = PremiumManager.getMembershipState();
    const partnerSnapshot = getConnectedPremiumPartnerSnapshot();
    const partnerState = partnerSnapshot
        ? buildPremiumMembershipState(partnerSnapshot, 'partner', { allowLocalFallback: false })
        : null;
    const partnerActive = !!(partnerState && partnerState.active);
    const canDeactivate = !!state.active && state.source === 'self' && !partnerActive;

    modal.classList.add('active');
    modal.innerHTML = `
        <div class="detail-sheet max-w-md" onclick="event.stopPropagation()">
            <button class="modal-close-btn" onclick="closePremiumModal()">×</button>
            <div class="text-center py-6">
                <div class="text-[10px] font-black text-[#bca37f] mb-4 tracking-widest uppercase">Premium Plan</div>
                <div class="text-4xl mb-4">👑</div>
                <h3 class="text-lg font-black text-[#5d5444] mb-2">プレミアムモード</h3>
                <p class="text-xs text-[#a6967a] mb-4">プレミアム会員の状態を確認できます。</p>

                <div class="mb-6 rounded-2xl border border-[#eee5d8] bg-[#fff9f0] px-4 py-3 text-left">
                    <div class="text-[#5d5444]">${renderPremiumLabelMarkup(state.label)}</div>
                    <div class="mt-1 text-[11px] leading-relaxed text-[#8b7e66]">${escapePremiumHtml(state.detail)}</div>
                </div>

                ${state.active ? `
                    <div class="bg-[#f0fdf4] border border-green-200 rounded-2xl p-4 mb-6 text-left">
                        <p class="text-sm font-bold text-green-700">${escapePremiumHtml(
                            state.source === 'partner'
                                ? '連携中のパートナーのプレミアムモードを利用しています。'
                                : (partnerActive
                                    ? 'あなたのプレミアムモードは有効で、連携中のパートナーも利用中です。'
                                    : 'あなたのアカウントのプレミアムモードを利用しています。')
                        )}</p>
                    </div>
                    ${canDeactivate ? `
                        <button onclick="PremiumManager.deactivate();closePremiumModal()" class="w-full py-3 bg-[#fef2f2] text-[#f28b82] rounded-2xl font-bold text-sm">
                            プレミアムを解除
                        </button>
                    ` : `
                        <button onclick="closePremiumModal()" class="w-full py-3 bg-gradient-to-r from-[#bca37f] to-[#8b7e66] text-white rounded-2xl font-bold text-sm shadow-md">
                            閉じる
                        </button>
                    `}
                ` : `
                    <div class="space-y-3 mb-6 text-left px-4">
                        <div class="flex items-center gap-3">
                            <span class="text-lg">✨</span>
                            <span class="text-sm text-[#5d5444]">名前カードの表示を強化します</span>
                        </div>
                        <div class="flex items-center gap-3">
                            <span class="text-lg">✨</span>
                            <span class="text-sm text-[#5d5444]">保存や検索の体験を快適にします</span>
                        </div>
                        <div class="flex items-center gap-3">
                            <span class="text-lg">✨</span>
                            <span class="text-sm text-[#5d5444]">プレミアムの状態はここで確認できます</span>
                        </div>
                    </div>
                    <button onclick="PremiumManager.activate();closePremiumModal()" class="w-full py-4 bg-gradient-to-r from-[#bca37f] to-[#8b7e66] text-white rounded-2xl font-bold text-sm shadow-md">
                        プレミアムモードを有効にする
                    </button>
                    <button onclick="PremiumManager.refreshPurchaseState()" class="mt-3 w-full py-3 rounded-2xl border border-[#eadfce] bg-white text-[#8b7e66] font-bold text-sm">
                        購入状態を更新
                    </button>
                    <p class="text-[9px] text-[#a6967a] mt-3">現在は試験的な案内表示です。購入後の反映に少し時間がかかる場合があります。</p>
                `}
            </div>
        </div>
    `;
}

window.PremiumManager = PremiumManager;
window.showPremiumModal = showPremiumModal;
// Final premium overrides
PremiumManager.getMembershipState = function () {
    const selfState = buildPremiumMembershipState({
        isPremium: this._remotePremium,
        subscriptionStatus: this._remoteStatus,
        appStoreExpiresAt: this._remoteExpiresAt,
        premiumExpiresAt: this._remoteExpiresAt,
        appStoreProductId: this._remoteProductId,
        premiumProductId: this._remoteProductId
    }, 'self', {
        localPremium: typeof this.getLocalPremiumState === 'function' ? this.getLocalPremiumState() : false,
        allowLocalFallback: true
    });

    const partnerSnapshot = getConnectedPartnerPremiumSnapshot();
    const partnerState = partnerSnapshot
        ? buildPremiumMembershipState(partnerSnapshot, 'partner', { allowLocalFallback: false })
        : null;

    if (partnerState && partnerState.active) return partnerState;
    if (selfState.active) return selfState;
    if (selfState.expired) return selfState;
    if (partnerState && partnerState.expired) return partnerState;
    if (partnerState && partnerState.hasPremiumIndicators) return partnerState;
    if (selfState.hasPremiumIndicators) return selfState;

    return buildPremiumMembershipState({}, 'self', { allowLocalFallback: false });
};

PremiumManager.getDrawerStatusLabel = function () {
    return this.getMembershipState().label;
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
            showToast('購入状態の確認にはログインが必要です', 'ℹ');
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
            showToast(this.isPremium() ? '購入状態を更新しました' : '現在の購入状態を確認しました', this.isPremium() ? '✓' : 'ℹ');
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

function renderPremiumComparisonMatrix() {
    const rows = [
        ['使える漢字', '常用漢字のみ', '常用漢字 + 人名用漢字'],
        ['広告', 'あり', 'なし'],
        ['読みスワイプ', '1日100回まで', '無制限'],
        ['漢字スワイプ', '1日100回まで', '無制限'],
        ['AI漢字深掘り', '1日1回まで', '無制限']
    ];

    return `
        <div class="overflow-x-auto">
            <div class="min-w-[620px] overflow-hidden rounded-[28px] border border-[#e8dfd4] bg-white">
                <div class="grid grid-cols-[1.35fr_1fr_1fr] border-b border-[#e8dfd4] px-5 py-4 text-[17px] sm:text-[19px] font-black text-[#161310]">
                    <div>項目</div>
                    <div class="text-center">無料</div>
                    <div class="text-center">プレミアム</div>
                </div>
                <div class="divide-y divide-[#eee7dd]">
                    ${rows.map(([item, free, premium]) => `
                        <div class="grid grid-cols-[1.35fr_1fr_1fr] items-center px-5 py-5 sm:py-6 text-[13px] sm:text-[18px] text-[#1f1a14]">
                            <div class="pr-4 font-medium leading-snug">${escapePremiumHtml(item)}</div>
                            <div class="px-2 text-center leading-snug">${escapePremiumHtml(free)}</div>
                            <div class="px-2 text-center leading-snug">${escapePremiumHtml(premium)}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;
}

function showPremiumModal() {
    const modal = document.getElementById('modal-ai-sound');
    if (!modal) return;

    const state = PremiumManager.getMembershipState();

    modal.classList.add('active');
    modal.innerHTML = `
        <div class="detail-sheet max-w-none" style="max-width:min(94vw, 980px); padding: clamp(24px, 3.5vw, 36px);" onclick="event.stopPropagation()">
            <button class="modal-close-btn" onclick="closePremiumModal()">×</button>
            <div class="pr-12 sm:pr-16">
                <div class="text-[10px] font-black text-[#bca37f] mb-2 tracking-[0.35em] uppercase">Premium Plan</div>
                <h3 class="text-2xl sm:text-[2rem] font-black text-[#5d5444] mb-3">プレミアム案内</h3>
                <p class="text-sm sm:text-[15px] leading-7 text-[#8b7e66]">無料とプレミアムの違いをひと目で確認できます。</p>
            </div>

            <div class="mt-6 sm:mt-8">
                ${renderPremiumComparisonMatrix()}
            </div>

            <div class="mt-8 rounded-[28px] border border-[#e8dfd4] bg-[#faf7f1] px-5 sm:px-6 py-5 sm:py-6">
                <div class="text-[17px] sm:text-[22px] font-black text-[#161310] mb-3">パートナー特典</div>
                <p class="text-[13px] sm:text-[16px] leading-7 text-[#3f3527]">どちらか1人がプレミアムに加入すると、連携中の相手もプレミアム機能を利用できます。</p>
            </div>

            <div class="mt-8 flex flex-col sm:flex-row gap-3">
                ${state.active ? `
                    <button onclick="closePremiumModal()" class="w-full py-3 bg-gradient-to-r from-[#bca37f] to-[#8b7e66] text-white rounded-2xl font-bold text-sm shadow-md">
                        閉じる
                    </button>
                ` : `
                    <button onclick="PremiumManager.activate();closePremiumModal()" class="w-full py-4 bg-gradient-to-r from-[#bca37f] to-[#8b7e66] text-white rounded-2xl font-bold text-sm shadow-md">
                        プレミアムを有効にする
                    </button>
                `}
                <button onclick="PremiumManager.refreshPurchaseState()" class="w-full py-3 rounded-2xl border border-[#eadfce] bg-white text-[#8b7e66] font-bold text-sm">
                    購入状態を更新
                </button>
            </div>

            <p class="mt-3 text-[9px] text-[#a6967a]">購入後の反映に少し時間がかかる場合があります。</p>
            </div>
        </div>
    `;
}

window.PremiumManager = PremiumManager;
window.showPremiumModal = showPremiumModal;

PremiumManager.getMembershipState = function () {
    const selfState = buildPremiumMembershipState({
        isPremium: this._remotePremium,
        subscriptionStatus: this._remoteStatus,
        appStoreExpiresAt: this._remoteExpiresAt,
        premiumExpiresAt: this._remoteExpiresAt,
        appStoreProductId: this._remoteProductId,
        premiumProductId: this._remoteProductId
    }, 'self', {
        localPremium: typeof this.getLocalPremiumState === 'function' ? this.getLocalPremiumState() : false,
        allowLocalFallback: true
    });

    const partnerSnapshot = getConnectedPartnerPremiumSnapshot();
    const partnerState = partnerSnapshot
        ? buildPremiumMembershipState(partnerSnapshot, 'partner', { allowLocalFallback: false })
        : null;

    if (partnerState && partnerState.active) return partnerState;
    if (selfState.active) return selfState;
    if (selfState.expired) return selfState;
    if (partnerState && partnerState.expired) return partnerState;
    if (partnerState && partnerState.hasPremiumIndicators) return partnerState;
    if (selfState.hasPremiumIndicators) return selfState;

    return buildPremiumMembershipState({}, 'self', { allowLocalFallback: false });
};

PremiumManager.getDrawerStatusLabel = function () {
    return this.getMembershipState().label;
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

function showPremiumModal() {
    const modal = document.getElementById('modal-ai-sound');
    if (!modal) return;

    const state = typeof PremiumManager !== 'undefined' && typeof PremiumManager.getMembershipState === 'function'
        ? PremiumManager.getMembershipState()
        : buildPremiumMembershipState({}, 'self', { allowLocalFallback: false });
    const partnerSnapshot = getConnectedPartnerPremiumSnapshot();
    const partnerState = partnerSnapshot
        ? buildPremiumMembershipState(partnerSnapshot, 'partner', { allowLocalFallback: false })
        : null;
    const partnerActive = !!(partnerState && partnerState.active);
    const canDeactivate = !!state.active && state.source === 'self' && !partnerActive;

    modal.classList.add('active');
    modal.innerHTML = `
        <div class="detail-sheet max-w-md" onclick="event.stopPropagation()">
            <button class="modal-close-btn" onclick="closePremiumModal()">×</button>
            <div class="text-center py-6">
                <div class="text-[10px] font-black text-[#bca37f] mb-4 tracking-widest uppercase">Premium Plan</div>
                <div class="text-4xl mb-4">👑</div>
                <h3 class="text-lg font-black text-[#5d5444] mb-2">プレミアムモード</h3>
                <p class="text-xs text-[#a6967a] mb-4">プレミアム会員の状態を確認できます。</p>

                <div class="mb-6 rounded-2xl border border-[#eee5d8] bg-[#fff9f0] px-4 py-3 text-left">
                    <div class="text-[#5d5444]">${renderPremiumLabelMarkup(state.label)}</div>
                    <div class="mt-1 text-[11px] leading-relaxed text-[#8b7e66]">${escapePremiumHtml(state.detail)}</div>
                </div>

                ${state.active ? `
                    <div class="bg-[#f0fdf4] border border-green-200 rounded-2xl p-4 mb-6 text-left">
                        <p class="text-sm font-bold text-green-700">${escapePremiumHtml(
                            state.source === 'partner'
                                ? '連携中のパートナーのプレミアムモードを利用しています。'
                                : (partnerActive
                                    ? 'あなたのプレミアムモードは有効で、連携中のパートナーも利用中です。'
                                    : 'あなたのアカウントのプレミアムモードを利用しています。')
                        )}</p>
                    </div>
                    ${canDeactivate ? `
                        <button onclick="PremiumManager.deactivate();closePremiumModal()" class="w-full py-3 bg-[#fef2f2] text-[#f28b82] rounded-2xl font-bold text-sm">
                            プレミアムを解除
                        </button>
                    ` : `
                        <button onclick="closePremiumModal()" class="w-full py-3 bg-gradient-to-r from-[#bca37f] to-[#8b7e66] text-white rounded-2xl font-bold text-sm shadow-md">
                            閉じる
                        </button>
                    `}
                ` : `
                    <div class="space-y-3 mb-6 text-left px-4">
                        <div class="flex items-center gap-3">
                            <span class="text-lg">✨</span>
                            <span class="text-sm text-[#5d5444]">名前カードの表示を強化します</span>
                        </div>
                        <div class="flex items-center gap-3">
                            <span class="text-lg">✨</span>
                            <span class="text-sm text-[#5d5444]">保存や検索の体験を快適にします</span>
                        </div>
                        <div class="flex items-center gap-3">
                            <span class="text-lg">✨</span>
                            <span class="text-sm text-[#5d5444]">プレミアムの状態はここで確認できます</span>
                        </div>
                    </div>
                    <button onclick="PremiumManager.activate();closePremiumModal()" class="w-full py-4 bg-gradient-to-r from-[#bca37f] to-[#8b7e66] text-white rounded-2xl font-bold text-sm shadow-md">
                        プレミアムモードを有効にする
                    </button>
                    <button onclick="PremiumManager.refreshPurchaseState()" class="mt-3 w-full py-3 rounded-2xl border border-[#eadfce] bg-white text-[#8b7e66] font-bold text-sm">
                        購入状態を更新
                    </button>
                    <p class="text-[9px] text-[#a6967a] mt-3">現在は試験的な案内表示です。購入後の反映に少し時間がかかる場合があります。</p>
                `}
            </div>
        </div>
    `;
}

window.PremiumManager = PremiumManager;
window.showPremiumModal = showPremiumModal;

function formatPremiumMembershipDate(date) {
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
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

function buildPremiumMembershipState(record, source, options = {}) {
    const data = record || {};
    const status = String(data.subscriptionStatus || data.premiumStatus || '').trim().toLowerCase();
    const expiresAt = normalizePremiumDate(data.appStoreExpiresAt || data.premiumExpiresAt || null);
    const productId = String(data.appStoreProductId || data.premiumProductId || '').trim();
    const explicitPremium = typeof data.isPremium === 'boolean' ? data.isPremium : null;
    const hasPremiumIndicators = explicitPremium !== null || !!status || !!expiresAt || !!productId;
    const expiredStatuses = new Set(['expired', 'refunded', 'revoked', 'billing_retry']);
    const expiredByDate = !!expiresAt && expiresAt.getTime() <= Date.now();
    const isExpired = expiredByDate || expiredStatuses.has(status);
    const allowLocalFallback = options.allowLocalFallback === true
        && !hasPremiumIndicators
        && options.localPremium === true;
    const isActive = !isExpired && (explicitPremium === true || status === 'active' || allowLocalFallback);
    const displayTitle = source === 'partner' ? '👑プレミアムモード（パートナー）' : '👑プレミアムモード';
    const expiresLabel = expiresAt ? formatPremiumMembershipDate(expiresAt) : '';

    let label = '👑プレミアムモード：未登録';
    let detail = source === 'partner'
        ? '連携中のパートナーのプレミアム状態を確認します。'
        : 'このアカウントのプレミアム状態を確認します。';

    if (isActive) {
        label = expiresAt && !expiredByDate
            ? `${displayTitle}\n(${expiresLabel}まで有効)`
            : displayTitle;
        detail = source === 'partner'
            ? (expiresAt && !expiredByDate
                ? `連携中はパートナーのプレミアムモードを${expiresLabel}まで利用できます。`
                : '連携中はパートナーのプレミアムモードを利用しています。')
            : (expiresAt && !expiredByDate
                ? `このアカウントのプレミアムモードは${expiresLabel}まで有効です。`
                : 'このアカウントのプレミアムモードを利用しています。');
    } else if (isExpired) {
        label = '👑プレミアムモード：期限切れ';
        detail = expiresAt
            ? `有効期限は${expiresLabel}で終了しました。`
            : 'プレミアムモードの有効期限が切れています。';
    }

    return {
        source,
        active: isActive,
        expired: isExpired,
        hasPremiumIndicators,
        title: label,
        label,
        detail,
        expiresAt,
        status,
        productId
    };
}

PremiumManager.isPremium = function () {
    const state = this.getMembershipState();
    return !!(state && state.active);
};

PremiumManager.getMembershipState = function () {
    const selfState = buildPremiumMembershipState({
        isPremium: this._remotePremium,
        subscriptionStatus: this._remoteStatus,
        appStoreExpiresAt: this._remoteExpiresAt,
        premiumExpiresAt: this._remoteExpiresAt,
        appStoreProductId: this._remoteProductId,
        premiumProductId: this._remoteProductId
    }, 'self', {
        localPremium: typeof this.getLocalPremiumState === 'function' ? this.getLocalPremiumState() : false,
        allowLocalFallback: true
    });

    const partnerSnapshot = getConnectedPartnerPremiumSnapshot();
    const partnerState = partnerSnapshot
        ? buildPremiumMembershipState(partnerSnapshot, 'partner', { allowLocalFallback: false })
        : null;

    if (partnerState && partnerState.active) return partnerState;
    if (selfState.active) return selfState;
    if (selfState.expired) return selfState;
    if (partnerState && partnerState.expired) return partnerState;
    if (partnerState && partnerState.hasPremiumIndicators) return partnerState;
    if (selfState.hasPremiumIndicators) return selfState;

    return buildPremiumMembershipState({}, 'self', { allowLocalFallback: false });
};

PremiumManager.getDrawerStatusLabel = function () {
    return this.getMembershipState().label;
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

function showPremiumModal() {
    const modal = document.getElementById('modal-ai-sound');
    if (!modal) return;

    const state = typeof PremiumManager !== 'undefined' && typeof PremiumManager.getMembershipState === 'function'
        ? PremiumManager.getMembershipState()
        : buildPremiumMembershipState({}, 'self', { allowLocalFallback: false });
    const partnerSnapshot = getConnectedPartnerPremiumSnapshot();
    const partnerState = partnerSnapshot
        ? buildPremiumMembershipState(partnerSnapshot, 'partner', { allowLocalFallback: false })
        : null;
    const partnerActive = !!(partnerState && partnerState.active);
    const canDeactivate = !!state.active && state.source === 'self' && !partnerActive;

    modal.classList.add('active');
    modal.innerHTML = `
        <div class="detail-sheet max-w-md" onclick="event.stopPropagation()">
            <button class="modal-close-btn" onclick="closePremiumModal()">×</button>
            <div class="text-center py-6">
                <div class="text-[10px] font-black text-[#bca37f] mb-4 tracking-widest uppercase">Premium Plan</div>
                <div class="text-4xl mb-4">👑</div>
                <h3 class="text-lg font-black text-[#5d5444] mb-2">プレミアムモード</h3>
                <p class="text-xs text-[#a6967a] mb-4">プレミアム会員の状態を確認できます。</p>

                <div class="mb-6 rounded-2xl border border-[#eee5d8] bg-[#fff9f0] px-4 py-3 text-left">
                    <div class="text-[#5d5444]">${renderPremiumLabelMarkup(state.label)}</div>
                    <div class="mt-1 text-[11px] leading-relaxed text-[#8b7e66]">${escapePremiumHtml(state.detail)}</div>
                </div>

                ${state.active ? `
                    <div class="bg-[#f0fdf4] border border-green-200 rounded-2xl p-4 mb-6 text-left">
                        <p class="text-sm font-bold text-green-700">${escapePremiumHtml(
                            state.source === 'partner'
                                ? '連携中のパートナーのプレミアムモードを利用しています。'
                                : (partnerActive
                                    ? 'あなたのプレミアムモードは有効で、連携中のパートナーも利用中です。'
                                    : 'あなたのアカウントのプレミアムモードを利用しています。')
                        )}</p>
                    </div>
                    ${canDeactivate ? `
                        <button onclick="PremiumManager.deactivate();closePremiumModal()" class="w-full py-3 bg-[#fef2f2] text-[#f28b82] rounded-2xl font-bold text-sm">
                            プレミアムを解除
                        </button>
                    ` : `
                        <button onclick="closePremiumModal()" class="w-full py-3 bg-gradient-to-r from-[#bca37f] to-[#8b7e66] text-white rounded-2xl font-bold text-sm shadow-md">
                            閉じる
                        </button>
                    `}
                ` : `
                    <div class="space-y-3 mb-6 text-left px-4">
                        <div class="flex items-center gap-3">
                            <span class="text-lg">✨</span>
                            <span class="text-sm text-[#5d5444]">名前カードの表示を強化します</span>
                        </div>
                        <div class="flex items-center gap-3">
                            <span class="text-lg">✨</span>
                            <span class="text-sm text-[#5d5444]">保存や検索の体験を快適にします</span>
                        </div>
                        <div class="flex items-center gap-3">
                            <span class="text-lg">✨</span>
                            <span class="text-sm text-[#5d5444]">プレミアムの状態はここで確認できます</span>
                        </div>
                    </div>
                    <button onclick="PremiumManager.activate();closePremiumModal()" class="w-full py-4 bg-gradient-to-r from-[#bca37f] to-[#8b7e66] text-white rounded-2xl font-bold text-sm shadow-md">
                        プレミアムモードを有効にする
                    </button>
                    <button onclick="PremiumManager.refreshPurchaseState()" class="mt-3 w-full py-3 rounded-2xl border border-[#eadfce] bg-white text-[#8b7e66] font-bold text-sm">
                        購入状態を更新
                    </button>
                    <p class="text-[9px] text-[#a6967a] mt-3">現在は試験的な案内表示です。購入後の反映に少し時間がかかる場合があります。</p>
                `}
            </div>
        </div>
    `;
}

window.PremiumManager = PremiumManager;
window.showPremiumModal = showPremiumModal;

PremiumManager.isPremium = function () {
    if (typeof this.getMembershipState === 'function') {
        const state = this.getMembershipState();
        return !!(state && state.active);
    }
    return this.getLocalPremiumState();
};

PremiumManager.getMembershipState = function () {
    const selfState = buildPremiumStateFromRecord({
        isPremium: this._remotePremium,
        subscriptionStatus: this._remoteStatus,
        appStoreExpiresAt: this._remoteExpiresAt,
        premiumExpiresAt: this._remoteExpiresAt,
        appStoreProductId: this._remoteProductId,
        premiumProductId: this._remoteProductId
    }, 'self', {
        localPremium: this.getLocalPremiumState(),
        allowLocalFallback: true
    });

    const partnerSnapshot = getConnectedPremiumPartnerSnapshot();
    const partnerState = partnerSnapshot
        ? buildPremiumStateFromRecord(partnerSnapshot, 'partner', { allowLocalFallback: false })
        : null;

    if (selfState.active) return selfState;
    if (partnerState && partnerState.active) return partnerState;
    if (selfState.expired) return selfState;
    if (partnerState && partnerState.expired) return partnerState;
    if (partnerState && partnerState.hasPremiumIndicators) return partnerState;
    if (selfState.hasPremiumIndicators) return selfState;

    return {
        source: 'self',
        active: false,
        expired: false,
        hasPremiumIndicators: false,
        title: '👑プレミアムモード：未登録',
        label: '👑プレミアムモード：未登録',
        detail: 'このアカウントにプレミアム登録がありません。',
        expiresAt: null,
        status: '',
        productId: ''
    };
};

PremiumManager.getDrawerStatusLabel = function () {
    return this.getMembershipState().label;
};

PremiumManager.getStatusSummary = function () {
    const state = this.getMembershipState();
    return {
        title: state.label,
        detail: state.detail,
        source: state.source
    };
};

function showPremiumModal() {
    const modal = document.getElementById('modal-ai-sound');
    if (!modal) return;

    const state = typeof PremiumManager !== 'undefined' && typeof PremiumManager.getMembershipState === 'function'
        ? PremiumManager.getMembershipState()
        : {
            active: false,
            source: 'self',
            label: '👑プレミアムモード：未登録',
            detail: 'このアカウントにプレミアム登録がありません。'
        };
    const partnerSnapshot = getConnectedPremiumPartnerSnapshot();
    const partnerState = partnerSnapshot
        ? buildPremiumStateFromRecord(partnerSnapshot, 'partner', { allowLocalFallback: false })
        : null;
    const partnerActive = !!(partnerState && partnerState.active);
    const canDeactivate = !!state.active && state.source === 'self' && !partnerActive;

    modal.classList.add('active');
    modal.innerHTML = `
        <div class="detail-sheet max-w-md" onclick="event.stopPropagation()">
            <button class="modal-close-btn" onclick="closePremiumModal()">✕</button>
            <div class="text-center py-6">
                <div class="text-[10px] font-black text-[#bca37f] mb-4 tracking-widest uppercase">Premium Plan</div>
                <div class="text-4xl mb-4">👑</div>
                <h3 class="text-lg font-black text-[#5d5444] mb-2">プレミアムモード</h3>
                <p class="text-xs text-[#a6967a] mb-4">広告を減らして、連携中も見やすく使えるようにするモードです。</p>

                <div class="mb-6 rounded-2xl border border-[#eee5d8] bg-[#fff9f0] px-4 py-3 text-left">
                    <div class="text-[11px] font-black text-[#5d5444] whitespace-pre-line">${escapePremiumHtml(state.label)}</div>
                    <div class="mt-1 text-[11px] leading-relaxed text-[#8b7e66]">${escapePremiumHtml(state.detail)}</div>
                </div>

                ${state.active ? `
                    <div class="bg-[#f0fdf4] border border-green-200 rounded-2xl p-4 mb-6 text-left">
                        <p class="text-sm font-bold text-green-700">${state.source === 'partner'
                            ? '連携中のパートナーのプレミアムで利用中です。'
                            : (partnerActive
                                ? '自分のプレミアムに加えて、連携中のパートナーもプレミアムです。'
                                : '自分のプレミアムで利用中です。')}</p>
                    </div>
                    ${canDeactivate ? `
                        <button onclick="PremiumManager.deactivate();closePremiumModal()" class="w-full py-3 bg-[#fef2f2] text-[#f28b82] rounded-2xl font-bold text-sm">
                            プレミアムを解除
                        </button>
                    ` : `
                        <button onclick="closePremiumModal()" class="w-full py-3 bg-gradient-to-r from-[#bca37f] to-[#8b7e66] text-white rounded-2xl font-bold text-sm shadow-md">
                            閉じる
                        </button>
                    `}
                ` : `
                    <div class="space-y-3 mb-6 text-left px-4">
                        <div class="flex items-center gap-3">
                            <span class="text-lg">✅</span>
                            <span class="text-sm text-[#5d5444]">広告の表示を減らします</span>
                        </div>
                        <div class="flex items-center gap-3">
                            <span class="text-lg">✅</span>
                            <span class="text-sm text-[#5d5444]">履歴や保存の表示を見やすくします</span>
                        </div>
                        <div class="flex items-center gap-3">
                            <span class="text-lg">✅</span>
                            <span class="text-sm text-[#5d5444]">購入状態の確認結果をこの画面に反映します</span>
                        </div>
                    </div>
                    <button onclick="PremiumManager.activate();closePremiumModal()" class="w-full py-4 bg-gradient-to-r from-[#bca37f] to-[#8b7e66] text-white rounded-2xl font-bold text-sm shadow-md">
                        プレミアムを有効にする
                    </button>
                    <button onclick="PremiumManager.refreshPurchaseState()" class="mt-3 w-full py-3 rounded-2xl border border-[#eadfce] bg-white text-[#8b7e66] font-bold text-sm">
                        購入状態を確認する
                    </button>
                    <p class="text-[9px] text-[#a6967a] mt-3">※ 現在はベータ版のため無料でお試しいただけます</p>
                `}
            </div>
        </div>
    `;
}

window.showPremiumModal = showPremiumModal;

function normalizePremiumStatus(value) {
    return String(value == null ? '' : value).trim().toLowerCase();
}

function getConnectedPremiumPartnerSnapshot() {
    if (typeof MeimayPairing === 'undefined' || !MeimayPairing.roomCode || !MeimayPairing.partnerUid) {
        return null;
    }

    if (typeof MeimayShare === 'undefined' || !MeimayShare || !MeimayShare.partnerUserSnapshot) {
        return null;
    }

    return MeimayShare.partnerUserSnapshot;
}

function buildPremiumStateFromRecord(record, source, options = {}) {
    const data = record || {};
    const status = normalizePremiumStatus(data.subscriptionStatus || data.premiumStatus || '');
    const expiresAt = normalizePremiumDate(data.appStoreExpiresAt || data.premiumExpiresAt || null);
    const productId = String(data.appStoreProductId || data.premiumProductId || '').trim();
    const explicitPremium = typeof data.isPremium === 'boolean' ? data.isPremium : null;
    const hasPremiumIndicators = explicitPremium !== null || !!status || !!expiresAt || !!productId;
    const expiredStatuses = new Set(['expired', 'refunded', 'revoked', 'billing_retry']);
    const expiredByDate = !!expiresAt && expiresAt.getTime() <= Date.now();
    const isExpired = expiredByDate || expiredStatuses.has(status);
    const allowLocalFallback = options.allowLocalFallback === true
        && !hasPremiumIndicators
        && options.localPremium === true;
    const isActive = !isExpired && (explicitPremium === true || status === 'active' || allowLocalFallback);
    const sourceTitle = source === 'partner'
        ? '👑プレミアムモード（パートナー）'
        : '👑プレミアムモード';
    const expiresLabel = expiresAt ? formatPremiumDateLabel(expiresAt) : '';

    let label = '👑プレミアムモード：未登録';
    let detail = source === 'partner'
        ? '連携中のパートナーにプレミアム登録がありません。'
        : 'このアカウントにプレミアム登録がありません。';

    if (isActive) {
        label = expiresAt && !expiredByDate
            ? `${sourceTitle}\n(${expiresLabel}まで有効)`
            : sourceTitle;
        detail = source === 'partner'
            ? (expiresAt && !expiredByDate
                ? `連携中のパートナーのプレミアムは${expiresLabel}まで有効です。`
                : '連携中のパートナーのプレミアムで利用中です。')
            : (expiresAt && !expiredByDate
                ? `自分のプレミアムは${expiresLabel}まで有効です。`
                : '自分のプレミアムで利用中です。');
    } else if (isExpired) {
        label = '👑プレミアムモード：期限切れ';
        detail = expiresAt && expiredByDate
            ? `有効期限は${expiresLabel}まででした。`
            : '購入状態は期限切れです。';
    }

    return {
        source,
        active: isActive,
        expired: isExpired,
        hasPremiumIndicators,
        title: label,
        label,
        detail,
        expiresAt,
        status,
        productId
    };
}

PremiumManager.isPremium = function () {
    if (typeof this.getMembershipState === 'function') {
        const state = this.getMembershipState();
        return !!(state && state.active);
    }
    return this.getLocalPremiumState();
};

PremiumManager.getMembershipState = function () {
    const selfState = buildPremiumStateFromRecord({
        isPremium: this._remotePremium,
        subscriptionStatus: this._remoteStatus,
        appStoreExpiresAt: this._remoteExpiresAt,
        premiumExpiresAt: this._remoteExpiresAt,
        appStoreProductId: this._remoteProductId,
        premiumProductId: this._remoteProductId
    }, 'self', {
        localPremium: this.getLocalPremiumState(),
        allowLocalFallback: true
    });

    const partnerSnapshot = getConnectedPremiumPartnerSnapshot();
    const partnerState = partnerSnapshot
        ? buildPremiumStateFromRecord(partnerSnapshot, 'partner', { allowLocalFallback: false })
        : null;

    if (selfState.active) return selfState;
    if (partnerState && partnerState.active) return partnerState;
    if (selfState.expired) return selfState;
    if (partnerState && partnerState.expired) return partnerState;
    if (partnerState && partnerState.hasPremiumIndicators) return partnerState;
    if (selfState.hasPremiumIndicators) return selfState;

    return {
        source: 'self',
        active: false,
        expired: false,
        hasPremiumIndicators: false,
        title: '👑プレミアムモード：未登録',
        label: '👑プレミアムモード：未登録',
        detail: 'このアカウントにプレミアム登録がありません。',
        expiresAt: null,
        status: '',
        productId: ''
    };
};

PremiumManager.getDrawerStatusLabel = function () {
    return this.getMembershipState().label;
};

PremiumManager.getStatusSummary = function () {
    const state = this.getMembershipState();
    return {
        title: state.label,
        detail: state.detail,
        source: state.source
    };
};

function updatePremiumUI() {
    const state = typeof PremiumManager !== 'undefined' && typeof PremiumManager.getMembershipState === 'function'
        ? PremiumManager.getMembershipState()
        : {
            active: false,
            label: '👑プレミアムモード：未登録'
        };

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

function showPremiumModal() {
    const modal = document.getElementById('modal-ai-sound');
    if (!modal) return;

    const state = typeof PremiumManager !== 'undefined' && typeof PremiumManager.getMembershipState === 'function'
        ? PremiumManager.getMembershipState()
        : {
            active: false,
            source: 'self',
            label: '👑プレミアムモード：未登録',
            detail: 'このアカウントにプレミアム登録がありません。'
        };
    const partnerSnapshot = getConnectedPremiumPartnerSnapshot();
    const partnerState = partnerSnapshot
        ? buildPremiumStateFromRecord(partnerSnapshot, 'partner', { allowLocalFallback: false })
        : null;
    const partnerActive = !!(partnerState && partnerState.active);
    const canDeactivate = !!state.active && state.source === 'self' && !partnerActive;

    modal.classList.add('active');
    modal.innerHTML = `
        <div class="detail-sheet max-w-md" onclick="event.stopPropagation()">
            <button class="modal-close-btn" onclick="closePremiumModal()">✕</button>
            <div class="text-center py-6">
                <div class="text-[10px] font-black text-[#bca37f] mb-4 tracking-widest uppercase">Premium Plan</div>
                <div class="text-4xl mb-4">👑</div>
                <h3 class="text-lg font-black text-[#5d5444] mb-2">プレミアムモード</h3>
                <p class="text-xs text-[#a6967a] mb-4">広告を減らして、連携中も見やすく使えるようにするモードです。</p>

                <div class="mb-6 rounded-2xl border border-[#eee5d8] bg-[#fff9f0] px-4 py-3 text-left">
                    <div class="text-[11px] font-black text-[#5d5444] whitespace-pre-line">${escapePremiumHtml(state.label)}</div>
                    <div class="mt-1 text-[11px] leading-relaxed text-[#8b7e66]">${escapePremiumHtml(state.detail)}</div>
                </div>

                ${state.active ? `
                    <div class="bg-[#f0fdf4] border border-green-200 rounded-2xl p-4 mb-6 text-left">
                        <p class="text-sm font-bold text-green-700">${state.source === 'partner'
                            ? '連携中のパートナーのプレミアムで利用中です。'
                            : (partnerActive
                                ? '自分のプレミアムに加えて、連携中のパートナーもプレミアムです。'
                                : '自分のプレミアムで利用中です。')}</p>
                    </div>
                    ${canDeactivate ? `
                        <button onclick="PremiumManager.deactivate();closePremiumModal()" class="w-full py-3 bg-[#fef2f2] text-[#f28b82] rounded-2xl font-bold text-sm">
                            プレミアムを解除
                        </button>
                    ` : `
                        <button onclick="closePremiumModal()" class="w-full py-3 bg-gradient-to-r from-[#bca37f] to-[#8b7e66] text-white rounded-2xl font-bold text-sm shadow-md">
                            閉じる
                        </button>
                    `}
                ` : `
                    <div class="space-y-3 mb-6 text-left px-4">
                        <div class="flex items-center gap-3">
                            <span class="text-lg">✅</span>
                            <span class="text-sm text-[#5d5444]">広告の表示を減らします</span>
                        </div>
                        <div class="flex items-center gap-3">
                            <span class="text-lg">✅</span>
                            <span class="text-sm text-[#5d5444]">履歴や保存の表示を見やすくします</span>
                        </div>
                        <div class="flex items-center gap-3">
                            <span class="text-lg">✅</span>
                            <span class="text-sm text-[#5d5444]">購入状態の確認結果をこの画面に反映します</span>
                        </div>
                    </div>
                    <button onclick="PremiumManager.activate();closePremiumModal()" class="w-full py-4 bg-gradient-to-r from-[#bca37f] to-[#8b7e66] text-white rounded-2xl font-bold text-sm shadow-md">
                        プレミアムを有効にする
                    </button>
                    <button onclick="PremiumManager.refreshPurchaseState()" class="mt-3 w-full py-3 rounded-2xl border border-[#eadfce] bg-white text-[#8b7e66] font-bold text-sm">
                        購入状態を確認する
                    </button>
                    <p class="text-[9px] text-[#a6967a] mt-3">※ 現在はベータ版のため無料でお試しいただけます</p>
                `}
            </div>
        </div>
    `;
}
window.openPremiumModalFromDrawer = openPremiumModalFromDrawer;
window.closePremiumModal = closePremiumModal;
window.hideAdBanner = hideAdBanner;
window.showAdBanner = showAdBanner;

console.log("ADMOB: Module loaded (v19.0)");

PremiumManager.getMembershipState = function () {
    const remoteStatus = String(this._remoteStatus || '').trim().toLowerCase();
    const remoteExpiresAt = normalizePremiumDate(this._remoteExpiresAt);
    const remoteExpired = !!remoteExpiresAt && remoteExpiresAt.getTime() <= Date.now();
    const remoteExpiresLabel = remoteExpiresAt ? formatPremiumDateLabel(remoteExpiresAt) : '';

    const selfState = buildPremiumMembershipState({
        isPremium: this._remotePremium,
        subscriptionStatus: this._remoteStatus,
        appStoreExpiresAt: this._remoteExpiresAt,
        premiumExpiresAt: this._remoteExpiresAt,
        appStoreProductId: this._remoteProductId,
        premiumProductId: this._remoteProductId
    }, 'self', {
        localPremium: typeof this.getLocalPremiumState === 'function' ? this.getLocalPremiumState() : false,
        allowLocalFallback: true
    });

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

    return buildPremiumMembershipState({}, 'self', { allowLocalFallback: false });

    if (this.isPremium()) {
        if (remoteExpiresAt && !remoteExpired) {
            return {
                label: `👑プレミアム会員：${remoteExpiresLabel}まで有効`,
                title: 'プレミアム利用中',
                detail: `有効期限は${remoteExpiresLabel}までです。`
            };
        }

        return {
            label: '👑プレミアム会員',
            title: 'プレミアム利用中',
            detail: this._remoteStatus === 'active'
                ? '買い切りのプレミアムです。'
                : 'プレミアム会員として利用中です。'
        };
    }

    if (remoteExpired || remoteStatus === 'expired' || remoteStatus === 'refunded' || remoteStatus === 'revoked' || remoteStatus === 'billing_retry') {
        return {
            label: '👑プレミアム会員：期限切れ',
            title: 'プレミアム会員：期限切れ',
            detail: remoteExpiresAt && remoteExpired
                ? `有効期限は${remoteExpiresLabel}まででした。`
                : '購入状態は期限切れです。'
        };
    }

    return {
        label: '👑プレミアム会員：未登録',
        title: 'プレミアム会員：未登録',
        detail: 'まだプレミアム購入情報がありません。'
    };
};

PremiumManager.getDrawerStatusLabel = function () {
    return this.getMembershipState().label;
};

PremiumManager.getStatusSummary = function () {
    const state = this.getMembershipState();
    return {
        title: state.title,
        detail: state.detail
    };
};

PremiumManager.refreshPurchaseState = async function () {
    const user = typeof MeimayAuth !== 'undefined' && MeimayAuth.getCurrentUser
        ? MeimayAuth.getCurrentUser()
        : null;

    if (!user) {
        if (typeof showToast === 'function') showToast('購入状態の確認には接続準備が必要です', 'ℹ');
        return false;
    }

    try {
        await this.bindToUserDoc(user);
        if (typeof showToast === 'function') {
            showToast(this.isPremium() ? '購入状態を更新しました' : '現在の購入状態を確認しました', this.isPremium() ? '✓' : 'ℹ');
        }
        return true;
    } catch (e) {
        console.warn('PREMIUM: refreshPurchaseState failed', e);
        if (typeof showToast === 'function') showToast('購入状態を確認できませんでした', '!');
        return false;
    }
};

function showPremiumModal() {
    const modal = document.getElementById('modal-ai-sound');
    if (!modal) return;

    const state = PremiumManager.getMembershipState();

    modal.classList.add('active');
    modal.innerHTML = `
        <div class="detail-sheet max-w-none" style="max-width:min(94vw, 980px); padding: clamp(24px, 3.5vw, 36px);" onclick="event.stopPropagation()">
            <button class="modal-close-btn" onclick="closePremiumModal()">×</button>
            <div class="pr-12 sm:pr-16">
                <div class="text-[10px] font-black text-[#bca37f] mb-2 tracking-[0.35em] uppercase">Premium Plan</div>
                <h3 class="text-2xl sm:text-[2rem] font-black text-[#5d5444] mb-3">プレミアム案内</h3>
                <p class="text-sm sm:text-[15px] leading-7 text-[#8b7e66]">無料とプレミアムの違いをひと目で確認できます。</p>
            </div>

            <div class="mt-6 sm:mt-8">
                ${renderPremiumComparisonMatrix()}
            </div>

            <div class="mt-8 rounded-[28px] border border-[#e8dfd4] bg-[#faf7f1] px-5 sm:px-6 py-5 sm:py-6">
                <div class="text-[17px] sm:text-[22px] font-black text-[#161310] mb-3">パートナー特典</div>
                <p class="text-[13px] sm:text-[16px] leading-7 text-[#3f3527]">どちらか1人がプレミアムに加入すると、連携中の相手もプレミアム機能を利用できます。</p>
            </div>

            <div class="mt-8 flex flex-col sm:flex-row gap-3">
                ${state.active ? `
                    <button onclick="closePremiumModal()" class="w-full py-3 bg-gradient-to-r from-[#bca37f] to-[#8b7e66] text-white rounded-2xl font-bold text-sm shadow-md">
                        閉じる
                    </button>
                ` : `
                    <button onclick="PremiumManager.activate();closePremiumModal()" class="w-full py-4 bg-gradient-to-r from-[#bca37f] to-[#8b7e66] text-white rounded-2xl font-bold text-sm shadow-md">
                        プレミアムを有効にする
                    </button>
                `}
                <button onclick="PremiumManager.refreshPurchaseState()" class="w-full py-3 rounded-2xl border border-[#eadfce] bg-white text-[#8b7e66] font-bold text-sm">
                    購入状態を更新
                </button>
            </div>

            <p class="mt-3 text-[9px] text-[#a6967a]">購入後の反映に少し時間がかかる場合があります。</p>
        </div>
    `;
}

window.PremiumManager = PremiumManager;
window.showPremiumModal = showPremiumModal;

function formatPremiumMembershipDate(date) {
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
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
    const expiresAt = normalizePremiumDate(data.appStoreExpiresAt || data.premiumExpiresAt || null);
    const productId = String(data.appStoreProductId || data.premiumProductId || '').trim();
    const explicitPremium = typeof data.isPremium === 'boolean' ? data.isPremium : null;
    const hasPremiumIndicators = explicitPremium !== null || !!status || !!expiresAt || !!productId;
    const expiredStatuses = new Set(['expired', 'refunded', 'revoked', 'billing_retry']);
    const expiredByDate = !!expiresAt && expiresAt.getTime() <= Date.now();
    const isExpired = expiredByDate || expiredStatuses.has(status);
    const allowLocalFallback = options.allowLocalFallback === true
        && !hasPremiumIndicators
        && options.localPremium === true;
    const isActive = !isExpired && (explicitPremium === true || status === 'active' || allowLocalFallback);
    const isPartner = source === 'partner';
    const expiresLabel = expiresAt ? formatPremiumMembershipDate(expiresAt) : '';
    const activeLabel = '👑 プレミアム：有効';
    const partnerActiveLabel = '👑 プレミアム：有効';

    let label = '👑 プレミアム：未登録';
    let detail = isPartner
        ? '連携中のパートナーのプレミアム状態を表示します。'
        : 'このアカウントのプレミアム状態を表示します。';

    if (isActive) {
        if (isPartner) {
            label = expiresAt && !expiredByDate
                ? `${partnerActiveLabel}\nパートナー特典・${expiresLabel}まで`
                : `${partnerActiveLabel}\nパートナー特典`;
        } else {
            label = expiresAt && !expiredByDate
                ? `${activeLabel}\n${expiresLabel}まで有効`
                : activeLabel;
        }
        detail = isPartner
            ? (expiresAt && !expiredByDate
                ? `連携中のパートナーのプレミアムモードは${expiresLabel}まで有効です。`
                : '連携中のパートナーのプレミアムモードは有効です。')
            : (expiresAt && !expiredByDate
                ? `このアカウントのプレミアムモードは${expiresLabel}まで有効です。`
                : 'このアカウントのプレミアムモードは有効です。');
    } else if (isExpired) {
        label = '👑 プレミアム：期限切れ';
        detail = expiresAt
            ? `有効期限は${expiresLabel}で終了しました。`
            : 'プレミアムの有効期限は切れています。';
    }

    return {
        source,
        active: isActive,
        expired: isExpired,
        hasPremiumIndicators,
        title: label,
        label,
        detail,
        expiresAt,
        status,
        productId
    };
}

window.formatPremiumMembershipDate = formatPremiumMembershipDate;
window.getConnectedPartnerPremiumSnapshot = getConnectedPartnerPremiumSnapshot;
window.getConnectedPremiumPartnerSnapshot = getConnectedPremiumPartnerSnapshot;
window.buildPremiumMembershipState = buildPremiumMembershipState;

PremiumManager.isPremium = function () {
    const state = this.getMembershipState();
    return !!(state && state.active);
};

PremiumManager.getMembershipState = function () {
    const selfState = buildPremiumMembershipState({
        isPremium: this._remotePremium,
        subscriptionStatus: this._remoteStatus,
        appStoreExpiresAt: this._remoteExpiresAt,
        premiumExpiresAt: this._remoteExpiresAt,
        appStoreProductId: this._remoteProductId,
        premiumProductId: this._remoteProductId
    }, 'self', {
        localPremium: typeof this.getLocalPremiumState === 'function' ? this.getLocalPremiumState() : false,
        allowLocalFallback: true
    });

    const partnerSnapshot = getConnectedPartnerPremiumSnapshot();
    const partnerState = partnerSnapshot
        ? buildPremiumMembershipState(partnerSnapshot, 'partner', { allowLocalFallback: false })
        : null;

    if (partnerState && partnerState.active) return partnerState;
    if (selfState.active) return selfState;
    if (selfState.expired) return selfState;
    if (partnerState && partnerState.expired) return partnerState;
    if (partnerState && partnerState.hasPremiumIndicators) return partnerState;
    if (selfState.hasPremiumIndicators) return selfState;

    return buildPremiumMembershipState({}, 'self', { allowLocalFallback: false });
};

PremiumManager.getDrawerStatusLabel = function () {
    return this.getMembershipState().label;
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
