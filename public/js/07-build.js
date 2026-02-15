/* ============================================================
   MODULE 07: BUILD (V14.0 - 読み方別折りたたみ対応)
   ビルド画面・名前構築・姓名判断表示
   ============================================================ */

let selectedPieces = [];

/**
 * ストック画面を開く
 */
function openStock() {
    console.log("BUILD: Opening stock screen");
    renderStock();
    changeScreen('scr-stock');
}

/**
 * ストック一覧のレンダリング（読み方別折りたたみ対応）
 */
function renderStock() {
    const container = document.getElementById('stock-list');
    if (!container) return;

    container.innerHTML = '';

    if (liked.length === 0) {
        container.innerHTML = `
            <div class="col-span-4 text-center py-20">
                <p class="text-[#bca37f] italic text-lg mb-2">まだストックがありません</p>
                <p class="text-sm text-[#a6967a]">スワイプ画面で漢字を選びましょう</p>
            </div>
        `;
        return;
    }

    // 現在の読み方を取得
    const currentReading = segments.join('');

    // 全ての読み方でグループ化
    const allReadings = {};

    // 履歴から読み方ごとのセグメント情報を取得
    const history = typeof getReadingHistory === 'function' ? getReadingHistory() : [];
    const readingToSegments = {};
    history.forEach(h => {
        readingToSegments[h.reading] = h.segments;
    });

    liked.forEach(item => {
        // itemにsessionReadingがあればそれを使用、なければ現在の読み方
        const itemReading = item.sessionReading || currentReading;
        if (!allReadings[itemReading]) {
            allReadings[itemReading] = {};
        }

        const targetSegments = readingToSegments[itemReading] || segments;
        const seg = targetSegments[item.slot] || '不明';
        if (!allReadings[itemReading][seg]) {
            allReadings[itemReading][seg] = [];
        }
        allReadings[itemReading][seg].push(item);
    });

    // 読み方ごとに表示
    Object.keys(allReadings).sort((a, b) => {
        // 現在の読み方を最初に
        if (a === currentReading) return -1;
        if (b === currentReading) return 1;
        return b.localeCompare(a);
    }).forEach(reading => {
        const isCurrent = reading === currentReading;
        const segmentGroups = allReadings[reading];
        const totalCount = Object.values(segmentGroups).reduce((sum, arr) => sum + arr.length, 0);

        // 読み方ヘッダー（折りたたみ可能）
        const readingHeader = document.createElement('div');
        readingHeader.className = 'col-span-4 mt-8 mb-4';
        readingHeader.innerHTML = `
            <div onclick="toggleReadingGroup('${reading}')" class="flex items-center gap-3 cursor-pointer bg-white rounded-full px-6 py-3 shadow-md hover:shadow-lg transition-all ${isCurrent ? 'border-2 border-[#bca37f]' : 'border border-[#eee5d8]'}">
                <span class="text-2xl" id="icon-${reading}">${isCurrent ? '▼' : '▶'}</span>
                <span class="flex-1 text-lg font-black ${isCurrent ? 'text-[#bca37f]' : 'text-[#a6967a]'}">
                    ${reading} ${isCurrent ? '（現在）' : ''}
                </span>
                <span class="text-sm font-bold text-[#a6967a] bg-[#fdfaf5] px-3 py-1 rounded-full mr-2">
                    ${totalCount}個
                </span>
                <button onclick="event.stopPropagation(); deleteStockGroup('${reading}')" class="w-8 h-8 flex items-center justify-center rounded-full bg-[#fef2f2] text-[#f28b82] hover:bg-[#f28b82] hover:text-white transition-all" title="この読み方のストックを削除">
                    ✕
                </button>
            </div>
        `;
        container.appendChild(readingHeader);

        // 漢字グループコンテナ
        const groupContainer = document.createElement('div');
        groupContainer.id = `group-${reading}`;
        groupContainer.className = `col-span-4 ${isCurrent ? '' : 'hidden'}`;

        // 各音節ごとに表示
        Object.keys(segmentGroups).forEach(seg => {
            const items = segmentGroups[seg];

            if (items.length > 0) {
                // 音節ヘッダー
                const segHeader = document.createElement('div');
                segHeader.className = 'col-span-4 mt-4 mb-2';
                segHeader.innerHTML = `
                    <div class="flex items-center gap-3">
                        <div class="h-px flex-1 bg-[#d4c5af]"></div>
                        <span class="text-sm font-black text-[#bca37f] uppercase tracking-widest px-3 py-1 bg-white rounded-full border border-[#d4c5af]">
                            ${seg} (${items.length}個)
                        </span>
                        <div class="h-px flex-1 bg-[#d4c5af]"></div>
                    </div>
                `;
                groupContainer.appendChild(segHeader);

                // スーパーライク優先でソート
                items.sort((a, b) => {
                    if (a.isSuper && !b.isSuper) return -1;
                    if (!a.isSuper && b.isSuper) return 1;
                    return 0;
                });

                // 漢字カードグリッド（4列）
                const cardsGrid = document.createElement('div');
                cardsGrid.className = 'grid grid-cols-4 gap-3 mb-4';

                items.forEach(item => {
                    const card = document.createElement('div');
                    card.className = 'stock-card';
                    card.onclick = () => showDetailByData(item);

                    card.innerHTML = `
                        <div class="stock-kanji">${item['漢字']}</div>
                        <div class="stock-strokes">${item['画数']}画</div>
                        <div class="stock-position">${item.slot + 1}文字目</div>
                        ${item.isSuper ? '<div class="stock-stars">★</div>' : ''}
                    `;
                    cardsGrid.appendChild(card);
                });

                groupContainer.appendChild(cardsGrid);
            }
        });

        container.appendChild(groupContainer);
    });
}

/**
 * 読み方グループの折りたたみトグル
 */
function toggleReadingGroup(reading) {
    const group = document.getElementById(`group-${reading}`);
    const icon = document.getElementById(`icon-${reading}`);

    if (group && icon) {
        const isHidden = group.classList.contains('hidden');
        group.classList.toggle('hidden');
        icon.textContent = isHidden ? '▼' : '▶';
    }
}

// グローバルに公開
window.toggleReadingGroup = toggleReadingGroup;

/**
 * ビルド画面を開く
 */
function openBuild() {
    console.log("BUILD: Opening build screen");
    selectedPieces = [];
    renderBuildSelection();
    changeScreen('scr-build');
}

/**
 * ビルド選択画面のレンダリング
 */
function renderBuildSelection() {
    const container = document.getElementById('build-selection');
    if (!container) return;

    container.innerHTML = '';

    // 現在の読み方を取得
    const currentReading = segments.join('');

    // デバッグ情報
    console.log('=== BUILD DEBUG START ===');
    console.log('Current reading:', currentReading);
    console.log('Segments:', segments);
    console.log('Total liked items:', liked.length);
    console.log('Liked items:', liked.map(item => ({
        kanji: item['漢字'],
        slot: item.slot,
        sessionReading: item.sessionReading
    })));

    segments.forEach((seg, idx) => {
        const row = document.createElement('div');
        row.className = 'mb-6';

        row.innerHTML = `
            <div class="flex items-center justify-between mb-3">
                <p class="text-[11px] font-black text-[#bca37f] uppercase tracking-widest flex items-center gap-2">
                    <span class="bg-[#bca37f] text-white w-6 h-6 rounded-full flex items-center justify-center text-xs">${idx + 1}</span>
                    ${idx + 1}文字目: ${seg}
                </p>
                <div class="flex gap-2">
                    <button onclick="addMoreToSlot(${idx})" class="text-[10px] font-bold text-[#5d5444] hover:text-[#bca37f] transition-colors px-3 py-1 border border-[#bca37f] rounded-full bg-white">
                        + 追加する
                    </button>
                    <button onclick="reselectSlot(${idx})" class="text-[10px] font-bold text-[#a6967a] hover:text-[#bca37f] transition-colors px-3 py-1 border border-[#d4c5af] rounded-full">
                        ← 選び直す
                    </button>
                </div>
            </div>
        `;

        const scrollBox = document.createElement('div');
        scrollBox.className = 'flex overflow-x-auto pb-2 no-scrollbar gap-1';

        // このスロットの候補を取得（現在の読み方のものだけ）
        let items = liked.filter(item => {
            const slotMatch = item.slot === idx;
            const readingMatch = !item.sessionReading || item.sessionReading === currentReading;

            // デバッグ
            if (slotMatch) {
                console.log(`Slot ${idx} item:`, {
                    kanji: item['漢字'],
                    sessionReading: item.sessionReading,
                    currentReading: currentReading,
                    readingMatch: readingMatch
                });
            }

            return slotMatch && readingMatch;
        });

        console.log(`Slot ${idx} filtered items:`, items.length);

        // フィルタリング結果が0件だが、同じslotに他の読み方の候補がある場合
        const allSlotItems = liked.filter(item => item.slot === idx);
        console.log(`Slot ${idx} all items (any reading):`, allSlotItems.length);

        if (items.length === 0) {
            if (allSlotItems.length > 0) {
                // 他の読み方の候補がある
                scrollBox.innerHTML = `
                    <div class="text-[#bca37f] text-sm italic px-4 py-6">
                        他の読み方で選んだ候補：${allSlotItems.length}個<br>
                        <span class="text-xs text-[#a6967a] mt-2 block">「+ 追加する」で現在の読み方の候補を追加できます</span>
                    </div>
                `;
            } else {
                // 本当に候補がない
                scrollBox.innerHTML = '<div class="text-[#bca37f] text-sm italic px-4 py-6">候補なし（スワイプ画面で選んでください）</div>';
            }
        } else {
            items.sort((a, b) => {
                if (a.isSuper && !b.isSuper) return -1;
                if (!a.isSuper && b.isSuper) return 1;
                return 0;
            });

            if (prioritizeFortune && surnameData && surnameData.length > 0) {
                items = sortByFortune(items, idx);
            }

            items.forEach((item, itemIdx) => {
                const btn = document.createElement('button');
                btn.className = 'build-piece-btn';
                btn.setAttribute('data-slot', idx);
                btn.setAttribute('data-kanji', item['漢字']);
                btn.onclick = () => selectBuildPiece(idx, item, btn);

                let fortuneIndicator = '';
                if (prioritizeFortune && itemIdx < 3) {
                    const badges = ['🥇', '🥈', '🥉'];
                    fortuneIndicator = `<div class="text-lg mt-1">${badges[itemIdx]}</div>`;
                }

                btn.innerHTML = `
                    <div class="build-kanji-text">${item['漢字']}</div>
                    <div class="text-[10px] text-[#a6967a] font-bold mt-1">${item['画数']}画</div>
                    ${item.isSuper ? '<div class="text-[#8ab4f8] text-sm mt-1">★</div>' : ''}
                    ${fortuneIndicator}
                `;
                scrollBox.appendChild(btn);
            });
        }

        row.appendChild(scrollBox);
        container.appendChild(row);
    });

    // 運勢ランキングボタン（常に表示・名字未設定時はクリック時に警告）
    const rankingBtn = document.createElement('button');
    rankingBtn.className = 'w-full mt-8 mb-6 py-5 bg-gradient-to-r from-[#c7b399] to-[#bca37f] text-white font-black rounded-[30px] shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 text-lg';
    rankingBtn.innerHTML = '🏆 運勢ランキングTOP10を見る';
    rankingBtn.onclick = () => showFortuneRanking();
    container.appendChild(rankingBtn);

    console.log('=== BUILD DEBUG END ===');
}

/**
 * 指定した読み方のストックをすべて削除
 */
function deleteStockGroup(reading) {
    if (!confirm(`「${reading}」のストックをすべて削除しますか？\n（${liked.filter(i => i.sessionReading === reading).length}件）`)) {
        return;
    }

    // 該当する読み方のストックを除外
    const initialCount = liked.length;
    liked = liked.filter(item => item.sessionReading !== reading);

    if (liked.length < initialCount) {
        if (typeof saveLiked === 'function') {
            saveLiked();
        }

        // 履歴からも同期削除（ユーザー要望）
        try {
            const historyData = localStorage.getItem('meimay_reading_history');
            if (historyData) {
                let history = JSON.parse(historyData);
                const initialHistCount = history.length;
                // 読みが一致するものを削除
                history = history.filter(h => h.reading !== reading);

                if (history.length < initialHistCount) {
                    localStorage.setItem('meimay_reading_history', JSON.stringify(history));
                    console.log('BUILD: Synced history deletion for', reading);
                }
            }
        } catch (e) {
            console.error('BUILD: Failed to sync history deletion', e);
        }

        // 画面更新
        renderStock();
        alert('削除しました（関連する履歴も削除されました）');
    }
}

// グローバルに公開
window.deleteStockGroup = deleteStockGroup;

/**
 * 姓名判断による並び替え
 */
function sortByFortune(items, slotIndex) {
    if (!surnameData || surnameData.length === 0) return items;

    const scored = items.map(item => {
        const tempCombination = segments.map((seg, idx) => {
            if (idx === slotIndex) {
                return { kanji: item['漢字'], strokes: parseInt(item['画数']) || 0 };
            }
            const slotItems = liked.filter(i => i.slot === idx);
            if (slotItems.length > 0) {
                return { kanji: slotItems[0]['漢字'], strokes: parseInt(slotItems[0]['画数']) || 0 };
            }
            return { kanji: '', strokes: 1 };
        });

        let score = 0;
        if (typeof FortuneLogic !== 'undefined' && FortuneLogic.calculate) {
            const fortune = FortuneLogic.calculate(surnameData, tempCombination);
            if (fortune && fortune.so) {
                if (fortune.so.res.label === '大吉') score += 1000;
                else if (fortune.so.res.label === '吉') score += 500;
                else if (fortune.so.res.label === '中吉') score += 250;

                if (fortune.so.val === 24) score += 500;
                if (fortune.so.val === 31) score += 500;
                if (fortune.so.val === 32) score += 500;
            }
        }

        if (item.isSuper) score += 100;

        return { item, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.map(s => s.item);
}

/**
 * ビルドピース選択
 */
function selectBuildPiece(slot, data, btnElement) {
    console.log(`BUILD: Selected piece for slot ${slot}:`, data['漢字']);
    selectedPieces[slot] = data;

    const parent = btnElement.parentElement;
    parent.querySelectorAll('.build-piece-btn').forEach(btn => {
        btn.classList.remove('selected');
    });

    btnElement.classList.add('selected');

    const allSelected = selectedPieces.filter(x => x).length === segments.length;
    if (allSelected) {
        setTimeout(() => executeBuild(), 300);
    }
}

/**
 * ビルド実行
 */
function executeBuild() {
    console.log("BUILD: Executing build with selected pieces");

    currentBuildResult = {
        fullName: '',
        reading: '',
        fortune: null,
        combination: [],
        givenName: '',
        timestamp: null
    };

    const resultArea = document.getElementById('build-result-area');
    if (resultArea) resultArea.innerHTML = '';

    const givenName = selectedPieces.map(p => p['漢字']).join('');
    const fullName = surnameStr + givenName;
    const reading = segments.join('');

    const givArr = selectedPieces.map(p => ({
        kanji: p['漢字'],
        strokes: parseInt(p['画数']) || 0
    }));

    let fortune = null;
    if (typeof FortuneLogic !== 'undefined' && FortuneLogic.calculate) {
        if (surnameData && surnameData.length > 0) {
            fortune = FortuneLogic.calculate(surnameData, givArr);
        } else {
            const tempSurname = [{ kanji: '', strokes: 1 }];
            fortune = FortuneLogic.calculate(tempSurname, givArr);
        }
    }

    currentBuildResult = {
        fullName: fullName,
        reading: reading,
        fortune: fortune,
        combination: selectedPieces,
        givenName: givenName,
        timestamp: new Date().toISOString()
    };

    renderBuildResult();
}

/**
 * ビルド結果のレンダリング
 */
function renderBuildResult() {
    const container = document.getElementById('build-result-area');
    if (!container) return;

    const r = currentBuildResult;

    container.innerHTML = `
        <div class="glass-card rounded-[50px] p-8 mb-6 shadow-xl animate-fade-in">
            <h3 class="text-4xl font-black text-center mb-8 text-[#5d5444] tracking-tight leading-tight">${surnameStr ? surnameStr + ' ' : ''}${r.givenName}</h3>
            
            ${r.fortune ? `
                <div class="text-center mb-6 p-5 bg-gradient-to-br from-[#fdfaf5] to-white rounded-[30px]">
                    <div class="text-2xl font-black ${r.fortune.so.res.color} mb-1">
                        総格 ${r.fortune.so.val}画
                    </div>
                    <div class="text-lg font-bold ${r.fortune.so.res.color} mb-3">
                        ${r.fortune.so.res.label}
                    </div>
                    <button onclick="showFortuneDetail()" class="text-xs text-[#bca37f] font-bold border-b-2 border-[#bca37f] pb-1 hover:text-[#8b7e66] hover:border-[#8b7e66] transition-colors">
                        詳細な姓名判断を見る →
                    </button>
                </div>
            ` : ''}
            
            <div class="grid grid-cols-2 gap-3 mt-6">
                <button onclick="generateOrigin()" class="btn-gold py-3 text-sm">由来を生成</button>
                <button onclick="saveName()" class="btn-premium-select !mb-0 py-3 text-sm">保存する</button>
            </div>
        </div>
    `;
}

/**
 * 姓名判断詳細モーダル表示
 */
function showFortuneDetail() {
    const modal = document.getElementById('modal-fortune-detail');
    if (!modal || !currentBuildResult.fortune) return;

    const res = currentBuildResult.fortune;
    const name = currentBuildResult.fullName;
    const givens = currentBuildResult.combination.map(p => ({ kanji: p['漢字'], strokes: parseInt(p['画数']) || 0 }));

    const nLabel = document.getElementById('for-name');
    const container = document.getElementById('for-grid');

    if (!nLabel || !container) return;

    const getNum = (obj) => (obj ? (obj.num || obj.val || 0) : 0);

    nLabel.innerText = name;
    container.innerHTML = '';
    container.className = "flex flex-col w-full relative";

    const sur = (surnameStr || "").split('');
    const giv = givens.map(g => g.kanji);

    const unitH = 56;
    const surH = sur.length * unitH;
    const givH = giv.length * unitH;
    const midGap = 140;

    const isSingleSur = sur.length === 1;
    const isSingleGiv = giv.length === 1;

    const mapArea = document.createElement('div');
    mapArea.className = "mb-10 p-8 bg-white rounded-[50px] border border-[#eee5d8] shadow-sm animate-fade-in flex flex-col items-center";

    mapArea.innerHTML = `
        <div class="text-[11px] font-black text-[#5d5444] tracking-[0.3em] mb-14 opacity-60">姓名判断 鑑定図解</div>

        <div class="flex items-start justify-center gap-4 w-full max-w-[380px]">
            <div class="flex items-center self-stretch">
                <div class="flex flex-col items-center mr-1">
                    <div class="map-node-sharp bg-[#fdfaf5] border border-[#eee5d8] w-14 py-2 flex flex-col items-center shadow-inner">
                        <span class="text-xs font-black text-[#5d5444]">${getNum(res.gai)}画</span>
                        <span class="${res.gai.res.color} text-[9px] font-black">${res.gai.res.label}</span>
                    </div>
                    <span class="text-[8px] font-black text-[#a6967a] mt-1">外格</span>
                </div>
                <div class="relative w-3 self-stretch flex items-center">
                    <div class="absolute border-l-2 border-t-2 border-b-2 border-[#eee5d8] rounded-l-sm" 
                         style="top: 24px; bottom: 24px; left: 0; right: 0;"></div>
                </div>
            </div>

            <div class="flex flex-col items-center">
                <div class="flex flex-col gap-2">
                    ${sur.map(c => `<div class="w-12 h-12 flex items-center justify-center bg-[#fdfaf5] border border-[#eee5d8] font-black text-xl text-[#bca37f]">${c}</div>`).join('')}
                </div>
                <div style="height: ${midGap}px;" class="flex items-center justify-center opacity-10 text-xl font-thin select-none">/</div>
                <div class="flex flex-col gap-2">
                    ${giv.map(c => `<div class="w-12 h-12 flex items-center justify-center bg-white border border-[#bca37f] font-black text-xl text-[#5d5444] shadow-sm">${c}</div>`).join('')}
                </div>
            </div>

            <div class="flex flex-col self-stretch ml-2">
                <div class="relative flex items-center" style="height: ${surH}px;">
                    ${isSingleSur ? `<div class="absolute left-[-14px] top-1/2 -translate-y-1/2 w-4 h-0.5 bg-[#eee5d8]"></div>` : ''}
                    <div class="absolute left-0 border-r-2 border-t-2 border-b-2 border-[#eee5d8] rounded-r-sm" 
                         style="top: 24px; bottom: 16px; width: 8px;"></div>
                    <div class="flex flex-col items-center ml-5">
                        <div class="map-node-sharp bg-[#fdfaf5] border border-[#eee5d8] w-14 py-1.5 flex flex-col items-center">
                            <span class="text-[10px] font-black">${getNum(res.ten)}画</span>
                            <span class="${res.ten.res.color} text-[8px] font-black">${res.ten.res.label}</span>
                        </div>
                        <span class="text-[7px] font-black text-[#a6967a] mt-0.5">天格</span>
                    </div>
                </div>

                <div class="relative flex items-center justify-center" style="height: ${midGap}px;">
                    <div class="absolute left-0 border-r-2 border-t-2 border-b-2 border-[#bca37f] rounded-r-sm" 
                         style="top: -16px; bottom: -16px; width: 12px;"></div>
                    <div class="flex flex-col items-center ml-6">
                        <div class="map-node-sharp bg-white border-2 border-[#bca37f] w-14 py-1.5 flex flex-col items-center shadow-md">
                            <span class="text-[10px] font-black">${getNum(res.jin)}画</span>
                            <span class="${res.jin.res.color} text-[8px] font-black">${res.jin.res.label}</span>
                        </div>
                        <span class="text-[7px] font-black text-[#bca37f] mt-0.5">人格</span>
                    </div>
                </div>

                <div class="relative flex items-center" style="height: ${givH}px;">
                    ${isSingleGiv ? `<div class="absolute left-[-14px] top-1/2 -translate-y-1/2 w-4 h-0.5 bg-[#eee5d8]"></div>` : ''}
                    <div class="absolute left-0 border-r-2 border-t-2 border-b-2 border-[#eee5d8] rounded-r-sm" 
                         style="top: 16px; bottom: 24px; width: 8px;"></div>
                    <div class="flex flex-col items-center ml-5">
                        <div class="map-node-sharp bg-[#fdfaf5] border border-[#eee5d8] w-14 py-1.5 flex flex-col items-center">
                            <span class="text-[10px] font-black">${getNum(res.chi)}画</span>
                            <span class="${res.chi.res.color} text-[8px] font-black">${res.chi.res.label}</span>
                        </div>
                        <span class="text-[7px] font-black text-[#a6967a] mt-0.5">地格</span>
                    </div>
                </div>
            </div>
        </div>

        <div class="mt-12 w-full pt-8 border-t border-[#eee5d8] flex flex-col items-center">
            <span class="text-[10px] font-black text-[#a6967a] mb-3 uppercase tracking-widest">総格（総合運）</span>
            <div class="bg-white border border-[#5d5444] px-10 py-3 flex items-center gap-5 map-node-sharp shadow-sm">
                <span class="text-3xl font-black text-[#5d5444]">${getNum(res.so)} <span class="text-xs font-bold ml-1">画</span></span>
                <div class="w-[1px] h-6 bg-[#eee5d8]"></div>
                <span class="${res.so.res.color} text-base font-black">${res.so.res.label}</span>
            </div>
        </div>
    `;
    container.appendChild(mapArea);

    if (res.sansai) {
        const sansai = document.createElement('div');
        sansai.className = "mb-8 bg-[#fdfaf5] p-6 rounded-[40px] border border-[#eee5d8] shadow-inner animate-fade-in";
        sansai.innerHTML = `
            <div class="flex justify-between items-center mb-5 px-1 relative">
                <div class="flex items-center gap-2">
                    <span class="text-[10px] font-black text-[#bca37f] tracking-widest uppercase">五行・三才配置</span>
                    <button onclick="showFortuneTerm('五行・三才')" class="w-5 h-5 bg-[#bca37f] text-white rounded-full text-[10px] flex items-center justify-center shadow-sm hover:bg-[#a6967a] transition-colors">?</button>
                </div>
                <span class="px-4 py-1 bg-white rounded-full text-[10px] font-black ${res.sansai.label === '大吉' ? 'text-amber-600' : 'text-[#5d5444]'} shadow-sm">
                    ${res.sansai.label}
                </span>
            </div>
            <div class="flex gap-2 items-center mb-5 px-1">
                ${['t', 'j', 'c'].map(k => `<div class="flex-grow bg-white py-2.5 rounded-2xl border border-[#eee5d8] text-center shadow-sm"><div class="text-[8px] font-bold text-[#a6967a] mb-0.5">${k === 't' ? '天' : k === 'j' ? '人' : '地'}</div><div class="text-sm font-black text-[#5d5444]">${res.sansai[k] || '-'}</div></div>`).join('<div class="text-[#eee5d8] text-[8px]">▶</div>')}
            </div>
            <p class="text-[13px] leading-relaxed text-[#5d5444] font-medium text-center px-2">${res.sansai.desc || ''}</p>
        `;
        container.appendChild(sansai);
    }

    renderFortuneDetails(container, res, getNum);

    // for-descをクリア（候補を表示しない）
    const descEl = document.getElementById('for-desc');
    if (descEl) descEl.innerHTML = '';

    modal.classList.add('active');
}

/**
 * 用語解説を表示
 */
function showFortuneTerm(term) {
    const terms = {
        "天格": "【天格（祖先運）】\n祖先から代々受け継がれてきた姓の画数です。家系全体に流れる宿命や職業的な傾向を表しますが、あなた個人の吉凶への直接的な影響は少ないとされています。",
        "人格": "【人格（主運）】\n姓の最後と名の最初の文字を足した画数です。「主運」とも呼ばれ、その人の内面的な性格や才能、長所・短所を表します。また、人生の中盤（20代後半〜50代）の運勢を司る、姓名判断において最も重要な核となる部分です。",
        "地格": "【地格（初年運）】\n名前の画数の合計です。生まれ持った体質や才能、性格の基礎を表します。誕生から30歳前後までの「初年期」の運勢に強く影響し、成長過程での対人関係や愛情運にも関わります。",
        "外格": "【外格（対人運）】\n総格から人格を引いた画数で、家族や職場、友人など「外側」との関係性を示します。対人関係の傾向や、周囲からどのような援助や評価を得られるかを表し、社会的成功に影響します。",
        "総格": "【総格（総合運）】\n姓と名のすべての画数を合計したものです。人生の全体的な運勢や生涯を通じてのエネルギーを表します。特に50歳以降の「晩年期」にその影響が強く現れ、人生の最終的な幸福度や充実度を左右します。",
        "五行・三才": "【五行・三才配置】\n自然界の要素（木・火・土・金・水）のバランスで運気を読み解くものです。天格・人格・地格の相性が良いと、持って生まれた運勢がスムーズに発揮され、精神的な安定や予期せぬ幸運に恵まれやすくなるとされています。"
    };
    alert(terms[term] || term);
}

/**
 * 詳細リスト描画
 */
function renderFortuneDetails(container, res, getNum) {
    const items = [
        { k: "天格", d: res.ten, icon: "🏛️" },
        { k: "人格", d: res.jin, icon: "💎" },
        { k: "地格", d: res.chi, icon: "🌱" },
        { k: "外格", d: res.gai, icon: "🌍" },
        { k: "総格", d: res.so, icon: "🏆" }
    ];
    items.forEach(p => {
        if (!p.d) return;

        // 【天格】などの表記を削除
        const descText = (p.d.role || p.d.res.desc || "").replace(/^【.+?】\s*/, '');

        const row = document.createElement('div');
        row.className = "flex items-center gap-4 mb-3 w-full animate-fade-in";
        row.innerHTML = `
            <div class="relative w-24 flex-shrink-0 bg-[#fdfaf5] border border-[#eee5d8] rounded-2xl py-3 flex flex-col items-center justify-center shadow-sm h-24 group">
                <button onclick="showFortuneTerm('${p.k}')" class="absolute -top-2 -right-2 w-5 h-5 bg-[#bca37f] text-white rounded-full text-[10px] flex items-center justify-center shadow-md z-10 hover:bg-[#a6967a] transition-colors">?</button>
                <div class="text-[10px] font-bold text-[#a6967a] mb-1 uppercase tracking-tighter flex items-center gap-1"><span>${p.icon}</span>${p.k}</div>
                <div class="text-2xl font-black text-[#5d5444] mb-1">${getNum(p.d)}</div>
                <div class="${p.d.res.color} text-xs font-black">${p.d.res.label}</div>
            </div>
            <div class="flex-grow bg-white border border-dashed border-[#eee5d8] rounded-2xl px-4 py-3 flex items-center shadow-sm min-h-[96px]">
                <div class="text-[13px] leading-relaxed text-[#5d5444] font-medium text-justify">
                    ${descText}
                </div>
            </div>
        `;
        container.appendChild(row);
    });
}

/**
 * 姓名判断詳細モーダルを閉じる
 */
function closeFortuneDetail() {
    const modal = document.getElementById('modal-fortune-detail');
    if (modal) modal.classList.remove('active');
}

/**
 * 運勢ランキングを表示
 */
function showFortuneRanking() {
    console.log("BUILD: Showing fortune ranking");

    // Fallback: 念のためここで再取得
    if ((!surnameData || surnameData.length === 0) && typeof updateSurnameData === 'function') {
        updateSurnameData();
    }

    if (!surnameData || surnameData.length === 0) {
        alert('名字を入力してください');
        return;
    }
    const allCombinations = generateAllCombinations();
    if (allCombinations.length === 0) {
        alert('候補が不足しています。各文字で最低1つ以上選んでください。');
        return;
    }
    const ranked = allCombinations.map(combo => {
        const givArr = combo.pieces.map(p => ({
            kanji: p['漢字'],
            strokes: parseInt(p['画数']) || 0
        }));
        const fortune = FortuneLogic.calculate(surnameData, givArr);
        let score = 0;
        if (fortune) {
            // 吉凶のスコア化関数
            const getLuckScore = (label) => {
                if (label === '大吉') return 1000;
                if (label === '吉') return 500;
                if (label === '中吉') return 300;
                if (label === '小吉') return 100;
                if (label === '末吉') return 50;
                if (label === '凶') return -500;
                if (label === '大凶') return -1000;
                return 0;
            };

            // 五格の重み付け加算
            // 総格(x2.0): 最も重要
            // 人格(x1.5): 主運、性格、中年期
            // 地格(x1.2): 初年運、基礎
            // 外格(x1.0): 対人運
            // 天格(x0.5): 祖先運（自分では変えられないため影響度低め）
            score += getLuckScore(fortune.so.res.label) * 2.0;
            score += getLuckScore(fortune.jin.res.label) * 1.5;
            score += getLuckScore(fortune.chi.res.label) * 1.2;
            score += getLuckScore(fortune.gai.res.label) * 1.0;
            score += getLuckScore(fortune.ten.res.label) * 0.5;

            // 三才配置（バランス）ボーナス
            if (fortune.sansai) {
                if (fortune.sansai.label === '大吉') score += 1500;
                else if (fortune.sansai.label === '吉') score += 800;
                else if (fortune.sansai.label === '中吉') score += 300;
            }

            // 特殊画数ボーナス（総格）
            const val = fortune.so.val;
            if ([15, 16, 21, 23, 24, 31, 32, 41, 45].includes(val)) score += 500;
        }

        const superCount = combo.pieces.filter(p => p.isSuper).length;
        score += superCount * 100; // Superボーナスは少し控えめに
        return { combination: combo, fortune: fortune, score: score };
    });
    ranked.sort((a, b) => b.score - a.score);
    displayFortuneRankingModal(ranked.slice(0, 10));
}

/**
 * 全組み合わせを生成
 */
function generateAllCombinations() {
    const currentReading = segments.join('');
    const slotArrays = segments.map((seg, idx) => {
        return liked.filter(item => item.slot === idx && (!item.sessionReading || item.sessionReading === currentReading));
    });
    if (slotArrays.some(arr => arr.length === 0)) return [];

    function combine(arrays, current = []) {
        if (current.length === arrays.length) return [current];
        const results = [];
        const nextArray = arrays[current.length];
        for (const item of nextArray) {
            results.push(...combine(arrays, [...current, item]));
        }
        return results;
    }
    const combinations = combine(slotArrays);
    return combinations.map(pieces => ({
        pieces: pieces,
        name: pieces.map(p => p['漢字']).join(''),
        reading: segments.join('')
    }));
}

/**
 * 運勢ランキングモーダルを表示
 */
function displayFortuneRankingModal(rankedList) {
    const modal = document.getElementById('modal-fortune-detail');
    if (!modal) return;

    const nameEl = document.getElementById('for-name');
    const gridEl = document.getElementById('for-grid');
    const descEl = document.getElementById('for-desc');

    nameEl.innerText = '🏆 運勢ランキング TOP10';
    gridEl.innerHTML = '<p class="text-sm text-center text-[#a6967a] mb-4">タップして選択すると自動的に反映されます</p>';
    descEl.innerHTML = '';

    rankedList.forEach((item, index) => {
        const fullName = surnameStr + item.combination.name;
        const f = item.fortune;
        const card = document.createElement('div');
        card.className = 'mb-3 p-5 bg-white rounded-3xl border-2 cursor-pointer hover:shadow-xl transition-all active:scale-98';

        if (index === 0) card.classList.add('border-[#bca37f]', 'bg-gradient-to-br', 'from-[#fdfaf5]', 'to-[#f8f5ef]');
        else if (index === 1) card.classList.add('border-[#d4c5af]', 'bg-gradient-to-br', 'from-[#fdfaf5]', 'to-white');
        else if (index === 2) card.classList.add('border-[#e5dfd5]', 'bg-gradient-to-br', 'from-white', 'to-[#fdfaf5]');
        else card.classList.add('border-[#eee5d8]');

        card.onclick = () => applyRankedCombination(item.combination);

        const medals = ['🥇', '🥈', '🥉'];
        const medal = medals[index] || `${index + 1}位`;

        card.innerHTML = `
            <div class="flex items-start justify-between mb-3">
                <div class="flex items-start gap-3">
                    <span class="text-3xl">${medal}</span>
                    <div>
                        <div class="text-2xl font-black text-[#5d5444] mb-1">${fullName}</div>
                        <div class="text-xs text-[#a6967a] mb-2">${item.combination.reading}</div>
                        <div class="flex gap-1.5 flex-wrap">
                            <span class="px-2 py-0.5 bg-white rounded-full text-[10px] font-bold ${f.ten.res.color} border border-[#eee5d8]">天:${f.ten.res.label}</span>
                            <span class="px-2 py-0.5 bg-white rounded-full text-[10px] font-bold ${f.jin.res.color} border border-[#eee5d8]">人:${f.jin.res.label}</span>
                            <span class="px-2 py-0.5 bg-white rounded-full text-[10px] font-bold ${f.chi.res.color} border border-[#eee5d8]">地:${f.chi.res.label}</span>
                            <span class="px-2 py-0.5 bg-white rounded-full text-[10px] font-bold ${f.gai.res.color} border border-[#eee5d8]">外:${f.gai.res.label}</span>
                        </div>
                    </div>
                </div>
                <div class="text-right flex-shrink-0">
                    <div class="text-3xl font-black ${f.so.res.color}">${f.so.val}</div>
                    <div class="text-sm font-bold ${f.so.res.color}">${f.so.res.label}</div>
                </div>
            </div>
        `;
        descEl.appendChild(card);
    });

    // const closeBtn = modal.querySelector('button[onclick*="closeFortuneDetail"]');
    // if (closeBtn) closeBtn.innerText = '閉じる';
    modal.classList.add('active');
}

/**
 * ランキングから選んだ組み合わせを適用
 */
function applyRankedCombination(combination) {
    console.log("BUILD: Applying ranked combination", combination);
    selectedPieces = [];
    document.querySelectorAll('.build-piece-btn').forEach(btn => {
        btn.classList.remove('selected');
    });

    combination.pieces.forEach((piece, idx) => {
        selectedPieces[idx] = piece;
        const targetBtn = document.querySelector(`.build-piece-btn[data-slot="${idx}"][data-kanji="${piece['漢字']}"]`);
        if (targetBtn) targetBtn.classList.add('selected');
    });

    closeFortuneDetail();
    setTimeout(() => executeBuild(), 100);
}

/**
 * スロットを選び直す
 */
function reselectSlot(slotIdx) {
    if (confirm(`${slotIdx + 1}文字目「${segments[slotIdx]}」を選び直しますか？\n現在の選択がリセットされます。`)) {
        liked = liked.filter(item => item.slot !== slotIdx);
        const toRemove = [];
        liked.forEach(item => { if (item.slot === slotIdx) toRemove.push(item['漢字']); });
        toRemove.forEach(kanji => seen.delete(kanji));

        // 組み立て済み名前を削除
        currentBuildResult = {
            fullName: "",
            reading: "",
            fortune: null,
            combination: [],
            givenName: "",
            timestamp: null
        };

        // ビルド結果表示をクリア
        const resultArea = document.getElementById('build-result-area');
        if (resultArea) resultArea.innerHTML = '';

        currentPos = slotIdx;
        currentIdx = 0;
        if (typeof loadStack === 'function') loadStack();
        changeScreen('scr-main');

        // フッターを明示的に表示（消える問題の対策）
        const nav = document.querySelector('.nav-bar');
        if (nav) nav.style.display = 'flex';

        console.log(`BUILD: Reselecting slot ${slotIdx}, cleared build result`);
    }
}

/**
 * スロットに追加で漢字を探す（現在の選択を保持）
 */
function addMoreToSlot(slotIdx) {
    currentPos = slotIdx;
    currentIdx = 0;
    if (typeof loadStack === 'function') loadStack();
    changeScreen('scr-main');

    // フッターを明示的に表示（消える問題の対策）
    const nav = document.querySelector('.nav-bar');
    if (nav) nav.style.display = 'flex';

    console.log(`BUILD: Adding more to slot ${slotIdx} (keeping current selections)`);
}

/**
 * ビルド選択をクリア（読み方変更時などに使用）
 */
function clearBuildSelection() {
    selectedPieces = [];
    currentBuildResult = {
        fullName: "",
        reading: "",
        fortune: null,
        combination: [],
        givenName: "",
        timestamp: null
    };

    // ビルド結果表示エリアをクリア
    const resultArea = document.getElementById('build-result-area');
    if (resultArea) resultArea.innerHTML = '';

    console.log("BUILD: Selection cleared");
}

// ============================================================
// GLOBAL SCOPE EXPOSURE (HTML onclick用)
// ============================================================
window.openStock = openStock;
window.openBuild = openBuild;
window.showFortuneDetail = showFortuneDetail;
window.closeFortuneDetail = closeFortuneDetail;
window.showFortuneRanking = showFortuneRanking;
window.reselectSlot = reselectSlot;
window.addMoreToSlot = addMoreToSlot;
window.clearBuildSelection = clearBuildSelection;
window.showFortuneTerm = showFortuneTerm;

console.log("BUILD: Module loaded");
