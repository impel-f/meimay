/* ============================================================
   MODULE 12: HISTORY (V2.0 - 読み方単位履歴 + メッセージ保存)
   履歴・保存機能
   ============================================================ */

/**
 * 名前を保存（メッセージ付き）
 */
function saveName() {
    if (!currentBuildResult || !currentBuildResult.fullName) {
        alert('保存する名前がありません');
        return;
    }

    // メッセージ入力モーダルを表示
    showSaveMessageModal();
}

/**
 * 保存メッセージ入力モーダル
 */
function showSaveMessageModal() {
    // 現在の「名前部分」の読みを特定する
    // currentBuildResult.reading は "姓 読み" または "読み"
    const parts = (currentBuildResult.reading || '').split(' ');
    const currentGivenReading = parts.length > 1 ? parts[1] : parts[0];

    // 表示する読み候補リストを作成
    let displayReadings = [];
    if (typeof currentFbRecommendedReadings !== 'undefined') {
        displayReadings = [...currentFbRecommendedReadings];
    }

    // 現在の読み（手入力含む）がリストにない場合は先頭に追加（手入力チップとして扱う）
    if (currentGivenReading && !displayReadings.some(r => r.reading === currentGivenReading)) {
        displayReadings.unshift({ reading: currentGivenReading, isManual: true });
    }

    const modal = `
        <div class="overlay active modal-overlay-dark" id="save-message-modal" onclick="if(event.target.id==='save-message-modal')closeSaveMessageModal()">
            <div class="modal-sheet w-11/12 max-w-lg" onclick="event.stopPropagation()">
                <button class="modal-close-x" onclick="closeSaveMessageModal()">✕</button>
                <h3 class="modal-title">名前を保存</h3>
                <div class="modal-body">
                    <div class="text-center mb-6">
                        <div class="text-3xl font-black text-[#5d5444] mb-2">${currentBuildResult.fullName}</div>
                        <div class="text-sm text-[#a6967a]">${currentBuildResult.reading}</div>
                    </div>
                    <div class="mb-5">
                        <label class="text-xs font-bold text-[#a6967a] mb-2 block">メモ（任意）</label>
                        <textarea id="save-message-input" 
                                  class="w-full px-4 py-3 bg-white border-2 border-[#eee5d8] rounded-2xl text-sm font-medium text-[#5d5444] focus:border-[#bca37f] outline-none transition-all resize-none"
                                  placeholder="例：第一候補、祖父の名前から"
                                  rows="2"
                                  maxlength="100"></textarea>
                    </div>

                    ${(typeof buildMode !== 'undefined' && buildMode === 'free') ? `
                    <div class="mb-4">
                        <label class="text-xs font-bold text-[#a6967a] mb-2 block">読み方の選択・変更</label>
                        <div id="modal-reading-chips" class="flex flex-wrap gap-2">
                            ${displayReadings.slice(0, 15).map(r => {
        const isActive = currentGivenReading === r.reading;
        const label = r.isManual ? `✏️ ${r.reading}` : r.reading;
        return `
                                <button onclick="selectReadingInModal('${r.reading}')" 
                                        class="modal-reading-chip px-3 py-1.5 text-xs font-bold rounded-full border transition-all
                                        ${isActive
                ? 'bg-[#bca37f] text-white border-[#bca37f] shadow-sm'
                : 'border-[#d4c5af] bg-white text-[#5d5444] hover:border-[#bca37f]'}">
                                    ${label}
                                </button>
                                `;
    }).join('')}
                            <button onclick="promptManualReadingInModal()" 
                                    class="px-3 py-1.5 text-xs font-bold rounded-full border border-[#d4c5af] bg-[#fdfaf5] text-[#a6967a] hover:border-[#bca37f] transition-all">
                                ＋ 読みを入力
                            </button>
                        </div>
                    </div>
                    ` : ''}
                </div>
                <div class="modal-footer">
                    <button onclick="executeSaveWithMessage()" class="btn-modal-primary">保存する</button>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modal);
    setTimeout(() => document.getElementById('save-message-input')?.focus(), 100);
}

function closeSaveMessageModal() {
    document.getElementById('save-message-modal')?.remove();
}

/**
 * モーダル内で読みを選択した際の処理
 */
function selectReadingInModal(reading) {
    if (!currentBuildResult) return;

    // 名字のふりがな部分を維持しつつ、名前部分だけ差し替える
    const parts = (currentBuildResult.reading || '').split(' ');
    let newFullReading = reading;
    if (parts.length > 1) {
        newFullReading = parts[0] + ' ' + reading;
    }

    currentBuildResult.reading = newFullReading;

    // モーダル内の表示を更新
    const readingDiv = document.querySelector('#save-message-modal .text-sm.text-\\[\\#a6967a\\]');
    if (readingDiv) readingDiv.textContent = newFullReading;

    // チップのスタイル更新
    document.querySelectorAll('.modal-reading-chip').forEach(chip => {
        const chipText = chip.textContent.replace('✏️', '').trim();
        if (chipText === reading) {
            chip.classList.add('bg-[#bca37f]', 'text-white', 'border-[#bca37f]', 'shadow-sm');
            chip.classList.remove('bg-white', 'text-[#5d5444]', 'border-[#d4c5af]');
        } else {
            chip.classList.remove('bg-[#bca37f]', 'text-white', 'border-[#bca37f]', 'shadow-sm');
            chip.classList.add('bg-white', 'text-[#5d5444]', 'border-[#d4c5af]');
        }
    });

    // 自由組み立てモードの場合はグローバルな選択状態も同期（ビルド画面に戻った時用）
    if (typeof buildMode !== 'undefined' && buildMode === 'free') {
        fbSelectedReading = reading;
        if (typeof renderBuildSelection === 'function') renderBuildSelection();
    }

    console.log("SAVE_MODAL: Reading updated to", newFullReading);
}

/**
 * 保存モーダル内での読み手入力
 */
function promptManualReadingInModal() {
    const parts = (currentBuildResult.reading || '').split(' ');
    const currentGiven = parts.length > 1 ? parts[1] : parts[0];

    const input = prompt('名前の読みを入力してください（ひらがな）', currentGiven || '');
    if (input === null) return;

    const cleaned = input.trim().replace(/[A-Za-z0-9]/g, ''); // 簡易クリーン
    if (!cleaned) return;

    // もし既存のチップにない場合は、UIを一度閉じて開き直すのが確実だが、
    // ここでは temporary にチップを追加するか、単に選択を反映させる
    selectReadingInModal(cleaned);

    // チップ一覧になければ追加して再描画（モーダルを閉じずに更新）
    const container = document.getElementById('modal-reading-chips');
    if (container) {
        let exists = false;
        container.querySelectorAll('.modal-reading-chip').forEach(chip => {
            if (chip.textContent.replace('✏️', '').trim() === cleaned) exists = true;
        });

        if (!exists) {
            const newChip = document.createElement('button');
            newChip.className = 'modal-reading-chip px-3 py-1.5 text-xs font-bold rounded-full border bg-[#bca37f] text-white border-[#bca37f] shadow-sm transition-all';
            newChip.innerHTML = `✏️ ${cleaned}`;
            newChip.onclick = () => selectReadingInModal(cleaned);
            // 「読みを入力」ボタンの前に挿入
            const addBtn = container.querySelector('button:last-child');
            container.insertBefore(newChip, addBtn);

            // 他のチップのハイライトを外す
            selectReadingInModal(cleaned);
        }
    }
}

/**
 * メッセージ付きで名前を保存
 */
function executeSaveWithMessage() {
    const messageInput = document.getElementById('save-message-input');
    const message = messageInput ? messageInput.value.trim() : '';

    const saved = getSavedNames();

    // 重複チェック (名前の文字列だけでなく、構成も完全に一致する場合のみ重複とみなす)
    const isDuplicate = saved.some(item =>
        item.fullName === currentBuildResult.fullName &&
        JSON.stringify(item.combination) === JSON.stringify(currentBuildResult.combination)
    );

    if (isDuplicate) {
        if (!confirm('同じ名前・構成のデータが既に保存されています。メッセージを更新しますか？')) {
            return;
        }
        // 既存を削除
        const filtered = saved.filter(item =>
            !(item.fullName === currentBuildResult.fullName &&
                JSON.stringify(item.combination) === JSON.stringify(currentBuildResult.combination))
        );
        localStorage.setItem('meimay_saved', JSON.stringify(filtered));
    }

    // 保存データを作成
    const saveData = {
        ...currentBuildResult,
        message: message,
        savedAt: new Date().toISOString()
    };

    // 最新を先頭へ
    const updated = [saveData, ...getSavedNames().filter(item =>
        !(item.fullName === currentBuildResult.fullName &&
            JSON.stringify(item.combination) === JSON.stringify(currentBuildResult.combination))
    )];

    // 最大50件まで
    if (updated.length > 50) {
        updated.length = 50;
    }

    // グローバル変数を更新
    if (typeof savedNames !== 'undefined') savedNames = updated;
    localStorage.setItem('meimay_saved', JSON.stringify(updated));

    closeSaveMessageModal();
    alert('✨ 名前を保存しました！');
    console.log('HISTORY: Name saved', saveData);
}

/**
 * 読み方単位の履歴に追加
 */
function addToReadingHistory() {
    if (!segments || segments.length === 0) return;

    const compoundFlow = typeof window.getCompoundBuildFlow === 'function'
        ? window.getCompoundBuildFlow()
        : null;
    const reading = compoundFlow && compoundFlow.reading
        ? compoundFlow.reading
        : segments.join('');
    const displaySegments = compoundFlow && Array.isArray(compoundFlow.displaySegments)
        ? compoundFlow.displaySegments
        : segments;
    const segmentKey = Array.isArray(displaySegments)
        ? displaySegments.join('/')
        : segments.join('/');
    const history = getReadingHistory();

    const filtered = history.filter(item => `${item.reading}::${(item.segments || []).join('/')}` !== `${reading}::${segmentKey}`);

    const historyData = {
        reading: reading,
        segmentKey: segmentKey,
        segments: [...displaySegments],
        settings: {
            gender: gender,
            rule: rule,
            imageTags: selectedImageTags || [],
            prioritizeFortune: prioritizeFortune,
            surname: surnameStr
        },
        compoundFlow: compoundFlow && compoundFlow.reading === reading
            ? JSON.parse(JSON.stringify(compoundFlow))
            : null,
        likedCount: liked.filter(item => segments[item.slot]).length,
        searchedAt: new Date().toISOString()
    };

    filtered.unshift(historyData);

    // 最大30件まで
    if (filtered.length > 30) {
        filtered.length = 30;
    }

    localStorage.setItem('meimay_reading_history', JSON.stringify(filtered));
    console.log('HISTORY: Added reading history', historyData);
}

/**
 * 保存済み名前を取得
 */
function getSavedNames() {
    try {
        const data = localStorage.getItem('meimay_saved');
        const list = data ? JSON.parse(data) : [];
        if (typeof savedNames !== 'undefined') savedNames = list;
        return list;
    } catch (error) {
        console.error('HISTORY: Failed to load saved names', error);
        return [];
    }
}

/**
 * 読み方履歴を取得
 */
function getReadingHistory() {
    try {
        const data = localStorage.getItem('meimay_reading_history');
        return data ? JSON.parse(data) : [];
    } catch (error) {
        console.error('HISTORY: Failed to load reading history', error);
        return [];
    }
}

/**
 * 保存済み画面を開く（独立画面）
 */
function openSavedNames(options = {}) {
    if (!options.preservePartnerFocus && typeof window.resetMeimayPartnerViewFocus === 'function') {
        window.resetMeimayPartnerViewFocus();
    }
    changeScreen('scr-saved');
    renderSavedScreen();
}

/**
 * 検索履歴画面を開く（独立画面）
 */
function openReadingHistory() {
    changeScreen('scr-history');
    renderHistoryScreen();
}

let currentEncounteredTab = 'kanji';

function openEncounteredLibrary(tab = 'kanji') {
    currentEncounteredTab = tab === 'reading' ? 'reading' : 'kanji';
    changeScreen('scr-encountered');
    renderEncounteredLibrary();
}

function switchEncounteredTab(tab) {
    currentEncounteredTab = tab === 'reading' ? 'reading' : 'kanji';
    renderEncounteredLibrary();
}

function escapeEncounteredHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function formatEncounteredDayLabel(value) {
    if (!value) return '最近';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '最近';
    return date.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' });
}

function groupEncounteredItemsByDay(items) {
    const groups = [];
    const map = new Map();
    items.forEach((item) => {
        const source = item.lastSeenAt || item.firstSeenAt || '';
        const key = source ? source.slice(0, 10) : 'recent';
        if (!map.has(key)) {
            const group = {
                key,
                label: formatEncounteredDayLabel(source),
                items: []
            };
            map.set(key, group);
            groups.push(group);
        }
        map.get(key).items.push(item);
    });
    return groups;
}

function renderEncounteredStateBadge({ isLiked = false, isMatched = false, isNope = false }) {
    if (isMatched) {
        return '<span class="absolute top-1 right-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#fff4d6] px-1 text-[10px] font-black text-[#b9965b]">◎</span>';
    }
    if (isLiked) {
        return '<span class="absolute top-1 right-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#f7efe2] px-1 text-[10px] font-black text-[#8b7e66]">❤</span>';
    }
    if (isNope) {
        return '<span class="absolute top-1 right-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#f2efea] px-1 text-[10px] font-black text-[#a6967a]">×</span>';
    }
    return '';
}

function getEncounteredActionLabel(action) {
    if (action === 'super') return 'かなり好き';
    if (action === 'like') return 'いいかも';
    if (action === 'nope') return '見送り';
    return '見た候補';
}

function renderEncounteredLibrary() {
    const container = document.getElementById('encountered-list-content');
    if (!container) return;

    const tabKanji = document.getElementById('encountered-tab-kanji');
    const tabReading = document.getElementById('encountered-tab-reading');
    if (tabKanji) tabKanji.className = `flex-1 rounded-xl px-3 py-2 text-sm font-bold transition-all ${currentEncounteredTab === 'kanji' ? 'bg-[#fffbeb] text-[#5d5444] shadow-sm' : 'text-[#a6967a]'}`;
    if (tabReading) tabReading.className = `flex-1 rounded-xl px-3 py-2 text-sm font-bold transition-all ${currentEncounteredTab === 'reading' ? 'bg-[#fffbeb] text-[#5d5444] shadow-sm' : 'text-[#a6967a]'}`;

    const library = typeof getEncounteredLibrary === 'function'
        ? getEncounteredLibrary()
        : { kanji: [], readings: [] };
    const items = [...(currentEncounteredTab === 'reading' ? library.readings : library.kanji)]
        .sort((a, b) => new Date(b.lastSeenAt || 0).getTime() - new Date(a.lastSeenAt || 0).getTime());

    if (items.length === 0) {
        container.innerHTML = `
            <div class="text-center py-20 text-sm text-[#a6967a]">
                <div class="text-4xl mb-4 opacity-50">🗂️</div>
                <p>まだ出会った候補はありません</p>
                <p class="text-[10px] mt-2">スワイプした読みや漢字が、ここにたまっていきます。</p>
            </div>
        `;
        return;
    }

    const pairInsights = typeof window.MeimayPartnerInsights !== 'undefined' ? window.MeimayPartnerInsights : null;
    const matchedKanjiSet = pairInsights?.getMatchedLikedItems
        ? new Set(pairInsights.getMatchedLikedItems().map(entry => entry?.['漢字'] || entry?.kanji).filter(Boolean))
        : new Set();
    const ownReadingKeys = pairInsights?.buildReadingStockKey
        ? new Set((typeof getReadingStock === 'function' ? getReadingStock() : []).map(entry => pairInsights.buildReadingStockKey(entry)).filter(Boolean))
        : new Set();
    const partnerReadingKeys = pairInsights?.buildReadingStockKey && pairInsights?.getPartnerReadingStock
        ? new Set(pairInsights.getPartnerReadingStock().map(entry => pairInsights.buildReadingStockKey(entry)).filter(Boolean))
        : new Set();

    const renderStateMarks = (isLiked, isMatched) => {
        const parts = [];
        if (isMatched) {
            parts.push('<span class="inline-flex h-6 min-w-[24px] items-center justify-center rounded-full bg-[#fff4d6] px-1.5 text-[11px] font-black text-[#b9965b]">◎</span>');
        }
        if (isLiked) {
            parts.push('<span class="inline-flex h-6 min-w-[24px] items-center justify-center rounded-full bg-[#f7efe2] px-1.5 text-[11px] font-black text-[#8b7e66]">★</span>');
        }
        if (parts.length === 0) {
            parts.push('<span class="inline-flex h-6 min-w-[24px] items-center justify-center rounded-full bg-[#f8f5ef] px-1.5 text-[11px] font-black text-[#c3b59f]">・</span>');
        }
        return parts.join('');
    };

    let html = '<div class="space-y-2 pb-8 pt-2">';
    items.forEach((item) => {
        const seenAt = item.lastSeenAt
            ? new Date(item.lastSeenAt).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
            : '';

        if (currentEncounteredTab === 'reading') {
            const isStocked = typeof getReadingStock === 'function'
                ? getReadingStock().some(stockItem => stockItem.reading === item.reading)
                : false;
            const readingKey = pairInsights?.buildReadingStockKey ? pairInsights.buildReadingStockKey(item) : (item.key || item.reading);
            const isMatched = !!(readingKey && ownReadingKeys.has(readingKey) && partnerReadingKeys.has(readingKey));
            const tags = Array.isArray(item.tags) ? item.tags.slice(0, 2) : [];
            const examples = Array.isArray(item.examples) ? item.examples.slice(0, 2) : [];
            const subline = examples.length > 0
                ? examples.map(escapeEncounteredHtml).join(' ・ ')
                : (tags.length > 0 ? tags.map(escapeEncounteredHtml).join(' ') : `${getEncounteredActionLabel(item.lastAction)} / ${seenAt}`);
            html += `
                <div class="flex items-center gap-3 bg-white rounded-2xl px-3 py-2.5 shadow-sm border ${isMatched ? 'border-[#e7d39b] ring-1 ring-[#e7d39b]/30' : isStocked ? 'border-[#d9c5a4]' : 'border-[#ede5d8]'} transition-all active:scale-95 cursor-pointer"
                    onclick="useEncounteredReading('${escapeEncounteredHtml(item.key || item.reading)}')">
                    <div class="flex items-center justify-center gap-1 shrink-0 w-14">
                        ${renderStateMarks(isStocked, isMatched)}
                    </div>
                    <div class="flex-1 min-w-0">
                        <div class="text-base font-black text-[#5d5444] truncate">${escapeEncounteredHtml(item.reading)}</div>
                        <div class="text-[10px] text-[#8b7e66] leading-tight truncate">${subline}</div>
                    </div>
                    <button onclick="event.stopPropagation(); stockEncounteredReading('${escapeEncounteredHtml(item.key || item.reading)}')" class="px-3 py-1.5 ${isStocked ? 'bg-[#f8f5ef] text-[#a6967a]' : 'bg-gradient-to-br from-[#d4c5af] to-[#bca37f] text-white shadow-sm'} rounded-xl text-xs font-bold transition-all active:scale-95 shrink-0">
                        ${isStocked ? '済' : '追加'}
                    </button>
                </div>
            `;
            return;
        }

        const isLiked = Array.isArray(liked)
            ? liked.some(likedItem => (likedItem['漢字'] || likedItem.kanji) === item.kanji)
            : false;
        const isMatched = matchedKanjiSet.has(item.kanji);
        const tags = Array.isArray(item.tags) ? item.tags.slice(0, 2) : [];
        const subline = item.kanjiReading
            ? escapeEncounteredHtml(item.kanjiReading)
            : (tags.length > 0 ? tags.map(escapeEncounteredHtml).join(' ') : `${getEncounteredActionLabel(item.lastAction)} / ${seenAt}`);
        html += `
            <div class="flex items-center gap-3 bg-white rounded-2xl px-3 py-2.5 shadow-sm border ${isMatched ? 'border-[#e7d39b] ring-1 ring-[#e7d39b]/30' : isLiked ? 'border-[#d9c5a4]' : 'border-[#ede5d8]'} transition-all active:scale-95 cursor-pointer"
                onclick="openEncounteredKanjiDetail('${escapeEncounteredHtml(item.key || item.kanji)}')">
                <div class="flex items-center justify-center gap-1 shrink-0 w-14">
                    ${renderStateMarks(isLiked, isMatched)}
                </div>
                <div class="w-11 h-11 rounded-xl bg-gradient-to-br from-[#fdfaf5] to-[#f5f0e6] border border-[#ede5d8] flex items-center justify-center text-2xl font-black text-[#5d5444] shadow-sm shrink-0">
                    ${escapeEncounteredHtml(item.kanji)}
                </div>
                <div class="flex-1 min-w-0">
                    <div class="text-xs text-[#8b7e66] font-bold leading-tight truncate">${subline}</div>
                    <div class="text-[10px] text-[#a6967a] leading-tight mt-0.5 truncate">見た回数 ${item.seenCount || 0}${seenAt ? ` / ${seenAt}` : ''}</div>
                </div>
                <button onclick="event.stopPropagation(); likeEncounteredKanji('${escapeEncounteredHtml(item.key || item.kanji)}')" class="px-3 py-1.5 ${isLiked ? 'bg-[#f8f5ef] text-[#a6967a]' : 'bg-gradient-to-br from-[#d4c5af] to-[#bca37f] text-white shadow-sm'} rounded-xl text-xs font-bold transition-all active:scale-95 shrink-0">
                    ${isLiked ? '済' : '追加'}
                </button>
            </div>
        `;
    });
    html += '</div>';
    container.innerHTML = html;
}

function renderEncounteredLibrary() {
    const container = document.getElementById('encountered-list-content');
    if (!container) return;

    const tabKanji = document.getElementById('encountered-tab-kanji');
    const tabReading = document.getElementById('encountered-tab-reading');
    if (tabKanji) tabKanji.className = `flex-1 rounded-xl px-3 py-2 text-sm font-bold transition-all ${currentEncounteredTab === 'kanji' ? 'bg-[#fffbeb] text-[#5d5444] shadow-sm' : 'text-[#a6967a]'}`;
    if (tabReading) tabReading.className = `flex-1 rounded-xl px-3 py-2 text-sm font-bold transition-all ${currentEncounteredTab === 'reading' ? 'bg-[#fffbeb] text-[#5d5444] shadow-sm' : 'text-[#a6967a]'}`;

    const library = typeof getEncounteredLibrary === 'function'
        ? getEncounteredLibrary()
        : { kanji: [], readings: [] };
    const items = [...(currentEncounteredTab === 'reading' ? library.readings : library.kanji)]
        .sort((a, b) => new Date(b.lastSeenAt || 0).getTime() - new Date(a.lastSeenAt || 0).getTime());

    if (items.length === 0) {
        container.innerHTML = `
            <div class="text-center py-20 text-sm text-[#a6967a]">
                <div class="text-4xl mb-4 opacity-50">🗂️</div>
                <p>まだ出会った候補はありません</p>
                <p class="text-[10px] mt-2">スワイプした候補が、ここにたまっていきます。</p>
            </div>
        `;
        return;
    }

    const pairInsights = typeof window.MeimayPartnerInsights !== 'undefined' ? window.MeimayPartnerInsights : null;
    const matchedKanjiSet = pairInsights?.getMatchedLikedItems
        ? new Set(pairInsights.getMatchedLikedItems().map(entry => entry?.['漢字'] || entry?.kanji).filter(Boolean))
        : new Set();
    const ownReadingKeys = pairInsights?.buildReadingStockKey
        ? new Set((typeof getReadingStock === 'function' ? getReadingStock() : []).map(entry => pairInsights.buildReadingStockKey(entry)).filter(Boolean))
        : new Set();
    const partnerReadingKeys = pairInsights?.buildReadingStockKey && pairInsights?.getPartnerReadingStock
        ? new Set(pairInsights.getPartnerReadingStock().map(entry => pairInsights.buildReadingStockKey(entry)).filter(Boolean))
        : new Set();
    const groups = groupEncounteredItemsByDay(items);

    if (currentEncounteredTab === 'kanji') {
        container.innerHTML = `
            <div class="space-y-4 pb-32 pt-2">
                ${groups.map(group => `
                    <section>
                        <div class="text-[11px] font-bold text-[#a6967a] px-1 mb-2">${escapeEncounteredHtml(group.label)}</div>
                        <div class="grid grid-cols-4 gap-2">
                            ${group.items.map(item => {
                                const isLiked = Array.isArray(liked)
                                    ? liked.some(likedItem => (likedItem['漢字'] || likedItem.kanji) === item.kanji)
                                    : false;
                                const isMatched = matchedKanjiSet.has(item.kanji);
                                const isNope = !isLiked && !isMatched && item.lastAction === 'nope';
                                const strokes = Number.isFinite(Number(item.strokes)) ? Number(item.strokes) : '−';
                                const readings = String(item.kanjiReading || item.snapshot?.kanji_reading || '')
                                    .split(/[、,\s/]+/)
                                    .map(part => part.trim())
                                    .filter(Boolean)
                                    .slice(0, 2)
                                    .join(',');
                                const toneClass = isMatched
                                    ? 'border-[#e7d39b] bg-[#fff9ec]'
                                    : isLiked
                                        ? 'border-[#bca37f] bg-[#fffbeb]'
                                        : isNope
                                            ? 'border-[#ddd6ca] bg-[#fbfaf8]'
                                            : 'border-[#eee5d8] bg-white';

                                return `
                                    <div class="relative w-full" style="padding-bottom:100%;">
                                        <button
                                            onclick="openEncounteredKanjiDetail('${escapeEncounteredHtml(item.key || item.kanji)}')"
                                            class="absolute inset-0 flex flex-col items-center justify-center overflow-hidden rounded-xl shadow-sm border transition-all active:scale-95 ${toneClass}">
                                            ${renderEncounteredStateBadge({ isLiked, isMatched, isNope })}
                                            <span class="text-2xl font-black text-[#5d5444] leading-none">${escapeEncounteredHtml(item.kanji)}</span>
                                            <span class="mt-1 text-[8px] text-[#a6967a]">${strokes}画</span>
                                            <span class="mt-1 text-[7px] text-[#bca37f] truncate w-full text-center px-1">${escapeEncounteredHtml(readings)}</span>
                                        </button>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </section>
                `).join('')}
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <div class="space-y-4 pb-32 pt-2">
            ${groups.map(group => `
                <section>
                    <div class="text-[11px] font-bold text-[#a6967a] px-1 mb-2">${escapeEncounteredHtml(group.label)}</div>
                    <div class="grid grid-cols-2 gap-2">
                        ${group.items.map(item => {
                            const isStocked = typeof getReadingStock === 'function'
                                ? getReadingStock().some(stockItem => stockItem.reading === item.reading)
                                : false;
                            const readingKey = pairInsights?.buildReadingStockKey
                                ? pairInsights.buildReadingStockKey(item)
                                : (item.key || item.reading);
                            const isMatched = !!(readingKey && ownReadingKeys.has(readingKey) && partnerReadingKeys.has(readingKey));
                            const isNope = !isStocked && !isMatched && item.lastAction === 'nope';
                            const tags = Array.isArray(item.tags) ? item.tags.slice(0, 2) : [];
                            const examples = Array.isArray(item.examples) ? item.examples.slice(0, 2) : [];
                            const subline = examples.length > 0
                                ? examples.map(escapeEncounteredHtml).join(' ・ ')
                                : (tags.length > 0 ? tags.map(escapeEncounteredHtml).join(' ') : '');
                            const toneClass = isMatched
                                ? 'border-[#e7d39b] bg-[#fff9ec]'
                                : isStocked
                                    ? 'border-[#bca37f] bg-[#fffbeb]'
                                    : isNope
                                        ? 'border-[#ddd6ca] bg-[#fbfaf8]'
                                        : 'border-[#eee5d8] bg-white';

                            return `
                                <button
                                    onclick="useEncounteredReading('${escapeEncounteredHtml(item.key || item.reading)}')"
                                    class="relative min-h-[104px] rounded-2xl border px-3 py-3 text-left shadow-sm transition-all active:scale-95 ${toneClass}">
                                    ${renderEncounteredStateBadge({ isLiked: isStocked, isMatched, isNope })}
                                    <div class="pr-5">
                                        <div class="text-lg font-black text-[#5d5444] truncate">${escapeEncounteredHtml(item.reading)}</div>
                                        <div class="mt-1 text-[10px] leading-tight text-[#8b7e66] min-h-[28px]">${subline}</div>
                                    </div>
                                </button>
                            `;
                        }).join('')}
                    </div>
                </section>
            `).join('')}
        </div>
    `;
}

function openEncounteredKanjiDetail(key) {
    const library = typeof getEncounteredLibrary === 'function'
        ? getEncounteredLibrary()
        : { kanji: [] };
    const item = (library.kanji || []).find(entry => (entry.key || entry.kanji) === key);
    if (!item) return;

    const snapshot = item.snapshot || {};
    const targetKanji = item.kanji;
    if (typeof master !== 'undefined' && Array.isArray(master) && typeof showKanjiDetail === 'function') {
        const found = master.find(entry => entry['漢字'] === targetKanji);
        if (found) {
            showKanjiDetail(found);
            return;
        }
    }

    if (typeof showDetailByData === 'function') {
        showDetailByData({
            ...snapshot,
            '漢字': targetKanji,
            '画数': snapshot['画数'] ?? item.strokes ?? 1,
            'カテゴリ': snapshot['カテゴリ'] || item.category || '',
            kanji_reading: snapshot.kanji_reading || item.kanjiReading || ''
        });
    }
}

function likeEncounteredKanji(key) {
    const library = typeof getEncounteredLibrary === 'function'
        ? getEncounteredLibrary()
        : { kanji: [] };
    const item = (library.kanji || []).find(entry => (entry.key || entry.kanji) === key);
    if (!item) return;

    if (Array.isArray(liked) && liked.some(entry => (entry['漢字'] || entry.kanji) === item.kanji)) {
        if (typeof showToast === 'function') showToast('すでにストック済みです', '🔖');
        return;
    }

    const snapshot = item.snapshot || {};
    const payload = {
        ...snapshot,
        '漢字': item.kanji,
        '画数': snapshot['画数'] ?? item.strokes ?? 1,
        'カテゴリ': snapshot['カテゴリ'] || item.category || '',
        kanji_reading: snapshot.kanji_reading || item.kanjiReading || '',
        slot: Number.isFinite(Number(snapshot.slot)) ? Number(snapshot.slot) : -1,
        sessionReading: snapshot.sessionReading || 'FREE',
        sessionSegments: Array.isArray(snapshot.sessionSegments) ? snapshot.sessionSegments : [],
        sessionDisplaySegments: Array.isArray(snapshot.sessionDisplaySegments) ? snapshot.sessionDisplaySegments : [],
        isSuper: false
    };

    if (!Array.isArray(liked)) liked = [];
    liked.unshift(payload);
    if (typeof StorageBox !== 'undefined' && typeof StorageBox.saveLiked === 'function') {
        StorageBox.saveLiked();
    } else {
        localStorage.setItem('naming_app_liked_chars', JSON.stringify(liked));
    }

    if (typeof noped !== 'undefined') {
        noped.delete(item.kanji);
        if (typeof StorageBox !== 'undefined' && typeof StorageBox.saveNoped === 'function') {
            StorageBox.saveNoped();
        }
    }

    if (typeof updateEncounteredLibraryEntry === 'function') {
        updateEncounteredLibraryEntry('kanji', item.key || item.kanji, { lastAction: 'like' }, { action: 'like', incrementLike: true });
    }

    renderEncounteredLibrary();
    if (typeof showToast === 'function') showToast('ストックに追加しました', '📚');
}

function stockEncounteredReading(key) {
    const library = typeof getEncounteredLibrary === 'function'
        ? getEncounteredLibrary()
        : { readings: [] };
    const item = (library.readings || []).find(entry => (entry.key || entry.reading) === key);
    if (!item || !item.reading) return;

    if (typeof addReadingToStock === 'function') {
        addReadingToStock(item.reading, item.reading, Array.isArray(item.tags) ? item.tags : []);
    }
    if (typeof noped !== 'undefined') {
        noped.delete(item.reading);
        if (typeof StorageBox !== 'undefined' && typeof StorageBox.saveNoped === 'function') {
            StorageBox.saveNoped();
        }
    }
    if (typeof updateEncounteredLibraryEntry === 'function') {
        updateEncounteredLibraryEntry('reading', item.key || item.reading, { lastAction: 'like' }, { action: 'like', incrementLike: true });
    }

    renderEncounteredLibrary();
    if (typeof showToast === 'function') showToast('読みストックに追加しました', '📖');
}

function useEncounteredReading(key) {
    const library = typeof getEncounteredLibrary === 'function'
        ? getEncounteredLibrary()
        : { readings: [] };
    const item = (library.readings || []).find(entry => (entry.key || entry.reading) === key);
    if (!item || !item.reading) return;
    if (typeof proceedWithSoundReading === 'function') {
        proceedWithSoundReading(item.reading);
    }
}

/**
 * 互換性のためopenHistoryは保存済みを開く
 */
function openHistory() {
    openSavedNames();
}

/**
 * 保存済み画面のレンダリング
 */
function renderSavedScreen() {
    const container = document.getElementById('saved-list-content');
    if (!container) return;

    const saved = getSavedNames();
    const pairInsights = (typeof window.MeimayPartnerInsights !== 'undefined' && window.MeimayPartnerInsights.isSavedItemMatched)
        ? window.MeimayPartnerInsights
        : null;

    const decorated = saved.map((item, index) => ({
        item: item,
        index: index,
        isMatched: pairInsights ? pairInsights.isSavedItemMatched(item) : false
    })).sort((a, b) => {
        if (a.isMatched !== b.isMatched) return a.isMatched ? -1 : 1;
        if (!!a.item.fromPartner !== !!b.item.fromPartner) return a.item.fromPartner ? 1 : -1;
        const aTime = new Date(a.item.savedAt || a.item.timestamp || 0).getTime();
        const bTime = new Date(b.item.savedAt || b.item.timestamp || 0).getTime();
        return bTime - aTime;
    });

    const scrSaved = document.getElementById('scr-saved');
    if (scrSaved) {
        const shareBtn = scrSaved.querySelector('.partner-share-btn');
        if (shareBtn) {
            if (typeof shareMode !== 'undefined' && shareMode === 'manual') {
                shareBtn.classList.remove('hidden');
            } else {
                shareBtn.classList.add('hidden');
            }
        }
    }

    container.innerHTML = decorated.length > 0 ? decorated.map(({ item, index, isMatched }) => {
        const badgeHtml = isMatched
            ? '<div class="absolute -top-2 -right-2 bg-gradient-to-r from-[#f59e0b] to-[#f97316] text-white text-[10px] font-bold px-2 py-1 rounded-full shadow-sm z-10 break-keep">💞 おふたり一致</div>'
            : (item.fromPartner
                ? '<div class="absolute -top-2 -right-2 bg-gradient-to-r from-[#f28b82] to-[#f4978e] text-white text-[10px] font-bold px-2 py-1 rounded-full shadow-sm z-10 break-keep">👩 パートナーから</div>'
                : '');

        return `
        <div class="bg-white rounded-2xl p-4 border border-[#eee5d8] shadow-sm relative">
            ${badgeHtml}
            <div class="flex items-start justify-between mb-2">
                <div class="flex-1">
                    <div class="text-xl font-black text-[#5d5444]">${item.fullName || ''}</div>
                    <div class="text-xs text-[#a6967a]">${item.reading || ''}</div>
                    ${item.message ? `<div class="text-xs text-[#bca37f] mt-1">💬 ${item.message}</div>` : ''}
                </div>
                ${item.fortune ? `
                    <div class="text-right ml-3">
                        <div class="text-sm font-bold text-[#bca37f]">${typeof item.fortune.so === 'object' ? (item.fortune.so.val || '') : item.fortune.so}画</div>
                    </div>
                ` : ''}
            </div>
            <div class="flex gap-2 mt-3">
                <button onclick="showSavedNameDetail(${index})" class="flex-1 py-2.5 bg-[#fdfaf5] rounded-xl text-xs font-bold text-[#7a6f5a] hover:bg-[#bca37f] hover:text-white transition-all active:scale-95">
                    詳細を見る
                </button>
                <button onclick="deleteSavedName(${index})" class="px-4 py-2.5 bg-[#fef2f2] rounded-xl text-xs font-bold text-[#f28b82] hover:bg-[#f28b82] hover:text-white transition-all active:scale-95">
                    削除
                </button>
            </div>
        </div>
        `;
    }).join('') : `
        <div class="text-center py-20 text-sm text-[#a6967a]">
            <div class="text-4xl mb-4 opacity-50">📝</div>
            <p>保存された名前はまだありません</p>
            <p class="text-[10px] mt-2">ビルドした名前を保存するとここに表示されます</p>
        </div>
    `;
}

/**
 * 検索履歴画面のレンダリング
 */
function renderHistoryScreen() {
    const container = document.getElementById('history-list-content');
    if (!container) return;

    const history = getReadingHistory();

    container.innerHTML = history.length > 0 ? `
        ${history.map((item, index) => `
            <div class="bg-white rounded-2xl p-4 border border-[#eee5d8] shadow-sm cursor-pointer hover:shadow-md transition-all active:scale-[0.99]">
                <div class="flex items-center justify-between mb-2" onclick="loadReadingHistory(${index})">
                    <div>
                        <div class="text-xl font-black text-[#5d5444]">${item.reading}</div>
                        <div class="text-xs text-[#a6967a] mt-1">
                            ${item.segments.join(' / ')}
                            ${item.settings.gender === 'male' ? '👦' : item.settings.gender === 'female' ? '👧' : '👶'}
                        </div>
                    </div>
                    <div class="text-right">
                        <div class="text-sm font-bold text-[#bca37f]">${item.likedCount}個</div>
                        <div class="text-[10px] text-[#a6967a]">ストック</div>
                    </div>
                </div>
                <div class="flex items-center justify-between mt-2 pt-2 border-t border-[#eee5d8]">
                    <div class="text-[10px] text-[#a6967a]">
                        ${new Date(item.searchedAt).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <button onclick="event.stopPropagation(); deleteReadingHistory(${index})" class="px-3 py-1.5 bg-[#fef2f2] rounded-lg text-xs font-bold text-[#f28b82] hover:bg-[#f28b82] hover:text-white transition-all active:scale-95">
                        削除
                    </button>
                </div>
            </div>
        `).join('')}
        <button onclick="clearReadingHistory()" class="w-full mt-4 py-3 bg-[#fef2f2] rounded-xl text-xs font-bold text-[#f28b82] hover:bg-[#f28b82] hover:text-white transition-all">
            履歴をすべてクリア
        </button>
    ` : `
        <div class="text-center py-20 text-sm text-[#a6967a]">
            <div class="text-4xl mb-4 opacity-50">🕐</div>
            <p>検索履歴はまだありません</p>
            <p class="text-[10px] mt-2">読みを検索すると自動で記録されます</p>
        </div>
    `;
}

/**
 * 互換性のための関数（旧タブ切り替え）
 */
function renderHistory() { renderSavedScreen(); }
function switchHistoryTab(tab) {
    if (tab === 'history') openReadingHistory();
    else openSavedNames();
}

// 詳細モーダルから戻るためのインデックス保持
let _lastSavedDetailIndex = null;

/**
 * 保存済み名前の詳細を表示するモーダル
 */
function showSavedNameDetail(index) {
    const saved = getSavedNames();
    if (index < 0 || index >= saved.length) return;
    const item = saved[index];
    _lastSavedDetailIndex = index; // 戻り用に保存

    const f = item.fortune;

    // 苗字・名前のパース
    const nameParts = (item.fullName || '').split(' ');
    const surStr = nameParts[0] || '';
    const givStr = nameParts[1] || item.givenName || '';

    // ふりがなのパース
    const readingParts = (item.reading || '').split(' ');
    const surRead = readingParts[0] || '';
    const givRead = readingParts[1] || (readingParts.length === 1 ? readingParts[0] : '');

    // 文字数に応じたフォントサイズ調整 (07-build.js と同期)
    const totalChars = surStr.length + givStr.length;
    const nameFontClass = totalChars >= 7 ? 'text-xl' : totalChars >= 6 ? 'text-2xl' : 'text-3xl';

    // 格データの生成（ラベル・吉凶・画数）
    const renderFortuneRow = (label, gaku) => {
        if (!gaku || !gaku.res) return '';
        const isSokaku = label === '総格';
        return `
            <div class="flex items-center justify-between py-1.5 border-b border-[#eee5d8]/50 last:border-0 ${isSokaku ? 'mt-2 pt-3 border-t border-[#eee5d8]' : ''}">
                <span class="text-[10px] font-bold text-[#a6967a] w-12 text-left">${label}</span>
                <span class="text-xs font-black ${gaku.res.color} flex-1 text-center">${gaku.res.label}</span>
                <span class="text-[10px] font-bold text-[#5d5444] text-right w-12">${gaku.val || gaku.num}画</span>
            </div>
        `;
    };

    const modal = `
        <div class="overlay active modal-overlay-dark" id="saved-detail-modal" onclick="if(event.target.id==='saved-detail-modal')closeSavedNameDetail()">
            <div class="modal-sheet w-11/12 max-w-lg" onclick="event.stopPropagation()">
                <button class="modal-close-x" onclick="closeSavedNameDetail()">✕</button>
                <div class="mb-5 text-center">
                    <h3 class="text-xs font-bold text-[#a6967a] mb-1">保存された名前の詳細</h3>
                </div>
                
                <div class="modal-body px-1">
                    <!-- フルネーム枠表示 (ビルド画面スタイル完全同期) -->
                    <div class="flex justify-center mb-10">
                        <div class="relative flex items-center justify-center min-h-[100px] bg-white rounded-2xl border border-[#eee5d8] shadow-[0_2px_10px_-4px_rgba(188,163,127,0.3)] px-10 py-6 overflow-hidden before:absolute before:inset-1 before:border before:border-dashed before:border-[#d4c5af] before:rounded-xl before:pointer-events-none flex-nowrap shrink-0">
                            <div class="flex items-end gap-2 z-10 flex-nowrap justify-center">
                                <div class="flex flex-col items-center mr-8 shrink-0">
                                    <p class="text-[10px] text-[#a6967a] h-3.5 mb-1 font-bold">${surRead}</p>
                                    <p class="${nameFontClass} font-black text-[#5d5444] tracking-widest leading-none">${surStr}</p>
                                </div>
                                <div class="flex flex-col items-center shrink-0">
                                    <p class="text-[10px] text-[#a6967a] h-3.5 mb-1 font-bold">${givRead}</p>
                                    <p class="${nameFontClass} font-black text-[#5d5444] tracking-widest leading-none">${givStr}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- 漢字詳細用カード (🔍アイコン付き) -->
                    <div class="mb-10">
                        <label class="text-[10px] font-black text-[#a6967a] mb-4 block uppercase tracking-wider text-center">漢字の構成（タップで詳細）</label>
                        <div class="flex gap-3 justify-center flex-wrap">
                            ${(item.combination || []).map(kanji => {
        const kStr = typeof kanji === 'string' ? kanji : kanji['漢字'];
        return `
                                    <div onclick="showKanjiDetailFromSaved(${JSON.stringify(kanji).replace(/"/g, '&quot;')})"
                                         class="w-16 h-20 bg-white border-2 border-[#eee5d8] rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:border-[#bca37f] transition-all active:scale-90 shadow-sm relative group">
                                        <div class="text-2xl font-black text-[#5d5444] group-hover:text-[#bca37f] transition-colors">${kStr}</div>
                                        <div class="absolute bottom-1 right-1.5 text-[10px] opacity-40 group-hover:opacity-100 group-hover:text-[#bca37f]">🔍</div>
                                    </div>
                                `;
    }).join('')}
                        </div>
                    </div>

                    ${item.message ? `
                    <div class="mb-8 p-5 bg-[#fdfaf5] rounded-3xl border border-[#eee5d8] relative shadow-sm">
                        <div class="text-[9px] font-black text-[#a6967a] absolute -top-2.5 left-6 bg-white px-2 py-0.5 rounded-full border border-[#eee5d8] tracking-widest">メモ・願い</div>
                        <div class="text-sm text-[#5d5444] font-medium leading-relaxed">💬 ${item.message}</div>
                    </div>
                    ` : ''}

                    <!-- 姓名判断エリア (タイトル中央・リンク右下) -->
                    <div class="mb-8">
                        <div onclick="showFortuneDetailFromSaved(${index})" 
                             class="group block p-5 bg-white rounded-[2.5rem] border-2 border-[#eee5d8] hover:border-[#bca37f] transition-all active:scale-[0.98] shadow-sm cursor-pointer relative overflow-hidden">
                            <div class="text-center mb-4 border-b border-[#eee5d8] pb-2">
                                <label class="text-[11px] font-black text-[#a6967a] tracking-widest">姓名判断 鑑定書</label>
                            </div>
                            <div class="px-5 mb-4">
                                ${renderFortuneRow('天格', f?.ten)}
                                ${renderFortuneRow('人格', f?.jin)}
                                ${renderFortuneRow('地格', f?.chi)}
                                ${renderFortuneRow('外格', f?.gai)}
                                ${renderFortuneRow('総格', f?.so)}
                            </div>
                            <div class="text-right">
                                <span class="text-[10px] font-black text-[#bca37f] flex items-center justify-end group-hover:translate-x-1 transition-transform">
                                    鑑定結果をくわしく見る ＞
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="modal-footer flex flex-col gap-2">
                    <button onclick="loadSavedName(${index})" class="w-full py-5 bg-[#bca37f] text-white rounded-[1.5rem] text-sm font-black shadow-lg shadow-[#bca37f]/20 hover:bg-[#a68d68] transition-all active:scale-[0.98] flex items-center justify-center gap-2">
                         <span>🛠️</span> この構成で漢字を選びなおす
                    </button>
                    <button onclick="closeSavedNameDetail()" class="w-full py-4 bg-white text-[#a6967a] rounded-xl text-xs font-bold hover:bg-[#fdfaf5] transition-all">
                        閉じる
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modal);
}

/**
 * 保存詳細から漢字詳細を開く（重ならないよう自らを閉じる）
 */
function showKanjiDetailFromSaved(kanjiData) {
    closeSavedNameDetail();

    // 文字列の場合はmasterから探す
    let data = kanjiData;
    if (typeof kanjiData === 'string') {
        data = typeof master !== 'undefined' ? master.find(m => m['漢字'] === kanjiData) : null;
    } else if (kanjiData['漢字'] && !kanjiData['読み']) {
        // 画数だけの不完全なデータの可能性があるのでmasterから補完
        const found = typeof master !== 'undefined' ? master.find(m => m['漢字'] === kanjiData['漢字']) : null;
        if (found) data = found;
    }

    if (data && typeof showKanjiDetail === 'function') {
        showKanjiDetail(data);
    }
}

/**
 * 保存詳細から運勢詳細を開く
 */
function showFortuneDetailFromSaved(index) {
    const saved = getSavedNames();
    const item = saved[index];
    if (!item) return;

    // 現在のビルド結果としてセット（showFortuneDetailがこれを見るため）
    currentBuildResult = JSON.parse(JSON.stringify(item));

    closeSavedNameDetail();

    if (typeof showFortuneDetail === 'function') {
        showFortuneDetail();
        // 保存済みから開いた場合は保存ボタンを隠す
        const saveBtn = document.getElementById('fortune-save-btn');
        if (saveBtn) saveBtn.style.display = 'none';
    }
}

function closeSavedNameDetail() {
    document.getElementById('saved-detail-modal')?.remove();
}

/**
 * 保存済み名前を読み込む（苗字を含めず、元のビルドモードを復元）
 */
function loadSavedName(index) {
    const saved = getSavedNames();
    if (index < 0 || index >= saved.length) return;

    const item = saved[index];

    // ビルド画面の初期化
    if (typeof clearBuildSelection === 'function') clearBuildSelection();

    // 苗字の特定と反映
    const nameParts = (item.fullName || '').split(' ');
    if (nameParts.length > 1) {
        if (typeof surnameStr !== 'undefined') {
            surnameStr = nameParts[0];
        }
    }

    // 名前の読みを抽出（スペースがあれば後ろ、なければfullNameと照らし合わせる等の工夫が必要だが一旦スペース優先）
    const readingParts = (item.reading || '').split(' ');
    const givenReading = readingParts.length > 1 ? readingParts[1] : readingParts[0];

    // モード判定: 各漢字に sessionReading がある場合は「読みモード」
    const isNormalBuild = item.combination && item.combination.every(k => typeof k === 'object' && k.sessionReading);

    if (isNormalBuild) {
        // 通常の読みモード
        buildMode = 'reading';

        // 【重要】セグメント（スロット分割）の復元
        if (item.segments && item.segments.length > 0) {
            // 保存されたセグメントをそのまま使う（これが一番確実）
            segments = [...item.segments];
        } else {
            // セグメントがない場合は読みを1文字ずつにするが、
            // 苗字が混ざらないよう givenReading を使用する
            segments = givenReading.split('');
        }

        // 漢字の選択状態を復元
        item.combination.forEach((k, idx) => {
            if (typeof k === 'object') {
                // slotを現在のidxに合わせ、sessionReadingも保持してストックへ（疑似的）
                const piece = { ...k, slot: idx };
                const exists = liked.some(l => l['漢字'] === piece['漢字'] && l.slot === idx && l.sessionReading === piece.sessionReading);
                if (!exists) liked.push(piece);
                selectedPieces[idx] = piece;
            }
        });
        console.log("HISTORY: Re-loading in READING mode", segments);
    } else {
        // 自由組み立てモード
        buildMode = 'free';
        fbChoices = (item.combination || []).map(k => typeof k === 'string' ? k : k['漢字']);
        shownFbSlots = fbChoices.length;
        fbSelectedReading = givenReading;
        console.log("HISTORY: Re-loading in FREE mode");
    }

    // currentBuildResultをセット
    currentBuildResult = JSON.parse(JSON.stringify(item));

    closeSavedNameDetail();

    // ビルド画面に遷移
    changeScreen('scr-build');

    if (typeof renderBuildSelection === 'function') {
        renderBuildSelection();
    }

    // ビルド実行（プレビュー表示用）
    if (buildMode === 'reading') {
        if (typeof executeBuild === 'function') executeBuild();
    } else {
        if (typeof executeFbBuild === 'function') executeFbBuild();
    }

    showToast('名前の構成を読み込みました', '✨');
}

/**
 * 読み方履歴を読み込んで再開
 */
function loadReadingHistory(index) {
    const history = getReadingHistory();
    if (index < 0 || index >= history.length) return;

    const item = history[index];

    // 設定を復元
    if (item.compoundFlow && typeof window.setCompoundBuildFlow === 'function') {
        const restoredFlow = window.setCompoundBuildFlow(item.compoundFlow);
        segments = Array.isArray(restoredFlow?.segments) && restoredFlow.segments.length > 0
            ? [...restoredFlow.segments]
            : [...item.segments];
    } else {
        if (typeof window.clearCompoundBuildFlow === 'function') {
            window.clearCompoundBuildFlow();
        }
        segments = [...item.segments];
    }
    gender = item.settings.gender || 'neutral';
    rule = item.settings.rule || 'flexible';
    selectedImageTags = item.settings.imageTags || ['none'];
    prioritizeFortune = item.settings.prioritizeFortune || false;
    surnameStr = item.settings.surname || '';

    // ストック漢字は保持（削除しない）
    // liked配列はそのまま

    // seenセットを更新（ストック済み漢字を登録して除外できるように）
    seen.clear();
    liked.forEach(item => {
        seen.add(item['漢字']);
    });

    // スワイプ開始位置を最初に設定
    currentPos = 0;
    currentIdx = 0;

    // ビルド選択状態のみクリア
    if (typeof clearBuildSelection === 'function') {
        clearBuildSelection();
    }

    // 設定を保存
    if (typeof saveSettings === 'function') {
        saveSettings();
    }

    // スタックを再読み込み（新しい読み方でスワイプ画面を準備）
    if (typeof loadStack === 'function') {
        loadStack();
    }

    // ビルド画面に遷移
    changeScreen('scr-build');
    if (typeof renderBuildSelection === 'function') {
        renderBuildSelection();
    }

    console.log('HISTORY: Loaded reading history (keeping liked kanji)', item);
}

/**
 * 保存済み名前を削除
 */
function deleteSavedName(index) {
    if (!confirm('この名前を削除しますか？')) return;

    const saved = getSavedNames();
    saved.splice(index, 1);
    // グローバル変数を更新
    if (typeof savedNames !== 'undefined') savedNames = saved;

    localStorage.setItem('meimay_saved', JSON.stringify(saved));

    renderSavedScreen();
    console.log('HISTORY: Deleted saved name at index', index);
}

/**
 * 読み方履歴をクリア
 */
function clearReadingHistory() {
    if (!confirm('検索履歴をすべて削除しますか？\n（保存済みのストックもすべて削除されます）')) return;

    localStorage.removeItem('meimay_reading_history');

    if (typeof liked !== 'undefined') {
        liked.splice(0, liked.length);
        if (typeof StorageBox !== 'undefined' && StorageBox.saveLiked) StorageBox.saveLiked();
    }

    renderHistoryScreen();

    if (typeof renderStock === 'function') {
        renderStock();
    }

    console.log('HISTORY: Cleared reading history and all stock');
}

/**
 * 履歴/保存済み画面を閉じる（ホームに戻る）
 */
function closeHistory() {
    changeScreen('scr-mode');
}

// グローバルに公開
window.saveName = saveName;
window.executeSaveWithMessage = executeSaveWithMessage;
window.closeSaveMessageModal = closeSaveMessageModal;
window.openSavedNames = openSavedNames;
window.openReadingHistory = openReadingHistory;
window.openEncounteredLibrary = openEncounteredLibrary;
window.openHistory = openHistory;
window.switchHistoryTab = switchHistoryTab;
window.switchEncounteredTab = switchEncounteredTab;
window.loadReadingHistory = loadReadingHistory;
window.renderEncounteredLibrary = renderEncounteredLibrary;
window.openEncounteredKanjiDetail = openEncounteredKanjiDetail;
window.likeEncounteredKanji = likeEncounteredKanji;
window.stockEncounteredReading = stockEncounteredReading;
window.useEncounteredReading = useEncounteredReading;
window.showSavedNameDetail = showSavedNameDetail;
window.closeSavedNameDetail = closeSavedNameDetail;
window.showKanjiDetailFromSaved = showKanjiDetailFromSaved;
window.showFortuneDetailFromSaved = showFortuneDetailFromSaved;
window.loadSavedName = loadSavedName;
window.clearReadingHistory = clearReadingHistory;
window.deleteReadingHistory = deleteReadingHistory;
window.deleteSavedName = deleteSavedName;
window.closeHistory = closeHistory;

/**
 * 読み方履歴を削除（ストックも同期削除）
 */
function deleteReadingHistory(index) {
    if (!confirm('この履歴を削除しますか？\n（関連するストックも削除されます）')) return;

    const history = getReadingHistory();
    const target = history[index];

    if (target) {
        // ストックからも削除
        if (typeof liked !== 'undefined') {
            const initialCount = liked.length;
            const targetReading = target.reading;

            // 下位互換性：sessionReadingがない場合は削除しないなどの配慮も可能だが、
            // ここではsessionReadingが一致するものを削除
            liked = liked.filter(item => item.sessionReading !== targetReading);

            if (liked.length < initialCount) {
                if (typeof StorageBox !== 'undefined' && StorageBox.saveLiked) StorageBox.saveLiked();
                console.log('HISTORY: Synced stock deletion', initialCount - liked.length, 'items removed');
            }
        }

        // 履歴から削除
        history.splice(index, 1);
        localStorage.setItem('meimay_reading_history', JSON.stringify(history));

        renderHistoryScreen();
        console.log('HISTORY: Deleted reading history at index', index);

        // ストック画面が開いていたら更新
        if (typeof renderStock === 'function') {
            renderStock();
        }
    }
}

// スワイプ開始時に読み方履歴を追加
const originalStartSwiping = window.startSwiping;
if (typeof originalStartSwiping === 'function') {
    window.startSwiping = function () {
        addToReadingHistory();
        originalStartSwiping.apply(this, arguments);
    };
}

console.log("HISTORY: Module loaded (v2.0)");

function getSavedNames() {
    try {
        const data = localStorage.getItem('meimay_saved');
        const rawList = data ? JSON.parse(data) : [];
        const list = Array.isArray(rawList) ? rawList.filter(item => !item?.fromPartner) : [];
        if (list.length !== rawList.length) {
            localStorage.setItem('meimay_saved', JSON.stringify(list));
        }
        if (typeof savedNames !== 'undefined') savedNames = list;
        return list;
    } catch (error) {
        console.error('HISTORY: Failed to load saved names', error);
        return [];
    }
}

function buildApprovedPartnerSavedItem(item, partnerName, approvedPartnerSavedKey = '') {
    const combination = Array.isArray(item.combination) && item.combination.length > 0
        ? item.combination
        : (Array.isArray(item.combinationKeys) && typeof master !== 'undefined'
            ? item.combinationKeys.map(key => master.find(entry => entry['漢字'] === key) || { '漢字': key, '画数': 1 })
            : []);

    let fortune = null;
    try {
        if (typeof FortuneLogic !== 'undefined' && FortuneLogic.calculate && combination.length > 0) {
            const surArr = typeof surnameData !== 'undefined' && surnameData.length > 0
                ? surnameData
                : [{ kanji: typeof surnameStr !== 'undefined' ? surnameStr : '', strokes: 1 }];
            const givArr = combination.map(part => ({
                kanji: part['漢字'] || part.kanji || '',
                strokes: parseInt(part['画数'] || part.strokes || 0, 10) || 0
            }));
            fortune = FortuneLogic.calculate(surArr, givArr);
        }
    } catch (e) { }

    return {
        fullName: item.fullName || '',
        reading: item.reading || '',
        givenName: item.givenName || '',
        combination: combination,
        fortune: fortune,
        message: item.message || '',
        savedAt: new Date().toISOString(),
        approvedFromPartner: true,
        approvedPartnerSavedKey: approvedPartnerSavedKey || '',
        partnerName: partnerName || 'パートナー'
    };
}

function likePartnerSavedName(index) {
    const pairInsights = typeof window.MeimayPartnerInsights !== 'undefined' ? window.MeimayPartnerInsights : null;
    const partnerSaved = pairInsights?.getPartnerSaved ? pairInsights.getPartnerSaved() : [];
    if (index < 0 || index >= partnerSaved.length) return;

    const source = partnerSaved[index];
    if (!source) return;

    const saved = getSavedNames();
    const sourceKey = pairInsights?.buildSavedMatchKey ? pairInsights.buildSavedMatchKey(source) : `${source.fullName}::${source.reading}`;
    const existingIndex = saved.findIndex(item => {
        const ownKey = pairInsights?.buildSavedMatchKey ? pairInsights.buildSavedMatchKey(item) : `${item.fullName}::${item.reading}`;
        return ownKey === sourceKey;
    });

    const partnerName = typeof getPartnerRoleLabel === 'function'
        ? getPartnerRoleLabel(MeimayShare?.partnerSnapshot?.role)
        : 'パートナー';

    let updated = [...saved];
    if (existingIndex >= 0) {
        const existing = updated[existingIndex] || {};
        if (existing.approvedFromPartner && (existing.approvedPartnerSavedKey || sourceKey) === sourceKey) {
            if (typeof showToast === 'function') showToast('この候補にはすでにいいねしています', '💛');
            return;
        }
        updated[existingIndex] = {
            ...existing,
            approvedFromPartner: true,
            approvedPartnerSavedKey: sourceKey,
            partnerName: partnerName
        };
    } else {
        const approved = buildApprovedPartnerSavedItem(source, partnerName, sourceKey);
        updated = [approved, ...updated];
    }

    localStorage.setItem('meimay_saved', JSON.stringify(updated));
    if (typeof savedNames !== 'undefined') savedNames = updated;

    if (typeof MeimayPairing !== 'undefined' && MeimayPairing.roomCode) {
        MeimayPairing._autoSyncDebounced?.();
    }

    renderSavedScreen();
    if (typeof refreshPartnerAwareUI === 'function') refreshPartnerAwareUI();
    if (typeof showToast === 'function') showToast(`${partnerName}の候補を保存しました`, '💞');
}

function renderSavedScreen() {
    const container = document.getElementById('saved-list-content');
    if (!container) return;

    const saved = getSavedNames();
    const pairInsights = (typeof window.MeimayPartnerInsights !== 'undefined') ? window.MeimayPartnerInsights : null;
    const partnerSaved = pairInsights?.getPartnerSaved ? pairInsights.getPartnerSaved() : [];
    const pendingPartnerSaved = partnerSaved.filter(item => !item?.approvedFromPartner && !pairInsights?.isPartnerSavedApproved?.(item));

    const ownDecorated = saved.map((item, index) => ({
        item,
        index,
        isMatched: pairInsights?.isSavedItemMatched ? pairInsights.isSavedItemMatched(item) : false
    })).sort((a, b) => {
        if (a.isMatched !== b.isMatched) return a.isMatched ? -1 : 1;
        const aTime = new Date(a.item.savedAt || a.item.timestamp || 0).getTime();
        const bTime = new Date(b.item.savedAt || b.item.timestamp || 0).getTime();
        return bTime - aTime;
    });

    const renderOwnCard = ({ item, index, isMatched }) => `
        <div class="bg-white rounded-2xl p-4 border border-[#eee5d8] shadow-sm">
            <div class="flex items-start justify-between gap-3 mb-2">
                <div class="flex-1 min-w-0">
                    <div class="text-xl font-black text-[#5d5444]">${item.fullName || ''}</div>
                    <div class="text-xs text-[#a6967a]">${item.reading || ''}</div>
                    ${item.message ? `<div class="text-xs text-[#bca37f] mt-1">メモ ${item.message}</div>` : ''}
                    ${item.approvedFromPartner ? `<div class="text-[10px] text-[#dd7d73] mt-1">${item.partnerName || 'パートナー'}にいいねした候補</div>` : ''}
                </div>
                <div class="shrink-0 text-right">
                    ${isMatched ? '<div class="inline-flex items-center rounded-full bg-gradient-to-r from-[#f59e0b] to-[#f97316] px-2.5 py-1 text-[10px] font-bold text-white shadow-sm">一致</div>' : ''}
                    ${item.fortune ? `<div class="mt-2 text-sm font-bold text-[#bca37f]">${typeof item.fortune.so === 'object' ? (item.fortune.so.val || '') : item.fortune.so}画</div>` : ''}
                </div>
            </div>
            <div class="flex gap-2 mt-3">
                <button onclick="showSavedNameDetail(${index})" class="flex-1 py-2.5 bg-[#fdfaf5] rounded-xl text-xs font-bold text-[#7a6f5a] hover:bg-[#bca37f] hover:text-white transition-all active:scale-95">
                    詳細を見る
                </button>
                <button onclick="deleteSavedName(${index})" class="px-4 py-2.5 bg-[#fef2f2] rounded-xl text-xs font-bold text-[#f28b82] hover:bg-[#f28b82] hover:text-white transition-all active:scale-95">
                    削除
                </button>
            </div>
        </div>
    `;

    const renderPartnerCard = (item, index) => {
        const partnerName = typeof getPartnerRoleLabel === 'function'
            ? getPartnerRoleLabel(MeimayShare?.partnerSnapshot?.role)
            : 'パートナー';
        const fortuneText = item?.combinationKeys?.length ? `${item.combinationKeys.length}字候補` : '名前候補';
        return `
            <div class="bg-white rounded-2xl p-4 border border-[#f4d3cf] shadow-sm">
                <div class="flex items-start justify-between gap-3 mb-2">
                    <div class="flex-1 min-w-0">
                        <div class="inline-flex items-center rounded-full bg-[#fde8e5] px-2.5 py-1 text-[10px] font-bold text-[#dd7d73]">${partnerName}から</div>
                        <div class="mt-2 text-xl font-black text-[#5d5444]">${item.fullName || item.givenName || ''}</div>
                        <div class="text-xs text-[#a6967a]">${item.reading || ''}</div>
                        ${item.message ? `<div class="text-xs text-[#bca37f] mt-1">メモ ${item.message}</div>` : ''}
                    </div>
                    <div class="shrink-0 text-sm font-bold text-[#bca37f]">${fortuneText}</div>
                </div>
                <div class="flex gap-2 mt-3">
                    <button onclick="likePartnerSavedName(${index})" class="flex-1 py-2.5 bg-gradient-to-r from-[#f8c27a] to-[#e8a96b] rounded-xl text-xs font-bold text-white shadow-sm active:scale-95">
                        いいねして保存
                    </button>
                </div>
            </div>
        `;
    };

    let html = '';

    const scrSaved = document.getElementById('scr-saved');
    if (scrSaved) {
        const shareBtn = scrSaved.querySelector('.partner-share-btn');
        if (shareBtn) shareBtn.classList.add('hidden');
    }

    if (ownDecorated.length > 0) {
        html += ownDecorated.map(renderOwnCard).join('');
    }

    if (pendingPartnerSaved.length > 0) {
        if (html) {
            html += `<div class="pt-2"><div class="text-[10px] font-black tracking-[0.18em] text-[#dd7d73] uppercase mb-3">Partner Picks</div></div>`;
        }
        html += pendingPartnerSaved.map(renderPartnerCard).join('');
    }

    container.innerHTML = html || `
        <div class="text-center py-20 text-sm text-[#a6967a]">
            <div class="text-4xl mb-4 opacity-50">📁</div>
            <p>保存済みはまだありません</p>
            <p class="text-[10px] mt-2">ビルドした候補を保存するとここに表示されます</p>
        </div>
    `;
}

window.likePartnerSavedName = likePartnerSavedName;
window.getSavedNames = getSavedNames;
window.renderSavedScreen = renderSavedScreen;

function clearSavedPartnerFocus() {
    if (typeof window.resetMeimayPartnerViewFocus === 'function') {
        window.resetMeimayPartnerViewFocus(['savedFocus']);
    } else if (typeof window.setMeimayPartnerViewFocus === 'function') {
        window.setMeimayPartnerViewFocus({ savedFocus: 'all' });
    }
    renderSavedScreen();
}

function likePartnerSavedName(index) {
    const pairInsights = typeof window.MeimayPartnerInsights !== 'undefined' ? window.MeimayPartnerInsights : null;
    const partnerSaved = pairInsights?.getPartnerSaved ? pairInsights.getPartnerSaved() : [];
    if (index < 0 || index >= partnerSaved.length) return;

    const source = partnerSaved[index];
    if (!source) return;

    const saved = getSavedNames();
    const sourceKey = pairInsights?.buildSavedMatchKey ? pairInsights.buildSavedMatchKey(source) : `${source.fullName}::${source.reading}`;
    const existingIndex = saved.findIndex(item => {
        const ownKey = pairInsights?.buildSavedMatchKey ? pairInsights.buildSavedMatchKey(item) : `${item.fullName}::${item.reading}`;
        return ownKey === sourceKey;
    });

    const partnerName = pairInsights?.getPartnerDisplayName
        ? pairInsights.getPartnerDisplayName()
        : (typeof getPartnerRoleLabel === 'function'
            ? getPartnerRoleLabel(MeimayShare?.partnerSnapshot?.role)
            : 'パートナー');

    let updated = [...saved];
    if (existingIndex >= 0) {
        const existing = updated[existingIndex] || {};
        if (existing.approvedFromPartner && (existing.approvedPartnerSavedKey || sourceKey) === sourceKey) {
            if (typeof showToast === 'function') showToast('この候補にはすでにいいねしています', '✨');
            return;
        }
        updated[existingIndex] = {
            ...existing,
            approvedFromPartner: true,
            approvedPartnerSavedKey: sourceKey,
            partnerName
        };
    } else {
        const approved = buildApprovedPartnerSavedItem(source, partnerName, sourceKey);
        updated = [approved, ...updated];
    }

    localStorage.setItem('meimay_saved', JSON.stringify(updated));
    if (typeof savedNames !== 'undefined') savedNames = updated;

    if (typeof MeimayPairing !== 'undefined' && MeimayPairing.roomCode) {
        MeimayPairing._autoSyncDebounced?.();
    }

    renderSavedScreen();
    if (typeof refreshPartnerAwareUI === 'function') refreshPartnerAwareUI();
    if (typeof showToast === 'function') showToast(`${partnerName}の候補を保存しました`, '💞');
}

function renderSavedScreen() {
    const container = document.getElementById('saved-list-content');
    if (!container) return;

    const saved = getSavedNames();
    const pairInsights = (typeof window.MeimayPartnerInsights !== 'undefined') ? window.MeimayPartnerInsights : null;
    const partnerViewState = typeof window.getMeimayPartnerViewState === 'function'
        ? window.getMeimayPartnerViewState()
        : { savedFocus: 'all' };
    const savedFocus = partnerViewState.savedFocus || 'all';
    const partnerSaved = pairInsights?.getPartnerSaved ? pairInsights.getPartnerSaved() : [];
    const pendingPartnerSaved = partnerSaved.filter(item => !item?.approvedFromPartner && !pairInsights?.isPartnerSavedApproved?.(item));
    const partnerName = pairInsights?.getPartnerDisplayName
        ? pairInsights.getPartnerDisplayName()
        : (typeof getPartnerRoleLabel === 'function'
            ? getPartnerRoleLabel(MeimayShare?.partnerSnapshot?.role)
            : 'パートナー');

    const ownDecorated = saved.map((item, index) => ({
        item,
        index,
        isMatched: pairInsights?.isSavedItemMatched ? pairInsights.isSavedItemMatched(item) : false
    })).sort((a, b) => {
        if (a.isMatched !== b.isMatched) return a.isMatched ? -1 : 1;
        const aTime = new Date(a.item.savedAt || a.item.timestamp || 0).getTime();
        const bTime = new Date(b.item.savedAt || b.item.timestamp || 0).getTime();
        return bTime - aTime;
    });

    const renderOwnCard = ({ item, index, isMatched }) => `
        <div class="bg-white rounded-2xl p-4 border border-[#eee5d8] shadow-sm">
            <div class="flex items-start justify-between gap-3 mb-2">
                <div class="flex-1 min-w-0">
                    <div class="text-xl font-black text-[#5d5444]">${item.fullName || ''}</div>
                    <div class="text-xs text-[#a6967a]">${item.reading || ''}</div>
                    ${item.message ? `<div class="text-xs text-[#bca37f] mt-1">メモ ${item.message}</div>` : ''}
                    ${item.approvedFromPartner ? `<div class="text-[10px] text-[#dd7d73] mt-1">${item.partnerName || partnerName}にいいねした候補</div>` : ''}
                </div>
                <div class="shrink-0 text-right">
                    ${isMatched ? '<div class="inline-flex items-center rounded-full bg-gradient-to-r from-[#f59e0b] to-[#f97316] px-2.5 py-1 text-[10px] font-bold text-white shadow-sm">一致</div>' : ''}
                    ${item.fortune ? `<div class="mt-2 text-sm font-bold text-[#bca37f]">${typeof item.fortune.so === 'object' ? (item.fortune.so.val || '') : item.fortune.so}画</div>` : ''}
                </div>
            </div>
            <div class="flex gap-2 mt-3">
                <button onclick="showSavedNameDetail(${index})" class="flex-1 py-2.5 bg-[#fdfaf5] rounded-xl text-xs font-bold text-[#7a6f5a] hover:bg-[#bca37f] hover:text-white transition-all active:scale-95">
                    詳細を見る
                </button>
                <button onclick="deleteSavedName(${index})" class="px-4 py-2.5 bg-[#fef2f2] rounded-xl text-xs font-bold text-[#f28b82] hover:bg-[#f28b82] hover:text-white transition-all active:scale-95">
                    削除
                </button>
            </div>
        </div>
    `;

    const renderPartnerCard = (item, index) => {
        const fortuneText = item?.combinationKeys?.length ? `${item.combinationKeys.length}文字候補` : '名前候補';
        return `
            <div class="bg-white rounded-2xl p-4 border border-[#f4d3cf] shadow-sm">
                <div class="flex items-start justify-between gap-3 mb-2">
                    <div class="flex-1 min-w-0">
                        <div class="inline-flex items-center rounded-full bg-[#fde8e5] px-2.5 py-1 text-[10px] font-bold text-[#dd7d73]">${partnerName}から</div>
                        <div class="mt-2 text-xl font-black text-[#5d5444]">${item.fullName || item.givenName || ''}</div>
                        <div class="text-xs text-[#a6967a]">${item.reading || ''}</div>
                        ${item.message ? `<div class="text-xs text-[#bca37f] mt-1">メモ ${item.message}</div>` : ''}
                    </div>
                    <div class="shrink-0 text-sm font-bold text-[#bca37f]">${fortuneText}</div>
                </div>
                <div class="flex gap-2 mt-3">
                    <button onclick="likePartnerSavedName(${index})" class="flex-1 py-2.5 bg-gradient-to-r from-[#f8c27a] to-[#e8a96b] rounded-xl text-xs font-bold text-white shadow-sm active:scale-95">
                        いいねして保存
                    </button>
                </div>
            </div>
        `;
    };

    let visibleOwn = ownDecorated;
    let visiblePartner = pendingPartnerSaved;
    let html = '';

    if (savedFocus === 'partner') {
        visibleOwn = [];
        html += `
            <div class="rounded-2xl border border-[#f4d3cf] bg-[#fff8f6] px-4 py-3 mb-3">
                <div class="flex items-center justify-between gap-3">
                    <div>
                        <div class="text-[10px] font-black tracking-[0.18em] text-[#dd7d73] uppercase">Partner</div>
                        <div class="mt-1 text-sm font-bold text-[#4f4639]">${partnerName}の保存済み</div>
                        <div class="mt-1 text-[11px] text-[#8b7e66]">いいねした候補だけ、自分の保存済みに入ります。</div>
                    </div>
                    <button onclick="clearSavedPartnerFocus()" class="shrink-0 rounded-full border border-[#f0d0cb] bg-white px-3 py-1.5 text-[11px] font-bold text-[#8b7e66] active:scale-95">
                        通常表示
                    </button>
                </div>
            </div>
        `;
    } else if (savedFocus === 'matched') {
        visibleOwn = ownDecorated.filter(entry => entry.isMatched);
        visiblePartner = [];
        html += `
            <div class="rounded-2xl border border-[#eee5d8] bg-[#fffaf5] px-4 py-3 mb-3">
                <div class="flex items-center justify-between gap-3">
                    <div>
                        <div class="text-[10px] font-black tracking-[0.18em] text-[#b9965b] uppercase">Matched</div>
                        <div class="mt-1 text-sm font-bold text-[#4f4639]">おふたりで一致した名前</div>
                        <div class="mt-1 text-[11px] text-[#8b7e66]">双方がいいねした保存済みだけを表示しています。</div>
                    </div>
                    <button onclick="clearSavedPartnerFocus()" class="shrink-0 rounded-full border border-[#eadfce] bg-white px-3 py-1.5 text-[11px] font-bold text-[#8b7e66] active:scale-95">
                        通常表示
                    </button>
                </div>
            </div>
        `;
    }

    const scrSaved = document.getElementById('scr-saved');
    if (scrSaved) {
        const shareBtn = scrSaved.querySelector('.partner-share-btn');
        if (shareBtn) shareBtn.classList.add('hidden');
    }

    if (visibleOwn.length > 0) {
        html += visibleOwn.map(renderOwnCard).join('');
    }

    if (visiblePartner.length > 0) {
        if (html) {
            html += `<div class="pt-2"><div class="text-[10px] font-black tracking-[0.18em] text-[#dd7d73] uppercase mb-3">${partnerName}の保存済み</div></div>`;
        }
        html += visiblePartner.map(renderPartnerCard).join('');
    }

    if (!html) {
        if (savedFocus === 'partner') {
            html = `
                <div class="text-center py-20 text-sm text-[#a6967a]">
                    <div class="text-4xl mb-4 opacity-50">🤝</div>
                    <p>${partnerName}から届いている保存済みはまだありません</p>
                    <button onclick="clearSavedPartnerFocus()" class="mt-4 inline-flex items-center rounded-full border border-[#eadfce] bg-white px-4 py-2 text-[11px] font-bold text-[#8b7e66] active:scale-95">
                        通常表示に戻る
                    </button>
                </div>
            `;
        } else if (savedFocus === 'matched') {
            html = `
                <div class="text-center py-20 text-sm text-[#a6967a]">
                    <div class="text-4xl mb-4 opacity-50">✨</div>
                    <p>まだ一致した名前はありません</p>
                    <p class="text-[10px] mt-2">相手の候補にいいねすると、ここに一致した名前が並びます</p>
                    <button onclick="clearSavedPartnerFocus()" class="mt-4 inline-flex items-center rounded-full border border-[#eadfce] bg-white px-4 py-2 text-[11px] font-bold text-[#8b7e66] active:scale-95">
                        通常表示に戻る
                    </button>
                </div>
            `;
        } else {
            html = `
                <div class="text-center py-20 text-sm text-[#a6967a]">
                    <div class="text-4xl mb-4 opacity-50">💾</div>
                    <p>保存済みはまだありません</p>
                    <p class="text-[10px] mt-2">ビルドした候補を保存するとここに表示されます</p>
                </div>
            `;
        }
    }

    container.innerHTML = html;
}

window.likePartnerSavedName = likePartnerSavedName;
window.clearSavedPartnerFocus = clearSavedPartnerFocus;
window.getSavedNames = getSavedNames;
window.renderSavedScreen = renderSavedScreen;
