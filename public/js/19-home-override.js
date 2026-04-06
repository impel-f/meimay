function canDismissHomePairCard(pairing) {
    return true;
}

function getWizardHomeState() {
    try {
        if (typeof WizardData !== 'undefined' && typeof WizardData.get === 'function') {
            const wizard = WizardData.get() || {};
            return {
                hasReadingCandidate: wizard.hasReadingCandidate === true,
                dueDate: wizard.dueDate || '',
                username: String(wizard.username || '').trim()
            };
        }
    } catch (e) { }

    return {
        hasReadingCandidate: false,
        dueDate: '',
        username: ''
    };
}

function getMeimayPartnerViewState() {
    const defaults = {
        savedFocus: 'all',
        readingFocus: 'all',
        kanjiFocus: 'self'
    };

    if (!window.MeimayPartnerViewState || typeof window.MeimayPartnerViewState !== 'object') {
        window.MeimayPartnerViewState = { ...defaults };
        return window.MeimayPartnerViewState;
    }

    window.MeimayPartnerViewState = {
        ...defaults,
        ...window.MeimayPartnerViewState
    };
    return window.MeimayPartnerViewState;
}

function setMeimayPartnerViewFocus(nextState = {}, options = {}) {
    const defaults = {
        savedFocus: 'all',
        readingFocus: 'all',
        kanjiFocus: 'self'
    };
    const baseState = options.resetAll ? { ...defaults } : getMeimayPartnerViewState();
    window.MeimayPartnerViewState = {
        ...baseState,
        ...nextState
    };
    return window.MeimayPartnerViewState;
}

function resetMeimayPartnerViewFocus(keys = []) {
    if (!Array.isArray(keys) || keys.length === 0) {
        window.MeimayPartnerViewState = {
            savedFocus: 'all',
            readingFocus: 'all',
            kanjiFocus: 'self'
        };
        return window.MeimayPartnerViewState;
    }

    const state = getMeimayPartnerViewState();
    keys.forEach((key) => {
        if (key === 'savedFocus' || key === 'readingFocus' || key === 'kanjiFocus') {
            state[key] = key === 'kanjiFocus' ? 'self' : 'all';
        }
    });
    return state;
}

function openSavedNamesWithPartnerFocus(savedFocus) {
    setMeimayPartnerViewFocus({
        savedFocus: savedFocus || 'all'
    }, { resetAll: true });
    if (typeof changeScreen === 'function') changeScreen('scr-saved');
    if (typeof renderSavedScreen === 'function') renderSavedScreen();
}

function openStockWithPartnerFocus(tab, focusKey, focusValue) {
    setMeimayPartnerViewFocus({
        [focusKey]: focusValue || 'all'
    }, { resetAll: true });
    if (typeof openStock === 'function') {
        openStock(tab, { preservePartnerFocus: true });
        return;
    }
    if (typeof changeScreen === 'function') changeScreen('scr-stock');
    if (typeof switchStockTab === 'function') switchStockTab(tab || 'kanji');
    if ((tab || 'kanji') === 'reading') {
        if (typeof renderReadingStockSection === 'function') renderReadingStockSection();
    } else if (typeof renderStock === 'function') {
        renderStock();
    }
}

function getHomeRecommendedEntry(readingStockCount, likedCount, savedCount) {
    if (savedCount > 0 || likedCount >= 4) return null;
    const wizard = getWizardHomeState();
    return (readingStockCount > 0 || wizard.hasReadingCandidate) ? 'reading' : 'sound';
}

function getHomeCollectionSummaryText(readingStock) {
    const safeStock = Array.isArray(readingStock) ? readingStock : [];
    const tagCounts = {};

    safeStock.forEach((item) => {
        const tags = Array.isArray(item?.tags) ? item.tags : [];
        tags.forEach((tag) => {
            if (!tag) return;
            const normalized = tag.startsWith('#') ? tag : `#${tag}`;
            tagCounts[normalized] = (tagCounts[normalized] || 0) + 1;
        });
    });

    if (Object.keys(tagCounts).length === 0 && typeof getReadingHistory === 'function') {
        const history = getReadingHistory().slice(0, 8);
        history.forEach((entry) => {
            const tags = Array.isArray(entry?.settings?.imageTags) ? entry.settings.imageTags : [];
            tags.forEach((tag) => {
                if (!tag) return;
                const normalized = tag.startsWith('#') ? tag : `#${tag}`;
                tagCounts[normalized] = (tagCounts[normalized] || 0) + 1;
            });
        });
    }

    const topTags = Object.entries(tagCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 2)
        .map(([tag]) => tag);

    if (topTags.length > 0) return topTags.join(' ');
    return getWizardHomeState().hasReadingCandidate ? '候補あり' : 'まだ傾向なし';
}

function formatHashTagSummary(values = [], fallbackText = 'まだ傾向なし') {
    const tags = (Array.isArray(values) ? values : [])
        .map((value) => String(value || '').trim())
        .filter(Boolean)
        .map((value) => value.startsWith('#') ? value : `#${value}`);

    if (tags.length === 0) return fallbackText;
    return tags.slice(0, 2).join(' ');
}

function getHomeKanjiSummaryText(preference) {
    if (!preference || !Array.isArray(preference.topLabels) || preference.topLabels.length === 0) {
        return 'まだ傾向なし';
    }
    return formatHashTagSummary(preference.topLabels, 'まだ傾向なし');
}

function getHomePairSummaryText(pairing) {
    if (!pairing?.inRoom) return '未連携';
    if (!pairing?.hasPartner) return '連携待ち';
    return `${pairing.partnerDisplayName || pairing.partnerLabel || 'パートナー'}と連携中`;
}

function getHomeBuildPatternCount(candidatePoolOverride) {
    // 1. プールの取得
    const pool = Array.isArray(candidatePoolOverride)
        ? candidatePoolOverride
        : typeof getMergedLikedCandidates === 'function'
            ? getMergedLikedCandidates()
            : (typeof liked !== 'undefined' && Array.isArray(liked) ? liked : []);
    
    if (!pool || pool.length === 0) return 0;

    // 2. ヘルパー：正規化
    const clean = (s) => {
        let t = String(s || '').trim();
        if (typeof toHira === 'function') t = toHira(t);
        else if (typeof window.toHira === 'function') t = window.toHira(t);
        return t.replace(/[・．／\/ 　]/g, '');
    };

    // 3. カウント対象となる「読みパターン（読み＋セグメント構成）」の収集
    const patterns = new Map(); // key: rBase -> { segments, reading }

    // (A) 読みストックからパターンを抽出
    const stock = typeof getReadingStock === 'function' ? getReadingStock() : [];
    stock.forEach(r => {
        const base = clean(r.reading);
        if (!base) return;
        if (!patterns.has(base)) {
            patterns.set(base, {
                reading: r.reading,
                segments: (Array.isArray(r.segments) && r.segments.length > 0) ? r.segments.map(s => clean(s)) : null
            });
        }
    });

    // (B) 候補漢字のセッション情報からパターンを抽出（ストック外のパターンも救済）
    pool.forEach(c => {
        const sRead = clean(c.sessionReading);
        if (!sRead || ['free', 'search', 'ranking', 'shared', 'unknown'].includes(sRead)) return;
        if (!patterns.has(sRead)) {
            patterns.set(sRead, {
                reading: c.sessionReading,
                segments: (Array.isArray(c.sessionSegments) && c.sessionSegments.length > 0) ? c.sessionSegments.map(s => clean(s)) : null
            });
        }
    });

    // 4. 各パターンについて実際の組み合わせを計算
    let total = 0;
    patterns.forEach((pattern, rBase) => {
        const slotData = new Map(); // slotIndex -> Set of unique characters

        pool.forEach(c => {
            const kanji = c['漢字'] || c.kanji;
            if (!kanji) return;

            const cSession = clean(c.sessionReading);
            const cReadingRaw = c.kanji_reading || c.reading || '';
            const cReadings = cReadingRaw.split(/[,、，]/).map(r => clean(r));

            let matchedSlot = -1;

            // 判定1: 明示的なセッション・スロット一致
            if (cSession === rBase && c.slot >= 0) {
                matchedSlot = c.slot;
            }
            // 判定2: セグメントベースのマッチ（FREEモード等）
            else if (pattern.segments) {
                for (let i = 0; i < pattern.segments.length; i++) {
                    const seg = pattern.segments[i];
                    if (seg && cReadings.includes(seg)) {
                        matchedSlot = i;
                        break;
                    }
                }
            }

            if (matchedSlot >= 0) {
                if (!slotData.has(matchedSlot)) slotData.set(matchedSlot, new Set());
                slotData.get(matchedSlot).add(kanji);
            }
        });

        // スロット数の決定: セグメント数、または使用されている最大スロット番号
        let slotCount = pattern.segments ? pattern.segments.length : 0;
        const usedSlotIndices = Array.from(slotData.keys());
        if (usedSlotIndices.length > 0) {
            slotCount = Math.max(slotCount, Math.max(...usedSlotIndices) + 1);
        }

        if (slotCount <= 0) return;

        // すべてのスロットで1つ以上の漢字がある場合のみ組み合わせを計算
        let combos = 1;
        for (let i = 0; i < slotCount; i++) {
            const count = slotData.has(i) ? slotData.get(i).size : 0;
            if (count === 0) {
                combos = 0;
                break;
            }
            combos *= count;
        }
        total += combos;
    });

    return total;
}

function normalizeHomeBuildReadingValue(value) {
    const raw = typeof getReadingBaseReading === 'function'
        ? getReadingBaseReading(value)
        : String(value || '').trim().split('::')[0].trim();
    if (!raw) return '';

    let normalized = raw;
    if (typeof toHira === 'function') normalized = toHira(normalized);
    else if (typeof window.toHira === 'function') normalized = window.toHira(normalized);

    return normalized.replace(/[、,，・/]/g, '').replace(/\s+/g, '').toLowerCase();
}

function sanitizeHomeBuildSegments(segments) {
    return (Array.isArray(segments) ? segments : [])
        .map(segment => String(segment || '').trim())
        .filter(segment => segment && !/^__compound_slot_\d+__$/.test(segment));
}

function getHomeBuildPatternSegments(reading, segmentsSource) {
    const baseReading = typeof getReadingBaseReading === 'function'
        ? getReadingBaseReading(reading)
        : String(reading || '').trim();
    if (!baseReading) return [];

    const explicitSegments = sanitizeHomeBuildSegments(segmentsSource);
    if (explicitSegments.length > 0) return explicitSegments;

    if (typeof getPreferredReadingSegments === 'function') {
        const preferredSegments = sanitizeHomeBuildSegments(getPreferredReadingSegments(baseReading));
        if (preferredSegments.length > 0) return preferredSegments;
    }

    if (typeof getDisplaySegmentsForReading === 'function') {
        const displaySegments = sanitizeHomeBuildSegments(getDisplaySegmentsForReading(baseReading));
        if (displaySegments.length > 0) return displaySegments;
    }

    return [baseReading];
}

function normalizeHomeBuildPool(candidatePoolOverride) {
    const sourcePool = Array.isArray(candidatePoolOverride)
        ? candidatePoolOverride
        : typeof getMergedLikedCandidates === 'function'
            ? getMergedLikedCandidates()
            : (typeof liked !== 'undefined' && Array.isArray(liked) ? liked : []);

    return (Array.isArray(sourcePool) ? sourcePool : [])
        .map((item) => {
            if (!item) return null;
            if (typeof hydrateLikedCandidate === 'function') {
                const hydrated = hydrateLikedCandidate(item, {
                    fromPartner: !!item?.fromPartner,
                    partnerAlsoPicked: !!item?.partnerAlsoPicked,
                    partnerName: item?.partnerName || ''
                });
                if (hydrated) return hydrated;
            }

            const kanji = item['漢字'] || item.kanji || '';
            if (!kanji || Array.from(kanji).length > 1) return null;

            return {
                ...item,
                '漢字': kanji,
                slot: Number.isFinite(Number(item.slot)) ? Number(item.slot) : -1,
                sessionReading: item.sessionReading || '',
                sessionSegments: Array.isArray(item.sessionSegments) ? item.sessionSegments : [],
                kanji_reading: item.kanji_reading || item.reading || ''
            };
        })
        .filter(Boolean);
}

function getHomeBuildHiddenReadingSet() {
    let removedList = [];
    try {
        removedList = JSON.parse(localStorage.getItem('meimay_hidden_readings') || '[]');
    } catch (error) {
        removedList = [];
    }

    return new Set(
        (Array.isArray(removedList) ? removedList : [])
            .map(value => normalizeHomeBuildReadingValue(value))
            .filter(Boolean)
    );
}

function getHomeBuildPatternKey(reading, segments) {
    const normalizedReading = normalizeHomeBuildReadingValue(reading);
    const normalizedSegments = sanitizeHomeBuildSegments(segments)
        .map(segment => normalizeHomeBuildReadingValue(segment))
        .filter(Boolean);
    return `${normalizedReading}::${normalizedSegments.join('/')}`;
}

function getHomeBuildSlotCandidateCount(pool, segment, slotIndex, reading) {
    const matchedKanji = new Set();
    const normalizedReading = normalizeHomeBuildReadingValue(reading);
    const normalizedSegment = normalizeHomeBuildReadingValue(segment);
    if (!normalizedSegment) return 0;

    pool.forEach((item) => {
        const kanji = item?.['漢字'] || item?.kanji || '';
        if (!kanji) return;

        const itemReading = normalizeHomeBuildReadingValue(item?.sessionReading || '');
        const itemSlot = Number.isFinite(Number(item?.slot)) ? Number(item.slot) : -1;
        const itemSegments = Array.isArray(item?.sessionSegments) ? item.sessionSegments : [];
        const itemSegment = itemSlot >= 0 && itemSlot < itemSegments.length
            ? itemSegments[itemSlot]
            : (item?.sessionReading && !String(item.sessionReading).includes('::') && !String(item.sessionReading).includes('/')
                ? item.sessionReading
                : '');
        const normalizedItemSegment = normalizeHomeBuildReadingValue(itemSegment);
        const rawReadings = String(item?.kanji_reading || item?.reading || '')
            .split(/[、,，\s/]+/)
            .map(value => normalizeHomeBuildReadingValue(value))
            .filter(Boolean);
        const generalSource = ['free', 'search', 'ranking', 'shared', 'unknown'].includes(itemReading);

        const slotMatch = itemSlot === slotIndex && itemReading === normalizedReading;
        const segmentMatch = normalizedItemSegment && normalizedItemSegment === normalizedSegment;
        const readingMatch = generalSource && rawReadings.includes(normalizedSegment);

        if (slotMatch || segmentMatch || readingMatch) {
            matchedKanji.add(kanji);
        }
    });

    return matchedKanji.size;
}

function getHomeBuildPatternCount(candidatePoolOverride, readingStockOverride) {
    const pool = normalizeHomeBuildPool(candidatePoolOverride);
    const readingStock = Array.isArray(readingStockOverride)
        ? readingStockOverride
        : typeof getReadingStock === 'function'
            ? getReadingStock()
            : [];

    // 組み合わせ数は「現在の読みストック」を基準に数える。
    // 漢字候補だけ残っていても、読みをストックから外していれば件数には含めない。
    if (!Array.isArray(readingStock) || readingStock.length === 0 || pool.length === 0) {
        return 0;
    }

    const hiddenReadingSet = Array.isArray(readingStockOverride)
        ? new Set()
        : getHomeBuildHiddenReadingSet();
    const patterns = new Map();

    const registerPattern = (reading, segmentsSource) => {
        const baseReading = typeof getReadingBaseReading === 'function'
            ? getReadingBaseReading(reading)
            : String(reading || '').trim();
        const normalizedReading = normalizeHomeBuildReadingValue(baseReading);
        if (!normalizedReading || hiddenReadingSet.has(normalizedReading)) return;

        const segments = getHomeBuildPatternSegments(baseReading, segmentsSource);
        if (segments.length === 0) return;

        const key = getHomeBuildPatternKey(baseReading, segments);
        if (!patterns.has(key)) {
            patterns.set(key, {
                reading: baseReading,
                segments
            });
        }
    };

    (Array.isArray(readingStock) ? readingStock : []).forEach((item) => {
        registerPattern(
            item?.reading || item?.sessionReading || '',
            Array.isArray(item?.segments) && item.segments.length > 0
                ? item.segments
                : item?.sessionSegments
        );
    });

    let total = 0;
    patterns.forEach((pattern) => {
        let combinations = 1;
        for (let index = 0; index < pattern.segments.length; index++) {
            const segment = pattern.segments[index];
            const candidateCount = getHomeBuildSlotCandidateCount(pool, segment, index, pattern.reading);
            if (candidateCount === 0) {
                combinations = 0;
                break;
            }
            combinations *= candidateCount;
        }
        total += combinations;
    });

    return total;
}

function getHomeStageMetric(stepKey, likedCount, readingStockCount, savedCount) {
    if (stepKey === 'reading') {
        return {
            countNumber: String(readingStockCount),
            countUnit: '件',
            actionText: readingStockCount > 0 ? '読みを見る＞' : '読みを探す＞'
        };
    }
    if (stepKey === 'kanji') {
        return {
            countNumber: String(likedCount),
            countUnit: '字',
            actionText: likedCount > 0 ? '漢字を見る＞' : '漢字を探す＞'
        };
    }
    if (stepKey === 'build') {
        return {
            countNumber: String(getHomeBuildPatternCount()),
            countUnit: '通り',
            actionText: '組み立てる＞',
            compact: true
        };
    }
    return { countNumber: String(savedCount), countUnit: '件', actionText: '候補を見る＞' };
}

function getHomeStageAction(stepKey, likedCount, readingStockCount, savedCount) {
    const wizard = getWizardHomeState();
    const buildPatternCount = getHomeBuildPatternCount();
    if (stepKey === 'reading') return readingStockCount > 0 ? 'stock-reading' : 'sound';
    if (stepKey === 'kanji') return likedCount > 0 ? 'stock' : ((readingStockCount > 0 || wizard.hasReadingCandidate) ? 'reading' : 'sound');
    if (stepKey === 'build') return buildPatternCount >= 1 ? 'build' : ((readingStockCount > 0 || wizard.hasReadingCandidate) ? 'reading' : 'sound');
    if (stepKey === 'save') return savedCount > 0 ? 'saved' : (buildPatternCount >= 1 ? 'build' : ((readingStockCount > 0 || wizard.hasReadingCandidate) ? 'reading' : 'sound'));
    return 'sound';
}

function getPairingHomeSummary() {
    const baseSummary = (typeof window.MeimayPartnerInsights !== 'undefined' && window.MeimayPartnerInsights.getSummary)
        ? window.MeimayPartnerInsights.getSummary()
        : null;
    const roomCode = typeof MeimayPairing !== 'undefined' ? MeimayPairing.roomCode : null;
    const myRoleLabel = typeof getRoleLabel === 'function'
        ? getRoleLabel(typeof MeimayPairing !== 'undefined' ? MeimayPairing.myRole : null, '自分')
        : '自分';
    const inviteTargetLabel = typeof getInviteTargetLabel === 'function'
        ? getInviteTargetLabel(typeof MeimayPairing !== 'undefined' ? MeimayPairing.myRole : null)
        : 'パートナー';

    const fallbackPartnerName = typeof getPartnerRoleLabel === 'function'
        ? getPartnerRoleLabel(typeof MeimayShare !== 'undefined' ? MeimayShare?.partnerSnapshot?.role : null)
        : 'パートナー';
    const partnerDisplayName = String(baseSummary?.partnerDisplayName || baseSummary?.partnerLabel || fallbackPartnerName || 'パートナー').trim();
    const partnerCallName = /さん$/.test(partnerDisplayName) || ['パパ', 'ママ', 'パートナー'].includes(partnerDisplayName)
        ? partnerDisplayName
        : `${partnerDisplayName}さん`;

    const summary = {
        inRoom: false,
        hasPartner: false,
        partnerLabel: partnerDisplayName || 'パートナー',
        partnerDisplayName: partnerDisplayName || 'パートナー',
        partnerCallName,
        matchedKanjiCount: 0,
        matchedNameCount: 0,
        previewLabels: [],
        roomCode,
        myRoleLabel,
        inviteTargetLabel,
        ...(baseSummary || {})
    };

    if (!summary.inRoom) {
        return {
            ...summary,
            shortText: '未連携',
            title: 'パートナー連携はまだ未設定です',
            subtitle: '連携すると二人で名前をさがせます。',
            footnote: '必要になったらあとから始められます。',
            actionLabel: '連携する',
            canOpenHub: false
        };
    }

    if (!summary.hasPartner) {
        return {
            ...summary,
            shortText: '連携待ち',
            title: `${summary.myRoleLabel}としてルームを作成済みです`,
            subtitle: `${summary.inviteTargetLabel}にコードを送ると一致が見られます。`,
            footnote: 'コード入力でも参加できます。',
            actionLabel: '',
            canOpenHub: false
        };
    }

    return {
        ...summary,
        shortText: `${summary.partnerDisplayName}と連携中`,
        title: `${summary.partnerCallName}と連携中です`,
        subtitle: '保存済みやストックは自動で共有されます。',
        footnote: '数字を押すと、それぞれの候補を見られます。',
        actionLabel: '',
        canOpenHub: false
    };
}

function getOwnHomeReadingCount() {
    return getHomeOwnershipSummary().ownReadingCount;
}

function getHomeOwnershipSummary() {
    const pairInsights = (typeof window.MeimayPartnerInsights !== 'undefined' && window.MeimayPartnerInsights)
        ? window.MeimayPartnerInsights
        : null;
    const pairing = getPairingHomeSummary();
    const ownLikedItems = pairInsights?.getOwnLiked
        ? pairInsights.getOwnLiked()
        : ((typeof liked !== 'undefined' && Array.isArray(liked))
            ? liked.filter(item => !item?.fromPartner)
            : []);
    const ownSavedItems = pairInsights?.getOwnSaved
        ? pairInsights.getOwnSaved()
        : (() => {
            const savedSource = typeof getSavedNames === 'function'
                ? getSavedNames()
                : (typeof savedNames !== 'undefined' && Array.isArray(savedNames) ? savedNames : []);
            return Array.isArray(savedSource)
                ? savedSource
                : [];
        })();
    const ownReadingItems = pairInsights?.getOwnReadingStock
        ? pairInsights.getOwnReadingStock()
        : ((typeof getReadingStock === 'function')
            ? getReadingStock()
            : []);
    const ownKanjiCount = ownLikedItems.length;
    return {
        pairInsights,
        pairing,
        ownLikedItems,
        ownSavedItems,
        ownReadingItems,
        ownLikedCount: ownKanjiCount,
        ownSavedCount: ownSavedItems.length,
        ownReadingCount: ownReadingItems.length
    };
}

function getHomeNextStep(likedCount, readingStockCount, savedCount, pairing) {
    const wizard = getWizardHomeState();

    if ((pairing?.matchedNameCount || 0) >= 1) {
        return {
            title: '一致した候補がある',
            detail: 'おふたりで同じ候補が見つかっています。',
            actionLabel: '一致した候補を見る',
            action: 'matched-saved'
        };
    }

    if ((pairing?.matchedReadingCount || 0) >= 1) {
        return {
            title: '一致した読みがある',
            detail: 'ふたりで同じ読みから、次の候補を広げやすい状態です。',
            actionLabel: '一致した読みを見る',
            action: 'matched-reading'
        };
    }

    if ((pairing?.matchedKanjiCount || 0) >= 1) {
        return {
            title: '一致した漢字がある',
            detail: '共通で気になった漢字から名前候補を広げられます。',
            actionLabel: '一致した漢字を見る',
            action: 'matched-liked'
        };
    }

    if (savedCount > 0) {
        return {
            title: '保存した候補を見る',
            detail: '保存した候補が十分にたまっています。見比べながら、方向性を絞っていきましょう。',
            actionLabel: '候補を見る',
            action: 'saved'
        };
    }

    if (readingStockCount === 0 && wizard.hasReadingCandidate) {
        return {
            title: '読み候補があるので漢字を探せます',
            detail: '候補の読みを起点に、名前に使いたい漢字を集めます。',
            actionLabel: '漢字をさがす',
            action: 'reading'
        };
    }

    if (readingStockCount === 0) {
        return {
            title: '読み候補を集める',
            detail: 'まずは響きやイメージから、気になる読みを見つけましょう。',
            actionLabel: '響きをさがす',
            action: 'sound'
        };
    }

    if (likedCount < 2) {
        return {
            title: '漢字材料を集める',
            detail: '読み候補があるので、次は漢字を広げる段階です。',
            actionLabel: '漢字をさがす',
            action: 'reading'
        };
    }

    if (savedCount === 0) {
        return {
            title: '組み立てる',
            detail: '集まった読みと漢字から、名前候補を保存していきましょう。',
            actionLabel: 'ビルドへ',
            action: 'build'
        };
    }

    return {
        title: '候補を見る',
        detail: '保存済みから第一候補を絞りやすい段階です。',
        actionLabel: '候補を見る',
        action: 'saved'
    };
}

function getNamingMaterialTimeline(likedCount, readingStockCount, savedCount) {
    const buildPatternCount = getHomeBuildPatternCount();
    const steps = [
        {
            key: 'reading',
            label: '読み',
            done: readingStockCount >= 1,
            status: readingStockCount >= 1 ? '候補あり' : 'これから'
        },
        {
            key: 'kanji',
            label: '漢字',
            done: likedCount >= 2,
            status: likedCount >= 2 ? '進行中' : '次の段階'
        },
        {
            key: 'build',
            label: 'ビルド',
            done: buildPatternCount >= 1,
            status: savedCount >= 1 ? '候補あり' : '準備中'
        },
        {
            key: 'save',
            label: '保存',
            done: savedCount >= 1,
            status: savedCount >= 2 ? '比較OK' : 'これから'
        }
    ];

    const activeKey =
        savedCount >= 1 ? 'save' :
        buildPatternCount >= 1 ? 'build' :
        likedCount >= 2 ? 'kanji' :
        readingStockCount >= 1 ? 'reading' :
        'reading';

    const stageTitle =
        activeKey === 'save' ? '候補を見る段階です' :
        activeKey === 'build' ? '組み立てる段階です' :
        activeKey === 'kanji' ? '漢字材料を集める段階です' :
        '読み候補を探す段階です';

    return {
        stageTitle,
        activeKey,
        steps: steps.map(step => ({
            ...step,
            active: step.key === activeKey,
            metric: getHomeStageMetric(step.key, likedCount, readingStockCount, savedCount),
            action: getHomeStageAction(step.key, likedCount, readingStockCount, savedCount)
        }))
    };
}

function ensureHomeStageTrack() {
    const anchor = document.getElementById('home-stage-track-anchor');
    if (!anchor) return null;

    let stageTrack = document.getElementById('home-stage-track');
    if (!stageTrack) {
        stageTrack = document.createElement('div');
        stageTrack.id = 'home-stage-track';
        anchor.appendChild(stageTrack);
    }
    stageTrack.className = '';

    return stageTrack;
}

function getHomeStageTrackTone(mode) {
    const kind = mode === 'shared' ? 'matched' : mode === 'partner' ? 'partner' : 'self';
    const palette = typeof window.getMeimayOwnershipPalette === 'function'
        ? window.getMeimayOwnershipPalette(kind)
        : null;
    const pairPalettes = typeof window.getMeimayRelationshipPalettes === 'function'
        ? window.getMeimayRelationshipPalettes()
        : { self: palette, partner: palette };
    const cardDone = 'border:1px solid rgba(226,214,196,0.94);background:rgba(255,255,255,0.76);';
    const cardActive = 'border:1px solid rgba(226,214,196,0.9);background:rgba(255,255,255,0.68);';
    const cardIdle = 'border:1px solid rgba(234,223,206,0.84);background:rgba(255,255,255,0.56);';
    const cardRecommended = 'border:2px solid #b9965b;background:#fff8ec;box-shadow:0 10px 22px rgba(185,150,91,0.16);';

    if (!palette) {
        return {
            panel: 'border:1px solid #eee4d6;background:#fffaf6;',
            cardDone,
            cardActive,
            cardIdle,
            cardRecommended,
            badgeDone: 'background:#b9965b;color:#fff;',
            badgeActive: 'background:#d8cfbe;color:#7f725d;',
            badgeIdle: 'background:#f0e8db;color:#8b7e66;',
            badgeRecommended: 'background:#b9965b;color:#fff;',
            text: '#5d5444',
            sub: '#8b7e66'
        };
    }

    if (kind === 'matched') {
        return {
            panel: `border:1px solid transparent;background:${palette.surface} padding-box, linear-gradient(135deg, ${palette.border} 0%, ${palette.borderAlt} 100%) border-box;`,
            cardDone,
            cardActive,
            cardIdle,
            cardRecommended,
            badgeDone: `background:linear-gradient(135deg, ${pairPalettes.self.accentStrong} 0%, ${pairPalettes.partner.accentStrong} 100%);color:#fff;`,
            badgeActive: 'background:rgba(255,255,255,0.92);color:#7d6671;border:1px solid rgba(255,255,255,0.86);',
            badgeIdle: 'background:rgba(255,255,255,0.82);color:#846d78;',
            badgeRecommended: 'background:#b9965b;color:#fff;',
            text: '#5d5444',
            sub: '#846d78'
        };
    }

    return {
        panel: `border:1px solid ${palette.border};background:${palette.surface};`,
        cardDone,
        cardActive,
        cardIdle,
        cardRecommended,
        badgeDone: `background:${palette.accentStrong || palette.accent};color:#fff;`,
        badgeActive: `background:${palette.accentSoft || palette.mist || '#fff7ef'};color:${palette.text || '#8b7e66'};`,
        badgeIdle: `background:rgba(255,255,255,0.86);color:${palette.text || '#8b7e66'};`,
        badgeRecommended: 'background:#b9965b;color:#fff;',
        text: '#5d5444',
        sub: palette.text || '#8b7e66'
    };
}

function getHomeRecommendedStageKey(action) {
    if (action === 'sound' || action === 'stock-reading' || action === 'matched-reading' || action === 'partner-reading') {
        return 'reading';
    }
    if (action === 'reading' || action === 'stock' || action === 'matched-liked' || action === 'partner-liked') {
        return 'kanji';
    }
    if (action === 'build') return 'build';
    if (action === 'saved' || action === 'matched-saved' || action === 'partner-saved') {
        return 'save';
    }
    return '';
}

function getHomeOverviewInitialStageKey(stageSnapshot, nextStep) {
    const recommendedKey = getHomeRecommendedStageKey(nextStep?.action);
    if (recommendedKey) return recommendedKey;

    const timeline = getHomeStageTrackTimeline(
        Number(stageSnapshot?.likedCount) || 0,
        Number(stageSnapshot?.readingStockCount) || 0,
        Number(stageSnapshot?.savedCount) || 0,
        stageSnapshot || {}
    );
    return timeline?.activeKey || 'reading';
}

function getHomeSearchChoiceRecommended(readingStockCount) {
    const wizard = getWizardHomeState();
    return readingStockCount > 0 || wizard.hasReadingCandidate === true ? 'reading' : 'sound';
}

function getHomeStageFocus(defaultKey = 'reading') {
    const allowed = new Set(['reading', 'kanji', 'build', 'save']);
    const nextDefault = allowed.has(defaultKey) ? defaultKey : 'reading';
    const currentSource = window.MeimayHomeStageFocusSource || 'auto';

    if (!allowed.has(window.MeimayHomeStageFocus)) {
        window.MeimayHomeStageFocus = nextDefault;
        window.MeimayHomeStageFocusSource = 'auto';
    } else if (currentSource !== 'manual' && window.MeimayHomeStageFocus !== nextDefault) {
        window.MeimayHomeStageFocus = nextDefault;
        window.MeimayHomeStageFocusSource = 'auto';
    } else if (!window.MeimayHomeStageFocusSource) {
        window.MeimayHomeStageFocusSource = 'auto';
    }
    return window.MeimayHomeStageFocus;
}

function selectHomeStageTab(stageKey) {
    const allowed = new Set(['reading', 'kanji', 'build', 'save']);
    if (!allowed.has(stageKey)) return;
    window.MeimayHomeStageFocus = stageKey;
    window.MeimayHomeStageFocusSource = 'manual';
    if (typeof renderHomeProfile === 'function') renderHomeProfile();
}

function getHomeStageFocusAction(stageKey, likedCount, readingStockCount, savedCount, pairing) {
    const wizard = getWizardHomeState();
    const hasReadingCandidate = readingStockCount > 0 || wizard.hasReadingCandidate === true;

    if (stageKey === 'reading') {
        return hasReadingCandidate ? 'reading' : 'sound';
    }

    if (stageKey === 'kanji') {
        return likedCount > 0 ? 'build' : (hasReadingCandidate ? 'reading' : 'sound');
    }

    if (stageKey === 'build') {
        return savedCount > 0 ? 'saved' : (likedCount > 0 ? 'build' : (hasReadingCandidate ? 'reading' : 'sound'));
    }

    if (stageKey === 'save') {
        return savedCount > 0 ? 'saved' : (likedCount > 0 ? 'build' : (hasReadingCandidate ? 'reading' : 'sound'));
    }

    return getHomeNextStep(likedCount, readingStockCount, savedCount, pairing)?.action || 'sound';
}

function getHomeUnresolvedReadingCount(readingStock = null) {
    const stock = Array.isArray(readingStock)
        ? readingStock
        : (typeof getReadingStock === 'function' ? getReadingStock() : []);
    const visibleLiked = typeof getVisibleOwnLikedReadingsForUI === 'function'
        ? getVisibleOwnLikedReadingsForUI()
        : (typeof liked !== 'undefined' ? liked : []);
    const completedReadingSet = new Set(
        visibleLiked
            .filter(item =>
                item?.sessionReading &&
                item.sessionReading !== 'FREE' &&
                item.sessionReading !== 'SEARCH' &&
                item.slot >= 0
            )
            .map(item => typeof getReadingBaseReading === 'function'
                ? getReadingBaseReading(item.sessionReading)
                : String(item.sessionReading || '').trim())
            .filter(Boolean)
    );

    return stock.reduce((count, item) => {
        const readingKey = typeof getReadingBaseReading === 'function'
            ? getReadingBaseReading(item?.reading || item?.sessionReading || '')
            : String(item?.reading || item?.sessionReading || '').trim();
        if (!readingKey || completedReadingSet.has(readingKey)) return count;
        return count + (isReadingStockPromoted(item) ? 0 : 1);
    }, 0);
}

function getHomeStageFocusCopy(stageKey, likedCount, readingStockCount, savedCount, pairing, options = {}) {
    const buildCount = Number.isFinite(Number(options.buildCount))
        ? Number(options.buildCount)
        : getHomeBuildPatternCount();
    const matchedReadingCount = Number.isFinite(Number(pairing?.matchedReadingCount))
        ? Number(pairing.matchedReadingCount)
        : 0;
    const matchedSavedCount = Number.isFinite(Number(pairing?.matchedNameCount))
        ? Number(pairing.matchedNameCount)
        : 0;
    const unresolvedReadingCount = Number.isFinite(Number(options.unresolvedReadingCount))
        ? Number(options.unresolvedReadingCount)
        : getHomeUnresolvedReadingCount(options.readingStock);

    const copy = {
        stageLabel: '',
        mainText: '',
        chips: [],
        primaryAction: 'sound',
        primaryLabel: '響きをさがす',
        secondaryAction: '',
        secondaryLabel: ''
    };

    if (stageKey === 'reading') {
        copy.stageLabel = '読み';
        copy.primaryAction = 'sound';
        copy.primaryLabel = '響きをさがす';
        if (readingStockCount > 0) {
            copy.secondaryAction = 'stock-reading';
            copy.secondaryLabel = 'ストックした読みを見る';
        }
        copy.chips = [
            { label: 'ストック', value: readingStockCount, unit: '件' },
            { label: '一致', value: matchedReadingCount, unit: '件' }
        ];
        if (readingStockCount === 0) {
            copy.mainText = 'まだ読み候補はありません。まずは響きから、気になる読みを探していきましょう。';
        } else if (readingStockCount <= 3) {
            copy.mainText = `読み候補を ${readingStockCount}件 ストックしています。今ある候補を見返しながら、さらに読みを探すこともできます。`;
        } else if (readingStockCount <= 9) {
            copy.mainText = `読み候補が ${readingStockCount}件 集まっています。方向性を見比べながら、さらに候補を広げられます。`;
        } else {
            copy.mainText = `読み候補が十分に集まっています。今ある ${readingStockCount}件 を見返しつつ、さらに読みを探すこともできます。`;
        }
        if (matchedReadingCount > 0) {
            copy.mainText += ` パートナーと一致した読みが ${matchedReadingCount}件 あります。`;
        }
        return copy;
    }

    if (stageKey === 'kanji') {
        copy.stageLabel = '漢字';
        copy.primaryAction = 'reading';
        copy.primaryLabel = '漢字をさがす';
        if (likedCount > 0) {
            copy.secondaryAction = 'stock';
            copy.secondaryLabel = 'ストックした漢字を見る';
        }
        copy.chips = [
            { label: 'ストック', value: likedCount, unit: '字' },
            { label: '未選択', value: unresolvedReadingCount, unit: '件' },
            { label: '一致', value: matchedReadingCount, unit: '件' }
        ];
        if (likedCount === 0) {
            copy.mainText = 'まだ漢字候補はありません。気になる読みに合う漢字を集めていきましょう。';
        } else if (likedCount <= 4) {
            copy.mainText = `漢字を ${likedCount}字 ストックしています。読みの候補に合う漢字を、ここから少しずつ増やしていけます。`;
        } else if (likedCount <= 9) {
            copy.mainText = `漢字候補が ${likedCount}字 集まっています。読みごとの違いを見ながら、候補の幅を広げられます。`;
        } else {
            copy.mainText = `漢字候補が十分に集まっています。今ある ${likedCount}字 を見返しながら、まだ漢字を選んでいない読みも進められます。`;
        }
        if (unresolvedReadingCount > 0) {
            copy.mainText += ` まだ漢字を選んでいない読みが ${unresolvedReadingCount}件 あります。`;
        }
        if (matchedReadingCount > 0) {
            copy.mainText += ` パートナーと一致した読みが ${matchedReadingCount}件 あり、共通の方向から漢字を広げられます。`;
        }
        return copy;
    }

    if (stageKey === 'build') {
        copy.stageLabel = 'ビルド';
        copy.primaryAction = 'build';
        copy.primaryLabel = '組み立てる';
        copy.chips = [
            { label: '読み', value: readingStockCount, unit: '件' },
            { label: '漢字', value: likedCount, unit: '字' },
            { label: 'ビルド', value: buildCount, unit: '通り' },
            { label: '一致', value: matchedReadingCount, unit: '件' }
        ];
        if (buildCount === 0) {
            copy.mainText = 'まだ名前は組み立てていません。集めた読みと漢字から、名前候補を作り始められます。';
        } else if (buildCount <= 2) {
            copy.mainText = `${buildCount}通り を組み立てています。候補を見ながら、さらに組み合わせを試していけます。`;
        } else if (buildCount <= 5) {
            copy.mainText = `${buildCount}通り の候補ができています。比較しながら、気になる組み合わせをさらに広げられます。`;
        } else {
            copy.mainText = `組み立て候補が十分にできています。今ある ${buildCount}通り を見比べながら、方向性を整えられます。`;
        }
        if (matchedReadingCount > 0) {
            copy.mainText += ` パートナーと一致した読みが ${matchedReadingCount}件 あり、共通の方向から広げられます。`;
        }
        return copy;
    }

    copy.stageLabel = '保存';
    copy.primaryAction = 'saved';
    copy.primaryLabel = '候補を見る';
    copy.chips = [
        { label: '保存', value: savedCount, unit: '件' },
        { label: '一致', value: matchedSavedCount, unit: '件' }
    ];
    if (savedCount === 0) {
        copy.mainText = 'まだ保存した名前はありません。組み立てた候補の中から、残したい名前を選んでいきましょう。';
    } else if (savedCount === 1) {
        copy.mainText = '名前候補を 1件 保存しています。ここを基準にしながら、次の候補を見比べていけます。';
    } else if (savedCount <= 3) {
        copy.mainText = `名前候補を ${savedCount}件 保存しています。見比べながら、方向性を絞り込んでいけます。`;
    } else {
        copy.mainText = `保存した候補がしっかり集まっています。今ある ${savedCount}件 を見比べながら、残したい名前を整理できます。`;
    }
    if (matchedSavedCount > 0) {
        copy.mainText += ` パートナーと一致した候補が ${matchedSavedCount}件 あります。`;
    }
    return copy;
}

function getHomeStageTrackMetric(stepKey, likedCount, readingStockCount, savedCount, options = {}) {
    const buildPatternCount = Number.isFinite(Number(options.buildCount))
        ? Number(options.buildCount)
        : getHomeBuildPatternCount();
    const actionLabels = options.actionLabels || {};

    if (stepKey === 'reading') {
        return {
            countNumber: String(readingStockCount),
            countUnit: '件',
            actionText: actionLabels.reading || (readingStockCount > 0 ? '読みを見る＞' : '読みを探す＞')
        };
    }
    if (stepKey === 'kanji') {
        return {
            countNumber: String(likedCount),
            countUnit: '字',
            actionText: actionLabels.kanji || (likedCount > 0 ? '漢字を見る＞' : '漢字を探す＞')
        };
    }
    if (stepKey === 'build') {
        return {
            countNumber: String(buildPatternCount),
            countUnit: '通り',
            actionText: actionLabels.build || '組み立てる＞',
            compact: true
        };
    }
    return {
        countNumber: String(savedCount),
        countUnit: '件',
        actionText: actionLabels.save || '候補を見る＞'
    };
}

function getHomeStageTrackTimeline(likedCount, readingStockCount, savedCount, options = {}) {
    const buildPatternCount = Number.isFinite(Number(options.buildCount))
        ? Number(options.buildCount)
        : getHomeBuildPatternCount();
    const steps = [
        {
            key: 'reading',
            label: '読み',
            done: readingStockCount >= 1
        },
        {
            key: 'kanji',
            label: '漢字',
            done: likedCount >= 2
        },
        {
            key: 'build',
            label: 'ビルド',
            done: buildPatternCount >= 1
        },
        {
            key: 'save',
            label: '保存',
            done: savedCount >= 1
        }
    ];
    const activeKey =
        savedCount >= 1 ? 'save' :
        buildPatternCount >= 1 ? 'build' :
        likedCount >= 2 ? 'kanji' :
        'reading';
    const stageTitle =
        activeKey === 'save' ? '候補を見る段階です' :
        activeKey === 'build' ? '組み立てる段階です' :
        activeKey === 'kanji' ? '漢字材料を集める段階です' :
        '読み候補を探す段階です';

    return {
        stageTitle,
        activeKey,
        steps: steps.map((step) => ({
            ...step,
            active: step.key === activeKey,
            recommended: step.key === options.recommendedKey,
            metric: getHomeStageTrackMetric(step.key, likedCount, readingStockCount, savedCount, {
                ...options,
                buildCount: buildPatternCount
            }),
            action: options.actions?.[step.key] || getHomeStageAction(step.key, likedCount, readingStockCount, savedCount)
        }))
    };
}

function renderHomeStageTrack(likedCount, readingStockCount, savedCount, options = {}) {
    const stageTrack = ensureHomeStageTrack();
    if (!stageTrack) return;

    const timeline = getHomeStageTrackTimeline(likedCount, readingStockCount, savedCount, options);
    const tone = getHomeStageTrackTone(options.mode);
    const recommendedChoice = getHomeSearchChoiceRecommended(readingStockCount);
    const heroCard = document.getElementById('home-hero-card');
    const summaryPanel = document.getElementById('home-summary-panel');
    if (heroCard) {
        heroCard.style.cssText = tone.panel;
    }
    if (summaryPanel) {
        summaryPanel.classList.remove('hidden');
        summaryPanel.style.cssText = 'background:transparent;border:none;';
    }
    stageTrack.style.cssText = '';
    stageTrack.innerHTML = `
        <div class="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)] items-stretch gap-x-1 md:gap-x-1.5">
            ${timeline.steps.map((step, index) => {
                const cardStyle = step.recommended
                    ? tone.cardRecommended
                    : step.done
                    ? tone.cardDone
                    : step.active
                        ? tone.cardActive
                        : tone.cardIdle;
                const badgeStyle = step.recommended
                    ? tone.badgeRecommended
                    : step.done
                    ? tone.badgeDone
                    : step.active
                        ? tone.badgeActive
                        : tone.badgeIdle;
                return `
                <button
                    type="button"
                    onclick="event.stopPropagation(); runHomeAction('${step.action}')"
                    class="min-h-[74px] rounded-[1.2rem] border px-1 py-1 text-center active:scale-[0.98] transition-transform md:min-h-[122px] md:rounded-[1.7rem] md:px-1.5 md:py-2.5"
                    style="${cardStyle}">
                    <div class="flex h-full flex-col items-center justify-start">
                        <div class="flex items-center justify-center gap-1 text-[8px] font-black leading-tight text-center md:gap-1.5 md:text-[11px]" style="color:${tone.text};">
                            <span class="inline-flex h-[18px] w-[18px] items-center justify-center rounded-full text-[11px] font-black leading-none md:h-6 md:w-6 md:text-[15px]" style="${badgeStyle}">✓</span>
                            <span>${step.label}</span>
                        </div>
                        <div class="mt-1 whitespace-nowrap text-[15px] font-black leading-none md:mt-2 md:text-[22px]" style="color:${tone.text};">
                            <span data-home-stage-count="${step.key}">${step.metric.countNumber}</span><span class="ml-0.5 text-[8px] md:ml-1 md:text-[13px]" style="color:${tone.sub};">${step.metric.countUnit}</span>
                        </div>
                        <div class="mt-auto pt-2 text-[7px] font-black text-center whitespace-nowrap leading-none md:pt-3 md:text-[10px]" style="color:${tone.sub};">${step.metric.actionText}</div>
                    </div>
                </button>${index < timeline.steps.length - 1 ? `<div aria-hidden="true" class="flex items-center justify-center text-[10px] font-black leading-none md:text-[14px]" style="color:${tone.sub};">▶</div>` : ''}
            `;
            }).join('')}
        </div>
        <div class="mt-4 rounded-[24px] border border-[#eadfce] bg-white/74 px-3 py-3">
            <div class="text-[10px] font-black tracking-[0.18em] text-[#b9965b] uppercase">Next</div>
            <div class="mt-1 text-sm font-black text-[#4f4639]">次はここから</div>
            <div class="mt-3 flex flex-col gap-3 text-left">
                <button type="button" onclick="runHomeAction('reading')" class="wiz-gender-btn wiz-reading-choice${recommendedChoice === 'reading' ? ' selected' : ''}">
                    <div class="wiz-reading-choice-copy">
                        <span class="block text-base font-bold text-[#5d5444]">読み候補がある</span>
                        <span class="block mt-1 text-[10px] leading-relaxed text-[#8b7e66]">希望の読みから<br>理想の漢字をさがします</span>
                    </div>
                    <div class="wiz-mini-preview" aria-hidden="true">
                        <div class="wiz-mini-card wiz-mini-card-back" style="background:#E8F5E9;">環</div>
                        <div class="wiz-mini-card wiz-mini-card-center" style="background:#FFFDE7;">歓</div>
                        <div class="wiz-mini-card wiz-mini-card-front" style="background:#FFEBEE;">漢</div>
                    </div>
                </button>
                <button type="button" onclick="runHomeAction('sound')" class="wiz-gender-btn wiz-reading-choice${recommendedChoice === 'sound' ? ' selected' : ''}">
                    <div class="wiz-reading-choice-copy">
                        <span class="block text-base font-bold text-[#5d5444]">まだない</span>
                        <span class="block mt-1 text-[10px] leading-relaxed text-[#8b7e66]">響きから<br>読みの候補をさがします</span>
                    </div>
                    <div class="wiz-mini-preview" aria-hidden="true">
                        <div class="wiz-mini-card wiz-mini-card-back" style="background:linear-gradient(145deg,#fdf7ef,#f0e0c4); font-size:10px;">ひ</div>
                        <div class="wiz-mini-card wiz-mini-card-center" style="background:linear-gradient(145deg,#fdf7ef,#f0e0c4); font-size:10px;">び</div>
                        <div class="wiz-mini-card wiz-mini-card-front" style="background:linear-gradient(145deg,#fdf7ef,#f0e0c4); font-size:10px;">き</div>
                    </div>
                </button>
            </div>
        </div>
    `;

    Array.from(stageTrack.querySelectorAll('button')).forEach((button, index) => {
        const badge = button.querySelector('span');
        if (!badge) return;
        badge.textContent = timeline.steps[index]?.done ? '✓' : '-';
    });
}

/*    const searchChoiceButtons = stageTrack.querySelectorAll('.wiz-reading-choice');
    const readingChoiceCopy = searchChoiceButtons[0]?.querySelectorAll('.wiz-reading-choice-copy span');
    if (readingChoiceCopy?.[0]) readingChoiceCopy[0].textContent = '読み候補がある';
    if (readingChoiceCopy?.[1]) readingChoiceCopy[1].innerHTML = '希望の読みから<br>理想の漢字をさがします';

    const soundChoiceCopy = searchChoiceButtons[1]?.querySelectorAll('.wiz-reading-choice-copy span');
    if (soundChoiceCopy?.[0]) soundChoiceCopy[0].textContent = 'まだない';
    if (soundChoiceCopy?.[1]) soundChoiceCopy[1].innerHTML = '響きから<br>読みの候補をさがします';
}*/

function closeHomePartnerHub() {
    document.getElementById('home-partner-hub-modal')?.remove();
}

function renderHomeStageTrack(likedCount, readingStockCount, savedCount, options = {}) {
    const stageTrack = ensureHomeStageTrack();
    if (!stageTrack) return;

    const timeline = getHomeStageTrackTimeline(likedCount, readingStockCount, savedCount, options);
    const tone = getHomeStageTrackTone(options.mode);
    const recommendedChoice = getHomeSearchChoiceRecommended(readingStockCount);
    const heroCard = document.getElementById('home-hero-card');
    const summaryPanel = document.getElementById('home-summary-panel');

    if (heroCard) {
        heroCard.style.cssText = tone.panel;
    }
    if (summaryPanel) {
        summaryPanel.classList.remove('hidden');
        summaryPanel.style.cssText = 'background:transparent;border:none;';
    }

    stageTrack.style.cssText = '';
    stageTrack.innerHTML = `
        <div class="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)] items-stretch gap-x-1 md:gap-x-1.5">
            ${timeline.steps.map((step, index) => {
                const cardStyle = step.recommended
                    ? tone.cardRecommended
                    : step.done
                    ? tone.cardDone
                    : step.active
                        ? tone.cardActive
                        : tone.cardIdle;
                const badgeStyle = step.recommended
                    ? tone.badgeRecommended
                    : step.done
                    ? tone.badgeDone
                    : step.active
                        ? tone.badgeActive
                        : tone.badgeIdle;
                return `
                <button
                    type="button"
                    data-home-stage-button="true"
                    onclick="event.stopPropagation(); runHomeAction('${step.action}')"
                    class="min-h-[74px] rounded-[1.2rem] border px-1 py-1 text-center active:scale-[0.98] transition-transform md:min-h-[122px] md:rounded-[1.7rem] md:px-1.5 md:py-2.5"
                    style="${cardStyle}">
                    <div class="flex h-full flex-col items-center justify-start">
                        <div class="flex items-center justify-center gap-1 text-[8px] font-black leading-tight text-center md:gap-1.5 md:text-[11px]" style="color:${tone.text};">
                            <span class="inline-flex h-[18px] w-[18px] items-center justify-center rounded-full text-[11px] font-black leading-none md:h-6 md:w-6 md:text-[15px]" style="${badgeStyle}">-</span>
                            <span>${step.label}</span>
                        </div>
                        <div class="mt-1 whitespace-nowrap text-[15px] font-black leading-none md:mt-2 md:text-[22px]" style="color:${tone.text};">
                            <span data-home-stage-count="${step.key}">${step.metric.countNumber}</span><span class="ml-0.5 text-[8px] md:ml-1 md:text-[13px]" style="color:${tone.sub};">${step.metric.countUnit}</span>
                        </div>
                        <div class="mt-auto pt-2 text-[7px] font-black text-center whitespace-nowrap leading-none md:pt-3 md:text-[10px]" style="color:${tone.sub};">${step.metric.actionText}</div>
                    </div>
                </button>${index < timeline.steps.length - 1 ? `<div aria-hidden="true" class="flex items-center justify-center text-[10px] font-black leading-none md:text-[14px]" style="color:${tone.sub};">▶</div>` : ''}
            `;
            }).join('')}
        </div>
        <div class="mt-4 rounded-[24px] border border-[#eadfce] bg-white/74 px-3 py-3">
            <div class="text-[10px] font-black tracking-[0.18em] text-[#b9965b] uppercase">Next</div>
            <div class="mt-1 text-sm font-black text-[#4f4639]">次はここから</div>
            <div class="mt-3 flex flex-col gap-3 text-left">
                <button type="button" onclick="runHomeAction('reading')" class="wiz-gender-btn wiz-reading-choice${recommendedChoice === 'reading' ? ' selected' : ''}">
                    <div class="wiz-reading-choice-copy">
                        <span class="block text-base font-bold text-[#5d5444]">読み候補がある</span>
                        <span class="block mt-1 text-[10px] leading-relaxed text-[#8b7e66]">希望の読みから<br>理想の漢字をさがします</span>
                    </div>
                    <div class="wiz-mini-preview" aria-hidden="true">
                        <div class="wiz-mini-card wiz-mini-card-back" style="background:#E8F5E9;">環</div>
                        <div class="wiz-mini-card wiz-mini-card-center" style="background:#FFFDE7;">歓</div>
                        <div class="wiz-mini-card wiz-mini-card-front" style="background:#FFEBEE;">漢</div>
                    </div>
                </button>
                <button type="button" onclick="runHomeAction('sound')" class="wiz-gender-btn wiz-reading-choice${recommendedChoice === 'sound' ? ' selected' : ''}">
                    <div class="wiz-reading-choice-copy">
                        <span class="block text-base font-bold text-[#5d5444]">まだない</span>
                        <span class="block mt-1 text-[10px] leading-relaxed text-[#8b7e66]">響きから<br>読みの候補をさがします</span>
                    </div>
                    <div class="wiz-mini-preview" aria-hidden="true">
                        <div class="wiz-mini-card wiz-mini-card-back" style="background:linear-gradient(145deg,#fdf7ef,#f0e0c4); font-size:10px;">ひ</div>
                        <div class="wiz-mini-card wiz-mini-card-center" style="background:linear-gradient(145deg,#fdf7ef,#f0e0c4); font-size:10px;">び</div>
                        <div class="wiz-mini-card wiz-mini-card-front" style="background:linear-gradient(145deg,#fdf7ef,#f0e0c4); font-size:10px;">き</div>
                    </div>
                </button>
            </div>
        </div>
    `;

    Array.from(stageTrack.querySelectorAll('[data-home-stage-button]')).forEach((button, index) => {
        const badge = button.querySelector('span');
        if (!badge) return;
        badge.textContent = timeline.steps[index]?.done ? '✓' : '-';
    });
}

function runHomeAction(action) {
    if (action === 'saved' && typeof openSavedNames === 'function') {
        openSavedNames();
        return;
    }

    if (action === 'stock-reading') {
        if (typeof openStock === 'function') {
            openStock('reading');
        } else {
            if (typeof changeScreen === 'function') changeScreen('scr-stock');
            if (typeof switchStockTab === 'function') switchStockTab('reading');
            if (typeof renderStock === 'function') renderStock();
        }
        return;
    }

    if (action === 'matched-saved') {
        openSavedNamesWithPartnerFocus('matched');
        return;
    }

    if (action === 'matched-reading') {
        openStockWithPartnerFocus('reading', 'readingFocus', 'matched');
        return;
    }

    if (action === 'stock') {
        if (typeof openStock === 'function') {
            openStock('kanji');
        } else {
            if (typeof changeScreen === 'function') changeScreen('scr-stock');
            if (typeof switchStockTab === 'function') switchStockTab('kanji');
            if (typeof renderStock === 'function') renderStock();
        }
        return;
    }

    if (action === 'matched-liked') {
        openStockWithPartnerFocus('kanji', 'kanjiFocus', 'matched');
        return;
    }

    if (action === 'partner-liked') {
        openStockWithPartnerFocus('kanji', 'kanjiFocus', 'partner');
        return;
    }

    if (action === 'partner-reading') {
        openStockWithPartnerFocus('reading', 'readingFocus', 'partner');
        return;
    }

    if (action === 'partner-saved') {
        openSavedNamesWithPartnerFocus('partner');
        return;
    }

    if (action === 'build') {
        if (typeof openBuild === 'function') {
            openBuild();
        } else if (typeof changeScreen === 'function') {
            changeScreen('scr-build');
        }
        return;
    }

    if (action === 'pair') {
        if (typeof handleHomePairAction === 'function') handleHomePairAction();
        return;
    }

    if (action === 'sound') {
        if (typeof startMode === 'function') startMode('sound');
        return;
    }

    if (action === 'reading') {
        if (typeof startMode === 'function') {
            startMode('reading');
        } else if (typeof changeScreen === 'function') {
            changeScreen('scr-input-reading');
        }
    }
}

function openHomePartnerHubAction(action, event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    closeHomePartnerHub();
    runHomeAction(action);
}

function openHomePartnerHubFromEvent(event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    openHomePartnerHub();
}

function openHomePartnerHub() {
    closeHomePartnerHub();

    const pairing = getPairingHomeSummary();
    if (!pairing.inRoom) {
        if (typeof handleHomePairAction === 'function') handleHomePairAction();
        return;
    }

    if (!pairing.hasPartner) {
        if (typeof toggleHomePairJoinRow === 'function') toggleHomePairJoinRow(null, true);
        return;
    }

    const partnerInsights = typeof window.MeimayPartnerInsights !== 'undefined' ? window.MeimayPartnerInsights : null;
    const partnerSaved = partnerInsights?.getPartnerSaved ? partnerInsights.getPartnerSaved() : [];
    const partnerPendingSaved = partnerSaved.filter(item => !item?.approvedFromPartner && !partnerInsights?.isPartnerSavedApproved?.(item));
    const partnerReadings = partnerInsights?.getPartnerReadingStock ? partnerInsights.getPartnerReadingStock() : [];
    const partnerPendingReadings = partnerReadings.filter(item => !partnerInsights?.isPartnerReadingApproved?.(item));
    const matchedSavedCount = pairing.matchedNameCount || 0;
    const matchedLikedCount = pairing.matchedKanjiCount || 0;

    const modal = document.createElement('div');
    modal.id = 'home-partner-hub-modal';
    modal.className = 'overlay active modal-overlay-dark';
    modal.innerHTML = `
        <div class="modal-sheet w-11/12 max-w-lg" onclick="event.stopPropagation()">
            <button class="modal-close-x" onclick="closeHomePartnerHub()">✕</button>
            <h3 class="modal-title">${pairing.partnerCallName}との連携</h3>
            <div class="modal-body">
                <div class="rounded-2xl border border-[#eee5d8] bg-[#fffaf5] px-4 py-3">
                    <div class="text-[10px] font-black tracking-[0.18em] text-[#b9965b] uppercase">Partner</div>
                    <div class="mt-1 text-sm font-bold text-[#5d5444]">${pairing.title}</div>
                    <div class="mt-2 text-[11px] text-[#8b7e66] leading-relaxed">${pairing.footnote}</div>
                </div>
                <div class="grid grid-cols-2 gap-3 mt-4">
                    <button onclick="openHomePartnerHubAction('partner-saved', event)" class="text-left rounded-2xl border border-[#f4d3cf] bg-white px-4 py-3 active:scale-[0.98] transition-transform">
                        <div class="text-[10px] font-black tracking-wide text-[#dd7d73]">相手の保存候補</div>
                        <div class="mt-2 text-xl font-black text-[#4f4639]">${partnerPendingSaved.length}</div>
                        <div class="mt-1 text-[11px] text-[#8b7e66]">いいね待ちの候補を見る</div>
                    </button>
                    <button onclick="openHomePartnerHubAction('partner-reading', event)" class="text-left rounded-2xl border border-[#eadfce] bg-white px-4 py-3 active:scale-[0.98] transition-transform">
                        <div class="text-[10px] font-black tracking-wide text-[#b9965b]">相手の読み候補</div>
                        <div class="mt-2 text-xl font-black text-[#4f4639]">${partnerPendingReadings.length}</div>
                        <div class="mt-1 text-[11px] text-[#8b7e66]">読みストックから見る</div>
                    </button>
                    <button onclick="openHomePartnerHubAction('matched-liked', event)" class="text-left rounded-2xl border border-[#eee5d8] bg-white px-4 py-3 active:scale-[0.98] transition-transform">
                        <div class="text-[10px] font-black tracking-wide text-[#88a3c5]">一致した漢字</div>
                        <div class="mt-2 text-xl font-black text-[#4f4639]">${matchedLikedCount}</div>
                        <div class="mt-1 text-[11px] text-[#8b7e66]">共通で気になった漢字へ</div>
                    </button>
                    <button onclick="openHomePartnerHubAction('matched-saved', event)" class="text-left rounded-2xl border border-[#eee5d8] bg-white px-4 py-3 active:scale-[0.98] transition-transform">
                        <div class="text-[10px] font-black tracking-wide text-[#9d8cbc]">一致した名前</div>
                        <div class="mt-2 text-xl font-black text-[#4f4639]">${matchedSavedCount}</div>
                        <div class="mt-1 text-[11px] text-[#8b7e66]">一致した保存候補へ</div>
                    </button>
                </div>
            </div>
        </div>
    `;
    modal.addEventListener('click', closeHomePartnerHub);
    document.body.appendChild(modal);
}

function handleHomeInlinePartnerAction(event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    if (typeof changeScreen === 'function') changeScreen('scr-login');
}

function openHomeInsightsModalFromEvent(event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    openHomeInsightsModal();
}

function openHomeInsightsModal() {
    if (typeof closeHomeInsightsModal === 'function') closeHomeInsightsModal();

    const homeOwnership = getHomeOwnershipSummary();
    const pairing = homeOwnership.pairing || getPairingHomeSummary();
    const likedCount = homeOwnership.ownLikedCount;
    const readingStock = homeOwnership.ownReadingItems;
    const readingStockCount = homeOwnership.ownReadingCount;
    const savedCount = homeOwnership.ownSavedCount;
    const buildPatternCount = getHomeBuildPatternCount();
    const aggregateCounts = getHomeAggregateCounts(likedCount, readingStockCount, savedCount, pairing);
    const nextStep = getHomeNextStep(likedCount, readingStockCount, savedCount, pairing) || {
        title: '次に進める候補があります',
        detail: 'いま足りない材料から順に案内します。',
        actionLabel: '開く',
        action: 'sound'
    };
    const todoRecommendations = (typeof getHomeTodoRecommendations === 'function'
        ? getHomeTodoRecommendations(likedCount, readingStock, savedCount, pairing)
        : [])
        .filter(todo => todo && todo.action && todo.action !== nextStep.action)
        .slice(0, 3);

    const cards = [
        { label: '読み', count: readingStockCount, action: readingStockCount > 0 ? 'stock-reading' : 'sound', suffix: '件' },
        { label: '漢字', count: likedCount, action: likedCount > 0 ? 'stock' : (readingStockCount > 0 ? 'reading' : 'sound'), suffix: '件' },
        { label: 'ビルド', count: buildPatternCount, action: buildPatternCount > 0 ? 'build' : (readingStockCount > 0 ? 'reading' : 'sound'), suffix: 'パターン' },
        { label: '保存', count: savedCount, action: savedCount > 0 ? 'saved' : (buildPatternCount > 0 ? 'build' : (readingStockCount > 0 ? 'reading' : 'sound')), suffix: '件' }
    ];

    if (Array.isArray(cards)) {
        if (cards[0]) cards[0].count = aggregateCounts.readingStockCount;
        if (cards[1]) cards[1].count = aggregateCounts.likedCount;
        if (cards[3]) cards[3].count = aggregateCounts.savedCount;
    }

    const cardHtml = cards.map(card => {
        const safeCount = Number.isFinite(Number(card.count)) ? Number(card.count) : 0;
        return `
            <button
                onclick="handleHomeTodoAction('${card.action}', event)"
                class="rounded-2xl border border-[#eee5d8] bg-white px-4 py-4 text-left shadow-sm active:scale-[0.98] transition-transform">
                <div class="text-[11px] font-black tracking-wide text-[#a6967a]">${card.label}</div>
                <div class="mt-2 flex items-end gap-1">
                    <span class="text-[24px] font-black leading-none text-[#4f4639]">${safeCount}</span>
                    <span class="pb-0.5 text-[11px] font-bold leading-none text-[#a6967a]">${card.suffix}</span>
                </div>
            </button>
        `;
    }).join('');

    const todoHtml = todoRecommendations.length > 0
        ? `
            <div class="mt-4 flex flex-wrap gap-2">
                ${todoRecommendations.map(todo => `
                    <button
                        onclick="handleHomeTodoAction('${todo.action}', event)"
                        class="rounded-full border border-[#eadfce] bg-white px-3 py-2 text-[11px] font-bold text-[#5d5444] shadow-sm active:scale-[0.98] transition-transform">
                        ${todo.label}
                    </button>
                `).join('')}
            </div>
        `
        : '';

    const modal = document.createElement('div');
    modal.id = 'home-insights-modal';
    modal.className = 'overlay active modal-overlay-dark';
    modal.innerHTML = `
        <div class="modal-sheet w-11/12 max-w-md" onclick="event.stopPropagation()">
            <button class="modal-close-x" onclick="closeHomeInsightsModal()">✕</button>
            <div class="pt-4 pb-2">
                <h3 class="text-[24px] font-black text-[#4f4639]">名づけの進み具合</h3>
                <p class="mt-2 text-[12px] leading-relaxed text-[#8b7e66]">いま集まっている候補と、次にやることだけをまとめています。</p>
            </div>
            <div class="mt-4 grid grid-cols-2 gap-3">
                ${cardHtml}
            </div>
            <div class="mt-4 rounded-2xl border border-[#eee5d8] bg-[#fff9f0] p-4">
                <div class="text-[10px] font-black tracking-[0.18em] text-[#b9965b] uppercase">次のおすすめ</div>
                <div class="mt-2 text-[16px] font-black text-[#4f4639]">${nextStep.title || '次に進める候補があります'}</div>
                <div class="mt-2 text-[12px] leading-relaxed text-[#8b7e66]">${nextStep.detail || 'いま足りない材料から順に案内します。'}</div>
                <button
                    onclick="handleHomeNextStepAction(event)"
                    class="mt-4 w-full rounded-2xl bg-[#b9965b] py-3 text-sm font-bold text-white shadow-sm active:scale-[0.98] transition-transform">
                    ${nextStep.actionLabel || '開く'}
                </button>
                ${todoHtml}
            </div>
        </div>
    `;
    modal.addEventListener('click', closeHomeInsightsModal);
    document.body.appendChild(modal);
}

function getHomeStatusLine(likedCount, readingStockCount, savedCount, buildCount = null) {
    const buildPatternCount = Number.isFinite(Number(buildCount))
        ? Number(buildCount)
        : getHomeBuildPatternCount();
    if (savedCount > 0) {
        return '保存した候補を見比べながら、絞り込んでいるところです。';
    }
    if (buildPatternCount > 0) {
        return '組み立てた候補を見ながら、保存する名前を選ぶ段階です。';
    }
    if (likedCount > 0) {
        return '集めた漢字をもとに、名前の組み合わせを広げていく段階です。';
    }
    if (readingStockCount > 0) {
        return '読み候補をもとに、合う漢字を集めているところです。';
    }
    return 'まずは読み候補を集めて、方向を決めていきましょう。';
}

function getHomeAggregateCounts(likedCount, readingStockCount, savedCount, pairing) {
    const counts = pairing?.counts || {};
    const ownReadingCount = Number.isFinite(Number(counts?.own?.reading ?? pairing?.ownReadingCount ?? readingStockCount))
        ? Number(counts?.own?.reading ?? pairing?.ownReadingCount ?? readingStockCount)
        : 0;
    const ownKanjiCount = Number.isFinite(Number(counts?.own?.kanji ?? pairing?.ownKanjiCount ?? likedCount))
        ? Number(counts?.own?.kanji ?? pairing?.ownKanjiCount ?? likedCount)
        : 0;
    const ownSavedCount = Number.isFinite(Number(counts?.own?.saved ?? pairing?.ownSavedCount ?? savedCount))
        ? Number(counts?.own?.saved ?? pairing?.ownSavedCount ?? savedCount)
        : 0;
    const partnerReadingCount = Number.isFinite(Number(counts?.partner?.reading ?? pairing?.partnerReadingCount))
        ? Number(counts?.partner?.reading ?? pairing?.partnerReadingCount)
        : 0;
    const partnerKanjiCount = Number.isFinite(Number(counts?.partner?.kanji ?? pairing?.partnerKanjiCount))
        ? Number(counts?.partner?.kanji ?? pairing?.partnerKanjiCount)
        : 0;
    const partnerSavedCount = Number.isFinite(Number(counts?.partner?.saved ?? pairing?.partnerSavedCount))
        ? Number(counts?.partner?.saved ?? pairing?.partnerSavedCount)
        : 0;
    const matchedReadingCount = Number.isFinite(Number(counts?.matched?.reading ?? pairing?.matchedReadingCount))
        ? Number(counts?.matched?.reading ?? pairing?.matchedReadingCount)
        : 0;
    const matchedKanjiCount = Number.isFinite(Number(counts?.matched?.kanji ?? pairing?.matchedKanjiCount))
        ? Number(counts?.matched?.kanji ?? pairing?.matchedKanjiCount)
        : 0;
    const matchedSavedCount = Number.isFinite(Number(counts?.matched?.saved ?? pairing?.matchedNameCount))
        ? Number(counts?.matched?.saved ?? pairing?.matchedNameCount)
        : 0;

    return {
        readingStockCount: Math.max(0, ownReadingCount + partnerReadingCount - matchedReadingCount),
        likedCount: typeof window.getVisibleKanjiStockCardCount === 'function' ? window.getVisibleKanjiStockCardCount('all') : Math.max(0, ownKanjiCount + partnerKanjiCount - matchedKanjiCount),
        savedCount: Math.max(0, ownSavedCount + partnerSavedCount - matchedSavedCount)
    };
}

function updateHomeAggregateStageCounts(aggregateCounts) {
    const countMap = {
        reading: aggregateCounts.readingStockCount,
        kanji: aggregateCounts.likedCount,
        save: aggregateCounts.savedCount
    };

    Object.entries(countMap).forEach(([stepKey, count]) => {
        const el = document.querySelector(`[data-home-stage-count="${stepKey}"]`);
        if (el) el.innerText = String(count);
    });
}

function getHomeOverviewChipColor(role, palette) {
    if (palette?.accent) return palette.accent;
    return role === 'mama' ? '#F2A9C2' : '#AFCBFF';
}

function getHomeOverviewSwitchOptions(pairing) {
    if (!pairing?.hasPartner) {
        return [{ mode: 'self', label: 'マイ候補' }];
    }

    return [
        { mode: 'shared', label: 'ふたりで集めた候補' },
        { mode: 'self', label: 'マイ候補' },
        { mode: 'partner', label: 'パートナー候補' }
    ];
}

function getHomeOverviewSwitchStyle(mode) {
    const kind = mode === 'shared' ? 'matched' : mode === 'partner' ? 'partner' : 'self';
    const palette = typeof window.getMeimayOwnershipPalette === 'function'
        ? window.getMeimayOwnershipPalette(kind)
        : null;
    const pairPalettes = typeof window.getMeimayRelationshipPalettes === 'function'
        ? window.getMeimayRelationshipPalettes()
        : { self: palette, partner: palette };
    const selfChip = getHomeOverviewChipColor(pairPalettes?.self?.role, pairPalettes?.self);
    const partnerChip = getHomeOverviewChipColor(pairPalettes?.partner?.role, pairPalettes?.partner);
    const singleChip = kind === 'partner' ? partnerChip : selfChip;
    if (!palette) {
        return {
            button: 'border:1px solid #b9965b;background:#b9965b;',
            text: '#4f4639',
            sub: '#5d5444'
        };
    }
    if (kind === 'matched') {
        return {
            button: `border:1px solid transparent;background:linear-gradient(135deg, ${selfChip} 0%, ${partnerChip} 100%) padding-box, linear-gradient(135deg, ${palette.border} 0%, ${palette.borderAlt} 100%) border-box;`,
            text: '#4f4639',
            sub: '#5d5444'
        };
    }
    return {
        button: `border:1px solid ${singleChip};background:${singleChip};`,
        text: '#4f4639',
        sub: '#5d5444'
    };
}

function cycleHomeOverviewMode() {
    const pairing = getPairingHomeSummary();
    const options = getHomeOverviewSwitchOptions(pairing);
    if (options.length <= 1) return;

    const currentMode = getHomeOverviewMode(pairing);
    const currentIndex = options.findIndex(option => option.mode === currentMode);
    const nextOption = options[(currentIndex + 1 + options.length) % options.length] || options[0];
    setHomeOverviewMode(nextOption.mode);
}

function renderHomeOverviewSwitch(pairing) {
    const mount = document.getElementById('home-overview-switch');
    if (!mount) return;

    const options = getHomeOverviewSwitchOptions(pairing);
    const activeMode = getHomeOverviewMode(pairing);
    const activeOption = options.find(option => option.mode === activeMode) || options[0];
    const switchStyle = getHomeOverviewSwitchStyle(activeOption.mode);
    const canCycle = options.length > 1;
    mount.innerHTML = `
        <button
            type="button"
            ${canCycle ? 'onclick="event.stopPropagation(); cycleHomeOverviewMode()"' : ''}
            class="w-full rounded-[1.05rem] px-1.5 py-2 text-center active:scale-95 transition-transform md:rounded-[1.2rem] md:px-2 md:py-2.5"
            style="${switchStyle.button}">
            <div class="flex flex-col items-center justify-center">
                <div class="whitespace-nowrap text-[8px] font-black leading-tight md:text-[9px]" style="color:${switchStyle.text};">
                    ${activeOption.label}
                </div>
                <div class="${canCycle ? '' : 'hidden'} mt-0.5 whitespace-nowrap text-[7px] font-medium leading-tight md:text-[8px]" style="color:${switchStyle.sub};">
                    タップで切り替え
                </div>
            </div>
        </button>
    `;
}

function getHomeOverviewStageSnapshot(likedCount, readingStockCount, savedCount, pairing) {
    const mode = getHomeOverviewMode(pairing);
    const counts = pairing?.counts || {
        own: {
            reading: readingStockCount,
            kanji: likedCount,
            saved: savedCount
        },
        partner: {
            reading: 0,
            kanji: 0,
            saved: 0
        },
        matched: {
            reading: pairing?.matchedReadingCount || 0,
            kanji: pairing?.matchedKanjiCount || 0,
            saved: pairing?.matchedNameCount || 0
        }
    };
    const insights = typeof window.MeimayPartnerInsights !== 'undefined' ? window.MeimayPartnerInsights : null;
    const wizard = getWizardHomeState();
    const aggregateCounts = getHomeAggregateCounts(likedCount, readingStockCount, savedCount, pairing);
    const ownLikedItems = insights?.getOwnLiked
        ? insights.getOwnLiked()
        : ((typeof liked !== 'undefined' && Array.isArray(liked))
            ? liked.filter(item => !item?.fromPartner)
            : []);
    const partnerLikedItems = insights?.getPartnerLiked ? insights.getPartnerLiked() : [];
    const ownReadingStock = insights?.getOwnReadingStock
        ? insights.getOwnReadingStock()
        : (typeof getReadingStock === 'function' ? getReadingStock() : []);
    const partnerReadingStock = insights?.getPartnerReadingStock
        ? insights.getPartnerReadingStock()
        : [];
    const partnerLikedItemsVisible = partnerLikedItems;
    const partnerReadingCount = Number(counts?.partner?.reading ?? pairing?.partnerReadingCount ?? (Array.isArray(partnerReadingStock) ? partnerReadingStock.length : 0));
    const partnerKanjiCount = Number(counts?.partner?.kanji ?? pairing?.partnerKanjiCount ?? (Array.isArray(partnerLikedItemsVisible) ? partnerLikedItemsVisible.length : 0));
    const partnerSavedCount = Number(counts?.partner?.saved ?? pairing?.partnerSavedCount ?? 0);
    const ownReadingCount = Number(counts?.own?.reading ?? pairing?.ownReadingCount ?? (Array.isArray(ownReadingStock) ? ownReadingStock.length : readingStockCount ?? 0));
    const ownKanjiCount = typeof window.getVisibleKanjiStockCardCount === 'function' ? window.getVisibleKanjiStockCardCount('all', ownLikedItems) : Number(counts?.own?.kanji ?? pairing?.ownKanjiCount ?? (Array.isArray(ownLikedItems) ? ownLikedItems.length : likedCount ?? 0));
    const ownSavedCount = Number(counts?.own?.saved ?? pairing?.ownSavedCount ?? savedCount ?? 0);
    const aggregateReadingStock = [...ownReadingStock, ...partnerReadingStock];
    const aggregateBuildCount = getHomeBuildPatternCount(undefined, aggregateReadingStock);
    const partnerBuildCount = getHomeBuildPatternCount(partnerLikedItemsVisible, partnerReadingStock);
    const ownBuildCount = getHomeBuildPatternCount(ownLikedItems, ownReadingStock);

    if (mode === 'shared') {
        const aggregateFallbackAction = (aggregateCounts.readingStockCount > 0 || wizard.hasReadingCandidate) ? 'reading' : 'sound';
        return {
            mode,
            readingStockCount: aggregateCounts.readingStockCount,
            likedCount: aggregateCounts.likedCount,
            savedCount: aggregateCounts.savedCount,
            buildCount: aggregateBuildCount,
            actions: {
                reading: aggregateCounts.readingStockCount > 0 ? 'stock-reading' : 'sound',
                kanji: aggregateCounts.likedCount > 0 ? 'stock' : aggregateFallbackAction,
                build: aggregateBuildCount > 0 ? 'build' : aggregateFallbackAction,
                save: aggregateCounts.savedCount > 0 ? 'saved' : (aggregateBuildCount > 0 ? 'build' : aggregateFallbackAction)
            },
            actionLabels: {
                reading: '読みを見る＞',
                kanji: '漢字を見る＞',
                build: '組み立てる＞',
                save: '候補を見る＞'
            }
        };
    }

    if (mode === 'partner') {
        return {
            mode,
            readingStockCount: partnerReadingCount,
            likedCount: partnerKanjiCount,
            savedCount: partnerSavedCount,
            buildCount: partnerBuildCount,
            actions: {
                reading: 'partner-reading',
                kanji: 'partner-liked',
                build: partnerBuildCount > 0 ? 'build' : (partnerReadingCount > 0 ? 'partner-reading' : partnerKanjiCount > 0 ? 'partner-liked' : 'partner-reading'),
                save: 'partner-saved'
            },
            actionLabels: {
                reading: '読みを見る＞',
                kanji: '漢字を見る＞',
                build: '組み立てる＞',
                save: '候補を見る＞'
            }
        };
    }

    const selfFallbackAction = (ownReadingCount > 0 || wizard.hasReadingCandidate) ? 'reading' : 'sound';
    return {
        mode: 'self',
        readingStockCount: ownReadingCount,
        likedCount: ownKanjiCount,
        savedCount: ownSavedCount,
        buildCount: ownBuildCount,
        actions: {
            reading: ownReadingCount > 0 ? 'stock-reading' : 'sound',
            kanji: ownKanjiCount > 0 ? 'stock' : selfFallbackAction,
            build: ownBuildCount > 0 ? 'build' : selfFallbackAction,
            save: ownSavedCount > 0 ? 'saved' : (ownBuildCount > 0 ? 'build' : selfFallbackAction)
        }
    };
}

function renderHomeProfile() {
    const homeOwnership = getHomeOwnershipSummary();
    const likedCount = homeOwnership.ownLikedCount;
    const savedCount = homeOwnership.ownSavedCount;
    const readingStockCount = homeOwnership.ownReadingCount;
    const preference = typeof getHomePreferenceSummary === 'function'
        ? getHomePreferenceSummary(homeOwnership.ownLikedItems)
        : { shortText: 'まだ傾向なし' };
    const pairing = homeOwnership.pairing || getPairingHomeSummary();
    const nextStep = getHomeNextStep(likedCount, readingStockCount, savedCount, pairing);
    const recommendedEntry = getHomeRecommendedEntry(readingStockCount, likedCount, savedCount);
    const stageSnapshot = getHomeOverviewStageSnapshot(likedCount, readingStockCount, savedCount, pairing);
    stageSnapshot.recommendedKey = getHomeOverviewInitialStageKey(stageSnapshot, nextStep);

    const screen = document.getElementById('scr-mode');
    const heroCard = document.getElementById('home-hero-card');
    const entryDivider = document.getElementById('home-entry-divider');
    const entryGrid = document.getElementById('home-entry-grid');
    const utilityGrid = document.getElementById('home-utility-grid');
    const toolGrid = document.getElementById('home-tool-grid');
    if (screen) {
        screen.style.paddingLeft = '12px';
        screen.style.paddingRight = '12px';
    }

    const summaryPanel = document.getElementById('home-summary-panel');
    if (summaryPanel) summaryPanel.classList.remove('hidden');
    if (heroCard) heroCard.style.cssText = '';

    renderHomeOverviewSwitch(pairing);
    renderHomeStageTrack(stageSnapshot.likedCount, stageSnapshot.readingStockCount, stageSnapshot.savedCount, stageSnapshot);

    const elSaved = document.getElementById('home-liked-name-count');
    if (elSaved) elSaved.innerText = stageSnapshot.savedCount;

    const elKanji = document.getElementById('home-liked-kanji-count');
    if (elKanji) elKanji.innerText = stageSnapshot.likedCount;

    const elReadingStock = document.getElementById('home-reading-stock-count');
    if (elReadingStock) elReadingStock.innerText = stageSnapshot.readingStockCount;

    const nextStepTitleEl = document.getElementById('home-next-step-title');
    if (nextStepTitleEl) {
        nextStepTitleEl.innerText = '';
        nextStepTitleEl.classList.add('hidden');
    }

    const nextStepDetailEl = document.getElementById('home-next-step-detail');
    if (nextStepDetailEl) {
        nextStepDetailEl.innerText = '';
        nextStepDetailEl.classList.add('hidden');
    }

    const nextStepActionLabelEl = document.getElementById('home-next-step-action-label');
    if (nextStepActionLabelEl) {
        nextStepActionLabelEl.innerText = nextStep.actionLabel || '開く';
        nextStepActionLabelEl.classList.add('hidden');
    }

    const statusLineEl = document.getElementById('home-status-line');
    if (statusLineEl) {
        statusLineEl.innerText = getHomeStatusLine(
            stageSnapshot.likedCount,
            stageSnapshot.readingStockCount,
            stageSnapshot.savedCount,
            stageSnapshot.buildCount
        );
    }

    const overviewMount = document.getElementById('home-overview-mount');
    if (overviewMount) {
        overviewMount.innerHTML = '';
        overviewMount.classList.add('hidden');
    }

    if (entryDivider) entryDivider.classList.add('hidden');
    if (entryGrid) entryGrid.classList.add('hidden');
    if (utilityGrid) utilityGrid.classList.add('hidden');
    if (toolGrid) {
        toolGrid.classList.remove('hidden');
        const toolButtons = toolGrid.querySelectorAll('button');
        const encounteredButton = toolButtons[2];
        if (encounteredButton) {
            encounteredButton.setAttribute('onclick', "openEncounteredLibrary('kanji')");
            encounteredButton.innerHTML = `
                <span class="text-xl">🗂️</span>
                <span class="text-[10px] font-bold text-[#5d5444]">出会った候補</span>
            `;
        }
    }


    const elPrefSummary = document.getElementById('home-preference-summary');
    if (elPrefSummary) elPrefSummary.innerText = preference.shortText || 'まだ傾向なし';
    const partnerInlineTitle = document.getElementById('home-partner-inline-title');
    const partnerInlineSubtitle = document.getElementById('home-partner-inline-subtitle');
    if (partnerInlineTitle) {
        let title = 'パートナー：未連携';
        if (pairing.hasPartner) {
            title = `パートナー：${pairing.partnerCallName || pairing.partnerDisplayName || 'パートナー'}と連携中`;
        }
        partnerInlineTitle.innerText = title;
    }
    if (partnerInlineSubtitle) {
        partnerInlineSubtitle.classList.toggle('hidden', !!pairing.hasPartner);
        partnerInlineSubtitle.innerText = '連携すると二人で名前をさがせます';
    }

    const soundBadge = document.getElementById('home-entry-sound-badge');
    if (soundBadge) soundBadge.classList.add('hidden');

    const readingBadge = document.getElementById('home-entry-reading-badge');
    if (readingBadge) readingBadge.classList.add('hidden');

    const soundEntry = document.getElementById('home-entry-sound');
    const selfPalette = typeof window.getMeimayOwnershipPalette === 'function'
        ? window.getMeimayOwnershipPalette('self')
        : null;
    const homeEntryBorder = selfPalette?.border || '#c4caf2';
    if (soundEntry) {
        soundEntry.style.boxShadow = '';
        soundEntry.style.borderWidth = recommendedEntry === 'sound' ? '3px' : '2px';
        soundEntry.style.borderColor = recommendedEntry === 'sound' ? '#b9965b' : homeEntryBorder;
        soundEntry.style.background = '#ffffff';
    }

    const readingEntry = document.getElementById('home-entry-reading');
    if (readingEntry) {
        readingEntry.style.boxShadow = '';
        readingEntry.style.borderWidth = recommendedEntry === 'reading' ? '3px' : '2px';
        readingEntry.style.borderColor = recommendedEntry === 'reading' ? '#b9965b' : homeEntryBorder;
        readingEntry.style.background = '#ffffff';
    }

    const pairCard = document.getElementById('home-pair-card');
    if (pairCard) {
        pairCard.classList.add('hidden');
    }

    const dismissBtn = document.getElementById('home-pair-dismiss');
    if (dismissBtn) dismissBtn.classList.add('hidden');

    const restoreBtn = document.getElementById('home-pair-restore');
    if (restoreBtn) restoreBtn.classList.add('hidden');
}

window.closeHomePartnerHub = closeHomePartnerHub;
window.openHomePartnerHub = openHomePartnerHub;
window.openHomePartnerHubFromEvent = openHomePartnerHubFromEvent;
window.openHomePartnerHubAction = openHomePartnerHubAction;
window.handleHomeInlinePartnerAction = handleHomeInlinePartnerAction;
window.getMeimayPartnerViewState = getMeimayPartnerViewState;
window.setMeimayPartnerViewFocus = setMeimayPartnerViewFocus;
window.resetMeimayPartnerViewFocus = resetMeimayPartnerViewFocus;
window.openHomeInsightsModal = openHomeInsightsModal;
window.openHomeInsightsModalFromEvent = openHomeInsightsModalFromEvent;
window.renderHomeProfile = renderHomeProfile;

function getHomeOverviewMode(pairing) {
    const hasPartner = !!pairing?.hasPartner;
    const modeSource = window.MeimayHomeOverviewModeSource || 'auto';
    const defaultMode = pairing?.hasPartner ? 'shared' : 'self';
    const allowed = pairing?.hasPartner ? ['shared', 'self', 'partner'] : ['self'];
    if (!allowed.includes(window.MeimayHomeOverviewMode)) {
        window.MeimayHomeOverviewMode = defaultMode;
        window.MeimayHomeOverviewModeSource = 'auto';
    } else if (hasPartner && window.MeimayHomeOverviewMode === 'self' && modeSource !== 'manual') {
        window.MeimayHomeOverviewMode = 'shared';
        window.MeimayHomeOverviewModeSource = 'auto';
    } else if (!window.MeimayHomeOverviewModeSource) {
        window.MeimayHomeOverviewModeSource = 'auto';
    }
    return window.MeimayHomeOverviewMode;
}

function setHomeOverviewMode(mode) {
    const previousMode = window.MeimayHomeOverviewMode;
    window.MeimayHomeOverviewMode = mode;
    window.MeimayHomeOverviewModeSource = window.MeimayPairing?.partnerUid ? 'manual' : 'auto';
    if (previousMode !== mode) {
        window.MeimayHomeStageFocusSource = 'auto';
    }
    if (typeof renderHomeProfile === 'function') renderHomeProfile();
}

function getHomeOverviewTone(mode) {
    if (typeof window.getMeimayOwnershipPalette !== 'function') {
        return {
            panel: 'border:1px solid #eadfce;background:#fffaf5;',
            accent: '#b9965b',
            sub: '#8b7e66',
            chipBg: '#fff',
            chipText: '#5d5444',
            button: 'background:#b9965b;color:#fff;',
            ghost: 'border:1px solid #eadfce;background:#fff;color:#8b7e66;'
        };
    }
    const kind = mode === 'shared' ? 'matched' : mode === 'partner' ? 'partner' : 'self';
    const palette = window.getMeimayOwnershipPalette(kind);
    if (kind === 'matched') {
        const pairPalettes = typeof window.getMeimayRelationshipPalettes === 'function'
            ? window.getMeimayRelationshipPalettes()
            : { self: palette, partner: palette };
        return {
            panel: `border:1px solid transparent;background:${palette.surface} padding-box, linear-gradient(135deg, ${palette.border} 0%, ${palette.borderAlt} 100%) border-box;`,
            accent: '#7d6671',
            sub: '#846d78',
            chipBg: 'rgba(255,255,255,0.82)',
            chipText: '#6f5c67',
            button: `background:linear-gradient(135deg, ${pairPalettes.self.accentStrong} 0%, ${pairPalettes.partner.accentStrong} 100%);color:#fff;`,
            ghost: 'border:1px solid rgba(255,255,255,0.78);background:rgba(255,255,255,0.84);color:#7d6671;'
        };
    }
    return {
        panel: `border:1px solid ${palette.border};background:${palette.surface};`,
        accent: palette.text || '#8b7e66',
        sub: palette.text || '#8b7e66',
        chipBg: 'rgba(255,255,255,0.84)',
        chipText: palette.text || '#5d5444',
        button: `background:${palette.accentStrong || palette.accent};color:#fff;`,
        ghost: `border:1px solid ${palette.border};background:rgba(255,255,255,0.84);color:${palette.text || '#8b7e66'};`
    };
}

function getHomeOverviewModel(pairing, nextStep) {
    const mode = getHomeOverviewMode(pairing);
    const counts = pairing?.counts || {
        own: {
            reading: 0,
            kanji: 0,
            saved: 0
        },
        partner: {
            reading: 0,
            kanji: 0,
            saved: 0
        },
        matched: {
            reading: pairing?.matchedReadingCount || 0,
            kanji: pairing?.matchedKanjiCount || 0,
            saved: pairing?.matchedNameCount || 0
        }
    };
    const tone = getHomeOverviewTone(mode);

    if (mode === 'shared') {
        const sharedReadingCount = aggregateCounts.readingStockCount;
        const sharedKanjiCount = aggregateCounts.likedCount;
        const sharedSavedCount = aggregateCounts.savedCount;
        const total = sharedReadingCount + sharedKanjiCount + sharedSavedCount;
        const sharedNextStep = getHomeNextStep(sharedKanjiCount, sharedReadingCount, sharedSavedCount, pairing) || nextStep;
        return {
            mode,
            tone,
            total,
            unit: '件',
            eyebrow: 'ふたりで集めた候補',
            title: total > 0 ? `いま、ふたりで集めた候補 ${total}件` : 'まだふたりの候補はこれからです',
            description: total > 0
                ? `${pairing?.partnerCallName || pairing?.partnerDisplayName || 'パートナー'}と集めた候補を合わせた総数です。`
                : `${pairing?.partnerCallName || pairing?.partnerDisplayName || 'パートナー'}と候補を集めるほど、ここに合計が増えていきます。`,
            breakdown: [
                { label: '読み', count: sharedReadingCount, action: sharedReadingCount > 0 ? 'stock-reading' : 'reading' },
                { label: '漢字', count: sharedKanjiCount, action: sharedKanjiCount > 0 ? 'stock' : (sharedReadingCount > 0 ? 'reading' : 'sound') },
                { label: '保存', count: sharedSavedCount, action: sharedSavedCount > 0 ? 'saved' : (sharedKanjiCount > 0 ? 'build' : (sharedReadingCount > 0 ? 'reading' : 'sound')) }
            ],
            primaryAction: sharedNextStep?.action || 'stock',
            primaryLabel: sharedNextStep?.actionLabel || '次に進む',
            secondaryAction: 'openHomeInsightsModalFromEvent(event)',
            secondaryLabel: 'くわしく見る'
        };
    }

    if (mode === 'partner') {
        const total = pairing?.partnerTotalCount ?? ((counts.partner.reading || 0) + (counts.partner.kanji || 0) + (counts.partner.saved || 0));
        return {
            mode,
            tone,
            total,
            unit: '件',
            eyebrow: '相手の集まり',
            title: `${pairing?.partnerDisplayName || 'パートナー'}が集めた候補`,
            description: '相手のストックを見ながら、自分に取り込みたい候補をすぐ選べます。',
            breakdown: [
                { label: '読み', count: counts.partner.reading || 0, action: 'partner-reading' },
                { label: '漢字', count: counts.partner.kanji || 0, action: 'partner-liked' },
                { label: '保存', count: counts.partner.saved || 0, action: 'partner-saved' }
            ],
            primaryAction: (counts.partner.reading || 0) > 0 ? 'partner-reading' : 'partner-liked',
            primaryLabel: '相手の候補を見る',
            secondaryAction: 'openHomePartnerHubFromEvent(event)',
            secondaryLabel: '連携のまとめ'
        };
    }

    const total = pairing?.ownTotalCount ?? ((counts.own.reading || 0) + (counts.own.kanji || 0) + (counts.own.saved || 0));
    return {
        mode,
        tone,
        total,
        unit: '件',
        eyebrow: pairing?.hasPartner ? '自分の集まり' : 'まずはここから',
        title: pairing?.hasPartner ? '自分が集めた候補' : '名前の材料を育てはじめよう',
        description: pairing?.hasPartner
            ? '自分のストック量を見ながら、次に集める材料を決められます。'
            : '読みを見つけて、漢字を重ねて、ふたりで候補を育てていく準備です。',
        breakdown: [
            { label: '読み', count: counts.own.reading || 0, action: (counts.own.reading || 0) > 0 ? 'stock-reading' : 'sound' },
            { label: '漢字', count: counts.own.kanji || 0, action: (counts.own.kanji || 0) > 0 ? 'stock' : 'reading' },
            { label: '保存', count: counts.own.saved || 0, action: (counts.own.saved || 0) > 0 ? 'saved' : 'build' }
        ],
        primaryAction: nextStep?.action || 'sound',
        primaryLabel: nextStep?.actionLabel || '次に進む',
        secondaryAction: pairing?.hasPartner ? 'openHomeInsightsModalFromEvent(event)' : 'handleHomePairAction()',
        secondaryLabel: pairing?.hasPartner ? 'くわしく見る' : '連携する'
    };
}

function renderHomeProfileV2() {
    const homeOwnership = getHomeOwnershipSummary();
    const likedCount = homeOwnership.ownLikedCount;
    const savedCount = homeOwnership.ownSavedCount;
    const readingStockCount = homeOwnership.ownReadingCount;
    const pairing = homeOwnership.pairing || getPairingHomeSummary();
    const nextStep = getHomeNextStep(likedCount, readingStockCount, savedCount, pairing);
    const stageSnapshot = getHomeOverviewStageSnapshot(likedCount, readingStockCount, savedCount, pairing);
    stageSnapshot.recommendedKey = getHomeOverviewInitialStageKey(stageSnapshot, nextStep);
    const mount = document.getElementById('home-overview-mount');
    const heroCard = document.getElementById('home-hero-card');
    const statusLineEl = document.getElementById('home-status-line');
    const legacyActions = document.getElementById('home-legacy-actions');
    const summaryPanel = document.getElementById('home-summary-panel');
    const entryDivider = document.getElementById('home-entry-divider');
    const entryGrid = document.getElementById('home-entry-grid');
    const pairCard = document.getElementById('home-pair-card');
    const restoreBtn = document.getElementById('home-pair-restore');
    const dismissBtn = document.getElementById('home-pair-dismiss');
    const stageAnchor = document.getElementById('home-stage-track-anchor');
    const screen = document.getElementById('scr-mode');

    if (screen) {
        screen.style.paddingLeft = '12px';
        screen.style.paddingRight = '12px';
    }

    if (heroCard) {
        heroCard.removeAttribute('onclick');
        heroCard.removeAttribute('role');
        heroCard.removeAttribute('tabindex');
        heroCard.removeAttribute('onkeydown');
        heroCard.style.cssText = '';
    }

    if (statusLineEl) statusLineEl.classList.add('hidden');
    if (legacyActions) legacyActions.classList.add('hidden');
    if (summaryPanel) summaryPanel.classList.add('hidden');
    if (entryDivider) entryDivider.classList.add('hidden');
    if (entryGrid) entryGrid.classList.add('hidden');
    if (pairCard) pairCard.classList.add('hidden');
    if (restoreBtn) restoreBtn.classList.add('hidden');
    if (dismissBtn) dismissBtn.classList.add('hidden');
    if (stageAnchor) stageAnchor.classList.remove('hidden');

    const overview = getHomeOverviewModel(pairing, nextStep);
    const mode = overview.mode;
    const isShared = mode === 'shared';
    const stage = getHomeStageTrackTimeline(
        stageSnapshot.likedCount,
        stageSnapshot.readingStockCount,
        stageSnapshot.savedCount,
        stageSnapshot
    );

    if (mount) {
        mount.innerHTML = `
            ${pairing?.hasPartner ? `
                <div class="flex items-center gap-2 rounded-full p-1" style="background:rgba(255,255,255,0.72);border:1px solid rgba(234,223,206,0.92);">
                    <button type="button" onclick="setHomeOverviewMode('shared')" class="flex-1 rounded-full px-3 py-2 text-[11px] font-bold transition-all ${mode === 'shared' ? 'shadow-sm' : ''}" style="${mode === 'shared' ? overview.tone.button : overview.tone.ghost}">ふたり</button>
                    <button type="button" onclick="setHomeOverviewMode('self')" class="flex-1 rounded-full px-3 py-2 text-[11px] font-bold transition-all ${mode === 'self' ? 'shadow-sm' : ''}" style="${mode === 'self' ? getHomeOverviewTone('self').button : getHomeOverviewTone('self').ghost}">自分</button>
                    <button type="button" onclick="setHomeOverviewMode('partner')" class="flex-1 rounded-full px-3 py-2 text-[11px] font-bold transition-all ${mode === 'partner' ? 'shadow-sm' : ''}" style="${mode === 'partner' ? getHomeOverviewTone('partner').button : getHomeOverviewTone('partner').ghost}">相手</button>
                </div>
            ` : ''}
            <div class="mt-3 rounded-[24px] px-4 py-4" style="${overview.tone.panel}">
                <div class="flex items-start justify-between gap-3">
                    <div class="min-w-0 flex-1">
                        <div class="text-[10px] font-black tracking-[0.18em] uppercase" style="color:${overview.tone.accent}">${overview.eyebrow}</div>
                        <div class="mt-2 flex items-end gap-2">
                            <span class="text-[40px] font-black leading-none text-[#4f4639]">${overview.total}</span>
                            <span class="pb-1 text-[12px] font-bold" style="color:${overview.tone.sub}">${overview.unit}</span>
                        </div>
                        <div class="mt-2 text-[16px] font-black leading-snug text-[#4f4639]">${overview.title}</div>
                        <div class="mt-2 text-[11px] leading-relaxed text-[#8b7e66]">${overview.description}</div>
                    </div>
                    <div class="shrink-0 rounded-[20px] px-3 py-3 text-center min-w-[72px]" style="background:${isShared ? 'rgba(255,255,255,0.74)' : overview.tone.chipBg}; border:1px solid rgba(255,255,255,0.62);">
                        <div class="text-[9px] font-black tracking-[0.16em] uppercase" style="color:${overview.tone.sub}">Stage</div>
                        <div class="mt-2 text-[13px] font-black leading-tight text-[#4f4639]">${stage.stageTitle}</div>
                    </div>
                </div>

                <div class="mt-4 grid grid-cols-3 gap-2">
                    ${overview.breakdown.map(item => `
                        <button type="button" onclick="runHomeAction('${item.action}')" class="rounded-2xl px-3 py-3 text-left active:scale-[0.98] transition-transform" style="background:${overview.tone.chipBg}; border:1px solid rgba(255,255,255,0.65);">
                            <div class="text-[10px] font-black tracking-wide" style="color:${overview.tone.sub}">${item.label}</div>
                            <div class="mt-2 text-[22px] font-black leading-none text-[#4f4639]">${item.count}</div>
                        </button>
                    `).join('')}
                </div>

                <div class="mt-4 rounded-2xl border border-white/70 bg-white/70 px-4 py-3">
                    <div class="text-[10px] font-black tracking-[0.18em] text-[#b9965b] uppercase">Next</div>
                    <div class="mt-1 text-sm font-black text-[#4f4639]">${nextStep?.title || '次に進める候補を育てよう'}</div>
                    <div class="mt-1 text-[11px] leading-relaxed text-[#8b7e66]">${nextStep?.detail || '読みや漢字を少しずつ集めるほど、ふたりの候補が見えやすくなります。'}</div>
                    <div class="mt-3 flex items-center gap-2">
                        <button type="button" onclick="runHomeAction('${overview.primaryAction}')" class="flex-1 rounded-full px-4 py-3 text-[12px] font-bold shadow-sm active:scale-95" style="${overview.tone.button}">
                            ${overview.primaryLabel}
                        </button>
                        <button type="button" onclick="${overview.secondaryAction}" class="shrink-0 rounded-full px-4 py-3 text-[11px] font-bold active:scale-95" style="${overview.tone.ghost}">
                            ${overview.secondaryLabel}
                        </button>
                    </div>
                </div>
            </div>
            <div class="mt-3 flex items-center justify-between px-1">
                <div>
                    <div class="text-[10px] font-black tracking-[0.18em] text-[#b9965b] uppercase">Progress</div>
                    <div class="mt-1 text-sm font-bold text-[#4f4639]">いまどの段階か</div>
                </div>

            </div>
        `;
    }

    renderHomeStageTrack(
        stageSnapshot.likedCount,
        stageSnapshot.readingStockCount,
        stageSnapshot.savedCount,
        stageSnapshot
    );
}

function getHomeNextStagePreviewHtml(stageKey) {
    if (stageKey === 'kanji') {
        return `
            <div class="wiz-mini-preview" aria-hidden="true">
                <div class="wiz-mini-card wiz-mini-card-back" style="background:#E8F5E9;">環</div>
                <div class="wiz-mini-card wiz-mini-card-center" style="background:#FFFDE7;">歓</div>
                <div class="wiz-mini-card wiz-mini-card-front" style="background:#FFEBEE;">漢</div>
            </div>
        `;
    }

    if (stageKey === 'build') {
        return getHomeBuildStagePreviewHtml();
        return `
            <div class="wiz-mini-preview" aria-hidden="true">
                <div class="wiz-mini-card wiz-mini-card-back" style="background:#FFF8EF; flex-direction:column; gap:2px;">
                    <span style="font-size:7px; font-weight:700;">ひびき</span>
                    <span style="font-size:13px;">漢歓</span>
                </div>
                <div class="wiz-mini-card wiz-mini-card-center" style="background:#FFFDF4; flex-direction:column; gap:2px;">
                    <span style="font-size:7px; font-weight:700;">ひびき</span>
                    <span style="font-size:13px;">漢環</span>
                </div>
                <div class="wiz-mini-card wiz-mini-card-front" style="background:#FFF7F8; flex-direction:column; gap:2px;">
                    <span style="font-size:7px; font-weight:700;">ひびき</span>
                    <span style="font-size:13px;">歓漢</span>
                </div>
            </div>
        `;
    }

    if (stageKey === 'save') {
        return getHomeSaveStagePreviewHtml();
        return `
            <div class="wiz-mini-preview" aria-hidden="true">
                <div class="wiz-mini-card wiz-mini-card-back" style="background:#FFF8EF; flex-direction:column; gap:2px;">
                    <span style="font-size:10px;">◎</span>
                    <span style="font-size:12px;">漢歓</span>
                </div>
                <div class="wiz-mini-card wiz-mini-card-center" style="background:#FFFDF4; flex-direction:column; gap:2px;">
                    <span style="font-size:10px;">○</span>
                    <span style="font-size:12px;">漢環</span>
                </div>
                <div class="wiz-mini-card wiz-mini-card-front" style="background:#FFF7F8; flex-direction:column; gap:2px;">
                    <span style="font-size:10px;">☆</span>
                    <span style="font-size:12px;">歓漢</span>
                </div>
            </div>
        `;
    }

    return `
        <div class="wiz-mini-preview" aria-hidden="true">
            <div class="wiz-mini-card wiz-mini-card-back" style="background:linear-gradient(145deg,#fdf7ef,#f0e0c4); font-size:10px;">ひ</div>
            <div class="wiz-mini-card wiz-mini-card-center" style="background:linear-gradient(145deg,#fdf7ef,#f0e0c4); font-size:10px;">び</div>
            <div class="wiz-mini-card wiz-mini-card-front" style="background:linear-gradient(145deg,#fdf7ef,#f0e0c4); font-size:10px;">き</div>
        </div>
    `;
}

function formatHomeStatusBodyText(text) {
    return String(text ?? '')
        .trim()
        .replace(/\s+/g, ' ')
        .replace(/。/g, '。\n')
        .trimEnd();
}

function getHomeBuildStagePreviewHtml() {
    return `
        <div class="wiz-mini-preview home-stage-preview-build" aria-hidden="true">
            <div class="home-stage-build-stack">
                <div class="home-stage-build-tile home-stage-build-tile--one">春</div>
                <div class="home-stage-build-tile home-stage-build-tile--two">陽</div>
                <div class="home-stage-build-tile home-stage-build-tile--three">斗</div>
                <div class="home-stage-build-tile home-stage-build-tile--four">翔</div>
            </div>
            <div class="home-stage-build-connector" aria-hidden="true">
                <span class="home-stage-build-connector-line"></span>
                <span class="home-stage-build-connector-arrow">→</span>
            </div>
            <div class="home-stage-build-result">
                <div class="home-stage-build-result-name">陽斗</div>
            </div>
        </div>
    `;
}

function getHomeSaveStagePreviewHtml() {
    return `
        <div class="wiz-mini-preview home-stage-preview-save" aria-hidden="true">
            <div class="home-stage-save-frame">
                <div class="home-stage-save-header">
                    <span>保存済み</span>
                </div>
                <div class="home-stage-save-list">
                    <div class="home-stage-save-row">
                        <span class="home-stage-save-row-name">陽斗</span>
                    </div>
                    <div class="home-stage-save-row">
                        <span class="home-stage-save-row-name">蓮</span>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function getHomeNextStageCardConfig(nextStep, readingStockCount) {
    const fallbackAction = getHomeSearchChoiceRecommended(readingStockCount) === 'reading' ? 'reading' : 'sound';
    const action = nextStep?.action || fallbackAction;
    const stageKey = action === 'sound' ? 'reading' : (getHomeRecommendedStageKey(action) || 'reading');
    const config = {
        action,
        stageKey,
        title: nextStep?.actionLabel || '次へ進む',
        detailHtml: (nextStep?.detail || '').replace(/\n/g, '<br>'),
        previewHtml: getHomeNextStagePreviewHtml(stageKey),
        variant: 'card',
        icon: '',
        alternateAction: '',
        alternateLabel: ''
    };

    switch (action) {
    case 'sound':
        config.title = '響きをさがす';
        config.detailHtml = '好きな響きから<br>読み候補を探します';
        config.alternateAction = 'reading';
        config.alternateLabel = '漢字をさがす';
        break;
    case 'reading':
        config.title = '漢字をさがす';
        config.detailHtml = '希望の読みから<br>合う漢字を探します';
        config.alternateAction = 'sound';
        config.alternateLabel = '響きをさがす';
        break;
    case 'stock-reading':
        config.title = '読み候補を見る';
        config.detailHtml = '集めた読みから<br>次の候補をえらびます';
        break;
    case 'matched-reading':
        config.title = '一致した読みがある';
        config.detailHtml = 'ふたりで同じ読みから<br>次の候補を広げます';
        break;
    case 'partner-reading':
        config.title = '相手の読みを見る';
        config.detailHtml = '相手が集めた読みを<br>確認します';
        break;
    case 'stock':
        config.title = '漢字候補を見る';
        config.detailHtml = '集めた漢字から<br>組み合わせを広げます';
        break;
    case 'matched-liked':
        config.title = '一致した漢字がある';
        config.detailHtml = 'ふたりで同じ漢字から<br>名前候補を広げます';
        break;
    case 'partner-liked':
        config.title = '相手の漢字を見る';
        config.detailHtml = '相手が集めた漢字を<br>確認します';
        break;
    case 'build':
        config.title = '組み立てる';
        config.detailHtml = '集まった読みと漢字から<br>候補をつくります';
        break;
    case 'saved':
        config.title = '候補を見る';
        config.detailHtml = '候補を見返して<br>名前を絞り込みます';
        break;
    case 'matched-saved':
        config.title = '一致した候補がある';
        config.detailHtml = 'ふたりで同じ候補を<br>見比べられます';
        break;
    case 'partner-saved':
        config.title = '相手の保存済みを見る';
        config.detailHtml = '相手が保存した候補を<br>確認します';
        break;
    default:
        break;
    }

    if (action === 'sound') {
        config.title = '響きをさがす';
    }
    if (action === 'reading') {
        config.title = '漢字をさがす';
    }
    if (action === 'build') {
        config.variant = 'icon';
        config.icon = '⚒️';
    }
    if (action === 'saved' || action === 'matched-saved' || action === 'partner-saved') {
        config.variant = 'icon';
        config.icon = '💾';
    }

    return config;
}

function renderHomeNextStagePrimaryButton(cardConfig, options = {}) {
    const highlightStyle = String(options.highlightStyle || '').trim();
    if (cardConfig.variant === 'icon') {
        return `
            <button type="button" onclick="event.stopPropagation(); runHomeAction('${cardConfig.action}')" class="mt-3 flex w-full items-center justify-between gap-3 rounded-[20px] border border-[#eadfce] bg-white px-5 py-5 text-left active:scale-[0.98] transition-transform shadow-sm" style="${highlightStyle}">
                <div class="min-w-0 flex-1">
                    <span class="block text-[1.08rem] font-black leading-tight text-[#5d5444] md:text-[1.14rem]">${cardConfig.title}</span>
                    <span class="mt-2 block text-[12px] leading-[1.7] text-[#8b7e66] md:text-[13px]">${cardConfig.detailHtml}</span>
                </div>
                <span class="shrink-0 text-[30px] leading-none" aria-hidden="true">${cardConfig.icon || '⚒️'}</span>
            </button>
        `;
    }

    return `
        <button type="button" onclick="event.stopPropagation(); runHomeAction('${cardConfig.action}')" class="mt-3 wiz-gender-btn wiz-reading-choice w-full shadow-sm" style="${highlightStyle}">
            <div class="wiz-reading-choice-copy">
                <span class="block text-[1.12rem] font-black leading-tight text-[#5d5444] md:text-[1.18rem]">${cardConfig.title}</span>
                <span class="block mt-2 text-[12px] leading-[1.7] text-[#8b7e66] md:text-[13px]">${cardConfig.detailHtml}</span>
            </div>
            ${cardConfig.previewHtml}
        </button>
    `;
}

function renderHomeSecondaryActionButton(cardConfig, detailHtml) {
    if (!cardConfig) return '';
    return `
        <button type="button" onclick="event.stopPropagation(); runHomeAction('${cardConfig.action}')" class="flex w-full items-center justify-between gap-3 rounded-[20px] border border-[#eadfce] bg-white px-5 py-5 text-left shadow-sm active:scale-[0.98] transition-transform">
            <div class="min-w-0 flex-1">
                <span class="block text-[1rem] font-black leading-tight text-[#5d5444] md:text-[1.06rem]">${cardConfig.title}</span>
                <span class="mt-1 block text-[12px] leading-[1.7] text-[#8b7e66] md:text-[13px]">${detailHtml}</span>
            </div>
            <span class="shrink-0 text-[20px] leading-none text-[#b9965b]" aria-hidden="true">›</span>
        </button>
    `;
}

function renderHomeStageTrack(likedCount, readingStockCount, savedCount, options = {}) {
    const stageTrack = ensureHomeStageTrack();
    if (!stageTrack) return;

    const timeline = getHomeStageTrackTimeline(likedCount, readingStockCount, savedCount, options);
    const tone = getHomeStageTrackTone(options.mode);
    const pairing = getPairingHomeSummary();
    const savedCanvasState = typeof window !== 'undefined'
        && window.MeimayPartnerInsights
        && typeof window.MeimayPartnerInsights.getSavedNameCanvasState === 'function'
        ? window.MeimayPartnerInsights.getSavedNameCanvasState()
        : null;
    const hasPartnerLinked = !!pairing?.hasPartner;
    const savedStateLabel = savedCount > 0
        ? (hasPartnerLinked
            ? (savedCanvasState?.matched ? '（確定済）' : '（未確定）')
            : (savedCanvasState?.ownMain ? '（本命:選択済）' : '（本命:未選択）'))
        : '';
    const matchedReadingCount = Math.max(0, Number(pairing?.matchedReadingCount) || 0);
    const matchedKanjiCount = Math.max(0, Number(pairing?.matchedKanjiCount) || 0);
    const buildCount = Number.isFinite(Number(options.buildCount))
        ? Number(options.buildCount)
        : getHomeBuildPatternCount();
    const readingStock = Array.isArray(options.readingStock)
        ? options.readingStock
        : (typeof getReadingStock === 'function' ? getReadingStock() : []);
    const initialFocusKey = options.recommendedKey || timeline.activeKey;
    const focusKey = getHomeStageFocus(initialFocusKey);
    const focusCopy = getHomeStageFocusCopy(focusKey, likedCount, readingStockCount, savedCount, pairing, {
        buildCount,
        readingStock
    });
    const heroCard = document.getElementById('home-hero-card');
    const summaryPanel = document.getElementById('home-summary-panel');

    if (heroCard) {
        heroCard.removeAttribute('onclick');
        heroCard.removeAttribute('role');
        heroCard.removeAttribute('tabindex');
        heroCard.removeAttribute('onkeydown');
        heroCard.classList.remove('cursor-pointer', 'active:scale-[0.98]');
        heroCard.classList.add('cursor-default');
        heroCard.style.cssText = tone.panel;
    }
    if (summaryPanel) {
        summaryPanel.classList.remove('hidden');
        summaryPanel.style.cssText = 'background:transparent;border:none;';
    }

    const actionCardConfig = {
        action: focusCopy.primaryAction,
        title: focusCopy.primaryLabel,
        detailHtml: focusKey === 'reading'
            ? '好きな響きから<br>読み候補を探します'
            : focusKey === 'kanji'
                ? '希望の読みから<br>合う漢字を探します'
                : focusKey === 'build'
                    ? '集めた読みと漢字から<br>名前候補を作ります'
                    : '候補を見返して<br>名前を絞り込みます',
        previewHtml: getHomeNextStagePreviewHtml(focusKey === 'reading' ? 'reading' : focusKey),
        variant: 'card',
        icon: ''
    };
    const primaryCard = renderHomeNextStagePrimaryButton(actionCardConfig, {
        highlightStyle: focusKey === initialFocusKey ? tone.cardRecommended : ''
    });
    const secondaryDetailHtml = focusKey === 'reading'
        ? '今ある読みのストックを見返します'
        : focusKey === 'kanji'
            ? '今ある漢字のストックを見返します'
            : focusKey === 'build'
                ? 'いまの組み立て候補を見返します'
                : '保存した候補を見返します';
    const secondaryButton = focusCopy.secondaryAction
        ? renderHomeSecondaryActionButton({
            action: focusCopy.secondaryAction,
            title: focusCopy.secondaryLabel
        }, secondaryDetailHtml)
        : '';
    const displayedSteps = timeline.steps.map((step) => {
        const selected = step.key === focusKey;
        return {
            ...step,
            selected
        };
    });

    stageTrack.style.cssText = '';
    stageTrack.innerHTML = `
        <div class="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)] items-stretch gap-x-1 md:gap-x-1.5">
            ${displayedSteps.map((step, index) => {
                const cardStyle = step.selected
                    ? tone.cardRecommended
                    : step.done
                    ? tone.cardDone
                    : step.active
                        ? tone.cardActive
                        : tone.cardIdle;
                const badgeStyle = step.selected
                    ? tone.badgeRecommended
                    : step.done
                    ? tone.badgeDone
                    : step.active
                        ? tone.badgeActive
                        : tone.badgeIdle;
                return `
                <button
                    type="button"
                    data-home-stage-button="true"
                    onclick="event.stopPropagation(); selectHomeStageTab('${step.key}')"
                    aria-pressed="${step.selected ? 'true' : 'false'}"
                    class="mx-auto w-full max-w-[88px] min-h-[68px] rounded-[1.05rem] border px-0.5 py-0.5 text-center active:scale-[0.98] transition-transform md:max-w-[114px] md:min-h-[106px] md:rounded-[1.4rem] md:px-1 md:py-1.5"
                    style="${cardStyle}">
                    <div class="flex h-full flex-col items-center justify-start">
                        <div class="flex items-center justify-center gap-0.5 text-[8px] font-black leading-tight text-center md:gap-1 md:text-[10px]" style="color:${tone.text};">
                            <span class="inline-flex h-[17px] w-[17px] items-center justify-center rounded-full text-[10px] font-black leading-none md:h-5 md:w-5 md:text-[13px]" style="${badgeStyle}">${step.selected ? '●' : (step.done ? '✓' : '-')}</span>
                            <span>${step.label}</span>
                        </div>
                        <div class="mt-0.5 whitespace-nowrap text-[14px] font-black leading-none md:mt-1.5 md:text-[20px]" style="color:${tone.text};">
                            <span data-home-stage-count="${step.key}">${step.metric.countNumber}</span><span class="ml-0.5 text-[7px] md:ml-1 md:text-[11px]" style="color:${tone.sub};">${step.metric.countUnit}</span>
                            ${step.key === 'save' && savedStateLabel ? `<div class="mt-0.5 text-[8.5px] md:mt-1 md:text-[10px] font-bold" style="color:${tone.text};">${savedStateLabel}</div>` : ''}
                            ${step.key === 'reading' && matchedReadingCount > 0 ? `<div class="mt-0.5 text-[8.5px] md:mt-1 md:text-[10px] font-bold" style="color:${tone.text};">（一致:${matchedReadingCount}件）</div>` : ''}
                            ${step.key === 'kanji' && matchedKanjiCount > 0 ? `<div class="mt-0.5 text-[8.5px] md:mt-1 md:text-[10px] font-bold" style="color:${tone.text};">（一致:${matchedKanjiCount}字）</div>` : ''}
                        </div>
                        ${step.selected ? `<div class="mt-auto pt-1 text-[7px] font-black text-center whitespace-nowrap leading-none md:pt-2 md:text-[9px]" style="color:${tone.sub};">選択中</div>` : ''}
                    </div>
                </button>${index < timeline.steps.length - 1 ? `<div aria-hidden="true" class="flex items-center justify-center text-[10px] font-black leading-none md:text-[14px]" style="color:${tone.sub};">▶</div>` : ''}
            `;
            }).join('')}
        </div>
        <div class="mt-4 rounded-[24px] px-0 py-0" style="${tone.cardIdle}">
            <div class="rounded-[24px] px-5 py-5">
                <div class="text-[12px] font-black tracking-[0.18em] text-[#b9965b]">✨今の状況</div>
                <div class="mt-3 whitespace-pre-line text-[14px] font-normal leading-[1.8] text-[#4f4639] md:text-[15px]">${formatHomeStatusBodyText(focusCopy.mainText)}</div>
            </div>
        </div>
        <div class="mt-4 rounded-[24px] px-0 py-0" style="${tone.cardIdle}">
            <div class="rounded-[24px] px-5 py-5">
                <div class="text-[12px] font-black tracking-[0.18em] text-[#b9965b]">💡この段階でできること</div>
                <div class="mt-3">
                ${primaryCard}
                ${secondaryButton ? `<div class="mt-3">${secondaryButton}</div>` : ''}
                </div>
            </div>
        </div>
    `;

    Array.from(stageTrack.querySelectorAll('[data-home-stage-button]')).forEach((button, index) => {
        const badge = button.querySelector('span');
        if (!badge) return;
        const step = displayedSteps[index];
        badge.textContent = step?.selected ? '●' : (step?.done ? '✓' : '-');
    });
}

function getHomeStagePanelCopy(stageKey, likedCount, readingStockCount, savedCount, pairing, options = {}) {
    const buildCount = Number.isFinite(Number(options.buildCount))
        ? Number(options.buildCount)
        : getHomeBuildPatternCount();
    const matchedReadingCount = Number.isFinite(Number(pairing?.matchedReadingCount))
        ? Number(pairing.matchedReadingCount)
        : 0;
    const matchedSavedCount = Number.isFinite(Number(pairing?.matchedNameCount))
        ? Number(pairing.matchedNameCount)
        : 0;
    const unresolvedReadingCount = Number.isFinite(Number(options.unresolvedReadingCount))
        ? Number(options.unresolvedReadingCount)
        : getHomeUnresolvedReadingCount(options.readingStock);

    const copy = {
        mainText: '',
        statusLines: [],
        chips: [],
        primaryAction: 'sound',
        primaryLabel: '響きをさがす',
        secondaryAction: '',
        secondaryLabel: ''
    };

    if (stageKey === 'reading') {
        copy.primaryAction = 'sound';
        copy.primaryLabel = '響きをさがす';
        if (readingStockCount > 0) {
            copy.secondaryAction = 'stock-reading';
            copy.secondaryLabel = 'ストックした読みを見る';
        }
        if (readingStockCount === 0) {
            copy.statusLines = [
                'まだ読み候補はありません。',
                'まずは響きから、気になる読みを探していきましょう。'
            ];
        } else if (readingStockCount <= 3) {
            copy.statusLines = [
                `読み候補を ${readingStockCount}件 ストックしています。`,
                '今ある候補を見返しながら、さらに読みを広げられます。'
            ];
        } else if (readingStockCount <= 9) {
            copy.statusLines = [
                '読み候補が集まってきています。',
                '見比べながら、さらに方向を広げられます。'
            ];
        } else {
            copy.statusLines = [
                '読み候補はしっかり集まっています。',
                '今ある候補を見返しながら、さらに読みを探すこともできます。'
            ];
        }
        copy.chips = [
            { label: '読み', value: readingStockCount, unit: '件' }
        ];
        if (matchedReadingCount > 0) {
            copy.chips.push({ label: '読み一致', value: matchedReadingCount, unit: '件' });
        }
        copy.mainText = copy.statusLines.join('\n');
        return copy;
    }

    if (stageKey === 'kanji') {
        copy.primaryAction = 'reading';
        copy.primaryLabel = '漢字をさがす';
        if (likedCount > 0) {
            copy.secondaryAction = 'stock';
            copy.secondaryLabel = 'ストックした漢字を見る';
        }
        if (likedCount === 0) {
            copy.statusLines = [
                'まだ漢字候補はありません。',
                '気になる読みに合う漢字を集めていきましょう。'
            ];
        } else if (likedCount <= 4) {
            copy.statusLines = [
                '漢字候補を集め始めています。',
                '読みに合う漢字を増やしながら、候補を広げられます。'
            ];
        } else if (likedCount <= 14) {
            if (unresolvedReadingCount > 0) {
                copy.statusLines = [
                    '漢字候補が集まってきています。',
                    'まだ漢字を選んでいない読みから進めるのがおすすめです。'
                ];
            } else {
                copy.statusLines = [
                    '漢字候補が集まってきています。',
                    '集めた漢字を見返しながら、さらに候補を広げられます。'
                ];
            }
        } else if (unresolvedReadingCount > 0) {
            copy.statusLines = [
                '漢字候補はしっかり集まっています。',
                'まだ漢字を選んでいない読みがあれば、そこから候補を広げられます。'
            ];
        } else {
            copy.statusLines = [
                '漢字候補はしっかり集まっています。',
                '今ある候補を見返しながら、組み立てに進めます。'
            ];
        }
        copy.chips = [
            { label: '漢字', value: likedCount, unit: '字' }
        ];
        if (unresolvedReadingCount > 0) {
            copy.chips.push({ label: '未選択', value: unresolvedReadingCount, unit: '件' });
        }
        if (matchedReadingCount > 0) {
            copy.chips.push({ label: '読み一致', value: matchedReadingCount, unit: '件' });
        }
        copy.mainText = copy.statusLines.join('\n');
        return copy;
    }

    if (stageKey === 'build') {
        copy.primaryAction = 'build';
        copy.primaryLabel = '組み立てる';
        if (buildCount === 0) {
            copy.statusLines = [
                'まだ名前は組み立てていません。',
                '集めた読みと漢字から、候補を作り始められます。'
            ];
        } else if (buildCount <= 2) {
            copy.statusLines = [
                '組み立てを始めています。',
                '今ある組み合わせを見ながら、さらに候補を広げられます。'
            ];
        } else if (buildCount <= 5) {
            copy.statusLines = [
                '候補ができてきています。',
                '比較しながら、気になる組み合わせをさらに試せます。'
            ];
        } else {
            copy.statusLines = [
                '組み立て候補はしっかりできています。',
                '今ある候補を見比べながら、方向性を整えられます。'
            ];
        }
        copy.chips = [
            { label: '読み', value: readingStockCount, unit: '件' },
            { label: '漢字', value: likedCount, unit: '字' },
            { label: 'ビルド', value: buildCount, unit: '通り' }
        ];
        if (buildCount > 0 && matchedReadingCount > 0) {
            copy.chips.push({ label: '読み一致', value: matchedReadingCount, unit: '件' });
        }
        copy.mainText = copy.statusLines.join('\n');
        return copy;
    }

    copy.primaryAction = 'saved';
    copy.primaryLabel = '候補を見る';
    copy.chips = [
        { label: '保存', value: savedCount, unit: '件' }
    ];
    if (savedCount === 0) {
        copy.statusLines = [
            'まだ保存した名前はありません。',
            '組み立てた候補の中から、残したい名前を選んでいきましょう。'
        ];
    } else if (matchedSavedCount > 0) {
        if (savedCount === 1) {
            copy.statusLines = [
                '保存した候補の中に、ふたりで一致した名前があります。',
                'この候補を基準にしながら、方向性を固めていけます。'
            ];
        } else if (savedCount <= 3) {
            copy.statusLines = [
                '保存した候補が集まってきています。',
                'ふたりで一致した候補も見比べながら、方向性を絞れます。'
            ];
        } else {
            copy.statusLines = [
                '保存した候補はしっかり集まっています。',
                'ふたりで一致した候補を軸に、残したい名前を整理できます。'
            ];
        }
    } else if (savedCount === 1) {
        copy.statusLines = [
            '保存した候補ができています。',
            'この候補を基準にしながら、さらに見比べていけます。'
        ];
    } else if (savedCount <= 3) {
        copy.statusLines = [
            '保存した候補が集まってきています。',
            '見比べながら、方向性を絞り込んでいけます。'
        ];
    } else {
        copy.statusLines = [
            '保存した候補はしっかり集まっています。',
            '今ある候補を見比べながら、残したい名前を整理できます。'
        ];
    }
    if (matchedSavedCount > 0) {
        copy.chips.push({ label: '候補一致', value: matchedSavedCount, unit: '件' });
    }
    copy.mainText = copy.statusLines.join('\n');
    return copy;
}

function renderHomeStageTrackLegacy(likedCount, readingStockCount, savedCount, options = {}) {
    const stageTrack = ensureHomeStageTrack();
    if (!stageTrack) return;

    const timeline = getHomeStageTrackTimeline(likedCount, readingStockCount, savedCount, options);
    const tone = getHomeStageTrackTone(options.mode);
    const pairing = getPairingHomeSummary();
    const buildCount = Number.isFinite(Number(options.buildCount))
        ? Number(options.buildCount)
        : getHomeBuildPatternCount();
    const readingStock = Array.isArray(options.readingStock)
        ? options.readingStock
        : (typeof getReadingStock === 'function' ? getReadingStock() : []);
    const initialFocusKey = options.recommendedKey || timeline.activeKey;
    const selectedTabKey = getHomeStageFocus(initialFocusKey);
    const focusCopy = getHomeStagePanelCopy(selectedTabKey, likedCount, readingStockCount, savedCount, pairing, {
        buildCount,
        readingStock
    });
    const heroCard = document.getElementById('home-hero-card');
    const summaryPanel = document.getElementById('home-summary-panel');
    const statusLine = document.getElementById('home-status-line');

    if (heroCard) {
        heroCard.removeAttribute('onclick');
        heroCard.removeAttribute('role');
        heroCard.removeAttribute('tabindex');
        heroCard.removeAttribute('onkeydown');
        heroCard.classList.remove('cursor-pointer', 'active:scale-[0.98]');
        heroCard.classList.add('cursor-default');
        heroCard.style.cssText = tone.panel;
    }
    if (summaryPanel) {
        summaryPanel.classList.remove('hidden');
        summaryPanel.style.cssText = 'background:transparent;border:none;';
    }
    if (statusLine) statusLine.classList.add('hidden');

    const displayedSteps = timeline.steps.map((step) => {
        const selected = step.key === selectedTabKey;
        return {
            ...step,
            selected,
            metric: {
                ...step.metric,
                actionText: selected ? '選択中' : ''
            }
        };
    });

    const actionCardConfig = {
        action: focusCopy.primaryAction,
        title: focusCopy.primaryLabel,
        detailHtml: selectedTabKey === 'reading'
            ? '好きな響きから<br>読み候補を探します'
            : selectedTabKey === 'kanji'
                ? '希望の読みから<br>合う漢字を探します'
                : selectedTabKey === 'build'
                    ? '集めた読みと漢字から<br>名前候補を作ります'
                    : '候補を見返して<br>名前を絞り込みます',
        previewHtml: getHomeNextStagePreviewHtml(selectedTabKey === 'reading' ? 'reading' : selectedTabKey),
        variant: 'card',
        icon: ''
    };
    const primaryCard = renderHomeNextStagePrimaryButton(actionCardConfig, {
        highlightStyle: selectedTabKey === initialFocusKey ? tone.cardRecommended : ''
    });
    const secondaryButton = focusCopy.secondaryAction
        ? `<button type="button" onclick="event.stopPropagation(); runHomeAction('${focusCopy.secondaryAction}')" class="w-full rounded-[18px] border border-[#eadfce] bg-white px-4 py-3 text-[11px] font-bold text-[#8b7e66] active:scale-[0.98] transition-transform">${focusCopy.secondaryLabel}</button>`
        : '';

    stageTrack.style.cssText = '';
    stageTrack.innerHTML = `
        <div class="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)] items-stretch gap-x-1 md:gap-x-1.5">
            ${displayedSteps.map((step, index) => {
                const cardStyle = step.selected
                    ? tone.cardRecommended
                    : tone.cardIdle;
                const badgeStyle = step.selected
                    ? tone.badgeRecommended
                    : step.done
                    ? tone.badgeDone
                    : tone.badgeIdle;
                return `
                <button
                    type="button"
                    data-home-stage-button="true"
                    onclick="event.stopPropagation(); selectHomeStageTab('${step.key}')"
                    aria-pressed="${step.selected ? 'true' : 'false'}"
                    class="min-h-[74px] rounded-[1.2rem] border px-1 py-1 text-center active:scale-[0.98] transition-transform md:min-h-[122px] md:rounded-[1.7rem] md:px-1.5 md:py-2.5"
                    style="${cardStyle}">
                    <div class="flex h-full flex-col items-center justify-start">
                        <div class="flex items-center justify-center gap-1 text-[8px] font-black leading-tight text-center md:gap-1.5 md:text-[11px]" style="color:${tone.text};">
                            <span class="inline-flex h-[18px] w-[18px] items-center justify-center rounded-full text-[11px] font-black leading-none md:h-6 md:w-6 md:text-[15px]" style="${badgeStyle}">${step.selected ? '●' : (step.done ? '✓' : '－')}</span>
                            <span>${step.label}</span>
                        </div>
                        <div class="mt-1 whitespace-nowrap text-[15px] font-black leading-none md:mt-2 md:text-[22px]" style="color:${tone.text};">
                            <span data-home-stage-count="${step.key}">${step.metric.countNumber}</span><span class="ml-0.5 text-[8px] md:ml-1 md:text-[13px]" style="color:${tone.sub};">${step.metric.countUnit}</span>
                        </div>
                        <div class="mt-auto pt-2 text-[7px] font-black text-center whitespace-nowrap leading-none md:pt-3 md:text-[10px]" style="color:${tone.sub};">${step.metric.actionText}</div>
                    </div>
                </button>${index < timeline.steps.length - 1 ? `<div aria-hidden="true" class="flex items-center justify-center text-[10px] font-black leading-none md:text-[14px]" style="color:${tone.sub};">▶</div>` : ''}
            `;
            }).join('')}
        </div>
        <div class="mt-4 rounded-[24px] border border-[#eadfce] bg-white/74 px-3 py-3">
            <div class="text-[10px] font-medium tracking-[0.18em] text-[#b9965b]">✨今の状況</div>
            <div class="mt-3 rounded-[24px] border border-[#eee5d8] bg-white px-4 py-4 shadow-sm">
                <div class="mt-2 whitespace-pre-line text-[12px] font-normal leading-relaxed text-[#4f4639]">${focusCopy.statusLines.join('\n')}</div>
                <div class="mt-3 flex flex-wrap gap-2">
                    ${focusCopy.chips.map((chip) => `
                        <span class="inline-flex items-center gap-1 rounded-full border border-[#eadfce] bg-[#fffaf5] px-3 py-1 text-[11px] font-bold text-[#5d5444]">
                            <span class="text-[#b9965b]">${chip.label}</span>
                            <span>${chip.value}${chip.unit}</span>
                        </span>
                    `).join('')}
                </div>
            </div>
        </div>
        <div class="mt-4 rounded-[24px] border border-[#eadfce] bg-white/74 px-3 py-3">
            <div class="text-[10px] font-black tracking-[0.18em] text-[#b9965b] uppercase">💡この段階でできること</div>
            <div class="mt-3 rounded-[24px] border border-[#eee5d8] bg-white px-4 py-4 shadow-sm">
                ${primaryCard}
                ${secondaryButton ? `<div class="mt-3">${secondaryButton}</div>` : ''}
            </div>
        </div>
    `;
}

window.renderHomeProfile = renderHomeProfile;
window.selectHomeStageTab = selectHomeStageTab;
window.cycleHomeOverviewMode = cycleHomeOverviewMode;
window.setHomeOverviewMode = setHomeOverviewMode;

try {
    if (typeof renderHomeProfile === 'function') {
        renderHomeProfile();
    }
} catch (e) { }

function buildHomeStageStatusCopy(stageKey, likedCount, readingStockCount, savedCount, pairing, options = {}) {
    const readingCount = Math.max(0, Number(readingStockCount) || 0);
    const kanjiCount = Math.max(0, Number(likedCount) || 0);
    const savedTotal = Math.max(0, Number(savedCount) || 0);
    const buildCount = Number.isFinite(Number(options.buildCount))
        ? Math.max(0, Number(options.buildCount))
        : Math.max(0, Number(getHomeBuildPatternCount()) || 0);
    const unresolvedReadingCountRaw = Number.isFinite(Number(options.unresolvedReadingCount))
        ? Number(options.unresolvedReadingCount)
        : getHomeUnresolvedReadingCount(options.readingStock);
    const unresolvedReadingCount = readingCount === 0
        ? 0
        : Math.max(0, Math.min(readingCount, Number(unresolvedReadingCountRaw) || 0));
    const savedCanvasState = typeof window !== 'undefined'
        && window.MeimayPartnerInsights
        && typeof window.MeimayPartnerInsights.getSavedNameCanvasState === 'function'
        ? window.MeimayPartnerInsights.getSavedNameCanvasState()
        : null;

    const readingZeroLines = [
        'まだ読み候補はありません。',
        'まずは気になる響きから、読みを探していきましょう。'
    ];

    const copy = {
        stageLabel: '',
        mainText: '',
        statusLines: [],
        chips: [],
        primaryAction: 'sound',
        primaryLabel: '響きをさがす',
        secondaryAction: '',
        secondaryLabel: ''
    };

    const setCopy = (stageLabel, primaryAction, primaryLabel, statusLines, chips, secondaryAction = '', secondaryLabel = '') => {
        copy.stageLabel = stageLabel;
        copy.primaryAction = primaryAction;
        copy.primaryLabel = primaryLabel;
        copy.secondaryAction = secondaryAction;
        copy.secondaryLabel = secondaryLabel;
        copy.statusLines = statusLines;
        copy.chips = chips;
        copy.mainText = statusLines.join('');
        return copy;
    };

    if (stageKey === 'reading') {
        const statusLines = readingCount === 0
            ? readingZeroLines
            : readingCount <= 9
                ? [
                    '読み候補が集まってきています。',
                    '今ある候補を見返しながら、さらに読みを広げていきましょう。'
                ]
                : [
                    '読み候補はしっかり集まっています。',
                    '今ある候補を見返しながら、方向性を整えていきましょう。'
                ];

        return setCopy(
            '読み',
            'sound',
            '響きをさがす',
            statusLines,
            [
                { label: '読み', value: readingCount, unit: '件' }
            ],
            readingCount > 0 ? 'stock-reading' : '',
            'ストックした読みを見る'
        );
    }

    if (stageKey === 'kanji') {
        const statusLines = (() => {
            if (readingCount === 0 && kanjiCount === 0) {
                return readingZeroLines;
            }
            if (readingCount === 0 && kanjiCount > 0) {
                return [
                    'まだ読み候補はありません。',
                    '集めた漢字を活かすために、まずは読みを探していきましょう。'
                ];
            }
            if (readingCount > 0 && kanjiCount === 0 && unresolvedReadingCount > 0) {
                return [
                    'まだ漢字候補はありません。',
                    `漢字がまだ決まっていない読みが${unresolvedReadingCount}件あるので、そこから候補を広げていきましょう。`
                ];
            }
            if (readingCount > 0 && kanjiCount > 0 && unresolvedReadingCount > 0) {
                return [
                    '漢字候補が集まってきています。',
                    `漢字がまだ決まっていない読みが${unresolvedReadingCount}件あるので、そこから候補を広げていきましょう。`
                ];
            }
            if (readingCount > 0 && unresolvedReadingCount === 0 && kanjiCount > 0) {
                return [
                    '漢字候補はしっかり集まっています。',
                    '今ある候補を見返しながら、組み立てに進めます。'
                ];
            }
            if (readingCount > 0 && unresolvedReadingCount === 0 && kanjiCount === 0) {
                return [
                    'まだ漢字候補はありません。',
                    '気になる読みに合う漢字を集めていきましょう。'
                ];
            }
            return readingZeroLines;
        })();

        return setCopy(
            '漢字',
            'reading',
            '漢字をさがす',
            statusLines,
            [
                { label: '漢字', value: kanjiCount, unit: '字' },
                { label: '未選択', value: unresolvedReadingCount, unit: '件' }
            ],
            kanjiCount > 0 ? 'stock' : '',
            'ストックした漢字を見る'
        );
    }

    if (stageKey === 'build') {
        const statusLines = (() => {
            if (buildCount >= 6) {
                return [
                    '組み立て候補はしっかりできています。',
                    '今ある候補を見比べながら、方向性を整えていきましょう。'
                ];
            }
            if (buildCount >= 1) {
                return [
                    '候補ができてきています。',
                    '今ある組み合わせを見比べながら、さらに候補を広げていきましょう。'
                ];
            }
            if (readingCount > 0 && kanjiCount > 0) {
                return [
                    'まだ名前は組み立てていません。',
                    '集めた読みと漢字から、名前候補を作り始められます。'
                ];
            }
            if (readingCount > 0 && kanjiCount === 0) {
                return [
                    'まだ漢字候補はありません。',
                    '先に読みに合う漢字を集めてから、組み立てに進んでいきましょう。'
                ];
            }
            return readingZeroLines;
        })();

        return setCopy(
            'ビルド',
            'build',
            '組み立てる',
            statusLines,
            [
                { label: '読み', value: readingCount, unit: '件' },
                { label: '漢字', value: kanjiCount, unit: '字' },
                { label: 'ビルド', value: buildCount, unit: '通り' }
            ]
        );
    }

    const statusLines = (() => {
        if (savedCanvasState?.matched) {
            return [
                'ふたりの本命が一致しました。',
                '大切な名前が決まりました。'
            ];
        }
        if (savedTotal >= 4) {
            return [
                '保存した候補はしっかり集まっています。',
                '今ある候補を見返しながら、残したい名前を整理していきましょう。'
            ];
        }
        if (savedTotal >= 1) {
            return [
                '保存した候補が集まってきています。',
                '見比べながら、方向性を絞り込んでいきましょう。'
            ];
        }
        if (buildCount > 0) {
            return [
                'まだ保存した名前はありません。',
                '組み立てた候補の中から、残したい名前を選んでいきましょう。'
            ];
        }
        if (readingCount > 0 && kanjiCount > 0) {
            return [
                'まだ名前は組み立てていません。',
                'まずは候補を組み立ててから、保存する名前を選んでいきましょう。'
            ];
        }
        if (readingCount > 0 && kanjiCount === 0) {
            return [
                'まだ漢字候補はありません。',
                '先に読みに合う漢字を集めて、候補作りを進めていきましょう。'
            ];
        }
        return readingZeroLines;
    })();

    return setCopy(
        '保存',
        'saved',
        '候補を見る',
        statusLines,
        [
            { label: '保存', value: savedTotal, unit: '件' }
        ]
    );
}

function getHomeStageFocusCopy(stageKey, likedCount, readingStockCount, savedCount, pairing, options = {}) {
    return buildHomeStageStatusCopy(stageKey, likedCount, readingStockCount, savedCount, pairing, options);
}

function getHomeStagePanelCopy(stageKey, likedCount, readingStockCount, savedCount, pairing, options = {}) {
    return buildHomeStageStatusCopy(stageKey, likedCount, readingStockCount, savedCount, pairing, options);
}
