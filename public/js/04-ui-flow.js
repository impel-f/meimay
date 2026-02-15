/* ============================================================
   MODULE 04: UI FLOW (V14.3)
   ウィザード進行・モード管理
   ============================================================ */

let appMode = 'reading'; // reading, nickname, free, diagnosis
let selectedVibes = new Set();
// gender is defined in 01-core.js

// Vibe Data
// Vibe Data
const VIBES = [
    { id: 'none', label: 'こだわらない', icon: '⚪' },
    { id: 'nature', label: '自然・植物', icon: '🌿' },
    { id: 'flower', label: '花・華やか', icon: '🌸' },
    { id: 'sky', label: '空・天体', icon: '☀️' },
    { id: 'water', label: '海・水', icon: '💧' },
    { id: 'kindness', label: '優しさ・愛', icon: '💝' },
    { id: 'strength', label: '強さ・健康', icon: '💪' },
    { id: 'intelligence', label: '知性・才能', icon: '🎓' },
    { id: 'success', label: '成功・未来', icon: '✨' },
    { id: 'beauty', label: '美しさ', icon: '👗' },
    { id: 'tradition', label: '伝統・和', icon: '⛩️' },
    { id: 'stability', label: '安定・平和', icon: '🕊️' }
];

/**
 * モード開始
 */
function startMode(mode) {
    console.log(`UI_FLOW: Start mode ${mode}`);
    appMode = mode;

    // 診断モードの場合はイメージ等は不要（要望によりスキップ）
    if (mode === 'diagnosis') {
        changeScreen('scr-diagnosis-input');
        return;
    }

    changeScreen('scr-gender');
}

/**
 * 性別選択
 */
function selectGender(g) {
    gender = g;
    console.log(`UI_FLOW: Gender selected ${g}`);

    if (appMode === 'free') {
        // 自由選択モード: 性別 -> イメージ -> カタログ
        initVibeScreen();
        changeScreen('scr-vibe');
    } else if (appMode === 'nickname') {
        changeScreen('scr-input-nickname');
    } else {
        changeScreen('scr-input-reading');
    }
}

/**
 * イメージ画面初期化
 */
function initVibeScreen() {
    const grid = document.getElementById('vibe-grid');
    if (!grid) return;

    grid.innerHTML = '';
    selectedVibes.clear();
    selectedVibes.add('none'); // デフォルト選択

    VIBES.forEach(v => {
        const btn = document.createElement('button');
        btn.id = `vibe-btn-${v.id}`;
        btn.className = 'flex flex-col items-center justify-center p-3 bg-white/60 rounded-xl border border-transparent shadow-sm transition-all hover:bg-white active:scale-95';
        btn.innerHTML = `<div class="text-2xl mb-1">${v.icon}</div><div class="text-[10px] font-bold text-[#5d5444]">${v.label}</div>`;

        if (v.id === 'none') {
            btn.classList.add('ring-2', 'ring-[#bca37f]', 'bg-[#fffbeb]');
        }

        btn.onclick = () => toggleVibe(v.id, btn);
        grid.appendChild(btn);
    });
}

/**
 * イメージ切り替え
 */
function toggleVibe(id, btn) {
    if (id === 'none') {
        // 「こだわらない」選択時 -> 他をクリアしてこれだけにする
        selectedVibes.clear();
        selectedVibes.add('none');

        // 全ボタンのスタイル更新
        VIBES.forEach(v => {
            const el = document.getElementById(`vibe-btn-${v.id}`);
            if (el) {
                if (v.id === 'none') el.classList.add('ring-2', 'ring-[#bca37f]', 'bg-[#fffbeb]');
                else el.classList.remove('ring-2', 'ring-[#bca37f]', 'bg-[#fffbeb]');
            }
        });
        return;
    }

    // 他の項目選択時 -> 「こだわらない」を解除
    if (selectedVibes.has('none')) {
        selectedVibes.delete('none');
        const noneBtn = document.getElementById('vibe-btn-none');
        if (noneBtn) noneBtn.classList.remove('ring-2', 'ring-[#bca37f]', 'bg-[#fffbeb]');
    }

    if (selectedVibes.has(id)) {
        selectedVibes.delete(id);
        btn.classList.remove('ring-2', 'ring-[#bca37f]', 'bg-[#fffbeb]');
    } else {
        selectedVibes.add(id);
        btn.classList.add('ring-2', 'ring-[#bca37f]', 'bg-[#fffbeb]');
    }

    // 全て解除されたら「こだわらない」に戻す？ 
    if (selectedVibes.size === 0) {
        selectedVibes.add('none');
        const noneBtn = document.getElementById('vibe-btn-none');
        if (noneBtn) noneBtn.classList.add('ring-2', 'ring-[#bca37f]', 'bg-[#fffbeb]');
    }
}

/**
 * イメージ確定 -> 各入力画面へ
 */
function submitVibe() {
    // グローバル変数更新
    if (selectedVibes.size > 0) {
        window.selectedImageTags = Array.from(selectedVibes);
    } else {
        window.selectedImageTags = ['none'];
    }

    console.log("UI_FLOW: Vibes set", window.selectedImageTags);

    if (appMode === 'free') {
        initFreeMode();
        changeScreen('scr-free-mode');
    } else {
        // 読み・ニックネームモード -> 苗字入力へ
        // (注: エンジン側でselectSegment後にchangeScreen('scr-vibe')するように変更が必要)
        changeScreen('scr-surname-settings');
    }
}

/**
 * 戻るボタン処理
 */
function goBack() {
    const active = document.querySelector('.screen.active');
    if (!active) return;
    const id = active.id;

    if (id === 'scr-gender') {
        changeScreen('scr-mode');
    } else if (id === 'scr-input-reading' || id === 'scr-input-nickname') {
        changeScreen('scr-gender');
    } else if (id === 'scr-nickname-swipe') {
        changeScreen('scr-input-nickname');
    } else if (id === 'scr-tomeji-selection') {
        // Show the list again on the swipe screen
        document.getElementById('nickname-liked-list').classList.remove('hidden');
        changeScreen('scr-nickname-swipe');
    } else if (id === 'scr-vibe') {
        if (appMode === 'free') {
            changeScreen('scr-gender');
        } else if (appMode === 'nickname') {
            // From vibe back to tomeji
            changeScreen('scr-tomeji-selection');
        } else {
            // 読みモードの場合、分割選択画面に戻る
            changeScreen('scr-segment');
        }
    } else if (id === 'scr-free-mode') {
        changeScreen('scr-vibe');
    } else if (id === 'scr-surname-settings') {
        // イメージ選択に戻る
        changeScreen('scr-vibe');
    } else if (id === 'scr-diagnosis-input') {
        changeScreen('scr-mode');
    } else if (id === 'scr-segment') {
        if (appMode === 'nickname') {
            // Should go back to tomeji? 
            // Usually nickname flow skips segment screen or auto-passes it. 
            // If we are here, we go back to tomeji.
            changeScreen('scr-tomeji-selection');
        }
        else changeScreen('scr-input-reading');
    }
}

/**
 * ニックネーム処理
 */
/**
 * ニックネーム処理 (V2: Expansion Flow)
 */
let generatedCandidates = [];
let likedReadings = [];
let currentSwipeIndex = 0;
let nicknameBaseReading = ""; // "はる" (from input)
let nicknamePosition = "prefix"; // "prefix" or "suffix"

function processNickname() {
    const el = document.getElementById('in-nickname');
    let val = el.value.trim();

    if (!val) {
        alert('ニックネームを入力してください');
        return;
    }

    // ちゃん、くん、さん 等を除去
    val = val.replace(/(ちゃん|くん|さん|たん|りん)$/g, '');

    // ひらがな化
    val = toHira(val);
    if (!val) {
        alert('読みが正しく判定できませんでした');
        return;
    }

    nicknameBaseReading = val;

    // 位置取得
    const posRadios = document.getElementsByName('nickname-pos');
    let pos = 'prefix';
    for (let r of posRadios) if (r.checked) pos = r.value;
    nicknamePosition = pos;

    console.log(`FLOW: Nickname ${val}, Pos ${pos}, Gender ${gender}`);

    // 候補生成
    if (typeof generateNameCandidates !== 'function') {
        alert("Generator module not loaded.");
        return;
    }

    generatedCandidates = generateNameCandidates(val, gender, pos);

    if (generatedCandidates.length === 0) {
        alert('候補が見つかりませんでした。別の読みを試してください。');
        return;
    }

    // スワイプ画面初期化
    startNicknameSwipe();
}

/**
 * 読みスワイプ開始
 */
function startNicknameSwipe() {
    currentSwipeIndex = 0;
    // Don't clear likedReadings if we are continuing? 
    // Usually start fresh unless "continue" mode. 
    // But nickname flow is simple linear.
    if (likedReadings.length > 0 && confirm("前の選択をクリアして最初から始めますか？")) {
        likedReadings = [];
    } else if (likedReadings.length === 0) {
        likedReadings = [];
    }

    changeScreen('scr-nickname-swipe');
    updateNicknameCounters();
    renderNicknameCard();

    // リスト画面を隠す
    document.getElementById('nickname-liked-list').classList.add('hidden');
    document.getElementById('nickname-swipe-msg').classList.add('hidden');
}

function updateNicknameCounters() {
    const elLeft = document.getElementById('nickname-swipe-count');
    const elStock = document.getElementById('nickname-stock-count');

    // Show remaining in current "batch" of 10? OR Total?
    // User wants "10個聞いたら進むか続けるか聞いて" -> 10 item batch.

    const BATCH_SIZE = 10;
    const currentBatchCount = currentSwipeIndex % BATCH_SIZE;
    const remainingInBatch = BATCH_SIZE - currentBatchCount;

    if (elLeft) elLeft.innerText = remainingInBatch;
    if (elStock) elStock.innerText = likedReadings.length;
}

/**
 * 読みカード表示
 */
function renderNicknameCard() {
    const container = document.getElementById('nickname-swipe-container');
    const cards = container.querySelectorAll('.nickname-card');
    cards.forEach(c => c.remove());

    updateNicknameCounters();

    // Check if we hit the batch limit (every 10 items)
    if (currentSwipeIndex > 0 && currentSwipeIndex % 10 === 0) {
        showNicknameBatchLimitModal();
        return;
    }

    if (currentSwipeIndex >= generatedCandidates.length) {
        showNicknameList();
        return;
    }

    const item = generatedCandidates[currentSwipeIndex];

    // Card Element
    const card = document.createElement('div');
    card.className = 'nickname-card absolute inset-4 bg-white rounded-3xl shadow-lg border border-[#ede5d8] flex flex-col items-center justify-center transition-transform duration-300 select-none cursor-grab active:cursor-grabbing';
    card.style.zIndex = 10;

    // Example Kanji Generation
    const exampleHtml = getSampleKanjiHtml(item);

    card.innerHTML = `
        <div class="text-xs font-bold text-[#bca37f] mb-6 tracking-widest uppercase opacity-70">
            ${item.type === 'original' ? 'Original' : (item.type === 'prefix' ? 'Suffix Match' : 'Expansion')}
        </div>
        <div class="text-5xl font-black text-[#5d5444] mb-8 tracking-wider">${item.reading}</div>
        
        <div class="w-full px-6">
             <div class="bg-[#fdfaf5] rounded-2xl p-4 border border-[#f5efe4]">
                <p class="text-[10px] text-[#a6967a] text-center mb-2 font-bold">漢字の組み合わせ例</p>
                <div class="flex justify-center flex-wrap gap-2 text-[#5d5444] font-serif">
                   ${exampleHtml}
                </div>
             </div>
        </div>
    `;

    container.appendChild(card);

    // Attach Touch Events (Updated logic)
    initNicknameCardEvents(card);
}

function showNicknameBatchLimitModal() {
    document.getElementById('nickname-swipe-msg').classList.remove('hidden');
}

function continueNicknameSwipe() {
    document.getElementById('nickname-swipe-msg').classList.add('hidden');
    // Increment index to skip the check?? No, the index is already at 10.
    // We just render next card.
    // Wait, renderNicknameCard checks `currentSwipeIndex % 10 === 0`.
    // We need a flag to bypass this check OR just increment one temporary step?
    // No, that would skip a candidate.

    // Hack: We can just render the card and bypass the check logic by passing a flag?
    // Or cleaner: store a "lastBreakpoint" index.

    // Simple fix: increment currentSwipeIndex ?? NO. The item at index 10 hasn't been shown yet! 
    // Actually, `currentSwipeIndex` points to the NEXT item to show.
    // So if index is 10, we are about to show the 11th item (index 10).
    // So we should show the modal BEFORE showing item 10.
    // Correct.

    // To proceed, we need to allow rendering. 
    // Let's use a temporary property on the container or a global flag.
    // But easier: `currentSwipeIndex` is strictly used for "next item".
    // 10 items done means we finished indices 0-9. `currentSwipeIndex` is 10.
    // We pause here.

    // To continue, we must NOT show the modal again immediately for 10.
    // Maybe we change the condition to `currentSwipeIndex > 0 && currentSwipeIndex % 10 === 0 && !wasBatchModalShown`.

    // Let's just force render by shifting logic.
    // We will use a separate function to "force render"

    renderNicknameCardForce();
    document.getElementById('nickname-swipe-msg').classList.add('hidden');
}

function renderNicknameCardForce() {
    // Exact copy but skips the modal check
    const container = document.getElementById('nickname-swipe-container');
    const cards = container.querySelectorAll('.nickname-card');
    cards.forEach(c => c.remove());

    if (currentSwipeIndex >= generatedCandidates.length) {
        showNicknameList();
        return;
    }

    const item = generatedCandidates[currentSwipeIndex];
    const card = document.createElement('div');
    card.className = 'nickname-card absolute inset-4 bg-white rounded-3xl shadow-lg border border-[#ede5d8] flex flex-col items-center justify-center transition-transform duration-300 select-none cursor-grab active:cursor-grabbing';
    card.style.zIndex = 10;
    const exampleHtml = getSampleKanjiHtml(item);

    card.innerHTML = `
        <div class="text-xs font-bold text-[#bca37f] mb-6 tracking-widest uppercase opacity-70">
            ${item.type === 'original' ? 'Original' : (item.type === 'prefix' ? 'Suffix Match' : 'Expansion')}
        </div>
        <div class="text-5xl font-black text-[#5d5444] mb-8 tracking-wider">${item.reading}</div>
        <div class="w-full px-6">
             <div class="bg-[#fdfaf5] rounded-2xl p-4 border border-[#f5efe4]">
                <p class="text-[10px] text-[#a6967a] text-center mb-2 font-bold">漢字の組み合わせ例</p>
                <div class="flex justify-center flex-wrap gap-2 text-[#5d5444] font-serif">
                   ${exampleHtml}
                </div>
             </div>
        </div>
    `;
    container.appendChild(card);
    initNicknameCardEvents(card);
}

/**
 * 決定 -> ベース漢字選択画面へ
 */
function confirmReading(reading) {
    console.log(`FLOW: Confirmed reading ${reading} (Base: ${nicknameBaseReading})`);

    // ユーザー要望: 「最初に選ぶ漢字はやはりもとになる音」
    // つまり、ニックネーム部分（ベース）の漢字を先に決める。
    // 例：入力「はる」 -> 選択「はると」 -> 先に「はる」の漢字を決める。

    // ベース部分の抽出
    // Prefix mode: "はる" (Base) + "と" (Suffix)
    // Suffix mode: "まさ" (Prefix) + "はる" (Base)

    // 今回は複数選択可能だが、ユーザーは「リストから1つを選んで」進むフロー（showNicknameListの実装依存）。
    // 現状の実装では `confirmReading` は1つの `reading` を引数に取る。
    // つまり、1つの名前に絞ってから漢字を選ぶフロー。

    selectedReadingForTomeji = reading; // Variable name reuse (meaning "Target Name Reading")

    changeScreen('scr-base-kanji-selection');
    initBaseKanjiScreen(nicknameBaseReading);
}

function initBaseKanjiScreen(baseReading) {
    const title = document.getElementById('base-kanji-reading-display');
    const kanaDisplay = document.getElementById('base-kana-display');
    const grid = document.getElementById('base-kanji-grid');

    title.innerText = baseReading; // "はる"
    kanaDisplay.innerText = baseReading;
    grid.innerHTML = '<div class="col-span-3 text-sm text-[#bca37f]">読み込み中...</div>';

    setTimeout(() => {
        if (!master) return;

        const baseKata = toKata(baseReading);

        // Search for Kanji that matches this base reading
        let matches = master.filter(k => toKata(k['読み']) === baseKata);

        // If few matches, try fuzzy? No, stick to exact for base.

        // Sort by commonality/score
        if (typeof calculateKanjiScore === 'function') {
            matches.forEach(k => k.score = calculateKanjiScore(k));
            matches.sort((a, b) => b.score - a.score);
        }

        grid.innerHTML = '';
        matches.slice(0, 15).forEach(k => {
            const btn = document.createElement('button');
            btn.className = 'aspect-square bg-white rounded-xl shadow-sm border border-[#ede5d8] text-3xl font-black text-[#5d5444] hover:border-[#bca37f] hover:bg-[#fffbeb] active:scale-95 transition-all';
            btn.innerText = k['漢字'];
            btn.onclick = () => decideBaseKanji(k, baseReading);
            grid.appendChild(btn);
        });

        if (matches.length === 0) {
            grid.innerHTML = '<div class="col-span-3 text-sm text-[#d4c5af]">候補が見つかりませんでした</div>';
        }
    }, 100);
}

function decideBaseKanji(kanjiObj, reading) {
    console.log("FLOW: Base Kanji decided", kanjiObj);

    // Store this decision
    // We want to lock this Kanji for the specific part of the name.
    // Segments calculation needed.
    // Example: Name "Ha-ru-to". Base "Ha-ru".
    // We lock "Ha-ru" -> "春".

    // Update global liked array to pre-fill?
    // Need to know which segment index corresponds to the base.

    // First, let's process the full reading (selectedReadingForTomeji) into segments.
    // Then find the segment(s) matching the base.

    const fullReading = selectedReadingForTomeji;
    const nameInput = document.getElementById('in-name');
    if (nameInput) nameInput.value = fullReading;

    // Trigger standard segment calculation
    calcSegments();

    // Now look at `segments` global
    // e.g. ["はる", "と"] or ["は", "る", "と"]

    // Try to match `reading` (base) to segments.
    // 1. Exact match of a segment?
    // 2. Combination of segments? (e.g. segments=["は","る"], base="はる" -> Difficult to lock 2 segments to 1 Kanji here unless we merge segments)

    // If segments don't match base reading structure, we might need to FORCE segments.
    // e.g. Base="はる", Full="はると". calcSegments might say ["は","る","と"].
    // We want ["はる","と"] if user selected '春' (read as Haru).

    // Check if the selected Kanji's reading matches the base perfectly.
    // kanjiObj.reading usually covers it.

    // Ideally, we force the segmentation to respect the base.
    // But modifying `calcSegments` is risky.

    // Simple approach:
    // If `segments` contains the base reading as one chunk, lock it.
    // If not, we just pass the info to the next screen (Main) and let user handle, or try to merge.

    // Let's iterate segments and find match
    let locked = false;
    for (let i = 0; i < segments.length; i++) {
        if (segments[i] === reading) {
            // Found exact segment match!
            // Lock it.
            // Clear existing lock for this slot
            const existingIdx = liked.findIndex(l => l.slot === i);
            if (existingIdx > -1) liked.splice(existingIdx, 1);

            liked.push({
                ...kanjiObj,
                slot: i,
                sessionReading: uniqueId()
            });
            locked = true;
            break;
        }
    }

    if (!locked) {
        // Fallback: The segmentation didn't produce the base reading as a single chunk.
        // e.g. Base="はる", Segments=["は", "る", "と"].
        // User wants "春(はる)" + "と".
        // Use `forceSegments` logic? (Not available globally easily).
        // For now, we just proceed. User might need to re-segment manually in scr-segment if available.
        // Or we warn?
        console.warn("FLOW: Could not lock base kanji to segments automatically.", segments, reading);
    }

    // Proceed to Main Swipe (skip separate segment screen if possible, or go to it)
    // "scr-vibe" is next usually.
    changeScreen('scr-vibe');
}

function skipBaseKanji() {
    const fullReading = selectedReadingForTomeji;
    const nameInput = document.getElementById('in-name');
    if (nameInput) nameInput.value = fullReading;
    calcSegments();
    changeScreen('scr-vibe');
}

function closeNicknameList() {
    document.getElementById('nickname-liked-list').classList.add('hidden');
}

/**
 * Updated Physics for Nickname Card (mimic Main)
 */
function initNicknameCardEvents(card) {
    let startX = 0;
    let currentX = 0;
    let isDragging = false;
    const threshold = 100; // Same as main? Main uses 120 or so.

    const onStart = (clientX, clientY) => {
        startX = clientX;
        isDragging = true;
        card.style.transition = 'none';
        card.style.cursor = 'grabbing';
    };

    const onMove = (clientX, clientY) => {
        if (!isDragging) return;
        currentX = clientX - startX;

        // Rotation physics similar to main
        const rotate = currentX * 0.08;

        card.style.transform = `translate(${currentX}px, ${Math.abs(currentX) * 0.05}px) rotate(${rotate}deg)`;

        // Visual Feedback (Colors)
        if (currentX > 50) card.style.borderColor = '#81c995'; // LIKE
        else if (currentX < -50) card.style.borderColor = '#f28b82'; // NOPE
        else card.style.borderColor = '#ede5d8';
    };

    const onEnd = () => {
        if (!isDragging) return;
        isDragging = false;
        card.style.cursor = 'grab';
        card.style.borderColor = '#ede5d8';

        if (currentX > threshold) {
            nicknameSwipeAction('like');
        } else if (currentX < -threshold) {
            nicknameSwipeAction('nope');
        } else {
            // Reset
            card.style.transition = 'all 0.4s cubic-bezier(0.25, 1, 0.5, 1)';
            card.style.transform = 'translate(0, 0) rotate(0)';
        }
        currentX = 0;
    };

    // Touch
    card.addEventListener('touchstart', (e) => onStart(e.touches[0].clientX, e.touches[0].clientY), { passive: true });
    card.addEventListener('touchmove', (e) => onMove(e.touches[0].clientX, e.touches[0].clientY), { passive: true });
    card.addEventListener('touchend', onEnd);

    // Mouse
    card.addEventListener('mousedown', (e) => {
        onStart(e.clientX, e.clientY);
        e.preventDefault(); // Prevent text selection
    });

    const mouseMoveHandler = (e) => { if (isDragging) onMove(e.clientX, e.clientY); };
    const mouseUpHandler = () => {
        if (isDragging) {
            onEnd();
        }
    };

    // Bind window for mouse move/up to catch drag outside
    window.addEventListener('mousemove', mouseMoveHandler);
    window.addEventListener('mouseup', mouseUpHandler);

    // Cleanup helper (not strictly needed since cars remove, but good practice)
    card._cleanup = () => {
        window.removeEventListener('mousemove', mouseMoveHandler);
        window.removeEventListener('mouseup', mouseUpHandler);
    };
}

function showNicknameList() {
    const listContainer = document.getElementById('nickname-liked-list');
    const grid = document.getElementById('nickname-candidates-grid');
    grid.innerHTML = '';

    if (likedReadings.length === 0) {
        alert("気に入った読みがありませんでした。もう一度スワイプしますか？");
        startNicknameSwipe();
        return;
    }

    likedReadings.forEach(item => {
        const btn = document.createElement('button');
        let classes = 'p-4 rounded-xl text-lg font-bold transition-all text-center flex flex-col items-center justify-center gap-1 active:scale-95 ';

        if (item.isSuper) {
            classes += 'bg-[#fffbeb] border-2 border-[#fbbc04] text-[#5d5444] shadow-md';
        } else {
            classes += 'bg-[#fdfaf5] border border-[#ede5d8] text-[#5d5444] hover:bg-white hover:border-[#bca37f]';
        }

        btn.className = classes;
        btn.innerHTML = `
            ${item.isSuper ? '<span class="text-[10px] text-[#fbbc04]">★ SUPER</span>' : ''}
            <span>${item.reading}</span>
        `;
        btn.onclick = () => confirmReading(item.reading);
        grid.appendChild(btn);
    });

    listContainer.classList.remove('hidden');
}

function decideTomeji(kanjiObj, reading) {
    selectedTomeji = { kanji: kanjiObj['漢字'], reading: reading, obj: kanjiObj };
    console.log("FLOW: Tomeji decided", selectedTomeji);
    finalizeNicknameFlow();
}

function skipTomeji() {
    selectedTomeji = null;
    finalizeNicknameFlow();
}

/**
 * ニックネームフロー完了 -> 通常フローへ合流
 */
function finalizeNicknameFlow() {
    // データセット
    // reading: selectedReadingForTomeji
    const nameInput = document.getElementById('in-name');
    if (nameInput) nameInput.value = selectedReadingForTomeji;

    // 分割計算 (calcSegments) を呼ぶ
    // ただし、最後の文字を固定するための引数を渡す必要がある
    // calcSegmentsを改造するか、あるいは segments を直接いじるか

    // 02-engine.js の calcSegments は引数なしでDOMを読む
    // まず普通に計算させる

    // Note: calcSegments is async-ish in nature? No, sync.
    // しかし segments global 変数を更新する

    calcSegments();

    // もし止め字が決まっていれば、segments の末尾に対応する liked をセットする
    if (selectedTomeji) {
        // segments配列チェック
        // 例：はると -> [は, る, と] or [はる, と]
        // 末尾が一致しているか確認
        const lastSeg = segments[segments.length - 1];
        if (lastSeg === selectedTomeji.reading) {
            // 末尾一致。liked に追加
            // liked は {漢字:..., slot: index} の形
            // slotは 0-index. 
            // Swipe画面 (loadStack) は segments[currentPos] を見る。
            // 既に liked に slot corresponding to lastSeg があれば、Swipe画面はどうなる？

            // 簡易実装: likedに突っ込む
            const slotIdx = segments.length - 1;

            // 既存の同slotのものを消す
            const existingIdx = liked.findIndex(l => l.slot === slotIdx);
            if (existingIdx > -1) liked.splice(existingIdx, 1);

            liked.push({
                ...selectedTomeji.obj,
                slot: slotIdx,
                sessionReading: uniqueId() // dummy
            });

            console.log("FLOW: Auto-liked tomeji", liked);
        } else {
            console.warn("FLOW: Segments checking failed for tomeji", lastSeg, selectedTomeji.reading);
            // 分割が合わない場合（稀だが）、無理やりは適用しない
        }
    }

    // 画面は calcSegments 内で 'scr-segment' に変わる
    // しかし、分割が1通りしかなければ自動で次に行くロジックがほしい
    // あるいは、ここで強制的に 'scr-vibe' に飛ばす？

    // ユーザー体験的には「分割確認」→「イメージ」→「スワイプ」でOK
    // ただし、止め字が決まってるなら分割画面でそれをアピールしたい（今後の課題）

    // スワイプ開始時に最後の文字が「決定済み」に見えるようにするのは 05-ui-render.js の仕事
}

// Helper uniqueId
function uniqueId() { return Math.random().toString(36).substr(2, 9); }

/**
 * GoBack Override extension
 */
const originalGoBack = window.goBack;
window.goBack = function () {
    const active = document.querySelector('.screen.active');
    if (active && active.id === 'scr-nickname-swipe') {
        changeScreen('scr-input-nickname');
        return;
    }
    if (active && active.id === 'scr-tomeji-selection') {
        document.getElementById('nickname-liked-list').classList.remove('hidden');
        changeScreen('scr-nickname-swipe');
        return;
    }
    originalGoBack();
};

/**
 * 自由選択モード初期化 (簡易カタログ表示)
 */
function initFreeMode() {
    const container = document.getElementById('free-catalog');
    if (!container || !master) return;

    container.innerHTML = '<div class="col-span-4 text-center text-sm">読み込み中...</div>';

    // フィルタリング（性別・イメージ）
    // loadStackのロジックを再利用するか、簡易的にフィルタ
    let list = master.filter(k => {
        // 不適切除外
        if (k['不適切フラグ']) return false;
        return true;
    });

    // 性別・イメージスコア計算 (02-engine.jsの関数利用)
    if (typeof calculateKanjiScore === 'function') {
        list.forEach(k => k.score = calculateKanjiScore(k));
        // スコア順
        list.sort((a, b) => b.score - a.score);
    }

    // 表示（上位200件くらい？）
    container.innerHTML = '';
    list.slice(0, 300).forEach(k => {
        const btn = document.createElement('button');
        btn.className = 'aspect-square bg-white rounded-xl shadow-sm border border-[#eee5d8] flex flex-col items-center justify-center hover:border-[#bca37f] relative';
        btn.innerHTML = `
            <span class="text-2xl font-black text-[#5d5444]">${k['漢字']}</span>
            <span class="text-[8px] text-[#a6967a]">${k['画数']}画</span>
        `;

        // ストック状態チェック
        const isStocked = liked.some(l => l['漢字'] === k['漢字']);
        if (isStocked) {
            btn.classList.add('bg-[#fffbeb]', 'border-[#bca37f]');
        }

        btn.onclick = () => toggleStockFree(k, btn);
        container.appendChild(btn);
    });

    updateFreeStockBadge();
}

/**
 * 自由選択：ストック切り替え
 */
function toggleStockFree(k, btn) {
    const idx = liked.findIndex(l => l['漢字'] === k['漢字']);
    if (idx > -1) {
        liked.splice(idx, 1);
        btn.classList.remove('bg-[#fffbeb]', 'border-[#bca37f]');
    } else {
        // 簡易オブジェクト作成
        const item = { ...k, slot: -1, sessionReading: 'FREE' };
        liked.push(item);
        btn.classList.add('bg-[#fffbeb]', 'border-[#bca37f]');
    }
    if (typeof saveLiked === 'function') saveLiked();
    updateFreeStockBadge();
}

function updateFreeStockBadge() {
    const badge = document.getElementById('free-stock-badge');
    if (badge) {
        badge.innerText = liked.length;
        badge.classList.toggle('hidden', liked.length === 0);
    }
}

function finishFreeMode() {
    // ストック選択後、ビルド画面へ
    if (liked.length === 0) {
        if (!confirm('漢字が選択されていませんが、進みますか？')) return;
    }

    // ビルド画面を表示
    changeScreen('scr-build');
    if (typeof renderBuild === 'function') renderBuild();
}

function runDiagnosis() {
    alert('診断機能はデモ版のため現在利用できません。\n（読みと意味の解析ロジックを実装予定）');
}


/**
 * ルール設定 (Existing)
 */
function setRule(r) {
    console.log(`UI_FLOW: Rule set to ${r}`);
    rule = r;

    const bStrict = document.getElementById('btn-strict');
    const bLax = document.getElementById('btn-lax');

    if (bStrict) bStrict.classList.toggle('active', r === 'strict');
    if (bLax) bLax.classList.toggle('active', r === 'lax');
}

/**
 * スワイプモード開始 (Existing, modified)
 */
function startSwiping() {
    console.log("UI_FLOW: Starting swipe mode");

    // 名字データの確実な更新
    if (typeof updateSurnameData === 'function') {
        updateSurnameData();
    }

    const nav = document.getElementById('bottom-nav');
    if (nav) nav.classList.remove('hidden');

    currentPos = 0;
    swipes = 0;
    seen.clear();

    // Auto inherit
    autoInheritSameReadings();

    if (typeof loadStack === 'function') {
        loadStack();
    }
    changeScreen('scr-main');

    // 初回チュートリアル表示
    setTimeout(() => {
        showTutorial();
    }, 500);
}

/**
 * チュートリアル表示
 */
/**
 * チュートリアル制御
 */
let tutorialInterval;
let tutorialStep = 1; // 1: Swipe, 2: Detail, 3: Build

function showTutorial() {
    // 既に表示済みならスキップ (デバッグ用に一時的に無効化する場合はここをコメントアウト)
    if (localStorage.getItem('meimay_tutorial_shown_v2')) return;

    const modal = document.getElementById('modal-tutorial');
    if (modal) {
        modal.classList.add('active');
        localStorage.setItem('meimay_tutorial_shown_v2', 'true'); // バージョン変えて再表示させる

        // ステップ1から開始
        tutorialStep = 1;
        updateTutorialScene();
    }
}

function nextTutorialStep() {
    tutorialStep++;
    if (tutorialStep > 3) {
        closeTutorial();
    } else {
        updateTutorialScene();
    }
}

function updateTutorialScene() {
    const modal = document.getElementById('modal-tutorial');
    if (!modal) return;

    // Dots
    [1, 2, 3].forEach(i => {
        const dot = document.getElementById(`tut-dot-${i}`);
        if (dot) dot.classList.toggle('opacity-100', i === tutorialStep);
        if (dot) dot.classList.toggle('opacity-30', i !== tutorialStep);
    });

    // Scenes
    [1, 2, 3].forEach(i => {
        const scene = document.getElementById(`tut-scene-${i}`);
        if (scene) {
            if (i === tutorialStep) scene.classList.remove('hidden');
            else scene.classList.add('hidden');
        }
    });

    // Reset Animations
    if (tutorialInterval) clearInterval(tutorialInterval);

    // Start Scene Specific Animation
    if (tutorialStep === 1) startScene1Anim();
    else if (tutorialStep === 2) startScene2Anim();
    else if (tutorialStep === 3) startScene3Anim();
}

function startScene1Anim() {
    const scene = document.getElementById('tut-scene-1');
    if (!scene) return;

    let step = 0;
    const update = () => {
        scene.classList.remove('anim-swipe-right', 'anim-swipe-left', 'anim-swipe-up');
        const s = step % 3;
        if (s === 0) scene.classList.add('anim-swipe-right');
        else if (s === 1) scene.classList.add('anim-swipe-left');
        else scene.classList.add('anim-swipe-up');
        step++;
    };
    update();
    tutorialInterval = setInterval(update, 2000);
}

function startScene2Anim() {
    const scene = document.getElementById('tut-scene-2');
    if (!scene) return;
    scene.classList.add('anim-tap');
}

function startScene3Anim() {
    const scene = document.getElementById('tut-scene-3');
    if (!scene) return;
    scene.classList.add('anim-fly');
}

function closeTutorial() {
    const modal = document.getElementById('modal-tutorial');
    if (modal) {
        modal.classList.remove('active');
        if (tutorialInterval) clearInterval(tutorialInterval);
    }
}

/**
 * 同じ読みの自動引き継ぎ (Existing)
 */
function autoInheritSameReadings() {
    if (!segments || segments.length === 0) return;
    const readingCount = {};
    segments.forEach(seg => {
        readingCount[seg] = (readingCount[seg] || 0) + 1;
    });
    Object.keys(readingCount).forEach(reading => {
        if (readingCount[reading] >= 2) {
            const firstIndex = segments.indexOf(reading);
            if (firstIndex !== -1) {
                segments.autoInheritIndices = segments.autoInheritIndices || [];
                segments.forEach((seg, idx) => {
                    if (seg === reading && idx > firstIndex) {
                        segments.autoInheritIndices.push({ from: firstIndex, to: idx, reading: reading });
                    }
                });
            }
        }
    });
}

// Expose functions to global scope
window.startMode = startMode;
window.selectGender = selectGender;
window.submitVibe = submitVibe;
window.toggleVibe = toggleVibe;
window.processNickname = processNickname;
window.initFreeMode = initFreeMode;
window.toggleStockFree = toggleStockFree;
window.finishFreeMode = finishFreeMode;
window.runDiagnosis = runDiagnosis;
window.startSwiping = startSwiping;
window.setGender = setGender;
window.setRule = setRule;
window.goBack = goBack;
window.showTutorial = showTutorial;
window.closeTutorial = closeTutorial;
window.nextTutorialStep = nextTutorialStep;
window.processNickname = processNickname;
window.nicknameSwipeAction = nicknameSwipeAction;
window.resetNicknameSwipe = resetNicknameSwipe;
window.skipTomeji = skipTomeji;

console.log("UI_FLOW: Module loaded (Wizard Edition + Tutorial v2)");
