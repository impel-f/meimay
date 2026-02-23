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

    let html = '<div class="space-y-3 pb-8 pt-2">';
    rankings.forEach((item, index) => {
        // Hydrate details from the local master dictionary
        const kanjiData = typeof master !== 'undefined' ? master.find(m => m['漢字'] === item.kanji) : null;
        if (!kanjiData) return;

        const isStocked = typeof liked !== 'undefined' && liked.some(l => l['漢字'] === item.kanji);
        const rankIcon = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}<span class="text-[10px] ml-0.5 text-[#a6967a]">位</span>`;
        const rankColor = index === 0 ? 'text-[#bca37f] text-3xl font-black' : index === 1 ? 'text-[#9ca3af] text-2xl font-black' : index === 2 ? 'text-[#b45309] text-2xl font-black' : 'text-[#8b7e66] text-xl font-bold';

        const readingsArr = ((kanjiData['音'] || '') + ',' + (kanjiData['訓'] || '') + ',' + (kanjiData['伝統名のり'] || ''))
            .split(/[、,，\s/]+/)
            .filter(x => x && x.trim() !== '' && !x.includes('なし'))
            .slice(0, 4);
        const readings = readingsArr.length > 0 ? '読み：' + readingsArr.join(', ') : '読み：(不明)';

        html += `
            <div class="bg-white rounded-2xl p-4 shadow-sm border ${isStocked ? 'border-[#bca37f] ring-1 ring-[#bca37f]/20 bg-[#fffbeb]/30' : 'border-[#ede5d8]'} flex items-center gap-4 relative overflow-hidden transition-all">
                
                <div class="w-12 text-center shrink-0 flex items-center justify-center ${rankColor}">
                    ${rankIcon}
                </div>

                <div class="flex-1 min-w-0" onclick="showRankingKanjiDetail('${item.kanji}')" style="cursor: pointer;">
                    <div class="flex items-baseline gap-2 mb-1">
                        <span class="text-3xl font-black text-[#5d5444]">${kanjiData['漢字']}</span>
                        <span class="text-[9px] text-[#a6967a] bg-[#f8f5ef] font-bold px-1.5 py-0.5 rounded-full border border-[#ede5d8]">画数 ${kanjiData['画数']}</span>
                    </div>
                    <div class="text-[11px] text-[#8b7e66] truncate w-full pr-2">${readings}</div>
                    <div class="text-[10px] font-bold text-[#bca37f] mt-1.5 flex items-center gap-1">
                        <span class="text-[#f28b82]">❤️</span> ${item.count} 人がストック
                    </div>
                </div>

                <div class="shrink-0 flex flex-col items-center">
                    <button onclick="toggleRankingStock('${item.kanji}', this)" 
                        class="w-[72px] py-2.5 ${isStocked ? 'bg-[#fef2f2] text-[#f28b82] border-none' : 'bg-gradient-to-br from-[#d4c5af] to-[#bca37f] text-white shadow-sm'} rounded-xl text-xs font-bold transition-all active:scale-95">
                        ${isStocked ? '解除' : 'ストック'}
                    </button>
                </div>
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

    const idx = liked.findIndex(l => l['漢字'] === kanjiStr);
    const card = btn.closest('.bg-white');

    if (idx > -1) {
        // 解除
        liked.splice(idx, 1);
        btn.innerText = 'ストック';
        btn.className = 'w-[72px] py-2.5 bg-gradient-to-br from-[#d4c5af] to-[#bca37f] text-white shadow-sm rounded-xl text-xs font-bold transition-all active:scale-95';
        card.classList.remove('border-[#bca37f]', 'ring-1', 'bg-[#fffbeb]/30', 'ring-[#bca37f]/20');
        card.classList.add('border-[#ede5d8]');
        if (typeof MeimayStats !== 'undefined' && MeimayStats.recordKanjiUnlike) {
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
