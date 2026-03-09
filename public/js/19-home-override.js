function canDismissHomePairCard(pairing) {
    return true;
}

function getWizardHomeState() {
    try {
        if (typeof WizardData !== 'undefined' && typeof WizardData.get === 'function') {
            const wizard = WizardData.get() || {};
            return {
                hasReadingCandidate: wizard.hasReadingCandidate === true,
                dueDate: wizard.dueDate || ''
            };
        }
    } catch (e) { }

    return {
        hasReadingCandidate: false,
        dueDate: ''
    };
}

function getHomeRecommendedEntry(readingStockCount) {
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

    if (topTags.length > 0) {
        return topTags.join(' ');
    }

    return getWizardHomeState().hasReadingCandidate ? '候補あり' : 'まだ傾向なし';
}

function getHomeNextStep(likedCount, readingStockCount, savedCount, pairing) {
    const breakdown = getHomeCollectionBreakdown(typeof liked !== 'undefined' ? liked : [], readingStockCount);
    const wizard = getWizardHomeState();

    if ((pairing?.matchedNameCount || 0) >= 1) {
        return {
            title: '一致した名前を見直す',
            detail: 'ふたりで一致した候補が出てきています。保存済みで比較を進めましょう。',
            actionLabel: '保存済みを見る',
            action: 'saved'
        };
    }

    if ((pairing?.matchedKanjiCount || 0) >= 1) {
        return {
            title: '一致した漢字を確認する',
            detail: '共通で気になっている漢字があります。ストックから見直せます。',
            actionLabel: 'ストックを見る',
            action: 'stock'
        };
    }

    if (savedCount >= 2) {
        return {
            title: '保存した候補を比較する',
            detail: '比較できる候補がそろってきました。保存済みから見比べましょう。',
            actionLabel: '保存済みを見る',
            action: 'saved'
        };
    }

    if (readingStockCount === 0 && wizard.hasReadingCandidate) {
        return {
            title: '読み候補があるので漢字を集める',
            detail: '候補の読みが決まっているなら、読みから漢字を探すのがおすすめです。',
            actionLabel: '読みから漢字を探す',
            action: 'reading'
        };
    }

    if (readingStockCount === 0) {
        return {
            title: '読み候補を探す',
            detail: 'まずは響きやイメージから、気になる読みを集めていきましょう。',
            actionLabel: '響き・読みを探す',
            action: 'sound'
        };
    }

    if (breakdown.readingDerivedCount < 2) {
        return {
            title: '読みから漢字を増やす',
            detail: `読み候補が ${readingStockCount} 件あるので、次は漢字材料を増やす段階です。`,
            actionLabel: '読みから漢字を探す',
            action: 'reading'
        };
    }

    if (savedCount === 1) {
        return {
            title: '比較用にもう1案つくる',
            detail: '比較しやすくするために、もう1案保存してから見直すのがおすすめです。',
            actionLabel: 'ビルドへ',
            action: 'build'
        };
    }

    return {
        title: 'ビルドで候補をまとめる',
        detail: '材料が集まってきたので、組み合わせて候補を整えましょう。',
        actionLabel: 'ビルドへ',
        action: 'build'
    };
}

function renderHomeProfile() {
    const likedCount = (typeof liked !== 'undefined' && liked) ? liked.length : 0;
    const savedList = (typeof getSavedNames === 'function') ? getSavedNames() : (window.savedNames || []);
    const savedCount = savedList.length;
    const readingStock = (typeof getReadingStock === 'function') ? getReadingStock() : [];
    const readingStockCount = readingStock.length;
    const preference = getHomePreferenceSummary(liked);
    const pairing = getPairingHomeSummary();
    const nextStep = getHomeNextStep(likedCount, readingStockCount, savedCount, pairing);
    const timeline = getNamingMaterialTimeline(likedCount, readingStockCount, savedCount);
    const recommendedEntry = getHomeRecommendedEntry(readingStockCount);
    const showPairCard = !canDismissHomePairCard(pairing) || !isHomePairCardDismissed();

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
    if (elPrefSummary) elPrefSummary.innerText = preference.shortText;

    const elPartnerSummary = document.getElementById('home-partner-summary');
    if (elPartnerSummary) elPartnerSummary.innerText = pairing.shortText;

    const soundBadge = document.getElementById('home-entry-sound-badge');
    if (soundBadge) soundBadge.classList.toggle('hidden', recommendedEntry !== 'sound');

    const readingBadge = document.getElementById('home-entry-reading-badge');
    if (readingBadge) readingBadge.classList.toggle('hidden', recommendedEntry !== 'reading');

    const soundEntry = document.getElementById('home-entry-sound');
    if (soundEntry) {
        soundEntry.style.boxShadow = recommendedEntry === 'sound'
            ? '0 10px 24px rgba(185,150,91,0.18)'
            : '';
        soundEntry.style.borderWidth = recommendedEntry === 'sound' ? '3px' : '';
    }

    const readingEntry = document.getElementById('home-entry-reading');
    if (readingEntry) {
        readingEntry.style.boxShadow = recommendedEntry === 'reading'
            ? '0 10px 24px rgba(185,150,91,0.18)'
            : '';
        readingEntry.style.borderWidth = recommendedEntry === 'reading' ? '3px' : '';
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
        pairActionBtn.innerText = pairing.actionLabel;
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
        pairJoinRole.innerText = getHomePairJoinRoleText();
    }

    const pairJoinRow = document.getElementById('home-pair-join-row');
    if (pairJoinRow && pairing.inRoom) {
        pairJoinRow.classList.add('hidden');
    }

    const pairCard = document.getElementById('home-pair-card');
    if (pairCard) pairCard.classList.toggle('hidden', !showPairCard);

    const dismissBtn = document.getElementById('home-pair-dismiss');
    if (dismissBtn) dismissBtn.classList.toggle('hidden', !canDismissHomePairCard(pairing));

    const restoreBtn = document.getElementById('home-pair-restore');
    if (restoreBtn) restoreBtn.classList.toggle('hidden', showPairCard || !canDismissHomePairCard(pairing));
}

window.renderHomeProfile = renderHomeProfile;

try {
    if (typeof renderHomeProfile === 'function') {
        renderHomeProfile();
    }
} catch (e) { }
