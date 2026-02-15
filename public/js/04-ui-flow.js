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
let selectedReadingForTomeji = '';
let selectedTomeji = null; // { kanji: '斗', reading: 'と' }

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

    // 位置取得
    const posRadios = document.getElementsByName('nickname-pos');
    let pos = 'prefix';
    for (let r of posRadios) if (r.checked) pos = r.value;

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
    likedReadings = [];
    changeScreen('scr-nickname-swipe');
    renderNicknameCard();

    // リスト画面を隠す
    document.getElementById('nickname-liked-list').classList.add('hidden');
    document.getElementById('nickname-swipe-msg').classList.add('hidden');
}

/**
 * 読みカード表示
 */
function renderNicknameCard() {
    const container = document.getElementById('nickname-swipe-container');
    const cards = container.querySelectorAll('.nickname-card');
    cards.forEach(c => c.remove());

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

    // Attach Touch Events !!
    initCardTouchEvents(card);
}

/**
 * 漢字サンプルHTML生成
 */
function getSampleKanjiHtml(item) {
    if (!master) return '<span class="text-xs text-[#d4c5af]">Loading...</span>';

    // item.reading (e.g. "はると")
    // Try to split it?
    // We don't have exact segmentation here, but we can guess.
    // Or we can just find *any* Kanji that matches a chunk.

    // 簡易ロジック:
    // 2文字～4文字の名前。
    // "はると" -> "Haru" + "To" is likely.

    let samples = [];

    // Try to find exact matches for the whole reading first (unlikely for long names)
    // const exacts = master.filter(k => toKata(k.reading) === toKata(item.reading)); 
    // ^ No, master contains single kanji usually.

    // Segments generation (Simple Heuristic for Display)
    // Try 2-char split for 3-mora name: 2+1, 1+2
    // Try 2-char split for 4-mora name: 2+2

    const r = item.reading;
    let parts = [];

    if (r.length === 3) {
        parts = [[r.substring(0, 2), r.substring(2)]]; // Haru-to
        parts.push([r.substring(0, 1), r.substring(1)]); // Ha-ruto
    } else if (r.length === 4) {
        parts = [[r.substring(0, 2), r.substring(2)]]; // Masa-haru
    } else if (r.length === 2) {
        parts = [[r.substring(0, 1), r.substring(1)]]; // Haru
    } else {
        parts = [[r]];
    }

    // Generate 1-2 examples
    let count = 0;

    // Helper to find top kanji for a reading
    const findKanji = (readingSegment) => {
        // filter master for kanji with this reading
        const kata = toKata(readingSegment);
        let cands = master.filter(m => toKata(m['読み']) === kata);
        // Sort by commonality logic (not present here, so random/length)
        // Assume master is somewhat ordered or random
        return cands.slice(0, 2).map(c => c['漢字']);
    };

    let generatedExamples = new Set();

    for (let p of parts) {
        if (count >= 3) break;

        let segs = p;
        if (segs.length === 1) {
            const ks = findKanji(segs[0]);
            ks.forEach(k => generatedExamples.add(k));
        } else {
            const k1s = findKanji(segs[0]);
            const k2s = findKanji(segs[1]);

            if (k1s.length > 0 && k2s.length > 0) {
                generatedExamples.add(`${k1s[0]}${k2s[0]}`);
                if (k1s[1] && k2s[1]) generatedExamples.add(`${k1s[1]}${k2s[1]}`);
            }
        }
    }

    if (generatedExamples.size === 0) return '<span class="text-xs text-[#d4c5af]">漢字例なし</span>';

    return Array.from(generatedExamples).slice(0, 3).map(ex =>
        `<span class="text-lg font-bold mx-1">${ex}</span>`
    ).join('');
}


/**
 * Touch Event Handling for Swipe
 */
function initCardTouchEvents(card) {
    let startX = 0;
    let currentX = 0;
    let isDragging = false;
    const threshold = 100;

    const onStart = (x) => {
        startX = x;
        isDragging = true;
        card.style.transition = 'none';
        card.style.cursor = 'grabbing';
    };

    const onMove = (x) => {
        if (!isDragging) return;
        currentX = x - startX;
        const rotate = currentX * 0.05;
        card.style.transform = `translateX(${currentX}px) rotate(${rotate}deg)`;

        // Visual Feedback
        if (currentX > 50) card.style.borderColor = '#8ab4f8';
        else if (currentX < -50) card.style.borderColor = '#f28b82';
        else card.style.borderColor = '#ede5d8';
    };

    const onEnd = () => {
        if (!isDragging) return;
        isDragging = false;
        card.style.transition = 'transform 0.3s ease, opacity 0.3s ease';
        card.style.cursor = 'grab';
        card.style.borderColor = '#ede5d8';

        if (currentX > threshold) {
            nicknameSwipeAction('like');
        } else if (currentX < -threshold) {
            nicknameSwipeAction('nope');
        } else {
            // Reset
            card.style.transform = 'translateX(0) rotate(0)';
        }
    };

    // Touch
    card.addEventListener('touchstart', (e) => onStart(e.touches[0].clientX), { passive: true });
    card.addEventListener('touchmove', (e) => onMove(e.touches[0].clientX), { passive: true });
    card.addEventListener('touchend', onEnd);

    // Mouse (for desktop testing)
    card.addEventListener('mousedown', (e) => onStart(e.clientX));
    window.addEventListener('mousemove', (e) => { if (isDragging) onMove(e.clientX); });
    window.addEventListener('mouseup', onEnd);
}


function nicknameSwipeAction(action) {
    if (currentSwipeIndex >= generatedCandidates.length) return;

    const container = document.getElementById('nickname-swipe-container');
    const card = container.querySelector('.nickname-card');
    if (!card) return;

    let x = 0;
    let r = 0;

    if (action === 'like') {
        x = 500; r = 20;
        likedReadings.push(generatedCandidates[currentSwipeIndex]);
    } else if (action === 'super') {
        x = 0; r = 0;
        // Super logic: Add to liked, maybe special flag
        const item = generatedCandidates[currentSwipeIndex];
        item.isSuper = true;
        likedReadings.push(item);

        // Fly up animation
        card.style.transition = 'all 0.4s ease';
        card.style.transform = 'translateY(-500px) scale(1.2)';
        card.style.opacity = '0';

        setTimeout(() => {
            currentSwipeIndex++;
            renderNicknameCard();
        }, 300);
        return;

    } else {
        x = -500; r = -20;
    }

    card.style.transition = 'all 0.4s ease';
    card.style.transform = `translate(${x}px, 50px) rotate(${r}deg)`;
    card.style.opacity = '0';

    setTimeout(() => {
        currentSwipeIndex++;
        renderNicknameCard();
    }, 300);
}

/**
 * 読み決定 -> 止め字選択へ
 */
function confirmReading(reading) {
    console.log(`FLOW: Confirmed reading ${reading}`);
    selectedReadingForTomeji = reading;
    selectedTomeji = null;

    // 止め字（末尾文字）を抽出
    // 後方一致で「まさはる」のような場合、「はる」全体を固定すべきか？
    // シンプルに「最後の1文字」を提案するロジックにする
    const lastChar = reading.slice(-1);
    // よぉ、りゅう、など拗音対応が必要だが一旦簡易実装

    // 画面遷移
    changeScreen('scr-tomeji-selection');
    initTomejiScreen(lastChar);
}

/**
 * 止め字画面初期化
 */
function initTomejiScreen(char) {
    const title = document.getElementById('tomeji-title');
    const grid = document.getElementById('tomeji-grid');

    title.innerText = `「${char}」の漢字`;
    grid.innerHTML = '<div class="col-span-3 text-sm text-[#bca37f]">読み込み中...</div>';

    // 漢字データ検索 (masterから)
    setTimeout(() => {
        if (!master) return;

        // スコア順に検索
        let candidates = master.filter(k => k['読み'] === char || k['読み'].includes(char)); // 簡易

        // より正確な検索: その読みを持つもの
        // masterには "読み": "アイ" のようにカタカナで入ってる場合と "あ" のようにひらがなの場合があるか確認が必要
        // 01-core.jsを見ると toKata(k['読み']) === toKata(char) で比較すべき
        const kataChar = toKata(char);

        const matches = master.filter(k => {
            // 読み文字数チェック（完全一致おすすめ）
            // データ構造: k['読み'] は カタカナスペース区切り？ いえ、ひらがなかカタカナの文字列
            return toKata(k['読み']) === kataChar;
        });

        // スコアソート等
        if (typeof calculateKanjiScore === 'function') {
            matches.forEach(k => k.score = calculateKanjiScore(k));
            matches.sort((a, b) => b.score - a.score);
        }

        grid.innerHTML = '';
        matches.slice(0, 12).forEach(k => {
            const btn = document.createElement('button');
            btn.className = 'aspect-square bg-white rounded-xl shadow-sm border border-[#ede5d8] text-2xl font-black text-[#5d5444] hover:border-[#bca37f] hover:bg-[#fffbeb] active:scale-95';
            btn.innerText = k['漢字'];
            btn.onclick = () => decideTomeji(k, char);
            grid.appendChild(btn);
        });

        if (matches.length === 0) {
            grid.innerHTML = '<div class="col-span-3 text-sm text-[#d4c5af]">候補が見つかりませんでした</div>';
        }
    }, 100);
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
