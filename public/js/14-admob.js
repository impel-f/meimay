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

const AdMobTestAdConfig = {
    enabled: false,
    // Closed/internal Android testing uses Google's test banner unit to avoid invalid traffic.
    androidEnabled: false,
    iosEnabled: false,
    storageKey: 'meimay_admob_test_ads',
    androidBannerId: 'ca-app-pub-3940256099942544/6300978111',
    iosBannerId: 'ca-app-pub-3940256099942544/2934735716'
};

const AdMobPrivacyConfig = {
    nonPersonalizedAds: true,
    publisherFirstPartyIdEnabled: false,
    maxAdContentRating: 'General'
};

const NativeAdMobAutoStartConfig = {
    androidEnabled: true,
    iosEnabled: true,
    androidShowBannerEnabled: true,
    storageKey: 'meimay_native_admob_autostart',
    firstRunHomeDelayMs: 0,
    wizardRetryMs: 2500
};

function getAdMobTestAdFlagFromRuntime() {
    try {
        const params = new URLSearchParams(window.location.search || '');
        if (params.get('admobTest') === '1' || params.get('testAds') === '1') return true;
        if (params.get('admobTest') === '0' || params.get('testAds') === '0') return false;
    } catch (e) { }

    try {
        const storedFlag = localStorage.getItem(AdMobTestAdConfig.storageKey);
        if (storedFlag === '1') return true;
        if (storedFlag === '0') return false;
        return null;
    } catch (e) {
        return null;
    }
}

function setAdMobTestAdMode(enabled) {
    try {
        localStorage.setItem(AdMobTestAdConfig.storageKey, enabled ? '1' : '0');
    } catch (e) { }

    hideAdBanner();
    setTimeout(() => {
        initAdMob();
    }, 250);
}

function isAdMobTestAdMode(platform) {
    const normalizedPlatform = platform || (typeof detectCapacitorPlatform === 'function'
        ? detectCapacitorPlatform()
        : '');
    if (normalizedPlatform === 'android' && AdMobTestAdConfig.androidEnabled === true) return true;
    if (normalizedPlatform === 'ios' && AdMobTestAdConfig.iosEnabled === true) return true;

    const runtimeFlag = getAdMobTestAdFlagFromRuntime();
    if (runtimeFlag !== null) return runtimeFlag;

    return AdMobTestAdConfig.enabled === true;
}

function getAdMobBannerId(platform, config) {
    if (isAdMobTestAdMode(platform)) {
        return platform === 'ios'
            ? AdMobTestAdConfig.iosBannerId
            : AdMobTestAdConfig.androidBannerId;
    }
    return config.bannerId;
}

function getNativeAdMobAutoStartFlagFromRuntime() {
    try {
        const params = new URLSearchParams(window.location.search || '');
        const value = String(params.get('nativeAdMob') || params.get('admobNative') || '').trim();
        if (value === '1' || value === 'true') return true;
        if (value === '0' || value === 'false') return false;
    } catch (e) { }

    try {
        const storedFlag = localStorage.getItem(NativeAdMobAutoStartConfig.storageKey);
        if (storedFlag === '1') return true;
        if (storedFlag === '0') return false;
        return null;
    } catch (e) {
        return null;
    }
}

function isNativeAdMobAutoStartDisabled(platform) {
    if (!isCapacitorNativeAdRuntime()) return false;
    const runtimeFlag = getNativeAdMobAutoStartFlagFromRuntime();
    if (runtimeFlag !== null) return runtimeFlag !== true;

    const normalizedPlatform = String(platform || getPlatform() || '').toLowerCase();
    if (normalizedPlatform === 'android') return NativeAdMobAutoStartConfig.androidEnabled !== true;
    if (normalizedPlatform === 'ios') return NativeAdMobAutoStartConfig.iosEnabled !== true;
    return false;
}

const PremiumManager = {
    KEY: 'meimay_premium',
    DEV_FALLBACK_KEY: 'meimay_allow_local_premium',
    TOKEN_KEY: 'meimay_app_account_token',
    LINK_CACHE_KEY: 'meimay_premium_link_cache_v1',
    SILENT_STORE_SYNC_KEY: 'meimay_premium_silent_store_sync_v1',
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
    _storePremium: null,
    _storePremiumSource: null,
    _storeStatus: null,
    _storeAppStoreExpiresAt: null,
    _storeExpiresAt: null,
    _storeProductId: null,
    _storeLastNotificationType: null,
    _userDocUnsub: null,
    _userDocPermissionDenied: false,
    _purchaseStateCheckInFlight: false,
    _purchaseStateCheckStartedAt: 0,
    _purchaseStateCheckCompletedAt: 0,
    _trialStartInProgress: false,
    _purchaseInProgress: false,
    _silentStoreSyncInFlight: false,

    getLocalPremiumState: function () {
        try {
            if (typeof getLocalPremiumQueryPreviewMode === 'function' && getLocalPremiumQueryPreviewMode()) return true;
            const data = localStorage.getItem(this.KEY);
            if (!data) return false;
            const parsed = JSON.parse(data);
            return parsed && parsed.active === true;
        } catch (e) {
            return false;
        }
    },

    getPublicPremiumSnapshot: function () {
        const storeRecord = typeof getRevenueCatPremiumRecordFromManager === 'function'
            ? getRevenueCatPremiumRecordFromManager()
            : null;
        if (storeRecord && typeof buildPremiumMembershipState === 'function') {
            const storeState = buildPremiumMembershipState(storeRecord, 'self', { allowLocalFallback: false });
            if (storeState && (storeState.active || storeState.expired)) {
                return buildPublicPremiumSnapshotFromRecord(storeRecord, storeState);
            }
        }

        const remoteStatus = String(this._remoteStatus || '').trim().toLowerCase();
        const remoteTrialStatus = String(this._remoteTrialStatus || '').trim().toLowerCase();
        const remotePremiumSource = String(this._remotePremiumSource || '').trim().toLowerCase();
        const remoteExpiresAt = normalizePremiumDate(this._remoteExpiresAt || this._remoteTrialEndsAt);
        const remoteExpired = !!remoteExpiresAt && remoteExpiresAt.getTime() <= Date.now();
        const queryPreviewMode = typeof getLocalPremiumQueryPreviewMode === 'function'
            ? getLocalPremiumQueryPreviewMode()
            : '';
        let isPremium = isLocalPremiumFallbackAllowed() && !queryPreviewMode ? this.getLocalPremiumState() : false;

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

    _getLinkCacheFingerprint: function () {
        try {
            const raw = localStorage.getItem(this.LINK_CACHE_KEY);
            const parsed = raw ? JSON.parse(raw) : null;
            return String(parsed?.fingerprint || '').trim();
        } catch (e) {
            return '';
        }
    },

    _setLinkCacheFingerprint: function (fingerprint) {
        try {
            localStorage.setItem(this.LINK_CACHE_KEY, JSON.stringify({
                fingerprint,
                savedAt: new Date().toISOString()
            }));
        } catch (e) { }
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
        if (!user || typeof firebaseDb === 'undefined' || !firebaseDb || this._userDocPermissionDenied) return;

        const token = this.getAppAccountToken();
        if (!token) return;

        const platform = getPlatform();
        const docRef = firebaseDb.collection('users').doc(user.uid);
        const linkFingerprint = `${user.uid}::${token}::${platform}`;

        if (this._lastPremiumLinkFingerprint !== linkFingerprint && this._getLinkCacheFingerprint() !== linkFingerprint) {
            try {
                let existingUserData = null;
                try {
                    const snap = await docRef.get();
                    existingUserData = snap.exists ? (snap.data() || {}) : null;
                } catch (readError) {
                    existingUserData = null;
                }

                const linkPayload = {
                    appAccountToken: token,
                    premiumPlatform: platform,
                    appStoreBundleId: 'com.impelf.meimay',
                    revenueCatAppUserId: user.uid,
                    revenueCatPlatform: platform,
                    revenueCatLinkedAt: firebase.firestore.FieldValue.serverTimestamp(),
                    premiumLinkedAt: firebase.firestore.FieldValue.serverTimestamp(),
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                };
                if (!existingUserData || !Object.prototype.hasOwnProperty.call(existingUserData, 'pairRoomCode')) {
                    linkPayload.pairRoomCode = '';
                }
                if (!existingUserData || !Object.prototype.hasOwnProperty.call(existingUserData, 'roomCode')) {
                    linkPayload.roomCode = '';
                }

                await docRef.set(linkPayload, { merge: true });
                this._lastPremiumLinkFingerprint = linkFingerprint;
                this._setLinkCacheFingerprint(linkFingerprint);
            } catch (e) {
                if (this.isPermissionDeniedError(e)) {
                    this._userDocPermissionDenied = true;
                    console.info('PREMIUM: user doc link is not permitted by current Firestore rules; store purchase sync will continue locally.');
                    return;
                }
                console.warn('PREMIUM: Failed to link appAccountToken', e);
            }
        } else {
            this._lastPremiumLinkFingerprint = linkFingerprint;
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
            if (this.isPermissionDeniedError(error)) {
                this._userDocPermissionDenied = true;
                if (this._userDocUnsub) {
                    this._userDocUnsub();
                    this._userDocUnsub = null;
                }
                console.info('PREMIUM: user doc subscription is not permitted by current Firestore rules; store purchase sync will continue locally.');
                return;
            }
            console.warn('PREMIUM: Failed to subscribe user doc', error);
        });
    },

    isPermissionDeniedError: function (error) {
        const code = String(error?.code || '').toLowerCase();
        const message = String(error?.message || error || '').toLowerCase();
        return code.includes('permission')
            || code.includes('denied')
            || message.includes('missing or insufficient permissions')
            || message.includes('permission denied');
    }
};

const PREMIUM_PRODUCT_PLANS = [
    {
        id: 'meimay.premium.pass.1month',
        title: '1か月パス',
        price: '480円',
        note: '自動更新なし',
        description: '',
        actionLabel: '購入へ進む',
        durationMonths: 1
    },
    {
        id: 'meimay.premium.pass.3months',
        title: '3か月パス',
        price: '980円',
        note: '自動更新なし',
        description: '',
        actionLabel: '購入へ進む',
        durationMonths: 3
    },
    {
        id: 'meimay.premium.lifetime',
        title: '買い切り',
        price: '1,980円',
        note: '更新なし・期限なし',
        description: '',
        actionLabel: '購入へ進む',
        lifetime: true
    }
];

const RevenueCatConfig = {
    iosPublicSdkKey: 'appl_iANPgUKzgQIuwcKXMrvmSKkxIhX',
    androidPublicSdkKey: 'goog_nGTVnxTHOlZfOYFgSSbqXwtOyIE',
    entitlementId: 'premium',
    offeringId: 'default',
    packageIdentifiersByProductId: {
        'meimay.premium.pass.1month': ['$rc_monthly', 'monthly', 'pass_1month'],
        'meimay.premium.pass.3months': ['$rc_three_month', 'three_month', 'three_months', 'pass_3months'],
        'meimay.premium.lifetime': ['$rc_lifetime', 'lifetime']
    }
};

const REVENUECAT_REQUEST_TIMEOUT_MS = 10000;
const REVENUECAT_PURCHASE_TIMEOUT_MS = 90000;
const PREMIUM_PURCHASE_STATE_CHECK_TIMEOUT_MS = 12000;

function withRevenueCatTimeout(operation, label, timeoutMs = REVENUECAT_REQUEST_TIMEOUT_MS) {
    let timerId = null;
    const timeout = new Promise((_, reject) => {
        timerId = setTimeout(() => {
            reject(new Error(`${label || 'RevenueCat request'} timed out`));
        }, timeoutMs);
    });
    return Promise.race([
        Promise.resolve(operation).finally(() => {
            if (timerId) {
                clearTimeout(timerId);
                timerId = null;
            }
        }),
        timeout
    ]);
}

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

function isLocalPremiumPreviewHost() {
    try {
        const locationInfo = window.location || {};
        const protocol = String(locationInfo.protocol || '').toLowerCase();
        const hostname = String(locationInfo.hostname || '').toLowerCase();
        return protocol === 'file:'
            || hostname === 'localhost'
            || hostname === '127.0.0.1'
            || hostname === '::1';
    } catch (e) {
        return false;
    }
}

function getLocalPremiumQueryPreviewMode() {
    try {
        if (!isLocalPremiumPreviewHost()) return '';
        const locationInfo = window.location || {};
        const params = new URLSearchParams(String(locationInfo.search || ''));
        const value = String(params.get('localPremium') || '').trim().toLowerCase();
        if (value === 'trial') return 'trial';
        if (value === '1' || value === 'true' || value === 'premium') return 'premium';
        return '';
    } catch (e) {
        return '';
    }
}

function isLocalPremiumFallbackAllowed() {
    try {
        if (!isLocalPremiumPreviewHost()) return false;
        return !!getLocalPremiumQueryPreviewMode()
            || localStorage.getItem(PremiumManager.DEV_FALLBACK_KEY) === 'true';
    } catch (e) {
        return false;
    }
}

function addMonthsToPremiumDate(date, months) {
    const base = normalizePremiumDate(date) || new Date();
    const next = new Date(base.getTime());
    next.setMonth(next.getMonth() + months);
    return next;
}

function getRevenueCatPlugin() {
    if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Purchases) {
        return window.Capacitor.Plugins.Purchases;
    }
    if (window.Purchases && typeof window.Purchases.configure === 'function') {
        return window.Purchases;
    }
    if (window.RevenueCat && window.RevenueCat.Purchases) {
        return window.RevenueCat.Purchases;
    }
    return null;
}

function getRevenueCatUserCancelled(error) {
    const code = String(error?.code || error?.errorCode || '').toLowerCase();
    const message = String(error?.message || error?.errorMessage || '').toLowerCase();
    return error?.userCancelled === true
        || code.includes('cancel')
        || message.includes('cancel');
}

function getRevenueCatPlatformApiKey(platform) {
    if (platform === 'ios') return RevenueCatConfig.iosPublicSdkKey;
    if (platform === 'android') return RevenueCatConfig.androidPublicSdkKey;
    return '';
}

function getRevenueCatProductIdFromPackage(pkg) {
    const product = pkg?.product || pkg?.storeProduct || pkg?.webBillingProduct || null;
    return String(
        product?.identifier
        || product?.productIdentifier
        || product?.productId
        || product?.id
        || pkg?.productIdentifier
        || pkg?.productId
        || ''
    ).trim();
}

function getRevenueCatPackageIdentifier(pkg) {
    return String(
        pkg?.identifier
        || pkg?.packageIdentifier
        || pkg?.packageType
        || pkg?.type
        || ''
    ).trim();
}

function collectRevenueCatPackages(offerings) {
    const offering = offerings?.all?.[RevenueCatConfig.offeringId]
        || offerings?.current
        || offerings?.[RevenueCatConfig.offeringId]
        || null;
    if (!offering) return [];

    const packages = [];
    const addPackage = (pkg) => {
        if (!pkg || typeof pkg !== 'object' || packages.includes(pkg)) return;
        packages.push(pkg);
    };

    if (Array.isArray(offering.availablePackages)) {
        offering.availablePackages.forEach(addPackage);
    }

    [
        'monthly',
        'threeMonth',
        'threeMonths',
        'annual',
        'lifetime'
    ].forEach((key) => addPackage(offering[key]));

    Object.keys(offering).forEach((key) => {
        const value = offering[key];
        if (value && typeof value === 'object' && (value.product || value.storeProduct || value.webBillingProduct)) {
            addPackage(value);
        }
    });

    return packages;
}

function findRevenueCatPackageForProduct(offerings, productId) {
    const normalizedProductId = String(productId || '').trim();
    const packages = collectRevenueCatPackages(offerings);
    const packageIds = RevenueCatConfig.packageIdentifiersByProductId[normalizedProductId] || [];

    return packages.find((pkg) => getRevenueCatProductIdFromPackage(pkg) === normalizedProductId)
        || packages.find((pkg) => packageIds.includes(getRevenueCatPackageIdentifier(pkg)))
        || null;
}

function getRevenueCatEntitlement(customerInfo) {
    const info = customerInfo?.customerInfo || customerInfo || {};
    const active = info.entitlements?.active || {};
    const all = info.entitlements?.all || {};
    return active[RevenueCatConfig.entitlementId]
        || all[RevenueCatConfig.entitlementId]
        || null;
}

function getRevenueCatEntitlementActive(customerInfo) {
    const info = customerInfo?.customerInfo || customerInfo || {};
    const entitlement = getRevenueCatEntitlement(customerInfo);
    return !!(info.entitlements
        && info.entitlements.active
        && info.entitlements.active[RevenueCatConfig.entitlementId])
        || entitlement?.isActive === true
        || entitlement?.active === true;
}

function getRevenueCatEntitlementDate(entitlement, keys) {
    for (const key of keys) {
        const date = normalizePremiumDate(entitlement?.[key]);
        if (date) return date;
    }
    return null;
}

function inferRevenueCatPlanExpiresAt(plan, entitlement) {
    if (!plan || plan.lifetime || !plan.durationMonths) return null;
    const purchasedAt = getRevenueCatEntitlementDate(entitlement, [
        'latestPurchaseDate',
        'latestPurchaseDateMillis',
        'purchaseDate',
        'purchaseDateMillis'
    ]) || new Date();
    return addMonthsToPremiumDate(purchasedAt, plan.durationMonths);
}

const RevenueCatBridge = {
    _configuredAppUserId: '',
    _configuredPlatform: '',
    _offerings: null,

    isAvailable: function () {
        return !!getRevenueCatPlugin();
    },

    getAppUserId: function (user) {
        return String(user?.uid || '').trim();
    },

    configure: async function (user) {
        const plugin = getRevenueCatPlugin();
        if (!plugin) {
            throw new Error('RevenueCat SDK is not available in this build.');
        }

        const platform = getPlatform();
        const apiKey = getRevenueCatPlatformApiKey(platform);
        if (!apiKey) {
            throw new Error('RevenueCat SDK key is not configured for this platform.');
        }

        const appUserID = this.getAppUserId(user);
        if (!appUserID) {
            throw new Error('RevenueCat app user id is missing.');
        }

        if (this._configuredAppUserId === appUserID && this._configuredPlatform === platform) {
            return plugin;
        }

        if (this._configuredAppUserId && typeof plugin.logIn === 'function') {
            await withRevenueCatTimeout(plugin.logIn({ appUserID }), 'RevenueCat logIn');
            this._configuredAppUserId = appUserID;
            this._configuredPlatform = platform;
            return plugin;
        }

        await withRevenueCatTimeout(plugin.configure({ apiKey, appUserID }), 'RevenueCat configure');
        this._configuredAppUserId = appUserID;
        this._configuredPlatform = platform;
        return plugin;
    },

    getOfferings: async function (user) {
        const plugin = await this.configure(user);
        if (typeof plugin.getOfferings !== 'function') {
            throw new Error('RevenueCat getOfferings is not available.');
        }
        if (!this._offerings) {
            this._offerings = await withRevenueCatTimeout(plugin.getOfferings(), 'RevenueCat getOfferings');
        }
        return this._offerings;
    },

    getCustomerInfo: async function (user) {
        const plugin = await this.configure(user);
        if (typeof plugin.getCustomerInfo !== 'function') return null;
        return withRevenueCatTimeout(plugin.getCustomerInfo(), 'RevenueCat getCustomerInfo');
    },

    restorePurchases: async function (user) {
        const plugin = await this.configure(user);
        if (typeof plugin.restorePurchases === 'function') {
            return withRevenueCatTimeout(plugin.restorePurchases(), 'RevenueCat restorePurchases');
        }
        if (typeof plugin.getCustomerInfo === 'function') {
            return withRevenueCatTimeout(plugin.getCustomerInfo(), 'RevenueCat getCustomerInfo');
        }
        return null;
    },

    syncPurchases: async function (user) {
        const plugin = await this.configure(user);
        if (typeof plugin.syncPurchases === 'function') {
            const result = await withRevenueCatTimeout(plugin.syncPurchases(), 'RevenueCat syncPurchases');
            if (result) return result;
            if (typeof plugin.getCustomerInfo === 'function') {
                return withRevenueCatTimeout(plugin.getCustomerInfo(), 'RevenueCat getCustomerInfo');
            }
            return null;
        }
        if (typeof plugin.getCustomerInfo === 'function') {
            return withRevenueCatTimeout(plugin.getCustomerInfo(), 'RevenueCat getCustomerInfo');
        }
        return null;
    },

    purchaseProduct: async function (productId, user) {
        const plugin = await this.configure(user);
        const offerings = await this.getOfferings(user);
        const rcPackage = findRevenueCatPackageForProduct(offerings, productId);
        if (!rcPackage) {
            throw new Error('RevenueCat package was not found.');
        }
        if (typeof plugin.purchasePackage !== 'function') {
            throw new Error('RevenueCat purchasePackage is not available.');
        }
        return withRevenueCatTimeout(
            plugin.purchasePackage({ aPackage: rcPackage }),
            'RevenueCat purchasePackage',
            REVENUECAT_PURCHASE_TIMEOUT_MS
        );
    }
};

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
            title: 'プレミアム期限切れ',
            subtitle: '',
            detail: '現在は無料プランです。'
        };
    }

    return {
        source,
        active: false,
        expired: false,
        title: '無料プラン',
        subtitle: '',
        detail: 'まだプレミアム購入情報がありません。'
    };
}

function getPlatform() {
    const capacitorPlatform = window.Capacitor && typeof window.Capacitor.getPlatform === 'function'
        ? String(window.Capacitor.getPlatform() || '').toLowerCase()
        : '';
    if (capacitorPlatform === 'ios' || capacitorPlatform === 'android') return capacitorPlatform;

    const ua = navigator.userAgent || '';
    if (/android/i.test(ua)) return 'android';
    if (/iPad|iPhone|iPod/.test(ua)) return 'ios';
    if (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) return 'ios';
    return 'web';
}

function isCapacitorNativeAdRuntime() {
    const capacitorPlatform = window.Capacitor && typeof window.Capacitor.getPlatform === 'function'
        ? String(window.Capacitor.getPlatform() || '').toLowerCase()
        : '';
    return capacitorPlatform === 'ios' || capacitorPlatform === 'android';
}

function getAdMobPlugin() {
    return window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.AdMob
        ? window.Capacitor.Plugins.AdMob
        : null;
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

const AD_BANNER_GAP = 8;
const AD_BANNER_DOCK_TUCK = 0;
const AD_SCREEN_SAFE_SPACE_MIN = 124;
const WEB_AD_BANNER_MIN_HEIGHT = 52;
const NATIVE_AD_BANNER_MIN_HEIGHT = 56;
const AD_PREMIUM_STATE_GRACE_MS = 2500;
const PREMIUM_AD_SUPPRESSION_CACHE_KEY = 'meimay_premium_ad_suppression_cache_v1';
const PREMIUM_AD_SUPPRESSION_CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const PARTNER_PREMIUM_CACHE_KEY = 'meimay_partner_premium_cache_v1';
const PARTNER_PREMIUM_CACHE_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;
let adBannerVisible = false;
let adBannerMode = null;
let nativeAdMobInitializePromise = null;
let nativeAdMobListenersReady = false;
let nativeAdMobBannerLoaded = false;
let nativeAdMobBannerFailed = false;
let adBannerSuppressedByOverlay = false;
let adOverlayObserverReady = false;
let adOverlaySyncTimer = null;
let adMobPremiumRetryTimer = null;
let adBannerSurfaceRefreshTimer = null;
let adBannerSurfaceRefreshListenersReady = false;
let adSystemStartedAt = Date.now();
let lastAdImpressionAnalytics = { key: '', at: 0 };
let firstRunHomeAdReadyAtMs = 0;
const deferNativeMonetizationForFirstRunSession = (() => {
    try {
        return typeof WizardData !== 'undefined'
            && WizardData
            && typeof WizardData.isCompleted === 'function'
            && !WizardData.isCompleted();
    } catch (e) {
        return false;
    }
})();

function getActiveScreenIdForNativeAds() {
    try {
        const active = document.querySelector('.screen.active');
        return active ? String(active.id || '').trim() : '';
    } catch (e) {
        return '';
    }
}

function trackAdImpressionAnalytics(mode, params = {}) {
    if (typeof trackMeimayEvent !== 'function') return;
    const key = `${mode}:${params.ad_source || ''}:${params.is_test_ad || 0}`;
    const now = Date.now();
    if (lastAdImpressionAnalytics.key === key && now - lastAdImpressionAnalytics.at < 30000) return;
    lastAdImpressionAnalytics = { key, at: now };
    trackMeimayEvent('ad_impression', {
        ad_platform: 'admob',
        ad_format: 'banner',
        ad_mode: mode || '',
        ...params
    });
}

function getPremiumAdSuppressionCache() {
    try {
        const raw = localStorage.getItem(PREMIUM_AD_SUPPRESSION_CACHE_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch (e) {
        return null;
    }
}

function setPremiumAdSuppressionCache(record = {}) {
    try {
        localStorage.setItem(PREMIUM_AD_SUPPRESSION_CACHE_KEY, JSON.stringify({
            active: true,
            productId: String(record.productId || '').trim(),
            premiumSource: String(record.premiumSource || 'revenuecat').trim(),
            expiresAt: record.expiresAt || null,
            updatedAtMs: Date.now()
        }));
    } catch (e) { }
}

function clearPremiumAdSuppressionCache() {
    try {
        localStorage.removeItem(PREMIUM_AD_SUPPRESSION_CACHE_KEY);
    } catch (e) { }
}

function hasFreshPremiumAdSuppressionCache() {
    const cache = getPremiumAdSuppressionCache();
    if (!cache || cache.active !== true) return false;
    const expiresAt = normalizePremiumDate(cache.expiresAt);
    if (expiresAt) return expiresAt.getTime() > Date.now();
    const updatedAtMs = Number(cache.updatedAtMs) || 0;
    return !(updatedAtMs > 0 && Date.now() - updatedAtMs > PREMIUM_AD_SUPPRESSION_CACHE_MAX_AGE_MS);
}

function getCurrentPairingRoomCodeForPremiumCache() {
    try {
        const liveCode = typeof MeimayPairing !== 'undefined' && MeimayPairing
            ? String(MeimayPairing.roomCode || '').trim().toUpperCase()
            : '';
        if (liveCode) return liveCode;
        return String(localStorage.getItem('meimay_room_code') || '').trim().toUpperCase();
    } catch (e) {
        return '';
    }
}

function getCurrentPartnerUidForPremiumCache() {
    try {
        return typeof MeimayPairing !== 'undefined' && MeimayPairing
            ? String(MeimayPairing.partnerUid || '').trim()
            : '';
    } catch (e) {
        return '';
    }
}

function normalizePartnerPremiumCacheSnapshot(snapshot) {
    if (!snapshot || typeof snapshot !== 'object') return null;
    const state = {
        isPremium: typeof snapshot.isPremium === 'boolean' ? snapshot.isPremium : null,
        premiumSource: typeof snapshot.premiumSource === 'string' ? snapshot.premiumSource.trim().toLowerCase() || null : null,
        subscriptionStatus: typeof snapshot.subscriptionStatus === 'string'
            ? snapshot.subscriptionStatus.trim().toLowerCase() || null
            : (typeof snapshot.premiumStatus === 'string' ? snapshot.premiumStatus.trim().toLowerCase() || null : null),
        premiumStatus: typeof snapshot.premiumStatus === 'string'
            ? snapshot.premiumStatus.trim().toLowerCase() || null
            : (typeof snapshot.subscriptionStatus === 'string' ? snapshot.subscriptionStatus.trim().toLowerCase() || null : null),
        appStoreExpiresAt: snapshot.appStoreExpiresAt || null,
        premiumExpiresAt: snapshot.premiumExpiresAt || snapshot.appStoreExpiresAt || snapshot.trialEndsAt || null,
        appStoreProductId: typeof snapshot.appStoreProductId === 'string'
            ? snapshot.appStoreProductId.trim() || null
            : (typeof snapshot.premiumProductId === 'string' ? snapshot.premiumProductId.trim() || null : null),
        premiumProductId: typeof snapshot.premiumProductId === 'string'
            ? snapshot.premiumProductId.trim() || null
            : (typeof snapshot.appStoreProductId === 'string' ? snapshot.appStoreProductId.trim() || null : null),
        appStoreLastNotificationType: typeof snapshot.appStoreLastNotificationType === 'string'
            ? snapshot.appStoreLastNotificationType.trim() || null
            : (typeof snapshot.latestNotificationType === 'string' ? snapshot.latestNotificationType.trim() || null : null),
        latestNotificationType: typeof snapshot.latestNotificationType === 'string'
            ? snapshot.latestNotificationType.trim() || null
            : (typeof snapshot.appStoreLastNotificationType === 'string' ? snapshot.appStoreLastNotificationType.trim() || null : null),
        trialStatus: typeof snapshot.trialStatus === 'string' ? snapshot.trialStatus.trim().toLowerCase() || null : null,
        trialStartedAt: snapshot.trialStartedAt || null,
        trialEndsAt: snapshot.trialEndsAt || null,
        trialConsumedByRoom: snapshot.trialConsumedByRoom === true,
        updatedAt: snapshot.updatedAt || null
    };
    const hasIndicators = state.isPremium !== null
        || !!state.subscriptionStatus
        || !!state.premiumSource
        || !!state.trialStatus
        || !!state.appStoreExpiresAt
        || !!state.premiumExpiresAt
        || !!state.appStoreProductId
        || !!state.premiumProductId;
    return hasIndicators ? state : null;
}

function getCachedConnectedPartnerPremiumSnapshot() {
    try {
        const raw = localStorage.getItem(PARTNER_PREMIUM_CACHE_KEY);
        const parsed = raw ? JSON.parse(raw) : null;
        if (!parsed || typeof parsed !== 'object') return null;

        const state = normalizePartnerPremiumCacheSnapshot(parsed.state || parsed);
        if (!state) return null;
        const expiresAt = normalizePremiumDate(state.premiumExpiresAt || state.appStoreExpiresAt || state.trialEndsAt || null);

        const updatedAtMs = Number(parsed.updatedAtMs) || 0;
        if (!expiresAt && updatedAtMs > 0 && Date.now() - updatedAtMs > PARTNER_PREMIUM_CACHE_MAX_AGE_MS) return null;

        const currentRoomCode = getCurrentPairingRoomCodeForPremiumCache();
        const cachedRoomCode = String(parsed.roomCode || '').trim().toUpperCase();
        if (currentRoomCode && cachedRoomCode && currentRoomCode !== cachedRoomCode) return null;

        const currentPartnerUid = getCurrentPartnerUidForPremiumCache();
        const cachedPartnerUid = String(parsed.partnerUid || '').trim();
        if (currentPartnerUid && cachedPartnerUid && currentPartnerUid !== cachedPartnerUid) return null;

        return state;
    } catch (e) {
        return null;
    }
}

function setCachedConnectedPartnerPremiumSnapshot(snapshot, context = {}) {
    const state = normalizePartnerPremiumCacheSnapshot(snapshot);
    if (!state) return false;
    try {
        const roomCode = String(
            context.roomCode
            || getCurrentPairingRoomCodeForPremiumCache()
            || ''
        ).trim().toUpperCase();
        const partnerUid = String(
            context.partnerUid
            || getCurrentPartnerUidForPremiumCache()
            || ''
        ).trim();
        localStorage.setItem(PARTNER_PREMIUM_CACHE_KEY, JSON.stringify({
            roomCode,
            partnerUid,
            state,
            updatedAtMs: Date.now()
        }));
        return true;
    } catch (e) {
        return false;
    }
}

function clearCachedConnectedPartnerPremiumSnapshot() {
    try {
        localStorage.removeItem(PARTNER_PREMIUM_CACHE_KEY);
    } catch (e) { }
}

function shouldDeferNativeMonetizationDuringWizard() {
    if (!isCapacitorNativeAdRuntime()) return false;
    try {
        const wizardScreen = document.getElementById('scr-wizard');
        const wizardVisible = !!(wizardScreen && wizardScreen.classList.contains('active'));
        const wizardCompleted = typeof WizardData !== 'undefined'
            && WizardData
            && typeof WizardData.isCompleted === 'function'
            && WizardData.isCompleted();
        return wizardVisible || wizardCompleted !== true;
    } catch (e) {
        return false;
    }
}

function getFirstRunNativeAdHoldReason() {
    if (!isCapacitorNativeAdRuntime() || !deferNativeMonetizationForFirstRunSession) return '';

    let wizardCompleted = false;
    try {
        wizardCompleted = typeof WizardData !== 'undefined'
            && WizardData
            && typeof WizardData.isCompleted === 'function'
            && WizardData.isCompleted();
    } catch (e) {
        wizardCompleted = false;
    }

    const activeScreenId = getActiveScreenIdForNativeAds();
    if (!wizardCompleted || activeScreenId === 'scr-wizard') {
        firstRunHomeAdReadyAtMs = 0;
        return 'first-run-wizard';
    }

    if (activeScreenId !== 'scr-mode') {
        firstRunHomeAdReadyAtMs = 0;
        return 'first-run-post-wizard';
    }

    if (!firstRunHomeAdReadyAtMs) {
        firstRunHomeAdReadyAtMs = Date.now() + NativeAdMobAutoStartConfig.firstRunHomeDelayMs;
    }
    if (Date.now() < firstRunHomeAdReadyAtMs) return 'first-run-home-delay';
    return '';
}

function shouldSkipNativeStoreCheck(options = {}) {
    if (!isCapacitorNativeAdRuntime()) return false;
    if (options && options.force === true) return false;
    const reason = String(options?.reason || '').trim();
    return reason === 'auth-ready' || shouldDeferNativeMonetizationDuringWizard();
}

function getAdMobPremiumHoldReason() {
    if (PremiumManager.isPremium()) return 'premium-active';
    if (hasFreshPremiumAdSuppressionCache()) return 'premium-cache';
    if (PremiumManager.isPurchaseStateCheckPending && PremiumManager.isPurchaseStateCheckPending()) {
        return 'premium-check';
    }
    const completed = PremiumManager.hasCompletedPurchaseStateCheck && PremiumManager.hasCompletedPurchaseStateCheck();
    if (!completed && Date.now() - adSystemStartedAt < AD_PREMIUM_STATE_GRACE_MS) {
        return 'startup-premium-grace';
    }
    const firstRunHoldReason = getFirstRunNativeAdHoldReason();
    if (firstRunHoldReason) return firstRunHoldReason;
    if (shouldDeferNativeMonetizationDuringWizard()) {
        return 'first-run-wizard';
    }
    if (isNativeAdMobAutoStartDisabled()) return 'native-admob-autostart-disabled';
    return '';
}

function showHtmlAdBannerForHoldReason(reason) {
    return false;
}

function scheduleDeferredAdMobInit(reason = '') {
    if (reason === 'premium-active' || reason === 'premium-cache') return;
    if (reason === 'native-admob-autostart-disabled') return;
    if (adMobPremiumRetryTimer) return;
    let delayMs = 1200;
    if (reason === 'first-run-wizard' || reason === 'first-run-post-wizard') {
        delayMs = NativeAdMobAutoStartConfig.wizardRetryMs;
    } else if (reason === 'first-run-home-delay') {
        delayMs = Math.max(1000, firstRunHomeAdReadyAtMs - Date.now() + 250);
    }
    adMobPremiumRetryTimer = setTimeout(() => {
        adMobPremiumRetryTimer = null;
        initAdMob();
    }, delayMs);
}

function getAdBannerFooterMargin() {
    return Math.max(0, getBottomFooterHeight() - AD_BANNER_DOCK_TUCK);
}

function measureAdBannerHeight(container) {
    if (!container) return 0;
    const content = container.firstElementChild || container;
    const rect = content.getBoundingClientRect();
    return Math.ceil(rect.height || content.offsetHeight || container.offsetHeight || 0);
}

function hasActiveAdBlockingOverlay() {
    return !!document.querySelector([
        '.overlay.active',
        '.meimay-child-modal-overlay',
        '#drawer-overlay:not(.hidden)'
    ].join(','));
}

function setHtmlAdBannerSuppressed(suppressed) {
    const container = document.getElementById('admob-banner');
    if (!container) return;
    container.style.visibility = suppressed ? 'hidden' : '';
    container.style.pointerEvents = suppressed ? 'none' : '';
}

function setNativeAdMobBannerSuppressed(suppressed, reason = '') {
    const AdMob = getAdMobPlugin();
    if (!AdMob) return;

    try {
        const methodName = suppressed ? 'hideBanner' : 'resumeBanner';
        const method = AdMob[methodName];
        if (typeof method !== 'function') return;
        const result = method.call(AdMob);
        if (result && typeof result.catch === 'function') {
            result.catch((e) => console.warn('ADMOB: temporary banner visibility change failed', reason, e));
        }
    } catch (e) {
        console.warn('ADMOB: temporary banner visibility change failed', reason, e);
    }
}

function syncAdBannerOverlaySuppression() {
    const shouldSuppress = !PremiumManager.isPremium() && hasActiveAdBlockingOverlay();
    if (shouldSuppress === adBannerSuppressedByOverlay) {
        setHtmlAdBannerSuppressed(shouldSuppress);
        return;
    }

    adBannerSuppressedByOverlay = shouldSuppress;
    setHtmlAdBannerSuppressed(shouldSuppress);
    setNativeAdMobBannerSuppressed(shouldSuppress, 'overlay-sync');

    if (!shouldSuppress && !PremiumManager.isPremium()) {
        showAdBanner();
    }
}

function setAdBannerOverlaySuppressed(suppressed, reason = '') {
    const shouldSuppress = suppressed === true && !PremiumManager.isPremium();
    adBannerSuppressedByOverlay = shouldSuppress;
    setHtmlAdBannerSuppressed(shouldSuppress);
    setNativeAdMobBannerSuppressed(shouldSuppress, reason);

    if (!shouldSuppress && !hasActiveAdBlockingOverlay()) {
        showAdBanner();
    }
}

function scheduleAdBannerOverlaySync() {
    if (adOverlaySyncTimer) clearTimeout(adOverlaySyncTimer);
    adOverlaySyncTimer = setTimeout(() => {
        adOverlaySyncTimer = null;
        syncAdBannerOverlaySuppression();
    }, 0);
}

function ensureAdOverlayObserver() {
    if (adOverlayObserverReady || typeof MutationObserver === 'undefined' || !document.body) return;
    adOverlayObserverReady = true;
    const observer = new MutationObserver(scheduleAdBannerOverlaySync);
    observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'style']
    });
    document.addEventListener('visibilitychange', scheduleAdBannerOverlaySync);
}

function shouldRefreshAdBannerForScreen(screenId) {
    const blockedScreens = new Set([
        'scr-wizard',
        'scr-gender',
        'scr-vibe',
        'scr-akinator'
    ]);
    return !blockedScreens.has(String(screenId || ''));
}

function requestAdBannerSurfaceRefresh(reason = '', options = {}) {
    if (adBannerSurfaceRefreshTimer) clearTimeout(adBannerSurfaceRefreshTimer);
    const delayMs = Number.isFinite(Number(options.delayMs)) ? Number(options.delayMs) : 350;
    adBannerSurfaceRefreshTimer = setTimeout(() => {
        adBannerSurfaceRefreshTimer = null;
        if (PremiumManager.isPremium() || hasActiveAdBlockingOverlay()) return;
        console.log('ADMOB: Refreshing banner surface', reason);
        showAdBanner();
    }, Math.max(0, delayMs));
}

function refreshAdBannerAfterScreenChange(screenId) {
    if (!shouldRefreshAdBannerForScreen(screenId)) return;
    requestAdBannerSurfaceRefresh(`screen:${screenId}`, { delayMs: 500 });
}

function installAdBannerSurfaceRefreshListeners() {
    if (adBannerSurfaceRefreshListenersReady) return;
    adBannerSurfaceRefreshListenersReady = true;
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            requestAdBannerSurfaceRefresh('visibilitychange', { delayMs: 650 });
        }
    });
    window.addEventListener('focus', () => {
        requestAdBannerSurfaceRefresh('window-focus', { delayMs: 650 });
    });
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
    ensureAdOverlayObserver();
    const footerMargin = getAdBannerFooterMargin();
    let measuredHeight = typeof bannerHeight === 'number' ? bannerHeight : 0;

    if (adBannerVisible && measuredHeight <= 0) {
        if (adBannerMode === 'web' || adBannerMode === 'native-fallback') {
            measuredHeight = measureAdBannerHeight(container) || WEB_AD_BANNER_MIN_HEIGHT;
        } else if (adBannerMode === 'native') {
            measuredHeight = NATIVE_AD_BANNER_MIN_HEIGHT;
        }
    }

    if ((adBannerMode === 'web' || adBannerMode === 'native-fallback') && container) {
        container.style.bottom = `${footerMargin}px`;
    }

    if (measuredHeight > 0) {
        const safeSpace = Math.max(AD_SCREEN_SAFE_SPACE_MIN, footerMargin + measuredHeight + AD_BANNER_GAP);
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

function clearHtmlAdBanner(reason, error) {
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

    if (reason) {
        console.warn(`ADMOB: ${reason}`, error || '');
    }
}

function showNativeAdMobFallbackBanner(reason, error) {
    if (!isAdMobTestAdMode()) {
        clearHtmlAdBanner(reason, error);
        return;
    }

    const container = document.getElementById('admob-banner');
    if (!container || PremiumManager.isPremium()) {
        clearHtmlAdBanner(reason, error);
        return;
    }

    adBannerVisible = true;
    adBannerMode = 'native-fallback';
    adBannerSuppressedByOverlay = hasActiveAdBlockingOverlay();

    const footerMargin = getAdBannerFooterMargin();
    container.style.bottom = `${footerMargin}px`;
    container.style.display = 'flex';
    setHtmlAdBannerSuppressed(adBannerSuppressedByOverlay);
    container.innerHTML = `
        <div class="w-full max-w-[728px] bg-[#f5f0e8] border-t border-[#eee5d8] py-2 px-4 flex items-center justify-between gap-3">
            <div class="flex min-w-0 flex-1 items-center gap-2">
                <span class="shrink-0 text-[9px] text-[#a6967a] font-bold bg-white px-1.5 py-0.5 rounded">AD</span>
                <div class="min-w-0 flex-1">
                    <span class="block truncate text-[10px] font-bold text-[#8b7e66]">AdMobテスト広告を確認中</span>
                    <span class="block truncate text-[8px] text-[#a6967a]">表示されない場合はPremium状態・プラグイン・ログを確認</span>
                </div>
            </div>
            <span class="shrink-0 rounded-full bg-[#bca37f] px-3 py-1 text-[10px] font-black text-white">テスト</span>
        </div>
    `;

    document.body.classList.add('has-ad-banner');
    updateAdLayoutSpacing(measureAdBannerHeight(container) || NATIVE_AD_BANNER_MIN_HEIGHT);
    trackAdImpressionAnalytics('native_fallback', {
        ad_source: 'fallback_banner',
        os_platform: getPlatform(),
        is_test_ad: isAdMobTestAdMode(getPlatform()) ? 1 : 0
    });

    if (reason) {
        console.warn(`ADMOB: ${reason}`, error || '');
    }
}

function setupNativeAdMobBannerListeners(AdMob) {
    if (nativeAdMobListenersReady || !AdMob || typeof AdMob.addListener !== 'function') return;
    nativeAdMobListenersReady = true;

    try {
        const addBannerListener = (eventName, handler) => {
            const listenerResult = AdMob.addListener(eventName, handler);
            if (listenerResult && typeof listenerResult.catch === 'function') {
                listenerResult.catch((e) => console.warn(`ADMOB: ${eventName} listener failed`, e));
            }
        };

        addBannerListener('bannerAdLoaded', () => {
            const container = document.getElementById('admob-banner');
            if (container) {
                container.style.display = 'none';
                container.style.bottom = '';
                container.innerHTML = '';
            }
            nativeAdMobBannerLoaded = true;
            nativeAdMobBannerFailed = false;
            adBannerVisible = true;
            adBannerMode = 'native';
            updateAdLayoutSpacing(NATIVE_AD_BANNER_MIN_HEIGHT);
            trackAdImpressionAnalytics('native', {
                ad_source: 'banner_loaded',
                os_platform: getPlatform(),
                is_test_ad: isAdMobTestAdMode(getPlatform()) ? 1 : 0
            });
            console.log('ADMOB: Native banner loaded');
        });

        addBannerListener('bannerAdSizeChanged', (size) => {
            if (adBannerMode !== 'native') return;
            const height = Number(size && size.height);
            if (Number.isFinite(height) && height > 0) {
                nativeAdMobBannerLoaded = true;
                adBannerVisible = true;
                updateAdLayoutSpacing(Math.max(height, NATIVE_AD_BANNER_MIN_HEIGHT));
            }
        });

        addBannerListener('bannerAdFailedToLoad', (error) => {
            nativeAdMobBannerLoaded = false;
            nativeAdMobBannerFailed = true;
            showNativeAdMobFallbackBanner('Native banner failed to load', error);
        });
    } catch (e) {
        nativeAdMobListenersReady = false;
        console.warn('ADMOB: Native banner listener setup failed', e);
    }
}

function initAdMob() {
    ensureAdOverlayObserver();
    const holdReason = getAdMobPremiumHoldReason();
    if (holdReason) {
        console.log('ADMOB: Hidden while premium state is protected:', holdReason);
        if (showHtmlAdBannerForHoldReason(holdReason)) return;
        hideAdBanner();
        scheduleDeferredAdMobInit(holdReason);
        return;
    }

    const platform = getPlatform();
    const AdMob = getAdMobPlugin();

    // Native AdMob (Capacitor/Cordova)
    if (AdMob) {
        initNativeAdMob(platform);
        return;
    }

    if (isCapacitorNativeAdRuntime()) {
        showNativeAdMobFallbackBanner('Native runtime detected but AdMob plugin is unavailable; check Capacitor sync/build');
        return;
    }

    // Web fallback: show placeholder banner in local/browser previews
    showWebAdBanner();
}

async function initNativeAdMob(platform) {
    ensureAdOverlayObserver();
    const config = platform === 'ios' ? AdMobConfig.ios : AdMobConfig.android;
    const footerMargin = getAdBannerFooterMargin();

    try {
        const AdMob = getAdMobPlugin();
        if (!AdMob) {
            showNativeAdMobFallbackBanner('Native AdMob plugin is unavailable before initialization');
            return;
        }
        setupNativeAdMobBannerListeners(AdMob);

        if (hasActiveAdBlockingOverlay()) {
            adBannerVisible = true;
            adBannerMode = 'native';
            adBannerSuppressedByOverlay = true;
            updateAdLayoutSpacing(NATIVE_AD_BANNER_MIN_HEIGHT);
            return;
        }

        if (!nativeAdMobInitializePromise) {
            const initializeOptions = platform === 'android'
                ? {}
                : {
                    testingDevices: [],
                    initializeForTesting: isAdMobTestAdMode(platform),
                    publisherFirstPartyIdEnabled: AdMobPrivacyConfig.publisherFirstPartyIdEnabled,
                    maxAdContentRating: AdMobPrivacyConfig.maxAdContentRating
                };
            nativeAdMobInitializePromise = AdMob.initialize(initializeOptions);
        }
        await nativeAdMobInitializePromise;

        if (platform === 'android' && NativeAdMobAutoStartConfig.androidShowBannerEnabled !== true) {
            clearHtmlAdBanner('Native AdMob initialized without banner for Android crash isolation');
            console.log('ADMOB: Native initialized; Android banner display skipped for crash isolation');
            return;
        }

        nativeAdMobBannerLoaded = false;
        nativeAdMobBannerFailed = false;
        adBannerMode = 'native';
        await AdMob.showBanner({
            adId: getAdMobBannerId(platform, config),
            adSize: 'BANNER',
            position: 'BOTTOM_CENTER',
            margin: footerMargin,
            isTesting: isAdMobTestAdMode(platform),
            npa: AdMobPrivacyConfig.nonPersonalizedAds
        });

        if (nativeAdMobBannerFailed) return;

        const container = document.getElementById('admob-banner');
        if (container) {
            container.style.display = 'none';
            container.style.bottom = '';
            container.innerHTML = '';
        }
        adBannerVisible = true;
        adBannerMode = 'native';
        updateAdLayoutSpacing(NATIVE_AD_BANNER_MIN_HEIGHT);

        console.log('ADMOB: Native banner requested');
    } catch (e) {
        nativeAdMobInitializePromise = null;
        nativeAdMobBannerLoaded = false;
        nativeAdMobBannerFailed = true;
        showNativeAdMobFallbackBanner('Native init failed', e);
    }
}

function showAdBanner() {
    ensureAdOverlayObserver();
    const holdReason = getAdMobPremiumHoldReason();
    if (holdReason) {
        if (showHtmlAdBannerForHoldReason(holdReason)) return;
        hideAdBanner();
        scheduleDeferredAdMobInit(holdReason);
        return;
    }
    const platform = getPlatform();
    const AdMob = getAdMobPlugin();
    if (AdMob) {
        initNativeAdMob(platform);
    } else if (isCapacitorNativeAdRuntime()) {
        showNativeAdMobFallbackBanner('Native runtime detected but AdMob plugin is unavailable; check Capacitor sync/build');
    } else {
        showWebAdBanner();
    }
}

function showWebAdBanner() {
    ensureAdOverlayObserver();
    const container = document.getElementById('admob-banner');
    if (!container || PremiumManager.isPremium()) return;

    adBannerVisible = true;
    adBannerMode = 'web';
    adBannerSuppressedByOverlay = hasActiveAdBlockingOverlay();
    const footerMargin = getAdBannerFooterMargin();
    container.style.bottom = `${footerMargin}px`;
    container.style.display = 'flex';
    setHtmlAdBannerSuppressed(adBannerSuppressedByOverlay);
    container.innerHTML = `
        <div class="w-full max-w-[728px] bg-[#f5f0e8] border-t border-[#eee5d8] py-2 px-4 flex items-center justify-between gap-3">
            <div class="flex min-w-0 flex-1 items-center gap-2">
                <span class="shrink-0 text-[9px] text-[#a6967a] font-bold bg-white px-1.5 py-0.5 rounded">AD</span>
                <div class="min-w-0 flex-1 overflow-x-auto whitespace-nowrap">
                    <span class="block text-[10px] text-[#8b7e66] pr-3">繝｡繧､繝｡繝ｼ繧偵ｂ縺｣縺ｨ蠢ｫ驕ｩ縺ｫ</span>
                </div>
            </div>
            <button onclick="showPremiumModal({source:'ad_banner'})" class="shrink-0 px-3 py-1 bg-[#bca37f] text-white rounded-full text-[10px] font-bold hover:bg-[#8b7e66] transition-all">
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
    trackAdImpressionAnalytics('web_fallback', {
        ad_source: 'html_banner',
        os_platform: getPlatform(),
        is_test_ad: 0
    });
}

function hideAdBanner() {
    const container = document.getElementById('admob-banner');
    if (container) {
        container.style.display = 'none';
        container.style.bottom = '';
        container.style.visibility = '';
        container.style.pointerEvents = '';
        container.innerHTML = '';
    }
    adBannerVisible = false;
    adBannerMode = null;
    adBannerSuppressedByOverlay = false;
    nativeAdMobBannerLoaded = false;
    nativeAdMobBannerFailed = false;
    document.body.style.removeProperty('--ad-screen-safe-space');
    document.body.classList.remove('has-ad-banner');

    const AdMob = getAdMobPlugin();
    if (AdMob) {
        try {
            const hideResult = AdMob.hideBanner();
            if (hideResult && typeof hideResult.catch === 'function') {
                hideResult.catch((e) => console.warn('ADMOB: hideBanner failed', e));
            }
        } catch (e) { console.warn('ADMOB: hideBanner failed', e); }
    }
}

window.MeimayAdMobDebug = {
    getState: function () {
        return {
            platform: getPlatform(),
            nativeRuntime: isCapacitorNativeAdRuntime(),
            adMobPluginAvailable: !!getAdMobPlugin(),
            testAdMode: isAdMobTestAdMode(),
            privacyConfig: { ...AdMobPrivacyConfig },
            premiumActive: PremiumManager.isPremium(),
            visible: adBannerVisible,
            mode: adBannerMode,
            suppressedByOverlay: adBannerSuppressedByOverlay,
            nativeLoaded: nativeAdMobBannerLoaded,
            nativeFailed: nativeAdMobBannerFailed,
            safeSpace: document.body.style.getPropertyValue('--ad-screen-safe-space') || ''
        };
    },
    enableTestAds: function () {
        setAdMobTestAdMode(true);
        return this.getState();
    },
    disableTestAds: function () {
        setAdMobTestAdMode(false);
        return this.getState();
    }
};

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
                showPremiumModal({ source: 'drawer' });
            }
        }, 320);
        return;
    }

    if (typeof showPremiumModal === 'function') {
        showPremiumModal({ source: 'drawer' });
    }
}

function closePremiumModal() {
    const modal = document.getElementById('modal-ai-sound');
    if (modal) {
        modal.classList.remove('active');
        modal.style.removeProperty('z-index');
        delete modal.dataset.meimayModalKind;
    }
}

// 初期化
function initAdSystem() {
    installAdBannerSurfaceRefreshListeners();
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

function isLifetimePremiumProduct(productId) {
    const normalized = String(productId || '').trim().toLowerCase();
    if (!normalized) return false;
    return normalized.includes('lifetime')
        || normalized.includes('buyout')
        || normalized.includes('one_time')
        || normalized.includes('onetime')
        || normalized.includes('permanent');
}

function getConnectedPartnerPremiumSnapshot() {
    if (typeof MeimayPairing !== 'undefined' && MeimayPairing && MeimayPairing.roomCode && MeimayPairing.partnerUid
        && typeof MeimayShare !== 'undefined' && MeimayShare) {
        const liveSnapshot = typeof MeimayShare.getConnectedPremiumSnapshot === 'function'
            ? MeimayShare.getConnectedPremiumSnapshot()
            : (MeimayShare.partnerUserSnapshot || null);
        if (liveSnapshot) return liveSnapshot;
    }
    return getCachedConnectedPartnerPremiumSnapshot();
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
    const isStorePurchase = ['revenuecat', 'app_store', 'appstore', 'google_play', 'google'].includes(premiumSource) || !!productId;
    const isTrial = !isStorePurchase && (premiumSource === 'trial' || status === 'trialing' || trialStatus === 'active');
    const trialActive = !isStorePurchase && trialStatus === 'active';
    const trialConsumed = !!trialConsumedAt || trialStatus === 'consumed' || trialStatus === 'expired' || (hasTrialIndicators && expired);
    const localFallbackActive = options.allowLocalFallback === true
        && !hasPremiumIndicators
        && options.localPremium === true;
    const isPartner = source === 'partner';
    const active = !expired
        && (explicitPremium === true || status === 'active' || status === 'trialing' || trialActive || localFallbackActive)
        && !(isPartner && isTrial);
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
            detail = expiresLabel
                ? `${expiresLabel}まで無料でプレミアムを体験できます。`
                : '無料でプレミアムを体験できます。';
            if (isPartner) {
                detail = `パートナー特典で、${detail}`;
            }
        } else {
            if (expiresLabel) {
                detail = `${expiresLabel}までプレミアムが有効です。`;
            } else if (isLifetimePremiumProduct(productId)) {
                detail = '買い切りプレミアムが有効です。';
            } else {
                detail = 'プレミアムが有効です。';
            }
            if (isPartner) {
                detail = `パートナー特典で、${detail}`;
            }
        }
    } else if (expired) {
        label = 'プレミアム期限切れ';
        detail = '現在は無料プランです。';
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

function getFreshPremiumDisplayCacheState() {
    const adCache = hasFreshPremiumAdSuppressionCache()
        ? getPremiumAdSuppressionCache()
        : null;
    if (adCache) {
        const cachedSelfState = buildPremiumMembershipState({
            isPremium: true,
            premiumSource: adCache.premiumSource || 'revenuecat',
            subscriptionStatus: 'active',
            appStoreExpiresAt: adCache.expiresAt || null,
            premiumExpiresAt: adCache.expiresAt || null,
            appStoreProductId: adCache.productId || null,
            premiumProductId: adCache.productId || null
        }, 'self', { allowLocalFallback: false });
        if (cachedSelfState && cachedSelfState.active) return cachedSelfState;
    }

    const partnerSnapshot = getCachedConnectedPartnerPremiumSnapshot();
    const partnerState = partnerSnapshot
        ? buildPremiumMembershipState(partnerSnapshot, 'partner', { allowLocalFallback: false })
        : null;
    if (partnerState && partnerState.active && !partnerState.isTrial) return partnerState;

    return null;
}

function isPremiumStatusResolvingForDisplay() {
    if (PremiumManager.isPurchaseStateCheckPending && PremiumManager.isPurchaseStateCheckPending()) return true;
    const completed = PremiumManager.hasCompletedPurchaseStateCheck && PremiumManager.hasCompletedPurchaseStateCheck();
    return !completed && Date.now() - adSystemStartedAt < AD_PREMIUM_STATE_GRACE_MS;
}

function getRevenueCatPremiumRecordFromManager() {
    if (typeof PremiumManager === 'undefined' || !PremiumManager) return null;
    const hasStoreData = typeof PremiumManager._storePremium === 'boolean'
        || !!PremiumManager._storeStatus
        || !!PremiumManager._storeAppStoreExpiresAt
        || !!PremiumManager._storeExpiresAt
        || !!PremiumManager._storeProductId;
    if (!hasStoreData) return null;

    return {
        isPremium: PremiumManager._storePremium,
        premiumSource: PremiumManager._storePremiumSource || 'revenuecat',
        subscriptionStatus: PremiumManager._storeStatus || null,
        appStoreExpiresAt: PremiumManager._storeAppStoreExpiresAt || null,
        premiumExpiresAt: PremiumManager._storeExpiresAt || null,
        appStoreProductId: PremiumManager._storeProductId || null,
        premiumProductId: PremiumManager._storeProductId || null,
        appStoreLastNotificationType: PremiumManager._storeLastNotificationType || null,
        latestNotificationType: PremiumManager._storeLastNotificationType || null,
        trialStatus: null,
        trialStartedAt: null,
        trialEndsAt: null,
        trialConsumedAt: null,
        trialConsumedByRoom: false
    };
}

function buildPublicPremiumSnapshotFromRecord(record, state) {
    const sourceRecord = record || {};
    const membership = state || buildPremiumMembershipState(sourceRecord, 'self', { allowLocalFallback: false });
    return {
        isPremium: !!(membership && membership.active),
        premiumSource: sourceRecord.premiumSource || null,
        subscriptionStatus: sourceRecord.subscriptionStatus || null,
        premiumStatus: sourceRecord.subscriptionStatus || null,
        appStoreExpiresAt: sourceRecord.appStoreExpiresAt || null,
        premiumExpiresAt: sourceRecord.premiumExpiresAt || sourceRecord.appStoreExpiresAt || null,
        appStoreProductId: sourceRecord.appStoreProductId || sourceRecord.premiumProductId || null,
        premiumProductId: sourceRecord.premiumProductId || sourceRecord.appStoreProductId || null,
        appStoreLastNotificationType: sourceRecord.appStoreLastNotificationType || sourceRecord.latestNotificationType || null,
        latestNotificationType: sourceRecord.latestNotificationType || sourceRecord.appStoreLastNotificationType || null,
        trialStatus: sourceRecord.trialStatus || null,
        trialStartedAt: sourceRecord.trialStartedAt || null,
        trialEndsAt: sourceRecord.trialEndsAt || null,
        trialConsumedAt: sourceRecord.trialConsumedAt || null,
        trialConsumedByRoom: sourceRecord.trialConsumedByRoom === true
    };
}

function getSelfPremiumMembershipState() {
    const localPreviewMode = typeof getLocalPremiumQueryPreviewMode === 'function'
        ? getLocalPremiumQueryPreviewMode()
        : '';
    const localPreviewTrialEndsAt = localPreviewMode === 'trial'
        ? new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()
        : null;
    const storeRecord = !localPreviewMode && typeof getRevenueCatPremiumRecordFromManager === 'function'
        ? getRevenueCatPremiumRecordFromManager()
        : null;
    const storeState = storeRecord
        ? buildPremiumMembershipState(storeRecord, 'self', { allowLocalFallback: false })
        : null;

    if (storeState && (storeState.active || storeState.expired)) {
        return storeState;
    }

    const remoteState = buildPremiumMembershipState({
        isPremium: localPreviewMode ? true : PremiumManager._remotePremium,
        premiumSource: localPreviewMode === 'trial' ? 'trial' : PremiumManager._remotePremiumSource,
        subscriptionStatus: localPreviewMode === 'trial' ? 'trialing' : PremiumManager._remoteStatus,
        appStoreExpiresAt: PremiumManager._remoteAppStoreExpiresAt,
        premiumExpiresAt: localPreviewTrialEndsAt || PremiumManager._remoteExpiresAt,
        appStoreProductId: PremiumManager._remoteProductId,
        premiumProductId: PremiumManager._remoteProductId,
        trialStatus: localPreviewMode === 'trial' ? 'active' : PremiumManager._remoteTrialStatus,
        trialStartedAt: localPreviewMode === 'trial' ? new Date().toISOString() : PremiumManager._remoteTrialStartedAt,
        trialEndsAt: localPreviewTrialEndsAt || PremiumManager._remoteTrialEndsAt,
        trialConsumedAt: localPreviewMode === 'trial' ? new Date().toISOString() : PremiumManager._remoteTrialConsumedAt,
        trialConsumedByRoom: localPreviewMode === 'trial' ? false : PremiumManager._remoteTrialConsumedByRoom
    }, 'self', {
        localPremium: localPreviewMode
            ? true
            : (typeof PremiumManager.getLocalPremiumState === 'function'
                ? PremiumManager.getLocalPremiumState()
                : false),
        allowLocalFallback: isLocalPremiumFallbackAllowed()
    });

    if (remoteState && (remoteState.active || remoteState.expired || remoteState.hasPremiumIndicators)) {
        return remoteState;
    }
    if (storeState && storeState.hasPremiumIndicators) {
        return storeState;
    }
    return remoteState;
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
    const shareablePartnerState = partnerState && !partnerState.isTrial ? partnerState : null;
    const cachedPremiumState = getFreshPremiumDisplayCacheState();

    if (selfState.active) return selfState;
    if (shareablePartnerState && shareablePartnerState.active) return shareablePartnerState;
    // Keep the last confirmed premium state while the native store check catches up.
    if (cachedPremiumState && cachedPremiumState.active) return cachedPremiumState;
    if (selfState.expired) return selfState;
    if (selfState.hasPremiumIndicators) return selfState;
    if (shareablePartnerState && shareablePartnerState.expired) return shareablePartnerState;
    if (shareablePartnerState && shareablePartnerState.hasPremiumIndicators) return shareablePartnerState;

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

function getPremiumRemainingLabel(expiresAt) {
    const date = normalizePremiumDate(expiresAt);
    if (!date) return '';
    const diffMs = date.getTime() - Date.now();
    if (diffMs <= 0) return '';
    const hourMs = 60 * 60 * 1000;
    const dayMs = 24 * hourMs;
    if (diffMs < dayMs) {
        return `あと${Math.max(1, Math.ceil(diffMs / hourMs))}時間`;
    }
    return `あと${Math.max(1, Math.ceil(diffMs / dayMs))}日`;
}

function getPremiumActiveDetailSentence(state, dateLabel) {
    if (!state || !state.active) return '';
    const remainingLabel = getPremiumRemainingLabel(state.expiresAt);
    let sentence = '';
    if (state.isTrial) {
        const period = remainingLabel || (dateLabel ? `${dateLabel}まで` : '');
        sentence = period
            ? `${period}、プレミアム機能を使えます。`
            : 'プレミアム機能を使えます。';
    } else if (dateLabel) {
        sentence = `${dateLabel}までプレミアムが有効です。`;
    } else if (isLifetimePremiumProduct(state.productId)) {
        sentence = '期限なしでプレミアムが有効です。';
    } else {
        sentence = 'プレミアムが有効です。';
    }
    return state.source === 'partner' ? `パートナー特典で、${sentence}` : sentence;
}

PremiumManager.getDisplayStatus = function () {
    const state = this.getMembershipState();
    const selfState = getSelfPremiumMembershipState();
    const trialUnavailable = !!(selfState && selfState.trialConsumed);
    const remainingLabel = getPremiumRemainingLabel(state.expiresAt);
    const dateLabel = state.expiresAt ? formatPremiumMembershipDate(state.expiresAt) : '';
    const cachedPremiumState = !state.active && !state.expired && !state.hasPremiumIndicators
        ? getFreshPremiumDisplayCacheState()
        : null;
    const resolving = !state.active && isPremiumStatusResolvingForDisplay();

    if (state.active && state.isTrial) {
        const ownerText = state.source === 'partner' ? 'パートナー特典' : '無料体験';
        const periodText = remainingLabel || (dateLabel ? `${dateLabel}まで` : '利用中');
        return {
            active: true,
            expired: false,
            kind: 'trial',
            drawerLines: ['👑 プレミアム', `${ownerText}・${periodText}`],
            homeTitle: state.source === 'partner' ? 'パートナー特典' : '無料体験中',
            homeDetail: getPremiumActiveDetailSentence(state, dateLabel),
            shortLabel: `プレミアム${remainingLabel ? `・${remainingLabel}` : ''}`
        };
    }

    if (state.active) {
        const ownerText = state.source === 'partner' ? 'パートナー特典' : 'プレミアム';
        const periodText = remainingLabel || (dateLabel ? `${dateLabel}まで` : '有効');
        return {
            active: true,
            expired: false,
            kind: 'premium',
            drawerLines: ['👑 プレミアム', `${ownerText}・${periodText}`],
            homeTitle: state.source === 'partner' ? 'パートナー特典' : 'プレミアム利用中',
            homeDetail: getPremiumActiveDetailSentence(state, dateLabel),
            shortLabel: `プレミアム${remainingLabel ? `・${remainingLabel}` : ''}`
        };
    }

    if (cachedPremiumState && cachedPremiumState.active) {
        const cachedDateLabel = cachedPremiumState.expiresAt ? formatPremiumMembershipDate(cachedPremiumState.expiresAt) : '';
        const ownerText = cachedPremiumState.source === 'partner' ? 'パートナー特典' : 'プレミアム';
        const periodText = cachedDateLabel ? `${cachedDateLabel}まで` : '有効';
        return {
            active: true,
            expired: false,
            kind: 'premium-cache',
            source: cachedPremiumState.source,
            drawerLines: ['👑 プレミアム', `${ownerText}・${periodText}`],
            homeTitle: cachedPremiumState.source === 'partner' ? 'パートナー特典' : 'プレミアム利用中',
            homeDetail: cachedPremiumState.source === 'partner'
                ? `パートナー特典で、${periodText === '有効' ? 'プレミアムが有効です。' : `${periodText}プレミアムが有効です。`}`
                : (cachedDateLabel ? `${cachedDateLabel}までプレミアムが有効です。` : 'プレミアムが有効です。'),
            shortLabel: `プレミアム${cachedDateLabel ? `・${cachedDateLabel}まで` : ''}`
        };
    }

    if (resolving) {
        return {
            active: false,
            expired: false,
            kind: 'checking',
            drawerLines: ['購入状態を確認中', '完了後に反映します'],
            homeTitle: '購入状態を確認中',
            homeDetail: 'ストアの購入情報を確認しています。完了すると自動で反映されます。',
            shortLabel: '購入状態を確認中'
        };
    }

    if (state.expired) {
        return {
            active: false,
            expired: true,
            kind: 'expired',
            drawerLines: ['プレミアム期限切れ', '無料プラン'],
            homeTitle: '無料プラン',
            homeDetail: 'プレミアム期限切れ',
            shortLabel: '無料プラン'
        };
    }

    if (trialUnavailable) {
        return {
            active: false,
            expired: false,
            kind: 'free-used-trial',
            drawerLines: ['無料プラン', '無料体験は利用済み'],
            homeTitle: '無料プラン',
            homeDetail: '無料体験は利用済み',
            shortLabel: '無料プラン'
        };
    }

    return {
        active: false,
        expired: false,
        kind: 'free',
        drawerLines: ['無料プラン', '3日無料体験あり'],
        homeTitle: '無料プラン',
        homeDetail: '3日無料体験あり',
        shortLabel: '無料プラン・3日無料体験あり'
    };
};

PremiumManager.beginPurchaseStateCheck = function () {
    this._purchaseStateCheckInFlight = true;
    this._purchaseStateCheckStartedAt = Date.now();
    try {
        hideAdBanner();
    } catch (e) { }
    if (typeof updatePremiumUI === 'function') updatePremiumUI();
};

PremiumManager.endPurchaseStateCheck = function () {
    this._purchaseStateCheckInFlight = false;
    this._purchaseStateCheckCompletedAt = Date.now();
    if (typeof updatePremiumUI === 'function') updatePremiumUI();
};

PremiumManager.isPurchaseStateCheckPending = function () {
    const startedAt = Number(this._purchaseStateCheckStartedAt || 0);
    const stale = startedAt > 0
        && (this._purchaseStateCheckInFlight === true || this._silentStoreSyncInFlight === true)
        && Date.now() - startedAt > PREMIUM_PURCHASE_STATE_CHECK_TIMEOUT_MS;
    if (stale) {
        console.warn('PREMIUM: purchase state check timed out locally');
        this._purchaseStateCheckInFlight = false;
        this._silentStoreSyncInFlight = false;
        this._purchaseStateCheckCompletedAt = Date.now();
    }
    return this._purchaseStateCheckInFlight === true || this._silentStoreSyncInFlight === true;
};

PremiumManager.hasCompletedPurchaseStateCheck = function () {
    return Number(this._purchaseStateCheckCompletedAt || 0) > 0;
};

PremiumManager.hasFreshPremiumDisplayCache = function () {
    return !!getFreshPremiumDisplayCacheState();
};

PremiumManager.isPremiumStatusResolving = function () {
    return isPremiumStatusResolvingForDisplay();
};

PremiumManager.refreshPurchaseState = async function (restore = true, options = {}) {
    const silent = options && typeof options === 'object' && options.silent === true;
    const skipNativeStoreCheck = shouldSkipNativeStoreCheck(options);
    const user = typeof MeimayAuth !== 'undefined' && MeimayAuth.getCurrentUser
        ? MeimayAuth.getCurrentUser()
        : null;

    if (!user) {
        this.endPurchaseStateCheck();
        if (!silent && typeof showToast === 'function') {
            showToast('購入の復元にはサインインが必要です', 'i');
        }
        return false;
    }

    this.beginPurchaseStateCheck();
    try {
        await this.bindToUserDoc(user);
        let revenueCatChecked = false;
        if (!skipNativeStoreCheck && RevenueCatBridge.isAvailable()) {
            revenueCatChecked = await this.refreshRevenueCatCustomerInfo(user, restore);
        }
        if (typeof MeimayShare !== 'undefined' && MeimayShare && typeof MeimayShare.syncPremiumState === 'function') {
            const publicPremiumState = typeof this.getPublicPremiumSnapshot === 'function'
                ? this.getPublicPremiumSnapshot()
                : null;
            await MeimayShare.syncPremiumState(publicPremiumState);
        }
        if (!silent && typeof showToast === 'function') {
            const active = this.isPremium();
            const message = active
                ? '購入情報を同期しました'
                : (revenueCatChecked ? '購入情報を確認しました' : '購入の復元はアプリ版で使えます');
            showToast(message, active ? 'OK' : 'i');
        }
        return true;
    } catch (e) {
        console.warn('PREMIUM: refreshPurchaseState failed', e);
        if (!silent && typeof showToast === 'function') {
            showToast('購入情報を確認できませんでした', '!');
        }
        return false;
    } finally {
        this.endPurchaseStateCheck();
        if (getAdMobPremiumHoldReason() === '') {
            showAdBanner();
        }
    }
};

function getPremiumProductPlan(productId) {
    const normalized = String(productId || '').trim();
    return PREMIUM_PRODUCT_PLANS.find((plan) => plan.id === normalized) || null;
}

function getPremiumPlanAnalyticsParams(plan, extra = {}) {
    const priceText = String(plan?.price || '');
    const priceAmount = Number(priceText.replace(/[^\d.]/g, '')) || 0;
    return {
        product_id: plan?.id || '',
        plan_duration_months: plan?.durationMonths || 0,
        plan_type: plan?.lifetime ? 'lifetime' : 'pass',
        value: priceAmount,
        currency: 'JPY',
        ...extra
    };
}

function getFuturePremiumIsoDate(value) {
    const date = normalizePremiumDate(value);
    if (!date || date.getTime() <= Date.now()) return null;
    return date.toISOString();
}

function refreshPremiumModalIfOpen(options = {}) {
    const modal = document.getElementById('modal-ai-sound');
    if (!modal || !modal.classList.contains('active') || modal.dataset.meimayModalKind !== 'premium') return;
    if (!modal.querySelector('[data-premium-modal-root="true"]')) return;
    if (typeof showPremiumModal !== 'function') return;

    const syncMessage = String(options.syncMessage || '').trim();
    showPremiumModal({
        skipAutoSync: true,
        skipPostShowUiRefresh: true,
        syncMessage
    });
}

function refreshPremiumDependentScreens() {
    const searchScreen = document.getElementById('scr-kanji-search');
    if (searchScreen && searchScreen.classList.contains('active')) {
        if (typeof updateKanjiSearchTitle === 'function') updateKanjiSearchTitle();
        if (typeof updateSearchModeToggle === 'function') updateSearchModeToggle();
        if (typeof updateSearchAllKanjiToggle === 'function') updateSearchAllKanjiToggle();
        if (typeof executeKanjiSearch === 'function') executeKanjiSearch();
    }

    const rankingScreen = document.getElementById('scr-ranking');
    if (rankingScreen && rankingScreen.classList.contains('active') && typeof loadRanking === 'function') {
        Promise.resolve(loadRanking({ forceRefresh: true })).catch((error) => {
            console.warn('PREMIUM: failed to refresh ranking after premium state update', error);
        });
    }
}

PremiumManager._syncCurrentPremiumState = async function () {
    if (this.isPremium()) {
        hideAdBanner();
    } else {
        showAdBanner();
    }
    updatePremiumUI();
    refreshPremiumModalIfOpen({
        syncMessage: this.isPremium() ? 'プレミアムが有効になりました。' : ''
    });

    if (typeof MeimayShare !== 'undefined' && MeimayShare && typeof MeimayShare.syncPremiumState === 'function') {
        const publicPremiumState = typeof this.getPublicPremiumSnapshot === 'function'
            ? this.getPublicPremiumSnapshot()
            : null;
        if (publicPremiumState) {
            await MeimayShare.syncPremiumState(publicPremiumState);
        }
    }
};

PremiumManager._applyImmediateTrialResult = async function (result = {}) {
    const status = String(result?.status || '').trim();
    if (!['started', 'trial_active', 'paid_active'].includes(status)) return false;

    const nowIso = new Date().toISOString();

    if (status === 'paid_active') {
        const paidExpiresAt = getFuturePremiumIsoDate(this._storeExpiresAt || this._remoteExpiresAt || this._remoteAppStoreExpiresAt);
        const existingPaidSource = this._remotePremiumSource && this._remotePremiumSource !== 'trial'
            ? this._remotePremiumSource
            : null;
        this._remotePremium = true;
        this._remotePremiumSource = this._storePremiumSource || existingPaidSource || 'app_store';
        this._remoteStatus = 'active';
        this._remoteAppStoreExpiresAt = paidExpiresAt;
        this._remoteExpiresAt = paidExpiresAt;
        this._remoteProductId = this._remoteProductId || this._storeProductId || null;
        this._remoteLastNotificationType = this._remoteLastNotificationType || 'premium_trial_api_paid_active';
        this._remoteTrialStatus = null;
        this._remoteTrialStartedAt = null;
        this._remoteTrialEndsAt = null;
        this._remoteTrialConsumedAt = null;
        this._remoteTrialConsumedByRoom = false;
    } else {
        const trialEndsAt = getFuturePremiumIsoDate(result?.trialEndsAt || this._remoteTrialEndsAt || this._remoteExpiresAt);
        this._remotePremium = true;
        this._remotePremiumSource = 'trial';
        this._remoteStatus = 'trialing';
        this._remoteAppStoreExpiresAt = null;
        this._remoteExpiresAt = trialEndsAt;
        this._remoteProductId = null;
        this._remoteLastNotificationType = 'premium_trial_api_active';
        this._remoteTrialStatus = 'active';
        this._remoteTrialStartedAt = result?.trialStartedAt || this._remoteTrialStartedAt || nowIso;
        this._remoteTrialEndsAt = trialEndsAt;
        this._remoteTrialConsumedAt = this._remoteTrialConsumedAt || nowIso;
        this._remoteTrialConsumedByRoom = result?.consumesRoom === true;
    }

    await this._syncCurrentPremiumState();
    return this.isPremium();
};

PremiumManager._applyRevenueCatCustomerInfo = async function (result, fallbackProductId = '') {
    const customerInfo = result?.customerInfo || result || null;
    if (!customerInfo) return false;

    const entitlement = getRevenueCatEntitlement(customerInfo);
    const entitlementActive = getRevenueCatEntitlementActive(customerInfo);
    const productId = String(
        fallbackProductId
        || entitlement?.productIdentifier
        || entitlement?.productId
        || ''
    ).trim();
    const plan = getPremiumProductPlan(productId);
    const entitlementExpiresAt = getRevenueCatEntitlementDate(entitlement, [
        'expirationDate',
        'expirationDateMillis',
        'expiresDate',
        'expiresDateMillis'
    ]);
    const inferredExpiresAt = entitlementActive && !entitlementExpiresAt
        ? inferRevenueCatPlanExpiresAt(plan, entitlement)
        : null;
    const expiresAt = entitlementExpiresAt || inferredExpiresAt;
    const expired = !!expiresAt && expiresAt.getTime() <= Date.now();
    const active = entitlementActive && !expired;

    this._storePremium = active;
    this._storePremiumSource = 'revenuecat';
    this._storeStatus = active ? 'active' : (expired ? 'expired' : 'inactive');
    this._storeAppStoreExpiresAt = expiresAt ? expiresAt.toISOString() : null;
    this._storeExpiresAt = expiresAt ? expiresAt.toISOString() : null;
    this._storeProductId = productId || this._storeProductId || null;
    this._storeLastNotificationType = 'revenuecat_customer_info';

    if (active) {
        setPremiumAdSuppressionCache({
            productId,
            premiumSource: 'revenuecat',
            expiresAt: expiresAt ? expiresAt.toISOString() : null
        });
    } else {
        clearPremiumAdSuppressionCache();
    }

    if (active || expired || this._remotePremiumSource === 'revenuecat') {
        this._remotePremium = active;
        this._remotePremiumSource = 'revenuecat';
        this._remoteStatus = active ? 'active' : (expired ? 'expired' : 'inactive');
        this._remoteAppStoreExpiresAt = expiresAt ? expiresAt.toISOString() : null;
        this._remoteExpiresAt = expiresAt ? expiresAt.toISOString() : null;
        this._remoteProductId = productId || this._remoteProductId || null;
        this._remoteLastNotificationType = 'revenuecat_customer_info';
    }

    if (active) {
        this._remoteTrialStatus = null;
        this._remoteTrialStartedAt = null;
        this._remoteTrialEndsAt = null;
        this._remoteTrialConsumedAt = null;
        this._remoteTrialConsumedByRoom = false;
    }

    await this._syncCurrentPremiumState();
    return active;
};

PremiumManager.refreshRevenueCatCustomerInfo = async function (user, restore = false) {
    if (!RevenueCatBridge.isAvailable()) return false;
    const result = restore
        ? await RevenueCatBridge.restorePurchases(user)
        : await RevenueCatBridge.getCustomerInfo(user);
    return this._applyRevenueCatCustomerInfo(result);
};

PremiumManager.shouldRunSilentStoreSync = function (user, options = {}) {
    if (options.force === true) return true;
    if (!user || !user.uid) return false;
    if (this.isPremium()) return false;
    if (!RevenueCatBridge.isAvailable()) return false;

    const key = `${this.SILENT_STORE_SYNC_KEY}:${user.uid}`;
    const cooldownMs = Number(options.cooldownMs) || (24 * 60 * 60 * 1000);
    try {
        const lastAt = Number(localStorage.getItem(key) || 0);
        if (lastAt > 0 && Date.now() - lastAt < cooldownMs) return false;
    } catch (_) {
        return true;
    }
    return true;
};

PremiumManager.markSilentStoreSyncAttempt = function (user) {
    if (!user || !user.uid) return;
    try {
        localStorage.setItem(`${this.SILENT_STORE_SYNC_KEY}:${user.uid}`, String(Date.now()));
    } catch (_) {}
};

PremiumManager.syncPurchasesSilently = async function (user, options = {}) {
    if (!user || !user.uid) return false;
    if (shouldSkipNativeStoreCheck(options)) return false;
    if (this._silentStoreSyncInFlight) return false;
    if (!this.shouldRunSilentStoreSync(user, options)) return false;

    this._silentStoreSyncInFlight = true;
    this.beginPurchaseStateCheck();
    this.markSilentStoreSyncAttempt(user);
    try {
        await this.bindToUserDoc(user);
        const result = await RevenueCatBridge.syncPurchases(user);
        const active = await this._applyRevenueCatCustomerInfo(result);
        if (active && typeof MeimayShare !== 'undefined' && MeimayShare && typeof MeimayShare.syncPremiumState === 'function') {
            const publicPremiumState = typeof this.getPublicPremiumSnapshot === 'function'
                ? this.getPublicPremiumSnapshot()
                : null;
            await MeimayShare.syncPremiumState(publicPremiumState);
        }
        return active;
    } catch (error) {
        console.warn('PREMIUM: silent store purchase sync failed', error);
        return false;
    } finally {
        this._silentStoreSyncInFlight = false;
        this.endPurchaseStateCheck();
        if (getAdMobPremiumHoldReason() === '') {
            showAdBanner();
        }
    }
};

PremiumManager.startPurchase = async function (productId) {
    const plan = getPremiumProductPlan(productId);
    if (!plan) {
        if (typeof showToast === 'function') {
            showToast('購入プランを確認できませんでした', '!');
        }
        return false;
    }

    const user = typeof MeimayAuth !== 'undefined' && MeimayAuth.getCurrentUser
        ? MeimayAuth.getCurrentUser()
        : null;
    if (user && typeof this.bindToUserDoc === 'function') {
        try {
            await this.bindToUserDoc(user);
        } catch (e) {
            console.warn('PREMIUM: Failed to prepare purchase link', e);
        }
    }

    if (!RevenueCatBridge.isAvailable()) {
        if (typeof trackMeimayEvent === 'function') {
            trackMeimayEvent('premium_purchase_started', getPremiumPlanAnalyticsParams(plan, {
                revenuecat_available: 0
            }));
            trackMeimayEvent('premium_purchase_failed', getPremiumPlanAnalyticsParams(plan, {
                reason: 'revenuecat_unavailable'
            }));
        }
        if (typeof showToast === 'function') {
            showToast('購入はアプリ版で有効になります', 'i');
        }
        return false;
    }

    if (this._purchaseInProgress) {
        if (typeof showToast === 'function') {
            showToast('購入処理を確認しています', 'i');
        }
        return false;
    }

    try {
        this._purchaseInProgress = true;
        if (typeof trackMeimayEvent === 'function') {
            trackMeimayEvent('premium_purchase_started', getPremiumPlanAnalyticsParams(plan, {
                revenuecat_available: 1
            }));
        }
        const result = await RevenueCatBridge.purchaseProduct(plan.id, user);
        const active = await this._applyRevenueCatCustomerInfo(result, plan.id);
        await this.refreshPurchaseState(false);
        if (typeof trackMeimayEvent === 'function') {
            trackMeimayEvent('premium_purchase_completed', getPremiumPlanAnalyticsParams(plan, {
                active: active ? 1 : 0
            }));
        }
        if (typeof showToast === 'function') {
            showToast(active ? 'プレミアムが有効になりました' : '購入情報を確認しました', active ? 'OK' : 'i');
        }
        return active;
    } catch (e) {
        if (getRevenueCatUserCancelled(e)) {
            if (typeof trackMeimayEvent === 'function') {
                trackMeimayEvent('premium_purchase_cancelled', getPremiumPlanAnalyticsParams(plan, {
                    reason: 'user_cancelled'
                }));
            }
            if (typeof showToast === 'function') {
                showToast('購入をキャンセルしました', 'i');
            }
        } else {
            if (typeof trackMeimayEvent === 'function') {
                trackMeimayEvent('premium_purchase_failed', getPremiumPlanAnalyticsParams(plan, {
                    reason: 'exception'
                }));
            }
            console.warn('PREMIUM: RevenueCat purchase failed', e);
            if (typeof showToast === 'function') {
                showToast('購入を完了できませんでした', '!');
            }
        }
        return false;
    } finally {
        this._purchaseInProgress = false;
    }
};

function getPremiumTrialRoomNotice() {
    const inRoom = typeof MeimayPairing !== 'undefined' && MeimayPairing && MeimayPairing.roomCode;
    const hasPartner = inRoom && !!MeimayPairing.partnerUid;
    if (hasPartner) {
        return '無料体験はこのアカウントだけで開始します。パートナーの無料枠は消費しません。';
    }
    if (inRoom) {
        return 'パートナー参加前に開始すると、この端末の無料枠だけを使います。';
    }
    return '無料体験は1回だけ利用できます。';
}

function getPremiumTrialButtonLabel() {
    if (PremiumManager._trialStartInProgress) return '開始しています...';
    return '3日間無料で試す';
}

function getPremiumTrialToastMessage(result) {
    const status = String(result?.status || '').trim();
    if (status === 'started') {
        return '3日間の無料体験を開始しました';
    }
    if (status === 'trial_active') return '無料体験はすでに有効です';
    if (status === 'paid_active') return 'すでにプレミアムが有効です';
    if (status === 'trial_unavailable') return '無料体験は利用済みです';
    return '無料体験の状態を確認しました';
}

const PremiumTrialNudge = {
    KEY: 'meimay_premium_trial_nudge_v1',
    COOLDOWN_MS: 3 * 24 * 60 * 60 * 1000,
    REPEAT_MS: 24 * 60 * 60 * 1000,
    SUPPRESS_AFTER_PARTNER_MS: 5 * 60 * 1000,
    MIN_SWIPES: 12,
    MAX_SHOWS: 3,
    AUTO_MODAL_ENABLED: false,
    _timer: null,

    loadState: function () {
        try {
            const raw = localStorage.getItem(this.KEY);
            const parsed = raw ? JSON.parse(raw) : {};
            return parsed && typeof parsed === 'object' ? parsed : {};
        } catch (e) {
            return {};
        }
    },

    saveState: function (state) {
        try {
            localStorage.setItem(this.KEY, JSON.stringify(state || {}));
        } catch (e) { }
    },

    isEligible: function () {
        const membership = typeof PremiumManager !== 'undefined' && typeof PremiumManager.getMembershipState === 'function'
            ? PremiumManager.getMembershipState()
            : null;
        if (membership && membership.active) return false;

        const selfState = typeof getSelfPremiumMembershipState === 'function'
            ? getSelfPremiumMembershipState()
            : null;
        if (selfState && selfState.trialConsumed) return false;

        const state = this.loadState();
        return !state.trialStartedAt;
    },

    record: function (trigger, payload = {}) {
        if (!this.isEligible()) return false;

        const now = Date.now();
        const state = this.loadState();
        const next = {
            ...state,
            firstActionAt: state.firstActionAt || now,
            updatedAt: now,
            lastTrigger: trigger
        };

        if (trigger === 'save') {
            const savedCount = Number(payload.savedCount);
            next.savedCount = Number.isFinite(savedCount)
                ? Math.max(Number(next.savedCount || 0), savedCount)
                : Math.max(1, Number(next.savedCount || 0));
        } else if (trigger === 'build') {
            next.buildCount = Math.max(1, Number(next.buildCount || 0) + 1);
        } else if (trigger === 'partner') {
            next.partnerLinked = true;
            next.partnerLinkedAt = now;
            next.suppressUntil = Math.max(Number(next.suppressUntil || 0), now + this.SUPPRESS_AFTER_PARTNER_MS);
        } else if (String(trigger || '').includes('swipe')) {
            const swipeCount = Number(payload.swipeCount);
            next.swipeSignals = Number(next.swipeSignals || 0) + 1;
            next.dailySwipeCount = Number.isFinite(swipeCount)
                ? Math.max(Number(next.dailySwipeCount || 0), swipeCount)
                : Number(next.dailySwipeCount || 0);
        }

        this.saveState(next);
        this.schedule(trigger, payload);
        return true;
    },

    schedule: function (trigger, payload = {}) {
        if (this._timer) {
            clearTimeout(this._timer);
            this._timer = null;
        }
        if (!this.AUTO_MODAL_ENABLED) return false;

        const delay = Number.isFinite(Number(payload.delayMs)) ? Number(payload.delayMs) : 900;
        this._timer = setTimeout(() => {
            this._timer = null;
            this.maybeShow(trigger);
        }, Math.max(0, delay));
        return true;
    },

    maybeShow: function (trigger) {
        const state = this.loadState();
        if (!this.shouldShow(trigger, state)) return false;
        return this.show(trigger, state);
    },

    shouldShow: function (trigger, state) {
        if (!this.AUTO_MODAL_ENABLED) return false;
        if (!this.isEligible()) return false;
        if (document.hidden) return false;

        const activeOverlay = document.querySelector('.overlay.active');
        if (activeOverlay) return false;

        const activeSwipeCard = document.querySelector('.card.swipe-right, .card.swipe-left, .card.swipe-up');
        if (activeSwipeCard) return false;

        const now = Date.now();
        const dismissedAt = Number(state.dismissedAt || 0);
        const shownAt = Number(state.shownAt || 0);
        const shownCount = Number(state.shownCount || 0);
        const suppressUntil = Number(state.suppressUntil || 0);
        if (shownCount >= this.MAX_SHOWS) return false;
        if (suppressUntil && now < suppressUntil) return false;
        if (dismissedAt && now - dismissedAt < this.COOLDOWN_MS) return false;
        if (shownAt && now - shownAt < this.REPEAT_MS) return false;

        if (trigger === 'save' && Number(state.savedCount || 0) >= 1) return true;
        if (trigger === 'build' && Number(state.buildCount || 0) >= 1) return true;
        if (trigger === 'partner' && state.partnerLinked === true) return true;
        if (String(trigger || '').includes('swipe')) {
            return Number(state.swipeSignals || 0) >= this.MIN_SWIPES
                || Number(state.dailySwipeCount || 0) >= this.MIN_SWIPES;
        }

        return Number(state.savedCount || 0) >= 1
            || Number(state.buildCount || 0) >= 1
            || Number(state.swipeSignals || 0) >= this.MIN_SWIPES
            || state.partnerLinked === true;
    },

    getContext: function (trigger, state) {
        const roomNote = 'プレミアムの無料体験はこのアカウントだけで開始します。今の候補やストックはそのまま残ります。';

        if (trigger === 'partner' || state.partnerLinked === true) {
            return {
                title: 'プレミアムを3日間無料で体験できます',
                body: '広告なし、スワイプ無制限、人名用漢字まで一度まとめて確認できます。' + roomNote
            };
        }

        if (trigger === 'save' || Number(state.savedCount || 0) >= 1) {
            return {
                title: 'プレミアムを3日間無料で体験できます',
                body: '気になる名前が出てきた今なら、広告なし・スワイプ無制限・人名用漢字までまとめて確認できます。' + roomNote
            };
        }

        if (trigger === 'build' || Number(state.buildCount || 0) >= 1) {
            return {
                title: 'プレミアムを3日間無料で体験できます',
                body: '候補づくりの流れを止めずに、上限なしで漢字や読みを追加できます。' + roomNote
            };
        }

        return {
            title: 'プレミアムを3日間無料で体験できます',
            body: 'もう少し見比べたい時に、広告なし・スワイプ無制限で続けられます。' + roomNote
        };
    },

    show: function (trigger, state) {
        const next = {
            ...(state || {}),
            shownAt: Date.now(),
            shownCount: Number((state || {}).shownCount || 0) + 1,
            lastShownTrigger: trigger
        };
        this.saveState(next);

        if (typeof showPremiumModal === 'function') {
            showPremiumModal();
        }
        return true;
    },

    dismiss: function () {
        const state = this.loadState();
        this.saveState({
            ...state,
            dismissedAt: Date.now(),
            updatedAt: Date.now()
        });

        const modal = document.getElementById('modal-ai-sound');
        if (modal && modal.dataset.premiumTrialNudge === 'true') {
            modal.classList.remove('active');
            modal.innerHTML = '';
            delete modal.dataset.premiumTrialNudge;
        }
    },

    openPremium: function () {
        const state = this.loadState();
        this.saveState({
            ...state,
            openedAt: Date.now(),
            dismissedAt: Date.now(),
            updatedAt: Date.now()
        });

        const modal = document.getElementById('modal-ai-sound');
        if (modal && modal.dataset.premiumTrialNudge === 'true') {
            modal.classList.remove('active');
            modal.innerHTML = '';
            delete modal.dataset.premiumTrialNudge;
        }

        setTimeout(() => {
            if (typeof showPremiumModal === 'function') showPremiumModal();
        }, 80);
    },

    markTrialStatus: function (status) {
        const normalized = String(status || '').trim();
        if (!['started', 'trial_active', 'paid_active'].includes(normalized)) return;
        const state = this.loadState();
        this.saveState({
            ...state,
            trialStartedAt: Date.now(),
            updatedAt: Date.now()
        });
    }
};

PremiumManager.startTrial = async function () {
    if (this._trialStartInProgress) return false;

    const user = typeof MeimayAuth !== 'undefined' && MeimayAuth.getCurrentUser
        ? MeimayAuth.getCurrentUser()
        : null;
    if (!user) {
        if (typeof showToast === 'function') {
            showToast('無料体験の開始準備をしています。少し待ってからもう一度お試しください', 'i');
        }
        return false;
    }

    this._trialStartInProgress = true;
    if (typeof trackMeimayEvent === 'function') {
        trackMeimayEvent('premium_trial_started', {
            has_partner: (typeof MeimayPairing !== 'undefined' && MeimayPairing && MeimayPairing.partnerUid) ? 1 : 0,
            in_room: (typeof MeimayPairing !== 'undefined' && MeimayPairing && MeimayPairing.roomCode) ? 1 : 0
        });
    }
    if (typeof showPremiumModal === 'function') showPremiumModal();

    try {
        const headers = typeof getFirebaseRequestHeaders === 'function'
            ? await getFirebaseRequestHeaders()
            : { 'Content-Type': 'application/json' };
        const trialUrl = typeof getMeimayApiUrl === 'function'
            ? getMeimayApiUrl('/api/premium-trial')
            : '/api/premium-trial';
        const response = await fetch(trialUrl, {
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

        if (typeof PremiumTrialNudge !== 'undefined' && PremiumTrialNudge && typeof PremiumTrialNudge.markTrialStatus === 'function') {
            PremiumTrialNudge.markTrialStatus(result.status);
        }

        if (typeof this._applyImmediateTrialResult === 'function') {
            await this._applyImmediateTrialResult(result);
        }
        await this.refreshPurchaseState();
        if (typeof trackMeimayEvent === 'function') {
            trackMeimayEvent('premium_trial_completed', {
                status: result.status || '',
                active: (result.status === 'started' || result.status === 'trial_active' || result.status === 'paid_active') ? 1 : 0
            });
        }
        if (typeof showPremiumModal === 'function') showPremiumModal();
        return result.status === 'started' || result.status === 'trial_active' || result.status === 'paid_active';
    } catch (e) {
        if (typeof trackMeimayEvent === 'function') {
            trackMeimayEvent('premium_trial_failed', {
                reason: 'exception'
            });
        }
        console.warn('PREMIUM: startTrial failed', e);
        if (typeof showToast === 'function') {
            showToast('無料体験を開始できませんでした。通信状態を確認してください', '!');
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

    const stockScreen = document.getElementById('scr-stock');
    if (typeof renderStock === 'function' && stockScreen && stockScreen.classList.contains('active')) {
        renderStock();
    }

    const buildScreen = document.getElementById('scr-build');
    if (typeof renderBuildSelection === 'function' && buildScreen && buildScreen.classList.contains('active')) {
        renderBuildSelection();
    }

    if (typeof updateDailyRemainingDisplay === 'function') {
        updateDailyRemainingDisplay();
    }

    const kanjiDetailModal = document.getElementById('modal-kanji-detail');
    if (kanjiDetailModal
        && kanjiDetailModal.classList.contains('active')
        && typeof refreshKanjiDetailAiButtonState === 'function') {
        refreshKanjiDetailAiButtonState();
    }

    if (typeof renderUniversalCard === 'function') {
        const universalScreen = document.getElementById('scr-swipe-universal');
        if (universalScreen && universalScreen.classList.contains('active')) {
            if (state.active
                && typeof SwipeState !== 'undefined'
                && SwipeState
                && SwipeState.dailyLimitMode === 'reading'
                && Array.isArray(SwipeState.premiumUnlockCandidates)
                && SwipeState.premiumUnlockCandidates.length > 0) {
                SwipeState.candidates = SwipeState.premiumUnlockCandidates.slice();
                SwipeState.currentIndex = Math.min(
                    Number(SwipeState.currentIndex) || 0,
                    SwipeState.candidates.length
                );
                SwipeState.dailyLimitMode = null;
            }
            renderUniversalCard();
        }
    }

    if (typeof render === 'function') {
        const kanjiSwipeScreen = document.getElementById('scr-main');
        if (kanjiSwipeScreen && kanjiSwipeScreen.classList.contains('active')) {
            const stackExhausted = Array.isArray(stack) && currentIdx >= stack.length;
            if (state.active
                && stackExhausted
                && typeof isFreeSwipeMode !== 'undefined'
                && isFreeSwipeMode
                && typeof startFreeSwiping === 'function') {
                startFreeSwiping();
            } else if (state.active && stackExhausted && Array.isArray(segments) && segments.length > 0 && typeof loadStack === 'function') {
                currentIdx = 0;
                loadStack();
            } else {
                render();
            }
        }
    }

    if (typeof renderSettingsScreen === 'function') {
        renderSettingsScreen();
    }

    refreshPremiumDependentScreens();
}

function formatPremiumMatrixCell(value) {
    return escapePremiumHtml(value).replace(/\n/g, '<br>');
}

function renderPremiumComparisonMatrix() {
    const rows = [
        { item: '使える漢字', free: '常用漢字', premium: '常用漢字\n＋人名用漢字' },
        { item: '広告', free: '表示あり', premium: '非表示' },
        { item: '読みスワイプ', free: '1日100回', premium: '無制限' },
        { item: '漢字スワイプ', free: '1日100回', premium: '無制限' },
        { item: 'AI漢字深掘り', free: '1日1回', premium: '無制限' },
        { item: 'AI由来生成', free: '1日1回', premium: '無制限' }
    ];

    return ''
        + '<div class="overflow-hidden rounded-[18px] border border-[#e4d9c6] bg-[#fffdf7]">'
        + '<div class="grid grid-cols-[1.02fr_0.88fr_1.1fr] gap-x-2 border-b border-[#eadfcd] bg-[#f4ead8] px-3 py-2.5 text-[11px] sm:text-[12px] font-black text-[#5b4f3f]">'
        + '<div class="flex items-center">できること</div>'
        + '<div class="flex items-center justify-center">無料</div>'
        + '<div class="flex items-center justify-center text-[#8e6c36]">プレミアム</div>'
        + '</div>'
        + '<div class="divide-y divide-[#efe5d3]">'
        + rows.map(({ item, free, premium }) => ''
            + '<div class="grid grid-cols-[1.02fr_0.88fr_1.1fr] items-stretch gap-x-2 px-3 py-2.5 text-[11px] sm:text-[12px] leading-[1.5] text-[#2f271e]">'
            + '<div class="flex items-center font-bold">' + formatPremiumMatrixCell(item) + '</div>'
            + '<div class="flex items-center justify-center text-center"><span class="inline-flex min-h-[38px] w-full items-center justify-center whitespace-nowrap rounded-[12px] bg-white px-2 py-2 text-[10px] sm:text-[11px] font-semibold text-[#6c6252]">' + formatPremiumMatrixCell(free) + '</span></div>'
            + '<div class="flex items-center justify-center text-center"><span class="inline-flex min-h-[38px] w-full items-center justify-center rounded-[12px] border border-[#dfc28f] bg-[#fff5df] px-2 py-2 font-black text-[#5b4f3f]">' + formatPremiumMatrixCell(premium) + '</span></div>'
            + '</div>'
        ).join('')
        + '</div></div>';
}

function getPremiumModalSubtitle(state, options = {}) {
    return options && typeof options === 'object'
        ? String(options.subtitle || '').trim()
        : '';
}

function renderPremiumStatusCard(state) {
    const display = typeof PremiumManager !== 'undefined' && typeof PremiumManager.getDisplayStatus === 'function'
        ? PremiumManager.getDisplayStatus()
        : null;
    if (!display || (!display.active && display.kind === 'free')) return '';

    const title = display.homeTitle || (state && state.label) || '無料プラン';
    const active = !!display.active;
    const checking = display.kind === 'checking';
    const detail = display.homeDetail || (!active && state && state.detail) || '';
    const body = active
        ? ''
        : (checking
            ? ''
            : (display.kind === 'expired'
            ? '現在は無料プランです。'
            : '現在は無料プランです。必要になったらプレミアムへ進めます。'));
    const toneClass = active
        ? 'border-[#d5b677] bg-[#fff7e4] text-[#4b3a24]'
        : 'border-[#e4d9c6] bg-[#fffaf1] text-[#4b3a24]';
    const pillClass = active
        ? 'bg-[#b98942] text-white'
        : 'bg-white text-[#8b7e66] border border-[#e6dccb]';
    const pill = active ? '有効' : (checking ? '確認中' : (display.kind === 'expired' ? '期限切れ' : '無料'));

    return ''
        + '<div class="rounded-[18px] px-3 py-3 shadow-[0_10px_22px_rgba(123,95,52,0.08)] ' + toneClass + '">'
        + '<div class="flex items-start justify-between gap-3">'
        + '<div class="min-w-0">'
        + '<div class="text-[13px] sm:text-[15px] font-black leading-tight" style="word-break:keep-all;overflow-wrap:normal;">' + escapePremiumHtml(title) + '</div>'
        + (detail ? '<p class="mt-1 text-[12px] sm:text-[13px] leading-[1.6] text-[#6d5a3d]">' + escapePremiumHtml(detail) + '</p>' : '')
        + '</div>'
        + '<span class="shrink-0 rounded-full px-3 py-1 text-[10px] font-black ' + pillClass + '">' + escapePremiumHtml(pill) + '</span>'
        + '</div>'
        + (body ? '<p class="mt-2 text-[12px] sm:text-[13px] leading-[1.6] text-[#6d5a3d]">' + escapePremiumHtml(body) + '</p>' : '')
        + '</div>';
}

function renderPremiumTrialCard(state) {
    if (!state || state.active) return '';
    const display = typeof PremiumManager !== 'undefined' && typeof PremiumManager.getDisplayStatus === 'function'
        ? PremiumManager.getDisplayStatus()
        : null;
    if (display && (display.kind === 'premium-cache' || display.kind === 'checking')) return '';
    const selfState = getSelfPremiumMembershipState();
    const unavailable = selfState.trialConsumed;
    const buttonDisabled = unavailable || PremiumManager._trialStartInProgress;
    const disabledClass = buttonDisabled ? ' opacity-60 pointer-events-none' : '';
    const notice = unavailable ? '' : getPremiumTrialRoomNotice();
    const body = unavailable
        ? 'このアカウントでは無料体験を利用済みです。'
        : `3日間、プレミアム機能を無料で試せます。${notice ? ' ' + notice : ''}`;

    return ''
        + '<div class="rounded-[20px] border border-[#d7b57c] bg-[#fff7e8] px-3 py-3 shadow-[0_10px_24px_rgba(183,145,85,0.10)]">'
        + '<div class="flex items-start justify-between gap-3">'
        + '<div>'
        + '<div class="text-[10px] font-black tracking-[0.14em] text-[#b48642]">無料体験</div>'
        + '<p class="mt-1 text-[12px] sm:text-[13px] leading-[1.65] text-[#6d5a3d]">' + escapePremiumHtml(body) + '</p>'
        + '</div>'
        + '</div>'
        + '<button type="button" onclick="PremiumManager.startTrial()" class="mt-3 w-full py-2.5 rounded-2xl bg-[#b98942] text-white text-sm font-black shadow-md active:scale-[0.99]' + disabledClass + '">'
        + escapePremiumHtml(unavailable ? '無料体験は利用済み' : getPremiumTrialButtonLabel())
        + '</button>'
        + '</div>';
}

function renderPremiumPlanCards(state) {
    if (!state || state.active) return '';
    const display = typeof PremiumManager !== 'undefined' && typeof PremiumManager.getDisplayStatus === 'function'
        ? PremiumManager.getDisplayStatus()
        : null;
    if (display && (display.kind === 'premium-cache' || display.kind === 'checking')) return '';

    return ''
        + '<div class="overflow-hidden rounded-[20px] border border-[#e3d6c2] bg-white shadow-[0_12px_28px_rgba(123,95,52,0.08)]">'
        + '<div class="border-b border-[#eee3d2] bg-[#fbf6ed] px-4 py-3">'
        + '<div class="flex items-center justify-between gap-3">'
        + '<div class="text-[13px] sm:text-[14px] font-black text-[#4b3a24]">有料プラン</div>'
        + '<div class="shrink-0 text-[10px] sm:text-[11px] font-medium text-[#9a8a70]">購入・返金はストアで管理</div>'
        + '</div>'
        + '<p class="mt-1.5 text-[11px] sm:text-[12px] leading-[1.55] font-bold text-[#7a6a52]">有料プランを購入すると、連携中のパートナーも特典としてプレミアム機能を使えます。</p>'
        + '</div>'
        + '<div class="divide-y divide-[#f0e7d8]">'
        + PREMIUM_PRODUCT_PLANS.map((plan) => {
            const note = plan.note || '';
            const buttonClass = 'bg-[#fffaf2] text-[#5b4f3f] border border-[#d9c39f] shadow-[0_4px_12px_rgba(123,95,52,0.06)]';
            return ''
                + '<div class="grid grid-cols-[1fr_auto] items-center gap-3 px-4 py-3.5 bg-white">'
                + '<div class="min-w-0">'
                + '<div class="flex flex-wrap items-baseline gap-x-2 gap-y-1">'
                + '<span class="text-[13px] sm:text-[14px] font-black text-[#4b3a24]">' + escapePremiumHtml(plan.title) + '</span>'
                + (note ? '<span class="text-[10px] sm:text-[11px] font-medium text-[#9a8a70]">' + escapePremiumHtml(note) + '</span>' : '')
                + '</div>'
                + '<div class="mt-1.5 flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 text-[#3e3226]">'
                + '<span class="text-[21px] sm:text-[23px] font-black leading-none tracking-normal">' + escapePremiumHtml(plan.price) + '</span>'
                + (plan.description ? '<span class="text-[10px] font-medium text-[#8b7e66]">' + escapePremiumHtml(plan.description) + '</span>' : '')
                + '</div>'
                + '</div>'
                + '<button type="button" data-product-id="' + escapePremiumHtml(plan.id) + '" onclick="PremiumManager.startPurchase(this.dataset.productId)" class="min-w-[6.2rem] rounded-[999px] px-3.5 py-2.5 text-[12px] font-black active:scale-[0.99] transition-transform ' + buttonClass + '">'
                + escapePremiumHtml(plan.actionLabel)
                + '</button>'
                + '</div>';
        }).join('')
        + '</div>'
        + '</div>';
}

let premiumModalPurchaseSyncInFlight = false;

function renderPremiumPurchaseSyncNotice(state, message = '') {
    if (state && state.active) return '';
    const body = message || '購入済みの場合は自動で反映されます。反映されない場合は時間をおいて開き直してください。';
    return ''
        + '<div class="rounded-[16px] border border-[#eadfcd] bg-white/78 px-3 py-2.5 text-center">'
        + '<p id="premium-purchase-sync-note" class="text-[10px] sm:text-[11px] leading-[1.6] font-bold text-[#9a8a70]">' + escapePremiumHtml(body) + '</p>'
        + '</div>';
}

function updatePremiumPurchaseSyncNotice(message) {
    const note = document.getElementById('premium-purchase-sync-note');
    if (note) note.textContent = message;
}

function isPremiumModalActive() {
    const modal = document.getElementById('modal-ai-sound');
    return !!(modal && modal.classList.contains('active') && modal.dataset.meimayModalKind === 'premium');
}

function rerenderPremiumModalAfterSync(message) {
    if (isPremiumModalActive()) {
        showPremiumModal({
            skipAutoSync: true,
            syncMessage: message || ''
        });
    } else if (message) {
        updatePremiumPurchaseSyncNotice(message);
    }
}

async function syncPurchaseStateFromPremiumModal() {
    if (premiumModalPurchaseSyncInFlight) return;
    if (!PremiumManager || typeof PremiumManager.refreshPurchaseState !== 'function') return;
    if (typeof RevenueCatBridge !== 'undefined' && RevenueCatBridge && !RevenueCatBridge.isAvailable()) {
        updatePremiumPurchaseSyncNotice('購入状態はアプリ版で自動確認します。');
        return;
    }

    premiumModalPurchaseSyncInFlight = true;
    updatePremiumPurchaseSyncNotice('購入状態を確認しています。');
    const wasActive = PremiumManager.isPremium();

    try {
        const refreshed = await PremiumManager.refreshPurchaseState(false, { silent: true, reason: 'premium-modal' });
        if (!refreshed) {
            rerenderPremiumModalAfterSync('購入状態を確認できませんでした。時間をおいてもう一度お試しください。');
            return;
        }
        let isActive = PremiumManager.isPremium();
        const user = typeof MeimayAuth !== 'undefined' && MeimayAuth.getCurrentUser
            ? MeimayAuth.getCurrentUser()
            : null;
        if (!isActive && user && typeof PremiumManager.syncPurchasesSilently === 'function') {
            await PremiumManager.syncPurchasesSilently(user, {
                force: true,
                reason: 'premium-modal',
                cooldownMs: 0
            });
            isActive = PremiumManager.isPremium();
        }
        if (typeof updatePremiumUI === 'function') {
            updatePremiumUI();
        }
        rerenderPremiumModalAfterSync(isActive || wasActive
            ? '購入状態を同期しました。'
            : '購入状態を確認しました。');
    } catch (error) {
        console.warn('PREMIUM: premium modal sync failed', error);
        rerenderPremiumModalAfterSync('購入状態を確認できませんでした。時間をおいてもう一度お試しください。');
    } finally {
        premiumModalPurchaseSyncInFlight = false;
    }
}

function showPremiumModal(options = {}) {
    const modal = document.getElementById('modal-ai-sound');
    if (!modal) return;

    const state = typeof PremiumManager !== 'undefined' && typeof PremiumManager.getMembershipState === 'function'
        ? PremiumManager.getMembershipState()
        : { active: false, label: 'プレミアム未登録', detail: '' };
    const subtitle = getPremiumModalSubtitle(state, options);
    const syncMessage = options && typeof options === 'object' ? String(options.syncMessage || '') : '';
    if (typeof trackMeimayEvent === 'function') {
        trackMeimayEvent('paywall_view', {
            source: options && typeof options === 'object' ? (options.source || '') : '',
            premium_active: state && state.active ? 1 : 0,
            premium_expired: state && state.expired ? 1 : 0,
            has_trial_card: state && state.active ? 0 : 1,
            has_partner: (typeof MeimayPairing !== 'undefined' && MeimayPairing && MeimayPairing.partnerUid) ? 1 : 0
        });
    }

    modal.style.setProperty('z-index', '10030', 'important');
    modal.classList.add('active');
    modal.dataset.meimayModalKind = 'premium';
    modal.innerHTML = ''
        + '<div data-premium-modal-root="true" class="detail-sheet max-w-none" style="max-width:min(92vw, 860px); max-height:min(88vh, 760px); overflow-x:hidden; overflow-y:auto; padding: clamp(16px, 2.6vw, 24px); background:#f7efdde6; border:1px solid #e4d9c6; border-radius:30px; box-shadow:0 24px 80px rgba(93,77,62,0.18);" onclick="event.stopPropagation()">'
        + '<button class="modal-close-btn" style="top:14px;right:14px;width:40px;height:40px;font-size:22px;background:rgba(255,255,255,0.72);border:1px solid #eadfcd;" onclick="closePremiumModal()">×</button>'
        + '<div class="space-y-3">'
        + '<div class="text-center px-10 sm:px-0">'
        + '<h3 class="text-[1.25rem] sm:text-[1.55rem] font-black text-[#4b3a24]">👑プレミアム案内👑</h3>'
        + (subtitle ? '<p class="mt-1 text-[12px] sm:text-[13px] leading-[1.7] text-[#7a6a52]">' + escapePremiumHtml(subtitle) + '</p>' : '')
        + '</div>'
        + renderPremiumTrialCard(state)
        + renderPremiumStatusCard(state)
        + renderPremiumComparisonMatrix()
        + renderPremiumPlanCards(state)
        + renderPremiumPurchaseSyncNotice(state, syncMessage)
        + '<button onclick="closePremiumModal()" class="w-full py-2.5 ' + (state.active ? 'bg-gradient-to-r from-[#bca37f] to-[#8b7e66] text-white shadow-md' : 'border border-[#e6dccb] bg-white text-[#8b7e66]') + ' rounded-2xl font-bold text-sm">閉じる</button>'
        + '</div>'
        + '</div></div>';

    if (!state.active && !(options && options.skipAutoSync)) {
        setTimeout(syncPurchaseStateFromPremiumModal, 120);
    } else if (state.active && !(options && options.skipPostShowUiRefresh)) {
        setTimeout(() => {
            if (typeof updatePremiumUI === 'function') {
                updatePremiumUI();
            }
        }, 0);
    }
}

window.PremiumManager = PremiumManager;
window.RevenueCatBridge = RevenueCatBridge;
window.PremiumTrialNudge = PremiumTrialNudge;
window.showPremiumModal = showPremiumModal;
window.renderPremiumComparisonMatrix = renderPremiumComparisonMatrix;
window.formatPremiumMembershipDate = formatPremiumMembershipDate;
window.getConnectedPartnerPremiumSnapshot = getConnectedPartnerPremiumSnapshot;
window.getConnectedPremiumPartnerSnapshot = getConnectedPremiumPartnerSnapshot;
window.getCachedConnectedPartnerPremiumSnapshot = getCachedConnectedPartnerPremiumSnapshot;
window.setCachedConnectedPartnerPremiumSnapshot = setCachedConnectedPartnerPremiumSnapshot;
window.clearCachedConnectedPartnerPremiumSnapshot = clearCachedConnectedPartnerPremiumSnapshot;
window.buildPremiumMembershipState = buildPremiumMembershipState;
window.isLocalPremiumFallbackAllowed = isLocalPremiumFallbackAllowed;
window.openPremiumModalFromDrawer = openPremiumModalFromDrawer;
window.closePremiumModal = closePremiumModal;
window.hideAdBanner = hideAdBanner;
window.showAdBanner = showAdBanner;
window.refreshAdBannerAfterScreenChange = refreshAdBannerAfterScreenChange;
window.setAdBannerOverlaySuppressed = setAdBannerOverlaySuppressed;
window.syncAdBannerOverlaySuppression = syncAdBannerOverlaySuppression;
window.shouldDeferNativeMonetizationDuringWizard = shouldDeferNativeMonetizationDuringWizard;
