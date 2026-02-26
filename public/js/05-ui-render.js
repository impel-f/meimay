/* ============================================================
   MODULE 05: UI RENDER (V14.1 - タップ範囲拡大版)
   カード描画・詳細表示
   ============================================================ */

// タグ定義（統一用）
const TAG_KEYWORDS = {
    'strength': ['強さ', '力', '剛健', '勇敢', '勇気', '活力', '壮大', '勇', '武', '猛', '雄', '毅'],
    'brightness': ['明るさ', '太陽', '陽', '光', '輝き', '晴れ', '朗らか', '明', '照', '旭', '旺', '晃'],
    'kindness': ['優しさ', '慈愛', '愛情', '思いやり', '温かさ', '柔らか', '仁', '恵', '慈', '愛', '温', '柔'],
    'intelligence': ['知性', '賢さ', '才能', '優秀', '学問', '智恵', '智', '賢', '才', '慧', '修'],
    'passion': ['情熱', '熱意', '活発', '元気', '燃える', '炎', '熱', '烈', '昂', '騰'],
    'hope': ['希望', '未来', '夢', '願い', '期待', '幸福', '望', '希', '願', '福', '幸'],
    'success': ['成功', '向上', '昇進', '発展', '繁栄', '栄える', '成', '功', '栄', '進', '昌'],
    'nature': ['自然', '植物', '樹木', '草', '森', '木', '花', '華やか', '桜', '林', '山', '岳', '嶺'],
    'water': ['海', '水', '川', '波', '流れ', '清らか', '湖', '池', '湊', '渚', '汐', '清'],
    'sky': ['空', '宙', '天', '宇宙', '星', '月', '雲', '風', '雷', '雨', '霄', '碧'],
    'elegance': ['品格', '高貴', '気品', '上品', '優雅', '格調', '雅', '麗', '優', '彩', '絢'],
    'tradition': ['伝統', '古風', '和', '和風', '伝統的', '日本', '和', '古', '典', '文'],
    'peace': ['安定', '平和', '平穏', '安らか', '穏やか', '調和', '安', '平', '和', '静', '穏'],
    'justice': ['正義', '公平', '正しい', '義理', '真実', '義', '正', '真', '直', '廉'],
    'spirituality': ['精神', '心', '魂', '意志', '信念', '純粋', '心', '誠', '志', '念', '精']
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
    // Convert comma/space/bracket-separated string to array of tags
    return rawString
        .replace(/【|】|#/g, '')
        .split(/[、,，\s/]+/)
        .map(t => t.trim())
        .filter(t => t.length > 0 && t !== '---')
        .slice(0, 3);
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

    // 読みHTML (全読みを表示し、ヒットしたものを枠で強調)
    const currentSearchReading = (typeof segments !== 'undefined' && segments[currentPos]) || '';

    // 全読みリストを作成 (音, 訓, 伝統名のり の順を維持)
    const allReadings = [data['音'], data['訓'], data['伝統名のり']]
        .filter(x => clean(x))
        .join(',')
        .split(/[、,，\s/]+/)
        .map(x => clean(x))
        .filter(x => x);

    const readingsHTML = allReadings.length > 0 ?
        allReadings.map(r => {
            const isMatch = r === currentSearchReading;
            // 枠と背景色で目立たせる
            return `<span class="px-2 py-1 ${isMatch ? 'bg-[#bca37f] text-white shadow-md ring-2 ring-[#bca37f] ring-offset-1' : 'bg-white bg-opacity-60 text-[#7a6f5a]'} rounded-lg text-xs font-bold transition-all shadow-sm">${r}</span>`;
        }).join(' ') :
        '';

    // 分類タグを取得 (raw dataからのタグを取得)
    const unifiedTags = getUnifiedTags((data['分類'] || ''));

    // 背景色をイメージに連動 (v14.4: タグキーワードから色を決定)
    const bgGradient = getGradientFromTags(unifiedTags);
    card.style.background = bgGradient;

    // タグHTML
    const tagsHTML = unifiedTags.length > 0 ?
        unifiedTags.map(t => `<span class="px-3 py-1 bg-white bg-opacity-80 text-[#8b7e66] rounded-full text-[10px] font-bold shadow-sm">#${t}</span>`).join(' ') :
        '';

    // カード全体をクリック可能に
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
        <div class="text-center text-[9px] text-[#d4c5af] font-bold tracking-widest pb-4">
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
 * タグからグラデーションを生成 (v14.4: キーワード照合)
 */
function getGradientFromTags(tags) {
    if (!tags || tags.length === 0) return 'linear-gradient(135deg, #fdfaf5 0%, #f7f3ec 100%)';

    // タグの中にキーワードが含まれているかチェック
    let matchedKey = 'other';
    for (let tag of tags) {
        // Tag cleaning (remove # etc)
        const cleanTag = tag.replace(/[#【】]/g, '').trim();
        if (!cleanTag) continue;

        for (const [key, keywords] of Object.entries(TAG_KEYWORDS)) {
            if (keywords.some(kw => cleanTag.includes(kw))) {
                matchedKey = key;
                break;
            }
        }
        if (matchedKey !== 'other') break;
    }

    const colorMap = {
        'strength': ['#fff1f2', '#ffe4e6', '#fecdd3'], // Rose
        'brightness': ['#fff7ed', '#ffedd5', '#fed7aa'], // Orange
        'kindness': ['#fdf2f8', '#fce7f3', '#fbcfe8'], // Pink
        'intelligence': ['#f5f3ff', '#ede9fe', '#ddd6fe'], // Violet
        'passion': ['#fef2f2', '#fee2e2', '#fecaca'], // Red
        'hope': ['#fffbeb', '#fef3c7', '#fde68a'], // Amber
        'success': ['#ecfdf5', '#d1fae5', '#a7f3d0'], // Emerald
        'nature': ['#f0fdf4', '#dcfce7', '#bbf7d0'], // Green
        'water': ['#f0f9ff', '#e0f2fe', '#bae6fd'], // Sky
        'sky': ['#f0fdfa', '#ccfbf1', '#99f6e4'], // Teal
        'elegance': ['#faf5ff', '#f3e8ff', '#e9d5ff'], // Purple
        'tradition': ['#fff7ed', '#ffedd5', '#fed7aa'], // Tradition/Earth
        'peace': ['#f0fdf4', '#dcfce7', '#bbf7d0'], // Peace/Mint
        'justice': ['#f8fafc', '#f1f5f9', '#e2e8f0'], // Slate
        'spirituality': ['#ffffff', '#fdfbf7', '#f5f0e5'], // White/Eggshell
        'other': ['#fdfaf5', '#f8f5ef', '#ede5d8']
    };

    const colors = colorMap[matchedKey];
    return `linear-gradient(135deg, ${colors[0]} 0%, ${colors[1]} 50%, ${colors[2]} 100%)`;

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
            <div class="flex flex-col">
                <div class="text-[10px] font-bold text-[#bca37f] mb-0.5 tracking-widest flex items-center gap-1">
                    <span>💡</span> 意味
                </div>
                <div class="text-sm text-[#5d5444] font-medium leading-relaxed">
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
                <div class="text-sm text-[#5d5444] font-bold leading-normal tracking-wider break-keep mt-[1px]">
                    ${readings.join('<span class="text-[#ede5d8] mx-1">|</span>')}
                </div>
            </div>
        `;
        }
        let tagsContainer = document.getElementById('det-tags-container');

        // タグHTML生成 (v14.4: 生データを表示)
        const tagsHTML = unifiedTags.length > 0 ?
            unifiedTags.map(t => `<span class="px-3 py-1 bg-white bg-opacity-60 text-[#8b7e66] rounded-full text-[10px] font-bold shadow-sm border border-transparent backdrop-blur-sm">#${t}</span>`).join(' ') :
            '';

        if (tagsContainer) {
            tagsContainer.innerHTML = tagsHTML;
        }


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
                kanji_reading: readingToSave
            };
            if (sessionSegments) {
                likeData.sessionSegments = sessionSegments;
            }

            liked.push(likeData);
            if (typeof StorageBox !== 'undefined' && StorageBox.saveLiked) StorageBox.saveLiked();
            if (data && data['漢字'] && typeof MeimayStats !== 'undefined' && MeimayStats.recordKanjiLike) {
                MeimayStats.recordKanjiLike(data['漢字']);
            }

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
