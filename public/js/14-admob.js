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

    isPremium: function () {
        try {
            const data = localStorage.getItem(this.KEY);
            if (!data) return false;
            const parsed = JSON.parse(data);
            return parsed && parsed.active === true;
        } catch (e) {
            return false;
        }
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
