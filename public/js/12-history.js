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
function persistActiveChildWorkspaceSnapshot(reason = 'saved-name-change') {
    if (typeof MeimayChildWorkspaces !== 'undefined'
        && MeimayChildWorkspaces
        && typeof MeimayChildWorkspaces.persistActiveChildSnapshot === 'function') {
        MeimayChildWorkspaces.persistActiveChildSnapshot(reason);
        return true;
    }
    return false;
}

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
    persistActiveChildWorkspaceSnapshot('save-name-message');

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
    if (typeof MeimayStats !== 'undefined' && MeimayStats.recordReadingEncounter) {
        MeimayStats.recordReadingEncounter(reading, 1, 'all', {
            gender: historyData.settings.gender || gender || 'neutral'
        }).catch((error) => {
            console.warn('HISTORY: reading stats sync failed', error);
        });
    }
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
let currentEncounteredReadingActionKey = '';

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

function getEncounteredDateSource(item) {
    if (!item) return '';
    return item.firstSeenAt || item.lastSeenAt || '';
}

function groupEncounteredItemsByDay(items) {
    const groups = [];
    const map = new Map();
    items.forEach((item) => {
        const source = getEncounteredDateSource(item);
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

function normalizeEncounteredReadingText(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    return raw
        .replace(/[ァ-ヶ]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0x60))
        .replace(/[^ぁ-ゖーゝゞ]/g, '');
}

function renderEncounteredStateBadge({ isLiked = false, isMatched = false, isNope = false }) {
    if (isLiked) {
        return '<span class="absolute top-1 right-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#fde8e5] px-1 text-[10px] font-black text-[#dd7d73]">❤️</span>';
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
        .sort((a, b) => new Date(getEncounteredDateSource(b) || 0).getTime() - new Date(getEncounteredDateSource(a) || 0).getTime());

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

    const pairInsights = null;
    const matchedKanjiSet = new Set();
    const ownReadingKeys = new Set();
    const partnerReadingKeys = new Set();

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

    const pairInsights = null;
    const matchedKanjiSet = new Set();
    const ownReadingKeys = new Set();
    const partnerReadingKeys = new Set();
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
                                    ? liked.some(likedItem => (likedItem['漢字'] || likedItem['\u8c8c\uff61\u87c4\uff65'] || likedItem['\u8c8d\uff62\u87c4\u30fb'] || likedItem.kanji) === item.kanji)
                                    : false;
                                const isMatched = false;
                                const isNope = !isLiked && item.lastAction === 'nope';
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
                                        ? 'border-[#f2b2b2] bg-[#fff1f1]'
                                        : isNope
                                            ? 'border-[#ddd6ca] bg-[#fbfaf8]'
                                            : 'border-[#eee5d8] bg-[#fdfaf5]';

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
                            const displayReading = normalizeEncounteredReadingText(item.reading);
                            if (!displayReading) return '';
                            const isStocked = typeof getReadingStock === 'function'
                                ? getReadingStock().some(stockItem => {
                                    const sReading = stockItem.reading || stockItem['\u96b1\uff6d\u7e3a\uff7f'];
                                    return sReading === displayReading || sReading === item.reading;
                                })
                                : false;
                            const isNope = !isStocked && item.lastAction === 'nope';
                            const toneClass = isStocked
                                ? 'border-[#f2b2b2] bg-[#fff1f1]'
                                : isNope
                                    ? 'border-[#ddd6ca] bg-[#fbfaf8]'
                                    : 'border-[#eee5d8] bg-[#fdfaf5]';

                            return `
                                <button
                                    onclick="useEncounteredReading('${escapeEncounteredHtml(item.key || item.reading)}')"
                                    class="relative min-h-[68px] rounded-xl border px-3 py-2 text-left shadow-sm transition-all active:scale-95 ${toneClass}">
                                    ${renderEncounteredStateBadge({ isLiked: isStocked, isMatched: false, isNope })}
                                    <div class="pr-5">
                                        <div class="text-[18px] font-black leading-none text-[#5d5444] truncate">${escapeEncounteredHtml(displayReading)}</div>
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

function closeEncounteredReadingActionModal() {
    currentEncounteredReadingActionKey = '';
    const modal = document.getElementById('modal-encountered-reading-actions');
    if (!modal) return;
    modal.className = 'overlay';
    modal.onclick = null;
    modal.innerHTML = '';
}

function getEncounteredReadingHistoryIndex(reading) {
    if (!reading || typeof getReadingHistory !== 'function') return -1;

    const normalizedReading = normalizeEncounteredReadingText(reading);
    return getReadingHistory().findIndex((entry) => {
        if (!entry || !entry.reading) return false;
        if (entry.reading === reading) return true;
        return normalizedReading && normalizeEncounteredReadingText(entry.reading) === normalizedReading;
    });
}

function openEncounteredReadingActionModal(key) {
    const library = typeof getEncounteredLibrary === 'function'
        ? getEncounteredLibrary()
        : { readings: [] };
    const item = (library.readings || []).find(entry => (entry.key || entry.reading) === key);
    if (!item || !item.reading) return;

    const normalizedReading = normalizeEncounteredReadingText(item.reading);
    if (!normalizedReading) return;

    const modal = document.getElementById('modal-encountered-reading-actions');
    if (!modal) return;

    currentEncounteredReadingActionKey = item.key || item.reading;
    modal.className = 'overlay active modal-overlay-dark';
    modal.onclick = (event) => {
        if (event.target === modal) closeEncounteredReadingActionModal();
    };
    modal.innerHTML = `
        <div class="modal-sheet w-11/12 max-w-md" onclick="event.stopPropagation()">
            <button class="modal-close-x" onclick="closeEncounteredReadingActionModal()">✕</button>
            <h3 class="modal-title">「${escapeEncounteredHtml(normalizedReading)}」をどうしますか？</h3>
            <div class="modal-body">
                <div class="space-y-3">
                    <button onclick="searchEncounteredReadingFromModal()" class="w-full py-4 rounded-2xl bg-[#bca37f] text-white text-sm font-black shadow-sm active:scale-95">
                        漢字を探す
                    </button>
                    <button onclick="stockEncounteredReadingFromModal()" class="w-full py-4 rounded-2xl border-2 border-[#d4c5af] bg-white text-[#5d5444] text-sm font-black active:scale-95">
                        読みストックにためる
                    </button>
                    <button onclick="closeEncounteredReadingActionModal()" class="w-full py-3 text-xs font-bold text-[#a6967a] active:scale-95">
                        戻る
                    </button>
                </div>
            </div>
        </div>
    `;
    modal.classList.add('active');
}

function openEncounteredReadingActionSheet(key) {
    const library = typeof getEncounteredLibrary === 'function'
        ? getEncounteredLibrary()
        : { readings: [] };
    const item = (library.readings || []).find(entry => (entry.key || entry.reading) === key);
    if (!item || !item.reading) return;

    const normalizedReading = normalizeEncounteredReadingText(item.reading);
    if (!normalizedReading) return;

    const historyIndex = getEncounteredReadingHistoryIndex(item.reading);
    const canResumeHistory = historyIndex >= 0 && typeof loadReadingHistory === 'function';
    const modal = document.getElementById('modal-encountered-reading-actions');
    if (!modal) return;

    currentEncounteredReadingActionKey = item.key || item.reading;
    modal.className = 'overlay active modal-overlay-dark';
    modal.onclick = (event) => {
        if (event.target === modal) closeEncounteredReadingActionModal();
    };

    const primaryActionHtml = canResumeHistory
        ? `
                    <button onclick="resumeEncounteredReadingFromModal()" class="w-full py-4 rounded-2xl bg-[#bca37f] text-white text-sm font-black shadow-sm active:scale-95">
                        前回の条件で再開
                    </button>
                    <button onclick="searchEncounteredReadingFromModal()" class="w-full py-4 rounded-2xl border-2 border-[#d4c5af] bg-white text-[#5d5444] text-sm font-black active:scale-95">
                        読みを再検索
                    </button>
        `
        : `
                    <button onclick="searchEncounteredReadingFromModal()" class="w-full py-4 rounded-2xl bg-[#bca37f] text-white text-sm font-black shadow-sm active:scale-95">
                        読みを再検索
                    </button>
        `;

    modal.innerHTML = `
        <div class="modal-sheet w-11/12 max-w-md" onclick="event.stopPropagation()">
            <button class="modal-close-x" onclick="closeEncounteredReadingActionModal()">×</button>
            <h3 class="modal-title">「${escapeEncounteredHtml(normalizedReading)}」をどうしますか？</h3>
            <div class="modal-body">
                <div class="space-y-3">
${primaryActionHtml}
                    <button onclick="stockEncounteredReadingFromModal()" class="w-full py-4 rounded-2xl border-2 border-[#d4c5af] bg-white text-[#5d5444] text-sm font-black active:scale-95">
                        読みストックにためる
                    </button>
                    <button onclick="closeEncounteredReadingActionModal()" class="w-full py-3 text-xs font-bold text-[#a6967a] active:scale-95">
                        閉じる
                    </button>
                </div>
            </div>
        </div>
    `;
    modal.classList.add('active');
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
    if (typeof queuePartnerStockSync === 'function') {
        queuePartnerStockSync('historyStock');
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
    const normalizedReading = normalizeEncounteredReadingText(item.reading);
    if (!normalizedReading) return;

    if (typeof addReadingToStock === 'function') {
        addReadingToStock(normalizedReading, normalizedReading, Array.isArray(item.tags) ? item.tags : []);
    }
    if (typeof noped !== 'undefined') {
        noped.delete(item.reading);
        noped.delete(normalizedReading);
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

function stockEncounteredReadingFromModal() {
    if (!currentEncounteredReadingActionKey) return;
    const key = currentEncounteredReadingActionKey;
    closeEncounteredReadingActionModal();
    stockEncounteredReading(key);
}

function useEncounteredReading(key) {
    openEncounteredReadingActionSheet(key);
}

function resumeEncounteredReadingFromModal() {
    const library = typeof getEncounteredLibrary === 'function'
        ? getEncounteredLibrary()
        : { readings: [] };
    const key = currentEncounteredReadingActionKey;
    const item = (library.readings || []).find(entry => (entry.key || entry.reading) === key);
    if (!item || !item.reading) return;

    const historyIndex = getEncounteredReadingHistoryIndex(item.reading);
    closeEncounteredReadingActionModal();

    if (historyIndex >= 0 && typeof loadReadingHistory === 'function') {
        loadReadingHistory(historyIndex);
        return;
    }

    if (typeof openBuildFromReading === 'function') {
        openBuildFromReading(item.reading);
    }
}

function searchEncounteredReadingFromModal() {
    const library = typeof getEncounteredLibrary === 'function'
        ? getEncounteredLibrary()
        : { readings: [] };
    const key = currentEncounteredReadingActionKey;
    const item = (library.readings || []).find(entry => (entry.key || entry.reading) === key);
    if (!item || !item.reading) return;
    const normalizedReading = normalizeEncounteredReadingText(item.reading);
    if (!normalizedReading) return;
    closeEncounteredReadingActionModal();
    if (typeof proceedWithSoundReading === 'function') {
        proceedWithSoundReading(normalizedReading);
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
let _lastSavedDetailSource = 'own';

/**
 * 保存済み名前の詳細を表示するモーダル
 */
function showSavedNameDetail(index, source = 'own') {
    const pairInsights = typeof window.MeimayPartnerInsights !== 'undefined' ? window.MeimayPartnerInsights : null;
    const saved = getSavedNames();
    const partnerSaved = pairInsights?.getPartnerSaved ? pairInsights.getPartnerSaved() : [];
    const sourceSaved = source === 'partner' ? partnerSaved : saved;
    if (index < 0 || index >= sourceSaved.length) return;
    const item = sourceSaved[index];
    _lastSavedDetailIndex = index; // 戻り用に保存

    const sourceKey = getSavedCandidateKey(item);
    _lastSavedDetailSource = source;
    const canvasState = getSavedCanvasState();
    const savedFocus = typeof window !== 'undefined' && typeof window.savedFocus !== 'undefined'
        ? window.savedFocus
        : 'all';
    const localDeleteIndex = source === 'own' ? index : -1;
    const sourceBadge = getSavedCandidateCreatorMeta(item, source, canvasState.partnerName);
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
                        <div onclick="showFortuneDetailFromSaved(${index}, '${source}')"
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
                    <button onclick="loadSavedName(${index}, '${source}')" class="w-full py-5 bg-[#bca37f] text-white rounded-[1.5rem] text-sm font-black shadow-lg shadow-[#bca37f]/20 hover:bg-[#a68d68] transition-all active:scale-[0.98] flex items-center justify-center gap-2">
                         <span>🛠️</span> この構成で漢字を選びなおす
                    </button>
                    ${localDeleteIndex >= 0 ? `<button onclick="deleteSavedName(${localDeleteIndex})" class="w-full py-4 bg-[#fef2f2] text-[#f28b82] rounded-xl text-xs font-bold hover:bg-[#f28b82] hover:text-white transition-all">削除</button>` : ''}
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
function showFortuneDetailFromSaved(index, source = 'own') {
    const pairInsights = typeof window.MeimayPartnerInsights !== 'undefined' ? window.MeimayPartnerInsights : null;
    const saved = getSavedNames();
    const partnerSaved = pairInsights?.getPartnerSaved ? pairInsights.getPartnerSaved() : [];
    const sourceSaved = source === 'partner' ? partnerSaved : saved;
    const item = sourceSaved[index];
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
function loadSavedName(index, source = 'own') {
    const pairInsights = typeof window.MeimayPartnerInsights !== 'undefined' ? window.MeimayPartnerInsights : null;
    const saved = getSavedNames();
    const partnerSaved = pairInsights?.getPartnerSaved ? pairInsights.getPartnerSaved() : [];
    const sourceSaved = source === 'partner' ? partnerSaved : saved;
    if (index < 0 || index >= sourceSaved.length) return;

    const item = sourceSaved[index];

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
window.openEncounteredReadingActionModal = openEncounteredReadingActionSheet;
window.closeEncounteredReadingActionModal = closeEncounteredReadingActionModal;
window.stockEncounteredReadingFromModal = stockEncounteredReadingFromModal;
window.resumeEncounteredReadingFromModal = resumeEncounteredReadingFromModal;
window.searchEncounteredReadingFromModal = searchEncounteredReadingFromModal;
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
                : [{ kanji: typeof surnameStr !== 'undefined' ? surnameStr : '', strokes: 0 }];
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
        fromPartner: true,
        approvedFromPartner: true,
        approvedPartnerSavedKey: approvedPartnerSavedKey || '',
        partnerName: partnerName || 'パートナー'
    };
}

/*
function getSavedCandidateKey(item) {
    if (!item) return '';
    const pairInsights = typeof window.MeimayPartnerInsights !== 'undefined' ? window.MeimayPartnerInsights : null;
    if (pairInsights?.buildSavedMatchKey) {
        return pairInsights.buildSavedMatchKey(item);
    }
    const combinationKey = Array.isArray(item.combination) && item.combination.length > 0
        ? item.combination.map(part => part?.['貍｢蟄・] || part?.kanji || '').join('')
        : (Array.isArray(item.combinationKeys) ? item.combinationKeys.join('') : '');
    const fullName = item.fullName || item.givenName || combinationKey;
    const reading = String(item.reading || item.givenName || '').trim();
    return `${fullName}::${combinationKey}::${reading}`;
}

function getSavedCandidateCreatorMeta(item, source = 'own', partnerName = '') {
    const fromPartner = source === 'own'
        ? !!item?.approvedFromPartner
        : !item?.approvedFromPartner;
    const label = fromPartner
        ? `${partnerName || 'パートナー'}発案`
        : '自分発案';

    return {
        fromPartner,
        label,
        toneClass: fromPartner
            ? 'bg-[#fde8e5] text-[#dd7d73] border-[#f4d3cf]'
            : 'bg-[#eef5ff] text-[#4f7cb8] border-[#d8e4ff]'
    };
}

function getSavedCanvasState() {
    const pairInsights = typeof window.MeimayPartnerInsights !== 'undefined' ? window.MeimayPartnerInsights : null;
    if (pairInsights?.getSavedNameCanvasState) {
        return pairInsights.getSavedNameCanvasState();
    }

    const pairInsights = typeof window.MeimayPartnerInsights !== 'undefined' ? window.MeimayPartnerInsights : null;
    const saved = getSavedNames();
    const partnerSaved = pairInsights?.getPartnerSaved ? pairInsights.getPartnerSaved() : [];
    const ownMain = saved.slice().reverse().find(item => item?.mainSelected) || null;
    const partnerMain = partnerSaved.slice().reverse().find(item => item?.mainSelected) || null;
    const ownKey = getSavedCandidateKey(ownMain);
    const partnerKey = getSavedCandidateKey(partnerMain);

    return {
        ownMain,
        partnerMain,
        ownKey,
        partnerKey,
        matched: !!ownKey && ownKey === partnerKey,
        partnerName: pairInsights?.getPartnerDisplayName
            ? pairInsights.getPartnerDisplayName()
            : (typeof getPartnerRoleLabel === 'function'
                ? getPartnerRoleLabel(MeimayShare?.partnerSnapshot?.role)
                : 'パートナー')
    };
}

function setSavedMainCandidate(index) {
    const saved = getSavedNames();
    if (index < 0 || index >= saved.length) return false;

    const selectedItem = saved[index];
    const selectedKey = getSavedCandidateKey(selectedItem);
    if (!selectedKey) return false;

    const now = new Date().toISOString();
    const updated = saved.map((item) => {
        const itemKey = getSavedCandidateKey(item);
        const isSelected = itemKey === selectedKey;
        return {
            ...item,
            mainSelected: isSelected,
            mainSelectedAt: isSelected ? now : item.mainSelectedAt || ''
        };
    });

    localStorage.setItem('meimay_saved', JSON.stringify(updated));
    if (typeof savedNames !== 'undefined') savedNames = updated;

    if (typeof MeimayPairing !== 'undefined' && MeimayPairing.roomCode) {
        MeimayPairing._autoSyncDebounced?.();
    }

    renderSavedScreen();
    if (typeof refreshPartnerAwareUI === 'function') refreshPartnerAwareUI();
    if (typeof showToast === 'function') showToast('本命にしました', '寵');
    return true;
}

function deleteSavedNameBySourceIndex(index, source = 'own') {
    const pairInsights = typeof window.MeimayPartnerInsights !== 'undefined' ? window.MeimayPartnerInsights : null;
    const sourceSaved = source === 'partner'
        ? (pairInsights?.getPartnerSaved ? pairInsights.getPartnerSaved() : [])
        : getSavedNames();
    if (index < 0 || index >= sourceSaved.length) return false;

    const sourceItem = sourceSaved[index];
    const sourceKey = getSavedCandidateKey(sourceItem);
    if (!sourceKey) return false;

    const saved = getSavedNames();
    const ownIndex = source === 'partner'
        ? saved.findIndex(item => getSavedCandidateKey(item) === sourceKey)
        : index;

    if (ownIndex < 0 || ownIndex >= saved.length) {
        if (typeof showToast === 'function') showToast('自分の保存済みにはない候補です', '沈');
        return false;
    }

    if (!confirm('この名前を削除しますか？')) return false;

    saved.splice(ownIndex, 1);
    if (typeof savedNames !== 'undefined') savedNames = saved;
    localStorage.setItem('meimay_saved', JSON.stringify(saved));

    if (typeof MeimayPairing !== 'undefined' && MeimayPairing.roomCode) {
        MeimayPairing._autoSyncDebounced?.();
    }

    renderSavedScreen();
    if (typeof refreshPartnerAwareUI === 'function') refreshPartnerAwareUI();
    if (typeof showToast === 'function') showToast('削除しました', '寵');
    return true;
}

function votePartnerSavedName(index) {
    const pairInsights = typeof window.MeimayPartnerInsights !== 'undefined' ? window.MeimayPartnerInsights : null;
    const partnerSaved = pairInsights?.getPartnerSaved ? pairInsights.getPartnerSaved() : [];
    if (index < 0 || index >= partnerSaved.length) return false;

    const source = partnerSaved[index];
    if (!source) return false;

    const sourceKey = getSavedCandidateKey(source);
    if (!sourceKey) return false;

    const partnerName = pairInsights?.getPartnerDisplayName
        ? pairInsights.getPartnerDisplayName()
        : (typeof getPartnerRoleLabel === 'function'
            ? getPartnerRoleLabel(MeimayShare?.partnerSnapshot?.role)
            : 'パートナー');

    try {
        if (typeof window !== 'undefined') {
            window.__meimaySavedCanvasOwnKey = sourceKey;
            window.__meimaySavedCanvasPartnerKey = '';
        }
        localStorage.setItem('meimay_saved_canvas_own_key', sourceKey);
        localStorage.removeItem('meimay_saved_canvas_partner_key');
    } catch (error) {
        console.warn('SAVED: Persist own main key from partner candidate failed', error);
    }

    renderSavedScreen();
    if (typeof refreshPartnerAwareUI === 'function') refreshPartnerAwareUI();
    if (typeof showToast === 'function') showToast(`${partnerName}の候補を本命にしました`, '✓');
    return true;
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

function getSavedCanvasState() {
    const pairInsights = typeof window.MeimayPartnerInsights !== 'undefined' ? window.MeimayPartnerInsights : null;
    const saved = getSavedNames();
    const partnerSaved = pairInsights?.getPartnerSaved ? pairInsights.getPartnerSaved() : [];
    const ownOverrideKey = typeof window !== 'undefined' && typeof window.__meimaySavedCanvasOwnKey === 'string' && window.__meimaySavedCanvasOwnKey
        ? window.__meimaySavedCanvasOwnKey
        : (typeof localStorage !== 'undefined' ? (localStorage.getItem('meimay_saved_canvas_own_key') || '') : '');
    const partnerOverrideKey = typeof window !== 'undefined' && typeof window.__meimaySavedCanvasPartnerKey === 'string' && window.__meimaySavedCanvasPartnerKey
        ? window.__meimaySavedCanvasPartnerKey
        : (typeof localStorage !== 'undefined' ? (localStorage.getItem('meimay_saved_canvas_partner_key') || '') : '');

    const pickLatestMain = (items, overrideKey) => {
        if (overrideKey) {
            const overrideItem = items.slice().reverse().find(item => getSavedCandidateKey(item) === overrideKey);
            if (overrideItem) return overrideItem;
        }
        const mainItems = items.filter(item => item?.mainSelected);
        if (mainItems.length === 0) return null;
        return mainItems.slice().sort((a, b) => {
            const aTime = new Date(a.mainSelectedAt || a.savedAt || a.timestamp || 0).getTime();
            const bTime = new Date(b.mainSelectedAt || b.savedAt || b.timestamp || 0).getTime();
            return bTime - aTime;
        })[0] || null;
    };

    const ownMain = pickLatestMain(saved.filter(item => !item?.fromPartner && !item?.approvedFromPartner), ownOverrideKey);
    const partnerMain = pickLatestMain(partnerSaved, partnerOverrideKey);
    const ownKey = getSavedCandidateKey(ownMain);
    const partnerKey = getSavedCandidateKey(partnerMain);
    const partnerName = pairInsights?.getPartnerDisplayName
        ? pairInsights.getPartnerDisplayName()
        : (typeof getPartnerRoleLabel === 'function'
            ? getPartnerRoleLabel(MeimayShare?.partnerSnapshot?.role)
            : 'パートナー');

    return {
        ownMain,
        partnerMain,
        ownKey,
        partnerKey,
        matched: !!ownKey && !!partnerKey && ownKey === partnerKey,
        partnerName
    };
}

function setSavedMainCandidate(index) {
    const saved = getSavedNames().filter(item => !item?.fromPartner && !item?.approvedFromPartner);
    if (index < 0 || index >= saved.length) return false;

    const selectedItem = saved[index];
    const selectedKey = getSavedCandidateKey(selectedItem);
    if (!selectedKey) return false;

    const now = new Date().toISOString();
    const updated = saved.map((item) => {
        const itemKey = getSavedCandidateKey(item);
        const isSelected = itemKey === selectedKey;
        return {
            ...item,
            mainSelected: isSelected,
            mainSelectedAt: isSelected ? now : item.mainSelectedAt || ''
        };
    });

    localStorage.setItem('meimay_saved', JSON.stringify(updated));
    if (typeof savedNames !== 'undefined') savedNames = updated;
    try {
        if (typeof window !== 'undefined') {
            window.__meimaySavedCanvasOwnKey = selectedKey;
        }
        localStorage.setItem('meimay_saved_canvas_own_key', selectedKey);
    } catch (error) {
        console.warn('SAVED: Persist own main key failed', error);
    }

    if (typeof MeimayPairing !== 'undefined' && MeimayPairing.roomCode) {
        MeimayPairing._autoSyncDebounced?.();
    }

    renderSavedScreen();
    if (typeof refreshPartnerAwareUI === 'function') refreshPartnerAwareUI();
    if (typeof showToast === 'function') showToast('マイ本命にしました', 'OK');
    return true;
}

function votePartnerSavedName(index) {
    const pairInsights = typeof window.MeimayPartnerInsights !== 'undefined' ? window.MeimayPartnerInsights : null;
    const partnerSaved = pairInsights?.getPartnerSaved ? pairInsights.getPartnerSaved() : [];
    if (index < 0 || index >= partnerSaved.length) return false;

    const source = partnerSaved[index];
    if (!source) return false;

    const sourceKey = getSavedCandidateKey(source);
    if (!sourceKey) return false;

    const partnerName = pairInsights?.getPartnerDisplayName
        ? pairInsights.getPartnerDisplayName()
        : (typeof getPartnerRoleLabel === 'function'
            ? getPartnerRoleLabel(MeimayShare?.partnerSnapshot?.role)
            : 'パートナー');

    try {
        if (typeof window !== 'undefined') {
            window.__meimaySavedCanvasPartnerKey = sourceKey;
        }
        localStorage.setItem('meimay_saved_canvas_partner_key', sourceKey);
    } catch (error) {
        console.warn('SAVED: Persist partner main key failed', error);
    }

    renderSavedScreen();
    if (typeof refreshPartnerAwareUI === 'function') refreshPartnerAwareUI();
    if (typeof showToast === 'function') showToast(`${partnerName}の本命にしました`, 'OK');
    return true;
}

function likePartnerSavedName(index) {
    return votePartnerSavedName(index);
}

function renderSavedScreen() {
    const canvasContainer = document.getElementById('saved-naming-canvas');
    const listContainer = document.getElementById('saved-list-content');
    if (!canvasContainer || !listContainer) return;

    const saved = getSavedNames();
    const pairInsights = typeof window.MeimayPartnerInsights !== 'undefined' ? window.MeimayPartnerInsights : null;
    const partnerViewState = typeof window.getMeimayPartnerViewState === 'function'
        ? window.getMeimayPartnerViewState()
        : { savedFocus: 'all' };
    const savedFocus = partnerViewState.savedFocus || 'all';
    const partnerSaved = pairInsights?.getPartnerSaved ? pairInsights.getPartnerSaved() : [];
    const canvasState = getSavedCanvasState();
    const partnerName = canvasState.partnerName || (pairInsights?.getPartnerDisplayName
        ? pairInsights.getPartnerDisplayName()
        : (typeof getPartnerRoleLabel === 'function'
            ? getPartnerRoleLabel(MeimayShare?.partnerSnapshot?.role)
            : 'パートナー'));

    const ownVisibleItems = saved.filter(item => !item?.fromPartner && !item?.approvedFromPartner);
    const partnerVisibleItems = partnerSaved.filter(item => !item?.approvedFromPartner && !pairInsights?.isPartnerSavedApproved?.(item));
    const ownKeySet = new Set(ownVisibleItems.map(item => getSavedCandidateKey(item)).filter(Boolean));
    const partnerKeySet = new Set(partnerVisibleItems.map(item => getSavedCandidateKey(item)).filter(Boolean));

    const ownDecorated = ownVisibleItems.map((item, index) => {
        const key = getSavedCandidateKey(item);
        const mySelected = !!canvasState.ownKey && key === canvasState.ownKey;
        const partnerSelected = !!canvasState.partnerKey && key === canvasState.partnerKey;
        const shared = !!key && ownKeySet.has(key) && partnerKeySet.has(key);
        return {
            item,
            index,
            key,
            mySelected,
            partnerSelected,
            shared
        };
    }).sort((a, b) => {
        if (a.mySelected !== b.mySelected) return a.mySelected ? -1 : 1;
        if (a.partnerSelected !== b.partnerSelected) return a.partnerSelected ? -1 : 1;
        if (a.shared !== b.shared) return a.shared ? -1 : 1;
        const aTime = new Date(a.item.mainSelectedAt || a.item.savedAt || a.item.timestamp || 0).getTime();
        const bTime = new Date(b.item.mainSelectedAt || b.item.savedAt || b.item.timestamp || 0).getTime();
        return bTime - aTime;
    });

    const partnerDecorated = partnerVisibleItems.map((item, index) => {
        const key = getSavedCandidateKey(item);
        const mySelected = !!canvasState.ownKey && key === canvasState.ownKey;
        const partnerSelected = !!canvasState.partnerKey && key === canvasState.partnerKey;
        const shared = !!key && ownKeySet.has(key) && partnerKeySet.has(key);
        return {
            item,
            index,
            key,
            mySelected,
            partnerSelected,
            shared
        };
    }).sort((a, b) => {
        if (a.partnerSelected !== b.partnerSelected) return a.partnerSelected ? -1 : 1;
        if (a.mySelected !== b.mySelected) return a.mySelected ? -1 : 1;
        if (a.shared !== b.shared) return a.shared ? -1 : 1;
        const aTime = new Date(a.item.mainSelectedAt || a.item.savedAt || a.item.timestamp || 0).getTime();
        const bTime = new Date(b.item.mainSelectedAt || b.item.savedAt || b.item.timestamp || 0).getTime();
        return bTime - aTime;
    });

    let visibleOwn = ownDecorated;
    let visiblePartner = partnerDecorated;
    if (savedFocus === 'partner') {
        visibleOwn = [];
    } else if (savedFocus === 'matched') {
        visibleOwn = ownDecorated.filter(entry => entry.shared || (entry.mySelected && entry.partnerSelected));
        visiblePartner = [];
    }

    const ownTheme = {
        border: 'border-[#e6c79d]',
        borderSelected: 'border-[#d9aa63]',
        bg: 'bg-[#fff9f1]',
        bgSelected: 'bg-[#fff4e4]',
        label: 'text-[#c78c50]',
        button: 'from-[#f7c47c] to-[#e7a665]',
        ring: 'ring-[#e6c79d]'
    };
    const partnerTheme = {
        border: 'border-[#e7bcc6]',
        borderSelected: 'border-[#d88da2]',
        bg: 'bg-[#fff7f9]',
        bgSelected: 'bg-[#fff0f4]',
        label: 'text-[#d57f8f]',
        button: 'from-[#f1b1ca] to-[#e79ab2]',
        ring: 'ring-[#e7bcc6]'
    };

    const renderCanvasSide = (item, title, emptyText, theme) => {
        if (!item) {
            return `
                <div class="rounded-[24px] border border-dashed ${theme.border} ${theme.bg} px-4 py-4 text-center">
                    <div class="text-[12px] font-black tracking-[0.18em] ${theme.label}">${escapeHtml(title)}</div>
                    <div class="mt-2 text-sm font-bold text-[#8b7e66]">${escapeHtml(emptyText)}</div>
                </div>
            `;
        }

        const key = getSavedCandidateKey(item);
        const selected = title === 'マイ本命'
            ? !!canvasState.ownKey && key === canvasState.ownKey
            : !!canvasState.partnerKey && key === canvasState.partnerKey;

        return `
            <div class="rounded-[24px] border ${selected ? theme.borderSelected : theme.border} ${selected ? theme.bgSelected : theme.bg} px-4 py-4 shadow-sm ${selected ? `ring-2 ${theme.ring}` : ''}">
                <div class="flex flex-col items-center text-center">
                    <div class="text-[12px] font-black tracking-[0.18em] ${theme.label}">${escapeHtml(title)}</div>
                    <div data-fit-saved-name="split" class="mt-3 w-full overflow-hidden text-center text-[23px] font-black leading-[1.06] whitespace-nowrap text-[#5d5444]">
                        ${escapeHtml(item.fullName || item.givenName || '')}
                    </div>
                </div>
            </div>
        `;
    };

    const mainItem = canvasState.ownMain || canvasState.partnerMain;
    const renderCanvasHtml = canvasState.matched && mainItem
        ? `
            <div class="rounded-[28px] border border-[#eadfce] bg-gradient-to-br from-[#fff7ee] via-[#fffdf9] to-[#fff5f7] p-3 shadow-[0_18px_35px_-28px_rgba(123,104,83,0.55)]">
                <div class="rounded-[22px] border border-[#eadfce] bg-white px-4 py-5 text-center shadow-sm">
                    <div class="text-[12px] font-black tracking-[0.18em] text-[#b68a52]">ふたりの本命</div>
                    <div data-fit-saved-name="canvas" class="mt-3 w-full overflow-hidden text-center text-[28px] font-black leading-[1.04] whitespace-nowrap text-[#5d5444]">
                        ${escapeHtml(mainItem.fullName || mainItem.givenName || '')}
                    </div>
                </div>
            </div>
        `
        : `
            <div class="grid grid-cols-2 gap-2.5">
                ${renderCanvasSide(canvasState.ownMain, 'マイ本命', 'まだ本命を選んでいません', ownTheme)}
                ${renderCanvasSide(canvasState.partnerMain, 'パートナー本命', 'まだ本命を選んでいません', partnerTheme)}
            </div>
        `;

    canvasContainer.innerHTML = `
        <div class="rounded-[28px] border border-[#eee5d8] bg-gradient-to-br from-[#fffdf9] via-[#fffaf4] to-[#f8f1e7] p-4 shadow-[0_18px_35px_-28px_rgba(123,104,83,0.55)]">
            <div class="mb-3 text-[13px] font-black text-[#5d5444] text-center">本命の候補を選択してください</div>
            ${renderCanvasHtml}
        </div>
    `;

    const renderCard = (entry, source) => {
        const item = entry.item;
        const mySelected = source === 'own' ? entry.mySelected : entry.partnerSelected;
        const partnerSelected = source === 'own' ? entry.partnerSelected : entry.mySelected;
        const buttonText = source === 'own'
            ? (mySelected ? '本命中' : '本命にする')
            : (partnerSelected ? '本命中' : '本命にする');
        const buttonAction = source === 'own'
            ? `setSavedMainCandidate(${entry.index})`
            : `votePartnerSavedName(${entry.index})`;
        const buttonDisabled = source === 'own' ? mySelected : partnerSelected;
        const theme = source === 'own' ? ownTheme : partnerTheme;
        const detailSource = source === 'own' ? 'own' : 'partner';
        const borderClass = mySelected || partnerSelected ? theme.borderSelected : theme.border;
        const bgClass = mySelected || partnerSelected ? theme.bgSelected : theme.bg;
        const nameText = escapeHtml(item.fullName || item.givenName || '');
        const readingText = escapeHtml(item.reading || '');
        const messageText = item.message ? escapeHtml(item.message) : '';
        const statusBadge = source === 'own' && partnerSelected && !mySelected
            ? `<span class="inline-flex items-center rounded-full border border-[#eadfce] bg-[#fff8ef] px-2.5 py-1 text-[10px] font-bold text-[#b68a52]">本命中</span>`
            : '';

        return `
            <div onclick="showSavedNameDetail(${entry.index}, '${detailSource}')" class="group cursor-pointer rounded-[24px] border ${borderClass} ${bgClass} p-4 shadow-sm transition-all active:scale-[0.99]">
                <div class="flex items-start justify-between gap-3">
                    <div class="min-w-0 flex-1">
                        <div class="flex items-center gap-2">
                            ${statusBadge}
                        </div>
                        <div data-fit-saved-name="card" class="mt-1 w-full overflow-hidden whitespace-nowrap text-ellipsis text-[16px] font-black leading-tight text-[#5d5444]">${nameText}</div>
                        ${readingText ? `<div class="mt-1 text-[11px] text-[#a6967a]">${readingText}</div>` : ''}
                        ${messageText ? `<div class="mt-1 text-[11px] text-[#bca37f]">メモ ${messageText}</div>` : ''}
                    </div>
                    <div class="shrink-0">
                        <button onclick="event.stopPropagation(); ${buttonAction}" ${buttonDisabled ? 'disabled' : ''} class="min-w-[7rem] rounded-full px-3 py-1.5 text-[11px] font-black ${buttonDisabled ? 'bg-[#5d5444] text-white cursor-default' : `bg-gradient-to-r ${theme.button} text-white active:scale-95`}">
                            ${buttonText}
                        </button>
                    </div>
                </div>
            </div>
        `;
    };

    let html = '';
    if (visibleOwn.length > 0) {
        html += `
            <div class="space-y-3">
                <div class="flex items-center justify-between gap-3 px-1">
                    <div class="text-[10px] font-black tracking-[0.18em] text-[#bca37f]">自分の候補</div>
                    <div class="text-[11px] text-[#8b7e66]">${visibleOwn.length}件</div>
                </div>
                ${visibleOwn.map(entry => renderCard(entry, 'own')).join('')}
            </div>
        `;
    }

    if (visiblePartner.length > 0) {
        html += `
            <div class="space-y-3 pt-1">
                <div class="flex items-center justify-between gap-3 px-1">
                    <div class="text-[10px] font-black tracking-[0.18em] text-[#dd7d73]">${escapeHtml(partnerName)}の候補</div>
                    <div class="text-[11px] text-[#8b7e66]">${visiblePartner.length}件</div>
                </div>
                ${visiblePartner.map(entry => renderCard(entry, 'partner')).join('')}
            </div>
        `;
    }

    if (!html) {
        html = `
            <div class="text-center py-16 text-sm text-[#a6967a]">
                <p>まだ保存された候補はありません</p>
                <p class="text-[10px] mt-2">候補を保存するとここに並びます</p>
            </div>
        `;
    }

    listContainer.innerHTML = html;
    if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(applySavedTextFit);
    } else {
        setTimeout(applySavedTextFit, 0);
    }
}

window.likePartnerSavedName = likePartnerSavedName;
window.clearSavedPartnerFocus = clearSavedPartnerFocus;
window.getSavedNames = getSavedNames;
window.renderSavedScreen = renderSavedScreen;
window.setSavedMainCandidate = setSavedMainCandidate;
window.votePartnerSavedName = votePartnerSavedName;
window.deleteSavedName = deleteSavedNameBySourceIndex;
window.getSavedCandidateKey = getSavedCandidateKey;
window.getSavedCanvasState = getSavedCanvasState;

function getSavedCanvasState() {
    const pairInsights = typeof window.MeimayPartnerInsights !== 'undefined' ? window.MeimayPartnerInsights : null;
    const saved = getSavedNames();
    const partnerSaved = pairInsights?.getPartnerSaved ? pairInsights.getPartnerSaved() : [];
    const ownOverrideKey = typeof window !== 'undefined' && typeof window.__meimaySavedCanvasOwnKey === 'string' && window.__meimaySavedCanvasOwnKey
        ? window.__meimaySavedCanvasOwnKey
        : (typeof localStorage !== 'undefined' ? (localStorage.getItem('meimay_saved_canvas_own_key') || '') : '');
    const partnerOverrideKey = typeof window !== 'undefined' && typeof window.__meimaySavedCanvasPartnerKey === 'string' && window.__meimaySavedCanvasPartnerKey
        ? window.__meimaySavedCanvasPartnerKey
        : (typeof localStorage !== 'undefined' ? (localStorage.getItem('meimay_saved_canvas_partner_key') || '') : '');

    const pickLatestMain = (items, overrideKey) => {
        if (overrideKey) {
            const overrideItem = items.slice().reverse().find(item => getSavedCandidateKey(item) === overrideKey);
            if (overrideItem) return overrideItem;
        }
        const mainItems = items.filter(item => item?.mainSelected);
        if (mainItems.length === 0) return null;
        return mainItems.slice().sort((a, b) => {
            const aTime = new Date(a.mainSelectedAt || a.savedAt || a.timestamp || 0).getTime();
            const bTime = new Date(b.mainSelectedAt || b.savedAt || b.timestamp || 0).getTime();
            return bTime - aTime;
        })[0] || null;
    };

    const ownMain = pickLatestMain(saved.filter(item => !item?.fromPartner && !item?.approvedFromPartner), ownOverrideKey);
    const partnerMain = pickLatestMain(partnerSaved, partnerOverrideKey);
    const ownKey = getSavedCandidateKey(ownMain);
    const partnerKey = getSavedCandidateKey(partnerMain);
    const partnerName = pairInsights?.getPartnerDisplayName
        ? pairInsights.getPartnerDisplayName()
        : (typeof getPartnerRoleLabel === 'function'
            ? getPartnerRoleLabel(MeimayShare?.partnerSnapshot?.role)
            : 'パートナー');

    return {
        ownMain,
        partnerMain,
        ownKey,
        partnerKey,
        matched: !!ownKey && !!partnerKey && ownKey === partnerKey,
        partnerName
    };
}

function setSavedMainCandidate(index) {
    const saved = getSavedNames().filter(item => !item?.fromPartner && !item?.approvedFromPartner);
    if (index < 0 || index >= saved.length) return false;

    const selectedItem = saved[index];
    const selectedKey = getSavedCandidateKey(selectedItem);
    if (!selectedKey) return false;

    const now = new Date().toISOString();
    const updated = saved.map((item) => {
        const itemKey = getSavedCandidateKey(item);
        const isSelected = itemKey === selectedKey;
        return {
            ...item,
            mainSelected: isSelected,
            mainSelectedAt: isSelected ? now : item.mainSelectedAt || ''
        };
    });

    localStorage.setItem('meimay_saved', JSON.stringify(updated));
    if (typeof savedNames !== 'undefined') savedNames = updated;
    try {
        if (typeof window !== 'undefined') {
            window.__meimaySavedCanvasOwnKey = selectedKey;
        }
        localStorage.setItem('meimay_saved_canvas_own_key', selectedKey);
    } catch (error) {
        console.warn('SAVED: Persist own main key failed', error);
    }

    if (typeof MeimayPairing !== 'undefined' && MeimayPairing.roomCode) {
        MeimayPairing._autoSyncDebounced?.();
    }

    renderSavedScreen();
    if (typeof refreshPartnerAwareUI === 'function') refreshPartnerAwareUI();
    if (typeof showToast === 'function') showToast('マイ本命にしました', 'OK');
    return true;
}

function votePartnerSavedName(index) {
    const pairInsights = typeof window.MeimayPartnerInsights !== 'undefined' ? window.MeimayPartnerInsights : null;
    const partnerSaved = pairInsights?.getPartnerSaved ? pairInsights.getPartnerSaved() : [];
    if (index < 0 || index >= partnerSaved.length) return false;

    const source = partnerSaved[index];
    if (!source) return false;

    const sourceKey = getSavedCandidateKey(source);
    if (!sourceKey) return false;

    const partnerName = pairInsights?.getPartnerDisplayName
        ? pairInsights.getPartnerDisplayName()
        : (typeof getPartnerRoleLabel === 'function'
            ? getPartnerRoleLabel(MeimayShare?.partnerSnapshot?.role)
            : 'パートナー');

    try {
        if (typeof window !== 'undefined') {
            window.__meimaySavedCanvasPartnerKey = sourceKey;
        }
        localStorage.setItem('meimay_saved_canvas_partner_key', sourceKey);
    } catch (error) {
        console.warn('SAVED: Persist partner main key failed', error);
    }

    renderSavedScreen();
    if (typeof refreshPartnerAwareUI === 'function') refreshPartnerAwareUI();
    if (typeof showToast === 'function') showToast(`${partnerName}の本命にしました`, 'OK');
    return true;
}

function likePartnerSavedName(index) {
    return votePartnerSavedName(index);
}

function renderSavedScreen() {
    const canvasContainer = document.getElementById('saved-naming-canvas');
    const listContainer = document.getElementById('saved-list-content');
    if (!canvasContainer || !listContainer) return;

    const saved = getSavedNames();
    const pairInsights = typeof window.MeimayPartnerInsights !== 'undefined' ? window.MeimayPartnerInsights : null;
    const partnerViewState = typeof window.getMeimayPartnerViewState === 'function'
        ? window.getMeimayPartnerViewState()
        : { savedFocus: 'all' };
    const savedFocus = partnerViewState.savedFocus || 'all';
    const partnerSaved = pairInsights?.getPartnerSaved ? pairInsights.getPartnerSaved() : [];
    const canvasState = getSavedCanvasState();
    const partnerName = canvasState.partnerName || (pairInsights?.getPartnerDisplayName
        ? pairInsights.getPartnerDisplayName()
        : (typeof getPartnerRoleLabel === 'function'
            ? getPartnerRoleLabel(MeimayShare?.partnerSnapshot?.role)
            : 'パートナー'));

    const ownVisibleItems = saved.filter(item => !item?.fromPartner && !item?.approvedFromPartner);
    const partnerVisibleItems = partnerSaved.filter(item => !item?.approvedFromPartner && !pairInsights?.isPartnerSavedApproved?.(item));
    const ownKeySet = new Set(ownVisibleItems.map(item => getSavedCandidateKey(item)).filter(Boolean));
    const partnerKeySet = new Set(partnerVisibleItems.map(item => getSavedCandidateKey(item)).filter(Boolean));

    const ownDecorated = ownVisibleItems.map((item, index) => {
        const key = getSavedCandidateKey(item);
        const mySelected = !!canvasState.ownKey && key === canvasState.ownKey;
        const partnerSelected = !!canvasState.partnerKey && key === canvasState.partnerKey;
        const shared = !!key && ownKeySet.has(key) && partnerKeySet.has(key);
        return {
            item,
            index,
            key,
            mySelected,
            partnerSelected,
            shared
        };
    }).sort((a, b) => {
        if (a.mySelected !== b.mySelected) return a.mySelected ? -1 : 1;
        if (a.partnerSelected !== b.partnerSelected) return a.partnerSelected ? -1 : 1;
        if (a.shared !== b.shared) return a.shared ? -1 : 1;
        const aTime = new Date(a.item.mainSelectedAt || a.item.savedAt || a.item.timestamp || 0).getTime();
        const bTime = new Date(b.item.mainSelectedAt || b.item.savedAt || b.item.timestamp || 0).getTime();
        return bTime - aTime;
    });

    const partnerDecorated = partnerVisibleItems.map((item, index) => {
        const key = getSavedCandidateKey(item);
        const mySelected = !!canvasState.ownKey && key === canvasState.ownKey;
        const partnerSelected = !!canvasState.partnerKey && key === canvasState.partnerKey;
        const shared = !!key && ownKeySet.has(key) && partnerKeySet.has(key);
        return {
            item,
            index,
            key,
            mySelected,
            partnerSelected,
            shared
        };
    }).sort((a, b) => {
        if (a.partnerSelected !== b.partnerSelected) return a.partnerSelected ? -1 : 1;
        if (a.mySelected !== b.mySelected) return a.mySelected ? -1 : 1;
        if (a.shared !== b.shared) return a.shared ? -1 : 1;
        const aTime = new Date(a.item.mainSelectedAt || a.item.savedAt || a.item.timestamp || 0).getTime();
        const bTime = new Date(b.item.mainSelectedAt || b.item.savedAt || b.item.timestamp || 0).getTime();
        return bTime - aTime;
    });

    let visibleOwn = ownDecorated;
    let visiblePartner = partnerDecorated;
    if (savedFocus === 'partner') {
        visibleOwn = [];
    } else if (savedFocus === 'matched') {
        visibleOwn = ownDecorated.filter(entry => entry.shared || (entry.mySelected && entry.partnerSelected));
        visiblePartner = [];
    }

    const ownTheme = {
        border: 'border-[#e6c79d]',
        borderSelected: 'border-[#d9aa63]',
        bg: 'bg-[#fff9f1]',
        bgSelected: 'bg-[#fff4e4]',
        label: 'text-[#c78c50]',
        button: 'from-[#f7c47c] to-[#e7a665]',
        ring: 'ring-[#e6c79d]'
    };
    const partnerTheme = {
        border: 'border-[#e7bcc6]',
        borderSelected: 'border-[#d88da2]',
        bg: 'bg-[#fff7f9]',
        bgSelected: 'bg-[#fff0f4]',
        label: 'text-[#d57f8f]',
        button: 'from-[#f1b1ca] to-[#e79ab2]',
        ring: 'ring-[#e7bcc6]'
    };

    const renderCanvasSide = (item, title, emptyText, theme) => {
        if (!item) {
            return `
                <div class="rounded-[24px] border border-dashed ${theme.border} ${theme.bg} px-4 py-4 text-center">
                    <div class="text-[12px] font-black tracking-[0.18em] ${theme.label}">${escapeHtml(title)}</div>
                    <div class="mt-2 text-sm font-bold text-[#8b7e66]">${escapeHtml(emptyText)}</div>
                </div>
            `;
        }

        const key = getSavedCandidateKey(item);
        const selected = title === 'マイ本命'
            ? !!canvasState.ownKey && key === canvasState.ownKey
            : !!canvasState.partnerKey && key === canvasState.partnerKey;

        return `
            <div class="rounded-[24px] border ${selected ? theme.borderSelected : theme.border} ${selected ? theme.bgSelected : theme.bg} px-4 py-4 shadow-sm ${selected ? `ring-2 ${theme.ring}` : ''}">
                <div class="flex flex-col items-center text-center">
                    <div class="text-[12px] font-black tracking-[0.18em] ${theme.label}">${escapeHtml(title)}</div>
                    <div data-fit-saved-name="split" class="mt-3 w-full overflow-hidden text-center text-[23px] font-black leading-[1.06] whitespace-nowrap text-[#5d5444]">
                        ${escapeHtml(item.fullName || item.givenName || '')}
                    </div>
                </div>
            </div>
        `;
    };

    const mainItem = canvasState.ownMain || canvasState.partnerMain;
    const renderCanvasHtml = canvasState.matched && mainItem
        ? `
            <div class="rounded-[28px] border border-[#eadfce] bg-gradient-to-br from-[#fff7ee] via-[#fffdf9] to-[#fff5f7] p-3 shadow-[0_18px_35px_-28px_rgba(123,104,83,0.55)]">
                <div class="rounded-[22px] border border-[#eadfce] bg-white px-4 py-5 text-center shadow-sm">
                    <div class="text-[12px] font-black tracking-[0.18em] text-[#b68a52]">ふたりの本命</div>
                    <div data-fit-saved-name="canvas" class="mt-3 w-full overflow-hidden text-center text-[28px] font-black leading-[1.04] whitespace-nowrap text-[#5d5444]">
                        ${escapeHtml(mainItem.fullName || mainItem.givenName || '')}
                    </div>
                </div>
            </div>
        `
        : `
            <div class="grid grid-cols-2 gap-2.5">
                ${renderCanvasSide(canvasState.ownMain, 'マイ本命', 'まだ本命を選んでいません', ownTheme)}
                ${renderCanvasSide(canvasState.partnerMain, 'パートナー本命', 'まだ本命を選んでいません', partnerTheme)}
            </div>
        `;

    canvasContainer.innerHTML = `
        <div class="rounded-[28px] border border-[#eee5d8] bg-gradient-to-br from-[#fffdf9] via-[#fffaf4] to-[#f8f1e7] p-4 shadow-[0_18px_35px_-28px_rgba(123,104,83,0.55)]">
            <div class="mb-3 text-[13px] font-black text-[#5d5444] text-center">本命の候補を選択してください</div>
            ${renderCanvasHtml}
        </div>
    `;

    const renderCard = (entry, source) => {
        const item = entry.item;
        const mySelected = source === 'own' ? entry.mySelected : entry.partnerSelected;
        const partnerSelected = source === 'own' ? entry.partnerSelected : entry.mySelected;
        const buttonText = source === 'own'
            ? (mySelected ? '本命中' : '本命にする')
            : (partnerSelected ? '本命中' : '本命にする');
        const buttonAction = source === 'own'
            ? `setSavedMainCandidate(${entry.index})`
            : `votePartnerSavedName(${entry.index})`;
        const buttonDisabled = source === 'own' ? mySelected : partnerSelected;
        const theme = source === 'own' ? ownTheme : partnerTheme;
        const detailSource = source === 'own' ? 'own' : 'partner';
        const borderClass = mySelected || partnerSelected ? theme.borderSelected : theme.border;
        const bgClass = mySelected || partnerSelected ? theme.bgSelected : theme.bg;
        const nameText = escapeHtml(item.fullName || item.givenName || '');
        const readingText = escapeHtml(item.reading || '');
        const messageText = item.message ? escapeHtml(item.message) : '';
        const statusBadge = source === 'own' && partnerSelected && !mySelected
            ? `<span class="inline-flex items-center rounded-full border border-[#eadfce] bg-[#fff8ef] px-2.5 py-1 text-[10px] font-bold text-[#b68a52]">本命中</span>`
            : '';

        return `
            <div onclick="showSavedNameDetail(${entry.index}, '${detailSource}')" class="group cursor-pointer rounded-[24px] border ${borderClass} ${bgClass} p-4 shadow-sm transition-all active:scale-[0.99]">
                <div class="flex items-start justify-between gap-3">
                    <div class="min-w-0 flex-1">
                        <div class="flex items-center gap-2">
                            ${statusBadge}
                        </div>
                        <div data-fit-saved-name="card" class="mt-1 w-full overflow-hidden whitespace-nowrap text-ellipsis text-[16px] font-black leading-tight text-[#5d5444]">${nameText}</div>
                        ${readingText ? `<div class="mt-1 text-[11px] text-[#a6967a]">${readingText}</div>` : ''}
                        ${messageText ? `<div class="mt-1 text-[11px] text-[#bca37f]">メモ ${messageText}</div>` : ''}
                    </div>
                    <div class="shrink-0">
                        <button onclick="event.stopPropagation(); ${buttonAction}" ${buttonDisabled ? 'disabled' : ''} class="min-w-[7rem] rounded-full px-3 py-1.5 text-[11px] font-black ${buttonDisabled ? 'bg-[#5d5444] text-white cursor-default' : `bg-gradient-to-r ${theme.button} text-white active:scale-95`}">
                            ${buttonText}
                        </button>
                    </div>
                </div>
            </div>
        `;
    };

    let html = '';
    if (visibleOwn.length > 0) {
        html += `
            <div class="space-y-3">
                <div class="flex items-center justify-between gap-3 px-1">
                    <div class="text-[10px] font-black tracking-[0.18em] text-[#bca37f]">自分の候補</div>
                    <div class="text-[11px] text-[#8b7e66]">${visibleOwn.length}件</div>
                </div>
                ${visibleOwn.map(entry => renderCard(entry, 'own')).join('')}
            </div>
        `;
    }

    if (visiblePartner.length > 0) {
        html += `
            <div class="space-y-3 pt-1">
                <div class="flex items-center justify-between gap-3 px-1">
                    <div class="text-[10px] font-black tracking-[0.18em] text-[#dd7d73]">${escapeHtml(partnerName)}の候補</div>
                    <div class="text-[11px] text-[#8b7e66]">${visiblePartner.length}件</div>
                </div>
                ${visiblePartner.map(entry => renderCard(entry, 'partner')).join('')}
            </div>
        `;
    }

    if (!html) {
        html = `
            <div class="text-center py-16 text-sm text-[#a6967a]">
                <p>まだ保存された候補はありません</p>
                <p class="text-[10px] mt-2">候補を保存するとここに並びます</p>
            </div>
        `;
    }

    listContainer.innerHTML = html;
    if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(applySavedTextFit);
    } else {
        setTimeout(applySavedTextFit, 0);
    }
}

window.likePartnerSavedName = likePartnerSavedName;
window.clearSavedPartnerFocus = clearSavedPartnerFocus;
window.getSavedNames = getSavedNames;
window.renderSavedScreen = renderSavedScreen;
window.setSavedMainCandidate = setSavedMainCandidate;
window.votePartnerSavedName = votePartnerSavedName;
window.deleteSavedName = deleteSavedNameBySourceIndex;
window.getSavedCandidateKey = getSavedCandidateKey;
window.getSavedCanvasState = getSavedCanvasState;

function getSavedCanvasState() {
    const pairInsights = typeof window.MeimayPartnerInsights !== 'undefined' ? window.MeimayPartnerInsights : null;
    const saved = getSavedNames();
    const partnerSaved = pairInsights?.getPartnerSaved ? pairInsights.getPartnerSaved() : [];
    const ownOverrideKey = typeof window !== 'undefined' && typeof window.__meimaySavedCanvasOwnKey === 'string' && window.__meimaySavedCanvasOwnKey
        ? window.__meimaySavedCanvasOwnKey
        : (typeof localStorage !== 'undefined' ? (localStorage.getItem('meimay_saved_canvas_own_key') || '') : '');

    const pickLatestMain = (items) => items
        .filter(item => item?.mainSelected)
        .slice()
        .sort((a, b) => {
            const aTime = new Date(a.mainSelectedAt || a.savedAt || a.timestamp || 0).getTime();
            const bTime = new Date(b.mainSelectedAt || b.savedAt || b.timestamp || 0).getTime();
            return bTime - aTime;
        })[0] || null;

    const ownMain = ownOverrideKey
        ? (saved.slice().reverse().find(item => getSavedCandidateKey(item) === ownOverrideKey)
            || partnerSaved.slice().reverse().find(item => getSavedCandidateKey(item) === ownOverrideKey)
            || null)
        : pickLatestMain(saved.filter(item => !item?.fromPartner && !item?.approvedFromPartner));
    const partnerMain = pickLatestMain(partnerSaved);
    const ownKey = getSavedCandidateKey(ownMain);
    const partnerKey = getSavedCandidateKey(partnerMain);

    return {
        ownMain,
        partnerMain,
        ownKey,
        partnerKey,
        matched: !!ownKey && !!partnerKey && ownKey === partnerKey,
        partnerName: pairInsights?.getPartnerDisplayName
            ? pairInsights.getPartnerDisplayName()
            : (typeof getPartnerRoleLabel === 'function'
                ? getPartnerRoleLabel(MeimayShare?.partnerSnapshot?.role)
                : 'パートナー')
    };
}

function setSavedMainCandidate(index) {
    const saved = getSavedNames();
    if (index < 0 || index >= saved.length) return false;

    const selectedItem = saved[index];
    const selectedKey = getSavedCandidateKey(selectedItem);
    if (!selectedKey) return false;

    const now = new Date().toISOString();
    const updated = saved.map((item) => {
        const itemKey = getSavedCandidateKey(item);
        const isSelected = itemKey === selectedKey;
        return {
            ...item,
            mainSelected: isSelected,
            mainSelectedAt: isSelected ? now : ''
        };
    });

    localStorage.setItem('meimay_saved', JSON.stringify(updated));
    if (typeof savedNames !== 'undefined') savedNames = updated;
    try {
        if (typeof window !== 'undefined') {
            window.__meimaySavedCanvasOwnKey = selectedKey;
        }
        localStorage.setItem('meimay_saved_canvas_own_key', selectedKey);
    } catch (error) {
        console.warn('SAVED: Persist own main key failed', error);
    }

    if (typeof MeimayPairing !== 'undefined' && MeimayPairing.roomCode) {
        MeimayPairing._autoSyncDebounced?.();
    }

    renderSavedScreen();
    if (typeof refreshPartnerAwareUI === 'function') refreshPartnerAwareUI();
    if (typeof showToast === 'function') showToast('本命にしました', '✓');
    return true;
}

function votePartnerSavedName(index) {
    const pairInsights = typeof window.MeimayPartnerInsights !== 'undefined' ? window.MeimayPartnerInsights : null;
    const partnerSaved = pairInsights?.getPartnerSaved ? pairInsights.getPartnerSaved() : [];
    if (index < 0 || index >= partnerSaved.length) return false;

    const source = partnerSaved[index];
    if (!source) return false;

    const sourceKey = getSavedCandidateKey(source);
    if (!sourceKey) return false;

    const partnerName = pairInsights?.getPartnerDisplayName
        ? pairInsights.getPartnerDisplayName()
        : (typeof getPartnerRoleLabel === 'function'
            ? getPartnerRoleLabel(MeimayShare?.partnerSnapshot?.role)
            : 'パートナー');

    try {
        if (typeof window !== 'undefined') {
            window.__meimaySavedCanvasOwnKey = sourceKey;
        }
        localStorage.setItem('meimay_saved_canvas_own_key', sourceKey);
    } catch (error) {
        console.warn('SAVED: Persist own main key from partner candidate failed', error);
    }

    renderSavedScreen();
    if (typeof refreshPartnerAwareUI === 'function') refreshPartnerAwareUI();
    if (typeof showToast === 'function') showToast(`${partnerName}の候補を本命にしました`, '✓');
    return true;
}

function renderSavedScreen() {
    const canvasContainer = document.getElementById('saved-naming-canvas');
    const listContainer = document.getElementById('saved-list-content');
    if (!canvasContainer || !listContainer) return;

    const saved = getSavedNames();
    const pairInsights = typeof window.MeimayPartnerInsights !== 'undefined' ? window.MeimayPartnerInsights : null;
    const partnerSaved = pairInsights?.getPartnerSaved ? pairInsights.getPartnerSaved() : [];
    const canvasState = getSavedCanvasState();
    const partnerName = canvasState.partnerName || (pairInsights?.getPartnerDisplayName
        ? pairInsights.getPartnerDisplayName()
        : (typeof getPartnerRoleLabel === 'function'
            ? getPartnerRoleLabel(MeimayShare?.partnerSnapshot?.role)
            : 'パートナー'));

    const escapeHtml = (value) => String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    const fitSavedText = (node, minSize, maxSize) => {
        if (!node) return;
        const parent = node.parentElement;
        if (!parent) return;
        node.style.whiteSpace = 'nowrap';
        node.style.display = 'block';
        node.style.width = '100%';
        node.style.overflow = 'hidden';
        node.style.textOverflow = 'clip';

        const availableWidth = parent.clientWidth || parent.getBoundingClientRect().width || 0;
        if (!availableWidth) return;

        let size = maxSize;
        node.style.fontSize = `${size}px`;
        while (size > minSize && node.scrollWidth > availableWidth) {
            size -= 1;
            node.style.fontSize = `${size}px`;
        }
    };

    const applySavedTextFit = () => {
        canvasContainer.querySelectorAll('[data-fit-saved-name="canvas"]').forEach(node => fitSavedText(node, 18, 30));
        canvasContainer.querySelectorAll('[data-fit-saved-name="split"]').forEach(node => fitSavedText(node, 16, 24));
        listContainer.querySelectorAll('[data-fit-saved-name="card"]').forEach(node => fitSavedText(node, 13, 18));
    };

    const ownTheme = {
        border: 'border-[#e7c7a0]',
        bg: 'bg-[#fff7ee]',
        bgStrong: 'bg-[#fff3e7]',
        text: 'text-[#5d5444]',
        label: 'text-[#be8558]',
        ring: 'ring-[#e7c7a0]'
    };
    const partnerTheme = {
        border: 'border-[#e7bcc6]',
        bg: 'bg-[#fff5f7]',
        bgStrong: 'bg-[#fff1f4]',
        text: 'text-[#5d5444]',
        label: 'text-[#d57f8f]',
        ring: 'ring-[#e7b0bb]'
    };

    const ownDecorated = saved.map((item, index) => ({
        item,
        index,
        key: getSavedCandidateKey(item),
        ownSelected: !!canvasState.ownKey && getSavedCandidateKey(item) === canvasState.ownKey,
        partnerSelected: !!canvasState.partnerKey && getSavedCandidateKey(item) === canvasState.partnerKey,
        visible: !item?.fromPartner && !item?.approvedFromPartner
    })).filter(entry => entry.visible).sort((a, b) => {
        if (a.ownSelected !== b.ownSelected) return a.ownSelected ? -1 : 1;
        if (a.partnerSelected !== b.partnerSelected) return a.partnerSelected ? -1 : 1;
        const aTime = new Date(a.item.mainSelectedAt || a.item.savedAt || a.item.timestamp || 0).getTime();
        const bTime = new Date(b.item.mainSelectedAt || b.item.savedAt || b.item.timestamp || 0).getTime();
        return bTime - aTime;
    });

    const partnerDecorated = partnerSaved.map((item, index) => ({
        item,
        index,
        key: getSavedCandidateKey(item),
        ownSelected: !!canvasState.ownKey && getSavedCandidateKey(item) === canvasState.ownKey,
        partnerSelected: !!canvasState.partnerKey && getSavedCandidateKey(item) === canvasState.partnerKey,
        visible: !item?.approvedFromPartner && !pairInsights?.isPartnerSavedApproved?.(item)
    })).filter(entry => entry.visible).sort((a, b) => {
        if (a.ownSelected !== b.ownSelected) return a.ownSelected ? -1 : 1;
        if (a.partnerSelected !== b.partnerSelected) return a.partnerSelected ? -1 : 1;
        const aTime = new Date(a.item.mainSelectedAt || a.item.savedAt || a.item.timestamp || 0).getTime();
        const bTime = new Date(b.item.mainSelectedAt || b.item.savedAt || b.item.timestamp || 0).getTime();
        return bTime - aTime;
    });

    const renderCanvasSide = (item, labelText, sourceType, emptyText, theme) => {
        if (!item) {
            return `
                <div class="rounded-[24px] border border-dashed ${theme.border} ${theme.bg} px-4 py-4 text-center">
                    <div class="mx-auto text-[10px] font-black tracking-[0.18em] ${theme.label} text-center">${escapeHtml(labelText)}</div>
                    <div class="mt-2 text-sm font-bold text-[#8b7e66]">${escapeHtml(emptyText)}</div>
                </div>
            `;
        }

        const key = getSavedCandidateKey(item);
        const ownSelected = !!canvasState.ownKey && key === canvasState.ownKey;
        const partnerSelected = !!canvasState.partnerKey && key === canvasState.partnerKey;
        const badgeHtml = (ownSelected || partnerSelected)
            ? `<span class="inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-bold ${ownSelected ? 'border-[#e4be8f] bg-[#fff3e7] text-[#b68a52]' : 'border-[#f0d2d9] bg-[#fff1f4] text-[#dd7d73]'}">本命中</span>`
            : '';

        return `
            <div class="rounded-[24px] border ${theme.border} ${theme.bg} px-4 py-3 shadow-sm ${ownSelected ? `ring-2 ${theme.ring}` : ''}">
                <div class="text-center">
                    <div class="mx-auto text-[10px] font-black tracking-[0.18em] ${theme.label} text-center">${escapeHtml(labelText)}</div>
                    ${badgeHtml ? `<div class="mt-2 flex justify-center">${badgeHtml}</div>` : ''}
                </div>
                <div class="mt-1 flex min-h-[56px] items-center justify-center">
                    <div data-fit-saved-name="split" class="w-full overflow-hidden text-center text-[24px] font-black leading-[1.02] whitespace-nowrap ${theme.text}">
                        ${escapeHtml(item.fullName || item.givenName || '')}
                    </div>
                </div>
            </div>
        `;
    };

    const mainItem = canvasState.ownMain || canvasState.partnerMain;
    const renderCanvasHtml = canvasState.matched && mainItem
        ? `
            <div class="rounded-[28px] border border-[#eadfce] bg-gradient-to-br from-[#fff7ee] via-[#fffdf9] to-[#fff5f7] p-3 shadow-[0_18px_35px_-28px_rgba(123,104,83,0.55)]">
                <div class="rounded-[22px] border border-[#eadfce] bg-white px-4 py-4 text-center shadow-sm">
                    <div class="mb-2 text-[10px] font-black tracking-[0.18em] text-[#bca37f] text-center">ふたりの本命</div>
                    <div data-fit-saved-name="canvas" class="w-full overflow-hidden text-center text-[30px] font-black leading-[1.04] whitespace-nowrap text-[#5d5444]">
                        ${escapeHtml(mainItem.fullName || mainItem.givenName || '')}
                    </div>
                </div>
            </div>
        `
        : `
            <div class="grid grid-cols-2 gap-2.5">
                ${renderCanvasSide(canvasState.ownMain, 'マイ本命', 'own', 'まだ本命を選んでいません', ownTheme)}
                ${renderCanvasSide(canvasState.partnerMain, 'パートナー本命', 'partner', 'まだ本命を選んでいません', partnerTheme)}
            </div>
        `;

    canvasContainer.innerHTML = `
        <div class="rounded-[28px] border border-[#eee5d8] bg-gradient-to-br from-[#fffdf9] via-[#fffaf4] to-[#f8f1e7] p-3 shadow-[0_18px_35px_-28px_rgba(123,104,83,0.55)]">
            <div class="mb-2 text-[13px] font-black text-[#5d5444]">本命の候補を選択してください</div>
            ${renderCanvasHtml}
        </div>
    `;

    const renderCard = (entry, sourceType) => {
        const item = entry.item;
        const theme = sourceType === 'own' ? ownTheme : partnerTheme;
        const mySelected = !!canvasState.ownKey && entry.key === canvasState.ownKey;
        const partnerSelected = !!canvasState.partnerKey && entry.key === canvasState.partnerKey;
        const buttonText = mySelected ? '本命中' : '本命にする';
        const buttonAction = sourceType === 'own'
            ? `setSavedMainCandidate(${entry.index})`
            : `votePartnerSavedName(${entry.index})`;
        const statusBadge = (mySelected || partnerSelected)
            ? `<span class="inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-bold ${mySelected ? 'border-[#e4be8f] bg-[#fff3e7] text-[#b68a52]' : 'border-[#f0d2d9] bg-[#fff1f4] text-[#dd7d73]'}">本命中</span>`
            : '';

        return `
            <div onclick="showSavedNameDetail(${entry.index}, '${sourceType}')" class="group cursor-pointer rounded-[24px] border ${mySelected ? `ring-2 ${theme.ring}` : theme.border} ${mySelected ? theme.bgStrong : theme.bg} p-3.5 shadow-sm transition-all active:scale-[0.99]">
                <div class="flex items-start gap-3">
                    <div class="min-w-0 flex-1">
                        <div class="flex items-start justify-between gap-2">
                            <div class="min-w-0 flex-1">
                                <div data-fit-saved-name="card" class="w-full overflow-hidden whitespace-nowrap text-ellipsis text-[17px] font-black leading-tight ${theme.text}">${escapeHtml(item.fullName || item.givenName || '')}</div>
                                ${item.reading ? `<div class="mt-1 text-[10px] text-[#a6967a]">${escapeHtml(item.reading)}</div>` : ''}
                                ${item.message ? `<div class="mt-1 text-[10px] text-[#bca37f]">${escapeHtml(item.message)}</div>` : ''}
                            </div>
                            <div class="shrink-0 pt-0.5">${statusBadge}</div>
                        </div>
                    </div>
                    <div class="shrink-0 pt-0.5">
                        <button onclick="event.stopPropagation(); ${buttonAction}" ${mySelected ? 'disabled' : ''} class="min-w-[5.8rem] rounded-full px-3 py-1.5 text-[10px] font-black ${mySelected ? 'bg-[#5d5444] text-white cursor-default' : 'bg-gradient-to-r from-[#f7c47c] to-[#e7a665] text-white active:scale-95'}">
                            ${buttonText}
                        </button>
                    </div>
                </div>
            </div>
        `;
    };

    let html = '';
    if (ownDecorated.length > 0) {
        html += `
            <div class="space-y-3">
                <div class="flex items-center justify-between gap-3 px-1">
                    <div class="text-[10px] font-black tracking-[0.18em] text-[#bca37f]">自分の候補</div>
                    <div class="text-[11px] text-[#8b7e66]">${ownDecorated.length}件</div>
                </div>
                ${ownDecorated.map(entry => renderCard(entry, 'own')).join('')}
            </div>
        `;
    }

    if (partnerDecorated.length > 0) {
        html += `
            <div class="space-y-3 pt-1">
                <div class="flex items-center justify-between gap-3 px-1">
                    <div class="text-[10px] font-black tracking-[0.18em] text-[#dd7d73]">パートナーの候補</div>
                    <div class="text-[11px] text-[#8b7e66]">${partnerDecorated.length}件</div>
                </div>
                ${partnerDecorated.map(entry => renderCard(entry, 'partner')).join('')}
            </div>
        `;
    }

    if (!ownDecorated.length && !partnerDecorated.length) {
        html = `
            <div class="text-center py-16 text-sm text-[#a6967a]">
                <p>まだ保存候補はありません</p>
                <p class="text-[10px] mt-2">候補を保存するとここに並びます</p>
            </div>
        `;
    }

    listContainer.innerHTML = html;
    if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(applySavedTextFit);
    } else {
        setTimeout(applySavedTextFit, 0);
    }
}

window.getSavedCanvasState = getSavedCanvasState;
window.setSavedMainCandidate = setSavedMainCandidate;
window.votePartnerSavedName = votePartnerSavedName;
window.renderSavedScreen = renderSavedScreen;

function renderSavedScreen() {
    const canvasContainer = document.getElementById('saved-naming-canvas');
    const listContainer = document.getElementById('saved-list-content');
    if (!canvasContainer || !listContainer) return;

    const saved = getSavedNames();
    const pairInsights = typeof window.MeimayPartnerInsights !== 'undefined' ? window.MeimayPartnerInsights : null;
    const partnerSaved = pairInsights?.getPartnerSaved ? pairInsights.getPartnerSaved() : [];
    const canvasState = getSavedCanvasState();
    const partnerName = canvasState.partnerName || (pairInsights?.getPartnerDisplayName
        ? pairInsights.getPartnerDisplayName()
        : (typeof getPartnerRoleLabel === 'function'
            ? getPartnerRoleLabel(MeimayShare?.partnerSnapshot?.role)
            : 'パートナー'));

    const escapeHtml = (value) => String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    const fitSavedText = (node, minSize, maxSize) => {
        if (!node) return;
        const parent = node.parentElement;
        if (!parent) return;
        node.style.whiteSpace = 'nowrap';
        node.style.display = 'block';
        node.style.width = '100%';
        node.style.overflow = 'hidden';
        node.style.textOverflow = 'clip';
        const availableWidth = parent.clientWidth || parent.getBoundingClientRect().width || 0;
        if (!availableWidth) return;
        let size = maxSize;
        node.style.fontSize = `${size}px`;
        while (size > minSize && node.scrollWidth > availableWidth) {
            size -= 1;
            node.style.fontSize = `${size}px`;
        }
    };

    const applySavedTextFit = () => {
        canvasContainer.querySelectorAll('[data-fit-saved-name="canvas"]').forEach(node => fitSavedText(node, 18, 30));
        canvasContainer.querySelectorAll('[data-fit-saved-name="split"]').forEach(node => fitSavedText(node, 16, 24));
        listContainer.querySelectorAll('[data-fit-saved-name="card"]').forEach(node => fitSavedText(node, 13, 18));
    };

    const ownTheme = {
        border: 'border-[#e7c7a0]',
        bg: 'bg-[#fff7ee]',
        bgStrong: 'bg-[#fff3e7]',
        text: 'text-[#5d5444]',
        label: 'text-[#be8558]',
        ring: 'ring-[#e7c7a0]'
    };
    const partnerTheme = {
        border: 'border-[#e7bcc6]',
        bg: 'bg-[#fff5f7]',
        bgStrong: 'bg-[#fff1f4]',
        text: 'text-[#5d5444]',
        label: 'text-[#d57f8f]',
        ring: 'ring-[#e7b0bb]'
    };

    const ownVisibleItems = saved.filter(item => !item?.fromPartner && !item?.approvedFromPartner);
    const partnerVisibleItems = partnerSaved.filter(item => !item?.approvedFromPartner && !pairInsights?.isPartnerSavedApproved?.(item));

    const ownDecorated = ownVisibleItems.map((item, index) => {
        const key = getSavedCandidateKey(item);
        const mySelected = !!canvasState.ownKey && key === canvasState.ownKey;
        return { item, index, key, mySelected };
    }).sort((a, b) => {
        if (a.mySelected !== b.mySelected) return a.mySelected ? -1 : 1;
        const aTime = new Date(a.item.mainSelectedAt || a.item.savedAt || a.item.timestamp || 0).getTime();
        const bTime = new Date(b.item.mainSelectedAt || b.item.savedAt || b.item.timestamp || 0).getTime();
        return bTime - aTime;
    });

    const partnerDecorated = partnerVisibleItems.map((item, index) => {
        const key = getSavedCandidateKey(item);
        const mySelected = !!canvasState.ownKey && key === canvasState.ownKey;
        return { item, index, key, mySelected };
    }).sort((a, b) => {
        if (a.mySelected !== b.mySelected) return a.mySelected ? -1 : 1;
        const aTime = new Date(a.item.mainSelectedAt || a.item.savedAt || a.item.timestamp || 0).getTime();
        const bTime = new Date(b.item.mainSelectedAt || b.item.savedAt || b.item.timestamp || 0).getTime();
        return bTime - aTime;
    });

    const renderCanvasSide = (item, labelText, sourceType, emptyText, theme) => {
        if (!item) {
            return `
                <div class="rounded-[22px] border border-dashed ${theme.border} ${theme.bg} px-4 py-4 text-center">
                    <div class="text-[10px] font-black tracking-[0.18em] ${theme.label} text-center">${escapeHtml(labelText)}</div>
                    <div class="mt-2 text-[13px] font-bold text-[#8b7e66]">${escapeHtml(emptyText)}</div>
                </div>
            `;
        }

        const key = getSavedCandidateKey(item);
        const selected = sourceType === 'own'
            ? !!canvasState.ownKey && key === canvasState.ownKey
            : !!canvasState.partnerKey && key === canvasState.partnerKey;

        return `
            <div class="rounded-[22px] border ${theme.border} ${theme.bg} px-4 py-3 shadow-sm ${selected ? `ring-2 ${theme.ring}` : ''}">
                <div class="text-[10px] font-black tracking-[0.18em] ${theme.label} text-center">${escapeHtml(labelText)}</div>
                <div class="mt-1 flex min-h-[56px] items-center justify-center">
                    <div data-fit-saved-name="split" class="w-full overflow-hidden text-center text-[24px] font-black leading-[1.02] whitespace-nowrap ${theme.text}">
                        ${escapeHtml(item.fullName || item.givenName || '')}
                    </div>
                </div>
            </div>
        `;
    };

    const mainItem = canvasState.ownMain || canvasState.partnerMain;
    const renderCanvasHtml = canvasState.matched && mainItem
        ? `
            <div class="rounded-[28px] border border-[#eadfce] bg-gradient-to-br from-[#fff7ee] via-[#fffdf9] to-[#fff5f7] p-3 shadow-[0_18px_35px_-28px_rgba(123,104,83,0.55)]">
                <div class="rounded-[22px] border border-[#eadfce] bg-white px-4 py-4 text-center shadow-sm">
                    <div data-fit-saved-name="canvas" class="w-full overflow-hidden text-center text-[30px] font-black leading-[1.04] whitespace-nowrap text-[#5d5444]">
                        ${escapeHtml(mainItem.fullName || mainItem.givenName || '')}
                    </div>
                </div>
            </div>
        `
        : `
            <div class="grid grid-cols-2 gap-2.5">
                ${renderCanvasSide(canvasState.ownMain, 'マイ本命', 'own', 'まだ本命を選んでいません', ownTheme)}
                ${renderCanvasSide(canvasState.partnerMain, 'パートナー本命', 'partner', 'まだ本命を選んでいません', partnerTheme)}
            </div>
        `;

    canvasContainer.innerHTML = `
        <div class="rounded-[28px] border border-[#eee5d8] bg-gradient-to-br from-[#fffdf9] via-[#fffaf4] to-[#f8f1e7] p-3 shadow-[0_18px_35px_-28px_rgba(123,104,83,0.55)]">
            <div class="mb-2 text-[13px] font-black text-[#5d5444]">本命の候補を選択してください</div>
            ${renderCanvasHtml}
        </div>
    `;

    const renderCard = (entry, sourceType) => {
        const item = entry.item;
        const isOwn = sourceType === 'own';
        const theme = isOwn ? ownTheme : partnerTheme;
        const mySelected = !!canvasState.ownKey && entry.key === canvasState.ownKey;
        const buttonText = mySelected ? '本命中' : '本命にする';
        const buttonAction = isOwn
            ? `setSavedMainCandidate(${entry.index})`
            : `votePartnerSavedName(${entry.index})`;
        const cardClass = mySelected ? `ring-2 ${theme.border} ${theme.bgStrong} ${theme.ring}` : `${theme.border} ${theme.bg}`;

        return `
            <div onclick="showSavedNameDetail(${entry.index}, '${sourceType}')" class="group cursor-pointer rounded-[24px] border ${cardClass} p-3.5 shadow-sm transition-all active:scale-[0.99]">
                <div class="flex items-start gap-3">
                    <div class="min-w-0 flex-1">
                        <div data-fit-saved-name="card" class="w-full overflow-hidden whitespace-nowrap text-[16px] font-black leading-tight ${theme.text}">
                            ${escapeHtml(item.fullName || item.givenName || '')}
                        </div>
                        ${item.reading ? `<div class="mt-1 text-[10px] text-[#a6967a]">${escapeHtml(item.reading)}</div>` : ''}
                        ${item.message ? `<div class="mt-1 text-[10px] text-[#bca37f]">${escapeHtml(item.message)}</div>` : ''}
                    </div>
                    <div class="shrink-0 pt-0.5">
                        <button onclick="event.stopPropagation(); ${buttonAction}" ${mySelected ? 'disabled' : ''} class="min-w-[5.8rem] rounded-full px-3 py-1.5 text-[10px] font-black ${mySelected ? 'bg-[#5d5444] text-white cursor-default' : 'bg-gradient-to-r from-[#f7c47c] to-[#e7a665] text-white active:scale-95'}">
                            ${buttonText}
                        </button>
                    </div>
                </div>
            </div>
        `;
    };

    let html = '';
    if (ownDecorated.length > 0) {
        html += `
            <div class="space-y-3">
                <div class="flex items-center justify-between gap-3 px-1">
                    <div class="text-[10px] font-black tracking-[0.18em] text-[#bca37f]">自分の候補</div>
                    <div class="text-[11px] text-[#8b7e66]">${ownDecorated.length}件</div>
                </div>
                ${ownDecorated.map(entry => renderCard(entry, 'own')).join('')}
            </div>
        `;
    }

    if (partnerDecorated.length > 0) {
        html += `
            <div class="space-y-3 pt-1">
                <div class="flex items-center justify-between gap-3 px-1">
                    <div class="text-[10px] font-black tracking-[0.18em] text-[#dd7d73]">パートナーの候補</div>
                    <div class="text-[11px] text-[#8b7e66]">${partnerDecorated.length}件</div>
                </div>
                ${partnerDecorated.map(entry => renderCard(entry, 'partner')).join('')}
            </div>
        `;
    }

    if (!ownDecorated.length && !partnerDecorated.length) {
        html = `
            <div class="text-center py-16 text-sm text-[#a6967a]">
                <p>まだ保存候補はありません</p>
                <p class="text-[10px] mt-2">候補を保存するとここに並びます</p>
            </div>
        `;
    }

    listContainer.innerHTML = html;
    if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(applySavedTextFit);
    } else {
        setTimeout(applySavedTextFit, 0);
    }
}

window.renderSavedScreen = renderSavedScreen;

if (typeof window !== 'undefined' && !Object.getOwnPropertyDescriptor(window, 'savedFocus')) {
    Object.defineProperty(window, 'savedFocus', {
        configurable: true,
        get() {
            const partnerViewState = typeof window.getMeimayPartnerViewState === 'function'
                ? window.getMeimayPartnerViewState()
                : { savedFocus: 'all' };
            return partnerViewState?.savedFocus || 'all';
        }
    });
}

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

function likePartnerSavedName(index) {
    return votePartnerSavedName(index);
}

function renderSavedScreen() {
    const canvasContainer = document.getElementById('saved-naming-canvas');
    const listContainer = document.getElementById('saved-list-content');
    if (!canvasContainer || !listContainer) return;

    const saved = getSavedNames();
    const pairInsights = typeof window.MeimayPartnerInsights !== 'undefined' ? window.MeimayPartnerInsights : null;
    const partnerViewState = typeof window.getMeimayPartnerViewState === 'function'
        ? window.getMeimayPartnerViewState()
        : { savedFocus: 'all' };
    const savedFocus = partnerViewState.savedFocus || 'all';
    const partnerSaved = pairInsights?.getPartnerSaved ? pairInsights.getPartnerSaved() : [];
    const canvasState = getSavedCanvasState();
    const partnerName = canvasState.partnerName || (pairInsights?.getPartnerDisplayName
        ? pairInsights.getPartnerDisplayName()
        : (typeof getPartnerRoleLabel === 'function'
            ? getPartnerRoleLabel(MeimayShare?.partnerSnapshot?.role)
            : 'パートナー'));

    const ownDecorated = ownVisibleItems.map((item, index) => {
        const key = getSavedCandidateKey(item);
        const ownSelected = !!canvasState.ownKey && key === canvasState.ownKey;
        const partnerSelected = !!canvasState.partnerKey && key === canvasState.partnerKey;
        const creatorMeta = getSavedCandidateCreatorMeta(item, 'own', partnerName);
        const approvalMatched = pairInsights?.isSavedItemMatched ? pairInsights.isSavedItemMatched(item) : false;
        let statusLabel = '';
        if (canvasState.matched && ownSelected && partnerSelected) statusLabel = '一致';
        else if (ownSelected) statusLabel = '本命中';
        else if (partnerSelected) statusLabel = '相手の本命';
        else if (approvalMatched) statusLabel = '両方保存';
        return {
            item,
            index,
            key,
            ownSelected,
            partnerSelected,
            approvalMatched,
            creatorMeta,
            statusLabel
        };
    }).sort((a, b) => {
        if (a.ownSelected !== b.ownSelected) return a.ownSelected ? -1 : 1;
        if (a.partnerSelected !== b.partnerSelected) return a.partnerSelected ? -1 : 1;
        if (a.approvalMatched !== b.approvalMatched) return a.approvalMatched ? -1 : 1;
        const aTime = new Date(a.item.savedAt || a.item.timestamp || 0).getTime();
        const bTime = new Date(b.item.savedAt || b.item.timestamp || 0).getTime();
        return bTime - aTime;
    });

    const partnerDecorated = partnerSaved
        .filter(item => !item?.approvedFromPartner && !pairInsights?.isPartnerSavedApproved?.(item))
        .map((item, index) => {
            const key = getSavedCandidateKey(item);
            const ownSelected = !!canvasState.ownKey && key === canvasState.ownKey;
            const partnerSelected = !!item?.mainSelected || (!!canvasState.partnerKey && key === canvasState.partnerKey);
            const creatorMeta = getSavedCandidateCreatorMeta(item, 'partner', partnerName);
            const approvalMatched = pairInsights?.isSavedItemMatched ? pairInsights.isSavedItemMatched(item) : false;
            let statusLabel = '';
            if (canvasState.matched && ownSelected && partnerSelected) statusLabel = '一致';
            else if (partnerSelected) statusLabel = 'パートナーの本命';
            else if (ownSelected) statusLabel = 'あなたの本命';
            else if (approvalMatched) statusLabel = '両方保存';
            return {
                item,
                index,
                key,
                ownSelected,
                partnerSelected,
                approvalMatched,
                creatorMeta,
                statusLabel
            };
        }).sort((a, b) => {
            if (a.partnerSelected !== b.partnerSelected) return a.partnerSelected ? -1 : 1;
            if (a.ownSelected !== b.ownSelected) return a.ownSelected ? -1 : 1;
            if (a.approvalMatched !== b.approvalMatched) return a.approvalMatched ? -1 : 1;
            const aTime = new Date(a.item.savedAt || a.item.timestamp || 0).getTime();
            const bTime = new Date(b.item.savedAt || b.item.timestamp || 0).getTime();
            return bTime - aTime;
        });

    let visibleOwn = ownDecorated;
    let visiblePartner = partnerDecorated;
    if (savedFocus === 'partner') {
        visibleOwn = [];
    } else if (savedFocus === 'matched') {
        visibleOwn = ownDecorated.filter(entry => entry.approvalMatched);
        visiblePartner = [];
    }

    const renderCanvasSide = (item, sourceTitle, sourceType, emptyText) => {
        if (!item) {
            return `
                <div class="rounded-[22px] border border-dashed border-[#eadfce] bg-white/70 px-4 py-4 text-center">
                    <div class="text-[10px] font-black tracking-[0.18em] text-[#bca37f] uppercase">${sourceTitle}</div>
                    <div class="mt-2 text-sm font-bold text-[#8b7e66]">${emptyText}</div>
                </div>
            `;
        }

        const key = getSavedCandidateKey(item);
        const creatorMeta = getSavedCandidateCreatorMeta(item, sourceType, partnerName);
        const ownSelected = !!canvasState.ownKey && key === canvasState.ownKey;
        const partnerSelected = !!canvasState.partnerKey && key === canvasState.partnerKey;
        const statusLabel = canvasState.matched && ownSelected && partnerSelected
            ? '一致'
            : (sourceType === 'own'
                ? (ownSelected ? '本命中' : (partnerSelected ? '相手の本命' : ''))
                : (partnerSelected ? 'パートナーの本命' : (ownSelected ? 'あなたの本命' : '')));

        return `
            <div class="rounded-[22px] border border-[#eadfce] bg-white px-4 py-4 shadow-sm">
                <div class="flex items-center justify-between gap-3">
                    <div>
                        <div class="text-[10px] font-black tracking-[0.18em] text-[#bca37f] uppercase">${sourceTitle}</div>
                        <div class="mt-2 inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-bold ${creatorMeta.toneClass}">${creatorMeta.label}</div>
                    </div>
                    ${statusLabel ? `<div class="rounded-full border border-[#eadfce] bg-[#fff8ef] px-2.5 py-1 text-[10px] font-bold text-[#b68a52]">${statusLabel}</div>` : ''}
                </div>
                <div class="mt-3 text-2xl font-black text-[#5d5444] leading-tight">${item.fullName || item.givenName || ''}</div>
                <div class="mt-1 text-xs text-[#a6967a]">${item.reading || ''}</div>
                <div class="mt-3 flex flex-wrap gap-2">
                    ${item.mainSelected && sourceType === 'partner' ? `<span class="inline-flex items-center rounded-full bg-[#fde8e5] px-2.5 py-1 text-[10px] font-bold text-[#dd7d73]">パートナーの本命</span>` : ''}
                    ${item.mainSelected && sourceType === 'own' ? `<span class="inline-flex items-center rounded-full bg-[#fef5df] px-2.5 py-1 text-[10px] font-bold text-[#b8860b]">本命中</span>` : ''}
                </div>
            </div>
        `;
    };

    const renderCanvasHtml = canvasState.matched && (canvasState.ownMain || canvasState.partnerMain)
        ? `
            <div class="rounded-[28px] border border-[#eadfce] bg-gradient-to-br from-[#fffaf4] via-[#fffdf9] to-[#f7f1e8] p-4 shadow-[0_18px_35px_-28px_rgba(123,104,83,0.55)]">
                <div class="flex items-center justify-between gap-3 mb-3">
                    <div>
                        <div class="text-[10px] font-black tracking-[0.22em] text-[#bca37f] uppercase">Naming Canvas</div>
                        <div class="mt-1 text-sm font-black text-[#5d5444]">ふたりの本命が一致しました</div>
                    </div>
                    <div class="rounded-full border border-[#eadfce] bg-white px-3 py-1 text-[10px] font-bold text-[#8b7e66]">統合済み</div>
                </div>
                <div class="rounded-[24px] border border-[#eadfce] bg-white px-4 py-5 text-center shadow-sm">
                    <div class="inline-flex items-center rounded-full border ${getSavedCandidateCreatorMeta(canvasState.ownMain || canvasState.partnerMain, 'own', partnerName).toneClass} px-3 py-1 text-[10px] font-bold">${partnerName}と一致</div>
                    <div class="mt-3 text-3xl font-black text-[#5d5444] leading-tight">${(canvasState.ownMain || canvasState.partnerMain)?.fullName || ''}</div>
                    <div class="mt-1 text-xs text-[#a6967a]">${(canvasState.ownMain || canvasState.partnerMain)?.reading || ''}</div>
                    <div class="mt-3 flex flex-wrap justify-center gap-2">
                        <span class="inline-flex items-center rounded-full border border-[#eadfce] bg-[#fff8ef] px-2.5 py-1 text-[10px] font-bold text-[#b68a52]">自分の本命</span>
                        <span class="inline-flex items-center rounded-full border border-[#eadfce] bg-[#fff8ef] px-2.5 py-1 text-[10px] font-bold text-[#b68a52]">${partnerName}の本命</span>
                    </div>
                </div>
            </div>
        `
        : `
            <div class="grid grid-cols-2 gap-3">
                ${renderCanvasSide(canvasState.ownMain, '自分', 'own', 'まだ本命を選んでいません')}
                ${renderCanvasSide(canvasState.partnerMain, partnerName, 'partner', 'まだ選ばれていません')}
            </div>
        `;

    canvasContainer.innerHTML = `
        <div class="rounded-[28px] border border-[#eee5d8] bg-gradient-to-br from-[#fffdf9] via-[#fffaf4] to-[#f8f1e7] p-4 shadow-[0_18px_35px_-28px_rgba(123,104,83,0.55)]">
            <div class="flex items-start justify-between gap-3 mb-3">
                <div>
                    <div class="text-[10px] font-black tracking-[0.22em] text-[#bca37f] uppercase">Naming Canvas</div>
                    <div class="mt-1 text-sm font-black text-[#5d5444]">本命を1票ずつ選ぶ</div>
                </div>
                <div class="rounded-full border border-[#eadfce] bg-white px-3 py-1 text-[10px] font-bold text-[#8b7e66]">1人1票 / 変更OK</div>
            </div>
            ${renderCanvasHtml}
        </div>
    `;

    const focusBanner = savedFocus !== 'all'
        ? `
            <div class="rounded-2xl border border-[#eee5d8] bg-[#fffaf5] px-4 py-3 mb-3">
                <div class="flex items-center justify-between gap-3">
                    <div>
                        <div class="text-[10px] font-black tracking-[0.18em] text-[#bca37f] uppercase">FILTER</div>
                        <div class="mt-1 text-sm font-bold text-[#4f4639]">${savedFocus === 'partner' ? `${partnerName}の候補` : '一致候補'}</div>
                        <div class="mt-1 text-[11px] text-[#8b7e66]">${savedFocus === 'partner' ? 'パートナー候補だけを表示しています。' : '一致している候補だけを表示しています。'}</div>
                    </div>
                    <button onclick="clearSavedPartnerFocus()" class="shrink-0 rounded-full border border-[#eadfce] bg-white px-3 py-1.5 text-[11px] font-bold text-[#8b7e66] active:scale-95">
                        全体に戻す
                    </button>
                </div>
            </div>
        `
        : '';

    const renderCard = (entry, source) => {
        const item = entry.item;
        const itemKey = entry.key;
        const selected = source === 'own' ? entry.ownSelected : entry.partnerSelected;
        const buttonText = selected ? '本命中' : '本命にする';
        const buttonAction = source === 'own'
            ? `setSavedMainCandidate(${entry.index})`
            : `votePartnerSavedName(${entry.index})`;
        const buttonClass = selected
            ? 'bg-[#5d5444] text-white cursor-default'
            : 'bg-gradient-to-r from-[#f8c27a] to-[#e8a96b] text-white active:scale-95';
        const detailSource = source === 'own' ? 'own' : 'partner';
        const detailIndex = source === 'own'
            ? entry.index
            : partnerSaved.findIndex(candidate => getSavedCandidateKey(candidate) === itemKey);

        return `
            <div onclick="showSavedNameDetail(${detailIndex}, '${detailSource}')" class="group cursor-pointer rounded-[24px] border ${entry.ownSelected ? 'border-[#bca37f] bg-[#fffaf6] shadow-[0_10px_30px_-18px_rgba(188,163,127,0.55)]' : 'border-[#eee5d8] bg-white shadow-sm'} p-4 transition-all active:scale-[0.99]">
                <div class="flex items-start justify-between gap-3 mb-2">
                    <div class="flex-1 min-w-0">
                        <div class="flex flex-wrap items-center gap-2 mb-2">
                            <span class="inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-bold ${entry.creatorMeta.toneClass}">${entry.creatorMeta.label}</span>
                            ${entry.statusLabel ? `<span class="inline-flex items-center rounded-full border border-[#eadfce] bg-[#fff8ef] px-2.5 py-1 text-[10px] font-bold text-[#b68a52]">${entry.statusLabel}</span>` : ''}
                        </div>
                        <div class="text-xl font-black text-[#5d5444]">${item.fullName || item.givenName || ''}</div>
                        <div class="text-xs text-[#a6967a]">${item.reading || ''}</div>
                        ${item.message ? `<div class="mt-1 text-xs text-[#bca37f]">メモ ${item.message}</div>` : ''}
                        ${source === 'own' && item.approvedFromPartner ? `<div class="mt-1 text-[10px] text-[#dd7d73]">${item.partnerName || partnerName}発案</div>` : ''}
                    </div>
                    <div class="shrink-0 text-right">
                        ${item.fortune ? `<div class="text-sm font-bold text-[#bca37f]">${typeof item.fortune.so === 'object' ? (item.fortune.so.val || '') : item.fortune.so}画</div>` : ''}
                    </div>
                </div>
                <button onclick="event.stopPropagation(); ${buttonAction}" ${entry.ownSelected ? 'disabled' : ''} class="w-full py-3 rounded-xl text-sm font-black ${buttonClass}">
                    ${buttonText}
                </button>
            </div>
        `;
    };

    let html = focusBanner;
    if (visibleOwn.length > 0) {
        html += `
            <div class="space-y-3">
                <div class="flex items-center justify-between gap-3 px-1">
                    <div class="text-[10px] font-black tracking-[0.18em] text-[#bca37f] uppercase">自分の候補</div>
                    <div class="text-[11px] text-[#8b7e66]">${visibleOwn.length}件</div>
                </div>
                ${visibleOwn.map(entry => renderCard(entry, 'own')).join('')}
            </div>
        `;
    }

    if (visiblePartner.length > 0) {
        html += `
            <div class="space-y-3 pt-1">
                <div class="flex items-center justify-between gap-3 px-1">
                    <div class="text-[10px] font-black tracking-[0.18em] text-[#dd7d73] uppercase">${partnerName}の候補</div>
                    <div class="text-[11px] text-[#8b7e66]">${visiblePartner.length}件</div>
                </div>
                ${visiblePartner.map(entry => renderCard(entry, 'partner')).join('')}
            </div>
        `;
    }

    if (!html) {
        html = `
            <div class="text-center py-16 text-sm text-[#a6967a]">
                <div class="text-4xl mb-4 opacity-50">沈</div>
                <p>保存済みはまだありません</p>
                <p class="text-[10px] mt-2">候補を保存すると、ここで本命を1票ずつ選べます。</p>
            </div>
        `;
    }

    listContainer.innerHTML = html;
}

window.likePartnerSavedName = likePartnerSavedName;
window.clearSavedPartnerFocus = clearSavedPartnerFocus;
window.getSavedNames = getSavedNames;
window.renderSavedScreen = renderSavedScreen;
window.setSavedMainCandidate = setSavedMainCandidate;
window.deleteSavedName = deleteSavedNameBySourceIndex;
*/

function getSavedCandidateKey(item) {
    if (!item) return '';
    const pairInsights = typeof window.MeimayPartnerInsights !== 'undefined' ? window.MeimayPartnerInsights : null;
    if (pairInsights?.buildSavedMatchKey) return pairInsights.buildSavedMatchKey(item);

    const combinationKey = Array.isArray(item.combination) && item.combination.length > 0
        ? item.combination.map(part => part?.['漢字'] || part?.kanji || '').join('')
        : (Array.isArray(item.combinationKeys) ? item.combinationKeys.join('') : '');
    const fullName = item.fullName || item.givenName || combinationKey;
    const reading = String(item.reading || item.givenName || '').trim();
    return `${fullName}::${combinationKey}::${reading}`;
}

function getSavedCandidateCreatorMeta(item, source = 'own', partnerName = '') {
    const partnerLabel = partnerName || 'パートナー';
    const fromPartner = source === 'own'
        ? !!item?.fromPartner || !!item?.approvedFromPartner
        : !(item?.fromPartner || item?.approvedFromPartner);

    return {
        fromPartner,
        label: fromPartner ? `${partnerLabel}発案` : '自分発案',
        toneClass: fromPartner
            ? 'bg-[#fde8e5] text-[#dd7d73] border-[#f4d3cf]'
            : 'bg-[#eef5ff] text-[#4f7cb8] border-[#d8e4ff]'
    };
}

function getSavedCanvasState() {
    const blankCanvas = typeof window !== 'undefined' && (
        window.__meimaySavedCanvasBlank === true ||
        (typeof localStorage !== 'undefined' && localStorage.getItem('meimay_saved_canvas_blank') === '1')
    );
    if (blankCanvas) {
        const pairInsights = typeof window.MeimayPartnerInsights !== 'undefined' ? window.MeimayPartnerInsights : null;
        return {
            ownMain: null,
            partnerMain: null,
            ownKey: '',
            partnerKey: '',
            matched: false,
            partnerName: pairInsights?.getPartnerDisplayName
                ? pairInsights.getPartnerDisplayName()
                : (typeof getPartnerRoleLabel === 'function'
                    ? getPartnerRoleLabel(MeimayShare?.partnerSnapshot?.role)
                    : 'パートナー')
        };
    }
    const pairInsights = typeof window.MeimayPartnerInsights !== 'undefined' ? window.MeimayPartnerInsights : null;
    const saved = getSavedNames();
    const partnerSaved = pairInsights?.getPartnerSaved ? pairInsights.getPartnerSaved() : [];
    const overrideKey = typeof window !== 'undefined' && typeof window.__meimaySavedCanvasOwnKey === 'string' && window.__meimaySavedCanvasOwnKey
        ? window.__meimaySavedCanvasOwnKey
        : (typeof localStorage !== 'undefined' ? (localStorage.getItem('meimay_saved_canvas_own_key') || '') : '');
    const pickLatestMain = (items) => items
        .filter(item => item?.mainSelected)
        .slice()
        .sort((a, b) => {
            const aTime = new Date(a.mainSelectedAt || a.savedAt || a.timestamp || 0).getTime();
            const bTime = new Date(b.mainSelectedAt || b.savedAt || b.timestamp || 0).getTime();
            return bTime - aTime;
        })[0] || null;

    const ownMain = overrideKey
        ? (saved.slice().reverse().find(item => getSavedCandidateKey(item) === overrideKey)
            || partnerSaved.slice().reverse().find(item => getSavedCandidateKey(item) === overrideKey)
            || null)
        : pickLatestMain(saved.filter(item => item && !item.fromPartner && !item.approvedFromPartner));
    const partnerMain = pickLatestMain(partnerSaved);
    const ownKey = getSavedCandidateKey(ownMain);
    const partnerKey = getSavedCandidateKey(partnerMain);

    return {
        ownMain,
        partnerMain,
        ownKey,
        partnerKey,
        matched: !!ownKey && !!partnerKey && ownKey === partnerKey,
        partnerName: pairInsights?.getPartnerDisplayName
            ? pairInsights.getPartnerDisplayName()
            : (typeof getPartnerRoleLabel === 'function'
                ? getPartnerRoleLabel(MeimayShare?.partnerSnapshot?.role)
                : 'パートナー')
    };
}

function setSavedMainCandidate(index) {
    const saved = getSavedNames();
    if (index < 0 || index >= saved.length) return false;

    const selectedItem = saved[index];
    const selectedKey = getSavedCandidateKey(selectedItem);
    if (!selectedKey) return false;

    const now = new Date().toISOString();
    const updated = saved.map((item) => {
        const isSelected = getSavedCandidateKey(item) === selectedKey;
        return {
            ...item,
            mainSelected: isSelected,
            mainSelectedAt: isSelected ? now : ''
        };
    });

    localStorage.setItem('meimay_saved', JSON.stringify(updated));
    if (typeof savedNames !== 'undefined') savedNames = updated;
    try {
        if (typeof window !== 'undefined') {
            window.__meimaySavedCanvasOwnKey = selectedKey;
            window.__meimaySavedCanvasPartnerKey = '';
            window.__meimaySavedCanvasBlank = false;
        }
        localStorage.setItem('meimay_saved_canvas_blank', '0');
        localStorage.setItem('meimay_saved_canvas_own_key', selectedKey);
        localStorage.removeItem('meimay_saved_canvas_partner_key');
        persistActiveChildWorkspaceSnapshot('set-saved-main');
    } catch (error) {
        console.warn('SAVED: Persist own main key failed', error);
    }

    if (typeof MeimayPairing !== 'undefined' && MeimayPairing.roomCode) {
        MeimayPairing._autoSyncDebounced?.();
    }

    renderSavedScreen();
    if (typeof refreshPartnerAwareUI === 'function') refreshPartnerAwareUI();
    if (typeof showToast === 'function') showToast('本命にしました', '✓');
    return true;
}

function deleteSavedNameBySourceIndex(index, source = 'own') {
    const pairInsights = typeof window.MeimayPartnerInsights !== 'undefined' ? window.MeimayPartnerInsights : null;
    const sourceSaved = source === 'partner'
        ? (pairInsights?.getPartnerSaved ? pairInsights.getPartnerSaved() : [])
        : getSavedNames();
    if (index < 0 || index >= sourceSaved.length) return false;

    const sourceItem = sourceSaved[index];
    const sourceKey = getSavedCandidateKey(sourceItem);
    if (!sourceKey) return false;

    const saved = getSavedNames();
    const ownIndex = source === 'partner'
        ? saved.findIndex(item => getSavedCandidateKey(item) === sourceKey)
        : index;
    if (ownIndex < 0 || ownIndex >= saved.length) {
        if (typeof showToast === 'function') showToast('削除対象が見つかりません', '⚠️');
        return false;
    }

    if (!confirm('この候補を削除しますか？')) return false;

    const updated = saved.filter((_, idx) => idx !== ownIndex);
    if (typeof savedNames !== 'undefined') savedNames = updated;
    localStorage.setItem('meimay_saved', JSON.stringify(updated));
    persistActiveChildWorkspaceSnapshot('delete-saved-name');

    if (typeof MeimayPairing !== 'undefined' && MeimayPairing.roomCode) {
        MeimayPairing._autoSyncDebounced?.();
    }

    renderSavedScreen();
    if (typeof refreshPartnerAwareUI === 'function') refreshPartnerAwareUI();
    if (typeof showToast === 'function') showToast('削除しました', '🗑️');
    return true;
}

function votePartnerSavedName(index) {
    const pairInsights = typeof window.MeimayPartnerInsights !== 'undefined' ? window.MeimayPartnerInsights : null;
    const partnerSaved = pairInsights?.getPartnerSaved ? pairInsights.getPartnerSaved() : [];
    if (index < 0 || index >= partnerSaved.length) return false;

    const source = partnerSaved[index];
    if (!source) return false;

    const sourceKey = getSavedCandidateKey(source);
    if (!sourceKey) return false;

    const partnerName = pairInsights?.getPartnerDisplayName
        ? pairInsights.getPartnerDisplayName()
        : (typeof getPartnerRoleLabel === 'function'
            ? getPartnerRoleLabel(MeimayShare?.partnerSnapshot?.role)
            : 'パートナー');

    try {
        if (typeof window !== 'undefined') {
            window.__meimaySavedCanvasOwnKey = sourceKey;
            window.__meimaySavedCanvasPartnerKey = '';
            window.__meimaySavedCanvasBlank = false;
        }
        localStorage.setItem('meimay_saved_canvas_blank', '0');
        localStorage.setItem('meimay_saved_canvas_own_key', sourceKey);
        localStorage.removeItem('meimay_saved_canvas_partner_key');
        persistActiveChildWorkspaceSnapshot('vote-partner-saved-name');
    } catch (error) {
        console.warn('SAVED: Persist own main key from partner candidate failed', error);
    }

    renderSavedScreen();
    if (typeof refreshPartnerAwareUI === 'function') refreshPartnerAwareUI();
    if (typeof showToast === 'function') showToast(`${partnerName}の候補を本命にしました`, '✓');
    return true;
}

function likePartnerSavedName(index) {
    return votePartnerSavedName(index);
}

function clearSavedPartnerFocus() {
    if (typeof window.resetMeimayPartnerViewFocus === 'function') {
        window.resetMeimayPartnerViewFocus(['savedFocus']);
    } else if (typeof window.setMeimayPartnerViewFocus === 'function') {
        window.setMeimayPartnerViewFocus({ savedFocus: 'all' });
    }
    renderSavedScreen();
}

function renderSavedScreen() {
    const canvasContainer = document.getElementById('saved-naming-canvas');
    const listContainer = document.getElementById('saved-list-content');
    if (!canvasContainer || !listContainer) return;

    const saved = getSavedNames();
    const pairInsights = typeof window.MeimayPartnerInsights !== 'undefined' ? window.MeimayPartnerInsights : null;
    const partnerViewState = typeof window.getMeimayPartnerViewState === 'function'
        ? window.getMeimayPartnerViewState()
        : { savedFocus: 'all' };
    const savedFocus = partnerViewState.savedFocus || 'all';
    const partnerSaved = pairInsights?.getPartnerSaved ? pairInsights.getPartnerSaved() : [];
    const canvasState = getSavedCanvasState();
    const partnerName = canvasState.partnerName || (pairInsights?.getPartnerDisplayName
        ? pairInsights.getPartnerDisplayName()
        : (typeof getPartnerRoleLabel === 'function'
            ? getPartnerRoleLabel(MeimayShare?.partnerSnapshot?.role)
            : 'パートナー'));

    const ownVisibleItems = saved.filter(item => !item?.fromPartner && !item?.approvedFromPartner);
    const ownKeySet = new Set(ownVisibleItems.map(item => getSavedCandidateKey(item)).filter(Boolean));
    const partnerKeySet = new Set(partnerSaved.map(item => getSavedCandidateKey(item)).filter(Boolean));

    const ownDecorated = saved.map((item, index) => {
        const key = getSavedCandidateKey(item);
        const ownSelected = !!canvasState.ownKey && key === canvasState.ownKey;
        const partnerSelected = !!canvasState.partnerKey && key === canvasState.partnerKey;
        const shared = !!key && ownKeySet.has(key) && partnerKeySet.has(key);
        return {
            item,
            index,
            key,
            ownSelected,
            partnerSelected,
            shared,
            creatorMeta: getSavedCandidateCreatorMeta(item, 'own', partnerName)
        };
    }).sort((a, b) => {
        if (a.ownSelected !== b.ownSelected) return a.ownSelected ? -1 : 1;
        if (a.partnerSelected !== b.partnerSelected) return a.partnerSelected ? -1 : 1;
        if (a.shared !== b.shared) return a.shared ? -1 : 1;
        const aTime = new Date(a.item.mainSelectedAt || a.item.savedAt || a.item.timestamp || 0).getTime();
        const bTime = new Date(b.item.mainSelectedAt || b.item.savedAt || b.item.timestamp || 0).getTime();
        return bTime - aTime;
    });

    const partnerDecorated = partnerSaved.map((item, index) => {
        const key = getSavedCandidateKey(item);
        const ownSelected = !!canvasState.ownKey && key === canvasState.ownKey;
        const partnerSelected = !!canvasState.partnerKey && key === canvasState.partnerKey;
        const shared = !!key && ownKeySet.has(key) && partnerKeySet.has(key);
        return {
            item,
            index,
            key,
            ownSelected,
            partnerSelected,
            shared,
            creatorMeta: getSavedCandidateCreatorMeta(item, 'partner', partnerName),
            showInList: !item?.approvedFromPartner
        };
    }).filter(entry => entry.showInList).sort((a, b) => {
        if (a.partnerSelected !== b.partnerSelected) return a.partnerSelected ? -1 : 1;
        if (a.ownSelected !== b.ownSelected) return a.ownSelected ? -1 : 1;
        if (a.shared !== b.shared) return a.shared ? -1 : 1;
        const aTime = new Date(a.item.mainSelectedAt || a.item.savedAt || a.item.timestamp || 0).getTime();
        const bTime = new Date(b.item.mainSelectedAt || b.item.savedAt || b.item.timestamp || 0).getTime();
        return bTime - aTime;
    });

    let visibleOwn = ownDecorated;
    let visiblePartner = partnerDecorated;
    if (savedFocus === 'partner') {
        visibleOwn = [];
    } else if (savedFocus === 'matched') {
        visibleOwn = ownDecorated.filter(entry => entry.shared || (entry.ownSelected && entry.partnerSelected));
        visiblePartner = [];
    }

    const renderCanvasSide = (item, sourceTitle, sourceType, emptyText) => {
        if (!item) {
            return `
                <div class="rounded-[22px] border border-dashed border-[#eadfce] bg-white/70 px-4 py-4 text-center">
                    <div class="text-[10px] font-black tracking-[0.18em] text-[#bca37f] uppercase">${sourceTitle}</div>
                    <div class="mt-2 text-sm font-bold text-[#8b7e66]">${emptyText}</div>
                </div>
            `;
        }

        const key = getSavedCandidateKey(item);
        const creatorMeta = getSavedCandidateCreatorMeta(item, sourceType, partnerName);
        const ownSelected = !!canvasState.ownKey && key === canvasState.ownKey;
        const partnerSelected = !!canvasState.partnerKey && key === canvasState.partnerKey;
        const statusLabel = ownSelected && partnerSelected
            ? 'ふたりの本命'
            : ownSelected
                ? 'あなたの本命'
                : (partnerSelected ? `${partnerName}の本命` : '');

        return `
            <div class="rounded-[22px] border border-[#eadfce] bg-white px-4 py-4 shadow-sm">
                <div class="flex items-center justify-between gap-3">
                    <div>
                        <div class="text-[10px] font-black tracking-[0.18em] text-[#bca37f] uppercase">${sourceTitle}</div>
                        <div class="mt-2 inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-bold ${creatorMeta.toneClass}">${creatorMeta.label}</div>
                    </div>
                    ${statusLabel ? `<div class="rounded-full border border-[#eadfce] bg-[#fff8ef] px-2.5 py-1 text-[10px] font-bold text-[#b68a52]">${statusLabel}</div>` : ''}
                </div>
                <div class="mt-3 text-2xl font-black text-[#5d5444] leading-tight">${item.fullName || item.givenName || ''}</div>
                <div class="mt-1 text-xs text-[#a6967a]">${item.reading || ''}</div>
                <div class="mt-3 flex flex-wrap gap-2">
                    ${ownSelected && partnerSelected ? '<span class="inline-flex items-center rounded-full bg-[#fff3da] px-2.5 py-1 text-[10px] font-bold text-[#b8860b]">一致</span>' : ''}
                    ${ownSelected && !partnerSelected ? '<span class="inline-flex items-center rounded-full bg-[#fff3da] px-2.5 py-1 text-[10px] font-bold text-[#b8860b]">本命</span>' : ''}
                    ${!ownSelected && partnerSelected ? `<span class="inline-flex items-center rounded-full bg-[#fde8e5] px-2.5 py-1 text-[10px] font-bold text-[#dd7d73]">${partnerName}の本命</span>` : ''}
                    ${item.fortune ? `<span class="inline-flex items-center rounded-full border border-[#eadfce] bg-[#fff8ef] px-2.5 py-1 text-[10px] font-bold text-[#b68a52]">${typeof item.fortune.so === 'object' ? (item.fortune.so.val || '') : item.fortune.so}画</span>` : ''}
                </div>
            </div>
        `;
    };

    const mainItem = canvasState.ownMain || canvasState.partnerMain;
    const mainCreatorMeta = getSavedCandidateCreatorMeta(mainItem, 'own', partnerName);
    const renderCanvasHtml = canvasState.matched && mainItem
        ? `
            <div class="rounded-[28px] border border-[#eadfce] bg-gradient-to-br from-[#fffaf4] via-[#fffdf9] to-[#f7f1e8] p-4 shadow-[0_18px_35px_-28px_rgba(123,104,83,0.55)]">
                <div class="flex items-center justify-between gap-3 mb-3">
                    <div>
                        <div class="text-[10px] font-black tracking-[0.22em] text-[#bca37f] uppercase">Naming Canvas</div>
                        <div class="mt-1 text-sm font-black text-[#5d5444]">ふたりの本命が一致しました</div>
                    </div>
                    <div class="rounded-full border border-[#eadfce] bg-white px-3 py-1 text-[10px] font-bold text-[#8b7e66]">ひとつのキャンバス</div>
                </div>
                <div class="rounded-[24px] border border-[#eadfce] bg-white px-4 py-5 text-center shadow-sm">
                    <div class="inline-flex items-center rounded-full border ${mainCreatorMeta.toneClass} px-3 py-1 text-[10px] font-bold">${mainCreatorMeta.label}</div>
                    <div class="mt-3 text-3xl font-black text-[#5d5444] leading-tight">${mainItem.fullName || mainItem.givenName || ''}</div>
                    <div class="mt-1 text-xs text-[#a6967a]">${mainItem.reading || ''}</div>
                    <div class="mt-3 flex flex-wrap justify-center gap-2">
                        <span class="inline-flex items-center rounded-full border border-[#eadfce] bg-[#fff8ef] px-2.5 py-1 text-[10px] font-bold text-[#b68a52]">自分の本命</span>
                        <span class="inline-flex items-center rounded-full border border-[#eadfce] bg-[#fff8ef] px-2.5 py-1 text-[10px] font-bold text-[#b68a52]">${partnerName}の本命</span>
                    </div>
                </div>
            </div>
        `
        : `
            <div class="grid grid-cols-2 gap-3">
                ${renderCanvasSide(canvasState.ownMain, '自分', 'own', 'まだ本命を選んでいません')}
                ${renderCanvasSide(canvasState.partnerMain, partnerName, 'partner', 'まだ本命を選んでいません')}
            </div>
        `;

    canvasContainer.innerHTML = `
        <div class="rounded-[28px] border border-[#eee5d8] bg-gradient-to-br from-[#fffdf9] via-[#fffaf4] to-[#f8f1e7] p-4 shadow-[0_18px_35px_-28px_rgba(123,104,83,0.55)]">
            <div class="flex items-start justify-between gap-3 mb-3">
                <div>
                    <div class="text-[10px] font-black tracking-[0.22em] text-[#bca37f] uppercase">Naming Canvas</div>
                    <div class="mt-1 text-sm font-black text-[#5d5444]">1人1票 / 変更OK</div>
                </div>
                <div class="rounded-full border border-[#eadfce] bg-white px-3 py-1 text-[10px] font-bold text-[#8b7e66]">${canvasState.matched ? '一致中' : 'スプリット'}</div>
            </div>
            ${renderCanvasHtml}
        </div>
    `;

    const focusBanner = savedFocus !== 'all'
        ? `
            <div class="rounded-2xl border border-[#eee5d8] bg-[#fffaf5] px-4 py-3 mb-3">
                <div class="flex items-center justify-between gap-3">
                    <div>
                        <div class="text-[10px] font-black tracking-[0.18em] text-[#bca37f] uppercase">FILTER</div>
                        <div class="mt-1 text-sm font-bold text-[#4f4639]">${savedFocus === 'partner' ? `${partnerName}の候補だけ表示` : 'ふたりに共通する候補だけ表示'}</div>
                        <div class="mt-1 text-[11px] text-[#8b7e66]">${savedFocus === 'partner' ? 'パートナー側の候補に絞っています。' : 'ふたりで保存が重なった候補だけを見ています。'}</div>
                    </div>
                    <button onclick="clearSavedPartnerFocus()" class="shrink-0 rounded-full border border-[#eadfce] bg-white px-3 py-1.5 text-[11px] font-bold text-[#8b7e66] active:scale-95">
                        すべて表示
                    </button>
                </div>
            </div>
        `
        : '';

    const renderCard = (entry, source) => {
        const item = entry.item;
        const selected = source === 'own' ? entry.ownSelected : entry.partnerSelected;
        const buttonText = selected ? '本命中' : '本命にする';
        const buttonAction = source === 'own'
            ? `setSavedMainCandidate(${entry.index})`
            : `votePartnerSavedName(${entry.index})`;
        const buttonClass = selected
            ? 'bg-[#5d5444] text-white cursor-default'
            : 'bg-gradient-to-r from-[#f8c27a] to-[#e8a96b] text-white active:scale-95';
        const detailSource = source === 'own' ? 'own' : 'partner';
        const statusLabel = entry.ownSelected && entry.partnerSelected
            ? 'ふたりの本命'
            : entry.ownSelected
                ? 'あなたの本命'
                : (entry.partnerSelected ? `${partnerName}の本命` : (entry.shared ? '両方保存' : ''));

        return `
            <div onclick="showSavedNameDetail(${entry.index}, '${detailSource}')" class="group cursor-pointer rounded-[24px] border ${entry.ownSelected ? 'border-[#bca37f] bg-[#fffaf6] shadow-[0_10px_30px_-18px_rgba(188,163,127,0.55)]' : (entry.partnerSelected ? 'border-[#f4d3cf] bg-[#fff9f8] shadow-sm' : 'border-[#eee5d8] bg-white shadow-sm')} p-4 transition-all active:scale-[0.99]">
                <div class="flex items-start justify-between gap-3 mb-2">
                    <div class="flex-1 min-w-0">
                        <div class="flex flex-wrap items-center gap-2 mb-2">
                            <span class="inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-bold ${entry.creatorMeta.toneClass}">${entry.creatorMeta.label}</span>
                            ${statusLabel ? `<span class="inline-flex items-center rounded-full border border-[#eadfce] bg-[#fff8ef] px-2.5 py-1 text-[10px] font-bold text-[#b68a52]">${statusLabel}</span>` : ''}
                        </div>
                        <div class="text-xl font-black text-[#5d5444]">${item.fullName || item.givenName || ''}</div>
                        <div class="text-xs text-[#a6967a]">${item.reading || ''}</div>
                        ${item.message ? `<div class="mt-1 text-xs text-[#bca37f]">メモ ${item.message}</div>` : ''}
                        ${entry.shared ? `<div class="mt-1 text-[10px] text-[#8b7e66]">ふたりに保存済み</div>` : ''}
                    </div>
                    <div class="shrink-0 text-right">
                        ${item.fortune ? `<div class="text-sm font-bold text-[#bca37f]">${typeof item.fortune.so === 'object' ? (item.fortune.so.val || '') : item.fortune.so}画</div>` : ''}
                    </div>
                </div>
                <button onclick="event.stopPropagation(); ${buttonAction}" ${entry.ownSelected ? 'disabled' : ''} class="w-full py-3 rounded-xl text-sm font-black ${buttonClass}">
                    ${buttonText}
                </button>
            </div>
        `;
    };

    let html = focusBanner;
    if (visibleOwn.length > 0) {
        html += `
            <div class="space-y-3">
                <div class="flex items-center justify-between gap-3 px-1">
                    <div class="text-[10px] font-black tracking-[0.18em] text-[#bca37f] uppercase">自分の候補</div>
                    <div class="text-[11px] text-[#8b7e66]">${visibleOwn.length}件</div>
                </div>
                ${visibleOwn.map(entry => renderCard(entry, 'own')).join('')}
            </div>
        `;
    }

    if (visiblePartner.length > 0) {
        html += `
            <div class="space-y-3 pt-1">
                <div class="flex items-center justify-between gap-3 px-1">
                    <div class="text-[10px] font-black tracking-[0.18em] text-[#dd7d73] uppercase">${partnerName}の候補</div>
                    <div class="text-[11px] text-[#8b7e66]">${visiblePartner.length}件</div>
                </div>
                ${visiblePartner.map(entry => renderCard(entry, 'partner')).join('')}
            </div>
        `;
    }

    if (!html) {
        html = `
            <div class="text-center py-16 text-sm text-[#a6967a]">
                <div class="text-4xl mb-4 opacity-50">🗂️</div>
                <p>まだ保存された候補はありません</p>
                <p class="text-[10px] mt-2">保存するとここに一覧が出ます。</p>
            </div>
        `;
    }

    listContainer.innerHTML = html;
}

window.likePartnerSavedName = likePartnerSavedName;
window.clearSavedPartnerFocus = clearSavedPartnerFocus;
window.getSavedNames = getSavedNames;
window.renderSavedScreen = renderSavedScreen;
window.setSavedMainCandidate = setSavedMainCandidate;
window.votePartnerSavedName = votePartnerSavedName;
window.deleteSavedName = deleteSavedNameBySourceIndex;
window.getSavedCandidateKey = getSavedCandidateKey;
window.getSavedCanvasState = getSavedCanvasState;

function renderSavedScreen() {
    const canvasContainer = document.getElementById('saved-naming-canvas');
    const listContainer = document.getElementById('saved-list-content');
    if (!canvasContainer || !listContainer) return;

    const saved = getSavedNames();
    const pairInsights = typeof window.MeimayPartnerInsights !== 'undefined' ? window.MeimayPartnerInsights : null;
    const partnerSaved = pairInsights?.getPartnerSaved ? pairInsights.getPartnerSaved() : [];
    const canvasState = getSavedCanvasState();
    const savedFocus = typeof window !== 'undefined' && typeof window.savedFocus !== 'undefined'
        ? window.savedFocus
        : 'all';
    const partnerName = canvasState.partnerName || (pairInsights?.getPartnerDisplayName
        ? pairInsights.getPartnerDisplayName()
        : (typeof getPartnerRoleLabel === 'function'
            ? getPartnerRoleLabel(MeimayShare?.partnerSnapshot?.role)
            : 'パートナー'));

    const escapeHtml = (value) => String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    const getFortuneText = (fortune) => {
        if (!fortune || fortune.so == null || fortune.so === '') return '';
        const raw = typeof fortune.so === 'object'
            ? (fortune.so.val || fortune.so.label || fortune.so.text || '')
            : fortune.so;
        const text = String(raw || '').trim().replace(/[画数]+$/, '');
        return text ? escapeHtml(text) : '';
    };

    const fitSavedText = (node, minSize, maxSize) => {
        if (!node) return;
        const parent = node.parentElement;
        if (!parent) return;

        node.style.whiteSpace = 'nowrap';
        node.style.display = 'block';
        node.style.width = '100%';
        node.style.overflow = 'hidden';
        node.style.textOverflow = 'clip';

        const availableWidth = parent.clientWidth || parent.getBoundingClientRect().width || 0;
        if (!availableWidth) return;

        let size = maxSize;
        node.style.fontSize = `${size}px`;
        while (size > minSize && node.scrollWidth > availableWidth) {
            size -= 1;
            node.style.fontSize = `${size}px`;
        }
    };

    const applySavedTextFit = () => {
        canvasContainer.querySelectorAll('[data-fit-saved-name="canvas"]').forEach(node => fitSavedText(node, 14, 24));
        canvasContainer.querySelectorAll('[data-fit-saved-name="split"]').forEach(node => fitSavedText(node, 14, 22));
        listContainer.querySelectorAll('[data-fit-saved-name="card"]').forEach(node => fitSavedText(node, 14, 22));
    };

    const ownVisibleItems = saved.filter(item => !item?.fromPartner && !item?.approvedFromPartner);
    const ownKeySet = new Set(ownVisibleItems.map(item => getSavedCandidateKey(item)).filter(Boolean));
    const partnerKeySet = new Set(partnerSaved.map(item => getSavedCandidateKey(item)).filter(Boolean));
    const hasPartnerLinked = typeof MeimayPairing !== 'undefined'
        ? !!(MeimayPairing.roomCode && MeimayPairing.partnerUid)
        : false;

    const ownDecorated = ownVisibleItems.map((item, index) => {
        const key = getSavedCandidateKey(item);
        const ownSelected = !!canvasState.ownKey && key === canvasState.ownKey;
        const partnerSelected = hasPartnerLinked && !!canvasState.partnerKey && key === canvasState.partnerKey;
        const shared = hasPartnerLinked && !!key && ownKeySet.has(key) && partnerKeySet.has(key);
        return {
            item,
            index,
            key,
            ownSelected,
            partnerSelected,
            shared
        };
    }).sort((a, b) => {
        if (a.ownSelected !== b.ownSelected) return a.ownSelected ? -1 : 1;
        if (a.partnerSelected !== b.partnerSelected) return a.partnerSelected ? -1 : 1;
        if (a.shared !== b.shared) return a.shared ? -1 : 1;
        const aTime = new Date(a.item.mainSelectedAt || a.item.savedAt || a.item.timestamp || 0).getTime();
        const bTime = new Date(b.item.mainSelectedAt || b.item.savedAt || b.item.timestamp || 0).getTime();
        return bTime - aTime;
    });

    const partnerDecorated = partnerSaved.map((item, index) => {
        const key = getSavedCandidateKey(item);
        const ownSelected = !!canvasState.ownKey && key === canvasState.ownKey;
        const partnerSelected = hasPartnerLinked && !!canvasState.partnerKey && key === canvasState.partnerKey;
        const shared = hasPartnerLinked && !!key && ownKeySet.has(key) && partnerKeySet.has(key);
        return {
            item,
            index,
            key,
            ownSelected,
            partnerSelected,
            shared,
            showInList: true
        };
    }).filter(entry => entry.showInList).sort((a, b) => {
        if (a.partnerSelected !== b.partnerSelected) return a.partnerSelected ? -1 : 1;
        if (a.ownSelected !== b.ownSelected) return a.ownSelected ? -1 : 1;
        if (a.shared !== b.shared) return a.shared ? -1 : 1;
        const aTime = new Date(a.item.mainSelectedAt || a.item.savedAt || a.item.timestamp || 0).getTime();
        const bTime = new Date(b.item.mainSelectedAt || b.item.savedAt || b.item.timestamp || 0).getTime();
        return bTime - aTime;
    });

    let visibleOwn = ownDecorated;
    let visiblePartner = partnerDecorated;
    if (!hasPartnerLinked) {
        visiblePartner = [];
    }
    if (savedFocus === 'partner' && hasPartnerLinked) {
        visibleOwn = [];
    } else if (savedFocus === 'matched') {
        visibleOwn = ownDecorated.filter(entry => entry.shared || (entry.ownSelected && entry.partnerSelected));
        visiblePartner = [];
    }

    const relationshipPalettes = typeof window.getMeimayRelationshipPalettes === 'function'
        ? window.getMeimayRelationshipPalettes()
        : null;
    const getOwnershipPalette = (kind) => {
        if (typeof window.getMeimayOwnershipPalette === 'function') {
            return window.getMeimayOwnershipPalette(kind);
        }
        return null;
    };
    const ownPalette = relationshipPalettes?.self || getOwnershipPalette('self');
    const partnerPalette = relationshipPalettes?.partner || getOwnershipPalette('partner');
    const matchedPalette = relationshipPalettes?.matched || getOwnershipPalette('matched');
    const canvasTheme = {
        own: {
            border: ownPalette?.border || '#d9e8ff',
            label: ownPalette?.text || '#59779d',
            surface: ownPalette?.surface || 'linear-gradient(180deg, #eff7ff 0%, #f8fbff 100%)',
            surfaceSelected: ownPalette?.surface || 'linear-gradient(180deg, #eaf4ff 0%, #ffffff 100%)',
            ring: ownPalette?.accentStrong || ownPalette?.accent || '#5f98de'
        },
        partner: {
            border: partnerPalette?.border || '#f7dbe5',
            label: partnerPalette?.text || '#8e6170',
            surface: partnerPalette?.surface || 'linear-gradient(180deg, #fff3f7 0%, #fff8fb 100%)',
            surfaceSelected: partnerPalette?.surface || 'linear-gradient(180deg, #fff0f5 0%, #ffffff 100%)',
            ring: partnerPalette?.accentStrong || partnerPalette?.accent || '#dc7f9c'
        },
        matched: {
            border: matchedPalette?.border || ownPalette?.border || '#d9e8ff',
            label: matchedPalette?.text || '#7d6671',
            surface: matchedPalette?.surface || `linear-gradient(135deg, ${ownPalette?.accentSoft || ownPalette?.mist || '#eff7ff'} 0%, #fffdfb 50%, ${partnerPalette?.accentSoft || partnerPalette?.mist || '#fff5f8'} 100%)`,
            ring: matchedPalette?.accent || ownPalette?.accentStrong || ownPalette?.accent || '#5f98de'
        }
    };
    const ownDisplayLabel = 'マイ本命';
    const partnerDisplayLabel = 'パートナー本命';
    const canvasCardMinHeight = 'min-h-[72px]';
    const canvasLabelClass = 'text-[11px] font-black leading-none tracking-[0.06em] whitespace-nowrap';
    const canvasReadingClass = 'text-[7px] font-bold leading-none whitespace-nowrap opacity-85';
    const matchedFrameGradient = `linear-gradient(135deg, ${canvasTheme.own.ring} 0%, ${canvasTheme.partner.ring} 100%)`;

    const renderCanvasSide = (item, sourceType, emptyText) => {
        const isOwn = sourceType === 'own';
        const label = isOwn ? ownDisplayLabel : partnerDisplayLabel;
        const theme = isOwn ? canvasTheme.own : canvasTheme.partner;
        const borderStyle = `border-color:${theme.border};`;
        const labelStyle = `color:${theme.label};`;
        const labelHtml = `<div class="${canvasLabelClass} mb-1.5 text-center" style="${labelStyle}">${escapeHtml(label)}</div>`;

        if (!item) {
            return `
                <div class="flex flex-col items-center">
                    ${labelHtml}
                    <div class="w-full rounded-[24px] border border-dashed ${canvasCardMinHeight} px-3.5 py-2 text-center" style="background:${theme.surface}; ${borderStyle}">
                        <div class="text-sm font-bold text-[#8b7e66]">${escapeHtml(emptyText)}</div>
                    </div>
                </div>
            `;
        }

        const key = getSavedCandidateKey(item);
        const selected = isOwn
            ? !!canvasState.ownKey && key === canvasState.ownKey
            : hasPartnerLinked && !!canvasState.partnerKey && key === canvasState.partnerKey;
        const borderWidthClass = selected ? 'border-2' : 'border';
        const borderColor = selected ? theme.ring : theme.border;
        const reading = escapeHtml(item.reading || '');
        const surfaceStyle = selected ? theme.surfaceSelected : theme.surface;

        return `
            <div class="flex flex-col items-center">
                ${labelHtml}
                <div class="w-full rounded-[24px] ${borderWidthClass} ${canvasCardMinHeight} px-3.5 pt-3.5 pb-1.5 shadow-sm" style="background:${surfaceStyle}; border-color:${borderColor};">
                    <div class="flex flex-col items-center text-center">
                        ${reading ? `<div class="${canvasReadingClass}" style="${labelStyle}">${reading}</div>` : ''}
                        <div data-fit-saved-name="split" class="${reading ? 'mt-1.5' : 'mt-1'} w-full overflow-hidden text-center text-[22px] font-black leading-[1.02] whitespace-nowrap text-[#5d5444]">
                            ${escapeHtml(item.fullName || item.givenName || '')}
                        </div>
                    </div>
                </div>
            </div>
        `;
    };

    const mainItem = canvasState.ownMain || canvasState.partnerMain;
    const renderCanvasHtml = canvasState.matched && mainItem
        ? `
            <div class="relative rounded-[26px] p-[2px] shadow-[0_18px_35px_-28px_rgba(123,104,83,0.45)]" style="background:${matchedFrameGradient};">
                <div class="rounded-[24px] ${canvasCardMinHeight} px-3.5 pt-2.5 pb-2 text-center shadow-sm" style="background:${canvasTheme.matched.surface};">
                    ${mainItem.reading ? `<div class="${canvasReadingClass} mt-1" style="color:${canvasTheme.matched.label};">${escapeHtml(mainItem.reading)}</div>` : ''}
                    <div data-fit-saved-name="canvas" class="mt-1.5 w-full overflow-hidden text-center text-[23px] font-black leading-[1.02] whitespace-nowrap text-[#5d5444]">
                        ${escapeHtml(mainItem.fullName || mainItem.givenName || '')}
                    </div>
                </div>
            </div>
        `
        : `
            ${hasPartnerLinked ? `
                <div class="grid grid-cols-2 gap-2.5">
                    ${renderCanvasSide(canvasState.ownMain, 'own', 'まだ本命を選んでいません')}
                    ${renderCanvasSide(canvasState.partnerMain, 'partner', 'まだ本命を選んでいません')}
                </div>
            ` : `
                <div class="mx-auto max-w-[320px]">
                    ${renderCanvasSide(canvasState.ownMain, 'own', 'まだ本命を選んでいません')}
                </div>
            `}
        `;

    const canvasHeaderText = canvasState.matched
        ? 'ふたりの本命が一致しました'
        : '本命の候補を選択してください';

    canvasContainer.innerHTML = `
        <div class="rounded-[28px] border border-[#eee5d8] bg-gradient-to-br from-[#fffdf9] via-[#fffaf4] to-[#f8f1e7] p-3 shadow-[0_18px_35px_-28px_rgba(123,104,83,0.55)]">
            <div class="mb-2 text-[13px] font-black text-[#5d5444]">${escapeHtml(canvasHeaderText)}</div>
            ${renderCanvasHtml}
        </div>
    `;

    const focusBanner = savedFocus !== 'all' && hasPartnerLinked
        ? `
            <div class="rounded-2xl border border-[#eee5d8] bg-[#fffaf5] px-4 py-3 mb-3">
                <div class="flex items-center justify-between gap-3">
                    <div>
                        <div class="text-[10px] font-black tracking-[0.18em] text-[#bca37f]">絞り込み</div>
                        <div class="mt-1 text-sm font-bold text-[#4f4639]">${savedFocus === 'partner' ? `${escapeHtml(partnerName)}の候補だけ表示中` : 'ふたりで一致した候補だけ表示中'}</div>
                    </div>
                    <button onclick="clearSavedPartnerFocus()" class="shrink-0 rounded-full border border-[#eadfce] bg-white px-3 py-1.5 text-[11px] font-bold text-[#8b7e66] active:scale-95">
                        すべて表示
                    </button>
                </div>
            </div>
        `
        : '';

    const renderCard = (entry, source) => {
        const item = entry.item;
        const detailSource = source === 'own' ? 'own' : 'partner';
        const selected = entry.ownSelected;
        const buttonText = selected ? '本命中' : '本命にする';
        const buttonAction = source === 'own'
            ? `setSavedMainCandidate(${entry.index})`
            : `votePartnerSavedName(${entry.index})`;
        const buttonClass = selected
            ? 'bg-[#5d5444] text-white cursor-default'
            : 'bg-gradient-to-r from-[#f7c47c] to-[#e7a665] text-white active:scale-95';
        const cardActive = entry.ownSelected || entry.partnerSelected;
        const cardMatched = entry.ownSelected && entry.partnerSelected;
        const theme = source === 'own' ? canvasTheme.own : canvasTheme.partner;
        const nameText = escapeHtml(item.fullName || item.givenName || '');
        const readingText = escapeHtml(item.reading || '');
        const messageText = item.message ? escapeHtml(item.message) : '';
        const surfaceStyle = cardMatched
            ? canvasTheme.matched.surface
            : (cardActive ? theme.surfaceSelected : theme.surface);
        const borderColor = cardMatched ? canvasTheme.matched.border : (cardActive ? theme.ring : theme.border);
        const textColor = theme.label;
        const borderWidthClass = cardActive ? 'border-2' : 'border';
        const shadowClass = cardActive ? 'shadow-[0_10px_30px_-18px_rgba(123,104,83,0.16)]' : 'shadow-sm';
        const useGradientFrame = cardMatched || (source === 'partner' && entry.ownSelected);

        if (useGradientFrame) {
            return `
                <div onclick="showSavedNameDetail(${entry.index}, '${detailSource}')" class="group mx-0.5 cursor-pointer rounded-[24px] p-[2px] ${shadowClass} transition-all active:scale-[0.99]" style="background:${matchedFrameGradient};">
                    <div class="rounded-[22px] px-3 py-3" style="background:${surfaceStyle};">
                        <div class="flex items-start gap-2.5">
                            <div class="min-w-0 flex-1">
                                <div class="flex items-start justify-between gap-2">
                                    <div class="min-w-0 flex-1">
                                        ${readingText ? `<div class="text-[10px] font-bold leading-none" style="color:${textColor};">${readingText}</div>` : ''}
                                        <div data-fit-saved-name="card" class="${readingText ? 'mt-0.5' : 'mt-0'} w-full overflow-hidden whitespace-nowrap text-ellipsis text-[17px] font-black leading-tight text-[#5d5444]">${nameText}</div>
                                        ${messageText ? `<div class="mt-1 text-[10px] text-[#bca37f]">メモ ${messageText}</div>` : ''}
                                    </div>
                                    <div class="flex shrink-0 flex-col items-end gap-2">
                                        <button onclick="event.stopPropagation(); ${buttonAction}" ${selected ? 'disabled' : ''} class="min-w-[5.8rem] rounded-full px-3 py-1.5 text-[10px] font-black ${buttonClass}">
                                            ${buttonText}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }

        return `
            <div onclick="showSavedNameDetail(${entry.index}, '${detailSource}')" class="group mx-0.5 cursor-pointer rounded-[24px] ${borderWidthClass} ${shadowClass} p-3 transition-all active:scale-[0.99]" style="background:${surfaceStyle}; border-color:${borderColor};">
                <div class="flex items-start gap-2.5">
                    <div class="min-w-0 flex-1">
                        <div class="flex items-start justify-between gap-2">
                            <div class="min-w-0 flex-1">
                                ${readingText ? `<div class="text-[10px] font-bold leading-none" style="color:${textColor};">${readingText}</div>` : ''}
                                <div data-fit-saved-name="card" class="${readingText ? 'mt-0.5' : 'mt-0'} w-full overflow-hidden whitespace-nowrap text-ellipsis text-[17px] font-black leading-tight text-[#5d5444]">${nameText}</div>
                                ${messageText ? `<div class="mt-1 text-[10px] text-[#bca37f]">メモ ${messageText}</div>` : ''}
                            </div>
                            <div class="flex shrink-0 flex-col items-end gap-2">
                                <button onclick="event.stopPropagation(); ${buttonAction}" ${selected ? 'disabled' : ''} class="min-w-[5.8rem] rounded-full px-3 py-1.5 text-[10px] font-black ${buttonClass}">
                                    ${buttonText}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    };

    let html = focusBanner;
    if (visibleOwn.length > 0) {
        html += `
            <div class="space-y-3">
                <div class="flex items-center justify-between gap-3 px-1">
                    <div class="text-[10px] font-black tracking-[0.18em] text-[#bca37f]">自分の候補</div>
                    <div class="text-[11px] text-[#8b7e66]">${visibleOwn.length}件</div>
                </div>
                ${visibleOwn.map(entry => renderCard(entry, 'own')).join('')}
            </div>
        `;
    }

    if (hasPartnerLinked && visiblePartner.length > 0) {
        html += `
            <div class="space-y-3 pt-1">
                <div class="flex items-center justify-between gap-3 px-1">
                    <div class="text-[10px] font-black tracking-[0.18em] text-[#dd7d73]">${escapeHtml(partnerName)}の候補</div>
                    <div class="text-[11px] text-[#8b7e66]">${visiblePartner.length}件</div>
                </div>
                ${visiblePartner.map(entry => renderCard(entry, 'partner')).join('')}
            </div>
        `;
    }

    if (!visibleOwn.length && !visiblePartner.length) {
        html += `
            <div class="text-center py-16 text-sm text-[#a6967a]">
                <p>まだ保存済みの候補はありません</p>
                <p class="text-[10px] mt-2">候補を保存するとここに並びます</p>
            </div>
        `;
    }

    listContainer.innerHTML = html;
    if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(applySavedTextFit);
    } else {
        setTimeout(applySavedTextFit, 0);
    }
}

window.renderSavedScreen = renderSavedScreen;
