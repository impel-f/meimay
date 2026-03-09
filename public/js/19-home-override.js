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
            actionLabel: '連携する',
            canOpenHub: false
        };
    }

    const totalMatches = summary.matchedKanjiCount + summary.matchedNameCount;
    if (totalMatches > 0) {
        const previewText = summary.previewLabels && summary.previewLabels.length > 0
            ? summary.previewLabels.slice(0, 3).join(' ・ ')
            : '一致候補を確認できます。';
        return {
            ...summary,
            shortText: summary.partnerCallName,
            title: `${summary.partnerCallName}と連携中です`,
            subtitle: previewText,
            footnote: 'タップで相手の候補や一致一覧を見られます。',
            actionLabel: '',
            canOpenHub: true
        };
    }

    return {
        ...summary,
        shortText: summary.partnerCallName,
        title: `${summary.partnerCallName}と連携中です`,
        subtitle: '相手の候補が自動で届きます。',
        footnote: 'タップで相手の候補や一致一覧を見られます。',
        actionLabel: '',
        canOpenHub: true
    };
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
    const steps = [
        {
            key: 'reading',
            label: '読みをためる',
            done: readingStockCount >= 1,
            status: readingStockCount >= 1 ? '候補あり' : 'これから'
        },
        {
            key: 'kanji',
            label: '漢字をためる',
            done: likedCount >= 2,
            status: likedCount >= 2 ? '進行中' : '次の段階'
        },
        {
            key: 'build',
            label: 'ビルドする',
            done: savedCount >= 1,
            status: savedCount >= 1 ? '候補あり' : '準備中'
        },
        {
            key: 'save',
            label: '保存して比べる',
            done: savedCount >= 2,
            status: savedCount >= 2 ? '比較OK' : 'これから'
        }
    ];

    const activeKey =
        savedCount >= 1 ? 'save' :
        likedCount >= 2 ? 'build' :
        readingStockCount >= 1 ? 'kanji' :
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
            active: step.key === activeKey
        }))
    };
}

function ensureHomeStageTrack() {
    const countGrid = document.getElementById('home-liked-kanji-count')?.closest('.grid');
    const parent = countGrid?.parentElement;
    if (!countGrid || !parent) return null;

    let stageTrack = document.getElementById('home-stage-track');
    if (!stageTrack) {
        stageTrack = document.createElement('div');
        stageTrack.id = 'home-stage-track';
        stageTrack.className = 'mt-4 rounded-2xl border border-[#eee4d6] bg-[#fffaf5] px-3 py-3';
        parent.insertBefore(stageTrack, countGrid);
    }

    return stageTrack;
}

function renderHomeStageTrack(likedCount, readingStockCount, savedCount) {
    const stageTrack = ensureHomeStageTrack();
    if (!stageTrack) return;

    const timeline = getNamingMaterialTimeline(likedCount, readingStockCount, savedCount);
    stageTrack.innerHTML = `
        <div class="grid grid-cols-4 gap-2">
            ${timeline.steps.map((step) => `
                <div class="rounded-2xl px-2.5 py-2 ${step.done
                    ? 'bg-[#fff4df] border border-[#ecd5ac]'
                    : step.active
                        ? 'bg-[#f7f3ff] border border-[#d8c9ef]'
                        : 'bg-white border border-[#eee5d8]'}">
                    <div class="flex items-center gap-1.5">
                        <span class="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full text-[10px] font-black ${step.done
                            ? 'bg-[#b9965b] text-white'
                            : step.active
                                ? 'bg-[#b7a6da] text-white'
                                : 'bg-[#f0e8db] text-[#8b7e66]'}">${step.done ? '✓' : '•'}</span>
                        <span class="text-[9px] font-black leading-tight text-[#5d5444]">${step.label}</span>
                    </div>
                    <div class="mt-2 text-[9px] font-bold text-[#8b7e66]">${step.status}</div>
                </div>
            `).join('')}
        </div>
    `;
}

function closeHomePartnerHub() {
    document.getElementById('home-partner-hub-modal')?.remove();
}

function runHomeAction(action) {
    if (action === 'saved' && typeof openSavedNames === 'function') {
        openSavedNames();
        return;
    }

    if (action === 'matched-saved') {
        openSavedNamesWithPartnerFocus('matched');
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

function renderHomeProfile() {
    const likedCount = (typeof liked !== 'undefined' && liked) ? liked.length : 0;
    const savedList = (typeof getSavedNames === 'function') ? getSavedNames() : (window.savedNames || []);
    const savedCount = savedList.length;
    const readingStock = (typeof getReadingStock === 'function') ? getReadingStock() : [];
    const readingStockCount = readingStock.length;
    const preference = typeof getHomePreferenceSummary === 'function' ? getHomePreferenceSummary(liked) : { shortText: 'まだ傾向なし' };
    const pairing = getPairingHomeSummary();
    const nextStep = getHomeNextStep(likedCount, readingStockCount, savedCount, pairing);
    const timeline = getNamingMaterialTimeline(likedCount, readingStockCount, savedCount);
    const recommendedEntry = getHomeRecommendedEntry(readingStockCount, likedCount, savedCount);
    const showPairCard = !canDismissHomePairCard(pairing) || !isHomePairCardDismissed();

    const screen = document.getElementById('scr-mode');
    if (screen) {
        screen.style.paddingLeft = '10px';
        screen.style.paddingRight = '10px';
    }

    renderHomeStageTrack(likedCount, readingStockCount, savedCount);

    const elSaved = document.getElementById('home-liked-name-count');
    if (elSaved) elSaved.innerText = savedCount;

    const elKanji = document.getElementById('home-liked-kanji-count');
    if (elKanji) elKanji.innerText = likedCount;

    const elReadingStock = document.getElementById('home-reading-stock-count');
    if (elReadingStock) elReadingStock.innerText = readingStockCount;

    const nextStepTitleEl = document.getElementById('home-next-step-title');
    if (nextStepTitleEl) nextStepTitleEl.innerText = timeline.stageTitle;

    const nextStepDetailEl = document.getElementById('home-next-step-detail');
    if (nextStepDetailEl) {
        nextStepDetailEl.innerText = '';
        nextStepDetailEl.classList.add('hidden');
    }

    const nextStepActionLabelEl = document.getElementById('home-next-step-action-label');
    if (nextStepActionLabelEl) nextStepActionLabelEl.innerText = nextStep.actionLabel;

    const collectionSummaryEl = document.getElementById('home-collection-summary');
    if (collectionSummaryEl) collectionSummaryEl.innerText = getHomeCollectionSummaryText(readingStock);

    const elPrefSummary = document.getElementById('home-preference-summary');
    if (elPrefSummary) elPrefSummary.innerText = preference.shortText || 'まだ傾向なし';

    const elPartnerSummary = document.getElementById('home-partner-summary');
    if (elPartnerSummary) elPartnerSummary.innerText = pairing.shortText;

    const soundBadge = document.getElementById('home-entry-sound-badge');
    if (soundBadge) soundBadge.classList.add('hidden');

    const readingBadge = document.getElementById('home-entry-reading-badge');
    if (readingBadge) readingBadge.classList.add('hidden');

    const soundEntry = document.getElementById('home-entry-sound');
    if (soundEntry) {
        soundEntry.style.boxShadow = recommendedEntry === 'sound'
            ? '0 14px 28px rgba(185,150,91,0.16)'
            : '';
        soundEntry.style.borderWidth = recommendedEntry === 'sound' ? '3px' : '2px';
        soundEntry.style.borderColor = recommendedEntry === 'sound' ? '#b9965b' : '#c4caf2';
    }

    const readingEntry = document.getElementById('home-entry-reading');
    if (readingEntry) {
        readingEntry.style.boxShadow = recommendedEntry === 'reading'
            ? '0 14px 28px rgba(185,150,91,0.16)'
            : '';
        readingEntry.style.borderWidth = recommendedEntry === 'reading' ? '3px' : '2px';
        readingEntry.style.borderColor = recommendedEntry === 'reading' ? '#b9965b' : '#c4caf2';
    }

    const elPartnerTitle = document.getElementById('home-partner-match-title');
    if (elPartnerTitle) elPartnerTitle.innerText = pairing.title;

    const elPartnerSubtitle = document.getElementById('home-partner-match-subtitle');
    if (elPartnerSubtitle) elPartnerSubtitle.innerText = pairing.subtitle;

    const elPartnerFootnote = document.getElementById('home-match-footnote');
    if (elPartnerFootnote) elPartnerFootnote.innerText = pairing.footnote;

    const elMatchedKanji = document.getElementById('home-match-kanji-count');
    if (elMatchedKanji) elMatchedKanji.innerText = pairing.matchedKanjiCount;

    const elMatchedNames = document.getElementById('home-match-name-count');
    if (elMatchedNames) elMatchedNames.innerText = pairing.matchedNameCount;

    const pairActionBtn = document.getElementById('home-pair-action');
    if (pairActionBtn) {
        pairActionBtn.innerText = pairing.actionLabel || '';
        pairActionBtn.classList.toggle('hidden', !!pairing.hasPartner);
    }

    const pairCodeRow = document.getElementById('home-pair-code-row');
    if (pairCodeRow) pairCodeRow.classList.toggle('hidden', !(pairing.inRoom && pairing.roomCode && !pairing.hasPartner));

    const pairCodeEl = document.getElementById('home-pair-room-code');
    if (pairCodeEl) pairCodeEl.innerText = pairing.roomCode || '------';

    const pairJoinToggle = document.getElementById('home-pair-join-toggle');
    if (pairJoinToggle) pairJoinToggle.classList.toggle('hidden', !!pairing.inRoom);

    const pairJoinRole = document.getElementById('home-pair-quick-role');
    if (pairJoinRole) {
        pairJoinRole.classList.toggle('hidden', !!pairing.inRoom);
        if (typeof getHomePairJoinRoleText === 'function') pairJoinRole.innerText = getHomePairJoinRoleText();
    }

    const pairJoinRow = document.getElementById('home-pair-join-row');
    if (pairJoinRow && pairing.inRoom) {
        pairJoinRow.classList.add('hidden');
    }

    const pairCard = document.getElementById('home-pair-card');
    if (pairCard) {
        pairCard.classList.toggle('hidden', !showPairCard);
        if (pairing.canOpenHub) {
            pairCard.style.cursor = 'pointer';
            pairCard.onclick = openHomePartnerHubFromEvent;
            pairCard.setAttribute('role', 'button');
            pairCard.setAttribute('tabindex', '0');
            pairCard.onkeydown = function (event) {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    openHomePartnerHubFromEvent(event);
                }
            };
        } else {
            pairCard.style.cursor = '';
            pairCard.onclick = null;
            pairCard.onkeydown = null;
            pairCard.removeAttribute('role');
            pairCard.removeAttribute('tabindex');
        }
    }

    const dismissBtn = document.getElementById('home-pair-dismiss');
    if (dismissBtn) dismissBtn.classList.toggle('hidden', !canDismissHomePairCard(pairing));

    const restoreBtn = document.getElementById('home-pair-restore');
    if (restoreBtn) restoreBtn.classList.toggle('hidden', showPairCard || !canDismissHomePairCard(pairing));
}

window.closeHomePartnerHub = closeHomePartnerHub;
window.openHomePartnerHub = openHomePartnerHub;
window.openHomePartnerHubFromEvent = openHomePartnerHubFromEvent;
window.openHomePartnerHubAction = openHomePartnerHubAction;
window.getMeimayPartnerViewState = getMeimayPartnerViewState;
window.setMeimayPartnerViewFocus = setMeimayPartnerViewFocus;
window.resetMeimayPartnerViewFocus = resetMeimayPartnerViewFocus;
window.renderHomeProfile = renderHomeProfile;

try {
    if (typeof renderHomeProfile === 'function') {
        renderHomeProfile();
    }
} catch (e) { }
