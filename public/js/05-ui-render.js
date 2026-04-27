/* ============================================================
   MODULE 05: UI RENDER (V14.1 - タップ範囲拡大版)
   カード描画・詳細表示
   ============================================================ */

const KANJI_CATEGORIES = {
    '#希望': { label: '希望', icon: '🌟', class: 'tag-hope' },
    '#慈愛': { label: '慈愛', icon: '💖', class: 'tag-affection' },
    '#調和': { label: '調和', icon: '🤝', class: 'tag-harmony' },
    '#勇壮': { label: '勇壮', icon: '🦁', class: 'tag-bravery' },
    '#知性': { label: '知性', icon: '🎓', class: 'tag-intelligence' },
    '#飛躍': { label: '飛躍', icon: '🦅', class: 'tag-leap' },
    '#信念': { label: '信念', icon: '⛰️', class: 'tag-conviction' },
    '#品格': { label: '品格', icon: '🕊️', class: 'tag-dignity' },
    '#伝統': { label: '伝統', icon: '⛩️', class: 'tag-tradition' },
    '#幸福': { label: '幸福', icon: '🍀', class: 'tag-fortune' },
    '#色彩': { label: '色彩', icon: '🎨', class: 'tag-colors' },
    '#天空': { label: '天空', icon: '🌌', class: 'tag-sky' },
    '#自然': { label: '自然', icon: '🌿', class: 'tag-nature' },
    '#水景': { label: '水景', icon: '🌊', class: 'tag-aquatic' },
    '#奏楽': { label: '奏楽', icon: '🎵', class: 'tag-music' },
    '#その他': { label: 'その他', icon: '📝', class: 'tag-other' }
};

function getUnifiedTags(rawString) {
    if (!rawString || rawString === '---') return ['#その他'];
    // スペース・カンマ両対応でタグを抽出（変換なし）
    const tags = rawString
        .split(/[\s,，、]+/)
        .map(t => t.trim())
        .filter(t => t.startsWith('#'));
    return tags.length > 0 ? tags : ['#その他'];
}

/**
 * かな正規化（カタカナをひらがなに変換）
 */
function normalizeKana(str) {
    if (!str) return '';
    return str.replace(/[\u30a1-\u30f6]/g, function (match) {
        const chr = match.charCodeAt(0) - 0x60;
        return String.fromCharCode(chr);
    });
}

/**
 * scr-main の表示状態を3状態で制御する
 *  - セッションなし : empty-state 表示、HUD/stack/actionBtns 非表示
 *  - カードあり     : HUD/stack/actionBtns 表示、empty-state 非表示
 *  - カード枯渇     : HUD/stack 表示、actionBtns/empty-state 非表示
 */

/**
 * カードのレンダリング
 */
function render() {
    updateSwipeMainState();
    const container = document.getElementById('stack');
    if (!container) {
        console.error("RENDER: 'stack' container not found");
        return;
    }

    container.innerHTML = '';

    // スタック終了チェック
    const premiumActive = typeof PremiumManager !== 'undefined' && PremiumManager.isPremium && PremiumManager.isPremium();
    const freeDailyRemaining = isFreeSwipeMode && !premiumActive && typeof getDailyRemainingCount === 'function'
        ? getDailyRemainingCount()
        : null;

    if (isFreeSwipeMode && freeDailyRemaining !== null && freeDailyRemaining <= 0) {
        container.innerHTML = `
            <div class="flex items-center justify-center h-full text-center px-6">
                <div class="w-full max-w-sm rounded-[32px] border border-[#eadfce] bg-white/95 px-6 py-7 shadow-2xl">
                    <div class="text-[10px] font-black tracking-[0.35em] text-[#b9965b]">DAILY LIMIT</div>
                    <p class="mt-3 text-[#bca37f] font-bold text-lg">本日のスワイプ上限に達しました</p>
                    <p class="mt-3 text-sm text-[#7a6f5a] leading-relaxed">
                        漢字スワイプは1日100回までです。<br>
                        プレミアムなら漢字も読みも無制限でスワイプできます。
                    </p>
                    <div class="mt-5 flex flex-col gap-3">
                        <button onclick="isFreeSwipeMode=false; if (typeof openBuildFreeMode === 'function') openBuildFreeMode(); else if (typeof openBuild === 'function') openBuild();" class="btn-gold w-full py-4 shadow-md">
                            ビルドへ
                        </button>
                        <button onclick="if (typeof showPremiumModal === 'function') showPremiumModal();" class="w-full rounded-2xl border border-[#e6dccb] bg-white py-4 text-sm font-bold text-[#8b7e66] shadow-sm">
                            プレミアムへ
                        </button>
                    </div>
                </div>
            </div>
        `;
        return;
    }

    if (!stack || stack.length === 0 || currentIdx >= stack.length) {
        if (isFreeSwipeMode) {
            container.innerHTML = `
                <div class="flex items-center justify-center h-full text-center px-6">
                    <div>
                        <p class="text-[#bca37f] font-bold text-lg mb-4">すべて確認しました</p>
                        <p class="text-sm text-[#a6967a] mb-6">ビルドへ進んで名前候補を作ろう</p>
                        <button onclick="isFreeSwipeMode=false; openBuildFreeMode()" class="btn-gold py-4 px-8">ビルドへ →</button>
                    </div>
                </div>
            `;
            return;
        }

        // addMoreToSlot から来た場合 / 最後の文字スロットの場合 → ビルドへ
        const goToBuild = window._addMoreFromBuild || currentPos >= segments.length - 1;
        const activeRule = typeof getActiveSwipeRule === 'function' ? getActiveSwipeRule(currentPos) : rule;
        const canOfferFlexibleRetry = typeof activeRule !== 'undefined' && activeRule === 'strict';
        const premiumActive = typeof PremiumManager !== 'undefined' && PremiumManager.isPremium && PremiumManager.isPremium();
        container.innerHTML = `
            <div class="flex items-center justify-center h-full text-center px-6">
                <div class="w-full max-w-[320px]">
                    <p class="text-[#bca37f] font-bold text-lg mb-4">候補がありません</p>
                    <p class="text-sm text-[#a6967a] mb-6">設定を変更するか、<br>次の文字に進んでください</p>
                    <div class="mb-4 flex flex-col gap-2">
                        ${premiumActive ? '' : `
                            <button onclick="if (typeof showPremiumModal === 'function') showPremiumModal();" class="w-full rounded-2xl border border-[#e6dccb] bg-white px-4 py-3 text-[12px] font-bold text-[#8b7e66] shadow-sm active:scale-95">
                                人名用漢字も表示する
                            </button>
                        `}
                        <button onclick="retrySwipeEmptyState({ includeNoped: true })" class="w-full rounded-2xl border border-[#d9c5a4] bg-[#fffaf2] px-4 py-3 text-[12px] font-bold text-[#8b6f47] active:scale-95">
                            見送った候補を再度表示する
                        </button>
                        ${canOfferFlexibleRetry ? `
                            <button onclick="retrySwipeEmptyState({ includeNoped: true, nextRule: 'lax' })" class="w-full rounded-2xl border border-[#cfdcf2] bg-[#f7fbff] px-4 py-3 text-[12px] font-bold text-[#5f7ea8] active:scale-95">
                                柔軟モードでも探す
                            </button>
                        ` : ''}
                    </div>
                    ${goToBuild ?
                '<button onclick="window._addMoreFromBuild=false; openBuild()" class="btn-gold py-4 px-8">ビルド画面へ →</button>' :
                '<button onclick="proceedToNextSlot()" class="btn-gold py-4 px-8">次の文字へ進む →</button>'
            }
                </div>
            </div>
        `;
        return;
    }

    const data = stack[currentIdx];
    console.log("RENDER: Rendering card", currentIdx, data['漢字']);

    const card = document.createElement('div');
    card.className = 'card';

    const meaning = clean(data['意味']);
    const shortMeaning = meaning.length > 50 ? meaning.substring(0, 50) + '...' : meaning;

    // 読みHTML (全読みを表示し、ヒットしたものを枠で強調)
    const currentSearchReading = (typeof segments !== 'undefined' && segments[currentPos]) || '';

    // 全読みリストを作成 (音, 訓, 伝統名のり の順を維持)
    const allReadings = [data['音'], data['訓'], data['伝統名のり']]
        .filter(x => clean(x))
        .join(',')
        .split(/[、,，\s/]+/)
        .map(x => clean(x))
        .filter(x => x);

    // 読みは実幅に合わせて1行に収め、マッチした読みは必ず残す
    const readingsHTML = allReadings.length > 0 ?
        allReadings.map(r => {
            const isMatch = normalizeKana(r) === normalizeKana(currentSearchReading);
            return `<span class="kanji-reading-chip ${isMatch ? 'kanji-reading-chip-active' : ''}">${r}</span>`;
        }).join(' ') + `<span class="kanji-reading-more" hidden></span>` :
        '';

    // 分類タグを取得 (raw dataからのタグを取得)
    const unifiedTags = getUnifiedTags((data['分類'] || ''));

    // タグの印象色は全面塗りではなく、カード枠のグラデーションに使う
    const bgGradient = getGradientFromTags(unifiedTags);
    card.style.background = bgGradient;
    card.style.border = '1px solid rgba(139, 126, 102, 0.12)';

    // タグHTML: 背景色なし・#タグ名テキストのみ
    const tagsHTML = unifiedTags.filter(t => t !== '#その他').length > 0 ?
        unifiedTags.filter(t => t !== '#その他').map(t => `<span class="kanji-tag">${t}</span>`).join(' ') :
        '';

    // カード全体をクリック可能に
    card.innerHTML = `
        <div class="kanji-swipe-content">
            ${tagsHTML ? `<div class="kanji-swipe-tags">${tagsHTML}</div>` : ''}

            <div class="kanji-swipe-main">
                <div class="kanji-swipe-kanji">${data['漢字']}</div>

                <div class="kanji-swipe-strokes">${data['画数']}画</div>

                ${readingsHTML ? `<div class="kanji-swipe-readings">${readingsHTML}</div>` : ''}

                <div class="kanji-swipe-meaning">
                    <p>${shortMeaning || '意味情報なし'}</p>
                </div>
            </div>

            <div class="kanji-swipe-hint">タップで詳細 / スワイプで選択</div>
        </div>
    `;

    // 注意: clickリスナー削除済み。タップはphysics(onpointerup)で処理するため
    // card.addEventListener('click', ...) を残すとゴーストclickでLIKE貫通が発生する

    // 物理演算セットアップ
    if (typeof setupPhysics === 'function') {
        setupPhysics(card, data);
    } else {
        console.error("RENDER: setupPhysics() not found");
    }

    container.appendChild(card);
    fitKanjiSwipeReadings(card);
    fitKanjiSwipeCard(card);
    requestAnimationFrame(() => {
        fitKanjiSwipeReadings(card);
        fitKanjiSwipeCard(card);
    });
    console.log("RENDER: Card appended to container");

    updateSwipeCounter();
}

function fitKanjiSwipeReadings(card) {
    const container = card?.querySelector('.kanji-swipe-readings');
    if (!container) return;

    const chips = Array.from(container.querySelectorAll('.kanji-reading-chip'));
    const more = container.querySelector('.kanji-reading-more');
    if (chips.length === 0 || !more) return;

    const activeChip = chips.find(chip => chip.classList.contains('kanji-reading-chip-active'));
    const showChips = (visibleChips) => {
        const visibleSet = new Set(visibleChips);
        chips.forEach(chip => {
            chip.hidden = !visibleSet.has(chip);
        });

        const hiddenCount = chips.length - visibleChips.length;
        more.hidden = hiddenCount <= 0;
        more.textContent = hiddenCount > 0 ? `他${hiddenCount}個` : '';
    };

    const chooseChips = (limit) => {
        const visible = chips.slice(0, limit);
        if (activeChip && !visible.includes(activeChip)) {
            visible[limit - 1] = activeChip;
            visible.sort((a, b) => chips.indexOf(a) - chips.indexOf(b));
        }
        return visible;
    };

    showChips(chips);
    if (container.scrollWidth <= container.clientWidth + 1) return;

    for (let limit = chips.length - 1; limit >= 1; limit--) {
        const visible = chooseChips(limit);
        showChips(visible);
        if (container.scrollWidth <= container.clientWidth + 1) return;
    }
}

function fitKanjiSwipeCard(card) {
    const main = card?.querySelector('.kanji-swipe-main');
    const kanji = card?.querySelector('.kanji-swipe-kanji');
    if (!main || !kanji) return;

    kanji.style.removeProperty('font-size');
    let size = parseFloat(window.getComputedStyle(kanji).fontSize) || 96;
    const minSize = 64;
    let guard = 0;

    while (
        guard < 14 &&
        size > minSize &&
        main.scrollHeight > main.clientHeight + 1
    ) {
        size -= 4;
        kanji.style.fontSize = `${size}px`;
        guard++;
    }
}

/**
 * スワイプカウンター更新
 */
function updateSwipeCounter() {
    const el = document.getElementById('swipe-counter');
    if (!el || !stack) return;
    const premiumActive = typeof PremiumManager !== 'undefined' && PremiumManager.isPremium && PremiumManager.isPremium();
    const remaining = premiumActive ? null : (typeof getDailyRemainingCount === 'function' ? getDailyRemainingCount() : 0);

    if (isFreeSwipeMode) {
        const selectedItems = liked.filter(item => item.sessionReading === 'FREE');
        const superCount = selectedItems.filter(item => item.isSuper).length;
        el.innerText = formatSwipeProgressText({
            kept: selectedItems.length,
            superCount,
            remaining
        });
        return;
    }

    const currentReading = typeof getCurrentSessionReading === 'function' ? getCurrentSessionReading() : segments.join('');
    const selectedItems = liked.filter(item =>
        item.slot === currentPos &&
        (!item.sessionReading || item.sessionReading === currentReading)
    );
    const superCount = selectedItems.filter(item => item.isSuper).length;

    el.innerText = formatSwipeProgressText({
        kept: selectedItems.length,
        superCount,
        remaining
    });
}

/**
 * タグからグラデーションを生成 (v14.5: 2つのタグをブレンド)
 */
function getGradientFromTags(tags) {
    if (!tags || tags.length === 0) return 'linear-gradient(135deg, #fdfaf5 0%, #f7f3ec 100%)';

    const colorMap = {
        'tag-hope': ['#FFF4E0', '#FFFDF7'],
        'tag-affection': ['#FFF0F0', '#FFF9F9'],
        'tag-harmony': ['#E8F5E9', '#F1F8F1'],
        'tag-bravery': ['#FFEBEE', '#FFF5F5'],
        'tag-intelligence': ['#E3F2FD', '#F0F7FF'],
        'tag-leap': ['#F3E5F5', '#F9F4F9'],
        'tag-conviction': ['#E8EAF6', '#F0F1FA'],
        'tag-dignity': ['#EFEBE9', '#F5F2F1'],
        'tag-tradition': ['#F1F8E1', '#F7FAF0'],
        'tag-fortune': ['#FFFDE7', '#FFFFF2'],
        'tag-colors': ['#FCE4EC', '#FDF2F5'],
        'tag-sky': ['#E8EAF6', '#F0F1FA'],
        'tag-nature': ['#E8F5E9', '#F1F8F1'],
        'tag-aquatic': ['#E1F5FE', '#F0FAFF'],
        'tag-music': ['#F3E5F5', '#F9F4F9']
    };

    const cat1 = KANJI_CATEGORIES[tags[0]];
    const colors1 = (cat1 && colorMap[cat1.class]) ? colorMap[cat1.class] : ['#fdfaf5', '#f7f3ec'];

    if (tags.length === 1) {
        return `linear-gradient(135deg, ${colors1[0]} 0%, ${colors1[1]} 100%)`;
    }

    // 複数タグ: 2タグの色をブレンドしたグラデーション
    const cat2 = KANJI_CATEGORIES[tags[1]];
    const colors2 = (cat2 && colorMap[cat2.class]) ? colorMap[cat2.class] : colors1;
    return `linear-gradient(135deg, ${colors1[0]} 0%, ${colors2[0]} 60%, ${colors2[1]} 100%)`;
}
window.getGradientFromTags = getGradientFromTags;

/**
 * 次のスロットへ進む
 */
function proceedToNextSlot() {
    if (currentPos < segments.length - 1) {
        currentPos++;
        currentIdx = 0;
        swipes = 0;

        if (typeof loadStack === 'function') {
            loadStack();
        }

        changeScreen('scr-main');
    }
}

function retrySwipeEmptyState(options = {}) {
    const {
        includeNoped = false,
        nextRule = null
    } = options;

    if (nextRule) {
        if (typeof setTemporarySwipeRule === 'function') {
            setTemporarySwipeRule(currentPos, nextRule);
        } else if (typeof setRule === 'function') {
            setRule(nextRule);
        } else {
            rule = nextRule;
        }
    }

    window._includeNopedForSlot = includeNoped ? currentPos : null;
    currentIdx = 0;
    swipes = 0;

    if (typeof loadStack === 'function') {
        loadStack();
    }

    changeScreen('scr-main');
    if (typeof updateSwipeMainState === 'function') {
        updateSwipeMainState();
    }
}
window.retrySwipeEmptyState = retrySwipeEmptyState;

/**
 * 漢字詳細モーダルを表示（インデックス版）
 */
function showKanjiDetailByIndex(idx) {
    if (!stack || idx < 0 || idx >= stack.length) {
        console.error("RENDER: Invalid kanji index", idx);
        return;
    }

    const data = stack[idx];
    showKanjiDetail(data);
}

/**
 * 漢字詳細モーダルを表示（データ版）- ストック用
 */
function showDetailByData(data) {
    showKanjiDetail(data);
}

// 詳細モーダルで現在表示中の漢字データを保持
let _currentDetailData = null;

/**
 * 漢字詳細モーダルを表示
 */
async function showKanjiDetail(data) {
    _currentDetailData = data;
    const modal = document.getElementById('modal-kanji-detail');
    if (!modal) {
        console.error("RENDER: Kanji detail modal not found");
        return;
    }

    const kanjiEl = document.getElementById('detail-kanji');
    const yojijukugoEl = document.getElementById('detail-yojijukugo');
    const headerMeaningEl = document.getElementById('header-meaning');
    const headerReadingEl = document.getElementById('header-reading'); // v14.3 New
    const headerBg = document.getElementById('modal-header-bg');

    if (!kanjiEl || !yojijukugoEl) return;

    const isKanaDetail = !!data.isKanaCandidate;
    const yojijukugoSection = yojijukugoEl.parentElement;
    if (yojijukugoSection) {
        yojijukugoSection.classList.toggle('hidden', isKanaDetail);
    }

    // 基本情報を表示
    kanjiEl.innerText = data['漢字'];

    // 漢字の色（デフォルト）
    kanjiEl.style.background = 'none';
    kanjiEl.style.webkitTextFillColor = '#5d5444';
    kanjiEl.style.color = '#5d5444';
    kanjiEl.style.display = 'block';

    // 分類タグ（data['分類']のみ使用）
    const unifiedTags = getUnifiedTags(data['分類'] || '');

    // ヘッダー背景色をグラデーションに
    if (headerBg) {
        const gradient = getGradientFromTags(unifiedTags);
        headerBg.style.background = gradient;
        headerBg.style.textShadow = '0 1px 2px rgba(255,255,255,0.8)';
    }

    // ヘッダーの意味表示
    if (headerMeaningEl) {
        headerMeaningEl.innerHTML = `
            <div class="flex flex-col">
                <div class="text-[10px] font-bold text-[#bca37f] mb-0.5 tracking-widest flex items-center gap-1">
                    <span>💡</span> 意味
                </div>
                <div class="text-xs text-[#5d5444] leading-relaxed">
                    ${clean(data['意味']) || '意味データなし'}
                </div>
            </div>
        `;
    }

    // ヘッダーの読み表示 (v14.4: カードと同じく全読みを表示)
    const readings = [data['音'], data['訓'], data['伝統名のり']]
        .filter(x => clean(x))
        .join(',')
        .split(/[、,，\s/]+/)
        .map(x => clean(x))
        .filter(x => x);

    if (headerReadingEl) {
        const readingLabel = isKanaDetail ? '読み' : '読み・名乗り';
        headerReadingEl.innerHTML = `
            <div class="flex flex-col">
                <div class="text-[10px] font-bold text-[#bca37f] mb-0.5 tracking-widest flex items-center gap-1">
                    <span>📖</span> ${readingLabel}
                </div>
                <div class="text-xs text-[#5d5444] leading-normal tracking-wider break-keep mt-[1px]">
                    ${readings.join('<span class="text-[#ede5d8] mx-1">|</span>')}
                </div>
            </div>
        `;
    }
    let tagsContainer = document.getElementById('det-tags-container');

    // タグHTML: 背景色なし・#タグ名テキストのみ（カードと統一）
    const tagsHTML = unifiedTags.map(t => `<span class="kanji-tag">${t}</span>`).join(' ');

    if (tagsContainer) {
        tagsContainer.innerHTML = tagsHTML;
    }


    // ストック状態チェック
    const isLiked = liked.some(l => l['漢字'] === data['漢字'] && !l?.fromPartner);

    // ヘッダー内のストックボタンエリアを更新
    const stockBtnsEl = document.getElementById('modal-stock-btns');
    if (stockBtnsEl) {
        stockBtnsEl.innerHTML = '';
        if (isLiked) {
            const removeBtn = document.createElement('button');
            removeBtn.className = 'w-full py-3 bg-[#fef2f2] rounded-2xl text-sm font-bold text-[#f28b82] hover:bg-[#f28b82] hover:text-white transition-all shadow-sm flex items-center justify-center gap-2 active:scale-95';
            removeBtn.innerHTML = '<span>🗑️</span> ストックから外す';
            removeBtn.onclick = () => toggleStockFromModal(_currentDetailData, true);
            stockBtnsEl.appendChild(removeBtn);
        } else {
            const likeBtn = document.createElement('button');
            likeBtn.className = 'flex-1 py-3 bg-gradient-to-r from-[#81c995] to-[#a3d9b5] rounded-2xl text-sm font-bold text-white hover:shadow-md transition-all shadow-sm flex items-center justify-center gap-1 active:scale-95';
            likeBtn.innerHTML = '<span>♥</span> 候補';
            likeBtn.onclick = () => toggleStockFromModal(_currentDetailData, false, false);

            const superBtn = document.createElement('button');
            superBtn.className = 'flex-1 py-3 bg-gradient-to-r from-[#8ab4f8] to-[#c5d9ff] rounded-2xl text-sm font-bold text-white hover:shadow-md transition-all shadow-sm flex items-center justify-center gap-1 active:scale-95';
            superBtn.innerHTML = '<span>★</span> 本命';
            superBtn.onclick = () => toggleStockFromModal(_currentDetailData, false, true);

            stockBtnsEl.appendChild(likeBtn);
            stockBtnsEl.appendChild(superBtn);
        }
    }

    // AI生成ボタン
    const existingAiBtn = modal.querySelector('#btn-ai-kanji-detail');
    if (existingAiBtn) existingAiBtn.remove();

    if (isKanaDetail) {
        yojijukugoEl.innerHTML = '';
    } else {
        // 現在の読み（名乗り）を特定
        // scr-main アクティブ（スワイプ中）の場合のみ segments[currentPos] を信頼する。
        // それ以外（ストック/検索等から開いた場合）は liked 配列からその漢字の読みを引く。
        let currentReadingForAI = null;
        const mainSwipeScreen = document.getElementById('scr-main');
        const inActiveSwipe = mainSwipeScreen && mainSwipeScreen.classList.contains('active');

        if (inActiveSwipe && typeof isFreeSwipeMode !== 'undefined' && isFreeSwipeMode) {
            // フリーモード時の名乗り漏れを防ぐ
            currentReadingForAI = null;
        } else if (inActiveSwipe && segments && segments[currentPos]) {
            currentReadingForAI = segments[currentPos];
        } else if (typeof liked !== 'undefined') {
            const likedItem = liked.find(l =>
                l['漢字'] === data['漢字'] && l.slot >= 0 &&
                l.sessionReading && l.sessionReading !== 'FREE' &&
                l.sessionReading !== 'SEARCH' && l.sessionReading !== 'SHARED'
            );
            if (likedItem) {
                const segs = (typeof readingToSegments !== 'undefined') ? readingToSegments[likedItem.sessionReading] : null;
                if (segs && segs[likedItem.slot]) {
                    currentReadingForAI = segs[likedItem.slot];
                }
            }
        }

        const aiSection = document.createElement('div');
        aiSection.id = 'btn-ai-kanji-detail';
        aiSection.className = 'mb-4';
        const aiPremiumActive = typeof PremiumManager !== 'undefined' && PremiumManager.isPremium && PremiumManager.isPremium();
        const aiAvailable = aiPremiumActive || !(typeof canUseDailyKanjiDetailAI === 'function') || canUseDailyKanjiDetailAI();
        const aiButtonClass = aiAvailable
            ? 'w-full py-4 bg-gradient-to-r from-[#8b7e66] to-[#bca37f] text-white font-bold rounded-2xl shadow-md hover:shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2 text-sm'
            : 'w-full py-4 bg-[#efe9df] text-[#a59683] font-bold rounded-2xl shadow-sm border border-[#e0d8c9] flex items-center justify-center gap-2 text-sm cursor-not-allowed';
        const aiButtonLabel = aiAvailable
            ? 'AIで漢字の成り立ち・意味を深掘り'
            : '今日のAI深掘りは終了しました';
        aiSection.innerHTML = `
            <button id="btn-ai-kanji-detail-action" type="button"
                    class="${aiButtonClass}">
                <span>🤖</span> ${aiButtonLabel}
            </button>
            ${aiAvailable ? '' : '<p class="mt-2 text-[11px] text-[#a59683] text-center">無料会員は 1 日 1 回までです</p>'}
            <div id="ai-kanji-result" class="mt-3"></div>
        `;

        // 四字熟語の上に挿入
        const yojiWrapperAi = yojijukugoEl.parentNode;
        if (yojiWrapperAi && yojiWrapperAi.parentNode) {
            yojiWrapperAi.parentNode.insertBefore(aiSection, yojiWrapperAi);
        }

        const aiActionButton = aiSection.querySelector('#btn-ai-kanji-detail-action');
        if (aiActionButton) {
            let longPressTimer = null;
            let longPressTriggered = false;
            const clearLongPress = () => {
                if (longPressTimer) {
                    clearTimeout(longPressTimer);
                    longPressTimer = null;
                }
            };
            const startLongPress = () => {
                clearLongPress();
                longPressTriggered = false;
                longPressTimer = setTimeout(async () => {
                    longPressTriggered = true;
                    if (typeof resetKanjiDetailCache === 'function') {
                        await resetKanjiDetailCache(data['漢字'], currentReadingForAI);
                    }
                }, 5000);
            };

            aiActionButton.addEventListener('mousedown', startLongPress);
            aiActionButton.addEventListener('touchstart', startLongPress, { passive: true });
            aiActionButton.addEventListener('mouseup', clearLongPress);
            aiActionButton.addEventListener('mouseleave', clearLongPress);
            aiActionButton.addEventListener('touchend', clearLongPress);
            aiActionButton.addEventListener('touchcancel', clearLongPress);
            aiActionButton.addEventListener('click', async (event) => {
                if (longPressTriggered) {
                    event.preventDefault();
                    event.stopImmediatePropagation();
                    longPressTriggered = false;
                    return;
                }

                if (!aiAvailable) {
                    event.preventDefault();
                    event.stopImmediatePropagation();
                    if (typeof showToast === 'function') {
                        showToast('今日のAI深掘りは終了しました', '🌙');
                    }
                    return;
                }

                await generateKanjiDetail(data['漢字'], currentReadingForAI ? `${currentReadingForAI}` : null);
            }, true);
        }

        // 四字熟語・ことわざ表示
        if (window.idiomsData && window.idiomsData.length > 0) {
            const kanji = data['漢字'];
            // 漢字を含むものを検索
            const matches = window.idiomsData.filter(item => {
                return item['漢字'] && item['漢字'].includes(kanji);
            });

            if (matches.length > 0) {
                const listHtml = matches.map(m => {
                    const mainText = m['漢字'];
                    const reading = m['読み'] || '';
                    const meaning = m['意味'] || '';
                    return `
                        <div class="bg-white p-3 rounded-lg border border-[#eee5d8] shadow-sm mb-2">
                            <div class="flex justify-between items-center mb-1">
                                <div class="font-bold text-[#5d5444] text-lg">${mainText}</div>
                                <span class="text-[9px] font-bold text-[#bca37f] bg-[#fdfaf5] px-2 py-0.5 rounded-full">${m['type'] || '縁起の良い言葉'}</span>
                            </div>
                            ${reading ? `<div class="text-xs text-[#a6967a] mb-1 font-bold">${reading}</div>` : ''}
                            ${meaning ? `<div class="text-xs text-[#7a6f5a] leading-relaxed">${meaning}</div>` : ''}
                        </div>
                    `;
                }).join('');

                yojijukugoEl.innerHTML = `
                    ${listHtml}
                `;
            } else {
                yojijukugoEl.innerHTML = '<p class="text-xs text-[#d4c5af] italic">登録されている四字熟語やことわざはありません。</p>';
            }
        } else {
            yojijukugoEl.innerHTML = '<p class="text-xs text-[#d4c5af]">データ読み込み中...</p>';
        }
    }

    // モーダル表示
    modal.classList.add('active');

    // モーダル表示中はスワイプボタンを隠す
    const swipeActionBtns = document.getElementById('swipe-action-btns');
    if (swipeActionBtns) swipeActionBtns.classList.add('hidden');

    // 空白クリックで閉じる
    modal.onclick = (e) => {
        if (e.target === modal) {
            closeKanjiDetail();
        }
    };
}

/**
 * ストック追加時に元の読み文脈を引き継ぐ
 * @param {Object} data - 漢字データ
 */
function resolveStockSourceSessionContext(data) {
    const sourceSessionReading = typeof data?.sessionReading === 'string' ? data.sessionReading : '';
    const sourceSlot = Number.isFinite(Number(data?.slot)) ? Number(data.slot) : -1;
    const sourceSessionSegments = Array.isArray(data?.sessionSegments) && data.sessionSegments.length > 0
        ? [...data.sessionSegments]
        : null;
    const sourceDisplaySegments = Array.isArray(data?.sessionDisplaySegments) && data.sessionDisplaySegments.length > 0
        ? [...data.sessionDisplaySegments]
        : null;
    const fallbackReadingFromSegments = sourceSessionSegments ? sourceSessionSegments.join('') : '';

    if (sourceSessionReading || sourceSlot >= 0 || sourceSessionSegments) {
        return {
            sessionReading: sourceSessionReading || fallbackReadingFromSegments || 'FREE',
            slot: sourceSlot,
            sessionSegments: sourceSessionSegments,
            sessionDisplaySegments: sourceDisplaySegments
        };
    }

    const mainSwipeScreen = document.getElementById('scr-main');
    if (mainSwipeScreen && mainSwipeScreen.classList.contains('active') && segments && segments[currentPos]) {
        if (typeof isFreeSwipeMode !== 'undefined' && isFreeSwipeMode) {
            return {
                sessionReading: 'FREE',
                slot: -1,
                sessionSegments: null,
                sessionDisplaySegments: null
            };
        }
        return {
            sessionReading: typeof getCurrentSessionReading === 'function' ? getCurrentSessionReading() : segments.join(''),
            slot: currentPos,
            sessionSegments: [...segments],
            sessionDisplaySegments: Array.isArray(window.displaySegments) ? [...window.displaySegments] : null
        };
    }

    return {
        sessionReading: 'FREE',
        slot: -1,
        sessionSegments: null,
        sessionDisplaySegments: null
    };
}

/**
 * モーダルからストックを切り替え
 * @param {Object} data - 漢字データ
 * @param {boolean} isCurrentlyLiked - 現在ストック中かどうか
 * @param {boolean} [isSuper=false] - スーパーライクとして追加するか
 */
function toggleStockFromModal(data, isCurrentlyLiked, isSuper) {
    // ゴーストclick防止：カードタップから300ms以内の呼び出しは無視
    // （タップでモーダルが開いた直後にモーダル内LIKEボタンが自動発火するのを防ぐ）
    if (Date.now() - (window._lastCardTap || 0) < 300) {
        console.log('RENDER: toggleStockFromModal blocked – ghost click guard');
        return;
    }
    if (isCurrentlyLiked) {
        if (!confirm(`「${data['漢字']}」をストックから外しますか？`)) return;

        // ストックから削除 (重複登録されている可能性を考慮し、同じ漢字をすべて削除)
        let removedCount = 0;
        for (let i = liked.length - 1; i >= 0; i--) {
            if (liked[i]['漢字'] === data['漢字'] && !liked[i]?.fromPartner) {
                liked.splice(i, 1);
                removedCount++;
            }
        }

        if (removedCount > 0 && !data.isKanaCandidate && typeof MeimayStats !== 'undefined' && MeimayStats.recordKanjiUnlike) {
            MeimayStats.recordKanjiUnlike(data['漢字'], data.gender || gender || 'neutral');
        }

        if (removedCount > 0) {
            if (typeof StorageBox !== 'undefined' && StorageBox.saveLiked) StorageBox.saveLiked();

            const scrStock = document.getElementById('scr-stock');
            if (scrStock && scrStock.classList.contains('active') && typeof renderStock === 'function') {
                renderStock();
            }

            alert('ストックから外しました');
            if (typeof showKanjiDetail === 'function') showKanjiDetail(data);
        }
    } else {
        const sourceContext = resolveStockSourceSessionContext(data);
        const sessionReading = sourceContext.sessionReading;
        const slot = sourceContext.slot;
        const sessionSegments = sourceContext.sessionSegments;
        const sessionDisplaySegments = sourceContext.sessionDisplaySegments;

        const readingToSave = [data['音'], data['訓'], data['伝統名のり']].filter(x => x).join(',');

        const likeData = {
            ...data,
            timestamp: new Date().toISOString(),
            sessionReading: sessionReading,
            slot: slot,
            kanji_reading: readingToSave,
            isSuper: !!isSuper,
            fromPartner: false,
            partnerAlsoPicked: false
        };
        delete likeData.partnerName;
        if (sessionSegments) {
            likeData.sessionSegments = sessionSegments;
        }
        if (sessionDisplaySegments) {
            likeData.sessionDisplaySegments = sessionDisplaySegments;
        }

        liked.push(likeData);
        if (typeof StorageBox !== 'undefined' && StorageBox.saveLiked) StorageBox.saveLiked();
        if (data && data['漢字'] && !data.isKanaCandidate && typeof MeimayStats !== 'undefined' && MeimayStats.recordKanjiLike) {
            MeimayStats.recordKanjiLike(data['漢字'], data.gender || gender || 'neutral');
        }

        // 漢字検索画面が表示中なら結果を即座に更新（❤アイコン反映）
        const scrSearch = document.getElementById('scr-kanji-search');
        if (scrSearch && scrSearch.classList.contains('active') && typeof executeKanjiSearch === 'function') {
            executeKanjiSearch();
        }

        const scrStock = document.getElementById('scr-stock');
        if (scrStock && scrStock.classList.contains('active') && typeof renderStock === 'function') {
            renderStock();
        }

        alert(isSuper ? '★本命でストックに追加しました！' : '♥候補でストックに追加しました！');
        if (typeof showKanjiDetail === 'function') showKanjiDetail(data);
    }
}

/**
 * 漢字詳細モーダルを閉じる
 */

window.updateSwipeMainState = updateSwipeMainState;
window.showKanjiDetail = showKanjiDetail;

/**
 * ホーム画面の集計とダッシュボード表示
 */
function getHomePreferenceSummary(likedList) {
    if (!likedList || likedList.length === 0) {
        return { shortText: 'まだ傾向なし', detailText: '漢字をためると傾向が見えてきます。', topLabels: [] };
    }

    const tagCounts = {};
    likedList.forEach(item => {
        const tags = getUnifiedTags(item['分類'] || '');
        tags.forEach(tag => {
            if (tag !== '#その他') {
                tagCounts[tag] = (tagCounts[tag] || 0) + 1;
            }
        });
    });

    const sortedTags = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]);
    const topLabels = sortedTags.slice(0, 3).map(([tag]) => KANJI_CATEGORIES[tag]?.label || tag.replace('#', ''));

    if (topLabels.length === 0) {
        return { shortText: 'まだ傾向なし', detailText: '漢字をためると傾向が見えてきます。', topLabels: [] };
    }

    return {
        shortText: topLabels.slice(0, 2).join(' / '),
        detailText: `漢字候補は「${topLabels.join(' / ')}」に寄っています。`,
        topLabels: topLabels
    };
}

function getHomeCollectionBreakdown(likedList, readingStockCount) {
    const safeLiked = Array.isArray(likedList) ? likedList : [];
    const directSwipeCount = safeLiked.filter(item => item?.sessionReading === 'FREE').length;
    const readingDerivedCount = safeLiked.filter(item => {
        const sessionReading = item?.sessionReading || '';
        return item?.slot >= 0 && !['FREE', 'SEARCH', 'RANKING', 'SHARED', 'UNKNOWN'].includes(sessionReading);
    }).length;

    return {
        readingStockCount: readingStockCount || 0,
        readingDerivedCount,
        directSwipeCount
    };
}

function getRoleLabel(role, fallback = 'パートナー') {
    if (role === 'mama') return 'ママ';
    if (role === 'papa') return 'パパ';
    return fallback;
}

function getInviteTargetLabel(myRole) {
    if (myRole === 'mama') return 'パパ';
    if (myRole === 'papa') return 'ママ';
    return 'パートナー';
}


const HOME_PAIR_CARD_DISMISSED_KEY = 'meimay_home_pair_card_dismissed_v1';


function isHomePairCardDismissed() {
    try {
        return localStorage.getItem(HOME_PAIR_CARD_DISMISSED_KEY) === 'true';
    } catch (e) {
        return false;
    }
}

function dismissHomePairCard(event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    try {
        localStorage.setItem(HOME_PAIR_CARD_DISMISSED_KEY, 'true');
    } catch (e) { }
    renderHomeProfile();
}

function restoreHomePairCard() {
    try {
        localStorage.removeItem(HOME_PAIR_CARD_DISMISSED_KEY);
    } catch (e) { }
    renderHomeProfile();
}


function handleHomeNextStepAction(event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }

    const likedCount = (typeof liked !== 'undefined' && liked) ? liked.length : 0;
    const readingStock = (typeof getReadingStock === 'function') ? getReadingStock() : [];
    const readingStockCount = readingStock.length;
    const savedList = (typeof getSavedNames === 'function') ? getSavedNames() : (window.savedNames || []);
    const pairing = getPairingHomeSummary();
    const nextStep = getHomeNextStep(likedCount, readingStockCount, savedList.length, pairing);

    closeHomeInsightsModal();
    runHomeAction(nextStep.action);
}

function handleHomeTodoAction(action, event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    closeHomeInsightsModal();
    runHomeAction(action);
}

function closeHomeInsightsModal() {
    document.getElementById('home-insights-modal')?.remove();
}

async function copyHomePairCode(event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }

    const code = typeof MeimayPairing !== 'undefined' ? MeimayPairing.roomCode : '';
    if (!code) return;

    try {
        if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(code);
            if (typeof showToast === 'function') showToast(`コード ${code} をコピーしました`, '📋');
            return;
        }
    } catch (e) { }

    if (typeof showToast === 'function') showToast(`ルームコード: ${code}`, '📋');
}

async function handleHomePairAction() {
    const pairing = getPairingHomeSummary();

    if (!pairing.inRoom) {
        changeScreen('scr-login');
        return;
    }

    if (!pairing.hasPartner) {
        if (typeof MeimayPairing !== 'undefined' && MeimayPairing.shareCode) {
            MeimayPairing.shareCode();
        } else {
            changeScreen('scr-login');
        }
        return;
    }

    if (pairing.matchedNameCount > 0 && typeof openSavedNames === 'function') {
        openSavedNames();
        return;
    }

    if (pairing.matchedKanjiCount > 0) {
        changeScreen('scr-stock');
        if (typeof renderStock === 'function') renderStock();
        return;
    }

    if (typeof MeimayShare !== 'undefined') {
        if (MeimayShare.shareLiked) await MeimayShare.shareLiked(true);
        if (MeimayShare.shareSavedNames) await MeimayShare.shareSavedNames(true);
    }
    if (typeof showToast === 'function') showToast('候補をパートナーに同期しました', '📤');
}

function closeKanjiDetail() {
    const modal = document.getElementById('modal-kanji-detail');
    if (modal) modal.classList.remove('active');
    if (typeof updateSwipeMainState === 'function') updateSwipeMainState();

    if (typeof _lastSavedDetailIndex === 'number' && _lastSavedDetailIndex !== null) {
        const scrSaved = document.getElementById('scr-saved');
        if (scrSaved && scrSaved.classList.contains('active')) {
            const index = _lastSavedDetailIndex;
            const source = typeof _lastSavedDetailSource === 'string' && _lastSavedDetailSource ? _lastSavedDetailSource : 'own';
            _lastSavedDetailIndex = null;
            _lastSavedDetailSource = 'own';
            if (typeof showSavedNameDetail === 'function') {
                showSavedNameDetail(index, source);
            }
        }
    }
}

window.closeKanjiDetail = closeKanjiDetail;
window.closeHomeInsightsModal = closeHomeInsightsModal;
window.handleHomePairAction = handleHomePairAction;
window.handleHomeNextStepAction = handleHomeNextStepAction;
window.handleHomeTodoAction = handleHomeTodoAction;
window.dismissHomePairCard = dismissHomePairCard;
window.restoreHomePairCard = restoreHomePairCard;
window.copyHomePairCode = copyHomePairCode;

// 初期化時にも呼ばれるようにする
setTimeout(() => {
    const curScreen = document.querySelector('.screen.active');
    if (curScreen && curScreen.id === 'scr-mode') {
        renderHomeProfile();
    }
}, 500);
function updateSwipeMainState() {
    const actionBtns = document.getElementById('swipe-action-btns');
    const sessionContent = document.getElementById('main-session-content');
    const emptyState = document.getElementById('main-empty-state');

    const hasSession = isFreeSwipeMode || (segments && segments.length > 0);
    const hasCards = hasSession && stack && stack.length > 0 && currentIdx < stack.length;

    if (emptyState) emptyState.classList.toggle('hidden', hasSession);
    if (sessionContent) sessionContent.classList.toggle('hidden', !hasSession);
    if (actionBtns) actionBtns.classList.toggle('hidden', !hasCards);

    const indicator = document.getElementById('pos-indicator');
    const btnPrev = document.getElementById('btn-prev-char');
    const btnNext = document.getElementById('btn-next-char');
    const isLastSlot = !isFreeSwipeMode && Array.isArray(segments) && segments.length > 0 && currentPos >= segments.length - 1;

    if (isFreeSwipeMode) {
        if (indicator) indicator.innerText = '自由に選ぶ';
        if (btnPrev) {
            btnPrev.classList.remove('opacity-0', 'pointer-events-none');
            btnPrev.innerHTML = '&lt; 戻る';
            btnPrev.onclick = () => {
                isFreeSwipeMode = false;
                changeScreen('scr-vibe');
            };
        }
        if (btnNext) {
            btnNext.classList.remove('opacity-0', 'pointer-events-none');
            btnNext.innerHTML = '完了 &gt;';
            btnNext.onclick = () => {
                isFreeSwipeMode = false;
                if (typeof openBuildFreeMode === 'function') openBuildFreeMode();
                else openBuild();
            };
        }
        return;
    }

    if (window._addMoreFromBuild && isLastSlot) {
        if (btnPrev) btnPrev.classList.add('opacity-0', 'pointer-events-none');
        if (btnNext) {
            btnNext.classList.remove('opacity-0', 'pointer-events-none');
            btnNext.innerHTML = 'ビルドへ &gt;';
            btnNext.onclick = () => {
                window._addMoreFromBuild = false;
                openBuild();
            };
        }
    }
}

function getHomeTodoRecommendations(likedCount, readingStock, savedCount, pairing) {
    const safeReadingStock = Array.isArray(readingStock) ? readingStock : [];
    const readingStockCount = safeReadingStock.length;
    const breakdown = getHomeCollectionBreakdown(typeof liked !== 'undefined' ? liked : [], readingStockCount);
    const todos = [];

    if (readingStockCount === 0) {
        todos.push({
            label: 'まずは読み候補を探す',
            detail: '読みがまだ決まっていないので、響きや呼びやすさから候補を集めましょう。',
            action: 'sound'
        });
    } else {
        todos.push({
            label: '読み候補から漢字を探す',
            detail: `読み候補が ${readingStockCount} 件あります。次は読みごとに漢字を集める段階です。`,
            action: 'reading'
        });
    }

    if (breakdown.readingDerivedCount >= 2 && savedCount === 0) {
        todos.push({
            label: '集まった漢字で名前を作る',
            detail: '読みから集めた漢字が増えてきたので、ビルドで最初の名前候補を作りましょう。',
            action: 'build'
        });
    } else if (readingStockCount > 0) {
        todos.push({
            label: '読みごとの漢字候補を増やす',
            detail: 'まだ材料が少ない読みがあるので、読みから漢字をもう少し広げるのがおすすめです。',
            action: 'reading'
        });
    }

    if (savedCount >= 2) {
        todos.push({
            label: '保存した候補を見比べる',
            detail: '候補が複数あるので、比較しながら絞り込みを進められます。',
            action: 'saved'
        });
    } else if (savedCount === 1) {
        todos.push({
            label: '比較用にもう1案つくる',
            detail: '保存した名前が1件だけなので、もう1案あると比較しやすくなります。',
            action: 'build'
        });
    }

    if (pairing?.inRoom && !pairing?.hasPartner) {
        todos.push({
            label: `${pairing.inviteTargetLabel}にコードを共有する`,
            detail: '相手が入ると、一致した漢字や名前が自動で見え始めます。',
            action: 'pair'
        });
    } else if (pairing?.hasPartner && ((pairing?.matchedKanjiCount || 0) + (pairing?.matchedNameCount || 0) === 0)) {
        todos.push({
            label: 'パートナーと候補を増やす',
            detail: 'お互いの候補が増えるほど、一致や共通の好みが見えやすくなります。',
            action: 'pair'
        });
    }

    if (likedCount >= 4 && readingStockCount === 0) {
        todos.push({
            label: '直感で集めた漢字を読み候補につなげる',
            detail: '直感スワイプの材料が増えているので、本流の読み候補にもつなげると進めやすいです。',
            action: 'sound'
        });
    }

    return todos.slice(0, 3);
}

window.updateSwipeMainState = updateSwipeMainState;

function getDefaultHomePairJoinRole() {
    if (typeof MeimayPairing !== 'undefined' && (MeimayPairing.myRole === 'mama' || MeimayPairing.myRole === 'papa')) {
        return MeimayPairing.myRole;
    }

    try {
        if (typeof WizardData !== 'undefined' && typeof WizardData.get === 'function') {
            const wizard = WizardData.get();
            if (wizard?.role === 'mama' || wizard?.role === 'papa') {
                return wizard.role;
            }
        }
    } catch (e) { }

    return null;
}

function getHomePairJoinRoleText() {
    const role = getDefaultHomePairJoinRole();
    if (role === 'mama') return 'ママとして参加';
    if (role === 'papa') return 'パパとして参加';
    return '役割を選んで参加';
}

function toggleHomePairJoinRow(event, forceOpen = null) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }

    const row = document.getElementById('home-pair-join-row');
    const input = document.getElementById('home-pair-quick-input');
    if (!row) return;

    const willOpen = typeof forceOpen === 'boolean' ? forceOpen : row.classList.contains('hidden');
    row.classList.toggle('hidden', !willOpen);

    if (willOpen && input) {
        setTimeout(() => input.focus(), 0);
    }
}

async function handleHomePairQuickJoin(event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }

    const input = document.getElementById('home-pair-quick-input');
    const code = input?.value?.trim();
    if (!code) {
        if (typeof showToast === 'function') showToast('コードを入力してください', '⚠️');
        return;
    }

    const role = getDefaultHomePairJoinRole();
    if (!role) {
        if (typeof showToast === 'function') showToast('参加前にママ / パパを選んでください', '⚠️');
        if (typeof changeScreen === 'function') changeScreen('scr-login');
        return;
    }

    try {
        if (typeof MeimayPairing !== 'undefined' && typeof MeimayPairing.selectJoinRole === 'function') {
            MeimayPairing.selectJoinRole(role);
        } else if (typeof MeimayPairing !== 'undefined') {
            MeimayPairing._selectedJoinRole = role;
        }

        const result = typeof MeimayPairing !== 'undefined' && typeof MeimayPairing.joinRoom === 'function'
            ? await MeimayPairing.joinRoom(code)
            : { success: false, error: '連携機能を読み込めませんでした' };

        if (result.success) {
            if (input) input.value = '';
            toggleHomePairJoinRow(null, false);
            if (typeof renderHomeProfile === 'function') renderHomeProfile();
            if (typeof showToast === 'function') showToast('パートナーと連携しました', '💞');
        } else if (result.error && typeof showToast === 'function') {
            showToast(result.error, '⚠️');
        }
    } catch (e) {
        if (typeof showToast === 'function') showToast('コード入力に失敗しました', '⚠️');
    }
}


window.toggleHomePairJoinRow = toggleHomePairJoinRow;
window.handleHomePairQuickJoin = handleHomePairQuickJoin;

/* ============================================================
   HOME SCREEN
   Consolidated home implementation.
   ============================================================ */

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

function parseHomeChildDate(value) {
    const raw = String(value || '').trim();
    const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (match) {
        const year = Number(match[1]);
        const month = Number(match[2]);
        const day = Number(match[3]);
        const date = new Date(year, month - 1, day);
        if (date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day) {
            return date;
        }
        return null;
    }

    const date = new Date(raw);
    return Number.isNaN(date.getTime()) ? null : date;
}

function formatHomeChildDate(date) {
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}

function getHomeActiveChildDateValue() {
    try {
        if (typeof MeimayChildWorkspaces !== 'undefined'
            && MeimayChildWorkspaces
            && typeof MeimayChildWorkspaces.getActiveChild === 'function') {
            const activeChild = MeimayChildWorkspaces.getActiveChild();
            const childDate = String(activeChild?.meta?.dueDate || activeChild?.meta?.birthDate || '').trim();
            if (childDate) return childDate;
        }
    } catch (e) { }

    return getWizardHomeState().dueDate || '';
}

function getHomeChildDateLabel() {
    const date = parseHomeChildDate(getHomeActiveChildDateValue());
    if (!date) return '';

    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const dateStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const label = dateStart.getTime() > todayStart.getTime() ? '予定日' : '誕生日';
    return `${label} ${formatHomeChildDate(dateStart)}`;
}

function renderHomeChildDateLabel() {
    const labelEl = document.getElementById('home-child-date-label');
    if (!labelEl) return;

    const label = getHomeChildDateLabel();
    labelEl.textContent = label;
    labelEl.classList.toggle('hidden', !label);
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
    // 描画を後回しにしてレスポンス優先
    setTimeout(() => {
        if (typeof renderSavedScreen === 'function') renderSavedScreen();
    }, 10);
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

    // 描画処理を後回しにして、画面遷移を即座に行う
    setTimeout(() => {
        if ((tab || 'kanji') === 'reading') {
            if (typeof renderReadingStockSection === 'function') renderReadingStockSection();
        } else if (typeof renderStock === 'function') {
            renderStock();
        }
    }, 10);
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

// 高速化のためのキャッシュとインデックス
const _homeBuildPatternCountCache = new Map();

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

function getHomeDataStateFingerprint(pool, readingStock) {
    // タイムスタンプ(updatedAt)に依存すると、保存のたびにキャッシュが壊れる可能性があるため、
    // データの「件数」と「IDの並び」をベースにした、より安定した指紋を使用する。
    const poolCount = Array.isArray(pool) ? pool.length : 0;
    const readingCount = Array.isArray(readingStock) ? readingStock.length : 0;

    // 内容のハッシュ代わりとして、最初と最後の要素の情報を少し混ぜる
    const poolHint = poolCount > 0 ? (pool[0]?.['漢字'] || pool[0]?.kanji || '') + (pool[poolCount-1]?.['漢字'] || '') : '';
    const readingHint = readingCount > 0 ? (readingStock[0]?.reading || '') + (readingStock[readingCount-1]?.reading || '') : '';

    return `v2_${poolCount}_${readingCount}_${poolHint}_${readingHint}`;
}

function getHomeBuildPatternKey(reading, segments) {
    const normalizedReading = normalizeHomeBuildReadingValue(reading);
    const normalizedSegments = sanitizeHomeBuildSegments(segments)
        .map(segment => normalizeHomeBuildReadingValue(segment))
        .filter(Boolean);
    return `${normalizedReading}::${normalizedSegments.join('/')}`;
}

function getHomeBuildSlotCandidateCount(pool, segment, slotIndex, reading, poolIndex) {
    const normalizedReading = normalizeHomeBuildReadingValue(reading);
    const normalizedSegment = normalizeHomeBuildReadingValue(segment);
    if (!normalizedSegment) return 0;

    // インデックスがあればそれを使用（超高速）
    if (poolIndex) {
        const slotKey = `${slotIndex}::${normalizedReading}`;
        const slotMatches = poolIndex.bySlot.get(slotKey) || new Set();
        const segmentMatches = poolIndex.bySegment.get(normalizedSegment) || new Set();

        // 和集合のサイズを計算（重複を排除）
        const combined = new Set([...slotMatches, ...segmentMatches]);
        return combined.size;
    }

    // インデックスがない場合のフォールバック（低速）
    const matchedKanji = new Set();
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

    if (!Array.isArray(readingStock) || readingStock.length === 0 || pool.length === 0) {
        return 0;
    }

    // キャッシュチェック
    const fingerprint = getHomeDataStateFingerprint(pool, readingStock);
    const cacheKey = `${fingerprint}_${!!candidatePoolOverride}_${!!readingStockOverride}`;
    if (_homeBuildPatternCountCache.has(cacheKey)) {
        return _homeBuildPatternCountCache.get(cacheKey);
    }

    // プールのインデックス化（一度だけ実行して使い回す）
    const poolIndex = {
        bySlot: new Map(), // Map<slotKey, Set<kanji>>
        bySegment: new Map() // Map<segment, Set<kanji>>
    };

    pool.forEach(item => {
        const kanji = item?.['漢字'] || item?.kanji || '';
        if (!kanji) return;

        // 1. スロット一致用
        const itemReading = normalizeHomeBuildReadingValue(item?.sessionReading || '');
        const itemSlot = Number.isFinite(Number(item?.slot)) ? Number(item.slot) : -1;
        if (itemSlot >= 0) {
            const slotKey = `${itemSlot}::${itemReading}`;
            if (!poolIndex.bySlot.has(slotKey)) poolIndex.bySlot.set(slotKey, new Set());
            poolIndex.bySlot.get(slotKey).add(kanji);
        }

        // 2. セグメント一致用
        const itemSegments = Array.isArray(item?.sessionSegments) ? item.sessionSegments : [];
        const itemSegment = itemSlot >= 0 && itemSlot < itemSegments.length
            ? itemSegments[itemSlot]
            : (item?.sessionReading && !String(item.sessionReading).includes('::') && !String(item.sessionReading).includes('/')
                ? item.sessionReading
                : '');
        const normalizedItemSegment = normalizeHomeBuildReadingValue(itemSegment);
        if (normalizedItemSegment) {
            if (!poolIndex.bySegment.has(normalizedItemSegment)) poolIndex.bySegment.set(normalizedItemSegment, new Set());
            poolIndex.bySegment.get(normalizedItemSegment).add(kanji);
        }

        // 3. 汎用読み用
        const rawReadings = String(item?.kanji_reading || item?.reading || '')
            .split(/[、,，\s/]+/)
            .map(value => normalizeHomeBuildReadingValue(value))
            .filter(Boolean);
        const generalSource = ['free', 'search', 'ranking', 'shared', 'unknown'].includes(itemReading);
        if (generalSource) {
            rawReadings.forEach(r => {
                if (!poolIndex.bySegment.has(r)) poolIndex.bySegment.set(r, new Set());
                poolIndex.bySegment.get(r).add(kanji);
            });
        }
    });

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
            patterns.set(key, { reading: baseReading, segments });
        }
    };

    readingStock.forEach((item) => {
        registerPattern(
            item?.reading || item?.sessionReading || '',
            Array.isArray(item?.segments) && item.segments.length > 0 ? item.segments : item?.sessionSegments
        );
    });

    let total = 0;
    patterns.forEach((pattern) => {
        let combinations = 1;
        for (let index = 0; index < pattern.segments.length; index++) {
            const segment = pattern.segments[index];
            // 高速化したインデックス版を使用
            const candidateCount = getHomeBuildSlotCandidateCount(pool, segment, index, pattern.reading, poolIndex);
            if (candidateCount === 0) {
                combinations = 0;
                break;
            }
            combinations *= candidateCount;
        }
        total += combinations;
    });

    // キャッシュに保存
    if (_homeBuildPatternCountCache.size > 50) _homeBuildPatternCountCache.clear();
    _homeBuildPatternCountCache.set(cacheKey, total);

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
            actionText: 'ビルドへ＞',
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
    const isPaired = !!(pairing && pairing.roomCode);

    // デフォルトでは「自分のアイテム」を取得
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
            return Array.isArray(savedSource) ? savedSource : [];
        })();
    const ownReadingItems = pairInsights?.getOwnReadingStock
        ? pairInsights.getOwnReadingStock()
        : ((typeof getReadingStock === 'function') ? getReadingStock() : []);

    // 連携時はマージされた（自分＋パートナーの）総数を表示に利用する
    const displayLikedCount = isPaired && typeof getMergedLikedCandidates === 'function'
        ? getMergedLikedCandidates().length
        : ownLikedItems.length;

    const displaySavedCount = isPaired && typeof getMergedSavedNames === 'function'
        ? getMergedSavedNames().length
        : ownSavedItems.length;

    const displayReadingCount = isPaired && pairInsights?.getPartnerReadingStock
        ? (() => {
            const merged = new Set(ownReadingItems.map(it => it.id || it.reading));
            pairInsights.getPartnerReadingStock().forEach(it => merged.add(it.id || it.reading));
            return merged.size;
        })()
        : ownReadingItems.length;

    return {
        pairInsights,
        pairing,
        ownLikedItems,
        ownSavedItems,
        ownReadingItems,
        ownLikedCount: displayLikedCount,
        ownSavedCount: displaySavedCount,
        ownReadingCount: displayReadingCount
    };
}

function getHomeNextStep(likedCount, readingStockCount, savedCount, pairing) {
    const wizard = getWizardHomeState();
    const buildCount = typeof getHomeBuildPatternCount === 'function' ? getHomeBuildPatternCount() : 0;

    if ((pairing?.matchedNameCount || 0) >= 1) {
        return {
            title: '二人とも気になっている名前があります',
            detail: '保存した名前の中に一致候補があります。まずは二人で残した候補を見比べましょう。',
            actionLabel: '一致した名前を見る',
            action: 'matched-saved'
        };
    }
    if ((pairing?.matchedReadingCount || 0) >= 1) {
        return {
            title: '二人とも気になっている読みがあります',
            detail: '同じ読みから名前を広げられます。まずは一致した読みを確認しましょう。',
            actionLabel: '一致した読みを見る',
            action: 'matched-reading'
        };
    }
    if ((pairing?.matchedKanjiCount || 0) >= 1) {
        return {
            title: '二人とも残した漢字があります',
            detail: '共通して気になった漢字から、名前候補をビルドしやすくなっています。',
            actionLabel: '一致した漢字を見る',
            action: 'matched-liked'
        };
    }
    if (savedCount > 0) {
        return {
            title: '保存した候補を見比べましょう',
            detail: '候補が残っています。響き、漢字、印象を見比べながら絞り込めます。',
            actionLabel: '候補を見る',
            action: 'saved'
        };
    }
    if (buildCount > 0) {
        return {
            title: 'ビルドした名前を保存しましょう',
            detail: '名前候補ができています。残したいものを保存すると、あとで比較しやすくなります。',
            actionLabel: 'ビルドへ',
            action: 'build'
        };
    }
    if (readingStockCount === 0 && wizard.hasReadingCandidate) {
        return {
            title: '読み候補から漢字を探しましょう',
            detail: '候補にしている読みを起点に、名前に使いたい漢字を集めます。',
            actionLabel: '漢字を探す',
            action: 'reading'
        };
    }
    if (readingStockCount === 0) {
        return {
            title: 'まずは響きから探しましょう',
            detail: '好きな響きや呼びたい音から、名前の読み候補を集めます。',
            actionLabel: '響きを探す',
            action: 'sound'
        };
    }
    if (likedCount < 2) {
        return {
            title: '読み候補に合う漢字を集めましょう',
            detail: '気になる読みができています。次はその読みで使える漢字を選びます。',
            actionLabel: '漢字を探す',
            action: 'reading'
        };
    }
    return {
        title: '集めた漢字で名前をビルドしましょう',
        detail: '読みと漢字がそろってきました。組み合わせを作って、残したい名前を保存します。',
        actionLabel: 'ビルドへ',
        action: 'build'
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
        activeKey === 'build' ? 'ビルドする段階です' :
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

function getHomeStageTrackMetric(stepKey, likedCount, readingStockCount, savedCount, options = {}) {
    const buildPatternCount = Number.isFinite(Number(options.buildCount))
        ? Number(options.buildCount)
        : getHomeBuildPatternCount();
    const actionLabels = options.actionLabels || {};

    if (stepKey === 'reading') {
        return {
            countNumber: String(readingStockCount),
            countUnit: '件',
            actionText: actionLabels.reading || (readingStockCount > 0 ? '読みを見る' : '読みを探す')
        };
    }
    if (stepKey === 'kanji') {
        return {
            countNumber: String(likedCount),
            countUnit: '字',
            actionText: actionLabels.kanji || (likedCount > 0 ? '漢字を見る' : '漢字を探す')
        };
    }
    if (stepKey === 'build') {
        return {
            countNumber: String(buildPatternCount),
            countUnit: '通り',
            actionText: actionLabels.build || 'ビルドへ',
            compact: true
        };
    }
    return {
        countNumber: String(savedCount),
        countUnit: '件',
        actionText: actionLabels.save || '候補を見る'
    };
}

function getHomeStageTrackTimeline(likedCount, readingStockCount, savedCount, options = {}) {
    const buildPatternCount = Number.isFinite(Number(options.buildCount))
        ? Number(options.buildCount)
        : getHomeBuildPatternCount();
    const steps = [
        { key: 'reading', label: '読み', done: readingStockCount >= 1 },
        { key: 'kanji', label: '漢字', done: likedCount >= 2 },
        { key: 'build', label: 'ビルド', done: buildPatternCount >= 1 },
        { key: 'save', label: '保存', done: savedCount >= 1 }
    ];
    const activeKey = savedCount >= 1
        ? 'save'
        : buildPatternCount >= 1
            ? 'build'
            : likedCount >= 2
                ? 'kanji'
                : 'reading';
    const stageTitle = activeKey === 'save'
        ? '候補を見比べる段階'
        : activeKey === 'build'
            ? 'ビルドする段階'
            : activeKey === 'kanji'
                ? '漢字を集める段階'
                : '読みを探す段階';

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
        if (typeof changeScreen === 'function') changeScreen('scr-login');
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

    if (savedCount > 0) return '保存した候補を見比べながら、残したい名前を絞り込んでいます。';
    if (buildPatternCount > 0) return 'ビルドした候補を確認し、保存する名前を選ぶ段階です。';
    if (likedCount > 0) return '集めた漢字をもとに、名前の組み合わせを広げていく段階です。';
    if (readingStockCount > 0) return '読み候補をもとに、合う漢字を集めているところです。';
    return 'まずは読み候補を集めて、名前の方向性を見つけましょう。';
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

    let result = null;
    if (mode === 'shared') {
        const aggregateReadingStock = [...ownReadingStock, ...partnerReadingStock];
        const aggregateBuildCount = getHomeBuildPatternCount(undefined, aggregateReadingStock);
        const aggregateFallbackAction = (aggregateCounts.readingStockCount > 0 || wizard.hasReadingCandidate) ? 'reading' : 'sound';
        result = {
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
                build: 'ビルドへ＞',
                save: '候補を見る＞'
            }
        };
    } else if (mode === 'partner') {
        const partnerBuildCount = getHomeBuildPatternCount(partnerLikedItemsVisible, partnerReadingStock);
        result = {
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
                build: 'ビルドへ＞',
                save: '候補を見る＞'
            }
        };
    } else {
        const ownBuildCount = getHomeBuildPatternCount(ownLikedItems, ownReadingStock);
        const selfFallbackAction = (ownReadingCount > 0 || wizard.hasReadingCandidate) ? 'reading' : 'sound';
        result = {
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
    // aggregateCountsを後続で使えるように付与しておく
    result.aggregateCounts = aggregateCounts;
    return result;
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
    const stageSnapshot = getHomeOverviewStageSnapshot(likedCount, readingStockCount, savedCount, pairing);
    stageSnapshot.recommendedKey = getHomeOverviewInitialStageKey(stageSnapshot, nextStep);

    const screen = document.getElementById('scr-mode');
    const heroCard = document.getElementById('home-hero-card');
    const toolGrid = document.getElementById('home-tool-grid');
    if (screen) {
        screen.style.paddingLeft = '12px';
        screen.style.paddingRight = '12px';
    }

    const summaryPanel = document.getElementById('home-summary-panel');
    if (summaryPanel) summaryPanel.classList.remove('hidden');
    if (heroCard) heroCard.style.cssText = '';

    renderHomeOverviewSwitch(pairing);
    renderHomeChildDateLabel();
    renderHomeStageTrack(stageSnapshot.likedCount, stageSnapshot.readingStockCount, stageSnapshot.savedCount, stageSnapshot);

    const elSaved = document.getElementById('home-liked-name-count');
    if (elSaved) elSaved.innerText = stageSnapshot.savedCount;

    const elKanji = document.getElementById('home-liked-kanji-count');
    if (elKanji) elKanji.innerText = stageSnapshot.likedCount;

    const elReadingStock = document.getElementById('home-reading-stock-count');
    if (elReadingStock) elReadingStock.innerText = stageSnapshot.readingStockCount;

    const overviewMount = document.getElementById('home-overview-mount');
    if (overviewMount) {
        overviewMount.innerHTML = '';
        overviewMount.classList.add('hidden');
    }

    if (toolGrid) toolGrid.classList.remove('hidden');


    const elPrefSummary = document.getElementById('home-preference-summary');
    if (elPrefSummary) elPrefSummary.innerText = preference.shortText || 'まだ傾向なし';
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
    // 即時ではなく予約実行にする
    if (typeof requestRenderHomeProfile === 'function') {
        requestRenderHomeProfile();
    } else if (typeof renderHomeProfile === 'function') {
        renderHomeProfile();
    }
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

function getHomeOverviewModel(pairing, nextStep, aggregateCounts) {
    const mode = getHomeOverviewMode(pairing);
    const counts = pairing?.counts || {
        own: { reading: 0, kanji: 0, saved: 0 },
        partner: { reading: 0, kanji: 0, saved: 0 },
        matched: { reading: pairing?.matchedReadingCount || 0, kanji: pairing?.matchedKanjiCount || 0, saved: pairing?.matchedNameCount || 0 }
    };
    const tone = getHomeOverviewTone(mode);

    if (mode === 'shared' && aggregateCounts) {
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
    renderHomeChildDateLabel();

    const overview = getHomeOverviewModel(pairing, nextStep, stageSnapshot.aggregateCounts);
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
                        <div class="text-[9px] font-black tracking-[0.16em]" style="color:${overview.tone.sub}">段階</div>
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
                    <div class="text-[10px] font-black tracking-[0.18em] text-[#b9965b]">次にやること</div>
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
                    <div class="text-[10px] font-black tracking-[0.18em] text-[#b9965b]">進み具合</div>
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
        .replace(/[ \t]+/g, ' ')
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
        config.title = 'ビルドする';
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
            <button id="home-next-action-card" type="button" onclick="event.stopPropagation(); runHomeAction('${cardConfig.action}')" class="mt-3 flex w-full items-center justify-between gap-3 rounded-[20px] border border-[#eadfce] bg-white px-5 py-5 text-left active:scale-[0.98] transition-transform shadow-sm" style="${highlightStyle}">
                <div class="min-w-0 flex-1">
                    <span class="block text-[1.08rem] font-black leading-tight text-[#5d5444] md:text-[1.14rem]">${cardConfig.title}</span>
                    <span class="mt-2 block text-[12px] leading-[1.7] text-[#8b7e66] md:text-[13px]">${cardConfig.detailHtml}</span>
                </div>
                <span class="shrink-0 text-[30px] leading-none" aria-hidden="true">${cardConfig.icon || '⚒️'}</span>
            </button>
        `;
    }

    return `
        <button id="home-next-action-card" type="button" onclick="event.stopPropagation(); runHomeAction('${cardConfig.action}')" class="mt-3 wiz-gender-btn wiz-reading-choice w-full shadow-sm" style="${highlightStyle}">
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

    const primaryActionStageKey = getHomeRecommendedStageKey(focusCopy.primaryAction) || focusKey;
    const primaryDetailHtml = focusCopy.primaryAction === 'sound'
        ? '好きな響きから<br>読み候補を探します'
        : focusCopy.primaryAction === 'reading'
            ? '希望の読みから<br>合う漢字を探します'
            : primaryActionStageKey === 'build'
                ? '集めた読みと漢字から<br>名前候補を作ります'
                : primaryActionStageKey === 'save'
                    ? '候補を見返して<br>名前を絞り込みます'
                    : '今の候補を見返して<br>次に進めます';
    const actionCardConfig = {
        action: focusCopy.primaryAction,
        title: focusCopy.primaryLabel,
        detailHtml: primaryDetailHtml,
        previewHtml: getHomeNextStagePreviewHtml(primaryActionStageKey),
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
                ? 'いまのビルド候補を見返します'
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
                        ${step.selected ? `<div class="mt-auto pt-1 text-[7px] font-black text-center whitespace-nowrap leading-none md:pt-2 md:text-[9px]" style="color:${tone.sub};">今ここ</div>` : ''}
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
                <div class="text-[12px] font-black tracking-[0.18em] text-[#b9965b]">💡次にやること</div>
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

    if (window.MeimayHomeStageFocusSource !== 'manual' && typeof maybeShowHomeNextActionCoach === 'function') {
        maybeShowHomeNextActionCoach({
            action: actionCardConfig.action,
            title: actionCardConfig.title,
            detail: String(actionCardConfig.detailHtml || '').replace(/<br\s*\/?>/gi, '、')
        });
    }
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


function buildHomeStageStatusCopy(stageKey, likedCount, readingStockCount, savedCount, pairing, options = {}) {
    const readingCount = Math.max(0, Number(readingStockCount) || 0);
    const kanjiCount = Math.max(0, Number(likedCount) || 0);
    const savedTotal = Math.max(0, Number(savedCount) || 0);
    const wizard = getWizardHomeState();
    const hasWizardReadingCandidate = wizard.hasReadingCandidate === true;
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
    const copy = {
        stageLabel: '',
        mainText: '',
        statusLines: [],
        chips: [],
        primaryAction: 'sound',
        primaryLabel: '響きを探す',
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

    const readingEmptyLines = hasWizardReadingCandidate
        ? [
            '読み候補がある状態です。',
            'まずはその読みで使いたい漢字を探しましょう。'
        ]
        : [
            '名づけはまだ最初の段階です。',
            '気になる響きをいくつか残すと、次に漢字を選べます。'
        ];

    if (stageKey === 'reading') {
        const isReadingEmpty = readingCount === 0;
        const statusLines = readingCount === 0
            ? readingEmptyLines
            : readingCount <= 9
                ? [
                    '読み候補が集まってきています。',
                    '気になる読みを見返しながら、さらに候補を広げられます。'
                ]
                : [
                    '読み候補はしっかり集まっています。',
                    '次は使いたい読みを選び、漢字探しに進みましょう。'
                ];

        return setCopy(
            '読み',
            isReadingEmpty && hasWizardReadingCandidate ? 'reading' : 'sound',
            isReadingEmpty
                ? (hasWizardReadingCandidate ? '漢字を探す' : '響きを探す')
                : '響きを探す',
            statusLines,
            [{ label: '読み', value: readingCount, unit: '件' }],
            readingCount > 0
                ? 'stock-reading'
                : (hasWizardReadingCandidate ? 'sound' : ''),
            readingCount > 0 ? '集めた読みを見る' : '響きも探す'
        );
    }

    if (stageKey === 'kanji') {
        const statusLines = (() => {
            if (readingCount === 0 && kanjiCount === 0) return readingEmptyLines;
            if (readingCount === 0 && kanjiCount > 0) {
                return [
                    '漢字候補はありますが、読み候補がまだありません。',
                    '読みを決めると、集めた漢字を名前作りに活かしやすくなります。'
                ];
            }
            if (readingCount > 0 && kanjiCount === 0) {
                return [
                    'まだ漢字候補はありません。',
                    '気になる読みから、名前に使いたい漢字を集めましょう。'
                ];
            }
            if (unresolvedReadingCount > 0) {
                return [
                    '漢字候補が集まってきています。',
                    `まだ漢字を選んでいない読みが${unresolvedReadingCount}件あります。そこから候補を広げましょう。`
                ];
            }
            return [
                '漢字候補はしっかり集まっています。',
                '次は読みと漢字を組み合わせて、名前候補を作りましょう。'
            ];
        })();

        return setCopy(
            '漢字',
            'reading',
            '漢字を探す',
            statusLines,
            [
                { label: '漢字', value: kanjiCount, unit: '字' },
                { label: '未選択の読み', value: unresolvedReadingCount, unit: '件' }
            ],
            kanjiCount > 0 ? 'stock' : '',
            '集めた漢字を見る'
        );
    }

    if (stageKey === 'build') {
        const statusLines = (() => {
            if (buildCount >= 6) {
                return [
                    '名前候補をしっかりビルドできています。',
                    '候補を見比べながら、残したい名前を保存しましょう。'
                ];
            }
            if (buildCount >= 1) {
                return [
                    '名前候補ができています。',
                    'さらに組み合わせを増やすか、気になる名前を保存しましょう。'
                ];
            }
            if (readingCount > 0 && kanjiCount > 0) {
                return [
                    '読みと漢字がそろってきました。',
                    '集めた材料から、名前候補をビルドできます。'
                ];
            }
            if (readingCount > 0 && kanjiCount === 0) {
                return [
                    'まだ漢字候補がありません。',
                    '先に読みへ合う漢字を集めると、名前をビルドできます。'
                ];
            }
            return readingEmptyLines;
        })();

        return setCopy(
            'ビルド',
            'build',
            'ビルドへ',
            statusLines,
            [
                { label: '読み', value: readingCount, unit: '件' },
                { label: '漢字', value: kanjiCount, unit: '字' },
                { label: '組み合わせ', value: buildCount, unit: '通り' }
            ]
        );
    }

    const statusLines = (() => {
        if (savedCanvasState?.matched) {
            return [
                '二人の本命が一致しています。',
                '大切な候補として、理由や印象も一緒に見返しましょう。'
            ];
        }
        if (savedTotal >= 4) {
            return [
                '保存した候補がしっかり集まっています。',
                '似た響きや漢字を見比べながら、残したい名前を整理しましょう。'
            ];
        }
        if (savedTotal >= 1) {
            return [
                '保存した候補があります。',
                '比較しながら、もう少し候補を増やすか絞り込むかを決められます。'
            ];
        }
        if (buildCount > 0) {
            return [
                'まだ保存した名前はありません。',
                'ビルドした候補の中から、残したい名前を保存しましょう。'
            ];
        }
        if (readingCount > 0 && kanjiCount > 0) {
            return [
                'まだ保存した名前はありません。',
                'まずは名前をビルドして、残したい候補を保存しましょう。'
            ];
        }
        if (readingCount > 0 && kanjiCount === 0) {
            return [
                'まだ保存した名前はありません。',
                '先に読みへ合う漢字を集めて、候補作りに進みましょう。'
            ];
        }
        return readingEmptyLines;
    })();

    return setCopy(
        '保存',
        'saved',
        '候補を見る',
        statusLines,
        [{ label: '保存', value: savedTotal, unit: '件' }]
    );
}

function getHomeStageFocusCopy(stageKey, likedCount, readingStockCount, savedCount, pairing, options = {}) {
    return buildHomeStageStatusCopy(stageKey, likedCount, readingStockCount, savedCount, pairing, options);
}

function getHomeStagePanelCopy(stageKey, likedCount, readingStockCount, savedCount, pairing, options = {}) {
    return buildHomeStageStatusCopy(stageKey, likedCount, readingStockCount, savedCount, pairing, options);
}

console.log("UI RENDER: Module loaded (home consolidated)");
