/* ============================================================
   MODULE 07: BUILD (V15.0 - ビルド画面に読み方/自由モード統合)
   ビルド画面・名前構築・姓名判断表示
   ============================================================ */

let selectedPieces = [];
let buildMode = 'reading'; // 'reading' | 'free'

/**
 * ストック画面を開く
 */
let currentStockTab = 'kanji';

function openStock(tab) {
    console.log("BUILD: Opening stock screen");
    renderStock();
    changeScreen('scr-stock');
    switchStockTab(tab || currentStockTab || 'kanji');
}

/**
 * 自由ビルド：ビルド画面を自由モードで開く
 */
function openFreeBuild() {
    console.log('BUILD: openFreeBuild → scr-build/free-mode');
    if (!liked || liked.length === 0) {
        if (typeof showToast === 'function') showToast('まずスワイプで漢字をストックしてください', '📦');
        return;
    }
    buildMode = 'free';
    fbChoices = [];
    shownFbSlots = 1;
    selectedPieces = [];
    renderBuildSelection();
    changeScreen('scr-build');
}

/**
 * ストック画面に自由ビルドセクションを描画する
 * 1文字目〜最大3文字目まで横スクロールで漢字を選べる
 */
let fbChoices = []; // ['漢字1', '漢字2', ...]  選択済み
let shownFbSlots = 1; // 自由モードで表示するスロット数（追加ボタンで増える）

function renderFreeBuildSection() {
    const container = document.getElementById('free-build-section');
    if (!container) return;

    // ストックから重複なし全漢字を取得
    const allKanji = [];
    const seen = new Set();
    liked.forEach(item => {
        if (!seen.has(item['漢字'])) {
            seen.add(item['漢字']);
            allKanji.push(item);
        }
    });

    if (allKanji.length === 0) {
        container.innerHTML = '<div class="text-center py-10 text-[#a6967a] text-sm">ストックがありません</div>';
        return;
    }

    // 各文字スロットのHTML
    let html = '';
    const maxSlots = 3;
    const shownSlots = Math.max(1, fbChoices.length + (fbChoices.length < maxSlots ? 1 : 0));

    for (let slotIdx = 0; slotIdx < shownSlots; slotIdx++) {
        const label = `${slotIdx + 1}文字目`;
        const selected = fbChoices[slotIdx] || null;

        html += `
            <div class="mb-4">
                <div class="flex items-center justify-between mb-2">
                    <span class="text-xs font-bold text-[#8b7e66]">${label}</span>
                    ${selected ? `<span class="text-xs text-[#a6967a] cursor-pointer hover:text-[#f28b82]" onclick="removeFbChoice(${slotIdx})">✕ 解除</span>` : ''}
                </div>
                
                <div class="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                    ${allKanji.map(item => {
            const k = item['漢字'];
            const isSelected = selected === k;
            const isUsed = fbChoices.includes(k) && fbChoices[slotIdx] !== k;
            return `<button onclick="selectFbKanji(${slotIdx}, '${k}')"
                            class="shrink-0 w-14 h-14 rounded-2xl border-2 flex flex-col items-center justify-center text-xl font-black transition-all active:scale-90
                            ${isSelected ? 'border-[#bca37f] bg-[#fffbeb] text-[#bca37f] ring-2 ring-[#bca37f]/30' :
                    isUsed ? 'border-[#ede5d8] bg-[#f8f5ef] text-[#c8b99a] opacity-50' :
                        'border-[#ede5d8] bg-white text-[#5d5444] hover:border-[#bca37f]'}">
                            ${k}
                        </button>`;
        }).join('')}
                </div>
            </div>
        `;
    }

    // 運勢ランキング（名前が1文字以上選ばれたら表示）
    let fortuneHtml = '';
    if (fbChoices.length >= 1) {
        const givenName = fbChoices.join('');
        const givenReading = fbChoices.map(k => {
            const item = liked.find(l => l['漢字'] === k);
            return item?.sessionSegments?.[item.slot] || item?.sessionReading || k;
        }).join('');
        fortuneHtml = `
            <div class="mt-4 border-t border-[#ede5d8] pt-4">
                <p class="text-xs font-bold text-[#8b7e66] mb-3">🔮 運勢ランキング（${givenName}）</p>
                <div id="fb-fortune-area" class="space-y-2">
                    ${renderFbFortune(fbChoices)}
                </div>
                <button onclick="confirmFbBuild()" class="btn-gold py-4 shadow-xl w-full mt-4">
                    この名前で詳細を見る →
                </button>
            </div>
        `;
    }

    container.innerHTML = html + fortuneHtml;
}

// 漢字を選択（選び直しても他のスロットは保持）
function selectFbKanji(slotIdx, kanji) {
    fbChoices[slotIdx] = kanji;
    // 後ろのスロットは保持する（明示的に「解除」ボタンで削除するまで残す）
    const scrollPositions = [];
    document.querySelectorAll('.overflow-x-auto').forEach(el => scrollPositions.push(el.scrollLeft));
    renderFreeBuildSection();
    requestAnimationFrame(() => {
        document.querySelectorAll('.overflow-x-auto').forEach((el, i) => {
            if (scrollPositions[i] !== undefined) el.scrollLeft = scrollPositions[i];
        });
    });
}

// 選択を解除
function removeFbChoice(slotIdx) {
    fbChoices.splice(slotIdx, 1);
    const scrollPositions = [];
    document.querySelectorAll('.overflow-x-auto').forEach(el => scrollPositions.push(el.scrollLeft));
    renderFreeBuildSection();
    requestAnimationFrame(() => {
        document.querySelectorAll('.overflow-x-auto').forEach((el, i) => {
            if (scrollPositions[i] !== undefined) el.scrollLeft = scrollPositions[i];
        });
    });
}

// 運勢ランキングHTML（姓名判断を適用）
function renderFbFortune(choices) {
    if (typeof surnameData === 'undefined' || !surnameData || surnameData.length === 0) {
        return '<p class="text-[10px] text-[#a6967a]">姓名判断するには名字を設定してください</p>';
    }
    if (typeof calcFortune !== 'function') {
        return '<p class="text-[10px] text-[#a6967a]">姓名判断機能が読み込まれていません</p>';
    }
    try {
        const givenStrokes = choices.map(k => {
            const item = master?.find(m => m['漢字'] === k);
            return item ? parseInt(item['画数']) || 1 : 1;
        });
        const surnameStrokes = surnameData.map(s => parseInt(s['画数']) || 1);
        const result = calcFortune(surnameStrokes, givenStrokes);
        if (!result) return '<p class="text-[10px] text-[#a6967a]">運勢の計算中...</p>';

        const ranks = [
            { label: '天格', value: result.tenkaku },
            { label: '地格', value: result.chikaku },
            { label: '人格', value: result.jinkaku },
            { label: '外格', value: result.gaikaku },
            { label: '総格', value: result.sokaku },
        ];

        return ranks.map(r => {
            const fortune = r.value?.fortune || '—';
            const color = fortune === '大吉' ? 'text-red-500' : fortune === '吉' ? 'text-[#bca37f]' : 'text-[#8b7e66]';
            return `<div class="flex justify-between items-center px-1">
                <span class="text-xs text-[#8b7e66] font-bold">${r.label}</span>
                <span class="text-xs font-black ${color}">${fortune}</span>
            </div>`;
        }).join('');
    } catch (e) {
        return '<p class="text-[10px] text-[#a6967a]">運勢の計算に失敗しました</p>';
    }
}

// 自由ビルド確定
function confirmFbBuild() {
    const givenName = fbChoices.join('');
    if (!givenName) return;
    const combination = fbChoices.map(k =>
        liked.find(l => l['漢字'] === k) || master?.find(m => m['漢字'] === k) || { '漢字': k, '画数': 1 }
    );
    const givenReading = fbChoices.map(k => {
        const item = liked.find(l => l['漢字'] === k);
        return item?.sessionSegments?.[item.slot] || item?.sessionReading || k;
    }).join('');
    if (typeof openSaveScreen === 'function') {
        openSaveScreen(combination, givenName, givenReading);
    } else {
        showToast(`${givenName} でビルドします`, '✨');
    }
}

function switchStockTab(tab) {
    currentStockTab = tab;

    const readingTab = document.getElementById('stock-tab-reading');
    const kanjiTab = document.getElementById('stock-tab-kanji');
    const readingPanel = document.getElementById('reading-stock-panel');
    const kanjiPanel = document.getElementById('stock-kanji-panel');
    const shareBtn = document.querySelector('.partner-share-btn');

    // シェアボタンの表示制御
    if (shareBtn) {
        shareBtn.classList.toggle('hidden', !(typeof shareMode !== 'undefined' && shareMode === 'manual'));
    }

    // 全タブ/パネルを非アクティブに
    const allTabs = [readingTab, kanjiTab];
    const allPanels = [readingPanel, kanjiPanel];
    allTabs.forEach(t => t && (t.className = 'flex-1 py-3 text-sm font-bold text-center border-b-2 border-transparent text-[#a6967a]'));
    allPanels.forEach(p => p && p.classList.add('hidden'));

    if (tab === 'reading') {
        if (readingTab) readingTab.className = 'flex-1 py-3 text-sm font-bold text-center border-b-2 border-[#bca37f] text-[#5d5444]';
        if (readingPanel) readingPanel.classList.remove('hidden');
        if (typeof renderReadingStockSection === 'function') renderReadingStockSection();
    } else {
        // kanji (default)
        if (kanjiTab) kanjiTab.className = 'flex-1 py-3 text-sm font-bold text-center border-b-2 border-[#bca37f] text-[#5d5444]';
        if (kanjiPanel) kanjiPanel.classList.remove('hidden');
    }
}

window.switchStockTab = switchStockTab;

/**
 * ストック一覧のレンダリング（読み方別・重複排除）
 * セグメント読み（はる / と / き）単位でグループ化し、
 * 同じ漢字は複数の読みセッションをまたいで1回だけ表示する
 */
function renderStock() {
    const container = document.getElementById('stock-list');
    if (!container) return;

    container.innerHTML = '';

    // SEARCH/slot<0 を除いた有効アイテムのみ対象 (FREEは含める)
    const validItems = liked.filter(item => {
        if (item.sessionReading === 'FREE') return true;
        return item.slot >= 0 && item.sessionReading !== 'SEARCH';
    });

    if (validItems.length === 0) {
        container.innerHTML = `
    <div class="col-span-5 text-center py-20" >
                <p class="text-[#bca37f] italic text-lg mb-2">まだストックがありません</p>
                <p class="text-sm text-[#a6967a]">スワイプ画面で漢字を選びましょう</p>
            </div>
    `;
        return;
    }

    // 履歴からセグメント情報を取得
    const history = typeof getReadingHistory === 'function' ? getReadingHistory() : [];
    const readingToSegments = {};
    history.forEach(h => { readingToSegments[h.reading] = h.segments; });

    // セグメント読みでグループ化（重複排除）
    const segGroups = {}; // { "はる": [item, ...], "と": [...] }
    validItems.forEach(item => {
        // 1. 自身のデータに保存されたセグメント配列を優先 (v23.9以降)
        // 2. 履歴からのセグメント参照
        // 3. 古いデータで履歴にもない場合は、完全な読み方(sessionReading)をフォールバックとして使用。
        // （現在のグローバル segments へのフォールバックは他人の読みに混入するバグの元なので廃止）

        let segRaw = '不明';
        if (item.sessionReading === 'FREE') {
            segRaw = 'FREE';
        } else if (item.sessionSegments && item.sessionSegments[item.slot]) {
            segRaw = item.sessionSegments[item.slot];
        } else if (readingToSegments[item.sessionReading] && readingToSegments[item.sessionReading][item.slot]) {
            segRaw = readingToSegments[item.sessionReading][item.slot];
        } else if (item.sessionReading) {
            segRaw = item.sessionReading; // 読み全体をそのままグループ名にする
        }

        const seg = segRaw;
        if (!segGroups[seg]) segGroups[seg] = [];

        const dup = segGroups[seg].find(e => e['漢字'] === item['漢字']);
        if (!dup) {
            segGroups[seg].push(item);
        } else if (item.isSuper && !dup.isSuper) {
            // スーパーライクで上書き
            dup.isSuper = true;
        }
    });

    // グループキーをソート（FREEは必ず最後に配置する）
    const sortedKeys = Object.keys(segGroups).sort((a, b) => {
        if (a === 'FREE') return 1;
        if (b === 'FREE') return -1;
        return a.localeCompare(b, 'ja');
    });

    // セグメントごとに表示
    sortedKeys.forEach(seg => {
        const items = segGroups[seg];
        if (items.length === 0) return;

        // スーパーライク優先ソート
        items.sort((a, b) => {
            if (a.isSuper && !b.isSuper) return -1;
            if (!a.isSuper && b.isSuper) return 1;
            return 0;
        });

        // 識別用の安全なID生成
        const safeId = seg === 'FREE' ? 'FREE' : encodeURIComponent(seg).replace(/%/g, '');

        // セグメントヘッダー
        const segHeader = document.createElement('div');
        segHeader.className = 'col-span-5 mt-6 mb-3 cursor-pointer select-none active:scale-95 transition-transform group';
        segHeader.onclick = () => toggleReadingGroup(safeId);
        segHeader.innerHTML = `
    <div class="flex items-center gap-3" >
                <div class="h-px flex-1 bg-[#d4c5af]"></div>
                <span class="text-base font-black text-[#bca37f] px-4 py-1.5 bg-white rounded-full border border-[#d4c5af] flex items-center gap-2 shadow-sm group-hover:bg-[#f8f5ef] transition-colors">
                    <span id="icon-${safeId}" class="text-xs transition-transform">▼</span>
                    ${seg} <span class="text-xs ml-1 text-[#a6967a]">(${items.length}個)</span>
                </span>
                <div class="h-px flex-1 bg-[#d4c5af]"></div>
            </div>
    `;
        container.appendChild(segHeader);

        // 5列グリッド
        const cardsGrid = document.createElement('div');
        cardsGrid.id = `group-${safeId}`;
        cardsGrid.className = 'col-span-5 grid grid-cols-5 gap-2 mb-4 transition-all duration-300 transform origin-top';

        items.forEach(item => {
            const card = document.createElement('div');
            card.className = 'stock-card relative';
            card.onclick = () => showDetailByData(item);

            // Hydrate values from master if missing (due to data minification)
            let displayStrokes = item['画数'];
            if (displayStrokes === undefined && typeof master !== 'undefined') {
                const m = master.find(k => k['漢字'] === item['漢字']);
                if (m) displayStrokes = m['画数'];
            }

            card.innerHTML = `
                ${item.fromPartner ? `<div class="absolute -top-1.5 -right-1.5 bg-gradient-to-r from-[#f28b82] to-[#f4978e] text-white text-[8px] px-1.5 py-0.5 rounded-full shadow-sm z-10 break-keep leading-none flex items-center">👩</div>` : ''}
                ${item.isSuper ? '<div class="stock-stars">★</div>' : ''}
                <div class="stock-kanji">${item['漢字']}</div>
                <div class="stock-strokes">${displayStrokes !== undefined ? displayStrokes : '？'}画</div>
`;
            cardsGrid.appendChild(card);
        });

        container.appendChild(cardsGrid);
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
    window._addMoreFromBuild = false; // addMoreToSlot フラグをクリア
    selectedPieces = [];
    buildMode = 'reading';
    fbChoices = [];
    renderBuildSelection();
    changeScreen('scr-build');
}

/**
 * 自由に選ぶモード完了後にビルド画面を自由組み立てモードで開く
 */
function openBuildFreeMode() {
    console.log("BUILD: Opening build screen in free mode");
    window._addMoreFromBuild = false;
    selectedPieces = [];
    buildMode = 'free';
    fbChoices = [];
    shownFbSlots = 1;
    renderBuildSelection();
    changeScreen('scr-build');
}
window.openBuildFreeMode = openBuildFreeMode;

/**
 * ビルドモードを切り替える
 */
function setBuildMode(mode) {
    const prevMode = buildMode;
    buildMode = mode;
    // モードが実際に切り替わる場合のみ選択状態をリセット
    // （すでにfreeモードの場合はfbChoices/shownFbSlotsを保持）
    if (prevMode !== mode || mode === 'reading') {
        fbChoices = [];
        if (mode === 'free') shownFbSlots = 1;
        selectedPieces = [];
    }
    const resultArea = document.getElementById('build-result-area');
    if (resultArea) resultArea.innerHTML = '';
    renderBuildSelection();
}
window.setBuildMode = setBuildMode;

/**
 * ビルド選択画面のレンダリング
 */
function renderBuildSelection() {
    const container = document.getElementById('build-selection');
    if (!container) return;

    container.innerHTML = '';

    // 現在の読み方を取得
    const currentReading = segments.join('');

    // モード切り替えタブ（読み方ボタンはドロップダウンで読みストック選択）
    const modeBar = document.createElement('div');
    modeBar.className = 'relative flex gap-2 mb-5';
    modeBar.innerHTML = `
        <button onclick="toggleReadingDropdown()" id="reading-mode-btn"
            class="flex-1 py-2.5 rounded-full text-sm font-bold transition-all ${buildMode === 'reading'
            ? 'bg-[#bca37f] text-white shadow-md'
            : 'bg-white border border-[#d4c5af] text-[#a6967a] hover:border-[#bca37f]'}">
            ${currentReading ? `📖 ${currentReading} ▾` : '📖 読み方 ▾'}
        </button>
        <button onclick="setBuildMode('free')"
            class="flex-1 py-2.5 rounded-full text-sm font-bold transition-all ${buildMode === 'free'
            ? 'bg-[#bca37f] text-white shadow-md'
            : 'bg-white border border-[#d4c5af] text-[#a6967a] hover:border-[#bca37f]'}">
            ✨ 自由組み立て
        </button>
        <div id="reading-dropdown" class="absolute top-full left-0 w-1/2 z-50 hidden bg-white border border-[#ede5d8] rounded-2xl shadow-xl mt-1 max-h-60 overflow-y-auto"></div>
    `;
    container.appendChild(modeBar);

    // 自由モードはフリービルドUIを表示
    if (buildMode === 'free') {
        renderBuildFreeMode(container);
        return;
    }

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
    <div class="flex items-center justify-between mb-3" >
                <p class="text-[11px] font-black text-[#bca37f] uppercase tracking-widest flex items-center gap-2">
                    <span class="bg-[#bca37f] text-white w-6 h-6 rounded-full flex items-center justify-center text-xs">${idx + 1}</span>
                    ${idx + 1}文字目: ${seg}
                </p>
                <div class="flex gap-2">
                    <button onclick="addMoreToSlot(${idx})" class="text-[10px] font-bold text-[#5d5444] hover:text-[#bca37f] transition-colors px-3 py-1 border border-[#bca37f] rounded-full bg-white">
                        + 追加する
                    </button>
                    <button onclick="reselectSlot(${idx})" class="text-[10px] font-bold text-[#a6967a] hover:text-[#bca37f] transition-colors px-3 py-1 border border-[#d4c5af] rounded-full">
                        ← 読みを戻す
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
                console.log(`Slot ${idx} item: `, {
                    kanji: item['漢字'],
                    sessionReading: item.sessionReading,
                    currentReading: currentReading,
                    readingMatch: readingMatch
                });
            }

            return slotMatch && readingMatch;
        });

        console.log(`Slot ${idx} filtered items: `, items.length);

        // 現在の読みにマッチしない候補は表示しない（フォールバック廃止）
        if (items.length === 0) {
            scrollBox.innerHTML = '<div class="text-[#bca37f] text-sm italic px-4 py-6">候補なし（スワイプ画面で選んでください）</div>';
        }

        if (items.length > 0) {
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
                btn.className = 'build-piece-btn relative'; // modified: added relative
                btn.setAttribute('data-slot', idx);
                btn.setAttribute('data-kanji', item['漢字']);
                btn.onclick = () => selectBuildPiece(idx, item, btn);

                let fortuneIndicator = '';
                if (prioritizeFortune && itemIdx < 3) {
                    const badges = ['🥇', '🥈', '🥉'];
                    fortuneIndicator = `<div class="text-lg mt-1" > ${badges[itemIdx]}</div> `;
                }

                let partnerBadge = item.fromPartner ? `<div class="absolute -top-1.5 -right-1.5 bg-gradient-to-r from-[#f28b82] to-[#f4978e] text-white text-[8px] px-1.5 py-0.5 rounded-full shadow-sm z-10 break-keep leading-none flex items-center" >👩</div> ` : '';

                // 画数が未設定の場合はmasterから補完
                const strokes = item['画数'] !== undefined ? item['画数']
                    : (typeof master !== 'undefined' ? master.find(m => m['漢字'] === item['漢字'])?.['画数'] : undefined) ?? '?';

                btn.innerHTML = `
                    ${partnerBadge}
                    ${item.isSuper ? '<div class="absolute top-1 right-1 text-[#8ab4f8] text-[10px] leading-none font-bold">★</div>' : ''}
                    <div class="build-kanji-text">${item['漢字']}</div>
                    <div class="text-[10px] text-[#a6967a] font-bold">${strokes}画</div>
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
    if (!confirm(`「${reading}」のストックをすべて削除しますか？\n（${liked.filter(i => i.sessionReading === reading).length} 件）`)) {
        return;
    }

    // 該当する読み方のストックを除外
    const initialCount = liked.length;
    const removedItems = liked.filter(item => item.sessionReading === reading);
    liked = liked.filter(item => item.sessionReading !== reading);

    if (removedItems.length > 0 && typeof MeimayStats !== 'undefined' && MeimayStats.recordKanjiUnlike) {
        removedItems.forEach(item => MeimayStats.recordKanjiUnlike(item['漢字']));
    }

    if (liked.length < initialCount) {
        if (typeof StorageBox !== 'undefined' && StorageBox.saveLiked) {
            StorageBox.saveLiked();
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
 * 読みドロップダウンの開閉
 */
function toggleReadingDropdown() {
    // 読みモードに切り替え（自由モード中の場合）
    if (buildMode !== 'reading') {
        buildMode = 'reading';
        fbChoices = [];
        selectedPieces = [];
        const resultArea = document.getElementById('build-result-area');
        if (resultArea) resultArea.innerHTML = '';
        renderBuildSelection();
        // 再描画後にドロップダウンを開く
        setTimeout(() => toggleReadingDropdown(), 50);
        return;
    }

    const dropdown = document.getElementById('reading-dropdown');
    if (!dropdown) return;

    if (!dropdown.classList.contains('hidden')) {
        dropdown.classList.add('hidden');
        return;
    }

    // 読みストック一覧を構築
    let removedList = [];
    try { removedList = JSON.parse(localStorage.getItem('meimay_hidden_readings') || '[]'); } catch (e) { }

    const completedReadings = [...new Set(
        (liked || []).filter(item =>
            item.sessionReading && item.sessionReading !== 'FREE' && item.sessionReading !== 'SEARCH' && item.slot >= 0 && !removedList.includes(item.sessionReading)
        ).map(item => item.sessionReading)
    )];

    const history = typeof getReadingHistory === 'function' ? getReadingHistory() : [];
    const readingToSegments = {};
    history.forEach(h => { readingToSegments[h.reading] = h.segments; });

    const currentReading = segments.join('');

    if (completedReadings.length === 0) {
        dropdown.innerHTML = '<div class="px-4 py-3 text-sm text-[#a6967a]">読みストックがありません</div>';
    } else {
        dropdown.innerHTML = completedReadings.map(reading => {
            const segs = readingToSegments[reading];
            const display = segs ? segs.join(' / ') : reading;
            const isCurrent = reading === currentReading;
            const kanjiCount = (liked || []).filter(i => i.sessionReading === reading && i.slot >= 0).length;
            return `<button onclick="selectReadingForBuild('${reading}')"
                class="w-full text-left px-4 py-3 flex items-center justify-between border-b border-[#f0ebe3] last:border-b-0 active:bg-[#faf8f5] ${isCurrent ? 'bg-[#fffbeb]' : ''}">
                <span class="text-sm font-bold text-[#5d5444]">${display}${isCurrent ? ' ✓' : ''}</span>
                <span class="text-[10px] text-[#a6967a]">${kanjiCount}個</span>
            </button>`;
        }).join('');
    }
    dropdown.classList.remove('hidden');

    // 外側クリックで閉じる
    setTimeout(() => {
        document.addEventListener('click', function closeDD(e) {
            if (!dropdown.contains(e.target)) {
                dropdown.classList.add('hidden');
                document.removeEventListener('click', closeDD);
            }
        });
    }, 0);
}
window.toggleReadingDropdown = toggleReadingDropdown;

function selectReadingForBuild(reading) {
    const dropdown = document.getElementById('reading-dropdown');
    if (dropdown) dropdown.classList.add('hidden');
    if (typeof openBuildFromReading === 'function') {
        openBuildFromReading(reading);
    }
}
window.selectReadingForBuild = selectReadingForBuild;

/**
 * ビルド画面：自由組み立てモードのレンダリング
 * ストックされた漢字を読み方・FREE問わず全表示し、
 * 1〜3文字を自由に組み合わせる（スーパーライクを先頭に）
 */
function renderBuildFreeMode(container) {
    // ストックから重複なし全漢字を取得（スーパーライク優先）
    const seen = new Set();
    const allKanji = [];
    (liked || []).forEach(item => {
        if (item.isSuper && !seen.has(item['漢字'])) {
            seen.add(item['漢字']);
            allKanji.push(item);
        }
    });
    (liked || []).forEach(item => {
        if (!seen.has(item['漢字'])) {
            seen.add(item['漢字']);
            allKanji.push(item);
        }
    });

    if (allKanji.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'text-center py-16 text-[#a6967a] text-sm';
        empty.textContent = 'ストックがありません。スワイプで漢字をストックしてください。';
        container.appendChild(empty);
        return;
    }

    const maxSlots = 3;

    for (let slotIdx = 0; slotIdx < shownFbSlots; slotIdx++) {
        const label = `${slotIdx + 1}文字目`;
        const selected = fbChoices[slotIdx] || null;

        const slotDiv = document.createElement('div');
        slotDiv.className = 'mb-5';

        const headerHtml = `
            <div class="flex items-center justify-between mb-3">
                <p class="text-[11px] font-black text-[#bca37f] uppercase tracking-widest flex items-center gap-2">
                    <span class="bg-[#bca37f] text-white w-6 h-6 rounded-full flex items-center justify-center text-xs">${slotIdx + 1}</span>
                    ${label}
                </p>
                ${selected ? `<button onclick="removeFbChoice(${slotIdx})" class="text-[10px] font-bold text-[#a6967a] hover:text-[#f28b82] transition-colors px-3 py-1 border border-[#d4c5af] rounded-full">✕ 解除</button>` : ''}
            </div>
        `;

        const scrollHtml = `<div class="flex overflow-x-auto pb-2 no-scrollbar gap-1">
            ${allKanji.map(item => {
            const k = item['漢字'];
            const strokes = item['画数'] !== undefined ? item['画数']
                : (typeof master !== 'undefined' ? master.find(m => m['漢字'] === k)?.['画数'] : undefined) ?? '?';
            const isSelected = selected === k;
            const isUsed = fbChoices.includes(k) && fbChoices[slotIdx] !== k;
            return `<button onclick="selectFbKanji(${slotIdx}, '${k}')"
                    data-slot="${slotIdx}" data-kanji="${k}"
                    class="build-piece-btn relative ${isSelected ? 'selected' : ''} ${isUsed ? 'opacity-40' : ''}">
                    ${item.isSuper ? '<div class="absolute top-1 right-1 text-[#8ab4f8] text-[10px] leading-none font-bold">★</div>' : ''}
                    <div class="build-kanji-text">${k}</div>
                    <div class="text-[10px] text-[#a6967a] font-bold mt-1">${strokes}画</div>
                </button>`;
        }).join('')}
        </div>`;

        slotDiv.innerHTML = headerHtml + scrollHtml;
        container.appendChild(slotDiv);
    }

    // 「N文字目を追加」ボタン（1文字目が選択済みの場合のみ表示）
    if (fbChoices.length >= shownFbSlots && shownFbSlots < maxSlots) {
        const addBtn = document.createElement('button');
        addBtn.className = 'w-full py-3 mb-2 border-2 border-dashed border-[#d4c5af] rounded-2xl text-sm font-bold text-[#a6967a] hover:border-[#bca37f] hover:text-[#bca37f] transition-all active:scale-95';
        addBtn.innerHTML = `＋ ${shownFbSlots + 1}文字目を追加`;
        addBtn.onclick = () => {
            shownFbSlots = Math.min(shownFbSlots + 1, maxSlots);
            renderBuildSelection();
        };
        container.appendChild(addBtn);
    }

    // 選択した漢字の読み合わせ候補を表示
    if (fbChoices.length >= 1) {
        suggestReadingsForKanji(fbChoices, container);
    }
}

/**
 * 自由組み立てモード：選択した漢字の読みの組み合わせから
 * readings_data.json 内にマッチする読みを候補として提案する
 */
function suggestReadingsForKanji(choices, container) {
    if (!choices || choices.length === 0) return;
    if (!readingsData || readingsData.length === 0) return;
    if (typeof master === 'undefined' || !master || master.length === 0) return;

    // 各漢字の可能な読み一覧を取得（音・訓・伝統名のり をすべて split）
    function getKanjiReadings(kanji) {
        const rec = master.find(m => m['漢字'] === kanji);
        if (!rec) return [];
        const raw = [rec['音'] || '', rec['訓'] || '', rec['伝統名のり'] || ''].join(',');
        return [...new Set(
            raw.split(/[、,，\s/]+/)
                .map(r => typeof toHira === 'function' ? toHira(r.trim()) : r.trim().replace(/[ァ-ン]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60)))
                .filter(r => r && r.length >= 1 && /^[ぁ-ん]+$/.test(r))
        )];
    }

    // 全漢字の読みの組み合わせ（直積）を生成
    function cartesian(arrays) {
        return arrays.reduce((acc, curr) => {
            const result = [];
            acc.forEach(a => curr.forEach(c => result.push(a + c)));
            return result;
        }, ['']);
    }

    const readingArrays = choices.map(getKanjiReadings);
    if (readingArrays.some(a => a.length === 0)) return; // 読みが不明な漢字があったらスキップ
    const combinedSet = new Set(cartesian(readingArrays));

    // readings_data.json の中でその読みに一致するものを抽出
    const matched = readingsData.filter(r => combinedSet.has(r.reading));
    if (matched.length === 0) return;

    // 既存のNopeを除外
    const filtered = matched.filter(r => !(typeof noped !== 'undefined' && noped.has(r.reading)));
    if (filtered.length === 0) return;

    // スコアで優先ソート（ユーザーのタグ傾向）
    const scored = filtered.map(r => {
        let score = 0;
        if (r.tags && userTags) r.tags.forEach(t => { if (userTags[t]) score += userTags[t]; });
        return { ...r, _score: score };
    }).sort((a, b) => {
        if (a._score !== b._score) return b._score - a._score;
        return (b.count || 0) - (a.count || 0);
    });

    // UI 描画
    const section = document.createElement('div');
    section.className = 'mt-5 pt-4 border-t border-[#ede5d8]';
    section.innerHTML = `<p class="text-[11px] font-black text-[#bca37f] mb-3 flex items-center gap-2">
        <span>🎵</span> おすすめの読み方 <span class="text-[#a6967a] font-normal">(${scored.length}件)</span>
    </p>`;

    const grid = document.createElement('div');
    grid.className = 'flex flex-col gap-2';

    scored.slice(0, 12).forEach(r => {
        let tagsHtml = '';
        if (r.tags && r.tags.length > 0) {
            tagsHtml = r.tags.slice(0, 2).map(t => {
                const s = typeof getTagStyle === 'function' ? getTagStyle(t) : { bgColor: '#F3F4F6', textColor: '#374151', borderColor: '#E5E7EB' };
                return `<span class="inline-block px-2 py-0.5 text-[10px] font-bold rounded-full border"
                    style="background-color:${s.bgColor};color:${s.textColor};border-color:${s.borderColor};">${t}</span>`;
            }).join('');
        }

        let exHtml = '';
        if (r.examples) {
            const exArr = typeof r.examples === 'string'
                ? r.examples.split(/[,、]/).map(x => x.trim()).filter(x => x)
                : (Array.isArray(r.examples) ? r.examples : []);
            if (exArr.length > 0) {
                exHtml = `<span class="text-[10px] text-[#a6967a] ml-1">${exArr.slice(0, 3).join(' / ')}</span>`;
            }
        }

        const btn = document.createElement('button');
        btn.className = 'w-full flex items-center justify-between px-4 py-3 bg-white rounded-2xl border border-[#ede5d8] hover:border-[#bca37f] transition-all active:scale-95 shadow-sm text-left';
        btn.innerHTML = `
            <div>
                <span class="text-lg font-black text-[#5d5444]">${r.reading}</span>
                ${exHtml}
                <div class="flex flex-wrap gap-1 mt-1">${tagsHtml}</div>
            </div>
            <span class="text-[#bca37f] font-bold text-lg ml-2 shrink-0">›</span>
        `;
        btn.onclick = () => {
            // 選んだ読みをbeースに読み指定モードで候補を探す
            if (typeof proceedWithSoundReading === 'function') {
                proceedWithSoundReading(r.reading);
            }
            if (typeof showToast === 'function') showToast(`「${r.reading}」で候補を生成します`, '🎵');
        };
        grid.appendChild(btn);
    });

    section.appendChild(grid);
    container.appendChild(section);
}

/**
 * 自由組み立てモード：選択した漢字で姓名判断を実行し build-result-area に表示
 */
function executeFbBuild() {
    const resultArea = document.getElementById('build-result-area');
    if (!resultArea) return;

    if (fbChoices.length === 0) {
        resultArea.innerHTML = '';
        return;
    }

    const givenName = fbChoices.join('');
    const combination = fbChoices.map(k => {
        const fromLiked = (liked || []).find(l => l['漢字'] === k);
        if (fromLiked) return fromLiked;
        const fromMaster = typeof master !== 'undefined' ? master?.find(m => m['漢字'] === k) : null;
        return fromMaster || { '漢字': k, '画数': 1 };
    });

    const givenReading = fbChoices.map(k => {
        const item = (liked || []).find(l => l['漢字'] === k);
        return item?.sessionSegments?.[item.slot] || item?.sessionReading || k;
    }).join('');

    const givArr = combination.map(p => ({
        kanji: p['漢字'],
        strokes: parseInt(p['画数']) || 0
    }));

    let fortune = null;
    if (typeof FortuneLogic !== 'undefined' && FortuneLogic.calculate) {
        if (surnameData && surnameData.length > 0) {
            fortune = FortuneLogic.calculate(surnameData, givArr);
        } else {
            fortune = FortuneLogic.calculate([{ kanji: '', strokes: 1 }], givArr);
        }
    }

    currentBuildResult = {
        fullName: (surnameStr || '') + givenName,
        reading: givenReading,
        fortune: fortune,
        combination: combination,
        givenName: givenName,
        timestamp: new Date().toISOString()
    };

    renderBuildResult();
}

window.renderBuildFreeMode = renderBuildFreeMode;
window.executeFbBuild = executeFbBuild;

// selectFbKanji / removeFbChoice: ビルド画面自由モード対応版
window.selectFbKanji = function (slotIdx, kanji) {
    fbChoices[slotIdx] = kanji;

    const scrollPositions = [];
    document.querySelectorAll('.overflow-x-auto').forEach(el => scrollPositions.push(el.scrollLeft));

    const buildScreen = document.getElementById('scr-build');
    if (buildScreen && buildScreen.classList.contains('active') && buildMode === 'free') {
        renderBuildSelection();
        executeFbBuild();
    } else {
        renderFreeBuildSection();
    }

    requestAnimationFrame(() => {
        document.querySelectorAll('.overflow-x-auto').forEach((el, i) => {
            if (scrollPositions[i] !== undefined) el.scrollLeft = scrollPositions[i];
        });
    });
};

window.removeFbChoice = function (slotIdx) {
    fbChoices.splice(slotIdx, 1);
    if (typeof shownFbSlots !== 'undefined' && shownFbSlots > 1 && fbChoices.length < shownFbSlots) {
        shownFbSlots--;
    }

    const scrollPositions = [];
    document.querySelectorAll('.overflow-x-auto').forEach(el => scrollPositions.push(el.scrollLeft));

    const buildScreen = document.getElementById('scr-build');
    if (buildScreen && buildScreen.classList.contains('active') && buildMode === 'free') {
        renderBuildSelection();
        executeFbBuild();
    } else {
        renderFreeBuildSection();
    }

    requestAnimationFrame(() => {
        document.querySelectorAll('.overflow-x-auto').forEach((el, i) => {
            if (scrollPositions[i] !== undefined) el.scrollLeft = scrollPositions[i];
        });
    });
};

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
    console.log(`BUILD: Selected piece for slot ${slot}: `, data['漢字']);
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
    <div class="glass-card rounded-[50px] p-8 mb-6 shadow-xl animate-fade-in" >
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
            ` : ''
        }

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

    const container = document.getElementById('for-grid');

    if (!container) return;

    const getNum = (obj) => (obj ? (obj.num || obj.val || 0) : 0);

    container.innerHTML = '';
    container.className = "flex flex-col w-full relative";

    // 姓のデータ（画数込み）
    const surChars = (surnameData || []).filter(s => s.kanji);
    const givChars = givens;
    const nSur = surChars.length;
    const nGiv = givChars.length;

    // 鑑定図解：3カラム（外格＋[括弧 ｜ 漢字列 ｜ ]括弧×3＋天人地格）＋下部総格
    const BOX_H = 40;   // 漢字ボックス高さ px
    const BOX_W = 40;   // 漢字ボックス幅 px
    const GAP = 8;    // 行間 px（広めに）
    const DIV_H = 30;   // 「/」区切り高さ px（人格スペース確保）
    const BC = '#bca37f'; // 括弧の色
    const BW = 2;    // 括弧の線幅 px
    const BARM = 10;   // 括弧のアーム幅 px
    const LINE = 12;   // 括弧中央から格ボックスへの横線長 px

    // 各文字の Y 座標（flex column + gap での実座標）
    const surTop = (i) => i * (BOX_H + GAP);
    const surBot = (i) => surTop(i) + BOX_H;
    const surMid = (i) => surTop(i) + BOX_H / 2;
    const divTopY = nSur > 0 ? nSur * (BOX_H + GAP) : 0;
    const divBotY = divTopY + DIV_H;
    const givTop = (i) => divBotY + GAP + i * (BOX_H + GAP);
    const givBot = (i) => givTop(i) + BOX_H;
    const givMid = (i) => givTop(i) + BOX_H / 2;
    const totalH = nGiv > 0 ? givBot(nGiv - 1) : (nSur > 0 ? surBot(nSur - 1) : 80);

    // 各格の括弧スパン（各文字の中央から中央へ）
    // 隣接する括弧がOFFSET分ずれて重ならないようにする
    const OFFSET = 5; // 隣接括弧アームの重複防止オフセット px
    const _tenRaw = { top: nSur > 0 ? surMid(0) : 0, bot: nSur > 0 ? surMid(nSur - 1) : 0 };
    const _jinRaw = { top: nSur > 0 ? surMid(nSur - 1) : 0, bot: nGiv > 0 ? givMid(0) : 0 };
    const _chiRaw = { top: nGiv > 0 ? givMid(0) : totalH, bot: nGiv > 0 ? givMid(nGiv - 1) : totalH };
    // オフセット適用（単一文字スパン=h≤0 はそのまま）
    const tenSpan = { top: _tenRaw.top, bot: _tenRaw.bot > _tenRaw.top ? _tenRaw.bot - OFFSET : _tenRaw.bot };
    const jinSpan = (() => {
        const t = _jinRaw.top + OFFSET, b = _jinRaw.bot - OFFSET;
        return (t < b) ? { top: t, bot: b } : { top: (_jinRaw.top + _jinRaw.bot) / 2, bot: (_jinRaw.top + _jinRaw.bot) / 2 };
    })();
    const chiSpan = { top: _chiRaw.bot > _chiRaw.top ? _chiRaw.top + OFFSET : _chiRaw.top, bot: _chiRaw.bot };
    const gaiSpan = { top: nSur > 0 ? surMid(0) : 0, bot: nGiv > 0 ? givMid(nGiv - 1) : totalH };

    const spanMid = (s) => (s.top + s.bot) / 2;

    // 括弧の CSS スタイル文字列（高さ 0 = 1文字のみ → 横線）
    const bStyle = (span, side) => {
        const h = span.bot - span.top;
        if (h <= 1) {
            return `position:absolute;top:${span.top}px;height:0;left:0;right:0;border-top:${BW}px solid ${BC};`;
        }
        const corners = side === 'left'
            ? `border-left:${BW}px solid ${BC};border-top:${BW}px solid ${BC};border-bottom:${BW}px solid ${BC};border-radius:3px 0 0 3px;`
            : `border-right:${BW}px solid ${BC};border-top:${BW}px solid ${BC};border-bottom:${BW}px solid ${BC};border-radius:0 3px 3px 0;`;
        return `position:absolute;top:${span.top}px;height:${h}px;left:0;right:0;${corners}`;
    };

    // 格ボックスの Y 位置（重なり防止：最小間隔を保証）
    const FBOX_H = 36; // fBoxを横並びにしてコンパクト化
    const rawY = [spanMid(tenSpan), spanMid(jinSpan), spanMid(chiSpan)];
    const yPos = [...rawY];
    for (let i = 1; i < yPos.length; i++) {
        yPos[i] = Math.max(yPos[i], yPos[i - 1] + FBOX_H);
    }
    const [yTen, yJin, yChi] = yPos;
    const rightColH = Math.max(totalH, yChi + FBOX_H / 2 + 4);

    // 格ボックス HTML（コンパクト横並びレイアウト）
    const fBox = (obj, label) => `
    <div style = "text-align:center;cursor:pointer;white-space:nowrap" onclick = "showFortuneTerm('${label}')" >
            <div style="padding:2px 6px;background:#fdfaf5;border:1.5px solid #eee5d8;border-radius:6px;display:inline-block">
                <span style="font-size:12px;font-weight:900;color:#5d5444">${getNum(obj)}</span><span style="font-size:7px;color:#a6967a">画</span><span style="font-size:10px;font-weight:900;margin-left:3px" class="${obj.res.color}">${obj.res.label}</span>
            </div>
            <div style="font-size:7px;font-weight:700;color:#a6967a;margin-top:1px">${label}</div>
        </div> `;

    // 漢字ボックス HTML
    const kBox = (char, isSur) => `
    <div style = "width:${BOX_W}px;height:${BOX_H}px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:900;line-height:1;border-radius:8px;${isSur ? 'background:#fdfaf5;border:1.5px solid #eee5d8;color:#bca37f;' : 'background:white;border:1.5px solid #bca37f;color:#5d5444;box-shadow:0 1px 4px rgba(188,163,127,0.2);'}" > ${char}</div> `;

    const mapArea = document.createElement('div');
    mapArea.className = "mb-4 p-4 bg-white rounded-2xl border border-[#eee5d8] shadow-sm animate-fade-in";
    mapArea.innerHTML = `
        <div style = "text-align:center;font-size:9px;font-weight:900;letter-spacing:0.2em;color:#5d5444;opacity:0.5;margin-bottom:14px" > 姓名判断 鑑定図解</div>

        <div style="display:flex;align-items:flex-start;justify-content:center;gap:2px">

            
            <div style="display:flex;flex-direction:row-reverse;align-items:flex-start;flex-shrink:0;height:${totalH}px;width:${BARM + LINE + 80}px;justify-content:flex-start">
                <div style="position:relative;width:${BARM}px;height:${totalH}px;flex-shrink:0">
                    <div style="${bStyle(gaiSpan, 'left')}"></div>
                </div>
                <div style="position:relative;width:${LINE}px;height:${totalH}px;flex-shrink:0">
                    <div style="position:absolute;top:${spanMid(gaiSpan)}px;left:0;right:0;height:0;border-top:${BW}px solid ${BC}"></div>
                </div>
                <div style="height:${totalH}px;display:flex;flex-direction:column;justify-content:center;flex-shrink:0">
                    ${fBox(res.gai, '外格')}
                </div>
            </div>

            
            <div style="display:flex;flex-direction:column;gap:${GAP}px;flex-shrink:0;align-items:center">
                ${surChars.map(s => kBox(s.kanji, true)).join('')}
                <div style="height:${DIV_H}px;display:flex;align-items:center;justify-content:center;color:#d4c5af;font-size:16px;font-weight:900;line-height:1">/</div>
                ${givChars.map(g => kBox(g.kanji, false)).join('')}
            </div>

            
            <div style="position:relative;height:${rightColH}px;width:${BARM + LINE + 80}px;flex-shrink:0">
                
                <div style="position:absolute;top:0;left:0;width:${BARM}px;height:${totalH}px">
                    <div style="${bStyle(tenSpan, 'right')}"></div>
                    <div style="${bStyle(jinSpan, 'right')}"></div>
                    <div style="${bStyle(chiSpan, 'right')}"></div>
                </div>
                
                <div style="position:absolute;top:${yTen}px;left:${BARM}px;width:${LINE}px;height:0;border-top:${BW}px solid ${BC}"></div>
                <div style="position:absolute;top:${yJin}px;left:${BARM}px;width:${LINE}px;height:0;border-top:${BW}px solid ${BC}"></div>
                <div style="position:absolute;top:${yChi}px;left:${BARM}px;width:${LINE}px;height:0;border-top:${BW}px solid ${BC}"></div>
                
                <div style="position:absolute;top:${yTen}px;left:${BARM + LINE}px;transform:translateY(-50%)">
                    ${fBox(res.ten, '天格')}
                </div>
                <div style="position:absolute;top:${yJin}px;left:${BARM + LINE}px;transform:translateY(-50%)">
                    ${fBox(res.jin, '人格')}
                </div>
                <div style="position:absolute;top:${yChi}px;left:${BARM + LINE}px;transform:translateY(-50%)">
                    ${fBox(res.chi, '地格')}
                </div>
            </div>

        </div>

        <!--下部：総格-- >
    <div style="margin-top:10px;text-align:center">
        <div style="display:inline-block;padding:6px 20px;background:linear-gradient(to right,#fdfaf5,white);border-radius:12px;border:1.5px solid #bca37f;box-shadow:0 1px 4px rgba(188,163,127,0.15);cursor:pointer"
            onclick="showFortuneTerm('総格')">
            <div style="font-size:8px;font-weight:700;color:#a6967a;margin-bottom:1px">総格</div>
            <div style="font-size:16px;font-weight:900;color:#5d5444;line-height:1.2">${getNum(res.so)}<span style="font-size:9px;font-weight:400;color:#a6967a">画</span></div>
            <div style="font-size:11px;font-weight:900" class="${res.so.res.color}">${res.so.res.label}</div>
        </div>
    </div>
`;
    container.appendChild(mapArea);

    if (res.sansai) {
        const sansai = document.createElement('div');
        sansai.className = "mb-4 bg-[#fdfaf5] p-4 rounded-2xl border border-[#eee5d8] shadow-inner animate-fade-in";
        sansai.innerHTML = `
    <div class="flex justify-between items-center mb-3" >
                <div class="flex items-center gap-2">
                    <span class="text-[10px] font-black text-[#bca37f] tracking-widest uppercase">五行・三才</span>
                    <span onclick="showFortuneTerm('五行・三才')" style="width:16px;height:16px;min-width:16px;flex-shrink:0;border-radius:50%;background:#bca37f;color:white;font-size:10px;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;line-height:1;align-self:center">?</span>
                </div>
                <span class="px-3 py-0.5 bg-white rounded-full text-[10px] font-black ${res.sansai.label === '大吉' ? 'text-amber-600' : 'text-[#5d5444]'} shadow-sm">
                    ${res.sansai.label}
                </span>
            </div>
            <div class="flex gap-1.5 items-center mb-3">
                ${['t', 'j', 'c'].map(k => `<div class="flex-grow bg-white py-2 rounded-xl border border-[#eee5d8] text-center"><div class="text-[8px] font-bold text-[#a6967a]">${k === 't' ? '天' : k === 'j' ? '人' : '地'}</div><div class="text-sm font-black text-[#5d5444]">${res.sansai[k] || '-'}</div></div>`).join('<div class="text-[#eee5d8] text-[8px]">▶</div>')}
            </div>
            <p class="text-[11px] leading-relaxed text-[#5d5444] text-center">${res.sansai.desc || ''}</p>
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
        { k: "天格", sub: "祖先運", d: res.ten, icon: "🏛️" },
        { k: "人格", sub: "主運", d: res.jin, icon: "💎" },
        { k: "地格", sub: "初年運", d: res.chi, icon: "🌱" },
        { k: "外格", sub: "対人運", d: res.gai, icon: "🌍" },
        { k: "総格", sub: "総合運", d: res.so, icon: "🏆" }
    ];
    items.forEach(p => {
        if (!p.d) return;

        let descText = (p.d.role || p.d.res.desc || "").replace(/^【.+?】\s*/, '');
        // 副題（例：祖先運）が先頭に来る場合は除去
        descText = descText.replace(new RegExp(`^ ${p.sub} [。、|｜\\s] * `), '');

        const row = document.createElement('div');
        row.className = "mb-2 w-full animate-fade-in bg-white border border-[#eee5d8] rounded-2xl p-3 shadow-sm";
        row.innerHTML = `
    <div class="flex items-center gap-3 mb-1" >
                <div class="flex items-center gap-1.5">
                    <span class="text-sm">${p.icon}</span>
                    <span class="text-xs font-black text-[#a6967a]">${p.k}（${p.sub}）</span>
                    <span onclick="showFortuneTerm('${p.k}')" style="width:16px;height:16px;min-width:16px;flex-shrink:0;border-radius:50%;background:#bca37f;color:white;font-size:10px;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;line-height:1;align-self:center">?</span>
                </div>
                <div class="flex items-center gap-2 ml-auto">
                    <span class="text-lg font-black text-[#5d5444]">${getNum(p.d)}画</span>
                    <span class="${p.d.res.color} text-sm font-black">${p.d.res.label}</span>
                </div>
            </div>
    <p class="text-[11px] leading-relaxed text-[#7a6f5a] line-clamp-3">${descText}</p>
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
        let items = liked.filter(item => item.slot === idx && (!item.sessionReading || item.sessionReading === currentReading));
        // 現在の読みで候補がない場合はスロット内の全漢字（重複排除）を使用
        if (items.length === 0) {
            const allSlotItems = liked.filter(item => item.slot === idx);
            const seen = new Set();
            items = allSlotItems.filter(item => {
                if (seen.has(item['漢字'])) return false;
                seen.add(item['漢字']);
                return true;
            });
        }
        return items;
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

    // for-nameが存在しない場合もクラッシュしないようにnullチェック
    if (nameEl) nameEl.innerText = '🏆 運勢ランキング TOP10';
    gridEl.innerHTML =
        (!nameEl ? '<div style="font-size:15px;font-weight:900;color:#5d5444;text-align:center;margin-bottom:8px">🏆 運勢ランキング TOP10</div>' : '') +
        '<p class="text-xs text-center text-[#a6967a] mb-3">タップして選択すると自動的に反映されます</p>';
    descEl.innerHTML = '';

    // 同スコア同順位（dense ranking）
    const ranks = [];
    rankedList.forEach((item, i) => {
        if (i === 0) { ranks.push(1); return; }
        ranks.push(item.score === rankedList[i - 1].score ? ranks[i - 1] : ranks[i - 1] + 1);
    });

    const medals = { 1: '🥇', 2: '🥈', 3: '🥉' };

    rankedList.forEach((item, index) => {
        const rank = ranks[index];
        const fullName = surnameStr ? `${surnameStr} ${item.combination.name} ` : item.combination.name;
        const f = item.fortune;
        const card = document.createElement('div');
        card.className = 'mb-2 p-3 bg-white rounded-2xl border-2 cursor-pointer transition-all active:scale-98';

        if (rank === 1) card.classList.add('border-[#bca37f]', 'bg-gradient-to-br', 'from-[#fdfaf5]', 'to-[#f8f5ef]');
        else if (rank === 2) card.classList.add('border-[#d4c5af]', 'bg-gradient-to-br', 'from-[#fdfaf5]', 'to-white');
        else if (rank === 3) card.classList.add('border-[#e5dfd5]');
        else card.classList.add('border-[#eee5d8]');

        card.onclick = () => applyRankedCombination(item.combination);

        const rankBadge = medals[rank]
            ? `<span style = "font-size:22px;line-height:1;flex-shrink:0" > ${medals[rank]}</span> `
            : `<div style = "width:28px;height:28px;border-radius:50%;background:#f8f5ef;border:1.5px solid #d4c5af;display:flex;align-items:center;justify-content:center;flex-shrink:0" > <span style="font-size:12px;font-weight:900;color:#a6967a;line-height:1">${rank}</span></div> `;

        card.innerHTML = `
    <div style = "display:flex;align-items:center;gap:8px" >
        ${rankBadge}
                <div style="flex:1;min-width:0;overflow:hidden">
                    <div style="display:flex;align-items:baseline;gap:6px;margin-bottom:2px">
                        <span style="font-size:17px;font-weight:900;color:#5d5444;white-space:nowrap">${fullName}</span>
                        <span style="font-size:10px;color:#a6967a;white-space:nowrap">${item.combination.reading}</span>
                    </div>
                    <div style="display:flex;gap:4px;flex-wrap:nowrap;overflow:hidden">
                        <span style="padding:1px 5px;background:white;border-radius:20px;font-size:9px;font-weight:700;border:1px solid #eee5d8;white-space:nowrap;flex-shrink:0" class="${f.ten.res.color}">天:${f.ten.res.label}</span>
                        <span style="padding:1px 5px;background:white;border-radius:20px;font-size:9px;font-weight:700;border:1px solid #eee5d8;white-space:nowrap;flex-shrink:0" class="${f.jin.res.color}">人:${f.jin.res.label}</span>
                        <span style="padding:1px 5px;background:white;border-radius:20px;font-size:9px;font-weight:700;border:1px solid #eee5d8;white-space:nowrap;flex-shrink:0" class="${f.chi.res.color}">地:${f.chi.res.label}</span>
                        <span style="padding:1px 5px;background:white;border-radius:20px;font-size:9px;font-weight:700;border:1px solid #eee5d8;white-space:nowrap;flex-shrink:0" class="${f.gai.res.color}">外:${f.gai.res.label}</span>
                    </div>
                </div>
                <div style="text-align:right;flex-shrink:0;margin-left:4px">
                    <div style="font-size:20px;font-weight:900;line-height:1" class="${f.so.res.color}">${f.so.val}</div>
                    <div style="font-size:10px;font-weight:700" class="${f.so.res.color}">${f.so.res.label}</div>
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
    if (confirm(`${slotIdx + 1} 文字目「${segments[slotIdx]}」を選び直しますか？\n現在の選択がリセットされます。`)) {
        const toRemove = [];
        const keptLiked = [];
        liked.forEach(item => {
            if (item.slot === slotIdx) {
                toRemove.push(item['漢字']);
            } else {
                keptLiked.push(item);
            }
        });
        liked = keptLiked;

        toRemove.forEach(kanji => {
            seen.delete(kanji);
            if (typeof MeimayStats !== 'undefined' && MeimayStats.recordKanjiUnlike) {
                MeimayStats.recordKanjiUnlike(kanji);
            }
        });
        // NOPEリストもリセット（選び直し時）
        if (typeof noped !== 'undefined') noped.clear();

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
    // ビルドからの「追加する」は常に読みモードで動作させる
    // （FREEモードのままだとsessionReading:'FREE'でストックされてしまうバグ防止）
    isFreeSwipeMode = false;
    window._addMoreFromBuild = true; // HUDに「ビルドへ」ボタンを表示するフラグ
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

// ============================================================
// STOCK TAB SWIPE GESTURE
// 読みストック ↔ 漢字ストック をスワイプで切り替え
// ============================================================
(function initStockSwipe() {
    let touchStartX = 0;
    let touchStartY = 0;
    let touchStartTime = 0;

    function handleTouchStart(e) {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        touchStartTime = Date.now();
    }

    function handleTouchEnd(e) {
        const dx = e.changedTouches[0].clientX - touchStartX;
        const dy = e.changedTouches[0].clientY - touchStartY;
        const dt = Date.now() - touchStartTime;

        // スワイプ判定: 水平50px以上、水平>垂直、500ms以内
        if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) || dt > 500) return;

        // ストック画面が表示中かチェック
        const stockScreen = document.getElementById('scr-stock');
        if (!stockScreen || !stockScreen.classList.contains('active')) return;

        const readingPanel = document.getElementById('reading-stock-panel');
        const kanjiPanel = document.getElementById('stock-kanji-panel');
        if (!readingPanel || !kanjiPanel) return;

        if (dx < 0 && currentStockTab === 'kanji') {
            // 左スワイプ（左から右へ動く UI イメージ）→ 読みストック（右）へ
            kanjiPanel.style.animation = 'slideOutLeft 0.25s ease-out';
            setTimeout(() => {
                switchStockTab('reading');
                kanjiPanel.style.animation = '';
                readingPanel.style.animation = 'slideInRight 0.25s ease-out';
                setTimeout(() => { readingPanel.style.animation = ''; }, 250);
            }, 200);
        } else if (dx > 0 && currentStockTab === 'reading') {
            // 右スワイプ → 漢字ストック（左）へ
            readingPanel.style.animation = 'slideOutRight 0.25s ease-out';
            setTimeout(() => {
                switchStockTab('kanji');
                readingPanel.style.animation = '';
                kanjiPanel.style.animation = 'slideInLeft 0.25s ease-out';
                setTimeout(() => { kanjiPanel.style.animation = ''; }, 250);
            }, 200);
        }
    }

    // DOMReady後にイベント登録
    function attach() {
        const stockScreen = document.getElementById('scr-stock');
        if (stockScreen) {
            stockScreen.addEventListener('touchstart', handleTouchStart, { passive: true });
            stockScreen.addEventListener('touchend', handleTouchEnd, { passive: true });
            console.log('STOCK: Swipe gesture attached');
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', attach);
    } else {
        setTimeout(attach, 100);
    }
})();

console.log("BUILD: Module loaded");
