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

    // 重複チェック
    const isDuplicate = saved.some(item => item.fullName === currentBuildResult.fullName);
    if (isDuplicate) {
        if (!confirm('この名前は既に保存されています。上書きしますか？')) {
            return;
        }
        // 既存を削除
        const filtered = saved.filter(item => item.fullName !== currentBuildResult.fullName);
        localStorage.setItem('meimay_saved', JSON.stringify(filtered));
    }

    // 保存データを作成
    const saveData = {
        ...currentBuildResult,
        message: message,
        savedAt: new Date().toISOString()
    };

    saved.unshift(saveData);

    // 最大50件まで
    if (saved.length > 50) {
        saved.length = 50;
    }

    // グローバル変数を更新（StorageBox.saveAll で上書きされないようにする）
    if (typeof savedNames !== 'undefined') savedNames = saved;

    localStorage.setItem('meimay_saved', JSON.stringify(saved));

    closeSaveMessageModal();
    alert('✨ 名前を保存しました！');
    console.log('HISTORY: Name saved with message', saveData);
}

/**
 * 読み方単位の履歴に追加
 */
function addToReadingHistory() {
    if (!segments || segments.length === 0) return;

    const reading = segments.join('');
    const history = getReadingHistory();

    // 重複を削除（最新を優先）
    const filtered = history.filter(item => item.reading !== reading);

    const historyData = {
        reading: reading,
        segments: [...segments],
        settings: {
            gender: gender,
            rule: rule,
            imageTags: selectedImageTags || [],
            prioritizeFortune: prioritizeFortune,
            surname: surnameStr
        },
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
function openSavedNames() {
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

    container.innerHTML = saved.length > 0 ? saved.map((item, index) => `
        <div class="bg-white rounded-2xl p-4 border border-[#eee5d8] shadow-sm relative">
            ${item.fromPartner ? `<div class="absolute -top-2 -right-2 bg-gradient-to-r from-[#f28b82] to-[#f4978e] text-white text-[10px] font-bold px-2 py-1 rounded-full shadow-sm z-10 break-keep">👩 パートナーから</div>` : ''}
            <div class="flex items-start justify-between mb-2">
                <div class="flex-1">
                    <div class="text-lg font-black text-[#5d5444]">${item.fullName || ''}</div>
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
                <button onclick="loadSavedName(${index})" class="flex-1 py-2.5 bg-[#fdfaf5] rounded-xl text-xs font-bold text-[#7a6f5a] hover:bg-[#bca37f] hover:text-white transition-all active:scale-95">
                    詳細を見る
                </button>
                <button onclick="deleteSavedName(${index})" class="px-4 py-2.5 bg-[#fef2f2] rounded-xl text-xs font-bold text-[#f28b82] hover:bg-[#f28b82] hover:text-white transition-all active:scale-95">
                    削除
                </button>
            </div>
        </div>
    `).join('') : `
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

/**
 * 保存済み名前を読み込む
 */
function loadSavedName(index) {
    const saved = getSavedNames();
    if (index < 0 || index >= saved.length) return;

    const item = saved[index];

    // 設定を復元
    if (item.combination && item.combination.length > 0) {
        const reading = item.reading || '';
        segments = reading.split('').map(c => c);

        item.combination.forEach((kanji, idx) => {
            const existing = liked.find(l => l['漢字'] === kanji['漢字'] && l.slot === idx);
            if (!existing) {
                liked.push({
                    ...kanji,
                    slot: idx,
                    sessionReading: reading
                });
            }
        });
    }

    currentBuildResult = item;

    // ビルド画面に遷移
    changeScreen('scr-build');
    if (typeof renderBuildSelection === 'function') {
        renderBuildSelection();
    }
    if (typeof renderBuildResult === 'function') {
        renderBuildResult();
    }

    console.log('HISTORY: Loaded saved name with combination', item);
}

/**
 * 読み方履歴を読み込んで再開
 */
function loadReadingHistory(index) {
    const history = getReadingHistory();
    if (index < 0 || index >= history.length) return;

    const item = history[index];

    // 設定を復元
    segments = [...item.segments];
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
window.openHistory = openHistory;
window.switchHistoryTab = switchHistoryTab;
window.loadReadingHistory = loadReadingHistory;
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
