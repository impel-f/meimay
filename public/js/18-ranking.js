/* 18-ranking.js: Ranking screen logic */

let currentRankingType = 'kanji';
const RANKING_PERIOD_STORAGE_KEY = 'meimay_ranking_period_v1';
const RANKING_GENDER_STORAGE_KEY = 'meimay_ranking_gender_v1';

function normalizeRankingGender(value) {
    const raw = String(value || '').trim().toLowerCase();
    if (raw === 'male' || raw === 'female' || raw === 'all') {
        return raw;
    }
    if (raw === 'neutral') {
        return 'all';
    }
    return 'all';
}

function getDefaultRankingGender() {
    const currentGender = typeof gender !== 'undefined' ? gender : 'all';
    const normalized = normalizeRankingGender(currentGender);
    return normalized === 'male' || normalized === 'female' ? normalized : 'all';
}

function loadRankingGenderPreference() {
    try {
        const stored = localStorage.getItem(RANKING_GENDER_STORAGE_KEY);
        if (stored) {
            return normalizeRankingGender(stored);
        }
    } catch (error) {
        // Ignore storage failures and fall back to the current naming setting.
    }

    return getDefaultRankingGender();
}

function saveRankingGenderPreference(value) {
    try {
        localStorage.setItem(RANKING_GENDER_STORAGE_KEY, normalizeRankingGender(value));
    } catch (error) {
        // Non-fatal.
    }
}

function loadRankingPeriodPreference() {
    try {
        const stored = localStorage.getItem(RANKING_PERIOD_STORAGE_KEY);
        if (stored) {
            return normalizeRankingPeriod(stored);
        }
    } catch (error) {
        // Ignore storage failures and fall back to the default period.
    }

    return 'allTime';
}

function saveRankingPeriodPreference(value) {
    try {
        localStorage.setItem(RANKING_PERIOD_STORAGE_KEY, normalizeRankingPeriod(value));
    } catch (error) {
        // Non-fatal.
    }
}

let currentRankingPeriod = loadRankingPeriodPreference();
let currentRankingTab = currentRankingPeriod; // Legacy alias kept in sync with the active period.
let currentRankingGender = loadRankingGenderPreference();

let rankingTouchStartX = 0;
let rankingTouchStartY = 0;
let rankingSwipeSetupDone = false;

function escapeRankingHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function normalizeRankingReadingText(value) {
    if (typeof normalizeEncounteredReadingText === 'function') {
        return normalizeEncounteredReadingText(value);
    }

    const raw = String(value || '').trim();
    if (!raw) return '';

    return raw
        .replace(/[ァ-ヶ]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0x60))
        .replace(/[^ぁ-んー]/g, '');
}

function getRankingCurrentMonthKey(date = new Date()) {
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
        // Fallback below keeps the screen usable in older environments.
    }

    const offsetMs = 9 * 60 * 60 * 1000;
    const shifted = new Date(date.getTime() + offsetMs);
    return `${shifted.getUTCFullYear()}_${String(shifted.getUTCMonth() + 1).padStart(2, '0')}`;
}

function getRankingButton(...ids) {
    for (const id of ids) {
        const el = document.getElementById(id);
        if (el) return el;
    }
    return null;
}

function normalizeRankingPeriod(period) {
    return period === 'monthly' || period === 'weekly' ? 'monthly' : 'allTime';
}

function normalizeRankingType(type) {
    return type === 'reading' ? 'reading' : 'kanji';
}

function getRankingEncounteredReadingItems() {
    if (typeof MeimayPartnerInsights !== 'undefined' && typeof MeimayPartnerInsights.getEncounteredReadingsForRanking === 'function') {
        return MeimayPartnerInsights.getEncounteredReadingsForRanking();
    }

    const library = typeof getEncounteredLibrary === 'function'
        ? getEncounteredLibrary()
        : { kanji: [], readings: [] };
    return Array.isArray(library.readings) ? library.readings : [];
}

function getRankingOwnLikedEntries() {
    if (typeof MeimayPartnerInsights !== 'undefined' && typeof MeimayPartnerInsights.getOwnLiked === 'function') {
        return MeimayPartnerInsights.getOwnLiked();
    }

    return Array.isArray(liked) ? liked.filter((entry) => !entry?.fromPartner) : [];
}

function getRankingOwnReadingStockEntries() {
    if (typeof MeimayPartnerInsights !== 'undefined' && typeof MeimayPartnerInsights.getOwnReadingStock === 'function') {
        return MeimayPartnerInsights.getOwnReadingStock();
    }

    const stock = typeof getReadingStock === 'function' ? getReadingStock() : [];
    return Array.isArray(stock) ? stock.filter((entry) => !entry?.fromPartner) : [];
}

function isRankingKanjiStocked(kanjiStr) {
    const normalizedKanji = String(kanjiStr || '').trim();
    if (!normalizedKanji) return false;

    const ownLiked = getRankingOwnLikedEntries();
    return Array.isArray(ownLiked) && ownLiked.some((entry) => (entry?.['漢字'] || entry?.kanji) === normalizedKanji);
}

function isRankingReadingStocked(reading) {
    const normalizedReading = normalizeRankingReadingText(reading);
    if (!normalizedReading) return false;

    const ownReadings = getRankingOwnReadingStockEntries();
    return Array.isArray(ownReadings) && ownReadings.some((entry) => normalizeRankingReadingText(entry?.reading) === normalizedReading);
}

function getPrimaryKanjiReading(kanjiData) {
    if (!kanjiData) return '';
    const raw = String(kanjiData['音'] || kanjiData['訓'] || kanjiData['読み'] || kanjiData.kanji_reading || '').trim();
    if (!raw) return '';
    return raw.split(/[\s　,、\/／]+/).find(Boolean) || raw;
}

function getRankingCardTone(index) {
    const isTopThree = index < 3;
    return {
        rankClass: 'text-[10px]',
        countClass: isTopThree ? 'bg-[#fff4db] text-[#b9965b]' : 'bg-[#f8f5ef] text-[#8b7e66]'
    };
}

function updateRankingCardState(kind, key, delta = 0, stocked = null) {
    const listContainer = document.getElementById('ranking-list-container');
    if (!listContainer) return false;

    const normalizedKind = kind === 'reading' ? 'reading' : 'kanji';
    const normalizedKey = normalizedKind === 'reading'
        ? normalizeRankingReadingText(key)
        : String(key || '').trim();
    if (!normalizedKey) return false;

    const cards = Array.from(listContainer.querySelectorAll('[data-ranking-kind]'));
    const card = cards.find((el) => {
        const elKind = el.dataset.rankingKind === 'reading' ? 'reading' : 'kanji';
        if (elKind !== normalizedKind) return false;
        const elKey = el.dataset.rankingKey || '';
        return normalizedKind === 'reading'
            ? normalizeRankingReadingText(elKey) === normalizedKey
            : String(elKey).trim() === normalizedKey;
    });
    if (!card) return false;

    const countEl = card.querySelector('[data-ranking-count-display]');
    const statusEl = card.querySelector('[data-ranking-status-label]');
    const currentCount = Number(card.dataset.rankingCount) || 0;
    const nextCount = Math.max(0, currentCount + Number(delta || 0));
    card.dataset.rankingCount = String(nextCount);
    if (countEl) {
        countEl.textContent = `❤${nextCount}`;
    }

    if (stocked === null) {
        return true;
    }

    const stockedText = normalizedKind === 'reading'
        ? (stocked ? 'ストック済み' : '開く')
        : (stocked ? 'ストック済み' : '詳細');
    const stockedBgClass = 'bg-[#fff4db] text-[#b9965b]';
    const notStockedBgClass = 'bg-[#f8f5ef] text-[#8b7e66]';

    card.classList.toggle('border-[#bca37f]', !!stocked);
    card.classList.toggle('ring-1', !!stocked);
    card.classList.toggle('ring-[#bca37f]/20', !!stocked);
    card.classList.toggle('border-[#ede5d8]', !stocked);
    if (statusEl) {
        statusEl.textContent = stockedText;
        statusEl.className = `shrink-0 rounded-xl px-2.5 py-1.5 text-[10px] font-black leading-none whitespace-nowrap ${stocked ? stockedBgClass : notStockedBgClass}`;
    }
    return true;
}

function getRankingPeriodSwitchLabel(period) {
    return period === 'monthly' ? '📅月間順位' : '👑総合順位';
}

function getRankingGenderLabel(value) {
    const normalized = normalizeRankingGender(value);
    if (normalized === 'male') return '男の子';
    if (normalized === 'female') return '女の子';
    return 'すべて';
}

function cycleRankingGender() {
    const current = normalizeRankingGender(currentRankingGender);
    const next = current === 'male'
        ? 'female'
        : current === 'female'
            ? 'all'
            : 'male';
    setRankingGender(next);
}

function getRankingMonthDisplayLabel(date = new Date()) {
    const key = getRankingCurrentMonthKey(date);
    const [year, month] = key.split('_');
    if (!year || !month) return key.replace('_', '/');
    return `${year}/${month}`;
}

function getRankingPeriodSwitchStyle(period) {
    if (period === 'monthly') {
        return {
            button: 'border:1px solid #ead39a;background:linear-gradient(135deg, #fff8e8 0%, #fff1d5 100%);',
            label: '#9a8556',
            value: '#8a6a2f',
            sub: '#b3945f',
            arrowBg: '#fffaf2',
            arrowBorder: '#ecd6a4',
            arrowText: '#8a6a2f'
        };
    }

    return {
        button: 'border:1px solid #e6d8c2;background:linear-gradient(135deg, #fffdf8 0%, #f5eedd 100%);',
        label: '#9a8b78',
        value: '#7e684a',
        sub: '#a6967a',
        arrowBg: '#fffaf5',
        arrowBorder: '#eadfce',
        arrowText: '#7e684a'
    };
}

function getRankingGenderSwitchStyle(value) {
    const normalized = normalizeRankingGender(value);
    if (normalized === 'male') {
        return {
            button: 'border:1px solid #d9e4f5;background:linear-gradient(135deg, #f8fbff 0%, #eef5ff 100%);',
            label: '#7b8fa6',
            value: '#5f7696',
            sub: '#8fa1b8',
            arrowBg: '#f7fbff',
            arrowBorder: '#d9e4f5',
            arrowText: '#5f7696'
        };
    }

    if (normalized === 'female') {
        return {
            button: 'border:1px solid #ead8df;background:linear-gradient(135deg, #fff9fb 0%, #fff1f5 100%);',
            label: '#a8848f',
            value: '#9a6a78',
            sub: '#bc98a3',
            arrowBg: '#fff8fb',
            arrowBorder: '#ead8df',
            arrowText: '#9a6a78'
        };
    }

    return {
        button: 'border:1px solid #e6ddd0;background:linear-gradient(135deg, #fffdf8 0%, #f7f1e7 100%);',
        label: '#9a8b78',
        value: '#8b7758',
        sub: '#a6967a',
        arrowBg: '#fffaf3',
        arrowBorder: '#e8dcc8',
        arrowText: '#8b7758'
    };
}

function renderRankingPeriodSwitch() {
    const mount = document.getElementById('ranking-period-switch');
    if (!mount) return;

    const period = normalizeRankingPeriod(currentRankingPeriod);
    const label = getRankingPeriodSwitchLabel(period);
    const switchStyle = getRankingPeriodSwitchStyle(period);
    const monthLabel = getRankingMonthDisplayLabel();

    mount.innerHTML = `
        <button
            type="button"
            onclick="event.stopPropagation(); toggleRankingPeriod()"
            class="w-full h-full min-h-[4rem] rounded-[1.05rem] px-3 py-1.5 text-center active:scale-95 transition-transform md:rounded-[1.2rem] md:px-3.5 md:py-1.5"
            style="${switchStyle.button}">
            <div class="flex h-full items-center justify-between gap-2">
                <div class="min-w-0 flex-1 flex flex-col items-center justify-center text-center leading-none">
                    <span class="mt-0.5 block whitespace-nowrap text-[8px] font-bold leading-none md:text-[9px]" style="color:${switchStyle.sub};">
                        期間：${escapeRankingHtml(period === 'monthly' ? monthLabel : 'すべて')}
                    </span>
                    <span class="mt-0.5 block whitespace-nowrap text-[12px] font-black leading-none md:text-[13px]" style="color:${switchStyle.value};">
                        ${escapeRankingHtml(label)}
                    </span>
                </div>
                <div class="flex items-center justify-center self-stretch">
                    <span class="inline-flex h-6 w-6 items-center justify-center rounded-full border text-[7px] font-black leading-none" style="background:${switchStyle.arrowBg};border-color:${switchStyle.arrowBorder};color:${switchStyle.arrowText};">▼</span>
                </div>
            </div>
        </button>
    `;
}

function renderRankingGenderSwitch() {
    const mount = document.getElementById('ranking-gender-switch');
    if (!mount) return;

    const selectedGender = normalizeRankingGender(currentRankingGender);
    const selectedGenderLabel = getRankingGenderLabel(selectedGender);
    const switchStyle = getRankingGenderSwitchStyle(selectedGender);

    mount.innerHTML = `
        <button
            type="button"
            onclick="event.stopPropagation(); cycleRankingGender()"
            class="w-full h-full min-h-[4rem] rounded-[1.05rem] px-3 py-1.5 text-center active:scale-95 transition-transform md:rounded-[1.2rem] md:px-3.5 md:py-1.5"
            style="${switchStyle.button}">
            <div class="flex h-full items-center justify-between gap-2">
                <div class="min-w-0 flex-1 flex flex-col items-center justify-center text-center leading-none">
                    <span class="block whitespace-nowrap text-[8px] font-black leading-none tracking-[0.16em] md:text-[9px]" style="color:${switchStyle.label};">
                        性別
                    </span>
                    <span class="mt-0.5 block whitespace-nowrap text-[12px] font-black leading-none md:text-[13px]" style="color:${switchStyle.value};">
                        ${escapeRankingHtml(selectedGenderLabel)}
                    </span>
                </div>
                <div class="flex items-center justify-center self-stretch">
                    <span class="inline-flex h-6 w-6 items-center justify-center rounded-full border text-[7px] font-black leading-none" style="background:${switchStyle.arrowBg};border-color:${switchStyle.arrowBorder};color:${switchStyle.arrowText};">▼</span>
                </div>
            </div>
        </button>
    `;
}

function updateRankingButtonState() {
    const typeButtons = [
        getRankingButton('ranking-type-kanji', 'ranking-tab-kanji'),
        getRankingButton('ranking-type-reading', 'ranking-tab-reading')
    ];

    typeButtons.forEach((button, index) => {
        if (!button) return;
        const isActive = (index === 0 && currentRankingType === 'kanji') || (index === 1 && currentRankingType === 'reading');
        button.className = isActive
            ? 'flex-1 rounded-xl px-3 py-2 text-sm font-bold text-center bg-[#fffbeb] text-[#5d5444] shadow-sm'
            : 'flex-1 rounded-xl px-3 py-2 text-sm font-bold text-center text-[#a6967a]';
    });

    renderRankingPeriodSwitch();
    renderRankingGenderSwitch();
}

function setRankingType(type, options = {}) {
    currentRankingType = normalizeRankingType(type);
    updateRankingButtonState();
    if (options.load !== false) {
        loadRanking();
    }
}

function setRankingPeriod(period, options = {}) {
    currentRankingPeriod = normalizeRankingPeriod(period);
    currentRankingTab = currentRankingPeriod;
    saveRankingPeriodPreference(currentRankingPeriod);
    updateRankingButtonState();
    if (options.load !== false) {
        loadRanking();
    }
}

function setRankingGender(value, options = {}) {
    currentRankingGender = normalizeRankingGender(value);
    saveRankingGenderPreference(currentRankingGender);
    updateRankingButtonState();
    if (options.load !== false) {
        loadRanking();
    }
}

function switchRankingType(type) {
    setRankingType(type);
}

function switchRankingPeriod(period) {
    setRankingPeriod(period);
}

function switchRankingTab(tab) {
    switchRankingPeriod(tab);
}

function switchRankingGender(value) {
    setRankingGender(value);
}

function toggleRankingPeriod() {
    const period = normalizeRankingPeriod(currentRankingPeriod);
    setRankingPeriod(period === 'allTime' ? 'monthly' : 'allTime');
}

async function openRanking() {
    currentRankingPeriod = loadRankingPeriodPreference();
    currentRankingTab = currentRankingPeriod;
    currentRankingGender = loadRankingGenderPreference();
    if (typeof changeScreen === 'function') {
        changeScreen('scr-ranking');
    }
    updateRankingButtonState();
    setupRankingSwipe();
    await loadRanking();
}

function setupRankingSwipe() {
    const container = document.getElementById('ranking-list-container');
    if (!container || rankingSwipeSetupDone) return;
    rankingSwipeSetupDone = true;

    container.addEventListener('touchstart', (e) => {
        rankingTouchStartX = e.touches[0].clientX;
        rankingTouchStartY = e.touches[0].clientY;
    }, { passive: true });

    container.addEventListener('touchend', (e) => {
        const dx = e.changedTouches[0].clientX - rankingTouchStartX;
        const dy = e.changedTouches[0].clientY - rankingTouchStartY;
        if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.4) {
            if (dx < 0 && currentRankingPeriod === 'allTime') {
                switchRankingPeriod('monthly');
            } else if (dx > 0 && currentRankingPeriod === 'monthly') {
                switchRankingPeriod('allTime');
            }
        }
    }, { passive: true });
}

function getMonthlyReadingCount(entry, currentMonthKey) {
    const monthKey = typeof entry?.monthlyMonthKey === 'string' ? entry.monthlyMonthKey : '';
    const monthlySeenCount = Number(entry?.monthlySeenCount) || 0;

    if (monthKey === currentMonthKey) {
        return monthlySeenCount;
    }

    const lastSeenAt = entry?.lastSeenAt ? new Date(entry.lastSeenAt) : null;
    if (lastSeenAt && !Number.isNaN(lastSeenAt.getTime())) {
        const lastSeenMonthKey = getRankingCurrentMonthKey(lastSeenAt);
        if (lastSeenMonthKey === currentMonthKey) {
            return monthlySeenCount > 0 ? monthlySeenCount : 1;
        }
    }

    return 0;
}

function buildReadingRankingItems(rankingItems = []) {
    const groups = new Map();

    (Array.isArray(rankingItems) ? rankingItems : []).forEach((entry) => {
        const normalizedReading = normalizeRankingReadingText(entry?.reading || entry?.key || '');
        const count = Number(entry?.count) || 0;
        if (!normalizedReading || count <= 0) return;

        const existing = groups.get(normalizedReading);
        if (!existing || count > existing.count) {
            groups.set(normalizedReading, {
                key: normalizedReading,
                displayReading: normalizedReading,
                count,
                sourceKey: normalizedReading,
                sourceReading: normalizedReading,
                sourceCount: 1
            });
        }
    });

    return Array.from(groups.values())
        .sort((a, b) => {
            if (b.count !== a.count) return b.count - a.count;
            return a.displayReading.localeCompare(b.displayReading, 'ja');
        })
        .slice(0, 100);
}

function renderRankingEmptyState(type, period) {
    const typeLabel = type === 'reading' ? '読み' : '漢字';
    const periodLabel = period === 'monthly' ? '月間' : '総合';
    const message = type === 'reading'
        ? `${periodLabel}の${typeLabel}ランキングはまだありません。<br>ストックや直接入力が集まるとここに並びます。`
        : `${periodLabel}の${typeLabel}ランキングはまだありません。<br>ストックが増えるとここに並びます。`;

    return `
        <div class="text-center py-20 text-[#a6967a]">
            <p class="text-sm leading-relaxed">${message}</p>
        </div>
    `;
}

function renderRankingKanjiCard(item, index) {
    const kanjiKey = String(item?.kanji || item?.key || '');
    const kanjiData = Array.isArray(master)
        ? master.find((entry) => entry && entry['漢字'] === kanjiKey)
        : null;
    const displayKanji = kanjiData?.['漢字'] || kanjiKey;
    const primaryReading = getPrimaryKanjiReading(kanjiData);
    const meaning = String(kanjiData?.['意味'] || '').trim();
    const meaningText = meaning ? (meaning.length > 18 ? `${meaning.slice(0, 18)}…` : meaning) : 'データあり';
    const isStocked = isRankingKanjiStocked(displayKanji);
    const tone = getRankingCardTone(index);
    const isTopThree = index < 3;
    const rankLabel = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}位`;
    const rankHtml = isTopThree
        ? `<div class="text-[17px] leading-none">${rankLabel}</div>`
        : `<div class="inline-flex items-center justify-center rounded-full px-2.5 py-0.5 ${tone.countClass} ${tone.rankClass} leading-none font-black whitespace-nowrap">${rankLabel}</div>`;

    return `
        <button type="button"
            data-kanji="${escapeRankingHtml(displayKanji)}"
            data-ranking-kind="kanji"
            data-ranking-key="${escapeRankingHtml(displayKanji)}"
            data-ranking-count="${item.count}"
            onclick="openRankingKanjiDetail(this.dataset.kanji)"
            class="w-full flex items-center gap-3 bg-white rounded-2xl px-3 py-2.5 min-h-[5.75rem] md:min-h-[6.25rem] shadow-sm border ${isStocked ? 'border-[#bca37f] ring-1 ring-[#bca37f]/20' : 'border-[#ede5d8]'} transition-all active:scale-[0.98] cursor-pointer text-left">
            <div class="flex flex-col items-center justify-center shrink-0 w-12 gap-0.5">
                ${rankHtml}
                <div class="text-[10px] font-black text-[#e07a7a] leading-none whitespace-nowrap" data-ranking-count-display>❤${item.count}</div>
            </div>
            <div class="w-12 h-12 shrink-0 rounded-xl bg-gradient-to-br from-[#fff8ed] to-[#f4eadf] border border-[#eadfce] flex items-center justify-center text-[1.45rem] font-black leading-none text-[#5d5444]">
                ${escapeRankingHtml(displayKanji || '・')}
            </div>
            <div class="min-w-0 flex-1">
                <div class="truncate whitespace-nowrap text-[15px] font-black leading-tight text-[#5d5444] tracking-tight">
                    ${escapeRankingHtml(primaryReading || '読みなし')}
                </div>
                <div class="mt-0.5 truncate whitespace-nowrap text-[10px] font-bold leading-tight text-[#8b7e66]">
                    ${escapeRankingHtml(meaningText)}
                </div>
            </div>
            <span class="shrink-0 rounded-xl px-2.5 py-1.5 text-[10px] font-black leading-none whitespace-nowrap ${isStocked ? 'bg-[#fff4db] text-[#b9965b]' : 'bg-[#f8f5ef] text-[#8b7e66]'}" data-ranking-status-label>
                ${isStocked ? 'ストック済み' : '詳細'}
            </span>
        </button>
    `;
}

function renderRankingReadingCard(item, index) {
    const reading = String(item?.displayReading || item?.key || '');
    const tone = getRankingCardTone(index);
    const isStocked = isRankingReadingStocked(reading);
    const isTopThree = index < 3;
    const rankLabel = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}位`;
    const rankHtml = isTopThree
        ? `<div class="text-[17px] leading-none">${rankLabel}</div>`
        : `<div class="inline-flex items-center justify-center rounded-full px-2.5 py-0.5 ${tone.countClass} ${tone.rankClass} leading-none font-black whitespace-nowrap">${rankLabel}</div>`;

    return `
        <button type="button"
            data-reading="${escapeRankingHtml(item?.sourceKey || reading)}"
            data-ranking-kind="reading"
            data-ranking-key="${escapeRankingHtml(item?.sourceKey || reading)}"
            data-ranking-count="${item.count}"
            onclick="openRankingReadingAction(this.dataset.reading)"
            class="w-full flex items-center gap-3 bg-white rounded-2xl px-3 py-2.5 min-h-[5.75rem] md:min-h-[6.25rem] shadow-sm border ${isStocked ? 'border-[#bca37f] ring-1 ring-[#bca37f]/20' : 'border-[#ede5d8]'} transition-all active:scale-[0.98] cursor-pointer text-left">
            <div class="flex flex-col items-center justify-center shrink-0 w-12 gap-0.5">
                ${rankHtml}
                <div class="text-[10px] font-black text-[#e07a7a] leading-none whitespace-nowrap" data-ranking-count-display>❤${item.count}</div>
            </div>
            <div class="min-w-0 flex-1">
                <div class="truncate whitespace-nowrap text-[16px] font-black leading-tight text-[#5d5444] tracking-wide">${escapeRankingHtml(reading || '読みなし')}</div>
            </div>
            <span class="shrink-0 rounded-xl px-2.5 py-1.5 text-[10px] font-black leading-none whitespace-nowrap ${isStocked ? 'bg-[#fff4db] text-[#b9965b]' : 'bg-[#f8f5ef] text-[#8b7e66]'}" data-ranking-status-label>
                ${isStocked ? 'ストック済み' : '開く'}
            </span>
        </button>
    `;
}

function renderRankingCards(items, type) {
    return items.map((item, index) => (type === 'reading'
        ? renderRankingReadingCard(item, index)
        : renderRankingKanjiCard(item, index))).join('');
}

function buildRankingContent(items, type, period) {
    return `
        <div class="space-y-2 pb-8 pt-2">
            <div class="space-y-2">
                ${renderRankingCards(items, type)}
            </div>
        </div>
    `;
}

function resolveRankingKanjiData(kanjiStr) {
    const normalizedKanji = String(kanjiStr || '').trim();
    if (!normalizedKanji) return null;

    if (Array.isArray(master)) {
        const found = master.find((entry) => entry && entry['漢字'] === normalizedKanji);
        if (found) return found;
    }

    const library = typeof getEncounteredLibrary === 'function'
        ? getEncounteredLibrary()
        : { kanji: [] };
    const item = (library.kanji || []).find((entry) => (entry?.key || entry?.kanji) === normalizedKanji);
    if (item) {
        const snapshot = item.snapshot || {};
        return {
            ...snapshot,
            '漢字': item.kanji || normalizedKanji,
            '意味': snapshot['意味'] || item.meaning || '',
            '音': snapshot['音'] || item.kanjiReading || '',
            '訓': snapshot['訓'] || '',
            '分類': snapshot['分類'] || item.category || ''
        };
    }

    return {
        '漢字': normalizedKanji,
        '意味': '',
        '音': '',
        '訓': '',
        '分類': ''
    };
}

function resolveRankingReadingItem(key) {
    const normalizedReading = normalizeRankingReadingText(key);
    if (!normalizedReading) return null;

    const item = getRankingEncounteredReadingItems().find((entry) => {
        const entryKey = String(entry?.key || '');
        const entryReading = String(entry?.reading || '');
        return entryKey === key
            || entryReading === key
            || normalizeRankingReadingText(entryKey) === normalizedReading
            || normalizeRankingReadingText(entryReading) === normalizedReading;
    });

    if (item) return item;

    return {
        key: normalizedReading,
        reading: normalizedReading
    };
}

function openRankingKanjiDetail(kanjiStr) {
    const data = resolveRankingKanjiData(kanjiStr);
    if (!data) return;

    try {
        if (typeof showDetailByData === 'function') {
            showDetailByData(data);
        } else if (typeof showKanjiDetail === 'function') {
            showKanjiDetail(data);
        }
    } catch (error) {
        console.error('RANKING: openRankingKanjiDetail failed', error);
    }

    const modal = document.getElementById('modal-kanji-detail');
    if (!modal || modal.classList.contains('active')) return;

    if (typeof showToast === 'function') {
        showToast('漢字詳細を開けませんでした。', '👀');
    }
}

function openRankingReadingAction(key) {
    const item = resolveRankingReadingItem(key);
    if (!item || !item.reading) {
        if (typeof showToast === 'function') {
            showToast('この読みはまだ開けません。', '👀');
        }
        return;
    }

    try {
        if (typeof openReadingCombinationModal === 'function') {
            openReadingCombinationModal(
                {
                    ...item,
                    reading: item.reading,
                    tags: Array.isArray(item.tags)
                        ? item.tags
                        : Array.isArray(item.sourceTags)
                            ? item.sourceTags
                            : [],
                    gender: item.gender || 'neutral'
                },
                item.baseNickname || '',
                item.preferredLabel || ''
            );
            return;
        }
    } catch (error) {
        console.error('RANKING: openRankingReadingAction failed', error);
    }

    if (typeof showToast === 'function') {
        showToast('読み候補画面を開けませんでした');
    }
}

function getRankingLoadingMessage() {
    return `
        <div class="text-center py-20 text-[#a6967a] flex flex-col items-center justify-center gap-4">
            <div class="animate-spin w-8 h-8 border-4 border-[#eee5d8] border-t-[#bca37f] rounded-full mx-auto"></div>
            <div>ランキングを取得中...</div>
        </div>
    `;
}

async function loadRanking() {
    const listContainer = document.getElementById('ranking-list-container');
    if (!listContainer) return;

    const type = normalizeRankingType(currentRankingType);
    const period = normalizeRankingPeriod(currentRankingPeriod);
    const genderFilter = normalizeRankingGender(currentRankingGender);
    currentRankingType = type;
    currentRankingPeriod = period;
    currentRankingTab = period;
    currentRankingGender = genderFilter;
    updateRankingButtonState();

    listContainer.innerHTML = getRankingLoadingMessage();

    if (typeof MeimayStats === 'undefined') {
        listContainer.innerHTML = '<div class="text-center py-20 text-[#f28b82]">ランキング集計モジュールが読み込まれていません。</div>';
        return;
    }

    try {
        const seedTasks = [];
        if (typeof MeimayStats !== 'undefined') {
            const getSeedFlag = (key) => {
                try {
                    return localStorage.getItem(key) === '1';
                } catch (error) {
                    return false;
                }
            };
            if (type === 'kanji' && typeof MeimayStats.seedKanjiStatsFromLocalLikes === 'function') {
                const kanjiSeeded = getSeedFlag('meimay_kanji_gender_stats_seeded_v2');
                if (!kanjiSeeded) {
                    seedTasks.push(MeimayStats.seedKanjiStatsFromLocalLikes());
                }
            }
            if (type === 'reading' && typeof MeimayStats.seedEncounteredReadingStatsByGender === 'function') {
                const readingSeeded = getSeedFlag('meimay_reading_gender_stats_seeded_v2');
                if (!readingSeeded) {
                    seedTasks.push(MeimayStats.seedEncounteredReadingStatsByGender());
                }
            }
            if (type === 'reading' && typeof MeimayStats.seedEncounteredReadingStats === 'function') {
                const readingGlobalSeeded = getSeedFlag('meimay_reading_stats_seeded_v3');
                if (!readingGlobalSeeded) {
                    seedTasks.push(MeimayStats.seedEncounteredReadingStats());
                }
            }
        }
        if (seedTasks.length > 0) {
            await Promise.allSettled(seedTasks);
        }

        let items = [];
        if (type === 'kanji') {
            items = await MeimayStats.fetchRankings(period, 'kanji', 'all', genderFilter);
        } else {
            const readingRanking = await MeimayStats.fetchRankings(period, 'reading', 'all', genderFilter);
            items = buildReadingRankingItems(readingRanking);
        }

        if (!Array.isArray(items) || items.length === 0) {
            listContainer.innerHTML = renderRankingEmptyState(type, period);
            return;
        }

        listContainer.innerHTML = buildRankingContent(items, type, period);
    } catch (error) {
        console.error('RANKING: loadRanking error', error);
        listContainer.innerHTML = '<div class="text-center py-20 text-[#f28b82]">ランキングの取得に失敗しました。</div>';
    }
}

function showRankingReadingAction(key) {
    openRankingReadingAction(key);
}

function showRankingKanjiDetail(kanjiStr) {
    openRankingKanjiDetail(kanjiStr);
}

async function toggleRankingStock(kanjiStr, btn) {
    if (typeof liked === 'undefined') return;

    const normalizedKanji = String(kanjiStr || '').trim();
    if (!normalizedKanji) return;

    const found = typeof master !== 'undefined' ? master.find((entry) => entry && entry['漢字'] === normalizedKanji) : null;
    const ownLiked = getRankingOwnLikedEntries();
    const isStocked = ownLiked.some((entry) => (entry?.['漢字'] || entry?.kanji) === normalizedKanji);

    if (isStocked) {
        let removedCount = 0;
        for (let i = liked.length - 1; i >= 0; i--) {
            if (liked[i]?.fromPartner) continue;
            if ((liked[i]?.['漢字'] || liked[i]?.kanji) === normalizedKanji) {
                liked.splice(i, 1);
                removedCount++;
            }
        }

        if (btn) {
            btn.innerText = 'ストック';
            btn.className = 'px-3 py-1.5 bg-gradient-to-br from-[#d4c5af] to-[#bca37f] text-white shadow-sm rounded-xl text-xs font-bold transition-all active:scale-95 shrink-0';
        }
        if (removedCount > 0 && typeof MeimayStats !== 'undefined' && MeimayStats.recordKanjiUnlike) {
            await MeimayStats.recordKanjiUnlike(normalizedKanji, {
                gender: found?.gender || gender || 'neutral',
                delta: -removedCount
            });
        }
    } else {
        if (found) {
            liked.push({ ...found, slot: -1, sessionReading: 'RANKING', fromPartner: false });
            if (btn) {
                btn.innerText = '解除';
                btn.className = 'px-3 py-1.5 bg-[#fef2f2] text-[#f28b82] rounded-xl text-xs font-bold transition-all active:scale-95 shrink-0';
            }
            if (typeof MeimayStats !== 'undefined' && MeimayStats.recordKanjiLike) {
                await MeimayStats.recordKanjiLike(normalizedKanji, {
                    gender: found.gender || gender || 'neutral',
                    delta: 1
                });
            }
        }
    }

    if (typeof StorageBox !== 'undefined' && StorageBox.saveLiked) {
        StorageBox.saveLiked();
    }
}

window.openRanking = openRanking;
window.switchRankingType = switchRankingType;
window.switchRankingPeriod = switchRankingPeriod;
window.switchRankingTab = switchRankingTab;
window.switchRankingGender = switchRankingGender;
window.cycleRankingGender = cycleRankingGender;
window.updateRankingCardState = updateRankingCardState;
window.toggleRankingStock = toggleRankingStock;
window.openRankingKanjiDetail = openRankingKanjiDetail;
window.openRankingReadingAction = openRankingReadingAction;
window.showRankingKanjiDetail = showRankingKanjiDetail;
window.showRankingReadingAction = showRankingReadingAction;

console.log('RANKING: Module loaded');
