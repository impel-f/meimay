/* ============================================================
   MODULE 17: TODAY'S KANJI
   今日の一字 機能
   ============================================================ */

const TodaysKanji = {
    HISTORY_KEY: 'meimay_todays_kanji_history',
    MAX_HISTORY: 30, // 過去30日分の履歴を保持

    getHistory: function () {
        try {
            const hist = localStorage.getItem(this.HISTORY_KEY);
            return hist ? JSON.parse(hist) : [];
        } catch (e) {
            return [];
        }
    },

    saveHistory: function (history) {
        try {
            // max size
            if (history.length > this.MAX_HISTORY) {
                history = history.slice(history.length - this.MAX_HISTORY);
            }
            localStorage.setItem(this.HISTORY_KEY, JSON.stringify(history));
        } catch (e) {
            console.error("TODAYS_KANJI: Failed to save history", e);
        }
    },

    getCurrentDateString: function () {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
};

let currentTodaysKanjiData = null;

function initTodaysKanji() {
    console.log("TODAYS_KANJI: Initializing...");
    const container = document.getElementById('todays-kanji-container');
    if (!master || master.length === 0) {
        if (container) container.innerHTML = '<div class="text-xs text-[#a6967a] text-center w-full">データ読み込み中...</div>';
        return;
    }

    const todayDate = TodaysKanji.getCurrentDateString();
    const mmdd = todayDate.substring(5); // 'MM-DD'

    let history = TodaysKanji.getHistory();
    let selectedKanjiData = null;

    // 誕生日データを優先して探す
    if (typeof TodaysKanjiData !== 'undefined' && TodaysKanjiData[mmdd]) {
        const plannedKanji = TodaysKanjiData[mmdd].kanji;
        let matchedKanji = master.find(k => k['漢字'] === plannedKanji);
        if (matchedKanji) {
            selectedKanjiData = {
                ...matchedKanji,
                _birthdayPerson: TodaysKanjiData[mmdd].person,
                _birthdayPersonReading: TodaysKanjiData[mmdd].reading
            };
        } else {
            // マスターにない漢字でも表示できるように仮データを作成
            selectedKanjiData = {
                '漢字': plannedKanji,
                '音': 'ー',
                '訓': 'ー',
                '伝統名のり': 'ー',
                '意味': 'この漢字の詳細は準備中です',
                _birthdayPerson: TodaysKanjiData[mmdd].person,
                _birthdayPersonReading: TodaysKanjiData[mmdd].reading
            };
        }
    }

    if (!selectedKanjiData) {
        // 誕生日データが無い場合は既存の記録またはランダム選出
        let todaysRecord = history.find(h => h.date === todayDate);
        if (todaysRecord) {
            selectedKanjiData = master.find(k => k['漢字'] === todaysRecord.kanji);
        }

        if (!selectedKanjiData) {
            selectedKanjiData = selectRandomGoodKanji(history.map(h => h.kanji));
        }
    }

    // 履歴に反映
    if (selectedKanjiData && !history.find(h => h.date === todayDate)) {
        history.push({
            date: todayDate,
            kanji: selectedKanjiData['漢字']
        });
        TodaysKanji.saveHistory(history);
    }

    if (selectedKanjiData) {
        currentTodaysKanjiData = selectedKanjiData;
        renderTodaysKanji(selectedKanjiData);
    } else {
        if (container) {
            container.innerHTML = '<div class="text-xs text-red-400 text-center w-full">漢字の取得に失敗しました</div>';
        }
    }
}

function selectRandomGoodKanji(excludeKanjiList) {
    // 意味が含まれていて、除外リストに入っていないものをフィルタ
    const candidates = master.filter(k => {
        if (excludeKanjiList.includes(k['漢字'])) return false;
        if (!k['意味'] || k['意味'].trim() === '' || k['意味'] === 'ー') return false;
        // （必要であれば画数や人名用漢字などのフィルターもここに追加可能）
        return true;
    });

    if (candidates.length === 0) {
        // すべて除外されてしまった場合は、除外フィルターを外して意味があるものだけからランダム
        const fallbackCandidates = master.filter(k => k['意味'] && k['意味'].trim() !== '' && k['意味'] !== 'ー');
        if (fallbackCandidates.length === 0) return master[Math.floor(Math.random() * master.length)];
        return fallbackCandidates[Math.floor(Math.random() * fallbackCandidates.length)];
    }

    return candidates[Math.floor(Math.random() * candidates.length)];
}

function renderTodaysKanji(data) {
    const container = document.getElementById('todays-kanji-container');
    if (!container) return;

    // 読みをきれいに取得（複数ある場合は主なものを抜粋）
    let readings = [data['音'], data['訓'], data['伝統名のり']]
        .filter(r => r && r.trim() !== '' && r !== 'ー')
        .join(' / ');

    // 文字数制限
    if (readings.length > 25) {
        readings = readings.substring(0, 23) + '...';
    }

    let meaning = data['意味'] || 'データなし';
    if (meaning.length > 35) {
        meaning = meaning.substring(0, 33) + '...';
    }

    let personHtml = '';
    if (data._birthdayPerson) {
        // カード全体の最上部に配置し、横幅を広く使って2行折り返しを防ぐ
        personHtml = `<div class="mb-3"><span class="text-[10px] text-[#8b7e66] font-bold bg-white/90 px-3 py-1 rounded-full border border-[#ede5d8] shadow-sm inline-flex items-center gap-1.5"><span class="text-sm">🎂</span> ${data._birthdayPerson} のお誕生日</span></div>`;
    }

    const html = `
        <div class="text-xs font-bold text-[#8b7e66] mb-2 ml-1 flex items-center gap-1">
            <span class="text-[14px]">📅</span> 今日の一字
        </div>
        <button onclick="openTodaysKanjiDetail()" class="w-full text-left group bg-white/80 hover:bg-white p-4 rounded-3xl border border-[#ede5d8] transition-all shadow-sm hover:shadow-md active:scale-[0.98] relative overflow-hidden flex flex-col">
            <!-- Decorative background element -->
            <div class="absolute -right-6 -bottom-6 text-[100px] text-[#fdfaf5] font-black z-0 opacity-50 select-none pointer-events-none transform rotate-12 group-hover:scale-110 transition-transform duration-500">
                ${data['漢字']}
            </div>
            
            ${personHtml}
            
            <div class="flex items-center gap-4 relative z-10 w-full">
                <div class="w-16 h-16 shrink-0 rounded-2xl bg-gradient-to-br from-[#fdfaf5] to-[#f5f0e6] border border-[#ede5d8] flex items-center justify-center text-4xl font-black text-[#5d5444] shadow-sm">
                    ${data['漢字']}
                </div>
                <div class="flex-1 min-w-0">
                    <p class="text-[10px] font-bold text-[#bca37f] mb-0.5 truncate">${readings}</p>
                    <p class="text-xs text-[#5d5444] leading-relaxed line-clamp-2">${meaning}</p>
                </div>
                <div class="shrink-0 text-[#bca37f] opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all">
                    <span class="text-xl">→</span>
                </div>
            </div>
        </button>
    `;

    container.innerHTML = html;
}

function openTodaysKanjiDetail() {
    if (!currentTodaysKanjiData) return;
    if (typeof showDetailByData === 'function') {
        showDetailByData(currentTodaysKanjiData);
    }
}
