/* ============================================================
   MODULE 04: UI FLOW (V14.3)
   ウィザード進行・モード管理
   ============================================================ */

let appMode = 'reading'; // reading, nickname, free, diagnosis
let isFreeSwipeMode = false;
let selectedVibes = new Set();
let compoundBuildFlowState = null;
let soundModeEntryOrigin = false; // 「入れたい音がある」から来た場合true（戻る挙動制御用）
let soundEntryMode = 'browse';
let readingStockSoundFilter = null;
// gender is defined in 01-core.js

function normalizeReadingStockSoundValue(value) {
    const raw = String(value || '').trim().split('::')[0].trim();
    const hira = typeof toHira === 'function' ? toHira(raw) : raw;
    return hira.replace(/\s+/g, '');
}

function setReadingStockSoundFilter(reading, position = 'prefix') {
    const normalizedReading = normalizeReadingStockSoundValue(reading);
    readingStockSoundFilter = normalizedReading ? {
        reading: normalizedReading,
        position: position === 'suffix' ? 'suffix' : 'prefix'
    } : null;
    if (typeof window !== 'undefined') {
        window.MeimayReadingStockSoundFilter = readingStockSoundFilter;
    }
    return readingStockSoundFilter;
}

function clearReadingStockSoundFilter() {
    readingStockSoundFilter = null;
    if (typeof window !== 'undefined') {
        window.MeimayReadingStockSoundFilter = null;
    }
}

function getReadingStockSoundFilter() {
    if (readingStockSoundFilter) return readingStockSoundFilter;
    if (typeof window !== 'undefined' && window.MeimayReadingStockSoundFilter) {
        return window.MeimayReadingStockSoundFilter;
    }
    return null;
}

// Vibe Data — 05-ui-render.js の KANJI_CATEGORIES と完全一致（15タグ）
const VIBES = [
    { id: 'none', label: 'こだわらない', icon: '⚪' },
    { id: 'nature', label: '#自然', icon: '🌿' },
    { id: 'sky', label: '#天空', icon: '🌌' },
    { id: 'water', label: '#水景', icon: '🌊' },
    { id: 'color', label: '#色彩', icon: '🎨' },
    { id: 'kindness', label: '#慈愛', icon: '💖' },
    { id: 'strength', label: '#勇壮', icon: '🦁' },
    { id: 'intelligence', label: '#知性', icon: '🎓' },
    { id: 'soar', label: '#飛躍', icon: '🦅' },
    { id: 'happiness', label: '#幸福', icon: '🍀' },
    { id: 'beauty', label: '#品格', icon: '🕊️' },
    { id: 'hope', label: '#希望', icon: '🌟' },
    { id: 'belief', label: '#信念', icon: '⛰️' },
    { id: 'harmony', label: '#調和', icon: '🤝' },
    { id: 'tradition', label: '#伝統', icon: '⛩️' },
    { id: 'music', label: '#奏楽', icon: '🎵' },
];

/**
 * モード開始（性別はウィザードで設定済みなのでスキップ）
 */
function setCompoundBuildFlow(flow) {
    compoundBuildFlowState = flow ? {
        ...flow,
        segments: Array.isArray(flow.segments) ? [...flow.segments] : [],
        slotLabels: Array.isArray(flow.slotLabels) ? [...flow.slotLabels] : [],
        fixedSlotsBySlot: flow.fixedSlotsBySlot ? { ...flow.fixedSlotsBySlot } : {}
    } : null;
    window.meimayCompoundBuildFlow = compoundBuildFlowState;
    return compoundBuildFlowState;
}

function getCompoundBuildFlow() {
    return compoundBuildFlowState || window.meimayCompoundBuildFlow || null;
}

const ENCOUNTERED_LIBRARY_KEY = 'meimay_encountered_library_v1';

function isLegacySyntheticEncounteredReading(item) {
    if (!item || item.encounterOrigin) return false;

    const modeEmpty = !item.mode;
    const examplesEmpty = !Array.isArray(item.examples) || item.examples.length === 0;
    const keyMatchesReading = !item.key || item.key === item.reading;
    const seenCount = Number(item.seenCount || 0);
    const likeCount = Number(item.likeCount || 0);
    const nopeCount = Number(item.nopeCount || 0);
    const isSyntheticLike = seenCount === 1 && likeCount === 1 && nopeCount === 0 && item.lastAction === 'like';
    const isSyntheticNope = seenCount === 1 && likeCount === 0 && nopeCount === 1 && item.lastAction === 'nope';

    return modeEmpty && examplesEmpty && keyMatchesReading && (isSyntheticLike || isSyntheticNope);
}

function isCompoundBuildPlaceholderSegment(seg) {
    return typeof seg === 'string' && /^__compound_slot_\d+__$/.test(seg);
}

function getCurrentSessionReading() {
    const flow = getCompoundBuildFlow();
    if (flow && flow.reading) {
        return flow.reading;
    }
    if (flow && Array.isArray(flow.displaySegments)) {
        const flowReading = flow.displaySegments
            .filter(seg => seg && !isCompoundBuildPlaceholderSegment(seg))
            .join('');
        if (flowReading) return flowReading;
    }
    const nameInput = document.getElementById('in-name');
    const typedReading = nameInput && typeof nameInput.value === 'string'
        ? nameInput.value.trim()
        : '';
    if (typedReading) {
        return typedReading;
    }
    if (!Array.isArray(segments)) return '';
    const safeSegments = segments.filter(seg => seg && !isCompoundBuildPlaceholderSegment(seg));
    return safeSegments.join('');
}

function clearCompoundBuildFlow() {
    compoundBuildFlowState = null;
    window.meimayCompoundBuildFlow = null;
}

function getReadingHistoryEntryByReading(reading, preferredSegments = []) {
    const history = typeof getReadingHistory === 'function' ? getReadingHistory() : [];
    const normalizedReading = getReadingBaseReading(reading);
    const normalizedSegments = Array.isArray(preferredSegments) ? preferredSegments.filter(Boolean) : [];

    if (normalizedReading && normalizedSegments.length > 0) {
        const exactSegmentKey = normalizedSegments.join('/');
        const exactEntry = history.find(item => {
            if (!item) return false;
            if (getReadingBaseReading(item.reading) !== normalizedReading) return false;
            const itemSegmentKey = item.segmentKey || (Array.isArray(item.segments) ? item.segments.filter(Boolean).join('/') : '');
            return itemSegmentKey === exactSegmentKey;
        });
        return exactEntry || null;
    }

    return history.find(item => item.reading === reading && item.compoundFlow) || history.find(item => item.reading === reading) || null;
}

function shouldRebuildCompoundFlow(flow) {
    if (!flow || !Array.isArray(flow.segments) || flow.segments.length === 0) return true;
    const placeholderCount = flow.segments.filter(seg => typeof seg === 'string' && /^__compound_slot_\d+__$/.test(seg)).length;
    const fixedCount = flow.fixedSlotsBySlot ? Object.keys(flow.fixedSlotsBySlot).length : 0;
    return placeholderCount > 0 && fixedCount < placeholderCount;
}

function restoreCompoundBuildFlowFromLiked(reading, fallbackEntry = null, preferredSegments = []) {
    if (!Array.isArray(liked) || !reading) return null;
    const normalizedReading = getReadingBaseReading(reading);
    const normalizedSegments = Array.isArray(preferredSegments) ? preferredSegments.filter(Boolean) : [];
    const preferredSegmentKey = normalizedSegments.join('/');

    const seededItems = liked
        .filter(item => {
            if (!item || !item._compoundSeeded || !Array.isArray(item.sessionSegments) || item.sessionSegments.length === 0) return false;
            if (getReadingBaseReading(item.sessionReading) !== normalizedReading) return false;
            if (normalizedSegments.length > 0) {
                return item.sessionSegments.filter(Boolean).join('/') === preferredSegmentKey;
            }
            return item.sessionReading === reading || getReadingBaseReading(item.sessionReading) === normalizedReading;
        })
        .sort((a, b) => (Number(a.slot) || 0) - (Number(b.slot) || 0));

    if (seededItems.length === 0) return null;

    const template = seededItems[0];
    const segmentsForFlow = Array.isArray(template.sessionSegments) && template.sessionSegments.length > 0
        ? [...template.sessionSegments]
        : seededItems.map((_, idx) => `__compound_slot_${idx}__`);
    const historyEntry = fallbackEntry || getReadingHistoryEntryByReading(reading, normalizedSegments);
    const fixedSlotsBySlot = {};

    seededItems.forEach((item) => {
        const slotIdx = Number(item.slot);
        if (!Number.isInteger(slotIdx) || slotIdx < 0) return;
        fixedSlotsBySlot[slotIdx] = {
            ...item,
            slot: slotIdx,
            sessionReading: reading,
            sessionSegments: [...segmentsForFlow],
            sessionDisplaySegments: Array.isArray(historyEntry?.segments) ? [...historyEntry.segments] : [reading],
            isFixedCompound: true,
            _compoundFixed: true
        };
    });

    const interactiveSlots = segmentsForFlow
        .map((_, idx) => fixedSlotsBySlot[idx] ? null : idx)
        .filter((idx) => idx !== null);
    const slotLabels = Array.isArray(historyEntry?.compoundFlow?.slotLabels) && historyEntry.compoundFlow.slotLabels.length === segmentsForFlow.length
        ? [...historyEntry.compoundFlow.slotLabels]
        : segmentsForFlow.map((_, idx) => `${idx + 1}文字目: ${reading}`);
    const displaySegments = Array.isArray(historyEntry?.compoundFlow?.displaySegments) && historyEntry.compoundFlow.displaySegments.length > 0
        ? [...historyEntry.compoundFlow.displaySegments]
        : Array.isArray(historyEntry?.segments) && historyEntry.segments.length > 0
            ? [...historyEntry.segments]
            : [reading];

    return setCompoundBuildFlow({
        reading,
        segments: [...segmentsForFlow],
        displaySegments,
        slotLabels,
        fixedSlotsBySlot,
        firstInteractiveSlot: interactiveSlots.length > 0 ? interactiveSlots[0] : -1,
        interactiveSlots,
        optionLabel: historyEntry?.segmentKey || '',
        optionMode: historyEntry?.compoundFlow?.optionMode || 'compound'
    });
}

function formatCompoundSlotLabel(startIndex, segmentReading) {
    const length = Array.from(segmentReading || '').length || 1;
    const labels = Array.from({ length }, (_, offset) => `${startIndex + offset + 1}文字目`);
    return `${labels.join('＋')}: ${segmentReading}`;
}

function buildCompoundSlotLabels(path) {
    let cursor = 0;
    return (Array.isArray(path) ? path : []).map((segment) => {
        const label = formatCompoundSlotLabel(cursor, segment);
        cursor += Array.from(segment || '').length || 1;
        return label;
    });
}

window.setCompoundBuildFlow = setCompoundBuildFlow;
window.getCompoundBuildFlow = getCompoundBuildFlow;
window.getCurrentSessionReading = getCurrentSessionReading;
window.clearCompoundBuildFlow = clearCompoundBuildFlow;

function startMode(mode) {
    console.log(`UI_FLOW: Start mode ${mode}`);
    appMode = mode;
    window._addMoreFromBuild = false;
    clearCompoundBuildFlow();

    // 診断モードの場合はイメージ等は不要
    if (mode === 'diagnosis') {
        // 名字を自動入力（ウィザードで設定済み）
        const diagSurnameInput = document.getElementById('diag-surname');
        if (diagSurnameInput && surnameStr) {
            diagSurnameInput.value = surnameStr;
        }
        changeScreen('scr-diagnosis-input');
        return;
    }

    // 性別はウィザードで設定済みなので、直接各モードの入力画面へ
    if (mode === 'free') {
        initVibeScreen();
        changeScreen('scr-vibe');
    } else if (mode === 'nickname') {
        changeScreen('scr-input-nickname');
    } else if (mode === 'sound') {
        // 「響きから探す」→ 入れたい音があるかどうか確認してから分岐
        initSoundModeEntry();
    } else {
        // reading mode
        changeScreen('scr-input-reading');
        initReadingStockPicker();
    }
}

function getReadingStockPickerUniqueCount() {
    const normalizeReadingKey = (item) => getReadingBaseReading(item?.reading || item?.sessionReading || '');
    const readHiddenSet = () => {
        let removedList = [];
        try { removedList = JSON.parse(localStorage.getItem('meimay_hidden_readings') || '[]'); } catch (e) { }
        return new Set(
            Array.isArray(removedList)
                ? removedList.map(value => getReadingBaseReading(value)).filter(Boolean)
                : []
        );
    };
    const dedupeAndSort = (items) => {
        const seen = new Set();
        return sortReadingStockMatches(Array.isArray(items) ? items : []).filter(item => {
            const readingKey = normalizeReadingKey(item);
            if (!readingKey || seen.has(readingKey)) return false;
            seen.add(readingKey);
            return true;
        });
    };

    const ownStock = (typeof getReadingStock === 'function') ? getReadingStock() : [];
    const hiddenReadingSet = readHiddenSet();
    const visibleOwnStock = dedupeAndSort(
        ownStock.filter(item => {
            const readingKey = normalizeReadingKey(item);
            return readingKey && !hiddenReadingSet.has(readingKey);
        })
    );

    const pairInsights = typeof window.MeimayPartnerInsights !== 'undefined' ? window.MeimayPartnerInsights : null;
    const partnerRawStock = pairInsights?.getPartnerReadingStock ? pairInsights.getPartnerReadingStock() : [];
    const visibleOwnReadingSet = new Set(visibleOwnStock.map(item => normalizeReadingKey(item)).filter(Boolean));
    const visiblePartnerStock = dedupeAndSort(
        partnerRawStock.filter(item => {
            const readingKey = normalizeReadingKey(item);
            return readingKey && !visibleOwnReadingSet.has(readingKey);
        }).map(item => ({ ...item, _pickerSourceLabel: 'パートナー' }))
    );

    const combinedCandidates = dedupeAndSort([
        ...visibleOwnStock.map(item => ({ ...item, _pickerSourceLabel: '' })),
        ...visiblePartnerStock
    ]);

    return combinedCandidates.length;
}

window.getReadingStockPickerUniqueCount = getReadingStockPickerUniqueCount;

function getVisibleOwnLikedReadingsForUI() {
    const ownLiked = typeof liked !== 'undefined' ? liked : [];
    let removedList = [];
    try { removedList = JSON.parse(localStorage.getItem('meimay_hidden_readings') || '[]'); } catch (e) { }
    const removedReadingSet = new Set(
        Array.isArray(removedList)
            ? removedList.map(item => getReadingBaseReading(item)).filter(Boolean)
            : []
    );

    return ownLiked.filter(item => {
        if (!item || item?.fromPartner) return false;
        const readingKey = getReadingBaseReading(item.sessionReading || item.reading || '');
        return !readingKey || !removedReadingSet.has(readingKey);
    });
}

function getReadingStockGroupKey(item) {
    const reading = getReadingBaseReading(item?.reading || item?.sessionReading || '');
    const baseNickname = getReadingBaseReading(item?.baseNickname || '');
    return baseNickname || reading || '';
}

/**
 * 読み入力画面: ストックがあればプルダウンを表示
 */
function initReadingStockPicker() {
    const pickerWrap = document.getElementById('reading-stock-picker');
    const label = document.getElementById('reading-stock-picker-label');
    const arrow = document.getElementById('reading-stock-picker-arrow');
    const list = document.getElementById('reading-stock-picker-list');
    if (!pickerWrap || !list) return;

    const escapeHtml = (value) => String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    const normalizeReadingKey = (item) => getReadingBaseReading(item?.reading || item?.sessionReading || '');
    const isPartnerSource = (item) => !!(item && (
        item.source === 'partner-reading' ||
        item.fromPartner === true ||
        item.partnerSuper === true
    ));
    const readHiddenSet = () => {
        let removedList = [];
        try { removedList = JSON.parse(localStorage.getItem('meimay_hidden_readings') || '[]'); } catch (e) { }
        return new Set(
            Array.isArray(removedList)
                ? removedList.map(value => getReadingBaseReading(value)).filter(Boolean)
                : []
        );
    };
    const dedupeAndSort = (items) => {
        const seen = new Set();
        return sortReadingStockMatches(Array.isArray(items) ? items : []).filter(item => {
            const readingKey = normalizeReadingKey(item);
            if (!readingKey || seen.has(readingKey)) return false;
            seen.add(readingKey);
            return true;
        });
    };
    const renderButton = (item, badgeText = '') => {
        const readingLabel = getReadingDisplayLabel(item, { allowSegments: true }) || item?.reading || item?.sessionReading || '';
        const safeReading = escapeHtml(readingLabel);
        const encodedReading = encodeURIComponent(item?.reading || item?.sessionReading || readingLabel || '');
        const safeBadge = badgeText ? `<span class="inline-flex shrink-0 items-center rounded-full border border-[#e4d6c2] bg-[#faf4ea] px-2 py-0.5 text-[9px] font-black tracking-wide text-[#9b7f5b]">${escapeHtml(badgeText)}</span>` : '';
        return `
            <button onclick="selectReadingFromStock(decodeURIComponent('${encodedReading}'))"
                class="w-full text-left px-4 py-3.5 text-sm text-[#5d5444] font-bold hover:bg-[#fdf7ef] border-b border-[#f5ede0] last:border-0 transition-colors">
                <div class="flex items-center gap-2">
                    <span class="min-w-0 flex-1 truncate">${safeReading}</span>
                    ${safeBadge}
                </div>
            </button>
        `;
    };

    const ownStock = (typeof getReadingStock === 'function') ? getReadingStock() : [];
    const hiddenReadingSet = readHiddenSet();
    const visibleOwnStock = dedupeAndSort(
        ownStock.filter(item => {
            const readingKey = normalizeReadingKey(item);
            return readingKey && !hiddenReadingSet.has(readingKey);
        })
    );

    const pairInsights = typeof window.MeimayPartnerInsights !== 'undefined' ? window.MeimayPartnerInsights : null;
    const partnerRawStock = pairInsights?.getPartnerReadingStock ? pairInsights.getPartnerReadingStock() : [];
    const visibleOwnReadingSet = new Set(visibleOwnStock.map(item => normalizeReadingKey(item)).filter(Boolean));
    const visiblePartnerStock = dedupeAndSort(
        partnerRawStock.filter(item => {
            const readingKey = normalizeReadingKey(item);
            return readingKey && !visibleOwnReadingSet.has(readingKey);
        }).map(item => ({ ...item, _pickerSourceLabel: 'パートナー' }))
    );

    const combinedCandidates = dedupeAndSort([
        ...visibleOwnStock.map(item => ({ ...item, _pickerSourceLabel: '' })),
        ...visiblePartnerStock
    ]);

    const totalCount = combinedCandidates.length;
    if (totalCount === 0) {
        pickerWrap.classList.add('hidden');
        list.classList.add('hidden');
        return;
    }
    pickerWrap.classList.remove('hidden');
    if (label) {
        label.textContent = `📖 ストックから選ぶ（${totalCount}件）`;
    }
    if (arrow) {
        arrow.textContent = list.classList.contains('hidden') ? '▼' : '▲';
    }
    const renderSection = (title, items, forceBadge = '') => {
        if (!Array.isArray(items) || items.length === 0) return '';
        return `
            <div class="mb-4 last:mb-0">
                <div class="text-xs font-black text-[#bca37f] mb-2 tracking-wider uppercase">${escapeHtml(title)}</div>
                <div class="space-y-1">
                    ${items.map(item => renderButton(item, forceBadge || item._pickerSourceLabel || (isPartnerSource(item) ? 'パートナー' : ''))).join('')}
                </div>
            </div>
        `;
    };

    list.innerHTML = [
        renderSection('自分のストック', visibleOwnStock),
        renderSection('パートナーのストック', visiblePartnerStock, 'パートナー')
    ].filter(Boolean).join('');
}

function selectReadingFromStock(reading) {
    const input = document.getElementById('in-name');
    if (input) input.value = reading;
    const list = document.getElementById('reading-stock-picker-list');
    const arrow = document.getElementById('reading-stock-picker-arrow');
    if (list) list.classList.add('hidden');
    if (arrow) arrow.textContent = '▼';
}

function toggleReadingStockPicker() {
    const list = document.getElementById('reading-stock-picker-list');
    const arrow = document.getElementById('reading-stock-picker-arrow');
    if (!list) return;
    const willOpen = list.classList.contains('hidden');
    list.classList.toggle('hidden');
    if (arrow) arrow.textContent = willOpen ? '▲' : '▼';

    if (willOpen) {
        setTimeout(() => {
            document.addEventListener('click', function closeReadingPicker(event) {
                const wrap = document.getElementById('reading-stock-picker');
                if (wrap && !wrap.contains(event.target)) {
                    list.classList.add('hidden');
                    if (arrow) arrow.textContent = '▼';
                    document.removeEventListener('click', closeReadingPicker);
                }
            });
        }, 0);
    }
}

/**
 * 「響きから探す」エントリー：入れたい音があるかどうかを確認
 */
function initSoundModeEntry() {
    console.log('UI_FLOW: initSoundModeEntry');
    soundModeEntryOrigin = false;
    soundEntryMode = 'browse';
    clearReadingStockSoundFilter();
    changeScreen('scr-input-sound-entry');
    renderSoundEntryScreen();
    updateSoundEntryModeUI();
}

function openSearchMethodChooser() {
    changeScreen('scr-input-sound-entry');
    renderSearchMethodChooserScreen();
}

function renderSearchMethodChooserScreen() {
    const screen = document.getElementById('scr-input-sound-entry');
    if (!screen) return;

    screen.innerHTML = `
        <div class="glass-card p-6 rounded-[40px] w-full max-w-sm text-center mt-2 shadow-2xl mx-auto">
            <h2 class="text-[1.35rem] font-bold text-[#8b7e66] mb-3">名前のさがし方</h2>
            <p class="text-xs text-[#a6967a] text-center mb-8">さがし方を選んでください</p>

            <div class="flex flex-col gap-3 text-left mb-4">
                <button onclick="startMode('reading')" class="wiz-gender-btn wiz-reading-choice">
                    <div class="wiz-reading-choice-copy">
                        <span class="block text-base font-bold text-[#5d5444]">漢字をさがす</span>
                        <span class="block mt-1 text-[10px] leading-relaxed text-[#8b7e66]">希望の読みから<br>合う漢字を探します</span>
                    </div>
                    <div class="wiz-mini-preview" aria-hidden="true">
                        <div class="wiz-mini-card wiz-mini-card-back" style="background:#E8F5E9;">環</div>
                        <div class="wiz-mini-card wiz-mini-card-center" style="background:#FFFDE7;">歓</div>
                        <div class="wiz-mini-card wiz-mini-card-front" style="background:#FFEBEE;">漢</div>
                    </div>
                </button>

                <button onclick="startMode('sound')" class="wiz-gender-btn wiz-reading-choice">
                    <div class="wiz-reading-choice-copy">
                        <span class="block text-base font-bold text-[#5d5444]">響きをさがす</span>
                        <span class="block mt-1 text-[10px] leading-relaxed text-[#8b7e66]">好きな響きから<br>読み候補を探します</span>
                    </div>
                    <div class="wiz-mini-preview" aria-hidden="true">
                        <div class="wiz-mini-card wiz-mini-card-back" style="background:linear-gradient(145deg,#fdf7ef,#f0e0c4); font-size:10px;">ひ</div>
                        <div class="wiz-mini-card wiz-mini-card-center" style="background:linear-gradient(145deg,#fdf7ef,#f0e0c4); font-size:10px;">び</div>
                        <div class="wiz-mini-card wiz-mini-card-front" style="background:linear-gradient(145deg,#fdf7ef,#f0e0c4); font-size:10px;">き</div>
                    </div>
                </button>
            </div>
            <button onclick="changeScreen('scr-mode')" class="text-sm text-[#bca37f] hover:underline">戻る</button>
        </div>
    `;
}

function renderSoundEntryScreen() {
    const screen = document.getElementById('scr-input-sound-entry');
    if (!screen) return;

    screen.innerHTML = `
        <div class="glass-card p-6 rounded-[40px] w-full max-w-sm text-center mt-2 shadow-2xl mx-auto">
            <h2 class="text-[1.35rem] font-bold text-[#8b7e66] mb-3">響きをさがす</h2>

            <div class="space-y-2.5 text-left mb-4">
                <button
                    id="sound-entry-choice-browse"
                    onclick="selectSoundEntryMode('browse')"
                    class="w-full rounded-2xl border px-4 py-3 shadow-sm transition-all active:scale-[0.99] bg-white/70 border-[#ede5d8]">
                    <div id="sound-entry-dot-browse" class="dot-selector active"></div>
                    <div class="sound-entry-choice-copy">
                        <div class="text-sm font-bold text-[#5d5444]">響きを見ながら探す</div>
                        <p class="mt-1 text-[10px] leading-relaxed text-[#a6967a]">人気の響きを見ながら、好みを探す</p>
                    </div>
                    <div class="sound-entry-preview" aria-hidden="true">
                        <div class="sound-entry-preview-card sound-entry-preview-card-back">あおい</div>
                        <div class="sound-entry-preview-card sound-entry-preview-card-center">ひなた</div>
                        <div class="sound-entry-preview-card sound-entry-preview-card-front">みなと</div>
                    </div>
                </button>

                <button
                    id="sound-entry-choice-input"
                    onclick="selectSoundEntryMode('input')"
                    class="w-full rounded-2xl border px-4 py-3 shadow-sm transition-all active:scale-[0.99] bg-white/70 border-[#ede5d8]">
                    <div id="sound-entry-dot-input" class="dot-selector"></div>
                    <div class="sound-entry-choice-copy">
                        <div class="text-sm font-bold text-[#5d5444]">入れたい音から探す</div>
                        <p class="mt-1 text-[10px] leading-relaxed text-[#a6967a]">例: 「はる」から始まる名前を探す</p>
                    </div>
                    <div class="sound-entry-preview" aria-hidden="true">
                        <div class="sound-entry-preview-card sound-entry-preview-card-back">はると</div>
                        <div class="sound-entry-preview-card sound-entry-preview-card-center">はるか</div>
                        <div class="sound-entry-preview-card sound-entry-preview-card-front">はるみ</div>
                    </div>
                </button>
            </div>

            <div id="sound-entry-input-slot" class="hidden mt-0 mb-4">
                <div
                    id="sound-entry-input-panel"
                    class="hidden min-h-[176px] rounded-[28px] border border-[#ede5d8] bg-white/80 px-4 pt-4 pb-3 text-left shadow-sm">
                    <p class="label-mini mb-2">入れたい音</p>
                    <input
                        id="in-sound-entry"
                        type="text"
                        maxlength="8"
                        inputmode="kana"
                        placeholder="例: はる"
                        class="premium-input mb-0 text-center"
                        style="font-size:1.7rem; padding:10px 0;"
                        onkeydown="if(event.key==='Enter'){submitSoundEntry();}">
                    <div class="mt-3 grid grid-cols-2 gap-2">
                        <label class="sound-entry-pos-label flex items-center justify-center rounded-2xl border px-2 py-2 cursor-pointer whitespace-nowrap">
                            <input type="radio" name="sound-entry-position" value="prefix" class="sr-only" checked onchange="updateSoundEntryModeUI()">
                            <span class="text-[11px] font-bold">「○○」から始まる</span>
                        </label>
                        <label class="sound-entry-pos-label flex items-center justify-center rounded-2xl border px-2 py-2 cursor-pointer whitespace-nowrap">
                            <input type="radio" name="sound-entry-position" value="suffix" class="sr-only" onchange="updateSoundEntryModeUI()">
                            <span class="text-[11px] font-bold">「○○」で終わる</span>
                        </label>
                    </div>
                </div>
            </div>
            <button id="btn-sound-entry-submit" onclick="submitSoundEntry()" class="btn-gold py-4 shadow-lg mb-3 w-full">響きを見て探す</button>
            <button onclick="goBack()" class="text-sm text-[#bca37f] hover:underline">戻る</button>
        </div>
    `;
}

function selectSoundEntryMode(mode) {
    soundEntryMode = mode === 'input' ? 'input' : 'browse';
    if (soundEntryMode !== 'input') {
        clearReadingStockSoundFilter();
    }
    updateSoundEntryModeUI();
}

function updateSoundEntryModeUI() {
    const isInputMode = soundEntryMode === 'input';
    const inputChoice = document.getElementById('sound-entry-choice-input');
    const browseChoice = document.getElementById('sound-entry-choice-browse');
    const inputDot = document.getElementById('sound-entry-dot-input');
    const browseDot = document.getElementById('sound-entry-dot-browse');
    const inputSlot = document.getElementById('sound-entry-input-slot');
    const inputPanel = document.getElementById('sound-entry-input-panel');
    const submitBtn = document.getElementById('btn-sound-entry-submit');

    if (inputChoice) {
        inputChoice.className = `w-full rounded-2xl border px-4 py-3 shadow-sm transition-all active:scale-[0.99] ${isInputMode ? 'border-[#b9965b] bg-[#fffbef]' : 'border-[#ede5d8] bg-white/70'}`;
    }

    if (browseChoice) {
        browseChoice.className = `w-full rounded-2xl border px-4 py-3 shadow-sm transition-all active:scale-[0.99] ${!isInputMode ? 'border-[#b9965b] bg-[#fffbef]' : 'border-[#ede5d8] bg-white/70'}`;
    }

    if (inputDot) inputDot.classList.toggle('active', isInputMode);
    if (browseDot) browseDot.classList.toggle('active', !isInputMode);

    if (inputSlot) {
        inputSlot.classList.toggle('hidden', !isInputMode);
    }

    if (inputPanel) {
        inputPanel.classList.toggle('hidden', !isInputMode);
    }

    if (submitBtn) {
        submitBtn.textContent = isInputMode ? 'この音で探す' : '響きを見て探す';
    }

    const posLabels = document.querySelectorAll('.sound-entry-pos-label');
    posLabels.forEach((label) => {
        const radio = label.querySelector('input[type="radio"]');
        const isChecked = !!radio?.checked;
        label.className = `sound-entry-pos-label flex items-center justify-center rounded-2xl border px-2 py-2 cursor-pointer whitespace-nowrap ${isChecked ? 'border-[#c8a873] bg-[#fff0d7] text-[#8b6c34]' : 'border-[#e4d8c7] bg-white text-[#8b7e66]'}`;
    });

    if (isInputMode) {
        const input = document.getElementById('in-sound-entry');
        if (input) {
            setTimeout(() => input.focus(), 30);
        }
    }
}

/**
 * 響きモード分岐オーバーレイを閉じて指定モードへ遷移
 */
function closeSoundEntryAndGo(mode) {
    if (mode === 'nickname') {
        appMode = 'nickname';
        soundModeEntryOrigin = true; // 響きエントリーから来た（戻るボタンで入口に戻るため）
        changeScreen('scr-input-nickname');
    } else {
        initSoundMode();
    }
}

function submitSoundEntry() {
    const input = document.getElementById('in-sound-entry');
    const raw = input && typeof input.value === 'string' ? input.value.trim() : '';
    const cleaned = typeof toHira === 'function' ? toHira(raw) : raw;

    if (soundEntryMode !== 'input') {
        appMode = 'sound';
        soundModeEntryOrigin = true;
        clearReadingStockSoundFilter();
        initSoundMode();
        return;
    }

    if (!cleaned) {
        if (typeof showToast === 'function') {
            showToast('入れたい音を入力してください', '✏️');
        } else {
            alert('入れたい音を入力してください');
        }
        return;
    }

    const selectedPosition = document.querySelector('input[name="sound-entry-position"]:checked');
    nicknamePosition = selectedPosition?.value === 'suffix' ? 'suffix' : 'prefix';
    setReadingStockSoundFilter(cleaned, nicknamePosition);
    appMode = 'nickname';
    soundModeEntryOrigin = true;
    startNicknameCandidateSwipe(cleaned);
}

function getCurrentEncounteredMonthKey(date = new Date()) {
    try {
        const parts = new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Asia/Tokyo',
            year: 'numeric',
            month: '2-digit'
        }).formatToParts(date);
        const year = parts.find(part => part.type === 'year')?.value;
        const month = parts.find(part => part.type === 'month')?.value;
        if (year && month) return `${year}_${month}`;
    } catch (error) {
        console.warn('ENCOUNTERED: Failed to resolve month key', error);
    }

    const offsetMs = 9 * 60 * 60 * 1000;
    const shifted = new Date(date.getTime() + offsetMs);
    return `${shifted.getUTCFullYear()}_${String(shifted.getUTCMonth() + 1).padStart(2, '0')}`;
}

function normalizeEncounteredLibraryMonthCounters(entry, currentMonthKey) {
    if (!entry || typeof entry !== 'object') {
        return { entry, mutated: false };
    }

    const next = { ...entry };
    const previousMonthKey = typeof next.monthlyMonthKey === 'string' ? next.monthlyMonthKey : '';
    const hasMonthlyState = previousMonthKey
        || Number(next.monthlySeenCount)
        || Number(next.monthlyLikeCount)
        || Number(next.monthlyNopeCount);

    next.seenCount = Number(next.seenCount) || 0;
    next.likeCount = Number(next.likeCount) || 0;
    next.nopeCount = Number(next.nopeCount) || 0;

    if (previousMonthKey === currentMonthKey) {
        next.monthlySeenCount = Number(next.monthlySeenCount) || 0;
        next.monthlyLikeCount = Number(next.monthlyLikeCount) || 0;
        next.monthlyNopeCount = Number(next.monthlyNopeCount) || 0;
        next.monthlyMonthKey = currentMonthKey;
        return { entry: next, mutated: false };
    }

    next.monthlySeenCount = 0;
    next.monthlyLikeCount = 0;
    next.monthlyNopeCount = 0;

    if (!hasMonthlyState && next.lastSeenAt) {
        const lastSeenAt = new Date(next.lastSeenAt);
        if (!Number.isNaN(lastSeenAt.getTime()) && getCurrentEncounteredMonthKey(lastSeenAt) === currentMonthKey) {
            next.monthlySeenCount = 1;
        }
    }

    next.monthlyMonthKey = currentMonthKey;
    return { entry: next, mutated: true };
}

function normalizeEncounteredLibrary(library) {
    const currentMonthKey = getCurrentEncounteredMonthKey();
    let mutated = false;

    const normalizeList = (list) => {
        if (!Array.isArray(list)) return [];
        return list.map((item) => {
            const normalized = normalizeEncounteredLibraryMonthCounters(item, currentMonthKey);
            mutated = mutated || normalized.mutated;
            return normalized.entry;
        });
    };

    return {
        library: {
            kanji: normalizeList(library?.kanji),
            readings: normalizeList(library?.readings)
        },
        mutated
    };
}

function getEncounteredLibrary() {
    try {
        const raw = JSON.parse(localStorage.getItem(ENCOUNTERED_LIBRARY_KEY) || '{}');
        const library = {
            kanji: Array.isArray(raw.kanji) ? raw.kanji : [],
            readings: Array.isArray(raw.readings) ? raw.readings : []
        };
        const initialReadingCount = library.readings.length;
        library.readings = library.readings.filter(item => !isLegacySyntheticEncounteredReading(item));
        const normalized = normalizeEncounteredLibrary(library);
        if (library.readings.length !== initialReadingCount || normalized.mutated) {
            saveEncounteredLibrary(normalized.library);
        }

        return normalized.library;
    } catch (error) {
        console.warn('ENCOUNTERED: Failed to read library', error);
        return { kanji: [], readings: [] };
    }
}

function saveEncounteredLibrary(library, options = {}) {
    try {
        const safeLibrary = {
            kanji: Array.isArray(library?.kanji) ? library.kanji.slice(0, 300) : [],
            readings: Array.isArray(library?.readings) ? library.readings.slice(0, 300) : []
        };
        localStorage.setItem(ENCOUNTERED_LIBRARY_KEY, JSON.stringify(safeLibrary));

        if (typeof MeimayPairing !== 'undefined' && MeimayPairing.roomCode && typeof MeimayPairing._autoSyncDebounced === 'function') {
            MeimayPairing._autoSyncDebounced();
        }

    } catch (error) {
        console.warn('ENCOUNTERED: Failed to save library', error);
    }
}

function updateEncounteredLibraryEntry(kind, key, payload = {}, options = {}) {
    if (!kind || !key) return;
    const library = getEncounteredLibrary();
    const list = kind === 'reading' ? library.readings : library.kanji;
    const index = list.findIndex(item => item && item.key === key);
    const now = new Date().toISOString();
    const action = options.action || payload.lastAction || '';
    const currentMonthKey = getCurrentEncounteredMonthKey();

    const base = index >= 0 ? list[index] : {
        key,
        seenCount: 0,
        likeCount: 0,
        nopeCount: 0,
        monthlySeenCount: 0,
        monthlyLikeCount: 0,
        monthlyNopeCount: 0,
        monthlyMonthKey: currentMonthKey,
        firstSeenAt: now
    };
    const baseSeenCount = Number(base.seenCount) || 0;
    const baseLikeCount = Number(base.likeCount) || 0;
    const baseNopeCount = Number(base.nopeCount) || 0;
    const baseMonthlySeenCount = Number(base.monthlySeenCount) || 0;
    const baseMonthlyLikeCount = Number(base.monthlyLikeCount) || 0;
    const baseMonthlyNopeCount = Number(base.monthlyNopeCount) || 0;

    const next = {
        ...base,
        ...payload,
        key,
        encounterOrigin: base.encounterOrigin || payload.encounterOrigin || (options.incrementSeen ? 'swipe' : ''),
        seenCount: baseSeenCount + (options.incrementSeen ? 1 : 0),
        likeCount: baseLikeCount + (options.incrementLike ? 1 : 0),
        nopeCount: baseNopeCount + (options.incrementNope ? 1 : 0),
        monthlySeenCount: baseMonthlySeenCount + (options.incrementSeen ? 1 : 0),
        monthlyLikeCount: baseMonthlyLikeCount + (options.incrementLike ? 1 : 0),
        monthlyNopeCount: baseMonthlyNopeCount + (options.incrementNope ? 1 : 0),
        monthlyMonthKey: currentMonthKey,
        lastSeenAt: now
    };

    if (action) next.lastAction = action;
    if (!next.encounterOrigin) delete next.encounterOrigin;

    if (index >= 0) {
        list[index] = next;
    } else {
        list.unshift(next);
    }

    saveEncounteredLibrary(library);

}

function recordEncounteredSwipeItem(item, action) {
    if (!item) return;

    if (item['漢字']) {
        updateEncounteredLibraryEntry('kanji', item['漢字'], {
            kanji: item['漢字'],
            strokes: item['画数'] ?? item.strokes ?? null,
            category: item['カテゴリ'] || item.category || '',
            kanjiReading: item.kanji_reading || '',
            tags: Array.isArray(item.tags) ? [...item.tags] : [],
            snapshot: {
                '漢字': item['漢字'],
                '画数': item['画数'] ?? item.strokes ?? null,
                'カテゴリ': item['カテゴリ'] || item.category || '',
                kanji_reading: item.kanji_reading || '',
                slot: Number.isFinite(Number(item.slot)) ? Number(item.slot) : -1,
                sessionReading: item.sessionReading || '',
                sessionSegments: Array.isArray(item.sessionSegments) ? [...item.sessionSegments] : [],
                sessionDisplaySegments: Array.isArray(item.sessionDisplaySegments) ? [...item.sessionDisplaySegments] : []
            }
        }, {
            action,
            incrementSeen: true,
            incrementLike: action === 'like' || action === 'super',
            incrementNope: action === 'nope'
        });
    }

    if (item.reading) {
        updateEncounteredLibraryEntry('reading', item.reading, {
            reading: item.reading,
            tags: Array.isArray(item.tags) ? [...item.tags] : [],
            examples: Array.isArray(item.examples) ? [...item.examples] : [],
            mode: SwipeState.mode || ''
        }, {
            action,
            incrementSeen: true,
            incrementLike: action === 'like' || action === 'super',
            incrementNope: action === 'nope'
        });
    }
}


/**
 * 性別選択（ウィザードから設定済みだが互換性のため残す）
 */
function selectGender(g) {
    gender = g;
    console.log(`UI_FLOW: Gender selected ${g}`);

    // ウィザードで既に設定済みなので、startModeと同じルーティング
    if (appMode === 'free') {
        initVibeScreen();
        changeScreen('scr-vibe');
    } else if (appMode === 'nickname') {
        changeScreen('scr-input-nickname');
    } else if (appMode === 'sound') {
        initSoundMode();
    } else {
        changeScreen('scr-input-reading');
    }
}

/**
 * 性別設定（グローバル）
 */
function setGender(g) {
    gender = g;
    console.log(`UI_FLOW: Gender set to ${g}`);
}

/**
 * イメージ画面初期化
 */
function initVibeScreen() {
    const grid = document.getElementById('vibe-grid');
    if (!grid) return;

    grid.innerHTML = '';
    selectedVibes.clear();
    selectedVibes.add('none'); // デフォルト選択

    // こだわらない: 3マス幅のワイドボタン（デフォルト選択状態）
    const noneBtn = document.createElement('button');
    noneBtn.id = 'vibe-btn-none';
    noneBtn.className = 'col-span-3 flex items-center justify-center py-2.5 px-4 rounded-xl border border-transparent shadow-sm transition-all active:scale-95 ring-2 ring-[#bca37f] bg-[#fffbeb]';
    noneBtn.innerHTML = `<span class="text-[12px] font-bold text-[#5d5444]">こだわらない</span>`;
    noneBtn.onclick = () => toggleVibe('none', noneBtn);
    grid.appendChild(noneBtn);

    // 15タグ: 3×5 グリッド、絵文字 + #タグ名
    VIBES.filter(v => v.id !== 'none').forEach(v => {
        const btn = document.createElement('button');
        btn.id = `vibe-btn-${v.id}`;
        btn.className = 'flex flex-col items-center justify-center py-2 px-1 bg-white/60 rounded-xl border border-transparent shadow-sm transition-all hover:bg-white active:scale-95';
        btn.innerHTML = `<span class="text-lg leading-none mb-0.5">${v.icon}</span><span class="text-[11px] font-bold text-[#5d5444] leading-tight">${v.label}</span>`;
        btn.onclick = () => toggleVibe(v.id, btn);
        grid.appendChild(btn);
    });
}

/**
 * イメージ切り替え
 */
function toggleVibe(id, btn) {
    if (id === 'none') {
        // 「こだわらない」選択時 -> 他をクリアしてこれだけにする
        selectedVibes.clear();
        selectedVibes.add('none');

        // 全ボタンのスタイル更新
        VIBES.forEach(v => {
            const el = document.getElementById(`vibe-btn-${v.id}`);
            if (el) {
                if (v.id === 'none') el.classList.add('ring-2', 'ring-[#bca37f]', 'bg-[#fffbeb]');
                else el.classList.remove('ring-2', 'ring-[#bca37f]', 'bg-[#fffbeb]');
            }
        });
        return;
    }

    // 他の項目選択時 -> 「こだわらない」を解除
    if (selectedVibes.has('none')) {
        selectedVibes.delete('none');
        const noneBtn = document.getElementById('vibe-btn-none');
        if (noneBtn) noneBtn.classList.remove('ring-2', 'ring-[#bca37f]', 'bg-[#fffbeb]');
    }

    if (selectedVibes.has(id)) {
        selectedVibes.delete(id);
        btn.classList.remove('ring-2', 'ring-[#bca37f]', 'bg-[#fffbeb]');
    } else {
        selectedVibes.add(id);
        btn.classList.add('ring-2', 'ring-[#bca37f]', 'bg-[#fffbeb]');
    }

    // 全て解除されたら「こだわらない」に戻す？
    if (selectedVibes.size === 0) {
        selectedVibes.add('none');
        const noneBtn = document.getElementById('vibe-btn-none');
        if (noneBtn) noneBtn.classList.add('ring-2', 'ring-[#bca37f]', 'bg-[#fffbeb]');
    }
}

/**
 * イメージ確定 -> 各入力画面へ
 * 苗字はウィザードで設定済みなのでスキップ
 */
function submitVibe() {
    // グローバル変数更新
    if (selectedVibes.size > 0) {
        window.selectedImageTags = Array.from(selectedVibes);
    } else {
        window.selectedImageTags = ['none'];
    }

    console.log("UI_FLOW: Vibes set", window.selectedImageTags);

    if (appMode === 'free') {
        startFreeSwiping();
    } else {
        isFreeSwipeMode = false;
        window._addMoreFromBuild = false;
        // 苗字はウィザードで設定済みなので直接スワイプ開始
        startSwiping();
    }
}

/**
 * 響きから選ぶモード（Sound Mode）
 * 人気の名前読みをスワイプして、気に入った響きから漢字を選ぶ
 */
function initSoundMode() {
    console.log("UI_FLOW: initSoundMode");

    const popularNames = generatePopularNames(gender).map(item => ({
        ...item,
        gender: item.gender || gender || 'neutral'
    }));

    startUniversalSwipe('sound', popularNames, {
        title: '響きで選ぶ',
        subtitle: '気に入った名前の響きをスワイプ',
        onLike: (item, action) => {
            if (typeof addReadingToStock === 'function') {
                addReadingToStock(item.reading, '', item.tags || [], {
                    segments: getPreferredReadingSegments(item.reading),
                    isSuper: action === 'super',
                    gender: item.gender || gender || 'neutral',
                    clearHidden: true
                });
            }
        },
        onTap: (item) => {
            openReadingCombinationModal(item);
        },
        renderCard: (item) => renderReadingSwipeCard(item)
    });

    // AI分析ボタンをスワイプ画面に追加 (一旦非表示)
    /*
    setTimeout(() => {
        const swipeScreen = document.getElementById('scr-swipe-universal');
        if (swipeScreen && !document.getElementById('btn-ai-sound-analyze')) {
            const aiBtn = document.createElement('button');
            aiBtn.id = 'btn-ai-sound-analyze';
            aiBtn.className = 'fixed bottom-20 right-4 z-[200] bg-gradient-to-r from-[#bca37f] to-[#8b7e66] text-white px-4 py-2.5 rounded-full text-xs font-bold shadow-lg flex items-center gap-1.5 hover:shadow-xl transition-all active:scale-95';
            aiBtn.innerHTML = '🤖 AI分析';
            aiBtn.onclick = aiAnalyzeSoundPreferences;
            swipeScreen.appendChild(aiBtn);
        }
    }, 500);
    */
}
/**
 * 響きスワイプ用ヘルパー
 */
const READING_CARD_GENDER_BORDERS = {
    male: '#9DC4FF',
    female: '#F3A9B7',
    neutral: '#E6C45F'
};

const readingKanjiCache = new Map();
let readingCombinationModalState = null;
let readingCombinationModalOpenedAt = 0;

function getReadingTonePalette(reading) {
    const firstMora = splitReadingIntoMoraUnits(reading || '')[0] || '';
    const firstKana = Array.from(firstMora)[0] || '';
    const vowel = (typeof getVowelPattern === 'function' ? getVowelPattern(firstKana) : '') || '';
    const key = vowel.charAt(0) || 'n';
    const palettes = {
        a: { base: '#fbf1ea', mid: '#f7ede5', accent: '#f1e1d1' },
        i: { base: '#eef4fb', mid: '#e7eef9', accent: '#dde7f5' },
        u: { base: '#edf6f0', mid: '#e6f1ea', accent: '#d9e9df' },
        e: { base: '#faf5e8', mid: '#f6f0e0', accent: '#eee3c9' },
        o: { base: '#f4eef8', mid: '#eee6f5', accent: '#e5d9ef' },
        n: { base: '#f7f2eb', mid: '#f2ece2', accent: '#eadfcf' }
    };
    return palettes[key] || palettes.n;
}

function getReadingCardTone(item) {
    const palette = getReadingTonePalette(item?.reading || '');
    return {
        bgColor: `linear-gradient(160deg, ${palette.base} 0%, ${palette.mid} 52%, ${palette.accent} 100%)`,
        surfaceStyle: `radial-gradient(circle at top left, rgba(255,255,255,0.88), transparent 34%), linear-gradient(145deg, ${palette.base} 0%, ${palette.mid} 48%, ${palette.accent} 100%)`,
        panelStyle: 'linear-gradient(180deg, rgba(255,255,255,0.80), rgba(255,255,255,0.64))',
        borderColor: '#e4d6c1'
    };
}

function getReadingFullNamePreview(reading) {
    const familyKanji = surnameStr || '';
    const familyReading = typeof surnameReading !== 'undefined' ? surnameReading : '';
    return {
        visual: familyKanji ? `${familyKanji} ${reading}` : reading,
        ruby: familyReading ? `${familyReading} ${reading}` : reading,
        joined: familyKanji ? `${familyKanji}${reading}` : reading
    };
}

function isCompoundGenderAllowed(entryGender, targetGender = gender || 'neutral') {
    const allowed = Array.isArray(entryGender) ? entryGender.filter(Boolean) : [];
    if (allowed.length === 0 || !targetGender || targetGender === 'neutral') return true;
    return allowed.includes(targetGender) || allowed.includes('neutral');
}

function getCompoundStrokeCount(kanji) {
    const chars = (kanji || '').split('').filter(Boolean);
    if (chars.length === 0) return 1;

    const total = chars.reduce((sum, char) => {
        const strokeFromMap = strokeData && strokeData[char] ? parseInt(strokeData[char]) || 0 : 0;
        if (strokeFromMap > 0) return sum + strokeFromMap;
        const found = Array.isArray(master) ? master.find(item => item['漢字'] === char) : null;
        return sum + (found ? parseInt(found['画数']) || 0 : 0);
    }, 0);

    return total > 0 ? total : chars.length;
}

function getCompoundTags(reading, fallbackTags = []) {
    const normalizedReading = toHira(reading || '');
    const source = Array.isArray(readingsData)
        ? readingsData.find(item => toHira(item?.reading || '') === normalizedReading)
        : null;
    const readingTags = Array.isArray(source?.tags) ? source.tags.filter(Boolean) : [];
    const entryTags = Array.isArray(fallbackTags) ? fallbackTags.filter(Boolean) : [];
    return [...new Set([...(readingTags || []), ...(entryTags || [])])];
}

function createCompoundPiece(entry, consumedReading, targetGender = gender || 'neutral', tags = [], score = 0) {
    const normalizedTags = Array.isArray(tags) ? tags.filter(Boolean) : [];
    return {
        '漢字': entry.kanji,
        '画数': getCompoundStrokeCount(entry.kanji),
        '分類': normalizedTags.join(' '),
        '意味': entry.meaning || '',
        '名前のイメージ': entry.note || '',
        '_recommendationScore': score,
        '_readingMatchTier': 0,
        '_genderPriority': isCompoundGenderAllowed(entry.gender, targetGender) ? 0 : 2,
        isCompound: true,
        compoundReading: consumedReading
    };
}

function seedCompoundSingleKanjiStock(compoundKanji, sessionReading) {
    const chars = Array.from(compoundKanji || '').filter(Boolean);
    if (chars.length <= 1 || !Array.isArray(liked)) {
        return chars;
    }

    const resolvedSegments = Array.isArray(sessionSegments) && sessionSegments.length > 0
        ? [...sessionSegments]
        : chars.map((_, idx) => `__compound_slot_${slotOffset + idx}__`);

    chars.forEach((char, idx) => {
        const exists = liked.some((item) =>
            item &&
            item['漢字'] === char &&
            item.slot === idx &&
            item.sessionReading === sessionReading
        );
        if (exists) return;

        const masterItem = Array.isArray(master)
            ? master.find((entry) => entry['漢字'] === char)
            : null;

        liked.push({
            ...(masterItem || {}),
            '漢字': char,
            slot: idx,
            sessionReading,
            sessionSegments: [],
            sessionDisplaySegments: [sessionReading],
            _compoundSeeded: true
        });
    });

    if (typeof StorageBox !== 'undefined' && StorageBox.saveLiked) {
        StorageBox.saveLiked();
    } else {
        try {
            localStorage.setItem('meimay_liked', JSON.stringify(liked));
        } catch (error) {
            console.warn('COMPOUND: Failed to seed kanji stock', error);
        }
    }
    if (typeof queuePartnerStockSync === 'function') {
        queuePartnerStockSync('seedCompoundStock');
    }

    return chars;
}

function buildExpandedCompoundSlotLabels(consumedReading, fixedCount, tailSegments = []) {
    const labels = [];
    const fixedLabel = fixedCount > 1
        ? `${Array.from({ length: fixedCount }, (_, idx) => `${idx + 1}文字目`).join('＋')}: ${consumedReading}`
        : `1文字目: ${consumedReading}`;

    for (let i = 0; i < fixedCount; i++) {
        labels.push(fixedLabel);
    }

    let offset = fixedCount;
    (Array.isArray(tailSegments) ? tailSegments : []).forEach((segment) => {
        labels.push(`${offset + 1}文字目: ${segment}`);
        offset += 1;
    });

    return labels;
}

function startCompoundReadingFlow(option, item = {}) {
    if (!option || !Array.isArray(option.path) || option.path.length === 0) return;

    const sessionReading = toHira(item.reading || option.path.join(''));
    const fixedSource = option.fixedPiece || option.candidates?.[0]?.combination?.[0];
    if (!fixedSource || !fixedSource['漢字']) return;

    const compoundChars = Array.from(fixedSource['漢字'] || '').filter(Boolean);
    if (compoundChars.length > 1) {
        const tailSegments = option.optionMode === 'prefix' ? option.path.slice(1) : [];
        const fixedSlotsBySlot = {};
        const expandedSegments = [
            ...compoundChars.map((_, idx) => `__compound_slot_${idx}__`),
            ...tailSegments
        ];

        seedCompoundSingleKanjiStock(fixedSource['漢字'], sessionReading);

        compoundChars.forEach((char, idx) => {
            const masterItem = Array.isArray(master)
                ? master.find((entry) => entry['漢字'] === char)
                : null;
            fixedSlotsBySlot[idx] = {
                ...(masterItem || {}),
                '漢字': char,
                slot: idx,
                sessionReading,
                sessionSegments: [...expandedSegments],
                sessionDisplaySegments: [...option.path],
                isFixedCompound: true,
                _compoundFixed: true
            };
        });

        const flow = setCompoundBuildFlow({
            reading: sessionReading,
            segments: [...expandedSegments],
            displaySegments: [...option.path],
            slotLabels: buildExpandedCompoundSlotLabels(option.path[0], compoundChars.length, tailSegments),
            fixedSlotsBySlot,
            firstInteractiveSlot: tailSegments.length > 0 ? compoundChars.length : -1,
            optionLabel: option.label || '',
            compoundKanji: fixedSource['漢字'] || '',
            optionMode: option.optionMode || 'compound'
        });

        segments = [...flow.segments];
        swipes = 0;
        currentIdx = 0;
        window._addMoreFromBuild = false;
        isFreeSwipeMode = false;

        if (typeof seen !== 'undefined' && seen && typeof seen.clear === 'function') {
            seen.clear();
        }
        if (typeof updateSurnameData === 'function') {
            updateSurnameData();
        }
        if (typeof addToReadingHistory === 'function') {
            addToReadingHistory();
        }

        if (flow.firstInteractiveSlot === -1) {
            currentPos = 0;
            if (typeof openBuild === 'function') openBuild();
            return;
        }

        currentPos = flow.firstInteractiveSlot;
        if (typeof loadStack === 'function') loadStack();
        changeScreen('scr-main');
        return;
    }

    const fixedPiece = {
        ...fixedSource,
        slot: 0,
        sessionReading: sessionReading,
        sessionSegments: [...option.path],
        isFixedCompound: true,
        _compoundFixed: true
    };

    const fixedSlotsBySlot = { 0: fixedPiece };
    const firstInteractiveSlot = option.path.findIndex((_, idx) => !fixedSlotsBySlot[idx]);
    const flow = setCompoundBuildFlow({
        reading: sessionReading,
        segments: [...option.path],
        slotLabels: Array.isArray(option.slotLabels) ? [...option.slotLabels] : buildCompoundSlotLabels(option.path),
        fixedSlotsBySlot,
        firstInteractiveSlot,
        optionLabel: option.label || '',
        compoundKanji: fixedPiece['漢字'] || '',
        optionMode: option.optionMode || 'compound'
    });

    segments = [...flow.segments];
    swipes = 0;
    currentIdx = 0;
    window._addMoreFromBuild = false;
    isFreeSwipeMode = false;

    if (typeof seen !== 'undefined' && seen && typeof seen.clear === 'function') {
        seen.clear();
    }
    if (typeof clearTemporarySwipeRules === 'function') clearTemporarySwipeRules();

    if (typeof updateSurnameData === 'function') {
        updateSurnameData();
    }
    if (typeof addToReadingHistory === 'function') {
        addToReadingHistory();
    }

    if (firstInteractiveSlot === -1) {
        currentPos = 0;
        if (typeof openBuild === 'function') openBuild();
        return;
    }

    currentPos = firstInteractiveSlot;
    if (typeof loadStack === 'function') loadStack();
    changeScreen('scr-main');
}

window.startCompoundReadingFlow = startCompoundReadingFlow;

function getCompoundReadingOptions(reading, limit = 6, targetGender = gender || 'neutral') {
    const inputReading = toHira(reading || '');
    if (!inputReading || !Array.isArray(compoundReadingsData) || compoundReadingsData.length === 0) {
        return [];
    }

    const options = [];
    const seenKeys = new Set();

    compoundReadingsData.forEach((entry) => {
        if (!entry || !entry.kanji) return;
        const variants = Array.isArray(entry.variants) ? entry.variants : [];

        variants.forEach((variant) => {
            const consumedReading = toHira(variant?.reading || '');
            if (!consumedReading) return;

            const compoundTargetGender = 'neutral';
            const mode = variant.mode || 'exact';
            const supportsExact = mode === 'exact' || mode === 'exact_prefix';
            const supportsPrefix = mode === 'prefix' || mode === 'exact_prefix';
            const baseScore = (parseInt(variant.score, 10) || parseInt(entry.priority, 10) || 80) * 100;
            const tags = getCompoundTags(inputReading, entry.tags || []);
            const fixedPiece = createCompoundPiece(entry, consumedReading, compoundTargetGender, tags, baseScore);

            if (supportsExact && inputReading === consumedReading) {
                const label = entry.kanji;
                const exactKey = `exact::${entry.kanji}::${inputReading}`;
                if (!seenKeys.has(exactKey)) {
                    seenKeys.add(exactKey);
                    options.push({
                        path: [inputReading],
                        label,
                        optionType: 'compound',
                        optionMode: 'exact',
                        fixedPiece: { ...fixedPiece },
                        badgeLabel: 'まとめ読み',
                        candidates: [{
                            givenName: entry.kanji,
                            fullName: surnameStr ? `${surnameStr} ${entry.kanji}` : entry.kanji,
                            score: baseScore,
                            combination: [{ ...fixedPiece }]
                        }],
                        examples: [entry.kanji],
                        tags,
                        slotLabels: buildCompoundSlotLabels([inputReading]),
                        sortScore: baseScore + 50
                    });
                }
            }

            if (supportsPrefix && inputReading.startsWith(consumedReading) && inputReading.length > consumedReading.length) {
                const tailReading = inputReading.slice(consumedReading.length);
                const tailPaths = typeof getReadingSegmentPaths === 'function'
                    ? getReadingSegmentPaths(tailReading, 4, { strictOnly: true, allowFallback: false })
                    : [];

                tailPaths.forEach((tailPath) => {
                    const cleanTailPath = Array.isArray(tailPath) ? tailPath.filter(Boolean) : [];
                    if (cleanTailPath.length === 0) return;

                    const label = `${entry.kanji} / ${cleanTailPath.join('/')}`;
                    const prefixKey = `prefix::${entry.kanji}::${cleanTailPath.join('/')}`;
                    if (seenKeys.has(prefixKey)) return;

                    const tailCandidates = buildReadingCombinationCandidates(cleanTailPath, 4, targetGender)
                        .map((candidate) => ({
                            givenName: `${entry.kanji}${candidate.givenName}`,
                            fullName: surnameStr ? `${surnameStr} ${entry.kanji}${candidate.givenName}` : `${entry.kanji}${candidate.givenName}`,
                            score: baseScore + (candidate.score || 0),
                            combination: [{ ...fixedPiece }, ...candidate.combination.map(piece => ({ ...piece }))]
                        }))
                        .filter(candidate => candidate.givenName && candidate.combination.length > 1);

                    if (tailCandidates.length === 0) return;

                    seenKeys.add(prefixKey);
                    options.push({
                        path: [consumedReading, ...cleanTailPath],
                        label,
                        optionType: 'compound',
                        optionMode: 'prefix',
                        fixedPiece: { ...fixedPiece },
                        badgeLabel: '先頭まとめ',
                        candidates: tailCandidates,
                        examples: [],
                        tags,
                        slotLabels: buildCompoundSlotLabels([consumedReading, ...cleanTailPath]),
                        sortScore: Math.max(...tailCandidates.map(candidate => candidate.score || 0))
                    });
                });
            }
        });
    });

    return options
        .sort((a, b) => {
            if ((b.sortScore || 0) !== (a.sortScore || 0)) return (b.sortScore || 0) - (a.sortScore || 0);
            return a.label.localeCompare(b.label, 'ja');
        })
        .slice(0, limit);
}

function seedCompoundSingleKanjiStock(compoundKanji, sessionReading, slotOffset = 0, sessionSegments = [], sessionDisplaySegments = []) {
    const chars = Array.from(compoundKanji || '').filter(Boolean);
    if (chars.length <= 1 || !Array.isArray(liked)) {
        return chars;
    }

    const resolvedSessionSegments = Array.isArray(sessionSegments) && sessionSegments.length > 0
        ? [...sessionSegments]
        : chars.map((_, idx) => `__compound_slot_${slotOffset + idx}__`);

    chars.forEach((char, idx) => {
        const slotIndex = slotOffset + idx;
        const exists = liked.some((item) =>
            item &&
            item['漢字'] === char &&
            item.slot === slotIndex &&
            item.sessionReading === sessionReading
        );
        if (exists) return;

        const masterItem = Array.isArray(master)
            ? master.find((entry) => entry['漢字'] === char)
            : null;

        liked.push({
            ...(masterItem || {}),
            '漢字': char,
            slot: slotIndex,
            sessionReading,
            sessionSegments: [...resolvedSessionSegments],
            sessionDisplaySegments: Array.isArray(sessionDisplaySegments) ? [...sessionDisplaySegments] : [sessionReading],
            _compoundSeeded: true
        });
    });

    if (typeof StorageBox !== 'undefined' && StorageBox.saveLiked) {
        StorageBox.saveLiked();
    } else {
        try {
            localStorage.setItem('meimay_liked', JSON.stringify(liked));
        } catch (error) {
            console.warn('COMPOUND: Failed to seed kanji stock', error);
        }
    }
    if (typeof queuePartnerStockSync === 'function') {
        queuePartnerStockSync('seedCompoundStock');
    }

    return chars;
}

function buildExpandedCompoundSlotLabels(path, compoundStartIndex, compoundEndIndex, fixedCount) {
    const labels = [];
    const safePath = Array.isArray(path) ? path.filter(Boolean) : [];
    const safeStart = Math.max(0, Number(compoundStartIndex) || 0);
    const safeEnd = Math.max(safeStart, Number(compoundEndIndex) || safeStart);
    const compoundReading = safePath.slice(safeStart, safeEnd + 1).join('');
    let cursor = 0;

    safePath.forEach((segment, index) => {
        if (index < safeStart || index > safeEnd) {
            labels.push(formatCompoundSlotLabel(cursor, segment));
            cursor += Array.from(segment || '').length || 1;
            return;
        }

        if (index === safeStart) {
            const fixedLabel = formatCompoundSlotLabel(cursor, compoundReading || segment);
            for (let i = 0; i < fixedCount; i++) {
                labels.push(fixedLabel);
            }
            cursor += Array.from(compoundReading || segment || '').length || fixedCount || 1;
        }
    });

    return labels;
}

function startCompoundReadingFlow(option, item = {}) {
    if (!option || !Array.isArray(option.path) || option.path.length === 0) return;

    const sessionReading = toHira(item.reading || option.path.join(''));
    const fixedSource = option.fixedPiece || option.candidates?.[0]?.combination?.find((piece) => piece?.isCompound);
    if (!fixedSource || !fixedSource['漢字']) return;

    const compoundChars = Array.from(fixedSource['漢字'] || '').filter(Boolean);
    if (compoundChars.length > 1) {
        const safePath = option.path.filter(Boolean);
        const compoundStartIndex = Number.isInteger(option.compoundSegmentStart) ? option.compoundSegmentStart : 0;
        const compoundEndIndex = Number.isInteger(option.compoundSegmentEnd) ? option.compoundSegmentEnd : compoundStartIndex;
        const prefixSegments = safePath.slice(0, compoundStartIndex);
        const suffixSegments = safePath.slice(compoundEndIndex + 1);
        const fixedSlotStart = prefixSegments.length;
        const fixedSlotsBySlot = {};
        const expandedSegments = [
            ...prefixSegments,
            ...compoundChars.map((_, idx) => '__compound_slot_' + (fixedSlotStart + idx) + '__'),
            ...suffixSegments
        ];

        seedCompoundSingleKanjiStock(
            fixedSource['漢字'],
            sessionReading,
            fixedSlotStart,
            expandedSegments
        );

        compoundChars.forEach((char, idx) => {
            const masterItem = Array.isArray(master)
                ? master.find((entry) => entry['漢字'] === char)
                : null;
            const slotIndex = fixedSlotStart + idx;
            fixedSlotsBySlot[slotIndex] = {
                ...(masterItem || {}),
                '漢字': char,
                slot: slotIndex,
                sessionReading,
                sessionSegments: [...expandedSegments],
                sessionDisplaySegments: [...safePath],
                isFixedCompound: true,
                _compoundFixed: true
            };
        });

        const interactiveSlots = expandedSegments
            .map((_, idx) => fixedSlotsBySlot[idx] ? null : idx)
            .filter((idx) => idx !== null);
        const flow = setCompoundBuildFlow({
            reading: sessionReading,
            segments: [...expandedSegments],
            displaySegments: [...safePath],
            slotLabels: buildExpandedCompoundSlotLabels(
                safePath,
                compoundStartIndex,
                compoundEndIndex,
                compoundChars.length
            ),
            fixedSlotsBySlot,
            firstInteractiveSlot: interactiveSlots.length > 0 ? interactiveSlots[0] : -1,
            interactiveSlots,
            optionLabel: option.label || '',
            compoundKanji: fixedSource['漢字'] || '',
            optionMode: option.optionMode || 'compound'
        });

        segments = [...flow.segments];
        swipes = 0;
        currentIdx = 0;
        window._addMoreFromBuild = false;
        isFreeSwipeMode = false;

        if (typeof seen !== 'undefined' && seen && typeof seen.clear === 'function') {
            seen.clear();
        }
        if (typeof updateSurnameData === 'function') {
            updateSurnameData();
        }
        if (typeof addToReadingHistory === 'function') {
            addToReadingHistory();
        }

        if (flow.firstInteractiveSlot === -1) {
            currentPos = 0;
            if (typeof openBuild === 'function') openBuild();
            return;
        }

        currentPos = flow.firstInteractiveSlot;
        if (typeof loadStack === 'function') loadStack();
        changeScreen('scr-main');
        return;
    }

    const fixedPiece = {
        ...fixedSource,
        slot: 0,
        sessionReading,
        sessionSegments: [...option.path],
        sessionDisplaySegments: [...option.path],
        isFixedCompound: true,
        _compoundFixed: true
    };

    const fixedSlotsBySlot = { 0: fixedPiece };
    const firstInteractiveSlot = option.path.findIndex((_, idx) => !fixedSlotsBySlot[idx]);
    const flow = setCompoundBuildFlow({
        reading: sessionReading,
        segments: [...option.path],
        slotLabels: Array.isArray(option.slotLabels) ? [...option.slotLabels] : buildCompoundSlotLabels(option.path),
        fixedSlotsBySlot,
        firstInteractiveSlot,
        optionLabel: option.label || '',
        compoundKanji: fixedPiece['漢字'] || '',
        optionMode: option.optionMode || 'compound'
    });

    segments = [...flow.segments];
    swipes = 0;
    currentIdx = 0;
    window._addMoreFromBuild = false;
    isFreeSwipeMode = false;

    if (typeof seen !== 'undefined' && seen && typeof seen.clear === 'function') {
        seen.clear();
    }
    if (typeof clearTemporarySwipeRules === 'function') clearTemporarySwipeRules();

    if (typeof updateSurnameData === 'function') {
        updateSurnameData();
    }
    if (typeof addToReadingHistory === 'function') {
        addToReadingHistory();
    }

    if (firstInteractiveSlot === -1) {
        currentPos = 0;
        if (typeof openBuild === 'function') openBuild();
        return;
    }

    currentPos = firstInteractiveSlot;
    if (typeof loadStack === 'function') loadStack();
    changeScreen('scr-main');
}

window.startCompoundReadingFlow = startCompoundReadingFlow;

function getCompoundReadingOptions(reading, limit = 6, targetGender = gender || 'neutral') {
    const inputReading = toHira(reading || '');
    if (!inputReading || !Array.isArray(compoundReadingsData) || compoundReadingsData.length === 0) {
        return [];
    }

    const optionsByKey = new Map();
    const strictBasePaths = typeof getReadingSegmentPaths === 'function'
        ? getReadingSegmentPaths(inputReading, 12, { strictOnly: true, allowFallback: false })
        : [];
    const basePaths = strictBasePaths.length > 0
        ? strictBasePaths
        : (typeof getReadingSegmentPaths === 'function'
            ? getReadingSegmentPaths(inputReading, 12, { strictOnly: false, allowFallback: true })
            : []);

    function setOption(optionKey, option) {
        const existing = optionsByKey.get(optionKey);
        if (!existing || (option.sortScore || 0) > (existing.sortScore || 0)) {
            optionsByKey.set(optionKey, option);
        }
    }

    compoundReadingsData.forEach((entry) => {
        if (!entry || !entry.kanji) return;
        const variants = Array.isArray(entry.variants) ? entry.variants : [];

        variants.forEach((variant) => {
            const consumedReading = toHira(variant?.reading || '');
            if (!consumedReading) return;

            const compoundTargetGender = 'neutral';
            const baseScore = (parseInt(variant.score, 10) || parseInt(entry.priority, 10) || 80) * 100;
            const tags = getCompoundTags(inputReading, entry.tags || []);
            const fixedPiece = createCompoundPiece(entry, consumedReading, compoundTargetGender, tags, baseScore);

            if (inputReading === consumedReading) {
                setOption(`${entry.kanji}::${consumedReading}`, {
                    path: [inputReading],
                    label: entry.kanji,
                    optionType: 'compound',
                    optionMode: 'exact',
                    fixedPiece: { ...fixedPiece },
                    compoundSegmentStart: 0,
                    compoundSegmentEnd: 0,
                    badgeLabel: 'まとめ読み',
                    candidates: [{
                        givenName: entry.kanji,
                        fullName: surnameStr ? surnameStr + ' ' + entry.kanji : entry.kanji,
                        score: baseScore,
                        combination: [{ ...fixedPiece }]
                    }],
                    examples: [entry.kanji],
                    tags,
                    slotLabels: buildCompoundSlotLabels([inputReading]),
                    sortScore: baseScore + 100
                });
            }

            basePaths.forEach((path) => {
                const cleanPath = Array.isArray(path) ? path.filter(Boolean) : [];
                if (cleanPath.length === 0) return;

                for (let start = 0; start < cleanPath.length; start++) {
                    let readingSlice = '';
                    for (let end = start; end < cleanPath.length; end++) {
                        readingSlice += cleanPath[end] || '';
                        if (readingSlice.length > consumedReading.length) break;
                        if (readingSlice !== consumedReading) continue;

                        const prefixSegments = cleanPath.slice(0, start);
                        const suffixSegments = cleanPath.slice(end + 1);
                        if (prefixSegments.length === 0 && suffixSegments.length === 0) {
                            break;
                        }
                        const labelParts = [];
                        if (prefixSegments.length > 0) labelParts.push(prefixSegments.join('/'));
                        labelParts.push(entry.kanji);
                        if (suffixSegments.length > 0) labelParts.push(suffixSegments.join('/'));

                        const optionKey = entry.kanji + '::' + labelParts.join('|');

                        const emptyCandidate = {
                            givenName: '',
                            fullName: surnameStr ? surnameStr + ' ' : '',
                            score: 0,
                            combination: []
                        };
                        const prefixCandidates = prefixSegments.length > 0
                            ? buildReadingCombinationCandidates(prefixSegments, 4, compoundTargetGender)
                            : [emptyCandidate];
                        const suffixCandidates = suffixSegments.length > 0
                            ? buildReadingCombinationCandidates(suffixSegments, 4, compoundTargetGender)
                            : [emptyCandidate];
                        const compoundChars = new Set(Array.from(fixedPiece['漢字'] || '').filter(Boolean));
                        const combinedCandidates = [];
                        const seenGivenNames = new Set();

                        prefixCandidates.forEach((prefixCandidate) => {
                            const prefixPieces = Array.isArray(prefixCandidate.combination)
                                ? prefixCandidate.combination.map((piece) => ({ ...piece }))
                                : [];
                            const usedChars = new Set(compoundChars);
                            prefixPieces.forEach((piece) => {
                                Array.from(piece['漢字'] || '').forEach((char) => usedChars.add(char));
                            });

                            suffixCandidates.forEach((suffixCandidate) => {
                                const suffixPieces = Array.isArray(suffixCandidate.combination)
                                    ? suffixCandidate.combination.map((piece) => ({ ...piece }))
                                    : [];
                                const overlaps = suffixPieces.some((piece) =>
                                    Array.from(piece['漢字'] || '').some((char) => usedChars.has(char))
                                );
                                if (overlaps) return;

                                const combination = [
                                    ...prefixPieces,
                                    { ...fixedPiece },
                                    ...suffixPieces
                                ];
                                const givenName = combination.map((piece) => piece['漢字'] || '').join('');
                                if (!givenName || seenGivenNames.has(givenName)) return;
                                seenGivenNames.add(givenName);
                                combinedCandidates.push({
                                    givenName,
                                    fullName: surnameStr ? surnameStr + ' ' + givenName : givenName,
                                    score: baseScore + (prefixCandidate.score || 0) + (suffixCandidate.score || 0),
                                    combination
                                });
                            });
                        });

                        if (combinedCandidates.length === 0) break;

                        const rankedCandidates = combinedCandidates
                            .sort((a, b) => (b.score || 0) - (a.score || 0))
                            .slice(0, 6);

                        setOption(optionKey, {
                            path: cleanPath,
                            label: labelParts.join(' / '),
                            optionType: 'compound',
                            optionMode: prefixSegments.length === 0 && suffixSegments.length === 0 ? 'exact' : 'compound',
                            fixedPiece: { ...fixedPiece },
                            compoundSegmentStart: start,
                            compoundSegmentEnd: end,
                            badgeLabel: 'まとめ読み',
                            candidates: rankedCandidates,
                            examples: rankedCandidates.slice(0, 3).map((candidate) => candidate.givenName),
                            tags,
                            slotLabels: buildCompoundSlotLabels(cleanPath),
                            sortScore: rankedCandidates[0] ? (rankedCandidates[0].score || baseScore) : baseScore
                        });
                        break;
                    }
                }
            });
        });
    });

    return Array.from(optionsByKey.values())
        .sort((a, b) => {
            if ((b.sortScore || 0) !== (a.sortScore || 0)) return (b.sortScore || 0) - (a.sortScore || 0);
            return a.label.localeCompare(b.label, 'ja');
        })
        .slice(0, limit);
}
function getReadingSegmentOptions(reading, limit = 4, extraOptions = {}) {
    const targetGender = gender || 'neutral';
    const normalizedReading = toHira(reading || '');
    const strictPaths = typeof getReadingSegmentPaths === 'function'
        ? getReadingSegmentPaths(normalizedReading, limit * 2, { strictOnly: true, allowFallback: false })
        : [];
    const paths = strictPaths.length > 0
        ? strictPaths
        : (typeof getReadingSegmentPaths === 'function'
            ? getReadingSegmentPaths(normalizedReading, limit * 2, { strictOnly: false, allowFallback: true })
            : []);
    const curatedDirectCandidates = typeof getCuratedReadingSegmentCandidates === 'function'
        ? getCuratedReadingSegmentCandidates(normalizedReading)
        : null;
    const pathPool = Array.isArray(curatedDirectCandidates) && curatedDirectCandidates.length > 0
        ? [[normalizedReading], ...paths]
        : [...paths];

    const seen = new Set();
    const normalOptions = pathPool
        .map(path => {
            const cleanPath = Array.isArray(path) ? path.filter(Boolean) : [];
            const label = cleanPath.join('/');
            if (!label || seen.has(label)) return null;
            const candidates = buildReadingCombinationCandidates(cleanPath, 4, targetGender);
            if (!candidates || candidates.length === 0) return null;
            seen.add(label);
            return {
                path: cleanPath,
                label,
                candidates,
                examples: sortReadingCandidatesForDisplay(candidates).slice(0, 4).map(candidate => candidate.givenName)
            };
        })
        .filter(Boolean)
        .sort(compareReadingSegmentOptionsForDisplay)
        .slice(0, limit);

    const compoundOptions = typeof getCompoundReadingOptions === 'function'
        ? getCompoundReadingOptions(reading, extraOptions.compoundLimit || limit, targetGender)
        : [];

    let merged = [...normalOptions, ...compoundOptions].sort(compareReadingSegmentOptionsForDisplay);
    if (extraOptions && extraOptions.preferredLabel) {
        merged = merged.filter(option => option.label === extraOptions.preferredLabel);
    }

    return merged;
}

function getPreferredReadingSegments(reading) {
    const options = getReadingSegmentOptions(reading, 4);
    if (options.length === 0) return [];

    const bestOption = [...options].sort(compareReadingSegmentOptionsForDisplay)[0];

    return bestOption ? bestOption.path : [];
}

function findKanjiCandidatesForSegment(segment, limit = 3) {
    const target = toHira(segment || '');
    if (!target || !master || master.length === 0) return [];

    if (readingKanjiCache.has(target)) {
        return readingKanjiCache.get(target).slice(0, limit);
    }

    const targetSeion = typeof toSeion === 'function' ? toSeion(target) : target;
    const targetSokuon = target.replace(/っ$/, 'つ');

    const candidates = master.filter(item => {
        const readings = getReadingBucketsForKanji(item).allReadings;
        return readings.includes(target) || readings.includes(targetSeion) || readings.includes(targetSokuon);
    });

    const unique = [];
    const seen = new Set();
    candidates.forEach(item => {
        const kanji = (item['漢字'] || '').trim();
        if (!kanji || seen.has(kanji)) return;
        seen.add(kanji);
        unique.push(kanji);
    });

    const cached = unique.length > 0 ? unique.slice(0, 8) : [segment];
    readingKanjiCache.set(target, cached);
    return cached.slice(0, limit);
}

function getReadingCombinationExamples(path, limit = 4) {
    return buildReadingCombinationCandidates(path, limit).map(candidate => candidate.givenName);
}

function getReadingBucketsForKanji(item) {
    if (typeof getKanjiReadingBuckets === 'function') {
        return getKanjiReadingBuckets(item);
    }

    const majorReadings = ((item?.['音'] || '') + ',' + (item?.['訓'] || ''))
        .split(/[、,，\s/]+/)
        .map(value => toHira((value || '').trim()).replace(/[^\u3041-\u3093\u30FC]/g, ''))
        .filter(Boolean);
    const minorReadings = (item?.['伝統名のり'] || '')
        .split(/[、,，\s/]+/)
        .map(value => toHira((value || '').trim()).replace(/[^\u3041-\u3093\u30FC]/g, ''))
        .filter(Boolean);

    return {
        majorReadings,
        minorReadings,
        allReadings: [...majorReadings, ...minorReadings]
    };
}

function getStrictReadingMatch(item, segment) {
    const target = toHira(segment || '');
    if (!target || !item) return null;

    const targetSeion = typeof toSeion === 'function' ? toSeion(target) : target;
    const targetSokuon = target.replace(/\u3063$/, '\u3064');
    const { majorReadings, minorReadings } = getReadingBucketsForKanji(item);

    if (majorReadings.includes(target) || (targetSokuon !== target && majorReadings.includes(targetSokuon))) {
        return { tier: 1 };
    }

    if (minorReadings.includes(target) || (targetSokuon !== target && minorReadings.includes(targetSokuon))) {
        return { tier: 2 };
    }

    if (target !== targetSeion && majorReadings.includes(targetSeion)) {
        return { tier: 3 };
    }

    return null;
}

function findStrictKanjiCandidatesForSegment(segment, limit = 4, targetGender = gender || 'neutral') {
    const target = toHira(segment || '');
    if (!target || !master || master.length === 0) return [];

    const cacheKey = `strict::${target}::${targetGender}`;
    if (readingKanjiCache.has(cacheKey)) {
        return readingKanjiCache.get(cacheKey).slice(0, limit);
    }

    const unique = [];
    const seen = new Set();

    master
        .filter(item => {
            const flag = item['\u4E0D\u9069\u5207\u30D5\u30E9\u30B0'];
            if (flag && flag !== '0' && flag !== 'false' && flag !== 'FALSE') return false;
            if (typeof isKanjiGenderMismatch === 'function' && isKanjiGenderMismatch(item, targetGender)) return false;
            return !!getStrictReadingMatch(item, target);
        })
        .map(item => {
            const match = getStrictReadingMatch(item, target);
            return {
                ...item,
                _readingMatchTier: match ? match.tier : 99,
                _recommendationScore: typeof getKanjiRecommendationScore === 'function'
                    ? getKanjiRecommendationScore(item, targetGender)
                    : ((parseInt(item['\u304A\u3059\u3059\u3081\u5EA6']) || 0) * 100),
                _genderPriority: typeof getKanjiGenderPriority === 'function'
                    ? getKanjiGenderPriority(item, targetGender)
                    : 1
            };
        })
        .sort((a, b) => {
            if (a._readingMatchTier !== b._readingMatchTier) return a._readingMatchTier - b._readingMatchTier;
            if (a._genderPriority !== b._genderPriority) return a._genderPriority - b._genderPriority;
            if (a._recommendationScore !== b._recommendationScore) return b._recommendationScore - a._recommendationScore;
            if (typeof calculateKanjiScore === 'function') return calculateKanjiScore(b) - calculateKanjiScore(a);
            return 0;
        })
        .forEach(item => {
            const kanji = (item['\u6F22\u5B57'] || '').trim();
            if (!kanji || seen.has(kanji)) return;
            seen.add(kanji);
            unique.push(item);
        });

    readingKanjiCache.set(cacheKey, unique.slice(0, 10));
    return unique.slice(0, limit);
}

function buildReadingCombinationCandidates(path, limit = 4, targetGender = gender || 'neutral') {
    if (!Array.isArray(path) || path.length === 0) return [];

    const groups = path.map(segment => findStrictKanjiCandidatesForSegment(segment, 4, targetGender));
    if (groups.some(group => !group || group.length === 0)) return [];

    const results = [];
    const seenNames = new Set();

    function build(index, pieces, score, usedKanji) {
        if (results.length >= limit * 4) return;
        if (index >= groups.length) {
            const givenName = pieces.map(piece => piece['\u6F22\u5B57']).join('');
            if (!givenName || seenNames.has(givenName)) return;
            seenNames.add(givenName);
            results.push({
                givenName,
                score,
                combination: pieces.map(piece => ({ ...piece }))
            });
            return;
        }

        groups[index].forEach(piece => {
            const kanji = piece['\u6F22\u5B57'];
            if (!kanji || usedKanji.has(kanji) || results.length >= limit * 4) return;
            const nextUsed = new Set(usedKanji);
            nextUsed.add(kanji);
            build(
                index + 1,
                [...pieces, piece],
                score + (piece._recommendationScore || 0) - ((piece._readingMatchTier || 1) - 1) * 40,
                nextUsed
            );
        });
    }

    build(0, [], 0, new Set());

    return results
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map(result => ({
            ...result,
            fullName: surnameStr ? `${surnameStr} ${result.givenName}` : result.givenName
        }));
}

function persistGeneratedSavedName(saveData) {
    const enrichedSaveData = { ...saveData };
    if (!enrichedSaveData.fortune && typeof FortuneLogic !== 'undefined' && FortuneLogic.calculate) {
        const combination = Array.isArray(enrichedSaveData.combination) ? enrichedSaveData.combination : [];
        const givArr = combination
            .map(part => ({
                kanji: part?.['漢字'] || part?.kanji || '',
                strokes: parseInt(part?.['画数'] ?? part?.strokes, 10) || 0
            }))
            .filter(part => part.kanji);
        const surArr = Array.isArray(surnameData) && surnameData.length > 0
            ? surnameData
            : [{ kanji: typeof surnameStr !== 'undefined' ? surnameStr : '', strokes: 1 }];
        if (givArr.length > 0) {
            enrichedSaveData.fortune = FortuneLogic.calculate(surArr, givArr);
        }
    }
    const existing = typeof getSavedNames === 'function' ? getSavedNames() : (savedNames || []);
    const updated = [
        enrichedSaveData,
        ...existing.filter(item => !(item.fullName === enrichedSaveData.fullName &&
            JSON.stringify((item.combination || []).map(part => part['\u6F22\u5B57'] || part.kanji || '')) ===
            JSON.stringify((enrichedSaveData.combination || []).map(part => part['\u6F22\u5B57'] || part.kanji || ''))))
    ].slice(0, 50);

    if (typeof savedNames !== 'undefined') savedNames = updated;
    localStorage.setItem('meimay_saved', JSON.stringify(updated));
    if (typeof StorageBox !== 'undefined' && StorageBox.saveSavedNames) {
        StorageBox.saveSavedNames();
    }
}

function saveReadingCandidateToStock(option, candidate, asSuper) {
    const sessionReading = readingCombinationModalState.item.reading;
    const sessionSegments = Array.isArray(option.path) ? [...option.path] : [];

    addReadingToStock(
        sessionReading,
        readingCombinationModalState.item.baseNickname || '',
        readingCombinationModalState.item.tags || [],
        {
            segments: sessionSegments,
            isSuper: !!asSuper,
            gender: readingCombinationModalState.item.gender || gender || 'neutral',
            clearHidden: true
        }
    );

    candidate.combination.forEach((piece, slotIndex) => {
        const existing = liked.find(item =>
            item['\u6F22\u5B57'] === piece['\u6F22\u5B57'] &&
            item.slot === slotIndex &&
            item.sessionReading === sessionReading
        );

        if (existing) {
            existing.isSuper = existing.isSuper || !!asSuper;
            return;
        }

        liked.push({
            ...piece,
            slot: slotIndex,
            sessionReading,
            sessionSegments,
            isSuper: !!asSuper
        });
    });

    if (typeof StorageBox !== 'undefined' && StorageBox.saveLiked) {
        StorageBox.saveLiked();
    }
}

function saveReadingCandidateFromModal(optionIndex, candidateIndex, asSuper) {
    if (!readingCombinationModalState) return;
    const option = readingCombinationModalState.options[optionIndex];
    const candidate = option && option.candidates ? option.candidates[candidateIndex] : null;
    if (!option || !candidate) return;

    saveReadingCandidateToStock(option, candidate, asSuper);

    const reading = readingCombinationModalState.item.reading;
    const surnameRuby = typeof surnameReading !== 'undefined' ? surnameReading : '';
    const combination = candidate.combination.map((piece, slotIndex) => ({
        ...piece,
        slot: slotIndex,
        sessionReading: reading,
        sessionSegments: [...option.path],
        isSuper: !!asSuper
    }));

    persistGeneratedSavedName({
        fullName: surnameStr ? `${surnameStr} ${candidate.givenName}` : candidate.givenName,
        reading: surnameRuby ? `${surnameRuby} ${reading}` : reading,
        givenName: candidate.givenName,
        combination,
        fortune: null,
        source: 'reading-combination',
        splitLabel: option.label,
        tags: readingCombinationModalState.item.tags || [],
        savedAt: new Date().toISOString(),
        timestamp: new Date().toISOString()
    });

    closeReadingCombinationModal();

    if (returnTarget && typeof openBuildFromReading === 'function') {
        appMode = 'nickname';
        window._addMoreFromBuild = false;
        segments = Array.isArray(option.path) ? [...option.path] : [];
        if (typeof closeModal === 'function') closeModal('modal-reading-detail');
        openBuildFromReading(reading);
        return;
    }

    if (typeof renderReadingStockSection === 'function') {
        renderReadingStockSection();
    }
    if (typeof refreshPartnerAwareUI === 'function') {
        refreshPartnerAwareUI();
    }

    if (typeof showToast === 'function') {
        showToast(`${candidate.givenName}\u3092${asSuper ? '本命として' : '候補として'}\u4FDD\u5B58\u3057\u307E\u3057\u305F`, asSuper ? '⭐' : '💾');
    }

    if (typeof openSavedNames === 'function') {
        openSavedNames();
    }

    if (typeof renderReadingStockSection === 'function') {
        renderReadingStockSection();
    }
    if (typeof refreshPartnerAwareUI === 'function') {
        refreshPartnerAwareUI();
    }
}

function renderReadingTagBadges(tags) {
    if (!tags || tags.length === 0) return '';

    return `<div class="flex flex-wrap justify-center gap-1.5 mb-2 px-2">${tags.map(tag =>
        `<span class="inline-block px-2.5 py-1 text-[11px] font-bold rounded-full border shadow-sm text-[#4f4639]" style="background-color:rgba(255,255,255,0.34);border-color:rgba(255,255,255,0.58);backdrop-filter:blur(6px);">${tag}</span>`
    ).join('')}</div>`;
}

function renderReadingSwipeCard(item) {
    const preview = getReadingFullNamePreview(item.reading);
    const surnameLine = surnameStr
        ? `<div class="text-[11px] font-bold text-[#8b7e66] mb-3 tracking-wide">\u82D7\u5B57\u306B\u5408\u308F\u305B\u308B\u3068 ${preview.visual}</div>`
        : `<div class="text-[11px] font-bold text-[#a6967a] mb-3 tracking-wide">\u30BF\u30C3\u30D7\u3067\u5206\u3051\u65B9\u3054\u3068\u306E\u6F22\u5B57\u5019\u88DC\u3092\u898B\u308B</div>`;

    return `
        ${renderReadingTagBadges(item.tags)}
        <div class="text-[52px] font-black text-[#5d5444] mb-2 tracking-wider leading-tight" style="word-break:keep-all;overflow-wrap:break-word;">${item.reading}</div>
        ${surnameLine}
        <div class="w-full px-4 mt-2">
            <div class="bg-white/70 rounded-2xl p-3 border border-white max-w-[220px] mx-auto shadow-sm">
                <p class="text-[10px] text-[#a6967a] text-center mb-2 font-bold">\u4E0A\u4F4D\u306E\u6F22\u5B57\u5019\u88DC</p>
                <div class="flex justify-center flex-wrap gap-1.5 text-[#5d5444] font-bold text-base">
                    ${getSampleKanjiHtml(item)}
                </div>
            </div>
        </div>
        <div class="mt-3 text-[10px] text-[#a6967a] font-bold tracking-wide">\u30BF\u30C3\u30D7\u3067\u6F22\u5B57\u5019\u88DC\u3092\u898B\u308B</div>
    `;
}

function closeReadingCombinationModal() {
    document.getElementById('reading-combination-modal')?.remove();
    readingCombinationModalState = null;
    readingCombinationModalOpenedAt = 0;
}

function returnToReadingStockFromCombinationModal() {
    const target = readingCombinationModalState?.returnTarget || null;
    closeReadingCombinationModal();
    if (target && typeof openReadingStockModal === 'function') {
        openReadingStockModal(target);
    }
}

function openReadingCombinationModal(item, baseNickname = '', preferredLabel = '') {
    closeReadingCombinationModal();

    const options = getReadingSegmentOptions(
        item.reading,
        4,
        preferredLabel ? { preferredLabel, compoundLimit: 6 } : { compoundLimit: 6 }
    );
    const preview = getReadingFullNamePreview(item.reading);
    readingCombinationModalState = {
        item: { ...item, baseNickname },
        options
    };

    const modal = document.createElement('div');
    modal.id = 'reading-combination-modal';
    modal.className = 'overlay active modal-overlay-dark';
    modal.onclick = (event) => {
        if (event.target === modal) closeReadingCombinationModal();
    };

    modal.innerHTML = `
        <div class="detail-sheet max-w-[440px]" onclick="event.stopPropagation()">
            <button class="modal-close-x" onclick="closeReadingCombinationModal()">✕</button>
            ${returnTarget ? `
            <div class="mb-4">
                <button onclick="event.stopPropagation(); returnToReadingStockFromCombinationModal()" class="inline-flex items-center rounded-full border border-[#eadfce] bg-white px-3 py-1.5 text-[11px] font-bold text-[#8b7e66] active:scale-95">
                    戻る
                </button>
            </div>
            ` : ''}
            <div class="text-center mb-5">
                <div class="text-[10px] font-black text-[#bca37f] tracking-[0.25em] uppercase mb-2">KANJI CANDIDATES</div>
                <h3 class="text-3xl font-black text-[#5d5444] mb-2">${displayReading}</h3>
                <p class="text-xs text-[#8b7e66] leading-relaxed">${surnameStr ? `\u82D7\u5B57\u306B\u5408\u308F\u305B\u308B\u3068 ${preview.visual}\u3002\u5206\u3051\u65B9\u3054\u3068\u306B\u3001\u53B3\u683C\u30E2\u30FC\u30C9\u3067\u4F7F\u3048\u308B\u5019\u88DC\u3060\u3051\u3092\u51FA\u3057\u307E\u3059\u3002` : '\u5206\u3051\u65B9\u3054\u3068\u306B\u3001\u53B3\u683C\u30E2\u30FC\u30C9\u3067\u4F7F\u3048\u308B\u5019\u88DC\u3060\u3051\u3092\u51FA\u3057\u307E\u3059\u3002'}</p>
            </div>
            ${renderReadingTagBadges(item.tags || [])}
            <div class="mb-4 flex justify-end">
                <button onclick="event.stopPropagation(); removeCompletedReadingFromStock(${JSON.stringify(String(item.reading || ''))})" class="inline-flex items-center rounded-full border border-[#eadfce] bg-white px-3 py-1.5 text-[11px] font-bold text-[#8b7e66] active:scale-95">
                    この読みをストックから外す
                </button>
            </div>
            <div class="space-y-3 max-h-[52vh] overflow-y-auto pr-1">
                ${options.length === 0 ? `
                    <div class="rounded-[28px] border border-[#ede5d8] bg-white p-5 text-center text-sm text-[#8b7e66]">
                        \u3053\u306E\u8AAD\u307F\u3067\u306F\u3001\u53B3\u683C\u30E2\u30FC\u30C9\u3067\u51FA\u305B\u308B\u5019\u88DC\u304C\u307E\u3060\u898B\u3064\u304B\u308A\u307E\u305B\u3093\u3067\u3057\u305F\u3002
                    </div>
                ` : options.map((option, index) => {
                    const candidateHtml = option.candidates.length > 0
                        ? option.candidates.map((candidate, candidateIndex) => `
                            <div class="rounded-2xl border border-[#eee5d8] bg-[#fdfaf5] p-3">
                                <div class="flex items-start justify-between gap-3 mb-3">
                                    <div class="min-w-0">
                                        <div class="text-lg font-black text-[#5d5444]">${candidate.givenName}</div>
                                        <div class="text-[11px] text-[#a6967a] mt-1">${surnameStr ? `${candidate.fullName}` : '\u4FDD\u5B58\u3059\u308B\u3068\u6F22\u5B57\u30B9\u30C8\u30C3\u30AF\u306B\u3082\u5165\u308A\u307E\u3059'}</div>
                                    </div>
                                    <span class="px-2.5 py-1 rounded-full bg-white text-[#b9965b] text-[10px] font-black border border-[#e7dac7]">\u5019\u88DC</span>
                                </div>
                                <div class="flex gap-2">
                                    <button onclick="saveReadingCandidateFromModal(${index}, ${candidateIndex}, false)" class="flex-1 py-2.5 rounded-2xl border-2 border-[#d9c7ab] text-[#8b7e66] font-black text-sm active:scale-95 transition-all">候補</button>
                                    <button onclick="saveReadingCandidateFromModal(${index}, ${candidateIndex}, true)" class="flex-1 py-2.5 rounded-2xl bg-[#b9965b] text-white font-black text-sm shadow-sm active:scale-95 transition-all">本命</button>
                                </div>
                            </div>
                        `).join('')
                        : '<div class="px-3 py-2 rounded-2xl bg-[#fdfaf5] border border-[#eee5d8] text-xs text-[#a6967a] text-center">\u5019\u88DC\u304C\u307E\u3060\u3042\u308A\u307E\u305B\u3093</div>';
                    return `
                        <div class="rounded-[28px] border border-[#ede5d8] bg-white p-4 shadow-sm">
                            <div class="flex items-center justify-between gap-3 mb-3">
                                <div>
                                    <div class="text-xl font-black text-[#5d5444]">${option.label}</div>
                                    <div class="text-[11px] text-[#a6967a] mt-1">${surnameStr ? `${surnameStr} ${item.reading}` : '\u3053\u306E\u5206\u3051\u65B9\u304B\u3089\u51FA\u305B\u308B\u5019\u88DC'}</div>
                                </div>
                                <span class="px-3 py-1 rounded-full bg-[#f7f1e7] text-[#b9965b] text-[10px] font-black">${option.path.length}\u5206\u5272</span>
                            </div>
                            <div class="grid grid-cols-1 gap-2">${candidateHtml}</div>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;

    document.body.appendChild(modal);
}

function saveReadingCombinationFromModal(index, asSuper) {
    if (!readingCombinationModalState) return;
    const option = readingCombinationModalState.options[index];
    if (!option || !option.candidates || option.candidates.length === 0) return;
    saveReadingCandidateFromModal(index, 0, asSuper);
}

/**
 * あだな（ニックネーム）モード
 * ニックネームの響きから好きなものをスワイプで選ぶ
 */
function initAdanaMode() {
    console.log("UI_FLOW: initAdanaMode");

    const adanaNames = generateAdanaNames(gender);

    if (adanaNames.length === 0) {
        alert('あだなデータが準備できていません。\nしばらく待ってから再度お試しください。');
        return;
    }

    startUniversalSwipe('adana', adanaNames, {
        title: 'あだなで選ぶ',
        subtitle: '呼ばれたい「あだな」をスワイプ',
        onLike: (item) => {
            // 選んだあだなの最初の読みをin-nicknameに入れて次へ進む処理へ
            // ここでは一旦ストックせずに、直接1つのあだなを選んで進む形にするか、
            // likesに溜めて最後に選ばせる形にする。
            // 既存の動きに合わせるなら "複数選んで最後に1つ選択" にするため、標準の動きに任せる。
        },
        onNext: (selectedItems) => {
            // リスト画面で「完了」または1つ選択した後に呼ばれる
            if (selectedItems && selectedItems.length > 0) {
                // 最初の1つをin-nicknameに入れてprocessNickname相当の処理を呼ぶ
                const chosen = selectedItems[0];
                const inputEl = document.getElementById('in-nickname');
                if (inputEl) inputEl.value = chosen.reading;

                // 接頭辞（〇〇から始まる）固定で次へ進める
                nicknamePosition = 'prefix';
                nicknameBaseReading = toHira(chosen.reading);

                // generateNameCandidatesを呼ぶ代わりに既存のフロー(processNicknameの後半)を実行
                const candidates = generateNameCandidates(nicknameBaseReading, gender, nicknamePosition);
                if (candidates.length === 0) {
                    alert('候補が見つかりませんでした。');
                    return;
                }

                // 次の画面へ（響きを広げる）
                startUniversalSwipe('nickname', candidates, {
                    title: '響きをひろげる',
                    subtitle: `「${nicknameBaseReading}」をベースにした候補`,
                    onLike: (item) => {
                        if (typeof addReadingToStock === 'function') {
                            addReadingToStock(item.reading, nicknameBaseReading, item.tags || [], {
                                clearHidden: true,
                                statsTracked: true
                            });
                        }
                    },
                    renderCard: (item) => {
                        let tagsHtml = '';
                        if (item.tags && item.tags.length > 0) {
                            tagsHtml = '<div class="flex flex-wrap justify-center gap-1.5 mb-2 px-2">';
                            item.tags.forEach(t => {
                                let style = typeof getTagStyle === 'function' ? getTagStyle(t) : { bgColor: '#F3F4F6', textColor: '#374151', borderColor: '#E5E7EB' };
                                tagsHtml += `<span class="inline-block px-2.5 py-1 text-[11px] font-bold rounded-full border shadow-sm" style="background-color: ${style.bgColor}; color: ${style.textColor}; border-color: ${style.borderColor};">${t}</span>`;
                            });
                            tagsHtml += '</div>';
                        }
                        return `
                            ${tagsHtml}
                            <div class="text-[52px] font-black text-[#5d5444] mb-4 tracking-wider leading-tight">${item.reading}</div>
                            <div class="w-full px-4 mt-2">
                                <div class="bg-white/60 rounded-2xl p-3 border border-white max-w-[200px] mx-auto shadow-sm">
                                    <p class="text-[10px] text-[#a6967a] text-center mb-2 font-bold">漢字の組み合わせ例</p>
                                    <div class="flex justify-center flex-wrap gap-1.5 text-[#5d5444] font-bold text-base">
                                        ${item.examples && item.examples.length > 0 ? item.examples.slice(0, 5).map(e => `<span class="px-1">${e}</span>`).join('') : '?'}
                                    </div>
                                </div>
                            </div>
                        `;
                    }
                });
            }
        },
        renderCard: (item) => {
            let tagsHtml = '';
            if (item.tags && item.tags.length > 0) {
                tagsHtml = '<div class="flex flex-wrap justify-center gap-1.5 mb-2 px-2">';
                item.tags.forEach(t => {
                    let style = typeof getTagStyle === 'function' ? getTagStyle(t) : { bgColor: '#F3F4F6', textColor: '#374151', borderColor: '#E5E7EB' };
                    tagsHtml += `<span class="inline-block px-2.5 py-1 text-[11px] font-bold rounded-full border shadow-sm" style="background-color: ${style.bgColor}; color: ${style.textColor}; border-color: ${style.borderColor};">${t}</span>`;
                });
                tagsHtml += '</div>';
            }

            return `
                ${tagsHtml}
                <div class="text-[52px] font-black text-[#5d5444] mb-4 tracking-wider leading-tight">${item.reading}</div>
                <div class="w-full px-4 mt-2">
                    <div class="bg-white/60 rounded-2xl p-3 border border-white max-w-[200px] mx-auto shadow-sm">
                        <p class="text-[10px] text-[#a6967a] text-center mb-2 font-bold">代表的な名前</p>
                        <div class="flex justify-center flex-wrap gap-1.5 text-[#5d5444] font-bold text-base">
                            ${item.examples.slice(0, 3).map(e => `<span class="px-1">${e}</span>`).join('')}
                        </div>
                    </div>
                </div>
            `;
        }
    });
}

/**
 * あだなリスト生成
 */
function generateAdanaNames(genderMode) {
    if (!readingsData || readingsData.length === 0) return [];

    let adanaMap = new Map();

    readingsData.forEach(item => {
        if (!item.adana) return; // あだなが無いものはスキップ
        if (typeof noped !== 'undefined' && noped.has(item.adana)) return; // NOPEスキップ
        if (genderMode === 'male' && item.gender === 'female') return;
        if (genderMode === 'female' && item.gender === 'male') return;

        let score = 0;
        if (item.tags && item.tags.length > 0) {
            item.tags.forEach(t => {
                if (userTags[t]) score += userTags[t];
            });
        }

        if (!adanaMap.has(item.adana)) {
            adanaMap.set(item.adana, {
                reading: item.adana,
                score: score,
                count: item.count,
                tags: item.tags || [],
                examples: [item.reading], // 実際の名前の読みを例として入れる
            });
        } else {
            let existing = adanaMap.get(item.adana);
            existing.count += item.count;
            existing.score = Math.max(existing.score, score);
            // タグマージ
            if (item.tags) {
                item.tags.forEach(t => {
                    if (!existing.tags.includes(t)) existing.tags.push(t);
                });
            }
            if (existing.examples.length < 5 && !existing.examples.includes(item.reading)) {
                existing.examples.push(item.reading);
            }
        }
    });

    let adanaList = Array.from(adanaMap.values());
    adanaList.sort((a, b) => {
        if (a.score !== b.score) return b.score - a.score;
        return b.count - a.count;
    });

    return adanaList.slice(0, 500);
}

/**
 * 人気名前リスト生成 (タグスコアリングで動的ソート)
 */
function isReadingGenderAllowed(entryGender, targetGender = gender || 'neutral') {
    if (!targetGender || targetGender === 'neutral') return true;
    if (!entryGender || entryGender === 'neutral') return true;
    return entryGender === targetGender;
}

function getReadingGenderBonus(entryGender, targetGender = gender || 'neutral') {
    if (!targetGender || targetGender === 'neutral') return 0;
    if (entryGender === targetGender) return 220;
    if (!entryGender || entryGender === 'neutral') return 80;
    return -9999;
}

function generatePopularNames(gender) {
    if (!readingsData || readingsData.length === 0) {
        console.warn("UI_FLOW: readingsData is empty. Trying fallback to yomiSearchData?");
        // フォールバック
        if (!yomiSearchData || yomiSearchData.length === 0) return [];
        return yomiSearchData
            .filter(item => !(typeof noped !== 'undefined' && noped.has(item.yomi)))
            .slice(0, 500).map(item => ({
                reading: item.yomi,
                charCount: item.yomi.length,
                type: item.popular ? '人気' : '候補',
                examples: item.examples || [],
                desc: `${item.count}人の先輩ママが選びました`,
                rawCount: item.count,
                popular: item.popular,
                tags: []
            }));
    }

    // まずスコアを計算して、Mapで保持させる
    let scoredList = readingsData
        .filter(item => !(typeof noped !== 'undefined' && noped.has(item.reading)))
        .filter(item => isReadingGenderAllowed(item.gender, gender))
        .map(item => {
            let score = getReadingGenderBonus(item.gender, gender);
            if (item.tags && item.tags.length > 0) {
                item.tags.forEach(t => {
                    if (userTags[t]) score += userTags[t];
                });
            }

            let typeText = item.isPopular ? '人気' : (item.count > 10 ? '定番' : '候補');

            // プレーンな例を配列化（"大翔, 悠翔" -> ["大翔", "悠翔"]）
            let exampleArr = [];
            if (item.examples) {
                exampleArr = item.examples.split(/[,、]/).map(x => x.trim()).filter(x => x);
            }

            return {
                reading: item.reading,
                charCount: item.reading.length,
                type: typeText,
                examples: exampleArr,
                desc: `${item.count}人が名付けに選びました`,
                rawCount: item.count,
                popular: item.isPopular,
                tags: item.tags || [],
                gender: item.gender || 'neutral',
                score: score
            };
        });

    // 動的ソート: スコア降順 > 人気フラグ > 件数降順
    scoredList.sort((a, b) => {
        if (a.score !== b.score) return b.score - a.score;
        if (a.popular && !b.popular) return -1;
        if (!a.popular && b.popular) return 1;
        return b.rawCount - a.rawCount;
    });

    // 上位500件を返す
    return scoredList.slice(0, 500);
}

function proceedWithSoundReading(reading) {
    console.log("Sound mode: Proceeding with reading", reading);
    const nameInput = document.getElementById('in-name');
    if (nameInput) nameInput.value = reading;
    calcSegments();
}

/**
 * 戻るボタン処理（性別・苗字画面はスキップ済み）
 */
function goBack() {
    const active = document.querySelector('.screen.active');
    if (!active) return;
    const id = active.id;

    if (id === 'scr-gender') {
        changeScreen('scr-mode');
    } else if (id === 'scr-input-sound-entry') {
        changeScreen('scr-mode');
    } else if (id === 'scr-input-reading' || id === 'scr-input-nickname') {
        if (id === 'scr-input-nickname' && soundModeEntryOrigin) {
            // 響きモードエントリーから来た場合はオーバーレイに戻る
            soundModeEntryOrigin = false;
            changeScreen('scr-mode');
            initSoundModeEntry();
        } else {
            changeScreen('scr-mode');
        }
    } else if (id === 'scr-nickname-swipe') {
        changeScreen('scr-input-nickname');
    } else if (id === 'scr-tomeji-selection') {
        document.getElementById('nickname-liked-list').classList.remove('hidden');
        changeScreen('scr-nickname-swipe');
    } else if (id === 'scr-vibe') {
        if (appMode === 'free') {
            changeScreen('scr-mode');
        } else {
            changeScreen('scr-segment');
        }
    } else if (id === 'scr-free-mode') {
        changeScreen('scr-vibe');
    } else if (id === 'scr-diagnosis-input') {
        changeScreen('scr-mode');
    } else if (id === 'scr-segment') {
        changeScreen('scr-input-reading');
    } else if (id === 'scr-main') {
        if (isFreeSwipeMode) {
            changeScreen('scr-vibe');
        } else if (segments && segments.length > 0) {
            changeScreen('scr-segment');
        } else {
            changeScreen('scr-mode');
        }
    } else if (id === 'scr-saved' || id === 'scr-history') {
        changeScreen('scr-mode');
    } else if (id === 'scr-swipe-universal') {
        // スワイプ画面からの戻り：モードに応じて分岐
        if (soundModeEntryOrigin) {
            soundModeEntryOrigin = false;
            initSoundModeEntry();
            return;
        }
        if (appMode === 'sound') {
            changeScreen('scr-mode');
        } else if (appMode === 'free') {
            changeScreen('scr-vibe');
        } else if (appMode === 'nickname') {
            changeScreen('scr-input-nickname');
        } else {
            changeScreen('scr-mode');
        }
        // AIボタンをクリーンアップ
        const aiBtn = document.getElementById('btn-ai-sound-analyze');
        if (aiBtn) aiBtn.remove();
        const aiFreeBtn = document.getElementById('btn-ai-free-learn');
        if (aiFreeBtn) aiFreeBtn.remove();
    } else if (id === 'scr-kanji-search' || id === 'scr-akinator') {
        changeScreen('scr-mode');
    }
}

/**
 * ニックネーム処理
 */
/**
 * ニックネーム処理 (V4: Universal Controller)
 */

// ==========================================
// UNIVERSAL SWIPE CONTROLLER
// ==========================================

const SwipeState = {
    mode: 'none', // 'nickname', 'base', 'tomeji'
    candidates: [],
    currentIndex: 0,
    liked: [], // Items liked in this session
    selected: [], // Items selected from the list (for multi-select)
    history: [], // For undo
    config: {} // { title, subtitle, renderCard, onNext }
};

// Common Kanji Map
const COMMON_KANJI_MAP = {
    'はる': ['春', '晴', '陽', '遥', '悠', '暖', '大'],
    'まさ': ['雅', '正', '昌', '真', '将', '政'],
    'よし': ['義', '吉', '良', '佳', '芳', '慶'],
    'たか': ['隆', '貴', '孝', '高', '尊', '崇'],
    'ひろ': ['広', '博', '弘', '寛', '大', '洋'],
    'かず': ['和', '一', '知', '数', '員'],
    'ゆ': ['結', '優', '友', '有', '悠', '由'],
    'な': ['菜', '奈', '那', '名', '凪', '南'],
    'み': ['美', '実', '未', '海', '心', '水'],
    'か': ['花', '香', '果', '佳', '華', '夏'],
    'り': ['莉', '里', '理', '梨', '璃', '利'],
    'あ': ['愛', 'あ', '亜', '安', '明'],
    'ま': ['真', '麻', '舞', '万', '茉'],
    'さ': ['咲', '沙', '紗', '彩', '早'],
    'き': ['希', '季', '稀', '紀', '喜'],
    'と': ['斗', '人', '翔', '都', '登']
};

let nicknameBaseReading = ""; // "はる"
let nicknamePosition = "prefix";

function processNickname() {
    const el = document.getElementById('in-nickname');
    let val = el.value.trim();

    if (!val) {
        alert('ニックネームを入力してください');
        return;
    }

    val = val.replace(/(ちゃん|くん|さん|たん|りん)$/g, '');
    val = toHira(val);
    if (!val) {
        alert('読みが正しく判定できませんでした');
        return;
    }

    nicknameBaseReading = val;

    const posRadios = document.getElementsByName('nickname-pos');
    let pos = 'prefix';
    for (let r of posRadios) if (r.checked) pos = r.value;
    nicknamePosition = pos;

    console.log(`FLOW: Nickname ${val}, Pos ${pos}, Gender ${gender}`);

    if (typeof generateNameCandidates !== 'function') {
        alert("Generator module not loaded.");
        return;
    }

    const candidates = generateNameCandidates(val, gender, pos);

    if (candidates.length === 0) {
        alert('候補が見つかりませんでした。別の読みを試してください。');
        return;
    }

    // Step 1: 読み方をスワイプで選ぶ（複数OK）
    startUniversalSwipe('nickname', candidates, {
        title: '響きをひろげる',
        subtitle: `「${nicknameBaseReading}」をベースにした候補`,
        onLike: (item) => {
            if (typeof addReadingToStock === 'function') {
                addReadingToStock(item.reading, nicknameBaseReading, item.tags || [], {
                    clearHidden: true,
                    statsTracked: true
                });
            }
        },
        renderCard: (item) => {
            // タグバッジの生成
            let tagsHtml = '';
            if (item.tags && item.tags.length > 0) {
                tagsHtml = '<div class="flex flex-wrap justify-center gap-1.5 mb-2 px-2">';
                item.tags.forEach(t => {
                    let style = {};
                    if (typeof getTagStyle === 'function') {
                        style = getTagStyle(t);
                    } else {
                        style = { label: t.replace('#', ''), bgColor: '#F3F4F6', textColor: '#374151', borderColor: '#E5E7EB' };
                    }
                    tagsHtml += `<span class="inline-block px-2.5 py-1 text-[11px] font-bold rounded-full border shadow-sm" style="background-color: ${style.bgColor}; color: ${style.textColor}; border-color: ${style.borderColor};">${t}</span>`;
                });
                tagsHtml += '</div>';
            }

            return `
                ${tagsHtml}
                <div class="text-[52px] font-black text-[#5d5444] mb-4 tracking-wider leading-tight">${item.reading}</div>
                <div class="w-full px-4 mt-2">
                    <div class="bg-white/60 rounded-2xl p-3 border border-white max-w-[200px] mx-auto shadow-sm">
                        <p class="text-[10px] text-[#a6967a] text-center mb-2 font-bold">漢字の組み合わせ例</p>
                        <div class="flex justify-center flex-wrap gap-1.5 text-[#5d5444] font-bold text-base">
                            ${item.examples && item.examples.length > 0 ? item.examples.slice(0, 5).map(e => `<span class="px-1">${e}</span>`).join('') : '?'}
                        </div>
                    </div>
                </div>
            `;
        }
    });
}

/**
 * ニックネーム：複数読みの選択画面（1つ選んで残りはストックへ）
 */
function showNicknameReadingSelectionWithStock(items) {
    const container = document.getElementById('uni-candidates-grid');
    const list = document.getElementById('uni-liked-list');
    if (!container || !list) return;

    container.innerHTML = '';

    const title = document.getElementById('uni-list-title');
    const desc = document.getElementById('uni-list-desc');
    if (title) title.innerText = '1つ選んでください';
    if (desc) desc.innerText = '選んだ読みの漢字を探します。残りは読みストックに保存されます。';

    items.forEach(item => {
        const btn = document.createElement('div');
        btn.className = 'bg-[#fdfaf5] border-2 border-[#bca37f] rounded-xl p-4 text-center cursor-pointer hover:bg-white transition-all active:scale-95';
        btn.innerHTML = `<div class="text-xl font-black text-[#5d5444]">${item.reading}</div>`;
        btn.onclick = () => {
            list.classList.add('hidden');
            // 選ばれなかったものをストックに追加
            const others = items.filter(i => i.reading !== item.reading);
            others.forEach(o => addReadingToStock(o.reading, nicknameBaseReading, o.tags || [], {
                clearHidden: true,
                trackStats: false
            }));
            if (others.length > 0) {
                showToast(`${others.length}件の読みをストックに保存しました`);
            }
            // 選んだ1つで漢字探しへ
            proceedWithNicknameReading(item.reading);
        };
        container.appendChild(btn);
    });

    list.classList.remove('hidden');
}

/**
 * showNicknameReadingSelection (互換性維持)
 */
function showNicknameReadingSelection(items) {
    showNicknameReadingSelectionWithStock(items);
}

/**
 * ニックネーム：選んだ読みで通常スワイプフローに合流
 */
function proceedWithNicknameReading(reading) {
    console.log("Nickname: Proceeding with reading", reading);
    window._addMoreFromBuild = false;

    // 読みをin-nameに設定
    const nameInput = document.getElementById('in-name');
    if (nameInput) nameInput.value = reading;

    // 分割計算
    calcSegments();

    // イメージ選択に遷移（calcSegmentsがscr-segmentに遷移する）
    // その後のフローは通常のreading modeと同じ
}


/**
 * START SWIPE
 */
function startUniversalSwipe(mode, candidates, configOverride = {}) {
    console.log(`SWIPE: Starting mode ${mode} with ${candidates.length} items`);

    // AIボタンのクリーンアップ（前のモードから残っている場合）
    const aiSoundBtn = document.getElementById('btn-ai-sound-analyze');
    if (aiSoundBtn) aiSoundBtn.remove();
    const aiFreeBtn = document.getElementById('btn-ai-free-learn');
    if (aiFreeBtn) aiFreeBtn.remove();

    // Reset State
    SwipeState.mode = mode;
    SwipeState.candidates = candidates;
    SwipeState.currentIndex = 0;
    SwipeState.liked = [];
    SwipeState.selected = [];
    SwipeState.history = [];
    SwipeState.config = configOverride;

    // UI Setup
    const elTitle = document.getElementById('uni-swipe-title');
    if (elTitle) elTitle.innerText = configOverride.title || 'スワイプ';

    const elSubtitle = document.getElementById('uni-swipe-subtitle');
    if (elSubtitle) elSubtitle.innerText = configOverride.subtitle || '';

    changeScreen('scr-swipe-universal');

    // スーパーライクボタンの表示/非表示
    const superBtn = document.querySelector('#scr-swipe-universal button[onclick="universalSwipeAction(\'super\')"]');
    if (superBtn) {
        superBtn.style.display = configOverride.disableSuper ? 'none' : '';
    }

    renderUniversalCard();
}

let selectedNicknames = [];
let selectedBaseKanjis = [];

/**
 * BASE KANJI SWIPE (Step 2)
 */
// REMOVED startBaseKanjiSwipe
// REMOVED startTomejiSwipe


// REMOVED buildAndShowResults

// UI ACTIONS

function renderUniversalCard() {
    const container = document.getElementById('uni-stack');

    // Counter
    const elCounter = document.getElementById('uni-swipe-counter');
    if (elCounter) {
        elCounter.innerText = `選:${SwipeState.history.filter(h => h.action === 'like' || h.action === 'super').length}`;
    }

    if (SwipeState.currentIndex >= SwipeState.candidates.length) {
        const completionLabel = SwipeState.mode === 'sound' ? '読みストックへ →' : '終了する →';
        container.innerHTML = `
            <div class="flex flex-col items-center justify-center h-full text-center px-6">
                <div class="text-[60px] mb-4">✨</div>
                <p class="text-[#bca37f] font-bold text-lg mb-4">チェック完了！</p>
                <p class="text-sm text-[#a6967a] mb-6">いいねした読みはストックに保存されました</p>
                <button onclick="showUniversalList()" class="btn-gold w-full py-4 shadow-md mb-4">${completionLabel}</button>
            </div>
        `;
        const actionBtns = document.getElementById('uni-swipe-action-btns');
        if (actionBtns) actionBtns.classList.add('hidden');
        return;
    }

    const actionBtns = document.getElementById('uni-swipe-action-btns');
    if (actionBtns) actionBtns.classList.remove('hidden');

    const item = SwipeState.candidates[SwipeState.currentIndex];

    // the card element
    container.innerHTML = '';
    const card = document.createElement('div');

    let bgStyle = '#fdfaf5';
    let borderColor = '#ede5d8';

    if (SwipeState.mode === 'sound' && typeof getReadingCardTone === 'function') {
        const tone = getReadingCardTone(item);
        bgStyle = tone.bgColor;
        borderColor = tone.borderColor;
    } else if (item.tags && item.tags.length > 0 && typeof getTagStyle === 'function') {
        const tagInfo = getTagStyle(item.tags[0]);
        if (tagInfo && tagInfo.bgColor) {
            bgStyle = tagInfo.bgColor;
        }
    }

    card.className = 'card shadow-xl rounded-3xl flex flex-col justify-center items-center px-4';
    card.style.background = bgStyle;
    card.style.border = `3px solid ${borderColor}`;
    card.style.touchAction = 'none';
    card.style.willChange = 'transform';
    card.innerHTML = SwipeState.config.renderCard(item);

    container.appendChild(card);

    // Physics
    initUniversalSwipePhysics(card);
}

function initUniversalSwipePhysics(card) {
    let sx, sy, dx = 0, dy = 0, active = false;

    const bL = document.getElementById('badge-like-uni');
    const bN = document.getElementById('badge-nope-uni');
    const bS = document.getElementById('badge-super-uni');

    card.onpointerdown = e => {
        if (e.target.closest('button') || e.target.closest('#uni-swipe-action-btns')) return;
        sx = e.clientX;
        sy = e.clientY;
        dx = dy = 0;
        active = true;
        card.style.willChange = 'transform, opacity';
        card.style.transition = 'none';
        card.style.zIndex = '1000';
    };

    card.onpointermove = e => {
        if (!active) return;
        dx = e.clientX - sx;
        dy = e.clientY - sy;

        requestAnimationFrame(() => {
            if (!active) return;
            const rotate = dx / 15;
            card.style.transform = `translate3d(${dx}px, ${dy}px, 0) rotate(${rotate}deg) scale(1.03)`;

            if (bS) bS.style.opacity = dy < -40 ? Math.min(0.9, (Math.abs(dy) - 40) / 80) : 0;
            if (bL) bL.style.opacity = dx > 30 ? Math.min(0.9, (dx - 30) / 80) : 0;
            if (bN) bN.style.opacity = dx < -30 ? Math.min(0.9, (Math.abs(dx) - 30) / 80) : 0;
        });
    };

    card.onpointerup = e => {
        if (!active) return;
        active = false;
        try { card.releasePointerCapture(e.pointerId); } catch (err) { }
        card.style.willChange = 'auto';

        [bL, bN, bS].forEach(b => { if (b) b.style.opacity = 0; });

        const threshold = 100;

        if (Math.abs(dx) < 10 && Math.abs(dy) < 10) {
            resetCard();
            if (SwipeState.config.onTap) {
                SwipeState.config.onTap(SwipeState.candidates[SwipeState.currentIndex]);
            }
        } else if (dy < -threshold && !SwipeState.config.disableSuper) {
            universalSwipeAction('super');
        } else if (dx > threshold) {
            universalSwipeAction('like');
        } else if (dx < -threshold) {
            universalSwipeAction('nope');
        } else {
            resetCard();
        }
    };

    card.onpointercancel = () => { active = false; };

    function resetCard() {
        card.style.transition = 'transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
        card.style.transform = 'translate3d(0,0,0) rotate(0) scale(1)';
    }
}

function universalSwipeAction(action) {
    if (SwipeState.currentIndex >= SwipeState.candidates.length) return;

    // disableSuper対応
    if (action === 'super' && SwipeState.config.disableSuper) {
        action = 'like';
    }

    // Update data
    const item = SwipeState.candidates[SwipeState.currentIndex];

    if (action === 'like' || action === 'super') {
        if (action === 'super') item.isSuper = true;
        SwipeState.liked.push(item);
        // onLikeコールバック（自由モード等で即座にストックに追加）
        if (SwipeState.config.onLike) {
            SwipeState.config.onLike(item, action);
        }
    }

    // AI: 好みの音パターン学習（nickname / sound モード共通）
    if (SwipeState.mode === 'nickname' || SwipeState.mode === 'sound') {
        learnSoundPreference(item, action);
    }

    if (action === 'nope') {
        if (item['漢字']) {
            noped.add(item['漢字']);
        } else if (item.reading) {
            noped.add(item.reading);
        }
        if (typeof StorageBox !== 'undefined') StorageBox.saveNoped();
    }

    // タグスコア更新（soundモード等、タグを持っている候補の場合）
    if (item.tags && item.tags.length > 0 && typeof updateTagScore === 'function') {
        const delta = (action === 'like' || action === 'super') ? 1 : -1;
        updateTagScore(item.tags, delta);
    }

    recordEncounteredSwipeItem(item, action);

    SwipeState.history.push({ action: action, item: item });

    // onSwipeコールバック（直感スワイプ等で毎回呼ばれる）
    if (SwipeState.config.onSwipe) {
        SwipeState.config.onSwipe(item, action);
    }

    // 10スワイプごとにチェック
    if (SwipeState.history.length > 0 && SwipeState.history.length % 10 === 0) {
        showUniversalSwipeCheckpoint();
    }

    // Animation
    const container = document.getElementById('uni-stack');
    const card = container.querySelector('.card');
    if (card) {
        let x = (action === 'like' || action === 'super') ? 500 : -500;
        let r = (action === 'like' || action === 'super') ? 20 : -20;
        if (action === 'super') { x = 0; r = 0; }

        card.style.transition = 'transform 0.5s ease-in, opacity 0.4s';
        if (action === 'super') {
            card.style.transform = `translateY(-500px) scale(1.2)`;
            card.style.opacity = '0';
        } else {
            card.style.transform = `translate3d(${x}px, 50px, 0) rotate(${r}deg)`;
            card.style.opacity = '0';
        }

        setTimeout(() => {
            SwipeState.currentIndex++;
            renderUniversalCard();
        }, 300);
    } else {
        SwipeState.currentIndex++;
        renderUniversalCard();
    }
}

function undoUniversalSwipe() {
    if (SwipeState.history.length > 0) {
        const last = SwipeState.history.pop();
        SwipeState.currentIndex--;

        if (last.action === 'like' || last.action === 'super') {
            SwipeState.liked.pop(); // Remove last added
        }
        renderUniversalCard();
    }
}

function showUniversalList() {
    // リスト画面を出さずに直接終了＆ホームへ
    if (SwipeState.liked.length > 0) {
        showToast(`${SwipeState.liked.length}件の読みをストックに保存しました！`);
    } else {
        showToast('スワイプを終了しました');
    }
    document.getElementById('uni-liked-list').classList.add('hidden');
    if (SwipeState.mode === 'sound' || appMode === 'sound') {
        if (typeof changeScreen === 'function') changeScreen('scr-stock');
        if (typeof switchStockTab === 'function') switchStockTab('reading');
        return;
    }
    goBack(); // モードに応じたホームへの遷移を実行
}

function submitUniversalSelection() {
    // 重複排除後のユニークリストからチェック済みのみ取得
    const seenKeys = new Set();
    const unique = [];
    SwipeState.liked.forEach(item => {
        const key = item['漢字'] || item.reading;
        if (!seenKeys.has(key)) {
            seenKeys.add(key);
            unique.push(item);
        }
    });
    const selected = unique.filter(i => i._selected);

    if (selected.length === 0) {
        alert("少なくとも1つ選んでください");
        return;
    }

    // SwipeState.likedも同期（未チェックは除外）
    SwipeState.liked = selected;

    document.getElementById('uni-liked-list').classList.add('hidden');

    if (SwipeState.config.onNext) {
        SwipeState.config.onNext(selected);
    }
}

function continueUniversalSwipe() {
    document.getElementById('uni-swipe-msg').classList.add('hidden');
    alert("これ以上の候補はありません");
}

function resetUniversalSwipe() {
    SwipeState.currentIndex = 0;
    SwipeState.liked = [];
    SwipeState.history = [];
    renderUniversalCard();
    document.getElementById('uni-liked-list').classList.add('hidden');
    document.getElementById('uni-swipe-msg').classList.add('hidden');
}

function closeUniversalList() {
    document.getElementById('uni-liked-list').classList.add('hidden');
}

function showNicknameBatchLimitModal() {
    document.getElementById('nickname-swipe-msg').classList.remove('hidden');
}

function continueNicknameSwipe() {
    document.getElementById('nickname-swipe-msg').classList.add('hidden');
    // Increment index to skip the check?? No, the index is already at 10.
    // We just render next card.
    // Wait, renderNicknameCard checks `currentSwipeIndex % 10 === 0`.
    // We need a flag to bypass this check OR just increment one temporary step?
    // No, that would skip a candidate.

    // Hack: We can just render the card and bypass the check logic by passing a flag?
    // Or cleaner: store a "lastBreakpoint" index.

    // Simple fix: increment currentSwipeIndex ?? NO. The item at index 10 hasn't been shown yet!
    // Actually, `currentSwipeIndex` points to the NEXT item to show.
    // So if index is 10, we are about to show the 11th item (index 10).
    // So we should show the modal BEFORE showing item 10.
    // Correct.

    // To proceed, we need to allow rendering.
    // Let's use a temporary property on the container or a global flag.
    // But easier: `currentSwipeIndex` is strictly used for "next item".
    // 10 items done means we finished indices 0-9. `currentSwipeIndex` is 10.
    // We pause here.

    // To continue, we must NOT show the modal again immediately for 10.
    // Maybe we change the condition to `currentSwipeIndex > 0 && currentSwipeIndex % 10 === 0 && !wasBatchModalShown`.

    // Let's just force render by shifting logic.
    // We will use a separate function to "force render"

    renderNicknameCardForce();
    document.getElementById('nickname-swipe-msg').classList.add('hidden');
}

function renderNicknameCardForce() {
    // Exact copy but skips the modal check
    const container = document.getElementById('nickname-swipe-container');
    const cards = container.querySelectorAll('.nickname-card');
    cards.forEach(c => c.remove());

    if (currentSwipeIndex >= generatedCandidates.length) {
        showNicknameList();
        return;
    }

    const item = generatedCandidates[currentSwipeIndex];
    const card = document.createElement('div');
    card.className = 'nickname-card absolute inset-4 bg-white rounded-3xl shadow-lg border border-[#ede5d8] flex flex-col items-center justify-center transition-transform duration-300 select-none cursor-grab active:cursor-grabbing';
    card.style.zIndex = 10;

    card.innerHTML = `
        <div class="text-xs font-bold text-[#bca37f] mb-6 tracking-widest uppercase opacity-70">
            ${item.type === 'original' ? 'Original' : (item.type === 'prefix' ? 'Suffix Match' : 'Expansion')}
        </div>
        <div class="text-5xl font-black text-[#5d5444] mb-8 tracking-wider">${item.reading}</div>
        <div class="text-xs text-[#a6967a] px-4 text-center leading-relaxed">
            ${item.type === 'original' ? 'そのままの読み' : (item.type === 'prefix' ? '後ろに続く候補' : '読みを広げた候補')}
        </div>
    `;
    container.appendChild(card);
    initNicknameCardEvents(card);
}

// ==========================================
// LEGACY CODE REMOVED (Universal Config Applied)
// ==========================================


/**
 * 漢字サンプルHTML生成
 */
function getSampleKanjiHtml(item) {
    const options = getReadingSegmentOptions(item.reading, 2);
    const examples = [];

    options.forEach(option => {
        option.examples.forEach(example => {
            if (!examples.includes(example)) {
                examples.push(example);
            }
        });
    });

    if (examples.length === 0) {
        return '<span class="text-xs text-[#d4c5af]">漢字例なし</span>';
    }

    return examples.slice(0, 4).map(example =>
        `<span class="text-lg font-bold mx-1">${example}</span>`
    ).join('');
}

/**
 * Helper: toKata
 */
function toKata(str) {
    if (!str) return '';
    return str.replace(/[\u3041-\u3096]/g, function (match) {
        var chr = match.charCodeAt(0) + 0x60;
        return String.fromCharCode(chr);
    });
}

function showNicknameList() {
    const listContainer = document.getElementById('nickname-liked-list');
    const grid = document.getElementById('nickname-candidates-grid');
    grid.innerHTML = '';

    if (likedReadings.length === 0) {
        alert("気に入った読みがありませんでした。もう一度スワイプしますか？");
        startNicknameSwipe();
        return;
    }

    likedReadings.forEach(item => {
        const btn = document.createElement('button');
        let classes = 'p-4 rounded-xl text-lg font-bold transition-all text-center flex flex-col items-center justify-center gap-1 active:scale-95 ';

        if (item.isSuper) {
            classes += 'bg-[#fffbeb] border-2 border-[#fbbc04] text-[#5d5444] shadow-md';
        } else {
            classes += 'bg-[#fdfaf5] border border-[#ede5d8] text-[#5d5444] hover:bg-white hover:border-[#bca37f]';
        }

        btn.className = classes;
        btn.innerHTML = `
            ${item.isSuper ? '<span class="text-[10px] text-[#fbbc04]">★ 本命</span>' : ''}
            <span>${item.reading}</span>
        `;
        btn.onclick = () => confirmReading(item.reading);
        grid.appendChild(btn);
    });

    listContainer.classList.remove('hidden');
}

function decideTomeji(kanjiObj, reading) {
    selectedTomeji = { kanji: kanjiObj['漢字'], reading: reading, obj: kanjiObj };
    console.log("FLOW: Tomeji decided", selectedTomeji);
    finalizeNicknameFlow();
}

function skipTomeji() {
    selectedTomeji = null;
    finalizeNicknameFlow();
}

/**
 * ニックネームフロー完了 -> 通常フローへ合流
 */
function finalizeNicknameFlow() {
    // データセット
    // reading: selectedReadingForTomeji
    const nameInput = document.getElementById('in-name');
    if (nameInput) nameInput.value = selectedReadingForTomeji;

    // 分割計算 (calcSegments) を呼ぶ
    // ただし、最後の文字を固定するための引数を渡す必要がある
    // calcSegmentsを改造するか、あるいは segments を直接いじるか

    // 02-engine.js の calcSegments は引数なしでDOMを読む
    // まず普通に計算させる

    // Note: calcSegments is async-ish in nature? No, sync.
    // しかし segments global 変数を更新する

    calcSegments();

    // もし止め字が決まっていれば、segments の末尾に対応する liked をセットする
    if (selectedTomeji) {
        // segments配列チェック
        // 例：はると -> [は, る, と] or [はる, と]
        // 末尾が一致しているか確認
        const lastSeg = segments[segments.length - 1];
        if (lastSeg === selectedTomeji.reading) {
            // 末尾一致。liked に追加
            // liked は {漢字:..., slot: index} の形
            // slotは 0-index.
            // Swipe画面 (loadStack) は segments[currentPos] を見る。
            // 既に liked に slot corresponding to lastSeg があれば、Swipe画面はどうなる？

            // 簡易実装: likedに突っ込む
            const slotIdx = segments.length - 1;

            // 既存の同slotのものを消す
            const existingIdx = liked.findIndex(l => l.slot === slotIdx);
            if (existingIdx > -1) liked.splice(existingIdx, 1);

            liked.push({
                ...selectedTomeji.obj,
                slot: slotIdx,
                sessionReading: uniqueId() // dummy
            });

            console.log("FLOW: Auto-liked tomeji", liked);
        } else {
            console.warn("FLOW: Segments checking failed for tomeji", lastSeg, selectedTomeji.reading);
            // 分割が合わない場合（稀だが）、無理やりは適用しない
        }
    }

    // 画面は calcSegments 内で 'scr-segment' に変わる
    // しかし、分割が1通りしかなければ自動で次に行くロジックがほしい
    // あるいは、ここで強制的に 'scr-vibe' に飛ばす？

    // ユーザー体験的には「分割確認」→「イメージ」→「スワイプ」でOK
    // ただし、止め字が決まってるなら分割画面でそれをアピールしたい（今後の課題）

    // スワイプ開始時に最後の文字が「決定済み」に見えるようにするのは 05-ui-render.js の仕事
}

// Helper uniqueId
function uniqueId() { return Math.random().toString(36).substr(2, 9); }

/**
 * GoBack Override extension
 */
const originalGoBack = window.goBack;
window.goBack = function () {
    const active = document.querySelector('.screen.active');
    if (active && active.id === 'scr-nickname-swipe') {
        changeScreen('scr-input-nickname');
        return;
    }
    if (active && active.id === 'scr-tomeji-selection') {
        document.getElementById('nickname-liked-list').classList.remove('hidden');
        changeScreen('scr-nickname-swipe');
        return;
    }
    originalGoBack();
};

/**
 * 自由選択モード初期化（メインのスワイプUIを使用）
 */
function startFreeSwiping() {
    isFreeSwipeMode = true;
    currentPos = 0;
    swipes = 0;
    seen.clear();
    if (typeof clearTemporarySwipeRules === 'function') clearTemporarySwipeRules();

    if (!master || master.length === 0) return;

    // フィルタリング
    let list = master.filter(k => {
        const flag = k['不適切フラグ'];
        const shouldHideFlagged = !(typeof showInappropriateKanji !== 'undefined' && showInappropriateKanji);
        if (shouldHideFlagged && flag && flag !== '0' && flag !== 'false' && flag !== 'FALSE') return false;
        return true;
    });

    // イメージタグフィルター
    if (typeof applyImageTagFilter === 'function') {
        list = applyImageTagFilter(list);
    }

    // スコア計算＆ソート（imagePriorityを最優先、次にスコア降順、同スコアはランダム）
    if (typeof calculateKanjiScore === 'function') {
        list.forEach(k => {
            k.score = calculateKanjiScore(k);
            if (k.imagePriority === 1) k.score += 1500; // イメージ一致ボーナス
        });
        list.sort((a, b) => {
            // imagePriority 1(一致) を優先（2=不一致）
            const pa = a.imagePriority || 2;
            const pb = b.imagePriority || 2;
            if (pa !== pb) return pa - pb;
            const scoreDiff = (b.score || 0) - (a.score || 0);
            return scoreDiff === 0 ? Math.random() - 0.5 : scoreDiff;
        });
    }

    // 既にストック済みは除外
    list = list.filter(k => !liked.some(l => l['漢字'] === k['漢字']));

    const premiumActive = typeof PremiumManager !== 'undefined' && PremiumManager.isPremium && PremiumManager.isPremium();
    if (!premiumActive) {
        const dailySeen = getDailySeenKanji();
        if (dailySeen.length > 0) {
            list = list.filter(k => !dailySeen.includes(k['漢字']));
        }

        const remaining = getDailyRemainingCount();
        if (remaining <= 0 || list.length === 0) {
            changeScreen('scr-mode');
            if (typeof renderHomeProfile === 'function') renderHomeProfile();
            if (typeof showToast === 'function') showToast('今日の直感スワイプはおしまいです', '🌙');
            if (remaining <= 0 && typeof showPremiumModal === 'function') setTimeout(() => showPremiumModal(), 250);
            return;
        }

        list = list.slice(0, remaining);
    }

    // メインUIのスタックとしてセット (02-engine.js global)
    stack = list;
    currentIdx = 0;

    changeScreen('scr-main');

    // 表示更新
    if (typeof render === 'function') {
        render();
    }
}



function finishFreeModeToHome() {
    isFreeSwipeMode = false;
    window._addMoreFromBuild = false;
    changeScreen('scr-mode');
}

/**
 * 自由組み立てビルド画面
 */
function renderFreeBuild() {
    const container = document.getElementById('build-selection');
    if (!container) return;

    const freeItems = liked.filter(l => l.sessionReading === 'FREE');

    container.innerHTML = `
        <div class="mb-6">
            <p class="text-sm text-[#7a6f5a] mb-4 text-center">ストックした漢字を自由に組み合わせて名前を作れます。<br>タップして順番に選んでください。</p>
            <div class="flex flex-wrap gap-3 justify-center mb-6" id="free-build-pool">
                ${freeItems.map(item => `
                    <button onclick="toggleFreeBuildPiece('${item['漢字']}')"
                            class="free-build-btn w-16 h-16 bg-white rounded-xl border-2 border-[#eee5d8] flex flex-col items-center justify-center hover:border-[#bca37f] transition-all active:scale-95"
                            data-kanji="${item['漢字']}">
                        <span class="text-2xl font-black text-[#5d5444]">${item['漢字']}</span>
                        <span class="text-[8px] text-[#a6967a]">${item['画数']}画</span>
                    </button>
                `).join('')}
            </div>

            <div class="text-center mb-4">
                <p class="text-xs text-[#a6967a] mb-2">選んだ順：</p>
                <div id="free-build-preview" class="text-4xl font-black text-[#5d5444] min-h-[48px] tracking-wider">
                    ─
                </div>
            </div>

            <div class="flex gap-3 justify-center">
                <button onclick="clearFreeBuild()" class="px-6 py-3 border border-[#d4c5af] rounded-2xl text-sm text-[#a6967a] hover:bg-[#fdfaf5]">クリア</button>
                <button onclick="executeFreeBuild()" class="px-8 py-3 bg-[#bca37f] text-white rounded-2xl font-bold text-sm shadow-md hover:shadow-lg">この名前で決定</button>
            </div>
        </div>
    `;
}

let freeBuildOrder = [];

function toggleFreeBuildPiece(kanji) {
    const idx = freeBuildOrder.indexOf(kanji);
    if (idx > -1) {
        freeBuildOrder.splice(idx, 1);
    } else {
        freeBuildOrder.push(kanji);
    }
    updateFreeBuildPreview();
}

function updateFreeBuildPreview() {
    const preview = document.getElementById('free-build-preview');
    if (preview) {
        preview.innerText = freeBuildOrder.length > 0 ? freeBuildOrder.join('') : '─';
    }

    // ボタンのスタイル更新
    document.querySelectorAll('.free-build-btn').forEach(btn => {
        const k = btn.getAttribute('data-kanji');
        const order = freeBuildOrder.indexOf(k);
        if (order > -1) {
            btn.classList.add('border-[#bca37f]', 'bg-[#fffbeb]');
            btn.classList.remove('border-[#eee5d8]', 'bg-white');
        } else {
            btn.classList.remove('border-[#bca37f]', 'bg-[#fffbeb]');
            btn.classList.add('border-[#eee5d8]', 'bg-white');
        }
    });
}

function clearFreeBuild() {
    freeBuildOrder = [];
    updateFreeBuildPreview();
}

function executeFreeBuild() {
    if (freeBuildOrder.length === 0) {
        alert('漢字を1つ以上選んでください');
        return;
    }

    const givenName = freeBuildOrder.join('');

    // ビルド結果を生成
    const pieces = freeBuildOrder.map(k => {
        const found = master.find(m => m['漢字'] === k);
        return found || { '漢字': k, '画数': 0 };
    });

    const givArr = pieces.map(p => ({
        kanji: p['漢字'],
        strokes: parseInt(p['画数']) || 0
    }));

    let fortune = null;
    if (typeof FortuneLogic !== 'undefined' && FortuneLogic.calculate) {
        const surArr = surnameData && surnameData.length > 0 ? surnameData : [{ kanji: '', strokes: 1 }];
        fortune = FortuneLogic.calculate(surArr, givArr);
    }

    currentBuildResult = {
        fullName: (surnameStr ? surnameStr + ' ' : '') + givenName,
        reading: '', // 自由組み立てでは読みが不定
        fortune: fortune,
        combination: pieces,
        givenName: givenName,
        timestamp: new Date().toISOString()
    };

    // segments は使わないのでダミーを設定
    segments = freeBuildOrder;

    renderBuildResult();
}

function runDiagnosis() {
    const surnameInput = document.getElementById('diag-surname');
    const nameInput = document.getElementById('diag-name');

    const surname = surnameInput ? surnameInput.value.trim() : '';
    const givenName = nameInput ? nameInput.value.trim() : '';

    if (!givenName) {
        alert('名前（漢字）を入力してください');
        return;
    }

    // 名字の画数データを構築
    const surChars = surname.split('');
    const surArr = surChars.map(c => {
        const found = master.find(k => k['漢字'] === c);
        return {
            kanji: c,
            strokes: found ? (parseInt(found['画数']) || 0) : 0
        };
    });

    // 名前の画数データを構築
    const givChars = givenName.split('');
    const givArr = givChars.map(c => {
        const found = master.find(k => k['漢字'] === c);
        return {
            kanji: c,
            strokes: found ? (parseInt(found['画数']) || 0) : 0
        };
    });

    // 画数が取得できないものがあれば警告
    const unknownSur = surArr.filter(s => s.strokes === 0 && s.kanji);
    const unknownGiv = givArr.filter(g => g.strokes === 0);
    if (unknownGiv.length > 0) {
        const unknownChars = [...unknownSur, ...unknownGiv].filter(x => x.strokes === 0).map(x => x.kanji);
        if (unknownChars.length > 0) {
            alert(`以下の文字の画数データが見つかりません：${unknownChars.join('、')}\n正確な診断ができない可能性があります。`);
        }
    }

    if (typeof FortuneLogic === 'undefined' || !FortuneLogic.calculate) {
        alert('姓名判断モジュールが読み込まれていません');
        return;
    }

    // 仮の名字がない場合
    if (surArr.length === 0) {
        surArr.push({ kanji: '', strokes: 0 });
    }

    const fortune = FortuneLogic.calculate(surArr, givArr);
    if (!fortune) {
        alert('診断結果を計算できませんでした');
        return;
    }

    // ビルド結果に格納して表示
    surnameStr = surname;
    surnameData = surArr;
    currentBuildResult = {
        fullName: (surname ? surname + ' ' : '') + givenName,
        reading: '',
        fortune: fortune,
        combination: givArr.map(g => {
            const found = master.find(k => k['漢字'] === g.kanji);
            return found || { '漢字': g.kanji, '画数': g.strokes };
        }),
        givenName: givenName,
        timestamp: new Date().toISOString()
    };

    // 姓名判断詳細モーダルを表示
    if (typeof showFortuneDetail === 'function') {
        showFortuneDetail();
    }
}


/**
 * ルール設定 (Existing)
 */
function setRule(r) {
    console.log(`UI_FLOW: Rule set to ${r}`);
    rule = r;

    const bStrict = document.getElementById('btn-strict');
    const bLax = document.getElementById('btn-lax');
    const strictItem = document.getElementById('rule-strict-item');
    const laxItem = document.getElementById('rule-lax-item');

    if (bStrict) bStrict.classList.toggle('active', r === 'strict');
    if (bLax) bLax.classList.toggle('active', r === 'lax');

    if (strictItem) {
        strictItem.className = `rule-item w-full rounded-2xl border px-4 py-3 shadow-sm transition-all active:scale-[0.99] cursor-pointer ${r === 'strict' ? 'border-[#b9965b] bg-[#fffbef]' : 'border-[#ede5d8] bg-white/70'}`;
    }

    if (laxItem) {
        laxItem.className = `rule-item w-full rounded-2xl border px-4 py-3 shadow-sm transition-all active:scale-[0.99] cursor-pointer ${r === 'lax' ? 'border-[#b9965b] bg-[#fffbef]' : 'border-[#ede5d8] bg-white/70'}`;
    }
}

// ==========================================
// 読み方引き継ぎフロー
// ==========================================

/**
 * 同じ読み方スロットにストック済み漢字がある候補を探す
 */
function findInheritCandidates() {
    if (!segments || segments.length === 0) return [];

    const currentReading = typeof getCurrentSessionReading === 'function' ? getCurrentSessionReading() : segments.join('');
    const history = typeof getReadingHistory === 'function' ? getReadingHistory() : [];
    const readingToSegments = {};
    history.forEach(h => { readingToSegments[h.reading] = h.segments; });

    const candidates = [];

    segments.forEach((seg, slotIdx) => {
        const inheritItems = liked.filter(item => {
            if (!item.sessionReading || item.sessionReading === currentReading) return false;
            if (item.sessionReading === 'FREE' || item.sessionReading === 'SEARCH') return false;
            if (item.slot !== slotIdx) return false;
            const itemSegs = readingToSegments[item.sessionReading];
            if (!itemSegs) return false;
            return itemSegs[slotIdx] === seg;
        });

        // 現セッションにまだない漢字のみ
        const newItems = inheritItems.filter(item =>
            !liked.some(l =>
                l['漢字'] === item['漢字'] &&
                l.slot === slotIdx &&
                l.sessionReading === currentReading
            )
        );

        if (newItems.length > 0) {
            candidates.push({ slot: slotIdx, segReading: seg, items: newItems });
        }
    });

    return candidates;
}

/**
 * 引き継ぎ候補を liked[] に追加
 */
function doInheritKanji(candidates) {
    const currentReading = typeof getCurrentSessionReading === 'function' ? getCurrentSessionReading() : segments.join('');
    candidates.forEach(c => {
        c.items.forEach(item => {
            const exists = liked.some(l =>
                l['漢字'] === item['漢字'] &&
                l.slot === c.slot &&
                l.sessionReading === currentReading
            );
            if (!exists) {
                liked.push({ ...item, slot: c.slot, sessionReading: currentReading });
            }
        });
    });
    if (typeof StorageBox !== 'undefined' && StorageBox.saveLiked) {
        StorageBox.saveLiked();
    }
}

let _inheritCallback = null;

/**
 * 引き継ぎモーダルのボタンアクション（HTML onclick から呼ばれる）
 */
function inheritModalAction(action) {
    const modal = document.getElementById('modal-inherit');
    if (modal) modal.classList.remove('active');
    if (_inheritCallback) {
        const cb = _inheritCallback;
        _inheritCallback = null;
        cb(action);
    }
}

/**
 * 引き継ぎ確認モーダルを表示
 */
function showInheritModal(segReading, kanjiList, callback) {
    const modal = document.getElementById('modal-inherit');
    if (!modal) { callback('skip'); return; }

    const title = document.getElementById('inherit-modal-title');
    const body = document.getElementById('inherit-modal-body');

    if (title) title.textContent = `「${segReading}」の漢字`;
    if (body) body.innerHTML =
        `<span class="font-bold text-[#bca37f] text-lg">${kanjiList}</span><br><br>` +
        `がすでにストックされています。<br>追加で選びますか？`;

    _inheritCallback = callback;
    modal.classList.add('active');
}

/**
 * 引き継ぎ候補をモーダルで順番に確認し、完了後に onDone(startPos) を呼ぶ
 */
function processInheritCandidates(candidates, index, answers, onDone) {
    // 互換性維持のため残すが、現在は使用しない（checkInheritForSlotに移行）
    onDone(0);
}

/**
 * 指定したスロット用の引き継ぎ候補があればモーダルを出す
 */
function checkInheritForSlot(slotIdx, onDone) {
    if (!segments || slotIdx >= segments.length) {
        onDone();
        return;
    }

    const currentReading = typeof getCurrentSessionReading === 'function' ? getCurrentSessionReading() : segments.join('');
    const history = typeof getReadingHistory === 'function' ? getReadingHistory() : [];
    const readingToSegments = {};
    history.forEach(h => { readingToSegments[h.reading] = h.segments; });

    // 指定スロットの引き継ぎアイテムを探す
    const seg = segments[slotIdx];
    const inheritItems = liked.filter(item => {
        if (!item.sessionReading || item.sessionReading === currentReading) return false;
        if (item.sessionReading === 'FREE' || item.sessionReading === 'SEARCH') return false;
        if (item.slot !== slotIdx) return false;
        const itemSegs = readingToSegments[item.sessionReading];
        if (!itemSegs) return false;
        return itemSegs[slotIdx] === seg;
    });

    // 既に現在セッションで選ばれているか除外
    const newItems = inheritItems.filter(item =>
        !liked.some(l =>
            l['漢字'] === item['漢字'] &&
            l.slot === slotIdx &&
            l.sessionReading === currentReading
        )
    );

    if (newItems.length === 0) {
        onDone(); // 候補がなければそのまま次へ
        return;
    }

    // 候補があればモーダル表示
    const kanjiList = [...new Set(newItems.map(i => i['漢字']))].join('・');
    showInheritModal(seg, kanjiList, (action) => {
        if (action === 'skip') {
            // スキップ：そのスロットには何もしない（裏で全自動引き継ぎさせる）
            // 仕様：スキップ＝「もう前の漢字を引き継ぐだけでいいから、この文字のスワイプは飛ばす」
            doInheritKanji([{ slot: slotIdx, segReading: seg, items: newItems }]);

            // 現在のスワイプ位置を次のスロットへ進める
            currentPos = slotIdx + 1;

            // 次のスロットのチェックへ行くが、これが最後のスロットならビルドへ
            if (slotIdx >= segments.length - 1) {
                showToast('全ての漢字を引き継ぎました', '✨');
                if (typeof openBuild === 'function') openBuild();
            } else {
                checkInheritForSlot(slotIdx + 1, onDone);
            }
        } else {
            // 追加で選ぶ：既に選んだ分は保持した上で、このスロットのスワイプデッキに入る
            doInheritKanji([{ slot: slotIdx, segReading: seg, items: newItems }]);
            // 該当スロットのスワイプを開始
            currentPos = slotIdx;
            onDone();
        }
    });
}

// autoInheritSameReadings は processInheritCandidates に統合済み（互換用空定義）
function autoInheritSameReadings() { }

/**
 * スワイプモード開始 (Existing, modified)
 */
function startSwiping() {
    console.log("UI_FLOW: Starting swipe mode");
    isFreeSwipeMode = false;
    window._addMoreFromBuild = false;

    if (typeof updateSurnameData === 'function') {
        updateSurnameData();
    }

    currentPos = 0;
    swipes = 0;
    seen.clear();
    if (typeof clearTemporarySwipeRules === 'function') clearTemporarySwipeRules();

    function beginSwiping() {
        if (typeof loadStack === 'function') loadStack();
        changeScreen('scr-main');
        // 初回チュートリアルは非表示
    }

    // 最初のスロット（slot 0）の引き継ぎチェックから開始
    checkInheritForSlot(0, beginSwiping);
}

/**
 * チュートリアル表示
 */
/**
 * チュートリアル制御
 */
let tutorialInterval;
let tutorialStep = 1; // 1: Swipe, 2: Detail, 3: Build

function showTutorial() {
    localStorage.setItem('meimay_tutorial_shown_v2', 'true');
}

function nextTutorialStep() {
    tutorialStep++;
    if (tutorialStep > 3) {
        closeTutorial();
    } else {
        updateTutorialScene();
    }
}

function updateTutorialScene() {
    const modal = document.getElementById('modal-tutorial');
    if (!modal) return;

    // Dots
    [1, 2, 3].forEach(i => {
        const dot = document.getElementById(`tut-dot-${i}`);
        if (dot) dot.classList.toggle('opacity-100', i === tutorialStep);
        if (dot) dot.classList.toggle('opacity-30', i !== tutorialStep);
    });

    // Scenes
    [1, 2, 3].forEach(i => {
        const scene = document.getElementById(`tut-scene-${i}`);
        if (scene) {
            if (i === tutorialStep) scene.classList.remove('hidden');
            else scene.classList.add('hidden');
        }
    });

    // Reset Animations
    if (tutorialInterval) clearInterval(tutorialInterval);

    // Start Scene Specific Animation
    if (tutorialStep === 1) startScene1Anim();
    else if (tutorialStep === 2) startScene2Anim();
    else if (tutorialStep === 3) startScene3Anim();
}

function startScene1Anim() {
    const scene = document.getElementById('tut-scene-1');
    if (!scene) return;

    let step = 0;
    const update = () => {
        scene.classList.remove('anim-swipe-right', 'anim-swipe-left', 'anim-swipe-up');
        const s = step % 3;
        if (s === 0) scene.classList.add('anim-swipe-right');
        else if (s === 1) scene.classList.add('anim-swipe-left');
        else scene.classList.add('anim-swipe-up');
        step++;
    };
    update();
    tutorialInterval = setInterval(update, 2000);
}

function startScene2Anim() {
    const scene = document.getElementById('tut-scene-2');
    if (!scene) return;
    scene.classList.add('anim-tap');
}

function startScene3Anim() {
    const scene = document.getElementById('tut-scene-3');
    if (!scene) return;
    scene.classList.add('anim-fly');
}

function closeTutorial() {
    const modal = document.getElementById('modal-tutorial');
    if (modal) {
        modal.classList.remove('active');
        if (tutorialInterval) clearInterval(tutorialInterval);
    }
}

// ==========================================
// 読みストック機能（ニックネーム元グルーピング対応）
// ==========================================

const READING_STOCK_KEY = 'meimay_reading_stock';

function getReadingStockKey(reading, segments = []) {
    return `${reading || ''}::${Array.isArray(segments) ? segments.join('/') : ''}`;
}

function normalizeReadingStockItem(item) {
    if (typeof item === 'string') {
        const readingParts = String(item || '').split('::');
        const reading = (readingParts[0] || '').trim();
        const displaySegments = readingParts.length > 1
            ? readingParts.slice(1).join('::').split('/').map(part => part.trim()).filter(Boolean)
            : [];
        const readingPromoted = displaySegments.length > 0;
        return {
            id: getReadingStockKey(reading, readingPromoted ? displaySegments : []),
            reading,
            segments: readingPromoted ? displaySegments : [],
            baseNickname: '',
            tags: [],
            isSuper: false,
            ownSuper: false,
            partnerSuper: false,
            source: '',
            gender: gender || 'neutral',
            addedAt: new Date().toISOString(),
            statsTracked: displaySegments.length > 0,
            readingPromoted
        };
    }

    const readingParts = String(item && item.reading ? item.reading : '').split('::');
    const reading = (readingParts[0] || '').trim();
    const inferredSegments = readingParts.length > 1
        ? readingParts.slice(1).join('::').split('/').map(part => part.trim()).filter(Boolean)
        : [];
    const rawSegments = Array.isArray(item && item.segments) && item.segments.filter(Boolean).length > 0
        ? item.segments.filter(Boolean)
        : inferredSegments;
    const readingPromoted = !!(item && (
        item.readingPromoted ||
        item.promotedReading ||
        item.promoted ||
        item.source === 'reading-combination'
    ));
    const segments = readingPromoted ? rawSegments : [];
    const source = item && item.source ? String(item.source) : '';
    const rawOwnSuper = !!(item && item.ownSuper);
    const partnerSuper = !!(item && (item.partnerSuper || (source === 'partner-reading' && !!item.isSuper && !rawOwnSuper)));
    let isSuper = !!(item && item.isSuper) && (source !== 'partner-reading' || rawOwnSuper);
    if (partnerSuper && !rawOwnSuper) {
        isSuper = false;
    }
    const ownSuper = !!(item && (rawOwnSuper || isSuper));
    const hasReadableSegments = Array.isArray(segments) && segments.length > 0;
    const hasExplicitStatsFlag = item && typeof item.statsTracked === 'boolean';
    const statsTracked = hasExplicitStatsFlag
        ? (item.statsTracked === false ? hasReadableSegments : true)
        : (hasReadableSegments || !String(item && item.baseNickname ? item.baseNickname : '').trim());
    return {
        id: item && item.id ? item.id : getReadingStockKey(reading, segments),
        reading,
        segments,
        baseNickname: item && item.baseNickname ? item.baseNickname : '',
        tags: Array.isArray(item && item.tags) ? [...new Set(item.tags.filter(Boolean))] : [],
        isSuper,
        ownSuper,
        partnerSuper,
        source,
        gender: item && item.gender ? item.gender : (gender || 'neutral'),
        addedAt: item && item.addedAt ? item.addedAt : new Date().toISOString(),
        statsTracked,
        readingPromoted
    };
}

function getReadingDisplayLabel(item, options = {}) {
    const rawReading = String(item?.reading || item?.sessionReading || '').trim();
    const readingParts = rawReading.split('::');
    const reading = (readingParts[0] || '').trim();
    const metaDisplay = readingParts.slice(1).join('::').trim();
    if (options.forceRaw) {
        return metaDisplay || reading || '';
    }

    const segments = Array.isArray(item?.segments)
        ? item.segments
        : (Array.isArray(item?.sessionSegments) ? item.sessionSegments : []);
    const readableSegments = segments.filter(seg =>
        typeof seg === 'string' &&
        seg.trim() &&
        !/^__compound_slot_\d+__$/.test(seg.trim())
    );
    const allowSegments = options.allowSegments === true || (!!item?.readingPromoted && options.allowSegments !== false);

    if (allowSegments && readableSegments.length > 1) {
        const normalizedJoined = typeof toHira === 'function'
            ? toHira(readableSegments.join(''))
            : readableSegments.join('');
        const normalizedReading = typeof toHira === 'function'
            ? toHira(reading)
            : reading;
        if (!reading || normalizedJoined === normalizedReading) {
            return readableSegments.join('/');
        }
    }

    if (allowSegments && readableSegments.length === 1 && !reading) {
        return readableSegments[0];
    }

    return metaDisplay || reading || readableSegments.join('/') || '';
}

function getReadingBaseReading(value) {
    const rawValue = typeof value === 'object' && value !== null
        ? (value.reading || value.sessionReading || value['\u96b1\uff6d\u7e3a\uff7f'] || '')
        : value || '';
    const raw = String(rawValue).trim();
    if (!raw) return '';
    return raw.split('::')[0].trim();
}

function matchesReadingStockTarget(item, target) {
    const normalizedTarget = getReadingBaseReading(target);
    if (!normalizedTarget) return false;
    const itemReading = getReadingBaseReading(item);
    const itemKey = item?.id || item?.reading || item?.['\u96b1\uff6d\u7e3a\uff7f'] || '';
    return itemKey === target || itemReading === normalizedTarget;
}

function isReadingStockPromoted(item) {
    return !!(item && (
        item.readingPromoted ||
        item.promotedReading ||
        item.promoted ||
        item.source === 'reading-combination'
    ));
}

function isReadingStockStarred(item) {
    return !!(item && (item.isSuper || item.ownSuper));
}

function sortReadingStockMatches(matches) {
    return [...(Array.isArray(matches) ? matches : [])].sort((a, b) => {
        const aStar = isReadingStockStarred(a) ? 1 : 0;
        const bStar = isReadingStockStarred(b) ? 1 : 0;
        if (aStar !== bStar) return bStar - aStar;

        const aPromoted = isReadingStockPromoted(a) ? 1 : 0;
        const bPromoted = isReadingStockPromoted(b) ? 1 : 0;
        if (aPromoted !== bPromoted) return bPromoted - aPromoted;

        const aAddedAt = Date.parse(a?.addedAt || '') || 0;
        const bAddedAt = Date.parse(b?.addedAt || '') || 0;
        if (aAddedAt !== bAddedAt) return bAddedAt - aAddedAt;

        const aReading = getReadingBaseReading(a?.reading || a?.sessionReading || '');
        const bReading = getReadingBaseReading(b?.reading || b?.sessionReading || '');
        return aReading.localeCompare(bReading, 'ja');
    });
}

function findReadingStockItemInStock(stock, target) {
    const normalizedTarget = getReadingBaseReading(target);
    if (!normalizedTarget) return null;
    const exactTarget = String(target || '').trim();
    const matches = Array.isArray(stock)
        ? stock.filter(item => {
            if (!item) return false;
            const itemReading = getReadingBaseReading(item.reading || item.sessionReading || '');
            return (exactTarget && item.id === exactTarget) || item.reading === target || itemReading === normalizedTarget;
        })
        : [];
    if (matches.length === 0) return null;
    return sortReadingStockMatches(matches)[0] || null;
}

function findReadingStockItem(target) {
    return findReadingStockItemInStock(getReadingStock(), target);
}

function getReadingStock() {
    try {
        const data = localStorage.getItem(READING_STOCK_KEY);
        const raw = data ? JSON.parse(data) : [];
        return Array.isArray(raw) ? raw.map(normalizeReadingStockItem) : [];
    } catch (e) {
        return [];
    }
}

function saveReadingStock(stock) {
    try {
        localStorage.setItem(READING_STOCK_KEY, JSON.stringify(stock.map(normalizeReadingStockItem)));
    } catch (e) {
        console.error("STOCK: Failed to save reading stock", e);
    }
    if (typeof queuePartnerStockSync === 'function') {
        queuePartnerStockSync('saveReadingStock');
    }
}

function addReadingToStock(reading, baseNickname, tags, options = {}) {
    const stock = getReadingStock();
    const shouldTrackStats = options.trackStats !== false;
    const normalizedBaseNickname = typeof baseNickname === 'string' ? baseNickname.trim() : '';
    const normalizedTags = Array.isArray(tags)
        ? [...new Set(tags.filter(tag => typeof tag === 'string' && tag.trim()))]
        : [];
    const readingPromoted = !!options.readingPromoted;
    const normalizedSegmentsInput = Array.isArray(options.segments) ? options.segments.filter(Boolean) : [];
    const normalizedSegments = readingPromoted ? normalizedSegmentsInput : [];
    const targetId = getReadingStockKey(reading, normalizedSegments);
    const existing = stock.find(item => item.id === targetId) || findReadingStockItemInStock(stock, reading);

    if (existing) {
        existing.tags = [...new Set([...(existing.tags || []), ...normalizedTags])];
        if (!existing.baseNickname && normalizedBaseNickname) {
            existing.baseNickname = normalizedBaseNickname;
        }
        existing.readingPromoted = !!(existing.readingPromoted || readingPromoted);
        existing.segments = existing.readingPromoted
            ? (readingPromoted ? normalizedSegments : (Array.isArray(existing.segments) ? existing.segments.filter(Boolean) : []))
            : [];
        existing.id = getReadingStockKey(reading, existing.readingPromoted ? existing.segments : []);
        if (options.gender) existing.gender = options.gender;
        existing.isSuper = existing.isSuper || !!options.isSuper;
        existing.ownSuper = existing.ownSuper || existing.isSuper;
        existing.partnerSuper = existing.partnerSuper || !!options.partnerSuper;
        if (options.source) existing.source = options.source;
        if (shouldTrackStats && existing.statsTracked === false) {
            existing.statsTracked = true;
            syncReadingStockRankingStats(reading, 1, 'all', {
                gender: existing.gender || options.gender || gender || 'neutral'
            });
        }
        saveReadingStock(stock);
        if (options.clearHidden) {
            forgetHiddenReading(reading);
        }
        return existing;
    }

    const entry = normalizeReadingStockItem({
        id: targetId,
        reading: reading,
        segments: normalizedSegments,
        baseNickname: normalizedBaseNickname,
        tags: normalizedTags,
        isSuper: !!options.isSuper,
        ownSuper: !!options.isSuper,
        partnerSuper: !!options.partnerSuper,
        gender: options.gender || gender || 'neutral',
        addedAt: new Date().toISOString(),
        statsTracked: shouldTrackStats,
        readingPromoted
    });
    if (options.source) entry.source = options.source;

    stock.push(entry);
    saveReadingStock(stock);
    if (options.clearHidden) {
        forgetHiddenReading(reading);
    }
    if (shouldTrackStats) {
        syncReadingStockRankingStats(reading, 1, 'all', {
            gender: entry.gender || options.gender || gender || 'neutral'
        });
    }
    console.log("STOCK: Added reading to stock:", entry);
    return entry;
}

function syncReadingStockFromLiked(items = liked) {
    const likedItems = Array.isArray(items) ? items : [];
    const blockedReadings = new Set(['FREE', 'SEARCH', 'RANKING', 'SHARED']);
    let hiddenReadings = new Set();
    try {
        hiddenReadings = new Set(JSON.parse(localStorage.getItem('meimay_hidden_readings') || '[]'));
    } catch (e) { }
    const normalizeHiddenReading = (value) => {
        const raw = String(value || '').trim().split('::')[0].trim();
        if (!raw) return '';
        return (typeof window !== 'undefined' && window.MeimayPartnerInsights && typeof window.MeimayPartnerInsights.normalizeReading === 'function')
            ? window.MeimayPartnerInsights.normalizeReading(raw)
            : (typeof toHira === 'function' ? toHira(raw) : raw).replace(/\s+/g, '');
    };
    const hiddenReadingSet = new Set(
        Array.from(hiddenReadings)
            .map(value => normalizeHiddenReading(value))
            .filter(Boolean)
    );
    likedItems.forEach(item => {
        if (!item || item.fromPartner) return;
        const sessionReading = typeof item.sessionReading === 'string' ? item.sessionReading.trim() : '';
        const fallbackReading = typeof item.reading === 'string'
            ? item.reading.trim()
            : (typeof item['読み'] === 'string' ? item['読み'].trim() : '');
        const reading = sessionReading && !blockedReadings.has(sessionReading)
            ? sessionReading
            : (fallbackReading && !blockedReadings.has(fallbackReading) ? fallbackReading : '');
        if (!reading) return;
        const normalizedReading = normalizeHiddenReading(reading);
        if (hiddenReadingSet.has(normalizedReading)) return;
        const readingPromoted = !!item.readingPromoted;
        addReadingToStock(
            reading,
            item.baseNickname || '',
            Array.isArray(item.tags) ? item.tags : [],
            {
                segments: readingPromoted && Array.isArray(item.sessionSegments) ? item.sessionSegments : [],
                isSuper: !!item.isSuper,
                gender: item.gender || gender || 'neutral',
                readingPromoted,
                source: readingPromoted ? (item.source || 'reading-combination') : item.source
            }
        );
    });
}

function removeReadingFromStock(target) {
    const stock = getReadingStock();
    const removedItems = stock.filter(item => matchesReadingStockTarget(item, target));
    const nextStock = stock.filter(item => !matchesReadingStockTarget(item, target));

    if (nextStock.length === stock.length) {
        return [];
    }

    saveReadingStock(nextStock);
    if (typeof MeimayStats !== 'undefined' && typeof MeimayStats.recordReadingUnlike === 'function') {
        const normalizedReading = getReadingBaseReading(target);
        const trackedRemovedByGender = new Map();
        removedItems.forEach((item) => {
            if (!item || item.statsTracked === false) return;
            const itemGender = String(item.gender || gender || 'neutral').trim().toLowerCase();
            const normalizedGender = itemGender === 'male' || itemGender === 'female' || itemGender === 'neutral'
                ? itemGender
                : (gender || 'neutral');
            trackedRemovedByGender.set(normalizedGender, (trackedRemovedByGender.get(normalizedGender) || 0) + 1);
        });
        if (normalizedReading && trackedRemovedByGender.size > 0) {
            trackedRemovedByGender.forEach((count, itemGender) => {
                MeimayStats.recordReadingUnlike(normalizedReading, -count, 'all', {
                    gender: itemGender
                }).catch((error) => {
                    console.warn('STATS: reading unlike sync failed', error);
                });
            });
        }
    }
    console.log("STOCK: Removed reading from stock:", target);
    return removedItems;
}

function syncReadingStockRankingStats(reading, delta = 1, period = 'all', genderOrOptions = null) {
    if (typeof MeimayStats === 'undefined') return;

    const normalizedReading = getReadingBaseReading(reading);
    if (!normalizedReading) return;

    const normalizedDelta = Number(delta);
    if (!Number.isInteger(normalizedDelta) || normalizedDelta === 0) return;

    const method = normalizedDelta > 0
        ? MeimayStats.recordReadingLike
        : MeimayStats.recordReadingUnlike;
    if (typeof method !== 'function') return;

    method.call(MeimayStats, normalizedReading, normalizedDelta, period, genderOrOptions).catch((error) => {
        console.warn('STATS: reading stock sync failed', error);
    });
}

function rememberHiddenReading(reading) {
    const raw = String(reading || '').trim();
    if (!raw) return;

    const normalized = normalizeHiddenReadingValue(raw);

    let removedList = [];
    try { removedList = JSON.parse(localStorage.getItem('meimay_hidden_readings') || '[]'); } catch (e) { }
    const removedReadingSet = new Set(
        Array.from(removedList)
            .map(value => getReadingBaseReading(value))
            .filter(Boolean)
    );
    const next = new Set(Array.isArray(removedList) ? removedList.filter(Boolean) : []);
    next.add(raw);
    if (normalized) next.add(normalized);
    localStorage.setItem('meimay_hidden_readings', JSON.stringify(Array.from(next)));
}

function forgetHiddenReading(reading) {
    const raw = String(reading || '').trim();
    if (!raw) return false;

    const normalized = normalizeHiddenReadingValue(raw);

    let removedList = [];
    try { removedList = JSON.parse(localStorage.getItem('meimay_hidden_readings') || '[]'); } catch (e) { }
    if (!Array.isArray(removedList) || removedList.length === 0) return false;

    const next = removedList.filter(item => {
        const value = String(item || '').trim();
        if (!value) return false;
        const normalizedValue = normalizeHiddenReadingValue(value);
        return value !== raw &&
            value !== normalized &&
            normalizedValue !== raw &&
            normalizedValue !== normalized;
    });

    if (next.length === removedList.length) return false;
    localStorage.setItem('meimay_hidden_readings', JSON.stringify(next));
    return true;
}

function normalizeHiddenReadingValue(value) {
    const raw = String(value || '').trim().split('::')[0].trim();
    if (!raw) return '';
    return (typeof window !== 'undefined' && window.MeimayPartnerInsights && typeof window.MeimayPartnerInsights.normalizeReading === 'function')
        ? window.MeimayPartnerInsights.normalizeReading(raw)
        : (typeof toHira === 'function' ? toHira(raw) : raw).replace(/\s+/g, '');
}

function hideReadingFromStock(target) {
    const stock = getReadingStock();
    const removedItems = stock.filter(item => matchesReadingStockTarget(item, target));
    if (removedItems.length === 0) {
        return false;
    }

    removedItems.forEach(item => rememberHiddenReading(item.reading));

    renderReadingStockSection();
    if (typeof refreshPartnerAwareUI === 'function') {
        refreshPartnerAwareUI();
    }

    return true;
}

function removeCompletedReadingFromStock(reading) {
    const displayReading = getReadingBaseReading(reading) || String(reading || '').trim();
    if (!confirm(`「${displayReading}」をストックリストから外しますか？
（選んだ漢字は削除されません）`)) return;

    closeModal('modal-reading-detail');
    removeReadingFromStock(reading);

    let removedList = [];
    try { removedList = JSON.parse(localStorage.getItem('meimay_hidden_readings') || '[]'); } catch (e) { }
    if (!removedList.includes(reading)) {
        removedList.push(reading);
        localStorage.setItem('meimay_hidden_readings', JSON.stringify(removedList));
    }

    if (typeof StorageBox !== 'undefined') StorageBox.saveAll();
    if (typeof MeimaySync !== 'undefined') MeimaySync.uploadData();

    showToast(`「${reading}」を外しました`, '🗑️');
    renderReadingStockSection();
    if (typeof refreshPartnerAwareUI === 'function') {
        refreshPartnerAwareUI();
    }
}

function openReadingStockModal(reading) {
    const modal = document.getElementById('modal-reading-detail');
    if (!modal) return;

    const titleEl = document.getElementById('reading-detail-title');
    const infoEl = document.getElementById('reading-detail-info');
    const btnBuild = document.getElementById('reading-detail-btn-build');
    const btnAdd = document.getElementById('reading-detail-btn-add');
    const btnRemove = document.getElementById('reading-detail-btn-remove');
    const stockItem = getReadingStock().find(item => matchesReadingStockTarget(item, reading)) || null;
    const stockTarget = stockItem?.id || reading;
    const stockSegments = Array.isArray(stockItem?.segments) ? stockItem.segments.filter(Boolean) : [];
    const displayReading = getReadingDisplayLabel(stockItem || { reading });

    titleEl.textContent = displayReading;

    const kanjiCount = liked.filter(i => i.sessionReading === (stockItem?.reading || reading) && i.slot >= 0).length;
    const hasKanjiSelections = kanjiCount > 0;
    infoEl.textContent = hasKanjiSelections
        ? `${kanjiCount}個の漢字を選びました`
        : 'まだ漢字を選んでいません';

    btnBuild.style.display = '';
    btnAdd.style.display = '';
    btnRemove.style.display = '';

    btnBuild.onclick = () => {
        closeModal('modal-reading-detail');
        openBuildFromReading(stockItem?.reading || reading);
    };
    btnAdd.onclick = () => {
        closeModal('modal-reading-detail');
        addMoreForReading(stockItem?.reading || reading);
    };
    btnRemove.onclick = () => {
        closeModal('modal-reading-detail');
        removeCompletedReadingFromStock(stockTarget);
    };

    if (hasKanjiSelections) {
        infoEl.textContent = `${kanjiCount}件の漢字を選んでいます`;
        btnBuild.textContent = '組み立てる';
        btnBuild.onclick = () => {
            closeModal('modal-reading-detail');
            openBuildFromReading(stockItem?.id || stockItem?.reading || reading, stockSegments);
        };
        btnBuild.textContent = '組み立てる';
        btnAdd.style.display = '';
        btnAdd.textContent = '漢字を追加する';
        btnRemove.style.display = '';
    } else {
        infoEl.textContent = 'まだ漢字を選んでいません';
        btnBuild.textContent = '保存';
        btnBuild.onclick = () => {
            closeModal('modal-reading-detail');
            startReadingFromStock(stockTarget);
        };
        btnBuild.textContent = '漢字を選ぶ';
        btnBuild.onclick = () => {
            closeModal('modal-reading-detail');
            startReadingSplitProposalFromStock(stockItem?.reading || reading);
        };
        btnAdd.style.display = 'none';
        btnRemove.style.display = '';
        btnRemove.textContent = 'この読みをストックから外す';
        btnRemove.onclick = () => {
            closeModal('modal-reading-detail');
            removeCompletedReadingFromStock(stockTarget);
        };
    }

    modal.classList.add('active');
}

function renderReadingStockSection() {
    if (typeof renderReadingStockSectionVisible === 'function') return renderReadingStockSectionVisible();
    const pendingStock = getReadingStock();
    const section = document.getElementById('reading-stock-section');
    if (!section) return;

    const history = typeof getReadingHistory === 'function' ? getReadingHistory() : [];
    const readingToSegments = {};
    history.forEach(h => {
        const historyKey = getReadingStockKey(h.reading, h.segments || []);
        readingToSegments[historyKey] = h.segments;
        if (!readingToSegments[h.reading]) readingToSegments[h.reading] = h.segments;
    });

    let removedList = [];
    try { removedList = JSON.parse(localStorage.getItem('meimay_hidden_readings') || '[]'); } catch (e) { }

    const completedReadings = [...new Set(
        liked
            .filter(item =>
                item.sessionReading &&
                item.sessionReading !== 'FREE' &&
                item.sessionReading !== 'SEARCH' &&
                item.slot >= 0 &&
                !removedList.includes(item.sessionReading)
            )
            .map(item => item.sessionReading)
    )];

    const pendingOnly = pendingStock.filter(item =>
        !completedReadings.includes(item.reading) &&
        !removedList.includes(item.reading)
    );

    const hasContent = completedReadings.length > 0 || pendingOnly.length > 0;
    const emptyMsg = document.getElementById('reading-stock-empty');
    if (emptyMsg) emptyMsg.classList.toggle('hidden', hasContent);

    if (!hasContent) {
        section.innerHTML = '';
        return;
    }

    let html = '';

    if (completedReadings.length > 0) {
        html += `<div class="mb-6">
            <div class="text-xs font-black text-[#bca37f] mb-3 tracking-wider uppercase">漢字を選んだ読み</div>
            <div class="space-y-2">`;

        completedReadings.forEach(reading => {
            const kanjiCount = liked.filter(i => i.sessionReading === reading && i.slot >= 0).length;
            const segs = readingToSegments[reading];
            const display = segs ? segs.join('/') : reading;
            html += `
                <div class="bg-white border border-[#ede5d8] rounded-xl p-3 flex items-center gap-3 hover:border-[#bca37f] transition-all cursor-pointer active:scale-[0.98]"
                     onclick="openReadingStockModal('${reading}')">
                    <div class="flex-1 min-w-0">
                        <div class="text-lg font-black text-[#5d5444]">${display}</div>
                        <div class="text-[9px] text-[#a6967a]">${kanjiCount}個の漢字</div>
                    </div>
                    <div class="flex gap-2">
                        <button onclick="event.stopPropagation(); closeModal('modal-reading-detail'); openBuildFromReading('${reading}')"
                            class="text-xs font-bold text-white bg-[#bca37f] px-4 py-2 rounded-full whitespace-nowrap hover:bg-[#a8906c] transition-all active:scale-95 shadow-sm">
                            漢字を選ぶ
                        </button>
                    </div>
                </div>`;
        });

        html += `</div></div>`;
    }

    if (pendingOnly.length > 0) {
        const groups = {};
        pendingOnly.forEach(item => {
            const key = item.baseNickname || '響き候補';
            if (!groups[key]) groups[key] = [];
            groups[key].push(item);
        });

        html += `<div class="mb-5">
            <div class="text-xs font-black text-[#a6967a] mb-3 tracking-wider uppercase">漢字を選んでいない読み</div>`;

        Object.keys(groups).forEach(groupName => {
            const items = groups[groupName];
            html += `<div class="mb-3">
                <div class="text-[10px] text-[#bca37f] mb-1">「${groupName}」より</div>
                <div class="grid grid-cols-2 gap-2">
                    ${items.map(item => {
                        const display = getReadingDisplayLabel(item);
                        const badge = item.isSuper
                            ? '<span class="inline-flex px-2 py-0.5 rounded-full bg-[#fff1d8] text-[#b9965b] text-[9px] font-black">本命</span>'
                            : '';
                        return `
                        <div class="bg-white border border-[#ede5d8] rounded-xl p-3 flex items-center gap-3 hover:border-[#bca37f] transition-all cursor-pointer active:scale-[0.98]"
                             onclick="openReadingStockModal(${JSON.stringify(String(item.reading || ''))})">
                            <div class="flex-1 min-w-0">
                                <div class="text-lg font-black text-[#5d5444] leading-tight">${display}</div>
                                <div class="text-[9px] text-[#a6967a]">${item.baseNickname || ''}</div>
                                <div class="mt-2 flex items-center gap-2 flex-wrap">${badge}</div>
                            </div>
                            <button onclick="event.stopPropagation(); openBuildFromReading(${JSON.stringify(String(item.reading || ''))})" class="shrink-0 text-xs font-bold text-white bg-[#bca37f] px-4 py-2 rounded-full whitespace-nowrap hover:bg-[#a8906c] transition-all active:scale-95 shadow-sm">漢字を選ぶ</button>
                            <button onclick='event.stopPropagation(); removeReadingFromStock(${JSON.stringify(item.id)});renderReadingStockSection()' class="shrink-0 text-[#d4c5af] text-sm p-2 rounded-full hover:bg-[#fef2f2] hover:text-[#f28b82]">✕</button>
                        </div>`;
                    }).join('')}
                </div>
            </div>`;
        });

        html += `</div>`;
    }

    section.innerHTML = html;
}

function openBuildFromReading(reading, preferredSegments = []) {
    const normalizedReading = getReadingBaseReading(reading);
    const normalizedSegments = Array.isArray(preferredSegments) ? preferredSegments.filter(Boolean) : [];
    const entry = getReadingHistoryEntryByReading(reading, normalizedSegments);
    clearCompoundBuildFlow();
    const nameInput = document.getElementById('in-name');
    if (nameInput) nameInput.value = normalizedReading || reading;

    let restoredFlow = null;
    if (entry && entry.compoundFlow) {
        restoredFlow = setCompoundBuildFlow(entry.compoundFlow);
    }
    if (shouldRebuildCompoundFlow(restoredFlow)) {
        restoredFlow = restoreCompoundBuildFlowFromLiked(reading, entry, normalizedSegments) || restoredFlow;
    }

    if (restoredFlow && Array.isArray(restoredFlow.segments) && restoredFlow.segments.length > 0) {
        segments = [...restoredFlow.segments];
    } else if (entry && entry.segments) {
        segments = [...entry.segments];
    } else if (normalizedSegments.length > 0) {
        segments = [...normalizedSegments];
    } else if (typeof getPreferredReadingSegments === 'function') {
        const preferred = getPreferredReadingSegments(normalizedReading || reading);
        segments = Array.isArray(preferred) && preferred.length > 0 ? [...preferred] : [normalizedReading || reading];
    }
    if (typeof openBuild === 'function') openBuild();
}

function addMoreForReading(reading, preferredSegments = []) {
    const normalizedReading = getReadingBaseReading(reading);
    const normalizedSegments = Array.isArray(preferredSegments) ? preferredSegments.filter(Boolean) : [];
    const entry = getReadingHistoryEntryByReading(reading, normalizedSegments);
    clearCompoundBuildFlow();
    const nameInput = document.getElementById('in-name');
    if (nameInput) nameInput.value = normalizedReading || reading;

    let restoredFlow = null;
    if (entry && entry.compoundFlow) {
        restoredFlow = setCompoundBuildFlow(entry.compoundFlow);
    }
    if (shouldRebuildCompoundFlow(restoredFlow)) {
        restoredFlow = restoreCompoundBuildFlowFromLiked(reading, entry, normalizedSegments) || restoredFlow;
    }

    if (restoredFlow && Array.isArray(restoredFlow.segments) && restoredFlow.segments.length > 0) {
        segments = [...restoredFlow.segments];
    } else if (entry && entry.segments) {
        segments = [...entry.segments];
    } else if (normalizedSegments.length > 0) {
        segments = [...normalizedSegments];
    } else if (typeof getPreferredReadingSegments === 'function') {
        const preferred = getPreferredReadingSegments(normalizedReading || reading);
        segments = Array.isArray(preferred) && preferred.length > 0 ? [...preferred] : [normalizedReading || reading];
    }
    window._addMoreFromBuild = false;
    if (typeof updateSurnameData === 'function') updateSurnameData();
    const compoundFlow = getCompoundBuildFlow();
    currentPos = compoundFlow && Number.isInteger(compoundFlow.firstInteractiveSlot) && compoundFlow.firstInteractiveSlot >= 0
        ? compoundFlow.firstInteractiveSlot
        : 0;
    swipes = 0;
    seen.clear();
    if (typeof loadStack === 'function') loadStack();
    changeScreen('scr-main');
}

function startReadingSplitProposalFromStock(reading) {
    const targetReading = getReadingBaseReading(reading);
    const nameInput = document.getElementById('in-name');
    if (nameInput) nameInput.value = targetReading || reading;
    const stockItem = getReadingStock().find(item => matchesReadingStockTarget(item, reading));
    if (!stockItem) return;

    console.log("STOCK: Starting split proposal from stock reading:", stockItem);
    if (typeof openReadingCombinationModal === 'function') {
        openReadingCombinationModal({
            ...stockItem,
            reading: targetReading || stockItem.reading,
            segments: Array.isArray(stockItem.segments) ? stockItem.segments : []
        }, stockItem.baseNickname || '', '', stockItem.id || stockItem.reading || targetReading || reading);
        return;
    }

    if (typeof openBuildFromReading === 'function') {
        openBuildFromReading(targetReading || stockItem.reading);
    }
}
window.startReadingSplitProposalFromStock = startReadingSplitProposalFromStock;

function startReadingFromStock(target) {
    const stock = getReadingStock();
    const stockItem = stock.find(item => matchesReadingStockTarget(item, target));
    if (!stockItem) return;

    console.log("STOCK: Starting kanji search from stock reading:", stockItem);
    hideReadingFromStock(stockItem.id || stockItem.reading || target);
    appMode = 'nickname';
    window._addMoreFromBuild = false;
    clearCompoundBuildFlow();
    if (!Array.isArray(stockItem.segments) || stockItem.segments.length === 0) {
        const preferred = typeof getPreferredReadingSegments === 'function'
            ? getPreferredReadingSegments(stockItem.reading)
            : [];
        segments = Array.isArray(preferred) && preferred.length > 0 ? [...preferred] : [stockItem.reading];
    }

    openBuildFromReading(stockItem.reading);
}
// ==========================================
// 複数読み漢字選択フロー（共通prefix + suffix順次スワイプ）
// ==========================================

let nicknameKanjiQueue = []; // 処理する読みのキュー
let nicknameKanjiQueueIndex = 0;
let nicknameSharedPrefix = ''; // 共有する先頭部分
let nicknameSharedPrefixLiked = []; // 先頭部分の選択済み漢字

/**
 * 複数読みの漢字選択フローを開始
 */
function startMultiReadingKanjiFlow(readings) {
    if (readings.length === 0) return;

    // 共通prefix算出
    nicknameSharedPrefix = findCommonPrefix(readings.map(r => r.reading || r));
    const readingStrings = readings.map(r => r.reading || r);

    // 各読みのsuffix部分を算出
    nicknameKanjiQueue = readingStrings.map(r => ({
        reading: r,
        suffix: r.substring(nicknameSharedPrefix.length)
    }));
    nicknameKanjiQueueIndex = 0;
    nicknameSharedPrefixLiked = [];

    console.log("MULTI: Starting flow, prefix:", nicknameSharedPrefix, "queue:", nicknameKanjiQueue);

    // まず先頭部分（共通prefix）の漢字を選ぶ
    // 最初の読み全体でcalcSegmentsを実行
    const nameInput = document.getElementById('in-name');
    if (nameInput) nameInput.value = readingStrings[0];
    calcSegments();

    // startSwiping相当の処理
    window._addMoreFromBuild = false;
    if (typeof updateSurnameData === 'function') updateSurnameData();
    currentPos = 0;
    swipes = 0;
    seen.clear();
    if (typeof loadStack === 'function') loadStack();
    changeScreen('scr-main');
}

/**
 * 共通prefixの算出
 */
function findCommonPrefix(strings) {
    if (strings.length === 0) return '';
    if (strings.length === 1) {
        // 1つの場合はそのまま（prefixは読み全体）
        return strings[0];
    }
    let prefix = strings[0];
    for (let i = 1; i < strings.length; i++) {
        while (strings[i].indexOf(prefix) !== 0) {
            prefix = prefix.substring(0, prefix.length - 1);
            if (prefix === '') return '';
        }
    }
    return prefix;
}

/**
 * 次のsuffix読みに進む（10-choiceモーダルから呼ばれる）
 */
function advanceNicknameKanjiQueue() {
    nicknameKanjiQueueIndex++;

    if (nicknameKanjiQueueIndex >= nicknameKanjiQueue.length) {
        // 全読み完了 → ストック画面へ
        console.log("MULTI: All readings complete");
        nicknameKanjiQueue = [];
        if (typeof openStock === 'function') openStock('kanji');
        return;
    }

    const next = nicknameKanjiQueue[nicknameKanjiQueueIndex];
    console.log("MULTI: Advancing to next suffix:", next.suffix, "reading:", next.reading);

    // 次の読みでsegments設定
    const nameInput = document.getElementById('in-name');
    if (nameInput) nameInput.value = next.reading;
    calcSegments();

    // 先頭スロットは共有 → 自動コピー
    if (nicknameSharedPrefixLiked.length > 0 && segments.length > 1) {
        nicknameSharedPrefixLiked.forEach(k => {
            const exists = liked.some(l => l['漢字'] === k['漢字'] && l.slot === 0 && l.sessionReading === next.reading);
            if (!exists) {
                liked.push({ ...k, slot: 0, sessionReading: next.reading });
            }
        });
    }

    // slot 1から開始（prefix部分はスキップ）
    currentPos = segments.length > 1 ? 1 : 0;
    swipes = 0;
    currentIdx = 0;
    seen.clear();
    if (typeof loadStack === 'function') loadStack();
    changeScreen('scr-main');

    showToast(`「${next.reading}」の漢字を選びます（${nicknameKanjiQueueIndex + 1}/${nicknameKanjiQueue.length}）`);
}

/**
 * 現在ニックネーム漢字キューが有効か
 */
function isNicknameKanjiQueueActive() {
    return nicknameKanjiQueue.length > 0;
}

// ==========================================
// AI候補調整（好みの音パターンで並び替え）
// ==========================================

let soundPreferenceData = { liked: [], noped: [] };

function persistSoundPreferenceData() {
    try {
        localStorage.setItem('meimay_sound_preferences', JSON.stringify(soundPreferenceData));
    } catch (e) {
        console.warn('SOUND_PREF: Failed to persist', e);
    }
}

/**
 * スワイプ結果から好みの音パターンを学習
 */
function learnSoundPreference(item, action) {
    if (action === 'like' || action === 'super') {
        soundPreferenceData.liked.push(item.reading);
    } else if (action === 'nope') {
        soundPreferenceData.noped.push(item.reading);
    }
    persistSoundPreferenceData();
}

/**
 * AI候補リオーダー：好みの音パターンに基づいてスコア調整
 * nickname / sound 両方で使用
 */
function aiReorderCandidates(candidates) {
    if (soundPreferenceData.liked.length < 3) return candidates;

    // 好みの音パターン分析
    const likedEndings = soundPreferenceData.liked.map(r => r.slice(-2));
    const nopedEndings = soundPreferenceData.noped.map(r => r.slice(-2));
    const likedVowels = soundPreferenceData.liked.map(r => getVowelPattern(r));

    // エンディング頻度カウント
    const endingScore = {};
    likedEndings.forEach(e => { endingScore[e] = (endingScore[e] || 0) + 2; });
    nopedEndings.forEach(e => { endingScore[e] = (endingScore[e] || 0) - 1; });

    // 母音パターン頻度
    const vowelScore = {};
    likedVowels.forEach(v => { vowelScore[v] = (vowelScore[v] || 0) + 1; });

    // スコア付与して並び替え
    return candidates.map(c => {
        let boost = 0;
        const ending = (c.reading || '').slice(-2);
        const vowel = getVowelPattern(c.reading || '');
        boost += (endingScore[ending] || 0) * 10;
        boost += (vowelScore[vowel] || 0) * 5;
        return { ...c, _aiBoost: boost };
    }).sort((a, b) => (b.score + (b._aiBoost || 0)) - (a.score + (a._aiBoost || 0)));
}

function getVowelPattern(reading) {
    if (!reading) return '';
    const vowelMap = {
        'あ': 'a', 'い': 'i', 'う': 'u', 'え': 'e', 'お': 'o',
        'か': 'a', 'き': 'i', 'く': 'u', 'け': 'e', 'こ': 'o',
        'さ': 'a', 'し': 'i', 'す': 'u', 'せ': 'e', 'そ': 'o',
        'た': 'a', 'ち': 'i', 'つ': 'u', 'て': 'e', 'と': 'o',
        'な': 'a', 'に': 'i', 'ぬ': 'u', 'ね': 'e', 'の': 'o',
        'は': 'a', 'ひ': 'i', 'ふ': 'u', 'へ': 'e', 'ほ': 'o',
        'ま': 'a', 'み': 'i', 'む': 'u', 'め': 'e', 'も': 'o',
        'や': 'a', 'ゆ': 'u', 'よ': 'o',
        'ら': 'a', 'り': 'i', 'る': 'u', 'れ': 'e', 'ろ': 'o',
        'わ': 'a', 'ん': 'n',
        'が': 'a', 'ぎ': 'i', 'ぐ': 'u', 'げ': 'e', 'ご': 'o',
        'ざ': 'a', 'じ': 'i', 'ず': 'u', 'ぜ': 'e', 'ぞ': 'o',
        'だ': 'a', 'ぢ': 'i', 'づ': 'u', 'で': 'e', 'ど': 'o',
        'ば': 'a', 'び': 'i', 'ぶ': 'u', 'べ': 'e', 'ぼ': 'o',
        'ぱ': 'a', 'ぴ': 'i', 'ぷ': 'u', 'ぺ': 'e', 'ぽ': 'o'
    };
    return reading.split('').map(c => vowelMap[c] || '').join('');
}

// ==========================================
// トースト・チェックポイント・探すボタン
// ==========================================

function showToast(message) {
    const existing = document.getElementById('meimay-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'meimay-toast';
    toast.className = 'fixed top-16 left-1/2 -translate-x-1/2 z-[10000] bg-[#5d5444] text-white text-xs font-bold px-4 py-2.5 rounded-full shadow-lg transition-all';
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(-50%) translateY(-10px)';
    toast.innerText = message;
    document.body.appendChild(toast);

    requestAnimationFrame(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateX(-50%) translateY(0)';
    });

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(-50%) translateY(-10px)';
        setTimeout(() => toast.remove(), 300);
    }, 2500);
}

function showUniversalSwipeCheckpoint() {
    const likedCount = SwipeState.liked.length;
    const totalSwipes = SwipeState.history.length;

    const modal = document.getElementById('modal-choice');
    const msg = document.getElementById('choice-message');
    const btn = document.getElementById('choice-main-btn');
    const moreBtn = document.getElementById('choice-more-btn');

    if (!modal) return;

    // 外側ボタンを「続ける」にリネーム（「もっと探す」は文脈的に不自然）
    if (moreBtn) { moreBtn.style.display = ''; moreBtn.innerText = '続ける'; }

    if (msg) {
        msg.innerHTML = `
            <div class="mb-4">
                <span class="text-2xl font-black text-[#bca37f]">${totalSwipes}枚</span>
                <span class="text-sm">スワイプしました</span>
            </div>
            <p class="text-sm text-[#7a6f5a] leading-relaxed">
                <b class="text-[#5d5444]">${likedCount}件</b>を候補に追加済み。<br>
                候補リストを確認しますか？
            </p>
        `;
    }

    if (btn) {
        btn.style.display = 'block';
        btn.innerText = '候補リストを見る →';
        btn.onclick = () => {
            modal.classList.remove('active');
            showUniversalList();
        };
    }

    modal.classList.add('active');
}

function navSearchAction() {
    if (appMode === 'nickname') {
        changeScreen('scr-input-nickname');
    } else {
        // アクティブなスワイプセッションがある場合はスワイプ画面へ
        const hasSession = (typeof isFreeSwipeMode !== 'undefined' && isFreeSwipeMode) ||
            (typeof segments !== 'undefined' && segments && segments.length > 0);
        const hasCards = hasSession &&
            (typeof stack !== 'undefined' && stack && stack.length > 0) &&
            (typeof currentIdx !== 'undefined' && currentIdx < stack.length);

        if (hasCards) {
            changeScreen('scr-main');
            if (typeof updateSwipeMainState === 'function') updateSwipeMainState();
        } else {
            // セッションなし → TOPの「名前を作る〜インスピレーション」を表示
            changeScreen('scr-mode');
        }
    }
}

function navSearchAction() {
    if (appMode === 'nickname') {
        changeScreen('scr-input-nickname');
        return;
    }

    const hasSession = (typeof isFreeSwipeMode !== 'undefined' && isFreeSwipeMode) ||
        (typeof segments !== 'undefined' && segments && segments.length > 0);
    const hasCards = hasSession &&
        (typeof stack !== 'undefined' && stack && stack.length > 0) &&
        (typeof currentIdx !== 'undefined' && currentIdx < stack.length);

    if (hasCards) {
        changeScreen('scr-main');
        if (typeof updateSwipeMainState === 'function') updateSwipeMainState();
        return;
    }

    openSearchMethodChooser();
}

// ==========================================
// 直感スワイプ – 1日10枚制限
// ==========================================

const DAILY_KANJI_LIMIT = 10;

function _getDailyKey() {
    const d = new Date();
    return `meimay_daily_kanji_${d.getFullYear()}_${d.getMonth()}_${d.getDate()}`;
}

function getDailySeenKanji() {
    try {
        const raw = localStorage.getItem(_getDailyKey());
        return raw ? JSON.parse(raw) : [];
    } catch (e) { return []; }
}

function addDailySeenKanji(kanji) {
    try {
        const seen = getDailySeenKanji();
        if (!seen.includes(kanji)) {
            seen.push(kanji);
            localStorage.setItem(_getDailyKey(), JSON.stringify(seen));
        }
    } catch (e) { }
}

function getDailyRemainingCount() {
    return Math.max(0, DAILY_KANJI_LIMIT - getDailySeenKanji().length);
}

function updateDailyRemainingDisplay() {
    const el = document.getElementById('home-daily-remaining');
    if (!el) return;
    const premiumActive = typeof PremiumManager !== 'undefined' && PremiumManager.isPremium && PremiumManager.isPremium();
    if (premiumActive) {
        el.innerText = '直感スワイプは無制限';
        return;
    }
    const remaining = getDailyRemainingCount();
    if (remaining === 0) {
        el.innerText = '直感スワイプは使い切りました';
    } else {
        el.innerText = `直感スワイプ 残り ${remaining}枚`;
    }
}

function startDirectKanjiSwipe() {
    if (!master || master.length === 0) {
        alert('漢字データを読み込み中です。しばらくお待ちください。');
        return;
    }

    const premiumActive = typeof PremiumManager !== 'undefined' && PremiumManager.isPremium && PremiumManager.isPremium();
    if (!premiumActive && typeof getDailyRemainingCount === 'function' && getDailyRemainingCount() <= 0) {
        if (typeof showToast === 'function') showToast('今日の直感スワイプは使い切りました', '🌙');
        if (typeof renderHomeProfile === 'function') renderHomeProfile();
        if (typeof showPremiumModal === 'function') setTimeout(() => showPremiumModal(), 250);
        return;
    }

    appMode = 'free';
    window.selectedImageTags = ['none'];
    startFreeSwiping();
}

function freeSwipeAction(action) {
    if (typeof action === 'string' && ['like', 'nope', 'super'].includes(action)) {
        if (typeof universalSwipeAction === 'function') {
            return universalSwipeAction(action);
        }
        return;
    }
    if (typeof startFreeSwiping === 'function') {
        startFreeSwiping();
    }
}

// Expose functions to global scope
window.navSearchAction = navSearchAction;
window.openSearchMethodChooser = openSearchMethodChooser;
window.startMode = startMode;
window.selectGender = selectGender;
window.submitVibe = submitVibe;
window.toggleVibe = toggleVibe;
window.processNickname = processNickname;
window.startFreeSwiping = startFreeSwiping;
window.finishFreeModeToHome = finishFreeModeToHome;
window.runDiagnosis = runDiagnosis;
window.startSwiping = startSwiping;
window.setGender = setGender;
window.setRule = setRule;
window.goBack = goBack;
window.showTutorial = showTutorial;
window.closeTutorial = closeTutorial;
window.nextTutorialStep = nextTutorialStep;
window.processNickname = processNickname;
window.universalSwipeAction = universalSwipeAction;
window.undoUniversalSwipe = undoUniversalSwipe;
window.showUniversalList = showUniversalList;
window.submitUniversalSelection = submitUniversalSelection;
window.resetUniversalSwipe = resetUniversalSwipe;
window.continueUniversalSwipe = continueUniversalSwipe;
window.closeUniversalList = closeUniversalList;
window.startUniversalSwipe = startUniversalSwipe;
window.showNicknameReadingSelection = showNicknameReadingSelection;
window.showNicknameReadingSelectionWithStock = showNicknameReadingSelectionWithStock;
window.proceedWithNicknameReading = proceedWithNicknameReading;
window.freeSwipeAction = freeSwipeAction;
window.toggleFreeBuildPiece = toggleFreeBuildPiece;
window.clearFreeBuild = clearFreeBuild;
window.executeFreeBuild = executeFreeBuild;
window.renderFreeBuild = renderFreeBuild;
window.getReadingStock = getReadingStock;
window.addReadingToStock = addReadingToStock;
window.syncReadingStockFromLiked = syncReadingStockFromLiked;
window.startDirectKanjiSwipe = startDirectKanjiSwipe;
window.updateDailyRemainingDisplay = updateDailyRemainingDisplay;
window.getDailyRemainingCount = getDailyRemainingCount;
window.removeReadingFromStock = removeReadingFromStock;
window.renderReadingStockSection = renderReadingStockSection;
window.startReadingFromStock = startReadingFromStock;
window.openBuildFromReading = openBuildFromReading;
window.closeReadingCombinationModal = closeReadingCombinationModal;
window.saveReadingCandidateFromModal = saveReadingCandidateFromModal;
window.saveReadingCombinationFromModal = saveReadingCombinationFromModal;

function getStrictReadingMatch(item, segment, options = {}) {
    const target = toHira(segment || '');
    if (!target || !item) return null;

    const allowVoicedFallback = options.segmentIndex > 0;
    const targetSeion = typeof toSeion === 'function' ? toSeion(target) : target;
    const targetSokuon = target.replace(/\u3063$/, '\u3064');
    const { majorReadings, minorReadings } = getReadingBucketsForKanji(item);

    if (majorReadings.includes(target) || (targetSokuon !== target && majorReadings.includes(targetSokuon))) {
        return { tier: 1 };
    }

    if (minorReadings.includes(target) || (targetSokuon !== target && minorReadings.includes(targetSokuon))) {
        return { tier: 2 };
    }

    if (allowVoicedFallback && target !== targetSeion && majorReadings.includes(targetSeion)) {
        return { tier: 3 };
    }

    return null;
}

function getCuratedSegmentCandidateItems(segment, targetGender = gender || 'neutral') {
    if (typeof getCuratedReadingSegmentCandidates !== 'function') return null;

    const curatedCandidates = getCuratedReadingSegmentCandidates(segment);
    if (!Array.isArray(curatedCandidates)) return null;

    const items = [];
    const seen = new Set();

    curatedCandidates.forEach((kanji, index) => {
        const normalizedKanji = String(kanji || '').trim();
        if (!normalizedKanji || seen.has(normalizedKanji)) return;
        seen.add(normalizedKanji);

        const masterItem = Array.isArray(master)
            ? master.find((item) => String(item['漢字'] || '').trim() === normalizedKanji)
            : null;

        if (masterItem && typeof isKanjiGenderMismatch === 'function' && isKanjiGenderMismatch(masterItem, targetGender)) {
            return;
        }

        items.push({
            ...(masterItem || {
                '漢字': normalizedKanji,
                '画数': 0,
                '音': '',
                '訓': '',
                '伝統名のり': '',
                'おすすめ度': 0,
                '男のおすすめ度': 0,
                '女のおすすめ度': 0,
                '不適切フラグ': 0,
                '分類': ''
            }),
            _readingMatchTier: 1,
            _recommendationScore: 100000 - (index * 1000),
            _genderPriority: 1,
            _curatedOrder: index
        });
    });

    return items;
}

function findStrictKanjiCandidatesForSegment(segment, limit = 4, targetGender = gender || 'neutral', options = {}) {
    const target = toHira(segment || '');
    if (!target || !master || master.length === 0) return [];

    const segmentIndex = Number(options.segmentIndex || 0);
    const cacheKey = `strict::${target}::${targetGender}::${segmentIndex}`;
    if (readingKanjiCache.has(cacheKey)) {
        return readingKanjiCache.get(cacheKey).slice(0, limit);
    }

    const curatedItems = getCuratedSegmentCandidateItems(target, targetGender);
    if (Array.isArray(curatedItems)) {
        const rankedCuratedItems = sortReadingCandidatesForDisplay(curatedItems);
        readingKanjiCache.set(cacheKey, rankedCuratedItems.slice(0, 20));
        return rankedCuratedItems.slice(0, limit);
    }

    return [];

    const unique = [];
    const seen = new Set();

    master
        .filter(item => {
            const flag = item['\u4E0D\u9069\u5207\u30D5\u30E9\u30B0'];
            if (flag && flag !== '0' && flag !== 'false' && flag !== 'FALSE') return false;
            if (typeof isKanjiGenderMismatch === 'function' && isKanjiGenderMismatch(item, targetGender)) return false;
            return !!getStrictReadingMatch(item, target, { segmentIndex });
        })
        .map(item => {
            const match = getStrictReadingMatch(item, target, { segmentIndex });
            return {
                ...item,
                _readingMatchTier: match ? match.tier : 99,
                _recommendationScore: typeof getKanjiRecommendationScore === 'function'
                    ? getKanjiRecommendationScore(item, targetGender)
                    : ((parseInt(item['\u304A\u3059\u3059\u3081\u5EA6']) || 0) * 100),
                _genderPriority: typeof getKanjiGenderPriority === 'function'
                    ? getKanjiGenderPriority(item, targetGender)
                    : 1
            };
        })
        .sort((a, b) => {
            if (a._readingMatchTier !== b._readingMatchTier) return a._readingMatchTier - b._readingMatchTier;
            if (a._genderPriority !== b._genderPriority) return a._genderPriority - b._genderPriority;
            if (a._recommendationScore !== b._recommendationScore) return b._recommendationScore - a._recommendationScore;
            if (typeof calculateKanjiScore === 'function') return calculateKanjiScore(b) - calculateKanjiScore(a);
            return 0;
        })
        .forEach(item => {
            const kanji = (item['\u6F22\u5B57'] || '').trim();
            if (!kanji || seen.has(kanji)) return;
            seen.add(kanji);
            unique.push(item);
        });

    readingKanjiCache.set(cacheKey, unique.slice(0, 12));
    return unique.slice(0, limit);
}

function buildReadingCombinationCandidates(path, limit = 4, targetGender = gender || 'neutral') {
    if (!Array.isArray(path) || path.length === 0) return [];

    const groups = path.map((segment, index) => {
        const rawGroup = findStrictKanjiCandidatesForSegment(segment, 12, targetGender, { segmentIndex: index });
        const pool = rawGroup
            .slice(0, 10)
            .map((item, itemIndex) => ({
                ...item,
                _poolOrder: itemIndex,
                _displayNoise: Math.random() * 42
            }))
            .sort((a, b) => {
                const aScore = (a._recommendationScore || 0) - (a._poolOrder * 16) + a._displayNoise;
                const bScore = (b._recommendationScore || 0) - (b._poolOrder * 16) + b._displayNoise;
                return bScore - aScore;
            });
        return pool;
    });

    if (groups.some(group => !group || group.length === 0)) return [];

    const allResults = [];
    const seenNames = new Set();
    const maxResults = Math.max(limit * 20, 36);

    function build(index, pieces, score, usedKanji) {
        if (allResults.length >= maxResults) return;

        if (index >= groups.length) {
            const givenName = pieces.map(piece => piece['漢字']).join('');
            if (!givenName || seenNames.has(givenName)) return;
            seenNames.add(givenName);
            allResults.push({
                givenName,
                score: score + Math.random() * 18,
                combination: pieces.map(piece => ({ ...piece }))
            });
            return;
        }

        groups[index].forEach((piece) => {
            const kanji = piece['漢字'];
            if (!kanji || usedKanji.has(kanji) || allResults.length >= maxResults) return;

            const nextUsed = new Set(usedKanji);
            nextUsed.add(kanji);

            const pieceScore =
                (piece._recommendationScore || 0) -
                ((piece._readingMatchTier || 1) - 1) * 40 -
                ((piece._poolOrder || 0) * 12);

            build(index + 1, [...pieces, piece], score + pieceScore, nextUsed);
        });
    }

    build(0, [], 0, new Set());

    const sorted = allResults
        .sort((a, b) => b.score - a.score)
        .map(result => ({
            ...result,
            fullName: surnameStr ? `${surnameStr} ${result.givenName}` : result.givenName
        }));

    return pickReadingDisplayCandidates(sorted, limit);
}

function getReadingCardTagBadges(tags) {
    if (!tags || tags.length === 0) return '';
    return `<div class="flex flex-wrap justify-center gap-2 mb-4 px-2">${tags.map(tag => `
        <span class="inline-flex items-center px-3 py-1 text-[11px] font-bold rounded-full border border-white/40 bg-white/35 text-[#4f4639] backdrop-blur-sm shadow-sm">${tag}</span>
    `).join('')}</div>`;
}

function renderReadingSwipeCard(item) {
    const preview = getReadingFullNamePreview(item.reading);
    return `
        <div class="w-full rounded-[34px] border border-[rgba(225,196,148,0.95)] shadow-[0_18px_40px_rgba(93,84,68,0.14)] px-5 py-6"
            style="background:
                radial-gradient(circle at top left, rgba(255,255,255,0.86), transparent 34%),
                linear-gradient(145deg, rgba(236,241,249,0.96) 0%, rgba(230,236,245,0.94) 45%, rgba(221,228,239,0.96) 100%);
            ">
            <div class="text-[12px] font-bold text-[#8b7e66] mb-3 tracking-[0.08em] text-center">${preview.ruby}</div>
            ${getReadingCardTagBadges(item.tags)}
            <div class="text-[54px] font-black text-[#5d5444] mb-5 tracking-wider leading-tight text-center" style="word-break:keep-all;overflow-wrap:break-word;">${item.reading}</div>
            <div class="w-full px-2 mt-2">
                <div class="rounded-[28px] p-4 border border-white/70 max-w-[290px] mx-auto shadow-[0_10px_24px_rgba(93,84,68,0.08)]"
                    style="background:linear-gradient(180deg, rgba(255,255,255,0.78), rgba(255,255,255,0.62));">
                    <p class="text-[10px] text-[#a6967a] text-center mb-3 font-bold">上位の漢字候補</p>
                    <div class="flex justify-center flex-wrap gap-x-3 gap-y-2 text-[#5d5444] font-bold text-lg">
                        ${getSampleKanjiHtml(item)}
                    </div>
                </div>
            </div>
        </div>
    `;
}

function openReadingCombinationModal(item, baseNickname = '', preferredLabel = '') {
    closeReadingCombinationModal();

    const options = getReadingSegmentOptions(
        item.reading,
        4,
        preferredLabel ? { preferredLabel, compoundLimit: 6 } : { compoundLimit: 6 }
    );
    const preview = getReadingFullNamePreview(item.reading);
    readingCombinationModalState = {
        item: { ...item, baseNickname },
        options
    };

    const modal = document.createElement('div');
    modal.id = 'reading-combination-modal';
    modal.className = 'overlay active modal-overlay-dark';
    modal.onclick = (event) => {
        if (event.target === modal) closeReadingCombinationModal();
    };

    modal.innerHTML = `
        <div class="detail-sheet max-w-[440px]" onclick="event.stopPropagation()">
            <button class="modal-close-x" onclick="closeReadingCombinationModal()">×</button>
            <div class="text-center mb-5">
                <div class="text-[10px] font-black text-[#bca37f] tracking-[0.25em] uppercase mb-2">KANJI CANDIDATES</div>
                <h3 class="text-3xl font-black text-[#5d5444] mb-2">${item.reading}</h3>
                <div class="text-[12px] font-bold text-[#8b7e66]">${preview.ruby}</div>
            </div>
            ${renderReadingTagBadges(item.tags || [])}
            <div class="space-y-3 max-h-[52vh] overflow-y-auto pr-1">
                ${options.length === 0 ? `
                    <div class="rounded-[28px] border border-[#ede5d8] bg-white p-5 text-center text-sm text-[#8b7e66]">
                        この読みでは候補がまだ見つかりませんでした。
                    </div>
                ` : options.map((option, index) => {
                    const candidateHtml = option.candidates.length > 0
                        ? option.candidates.map((candidate, candidateIndex) => `
                            <div class="rounded-2xl border border-[#eee5d8] bg-[#fdfaf5] p-3">
                                <div class="flex items-start justify-between gap-3 mb-3">
                                    <div class="min-w-0">
                                        <div class="text-lg font-black text-[#5d5444]">${candidate.fullName}</div>
                                        <div class="text-[11px] text-[#a6967a] mt-1">${preview.ruby}</div>
                                    </div>
                                    <span class="px-2.5 py-1 rounded-full bg-white text-[#b9965b] text-[10px] font-black border border-[#e7dac7]">候補</span>
                                </div>
                                <div class="flex gap-2">
                                    <button onclick="saveReadingCandidateFromModal(${index}, ${candidateIndex})" class="w-full py-2.5 rounded-2xl border-2 border-[#d9c7ab] text-[#8b7e66] font-black text-sm active:scale-95 transition-all">保存</button>
                                </div>
                            </div>
                        `).join('')
                        : '<div class="px-3 py-2 rounded-2xl bg-[#fdfaf5] border border-[#eee5d8] text-xs text-[#a6967a] text-center">候補がまだありません</div>';
                    return `
                        <div class="rounded-[28px] border border-[#ede5d8] bg-white p-4 shadow-sm">
                            <div class="flex items-center justify-between gap-3 mb-3">
                                <div>
                                    <div class="text-xl font-black text-[#5d5444]">${option.label}</div>
                                    <div class="text-[11px] text-[#a6967a] mt-1">${preview.ruby}</div>
                                </div>
                                <span class="px-3 py-1 rounded-full bg-[#f7f1e7] text-[#b9965b] text-[10px] font-black">${option.badgeLabel || `${option.path.length}分割`}</span>
                            </div>
                            <div class="grid grid-cols-1 gap-2">${candidateHtml}</div>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;

    document.body.appendChild(modal);
}

function getSampleKanjiHtml(item) {
    const options = getReadingSegmentOptions(item.reading, 2);
    const examples = [];

    options.forEach((option) => {
        option.candidates.slice(0, 2).forEach((candidate) => {
            const label = candidate.givenName;
            if (!examples.includes(label)) {
                examples.push(label);
            }
        });
    });

    if (examples.length === 0) {
        return '<span class="text-xs text-[#d4c5af]">候補なし</span>';
    }

    return examples.slice(0, 4).map((example) =>
        `<span class="text-base font-bold mx-1">${example}</span>`
    ).join('');
}

window.closeReadingCombinationModal = closeReadingCombinationModal;
window.saveReadingCandidateFromModal = saveReadingCandidateFromModal;
window.saveReadingCombinationFromModal = saveReadingCombinationFromModal;
window.addMoreForReading = addMoreForReading;
window.inheritModalAction = inheritModalAction;
window.showToast = showToast;
window.toggleReadingStockPicker = toggleReadingStockPicker;
window.selectReadingFromStock = selectReadingFromStock;
window.showUniversalSwipeCheckpoint = showUniversalSwipeCheckpoint;
window.startMultiReadingKanjiFlow = startMultiReadingKanjiFlow;
window.advanceNicknameKanjiQueue = advanceNicknameKanjiQueue;
window.isNicknameKanjiQueueActive = isNicknameKanjiQueueActive;
window.aiReorderCandidates = aiReorderCandidates;

function renderReadingCardStarsV2(selfSuper, partnerSuper) {
    if (typeof window.renderMeimaySuperStars !== 'function') {
        return selfSuper || partnerSuper ? '<div class="text-[12px] leading-none text-[#fbbc04]">★</div>' : '';
    }
    return window.renderMeimaySuperStars({
        self: !!selfSuper,
        partner: !!partnerSuper,
        style: 'display:flex;gap:2px;font-size:12px;line-height:1;pointer-events:none;'
    });
}

function renderReadingTitleWithStarsV2(label, selfSuper, partnerSuper) {
    const text = String(label || '');
    const stars = renderReadingCardStarsV2(selfSuper, partnerSuper);
    if (!stars) {
        return `<span class="reading-title-text">${text}</span>`;
    }
    return `
        <div class="reading-title-with-stars">
            <div class="reading-title-text">${text}</div>
            <div class="reading-title-star-badge">${stars}</div>
        </div>
    `;
}

function openReadingStockModal(reading) {
    const modal = document.getElementById('modal-reading-detail');
    if (!modal) return;

    const titleEl = document.getElementById('reading-detail-title');
    const infoEl = document.getElementById('reading-detail-info');
    const btnBuild = document.getElementById('reading-detail-btn-build');
    const btnAdd = document.getElementById('reading-detail-btn-add');
    const btnRemove = document.getElementById('reading-detail-btn-remove');
    const stockItem = findReadingStockItem(reading);
    const stockTarget = stockItem?.id || reading;
    const kanjiCount = liked.filter(item =>
        getReadingBaseReading(item.sessionReading) === getReadingBaseReading(stockItem?.reading || reading) &&
        item.slot >= 0
    ).length;
    const isPromotedReading = !!stockItem?.readingPromoted || kanjiCount > 0;
    const displayReading = getReadingDisplayLabel(
        stockItem || { reading },
        isPromotedReading ? { allowSegments: true } : { forceRaw: true }
    );

    titleEl.textContent = displayReading;
    infoEl.textContent = isPromotedReading
        ? `${kanjiCount}個の漢字を選びました`
        : 'まだ漢字を選んでいません';

    btnBuild.style.display = '';
    btnAdd.style.display = '';
    btnRemove.style.display = '';

    btnBuild.textContent = isPromotedReading ? '組み立てる' : '漢字を選ぶ';
    btnBuild.onclick = () => {
        closeModal('modal-reading-detail');
        if (isPromotedReading) {
            openBuildFromReading(stockItem?.reading || reading);
        } else {
            startReadingSplitProposalFromStock(stockItem?.reading || reading);
        }
    };

    btnAdd.textContent = '漢字を追加する';
    btnAdd.onclick = () => {
        closeModal('modal-reading-detail');
        addMoreForReading(stockItem?.id || stockItem?.reading || reading, stockSegments);
    };
    btnAdd.style.display = isPromotedReading ? '' : 'none';

    btnRemove.textContent = 'ストックから外す';
    btnRemove.onclick = () => {
        removeCompletedReadingFromStock(stockTarget);
    };

    modal.classList.add('active');
}

function saveReadingCandidateToStock(option, candidate, asSuper = false) {
    const sessionReading = readingCombinationModalState.item.reading;
    const sessionSegments = Array.isArray(option.path) ? [...option.path] : [];

    addReadingToStock(
        sessionReading,
        readingCombinationModalState.item.baseNickname || '',
        readingCombinationModalState.item.tags || [],
        {
            segments: sessionSegments,
            isSuper: !!asSuper,
            gender: readingCombinationModalState.item.gender || gender || 'neutral',
            clearHidden: true,
            readingPromoted: true,
            source: 'reading-combination'
        }
    );

    candidate.combination.forEach((piece, slotIndex) => {
        const existing = liked.find(item =>
            item['漢字'] === piece['漢字'] &&
            item.slot === slotIndex &&
            item.sessionReading === sessionReading
        );

        if (existing) {
            existing.isSuper = existing.isSuper || !!asSuper;
            existing.readingPromoted = true;
            existing.source = existing.source || 'reading-combination';
            return;
        }

        liked.push({
            ...piece,
            slot: slotIndex,
            sessionReading,
            sessionSegments,
            readingPromoted: true,
            source: 'reading-combination',
            isSuper: !!asSuper
        });
    });

    if (typeof StorageBox !== 'undefined' && StorageBox.saveLiked) {
        StorageBox.saveLiked();
    }
}

function saveReadingOnlyFromModal(asSuper = false) {
    if (!readingCombinationModalState) return;
    if (Date.now() - readingCombinationModalOpenedAt < 420) return;
    const item = readingCombinationModalState.item || {};
    addReadingToStock(
        item.reading,
        item.baseNickname || '',
        item.tags || [],
        {
            segments: [],
            isSuper: !!asSuper,
            gender: item.gender || gender || 'neutral',
            clearHidden: true
        }
    );
    if (typeof showToast === 'function') {
        showToast(
            asSuper ? `${item.reading}を本命として保存しました` : `${item.reading}を候補として保存しました`,
            asSuper ? '⭐' : '💾'
        );
    }

    closeReadingCombinationModal();
    if (typeof renderReadingStockSection === 'function') {
        renderReadingStockSection();
    }
    if (typeof refreshPartnerAwareUI === 'function') {
        refreshPartnerAwareUI();
    }
}

function startReadingSplitProposalFromStock(reading) {
    const targetReading = getReadingBaseReading(reading);
    const nameInput = document.getElementById('in-name');
    if (nameInput) nameInput.value = targetReading || reading;
    if (typeof calcSegments === 'function') {
        calcSegments();
        return;
    }
    const stockItem = findReadingStockItem(reading);
    if (!stockItem) return;
    const stockSegments = Array.isArray(stockItem.segments) ? stockItem.segments.filter(Boolean) : [];

    if (typeof openReadingCombinationModal === 'function') {
        openReadingCombinationModal({
            ...stockItem,
            reading: targetReading || stockItem.reading,
            segments: Array.isArray(stockItem.segments) ? stockItem.segments : []
        }, stockItem.baseNickname || '', '', stockItem.id || stockItem.reading || targetReading || reading);
        return;
    }

    if (typeof openBuildFromReading === 'function') {
        openBuildFromReading(targetReading || stockItem.reading);
    }
}

function startReadingFromStock(target) {
    const stockItem = findReadingStockItem(target);
    if (!stockItem) return;

    hideReadingFromStock(stockItem.id || stockItem.reading || target);
    appMode = 'nickname';
    window._addMoreFromBuild = false;
    clearCompoundBuildFlow();
    if (!Array.isArray(stockItem.segments) || stockItem.segments.length === 0) {
        const preferred = typeof getPreferredReadingSegments === 'function'
            ? getPreferredReadingSegments(stockItem.reading)
            : [];
        segments = Array.isArray(preferred) && preferred.length > 0 ? [...preferred] : [stockItem.reading];
    }

    openBuildFromReading(stockItem.reading);
}

function likePartnerReadingStock(index) {
    const pairInsights = typeof window.MeimayPartnerInsights !== 'undefined' ? window.MeimayPartnerInsights : null;
    const partnerReadings = pairInsights?.getPartnerReadingStock ? pairInsights.getPartnerReadingStock() : [];
    if (index < 0 || index >= partnerReadings.length) return;

    const item = partnerReadings[index];
    if (!item) return;
    const reading = getReadingBaseReading(item.reading || item.sessionReading || '');
    if (!reading) return;

    addReadingToStock(reading, item.baseNickname || '', item.tags || [], {
        segments: [],
        isSuper: false,
        partnerSuper: !!item.isSuper,
        gender: item.gender || gender || 'neutral',
        clearHidden: true,
        source: 'partner-reading'
    });

    if (typeof showToast === 'function') {
        showToast(`${reading}を取り込みました`, '📥');
    }
    if (typeof renderReadingStockSection === 'function') {
        renderReadingStockSection();
    }
    if (typeof refreshPartnerAwareUI === 'function') {
        refreshPartnerAwareUI();
    }
}

function renderReadingStockSectionV2() {
    const pendingStock = getReadingStock();
    const section = document.getElementById('reading-stock-section');
    if (!section) return;

    const history = typeof getReadingHistory === 'function' ? getReadingHistory() : [];
    const readingToSegments = {};
    history.forEach(h => {
        const historyKey = getReadingStockKey(h.reading, h.segments || []);
        readingToSegments[historyKey] = h.segments;
        if (!readingToSegments[h.reading]) readingToSegments[h.reading] = h.segments;
    });

    let removedList = [];
    try { removedList = JSON.parse(localStorage.getItem('meimay_hidden_readings') || '[]'); } catch (e) { }
    const removedReadingSet = new Set(removedList.map(item => getReadingBaseReading(item)).filter(Boolean));

    const ownLiked = getVisibleOwnLikedReadingsForUI();
    const completedReadings = [...new Set(
        ownLiked
            .filter(item =>
                item.sessionReading &&
                item.sessionReading !== 'FREE' &&
                item.sessionReading !== 'SEARCH' &&
                item.slot >= 0 &&
                !removedReadingSet.has(getReadingBaseReading(item.sessionReading))
            )
            .map(item => getReadingBaseReading(item.sessionReading))
            .filter(Boolean)
    )];
    const completedReadingSet = new Set(completedReadings);

    const displayPendingStock = [];
    const seenPendingReadings = new Set();
    sortReadingStockMatches(
        pendingStock.filter(item => {
            const readingKey = getReadingBaseReading(item.reading || item.sessionReading || '');
            return readingKey && !removedReadingSet.has(readingKey);
        })
    ).forEach(item => {
        const readingKey = getReadingBaseReading(item.reading || item.sessionReading || '');
        if (!readingKey || seenPendingReadings.has(readingKey)) return;
        seenPendingReadings.add(readingKey);
        displayPendingStock.push(item);
    });

    const pairInsights = typeof window.MeimayPartnerInsights !== 'undefined' ? window.MeimayPartnerInsights : null;
    const partnerReadings = pairInsights?.getPartnerReadingStock ? pairInsights.getPartnerReadingStock() : [];
    const partnerReadingCollection = pairInsights?.getPartnerReadingCollection ? pairInsights.getPartnerReadingCollection() : partnerReadings;
    const partnerReadingByKey = new Map();
    const partnerReadingByReading = new Map();
    partnerReadingCollection.forEach(item => {
        const key = getPartnerViewReadingKey(item, pairInsights);
        if (key && !partnerReadingByKey.has(key)) partnerReadingByKey.set(key, item);
        const normalizedReading = getPartnerViewNormalizedReading(item?.reading, pairInsights);
        if (normalizedReading && !partnerReadingByReading.has(normalizedReading)) partnerReadingByReading.set(normalizedReading, item);
    });

    const compareCardEntries = (a, b, getStarValue = (entry) => !!entry?.isSuper) => {
        const aStar = getStarValue(a) ? 1 : 0;
        const bStar = getStarValue(b) ? 1 : 0;
        if (aStar !== bStar) return bStar - aStar;
        const aReading = getReadingBaseReading(a?.reading || a?.sessionReading || '');
        const bReading = getReadingBaseReading(b?.reading || b?.sessionReading || '');
        return aReading.localeCompare(bReading, 'ja');
    };

    const completedCards = completedReadings.map(reading => {
        const kanjiCount = ownLiked.filter(item => getReadingBaseReading(item.sessionReading) === reading && item.slot >= 0).length;
        const key = getPartnerViewReadingKey({ reading, segments: readingToSegments[reading] || [] }, pairInsights);
        const normalizedReading = getPartnerViewNormalizedReading(reading, pairInsights);
        const ownItem = findReadingStockItem(reading);
        const segmentSource = Array.isArray(ownItem?.segments) && ownItem.segments.length > 0
            ? ownItem.segments
            : (readingToSegments[reading] || []);
        return {
            reading,
            display: segmentSource.length > 0 ? segmentSource.join('/') : reading,
            segments: segmentSource,
            key,
            normalizedReading,
            ownItem,
            partnerItem: partnerReadingByKey.get(key) || partnerReadingByReading.get(normalizedReading) || null,
            kanjiCount
        };
    }).sort((a, b) => compareCardEntries(a, b, entry => !!(entry.ownItem?.isSuper || entry.ownItem?.ownSuper)));

    const completedMatchedKeys = new Set(completedCards.filter(item => item.partnerItem).map(item => item.key).filter(Boolean));
    const matchedReadingKeys = new Set(
        (pairInsights?.getMatchedReadingItems ? pairInsights.getMatchedReadingItems() : [])
            .map(item => getPartnerViewReadingKey(item, pairInsights))
            .filter(Boolean)
    );
    const matchedReadingValues = new Set(
        (pairInsights?.getMatchedReadingItems ? pairInsights.getMatchedReadingItems() : [])
            .map(item => getPartnerViewNormalizedReading(item?.reading, pairInsights))
            .filter(Boolean)
    );
    completedMatchedKeys.forEach(key => matchedReadingKeys.add(key));
    completedCards.forEach(item => {
        if (item.partnerItem && item.normalizedReading) matchedReadingValues.add(item.normalizedReading);
    });

    const isReadingMatchedForView = (item) => {
        const key = getPartnerViewReadingKey(item, pairInsights);
        if (key && matchedReadingKeys.has(key)) return true;
        const normalizedReading = getPartnerViewNormalizedReading(item?.reading, pairInsights);
        return normalizedReading ? matchedReadingValues.has(normalizedReading) : false;
    };

    const pendingOnly = displayPendingStock.filter(item =>
        !completedReadingSet.has(getReadingBaseReading(item.reading || item.sessionReading || ''))
    );
    const partnerPendingCards = partnerReadings
        .map((item, originalIndex) => ({ item, originalIndex }))
        .filter(({ item }) => !isReadingMatchedForView(item))
        .sort((a, b) => compareCardEntries(a.item, b.item, entry => !!(entry.isSuper || entry.ownSuper || entry.partnerSuper)));

    const partnerViewState = typeof window.getMeimayPartnerViewState === 'function'
        ? window.getMeimayPartnerViewState()
        : { readingFocus: 'all' };
    const readingFocus = ['all', 'partner', 'matched'].includes(partnerViewState.readingFocus)
        ? partnerViewState.readingFocus
        : 'all';
    const partnerName = pairInsights?.getPartnerDisplayName
        ? pairInsights.getPartnerDisplayName()
        : (typeof getPartnerRoleLabel === 'function'
            ? getPartnerRoleLabel(MeimayShare?.partnerSnapshot?.role)
            : 'パートナー');

    const showOwnSections = readingFocus !== 'partner';
    const visibleCompleted = showOwnSections
        ? completedCards.filter(item => readingFocus !== 'matched' || isReadingMatchedForView(item))
        : [];
    const visiblePendingOnly = showOwnSections
        ? pendingOnly.filter(item => readingFocus !== 'matched' || isReadingMatchedForView(item))
        : [];
    const visiblePartnerReadings = partnerPendingCards;

    const hasContent = visibleCompleted.length > 0 || visiblePendingOnly.length > 0 || visiblePartnerReadings.length > 0;
    const emptyMsg = document.getElementById('reading-stock-empty');
    if (emptyMsg) emptyMsg.classList.toggle('hidden', hasContent || readingFocus !== 'all');

    if (!hasContent) {
        if (readingFocus === 'partner' || readingFocus === 'matched') {
            const message = readingFocus === 'matched'
                ? 'ふたりで重なっている読みストックはまだありません'
                : `${partnerName}から届いている読みストックはまだありません`;
            section.innerHTML = `
                <div class="text-center py-16 text-sm text-[#a6967a]">
                    <div class="text-4xl mb-4 opacity-50">${readingFocus === 'matched' ? '✦' : '◌'}</div>
                    <p>${message}</p>
                    <button onclick="clearReadingPartnerFocus()" class="mt-4 inline-flex items-center rounded-full border border-[#eadfce] bg-white px-4 py-2 text-[11px] font-bold text-[#8b7e66] active:scale-95">
                        フィルタを解除
                    </button>
                </div>
            `;
        } else {
            section.innerHTML = '';
        }
        return;
    }

    let html = '';

    if (readingFocus === 'partner' || readingFocus === 'matched') {
        const bannerTone = getReadingCardToneV2(readingFocus === 'matched' ? 'matched' : 'partner');
        const bannerTitle = readingFocus === 'matched' ? '重なっている読み' : `${partnerName}の読みストック`;
        const bannerBody = readingFocus === 'matched'
            ? '自分とパートナーの両方にある読みをまとめて表示しています。'
            : `${partnerName}の読みを確認しながら、必要なものだけ取り込めます。`;
        html += `
            <div class="rounded-2xl px-4 py-3 mb-4" style="${bannerTone.card}">
                <div class="flex items-center justify-between gap-3">
                    <div>
                        <div class="text-[10px] font-black tracking-[0.18em] uppercase" style="color:${bannerTone.sub}">${readingFocus === 'matched' ? 'Matched' : 'Partner'}</div>
                        <div class="mt-1 text-sm font-bold text-[#4f4639]">${bannerTitle}</div>
                        <div class="mt-1 text-[11px] text-[#8b7e66]">${bannerBody}</div>
                    </div>
                    <button onclick="clearReadingPartnerFocus()" class="shrink-0 rounded-full px-3 py-1.5 text-[11px] font-bold active:scale-95" style="${bannerTone.actionGhost}">
                        フィルタ解除
                    </button>
                </div>
            </div>
        `;
    }

    if (visibleCompleted.length > 0) {
        html += `<div class="mb-6">
            <div class="text-xs font-black text-[#bca37f] mb-3 tracking-wider uppercase">漢字を選んだ読み</div>
            <div class="space-y-2">`;

        visibleCompleted.forEach(item => {
            const kind = isReadingMatchedForView(item) ? 'matched' : 'self';
            const tone = getReadingCardToneV2(kind);
            html += `
                <div class="rounded-2xl p-3 flex items-center gap-3 hover:-translate-y-[1px] transition-all cursor-pointer active:scale-[0.98]"
                     style="${tone.card}"
                     onclick="openReadingStockModal('${item.reading}')">
                    <div class="flex-1 min-w-0">
                        <div class="text-lg font-black leading-tight" style="color:${tone.title}">
                            ${renderReadingTitleWithStarsV2(
                                item.display,
                                item.ownItem?.isSuper || item.ownItem?.ownSuper,
                                item.ownItem?.partnerSuper || item.partnerItem?.isSuper
                            )}
                        </div>
                        <div class="mt-1 text-[9px]" style="color:${tone.sub}">${item.kanjiCount}個の漢字</div>
                    </div>
                    <button onclick="event.stopPropagation(); openBuildFromReading(${JSON.stringify(String(item.id || item.reading || ''))}, ${JSON.stringify(Array.isArray(item.segments) ? item.segments.filter(Boolean) : [])})"
                        class="text-xs font-bold px-4 py-2 rounded-full whitespace-nowrap transition-all active:scale-95 shadow-sm"
                        style="${tone.action}">
                        組み立てる
                    </button>
                </div>`;
        });

        html += `</div></div>`;
    }

    if (visiblePendingOnly.length > 0) {
        const groups = {};
        visiblePendingOnly.forEach(item => {
            const key = item.baseNickname || 'まだ漢字を選んでいない読み';
            if (!groups[key]) groups[key] = [];
            groups[key].push(item);
        });

        const groupEntries = Object.entries(groups).sort((a, b) => {
            const aStar = a[1].some(item => isReadingStockStarred(item)) ? 1 : 0;
            const bStar = b[1].some(item => isReadingStockStarred(item)) ? 1 : 0;
            if (aStar !== bStar) return bStar - aStar;
            return a[0].localeCompare(b[0], 'ja');
        });

        html += `<div class="mb-5">
            <div class="text-xs font-black text-[#a6967a] mb-3 tracking-wider uppercase">未昇格の読み</div>`;

        groupEntries.forEach(([groupName, items]) => {
            const sortedItems = [...items].sort((a, b) => compareCardEntries(a, b, entry => isReadingStockStarred(entry)));
            html += `<div class="mb-3">
                <div class="text-[10px] text-[#bca37f] mb-1">${groupName}</div>
                <div class="space-y-2">
                    ${sortedItems.map(item => {
                        const display = getReadingDisplayLabel(item, { forceRaw: true });
                        const key = getPartnerViewReadingKey(item, pairInsights);
                        const partnerItem = partnerReadingByKey.get(key) || partnerReadingByReading.get(getPartnerViewNormalizedReading(item?.reading, pairInsights)) || null;
                        const kind = isReadingMatchedForView(item) ? 'matched' : 'self';
                        const tone = getReadingCardToneV2(kind);
                        return `
                        <div class="rounded-2xl p-3 hover:-translate-y-[1px] transition-all cursor-pointer active:scale-[0.98]" style="${tone.card}" data-reading="${JSON.stringify(String(item.reading || ''))}" data-stock-id="${JSON.stringify(String(item.id || ''))}" onclick="openReadingStockModal(${JSON.stringify(String(item.id || item.reading || ''))})">
                            <div class="flex items-center justify-between gap-2">
                                <button onclick='event.stopPropagation(); openReadingStockModal(${JSON.stringify(String(item.id || item.reading || ''))})' class="flex-1 text-left active:scale-95 transition-transform">
                                    <div class="text-lg font-black leading-tight" style="color:${tone.title}">
                                        ${renderReadingTitleWithStarsV2(display, item.isSuper, partnerItem?.isSuper)}
                                    </div>
                                </button>
                                <button onclick='event.stopPropagation(); if(typeof startReadingSplitProposalFromStock === "function") startReadingSplitProposalFromStock(${JSON.stringify(String(item.reading || ""))}); else startReadingFromStock(${JSON.stringify(String(item.reading || ""))})' class="shrink-0 px-4 py-2 rounded-full text-xs font-bold text-white whitespace-nowrap shadow-sm active:scale-95 transition-all" style="${tone.action}">
                                    漢字を選ぶ
                                </button>
                            </div>
                        </div>`;
                    }).join('')}
                </div>
            </div>`;
        });

        html += `</div>`;
    }

    if (visiblePartnerReadings.length > 0) {
        html += `<div class="mb-5">
            <div class="text-xs font-black text-[#dd7d73] mb-3 tracking-wider uppercase">${partnerName}の読みストック</div>
            <div class="space-y-2">
                ${visiblePartnerReadings.map(entry => {
                    const item = entry.item;
                    const display = getReadingDisplayLabel(item, { forceRaw: true });
                    const tone = getReadingCardToneV2('partner');
                    return `
                        <div class="w-full rounded-2xl p-3 flex items-center gap-3" style="${tone.card}">
                            <div class="flex-1 min-w-0">
                                <div class="text-lg font-black leading-tight" style="color:${tone.title}">
                                    ${renderReadingTitleWithStarsV2(display, false, item.isSuper)}
                                </div>
                            </div>
                            <button onclick="likePartnerReadingStock(${entry.originalIndex})" class="shrink-0 px-4 py-2 rounded-full text-[11px] font-bold shadow-sm active:scale-95 whitespace-nowrap" style="${tone.action}">
                                取り込む
                            </button>
                        </div>`;
                }).join('')}
            </div>
        </div>`;
    }

    section.innerHTML = html;
}

function renderReadingStockSectionVisible() {
    renderReadingStockSectionV2();
}

function startNicknameCandidateSwipe(baseReading) {
    const flowBaseReading = toHira(baseReading || '');
    nicknameBaseReading = flowBaseReading;

    const candidates = generateNameCandidates(flowBaseReading, gender, nicknamePosition)
        .map(item => ({
            ...item,
            gender: item.gender || gender || 'neutral'
        }));

    if (!candidates || candidates.length === 0) {
        alert('候補が見つかりませんでした。別の読みで試してください。');
        return;
    }

    startUniversalSwipe('nickname', candidates, {
        title: '読みで選ぶ',
        subtitle: `${nicknameBaseReading} を含む候補から、気になる読みを選びます`,
        onLike: (item, action) => {
            if (typeof addReadingToStock === 'function') {
                addReadingToStock(item.reading, nicknameBaseReading, item.tags || [], {
                    isSuper: action === 'super',
                    gender: item.gender || gender || 'neutral',
                    clearHidden: true
                });
            }
        },
        onTap: (item) => {
            openReadingCombinationModal(item, nicknameBaseReading);
        },
        renderCard: (item) => renderReadingSwipeCard(item)
    });
}

function initSoundMode() {
    const popularNames = generatePopularNames(gender).map(item => ({
        ...item,
        gender: item.gender || gender || 'neutral'
    }));

    startUniversalSwipe('sound', prepareAdaptiveReadingCandidates(popularNames), {
        title: '響きで選ぶ',
        subtitle: '好みが固まるまでは幅広く、だんだん寄せていきます',
        onLike: (item, action) => {
            if (typeof addReadingToStock === 'function') {
                addReadingToStock(item.reading, '', item.tags || [], {
                    isSuper: action === 'super',
                    gender: item.gender || gender || 'neutral',
                    clearHidden: true
                });
            }
        },
        onTap: (item) => {
            openReadingCombinationModal(item);
        },
        renderCard: (item) => renderReadingSwipeCard(item)
    });
}

window.openReadingStockModal = openReadingStockModal;
window.saveReadingOnlyFromModal = saveReadingOnlyFromModal;
window.saveReadingCandidateFromModal = saveReadingCandidateFromModal;
window.likePartnerReadingStock = likePartnerReadingStock;
window.startReadingSplitProposalFromStock = startReadingSplitProposalFromStock;
window.startReadingFromStock = startReadingFromStock;
window.renderReadingStockSectionVisible = renderReadingStockSectionVisible;
window.renderReadingStockSection = renderReadingStockSectionVisible;
window.renderReadingCardStarsV2 = renderReadingCardStarsV2;
window.renderReadingTitleWithStarsV2 = renderReadingTitleWithStarsV2;
window.startNicknameCandidateSwipe = startNicknameCandidateSwipe;
window.initSoundMode = initSoundMode;
window.openReadingCombinationDetailFromItem = openReadingCombinationDetailFromItem;

function renderReadingCardStarsV2(selfSuper, partnerSuper) {
    if (typeof window.renderMeimaySuperStars !== 'function') {
        return selfSuper || partnerSuper ? '<div class="text-[12px] leading-none text-[#fbbc04]">★</div>' : '';
    }
    return window.renderMeimaySuperStars({
        self: !!selfSuper,
        partner: !!partnerSuper,
        style: 'display:flex;gap:2px;font-size:12px;line-height:1;pointer-events:none;'
    });
}

function renderReadingTitleWithStarsV2(label, selfSuper, partnerSuper) {
    const text = String(label || '');
    const stars = renderReadingCardStarsV2(selfSuper, partnerSuper);
    if (!stars) {
        return `<span class="reading-title-text">${text}</span>`;
    }
    return `
        <div class="reading-title-with-stars">
            <div class="reading-title-text">${text}</div>
            <div class="reading-title-star-badge">${stars}</div>
        </div>
    `;
}

function openReadingStockModal(reading) {
    const modal = document.getElementById('modal-reading-detail');
    if (!modal) return;

    const titleEl = document.getElementById('reading-detail-title');
    const infoEl = document.getElementById('reading-detail-info');
    const btnBuild = document.getElementById('reading-detail-btn-build');
    const btnAdd = document.getElementById('reading-detail-btn-add');
    const btnRemove = document.getElementById('reading-detail-btn-remove');
    const stockItem = findReadingStockItem(reading);
    const stockTarget = stockItem?.id || reading;
    const kanjiCount = liked.filter(item =>
        getReadingBaseReading(item.sessionReading) === getReadingBaseReading(stockItem?.reading || reading) &&
        item.slot >= 0
    ).length;
    const isPromotedReading = !!stockItem?.readingPromoted || kanjiCount > 0;
    const displayReading = getReadingDisplayLabel(
        stockItem || { reading },
        isPromotedReading ? { allowSegments: true } : { forceRaw: true }
    );

    titleEl.textContent = displayReading;
    infoEl.textContent = isPromotedReading
        ? `${kanjiCount}個の漢字を選びました`
        : 'まだ漢字を選んでいません';

    btnBuild.style.display = '';
    btnAdd.style.display = '';
    btnRemove.style.display = '';

    btnBuild.textContent = isPromotedReading ? '組み立てる' : '漢字を選ぶ';
    btnBuild.onclick = () => {
        closeModal('modal-reading-detail');
        if (isPromotedReading) {
            openBuildFromReading(stockItem?.reading || reading);
        } else {
            startReadingSplitProposalFromStock(stockItem?.reading || reading);
        }
    };

    btnAdd.textContent = '漢字を追加する';
    btnAdd.onclick = () => {
        closeModal('modal-reading-detail');
        addMoreForReading(stockItem?.reading || reading);
    };
    btnAdd.style.display = isPromotedReading ? '' : 'none';

    btnRemove.textContent = 'この読みをストックから削除';
    btnRemove.onclick = () => {
        closeModal('modal-reading-detail');
        removeCompletedReadingFromStock(stockTarget);
    };

    modal.classList.add('active');
}

function saveReadingCandidateToStock(option, candidate, asSuper = false) {
    const sessionReading = readingCombinationModalState.item.reading;
    const sessionSegments = Array.isArray(option.path) ? [...option.path] : [];

    addReadingToStock(
        sessionReading,
        readingCombinationModalState.item.baseNickname || '',
        readingCombinationModalState.item.tags || [],
        {
            segments: sessionSegments,
            isSuper: !!asSuper,
            gender: readingCombinationModalState.item.gender || gender || 'neutral',
            clearHidden: true,
            readingPromoted: true,
            source: 'reading-combination'
        }
    );

    candidate.combination.forEach((piece, slotIndex) => {
        const existing = liked.find(item =>
            item['漢字'] === piece['漢字'] &&
            item.slot === slotIndex &&
            item.sessionReading === sessionReading
        );

        if (existing) {
            existing.isSuper = existing.isSuper || !!asSuper;
            existing.readingPromoted = true;
            existing.source = existing.source || 'reading-combination';
            return;
        }

        liked.push({
            ...piece,
            slot: slotIndex,
            sessionReading,
            sessionSegments,
            readingPromoted: true,
            source: 'reading-combination',
            isSuper: !!asSuper
        });
    });

    if (typeof StorageBox !== 'undefined' && StorageBox.saveLiked) {
        StorageBox.saveLiked();
    }
}

function saveReadingOnlyFromModal(asSuper = false) {
    if (!readingCombinationModalState) return;
    if (Date.now() - readingCombinationModalOpenedAt < 420) return;
    const item = readingCombinationModalState.item || {};
    addReadingToStock(
        item.reading,
        item.baseNickname || '',
        item.tags || [],
        {
            segments: [],
            isSuper: !!asSuper,
            gender: item.gender || gender || 'neutral',
            clearHidden: true
        }
    );
    if (typeof showToast === 'function') {
        showToast(
            asSuper ? `${item.reading}を本命として保存しました` : `${item.reading}を候補として保存しました`,
            asSuper ? '⭐' : '💾'
        );
    }

    closeReadingCombinationModal();
    if (typeof renderReadingStockSection === 'function') {
        renderReadingStockSection();
    }
    if (typeof refreshPartnerAwareUI === 'function') {
        refreshPartnerAwareUI();
    }
}

function startReadingSplitProposalFromStock(reading) {
    const targetReading = getReadingBaseReading(reading);
    const nameInput = document.getElementById('in-name');
    if (nameInput) nameInput.value = targetReading || reading;
    if (typeof calcSegments === 'function') {
        calcSegments();
        return;
    }
    const stockItem = findReadingStockItem(reading);
    if (!stockItem) return;
    const stockSegments = Array.isArray(stockItem.segments) ? stockItem.segments.filter(Boolean) : [];

    if (typeof openReadingCombinationModal === 'function') {
        openReadingCombinationModal({
            ...stockItem,
            reading: targetReading || stockItem.reading,
            segments: Array.isArray(stockItem.segments) ? stockItem.segments : []
        }, stockItem.baseNickname || '', '', stockItem.id || stockItem.reading || targetReading || reading);
        return;
    }

    if (typeof openBuildFromReading === 'function') {
        openBuildFromReading(targetReading || stockItem.reading);
    }
}

function startReadingFromStock(target) {
    const stockItem = findReadingStockItem(target);
    if (!stockItem) return;

    hideReadingFromStock(stockItem.id || stockItem.reading || target);
    appMode = 'nickname';
    window._addMoreFromBuild = false;
    clearCompoundBuildFlow();
    if (!Array.isArray(stockItem.segments) || stockItem.segments.length === 0) {
        const preferred = typeof getPreferredReadingSegments === 'function'
            ? getPreferredReadingSegments(stockItem.reading)
            : [];
        segments = Array.isArray(preferred) && preferred.length > 0 ? [...preferred] : [stockItem.reading];
    }

    openBuildFromReading(stockItem.reading);
}

function likePartnerReadingStock(index) {
    const pairInsights = typeof window.MeimayPartnerInsights !== 'undefined' ? window.MeimayPartnerInsights : null;
    const partnerReadings = pairInsights?.getPartnerReadingStock ? pairInsights.getPartnerReadingStock() : [];
    if (index < 0 || index >= partnerReadings.length) return;

    const item = partnerReadings[index];
    if (!item) return;
    const reading = getReadingBaseReading(item.reading || item.sessionReading || '');
    if (!reading) return;

    addReadingToStock(reading, item.baseNickname || '', item.tags || [], {
        segments: [],
        isSuper: false,
        partnerSuper: !!item.isSuper,
        gender: item.gender || gender || 'neutral',
        source: 'partner-reading',
        clearHidden: true
    });

    if (typeof showToast === 'function') {
        showToast(`${reading}を取り込みました`, '📥');
    }
    if (typeof renderReadingStockSection === 'function') {
        renderReadingStockSection();
    }
    if (typeof refreshPartnerAwareUI === 'function') {
        refreshPartnerAwareUI();
    }
}

function renderReadingStockSectionV2() {
    const pendingStock = getReadingStock();
    const section = document.getElementById('reading-stock-section');
    if (!section) return;

    const history = typeof getReadingHistory === 'function' ? getReadingHistory() : [];
    const readingToSegments = {};
    history.forEach(h => {
        const historyKey = getReadingStockKey(h.reading, h.segments || []);
        readingToSegments[historyKey] = h.segments;
        if (!readingToSegments[h.reading]) readingToSegments[h.reading] = h.segments;
    });

    let removedList = [];
    try { removedList = JSON.parse(localStorage.getItem('meimay_hidden_readings') || '[]'); } catch (e) { }
    const removedReadingSet = new Set(
        removedList
            .map(item => getReadingBaseReading(item))
            .filter(Boolean)
    );

    const ownLiked = getVisibleOwnLikedReadingsForUI();
    const completedReadings = [...new Set(
        ownLiked
            .filter(item =>
                item.sessionReading &&
                item.sessionReading !== 'FREE' &&
                item.sessionReading !== 'SEARCH' &&
                item.slot >= 0 &&
                !removedReadingSet.has(getReadingBaseReading(item.sessionReading))
            )
            .map(item => getReadingBaseReading(item.sessionReading))
            .filter(Boolean)
    )];

    const completedReadingSet = new Set(completedReadings);
    const displayPendingStock = [];
    const seenPendingReadings = new Set();
    sortReadingStockMatches(
        pendingStock.filter(item => {
            const readingKey = getReadingBaseReading(item.reading || item.sessionReading || '');
            return readingKey && !removedReadingSet.has(readingKey);
        })
    ).forEach(item => {
        const readingKey = getReadingBaseReading(item.reading || item.sessionReading || '');
        if (!readingKey || seenPendingReadings.has(readingKey)) return;
        seenPendingReadings.add(readingKey);
        displayPendingStock.push(item);
    });

    const pairInsights = typeof window.MeimayPartnerInsights !== 'undefined' ? window.MeimayPartnerInsights : null;
    const partnerReadings = pairInsights?.getPartnerReadingStock ? pairInsights.getPartnerReadingStock() : [];
    const partnerReadingCollection = pairInsights?.getPartnerReadingCollection ? pairInsights.getPartnerReadingCollection() : partnerReadings;
    const partnerReadingByKey = new Map();
    const partnerReadingByReading = new Map();
    partnerReadingCollection.forEach(item => {
        const key = getPartnerViewReadingKey(item, pairInsights);
        if (key && !partnerReadingByKey.has(key)) partnerReadingByKey.set(key, item);
        const normalizedReading = getPartnerViewNormalizedReading(item?.reading, pairInsights);
        if (normalizedReading && !partnerReadingByReading.has(normalizedReading)) partnerReadingByReading.set(normalizedReading, item);
    });

    const compareCardEntries = (a, b, getStarValue = (entry) => !!entry?.isSuper) => {
        const aStar = getStarValue(a) ? 1 : 0;
        const bStar = getStarValue(b) ? 1 : 0;
        if (aStar !== bStar) return bStar - aStar;
        const aReading = getReadingBaseReading(a?.reading || a?.sessionReading || '');
        const bReading = getReadingBaseReading(b?.reading || b?.sessionReading || '');
        return aReading.localeCompare(bReading, 'ja');
    };

    const completedCards = completedReadings.map(reading => {
        const kanjiCount = ownLiked.filter(item => getReadingBaseReading(item.sessionReading) === reading && item.slot >= 0).length;
        const key = getPartnerViewReadingKey({ reading, segments: readingToSegments[reading] || [] }, pairInsights);
        const normalizedReading = getPartnerViewNormalizedReading(reading, pairInsights);
        const ownItem = findReadingStockItem(reading);
        const segmentSource = Array.isArray(ownItem?.segments) && ownItem.segments.length > 0
            ? ownItem.segments
            : (readingToSegments[reading] || []);
        return {
            reading,
            display: segmentSource.length > 0 ? segmentSource.join('/') : reading,
            segments: segmentSource,
            key,
            normalizedReading,
            ownItem,
            partnerItem: partnerReadingByKey.get(key) || partnerReadingByReading.get(normalizedReading) || null,
            kanjiCount
        };
    }).sort((a, b) => compareCardEntries(a, b, entry => !!(entry.ownItem?.isSuper || entry.ownItem?.ownSuper || entry.ownItem?.partnerSuper || entry.partnerItem?.isSuper)));

    const completedMatchedKeys = new Set(completedCards.filter(item => item.partnerItem).map(item => item.key).filter(Boolean));
    const matchedReadingKeys = new Set(
        (pairInsights?.getMatchedReadingItems ? pairInsights.getMatchedReadingItems() : [])
            .map(item => getPartnerViewReadingKey(item, pairInsights))
            .filter(Boolean)
    );
    const matchedReadingValues = new Set(
        (pairInsights?.getMatchedReadingItems ? pairInsights.getMatchedReadingItems() : [])
            .map(item => getPartnerViewNormalizedReading(item?.reading, pairInsights))
            .filter(Boolean)
    );
    completedMatchedKeys.forEach(key => matchedReadingKeys.add(key));
    completedCards.forEach(item => {
        if (item.partnerItem && item.normalizedReading) matchedReadingValues.add(item.normalizedReading);
    });

    const isReadingMatchedForView = (item) => {
        const key = getPartnerViewReadingKey(item, pairInsights);
        if (key && matchedReadingKeys.has(key)) return true;
        const normalizedReading = getPartnerViewNormalizedReading(item?.reading, pairInsights);
        return normalizedReading ? matchedReadingValues.has(normalizedReading) : false;
    };

    const pendingOnly = displayPendingStock.filter(item =>
        !completedReadingSet.has(getReadingBaseReading(item.reading || item.sessionReading || ''))
    );
    const partnerPendingCards = partnerReadings
        .map((item, originalIndex) => ({ item, originalIndex }))
        .filter(({ item }) => !isReadingMatchedForView(item))
        .sort((a, b) => compareCardEntries(a.item, b.item, entry => !!(entry.isSuper || entry.ownSuper || entry.partnerSuper)));

    const partnerViewState = typeof window.getMeimayPartnerViewState === 'function'
        ? window.getMeimayPartnerViewState()
        : { readingFocus: 'all' };
    const readingFocus = ['all', 'partner', 'matched'].includes(partnerViewState.readingFocus)
        ? partnerViewState.readingFocus
        : 'all';
    const partnerName = pairInsights?.getPartnerDisplayName
        ? pairInsights.getPartnerDisplayName()
        : (typeof getPartnerRoleLabel === 'function'
            ? getPartnerRoleLabel(MeimayShare?.partnerSnapshot?.role)
            : 'パートナー');

    const showOwnSections = readingFocus !== 'partner';
    const visibleCompleted = showOwnSections
        ? completedCards.filter(item => readingFocus !== 'matched' || isReadingMatchedForView(item))
        : [];
    const visiblePendingOnly = showOwnSections
        ? pendingOnly.filter(item => readingFocus !== 'matched' || isReadingMatchedForView(item))
        : [];
    const visiblePartnerReadings = partnerPendingCards;

    const hasContent = visibleCompleted.length > 0 || visiblePendingOnly.length > 0 || visiblePartnerReadings.length > 0;
    const emptyMsg = document.getElementById('reading-stock-empty');
    if (emptyMsg) emptyMsg.classList.toggle('hidden', hasContent || readingFocus !== 'all');

    if (!hasContent) {
        if (readingFocus === 'partner' || readingFocus === 'matched') {
            const message = readingFocus === 'matched'
                ? 'ふたりで重なっている読みストックはまだありません'
                : `${partnerName}から届いている読みストックはまだありません`;
            section.innerHTML = `
                <div class="text-center py-16 text-sm text-[#a6967a]">
                    <div class="text-4xl mb-4 opacity-50">${readingFocus === 'matched' ? '✦' : '◌'}</div>
                    <p>${message}</p>
                    <button onclick="clearReadingPartnerFocus()" class="mt-4 inline-flex items-center rounded-full border border-[#eadfce] bg-white px-4 py-2 text-[11px] font-bold text-[#8b7e66] active:scale-95">
                        フィルタを解除
                    </button>
                </div>
            `;
        } else {
            section.innerHTML = '';
        }
        return;
    }

    let html = '';

    if (readingFocus === 'partner' || readingFocus === 'matched') {
        const bannerTone = getReadingCardToneV2(readingFocus === 'matched' ? 'matched' : 'partner');
        const bannerTitle = readingFocus === 'matched' ? '重なっている読み' : `${partnerName}の読みストック`;
        const bannerBody = readingFocus === 'matched'
            ? '自分とパートナーの両方にある読みをまとめて表示しています。'
            : `${partnerName}の読みを確認しながら、必要なものだけ取り込めます。`;
        html += `
            <div class="rounded-2xl px-4 py-3 mb-4" style="${bannerTone.card}">
                <div class="flex items-center justify-between gap-3">
                    <div>
                        <div class="text-[10px] font-black tracking-[0.18em] uppercase" style="color:${bannerTone.sub}">${readingFocus === 'matched' ? 'Matched' : 'Partner'}</div>
                        <div class="mt-1 text-sm font-bold text-[#4f4639]">${bannerTitle}</div>
                        <div class="mt-1 text-[11px] text-[#8b7e66]">${bannerBody}</div>
                    </div>
                    <button onclick="clearReadingPartnerFocus()" class="shrink-0 rounded-full px-3 py-1.5 text-[11px] font-bold active:scale-95" style="${bannerTone.actionGhost}">
                        フィルタ解除
                    </button>
                </div>
            </div>
        `;
    }

    if (visibleCompleted.length > 0) {
        html += `<div class="mb-6">
            <div class="text-xs font-black text-[#bca37f] mb-3 tracking-wider uppercase">漢字を選んだ読み</div>
            <div class="space-y-2">`;

        visibleCompleted.forEach(item => {
            const kind = item.partnerItem ? 'matched' : 'self';
            const tone = getReadingCardToneV2(kind);
            const stars = renderReadingCardStarsV2(item.ownItem?.isSuper, item.partnerItem?.isSuper);
            html += `
                <div class="rounded-2xl p-3 flex items-center gap-3 hover:-translate-y-[1px] transition-all cursor-pointer active:scale-[0.98]"
                     style="${tone.card}"
                     onclick="openReadingStockModal('${item.reading}')">
                    <div class="flex-1 min-w-0">
                        <div class="text-lg font-black leading-tight" style="color:${tone.title}">
                            ${renderReadingTitleWithStarsV2(item.display, item.ownItem?.isSuper, item.partnerItem?.isSuper)}
                        </div>
                        <div class="mt-1 text-[9px]" style="color:${tone.sub}">${item.kanjiCount}個の漢字</div>
                    </div>
                    <button onclick="event.stopPropagation(); openBuildFromReading(${JSON.stringify(String(item.id || item.reading || ''))}, ${JSON.stringify(Array.isArray(item.segments) ? item.segments.filter(Boolean) : [])})"
                        class="text-xs font-bold px-4 py-2 rounded-full whitespace-nowrap transition-all active:scale-95 shadow-sm"
                        style="${tone.action}">
                        組み立てる
                    </button>
                </div>`;
        });

        html += `</div></div>`;
    }

    if (visiblePendingOnly.length > 0) {
        const groups = {};
        visiblePendingOnly.forEach(item => {
            const key = item.baseNickname || 'まだ漢字を選んでいない読み';
            if (!groups[key]) groups[key] = [];
            groups[key].push(item);
        });

        const groupEntries = Object.entries(groups).sort((a, b) => {
            const aStar = a[1].some(item => isReadingStockStarred(item)) ? 1 : 0;
            const bStar = b[1].some(item => isReadingStockStarred(item)) ? 1 : 0;
            if (aStar !== bStar) return bStar - aStar;
            return a[0].localeCompare(b[0], 'ja');
        });

        html += `<div class="mb-5">
            <div class="text-xs font-black text-[#a6967a] mb-3 tracking-wider uppercase">未昇格の読み</div>`;

        groupEntries.forEach(([groupName, items]) => {
            const sortedItems = [...items].sort((a, b) => compareCardEntries(a, b, entry => isReadingStockStarred(entry)));
            html += `<div class="mb-3">
                <div class="text-[10px] text-[#bca37f] mb-1">${groupName}</div>
                <div class="space-y-2">
                    ${sortedItems.map(item => {
                        const display = getReadingDisplayLabel(item, { forceRaw: true });
                        const key = getPartnerViewReadingKey(item, pairInsights);
                        const partnerItem = partnerReadingByKey.get(key) || partnerReadingByReading.get(getPartnerViewNormalizedReading(item?.reading, pairInsights)) || null;
                        const kind = isReadingMatchedForView(item) ? 'matched' : 'self';
                        const tone = getReadingCardToneV2(kind);
                        const stars = renderReadingCardStarsV2(item.isSuper, partnerItem?.isSuper);
                        return `
                        <div class="rounded-2xl p-3 hover:-translate-y-[1px] transition-all cursor-pointer active:scale-[0.98]" style="${tone.card}" data-reading="${JSON.stringify(String(item.reading || ''))}" data-stock-id="${JSON.stringify(String(item.id || ''))}" onclick="openReadingStockModal(${JSON.stringify(String(item.id || item.reading || ''))})">
                            <div class="flex items-center justify-between gap-2">
                                <button onclick='event.stopPropagation(); openReadingStockModal(${JSON.stringify(String(item.id || item.reading || ''))})' class="flex-1 text-left active:scale-95 transition-transform">
                                    <div class="text-lg font-black leading-tight" style="color:${tone.title}">
                                        ${renderReadingTitleWithStarsV2(display, item.isSuper, partnerItem?.isSuper)}
                                    </div>
                                </button>
                                <button onclick='event.stopPropagation(); if(typeof startReadingSplitProposalFromStock === "function") startReadingSplitProposalFromStock(${JSON.stringify(String(item.reading || ""))}); else startReadingFromStock(${JSON.stringify(String(item.reading || ""))})' class="shrink-0 px-4 py-2 rounded-full text-xs font-bold text-white whitespace-nowrap shadow-sm active:scale-95 transition-all" style="${tone.action}">
                                    漢字を選ぶ
                                </button>
                            </div>
                        </div>`;
                    }).join('')}
                </div>
            </div>`;
        });

        html += `</div>`;
    }

    if (visiblePartnerReadings.length > 0) {
        html += `<div class="mb-5">
            <div class="text-xs font-black text-[#dd7d73] mb-3 tracking-wider uppercase">${partnerName}の読みストック</div>
            <div class="space-y-2">
                ${visiblePartnerReadings.map(entry => {
                    const item = entry.item;
                    const display = getReadingDisplayLabel(item, { forceRaw: true });
                    const tone = getReadingCardToneV2('partner');
                    const stars = renderReadingCardStarsV2(false, item.isSuper);
                    return `
                        <div class="w-full rounded-2xl p-3 flex items-center gap-3" style="${tone.card}">
                            <div class="flex-1 min-w-0">
                                <div class="text-lg font-black leading-tight" style="color:${tone.title}">
                                    ${renderReadingTitleWithStarsV2(display, false, item.isSuper)}
                                </div>
                            </div>
                            <button onclick="likePartnerReadingStock(${entry.originalIndex})" class="shrink-0 px-4 py-2 rounded-full text-[11px] font-bold shadow-sm active:scale-95 whitespace-nowrap" style="${tone.action}">
                                取り込む
                            </button>
                        </div>`;
                }).join('')}
            </div>
        </div>`;
    }

    section.innerHTML = html;
}

function renderReadingStockSectionVisible() {
    renderReadingStockSectionV2();
}

function startNicknameCandidateSwipe(baseReading) {
    const flowBaseReading = toHira(baseReading || '');
    nicknameBaseReading = flowBaseReading;

    const candidates = generateNameCandidates(flowBaseReading, gender, nicknamePosition)
        .map(item => ({
            ...item,
            gender: item.gender || gender || 'neutral'
        }));

    if (!candidates || candidates.length === 0) {
        alert('候補が見つかりませんでした。別の読みで試してください。');
        return;
    }

    startUniversalSwipe('nickname', candidates, {
        title: '読みで選ぶ',
        subtitle: `${nicknameBaseReading} を含む候補から、気になる読みを選びます`,
        onLike: (item, action) => {
            if (typeof addReadingToStock === 'function') {
                addReadingToStock(item.reading, nicknameBaseReading, item.tags || [], {
                    isSuper: action === 'super',
                    gender: item.gender || gender || 'neutral',
                    clearHidden: true
                });
            }
        },
        onTap: (item) => {
            openReadingCombinationModal(item, nicknameBaseReading);
        },
        renderCard: (item) => renderReadingSwipeCard(item)
    });
}

function initSoundMode() {
    const popularNames = generatePopularNames(gender).map(item => ({
        ...item,
        gender: item.gender || gender || 'neutral'
    }));

    startUniversalSwipe('sound', prepareAdaptiveReadingCandidates(popularNames), {
        title: '響きで選ぶ',
        subtitle: '好みが固まるまでは幅広く、だんだん寄せていきます',
        onLike: (item, action) => {
            if (typeof addReadingToStock === 'function') {
                addReadingToStock(item.reading, '', item.tags || [], {
                    isSuper: action === 'super',
                    gender: item.gender || gender || 'neutral',
                    clearHidden: true
                });
            }
        },
        onTap: (item) => {
            openReadingCombinationModal(item);
        },
        renderCard: (item) => renderReadingSwipeCard(item)
    });
}

window.openReadingStockModal = openReadingStockModal;
window.saveReadingOnlyFromModal = saveReadingOnlyFromModal;
window.saveReadingCandidateFromModal = saveReadingCandidateFromModal;
window.saveReadingCandidateToStock = saveReadingCandidateToStock;
window.likePartnerReadingStock = likePartnerReadingStock;
window.startReadingSplitProposalFromStock = startReadingSplitProposalFromStock;
window.startReadingFromStock = startReadingFromStock;
window.renderReadingStockSectionVisible = renderReadingStockSectionVisible;
window.renderReadingStockSection = renderReadingStockSectionVisible;
window.renderReadingCardStarsV2 = renderReadingCardStarsV2;
window.renderReadingTitleWithStarsV2 = renderReadingTitleWithStarsV2;
window.startNicknameCandidateSwipe = startNicknameCandidateSwipe;
window.initSoundMode = initSoundMode;
window.learnSoundPreference = learnSoundPreference;

function getReadingCandidateDisplayName(candidate) {
    return String(candidate?.givenName || candidate?.fullName || '').replace(/\s+/g, '');
}

function compareReadingCandidatesForDisplay(a, b) {
    const aName = getReadingCandidateDisplayName(a);
    const bName = getReadingCandidateDisplayName(b);
    const lengthDelta = aName.length - bName.length;
    if (lengthDelta !== 0) return lengthDelta;

    const aCuratedOrder = typeof a?._curatedOrder === 'number' ? a._curatedOrder : null;
    const bCuratedOrder = typeof b?._curatedOrder === 'number' ? b._curatedOrder : null;
    if (aCuratedOrder !== null && bCuratedOrder !== null && aCuratedOrder !== bCuratedOrder) {
        return aCuratedOrder - bCuratedOrder;
    }

    const scoreDelta = (b?.score || 0) - (a?.score || 0);
    if (scoreDelta !== 0) return scoreDelta;

    return aName.localeCompare(bName, 'ja');
}

function sortReadingCandidatesForDisplay(list) {
    return [...(Array.isArray(list) ? list : [])].sort(compareReadingCandidatesForDisplay);
}

// 最初の区切りが長い候補を先に見せる
function compareReadingSegmentOptionsForDisplay(a, b) {
    const aPath = Array.isArray(a?.path) ? a.path.filter(Boolean) : [];
    const bPath = Array.isArray(b?.path) ? b.path.filter(Boolean) : [];
    const aFirstLength = aPath[0] ? String(aPath[0]).length : 0;
    const bFirstLength = bPath[0] ? String(bPath[0]).length : 0;
    if (aFirstLength !== bFirstLength) return bFirstLength - aFirstLength;

    const aPathLength = aPath.length;
    const bPathLength = bPath.length;
    if (aPathLength !== bPathLength) return aPathLength - bPathLength;

    const aCount = Array.isArray(a?.candidates) ? a.candidates.length : 0;
    const bCount = Array.isArray(b?.candidates) ? b.candidates.length : 0;
    if (aCount !== bCount) return bCount - aCount;

    return String(a?.label || '').localeCompare(String(b?.label || ''), 'ja');
}

function pickReadingDisplayCandidates(allCandidates, limit) {
    const rankedCandidates = sortReadingCandidatesForDisplay(allCandidates);
    const selected = [];
    const selectedNames = new Set();
    const firstSlotSeen = new Set();

    const getFirstSlotKey = (candidate) => {
        const firstPiece = Array.isArray(candidate?.combination) ? candidate.combination[0] : null;
        const firstKanji = firstPiece && firstPiece['漢字'] ? String(firstPiece['漢字']).trim() : '';
        return firstKanji || String(candidate?.givenName || candidate?.fullName || '').trim();
    };

    const addCandidate = (candidate) => {
        if (!candidate || selected.length >= limit) return false;
        const nameKey = String(candidate.givenName || candidate.fullName || '').trim();
        if (!nameKey || selectedNames.has(nameKey)) return false;
        selected.push(candidate);
        selectedNames.add(nameKey);
        return true;
    };

    rankedCandidates.forEach((candidate) => {
        if (selected.length >= limit) return;
        const firstSlotKey = getFirstSlotKey(candidate);
        if (!firstSlotKey || firstSlotSeen.has(firstSlotKey)) return;
        if (addCandidate(candidate)) {
            firstSlotSeen.add(firstSlotKey);
        }
    });

    if (selected.length < limit) {
        rankedCandidates.forEach((candidate) => {
            if (selected.length >= limit) return;
            addCandidate(candidate);
        });
    }

    return sortReadingCandidatesForDisplay(selected).slice(0, limit);
}

function buildReadingCombinationCandidates(path, limit = 4, targetGender = gender || 'neutral') {
    if (!Array.isArray(path) || path.length === 0) return [];

    const groups = path.map((segment) => {
        const rawGroup = findStrictKanjiCandidatesForSegment(segment, 20, targetGender);
        const pool = sortReadingCandidatesForDisplay(
            rawGroup
                .slice(0, 16)
                .map((item, index) => ({
                    ...item,
                    _poolOrder: index,
                    _displayNoise: Math.random() * 120
                }))
        );
        return pool;
    });

    if (groups.some(group => !group || group.length === 0)) return [];

    const allResults = [];
    const seenNames = new Set();
    const maxResults = Math.max(limit * 18, 32);

    function build(index, pieces, score, usedKanji) {
        if (allResults.length >= maxResults) return;

        if (index >= groups.length) {
            const givenName = pieces.map(piece => piece['漢字']).join('');
            if (!givenName || seenNames.has(givenName)) return;
            seenNames.add(givenName);
            allResults.push({
                givenName,
                score: score + Math.random() * 60,
                combination: pieces.map(piece => ({ ...piece }))
            });
            return;
        }

        groups[index].forEach((piece) => {
            const kanji = piece['漢字'];
            if (!kanji || usedKanji.has(kanji) || allResults.length >= maxResults) return;

            const nextUsed = new Set(usedKanji);
            nextUsed.add(kanji);

            const pieceScore =
                (piece._recommendationScore || 0) -
                ((piece._readingMatchTier || 1) - 1) * 40 -
                ((piece._poolOrder || 0) * 14);

            build(index + 1, [...pieces, piece], score + pieceScore, nextUsed);
        });
    }

    build(0, [], 0, new Set());

    const sorted = [...allResults]
        .sort(compareReadingCandidatesForDisplay)
        .slice(0, Math.max(limit * 20, 40))
        .map(result => ({
            ...result,
            fullName: surnameStr ? `${surnameStr} ${result.givenName}` : result.givenName
        }));

    return pickReadingDisplayCandidates(sorted, limit);
}

function saveReadingCandidateToStock(option, candidate, asSuper = false) {
    const sessionReading = readingCombinationModalState.item.reading;
    const sessionSegments = Array.isArray(option.path) ? [...option.path] : [];

    addReadingToStock(
        sessionReading,
        readingCombinationModalState.item.baseNickname || '',
        readingCombinationModalState.item.tags || [],
        {
            segments: sessionSegments,
            isSuper: !!asSuper,
            gender: readingCombinationModalState.item.gender || gender || 'neutral',
            clearHidden: true
        }
    );

    candidate.combination.forEach((piece, slotIndex) => {
        const existing = liked.find(item =>
            item['漢字'] === piece['漢字'] &&
            item.slot === slotIndex &&
            item.sessionReading === sessionReading
        );

        if (existing) {
            existing.isSuper = existing.isSuper || !!asSuper;
            return;
        }

        liked.push({
            ...piece,
            slot: slotIndex,
            sessionReading,
            sessionSegments,
            isSuper: !!asSuper
        });
    });

    if (typeof StorageBox !== 'undefined' && StorageBox.saveLiked) {
        StorageBox.saveLiked();
    }
}

function saveReadingCandidateFromModal(optionIndex, candidateIndex, asSuper = false) {
    if (!readingCombinationModalState) return;
    if (Date.now() - readingCombinationModalOpenedAt < 420) return;
    const option = readingCombinationModalState.options[optionIndex];
    const candidate = option && option.candidates ? option.candidates[candidateIndex] : null;
    if (!option || !candidate) return;
    const reading = readingCombinationModalState.item.reading;

    saveReadingCandidateToStock(option, candidate, asSuper);

    const surnameRuby = typeof surnameReading !== 'undefined' ? surnameReading : '';
    const combination = candidate.combination.map((piece, slotIndex) => ({
        ...piece,
        slot: slotIndex,
        sessionReading: reading,
        sessionSegments: [...option.path],
        isSuper: !!asSuper
    }));

    persistGeneratedSavedName({
        fullName: surnameStr ? `${surnameStr} ${candidate.givenName}` : candidate.givenName,
        reading: surnameRuby ? `${surnameRuby} ${reading}` : reading,
        givenName: candidate.givenName,
        combination,
        segments: [...option.path],
        fortune: null,
        source: 'reading-combination',
        splitLabel: option.label,
        tags: readingCombinationModalState.item.tags || [],
        savedAt: new Date().toISOString(),
        timestamp: new Date().toISOString()
    });

    if (typeof showToast === 'function') {
        showToast(
            asSuper ? `${candidate.givenName}を本命として保存しました` : `${candidate.givenName}を候補として保存しました`,
            asSuper ? '★' : '✓'
        );
    }

    if (typeof renderReadingStockSection === 'function') {
        renderReadingStockSection();
    }
    if (typeof refreshPartnerAwareUI === 'function') {
        refreshPartnerAwareUI();
    }
}function saveReadingOnlyFromModal(asSuper = false) {
    if (!readingCombinationModalState) return;
    if (Date.now() - readingCombinationModalOpenedAt < 420) return;
    const item = readingCombinationModalState.item || {};
    const options = Array.isArray(readingCombinationModalState.options) ? readingCombinationModalState.options : [];
    const preferred = options[0]?.path || getPreferredReadingSegments(item.reading);
    addReadingToStock(
        item.reading,
        item.baseNickname || '',
        item.tags || [],
        {
            segments: Array.isArray(preferred) ? preferred : [],
            isSuper: !!asSuper,
            gender: item.gender || gender || 'neutral',
            clearHidden: true
        }
    );
    if (typeof showToast === 'function') {
        showToast(
            asSuper ? `${item.reading}を本命として保存しました` : `${item.reading}を候補として保存しました`,
            asSuper ? '⭐' : '💾'
        );
    }

    if (typeof renderReadingStockSection === 'function') {
        renderReadingStockSection();
    }
    if (typeof refreshPartnerAwareUI === 'function') {
        refreshPartnerAwareUI();
    }
}

function renderReadingSwipeCard(item) {
    const preview = getReadingFullNamePreview(item.reading);
    const topLine = preview.ruby && preview.ruby !== item.reading
        ? `<div class="text-[12px] font-bold text-[#8b7e66] mb-2 tracking-wide text-center">${preview.ruby}</div>`
        : '';

    return `
        <div class="w-full px-5 py-6">
        ${topLine}
        ${renderReadingTagBadges(item.tags)}
        <div class="text-[52px] font-black text-[#5d5444] mb-5 tracking-wider leading-tight text-center whitespace-nowrap" style="word-break:normal;overflow-wrap:normal;">${item.reading}</div>
        <div class="w-full mt-2">
            <div class="mx-auto max-w-[286px] rounded-[26px] border px-4 py-3 shadow-[0_10px_24px_rgba(93,84,68,0.08)]"
                style="background:#ffffff;border-color:#ffffff;">
                <p class="text-[10px] text-[#6b6254] text-center mb-3 font-bold tracking-[0.08em]">漢字の例</p>
                <div class="flex justify-center flex-wrap gap-2 text-[#3f382f] font-bold text-base px-2">
                    ${getSampleKanjiHtml(item)}
                </div>
            </div>
        </div>
        </div>
    `;
}function openReadingCombinationModal(item, baseNickname = '', preferredLabel = '', returnTarget = null) {
    closeReadingCombinationModal();

    const modalReading = getReadingBaseReading(item.reading || item.sessionReading || '');
    const displayReading = getReadingDisplayLabel(item);
    const forceSplit = !!item.forceSplit;
    const options = getReadingSegmentOptions(
        modalReading || item.reading,
        4,
        preferredLabel ? { preferredLabel, compoundLimit: 6 } : { compoundLimit: 6 }
    );
    const preview = getReadingFullNamePreview(modalReading || item.reading);
    const tone = getReadingCardTone(item);
    const headerLabel = forceSplit ? '分け方の提案' : '';
    const headerTitle = forceSplit ? 'どの分け方にする？' : displayReading;
    const headerSubtitle = forceSplit ? `${preview.ruby} の分け方を選んでください` : preview.ruby;
    readingCombinationModalState = {
        item: { ...item, reading: modalReading || item.reading, baseNickname },
        options,
        returnTarget: returnTarget || null,
        forceSplit
    };
    readingCombinationModalOpenedAt = Date.now();

    const modal = document.createElement('div');
    modal.id = 'reading-combination-modal';
    modal.className = 'overlay active modal-overlay-dark';
    modal.onclick = (event) => {
        if (event.target === modal) closeReadingCombinationModal();
    };

    modal.innerHTML = `
        <div class="detail-sheet max-w-[440px] border" onclick="event.stopPropagation()" style="background:${tone.surfaceStyle};border-color:${tone.borderColor};">
            <button class="modal-close-x" onclick="closeReadingCombinationModal()">×</button>
            ${returnTarget ? `
            <div class="mb-4">
                <button onclick="event.stopPropagation(); returnToReadingStockFromCombinationModal()" class="inline-flex items-center rounded-full border border-[#eadfce] bg-white px-3 py-1.5 text-[11px] font-bold text-[#8b7e66] active:scale-95">
                    戻る
                </button>
            </div>
            ` : ''}
            <div class="text-center mb-5">
                <h3 class="text-3xl font-black text-[#5d5444] mb-2">${headerTitle}</h3>
                <div class="text-[12px] font-bold text-[#8b7e66]">${headerSubtitle}</div>
                ${forceSplit ? '<div class="mt-2 text-[11px] text-[#a6967a]">候補を選ぶと、その分け方でストックに入ります。</div>' : ''}
            </div>
            ${renderReadingTagBadges(item.tags || [])}
            <div class="flex gap-2 mb-4" style="${forceSplit ? 'display:none;' : ''}">
                <button onclick="event.stopPropagation(); saveReadingOnlyFromModal(false)" class="flex-1 py-3 bg-gradient-to-r from-[#81c995] to-[#a3d9b5] rounded-2xl text-sm font-bold text-white hover:shadow-md transition-all shadow-sm flex items-center justify-center gap-1 active:scale-95"><span>♥</span> 候補</button>
                <button onclick="event.stopPropagation(); saveReadingOnlyFromModal(true)" class="flex-1 py-3 bg-gradient-to-r from-[#8ab4f8] to-[#c5d9ff] rounded-2xl text-sm font-bold text-white hover:shadow-md transition-all shadow-sm flex items-center justify-center gap-1 active:scale-95"><span>★</span> 本命</button>
            </div>
            <div class="space-y-3 max-h-[52vh] overflow-y-auto pr-1">
                ${options.length === 0 ? `
                    <div class="rounded-[28px] border border-[#ede5d8] bg-white p-5 text-center text-sm text-[#8b7e66]">
                        ${forceSplit ? 'この読みでは分け方の候補がまだ見つかりませんでした。' : 'この読みでは候補がまだ見つかりませんでした。'}
                    </div>
                ` : options.map((option, index) => {
                    const candidateHtml = option.candidates.length > 0
                        ? option.candidates.map((candidate, candidateIndex) => `
                        <div class="rounded-2xl border border-[#eee5d8] bg-[#fdfaf5] p-3 flex items-center gap-3">
                            <div class="min-w-0 flex-1">
                                <div class="text-[11px] font-bold text-[#8b7e66] mb-1">${forceSplit ? 'この分け方から出せる候補' : preview.ruby}</div>
                                <div class="text-lg font-black text-[#5d5444]">${candidate.fullName}</div>
                            </div>
                            <button onclick="event.stopPropagation(); saveReadingCandidateFromModal(${index}, ${candidateIndex}, false)" class="shrink-0 px-4 py-2.5 rounded-2xl border-2 border-[#d9c7ab] text-[#8b7e66] font-black text-sm active:scale-95 transition-all whitespace-nowrap">保存</button>
                        </div>
                        `).join('')
                        : '<div class="px-3 py-2 rounded-2xl bg-[#fdfaf5] border border-[#eee5d8] text-xs text-[#a6967a] text-center">候補がまだありません</div>';
                    return `
                        <div class="rounded-[28px] border border-[#ede5d8] bg-white p-4 shadow-sm">
                            <div class="flex items-center justify-between gap-3 mb-3">
                                <div class="text-xl font-black text-[#5d5444]">${option.label}</div>
                                <span class="px-3 py-1 rounded-full bg-[#f7f1e7] text-[#b9965b] text-[10px] font-black">${option.badgeLabel || `${option.path.length}分割`}</span>
                            </div>
                            <div class="grid grid-cols-1 gap-2">${candidateHtml}</div>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;

    document.body.appendChild(modal);
}

function saveReadingCombinationFromModal(index) {
    if (!readingCombinationModalState) return;
    const option = readingCombinationModalState.options[index];
    if (!option || !option.candidates || option.candidates.length === 0) return;
    saveReadingCandidateFromModal(index, 0);
}

function getSampleKanjiHtml(item) {
    const options = getReadingSegmentOptions(item.reading, 4);
    const examples = [];

    options.forEach((option) => {
        sortReadingCandidatesForDisplay(option.candidates).slice(0, 4).forEach((candidate) => {
            const label = candidate.givenName || candidate.fullName;
            if (!examples.includes(label)) {
                examples.push(label);
            }
        });
    });

    if (examples.length === 0) {
        return '<span class="text-xs text-[#d4c5af]">候補なし</span>';
    }

    return examples
        .sort((a, b) => a.length - b.length || a.localeCompare(b, 'ja'))
        .slice(0, 4)
        .map((example) =>
        `<span class="text-sm font-bold mx-1">${example}</span>`
    ).join('');
}

window.closeReadingCombinationModal = closeReadingCombinationModal;
window.saveReadingCandidateFromModal = saveReadingCandidateFromModal;
window.saveReadingOnlyFromModal = saveReadingOnlyFromModal;
window.saveReadingCombinationFromModal = saveReadingCombinationFromModal;
window.getCompoundReadingOptions = getCompoundReadingOptions;
/**
 * ============================================================
 * 漢字検索・フィルター機能（V2 - 読み/画数/分類フィルター）
 * ============================================================
 */
var searchClassFilter = '';  // '', '#自然', etc.
var searchFlexibleMode = false; // false=厳格(完全一致), true=柔軟(音訓前方一致)

function openKanjiSearch() {
    changeScreen('scr-kanji-search');
    searchClassFilter = '';
    searchFlexibleMode = false;
    const input = document.getElementById('kanji-search-input');
    if (input) input.value = '';
    renderSearchFilters();
    updateSearchModeToggle();
    const container = document.getElementById('kanji-search-results');
    if (container) {
        container.innerHTML = '<div class="col-span-4 text-center text-sm text-[#a6967a] py-10">読みまたは漢字で検索するか、<br>分類を選択してください</div>';
    }
}

function toggleSearchFlexibleMode() {
    searchFlexibleMode = !searchFlexibleMode;
    updateSearchModeToggle();
    executeKanjiSearch();
}

function updateSearchModeToggle() {
    const btn = document.getElementById('search-mode-toggle');
    if (!btn) return;
    if (searchFlexibleMode) {
        btn.textContent = '読み柔軟';
        btn.className = 'px-3 py-1.5 rounded-full text-[11px] font-bold bg-[#bca37f] text-white transition-all active:scale-95 flex-shrink-0';
    } else {
        btn.textContent = '読み厳格';
        btn.className = 'px-3 py-1.5 rounded-full text-[11px] font-bold bg-[#5d5444] text-white transition-all active:scale-95 flex-shrink-0';
    }
}

function renderSearchFilters() {
    // Classification filters（実データの分類ハッシュタグと一致させる）
    const classContainer = document.getElementById('search-class-filters');
    if (classContainer) {
        // 05-ui-render.js の KANJI_CATEGORIES と完全一致（15タグ）
        const classes = [
            { val: '', label: '全て', icon: '✨' },
            { val: '#自然', label: '自然', icon: '🌿' },
            { val: '#天空', label: '天空', icon: '☀️' },
            { val: '#水景', label: '水景', icon: '🌊' },
            { val: '#色彩', label: '色彩', icon: '🎨' },
            { val: '#慈愛', label: '慈愛', icon: '💝' },
            { val: '#勇壮', label: '勇壮', icon: '🦁' },
            { val: '#知性', label: '知性', icon: '🎓' },
            { val: '#飛躍', label: '飛躍', icon: '🦅' },
            { val: '#幸福', label: '幸福', icon: '🍀' },
            { val: '#品格', label: '品格', icon: '🕊️' },
            { val: '#希望', label: '希望', icon: '🌟' },
            { val: '#信念', label: '信念', icon: '⛰️' },
            { val: '#調和', label: '調和', icon: '🤝' },
            { val: '#伝統', label: '伝統', icon: '⛩️' },
            { val: '#奏楽', label: '奏楽', icon: '🎵' },
        ];
        classContainer.innerHTML = classes.map(c => `
            <button onclick="setClassFilter('${c.val}')"
                    class="shrink-0 px-3 py-1.5 rounded-full text-[11px] font-bold transition-all
                    ${searchClassFilter === c.val ? 'bg-[#bca37f] text-white' : 'bg-white border border-[#eee5d8] text-[#7a6f5a]'}">
                ${c.icon} ${c.label}
            </button>
        `).join('');
    }
}

function setClassFilter(val) {
    searchClassFilter = val;
    renderSearchFilters();
    executeKanjiSearch();
}

/**
 * 送り仮名対応の読みバリアント抽出
 * 例: "か.わる" → ["かわる", "か"]
 */
/**
 * 厳格モード用: 送り仮名を含む完全形のみ返す（語幹を除外）
 * 例: あ（う） → ['あう']  ※ 語幹の'あ'は含まない
 * 例: か.わる → ['かわる'] ※ 語幹の'か'は含まない
 */
function getFullReadings(rawStr) {
    if (!rawStr) return [];
    return rawStr.split(/[、,，\s/]+/).map(raw => {
        if (!raw.trim()) return null;
        const full = toHira(raw.trim()).replace(/[^ぁ-んー]/g, '');
        return full || null;
    }).filter(Boolean);
}

function getReadingVariants(rawStr) {
    if (!rawStr) return [];
    return rawStr.split(/[、,，\s/]+/).flatMap(raw => {
        if (!raw.trim()) return [];
        const hira = toHira(raw.trim());
        const variants = new Set();
        // 全体（送り仮名マーカーと非ひらがなを除去）
        // 例: あか（るい） → あかるい、あ（かり） → あかり
        const full = hira.replace(/[^ぁ-んー]/g, '');
        if (full) variants.add(full);
        // 語幹: "." より前（例: "か.わる" → "か"）
        const dotIdx = hira.indexOf('.');
        if (dotIdx > 0) {
            const stem = hira.slice(0, dotIdx).replace(/[^ぁ-んー]/g, '');
            if (stem) variants.add(stem);
        }
        // 語幹: "（" より前（例: "あか（るい）" → "あか"、"あ（かり）" → "あ"）
        const parenIdx = hira.indexOf('（');
        if (parenIdx > 0) {
            const stem = hira.slice(0, parenIdx).replace(/[^ぁ-んー]/g, '');
            if (stem) variants.add(stem);
        }
        return [...variants];
    });
}

function executeKanjiSearch() {
    const input = document.getElementById('kanji-search-input');
    const container = document.getElementById('kanji-search-results');
    if (!container) return;

    // masterが未ロードの場合
    if (!master || master.length === 0) {
        container.innerHTML = '<div class="col-span-4 text-center text-sm text-[#a6967a] py-10">漢字データを読み込み中です...</div>';
        return;
    }

    const query = input ? toHira(input.value.trim()) : '';
    const rawQuery = input ? input.value.trim() : '';

    // フィルターが何も設定されていない場合はメッセージ表示
    if (!query && !rawQuery && !searchClassFilter) {
        container.innerHTML = '<div class="col-span-4 text-center text-sm text-[#a6967a] py-10">読みまたは漢字で検索するか、<br>分類を選択してください</div>';
        return;
    }

    let results = master.map(k => {
        // 不適切フラグチェック
        const flag = k['不適切フラグ'];
        if (flag && flag !== '0' && flag !== 'false' && flag !== 'FALSE') return null;

        // 直接検索のときは NOPE 済みでも候補を確認できるようにする
        if (!query && !rawQuery && typeof noped !== 'undefined' && noped.has(k['漢字'])) return null;

        let tier = 99; // 1: Exact, 2: Stem(Flex), 3: Prefix(Flex), 4: OtherMatch
        const matchKanji = k['漢字'] === rawQuery;

        if (query || rawQuery) {
            // 1. 完全一致 (Tier 1) - 送り仮名等を除去した形
            const onFull = getFullReadings(k['音'] || '');
            const kunFull = getFullReadings(k['訓'] || '');
            const noriFull = getFullReadings(k['伝統名のり'] || '');
            const allFull = [...onFull, ...kunFull, ...noriFull];
            const isExact = allFull.some(r => r === query);

            if (isExact || matchKanji) {
                tier = 1;
            } else if (searchFlexibleMode) {
                // 2. 語幹一致 (Tier 2) - 柔軟モードのみ
                const onVariants = getReadingVariants(k['音'] || '');
                const kunVariants = getReadingVariants(k['訓'] || '');
                const isStem = [...onVariants, ...kunVariants].some(r => r === query);

                if (isStem) {
                    tier = 2;
                } else {
                    // 3. 前方一致 (Tier 3) - 柔軟モードのみ
                    const isPrefix = [...onVariants, ...kunVariants].some(r => r.startsWith(query));
                    if (isPrefix) tier = 3;
                }
            }

            // ヒットしない場合は除外
            if (tier === 99) return null;
        }

        // 分類フィルター（テキスト検索がある場合はAND、ない場合は単独フィルター）
        if (searchClassFilter) {
            if (!(k['分類'] || '').includes(searchClassFilter)) return null;
        }

        return { ...k, tier };
    }).filter(Boolean);

    // 漢字の重複排除
    const seenKanji = new Set();
    results = results.filter(k => {
        if (seenKanji.has(k['漢字'])) return false;
        seenKanji.add(k['漢字']);
        return true;
    });

    // ソート: 1. 一致度(Tier), 2. おすすめ度(Score)
    if (typeof calculateKanjiScore === 'function') {
        results.forEach(k => k.score = calculateKanjiScore(k));
    }

    results.sort((a, b) => {
        // Tier優先 (1が最優先)
        if (a.tier !== b.tier) return a.tier - b.tier;
        // 同じTierならスコア順
        return (b.score || 0) - (a.score || 0) || (parseInt(a['画数']) || 0) - (parseInt(b['画数']) || 0);
    });

    // 表示
    if (results.length === 0) {
        container.innerHTML = '<div class="col-span-4 text-center text-sm text-[#a6967a] py-10">該当する漢字がありません</div>';
        return;
    }

    container.innerHTML = '';

    // 結果件数
    const countDiv = document.createElement('div');
    countDiv.className = 'col-span-4 text-center text-[10px] text-[#a6967a] py-2';
    countDiv.innerText = `${results.length}件${results.length > 200 ? '（上位200件表示）' : ''}`;
    container.appendChild(countDiv);

    results.slice(0, 200).forEach(k => {
        const isStocked = liked.some(l => l['漢字'] === k['漢字']);
        const strokes = parseInt(k['画数']) || '?';
        const readings = ((k['音'] || '') + ',' + (k['訓'] || '') + ',' + (k['伝統名のり'] || ''))
            .split(/[、,，\s/]+/)
            .filter(x => clean(x))
            .slice(0, 2);
        // padding-bottom:100% で正方形を確保するラッパー（aspect-ratio はブラウザ依存のため使わない）
        const cell = document.createElement('div');
        cell.style.cssText = 'position:relative; width:100%; padding-bottom:100%;';

        const btn = document.createElement('button');
        btn.className = `absolute inset-0 flex flex-col items-center justify-center overflow-hidden rounded-xl shadow-sm border transition-all active:scale-95
            ${isStocked ? 'border-[#bca37f] bg-[#fffbeb]' : 'bg-white border-[#eee5d8]'}`;
        btn.innerHTML = `
            <span class="text-2xl font-black text-[#5d5444]">${k['漢字']}</span>
            <span class="text-[8px] text-[#a6967a]">${strokes}画</span>
            <span class="text-[7px] text-[#bca37f] truncate w-full text-center px-0.5">${readings.join(',')}</span>
            ${isStocked ? '<span class="absolute top-0.5 right-0.5 text-[8px]">❤️</span>' : ''}
        `;
        // タップで漢字詳細を表示
        btn.onclick = () => {
            if (typeof showKanjiDetail === 'function') showKanjiDetail(k);
            else toggleSearchStock(k, btn);
        };
        cell.appendChild(btn);
        container.appendChild(cell);
    });
}

function toggleSearchStock(k, btn) {
    let isStocked = liked.some(l => l['漢字'] === k['漢字']);
    if (isStocked) {
        let removedCount = 0;
        for (let i = liked.length - 1; i >= 0; i--) {
            if (liked[i]['漢字'] === k['漢字']) {
                liked.splice(i, 1);
                removedCount++;
            }
        }
        btn.classList.remove('bg-[#fffbeb]', 'border-[#bca37f]');
        btn.classList.add('border-[#eee5d8]');
        const heart = btn.querySelector('.absolute');
        if (heart) heart.remove();
        if (removedCount > 0 && typeof MeimayStats !== 'undefined' && MeimayStats.recordKanjiUnlike) {
            MeimayStats.recordKanjiUnlike(k['漢字'], k.gender || gender || 'neutral');
        }
    } else {
        const item = { ...k, slot: -1, sessionReading: 'SEARCH' };
        liked.push(item);
        btn.classList.add('bg-[#fffbeb]', 'border-[#bca37f]');
        btn.classList.remove('border-[#eee5d8]');
        if (!btn.querySelector('.absolute')) {
            btn.insertAdjacentHTML('beforeend', '<span class="absolute top-0.5 right-0.5 text-[8px]">❤️</span>');
        }
        if (typeof MeimayStats !== 'undefined' && MeimayStats.recordKanjiLike) MeimayStats.recordKanjiLike(k['漢字'], k.gender || gender || 'neutral');
    }
    if (typeof StorageBox !== 'undefined' && StorageBox.saveLiked) StorageBox.saveLiked();
}

/**
 * ============================================================
 * AI響き分析（Sound Mode Enhancement）
 * ============================================================
 */
let soundAnalysisLiked = [];
let soundAnalysisNoped = [];

function aiAnalyzeSoundPreferences() {
    if (SwipeState.liked.length < 3) {
        alert('AI分析には3つ以上の「いいね」が必要です');
        return;
    }

    soundAnalysisLiked = SwipeState.liked.map(i => i.reading);
    soundAnalysisNoped = SwipeState.history.filter(h => h.action === 'nope').map(h => h.item.reading);

    // AI分析画面を表示
    const modal = document.getElementById('modal-ai-sound');
    if (!modal) return;

    modal.classList.add('active');
    modal.innerHTML = `
        <div class="detail-sheet max-w-md animate-fade-in" onclick="event.stopPropagation()">
            <button class="modal-close-btn" onclick="closeAISoundModal()">✕</button>
            <div class="text-center py-8">
                <div class="text-[10px] font-black text-[#bca37f] mb-6 tracking-widest uppercase">AI Sound Analysis</div>
                <div class="w-12 h-12 border-4 border-[#eee5d8] border-t-[#bca37f] rounded-full animate-spin mx-auto mb-6"></div>
                <p class="text-sm font-bold text-[#5d5444] mb-2">好みを分析しています...</p>
                <div id="ai-sound-progress" class="text-xs text-[#a6967a] space-y-1 mt-4">
                    <p class="animate-pulse">好きな響きのパターンを解析中...</p>
                </div>
            </div>
        </div>
    `;

    // プログレス更新
    setTimeout(() => {
        const prog = document.getElementById('ai-sound-progress');
        if (prog) prog.innerHTML += '<p class="animate-pulse">音の傾向を分析中...</p>';
    }, 1000);
    setTimeout(() => {
        const prog = document.getElementById('ai-sound-progress');
        if (prog) prog.innerHTML += '<p class="animate-pulse">類似する名前を生成中...</p>';
    }, 2000);

    // AIに分析依頼
    const genderLabel = gender === 'male' ? '男の子' : gender === 'female' ? '女の子' : '中性的';
    const prompt = `
日本の赤ちゃんの名前（${genderLabel}）の響きの好みを分析して、新しい候補を提案してください。

【好きな響き】
${soundAnalysisLiked.join('、')}

${soundAnalysisNoped.length > 0 ? `【好みでない響き】\n${soundAnalysisNoped.join('、')}` : ''}

【回答形式（厳守）】
まず【分析】タグで、好みの傾向を3行程度で分析してください（音の特徴、文字数の傾向、音の柔らかさ/力強さなど）。

次に【候補】タグで、分析に基づいて${gender === 'male' ? '男の子' : gender === 'female' ? '女の子' : ''}の新しい名前の読みを10個、以下の形式で1行ずつ提案してください：
読み|文字数|特徴の一言説明

例：
そうすけ|4|力強く古風な響き

【注意】好きな響きと重複しない新しい候補を出してください。
`.trim();

    fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
    })
        .then(res => res.json())
        .then(data => {
            const aiText = data.text || '';
            parseAndShowAISoundResults(aiText);
        })
        .catch(err => {
            console.error("AI_SOUND:", err);
            modal.innerHTML = `
            <div class="detail-sheet max-w-md" onclick="event.stopPropagation()">
                <button class="modal-close-btn" onclick="closeAISoundModal()">✕</button>
                <div class="text-center py-8">
                    <p class="text-sm text-[#f28b82] mb-4">AI分析に失敗しました</p>
                    <p class="text-xs text-[#a6967a]">${err.message}</p>
                    <button onclick="closeAISoundModal()" class="btn-gold mt-6 py-3 px-8">閉じる</button>
                </div>
            </div>
        `;
        });
}

function parseAndShowAISoundResults(aiText) {
    const modal = document.getElementById('modal-ai-sound');
    if (!modal) return;

    // 分析テキストを抽出
    let analysis = '';
    let candidates = [];

    const analysisMatch = aiText.match(/【分析】([\s\S]*?)(?=【候補】|$)/);
    if (analysisMatch) analysis = analysisMatch[1].trim();

    const candidatesMatch = aiText.match(/【候補】([\s\S]*?)$/);
    if (candidatesMatch) {
        const lines = candidatesMatch[1].trim().split('\n').filter(l => l.trim());
        lines.forEach(line => {
            const parts = line.split('|').map(p => p.trim());
            if (parts.length >= 2) {
                candidates.push({
                    reading: parts[0].replace(/[・、。]/g, ''),
                    charCount: parts[1] || '',
                    desc: parts[2] || ''
                });
            }
        });
    }

    // フォールバック：候補が取れなかった場合はテキスト全体から読みを抽出
    if (candidates.length === 0) {
        const namePattern = /([ぁ-ん]{2,6})/g;
        let match;
        const seen = new Set(soundAnalysisLiked);
        while ((match = namePattern.exec(aiText)) !== null) {
            if (!seen.has(match[1]) && candidates.length < 10) {
                candidates.push({ reading: match[1], charCount: String(match[1].length), desc: '' });
                seen.add(match[1]);
            }
        }
    }

    modal.innerHTML = `
        <div class="detail-sheet max-w-md max-h-[85vh] overflow-y-auto" onclick="event.stopPropagation()">
            <button class="modal-close-btn" onclick="closeAISoundModal()">✕</button>
            <div class="text-[10px] font-black text-[#bca37f] mb-4 tracking-widest uppercase text-center">AI Analysis Result</div>

            ${analysis ? `
                <div class="bg-[#fdfaf5] border border-[#eee5d8] rounded-2xl p-4 mb-6">
                    <p class="text-xs font-bold text-[#8b7e66] mb-2">あなたの好みの傾向</p>
                    <p class="text-xs text-[#5d5444] leading-relaxed whitespace-pre-wrap">${analysis}</p>
                </div>
            ` : ''}

            <p class="text-xs font-bold text-[#8b7e66] mb-3">AIおすすめの響き（${candidates.length}件）</p>
            <div class="space-y-2 mb-6" id="ai-sound-candidates">
                ${candidates.map((c, i) => `
                    <div class="flex items-center gap-3 bg-white rounded-xl border border-[#eee5d8] p-3 transition-all hover:border-[#bca37f]">
                        <div class="flex-1">
                            <div class="text-lg font-black text-[#5d5444]">${c.reading}</div>
                            <div class="text-[10px] text-[#a6967a]">${c.charCount}文字 ${c.desc ? '・ ' + c.desc : ''}</div>
                        </div>
                        <button onclick="useAISoundReading('${c.reading}', this)"
                                class="px-3 py-1.5 bg-[#bca37f] text-white rounded-full text-xs font-bold hover:bg-[#8b7e66] transition-all active:scale-95">
                            この読みで探す
                        </button>
                    </div>
                `).join('')}
            </div>

            <button onclick="closeAISoundModal()" class="btn-gold py-4 w-full">閉じる</button>
        </div>
    `;
}

function useAISoundReading(reading, btn) {
    closeAISoundModal();
    proceedWithSoundReading(reading);
}

function closeAISoundModal() {
    const modal = document.getElementById('modal-ai-sound');
    if (modal) modal.classList.remove('active');
}

/**
 * AI自由モード提案
 */
function aiSuggestFreeKanji() {
    const freeLiked = liked.filter(l => l.sessionReading === 'FREE');
    if (freeLiked.length < 2) {
        alert('AI提案には2つ以上のストックが必要です');
        return;
    }

    const modal = document.getElementById('modal-ai-sound');
    if (!modal) return;

    modal.classList.add('active');
    modal.innerHTML = `
        <div class="detail-sheet max-w-md animate-fade-in" onclick="event.stopPropagation()">
            <button class="modal-close-btn" onclick="closeAISoundModal()">✕</button>
            <div class="text-center py-8">
                <div class="w-12 h-12 border-4 border-[#eee5d8] border-t-[#bca37f] rounded-full animate-spin mx-auto mb-6"></div>
                <p class="text-sm font-bold text-[#5d5444] mb-2">好みの漢字を分析中...</p>
            </div>
        </div>
    `;

    const likedKanji = freeLiked.map(l => `${l['漢字']}（${clean(l['意味']).substring(0, 15)}）`).join('、');
    const genderLabel = gender === 'male' ? '男の子' : gender === 'female' ? '女の子' : '中性的';

    const prompt = `
${genderLabel}の名前に使う漢字を提案してください。

【ユーザーが気に入った漢字】
${likedKanji}

以下の形式で、上記の傾向に合う新しい漢字を10個提案してください。
ユーザーが既に選んだ漢字と重複しないこと。
実在する常用漢字または人名用漢字のみ使用してください。

【回答形式（厳守）】
1行に1つ、以下の形式で：
漢字|画数|簡単な意味の説明（10文字以内）
`.trim();

    fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
    })
        .then(res => res.json())
        .then(data => {
            const lines = (data.text || '').split('\n').filter(l => l.includes('|'));
            const suggestions = lines.map(l => {
                const parts = l.split('|').map(p => p.trim());
                return { kanji: parts[0], strokes: parts[1], desc: parts[2] || '' };
            }).filter(s => s.kanji && s.kanji.length === 1);

            modal.innerHTML = `
            <div class="detail-sheet max-w-md max-h-[85vh] overflow-y-auto" onclick="event.stopPropagation()">
                <button class="modal-close-btn" onclick="closeAISoundModal()">✕</button>
                <div class="text-[10px] font-black text-[#bca37f] mb-4 tracking-widest uppercase text-center">AI Kanji Suggestion</div>
                <p class="text-xs text-[#8b7e66] font-bold mb-3">あなたの好みに近い漢字（${suggestions.length}件）</p>
                <div class="space-y-2 mb-6">
                    ${suggestions.map(s => {
                const inMaster = master.find(m => m['漢字'] === s.kanji);
                const isStocked = liked.some(l => l['漢字'] === s.kanji);
                return `
                        <div class="flex items-center gap-3 bg-white rounded-xl border ${isStocked ? 'border-[#bca37f] bg-[#fffbeb]' : 'border-[#eee5d8]'} p-3">
                            <div class="text-3xl font-black text-[#5d5444] w-12 text-center">${s.kanji}</div>
                            <div class="flex-1">
                                <div class="text-xs text-[#a6967a]">${s.strokes || ''}画 ・ ${s.desc}</div>
                            </div>
                            <button onclick="stockAISuggestion('${s.kanji}', this)"
                                class="px-3 py-1.5 ${isStocked ? 'bg-[#fef2f2] text-[#f28b82]' : 'bg-[#bca37f] text-white'} rounded-full text-xs font-bold transition-all active:scale-95">
                                ${isStocked ? '解除' : 'ストック'}
                            </button>
                        </div>
                        `;
            }).join('')}
                </div>
                <button onclick="closeAISoundModal()" class="btn-gold py-4 w-full">閉じる</button>
            </div>
        `;
        })
        .catch(err => {
            modal.innerHTML = `
            <div class="detail-sheet max-w-md" onclick="event.stopPropagation()">
                <button class="modal-close-btn" onclick="closeAISoundModal()">✕</button>
                <p class="text-sm text-[#f28b82] text-center py-8">AI提案に失敗しました</p>
            </div>
        `;
        });
}

function stockAISuggestion(kanji, btn) {
    let isStocked = liked.some(l => l['漢字'] === kanji);
    if (isStocked) {
        let removedCount = 0;
        for (let i = liked.length - 1; i >= 0; i--) {
            if (liked[i]['漢字'] === kanji) {
                liked.splice(i, 1);
                removedCount++;
            }
        }
        btn.innerText = 'ストック';
        btn.className = 'px-3 py-1.5 bg-[#bca37f] text-white rounded-full text-xs font-bold transition-all active:scale-95';
        btn.closest('.flex').classList.remove('border-[#bca37f]', 'bg-[#fffbeb]');
        btn.closest('.flex').classList.add('border-[#eee5d8]');
        if (removedCount > 0 && typeof MeimayStats !== 'undefined' && MeimayStats.recordKanjiUnlike) {
            MeimayStats.recordKanjiUnlike(kanji, found?.gender || gender || 'neutral');
        }
    } else {
        const found = master.find(m => m['漢字'] === kanji);
        if (found) {
            liked.push({ ...found, slot: -1, sessionReading: 'FREE' });
            if (typeof MeimayStats !== 'undefined' && MeimayStats.recordKanjiLike) MeimayStats.recordKanjiLike(kanji, found.gender || gender || 'neutral');
        }
        btn.innerText = '解除';
        btn.className = 'px-3 py-1.5 bg-[#fef2f2] text-[#f28b82] rounded-full text-xs font-bold transition-all active:scale-95';
        btn.closest('.flex').classList.add('border-[#bca37f]', 'bg-[#fffbeb]');
        btn.closest('.flex').classList.remove('border-[#eee5d8]');
    }
    if (typeof StorageBox !== 'undefined' && StorageBox.saveLiked) StorageBox.saveLiked();
}

/**
 * ============================================================
 * アキネーター風AI漢字提案
 * ============================================================
 */
let akinatorAnswers = [];
let akinatorStep = 0;

const akinatorQuestions = [
    { q: 'どんな印象の名前がいいですか？', options: ['力強い', 'やさしい', '知的', '華やか'] },
    { q: '自然を連想するなら？', options: ['空・光', '水・海', '山・大地', '花・植物'] },
    { q: '名前に込めたい願いは？', options: ['健康・長寿', '成功・繁栄', '愛・絆', '自由・冒険'] },
    { q: '音の響きは？', options: ['柔らかい音', '力強い音', '古風な響き', 'モダンな響き'] },
    { q: '画数の好みは？', options: ['少ない(1-8画)', '普通(9-14画)', '多い(15画以上)', 'こだわりなし'] }
];

function openAkinator() {
    akinatorAnswers = [];
    akinatorStep = 0;
    renderAkinatorStep();
    changeScreen('scr-akinator');
}

function renderAkinatorStep() {
    const container = document.getElementById('akinator-content');
    if (!container) return;

    if (akinatorStep >= akinatorQuestions.length) {
        // 全質問回答済み→AI分析
        executeAkinatorAI();
        return;
    }

    const q = akinatorQuestions[akinatorStep];
    const progress = ((akinatorStep + 1) / akinatorQuestions.length * 100).toFixed(0);

    container.innerHTML = `
        <div class="text-center mb-8">
            <div class="w-full bg-[#eee5d8] rounded-full h-2 mb-4">
                <div class="bg-[#bca37f] h-2 rounded-full transition-all" style="width: ${progress}%"></div>
            </div>
            <p class="text-[10px] text-[#a6967a] mb-1">質問 ${akinatorStep + 1} / ${akinatorQuestions.length}</p>
        </div>
        <h3 class="text-lg font-bold text-[#5d5444] text-center mb-8">${q.q}</h3>
        <div class="grid grid-cols-2 gap-3">
            ${q.options.map((opt, i) => `
                <button onclick="answerAkinator('${opt}')"
                    class="p-4 bg-white rounded-2xl border-2 border-[#eee5d8] text-sm font-bold text-[#5d5444] hover:border-[#bca37f] hover:bg-[#fffbeb] transition-all active:scale-95">
                    ${opt}
                </button>
            `).join('')}
        </div>
        ${akinatorStep > 0 ? `<button onclick="akinatorBack()" class="mt-6 text-xs text-[#a6967a] mx-auto block">← 前の質問に戻る</button>` : ''}
    `;
}

function answerAkinator(answer) {
    akinatorAnswers[akinatorStep] = answer;
    akinatorStep++;
    renderAkinatorStep();
}

function akinatorBack() {
    if (akinatorStep > 0) {
        akinatorStep--;
        renderAkinatorStep();
    }
}

function executeAkinatorAI() {
    const container = document.getElementById('akinator-content');
    if (!container) return;

    container.innerHTML = `
        <div class="text-center py-12">
            <div class="w-12 h-12 border-4 border-[#eee5d8] border-t-[#bca37f] rounded-full animate-spin mx-auto mb-6"></div>
            <p class="text-sm font-bold text-[#5d5444] mb-2">AIがおすすめ漢字を選んでいます...</p>
            <div class="text-xs text-[#a6967a] space-y-1 mt-4">
                <p class="animate-pulse">回答を分析中...</p>
            </div>
        </div>
    `;

    const genderLabel = gender === 'male' ? '男の子' : gender === 'female' ? '女の子' : '中性的';
    const answersText = akinatorQuestions.map((q, i) => `${q.q} → ${akinatorAnswers[i]}`).join('\n');

    const prompt = `
${genderLabel}の赤ちゃんの名前に使う漢字を提案してください。

【ユーザーの好み】
${answersText}

【回答ルール - 厳守】
- 実在する常用漢字または人名用漢字のみ使用
- 架空の漢字や存在しない読みは絶対に出さない
- 各漢字は実際にその読み方・画数で使われるものだけ

以下の形式で10個の漢字を提案してください：

【おすすめ】タグの後、1行1つずつ：
漢字|読み例|画数|おすすめ理由（15文字以内）

例：
陽|はる、ひなた|12|明るく温かい印象
`.trim();

    fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
    })
        .then(res => res.json())
        .then(data => {
            const text = data.text || '';
            const lines = text.split('\n').filter(l => l.includes('|'));
            const suggestions = lines.map(l => {
                const parts = l.split('|').map(p => p.trim());
                return { kanji: parts[0], reading: parts[1] || '', strokes: parts[2] || '', desc: parts[3] || '' };
            }).filter(s => s.kanji && s.kanji.length === 1);

            container.innerHTML = `
            <div class="text-center mb-6">
                <div class="text-[10px] font-black text-[#bca37f] tracking-widest uppercase mb-2">AI Recommendation</div>
                <p class="text-sm text-[#5d5444] font-bold">あなたにおすすめの漢字</p>
            </div>
            <div class="space-y-2 mb-6">
                ${suggestions.map(s => {
                const inMaster = master.find(m => m['漢字'] === s.kanji);
                const isStocked = liked.some(l => l['漢字'] === s.kanji);
                return `
                    <div class="flex items-center gap-3 bg-white rounded-xl border ${isStocked ? 'border-[#bca37f] bg-[#fffbeb]' : 'border-[#eee5d8]'} p-3">
                        <div class="text-3xl font-black text-[#5d5444] w-12 text-center">${s.kanji}</div>
                        <div class="flex-1 min-w-0">
                            <div class="text-xs font-bold text-[#5d5444]">${s.reading}</div>
                            <div class="text-[10px] text-[#a6967a]">${s.strokes}画 ・ ${s.desc}</div>
                        </div>
                        <button onclick="stockAISuggestion('${s.kanji}', this)"
                            class="shrink-0 px-3 py-1.5 ${isStocked ? 'bg-[#fef2f2] text-[#f28b82]' : 'bg-[#bca37f] text-white'} rounded-full text-xs font-bold transition-all active:scale-95">
                            ${isStocked ? '解除' : 'ストック'}
                        </button>
                    </div>
                    `;
            }).join('')}
            </div>
            <div class="flex gap-3">
                <button onclick="akinatorStep=0;akinatorAnswers=[];renderAkinatorStep()" class="flex-1 py-3 border border-[#d4c5af] rounded-2xl text-sm text-[#a6967a] font-bold">もう一度</button>
                <button onclick="changeScreen('scr-mode')" class="flex-1 py-3 bg-[#bca37f] text-white rounded-2xl font-bold text-sm">ホームへ</button>
            </div>
        `;
        })
        .catch(err => {
            container.innerHTML = `<p class="text-sm text-[#f28b82] text-center py-8">AI提案に失敗しました: ${err.message}</p>
            <button onclick="changeScreen('scr-mode')" class="btn-gold py-3 w-full mt-4">ホームへ</button>`;
        });
}

window.openKanjiSearch = openKanjiSearch;
window.initSoundMode = initSoundMode;
window.initAdanaMode = initAdanaMode;
window.initSoundModeEntry = initSoundModeEntry;
window.selectSoundEntryMode = selectSoundEntryMode;
window.updateSoundEntryModeUI = updateSoundEntryModeUI;
window.submitSoundEntry = submitSoundEntry;
window.proceedWithSoundReading = proceedWithSoundReading;
window.setClassFilter = setClassFilter;
window.toggleSearchFlexibleMode = toggleSearchFlexibleMode;
window.executeKanjiSearch = executeKanjiSearch;
window.toggleSearchStock = toggleSearchStock;
window.aiAnalyzeSoundPreferences = aiAnalyzeSoundPreferences;
window.closeAISoundModal = closeAISoundModal;
window.useAISoundReading = useAISoundReading;
window.aiSuggestFreeKanji = aiSuggestFreeKanji;
window.stockAISuggestion = stockAISuggestion;
window.openAkinator = openAkinator;
window.answerAkinator = answerAkinator;
window.akinatorBack = akinatorBack;
window.renderAkinatorStep = renderAkinatorStep;
window.getEncounteredLibrary = getEncounteredLibrary;
window.updateEncounteredLibraryEntry = updateEncounteredLibraryEntry;

console.log("UI_FLOW: Module loaded (V19 - Free Swipe, AI Learning, Akinator)");

function likePartnerReadingStock(index) {
    const pairInsights = typeof window.MeimayPartnerInsights !== 'undefined' ? window.MeimayPartnerInsights : null;
    const partnerReadings = pairInsights?.getPartnerReadingStock ? pairInsights.getPartnerReadingStock() : [];
    if (index < 0 || index >= partnerReadings.length) return;

    const item = partnerReadings[index];
    if (!item) return;

    if (typeof openReadingCombinationModal === 'function') {
        openReadingCombinationModal({
            ...item,
            reading: getReadingBaseReading(item.reading || ''),
            segments: [],
            forceSplit: true
        }, item.baseNickname || '', '');
        return;
    }
}


window.likePartnerReadingStock = likePartnerReadingStock;
window.renderReadingStockSection = renderReadingStockSection;

function clearReadingPartnerFocus() {
    if (typeof window.resetMeimayPartnerViewFocus === 'function') {
        window.resetMeimayPartnerViewFocus(['readingFocus']);
    } else if (typeof window.setMeimayPartnerViewFocus === 'function') {
        window.setMeimayPartnerViewFocus({ readingFocus: 'all' });
    }
    renderReadingStockSection();
}

function renderReadingStockSection() {
    if (typeof renderReadingStockSectionVisible === 'function') return renderReadingStockSectionVisible();
    const pendingStock = getReadingStock();
    const section = document.getElementById('reading-stock-section');
    if (!section) return;

    const history = typeof getReadingHistory === 'function' ? getReadingHistory() : [];
    const readingToSegments = {};
    history.forEach(h => {
        const historyKey = getReadingStockKey(h.reading, h.segments || []);
        readingToSegments[historyKey] = h.segments;
        if (!readingToSegments[h.reading]) readingToSegments[h.reading] = h.segments;
    });

    let removedList = [];
    try { removedList = JSON.parse(localStorage.getItem('meimay_hidden_readings') || '[]'); } catch (e) { }

    const ownLiked = getVisibleOwnLikedReadingsForUI();
    const completedReadings = [...new Set(
        ownLiked
            .filter(item =>
                item.sessionReading &&
                item.sessionReading !== 'FREE' &&
                item.sessionReading !== 'SEARCH' &&
                item.slot >= 0 &&
                !removedReadingSet.has(getReadingBaseReading(item.sessionReading))
            )
            .map(item => getReadingBaseReading(item.sessionReading))
    )];

    const pendingOnly = pendingStock.filter(item =>
        !completedReadings.includes(getReadingBaseReading(item.reading)) &&
        !removedReadingSet.has(getReadingBaseReading(item.reading))
    );
    const pairInsights = typeof window.MeimayPartnerInsights !== 'undefined' ? window.MeimayPartnerInsights : null;
    const partnerReadings = pairInsights?.getPartnerReadingStock ? pairInsights.getPartnerReadingStock() : [];
    const partnerReadingCollection = pairInsights?.getPartnerReadingCollection ? pairInsights.getPartnerReadingCollection() : partnerReadings;
    const partnerReadingByReading = new Map();
    partnerReadingCollection.forEach(item => {
        const normalizedReading = getPartnerViewNormalizedReading(item?.reading, pairInsights);
        if (normalizedReading && !partnerReadingByReading.has(normalizedReading)) partnerReadingByReading.set(normalizedReading, item);
    });
    const matchedReadingValues = new Set(
        (pairInsights?.getMatchedReadingItems ? pairInsights.getMatchedReadingItems() : [])
            .map(item => getPartnerViewNormalizedReading(item?.reading, pairInsights))
            .filter(Boolean)
    );
    const partnerPendingCards = partnerReadings
        .map((item, originalIndex) => ({ item, originalIndex }))
        .filter(({ item }) => {
            const normalizedReading = getPartnerViewNormalizedReading(item?.reading, pairInsights);
            return normalizedReading ? !matchedReadingValues.has(normalizedReading) : true;
        });
    const partnerViewState = typeof window.getMeimayPartnerViewState === 'function'
        ? window.getMeimayPartnerViewState()
        : { readingFocus: 'all' };
    const readingFocus = partnerViewState.readingFocus || 'all';
    const partnerName = pairInsights?.getPartnerDisplayName
        ? pairInsights.getPartnerDisplayName()
        : (typeof getPartnerRoleLabel === 'function'
            ? getPartnerRoleLabel(MeimayShare?.partnerSnapshot?.role)
            : 'パートナー');

    const showOwnSections = readingFocus !== 'partner';
    const visibleCompleted = showOwnSections ? completedReadings : [];
    const visiblePendingOnly = showOwnSections ? pendingOnly : [];
    const visiblePartnerReadings = partnerPendingCards;

    const hasContent = visibleCompleted.length > 0 || visiblePendingOnly.length > 0 || visiblePartnerReadings.length > 0;
    const emptyMsg = document.getElementById('reading-stock-empty');
    if (emptyMsg) emptyMsg.classList.toggle('hidden', hasContent || readingFocus === 'partner');

    if (!hasContent) {
        if (readingFocus === 'partner') {
            section.innerHTML = `
                <div class="text-center py-16 text-sm text-[#a6967a]">
                    <div class="text-4xl mb-4 opacity-50">🤝</div>
                    <p>${partnerName}から届いている読み候補はまだありません</p>
                    <button onclick="clearReadingPartnerFocus()" class="mt-4 inline-flex items-center rounded-full border border-[#eadfce] bg-white px-4 py-2 text-[11px] font-bold text-[#8b7e66] active:scale-95">
                        通常表示に戻る
                    </button>
                </div>
            `;
        } else {
            section.innerHTML = '';
        }
        return;
    }

    let html = '';

    if (readingFocus === 'partner') {
        html += `
            <div class="rounded-2xl border border-[#f4d3cf] bg-[#fff8f6] px-4 py-3 mb-4">
                <div class="flex items-center justify-between gap-3">
                    <div>
                        <div class="text-[10px] font-black tracking-[0.18em] text-[#dd7d73] uppercase">Partner</div>
                        <div class="mt-1 text-sm font-bold text-[#4f4639]">${partnerName}の読み候補</div>
                        <div class="mt-1 text-[11px] text-[#8b7e66]">いいねした読みだけ、自分の読みストックに追加されます。</div>
                    </div>
                    <button onclick="clearReadingPartnerFocus()" class="shrink-0 rounded-full border border-[#f0d0cb] bg-white px-3 py-1.5 text-[11px] font-bold text-[#8b7e66] active:scale-95">
                        通常表示
                    </button>
                </div>
            </div>
        `;
    }

    if (visibleCompleted.length > 0) {
        html += `<div class="mb-6">
            <div class="text-xs font-black text-[#bca37f] mb-3 tracking-wider uppercase">漢字を選んだ読み</div>
            <div class="space-y-2">`;

        visibleCompleted.forEach(reading => {
            const kanjiCount = ownLiked.filter(i => i.sessionReading === reading && i.slot >= 0).length;
            const segs = readingToSegments[reading];
            const display = segs ? segs.join('/') : reading;
            const normalizedReading = getPartnerViewNormalizedReading(reading, pairInsights);
            const partnerItem = partnerReadingByReading.get(normalizedReading) || null;
            const kind = (partnerItem || matchedReadingValues.has(normalizedReading)) ? 'matched' : 'self';
            const tone = getReadingCardToneV2(kind);
            const stars = renderReadingCardStarsV2(false, partnerItem?.isSuper);
            html += `
                <div class="rounded-2xl p-3 flex items-center gap-3 hover:-translate-y-[1px] transition-all cursor-pointer active:scale-[0.98]"
                     style="${tone.card}"
                     onclick="openReadingStockModal('${reading}')">
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-2">
                            ${stars}
                            <div class="text-lg font-black leading-tight" style="color:${tone.title}">${display}</div>
                        </div>
                        <div class="text-[9px]" style="color:${tone.sub}">${kanjiCount}件の漢字</div>
                    </div>
                    <button onclick="event.stopPropagation(); openBuildFromReading('${reading}')"
                        class="text-xs font-bold px-4 py-2 rounded-full whitespace-nowrap transition-all active:scale-95 shadow-sm"
                        style="${tone.action}">
                        漢字を選ぶ
                    </button>
                </div>`;
        });

        html += `</div></div>`;
    }

    if (visiblePendingOnly.length > 0) {
        const groups = {};
        visiblePendingOnly.forEach(item => {
            const key = item.baseNickname || '響きからの読み';
            if (!groups[key]) groups[key] = [];
            groups[key].push(item);
        });

        html += `<div class="mb-5">
            <div class="text-xs font-black text-[#a6967a] mb-3 tracking-wider uppercase">漢字を選んでいない読み</div>`;

        Object.keys(groups).forEach(groupName => {
            const items = groups[groupName];
            html += `<div class="mb-3">
                <div class="text-[10px] text-[#bca37f] mb-1">${groupName}</div>
                <div class="space-y-2">
                    ${items.map(item => {
                        const display = getReadingDisplayLabel(item);
                        const normalizedReading = getPartnerViewNormalizedReading(item?.reading, pairInsights);
                        const partnerItem = partnerReadingByReading.get(normalizedReading) || null;
                        const kind = (partnerItem || matchedReadingValues.has(normalizedReading)) ? 'matched' : 'self';
                        const tone = getReadingCardToneV2(kind);
                        const stars = renderReadingCardStarsV2(item.isSuper, partnerItem?.isSuper);
                        return `
                        <div class="rounded-2xl p-3 flex items-center gap-3 hover:-translate-y-[1px] transition-all cursor-pointer" style="${tone.card}" onclick="openReadingStockModal(${JSON.stringify(String(item.reading || ''))})">
                            <div class="flex-1 min-w-0">
                                <div class="flex items-center gap-2">
                                    ${stars}
                                    <div class="text-lg font-black leading-tight" style="color:${tone.title}">${display}</div>
                                </div>
                            </div>
                            <button onclick="event.stopPropagation(); openBuildFromReading(${JSON.stringify(String(item.reading || ''))})" class="shrink-0 px-4 py-2 rounded-full text-xs font-bold text-white whitespace-nowrap shadow-sm active:scale-95 transition-all" style="${tone.action}">漢字を選ぶ</button>
                            <button onclick='event.stopPropagation(); removeReadingFromStock(${JSON.stringify(item.id)});renderReadingStockSection()' class="shrink-0 text-sm p-2 rounded-full hover:bg-[#fef2f2] hover:text-[#f28b82]" style="color:${tone.sub}">✕</button>
                        </div>`;
                    }).join('')}
                </div>
            </div>`;
        });

        html += `</div>`;
    }

    if (visiblePartnerReadings.length > 0) {
        html += `<div class="mb-5">
            <div class="text-xs font-black text-[#dd7d73] mb-3 tracking-wider uppercase">${partnerName}の読み候補</div>
            <div class="space-y-2">
                ${visiblePartnerReadings.map(entry => {
                    const item = entry.item;
                    const display = getReadingDisplayLabel(item);
                    const tone = getReadingCardToneV2('partner');
                    const stars = renderReadingCardStarsV2(false, item.isSuper);
                    return `
                        <div class="rounded-2xl p-3 flex items-center gap-3" style="${tone.card}">
                            <div class="flex-1 min-w-0">
                                <div class="flex items-center gap-2">
                                    ${stars}
                                    <div class="text-lg font-black leading-tight" style="color:${tone.title}">${display}</div>
                                </div>
                            </div>
                            <button onclick="likePartnerReadingStock(${entry.originalIndex})" class="shrink-0 px-4 py-2 rounded-full text-[11px] font-bold shadow-sm active:scale-95 whitespace-nowrap" style="${tone.action}">
                                取り込む
                            </button>
                        </div>`;
                }).join('')}
            </div>
        </div>`;
    }

    section.innerHTML = html;
}

window.clearReadingPartnerFocus = clearReadingPartnerFocus;
window.renderReadingStockSection = renderReadingStockSection;

function getPartnerViewReadingKey(item, pairInsights) {
    const reading = getReadingBaseReading(item?.reading || item?.sessionReading || '');
    const segments = Array.isArray(item?.segments) ? item.segments : [];
    if (pairInsights?.buildReadingStockKey) return pairInsights.buildReadingStockKey({ ...item, reading, segments });
    return getReadingStockKey(reading, segments);
}

function getPartnerViewNormalizedReading(value, pairInsights) {
    if (pairInsights?.normalizeReading) return pairInsights.normalizeReading(getReadingBaseReading(value));
    const raw = getReadingBaseReading(value);
    if (!raw) return '';
    return (typeof toHira === 'function' ? toHira(raw) : raw).replace(/\s+/g, '');
}

function getReadingOwnershipPaletteFallback(kind) {
    const myRole = typeof MeimayPairing !== 'undefined' ? MeimayPairing.myRole : null;
    const resolvedSelfRole = (myRole === 'mama' || myRole === 'papa') ? myRole : 'papa';
    const shareState = typeof MeimayShare !== 'undefined'
        ? MeimayShare
        : (typeof window !== 'undefined' ? window.MeimayShare : null);
    const partnerRole = shareState?.partnerSnapshot?.role;
    const resolvedPartnerRole = (partnerRole === 'mama' || partnerRole === 'papa')
        ? partnerRole
        : (resolvedSelfRole === 'mama' ? 'papa' : 'mama');

    const getRolePalette = (role) => role === 'mama'
        ? {
            accent: '#f2a2b8',
            accentStrong: '#dc7f9c',
            accentSoft: '#fef0f5',
            surface: '#fff8fb',
            mist: '#fff5f8',
            border: '#f7dbe5',
            text: '#8e6170',
            shadow: 'rgba(242, 162, 184, 0.14)',
            star: '#ea89a7'
        }
        : {
            accent: '#8fbff8',
            accentStrong: '#5f98de',
            accentSoft: '#eff7ff',
            surface: '#f8fbff',
            mist: '#f3f8ff',
            border: '#d9e8ff',
            text: '#59779d',
            shadow: 'rgba(143, 191, 248, 0.14)',
            star: '#6ea9ef'
        };

    const selfBase = getRolePalette(resolvedSelfRole);
    const partnerBase = getRolePalette(resolvedPartnerRole);
    const self = {
        ...selfBase,
        surface: `linear-gradient(to bottom right, ${selfBase.mist} 0%, ${selfBase.accentSoft} 28%, #ffffff 100%)`
    };
    const partner = {
        ...partnerBase,
        surface: `linear-gradient(to top left, ${partnerBase.mist} 0%, ${partnerBase.accentSoft} 28%, #ffffff 100%)`
    };
    const matched = {
        accent: self.accent,
        accentStrong: self.accentStrong,
        accentAlt: partner.accent,
        border: resolvedSelfRole === 'mama' ? '#f5c7d6' : '#c6dcff',
        borderAlt: resolvedPartnerRole === 'mama' ? '#f5c7d6' : '#c6dcff',
        surface: `linear-gradient(135deg, ${resolvedSelfRole === 'mama' ? '#ffe8ef' : '#e7f3ff'} 0%, #fffdfb 44%, ${resolvedPartnerRole === 'mama' ? '#ffe8ef' : '#e7f3ff'} 100%)`,
        text: '#7d6671',
        shadow: 'rgba(189, 166, 204, 0.18)'
    };

    if (kind === 'partner') return partner;
    if (kind === 'matched') return matched;
    return self;
}

function getReadingCardToneV2(kind) {
    let palette = typeof window.getMeimayOwnershipPalette === 'function'
        ? window.getMeimayOwnershipPalette(kind)
        : getReadingOwnershipPaletteFallback(kind);
    if (!palette) palette = getReadingOwnershipPaletteFallback(kind);
    if (!palette) {
        return {
            card: 'border:1px solid #ede5d8;background:#fff;',
            title: '#5d5444',
            sub: '#a6967a',
            tagBg: '#f7f1e7',
            tagColor: '#8b7e66',
            action: 'background:#bca37f;color:#fff;',
            actionGhost: 'border:1px solid #eadfce;background:#fff;color:#8b7e66;'
        };
    }
    if (kind === 'matched') {
        const pairPalettes = typeof window.getMeimayRelationshipPalettes === 'function'
            ? window.getMeimayRelationshipPalettes()
            : { self: palette, partner: palette };
        return {
            card: `border:1px solid transparent;background:${palette.surface} padding-box, linear-gradient(135deg, ${palette.border} 0%, ${palette.borderAlt} 100%) border-box;`,
            title: '#5d5444',
            sub: '#846d78',
            tagBg: 'rgba(255,255,255,0.82)',
            tagColor: '#7d6671',
            action: `background:linear-gradient(135deg, ${pairPalettes.self.accentStrong} 0%, ${pairPalettes.partner.accentStrong} 100%);color:#fff;`,
            actionGhost: 'border:1px solid rgba(255,255,255,0.78);background:rgba(255,255,255,0.84);color:#7d6671;'
        };
    }
    return {
        card: `border:1px solid ${palette.border};background:${palette.surface};`,
        title: '#5d5444',
        sub: palette.text || '#8b7e66',
        tagBg: 'rgba(255,255,255,0.82)',
        tagColor: palette.text || '#8b7e66',
        action: `background:${palette.accentStrong || palette.accent};color:#fff;`,
        actionGhost: `border:1px solid ${palette.border};background:rgba(255,255,255,0.82);color:${palette.text || '#8b7e66'};`
    };
}

function renderReadingCardStarsV2(selfSuper, partnerSuper) {
    if (typeof window.renderMeimaySuperStars !== 'function') {
        return selfSuper || partnerSuper ? '<div class="text-[12px] leading-none text-[#fbbc04]">★</div>' : '';
    }
    return window.renderMeimaySuperStars({
        self: !!selfSuper,
        partner: !!partnerSuper,
        style: 'display:flex;gap:2px;font-size:12px;line-height:1;'
    });
}

function renderReadingStockSectionV2() {
    const pendingStock = getReadingStock();
    const section = document.getElementById('reading-stock-section');
    if (!section) return;

    const history = typeof getReadingHistory === 'function' ? getReadingHistory() : [];
    const readingToSegments = {};
    history.forEach(h => {
        const historyKey = getReadingStockKey(h.reading, h.segments || []);
        readingToSegments[historyKey] = h.segments;
        if (!readingToSegments[h.reading]) readingToSegments[h.reading] = h.segments;
    });

    let removedList = [];
    try { removedList = JSON.parse(localStorage.getItem('meimay_hidden_readings') || '[]'); } catch (e) { }

    const ownLiked = getVisibleOwnLikedReadingsForUI();
    const completedReadings = [...new Set(
        ownLiked
            .filter(item =>
                item.sessionReading &&
                item.sessionReading !== 'FREE' &&
                item.sessionReading !== 'SEARCH' &&
                item.slot >= 0 &&
                !removedList.includes(item.sessionReading)
            )
            .map(item => item.sessionReading)
    )];

    const pairInsights = typeof window.MeimayPartnerInsights !== 'undefined' ? window.MeimayPartnerInsights : null;
    const partnerReadings = pairInsights?.getPartnerReadingStock ? pairInsights.getPartnerReadingStock() : [];
    const partnerReadingCollection = pairInsights?.getPartnerReadingCollection ? pairInsights.getPartnerReadingCollection() : partnerReadings;
    const partnerReadingByKey = new Map();
    const partnerReadingByReading = new Map();
    partnerReadingCollection.forEach(item => {
        const key = getPartnerViewReadingKey(item, pairInsights);
        if (key && !partnerReadingByKey.has(key)) partnerReadingByKey.set(key, item);
        const normalizedReading = getPartnerViewNormalizedReading(item?.reading, pairInsights);
        if (normalizedReading && !partnerReadingByReading.has(normalizedReading)) partnerReadingByReading.set(normalizedReading, item);
    });

    const completedCards = completedReadings.map(reading => {
        const segments = readingToSegments[reading] || [];
        const key = getPartnerViewReadingKey({ reading, segments }, pairInsights);
        const normalizedReading = getPartnerViewNormalizedReading(reading, pairInsights);
            return {
                reading,
                display: segments.length > 0 ? segments.join('/') : reading,
                segments,
                key,
                normalizedReading,
                ownItem: pendingStock.find(item => getPartnerViewReadingKey(item, pairInsights) === key) || null,
                partnerItem: partnerReadingByKey.get(key) || partnerReadingByReading.get(normalizedReading) || null,
                kanjiCount: ownLiked.filter(item => getReadingBaseReading(item.sessionReading) === reading && item.slot >= 0).length
            };
        });
    const completedMatchedKeys = new Set(completedCards.filter(item => item.partnerItem).map(item => item.key).filter(Boolean));
    const matchedReadingKeys = new Set(
        (pairInsights?.getMatchedReadingItems ? pairInsights.getMatchedReadingItems() : [])
            .map(item => getPartnerViewReadingKey(item, pairInsights))
            .filter(Boolean)
    );
    const matchedReadingValues = new Set(
        (pairInsights?.getMatchedReadingItems ? pairInsights.getMatchedReadingItems() : [])
            .map(item => getPartnerViewNormalizedReading(item?.reading, pairInsights))
            .filter(Boolean)
    );
    completedMatchedKeys.forEach(key => matchedReadingKeys.add(key));
    completedCards.forEach(item => {
        if (item.partnerItem && item.normalizedReading) matchedReadingValues.add(item.normalizedReading);
    });

    const isReadingMatchedForView = (item) => {
        const key = getPartnerViewReadingKey(item, pairInsights);
        if (key && matchedReadingKeys.has(key)) return true;
        const normalizedReading = getPartnerViewNormalizedReading(item?.reading, pairInsights);
        return normalizedReading ? matchedReadingValues.has(normalizedReading) : false;
    };

    const pendingOnly = pendingStock.filter(item =>
        !completedReadings.includes(item.reading) &&
        !removedList.includes(item.reading)
    );
    const partnerPendingCards = partnerReadings
        .map((item, originalIndex) => ({ item, originalIndex }))
        .filter(({ item }) => !isReadingMatchedForView(item));

    const partnerViewState = typeof window.getMeimayPartnerViewState === 'function'
        ? window.getMeimayPartnerViewState()
        : { readingFocus: 'all' };
    const readingFocus = ['all', 'partner', 'matched'].includes(partnerViewState.readingFocus)
        ? partnerViewState.readingFocus
        : 'all';
    const partnerName = pairInsights?.getPartnerDisplayName
        ? pairInsights.getPartnerDisplayName()
        : (typeof getPartnerRoleLabel === 'function'
            ? getPartnerRoleLabel(MeimayShare?.partnerSnapshot?.role)
            : 'パートナー');

    const showOwnSections = readingFocus !== 'partner';
    const visibleCompleted = showOwnSections
        ? completedCards.filter(item => readingFocus !== 'matched' || isReadingMatchedForView(item))
        : [];
    const visiblePendingOnly = showOwnSections
        ? pendingOnly.filter(item => readingFocus !== 'matched' || isReadingMatchedForView(item))
        : [];
    const visiblePartnerReadings = partnerPendingCards;

    const hasContent = visibleCompleted.length > 0 || visiblePendingOnly.length > 0 || visiblePartnerReadings.length > 0;
    const emptyMsg = document.getElementById('reading-stock-empty');
    if (emptyMsg) emptyMsg.classList.toggle('hidden', hasContent || readingFocus !== 'all');

    if (!hasContent) {
        if (readingFocus === 'partner' || readingFocus === 'matched') {
            const message = readingFocus === 'matched'
                ? 'ふたりで重なっている読み候補はまだありません'
                : `${partnerName}から届いている読み候補はまだありません`;
            section.innerHTML = `
                <div class="text-center py-16 text-sm text-[#a6967a]">
                    <div class="text-4xl mb-4 opacity-50">${readingFocus === 'matched' ? '〆' : '〰'}</div>
                    <p>${message}</p>
                    <button onclick="clearReadingPartnerFocus()" class="mt-4 inline-flex items-center rounded-full border border-[#eadfce] bg-white px-4 py-2 text-[11px] font-bold text-[#8b7e66] active:scale-95">
                        通常表示に戻る
                    </button>
                </div>
            `;
        } else {
            section.innerHTML = '';
        }
        return;
    }

    let html = '';

    if (readingFocus === 'partner' || readingFocus === 'matched') {
        const bannerTone = getReadingCardToneV2(readingFocus === 'matched' ? 'matched' : 'partner');
        const bannerTitle = readingFocus === 'matched' ? 'ふたりで重なった読み' : `${partnerName}の読み候補`;
        const bannerBody = readingFocus === 'matched'
            ? 'お互いに気になっている読みを先に見つけて、次の絞り込みにつなげましょう。'
            : `${partnerName}が集めた読みを見ながら、自分のストックに取り込めます。`;
        html += `
            <div class="rounded-2xl px-4 py-3 mb-4" style="${bannerTone.card}">
                <div class="flex items-center justify-between gap-3">
                    <div>
                        <div class="text-[10px] font-black tracking-[0.18em] uppercase" style="color:${bannerTone.sub}">${readingFocus === 'matched' ? 'Matched' : 'Partner'}</div>
                        <div class="mt-1 text-sm font-bold text-[#4f4639]">${bannerTitle}</div>
                        <div class="mt-1 text-[11px] text-[#8b7e66]">${bannerBody}</div>
                    </div>
                    <button onclick="clearReadingPartnerFocus()" class="shrink-0 rounded-full px-3 py-1.5 text-[11px] font-bold active:scale-95" style="${bannerTone.actionGhost}">
                        通常表示
                    </button>
                </div>
            </div>
        `;
    }

    if (visibleCompleted.length > 0) {
        html += `<div class="mb-6">
            <div class="text-xs font-black text-[#bca37f] mb-3 tracking-wider uppercase">漢字の候補がある読み</div>
            <div class="space-y-2">`;

        visibleCompleted.forEach(item => {
            const kind = item.partnerItem ? 'matched' : 'self';
            const tone = getReadingCardToneV2(kind);
            const stars = renderReadingCardStarsV2(item.ownItem?.isSuper, item.partnerItem?.isSuper);
            html += `
                <div class="rounded-2xl p-3 flex items-center gap-3 hover:-translate-y-[1px] transition-all cursor-pointer active:scale-[0.98]"
                     style="${tone.card}"
                     onclick="openReadingStockModal('${item.reading}')">
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-2">
                            ${stars}
                            <div class="text-lg font-black leading-tight" style="color:${tone.title}">${item.display}</div>
                        </div>
                        <div class="mt-1 text-[9px]" style="color:${tone.sub}">${item.kanjiCount}件の漢字候補</div>
                    </div>
                    <button onclick="event.stopPropagation(); openBuildFromReading(${JSON.stringify(String(item.id || item.reading || ''))}, ${JSON.stringify(Array.isArray(item.segments) ? item.segments.filter(Boolean) : [])})"
                        class="text-xs font-bold px-4 py-2 rounded-full whitespace-nowrap transition-all active:scale-95 shadow-sm"
                        style="${tone.action}">
                        組み立てる
                    </button>
                </div>`;
        });

        html += `</div></div>`;
    }

    if (visiblePendingOnly.length > 0) {
        const groups = {};
        visiblePendingOnly.forEach(item => {
            const key = item.baseNickname || '気になった読み';
            if (!groups[key]) groups[key] = [];
            groups[key].push(item);
        });

        html += `<div class="mb-5">
            <div class="text-xs font-black text-[#a6967a] mb-3 tracking-wider uppercase">漢字を選んでいない読み</div>`;

        Object.keys(groups).forEach(groupName => {
            const items = groups[groupName];
            html += `<div class="mb-3">
                <div class="text-[10px] text-[#bca37f] mb-1">${groupName}</div>
                <div class="space-y-2">
                    ${items.map(item => {
                        const display = getReadingDisplayLabel(item);
                        const key = getPartnerViewReadingKey(item, pairInsights);
                        const partnerItem = partnerReadingByKey.get(key) || partnerReadingByReading.get(getPartnerViewNormalizedReading(item?.reading, pairInsights)) || null;
                        const kind = isReadingMatchedForView(item) ? 'matched' : 'self';
                        const tone = getReadingCardToneV2(kind);
                        const stars = renderReadingCardStarsV2(item.isSuper, partnerItem?.isSuper);
                        return `
                        <div class="rounded-2xl p-3 hover:-translate-y-[1px] transition-all cursor-pointer active:scale-[0.98]" style="${tone.card}" data-reading="${JSON.stringify(String(item.reading || ''))}" data-stock-id="${JSON.stringify(String(item.id || ''))}" onclick="openReadingStockModal(${JSON.stringify(String(item.id || item.reading || ''))})">
                            <div class="flex items-center justify-between gap-2">
                                <button onclick='event.stopPropagation(); openReadingStockModal(${JSON.stringify(String(item.id || item.reading || ''))})' class="flex-1 text-left active:scale-95 transition-transform">
                                    <div class="flex items-center gap-2">
                                        ${stars}
                                        <div class="text-lg font-black leading-tight" style="color:${tone.title}">${display}</div>
                                    </div>
                                </button>
                                <button onclick='event.stopPropagation(); if(typeof startReadingSplitProposalFromStock === "function") startReadingSplitProposalFromStock(${JSON.stringify(String(item.reading || ""))}); else startReadingFromStock(${JSON.stringify(String(item.reading || ""))})' class="shrink-0 px-4 py-2 rounded-full text-xs font-bold text-white whitespace-nowrap shadow-sm active:scale-95 transition-all" style="${tone.action}">
                                    漢字を選ぶ
                                </button>
                            </div>
                        </div>`;
                    }).join('')}
                </div>
            </div>`;
        });

        html += `</div>`;
    }

    if (visiblePartnerReadings.length > 0) {
        html += `<div class="mb-5">
            <div class="text-xs font-black text-[#dd7d73] mb-3 tracking-wider uppercase">${partnerName}の読み候補</div>
            <div class="space-y-2">
                ${visiblePartnerReadings.map(entry => {
                    const item = entry.item;
                    const display = getReadingDisplayLabel(item);
                    const tone = getReadingCardToneV2('partner');
                    const stars = renderReadingCardStarsV2(false, item.isSuper);
                    return `
                        <div class="w-full rounded-2xl p-3 flex items-center gap-3" style="${tone.card}">
                            <div class="flex-1 min-w-0">
                                <div class="flex items-center gap-2">
                                    ${stars}
                                    <div class="text-lg font-black leading-tight" style="color:${tone.title}">${display}</div>
                                </div>
                            </div>
                            <button onclick="likePartnerReadingStock(${entry.originalIndex})" class="shrink-0 px-4 py-2 rounded-full text-[11px] font-bold shadow-sm active:scale-95 whitespace-nowrap" style="${tone.action}">
                                取り込む
                            </button>
                        </div>`;
                }).join('')}
            </div>
        </div>`;
    }

    section.innerHTML = html;
}

renderReadingStockSection = renderReadingStockSectionV2;
window.renderReadingStockSection = renderReadingStockSectionV2;

function renderReadingStockSectionVisible() {
    renderReadingStockSectionV2();
}

renderReadingStockSection = renderReadingStockSectionVisible;
window.renderReadingStockSection = renderReadingStockSectionVisible;

function removeCompletedReadingFromStock(reading) {
    const displayReading = getReadingBaseReading(reading) || String(reading || '').trim();
    if (!confirm(`「${displayReading}」をストックリストから外しますか？\n（選んだ漢字は削除されません）`)) return;

    const removedItems = typeof removeReadingFromStock === 'function'
        ? removeReadingFromStock(reading)
        : [];
    if (Array.isArray(removedItems) && removedItems.length > 0) {
        removedItems.forEach(item => rememberHiddenReading(item.reading));
    } else {
        rememberHiddenReading(reading);
    }
    renderReadingStockSection();
    if (typeof refreshPartnerAwareUI === 'function') {
        refreshPartnerAwareUI();
    }
    showToast(`「${displayReading}」を外しました`, '🗑️');
}

var SOUND_EXPLORATION_INTERACTION_THRESHOLD = 24;

function getSoundPreferenceInteractionCount() {
    return (soundPreferenceData?.liked?.length || 0) + (soundPreferenceData?.noped?.length || 0);
}

function shuffleReadingCandidates(list) {
    const copied = Array.isArray(list) ? [...list] : [];
    for (let i = copied.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copied[i], copied[j]] = [copied[j], copied[i]];
    }
    return copied;
}

function getReadingCandidateRankScore(candidate) {
    return ((candidate?.popular ? 1 : 0) * 1000000) +
        ((candidate?.score || 0) * 1000) +
        (candidate?.rawCount || candidate?.count || 0);
}

function buildExplorationReadingOrder(candidates) {
    const grouped = new Map();

    (Array.isArray(candidates) ? candidates : []).forEach(candidate => {
        const firstMora = splitReadingIntoMoraUnits(candidate?.reading || '')[0] || '';
        const primaryTag = Array.isArray(candidate?.tags) && candidate.tags.length > 0
            ? candidate.tags[0]
            : '#other';
        const groupKey = `${firstMora}::${primaryTag}`;
        if (!grouped.has(groupKey)) grouped.set(groupKey, []);
        grouped.get(groupKey).push(candidate);
    });

    grouped.forEach((items, key) => {
        const ranked = [...items].sort((a, b) => getReadingCandidateRankScore(b) - getReadingCandidateRankScore(a));
        const lead = shuffleReadingCandidates(ranked.slice(0, 8));
        grouped.set(key, [...lead, ...shuffleReadingCandidates(ranked.slice(8))]);
    });

    const keys = shuffleReadingCandidates(
        Array.from(grouped.keys()).sort((a, b) => grouped.get(b).length - grouped.get(a).length)
    );

    const result = [];
    let madeProgress = true;
    while (madeProgress) {
        madeProgress = false;
        keys.forEach(key => {
            const queue = grouped.get(key);
            if (queue && queue.length > 0) {
                result.push(queue.shift());
                madeProgress = true;
            }
        });
    }

    return result.length > 0 ? result : (Array.isArray(candidates) ? [...candidates] : []);
}

function aiReorderCandidates(candidates) {
    const interactionCount = getSoundPreferenceInteractionCount();
    if (interactionCount < SOUND_EXPLORATION_INTERACTION_THRESHOLD) {
        return buildExplorationReadingOrder(candidates);
    }

    const likedEndings = soundPreferenceData.liked.map(r => r.slice(-2));
    const nopedEndings = soundPreferenceData.noped.map(r => r.slice(-2));
    const likedVowels = soundPreferenceData.liked.map(r => getVowelPattern(r));

    const endingScore = {};
    likedEndings.forEach(e => { endingScore[e] = (endingScore[e] || 0) + 2; });
    nopedEndings.forEach(e => { endingScore[e] = (endingScore[e] || 0) - 1; });

    const vowelScore = {};
    likedVowels.forEach(v => { vowelScore[v] = (vowelScore[v] || 0) + 1; });

    return (Array.isArray(candidates) ? candidates : []).map(candidate => {
        let boost = 0;
        const ending = (candidate.reading || '').slice(-2);
        const vowel = getVowelPattern(candidate.reading || '');
        boost += (endingScore[ending] || 0) * 10;
        boost += (vowelScore[vowel] || 0) * 5;
        return { ...candidate, _aiBoost: boost };
    }).sort((a, b) =>
        (getReadingCandidateRankScore(b) + (b._aiBoost || 0)) -
        (getReadingCandidateRankScore(a) + (a._aiBoost || 0))
    );
}

function prepareAdaptiveReadingCandidates(candidates) {
    return aiReorderCandidates(Array.isArray(candidates) ? candidates : []);
}

function startNicknameCandidateSwipe(baseReading) {
    const flowBaseReading = toHira(baseReading || '');
    nicknameBaseReading = flowBaseReading;

    const candidates = generateNameCandidates(flowBaseReading, gender, nicknamePosition)
        .map(item => ({
            ...item,
            gender: item.gender || gender || 'neutral'
        }));

    if (!candidates || candidates.length === 0) {
        alert('候補が見つかりませんでした。別の読みで試してください。');
        return;
    }

    startUniversalSwipe('nickname', candidates, {
        title: '読みで選ぶ',
        subtitle: `${nicknameBaseReading} を含む候補から、気になる読みを選びます`,
        onLike: (item, action) => {
            if (typeof addReadingToStock === 'function') {
                addReadingToStock(item.reading, nicknameBaseReading, item.tags || [], {
                    segments: getPreferredReadingSegments(item.reading),
                    isSuper: action === 'super',
                    gender: item.gender || gender || 'neutral',
                    clearHidden: true
                });
            }
        },
        onTap: (item) => {
            openReadingCombinationModal(item, nicknameBaseReading);
        },
        renderCard: (item) => renderReadingSwipeCard(item)
    });
}

function processNickname() {
    const el = document.getElementById('in-nickname');
    let val = el ? el.value.trim() : '';

    if (!val) {
        alert('ニックネームを入力してください');
        return;
    }

    val = val.replace(/(ちゃん|くん|さん|たん|りん)$/g, '');
    val = toHira(val);
    if (!val) {
        alert('読みが正しくありません');
        return;
    }

    const posRadios = document.getElementsByName('nickname-pos');
    let pos = 'prefix';
    for (let i = 0; i < posRadios.length; i++) {
        if (posRadios[i].checked) {
            pos = posRadios[i].value;
            break;
        }
    }
    nicknamePosition = pos;
    startNicknameCandidateSwipe(val);
}

function initAdanaMode() {
    const adanaNames = generateAdanaNames(gender).map(item => ({
        ...item,
        gender: item.gender || gender || 'neutral'
    }));

    if (adanaNames.length === 0) {
        alert('あだ名候補が見つかりませんでした。');
        return;
    }

    startUniversalSwipe('adana', adanaNames, {
        title: 'あだ名を選ぶ',
        subtitle: 'あとから同じカードで読み候補を見られます',
        onNext: (selectedItems) => {
            const chosen = Array.isArray(selectedItems) && selectedItems.length > 0
                ? selectedItems[0]
                : null;
            if (!chosen) return;

            const inputEl = document.getElementById('in-nickname');
            if (inputEl) inputEl.value = chosen.reading;
            nicknamePosition = 'prefix';
            startNicknameCandidateSwipe(chosen.reading);
        },
        renderCard: (item) => {
            let tagsHtml = '';
            if (item.tags && item.tags.length > 0) {
                tagsHtml = renderReadingTagBadges(item.tags);
            }

            return `
                ${tagsHtml}
                <div class="text-[52px] font-black text-[#5d5444] mb-4 tracking-wider leading-tight">${item.reading}</div>
                <div class="w-full px-4 mt-2">
                    <div class="bg-white/70 rounded-2xl p-3 border border-white max-w-[220px] mx-auto shadow-sm">
                        <p class="text-[10px] text-[#a6967a] text-center mb-2 font-bold">近い読みの例</p>
                        <div class="flex justify-center flex-wrap gap-1.5 text-[#5d5444] font-bold text-base">
                            ${(item.examples || []).slice(0, 4).map(example => `<span class="px-1">${example}</span>`).join('') || '<span class="text-xs text-[#d4c5af]">候補なし</span>'}
                        </div>
                    </div>
                </div>
            `;
        }
    });
}

function initSoundMode() {
    const popularNames = generatePopularNames(gender).map(item => ({
        ...item,
        gender: item.gender || gender || 'neutral'
    }));

    startUniversalSwipe('sound', prepareAdaptiveReadingCandidates(popularNames), {
        title: '響きで選ぶ',
        subtitle: '好みが固まるまでは幅広く、だんだん寄せていきます',
        onLike: (item, action) => {
            if (typeof addReadingToStock === 'function') {
                addReadingToStock(item.reading, '', item.tags || [], {
                    segments: getPreferredReadingSegments(item.reading),
                    isSuper: action === 'super',
                    gender: item.gender || gender || 'neutral',
                    clearHidden: true
                });
            }
        },
        onTap: (item) => {
            openReadingCombinationModal(item);
        },
        renderCard: (item) => renderReadingSwipeCard(item)
    });
}

window.aiReorderCandidates = aiReorderCandidates;
function renderReadingCardStarsV2(selfSuper, partnerSuper) {
    if (typeof window.renderMeimaySuperStars !== 'function') {
        return selfSuper || partnerSuper ? '<div class="text-[12px] leading-none text-[#fbbc04]">★</div>' : '';
    }
    return window.renderMeimaySuperStars({
        self: !!selfSuper,
        partner: !!partnerSuper,
        style: 'display:flex;gap:2px;font-size:12px;line-height:1;pointer-events:none;'
    });
}

function renderReadingTitleWithStarsV2(label, selfSuper, partnerSuper) {
    const text = String(label || '');
    const stars = renderReadingCardStarsV2(selfSuper, partnerSuper);
    if (!stars) return `<span class="reading-title-text">${text}</span>`;
    return `
        <div class="reading-title-with-stars">
            <div class="reading-title-text">${text}</div>
            <div class="reading-title-star-badge">${stars}</div>
        </div>
    `;
}

function openReadingStockModal(reading) {
    const modal = document.getElementById('modal-reading-detail');
    if (!modal) return;

    const titleEl = document.getElementById('reading-detail-title');
    const infoEl = document.getElementById('reading-detail-info');
    const btnBuild = document.getElementById('reading-detail-btn-build');
    const btnAdd = document.getElementById('reading-detail-btn-add');
    const btnRemove = document.getElementById('reading-detail-btn-remove');
    const stockItem = findReadingStockItem(reading);
    const targetReading = stockItem?.reading || reading;
    const stockTarget = stockItem?.id || reading;
    const baseReading = getReadingBaseReading(targetReading);
    const kanjiCount = liked.filter(item => getReadingBaseReading(item.sessionReading) === baseReading && item.slot >= 0).length;
    const isPromotedReading = !!stockItem?.readingPromoted || kanjiCount > 0;
    const displayReading = getReadingDisplayLabel(stockItem || { reading }, isPromotedReading ? { allowSegments: true } : { forceRaw: true });

    titleEl.textContent = displayReading;
    infoEl.textContent = isPromotedReading ? `${kanjiCount}個の漢字を選びました` : 'まだ漢字を選んでいません';

    btnBuild.style.display = '';
    btnAdd.style.display = '';
    btnRemove.style.display = '';

    btnBuild.textContent = isPromotedReading ? '組み立てる' : '漢字を選ぶ';
    btnBuild.onclick = () => {
        closeModal('modal-reading-detail');
        if (isPromotedReading) {
            openBuildFromReading(targetReading);
        } else {
            startReadingSplitProposalFromStock(targetReading);
        }
    };

    btnAdd.textContent = '漢字を追加する';
    btnAdd.onclick = () => {
        closeModal('modal-reading-detail');
        addMoreForReading(targetReading);
    };
    btnAdd.style.display = isPromotedReading ? '' : 'none';

    btnRemove.textContent = 'この読みをストックから削除';
    btnRemove.onclick = () => {
        closeModal('modal-reading-detail');
        removeCompletedReadingFromStock(stockTarget);
    };

    modal.classList.add('active');
}

function saveReadingCandidateToStock(option, candidate, asSuper = false) {
    const sessionReading = readingCombinationModalState.item.reading;
    const sessionSegments = Array.isArray(option.path) ? [...option.path] : [];

    addReadingToStock(sessionReading, readingCombinationModalState.item.baseNickname || '', readingCombinationModalState.item.tags || [], {
        segments: sessionSegments,
        isSuper: !!asSuper,
        gender: readingCombinationModalState.item.gender || gender || 'neutral',
        clearHidden: true,
        readingPromoted: true,
        source: 'reading-combination'
    });

    candidate.combination.forEach((piece, slotIndex) => {
        const existing = liked.find(item =>
            item['漢字'] === piece['漢字'] &&
            item.slot === slotIndex &&
            item.sessionReading === sessionReading
        );

        if (existing) {
            existing.isSuper = existing.isSuper || !!asSuper;
            existing.readingPromoted = true;
            existing.source = existing.source || 'reading-combination';
            return;
        }

        liked.push({
            ...piece,
            slot: slotIndex,
            sessionReading,
            sessionSegments,
            readingPromoted: true,
            source: 'reading-combination',
            isSuper: !!asSuper
        });
    });

    if (typeof StorageBox !== 'undefined' && StorageBox.saveLiked) {
        StorageBox.saveLiked();
    }
}

function saveReadingOnlyFromModal(asSuper = false) {
    if (!readingCombinationModalState) return;
    if (Date.now() - readingCombinationModalOpenedAt < 420) return;
    const item = readingCombinationModalState.item || {};
    addReadingToStock(item.reading, item.baseNickname || '', item.tags || [], {
        segments: [],
        isSuper: !!asSuper,
        gender: item.gender || gender || 'neutral',
        clearHidden: true
    });
    if (typeof showToast === 'function') {
        showToast(asSuper ? `${item.reading}を本命として保存しました` : `${item.reading}を候補として保存しました`, asSuper ? '★' : '✓');
    }

    if (typeof renderReadingStockSection === 'function') renderReadingStockSection();
    if (typeof refreshPartnerAwareUI === 'function') refreshPartnerAwareUI();
}

function startReadingSplitProposalFromStock(reading) {
    const targetReading = getReadingBaseReading(reading);
    const nameInput = document.getElementById('in-name');
    if (nameInput) nameInput.value = targetReading || reading;
    if (typeof calcSegments === 'function') {
        calcSegments();
        return;
    }

    const stockItem = findReadingStockItem(reading);
    if (!stockItem) return;

    if (typeof openReadingCombinationModal === 'function') {
        openReadingCombinationModal({
            ...stockItem,
            reading: targetReading || stockItem.reading,
            segments: Array.isArray(stockItem.segments) ? stockItem.segments : [],
            forceSplit: true
        }, stockItem.baseNickname || '', '', stockItem.id || stockItem.reading || targetReading || reading);
        return;
    }

    if (typeof openBuildFromReading === 'function') openBuildFromReading(targetReading || stockItem.reading);
}

function startReadingFromStock(target) {
    const stockItem = findReadingStockItem(target);
    if (!stockItem) return;

    hideReadingFromStock(stockItem.id || stockItem.reading || target);
    appMode = 'nickname';
    window._addMoreFromBuild = false;
    clearCompoundBuildFlow();
    if (!Array.isArray(stockItem.segments) || stockItem.segments.length === 0) {
        const preferred = typeof getPreferredReadingSegments === 'function' ? getPreferredReadingSegments(stockItem.reading) : [];
        segments = Array.isArray(preferred) && preferred.length > 0 ? [...preferred] : [stockItem.reading];
    }

    openBuildFromReading(stockItem.reading);
}

function likePartnerReadingStock(index) {
    const pairInsights = typeof window.MeimayPartnerInsights !== 'undefined' ? window.MeimayPartnerInsights : null;
    const partnerReadings = pairInsights?.getPartnerReadingStock ? pairInsights.getPartnerReadingStock() : [];
    if (index < 0 || index >= partnerReadings.length) return;

    const item = partnerReadings[index];
    if (!item) return;
    const reading = getReadingBaseReading(item.reading || item.sessionReading || '');
    if (!reading) return;

    addReadingToStock(reading, item.baseNickname || '', item.tags || [], {
        segments: [],
        isSuper: false,
        partnerSuper: !!item.isSuper,
        gender: item.gender || gender || 'neutral',
        source: 'partner-reading',
        clearHidden: true
    });

    if (typeof showToast === 'function') showToast(`${reading}を取り込みました`, '✓');
    if (typeof renderReadingStockSection === 'function') renderReadingStockSection();
    if (typeof refreshPartnerAwareUI === 'function') refreshPartnerAwareUI();
}

function renderReadingStockSectionV2() {
    const pendingStock = getReadingStock();
    const section = document.getElementById('reading-stock-section');
    if (!section) return;

    const history = typeof getReadingHistory === 'function' ? getReadingHistory() : [];
    const readingToSegments = {};
    history.forEach(h => {
        const historyKey = getReadingStockKey(h.reading, h.segments || []);
        readingToSegments[historyKey] = h.segments;
        if (!readingToSegments[h.reading]) readingToSegments[h.reading] = h.segments;
    });

    let removedList = [];
    try { removedList = JSON.parse(localStorage.getItem('meimay_hidden_readings') || '[]'); } catch (e) { }
    const removedReadingSet = new Set(removedList.map(item => getReadingBaseReading(item)).filter(Boolean));

    const ownLiked = getVisibleOwnLikedReadingsForUI();
    const completedReadings = [...new Set(
        ownLiked
            .filter(item => item.sessionReading && item.sessionReading !== 'FREE' && item.sessionReading !== 'SEARCH' && item.slot >= 0 && !removedReadingSet.has(getReadingBaseReading(item.sessionReading)))
            .map(item => getReadingBaseReading(item.sessionReading))
            .filter(Boolean)
    )];
    const completedReadingSet = new Set(completedReadings);

    const displayPendingStock = [];
    const seenPendingReadings = new Set();
    sortReadingStockMatches(
        pendingStock.filter(item => {
            const readingKey = getReadingBaseReading(item.reading || item.sessionReading || '');
            return readingKey && !removedReadingSet.has(readingKey);
        })
    ).forEach(item => {
        const readingKey = getReadingBaseReading(item.reading || item.sessionReading || '');
        if (!readingKey || seenPendingReadings.has(readingKey)) return;
        seenPendingReadings.add(readingKey);
        displayPendingStock.push(item);
    });

    const pairInsights = typeof window.MeimayPartnerInsights !== 'undefined' ? window.MeimayPartnerInsights : null;
    const partnerReadings = pairInsights?.getPartnerReadingStock ? pairInsights.getPartnerReadingStock() : [];
    const partnerReadingCollection = pairInsights?.getPartnerReadingCollection ? pairInsights.getPartnerReadingCollection() : partnerReadings;
    const partnerReadingByKey = new Map();
    const partnerReadingByReading = new Map();
    partnerReadingCollection.forEach(item => {
        const key = getPartnerViewReadingKey(item, pairInsights);
        if (key && !partnerReadingByKey.has(key)) partnerReadingByKey.set(key, item);
        const normalizedReading = getPartnerViewNormalizedReading(item?.reading, pairInsights);
        if (normalizedReading && !partnerReadingByReading.has(normalizedReading)) partnerReadingByReading.set(normalizedReading, item);
    });

    const compareCardEntries = (a, b, getStarValue = (entry) => !!entry?.isSuper) => {
        const aStar = getStarValue(a) ? 1 : 0;
        const bStar = getStarValue(b) ? 1 : 0;
        if (aStar !== bStar) return bStar - aStar;
        const aReading = getReadingBaseReading(a?.reading || a?.sessionReading || '');
        const bReading = getReadingBaseReading(b?.reading || b?.sessionReading || '');
        return aReading.localeCompare(bReading, 'ja');
    };

    const completedCards = completedReadings.map(reading => {
        const kanjiCount = ownLiked.filter(item => getReadingBaseReading(item.sessionReading) === reading && item.slot >= 0).length;
        const ownItem = findReadingStockItem(reading);
        const segmentSource = Array.isArray(ownItem?.segments) ? ownItem.segments.filter(Boolean) : [];
        const key = getPartnerViewReadingKey({ reading, segments: segmentSource }, pairInsights);
        const normalizedReading = getPartnerViewNormalizedReading(reading, pairInsights);
        return {
            reading,
            display: segmentSource.length > 0 ? segmentSource.join('/') : reading,
            segments: segmentSource,
            key,
            normalizedReading,
            ownItem,
            partnerItem: partnerReadingByKey.get(key) || partnerReadingByReading.get(normalizedReading) || null,
            kanjiCount
        };
    }).sort((a, b) => compareCardEntries(a, b, entry => !!(entry.ownItem?.isSuper || entry.ownItem?.ownSuper || entry.ownItem?.partnerSuper || entry.partnerItem?.isSuper)));

    const completedMatchedKeys = new Set(completedCards.filter(item => item.partnerItem).map(item => item.key).filter(Boolean));
    const matchedReadingKeys = new Set((pairInsights?.getMatchedReadingItems ? pairInsights.getMatchedReadingItems() : []).map(item => getPartnerViewReadingKey(item, pairInsights)).filter(Boolean));
    const matchedReadingValues = new Set((pairInsights?.getMatchedReadingItems ? pairInsights.getMatchedReadingItems() : []).map(item => getPartnerViewNormalizedReading(item?.reading, pairInsights)).filter(Boolean));
    completedMatchedKeys.forEach(key => matchedReadingKeys.add(key));
    completedCards.forEach(item => {
        if (item.partnerItem && item.normalizedReading) matchedReadingValues.add(item.normalizedReading);
    });

    const isReadingMatchedForView = (item) => {
        const key = getPartnerViewReadingKey(item, pairInsights);
        if (key && matchedReadingKeys.has(key)) return true;
        const normalizedReading = getPartnerViewNormalizedReading(item?.reading, pairInsights);
        return normalizedReading ? matchedReadingValues.has(normalizedReading) : false;
    };

    const pendingOnly = displayPendingStock.filter(item => !completedReadingSet.has(getReadingBaseReading(item.reading || item.sessionReading || '')));
    const partnerPendingCards = partnerReadings
        .map((item, originalIndex) => ({ item, originalIndex }))
        .filter(({ item }) => !isReadingMatchedForView(item))
        .sort((a, b) => compareCardEntries(a.item, b.item, entry => !!(entry.isSuper || entry.ownSuper || entry.partnerSuper)));

    const partnerViewState = typeof window.getMeimayPartnerViewState === 'function' ? window.getMeimayPartnerViewState() : { readingFocus: 'all' };
    const readingFocus = ['all', 'partner', 'matched'].includes(partnerViewState.readingFocus) ? partnerViewState.readingFocus : 'all';
    const partnerName = pairInsights?.getPartnerDisplayName ? pairInsights.getPartnerDisplayName() : (typeof getPartnerRoleLabel === 'function' ? getPartnerRoleLabel(MeimayShare?.partnerSnapshot?.role) : 'パートナー');

    const showOwnSections = readingFocus !== 'partner';
    const visibleCompleted = showOwnSections
        ? completedCards
            .filter(item => readingFocus !== 'matched' || isReadingMatchedForView(item))
        : [];
    const visiblePendingOnly = showOwnSections ? pendingOnly.filter(item => readingFocus !== 'matched' || isReadingMatchedForView(item)) : [];
    const visiblePartnerReadings = partnerPendingCards;

    const hasContent = visibleCompleted.length > 0 || visiblePendingOnly.length > 0 || visiblePartnerReadings.length > 0;
    const emptyMsg = document.getElementById('reading-stock-empty');
    if (emptyMsg) emptyMsg.classList.toggle('hidden', hasContent || readingFocus !== 'all');

    if (!hasContent) {
        if (readingFocus === 'partner' || readingFocus === 'matched') {
            const message = readingFocus === 'matched' ? 'まだ一致する読みはありません' : `${partnerName} の読みストックはまだありません`;
            section.innerHTML = `
                <div class="text-center py-16 text-sm text-[#a6967a]">
                    <div class="text-4xl mb-4 opacity-50">${readingFocus === 'matched' ? '★' : '◎'}</div>
                    <p>${message}</p>
                    <button onclick="clearReadingPartnerFocus()" class="mt-4 inline-flex items-center rounded-full border border-[#eadfce] bg-white px-4 py-2 text-[11px] font-bold text-[#8b7e66] active:scale-95">
                        フィルタを解除
                    </button>
                </div>
            `;
        } else {
            section.innerHTML = '';
        }
        return;
    }

    let html = '';

    if (readingFocus === 'partner' || readingFocus === 'matched') {
        const bannerTone = getReadingCardToneV2(readingFocus === 'matched' ? 'matched' : 'partner');
        const bannerTitle = readingFocus === 'matched' ? '一致した読み' : `${partnerName} の読みストック`;
        const bannerBody = readingFocus === 'matched' ? 'パートナーの読みと自分のストックが重なっているものをまとめて表示しています。' : `${partnerName} の読み候補を自分のストックに取り込めます。`;
        html += `
            <div class="rounded-2xl px-4 py-3 mb-4" style="${bannerTone.card}">
                <div class="flex items-center justify-between gap-3">
                    <div>
                        <div class="text-[10px] font-black tracking-[0.18em] uppercase" style="color:${bannerTone.sub}">${readingFocus === 'matched' ? 'Matched' : 'Partner'}</div>
                        <div class="mt-1 text-sm font-bold text-[#4f4639]">${bannerTitle}</div>
                        <div class="mt-1 text-[11px] text-[#8b7e66]">${bannerBody}</div>
                    </div>
                    <button onclick="clearReadingPartnerFocus()" class="shrink-0 rounded-full px-3 py-1.5 text-[11px] font-bold active:scale-95" style="${bannerTone.actionGhost}">
                        フィルタを解除
                    </button>
                </div>
            </div>
        `;
    }

    if (visibleCompleted.length > 0) {
        html += `<div class="mb-6">
            <div class="text-xs font-black text-[#bca37f] mb-3 tracking-wider uppercase">漢字を選んだ読み</div>
            <div class="space-y-2">`;

        visibleCompleted.forEach(item => {
            const kind = (item.partnerItem || item.ownItem?.partnerSuper) ? 'matched' : 'self';
            const tone = getReadingCardToneV2(kind);
            html += `
                <div class="rounded-2xl p-3 flex items-center gap-3 hover:-translate-y-[1px] transition-all cursor-pointer active:scale-[0.98]"
                     style="${tone.card}"
                     onclick="openReadingStockModal('${item.reading}')">
                    <div class="flex-1 min-w-0">
                        <div class="text-lg font-black leading-tight" style="color:${tone.title}">
                            ${renderReadingTitleWithStarsV2(
                                item.display,
                                item.ownItem?.isSuper || item.ownItem?.ownSuper,
                                false
                            )}
                        </div>
                        <div class="mt-1 text-[9px]" style="color:${tone.sub}">${item.kanjiCount}個の漢字</div>
                    </div>
                    <button onclick="event.stopPropagation(); openBuildFromReading(${JSON.stringify(String(item.id || item.reading || ''))}, ${JSON.stringify(Array.isArray(item.segments) ? item.segments.filter(Boolean) : [])})"
                        class="text-xs font-bold px-4 py-2 rounded-full whitespace-nowrap transition-all active:scale-95 shadow-sm"
                        style="${tone.action}">
                        組み立てる
                    </button>
                </div>`;
        });

        html += `</div></div>`;
    }

    if (visiblePendingOnly.length > 0) {
        const groups = {};
        visiblePendingOnly.forEach(item => {
            const key = item.baseNickname || 'まだ漢字を選んでいない読み';
            if (!groups[key]) groups[key] = [];
            groups[key].push(item);
        });

        const groupEntries = Object.entries(groups).sort((a, b) => {
            const aStar = a[1].some(item => isReadingStockStarred(item)) ? 1 : 0;
            const bStar = b[1].some(item => isReadingStockStarred(item)) ? 1 : 0;
            if (aStar !== bStar) return bStar - aStar;
            return a[0].localeCompare(b[0], 'ja');
        });

        html += `<div class="mb-5">
            <div class="text-xs font-black text-[#a6967a] mb-3 tracking-wider uppercase">未昇格の読み</div>`;

        groupEntries.forEach(([groupName, items]) => {
            const sortedItems = [...items].sort((a, b) => compareCardEntries(a, b, entry => isReadingStockStarred(entry)));
            html += `<div class="mb-3">
                <div class="text-[10px] text-[#bca37f] mb-1">${groupName}</div>
                <div class="space-y-2">
                    ${sortedItems.map(item => {
                        const display = getReadingDisplayLabel(item, { forceRaw: true });
                        const key = getPartnerViewReadingKey(item, pairInsights);
                        const partnerItem = partnerReadingByKey.get(key) || partnerReadingByReading.get(getPartnerViewNormalizedReading(item?.reading, pairInsights)) || null;
                        const kind = isReadingMatchedForView(item) ? 'matched' : 'self';
                        const tone = getReadingCardToneV2(kind);
                        return `
                        <div class="rounded-2xl p-3 hover:-translate-y-[1px] transition-all cursor-pointer active:scale-[0.98]" style="${tone.card}" data-reading="${JSON.stringify(String(item.reading || ''))}" data-stock-id="${JSON.stringify(String(item.id || ''))}" onclick="openReadingStockModal(${JSON.stringify(String(item.id || item.reading || ''))})">
                            <div class="flex items-center justify-between gap-2">
                                <button onclick='event.stopPropagation(); openReadingStockModal(${JSON.stringify(String(item.id || item.reading || ''))})' class="flex-1 text-left active:scale-95 transition-transform">
                                    <div class="text-lg font-black leading-tight" style="color:${tone.title}">
                                        ${renderReadingTitleWithStarsV2(display, item.isSuper, partnerItem?.isSuper)}
                                    </div>
                                </button>
                                <button onclick='event.stopPropagation(); if(typeof startReadingSplitProposalFromStock === "function") startReadingSplitProposalFromStock(${JSON.stringify(String(item.reading || ""))}); else startReadingFromStock(${JSON.stringify(String(item.reading || ""))})' class="shrink-0 px-4 py-2 rounded-full text-xs font-bold text-white whitespace-nowrap shadow-sm active:scale-95 transition-all" style="${tone.action}">
                                    漢字を選ぶ
                                </button>
                            </div>
                        </div>`;
                    }).join('')}
                </div>
            </div>`;
        });

        html += `</div>`;
    }

    if (visiblePartnerReadings.length > 0) {
        html += `<div class="mb-5">
            <div class="text-xs font-black text-[#dd7d73] mb-3 tracking-wider uppercase">${partnerName} の読みストック</div>
            <div class="space-y-2">
                ${visiblePartnerReadings.map(entry => {
                    const item = entry.item;
                    const display = getReadingDisplayLabel(item, { forceRaw: true });
                    const tone = getReadingCardToneV2('partner');
                    return `
                        <div class="w-full rounded-2xl p-3 flex items-center gap-3" style="${tone.card}">
                            <div class="flex-1 min-w-0">
                                <div class="text-lg font-black leading-tight" style="color:${tone.title}">
                                    ${renderReadingTitleWithStarsV2(display, false, item.isSuper)}
                                </div>
                            </div>
                            <button onclick="likePartnerReadingStock(${entry.originalIndex})" class="shrink-0 px-4 py-2 rounded-full text-[11px] font-bold shadow-sm active:scale-95 whitespace-nowrap" style="${tone.action}">
                                取り込む
                            </button>
                        </div>`;
                }).join('')}
            </div>
        </div>`;
    }

    section.innerHTML = html;
}

function renderReadingStockSectionVisible() {
    renderReadingStockSectionV2();
}

function startNicknameCandidateSwipe(baseReading) {
    const flowBaseReading = toHira(baseReading || '');
    nicknameBaseReading = flowBaseReading;

    const candidates = generateNameCandidates(flowBaseReading, gender, nicknamePosition)
        .map(item => ({
            ...item,
            gender: item.gender || gender || 'neutral'
        }));

    if (!candidates || candidates.length === 0) {
        alert('候補が見つかりませんでした。読みを変えてもう一度試してください。');
        return;
    }

    startUniversalSwipe('nickname', candidates, {
        title: '読みで選ぶ',
        subtitle: `${nicknameBaseReading} から名前候補を選んでください`,
        onLike: (item, action) => {
            if (typeof addReadingToStock === 'function') {
                addReadingToStock(item.reading, nicknameBaseReading, item.tags || [], {
                    isSuper: action === 'super',
                    gender: item.gender || gender || 'neutral',
                    clearHidden: true
                });
            }
        },
        onTap: (item) => {
            openReadingCombinationModal(item, nicknameBaseReading);
        },
        renderCard: (item) => renderReadingSwipeCard(item)
    });
}

function initSoundMode() {
    const popularNames = generatePopularNames(gender).map(item => ({
        ...item,
        gender: item.gender || gender || 'neutral'
    }));

    startUniversalSwipe('sound', prepareAdaptiveReadingCandidates(popularNames), {
        title: '響きで選ぶ',
        subtitle: '好みの響きから、名前候補を選んでください',
        onLike: (item, action) => {
            if (typeof addReadingToStock === 'function') {
                addReadingToStock(item.reading, '', item.tags || [], {
                    isSuper: action === 'super',
                    gender: item.gender || gender || 'neutral',
                    clearHidden: true
                });
            }
        },
        onTap: (item) => {
            openReadingCombinationModal(item);
        },
        renderCard: (item) => renderReadingSwipeCard(item)
    });
}

window.openReadingStockModal = openReadingStockModal;
window.saveReadingOnlyFromModal = saveReadingOnlyFromModal;
window.saveReadingCandidateFromModal = saveReadingCandidateFromModal;
window.likePartnerReadingStock = likePartnerReadingStock;
window.startReadingSplitProposalFromStock = startReadingSplitProposalFromStock;
window.startReadingFromStock = startReadingFromStock;
window.renderReadingStockSectionVisible = renderReadingStockSectionVisible;
window.renderReadingStockSection = renderReadingStockSectionVisible;
window.renderReadingCardStarsV2 = renderReadingCardStarsV2;
window.renderReadingTitleWithStarsV2 = renderReadingTitleWithStarsV2;
window.startNicknameCandidateSwipe = startNicknameCandidateSwipe;
window.initSoundMode = initSoundMode;

function renderReadingCardStarsV2(selfSuper, partnerSuper) {
    if (typeof window.renderMeimaySuperStars !== 'function') {
        return selfSuper || partnerSuper ? '<span class="text-[12px] leading-none text-[#fbbc04]">★</span>' : '';
    }
    return window.renderMeimaySuperStars({
        self: !!selfSuper,
        partner: !!partnerSuper,
        style: 'display:flex;gap:2px;font-size:12px;line-height:1;pointer-events:none;'
    });
}

function renderReadingTitleWithStarsV2(label, selfSuper, partnerSuper) {
    const text = String(label || '');
    const stars = renderReadingCardStarsV2(selfSuper, partnerSuper);
    if (!stars) return `<span class="reading-title-text">${text}</span>`;
    return `
        <div class="reading-title-with-stars">
            <span class="reading-title-text">${text}</span>
            <span class="reading-title-star-badge">${stars}</span>
        </div>
    `;
}

function openReadingStockModal(reading) {
    const modal = document.getElementById('modal-reading-detail');
    if (!modal) return;

    const titleEl = document.getElementById('reading-detail-title');
    const infoEl = document.getElementById('reading-detail-info');
    const btnBuild = document.getElementById('reading-detail-btn-build');
    const btnAdd = document.getElementById('reading-detail-btn-add');
    const btnRemove = document.getElementById('reading-detail-btn-remove');
    const stockItem = findReadingStockItem(reading);
    const stockTarget = stockItem?.id || reading;
    const stockSegments = Array.isArray(stockItem?.segments) ? stockItem.segments.filter(Boolean) : [];
    const kanjiCount = liked.filter(item => getReadingBaseReading(item.sessionReading) === getReadingBaseReading(stockItem?.reading || reading) && item.slot >= 0).length;
    const isPromotedReading = !!stockItem?.readingPromoted || kanjiCount > 0;
    const displayReading = getReadingDisplayLabel(stockItem || { reading }, isPromotedReading ? { allowSegments: true } : { forceRaw: true });

    titleEl.textContent = displayReading;
    infoEl.textContent = isPromotedReading ? `${kanjiCount}個の漢字を選びました` : 'まだ漢字を選んでいません';

    btnBuild.style.display = '';
    btnAdd.style.display = '';
    btnRemove.style.display = '';

    btnBuild.textContent = isPromotedReading ? '組み立てる' : '漢字を選ぶ';
    btnBuild.onclick = () => {
        closeModal('modal-reading-detail');
        if (isPromotedReading) {
            openBuildFromReading(stockItem?.id || stockItem?.reading || reading, stockSegments);
        } else {
            startReadingSplitProposalFromStock(stockItem?.id || stockItem?.reading || reading);
        }
    };

    btnAdd.textContent = '漢字を追加する';
    btnAdd.onclick = () => {
        closeModal('modal-reading-detail');
        addMoreForReading(stockItem?.id || stockItem?.reading || reading, stockSegments);
    };
    btnAdd.style.display = isPromotedReading ? '' : 'none';

    btnRemove.textContent = 'ストックから外す';
    btnRemove.onclick = () => {
        removeCompletedReadingFromStock(stockTarget);
        if (typeof openReadingStockModal === 'function') {
            openReadingStockModal(reading);
        }
    };

    modal.classList.add('active');
}

function saveReadingCandidateToStock(option, candidate, asSuper = false) {
    const sessionReading = readingCombinationModalState.item.reading;
    const sessionSegments = Array.isArray(option.path) ? [...option.path] : [];

    addReadingToStock(sessionReading, readingCombinationModalState.item.baseNickname || '', readingCombinationModalState.item.tags || [], {
        segments: sessionSegments,
        isSuper: !!asSuper,
        gender: readingCombinationModalState.item.gender || gender || 'neutral',
        clearHidden: true,
        readingPromoted: true,
        source: 'reading-combination'
    });

    candidate.combination.forEach((piece, slotIndex) => {
        const existing = liked.find(item => item['����'] === piece['����'] && item.slot === slotIndex && item.sessionReading === sessionReading);
        if (existing) {
            existing.isSuper = existing.isSuper || !!asSuper;
            existing.readingPromoted = true;
            existing.source = existing.source || 'reading-combination';
            return;
        }

        liked.push({
            ...piece,
            slot: slotIndex,
            sessionReading,
            sessionSegments,
            readingPromoted: true,
            source: 'reading-combination',
            isSuper: !!asSuper
        });
    });

    if (typeof StorageBox !== 'undefined' && StorageBox.saveLiked) {
        StorageBox.saveLiked();
    }
}

function saveReadingOnlyFromModal(asSuper = false) {
    if (!readingCombinationModalState) return;
    if (Date.now() - readingCombinationModalOpenedAt < 420) return;
    const item = readingCombinationModalState.item || {};
    addReadingToStock(item.reading, item.baseNickname || '', item.tags || [], {
        segments: [],
        isSuper: !!asSuper,
        gender: item.gender || gender || 'neutral',
        clearHidden: true
    });
    if (typeof showToast === 'function') {
        showToast(asSuper ? `${item.reading}を本命として取り込みました` : `${item.reading}を取り込みました`, asSuper ? '★' : '✓');
    }

    if (typeof renderReadingStockSection === 'function') renderReadingStockSection();
    if (typeof refreshPartnerAwareUI === 'function') refreshPartnerAwareUI();
}

function startReadingSplitProposalFromStock(reading) {
    const targetReading = getReadingBaseReading(reading);
    const nameInput = document.getElementById('in-name');
    if (nameInput) nameInput.value = targetReading || reading;
    if (typeof calcSegments === 'function') {
        calcSegments();
        return;
    }
    const stockItem = findReadingStockItem(reading);
    if (!stockItem) return;
    const stockSegments = Array.isArray(stockItem.segments) ? stockItem.segments.filter(Boolean) : [];

    if (typeof openReadingCombinationModal === 'function') {
        openReadingCombinationModal({
            ...stockItem,
            reading: targetReading || stockItem.reading,
            segments: Array.isArray(stockItem.segments) ? stockItem.segments : [],
            forceSplit: true
        }, stockItem.baseNickname || '', '', stockItem.id || stockItem.reading || targetReading || reading);
        return;
    }

    if (typeof openBuildFromReading === 'function') openBuildFromReading(stockItem.id || targetReading || stockItem.reading, stockSegments);
}
function startReadingFromStock(target) {
    const stockItem = findReadingStockItem(target);
    if (!stockItem) return;

    hideReadingFromStock(stockItem.id || stockItem.reading || target);
    appMode = 'nickname';
    window._addMoreFromBuild = false;
    clearCompoundBuildFlow();
    if (!Array.isArray(stockItem.segments) || stockItem.segments.length === 0) {
        const preferred = typeof getPreferredReadingSegments === 'function' ? getPreferredReadingSegments(stockItem.reading) : [];
        segments = Array.isArray(preferred) && preferred.length > 0 ? [...preferred] : [stockItem.reading];
    }

    openBuildFromReading(stockItem.id || stockItem.reading || target, Array.isArray(stockItem.segments) ? stockItem.segments.filter(Boolean) : []);
}

function openReadingCombinationDetailFromItem(item) {
    if (typeof openReadingCombinationModal !== 'function') return;
    if (!item) return;

    const reading = getReadingBaseReading(item.reading || item.sessionReading || '') || item.reading || item.sessionReading || '';
    openReadingCombinationModal({
        ...item,
        reading,
        forceSplit: false
    }, item.baseNickname || '', '');
}

function openReadingCombinationDetailFromStockTarget(target) {
    const stockItem = findReadingStockItem(target);
    openReadingCombinationDetailFromItem(stockItem);
}

function openPartnerReadingCombinationDetail(index) {
    const pairInsights = typeof window.MeimayPartnerInsights !== 'undefined' ? window.MeimayPartnerInsights : null;
    const partnerReadings = pairInsights?.getPartnerReadingStock ? pairInsights.getPartnerReadingStock() : [];
    const item = partnerReadings[index];
    openReadingCombinationDetailFromItem(item);
}

function likePartnerReadingStock(index) {
    const pairInsights = typeof window.MeimayPartnerInsights !== 'undefined' ? window.MeimayPartnerInsights : null;
    const partnerReadings = pairInsights?.getPartnerReadingStock ? pairInsights.getPartnerReadingStock() : [];
    if (index < 0 || index >= partnerReadings.length) return;

    const item = partnerReadings[index];
    if (!item) return;
    const reading = getReadingBaseReading(item.reading || item.sessionReading || '');
    if (!reading) return;

    addReadingToStock(reading, item.baseNickname || '', item.tags || [], {
        segments: [],
        isSuper: false,
        partnerSuper: !!item.isSuper,
        gender: item.gender || gender || 'neutral',
        source: 'partner-reading',
        clearHidden: true
    });

    if (typeof showToast === 'function') showToast(`${reading}を取り込みました`, '✓');
    if (typeof renderReadingStockSection === 'function') renderReadingStockSection();
    if (typeof refreshPartnerAwareUI === 'function') refreshPartnerAwareUI();
}

function renderReadingStockSectionV2() {
    const pendingStock = getReadingStock();
    const section = document.getElementById('reading-stock-section');
    if (!section) return;

    const history = typeof getReadingHistory === 'function' ? getReadingHistory() : [];
    const readingToSegments = {};
    history.forEach(h => {
        const historyKey = getReadingStockKey(h.reading, h.segments || []);
        readingToSegments[historyKey] = h.segments;
        if (!readingToSegments[h.reading]) readingToSegments[h.reading] = h.segments;
    });

    let removedList = [];
    try { removedList = JSON.parse(localStorage.getItem('meimay_hidden_readings') || '[]'); } catch (e) { }
    const removedReadingSet = new Set(removedList.map(item => getReadingBaseReading(item)).filter(Boolean));

    const ownLiked = getVisibleOwnLikedReadingsForUI();
    const completedReadings = [...new Set(
        ownLiked
            .filter(item => item.sessionReading && item.sessionReading !== 'FREE' && item.sessionReading !== 'SEARCH' && item.slot >= 0 && !removedReadingSet.has(getReadingBaseReading(item.sessionReading)))
            .map(item => getReadingBaseReading(item.sessionReading))
            .filter(Boolean)
    )];
    const completedReadingSet = new Set(completedReadings);

    const displayPendingStock = [];
    const seenPendingReadings = new Set();
    sortReadingStockMatches(
        pendingStock.filter(item => {
            const readingKey = getReadingBaseReading(item.reading || item.sessionReading || '');
            return readingKey && !removedReadingSet.has(readingKey);
        })
    ).forEach(item => {
        const readingKey = getReadingBaseReading(item.reading || item.sessionReading || '');
        if (!readingKey || seenPendingReadings.has(readingKey)) return;
        seenPendingReadings.add(readingKey);
        displayPendingStock.push(item);
    });

    const pairInsights = typeof window.MeimayPartnerInsights !== 'undefined' ? window.MeimayPartnerInsights : null;
    const partnerReadings = pairInsights?.getPartnerReadingStock ? pairInsights.getPartnerReadingStock() : [];
    const partnerReadingCollection = pairInsights?.getPartnerReadingCollection ? pairInsights.getPartnerReadingCollection() : partnerReadings;
    const partnerReadingByKey = new Map();
    const partnerReadingByReading = new Map();
    partnerReadingCollection.forEach(item => {
        const key = getPartnerViewReadingKey(item, pairInsights);
        if (key && !partnerReadingByKey.has(key)) partnerReadingByKey.set(key, item);
        const normalizedReading = getPartnerViewNormalizedReading(item?.reading, pairInsights);
        if (normalizedReading && !partnerReadingByReading.has(normalizedReading)) partnerReadingByReading.set(normalizedReading, item);
    });

    const compareCardEntries = (a, b, getStarValue = (entry) => !!entry?.isSuper) => {
        const aStar = getStarValue(a) ? 1 : 0;
        const bStar = getStarValue(b) ? 1 : 0;
        if (aStar !== bStar) return bStar - aStar;
        const aReading = getReadingBaseReading(a?.reading || a?.sessionReading || '');
        const bReading = getReadingBaseReading(b?.reading || b?.sessionReading || '');
        return aReading.localeCompare(bReading, 'ja');
    };

    const completedCards = completedReadings.map(reading => {
        const kanjiCount = ownLiked.filter(item => getReadingBaseReading(item.sessionReading) === reading && item.slot >= 0).length;
        const ownItem = findReadingStockItem(reading);
        const segmentSource = Array.isArray(ownItem?.segments) ? ownItem.segments.filter(Boolean) : [];
        const key = getPartnerViewReadingKey({ reading, segments: segmentSource }, pairInsights);
        const normalizedReading = getPartnerViewNormalizedReading(reading, pairInsights);
        return {
            reading,
            display: segmentSource.length > 0 ? segmentSource.join('/') : reading,
            segments: segmentSource,
            key,
            normalizedReading,
            ownItem,
            partnerItem: partnerReadingByKey.get(key) || partnerReadingByReading.get(normalizedReading) || null,
            kanjiCount
        };
    }).sort((a, b) => compareCardEntries(a, b, entry => !!(entry.ownItem?.isSuper || entry.ownItem?.ownSuper)));

    const completedMatchedKeys = new Set(completedCards.filter(item => item.partnerItem).map(item => item.key).filter(Boolean));
    const matchedReadingKeys = new Set((pairInsights?.getMatchedReadingItems ? pairInsights.getMatchedReadingItems() : []).map(item => getPartnerViewReadingKey(item, pairInsights)).filter(Boolean));
    const matchedReadingValues = new Set((pairInsights?.getMatchedReadingItems ? pairInsights.getMatchedReadingItems() : []).map(item => getPartnerViewNormalizedReading(item?.reading, pairInsights)).filter(Boolean));
    completedMatchedKeys.forEach(key => matchedReadingKeys.add(key));
    completedCards.forEach(item => {
        if (item.partnerItem && item.normalizedReading) matchedReadingValues.add(item.normalizedReading);
    });

    const isReadingMatchedForView = (item) => {
        const key = getPartnerViewReadingKey(item, pairInsights);
        if (key && matchedReadingKeys.has(key)) return true;
        const normalizedReading = getPartnerViewNormalizedReading(item?.reading, pairInsights);
        return normalizedReading ? matchedReadingValues.has(normalizedReading) : false;
    };

    const pendingOnly = displayPendingStock.filter(item => !completedReadingSet.has(getReadingBaseReading(item.reading || item.sessionReading || '')));
    const soundFilter = getReadingStockSoundFilter();
    const normalizedSoundFilter = normalizeReadingStockSoundValue(soundFilter?.reading || '');
    const matchesSoundFilter = (item) => {
        if (!normalizedSoundFilter) return true;
        const itemBase = normalizeReadingStockSoundValue(item?.baseNickname || '');
        const itemReading = normalizeReadingStockSoundValue(item?.reading || item?.sessionReading || '');
        if (!itemBase && !itemReading) return false;
        if (soundFilter?.position === 'suffix') {
            return itemBase.endsWith(normalizedSoundFilter) || itemReading.endsWith(normalizedSoundFilter);
        }
        return itemBase.startsWith(normalizedSoundFilter) || itemReading.startsWith(normalizedSoundFilter);
    };
    const pendingOnlyBySound = pendingOnly.filter(matchesSoundFilter);
    const partnerPendingCards = [];
    const seenPartnerPendingReadings = new Set();
    partnerReadings
        .map((item, originalIndex) => ({ item, originalIndex }))
        .filter(({ item }) => !isReadingMatchedForView(item))
        .sort((a, b) => compareCardEntries(a.item, b.item, entry => !!(entry.isSuper || entry.ownSuper || entry.partnerSuper)))
        .forEach(entry => {
            const readingKey = getReadingBaseReading(entry.item?.reading || entry.item?.sessionReading || '');
            if (!readingKey || seenPartnerPendingReadings.has(readingKey)) return;
            seenPartnerPendingReadings.add(readingKey);
            partnerPendingCards.push(entry);
        });

    const partnerViewState = typeof window.getMeimayPartnerViewState === 'function' ? window.getMeimayPartnerViewState() : { readingFocus: 'all' };
    const readingFocus = ['all', 'partner', 'matched'].includes(partnerViewState.readingFocus) ? partnerViewState.readingFocus : 'all';
    const partnerName = pairInsights?.getPartnerDisplayName ? pairInsights.getPartnerDisplayName() : (typeof getPartnerRoleLabel === 'function' ? getPartnerRoleLabel(MeimayShare?.partnerSnapshot?.role) : 'パートナー');

    const showOwnSections = readingFocus !== 'partner';
    const visibleCompleted = showOwnSections ? completedCards.filter(item => readingFocus !== 'matched' || isReadingMatchedForView(item)) : [];
    const visiblePendingOnly = showOwnSections ? pendingOnlyBySound.filter(item => readingFocus !== 'matched' || isReadingMatchedForView(item)) : [];
    const visiblePartnerReadings = partnerPendingCards;

    const hasContent = visibleCompleted.length > 0 || visiblePendingOnly.length > 0 || visiblePartnerReadings.length > 0;
    const emptyMsg = document.getElementById('reading-stock-empty');
    if (emptyMsg) emptyMsg.classList.toggle('hidden', hasContent || readingFocus !== 'all');

    if (!hasContent) {
        if (readingFocus === 'partner' || readingFocus === 'matched') {
            const message = readingFocus === 'matched' ? 'まだ一致した読みはありません' : `${partnerName}の読みストックはまだありません`;
            section.innerHTML = `
                <div class="text-center py-16 text-sm text-[#a6967a]">
                    <div class="text-4xl mb-4 opacity-50">${readingFocus === 'matched' ? '★' : '♪'}</div>
                    <p>${message}</p>
                    <button onclick="clearReadingPartnerFocus()" class="mt-4 inline-flex items-center rounded-full border border-[#eadfce] bg-white px-4 py-2 text-[11px] font-bold text-[#8b7e66] active:scale-95">
                        フィルタを解除
                    </button>
                </div>
            `;
        } else {
            section.innerHTML = '';
        }
        return;
    }

    let html = '';

    if (readingFocus === 'partner' || readingFocus === 'matched') {
        const bannerTone = getReadingCardToneV2(readingFocus === 'matched' ? 'matched' : 'partner');
        const bannerTitle = readingFocus === 'matched' ? '一致した読み' : `${partnerName}の読みストック`;
        const bannerBody = readingFocus === 'matched' ? 'パートナーと自分の読みが重なっているものをまとめて表示しています。' : `${partnerName}の読み候補を自分のストックに取り込めます。`;
        html += `
            <div class="rounded-2xl px-4 py-3 mb-4" style="${bannerTone.card}">
                <div class="flex items-center justify-between gap-3">
                    <div>
                        <div class="text-[10px] font-black tracking-[0.18em] uppercase" style="color:${bannerTone.sub}">${readingFocus === 'matched' ? 'Matched' : 'Partner'}</div>
                        <div class="mt-1 text-sm font-bold text-[#4f4639]">${bannerTitle}</div>
                        <div class="mt-1 text-[11px] text-[#8b7e66]">${bannerBody}</div>
                    </div>
                    <button onclick="clearReadingPartnerFocus()" class="shrink-0 rounded-full px-3 py-1.5 text-[11px] font-bold active:scale-95" style="${bannerTone.actionGhost}">
                        フィルタを解除
                    </button>
                </div>
            </div>
        `;
    }

    if (visibleCompleted.length > 0) {
        html += `<div class="mb-6">
            <div class="text-xs font-black text-[#bca37f] mb-3 tracking-wider uppercase">漢字を選んだ読み</div>
            <div class="space-y-2">`;

        visibleCompleted.forEach(item => {
            const kind = isReadingMatchedForView(item) ? 'matched' : 'self';
            const tone = getReadingCardToneV2(kind);
            const detailPayload = JSON.stringify(item.ownItem || item)
                .replace(/&/g, '&amp;')
                .replace(/"/g, '&quot;');
            html += `
                <div class="rounded-2xl p-3 flex items-center gap-3 hover:-translate-y-[1px] transition-all cursor-pointer active:scale-[0.98]"
                     style="${tone.card}"
                     onclick="event.stopPropagation(); openReadingCombinationDetailFromItem(${detailPayload})">
                    <div class="flex-1 min-w-0">
                        <div class="text-lg font-black leading-tight" style="color:${tone.title}">
                            ${renderReadingTitleWithStarsV2(
                                item.display,
                                item.ownItem?.isSuper || item.ownItem?.ownSuper,
                                false
                            )}
                        </div>
                        <div class="mt-1 text-[9px]" style="color:${tone.sub}">${item.kanjiCount}個の漢字</div>
                    </div>
                    <button onclick='event.stopPropagation(); openBuildFromReading(${JSON.stringify(String(item.id || item.reading || ''))}, ${JSON.stringify(Array.isArray(item.segments) ? item.segments.filter(Boolean) : [])})'
                        class="text-xs font-bold px-4 py-2 rounded-full whitespace-nowrap transition-all active:scale-95 shadow-sm"
                        style="${tone.action}">
                        組み立てる
                    </button>
                </div>`;
        });

        html += `</div></div>`;
    }

    if (visiblePendingOnly.length > 0) {
        const groups = {};
        visiblePendingOnly.forEach(item => {
            const key = getReadingStockGroupKey(item) || '漢字を選んでいない読み';
            if (!groups[key]) groups[key] = [];
            groups[key].push(item);
        });

        const groupEntries = Object.entries(groups).sort((a, b) => {
            const aStar = a[1].some(item => isReadingStockStarred(item)) ? 1 : 0;
            const bStar = b[1].some(item => isReadingStockStarred(item)) ? 1 : 0;
            if (aStar !== bStar) return bStar - aStar;
            return a[0].localeCompare(b[0], 'ja');
        });

        html += `<div class="mb-5">
            <div class="text-xs font-black text-[#a6967a] mb-3 tracking-wider uppercase">漢字を選んでいない読み</div>`;

        groupEntries.forEach(([groupName, items]) => {
            const sortedItems = [...items].sort((a, b) => compareCardEntries(a, b, entry => isReadingStockStarred(entry)));
            html += `<div class="mb-3">
                ${groupName === '漢字を選んでいない読み' ? '' : `<div class="text-[10px] text-[#bca37f] mb-1">${groupName}</div>`}
                <div class="space-y-2">
                    ${sortedItems.map(item => {
                        const isPromoted = !!item.readingPromoted;
                        const display = getReadingDisplayLabel(item, isPromoted ? { allowSegments: true } : { forceRaw: true });
                        const readingKey = getReadingBaseReading(item.reading || item.sessionReading || '');
                        const kanjiCount = ownLiked.filter(entry => getReadingBaseReading(entry.sessionReading) === readingKey && entry.slot >= 0).length;
                        const key = getPartnerViewReadingKey(item, pairInsights);
                        const partnerItem = partnerReadingByKey.get(key) || partnerReadingByReading.get(getPartnerViewNormalizedReading(item?.reading, pairInsights)) || null;
                        const kind = isReadingMatchedForView(item) ? 'matched' : 'self';
                        const tone = getReadingCardToneV2(kind);
                        const actionLabel = isPromoted ? '組み立てる' : '漢字を選ぶ';
                        const actionHandler = isPromoted ? 'startReadingFromStock' : 'startReadingSplitProposalFromStock';
                        return `
                        <div class="rounded-2xl p-3 hover:-translate-y-[1px] transition-all cursor-pointer active:scale-[0.98]" style="${tone.card}" data-reading="${JSON.stringify(String(item.reading || ''))}" data-stock-id="${JSON.stringify(String(item.id || ''))}" onclick="event.stopPropagation(); openReadingCombinationDetailFromItem(${JSON.stringify(item).replace(/&/g, '&amp;').replace(/"/g, '&quot;')})">
                            <div class="flex items-center justify-between gap-2">
                                <button onclick="event.stopPropagation(); openReadingCombinationDetailFromItem(${JSON.stringify(item).replace(/&/g, '&amp;').replace(/"/g, '&quot;')})" class="flex-1 text-left active:scale-95 transition-transform">
                                    <div class="text-lg font-black leading-tight" style="color:${tone.title}">
                                        ${renderReadingTitleWithStarsV2(
                                            display,
                                            item.isSuper || item.ownSuper,
                                            false
                                        )}
                                    </div>
                                    <div class="mt-1 text-[9px]" style="color:${tone.sub}">${kanjiCount}件の漢字候補</div>
                                </button>
                                <button onclick='event.stopPropagation(); if(typeof ${actionHandler} === "function") ${actionHandler}(${JSON.stringify(String(item.id || item.reading || ""))});' class="shrink-0 px-4 py-2 rounded-full text-xs font-bold text-white whitespace-nowrap shadow-sm active:scale-95 transition-all" style="${tone.action}">
                                    ${actionLabel}
                                </button>
                            </div>
                        </div>`;
                    }).join('')}
                </div>
            </div>`;
        });

        html += `</div>`;
    }

    if (visiblePartnerReadings.length > 0) {
        html += `<div class="mb-5">
            <div class="text-xs font-black text-[#dd7d73] mb-3 tracking-wider uppercase">${partnerName}の読みストック</div>
            <div class="space-y-2">
                ${visiblePartnerReadings.map(entry => {
                    const item = entry.item;
                    const display = getReadingDisplayLabel(item, { forceRaw: true });
                    const tone = getReadingCardToneV2('partner');
                    const detailPayload = JSON.stringify(item)
                        .replace(/&/g, '&amp;')
                        .replace(/"/g, '&quot;');
                    return `
                        <div class="w-full rounded-2xl p-3 flex items-center gap-3 hover:-translate-y-[1px] transition-all cursor-pointer active:scale-[0.98]" style="${tone.card}" onclick="openReadingCombinationDetailFromItem(${detailPayload})">
                            <div class="flex-1 min-w-0">
                                <div class="text-lg font-black leading-tight" style="color:${tone.title}">
                                    ${renderReadingTitleWithStarsV2(display, false, item.isSuper)}
                                </div>
                            </div>
                            <button onclick="event.stopPropagation(); likePartnerReadingStock(${entry.originalIndex})" class="shrink-0 px-4 py-2 rounded-full text-[11px] font-bold shadow-sm active:scale-95 whitespace-nowrap" style="${tone.action}">
                                取り込む
                            </button>
                        </div>`;
                }).join('')}
            </div>
        </div>`;
    }

    section.innerHTML = html;
}

function renderReadingStockSectionVisible() {
    renderReadingStockSectionV2();
}

function startNicknameCandidateSwipe(baseReading) {
    const flowBaseReading = toHira(baseReading || '');
    nicknameBaseReading = flowBaseReading;

    const candidates = generateNameCandidates(flowBaseReading, gender, nicknamePosition)
        .map(item => ({
            ...item,
            gender: item.gender || gender || 'neutral'
        }));

    if (!candidates || candidates.length === 0) {
        alert('候補が見つかりませんでした。別の読みで試してください。');
        return;
    }

    startUniversalSwipe('nickname', candidates, {
        title: '読みで選ぶ',
        subtitle: `${flowBaseReading} をもとに、気になる読みを選んでください`,
        onLike: (item, action) => {
            if (typeof addReadingToStock === 'function') {
                addReadingToStock(item.reading, flowBaseReading, item.tags || [], {
                    isSuper: action === 'super',
                    gender: item.gender || gender || 'neutral',
                    clearHidden: true
                });
            }
        },
        onTap: (item) => {
            openReadingCombinationModal(item, flowBaseReading);
        },
        renderCard: (item) => renderReadingSwipeCard(item)
    });
}

function initSoundMode() {
    clearReadingStockSoundFilter();
    const popularNames = generatePopularNames(gender).map(item => ({
        ...item,
        gender: item.gender || gender || 'neutral'
    }));

    startUniversalSwipe('sound', prepareAdaptiveReadingCandidates(popularNames), {
        title: '響きで選ぶ',
        subtitle: '好みが固まるまでは幅広く、だんだん寄せていきます',
        onLike: (item, action) => {
            if (typeof addReadingToStock === 'function') {
                addReadingToStock(item.reading, '', item.tags || [], {
                    isSuper: action === 'super',
                    gender: item.gender || gender || 'neutral',
                    clearHidden: true
                });
            }
        },
        onTap: (item) => {
            openReadingCombinationModal(item);
        },
        renderCard: (item) => renderReadingSwipeCard(item)
    });
}

window.openReadingStockModal = openReadingStockModal;
window.saveReadingOnlyFromModal = saveReadingOnlyFromModal;
window.saveReadingCandidateFromModal = saveReadingCandidateFromModal;
window.likePartnerReadingStock = likePartnerReadingStock;
window.startReadingSplitProposalFromStock = startReadingSplitProposalFromStock;
window.startReadingFromStock = startReadingFromStock;
window.renderReadingStockSectionVisible = renderReadingStockSectionVisible;
window.renderReadingStockSection = renderReadingStockSectionVisible;
window.renderReadingCardStarsV2 = renderReadingCardStarsV2;
window.renderReadingTitleWithStarsV2 = renderReadingTitleWithStarsV2;
window.startNicknameCandidateSwipe = startNicknameCandidateSwipe;
window.initSoundMode = initSoundMode;
