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
// gender is defined in 01-core.js

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

function getReadingHistoryEntryByReading(reading) {
    const history = typeof getReadingHistory === 'function' ? getReadingHistory() : [];
    return history.find(item => item.reading === reading && item.compoundFlow) || history.find(item => item.reading === reading) || null;
}

function shouldRebuildCompoundFlow(flow) {
    if (!flow || !Array.isArray(flow.segments) || flow.segments.length === 0) return true;
    const placeholderCount = flow.segments.filter(seg => typeof seg === 'string' && /^__compound_slot_\d+__$/.test(seg)).length;
    const fixedCount = flow.fixedSlotsBySlot ? Object.keys(flow.fixedSlotsBySlot).length : 0;
    return placeholderCount > 0 && fixedCount < placeholderCount;
}

function restoreCompoundBuildFlowFromLiked(reading, fallbackEntry = null) {
    if (!Array.isArray(liked) || !reading) return null;

    const seededItems = liked
        .filter(item =>
            item &&
            item.sessionReading === reading &&
            item._compoundSeeded &&
            Array.isArray(item.sessionSegments) &&
            item.sessionSegments.length > 0
        )
        .sort((a, b) => (Number(a.slot) || 0) - (Number(b.slot) || 0));

    if (seededItems.length === 0) return null;

    const template = seededItems[0];
    const segmentsForFlow = Array.isArray(template.sessionSegments) && template.sessionSegments.length > 0
        ? [...template.sessionSegments]
        : seededItems.map((_, idx) => `__compound_slot_${idx}__`);
    const historyEntry = fallbackEntry || getReadingHistoryEntryByReading(reading);
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

/**
 * 読み入力画面: ストックがあればプルダウンを表示
 */
function initReadingStockPicker() {
    const stock = (typeof getReadingStock === 'function') ? getReadingStock() : [];
    const pickerWrap = document.getElementById('reading-stock-picker');
    const list = document.getElementById('reading-stock-picker-list');
    if (!pickerWrap || !list) return;

    if (stock.length === 0) {
        pickerWrap.classList.add('hidden');
        return;
    }
    pickerWrap.classList.remove('hidden');
    list.innerHTML = stock.map(r => {
        const val = typeof r === 'object' ? r.reading : r;
        return `
        <button onclick="selectReadingFromStock('${val}')"
            class="w-full text-left px-4 py-2.5 text-sm text-[#5d5444] font-bold hover:bg-[#fdf7ef] border-b border-[#f5ede0] last:border-0 transition-colors">
            ${val}
        </button>`;
    }).join('');
}

function selectReadingFromStock(reading) {
    const input = document.getElementById('in-name');
    if (input) input.value = reading;
    // ドロップダウンを閉じる
    const list = document.getElementById('reading-stock-picker-list');
    const arrow = document.getElementById('reading-stock-picker-arrow');
    if (list) list.classList.add('hidden');
    if (arrow) arrow.textContent = '▼';
}

function toggleReadingStockPicker() {
    const list = document.getElementById('reading-stock-picker-list');
    const arrow = document.getElementById('reading-stock-picker-arrow');
    if (!list) return;
    const isHidden = list.classList.contains('hidden');
    list.classList.toggle('hidden');
    if (arrow) arrow.textContent = isHidden ? '▲' : '▼';
}

/**
 * 「響きから探す」エントリー：入れたい音があるかどうかを確認
 */
function initSoundModeEntry() {
    console.log('UI_FLOW: initSoundModeEntry');
    soundModeEntryOrigin = false;
    soundEntryMode = 'browse';
    changeScreen('scr-input-sound-entry');
    renderSoundEntryScreen();
    updateSoundEntryModeUI();
}

function renderSoundEntryScreen() {
    const screen = document.getElementById('scr-input-sound-entry');
    if (!screen) return;

    screen.innerHTML = `
        <div class="glass-card p-8 rounded-[50px] w-full max-w-sm text-center mt-10 shadow-2xl mx-auto">
            <p class="label-mini mb-2">響きから探す</p>
            <h2 class="text-3xl font-black text-[#5d5444] mb-5">どちらで探しますか？</h2>

            <div class="space-y-3 text-left">
                <button
                    id="sound-entry-choice-input"
                    onclick="selectSoundEntryMode('input')"
                    class="w-full rounded-[30px] border-2 border-[#d9c5a4] bg-[#fffdf9] px-5 py-4 shadow-sm transition-all active:scale-[0.99]">
                    <div class="flex items-start gap-3">
                        <span class="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-[#d9c5a4] bg-[#fff8ef] text-[#b9965b] text-xs font-black">✓</span>
                        <div>
                            <div class="text-lg font-black text-[#5d5444]">入れたい音から探す</div>
                            <p class="mt-1 text-sm text-[#8b7e66] leading-relaxed">例: 「はる」からはじまる名前を探す</p>
                        </div>
                    </div>
                </button>

                <div
                    id="sound-entry-input-panel"
                    class="hidden rounded-[28px] border border-[#eadfcd] bg-[#fffaf3] px-4 py-4">
                    <label for="in-sound-entry" class="block text-sm font-bold text-[#8b7e66] mb-2">入れたい音</label>
                    <input
                        id="in-sound-entry"
                        type="text"
                        maxlength="8"
                        inputmode="kana"
                        placeholder="はる"
                        class="w-full rounded-2xl border border-[#d9c5a4] bg-white px-4 py-3 text-xl font-black text-[#5d5444] text-center shadow-inner outline-none focus:border-[#b9965b]"
                        onkeydown="if(event.key==='Enter'){submitSoundEntry();}">
                    <div class="mt-3 grid grid-cols-2 gap-2 text-xs font-bold text-[#8b7e66]">
                        <label class="sound-entry-pos-label flex items-center justify-center rounded-2xl border border-[#e4d8c7] bg-white px-2 py-2 cursor-pointer">
                            <input type="radio" name="sound-entry-position" value="prefix" class="sr-only" checked onchange="updateSoundEntryModeUI()">
                            <span>「○○」から始まる</span>
                        </label>
                        <label class="sound-entry-pos-label flex items-center justify-center rounded-2xl border border-[#e4d8c7] bg-white px-2 py-2 cursor-pointer">
                            <input type="radio" name="sound-entry-position" value="suffix" class="sr-only" onchange="updateSoundEntryModeUI()">
                            <span>「○○」で終わる</span>
                        </label>
                    </div>
                </div>

                <button
                    id="sound-entry-choice-browse"
                    onclick="selectSoundEntryMode('browse')"
                    class="w-full rounded-[30px] border-2 border-[#e9e0d2] bg-white px-5 py-4 shadow-sm transition-all active:scale-[0.99]">
                    <div class="flex items-start gap-3">
                        <span class="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-[#d4c5af] bg-white text-[#d4c5af] text-xs font-black">○</span>
                        <div>
                            <div class="text-lg font-black text-[#5d5444]">響きを見ながら探す</div>
                            <p class="mt-1 text-sm text-[#8b7e66] leading-relaxed">人気の響きをスワイプして好みを探す</p>
                        </div>
                    </div>
                </button>
            </div>

            <button id="btn-sound-entry-submit" onclick="submitSoundEntry()" class="btn-gold py-4 shadow-xl w-full mt-6">
                響きを見て探す
            </button>
            <button onclick="goBack()" class="text-[#bca37f] text-xl font-semibold mt-5">戻る</button>
        </div>
    `;
}

function selectSoundEntryMode(mode) {
    soundEntryMode = mode === 'input' ? 'input' : 'browse';
    updateSoundEntryModeUI();
}

function updateSoundEntryModeUI() {
    const isInputMode = soundEntryMode === 'input';
    const inputChoice = document.getElementById('sound-entry-choice-input');
    const browseChoice = document.getElementById('sound-entry-choice-browse');
    const inputPanel = document.getElementById('sound-entry-input-panel');
    const submitBtn = document.getElementById('btn-sound-entry-submit');

    if (inputChoice) {
        inputChoice.className = `w-full rounded-[30px] border-2 px-5 py-4 shadow-sm transition-all active:scale-[0.99] ${isInputMode ? 'border-[#c8a873] bg-[#fff8ef]' : 'border-[#e9e0d2] bg-white'}`;
        const icon = inputChoice.querySelector('span');
        if (icon) {
            icon.className = `mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-xs font-black ${isInputMode ? 'border-[#b9965b] bg-[#fff0d7] text-[#b9965b]' : 'border-[#d9c5a4] bg-[#fff8ef] text-[#d1c2a7]'}`;
        }
    }

    if (browseChoice) {
        browseChoice.className = `w-full rounded-[30px] border-2 px-5 py-4 shadow-sm transition-all active:scale-[0.99] ${!isInputMode ? 'border-[#c8a873] bg-[#fff8ef]' : 'border-[#e9e0d2] bg-white'}`;
        const icon = browseChoice.querySelector('span');
        if (icon) {
            icon.className = `mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-xs font-black ${!isInputMode ? 'border-[#b9965b] bg-[#fff0d7] text-[#b9965b]' : 'border-[#d4c5af] bg-white text-[#d4c5af]'}`;
        }
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
        label.className = `sound-entry-pos-label flex items-center justify-center rounded-2xl border px-2 py-2 cursor-pointer ${isChecked ? 'border-[#c8a873] bg-[#fff0d7] text-[#8b6c34]' : 'border-[#e4d8c7] bg-white text-[#8b7e66]'}`;
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

    if (soundEntryMode !== 'input' || !cleaned) {
        appMode = 'sound';
        soundModeEntryOrigin = true;
        initSoundMode();
        return;
    }

    const selectedPosition = document.querySelector('input[name="sound-entry-position"]:checked');
    nicknamePosition = selectedPosition?.value === 'suffix' ? 'suffix' : 'prefix';
    appMode = 'nickname';
    soundModeEntryOrigin = true;
    startNicknameCandidateSwipe(cleaned);
}

function getEncounteredLibrary() {
    try {
        const raw = JSON.parse(localStorage.getItem(ENCOUNTERED_LIBRARY_KEY) || '{}');
        const library = {
            kanji: Array.isArray(raw.kanji) ? raw.kanji : [],
            readings: Array.isArray(raw.readings) ? raw.readings : []
        };

        if (library.kanji.length === 0 && Array.isArray(liked)) {
            library.kanji = liked
                .filter(item => item && item['漢字'])
                .map(item => ({
                    key: item['漢字'],
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
                    },
                    seenCount: 1,
                    likeCount: 1,
                    nopeCount: 0,
                    lastAction: 'like',
                    firstSeenAt: item.savedAt || item.timestamp || new Date().toISOString(),
                    lastSeenAt: item.savedAt || item.timestamp || new Date().toISOString()
                }));
        }

        if (library.readings.length === 0 && typeof getReadingHistory === 'function') {
            library.readings = getReadingHistory().map(item => ({
                key: item.reading,
                reading: item.reading,
                tags: Array.isArray(item.tags) ? [...item.tags] : [],
                examples: [],
                mode: '',
                seenCount: 1,
                likeCount: 1,
                nopeCount: 0,
                lastAction: 'like',
                firstSeenAt: item.searchedAt || new Date().toISOString(),
                lastSeenAt: item.searchedAt || new Date().toISOString()
            }));
        }

        if (typeof noped !== 'undefined' && noped instanceof Set && noped.size > 0) {
            const existingKanjiKeys = new Set(library.kanji.map(item => item?.key || item?.kanji).filter(Boolean));
            const existingReadingKeys = new Set(library.readings.map(item => item?.key || item?.reading).filter(Boolean));
            const historyItems = typeof getReadingHistory === 'function' ? getReadingHistory() : [];
            const now = new Date().toISOString();

            Array.from(noped).forEach((value) => {
                if (!value) return;

                const foundKanji = (typeof master !== 'undefined' && Array.isArray(master))
                    ? master.find(entry => entry && entry['漢字'] === value)
                    : null;

                if (foundKanji || Array.from(String(value)).length === 1) {
                    const kanjiKey = foundKanji?.['漢字'] || String(value);
                    if (existingKanjiKeys.has(kanjiKey)) return;

                    library.kanji.push({
                        key: kanjiKey,
                        kanji: kanjiKey,
                        strokes: foundKanji?.['画数'] ?? null,
                        category: foundKanji?.['カテゴリ'] || '',
                        kanjiReading: foundKanji?.kanji_reading || '',
                        tags: Array.isArray(foundKanji?.tags) ? [...foundKanji.tags] : [],
                        snapshot: foundKanji ? {
                            ...foundKanji,
                            slot: -1,
                            sessionReading: foundKanji.sessionReading || '',
                            sessionSegments: Array.isArray(foundKanji.sessionSegments) ? [...foundKanji.sessionSegments] : [],
                            sessionDisplaySegments: Array.isArray(foundKanji.sessionDisplaySegments) ? [...foundKanji.sessionDisplaySegments] : []
                        } : {
                            '漢字': kanjiKey,
                            '画数': null,
                            'カテゴリ': '',
                            kanji_reading: ''
                        },
                        seenCount: 1,
                        likeCount: 0,
                        nopeCount: 1,
                        lastAction: 'nope',
                        firstSeenAt: now,
                        lastSeenAt: now
                    });
                    existingKanjiKeys.add(kanjiKey);
                    return;
                }

                const readingKey = String(value);
                if (existingReadingKeys.has(readingKey)) return;

                const historyMatch = historyItems.find(item => item?.reading === readingKey);
                library.readings.push({
                    key: readingKey,
                    reading: readingKey,
                    tags: Array.isArray(historyMatch?.tags) ? [...historyMatch.tags] : [],
                    examples: [],
                    mode: historyMatch?.mode || '',
                    seenCount: 1,
                    likeCount: 0,
                    nopeCount: 1,
                    lastAction: 'nope',
                    firstSeenAt: historyMatch?.searchedAt || now,
                    lastSeenAt: historyMatch?.searchedAt || now
                });
                existingReadingKeys.add(readingKey);
            });
        }

        return library;
    } catch (error) {
        console.warn('ENCOUNTERED: Failed to read library', error);
        return { kanji: [], readings: [] };
    }
}

function saveEncounteredLibrary(library) {
    try {
        const safeLibrary = {
            kanji: Array.isArray(library?.kanji) ? library.kanji.slice(0, 300) : [],
            readings: Array.isArray(library?.readings) ? library.readings.slice(0, 300) : []
        };
        localStorage.setItem(ENCOUNTERED_LIBRARY_KEY, JSON.stringify(safeLibrary));
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

    const base = index >= 0 ? list[index] : {
        key,
        seenCount: 0,
        likeCount: 0,
        nopeCount: 0,
        firstSeenAt: now
    };

    const next = {
        ...base,
        ...payload,
        key,
        seenCount: base.seenCount + (options.incrementSeen ? 1 : 0),
        likeCount: base.likeCount + (options.incrementLike ? 1 : 0),
        nopeCount: base.nopeCount + (options.incrementNope ? 1 : 0),
        lastSeenAt: now
    };

    if (action) next.lastAction = action;

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
                    gender: item.gender || gender || 'neutral'
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

function getReadingCardTone(item) {
    const firstTag = item && item.tags && item.tags.length > 0 ? item.tags[0] : '';
    const tagStyle = typeof getTagStyle === 'function' && firstTag
        ? getTagStyle(firstTag)
        : { bgColor: '#fdfaf5' };
    const cardGender = item && item.gender ? item.gender : (gender || 'neutral');
    return {
        bgColor: tagStyle.bgColor || '#fdfaf5',
        borderColor: READING_CARD_GENDER_BORDERS[cardGender] || READING_CARD_GENDER_BORDERS.neutral
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
            sessionSegments: resolvedSegments,
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
    const basePaths = typeof getReadingSegmentPaths === 'function'
        ? getReadingSegmentPaths(inputReading, 12, { strictOnly: true, allowFallback: false })
        : [];

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
    const paths = typeof getReadingSegmentPaths === 'function'
        ? getReadingSegmentPaths(reading, limit * 2, { strictOnly: true, allowFallback: false })
        : [];

    const seen = new Set();
    const normalOptions = paths
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
                examples: candidates.map(candidate => candidate.givenName).slice(0, 3)
            };
        })
        .filter(Boolean)
        .slice(0, limit);

    const compoundOptions = typeof getCompoundReadingOptions === 'function'
        ? getCompoundReadingOptions(reading, extraOptions.compoundLimit || limit, targetGender)
        : [];

    let merged = [...normalOptions, ...compoundOptions];
    if (extraOptions && extraOptions.preferredLabel) {
        merged = merged.filter(option => option.label === extraOptions.preferredLabel);
    }

    return merged;
}

function getPreferredReadingSegments(reading) {
    const options = getReadingSegmentOptions(reading, 1);
    return options.length > 0 ? options[0].path : [];
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
        const readings = [item['音'], item['訓'], item['伝統名のり']]
            .filter(Boolean)
            .join(',')
            .split(/[、,，\s/]+/)
            .map(value => toHira((value || '').trim()))
            .filter(Boolean);
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

function getStrictReadingMatch(item, segment) {
    const target = toHira(segment || '');
    if (!target || !item) return null;

    const targetSeion = typeof toSeion === 'function' ? toSeion(target) : target;
    const targetSokuon = target.replace(/\u3063$/, '\u3064');
    const majorReadings = ((item['\u97F3'] || '') + ',' + (item['\u8A13'] || ''))
        .split(/[\u3001,\uFF0C\s/]+/)
        .map(value => toHira((value || '').trim()).replace(/[^\u3041-\u3093\u30FC]/g, ''))
        .filter(Boolean);
    const minorReadings = (item['\u4F1D\u7D71\u540D\u306E\u308A'] || '')
        .split(/[\u3001,\uFF0C\s/]+/)
        .map(value => toHira((value || '').trim()).replace(/[^\u3041-\u3093\u30FC]/g, ''))
        .filter(Boolean);

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
    const existing = typeof getSavedNames === 'function' ? getSavedNames() : (savedNames || []);
    const updated = [
        saveData,
        ...existing.filter(item => !(item.fullName === saveData.fullName &&
            JSON.stringify((item.combination || []).map(part => part['\u6F22\u5B57'] || part.kanji || '')) ===
            JSON.stringify((saveData.combination || []).map(part => part['\u6F22\u5B57'] || part.kanji || ''))))
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
            gender: readingCombinationModalState.item.gender || gender || 'neutral'
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

    if (typeof showToast === 'function') {
        showToast(`${candidate.givenName}\u3092${asSuper ? 'SUPER\u3067' : ''}\u4FDD\u5B58\u3057\u307E\u3057\u305F`, asSuper ? '⭐' : '💾');
    }

    if (typeof openSavedNames === 'function') {
        openSavedNames();
    }
}

function renderReadingTagBadges(tags) {
    if (!tags || tags.length === 0) return '';

    return `<div class="flex flex-wrap justify-center gap-1.5 mb-2 px-2">${tags.map(tag => {
        const style = typeof getTagStyle === 'function'
            ? getTagStyle(tag)
            : { bgColor: '#F3F4F6', textColor: '#374151', borderColor: '#E5E7EB' };
        return `<span class="inline-block px-2.5 py-1 text-[11px] font-bold rounded-full border shadow-sm" style="background-color:${style.bgColor};color:${style.textColor};border-color:${style.borderColor};">${tag}</span>`;
    }).join('')}</div>`;
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
            <div class="text-center mb-5">
                <div class="text-[10px] font-black text-[#bca37f] tracking-[0.25em] uppercase mb-2">KANJI CANDIDATES</div>
                <h3 class="text-3xl font-black text-[#5d5444] mb-2">${item.reading}</h3>
                <p class="text-xs text-[#8b7e66] leading-relaxed">${surnameStr ? `\u82D7\u5B57\u306B\u5408\u308F\u305B\u308B\u3068 ${preview.visual}\u3002\u5206\u3051\u65B9\u3054\u3068\u306B\u3001\u53B3\u683C\u30E2\u30FC\u30C9\u3067\u4F7F\u3048\u308B\u5019\u88DC\u3060\u3051\u3092\u51FA\u3057\u307E\u3059\u3002` : '\u5206\u3051\u65B9\u3054\u3068\u306B\u3001\u53B3\u683C\u30E2\u30FC\u30C9\u3067\u4F7F\u3048\u308B\u5019\u88DC\u3060\u3051\u3092\u51FA\u3057\u307E\u3059\u3002'}</p>
            </div>
            ${renderReadingTagBadges(item.tags || [])}
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
                                    <button onclick="saveReadingCandidateFromModal(${index}, ${candidateIndex}, false)" class="flex-1 py-2.5 rounded-2xl border-2 border-[#d9c7ab] text-[#8b7e66] font-black text-sm active:scale-95 transition-all">\u4FDD\u5B58</button>
                                    <button onclick="saveReadingCandidateFromModal(${index}, ${candidateIndex}, true)" class="flex-1 py-2.5 rounded-2xl bg-[#b9965b] text-white font-black text-sm shadow-sm active:scale-95 transition-all">SUPER</button>
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
                            addReadingToStock(item.reading, nicknameBaseReading, item.tags || []);
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
        .map(item => {
            let score = 0;
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
                addReadingToStock(item.reading, nicknameBaseReading, item.tags || []);
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
            others.forEach(o => addReadingToStock(o.reading, nicknameBaseReading, o.tags || []));
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
        container.innerHTML = `
            <div class="flex flex-col items-center justify-center h-full text-center px-6">
                <div class="text-[60px] mb-4">✨</div>
                <p class="text-[#bca37f] font-bold text-lg mb-4">チェック完了！</p>
                <p class="text-sm text-[#a6967a] mb-6">いいねした読みはストックに保存されました</p>
                <button onclick="showUniversalList()" class="btn-gold w-full py-4 shadow-md mb-4">終了する →</button>
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
            ${item.isSuper ? '<span class="text-[10px] text-[#fbbc04]">★ SUPER</span>' : ''}
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

    if (bStrict) bStrict.classList.toggle('active', r === 'strict');
    if (bLax) bLax.classList.toggle('active', r === 'lax');
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
            // スキップ：そのスロットには何もしない（裏で全自動引き継ぎさせる要望もあったが、ここでは純粋に「追加で選ぶか飛ばすか」の形。全選択済みとして次スロットへ飛ばすのが旧仕様だったが、今回は「そのスロットの漢字を改めて選ばなくていいように自動で継承する」処理を行う方が親切）
            // 仕様：スキップ＝「もう前の漢字を引き継ぐだけでいいから、この文字のスワイプは飛ばす」
            doInheritKanji([{ slot: slotIdx, segReading: seg, items: newItems }]);

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

    function beginSwiping() {
        if (typeof loadStack === 'function') loadStack();
        changeScreen('scr-main');
        // 初回のみ少し遅れてチュートリアル表示（slot0の場合のみ）
        if (currentPos === 0) {
            setTimeout(() => showTutorial(), 500);
        }
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
    // 既に表示済みならスキップ (デバッグ用に一時的に無効化する場合はここをコメントアウト)
    if (localStorage.getItem('meimay_tutorial_shown_v2')) return;

    const modal = document.getElementById('modal-tutorial');
    if (modal) {
        modal.classList.add('active');
        localStorage.setItem('meimay_tutorial_shown_v2', 'true'); // バージョン変えて再表示させる

        // ステップ1から開始
        tutorialStep = 1;
        updateTutorialScene();
    }
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
        return {
            id: getReadingStockKey(item, []),
            reading: item,
            segments: [],
            baseNickname: '',
            tags: [],
            isSuper: false,
            gender: gender || 'neutral',
            addedAt: new Date().toISOString()
        };
    }

    const reading = item && item.reading ? item.reading : '';
    const segments = Array.isArray(item && item.segments) ? item.segments.filter(Boolean) : [];
    return {
        id: item && item.id ? item.id : getReadingStockKey(reading, segments),
        reading,
        segments,
        baseNickname: item && item.baseNickname ? item.baseNickname : '',
        tags: Array.isArray(item && item.tags) ? [...new Set(item.tags.filter(Boolean))] : [],
        isSuper: !!(item && item.isSuper),
        gender: item && item.gender ? item.gender : (gender || 'neutral'),
        addedAt: item && item.addedAt ? item.addedAt : new Date().toISOString()
    };
}

function getReadingDisplayLabel(item) {
    return item && item.segments && item.segments.length > 0
        ? item.segments.join('/')
        : item.reading;
}

function matchesReadingStockTarget(item, target) {
    return item.id === target || item.reading === target;
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
}

function addReadingToStock(reading, baseNickname, tags, options = {}) {
    const stock = getReadingStock();
    const normalizedTags = Array.isArray(tags)
        ? [...new Set(tags.filter(tag => typeof tag === 'string' && tag.trim()))]
        : [];
    const normalizedSegments = Array.isArray(options.segments) ? options.segments.filter(Boolean) : [];
    const targetId = getReadingStockKey(reading, normalizedSegments);
    const existing = stock.find(item => item.id === targetId);

    if (existing) {
        existing.tags = [...new Set([...(existing.tags || []), ...normalizedTags])];
        if (!existing.baseNickname && (baseNickname || nicknameBaseReading)) {
            existing.baseNickname = baseNickname || nicknameBaseReading || '';
        }
        if (normalizedSegments.length > 0) existing.segments = normalizedSegments;
        if (options.gender) existing.gender = options.gender;
        existing.isSuper = existing.isSuper || !!options.isSuper;
        saveReadingStock(stock);
        return existing;
    }

    const entry = normalizeReadingStockItem({
        id: targetId,
        reading: reading,
        segments: normalizedSegments,
        baseNickname: baseNickname || nicknameBaseReading || '',
        tags: normalizedTags,
        isSuper: !!options.isSuper,
        gender: options.gender || gender || 'neutral',
        addedAt: new Date().toISOString()
    });

    stock.push(entry);
    saveReadingStock(stock);
    console.log("STOCK: Added reading to stock:", entry);
    return entry;
}

function removeReadingFromStock(target) {
    let stock = getReadingStock();
    stock = stock.filter(item => !matchesReadingStockTarget(item, target));
    saveReadingStock(stock);
    console.log("STOCK: Removed reading from stock:", target);
}

function removeCompletedReadingFromStock(reading) {
    if (!confirm(`「${reading}」をストックリストから外しますか？\n（選んだ漢字は削除されません）`)) return;

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
}

function openReadingStockModal(reading) {
    const modal = document.getElementById('modal-reading-detail');
    if (!modal) return;

    const titleEl = document.getElementById('reading-detail-title');
    const infoEl = document.getElementById('reading-detail-info');
    const btnBuild = document.getElementById('reading-detail-btn-build');
    const btnAdd = document.getElementById('reading-detail-btn-add');
    const btnRemove = document.getElementById('reading-detail-btn-remove');

    titleEl.textContent = reading;

    const kanjiCount = liked.filter(i => i.sessionReading === reading && i.slot >= 0).length;
    infoEl.textContent = `${kanjiCount}個の漢字を選びました`;

    btnBuild.onclick = () => {
        closeModal('modal-reading-detail');
        openBuildFromReading(reading);
    };
    btnAdd.onclick = () => {
        closeModal('modal-reading-detail');
        addMoreForReading(reading);
    };
    btnRemove.onclick = () => {
        closeModal('modal-reading-detail');
        removeCompletedReadingFromStock(reading);
    };

    modal.classList.add('active');
}

function renderReadingStockSection() {
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

    const pendingOnly = pendingStock.filter(item => !completedReadings.includes(item.reading));

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
                            ビルドへ →
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
            <div class="text-xs font-black text-[#a6967a] mb-3 tracking-wider uppercase">未選択の読み</div>`;

        Object.keys(groups).forEach(groupName => {
            const items = groups[groupName];
            html += `<div class="mb-3">
                <div class="text-[10px] text-[#bca37f] mb-1">「${groupName}」より</div>
                <div class="grid grid-cols-2 gap-2">
                    ${items.map(item => {
                        const display = getReadingDisplayLabel(item);
                        const sub = item.segments && item.segments.length > 0 ? `元の読み ${item.reading}` : '漢字を探す →';
                        const badge = item.isSuper
                            ? '<span class="inline-flex px-2 py-0.5 rounded-full bg-[#fff1d8] text-[#b9965b] text-[9px] font-black">SUPER</span>'
                            : '';
                        return `
                        <div class="bg-white border border-[#ede5d8] rounded-xl p-3 hover:border-[#bca37f] transition-all">
                            <div class="flex items-start justify-between gap-2">
                                <button onclick='startReadingFromStock(${JSON.stringify(item.id)})' class="flex-1 text-left active:scale-95 transition-transform">
                                    <div class="text-lg font-black text-[#5d5444] leading-tight">${display}</div>
                                    <div class="text-[9px] text-[#a6967a] mt-1">${sub}</div>
                                </button>
                                <button onclick='removeReadingFromStock(${JSON.stringify(item.id)});renderReadingStockSection()' class="text-[#d4c5af] text-sm ml-1 p-1 rounded-full hover:bg-[#fef2f2] hover:text-[#f28b82]">✕</button>
                            </div>
                            <div class="mt-2 flex items-center gap-2 flex-wrap">${badge}${(item.tags || []).slice(0, 2).map(tag => `<span class="text-[9px] text-[#8b7e66] bg-[#f7f1e7] px-2 py-0.5 rounded-full">${tag}</span>`).join('')}</div>
                        </div>`;
                    }).join('')}
                </div>
            </div>`;
        });

        html += `</div>`;
    }

    section.innerHTML = html;
}

function openBuildFromReading(reading) {
    const entry = getReadingHistoryEntryByReading(reading);
    clearCompoundBuildFlow();
    const nameInput = document.getElementById('in-name');
    if (nameInput) nameInput.value = reading;

    let restoredFlow = null;
    if (entry && entry.compoundFlow) {
        restoredFlow = setCompoundBuildFlow(entry.compoundFlow);
    }
    if (shouldRebuildCompoundFlow(restoredFlow)) {
        restoredFlow = restoreCompoundBuildFlowFromLiked(reading, entry) || restoredFlow;
    }

    if (restoredFlow && Array.isArray(restoredFlow.segments) && restoredFlow.segments.length > 0) {
        segments = [...restoredFlow.segments];
    } else if (entry && entry.segments) {
        segments = [...entry.segments];
    }
    if (typeof openBuild === 'function') openBuild();
}

function addMoreForReading(reading) {
    const entry = getReadingHistoryEntryByReading(reading);
    clearCompoundBuildFlow();
    const nameInput = document.getElementById('in-name');
    if (nameInput) nameInput.value = reading;

    let restoredFlow = null;
    if (entry && entry.compoundFlow) {
        restoredFlow = setCompoundBuildFlow(entry.compoundFlow);
    }
    if (shouldRebuildCompoundFlow(restoredFlow)) {
        restoredFlow = restoreCompoundBuildFlowFromLiked(reading, entry) || restoredFlow;
    }

    if (restoredFlow && Array.isArray(restoredFlow.segments) && restoredFlow.segments.length > 0) {
        segments = [...restoredFlow.segments];
    } else if (entry && entry.segments) {
        segments = [...entry.segments];
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

function startReadingFromStock(target) {
    const stock = getReadingStock();
    const stockItem = stock.find(item => matchesReadingStockTarget(item, target));
    if (!stockItem) return;

    console.log("STOCK: Starting kanji search from stock reading:", stockItem);
    removeReadingFromStock(stockItem.id);
    appMode = 'nickname';
    window._addMoreFromBuild = false;
    clearCompoundBuildFlow();

    if (stockItem.segments && stockItem.segments.length > 0) {
        segments = [...stockItem.segments];
        currentPos = 0;
        swipes = 0;
        currentIdx = 0;
        const nameInput = document.getElementById('in-name');
        if (nameInput) nameInput.value = stockItem.reading;
        if (typeof updateSurnameData === 'function') updateSurnameData();
        seen.clear();
        if (typeof loadStack === 'function') loadStack();
        changeScreen('scr-main');
        return;
    }

    proceedWithNicknameReading(stockItem.reading);
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

// Expose functions to global scope
window.navSearchAction = navSearchAction;
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
    const majorReadings = ((item['\u97F3'] || '') + ',' + (item['\u8A13'] || ''))
        .split(/[\u3001,\uFF0C\s/]+/)
        .map(value => toHira((value || '').trim()).replace(/[^\u3041-\u3093\u30FC]/g, ''))
        .filter(Boolean);
    const minorReadings = (item['\u4F1D\u7D71\u540D\u306E\u308A'] || '')
        .split(/[\u3001,\uFF0C\s/]+/)
        .map(value => toHira((value || '').trim()).replace(/[^\u3041-\u3093\u30FC]/g, ''))
        .filter(Boolean);

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

function findStrictKanjiCandidatesForSegment(segment, limit = 4, targetGender = gender || 'neutral', options = {}) {
    const target = toHira(segment || '');
    if (!target || !master || master.length === 0) return [];

    const segmentIndex = Number(options.segmentIndex || 0);
    const cacheKey = `strict::${target}::${targetGender}::${segmentIndex}`;
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
window.learnSoundPreference = learnSoundPreference;

function pickReadingDisplayCandidates(allCandidates, limit) {
    const selected = [];
    const usedBySlot = [];

    function canUse(candidate, requireFreshAllSlots) {
        return candidate.combination.every((piece, slotIndex) => {
            const kanji = piece && piece['漢字'];
            if (!kanji) return false;
            if (!usedBySlot[slotIndex]) usedBySlot[slotIndex] = new Set();
            return !requireFreshAllSlots || !usedBySlot[slotIndex].has(kanji);
        });
    }

    function markUsed(candidate) {
        candidate.combination.forEach((piece, slotIndex) => {
            const kanji = piece && piece['漢字'];
            if (!kanji) return;
            if (!usedBySlot[slotIndex]) usedBySlot[slotIndex] = new Set();
            usedBySlot[slotIndex].add(kanji);
        });
    }

    const strictPass = allCandidates.filter(candidate => canUse(candidate, true));
    strictPass.forEach((candidate) => {
        if (selected.length >= limit) return;
        selected.push(candidate);
        markUsed(candidate);
    });

    if (selected.length < limit) {
        allCandidates.forEach((candidate) => {
            if (selected.length >= limit) return;
            const exists = selected.some(item => item.givenName === candidate.givenName);
            if (exists) return;
            selected.push(candidate);
        });
    }

    return selected.slice(0, limit);
}

function buildReadingCombinationCandidates(path, limit = 4, targetGender = gender || 'neutral') {
    if (!Array.isArray(path) || path.length === 0) return [];

    const groups = path.map((segment) => {
        const rawGroup = findStrictKanjiCandidatesForSegment(segment, 10, targetGender);
        const pool = rawGroup
            .slice(0, 8)
            .map((item, index) => ({
                ...item,
                _poolOrder: index,
                _displayNoise: Math.random() * 36
            }))
            .sort((a, b) => {
                const aScore = (a._recommendationScore || 0) - (a._poolOrder * 18) + a._displayNoise;
                const bScore = (b._recommendationScore || 0) - (b._poolOrder * 18) + b._displayNoise;
                return bScore - aScore;
            });
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
                score: score + Math.random() * 24,
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

    const sorted = allResults
        .sort((a, b) => b.score - a.score)
        .map(result => ({
            ...result,
            fullName: surnameStr ? `${surnameStr} ${result.givenName}` : result.givenName
        }));

    return pickReadingDisplayCandidates(sorted, limit);
}

function saveReadingCandidateToStock(option, candidate) {
    const sessionReading = readingCombinationModalState.item.reading;
    const sessionSegments = Array.isArray(option.path) ? [...option.path] : [];

    addReadingToStock(
        sessionReading,
        readingCombinationModalState.item.baseNickname || '',
        readingCombinationModalState.item.tags || [],
        {
            segments: sessionSegments,
            isSuper: false,
            gender: readingCombinationModalState.item.gender || gender || 'neutral'
        }
    );

    candidate.combination.forEach((piece, slotIndex) => {
        const existing = liked.find(item =>
            item['漢字'] === piece['漢字'] &&
            item.slot === slotIndex &&
            item.sessionReading === sessionReading
        );

        if (existing) return;

        liked.push({
            ...piece,
            slot: slotIndex,
            sessionReading,
            sessionSegments,
            isSuper: false
        });
    });

    if (typeof StorageBox !== 'undefined' && StorageBox.saveLiked) {
        StorageBox.saveLiked();
    }
}

function saveReadingCandidateFromModal(optionIndex, candidateIndex) {
    if (!readingCombinationModalState) return;
    const option = readingCombinationModalState.options[optionIndex];
    const candidate = option && option.candidates ? option.candidates[candidateIndex] : null;
    if (!option || !candidate) return;

    saveReadingCandidateToStock(option, candidate);

    const reading = readingCombinationModalState.item.reading;
    const surnameRuby = typeof surnameReading !== 'undefined' ? surnameReading : '';
    const combination = candidate.combination.map((piece, slotIndex) => ({
        ...piece,
        slot: slotIndex,
        sessionReading: reading,
        sessionSegments: [...option.path],
        isSuper: false
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

    if (typeof showToast === 'function') {
        showToast(`${candidate.givenName}を保存しました`, '💾');
    }

    if (typeof openSavedNames === 'function') {
        openSavedNames();
    }
}

function renderReadingSwipeCard(item) {
    const preview = getReadingFullNamePreview(item.reading);
    const topLine = preview.ruby && preview.ruby !== item.reading
        ? `<div class="text-[12px] font-bold text-[#8b7e66] mb-2 tracking-wide">${preview.ruby}</div>`
        : '';

    return `
        ${topLine}
        ${renderReadingTagBadges(item.tags)}
        <div class="text-[52px] font-black text-[#5d5444] mb-4 tracking-wider leading-tight" style="word-break:keep-all;overflow-wrap:break-word;">${item.reading}</div>
        <div class="w-full px-4 mt-2">
            <div class="bg-white/70 rounded-2xl p-3 border border-white max-w-[280px] mx-auto shadow-sm">
                <p class="text-[10px] text-[#a6967a] text-center mb-2 font-bold">上位の漢字候補</p>
                <div class="flex justify-center flex-wrap gap-2 text-[#5d5444] font-bold text-sm">
                    ${getSampleKanjiHtml(item)}
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

function saveReadingCombinationFromModal(index) {
    if (!readingCombinationModalState) return;
    const option = readingCombinationModalState.options[index];
    if (!option || !option.candidates || option.candidates.length === 0) return;
    saveReadingCandidateFromModal(index, 0);
}

function getSampleKanjiHtml(item) {
    const options = getReadingSegmentOptions(item.reading, 2);
    const examples = [];

    options.forEach((option) => {
        option.candidates.slice(0, 2).forEach((candidate) => {
            const label = candidate.givenName || candidate.fullName;
            if (!examples.includes(label)) {
                examples.push(label);
            }
        });
    });

    if (examples.length === 0) {
        return '<span class="text-xs text-[#d4c5af]">候補なし</span>';
    }

    return examples.slice(0, 4).map((example) =>
        `<span class="text-sm font-bold mx-1">${example}</span>`
    ).join('');
}

window.closeReadingCombinationModal = closeReadingCombinationModal;
window.saveReadingCandidateFromModal = saveReadingCandidateFromModal;
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

    const querySeion = typeof toSeion === 'function' ? toSeion(query) : query;

    let results = master.map(k => {
        // 不適切フラグチェック
        const flag = k['不適切フラグ'];
        if (flag && flag !== '0' && flag !== 'false' && flag !== 'FALSE') return null;

        // Nopeした漢字は除外
        if (typeof noped !== 'undefined' && noped.has(k['漢字'])) return null;

        let tier = 99; // 1: Exact, 2: Stem(Flex), 3: Prefix(Flex), 4: OtherMatch
        const matchKanji = k['漢字'] === rawQuery;

        if (query || rawQuery) {
            // 1. 完全一致 (Tier 1) - 送り仮名等を除去した形
            const onFull = getFullReadings(k['音'] || '');
            const kunFull = getFullReadings(k['訓'] || '');
            const noriFull = getFullReadings(k['伝統名のり'] || '');
            const allFull = [...onFull, ...kunFull, ...noriFull];
            const isExact = allFull.some(r => r === query || r === querySeion);

            if (isExact || matchKanji) {
                tier = 1;
            } else if (searchFlexibleMode) {
                // 2. 語幹一致 (Tier 2) - 柔軟モードのみ
                const onVariants = getReadingVariants(k['音'] || '');
                const kunVariants = getReadingVariants(k['訓'] || '');
                const isStem = [...onVariants, ...kunVariants].some(r => r === query || r === querySeion);
                
                if (isStem) {
                    tier = 2;
                } else {
                    // 3. 前方一致 (Tier 3) - 柔軟モードのみ
                    const isPrefix = [...onVariants, ...kunVariants].some(r => r.startsWith(query) || r.startsWith(querySeion));
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
            MeimayStats.recordKanjiUnlike(k['漢字']);
        }
    } else {
        const item = { ...k, slot: -1, sessionReading: 'SEARCH' };
        liked.push(item);
        btn.classList.add('bg-[#fffbeb]', 'border-[#bca37f]');
        btn.classList.remove('border-[#eee5d8]');
        if (!btn.querySelector('.absolute')) {
            btn.insertAdjacentHTML('beforeend', '<span class="absolute top-0.5 right-0.5 text-[8px]">❤️</span>');
        }
        if (typeof MeimayStats !== 'undefined' && MeimayStats.recordKanjiLike) MeimayStats.recordKanjiLike(k['漢字']);
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
            MeimayStats.recordKanjiUnlike(kanji);
        }
    } else {
        const found = master.find(m => m['漢字'] === kanji);
        if (found) {
            liked.push({ ...found, slot: -1, sessionReading: 'FREE' });
            if (typeof MeimayStats !== 'undefined' && MeimayStats.recordKanjiLike) MeimayStats.recordKanjiLike(kanji);
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
    if (!item || pairInsights?.isPartnerReadingApproved?.(item)) {
        if (typeof showToast === 'function') showToast('この読み候補は取り込み済みです', '💛');
        return;
    }

    addReadingToStock(item.reading, item.baseNickname || '', Array.isArray(item.tags) ? item.tags : [], {
        segments: Array.isArray(item.segments) ? item.segments : [],
        gender: item.gender || gender || 'neutral'
    });

    if (typeof MeimayPairing !== 'undefined' && MeimayPairing.roomCode) {
        MeimayPairing._autoSyncDebounced?.();
    }

    renderReadingStockSection();
    if (typeof refreshPartnerAwareUI === 'function') refreshPartnerAwareUI();
    if (typeof showToast === 'function') showToast('読み候補をストックに追加しました', '💞');
}

function renderReadingStockSection() {
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

    const ownLiked = (typeof liked !== 'undefined' ? liked : []).filter(item => !item?.fromPartner);
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

    const pendingOnly = pendingStock.filter(item => !completedReadings.includes(item.reading));
    const pairInsights = typeof window.MeimayPartnerInsights !== 'undefined' ? window.MeimayPartnerInsights : null;
    const partnerReadings = pairInsights?.getPartnerReadingStock ? pairInsights.getPartnerReadingStock() : [];
    const pendingPartnerReadings = partnerReadings.filter(item => !pairInsights?.isPartnerReadingApproved?.(item));

    const hasContent = completedReadings.length > 0 || pendingOnly.length > 0 || pendingPartnerReadings.length > 0;
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
            const kanjiCount = ownLiked.filter(i => i.sessionReading === reading && i.slot >= 0).length;
            const segs = readingToSegments[reading];
            const display = segs ? segs.join('/') : reading;
            html += `
                <div class="bg-white border border-[#ede5d8] rounded-xl p-3 flex items-center gap-3 hover:border-[#bca37f] transition-all cursor-pointer active:scale-[0.98]"
                     onclick="openReadingStockModal('${reading}')">
                    <div class="flex-1 min-w-0">
                        <div class="text-lg font-black text-[#5d5444]">${display}</div>
                        <div class="text-[9px] text-[#a6967a]">${kanjiCount}個の漢字</div>
                    </div>
                    <button onclick="event.stopPropagation(); openBuildFromReading('${reading}')"
                        class="text-xs font-bold text-white bg-[#bca37f] px-4 py-2 rounded-full whitespace-nowrap hover:bg-[#a8906c] transition-all active:scale-95 shadow-sm">
                        ビルドへ
                    </button>
                </div>`;
        });

        html += `</div></div>`;
    }

    if (pendingOnly.length > 0) {
        const groups = {};
        pendingOnly.forEach(item => {
            const key = item.baseNickname || '響き・読み';
            if (!groups[key]) groups[key] = [];
            groups[key].push(item);
        });

        html += `<div class="mb-5">
            <div class="text-xs font-black text-[#a6967a] mb-3 tracking-wider uppercase">自分の読みストック</div>`;

        Object.keys(groups).forEach(groupName => {
            const items = groups[groupName];
            html += `<div class="mb-3">
                <div class="text-[10px] text-[#bca37f] mb-1">${groupName}</div>
                <div class="grid grid-cols-2 gap-2">
                    ${items.map(item => {
                        const display = getReadingDisplayLabel(item);
                        const sub = item.segments && item.segments.length > 0 ? `元の読み ${item.reading}` : '漢字を探す';
                        return `
                        <div class="bg-white border border-[#ede5d8] rounded-xl p-3 hover:border-[#bca37f] transition-all">
                            <div class="flex items-start justify-between gap-2">
                                <button onclick='startReadingFromStock(${JSON.stringify(item.id)})' class="flex-1 text-left active:scale-95 transition-transform">
                                    <div class="text-lg font-black text-[#5d5444] leading-tight">${display}</div>
                                    <div class="text-[9px] text-[#a6967a] mt-1">${sub}</div>
                                </button>
                                <button onclick='removeReadingFromStock(${JSON.stringify(item.id)});renderReadingStockSection()' class="text-[#d4c5af] text-sm ml-1 p-1 rounded-full hover:bg-[#fef2f2] hover:text-[#f28b82]">✕</button>
                            </div>
                            <div class="mt-2 flex items-center gap-2 flex-wrap">${(item.tags || []).slice(0, 2).map(tag => `<span class="text-[9px] text-[#8b7e66] bg-[#f7f1e7] px-2 py-0.5 rounded-full">${tag}</span>`).join('')}</div>
                        </div>`;
                    }).join('')}
                </div>
            </div>`;
        });

        html += `</div>`;
    }

    if (pendingPartnerReadings.length > 0) {
        const partnerLabel = typeof getPartnerRoleLabel === 'function'
            ? getPartnerRoleLabel(MeimayShare?.partnerSnapshot?.role)
            : 'パートナー';

        html += `<div class="mb-5">
            <div class="text-xs font-black text-[#dd7d73] mb-3 tracking-wider uppercase">${partnerLabel}の読み候補</div>
            <div class="grid grid-cols-2 gap-2">
                ${pendingPartnerReadings.map((item, index) => {
                    const display = getReadingDisplayLabel(item);
                    const sub = item.baseNickname || 'パートナー候補';
                    return `
                        <div class="bg-white border border-[#f4d3cf] rounded-xl p-3">
                            <div class="inline-flex items-center rounded-full bg-[#fde8e5] px-2 py-0.5 text-[9px] font-bold text-[#dd7d73]">${partnerLabel}</div>
                            <div class="mt-2 text-lg font-black text-[#5d5444] leading-tight">${display}</div>
                            <div class="text-[9px] text-[#a6967a] mt-1">${sub}</div>
                            <div class="mt-2 flex items-center gap-2 flex-wrap">${(item.tags || []).slice(0, 2).map(tag => `<span class="text-[9px] text-[#8b7e66] bg-[#f7f1e7] px-2 py-0.5 rounded-full">${tag}</span>`).join('')}</div>
                            <button onclick="likePartnerReadingStock(${index})" class="mt-3 w-full py-2 rounded-xl bg-gradient-to-r from-[#f8c27a] to-[#e8a96b] text-white text-[11px] font-bold shadow-sm active:scale-95">
                                いいねして追加
                            </button>
                        </div>`;
                }).join('')}
            </div>
        </div>`;
    }

    section.innerHTML = html;
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

    const ownLiked = (typeof liked !== 'undefined' ? liked : []).filter(item => !item?.fromPartner);
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

    const pendingOnly = pendingStock.filter(item => !completedReadings.includes(item.reading));
    const pairInsights = typeof window.MeimayPartnerInsights !== 'undefined' ? window.MeimayPartnerInsights : null;
    const partnerReadings = pairInsights?.getPartnerReadingStock ? pairInsights.getPartnerReadingStock() : [];
    const pendingPartnerReadings = partnerReadings.filter(item => !pairInsights?.isPartnerReadingApproved?.(item));
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
    const visiblePartnerReadings = pendingPartnerReadings;

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
            <div class="text-xs font-black text-[#bca37f] mb-3 tracking-wider uppercase">読み終えた読み</div>
            <div class="space-y-2">`;

        visibleCompleted.forEach(reading => {
            const kanjiCount = ownLiked.filter(i => i.sessionReading === reading && i.slot >= 0).length;
            const segs = readingToSegments[reading];
            const display = segs ? segs.join('/') : reading;
            html += `
                <div class="bg-white border border-[#ede5d8] rounded-xl p-3 flex items-center gap-3 hover:border-[#bca37f] transition-all cursor-pointer active:scale-[0.98]"
                     onclick="openReadingStockModal('${reading}')">
                    <div class="flex-1 min-w-0">
                        <div class="text-lg font-black text-[#5d5444]">${display}</div>
                        <div class="text-[9px] text-[#a6967a]">${kanjiCount}件の漢字</div>
                    </div>
                    <button onclick="event.stopPropagation(); openBuildFromReading('${reading}')"
                        class="text-xs font-bold text-white bg-[#bca37f] px-4 py-2 rounded-full whitespace-nowrap hover:bg-[#a8906c] transition-all active:scale-95 shadow-sm">
                        ビルドへ
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
            <div class="text-xs font-black text-[#a6967a] mb-3 tracking-wider uppercase">自分の読みストック</div>`;

        Object.keys(groups).forEach(groupName => {
            const items = groups[groupName];
            html += `<div class="mb-3">
                <div class="text-[10px] text-[#bca37f] mb-1">${groupName}</div>
                <div class="grid grid-cols-2 gap-2">
                    ${items.map(item => {
                        const display = getReadingDisplayLabel(item);
                        const sub = item.segments && item.segments.length > 0 ? `元の読み ${item.reading}` : '読みを探す';
                        return `
                        <div class="bg-white border border-[#ede5d8] rounded-xl p-3 hover:border-[#bca37f] transition-all">
                            <div class="flex items-start justify-between gap-2">
                                <button onclick='startReadingFromStock(${JSON.stringify(item.id)})' class="flex-1 text-left active:scale-95 transition-transform">
                                    <div class="text-lg font-black text-[#5d5444] leading-tight">${display}</div>
                                    <div class="text-[9px] text-[#a6967a] mt-1">${sub}</div>
                                </button>
                                <button onclick='removeReadingFromStock(${JSON.stringify(item.id)});renderReadingStockSection()' class="text-[#d4c5af] text-sm ml-1 p-1 rounded-full hover:bg-[#fef2f2] hover:text-[#f28b82]">✕</button>
                            </div>
                            <div class="mt-2 flex items-center gap-2 flex-wrap">${(item.tags || []).slice(0, 2).map(tag => `<span class="text-[9px] text-[#8b7e66] bg-[#f7f1e7] px-2 py-0.5 rounded-full">${tag}</span>`).join('')}</div>
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
            <div class="grid grid-cols-2 gap-2">
                ${visiblePartnerReadings.map((item, index) => {
                    const display = getReadingDisplayLabel(item);
                    const sub = item.baseNickname || 'パートナー候補';
                    return `
                        <div class="bg-white border border-[#f4d3cf] rounded-xl p-3">
                            <div class="inline-flex items-center rounded-full bg-[#fde8e5] px-2 py-0.5 text-[9px] font-bold text-[#dd7d73]">${partnerName}</div>
                            <div class="mt-2 text-lg font-black text-[#5d5444] leading-tight">${display}</div>
                            <div class="text-[9px] text-[#a6967a] mt-1">${sub}</div>
                            <div class="mt-2 flex items-center gap-2 flex-wrap">${(item.tags || []).slice(0, 2).map(tag => `<span class="text-[9px] text-[#8b7e66] bg-[#f7f1e7] px-2 py-0.5 rounded-full">${tag}</span>`).join('')}</div>
                            <button onclick="likePartnerReadingStock(${index})" class="mt-3 w-full py-2 rounded-xl bg-gradient-to-r from-[#f8c27a] to-[#e8a96b] text-white text-[11px] font-bold shadow-sm active:scale-95">
                                いいねして追加
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
        const primaryTag = Array.isArray(candidate?.tags) && candidate.tags.length > 0
            ? candidate.tags[0]
            : '#other';
        if (!grouped.has(primaryTag)) grouped.set(primaryTag, []);
        grouped.get(primaryTag).push(candidate);
    });

    grouped.forEach((items, key) => {
        const ranked = [...items].sort((a, b) => getReadingCandidateRankScore(b) - getReadingCandidateRankScore(a));
        const lead = shuffleReadingCandidates(ranked.slice(0, 6));
        grouped.set(key, [...lead, ...ranked.slice(6)]);
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
    nicknameBaseReading = toHira(baseReading || '');

    const candidates = generateNameCandidates(nicknameBaseReading, gender, nicknamePosition)
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
                    gender: item.gender || gender || 'neutral'
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
                    gender: item.gender || gender || 'neutral'
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


