/* 18-ranking.js: Kanji Popularity Ranking UI Logic */

let currentRankingTab = 'allTime';

async function openRanking() {
    if (typeof changeScreen === 'function') {
        changeScreen('scr-ranking');
    }
    await loadRanking(currentRankingTab);
}

function switchRankingTab(tab) {
    currentRankingTab = tab;

    // Update active tab styles
    const allTimeBtn = document.getElementById('ranking-tab-allTime');
    const weeklyBtn = document.getElementById('ranking-tab-weekly');

    if (allTimeBtn) {
        allTimeBtn.className = tab === 'allTime'
            ? 'flex-1 py-3 text-sm font-bold text-center border-b-2 border-[#bca37f] text-[#5d5444]'
            : 'flex-1 py-3 text-sm font-bold text-center border-b-2 border-transparent text-[#a6967a]';
    }

    if (weeklyBtn) {
        weeklyBtn.className = tab === 'weekly'
            ? 'flex-1 py-3 text-sm font-bold text-center border-b-2 border-[#bca37f] text-[#5d5444]'
            : 'flex-1 py-3 text-sm font-bold text-center border-b-2 border-transparent text-[#a6967a]';
    }

    loadRanking(tab);
}

async function loadRanking(tab) {
    const listContainer = document.getElementById('ranking-list-container');
    if (!listContainer) return;

    listContainer.innerHTML = '<div class="text-center py-20 text-[#a6967a] flex flex-col items-center justify-center gap-4"><div class="animate-spin w-8 h-8 border-4 border-[#eee5d8] border-t-[#bca37f] rounded-full mx-auto"></div>ランキングを取得中...</div>';

    if (typeof MeimayStats === 'undefined') {
        listContainer.innerHTML = '<div class="text-center py-20 text-[#f28b82]">通信エラーが発生しました</div>';
        return;
    }

    const rankings = await MeimayStats.fetchRankings(tab);

    if (rankings.length === 0) {
        listContainer.innerHTML = '<div class="text-center py-20 text-[#a6967a]">まだランキングデータがありません。<br>あなたが最初のストックをしてみましょう！</div>';
        return;
    }

    let html = '<div class="space-y-2 pb-8 pt-2">';
    rankings.forEach((item, index) => {
        // ローカルマスターから詳細を取得
        const kanjiData = typeof master !== 'undefined' ? master.find(m => m['漢字'] === item.kanji) : null;
        if (!kanjiData) return;

        const isStocked = typeof liked !== 'undefined' && liked.some(l => l['漢字'] === item.kanji);
        const rankIcon = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}位`;
        const rankColor = index < 3 ? 'text-[#bca37f]' : 'text-[#8b7e66]';

        html += `
            <div class="flex items-center gap-4 bg-white rounded-2xl px-4 py-3 shadow-sm border ${isStocked ? 'border-[#bca37f] ring-1 ring-[#bca37f]/20' : 'border-[#ede5d8]'} transition-all active:scale-95 cursor-pointer"
                onclick="showRankingKanjiDetail('${item.kanji}')">
                <div class="text-base font-black ${rankColor} w-8 text-center shrink-0">${rankIcon}</div>
                <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-[#fdfaf5] to-[#f5f0e6] border border-[#ede5d8] flex items-center justify-center text-2xl font-black text-[#5d5444] shadow-sm shrink-0">
                    ${kanjiData['漢字']}
                </div>
                <div class="flex-1">
                    <div class="text-xs text-[#8b7e66] font-bold">${kanjiData['音読み'] || kanjiData['訓読み'] || ''}</div>
                    <div class="text-[10px] text-[#bca37f]">❤️ ${item.count}人</div>
                </div>
                <button onclick="event.stopPropagation(); toggleRankingStock('${item.kanji}', this)"
                    class="px-3 py-1.5 ${isStocked ? 'bg-[#fef2f2] text-[#f28b82]' : 'bg-gradient-to-br from-[#d4c5af] to-[#bca37f] text-white shadow-sm'} rounded-xl text-xs font-bold transition-all active:scale-95 shrink-0">
                    ${isStocked ? '解除' : 'ストック'}
                </button>
            </div>
        `;
    });
    html += '</div>';
    listContainer.innerHTML = html;
}

function showRankingKanjiDetail(kanjiStr) {
    if (typeof master !== 'undefined' && typeof showKanjiDetail === 'function') {
        const found = master.find(m => m['漢字'] === kanjiStr);
        if (found) showKanjiDetail(found);
    }
}

function toggleRankingStock(kanjiStr, btn) {
    if (typeof liked === 'undefined') return;

    let isStocked = liked.some(l => l['漢字'] === kanjiStr);
    const card = btn.closest('.bg-white');

    if (isStocked) {
        // 解除
        let removedCount = 0;
        for (let i = liked.length - 1; i >= 0; i--) {
            if (liked[i]['漢字'] === kanjiStr) {
                liked.splice(i, 1);
                removedCount++;
            }
        }
        btn.innerText = 'ストック';
        btn.className = 'w-[72px] py-2.5 bg-gradient-to-br from-[#d4c5af] to-[#bca37f] text-white shadow-sm rounded-xl text-xs font-bold transition-all active:scale-95';
        card.classList.remove('border-[#bca37f]', 'ring-1', 'bg-[#fffbeb]/30', 'ring-[#bca37f]/20');
        card.classList.add('border-[#ede5d8]');
        if (removedCount > 0 && typeof MeimayStats !== 'undefined' && MeimayStats.recordKanjiUnlike) {
            MeimayStats.recordKanjiUnlike(kanjiStr);
        }
    } else {
        // 追加
        const found = typeof master !== 'undefined' ? master.find(m => m['漢字'] === kanjiStr) : null;
        if (found) {
            liked.push({ ...found, slot: -1, sessionReading: 'RANKING' });
            btn.innerText = '解除';
            btn.className = 'w-[72px] py-2.5 bg-[#fef2f2] text-[#f28b82] border-none rounded-xl text-xs font-bold transition-all active:scale-95';
            card.classList.add('border-[#bca37f]', 'ring-1', 'bg-[#fffbeb]/30', 'ring-[#bca37f]/20');
            card.classList.remove('border-[#ede5d8]');
            if (typeof MeimayStats !== 'undefined' && MeimayStats.recordKanjiLike) {
                MeimayStats.recordKanjiLike(kanjiStr);
            }
        }
    }

    if (typeof StorageBox !== 'undefined' && StorageBox.saveLiked) {
        StorageBox.saveLiked();
    }
}

window.openRanking = openRanking;
window.switchRankingTab = switchRankingTab;
window.toggleRankingStock = toggleRankingStock;
window.showRankingKanjiDetail = showRankingKanjiDetail;

console.log("RANKING: Module loaded");
