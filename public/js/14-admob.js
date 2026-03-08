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
        return this._remotePremium === true || this.getLocalPremiumState();
    },

    activate: function () {
        localStorage.setItem(this.KEY, JSON.stringify({
            active: true,
            activatedAt: new Date().toISOString()
        }));
        hideAdBanner();
        updatePremiumUI();
    },

    deactivate: function () {
        localStorage.removeItem(this.KEY);
        showAdBanner();
        updatePremiumUI();
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
            this._remotePremium = data.isPremium === true;
            this._remoteStatus = typeof data.subscriptionStatus === 'string'
                ? data.subscriptionStatus
                : null;

            if (this.isPremium()) {
                hideAdBanner();
            } else {
                showAdBanner();
            }
            updatePremiumUI();
        }, (error) => {
            console.warn('PREMIUM: Failed to subscribe user doc', error);
        });
    }
};

function getPlatform() {
    const ua = navigator.userAgent || '';
    if (/android/i.test(ua)) return 'android';
    if (/iPad|iPhone|iPod/.test(ua)) return 'ios';
    return 'web';
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
            margin: 0,
            isTesting: false
        });

        console.log('ADMOB: Native banner initialized');
    } catch (e) {
        console.warn('ADMOB: Native init failed, falling back to web', e);
        showWebAdBanner();
    }
}

function showWebAdBanner() {
    const container = document.getElementById('admob-banner');
    if (!container || PremiumManager.isPremium()) return;

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
window.closePremiumModal = closePremiumModal;
window.hideAdBanner = hideAdBanner;
window.showAdBanner = showAdBanner;

console.log("ADMOB: Module loaded (v19.0)");

PremiumManager.getStatusSummary = function () {
    if (this.isPremium()) {
        return {
            title: 'プレミアム利用中',
            detail: this._remoteStatus ? `状態: ${this._remoteStatus}` : '購入状態は有効です。'
        };
    }

    if (this._remoteStatus) {
        return {
            title: '購入状態を確認できます',
            detail: `現在の状態: ${this._remoteStatus}`
        };
    }

    return {
        title: '購入状態を確認できます',
        detail: 'アプリ版では購入後や復元後にここへ反映されます。'
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

    const isPremium = PremiumManager.isPremium();
    const statusSummary = PremiumManager.getStatusSummary();

    modal.classList.add('active');
    modal.innerHTML = `
        <div class="detail-sheet max-w-md" onclick="event.stopPropagation()">
            <button class="modal-close-btn" onclick="closePremiumModal()">×</button>
            <div class="text-center py-6">
                <div class="text-[10px] font-black text-[#bca37f] mb-4 tracking-widest uppercase">Premium Plan</div>
                <div class="text-4xl mb-4">名</div>
                <h3 class="text-lg font-black text-[#5d5444] mb-2">メイメー プレミアム</h3>
                <p class="text-xs text-[#a6967a] mb-4">広告を減らして、比較や整理をしやすくするプランです。</p>

                <div class="mb-6 rounded-2xl border border-[#eee5d8] bg-[#fff9f0] px-4 py-3 text-left">
                    <div class="text-[11px] font-black text-[#5d5444]">${statusSummary.title}</div>
                    <div class="mt-1 text-[11px] leading-relaxed text-[#8b7e66]">${statusSummary.detail}</div>
                </div>

                ${isPremium ? `
                    <div class="bg-[#f0fdf4] border border-green-200 rounded-2xl p-4 mb-6">
                        <p class="text-sm font-bold text-green-700">現在プレミアム利用中です</p>
                    </div>
                    <button onclick="PremiumManager.deactivate();closePremiumModal()" class="w-full py-3 bg-[#fef2f2] text-[#f28b82] rounded-2xl font-bold text-sm">
                        プレミアムを解除
                    </button>
                ` : `
                    <div class="space-y-3 mb-6 text-left px-4">
                        <div class="flex items-center gap-3">
                            <span class="text-lg">✓</span>
                            <span class="text-sm text-[#5d5444]">広告の表示を減らします</span>
                        </div>
                        <div class="flex items-center gap-3">
                            <span class="text-lg">✓</span>
                            <span class="text-sm text-[#5d5444]">比較や整理の体験を強化します</span>
                        </div>
                        <div class="flex items-center gap-3">
                            <span class="text-lg">✓</span>
                            <span class="text-sm text-[#5d5444]">購入状態の確認結果をこの画面に反映します</span>
                        </div>
                    </div>
                    <button onclick="PremiumManager.activate();closePremiumModal()" class="w-full py-4 bg-gradient-to-r from-[#bca37f] to-[#8b7e66] text-white rounded-2xl font-bold text-sm shadow-md">
                        プレミアムを有効にする
                    </button>
                    <button onclick="PremiumManager.refreshPurchaseState()" class="mt-3 w-full py-3 rounded-2xl border border-[#eadfce] bg-white text-[#8b7e66] font-bold text-sm">
                        購入状態を確認する
                    </button>
                    <p class="text-[9px] text-[#a6967a] mt-3">ネイティブ購入フローの本実装後は、ここから復元確認にもつながります。</p>
                `}
            </div>
        </div>
    `;
}

window.PremiumManager = PremiumManager;
window.showPremiumModal = showPremiumModal;
