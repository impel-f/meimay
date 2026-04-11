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

    function formatPremiumMatrixCell(value) {
        const escape = typeof escapePremiumHtml === 'function'
            ? escapePremiumHtml
            : (input) => String(input ?? '')
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        return escape(value).replace(/\n/g, '<br>');
    }

    function renderPremiumComparisonMatrix() {
        const rows = [
            { item: '使える漢字', free: '常用漢字', premium: '常用漢字\n＋人名用漢字' },
            { item: '広告', free: 'あり', premium: 'なし' },
            { item: '読みスワイプ', free: '1日100回', premium: '無制限' },
            { item: '漢字スワイプ', free: '1日100回', premium: '無制限' },
            { item: 'AI漢字深掘り', free: '1日1回', premium: '無制限' }
        ];

        return `
            <div class="relative overflow-hidden rounded-[22px] border border-[#e4d9c6] bg-[#fffdf7]">
                <div class="pointer-events-none absolute z-0 rounded-[18px] border-2 border-[#d7b57c] bg-[linear-gradient(180deg,rgba(255,247,232,0.96),rgba(255,252,243,0.92))] shadow-[0_10px_28px_rgba(183,145,85,0.12)]"
                    style="top:8px;bottom:8px;left:calc(61.31% + 6px);right:8px;"></div>
                <div class="relative z-10">
                    <div class="grid grid-cols-[1.05fr_0.82fr_1.18fr] gap-x-2 border-b border-[#eadfcd] bg-[#f6eddb] px-3 py-2.5 text-[11px] sm:text-[12px] font-black text-[#5b4f3f]">
                        <div class="flex items-center">項目</div>
                        <div class="flex items-center justify-center">無料</div>
                        <div class="flex items-center justify-center">
                            <span class="inline-flex items-center justify-center rounded-full bg-[#fff5df] px-3 py-1 text-[#8e6c36] shadow-sm">プレミアム</span>
                        </div>
                    </div>
                    <div class="divide-y divide-[#efe5d3]">
                        ${rows.map(({ item, free, premium }) => `
                            <div class="grid grid-cols-[1.05fr_0.82fr_1.18fr] items-stretch gap-x-2 px-3 py-2.5 text-[11px] sm:text-[12px] leading-[1.5] text-[#2f271e]">
                                <div class="flex items-center font-bold">${formatPremiumMatrixCell(item)}</div>
                                <div class="flex items-center justify-center text-center">
                                    <span class="inline-flex min-h-[44px] w-full items-center justify-center whitespace-nowrap rounded-[14px] bg-white px-2 py-2 text-[10px] sm:text-[11px] font-semibold text-[#5d5444]">${formatPremiumMatrixCell(free)}</span>
                                </div>
                                <div class="flex items-center justify-center text-center">
                                    <span class="inline-flex min-h-[44px] w-full items-center justify-center rounded-[14px] bg-transparent px-2 py-2 font-black text-[#5b4f3f]">${formatPremiumMatrixCell(premium)}</span>
                                </div>
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

        const state = typeof PremiumManager !== 'undefined' && typeof PremiumManager.getMembershipState === 'function'
            ? PremiumManager.getMembershipState()
            : { active: false };

        modal.classList.add('active');
        modal.innerHTML = `
            <div class="detail-sheet max-w-none" style="max-width:min(92vw, 860px); max-height:min(88vh, 760px); overflow-x:hidden; overflow-y:auto; padding: clamp(16px, 2.6vw, 24px); background:#f7efdde6; border:1px solid #e4d9c6; box-shadow:0 24px 80px rgba(93,77,62,0.18);" onclick="event.stopPropagation()">
                <button class="modal-close-btn" onclick="closePremiumModal()">×</button>
                <div class="space-y-3">
                    <div class="text-center">
                        <div class="text-[9px] font-black text-[#b9965b] tracking-[0.35em] uppercase">Premium Plan</div>
                        <h3 class="mt-1 text-[1.2rem] sm:text-[1.5rem] font-black text-[#5b4f3f]">👑 プレミアム案内</h3>
                    </div>

                    ${renderPremiumComparisonMatrix()}

                    <div class="rounded-[18px] border border-[#e4d9c6] bg-[#fffaf1] px-3 py-3">
                        <div class="text-[13px] sm:text-[15px] font-black text-[#2f271e] mb-1">パートナー特典</div>
                        <p class="text-[12px] sm:text-[14px] leading-[1.65] text-[#5d5444]">どちらか1人がプレミアムに加入すると、連携中の相手もプレミアム機能を利用できます。</p>
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
