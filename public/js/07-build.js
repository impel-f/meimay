/* ============================================================
   MODULE 07: BUILD (V15.0 - ビルド画面に読み方/自由モード統合)
   ビルド画面・名前構築・姓名判断表示
   ============================================================ */

let selectedPieces = [];
let buildMode = 'reading'; // 'reading' | 'free'
let fbChoices = [];
let fbChoicesUseMark = {};
let shownFbSlots = 1;
let fbSelectedReading = null;
let currentFbRecommendedReadings = [];
let excludedKanjiFromBuild = [];

/**
 * ストック画面を開く
 */
let currentStockTab = 'kanji';

function getActiveCompoundBuildFlow() {
    if (typeof window.getCompoundBuildFlow === 'function') {
        return window.getCompoundBuildFlow();
    }
    return window.meimayCompoundBuildFlow || null;
}

function getCompoundFixedPieceForSlot(slotIdx) {
    const flow = getActiveCompoundBuildFlow();
    if (!flow || !flow.fixedSlotsBySlot) return null;
    return flow.fixedSlotsBySlot[slotIdx] || flow.fixedSlotsBySlot[String(slotIdx)] || null;
}

function hydrateCompoundBuildSelections() {
    selectedPieces = [];
    const flow = getActiveCompoundBuildFlow();
    if (!flow || !flow.fixedSlotsBySlot) return;

    Object.keys(flow.fixedSlotsBySlot).forEach((key) => {
        const slotIdx = Number(key);
        if (!Number.isFinite(slotIdx)) return;
        selectedPieces[slotIdx] = { ...flow.fixedSlotsBySlot[key] };
    });
}

function getBuildSlotDisplayLabel(seg, idx) {
    const flow = getActiveCompoundBuildFlow();
    if (flow && Array.isArray(flow.slotLabels) && flow.slotLabels[idx]) {
        return flow.slotLabels[idx];
    }
    return `${idx + 1}文字目: ${seg}`;
}

function flattenBuildCombination(pieces) {
    const flattened = [];

    (Array.isArray(pieces) ? pieces : []).forEach((piece) => {
        if (!piece) return;

        const kanji = piece['漢字'] || '';
        const chars = Array.from(kanji);
        if (piece.isCompound && chars.length > 1) {
            chars.forEach((char) => {
                const masterItem = Array.isArray(master)
                    ? master.find(entry => entry['漢字'] === char)
                    : null;
                flattened.push({
                    ...(masterItem || {}),
                    '漢字': char,
                    '画数': masterItem?.['画数'] ?? 0
                });
            });
            return;
        }

        flattened.push(piece);
    });

    return flattened;
}

function normalizeSingleKanjiStock() {
    if (!Array.isArray(liked)) return;
    const cleaned = liked.filter((item) => {
        const kanji = item?.['漢字'] || item?.['貌｡蟄･'] || item?.kanji || '';
        return String(kanji).trim().length > 0;
    });

    if (cleaned.length === liked.length) {
        if (cleaned.length > 0) {
            try {
                localStorage.removeItem('meimay_liked_cleared_at');
            } catch (error) {
                console.warn('BUILD: Failed to clear empty-stock marker', error);
            }
        }
        return;
    }

    liked = cleaned;
    try {
        const serialized = JSON.stringify(cleaned);
        localStorage.setItem('naming_app_liked_chars', serialized);
        localStorage.setItem('meimay_liked', serialized);
        localStorage.setItem('meimay_liked_meta_v1', JSON.stringify({
            count: cleaned.length,
            savedAt: new Date().toISOString()
        }));
        if (cleaned.length > 0) {
            localStorage.setItem('meimay_liked_backup_v1', serialized);
            localStorage.removeItem('meimay_liked_cleared_at');
        } else {
            localStorage.setItem('meimay_liked_cleared_at', new Date().toISOString());
        }
    } catch (error) {
        console.warn('BUILD: Failed to normalize stock', error);
    }

    if (typeof queuePartnerStockSync === 'function') {
        queuePartnerStockSync('normalizeSingleKanjiStock');
    }
}

normalizeSingleKanjiStock();

function isCompoundSlotPlaceholder(seg) {
    return typeof seg === 'string' && /^__compound_slot_\d+__$/.test(seg);
}

function extractSlotReadingLabel(label) {
    if (typeof label !== 'string') return '';
    const cleaned = label.replace(/^\s*\d+文字目(?:＋\d+文字目)*\s*:\s*/, '').trim();
    return cleaned || label.trim();
}

function getLatestReadingHistoryLookup() {
    const lookup = {};
    const history = typeof getReadingHistory === 'function' ? getReadingHistory() : [];
    history.forEach((entry) => {
        if (!entry || !entry.reading || lookup[entry.reading]) return;
        lookup[entry.reading] = entry;
    });
    return lookup;
}

function getCompoundFlowLikeForReading(reading, historyLookup = {}) {
    const activeFlow = getActiveCompoundBuildFlow();
    if (activeFlow && activeFlow.reading === reading) {
        return activeFlow;
    }
    const historyEntry = reading ? historyLookup[reading] : null;
    return historyEntry?.compoundFlow || null;
}

function getDisplaySegmentsForReading(reading, historyLookup = {}) {
    const flow = getCompoundFlowLikeForReading(reading, historyLookup);
    if (flow) {
        if (Array.isArray(flow.displaySegments) && flow.displaySegments.length > 0) {
            return flow.displaySegments.filter(Boolean).map((seg) => String(seg));
        }
        if (Array.isArray(flow.slotLabels) && flow.slotLabels.length > 0) {
            const deduped = [];
            flow.slotLabels.forEach((label) => {
                const readable = extractSlotReadingLabel(label);
                if (readable && deduped[deduped.length - 1] !== readable) {
                    deduped.push(readable);
                }
            });
            if (deduped.length > 0) {
                return deduped;
            }
        }
    }

    const historyEntry = reading ? historyLookup[reading] : null;
    if (historyEntry && Array.isArray(historyEntry.segments) && historyEntry.segments.length > 0) {
        const safeSegments = historyEntry.segments
            .filter(seg => seg && !isCompoundSlotPlaceholder(seg))
            .map((seg) => String(seg));
        if (safeSegments.length > 0) {
            return safeSegments;
        }
    }
    return reading ? [reading] : [];
}

function getReadableSegmentForItem(item, historyLookup = {}) {
    const slotIdx = Number(item?.slot);
    const reading = item?.sessionReading || '';
    const flow = getCompoundFlowLikeForReading(reading, historyLookup);

    if (flow && Array.isArray(flow.slotLabels) && Number.isInteger(slotIdx) && slotIdx >= 0) {
        const readable = extractSlotReadingLabel(flow.slotLabels[slotIdx]);
        if (readable) {
            return readable;
        }
    }

    const itemDisplaySegments = Array.isArray(item?.sessionDisplaySegments) ? item.sessionDisplaySegments : [];
    if (Number.isInteger(slotIdx) && slotIdx >= 0 && itemDisplaySegments[slotIdx] && !isCompoundSlotPlaceholder(itemDisplaySegments[slotIdx])) {
        return itemDisplaySegments[slotIdx];
    }

    const displaySegments = getDisplaySegmentsForReading(reading, historyLookup);
    if (displaySegments.length === 1 && displaySegments[0]) {
        return displaySegments[0];
    }
    if (Number.isInteger(slotIdx) && slotIdx >= 0 && displaySegments[slotIdx] && !isCompoundSlotPlaceholder(displaySegments[slotIdx])) {
        return displaySegments[slotIdx];
    }

    return reading || '自由';
}

function getPartnerChipHTML(options = {}, classes = '') {
    const label = options.partnerAlsoPicked ? 'ふたり' : '相手';
    const colorClass = options.partnerAlsoPicked
        ? 'bg-gradient-to-r from-[#b9965b] to-[#c9a977] text-white'
        : 'bg-[#f7b2a7] text-white';
    const merged = classes ? ` ${classes}` : '';
    return `<span class="inline-flex items-center justify-center min-w-[46px] px-2 py-0.5 rounded-full text-[10px] font-bold leading-none shadow-sm ${colorClass}${merged}">${label}</span>`;
}

function getBuildSlotDisplayLabel(seg, idx) {
    const flow = getActiveCompoundBuildFlow();
    if (flow && Array.isArray(flow.slotLabels) && flow.slotLabels[idx]) {
        return flow.slotLabels[idx];
    }
    if (isCompoundSlotPlaceholder(seg)) {
        const reading = flow?.reading || '';
        return reading ? `${idx + 1}文字目: ${reading}` : `${idx + 1}文字目`;
    }
    return `${idx + 1}文字目: ${seg}`;
}

function getSafeBuildCurrentReading() {
    const currentReading = typeof getCurrentSessionReading === 'function'
        ? getCurrentSessionReading()
        : '';
    if (currentReading && !/__compound_slot_/.test(currentReading)) {
        return currentReading;
    }

    const flow = getActiveCompoundBuildFlow();
    if (flow && typeof flow.reading === 'string' && flow.reading && !/__compound_slot_/.test(flow.reading)) {
        return flow.reading;
    }

    const nameInput = document.getElementById('in-name');
    const typedReading = nameInput && typeof nameInput.value === 'string'
        ? nameInput.value.trim()
        : '';
    if (typedReading) {
        return typedReading;
    }

    if (!Array.isArray(segments)) return '';
    return segments
        .filter(seg => seg && !isCompoundSlotPlaceholder(seg))
        .join('');
}

function getSafeFreeBuildAutoReading(choices) {
    const historyLookup = getLatestReadingHistoryLookup();
    const safeParts = (Array.isArray(choices) ? choices : []).map((kanji) => {
        const item = (liked || []).find(l => l['漢字'] === kanji);
        if (!item) return '';

        const readable = getReadableSegmentForItem(item, historyLookup);
        if (readable && !isCompoundSlotPlaceholder(readable) && !['FREE', 'SEARCH', 'SHARED', 'UNKNOWN'].includes(readable)) {
            return readable;
        }

        const sessionReading = String(item?.sessionReading || '');
        if (sessionReading && !isCompoundSlotPlaceholder(sessionReading) && !['FREE', 'SEARCH', 'SHARED', 'UNKNOWN'].includes(sessionReading)) {
            return sessionReading;
        }

        return '';
    }).filter(Boolean);

    return safeParts.join('');
}

function getFreeBuildTopRecommendedReading() {
    if (!Array.isArray(currentFbRecommendedReadings) || currentFbRecommendedReadings.length === 0) {
        return '';
    }
    return String(currentFbRecommendedReadings[0]?.reading || '').trim();
}

function syncFreeBuildReadingSelection() {
    if (fbSelectedReadingSource === 'manual') {
        return fbSelectedReading || '';
    }

    const autoReading = getFreeBuildTopRecommendedReading() || getSafeFreeBuildAutoReading(fbChoices);
    fbSelectedReading = autoReading || null;
    fbSelectedReadingSource = 'auto';
    return fbSelectedReading || '';
}

function getFreeBuildEffectiveReading() {
    const selected = String(fbSelectedReading || '').trim();
    if (selected) return selected;
    return getFreeBuildTopRecommendedReading() || getSafeFreeBuildAutoReading(fbChoices) || '';
}

function getFreeBuildReadingLabel() {
    const selected = String(fbSelectedReading || '').trim();
    if (selected && fbSelectedReadingSource === 'manual') {
        return selected;
    }

    const effectiveReading = getFreeBuildEffectiveReading();
    if (!effectiveReading) {
        return '読みを選ぶ';
    }

    const hasMultipleCandidates =
        Array.isArray(currentFbRecommendedReadings) && currentFbRecommendedReadings.length > 1;
    return hasMultipleCandidates ? `${effectiveReading} など` : effectiveReading;
}

function refreshFreeBuildReadingButtonLabel() {
    const labelEl = document.getElementById('build-reading-btn-label');
    if (!labelEl) return;
    labelEl.textContent = getFreeBuildReadingLabel();
}

function openStock(tab, options = {}) {
    if (!options.preservePartnerFocus && typeof window.resetMeimayPartnerViewFocus === 'function') {
        window.resetMeimayPartnerViewFocus();
    }
    console.log("BUILD: Opening stock screen");
    changeScreen('scr-stock');
    const targetTab = tab || currentStockTab || 'kanji';
    switchStockTab(targetTab);
    try {
        if (targetTab === 'reading') {
            if (typeof renderReadingStockSection === 'function') renderReadingStockSection();
        } else {
            renderStock();
        }
    } catch (error) {
        console.error('BUILD: Failed to render stock screen', error);
        const container = document.getElementById('stock-list');
        if (container && targetTab !== 'reading') {
            container.innerHTML = `
                <div class="col-span-5 text-center py-20">
                    <p class="text-[#bca37f] italic text-lg mb-2">ストックの表示で問題が起きました</p>
                    <p class="text-sm text-[#a6967a]">もう一度開くと直ることがあります。</p>
                </div>
            `;
        }
    }
}

/**
 * 自由ビルド：ビルド画面を自由モードで開く
 */
function openFreeBuild() {
    console.log('BUILD: openFreeBuild → scr-build/free-mode');
    if (!liked || liked.length === 0) {
        if (typeof showToast === 'function') showToast('まずスワイプで漢字をストックしてください', '!');
        return;
    }
    buildMode = 'free';
    fbChoices = []; fbChoicesUseMark = {};
    shownFbSlots = 1;
    fbSelectedReading = null;
    currentFbRecommendedReadings = [];
    selectedPieces = [];
    renderBuildSelection();
    changeScreen('scr-build');
}

/**
 * ストック画面に自由ビルドセクションを描画する
 * 1文字目?最大3文字目まで横スクロールで漢字を選べる
 */

/**
 * スクロール位置を保持しながら処理を実行するヘルパー
 */
function withScrollPreservation(callback) {
    const scrollPositions = Array.from(document.querySelectorAll('.overflow-x-auto'))
        .map(el => el.scrollLeft);

    callback();

    const restore = () => {
        document.querySelectorAll('.overflow-x-auto').forEach((el, index) => {
            if (scrollPositions[index] !== undefined) {
                el.scrollLeft = scrollPositions[index];
            }
        });
    };

    requestAnimationFrame(() => {
        restore();
        // 念のため少し遅れてもう一度（レンダリング遅延対策）
        setTimeout(() => {
            restore();
        }, 30);
    });
}

function renderFreeBuildSection() {
    const container = document.getElementById('free-build-section');
    if (!container) return;

    // ストックから重複なし全漢字を取得
    const allKanji = [];
    const seen = new Set();
    const displaySeen = new Set();
    liked.forEach(item => {
        const displayKey = getLikedCandidateDisplayKey(item);
        if (!displayKey || displaySeen.has(displayKey)) return;
        displaySeen.add(displayKey);
        allKanji.push(item);
    });
    if (false) {
    liked.forEach(item => {
        if (!seen.has(item['漢字'])) {
            seen.add(item['漢字']);
            allKanji.push(item);
        }
    });
    }

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
                    ${selected ? `<span class="text-xs text-[#a6967a] cursor-pointer hover:text-[#f28b82]" onclick="removeFbChoice(${slotIdx})">× 解除</span>` : ''}
                </div>
                
                <div class="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                    ${allKanji.map(item => {
            const k = item['漢字'];
            const isSelected = fbChoices[slotIdx] === k;
            const isUsed = fbChoices.includes(k) && !isSelected;
            return `<button onclick="selectFbKanji(${slotIdx}, '${k}')"
                            class="shrink-0 w-14 h-14 rounded-2xl border-2 flex flex-col items-center justify-center text-xl font-black transition-all active:scale-90
                            ${isSelected ? 'bg-white text-[#bca37f] ring-2 ring-[#bca37f]/30' :
                    isUsed ? 'opacity-50 border-[#ede5d8] text-[#c8b99a]' :
                        'border-[#ede5d8] bg-white text-[#5d5444] hover:border-[#bca37f]'}"
                            style="${isSelected && (typeof getGradientFromTags === 'function') ? `border:none; padding:2px; background-image: linear-gradient(white, white), ${getGradientFromTags((typeof getUnifiedTags === 'function') ? getUnifiedTags(item['分類'] || '') : [])}; background-origin: border-box; background-clip: content-box, border-box;` : ''}">
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
        const givenName = fbChoices.map((c, i) => getFbDisplayKanji(i) || '').join('');
        fortuneHtml = `
            <div class="mt-4 border-t border-[#ede5d8] pt-4">
                <p class="text-xs font-bold text-[#8b7e66] mb-3">運勢TOP10</p>
                <button onclick="showFortuneRanking()" class="w-full max-w-[300px] py-2.5 bg-white border-2 border-[#bca37f] text-[#bca37f] rounded-2xl shadow-sm transition-all hover:bg-[#bca37f] hover:text-white flex flex-col items-center justify-center gap-0.5 active:scale-95 mx-auto">
                    <div class="text-sm font-bold">🏆 運勢TOP10</div>
                    <div class="text-[10px] font-medium opacity-80">候補から運勢が良い組み合わせを自動計算</div>
                </button>
                <div id="fb-fortune-area" class="space-y-2 mt-4">
                    <div class="text-[10px] font-bold text-[#a6967a] mb-2">今の組み合わせの運勢（${givenName}）</div>
                    ${renderFbFortune(fbChoices)}
                </div>
                <button onclick="confirmFbBuild()" class="btn-gold py-4 shadow-xl w-full mt-4">
                    この名前で姓名判断をする
                </button>
            </div>
        `;
    }

    container.innerHTML = html + fortuneHtml;
}

// 漢字を選択（選び直しても他のスロットは保持）
function selectFbKanji(slotIdx, kanji) {
    if (fbChoices[slotIdx] === kanji) {
        if (slotIdx > 0 && fbChoices[slotIdx - 1] === kanji) {
            fbChoicesUseMark[slotIdx] = !fbChoicesUseMark[slotIdx];
        }
    } else {
        fbChoices[slotIdx] = kanji;
        if (slotIdx > 0 && fbChoices[slotIdx - 1] === kanji) fbChoicesUseMark[slotIdx] = true;
        else fbChoicesUseMark[slotIdx] = false;
    }
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
    fbChoices.splice(slotIdx, 1); for(let i=slotIdx; i<10; i++) fbChoicesUseMark[i] = fbChoicesUseMark[i+1];
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
            const likedItem = liked.find(l => l['漢字'] === k);
            if (likedItem) {
                return getFortuneStrokeValue(likedItem);
            }
            const item = master?.find(m => m['漢字'] === k);
            return getFortuneStrokeValue(item);
        });
        const surnameStrokes = surnameData.map(getFortuneStrokeValue);
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
            const fortune = r.value?.fortune || '--';
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
function getFreeBuildRankingCandidatePool() {
    const source = typeof getMergedLikedCandidates === 'function'
        ? getMergedLikedCandidates()
        : (Array.isArray(liked) ? liked : []);
    const seen = new Set();
    const pool = [];

    source.forEach((item) => {
        const displayKey = getLikedCandidateDisplayKey(item);
        const kanji = String(item?.['漢字'] || item?.kanji || '').trim();
        if (!displayKey || seen.has(displayKey) || excludedKanjiFromBuild.includes(displayKey) || excludedKanjiFromBuild.includes(kanji)) return;
        if (item?.isSuper) {
            seen.add(displayKey);
            pool.push(item);
        }
    });

    source.forEach((item) => {
        const displayKey = getLikedCandidateDisplayKey(item);
        const kanji = String(item?.['漢字'] || item?.kanji || '').trim();
        if (!displayKey || seen.has(displayKey) || excludedKanjiFromBuild.includes(displayKey) || excludedKanjiFromBuild.includes(kanji)) return;
        seen.add(displayKey);
        pool.push(item);
    });

    return pool;
}

function getFreeBuildRankingCandidateItem(kanji, pool = getFreeBuildRankingCandidatePool()) {
    const key = String(kanji || '').trim();
    if (!key) return null;

    const exactDisplay = pool.find((entry) => getLikedCandidateDisplayKey(entry) === key);
    if (exactDisplay) return exactDisplay;

    const poolItem = pool.find((entry) => String(entry?.['漢字'] || entry?.kanji || '').trim() === key);
    if (poolItem) return poolItem;

    if (typeof master !== 'undefined' && Array.isArray(master)) {
        const masterItem = master.find((entry) => String(entry?.['漢字'] || entry?.kanji || '').trim() === key);
        if (masterItem) {
            return {
                ...masterItem,
                '漢字': key,
                '画数': masterItem['画数'] ?? 0
            };
        }
    }

    return { '漢字': key, '画数': 1 };
}

function getFreeBuildReadingInfo(choices) {
    const readingFallback = getSafeFreeBuildAutoReading(choices || []);
    if (!Array.isArray(choices) || choices.length === 0) {
        return { candidates: [], reading: readingFallback, label: readingFallback };
    }
    if (typeof master === 'undefined' || !Array.isArray(master) || master.length === 0) {
        return { candidates: [], reading: readingFallback, label: readingFallback };
    }

    const dictionaryReadings = Array.isArray(readingsData) ? readingsData : [];
    const allowedReadings = getAllowedReadingsForBuild(gender);
    const selectedName = choices.join('');

    function getKanjiReadings(kanji, mode = 'all') {
        const rec = master.find((m) => m['漢字'] === kanji);
        if (!rec) return [];
        const raw = mode === 'on'
            ? (rec['音'] || '')
            : [rec['音'] || '', rec['訓'] || '', rec['伝統名のり'] || ''].join(',');
        return [...new Set(
            String(raw)
                .split(/[、,・\/\s]+/)
                .map((r) => typeof toHira === 'function'
                    ? toHira(r.trim())
                    : r.trim().replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60)))
                .filter((r) => r && r.length >= 1 && /^[ぁ-ゖー]+$/.test(r))
        )];
    }

    function cartesian(arrays) {
        return arrays.reduce((acc, curr) => {
            const result = [];
            acc.forEach((a) => curr.forEach((c) => result.push(a + c)));
            return result;
        }, ['']);
    }

    const readingArrays = choices.map((kanji) => getKanjiReadings(kanji));
    if (readingArrays.some((arr) => arr.length === 0)) {
        return { candidates: [], reading: readingFallback, label: readingFallback };
    }

    const combinedSet = new Set(cartesian(readingArrays));
    const candidates = dictionaryReadings.filter((entry) => {
        const normalizedReading = normalizeReadingLookupKey(entry?.reading);
        if (!normalizedReading || !combinedSet.has(normalizedReading)) return false;
        if (allowedReadings && !allowedReadings.has(normalizedReading)) return false;
        return true;
    }).map((entry) => {
        let score = 0;
        if (entry.tags && typeof userTags !== 'undefined') {
            entry.tags.forEach((tag) => {
                if (userTags[tag]) score += userTags[tag];
            });
        }
        const exampleText = String(entry.examples || '');
        const exactNameMatch = selectedName && exampleText.includes(selectedName);
        return {
            ...entry,
            _score: score,
            _exactNameMatch: exactNameMatch ? 1 : 0,
            _popularBoost: entry.isPopular ? 1 : 0
        };
    }).sort((a, b) => {
        if (a._exactNameMatch !== b._exactNameMatch) return b._exactNameMatch - a._exactNameMatch;
        if (a._score !== b._score) return b._score - a._score;
        if (a._popularBoost !== b._popularBoost) return b._popularBoost - a._popularBoost;
        return (b.count || 0) - (a.count || 0);
    });

    const topReading = String(candidates[0]?.reading || '').trim();
    const reading = topReading || readingFallback;
    const label = topReading
        ? (candidates.length > 1 ? `${topReading} など` : topReading)
        : readingFallback;

    return { candidates, reading, label };
}

function getFortuneRankingScore(fortune, pieces = []) {
    let score = 0;
    if (fortune) {
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

        score += getLuckScore(fortune.so?.res?.label) * 2.0;
        score += getLuckScore(fortune.jin?.res?.label) * 1.5;
        score += getLuckScore(fortune.chi?.res?.label) * 1.2;
        score += getLuckScore(fortune.gai?.res?.label) * 1.0;
        score += getLuckScore(fortune.ten?.res?.label) * 0.5;

        if (fortune.sansai) {
            if (fortune.sansai.label === '大吉') score += 1500;
            else if (fortune.sansai.label === '吉') score += 800;
            else if (fortune.sansai.label === '中吉') score += 300;
        }

        const val = fortune.so?.val;
        if ([15, 16, 21, 23, 24, 31, 32, 41, 45].includes(val)) score += 500;
    }

    const superCount = (Array.isArray(pieces) ? pieces : []).filter((piece) => piece && piece.isSuper).length;
    score += superCount * 100;
    return score;
}

function buildFreeBuildFortuneRanking() {
    const pool = getFreeBuildRankingCandidatePool();
    if (pool.length === 0) return [];

    const totalSlots = Math.max(1, Math.min(3, Number(shownFbSlots) || fbChoices.length || 1));
    const fixedFirstKanji = totalSlots > 1 ? String(fbChoices[0] || '').trim() : '';
    const fixedPieces = fixedFirstKanji ? [getFreeBuildRankingCandidateItem(fixedFirstKanji, pool)].filter(Boolean) : [];
    const variableSlots = Math.max(1, totalSlots - fixedPieces.length);
    const ranked = [];

    function walk(depth, pieces) {
        if (depth === variableSlots) {
            const givArr = pieces.map((piece) => ({
                kanji: piece['漢字'],
                strokes: parseInt(piece['画数']) || 0
            }));
            const fortune = typeof FortuneLogic !== 'undefined' && FortuneLogic.calculate
                ? FortuneLogic.calculate(surnameData, givArr)
                : null;
            ranked.push({
                combination: {
                    pieces,
                    name: pieces.map((piece) => piece['漢字']).join(''),
                    reading: '',
                    readingLabel: ''
                },
                fortune,
                score: getFortuneRankingScore(fortune, pieces)
            });
            return;
        }

        pool.forEach((item) => {
            walk(depth + 1, [...pieces, item]);
        });
    }

    walk(0, fixedPieces);

    return ranked
        .sort((a, b) => b.score - a.score)
        .slice(0, 10)
        .map((item) => {
            const choices = item.combination.pieces.map((piece) => piece['漢字']);
            const readingInfo = getFreeBuildReadingInfo(choices);
            return {
                ...item,
                combination: {
                    ...item.combination,
                    reading: readingInfo.reading,
                    readingLabel: readingInfo.label || readingInfo.reading
                }
            };
        });
}

function applyFreeRankedCombination(combination) {
    if (!combination || !Array.isArray(combination.pieces)) return;

    fbChoices = combination.pieces.map((piece) => piece['漢字']).filter(Boolean);
    fbChoicesUseMark = {};
    fbChoices.forEach((kanji, idx) => {
        fbChoicesUseMark[idx] = idx > 0 && fbChoices[idx - 1] === kanji;
    });
    shownFbSlots = Math.max(1, Math.min(3, fbChoices.length || 1));
    fbSelectedReading = combination.reading || null;
    currentFbRecommendedReadings = [];

    closeFortuneDetail();
    withScrollPreservation(() => {
        renderBuildSelection();
        executeFbBuild();
    });
}

function confirmFbBuild() {
    const givenName = fbChoices.map((c, i) => getFbDisplayKanji(i) || '').join('');
    if (!givenName) return;
    const combination = fbChoices.map(k =>
        liked.find(l => l['漢字'] === k) || master?.find(m => m['漢字'] === k) || { '漢字': k, '画数': 1 }
    );
    const givenReading = fbSelectedReading || getSafeFreeBuildAutoReading(fbChoices);
    if (typeof openSaveScreen === 'function') {
        openSaveScreen(combination, givenName, givenReading);
    } else {
        showToast(`${givenName} でビルドします`, '▶');
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
    allTabs.forEach(t => t && (t.className = 'flex-1 rounded-xl px-3 py-2 text-sm font-bold text-center text-[#a6967a] transition-all'));
    allPanels.forEach(p => p && p.classList.add('hidden'));

    if (readingTab) readingTab.textContent = '読み';
    if (kanjiTab) kanjiTab.textContent = '漢字';

    if (tab === 'reading') {
        if (readingTab) readingTab.className = 'flex-1 rounded-xl px-3 py-2 text-sm font-bold text-center bg-[#fffbeb] text-[#5d5444] shadow-sm transition-all';
        if (readingPanel) readingPanel.classList.remove('hidden');
        if (typeof renderReadingStockSection === 'function') renderReadingStockSection();
    } else {
        // kanji (default)
        if (kanjiTab) kanjiTab.className = 'flex-1 rounded-xl px-3 py-2 text-sm font-bold text-center bg-[#fffbeb] text-[#5d5444] shadow-sm transition-all';
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
    const historyLookup = getLatestReadingHistoryLookup();

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

        const seg = isCompoundSlotPlaceholder(segRaw) ? getReadableSegmentForItem(item, historyLookup) : segRaw;
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
            const hasStockStars = !!item?.isSuper || !!item?.ownSuper || !!item?.partnerSuper;
            card.className = `stock-card relative${hasStockStars ? ' has-stock-stars' : ''}`;
            card.onclick = () => showDetailByData(item);

            // Hydrate values from master if missing (due to data minification)
            let displayStrokes = item['画数'];
            if (displayStrokes === undefined && typeof master !== 'undefined') {
                const m = master.find(k => k['漢字'] === item['漢字']);
                if (m) displayStrokes = m['画数'];
            }

            // タグ色の取得
            const unifiedTags = (typeof getUnifiedTags === 'function') ? getUnifiedTags(item['分類'] || '') : [];
            const bgGradient = (typeof getGradientFromTags === 'function') ? getGradientFromTags(unifiedTags) : '';
            if (bgGradient) {
               card.style.border = 'none';
               card.style.padding = '2px';
               card.style.backgroundImage = `linear-gradient(white, white), ${bgGradient}`;
               card.style.backgroundOrigin = 'border-box';
               card.style.backgroundClip = 'content-box, border-box';
            }

            const partnerBadge = item.partnerAlsoPicked
                ? getPartnerChipHTML({ partnerAlsoPicked: true })
                : item.fromPartner
                    ? getPartnerChipHTML({ fromPartner: true })
                    : '';

            card.innerHTML = `
                ${item.isSuper ? '<div class="stock-stars">★</div>' : ''}
                <div class="stock-kanji">${item['漢字']}</div>
                <div class="stock-strokes">${displayStrokes !== undefined ? displayStrokes : '--'}画</div>
                ${partnerBadge ? `<div class="mt-1 flex justify-center">${partnerBadge}</div>` : ''}
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
        icon.textContent = isHidden ? '▼' : '▲';
    }
}

// グローバルに公開
window.toggleReadingGroup = toggleReadingGroup;

function clearKanjiPartnerFocus() {
    if (typeof window.resetMeimayPartnerViewFocus === 'function') {
        window.resetMeimayPartnerViewFocus(['kanjiFocus']);
    } else if (typeof window.setMeimayPartnerViewFocus === 'function') {
        window.setMeimayPartnerViewFocus({ kanjiFocus: 'all' });
    }
    renderStock();
}

function buildLikedCandidateKey(item) {
    if (!item) return '';
    const kanji = item['漢字'] || item.kanji || '';
    const slot = Number.isFinite(Number(item.slot)) ? Number(item.slot) : -1;
    const reading = item.sessionReading || '';
    const segmentsKey = Array.isArray(item.sessionSegments) ? item.sessionSegments.join('/') : '';
    return `${reading}::${slot}::${kanji}::${segmentsKey}`;
}

function getLikedCandidateKanjiKey(item) {
    if (!item) return '';
    return item?.['\u6f22\u5b57'] || item?.kanji || '';
}

function getLikedCandidateDisplayKey(item) {
    if (!item) return '';
    const baseKey = buildLikedCandidateKey(item);
    if (!baseKey) return '';
    return `${item?.fromPartner ? 'partner' : 'self'}::${baseKey}`;
}

function matchesLikedCandidateTarget(item, target) {
    const normalizedTarget = String(target || '').trim();
    if (!item || !normalizedTarget) return false;

    const displayKey = getLikedCandidateDisplayKey(item);
    const baseKey = buildLikedCandidateKey(item);
    const kanjiKey = getLikedCandidateKanjiKey(item);
    const rawKanji = String(item?.['\u8c8c\uff61\u87c4\uff65'] || item?.kanji || '').trim();

    return displayKey === normalizedTarget
        || baseKey === normalizedTarget
        || kanjiKey === normalizedTarget
        || rawKanji === normalizedTarget;
}

function findLikedCandidateByTarget(target, source = null) {
    const normalizedTarget = String(target || '').trim();
    if (!normalizedTarget) return null;

    const items = Array.isArray(source)
        ? source
        : (typeof getMergedLikedCandidates === 'function'
            ? getMergedLikedCandidates()
            : (Array.isArray(liked) ? liked : []));

    return items.find((item) => matchesLikedCandidateTarget(item, normalizedTarget)) || null;
}

function findLocalLikedCandidateByTarget(target) {
    const normalizedTarget = String(target || '').trim();
    if (!normalizedTarget || !Array.isArray(liked)) return null;

    return liked.find((item) => matchesLikedCandidateTarget(hydrateLikedCandidate(item, { fromPartner: item?.fromPartner === true }), normalizedTarget)) || null;
}

function isBuildCandidateExcluded(item) {
    if (!item) return false;
    const displayKey = getLikedCandidateDisplayKey(item);
    const baseKey = buildLikedCandidateKey(item);
    const kanjiKey = getLikedCandidateKanjiKey(item);
    const rawKanji = String(item?.['\u8c8c\uff61\u87c4\uff65'] || item?.kanji || '').trim();
    return [displayKey, baseKey, kanjiKey, rawKanji].some((key) => key && excludedKanjiFromBuild.includes(key));
}

function hydrateLikedCandidate(item, options = {}) {
    const kanji = item?.['\u6f22\u5b57'] || item?.['\u8c8c\uff61\u87c4\uff65'] || item?.kanji || '';
    if (!kanji) return null;
    if (Array.from(kanji).length > 1) return null;

    const fromPartner = options.fromPartner ?? item?.fromPartner === true;

    const masterItem = typeof master !== 'undefined' && Array.isArray(master)
        ? master.find(entry => entry['\u6f22\u5b57'] === kanji)
        : null;

    return {
        ...(masterItem || {}),
        ...(item || {}),
        '\u6f22\u5b57': kanji,
        '\u753b\u6570': item?.['\u753b\u6570'] ?? item?.strokes ?? masterItem?.['\u753b\u6570'] ?? 0,
        '\u5206\u985e': item?.['\u5206\u985e'] ?? item?.category ?? masterItem?.['\u5206\u985e'] ?? '',
        kanji_reading: item?.kanji_reading || masterItem?.kanji_reading || '',
        slot: Number.isFinite(Number(item?.slot)) ? Number(item.slot) : -1,
        sessionReading: item?.sessionReading || '',
        sessionSegments: Array.isArray(item?.sessionSegments) ? item.sessionSegments : [],
        sessionDisplaySegments: Array.isArray(item?.sessionDisplaySegments) ? item.sessionDisplaySegments : [],
        isSuper: !!item?.isSuper,
        ownSuper: fromPartner ? false : !!item?.isSuper,
        partnerSuper: fromPartner ? !!item?.isSuper : false,
        fromPartner,
        partnerAlsoPicked: !!options.partnerAlsoPicked || !!item?.partnerAlsoPicked,
        partnerName: options.partnerName || item?.partnerName || ''
    };
}

function getMergedLikedCandidates() {
    const localLikedItems = (typeof liked !== 'undefined' && Array.isArray(liked))
        ? liked.map(item => hydrateLikedCandidate(item, { fromPartner: item?.fromPartner === true })).filter(Boolean)
        : [];
    const ownItems = localLikedItems.filter(item => !item.fromPartner);
    const pairInsights = typeof window.MeimayPartnerInsights !== 'undefined' ? window.MeimayPartnerInsights : null;
    const partnerName = pairInsights?.getPartnerDisplayName ? pairInsights.getPartnerDisplayName() : '\u30d1\u30fc\u30c8\u30ca\u30fc';
    const partnerLikedSource = pairInsights?.getPartnerLiked
        ? pairInsights.getPartnerLiked()
        : (pairInsights?.getPartnerLikedRaw ? pairInsights.getPartnerLikedRaw() : []);
    const partnerItems = [
        ...(Array.isArray(partnerLikedSource)
            ? partnerLikedSource.map(item => hydrateLikedCandidate(item, { fromPartner: true, partnerName })).filter(Boolean)
            : []),
        ...localLikedItems.filter(item => item.fromPartner)
    ].filter(Boolean);

    const ownKanjiKeys = new Set(ownItems.map(item => getLikedCandidateKanjiKey(item)).filter(Boolean));
    const partnerKanjiKeys = new Set(partnerItems.map(item => getLikedCandidateKanjiKey(item)).filter(Boolean));
    const ownSuperKanjiKeys = new Set(
        ownItems
            .filter(item => !!item?.ownSuper || !!item?.isSuper)
            .map(item => getLikedCandidateKanjiKey(item))
            .filter(Boolean)
    );
    const partnerSuperKanjiKeys = new Set(
        partnerItems
            .filter(item => !!item?.partnerSuper || !!item?.isSuper)
            .map(item => getLikedCandidateKanjiKey(item))
            .filter(Boolean)
    );

    const ownMerged = new Map();
    ownItems.forEach((item) => {
        const key = getLikedCandidateDisplayKey(item);
        if (!key || ownMerged.has(key)) return;
        const kanjiKey = getLikedCandidateKanjiKey(item);
        const partnerAlsoPicked = partnerKanjiKeys.has(kanjiKey);
        const partnerSuper = partnerSuperKanjiKeys.has(kanjiKey);
        ownMerged.set(key, {
            ...item,
            fromPartner: false,
            partnerAlsoPicked,
            partnerSuper,
            isSuper: !!item.ownSuper || partnerSuper
        });
    });

    const partnerMerged = new Map();
    partnerItems.forEach((item) => {
        const key = getLikedCandidateDisplayKey(item);
        if (!key || partnerMerged.has(key)) return;
        const kanjiKey = getLikedCandidateKanjiKey(item);
        const ownAlsoPicked = ownKanjiKeys.has(kanjiKey);
        const ownSuper = ownSuperKanjiKeys.has(kanjiKey);
        partnerMerged.set(key, {
            ...item,
            fromPartner: true,
            partnerAlsoPicked: ownAlsoPicked,
            ownSuper,
            partnerSuper: !!item.partnerSuper || !!item.isSuper,
            isSuper: ownSuper || !!item.partnerSuper || !!item.isSuper
        });
    });

    return [...ownMerged.values(), ...partnerMerged.values()];
}


function getVisibleKanjiStockCardCount(kanjiFocus = 'all', candidatePoolOverride = null) {
    const pairInsights = typeof window.MeimayPartnerInsights !== 'undefined' ? window.MeimayPartnerInsights : null;
    const focus = String(kanjiFocus || 'all');
    const matchedLikedKeys = focus === 'matched' && pairInsights?.getMatchedLikedItems
        ? new Set(
            pairInsights
                .getMatchedLikedItems()
                .map(item => pairInsights.buildLikedMatchKey ? pairInsights.buildLikedMatchKey(item) : '')
                .filter(Boolean)
        )
        : null;

    let validItems = (Array.isArray(candidatePoolOverride)
        ? candidatePoolOverride
        : getMergedLikedCandidates()
    ).filter((item) => {
        if (focus === 'partner' || focus === 'matched') return true;
        if (item.sessionReading === 'FREE') return true;
        return item.slot >= 0 && item.sessionReading !== 'SEARCH';
    });

    if (focus === 'partner') {
        validItems = validItems.filter(item => item.fromPartner);
    }

    if (focus === 'matched') {
        validItems = validItems.filter(item => {
            const key = pairInsights?.buildLikedMatchKey ? pairInsights.buildLikedMatchKey(item) : '';
            return key && matchedLikedKeys?.has(key);
        });
    }

    const historyLookup = typeof getLatestReadingHistoryLookup === 'function'
        ? getLatestReadingHistoryLookup()
        : {};
    const readingToSegments = {};
    const history = typeof getReadingHistory === 'function' ? getReadingHistory() : [];
    history.forEach((entry) => {
        if (!entry || !entry.reading || readingToSegments[entry.reading]) return;
        readingToSegments[entry.reading] = entry.segments;
    });

    const segGroups = {};
    validItems.forEach(item => {
        let segRaw = '\u95be\uff6a\u9015\uff71';
        if (item.sessionReading === 'FREE') {
            segRaw = 'FREE';
        } else if (item.sessionSegments && item.sessionSegments[item.slot]) {
            segRaw = item.sessionSegments[item.slot];
        } else if (readingToSegments[item.sessionReading] && readingToSegments[item.sessionReading][item.slot]) {
            segRaw = readingToSegments[item.sessionReading][item.slot];
        } else if (item.sessionReading) {
            segRaw = item.sessionReading;
        }

        const seg = isCompoundSlotPlaceholder(segRaw)
            ? getReadableSegmentForItem(item, historyLookup)
            : segRaw;
        if (!segGroups[seg]) segGroups[seg] = [];

        const kanjiKey = getLikedCandidateDisplayKey(item);
        const dup = segGroups[seg].find(entry => getLikedCandidateDisplayKey(entry) === kanjiKey);
        if (!dup) {
            segGroups[seg].push(item);
            return;
        }

        dup.isSuper = dup.isSuper || !!item.isSuper;
        dup.fromPartner = dup.fromPartner || !!item.fromPartner;
        dup.partnerAlsoPicked = dup.partnerAlsoPicked || !!item.partnerAlsoPicked;
        dup.partnerName = dup.partnerName || item.partnerName || '';
        dup.ownSuper = dup.ownSuper || !!item.ownSuper || (!item.fromPartner && !!item.isSuper);
        dup.partnerSuper = dup.partnerSuper || !!item.partnerSuper || (item.fromPartner && !!item.isSuper);
        dup.isSuper = dup.ownSuper || dup.partnerSuper;
    });

    return Object.values(segGroups).reduce((sum, items) => sum + items.length, 0);
}

function getVisibleKanjiStockItemCount(candidatePoolOverride = null) {
    const source = Array.isArray(candidatePoolOverride)
        ? candidatePoolOverride
        : (typeof liked !== 'undefined' && Array.isArray(liked) ? liked : []);

    return source.filter(item => {
        if (!item) return false;
        if (item.sessionReading === 'FREE') return true;
        return item.slot >= 0 && item.sessionReading !== 'SEARCH';
    }).length;
}

function getBuildSlotCandidates(seg, idx, currentReading, options = {}) {
    const {
        excluded = [],
        partnerOnly = false,
        matchedOnly = false
    } = options;

    const fixedPiece = getCompoundFixedPieceForSlot(idx);
    if (fixedPiece) {
        return [{ ...fixedPiece }];
    }

    const excludeSet = new Set(Array.isArray(excluded) ? excluded : []);
    return getMergedLikedCandidates().filter((item) => {
        const slotMatch = item.slot === idx;
        const readingMatch = !item.sessionReading || item.sessionReading === currentReading;
        const isPartnerVisible = item.fromPartner;
        const isMatched = item.partnerAlsoPicked;
        const itemDisplayKey = getLikedCandidateDisplayKey(item);
        const isNotExcluded = !excludeSet.has(itemDisplayKey) && !excludeSet.has(item['\u6f22\u5b57']);

        let freeMatch = false;
        if (item.sessionReading === 'FREE') {
            const readings = (item.kanji_reading || '').split(/[\u3001,\uff0c\s/]+/).map(r => typeof toHira === 'function' ? toHira(r) : r).filter(Boolean);
            const targetSeg = typeof toHira === 'function' ? toHira(seg) : seg;
            freeMatch = readings.includes(targetSeg);
        }

        let itemSeg = '';
        if (Array.isArray(item.sessionSegments) && item.slot >= 0 && item.slot < item.sessionSegments.length) {
            itemSeg = item.sessionSegments[item.slot];
        } else if (item.sessionReading && !item.sessionReading.includes('::') && !item.sessionReading.includes('/')) {
            itemSeg = item.sessionReading;
        }

        const targetSegHira = typeof toHira === 'function' && seg ? toHira(seg) : seg || '';
        const itemSegHira = typeof toHira === 'function' && itemSeg ? toHira(itemSeg) : itemSeg || '';
        const segmentMatch = !!(targetSegHira && itemSegHira && targetSegHira === itemSegHira);

        const baseMatch = (slotMatch && readingMatch) || freeMatch || segmentMatch;
        if (!baseMatch || !isNotExcluded) return false;
        if (partnerOnly && !isPartnerVisible) return false;
        if (matchedOnly && !isMatched) return false;
        return true;
    });
}

window.getMergedLikedCandidates = getMergedLikedCandidates;
window.getVisibleKanjiStockCardCount = getVisibleKanjiStockCardCount;
window.getVisibleKanjiStockItemCount = getVisibleKanjiStockItemCount;
window.getBuildSlotCandidates = getBuildSlotCandidates;

function getStockOwnershipKind(item) {
    if (item?.partnerAlsoPicked) return 'matched';
    if (item?.fromPartner) return 'partner';
    return 'self';
}

function getStockCardSurfaceStyle(kind) {
    const palette = typeof window.getMeimayOwnershipPalette === 'function'
        ? window.getMeimayOwnershipPalette(kind)
        : null;
    if (!palette) {
        return {
            card: '',
            kanjiColor: '#5d5444',
            strokesColor: '#a6967a'
        };
    }
    if (kind === 'matched') {
        return {
            card: `border:1px solid transparent;background:${palette.surface} padding-box, linear-gradient(135deg, ${palette.border} 0%, ${palette.borderAlt} 100%) border-box;`,
            kanjiColor: '#5d5444',
            strokesColor: '#8c7281'
        };
    }
    return {
        card: `border:1px solid ${palette.border};background:${palette.surface};`,
        kanjiColor: '#5d5444',
        strokesColor: palette.text || '#a6967a'
    };
}

function getBuildPieceSurfaceStyle(item, isSelected) {
    if (!isSelected) return null;
    const kind = getStockOwnershipKind(item);

    const palette = typeof window.getMeimayOwnershipPalette === 'function'
        ? window.getMeimayOwnershipPalette(kind)
        : null;
    if (!palette) return null;

    if (kind === 'matched') {
        return {
            button: `border:1.5px solid transparent;background:${palette.surface} padding-box, linear-gradient(135deg, ${palette.border} 0%, ${palette.borderAlt} 100%) border-box;`,
            kanjiColor: '#5d5444',
            strokesColor: '#8c7281'
        };
    }

    return {
        button: `border:1.5px solid ${palette.border};background:${palette.surface};`,
        kanjiColor: '#5d5444',
        strokesColor: palette.text || '#a6967a'
    };
}

function applyBuildPieceVisualState(button, item, isSelected) {
    if (!button) return;
    const surfaceStyle = getBuildPieceSurfaceStyle(item, isSelected);
    button.classList.toggle('selected', !!isSelected);
    button.style.cssText = surfaceStyle?.button || '';

    const kanjiEl = button.querySelector('.build-kanji-text');
    if (kanjiEl) {
        kanjiEl.style.color = surfaceStyle?.kanjiColor || '';
    }

    const strokesEl = button.querySelector('.build-piece-strokes');
    if (strokesEl) {
        strokesEl.style.color = surfaceStyle?.strokesColor || '';
    }
}

function getCardSuperFlags(item) {
    return {
        self: !!item?.ownSuper || (!!item?.isSuper && !item?.fromPartner && !item?.partnerSuper),
        partner: !!item?.partnerSuper || (!!item?.isSuper && !!item?.fromPartner && !item?.ownSuper)
    };
}

function renderStockSuperStars(item) {
    const superFlags = getCardSuperFlags(item);
    if (typeof window.renderMeimaySuperStars !== 'function') {
        return superFlags.self || superFlags.partner ? '<div class="stock-stars">★</div>' : '';
    }
    return window.renderMeimaySuperStars({
        self: superFlags.self,
        partner: superFlags.partner,
        className: 'stock-stars',
        style: 'display:flex;justify-content:center;gap:2px;font-size:13px;line-height:1;margin-top:4px;pointer-events:none;'
    });
}

function renderBuildSuperStars(item) {
    const superFlags = getCardSuperFlags(item);
    if (typeof window.renderMeimaySuperStars !== 'function') {
        return superFlags.self || superFlags.partner ? '<div class="build-piece-star">★</div>' : '';
    }
    return window.renderMeimaySuperStars({
        self: superFlags.self,
        partner: superFlags.partner,
        className: 'build-piece-star',
        style: 'display:flex;justify-content:center;gap:2px;font-size:13px;line-height:1;margin-top:4px;pointer-events:none;'
    });
}

function renderStock() {
    const container = document.getElementById('stock-list');
    if (!container) return;

    container.innerHTML = '';

    const partnerViewState = typeof window.getMeimayPartnerViewState === 'function'
        ? window.getMeimayPartnerViewState()
        : { kanjiFocus: 'all' };
    const kanjiFocus = partnerViewState.kanjiFocus || 'all';
    const pairInsights = typeof window.MeimayPartnerInsights !== 'undefined' ? window.MeimayPartnerInsights : null;
    const matchedLikedKeys = kanjiFocus === 'matched' && pairInsights?.getMatchedLikedItems
        ? new Set(
            pairInsights
                .getMatchedLikedItems()
                .map(item => pairInsights.buildLikedMatchKey ? pairInsights.buildLikedMatchKey(item) : '')
                .filter(Boolean)
        )
        : null;

    let validItems = getMergedLikedCandidates().filter(item => {
        if (kanjiFocus === 'partner' || kanjiFocus === 'matched') {
            return true;
        }
        if (item.sessionReading === 'FREE') return true;
        return item.slot >= 0 && item.sessionReading !== 'SEARCH';
    });

if (kanjiFocus === 'partner') {
    validItems = validItems.filter(item => item.fromPartner);
}

    if (kanjiFocus === 'matched') {
        validItems = validItems.filter(item => {
            const key = pairInsights?.buildLikedMatchKey ? pairInsights.buildLikedMatchKey(item) : '';
            return key && matchedLikedKeys?.has(key);
        });
    }

    if (kanjiFocus === 'matched' || kanjiFocus === 'partner') {
        const banner = document.createElement('div');
        banner.className = 'col-span-5 rounded-2xl border border-[#eee5d8] bg-[#fffaf5] px-4 py-3 mb-4';
        banner.innerHTML = `
            <div class="flex items-center justify-between gap-3">
                <div>
                    <div class="text-[10px] font-black tracking-[0.18em] text-[#b9965b] uppercase">${kanjiFocus === 'matched' ? 'Matched' : 'Partner'}</div>
                    <div class="mt-1 text-sm font-bold text-[#4f4639]">${kanjiFocus === 'matched' ? 'おふたりで一致した漢字' : 'パートナーの漢字候補'}</div>
                    <div class="mt-1 text-[11px] text-[#8b7e66]">${kanjiFocus === 'matched' ? '共通で気になっている漢字だけを表示しています。' : '相手が選んだ漢字を、ストックの中で見ています。'}</div>
                </div>
                    <button onclick="clearKanjiPartnerFocus()" class="shrink-0 rounded-full border border-[#eadfce] bg-white px-3 py-1.5 text-[11px] font-bold text-[#8b7e66] active:scale-95">
                    通常表示
                </button>
            </div>
        `;
        container.appendChild(banner);
    }

    if (validItems.length === 0) {
        container.innerHTML += kanjiFocus === 'matched'
            ? `
                <div class="col-span-5 text-center py-20">
                    <p class="text-[#bca37f] italic text-lg mb-2">まだ一致した漢字はありません</p>
                    <p class="text-sm text-[#a6967a]">お互いに気になる漢字が増えると、ここに共通候補が並びます</p>
                </div>
            `
            : kanjiFocus === 'partner'
                ? `
                <div class="col-span-5 text-center py-20">
                    <p class="text-[#bca37f] italic text-lg mb-2">パートナーの漢字候補はまだありません</p>
                    <p class="text-sm text-[#a6967a]">相手が漢字を選ぶと、ここで同じストック内に見られます</p>
                </div>
            `
            : `
                <div class="col-span-5 text-center py-20">
                    <p class="text-[#bca37f] italic text-lg mb-2">まだストックがありません</p>
                    <p class="text-sm text-[#a6967a]">スワイプ画面で漢字を選びましょう</p>
                </div>
            `;
        return;
    }

    const history = typeof getReadingHistory === 'function' ? getReadingHistory() : [];
    const readingToSegments = {};
    history.forEach(h => { readingToSegments[h.reading] = h.segments; });
    const historyLookup = getLatestReadingHistoryLookup();

    const segGroups = {};
    validItems.forEach(item => {
        let segRaw = '自由';
        if (item.sessionReading === 'FREE') {
            segRaw = 'FREE';
        } else if (item.sessionSegments && item.sessionSegments[item.slot]) {
            segRaw = item.sessionSegments[item.slot];
        } else if (readingToSegments[item.sessionReading] && readingToSegments[item.sessionReading][item.slot]) {
            segRaw = readingToSegments[item.sessionReading][item.slot];
        } else if (item.sessionReading) {
            segRaw = item.sessionReading;
        }

        const seg = isCompoundSlotPlaceholder(segRaw) ? getReadableSegmentForItem(item, historyLookup) : segRaw;
        if (!segGroups[seg]) segGroups[seg] = [];

const dup = segGroups[seg].find(e => getLikedCandidateDisplayKey(e) === getLikedCandidateDisplayKey(item));
if (!dup) {
    segGroups[seg].push(item);
} else {
    dup.isSuper = dup.isSuper || !!item.isSuper;
    dup.fromPartner = dup.fromPartner || !!item.fromPartner;
    dup.partnerAlsoPicked = dup.partnerAlsoPicked || !!item.partnerAlsoPicked;
    dup.partnerName = dup.partnerName || item.partnerName || '';
    dup.ownSuper = dup.ownSuper || !!item.ownSuper || (!item.fromPartner && !!item.isSuper);
    dup.partnerSuper = dup.partnerSuper || !!item.partnerSuper || (item.fromPartner && !!item.isSuper);
    dup.isSuper = dup.ownSuper || dup.partnerSuper;
}
    });

    const sortedKeys = Object.keys(segGroups).sort((a, b) => {
        if (a === 'FREE') return 1;
        if (b === 'FREE') return -1;
        return a.localeCompare(b, 'ja');
    });

    sortedKeys.forEach(seg => {
        const items = segGroups[seg];
        if (items.length === 0) return;

        items.sort((a, b) => {
            if (a.isSuper && !b.isSuper) return -1;
            if (!a.isSuper && b.isSuper) return 1;
            return 0;
        });

        const safeId = seg === 'FREE' ? 'FREE' : encodeURIComponent(seg).replace(/%/g, '');
        const segHeader = document.createElement('div');
        segHeader.className = 'col-span-5 mt-6 mb-3 cursor-pointer select-none active:scale-95 transition-transform group';
        segHeader.onclick = () => toggleReadingGroup(safeId);
        segHeader.innerHTML = `
            <div class="flex items-center gap-3">
                <div class="h-px flex-1 bg-[#d4c5af]"></div>
                <span class="text-base font-black text-[#bca37f] px-4 py-1.5 bg-white rounded-full border border-[#d4c5af] flex items-center gap-2 shadow-sm group-hover:bg-[#f8f5ef] transition-colors">
                    <span id="icon-${safeId}" class="text-xs transition-transform">▼</span>
                    ${seg} <span class="text-xs ml-1 text-[#a6967a]">(${items.length}件)</span>
                </span>
                <div class="h-px flex-1 bg-[#d4c5af]"></div>
            </div>
        `;
        container.appendChild(segHeader);

        const cardsGrid = document.createElement('div');
        cardsGrid.id = `group-${safeId}`;
        cardsGrid.className = 'col-span-5 grid grid-cols-5 gap-2 mb-4 transition-all duration-300 transform origin-top';

        items.forEach(item => {
            const card = document.createElement('div');
            const hasStockStars = !!item?.isSuper || !!item?.ownSuper || !!item?.partnerSuper;
            card.className = `stock-card relative${hasStockStars ? ' has-stock-stars' : ''}`;
            card.onclick = () => showDetailByData(item);

            let displayStrokes = item['画数'];
            if (displayStrokes === undefined && typeof master !== 'undefined') {
                const m = master.find(k => k['漢字'] === item['漢字']);
                if (m) displayStrokes = m['画数'];
            }

            const ownershipKind = getStockOwnershipKind(item);
            const surfaceStyle = getStockCardSurfaceStyle(ownershipKind);
            card.style.cssText = `${surfaceStyle.card}; padding:10px 6px;`;

            card.innerHTML = `
                <div class="stock-kanji" style="color:${surfaceStyle.kanjiColor}">${item.kanji || item['漢字'] || ''}</div>
                <div class="stock-strokes" style="color:${surfaceStyle.strokesColor}">${displayStrokes !== undefined ? displayStrokes : '--'}画</div>
                ${renderStockSuperStars(item)}
            `;
            cardsGrid.appendChild(card);
        });

        container.appendChild(cardsGrid);
    });
}

window.clearKanjiPartnerFocus = clearKanjiPartnerFocus;

/**
 * ビルド画面を開く
 */
function openBuild() {
    console.log("BUILD: Opening build screen");
    window._addMoreFromBuild = false; // addMoreToSlot フラグをクリア
    hydrateCompoundBuildSelections();
    buildMode = 'reading';
    fbChoices = []; fbChoicesUseMark = {};
    excludedKanjiFromBuild = []; // 除外リストをリセット
    renderBuildSelection();
    changeScreen('scr-build');
    if (selectedPieces.filter(Boolean).length === segments.length && typeof executeBuild === 'function') {
        executeBuild();
    }
}

/**
 * 自由に選ぶモード完了後にビルド画面を自由組み立てモードで開く
 */
function openBuildFreeMode() {
    console.log("BUILD: Opening build screen in free mode");
    window._addMoreFromBuild = false;
    if (typeof window.clearCompoundBuildFlow === 'function') {
        window.clearCompoundBuildFlow();
    }
    selectedPieces = [];
    buildMode = 'free';
    fbChoices = []; fbChoicesUseMark = {};
    shownFbSlots = 1;
    excludedKanjiFromBuild = []; // 除外リストをリセット
    renderBuildSelection();
    changeScreen('scr-build');
}
window.openBuildFreeMode = openBuildFreeMode;

function openBuildFreeModeWithChoices(choices = [], reading = '') {
    console.log("BUILD: Opening build screen in free mode with seeded choices");
    window._addMoreFromBuild = false;
    if (typeof window.clearCompoundBuildFlow === 'function') {
        window.clearCompoundBuildFlow();
    }

    selectedPieces = [];
    buildMode = 'free';
    fbChoices = (Array.isArray(choices) ? choices : []).filter(Boolean);
    shownFbSlots = Math.max(1, Math.min(3, fbChoices.length || 1));
    fbSelectedReading = reading || null;
    excludedKanjiFromBuild = [];

    currentFbRecommendedReadings = fbSelectedReading
        ? [{ reading: fbSelectedReading, score: 999999 }]
        : [];

    renderBuildSelection();
    changeScreen('scr-build');

    if (typeof executeFbBuild === 'function' && fbChoices.length > 0) {
        executeFbBuild();
    }
}
window.openBuildFreeModeWithChoices = openBuildFreeModeWithChoices;

/**
 * ビルドモードを切り替える
 */
function setBuildMode(mode) {
    const prevMode = buildMode;
    buildMode = mode;
    // モードが実際に切り替わる場合のみ選択状態をリセット
    // （すでにfreeモードの場合はfbChoices/shownFbSlotsを保持）
    if (prevMode !== mode || mode === 'reading') {
        fbChoices = []; fbChoicesUseMark = {};
        if (mode === 'free') shownFbSlots = 1;
        selectedPieces = [];
        if (mode === 'reading') {
            hydrateCompoundBuildSelections();
        }
        excludedKanjiFromBuild = []; // モード切替時にリセット
    }
    const resultArea = document.getElementById('build-result-area');
    if (resultArea) resultArea.innerHTML = '';
    renderBuildSelection();
}
window.setBuildMode = setBuildMode;

/**
 * 保存フッターの有効状態を同期
 */
function syncBuildSaveButton(canSave) {
    const btn = document.getElementById('build-save-btn');
    if (!btn) return;
    btn.disabled = !canSave;
    btn.setAttribute('aria-disabled', String(!canSave));
}

/**
 * 固定ヘッダー（名前プレビュー）を更新
 */
function updateNamePreview() {
    const preview = document.getElementById('build-name-preview');
    if (!preview) return;

    let givenKanji = '';
    let givenReading = '';

    if (buildMode === 'free') {
        givenKanji = fbChoices.length > 0 ? fbChoices.map((c, i) => getFbDisplayKanji(i) || '').join('') : '';
        givenReading = fbSelectedReading || '';
    } else {
        const chosen = [];
        const chosenReads = [];
        const hasCompoundFixedPiece = selectedPieces.some((item) => item && item._compoundFixed);
        if (selectedPieces && selectedPieces.length > 0) {
            selectedPieces.forEach((item, i) => {
                if (item) {
                    chosen.push(item['漢字']);
                    const seg = (item.sessionSegments && item.sessionSegments[i]) || segments[i] || '';
                    if (!String(seg).startsWith('__compound_slot_')) {
                        chosenReads.push(seg);
                    }
                }
            });
        }
        givenKanji = chosen.length > 0 ? chosen.join('') : '';
        givenReading = hasCompoundFixedPiece
            ? (typeof getCurrentSessionReading === 'function' ? getCurrentSessionReading() : segments.join(''))
            : (chosenReads.join('') || (typeof getCurrentSessionReading === 'function' ? getCurrentSessionReading() : segments.join('')));
    }

    const surname = surnameStr || '';
    const surnameRuby = typeof surnameReading !== 'undefined' && surnameReading ? surnameReading :
        (surnameData && surnameData.length > 0 ? surnameData.map(s => s['読み'] || '').join('') : '');

    const renderSurname = surname ? `<div class="flex flex-col items-center">
            <p class="text-[10px] text-[#a6967a] h-3.5 mb-0.5">${surnameRuby || ''}</p>
            <p class="text-3xl font-black text-[#5d5444] tracking-widest">${surname}</p>
        </div>` : '';

    const renderGiven = givenKanji ? `<div class="flex flex-col items-center">
            <p class="text-[10px] text-[#a6967a] h-3.5 mb-0.5">${givenReading || ''}</p>
            <p class="text-3xl font-black text-[#5d5444] tracking-widest">${givenKanji}</p>
        </div>` : '';

    // --- 運勢・保存ボタン（常に表示、条件で無効化） ---
    // 読みモードは全スロットが埋まったときのみ有効
    const isComplete = buildMode === 'free'
        ? (fbChoices && fbChoices.length > 0)
        : (selectedPieces && selectedPieces.filter(x => x).length === segments.length);

    let fortuneData = null;
    if (surnameStr && givenKanji && isComplete && typeof FortuneLogic !== 'undefined' && FortuneLogic.calculate) {
        const chars = givenKanji.split('');
        const givArr = chars.map(ch => {
            if (typeof selectedPieces !== 'undefined' && selectedPieces) {
                const found = selectedPieces.find(p => p && p['\u6f22\u5b57'] === ch);
                if (found) return { kanji: ch, strokes: parseInt(found['\u753b\u6570']) || 0 };
            }
            if (typeof master !== 'undefined' && master) {
                const m = master.find(m => m['\u6f22\u5b57'] === ch);
                if (m) return { kanji: ch, strokes: parseInt(m['\u753b\u6570']) || 0 };
            }
            return { kanji: ch, strokes: 0 };
        });
        const tempSurname = (typeof surnameData !== 'undefined' && surnameData && surnameData.length > 0)
            ? surnameData : [{ kanji: '', strokes: 0 }];
        fortuneData = FortuneLogic.calculate(tempSurname, givArr);
        if (typeof currentBuildResult !== 'undefined') {
            currentBuildResult = currentBuildResult || {};
            currentBuildResult.fortune = fortuneData;
            currentBuildResult.fullName = (surnameStr ? surnameStr + ' ' : '') + givenKanji;
            currentBuildResult.reading = (surnameRuby ? surnameRuby + ' ' : '') + givenReading;
            currentBuildResult.givenName = givenKanji;
            currentBuildResult.combination = givArr.map(g => ({ '\u6f22\u5b57': g.kanji, '\u753b\u6570': g.strokes }));
        }
    }

    const canSave = !!(givenKanji && isComplete);
    const canFortune = !!(fortuneData);

    // \u30dc\u30bf\u30f3\u5185\u306e\u30e9\u30d9\u30eb
    const fortuneLabel = fortuneData ? `
        <div class="flex items-center justify-center gap-1 mb-0.5 px-1">
            <span class="text-[8px] font-bold text-[#a6967a] leading-none">総格</span>
            <span class="text-[10px] font-black ${fortuneData.so.res.color} leading-none whitespace-nowrap">${fortuneData.so.res.label}</span>
        </div>
        <span class="text-[15px] leading-none mb-0.5">\ud83d\udd2e</span>
        <span class="text-[7px] font-bold text-[#bca37f] leading-none">運勢詳細</span>
    ` : `
        <span class="text-[15px] leading-none mb-0.5 text-[#d4c5af]">\ud83d\udd2e</span>
        <span class="text-[7px] font-bold text-[#d4c5af] leading-none">運勢</span>
    `;

    // キャンバスと横幅を左右対称にするため w-[64px] に統一
    const BTN_W = 'w-[64px]';
    const rightButtons = `<div class="build-right-actions flex flex-col gap-1.5 flex-shrink-0 self-stretch justify-center">
        <button onclick="showFortuneRanking()" class="flex-1 flex flex-col items-center justify-center px-1 rounded-xl border ${BTN_W} transition-all active:scale-95 bg-[#fdfaf5] border-[#bca37f] shadow-sm hover:scale-105">
            <span class="text-[15px] leading-none mb-0.5">🏆</span>
            <span class="text-[7px] font-bold leading-none text-[#5d5444] whitespace-nowrap">運勢TOP10</span>
        </button>
        <button onclick="saveName()" ${canSave ? '' : 'disabled'} class="flex-1 flex flex-col items-center justify-center px-1 rounded-xl border ${BTN_W} transition-all active:scale-95 ${canSave ? 'bg-[#fdfaf5] border-[#bca37f] shadow-sm hover:scale-105' : 'bg-white/50 border-[#eee5d8] opacity-40 cursor-not-allowed'}">
            <span class="text-[18px] leading-none mb-1">\ud83d\udcbe</span>
            <span class="text-[8px] font-bold leading-none ${canSave ? 'text-[#5d5444]' : 'text-[#a6967a]'}">保存</span>
        </button>
        <button onclick="${canFortune ? 'showFortuneDetail()' : ''}" ${canFortune ? '' : 'disabled'} class="flex-1 flex flex-col items-center justify-center px-1 rounded-xl border ${BTN_W} transition-all active:scale-95 ${canFortune ? 'bg-[#fdfaf5] border-[#bca37f] shadow-sm hover:scale-105' : 'bg-white/50 border-[#eee5d8] opacity-40 cursor-not-allowed'}">
            ${fortuneLabel}
        </button>
    </div>`;

    const canvasClasses = 'relative flex items-center justify-center min-h-[88px] bg-white rounded-2xl border border-[#eee5d8] shadow-[0_2px_10px_-4px_rgba(188,163,127,0.3)] px-3 py-3 flex-1 overflow-hidden before:absolute before:inset-1 before:border before:border-dashed before:border-[#d4c5af] before:rounded-xl before:pointer-events-none';

    if (!renderSurname && !renderGiven) {
        preview.innerHTML = `<div class="flex items-stretch gap-2 mt-1 mb-3 px-1">
            <div class="${canvasClasses}">
                <div class="flex flex-col items-center z-10">
                    <p class="text-sm font-black text-[#d4c5af] tracking-wider">\u30fc \u547d\u540d\u30ad\u30e3\u30f3\u30d0\u30b9 \u30fc</p>
                    <p class="text-[10px] text-[#d4c5af] mt-0.5">\u6f22\u5b57\u3092\u9078\u629e\u3057\u3066\u540d\u524d\u3092\u4f5c\u6210\u3057\u3066\u304f\u3060\u3055\u3044</p>
                </div>
            </div>
            ${rightButtons}
        </div>`;
        syncBuildSaveButton(canSave);
        return;
    }

    if (renderSurname && !renderGiven) {
        preview.innerHTML = `<div class="flex items-stretch gap-2 mt-1 mb-3 px-1">
            <div class="${canvasClasses}">
                <div class="flex items-end gap-2 z-10 min-w-0 flex-wrap justify-center">
                    ${renderSurname}
                    <div class="flex flex-col items-center">
                        <p class="text-[10px] text-[#a6967a] h-3.5 mb-0.5"></p>
                        <p class="text-3xl font-black text-[#d4c5af] tracking-widest border-b-2 border-dashed border-[#d4c5af] pb-1 px-2">?</p>
                    </div>
                </div>
            </div>
            ${rightButtons}
        </div>`;
        syncBuildSaveButton(canSave);
        return;
    }

    // scale font for long names
    const totalChars = (surnameStr || '').length + (givenKanji || '').length;
    const nameFontClass = totalChars >= 7 ? 'text-xl' : totalChars >= 6 ? 'text-2xl' : 'text-3xl';
    const renderSurnameScaled = surname ? `<div class="flex flex-col items-center">
            <p class="text-[10px] text-[#a6967a] h-3.5 mb-0.5">${surnameRuby || ''}</p>
            <p class="font-black text-[#5d5444] tracking-widest ${nameFontClass}">${surname}</p>
        </div>` : '';
    const renderGivenScaled = givenKanji ? `<div class="flex flex-col items-center">
            <p class="text-[10px] text-[#a6967a] h-3.5 mb-0.5">${givenReading || ''}</p>
            <p class="font-black text-[#5d5444] tracking-widest ${nameFontClass}">${givenKanji}</p>
        </div>` : '';

    preview.innerHTML = `<div class="flex items-stretch gap-2 mt-1 mb-3 px-1">
            <div class="${canvasClasses}">
                <div class="flex items-end gap-2 z-10 flex-wrap justify-center">
                    ${renderSurnameScaled}
                    ${renderGivenScaled}
                </div>
            </div>
            ${rightButtons}
        </div>`;
    syncBuildSaveButton(canSave);
}

/**
 * ビルド選択画面のレンダリング
 */

function renderBuildSelection() {
    const container = document.getElementById('build-selection');
    const headerContainer = document.getElementById('build-header-sticky');
    if (!container || !headerContainer) return;

    if (buildMode === 'free' && fbChoices.length === 0) {
        fbSelectedReading = null;
        currentFbRecommendedReadings = [];
    }

    container.innerHTML = '';
    headerContainer.innerHTML = '';

    const currentReading = getSafeBuildCurrentReading();

    const modeBar = document.createElement('div');
    modeBar.className = 'relative w-full';
    const readingBtnLabel = buildMode === 'reading' && currentReading
        ? `\u8aad\u307f\uff08${currentReading}\uff09`
        : '\u8aad\u307f\u3092\u9078\u3076';

    modeBar.innerHTML = `
        <div class="flex rounded-2xl border border-[#eee5d8] bg-white p-1 shadow-sm" id="build-tabs">
            <button onclick="toggleReadingDropdown()" id="reading-mode-btn"
                class="flex-1 rounded-xl px-3 py-2 text-sm font-bold text-center transition-all ${buildMode === 'reading'
            ? 'bg-[#fffbeb] text-[#5d5444] shadow-sm'
            : 'text-[#a6967a]'}">
                <span class="inline-flex items-center justify-center gap-1.5 min-w-0 w-full">
                    <span style="display:block;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:clamp(12px,2.9vw,15px);line-height:1.2;">${readingBtnLabel}</span>
                    <span id="reading-mode-caret" class="text-[11px] leading-none">?</span>
                </span>
            </button>
            <button onclick="setBuildMode('free')"
                class="flex-1 rounded-xl px-3 py-2 text-sm font-bold text-center transition-all ${buildMode === 'free'
            ? 'bg-[#fffbeb] text-[#5d5444] shadow-sm'
            : 'text-[#a6967a]'}">
                \u81ea\u7531\u7d44\u307f\u7acb\u3066
            </button>
        </div>
        <div id="reading-dropdown" class="absolute top-full left-0 w-[60%] z-[60] hidden bg-white border border-[#ede5d8] rounded-2xl shadow-xl mt-2 max-h-60 overflow-y-auto"></div>
    `;

    const namePreview = document.createElement('div');
    namePreview.id = 'build-name-preview';
    namePreview.className = 'mt-3 mb-1 -mx-2';

    headerContainer.appendChild(modeBar);
    headerContainer.appendChild(namePreview);

    updateNamePreview();

    if (buildMode === 'free') {
        renderBuildFreeMode(container);
        return;
    }

    console.log('=== BUILD DEBUG START ===');
    console.log('Current reading:', currentReading);
    console.log('Segments:', segments);
    console.log('Total liked items:', liked.length);
    console.log('Liked items:', liked.map(item => ({
        kanji: item['\u6f22\u5b57'],
        slot: item.slot,
        sessionReading: item.sessionReading
    })));

    segments.forEach((seg, idx) => {
        const row = document.createElement('div');
        row.className = 'mb-6';
        const isFixedSlot = !!getCompoundFixedPieceForSlot(idx);
        const slotLabel = getBuildSlotDisplayLabel(seg, idx);

        row.innerHTML = `
    <div class="flex items-center justify-between mb-3" >
                <p class="text-[11px] font-black text-[#bca37f] uppercase tracking-widest flex items-center gap-2">
                    <span class="bg-[#bca37f] text-white w-6 h-6 rounded-full flex items-center justify-center text-xs">${idx + 1}</span>
                    ${slotLabel}
                </p>
                <div class="flex gap-2">
                    <button onclick="addMoreToSlot(${idx})" class="text-[10px] font-bold text-[#5d5444] hover:text-[#bca37f] transition-colors px-3 py-1 border border-[#bca37f] rounded-full bg-white">
                        + \u8ffd\u52a0\u3059\u308b
                    </button>
                </div>
            </div>
    `;

        const rowHeader = row.querySelector('p');
        if (rowHeader) {
            const badgeHtml = rowHeader.querySelector('span')?.outerHTML || '';
            rowHeader.innerHTML = `${badgeHtml}${slotLabel}`;
        }

        if (isFixedSlot) {
            const rowActions = row.querySelector('.flex.gap-2');
            if (rowActions) {
                rowActions.innerHTML = '<span class="text-[10px] font-bold text-[#b9965b] px-3 py-1 border border-[#eadfce] rounded-full bg-[#fff8ef]">\u56fa\u5b9a</span>';
            }
        }

        const scrollBox = document.createElement('div');
        scrollBox.className = 'flex overflow-x-auto pt-3 pb-3 -mt-3 no-scrollbar gap-1';

        let items = getBuildSlotCandidates(seg, idx, currentReading, {
            excluded: excludedKanjiFromBuild
        });

        const seen = new Set();
        items = items.filter(item => {
            const buildKey = getLikedCandidateDisplayKey(item);
            if (seen.has(buildKey)) return false;
            seen.add(buildKey);
            return true;
        });

        if (items.length === 0) {
            scrollBox.innerHTML = '<div class="text-[#bca37f] text-sm italic px-4 py-6">\u5019\u88dc\u306a\u3057\uff08\u8ffd\u52a0\u3059\u308b \u304b\u3089\u63a2\u3057\u76f4\u3057\u3066\u304f\u3060\u3055\u3044\uff09</div>';
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
                const selectedKey = selectedPieces[idx]
                    ? getLikedCandidateDisplayKey(hydrateLikedCandidate(selectedPieces[idx], { fromPartner: selectedPieces[idx]?.fromPartner === true }))
                    : '';
                const itemKey = getLikedCandidateDisplayKey(item);
                const isSelected = selectedKey && selectedKey === itemKey;
                const buildTarget = itemKey;
                btn.className = 'build-piece-btn relative';
                btn._buildPieceData = item;
                btn._buildPieceTarget = buildTarget;

                btn.setAttribute('data-slot', idx);
                btn.setAttribute('data-kanji', item['\u6f22\u5b57']);
                btn.setAttribute('data-build-target', buildTarget);
                btn.onclick = () => {
                    selectBuildPiece(idx, item, btn);
                    updateNamePreview();
                };
                btn.oncontextmenu = (e) => {
                    e.preventDefault();
                    if (typeof openKanjiActionMenu === 'function') {
                        openKanjiActionMenu(buildTarget, idx, false);
                    }
                };

                let fortuneIndicator = '';
                if (prioritizeFortune && itemIdx < 3) {
                    const badges = ['1\u4f4d', '2\u4f4d', '3\u4f4d'];
                    fortuneIndicator = `<div class="text-lg mt-1">${badges[itemIdx]}</div>`;
                }

                const strokes = item['\u753b\u6570'] !== undefined ? item['\u753b\u6570']
                    : (typeof master !== 'undefined' ? master.find(m => m['\u6f22\u5b57'] === item['\u6f22\u5b57'])?.['\u753b\u6570'] : undefined) ?? '--';

                btn.innerHTML = `
                    <div class="build-kanji-text ${item['\u6f22\u5b57'] && item['\u6f22\u5b57'].length > 1 ? 'is-compound' : ''}">${item['\u6f22\u5b57']}</div>
                    <div class="build-piece-strokes text-[10px] font-bold">${strokes}\u753b</div>
                    ${renderBuildSuperStars(item)}
                    ${fortuneIndicator}
`;
                applyBuildPieceVisualState(btn, item, isSelected);
                scrollBox.appendChild(btn);
            });
        }

        row.appendChild(scrollBox);
        container.appendChild(row);
    });

    const rankingBtnWrapper = document.createElement('div');
    rankingBtnWrapper.className = 'mt-6 mb-6 flex justify-center';
    rankingBtnWrapper.innerHTML = `<button onclick="showFortuneRanking()" class="w-full max-w-[300px] py-2.5 bg-white border-2 border-[#bca37f] text-[#bca37f] rounded-2xl shadow-sm transition-all hover:bg-[#bca37f] hover:text-white flex flex-col items-center justify-center gap-0.5 active:scale-95">
        <div class="text-sm font-bold">\u904b\u52e2TOP10</div>
        <div class="text-[10px] font-medium opacity-80">\u5019\u88dc\u304b\u3089\u904b\u52e2\u304c\u9ad8\u3044\u3082\u306e\u3092\u8868\u793a\u3057\u307e\u3059</div>
    </button>`;
    if (false) container.appendChild(rankingBtnWrapper);

    console.log('=== BUILD DEBUG END ===');
}
function deleteStockGroup(reading) {
    if (!confirm(`「${reading}」のストックをすべて削除しますか？\n（${liked.filter(i => i.sessionReading === reading).length} 件）`)) {
        return;
    }

    // 該当する読み方のストックを除外
    const initialCount = liked.length;
    const removedItems = liked.filter(item => item.sessionReading === reading);
    liked = liked.filter(item => item.sessionReading !== reading);

    if (removedItems.length > 0 && typeof MeimayStats !== 'undefined' && MeimayStats.recordKanjiUnlike) {
        removedItems.forEach(item => MeimayStats.recordKanjiUnlike(item['漢字'], item.gender || gender || 'neutral'));
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
        fbChoices = []; fbChoicesUseMark = {};
        selectedPieces = [];
        hydrateCompoundBuildSelections();
        const resultArea = document.getElementById('build-result-area');
        if (resultArea) resultArea.innerHTML = '';
        renderBuildSelection();
        // 再描画（初回タップではドロップダウンを開かない）
        return;
    }

    const dropdown = document.getElementById('reading-dropdown');
    if (!dropdown) return;
    const caret = document.getElementById('reading-mode-caret');

    if (!dropdown.classList.contains('hidden')) {
        dropdown.classList.add('hidden');
        if (caret) caret.textContent = '▼';
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

    const historyLookup = getLatestReadingHistoryLookup();

    const currentReading = getSafeBuildCurrentReading();

    if (completedReadings.length === 0) {
        dropdown.innerHTML = '<div class="px-4 py-3 text-sm text-[#a6967a]">読みストックがありません</div>';
    } else {
        dropdown.innerHTML = completedReadings.map(reading => {
            const displaySegments = getDisplaySegmentsForReading(reading, historyLookup);
            const display = displaySegments.length > 0 ? displaySegments.join(' / ') : reading;
            const isCurrent = reading === currentReading;
            const kanjiCount = (liked || []).filter(i => i.sessionReading === reading && i.slot >= 0).length;
            return `<button onclick="selectReadingForBuild('${reading}')"
                class="w-full text-left px-4 py-3 flex items-center justify-between border-b border-[#f0ebe3] last:border-b-0 active:bg-[#faf8f5] ${isCurrent ? 'bg-[#fffbeb]' : ''}">
                <span class="text-sm font-bold text-[#5d5444]">${display}${isCurrent ? '（現在）' : ''}</span>
                <span class="text-[10px] text-[#a6967a]">${kanjiCount}個</span>
            </button>`;
        }).join('');
    }
    dropdown.classList.remove('hidden');
    if (caret) caret.textContent = '▲';

    // dropdown と modeBar がヘッダー(z-50)の下に潜るように z-index を操作しない（相対配置のみ使用）

    // 外側クリックで閉じる
    setTimeout(() => {
        document.addEventListener('click', function closeDD(e) {
            if (!dropdown.contains(e.target)) {
                dropdown.classList.add('hidden');
                if (caret) caret.textContent = '▼';
                document.removeEventListener('click', closeDD);
            }
        });
    }, 0);
}
window.toggleReadingDropdown = toggleReadingDropdown;

function selectReadingForBuild(reading) {
    const dropdown = document.getElementById('reading-dropdown');
    if (dropdown) dropdown.classList.add('hidden');
    const caret = document.getElementById('reading-mode-caret');
    if (caret) caret.textContent = '▼';
    excludedKanjiFromBuild = []; // 読みを変更した際も除外リストをリセット
    if (typeof openBuildFromReading === 'function') {
        openBuildFromReading(reading);
    }
}
window.selectReadingForBuild = selectReadingForBuild;

/**
 * ビルド画面：自由組み立てモードのレンダリング
 * ストックされた漢字を読み方・FREE問わず全表示し、
 * 1?3文字を自由に組み合わせる（スーパーライクを先頭に）
 */

function renderBuildFreeMode(container) {
    const seen = new Set();
    const allKanji = [];
    const freeModeSource = typeof getMergedLikedCandidates === 'function'
        ? getMergedLikedCandidates()
        : (liked || []);
    const pushCandidate = (item) => {
        if (!item) return;
        if (isBuildCandidateExcluded(item)) return;
        const key = getLikedCandidateDisplayKey(item);
        if (!key || seen.has(key)) return;
        seen.add(key);
        allKanji.push({ ...item, _buildTarget: key });
    };
    freeModeSource.forEach(item => {
        if (item.isSuper) pushCandidate(item);
    });
    freeModeSource.forEach(item => {
        if (!item.isSuper) pushCandidate(item);
    });

    if (allKanji.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'text-center py-16 text-[#a6967a] text-sm';
        empty.textContent = '\u30b9\u30c8\u30c3\u30af\u304c\u3042\u308a\u307e\u305b\u3093\u3002\u30b9\u30ef\u30a4\u30d7\u3067\u6f22\u5b57\u3092\u30b9\u30c8\u30c3\u30af\u3057\u3066\u304f\u3060\u3055\u3044\u3002';
        container.appendChild(empty);
        return;
    }

    const maxSlots = 3;

    for (let slotIdx = 0; slotIdx < shownFbSlots; slotIdx++) {
        const label = `${slotIdx + 1}\u6587\u5b57\u76ee`;
        const selected = fbChoices[slotIdx] || null;

        const slotDiv = document.createElement('div');
        slotDiv.className = 'mb-3';

        const headerHtml = `
            <div class="flex items-center justify-between mb-3">
                <p class="text-[11px] font-black text-[#bca37f] uppercase tracking-widest flex items-center gap-2">
                    <span class="bg-[#bca37f] text-white w-6 h-6 rounded-full flex items-center justify-center text-xs">${slotIdx + 1}</span>
                    ${label}
                </p>
                ${selected ? `<button onclick="removeFbChoice(${slotIdx})" class="text-[10px] font-bold text-[#a6967a] hover:text-[#f28b82] transition-colors px-3 py-1 border border-[#d4c5af] rounded-full">\u00d7 \u89e3\u9664</button>` : ''}
            </div>
        `;

        const scrollHtml = `<div class="flex overflow-x-auto pt-3 pb-3 -mt-3 no-scrollbar gap-1">
            ${allKanji.map(item => {
                const k = item['\u6f22\u5b57'];
                const buildTarget = item._buildTarget || getLikedCandidateDisplayKey(item);
                const strokes = item['\u753b\u6570'] !== undefined ? item['\u753b\u6570']
                    : (typeof master !== 'undefined' ? master.find(m => m['\u6f22\u5b57'] === k)?.['\u753b\u6570'] : undefined) ?? '--';
                const isSelected = fbChoices[slotIdx] === k;
                const isUsed = fbChoices.includes(k) && !isSelected;
                const surfaceStyle = getBuildPieceSurfaceStyle(item, isSelected);
                const buttonStyles = [];
                if (surfaceStyle?.button) buttonStyles.push(surfaceStyle.button);
                const kanjiStyle = surfaceStyle?.kanjiColor ? ` style="color:${surfaceStyle.kanjiColor}"` : '';
                const strokesStyle = surfaceStyle?.strokesColor ? ` style="color:${surfaceStyle.strokesColor}"` : '';
                return `<button onclick="selectFbKanji(${slotIdx}, '${k}')"
                        oncontextmenu='event.preventDefault(); openKanjiActionMenu(${JSON.stringify(buildTarget)}, ${slotIdx}, true)'
                        data-slot="${slotIdx}" data-kanji="${k}"
                        class="build-piece-btn relative ${isSelected ? 'selected' : ''} ${isUsed ? 'opacity-40' : ''}"
                        style="${buttonStyles.join('')}">
                        <div class="build-kanji-text ${k && k.length > 1 ? 'is-compound' : ''}"${kanjiStyle}>${k}</div>
                        <div class="text-[10px] font-bold mt-1"${strokesStyle}>${strokes}\u753b</div>
                        ${renderBuildSuperStars(item)}
                    </button>`;
        }).join('')}
        </div>`;

        slotDiv.innerHTML = headerHtml + scrollHtml;
        container.appendChild(slotDiv);
    }

    if (fbChoices.length >= shownFbSlots && shownFbSlots < maxSlots) {
        const addBtn = document.createElement('button');
        addBtn.className = 'w-full py-3 mb-2 border-2 border-dashed border-[#d4c5af] rounded-2xl text-sm font-bold text-[#a6967a] hover:border-[#bca37f] hover:text-[#bca37f] transition-all active:scale-95';
        addBtn.innerHTML = `\uff0b${shownFbSlots + 1}\u6587\u5b57\u76ee\u3092\u8ffd\u52a0`;
        addBtn.onclick = () => {
            withScrollPreservation(() => {
                shownFbSlots = Math.min(shownFbSlots + 1, maxSlots);
                renderBuildSelection();
            });
        };
        container.appendChild(addBtn);
    }

    if (fbChoices.length >= 1) {
        suggestReadingsForKanji(fbChoices, container);
    }
}
function normalizeReadingLookupKey(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    return typeof toHira === 'function'
        ? toHira(raw).replace(/\s+/g, '')
        : raw.replace(/\s+/g, '');
}

function getAllowedReadingsForBuild(targetGender = gender || 'neutral') {
    if (!Array.isArray(readingsData) || readingsData.length === 0) return null;

    const normalizedTarget = targetGender === 'male' || targetGender === 'female' ? targetGender : 'all';
    const allowed = new Set();

    readingsData.forEach((entry) => {
        const normalizedReading = normalizeReadingLookupKey(entry?.reading);
        if (!normalizedReading) return;

        if (
            normalizedTarget !== 'all' &&
            typeof isReadingGenderAllowed === 'function' &&
            !isReadingGenderAllowed(entry?.gender, normalizedTarget)
        ) {
            return;
        }

        allowed.add(normalizedReading);
    });

    return allowed;
}

function suggestReadingsForKanji(choices, container) {
    if (!choices || choices.length === 0) return;
    if (typeof master === 'undefined' || !master || master.length === 0) return;
    const dictionaryReadings = Array.isArray(readingsData) ? readingsData : [];
    const allowedReadings = getAllowedReadingsForBuild(gender);
    const selectedName = choices.join('');

    // 各漢字の可能な読み一覧を取得
    function getKanjiReadings(kanji, mode = 'all') {
        const rec = master.find(m => m['漢字'] === kanji);
        if (!rec) return [];
        const raw = mode === 'on'
            ? (rec['音'] || '')
            : [rec['音'] || '', rec['訓'] || '', rec['伝統名のり'] || ''].join(',');
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

    let scored = [];
    const readingArrays = choices.map(getKanjiReadings);

    // 読みが取得できている場合のみ計算
    if (!readingArrays.some(a => a.length === 0)) {
        const combinedReadings = cartesian(readingArrays);
        const combinedSet = new Set(combinedReadings);
        const filtered = dictionaryReadings.filter((r) => {
            const normalizedReading = normalizeReadingLookupKey(r?.reading);
            if (!normalizedReading || !combinedSet.has(normalizedReading)) return false;
            if (allowedReadings && !allowedReadings.has(normalizedReading)) return false;
            return true;
        });

        const exactMatches = filtered.map(r => {
            let score = 0;
            if (r.tags && typeof userTags !== 'undefined') {
                r.tags.forEach(t => { if (userTags[t]) score += userTags[t]; });
            }
            const exampleText = String(r.examples || '');
            const exactNameMatch = selectedName && exampleText.includes(selectedName);
            return {
                ...r,
                _score: score,
                _exactNameMatch: exactNameMatch ? 1 : 0,
                _popularBoost: r.isPopular ? 1 : 0
            };
        }).sort((a, b) => {
            if (a._exactNameMatch !== b._exactNameMatch) return b._exactNameMatch - a._exactNameMatch;
            if (a._score !== b._score) return b._score - a._score;
            if (a._popularBoost !== b._popularBoost) return b._popularBoost - a._popularBoost;
            return (b.count || 0) - (a.count || 0);
        });

        scored = exactMatches;
    }

    // 手入力された読みがおすすめに含まれていない場合、チップとして表示するために追加
    if (fbSelectedReading && !scored.some(r => r.reading === fbSelectedReading)) {
        scored.unshift({ reading: fbSelectedReading, isManual: true });
    }

    currentFbRecommendedReadings = scored; // グローバルに保存

    // UI 描画
    const section = document.createElement('div');
    section.className = 'mt-4 pt-3 border-t border-[#ede5d8]';
    section.innerHTML = `<p class="text-[10px] font-bold text-[#a6967a] mb-2">読み方の候補${scored.length > 0 ? '（おすすめ・手入力）' : ''}</p>`;

    const chipRow = document.createElement('div');
    chipRow.className = 'flex flex-wrap gap-2';

    scored.forEach(r => {
        const chip = document.createElement('button');
        const isActive = fbSelectedReading === r.reading;
        // 手入力したものはアイコンをつける
        const label = r.isManual ? `手入力 ${r.reading}` : r.reading;

        chip.className = `px-3 py-1.5 text-sm font-bold rounded-full border transition-all active:scale-95
            ${isActive
                ? 'bg-[#bca37f] text-white border-[#bca37f] shadow-md'
                : 'bg-white text-[#5d5444] border-[#d4c5af] hover:border-[#bca37f]'}`;
        chip.textContent = label;
        chip.onclick = () => {
            withScrollPreservation(() => {
                fbSelectedReading = (fbSelectedReading === r.reading) ? null : r.reading;
                renderBuildSelection();
                executeFbBuild();
            });
        };
        chipRow.appendChild(chip);
    });

    // 手入力ボタンを追加
    const manualBtn = document.createElement('button');
    manualBtn.className = `px-3 py-1.5 text-sm font-bold rounded-full border border-[#d4c5af] bg-[#fdfaf5] text-[#a6967a] hover:border-[#bca37f] transition-all active:scale-95`;
    manualBtn.innerHTML = '＋ 読みを入力';
    manualBtn.onclick = () => promptManualFbReading();
    chipRow.appendChild(manualBtn);

    section.appendChild(chipRow);
    container.appendChild(section);
}

/**
 * 読み方の手入力プロンプト
 */
function promptManualFbReading() {
    const input = prompt('名前の読みを入力してください（ひらがな）', fbSelectedReading || '');
    if (input === null) return; // キャンセル

    const cleaned = clean(input);
    if (!cleaned) {
        fbSelectedReading = null;
    } else {
        fbSelectedReading = cleaned;
    }

    withScrollPreservation(() => {
        renderBuildSelection();
        executeFbBuild();
    });
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

    const givenName = fbChoices.map((c, i) => getFbDisplayKanji(i) || '').join('');
    const combination = fbChoices.map(k => {
        const fromLiked = (liked || []).find(l => l['漢字'] === k);
        if (fromLiked) return fromLiked;
        const fromMaster = typeof master !== 'undefined' ? master?.find(m => m['漢字'] === k) : null;
        return fromMaster || { '漢字': k, '画数': 1 };
    });

    // fbSelectedReadingが設定されている場合はそれを使用、なければ安全な自動読みを使う
    const givenReading = fbSelectedReading || getSafeFreeBuildAutoReading(fbChoices);

    const givArr = combination.map(p => ({
        kanji: p['漢字'],
        strokes: parseInt(p['画数']) || 0
    }));

    let fortune = null;
    if (typeof FortuneLogic !== 'undefined' && FortuneLogic.calculate) {
        if (surnameData && surnameData.length > 0) {
            fortune = FortuneLogic.calculate(surnameData, givArr);
        } else {
            fortune = FortuneLogic.calculate([{ kanji: '', strokes: 0 }], givArr);
        }
    }

    const surnameRuby = typeof surnameReading !== 'undefined' && surnameReading ? surnameReading :
        (surnameData && surnameData.length > 0 ? surnameData.map(s => s['読み'] || '').join('') : '');

    currentBuildResult = {
        fullName: (surnameStr ? surnameStr + ' ' : '') + givenName,
        reading: (surnameRuby ? surnameRuby + ' ' : '') + givenReading,
        fortune: fortune,
        combination: combination,
        givenName: givenName,
        timestamp: new Date().toISOString()
    };

    renderBuildResult();
}

window.renderBuildFreeMode = renderBuildFreeMode;
window.executeFbBuild = executeFbBuild;

/**
 * 漢字のアクションメニュー（ポップアップ）を表示
 */
function openKanjiActionMenu(target, slotIdx, isFreeMode) {
    // ?????????????
    document.getElementById('kanji-action-popup')?.remove();

    const targetLabel = String(target || '').trim();
    const localItem = findLocalLikedCandidateByTarget(targetLabel);
    const item = localItem || findLikedCandidateByTarget(targetLabel) || null;
    const kanji = item?.['??'] || item?.kanji || targetLabel;
    const actionTarget = getLikedCandidateDisplayKey(localItem || item) || targetLabel;
    const popupTargetLiteral = JSON.stringify(actionTarget);
    const isSuper = item?.isSuper ?? false;

    const popupHtml = `
        <div class="overlay active modal-overlay-dark" id="kanji-action-popup" onclick="if(event.target.id==='kanji-action-popup')closeKanjiActionMenu()">
            <div class="modal-sheet w-11/12 max-w-sm flex flex-col gap-3 p-6" onclick="event.stopPropagation()">
                <div class="text-center mb-2">
                    <div class="text-4xl font-black text-[#5d5444] mb-1">${kanji}</div>
                    <div class="text-xs text-[#a6967a]">????????</div>
                </div>

                <button onclick='openKanjiDetailFromBuild(${popupTargetLiteral})' class="w-full py-4 bg-white border-2 border-[#eee5d8] rounded-2xl text-[15px] font-bold text-[#5d5444] flex items-center justify-center gap-2 hover:border-[#bca37f] transition-all active:scale-95">
                    <span class="text-lg">i</span>
                    ???????
                </button>

                <button onclick='toggleSuperLikeInStock(${popupTargetLiteral})' class="w-full py-4 bg-white border-2 border-[#eee5d8] rounded-2xl text-[15px] font-bold text-[#5d5444] flex items-center justify-center gap-2 hover:border-[#bca37f] transition-all active:scale-95">
                    <span class="text-lg">${isSuper ? '?' : '?'}</span> 
                    SUPER ${isSuper ? '?????' : '?????'}
                </button>

                <button onclick='removeFromBuildCandidates(${slotIdx}, ${popupTargetLiteral})' class="w-full py-4 bg-white border-2 border-[#eee5d8] rounded-2xl text-[15px] font-bold text-[#5d5444] flex items-center justify-center gap-2 hover:border-[#bca37f] transition-all active:scale-95">
                    <span class="text-lg">?</span> ??????
                </button>

                <button onclick='confirmStockDeletion(${popupTargetLiteral})' class="w-full py-4 bg-white border-2 border-[#eee5d8] rounded-2xl text-[15px] font-bold text-[#d44e4e] flex items-center justify-center gap-2 hover:border-[#d44e4e] transition-all active:scale-95">
                    <span class="text-lg">?</span> ???????????
                </button>

                <button onclick="closeKanjiActionMenu()" class="mt-2 w-full py-3 text-sm font-bold text-[#a6967a] hover:text-[#5d5444] transition-all">
                    ?????
                </button>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', popupHtml);
}

function closeKanjiActionMenu() {
    document.getElementById('kanji-action-popup')?.remove();
}

function openKanjiDetailFromBuild(target) {
    const likedItem = findLikedCandidateByTarget(target) || null;
    const masterItem = likedItem && likedItem['??'] && typeof master !== 'undefined' && Array.isArray(master)
        ? master.find(item => item['??'] === likedItem['??'])
        : (typeof master !== 'undefined' && Array.isArray(master)
            ? master.find(item => item['??'] === String(target || '').trim())
            : null);
    const detailItem = { ...(masterItem || {}), ...(likedItem || {}) };

    closeKanjiActionMenu();

    if (!detailItem || !detailItem['??']) {
        if (typeof showToast === 'function') showToast('?????????????', '!');
        return;
    }

    if (typeof showDetailByData === 'function') {
        showDetailByData(detailItem);
        return;
    }

    if (typeof showKanjiDetail === 'function') {
        showKanjiDetail(detailItem);
        return;
    }

    if (typeof showToast === 'function') showToast('?????????????', '!');
}

/**
 * SUPER???????
 */
function toggleSuperLikeInStock(target) {
    if (!liked) return;
    const targetLabel = String(target || '').trim();
    const item = findLocalLikedCandidateByTarget(targetLabel);
    if (item) {
        item.isSuper = !item.isSuper;
        if (typeof StorageBox !== 'undefined' && StorageBox.saveLiked) {
            StorageBox.saveLiked();
        }
        const kanji = item['??'] || item.kanji || targetLabel;
        showToast(`?${kanji}??SUPER${item.isSuper ? '?????' : '???????'}`, '?');

        withScrollPreservation(() => {
            renderBuildSelection();
            if (buildMode === 'free') executeFbBuild();
        });
    }
    closeKanjiActionMenu();
}

/**
 * ??????????????????
 */
function removeFromBuildCandidates(slotIdx, target) {
    const targetLabel = String(target || '').trim();
    const targetItem = findLocalLikedCandidateByTarget(targetLabel) || findLikedCandidateByTarget(targetLabel) || null;
    const kanji = targetItem?.['??'] || targetItem?.kanji || targetLabel;

    // ????????
    if (targetLabel && !excludedKanjiFromBuild.includes(targetLabel)) {
        excludedKanjiFromBuild.push(targetLabel);
    }

    if (buildMode === 'free') {
        fbChoices[slotIdx] = null;
        fbSelectedReading = null;
        withScrollPreservation(() => {
            renderBuildSelection();
            executeFbBuild();
        });
    } else {
        if (typeof selectedPieces !== 'undefined') {
            selectedPieces = selectedPieces.map((p) => {
                if (!p) return p;
                const hydrated = hydrateLikedCandidate(p, { fromPartner: p?.fromPartner === true });
                return matchesLikedCandidateTarget(hydrated, targetLabel) ? null : p;
            });
        }
        updateNamePreview();
        renderBuildSelection();
    }
    showToast(`?${kanji}?????????????`, '?');
    closeKanjiActionMenu();
}

/**
 * ???????????
 */
function confirmStockDeletion(target) {
    const targetLabel = String(target || '').trim();
    const targetItem = findLocalLikedCandidateByTarget(targetLabel) || findLikedCandidateByTarget(targetLabel) || null;
    const kanji = targetItem?.['??'] || targetItem?.kanji || targetLabel;
    if (confirm(`???${kanji}??????????????????
?????????????`)) {
        removeKanjiFromStock(targetLabel);
        closeKanjiActionMenu();
    }
}

/**
 * ??????????????
 */
function removeKanjiFromStock(target) {
    if (!liked) return;

    const targetLabel = String(target || '').trim();
    const targetItem = findLocalLikedCandidateByTarget(targetLabel) || findLikedCandidateByTarget(targetLabel) || null;
    const kanji = targetItem?.['??'] || targetItem?.kanji || targetLabel;
    const targetKey = targetItem ? getLikedCandidateDisplayKey(targetItem) : targetLabel;
    const hydrateForTarget = (item) => hydrateLikedCandidate(item, { fromPartner: item?.fromPartner === true });
    const removedItems = liked.filter(item => matchesLikedCandidateTarget(hydrateForTarget(item), targetKey));
    const initialCount = liked.length;
    liked = liked.filter(item => !matchesLikedCandidateTarget(hydrateForTarget(item), targetKey));

    if (liked.length < initialCount) {
        if (typeof StorageBox !== 'undefined' && StorageBox.saveLiked) {
            StorageBox.saveLiked();
        }

        if (typeof MeimayStats !== 'undefined' && MeimayStats.recordKanjiUnlike) {
            removedItems.forEach(item => {
                MeimayStats.recordKanjiUnlike(kanji, item.gender || gender || 'neutral');
            });
        }

        fbChoices = fbChoices.map(c => c === kanji ? null : c);
        // ????????????
        if (typeof selectedPieces !== 'undefined') {
            selectedPieces = selectedPieces.map((p) => {
                if (!p) return p;
                const hydrated = hydrateLikedCandidate(p, { fromPartner: p?.fromPartner === true });
                return matchesLikedCandidateTarget(hydrated, targetKey) ? null : p;
            });
        }

        showToast(`?${kanji}???????????`, '?');

        withScrollPreservation(() => {
            renderBuildSelection();
            if (buildMode === 'free') executeFbBuild();
            else updateNamePreview();
        });
    }
}

window.openKanjiActionMenu = openKanjiActionMenu;
window.closeKanjiActionMenu = closeKanjiActionMenu;
window.openKanjiDetailFromBuild = openKanjiDetailFromBuild;
window.toggleSuperLikeInStock = toggleSuperLikeInStock;
window.removeFromBuildCandidates = removeFromBuildCandidates;
window.confirmStockDeletion = confirmStockDeletion;
window.removeKanjiFromStock = removeKanjiFromStock;

window.selectFbKanji = function (slotIdx, kanji) {
    withScrollPreservation(() => {
        if (fbChoices[slotIdx] === kanji) {
            if (slotIdx > 0 && fbChoices[slotIdx - 1] === kanji) {
                fbChoicesUseMark[slotIdx] = !fbChoicesUseMark[slotIdx];
            }
        } else {
            fbChoices[slotIdx] = kanji;
            if (slotIdx > 0 && fbChoices[slotIdx - 1] === kanji) fbChoicesUseMark[slotIdx] = true;
            else fbChoicesUseMark[slotIdx] = false;
        }
        fbSelectedReading = null; // 漢字変更時は読み選択をリセット
        const buildScreen = document.getElementById('scr-build');
        if (buildScreen && buildScreen.classList.contains('active') && buildMode === 'free') {
            renderBuildSelection();
            executeFbBuild();
        } else {
            renderFreeBuildSection();
        }
    });
};


function getFbDisplayKanji(idx) {
    if (idx > 0 && fbChoicesUseMark[idx] && fbChoices[idx] === fbChoices[idx-1]) return '々';
    return fbChoices[idx] || null;
}

window.removeFbChoice = function (slotIdx) {
    withScrollPreservation(() => {
        fbChoices.splice(slotIdx, 1); for(let i=slotIdx; i<10; i++) fbChoicesUseMark[i] = fbChoicesUseMark[i+1];
        fbSelectedReading = null; // 漢字変更時は読み選択をリセット
        if (typeof shownFbSlots !== 'undefined' && shownFbSlots > 1 && fbChoices.length < shownFbSlots) {
            shownFbSlots--;
        }

        const buildScreen = document.getElementById('scr-build');
        if (buildScreen && buildScreen.classList.contains('active') && buildMode === 'free') {
            renderBuildSelection();
            executeFbBuild();
        } else {
            renderFreeBuildSection();
        }
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
            return { kanji: '', strokes: 0 };
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
        applyBuildPieceVisualState(btn, btn._buildPieceData, false);
    });

    applyBuildPieceVisualState(btnElement, data, true);

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
    const selectedCombination = Array.isArray(selectedPieces) ? selectedPieces.filter(Boolean) : [];
    const flattenedCombination = flattenBuildCombination(selectedPieces).filter(Boolean);

    if (selectedCombination.length === 0 || flattenedCombination.length === 0) {
        return;
    }

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
    const surnameRuby = typeof surnameReading !== 'undefined' && surnameReading ? surnameReading :
        (surnameData && surnameData.length > 0 ? surnameData.map(s => s['読み'] || '').join('') : '');
    const givenReading = getSafeBuildCurrentReading();

    const fullName = (surnameStr ? surnameStr + ' ' : '') + givenName;
    const reading = (surnameRuby ? surnameRuby + ' ' : '') + givenReading;

    const givArr = flattenedCombination.map(p => ({
        kanji: p['漢字'],
        strokes: parseInt(p['画数']) || 0
    }));

    let fortune = null;
    if (typeof FortuneLogic !== 'undefined' && FortuneLogic.calculate) {
        if (surnameData && surnameData.length > 0) {
            fortune = FortuneLogic.calculate(surnameData, givArr);
        } else {
            const tempSurname = [{ kanji: '', strokes: 0 }];
            fortune = FortuneLogic.calculate(tempSurname, givArr);
        }
    }

    currentBuildResult = {
        fullName: fullName,
        reading: reading,
        fortune: fortune,
        combination: flattenedCombination,
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

    // AI由来ボタン一時非表示に伴い、空のカードが表示されないようクリア
    container.innerHTML = '';
}

/**
 * 姓名判断詳細モーダル表示
 */
function getFortuneBadgeClass(label) {
    if (label === '大吉') return 'fortune-badge fortune-badge--daikichi';
    if (label === '吉') return 'fortune-badge fortune-badge--kichi';
    return 'fortune-badge fortune-badge--neutral';
}

function getFortuneStrokeValue(item) {
    if (item == null) return 0;
    if (typeof item === 'number') return Number.isFinite(item) ? item : 0;
    if (typeof item === 'string') {
        const parsed = parseInt(item, 10);
        return Number.isFinite(parsed) ? parsed : 0;
    }

    const raw = item.strokes ?? item['画数'] ?? item['逕ｻ謨ｰ'];
    const parsed = parseInt(raw, 10);
    return Number.isFinite(parsed) ? parsed : 0;
}

function showFortuneDetail() {
    const modal = document.getElementById('modal-fortune-detail');
    if (!modal || !currentBuildResult.fortune) return;

    const res = currentBuildResult.fortune;
    const name = currentBuildResult.fullName;
    const givens = currentBuildResult.combination.map(p => ({ kanji: p['漢字'], strokes: parseInt(p['画数']) || 0 }));

    const container = document.getElementById('for-grid');
    const rankingHeaderEl = document.getElementById('fortune-ranking-header');

    if (!container) return;
    container.style.display = '';
    if (rankingHeaderEl) {
        rankingHeaderEl.style.display = 'none';
    }

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
    // オフセット適用（単一文字スパン=h?0 はそのまま）
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
                <span style="font-size:12px;font-weight:900;color:#5d5444">${getNum(obj)}</span><span style="font-size:7px;color:#a6967a">画</span><span style="margin-left:3px" class="${getFortuneBadgeClass(obj.res.label)}">${obj.res.label}</span>
            </div>
            <div style="font-size:7px;font-weight:700;color:#a6967a;margin-top:1px">${label}</div>
        </div> `;

    // 漢字ボックス HTML
    const kBox = (char, isSur) => `
    <div style = "width:${BOX_W}px;height:${BOX_H}px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:900;line-height:1;border-radius:8px;${isSur ? 'background:#fdfaf5;border:1.5px solid #eee5d8;color:#bca37f;' : 'background:white;border:1.5px solid #bca37f;color:#5d5444;box-shadow:0 1px 4px rgba(188,163,127,0.2);'}" > ${char}</div> `;

    const mapTitle = document.createElement('div');
    mapTitle.className = "mb-2 text-center text-[12px] font-black tracking-[0.16em] text-[#5d5444] opacity-70 animate-fade-in";
    mapTitle.textContent = '姓名判断 鑑定図解';
    container.appendChild(mapTitle);

    const mapArea = document.createElement('div');
    mapArea.className = "mb-2 p-4 bg-[#FFFDFC] rounded-2xl border border-[#eee5d8] shadow-sm animate-fade-in";
    mapArea.innerHTML = `
        <div style="display:flex;align-items:flex-start;justify-content:center;gap:2px">

            
            <div style="position:relative;display:flex;flex-direction:row-reverse;align-items:flex-start;flex-shrink:0;height:${totalH}px;width:${BARM + LINE + 80}px;justify-content:flex-start">
                <div style="position:relative;width:${BARM}px;height:${totalH}px;flex-shrink:0">
                    <div style="${bStyle(gaiSpan, 'left')}"></div>
                </div>
                <div style="position:relative;width:${LINE}px;height:${totalH}px;flex-shrink:0">
                    <div style="position:absolute;top:${spanMid(gaiSpan)}px;left:0;right:0;height:0;border-top:${BW}px solid ${BC}"></div>
                </div>
                <!-- 左側カラム：外格と総格の配置 -->
                <div style="position:relative;width:80px;height:${totalH}px;flex-shrink:0">
                    <!-- 外格：鑑定線の中央に合わせて絶対配置 -->
                    <div style="position:absolute;top:${spanMid(gaiSpan)}px;left:50%;transform:translate(-50%, -50%)">
                        ${fBox(res.gai, '外格')}
                    </div>
                    
                    <!-- 総格：構造に干渉しないよう下方に絶対配置 -->
                    <div style="position:absolute;bottom:0;left:50%;transform:translateX(-50%);text-align:center;cursor:pointer;white-space:nowrap" onclick="showFortuneTerm('総格')">
                        <div style="padding:4px 10px;background:linear-gradient(to bottom, white, #fdfaf5);border:1.5px solid #bca37f;border-radius:10px;display:inline-block;box-shadow:0 2px 6px rgba(188,163,127,0.15)">
                            <div style="font-size:7px;font-weight:700;color:#a6967a;margin-bottom:1px">総格</div>
                            <span style="font-size:14px;font-weight:900;color:#5d5444">${getNum(res.so)}</span><span style="font-size:8px;color:#a6967a">画</span><span style="margin-left:3px" class="${getFortuneBadgeClass(res.so.res.label)}">${res.so.res.label}</span>
                        </div>
                    </div>
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
            <div class="${getFortuneBadgeClass(res.so.res.label)}">${res.so.res.label}</div>
        </div>
    </div>
`;
    container.appendChild(mapArea);

    const showSansaiSection = false;
    if (showSansaiSection && res.sansai) {
        const sansai = document.createElement('div');
        sansai.className = "mb-2 bg-[#fdfaf5] p-4 rounded-2xl border border-[#eee5d8] shadow-inner animate-fade-in";
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
                ${['t', 'j', 'c'].map(k => `<div class="flex-grow bg-white py-2 rounded-xl border border-[#eee5d8] text-center"><div class="text-[8px] font-bold text-[#a6967a]">${k === 't' ? '天' : k === 'j' ? '人' : '地'}</div><div class="text-sm font-black text-[#5d5444]">${res.sansai[k] || '-'}</div></div>`).join('<div class="text-[#eee5d8] text-[8px]">・</div>')}
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

    // スクロールを一番上に戻す
    const scrollArea = document.getElementById('fortune-detail-scroll-area');
    if (scrollArea) {
        scrollArea.scrollTop = 0;
    }
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
        descText = descText
            .replace(new RegExp(`^${p.sub}[、。・:：|｜\\s-]*`), '')
            .replace(/^\s+/, '');

        const row = document.createElement('div');
        row.className = "mb-2 w-full animate-fade-in bg-[#FFFDFC] border border-[#eee5d8] rounded-2xl p-3 shadow-sm";
        row.innerHTML = `
    <div class="flex items-center gap-3 mb-1" >
                <div class="flex items-center gap-1.5">
                    <span class="text-sm">${p.icon}</span>
                    <span class="text-xs font-black text-[#a6967a]">${p.k}（${p.sub}）</span>
                    <span onclick="showFortuneTerm('${p.k}')" style="width:16px;height:16px;min-width:16px;flex-shrink:0;border-radius:50%;background:#bca37f;color:white;font-size:10px;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;line-height:1;align-self:center">?</span>
                </div>
                <div class="flex items-center gap-2 ml-auto">
                    <span class="text-base font-black text-[#5d5444]">${getNum(p.d)}画</span>
                    <span class="${getFortuneBadgeClass(p.d.res.label)}">${p.d.res.label}</span>
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

    // 保存ボタンの表示を復元
    const saveBtn = document.getElementById('fortune-save-btn');
    if (saveBtn) saveBtn.style.display = 'block';
    const gridEl = document.getElementById('for-grid');
    if (gridEl) gridEl.style.display = '';
    const rankingHeaderEl = document.getElementById('fortune-ranking-header');
    if (rankingHeaderEl) {
        rankingHeaderEl.style.display = 'none';
    }

    // もし保存済み詳細から開いていたなら、詳細画面に戻す
    if (typeof _lastSavedDetailIndex === 'number' && _lastSavedDetailIndex !== null) {
        const scrSaved = document.getElementById('scr-saved');
        if (scrSaved && scrSaved.classList.contains('active')) {
            const index = _lastSavedDetailIndex;
            _lastSavedDetailIndex = null; // 1度戻ったらクリア
            if (typeof showSavedNameDetail === 'function') {
                showSavedNameDetail(index);
            }
        }
    }
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
    if (buildMode === 'free') {
        const ranked = buildFreeBuildFortuneRanking();
        if (ranked.length === 0) {
            alert('???????????');
            return;
        }
        displayFortuneRankingModal(ranked, { mode: 'free' });
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
    const currentReading = getSafeBuildCurrentReading();
    const slotArrays = segments.map((seg, idx) => {
        let items = getBuildSlotCandidates(seg, idx, currentReading, {
            excluded: excludedKanjiFromBuild
        });

        const displaySeen = new Set();
        items = items.filter(item => {
            const displayKey = getLikedCandidateDisplayKey(item);
            if (!displayKey || displaySeen.has(displayKey)) return false;
            displaySeen.add(displayKey);
            return true;
        });
        return items;
        if (false) {
        const seen = new Set();
        items = items.filter(item => {
            if (seen.has(item['漢字'])) return false;
            seen.add(item['漢字']);
            return true;
        });

        return items;
        }
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
        reading: getSafeBuildCurrentReading()
    }));
}

/**
 * 運勢ランキングモーダルを表示
 */
function displayFortuneRankingModal(rankedList, options = {}) {
    const modal = document.getElementById('modal-fortune-detail');
    if (!modal) return;

    const nameEl = document.getElementById('for-name');
    const rankingHeaderEl = document.getElementById('fortune-ranking-header');
    const gridEl = document.getElementById('for-grid');
    const descEl = document.getElementById('for-desc');
    const saveBtn = document.getElementById('fortune-save-btn');
    const isFreeModeRanking = options.mode === 'free' || buildMode === 'free';

    // for-nameが存在しない場合もクラッシュしないようにnullチェック
    if (nameEl) nameEl.innerText = '🏆 運勢TOP10';
    if (saveBtn) saveBtn.style.display = 'none';
    if (gridEl) gridEl.style.display = 'none';
    if (rankingHeaderEl) {
        rankingHeaderEl.style.display = 'block';
    }
    gridEl.innerHTML = `
        <div style="position:sticky;top:0;z-index:20;padding:4px 0 12px;background:linear-gradient(180deg, rgba(253,250,245,0.98) 0%, rgba(253,250,245,0.92) 100%);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);">
            ${!nameEl ? '<div style="font-size:15px;font-weight:900;color:#5d5444;text-align:center;margin-bottom:8px">🏆 運勢TOP10</div>' : ''}
            <p class="text-xs text-center text-[#a6967a]">タップして選択すると自動的に反映されます</p>
        </div>`;
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

        card.onclick = () => {
            if (isFreeModeRanking) {
                applyFreeRankedCombination(item.combination);
            } else {
                applyRankedCombination(item.combination);
            }
        };

        const rankBadge = medals[rank]
            ? `<span style="font-size:18px;line-height:1;flex-shrink:0;display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px">${medals[rank]}</span> `
            : `<div style = "width:28px;height:28px;border-radius:50%;background:#f8f5ef;border:1.5px solid #d4c5af;display:flex;align-items:center;justify-content:center;flex-shrink:0" > <span style="font-size:12px;font-weight:900;color:#a6967a;line-height:1">${rank}</span></div> `;

        card.innerHTML = `
    <div style = "display:flex;align-items:center;gap:8px" >
        ${rankBadge}
                <div style="flex:1;min-width:0;overflow:hidden">
                    <div style="display:flex;align-items:baseline;gap:6px;margin-bottom:2px">
                        <span style="font-size:17px;font-weight:900;color:#5d5444;white-space:nowrap">${fullName}</span>
                        <span style="font-size:10px;color:#a6967a;white-space:nowrap">${item.combination.readingLabel || item.combination.reading || ''}</span>
                    </div>
                    <div style="display:flex;gap:4px;flex-wrap:nowrap;overflow:hidden">
                        <span style="padding:1px 5px;background:white;border-radius:20px;font-size:9px;font-weight:700;border:1px solid #eee5d8;white-space:nowrap;flex-shrink:0" class="${f.ten.res.color}">天:${f.ten.res.label}</span>
                        <span style="padding:1px 5px;background:white;border-radius:20px;font-size:9px;font-weight:700;border:1px solid #eee5d8;white-space:nowrap;flex-shrink:0" class="${f.jin.res.color}">人:${f.jin.res.label}</span>
                        <span style="padding:1px 5px;background:white;border-radius:20px;font-size:9px;font-weight:700;border:1px solid #eee5d8;white-space:nowrap;flex-shrink:0" class="${f.chi.res.color}">地:${f.chi.res.label}</span>
                        <span style="padding:1px 5px;background:white;border-radius:20px;font-size:9px;font-weight:700;border:1px solid #eee5d8;white-space:nowrap;flex-shrink:0" class="${f.gai.res.color}">外:${f.gai.res.label}</span>
                    </div>
                </div>
                <div style="text-align:center;flex-shrink:0;margin-left:4px;min-width:32px">
                    <div style="font-size:9px;color:#a6967a;font-weight:900;margin-bottom:2px">総格</div>
                    <div style="font-size:20px;font-weight:900;line-height:1" class="${f.so.res.color}">${f.so.val}</div>
                    <div style="font-size:10px;font-weight:700;margin-top:2px" class="${f.so.res.color}">${f.so.res.label}</div>
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
        applyBuildPieceVisualState(btn, btn._buildPieceData, false);
    });

    combination.pieces.forEach((piece, idx) => {
        selectedPieces[idx] = piece;
        const targetBtn = document.querySelector(`.build-piece-btn[data-slot="${idx}"][data-kanji="${piece['漢字']}"]`);
        if (targetBtn) {
            applyBuildPieceVisualState(targetBtn, targetBtn._buildPieceData || piece, true);
        }
    });

    closeFortuneDetail();
    updateNamePreview(); // ヘッダーのプレビューも即時更新
    setTimeout(() => executeBuild(), 100);
}

/**
 * スロット再選択の共通処理
 */
function restartBuildSlotSelection(slotIdx, options = {}) {
    const {
        nextRule = null,
        confirmMessage = ''
    } = options;
    const defaultMessage = `${slotIdx + 1} 文字目「${segments[slotIdx]}」を選び直しますか？\n現在の選択がリセットされます。`;
    if (!confirm(confirmMessage || defaultMessage)) return;

    if (typeof setTemporarySwipeRule === 'function') {
        setTemporarySwipeRule(slotIdx, nextRule);
    } else if (nextRule) {
        if (typeof setRule === 'function') {
            setRule(nextRule);
        } else {
            rule = nextRule;
        }
    }

    const toRemove = [];
    const keptLiked = [];
    liked.forEach(item => {
        if (item.slot === slotIdx) {
            toRemove.push(item);
        } else {
            keptLiked.push(item);
        }
    });
    liked = keptLiked;

    toRemove.forEach(item => {
        seen.delete(item['漢字']);
        if (typeof MeimayStats !== 'undefined' && MeimayStats.recordKanjiUnlike) {
            MeimayStats.recordKanjiUnlike(item['漢字'], item.gender || gender || 'neutral');
        }
    });

    // NOPEリストもリセット（選び直し時）
    if (typeof noped !== 'undefined') noped.clear();

    if (typeof StorageBox !== 'undefined' && typeof StorageBox.saveAll === 'function') {
        StorageBox.saveAll();
    }

    currentBuildResult = {
        fullName: "",
        reading: "",
        fortune: null,
        combination: [],
        givenName: "",
        timestamp: null
    };

    const resultArea = document.getElementById('build-result-area');
    if (resultArea) resultArea.innerHTML = '';

    currentPos = slotIdx;
    currentIdx = 0;
    if (typeof loadStack === 'function') loadStack();
    changeScreen('scr-main');

    const nav = document.querySelector('.nav-bar');
    if (nav) nav.style.display = 'flex';

    console.log(`BUILD: Restarting slot ${slotIdx} with rule ${nextRule || rule}`);
}

/**
 * スロットを選び直す
 */
function reselectSlot(slotIdx) {
    restartBuildSlotSelection(slotIdx);
}

function reselectSlotWithRule(slotIdx, nextRule) {
    const modeLabel = nextRule === 'strict' ? '厳格' : '柔軟';
    restartBuildSlotSelection(slotIdx, {
        nextRule,
        confirmMessage: `${slotIdx + 1} 文字目「${segments[slotIdx]}」を${modeLabel}モードで選び直しますか？\nNOPEした候補も含めて、もう一度候補を出します。`
    });
}

/**
 * スロットに追加で漢字を探す（現在の選択を保持）
 */
function addMoreToSlot(slotIdx) {
    if (getCompoundFixedPieceForSlot(slotIdx)) {
        return;
    }
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
window.reselectSlotWithRule = reselectSlotWithRule;
window.addMoreToSlot = addMoreToSlot;
window.clearBuildSelection = clearBuildSelection;
window.showFortuneTerm = showFortuneTerm;

// ============================================================
// STOCK TAB SWIPE GESTURE
// 読みストック ? 漢字ストック をスワイプで切り替え
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
