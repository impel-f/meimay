(function () {
    if (typeof window === 'undefined') return;

    const previousRefreshRankingOnStockChange = window.refreshRankingOnStockChange;

    window.getRankingPeriodSwitchLabel = function (period) {
        return period === 'monthly' ? '📅月間順位' : '🏆総合順位';
    };

    window.isRankingJinmeiKanji = function (kanjiData) {
        if (!kanjiData) return false;
        const commonFlag = kanjiData['常用漢字'];
        return !(commonFlag === true || commonFlag === 'true' || commonFlag === 1 || commonFlag === '1');
    };

    window.renderRankingPremiumBadge = function () {
        const premiumAccessActive = !!(typeof PremiumManager !== 'undefined'
            && PremiumManager
            && typeof PremiumManager.isPremium === 'function'
            && PremiumManager.isPremium());
        const badgeClass = premiumAccessActive
            ? 'pointer-events-none opacity-80'
            : 'cursor-pointer hover:scale-[1.03] hover:bg-[#f4ead8] hover:shadow-sm';
        const clickHandler = premiumAccessActive
            ? ''
            : ' onclick="event.stopPropagation();event.preventDefault();if (typeof showPremiumModal === \'function\') showPremiumModal();"';

        return `
            <span class="inline-flex items-center justify-center rounded-full border border-[#eadfce] bg-[#fff8e6] px-2 py-0.5 text-[9px] font-black leading-none text-[#b9965b] transition-all ${badgeClass}"
                title="人名用漢字"
                aria-label="人名用漢字"${clickHandler}>👑人名用</span>
        `;
    };

    window.refreshRankingOnStockChange = function () {
        if (typeof rankingStockRefreshTimer !== 'undefined' && rankingStockRefreshTimer) {
            clearTimeout(rankingStockRefreshTimer);
            rankingStockRefreshTimer = null;
        }
    };

    if (window.__meimayRankingStockListenerAttached && previousRefreshRankingOnStockChange) {
        window.removeEventListener('meimay:stock-changed', previousRefreshRankingOnStockChange);
        window.addEventListener('meimay:stock-changed', window.refreshRankingOnStockChange);
    }

    function renderPremiumComparisonMatrix() {
        const rows = [
            ['使える漢字', '常用漢字のみ', '常用漢字 + 人名用漢字'],
            ['広告', 'あり', 'なし'],
            ['読みスワイプ', '1日30回まで', '無制限'],
            ['漢字スワイプ', '1日30回まで', '無制限'],
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
            : { active: false };

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
})();
