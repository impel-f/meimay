/* 18-ranking.js: Kanji Popularity Ranking UI Logic */

let currentRankingTab = 'allTime';

// スワイプ検知用変数
let rankingTouchStartX = 0;
let rankingTouchStartY = 0;

async function openRanking() {
    if (typeof changeScreen === 'function') {
        changeScreen('scr-ranking');
    }
    setupRankingSwipe();
    await loadRanking(currentRankingTab);
}

/**
 * 今週（月曜〜日曜）の集計期間を "M/D(月)〜M/D(日)" 形式で返す
 */
function getWeekDateRange() {
    const now = new Date();
    const day = now.getDay(); // 0=日, 1=月, ...
    // 月曜始まりに換算
    const diffToMonday = (day === 0 ? -6 : 1 - day);
    const monday = new Date(now);
    monday.setDate(now.getDate() + diffToMonday);
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
    const fmt = (d) => `${d.getMonth() + 1}/${d.getDate()}(${dayNames[d.getDay()]})`;
    return `${fmt(monday)}〜${fmt(sunday)}`;
}

function switchRankingTab(tab) {
    currentRankingTab = tab;

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

/**
 * ランキング画面コンテンツエリアにスワイプでタブ切替を設定
 */
function setupRankingSwipe() {
    const container = document.getElementById('ranking-list-container');
    if (!container || container._swipeSetup) return;
    container._swipeSetup = true;

    container.addEventListener('touchstart', (e) => {
        rankingTouchStartX = e.touches[0].clientX;
        rankingTouchStartY = e.touches[0].clientY;
    }, { passive: true });

    container.addEventListener('touchend', (e) => {
        const dx = e.changedTouches[0].clientX - rankingTouchStartX;
        const dy = e.changedTouches[0].clientY - rankingTouchStartY;
        // 横移動が縦移動の1.5倍以上かつ60px以上
        if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
            if (dx < 0 && currentRankingTab === 'allTime') {
                // 左スワイプ → 今週の急上昇へ
                switchRankingTab('weekly');
            } else if (dx > 0 && currentRankingTab === 'weekly') {
                // 右スワイプ → 総合ランキングへ
                switchRankingTab('allTime');
            }
        }
    }, { passive: true });
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

    // 今週タブ: 集計期間ヘッダー
    const weekHeader = tab === 'weekly'
        ? `<div class="text-center text-[10px] text-[#a6967a] mb-3 pt-1">📅 集計期間: ${getWeekDateRange()}</div>`
        : '';

    let html = `<div class="space-y-2 pb-8 pt-2">${weekHeader}`;

    rankings.forEach((item, index) => {
        const kanjiData = typeof master !== 'undefined' ? master.find(m => m['漢字'] === item.kanji) : null;
        if (!kanjiData) return;

        const isStocked = typeof liked !== 'undefined' && liked.some(l => l['漢字'] === item.kanji);
        const rankIcon = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}位`;
        const rankColor = index < 3 ? 'text-[#bca37f]' : 'text-[#8b7e66]';

        // 読み: 音→訓の順で取得（フィールド名修正: '音'/'訓'）
        const reading = kanjiData['音'] || kanjiData['訓'] || '';
        // 意味（先頭18字で切る）
        const meaningFull = kanjiData['意味'] || '';
        const meaning = meaningFull.length > 18 ? meaningFull.substring(0, 18) + '…' : meaningFull;

        html += `
            <div class="flex items-center gap-3 bg-white rounded-2xl px-3 py-2.5 shadow-sm border ${isStocked ? 'border-[#bca37f] ring-1 ring-[#bca37f]/20' : 'border-[#ede5d8]'} transition-all active:scale-95 cursor-pointer"
                onclick="showRankingKanjiDetail('${item.kanji}')">

                <!-- 左列: ランク表示 + ❤数 -->
                <div class="flex flex-col items-center shrink-0 w-8 gap-0.5">
                    <div class="text-base font-black ${rankColor} leading-none">${rankIcon}</div>
                    <div class="text-[9px] text-[#e07a7a] font-bold leading-none">❤${item.count}</div>
                </div>

                <!-- 漢字ボックス -->
                <div class="w-11 h-11 rounded-xl bg-gradient-to-br from-[#fdfaf5] to-[#f5f0e6] border border-[#ede5d8] flex items-center justify-center text-2xl font-black text-[#5d5444] shadow-sm shrink-0">
                    ${kanjiData['漢字']}
                </div>

                <!-- 中列: 読み + 意味 -->
                <div class="flex-1 min-w-0">
                    <div class="text-xs text-[#8b7e66] font-bold leading-tight truncate">${reading}</div>
                    <div class="text-[9px] text-[#a6967a] leading-tight mt-0.5 line-clamp-1">${meaning}</div>
                </div>

                <!-- ストックボタン -->
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

    const isStocked = liked.some(l => l['漢字'] === kanjiStr);
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
        btn.className = 'px-3 py-1.5 bg-gradient-to-br from-[#d4c5af] to-[#bca37f] text-white shadow-sm rounded-xl text-xs font-bold transition-all active:scale-95 shrink-0';
        if (card) {
            card.classList.remove('border-[#bca37f]', 'ring-1', 'ring-[#bca37f]/20');
            card.classList.add('border-[#ede5d8]');
        }
        if (removedCount > 0 && typeof MeimayStats !== 'undefined' && MeimayStats.recordKanjiUnlike) {
            MeimayStats.recordKanjiUnlike(kanjiStr);
        }
    } else {
        // 追加
        const found = typeof master !== 'undefined' ? master.find(m => m['漢字'] === kanjiStr) : null;
        if (found) {
            liked.push({ ...found, slot: -1, sessionReading: 'RANKING' });
            btn.innerText = '解除';
            btn.className = 'px-3 py-1.5 bg-[#fef2f2] text-[#f28b82] rounded-xl text-xs font-bold transition-all active:scale-95 shrink-0';
            if (card) {
                card.classList.add('border-[#bca37f]', 'ring-1', 'ring-[#bca37f]/20');
                card.classList.remove('border-[#ede5d8]');
            }
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
