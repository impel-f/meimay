/* ============================================================
   MODULE 05: UI RENDER (V14.1 - タップ範囲拡大版)
   カード描画・詳細表示
   ============================================================ */

// タグ定義（統一用）
const TAG_KEYWORDS = {
    'nature': ['自然', '植物', '樹木', '草', '森', '木', '花', '華やか', '桜'],
    'brightness': ['明るさ', '太陽', '陽', '光', '輝き', '晴れ', '朗らか'],
    'water': ['海', '水', '川', '波', '流れ', '清らか'],
    'strength': ['強さ', '力', '剛健', '勇敢', '勇気', '活力', '壮大'],
    'kindness': ['優しさ', '慈愛', '愛情', '思いやり', '温かさ', '柔らか'],
    'intelligence': ['知性', '賢さ', '才能', '優秀', '学問', '智恵'],
    'honesty': ['誠実', '真面目', '実直', '正直', '真摯'],
    'elegance': ['品格', '高貴', '気品', '上品', '優雅', '格調'],
    'tradition': ['伝統', '古風', '和', '雅', '伝統的'],
    'beauty': ['美', '麗しい', '艶やか', '華麗', '美しい'],
    'success': ['成功', '向上', '昇進', '発展', '繁栄', '栄える'],
    'peace': ['安定', '平和', '平穏', '安らか', '穏やか', '調和'],
    'leadership': ['リーダー', '統率', '王者', '主導', '指導'],
    'hope': ['希望', '未来', '夢', '願い', '期待', '幸福'],
    'spirituality': ['精神', '心', '魂', '意志', '信念', '純粋']
};

const TAG_LABELS = {
    'nature': '自然',
    'brightness': '明るさ',
    'water': '水',
    'strength': '力強さ',
    'kindness': '優しさ',
    'intelligence': '知性',
    'honesty': '誠実',
    'elegance': '品格',
    'tradition': '伝統',
    'beauty': '美しさ',
    'success': '成功',
    'peace': '安定',
    'leadership': 'リーダー',
    'hope': '希望',
    'spirituality': '精神',
    'other': 'その他'
};

function getUnifiedTags(rawString) {
    if (!rawString) return [];
    const normalized = rawString.replace(/【|】/g, '');
    const foundLabels = new Set();

    Object.keys(TAG_KEYWORDS).forEach(key => {
        const keywords = TAG_KEYWORDS[key];
        if (keywords.some(kw => normalized.includes(kw))) {
            foundLabels.add(TAG_LABELS[key]);
        }
    });

    // マッチしなかった場合で、かつ入力がある場合はその他
    if (foundLabels.size === 0 && normalized.trim().length > 0 && normalized !== '---') {
        return ['その他'];
    }

    // 最大2つまで
    return Array.from(foundLabels).slice(0, 2);
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

    // Free Stroke override for headers
    if (isFreeSwipeMode) {
        const indicator = document.getElementById('pos-indicator');
        const btnPrev = document.getElementById('btn-prev-char');
        const btnNext = document.getElementById('btn-next-char');
        if (indicator) indicator.innerText = '自由に選ぶ';
        if (btnPrev) btnPrev.classList.add('opacity-0', 'pointer-events-none');
        if (btnNext) btnNext.classList.add('opacity-0', 'pointer-events-none');
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
                        <p class="text-[#bca37f] font-bold text-lg mb-4">候補がありません</p>
                        <p class="text-sm text-[#a6967a] mb-6">これ以上候補が見つかりませんでした</p>
                        <button onclick="finishFreeMode()" class="btn-gold py-4 px-8">終了する →</button>
                    </div>
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <div class="flex items-center justify-center h-full text-center px-6">
                <div>
                    <p class="text-[#bca37f] font-bold text-lg mb-4">候補がありません</p>
                    <p class="text-sm text-[#a6967a] mb-6">設定を変更するか、<br>次の文字に進んでください</p>
                    ${currentPos < segments.length - 1 ?
                '<button onclick="proceedToNextSlot()" class="btn-gold py-4 px-8">次の文字へ進む →</button>' :
                '<button onclick="openBuild()" class="btn-gold py-4 px-8">ビルド画面へ →</button>'
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

    // 読みを取得
    const readings = [data['音'], data['訓'], data['伝統名のり']]
        .filter(x => clean(x))
        .join(',')
        .split(/[、,，\s/]+/)
        .filter(x => clean(x))
        .slice(0, 3);

    // 分類タグを取得（表示用：統一カテゴリ）
    const unifiedTags = getUnifiedTags((data['名前のイメージ'] || '') + ',' + (data['分類'] || ''));

    // 背景色をイメージに連動 (v14.3: 統一タグを使用)
    const bgGradient = getGradientFromTags(unifiedTags);
    card.style.background = bgGradient;

    // タグHTML（統一カテゴリを表示）
    const tagsHTML = unifiedTags.length > 0 ?
        unifiedTags.map(t => `<span class="px-3 py-1 bg-white bg-opacity-80 text-[#8b7e66] rounded-full text-xs font-bold shadow-sm">#${t}</span>`).join(' ') :
        '';

    // 読みHTML
    const readingsHTML = readings.length > 0 ?
        readings.map(r => `<span class="px-2 py-1 bg-white bg-opacity-60 rounded-lg text-xs font-bold text-[#7a6f5a]">${r}</span>`).join(' ') :
        '';

    // カード全体をクリック可能に（タップ範囲拡大）
    card.innerHTML = `
        <div class="flex-1 flex flex-col justify-center items-center px-4 w-full">
            ${tagsHTML ? `<div class="flex gap-2 mb-2 flex-wrap justify-center">${tagsHTML}</div>` : ''}
            
            <div class="text-[clamp(80px,18vh,110px)] font-black text-[#5d5444] leading-none mb-1">${data['漢字']}</div>
            
            <div class="text-[#bca37f] font-black text-lg mb-2">${data['画数']}画</div>
            
            ${readingsHTML ? `<div class="flex gap-2 mb-2 flex-wrap justify-center">${readingsHTML}</div>` : ''}
            
            <div class="w-full max-w-xs bg-white bg-opacity-70 rounded-2xl px-3 py-2 shadow-sm overflow-hidden min-h-0 flex items-center justify-center mt-auto mb-2 shrink-0">
                <p class="text-xs leading-relaxed text-[#7a6f5a] text-center line-clamp-3">${shortMeaning || '意味情報なし'}</p>
            </div>
        </div>
        <div class="text-center text-[9px] text-[#d4c5af] font-bold tracking-widest pb-2">
            タップで詳細 / スワイプで選択
        </div>
    `;

    // カード全体にクリックイベント（タップ範囲拡大）
    card.addEventListener('click', (e) => {
        // スワイプ中はクリック無効
        if (card.style.transform && card.style.transform !== 'none') {
            return;
        }
        showKanjiDetailByIndex(currentIdx);
    });

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

    const remaining = Math.max(0, stack.length - currentIdx);

    if (isFreeSwipeMode) {
        const selected = liked.filter(item => item.sessionReading === 'FREE').length;
        el.innerText = `選:${selected} / 残:${remaining}`;
        return;
    }

    const currentReading = segments.join('');
    const selected = liked.filter(item =>
        item.slot === currentPos &&
        (!item.sessionReading || item.sessionReading === currentReading)
    ).length;

    el.innerText = `選:${selected} / 残:${remaining}`;
}

/**
 * タグからグラデーションを生成
 */
function getGradientFromTags(tags) {
    const colorMap = {
        // 自然系
        '自然': ['#f0fdf4', '#dcfce7', '#bbf7d0'],
        '植物': ['#f0fdf4', '#dcfce7', '#bbf7d0'],
        '樹木': ['#ecfdf5', '#d1fae5', '#a7f3d0'],
        '草': ['#f0fdf4', '#dcfce7', '#bbf7d0'],
        '木': ['#ecfdf5', '#d1fae5', '#a7f3d0'],
        '森': ['#ecfdf5', '#d1fae5', '#a7f3d0'],

        // 花系
        '花': ['#fef2f2', '#fce7f3', '#fbcfe8'],
        '華やか': ['#fef2f2', '#fce7f3', '#fbcfe8'],
        '桜': ['#fff1f2', '#ffe4e6', '#fecdd3'],
        '美しさ': ['#fdf2f8', '#fce7f3', '#fbcfe8'],

        // 水系
        '海': ['#eff6ff', '#dbeafe', '#bfdbfe'],
        '水': ['#f0f9ff', '#e0f2fe', '#bae6fd'],
        '川': ['#ecfeff', '#cffafe', '#a5f3fc'],

        // 太陽・光・希望系
        '太陽': ['#fef3c7', '#fde68a', '#fcd34d'],
        '陽': ['#fef3c7', '#fde68a', '#fcd34d'],
        '光': ['#fefce8', '#fef9c3', '#fef08a'],
        '明るさ': ['#fefce8', '#fef9c3', '#fef08a'],
        '希望': ['#fffbeb', '#fef3c7', '#fde68a'],
        '成功': ['#fff7ed', '#ffedd5', '#fed7aa'], // オレンジゴールド

        // 月・星・精神系
        '月': ['#faf5ff', '#f3e8ff', '#e9d5ff'],
        '星': ['#faf5ff', '#f3e8ff', '#e9d5ff'],
        '精神': ['#f5f3ff', '#ede9fe', '#ddd6fe'],
        '知性': ['#f0fdfa', '#ccfbf1', '#99f6e4'],

        // 季節系
        '春': ['#fef2f2', '#fce7f3', '#fbcfe8'],
        '夏': ['#ecfeff', '#cffafe', '#a5f3fc'],
        '秋': ['#fff7ed', '#ffedd5', '#fed7aa'],
        '冬': ['#f0f9ff', '#e0f2fe', '#bae6fd'],

        // 力・リーダーシップ
        '力強さ': ['#fff1f2', '#ffe4e6', '#fecdd3'], // 赤系
        'リーダー': ['#fef2f2', '#fee2e2', '#fecaca'],

        // 人柄
        '優しさ': ['#fff1f2', '#ffe4e6', '#fecdd3'],
        '誠実': ['#f0f9ff', '#e0f2fe', '#bae6fd'],
        '品格': ['#faf5ff', '#f3e8ff', '#e9d5ff'],
        '伝統': ['#f7fee7', '#ecfccb', '#d9f99d'], // 抹茶・鶯色
        '安定': ['#eff6ff', '#dbeafe', '#bfdbfe'], // 安定＝水・空のイメージで青系

        // その他
        '繰り返し': ['#fdfaf5', '#f8f5ef', '#f0ebe0'],
        '記号': ['#fdfaf5', '#f8f5ef', '#f0ebe0'],
        'その他': ['#fdfaf5', '#f8f5ef', '#f0ebe0']
    };

    // 最初の2つのタグから色を取得
    const colors = tags.slice(0, 2)
        .map(tag => colorMap[tag] || null)
        .filter(c => c !== null);

    if (colors.length === 2) {
        return `linear-gradient(135deg, ${colors[0][0]} 0%, ${colors[0][1]} 30%, ${colors[1][1]} 70%, ${colors[1][2]} 100%)`;
    } else if (colors.length === 1) {
        return `linear-gradient(135deg, ${colors[0][0]} 0%, ${colors[0][1]} 50%, ${colors[0][2]} 100%)`;
    } else {
        return 'linear-gradient(135deg, #fdfaf5 0%, #f8f5ef 50%, #f0ebe0 100%)';
    }
}

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

/**
 * 漢字詳細モーダルを表示
 */
async function showKanjiDetail(data) {
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

    // イメージタグ表示（色付き）
    const unifiedTags = getUnifiedTags((data['名前のイメージ'] || '') + ',' + (data['分類'] || ''));

    // ヘッダー背景色をグラデーションに
    if (headerBg) {
        const gradient = getGradientFromTags(unifiedTags);
        headerBg.style.background = gradient;
        headerBg.style.textShadow = '0 1px 2px rgba(255,255,255,0.8)';
    }

    // ヘッダーの意味表示
    if (headerMeaningEl) {
        headerMeaningEl.innerHTML = `
            <span class="inline-block bg-white/60 backdrop-blur-sm rounded-lg px-3 py-1 shadow-sm mt-1">
                <span class="opacity-70 mr-1 text-xs">💡意味:</span>
                <span class="text-[#5d5444]">${clean(data['意味']) || ''}</span>
            </span>
        `;
    }

    // ヘッダーの読み表示 (v14.3)
    const readings = [data['音'], data['訓'], data['伝統名のり']]
        .filter(x => clean(x))
        .join(',')
        .split(/[、,，\s/]+/)
        .filter(x => clean(x));

    if (headerReadingEl) {
        headerReadingEl.innerHTML = `
            <span class="inline-block bg-white/60 backdrop-blur-sm rounded-lg px-3 py-1 shadow-sm">
                <span class="opacity-70 mr-1 text-xs">📖読み・名乗り:</span>
                <span class="text-[#5d5444]">${readings.join('、')}</span>
            </span>
        `;
    }
    let tagsContainer = document.getElementById('det-tags');

    // タグ用コンテナがなければ作成（Kanjiの直後、読みの前）
    // タグ用コンテナがなければ作成（Kanjiの直後、読みの前）
    if (!tagsContainer) {
        // Fallback for safety (though index.html has it now)
        tagsContainer = document.createElement('div');
        tagsContainer.id = 'det-tags';
        tagsContainer.className = 'flex gap-2 mb-6 justify-center flex-wrap';
        if (kanjiEl.nextSibling) kanjiEl.parentNode.insertBefore(tagsContainer, kanjiEl.nextSibling);
    }

    // タグHTML生成
    const tagsHTML = unifiedTags.length > 0 ?
        unifiedTags.map(t => `<span class="px-3 py-1 bg-white/60 text-[#8b7e66] rounded-full text-xs font-bold shadow-sm border border-transparent backdrop-blur-sm">#${t}</span>`).join(' ') :
        '';

    tagsContainer.innerHTML = tagsHTML;

    // Remove old reading/meaning population since they are handled in Header now


    // ストック状態チェック
    const isLiked = liked.some(l => l['漢字'] === data['漢字']);

    // 既存のボタンがあれば削除
    const existingStockBtn = modal.querySelector('#btn-stock-toggle-modal');
    if (existingStockBtn) existingStockBtn.remove();

    const stockBtn = document.createElement('button');
    stockBtn.id = 'btn-stock-toggle-modal';

    if (isLiked) {
        stockBtn.className = 'w-full mt-6 mb-4 py-4 bg-[#fef2f2] rounded-2xl text-sm font-bold text-[#f28b82] hover:bg-[#f28b82] hover:text-white transition-all shadow-sm flex items-center justify-center gap-2';
        stockBtn.innerHTML = '<span>🗑️</span> この漢字をストックから外す';
        stockBtn.onclick = () => toggleStockFromModal(data, true);
    } else {
        stockBtn.className = 'w-full mt-6 mb-4 py-4 bg-gradient-to-r from-[#ff9a9e] to-[#fecfef] rounded-2xl text-base font-bold text-white hover:shadow-md transition-all shadow-sm flex items-center justify-center gap-2';
        stockBtn.innerHTML = '<span class="text-xl">♥</span> ストックに追加';
        stockBtn.onclick = () => toggleStockFromModal(data, false);
    }

    // 四字熟語(yojijukugoElの親div)の上に配置
    const yojiWrapper = yojijukugoEl.parentNode;
    if (yojiWrapper && yojiWrapper.parentNode) {
        yojiWrapper.parentNode.insertBefore(stockBtn, yojiWrapper);
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
    if (inActiveSwipe && segments && segments[currentPos]) {
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

    // 空白クリックで閉じる
    modal.onclick = (e) => {
        if (e.target === modal) {
            closeKanjiDetail();
        }
    };
}

/**
 * モーダルからストックを切り替え
 */
function toggleStockFromModal(data, isCurrentlyLiked) {
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

        if (removedCount > 0) {
            if (typeof saveLiked === 'function') saveLiked();

            const scrStock = document.getElementById('scr-stock');
            if (scrStock && scrStock.classList.contains('active') && typeof renderStock === 'function') {
                renderStock();
            }

            alert('ストックから外しました');
            closeKanjiDetail();
        }
    } else {
        // ストックに追加
        let sessionReading = 'MANUAL';
        let slot = -1;
        let sessionSegments = null;

        // もしスワイプ画面からの追加なら文脈を引き継ぐ
        const mainSwipeScreen = document.getElementById('scr-main');
        if (mainSwipeScreen && mainSwipeScreen.classList.contains('active') && segments && segments[currentPos]) {
            sessionReading = segments.join('');
            slot = currentPos;
            sessionSegments = [...segments];
        } else if (data._birthdayPersonReading) {
            // 今日の一字など、特定の読みが指定されている場合（v23.12）
            sessionReading = data._birthdayPersonReading;
            slot = 0;
            sessionSegments = [data._birthdayPersonReading];
        }

        const readingToSave = [data['音'], data['訓'], data['伝統名のり']].filter(x => x).join(',');

        const likeData = {
            ...data,
            timestamp: new Date().toISOString(),
            sessionReading: sessionReading,
            slot: slot,
            kanji_reading: readingToSave
        };
        if (sessionSegments) {
            likeData.sessionSegments = sessionSegments;
        }

        liked.push(likeData);
        if (typeof saveLiked === 'function') saveLiked();

        alert('ストックに追加しました！');
        closeKanjiDetail();
    }
}

/**
 * 漢字詳細モーダルを閉じる
 */
function closeKanjiDetail() {
    const modal = document.getElementById('modal-kanji-detail');
    if (modal) modal.classList.remove('active');
}

window.updateSwipeMainState = updateSwipeMainState;

console.log("UI RENDER: Module loaded (v14.1 - Full tap area)");
