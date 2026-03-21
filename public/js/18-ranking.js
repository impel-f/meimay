/* 18-ranking.js: Ranking screen logic */

let currentRankingType = 'kanji';
let currentRankingPeriod = 'allTime';
let currentRankingTab = 'allTime'; // Legacy alias kept in sync with the active period.

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

function getPrimaryKanjiReading(kanjiData) {
    if (!kanjiData) return '';
    const raw = String(kanjiData['音'] || kanjiData['訓'] || kanjiData['読み'] || kanjiData.kanji_reading || '').trim();
    if (!raw) return '';
    return raw.split(/[\s　,、\/／]+/).find(Boolean) || raw;
}

function getRankingCardTone(index) {
    const isTopThree = index < 3;
    return {
        rankClass: isTopThree ? 'text-[11px]' : 'text-[10px]',
        countClass: isTopThree ? 'bg-[#fff4db] text-[#b9965b]' : 'bg-[#f8f5ef] text-[#8b7e66]'
    };
}

function getRankingPeriodSwitchLabel(period) {
    return period === 'monthly' ? '月間ランキング' : '総合ランキング';
}

function getRankingMonthDisplayLabel(date = new Date()) {
    const key = getRankingCurrentMonthKey(date);
    const [year, month] = key.split('_');
    if (!year || !month) return key.replace('_', '/');
    const lastDay = new Date(Date.UTC(Number(year), Number(month), 0)).getUTCDate();
    return `${year}/${month}/01-${year}/${month}/${String(lastDay).padStart(2, '0')}`;
}

function getRankingPeriodSwitchStyle(period) {
    if (period === 'monthly') {
        return {
            button: 'border:1px solid #c9a86a;background:linear-gradient(135deg, #fff5d9 0%, #ffeab0 100%);',
            text: '#5d5444',
            sub: '#8b7e66',
            chipBg: '#fffaf2',
            chipText: '#b9965b'
        };
    }

    return {
        button: 'border:1px solid #eadfce;background:linear-gradient(135deg, #fffdf9 0%, #f6efe4 100%);',
        text: '#5d5444',
        sub: '#a6967a',
        chipBg: '#fff7ec',
        chipText: '#a6967a'
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
            class="w-full rounded-[1.05rem] px-2 py-2 text-center active:scale-95 transition-transform md:rounded-[1.2rem] md:px-2.5 md:py-2.5"
            style="${switchStyle.button}">
            <div class="flex items-center justify-center gap-2 whitespace-nowrap">
                <span class="whitespace-nowrap text-[10px] font-black leading-none md:text-[11px]" style="color:${switchStyle.text};">
                    ${escapeRankingHtml(label)}
                </span>
                ${period === 'monthly' ? `
                    <span class="whitespace-nowrap rounded-full px-2 py-0.5 text-[7px] font-black leading-none tracking-[0.14em]" style="background:${switchStyle.chipBg};color:${switchStyle.chipText};">
                        集計期間 ${escapeRankingHtml(monthLabel)}
                    </span>
                ` : ''}
            </div>
            <div class="mt-1 whitespace-nowrap text-[7px] font-bold leading-tight md:text-[8px]" style="color:${switchStyle.sub};">
                タップで切り替え
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

function toggleRankingPeriod() {
    const period = normalizeRankingPeriod(currentRankingPeriod);
    setRankingPeriod(period === 'allTime' ? 'monthly' : 'allTime');
}

async function openRanking() {
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

function buildReadingRankingItems(period) {
    const library = typeof getEncounteredLibrary === 'function'
        ? getEncounteredLibrary()
        : { kanji: [], readings: [] };
    const currentMonthKey = getRankingCurrentMonthKey();
    const groups = new Map();

    (library.readings || []).forEach((entry) => {
        const normalizedReading = normalizeRankingReadingText(entry?.reading || entry?.key || '');
        if (!normalizedReading) return;

        const count = period === 'monthly'
            ? getMonthlyReadingCount(entry, currentMonthKey)
            : Number(entry?.seenCount) || 0;

        if (count <= 0) return;

        const rawKey = String(entry?.key || entry?.reading || normalizedReading);
        const sourceSeenCount = Number(entry?.seenCount) || 0;
        const sourceLastSeenAt = entry?.lastSeenAt ? new Date(entry.lastSeenAt).getTime() || 0 : 0;
        const sourceOrigin = entry?.encounterOrigin || '';
        const sourceTags = Array.isArray(entry?.tags) ? entry.tags.slice(0, 3) : [];
        const existing = groups.get(normalizedReading);

        if (!existing) {
            groups.set(normalizedReading, {
                key: normalizedReading,
                displayReading: normalizedReading,
                count,
                sourceKey: rawKey,
                sourceReading: String(entry?.reading || normalizedReading),
                sourceSeenCount,
                sourceLastSeenAt,
                sourceOrigin,
                sourceTags,
                sourceCount: 1
            });
            return;
        }

        existing.count += count;
        existing.sourceCount += 1;

        const shouldReplaceSource =
            sourceSeenCount > existing.sourceSeenCount
            || (sourceSeenCount === existing.sourceSeenCount && sourceLastSeenAt > existing.sourceLastSeenAt);

        if (shouldReplaceSource) {
            existing.sourceKey = rawKey;
            existing.sourceReading = String(entry?.reading || normalizedReading);
            existing.sourceSeenCount = sourceSeenCount;
            existing.sourceLastSeenAt = sourceLastSeenAt;
            existing.sourceOrigin = sourceOrigin;
            existing.sourceTags = sourceTags;
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
        ? `${periodLabel}の${typeLabel}ランキングはまだありません。<br>スワイプや直接入力が集まるとここに並びます。`
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
    const meaningText = meaning ? (meaning.length > 18 ? `${meaning.slice(0, 18)}…` : meaning) : 'タップで詳細';
    const isStocked = Array.isArray(liked)
        && liked.some((entry) => (entry?.['漢字'] || entry?.kanji) === displayKanji);
    const tone = getRankingCardTone(index);
    const rankLabel = `${index + 1}位`;

    return `
        <button type="button"
            data-kanji="${escapeRankingHtml(displayKanji)}"
            onclick="openRankingKanjiDetail(this.dataset.kanji)"
            class="w-full flex items-center gap-3 bg-white rounded-2xl px-3 py-2.5 min-h-[5.75rem] md:min-h-[6.25rem] shadow-sm border ${isStocked ? 'border-[#bca37f] ring-1 ring-[#bca37f]/20' : 'border-[#ede5d8]'} transition-all active:scale-[0.98] cursor-pointer text-left">
            <div class="flex flex-col items-center justify-center shrink-0 w-12 gap-0.5">
                <div class="inline-flex items-center justify-center rounded-full px-2.5 py-0.5 ${tone.countClass} ${tone.rankClass} leading-none font-black whitespace-nowrap">${rankLabel}</div>
                <div class="text-[10px] font-black text-[#e07a7a] leading-none whitespace-nowrap">♥${item.count}</div>
            </div>
            <div class="w-12 h-12 shrink-0 rounded-xl bg-gradient-to-br from-[#fff8ed] to-[#f4eadf] border border-[#eadfce] flex items-center justify-center text-[1.45rem] font-black leading-none text-[#5d5444]">
                ${escapeRankingHtml(displayKanji || '？')}
            </div>
            <div class="min-w-0 flex-1">
                <div class="truncate whitespace-nowrap text-[15px] font-black leading-tight text-[#5d5444] tracking-tight">
                    ${escapeRankingHtml(primaryReading || '読みなし')}
                </div>
                <div class="mt-0.5 truncate whitespace-nowrap text-[10px] font-bold leading-tight text-[#8b7e66]">
                    ${escapeRankingHtml(meaningText)}
                </div>
            </div>
            <span class="shrink-0 rounded-xl px-2.5 py-1.5 text-[10px] font-black leading-none whitespace-nowrap ${isStocked ? 'bg-[#fff4db] text-[#b9965b]' : 'bg-[#f8f5ef] text-[#8b7e66]'}">
                ${isStocked ? 'ストック済み' : '詳細'}
            </span>
        </button>
    `;
}

function renderRankingReadingCard(item, index) {
    const reading = String(item?.displayReading || item?.key || '');
    const tone = getRankingCardTone(index);
    const isStocked = typeof getReadingStock === 'function'
        && getReadingStock().some((entry) => normalizeRankingReadingText(entry?.reading) === reading);
    const sourceLabel = item?.sourceCount > 1
        ? `${item.sourceCount}件の表記を集約`
        : '';
    const rankLabel = `${index + 1}位`;

    return `
        <button type="button"
            data-reading="${escapeRankingHtml(item?.sourceKey || reading)}"
            onclick="openRankingReadingAction(this.dataset.reading)"
            class="w-full flex items-center gap-3 bg-white rounded-2xl px-3 py-2.5 min-h-[5.75rem] md:min-h-[6.25rem] shadow-sm border ${isStocked ? 'border-[#bca37f] ring-1 ring-[#bca37f]/20' : 'border-[#ede5d8]'} transition-all active:scale-[0.98] cursor-pointer text-left">
            <div class="flex flex-col items-center justify-center shrink-0 w-12 gap-0.5">
                <div class="inline-flex items-center justify-center rounded-full px-2.5 py-0.5 ${tone.countClass} ${tone.rankClass} leading-none font-black whitespace-nowrap">${rankLabel}</div>
                <div class="text-[10px] font-black text-[#e07a7a] leading-none whitespace-nowrap">♥${item.count}</div>
            </div>
            <div class="min-w-0 flex-1">
                <div class="truncate whitespace-nowrap text-[16px] font-black leading-tight text-[#5d5444] tracking-wide">${escapeRankingHtml(reading || '？')}</div>
                ${sourceLabel ? `<div class="mt-0.5 truncate whitespace-nowrap text-[10px] font-bold leading-tight text-[#8b7e66]">${escapeRankingHtml(sourceLabel)}</div>` : ''}
            </div>
            <span class="shrink-0 rounded-xl px-2.5 py-1.5 text-[10px] font-black leading-none whitespace-nowrap ${isStocked ? 'bg-[#fff4db] text-[#b9965b]' : 'bg-[#f8f5ef] text-[#8b7e66]'}">
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

    const library = typeof getEncounteredLibrary === 'function'
        ? getEncounteredLibrary()
        : { readings: [] };
    const item = (library.readings || []).find((entry) => {
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
    currentRankingType = type;
    currentRankingPeriod = period;
    currentRankingTab = period;
    updateRankingButtonState();

    listContainer.innerHTML = getRankingLoadingMessage();

    if (typeof MeimayStats === 'undefined') {
        listContainer.innerHTML = '<div class="text-center py-20 text-[#f28b82]">ランキング集計モジュールが読み込まれていません。</div>';
        return;
    }

    try {
        let items = [];
        if (type === 'kanji') {
            items = await MeimayStats.fetchRankings(period);
        } else {
            items = buildReadingRankingItems(period);
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

function toggleRankingStock(kanjiStr, btn) {
    if (typeof liked === 'undefined') return;

    const isStocked = liked.some((entry) => (entry?.['漢字'] || entry?.kanji) === kanjiStr);
    const card = btn?.closest('.bg-white');

    if (isStocked) {
        let removedCount = 0;
        for (let i = liked.length - 1; i >= 0; i--) {
            if ((liked[i]?.['漢字'] || liked[i]?.kanji) === kanjiStr) {
                liked.splice(i, 1);
                removedCount++;
            }
        }

        if (btn) {
            btn.innerText = 'ストック';
            btn.className = 'px-3 py-1.5 bg-gradient-to-br from-[#d4c5af] to-[#bca37f] text-white shadow-sm rounded-xl text-xs font-bold transition-all active:scale-95 shrink-0';
        }
        if (card) {
            card.classList.remove('border-[#bca37f]', 'ring-1', 'ring-[#bca37f]/20');
            card.classList.add('border-[#ede5d8]');
        }
        if (removedCount > 0 && typeof MeimayStats !== 'undefined' && MeimayStats.recordKanjiUnlike) {
            MeimayStats.recordKanjiUnlike(kanjiStr);
        }
    } else {
        const found = typeof master !== 'undefined' ? master.find((entry) => entry && entry['漢字'] === kanjiStr) : null;
        if (found) {
            liked.push({ ...found, slot: -1, sessionReading: 'RANKING' });
            if (btn) {
                btn.innerText = '解除';
                btn.className = 'px-3 py-1.5 bg-[#fef2f2] text-[#f28b82] rounded-xl text-xs font-bold transition-all active:scale-95 shrink-0';
            }
            if (card) {
                card.classList.add('border-[#bca37f]', 'ring-1', 'ring-[#bca37f]/20');
                card.classList.remove('border-[#ede5d8]');
            }
            if (typeof MeimayStats !== 'undefined' && MeimayStats.recordKanjiLike) {
                MeimayStats.recordKanjiLike(kanjiStr);
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
window.toggleRankingStock = toggleRankingStock;
window.openRankingKanjiDetail = openRankingKanjiDetail;
window.openRankingReadingAction = openRankingReadingAction;
window.showRankingKanjiDetail = showRankingKanjiDetail;
window.showRankingReadingAction = showRankingReadingAction;

console.log('RANKING: Module loaded');
