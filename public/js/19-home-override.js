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
        kanjiFocus: 'all'
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
        kanjiFocus: 'all'
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
            kanjiFocus: 'all'
        };
        return window.MeimayPartnerViewState;
    }

    const state = getMeimayPartnerViewState();
    keys.forEach((key) => {
        if (key === 'savedFocus' || key === 'readingFocus' || key === 'kanjiFocus') {
            state[key] = 'all';
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
    const candidatePool = Array.isArray(candidatePoolOverride)
        ? candidatePoolOverride
        : typeof getMergedLikedCandidates === 'function'
            ? getMergedLikedCandidates()
            : ((typeof liked !== 'undefined' && Array.isArray(liked))
                ? liked.filter(item => !item?.fromPartner)
                : []);
    const readingGroups = new Map();

    candidatePool.forEach((item) => {
        const sessionReading = String(item?.sessionReading || '');
        const slot = Number(item?.slot);
        if (!sessionReading || !Number.isFinite(slot) || slot < 0) return;
        if (['FREE', 'SEARCH', 'RANKING', 'SHARED', 'UNKNOWN'].includes(sessionReading)) return;

        const groupKey = `${sessionReading}::${Array.isArray(item?.sessionSegments) ? item.sessionSegments.join('/') : ''}`;
        if (!readingGroups.has(groupKey)) {
            readingGroups.set(groupKey, {
                slotCount: Array.isArray(item?.sessionSegments) && item.sessionSegments.length > 0
                    ? item.sessionSegments.length
                    : slot + 1,
                slots: new Map()
            });
        }

        const group = readingGroups.get(groupKey);
        group.slotCount = Math.max(group.slotCount, slot + 1);
        if (!group.slots.has(slot)) group.slots.set(slot, new Set());
        if (item?.['漢字']) group.slots.get(slot).add(item['漢字']);
    });

    let total = 0;
    readingGroups.forEach((group) => {
        let combinations = 1;
        for (let i = 0; i < group.slotCount; i += 1) {
            const count = group.slots.get(i)?.size || 0;
            if (!count) {
                combinations = 0;
                break;
            }
            combinations *= count;
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
            subtitle: '必要になったタイミングで始められます。',
            footnote: 'あとからいつでもルームを作れます。',
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
    const pairInsights = (typeof window.MeimayPartnerInsights !== 'undefined' && window.MeimayPartnerInsights)
        ? window.MeimayPartnerInsights
        : null;
    if (pairInsights?.getOwnReadingCollection) {
        return pairInsights.getOwnReadingCollection().length;
    }
    const readingStock = (typeof getReadingStock === 'function') ? getReadingStock() : [];
    return Array.isArray(readingStock) ? readingStock.length : 0;
}

function getHomeNextStep(likedCount, readingStockCount, savedCount, pairing) {
    const wizard = getWizardHomeState();

    if ((pairing?.matchedNameCount || 0) >= 1) {
        return {
            title: '一致した名前を見直す',
            detail: 'おふたりで一致した候補が見つかっています。',
            actionLabel: '一致した名前を見る',
            action: 'matched-saved'
        };
    }

    if ((pairing?.matchedReadingCount || 0) >= 1) {
        return {
            title: 'ふたりで重なった読みから進めよう',
            detail: '同じ読みが見つかったら、そこから漢字や組み合わせを育てるのが早いです。',
            actionLabel: '重なった読みを見る',
            action: 'matched-reading'
        };
    }

    if ((pairing?.matchedKanjiCount || 0) >= 1) {
        return {
            title: '一致した漢字を広げる',
            detail: '共通で気になった漢字から名前を組み立てられます。',
            actionLabel: '一致した漢字を見る',
            action: 'matched-liked'
        };
    }

    if (readingStockCount === 0 && wizard.hasReadingCandidate) {
        return {
            title: '読み候補があるので漢字を探せます',
            detail: '候補の読みを起点に、名前に使いたい漢字を集めます。',
            actionLabel: '読みから漢字を探す',
            action: 'reading'
        };
    }

    if (readingStockCount === 0) {
        return {
            title: '読み候補を集める',
            detail: 'まずは響きやイメージから、気になる読みを見つけましょう。',
            actionLabel: '響き・読みを探す',
            action: 'sound'
        };
    }

    if (likedCount < 2) {
        return {
            title: '漢字材料を集める',
            detail: '読み候補があるので、次は漢字を広げる段階です。',
            actionLabel: '読みから漢字を探す',
            action: 'reading'
        };
    }

    if (savedCount === 0) {
        return {
            title: '名前を組み立てる',
            detail: '集まった読みと漢字から、名前候補を保存していきましょう。',
            actionLabel: 'ビルドへ',
            action: 'build'
        };
    }

    return {
        title: '保存候補を見比べる',
        detail: '保存済みから第一候補を絞りやすい段階です。',
        actionLabel: '保存済みを見る',
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
        activeKey === 'save' ? '保存候補を見比べる段階です' :
        activeKey === 'build' ? '名前を組み立てる段階です' :
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
    stageTrack.className = 'rounded-[22px] px-2 py-2 md:px-2.5 md:py-2.5';

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

    if (!palette) {
        return {
            panel: 'border:1px solid #eee4d6;background:#fffaf6;',
            cardDone: 'border:1px solid #ecdcb7;background:#fff8ee;',
            cardActive: 'border:1px solid #eadfce;background:#fffaf6;',
            cardIdle: 'border:1px solid #eee5d8;background:#ffffff;',
            badgeDone: 'background:#b9965b;color:#fff;',
            badgeActive: 'background:#d8cfbe;color:#7f725d;',
            badgeIdle: 'background:#f0e8db;color:#8b7e66;',
            text: '#5d5444',
            sub: '#8b7e66'
        };
    }

    if (kind === 'matched') {
        return {
            panel: `border:1px solid transparent;background:${palette.surface} padding-box, linear-gradient(135deg, ${palette.border} 0%, ${palette.borderAlt} 100%) border-box;`,
            cardDone: `border:1px solid transparent;background:${palette.surface} padding-box, linear-gradient(135deg, ${palette.border} 0%, ${palette.borderAlt} 100%) border-box;`,
            cardActive: `border:1px solid transparent;background:${palette.surface} padding-box, linear-gradient(135deg, ${palette.border} 0%, ${palette.borderAlt} 100%) border-box;`,
            cardIdle: 'border:1px solid rgba(255,255,255,0.86);background:rgba(255,255,255,0.88);',
            badgeDone: `background:linear-gradient(135deg, ${pairPalettes.self.accentStrong} 0%, ${pairPalettes.partner.accentStrong} 100%);color:#fff;`,
            badgeActive: 'background:rgba(255,255,255,0.92);color:#7d6671;border:1px solid rgba(255,255,255,0.86);',
            badgeIdle: 'background:rgba(255,255,255,0.82);color:#846d78;',
            text: '#5d5444',
            sub: '#846d78'
        };
    }

    return {
        panel: `border:1px solid ${palette.border};background:${palette.surface};`,
        cardDone: `border:1px solid ${palette.border};background:${palette.surface};`,
        cardActive: `border:1px solid ${palette.accentStrong || palette.border};background:${palette.surface};`,
        cardIdle: `border:1px solid ${palette.border};background:rgba(255,255,255,0.9);`,
        badgeDone: `background:${palette.accentStrong || palette.accent};color:#fff;`,
        badgeActive: `background:${palette.accentSoft || palette.mist || '#fff7ef'};color:${palette.text || '#8b7e66'};`,
        badgeIdle: `background:rgba(255,255,255,0.86);color:${palette.text || '#8b7e66'};`,
        text: '#5d5444',
        sub: palette.text || '#8b7e66'
    };
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
        activeKey === 'save' ? '保存候補を見比べる段階です' :
        activeKey === 'build' ? '名前を組み立てる段階です' :
        activeKey === 'kanji' ? '漢字材料を集める段階です' :
        '読み候補を探す段階です';

    return {
        stageTitle,
        activeKey,
        steps: steps.map((step) => ({
            ...step,
            active: step.key === activeKey,
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
    stageTrack.style.cssText = tone.panel;
    stageTrack.innerHTML = `
        <div class="grid grid-cols-4 gap-1 md:gap-1.5">
            ${timeline.steps.map((step) => {
                const cardStyle = step.done
                    ? tone.cardDone
                    : step.active
                        ? tone.cardActive
                        : tone.cardIdle;
                const badgeStyle = step.done
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
                        <div class="mt-0.5 text-[7px] font-black text-center whitespace-nowrap leading-none md:mt-1 md:text-[10px]" style="color:${tone.sub};">${step.metric.actionText}</div>
                    </div>
                </button>
            `;
            }).join('')}
        </div>
    `;

    Array.from(stageTrack.querySelectorAll('button')).forEach((button, index) => {
        const badge = button.querySelector('span');
        if (!badge) return;
        badge.textContent = timeline.steps[index]?.done ? '✓' : '-';
    });
}

function closeHomePartnerHub() {
    document.getElementById('home-partner-hub-modal')?.remove();
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

    const savedList = (typeof getSavedNames === 'function') ? getSavedNames() : (window.savedNames || []);
    const likedCount = (typeof liked !== 'undefined' && Array.isArray(liked)) ? liked.length : 0;
    const readingStock = (typeof getReadingStock === 'function') ? getReadingStock() : [];
    const readingStockCount = getOwnHomeReadingCount();
    const savedCount = Array.isArray(savedList) ? savedList.length : 0;
    const buildPatternCount = getHomeBuildPatternCount();
    const pairing = getPairingHomeSummary();
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
    const partnerReadingCount = Number.isFinite(Number(counts?.partner?.reading ?? pairing?.partnerReadingCount))
        ? Number(counts?.partner?.reading ?? pairing?.partnerReadingCount)
        : 0;
    const partnerKanjiCount = Number.isFinite(Number(counts?.partner?.kanji ?? pairing?.partnerKanjiCount))
        ? Number(counts?.partner?.kanji ?? pairing?.partnerKanjiCount)
        : 0;
    const partnerSavedCount = Number.isFinite(Number(counts?.partner?.saved ?? pairing?.partnerSavedCount))
        ? Number(counts?.partner?.saved ?? pairing?.partnerSavedCount)
        : 0;

    return {
        readingStockCount: readingStockCount + partnerReadingCount,
        likedCount: likedCount + partnerKanjiCount,
        savedCount: savedCount + partnerSavedCount
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

function getHomeOverviewSwitchOptions(pairing) {
    if (!pairing?.hasPartner) {
        return [{ mode: 'self', label: 'マイ候補' }];
    }

    return [
        { mode: 'shared', label: 'ふたりの候補' },
        { mode: 'self', label: 'マイ候補' },
        { mode: 'partner', label: 'パートナー候補' }
    ];
}

function getHomeOverviewSwitchStyle(mode) {
    const kind = mode === 'shared' ? 'matched' : mode === 'partner' ? 'partner' : 'self';
    const palette = typeof window.getMeimayOwnershipPalette === 'function'
        ? window.getMeimayOwnershipPalette(kind)
        : null;
    if (!palette) {
        return {
            button: 'border:1px solid #eadfce;background:#fffaf5;',
            text: '#5d5444',
            sub: '#8b7e66'
        };
    }
    if (kind === 'matched') {
        return {
            button: `border:1px solid transparent;background:${palette.surface} padding-box, linear-gradient(135deg, ${palette.border} 0%, ${palette.borderAlt} 100%) border-box;`,
            text: '#5d5444',
            sub: '#846d78'
        };
    }
    return {
        button: `border:1px solid ${palette.border};background:${palette.surface};`,
        text: '#5d5444',
        sub: palette.text || '#8b7e66'
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
            class="w-full rounded-[1.05rem] px-2 py-2 text-center active:scale-95 transition-transform md:rounded-[1.2rem] md:px-2.5 md:py-2.5"
            style="${switchStyle.button}">
            <div class="text-[9px] font-black leading-tight md:text-[10px]" style="color:${switchStyle.text};">
                ${activeOption.label}
            </div>
            ${canCycle ? `
                <div class="mt-1 text-[7px] font-bold leading-tight md:text-[8px]" style="color:${switchStyle.sub};">
                    タップで切り替え
                </div>
            ` : ''}
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
    const partnerReadingCount = Number(counts?.partner?.reading ?? pairing?.partnerReadingCount ?? 0);
    const partnerKanjiCount = Number(counts?.partner?.kanji ?? pairing?.partnerKanjiCount ?? 0);
    const partnerSavedCount = Number(counts?.partner?.saved ?? pairing?.partnerSavedCount ?? 0);
    const ownReadingCount = Number(counts?.own?.reading ?? readingStockCount ?? 0);
    const ownKanjiCount = Number(counts?.own?.kanji ?? likedCount ?? 0);
    const ownSavedCount = Number(counts?.own?.saved ?? savedCount ?? 0);
    const aggregateBuildCount = getHomeBuildPatternCount();
    const partnerBuildCount = getHomeBuildPatternCount(partnerLikedItems);
    const ownBuildCount = getHomeBuildPatternCount(ownLikedItems);

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
    const likedCount = (typeof liked !== 'undefined' && liked) ? liked.length : 0;
    const savedList = (typeof getSavedNames === 'function') ? getSavedNames() : (window.savedNames || []);
    const savedCount = savedList.length;
    const readingStockCount = getOwnHomeReadingCount();
    const preference = typeof getHomePreferenceSummary === 'function' ? getHomePreferenceSummary(liked) : { shortText: 'まだ傾向なし' };
    const pairing = getPairingHomeSummary();
    const nextStep = getHomeNextStep(likedCount, readingStockCount, savedCount, pairing);
    const recommendedEntry = getHomeRecommendedEntry(readingStockCount, likedCount, savedCount);
    const stageSnapshot = getHomeOverviewStageSnapshot(likedCount, readingStockCount, savedCount, pairing);

    const screen = document.getElementById('scr-mode');
    if (screen) {
        screen.style.paddingLeft = '12px';
        screen.style.paddingRight = '12px';
    }

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
        nextStepActionLabelEl.innerText = nextStep.actionLabel;
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


    const elPrefSummary = document.getElementById('home-preference-summary');
    if (elPrefSummary) elPrefSummary.innerText = preference.shortText || 'まだ傾向なし';
    const partnerInlineTitle = document.getElementById('home-partner-inline-title');
    if (partnerInlineTitle) {
        let title = 'パートナー：未連携';
        if (pairing.hasPartner) {
            title = `パートナー：${pairing.partnerCallName || pairing.partnerDisplayName || 'パートナー'}と連携中`;
        }
        partnerInlineTitle.innerText = title;
    }

    const soundBadge = document.getElementById('home-entry-sound-badge');
    if (soundBadge) soundBadge.classList.add('hidden');

    const readingBadge = document.getElementById('home-entry-reading-badge');
    if (readingBadge) readingBadge.classList.add('hidden');

    const soundEntry = document.getElementById('home-entry-sound');
    if (soundEntry) {
        soundEntry.style.boxShadow = '';
        soundEntry.style.borderWidth = recommendedEntry === 'sound' ? '3px' : '2px';
        soundEntry.style.borderColor = recommendedEntry === 'sound' ? '#b9965b' : '#c4caf2';
    }

    const readingEntry = document.getElementById('home-entry-reading');
    if (readingEntry) {
        readingEntry.style.boxShadow = '';
        readingEntry.style.borderWidth = recommendedEntry === 'reading' ? '3px' : '2px';
        readingEntry.style.borderColor = recommendedEntry === 'reading' ? '#b9965b' : '#c4caf2';
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
    const defaultMode = pairing?.hasPartner ? 'shared' : 'self';
    const allowed = pairing?.hasPartner ? ['shared', 'self', 'partner'] : ['self'];
    if (!allowed.includes(window.MeimayHomeOverviewMode)) {
        window.MeimayHomeOverviewMode = defaultMode;
    }
    return window.MeimayHomeOverviewMode;
}

function setHomeOverviewMode(mode) {
    window.MeimayHomeOverviewMode = mode;
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
        const total = (pairing?.matchedTotalCount ?? 0);
        return {
            mode,
            tone,
            total,
            unit: '件',
            eyebrow: 'ふたりの一致',
            title: total > 0 ? `いま、ふたりで重なっている候補 ${total}件` : 'まだ一致はこれからです',
            description: total > 0
                ? `${pairing?.partnerCallName || pairing?.partnerDisplayName || 'パートナー'}と重なった候補から、次の絞り込みに進めます。`
                : `${pairing?.partnerCallName || pairing?.partnerDisplayName || 'パートナー'}と候補を集めるほど、一致が育っていきます。`,
            breakdown: [
                { label: '読み', count: counts.matched.reading || 0, action: (counts.matched.reading || 0) > 0 ? 'matched-reading' : 'reading' },
                { label: '漢字', count: counts.matched.kanji || 0, action: (counts.matched.kanji || 0) > 0 ? 'matched-liked' : 'stock' },
                { label: '保存', count: counts.matched.saved || 0, action: (counts.matched.saved || 0) > 0 ? 'matched-saved' : 'saved' }
            ],
            primaryAction: nextStep?.action || 'matched-reading',
            primaryLabel: nextStep?.actionLabel || '次に進む',
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
    const likedCount = (typeof liked !== 'undefined' && liked) ? liked.length : 0;
    const savedList = (typeof getSavedNames === 'function') ? getSavedNames() : (window.savedNames || []);
    const savedCount = savedList.length;
    const readingStockCount = getOwnHomeReadingCount();
    const pairing = getPairingHomeSummary();
    const nextStep = getHomeNextStep(likedCount, readingStockCount, savedCount, pairing);
    const stageSnapshot = getHomeOverviewStageSnapshot(likedCount, readingStockCount, savedCount, pairing);
    const mount = document.getElementById('home-overview-mount');
    const heroCard = document.getElementById('home-hero-card');
    const statusLineEl = document.getElementById('home-status-line');
    const legacyActions = document.getElementById('home-legacy-actions');
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
    }

    if (statusLineEl) statusLineEl.classList.add('hidden');
    if (legacyActions) legacyActions.classList.add('hidden');
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
                <button type="button" onclick="openHomeInsightsModalFromEvent(event)" class="rounded-full px-3 py-2 text-[11px] font-bold active:scale-95" style="${overview.tone.ghost}">
                    進み具合を見る
                </button>
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

window.renderHomeProfile = renderHomeProfile;
window.cycleHomeOverviewMode = cycleHomeOverviewMode;
window.setHomeOverviewMode = setHomeOverviewMode;

try {
    if (typeof renderHomeProfile === 'function') {
        renderHomeProfile();
    }
} catch (e) { }
