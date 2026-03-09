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
function updateSwipeMainState() {
    const actionBtns = document.getElementById('swipe-action-btns');
    const sessionContent = document.getElementById('main-session-content');
    const emptyState = document.getElementById('main-empty-state');

    const hasSession = isFreeSwipeMode || (segments && segments.length > 0);
    const hasCards = hasSession && stack && stack.length > 0 && currentIdx < stack.length;

    if (emptyState) emptyState.classList.toggle('hidden', hasSession);
    if (sessionContent) sessionContent.classList.toggle('hidden', !hasSession);
    if (actionBtns) actionBtns.classList.toggle('hidden', !hasCards);

    // モード別HUDボタン制御
    const indicator = document.getElementById('pos-indicator');
    const btnPrev = document.getElementById('btn-prev-char');
    const btnNext = document.getElementById('btn-next-char');

    if (isFreeSwipeMode) {
        // 自由に選ぶ: 戻る(→イメージ選択) + 完了(→ビルド/自由組み立て)
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
    } else if (window._addMoreFromBuild) {
        // ビルドからの追加: 「ビルドへ」ボタンを右側に表示
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
    if (!stack || stack.length === 0 || currentIdx >= stack.length) {
        if (isFreeSwipeMode) {
            container.innerHTML = `
                <div class="flex items-center justify-center h-full text-center px-6">
                    <div>
                        <p class="text-[#bca37f] font-bold text-lg mb-4">すべて確認しました</p>
                        <p class="text-sm text-[#a6967a] mb-6">ビルドへ進んで名前を組み立てよう</p>
                        <button onclick="isFreeSwipeMode=false; openBuildFreeMode()" class="btn-gold py-4 px-8">ビルドへ →</button>
                    </div>
                </div>
            `;
            return;
        }

        // addMoreToSlot から来た場合 / 最後の文字スロットの場合 → ビルドへ
        const goToBuild = window._addMoreFromBuild || currentPos >= segments.length - 1;
        container.innerHTML = `
            <div class="flex items-center justify-center h-full text-center px-6">
                <div>
                    <p class="text-[#bca37f] font-bold text-lg mb-4">候補がありません</p>
                    <p class="text-sm text-[#a6967a] mb-6">設定を変更するか、<br>次の文字に進んでください</p>
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

    // カードは最大6個（読みが多い漢字でレイアウト崩れを防ぐ）
    const MAX_CARD_READINGS = 6;
    const cardReadings = allReadings.slice(0, MAX_CARD_READINGS);
    // マッチした読みが6個以内にない場合は6個目と入れ替え
    if (currentSearchReading) {
        const inCard = cardReadings.some(r => normalizeKana(r) === normalizeKana(currentSearchReading));
        if (!inCard) {
            const matchIdx = allReadings.findIndex(r => normalizeKana(r) === normalizeKana(currentSearchReading));
            if (matchIdx >= MAX_CARD_READINGS) cardReadings[MAX_CARD_READINGS - 1] = allReadings[matchIdx];
        }
    }
    const moreCount = Math.max(0, allReadings.length - MAX_CARD_READINGS);
    const readingsHTML = cardReadings.length > 0 ?
        cardReadings.map(r => {
            const isMatch = normalizeKana(r) === normalizeKana(currentSearchReading);
            return `<span class="px-2 py-1 ${isMatch ? 'bg-[#bca37f] text-white shadow-md ring-2 ring-[#bca37f] ring-offset-1' : 'bg-white bg-opacity-60 text-[#7a6f5a]'} rounded-lg text-xs font-bold transition-all shadow-sm">${r}</span>`;
        }).join(' ') + (moreCount > 0 ? ` <span class="text-[10px] text-[#bca37f] font-bold">他${moreCount}個</span>` : '') :
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
        <div class="flex-1 flex flex-col justify-center items-center px-4 w-full">
            ${tagsHTML ? `<div class="flex gap-2 mb-2 flex-wrap justify-center">${tagsHTML}</div>` : ''}
            
            <div class="text-[clamp(80px,18vh,110px)] font-black text-[#5d5444] leading-none mb-1">${data['漢字']}</div>
            
            <div class="text-[#bca37f] font-black text-lg mb-2">${data['画数']}画</div>
            
            ${readingsHTML ? `<div class="w-full flex gap-1.5 mb-2 flex-wrap justify-center content-start">${readingsHTML}</div>` : ''}
            
            <div class="w-full max-w-xs bg-white bg-opacity-70 rounded-2xl px-3 py-2 shadow-sm overflow-hidden min-h-0 flex items-center justify-center mt-auto mb-3 shrink-0">
                <p class="text-xs leading-relaxed text-[#7a6f5a] text-center line-clamp-3">${shortMeaning || '意味情報なし'}</p>
            </div>

            <div class="text-[9px] text-[#d4c5af] font-bold tracking-widest pb-1 opacity-80">タップで詳細 / スワイプで選択</div>
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
    console.log("RENDER: Card appended to container");

    updateSwipeCounter();
}

/**
 * スワイプカウンター更新
 */
function updateSwipeCounter() {
    const el = document.getElementById('swipe-counter');
    if (!el || !stack) return;

    if (isFreeSwipeMode) {
        const selected = liked.filter(item => item.sessionReading === 'FREE').length;
        el.innerText = `選:${selected}`;
        return;
    }

    const currentReading = segments.join('');
    const selected = liked.filter(item =>
        item.slot === currentPos &&
        (!item.sessionReading || item.sessionReading === currentReading)
    ).length;

    el.innerText = `選:${selected}`;
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
        headerReadingEl.innerHTML = `
            <div class="flex flex-col">
                <div class="text-[10px] font-bold text-[#bca37f] mb-0.5 tracking-widest flex items-center gap-1">
                    <span>📖</span> 読み・名乗り
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
    const isLiked = liked.some(l => l['漢字'] === data['漢字']);

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
            likeBtn.innerHTML = '<span>♥</span> LIKE';
            likeBtn.onclick = () => toggleStockFromModal(_currentDetailData, false, false);

            const superBtn = document.createElement('button');
            superBtn.className = 'flex-1 py-3 bg-gradient-to-r from-[#8ab4f8] to-[#c5d9ff] rounded-2xl text-sm font-bold text-white hover:shadow-md transition-all shadow-sm flex items-center justify-center gap-1 active:scale-95';
            superBtn.innerHTML = '<span>★</span> SUPER';
            superBtn.onclick = () => toggleStockFromModal(_currentDetailData, false, true);

            stockBtnsEl.appendChild(likeBtn);
            stockBtnsEl.appendChild(superBtn);
        }
    }

    // AI生成ボタン
    const existingAiBtn = modal.querySelector('#btn-ai-kanji-detail');
    if (existingAiBtn) existingAiBtn.remove();

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
    aiSection.innerHTML = `
        <button onclick="generateKanjiDetail('${data['漢字']}', ${currentReadingForAI ? `'${currentReadingForAI}'` : 'null'})"
                class="w-full py-4 bg-gradient-to-r from-[#8b7e66] to-[#bca37f] text-white font-bold rounded-2xl shadow-md hover:shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2 text-sm">
            <span>🤖</span> AIで漢字の成り立ち・意味を深掘り
        </button>
        <div id="ai-kanji-result" class="mt-3"></div>
    `;

    // 四字熟語の上に挿入
    const yojiWrapperAi = yojijukugoEl.parentNode;
    if (yojiWrapperAi && yojiWrapperAi.parentNode) {
        yojiWrapperAi.parentNode.insertBefore(aiSection, yojiWrapperAi);
    }

    // キャッシュ済みAI結果があれば自動表示
    if (typeof StorageBox !== 'undefined' && StorageBox.getKanjiAiCache) {
        const cached = StorageBox.getKanjiAiCache(data['漢字']);
        if (cached && cached.text && typeof renderKanjiDetailText === 'function') {
            const resultEl = document.getElementById('ai-kanji-result');
            if (resultEl) {
                renderKanjiDetailText(resultEl, cached.text, data['漢字'], currentReadingForAI);
            }
        }
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
            yojijukugoEl.innerHTML = '<p class="text-xs text-[#d4c5af] italic">関連するポジティブな言葉は見つかりませんでした</p>';
        }
    } else {
        yojijukugoEl.innerHTML = '<p class="text-xs text-[#d4c5af]">データ読み込み中...</p>';
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
            if (liked[i]['漢字'] === data['漢字']) {
                liked.splice(i, 1);
                removedCount++;
            }
        }

        if (removedCount > 0 && typeof MeimayStats !== 'undefined' && MeimayStats.recordKanjiUnlike) {
            MeimayStats.recordKanjiUnlike(data['漢字']);
        }

        if (removedCount > 0) {
            if (typeof StorageBox !== 'undefined' && StorageBox.saveLiked) StorageBox.saveLiked();

            const scrStock = document.getElementById('scr-stock');
            if (scrStock && scrStock.classList.contains('active') && typeof renderStock === 'function') {
                renderStock();
            }

            alert('ストックから外しました');
            closeKanjiDetail();
        }
    } else {
        // ストックに追加
        let sessionReading = 'FREE'; // 全てフリーストックとして扱う
        let slot = -1;
        let sessionSegments = null;

        // もしスワイプ画面からの追加なら文脈を引き継ぐ（表示中スロットに結びつける）
        const mainSwipeScreen = document.getElementById('scr-main');
        if (mainSwipeScreen && mainSwipeScreen.classList.contains('active') && segments && segments[currentPos]) {
            if (typeof isFreeSwipeMode !== 'undefined' && isFreeSwipeMode) {
                sessionReading = 'FREE';
                slot = -1;
            } else {
                sessionReading = segments.join('');
                slot = currentPos;
                sessionSegments = [...segments];
            }
        }

        const readingToSave = [data['音'], data['訓'], data['伝統名のり']].filter(x => x).join(',');

        const likeData = {
            ...data,
            timestamp: new Date().toISOString(),
            sessionReading: sessionReading,
            slot: slot,
            kanji_reading: readingToSave,
            isSuper: !!isSuper
        };
        if (sessionSegments) {
            likeData.sessionSegments = sessionSegments;
        }

        liked.push(likeData);
        if (typeof StorageBox !== 'undefined' && StorageBox.saveLiked) StorageBox.saveLiked();
        if (data && data['漢字'] && typeof MeimayStats !== 'undefined' && MeimayStats.recordKanjiLike) {
            MeimayStats.recordKanjiLike(data['漢字']);
        }

        // 漢字検索画面が表示中なら結果を即座に更新（❤アイコン反映）
        const scrSearch = document.getElementById('scr-kanji-search');
        if (scrSearch && scrSearch.classList.contains('active') && typeof executeKanjiSearch === 'function') {
            executeKanjiSearch();
        }

        alert(isSuper ? '★スーパーライクでストックに追加しました！' : '♥ライクでストックに追加しました！');
        closeKanjiDetail();
    }
}

/**
 * 漢字詳細モーダルを閉じる
 */
function closeKanjiDetail() {
    const modal = document.getElementById('modal-kanji-detail');
    if (modal) modal.classList.remove('active');
    // スワイプ画面なら×★♡ボタンを復元
    if (typeof updateSwipeMainState === 'function') updateSwipeMainState();

    // もし保存済み詳細から開いていたなら、詳細画面に戻す
    if (typeof _lastSavedDetailIndex === 'number' && _lastSavedDetailIndex !== null) {
        const scrSaved = document.getElementById('scr-saved');
        if (scrSaved && scrSaved.classList.contains('active')) {
            const index = _lastSavedDetailIndex;
            _lastSavedDetailIndex = null; // 1度戻ったらクリア（連鎖防止）
            if (typeof showSavedNameDetail === 'function') {
                showSavedNameDetail(index);
            }
        }
    }
}

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

function getHomeCollectionSummaryText(readingStock) {
    const safeStock = Array.isArray(readingStock) ? readingStock : [];
    const tagCounts = {};

    safeStock.forEach(item => {
        const tags = Array.isArray(item?.tags) ? item.tags : [];
        tags.forEach(tag => {
            if (!tag) return;
            tagCounts[tag] = (tagCounts[tag] || 0) + 1;
        });
    });

    if (Object.keys(tagCounts).length === 0 && typeof getReadingHistory === 'function') {
        const history = getReadingHistory().slice(0, 8);
        history.forEach(entry => {
            const tags = Array.isArray(entry?.settings?.imageTags) ? entry.settings.imageTags : [];
            tags.forEach(tag => {
                if (!tag) return;
                tagCounts[tag] = (tagCounts[tag] || 0) + 1;
            });
        });
    }

    const topTags = Object.entries(tagCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 2)
        .map(([tag]) => tag.startsWith('#') ? tag : `#${tag}`);

    if (topTags.length > 0) {
        return topTags.join(' ');
    }

    return safeStock.length > 0 ? `読み候補 ${safeStock.length}件` : 'まだ読み候補なし';
}

function getHomeTodoRecommendations(likedCount, readingStock, savedCount, pairing) {
    const safeReadingStock = Array.isArray(readingStock) ? readingStock : [];
    const readingStockCount = safeReadingStock.length;
    const breakdown = getHomeCollectionBreakdown(typeof liked !== 'undefined' ? liked : [], readingStockCount);
    const todos = [];

    if (readingStockCount === 0) {
        todos.push({
            label: '響き・読みを探して候補をためる',
            detail: 'まずは呼びたい響きを2〜3件ためると進めやすくなります。',
            action: 'sound'
        });
    } else {
        todos.push({
            label: '読み候補から漢字を選ぶ',
            detail: `読み候補が ${readingStockCount}件 あるので、次は漢字を探していきましょう。`,
            action: 'reading'
        });
    }

    if (breakdown.readingDerivedCount >= 2) {
        todos.push({
            label: '集まった漢字で名前を組み立てる',
            detail: '気になる漢字が集まってきたら、ビルドで組み合わせを見てみましょう。',
            action: 'build'
        });
    } else if (readingStockCount > 0) {
        todos.push({
            label: '読みごとの漢字候補を増やす',
            detail: 'まだ漢字が少ない読みがあるので、読みから漢字をもう少し広げるのがおすすめです。',
            action: 'reading'
        });
    }

    if (savedCount >= 2) {
        todos.push({
            label: '保存した候補を見比べる',
            detail: '保存名が2件以上あるので、比較しながら絞り込めます。',
            action: 'saved'
        });
    } else if (savedCount === 1) {
        todos.push({
            label: '保存候補をもう1つ増やす',
            detail: '比較しやすくするため、もう1件くらい保存しておくと判断しやすくなります。',
            action: 'build'
        });
    }

    if (pairing?.inRoom && !pairing?.hasPartner) {
        todos.push({
            label: `${pairing.inviteTargetLabel}にコードを共有する`,
            detail: 'パートナーが参加すると、一致漢字や一致名が見られるようになります。',
            action: 'pair'
        });
    } else if (pairing?.hasPartner && ((pairing?.matchedKanjiCount || 0) + (pairing?.matchedNameCount || 0) === 0)) {
        todos.push({
            label: 'パートナーに候補を同期する',
            detail: 'お互いの候補が増えると、一致が出やすくなります。',
            action: 'pair'
        });
    }

    if (likedCount >= 4 && readingStockCount === 0) {
        todos.push({
            label: '直感で集めた漢字を参考に読みを決める',
            detail: '直感スワイプは補助導線なので、次は読みを固めると本流が進みます。',
            action: 'sound'
        });
    }

    return todos.slice(0, 3);
}

function getPairingHomeSummary() {
    const baseSummary = (typeof window.MeimayPartnerInsights !== 'undefined' && window.MeimayPartnerInsights.getSummary)
        ? window.MeimayPartnerInsights.getSummary()
        : null;
    const roomCode = typeof MeimayPairing !== 'undefined' ? MeimayPairing.roomCode : null;
    const myRoleLabel = getRoleLabel(typeof MeimayPairing !== 'undefined' ? MeimayPairing.myRole : null, '自分');
    const inviteTargetLabel = getInviteTargetLabel(typeof MeimayPairing !== 'undefined' ? MeimayPairing.myRole : null);

    const summary = {
        inRoom: false,
        hasPartner: false,
        partnerLabel: 'パートナー',
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
            actionLabel: '連携する'
        };
    }

    if (!summary.hasPartner) {
        return {
            ...summary,
            shortText: '連携待ち',
            title: `${summary.myRoleLabel}としてルームを作成済みです`,
            subtitle: `${summary.inviteTargetLabel}にコードを送ると一致が見られます。`,
            footnote: `${summary.inviteTargetLabel}にコードを送りましょう。`,
            actionLabel: 'コード共有'
        };
    }

    const totalMatches = summary.matchedKanjiCount + summary.matchedNameCount;
    if (totalMatches > 0) {
        const previewText = summary.previewLabels && summary.previewLabels.length > 0
            ? summary.previewLabels.slice(0, 3).join(' ・ ')
            : '一致候補を確認しましょう';
        return {
            ...summary,
            shortText: `${summary.partnerLabel}と連携中`,
            title: summary.matchedNameCount > 0 ? 'おふたりで同じ名前に反応しています' : '気になる漢字が重なっています',
            subtitle: previewText,
            footnote: summary.matchedNameCount > 0 ? '保存候補から第一候補を絞れます。' : '一致した漢字から広げると進めやすいです。',
            actionLabel: '一致を見る'
        };
    }

    return {
        ...summary,
        shortText: `${summary.partnerLabel}と連携中`,
        title: `${summary.partnerLabel}と連携中です`,
        subtitle: 'まだ一致はありません。候補をためると見えてきます。',
        footnote: '候補を同期すると一致が更新されます。',
        actionLabel: '候補を同期'
    };
}

const HOME_PAIR_CARD_DISMISSED_KEY = 'meimay_home_pair_card_dismissed_v1';

function canDismissHomePairCard(pairing) {
    const totalMatches = (pairing?.matchedKanjiCount || 0) + (pairing?.matchedNameCount || 0);
    return !pairing?.inRoom && !pairing?.hasPartner && totalMatches === 0;
}

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

function getHomeNextStep(likedCount, readingStockCount, savedCount, pairing) {
    const breakdown = getHomeCollectionBreakdown(typeof liked !== 'undefined' ? liked : [], readingStockCount);

    if ((pairing?.matchedNameCount || 0) >= 2) {
        return {
            title: '一致した候補を比べる段階です',
            detail: 'おふたりで一致した名前が2件以上あります。',
            actionLabel: '保存済みを見る',
            action: 'saved'
        };
    }

    if ((pairing?.matchedKanjiCount || 0) >= 2) {
        return {
            title: '一致した漢字から広げられます',
            detail: '共通で気になった漢字をストックから見直せます。',
            actionLabel: 'ストックを見る',
            action: 'stock'
        };
    }

    if (savedCount >= 3) {
        return {
            title: '保存候補を絞り込める段階です',
            detail: '保存名が3件以上あるので比較に進めます。',
            actionLabel: '保存済みを見る',
            action: 'saved'
        };
    }

    if (breakdown.readingStockCount >= 1 && breakdown.readingDerivedCount < 2) {
        return {
            title: '読み候補から漢字を探す',
            detail: `読み候補が ${breakdown.readingStockCount}件 あるので、次は漢字を選んでいきましょう。`,
            actionLabel: '読みから漢字を探す',
            action: 'reading'
        };
    }

    if (breakdown.readingDerivedCount >= 3) {
        return {
            title: '名前を組み立て始められます',
            detail: '読みから集まった漢字でビルドに進めます。',
            actionLabel: 'ビルドへ進む',
            action: 'build'
        };
    }

    if (breakdown.directSwipeCount >= 1 && breakdown.readingStockCount === 0) {
        return {
            title: '読み候補を先に決める',
            detail: 'まず読みを決めると、漢字を選びやすくなります。',
            actionLabel: '響き・読みを探す',
            action: 'sound'
        };
    }

    if (likedCount >= 4 && breakdown.readingStockCount === 0) {
        return {
            title: '読み候補を探す',
            detail: '読みが決まると、漢字探しとビルドが進めやすくなります。',
            actionLabel: '響き・読みを探す',
            action: 'sound'
        };
    }

    return {
        title: '読み候補を探す',
        detail: '読みが決まっていないので、まずは響き・読みから始めましょう。',
        actionLabel: '響き・読みを探す',
        action: 'sound'
    };
}

function runHomeAction(action) {
    if (action === 'saved' && typeof openSavedNames === 'function') {
        openSavedNames();
        return;
    }

    if (action === 'stock') {
        changeScreen('scr-stock');
        if (typeof renderStock === 'function') renderStock();
        return;
    }

    if (action === 'build') {
        if (typeof openBuild === 'function') {
            openBuild();
        } else {
            changeScreen('scr-build');
        }
        return;
    }

    if (action === 'free' && typeof startDirectKanjiSwipe === 'function') {
        startDirectKanjiSwipe();
        return;
    }

    if (action === 'pair') {
        handleHomePairAction();
        return;
    }

    if (action === 'sound') {
        if (typeof startMode === 'function') {
            startMode('sound');
        }
        return;
    }

    if (action === 'reading') {
        if (typeof startMode === 'function') {
            startMode('reading');
        } else {
            changeScreen('scr-input-reading');
        }
    }
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

function openHomeInsightsModalFromEvent(event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    openHomeInsightsModal();
}

function renderHomeProfile() {
    let swipedCount = 0;
    try {
        const histRaw = localStorage.getItem('meimay_reading_history');
        if (histRaw) {
            const histList = JSON.parse(histRaw);
            swipedCount = histList.length * 8;
        }
    } catch (e) { }

    const likedCount = (typeof liked !== 'undefined' && liked) ? liked.length : 0;
    swipedCount += likedCount;
    const savedList = (typeof getSavedNames === 'function') ? getSavedNames() : (window.savedNames || []);
    const savedCount = savedList.length;
    const readingStock = (typeof getReadingStock === 'function') ? getReadingStock() : [];
    const readingStockCount = readingStock.length;
    const preference = getHomePreferenceSummary(liked);
    const pairing = getPairingHomeSummary();
    const nextStep = getHomeNextStep(likedCount, readingStockCount, savedCount, pairing);
    const showPairCard = !canDismissHomePairCard(pairing) || !isHomePairCardDismissed();

    const elSwiped = document.getElementById('home-swiped-count');
    if (elSwiped) elSwiped.innerText = swipedCount + '個';

    const elSaved = document.getElementById('home-liked-name-count');
    if (elSaved) elSaved.innerText = savedCount;

    const elKanji = document.getElementById('home-liked-kanji-count');
    if (elKanji) elKanji.innerText = likedCount;

    const elReadingStock = document.getElementById('home-reading-stock-count');
    if (elReadingStock) elReadingStock.innerText = readingStockCount;


    const elPrefHidden = document.getElementById('home-preference-tags');
    if (elPrefHidden) elPrefHidden.innerText = preference.shortText;

    const elPrefSummary = document.getElementById('home-preference-summary');
    if (elPrefSummary) elPrefSummary.innerText = preference.shortText;

    const elPartnerSummary = document.getElementById('home-partner-summary');
    if (elPartnerSummary) elPartnerSummary.innerText = pairing.shortText;

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
    if (pairActionBtn) pairActionBtn.innerText = pairing.actionLabel;

    const pairCodeRow = document.getElementById('home-pair-code-row');
    if (pairCodeRow) pairCodeRow.classList.toggle('hidden', !pairing.inRoom || !pairing.roomCode || pairing.hasPartner);

    const pairCodeEl = document.getElementById('home-pair-room-code');
    if (pairCodeEl) pairCodeEl.innerText = pairing.roomCode || '------';

    const nextStepTitleEl = document.getElementById('home-next-step-title');
    if (nextStepTitleEl) nextStepTitleEl.innerText = nextStep.title;

    const nextStepDetailEl = document.getElementById('home-next-step-detail');
    if (nextStepDetailEl) nextStepDetailEl.innerText = nextStep.detail;

    const nextStepActionLabelEl = document.getElementById('home-next-step-action-label');
    if (nextStepActionLabelEl) nextStepActionLabelEl.innerText = nextStep.actionLabel;

    const collectionSummaryEl = document.getElementById('home-collection-summary');
    if (collectionSummaryEl) collectionSummaryEl.innerText = getHomeCollectionSummaryText(readingStock);

    const pairCard = document.getElementById('home-pair-card');
    if (pairCard) pairCard.classList.toggle('hidden', !showPairCard);

    const dismissBtn = document.getElementById('home-pair-dismiss');
    if (dismissBtn) dismissBtn.classList.toggle('hidden', !canDismissHomePairCard(pairing));

    const restoreBtn = document.getElementById('home-pair-restore');
    if (restoreBtn) restoreBtn.classList.toggle('hidden', showPairCard || !canDismissHomePairCard(pairing));
}

function openHomeInsightsModal() {
    closeHomeInsightsModal();

    const savedList = (typeof getSavedNames === 'function') ? getSavedNames() : (window.savedNames || []);
    const likedCount = (typeof liked !== 'undefined' && liked) ? liked.length : 0;
    const readingStock = (typeof getReadingStock === 'function') ? getReadingStock() : [];
    const readingStockCount = readingStock.length;
    const preference = getHomePreferenceSummary(liked);
    const pairing = getPairingHomeSummary();
    const nextStep = getHomeNextStep(likedCount, readingStockCount, savedList.length, pairing);
    const todoRecommendations = getHomeTodoRecommendations(likedCount, readingStock, savedList.length, pairing);
    const readingTrend = getHomeCollectionSummaryText(readingStock);

    const breakdown = getHomeCollectionBreakdown(liked, readingStockCount);
    const previewList = pairing.previewLabels && pairing.previewLabels.length > 0
        ? pairing.previewLabels.map(label => `<span class="px-3 py-1.5 rounded-full bg-[#fdf7ef] border border-[#eee5d8] text-[11px] font-bold text-[#5d5444]">${label}</span>`).join('')
        : '<div class="text-[11px] text-[#a6967a]">一致候補が見つかると、ここに表示されます。</div>';
    const pairCodeHtml = pairing.roomCode && !pairing.hasPartner
        ? `<div class="mt-3 inline-flex items-center gap-2 rounded-full border border-[#eee5d8] bg-[#fffaf2] px-3 py-1.5 text-[11px] font-bold text-[#5d5444]">ルームコード ${pairing.roomCode}</div>`
        : '';
    const todoHtml = todoRecommendations.map(item => `
        <button onclick="handleHomeTodoAction('${item.action}', event)" class="w-full text-left rounded-2xl border border-[#eee5d8] bg-white px-4 py-3 active:scale-[0.99] transition-transform">
            <div class="text-[12px] font-bold text-[#5d5444]">${item.label}</div>
            <div class="mt-1 text-[11px] text-[#8b7e66] leading-relaxed">${item.detail}</div>
        </button>
    `).join('');

    const modal = document.createElement('div');
    modal.id = 'home-insights-modal';
    modal.className = 'overlay active';
    modal.innerHTML = `
        <div class="detail-sheet max-w-md max-h-[82vh] overflow-y-auto" onclick="event.stopPropagation()">
            <button class="modal-close-btn" onclick="closeHomeInsightsModal()">✕</button>
            <div class="pt-4 pb-2">
                <div class="text-[10px] font-black tracking-[0.18em] text-[#b9965b] uppercase mb-2">ホーム</div>
                <h3 class="text-xl font-black text-[#4f4639] mb-2">いまの状況</h3>
                <p class="text-sm text-[#8b7e66] leading-relaxed">候補の集まり具合と、次のおすすめを確認できます。</p>
            </div>
            <div class="mt-4 rounded-2xl border border-[#eee5d8] bg-[#fff9f0] p-4">
                <div class="text-[10px] font-black tracking-[0.18em] text-[#b9965b] uppercase mb-2">次のおすすめ</div>
                <div class="text-sm font-bold text-[#5d5444]">${nextStep.title}</div>
                <div class="text-[11px] text-[#8b7e66] mt-2 leading-relaxed">${nextStep.detail}</div>
                <button onclick="handleHomeNextStepAction(event)" class="mt-3 w-full py-3 rounded-2xl bg-[#b9965b] text-white text-sm font-bold shadow-sm">${nextStep.actionLabel}</button>
            </div>
            <div class="mt-3 rounded-2xl border border-[#eee5d8] bg-white p-4">
                <div class="text-[10px] font-black tracking-[0.18em] text-[#b9965b] uppercase mb-2">次のやること</div>
                <div class="space-y-2">${todoHtml}</div>
            </div>
            <div class="grid grid-cols-3 gap-2 mt-3">
                <div class="bg-[#fdfaf5] rounded-2xl p-3 text-center border border-[#eee5d8]">
                    <div class="text-xl font-black text-[#5d5444]">${likedCount}</div>
                    <div class="text-[10px] text-[#a6967a] mt-1">漢字ストック</div>
                </div>
                <div class="bg-[#fdfaf5] rounded-2xl p-3 text-center border border-[#eee5d8]">
                    <div class="text-xl font-black text-[#5d5444]">${readingStockCount}</div>
                    <div class="text-[10px] text-[#a6967a] mt-1">読みストック</div>
                </div>
                <div class="bg-[#fdfaf5] rounded-2xl p-3 text-center border border-[#eee5d8]">
                    <div class="text-xl font-black text-[#5d5444]">${savedList.length}</div>
                    <div class="text-[10px] text-[#a6967a] mt-1">保存名</div>
                </div>
            </div>
            <div class="mt-3 rounded-2xl border border-[#eee5d8] bg-white p-4">
                <div class="text-[10px] font-black tracking-[0.18em] text-[#b9965b] uppercase mb-2">読み候補の進み具合</div>
                <div class="grid grid-cols-3 gap-2">
                    <div class="rounded-2xl bg-[#fdfaf5] px-3 py-3 text-center">
                        <div class="text-lg font-black text-[#5d5444]">${breakdown.readingStockCount}</div>
                        <div class="text-[10px] text-[#a6967a] mt-1">読み候補</div>
                    </div>
                    <div class="rounded-2xl bg-[#fdfaf5] px-3 py-3 text-center">
                        <div class="text-lg font-black text-[#5d5444]">${breakdown.readingDerivedCount}</div>
                        <div class="text-[10px] text-[#a6967a] mt-1">読みから漢字</div>
                    </div>
                    <div class="rounded-2xl bg-[#fdfaf5] px-3 py-3 text-center">
                        <div class="text-lg font-black text-[#5d5444]">${breakdown.directSwipeCount}</div>
                        <div class="text-[10px] text-[#a6967a] mt-1">直感から漢字</div>
                    </div>
                </div>
                <div class="mt-3 text-[11px] font-bold text-[#5d5444]">${readingTrend}</div>
                <div class="mt-1 text-[11px] text-[#8b7e66] leading-relaxed">${readingStockCount > 0 ? '読み候補があるので、次は読みごとに漢字を集めると進めやすいです。' : 'まだ読みが決まっていないので、まずは響きや呼びやすさから候補をためるのがおすすめです。'}</div>
            </div>

            <div class="mt-3 rounded-2xl border border-[#eee5d8] bg-white p-4">
                <div class="text-[10px] font-black tracking-[0.18em] text-[#9d8cbc] uppercase mb-2">漢字の傾向</div>
                <div class="text-sm font-bold text-[#5d5444]">${preference.shortText}</div>
                <div class="text-[11px] text-[#8b7e66] mt-2 leading-relaxed">${preference.detailText}</div>
            </div>
            <div class="mt-3 rounded-2xl border border-[#eee5d8] bg-white p-4">
                <div class="text-[10px] font-black tracking-[0.18em] text-[#88a3c5] uppercase mb-2">ペア状態</div>
                <div class="text-sm font-bold text-[#5d5444]">${pairing.title}</div>
                <div class="text-[11px] text-[#8b7e66] mt-2 leading-relaxed">${pairing.subtitle}</div>
                ${pairCodeHtml}
                <div class="flex flex-wrap gap-2 mt-3">${previewList}</div>
            </div>
        </div>
    `;
    modal.addEventListener('click', closeHomeInsightsModal);
    document.body.appendChild(modal);
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

window.renderHomeProfile = renderHomeProfile;
window.openHomeInsightsModal = openHomeInsightsModal;

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

window.toggleHomePairJoinRow = toggleHomePairJoinRow;
window.handleHomePairQuickJoin = handleHomePairQuickJoin;
window.renderHomeProfile = renderHomeProfile;
window.openHomeInsightsModal = openHomeInsightsModal;

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

    return getWizardHomeState().hasReadingCandidate
        ? '\u5019\u88dc\u3042\u308a'
        : '\u307e\u3060\u50be\u5411\u306a\u3057';
}

function getHomeNextStep(likedCount, readingStockCount, savedCount, pairing) {
    const breakdown = getHomeCollectionBreakdown(typeof liked !== 'undefined' ? liked : [], readingStockCount);
    const wizard = getWizardHomeState();

    if ((pairing?.matchedNameCount || 0) >= 1) {
        return {
            title: '\u4e00\u81f4\u3057\u305f\u540d\u524d\u3092\u898b\u76f4\u3059',
            detail: '\u3075\u305f\u308a\u3067\u4e00\u81f4\u3057\u305f\u5019\u88dc\u304c\u51fa\u3066\u304d\u3066\u3044\u307e\u3059\u3002\u4fdd\u5b58\u6e08\u307f\u3067\u6bd4\u8f03\u3057\u307e\u3057\u3087\u3046\u3002',
            actionLabel: '\u4fdd\u5b58\u6e08\u307f\u3092\u898b\u308b',
            action: 'saved'
        };
    }

    if ((pairing?.matchedKanjiCount || 0) >= 1) {
        return {
            title: '\u4e00\u81f4\u3057\u305f\u6f22\u5b57\u3092\u78ba\u304b\u3081\u308b',
            detail: '\u5171\u901a\u3067\u6c17\u306b\u306a\u3063\u305f\u6f22\u5b57\u304c\u51fa\u3066\u304d\u307e\u3057\u305f\u3002\u30b9\u30c8\u30c3\u30af\u304b\u3089\u898b\u76f4\u305b\u307e\u3059\u3002',
            actionLabel: '\u30b9\u30c8\u30c3\u30af\u3092\u898b\u308b',
            action: 'stock'
        };
    }

    if (savedCount >= 2) {
        return {
            title: '\u4fdd\u5b58\u3057\u305f\u540d\u524d\u3092\u6bd4\u8f03\u3059\u308b',
            detail: '\u6bd4\u8f03\u3067\u304d\u308b\u5019\u88dc\u304c\u305d\u308d\u3063\u3066\u304d\u307e\u3057\u305f\u3002\u4fdd\u5b58\u6e08\u307f\u304b\u3089\u898b\u6bd4\u3079\u307e\u3057\u3087\u3046\u3002',
            actionLabel: '\u4fdd\u5b58\u6e08\u307f\u3092\u898b\u308b',
            action: 'saved'
        };
    }

    if (readingStockCount === 0 && wizard.hasReadingCandidate) {
        return {
            title: '\u8aad\u307f\u5019\u88dc\u304b\u3089\u6f22\u5b57\u3092\u63a2\u3059',
            detail: '\u8aad\u307f\u306e\u65b9\u5411\u6027\u306f\u898b\u3048\u3066\u3044\u308b\u306e\u3067\u3001\u6b21\u306f\u8aad\u307f\u304b\u3089\u5408\u3046\u6f22\u5b57\u3092\u5897\u3084\u3057\u307e\u3057\u3087\u3046\u3002',
            actionLabel: '\u8aad\u307f\u304b\u3089\u6f22\u5b57\u3092\u63a2\u3059',
            action: 'reading'
        };
    }

    if (readingStockCount === 0) {
        return {
            title: '\u8aad\u307f\u5019\u88dc\u3092\u96c6\u3081\u308b',
            detail: '\u307e\u305a\u306f\u97ff\u304d\u3084\u30a4\u30e1\u30fc\u30b8\u304b\u3089\u3001\u6c17\u306b\u306a\u308b\u8aad\u307f\u3092\u898b\u3064\u3051\u307e\u3057\u3087\u3046\u3002',
            actionLabel: '\u97ff\u304d\u30fb\u8aad\u307f\u3092\u63a2\u3059',
            action: 'sound'
        };
    }

    if (breakdown.readingDerivedCount < 2) {
        return {
            title: '\u8aad\u307f\u304b\u3089\u6f22\u5b57\u5019\u88dc\u3092\u5897\u3084\u3059',
            detail: '\u8aad\u307f\u5019\u88dc\u304c\u305f\u307e\u3063\u3066\u304d\u305f\u306e\u3067\u3001\u6b21\u306f\u6f22\u5b57\u306e\u6750\u6599\u3092\u96c6\u3081\u308b\u6bb5\u968e\u3067\u3059\u3002',
            actionLabel: '\u8aad\u307f\u304b\u3089\u6f22\u5b57\u3092\u63a2\u3059',
            action: 'reading'
        };
    }

    if (savedCount === 1) {
        return {
            title: '\u3082\u30461\u6848\u3064\u304f\u3063\u3066\u6bd4\u8f03\u3059\u308b',
            detail: '\u4fdd\u5b58\u3057\u305f\u540d\u524d\u304c1\u4ef6\u3042\u308b\u306e\u3067\u3001\u3082\u30461\u6848\u5897\u3084\u3059\u3068\u6bd4\u8f03\u3057\u3084\u3059\u304f\u306a\u308a\u307e\u3059\u3002',
            actionLabel: '\u30d3\u30eb\u30c9\u3078',
            action: 'build'
        };
    }

    return {
        title: '\u30d3\u30eb\u30c9\u3067\u5019\u88dc\u3092\u307e\u3068\u3081\u308b',
        detail: '\u6750\u6599\u304c\u96c6\u307e\u3063\u3066\u304d\u305f\u306e\u3067\u3001\u540d\u524d\u3068\u3057\u3066\u7d44\u307f\u5408\u308f\u305b\u3092\u898b\u3066\u3044\u304d\u307e\u3057\u3087\u3046\u3002',
        actionLabel: '\u30d3\u30eb\u30c9\u3078',
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
window.openHomeInsightsModal = openHomeInsightsModal;

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
            detail: '共通で気になっている漢字があります。ストックから組み立てに進めます。',
            actionLabel: 'ストックを見る',
            action: 'stock'
        };
    }

    if (savedCount >= 2) {
        return {
            title: '比較しながら絞り込む',
            detail: '保存済みがそろってきたので、比較と見直しに進めます。',
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
            detail: '共通で気になっている漢字があります。ストックから組み立てに進めます。',
            actionLabel: 'ストックを見る',
            action: 'stock'
        };
    }

    if (savedCount >= 2) {
        return {
            title: '比較しながら絞り込む',
            detail: '保存済みがそろってきたので、比較と見直しに進めます。',
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
            detail: '共通で気になっている漢字があります。ストックから組み立てに進めます。',
            actionLabel: 'ストックを見る',
            action: 'stock'
        };
    }

    if (savedCount >= 2) {
        return {
            title: '比較しながら絞り込む',
            detail: '保存済みがそろってきたので、比較と見直しに進めます。',
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
window.openHomeInsightsModalFromEvent = openHomeInsightsModalFromEvent;
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

console.log("UI RENDER: Module loaded (v14.3 - Added renderHomeProfile)");

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

    return topTags.length > 0 ? topTags.join(' ') : 'まだ傾向なし';
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

function getPairingHomeSummary() {
    const baseSummary = (typeof window.MeimayPartnerInsights !== 'undefined' && window.MeimayPartnerInsights.getSummary)
        ? window.MeimayPartnerInsights.getSummary()
        : null;
    const roomCode = typeof MeimayPairing !== 'undefined' ? MeimayPairing.roomCode : null;
    const myRoleLabel = getRoleLabel(typeof MeimayPairing !== 'undefined' ? MeimayPairing.myRole : null, '自分');
    const inviteTargetLabel = getInviteTargetLabel(typeof MeimayPairing !== 'undefined' ? MeimayPairing.myRole : null);

    const summary = {
        inRoom: false,
        hasPartner: false,
        partnerLabel: 'パートナー',
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
            title: 'パートナーとはまだ連携していません',
            subtitle: 'ひとりでもそのまま使えます。必要になったら連携できます。',
            footnote: 'あとからでもルームを作成できます。',
            actionLabel: '連携を始める'
        };
    }

    if (!summary.hasPartner) {
        return {
            ...summary,
            shortText: '連携待ち',
            title: `${summary.myRoleLabel}としてルームを作成済みです`,
            subtitle: `${summary.inviteTargetLabel}にコードを共有すると、一致が見られるようになります。`,
            footnote: '共有後は自動で連携が始まります。',
            actionLabel: 'コードを共有'
        };
    }

    const totalMatches = summary.matchedKanjiCount + summary.matchedNameCount;
    if (totalMatches > 0) {
        const previewText = summary.previewLabels && summary.previewLabels.length > 0
            ? summary.previewLabels.slice(0, 3).join(' / ')
            : '一致した候補が見つかっています。';
        return {
            ...summary,
            shortText: `${summary.partnerLabel}と連携中`,
            title: summary.matchedNameCount > 0 ? '一致した名前候補があります' : '一致した漢字があります',
            subtitle: previewText,
            footnote: summary.matchedNameCount > 0 ? '保存済みから比較して絞り込みを進められます。' : '一致した漢字から名前候補へつなげられます。',
            actionLabel: '一致を見る'
        };
    }

    return {
        ...summary,
        shortText: `${summary.partnerLabel}と連携中`,
        title: `${summary.partnerLabel}と連携中です`,
        subtitle: 'まだ一致はありません。お互いに候補をためると共通点が見えてきます。',
        footnote: '保存やストックが増えると自動で更新されます。',
        actionLabel: '候補を共有する'
    };
}

function getHomeNextStep(likedCount, readingStockCount, savedCount, pairing) {
    const breakdown = getHomeCollectionBreakdown(typeof liked !== 'undefined' ? liked : [], readingStockCount);

    if ((pairing?.matchedNameCount || 0) >= 1) {
        return {
            title: '一致した名前候補を確認する',
            detail: 'ふたりで一致した候補が出てきました。保存済みから比較を始められます。',
            actionLabel: '保存済みを見る',
            action: 'saved'
        };
    }

    if ((pairing?.matchedKanjiCount || 0) >= 1) {
        return {
            title: '一致した漢字から広げる',
            detail: '共通で気になった漢字があります。ストックから名前候補へつなげやすい段階です。',
            actionLabel: 'ストックを見る',
            action: 'stock'
        };
    }

    if (readingStockCount === 0) {
        return {
            title: 'まずは読み候補を探す段階です',
            detail: '読みがまだ決まっていないので、響き・読みから始めるのがおすすめです。',
            actionLabel: '響き・読みを探す',
            action: 'sound'
        };
    }

    if (breakdown.readingDerivedCount <= 0) {
        return {
            title: '読み候補から漢字を探す段階です',
            detail: `読み候補が ${breakdown.readingStockCount} 件あります。次は読みごとに漢字候補を集めましょう。`,
            actionLabel: '読みから漢字を探す',
            action: 'reading'
        };
    }

    if (savedCount === 0) {
        return {
            title: '集まった漢字で名前を作る段階です',
            detail: '読みから集めた漢字がそろってきたので、ビルドで最初の名前候補を作りましょう。',
            actionLabel: 'ビルドへ進む',
            action: 'build'
        };
    }

    if (savedCount === 1) {
        return {
            title: '比較用にもう1案つくる段階です',
            detail: '保存した名前が1件あるので、もう1案あると比較しやすくなります。',
            actionLabel: 'ビルドでもう1案つくる',
            action: 'build'
        };
    }

    if (savedCount >= 2) {
        return {
            title: '保存した候補を見比べる段階です',
            detail: '候補が複数あるので、保存済みから比べながら絞り込みを進められます。',
            actionLabel: '保存済みを見る',
            action: 'saved'
        };
    }

    return {
        title: '次の候補を増やす段階です',
        detail: '読みと漢字の材料を少しずつ増やしながら、比較しやすい形に整えていきましょう。',
        actionLabel: '読みから漢字を探す',
        action: 'reading'
    };
}

function renderHomeProfile() {
    let swipedCount = 0;
    try {
        const histRaw = localStorage.getItem('meimay_reading_history');
        if (histRaw) {
            const histList = JSON.parse(histRaw);
            swipedCount = histList.length * 8;
        }
    } catch (e) { }

    const likedCount = (typeof liked !== 'undefined' && liked) ? liked.length : 0;
    swipedCount += likedCount;
    const savedList = (typeof getSavedNames === 'function') ? getSavedNames() : (window.savedNames || []);
    const savedCount = savedList.length;
    const readingStock = (typeof getReadingStock === 'function') ? getReadingStock() : [];
    const readingStockCount = readingStock.length;
    const preference = getHomePreferenceSummary(liked);
    const pairing = getPairingHomeSummary();
    const nextStep = getHomeNextStep(likedCount, readingStockCount, savedCount, pairing);
    const showPairCard = !canDismissHomePairCard(pairing) || !isHomePairCardDismissed();

    const elSwiped = document.getElementById('home-swiped-count');
    if (elSwiped) elSwiped.innerText = swipedCount + '枚';

    const elSaved = document.getElementById('home-liked-name-count');
    if (elSaved) elSaved.innerText = savedCount;

    const elKanji = document.getElementById('home-liked-kanji-count');
    if (elKanji) elKanji.innerText = likedCount;

    const elReadingStock = document.getElementById('home-reading-stock-count');
    if (elReadingStock) elReadingStock.innerText = readingStockCount;

    const elPrefHidden = document.getElementById('home-preference-tags');
    if (elPrefHidden) elPrefHidden.innerText = preference.shortText;

    const elPrefSummary = document.getElementById('home-preference-summary');
    if (elPrefSummary) elPrefSummary.innerText = preference.shortText;

    const elPartnerSummary = document.getElementById('home-partner-summary');
    if (elPartnerSummary) elPartnerSummary.innerText = pairing.shortText;

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
    if (pairActionBtn) pairActionBtn.innerText = pairing.actionLabel;

    const pairCodeRow = document.getElementById('home-pair-code-row');
    if (pairCodeRow) pairCodeRow.classList.add('hidden');

    const nextStepTitleEl = document.getElementById('home-next-step-title');
    if (nextStepTitleEl) nextStepTitleEl.innerText = nextStep.title;

    const nextStepDetailEl = document.getElementById('home-next-step-detail');
    if (nextStepDetailEl) nextStepDetailEl.innerText = nextStep.detail;

    const nextStepActionLabelEl = document.getElementById('home-next-step-action-label');
    if (nextStepActionLabelEl) nextStepActionLabelEl.innerText = nextStep.actionLabel;

    const collectionSummaryEl = document.getElementById('home-collection-summary');
    if (collectionSummaryEl) collectionSummaryEl.innerText = getHomeCollectionSummaryText(readingStock);

    const pairCard = document.getElementById('home-pair-card');
    if (pairCard) pairCard.classList.toggle('hidden', !showPairCard);

    const dismissBtn = document.getElementById('home-pair-dismiss');
    if (dismissBtn) dismissBtn.classList.toggle('hidden', !canDismissHomePairCard(pairing));

    const restoreBtn = document.getElementById('home-pair-restore');
    if (restoreBtn) restoreBtn.classList.toggle('hidden', showPairCard || !canDismissHomePairCard(pairing));
}

function openHomeInsightsModal() {
    closeHomeInsightsModal();

    const savedList = (typeof getSavedNames === 'function') ? getSavedNames() : (window.savedNames || []);
    const likedCount = (typeof liked !== 'undefined' && liked) ? liked.length : 0;
    const readingStock = (typeof getReadingStock === 'function') ? getReadingStock() : [];
    const readingStockCount = readingStock.length;
    const preference = getHomePreferenceSummary(liked);
    const pairing = getPairingHomeSummary();
    const nextStep = getHomeNextStep(likedCount, readingStockCount, savedList.length, pairing);
    const todoRecommendations = getHomeTodoRecommendations(likedCount, readingStock, savedList.length, pairing);
    const readingTrend = getHomeCollectionSummaryText(readingStock);
    const breakdown = getHomeCollectionBreakdown(liked, readingStockCount);
    const previewList = pairing.previewLabels && pairing.previewLabels.length > 0
        ? pairing.previewLabels.map(label => `<span class="px-3 py-1.5 rounded-full bg-[#fdf7ef] border border-[#eee5d8] text-[11px] font-bold text-[#5d5444]">${label}</span>`).join('')
        : '<div class="text-[11px] text-[#a6967a]">一致が出るとここに候補が表示されます。</div>';
    const todoHtml = todoRecommendations.map(item => `
        <button onclick="handleHomeTodoAction('${item.action}', event)" class="w-full text-left rounded-2xl border border-[#eee5d8] bg-white px-4 py-3 active:scale-[0.99] transition-transform">
            <div class="text-[12px] font-bold text-[#5d5444]">${item.label}</div>
            <div class="mt-1 text-[11px] text-[#8b7e66] leading-relaxed">${item.detail}</div>
        </button>
    `).join('');

    const modal = document.createElement('div');
    modal.id = 'home-insights-modal';
    modal.className = 'overlay active';
    modal.innerHTML = `
        <div class="detail-sheet max-w-md max-h-[82vh] overflow-y-auto" onclick="event.stopPropagation()">
            <button class="modal-close-btn" onclick="closeHomeInsightsModal()">×</button>
            <div class="pt-4 pb-2">
                <div class="text-[10px] font-black tracking-[0.18em] text-[#b9965b] uppercase mb-2">ホーム</div>
                <h3 class="text-xl font-black text-[#4f4639] mb-2">いまの状況</h3>
                <p class="text-sm text-[#8b7e66] leading-relaxed">候補の集まり具合と、次にやることを確認できます。</p>
            </div>
            <div class="mt-4 rounded-2xl border border-[#eee5d8] bg-[#fff9f0] p-4">
                <div class="text-[10px] font-black tracking-[0.18em] text-[#b9965b] uppercase mb-2">次のおすすめ</div>
                <div class="text-sm font-bold text-[#5d5444]">${nextStep.title}</div>
                <div class="text-[11px] text-[#8b7e66] mt-2 leading-relaxed">${nextStep.detail}</div>
                <button onclick="handleHomeNextStepAction(event)" class="mt-3 w-full py-3 rounded-2xl bg-[#b9965b] text-white text-sm font-bold shadow-sm">${nextStep.actionLabel}</button>
            </div>
            <div class="mt-3 rounded-2xl border border-[#eee5d8] bg-white p-4">
                <div class="text-[10px] font-black tracking-[0.18em] text-[#b9965b] uppercase mb-2">次のやること</div>
                <div class="space-y-2">${todoHtml}</div>
            </div>
            <div class="grid grid-cols-3 gap-2 mt-3">
                <div class="bg-[#fdfaf5] rounded-2xl p-3 text-center border border-[#eee5d8]">
                    <div class="text-xl font-black text-[#5d5444]">${likedCount}</div>
                    <div class="text-[10px] text-[#a6967a] mt-1">漢字ストック</div>
                </div>
                <div class="bg-[#fdfaf5] rounded-2xl p-3 text-center border border-[#eee5d8]">
                    <div class="text-xl font-black text-[#5d5444]">${readingStockCount}</div>
                    <div class="text-[10px] text-[#a6967a] mt-1">読みストック</div>
                </div>
                <div class="bg-[#fdfaf5] rounded-2xl p-3 text-center border border-[#eee5d8]">
                    <div class="text-xl font-black text-[#5d5444]">${savedList.length}</div>
                    <div class="text-[10px] text-[#a6967a] mt-1">保存した名前</div>
                </div>
            </div>
            <div class="mt-3 rounded-2xl border border-[#eee5d8] bg-white p-4">
                <div class="text-[10px] font-black tracking-[0.18em] text-[#b9965b] uppercase mb-2">読みの傾向</div>
                <div class="grid grid-cols-3 gap-2">
                    <div class="rounded-2xl bg-[#fdfaf5] px-3 py-3 text-center">
                        <div class="text-lg font-black text-[#5d5444]">${breakdown.readingStockCount}</div>
                        <div class="text-[10px] text-[#a6967a] mt-1">読み候補</div>
                    </div>
                    <div class="rounded-2xl bg-[#fdfaf5] px-3 py-3 text-center">
                        <div class="text-lg font-black text-[#5d5444]">${breakdown.readingDerivedCount}</div>
                        <div class="text-[10px] text-[#a6967a] mt-1">読みから漢字</div>
                    </div>
                    <div class="rounded-2xl bg-[#fdfaf5] px-3 py-3 text-center">
                        <div class="text-lg font-black text-[#5d5444]">${breakdown.directSwipeCount}</div>
                        <div class="text-[10px] text-[#a6967a] mt-1">直感の漢字</div>
                    </div>
                </div>
                <div class="mt-3 text-[11px] font-bold text-[#5d5444]">${readingTrend}</div>
                <div class="mt-1 text-[11px] text-[#8b7e66] leading-relaxed">${readingStockCount > 0 ? '読み候補があるので、次は読みごとに漢字を集めると進めやすいです。' : 'まだ読みが決まっていないので、まずは響きや呼びやすさから候補をためるのがおすすめです。'}</div>
            </div>
            <div class="mt-3 rounded-2xl border border-[#eee5d8] bg-white p-4">
                <div class="text-[10px] font-black tracking-[0.18em] text-[#9d8cbc] uppercase mb-2">漢字の傾向</div>
                <div class="text-sm font-bold text-[#5d5444]">${preference.shortText}</div>
                <div class="text-[11px] text-[#8b7e66] mt-2 leading-relaxed">${preference.detailText}</div>
            </div>
            <div class="mt-3 rounded-2xl border border-[#eee5d8] bg-white p-4">
                <div class="text-[10px] font-black tracking-[0.18em] text-[#88a3c5] uppercase mb-2">ペア状態</div>
                <div class="text-sm font-bold text-[#5d5444]">${pairing.title}</div>
                <div class="text-[11px] text-[#8b7e66] mt-2 leading-relaxed">${pairing.subtitle}</div>
                <div class="flex flex-wrap gap-2 mt-3">${previewList}</div>
            </div>
        </div>
    `;
    modal.addEventListener('click', closeHomeInsightsModal);
    document.body.appendChild(modal);
}

window.updateSwipeMainState = updateSwipeMainState;
window.renderHomeProfile = renderHomeProfile;
window.openHomeInsightsModal = openHomeInsightsModal;

function renderHomeProfile() {
    let swipedCount = 0;
    try {
        const histRaw = localStorage.getItem('meimay_reading_history');
        if (histRaw) {
            const histList = JSON.parse(histRaw);
            swipedCount = histList.length * 8;
        }
    } catch (e) { }

    const likedCount = (typeof liked !== 'undefined' && liked) ? liked.length : 0;
    swipedCount += likedCount;
    const savedList = (typeof getSavedNames === 'function') ? getSavedNames() : (window.savedNames || []);
    const savedCount = savedList.length;
    const readingStock = (typeof getReadingStock === 'function') ? getReadingStock() : [];
    const readingStockCount = readingStock.length;
    const preference = getHomePreferenceSummary(liked);
    const pairing = getPairingHomeSummary();
    const nextStep = getHomeNextStep(likedCount, readingStockCount, savedCount, pairing);
    const timeline = getNamingMaterialTimeline(likedCount, readingStockCount, savedCount);
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
    if (pairActionBtn) pairActionBtn.innerText = pairing.actionLabel;

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
function renderHomeProfile() {
    let swipedCount = 0;
    try {
        const histRaw = localStorage.getItem('meimay_reading_history');
        if (histRaw) {
            const histList = JSON.parse(histRaw);
            swipedCount = histList.length * 8;
        }
    } catch (e) { }

    const likedCount = (typeof liked !== 'undefined' && liked) ? liked.length : 0;
    swipedCount += likedCount;
    const savedList = (typeof getSavedNames === 'function') ? getSavedNames() : (window.savedNames || []);
    const savedCount = savedList.length;
    const readingStock = (typeof getReadingStock === 'function') ? getReadingStock() : [];
    const readingStockCount = readingStock.length;
    const preference = getHomePreferenceSummary(liked);
    const pairing = getPairingHomeSummary();
    const nextStep = getHomeNextStep(likedCount, readingStockCount, savedCount, pairing);
    const timeline = getNamingMaterialTimeline(likedCount, readingStockCount, savedCount);
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
    if (pairActionBtn) pairActionBtn.innerText = pairing.actionLabel;

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

function renderHomeProfile() {
    let swipedCount = 0;
    try {
        const histRaw = localStorage.getItem('meimay_reading_history');
        if (histRaw) {
            const histList = JSON.parse(histRaw);
            swipedCount = histList.length * 8;
        }
    } catch (e) { }

    const likedCount = (typeof liked !== 'undefined' && liked) ? liked.length : 0;
    swipedCount += likedCount;
    const savedList = (typeof getSavedNames === 'function') ? getSavedNames() : (window.savedNames || []);
    const savedCount = savedList.length;
    const readingStock = (typeof getReadingStock === 'function') ? getReadingStock() : [];
    const readingStockCount = readingStock.length;
    const preference = getHomePreferenceSummary(liked);
    const pairing = getPairingHomeSummary();
    const nextStep = getHomeNextStep(likedCount, readingStockCount, savedCount, pairing);
    const timeline = getNamingMaterialTimeline(likedCount, readingStockCount, savedCount);
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
    if (pairActionBtn) pairActionBtn.innerText = pairing.actionLabel;

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

window.toggleHomePairJoinRow = toggleHomePairJoinRow;
window.handleHomePairQuickJoin = handleHomePairQuickJoin;
window.renderHomeProfile = renderHomeProfile;
window.openHomeInsightsModal = openHomeInsightsModal;
function canDismissHomePairCard(pairing) {
    return true;
}

function getHomeNextStep(likedCount, readingStockCount, savedCount, pairing) {
    const breakdown = getHomeCollectionBreakdown(typeof liked !== 'undefined' ? liked : [], readingStockCount);

    if ((pairing?.matchedNameCount || 0) >= 1) {
        return {
            title: '一致した名前候補を見る',
            detail: 'ふたりで一致した候補が見つかっています。',
            actionLabel: '保存済みを見る',
            action: 'saved'
        };
    }

    if ((pairing?.matchedKanjiCount || 0) >= 1) {
        return {
            title: '一致した漢字を確認する',
            detail: '共通で気になった漢字があります。',
            actionLabel: 'ストックを見る',
            action: 'stock'
        };
    }

    if (readingStockCount === 0) {
        return {
            title: '読み候補を集める',
            detail: 'まずは響きや呼びやすさから候補を集めましょう。',
            actionLabel: '響き・読みを探す',
            action: 'sound'
        };
    }

    if (breakdown.readingDerivedCount <= 0) {
        return {
            title: '読みから漢字を探す',
            detail: '読み候補ごとに漢字材料を集めるタイミングです。',
            actionLabel: '読みから漢字を探す',
            action: 'reading'
        };
    }

    if (savedCount < 2) {
        return {
            title: '名前候補を作って比べる',
            detail: '材料が集まってきたので、ビルドで候補を増やせます。',
            actionLabel: 'ビルドへ進む',
            action: 'build'
        };
    }

    return {
        title: '保存した候補を見比べる',
        detail: '候補が複数あるので、比較しながら絞り込みを進められます。',
        actionLabel: '保存済みを見る',
        action: 'saved'
    };
}

function getNamingMaterialTimeline(likedCount, readingStockCount, savedCount) {
    const readingGoal = 3;
    const kanjiGoal = 6;
    const savedGoal = 2;

    return {
        stageTitle:
            savedCount >= savedGoal ? '比較できる材料がそろってきました' :
            likedCount >= kanjiGoal ? '名前候補を作れる材料が集まっています' :
            readingStockCount >= readingGoal ? '読み候補が集まってきました' :
            '材料を集めているところです',
        steps: [
            {
                label: '読み候補',
                short: `${Math.min(readingStockCount, readingGoal)} / ${readingGoal}`,
                detail: readingStockCount >= readingGoal ? '準備OK' : `あと ${Math.max(readingGoal - readingStockCount, 0)} 件`
            },
            {
                label: '漢字材料',
                short: `${Math.min(likedCount, kanjiGoal)} / ${kanjiGoal}`,
                detail: likedCount >= kanjiGoal ? '準備OK' : `あと ${Math.max(kanjiGoal - likedCount, 0)} 件`
            },
            {
                label: '比較候補',
                short: `${Math.min(savedCount, savedGoal)} / ${savedGoal}`,
                detail: savedCount >= savedGoal ? '比較OK' : `あと ${Math.max(savedGoal - savedCount, 0)} 件`
            }
        ]
    };
}

function renderHomeProfile() {
    let swipedCount = 0;
    try {
        const histRaw = localStorage.getItem('meimay_reading_history');
        if (histRaw) {
            const histList = JSON.parse(histRaw);
            swipedCount = histList.length * 8;
        }
    } catch (e) { }

    const likedCount = (typeof liked !== 'undefined' && liked) ? liked.length : 0;
    swipedCount += likedCount;
    const savedList = (typeof getSavedNames === 'function') ? getSavedNames() : (window.savedNames || []);
    const savedCount = savedList.length;
    const readingStock = (typeof getReadingStock === 'function') ? getReadingStock() : [];
    const readingStockCount = readingStock.length;
    const preference = getHomePreferenceSummary(liked);
    const pairing = getPairingHomeSummary();
    const nextStep = getHomeNextStep(likedCount, readingStockCount, savedCount, pairing);
    const timeline = getNamingMaterialTimeline(likedCount, readingStockCount, savedCount);
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

function openHomeInsightsModal() {
    closeHomeInsightsModal();

    const savedList = (typeof getSavedNames === 'function') ? getSavedNames() : (window.savedNames || []);
    const likedCount = (typeof liked !== 'undefined' && liked) ? liked.length : 0;
    const readingStock = (typeof getReadingStock === 'function') ? getReadingStock() : [];
    const readingStockCount = readingStock.length;
    const preference = getHomePreferenceSummary(liked);
    const pairing = getPairingHomeSummary();
    const nextStep = getHomeNextStep(likedCount, readingStockCount, savedList.length, pairing);
    const timeline = getNamingMaterialTimeline(likedCount, readingStockCount, savedList.length);
    const previewList = pairing.previewLabels && pairing.previewLabels.length > 0
        ? pairing.previewLabels.map(label => `<span class="px-3 py-1.5 rounded-full bg-[#fdf7ef] border border-[#eee5d8] text-[11px] font-bold text-[#5d5444]">${label}</span>`).join('')
        : '<div class="text-[11px] text-[#a6967a]">一致や共通候補が出るとここに表示されます。</div>';
    const timelineHtml = timeline.steps.map((step, index) => `
        <div class="rounded-2xl border border-[#eee5d8] bg-white px-4 py-3">
            <div class="text-[10px] font-black tracking-[0.16em] text-[#b9965b]">STEP ${index + 1}</div>
            <div class="mt-1 text-sm font-bold text-[#5d5444]">${step.label}</div>
            <div class="mt-2 flex items-end justify-between gap-2">
                <div class="text-xl font-black text-[#4f4639]">${step.short}</div>
                <div class="text-[11px] font-bold text-[#8b7e66]">${step.detail}</div>
            </div>
        </div>
    `).join('');

    const modal = document.createElement('div');
    modal.id = 'home-insights-modal';
    modal.className = 'overlay active';
    modal.innerHTML = `
        <div class="detail-sheet max-w-md max-h-[82vh] overflow-y-auto" onclick="event.stopPropagation()">
            <button class="modal-close-btn" onclick="closeHomeInsightsModal()">×</button>
            <div class="pt-4 pb-2">
                <div class="text-[10px] font-black tracking-[0.18em] text-[#b9965b] uppercase mb-2">Dashboard</div>
                <h3 class="text-xl font-black text-[#4f4639] mb-2">名づけの進み具合</h3>
                <p class="text-sm text-[#8b7e66] leading-relaxed">名づけに必要な材料が、どこまで集まっているかを見られます。</p>
            </div>
            <div class="mt-4 rounded-2xl border border-[#eee5d8] bg-[#fff9f0] p-4">
                <div class="text-[10px] font-black tracking-[0.18em] text-[#b9965b] uppercase mb-2">次のおすすめ</div>
                <div class="text-sm font-bold text-[#5d5444]">${nextStep.title}</div>
                <div class="text-[11px] text-[#8b7e66] mt-2 leading-relaxed">${nextStep.detail}</div>
                <button onclick="handleHomeNextStepAction(event)" class="mt-3 w-full py-3 rounded-2xl bg-[#b9965b] text-white text-sm font-bold shadow-sm">${nextStep.actionLabel}</button>
            </div>
            <div class="mt-3 grid grid-cols-1 gap-2">${timelineHtml}</div>
            <div class="mt-3 rounded-2xl border border-[#eee5d8] bg-white p-4">
                <div class="text-[10px] font-black tracking-[0.18em] text-[#9d8cbc] uppercase mb-2">漢字の傾向</div>
                <div class="text-sm font-bold text-[#5d5444]">${preference.shortText}</div>
                <div class="text-[11px] text-[#8b7e66] mt-2 leading-relaxed">${preference.detailText}</div>
            </div>
            <div class="mt-3 rounded-2xl border border-[#eee5d8] bg-white p-4">
                <div class="text-[10px] font-black tracking-[0.18em] text-[#88a3c5] uppercase mb-2">ペア状態</div>
                <div class="text-sm font-bold text-[#5d5444]">${pairing.title}</div>
                <div class="text-[11px] text-[#8b7e66] mt-2 leading-relaxed">${pairing.subtitle}</div>
                ${pairing.roomCode && !pairing.hasPartner ? `<div class="mt-3 inline-flex items-center gap-2 rounded-full border border-[#e7d7bf] bg-[#fff6e8] px-3 py-2 text-[12px] font-black text-[#4f4639]">コード ${pairing.roomCode}</div>` : ''}
                <div class="flex flex-wrap gap-2 mt-3">${previewList}</div>
            </div>
        </div>
    `;
    modal.addEventListener('click', closeHomeInsightsModal);
    document.body.appendChild(modal);
}

window.renderHomeProfile = renderHomeProfile;
window.openHomeInsightsModal = openHomeInsightsModal;



